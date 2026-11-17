// GitHub sync: connect an account, import a repo as a new workspace, and send a workspace's
// changes back as a commit or a pull request (or into a brand-new repo).
import { supabaseAdmin } from '../config/supabase.js';
import { getRole, canEdit, isOwner } from '../services/access.js';
import { apiUrl, appUrl, logActivity } from '../services/events.js';
import { merge3 } from '../services/merge.js';
import { replaceFileContent } from '../collab.js';
import { readTree, createWithFiles, insertTree, quotaError } from './workspaceController.js';
import {
  gh, GitHubError, githubReady, makeState, readState, seal, unseal, tokenOf,
  importable, pickFiles, blobText, languageOf, mainLanguage, inBatches, REPO_RE, BRANCH_RE,
} from '../services/github.js';

async function fail(res, error, userId) {
  if (error instanceof GitHubError) {
    if (error.status === 401 && userId) {
      await supabaseAdmin.from('github_accounts').delete().eq('user_id', userId);
      return res.status(400).json({ message: 'Your GitHub connection expired. Connect GitHub again.' });
    }
    const message = error.status === 404 ? "GitHub couldn't find that, or your GitHub account can't see it." : error.message;
    return res.status(error.status >= 500 ? 502 : error.status).json({ message });
  }
  console.error('GitHub sync failed:', error);
  res.status(500).json({ message: error.message });
}

const callbackUrl = (req) => apiUrl(req, '/api/github/callback');

// ---------- Account ----------

export async function githubStatus(req, res) {
  const { data } = await supabaseAdmin.from('github_accounts').select('login').eq('user_id', req.user.id).maybeSingle();
  res.json({ configured: githubReady(), login: data?.login ?? null });
}

// Where to send the browser to approve DevSync on GitHub. `next` is the DevSync page to come back to.
export function githubConnect(req, res) {
  if (!githubReady()) return res.status(503).json({ message: "GitHub isn't set up on this server yet." });
  const next = typeof req.body?.next === 'string' && /^\/(?!\/)/.test(req.body.next) ? req.body.next.slice(0, 300) : '/settings';
  const url = new URL('https://github.com/login/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: callbackUrl(req),
    scope: 'repo', // read and write the person's repos, private ones included
    state: makeState(req.user.id, next),
  });
  res.json({ url: url.href });
}

// GitHub sends the browser here. Nothing is saved yet: the page it returns to finishes signed in
// as that person, so a sign-in link someone else started can't attach their GitHub to you.
export function githubCallback(req, res) {
  const state = readState(req.query.state);
  const next = state?.next || '/settings';
  const params = req.query.code && state
    ? new URLSearchParams({ github_code: String(req.query.code), github_state: String(req.query.state) })
    : new URLSearchParams({ github: state ? 'cancelled' : 'expired' });
  res.redirect(appUrl(`${next}${next.includes('?') ? '&' : '?'}${params}`));
}

export async function githubFinish(req, res) {
  try {
    const state = readState(req.body?.state);
    if (!state || state.userId !== req.user.id) {
      return res.status(400).json({ message: 'That GitHub sign-in expired or was started by someone else. Connect again.' });
    }
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: String(req.body.code || ''),
        redirect_uri: callbackUrl(req),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const t = await r.json().catch(() => ({}));
    if (!t.access_token) return res.status(400).json({ message: 'GitHub sign-in expired. Connect again.' });
    const me = await gh(t.access_token, '/user');
    const { error } = await supabaseAdmin.from('github_accounts').upsert({ user_id: req.user.id, login: me.login, token: seal(t.access_token) });
    if (error) throw error;
    res.json({ login: me.login });
  } catch (error) {
    fail(res, error, req.user.id);
  }
}

