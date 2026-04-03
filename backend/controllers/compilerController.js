import { submitCode, getSubmissionResult } from '../services/judge0Service.js';
import { supabaseAdmin } from '../config/supabase.js';

export async function runCode(req, res) {
  try {
    const { source_code, language_id, stdin } = req.body;

    if (!source_code) {
      return res.status(400).json({ message: 'Source code is required' });
    }

    if (!language_id) {
      return res.status(400).json({ message: 'Language ID is required' });
    }

    // Submit to Judge0
    const submission = await submitCode(source_code, language_id, stdin);

    if (!submission || !submission.token) {
      return res.status(500).json({ message: 'Failed to submit code for execution' });
    }

    // Poll for result
    let result = null;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await getSubmissionResult(submission.token);

      if (result && result.status && result.status.id > 2) {
        // Status > 2 means finished (3=Accepted, 4=Wrong Answer, etc.)
        break;
      }
      attempts++;
    }

    if (!result) {
      return res.status(408).json({ message: 'Execution timed out' });
    }

    // Decode base64 outputs
    const output = {
      stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString('utf-8') : null,
      stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString('utf-8') : null,
      compile_output: result.compile_output ? Buffer.from(result.compile_output, 'base64').toString('utf-8') : null,
      status: result.status,
      time: result.time,
      memory: result.memory,
    };

    // Log execution
    try {
      await supabaseAdmin.from('execution_logs').insert({
        user_id: req.user.id,
        language: String(language_id),
        source_code: source_code.substring(0, 10000), // Limit stored code
        stdin: stdin || null,
        stdout: output.stdout,
        stderr: output.stderr,
        status: result.status?.description,
        execution_time: result.time ? parseFloat(result.time) : null,
        memory_used: result.memory,
      });
    } catch (logErr) {
      console.error('Failed to log execution:', logErr);
    }

    res.json(output);
  } catch (error) {
    console.error('Compiler error:', error);
    res.status(500).json({ message: error.message || 'Execution failed' });
  }
}

export async function getLanguages(req, res) {
  const languages = [
    { id: 63, name: 'JavaScript (Node.js)' },
    { id: 74, name: 'TypeScript' },
    { id: 71, name: 'Python 3' },
    { id: 62, name: 'Java (OpenJDK)' },
    { id: 50, name: 'C (GCC)' },
    { id: 54, name: 'C++ (GCC)' },
    { id: 60, name: 'Go' },
    { id: 73, name: 'Rust' },
    { id: 72, name: 'Ruby' },
    { id: 68, name: 'PHP' },
    { id: 51, name: 'C# (Mono)' },
  ];

  res.json(languages);
}
