import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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
    set({ editorContent: content });
  },

  saveFile: async (fileId, content) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', fileId);

      if (error) throw error;

      const files = get().files.map((f) =>
        f.id === fileId ? { ...f, content } : f
      );
      const openFiles = get().openFiles.map((f) =>
        f.id === fileId ? { ...f, content } : f
      );
      const activeFile = get().activeFile?.id === fileId
        ? { ...get().activeFile, content }
        : get().activeFile;

      set({ files, openFiles, activeFile });
    } catch (error) {
      console.error('Save failed:', error);
    }
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

      const files = get().files.filter((f) => f.id !== fileId && f.parent_id !== fileId);
      const openFiles = get().openFiles.filter((f) => f.id !== fileId);

      set({ files, openFiles });

      if (get().activeFileId === fileId) {
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
      const file = get().files.find((f) => f.id === fileId);
      if (!file) return;

      const pathParts = file.path.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      const { error } = await supabase
        .from('files')
        .update({ name: newName, path: newPath })
        .eq('id', fileId);

      if (error) throw error;

      const files = get().files.map((f) =>
        f.id === fileId ? { ...f, name: newName, path: newPath } : f
      );
      const openFiles = get().openFiles.map((f) =>
        f.id === fileId ? { ...f, name: newName, path: newPath } : f
      );

      set({ files, openFiles });
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
