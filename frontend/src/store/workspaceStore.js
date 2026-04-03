import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useWorkspaceStore = create((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  members: [],
  loading: false,
  error: null,

  fetchWorkspaces: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data: memberRows, error: memErr } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId);

      if (memErr) throw memErr;

      const workspaceIds = memberRows.map((m) => m.workspace_id);

      if (workspaceIds.length === 0) {
        set({ workspaces: [], loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('workspaces')
        .select('*, workspace_members(count)')
        .in('id', workspaceIds)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      set({ workspaces: data || [], loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  fetchWorkspace: async (workspaceId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) throw error;

      const { data: members } = await supabase
        .from('workspace_members')
        .select('*, profiles(*)')
        .eq('workspace_id', workspaceId);

      set({ currentWorkspace: data, members: members || [], loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createWorkspace: async (name, description, defaultLanguage, ownerId) => {
    set({ loading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name,
          description,
          default_language: defaultLanguage
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create workspace');
      }

      const data = await response.json();

      const workspaces = get().workspaces;
      set({ workspaces: [data, ...workspaces], loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  deleteWorkspace: async (workspaceId) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

      if (error) throw error;

      const workspaces = get().workspaces.filter((w) => w.id !== workspaceId);
      set({ workspaces, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  inviteMember: async (workspaceId, email, role = 'editor') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ email, role })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to invite user');
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  clearError: () => set({ error: null }),
}));

function getExtension(language) {
  const map = {
    javascript: 'js', typescript: 'ts', python: 'py',
    java: 'java', c: 'c', cpp: 'cpp', go: 'go',
    rust: 'rs', ruby: 'rb', php: 'php', csharp: 'cs',
  };
  return map[language] || 'txt';
}

function getDefaultContent(language) {
  const templates = {
    javascript: '// Welcome to DevSync!\nconsole.log("Hello, World!");\n',
    typescript: '// Welcome to DevSync!\nconsole.log("Hello, World!");\n',
    python: '# Welcome to DevSync!\nprint("Hello, World!")\n',
    java: '// Welcome to DevSync!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
    c: '// Welcome to DevSync!\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
    cpp: '// Welcome to DevSync!\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
    python: '# Welcome to DevSync!\nprint("Hello, World!")\n',
    go: '// Welcome to DevSync!\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n',
    rust: '// Welcome to DevSync!\nfn main() {\n    println!("Hello, World!");\n}\n',
  };
  return templates[language] || '// Welcome to DevSync!\n';
}

export default useWorkspaceStore;
