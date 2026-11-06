import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../src/middlewares/auth.js';
import { upsertProfile } from '../src/controllers/candidateProfile.js';
import { createJob } from '../src/controllers/jobs.js';
import { calculateMatch } from '../src/controllers/matches.js';
import { transitionApplication } from '../src/controllers/applications.js';

function createMockResponse() {
  let statusCode = 200;
  let body: unknown = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      body = data;
      return this;
    },
  } as unknown as Response;
  return { res, getStatus: () => statusCode, getBody: () => body as Record<string, unknown> };
}

test('upsertProfile controller rejects invalid payload (e.g. invalid email or negative experience)', async () => {
  const { res, getStatus, getBody } = createMockResponse();
  const next: NextFunction = () => {};

  const req = {
    userId: 'user-1',
    body: {
      email: 'not-an-email',
      experience_years: -5,
    },
  } as AuthRequest;

  await upsertProfile(req, res, next);
  assert.equal(getStatus(), 400);
  assert.equal(getBody().ok, false);
  assert.equal(getBody().error, 'Invalid profile data');
});

test('createJob controller rejects invalid job payload (e.g. missing title)', async () => {
  const { res, getStatus, getBody } = createMockResponse();
  const next: NextFunction = () => {};

  const req = {
    userId: 'admin-1',
    userRole: 'admin',
    body: {
      title: '', // empty title should fail
      company: 'Valid Corp',
    },
  } as AuthRequest;

  await createJob(req, res, next);
  assert.equal(getStatus(), 400);
  assert.equal(getBody().ok, false);
  assert.equal(getBody().error, 'Invalid job data');
});

test('calculateMatch controller rejects out-of-bounds factor scores (> 100)', async () => {
  const { res, getStatus, getBody } = createMockResponse();
  const next: NextFunction = () => {};

  const req = {
    userId: 'user-1',
    body: {
      candidate: { skills: ['Python'] },
      job: { id: 'job-1' },
      factors: {
        skills: 150, // out of range [0, 100]
      },
    },
  } as AuthRequest;

  await calculateMatch(req, res, next);
  assert.equal(getStatus(), 400);
  assert.equal(getBody().ok, false);
  assert.equal(getBody().error, 'Invalid match calculation request');
});

test('transitionApplication controller rejects invalid transition target status', async () => {
  const { res, getStatus, getBody } = createMockResponse();
  const next: NextFunction = () => {};

  const req = {
    userId: 'user-1',
    params: { id: 'app-1' },
    body: {
      to: 'invalid_status_name',
    },
  } as unknown as AuthRequest;

  await transitionApplication(req, res, next);
  assert.equal(getStatus(), 400);
  assert.equal(getBody().ok, false);
  assert.equal(getBody().error, 'Invalid transition request');
});

