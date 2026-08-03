import winston from 'winston';
import { env } from '../config/env.js';

// ── Winston Logger ──────────────────────────────────────────────────────────
const { combine, timestamp, printf, colorize, json } = winston.format;

// Dev: colorized, human-readable
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Prod: structured JSON for log aggregation
const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: env.NODE_ENV === 'development' ? devFormat : prodFormat,
  defaultMeta: { service: 'bookyourshow-api' },
  transports: [
    new winston.transports.Console(),
    // In production, add file or cloud transport here
  ],
});
