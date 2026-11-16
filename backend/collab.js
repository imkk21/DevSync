// Real-time collaboration over Socket.io.
// Every open file has one Y.Doc here; clients sync against it, so concurrent edits merge
// instead of overwriting. The doc is saved to `files.content` (plain text, what everything
// else reads) and `file_states.state` (the Yjs history, so reconnecting clients merge cleanly).
import * as Y from 'yjs';
import { supabaseAdmin } from './config/supabase.js';

const SAVE_DELAY = 1500; // ms of quiet before saving
const SAVE_MAX_WAIT = 10_000; // never let edits go unsaved for longer than this
const UNLOAD_DELAY = 30_000; // keep a doc in memory this long after its last viewer leaves
const SNAPSHOT_EVERY = 10 * 60_000; // automatic history entries at most this often per file
export const MAX_CHARS = 1_000_000; // same limit as the files_content_size constraint

let io;
const workspaceUsers = new Map(); // workspaceId -> Map(socketId -> { id, display_name, email, avatar_url, fileId })
const docs = new Map(); // fileId -> entry (see loadDoc)
const drivers = new Map(); // workspaceId -> userId: in pair mode only the driver can type

const fileRoom = (fileId) => `file:${fileId}`;
const canEdit = (role) => role === 'owner' || role === 'editor';
const toBase64 = (u8) => Buffer.from(u8).toString('base64');
const toU8 = (data) => (data instanceof Uint8Array ? data : new Uint8Array(data));

// ---------- Presence ----------

function broadcastPresence(workspaceId) {
  const sockets = workspaceUsers.get(workspaceId);
  if (!sockets) return;
  // One entry per user even with several tabs open; the latest tab wins
  const users = [...new Map([...sockets.values()].map((u) => [u.id, u])).values()];
  io.to(workspaceId).emit('presence_update', users);
}

// ---------- Docs ----------

function getDoc(fileId, workspaceId) {
  let entry = docs.get(fileId);
  if (!entry) {
    entry = { workspaceId, cursors: new Map(), editors: new Set(), lastSnapshot: 0 };
    docs.set(fileId, entry);
    entry.loading = loadDoc(fileId, entry);
    entry.loading.catch(() => docs.get(fileId) === entry && docs.delete(fileId));
  }
  if (entry.workspaceId !== workspaceId) return Promise.reject(new Error('File not found'));
  clearTimeout(entry.unloadTimer);
  return entry.loading.then(() => entry);
}

async function loadDoc(fileId, entry) {
  const { workspaceId } = entry;
  const [{ data: file, error }, { data: state }, { count: recorded }] = await Promise.all([
    supabaseAdmin.from('files').select('content, workspace_id, is_folder').eq('id', fileId).maybeSingle(),
    supabaseAdmin.from('file_states').select('state').eq('file_id', fileId).maybeSingle(),
    supabaseAdmin.from('doc_updates').select('id', { count: 'exact', head: true }).eq('file_id', fileId),
  ]);
  if (error) throw error;
  if (!file || file.is_folder || file.workspace_id !== workspaceId) throw new Error('File not found');

  const doc = new Y.Doc();
  const text = doc.getText('content');
  const content = (file.content || '').replace(/\r\n/g, '\n');

  if (state?.state) Y.applyUpdate(doc, Buffer.from(state.state, 'base64'));
  // Replay: record from here on, or from the very start if this file has no recording yet
  const recordedSV = recorded ? Y.encodeStateVector(doc) : undefined;

  // No saved history, or the text was replaced outside the editor (a new file, a restore):
  // start a fresh history from the text and save it, so every client shares one lineage.
  const fresh = text.toString() !== content;
  if (fresh) {
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, content);
    });
  }

  Object.assign(entry, {
    doc, text, version: 0, savedVersion: 0, saving: Promise.resolve(),
    recordedSV, recordedVersion: recorded && !fresh ? 0 : -1,
  });
  doc.on('update', (update, origin) => {
    entry.version++;
    scheduleSave(fileId, entry);
    // Client updates are relayed by the doc:update handler; server-made ones are sent here
    if (origin === 'server') io.to(fileRoom(fileId)).emit('doc:update', { fileId, update });
  });
  if (fresh || !state) await save(fileId, entry, true);
  snapshot(fileId, entry).catch((err) => console.error(`Snapshot failed for ${fileId}:`, err.message)); // baseline, so history always has the text from before this session
}

