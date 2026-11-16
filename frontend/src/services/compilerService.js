import axios from 'axios';
import { supabase } from '../lib/supabase';

export const compilerService = {
  async run(sourceCode, languageId, stdin = '', workspaceId = null, fileId = null) {
    const { data: { session } } = await supabase.auth.getSession();

    const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    return axios.post(`${API_URL}/api/compiler/run`, {
      source_code: sourceCode,
      language_id: languageId,
      stdin,
      workspace_id: workspaceId,
      file_id: fileId,
    }, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
  },
};
