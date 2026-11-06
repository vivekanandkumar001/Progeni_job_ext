import type { JobDiscoverySource, JobProvider, JobProviderAdapter, RawJobPosting } from '../types.js';
import { greenhouseAdapter } from './greenhouseAdapter.js';
import { leverAdapter } from './leverAdapter.js';
import { ashbyAdapter } from './ashbyAdapter.js';
import { smartRecruitersAdapter } from './smartRecruitersAdapter.js';
import { workdayAdapter } from './workdayAdapter.js';

export class AdapterRegistry {
  private adapters = new Map<JobProvider, JobProviderAdapter>();

  constructor() {
    this.register(greenhouseAdapter);
    this.register(leverAdapter);
    this.register(ashbyAdapter);
    this.register(smartRecruitersAdapter);
    this.register(workdayAdapter);
  }

  register(adapter: JobProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: JobProvider): JobProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  getSupportedProviders(): JobProvider[] {
    return Array.from(this.adapters.keys());
  }

  async fetchJobsForSource(source: JobDiscoverySource): Promise<RawJobPosting[]> {
    const adapter = this.adapters.get(source.provider);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${source.provider}`);
    }
    return adapter.fetchJobs(source);
  }
}

export const adapterRegistry = new AdapterRegistry();

