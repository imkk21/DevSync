// Suggestions (accept/reject), live forks (fork, compare, merge) and the test watcher toggle
import { supabaseAdmin } from '../config/supabase.js';
import { applySuggestion, readFileContent, replaceFileContent, broadcastToWorkspace } from '../collab.js';
import { getRole, canEdit } from '../services/access.js';
import { logActivity, notify, displayName } from '../services/events.js';
import { merge3 } from '../services/merge.js';
import { setWatching } from '../services/testWatch.js';
import { createWithFiles, readTree, quotaError, insertTree } from './workspaceController.js';

// ---------- Suggestions ----------

async function decide(req, res, accept) {
  try {
    const { data: s } = await supabaseAdmin.from('suggestions').select('*').eq('id', req.params.id).maybeSingle();
    if (!s) return res.status(404).json({ message: 'Suggestion not found' });
    if (!canEdit(await getRole(s.workspace_id, req.user.id))) return res.status(403).json({ message: 'Only editors can accept or reject suggestions' });
    if (s.status !== 'open') return res.status(409).json({ message: `This suggestion was already ${s.status}` });

    if (accept) {
      const result = await applySuggestion(s.file_id, s.workspace_id, {
        anchorStart: s.anchor_start, anchorEnd: s.anchor_end, original: s.original, replacement: s.replacement,
      });
      if (result.error) return res.status(409).json({ message: result.error });
    }
    const status = accept ? 'accepted' : 'rejected';
    const { data, error } = await supabaseAdmin
      .from('suggestions').update({ status, decided_by: req.user.id }).eq('id', s.id).select().single();
    if (error) throw error;

    const { data: file } = await supabaseAdmin.from('files').select('path').eq('id', s.file_id).maybeSingle();
    await logActivity(s.workspace_id, req.user.id, accept ? 'suggestion_accepted' : 'suggestion_rejected', { path: file?.path, line: s.line });
    if (s.user_id && s.user_id !== req.user.id) {
      await notify({
        userId: s.user_id, actorId: req.user.id, workspaceId: s.workspace_id, type: 'suggestion',
        body: `${accept ? 'accepted' : 'declined'} your suggestion in ${file?.path?.slice(1) || 'a file'}`, link: `/editor/${s.workspace_id}?file=${s.file_id}`,
      });
    }
    broadcastToWorkspace(s.workspace_id, 'suggestion:decided', data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
export const acceptSuggestion = (req, res) => decide(req, res, true);
export const rejectSuggestion = (req, res) => decide(req, res, false);

// ---------- Live forks ----------

// A copy to try an idea in. It remembers the text it started from, so merging back is a 3-way merge.
export async function forkWorkspace(req, res) {
  try {
    const { id } = req.params;
    if (!(await getRole(id, req.user.id))) return res.status(403).json({ message: 'Not a member of this workspace' });
    const quota = await quotaError(req.user.id);
    if (quota) return res.status(403).json({ message: quota });

    const { data: source } = await supabaseAdmin.from('workspaces').select('name, description, default_language').eq('id', id).single();
    const { files, tests } = await readTree(id);
    const base = Object.fromEntries(files.filter((f) => !f.is_folder).map((f) => [f.path, f.content ?? '']));
    const fork = await createWithFiles(
      req.user.id,
      { name: `${source.name} (fork)`.slice(0, 50), description: source.description, default_language: source.default_language, fork_of: id, fork_base: base },
      files,
      tests,
    );
    await logActivity(id, req.user.id, 'forked', { fork: fork.id });
    res.status(201).json(fork);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// What merging this fork back would do, file by file
async function compareFork(forkId, userId) {
  const { data: fork } = await supabaseAdmin.from('workspaces').select('id, name, fork_of, fork_base').eq('id', forkId).maybeSingle();
  if (!fork?.fork_of) return { status: 404, message: 'This workspace is not a fork' };
  if (!(await getRole(forkId, userId))) return { status: 403, message: 'Not a member of this fork' };
  const originalRole = await getRole(fork.fork_of, userId);
  if (!originalRole) return { status: 403, message: "You don't have access to the original workspace" };
  const { data: original } = await supabaseAdmin.from('workspaces').select('id, name').eq('id', fork.fork_of).maybeSingle();
  if (!original) return { status: 404, message: 'The original workspace was deleted' };

  const forkTree = (await readTree(forkId)).files.filter((f) => !f.is_folder);
  const { data: origRows } = await supabaseAdmin.from('files').select('id, path, is_folder, content').eq('workspace_id', original.id);
  const origByPath = new Map();
  for (const f of origRows || []) if (!f.is_folder) origByPath.set(f.path, { id: f.id, text: await readFileContent(f.id, f.content) });
  const base = fork.fork_base || {};

  const files = [];
  for (const f of forkTree) {
    const mine = f.content ?? '';
    const orig = origByPath.get(f.path);
    if (!orig) {
      if (base[f.path] === undefined) files.push({ path: f.path, status: 'added', original: '', fork: mine, merged: mine, language: f.language });
      continue;
    }
    const start = base[f.path] ?? orig.text;
    if (mine === start || mine === orig.text) continue; // nothing of yours to bring back
    const m = merge3(start, orig.text, mine);
    files.push({
      path: f.path, fileId: orig.id, language: f.language, original: orig.text, fork: mine, merged: m.text,
      status: m.conflict ? 'conflict' : orig.text === start ? 'changed' : 'combined',
    });
  }
  return { original, fork, files, canMerge: canEdit(originalRole) };
}

export async function getForkChanges(req, res) {
  try {
    const result = await compareFork(req.params.id, req.user.id);
    if (result.status) return res.status(result.status).json({ message: result.message });
    const { original, files, canMerge } = result;
    res.json({ original: { id: original.id, name: original.name }, files, canMerge });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Body: { paths: [...], useMine: [...paths whose conflicts resolve to the fork's version] }
export async function mergeFork(req, res) {
  try {
    const result = await compareFork(req.params.id, req.user.id);
    if (result.status) return res.status(result.status).json({ message: result.message });
    if (!result.canMerge) return res.status(403).json({ message: 'Only editors of the original can merge into it' });
    const paths = new Set(req.body.paths || []);
    const useMine = new Set(req.body.useMine || []);
    const merged = [];
    const skipped = [];
    const base = { ...(result.fork.fork_base || {}) };

    for (const f of result.files) {
      if (!paths.has(f.path)) continue;
      if (f.status === 'conflict' && !useMine.has(f.path)) {
        skipped.push(f.path);
        continue;
      }
      if (f.status === 'added') await insertTree(result.original.id, req.user.id, [{ path: f.path, content: f.fork, language: f.language }]);
      else await replaceFileContent(f.fileId, result.original.id, useMine.has(f.path) ? f.fork : f.merged);
      base[f.path] = f.fork; // the next merge starts from here
      merged.push(f.path);
    }
    if (merged.length) {
      await supabaseAdmin.from('workspaces').update({ fork_base: base }).eq('id', result.fork.id);
      await logActivity(result.original.id, req.user.id, 'fork_merged', { from: result.fork.name, files: merged.length });
    }
    res.json({ merged, skipped });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ---------- Live test bar ----------

// Any editor can switch "run tests on every save" on or off
export async function setWatchTests(req, res) {
  try {
    const { id } = req.params;
    if (!canEdit(await getRole(id, req.user.id))) return res.status(403).json({ message: 'Only editors can change this' });
    const on = !!req.body.on;
    const { data, error } = await supabaseAdmin.from('workspaces').update({ watch_tests: on }).eq('id', id).select().single();
    if (error) throw error;
    setWatching(id, on);
    await logActivity(id, req.user.id, on ? 'tests_watch_on' : 'tests_watch_off', { by: await displayName(req.user.id) });
    broadcastToWorkspace(id, 'workspace:updated', data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
