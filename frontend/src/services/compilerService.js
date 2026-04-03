import axios from 'axios';

export const compilerService = {
  async run(sourceCode, languageId, stdin = '') {
    return axios.post('/api/compiler/run', {
      source_code: sourceCode,
      language_id: languageId,
      stdin,
    });
  },

  async getLanguages() {
    return axios.get('/api/compiler/languages');
  },
};
