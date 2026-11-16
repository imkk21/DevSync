// Teacher wall, classroom freeze, hints, raised hands and races; plus the public replay ("code movie")
// and the run button on embeds.
import { supabaseAdmin } from '../config/supabase.js';
import { readFileContent, replaceFileContent, onlineUserIds, setFrozen, isFrozen, broadcastToWorkspace } from '../collab.js';
import { getRole, canEdit, isOwner } from '../services/access.js';
import { logActivity } from '../services/events.js';
import { insertTree } from './workspaceController.js';
import { submitCode, getSubmissionResult, decodeResult } from '../services/judge0Service.js';
import { JUDGE0_IDS } from '../services/testWatch.js';

async function copiesOf(classroomId) {
  const { data } = await supabaseAdmin
    .from('workspaces')
    .select('id, owner_id, updated_at, hand_raised_at, hand_note, tests_passed, tests_total, tests_passed_at, profiles(display_name, email, avatar_url)')
    .eq('classroom_id', classroomId);
  return data || [];
}

// Leaderboard order: most tests passed, then whoever passed them all first
const byProgress = (a, b) => (b.tests_passed ?? -1) - (a.tests_passed ?? -1)
  || (a.tests_passed_at ? Date.parse(a.tests_passed_at) : Infinity) - (b.tests_passed_at ? Date.parse(b.tests_passed_at) : Infinity);

