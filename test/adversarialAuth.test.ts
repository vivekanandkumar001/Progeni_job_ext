import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import {
  authMiddleware,
  requireRole,
  requireSuperAdmin,
  requireOwnership,
  requireMfaVerification,
  type AuthRequest,
} from '../src/middlewares/auth.js';
import { userAccountService, hashPairingCode } from '../src/services/userAccountService.js';

// Setup high-fidelity In-Memory MongoDB Stub for isolated adversarial testing
const inMemoryStore = new Map<string, any[]>();

function getCollectionData(name: string): any[] {
  let col = inMemoryStore.get(name);
  if (!col) {
    col = [];
    inMemoryStore.set(name, col);
  }
  return col;
}

function matchesFilter(doc: any, filter: any): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    if (expected && typeof expected === 'object' && '$gt' in expected) {
      if (!(doc[key] > (expected as any).$gt)) return false;
    } else if (expected && typeof expected === 'object' && '$lt' in expected) {
      if (!(doc[key] < (expected as any).$lt)) return false;
    } else if (expected === null) {
      if (doc[key] !== null && doc[key] !== undefined) return false;
    } else {
      if (doc[key] !== expected) return false;
    }
  }
  return true;
}

function applyUpdate(doc: any, update: any): void {
  if (update.$set) {
    Object.assign(doc, update.$set);
  }
  if (update.$inc) {
    for (const [key, val] of Object.entries(update.$inc)) {
      doc[key] = (doc[key] || 0) + (val as number);
    }
  }
}

const mockDb: any = {
  collection(name: string) {
    const col = getCollectionData(name);
    return {
      async insertOne(doc: any) {
        const item = JSON.parse(JSON.stringify(doc));
        if (!item._id) item._id = randomUUID();
        col.push(item);
        return { acknowledged: true, insertedId: item._id };
      },
      async findOne(filter: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        return match ? JSON.parse(JSON.stringify(match)) : null;
      },
      async findOneAndUpdate(filter: any, update: any, options?: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        if (!match) return null;
        const original = JSON.parse(JSON.stringify(match));
        applyUpdate(match, update);
        return options?.returnDocument === 'after'
          ? JSON.parse(JSON.stringify(match))
          : original;
      },
      async updateOne(filter: any, update: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        if (!match) return { matchedCount: 0, modifiedCount: 0 };
        applyUpdate(match, update);
        return { matchedCount: 1, modifiedCount: 1 };
      },
      async updateMany(filter: any, update: any) {
        let count = 0;
        for (const item of col) {
          if (matchesFilter(item, filter)) {
            applyUpdate(item, update);
            count++;
          }
        }
        return { matchedCount: count, modifiedCount: count };
      },
      async deleteOne(filter: any) {
        const idx = col.findIndex((item) => matchesFilter(item, filter));
        if (idx !== -1) {
          col.splice(idx, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      },
      async deleteMany(filter: any) {
        const initial = col.length;
        const remaining = col.filter((item) => !matchesFilter(item, filter));
        inMemoryStore.set(name, remaining);
        return { deletedCount: initial - remaining.length };
      },
      async replaceOne(filter: any, doc: any, options?: any) {
        const idx = col.findIndex((item) => matchesFilter(item, filter));
        if (idx !== -1) {
          col[idx] = JSON.parse(JSON.stringify(doc));
          return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
        } else if (options?.upsert) {
          const item = JSON.parse(JSON.stringify(doc));
          col.push(item);
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      },
      async countDocuments(filter: any = {}) {
        return col.filter((item) => matchesFilter(item, filter)).length;
      },
      find(filter: any = {}) {
        let results = col.filter((item) => matchesFilter(item, filter));
        return {
          sort() { return this; },
          skip() { return this; },
          limit() { return this; },
          async toArray() { return JSON.parse(JSON.stringify(results)); },
        };
      },
    };
  },
};

(globalThis as any).progeniMongoDb = Promise.resolve(mockDb);

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: any) {
      this.headers[name] = value;
      return this;
    },
  };
  return res;
}

