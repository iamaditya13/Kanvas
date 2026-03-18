const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');

const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase };
