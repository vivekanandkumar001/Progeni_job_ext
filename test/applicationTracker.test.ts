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
      if ('$regex' in expected) {
        const val = key.includes('.')
          ? key.split('.').reduce((acc, part) => acc?.[part], doc)
          : doc[key];
        const re = new RegExp((expected as any).$regex, (expected as any).$options || 'i');
        if (!re.test(String(val || ''))) return false;
        continue;
      }
      if ('$in' in expected && Array.isArray((expected as any).$in)) {
        const val = key.includes('.')
          ? key.split('.').reduce((acc, part) => acc?.[part], doc)
          : doc[key];
        if (!(expected as any).$in.includes(val)) return false;
        continue;
      }
      if ('$gte' in expected || '$lte' in expected) {
        const val = doc[key];
        if ('$gte' in expected && val < (expected as any).$gte) return false;
        if ('$lte' in expected && val > (expected as any).$lte) return false;
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
  if (update.$push) {
    for (const [key, val] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[key])) doc[key] = [];
      doc[key].push(val);
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
        const before = col.length;
        const remaining = col.filter((item) => !matchesFilter(item, filter));
        inMemoryStore.set(name, remaining);
        return { deletedCount: before - remaining.length };
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
            } else if (sortCriteria?.scheduledAt === 1) {
              results.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
            } else if (sortCriteria?.followUpDate === 1) {
              results.sort((a, b) => String(a.followUpDate).localeCompare(String(b.followUpDate)));
            } else if (sortCriteria?.timestamp === 1) {
              results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            } else if (sortCriteria?.createdAt === -1) {
              results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

import { lifecycleRules } from '../src/services/tracker/lifecycleRules.js';
import { trackerTimelineService } from '../src/services/tracker/trackerTimelineService.js';
import { submissionEvidenceService } from '../src/services/tracker/submissionEvidenceService.js';
import { interviewService } from '../src/services/tracker/interviewService.js';
import { followUpService } from '../src/services/tracker/followUpService.js';
import { notificationService } from '../src/services/tracker/notificationService.js';
import { analyticsService } from '../src/services/tracker/analyticsService.js';
import { trackerService } from '../src/services/tracker/trackerService.js';
import { getDatabase } from '../src/config/mongodb.js';

test('Phase 7 — Application Tracker & Interview Pipeline Subsystem', async (t) => {
  const candidateA = `cand_A_${randomUUID()}`;
  const candidateB = `cand_B_${randomUUID()}`;
  const db = await getDatabase();

  // Helper to create test application doc
  async function createTestApplication(candidateId: string, status = 'discovered') {
    const id = randomUUID();
    const doc = {
      _id: id,
      id,
      user_id: candidateId,
      job_id: `job_${randomUUID()}`,
      status,
      jobSnapshot: {
        title: 'Senior Distributed Systems Engineer',
        company: 'CloudScale AI',
        location: 'San Francisco, CA',
        source: 'greenhouse',
        url: 'https://boards.greenhouse.io/cloudscale/jobs/12345',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.collection('applications').insertOne(doc);
    return doc;
  }

  await t.test('1. Lifecycle Rules: verifies legal transitions and strictly blocks illegal jumps', () => {
    // Valid progressive path
    assert.equal(lifecycleRules.canTransition('discovered', 'preparing'), true);
    assert.equal(lifecycleRules.canTransition('preparing', 'ready_for_review'), true);
    assert.equal(lifecycleRules.canTransition('ready_for_review', 'approved'), true);
    assert.equal(lifecycleRules.canTransition('approved', 'submitted'), true);
    assert.equal(lifecycleRules.canTransition('submitted', 'under_review'), true);
    assert.equal(lifecycleRules.canTransition('under_review', 'shortlisted'), true);
    assert.equal(lifecycleRules.canTransition('shortlisted', 'interview_scheduled'), true);
    assert.equal(lifecycleRules.canTransition('interview_scheduled', 'offer_received'), true);
    assert.equal(lifecycleRules.canTransition('offer_received', 'offer_accepted'), true);
    assert.equal(lifecycleRules.canTransition('offer_accepted', 'closed'), true);

    // Terminal states
    assert.equal(lifecycleRules.isTerminal('closed'), true);
    assert.equal(lifecycleRules.isTerminal('failed'), true);
    assert.equal(lifecycleRules.isTerminal('discovered'), false);

    // Illegal jumps
    assert.equal(lifecycleRules.canTransition('discovered', 'offer_received'), false);
    assert.equal(lifecycleRules.canTransition('closed', 'discovered'), false);
    assert.equal(lifecycleRules.canTransition('rejected', 'interview_scheduled'), false);

    // assertValidTransition throws descriptive error
    assert.throws(
      () => lifecycleRules.assertValidTransition('discovered', 'offer_accepted'),
      /Invalid status transition/,
    );
  });

  await t.test('2. Submission Evidence: records verified proof vs candidate-reported vs unverified', async () => {
    const app = await createTestApplication(candidateA, 'approved');

    // Test verified submission with reference
    const verifiedEvidence = await submissionEvidenceService.recordSubmissionEvidence(
      candidateA,
      app._id,
      {
        destination: 'https://boards.greenhouse.io/cloudscale/applications',
        submissionMethod: 'direct_api',
        confirmationReference: 'APP-GH-998812',
        notes: 'API direct submission confirmed',
      },
    );

    assert.equal(verifiedEvidence.verificationStatus, 'verified');
    assert.equal(verifiedEvidence.confirmationReference, 'APP-GH-998812');
    assert.equal(verifiedEvidence.auditHistory.length, 1);

    // Check application document status was updated to 'submitted'
    const updatedApp = await db.collection<any>('applications').findOne({ _id: app._id });
    assert.equal(updatedApp?.status, 'submitted');
    assert.equal(updatedApp?.submission_evidence?.verificationStatus, 'verified');

    // Test candidate_reported classification when manual without formal ref
    const app2 = await createTestApplication(candidateA, 'approved');
    const reportedEvidence = await submissionEvidenceService.recordSubmissionEvidence(
      candidateA,
      app2._id,
      {
        destination: 'https://jobs.lever.co/targetcorp',
        submissionMethod: 'manual',
        confirmationEvidence: {
          type: 'email_snippet',
          value: 'Thank you for your application to TargetCorp',
          submittedAt: new Date().toISOString(),
        },
        notes: 'Candidate received confirmation email snippet',
      },
    );
    assert.equal(reportedEvidence.verificationStatus, 'candidate_reported');

    // Truth enforcement: claiming 'verified' without reference or proof falls back to candidate_reported
    const app3 = await createTestApplication(candidateA, 'approved');
    const downgradedEvidence = await submissionEvidenceService.recordSubmissionEvidence(
      candidateA,
      app3._id,
      {
        destination: 'https://jobs.example.com',
        submissionMethod: 'manual',
        verificationStatus: 'verified', // False claim without proof
      },
    );
    assert.equal(downgradedEvidence.verificationStatus, 'candidate_reported');
  });

  await t.test('3. Timeline Service: records chronological, immutable audit events', async () => {
    const app = await createTestApplication(candidateA, 'discovered');

    await trackerTimelineService.recordEvent(candidateA, app._id, {
      eventType: 'created',
      title: 'Workspace Initialized',
      description: 'Candidate initialized application workspace for CloudScale AI',
    });

    await trackerTimelineService.recordEvent(candidateA, app._id, {
      eventType: 'resume_tailored',
      title: 'Resume Tailored',
      description: 'Grounded resume generated targeting Senior Distributed Systems Engineer',
    });

    const timeline = await trackerTimelineService.getTimeline(candidateA, app._id);
    assert.equal(timeline.length, 2);
    assert.equal(timeline[0].eventType, 'created');
    assert.equal(timeline[1].eventType, 'resume_tailored');
  });

  await t.test('4. Interview Management: scheduling, updating, feedback, and calendar tracking', async () => {
    const app = await createTestApplication(candidateA, 'under_review');

    // Schedule interview
    const scheduledDate = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days in future
    const interview = await interviewService.createInterview(candidateA, {
      applicationId: app._id,
      stage: 'technical_interview',
      scheduledAt: scheduledDate,
      timezone: 'America/Los_Angeles',
      durationMinutes: 60,
      interviewMode: 'video',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      interviewerDetails: {
        name: 'Sarah Chen',
        title: 'VP of Engineering',
        email: 'sarah@cloudscale.ai',
      },
      preparationNotes: 'Review Raft consensus and DynamoDB partitioning',
    });

    assert.equal(interview.stage, 'technical_interview');
    assert.equal(interview.meetingLink, 'https://meet.google.com/abc-defg-hij');
    assert.equal(interview.status, 'scheduled');

    // Check application transitioned to 'interview_scheduled'
    const appDoc = await db.collection<any>('applications').findOne({ _id: app._id });
    assert.equal(appDoc?.status, 'interview_scheduled');

    // Check timeline event was appended
    const timeline = await trackerTimelineService.getTimeline(candidateA, app._id);
    const hasInterviewEvent = timeline.some((e) => e.eventType === 'interview_scheduled');
    assert.equal(hasInterviewEvent, true);

    // Check in-app notification was dispatched
    const notifications = await notificationService.listNotifications(candidateA);
    const interviewNotif = notifications.find((n) => n.entityId === interview.id);
    assert.ok(interviewNotif);
    assert.equal(interviewNotif.type, 'upcoming_interview');

    // Update interview with feedback
    const updated = await interviewService.updateInterview(candidateA, interview.id, {
      status: 'completed',
      feedback: {
        rating: 5,
        strengths: ['Deep knowledge of distributed state machines', 'Clear communication'],
        areasToImprove: ['Clarify edge case latency in gossip protocol'],
        overallImpression: 'Strong positive signal, recommend offer',
      },
      nextSteps: 'Await executive team sync on compensation tier',
    });

    assert.equal(updated?.status, 'completed');
    assert.equal(updated?.feedback?.rating, 5);

    // List interviews with stage filter
    const techInterviews = await interviewService.listInterviews(candidateA, {
      stage: 'technical_interview',
    });
    assert.equal(techInterviews.length, 1);
  });

  await t.test('5. Follow-Up Manager: scheduling, dynamic overdue detection, and action logging', async () => {
    const app = await createTestApplication(candidateA, 'submitted');

    // Future follow-up
    const futureDate = '2099-01-01';
    const followUpFuture = await followUpService.createFollowUp(candidateA, {
      applicationId: app._id,
      followUpDate: futureDate,
      nextAction: 'Send friendly status check email to recruiter',
      contactDetails: {
        name: 'Recruiter Alex',
        email: 'alex@cloudscale.ai',
        role: 'Technical Recruiter',
      },
    });

    assert.equal(followUpFuture.isOverdue, false);
    assert.equal(followUpFuture.status, 'pending');

    // Past follow-up (overdue)
    const pastDate = '2020-01-01';
    const followUpOverdue = await followUpService.createFollowUp(candidateA, {
      applicationId: app._id,
      followUpDate: pastDate,
      nextAction: 'Inquire about feedback after submission',
    });

    assert.equal(followUpOverdue.isOverdue, true);

    // Log action on overdue follow-up
    const logged = await followUpService.logFollowUpAction(candidateA, followUpOverdue.id, {
      action: 'Sent email inquiry to hiring manager',
      notes: 'Followed up via recruiter email thread',
      markCompleted: true,
    });

    assert.equal(logged?.status, 'completed');
    assert.equal(logged?.isOverdue, false);
    assert.equal(logged?.history.length, 2);

    // Overdue-only filter
    const overdueList = await followUpService.listFollowUps(candidateA, { overdueOnly: true });
    assert.equal(overdueList.some((f) => f.id === followUpOverdue.id), false); // Completed, so not overdue
  });

  await t.test('6. In-App Notifications & Idempotency Key deduplication', async () => {
    const key = `test_idempotency_key_${randomUUID()}`;

    const notif1 = await notificationService.createNotification(candidateA, {
      type: 'status_change',
      title: 'Status Update',
      message: 'Your application is under review',
      notificationKey: key,
    });

    // Attempt second notification with same key
    const notif2 = await notificationService.createNotification(candidateA, {
      type: 'status_change',
      title: 'Duplicate Status Update',
      message: 'Duplicate text that should be ignored',
      notificationKey: key,
    });

    assert.equal(notif1.id, notif2.id); // Exactly same record returned, no duplicate created

    // Mark as read
    const marked = await notificationService.markAsRead(candidateA, notif1.id);
    assert.equal(marked, true);

    // Mark all read
    await notificationService.markAllAsRead(candidateA);
    const unread = await notificationService.listNotifications(candidateA, true);
    assert.equal(unread.length, 0);
  });

  await t.test('7. Analytics Engine: transparent metrics and explicit denominators', async () => {
    const testCand = `analytics_cand_${randomUUID()}`;

    // Create 4 applications: 1 pending, 1 verified submitted, 1 candidate reported, 1 with interview
    const app1 = await createTestApplication(testCand, 'discovered');
    const app2 = await createTestApplication(testCand, 'approved');
    const app3 = await createTestApplication(testCand, 'submitted');
    const app4 = await createTestApplication(testCand, 'interview_scheduled');

    // Add submission evidence
    await submissionEvidenceService.recordSubmissionEvidence(testCand, app2._id, {
      destination: 'https://example.com/apply',
      submissionMethod: 'direct_api',
      confirmationReference: 'REF-1234',
    });

    await submissionEvidenceService.recordSubmissionEvidence(testCand, app3._id, {
      destination: 'https://example.com/apply2',
      submissionMethod: 'manual',
    });

    const analytics = await analyticsService.calculateApplicationAnalytics(testCand);

    assert.equal(analytics.totalApplications, 4);
    assert.equal(analytics.pendingApplications, 1); // app1 discovered
    assert.equal(analytics.verifiedSubmissions, 1); // app2
    assert.ok(analytics.candidateReportedSubmissions >= 1); // app3 & app4
    assert.equal(analytics.interviewsScheduled, 1); // app4

    // Check denominators and conversion rates
    assert.ok(analytics.denominators.responseRateDenominator.includes('verifiedSubmissions + candidateReportedSubmissions'));
    assert.ok(analytics.denominators.interviewRateDenominator.includes('verifiedSubmissions + candidateReportedSubmissions'));
    assert.ok(analytics.disclaimer.includes('Auto Apply AI provides tracking and assistance tools'));
  });

  await t.test('8. Tracker Service & Dossier aggregation', async () => {
    const app = await createTestApplication(candidateA, 'discovered');

    // Filter by company
    const list = await trackerService.listTrackedApplications(candidateA, {
      company: 'CloudScale',
    });
    assert.equal(list.applications.length >= 1, true);

    // Get complete dossier
    const dossier = await trackerService.getApplicationDossier(candidateA, app._id);
    assert.ok(dossier);
    assert.equal(dossier.application._id, app._id);
    assert.ok(Array.isArray(dossier.timeline));
    assert.ok(Array.isArray(dossier.interviews));
    assert.ok(Array.isArray(dossier.followUps));
  });

  await t.test('9. Multi-Tenant IDOR Security Isolation: Candidate B blocked from Candidate A records', async () => {
    const appA = await createTestApplication(candidateA, 'discovered');

    // Candidate B cannot get dossier
    const dossierB = await trackerService.getApplicationDossier(candidateB, appA._id);
    assert.equal(dossierB, null);

    // Candidate B cannot update status
    await assert.rejects(
      () => trackerService.updateStatus(candidateB, appA._id, 'preparing'),
      /Application .* not found or access denied/,
    );

    // Candidate B cannot record submission evidence
    await assert.rejects(
      () =>
        submissionEvidenceService.recordSubmissionEvidence(candidateB, appA._id, {
          destination: 'https://malicious.com',
          submissionMethod: 'manual',
        }),
      /Application .* not found for candidate/,
    );

    // Candidate B cannot schedule interview for Candidate A application
    await assert.rejects(
      () =>
        interviewService.createInterview(candidateB, {
          applicationId: appA._id,
          stage: 'coding_assessment',
          scheduledAt: new Date().toISOString(),
          interviewMode: 'video',
        }),
      /Application .* not found or access denied/,
    );

    // Candidate B cannot create follow-up for Candidate A application
    await assert.rejects(
      () =>
        followUpService.createFollowUp(candidateB, {
          applicationId: appA._id,
          followUpDate: '2026-12-01',
          nextAction: 'Steal data',
        }),
      /Application .* not found or access denied/,
    );
  });
});
