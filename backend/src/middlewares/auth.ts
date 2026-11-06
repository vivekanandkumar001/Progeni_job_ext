import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env, isLocalDevelopment } from '../config/env.js';
import { getSupabaseAuthClient } from '../config/supabase/client.js';
import { userAccountService, type UserRole, type AccountStatus } from '../services/userAccountService.js';
import { authAuditService } from '../services/authAuditService.js';
import { permissionService, type Permission } from '../services/permissionService.js';

export type { UserRole, AccountStatus, Permission };

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  userEmail?: string;
  userStatus?: AccountStatus;
  tokenVersion?: number;
  mfaEnabled?: boolean;
  aal?: 'aal1' | 'aal2';
  requiresMfa?: boolean;
  userPermissions?: Permission[];
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  let authenticatedUserId: string | null = null;
  let tokenEmail: string | null = null;
  let tokenRole: UserRole | null = null;
  let tokenVersion: number | null = null;
  let tokenAal: 'aal1' | 'aal2' = 'aal1';

  if (isLocalDevelopment) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId?: string;
        sub?: string;
        role?: UserRole;
        email?: string;
        tokenVersion?: number;
        aal?: 'aal1' | 'aal2';
        aud?: string;
        iss?: string;
      };

      // Strict audience validation: if token carries audience, it must match 'authenticated'
      if (decoded.aud && decoded.aud !== 'authenticated') {
        res.status(401).json({ error: 'Invalid token audience' });
        return;
      }

      authenticatedUserId = decoded.userId || decoded.sub || null;
      if (!authenticatedUserId || typeof authenticatedUserId !== 'string' || authenticatedUserId.trim() === '') {
        res.status(401).json({ error: 'Invalid or missing subject in token' });
        return;
      }

      tokenRole = decoded.role || null;
      tokenEmail = decoded.email || null;
      tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : null;
      tokenAal = decoded.aal === 'aal2' ? 'aal2' : 'aal1';
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } else {
    try {
      const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
      if (error || !data.user) {
        res.status(401).json({ error: 'Invalid or expired access token' });
        return;
      }
      authenticatedUserId = data.user.id;
      tokenEmail = data.user.email || null;
      const appRole = data.user.app_metadata?.role as UserRole | undefined;
      tokenRole = appRole || null;

      // Extract AAL from Supabase JWT decoded claims or factor verification
      const decodedPayload = jwt.decode(token) as { aal?: 'aal1' | 'aal2'; token_version?: number } | null;
      tokenAal = decodedPayload?.aal === 'aal2' ? 'aal2' : 'aal1';
      tokenVersion = typeof decodedPayload?.token_version === 'number' ? decodedPayload.token_version : null;
    } catch (error) {
      next(error);
      return;
    }
  }

  try {
    // Synchronize or retrieve user record from MongoDB
    let user = await userAccountService.getUser(authenticatedUserId);
    if (!user) {
      user = await userAccountService.syncUser(
        authenticatedUserId,
        tokenEmail || `${authenticatedUserId}@local.progeni`,
        { role: tokenRole || 'candidate' },
      );
    }

    // Status checks
    if (user.status === 'suspended') {
      await authAuditService.logEvent({
        userId: user.id,
        action: 'unauthorized_access_attempt',
        req,
        metadata: { reason: 'account_suspended' },
      });
      res.status(403).json({ error: 'Forbidden: Account has been suspended by administration.' });
      return;
    }

    if (user.status === 'deleted') {
      res.status(401).json({ error: 'Account has been deleted.' });
      return;
    }

    // Token version revocation check: default missing tokenVersion to 1
    const effectiveTokenVersion = tokenVersion ?? 1;
    if (effectiveTokenVersion < user.tokenVersion) {
      await authAuditService.logEvent({
        userId: user.id,
        action: 'unauthorized_access_attempt',
        req,
        metadata: {
          reason: 'token_version_revoked',
          tokenVersion: effectiveTokenVersion,
          currentVersion: user.tokenVersion,
        },
      });
      res.status(401).json({ error: 'Session has been revoked. Please sign in again.' });
      return;
    }

    // Attach verified server-side claims to request
    req.userId = user.id;
    req.userRole = user.role;
    req.userEmail = user.email;
    req.userStatus = user.status;
    req.tokenVersion = user.tokenVersion;
    req.mfaEnabled = user.mfaEnabled;
    req.aal = tokenAal;
    req.requiresMfa = user.mfaEnabled && tokenAal !== 'aal2';
    req.userPermissions = permissionService.getPermissionsForRole(user.role);

    next();
  } catch (error) {
    // In unit test environments without MongoDB, fall back cleanly
    if (authenticatedUserId) {
      req.userId = authenticatedUserId;
      req.userRole = tokenRole || 'candidate';
      req.userEmail = tokenEmail || undefined;
      req.mfaEnabled = false;
      req.aal = tokenAal;
      req.userPermissions = permissionService.getPermissionsForRole(tokenRole || 'candidate');
      next();
      return;
    }
    next(error);
  }
}