function scheduleSave(fileId, entry) {
  clearTimeout(entry.saveTimer);
  entry.firstUnsavedAt ??= Date.now();
  const wait = Math.max(0, Math.min(SAVE_DELAY, entry.firstUnsavedAt + SAVE_MAX_WAIT - Date.now()));
  entry.saveTimer = setTimeout(() => save(fileId, entry), wait);
}

// Saves are chained so two never race; each records the version it wrote.
function save(fileId, entry, force = false) {
  clearTimeout(entry.saveTimer);
  entry.firstUnsavedAt = null;
  entry.saving = entry.saving.then(async () => {
    const version = entry.version;
    if (version === entry.savedVersion && !force) return;
    const updated_at = new Date().toISOString();
    const [files, states] = await Promise.all([
      supabaseAdmin.from('files').update({ content: entry.text.toString(), updated_at }).eq('id', fileId).select('id'),
      supabaseAdmin.from('file_states').upsert({ file_id: fileId, state: toBase64(Y.encodeStateAsUpdate(entry.doc)), updated_at }),
    ]);
    if (files.error || states.error || files.data?.length === 0) {
      // The file was deleted (or the DB is unreachable): drop the doc so the next open reloads it
      console.error(`Save failed for ${fileId}:`, files.error?.message || states.error?.message || 'file is gone');
      if (files.data?.length === 0) unload(fileId, entry, true);
      return;
    }
    entry.savedVersion = version;
    io.to(fileRoom(fileId)).emit('doc:saved', { fileId, version, updated_at });
    await Promise.all([record(fileId, entry), snapshot(fileId, entry)]);
  }).catch((err) => console.error(`Save failed for ${fileId}:`, err.message));
  return entry.saving;
}

// Session replay: everything that changed since the last recording, plus who typed it.
// ponytail: kept forever; prune old rows (or merge them with Y.mergeUpdates) if storage grows.
async function record(fileId, entry) {
  if (entry.version === entry.recordedVersion) return;
  entry.recordedVersion = entry.version;
  const data = toBase64(Y.encodeStateAsUpdate(entry.doc, entry.recordedSV));
  entry.recordedSV = Y.encodeStateVector(entry.doc);
  const user_ids = [...entry.editors];
  entry.editors.clear();
  const { error } = await supabaseAdmin.from('doc_updates').insert({ file_id: fileId, workspace_id: entry.workspaceId, data, user_ids });
  if (error) console.error(`Replay record failed for ${fileId}:`, error.message);
}

