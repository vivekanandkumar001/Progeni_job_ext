process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AuthRequest } from '../src/middlewares/auth.js';
import {
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  generateResume,
  generateCoverLetter,
  generateAnswers,
  approveApplication,
  revokeApproval,
  exportApplication,
} from '../src/controllers/applications.js';
import { applicationWorkspaceService } from '../src/services/assistant/applicationWorkspaceService.js';
import { coverLetterService } from '../src/services/assistant/coverLetterService.js';
import { readinessEngine } from '../src/services/assistant/readinessEngine.js';
import { buildAutofillPlan, executeAutofill } from '../../frontend/chrome-extension/src/content/ats/smartAutofill.js';

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
    if (key === '$or' && Array.isArray(expected)) {
      const orMatched = expected.some((f) => matchesFilter(doc, f));
      if (!orMatched) return false;
      continue;
    }
    if (expected && typeof expected === 'object' && '$regex' in expected) {
      const val = key.includes('.')
        ? key.split('.').reduce((acc, part) => acc?.[part], doc)
        : doc[key];
      const re = new RegExp((expected as any).$regex, (expected as any).$options || 'i');
      if (!re.test(String(val || ''))) return false;
      continue;
    }
    if (expected && typeof expected === 'object' && '$gt' in expected) {
      if (!(doc[key] > (expected as any).$gt)) return false;
    } else if (expected && typeof expected === 'object' && '$lt' in expected) {
      if (!(doc[key] < (expected as any).$lt)) return false;
    } else if (expected && typeof expected === 'object' && '$ne' in expected) {
      if (doc[key] === (expected as any).$ne) return false;
    } else if (expected === null) {
      if (doc[key] !== null && doc[key] !== undefined) return false;
    } else {
      const val = key.includes('.')
        ? key.split('.').reduce((acc, part) => acc?.[part], doc)
        : doc[key];
      if (val !== expected) return false;
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
      if (key.includes('.')) {
        const parts = key.split('.');
        let target = doc;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {};
          target = target[parts[i]];
        }
        const lastPart = parts[parts.length - 1];
        if (!Array.isArray(target[lastPart])) target[lastPart] = [];
        target[lastPart].push(val);
      } else {
        if (!Array.isArray(doc[key])) doc[key] = [];
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
      async updateOne(filter: any, update: any, options?: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        if (!match) {
          if (options?.upsert && update.$set) {
            const item = JSON.parse(JSON.stringify(update.$set));
            if (!item._id) item._id = filter._id || randomUUID();
            col.push(item);
            return { matchedCount: 0, modifiedCount: 1, upsertedCount: 1 };
          }
          return { matchedCount: 0, modifiedCount: 0 };
        }
        applyUpdate(match, update);
        return { matchedCount: 1, modifiedCount: 1 };
      },
      async replaceOne(filter: any, doc: any, options?: any) {
        const idx = col.findIndex((item) => matchesFilter(item, filter));
        if (idx !== -1) {
          col[idx] = JSON.parse(JSON.stringify(doc));
          return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
        } else if (options?.upsert) {
          const item = JSON.parse(JSON.stringify(doc));
          if (!item._id) item._id = filter._id || randomUUID();
          col.push(item);
          return { matchedCount: 0, modifiedCount: 1, upsertedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0 };
      },
      async countDocuments(filter: any) {
        return col.filter((item) => matchesFilter(item, filter)).length;
      },
      find(filter: any) {
        let results = col.filter((item) => matchesFilter(item, filter));
        return {
          sort(sortCriteria: any) {
            if (sortCriteria?.updated_at === -1) {
              results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            }
            return this;
          },
          skip(n: number) {
            results = results.slice(n);
            return this;
          },
          limit(n: number) {
            results = results.slice(0, n);
            return this;
          },
          async toArray() {
            return JSON.parse(JSON.stringify(results));
          },
        };
      },
    };
  },
};

(globalThis as any).progeniMongoDb = Promise.resolve(mockDb);

function createMockRes(): {
  statusCode: number;
  data: any;
  status(code: number): any;
  json(payload: any): void;
} {
  const res = {
    statusCode: 200,
    data: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.data = payload;
    },
  };
  return res;
}

