import jwt from 'jsonwebtoken';
import createError from 'http-errors';
import User from '../models/User.js';

function authMiddleware(req, res, next) {
  const { accessToken } = req.cookies;

  if (!accessToken) {
    return next(createError(401, 'Access token not found'));
  }

  jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET, async (err, payload) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return next(createError(401, 'Access token expired'));
      } else {
        return next(createError(401, 'Invalid access token'));
      }
    }

    const user = await User.findByPk(payload.userId);
    if (!user) {
      return next(createError(401, 'User not found'));
    }

    req.user = { id: payload.userId, role: user.role };
    next();
  });
}

export default authMiddleware;