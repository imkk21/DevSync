import { useEffect, useMemo, useRef, useState } from 'react';
import { GoChevronRight, GoDownload, GoFileDirectoryFill, GoPencil, GoTrash, GoUpload } from 'react-icons/go';
import { VscNewFile, VscNewFolder } from 'react-icons/vsc';
import useEditorStore from '../../store/editorStore';
import useDismiss from '../../hooks/useDismiss';
import LangDot from '../ui/LangDot';
import Avatar from '../ui/Avatar';
import ConfirmDialog from '../ui/ConfirmDialog';
import DropdownMenu from '../ui/DropdownMenu';
import { languageForFile } from '../../lib/languages';
import { looksBinary } from '../../lib/workspaceFiles';
import { toast } from '../../store/toastStore';

const DRAG_TYPE = 'application/x-devsync-file';
const MAX_UPLOAD_BYTES = 1_000_000;
const MAX_UPLOAD_FILES = 200;
const IGNORED = /(^|\/)(node_modules|\.git|__pycache__|\.venv|dist|build)\//;

// Text files from an <input type="file"> or a drop: [{ path, content }] plus what was skipped
async function readUploads(fileList) {
  const entries = [];
  const skipped = [];
  for (const file of [...fileList]) {
    const path = file.webkitRelativePath || file.name;
    if (IGNORED.test(path)) continue;
    if (entries.length >= MAX_UPLOAD_FILES || file.size > MAX_UPLOAD_BYTES) {
      skipped.push(path);
      continue;
    }
    try {
      const content = await file.text();
      if (looksBinary(content)) skipped.push(path);
      else entries.push({ path, content: content.replace(/\r\n/g, '\n') });
    } catch {
      skipped.push(path); // a dropped folder, or unreadable
    }
  }
  return { entries, skipped };
}

// People looking at this file right now
function Viewers({ users }) {
  if (!users?.length) return null;
  return (
    <span className="ml-auto flex shrink-0 -space-x-1 pl-1" title={users.map((u) => u.display_name || u.email).join(', ')}>
      {users.slice(0, 3).map((u) => (
        <Avatar key={u.id} name={u.display_name || u.email} id={u.id} src={u.avatar_url} size={16} ring />
      ))}
    </span>
  );
}

const byFolderThenName = (a, b) =>
  (b.is_folder - a.is_folder) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
const ROW = 'relative flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-body-sm';
const indent = (depth) => ({ paddingLeft: 6 + depth * 14 });

function ItemIcon({ isFolder, name, language }) {
  return (
    <span className="flex w-4 shrink-0 justify-center">
      {isFolder ? (
        <GoFileDirectoryFill size={14} className="text-[#8C959F]" aria-hidden="true" />
      ) : (
        <LangDot language={language || languageForFile(name)} />
      )}
    </span>
  );
}

// Inline name field used for both "new file/folder" and "rename"
function NameField({ depth, isFolder, initial = '', siblings, onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);
  const finished = useRef(false);
  const name = value.trim();
  const duplicate = name !== initial && siblings.some((s) => s.name.toLowerCase() === name.toLowerCase());
  const invalid = name.includes('/') || duplicate;

  const finish = (commit) => {
    if (finished.current) return;
    finished.current = true;
    if (commit && name && name !== initial && !invalid) onSubmit(name);
    else onCancel();
  };

  return (
    <div className={`${ROW} bg-canvas`} style={indent(depth)}>
      <span className="w-3 shrink-0" />
      <ItemIcon isFolder={isFolder} name={value} />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          // Select the base name, not the extension, like most editors
          const dot = initial.lastIndexOf('.');
          e.target.setSelectionRange(0, !isFolder && dot > 0 ? dot : initial.length);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true);
          if (e.key === 'Escape') finish(false);
        }}
        onBlur={() => finish(true)}
        aria-label={isFolder ? 'Folder name' : 'File name'}
        aria-invalid={invalid || undefined}
        title={duplicate ? 'A file or folder with this name already exists here' : undefined}
        placeholder={isFolder ? 'folder-name' : 'file-name.ext'}
        className={`h-6 min-w-0 flex-1 rounded-sm border bg-canvas px-1.5 text-body-sm text-ink outline-none ring-2 placeholder:text-ink-subtle ${
          invalid ? 'border-danger ring-danger/15' : 'border-brand ring-brand/15'
        }`}
      />
    </div>
  );
}

