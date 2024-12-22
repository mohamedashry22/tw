import { createLogger } from '../utils/logger.js';

const logger = createLogger('Error');

function errorMiddleware(err, req, res, next) {
  logger.error(err.message, { stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({
    status,
    message: err.message || 'Internal Server Error',
  });
}

export default errorMiddleware;