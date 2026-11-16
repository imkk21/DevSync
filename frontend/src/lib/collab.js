// Client side of real-time collaboration (server: backend/collab.js).
// One FileSession per open tab holds a Y.Doc that stays in sync with the server's copy.
// No Vite or React imports here, so it runs under Node for tests.
import * as Y from 'yjs';

export const LOCAL = 'local'; // origin of edits typed in this tab
const REMOTE = 'remote'; // origin of edits that came from the server
const TIMEOUT = 10_000;
const CURSOR_THROTTLE = 50;

const toU8 = (data) => (data instanceof Uint8Array ? data : new Uint8Array(data));

// Emit with an acknowledgement; resolves { error } instead of hanging if the socket drops
function request(socket, event, payload) {
  return new Promise((resolve) => {
    socket.timeout(TIMEOUT).emit(event, payload, (err, res) => resolve(err ? { error: 'Connection lost' } : res || {}));
  });
}

export class FileSession {
  constructor(client, fileId) {
    this.client = client;
    this.fileId = fileId;
    this.attach();
    this.cursors = new Map(); // socketId -> { user, anchor, head } (Yjs relative positions as JSON)
    this.authors = new Map(); // Yjs client id -> user id (who wrote which characters)
    this.synced = false;
    this.error = null;
    this.pending = 0; // updates sent but not yet acknowledged
    this.ackedVersion = 0; // server doc version after our latest acknowledged update
    this.savedVersion = 0; // server doc version last written to the database
    this.unsent = false; // local edits made while offline; the next sync sends them
    this.listeners = new Set();
    this.ready = new Promise((resolve) => (this.resolveReady = resolve));
  }

  attach() {
    this.doc = new Y.Doc();
    this.text = this.doc.getText('content');
    this.undo = new Y.UndoManager(this.text, { trackedOrigins: new Set([LOCAL]), captureTimeout: 500 });
    this.doc.on('update', (update, origin) => {
      if (origin !== REMOTE) this.send(update);
    });
    this.text.observe(() => this.emit('text'));
  }

  // The server refused a local edit (view only, pair mode, size limit). Yjs would resend it on
  // every sync, so start over from the server's copy instead. Listeners get 'reset', then 'synced'.
  rebuild() {
    if (this.rebuilding) return;
    this.rebuilding = true;
    const old = this.doc;
    this.undo.destroy();
    this.attach();
    old.destroy();
    this.synced = false;
    this.unsent = false;
    this.emit('reset');
    if (this.client.joined) this.sync();
  }

  get status() {
    if (this.error) return 'error';
    if (!this.synced) return 'loading';
    if (this.unsent || this.pending > 0 || this.ackedVersion > this.savedVersion) return 'unsaved';
    return 'saved';
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type) {
    for (const fn of this.listeners) fn(type, this);
    if (type === 'status') this.client.handlers.onFileStatus?.(this.fileId, this.status);
    if (type === 'text') this.client.handlers.onText?.(this.fileId, this.text.toString());
  }

  send(update) {
    const { socket } = this.client;
    if (!this.synced || !socket.connected) {
      this.unsent = true;
      return this.emit('status');
    }
    this.pending++;
    this.emit('status');
    request(socket, 'doc:update', { fileId: this.fileId, update }).then((res) => {
      this.pending--;
      if (res.error === 'Connection lost' || res.error === 'File not open') {
        this.unsent = true; // resent by the next sync
      } else if (res.error) {
        this.client.handlers.onError?.(res.error);
        this.rebuild();
      }
      else this.ackedVersion = Math.max(this.ackedVersion, res.version);
      this.emit('status');
    });
  }

