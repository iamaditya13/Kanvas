const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { syncAuthUser } = require('../services/userService');

const signup = async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new AppError(400, 'SIGNUP_FAILED', error?.message || 'Failed to create user');
  }

  const profile = await syncAuthUser(data.user);
  res.status(201).json({ user: profile });
};

module.exports = {
  signup,
};
