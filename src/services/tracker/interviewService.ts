import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import { trackerTimelineService } from './trackerTimelineService.js';
import { notificationService } from './notificationService.js';
import { lifecycleRules } from './lifecycleRules.js';
import type {
  InterviewRecord,
  InterviewStage,
  InterviewMode,
  InterviewStatus,
  InterviewerDetails,
  InterviewFeedback,
} from './types.js';

const INTERVIEWS_TABLE = 'interviews';
const APPLICATIONS_TABLE = 'applications';

export interface CreateInterviewInput {
  applicationId: string;
  stage: InterviewStage;
  scheduledAt: string; // ISO 8601
  timezone?: string;
  durationMinutes?: number;
  interviewMode: InterviewMode;
  meetingLink?: string;
  location?: string;
  interviewerDetails?: InterviewerDetails;
  preparationNotes?: string;
}

export interface UpdateInterviewInput {
  stage?: InterviewStage;
  scheduledAt?: string;
  timezone?: string;
  durationMinutes?: number;
  interviewMode?: InterviewMode;
  meetingLink?: string;
  location?: string;
  interviewerDetails?: InterviewerDetails;
  preparationNotes?: string;
  status?: InterviewStatus;
  feedback?: InterviewFeedback;
  nextSteps?: string;
}

export class InterviewService {
  /**
   * Schedules a new interview stage for an application.
   */
  async createInterview(
    candidateId: string,
    input: CreateInterviewInput,
  ): Promise<InterviewRecord> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // Verify application ownership
    const appDoc = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: input.applicationId,
      user_id: candidateId,
    });

    if (!appDoc) {
      throw new Error(`Application ${input.applicationId} not found or access denied`);
    }

    const company = appDoc.jobSnapshot?.company || 'Company';
    const jobTitle = appDoc.jobSnapshot?.title || 'Position';
    const jobId = appDoc.job_id || appDoc.jobId || '';
    const id = randomUUID();

    const record: InterviewRecord & { _id: string; user_id: string; application_id: string } = {
      _id: id,
      id,
      applicationId: input.applicationId,
      candidateId,
      user_id: candidateId,
      application_id: input.applicationId,
      jobId,
      company,
      jobTitle,
      stage: input.stage,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone || 'UTC',
      durationMinutes: input.durationMinutes || 45,
      interviewMode: input.interviewMode,
      meetingLink: input.meetingLink,
      location: input.location,
      interviewerDetails: input.interviewerDetails,
      preparationNotes: input.preparationNotes,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
    };

    await db.collection<any>(INTERVIEWS_TABLE).insertOne(record);

    // Update application lifecycle if appropriate
    const currentStatus = appDoc.status || 'discovered';
    const interviewEligibleStatuses = ['submitted', 'verified', 'under_review', 'shortlisted'];
    if (interviewEligibleStatuses.includes(currentStatus)) {
      if (lifecycleRules.canTransition(currentStatus, 'interview_scheduled')) {
        await db.collection<any>(APPLICATIONS_TABLE).updateOne(
          { _id: input.applicationId, user_id: candidateId },
          { $set: { status: 'interview_scheduled', updated_at: now } },
        );
      }
    }

    // Append timeline event
    await trackerTimelineService.recordEvent(candidateId, input.applicationId, {
      eventType: 'interview_scheduled',
      title: `Interview Scheduled (${input.stage.replace('_', ' ')})`,
      description: `${input.stage} interview scheduled with ${company} for ${input.scheduledAt} via ${input.interviewMode}`,
      actor: candidateId,
      metadata: {
        interviewId: id,
        stage: input.stage,
        scheduledAt: input.scheduledAt,
        interviewMode: input.interviewMode,
        meetingLink: input.meetingLink,
      },
    });

    // Create in-app notification
    await notificationService.createNotification(candidateId, {
      type: 'upcoming_interview',
      title: `Interview Scheduled with ${company}`,
      message: `Your ${input.stage.replace('_', ' ')} interview is confirmed for ${new Date(input.scheduledAt).toLocaleString()}.`,
      applicationId: input.applicationId,
      entityId: id,
      notificationKey: `interview_${id}_scheduled`,
    });

    return this.toRecord(record);
  }

  /**
   * Retrieves an interview by ID with IDOR protection.
   */
  async getInterview(candidateId: string, interviewId: string): Promise<InterviewRecord | null> {
    const db = await getDatabase();
    const doc = await db.collection<any>(INTERVIEWS_TABLE).findOne({
      _id: interviewId,
      user_id: candidateId,
    });

    return doc ? this.toRecord(doc) : null;
  }

  /**
   * Lists interviews for a candidate with optional filtering.
   */
  async listInterviews(
    candidateId: string,
    filters: {
      applicationId?: string;
      status?: InterviewStatus;
      stage?: InterviewStage;
    } = {},
  ): Promise<InterviewRecord[]> {
    const db = await getDatabase();
    const query: Record<string, unknown> = { user_id: candidateId };

    if (filters.applicationId) query.application_id = filters.applicationId;
    if (filters.status) query.status = filters.status;
    if (filters.stage) query.stage = filters.stage;

    const docs = await db
      .collection<any>(INTERVIEWS_TABLE)
      .find(query)
      .sort({ scheduledAt: 1 })
      .toArray();

    return docs.map((doc) => this.toRecord(doc));
  }

  /**
   * Updates an interview record (reschedule, status change, feedback).
   */
  async updateInterview(
    candidateId: string,
    interviewId: string,
    input: UpdateInterviewInput,
  ): Promise<InterviewRecord | null> {
    const db = await getDatabase();
    const existing = await db.collection<any>(INTERVIEWS_TABLE).findOne({
      _id: interviewId,
      user_id: candidateId,
    });

    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (input.stage) updates.stage = input.stage;
    if (input.scheduledAt) updates.scheduledAt = input.scheduledAt;
    if (input.timezone) updates.timezone = input.timezone;
    if (input.durationMinutes !== undefined) updates.durationMinutes = input.durationMinutes;
    if (input.interviewMode) updates.interviewMode = input.interviewMode;
    if (input.meetingLink !== undefined) updates.meetingLink = input.meetingLink;
    if (input.location !== undefined) updates.location = input.location;
    if (input.interviewerDetails) updates.interviewerDetails = input.interviewerDetails;
    if (input.preparationNotes !== undefined) updates.preparationNotes = input.preparationNotes;
    if (input.status) updates.status = input.status;
    if (input.feedback) updates.feedback = input.feedback;
    if (input.nextSteps !== undefined) updates.nextSteps = input.nextSteps;

    await db.collection<any>(INTERVIEWS_TABLE).updateOne(
      { _id: interviewId, user_id: candidateId },
      { $set: updates },
    );

    const updatedDoc = await db.collection<any>(INTERVIEWS_TABLE).findOne({
      _id: interviewId,
      user_id: candidateId,
    });

    // Record timeline events if significant changes occur
    if (input.status === 'completed') {
      await trackerTimelineService.recordEvent(candidateId, existing.applicationId || existing.application_id, {
        eventType: 'interview_completed',
        title: `Interview Completed: ${existing.stage}`,
        description: `Candidate recorded interview completion with feedback rating ${input.feedback?.rating ?? 'N/A'}/5`,
        actor: candidateId,
        metadata: { interviewId, feedback: input.feedback },
      });
    } else if (input.scheduledAt && input.scheduledAt !== existing.scheduledAt) {
      await trackerTimelineService.recordEvent(candidateId, existing.applicationId || existing.application_id, {
        eventType: 'status_changed',
        title: `Interview Rescheduled: ${existing.stage}`,
        description: `Interview rescheduled from ${existing.scheduledAt} to ${input.scheduledAt}`,
        actor: candidateId,
        metadata: { interviewId, oldDate: existing.scheduledAt, newDate: input.scheduledAt },
      });
    }

    return updatedDoc ? this.toRecord(updatedDoc) : null;
  }

  /**
   * Deletes/cancels an interview record.
   */
  async deleteInterview(candidateId: string, interviewId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.collection<any>(INTERVIEWS_TABLE).deleteOne({
      _id: interviewId,
      user_id: candidateId,
    });
    return result.deletedCount > 0;
  }

  private toRecord(doc: any): InterviewRecord {
    return {
      id: doc.id || doc._id,
      applicationId: doc.applicationId || doc.application_id,
      candidateId: doc.candidateId || doc.user_id,
      jobId: doc.jobId || doc.job_id,
      company: doc.company,
      jobTitle: doc.jobTitle,
      stage: doc.stage,
      scheduledAt: doc.scheduledAt,
      timezone: doc.timezone || 'UTC',
      durationMinutes: doc.durationMinutes || 45,
      interviewMode: doc.interviewMode,
      meetingLink: doc.meetingLink,
      location: doc.location,
      interviewerDetails: doc.interviewerDetails,
      preparationNotes: doc.preparationNotes,
      status: doc.status,
      feedback: doc.feedback,
      nextSteps: doc.nextSteps,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const interviewService = new InterviewService();
