require('dotenv').config();
const http = require('http');
const env = require('./src/config/env');
const { createApp } = require('./src/app');
const { createCollaborationServer } = require('./src/socket/collaborationServer');

const { app, corsOptions } = createApp();
const server = http.createServer(app);

createCollaborationServer({ httpServer: server, cors: corsOptions });

server.listen(env.port, () => {
  console.log(`Kanvas backend listening on port ${env.port}`);
});
