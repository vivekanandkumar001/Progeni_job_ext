import type { JobProvider, RawJobPosting } from '../types.js';

export interface ManualJobImportInput {
  url?: string;
  title?: string;
  companyName?: string;
  descriptionText?: string;
  descriptionHtml?: string;
  location?: string;
  workplaceMode?: string;
  salary?: string;
  provider?: JobProvider;
  externalId?: string;
}

export class ManualImportAdapter {
  createRawPosting(input: ManualJobImportInput, defaultProvider: JobProvider = 'manual'): RawJobPosting {
    const title = (input.title || '').trim() || 'Imported Job Posting';
    const companyName = (input.companyName || '').trim() || 'Manual Import';
    const applyUrl = (input.url || '').trim() || `urn:autoapply:manual:${Date.now()}`;

    return {
      externalId: input.externalId || null,
      provider: input.provider || defaultProvider,
      companyName,
      title,
      descriptionHtml: input.descriptionHtml || null,
      descriptionText: input.descriptionText || null,
      locationRaw: input.location || null,
      workplaceModeRaw: input.workplaceMode || null,
      salaryRaw: input.salary || null,
      applyUrl,
      sourceUrl: input.url || null,
      postedAt: new Date().toISOString(),
    };
  }
}

export const manualImportAdapter = new ManualImportAdapter();

