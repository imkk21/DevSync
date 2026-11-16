import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../ui/Button';
import Shortcut, { MOD } from '../ui/Shortcut';

const KEY = 'devsync:tour-done';
const STEPS = [
  { target: 'files', title: 'Your files', body: 'Create, drag, upload and download files here. The tabs above switch to search, comments, chat and activity.' },
  { target: 'run', title: 'Run your code', body: <>Runs the open file with every other file alongside it. <Shortcut keys={[MOD, 'Enter']} /></> },
  { target: 'share', title: 'Code together', body: 'Invite people by email or link. You see each other type and point live.' },
  { target: 'palette', title: 'Everything else', body: <>Commands, history, replay, pair mode and settings are all one search away. <Shortcut keys={[MOD, 'Shift', 'P']} /></> },
];

export const tourDone = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
};

// A few pointers on first visit, anchored to [data-tour="..."] elements
export default function Tour({ onDone }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const steps = STEPS.filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
  const step = steps[i];

  useLayoutEffect(() => {
    const el = step && document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [step]);

  const finish = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ }
    onDone();
  };

  useEffect(() => {
    if (!step) finish();
    const onKey = (e) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step]);

  if (!step || !rect) return null;
  const below = rect.top < window.innerHeight / 2;
  const width = 300;
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
  const top = below ? Math.min(rect.bottom + 12, window.innerHeight - 200) : undefined;
  const bottom = below ? undefined : window.innerHeight - rect.top + 12;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[61] rounded-md ring-2 ring-brand ring-offset-2 ring-offset-canvas transition-all duration-200"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />
      <div role="dialog" aria-label={step.title} className="menu fixed z-[62] animate-fade-up p-4" style={{ width, left, top, bottom }}>
        <p className="text-label-sm text-ink-subtle">{i + 1} of {steps.length}</p>
        <h2 className="mt-1.5 text-label-lg text-ink">{step.title}</h2>
        <div className="mt-1.5 text-body-sm text-ink-muted">{step.body}</div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={finish} className="text-label-md text-ink-muted hover:text-ink">Skip</button>
          {i > 0 && <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setI(i - 1)}>Back</Button>}
          <Button size="sm" className={i > 0 ? '' : 'ml-auto'} autoFocus onClick={() => (i === steps.length - 1 ? finish() : setI(i + 1))}>
            {i === steps.length - 1 ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