// Forget the token here and ask GitHub to revoke it too
export async function githubDisconnect(req, res) {
  const { data } = await supabaseAdmin.from('github_accounts').select('token').eq('user_id', req.user.id).maybeSingle();
  await supabaseAdmin.from('github_accounts').delete().eq('user_id', req.user.id);
  if (data && githubReady()) {
    const { GITHUB_CLIENT_ID: id, GITHUB_CLIENT_SECRET: secret } = process.env;
    try {
      await fetch(`https://api.github.com/applications/${id}/grant`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, Accept: 'application/vnd.github+json', 'User-Agent': 'DevSync' },
        body: JSON.stringify({ access_token: unseal(data.token) }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch { /* already gone, or GitHub is down: the token is deleted here either way */ }
  }
  res.json({ login: null });
}

// The person's repos, most recently pushed first
export async function githubRepos(req, res) {
  try {
    const { token } = await tokenOf(req.user.id);
    const list = await gh(token, '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member');
    res.json(list.map((r) => ({ repo: r.full_name, private: r.private, description: r.description, branch: r.default_branch, pushed_at: r.pushed_at })));
  } catch (error) {
    fail(res, error, req.user.id);
  }
}

// ---------- Import a repo as a new workspace ----------

export async function githubImport(req, res) {
  try {
    const repo = String(req.body?.repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/(\.git)?\/*$/, '');
    if (!REPO_RE.test(repo)) return res.status(400).json({ message: 'Pick a repo, or paste one like owner/name.' });
    const quota = await quotaError(req.user.id);
    if (quota) return res.status(403).json({ message: quota });
    const { token } = await tokenOf(req.user.id);

    const info = await gh(token, `/repos/${repo}`);
    const head = await gh(token, `/repos/${info.full_name}/branches/${encodeURIComponent(info.default_branch)}`);
    const { tree, truncated } = await gh(token, `/repos/${info.full_name}/git/trees/${head.commit.commit.tree.sha}?recursive=1`);
    const { picked, skipped } = pickFiles(tree);
    const entries = (await inBatches(picked, 8, async (e) => {
      const content = await blobText(token, info.full_name, e.sha);
      return content === null ? null : { path: e.path, content, language: languageOf(e.path) };
    })).filter(Boolean);
    if (!entries.length) return res.status(400).json({ message: 'That repo has no text files DevSync can open.' });

    const workspace = await createWithFiles(req.user.id, {
      name: (info.name.length >= 3 ? info.name : `${info.name} repo`).slice(0, 50),
      description: (info.description || `From github.com/${info.full_name}`).slice(0, 200),
      default_language: mainLanguage(entries.map((e) => e.path)),
    }, entries);
    const { error } = await supabaseAdmin.from('github_links').insert({
      workspace_id: workspace.id, repo: info.full_name, branch: info.default_branch, sha: head.commit.sha, paths: entries.map((e) => e.path),
    });
    if (error) throw error;
    res.status(201).json({ workspace, imported: entries.length, skipped: skipped + picked.length - entries.length, truncated: !!truncated });
  } catch (error) {
    fail(res, error, req.user.id);
  }
}

// ---------- A workspace and its repo ----------

export async function workspaceGithub(req, res) {
  try {
    const role = await getRole(req.params.id, req.user.id);
    if (!role) return res.status(403).json({ message: 'Not a member of this workspace' });
    const [{ data: link }, { data: account }] = await Promise.all([
      supabaseAdmin.from('github_links').select('repo, branch, updated_at').eq('workspace_id', req.params.id).maybeSingle(),
      supabaseAdmin.from('github_accounts').select('login').eq('user_id', req.user.id).maybeSingle(),
    ]);
    res.json({ configured: githubReady(), login: account?.login ?? null, link: link ?? null, role });
  } catch (error) {
    fail(res, error);
  }
}

// Conflict markers left by a merge: <<<<<<< ... ======= ... >>>>>>>, each at the start of a line
export const CONFLICT_RE = /^<{7}(?: .*)?$[\s\S]*?^={7}$[\s\S]*?^>{7}(?: .*)?$/m;

// One commit on top of `parent` holding the workspace as it is right now (live edits included).
// Files deleted in DevSync since the last sync are deleted on GitHub; files DevSync never had
// (images, lock files...) are left alone. Returns null when nothing changed.
async function commitWorkspace(token, workspaceId, repo, parent, before, message) {
  const { files } = await readTree(workspaceId);
  const now = files.filter((f) => !f.is_folder).map((f) => ({ path: f.path.replace(/^\/+/, ''), content: f.content ?? '' }));
  const unresolved = now.filter((f) => CONFLICT_RE.test(f.content)).map((f) => f.path);
  if (unresolved.length) {
    throw new GitHubError(409, `Resolve the conflicts first (the <<<<<<< ======= >>>>>>> lines) in ${unresolved.slice(0, 5).join(', ')}${unresolved.length > 5 ? ` and ${unresolved.length - 5} more` : ''}.`);
  }
  const parentCommit = await gh(token, `/repos/${repo}/git/commits/${parent}`);
  const { tree: old } = await gh(token, `/repos/${repo}/git/trees/${parentCommit.tree.sha}?recursive=1`);
  const modes = new Map(old.filter((e) => e.type === 'blob').map((e) => [e.path, e.mode]));
  const keep = new Set(now.map((f) => f.path));
  const tree = await gh(token, `/repos/${repo}/git/trees`, {
    method: 'POST',
    body: {
      base_tree: parentCommit.tree.sha,
      tree: [
        ...now.map((f) => ({ path: f.path, mode: modes.get(f.path) === '100755' ? '100755' : '100644', type: 'blob', content: f.content })),
        ...before.filter((p) => !keep.has(p) && modes.has(p)).map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null })),
      ],
    },
  });
  if (tree.sha === parentCommit.tree.sha) return null;
  const commit = await gh(token, `/repos/${repo}/git/commits`, { method: 'POST', body: { message, tree: tree.sha, parents: [parent] } });
  return { sha: commit.sha, paths: now.map((f) => f.path) };
}

// Body: { message, mode: 'pr' | 'direct', branch?, title? }
// A pull request (the default) is always safe: its branch starts from the last synced commit, so
// GitHub shows exactly what changed in DevSync and handles anything changed on GitHub meanwhile.
// 'direct' only fast-forwards: it refuses if the branch moved on GitHub since the last sync.
export async function githubPush(req, res) {
  try {
    const { id } = req.params;
    if (!canEdit(await getRole(id, req.user.id))) return res.status(403).json({ message: 'Only editors can send changes to GitHub' });
    const { data: link } = await supabaseAdmin.from('github_links').select('*').eq('workspace_id', id).maybeSingle();
    if (!link) return res.status(404).json({ message: "This workspace isn't linked to a GitHub repo yet." });
    const message = String(req.body?.message || '').trim().slice(0, 2000) || 'Update from DevSync';
    const direct = req.body?.mode === 'direct';
    const branch = direct ? null : String(req.body?.branch || '').trim() || `devsync-${Date.now().toString(36)}`;
    if (!direct && !BRANCH_RE.test(branch)) return res.status(400).json({ message: 'Branch names can use letters, numbers, ".", "_", "-" and "/".' });
    const { token } = await tokenOf(req.user.id);

    const commit = await commitWorkspace(token, id, link.repo, link.sha, link.paths, message);
    if (!commit) return res.status(400).json({ message: 'Nothing to send: no changes since the last sync with GitHub.' });

    if (direct) {
      try {
        await gh(token, `/repos/${link.repo}/git/refs/heads/${link.branch}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
      } catch (e) {
        if (e.status === 422) return res.status(409).json({ message: `${link.branch} has new commits on GitHub. Get them first with "Get latest from GitHub", or open a pull request instead.` });
        throw e;
      }
      await supabaseAdmin.from('github_links').update({ sha: commit.sha, paths: commit.paths, updated_at: new Date().toISOString() }).eq('workspace_id', id);
      return res.json({ url: `https://github.com/${link.repo}/commit/${commit.sha}` });
    }

    try {
      await gh(token, `/repos/${link.repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
    } catch (e) {
      if (e.status === 422) return res.status(409).json({ message: `A branch called ${branch} already exists on GitHub. Pick another name.` });
      throw e;
    }
    const pr = await gh(token, `/repos/${link.repo}/pulls`, {
      method: 'POST',
      body: { title: String(req.body?.title || '').trim().slice(0, 200) || message.split('\n')[0].slice(0, 200), head: branch, base: link.branch, body: message === 'Update from DevSync' ? 'Opened from DevSync.' : `${message}\n\nOpened from DevSync.` },
    });
    res.json({ url: pr.html_url });
  } catch (error) {
    fail(res, error, req.user.id);
  }
}

// All blobs of a commit's tree: Map(path -> { sha, size, mode, path, type })
async function blobsAt(token, repo, treeSha) {
  const { tree } = await gh(token, `/repos/${repo}/git/trees/${treeSha}?recursive=1`);
  return new Map(tree.filter((e) => e.type === 'blob').map((e) => [e.path, e]));
}

export const PULL_LIMIT = 300;

// Bring what changed on GitHub since the last sync into the workspace (merged pull requests,
// teammates' pushes). For each file GitHub changed:
//   - untouched here: GitHub's version replaces it (or it's added, or deleted)
//   - also changed here: the two are merged line by line, like git; overlapping edits keep both
//     between <<<<<<< markers for someone to pick
//   - deleted on GitHub but edited here: kept
// Open editors update live. Files DevSync doesn't bring in (images, lock files...) are skipped.
export async function githubPull(req, res) {
  try {
    const { id } = req.params;
    if (!canEdit(await getRole(id, req.user.id))) return res.status(403).json({ message: 'Only editors can get changes from GitHub' });
    const { data: link } = await supabaseAdmin.from('github_links').select('*').eq('workspace_id', id).maybeSingle();
    if (!link) return res.status(404).json({ message: "This workspace isn't linked to a GitHub repo yet." });
    const { token } = await tokenOf(req.user.id);

    const head = await gh(token, `/repos/${link.repo}/branches/${encodeURIComponent(link.branch)}`);
    if (head.commit.sha === link.sha) return res.json({ upToDate: true, updated: [], added: [], deleted: [], conflicts: [], kept: [] });
    const baseCommit = await gh(token, `/repos/${link.repo}/git/commits/${link.sha}`);
    const [before, after] = await Promise.all([blobsAt(token, link.repo, baseCommit.tree.sha), blobsAt(token, link.repo, head.commit.commit.tree.sha)]);
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter((p) => before.get(p)?.sha !== after.get(p)?.sha);
    if (changed.length > PULL_LIMIT) {
      return res.status(413).json({ message: `${changed.length} files changed on GitHub, more than DevSync pulls at once (${PULL_LIMIT}). Import the repo again as a new workspace instead.` });
    }

    const { files } = await readTree(id);
    const here = new Map(files.filter((f) => !f.is_folder).map((f) => [f.path.replace(/^\/+/, ''), f]));
    const synced = new Set(link.paths);
    const out = { updated: [], added: [], deleted: [], conflicts: [], kept: [] };
    const toAdd = [];
    const toDelete = [];

    await inBatches(changed, 8, async (p) => {
      const was = before.get(p);
      const now = after.get(p);
      const mine = here.get(p);
      if (!now) { // deleted on GitHub
        if (!mine) return;
        const base = was && importable(was) ? await blobText(token, link.repo, was.sha) : null;
        if (base !== null && base === mine.content) {
          toDelete.push(mine.id);
          out.deleted.push(p);
        } else out.kept.push(p);
        return;
      }
      if (!importable(now)) return;
      const theirs = await blobText(token, link.repo, now.sha);
      if (theirs === null) return; // binary
      if (!mine) { // new on GitHub, or deleted here while GitHub changed it: GitHub's work wins back
        toAdd.push({ path: p, content: theirs, language: languageOf(p) });
        out.added.push(p);
        return;
      }
      const base = was && synced.has(p) ? (await blobText(token, link.repo, was.sha)) ?? '' : '';
      const r = merge3(base, mine.content ?? '', theirs);
      if (r.text === (mine.content ?? '')) return; // already has GitHub's change
      await replaceFileContent(mine.id, id, r.text);
      (r.conflict ? out.conflicts : out.updated).push(p);
    });
    if (toAdd.length) await insertTree(id, req.user.id, toAdd);
    if (toDelete.length) await supabaseAdmin.from('files').delete().in('id', toDelete);

    // Synced paths: what GitHub's latest has that we track. Files deleted here but not yet sent
    // stay listed, so the next push still deletes them on GitHub.
    const paths = [...new Set([...link.paths, ...out.added, ...here.keys()])].filter((p) => after.has(p) && !out.deleted.includes(p));
    await supabaseAdmin.from('github_links').update({ sha: head.commit.sha, paths, updated_at: new Date().toISOString() }).eq('workspace_id', id);
    const total = out.updated.length + out.added.length + out.deleted.length + out.conflicts.length;
    if (total) await logActivity(id, req.user.id, 'github_pulled', { repo: link.repo, files: total });
    for (const k of Object.keys(out)) out[k].sort();
    res.json({ upToDate: false, ...out });
  } catch (error) {
    fail(res, error, req.user.id);
  }
}

// Owner: put a workspace that didn't come from GitHub into a new repo of theirs. Body: { name, private }
export async function githubCreateRepo(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can link this workspace to GitHub' });
    const { data: existing } = await supabaseAdmin.from('github_links').select('repo').eq('workspace_id', id).maybeSingle();
    if (existing) return res.status(409).json({ message: `Already linked to ${existing.repo}` });
    const name = String(req.body?.name || '').trim();
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name)) return res.status(400).json({ message: 'Repo names can use letters, numbers, ".", "_" and "-".' });
    const { token } = await tokenOf(req.user.id);

    let info;
    try {
      info = await gh(token, '/user/repos', { method: 'POST', body: { name, private: req.body?.private !== false, auto_init: true } });
    } catch (e) {
      if (e.status === 422) return res.status(409).json({ message: `You already have a repo called ${name} on GitHub.` });
      throw e;
    }
    // GitHub writes the first commit (a README) a moment after creating the repo
    let head = null;
    for (let i = 0; i < 6 && !head; i++) {
      head = await gh(token, `/repos/${info.full_name}/branches/${encodeURIComponent(info.default_branch)}`).catch((e) => {
        if (e.status !== 404 && e.status !== 409) throw e;
        return new Promise((r) => setTimeout(() => r(null), 1000));
      });
    }
    if (!head) return res.status(502).json({ message: `Created ${info.full_name}, but GitHub is still setting it up. Unlink and try again in a minute.` });

    const commit = await commitWorkspace(token, id, info.full_name, head.commit.sha, [], 'First commit from DevSync');
    if (commit) await gh(token, `/repos/${info.full_name}/git/refs/heads/${info.default_branch}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
    const { error } = await supabaseAdmin.from('github_links').insert({
      workspace_id: id, repo: info.full_name, branch: info.default_branch, sha: commit?.sha ?? head.commit.sha, paths: commit?.paths ?? [],
    });
    if (error) throw error;
    res.status(201).json({ url: info.html_url, link: { repo: info.full_name, branch: info.default_branch } });
  } catch (error) {
    fail(res, error, req.user.id);
  }
}

// Owner: stop syncing (the repo on GitHub is untouched)
export async function githubUnlink(req, res) {
  try {
    if (!(await isOwner(req.params.id, req.user.id))) return res.status(403).json({ message: 'Only the owner can unlink GitHub' });
    await supabaseAdmin.from('github_links').delete().eq('workspace_id', req.params.id);
    res.json({ link: null });
  } catch (error) {
    fail(res, error);
  }
}
