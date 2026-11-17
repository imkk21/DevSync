// Outside services: Slack/Discord alerts, LiveKit calls, calendar feeds
import { createHmac, randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { getRole, isOwner } from '../services/access.js';
import { ALERT_KINDS, serviceOf, postToHook, forgetHook } from '../services/alerts.js';
import { apiUrl, appUrl, displayName } from '../services/events.js';

const fail = (res, error) => res.status(error.status || 500).json({ message: error.message });

// ---------- Slack / Discord alerts (owner only) ----------

// The URL itself is a secret, so it's never sent back: only which service and which alerts
export async function getWebhook(req, res) {
  try {
    if (!(await isOwner(req.params.id, req.user.id))) return res.status(403).json({ message: 'Only the owner can set up alerts' });
    const { data } = await supabaseAdmin.from('workspace_webhooks').select('url, events').eq('workspace_id', req.params.id).maybeSingle();
    res.json(data ? { service: serviceOf(data.url), events: data.events } : { service: null, events: ALERT_KINDS });
  } catch (error) {
    fail(res, error);
  }
}

// { url?, events }: a new URL is tried with a hello message before it's saved
export async function saveWebhook(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can set up alerts' });
    const events = (Array.isArray(req.body.events) ? req.body.events : []).filter((e) => ALERT_KINDS.includes(e));
    const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';
    if (url) {
      if (!serviceOf(url)) return res.status(400).json({ message: 'Paste a Slack (hooks.slack.com/services/…) or Discord (discord.com/api/webhooks/…) webhook URL' });
      const { data: ws } = await supabaseAdmin.from('workspaces').select('name').eq('id', id).maybeSingle();
      const ok = await postToHook(url, { title: ws?.name || 'DevSync', text: 'Alerts are connected. Updates from this workspace will show up here.', link: appUrl(`/editor/${id}`) }).catch(() => false);
      if (!ok) return res.status(400).json({ message: "That webhook didn't accept a test message. Check the URL and try again." });
      const { error } = await supabaseAdmin.from('workspace_webhooks').upsert({ workspace_id: id, url, events, created_by: req.user.id });
      if (error) throw error;
    } else {
      const { data, error } = await supabaseAdmin.from('workspace_webhooks').update({ events }).eq('workspace_id', id).select('url');
      if (error) throw error;
      if (!data?.length) return res.status(400).json({ message: 'Paste a webhook URL first' });
    }
    forgetHook(id);
    const { data } = await supabaseAdmin.from('workspace_webhooks').select('url, events').eq('workspace_id', id).maybeSingle();
    res.json({ service: serviceOf(data.url), events: data.events });
  } catch (error) {
    fail(res, error);
  }
}

export async function deleteWebhook(req, res) {
  try {
    if (!(await isOwner(req.params.id, req.user.id))) return res.status(403).json({ message: 'Only the owner can set up alerts' });
    await supabaseAdmin.from('workspace_webhooks').delete().eq('workspace_id', req.params.id);
    forgetHook(req.params.id);
    res.json({ service: null, events: ALERT_KINDS });
  } catch (error) {
    fail(res, error);
  }
}

// ---------- Voice and video calls (LiveKit) ----------

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

// LiveKit access tokens are plain HS256 JWTs signed with the project's API secret
export function liveKitToken({ key, secret, room, identity, name, metadata, ttl = 6 * 3600 }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key, sub: identity, name, metadata, nbf: now - 10, exp: now + ttl,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
  };
  const body = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

// A short-lived ticket into this workspace's call. Members only.
export async function callToken(req, res) {
  try {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return res.status(503).json({ message: "Calls aren't set up on this server yet (LiveKit keys are missing)." });
    if (!(await getRole(req.params.id, req.user.id))) return res.status(403).json({ message: 'Not a member of this workspace' });
    const { data: profile } = await supabaseAdmin.from('profiles').select('display_name, email, avatar_url').eq('id', req.user.id).maybeSingle();
    const token = liveKitToken({
      key: LIVEKIT_API_KEY,
      secret: LIVEKIT_API_SECRET,
      room: `workspace-${req.params.id}`,
      identity: req.user.id,
      name: profile?.display_name || profile?.email || 'Someone',
      metadata: JSON.stringify({ avatar_url: profile?.avatar_url || null }),
    });
    res.json({ url: LIVEKIT_URL, token });
  } catch (error) {
    fail(res, error);
  }
}

