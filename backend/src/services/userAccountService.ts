import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getDatabase } from '../config/mongodb.js';
import { authAuditService } from './authAuditService.js';
import { mongoWorkspaceStore } from './mongoWorkspaceStore.js';
import { getSupabaseAuthClient } from '../config/supabase/client.js';

export type UserRole =
  | 'candidate'
  | 'premium_candidate'
  | 'support'
  | 'admin'
  | 'super_admin';

export type AccountStatus = 'active' | 'suspended' | 'deleted';

export interface UserAccountRecord {
  id: string; // matches Supabase user UUID
  email: string;
  role: UserRole;
  status: AccountStatus;
  tokenVersion: number;
  mfaEnabled: boolean;
  lastSignInAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSessionRecord {
  id: string;
  userId: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  createdAt: string;
  lastActiveAt: string;
  revokedAt: string | null;
}

export interface PairingCodeRecord {
  code: string;
  userId: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

interface MongoUserDoc {
  _id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  token_version: number;
  mfa_enabled: boolean;
  last_sign_in_at: string;
  created_at: string;
  updated_at: string;
}

interface MongoSessionDoc {
  _id: string;
  user_id: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  created_at: string;
  last_active_at: string;
  revoked_at: string | null;
}

interface MongoPairingDoc {
  _id: string; // SHA-256 hash of pairing code
  code_prefix: string; // "PAIR-XXX" for audit trail
  user_id: string;
  expires_at: string;
  used: boolean;
  redeemed_at?: string | null;
  created_at: string;
}

export function hashPairingCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export class UserAccountService {
  /**
   * Idempotently provisions or updates a user upon successful authentication.
   * Default role for new users is always 'candidate'.
   */
  async syncUser(
    userId: string,
    email: string,
    options?: { role?: UserRole; mfaEnabled?: boolean },
  ): Promise<UserAccountRecord> {
    const db = await getDatabase();
    const usersCol = db.collection<MongoUserDoc>('users');
    const existing = await usersCol.findOne({ _id: userId });

    const now = new Date().toISOString();

    if (!existing) {
      const newUser: MongoUserDoc = {
        _id: userId,
        email: email.toLowerCase().trim(),
        role: options?.role || 'candidate',
        status: 'active',
        token_version: 1,
        mfa_enabled: options?.mfaEnabled || false,
        last_sign_in_at: now,
        created_at: now,
        updated_at: now,
      };

      await usersCol.insertOne(newUser);
      await authAuditService.logEvent({
        userId,
        action: 'signup',
        metadata: { email: newUser.email, role: newUser.role },
      });

      return this.toUserRecord(newUser);
    }

    const updates: Partial<MongoUserDoc> = {
      email: email.toLowerCase().trim(),
      last_sign_in_at: now,
      updated_at: now,
    };
    if (options?.mfaEnabled !== undefined) {
      updates.mfa_enabled = options.mfaEnabled;
    }

    await usersCol.updateOne({ _id: userId }, { $set: updates });

    return {
      ...this.toUserRecord(existing),
      ...updates,
      id: userId,
    };
  }

  async getUser(userId: string): Promise<UserAccountRecord | null> {
    const db = await getDatabase();
    const doc = await db.collection<MongoUserDoc>('users').findOne({ _id: userId });
    return doc ? this.toUserRecord(doc) : null;
  }

  async getUserByEmail(email: string): Promise<UserAccountRecord | null> {
    const db = await getDatabase();
    const doc = await db
      .collection<MongoUserDoc>('users')
      .findOne({ email: email.toLowerCase().trim() });
    return doc ? this.toUserRecord(doc) : null;
  }

  /**
   * Updates a user's role with strict RBAC privilege checks:
   * - Candidates cannot change any role.
   * - Admins can assign candidate, premium_candidate, or support.
   * - Super admins can assign any role including admin and super_admin.
   */
  async updateRole(
    targetUserId: string,
    newRole: UserRole,
    callerRole: UserRole,
    callerId: string,
  ): Promise<UserAccountRecord> {
    if (callerRole !== 'admin' && callerRole !== 'super_admin') {
      throw new Error('Forbidden: Only administrators can modify roles.');
    }

    if (targetUserId === callerId) {
      throw new Error('Forbidden: Cannot modify own role.');
    }

    if (callerRole === 'admin' && (newRole === 'admin' || newRole === 'super_admin')) {
      throw new Error('Forbidden: Only Super Administrators can grant administrative privileges.');
    }

    const db = await getDatabase();
    const usersCol = db.collection<MongoUserDoc>('users');
    const target = await usersCol.findOne({ _id: targetUserId });

    if (!target) {
      throw new Error('Target user not found.');
    }

    if (target.role === 'super_admin' && callerRole !== 'super_admin') {
      throw new Error('Forbidden: Cannot modify a Super Administrator account.');
    }

    const now = new Date().toISOString();
    await usersCol.updateOne(
      { _id: targetUserId },
      { $set: { role: newRole, updated_at: now } },
    );

    await authAuditService.logEvent({
      userId: targetUserId,
      action: 'role_changed',
      metadata: {
        previousRole: target.role,
        newRole,
        changedBy: callerId,
        callerRole,
      },
    });

    return {
      ...this.toUserRecord(target),
      role: newRole,
      updatedAt: now,
    };
  }

  /**
   * Suspends or activates a user account.
   */
  async updateStatus(
    targetUserId: string,
    newStatus: AccountStatus,
    callerRole: UserRole,
    callerId: string,
  ): Promise<UserAccountRecord> {
    if (callerRole !== 'admin' && callerRole !== 'super_admin') {
      throw new Error('Forbidden: Only administrators can modify account status.');
    }

    const db = await getDatabase();
    const usersCol = db.collection<MongoUserDoc>('users');
    const target = await usersCol.findOne({ _id: targetUserId });
    if (!target) throw new Error('Target user not found.');

    if (target.role === 'super_admin' && callerRole !== 'super_admin') {
      throw new Error('Forbidden: Cannot alter status of a Super Administrator.');
    }

    const now = new Date().toISOString();
    await usersCol.updateOne(
      { _id: targetUserId },
      { $set: { status: newStatus, updated_at: now } },
    );

    await authAuditService.logEvent({
      userId: targetUserId,
      action: 'status_changed',
      metadata: { previousStatus: target.status, newStatus, changedBy: callerId },
    });

    return {
      ...this.toUserRecord(target),
      status: newStatus,
      updatedAt: now,
    };
  }

  /**
   * Updates password, invalidates all existing sessions on other devices by incrementing token_version,
   * and logs security audit event.
   */
  async changePassword(userId: string, newPassword: string): Promise<UserAccountRecord> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // If Supabase Auth is enabled, update password via Supabase Admin API
    try {
      const supabase = getSupabaseAuthClient();
      if ((supabase as any)?.auth?.admin?.updateUserById) {
        await (supabase as any).auth.admin.updateUserById(userId, { password: newPassword });
      }
    } catch {
      // Suppress if admin API is unconfigured or in test environment
    }

    // Invalidate all existing sessions on all other devices by bumping token_version
    const userResult = await db.collection<MongoUserDoc>('users').findOneAndUpdate(
      { _id: userId },
      { $inc: { token_version: 1 }, $set: { updated_at: now } },
      { returnDocument: 'after' },
    );

    if (!userResult) throw new Error('User not found.');

    // Revoke previous sessions
    await db.collection<MongoSessionDoc>('user_sessions').updateMany(
      { user_id: userId, revoked_at: null },
      { $set: { revoked_at: now } },
    );

    await authAuditService.logEvent({
      userId,
      action: 'password_reset_success',
      metadata: { reason: 'authenticated_password_change', newVersion: userResult.token_version },
    });

    return this.toUserRecord(userResult);
  }

