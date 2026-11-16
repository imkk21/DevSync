import { useEffect, useState } from 'react';
import { GoNote, GoStopwatch, GoX } from 'react-icons/go';

const pad = (n) => String(n).padStart(2, '0');
function elapsed(since) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:` : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// Interview mode: a shared timer for everyone; the interviewer (owner) also gets private notes,
// kept only in this browser.
export default function InterviewBar({ workspaceId, startedAt, isOwner, onEnd }) {
  const [, tick] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const key = `devsync:interview-notes:${workspaceId}`;
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  });

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const saveNotes = (value) => {
    setNotes(value);
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <span className="badge border-brand/25 bg-brand-soft font-mono tabular-nums text-brand-fg" title="Interview in progress">
          <GoStopwatch size={12} aria-hidden="true" /> {elapsed(startedAt)}
        </span>
        {isOwner && (
          <>
            <button type="button" onClick={() => setNotesOpen((o) => !o)} aria-pressed={notesOpen} className="icon-btn h-7 w-7" aria-label="Interviewer notes" title="Private notes">
              <GoNote size={14} />
            </button>
            <button type="button" onClick={onEnd} className="hidden text-label-sm text-ink-muted hover:text-ink md:inline">End</button>
          </>
        )}
      </div>
      {notesOpen && (
        <section aria-label="Interviewer notes" className="menu fixed bottom-4 left-4 z-40 flex w-[min(360px,calc(100vw-32px))] animate-fade-up flex-col p-0">
          <div className="flex h-9 items-center justify-between border-b border-line pl-3 pr-1">
            <span className="text-label-md text-ink">Private notes</span>
            <button type="button" onClick={() => setNotesOpen(false)} className="icon-btn h-7 w-7" aria-label="Close notes"><GoX size={14} /></button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
            placeholder="Only you can see these. They stay in this browser."
            aria-label="Private notes"
            className="h-56 resize-none bg-transparent p-3 text-body-sm text-ink outline-none placeholder:text-ink-subtle"
          />
        </section>
      )}
    </>
  );
}
