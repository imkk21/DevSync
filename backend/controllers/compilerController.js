import { submitCode, getSubmissionResult, decodeResult, runBatch, normalizeOutput } from '../services/judge0Service.js';
import { recordScore } from '../services/testWatch.js';
import { supabaseAdmin } from '../config/supabase.js';
import { broadcastToWorkspace } from '../collab.js';
import { getRole, QUOTA } from '../services/access.js';
import { displayName } from '../services/events.js';

const RUNS_PER_MINUTE = 10;
const MAX_TESTS = 20;
const MAX_ZIP = 3_000_000; // base64 characters of the workspace zip
const MAX_SOURCE = 1_000_000;

// ponytail: in-memory, per-process limits. Set UPSTASH_REDIS_REST_URL/TOKEN to share the per-minute
// limit across instances; "one run in flight" stays per process.
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

async function upstashLimit(userId) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  try {
    const key = `devsync:runs:${userId}:${Math.floor(Date.now() / 60_000)}`;
    const res = await fetch(`${url.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, 120]]),
    });
    const [{ result: count }] = await res.json();
    return count > RUNS_PER_MINUTE ? 'Too many runs, try again in a minute' : null;
  } catch (err) {
    console.error('Upstash rate limit failed, using in-memory limit:', err.message);
    return undefined;
  }
}

async function rateLimit(userId) {
  if (activeRuns.has(userId)) return 'A run is already in progress';
  const shared = await upstashLimit(userId);
  if (shared !== undefined) return shared;
  return checkRateLimit(userId);
}

async function dailyLimit(userId) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabaseAdmin
    .from('execution_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  return (count ?? 0) >= QUOTA.runsPerDay ? `You've reached ${QUOTA.runsPerDay} runs in 24 hours. Try again later.` : null;
}

// Shared validation for runs and test runs. Returns { error, status } or the parsed request.
async function parseRun(req) {
  const { source_code, language_id, stdin, workspace_id, file_id, args, additional_files } = req.body;
  if (!source_code) return { status: 400, error: 'Source code is required' };
  if (!language_id) return { status: 400, error: 'Language ID is required' };
  if (source_code.length > MAX_SOURCE) return { status: 413, error: 'This file is too large to run' };
  if (args && (typeof args !== 'string' || args.length > 1000)) return { status: 400, error: 'Arguments must be under 1000 characters' };
  if (additional_files && (typeof additional_files !== 'string' || additional_files.length > MAX_ZIP)) {
    return { status: 413, error: 'The workspace is too large to send with the run' };
  }
  // Runs are logged against a workspace (and shown to its members) only if you belong to it
  const role = workspace_id ? await getRole(workspace_id, req.user.id) : null;
  if (workspace_id && !role) return { status: 403, error: 'Not a member of this workspace' };
  return { source_code, language_id, stdin, workspace_id: role ? workspace_id : null, file_id: role ? file_id : null, args, additional_files };
}

async function guard(req, res) {
  const limitError = (await rateLimit(req.user.id)) || (await dailyLimit(req.user.id));
  if (limitError) {
    res.status(429).json({ message: limitError });
    return false;
  }
  return true;
}

async function logRun(req, run, output) {
  const { data, error } = await supabaseAdmin.from('execution_logs').insert({
    user_id: req.user.id,
    workspace_id: run.workspace_id,
    file_id: run.file_id,
    language: String(run.language_id),
    source_code: run.source_code.substring(0, 10000), // Limit stored code
    stdin: run.stdin || null,
    stdout: output.stdout?.substring(0, 10000) ?? null,
    stderr: (output.stderr || output.compile_output)?.substring(0, 10000) ?? null,
    status: output.status?.description,
    execution_time: output.time ? parseFloat(output.time) : null,
    memory_used: output.memory,
  }).select('id, created_at').single();
  if (error) return console.error('Failed to log execution:', error.message);

  // Everyone in the workspace sees the run in their history right away
  if (run.workspace_id) {
    broadcastToWorkspace(run.workspace_id, 'run:new', {
      id: data.id,
      created_at: data.created_at,
      file_id: run.file_id,
      user_id: req.user.id,
      user_name: await displayName(req.user.id),
      language: String(run.language_id),
      status: output.status?.description,
      stdout: output.stdout?.substring(0, 10000) ?? null,
      stderr: (output.stderr || output.compile_output)?.substring(0, 10000) ?? null,
      execution_time: output.time ? parseFloat(output.time) : null,
      memory_used: output.memory,
    });
  }
}

export async function runCode(req, res) {
  const run = await parseRun(req);
  if (run.error) return res.status(run.status).json({ message: run.error });
  if (!(await guard(req, res))) return;

  activeRuns.add(req.user.id);
  try {
    const submission = await submitCode(run.source_code, run.language_id, run.stdin, {
      args: run.args,
      additionalFiles: run.additional_files,
    });

    if (!submission || !submission.token) {
      return res.status(500).json({ message: 'Failed to submit code for execution' });
    }

    // Poll for result
    let result = null;
    for (let attempts = 0; attempts < 20; attempts++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await getSubmissionResult(submission.token);
      if (result?.status?.id > 2) break; // Status > 2 means finished (3=Accepted, 4=Wrong Answer, etc.)
    }

    if (!result || !result.status || result.status.id <= 2) {
      return res.status(408).json({ message: 'Execution timed out' });
    }

    const output = decodeResult(result);
    await logRun(req, run, output);
    res.json(output);
  } catch (error) {
    console.error('Compiler error:', error);
    res.status(500).json({ message: error.message || 'Execution failed' });
  } finally {
    activeRuns.delete(req.user.id);
  }
}

// Runs the program once per test case: [{ id, passed, output }]
export async function runTests(req, res) {
  const run = await parseRun(req);
  if (run.error) return res.status(run.status).json({ message: run.error });
  const tests = Array.isArray(req.body.tests) ? req.body.tests : [];
  if (tests.length === 0) return res.status(400).json({ message: 'Add a test case first' });
  if (tests.length > MAX_TESTS) return res.status(400).json({ message: `Up to ${MAX_TESTS} tests run at once` });
  if (!(await guard(req, res))) return;

  activeRuns.add(req.user.id);
  try {
    const outputs = await runBatch(run.source_code, run.language_id, tests.map((t) => String(t.input ?? '')), {
      args: run.args,
      additionalFiles: run.additional_files,
    });
    const results = tests.map((t, i) => {
      const output = outputs[i];
      if (!output) return { id: t.id, passed: false, output: { stderr: 'Timed out', status: { id: -1, description: 'Timed out' } } };
      const ran = output.status?.id === 3;
      return { id: t.id, passed: ran && normalizeOutput(output.stdout) === normalizeOutput(t.expected_output), output };
    });
    const passed = results.filter((r) => r.passed).length;
    if (run.workspace_id) await recordScore(run.workspace_id, passed, results.length);
    await logRun(req, { ...run, stdin: null }, {
      stdout: `${passed}/${results.length} tests passed`,
      status: { description: passed === results.length ? 'Tests passed' : 'Tests failed' },
    });
    res.json({ results });
  } catch (error) {
    console.error('Test run error:', error);
    res.status(500).json({ message: error.message || 'Test run failed' });
  } finally {
    activeRuns.delete(req.user.id);
  }
}
