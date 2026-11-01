import { randomUUID } from 'node:crypto';
import { supabase } from './config/supabase/client.js';
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

export class ApplicationService implements ApplicationStorage {
  get storage(): ApplicationStorage { return this; }

  async get(id: string, candidateId?: string): Promise<ApplicationRecord | null> {
    let query = supabase.from(TABLE).select('*').eq('id', id);
    if (candidateId) query = query.eq('user_id', candidateId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error('Failed to fetch application: ' + error.message);
    return data ? this.toRecord(data) : null;
  }

  async list(candidateId: string): Promise<ApplicationRecord[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', candidateId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error('Failed to list applications: ' + error.message);
    return (data || []).map((r) => this.toRecord(r));
  }

  async save(record: ApplicationRecord): Promise<ApplicationRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert({
        id: record.id,
        user_id: record.candidateId,
        job_id: record.jobId || null,
        status: record.status,
        idempotency_key: record.idempotencyKey,
        updated_at: record.updatedAt,
        submitted_at: record.submittedAt || null,
        verified_at: record.verifiedAt || null,
        failure_reason: record.failureReason || null,
        metadata: record.metadata || null,
      })
      .select()
      .single();
    if (error) throw new Error('Failed to save application: ' + error.message);
    return this.toRecord(data);
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
    metadata?: Record<string, unknown>,
    candidateId?: string,
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
    const { data, error } = await supabase
      .from(TABLE)
      .select('id')
      .eq('idempotency_key', key)
      .eq('user_id', candidateId)
      .maybeSingle();
    if (error) throw new Error('Failed to check idempotency: ' + error.message);
    return !!data;
  }

  async findDuplicate(candidateId: string, jobId: string, excludeStatuses: string[] = []): Promise<ApplicationRecord | null> {
    let query = supabase.from(TABLE).select('*').eq('user_id', candidateId).eq('job_id', jobId);
    if (excludeStatuses.length > 0) {
      query = query.not('status', 'in', `(${excludeStatuses.join(',')})`);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error('Failed to find duplicate: ' + error.message);
    return data ? this.toRecord(data) : null;
  }

  private toRecord(row: ApplicationRow): ApplicationRecord {
    return {
      id: row.id,
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