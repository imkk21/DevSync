import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import Editor from '@monaco-editor/react';
import { GoPlay, GoSquareFill } from 'react-icons/go';
import useThemeStore from '../../store/themeStore';
import { THEMES, defineDevSyncThemes } from '../../lib/monacoTheme';
import { languageForFile } from '../../lib/languages';
import Button from '../ui/Button';
import ToggleGroup from '../ui/ToggleGroup';

export const fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const SPEEDS = [1, 4, 16];
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// Plays back how a file was written, save by save. steps: [{ update: Uint8Array, user_ids, created_at }].
// messages (optional): chat shown alongside, up to the current moment.
export default function ReplayPlayer({ steps, fileName, nameOf, messages, autoplay = false, height = 'min(55vh,560px)' }) {
  const theme = useThemeStore((s) => s.resolved);
  const [step, setStep] = useState(autoplay ? 0 : Math.max(0, steps.length - 1));
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(4);
  const [text, setText] = useState('');
  const replay = useRef({ doc: null, applied: -1 });

  // Text at `step`: apply updates forward, or start over when scrubbing back
  useEffect(() => {
    if (!steps.length) return;
    const r = replay.current;
    if (!r.doc || step < r.applied) {
      r.doc?.destroy();
      r.doc = new Y.Doc();
      r.applied = -1;
    }
    for (let i = r.applied + 1; i <= step; i++) Y.applyUpdate(r.doc, steps[i].update);
    r.applied = step;
    setText(r.doc.getText('content').toString());
  }, [steps, step]);

  useEffect(() => {
    if (!playing) return;
    if (step >= steps.length - 1) return setPlaying(false);
    const t = setTimeout(() => setStep((s) => s + 1), 600 / speed);
    return () => clearTimeout(t);
  }, [playing, step, speed, steps]);

  useEffect(() => () => replay.current.doc?.destroy(), []);

  const current = steps[step];
  const who = current?.user_ids?.map(nameOf).join(', ');
  const said = messages?.filter((m) => m.created_at <= current.created_at) || [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={() => {
            if (!playing && step >= steps.length - 1) setStep(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <GoSquareFill size={12} /> : <GoPlay size={14} />} {playing ? 'Pause' : 'Play'}
        </Button>
        <ToggleGroup label="Speed" size="sm" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ id: s, label: `${s}×` }))} />
        <span className="text-label-sm text-ink-muted">
          Step {step + 1} of {steps.length} · {new Date(current.created_at).toLocaleString()}
          {who && ` · ${who}`}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={step}
        onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }}
        aria-label="Replay position"
        className="w-full accent-[rgb(var(--brand))]"
      />
      <div className="flex gap-3" style={{ height }}>
        <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-line">
          <Editor
            height="100%"
            path={`replay/${fileName}`}
            value={text}
            language={languageForFile(fileName)}
            theme={THEMES[theme]}
            beforeMount={defineDevSyncThemes}
            options={{ readOnly: true, domReadOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, automaticLayout: true }}
          />
        </div>
        {messages && (
          <aside aria-label="Chat at this point" className="hidden w-64 shrink-0 overflow-y-auto rounded-md border border-line bg-canvas-subtle p-3 md:block">
            <h3 className="text-label-sm text-ink-muted">Chat</h3>
            {said.length === 0 && <p className="mt-2 text-body-sm text-ink-subtle">Nothing said yet.</p>}
            <ol className="mt-2 space-y-2">
              {said.slice(-40).map((m, i) => (
                <li key={i} className="text-body-sm">
                  <span className="font-medium text-ink">{nameOf(m.user_id)}</span>{' '}
                  <span className="text-label-sm text-ink-subtle">{time(m.created_at)}</span>
                  <p className="whitespace-pre-wrap break-words text-ink-muted">{m.body}</p>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}
