import type { JobDiscoverySource, JobProviderAdapter, RawJobPosting } from '../types.js';

interface SmartRecruitersItem {
  id: string;
  name: string;
  releasedDate?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  typeOfEmployment?: {
    label?: string;
    id?: string;
  };
  refNumber?: string;
  jobAd?: {
    sections?: {
      jobDescription?: { text?: string };
      qualifications?: { text?: string };
      additionalInformation?: { text?: string };
    };
  };
}

export class SmartRecruitersAdapter implements JobProviderAdapter {
  readonly provider = 'smartrecruiters' as const;
  readonly name = 'SmartRecruiters Career Adapter';

  async fetchJobs(source: JobDiscoverySource): Promise<RawJobPosting[]> {
    const company = source.identifier.trim();
    if (!company) {
      throw new Error('SmartRecruiters company identifier is required');
    }

    const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings`;

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
        throw new Error(`SmartRecruiters API returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as { content?: SmartRecruitersItem[] };
      const postings = Array.isArray(data.content) ? data.content : [];

      return postings.map((posting) => this.transform(posting, source));
    } catch (error: any) {
      throw new Error(`SmartRecruiters adapter failed for ${company}: ${error.message || error}`);
    }
  }

  transform(item: SmartRecruitersItem, source: JobDiscoverySource): RawJobPosting {
    const locParts: string[] = [];
    if (item.location?.city) locParts.push(item.location.city);
    if (item.location?.region) locParts.push(item.location.region);
    if (item.location?.country) locParts.push(item.location.country.toUpperCase());
    const locationRaw = locParts.length > 0 ? locParts.join(', ') : null;

    let workplaceModeRaw: string | null = null;
    if (item.location?.remote) {
      workplaceModeRaw = 'remote';
    }

    const applyUrl = `https://jobs.smartrecruiters.com/${encodeURIComponent(source.identifier)}/${item.id}`;

    return {
      externalId: item.id,
      provider: 'smartrecruiters',
      companyName: source.company_name || source.identifier,
      title: item.name,
      locationRaw,
      employmentTypeRaw: item.typeOfEmployment?.label || null,
      workplaceModeRaw,
      applyUrl,
      sourceUrl: applyUrl,
      postedAt: item.releasedDate || null,
    };
  }
}

export const smartRecruitersAdapter = new SmartRecruitersAdapter();

