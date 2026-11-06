process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Setup High-Fidelity In-Memory MongoDB Stub for End-to-End Testing
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
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, expected] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(expected)) {
      const orMatched = expected.some((f) => matchesFilter(doc, f));
      if (!orMatched) return false;
      continue;
    }
    if (expected && typeof expected === 'object') {
      if ('$gte' in expected) {
        const val = key.includes('.')
          ? key.split('.').reduce((acc, part) => acc?.[part], doc)
          : doc[key];
        if (typeof val !== 'number' || val < (expected as any).$gte) return false;
        continue;
      }
      if ('$in' in expected && Array.isArray((expected as any).$in)) {
        const val = key.includes('.')
          ? key.split('.').reduce((acc, part) => acc?.[part], doc)
          : doc[key];
        if (!(expected as any).$in.includes(val)) return false;
        continue;
      }
    }
    const val = key.includes('.')
      ? key.split('.').reduce((acc, part) => acc?.[part], doc)
      : doc[key];
    if (val !== expected) return false;
  }
  return true;
}

function applyUpdate(doc: any, update: any): void {
  if (update.$inc) {
    for (const [key, val] of Object.entries(update.$inc)) {
      doc[key] = (doc[key] || 0) + Number(val);
    }
  }
  if (update.$set) {
    for (const [key, val] of Object.entries(update.$set)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let target = doc;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {};
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = val;
      } else {
        doc[key] = val;
      }
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
      async deleteOne(filter: any) {
        const idx = col.findIndex((item) => matchesFilter(item, filter));
        if (idx !== -1) {
          col.splice(idx, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      },
      async deleteMany(filter: any) {
        const before = col.length;
        const remaining = col.filter((item) => !matchesFilter(item, filter));
        inMemoryStore.set(name, remaining);
        return { deletedCount: before - remaining.length };
      },
      async countDocuments(filter: any = {}) {
        return col.filter((item) => matchesFilter(item, filter)).length;
      },
      find(filter: any = {}) {
        let results = col.filter((item) => matchesFilter(item, filter));
        return {
          sort(criteria: any) {
            if (criteria?.updated_at === -1 || criteria?.createdAt === -1) {
              results.sort((a, b) => new Date(b.updated_at || b.createdAt || 0).getTime() - new Date(a.updated_at || a.createdAt || 0).getTime());
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

// Import Phase 0–9 Subsystem Services
import { userAccountService } from '../src/services/userAccountService.js';
import { candidateProfileService } from '../src/services/candidateProfileService.js';
import { candidatePreferencesService } from '../src/services/candidatePreferencesService.js';
import { candidateOnboardingService } from '../src/services/candidateOnboardingService.js';
import { truthEngineService } from '../src/services/truthEngineService.js';
import { resumeAnalyzerService } from '../src/services/resumeAnalyzerService.js';
import { jobDiscoveryService } from '../src/services/jobDiscoveryService.js';
import { matchService } from '../src/services/matchService.js';
import { applicationWorkspaceService } from '../src/services/assistant/applicationWorkspaceService.js';
import { coverLetterService } from '../src/services/assistant/coverLetterService.js';
import { trackerService } from '../src/services/tracker/trackerService.js';
import { trackerTimelineService } from '../src/services/tracker/trackerTimelineService.js';
import { submissionEvidenceService } from '../src/services/tracker/submissionEvidenceService.js';
import { interviewService } from '../src/services/tracker/interviewService.js';
import { progeniIntegrationService } from '../src/services/integration/progeniIntegrationService.js';
import { SubscriptionService } from '../src/services/billing/subscriptionService.js';
import { UsageCreditEngine } from '../src/services/billing/usageCreditEngine.js';
import { PaymentGatewayService } from '../src/services/billing/paymentGateway.js';

test('Phase 10 — Full Platform Production Hardening: 20-Stage End-to-End Lifecycle', async (t) => {
  const testCandidateId = `e2e_cand_${randomUUID().slice(0, 8)}`;
  const candidateEmail = `alex.hardened_${randomUUID().slice(0, 6)}@example.com`;
  const candidatePassword = 'SecurePassword!2026';

  let testResumeId: string;
  let testJobId: string;
  let testAppId: string;
  let testInterviewId: string;
  let testSessionId: string;

  // STAGE 1: Candidate Registration
  await t.test('Stage 01: Candidate Registration & Secure Identity Creation', async () => {
    const user = await userAccountService.syncUser(testCandidateId, candidateEmail, {
      role: 'candidate',
    });

    assert.equal(user.id, testCandidateId);
    assert.equal(user.email, candidateEmail);
    assert.equal(user.role, 'candidate');
    assert.equal(user.status, 'active');
  });

  // STAGE 2: Candidate Onboarding Wizard
  await t.test('Stage 02: 5-Stage Candidate Onboarding & Verified Consents', async () => {
    // Complete Stage 1 Personal Identity
    const personal = await candidateProfileService.upsert(testCandidateId, {
      full_name: 'Alex Vance',
      email: candidateEmail,
      phone: '+1-555-0199',
      city: 'Seattle',
      country: 'USA',
      linkedin_url: 'https://linkedin.com/in/alex-vance',
      github_url: 'https://github.com/alexvance',
      target_role: 'Senior Distributed Systems Engineer',
      skills: ['Go', 'Rust', 'Kubernetes', 'Distributed Systems', 'Raft', 'gRPC'],
      experience_years: 8,
    });
    assert.equal(personal.full_name, 'Alex Vance');

    // Complete Stage 2 Career Preferences
    const prefs = await candidatePreferencesService.upsert(testCandidateId, {
      desired_roles: ['Senior Distributed Systems Engineer', 'Staff Backend Architect'],
      preferred_locations: ['Remote', 'Seattle, WA'],
      workplace_type: 'remote',
      expected_salary: { currency: 'USD', min: 180000, max: 220000, period: 'yearly' },
      experience_level: 'senior',
      joining_availability: 'immediate',
      employment_type: 'full-time',
    });
    assert.equal(prefs.desired_roles[0], 'Senior Distributed Systems Engineer');

    // Accept Mandatory Consent Disclosures & advance progress
    const onboarding = await candidateOnboardingService.updateProgress(testCandidateId, {
      step: 5,
      completeStep: 5,
      status: 'completed',
      dataProcessingConsent: true,
      jobAssistanceConsent: true,
    });
    assert.equal(onboarding.consents.data_processing?.accepted, true);
    assert.equal(onboarding.consents.job_application_assistance?.accepted, true);
  });

  // STAGE 3: Resume Upload & Ingestion
  await t.test('Stage 03: Master Resume Upload & Provenance Grounding', async () => {
    testResumeId = randomUUID();
    await mockDb.collection('resumes').insertOne({
      _id: testResumeId,
      id: testResumeId,
      user_id: testCandidateId,
      is_master: true,
      title: 'Canonical Master Technical Resume',
      content: {
        personal_info: {
          full_name: 'Alex Vance',
          email: candidateEmail,
          phone: '+1-555-0199',
          city: 'Seattle',
          country: 'USA',
          target_role: 'Senior Distributed Systems Engineer',
        },
        summary: 'Distinguished Distributed Systems Engineer with 8+ years designing fault-tolerant consensus clusters in Go and Rust.',
        skills: [
          { name: 'Distributed Systems', category: 'core' },
          { name: 'Go', category: 'languages' },
          { name: 'Rust', category: 'languages' },
          { name: 'Raft', category: 'consensus' },
          { name: 'Kubernetes', category: 'infra' },
          { name: 'gRPC', category: 'networking' },
        ],
        work_experience: [
          {
            id: 'exp_1',
            company: 'Cloud Scale Inc.',
            role: 'Senior Systems Engineer',
            start_date: '2021-01',
            end_date: 'Present',
            current: true,
            highlights: ['Architected distributed raft log compaction reducing cluster failover p99 latency to 12ms.'],
          },
        ],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const resumeDoc = await mockDb.collection('resumes').findOne({ user_id: testCandidateId });
    assert.ok(resumeDoc);
    assert.equal(resumeDoc.content.skills.length, 6);
  });

  // STAGE 4: Truth Engine & Claim Verification
  await t.test('Stage 04: Truth Engine Claim Extraction & Verification Status', async () => {
    const claims = await truthEngineService.extractClaimsFromResumeAnalysis(testCandidateId, testResumeId, {
      fileName: 'alex_vance_master_resume.pdf',
      detected: {
        fullName: 'Alex Vance',
        experienceYears: 8,
        experienceEvidence: '8+ years designing fault-tolerant consensus clusters',
      },
      skills: [
        { skill: 'Distributed Systems', evidence: 'Core competency in distributed systems' },
        { skill: 'Go', evidence: 'Go development across distributed consensus engines' },
        { skill: 'Raft', evidence: 'Architected distributed raft log compaction' },
        { skill: 'Kubernetes', evidence: 'Kubernetes cluster deployment and operations' },
      ],
    });

    assert.ok(claims.length >= 4);
    const confirmedClaim = await truthEngineService.confirmClaim(testCandidateId, claims[0].id, true);
    assert.ok(
      confirmedClaim.verification_status === 'candidate_confirmed' ||
        confirmedClaim.verification_status === 'verified_from_source',
    );
  });

  // STAGE 5: Resume Analyzer & ATS Keyword Diagnostics
  await t.test('Stage 05: Explainable ATS Compatibility Diagnostics', async () => {
    const sampleResumeText = `
Alex Vance
alex.vance@example.com
+1-555-0199
https://linkedin.com/in/alex-vance
Seattle, WA, USA

SUMMARY
Distinguished Distributed Systems Engineer and Lead Cloud Architect with 8+ years designing, building, and deploying fault-tolerant consensus clusters in Go and Rust across high-throughput production cloud infrastructures.

WORK EXPERIENCE
Senior Systems Architect | Cloud Scale Inc.
- Architected and implemented distributed raft log compaction protocols reducing cluster failover p99 latency by 45% and cutting disk usage by 30%.
- Designed and automated multi-region Kubernetes clusters handling 500,000+ requests per second with 99.999% availability across 12 data centers.
- Spearheaded optimization of gRPC messaging pipelines, accelerating inter-node throughput by 60% and decreasing CPU utilization by 25%.
- Mentored 14 distributed systems engineers and directed technical migrations saving $1.2M annually in compute costs.

TECHNICAL SKILLS
Languages: Go, Rust, TypeScript, Python, C++
Distributed Systems: Raft, Paxos, gRPC, Protocol Buffers, Kafka, Redis
Infrastructure & DevOps: Kubernetes, Docker, Terraform, AWS, Prometheus, Grafana

EDUCATION
Bachelor of Science in Computer Science | University of Washington
`;
    const report = resumeAnalyzerService.diagnoseATS(sampleResumeText);

    assert.ok(report.overallScore >= 75);
    assert.ok(report.categories.contactInfo.earnedScore >= 15);
    assert.ok(report.categories.actionPhrasing.earnedScore >= 15);
  });

  // STAGE 6: Multi-Source Job Discovery
  await t.test('Stage 06: Multi-Source Job Discovery & Ingestion', async () => {
    testJobId = `job_${randomUUID().slice(0, 8)}`;
    await mockDb.collection('jobs').insertOne({
      _id: testJobId,
      id: testJobId,
      external_job_id: 'gh_99182',
      provider: 'greenhouse',
      title: 'Senior Distributed Systems Engineer',
      job_title: 'Senior Distributed Systems Engineer',
      company: 'Distributed Labs',
      company_name: 'Distributed Labs',
      location: 'Remote',
      is_remote: true,
      workplace_mode: 'remote',
      description: 'Distributed Labs is scaling our raft consensus coordinator. Required skills: Go, Raft, Kubernetes, gRPC, Distributed Systems.',
      job_description: 'Distributed Labs is scaling our raft consensus coordinator. Required skills: Go, Raft, Kubernetes, gRPC, Distributed Systems.',
      required_skills: ['Go', 'Raft', 'Kubernetes', 'gRPC', 'Distributed Systems'],
      skills: ['Go', 'Raft', 'Kubernetes', 'gRPC', 'Distributed Systems'],
      preferred_skills: ['Rust', 'Prometheus'],
      experience_min: 5,
      experience_max: 10,
      salary_currency: 'USD',
      salary_min: 190000,
      salary_max: 220000,
      status: 'active',
      canonical_url: 'https://boards.greenhouse.io/distributedlabs/jobs/99182',
      posted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const job = await mockDb.collection('jobs').findOne({ _id: testJobId });
    assert.ok(job);
    assert.equal(job.provider, 'greenhouse');
  });

  // STAGE 7: Deterministic Job Matching & Ranking
  await t.test('Stage 07: 6-Dimension Deterministic Job Match Scoring', async () => {
    const matches = await matchService.recalculateMatches(testCandidateId, { jobIds: [testJobId] });
    assert.ok(matches.length > 0);
    const match = matches[0];
    assert.ok(match.overall_score >= 70);
    assert.equal(match.eligibility_status, 'eligible');
    assert.ok(match.dimension_scores.skills_alignment >= 70);
    assert.ok(match.matched_skills.length >= 4);
  });

  // STAGE 8: Application Workspace Creation
  await t.test('Stage 08: Application Workspace Creation with Grounded Snapshots', async () => {
    const workspace = await applicationWorkspaceService.createWorkspace(
      testCandidateId,
      { jobId: testJobId },
    );
    testAppId = workspace.id;
    assert.ok(testAppId);
    assert.equal(workspace.status, 'discovered');
    assert.equal(workspace.jobSnapshot.company, 'Distributed Labs');
  });

  // STAGE 9: Metered Credit Account Initialization
  await t.test('Stage 09: Usage & Credit Engine Initialization', async () => {
    const account = await UsageCreditEngine.getOrCreateAccount(testCandidateId, 'free');
    assert.equal(account.balance, 50); // Initial 50 credits
  });

  // STAGE 10: Grounded Resume Tailoring & Credit Deduction
  await t.test('Stage 10: AI Resume Tailoring (5 Credits Metered)', async () => {
    const tailored = await applicationWorkspaceService.generateTailoredResume(
      testCandidateId,
      testAppId,
    );
    assert.ok(tailored.targetedResumeId);
    assert.ok(tailored.targetedResumeSnapshot);

    // Deduct 5 credits for resume tailoring
    const deductRes = await UsageCreditEngine.deductCredits(testCandidateId, 'resume_generation', {
      referenceId: testAppId,
      description: 'AI resume tailoring for Distributed Labs',
    });
    assert.equal(deductRes.balanceRemaining, 45); // 50 - 5
  });

  // STAGE 11: Cover Letter Generation & Credit Deduction
  await t.test('Stage 11: Cover Letter Generation Across Tone Presets (3 Credits Metered)', async () => {
    const coverLetter = await coverLetterService.generateCoverLetter(testCandidateId, {
      jobTitle: 'Senior Distributed Systems Engineer',
      companyName: 'Distributed Labs',
      jobDescription: 'Raft consensus coordinator with Go and Kubernetes',
      tone: 'enthusiastic',
    });
    assert.ok(coverLetter.content.includes('Distributed Labs'));
    assert.equal(coverLetter.tone, 'enthusiastic');

    const deductRes = await UsageCreditEngine.deductCredits(testCandidateId, 'cover_letter', {
      referenceId: testAppId,
      description: 'Cover letter generation for Distributed Labs',
    });
    assert.equal(deductRes.balanceRemaining, 42); // 45 - 3
  });

  // STAGE 12: Screening Question Assistant & Refusal to Hallucinate
  await t.test('Stage 12: Grounded Screening Questions & Anti-Hallucination Guard', async () => {
    const updated = await applicationWorkspaceService.generateScreeningAnswers(
      testCandidateId,
      testAppId,
      [
        'What is your full legal name?',
        'How many years of professional experience do you have?',
        'Do you now or will you in the future require visa sponsorship?',
        'What are your expected salary compensation requirements?',
      ],
    );
    const nameAnswer = updated.screeningAnswers.find((a) => a.question.includes('full legal name'));
    assert.ok(nameAnswer);
    assert.equal(nameAnswer?.answer, 'Alex Vance');
    assert.equal(nameAnswer?.confidence, 1.0);
    assert.equal(nameAnswer?.isGrounded, true);

    const visaAnswer = updated.screeningAnswers.find((a) => a.question.includes('visa sponsorship'));
    assert.ok(visaAnswer);
    assert.equal(visaAnswer?.status, 'manual_input_required');
    assert.equal(visaAnswer?.answer, null);

    const deductRes = await UsageCreditEngine.deductCredits(testCandidateId, 'screening_answer', {
      referenceId: testAppId,
      description: 'Screening answer for consensus experience',
    });
    assert.equal(deductRes.balanceRemaining, 41); // 42 - 1
  });

  // STAGE 13: Strict Candidate Approval Gate
  await t.test('Stage 13: Strict Digital Signature Approval Gate', async () => {
    const preApproval = await applicationWorkspaceService.getWorkspace(testCandidateId, testAppId);
    assert.equal(preApproval?.approval.isApproved, false);

    const approval = await applicationWorkspaceService.approveApplication(
      testCandidateId,
      testAppId,
      { signature: 'Alex Vance (Digital Attestation)' },
    );
    assert.equal(approval.approval.isApproved, true);
    assert.equal(approval.approval.approvedBy, testCandidateId);
    assert.equal(approval.approval.approvalSignature, 'Alex Vance (Digital Attestation)');
    assert.equal(approval.status, 'prepared');
  });

  // STAGE 14: Submission Evidence Logging
  await t.test('Stage 14: Verified Submission Evidence & Destination Receipt', async () => {
    const evidence = await submissionEvidenceService.recordSubmissionEvidence(
      testCandidateId,
      testAppId,
      {
        submissionMethod: 'extension_assisted',
        destination: 'https://boards.greenhouse.io/distributedlabs/jobs/99182',
        confirmationReference: 'GH-APP-2026-99182',
        notes: 'Submitted via candidate-confirmed Chrome MV3 Autofill helper.',
      },
    );

    assert.equal(evidence.submissionMethod, 'extension_assisted');
    assert.equal(evidence.confirmationReference, 'GH-APP-2026-99182');
    assert.equal(evidence.verificationStatus, 'candidate_reported');
  });

  // STAGE 15: Application Lifecycle Transitions
  await t.test('Stage 15: Legal Lifecycle Transitions & Anti-Illegal Jump Enforcement', async () => {
    // Application was transitioned to 'submitted' by verified evidence recording in Stage 14
    // 1. Move to under_review
    await trackerService.updateStatus(testCandidateId, testAppId, 'under_review');
    // 2. Move to shortlisted
    await trackerService.updateStatus(testCandidateId, testAppId, 'shortlisted');
    // 3. Move to interview_scheduled
    const current = await trackerService.updateStatus(
      testCandidateId,
      testAppId,
      'interview_scheduled',
    );

    assert.equal(current.status, 'interview_scheduled');

    // Verify illegal jump is rejected
    await assert.rejects(
      () => trackerService.updateStatus(testCandidateId, testAppId, 'preparing'),
      /Invalid status transition/,
    );
  });

  // STAGE 16: Interview Scheduling & Timeline Audit
  await t.test('Stage 16: Interview Scheduling, In-App Notifications, & Calendar Sync', async () => {
    const interview = await interviewService.createInterview(testCandidateId, {
      applicationId: testAppId,
      stage: 'technical_interview',
      scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      durationMinutes: 60,
      interviewMode: 'video',
      meetingLink: 'https://meet.google.com/xyz-pro-geni',
      interviewerDetails: { name: 'Sarah Connor', title: 'VP of Engineering' },
      preparationNotes: 'Deep dive into Raft consensus log compaction & fault isolation topologies.',
    });

    testInterviewId = interview.id;
    assert.ok(testInterviewId);
    assert.equal(interview.stage, 'technical_interview');

    // Check timeline event
    const timeline = await trackerTimelineService.getTimeline(testCandidateId, testAppId);
    assert.ok(timeline.some((e) => e.eventType === 'interview_scheduled'));
  });

  // STAGE 17: Progeni Atlas Technical Simulation Launch
  await t.test('Stage 17: Progeni Atlas AI Simulation Launch (10 Credits Metered)', async () => {
    const launchResult = await progeniIntegrationService.launchInterviewSession(testCandidateId, {
      applicationId: testAppId,
      interviewId: testInterviewId,
    });

    testSessionId = launchResult.sessionId;
    assert.ok(testSessionId);
    assert.ok(launchResult.targetUrl.includes('sso_token='));
    assert.equal(launchResult.simulation.isAiSimulation, true);

    // Deduct 10 credits for technical simulation
    const deductRes = await UsageCreditEngine.deductCredits(testCandidateId, 'interview_simulation', {
      referenceId: testSessionId,
      description: 'Progeni Atlas live technical interview simulation',
    });
    assert.equal(deductRes.balanceRemaining, 31); // 41 - 10
  });

  // STAGE 18: Progeni Atlas Scorecard Synchronization (Truth Isolation)
  await t.test('Stage 18: Result Synchronization & Truth Separation Verification', async () => {
    // Populate authoritative Progeni Atlas session scorecard
    await mockDb.collection('interview_sessions').updateOne(
      { _id: testSessionId },
      {
        $set: {
          total_score: 93.5,
          final_recommendation: 'STRONG_HIRE',
          percentileRank: 95,
          competencyPillars: {
            algorithmicProblemSolving: 96,
            systemArchitecture: 95,
            codeQualityAndSyntax: 91,
            communicationAndClarity: 92,
          },
          executiveSummary: 'Flawless execution of distributed raft log compaction algorithm with zero regression.',
        },
      },
    );

    const synced = await progeniIntegrationService.syncInterviewResult(
      testCandidateId,
      testSessionId,
    );

    assert.equal(synced.status, 'completed');
    assert.equal(synced.overallScore, 93.5);
    assert.equal(synced.hiringRecommendation, 'STRONG_HIRE');
    assert.equal(synced.isAiSimulation, true); // Strict zero-confusion guard
  });

  // STAGE 19: Subscription Upgrade via Razorpay Gateway Sandbox
  await t.test('Stage 19: Razorpay Payment Sandbox & Immediate Pro Quota Expansion', async () => {
    // Create Pro subscription order
    const order = await PaymentGatewayService.createOrder({
      candidateId: testCandidateId,
      tier: 'pro',
      interval: 'month',
      amount: 999,
      currency: 'INR',
    });

    const paymentId = `pay_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const signature = `mock_sig_${order.orderId}_${paymentId}`;

    // Verify & capture payment
    const captureResult = await PaymentGatewayService.verifyAndCapturePayment({
      orderId: order.orderId,
      paymentId,
      signature,
      candidateId: testCandidateId,
    });

    assert.equal(captureResult.success, true);
    assert.equal(captureResult.transaction.status, 'captured');
    assert.ok(captureResult.transaction.invoiceNumber.startsWith('INV-'));

    // Upgrade subscription to Pro
    const sub = await SubscriptionService.upgradeSubscription(
      testCandidateId,
      'pro',
      'month',
      paymentId,
    );
    assert.equal(sub.tier, 'pro');
    assert.equal(sub.status, 'active');

    // Credit account expanded to 500 Pro monthly quota
    const updatedAccount = await UsageCreditEngine.getOrCreateAccount(testCandidateId);
    assert.equal(updatedAccount.balance, 500);
    assert.equal(updatedAccount.monthlyQuota, 500);
  });

  // STAGE 20: Candidate Billing Receipt & Invoice Verification
  await t.test('Stage 20: Candidate Billing Receipt Verification & Audit Log Confirmation', async () => {
    const invoices = await PaymentGatewayService.listCandidateTransactions(testCandidateId);
    assert.equal(invoices.total, 1);
    assert.equal(invoices.transactions[0].tier, 'pro');
    assert.equal(invoices.transactions[0].amount, 999);
    assert.equal(invoices.transactions[0].currency, 'INR');

    // Usage history verification
    const usage = await UsageCreditEngine.getUsageHistory(testCandidateId);
    assert.ok(usage.entries.length >= 4);
    assert.ok(usage.entries.some((e) => e.service === 'resume_generation'));
    assert.ok(usage.entries.some((e) => e.service === 'cover_letter'));
    assert.ok(usage.entries.some((e) => e.service === 'interview_simulation'));
  });
});
