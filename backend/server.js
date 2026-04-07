import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import fileRoutes from './routes/files.js';
import compilerRoutes from './routes/compiler.js';

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
const workspaceUsers = new Map(); // workspaceId -> Set of user objects

io.on('connection', (socket) => {
  console.log('📱 User connected:', socket.id);

  socket.on('join_workspace', ({ workspaceId, user }) => {
    socket.join(workspaceId);
    
    // Track user in memory for presence
    if (!workspaceUsers.has(workspaceId)) {
      workspaceUsers.set(workspaceId, new Map());
    }
    workspaceUsers.get(workspaceId).set(socket.id, user);

    // Broadcast updated user list to everyone in the room
    const currentUsers = Array.from(workspaceUsers.get(workspaceId).values());
    io.to(workspaceId).emit('presence_update', currentUsers);
    
    console.log(`👤 ${user.display_name} joined workspace ${workspaceId}`);
  });

  socket.on('code_change', ({ workspaceId, fileId, content, userId }) => {
    // Broadcast to everyone else in the room
    socket.to(workspaceId).emit('code_update', { fileId, content, userId });
  });

  socket.on('disconnecting', () => {
    // Remove user from all rooms they were in
    for (const workspaceId of socket.rooms) {
      if (workspaceUsers.has(workspaceId)) {
        workspaceUsers.get(workspaceId).delete(socket.id);
        
        // Broadcast updated list
        const currentUsers = Array.from(workspaceUsers.get(workspaceId).values());
        io.to(workspaceId).emit('presence_update', currentUsers);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('📱 User disconnected:', socket.id);
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/workspaces', fileRoutes);
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
