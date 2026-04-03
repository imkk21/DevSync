import { supabase } from '../lib/supabase';

export const fileService = {
  async list(workspaceId) {
    return supabase
      .from('files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('is_folder', { ascending: false })
      .order('name', { ascending: true });
  },

  async get(fileId) {
    return supabase.from('files').select('*').eq('id', fileId).single();
  },

  async create(data) {
    return supabase.from('files').insert(data).select().single();
  },

  async update(fileId, content) {
    return supabase
      .from('files')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', fileId);
  },

  async rename(fileId, name, path) {
    return supabase
      .from('files')
      .update({ name, path })
      .eq('id', fileId);
  },

  async remove(fileId) {
    return supabase.from('files').delete().eq('id', fileId);
  },
};
