import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import type { NotificationRecord, NotificationType } from './types.js';

const NOTIFICATIONS_TABLE = 'candidate_notifications';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  applicationId?: string;
  entityId?: string;
  notificationKey: string; // Idempotency key
}

export class NotificationService {
  /**
   * Dispatches an in-app notification with strict idempotency key deduplication.
   */
  async createNotification(
    candidateId: string,
    input: CreateNotificationInput,
  ): Promise<NotificationRecord> {
    const db = await getDatabase();

    // Check if notification with this idempotency key already exists for this candidate
    const existing = await db.collection<any>(NOTIFICATIONS_TABLE).findOne({
      user_id: candidateId,
      notificationKey: input.notificationKey,
    });

    if (existing) {
      return {
        id: existing.id || existing._id,
        candidateId: existing.user_id,
        type: existing.type,
        title: existing.title,
        message: existing.message,
        applicationId: existing.applicationId,
        entityId: existing.entityId,
        notificationKey: existing.notificationKey,
        read: Boolean(existing.read),
        createdAt: existing.createdAt,
      };
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const doc = {
      _id: id,
      id,
      user_id: candidateId,
      type: input.type,
      title: input.title,
      message: input.message,
      applicationId: input.applicationId,
      entityId: input.entityId,
      notificationKey: input.notificationKey,
      read: false,
      createdAt: now,
    };

    await db.collection<any>(NOTIFICATIONS_TABLE).insertOne(doc);

    return {
      id: doc.id,
      candidateId: doc.user_id,
      type: doc.type,
      title: doc.title,
      message: doc.message,
      applicationId: doc.applicationId,
      entityId: doc.entityId,
      notificationKey: doc.notificationKey,
      read: doc.read,
      createdAt: doc.createdAt,
    };
  }

  /**
   * Lists notifications for a candidate.
   */
  async listNotifications(
    candidateId: string,
    unreadOnly = false,
  ): Promise<NotificationRecord[]> {
    const db = await getDatabase();
    const filter: Record<string, unknown> = { user_id: candidateId };
    if (unreadOnly) {
      filter.read = false;
    }

    const docs = await db
      .collection<any>(NOTIFICATIONS_TABLE)
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return docs.map((doc) => ({
      id: doc.id || doc._id,
      candidateId: doc.user_id,
      type: doc.type,
      title: doc.title,
      message: doc.message,
      applicationId: doc.applicationId,
      entityId: doc.entityId,
      notificationKey: doc.notificationKey,
      read: Boolean(doc.read),
      createdAt: doc.createdAt,
    }));
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(candidateId: string, notificationId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.collection<any>(NOTIFICATIONS_TABLE).updateOne(
      { _id: notificationId, user_id: candidateId },
      { $set: { read: true, readAt: new Date().toISOString() } },
    );
    return result.modifiedCount > 0;
  }

  /**
   * Marks all unread notifications as read for a candidate.
   */
  async markAllAsRead(candidateId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.collection<any>(NOTIFICATIONS_TABLE).updateMany(
      { user_id: candidateId, read: false },
      { $set: { read: true, readAt: new Date().toISOString() } },
    );
    return result.modifiedCount;
  }
}

export const notificationService = new NotificationService();
