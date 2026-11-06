process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AuthRequest } from '../src/middlewares/auth.js';
import {
  patchProfile,
  getProfile,
  patchPreferences,
  getPreferences,
  uploadResume,
  listResumes,
  deleteResume,
  patchOnboarding,
  getOnboarding,
} from '../src/controllers/candidate.js';

// Setup high-fidelity In-Memory MongoDB Stub for candidate onboarding tests
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
    } else if (expected && typeof expected === 'object' && '$ne' in expected) {
      if (doc[key] === (expected as any).$ne) return false;
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
  if (update.$push) {
    for (const [key, val] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[key])) doc[key] = [];
      if (val && typeof val === 'object' && '$each' in (val as any)) {
        doc[key].push(...(val as any).$each);
      } else {
        doc[key].push(val);
      }
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
    headers: {} as Record<string, any>,
    body: null as any,
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

function createMockRequest(options: {
  userId: string;
  role?: string;
  body?: any;
  params?: Record<string, string>;
  ip?: string;
}): AuthRequest {
  return {
    userId: options.userId,
    userRole: options.role || 'candidate',
    body: options.body || {},
    params: options.params || {},
    ip: options.ip || '127.0.0.1',
    headers: { 'x-forwarded-for': options.ip || '127.0.0.1' },
    socket: { remoteAddress: options.ip || '127.0.0.1' },
  } as any;
}

// Minimal valid PDF base64 string
const VALID_PDF_BASE64 = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 130\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Alex Mercer) Tj\n0 -20 Td\n(alex.mercer@example.com) Tj\n0 -20 Td\n(+1 555-019-2834) Tj\n0 -20 Td\n(5 years of professional experience in TypeScript, React, Node.js) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000286 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n468\n%%EOF',
).toString('base64');

