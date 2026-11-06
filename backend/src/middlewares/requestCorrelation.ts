import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export interface CorrelatedRequest extends Request {
  id?: string;
  startTime?: bigint;
}

export function requestCorrelationMiddleware(
  req: CorrelatedRequest,
  res: Response,
  next: NextFunction
): void {
  const headerId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = typeof headerId === 'string' && headerId.trim().length > 0
    ? headerId.trim()
    : crypto.randomUUID();

  req.id = requestId;
  req.startTime = process.hrtime.bigint();

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', requestId);

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = req.startTime
      ? Number(endTime - req.startTime) / 1_000_000
      : 0;

    // Set response time header if headers not yet flushed (finish happens after headers sent, but can be read by loggers)
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Structured enterprise log entry
    if (process.env.NODE_ENV !== 'test') {
      const logFn = status >= 500 ? console.error : status >= 400 ? console.warn : console.log;
      logFn(
        `[HTTP ${status}] ${method} ${url} ${durationMs.toFixed(2)}ms - req_id=${requestId}`
      );
    }
  });

  next();
}

