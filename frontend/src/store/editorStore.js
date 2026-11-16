import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { socketService } from '../services/socketService';
import { getLanguage, languageForFile } from '../lib/languages';
import { zipFiles, toBase64 } from '../lib/workspaceFiles';

const collab = () => socketService.collab;
const MAX_ZIP_BYTES = 2_000_000;

// A file's id plus the ids of everything nested under it. Parents always come before children.
export function withDescendants(files, id) {
  const ids = new Set([id]);
  for (let added = true; added; ) {
    added = false;
    for (const f of files) {
      if (ids.has(f.parent_id) && !ids.has(f.id)) {
        ids.add(f.id);
        added = true;
      }
    }
  }
  return ids;
}

const upsertById = (list, row) => (list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [...list, row]);

const FRESH = {
  files: [],
  openFiles: [],
  activeFileId: null,
  activeFile: null,
  output: null,
  isRunning: false,
  testRun: null, // { running, results: { testId: { passed, output } } }
  fileStatus: {}, // fileId -> 'loading' | 'saved' | 'unsaved' | 'error'
  connection: 'connecting', // 'connecting' | 'online' | 'offline'
  presence: [], // online people: { id, display_name, email, avatar_url, fileId }
  driver: null, // pair mode: the user id who can type
  following: null, // user id whose file and cursor we follow
  rightPane: null, // null | { type: 'split', fileId } | { type: 'preview' }
  zen: false,
  sidebarPanel: 'files', // files | search | comments | chat | activity
  reveal: null, // { fileId, offset?, length?, line? } for the editor to jump to
  comments: [],
  messages: [],
  unreadChat: 0,
  runs: [],
};

