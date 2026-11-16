import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

async function memberAction(get, workspaceId, path, method, body) {
  try {
    const data = await api(path, { method, body });
    if (get().currentWorkspace?.id === workspaceId) await get().fetchWorkspace(workspaceId);
    return { data, error: null };
  } catch (error) {
    return { error };
  }
}

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
        .select('workspace_id, pinned, archived')
        .eq('user_id', userId);

      if (memErr) throw memErr;

      const workspaceIds = memberRows.map((m) => m.workspace_id);
      const prefs = new Map(memberRows.map((m) => [m.workspace_id, m]));

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
      // Your own pin/archive flags ride along on each workspace
      const withPrefs = (data || []).map((w) => ({ ...w, pinned: !!prefs.get(w.id)?.pinned, archived: !!prefs.get(w.id)?.archived }));
      set({ workspaces: withPrefs, loading: false });
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

  // template (optional): { files: [{ path, content, language }], tests: [{ path, input, expected_output }] }
  createWorkspace: async (name, description, defaultLanguage, template) => {
    set({ loading: true, error: null });
    try {
      const data = await api('/api/workspaces', {
        method: 'POST',
        body: { name, description, default_language: defaultLanguage, files: template?.files, tests: template?.tests },
      });
      set({ workspaces: [data, ...get().workspaces], loading: false });
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

  // Member management: each returns { error } and refreshes the member list on success
  inviteMember: (workspaceId, email, role = 'editor') =>
    memberAction(get, workspaceId, `/api/workspaces/${workspaceId}/invite`, 'POST', { email, role }),
  updateMemberRole: (workspaceId, userId, role) =>
    memberAction(get, workspaceId, `/api/workspaces/${workspaceId}/members/${userId}`, 'PATCH', { role }),
  removeMember: (workspaceId, userId) =>
    memberAction(get, workspaceId, `/api/workspaces/${workspaceId}/members/${userId}`, 'DELETE'),
  transferOwnership: (workspaceId, userId) =>
    memberAction(get, workspaceId, `/api/workspaces/${workspaceId}/transfer`, 'POST', { userId }),

  // Owner settings: { name, description, is_classroom, interview }
  updateWorkspace: async (workspaceId, patch) => {
    try {
      const data = await api(`/api/workspaces/${workspaceId}`, { method: 'PUT', body: patch });
      get().setCurrentWorkspace(data);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // A newer copy of a workspace row (from the API or the socket)
  setCurrentWorkspace: (row) => set({
    workspaces: get().workspaces.map((w) => (w.id === row.id ? { ...w, ...row } : w)),
    ...(get().currentWorkspace?.id === row.id && { currentWorkspace: { ...get().currentWorkspace, ...row } }),
  }),

  duplicateWorkspace: async (workspaceId) => {
    try {
      const data = await api(`/api/workspaces/${workspaceId}/duplicate`, { method: 'POST' });
      set({ workspaces: [{ ...data, workspace_members: [{ count: 1 }] }, ...get().workspaces] });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Your own view of the dashboard: { pinned } or { archived }
  setPref: async (workspaceId, userId, patch) => {
    const before = get().workspaces;
    set({ workspaces: before.map((w) => (w.id === workspaceId ? { ...w, ...patch } : w)) });
    const { error } = await supabase.from('workspace_members').update(patch).eq('workspace_id', workspaceId).eq('user_id', userId);
    if (error) set({ workspaces: before });
    return { error };
  },

  setPublicLink: async (workspaceId, enabled) => {
    try {
      const { public_token } = await api(`/api/workspaces/${workspaceId}/public`, { method: 'POST', body: { enabled } });
      get().setCurrentWorkspace({ id: workspaceId, public_token });
      return { token: public_token, error: null };
    } catch (error) {
      return { error };
    }
  },

  // Invite links and pending email invites (owner only)
  listInvites: (workspaceId) => api(`/api/workspaces/${workspaceId}/invites`),
  createInviteLink: (workspaceId, role) => api(`/api/workspaces/${workspaceId}/invites`, { method: 'POST', body: { role } }),
  revokeInvite: (workspaceId, inviteId) => api(`/api/workspaces/${workspaceId}/invites/${inviteId}`, { method: 'DELETE' }),

  leaveWorkspace: async (workspaceId) => {
    try {
      await api(`/api/workspaces/${workspaceId}/leave`, { method: 'POST' });
      set({ workspaces: get().workspaces.filter((w) => w.id !== workspaceId) });
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  clearError: () => set({ error: null }),
}));

export default useWorkspaceStore;
