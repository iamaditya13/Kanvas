const http = require('http');
const env = require('./src/config/env');
const { createApp } = require('./src/app');
const { createCollaborationServer } = require('./src/socket/collaborationServer');
const { assertDatabaseReady } = require('./src/services/schemaService');

const bootstrap = async () => {
  await assertDatabaseReady();

  const { app, corsOptions } = createApp();
  const server = http.createServer(app);

  createCollaborationServer({ httpServer: server, cors: corsOptions });

  server.listen(env.port, () => {
    console.log(`Kanvas backend listening on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start Kanvas backend', error.message);
  process.exit(1);
});
