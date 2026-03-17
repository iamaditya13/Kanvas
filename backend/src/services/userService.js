const { supabase } = require('../lib/supabase');

const buildDisplayName = (user) =>
  user.user_metadata?.full_name ||
  user.user_metadata?.name ||
  user.email?.split('@')[0] ||
  'Member';

const syncAuthUser = async (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    display_name: buildDisplayName(user),
    avatar_url: user.user_metadata?.avatar_url || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('users').upsert([payload]);

  if (error) {
    console.error('Failed to sync user profile', error);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: payload.display_name,
    avatarUrl: payload.avatar_url,
  };
};

module.exports = {
  buildDisplayName,
  syncAuthUser,
};
