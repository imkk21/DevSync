import { useEffect, useState } from 'react';
import { GoX } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useToastStore, { toast } from '../../store/toastStore';
import { celebrate } from '../../lib/celebrate';
import DropdownMenu from '../ui/DropdownMenu';

const FOCUS_KEY = 'devsync:focus';
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window */ } };

const mmss = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Focus mode: a 25 or 50 minute timer that holds back everything but errors.
// Survives a reload; the minutes are saved for the owner's insights.
export function FocusButton({ workspaceId }) {
  const [session, setSession] = useState(() => read(FOCUS_KEY)); // { until, minutes, workspaceId }
  const [, tick] = useState(0);

  const finish = async (s, completed) => {
    write(FOCUS_KEY, null);
    setSession(null);
    useToastStore.getState().setQuiet(0);
    const minutes = Math.min(s.minutes, Math.round((Date.now() - (s.until - s.minutes * 60_000)) / 60_000));
    if (minutes >= 1) await supabase.from('focus_sessions').insert({ workspace_id: s.workspaceId, minutes });
    if (completed) {
      celebrate();
      toast(`${s.minutes} focused minutes. Take a short break.`, { tone: 'success' });
    }
  };

  useEffect(() => {
    if (!session) return;
    useToastStore.getState().setQuiet(session.until);
    const t = setInterval(() => {
      if (Date.now() >= session.until) finish(session, true);
      else tick((n) => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (minutes) => {
    const s = { until: Date.now() + minutes * 60_000, minutes, workspaceId };
    write(FOCUS_KEY, s);
    setSession(s);
    toast(`Focusing for ${minutes} minutes. Notifications wait until you're done.`);
  };

  if (session) {
    return (
      <span className="badge shrink-0 gap-1.5 border-brand/25 bg-brand-soft text-brand-fg">
        <span aria-hidden="true">🎯</span>
        <span className="tabular-nums" role="timer" aria-label="Focus time left">{mmss(session.until - Date.now())}</span>
        <button type="button" onClick={() => finish(session, false)} className="-mr-1 rounded-sm p-0.5 hover:bg-brand/15" aria-label="Stop focusing">
          <GoX size={12} />
        </button>
      </span>
    );
  }
  return (
    <DropdownMenu
      label="Focus mode"
      className="hidden sm:block"
      trigger={<span aria-hidden="true" className="text-[15px] leading-none">🎯</span>}
      items={[
        { label: 'Focus for 25 minutes', onSelect: () => start(25) },
        { label: 'Focus for 50 minutes', onSelect: () => start(50) },
      ]}
    />
  );
}

// Monday of this week, as YYYY-MM-DD (local time)
export function weekOf(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MOODS = [['😫', 'Rough'], ['😕', 'Meh'], ['😐', 'Okay'], ['🙂', 'Good'], ['😀', 'Great']];

// Once a week in shared workspaces: how's it going? The owner only ever sees the average.
export function CheckinCard({ workspaceId, userId, memberCount }) {
  const week = weekOf();
  const key = `devsync:checkin:${workspaceId}:${week}`;
  const [show, setShow] = useState(false);
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (memberCount < 2 || read(key)) return;
    let alive = true;
    supabase.from('checkins').select('id').eq('workspace_id', workspaceId).eq('user_id', userId).eq('week', week).maybeSingle()
      .then(({ data, error }) => alive && !error && !data && setShow(true));
    return () => { alive = false; };
  }, [workspaceId, userId, memberCount, key, week]);

  if (!show) return null;
  const close = () => { write(key, true); setShow(false); };
  const send = async () => {
    const { error } = await supabase.from('checkins').insert({ workspace_id: workspaceId, week, mood, note: note.trim().slice(0, 500) || null });
    if (error && error.code !== '23505') return toast(error.message, { tone: 'error' });
    close();
    toast('Thanks. Only the team average is shown, never your answer.', { tone: 'success' });
  };

  return (
    <section aria-label="Weekly check-in" className="menu fixed bottom-4 left-4 z-[60] w-[min(320px,calc(100vw-32px))] p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-label-lg text-ink">How's this week going?</h2>
        <button type="button" onClick={close} className="icon-btn -mr-1 -mt-1 h-7 w-7" aria-label="Not now"><GoX size={14} /></button>
      </div>
      <div role="radiogroup" aria-label="Your week" className="mt-3 flex justify-between">
        {MOODS.map(([emoji, label], i) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={mood === i + 1}
            aria-label={label}
            title={label}
            onClick={() => setMood(i + 1)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-[22px] transition-transform hover:scale-110 ${mood === i + 1 ? 'bg-brand-soft ring-2 ring-brand' : ''}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      {mood && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="input input-multiline mt-3" placeholder="Anything blocking you? (optional, private)" aria-label="Note" />
          <button type="button" onClick={send} className="btn btn-sm btn-primary mt-3 w-full">Send</button>
        </>
      )}
    </section>
  );
}

// Past midnight: one gentle nudge a night
export function useLateNightNudge() {
  useEffect(() => {
    const now = new Date();
    if (now.getHours() >= 5) return;
    const key = `devsync:late:${now.toDateString()}`;
    if (read(key)) return;
    write(key, true);
    const t = setTimeout(() => toast("It's late. Your code will still be here after some sleep. 🌙"), 3000);
    return () => clearTimeout(t);
  }, []);
}