  // Exchange state vectors with the server: take what we're missing, send what it's missing.
  async sync() {
    const res = await request(this.client.socket, 'doc:join', {
      workspaceId: this.client.workspaceId,
      fileId: this.fileId,
      sv: Y.encodeStateVector(this.doc),
    });
    if (this.destroyed) return;
    if (res.error) {
      // A dropped connection is retried on reconnect; anything else (deleted file, no access) is final
      if (res.error !== 'Connection lost') this.error = res.error;
      return this.emit('status');
    }

    Y.applyUpdate(this.doc, toU8(res.update), REMOTE);
    this.ackedVersion = res.version;
    this.savedVersion = res.savedVersion;
    this.cursors = new Map(res.cursors.map(({ socketId, ...c }) => [socketId, { ...c, at: 0 }]));
    this.authors = new Map(Object.entries(res.authors || {}).map(([client, user]) => [Number(client), user]));
    this.synced = true;
    this.rebuilding = false;
    this.error = null;
    this.emit('synced');

    const missing = Y.encodeStateAsUpdate(this.doc, toU8(res.sv));
    const hadUnsent = this.unsent;
    this.unsent = false;
    // An update with nothing in it is two zero bytes; a delete set alone makes it longer, so also send when we had offline edits
    if (missing.length > 2 || hadUnsent) this.send(missing);

    this.resolveReady();
    this.emit('cursors');
    this.emit('status');
  }

  applyRemote(update) {
    Y.applyUpdate(this.doc, toU8(update), REMOTE);
  }

  async save() {
    if (!this.synced || !this.client.socket.connected) return;
    const res = await request(this.client.socket, 'doc:save', { fileId: this.fileId });
    if (!res.error) this.savedVersion = Math.max(this.savedVersion, res.savedVersion);
    this.emit('status');
  }

  // Indexes into the text; sent as relative positions so they stay put while others type
  setCursor(anchor, head) {
    this.nextCursor = { anchor, head };
    if (this.cursorTimer) return;
    this.cursorTimer = setTimeout(() => {
      this.cursorTimer = null;
      const { socket } = this.client;
      if (!this.synced || !socket.connected || this.destroyed) return;
      const rel = (i) => Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(this.text, i));
      socket.emit('cursor', { fileId: this.fileId, anchor: rel(this.nextCursor.anchor), head: rel(this.nextCursor.head) });
    }, CURSOR_THROTTLE);
  }

  // Remote cursors as absolute indexes: [{ socketId, user, anchor, head, at }]
  resolveCursors() {
    const abs = (json) => Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(json), this.doc)?.index;
    const out = [];
    for (const [socketId, c] of this.cursors) {
      const anchor = abs(c.anchor);
      const head = abs(c.head);
      if (anchor != null && head != null) out.push({ socketId, user: c.user, anchor, head, at: c.at });
    }
    return out;
  }

  // Who wrote each line: the user with the most characters on it, or null. One entry per line.
  lineAuthors() {
    const out = [];
    let counts = new Map();
    const close = () => {
      let best = null;
      let most = 0;
      for (const [user, n] of counts) if (n > most) [best, most] = [user, n];
      out.push(best);
      counts = new Map();
    };
    for (let item = this.text._start; item; item = item.right) {
      if (item.deleted || typeof item.content?.str !== 'string') continue;
      const user = this.authors.get(item.id.client) ?? null;
      item.content.str.split('\n').forEach((part, i) => {
        if (i > 0) close();
        if (part.length && user) counts.set(user, (counts.get(user) || 0) + part.length);
      });
    }
    close();
    return out;
  }

  // A big paste, reported so interviews and classrooms can see it (start/end are text indexes)
  reportPaste(start, end, lines) {
    if (!this.synced || !this.client.socket.connected) return;
    this.client.socket.emit('doc:paste', { fileId: this.fileId, chars: end - start, lines, anchorStart: this.anchorAt(start), anchorEnd: this.anchorAt(end) });
  }

  // Positions that move with the text (comment anchors): index <-> JSON
  anchorAt(index) {
    return Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(this.text, index));
  }

  resolveAnchor(json) {
    if (!json) return null;
    try {
      return Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(json), this.doc)?.index ?? null;
    } catch {
      return null;
    }
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.cursorTimer);
    if (this.client.socket.connected) this.client.socket.emit('doc:leave', { fileId: this.fileId });
    this.listeners.clear();
    this.undo.destroy();
    this.doc.destroy();
  }
}

