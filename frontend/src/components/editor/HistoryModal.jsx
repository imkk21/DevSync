import { useEffect, useRef, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { GoBookmark, GoHistory } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import useEditorStore from '../../store/editorStore';
import useThemeStore from '../../store/themeStore';
import { THEMES, defineDevSyncThemes } from '../../lib/monacoTheme';
import { languageForFile } from '../../lib/languages';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';

// The library disposes a diff's models before the widget lets go of them, which throws on close.
// Keep them through unmount and free them once the widget is gone.
function Diff(props) {
  const models = useRef(null);
  useEffect(() => () => {
    const m = models.current;
    setTimeout(() => {
      m?.original.dispose();
      m?.modified.dispose();
    }, 0);
  }, []);
  return <DiffEditor {...props} keepCurrentOriginalModel keepCurrentModifiedModel onMount={(editor) => { models.current = editor.getModel(); }} />;
}

const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Earlier versions of a file, compared with what's there now. Editors can restore one.
export default function HistoryModal({ isOpen, onClose, file, people, readOnly }) {
  const theme = useThemeStore((s) => s.resolved);
  const contentOf = useEditorStore((s) => s.contentOf);
  const [versions, setVersions] = useState(null);
  const [selected, setSelected] = useState(null); // { id, content }
  const [restoring, setRestoring] = useState(false);

  const nameOf = (id) => people.find((p) => p.id === id)?.name || 'Someone';

  useEffect(() => {
    if (!isOpen || !file) return;
    setVersions(null);
    setSelected(null);
    supabase
      .from('file_versions').select('id, label, created_at, created_by').eq('file_id', file.id)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => {
        setVersions(data || []);
        if (data?.[0]) pick(data[0].id);
      });
  }, [isOpen, file?.id]);

  const pick = async (id) => {
    setSelected({ id, content: null });
    const { data } = await supabase.from('file_versions').select('content').eq('id', id).single();
    setSelected((s) => (s?.id === id ? { id, content: data?.content ?? '' } : s));
  };

  const restore = async () => {
    setRestoring(true);
    try {
      await api(`/api/files/${file.id}/restore`, { method: 'POST', body: { versionId: selected.id } });
      toast(`Restored ${file.name}. The text from before is saved in history.`, { tone: 'success' });
      onClose();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  const current = versions?.find((v) => v.id === selected?.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`History of ${file?.name ?? ''}`}
      description="Saved automatically every few minutes while people edit, plus every checkpoint. Left: that version. Right: now."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {!readOnly && (
            <Button onClick={restore} loading={restoring} disabled={!selected?.content && selected?.content !== ''}>
              Restore this version
            </Button>
          )}
        </>
      }
    >
      <div className="-mx-6 -my-5 flex h-[min(62vh,640px)] flex-col sm:flex-row">
        <ol className="max-h-40 shrink-0 overflow-y-auto border-b border-line p-2 sm:max-h-none sm:w-64 sm:border-b-0 sm:border-r">
          {versions === null && <li className="p-3 text-body-sm text-ink-muted">Loading…</li>}
          {versions?.length === 0 && <li className="p-3 text-body-sm text-ink-muted">No history yet. Versions appear as people edit this file.</li>}
          {versions?.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => pick(v.id)}
                aria-current={selected?.id === v.id || undefined}
                className={`flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left ${selected?.id === v.id ? 'bg-brand-soft' : 'hover:bg-canvas-muted'}`}
              >
                {v.label ? <GoBookmark size={14} className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true" /> : <GoHistory size={14} className="mt-0.5 shrink-0 text-ink-subtle" aria-hidden="true" />}
                <span className="min-w-0">
                  <span className="block truncate text-label-md text-ink">{v.label || when(v.created_at)}</span>
                  <span className="mt-1 block truncate text-label-sm text-ink-muted">
                    {v.label ? `${when(v.created_at)} · ` : ''}{v.created_by ? nameOf(v.created_by) : 'Automatic'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="min-h-0 min-w-0 flex-1">
          {selected?.content == null ? (
            <div className="flex h-full items-center justify-center">{selected && <LoadingSpinner className="text-brand" />}</div>
          ) : (
            <Diff
              height="100%"
              original={selected.content}
              modified={contentOf(file.id)}
              language={languageForFile(file.name)}
              theme={THEMES[theme]}
              beforeMount={defineDevSyncThemes}
              options={{ readOnly: true, originalEditable: false, minimap: { enabled: false }, renderSideBySide: window.innerWidth > 768, scrollBeyondLastLine: false, fontSize: 13, automaticLayout: true }}
            />
          )}
        </div>
      </div>
      {current && <p className="sr-only" aria-live="polite">Comparing {current.label || when(current.created_at)} with the current text</p>}
    </Modal>
  );
}
