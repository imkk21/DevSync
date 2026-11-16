// Live test bar: when a file with tests is saved in a workspace that watches tests, run them
// and tell everyone the result, including whose edit broke a test that used to pass.
import { zipSync, strToU8 } from 'fflate';
import { supabaseAdmin } from '../config/supabase.js';
import { saveHooks, readFileContent, broadcastToWorkspace } from '../collab.js';
import { runBatch, normalizeOutput } from './judge0Service.js';

export const JUDGE0_IDS = { javascript: 63, typescript: 74, python: 71, java: 62, c: 50, cpp: 54, go: 60, rust: 73, ruby: 72, php: 68, csharp: 51 };
const DEBOUNCE = 1500;
const MAX_ZIP = 2_000_000;

const watching = new Map(); // workspaceId -> boolean (cached; set when toggled)
const timers = new Map(); // fileId -> debounce timer
const running = new Set(); // fileIds with a run in flight
const lastResults = new Map(); // fileId -> Map(testId -> passed)

export function setWatching(workspaceId, on) {
  watching.set(workspaceId, !!on);
}

async function isWatching(workspaceId) {
  if (!watching.has(workspaceId)) {
    const { data } = await supabaseAdmin.from('workspaces').select('watch_tests').eq('id', workspaceId).maybeSingle();
    watching.set(workspaceId, !!data?.watch_tests);
  }
  return watching.get(workspaceId);
}

// Latest score on the workspace (classroom wall, race leaderboard). The first all-pass time is kept.
export async function recordScore(workspaceId, passed, total) {
  const { data } = await supabaseAdmin.from('workspaces').select('tests_passed_at').eq('id', workspaceId).maybeSingle();
  const patch = { tests_passed: passed, tests_total: total };
  if (total > 0 && passed === total && !data?.tests_passed_at) patch.tests_passed_at = new Date().toISOString();
  await supabaseAdmin.from('workspaces').update(patch).eq('id', workspaceId);
}

// The other files of the workspace, zipped, so imports work
async function otherFiles(workspaceId, exceptId) {
  const { data } = await supabaseAdmin.from('files').select('id, path, is_folder, content').eq('workspace_id', workspaceId);
  const entries = {};
  for (const f of data || []) {
    if (f.is_folder || f.id === exceptId) continue;
    entries[f.path.replace(/^\/+/, '')] = strToU8(await readFileContent(f.id, f.content));
  }
  if (!Object.keys(entries).length) return undefined;
  const zip = zipSync(entries, { level: 6 });
  return zip.length <= MAX_ZIP ? Buffer.from(zip).toString('base64') : undefined;
}

async function run(fileId, workspaceId, editorId) {
  if (running.has(fileId) || !(await isWatching(workspaceId))) return;
  const { data: tests } = await supabaseAdmin.from('test_cases').select('id, input, expected_output').eq('file_id', fileId).order('created_at');
  if (!tests?.length) return;
  const { data: file } = await supabaseAdmin.from('files').select('language').eq('id', fileId).maybeSingle();
  const languageId = JUDGE0_IDS[file?.language];
  if (!languageId) return;

  running.add(fileId);
  try {
    // ponytail: every watched save costs one Judge0 batch; add a per-workspace daily cap if quota runs short
    const outputs = await runBatch(await readFileContent(fileId), languageId, tests.slice(0, 20).map((t) => t.input), {
      additionalFiles: await otherFiles(workspaceId, fileId),
    });
    const results = tests.slice(0, 20).map((t, i) => {
      const output = outputs[i];
      return { id: t.id, passed: !!output && output.status?.id === 3 && normalizeOutput(output.stdout) === normalizeOutput(t.expected_output), output };
    });
    const before = lastResults.get(fileId);
    const broken = results.filter((r) => !r.passed && before?.get(r.id) === true).map((r) => r.id);
    const fixed = before && [...before.values()].some((p) => !p) && results.every((r) => r.passed);
    lastResults.set(fileId, new Map(results.map((r) => [r.id, r.passed])));
    const passed = results.filter((r) => r.passed).length;
    await recordScore(workspaceId, passed, results.length);
    broadcastToWorkspace(workspaceId, 'tests:watch', {
      fileId, results, passed, total: results.length, at: Date.now(),
      broken, brokenBy: broken.length ? editorId : null, fixed: !!fixed, fixedBy: fixed ? editorId : null,
    });
  } catch (err) {
    console.error(`Watched tests failed for ${fileId}:`, err.message);
  } finally {
    running.delete(fileId);
  }
}

saveHooks.add((fileId, workspaceId, editorId) => {
  clearTimeout(timers.get(fileId));
  timers.set(fileId, setTimeout(() => {
    timers.delete(fileId);
    run(fileId, workspaceId, editorId).catch((err) => console.error('Test watch error:', err.message));
  }, DEBOUNCE));
});
