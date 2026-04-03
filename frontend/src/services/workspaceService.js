import { supabase } from '../lib/supabase';

export const workspaceService = {
  async list(userId) {
    const { data: rows } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId);

    const ids = rows?.map((r) => r.workspace_id) || [];
    if (ids.length === 0) return { data: [] };

    return supabase
      .from('workspaces')
      .select('*, workspace_members(count)')
      .in('id', ids)
      .order('updated_at', { ascending: false });
  },

  async get(workspaceId) {
    return supabase.from('workspaces').select('*').eq('id', workspaceId).single();
  },

  async create(data) {
    return supabase.from('workspaces').insert(data).select().single();
  },

  async update(id, data) {
    return supabase.from('workspaces').update(data).eq('id', id).select().single();
  },

  async remove(id) {
    return supabase.from('workspaces').delete().eq('id', id);
  },

  async getMembers(workspaceId) {
    return supabase
      .from('workspace_members')
      .select('*, profiles(*)')
      .eq('workspace_id', workspaceId);
  },

  async invite(workspaceId, userId, role) {
    return supabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: userId,
      role,
    });
  },
};
