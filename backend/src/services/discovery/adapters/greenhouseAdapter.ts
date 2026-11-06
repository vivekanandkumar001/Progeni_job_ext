import type { JobDiscoverySource, JobProviderAdapter, RawJobPosting } from '../types.js';

interface GreenhouseJobItem {
  id: number | string;
  title: string;
  content?: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  metadata?: Array<{ name: string; value: any }>;
  departments?: Array<{ name: string }>;
  offices?: Array<{ name: string; location?: string }>;
}

export class GreenhouseAdapter implements JobProviderAdapter {
  readonly provider = 'greenhouse' as const;
  readonly name = 'Greenhouse Job Board Adapter';

  async fetchJobs(source: JobDiscoverySource): Promise<RawJobPosting[]> {
    const boardToken = source.identifier.trim();
    if (!boardToken) {
      throw new Error('Greenhouse board token is required');
    }

    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
    
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
        throw new Error(`Greenhouse API returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as { jobs?: GreenhouseJobItem[] };
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];

      return jobs.map((job) => this.transform(job, source));
    } catch (error: any) {
      // In sandbox mode or network unavailable, rethrow descriptive error
      throw new Error(`Greenhouse adapter failed for ${boardToken}: ${error.message || error}`);
    }
  }

  transform(item: GreenhouseJobItem, source: JobDiscoverySource): RawJobPosting {
    return {
      externalId: String(item.id),
      provider: 'greenhouse',
      companyName: source.company_name || source.identifier,
      title: item.title,
      descriptionHtml: item.content || null,
      locationRaw: item.location?.name || item.offices?.[0]?.name || null,
      applyUrl: item.absolute_url,
      sourceUrl: item.absolute_url,
      postedAt: item.updated_at || null,
    };
  }
}

export const greenhouseAdapter = new GreenhouseAdapter();

