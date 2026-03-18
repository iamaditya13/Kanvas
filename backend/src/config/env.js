const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envRoot = path.resolve(__dirname, '../../');
const envFiles = ['.env', '.env.local'];

for (const file of envFiles) {
  const fullPath = path.join(envRoot, file);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath, override: file === '.env.local' });
  }
}

const missing = [];

if (!process.env.SUPABASE_URL) {
  missing.push('SUPABASE_URL');
}

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseKey) {
  missing.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY for local development)');
}

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Create backend/.env from backend/.env.example and set real values.`,
  );
}

if (process.env.NODE_ENV === 'production' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production.');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey,
};
