import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import { trackerTimelineService } from './trackerTimelineService.js';
import { lifecycleRules } from './lifecycleRules.js';
import type {
  SubmissionEvidenceRecord,
  SubmissionMethod,
  EvidenceVerificationStatus,
  ConfirmationEvidence,
} from './types.js';

const SUBMISSION_EVIDENCE_TABLE = 'submission_evidence';
const APPLICATIONS_TABLE = 'applications';

export interface RecordSubmissionEvidenceInput {
  jobId?: string;
  company?: string;
  jobTitle?: string;
  destination: string;
  submissionMethod: SubmissionMethod;
  confirmationReference?: string;
  confirmationEvidence?: ConfirmationEvidence;
  verificationStatus?: EvidenceVerificationStatus;
  notes?: string;
}

export class SubmissionEvidenceService {
  /**
   * Evaluates verified vs candidate_reported vs unverified based on objective proof.
   */
  classifyVerificationStatus(input: {
    submissionMethod: SubmissionMethod;
    confirmationReference?: string;
    confirmationEvidence?: ConfirmationEvidence;
    explicitStatus?: EvidenceVerificationStatus;
  }): EvidenceVerificationStatus {
    if (input.explicitStatus) {
      // Truth enforcement: Cannot claim 'verified' without a reference, evidence URL/snippet, or portal destination
      if (input.explicitStatus === 'verified') {
        const hasProof = Boolean(
          input.confirmationReference ||
          (input.confirmationEvidence && input.confirmationEvidence.value.trim().length > 0)
        );
        if (!hasProof) {
          return 'candidate_reported';
        }
      }
      return input.explicitStatus;
    }

    const hasProof = Boolean(
      input.confirmationReference ||
      (input.confirmationEvidence && input.confirmationEvidence.value.trim().length > 0)
    );

    if (input.submissionMethod === 'direct_api' || (input.submissionMethod === 'portal' && hasProof)) {
      return 'verified';
    }

    if (hasProof || input.submissionMethod === 'extension_assisted') {
      return 'candidate_reported';
    }

    return 'unverified';
  }

  /**
   * Records verified or candidate-reported submission evidence, updates application status to 'submitted',
   * and logs an immutable timeline audit event.
   */
  async recordSubmissionEvidence(
    candidateId: string,
    applicationId: string,
    input: RecordSubmissionEvidenceInput,
    actor = candidateId,
  ): Promise<SubmissionEvidenceRecord> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // Verify application exists and belongs to candidate
    const appDoc = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: applicationId,
      user_id: candidateId,
    });

    if (!appDoc) {
      throw new Error(`Application ${applicationId} not found for candidate ${candidateId}`);
    }

    // Determine lifecycle transition validity
    const currentStatus = appDoc.status || 'discovered';
    if (currentStatus !== 'submitted' && currentStatus !== 'verified') {
      lifecycleRules.assertValidTransition(currentStatus, 'submitted');
    }

    const verificationStatus = this.classifyVerificationStatus({
      submissionMethod: input.submissionMethod,
      confirmationReference: input.confirmationReference,
      confirmationEvidence: input.confirmationEvidence,
      explicitStatus: input.verificationStatus,
    });

    const company = input.company || appDoc.jobSnapshot?.company || 'Company';
    const jobTitle = input.jobTitle || appDoc.jobSnapshot?.title || 'Position';
    const jobId = input.jobId || appDoc.job_id || appDoc.jobId || '';

    const evidenceRecord: SubmissionEvidenceRecord & { _id: string; user_id: string; application_id: string } = {
      _id: randomUUID(),
      user_id: candidateId,
      application_id: applicationId,
      candidateId,
      jobId,
      company,
      jobTitle,
      destination: input.destination,
      submittedAt: now,
      submissionMethod: input.submissionMethod,
      confirmationReference: input.confirmationReference,
      confirmationEvidence: input.confirmationEvidence,
      verificationStatus,
      notes: input.notes,
      auditHistory: [
        {
          action: 'submission_recorded',
          timestamp: now,
          details: `Application submitted via ${input.submissionMethod} (${verificationStatus})`,
          performedBy: actor,
        },
      ],
    };

    // Save evidence document
    await db.collection<any>(SUBMISSION_EVIDENCE_TABLE).insertOne(evidenceRecord);

    // Update application doc with submission evidence reference and status
    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: applicationId, user_id: candidateId },
      {
        $set: {
          status: 'submitted',
          submitted_at: now,
          submission_evidence: {
            evidenceId: evidenceRecord._id,
            submissionMethod: evidenceRecord.submissionMethod,
            verificationStatus: evidenceRecord.verificationStatus,
            confirmationReference: evidenceRecord.confirmationReference,
            submittedAt: now,
            destination: evidenceRecord.destination,
          },
          updated_at: now,
        },
      },
    );

    // Record immutable timeline event
    await trackerTimelineService.recordEvent(candidateId, applicationId, {
      eventType: 'submitted',
      title: 'Application Submitted',
      description: `Submission recorded via ${input.submissionMethod} (Status: ${verificationStatus}) to ${input.destination}`,
      actor,
      metadata: {
        verificationStatus,
        submissionMethod: input.submissionMethod,
        confirmationReference: input.confirmationReference,
        evidenceId: evidenceRecord._id,
      },
    });

    return {
      candidateId: evidenceRecord.candidateId,
      jobId: evidenceRecord.jobId,
      company: evidenceRecord.company,
      jobTitle: evidenceRecord.jobTitle,
      destination: evidenceRecord.destination,
      submittedAt: evidenceRecord.submittedAt,
      submissionMethod: evidenceRecord.submissionMethod,
      confirmationReference: evidenceRecord.confirmationReference,
      confirmationEvidence: evidenceRecord.confirmationEvidence,
      verificationStatus: evidenceRecord.verificationStatus,
      notes: evidenceRecord.notes,
      auditHistory: evidenceRecord.auditHistory,
    };
  }

  /**
   * Retrieves all submission evidence records for an application.
   */
  async getSubmissionEvidence(
    candidateId: string,
    applicationId: string,
  ): Promise<SubmissionEvidenceRecord | null> {
    const db = await getDatabase();
    const doc = await db.collection<any>(SUBMISSION_EVIDENCE_TABLE).findOne(
      { user_id: candidateId, application_id: applicationId },
      { sort: { submittedAt: -1 } },
    );

    if (!doc) return null;

    return {
      candidateId: doc.candidateId || doc.user_id,
      jobId: doc.jobId || doc.job_id,
      company: doc.company,
      jobTitle: doc.jobTitle,
      destination: doc.destination,
      submittedAt: doc.submittedAt,
      submissionMethod: doc.submissionMethod,
      confirmationReference: doc.confirmationReference,
      confirmationEvidence: doc.confirmationEvidence,
      verificationStatus: doc.verificationStatus,
      notes: doc.notes,
      auditHistory: doc.auditHistory || [],
    };
  }
}

export const submissionEvidenceService = new SubmissionEvidenceService();
