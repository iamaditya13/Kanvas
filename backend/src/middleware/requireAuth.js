const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { syncAuthUser } = require('../services/userService');

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required');
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AppError(401, 'AUTH_INVALID', 'Invalid or expired access token');
    }

    req.authToken = token;
    req.user = await syncAuthUser(user);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireAuth, extractToken };
