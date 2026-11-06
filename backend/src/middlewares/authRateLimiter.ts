import type { Request, Response, NextFunction } from 'express';
import { extractClientIp } from '../services/authAuditService.js';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

interface ClientBucket {
  timestamps: number[];
}

export function createAuthRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, ClientBucket>();
  const { windowMs, max, message } = options;

  // Cleanup expired buckets every 5 minutes to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);
      if (bucket.timestamps.length === 0) {
        buckets.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.keyGenerator ? options.keyGenerator(req) : extractClientIp(req);
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      buckets.set(key, bucket);
    }

    // Retain only timestamps within the current window
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

    if (bucket.timestamps.length >= max) {
      const oldest = bucket.timestamps[0];
      const resetInSeconds = Math.ceil((oldest + windowMs - now) / 1000);

      res.setHeader('Retry-After', resetInSeconds);
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', 0);
      res.setHeader('RateLimit-Reset', Math.ceil((oldest + windowMs) / 1000));

      res.status(429).json({
        ok: false,
        error: message || 'Too many authentication attempts. Please try again later.',
        retryAfter: resetInSeconds,
      });
      return;
    }

    bucket.timestamps.push(now);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', max - bucket.timestamps.length);
    res.setHeader('RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

    next();
  };
}

/** Rate limiter for login & signup attempts: 10 per 15 minutes */
export const loginRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
});

/** Rate limiter for password reset requests: 5 per 30 minutes */
export const passwordResetRateLimiter = createAuthRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please check your inbox or try again in 30 minutes.',
});

/** Rate limiter for extension pairing code generation: 5 per 15 minutes */
export const pairingRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many extension pairing requests. Please wait a few minutes before trying again.',
});

