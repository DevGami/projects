import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';
import { env } from '../config/env.js';

// ── Error Response Type ─────────────────────────────────────────────────────
interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

// ── Global Error Handler ────────────────────────────────────────────────────
export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Something went wrong on the server.';

  // Log the error
  if (statusCode >= 500) {
    logger.error(`[${code}] ${message}`, {
      stack: err.stack,
      statusCode,
    });
  } else {
    logger.warn(`[${code}] ${message}`, { statusCode });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      // Only include stack trace in development
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

// ── 404 Not Found Handler ───────────────────────────────────────────────────
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}

// ── Custom Error Class ──────────────────────────────────────────────────────
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'APP_ERROR';
    Error.captureStackTrace(this, this.constructor);
  }
}
