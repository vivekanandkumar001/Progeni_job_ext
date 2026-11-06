import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { requireConsent } from '../src/middlewares/auth.js';

function createResponse() {
  let statusCode: number | undefined;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return { response, getStatus: () => statusCode, getBody: () => body };
}

test('requires a verified user ID before checking consent', async () => {
  let checkedUserId: string | undefined;
  const { response, getStatus, getBody } = createResponse();
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  await requireConsent(async (userId) => {
    checkedUserId = userId;
    return true;
  })({} as Request, response, next);

  assert.equal(getStatus(), 401);
  assert.equal(getBody() && (getBody() as { error: string }).error, 'Authenticated request is missing a user ID.');
  assert.equal(checkedUserId, undefined);
  assert.equal(nextCalled, false);
});

test('blocks candidate access when consent has not been accepted', async () => {
  const { response, getStatus, getBody } = createResponse();
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  await requireConsent(async (userId) => {
    assert.equal(userId, 'candidate-1');
    return false;
  })({ userId: 'candidate-1' } as unknown as Request, response, next);

  assert.equal(getStatus(), 403);
  assert.deepEqual(getBody(), {
    ok: false,
    code: 'CONSENT_REQUIRED',
    error: 'Accept the data notice before using candidate workspace features.',
  });
  assert.equal(nextCalled, false);
});

test('forwards consent-store errors to Express error handling', async () => {
  const { response } = createResponse();
  const error = new Error('consent store unavailable');
  let forwardedError: unknown;
  const next: NextFunction = (value) => {
    forwardedError = value;
  };

  await requireConsent(async () => {
    throw error;
  })({ userId: 'candidate-1' } as unknown as Request, response, next);

  assert.equal(forwardedError, error);
});
