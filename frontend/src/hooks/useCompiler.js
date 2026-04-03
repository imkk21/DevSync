import { useState, useCallback } from 'react';
import axios from 'axios';
import useEditorStore from '../store/editorStore';

const LANGUAGES = [
  { value: 'javascript', judge0Id: 63 },
  { value: 'typescript', judge0Id: 74 },
  { value: 'python', judge0Id: 71 },
  { value: 'java', judge0Id: 62 },
  { value: 'c', judge0Id: 50 },
  { value: 'cpp', judge0Id: 54 },
  { value: 'go', judge0Id: 60 },
  { value: 'rust', judge0Id: 73 },
  { value: 'ruby', judge0Id: 72 },
  { value: 'php', judge0Id: 68 },
  { value: 'csharp', judge0Id: 51 },
];

export default function useCompiler() {
  const { editorContent, language, stdin, setOutput, setIsRunning } = useEditorStore();

  const runCode = useCallback(async () => {
    const lang = LANGUAGES.find((l) => l.value === language);
    if (!lang) return;

    setIsRunning(true);
    setOutput(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await axios.post(`${API_URL}/api/compiler/run`, {
        source_code: editorContent,
        language_id: lang.judge0Id,
        stdin,
      });

      setOutput(response.data);
    } catch (error) {
      setOutput({
        stderr: error.response?.data?.message || error.message || 'Execution failed',
        status: { description: 'Error', id: -1 },
      });
    } finally {
      setIsRunning(false);
    }
  }, [editorContent, language, stdin, setOutput, setIsRunning]);

  return { runCode };
}
