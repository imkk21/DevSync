// End-to-end check of real-time collaboration: the real server module (collab.js) and the
// real client (frontend/src/lib/collab.js) over real sockets, with Supabase faked in memory.
// Run: node collab.check.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from '../frontend/node_modules/socket.io-client/build/esm/index.js';
import { supabaseAdmin } from './config/supabase.js';
import * as Y from 'yjs';
import { initCollab, replaceFileContent, createVersion } from './collab.js';
import { CollabClient } from '../frontend/src/lib/collab.js';

// ---------- Fake Supabase (only the calls collab.js makes) ----------
const db = {
  files: [{ id: 'f1', workspace_id: 'w1', content: 'hello', is_folder: false }],
  file_states: [],
  doc_updates: [],
  file_versions: [],
  workspace_members: [
    { workspace_id: 'w1', user_id: 'alice', role: 'owner' },
    { workspace_id: 'w1', user_id: 'bob', role: 'editor' },
    { workspace_id: 'w1', user_id: 'carol', role: 'viewer' },
  ],
};
function query(table) {
  const filters = [];
  let op = 'select';
  let values;
  let head = false;
  let sort = null;
  const rows = () => {
    const out = db[table].filter((r) => filters.every(([k, v]) => r[k] === v));
    return sort ? out.sort((x, y) => (x[sort.k] < y[sort.k] ? -1 : 1) * (sort.asc ? 1 : -1)) : out;
  };
  const q = {
    select: (_cols, opts) => ((head = !!opts?.head), q),
    eq: (k, v) => (filters.push([k, v]), q),
    order: (k, { ascending = true } = {}) => ((sort = { k, asc: ascending }), q),
    limit: () => q,
    insert: async (v) => {
      for (const r of [].concat(v)) db[table].push({ ...r, created_at: `${Date.now()}-${db[table].length}`.padStart(20, '0') });
      return { error: null };
    },
    update: (v) => ((op = 'update'), (values = v), q),
    maybeSingle: async () => {
      const r = rows()[0];
      return { data: r && { ...r, profiles: { display_name: r.user_id, email: `${r.user_id}@x.dev` } }, error: null };
    },
    upsert: async (v) => {
      db[table] = db[table].filter((r) => r.file_id !== v.file_id).concat(v);
      return { error: null };
    },
    then: (resolve) => {
      const matched = rows();
      if (head) return resolve({ count: matched.length, error: null });
      if (op === 'update') matched.forEach((r) => Object.assign(r, values));
      resolve({ data: matched, error: null });
    },
  };
  return q;
}
supabaseAdmin.from = query;
supabaseAdmin.auth.getUser = async (token) => (token ? { data: { user: { id: token, email: `${token}@x.dev` } }, error: null } : { data: {}, error: new Error('no') });

// ---------- Helpers ----------
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, what, ms = 4000) {
  for (const end = Date.now() + ms; Date.now() < end; await delay(20)) if (check()) return;
  assert.fail(`timed out waiting for: ${what}`);
}

let port;
function startServer() {
  const http = createServer();
  const io = new Server(http);
  initCollab(io);
  return new Promise((resolve) => http.listen(port ?? 0, () => {
    port = http.address().port;
    resolve({ io, http });
  }));
}

function client(user) {
  const socket = connect(`http://localhost:${port}`, { auth: { token: user }, transports: ['websocket'], reconnectionDelay: 50, reconnectionDelayMax: 100 });
  const state = { status: {}, connection: null };
  const collab = new CollabClient(socket, 'w1', {
    onConnection: (c) => (state.connection = c),
    onFileStatus: (id, s) => (state.status[id] = s),
  });
  return { socket, collab, state, file: () => collab.open('f1') };
}

// ---------- Scenarios ----------
let server = await startServer();
const a = client('alice');
const b = client('bob');
const c = client('carol');
const [fa, fb, fc] = [a.file(), b.file(), c.file()];
await Promise.all([fa.ready, fb.ready, fc.ready]);
assert.equal(fa.text.toString(), 'hello');
assert.equal(fb.text.toString(), 'hello');
console.log('ok  everyone loads the saved text');

// Concurrent edits from two people merge instead of overwriting
fa.doc.transact(() => fa.text.insert(0, 'X'), 'local');
fb.doc.transact(() => fb.text.insert(5, 'Y'), 'local');
await until(() => fa.text.toString() === 'XhelloY' && fb.text.toString() === 'XhelloY' && fc.text.toString() === 'XhelloY', 'merge');
console.log('ok  simultaneous edits merge for everyone');

// Unsaved until the server writes it, then saved
assert.equal(fa.status, 'unsaved');
await until(() => db.files[0].content === 'XhelloY', 'autosave to db');
await until(() => fa.status === 'saved' && fb.status === 'saved', 'saved status');
assert.ok(db.file_states[0]?.state, 'Yjs history saved');
console.log('ok  autosave writes the text and history; status goes unsaved -> saved');

// Viewers can't change anything
fc.doc.transact(() => fc.text.insert(0, 'HACK'), 'local');
await delay(300);
assert.equal(fa.text.toString(), 'XhelloY');
console.log('ok  viewer edits are rejected by the server');

