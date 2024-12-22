import { createLogger } from '../utils/logger.js';

const logger = createLogger('HTTP');

function loggerMiddleware(req, res, next) {
  logger.info(`${req.method} ${req.url}`);
  next();
}

export default loggerMiddleware;