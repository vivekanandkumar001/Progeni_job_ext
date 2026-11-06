import { getDatabase } from '../../config/mongodb.js';
import type { JobDocument, NormalizedJob } from './types.js';

const JOBS_TABLE = 'jobs';

export interface DeduplicationResult {
  action: 'inserted' | 'updated' | 'skipped';
  isDuplicate: boolean;
  job: NormalizedJob;
}

export class JobDeduplicationService {
  /**
   * Evaluates a candidate normalized job against existing database records.
   * Performs deduplication and safe merging without overwriting distinct jobs.
   */
  async deduplicateAndSave(incoming: NormalizedJob): Promise<DeduplicationResult> {
    const collection = (await getDatabase()).collection<JobDocument>(JOBS_TABLE);

    // 1. Match by Provider + External Job ID (Highest fidelity)
    let existing: JobDocument | null = null;
    if (incoming.external_job_id && incoming.provider) {
      existing = await collection.findOne({
        provider: incoming.provider,
        external_job_id: incoming.external_job_id,
      });
    }

    // 2. Match by Canonical Application URL
    if (!existing && incoming.canonical_url) {
      existing = await collection.findOne({
        canonical_url: incoming.canonical_url,
      });
    }

    // 3. Match by Content Hash + Normalized Company
    if (!existing && incoming.content_hash) {
      existing = await collection.findOne({
        company_name: incoming.company_name,
        content_hash: incoming.content_hash,
      });
    }

    const now = new Date().toISOString();

    if (existing) {
      // Duplicate detected -> Perform safe merge
      const merged: JobDocument = {
        ...existing,
        // Update freshness timestamps
        last_seen_at: now,
        last_verified_at: now,
        updated_at: now,
        // Restore active status if provider currently lists it
        status: 'active',
        // Update dynamic fields if incoming is richer
        salary_min: incoming.salary_min !== null ? incoming.salary_min : existing.salary_min,
        salary_max: incoming.salary_max !== null ? incoming.salary_max : existing.salary_max,
        salary_currency: incoming.salary_currency || existing.salary_currency,
        required_skills: Array.from(
          new Set([...(existing.required_skills || []), ...(incoming.required_skills || [])]),
        ),
        application_url: incoming.application_url || existing.application_url,
      };

      await collection.replaceOne({ _id: existing._id }, merged);

      return {
        action: 'updated',
        isDuplicate: true,
        job: this.toRow(merged),
      };
    }

    // No duplicate found -> Insert new job
    const doc: JobDocument = {
      ...incoming,
      _id: incoming.id,
      first_seen_at: now,
      last_seen_at: now,
      last_verified_at: now,
      created_at: now,
      updated_at: now,
    };

    await collection.insertOne(doc);

    return {
      action: 'inserted',
      isDuplicate: false,
      job: this.toRow(doc),
    };
  }

  private toRow(doc: JobDocument): NormalizedJob {
    const { _id, ...rest } = doc;
    return {
      ...rest,
      id: _id,
      job_id: _id,
    };
  }
}

export const jobDeduplicationService = new JobDeduplicationService();

