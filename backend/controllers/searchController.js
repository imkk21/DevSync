// Across all your workspaces: search, and what changed since you were last in each one
import { supabaseAdmin } from '../config/supabase.js';

const fail = (res, error) => res.status(500).json({ message: error.message });

async function memberships(userId) {
  const { data, error } = await supabaseAdmin.from('workspace_members').select('workspace_id, last_seen_at, archived').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

// Up to `max` lines of `text` containing `q` (case-insensitive), with 1-based line numbers
export function matchingLines(text, q, max = 3) {
  const needle = q.toLowerCase();
  const out = [];
  const lines = String(text || '').split('\n');
  for (let i = 0; i < lines.length && out.length < max; i++) {
    if (lines[i].toLowerCase().includes(needle)) out.push({ line: i + 1, text: lines[i].trim().slice(0, 200) });
  }
  return out;
}

// ilike pattern for "contains q", with % _ \ in q taken literally
export const containsPattern = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// GET /api/search?q= : workspaces, files, code, chat and tasks you can see that contain q
export async function search(req, res) {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q.length < 2) return res.json({ q, workspaces: [], files: [], code: [], messages: [], tasks: [] });
    const ids = (await memberships(req.user.id)).map((m) => m.workspace_id);
    if (!ids.length) return res.json({ q, workspaces: [], files: [], code: [], messages: [], tasks: [] });
    const like = containsPattern(q);

    const [ws, names, contents, messages, tasks] = await Promise.all([
      supabaseAdmin.from('workspaces').select('id, name, description').in('id', ids).ilike('name', like).limit(10),
      supabaseAdmin.from('files').select('id, workspace_id, path').in('workspace_id', ids).eq('is_folder', false).ilike('name', like).limit(20),
      supabaseAdmin.from('files').select('id, workspace_id, path, content').in('workspace_id', ids).eq('is_folder', false).ilike('content', like).limit(30),
      supabaseAdmin.from('messages').select('id, workspace_id, user_id, body, created_at').in('workspace_id', ids).ilike('body', like).order('created_at', { ascending: false }).limit(15),
      supabaseAdmin.from('tasks').select('id, workspace_id, title, status').in('workspace_id', ids).ilike('title', like).limit(15),
    ]);
    for (const r of [ws, names, contents, messages, tasks]) if (r.error) throw r.error;

    // Names for every workspace and author shown
    const wsIds = [...new Set([...names.data, ...contents.data, ...messages.data, ...tasks.data].map((r) => r.workspace_id))];
    const userIds = [...new Set(messages.data.map((m) => m.user_id).filter(Boolean))];
    const [{ data: wsRows }, { data: people }] = await Promise.all([
      wsIds.length ? supabaseAdmin.from('workspaces').select('id, name').in('id', wsIds) : { data: [] },
      userIds.length ? supabaseAdmin.from('profiles').select('id, display_name, email').in('id', userIds) : { data: [] },
    ]);
    const wsName = Object.fromEntries((wsRows || []).map((w) => [w.id, w.name]));
    const who = Object.fromEntries((people || []).map((p) => [p.id, p.display_name || p.email]));

    res.json({
      q,
      workspaces: ws.data,
      files: names.data.map((f) => ({ ...f, workspace: wsName[f.workspace_id] })),
      code: contents.data
        .filter((f) => !f.path.endsWith('.board')) // whiteboards are drawing data, not text
        .map((f) => ({ id: f.id, workspace_id: f.workspace_id, workspace: wsName[f.workspace_id], path: f.path, lines: matchingLines(f.content, q) }))
        .filter((f) => f.lines.length),
      messages: messages.data.map((m) => ({ ...m, body: m.body.slice(0, 200), author: who[m.user_id] || 'Someone', workspace: wsName[m.workspace_id] })),
      tasks: tasks.data.map((t) => ({ ...t, workspace: wsName[t.workspace_id] })),
    });
  } catch (error) {
    fail(res, error);
  }
}

