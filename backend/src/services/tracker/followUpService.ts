import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import { trackerTimelineService } from './trackerTimelineService.js';
import { notificationService } from './notificationService.js';
import type {
  FollowUpRecord,
  FollowUpStatus,
} from './types.js';

const FOLLOW_UPS_TABLE = 'follow_ups';
const APPLICATIONS_TABLE = 'applications';

export interface CreateFollowUpInput {
  applicationId: string;
  followUpDate: string; // YYYY-MM-DD
  nextAction: string;
  notes?: string;
  reminderSettings?: {
    enabled: boolean;
    reminderDate?: string;
    notificationChannel?: 'in_app' | 'email';
  };
  contactDetails?: {
    name?: string;
    email?: string;
    role?: string;
  };
}

export interface UpdateFollowUpInput {
  followUpDate?: string;
  status?: FollowUpStatus;
  nextAction?: string;
  notes?: string;
  reminderSettings?: {
    enabled: boolean;
    reminderDate?: string;
    notificationChannel?: 'in_app' | 'email';
  };
  contactDetails?: {
    name?: string;
    email?: string;
    role?: string;
  };
}

export interface LogActionInput {
  action: string;
  notes?: string;
  markCompleted?: boolean;
  nextFollowUpDate?: string;
}

export class FollowUpService {
  /**
   * Helper to evaluate whether a follow up is overdue.
   */
  private checkIsOverdue(followUpDate: string, status: FollowUpStatus): boolean {
    if (status !== 'pending') return false;
    const today = new Date().toISOString().slice(0, 10);
    return followUpDate < today;
  }