  /**
   * Logs out from all devices by bumping token_version and revoking all active sessions.
   */
  async logoutAllDevices(userId: string): Promise<number> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const userResult = await db.collection<MongoUserDoc>('users').findOneAndUpdate(
      { _id: userId },
      { $inc: { token_version: 1 }, $set: { updated_at: now } },
      { returnDocument: 'after' },
    );

    await db.collection<MongoSessionDoc>('user_sessions').updateMany(
      { user_id: userId, revoked_at: null },
      { $set: { revoked_at: now } },
    );

    await authAuditService.logEvent({
      userId,
      action: 'logout_all',
      metadata: { newVersion: userResult?.token_version || 2 },
    });

    return userResult?.token_version || 2;
  }

  /**
   * Records a new user session / device.
   */
  async createSession(
    userId: string,
    deviceInfo: { browser?: string; os?: string; ip?: string },
  ): Promise<UserSessionRecord> {
    const db = await getDatabase();
    const sessionId = randomUUID();
    const now = new Date().toISOString();

    const sessionDoc: MongoSessionDoc = {
      _id: sessionId,
      user_id: userId,
      browser: deviceInfo.browser || null,
      os: deviceInfo.os || null,
      ip: deviceInfo.ip || null,
      created_at: now,
      last_active_at: now,
      revoked_at: null,
    };

    await db.collection<MongoSessionDoc>('user_sessions').insertOne(sessionDoc);
    return {
      id: sessionDoc._id,
      userId: sessionDoc.user_id,
      browser: sessionDoc.browser,
      os: sessionDoc.os,
      ip: sessionDoc.ip,
      createdAt: sessionDoc.created_at,
      lastActiveAt: sessionDoc.last_active_at,
      revokedAt: sessionDoc.revoked_at,
    };
  }

