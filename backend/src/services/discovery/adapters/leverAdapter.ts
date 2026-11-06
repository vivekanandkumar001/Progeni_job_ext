import type { JobDiscoverySource, JobProviderAdapter, RawJobPosting } from '../types.js';

interface LeverPostingItem {
  id: string;
  text: string;
  createdAt?: number;
  description?: string;
  descriptionPlain?: string;
  hostedUrl: string;
  applyUrl: string;
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  workplaceType?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
  };
}

export class LeverAdapter implements JobProviderAdapter {
  readonly provider = 'lever' as const;
  readonly name = 'Lever Job Postings Adapter';

  async fetchJobs(source: JobDiscoverySource): Promise<RawJobPosting[]> {
    const company = source.identifier.trim();
    if (!company) {
      throw new Error('Lever company identifier is required');
    }

    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;

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
        throw new Error(`Lever API returned HTTP ${response.status}`);
      }

      const postings = (await response.json()) as LeverPostingItem[];
      const list = Array.isArray(postings) ? postings : [];

      return list.map((posting) => this.transform(posting, source));
    } catch (error: any) {
      throw new Error(`Lever adapter failed for ${company}: ${error.message || error}`);
    }
  }

  transform(item: LeverPostingItem, source: JobDiscoverySource): RawJobPosting {
    let salaryRaw: string | null = null;
    if (item.salaryRange && (item.salaryRange.min || item.salaryRange.max)) {
      salaryRaw = `${item.salaryRange.currency || 'USD'} ${item.salaryRange.min || ''} - ${item.salaryRange.max || ''} ${item.salaryRange.interval || ''}`.trim();
    }

    const postedDate = item.createdAt ? new Date(item.createdAt).toISOString() : null;

    return {
      externalId: item.id,
      provider: 'lever',
      companyName: source.company_name || source.identifier,
      title: item.text,
      descriptionHtml: item.description || null,
      descriptionText: item.descriptionPlain || null,
      locationRaw: item.categories?.location || null,
      employmentTypeRaw: item.categories?.commitment || null,
      workplaceModeRaw: item.workplaceType || null,
      salaryRaw,
      applyUrl: item.applyUrl || item.hostedUrl,
      sourceUrl: item.hostedUrl,
      postedAt: postedDate,
    };
  }
}

export const leverAdapter = new LeverAdapter();