// One per open workspace. `handlers`: onConnection(status), onJoin({ role, driver } | { error }),
// onPresence(users), onFileStatus(fileId, status), onText(fileId, text), onRoleChanged(role), onRemoved(),
// onDriver(userId), onError(message), onEvent(name, payload) for any other server event
export class CollabClient {
  constructor(socket, workspaceId, handlers = {}) {
    this.socket = socket;
    this.workspaceId = workspaceId;
    this.handlers = handlers;
    this.sessions = new Map();
    this.joined = false;

    socket.on('connect', async () => {
      handlers.onConnection?.('connecting');
      const res = await request(socket, 'join_workspace', { workspaceId });
      if (!socket.connected) return;
      handlers.onJoin?.(res);
      if (res.error) return handlers.onConnection?.('offline');
      this.joined = true;
      handlers.onConnection?.('online');
      for (const s of this.sessions.values()) s.sync();
      if (this.activeFileId !== undefined) this.setActiveFile(this.activeFileId);
    });
    socket.on('disconnect', () => {
      this.joined = false;
      handlers.onConnection?.('offline');
      for (const s of this.sessions.values()) {
        s.cursors.clear();
        s.emit('cursors');
      }
    });
    socket.on('connect_error', () => handlers.onConnection?.('offline'));

    socket.on('presence_update', (users) => handlers.onPresence?.(users));
    socket.on('role_changed', ({ role }) => handlers.onRoleChanged?.(role));
    socket.on('workspace_removed', () => handlers.onRemoved?.());
    socket.on('driver', ({ userId, rotation }) => handlers.onDriver?.(userId, rotation));
    socket.on('doc:authors', ({ fileId, authors }) => {
      const s = this.sessions.get(fileId);
      if (!s) return;
      for (const [client, user] of Object.entries(authors)) s.authors.set(Number(client), user);
      s.emit('authors');
    });
    socket.onAny((event, payload) => handlers.onEvent?.(event, payload));
    socket.on('doc:update', ({ fileId, update }) => this.sessions.get(fileId)?.applyRemote(update));
    socket.on('doc:saved', ({ fileId, version }) => {
      const s = this.sessions.get(fileId);
      if (!s) return;
      s.savedVersion = Math.max(s.savedVersion, version);
      s.emit('status');
    });
    socket.on('cursor', ({ fileId, socketId, user, anchor, head }) => {
      const s = this.sessions.get(fileId);
      if (!s) return;
      s.cursors.set(socketId, { user, anchor, head, at: Date.now() }); // `at`: when it last moved
      s.emit('cursors');
    });
    socket.on('cursor:remove', ({ fileId, socketId }) => {
      const s = this.sessions.get(fileId);
      if (s?.cursors.delete(socketId)) s.emit('cursors');
    });
  }

  open(fileId) {
    let s = this.sessions.get(fileId);
    if (!s) {
      s = new FileSession(this, fileId);
      this.sessions.set(fileId, s);
      if (this.joined) s.sync();
    }
    return s;
  }

  get(fileId) {
    return this.sessions.get(fileId);
  }

  close(fileId) {
    this.sessions.get(fileId)?.destroy();
    this.sessions.delete(fileId);
  }

  setActiveFile(fileId) {
    this.activeFileId = fileId;
    if (this.joined) this.socket.emit('presence:file', { workspaceId: this.workspaceId, fileId });
  }

  // Pair mode: userId drives (null ends it). Resolves { ok } or { error }.
  // Mob mode: you drive now, and the wheel passes on every `minutes`
  rotate(minutes) {
    return request(this.socket, 'driver:rotate', { workspaceId: this.workspaceId, minutes });
  }

  // Ping a line, draw over the code. Everyone else gets { type, data, from } as an 'signal' event.
  signal(type, data) {
    if (this.joined) this.socket.emit('signal', { workspaceId: this.workspaceId, type, data });
  }

  setDriver(userId) {
    return request(this.socket, 'driver:set', { workspaceId: this.workspaceId, userId });
  }

  // Unsaved edits anywhere in the workspace (used to warn before closing the tab)
  hasUnsaved() {
    return [...this.sessions.values()].some((s) => s.status === 'unsaved');
  }

  destroy() {
    for (const id of [...this.sessions.keys()]) this.close(id);
  }
}