// Cursors are shared as relative positions and survive edits before them
fa.setCursor(3, 3);
await until(() => fb.resolveCursors().length === 1, 'cursor arrives');
assert.equal(fb.resolveCursors()[0].head, 3);
assert.equal(fb.resolveCursors()[0].user.id, 'alice');
fb.doc.transact(() => fb.text.insert(0, '__'), 'local');
await until(() => fb.resolveCursors()[0].head === 5, 'cursor shifts with text');
console.log('ok  remote cursors arrive and move with the text');

// Offline edits sync on reconnect
b.socket.disconnect();
await until(() => b.state.connection === 'offline', 'b offline');
fb.doc.transact(() => fb.text.insert(fb.text.length, '!'), 'local');
assert.equal(fb.status, 'unsaved');
b.socket.connect();
await until(() => fa.text.toString().endsWith('!'), 'offline edit reaches alice');
assert.equal(fa.text.toString(), fb.text.toString());
console.log('ok  edits made offline sync after reconnecting');

// A server restart reloads the saved history, so reconnecting clients don't duplicate text
await until(() => fa.status === 'saved' && fb.status === 'saved', 'saved before restart');
const before = fa.text.toString();
server.io.close();
server.http.close();
await until(() => a.state.connection === 'offline', 'a sees restart');
server = await startServer();
await until(() => a.state.connection === 'online' && b.state.connection === 'online', 'reconnect after restart', 8000);
await delay(300);
assert.equal(fa.text.toString(), before);
fa.doc.transact(() => fa.text.insert(0, '>'), 'local');
await until(() => fb.text.toString() === `>${before}`, 'edit after restart');
console.log('ok  server restart: no duplicated text, editing continues');

// Replacing the whole text (restore a version) updates open editors live
// History: a baseline entry from the first load, and named versions on request
assert.equal(db.file_versions[0]?.content, 'hello');
await createVersion('f1', 'w1', { label: 'Before restore', userId: 'alice' });
assert.equal(db.file_versions.at(-1).label, 'Before restore');
assert.equal(db.file_versions.at(-1).content, fa.text.toString());
console.log('ok  history keeps the original text and named versions');

await replaceFileContent('f1', 'w1', 'restored\r\n');
await until(() => fa.text.toString() === 'restored\n' && fb.text.toString() === 'restored\n', 'replace reaches clients');
assert.equal(db.files[0].content, 'restored\n');
console.log('ok  server-side replace updates every open editor');

// Undo only takes back your own edits
fb.doc.transact(() => fb.text.insert(0, 'bob:'), 'local');
await until(() => fa.text.toString().startsWith('bob:'), 'bob edit');
fa.doc.transact(() => fa.text.insert(fa.text.length, ':alice'), 'local');
await until(() => fb.text.toString().endsWith(':alice'), 'alice edit');
fb.undo.undo();
await until(() => fa.text.toString() === 'restored\n:alice', 'undo merges');
console.log('ok  undo only reverts your own changes');

// Pair mode: only the driver's edits are accepted
const request = (s, event, payload) => new Promise((r) => s.timeout(2000).emit(event, payload, (err, res) => r(err ? { error: 'timeout' } : res)));
assert.ok((await request(c.socket, 'driver:set', { workspaceId: 'w1', userId: 'carol' })).error, 'viewer cannot drive');
assert.ok((await request(b.socket, 'driver:set', { workspaceId: 'w1', userId: 'alice' })).error, 'editor cannot hand the wheel to someone else');
assert.deepEqual(await request(a.socket, 'driver:set', { workspaceId: 'w1', userId: 'alice' }), { ok: true });
const beforePair = fa.text.toString();
const refused = fb.doc;
fb.doc.transact(() => fb.text.insert(0, 'NOPE'), 'local');
await delay(300);
assert.equal(fa.text.toString(), beforePair);
// Bob's tab drops the refused edit and goes back to the server's text
await until(() => fb.doc !== refused && fb.synced && fb.text.toString() === beforePair, 'navigator resynced');
assert.ok((await request(b.socket, 'driver:set', { workspaceId: 'w1', userId: null })).error, 'navigator cannot end pair mode');
await request(a.socket, 'driver:set', { workspaceId: 'w1', userId: null });
fa.doc.transact(() => fa.text.insert(0, '#'), 'local');
await until(() => fb.text.toString().includes('#'), 'driver edit after pair mode');
// The refused edit is never resent, even after reconnecting
b.socket.disconnect();
b.socket.connect();
await until(() => b.state.connection === 'online', 'bob back');
await delay(500);
assert.ok(!fa.text.toString().includes('NOPE'), 'refused edit stays refused');
console.log('ok  pair mode: only the driver can type, and only the driver or owner ends it');

// Replay: applying the recorded updates in order rebuilds the saved text
await until(() => fa.status === 'saved', 'saved before replay check');
await delay(100);
const replay = new Y.Doc();
for (const row of db.doc_updates.filter((r) => r.file_id === 'f1')) Y.applyUpdate(replay, Buffer.from(row.data, 'base64'));
assert.equal(replay.getText('content').toString(), db.files[0].content);
assert.ok(db.doc_updates.some((r) => r.user_ids.includes('bob')), 'replay knows who typed');
console.log('ok  replay recording rebuilds the file step by step');

for (const x of [a, b, c]) x.socket.disconnect();
server.io.close();
server.http.close();
console.log('\nAll collaboration checks passed');
process.exit(0);
