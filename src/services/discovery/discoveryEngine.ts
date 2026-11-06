import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { JobDeduplicationService } from './jobDeduplicationService.js';
import { JobNormalizationService } from './jobNormalizationService.js';
import type {
  JobDiscoveryRunMetrics,
  JobDiscoverySource,
  JobProvider,
} from './types.js';

const SOURCES_TABLE = 'job_discovery_sources';
const RUNS_TABLE = 'job_discovery_runs';

const DEFAULT_SOURCES: Omit<JobDiscoverySource, 'created_at' | 'updated_at'>[] = [
  {
    id: 'source-greenhouse-stripe',
    provider: 'greenhouse',
    identifier: 'stripe',
    company_name: 'Stripe',
    url: 'https://boards.greenhouse.io/stripe',
    active: true,
    last_crawled_at: null,
    jobs_discovered: 0,
  },
  {
    id: 'source-lever-netflix',
    provider: 'lever',
    identifier: 'netflix',
    company_name: 'Netflix',
    url: 'https://jobs.lever.co/netflix',
    active: true,
    last_crawled_at: null,
    jobs_discovered: 0,
  },
  {
    id: 'source-ashby-vercel',
    provider: 'ashby',
    identifier: 'vercel',
    company_name: 'Vercel',
    url: 'https://jobs.ashbyhq.com/vercel',
    active: true,
    last_crawled_at: null,
    jobs_discovered: 0,
  },
  {
    id: 'source-sr-visa',
    provider: 'smartrecruiters',
    identifier: 'visa',
    company_name: 'Visa',
    url: 'https://jobs.smartrecruiters.com/visa',
    active: true,
    last_crawled_at: null,
    jobs_discovered: 0,
  },
];

export class DiscoveryEngine {
  private normalizer = new JobNormalizationService();
  private deduplicator = new JobDeduplicationService();

  /**
   * Seed default sources if collection is empty
   */
  async ensureSeedSources(): Promise<void> {
    const db = await getDatabase();
    const count = await db.collection(SOURCES_TABLE).countDocuments();
    if (count === 0) {
      const now = new Date().toISOString();
      const docs = DEFAULT_SOURCES.map((s) => ({
        ...s,
        _id: s.id,
        created_at: now,
        updated_at: now,
      }));
      await db.collection<any>(SOURCES_TABLE).insertMany(docs as any);
    }
  }

  async listSources(): Promise<JobDiscoverySource[]> {
    await this.ensureSeedSources();
    const db = await getDatabase();
    const docs = await db.collection<any>(SOURCES_TABLE).find({}).toArray();
    return docs.map(({ _id, ...rest }) => ({
      ...rest,
      id: _id,
    }));
  }

  async registerSource(source: Omit<JobDiscoverySource, 'id' | 'created_at' | 'updated_at' | 'last_crawled_at' | 'jobs_discovered'>): Promise<JobDiscoverySource> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = `source-${source.provider}-${source.identifier}`;
    const doc: any = {
      ...source,
      _id: id,
      last_crawled_at: null,
      jobs_discovered: 0,
      created_at: now,
      updated_at: now,
    };
    await db.collection<any>(SOURCES_TABLE).updateOne(
      { _id: id as any },
      { $set: doc },
      { upsert: true },
    );
    return { ...doc, id };
  }

  /**
   * Executes a discovery run across all active sources or specified sources.
   */
  async runDiscovery(options?: {
    providers?: JobProvider[];
    sourceIds?: string[];
  }): Promise<JobDiscoveryRunMetrics> {
    await this.ensureSeedSources();
    const db = await getDatabase();

    const query: any = { active: true };
    if (options?.providers && options.providers.length > 0) {
      query.provider = { $in: options.providers };
    }
    if (options?.sourceIds && options.sourceIds.length > 0) {
      query._id = { $in: options.sourceIds };
    }

    const sources = await db.collection<any>(SOURCES_TABLE).find(query).toArray();

    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const providersQueried = Array.from(new Set(sources.map((s) => s.provider)));

    const runMetrics: JobDiscoveryRunMetrics = {
      id: runId,
      started_at: startedAt,
      completed_at: null,
      status: 'running',
      providers_queried: providersQueried,
      jobs_found: 0,
      jobs_inserted: 0,
      jobs_updated: 0,
      errors: [],
    };

    await db.collection<any>(RUNS_TABLE).insertOne({
      ...runMetrics,
      _id: runId,
    } as any);

    for (const sourceDoc of sources) {
      const source: JobDiscoverySource = {
        ...sourceDoc,
        id: sourceDoc._id,
      };

      try {
        const rawPostings = await adapterRegistry.fetchJobsForSource(source);
        runMetrics.jobs_found += rawPostings.length;

        let sourceInserted = 0;
        let sourceUpdated = 0;

        for (const raw of rawPostings) {
          try {
            const normalized = this.normalizer.normalize(raw);
            const dedupResult = await this.deduplicator.deduplicateAndSave(normalized);

            if (dedupResult.action === 'inserted') {
              runMetrics.jobs_inserted++;
              sourceInserted++;
            } else if (dedupResult.action === 'updated') {
              runMetrics.jobs_updated++;
              sourceUpdated++;
            }
          } catch (itemErr: any) {
            runMetrics.errors.push({
              provider: source.provider,
              identifier: source.identifier,
              error: `Item error: ${itemErr.message || itemErr}`,
            });
          }
        }

        // Update source document with stats
        await db.collection<any>(SOURCES_TABLE).updateOne(
          { _id: source.id as any },
          {
            $set: {
              last_crawled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            $inc: {
              jobs_discovered: sourceInserted + sourceUpdated,
            },
          },
        );
      } catch (sourceErr: any) {
        runMetrics.errors.push({
          provider: source.provider,
          identifier: source.identifier,
          error: sourceErr.message || String(sourceErr),
        });
      }
    }

    runMetrics.completed_at = new Date().toISOString();
    runMetrics.status = runMetrics.errors.length === sources.length && sources.length > 0 ? 'failed' : 'completed';

    await db.collection<any>(RUNS_TABLE).replaceOne(
      { _id: runId as any },
      { ...runMetrics, _id: runId } as any,
    );

    return runMetrics;
  }

  async getLatestRunMetrics(): Promise<JobDiscoveryRunMetrics | null> {
    const db = await getDatabase();
    const doc = await db.collection<any>(RUNS_TABLE).find({}).sort({ started_at: -1 }).limit(1).next();
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  }

  async listRuns(limit = 10): Promise<JobDiscoveryRunMetrics[]> {
    const db = await getDatabase();
    const docs = await db.collection<any>(RUNS_TABLE).find({}).sort({ started_at: -1 }).limit(limit).toArray();
    return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
  }
}

export const discoveryEngine = new DiscoveryEngine();
