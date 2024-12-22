import winston from 'winston';

export function createLogger(label) {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.label({ label }),
      winston.format.timestamp(),
      winston.format.printf(
        ({ timestamp, level, message, label }) =>
          `${timestamp} [${label}] ${level}: ${message}`
      )
    ),
    transports: [new winston.transports.Console()],
  });
}