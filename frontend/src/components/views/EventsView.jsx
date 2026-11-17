import { useEffect, useState } from 'react';
import { GoCalendar, GoCheck, GoDownload, GoPlus, GoTrash } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import { toast } from '../../store/toastStore';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

const DURATIONS = [30, 45, 60, 90, 120, 180];
const endOf = (e) => (e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + 60 * 60_000));
const day = (d) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const clock = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// A calendar file (.ics) any calendar app can import
export function icsFor(event, url) {
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DevSync//Events//EN', 'BEGIN:VEVENT',
    `UID:${event.id}@devsync`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(new Date(event.starts_at))}`, `DTEND:${stamp(endOf(event))}`,
    `SUMMARY:${esc(event.title)}`, `DESCRIPTION:${esc(`${event.description || ''}\n\nJoin: ${url}`)}`, `URL:${url}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

function downloadIcs(event, workspaceId) {
  const url = `${window.location.origin}/editor/${workspaceId}`;
  const blob = new Blob([icsFor(event, url)], { type: 'text/calendar' });
  const href = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href, download: `${event.title.replace(/[^\w-]+/g, '-')}.ics` }).click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function NewEvent({ isOpen, onClose, workspaceId, userId, onCreated }) {
  const soon = new Date(Date.now() + 60 * 60_000);
  soon.setMinutes(0, 0, 0);
  const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(local(soon));
  const [minutes, setMinutes] = useState(60);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast('Give the event a name.');
    const starts = new Date(start);
    setBusy(true);
    const { data, error } = await supabase.from('events').insert({
      workspace_id: workspaceId, title: title.trim(), description: description.trim() || null,
      starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + minutes * 60_000).toISOString(), created_by: userId,
    }).select().single();
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    onCreated(data);
    setTitle('');
    setDescription('');
    onClose();
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New event"
      description="Pairing sessions, workshops, office hours. Everyone in the workspace sees it and can say they're going."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="event-form" loading={busy}>Create event</Button></>}
    >
      <form id="event-form" onSubmit={submit} className="space-y-4">
        <Input label="Name" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday pairing on the parser" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-label-md text-ink">Starts</span>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="input mt-1.5" required />
          </label>
          <label className="block">
            <span className="text-label-md text-ink">Length</span>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="input mt-1.5">
              {DURATIONS.map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-label-md text-ink">Details <span className="font-normal text-ink-muted">(optional)</span></span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} className="input input-multiline mt-1.5" />
        </label>
      </form>
    </Modal>
  );
}

