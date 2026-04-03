import { HiX } from 'react-icons/hi';
import useEditorStore from '../../store/editorStore';

const fileIcons = {
  js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️', py: '🐍',
  java: '☕', c: '⚙️', cpp: '⚡', go: '🐹', rs: '🦀',
  rb: '💎', php: '🐘', cs: '🎯', html: '🌐', css: '🎨',
  json: '📋', md: '📝', txt: '📄',
};

export default function EditorTabs() {
  const { openFiles, activeFileId, openFile, closeFile } = useEditorStore();

  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center bg-surface-950 border-b border-surface-800 overflow-x-auto">
      {openFiles.map((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const icon = fileIcons[ext] || '📄';
        const isActive = activeFileId === file.id;

        return (
          <div
            key={file.id}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer group border-r border-surface-800
              transition-colors min-w-[100px] max-w-[180px]
              ${isActive
                ? 'bg-surface-900 text-white border-t-2 border-t-brand-500'
                : 'text-surface-500 hover:text-surface-300 hover:bg-surface-900/50 border-t-2 border-t-transparent'
              }`}
            onClick={() => openFile(file)}
          >
            <span className="text-[10px]">{icon}</span>
            <span className="truncate flex-1">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.id);
              }}
              className={`p-0.5 rounded transition-all
                ${isActive
                  ? 'text-surface-500 hover:text-white hover:bg-surface-700'
                  : 'opacity-0 group-hover:opacity-100 text-surface-600 hover:text-white hover:bg-surface-700'
                }`}
            >
              <HiX size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
