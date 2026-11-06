import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import { permissionService } from '../src/services/permissionService.js';
import {
  requirePermission,
  requireAuthenticatedUser,
  type AuthRequest,
} from '../src/middlewares/auth.js';
import { userAccountService } from '../src/services/userAccountService.js';

// Setup high-fidelity In-Memory MongoDB Stub
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

test('Permission Registry: maps candidate role to candidate permissions', () => {
  assert.equal(permissionService.hasPermission('candidate', 'candidate.profile.read'), true);
  assert.equal(permissionService.hasPermission('candidate', 'candidate.application.create'), true);
  assert.equal(permissionService.hasPermission('candidate', 'candidate.resume.upload'), true);

  // Candidate must not have admin or super admin permissions (deny-by-default)
  assert.equal(permissionService.hasPermission('candidate', 'admin.users.read'), false);
  assert.equal(permissionService.hasPermission('candidate', 'admin.users.suspend'), false);
  assert.equal(permissionService.hasPermission('candidate', 'system.roles.manage'), false);
});

test('Permission Registry: support role has read-only access and lacks mutation permissions', () => {
  assert.equal(permissionService.hasPermission('support', 'candidate.profile.read'), true);
  assert.equal(permissionService.hasPermission('support', 'admin.users.read'), true);
  assert.equal(permissionService.hasPermission('support', 'admin.audit.read'), true);

  // Support must not have user suspension or role modification permissions
  assert.equal(permissionService.hasPermission('support', 'admin.users.suspend'), false);
  assert.equal(permissionService.hasPermission('support', 'system.roles.manage'), false);
  assert.equal(permissionService.hasPermission('support', 'candidate.profile.update'), false);
});

test('Permission Registry: admin role has administrative permissions but cannot manage system roles', () => {
  assert.equal(permissionService.hasPermission('admin', 'admin.users.read'), true);
  assert.equal(permissionService.hasPermission('admin', 'admin.users.suspend'), true);
  assert.equal(permissionService.hasPermission('admin', 'admin.jobs.manage'), true);

  // Admin cannot manage system roles (reserved for super_admin)
  assert.equal(permissionService.hasPermission('admin', 'system.roles.manage'), false);
  assert.equal(permissionService.hasPermission('admin', 'system.permissions.manage'), false);
});

test('Permission Registry: super_admin holds full hierarchy including system roles management', () => {
  assert.equal(permissionService.hasPermission('super_admin', 'system.roles.manage'), true);
  assert.equal(permissionService.hasPermission('super_admin', 'system.permissions.manage'), true);
  assert.equal(permissionService.hasPermission('super_admin', 'admin.users.suspend'), true);
  assert.equal(permissionService.hasPermission('super_admin', 'candidate.profile.read'), true);
});

test('Permission Registry: enforces deny-by-default for undefined or invalid role', () => {
  assert.equal(permissionService.hasPermission(undefined, 'candidate.profile.read'), false);
  assert.equal(permissionService.hasPermission(null, 'candidate.profile.read'), false);
  assert.equal(permissionService.hasPermission('unknown_role' as any, 'candidate.profile.read'), false);
});

test('requirePermission Middleware: allows request when role holds required permission', async () => {
  const req: AuthRequest = {
    userId: 'admin-user',
    userRole: 'admin',
    userPermissions: permissionService.getPermissionsForRole('admin'),
  } as any;
  const res = createMockResponse();

  let nextCalled = false;
  requirePermission('admin.users.suspend')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'Admin must be granted access to admin.users.suspend');
  assert.equal(res.statusCode, 200);
});

test('requirePermission Middleware: rejects request when role lacks required permission (HTTP 403)', async () => {
  const req: AuthRequest = {
    userId: 'candidate-user',
    userRole: 'candidate',
    userPermissions: permissionService.getPermissionsForRole('candidate'),
  } as any;
  const res = createMockResponse();

  requirePermission('admin.users.read')(req, res, () => {
    assert.fail('Candidate must not be granted admin.users.read permission');
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'FORBIDDEN_INSUFFICIENT_PERMISSION');
});

test('Password Management: changing password bumps token_version and invalidates other sessions', async () => {
  const candidateId = `pwd-change-${Date.now()}`;
  await userAccountService.syncUser(candidateId, `${candidateId}@example.com`);
  await userAccountService.createSession(candidateId, { browser: 'Chrome', ip: '127.0.0.1' });

  // Baseline user has tokenVersion = 1
  const initialUser = await userAccountService.getUser(candidateId);
  assert.equal(initialUser?.tokenVersion, 1);

  // Candidate changes password
  const updatedUser = await userAccountService.changePassword(candidateId, 'SecureNewPassword123!');
  assert.equal(updatedUser.tokenVersion, 2, 'Password change must increment tokenVersion');

  // Verify that previous sessions were revoked
  const sessions = await userAccountService.listSessions(candidateId);
  const activeSessions = sessions.filter((s) => !s.revokedAt);
  assert.equal(activeSessions.length, 0, 'All previous device sessions must be revoked upon password change');
});

