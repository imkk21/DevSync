import { submitCode, getSubmissionResult } from '../services/judge0Service.js';
import { supabaseAdmin } from '../config/supabase.js';

// ponytail: in-memory, per-process limits. Move to Redis if you run more than one backend instance.
const RUNS_PER_MINUTE = 10;
const recentRuns = new Map(); // userId -> timestamps of runs in the last minute
const activeRuns = new Set(); // userIds with a run in flight

export function checkRateLimit(userId, now = Date.now()) {
  if (activeRuns.has(userId)) return 'A run is already in progress';
  const runs = (recentRuns.get(userId) || []).filter((t) => now - t < 60_000);
  if (runs.length >= RUNS_PER_MINUTE) return 'Too many runs, try again in a minute';
  runs.push(now);
  recentRuns.set(userId, runs);
  return null;
}

export async function runCode(req, res) {
  const limitError = checkRateLimit(req.user.id);
  if (limitError) return res.status(429).json({ message: limitError });

  activeRuns.add(req.user.id);
  try {
    const { source_code, language_id, stdin, workspace_id, file_id } = req.body;

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

    if (!result || !result.status || result.status.id <= 2) {
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
        workspace_id: workspace_id || null,
        file_id: file_id || null,
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
  } finally {
    activeRuns.delete(req.user.id);
  }
}
