// GitHub: talking to its API, keeping people's access tokens sealed, and choosing which repo
// files come into a workspace. Needs GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (a GitHub OAuth app).
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';

export const githubReady = () => !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
export const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const BRANCH_RE = /^(?!\/|.*(?:\.\.|\/\/|@\{|\.lock$|\/$))[A-Za-z0-9._\/-]{1,100}$/;

const secretKey = (purpose) => createHash('sha256').update(`devsync-github-${purpose}:${process.env.GITHUB_CLIENT_SECRET}`).digest();

// Tokens are stored encrypted, so a leaked database copy doesn't hand out GitHub access
export function seal(text) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secretKey('token'), iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}
export function unseal(sealed) {
  const [iv, tag, data] = String(sealed).split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', secretKey('token'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

// The sign-in round trip carries who started it and where to return, signed and good for 10 minutes
export function makeState(userId, next) {
  const body = Buffer.from(JSON.stringify({ u: userId, n: next, e: Date.now() + 600_000 })).toString('base64url');
  return `${body}.${createHmac('sha256', secretKey('state')).update(body).digest('base64url')}`;
}
export function readState(state) {
  const [body, sig] = String(state || '').split('.');
  const want = body && createHmac('sha256', secretKey('state')).update(body).digest();
  const got = Buffer.from(sig || '', 'base64url');
  if (!want || got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const s = JSON.parse(Buffer.from(body, 'base64url').toString());
  return s.e > Date.now() ? { userId: s.u, next: s.n } : null;
}

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Call the GitHub API as someone. Errors carry GitHub's status, with its message.
export async function gh(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'DevSync',
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new GitHubError(res.status, data?.message || `GitHub said ${res.status}`);
  return data;
}

// Someone's GitHub token, or a 400 asking them to connect (again, if GitHub revoked it)
export async function tokenOf(userId) {
  const { data } = await supabaseAdmin.from('github_accounts').select('token, login').eq('user_id', userId).maybeSingle();
  if (!data) throw new GitHubError(400, 'Connect your GitHub account first.');
  try {
    return { token: unseal(data.token), login: data.login };
  } catch {
    await supabaseAdmin.from('github_accounts').delete().eq('user_id', userId);
    throw new GitHubError(400, 'Your GitHub connection expired. Connect GitHub again.');
  }
}

// ---------- Which repo files come into a workspace ----------

export const IMPORT_LIMITS = { files: 200, bytes: 2_000_000, fileBytes: 200_000 };
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|out|vendor|__pycache__|\.next|\.nuxt|\.venv|venv|target|coverage|bin|obj)\//;
const SKIP_EXT = new Set(('png jpg jpeg gif webp ico bmp tiff psd svgz pdf zip gz tgz tar 7z rar jar war class exe dll so dylib o a lib '
  + 'woff woff2 ttf otf eot mp3 mp4 m4a mov avi mkv wav ogg webm flac pyc wasm bin dat db sqlite lockb').split(' '));
const SKIP_NAME = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'poetry.lock', 'composer.lock', 'Gemfile.lock', '.DS_Store']);

// From a recursive git tree: the text-looking files to bring in, smallest folders first, within the limits
export function pickFiles(tree) {
  const out = [];
  let bytes = 0;
  const candidates = tree
    .filter((e) => e.type === 'blob' && e.mode !== '120000' && e.size <= IMPORT_LIMITS.fileBytes)
    .filter((e) => {
      const name = e.path.split('/').pop();
      const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
      return !SKIP_DIR.test(e.path) && !SKIP_EXT.has(ext) && !SKIP_NAME.has(name);
    })
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
  for (const e of candidates) {
    if (out.length >= IMPORT_LIMITS.files || bytes + e.size > IMPORT_LIMITS.bytes) break;
    out.push(e);
    bytes += e.size;
  }
  return { picked: out, skipped: tree.filter((e) => e.type === 'blob').length - out.length };
}

const LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', go: 'go', rs: 'rust', rb: 'ruby',
  php: 'php', cs: 'csharp', html: 'html', htm: 'html', css: 'css', json: 'json', md: 'markdown', mmd: 'mermaid', board: 'whiteboard',
};
export const languageOf = (path) => LANG[path.split('/').pop().split('.').pop().toLowerCase()] || 'plaintext';

const RUNNABLE = new Set(['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust', 'ruby', 'php', 'csharp']);
// The workspace's main language: whichever runnable one has the most files
export function mainLanguage(paths) {
  const counts = {};
  for (const p of paths) {
    const l = languageOf(p);
    if (RUNNABLE.has(l)) counts[l] = (counts[l] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'javascript';
}

// Run `fn` over items, a few at a time (GitHub frowns on bursts)
export async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  return out;
}