function TreeItem({ file, depth, tree }) {
  const { files, activeFileId, expanded, renamingId, creating, viewers, dropTarget } = tree;
  const isOpen = expanded[file.id] ?? true;
  const children = useMemo(
    () => files.filter((f) => f.parent_id === file.id).sort(byFolderThenName),
    [files, file.id]
  );
  const active = activeFileId === file.id;

  return (
    <li>
      {renamingId === file.id ? (
        <NameField
          depth={depth}
          isFolder={file.is_folder}
          initial={file.name}
          siblings={files.filter((f) => f.parent_id === file.parent_id && f.id !== file.id)}
          onSubmit={(name) => tree.rename(file, name)}
          onCancel={tree.stopRename}
        />
      ) : (
        <button
          type="button"
          onClick={() => (file.is_folder ? tree.toggle(file.id) : tree.open(file))}
          onContextMenu={(e) => tree.openMenu(e, file)}
          {...tree.dragProps(file)}
          aria-expanded={file.is_folder ? isOpen : undefined}
          aria-current={active ? 'true' : undefined}
          title={file.path}
          className={`${ROW} text-left transition-colors ${
            dropTarget === file.id
              ? 'bg-brand-soft text-ink ring-1 ring-inset ring-brand'
              : active
                ? 'bg-brand-soft font-medium text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand'
                : 'text-ink-muted hover:bg-canvas-muted hover:text-ink'
          }`}
          style={indent(depth)}
        >
          {file.is_folder ? (
            <GoChevronRight size={12} aria-hidden="true" className={`w-3 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <ItemIcon isFolder={file.is_folder} name={file.name} language={file.language} />
          <span className="truncate">{file.name}</span>
          <Viewers users={viewers[file.id]} />
        </button>
      )}

      {file.is_folder && isOpen && (children.length > 0 || creating?.parentId === file.id) && (
        <ul>
          {creating?.parentId === file.id && (
            <li>
              <NameField depth={depth + 1} isFolder={creating.isFolder} siblings={children} onSubmit={tree.create} onCancel={tree.stopCreate} />
            </li>
          )}
          {children.map((child) => (
            <TreeItem key={child.id} file={child} depth={depth + 1} tree={tree} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ContextMenu({ menu, onClose, onNewFile, onNewFolder, onUpload, onRename, onDelete }) {
  const ref = useRef(null);
  useDismiss(ref, true, onClose);
  // Move focus into the menu (Tab reaches the items) without pre-highlighting one
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const target = menu.file;
  const canCreate = !target || target.is_folder;
  const items = (canCreate ? 3 : 0) + (target ? 2 : 0);
  // Keep the menu on screen near the edges
  const left = Math.min(menu.x, window.innerWidth - 200);
  const top = Math.min(menu.y, window.innerHeight - (items * 32 + 24));

  return (
    <div ref={ref} role="menu" tabIndex={-1} className="menu fixed z-50 w-48 animate-scale-in focus:outline-none" style={{ left, top }}>
      {canCreate && (
        <>
          <button type="button" role="menuitem" className="menu-item" onClick={onNewFile}>
            <VscNewFile size={16} className="text-ink-muted" /> New file
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={onNewFolder}>
            <VscNewFolder size={16} className="text-ink-muted" /> New folder
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={onUpload}>
            <GoUpload size={16} className="text-ink-muted" /> Upload files…
          </button>
        </>
      )}
      {target && (
        <>
          {canCreate && <div className="my-1 h-px bg-line" />}
          <button type="button" role="menuitem" className="menu-item" onClick={onRename}>
            <GoPencil size={16} className="text-ink-muted" /> Rename
          </button>
          <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={onDelete}>
            <GoTrash size={16} /> Delete
          </button>
        </>
      )}
    </div>
  );
}

export default function FileTree({ workspaceId, workspaceName, userId, readOnly = false }) {
  const { files, activeFileId, openFile, createFile, deleteFile, renameFile, moveFile, importFiles, downloadZip, presence } = useEditorStore();
  const [expanded, setExpanded] = useState({});
  const [menu, setMenu] = useState(null);
  const [creating, setCreating] = useState(null); // { parentId, isFolder }
  const [renamingId, setRenamingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dropTarget, setDropTarget] = useState(null); // folder id, or 'root'
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  const uploadParent = useRef(null);

  const rootFiles = useMemo(() => files.filter((f) => !f.parent_id).sort(byFolderThenName), [files]);
  const viewers = useMemo(() => {
    const out = {};
    for (const u of presence) if (u.fileId && u.id !== userId) (out[u.fileId] ||= []).push(u);
    return out;
  }, [presence, userId]);

  const upload = async (fileList, parentId) => {
    const { entries, skipped } = await readUploads(fileList);
    if (!entries.length && !skipped.length) return;
    if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
    const result = await importFiles(workspaceId, userId, parentId, entries);
    const skippedAll = [...skipped, ...result.skipped];
    if (result.error) toast(`Upload stopped: ${result.error.message}`, { tone: 'error' });
    else if (result.created) toast(`Uploaded ${result.created} ${result.created === 1 ? 'file' : 'files'}`, { tone: 'success' });
    if (skippedAll.length) {
      toast(`Skipped ${skippedAll.length}: ${skippedAll.slice(0, 3).join(', ')}${skippedAll.length > 3 ? '…' : ''} (already there, too large, or not text)`);
    }
  };

  // A drawing canvas, stored as a .board file next to the code
  const newWhiteboard = async () => {
    let n = 1;
    while (files.some((f) => !f.parent_id && f.name === `whiteboard-${n}.board`)) n++;
    const { data, error } = await createFile(workspaceId, `whiteboard-${n}.board`, null, false, userId, '');
    if (error) toast(error.message, { tone: 'error' });
    else openFile(data);
  };

  const pickUpload = (input, parentId = null) => {
    uploadParent.current = parentId;
    input.current?.click();
  };

  // Drag files in the tree onto folders (or empty space for the top level); drop files from your computer too
  const dropHandlers = (folderId) => ({
    onDragOver: (e) => {
      if (readOnly) return;
      const internal = e.dataTransfer.types.includes(DRAG_TYPE);
      if (!internal && !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = internal ? 'move' : 'copy';
      setDropTarget(folderId ?? 'root');
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget((t) => (t === (folderId ?? 'root') ? null : t));
    },
    onDrop: async (e) => {
      if (readOnly) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const draggedId = e.dataTransfer.getData(DRAG_TYPE);
      if (draggedId) {
        if (draggedId === folderId) return;
        const { error } = await moveFile(draggedId, folderId ?? null);
        if (error) toast(error.message, { tone: 'error' });
        else if (folderId) setExpanded((x) => ({ ...x, [folderId]: true }));
      } else if (e.dataTransfer.files.length) {
        upload(e.dataTransfer.files, folderId ?? null);
      }
    },
  });

  const startCreate = (parentId, isFolder) => {
    setMenu(null);
    setRenamingId(null);
    if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
    setCreating({ parentId, isFolder });
  };

  const tree = {
    files,
    activeFileId,
    expanded,
    renamingId,
    creating,
    viewers,
    dropTarget,
    dragProps: (file) => (readOnly ? {} : {
      draggable: true,
      onDragStart: (e) => {
        e.dataTransfer.setData(DRAG_TYPE, file.id);
        e.dataTransfer.effectAllowed = 'move';
      },
      ...(file.is_folder && dropHandlers(file.id)),
    }),
    open: openFile,
    toggle: (id) => setExpanded((e) => ({ ...e, [id]: !(e[id] ?? true) })),
    openMenu: (e, file) => {
      e.preventDefault();
      e.stopPropagation();
      if (!readOnly) setMenu({ x: e.clientX, y: e.clientY, file });
    },
    create: async (name) => {
      const { parentId, isFolder } = creating;
      setCreating(null);
      const { data } = await createFile(workspaceId, name, parentId, isFolder, userId);
      if (data && !isFolder) openFile(data);
    },
    stopCreate: () => setCreating(null),
    rename: async (file, name) => {
      setRenamingId(null);
      const { error } = await renameFile(file.id, name);
      if (error) toast(error.message, { tone: 'error' });
    },
    stopRename: () => setRenamingId(null),
  };

  const confirmDelete = async () => {
    setDeleting(true);
    await deleteFile(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
        <h2 className="text-label-md text-ink">Files</h2>
        <div className="flex items-center">
          {!readOnly && (
            <>
              <button type="button" onClick={() => startCreate(null, false)} className="icon-btn h-7 w-7" aria-label="New file" title="New file">
                <VscNewFile size={16} />
              </button>
              <button type="button" onClick={() => startCreate(null, true)} className="icon-btn h-7 w-7" aria-label="New folder" title="New folder">
                <VscNewFolder size={16} />
              </button>
            </>
          )}
          <DropdownMenu
            label="More file actions"
            buttonClassName="h-7 w-7"
            items={[
              { label: 'Upload files…', icon: GoUpload, hidden: readOnly, onSelect: () => pickUpload(fileInput) },
              { label: 'Upload a folder…', icon: GoUpload, hidden: readOnly, onSelect: () => pickUpload(folderInput) },
              { label: 'New whiteboard', icon: GoPencil, hidden: readOnly, onSelect: newWhiteboard },
              { label: 'Download as zip', icon: GoDownload, onSelect: () => downloadZip(workspaceName) },
            ]}
          />
        </div>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { upload(e.target.files, uploadParent.current); e.target.value = ''; }} />
        <input ref={folderInput} type="file" webkitdirectory="" hidden onChange={(e) => { upload(e.target.files, uploadParent.current); e.target.value = ''; }} />
      </div>

      <nav
        aria-label="Workspace files"
        className={`min-h-0 flex-1 overflow-y-auto px-2 py-2 ${dropTarget === 'root' ? 'bg-brand-soft/60 ring-1 ring-inset ring-brand' : ''}`}
        onContextMenu={(e) => tree.openMenu(e, null)}
        {...dropHandlers(null)}
      >
        <ul>
          {creating && !creating.parentId && (
            <li>
              <NameField depth={0} isFolder={creating.isFolder} siblings={rootFiles} onSubmit={tree.create} onCancel={tree.stopCreate} />
            </li>
          )}
          {rootFiles.map((file) => (
            <TreeItem key={file.id} file={file} depth={0} tree={tree} />
          ))}
        </ul>

        {rootFiles.length === 0 && !creating && (
          <div className="px-3 py-8 text-center">
            <p className="text-body-sm text-ink-muted">No files yet</p>
            {!readOnly && (
              <button type="button" onClick={() => startCreate(null, false)} className="mt-2 text-label-md text-brand-fg hover:underline">
                Create a file
              </button>
            )}
          </div>
        )}
      </nav>

      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onNewFile={() => startCreate(menu.file?.id ?? null, false)}
          onNewFolder={() => startCreate(menu.file?.id ?? null, true)}
          onUpload={() => { setMenu(null); pickUpload(fileInput, menu.file?.id ?? null); }}
          onRename={() => { setMenu(null); setCreating(null); setRenamingId(menu.file.id); }}
          onDelete={() => { setMenu(null); setPendingDelete(menu.file); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={pendingDelete?.is_folder ? 'Delete folder?' : 'Delete file?'}
      >
        <p>
          <span className="font-semibold text-ink">{pendingDelete?.name}</span>
          {pendingDelete?.is_folder
            ? ' and everything inside it will be permanently deleted for everyone in this workspace.'
            : ' will be permanently deleted for everyone in this workspace.'}
        </p>
      </ConfirmDialog>
    </div>
  );
}
