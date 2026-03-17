const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { authRoutes } = require('./routes/authRoutes');
const { workspaceRoutes } = require('./routes/workspaceRoutes');
const { boardRoutes, shareRoutes } = require('./routes/boardRoutes');

const corsOptions = {
  origin: env.frontendUrl,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

const createApp = () => {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/boards', boardRoutes);
  app.use('/api/shares', shareRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
    });
  });

  app.use(errorHandler);

  return { app, corsOptions };
};

module.exports = { createApp };