export default function EventsView({ workspaceId, userId, people, readOnly, onJoin }) {
  const [events, setEvents] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [creating, setCreating] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [, tick] = useState(0);
  const personOf = (id) => people.find((p) => p.id === id) || { id, name: 'Someone' };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [e, r] = await Promise.all([
        supabase.from('events').select('*').eq('workspace_id', workspaceId).order('starts_at'),
        supabase.from('event_rsvps').select('event_id, user_id').eq('workspace_id', workspaceId),
      ]);
      if (!alive) return;
      setEvents(e.data || []);
      setRsvps(r.data || []);
    };
    load();
    const scope = (table) => ({ schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` });
    const channel = supabase.channel(`events:${workspaceId}`)
      .on('postgres_changes', { event: '*', ...scope('events') }, load)
      .on('postgres_changes', { event: '*', ...scope('event_rsvps') }, load)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_rsvps' }, load)
      .subscribe();
    const t = setInterval(() => tick((n) => n + 1), 30_000); // "starting now" changes over time
    return () => {
      alive = false;
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const toggleGoing = async (event) => {
    const going = rsvps.some((r) => r.event_id === event.id && r.user_id === userId);
    setRsvps((list) => (going ? list.filter((r) => !(r.event_id === event.id && r.user_id === userId)) : [...list, { event_id: event.id, user_id: userId }]));
    const res = going
      ? await supabase.from('event_rsvps').delete().eq('event_id', event.id).eq('user_id', userId)
      : await supabase.from('event_rsvps').insert({ event_id: event.id, user_id: userId, workspace_id: workspaceId });
    if (res.error) toast(res.error.message, { tone: 'error' });
    else if (!going) toast("You're going. We'll remind you 15 minutes before.", { tone: 'success' });
  };
  const remove = async (event) => {
    setEvents((list) => list.filter((e) => e.id !== event.id));
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) toast(error.message, { tone: 'error' });
  };

  if (!events) return <div className="p-6 text-body-sm text-ink-muted">Loading events…</div>;
  const now = new Date();
  const upcoming = events.filter((e) => endOf(e) >= now);
  const past = events.filter((e) => endOf(e) < now).reverse();

  const card = (e) => {
    const start = new Date(e.starts_at);
    const end = endOf(e);
    const live = start <= now && now <= end;
    const going = rsvps.filter((r) => r.event_id === e.id).map((r) => personOf(r.user_id));
    const mine = going.some((p) => p.id === userId);
    return (
      <li key={e.id} className={`card flex gap-4 p-4 ${live ? 'border-brand' : ''}`}>
        <div className="flex w-14 shrink-0 flex-col items-center rounded-md border border-line bg-canvas-subtle py-2">
          <span className="text-label-sm uppercase text-ink-muted">{start.toLocaleDateString(undefined, { month: 'short' })}</span>
          <span className="text-headline-sm font-semibold text-ink">{start.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-label-lg text-ink">{e.title}</h3>
            {live && <span className="badge border-brand/25 bg-brand-soft text-brand-fg">Happening now</span>}
          </div>
          <p className="mt-1 text-body-sm text-ink-muted">{day(start)} · {clock(start)} to {clock(end)}</p>
          {e.description && <p className="mt-2 whitespace-pre-wrap text-body-sm text-ink">{e.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {live && <Button size="sm" onClick={onJoin}>Join now</Button>}
            {end >= now && (
              <Button size="sm" variant={mine ? 'primary' : 'secondary'} onClick={() => toggleGoing(e)} aria-pressed={mine}>
                {mine && <GoCheck size={14} />} {mine ? 'Going' : "I'm going"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => downloadIcs(e, workspaceId)} title="Add to your calendar (.ics)"><GoDownload size={14} /> Add to calendar</Button>
            {going.length > 0 && (
              <span className="ml-1 flex items-center gap-2 text-label-sm text-ink-muted">
                <span className="flex -space-x-1.5">{going.slice(0, 5).map((p) => <Avatar key={p.id} name={p.name} id={p.id} src={p.avatar_url} size={22} ring title={p.name} />)}</span>
                {going.length} going
              </span>
            )}
            {!readOnly && <button type="button" onClick={() => remove(e)} className="icon-btn ml-auto h-7 w-7" aria-label={`Delete ${e.title}`} title="Delete event"><GoTrash size={14} /></button>}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-headline-sm font-semibold text-ink">Events</h2>
            <p className="mt-1 text-body-sm text-ink-muted">Sessions held in this workspace. Reminders go out 15 minutes before.</p>
          </div>
          {!readOnly && <Button onClick={() => setCreating(true)}><GoPlus size={16} /> New event</Button>}
        </div>
        {upcoming.length === 0 ? (
          <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
            <GoCalendar size={22} className="text-ink-subtle" aria-hidden="true" />
            <p className="mt-3 text-body-sm text-ink-muted">Nothing scheduled.</p>
          </div>
        ) : <ul className="mt-6 space-y-3">{upcoming.map(card)}</ul>}
        {past.length > 0 && (
          <div className="mt-8">
            <button type="button" onClick={() => setShowPast((v) => !v)} className="text-label-md text-ink-muted hover:text-ink">{showPast ? 'Hide' : 'Show'} past events ({past.length})</button>
            {showPast && <ul className="mt-3 space-y-3 opacity-80">{past.map(card)}</ul>}
          </div>
        )}
      </div>
      <NewEvent isOpen={creating} onClose={() => setCreating(false)} workspaceId={workspaceId} userId={userId} onCreated={(e) => setEvents((list) => [...(list || []).filter((x) => x.id !== e.id), e].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))} />
    </div>
  );
}
