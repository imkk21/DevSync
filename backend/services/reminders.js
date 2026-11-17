// Event reminders: once a minute, people who said they're going get a notification (and an
// email when Resend is set up) 15 minutes before an event starts.
// ponytail: a timer in the web process; on a sleeping free host reminders wait until it wakes.
// Move to a scheduled job (Supabase cron, Render cron) if that matters.
import { supabaseAdmin } from '../config/supabase.js';
import { notify, sendEmail, appUrl } from './events.js';

const EVERY = 60_000;
const AHEAD = 15 * 60_000;

async function sendDue() {
  const now = Date.now();
  const { data: due, error } = await supabaseAdmin
    .from('events')
    .select('id, workspace_id, title, starts_at')
    .eq('reminded', false)
    .lte('starts_at', new Date(now + AHEAD).toISOString())
    .gte('starts_at', new Date(now - 5 * 60_000).toISOString());
  if (error || !due?.length) return;

  for (const event of due) {
    // Claim it first so two server instances never both send it
    const { data: claimed } = await supabaseAdmin.from('events').update({ reminded: true }).eq('id', event.id).eq('reminded', false).select('id');
    if (!claimed?.length) continue;
    const { data: going } = await supabaseAdmin.from('event_rsvps').select('user_id, profiles(email)').eq('event_id', event.id);
    const at = new Date(event.starts_at).toUTCString().slice(17, 22);
    const link = `/editor/${event.workspace_id}?view=events`;
    for (const r of going || []) {
      await notify({ userId: r.user_id, workspaceId: event.workspace_id, type: 'event', body: `${event.title} starts soon`, link });
      if (r.profiles?.email) {
        await sendEmail({ to: r.profiles.email, subject: `Starting soon: ${event.title}`, text: `${event.title} starts at ${at} UTC.`, link: appUrl(link) });
      }
    }
  }
}

setInterval(() => sendDue().catch((err) => console.error('Reminder check failed:', err.message)), EVERY);
