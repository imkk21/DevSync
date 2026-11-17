// Phone and desktop notifications (Web Push). Every row added to `notifications` (mentions,
// replies, invites, suggestions, event reminders) is also pushed to the devices its person
// turned notifications on for, so they hear about it with DevSync closed.
import webpush from 'web-push';
import { supabaseAdmin } from '../config/supabase.js';
import { appUrl, displayName } from './events.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
export const pushKey = VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY ? VAPID_PUBLIC_KEY : null;
if (pushKey) {
  // Push services want a way to reach the sender: the site's https address (localhost while developing)
  const site = appUrl();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || (site.startsWith('https://') ? site : 'mailto:push@localhost'), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const SAID = { mention: 'mentioned you: ', reply: 'replied to your comment: ' };

// The notification as a phone shows it: who, then what (same wording as the bell)
export async function pushMessage(n) {
  const who = n.actor_id ? await displayName(n.actor_id) : 'DevSync';
  const body = n.type === 'event' ? `📅 ${n.body}` : `${SAID[n.type] ?? ''}${n.body ?? ''}`;
  return { title: who, body: body.slice(0, 240), link: n.link?.startsWith('/') ? n.link : '/dashboard', tag: n.id };
}

export async function pushTo(userId, message) {
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId);
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 86400 });
    } catch (err) {
      // 404/410: the person turned notifications off or uninstalled; forget that device
      if (err.statusCode === 404 || err.statusCode === 410) await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      else console.error('Push failed:', err.statusCode || err.message);
    }
  }));
}

export function startPush() {
  if (!pushKey) return;
  supabaseAdmin
    .channel('push')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async ({ new: n }) => {
      try {
        await pushTo(n.user_id, await pushMessage(n));
      } catch (err) {
        console.error('Push failed:', err.message);
      }
    })
    .subscribe();
}
