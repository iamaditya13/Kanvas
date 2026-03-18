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

const resolveUser = async (token, { strict }) => {
  if (!token) {
    if (strict) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required');
    }
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    if (strict) {
      throw new AppError(401, 'AUTH_INVALID', 'Invalid or expired access token');
    }
    return null;
  }

  return syncAuthUser(user);
};

const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    req.authToken = token;
    req.user = await resolveUser(token, { strict: true });
    next();
  } catch (error) {
    next(error);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    req.authToken = token;
    req.user = await resolveUser(token, { strict: false });
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireAuth, optionalAuth, extractToken };
