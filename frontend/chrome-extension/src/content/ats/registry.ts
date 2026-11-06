import type { ATSAdapter, ATSPlatform } from './types.js';
import { greenhouseAdapter } from './greenhouseAdapter.js';
import { leverAdapter } from './leverAdapter.js';
import { ashbyAdapter } from './ashbyAdapter.js';
import { workdayAdapter } from './workdayAdapter.js';
import { smartRecruitersAdapter } from './smartRecruitersAdapter.js';
import { linkedInAdapter, indeedAdapter, naukriAdapter } from './jobBoardAdapters.js';

export class ATSAdapterRegistry {
  private adapters: ATSAdapter[] = [
    greenhouseAdapter,
    leverAdapter,
    ashbyAdapter,
    workdayAdapter,
    smartRecruitersAdapter,
    linkedInAdapter,
    indeedAdapter,
    naukriAdapter,
  ];

  public register(adapter: ATSAdapter): void {
    this.adapters.unshift(adapter);
  }

  public getAdapterForUrl(url: string, document: Document): ATSAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.matches(url, document)) {
        return adapter;
      }
    }
    return null;
  }

  public getAdapterByPlatform(platform: ATSPlatform): ATSAdapter | null {
    return this.adapters.find((a) => a.platform === platform) || null;
  }

  public getAllSupportedPlatforms(): Array<{ platform: ATSPlatform; name: string }> {
    return this.adapters.map((a) => ({ platform: a.platform, name: a.name }));
  }
}

export const atsRegistry = new ATSAdapterRegistry();