const useEditorStore = create((set, get) => ({
  ...FRESH,
  language: 'javascript',
  stdin: '',
  args: '',
  loading: false,

  // Fresh state for a newly opened workspace
  reset: () => set(FRESH),
  setConnection: (connection) => set({ connection }),
  setFileStatus: (fileId, status) => set({ fileStatus: { ...get().fileStatus, [fileId]: status } }),
  setDriver: (driver) => set({ driver }),
  setRightPane: (rightPane) => {
    // A split file whose tab was closed keeps its session only while it's on screen
    const old = get().rightPane?.fileId;
    if (old && old !== rightPane?.fileId && !get().openFiles.some((f) => f.id === old)) collab()?.close(old);
    set({ rightPane });
  },
  toggleZen: (zen = !get().zen) => set({ zen }),
  setSidebarPanel: (sidebarPanel) => set({ sidebarPanel, ...(sidebarPanel === 'chat' && { unreadChat: 0 }) }),
  clearReveal: () => set({ reveal: null }),

  setPresence: (presence) => {
    set({ presence });
    const { following } = get();
    if (!following) return;
    const leader = presence.find((u) => u.id === following);
    if (!leader) return set({ following: null });
    const file = leader.fileId && get().files.find((f) => f.id === leader.fileId);
    if (file && file.id !== get().activeFileId) get().openFile(file);
  },
  follow: (userId) => {
    set({ following: userId });
    if (userId) get().setPresence(get().presence);
  },

  fetchFiles: async (workspaceId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('is_folder', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      set({ files: data || [], loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  openFile: (file) => {
    collab()?.open(file.id);
    collab()?.setActiveFile(file.id);
    const { openFiles } = get();
    if (!openFiles.some((f) => f.id === file.id)) set({ openFiles: [...openFiles, file] });
    set({
      activeFileId: file.id,
      activeFile: file,
      language: file.language || languageForFile(file.name),
    });
  },

  // Open a file and move the cursor: by text offset (search, comments) or by line (go to line)
  revealAt: (fileId, target) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) return;
    get().openFile(file);
    set({ reveal: { fileId, ...target } });
  },

  closeFile: (fileId) => {
    const { openFiles, activeFileId, rightPane } = get();
    // A file still shown in the split pane keeps its session
    if (rightPane?.fileId !== fileId) collab()?.close(fileId);
    const filtered = openFiles.filter((f) => f.id !== fileId);
    const { [fileId]: _, ...fileStatus } = get().fileStatus;
    set({ fileStatus, ...(rightPane?.fileId === fileId && filtered.length === 0 && { rightPane: null }) });

    if (activeFileId !== fileId) {
      set({ openFiles: filtered });
      return;
    }

    const next = filtered[filtered.length - 1];
    collab()?.setActiveFile(next?.id ?? null);
    set({
      openFiles: filtered,
      activeFileId: next?.id ?? null,
      activeFile: next ?? null,
      language: next ? next.language || languageForFile(next.name) : get().language,
    });
  },

  // Keeps every copy of a file's content current (local typing and remote updates),
  // so search, previews and runs see the latest text. The editor itself syncs through collab.
  setFileContent: (fileId, content) => {
    const patch = (f) => (f.id === fileId ? { ...f, content } : f);
    set({ files: get().files.map(patch), openFiles: get().openFiles.map(patch) });
  },

  // Latest text of a file: the live document when it's open, else the last saved copy
  contentOf: (fileId) => {
    const session = collab()?.get(fileId);
    if (session?.synced) return session.text.toString();
    return get().files.find((f) => f.id === fileId)?.content ?? '';
  },

  // Edits save automatically; this saves right away (Ctrl/Cmd+S)
  saveFile: (fileId) => collab()?.get(fileId)?.save(),

  // A change someone else made to the file list (Supabase Realtime)
  applyRemoteFileChange: ({ eventType, new: row, old }) => {
    const { files, openFiles, activeFile } = get();
    if (eventType === 'INSERT') {
      if (!files.some((f) => f.id === row.id)) set({ files: [...files, row] });
      return;
    }
    if (eventType === 'UPDATE') {
      // Open files get their text from collab, which is newer than what was last saved
      const open = !!collab()?.get(row.id);
      const patch = (f) => (f.id === row.id ? { ...row, content: open ? f.content : row.content } : f);
      set({
        files: files.map(patch),
        openFiles: openFiles.map(patch),
        ...(activeFile?.id === row.id && { activeFile: patch(activeFile), language: row.language || languageForFile(row.name) }),
      });
      return;
    }
    if (eventType === 'DELETE' && files.some((f) => f.id === old.id)) get().removeFiles(old.id);
  },

  // Drop a file and everything under it from local state, closing their tabs
  removeFiles: (fileId) => {
    const gone = withDescendants(get().files, fileId);
    gone.forEach((id) => collab()?.close(id));
    const files = get().files.filter((f) => !gone.has(f.id));
    const openFiles = get().openFiles.filter((f) => !gone.has(f.id));
    set({ files, openFiles, ...(gone.has(get().rightPane?.fileId) && { rightPane: null }) });

    if (gone.has(get().activeFileId)) {
      const last = openFiles[openFiles.length - 1];
      if (last) {
        get().openFile(last);
      } else {
        collab()?.setActiveFile(null);
        set({ activeFileId: null, activeFile: null });
      }
    }
  },

  createFile: async (workspaceId, name, parentId = null, isFolder = false, userId, content = '') => {
    try {
      const parentPath = parentId
        ? get().files.find((f) => f.id === parentId)?.path || ''
        : '';

      const { data, error } = await supabase
        .from('files')
        .insert({
          workspace_id: workspaceId,
          name,
          path: `${parentPath}/${name}`,
          content: isFolder ? null : content,
          language: isFolder ? null : languageForFile(name),
          is_folder: isFolder,
          parent_id: parentId,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      if (!get().files.some((f) => f.id === data.id)) set({ files: [...get().files, data] });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Uploads: [{ path: 'folder/file.txt', content }] relative to `parentId`.
  // Folders are created as needed; names that already exist are skipped.
  importFiles: async (workspaceId, userId, parentId, entries) => {
    const childOf = (pid, name) => get().files.find((f) => (f.parent_id ?? null) === pid && f.name.toLowerCase() === name.toLowerCase());
    let created = 0;
    const skipped = [];
    for (const { path, content } of entries) {
      const parts = path.split('/').filter(Boolean);
      let pid = parentId ?? null;
      let blocked = false;
      for (const folder of parts.slice(0, -1)) {
        const existing = childOf(pid, folder);
        if (existing?.is_folder) {
          pid = existing.id;
          continue;
        }
        if (existing) {
          blocked = true;
          break;
        }
        const { data, error } = await get().createFile(workspaceId, folder, pid, true, userId);
        if (error) return { created, skipped, error };
        pid = data.id;
      }
      if (blocked || childOf(pid, parts.at(-1))) {
        skipped.push(path);
        continue;
      }
      const { error } = await get().createFile(workspaceId, parts.at(-1), pid, false, userId, content);
      if (error) return { created, skipped, error };
      created++;
    }
    return { created, skipped, error: null };
  },

  deleteFile: async (fileId) => {
    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      // The DB cascades to everything nested under it; mirror that locally
      get().removeFiles(fileId);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  },

  // Rename and/or move (parentId: a folder id, or null for the top level). Returns { error }.
  placeFile: async (fileId, { name, parentId }) => {
    const { files } = get();
    const original = files.find((f) => f.id === fileId);
    if (!original) return { error: new Error('That file no longer exists') };
    const byId = new Map(files.map((f) => [f.id, { id: f.id, parent_id: f.parent_id, name: f.name, path: f.path }]));
    const target = byId.get(fileId);
    const ids = withDescendants(files, fileId);
    if (parentId !== undefined) {
      if (parentId && ids.has(parentId)) return { error: new Error("A folder can't go inside itself") };
      target.parent_id = parentId;
    }
    if (name !== undefined) target.name = name;
    if (target.parent_id === original.parent_id && target.name === original.name) return { error: null };
    const clash = files.some((f) => f.id !== fileId && (f.parent_id ?? null) === (target.parent_id ?? null) && f.name.toLowerCase() === target.name.toLowerCase());
    if (clash) return { error: new Error(`Something named ${target.name} is already there`) };

    const isFolder = original.is_folder;
    // A new extension means a new language (main.js -> main.py)
    const language = isFolder ? null : languageForFile(target.name);
    for (const id of ids) {
      const f = byId.get(id);
      f.path = `${byId.get(f.parent_id)?.path || ''}/${f.name}`;
    }

    // ponytail: one update per row, not atomic. Move to a Postgres function if partial moves show up.
    const results = await Promise.all([...ids].map((id) => {
      const { name: n, path, parent_id } = byId.get(id);
      const patch = id === fileId ? { name: n, path, parent_id, ...(!isFolder && { language }) } : { path };
      return supabase.from('files').update(patch).eq('id', id);
    }));
    const failed = results.find((r) => r.error);
    if (failed) return { error: failed.error };

    const patch = (f) => {
      if (!ids.has(f.id)) return f;
      const { name: n, path, parent_id } = byId.get(f.id);
      return f.id === fileId ? { ...f, name: n, path, parent_id, ...(!isFolder && { language }) } : { ...f, path };
    };
    const { activeFile } = get();
    set({
      files: get().files.map(patch),
      openFiles: get().openFiles.map(patch),
      ...(activeFile && ids.has(activeFile.id) && { activeFile: patch(activeFile) }),
      ...(activeFile?.id === fileId && !isFolder && { language }),
    });
    return { error: null };
  },

  renameFile: (fileId, name) => get().placeFile(fileId, { name }),
  moveFile: (fileId, parentId) => get().placeFile(fileId, { parentId }),

  // { "/path": text } for every file, with the live text of open ones
  snapshotFiles: (exceptId) => {
    const out = {};
    for (const f of get().files) if (!f.is_folder && f.id !== exceptId) out[f.path] = get().contentOf(f.id);
    return out;
  },

  downloadZip: (name) => {
    const blob = new Blob([zipFiles(get().snapshotFiles())], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `${name.replace(/[^\w.-]+/g, '-') || 'workspace'}.zip` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // The request body shared by runs and test runs: the active file plus every other file,
  // zipped, so imports between files work.
  runRequest: () => {
    const { activeFile, language, args } = get();
    const others = get().snapshotFiles(activeFile.id);
    let additional_files;
    if (Object.keys(others).length) {
      const zip = zipFiles(others);
      if (zip.length <= MAX_ZIP_BYTES) additional_files = toBase64(zip);
    }
    return {
      source_code: get().contentOf(activeFile.id),
      language_id: getLanguage(language).judge0Id,
      args: args.trim() || undefined,
      workspace_id: activeFile.workspace_id,
      file_id: activeFile.id,
      additional_files,
    };
  },

  // Runs the active file in the Judge0 sandbox. Shared by the Run button and Ctrl/Cmd+Enter.
  runCode: async () => {
    const { activeFile, language, stdin, isRunning } = get();
    if (!activeFile || isRunning) return;

    const { judge0Id, label } = getLanguage(language);
    if (!judge0Id) {
      set({
        output: {
          stderr: `${label} files can't be run. Open a file in a supported language to run it.`,
          status: { id: -1, description: 'Not runnable' },
        },
      });
      return;
    }

    set({ isRunning: true, output: null });
    try {
      const data = await api('/api/compiler/run', { method: 'POST', body: { ...get().runRequest(), stdin } });
      set({ output: data });
    } catch (error) {
      set({
        output: {
          stderr: error.message || 'Execution failed. Is the backend running?',
          status: { id: -1, description: 'Error' },
        },
      });
    } finally {
      set({ isRunning: false });
    }
  },

  // tests: [{ id, input, expected_output }]
  runTests: async (tests) => {
    const { activeFile, language, isRunning, testRun } = get();
    if (!activeFile || isRunning || testRun?.running || !getLanguage(language).judge0Id) return;
    set({ testRun: { running: true, fileId: activeFile.id, results: {} } });
    try {
      const { results } = await api('/api/compiler/test', {
        method: 'POST',
        body: { ...get().runRequest(), tests: tests.map(({ id, input, expected_output }) => ({ id, input, expected_output })) },
      });
      set({ testRun: { running: false, fileId: activeFile.id, results: Object.fromEntries(results.map((r) => [r.id, r])) } });
    } catch (error) {
      set({ testRun: { running: false, fileId: activeFile.id, results: {}, error: error.message } });
    }
  },

  setOutput: (output) => set({ output }),
  setStdin: (stdin) => set({ stdin }),
  setArgs: (args) => set({ args }),

  // Live workspace data (Supabase Realtime and socket events feed these)
  setComments: (comments) => set({ comments }),
  upsertComment: (row) => set({ comments: upsertById(get().comments, row) }),
  removeComment: (id) => set({ comments: get().comments.filter((c) => c.id !== id && c.parent_id !== id) }),
  setMessages: (messages) => set({ messages }),
  addMessage: (row, fromSomeoneElse) => {
    if (get().messages.some((m) => m.id === row.id)) return;
    set({
      messages: [...get().messages, row],
      ...(fromSomeoneElse && get().sidebarPanel !== 'chat' && { unreadChat: get().unreadChat + 1 }),
    });
  },
  setRuns: (runs) => set({ runs }),
  addRun: (run) => {
    if (!get().runs.some((r) => r.id === run.id)) set({ runs: [run, ...get().runs].slice(0, 50) });
  },
}));

export default useEditorStore;