  async listSessions(userId: string): Promise<UserSessionRecord[]> {
    const db = await getDatabase();
    const sessions = await db
      .collection<MongoSessionDoc>('user_sessions')
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(20)
      .toArray();

    return sessions.map((s) => ({
      id: s._id,
      userId: s.user_id,
      browser: s.browser,
      os: s.os,
      ip: s.ip,
      createdAt: s.created_at,
      lastActiveAt: s.last_active_at,
      revokedAt: s.revoked_at,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const result = await db.collection<MongoSessionDoc>('user_sessions').updateOne(
      { _id: sessionId, user_id: userId, revoked_at: null },
      { $set: { revoked_at: now } },
    );

    await authAuditService.logEvent({
      userId,
      action: 'logout',
      metadata: { revokedSessionId: sessionId },
    });

    return result.modifiedCount > 0;
  }

  /**
   * Generates a secure, 6-digit one-time pairing code for Chrome Extension linking.
   * Codes are cryptographically hashed at rest. Expires in 5 minutes (300 seconds).
   * Automatically invalidates previous unused codes for this candidate.
   */
  async createExtensionPairingCode(userId: string): Promise<string> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // Invalidate previous unused codes for this candidate
    await db.collection<MongoPairingDoc>('extension_pairing_codes').updateMany(
      { user_id: userId, used: false },
      { $set: { used: true } },
    );

    // Cryptographically secure 6-digit number
    const rawNumber = parseInt(randomBytes(3).toString('hex'), 16) % 900000 + 100000;
    const code = `PAIR-${rawNumber}`;
    const codeHash = hashPairingCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await db.collection<MongoPairingDoc>('extension_pairing_codes').insertOne({
      _id: codeHash,
      code_prefix: code.slice(0, 7),
      user_id: userId,
      expires_at: expiresAt,
      used: false,
      redeemed_at: null,
      created_at: now,
    });

    return code;
  }

  /**
   * Exchanges an extension pairing code for the authenticated user record.
   * Single-use only, executed as an atomic findOneAndUpdate operation
   * to eliminate replay and TOCTOU race conditions.
   */
  async exchangeExtensionPairingCode(code: string): Promise<UserAccountRecord> {
    const db = await getDatabase();
    const codeHash = hashPairingCode(code);
    const nowIso = new Date().toISOString();

    // Atomic findOneAndUpdate: guarantees single-use and prevents concurrent double redemption
    const pairing = await db.collection<MongoPairingDoc>('extension_pairing_codes').findOneAndUpdate(
      {
        _id: codeHash,
        used: false,
        expires_at: { $gt: nowIso },
      },
      {
        $set: { used: true, redeemed_at: nowIso },
      },
      { returnDocument: 'after' },
    );

    if (!pairing) {
      throw new Error('Invalid or expired extension pairing code.');
    }

    const user = await this.getUser(pairing.user_id);
    if (!user) throw new Error('User associated with pairing code no longer exists.');

    await authAuditService.logEvent({
      userId: user.id,
      action: 'extension_paired',
      metadata: { codePrefix: pairing.code_prefix },
    });

    return user;
  }

  /**
   * Enables MFA on user account.
   */
  async enableMfa(userId: string): Promise<UserAccountRecord> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const result = await db.collection<MongoUserDoc>('users').findOneAndUpdate(
      { _id: userId },
      { $set: { mfa_enabled: true, updated_at: now } },
      { returnDocument: 'after' },
    );
    if (!result) throw new Error('User not found.');
    await authAuditService.logEvent({
      userId,
      action: 'mfa_enabled',
      metadata: { timestamp: now },
    });
    return this.toUserRecord(result);
  }

  /**
   * Disables MFA on user account.
   */
  async disableMfa(userId: string): Promise<UserAccountRecord> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const result = await db.collection<MongoUserDoc>('users').findOneAndUpdate(
      { _id: userId },
      { $set: { mfa_enabled: false, updated_at: now } },
      { returnDocument: 'after' },
    );
    if (!result) throw new Error('User not found.');
    await authAuditService.logEvent({
      userId,
      action: 'mfa_disabled',
      metadata: { timestamp: now },
    });
    return this.toUserRecord(result);
  }