test('Phase 6 — AI Application Assistant Subsystem', async (t) => {
  const candidateIdA = 'cand_assistant_test_user_001';
  const candidateIdB = 'cand_assistant_test_user_002';
  const testJobId = 'job_test_fullstack_lead_999';

  // Seed candidate profile in DB
  const profileCol = getCollectionData('candidate_profiles');
  profileCol.push({
    _id: candidateIdA,
    user_id: candidateIdA,
    full_name: 'Alex Johnson',
    email: 'alex.johnson@example.com',
    phone: '+1 555 019 2834',
    location: 'San Francisco, CA',
    city: 'San Francisco',
    country: 'USA',
    target_role: 'Senior Full Stack Engineer',
    skills: ['TypeScript', 'Node.js', 'React', 'MongoDB', 'AWS', 'Docker'],
    experience_years: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Seed master resume in DB
  const resumeCol = getCollectionData('resumes');
  const masterResumeId = 'resume_master_alex_001';
  resumeCol.push({
    _id: masterResumeId,
    id: masterResumeId,
    user_id: candidateIdA,
    title: 'Master Career Resume',
    is_master: true,
    status: 'published',
    content: {
      personal_info: {
        full_name: 'Alex Johnson',
        email: 'alex.johnson@example.com',
        phone: '+1 555 019 2834',
        city: 'San Francisco',
        country: 'USA',
        target_role: 'Senior Full Stack Engineer',
      },
      summary: 'Experienced Full Stack Engineer with 6+ years designing scalable cloud backends and responsive frontend architectures.',
      skills: [
        { name: 'TypeScript', category: 'Languages' },
        { name: 'Node.js', category: 'Backend' },
        { name: 'React', category: 'Frontend' },
        { name: 'MongoDB', category: 'Databases' },
        { name: 'AWS', category: 'Cloud' },
        { name: 'Docker', category: 'DevOps' },
      ],
      work_experience: [
        {
          id: 'exp_1',
          company: 'Acme Technologies',
          role: 'Senior Software Engineer',
          highlights: [
            'Architected distributed microservices handling 100M+ monthly events using TypeScript and Node.js.',
            'Reduced database query latency by 45% through MongoDB index optimization and caching.',
            'Led migration of frontend monolith to modern React components.',
          ],
        },
      ],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Seed a job posting in DB
  const jobsCol = getCollectionData('jobs');
  jobsCol.push({
    _id: testJobId,
    id: testJobId,
    title: 'Lead Full Stack Engineer',
    company: 'Stripe Horizon',
    location: 'San Francisco, CA',
    workplace_mode: 'hybrid',
    url: 'https://boards.greenhouse.io/stripehorizon/jobs/999',
    provider: 'greenhouse',
    skills: ['TypeScript', 'Node.js', 'React', 'MongoDB', 'AWS'],
    required_skills: ['TypeScript', 'Node.js', 'React'],
    preferred_skills: ['MongoDB', 'AWS'],
    description:
      'We are seeking a Lead Full Stack Engineer to build high-throughput payment and developer platforms. ' +
      'Requirements: Strong experience with TypeScript, Node.js, and React. Hands-on experience optimizing MongoDB and deploying to AWS.',
    salary: '$180,000 - $220,000',
    experience_min: 5,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Seed deterministic match in DB
  const matchesCol = getCollectionData('job_matches');
  matchesCol.push({
    _id: 'match_999_alex',
    user_id: candidateIdA,
    job_id: testJobId,
    score: 92,
    eligible: true,
    eligibility_decision: 'eligible',
    explanation: ['Candidate satisfies all mandatory requirements for TypeScript, Node.js, and React with 6 years experience.'],
    missing_evidence: [],
    factors: { skills: 95, experience: 90, title: 90 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  let createdWorkspaceId = '';

  await t.test('1. Application Workspace Lifecycle: Creation with Grounded Snapshots', async () => {
    const workspace = await applicationWorkspaceService.createWorkspace(candidateIdA, {
      jobId: testJobId,
      customTone: 'professional',
    });

    assert.ok(workspace.id, 'Workspace should have a unique ID');
    createdWorkspaceId = workspace.id;
    assert.equal(workspace.candidateId, candidateIdA);
    assert.equal(workspace.jobId, testJobId);
    assert.equal(workspace.status, 'discovered');
    assert.equal(workspace.jobSnapshot.company, 'Stripe Horizon');
    assert.equal(workspace.jobSnapshot.title, 'Lead Full Stack Engineer');
    assert.equal(workspace.matchSnapshot.score, 92);
    assert.equal(workspace.matchSnapshot.eligible, true);
    assert.ok(workspace.masterResumeId, 'Master resume should be linked');
    assert.ok(workspace.coverLetter.content.length > 100, 'Cover letter should be generated');
    assert.ok(workspace.screeningAnswers.length >= 4, 'Screening answers should be initialized');
    assert.ok(workspace.fieldMappings.length >= 5, 'Standard form fields should be mapped');
    assert.equal(workspace.approval.isApproved, false, 'Approval must be false initially (Strict Human Gate)');
    assert.ok(workspace.readiness.score > 0, 'Initial readiness score should be calculated');
  });

  await t.test('2. Idempotency & Deduplication: Prevents Duplicate Workspaces', async () => {
    const idempotencyKey = 'idem_key_assistant_abc_123';
    const first = await applicationWorkspaceService.createWorkspace(candidateIdA, {
      jobId: testJobId,
      idempotencyKey,
    });
    const second = await applicationWorkspaceService.createWorkspace(candidateIdA, {
      jobId: testJobId,
      idempotencyKey,
    });

    assert.equal(first.id, second.id, 'Second call must return the exact same application workspace');
    assert.equal(second.idempotencyKey, first.idempotencyKey);
  });

  await t.test('3. AI Resume Tailoring: Grounded in Truth Engine Without Fabrication', async () => {
    const updated = await applicationWorkspaceService.generateTailoredResume(candidateIdA, createdWorkspaceId);

    assert.ok(updated.targetedResumeId, 'Targeted resume ID must be set');
    assert.ok(updated.targetedResumeSnapshot, 'Snapshot must be populated');
    assert.ok(updated.targetedResumeSnapshot.summary.includes('Lead Full Stack Engineer') || updated.targetedResumeSnapshot.summary.includes('Alex Johnson') || updated.targetedResumeSnapshot.summary.length > 50);
    assert.ok(updated.targetedResumeSnapshot.skills.includes('TypeScript'));

    // Check audit trail
    const resumeAudit = updated.approval.auditTrail.find((a) => a.action === 'resume_updated');
    assert.ok(resumeAudit, 'Resume tailoring must record an audit trail entry');
  });

  await t.test('4. Cover Letter Generation: Multiple Tone Presets & Zero Hallucination', async () => {
    // Generate technical tone
    const technical = await coverLetterService.generateCoverLetter(candidateIdA, {
      jobTitle: 'Lead Full Stack Engineer',
      companyName: 'Stripe Horizon',
      jobDescription: 'High-throughput payment platforms with TypeScript and Node.js',
      tone: 'technical',
      customInstructions: 'Highlight experience with distributed architectures',
    });

    assert.equal(technical.tone, 'technical');
    assert.ok(technical.content.includes('Stripe Horizon'), 'Must mention company');
    assert.ok(technical.content.includes('Lead Full Stack Engineer'), 'Must mention role');
    assert.ok(technical.content.includes('Alex Johnson'), 'Must include candidate name');
    assert.ok(technical.content.includes('Acme Technologies'), 'Must reference genuine company from resume');
    assert.ok(technical.content.includes('distributed architectures'), 'Must incorporate custom instructions');

    // Generate concise tone
    const concise = await coverLetterService.generateCoverLetter(candidateIdA, {
      jobTitle: 'Lead Full Stack Engineer',
      companyName: 'Stripe Horizon',
      tone: 'concise',
    });

    assert.equal(concise.tone, 'concise');
    assert.ok(concise.content.length < technical.content.length, 'Concise tone should be shorter');
  });

  await t.test('5. Screening Question Assistant: Grounded Answers & Refusal to Hallucinate', async () => {
    const updated = await applicationWorkspaceService.generateScreeningAnswers(candidateIdA, createdWorkspaceId, [
      'What is your full legal name?',
      'How many years of professional experience do you have?',
      'Do you now or will you in the future require visa sponsorship?',
      'What are your expected salary compensation requirements?',
    ]);

    const answers = updated.screeningAnswers;
    const nameAnswer = answers.find((a) => a.question.includes('full legal name'));
    assert.ok(nameAnswer, 'Full name question should exist');
    assert.equal(nameAnswer?.answer, 'Alex Johnson');
    assert.equal(nameAnswer?.confidence, 1.0);
    assert.equal(nameAnswer?.isGrounded, true);

    const expAnswer = answers.find((a) => a.question.includes('years of professional experience'));
    assert.ok(expAnswer, 'Experience question should exist');
    assert.equal(expAnswer?.answer, '6');
    assert.equal(expAnswer?.isGrounded, true);

    // STRICT SAFETY GATE: Zero hallucination for legal and compensation questions
    const visaAnswer = answers.find((a) => a.question.includes('visa sponsorship'));
    assert.ok(visaAnswer, 'Visa question should exist');
    assert.equal(visaAnswer?.status, 'manual_input_required', 'Must require manual input');
    assert.equal(visaAnswer?.answer, null, 'Never fabricate visa answers');

    const salaryAnswer = answers.find((a) => a.question.includes('salary compensation'));
    assert.ok(salaryAnswer, 'Salary question should exist');
    assert.equal(salaryAnswer?.status, 'manual_input_required', 'Must require manual input');
    assert.equal(salaryAnswer?.answer, null, 'Never fabricate salary answers');
  });

  await t.test('6. Technical Readiness Engine: 0-100% Score Calculation & Checklist', async () => {
    const ws = await applicationWorkspaceService.getWorkspace(candidateIdA, createdWorkspaceId);
    assert.ok(ws);

    const readiness = readinessEngine.calculateReadiness({
      jobSnapshot: ws.jobSnapshot,
      masterResumeId: ws.masterResumeId,
      targetedResumeId: ws.targetedResumeId,
      coverLetter: ws.coverLetter,
      screeningAnswers: ws.screeningAnswers,
      fieldMappings: ws.fieldMappings,
      missingInformation: ws.missingInformation,
      approval: ws.approval,
    });

    assert.ok(readiness.score >= 0 && readiness.score <= 100, 'Score must be clamped between 0 and 100');
    assert.equal(readiness.breakdown.resume.ready, true, 'Resume category should be ready');
    assert.equal(readiness.breakdown.humanApproval.ready, false, 'Human approval must be false prior to approval');
    assert.equal(readiness.isReadyForSubmission, false, 'Cannot be ready for submission without human approval');
    assert.ok(readiness.checklist.length >= 6, 'Checklist should contain all criteria');
  });

  await t.test('7. Strict Human Approval Gate: Explicit Digital Signature & Revocation', async () => {
    // Attempt approval with digital signature
    const approved = await applicationWorkspaceService.approveApplication(candidateIdA, createdWorkspaceId, {
      signature: 'Alex Johnson (Digital Attestation)',
    });

    assert.equal(approved.approval.isApproved, true);
    assert.ok(approved.approval.approvedAt);
    assert.equal(approved.approval.approvedBy, candidateIdA);
    assert.equal(approved.approval.approvalSignature, 'Alex Johnson (Digital Attestation)');
    assert.equal(approved.status, 'prepared', 'Status should auto-advance to prepared');

    // Verify audit trail
    const approvalAudit = approved.approval.auditTrail.find((a) => a.action === 'approved');
    assert.ok(approvalAudit, 'Approval must be recorded in audit trail');

    // Revocation test
    const revoked = await applicationWorkspaceService.revokeApproval(candidateIdA, createdWorkspaceId, 'Candidate decided to review answers again');

    assert.equal(revoked.approval.isApproved, false);
    assert.equal(revoked.status, 'discovered', 'Status should revert to discovered');
    const revocationAudit = revoked.approval.auditTrail.find((a) => a.action === 'revoked');
    assert.ok(revocationAudit, 'Revocation must be recorded in audit trail');

    // Re-approve for downstream tests
    await applicationWorkspaceService.approveApplication(candidateIdA, createdWorkspaceId);
  });

  await t.test('8. Multi-Tenant IDOR Security Isolation: Strictly Blocks Candidate B', async () => {
    // Candidate B attempts to read Candidate A workspace
    const blockedGet = await applicationWorkspaceService.getWorkspace(candidateIdB, createdWorkspaceId);
    assert.equal(blockedGet, null, 'Candidate B must not be able to retrieve Candidate A application');

    // Candidate B attempts to update Candidate A workspace
    await assert.rejects(
      async () => {
        await applicationWorkspaceService.updateWorkspace(candidateIdB, createdWorkspaceId, {
          notes: 'Malicious modification',
        });
      },
      /not found or access denied/i,
      'Candidate B must be denied update access',
    );

    // Candidate B attempts to approve Candidate A workspace
    await assert.rejects(
      async () => {
        await applicationWorkspaceService.approveApplication(candidateIdB, createdWorkspaceId);
      },
      /not found or access denied/i,
      'Candidate B must be denied approval permission',
    );

    // Candidate B attempts to export Candidate A workspace
    await assert.rejects(
      async () => {
        await applicationWorkspaceService.exportBundle(candidateIdB, createdWorkspaceId, 'json');
      },
      /not found or access denied/i,
      'Candidate B must be denied export access',
    );
  });

  await t.test('9. Application Bundle Export: JSON, Markdown, and Plain Text', async () => {
    const jsonExport = await applicationWorkspaceService.exportBundle(candidateIdA, createdWorkspaceId, 'json');
    assert.equal(jsonExport.format, 'json');
    assert.ok(jsonExport.filename.endsWith('.json'));
    assert.ok(jsonExport.content.includes('Stripe Horizon'));
    assert.ok(jsonExport.content.includes('Alex Johnson'));

    const mdExport = await applicationWorkspaceService.exportBundle(candidateIdA, createdWorkspaceId, 'markdown');
    assert.equal(mdExport.format, 'markdown');
    assert.ok(mdExport.filename.endsWith('.md'));
    assert.ok(mdExport.content.includes('# Application Bundle: Lead Full Stack Engineer'));
    assert.ok(mdExport.content.includes('## Cover Letter'));

    const txtExport = await applicationWorkspaceService.exportBundle(candidateIdA, createdWorkspaceId, 'text');
    assert.equal(txtExport.format, 'text');
    assert.ok(txtExport.filename.endsWith('.txt'));
    assert.ok(txtExport.content.includes('APPLICATION PACKAGE:'));
  });

  await t.test('10. Chrome MV3 Autofill Safety: Refuses Injection Without Approval', async () => {
    // Construct mock DOM
    const unapprovedPlan = {
      fields: [
        {
          id: 'f1',
          name: 'full_name',
          label: 'Full Name',
          selector: '#name',
          type: 'text' as const,
          value: 'Alex Johnson',
          required: true,
          approved: true,
          status: 'pending' as const,
        },
      ],
      totalDetected: 1,
      approvedCount: 1,
      isApplicationApproved: false, // NOT approved
      requiresHumanReview: true,
    };

    // Execute autofill with unapproved plan
    const mockDoc: any = { querySelector: () => null };
    const blockedResult = executeAutofill(mockDoc, unapprovedPlan);

    assert.equal(blockedResult.ok, false, 'Must fail when isApplicationApproved is false');
    assert.equal(blockedResult.injectedCount, 0, 'No fields may be injected');
    assert.ok(blockedResult.message.includes('Candidate explicit approval is required'));
  });

  await t.test('11. Express Controller Endpoints Integration', async () => {
    // 1. listApplications
    const listReq: Partial<AuthRequest> = { userId: candidateIdA, query: {} };
    const listRes = createMockRes();
    await listApplications(listReq as AuthRequest, listRes as any, () => {});
    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.data.ok, true);
    assert.ok(Array.isArray(listRes.data.applications));

    // 2. getApplication
    const getReq: Partial<AuthRequest> = { userId: candidateIdA, params: { id: createdWorkspaceId } };
    const getRes = createMockRes();
    await getApplication(getReq as AuthRequest, getRes as any, () => {});
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.data.ok, true);
    assert.equal(getRes.data.application.id, createdWorkspaceId);

    // 3. updateApplication
    const updateReq: Partial<AuthRequest> = {
      userId: candidateIdA,
      params: { id: createdWorkspaceId },
      body: { notes: 'Updated application notes via API' },
    };
    const updateRes = createMockRes();
    await updateApplication(updateReq as AuthRequest, updateRes as any, () => {});
    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.data.application.notes, 'Updated application notes via API');

    // 4. exportApplication
    const exportReq: Partial<AuthRequest> = {
      userId: candidateIdA,
      params: { id: createdWorkspaceId },
      body: { format: 'json' },
    };
    const exportRes = createMockRes();
    await exportApplication(exportReq as AuthRequest, exportRes as any, () => {});
    assert.equal(exportRes.statusCode, 200);
    assert.equal(exportRes.data.ok, true);
    assert.ok(exportRes.data.bundle);
  });
});

