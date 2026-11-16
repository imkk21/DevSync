import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { compilerService } from '../services/compilerService';
import { getLanguage, languageForFile } from '../lib/languages';

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
      language: file.language || languageForFile(file.name),
    });
  },

  closeFile: (fileId) => {
    const { openFiles, activeFileId } = get();
    const filtered = openFiles.filter((f) => f.id !== fileId);

    if (activeFileId !== fileId) {
      set({ openFiles: filtered });
      return;
    }

    const next = filtered[filtered.length - 1];
    set({
      openFiles: filtered,
      activeFileId: next?.id ?? null,
      activeFile: next ?? null,
      editorContent: next?.content || '',
      language: next ? next.language || languageForFile(next.name) : get().language,
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

      const { data, error } = await supabase
        .from('files')
        .insert({
          workspace_id: workspaceId,
          name,
          path: `${parentPath}/${name}`,
          content: isFolder ? null : '',
          language: isFolder ? null : languageForFile(name),
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
        const last = openFiles[openFiles.length - 1];
        if (last) {
          get().openFile(last);
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
      const target = byId.get(fileId);
      if (!target) return;
      target.name = newName;
      const isFolder = get().files.find((f) => f.id === fileId).is_folder;
      // A new extension means a new language (main.js -> main.py)
      const language = isFolder ? null : languageForFile(newName);

      // Recompute paths for the item and everything under it (parents come first)
      const ids = withDescendants(get().files, fileId);
      for (const id of ids) {
        const f = byId.get(id);
        f.path = `${byId.get(f.parent_id)?.path || ''}/${f.name}`;
      }

      // ponytail: one update per row, not atomic. Move to a Postgres function if partial renames show up.
      const results = await Promise.all([...ids].map((id) => {
        const { name, path } = byId.get(id);
        return supabase.from('files').update(id === fileId && !isFolder ? { name, path, language } : { name, path }).eq('id', id);
      }));
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;

      const patch = (f) => {
        if (!ids.has(f.id)) return f;
        const { name, path } = byId.get(f.id);
        return f.id === fileId && !isFolder ? { ...f, name, path, language } : { ...f, name, path };
      };
      const { activeFile } = get();
      set({
        files: get().files.map(patch),
        openFiles: get().openFiles.map(patch),
        ...(activeFile && ids.has(activeFile.id) && { activeFile: patch(activeFile) }),
        ...(activeFile?.id === fileId && !isFolder && { language }),
      });
    } catch (error) {
      console.error('Rename failed:', error);
    }
  },

  // Runs the active file in the Judge0 sandbox. Shared by the Run button and Ctrl/Cmd+Enter.
  runCode: async () => {
    const { activeFile, editorContent, language, stdin, isRunning } = get();
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
      const { data } = await compilerService.run(editorContent, judge0Id, stdin, activeFile.workspace_id, activeFile.id);
      set({ output: data });
    } catch (error) {
      set({
        output: {
          stderr: error.response?.data?.message || error.message || 'Execution failed. Is the backend running?',
          status: { id: -1, description: 'Error' },
        },
      });
    } finally {
      set({ isRunning: false });
    }
  },

  setOutput: (output) => set({ output }),
  setStdin: (stdin) => set({ stdin }),
}));

export default useEditorStore;
