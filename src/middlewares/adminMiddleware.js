import createError from 'http-errors';

function adminMiddleware(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    next(createError(403, 'Forbidden: Admins only'));
  }
}

export default adminMiddleware;