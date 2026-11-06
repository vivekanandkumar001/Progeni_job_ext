import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  requireOwnership,
  type AuthRequest,
} from '../src/middlewares/auth.js';
import { sanitizeMetadata } from '../src/services/authAuditService.js';

const testSecret = 'local-development-secret-do-not-use-outside-local';

function createMockReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers: { ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    originalUrl: '/test',
    url: '/test',
    params: {},
  } as unknown as AuthRequest;

  let statusCode = 200;
  let responseBody: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: unknown) {
      responseBody = body;
      return res;
    },
    setHeader() {
      return res;
    },
  };

  return { req, res, getStatus: () => statusCode, getBody: () => responseBody };
}

test('authMiddleware accepts a valid HMAC JWT and populates request identity', async () => {
  const token = jwt.sign(
    { userId: 'cand-123', email: 'alex@example.com', role: 'candidate' },
    testSecret,
    { expiresIn: '1h' },
  );

  const { req, res, getStatus } = createMockReqRes({ authorization: `Bearer ${token}` });

  let nextCalled = false;
  await authMiddleware(req, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(getStatus(), 200);
  assert.equal(req.userId, 'cand-123');
  assert.equal(req.userRole, 'candidate');
});

test('authMiddleware rejects missing authorization header with 401', async () => {
  const { req, res, getStatus, getBody } = createMockReqRes({});

  let nextCalled = false;
  await authMiddleware(req, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 401);
  assert.match((getBody() as any)?.error, /missing or invalid/i);
});

test('authMiddleware rejects invalid token signature with 401', async () => {
  const forgedToken = jwt.sign(
    { userId: 'hacker-007', role: 'admin' },
    'wrong-malicious-secret-1234',
    { expiresIn: '1h' },
  );

  const { req, res, getStatus, getBody } = createMockReqRes({ authorization: `Bearer ${forgedToken}` });

  let nextCalled = false;
  await authMiddleware(req, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 401);
  assert.match((getBody() as any)?.error, /invalid or expired/i);
});

test('authMiddleware rejects expired tokens with 401', async () => {
  const expiredToken = jwt.sign(
    { userId: 'cand-999', role: 'candidate' },
    testSecret,
    { expiresIn: '-10s' },
  );

  const { req, res, getStatus, getBody } = createMockReqRes({ authorization: `Bearer ${expiredToken}` });

  let nextCalled = false;
  await authMiddleware(req, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 401);
  assert.match((getBody() as any)?.error, /invalid or expired/i);
});

test('requireRole enforces RBAC: allows permitted roles and rejects forbidden roles with 403', () => {
  const guard = requireRole('admin', 'super_admin');

  // Candidate attempt
  const { req: candidateReq, res: res1, getStatus: getStatus1 } = createMockReqRes();
  candidateReq.userRole = 'candidate';
  let next1 = false;
  guard(candidateReq, res1 as any, () => { next1 = true; });
  assert.equal(next1, false);
  assert.equal(getStatus1(), 403);

  // Admin attempt
  const { req: adminReq, res: res2, getStatus: getStatus2 } = createMockReqRes();
  adminReq.userRole = 'admin';
  let next2 = false;
  guard(adminReq, res2 as any, () => { next2 = true; });
  assert.equal(next2, true);
  assert.equal(getStatus2(), 200);

  // Super Admin attempt
  const { req: superAdminReq, res: res3, getStatus: getStatus3 } = createMockReqRes();
  superAdminReq.userRole = 'super_admin';
  let next3 = false;
  guard(superAdminReq, res3 as any, () => { next3 = true; });
  assert.equal(next3, true);
  assert.equal(getStatus3(), 200);
});

test('requireSuperAdmin strictly blocks standard admin and normal candidate', () => {
  const guard = requireSuperAdmin;

  // Admin attempt
  const { req: adminReq, res: res1, getStatus: getStatus1 } = createMockReqRes();
  adminReq.userRole = 'admin';
  let next1 = false;
  guard(adminReq, res1 as any, () => { next1 = true; });
  assert.equal(next1, false);
  assert.equal(getStatus1(), 403);

  // Super Admin attempt
  const { req: superReq, res: res2 } = createMockReqRes();
  superReq.userRole = 'super_admin';
  let next2 = false;
  guard(superReq, res2 as any, () => { next2 = true; });
  assert.equal(next2, true);
});

test('requireOwnership prevents IDOR: blocks candidate from accessing another candidate resource', async () => {
  const guard = requireOwnership((req) => req.params?.candidateId);

  // Candidate 1 accessing Candidate 2 resource
  const { req: req1, res: res1, getStatus: getStatus1 } = createMockReqRes();
  req1.userId = 'cand-1';
  req1.userRole = 'candidate';
  req1.params = { candidateId: 'cand-2' };

  let next1 = false;
  await guard(req1, res1 as any, (err?: any) => {
    if (!err) next1 = true;
  });
  assert.equal(next1, false);
  assert.equal(getStatus1(), 403);

  // Candidate 1 accessing own resource
  const { req: req2, res: res2 } = createMockReqRes();
  req2.userId = 'cand-1';
  req2.userRole = 'candidate';
  req2.params = { candidateId: 'cand-1' };

  let next2 = false;
  await guard(req2, res2 as any, () => { next2 = true; });
  assert.equal(next2, true);

  // Admin accessing Candidate 1 resource for support/audit
  const { req: reqAdmin, res: res3 } = createMockReqRes();
  reqAdmin.userId = 'admin-99';
  reqAdmin.userRole = 'admin';
  reqAdmin.params = { candidateId: 'cand-1' };

  let next3 = false;
  await guard(reqAdmin, res3 as any, () => { next3 = true; });
  assert.equal(next3, true);
});

test('audit logging sanitization redacts passwords, tokens, and secrets from metadata', () => {
  const sensitivePayload = {
    email: 'user@example.com',
    password: 'SuperSecretPassword123!',
    token: 'jwt-header.payload.signature',
    refreshToken: 'rt_abc_123',
    access_token: 'at_xyz_789',
    otp: '123456',
    nested: {
      clientSecret: 'secret_live_key',
      safeField: 'display-mode',
    },
  };

  const clean = sanitizeMetadata(sensitivePayload);

  assert.equal(clean.email, 'user@example.com');
  assert.equal(clean.password, '[REDACTED]');
  assert.equal(clean.token, '[REDACTED]');
  assert.equal(clean.refreshToken, '[REDACTED]');
  assert.equal(clean.access_token, '[REDACTED]');
  assert.equal(clean.otp, '[REDACTED]');
  assert.equal((clean.nested as any).clientSecret, '[REDACTED]');
  assert.equal((clean.nested as any).safeField, 'display-mode');
});
