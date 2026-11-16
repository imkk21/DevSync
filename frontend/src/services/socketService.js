import { io } from 'socket.io-client';
import { supabase } from '../lib/supabase';

const SOCKET_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(workspaceId) {
    if (this.socket) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
      // Called on every (re)connect, so a refreshed token is always used
      auth: (cb) => {
        supabase.auth.getSession().then(({ data }) => cb({ token: data.session?.access_token }));
      },
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to Socket.io');
      this.socket.emit('join_workspace', { workspaceId });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emitCodeChange(workspaceId, fileId, content) {
    if (this.socket) {
      this.socket.emit('code_change', { workspaceId, fileId, content });
    }
  }

  onCodeUpdate(callback) {
    if (this.socket) {
      this.socket.on('code_update', callback);
    }
  }

  onPresenceUpdate(callback) {
    if (this.socket) {
      this.socket.on('presence_update', callback);
    }
  }
}

export const socketService = new SocketService();
