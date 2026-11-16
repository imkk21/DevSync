import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GoArrowLeft, GoLock, GoMortarBoard, GoNote, GoUnlock, GoX } from 'react-icons/go';
import { api } from '../lib/api';
import { toast } from '../store/toastStore';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import ToggleGroup from '../components/ui/ToggleGroup';
import ThemeMenu from '../components/ui/ThemeMenu';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { timeAgo } from '../components/workspace/WorkspaceCard';

const POLL_MS = 3000;

function Countdown({ to }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((Date.parse(to) - Date.now()) / 1000));
  if (!s) return <span>Time's up</span>;
  return <span className="font-mono tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

function HintModal({ isOpen, onClose, classroomId }) {
  const [path, setPath] = useState('HINT.md');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { sent } = await api(`/api/workspaces/${classroomId}/hint`, { method: 'POST', body: { path, content } });
      toast(`Sent to ${sent} ${sent === 1 ? 'student' : 'students'}`, { tone: 'success' });
      onClose();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send a hint"
      description="Adds this file to every student's copy (or replaces it), and tells them."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="hint-form" loading={busy}>Send to everyone</Button></>}
    >
      <form id="hint-form" onSubmit={send} className="space-y-4">
        <Input label="File name" value={path} onChange={(e) => setPath(e.target.value)} />
        <label className="block">
          <span className="text-label-md text-ink">Contents</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="input input-multiline mt-1.5 font-mono sm:text-code-md" placeholder="Try splitting the input into words first…" />
        </label>
      </form>
    </Modal>
  );
}

