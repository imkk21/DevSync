import { io } from 'socket.io-client';
import { supabase } from '../lib/supabase';
import { CollabClient } from '../lib/collab';

const SOCKET_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// One socket per open workspace; `collab` syncs the open files over it.
class SocketService {
  socket = null;
  collab = null;

  // spectator: { token, name } joins read-only through a public link, without an account
  connect(workspaceId, handlers, spectator = null) {
    this.disconnect();
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
      // Called on every (re)connect, so a refreshed token is always used
      auth: spectator
        ? { spectate: spectator.token, name: spectator.name }
        : (cb) => {
          supabase.auth.getSession().then(({ data }) => cb({ token: data.session?.access_token }));
        },
    });
    this.collab = new CollabClient(this.socket, workspaceId, handlers);
    return this.collab;
  }

  disconnect() {
    this.collab?.destroy();
    this.socket?.disconnect();
    this.socket = null;
    this.collab = null;
  }
}

export const socketService = new SocketService();
