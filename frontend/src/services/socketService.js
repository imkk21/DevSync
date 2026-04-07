import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(workspaceId, user) {
    if (this.socket) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to Socket.io');
      this.socket.emit('join_workspace', { workspaceId, user });
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

  emitCodeChange(workspaceId, fileId, content, userId) {
    if (this.socket) {
      this.socket.emit('code_change', { workspaceId, fileId, content, userId });
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