// Classroom teacher view: every student's copy, live (refreshes every few seconds)
export default function WallPage() {
  const { workspaceId } = useParams();
  const [wall, setWall] = useState(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('name');
  const [hint, setHint] = useState(false);
  const [raceMinutes, setRaceMinutes] = useState(20);

  const load = () => api(`/api/workspaces/${workspaceId}/wall`).then(setWall).catch((err) => setError(err.message));
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [workspaceId]);

  const act = async (path, body, done) => {
    try {
      await api(`/api/workspaces/${path}`, { method: 'POST', body });
      if (done) toast(done, { tone: 'success' });
      load();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-20">
        <Alert>{error}</Alert>
        <Link to={`/editor/${workspaceId}`} className="btn btn-md btn-secondary mt-6"><GoArrowLeft size={16} /> Back</Link>
      </div>
    );
  }
  if (!wall) return <PageLoader label="Loading the class…" />;

  const racing = wall.raceEndsAt && Date.parse(wall.raceEndsAt) > Date.now();
  const students = [...wall.students].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'hands') return (b.hand ? 1 : 0) - (a.hand ? 1 : 0) || a.name.localeCompare(b.name);
    return (b.tests?.passed ?? -1) - (a.tests?.passed ?? -1) || (Date.parse(a.tests?.passedAt || '') || Infinity) - (Date.parse(b.tests?.passedAt || '') || Infinity);
  });
  const hands = students.filter((s) => s.hand).length;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-canvas px-4">
        <Link to={`/editor/${workspaceId}`} className="icon-btn" aria-label="Back to the classroom workspace"><GoArrowLeft size={16} /></Link>
        <GoMortarBoard size={18} className="text-brand-fg" aria-hidden="true" />
        <h1 className="truncate text-label-lg text-ink">{wall.name}</h1>
        <span className="badge">{students.length} {students.length === 1 ? 'student' : 'students'}</span>
        {hands > 0 && <span className="badge border-[#D29922]/40 bg-[#FFF8E5] text-[#7D4E00] dark:bg-[#2B2111] dark:text-[#E3B341]">✋ {hands}</span>}
        <div className="ml-auto flex items-center gap-2">
          <ThemeMenu className="hidden sm:block" />
          <Button size="sm" variant="secondary" onClick={() => setHint(true)}><GoNote size={14} /> Send a hint</Button>
          <Button size="sm" variant={wall.frozen ? 'primary' : 'secondary'} onClick={() => act(`${workspaceId}/freeze`, { on: !wall.frozen }, wall.frozen ? 'Editing is back on' : 'Everyone is paused')}>
            {wall.frozen ? <GoUnlock size={14} /> : <GoLock size={14} />} {wall.frozen ? 'Let them type' : 'Pause everyone'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup label="Sort" size="sm" value={sort} onChange={setSort} options={[{ id: 'name', label: 'Name' }, { id: 'progress', label: 'Progress' }, { id: 'hands', label: 'Hands up' }]} />
          <div className="ml-auto flex items-center gap-2">
            {racing ? (
              <>
                <span className="badge border-brand/25 bg-brand-soft text-brand-fg">Race · <Countdown to={wall.raceEndsAt} /></span>
                <Button size="sm" variant="ghost" onClick={() => act(`${workspaceId}/race`, { minutes: 0 }, 'Race stopped')}>Stop race</Button>
              </>
            ) : (
              <>
                <label htmlFor="race-min" className="text-label-md text-ink-muted">Race for</label>
                <select id="race-min" value={raceMinutes} onChange={(e) => setRaceMinutes(Number(e.target.value))} className="h-8 rounded-md border border-line-strong bg-canvas pl-2 pr-7 text-label-md text-ink">
                  {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
                <Button size="sm" onClick={() => act(`${workspaceId}/race`, { minutes: raceMinutes }, 'Race started. Scores reset.')}>Start race</Button>
              </>
            )}
          </div>
        </div>

        {students.length === 0 ? (
          <div className="card mt-6 px-6 py-16 text-center text-body-sm text-ink-muted">
            No students yet. Share an invite link from the Share dialog; each student who opens it gets their own copy.
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {students.map((s, i) => (
              <li key={s.id} className={`card flex flex-col overflow-hidden ${s.hand ? 'ring-2 ring-[#D29922]' : ''}`}>
                <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
                  {sort === 'progress' && <span className="w-5 text-label-sm tabular-nums text-ink-subtle">{i + 1}</span>}
                  <span className="relative">
                    <Avatar name={s.name} id={s.userId} src={s.avatar_url} size={28} />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-canvas ${s.online ? 'bg-brand' : 'bg-line-strong'}`} title={s.online ? 'Online' : 'Offline'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label-md text-ink">{s.name}</span>
                    <span className="block text-label-sm text-ink-subtle">Updated {timeAgo(s.updated_at)}</span>
                  </span>
                  {s.tests && (
                    <span className={`badge ${s.tests.passed === s.tests.total ? 'border-brand/25 bg-brand-soft text-brand-fg' : ''}`}>{s.tests.passed}/{s.tests.total}</span>
                  )}
                </div>
                {s.hand && (
                  <div className="flex items-start gap-2 border-b border-line bg-[#FFF8E5] px-3 py-2 text-body-sm text-[#7D4E00] dark:bg-[#2B2111] dark:text-[#E3B341]">
                    <span aria-hidden="true">✋</span>
                    <span className="min-w-0 flex-1">{s.hand.note || 'Needs help'} · {timeAgo(s.hand.at)}</span>
                    <button type="button" onClick={() => act(`${s.id}/hand`, { raised: false })} className="rounded p-0.5 hover:bg-black/5" aria-label={`Lower ${s.name}'s hand`}><GoX size={14} /></button>
                  </div>
                )}
                <Link to={`/editor/${s.id}`} className="group block min-h-[180px] flex-1 bg-canvas-subtle px-3 py-2 hover:bg-canvas-muted" title={`Open ${s.name}'s copy`}>
                  {s.file ? (
                    <>
                      <span className="block truncate font-mono text-code-sm text-ink-muted">{s.file.path.slice(1)}</span>
                      <pre className="mt-1 overflow-hidden font-mono text-[10.5px] leading-[1.45] text-ink">{s.file.preview}</pre>
                    </>
                  ) : <span className="text-body-sm text-ink-subtle">No files</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <HintModal isOpen={hint} onClose={() => setHint(false)} classroomId={workspaceId} />
    </div>
  );
}
