import { getDatabase } from '../config/mongodb.js';
import { candidateProfileService } from './candidateProfileService.js';
import { candidatePreferencesService } from './candidatePreferencesService.js';
import { userAccountService } from './userAccountService.js';
import { authAuditService } from './authAuditService.js';

const TABLE = 'candidate_onboarding';
export const CURRENT_POLICY_VERSION = 'v1.0';

export interface ConsentRecord {
  accepted: boolean;
  accepted_at: string | null;
  version: string;
  revoked_at?: string | null;
}

export interface CandidateOnboardingRow {
  id: string;
  user_id: string;
  current_step: number; // 1 to 5
  completed_steps: number[];
  status: 'not_started' | 'in_progress' | 'completed';
  completed_at: string | null;
  consents: {
    data_processing: ConsentRecord;
    job_application_assistance: ConsentRecord;
  };
  created_at: string;
  updated_at: string;
}

export interface OnboardingStatusResponse {
  onboarding: CandidateOnboardingRow;
  completeness: {
    score: number;
    completedFields: string[];
    missingFields: string[];
  };
  extensionConnected: boolean;
  activeResumeCount: number;
}

const defaultOnboardingState = (userId: string): CandidateOnboardingRow => ({
  id: userId,
  user_id: userId,
  current_step: 1,
  completed_steps: [],
  status: 'not_started',
  completed_at: null,
  consents: {
    data_processing: {
      accepted: false,
      accepted_at: null,
      version: CURRENT_POLICY_VERSION,
    },
    job_application_assistance: {
      accepted: false,
      accepted_at: null,
      version: CURRENT_POLICY_VERSION,
    },
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export class CandidateOnboardingService {
  async get(userId: string): Promise<CandidateOnboardingRow> {
    const collection = (await getDatabase()).collection<CandidateOnboardingRow & { _id: string }>(TABLE);
    const existing = await collection.findOne({ _id: userId as any, user_id: userId });
    if (existing) {
      return { ...existing, id: existing._id };
    }
    const initial = defaultOnboardingState(userId);
    await collection.insertOne({ _id: userId, ...initial } as any);
    return initial;
  }

  async isExtensionConnected(userId: string): Promise<boolean> {
    try {
      const sessions = await userAccountService.listSessions(userId);
      return sessions.some(
        (s) =>
          !s.revokedAt &&
          Boolean(s.browser?.toLowerCase().includes('chrome extension')),
      );
    } catch {
      return false;
    }
  }

  async getActiveResumeCount(userId: string): Promise<number> {
    try {
      const db = await getDatabase();
      return await db.collection('resumes').countDocuments({ user_id: userId, is_active: true });
    } catch {
      return 0;
    }
  }

  async getFullStatus(userId: string): Promise<OnboardingStatusResponse> {
    const [onboarding, profile, extensionConnected, activeResumeCount] = await Promise.all([
      this.get(userId),
      candidateProfileService.get(userId),
      this.isExtensionConnected(userId),
      this.getActiveResumeCount(userId),
    ]);

    const completeness = candidateProfileService.calculateCompleteness(profile);

    return {
      onboarding,
      completeness,
      extensionConnected,
      activeResumeCount,
    };
  }

  async updateProgress(
    userId: string,
    updates: {
      step?: number;
      completeStep?: number;
      status?: 'not_started' | 'in_progress' | 'completed';
      dataProcessingConsent?: boolean;
      jobAssistanceConsent?: boolean;
    },
    clientIp = '127.0.0.1',
  ): Promise<CandidateOnboardingRow> {
    const collection = (await getDatabase()).collection<CandidateOnboardingRow & { _id: string }>(TABLE);
    const current = await this.get(userId);

    const completedStepsSet = new Set(current.completed_steps);
    if (typeof updates.completeStep === 'number') {
      completedStepsSet.add(updates.completeStep);
    }

    let status = current.status;
    let completedAt = current.completed_at;

    if (updates.status) {
      status = updates.status;
      if (status === 'completed' && !completedAt) {
        completedAt = new Date().toISOString();
        completedStepsSet.add(1);
        completedStepsSet.add(2);
        completedStepsSet.add(3);
        completedStepsSet.add(4);
        completedStepsSet.add(5);
      }
    } else if (status === 'not_started' && (updates.step || updates.completeStep)) {
      status = 'in_progress';
    }

    const nowIso = new Date().toISOString();
    const consents = { ...current.consents };

    // Handle Data Processing Consent change
    if (typeof updates.dataProcessingConsent === 'boolean') {
      if (updates.dataProcessingConsent) {
        consents.data_processing = {
          accepted: true,
          accepted_at: nowIso,
          version: CURRENT_POLICY_VERSION,
        };
        await authAuditService.logEvent({
          userId,
          action: 'consent_granted',
          ip: clientIp,
          metadata: { type: 'data_processing', version: CURRENT_POLICY_VERSION },
        });
        await this.syncConsentToWorkspace(userId, true);
      } else {
        consents.data_processing = {
          accepted: false,
          accepted_at: null,
          version: CURRENT_POLICY_VERSION,
          revoked_at: nowIso,
        };
        await authAuditService.logEvent({
          userId,
          action: 'consent_revoked',
          ip: clientIp,
          metadata: { type: 'data_processing', version: CURRENT_POLICY_VERSION },
        });
        await this.syncConsentToWorkspace(userId, false);
      }
    }

    // Handle Job Application Assistance Consent change
    if (typeof updates.jobAssistanceConsent === 'boolean') {
      if (updates.jobAssistanceConsent) {
        consents.job_application_assistance = {
          accepted: true,
          accepted_at: nowIso,
          version: CURRENT_POLICY_VERSION,
        };
        await authAuditService.logEvent({
          userId,
          action: 'consent_granted',
          ip: clientIp,
          metadata: { type: 'job_application_assistance', version: CURRENT_POLICY_VERSION },
        });
      } else {
        consents.job_application_assistance = {
          accepted: false,
          accepted_at: null,
          version: CURRENT_POLICY_VERSION,
          revoked_at: nowIso,
        };
        await authAuditService.logEvent({
          userId,
          action: 'consent_revoked',
          ip: clientIp,
          metadata: { type: 'job_application_assistance', version: CURRENT_POLICY_VERSION },
        });
      }
    }

    const updated: CandidateOnboardingRow = {
      id: userId,
      user_id: userId,
      current_step: typeof updates.step === 'number' ? Math.max(1, Math.min(5, updates.step)) : current.current_step,
      completed_steps: Array.from(completedStepsSet).sort((a, b) => a - b),
      status,
      completed_at: completedAt,
      consents,
      created_at: current.created_at,
      updated_at: nowIso,
    };

    const doc: any = { _id: userId, ...updated };
    await collection.replaceOne({ _id: userId as any }, doc, { upsert: true });
    return updated;
  }

  private async syncConsentToWorkspace(userId: string, accepted: boolean): Promise<void> {
    try {
      const db = await getDatabase();
      await db.collection('candidate_workspaces').updateOne(
        { _id: userId as any },
        {
          $set: {
            'data.consentAcceptedAt': accepted ? new Date().toISOString() : null,
          },
        },
        { upsert: false },
      );
    } catch {
      // Non-blocking
    }
  }
}

export const candidateOnboardingService = new CandidateOnboardingService();