// A history entry: automatic ones at most every SNAPSHOT_EVERY and only when the text changed,
// named ones (label) always.
async function snapshot(fileId, entry, { label = null, userId = entry.lastEditor ?? null, force = false } = {}) {
  if (!force && Date.now() - entry.lastSnapshot < SNAPSHOT_EVERY) return;
  entry.lastSnapshot = Date.now();
  const content = entry.text.toString();
  if (!label) {
    const { data: last } = await supabaseAdmin
      .from('file_versions').select('content').eq('file_id', fileId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (last?.content === content) return;
  }
  const { error } = await supabaseAdmin.from('file_versions').insert({
    file_id: fileId, workspace_id: entry.workspaceId, content, label, created_by: userId,
  });
  if (error) console.error(`Snapshot failed for ${fileId}:`, error.message);
}

// Named history entry for a file (checkpoints, "before restore")
export async function createVersion(fileId, workspaceId, { label, userId }) {
  const entry = await getDoc(fileId, workspaceId);
  await entry.saving;
  await snapshot(fileId, entry, { label, userId, force: true });
  if (!io.sockets.adapter.rooms.get(fileRoom(fileId))?.size) unload(fileId, entry);
}

function unload(fileId, entry, now = false) {
  clearTimeout(entry.unloadTimer);
  const go = async () => {
    if (io.sockets.adapter.rooms.get(fileRoom(fileId))?.size && !now) return;
    try { await entry.loading; } catch { return; }
    if (!now) await save(fileId, entry);
    if (docs.get(fileId) !== entry) return;
    entry.doc?.destroy();
    docs.delete(fileId);
  };
  if (now) go();
  else entry.unloadTimer = setTimeout(go, UNLOAD_DELAY);
}

function leaveFile(socket, fileId) {
  socket.leave(fileRoom(fileId));
  const entry = docs.get(fileId);
  if (!entry) return;
  if (entry.cursors.delete(socket.id)) {
    io.to(fileRoom(fileId)).emit('cursor:remove', { fileId, socketId: socket.id });
  }
  if (!io.sockets.adapter.rooms.get(fileRoom(fileId))?.size) unload(fileId, entry);
}

// Replace a file's whole text (restoring a version, applying a template). Goes through the
// doc when it's loaded, so open editors update live instead of being overwritten later.
export async function replaceFileContent(fileId, workspaceId, content) {
  const entry = await getDoc(fileId, workspaceId);
  entry.doc.transact(() => {
    entry.text.delete(0, entry.text.length);
    entry.text.insert(0, content.replace(/\r\n/g, '\n'));
  }, 'server');
  await save(fileId, entry);
  if (!io.sockets.adapter.rooms.get(fileRoom(fileId))?.size) unload(fileId, entry);
}

// Latest text of a file: from memory when someone has it open, otherwise `saved` (if given) or the DB.
export async function readFileContent(fileId, saved) {
  const entry = docs.get(fileId);
  if (entry?.text) return entry.text.toString();
  if (saved !== undefined) return saved ?? '';
  const { data } = await supabaseAdmin.from('files').select('content').eq('id', fileId).maybeSingle();
  return data?.content ?? '';
}

// ---------- Membership changes made through the REST API ----------

async function socketsOf(workspaceId, userId) {
  return (await io.in(workspaceId).fetchSockets()).filter((s) => s.data.user.id === userId);
}

export async function onRoleChanged(workspaceId, userId, role) {
  for (const s of await socketsOf(workspaceId, userId)) {
    s.data.roles[workspaceId] = role;
    s.emit('role_changed', { workspaceId, role });
  }
}

export async function onMemberRemoved(workspaceId, userId) {
  for (const remote of await socketsOf(workspaceId, userId)) {
    const socket = io.sockets.sockets.get(remote.id);
    if (!socket) continue;
    socket.emit('workspace_removed', { workspaceId });
    for (const room of [...socket.rooms]) {
      if (room.startsWith('file:') && docs.get(room.slice(5))?.workspaceId === workspaceId) leaveFile(socket, room.slice(5));
    }
    socket.leave(workspaceId);
    delete socket.data.roles[workspaceId];
    workspaceUsers.get(workspaceId)?.delete(socket.id);
  }
  broadcastPresence(workspaceId);
}

export function broadcastToWorkspace(workspaceId, event, payload) {
  io?.to(workspaceId).emit(event, payload);
}

function setDriver(workspaceId, userId) {
  if (userId) drivers.set(workspaceId, userId);
  else drivers.delete(workspaceId);
  io.to(workspaceId).emit('driver', { workspaceId, userId: userId || null });
}

// ---------- Socket wiring ----------

export function initCollab(server) {
  io = server;

  // Verify the Supabase JWT before accepting any socket
  io.use(async (socket, next) => {
    const { data: { user } = {}, error } = await supabaseAdmin.auth.getUser(socket.handshake.auth?.token);
    if (error || !user) return next(new Error('Unauthorized'));
    socket.data.user = user;
    socket.data.roles = {}; // workspaceId -> role, set on join
    next();
  });

  io.on('connection', (socket) => {
    const authUser = socket.data.user;
    // Every handler replies through `ack` when the client passed one
    const reply = (ack, payload) => typeof ack === 'function' && ack(payload);

    socket.on('join_workspace', async ({ workspaceId } = {}, ack) => {
      const { data: member } = await supabaseAdmin
        .from('workspace_members')
        .select('role, profiles(display_name, email, avatar_url)')
        .eq('workspace_id', workspaceId)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!member) return reply(ack, { error: 'Not a member of this workspace' });

      socket.data.roles[workspaceId] = member.role;
      socket.join(workspaceId);

      // Presence identity comes from the DB, not the client
      if (!workspaceUsers.has(workspaceId)) workspaceUsers.set(workspaceId, new Map());
      workspaceUsers.get(workspaceId).set(socket.id, {
        id: authUser.id,
        display_name: member.profiles?.display_name || authUser.email,
        email: member.profiles?.email || authUser.email,
        avatar_url: member.profiles?.avatar_url || null,
        fileId: null,
      });
      broadcastPresence(workspaceId);
      reply(ack, { role: member.role, driver: drivers.get(workspaceId) ?? null });
    });

    // Which file this person is looking at (drives "who's where" and follow mode)
    socket.on('presence:file', ({ workspaceId, fileId } = {}) => {
      const me = workspaceUsers.get(workspaceId)?.get(socket.id);
      if (!me) return;
      me.fileId = fileId || null;
      broadcastPresence(workspaceId);
    });

    // Sync step: the client sends its state vector, gets back what it's missing
    // plus the server's state vector, then sends what the server is missing as a normal update.
    socket.on('doc:join', async ({ workspaceId, fileId, sv } = {}, ack) => {
      if (!socket.data.roles[workspaceId]) return reply(ack, { error: 'Not a member of this workspace' });
      try {
        const entry = await getDoc(fileId, workspaceId);
        socket.join(fileRoom(fileId));
        reply(ack, {
          update: Y.encodeStateAsUpdate(entry.doc, sv ? toU8(sv) : undefined),
          sv: Y.encodeStateVector(entry.doc),
          version: entry.version,
          savedVersion: entry.savedVersion,
          cursors: [...entry.cursors.entries()].map(([socketId, c]) => ({ socketId, ...c })),
        });
      } catch (err) {
        reply(ack, { error: err.message });
      }
    });

    socket.on('doc:leave', ({ fileId } = {}) => leaveFile(socket, fileId));

    socket.on('doc:update', ({ fileId, update } = {}, ack) => {
      const entry = docs.get(fileId);
      if (!entry?.doc || !socket.rooms.has(fileRoom(fileId))) return reply(ack, { error: 'File not open' });
      if (!canEdit(socket.data.roles[entry.workspaceId])) return reply(ack, { error: 'You can only view this workspace' });
      const driver = drivers.get(entry.workspaceId);
      if (driver && driver !== authUser.id) return reply(ack, { error: 'Only the driver can type right now' });
      const bytes = toU8(update);
      // ponytail: update size approximates the characters it adds
      if (entry.text.length + bytes.byteLength > MAX_CHARS) return reply(ack, { error: 'This file has reached the 1 MB limit' });
      try {
        Y.applyUpdate(entry.doc, bytes, socket.id);
      } catch {
        return reply(ack, { error: 'Invalid update' });
      }
      entry.editors.add(authUser.id);
      entry.lastEditor = authUser.id;
      socket.to(fileRoom(fileId)).emit('doc:update', { fileId, update });
      reply(ack, { version: entry.version });
    });

    socket.on('doc:save', async ({ fileId } = {}, ack) => {
      const entry = docs.get(fileId);
      if (!entry?.doc || !socket.rooms.has(fileRoom(fileId))) return reply(ack, { error: 'File not open' });
      await save(fileId, entry);
      reply(ack, { savedVersion: entry.savedVersion });
    });

    // Cursor positions are Yjs relative positions (JSON), so they survive concurrent edits
    socket.on('cursor', ({ fileId, anchor, head } = {}) => {
      const entry = docs.get(fileId);
      if (!entry || !socket.rooms.has(fileRoom(fileId))) return;
      const user = workspaceUsers.get(entry.workspaceId)?.get(socket.id);
      if (!user || JSON.stringify([anchor, head]).length > 1000) return;
      const cursor = { user: { id: user.id, display_name: user.display_name }, anchor, head };
      entry.cursors.set(socket.id, cursor);
      socket.to(fileRoom(fileId)).emit('cursor', { fileId, socketId: socket.id, ...cursor });
    });

    // Pair mode: `userId` drives, everyone else watches. Editors can take the wheel themselves;
    // the owner can hand it to anyone. A null userId ends pair mode.
    socket.on('driver:set', ({ workspaceId, userId = null } = {}, ack) => {
      const role = socket.data.roles[workspaceId];
      if (!canEdit(role)) return reply(ack, { error: 'Only editors can drive' });
      if (userId && userId !== authUser.id && role !== 'owner') return reply(ack, { error: 'Only the owner can hand over the wheel' });
      const current = drivers.get(workspaceId);
      if (!userId && current && current !== authUser.id && role !== 'owner') return reply(ack, { error: 'Only the driver or the owner can end pair mode' });
      setDriver(workspaceId, userId);
      reply(ack, { ok: true });
    });

    socket.on('disconnecting', () => {
      for (const room of [...socket.rooms]) {
        if (room.startsWith('file:')) leaveFile(socket, room.slice(5));
        const users = workspaceUsers.get(room);
        if (!users?.delete(socket.id)) continue;
        broadcastPresence(room);
        // The driver closed every tab: give everyone the keyboard back
        const stillHere = [...users.values()].some((u) => u.id === authUser.id);
        if (drivers.get(room) === authUser.id && !stillHere) setDriver(room, null);
      }
    });
  });
}
