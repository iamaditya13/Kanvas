const { supabase } = require('../lib/supabase');

const requiredTables = [
  'users',
  'workspaces',
  'workspace_members',
  'boards',
  'elements',
  'comments',
  'activity_logs',
  'board_presence',
];

const migrationPath = 'supabase/migrations/202603170001_realtime_collaboration.sql';

const probeTable = async (table) => {
  const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
  return error || null;
};

const assertDatabaseReady = async () => {
  const missingTables = [];
  const failedChecks = [];

  for (const table of requiredTables) {
    const error = await probeTable(table);
    if (!error) {
      continue;
    }

    if (error.code === 'PGRST205') {
      missingTables.push(table);
      continue;
    }

    failedChecks.push({ table, error });
  }

  if (missingTables.length > 0) {
    const joined = missingTables.join(', ');
    throw new Error(
      `Database schema is incomplete. Missing table(s): ${joined}. ` +
        `Apply migration ${migrationPath} in your Supabase SQL editor and restart the backend.`,
    );
  }

  if (failedChecks.length > 0) {
    const details = failedChecks
      .map(({ table, error }) => `${table}: ${error.code || 'UNKNOWN'} ${error.message || 'no message'}`)
      .join('; ');
    throw new Error(`Database readiness check failed. ${details}`);
  }
};

module.exports = {
  assertDatabaseReady,
};