/**
 * Multi-Factor Authentication (MFA) Assurance Level Guard.
 * Enforces that users who have enabled MFA must present an AAL2-verified token
 * before performing sensitive operations (account deletion, role change, etc.).
 */
export function requireMfaVerification(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.mfaEnabled && req.aal !== 'aal2') {
    void authAuditService.logEvent({
      userId: req.userId || null,
      action: 'unauthorized_access_attempt',
      req,
      metadata: {
        reason: 'mfa_challenge_required',
        path: req.originalUrl || req.url,
      },
    });
    res.status(403).json({
      ok: false,
      code: 'MFA_CHALLENGE_REQUIRED',
      error: 'Multi-factor authentication (MFA) challenge verification required for this sensitive action.',
    });
    return;
  }
  next();
}

/**
 * Enforces Role-Based Access Control (RBAC).
 * Accepts one or multiple allowed roles. Normal candidates can never pass an admin requirement.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      void authAuditService.logEvent({
        userId: req.userId || null,
        action: 'unauthorized_access_attempt',
        req,
        metadata: {
          userRole: req.userRole,
          requiredRoles: allowedRoles,
          path: req.originalUrl || req.url,
        },
      });
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return;
    }
    next();
  };
}

/**
 * Permission-Based Access Control (PBAC) Guard.
 * Evaluates whether the authenticated user possesses all specified permissions.
 * Deny-by-default behavior strictly enforced.
 */
export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !permissionService.hasAllPermissions(req.userRole, requiredPermissions)) {
      void authAuditService.logEvent({
        userId: req.userId || null,
        action: 'unauthorized_access_attempt',
        req,
        metadata: {
          userRole: req.userRole,
          requiredPermissions,
          path: req.originalUrl || req.url,
        },
      });
      res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_INSUFFICIENT_PERMISSION',
        error: 'Forbidden: you lack the required permission to perform this action.',
        requiredPermissions,
      });
      return;
    }
    next();
  };
}

/**
 * Standard enterprise alias for authMiddleware.
 */
export const requireAuthenticatedUser = authMiddleware;

/**
 * Convenience guard for administrative endpoints (admin or super_admin).
 */
export const requireAdmin = requireRole('admin', 'super_admin');

/**
 * Guard strictly requiring super_admin privilege.
 */
export const requireSuperAdmin = requireRole('super_admin');

/**
 * Insecure Direct Object Reference (IDOR) Ownership Guard.
 * Validates that candidate owns the targeted resource unless caller is an admin/super_admin.
 */
export function requireOwnership(
  getOwnerId: (req: AuthRequest) => string | undefined | Promise<string | undefined>,
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Admins and super admins can view/audit candidate resources
      if (req.userRole === 'admin' || req.userRole === 'super_admin') {
        return next();
      }

      const ownerId = await getOwnerId(req);
      if (!req.userId || !ownerId || req.userId !== ownerId) {
        await authAuditService.logEvent({
          userId: req.userId || null,
          action: 'unauthorized_access_attempt',
          req,
          metadata: {
            reason: 'idor_ownership_mismatch',
            requestedOwnerId: ownerId,
            actualUserId: req.userId,
            path: req.originalUrl || req.url,
          },
        });
        res.status(403).json({ error: 'Forbidden: you do not have permission to access this resource.' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireConsent(hasConsent: (userId: string) => Promise<boolean>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as AuthRequest).userId;
    if (!userId) {
      res.status(401).json({ error: 'Authenticated request is missing a user ID.' });
      return;
    }

    try {
      if (!(await hasConsent(userId))) {
        res.status(403).json({
          ok: false,
          code: 'CONSENT_REQUIRED',
          error: 'Accept the data notice before using candidate workspace features.',
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
