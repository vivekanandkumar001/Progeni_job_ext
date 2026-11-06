import type { JobDiscoverySource, JobProviderAdapter, RawJobPosting } from '../types.js';

interface AshbyJobItem {
  id: string;
  title: string;
  location?: string;
  department?: string;
  employmentType?: string;
  isRemote?: boolean;
  jobUrl: string;
  publishedAt?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  compensation?: {
    compensationTierSummary?: string;
    targetSalary?: {
      min?: number;
      max?: number;
      currency?: string;
    };
  };
  secondaryLocations?: Array<{ location: string }>;
}

export class AshbyAdapter implements JobProviderAdapter {
  readonly provider = 'ashby' as const;
  readonly name = 'Ashby Job Board Adapter';

  async fetchJobs(source: JobDiscoverySource): Promise<RawJobPosting[]> {
    const org = source.identifier.trim();
    if (!org) {
      throw new Error('Ashby organization identifier is required');
    }

    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AutoApply-JobDiscoveryEngine/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`Ashby API returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as { jobs?: AshbyJobItem[] };
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];

      return jobs.map((job) => this.transform(job, source));
    } catch (error: any) {
      throw new Error(`Ashby adapter failed for ${org}: ${error.message || error}`);
    }
  }

  transform(item: AshbyJobItem, source: JobDiscoverySource): RawJobPosting {
    let workplaceModeRaw: string | null = null;
    if (item.isRemote) {
      workplaceModeRaw = 'remote';
    }

    let salaryRaw: string | null = null;
    if (item.compensation?.compensationTierSummary) {
      salaryRaw = item.compensation.compensationTierSummary;
    } else if (item.compensation?.targetSalary) {
      const ts = item.compensation.targetSalary;
      salaryRaw = `${ts.currency || 'USD'} ${ts.min || ''} - ${ts.max || ''}`.trim();
    }

    return {
      externalId: item.id,
      provider: 'ashby',
      companyName: source.company_name || source.identifier,
      title: item.title,
      descriptionHtml: item.descriptionHtml || null,
      descriptionText: item.descriptionPlain || null,
      locationRaw: item.location || null,
      employmentTypeRaw: item.employmentType || null,
      workplaceModeRaw,
      salaryRaw,
      applyUrl: item.jobUrl,
      sourceUrl: item.jobUrl,
      postedAt: item.publishedAt || null,
    };
  }
}

export const ashbyAdapter = new AshbyAdapter();