test('JWT Security: rejects token with wrong audience', async () => {
  const token = jwt.sign(
    { userId: 'cand-wrong-aud', aud: 'evil-external-service' },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  const req: AuthRequest = {
    headers: { authorization: `Bearer ${token}` },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
  const res = createMockResponse();

  await authMiddleware(req, res, () => {
    assert.fail('Should not call next() for token with wrong audience');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Invalid token audience');
});

test('JWT Security: rejects token with missing subject or empty subject', async () => {
  const token = jwt.sign(
    { userId: '   ', sub: '' },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  const req: AuthRequest = {
    headers: { authorization: `Bearer ${token}` },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
  const res = createMockResponse();

  await authMiddleware(req, res, () => {
    assert.fail('Should not call next() for token with empty subject');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Invalid or missing subject in token');
});

test('JWT Security: rejects token signed with an invalid secret or tampered payload', async () => {
  const fakeToken = jwt.sign(
    { userId: 'cand-forged', role: 'super_admin' },
    'wrong-forged-secret-attacker-key',
    { expiresIn: '1h' },
  );

  const req: AuthRequest = {
    headers: { authorization: `Bearer ${fakeToken}` },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
  const res = createMockResponse();

  await authMiddleware(req, res, () => {
    assert.fail('Should not accept forged signature');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Invalid or expired token');
});

test('JWT Security: rejects expired token', async () => {
  const expiredToken = jwt.sign(
    { userId: 'cand-expired' },
    env.JWT_SECRET,
    { expiresIn: -10 },
  );

  const req: AuthRequest = {
    headers: { authorization: `Bearer ${expiredToken}` },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
  const res = createMockResponse();

  await authMiddleware(req, res, () => {
    assert.fail('Should not accept expired token');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Invalid or expired token');
});

test('Token Revocation: rejects stale tokens issued prior to global logout (tokenVersion mismatch)', async () => {
  const userId = `revoked-user-${Date.now()}`;
  await userAccountService.syncUser(userId, `${userId}@example.com`);

  // Simulate token issued when tokenVersion = 1
  const staleToken = jwt.sign(
    { userId, tokenVersion: 1 },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  // User logs out of all devices -> tokenVersion bumps to 2
  await userAccountService.logoutAllDevices(userId);

  const req: AuthRequest = {
    headers: { authorization: `Bearer ${staleToken}` },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
  const res = createMockResponse();

  await authMiddleware(req, res, () => {
    assert.fail('Should not allow stale token after logoutAllDevices()');
  });

  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /revoked/i);
});

test('Account Status: strictly rejects suspended user with 403 Forbidden', async () => {
  const userId = `suspended-user-${Date.now()}`;
  await userAccountService.syncUser(userId, `${userId}@example.com`);
  await userAccountService.updateStatus(userId, 'suspended', 'admin');

  const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '1h' });
  const req: AuthRequest = {
    headers: { authorization: `Bearer ${token}` },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
  const res = createMockResponse();

  await authMiddleware(req, res, () => {
    assert.fail('Should not allow suspended user');
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /suspended/i);
});

test('Extension Pairing: pairing codes are hashed with SHA-256 at rest', async () => {
  const candidateId = `cand-hash-${Date.now()}`;
  await userAccountService.syncUser(candidateId, `${candidateId}@example.com`);

  const plainCode = await userAccountService.createExtensionPairingCode(candidateId);
  assert.match(plainCode, /^PAIR-\d{6}$/);

  // Directly inspect persistence layer
  const expectedHash = createHash('sha256').update(plainCode).digest('hex');

  // Verify code is NOT stored as plaintext
  const col = getCollectionData('extension_pairing_codes');
  const plaintextDoc = col.find((d) => d._id === plainCode);
  assert.equal(plaintextDoc, undefined, 'Pairing code must NEVER be stored as plain text!');

  // Verify hashed document exists
  const hashedDoc = col.find((d) => d._id === expectedHash);
  assert.ok(hashedDoc, 'Pairing code must exist hashed at rest');
  assert.equal(hashedDoc.used, false);
});

test('Extension Pairing: atomic single-use redemption prevents replay attack', async () => {
  const candidateId = `cand-replay-${Date.now()}`;
  await userAccountService.syncUser(candidateId, `${candidateId}@example.com`);

  const code = await userAccountService.createExtensionPairingCode(candidateId);

  // 1st redemption must succeed
  const user = await userAccountService.exchangeExtensionPairingCode(code);
  assert.equal(user.id, candidateId);

  // 2nd redemption with same code MUST throw error (replay attack blocked)
  await assert.rejects(
    async () => {
      await userAccountService.exchangeExtensionPairingCode(code);
    },
    /Invalid or expired extension pairing code/,
    'Second attempt with same pairing code must be rejected',
  );
});

test('Extension Pairing: concurrent race condition guarantees only 1 winner', async () => {
  const candidateId = `cand-race-${Date.now()}`;
  await userAccountService.syncUser(candidateId, `${candidateId}@example.com`);

  const code = await userAccountService.createExtensionPairingCode(candidateId);

  // Launch two concurrent redemption attempts simultaneously
  const results = await Promise.allSettled([
    userAccountService.exchangeExtensionPairingCode(code),
    userAccountService.exchangeExtensionPairingCode(code),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one concurrent redemption must succeed');
  assert.equal(rejected.length, 1, 'The duplicate concurrent request must be rejected');
});

test('Extension Pairing: expired pairing code (> 5 minutes) is rejected', async () => {
  const candidateId = `cand-exp-${Date.now()}`;
  await userAccountService.syncUser(candidateId, `${candidateId}@example.com`);

  const code = await userAccountService.createExtensionPairingCode(candidateId);

  // Force document expiry to simulate passage of 5 minutes
  const codeHash = hashPairingCode(code);
  const col = getCollectionData('extension_pairing_codes');
  const doc = col.find((d) => d._id === codeHash);
  if (doc) {
    doc.expires_at = new Date(Date.now() - 1000).toISOString();
  }

  await assert.rejects(
    async () => {
      await userAccountService.exchangeExtensionPairingCode(code);
    },
    /Invalid or expired extension pairing code/,
  );
});

test('Extension Pairing: requesting a new pairing code invalidates previous unused codes', async () => {
  const candidateId = `cand-multi-${Date.now()}`;
  await userAccountService.syncUser(candidateId, `${candidateId}@example.com`);

  const code1 = await userAccountService.createExtensionPairingCode(candidateId);
  const code2 = await userAccountService.createExtensionPairingCode(candidateId);

  // Code 1 should have been invalidated automatically
  await assert.rejects(
    async () => {
      await userAccountService.exchangeExtensionPairingCode(code1);
    },
    /Invalid or expired extension pairing code/,
    'Previous unused pairing code must be invalidated upon new generation',
  );

  // Code 2 should succeed
  const user = await userAccountService.exchangeExtensionPairingCode(code2);
  assert.equal(user.id, candidateId);
});

test('MFA Assurance Level: enforces AAL2 verification when MFA is enabled', async () => {
  const reqWithMfaAal1: AuthRequest = {
    userId: 'user-mfa-enrolled',
    mfaEnabled: true,
    aal: 'aal1',
  } as any;
  const res = createMockResponse();

  requireMfaVerification(reqWithMfaAal1, res, () => {
    assert.fail('Should not proceed with AAL1 when MFA is enabled');
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'MFA_CHALLENGE_REQUIRED');

  // When AAL2 is provided, guard passes
  const reqWithMfaAal2: AuthRequest = {
    userId: 'user-mfa-enrolled',
    mfaEnabled: true,
    aal: 'aal2',
  } as any;
  const resPass = createMockResponse();
  let passed = false;

  requireMfaVerification(reqWithMfaAal2, resPass, () => {
    passed = true;
  });

  assert.equal(passed, true, 'AAL2 token must pass MFA verification guard');
});

test('Privilege Escalation: standard admin strictly blocked from promoting anyone to super_admin', async () => {
  const standardAdminId = `admin-${Date.now()}`;
  const targetUserId = `user-${Date.now()}`;

  await userAccountService.syncUser(standardAdminId, 'admin@example.com', { role: 'admin' });
  await userAccountService.syncUser(targetUserId, 'target@example.com', { role: 'candidate' });

  await assert.rejects(
    async () => {
      await userAccountService.updateRole(targetUserId, 'super_admin', 'admin', standardAdminId);
    },
    /Only Super Administrators can grant administrative privileges/i,
    'Standard admin must NEVER be permitted to create super_admin',
  );
});

test('Privilege Escalation: super_admin strictly blocked from modifying own role', async () => {
  const superAdminId = `superadmin-${Date.now()}`;
  await userAccountService.syncUser(superAdminId, 'super@example.com', { role: 'super_admin' });

  await assert.rejects(
    async () => {
      await userAccountService.updateRole(superAdminId, 'candidate', 'super_admin', superAdminId);
    },
    /Cannot modify own role/i,
  );
});

test('IDOR Defense: candidate is strictly blocked from modifying another candidate resource', async () => {
  const req: AuthRequest = {
    userId: 'candidate-alice',
    userRole: 'candidate',
  } as any;
  const res = createMockResponse();

  const idorGuard = requireOwnership((_r) => 'candidate-bob');

  await idorGuard(req, res, () => {
    assert.fail('Candidate Alice must not be permitted to access Candidate Bob resource');
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /do not have permission/);
});

test('Cascade Deletion: wipes user identity, sessions, pairing codes, and candidate workspaces', async () => {
  const candidateId = `cand-delete-${Date.now()}`;
  await userAccountService.syncUser(candidateId, `${candidateId}@example.com`);
  await userAccountService.createSession(candidateId, { browser: 'Chrome', ip: '127.0.0.1' });
  await userAccountService.createExtensionPairingCode(candidateId);

  // Perform cascade account deletion
  await userAccountService.deleteAccountCascade(candidateId);

  const userDoc = getCollectionData('users').find((u) => u._id === candidateId);
  const sessions = getCollectionData('user_sessions').filter((s) => s.user_id === candidateId);
  const codes = getCollectionData('extension_pairing_codes').filter((c) => c.user_id === candidateId);

  assert.equal(userDoc, undefined, 'User record must be wiped');
  assert.equal(sessions.length, 0, 'User sessions must be wiped');
  assert.equal(codes.length, 0, 'Pairing codes must be wiped');
});
