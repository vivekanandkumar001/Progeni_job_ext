import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { getDatabase } from '../config/mongodb.js';

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'signup'
  | 'logout'
  | 'logout_all'
  | 'token_refresh'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'role_changed'
  | 'status_changed'
  | 'account_deleted'
  | 'extension_paired'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'consent_granted'
  | 'consent_revoked'
  | 'unauthorized_access_attempt';

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: AuditAction;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

const REDACTED_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'cookie',
  'code',
  'otp',
  'key',
  'apikey',
  'clientsecret',
]);

export function sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (REDACTED_KEYS.has(normalizedKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function extractClientIp(req?: Request): string {
  if (!req) return 'unknown';
  const forwarded = req.headers ? req.headers['x-forwarded-for'] : undefined;
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export class AuthAuditService {
  async logEvent(params: {
    userId?: string | null;
    action: AuditAction;
    req?: Request;
    ip?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    const userAgent = params.req?.headers ? (params.req.headers['user-agent'] as string) || null : null;
    const record: AuditLogRecord = {
      id: randomUUID(),
      userId: params.userId || null,
      action: params.action,
      ip: params.ip || extractClientIp(params.req),
      userAgent,
      metadata: params.metadata ? sanitizeMetadata(params.metadata) : {},
      timestamp: new Date().toISOString(),
    };

    try {
      const db = await getDatabase();
      await db.collection('auth_audit_logs').insertOne({
        _id: record.id as any,
        user_id: record.userId,
        action: record.action,
        ip: record.ip,
        user_agent: record.userAgent,
        metadata: record.metadata,
        timestamp: record.timestamp,
      });
    } catch (error) {
      // In disconnected tests or serverless cold starts, suppress db write error
    }

    return record;
  }

  async listLogs(params: {
    userId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogRecord[]> {
    const filter: Record<string, unknown> = {};
    if (params.userId) filter.user_id = params.userId;
    if (params.action) filter.action = params.action;

    const limit = Math.min(params.limit || 50, 100);
    const offset = Math.max(params.offset || 0, 0);

    const db = await getDatabase();
    const rows = await db
      .collection('auth_audit_logs')
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return rows.map((row) => ({
      id: String(row._id),
      userId: (row.user_id as string | null) || null,
      action: row.action as AuditAction,
      ip: (row.ip as string | null) || null,
      userAgent: (row.user_agent as string | null) || null,
      metadata: (row.metadata as Record<string, unknown>) || {},
      timestamp: row.timestamp as string,
    }));
  }
}

export const authAuditService = new AuthAuditService();
