import { Router, type Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  requireMfaVerification,
  requirePermission,
  type AuthRequest,
  type UserRole,
  type AccountStatus,
  type Permission,
} from '../middlewares/auth.js';
import {
  loginRateLimiter,
  pairingRateLimiter,
} from '../middlewares/authRateLimiter.js';
import { userAccountService } from '../services/userAccountService.js';
import { authAuditService, extractClientIp } from '../services/authAuditService.js';

const router = Router();

const roleUpdateSchema = z.object({
  role: z.enum(['candidate', 'premium_candidate', 'support', 'admin', 'super_admin']),
});

const statusUpdateSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

const pairingExchangeSchema = z.object({
  code: z.string().trim().min(5).max(32),
});

const sessionSyncSchema = z.object({
  browser: z.string().trim().max(80).optional(),
  os: z.string().trim().max(80).optional(),
});

/**
 * POST /api/v1/auth/sync
 * Idempotently provisions or updates the candidate/user record in MongoDB upon login.
 */
router.post('/sync', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const parsed = sessionSyncSchema.safeParse(req.body);
    const userId = req.userId!;
    const user = await userAccountService.getUser(userId);

    // Create session entry if browser/os information is passed
    if (parsed.success && (parsed.data.browser || parsed.data.os)) {
      await userAccountService.createSession(userId, {
        browser: parsed.data.browser,
        os: parsed.data.os,
        ip: extractClientIp(req),
      });
    }

    res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Returns current authenticated profile, role, MFA status, token version, and granted permissions.
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await userAccountService.getUser(req.userId!);
    if (!user) {
      res.status(404).json({ ok: false, error: 'User not found' });
      return;
    }
    const sessions = await userAccountService.listSessions(req.userId!);
    res.json({
      ok: true,
      user,
      permissions: req.userPermissions || [],
      activeSessionsCount: sessions.filter((s) => !s.revokedAt).length,
    });
  } catch (error) {
    next(error);
  }
});

const passwordChangeSchema = z.object({
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
});

/**
 * POST /api/v1/auth/password/change
 * Authenticated password change with immediate invalidation of all other active sessions.
 */
