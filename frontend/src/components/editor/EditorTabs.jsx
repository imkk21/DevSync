import { GoPencil, GoX } from 'react-icons/go';
import { VscOpenPreview, VscSplitHorizontal, VscTypeHierarchySub } from 'react-icons/vsc';
import useEditorStore from '../../store/editorStore';
import useAuthStore from '../../store/authStore';
import LangDot from '../ui/LangDot';
import Avatar from '../ui/Avatar';
import { MOD } from '../ui/Shortcut';
import { previewKind, graphable } from './PreviewPane';

export default function EditorTabs() {
  const { openFiles, activeFileId, activeFile, openFile, closeFile, fileStatus, presence, rightPane, setRightPane, inkMode, toggleInk } = useEditorStore();
  const userId = useAuthStore((s) => s.user?.id);
  const watchResults = useEditorStore((s) => s.watchResults);

  if (openFiles.length === 0) return null;
  const canPreview = !!previewKind(activeFile);

  return (
    <div className="flex h-9 shrink-0 bg-canvas-subtle">
      <div role="tablist" aria-label="Open files" className="no-scrollbar flex min-w-0 flex-1 overflow-x-auto">
        {openFiles.map((file) => {
          const active = file.id === activeFileId;
          const unsaved = fileStatus[file.id] === 'unsaved';
          const viewers = presence.filter((u) => u.fileId === file.id && u.id !== userId);
          return (
            <div
              key={file.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              title={file.path}
              onClick={() => openFile(file)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openFile(file);
                }
              }}
              // Middle-click closes, like a browser tab
              onAuxClick={(e) => e.button === 1 && closeFile(file.id)}
              className={`group relative flex min-w-0 max-w-[220px] shrink-0 cursor-pointer select-none items-center gap-2 border-r border-line pl-3 pr-1.5 text-body-sm transition-colors ${
                active
                  ? 'bg-canvas text-ink before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-brand'
                  : 'border-b text-ink-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              <LangDot language={file.language} />
              <span className="truncate">{file.name}</span>
              {viewers.length > 0 && (
                <span className="flex shrink-0 -space-x-1" title={`Also here: ${viewers.map((u) => u.display_name || u.email).join(', ')}`}>
                  {viewers.slice(0, 2).map((u) => <Avatar key={u.id} name={u.display_name || u.email} id={u.id} src={u.avatar_url} size={14} ring />)}
                </span>
              )}
              {watchResults[file.id] && (
                // Live test bar: the latest automatic run for this file
                <span
                  className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums leading-4 ${watchResults[file.id].passed === watchResults[file.id].total ? 'bg-brand-soft text-brand-fg' : 'bg-danger-soft text-danger'}`}
                  title={`${watchResults[file.id].passed} of ${watchResults[file.id].total} tests pass`}
                >
                  {watchResults[file.id].passed}/{watchResults[file.id].total}
                </span>
              )}
              {unsaved && <span className="sr-only">(saving)</span>}
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.id);
                }}
                aria-label={`Close ${file.name}`}
                className={`group/close flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-ink-subtle transition-colors hover:bg-canvas-muted hover:text-ink ${
                  active || unsaved ? '' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {/* Unsaved edits show a dot that turns into the close button on hover */}
                {unsaved && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ink-muted group-hover/close:hidden" />}
                <GoX size={14} className={unsaved ? 'hidden group-hover/close:block' : ''} />
              </button>
            </div>
          );
        })}
        <div className="flex-1 border-b border-line" />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 border-b border-l border-line px-1">
        <button
          type="button"
          onClick={() => toggleInk()}
          aria-pressed={inkMode}
          className={`icon-btn h-7 w-7 ${inkMode ? 'bg-brand-soft text-brand-fg' : ''}`}
          aria-label="Draw on the code"
          title="Draw on the code for everyone (Esc to stop)"
        >
          <GoPencil size={14} />
        </button>
        {graphable(activeFile) && (
          <button
            type="button"
            onClick={() => setRightPane(rightPane?.type === 'graph' ? null : { type: 'graph' })}
            aria-pressed={rightPane?.type === 'graph'}
            className={`icon-btn h-7 w-7 ${rightPane?.type === 'graph' ? 'bg-canvas-muted text-ink' : ''}`}
            aria-label="Call graph"
            title="Call graph: what calls what (click a box to jump to it)"
          >
            <VscTypeHierarchySub size={16} />
          </button>
        )}
        {canPreview && (
          <button
            type="button"
            onClick={() => setRightPane(rightPane?.type === 'preview' ? null : { type: 'preview' })}
            aria-pressed={rightPane?.type === 'preview'}
            className={`icon-btn h-7 w-7 ${rightPane?.type === 'preview' ? 'bg-canvas-muted text-ink' : ''}`}
            aria-label="Preview"
            title="Preview"
          >
            <VscOpenPreview size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setRightPane(rightPane?.type === 'split' ? null : { type: 'split', fileId: activeFileId })}
          aria-pressed={rightPane?.type === 'split'}
          className={`icon-btn h-7 w-7 ${rightPane?.type === 'split' ? 'bg-canvas-muted text-ink' : ''}`}
          aria-label="Split editor"
          title={`Split editor (${MOD}+\\)`}
        >
          <VscSplitHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