// ---------- Calendar feed: every event in your workspaces, as a subscribable .ics ----------

const feedUrl = (req, token) => apiUrl(req, `/api/calendar/${token}.ics`);

export async function getCalendarFeed(req, res) {
  try {
    const { data } = await supabaseAdmin.from('calendar_feeds').select('token').eq('user_id', req.user.id).maybeSingle();
    res.json({ url: data ? feedUrl(req, data.token) : null });
  } catch (error) {
    fail(res, error);
  }
}

// Makes a new link; any old one stops working
export async function resetCalendarFeed(req, res) {
  try {
    const token = randomBytes(24).toString('base64url');
    const { error } = await supabaseAdmin.from('calendar_feeds').upsert({ user_id: req.user.id, token });
    if (error) throw error;
    res.json({ url: feedUrl(req, token) });
  } catch (error) {
    fail(res, error);
  }
}

export async function deleteCalendarFeed(req, res) {
  try {
    await supabaseAdmin.from('calendar_feeds').delete().eq('user_id', req.user.id);
    res.json({ url: null });
  } catch (error) {
    fail(res, error);
  }
}

// RFC 5545 text: escape \ ; , and newlines, fold lines at 75 bytes
const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTime = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function fold(line) {
  const out = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildCalendar(events, { name = 'DevSync', now = new Date() } = {}) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DevSync//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@devsync`,
      `DTSTAMP:${icsTime(now)}`,
      `DTSTART:${icsTime(e.starts_at)}`,
      `DTEND:${icsTime(e.ends_at)}`,
      `SUMMARY:${icsText(e.workspace ? `${e.title} (${e.workspace})` : e.title)}`,
      ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// No sign-in: the random token in the link is the key
export async function calendarIcs(req, res) {
  try {
    const { data: feed } = await supabaseAdmin.from('calendar_feeds').select('user_id').eq('token', req.params.token).maybeSingle();
    if (!feed) return res.status(404).type('text/plain').send('This calendar link was reset or removed.');
    const { data: memberships } = await supabaseAdmin.from('workspace_members').select('workspace_id').eq('user_id', feed.user_id);
    const ids = (memberships || []).map((m) => m.workspace_id);
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const { data: events } = ids.length
      ? await supabaseAdmin.from('events').select('id, title, description, starts_at, ends_at, workspace_id, workspaces(name)').in('workspace_id', ids).gte('ends_at', since).order('starts_at').limit(500)
      : { data: [] };
    const name = `DevSync · ${await displayName(feed.user_id)}`;
    res.set('Cache-Control', 'private, max-age=900');
    res.type('text/calendar; charset=utf-8').send(buildCalendar((events || []).map((e) => ({
      ...e, workspace: e.workspaces?.name, url: appUrl(`/editor/${e.workspace_id}?view=events`),
    })), { name }));
  } catch (error) {
    res.status(500).type('text/plain').send(error.message);
  }
}

// ---------- Push notifications: one row per device ----------

const keyOk = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{8,200}={0,2}$/.test(s);

// The browser's PushSubscription.toJSON(): { endpoint, keys: { p256dh, auth } }
export async function savePushDevice(req, res) {
  try {
    const { endpoint, keys } = req.body || {};
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1000 || !keyOk(keys?.p256dh) || !keyOk(keys?.auth)) {
      return res.status(400).json({ message: 'That push subscription looks wrong' });
    }
    // Keyed by device: whoever turned it on last on this browser gets its notifications
    const { error } = await supabaseAdmin.from('push_subscriptions')
      .upsert({ endpoint, user_id: req.user.id, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' });
    if (error) throw error;
    res.json({ on: true });
  } catch (error) {
    fail(res, error);
  }
}

export async function deletePushDevice(req, res) {
  try {
    await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', String(req.body?.endpoint || '')).eq('user_id', req.user.id);
    res.json({ on: false });
  } catch (error) {
    fail(res, error);
  }
}
