import { createHmac, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';

export interface SsoClaims {
  sub: string; // Candidate ID
  email: string;
  name: string;
  role: 'candidate';
  app_id: string; // Application UUID
  int_id?: string; // Optional Auto Apply AI interview ID
  iss: 'auto-apply-ai';
  aud: 'progeni-atlas';
  nonce: string;
  iat: number;
  exp: number;
}

export class ProgeniSsoService {
  private getSecret(): string {
    return process.env.PROGENI_JWT_SECRET || env.JWT_SECRET || 'progeni_atlas_enterprise_jwt_secret_key';
  }

  /**
   * Generates a base64url encoded JSON string.
   */
  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Mints an HMAC-SHA256 signed SSO launch ticket token valid for 15 minutes.
   */
  mintLaunchToken(input: {
    candidateId: string;
    email: string;
    name?: string;
    applicationId: string;
    interviewId?: string;
    ttlMinutes?: number;
  }): { token: string; expiresAt: string; ticketId: string } {
    const now = Math.floor(Date.now() / 1000);
    const ttl = (input.ttlMinutes || 15) * 60;
    const exp = now + ttl;
    const ticketId = randomUUID();

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const claims: SsoClaims = {
      sub: input.candidateId,
      email: input.email.trim().toLowerCase(),
      name: input.name || 'Candidate',
      role: 'candidate',
      app_id: input.applicationId,
      int_id: input.interviewId,
      iss: 'auto-apply-ai',
      aud: 'progeni-atlas',
      nonce: ticketId,
      iat: now,
      exp,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(claims));
    const secret = this.getSecret();

    const signature = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const token = `${encodedHeader}.${encodedPayload}.${signature}`;
    const expiresAt = new Date(exp * 1000).toISOString();

    return { token, expiresAt, ticketId };
  }

  /**
   * Verifies and decodes an SSO launch token, checking expiration and cryptographic signature.
   */
  verifyLaunchToken(token: string): { valid: boolean; claims?: SsoClaims; error?: string } {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token missing or invalid format' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed JWT structure' };
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const secret = this.getSecret();

    const expectedSignature = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid token signature' };
    }

    try {
      const claims = JSON.parse(this.base64UrlDecode(encodedPayload)) as SsoClaims;
      const now = Math.floor(Date.now() / 1000);

      if (claims.exp < now) {
        return { valid: false, error: 'Token has expired' };
      }

      if (claims.iss !== 'auto-apply-ai' || claims.aud !== 'progeni-atlas') {
        return { valid: false, error: 'Invalid issuer or audience' };
      }

      return { valid: true, claims };
    } catch {
      return { valid: false, error: 'Failed to parse token payload' };
    }
  }
}

export const progeniSsoService = new ProgeniSsoService();

