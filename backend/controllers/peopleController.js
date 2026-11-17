// Public portfolios and workspace insights (analytics for owners)
import { supabaseAdmin } from '../config/supabase.js';
import { isOwner } from '../services/access.js';

const DAY = 86_400_000;
const dayKey = (iso) => iso.slice(0, 10);

// No sign-in: a person's public page. Only what they chose to show.
export async function getPortfolio(req, res) {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('id, display_name, avatar_url, username, bio, links, showcase, created_at').eq('username', username).maybeSingle();
    if (!profile || profile.username?.toLowerCase() !== username) return res.status(404).json({ message: 'No one goes by that name here' });

    const since = new Date(Date.now() - 182 * DAY).toISOString();
    const [projects, activity, runs, accepted] = await Promise.all([
      profile.showcase?.length
        ? supabaseAdmin.from('workspaces').select('id, name, description, default_language, public_token, updated_at').in('id', profile.showcase).eq('owner_id', profile.id)
        : { data: [] },
      supabaseAdmin.from('activity').select('created_at').eq('user_id', profile.id).gte('created_at', since).limit(5000),
      supabaseAdmin.from('execution_logs').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
      supabaseAdmin.from('suggestions').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'accepted'),
    ]);
    const heatmap = {};
    for (const a of activity.data || []) heatmap[dayKey(a.created_at)] = (heatmap[dayKey(a.created_at)] || 0) + 1;

    const { id, showcase, ...publicProfile } = profile;
    res.json({
      profile: publicProfile,
      // Only showcased workspaces that are still shared publicly
      projects: (projects.data || []).filter((p) => p.public_token).map(({ id: _, ...p }) => p),
      stats: { runs: runs.count ?? 0, suggestionsAccepted: accepted.count ?? 0, activeDays: Object.keys(heatmap).length },
      heatmap,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Owner view of a workspace over the last 30 days
export async function getInsights(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can see insights' });
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const [activity, runs, saves, tasks, focus, checkins, members] = await Promise.all([
      supabaseAdmin.from('activity').select('user_id, action, created_at').eq('workspace_id', id).gte('created_at', since).limit(10000),
      supabaseAdmin.from('execution_logs').select('user_id, status, created_at').eq('workspace_id', id).gte('created_at', since).limit(10000),
      supabaseAdmin.from('doc_updates').select('file_id, user_ids, created_at').eq('workspace_id', id).gte('created_at', since).limit(20000),
      supabaseAdmin.from('tasks').select('status, due_date, assignee_id').eq('workspace_id', id),
      supabaseAdmin.from('focus_sessions').select('user_id, minutes, created_at').eq('workspace_id', id).gte('created_at', since),
      supabaseAdmin.from('checkins').select('week, mood').eq('workspace_id', id).order('week'),
      supabaseAdmin.from('workspace_members').select('user_id, role, profiles(display_name, email, avatar_url)').eq('workspace_id', id),
    ]);

    // One row per day for the chart, with every person's count
    const days = Array.from({ length: 30 }, (_, i) => dayKey(new Date(Date.now() - (29 - i) * DAY).toISOString()));
    const perDay = Object.fromEntries(days.map((d) => [d, { edits: 0, runs: 0, passed: 0 }]));
    const lastSeen = {};
    const people = {};
    const seen = (userId, at) => {
      if (!userId) return;
      if (!lastSeen[userId] || lastSeen[userId] < at) lastSeen[userId] = at;
    };
    for (const s of saves.data || []) {
      const d = perDay[dayKey(s.created_at)];
      if (d) d.edits += 1;
      for (const u of s.user_ids || []) {
        seen(u, s.created_at);
        people[u] = { ...(people[u] || {}), edits: (people[u]?.edits || 0) + 1 };
      }
    }
    for (const r of runs.data || []) {
      const d = perDay[dayKey(r.created_at)];
      const ok = r.status === 'Accepted' || r.status === 'Tests passed';
      if (d) {
        d.runs += 1;
        if (ok) d.passed += 1;
      }
      seen(r.user_id, r.created_at);
      people[r.user_id] = { ...(people[r.user_id] || {}), runs: (people[r.user_id]?.runs || 0) + 1 };
    }
    for (const a of activity.data || []) seen(a.user_id, a.created_at);
    for (const f of focus.data || []) people[f.user_id] = { ...(people[f.user_id] || {}), focusMinutes: (people[f.user_id]?.focusMinutes || 0) + f.minutes };

    // Most-edited files
    const fileCounts = {};
    for (const s of saves.data || []) fileCounts[s.file_id] = (fileCounts[s.file_id] || 0) + 1;
    const topIds = Object.entries(fileCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const { data: fileRows } = topIds.length ? await supabaseAdmin.from('files').select('id, path').in('id', topIds.map(([fid]) => fid)) : { data: [] };
    const pathOf = Object.fromEntries((fileRows || []).map((f) => [f.id, f.path]));

    // Team mood: weekly average, never who said what
    const moodByWeek = {};
    for (const c of checkins.data || []) (moodByWeek[c.week] ||= []).push(c.mood);

    const today = dayKey(new Date().toISOString());
    const t = tasks.data || [];
    res.json({
      days: days.map((d) => ({ day: d, ...perDay[d] })),
      members: (members.data || []).map((m) => ({
        id: m.user_id, role: m.role, name: m.profiles?.display_name || m.profiles?.email || 'Someone', avatar_url: m.profiles?.avatar_url,
        lastSeen: lastSeen[m.user_id] || null, edits: people[m.user_id]?.edits || 0, runs: people[m.user_id]?.runs || 0, focusMinutes: people[m.user_id]?.focusMinutes || 0,
      })),
      topFiles: topIds.map(([fid, saves]) => ({ path: pathOf[fid] || '(deleted)', saves })),
      tasks: { open: t.filter((x) => x.status !== 'done').length, done: t.filter((x) => x.status === 'done').length, overdue: t.filter((x) => x.status !== 'done' && x.due_date && x.due_date < today).length },
      // A week with one answer would show that person's mood, so it needs two
      mood: Object.entries(moodByWeek).filter(([, moods]) => moods.length >= 2).slice(-8).map(([week, moods]) => ({ week, average: moods.reduce((a, b) => a + b, 0) / moods.length, responses: moods.length })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
