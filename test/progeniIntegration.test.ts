process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, expected] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(expected)) {
      const orMatched = expected.some((f) => matchesFilter(doc, f));
      if (!orMatched) return false;
      continue;
    }
    if (expected && typeof expected === 'object') {
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
      find(filter: any) {
        let results = col.filter((item) => matchesFilter(item, filter));
        return {
          sort() {
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

import { progeniSsoService } from '../src/services/integration/progeniSsoService.js';
import { progeniIntegrationService } from '../src/services/integration/progeniIntegrationService.js';
import { trackerTimelineService } from '../src/services/tracker/trackerTimelineService.js';
import { notificationService } from '../src/services/tracker/notificationService.js';
import { getDatabase } from '../src/config/mongodb.js';

test('Phase 8 — Existing Progeni Interviewer Platform Integration Subsystem', async (t) => {
  const candidateA = `cand_A_${randomUUID()}`;
  const candidateB = `cand_B_${randomUUID()}`;
  const db = await getDatabase();

  // Helper to create test candidate profile
  await db.collection('candidate_profiles').insertOne({
    _id: `profile_${candidateA}`,
    user_id: candidateA,
    fullName: 'Alex Vance',
    email: 'alex.vance@example.com',
  });

  // Helper to create test application doc
  const testAppId = randomUUID();
  await db.collection('applications').insertOne({
    _id: testAppId,
    id: testAppId,
    user_id: candidateA,
    job_id: 'job_progeni_101',
    status: 'interview_scheduled',
    jobSnapshot: {
      title: 'Senior Systems Architect',
      company: 'Distributed Labs',
      location: 'Remote',
      description: 'Lead design of distributed consensus engines, Raft/Paxos state machines, and low-latency gRPC services.',
      requiredSkills: ['Distributed Systems', 'Go', 'Raft', 'Kubernetes', 'gRPC'],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await t.test('1. SSO Launch Token: mints and verifies HMAC-SHA256 signed ticket', () => {
    const sso = progeniSsoService.mintLaunchToken({
      candidateId: candidateA,
      email: 'alex.vance@example.com',
      name: 'Alex Vance',
      applicationId: testAppId,
      ttlMinutes: 15,
    });

    assert.ok(sso.token);
    assert.ok(sso.ticketId);
    assert.ok(sso.expiresAt);

    // Verify valid token
    const verification = progeniSsoService.verifyLaunchToken(sso.token);
    assert.equal(verification.valid, true);
    assert.equal(verification.claims?.sub, candidateA);
    assert.equal(verification.claims?.email, 'alex.vance@example.com');
    assert.equal(verification.claims?.app_id, testAppId);
    assert.equal(verification.claims?.iss, 'auto-apply-ai');
    assert.equal(verification.claims?.aud, 'progeni-atlas');

    // Rejection of tampered token
    const tampered = sso.token.slice(0, -5) + 'abcde';
    const tamperedCheck = progeniSsoService.verifyLaunchToken(tampered);
    assert.equal(tamperedCheck.valid, false);

    // Rejection of expired token
    const expiredSso = progeniSsoService.mintLaunchToken({
      candidateId: candidateA,
      email: 'alex.vance@example.com',
      applicationId: testAppId,
      ttlMinutes: -1, // Expired 1 minute ago
    });
    const expiredCheck = progeniSsoService.verifyLaunchToken(expiredSso.token);
    assert.equal(expiredCheck.valid, false);
    assert.equal(expiredCheck.error, 'Token has expired');
  });

  await t.test('2. Application Context Preparation: extracts zero-hallucinated job and candidate context', async () => {
    const context = await progeniIntegrationService.prepareApplicationContext(
      candidateA,
      testAppId,
    );

    assert.equal(context.candidateId, candidateA);
    assert.equal(context.candidateEmail, 'alex.vance@example.com');
    assert.equal(context.candidateName, 'Alex Vance');
    assert.equal(context.companyName, 'Distributed Labs');
    assert.equal(context.jobRole, 'Senior Systems Architect');
    assert.ok(context.jobDescription.includes('Raft/Paxos'));
    assert.deepEqual(context.requiredSkills, ['Distributed Systems', 'Go', 'Raft', 'Kubernetes', 'gRPC']);
  });

  await t.test('3. Launch Interview Simulation: initializes Progeni session, records simulation, timeline, & notification', async () => {
    const launchResult = await progeniIntegrationService.launchInterviewSession(candidateA, {
      applicationId: testAppId,
    });

    assert.ok(launchResult.sessionId);
    assert.ok(launchResult.targetUrl.includes(launchResult.sessionId));
    assert.ok(launchResult.targetUrl.includes('sso_token='));
    assert.equal(launchResult.simulation.candidateId, candidateA);
    assert.equal(launchResult.simulation.status, 'launched');
    assert.equal(launchResult.simulation.isAiSimulation, true);

    // Check timeline event was recorded
    const timeline = await trackerTimelineService.getTimeline(candidateA, testAppId);
    const hasLaunchEvent = timeline.some((e) => e.title === 'AI Interview Simulation Launched');
    assert.equal(hasLaunchEvent, true);

    // Check in-app notification was dispatched
    const notifications = await notificationService.listNotifications(candidateA);
    const hasNotif = notifications.some((n) => n.entityId === launchResult.sessionId);
    assert.equal(hasNotif, true);

    // Store sample Progeni report data into mockDb interview_sessions for synchronization test
    await db.collection('interview_sessions').updateOne(
      { _id: launchResult.sessionId },
      {
        $set: {
          total_score: 91.5,
          final_recommendation: 'STRONG_HIRE',
          percentileRank: 92,
          competencyPillars: {
            algorithmicProblemSolving: 94,
            systemArchitecture: 95,
            codeQualityAndSyntax: 88,
            communicationAndClarity: 90,
          },
          executiveSummary: 'Outstanding grasp of distributed consensus and fault isolation primitives.',
          verifiedStrengths: ['Deep knowledge of Raft log compaction', 'Clear architectural communication'],
          targetedGrowthAreas: ['Explore multi-region consistent hashing topologies'],
        },
      },
    );

    // 4. Synchronize Interview Result
    const synced = await progeniIntegrationService.syncInterviewResult(
      candidateA,
      launchResult.sessionId,
    );

    assert.equal(synced.status, 'completed');
    assert.equal(synced.overallScore, 91.5);
    assert.equal(synced.hiringRecommendation, 'STRONG_HIRE');
    assert.equal(synced.percentileRank, 92);
    assert.equal(synced.isAiSimulation, true); // Verified truth constraint

    // Check completed timeline event was appended
    const updatedTimeline = await trackerTimelineService.getTimeline(candidateA, testAppId);
    const hasCompleteEvent = updatedTimeline.some((e) => e.title.includes('AI Interview Simulation Scorecard'));
    assert.equal(hasCompleteEvent, true);
  });

  await t.test('4. Multi-Tenant IDOR Defense: Candidate B strictly blocked from Candidate A sessions', async () => {
    // Candidate B cannot prepare context for Candidate A application
    await assert.rejects(
      () => progeniIntegrationService.prepareApplicationContext(candidateB, testAppId),
      /Application .* not found or access denied/,
    );

    // Candidate B cannot launch simulation for Candidate A application
    await assert.rejects(
      () =>
        progeniIntegrationService.launchInterviewSession(candidateB, {
          applicationId: testAppId,
        }),
      /Application .* not found or access denied/,
    );

    // Candidate B list shows empty simulations
    const simsB = await progeniIntegrationService.listCandidateSimulations(candidateB);
    assert.equal(simsB.length, 0);
  });

  await t.test('5. Webhook Signature Verification: validates authentic Progeni payloads and rejects forged requests', () => {
    const payload = JSON.stringify({
      event: 'interview_completed',
      sessionId: 'sess_123',
      candidateId: candidateA,
    });

    const secret = 'progeni_atlas_webhook_signing_secret';
    const { createHmac } = require('node:crypto');
    const validSignature = createHmac('sha256', secret).update(payload).digest('hex');

    assert.equal(
      progeniIntegrationService.verifyWebhookSignature(payload, validSignature),
      true,
    );

    assert.equal(
      progeniIntegrationService.verifyWebhookSignature(payload, 'forged_invalid_signature_hex'),
      false,
    );
  });
});
