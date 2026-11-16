import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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

const useEditorStore = create((set, get) => ({
  files: [],
  openFiles: [],
  activeFileId: null,
  activeFile: null,
  editorContent: '',
  language: 'javascript',
  theme: 'vs-dark',
  fontSize: 14,
  output: null,
  isRunning: false,
  stdin: '',
  loading: false,

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
    const { openFiles } = get();
    const alreadyOpen = openFiles.find((f) => f.id === file.id);
    if (!alreadyOpen) {
      set({ openFiles: [...openFiles, file] });
    }
    set({
      activeFileId: file.id,
      activeFile: file,
      editorContent: file.content || '',
      language: file.language || 'javascript',
    });
  },

  closeFile: (fileId) => {
    const { openFiles, activeFileId } = get();
    const filtered = openFiles.filter((f) => f.id !== fileId);
    let newActive = activeFileId;
    let newActiveFile = get().activeFile;
    let newContent = get().editorContent;

    if (activeFileId === fileId) {
      if (filtered.length > 0) {
        newActive = filtered[filtered.length - 1].id;
        newActiveFile = filtered[filtered.length - 1];
        newContent = newActiveFile.content || '';
      } else {
        newActive = null;
        newActiveFile = null;
        newContent = '';
      }
    }

    set({
      openFiles: filtered,
      activeFileId: newActive,
      activeFile: newActiveFile,
      editorContent: newContent,
    });
  },

  setEditorContent: (content) => {
    get().setFileContent(get().activeFileId, content);
  },

  // Keeps every copy of a file's content current (local typing and remote updates),
  // so switching tabs never brings back stale content.
  setFileContent: (fileId, content) => {
    const patch = (f) => (f.id === fileId ? { ...f, content } : f);
    set({
      files: get().files.map(patch),
      openFiles: get().openFiles.map(patch),
      ...(get().activeFileId === fileId && { editorContent: content }),
    });
  },

  // Only persists; local state is already current via setFileContent.
  saveFile: async (fileId, content) => {
    const { error } = await supabase
      .from('files')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', fileId);

    if (error) console.error('Save failed:', error);
  },

  createFile: async (workspaceId, name, parentId = null, isFolder = false, userId) => {
    try {
      const parentPath = parentId
        ? get().files.find((f) => f.id === parentId)?.path || ''
        : '';
      const path = `${parentPath}/${name}`;
      const ext = name.split('.').pop();
      const langMap = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        py: 'python', java: 'java', c: 'c', cpp: 'cpp', go: 'go',
        rs: 'rust', rb: 'ruby', php: 'php', cs: 'csharp',
        html: 'html', css: 'css', json: 'json', md: 'markdown',
      };

      const { data, error } = await supabase
        .from('files')
        .insert({
          workspace_id: workspaceId,
          name,
          path,
          content: isFolder ? null : '',
          language: isFolder ? null : (langMap[ext] || 'plaintext'),
          is_folder: isFolder,
          parent_id: parentId,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      set({ files: [...get().files, data] });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  deleteFile: async (fileId) => {
    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      // The DB cascades to everything nested under it; mirror that locally
      const gone = withDescendants(get().files, fileId);
      const files = get().files.filter((f) => !gone.has(f.id));
      const openFiles = get().openFiles.filter((f) => !gone.has(f.id));

      set({ files, openFiles });

      if (gone.has(get().activeFileId)) {
        if (openFiles.length > 0) {
          const last = openFiles[openFiles.length - 1];
          set({ activeFileId: last.id, activeFile: last, editorContent: last.content || '' });
        } else {
          set({ activeFileId: null, activeFile: null, editorContent: '' });
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  },

  renameFile: async (fileId, newName) => {
    try {
      const byId = new Map(get().files.map((f) => [f.id, { id: f.id, parent_id: f.parent_id, name: f.name, path: f.path }]));
      if (!byId.has(fileId)) return;
      byId.get(fileId).name = newName;

      // Recompute paths for the item and everything under it (parents come first)
      const ids = withDescendants(get().files, fileId);
      for (const id of ids) {
        const f = byId.get(id);
        f.path = `${byId.get(f.parent_id)?.path || ''}/${f.name}`;
      }

      // ponytail: one update per row, not atomic. Move to a Postgres function if partial renames show up.
      const results = await Promise.all([...ids].map((id) =>
        supabase.from('files').update({ name: byId.get(id).name, path: byId.get(id).path }).eq('id', id)
      ));
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;

      const patch = (f) => (ids.has(f.id) ? { ...f, name: byId.get(f.id).name, path: byId.get(f.id).path } : f);
      set({ files: get().files.map(patch), openFiles: get().openFiles.map(patch) });
    } catch (error) {
      console.error('Rename failed:', error);
    }
  },

  setOutput: (output) => set({ output }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setStdin: (stdin) => set({ stdin }),
  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize }),
}));

export default useEditorStore;
