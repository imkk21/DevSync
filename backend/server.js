import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import workspaceRoutes from './routes/workspaces.js';
import compilerRoutes from './routes/compiler.js';
import miscRoutes from './routes/misc.js';
import { initCollab } from './collab.js';
import './services/testWatch.js'; // reruns tests on save in workspaces that watch them
import './services/reminders.js'; // event reminders, checked every minute
import { startAlerts } from './services/alerts.js';
import { startPush } from './services/push.js';

import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

// Error reporting, only when a DSN is configured
const Sentry = process.env.SENTRY_DSN ? await import('@sentry/node') : null;
Sentry?.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });

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

initCollab(io);
startAlerts(); // Slack/Discord: finished tasks and new events
startPush(); // phone and desktop notifications for new notifications

// Routes
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/compiler', compilerRoutes);
app.use('/api', miscRoutes);

if (Sentry) Sentry.setupExpressErrorHandler(app);

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
