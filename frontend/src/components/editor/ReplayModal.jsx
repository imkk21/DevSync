import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import Editor from '@monaco-editor/react';
import { GoPlay, GoSquareFill } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useThemeStore from '../../store/themeStore';
import { THEMES, defineDevSyncThemes } from '../../lib/monacoTheme';
import { languageForFile } from '../../lib/languages';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ToggleGroup from '../ui/ToggleGroup';
import LoadingSpinner from '../ui/LoadingSpinner';

const fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const SPEEDS = [1, 4, 16];

// Plays back how a file was written, save by save
export default function ReplayModal({ isOpen, onClose, file, people }) {
  const theme = useThemeStore((s) => s.resolved);
  const [steps, setSteps] = useState(null); // [{ update, user_ids, created_at }]
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [text, setText] = useState('');
  const replay = useRef({ doc: null, applied: -1 });

  useEffect(() => {
    if (!isOpen || !file) return;
    setSteps(null);
    setPlaying(false);
    // ponytail: loads the whole recording; page it if files get thousands of saves
    supabase
      .from('doc_updates').select('data, user_ids, created_at').eq('file_id', file.id).order('id').limit(5000)
      .then(({ data }) => {
        const list = (data || []).map((r) => ({ update: fromBase64(r.data), user_ids: r.user_ids, created_at: r.created_at }));
        replay.current = { doc: null, applied: -1 };
        setSteps(list);
        setStep(Math.max(0, list.length - 1));
      });
  }, [isOpen, file?.id]);

  // Text at `step`: apply updates forward, or start over when scrubbing back
  useEffect(() => {
    if (!steps?.length) return;
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

  const current = steps?.[step];
  const who = current?.user_ids?.map((id) => people.find((p) => p.id === id)?.name || 'Someone').join(', ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`Replay of ${file?.name ?? ''}`}
      description="Every save, in order. Drag the slider or press play."
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {steps === null ? (
        <div className="flex h-60 items-center justify-center"><LoadingSpinner className="text-brand" /></div>
      ) : steps.length === 0 ? (
        <p className="text-body-sm text-ink-muted">Nothing recorded for this file yet. Edits are recorded from now on.</p>
      ) : (
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
          <div className="h-[min(55vh,560px)] overflow-hidden rounded-md border border-line">
            <Editor
              height="100%"
              path={`replay/${file.id}`}
              value={text}
              language={languageForFile(file.name)}
              theme={THEMES[theme]}
              beforeMount={defineDevSyncThemes}
              options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, automaticLayout: true, domReadOnly: true }}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