  /**
   * Schedules a new follow-up task for an application.
   */
  async createFollowUp(
    candidateId: string,
    input: CreateFollowUpInput,
  ): Promise<FollowUpRecord> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const appDoc = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: input.applicationId,
      user_id: candidateId,
    });

    if (!appDoc) {
      throw new Error(`Application ${input.applicationId} not found or access denied`);
    }

    const company = appDoc.jobSnapshot?.company || 'Company';
    const jobTitle = appDoc.jobSnapshot?.title || 'Position';
    const id = randomUUID();

    const record = {
      _id: id,
      id,
      applicationId: input.applicationId,
      candidateId,
      user_id: candidateId,
      application_id: input.applicationId,
      company,
      jobTitle,
      followUpDate: input.followUpDate,
      status: 'pending' as FollowUpStatus,
      reminderSettings: {
        enabled: input.reminderSettings?.enabled ?? true,
        reminderDate: input.reminderSettings?.reminderDate || input.followUpDate,
        notificationChannel: input.reminderSettings?.notificationChannel || 'in_app',
      },
      contactDetails: input.contactDetails,
      nextAction: input.nextAction,
      notes: input.notes,
      history: [
        {
          action: 'follow_up_created',
          performedAt: now,
          notes: `Created follow-up: ${input.nextAction}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await db.collection<any>(FOLLOW_UPS_TABLE).insertOne(record);

    // Timeline event
    await trackerTimelineService.recordEvent(candidateId, input.applicationId, {
      eventType: 'follow_up_logged',
      title: 'Follow-Up Scheduled',
      description: `Follow-up planned for ${input.followUpDate}: ${input.nextAction}`,
      actor: candidateId,
      metadata: { followUpId: id, followUpDate: input.followUpDate },
    });

    // Idempotent reminder notification
    await notificationService.createNotification(candidateId, {
      type: 'follow_up_reminder',
      title: `Follow-Up Scheduled: ${company}`,
      message: `Follow-up on "${jobTitle}" set for ${input.followUpDate}: ${input.nextAction}`,
      applicationId: input.applicationId,
      entityId: id,
      notificationKey: `followup_${id}_scheduled`,
    });

    return this.toRecord(record);
  }

  /**
   * Retrieves single follow-up record with IDOR verification.
   */
  async getFollowUp(candidateId: string, id: string): Promise<FollowUpRecord | null> {
    const db = await getDatabase();
    const doc = await db.collection<any>(FOLLOW_UPS_TABLE).findOne({
      _id: id,
      user_id: candidateId,
    });
    return doc ? this.toRecord(doc) : null;
  }

  /**
   * Lists follow-up records with dynamic overdue calculation and optional filtering.
   */
  async listFollowUps(
    candidateId: string,
    filters: {
      applicationId?: string;
      status?: FollowUpStatus;
      overdueOnly?: boolean;
    } = {},
  ): Promise<FollowUpRecord[]> {
    const db = await getDatabase();
    const query: Record<string, unknown> = { user_id: candidateId };

    if (filters.applicationId) query.application_id = filters.applicationId;
    if (filters.status) query.status = filters.status;

    const docs = await db
      .collection<any>(FOLLOW_UPS_TABLE)
      .find(query)
      .sort({ followUpDate: 1 })
      .toArray();

    const records = docs.map((doc) => this.toRecord(doc));

    if (filters.overdueOnly) {
      return records.filter((r) => r.isOverdue);
    }

    return records;
  }

  /**
   * Updates follow-up fields.
   */
  async updateFollowUp(
    candidateId: string,
    id: string,
    input: UpdateFollowUpInput,
  ): Promise<FollowUpRecord | null> {
    const db = await getDatabase();
    const existing = await db.collection<any>(FOLLOW_UPS_TABLE).findOne({
      _id: id,
      user_id: candidateId,
    });
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (input.followUpDate) updates.followUpDate = input.followUpDate;
    if (input.status) updates.status = input.status;
    if (input.nextAction) updates.nextAction = input.nextAction;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.reminderSettings) updates.reminderSettings = input.reminderSettings;
    if (input.contactDetails) updates.contactDetails = input.contactDetails;

    await db.collection<any>(FOLLOW_UPS_TABLE).updateOne(
      { _id: id, user_id: candidateId },
      { $set: updates },
    );

    const updated = await db.collection<any>(FOLLOW_UPS_TABLE).findOne({
      _id: id,
      user_id: candidateId,
    });
    return updated ? this.toRecord(updated) : null;
  }

  /**
   * Logs a follow-up action (e.g., sent email, reached out on LinkedIn), appends to history,
   * updates status or next follow up date, and logs a timeline event.
   */
  async logFollowUpAction(
    candidateId: string,
    id: string,
    actionInput: LogActionInput,
  ): Promise<FollowUpRecord | null> {
    const db = await getDatabase();
    const existing = await db.collection<any>(FOLLOW_UPS_TABLE).findOne({
      _id: id,
      user_id: candidateId,
    });
    if (!existing) return null;

    const now = new Date().toISOString();
    const historyEntry = {
      action: actionInput.action,
      performedAt: now,
      notes: actionInput.notes,
    };

    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (actionInput.markCompleted) {
      updates.status = 'completed';
    }

    if (actionInput.nextFollowUpDate) {
      updates.followUpDate = actionInput.nextFollowUpDate;
      updates.status = 'pending';
    }

    await db.collection<any>(FOLLOW_UPS_TABLE).updateOne(
      { _id: id, user_id: candidateId },
      {
        $set: updates,
        $push: { history: historyEntry } as any,
      },
    );

    // Timeline event
    await trackerTimelineService.recordEvent(
      candidateId,
      existing.applicationId || existing.application_id,
      {
        eventType: 'follow_up_logged',
        title: `Follow-Up Action Logged: ${actionInput.action}`,
        description: actionInput.notes || `Candidate performed follow-up: ${actionInput.action}`,
        actor: candidateId,
        metadata: {
          followUpId: id,
          action: actionInput.action,
          completed: actionInput.markCompleted,
        },
      },
    );

    const updated = await db.collection<any>(FOLLOW_UPS_TABLE).findOne({
      _id: id,
      user_id: candidateId,
    });
    return updated ? this.toRecord(updated) : null;
  }

  private toRecord(doc: any): FollowUpRecord {
    const followUpDate = doc.followUpDate || '';
    const status: FollowUpStatus = doc.status || 'pending';
    return {
      id: doc.id || doc._id,
      applicationId: doc.applicationId || doc.application_id,
      candidateId: doc.candidateId || doc.user_id,
      company: doc.company,
      jobTitle: doc.jobTitle,
      followUpDate,
      status,
      isOverdue: this.checkIsOverdue(followUpDate, status),
      reminderSettings: doc.reminderSettings || {
        enabled: true,
        notificationChannel: 'in_app',
      },
      contactDetails: doc.contactDetails,
      nextAction: doc.nextAction,
      notes: doc.notes,
      history: doc.history || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const followUpService = new FollowUpService();