// POST /api/workspaces/:id/seen : you've just been in this workspace
export async function markSeen(req, res) {
  try {
    await supabaseAdmin.from('workspace_members').update({ last_seen_at: new Date().toISOString() })
      .eq('workspace_id', req.params.id).eq('user_id', req.user.id);
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

const QUIET = new Set(['edit']); // activity rows that edits already cover

// GET /api/me/updates : per workspace, what other people did since you last left it (last 14 days at most)
export async function getUpdates(req, res) {
  try {
    const floor = Date.now() - 14 * 86400000;
    const seen = (await memberships(req.user.id)).filter((m) => !m.archived && m.last_seen_at)
      .map((m) => ({ id: m.workspace_id, since: new Date(Math.max(Date.parse(m.last_seen_at), floor)).toISOString() }));
    if (!seen.length) return res.json({ names: {}, updates: [] });
    const ids = seen.map((s) => s.id);
    const earliest = seen.reduce((a, s) => (s.since < a ? s.since : a), seen[0].since);

    const [edits, activity, messages, tasks] = await Promise.all([
      supabaseAdmin.from('doc_updates').select('workspace_id, file_id, user_ids, created_at').in('workspace_id', ids).gte('created_at', earliest).order('created_at', { ascending: false }).limit(2000),
      supabaseAdmin.from('activity').select('workspace_id, user_id, action, details, created_at').in('workspace_id', ids).gte('created_at', earliest).neq('user_id', req.user.id).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('messages').select('workspace_id, user_id, created_at').in('workspace_id', ids).gte('created_at', earliest).neq('user_id', req.user.id).limit(1000),
      supabaseAdmin.from('tasks').select('workspace_id, title, completed_at').in('workspace_id', ids).eq('status', 'done').gte('completed_at', earliest).limit(200),
    ]);
    for (const r of [edits, activity, messages, tasks]) if (r.error) throw r.error;

    const sinceOf = Object.fromEntries(seen.map((s) => [s.id, s.since]));
    const after = (r, at = r.created_at) => at > sinceOf[r.workspace_id];
    const out = new Map(ids.map((id) => [id, { workspace_id: id, since: sinceOf[id], latest: null, edits: new Map(), activity: [], messages: 0, tasks: [] }]));
    const touch = (u, at) => { if (!u.latest || at > u.latest) u.latest = at; };

    for (const e of edits.data) {
      const others = (e.user_ids || []).filter((x) => x !== req.user.id);
      if (!others.length || !after(e)) continue;
      const u = out.get(e.workspace_id);
      if (!u.edits.has(e.file_id)) u.edits.set(e.file_id, new Set());
      others.forEach((x) => u.edits.get(e.file_id).add(x));
      touch(u, e.created_at);
    }
    for (const a of activity.data) {
      if (!after(a) || QUIET.has(a.action)) continue;
      const u = out.get(a.workspace_id);
      if (u.activity.length < 5) u.activity.push({ user_id: a.user_id, action: a.action, details: a.details, created_at: a.created_at });
      touch(u, a.created_at);
    }
    for (const m of messages.data) if (after(m)) { out.get(m.workspace_id).messages++; touch(out.get(m.workspace_id), m.created_at); }
    for (const t of tasks.data) if (after(t, t.completed_at)) { out.get(t.workspace_id).tasks.push(t.title); touch(out.get(t.workspace_id), t.completed_at); }

    // Names for the files and people mentioned
    const changed = [...out.values()].filter((u) => u.latest);
    const fileIds = [...new Set(changed.flatMap((u) => [...u.edits.keys()]))];
    const userIds = [...new Set(changed.flatMap((u) => [...[...u.edits.values()].flatMap((s) => [...s]), ...u.activity.flatMap((a) => [a.user_id, a.details?.member]).filter(Boolean)]))];
    const [{ data: fileRows }, { data: people }] = await Promise.all([
      fileIds.length ? supabaseAdmin.from('files').select('id, path').in('id', fileIds) : { data: [] },
      userIds.length ? supabaseAdmin.from('profiles').select('id, display_name, email').in('id', userIds) : { data: [] },
    ]);
    const pathOf = Object.fromEntries((fileRows || []).map((f) => [f.id, f.path]));
    const names = Object.fromEntries((people || []).map((p) => [p.id, p.display_name || p.email]));

    res.json({
      names, // user id -> name, for the activity lines
      updates: changed
        .sort((a, b) => (a.latest < b.latest ? 1 : -1))
        .map((u) => ({
          ...u,
          edits: [...u.edits].filter(([f]) => pathOf[f]).map(([f, who]) => ({ file_id: f, path: pathOf[f], people: [...who].map((x) => names[x] || 'Someone') })),
        })),
    });
  } catch (error) {
    fail(res, error);
  }
}