// Every student's copy: who, online, raised hand, tests, and a peek at the file they last changed
export async function getWall(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the teacher can see the class wall' });
    const { data: classroom } = await supabaseAdmin.from('workspaces').select('name, race_ends_at, is_classroom').eq('id', id).single();
    const students = await Promise.all((await copiesOf(id)).map(async (c) => {
      const { data: file } = await supabaseAdmin
        .from('files').select('id, path, content').eq('workspace_id', c.id).eq('is_folder', false)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const text = file ? await readFileContent(file.id, file.content) : '';
      return {
        id: c.id,
        name: c.profiles?.display_name || c.profiles?.email || 'Student',
        avatar_url: c.profiles?.avatar_url || null,
        userId: c.owner_id,
        online: onlineUserIds(c.id).has(c.owner_id),
        updated_at: c.updated_at,
        hand: c.hand_raised_at ? { at: c.hand_raised_at, note: c.hand_note } : null,
        tests: c.tests_total ? { passed: c.tests_passed, total: c.tests_total, passedAt: c.tests_passed_at } : null,
        file: file ? { path: file.path, preview: text.split('\n').slice(0, 18).join('\n').slice(0, 2000) } : null,
      };
    }));
    res.json({ name: classroom.name, raceEndsAt: classroom.race_ends_at, frozen: isFrozen(id), students: students.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function freezeClass(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the teacher can do this' });
    const on = !!req.body.on;
    setFrozen(id, on ? req.user.id : null, (await copiesOf(id)).map((c) => c.id));
    await logActivity(id, req.user.id, on ? 'class_frozen' : 'class_unfrozen');
    res.json({ frozen: on });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Put a file (e.g. HINT.md) into every student's copy, replacing it if it's already there
export async function sendHint(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the teacher can do this' });
    const path = `/${String(req.body.path || 'HINT.md').replace(/^\/+/, '').replace(/\.\.+/g, '.')}`.slice(0, 200);
    const content = String(req.body.content || '').slice(0, 100_000);
    const copies = await copiesOf(id);
    for (const c of copies) {
      const { data: existing } = await supabaseAdmin.from('files').select('id').eq('workspace_id', c.id).eq('path', path).maybeSingle();
      if (existing) await replaceFileContent(existing.id, c.id, content);
      else await insertTree(c.id, req.user.id, [{ path, content, language: path.endsWith('.md') ? 'markdown' : 'plaintext' }]);
      broadcastToWorkspace(c.id, 'classroom:hint', { path });
    }
    await logActivity(id, req.user.id, 'hint_sent', { path, students: copies.length });
    res.json({ sent: copies.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Raise or lower a hand on a student copy (the student, or the teacher clearing it)
export async function setHand(req, res) {
  try {
    const { id } = req.params;
    if (!canEdit(await getRole(id, req.user.id))) return res.status(403).json({ message: 'Not allowed' });
    const raised = !!req.body.raised;
    const { data, error } = await supabaseAdmin.from('workspaces')
      .update({ hand_raised_at: raised ? new Date().toISOString() : null, hand_note: raised ? String(req.body.note || '').slice(0, 200) || null : null })
      .eq('id', id).select().single();
    if (error) throw error;
    broadcastToWorkspace(id, 'workspace:updated', data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Start a timed race for the classroom (minutes), or stop it (0). Scores restart from now.
export async function setRace(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the teacher can do this' });
    const minutes = Math.round(Number(req.body.minutes) || 0);
    if (minutes < 0 || minutes > 240) return res.status(400).json({ message: 'Pick up to 240 minutes' });
    const race_ends_at = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
    const { data, error } = await supabaseAdmin.from('workspaces').update({ race_ends_at, is_classroom: true }).eq('id', id).select().single();
    if (error) throw error;
    if (minutes) {
      await supabaseAdmin.from('workspaces').update({ tests_passed: null, tests_total: null, tests_passed_at: null }).eq('classroom_id', id);
    }
    for (const c of await copiesOf(id)) broadcastToWorkspace(c.id, 'race', { endsAt: race_ends_at });
    broadcastToWorkspace(id, 'workspace:updated', data);
    await logActivity(id, req.user.id, minutes ? 'race_started' : 'race_stopped', { minutes });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// For a student copy: the race clock and leaderboard of its classroom
export async function getRace(req, res) {
  try {
    const { id } = req.params;
    if (!(await getRole(id, req.user.id))) return res.status(403).json({ message: 'Not a member' });
    const { data: copy } = await supabaseAdmin.from('workspaces').select('classroom_id').eq('id', id).single();
    if (!copy?.classroom_id) return res.json({ endsAt: null, board: [] });
    const { data: classroom } = await supabaseAdmin.from('workspaces').select('race_ends_at').eq('id', copy.classroom_id).maybeSingle();
    const board = (await copiesOf(copy.classroom_id)).sort(byProgress).map((c) => ({
      name: c.profiles?.display_name || 'Student', passed: c.tests_passed ?? 0, total: c.tests_total ?? 0, passedAt: c.tests_passed_at, you: c.id === id,
    }));
    res.json({ endsAt: classroom?.race_ends_at ?? null, board });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ---------- Public: code movies and embeds ----------

async function publicWorkspace(token) {
  if (!token || token.length < 16) return null;
  const { data } = await supabaseAdmin.from('workspaces').select('id, name').eq('public_token', token).maybeSingle();
  return data;
}

// Everything needed to play back how a file was written, with the chat from the same time
export async function getPublicReplay(req, res) {
  try {
    const ws = await publicWorkspace(req.params.token);
    if (!ws) return res.status(404).json({ message: 'This link is no longer shared' });
    const { data: file } = await supabaseAdmin.from('files').select('id, name, path').eq('id', req.params.fileId).eq('workspace_id', ws.id).maybeSingle();
    if (!file) return res.status(404).json({ message: 'File not found' });
    const { data: steps } = await supabaseAdmin.from('doc_updates').select('data, user_ids, created_at').eq('file_id', file.id).order('id').limit(5000);
    const from = steps?.[0]?.created_at;
    const to = steps?.at(-1)?.created_at;
    const { data: messages } = from
      ? await supabaseAdmin.from('messages').select('user_id, body, created_at').eq('workspace_id', ws.id).gte('created_at', from).order('created_at').limit(300)
      : { data: [] };
    const ids = [...new Set([...(steps || []).flatMap((s) => s.user_ids), ...(messages || []).map((m) => m.user_id)])];
    const { data: people } = ids.length ? await supabaseAdmin.from('profiles').select('id, display_name').in('id', ids) : { data: [] };
    res.json({
      workspace: { name: ws.name }, file: { name: file.name, path: file.path },
      steps: steps || [], messages: (messages || []).filter((m) => !to || m.created_at <= to),
      names: Object.fromEntries((people || []).map((p) => [p.id, p.display_name])),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Run button on embeds: the file's latest text, limited per visitor
const embedRuns = new Map(); // ip -> timestamps in the last minute
export async function runPublic(req, res) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    const now = Date.now();
    const recent = (embedRuns.get(ip) || []).filter((t) => now - t < 60_000);
    if (recent.length >= 5) return res.status(429).json({ message: 'Too many runs, try again in a minute' });
    recent.push(now);
    embedRuns.set(ip, recent);

    const ws = await publicWorkspace(req.params.token);
    if (!ws) return res.status(404).json({ message: 'This link is no longer shared' });
    const { data: file } = await supabaseAdmin.from('files').select('id, language, content').eq('id', req.body.fileId).eq('workspace_id', ws.id).maybeSingle();
    if (!file) return res.status(404).json({ message: 'File not found' });
    const languageId = JUDGE0_IDS[file.language];
    if (!languageId) return res.status(400).json({ message: "This file's language can't be run" });

    const submission = await submitCode(await readFileContent(file.id, file.content), languageId, String(req.body.stdin || '').slice(0, 10_000));
    let result = null;
    for (let i = 0; i < 20 && !(result?.status?.id > 2); i++) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await getSubmissionResult(submission.token);
    }
    if (!(result?.status?.id > 2)) return res.status(408).json({ message: 'Execution timed out' });
    res.json(decodeResult(result));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
