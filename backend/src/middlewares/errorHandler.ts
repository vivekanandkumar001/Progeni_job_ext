import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  const status = typeof err === 'object' && err !== null && 'status' in err &&
    typeof err.status === 'number' && err.status >= 400 && err.status < 500
    ? err.status
    : 500;
  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error';
  res.status(status).json({ ok: false, error: message });
}