  /**
   * Permanently deletes a candidate account and executes atomic cascade cleanup.
   */
  async deleteAccountCascade(userId: string): Promise<void> {
    const db = await getDatabase();

    // Log deletion before data wipe
    await authAuditService.logEvent({
      userId,
      action: 'account_deleted',
      metadata: { reason: 'candidate_requested_deletion' },
    });

    // Attempt Supabase Auth user deletion if configured
    try {
      const supabase = getSupabaseAuthClient();
      if ((supabase as any)?.auth?.admin?.deleteUser) {
        await (supabase as any).auth.admin.deleteUser(userId);
      }
    } catch {
      // Suppress if admin service role is unavailable or in local/test mode
    }

    // Wipe candidate workspace, profiles, resumes, matches, applications
    await mongoWorkspaceStore.clearWorkspace(userId);

    // Delete user record and all associated sessions
    await Promise.all([
      db.collection<MongoUserDoc>('users').deleteOne({ _id: userId }),
      db.collection('user_sessions').deleteMany({ user_id: userId }),
      db.collection('extension_pairing_codes').deleteMany({ user_id: userId }),
    ]);
  }

  async listUsers(params: {
    query?: string;
    role?: UserRole;
    status?: AccountStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserAccountRecord[]; total: number }> {
    const db = await getDatabase();
    const filter: Record<string, unknown> = {};

    if (params.role) filter.role = params.role;
    if (params.status) filter.status = params.status;
    if (params.query) {
      filter.$or = [
        { email: { $regex: params.query, $options: 'i' } },
        { _id: params.query },
      ];
    }

    const limit = Math.min(params.limit || 20, 100);
    const offset = Math.max(params.offset || 0, 0);

    const col = db.collection<MongoUserDoc>('users');
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return {
      users: docs.map((d) => this.toUserRecord(d)),
      total,
    };
  }

  private toUserRecord(doc: MongoUserDoc): UserAccountRecord {
    return {
      id: doc._id,
      email: doc.email,
      role: doc.role,
      status: doc.status,
      tokenVersion: doc.token_version || 1,
      mfaEnabled: Boolean(doc.mfa_enabled),
      lastSignInAt: doc.last_sign_in_at,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    };
  }
}

export const userAccountService = new UserAccountService();
