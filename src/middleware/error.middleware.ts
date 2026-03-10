import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ApiError extends Error {
  statusCode?: number;
  code?:       string;
}

/**
 * Central error handler — must be last middleware registered.
 * Sanitizes internal details from production responses.
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error('Unhandled error', {
    message:   err.message,
    code:      err.code,
    status:    statusCode,
    path:      req.path,
    method:    req.method,
    stack:     isProduction ? undefined : err.stack,
  });

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && isProduction
      ? 'An unexpected error occurred. Please try again.'
      : err.message,
    code: err.code,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

/**
 * 404 handler — registered after all routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}
