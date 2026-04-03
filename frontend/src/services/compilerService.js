import axios from 'axios';
import { supabase } from '../lib/supabase';

export const compilerService = {
  async run(sourceCode, languageId, stdin = '') {
    const { data: { session } } = await supabase.auth.getSession();
    
    return axios.post(`${import.meta.env.VITE_API_URL || ''}/api/compiler/run`, {
      source_code: sourceCode,
      language_id: languageId,
      stdin,
    }, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
  },

  async getLanguages() {
    return axios.get(`${import.meta.env.VITE_API_URL || ''}/api/compiler/languages`);
  },
};
