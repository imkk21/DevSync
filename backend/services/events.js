// Side effects of workspace actions: activity/audit log rows, notifications, optional email.
// None of these may break the action itself, so failures are logged and swallowed.
import { supabaseAdmin } from '../config/supabase.js';
import { alert } from './alerts.js';

const JOINS = new Set(['member_joined', 'member_added', 'student_joined']);

export async function logActivity(workspaceId, userId, action, details = {}) {
  const { error } = await supabaseAdmin.from('activity').insert({ workspace_id: workspaceId, user_id: userId, action, details });
  if (error) console.error('Activity log failed:', error.message);
  if (JOINS.has(action)) {
    displayName(action === 'member_added' ? details.member : userId)
      .then((name) => alert(workspaceId, 'members', `${name} joined`))
      .catch(() => {});
  }
}

export async function notify({ userId, actorId, workspaceId, type, body, link }) {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId, actor_id: actorId, workspace_id: workspaceId, type, body, link,
  });
  if (error) console.error('Notification failed:', error.message);
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Email through Resend when RESEND_API_KEY is set; otherwise a no-op.
export async function sendEmail({ to, subject, text, link }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'DevSync <onboarding@resend.dev>',
        to,
        subject,
        text: link ? `${text}\n\n${link}` : text,
        html: `<p>${escapeHtml(text)}</p>${link ? `<p><a href="${escapeHtml(link)}">Open DevSync</a></p>` : ''}`,
      }),
    });
    if (!res.ok) console.error('Email failed:', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('Email failed:', err.message);
    return false;
  }
}

export const appUrl = (path = '') => `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')}${path}`;

export async function displayName(userId) {
  const { data } = await supabaseAdmin.from('profiles').select('display_name, email').eq('id', userId).maybeSingle();
  return data?.display_name || data?.email || 'Someone';
}
