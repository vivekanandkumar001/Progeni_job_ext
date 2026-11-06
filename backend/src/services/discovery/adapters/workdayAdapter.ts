import type { JobDiscoverySource, JobProviderAdapter, RawJobPosting } from '../types.js';

interface WorkdayPostingItem {
  title: string;
  externalPath: string;
  locationsText?: string;
  bulletFields?: string[];
  postedOn?: string;
}

export class WorkdayAdapter implements JobProviderAdapter {
  readonly provider = 'workday' as const;
  readonly name = 'Workday Career Portal Adapter';

  async fetchJobs(source: JobDiscoverySource): Promise<RawJobPosting[]> {
    if (!source.url) {
      throw new Error('Workday source URL is required');
    }

    try {
      // Compliance check: Only crawl open unauthenticated HTTP endpoints
      const response = await fetch(source.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AutoApply-JobDiscoveryEngine/1.0',
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: 20,
          offset: 0,
          searchText: '',
        }),
        signal: AbortSignal.timeout(10000),
      });

      // If CAPTCHA challenge or Cloudflare protected or forbidden, strictly avoid bypass
      if (response.status === 403 || response.status === 429) {
        throw new Error(
          `Workday endpoint blocked or requires browser verification (HTTP ${response.status}). Bypass is not permitted.`,
        );
      }

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { jobPostings?: WorkdayPostingItem[] };
      const items = Array.isArray(data.jobPostings) ? data.jobPostings : [];

      return items.map((item) => this.transform(item, source));
    } catch (error: any) {
      throw new Error(`Workday adapter failed for ${source.company_name}: ${error.message || error}`);
    }
  }

  transform(item: WorkdayPostingItem, source: JobDiscoverySource): RawJobPosting {
    // Deduce apply URL
    let applyUrl = source.url;
    if (item.externalPath) {
      try {
        const u = new URL(source.url);
        applyUrl = `${u.origin}${item.externalPath}`;
      } catch {
        applyUrl = `${source.url}/${item.externalPath}`;
      }
    }

    return {
      externalId: item.externalPath || item.title,
      provider: 'workday',
      companyName: source.company_name || 'Workday Employer',
      title: item.title,
      locationRaw: item.locationsText || null,
      descriptionText: item.bulletFields ? item.bulletFields.join('\n') : null,
      applyUrl,
      sourceUrl: applyUrl,
    };
  }
}

export const workdayAdapter = new WorkdayAdapter();

