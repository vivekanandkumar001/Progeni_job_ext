import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import type { TimelineEvent } from './types.js';

const TIMELINE_TABLE = 'application_timelines';

export class TrackerTimelineService {
  /**
   * Appends an immutable timeline event to an application dossier.
   */
  async recordEvent(
    candidateId: string,
    applicationId: string,
    event: {
      eventType: TimelineEvent['eventType'];
      title: string;
      description: string;
      actor?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<TimelineEvent> {
    const db = await getDatabase();
    const eventRecord: TimelineEvent & { user_id: string; application_id: string } = {
      id: randomUUID(),
      applicationId,
      user_id: candidateId,
      application_id: applicationId,
      timestamp: new Date().toISOString(),
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      actor: event.actor || candidateId,
      metadata: event.metadata || {},
    };

    await db.collection<any>(TIMELINE_TABLE).insertOne(eventRecord);
    return {
      id: eventRecord.id,
      applicationId: eventRecord.applicationId,
      timestamp: eventRecord.timestamp,
      eventType: eventRecord.eventType,
      title: eventRecord.title,
      description: eventRecord.description,
      actor: eventRecord.actor,
      metadata: eventRecord.metadata,
    };
  }

  /**
   * Retrieves the full chronological timeline for an application, verifying candidate ownership.
   */
  async getTimeline(candidateId: string, applicationId: string): Promise<TimelineEvent[]> {
    const db = await getDatabase();
    const docs = await db
      .collection<any>(TIMELINE_TABLE)
      .find({ user_id: candidateId, application_id: applicationId })
      .sort({ timestamp: 1 })
      .toArray();

    return docs.map((doc) => ({
      id: doc.id || doc._id,
      applicationId: doc.applicationId || doc.application_id,
      timestamp: doc.timestamp,
      eventType: doc.eventType,
      title: doc.title,
      description: doc.description,
      actor: doc.actor,
      metadata: doc.metadata,
    }));
  }
}

export const trackerTimelineService = new TrackerTimelineService();

