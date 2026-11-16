import { GoX } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import LangDot from '../ui/LangDot';

export default function EditorTabs() {
  const { openFiles, activeFileId, openFile, closeFile } = useEditorStore();

  if (openFiles.length === 0) return null;

  return (
    <div role="tablist" aria-label="Open files" className="no-scrollbar flex h-9 shrink-0 overflow-x-auto bg-canvas-subtle">
      {openFiles.map((file) => {
        const active = file.id === activeFileId;
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
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.id);
              }}
              aria-label={`Close ${file.name}`}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-ink-subtle transition-colors hover:bg-canvas-muted hover:text-ink ${
                active ? '' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <GoX size={14} />
            </button>
          </div>
        );
      })}
      <div className="flex-1 border-b border-line" />
    </div>
  );
}
