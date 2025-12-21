import winston from 'winston';
import * as path from 'path';

const logLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toLowerCase() : 'info';

const format = winston.format.printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${process.pid}] [${label}] ${level.toUpperCase()}: ${message}`;
});

export const getLogger = (label: string) => {
  return winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.label({ label }),
      format
    ),
    transports: [
      new winston.transports.Console()
    ]
  });
};
