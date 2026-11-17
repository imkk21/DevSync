// Checks for the outside-service helpers. Run: node integrations.check.mjs
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { liveKitToken, buildCalendar } from './controllers/integrationsController.js';
import { serviceOf } from './services/alerts.js';
import { seal, unseal, makeState, readState, pickFiles, languageOf, mainLanguage, BRANCH_RE } from './services/github.js';

// LiveKit token: a valid HS256 JWT with the room grant
const token = liveKitToken({ key: 'APIkey', secret: 'shh', room: 'workspace-w1', identity: 'u1', name: 'Ada' });
const [head, body, sig] = token.split('.');
assert.equal(sig, createHmac('sha256', 'shh').update(`${head}.${body}`).digest('base64url'), 'signed with the secret');
const claims = JSON.parse(Buffer.from(body, 'base64url'));
assert.equal(claims.iss, 'APIkey');
assert.equal(claims.sub, 'u1');
assert.deepEqual(claims.video, { room: 'workspace-w1', roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
assert.ok(claims.exp > claims.nbf);
console.log('ok  call tokens are signed JWTs for one room');

// Only real Slack/Discord webhooks are accepted
assert.equal(serviceOf('https://hooks.slack.com/services/T000/B000/XXXX'), 'slack');
assert.equal(serviceOf('https://discord.com/api/webhooks/123/abc-DEF_9'), 'discord');
assert.equal(serviceOf('https://hooks.slack.com.evil.dev/services/x'), null);
assert.equal(serviceOf('http://hooks.slack.com/services/x'), null);
assert.equal(serviceOf('https://discord.com/api/webhooks/123/abc/../../x'), null);
assert.equal(serviceOf('https://169.254.169.254/latest'), null);
console.log('ok  only Slack and Discord webhook URLs are accepted');

// Calendar: escaped, CRLF, folded at 75 bytes
const ics = buildCalendar([{
  id: 'e1', title: 'Graphs; BFS, DFS', description: 'Bring\nlaptops', starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T16:00:00Z',
  workspace: 'algorithms', url: `https://devsync.dev/editor/w1?view=events&x=${'y'.repeat(80)}`,
}], { now: new Date('2026-11-17T00:00:00Z') });
assert.ok(ics.includes('SUMMARY:Graphs\\; BFS\\, DFS (algorithms)'));
assert.ok(ics.includes('DESCRIPTION:Bring\\nlaptops'));
assert.ok(ics.includes('DTSTART:20261120T150000Z'));
assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), 'lines fold at 75 bytes');
assert.ok(ics.includes('\r\n '), 'long URL was folded');
assert.ok(!/[^\r]\n/.test(ics), 'CRLF line endings only');
const unfolded = ics.replace(/\r\n /g, '');
assert.ok(unfolded.includes(`x=${'y'.repeat(80)}`), 'folding round-trips');
const emoji = buildCalendar([{ id: 'e2', title: '🎉'.repeat(40), starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T16:00:00Z' }]);
assert.ok(emoji.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), 'never splits inside a character');
assert.ok(emoji.replace(/\r\n /g, '').includes('🎉'.repeat(40)));
console.log('ok  calendar feed is valid iCalendar');

// GitHub: tokens round-trip but are unreadable at rest; sign-in state can't be forged or altered
process.env.GITHUB_CLIENT_SECRET = 'check-secret';
const sealed = seal('gho_secret');
assert.ok(!sealed.includes('gho_secret'));
assert.equal(unseal(sealed), 'gho_secret');
assert.notEqual(seal('gho_secret'), sealed, 'fresh IV each time');
const [iv, tag, data] = sealed.split('.');
const flipped = Buffer.from(data, 'base64url');
flipped[0] ^= 1;
assert.throws(() => unseal([iv, tag, flipped.toString('base64url')].join('.')), 'tampering is detected');
const st = makeState('u1', '/dashboard');
assert.deepEqual(readState(st), { userId: 'u1', next: '/dashboard' });
assert.equal(readState(st.slice(0, -3) + 'abc'), null);
const forged = Buffer.from(JSON.stringify({ u: 'attacker', n: '/', e: Date.now() + 1e6 })).toString('base64url');
assert.equal(readState(`${forged}.${st.split('.')[1]}`), null);
assert.equal(readState('garbage'), null);
console.log('ok  GitHub tokens are sealed and sign-in state is signed');

// Which repo files come in: text files, shallow first, no deps/build/binaries/lock files, within limits
const tree = [
  { path: 'src/app.js', type: 'blob', mode: '100644', size: 10 },
  { path: 'index.html', type: 'blob', mode: '100644', size: 10 },
  { path: 'node_modules/x/index.js', type: 'blob', mode: '100644', size: 10 },
  { path: 'dist/bundle.js', type: 'blob', mode: '100644', size: 10 },
  { path: 'logo.PNG', type: 'blob', mode: '100644', size: 10 },
  { path: 'package-lock.json', type: 'blob', mode: '100644', size: 10 },
  { path: 'link', type: 'blob', mode: '120000', size: 10 },
  { path: 'huge.txt', type: 'blob', mode: '100644', size: 5_000_000 },
  { path: 'src', type: 'tree', mode: '040000' },
];
const { picked, skipped } = pickFiles(tree);
assert.deepEqual(picked.map((e) => e.path), ['index.html', 'src/app.js']);
assert.equal(skipped, 6);
assert.equal(pickFiles(Array.from({ length: 300 }, (_, i) => ({ path: `f${i}.py`, type: 'blob', mode: '100644', size: 1 }))).picked.length, 200);
assert.equal(languageOf('src/App.TSX'), 'typescript');
assert.equal(languageOf('Makefile'), 'plaintext');
assert.equal(mainLanguage(['a.py', 'b.py', 'c.js', 'index.html', 'x.css']), 'python');
assert.ok(BRANCH_RE.test('feature/login-fix') && BRANCH_RE.test('devsync-abc'));
for (const bad of ['../x', '/x', 'a..b', 'a b', 'x.lock', 'x/', 'a//b', '']) assert.ok(!BRANCH_RE.test(bad), bad);
console.log('ok  GitHub import picks the right files');

// GitHub pull: unresolved merge conflicts are spotted before anything is sent
const { CONFLICT_RE } = await import('./controllers/githubController.js');
assert.ok(CONFLICT_RE.test('a\n<<<<<<<\nmine\n=======\ntheirs\n>>>>>>>\nb\n'));
assert.ok(CONFLICT_RE.test('<<<<<<< DevSync\nx\n=======\ny\n>>>>>>> GitHub'));
assert.ok(!CONFLICT_RE.test('const s = "<<<<<<< not at a line start ======= >>>>>>>";'));
assert.ok(!CONFLICT_RE.test('<<<<<<<\nno end marker\n'));
console.log('ok  leftover conflict markers are detected');

// Search: user text is matched literally, lines are found case-insensitively
const { containsPattern, matchingLines } = await import('./controllers/searchController.js');
assert.equal(containsPattern('100%_done\\'), '%100\\%\\_done\\\\%');
assert.deepEqual(matchingLines('def greet():\n  pass\nGREET()\nx\ngreet\ngreet', 'greet'), [
  { line: 1, text: 'def greet():' }, { line: 3, text: 'GREET()' }, { line: 5, text: 'greet' },
]);
console.log('ok  search patterns and matching lines');

console.log('\nAll integration checks passed');
process.exit(0);
