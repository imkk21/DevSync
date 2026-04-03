import { useState, useMemo } from 'react';
import {
  HiFolder, HiFolderOpen, HiDocumentText, HiPlus, HiTrash,
  HiPencil, HiChevronRight, HiChevronDown, HiDotsVertical,
} from 'react-icons/hi';
import useEditorStore from '../../store/editorStore';

const fileIcons = {
  js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️', py: '🐍',
  java: '☕', c: '⚙️', cpp: '⚡', go: '🐹', rs: '🦀',
  rb: '💎', php: '🐘', cs: '🎯', html: '🌐', css: '🎨',
  json: '📋', md: '📝', txt: '📄',
};

function FileItem({ file, files, depth = 0, onContextMenu }) {
  const { openFile, activeFileId } = useEditorStore();
  const [expanded, setExpanded] = useState(true);

  const children = useMemo(
    () => files.filter((f) => f.parent_id === file.id),
    [files, file.id]
  );

  const ext = file.name.split('.').pop()?.toLowerCase();
  const icon = fileIcons[ext] || '📄';
  const isActive = activeFileId === file.id;

  const handleClick = () => {
    if (file.is_folder) {
      setExpanded(!expanded);
    } else {
      openFile(file);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer group transition-colors text-sm
          ${isActive ? 'bg-brand-500/15 text-brand-300' : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, file)}
      >
        {file.is_folder ? (
          <>
            <span className="text-xs text-surface-500">
              {expanded ? <HiChevronDown size={14} /> : <HiChevronRight size={14} />}
            </span>
            <span className="text-brand-400">
              {expanded ? <HiFolderOpen size={16} /> : <HiFolder size={16} />}
            </span>
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="text-xs">{icon}</span>
          </>
        )}
        <span className="truncate flex-1 text-xs">{file.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onContextMenu(e, file); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-700 transition-all"
        >
          <HiDotsVertical size={12} />
        </button>
      </div>

      {file.is_folder && expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileItem
              key={child.id}
              file={child}
              files={files}
              depth={depth + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ workspaceId, userId }) {
  const { files, createFile, deleteFile, renameFile } = useEditorStore();
  const [contextMenu, setContextMenu] = useState(null);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isNewFolder, setIsNewFolder] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const rootFiles = useMemo(
    () => files.filter((f) => !f.parent_id),
    [files]
  );

  const handleContextMenu = (e, file) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file,
    });
  };

  const handleCreateFile = async (isFolder) => {
    setIsNewFolder(isFolder);
    setShowNewFile(true);
    setNewFileName('');
    setContextMenu(null);
  };

  const handleSubmitNewFile = async () => {
    if (!newFileName.trim()) return;
    const parentId = contextMenu?.file?.is_folder ? contextMenu.file.id : null;
    await createFile(workspaceId, newFileName.trim(), parentId, isNewFolder, userId);
    setShowNewFile(false);
    setNewFileName('');
  };

  const handleRename = (file) => {
    setRenaming(file.id);
    setRenameValue(file.name);
    setContextMenu(null);
  };

  const handleSubmitRename = async () => {
    if (renameValue.trim() && renaming) {
      await renameFile(renaming, renameValue.trim());
    }
    setRenaming(null);
    setRenameValue('');
  };

  const handleDelete = async (file) => {
    setContextMenu(null);
    if (window.confirm(`Delete "${file.name}"?`)) {
      await deleteFile(file.id);
    }
  };

  return (
    <div className="flex flex-col h-full" onClick={() => setContextMenu(null)}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-800">
        <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Explorer</span>
        <div className="flex gap-1">
          <button
            onClick={() => handleCreateFile(false)}
            className="p-1 rounded text-surface-500 hover:text-brand-400 hover:bg-surface-800 transition-colors"
            title="New File"
          >
            <HiDocumentText size={14} />
          </button>
          <button
            onClick={() => handleCreateFile(true)}
            className="p-1 rounded text-surface-500 hover:text-brand-400 hover:bg-surface-800 transition-colors"
            title="New Folder"
          >
            <HiFolder size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {showNewFile && (
          <div className="flex items-center gap-1 px-3 py-1">
            <span className="text-xs">{isNewFolder ? '📁' : '📄'}</span>
            <input
              autoFocus
              className="flex-1 bg-surface-800 border border-brand-500 rounded px-2 py-0.5 text-xs text-white outline-none"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitNewFile();
                if (e.key === 'Escape') setShowNewFile(false);
              }}
              onBlur={handleSubmitNewFile}
              placeholder={isNewFolder ? 'folder name' : 'filename.ext'}
            />
          </div>
        )}

        {rootFiles.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            files={files}
            onContextMenu={handleContextMenu}
          />
        ))}

        {rootFiles.length === 0 && !showNewFile && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-surface-600">No files yet</p>
            <button
              onClick={() => handleCreateFile(false)}
              className="text-xs text-brand-400 hover:text-brand-300 mt-1"
            >
              Create a file
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface-900 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[160px] animate-scale-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white"
            onClick={() => handleCreateFile(false)}
          >
            <HiPlus size={14} /> New File
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white"
            onClick={() => handleCreateFile(true)}
          >
            <HiFolder size={14} /> New Folder
          </button>
          {contextMenu.file && (
            <>
              <div className="border-t border-surface-800 my-1" />
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white"
                onClick={() => handleRename(contextMenu.file)}
              >
                <HiPencil size={14} /> Rename
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                onClick={() => handleDelete(contextMenu.file)}
              >
                <HiTrash size={14} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
