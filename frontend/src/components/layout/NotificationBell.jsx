import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoBell } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/authStore';
import useDismiss from '../../hooks/useDismiss';
import { toast } from '../../store/toastStore';
import { timeAgo } from '../workspace/WorkspaceCard';

const VERB = { mention: 'mentioned you', reply: 'replied to your comment', invite: '' };

// Mentions, replies and invites, live. Clicking one goes where it happened.
export default function NotificationBell({ className = '' }) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [names, setNames] = useState({});
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const loadNames = async (rows) => {
      const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
      if (!ids.length) return;
      const { data } = await supabase.from('profiles').select('id, display_name, email').in('id', ids);
      if (alive) setNames((n) => ({ ...n, ...Object.fromEntries((data || []).map((p) => [p.id, p.display_name || p.email])) }));
    };
    supabase
      .from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => {
        if (!alive) return;
        setItems(data || []);
        loadNames(data || []);
      });
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, ({ new: row }) => {
        setItems((list) => [row, ...list.filter((n) => n.id !== row.id)]);
        loadNames([row]);
        const message = { invite: 'You were added to a workspace', reply: `New reply: ${row.body}` }[row.type] || `You were mentioned: ${row.body}`;
        toast(message, row.link ? { action: { label: 'Open', onClick: () => navigate(row.link) } } : undefined);
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markRead = async (ids) => {
    if (!ids.length) return;
    setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  };

  if (!user) return null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        title="Notifications"
        className="icon-btn relative"
      >
        <GoBell size={16} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-canvas" aria-hidden="true" />}
      </button>
      {open && (
        <div className="menu absolute right-0 top-full z-50 mt-2 w-80 origin-top-right animate-scale-in p-0">
          <div className="flex h-10 items-center justify-between border-b border-line px-3">
            <span className="text-label-md text-ink">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))} className="text-label-sm text-brand-fg hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto p-1">
            {items.length === 0 && <li className="px-3 py-8 text-center text-body-sm text-ink-muted">You're all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    markRead([n.id]);
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  className="flex w-full gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-canvas-muted"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-body-sm text-ink">
                      <span className="font-medium">{names[n.actor_id] || 'Someone'}</span> {VERB[n.type] ?? ''}{n.type === 'invite' ? n.body : ''}
                    </span>
                    {n.type !== 'invite' && <span className="mt-0.5 block truncate text-body-sm text-ink-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-label-sm text-ink-subtle">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
