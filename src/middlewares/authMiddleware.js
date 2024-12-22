import jwt from 'jsonwebtoken';
import createError from 'http-errors';

function authMiddleware(req, res, next) {
  const { accessToken } = req.cookies;

  if (!accessToken) {
    return next(createError(401, 'Access token not found'));
  }

  jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET, (err, payload) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return next(createError(401, 'Access token expired'));
      } else {
        return next(createError(401, 'Invalid access token'));
      }
    }

    req.user = { id: payload.userId };
    next();
  });
}

export default authMiddleware;