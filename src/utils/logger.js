import { createLogger, format, transports } from 'winston';

function createCustomLogger(serviceName) {
  return createLogger({
    level: 'info',
    format: format.combine(
      format.label({ label: serviceName }),
      format.timestamp(),
      format.printf(({ timestamp, level, message, label }) => {
        return `${timestamp} [${label}] ${level}: ${message}`;
      })
    ),
    transports: [new transports.Console()],
  });
}

export { createCustomLogger as createLogger };