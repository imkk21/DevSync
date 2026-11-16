import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DiffEditor } from '@monaco-editor/react';
import { api } from '../../lib/api';
import useThemeStore from '../../store/themeStore';
import { THEMES, defineDevSyncThemes } from '../../lib/monacoTheme';
import { languageForFile } from '../../lib/languages';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import LoadingSpinner from '../ui/LoadingSpinner';

const STATUS = {
  changed: { label: 'Changed here', cls: 'border-brand/25 bg-brand-soft text-brand-fg' },
  combined: { label: 'Combines with their edits', cls: 'border-brand/25 bg-brand-soft text-brand-fg' },
  conflict: { label: 'Conflict', cls: 'border-danger/25 bg-danger-soft text-danger' },
  added: { label: 'New file', cls: '' },
};

// Same model-cleanup wrapper as HistoryModal: the library frees models before the widget lets go
function Diff(props) {
  const models = useRef(null);
  useEffect(() => () => {
    const m = models.current;
    setTimeout(() => { m?.original.dispose(); m?.modified.dispose(); }, 0);
  }, []);
  return <DiffEditor {...props} keepCurrentOriginalModel keepCurrentModifiedModel onMount={(e) => { models.current = e.getModel(); }} />;
}

// Bring a fork's changes back into the workspace it came from, file by file
export default function ForkMergeModal({ isOpen, onClose, workspaceId }) {
  const theme = useThemeStore((s) => s.resolved);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(new Set());
  const [useMine, setUseMine] = useState(new Set());
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setData(null);
    setError('');
    api(`/api/workspaces/${workspaceId}/fork`)
      .then((d) => {
        setData(d);
        setPicked(new Set(d.files.filter((f) => f.status !== 'conflict').map((f) => f.path)));
        setUseMine(new Set());
        setPreview(d.files[0]?.path ?? null);
      })
      .catch((err) => setError(err.message));
  };
  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, workspaceId]);

  const toggle = (set, setter, path) => {
    const next = new Set(set);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setter(next);
  };

  const merge = async () => {
    setBusy(true);
    try {
      const { merged, skipped } = await api(`/api/workspaces/${workspaceId}/fork/merge`, { method: 'POST', body: { paths: [...picked], useMine: [...useMine] } });
      toast(`Merged ${merged.length} ${merged.length === 1 ? 'file' : 'files'} into ${data.original.name}${skipped.length ? `. Skipped ${skipped.length} with conflicts.` : ''}`, { tone: 'success' });
      load();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const file = data?.files.find((f) => f.path === preview);
  const mergeable = data?.files.filter((f) => picked.has(f.path) && (f.status !== 'conflict' || useMine.has(f.path))).length || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Review and merge"
      description={data ? <>Bring your changes back into <Link to={`/editor/${data.original.id}`} className="font-medium text-ink underline-offset-2 hover:underline">{data.original.name}</Link>. Edits made there since you forked are kept.</> : 'Comparing with the original…'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {data?.canMerge && <Button onClick={merge} loading={busy} disabled={!mergeable}>Merge {mergeable} {mergeable === 1 ? 'file' : 'files'}</Button>}
        </>
      }
    >
      {error ? (
        <Alert>{error}</Alert>
      ) : !data ? (
        <div className="flex h-60 items-center justify-center"><LoadingSpinner className="text-brand" /></div>
      ) : data.files.length === 0 ? (
        <p className="text-body-sm text-ink-muted">Nothing to merge yet. Change some files in this fork first.</p>
      ) : (
        <div className="-mx-6 -my-5 flex h-[min(60vh,600px)] flex-col sm:flex-row">
          <ul className="max-h-48 shrink-0 overflow-y-auto border-b border-line p-2 sm:max-h-none sm:w-72 sm:border-b-0 sm:border-r">
            {!data.canMerge && <li className="p-2"><Alert tone="info">Only editors of the original can merge. You can still review.</Alert></li>}
            {data.files.map((f) => (
              <li key={f.path} className={`rounded-md p-2 ${preview === f.path ? 'bg-canvas-muted' : ''}`}>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={picked.has(f.path)}
                    disabled={!data.canMerge}
                    onChange={() => toggle(picked, setPicked, f.path)}
                    aria-label={`Merge ${f.path}`}
                    className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]"
                  />
                  <button type="button" onClick={() => setPreview(f.path)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-mono text-code-sm text-ink">{f.path.slice(1)}</span>
                    <span className={`badge mt-1 ${STATUS[f.status].cls}`}>{STATUS[f.status].label}</span>
                  </button>
                </div>
                {f.status === 'conflict' && picked.has(f.path) && (
                  <label className="ml-6 mt-2 flex items-center gap-2 text-label-sm text-ink-muted">
                    <input type="checkbox" checked={useMine.has(f.path)} onChange={() => toggle(useMine, setUseMine, f.path)} className="h-3.5 w-3.5 accent-[rgb(var(--brand))]" />
                    Replace theirs with my version
                  </label>
                )}
              </li>
            ))}
          </ul>
          <div className="min-h-0 min-w-0 flex-1">
            {file && (
              <Diff
                key={file.path}
                height="100%"
                original={file.original}
                modified={file.status === 'conflict' ? file.fork : file.merged}
                language={languageForFile(file.path)}
                theme={THEMES[theme]}
                beforeMount={defineDevSyncThemes}
                options={{ readOnly: true, originalEditable: false, minimap: { enabled: false }, renderSideBySide: window.innerWidth > 768, scrollBeyondLastLine: false, fontSize: 13, automaticLayout: true }}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