test('Candidate Onboarding & Profile Subsystem', async (t) => {
  const candidateA = 'candidate-test-user-a';
  const candidateB = 'candidate-test-user-b';

  await t.test('Profile: rejects invalid email and negative experience years', async () => {
    const req = createMockRequest({
      userId: candidateA,
      body: {
        email: 'invalid-email-format',
        experience_years: -5,
      },
    });
    const res = createMockResponse();

    await patchProfile(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.ok(res.body.details);
  });

  await t.test('Profile: creates and updates candidate profile with completeness calculation', async () => {
    const req = createMockRequest({
      userId: candidateA,
      body: {
        full_name: 'Alex Mercer',
        email: 'alex.mercer@example.com',
        phone: '+91 9876543210',
        city: 'Bengaluru',
        country: 'India',
        target_role: 'Senior Full Stack Engineer',
        experience_years: 6,
        skills: ['TypeScript', 'React', 'Node.js', 'MongoDB'],
        linkedin_url: 'https://linkedin.com/in/alexmercer',
      },
    });
    const res = createMockResponse();

    await patchProfile(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.profile.full_name, 'Alex Mercer');
    assert.equal(res.body.profile.city, 'Bengaluru');
    assert.ok(res.body.completeness.score >= 80);
    assert.ok(res.body.completeness.completedFields.includes('Full Name'));
    assert.ok(res.body.completeness.completedFields.includes('Target Role'));
  });

  await t.test('Career Preferences: stores and updates career search parameters', async () => {
    const req = createMockRequest({
      userId: candidateA,
      body: {
        desired_roles: ['Full Stack Engineer', 'Backend Lead'],
        preferred_locations: ['Bengaluru', 'Remote'],
        workplace_type: 'hybrid',
        expected_salary: {
          currency: 'INR',
          min: 2500000,
          max: 3500000,
          period: 'yearly',
        },
        experience_level: 'senior',
        joining_availability: '30_days',
        employment_type: 'full-time',
      },
    });
    const res = createMockResponse();

    await patchPreferences(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.preferences.workplace_type, 'hybrid');
    assert.equal(res.body.preferences.joining_availability, '30_days');
    assert.equal(res.body.preferences.expected_salary.min, 2500000);
  });

  await t.test('Resume Upload: rejects file with mismatched extension and invalid magic bytes', async () => {
    const fakeDocxBuffer = Buffer.from('NOT_A_VALID_DOCX_FILE').toString('base64');
    const req = createMockRequest({
      userId: candidateA,
      body: {
        fileName: 'resume.docx',
        fileType: 'docx',
        contentBase64: fakeDocxBuffer,
      },
    });
    const res = createMockResponse();

    await uploadResume(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 422);
    assert.equal(res.body.ok, false);
    assert.ok(res.body.error.includes('DOCX'));
  });

  await t.test('Resume Upload: parses valid PDF and persists versioned resume record', async () => {
    const req = createMockRequest({
      userId: candidateA,
      body: {
        fileName: 'Alex_Mercer_Resume.pdf',
        fileType: 'pdf',
        contentBase64: VALID_PDF_BASE64,
        title: 'Alex Mercer Primary CV',
      },
    });
    const res = createMockResponse();

    await uploadResume(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.resume.file_type, 'pdf');
    assert.equal(res.body.resume.version, 1);
    assert.ok(res.body.resume.skills.length > 0);
    assert.ok(res.body.analysis.detected.fullName || res.body.analysis.detected.email);
  });

  await t.test('Resume Management: lists candidate resumes and deletes with IDOR isolation', async () => {
    // List candidate A's resumes
    const listReq = createMockRequest({ userId: candidateA });
    const listRes = createMockResponse();
    await listResumes(listReq, listRes, (err) => {
      if (err) throw err;
    });

    assert.equal(listRes.statusCode, 200);
    assert.ok(listRes.body.resumes.length >= 1);
    const resumeId = listRes.body.resumes[0].id;

    // Candidate B attempts to delete Candidate A's resume (IDOR attack)
    const attackReq = createMockRequest({
      userId: candidateB,
      params: { id: resumeId },
    });
    const attackRes = createMockResponse();
    await deleteResume(attackReq, attackRes, (err) => {
      if (err) throw err;
    });
    assert.equal(attackRes.statusCode, 404);

    // Candidate A successfully deletes own resume
    const deleteReq = createMockRequest({
      userId: candidateA,
      params: { id: resumeId },
    });
    const deleteRes = createMockResponse();
    await deleteResume(deleteReq, deleteRes, (err) => {
      if (err) throw err;
    });
    assert.equal(deleteRes.statusCode, 200);
  });

  await t.test('Onboarding & Consents: captures dual consents with policy version and timestamps', async () => {
    const req = createMockRequest({
      userId: candidateA,
      body: {
        step: 4,
        completeStep: 3,
        dataProcessingConsent: true,
        jobAssistanceConsent: true,
      },
    });
    const res = createMockResponse();

    await patchOnboarding(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.onboarding.current_step, 4);
    assert.equal(res.body.onboarding.consents.data_processing.accepted, true);
    assert.equal(res.body.onboarding.consents.data_processing.version, 'v1.0');
    assert.ok(res.body.onboarding.consents.data_processing.accepted_at);
    assert.equal(res.body.onboarding.consents.job_application_assistance.accepted, true);
  });

  await t.test('Onboarding & Consents: supports explicit consent withdrawal', async () => {
    const req = createMockRequest({
      userId: candidateA,
      body: {
        jobAssistanceConsent: false,
      },
    });
    const res = createMockResponse();

    await patchOnboarding(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.onboarding.consents.job_application_assistance.accepted, false);
    assert.ok(res.body.onboarding.consents.job_application_assistance.revoked_at);
  });

  await t.test('Onboarding Completion: completes onboarding and updates status', async () => {
    const req = createMockRequest({
      userId: candidateA,
      body: {
        status: 'completed',
        step: 5,
        completeStep: 5,
      },
    });
    const res = createMockResponse();

    await patchOnboarding(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.onboarding.status, 'completed');
    assert.ok(res.body.onboarding.completed_at);
    assert.deepEqual(res.body.onboarding.completed_steps, [1, 2, 3, 4, 5]);
  });
});
