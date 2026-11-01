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
  get(id: string, candidateId?: string): Promise<ApplicationRecord | null>;
  list(candidateId: string): Promise<ApplicationRecord[]>;
  save(record: ApplicationRecord): Promise<ApplicationRecord>;
  updateStatus(
    id: string,
    status: string,
    metadata?: Record<string, unknown>,
    candidateId?: string,
  ): Promise<ApplicationRecord | null>;
}

const transitions: Record<string, string[]> = {
  discovered: ['prepared', 'failed'],
  prepared: ['discovered', 'submitted', 'failed'],
  submitted: ['verified', 'failed'],
  verified: [],
  failed: [],
};

export function transitionStatus(
  storage: ApplicationStorage,
  id: string,
  to: string,
  metadata?: Record<string, unknown>,
  candidateId?: string,
): Promise<
  | { ok: true; record: ApplicationRecord }
  | { ok: false; error: string }
> {
  return (async () => {
    const record = await storage.get(id, candidateId);
    if (!record) return { ok: false, error: 'Application not found' };

    if (!transitions[record.status]?.includes(to)) {
      return {
        ok: false,
        error: `Cannot transition application from ${record.status} to ${to}`,
      };
    }

    const updated = await storage.updateStatus(id, to, metadata, candidateId);
    if (!updated) return { ok: false, error: 'Application not found' };
    return { ok: true, record: updated };
  })();
}
