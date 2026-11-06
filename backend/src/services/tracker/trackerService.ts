import { getDatabase } from '../../config/mongodb.js';
import { lifecycleRules } from './lifecycleRules.js';
import { trackerTimelineService } from './trackerTimelineService.js';
import { notificationService } from './notificationService.js';
import { submissionEvidenceService } from './submissionEvidenceService.js';
import { interviewService } from './interviewService.js';
import { followUpService } from './followUpService.js';
import type {
  ApplicationLifecycleStatus,
  SubmissionEvidenceRecord,
  TimelineEvent,
  InterviewRecord,
  FollowUpRecord,
} from './types.js';

const APPLICATIONS_TABLE = 'applications';

export interface TrackerFilterOptions {
  q?: string;
  company?: string;
  title?: string;
  status?: string;
  source?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface TrackedApplicationSummary {
  id: string;
  candidateId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  location?: string;
  jobUrl?: string;
  source?: string;
  status: string;
  allowedTransitions: string[];
  submissionEvidence?: {
    submissionMethod: string;
    verificationStatus: string;
    submittedAt: string;
    confirmationReference?: string;
  };
  interviewsCount: number;
  pendingFollowUpsCount: number;
  hasOverdueFollowUp: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDossier {
  application: any;
  submissionEvidence: SubmissionEvidenceRecord | null;
  interviews: InterviewRecord[];
  followUps: FollowUpRecord[];
  timeline: TimelineEvent[];
  allowedTransitions: string[];
}

export class TrackerService {
  /**
   * Lists tracked applications for a candidate with advanced filters and pagination.
   */
  async listTrackedApplications(
    candidateId: string,
    options: TrackerFilterOptions = {},
  ): Promise<{
    applications: TrackedApplicationSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const db = await getDatabase();
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { user_id: candidateId };

    if (options.status) {
      const statuses = options.status.split(',').map((s) => s.trim());
      query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    if (options.company) {
      query['jobSnapshot.company'] = { $regex: options.company, $options: 'i' };
    }

    if (options.title) {
      query['jobSnapshot.title'] = { $regex: options.title, $options: 'i' };
    }

    if (options.source) {
      query['jobSnapshot.source'] = options.source;
    }

    if (options.fromDate || options.toDate) {
      query.created_at = {};
      if (options.fromDate) query.created_at.$gte = options.fromDate;
      if (options.toDate) query.created_at.$lte = options.toDate;
    }

    if (options.q) {
      const regex = { $regex: options.q, $options: 'i' };
      query.$or = [
        { 'jobSnapshot.company': regex },
        { 'jobSnapshot.title': regex },
        { 'jobSnapshot.location': regex },
        { 'submission_evidence.destination': regex },
      ];
    }

    const [rawDocs, total] = await Promise.all([
      db
        .collection<any>(APPLICATIONS_TABLE)
        .find(query)
        .sort({ updated_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection<any>(APPLICATIONS_TABLE).countDocuments(query),
    ]);

    // Fetch counts of interviews and follow-ups in batch for the retrieved applications
    const appIds = rawDocs.map((doc) => doc._id || doc.id);

    const [interviews, followUps] = await Promise.all([
      db
        .collection<any>('interviews')
        .find({ user_id: candidateId, application_id: { $in: appIds } })
        .toArray(),
      db
        .collection<any>('follow_ups')
        .find({ user_id: candidateId, application_id: { $in: appIds } })
        .toArray(),
    ]);

    const today = new Date().toISOString().slice(0, 10);

    const applications: TrackedApplicationSummary[] = rawDocs.map((doc) => {
      const appId = doc._id || doc.id;
      const status = doc.status || 'discovered';
      const appInterviews = interviews.filter((i) => (i.application_id || i.applicationId) === appId);
      const appFollowUps = followUps.filter((f) => (f.application_id || f.applicationId) === appId);
      const pendingFollowUps = appFollowUps.filter((f) => f.status === 'pending');
      const hasOverdueFollowUp = pendingFollowUps.some(
        (f) => f.followUpDate && f.followUpDate < today,
      );

      return {
        id: appId,
        candidateId: doc.user_id || doc.candidateId,
        jobId: doc.job_id || doc.jobId || '',
        company: doc.jobSnapshot?.company || 'Company',
        jobTitle: doc.jobSnapshot?.title || 'Position',
        location: doc.jobSnapshot?.location,
        jobUrl: doc.jobSnapshot?.url,
        source: doc.jobSnapshot?.source,
        status,
        allowedTransitions: lifecycleRules.getAllowedTransitions(status),
        submissionEvidence: doc.submission_evidence,
        interviewsCount: appInterviews.length,
        pendingFollowUpsCount: pendingFollowUps.length,
        hasOverdueFollowUp,
        createdAt: doc.created_at || new Date().toISOString(),
        updatedAt: doc.updated_at || new Date().toISOString(),
      };
    });

    return {
      applications,
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves complete application dossier: workspace, evidence, interviews, follow-ups, and timeline.
   */
  async getApplicationDossier(
    candidateId: string,
    applicationId: string,
  ): Promise<ApplicationDossier | null> {
    const db = await getDatabase();
    const appDoc = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: applicationId,
      user_id: candidateId,
    });

    if (!appDoc) return null;

    const [submissionEvidence, interviews, followUps, timeline] = await Promise.all([
      submissionEvidenceService.getSubmissionEvidence(candidateId, applicationId),
      interviewService.listInterviews(candidateId, { applicationId }),
      followUpService.listFollowUps(candidateId, { applicationId }),
      trackerTimelineService.getTimeline(candidateId, applicationId),
    ]);

    const status = appDoc.status || 'discovered';
    const allowedTransitions = lifecycleRules.getAllowedTransitions(status);

    return {
      application: appDoc,
      submissionEvidence,
      interviews,
      followUps,
      timeline,
      allowedTransitions,
    };
  }

  /**
   * Transitions application status, asserting legality against lifecycle rules and logging timeline audit.
   */
  async updateStatus(
    candidateId: string,
    applicationId: string,
    targetStatus: ApplicationLifecycleStatus,
    reason?: string,
    actor = candidateId,
  ): Promise<{ status: string; updatedAt: string }> {
    const db = await getDatabase();
    const appDoc = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: applicationId,
      user_id: candidateId,
    });

    if (!appDoc) {
      throw new Error(`Application ${applicationId} not found or access denied`);
    }

    const currentStatus = appDoc.status || 'discovered';

    // Prevent jumping directly into 'submitted' without evidence
    if (targetStatus === 'submitted' && !appDoc.submission_evidence) {
      throw new Error(
        'Cannot transition to submitted without recording valid submission evidence. Use the submission evidence endpoint.',
      );
    }

    // Assert valid lifecycle transition
    lifecycleRules.assertValidTransition(currentStatus, targetStatus);

    const now = new Date().toISOString();

    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: applicationId, user_id: candidateId },
      { $set: { status: targetStatus, updated_at: now } },
    );

    // Timeline event
    await trackerTimelineService.recordEvent(candidateId, applicationId, {
      eventType: 'status_changed',
      title: `Status Changed to ${targetStatus.replace('_', ' ')}`,
      description: reason
        ? `Application updated from '${currentStatus}' to '${targetStatus}'. Note: ${reason}`
        : `Application updated from '${currentStatus}' to '${targetStatus}'`,
      actor,
      metadata: { from: currentStatus, to: targetStatus, reason },
    });

    // In-app notification
    const company = appDoc.jobSnapshot?.company || 'Company';
    await notificationService.createNotification(candidateId, {
      type: 'status_change',
      title: `Application Update: ${company}`,
      message: `Your application status changed to ${targetStatus.replace('_', ' ')}.`,
      applicationId,
      notificationKey: `status_${applicationId}_${targetStatus}_${now.slice(0, 16)}`,
    });

    return { status: targetStatus, updatedAt: now };
  }
}

export const trackerService = new TrackerService();
