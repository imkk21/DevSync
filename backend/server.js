import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import workspaceRoutes from './routes/workspaces.js';
import compilerRoutes from './routes/compiler.js';
import { supabaseAdmin } from './config/supabase.js';

import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DevSync API',
    timestamp: new Date().toISOString(),
  });
});

// Socket.io logic
const workspaceUsers = new Map(); // workspaceId -> Map(socketId -> user)

// One entry per user, even if they have several tabs open
function broadcastPresence(workspaceId) {
  const sockets = workspaceUsers.get(workspaceId);
  const users = [...new Map([...sockets.values()].map((u) => [u.id, u])).values()];
  io.to(workspaceId).emit('presence_update', users);
}

// Verify the Supabase JWT before accepting any socket
io.use(async (socket, next) => {
  const { data: { user } = {}, error } = await supabaseAdmin.auth.getUser(socket.handshake.auth?.token);
  if (error || !user) return next(new Error('Unauthorized'));
  socket.data.user = user;
  socket.data.roles = {}; // workspaceId -> role, set on join
  next();
});

io.on('connection', (socket) => {
  console.log('📱 User connected:', socket.id);

  socket.on('join_workspace', async ({ workspaceId }) => {
    const authUser = socket.data.user;

    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('role, profiles(display_name, email)')
      .eq('workspace_id', workspaceId)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (!member) return socket.emit('join_error', 'Not a member of this workspace');

    socket.data.roles[workspaceId] = member.role;
    socket.join(workspaceId);

    // Presence identity comes from the DB, not the client
    const user = {
      id: authUser.id,
      display_name: member.profiles?.display_name || authUser.email,
      email: member.profiles?.email || authUser.email,
    };

    if (!workspaceUsers.has(workspaceId)) {
      workspaceUsers.set(workspaceId, new Map());
    }
    workspaceUsers.get(workspaceId).set(socket.id, user);

    broadcastPresence(workspaceId);

    console.log(`👤 ${user.display_name} joined workspace ${workspaceId}`);
  });

  socket.on('code_change', ({ workspaceId, fileId, content }) => {
    const role = socket.data.roles[workspaceId];
    if (!role || role === 'viewer') return;
    // Broadcast to everyone else in the room
    socket.to(workspaceId).emit('code_update', { fileId, content, userId: socket.data.user.id });
  });

  socket.on('disconnecting', () => {
    // Remove user from all rooms they were in
    for (const workspaceId of socket.rooms) {
      if (workspaceUsers.has(workspaceId)) {
        workspaceUsers.get(workspaceId).delete(socket.id);
        broadcastPresence(workspaceId);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('📱 User disconnected:', socket.id);
  });
});

// Routes
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/compiler', compilerRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     🚀 DevSync API Server + Socket    ║
  ║     Running on port ${PORT}            ║
  ║     http://localhost:${PORT}           ║
  ╚══════════════════════════════════════╝
  `);
});
