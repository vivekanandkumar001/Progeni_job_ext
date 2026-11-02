import { randomUUID } from 'node:crypto';
import { getDatabase } from './config/mongodb.js';
import { ApplicationStorage, ApplicationRecord } from './services/applicationEngine.js';

const TABLE = 'applications';

export interface ApplicationRow {
  id: string;
  user_id: string;
  job_id: string | null;
  status: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  verified_at: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown> | null;
}

type ApplicationDocument = Omit<ApplicationRow, 'id'> & { _id: string };

export class ApplicationService implements ApplicationStorage {
  get storage(): ApplicationStorage { return this; }

  async get(id: string, candidateId: string): Promise<ApplicationRecord | null> {
    const data = await (await getDatabase())
      .collection<ApplicationDocument>(TABLE)
      .findOne({ _id: id, user_id: candidateId });
    return data ? this.toRecord(data) : null;
  }

  async list(candidateId: string): Promise<ApplicationRecord[]> {
    const applications = await (await getDatabase())
      .collection<ApplicationDocument>(TABLE)
      .find({ user_id: candidateId })
      .sort({ updated_at: -1 })
      .toArray();
    return applications.map((application) => this.toRecord(application));
  }

  async save(record: ApplicationRecord): Promise<ApplicationRecord> {
    const document: ApplicationDocument = {
      _id: record.id,
      user_id: record.candidateId,
      job_id: record.jobId || null,
      status: record.status,
      idempotency_key: record.idempotencyKey,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      submitted_at: record.submittedAt || null,
      verified_at: record.verifiedAt || null,
      failure_reason: record.failureReason || null,
      metadata: record.metadata || null,
    };
    await (await getDatabase())
      .collection<ApplicationDocument>(TABLE)
      .replaceOne(
        { _id: record.id, user_id: record.candidateId },
        document,
        { upsert: true },
      );
    return this.toRecord(document);
  }

  async create(
    candidateId: string,
    input: {
      jobId?: string;
      idempotencyKey?: string;
      status: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ApplicationRecord> {
    const now = new Date().toISOString();
    return this.save({
      id: randomUUID(),
      jobId: input.jobId || '',
      candidateId,
      status: input.status,
      idempotencyKey: input.idempotencyKey || randomUUID(),
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    });
  }

  async updateStatus(
    id: string,
    status: string,
    candidateId: string,
    metadata?: Record<string, unknown>,
  ): Promise<ApplicationRecord | null> {
    const existing = await this.get(id, candidateId);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: ApplicationRecord = {
      ...existing,
      status,
      updatedAt: now,
      submittedAt: status === 'submitted' ? now : existing.submittedAt,
      verifiedAt: status === 'verified' ? now : existing.verifiedAt,
      failureReason:
        status === 'failed' && typeof metadata?.failureReason === 'string'
          ? metadata.failureReason
          : existing.failureReason,
      metadata: { ...(existing.metadata || {}), ...metadata },
    };
    return this.save(updated);
  }

  async existsByIdempotencyKey(key: string, candidateId: string): Promise<boolean> {
    const application = await (await getDatabase())
      .collection<ApplicationDocument>(TABLE)
      .findOne(
        { idempotency_key: key, user_id: candidateId },
        { projection: { _id: 1 } },
      );
    return !!application;
  }

  async findDuplicate(candidateId: string, jobId: string, excludeStatuses: string[] = []): Promise<ApplicationRecord | null> {
    const filter: Record<string, unknown> = { user_id: candidateId, job_id: jobId };
    if (excludeStatuses.length > 0) filter.status = { $nin: excludeStatuses };
    const application = await (await getDatabase())
      .collection<ApplicationDocument>(TABLE)
      .findOne(filter);
    return application ? this.toRecord(application) : null;
  }

  private toRecord(row: ApplicationDocument): ApplicationRecord {
    return {
      id: row._id,
      jobId: row.job_id || '',
      candidateId: row.user_id,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at || undefined,
      verifiedAt: row.verified_at || undefined,
      failureReason: row.failure_reason || undefined,
      metadata: row.metadata || undefined,
    };
  }
}

export const applicationService = new ApplicationService();