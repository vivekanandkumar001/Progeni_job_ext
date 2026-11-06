import assert from 'node:assert/strict';
import test from 'node:test';
import {
  transitionStatus,
  type ApplicationRecord,
  type ApplicationStorage,
} from '../src/services/applicationEngine.js';

function createMockStorage(initialRecord: ApplicationRecord): ApplicationStorage {
  let record: ApplicationRecord = { ...initialRecord };
  return {
    async get(id: string, candidateId: string) {
      if (record.id === id && record.candidateId === candidateId) {
        return record;
      }
      return null;
    },
    async list(candidateId: string) {
      return record.candidateId === candidateId ? [record] : [];
    },
    async save(updated: ApplicationRecord) {
      record = { ...updated };
      return record;
    },
    async updateStatus(id: string, status: string, candidateId: string, metadata?: Record<string, unknown>) {
      if (record.id === id && record.candidateId === candidateId) {
        record = {
          ...record,
          status,
          metadata: { ...(record.metadata || {}), ...metadata },
          updatedAt: new Date().toISOString(),
        };
        return record;
      }
      return null;
    },
  };
}

test('transitionStatus allows valid progressive status transitions', async () => {
  const initial: ApplicationRecord = {
    id: 'app-1',
    jobId: 'job-1',
    candidateId: 'cand-1',
    status: 'discovered',
    idempotencyKey: 'idem-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const storage = createMockStorage(initial);

  // discovered -> prepared
  const res1 = await transitionStatus(storage, 'app-1', 'prepared', 'cand-1');
  assert.equal(res1.ok, true);
  if (res1.ok) assert.equal(res1.record.status, 'prepared');

  // prepared -> submitted
  const res2 = await transitionStatus(storage, 'app-1', 'submitted', 'cand-1');
  assert.equal(res2.ok, true);
  if (res2.ok) assert.equal(res2.record.status, 'submitted');

  // submitted -> verified
  const res3 = await transitionStatus(storage, 'app-1', 'verified', 'cand-1');
  assert.equal(res3.ok, true);
  if (res3.ok) assert.equal(res3.record.status, 'verified');
});

test('transitionStatus blocks invalid illegal status jumps', async () => {
  const initial: ApplicationRecord = {
    id: 'app-2',
    jobId: 'job-1',
    candidateId: 'cand-1',
    status: 'discovered',
    idempotencyKey: 'idem-2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const storage = createMockStorage(initial);

  // discovered directly to verified is illegal
  const result = await transitionStatus(storage, 'app-2', 'verified', 'cand-1');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.includes('Cannot transition application from discovered to verified'));
  }
});

test('transitionStatus rejects transition for nonexistent application', async () => {
  const initial: ApplicationRecord = {
    id: 'app-3',
    jobId: 'job-1',
    candidateId: 'cand-1',
    status: 'discovered',
    idempotencyKey: 'idem-3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const storage = createMockStorage(initial);

  const result = await transitionStatus(storage, 'nonexistent-id', 'prepared', 'cand-1');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, 'Application not found');
  }
});

test('transitionStatus rejects transition attempted by wrong user ID (IDOR prevention)', async () => {
  const initial: ApplicationRecord = {
    id: 'app-4',
    jobId: 'job-1',
    candidateId: 'legit-user',
    status: 'discovered',
    idempotencyKey: 'idem-4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const storage = createMockStorage(initial);

  const result = await transitionStatus(storage, 'app-4', 'prepared', 'malicious-attacker');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, 'Application not found');
  }
});

