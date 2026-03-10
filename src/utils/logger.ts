import winston from 'winston';
import path from 'path';
import { config } from '../config';
import fs from 'fs';

// Ensure log directory exists
try { fs.mkdirSync(config.logging.logDir, { recursive: true }); } catch (_) {}

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(config.logging.logDir, 'error.log'),
      level:    'error',
      maxsize:  10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(config.logging.logDir, 'combined.log'),
      maxsize:  50 * 1024 * 1024,
      maxFiles: 10,
    }),
  ],
});

// Console output in development
if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(colorize(), simple()),
  }));
}
