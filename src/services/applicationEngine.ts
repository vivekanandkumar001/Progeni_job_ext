export interface ApplicationRecord {
  id: string;
  jobId: string;
  candidateId: string;
  status: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  verifiedAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export interface ApplicationStorage {
  get(id: string, candidateId: string): Promise<ApplicationRecord | null>;
  list(candidateId: string): Promise<ApplicationRecord[]>;
  save(record: ApplicationRecord): Promise<ApplicationRecord>;
  updateStatus(
    id: string,
    status: string,
    candidateId: string,
    metadata?: Record<string, unknown>,
  ): Promise<ApplicationRecord | null>;
}

export const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  discovered: ['preparing', 'ready_for_review', 'approved', 'withdrawn', 'closed', 'failed', 'prepared'],
  preparing: ['ready_for_review', 'discovered', 'withdrawn', 'closed'],
  prepared: ['discovered', 'ready_for_review', 'approved', 'submitted', 'failed', 'withdrawn', 'closed'],
  ready_for_review: ['approved', 'preparing', 'withdrawn', 'closed'],
  approved: ['ready_for_review', 'submitted', 'withdrawn', 'closed'],
  submitted: ['under_review', 'shortlisted', 'interview_scheduled', 'rejected', 'verified', 'withdrawn', 'closed', 'failed'],
  verified: ['under_review', 'shortlisted', 'interview_scheduled', 'rejected', 'withdrawn', 'closed'],
  under_review: ['shortlisted', 'interview_scheduled', 'rejected', 'withdrawn', 'closed'],
  shortlisted: ['interview_scheduled', 'rejected', 'withdrawn', 'closed'],
  interview_scheduled: ['interview_scheduled', 'under_review', 'offer_received', 'rejected', 'withdrawn', 'closed'],
  interview: ['interview_scheduled', 'under_review', 'offer_received', 'rejected', 'withdrawn', 'closed'],
  rejected: ['closed'],
  offer_received: ['offer_accepted', 'offer_declined', 'withdrawn', 'closed'],
  offer_accepted: ['closed'],
  offer_declined: ['closed'],
  withdrawn: ['closed'],
  closed: [],
  failed: [],
};

export function transitionStatus(
  storage: ApplicationStorage,
  id: string,
  to: string,
  candidateId: string,
  metadata?: Record<string, unknown>,
): Promise<
  | { ok: true; record: ApplicationRecord }
  | { ok: false; error: string }
> {
  return (async () => {
    const record = await storage.get(id, candidateId);
    if (!record) return { ok: false, error: 'Application not found' };

    const allowed = LIFECYCLE_TRANSITIONS[record.status] || [];
    if (!allowed.includes(to)) {
      return {
        ok: false,
        error: `Cannot transition application from ${record.status} to ${to}`,
      };
    }

    const updated = await storage.updateStatus(id, to, candidateId, metadata);
    if (!updated) return { ok: false, error: 'Application not found' };
    return { ok: true, record: updated };
  })();
}
