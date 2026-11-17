// Slack / Discord alerts: a workspace owner connects a channel's incoming-webhook URL and the
// server posts there when tests break or get fixed, a task is finished, an event is planned, or
// someone joins. Failures are logged and never break the action that triggered them.
import { supabaseAdmin } from '../config/supabase.js';
import { appUrl } from './events.js';

// Only real Slack/Discord webhook URLs, so the server can't be pointed at anything else
const SLACK = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;
const DISCORD = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;
export const ALERT_KINDS = ['tests', 'tasks', 'events', 'members'];
export const serviceOf = (url) => (SLACK.test(url) ? 'slack' : DISCORD.test(url) ? 'discord' : null);

const hooks = new Map(); // workspaceId -> { url, events } | null
export const forgetHook = (workspaceId) => hooks.delete(workspaceId);

async function hookFor(workspaceId) {
  if (!hooks.has(workspaceId)) {
    const { data } = await supabaseAdmin.from('workspace_webhooks').select('url, events').eq('workspace_id', workspaceId).maybeSingle();
    hooks.set(workspaceId, data || null);
  }
  return hooks.get(workspaceId);
}

// Slack treats <, > and & as markup (<!channel> pings everyone), so names and titles are escaped
const slackText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// at: a time shown in each reader's own time zone
function format(service, { title, text, at, link }) {
  if (service === 'slack') {
    const when = at ? ` <!date^${Math.floor(Date.parse(at) / 1000)}^{date_short_pretty} at {time}|${at}>` : '';
    return { text: `*${slackText(title)}*: ${slackText(text)}${when}\n<${link}|Open in DevSync>` };
  }
  const when = at ? ` <t:${Math.floor(Date.parse(at) / 1000)}:f>` : '';
  return { content: `**${title}**: ${text}${when}\n${link}`, allowed_mentions: { parse: [] } }; // never ping @everyone
}

export async function postToHook(url, message) {
  const service = serviceOf(url);
  if (!service) return false;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(format(service, message)),
    signal: AbortSignal.timeout(5000),
  });
  return res.ok;
}

export async function alert(workspaceId, kind, text, { at, path = '' } = {}) {
  try {
    const hook = await hookFor(workspaceId);
    if (!hook?.events?.includes(kind)) return;
    const { data: ws } = await supabaseAdmin.from('workspaces').select('name').eq('id', workspaceId).maybeSingle();
    const ok = await postToHook(hook.url, { title: ws?.name || 'DevSync', text, at, link: appUrl(`/editor/${workspaceId}${path}`) });
    if (!ok) console.error('Alert not delivered for workspace', workspaceId);
  } catch (err) {
    console.error('Alert failed:', err.message);
  }
}

// Tasks and events are written by the browser straight to the database, so listen for them there.
// ponytail: alerts that happen while the server sleeps (Render free tier) are missed; a database webhook fixes that
export function startAlerts() {
  supabaseAdmin
    .channel('alerts')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, ({ new: task, old }) => {
      if (task.status === 'done' && old?.status && old.status !== 'done') alert(task.workspace_id, 'tasks', `Task done: ${task.title}`, { path: '?view=tasks' });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, ({ new: event }) => {
      alert(event.workspace_id, 'events', `New event: ${event.title},`, { at: event.starts_at, path: '?view=events' });
    })
    .subscribe();
}