router.post(
  '/password/change',
  authMiddleware,
  requireMfaVerification,
  async (req: AuthRequest, res: Response, next) => {
    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Password must be at least 8 characters long.' });
      return;
    }

    try {
      const updatedUser = await userAccountService.changePassword(req.userId!, parsed.data.newPassword);

      // Issue a replacement session token for the current client with the updated tokenVersion
      const freshToken = jwt.sign(
        {
          userId: updatedUser.id,
          role: updatedUser.role,
          email: updatedUser.email,
          tokenVersion: updatedUser.tokenVersion,
          aud: 'authenticated',
          iss: 'progeni-autoapply-api',
        },
        env.JWT_SECRET,
        { expiresIn: '7d' },
      );

      res.json({
        ok: true,
        message: 'Password changed successfully. All other active sessions have been invalidated.',
        token: freshToken,
        tokenVersion: updatedUser.tokenVersion,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/auth/logout-all
 * Invalidates all active tokens and sessions across all devices for this account.
 * Requires MFA assurance if user has MFA enabled.
 */
router.post('/logout-all', authMiddleware, requireMfaVerification, async (req: AuthRequest, res: Response, next) => {
  try {
    const newVersion = await userAccountService.logoutAllDevices(req.userId!);
    res.json({
      ok: true,
      message: 'All active sessions on all devices have been revoked.',
      tokenVersion: newVersion,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/sessions
 * Returns recent active and revoked sessions for current user.
 */
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const sessions = await userAccountService.listSessions(req.userId!);
    res.json({ ok: true, sessions });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/auth/sessions/:id
 * Revokes a specific session/device.
 */
router.delete('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const revoked = await userAccountService.revokeSession(req.userId!, req.params.id);
    if (!revoked) {
      res.status(404).json({ ok: false, error: 'Session not found or already revoked.' });
      return;
    }
    res.json({ ok: true, revoked: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/extension/pair
 * Generates a short-lived 6-digit pairing code to link Chrome Extension without sharing password.
 */
router.post(
  '/extension/pair',
  pairingRateLimiter,
  authMiddleware,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const code = await userAccountService.createExtensionPairingCode(req.userId!);
      res.json({
        ok: true,
        pairingCode: code,
        expiresInSeconds: 300,
        instructions: 'Enter this 6-digit pairing code in the Progeni Chrome Extension Side Panel within 5 minutes.',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/auth/extension/exchange
 * Public endpoint: Chrome Extension redeems pairing code for an authenticated session token.
 */
router.post(
  '/extension/exchange',
  pairingRateLimiter,
  async (req, res: Response, next) => {
    const parsed = pairingExchangeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'A valid pairing code is required.' });
      return;
    }

    try {
      const user = await userAccountService.exchangeExtensionPairingCode(parsed.data.code);

      // Issue an authenticated extension session token
      const extensionToken = jwt.sign(
        {
          userId: user.id,
          role: user.role,
          email: user.email,
          tokenVersion: user.tokenVersion,
          iss: 'progeni-autoapply-api',
          aud: 'authenticated',
        },
        env.JWT_SECRET,
        { expiresIn: '7d' },
      );

      // Record extension device session
      await userAccountService.createSession(user.id, {
        browser: 'Chrome Extension (MV3)',
        os: 'Desktop Browser',
        ip: extractClientIp(req),
      });

      res.json({
        ok: true,
        token: extensionToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid or expired pairing code.',
      });
    }
  },
);

/**
 * GET /api/v1/auth/mfa/status
 * Returns current MFA enrollment status and token assurance level.
 */
router.get('/mfa/status', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({
    ok: true,
    mfaEnabled: req.mfaEnabled || false,
    aal: req.aal || 'aal1',
    requiresMfa: req.requiresMfa || false,
  });
});

/**
 * POST /api/v1/auth/mfa/enable
 * Enables multi-factor authentication for current user.
 */
router.post('/mfa/enable', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await userAccountService.enableMfa(req.userId!);
    res.json({ ok: true, mfaEnabled: user.mfaEnabled });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/mfa/disable
 * Disables multi-factor authentication; strictly requires AAL2 MFA verification.
 */
router.post('/mfa/disable', authMiddleware, requireMfaVerification, async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await userAccountService.disableMfa(req.userId!);
    res.json({ ok: true, mfaEnabled: user.mfaEnabled });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/auth/account
 * Permanently deletes candidate account and triggers GDPR/DPDP cascade data purge.
 * Requires MFA verification if MFA is enabled.
 */
router.delete('/account', authMiddleware, requireMfaVerification, async (req: AuthRequest, res: Response, next) => {
  try {
    await userAccountService.deleteAccountCascade(req.userId!);
    res.json({
      ok: true,
      message: 'Account, credentials, and all candidate workspace data have been permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/admin/users
 * Lists users with search, role filters, and pagination.
 * Protected by PBAC: requires admin.users.read permission.
 */
router.get('/admin/users', authMiddleware, requirePermission('admin.users.read'), async (req: AuthRequest, res: Response, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const role = typeof req.query.role === 'string' ? (req.query.role as UserRole) : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as AccountStatus) : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

    const result = await userAccountService.listUsers({ query, role, status, limit, offset });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/auth/admin/users/:id/role
 * Allows super administrators to update user roles with strict privilege checks and MFA.
 * Protected by PBAC: requires system.roles.manage permission.
 */
router.patch('/admin/users/:id/role', authMiddleware, requireSuperAdmin, requirePermission('system.roles.manage'), requireMfaVerification, async (req: AuthRequest, res: Response, next) => {
  const parsed = roleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid role.', details: parsed.error.flatten() });
    return;
  }

  try {
    const updated = await userAccountService.updateRole(
      req.params.id,
      parsed.data.role,
      req.userRole!,
      req.userId!,
    );
    res.json({ ok: true, user: updated });
  } catch (error) {
    res.status(403).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update user role.',
    });
  }
});

/**
 * PATCH /api/v1/auth/admin/users/:id/status
 * Suspends or activates a candidate or administrative account.
 * Protected by PBAC: requires admin.users.suspend permission.
 */
router.patch('/admin/users/:id/status', authMiddleware, requirePermission('admin.users.suspend'), async (req: AuthRequest, res: Response, next) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid status.', details: parsed.error.flatten() });
    return;
  }

  try {
    const updated = await userAccountService.updateStatus(
      req.params.id,
      parsed.data.status,
      req.userRole!,
      req.userId!,
    );
    res.json({ ok: true, user: updated });
  } catch (error) {
    res.status(403).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update account status.',
    });
  }
});

/**
 * GET /api/v1/auth/admin/audit-logs
 * Security audit log viewer for administrators.
 * Protected by PBAC: requires admin.audit.read permission.
 */
router.get('/admin/audit-logs', authMiddleware, requirePermission('admin.audit.read'), async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

    const logs = await authAuditService.listLogs({ userId, action, limit, offset });
    res.json({ ok: true, logs });
  } catch (error) {
    next(error);
  }
});

export default router;

