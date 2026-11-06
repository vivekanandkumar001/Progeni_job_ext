import { getDatabase } from '../../config/mongodb.js';
import type { ApplicationAnalytics } from './types.js';

const APPLICATIONS_TABLE = 'applications';
const SUBMISSION_EVIDENCE_TABLE = 'submission_evidence';

export class AnalyticsService {
  /**
   * Computes comprehensive, transparent analytics for a candidate's applications.
   * Denominators strictly exclude unverified / unsubmitted applications.
   */
  async calculateApplicationAnalytics(candidateId: string): Promise<ApplicationAnalytics> {
    const db = await getDatabase();

    const [applications, submissionEvidence] = await Promise.all([
      db.collection<any>(APPLICATIONS_TABLE).find({ user_id: candidateId }).toArray(),
      db.collection<any>(SUBMISSION_EVIDENCE_TABLE).find({ user_id: candidateId }).toArray(),
    ]);

    const stageBreakdown: Record<string, number> = {
      discovered: 0,
      preparing: 0,
      ready_for_review: 0,
      approved: 0,
      submitted: 0,
      under_review: 0,
      shortlisted: 0,
      interview_scheduled: 0,
      rejected: 0,
      offer_received: 0,
      offer_accepted: 0,
      offer_declined: 0,
      withdrawn: 0,
      closed: 0,
    };

    let totalApplications = applications.length;
    let pendingApplications = 0;
    let responses = 0;
    let interviewsScheduled = 0;
    let rejections = 0;
    let offersReceived = 0;
    let offersAccepted = 0;
    let offersDeclined = 0;
    let withdrawn = 0;
    let closed = 0;

    for (const app of applications) {
      let status = (app.status || 'discovered').toLowerCase();
      // Handle legacy aliases
      if (status === 'prepared') status = 'ready_for_review';
      if (status === 'verified') status = 'submitted';
      if (status === 'interview') status = 'interview_scheduled';

      if (stageBreakdown[status] !== undefined) {
        stageBreakdown[status] += 1;
      } else {
        stageBreakdown[status] = (stageBreakdown[status] || 0) + 1;
      }

      if (['discovered', 'preparing', 'ready_for_review', 'approved'].includes(status)) {
        pendingApplications += 1;
      }

      if (
        [
          'under_review',
          'shortlisted',
          'interview_scheduled',
          'rejected',
          'offer_received',
          'offer_accepted',
          'offer_declined',
        ].includes(status)
      ) {
        responses += 1;
      }

      if (status === 'interview_scheduled') interviewsScheduled += 1;
      if (status === 'rejected') rejections += 1;
      if (status === 'offer_received') offersReceived += 1;
      if (status === 'offer_accepted') offersAccepted += 1;
      if (status === 'offer_declined') offersDeclined += 1;
      if (status === 'withdrawn') withdrawn += 1;
      if (status === 'closed') closed += 1;
    }

    // Determine evidence counts
    let verifiedSubmissions = 0;
    let candidateReportedSubmissions = 0;
    let unverifiedSubmissions = 0;

    for (const ev of submissionEvidence) {
      if (ev.verificationStatus === 'verified') verifiedSubmissions += 1;
      else if (ev.verificationStatus === 'candidate_reported') candidateReportedSubmissions += 1;
      else unverifiedSubmissions += 1;
    }

    // If an application has submitted status but no separate evidence record, count as candidate_reported or unverified
    const totalSubmittedOrPost =
      totalApplications - pendingApplications;
    const recordedEvidenceCount =
      verifiedSubmissions + candidateReportedSubmissions + unverifiedSubmissions;

    if (totalSubmittedOrPost > recordedEvidenceCount) {
      // Attribute difference to candidate_reported
      candidateReportedSubmissions += totalSubmittedOrPost - recordedEvidenceCount;
    }

    // Denominator for conversion rates: Total actual submissions (verified + candidate_reported)
    const validSubmissionsDenominator = verifiedSubmissions + candidateReportedSubmissions;

    const responseRate =
      validSubmissionsDenominator > 0
        ? Math.round((responses / validSubmissionsDenominator) * 1000) / 10
        : 0;

    const interviewConversionRate =
      validSubmissionsDenominator > 0
        ? Math.round((interviewsScheduled / validSubmissionsDenominator) * 1000) / 10
        : 0;

    const offerConversionRate =
      validSubmissionsDenominator > 0
        ? Math.round(((offersReceived + offersAccepted + offersDeclined) / validSubmissionsDenominator) * 1000) / 10
        : 0;

    return {
      candidateId,
      calculatedAt: new Date().toISOString(),
      totalApplications,
      verifiedSubmissions,
      candidateReportedSubmissions,
      unverifiedSubmissions,
      pendingApplications,
      responses,
      interviewsScheduled,
      rejections,
      offersReceived,
      offersAccepted,
      offersDeclined,
      withdrawn,
      closed,
      responseRate,
      interviewConversionRate,
      offerConversionRate,
      stageBreakdown,
      denominators: {
        responseRateDenominator:
          'Responses (under_review, shortlisted, interview_scheduled, rejected, offer_*) / Total Submissions (verifiedSubmissions + candidateReportedSubmissions)',
        interviewRateDenominator:
          'Interviews Scheduled / Total Submissions (verifiedSubmissions + candidateReportedSubmissions)',
        offerRateDenominator:
          'Offers (received, accepted, declined) / Total Submissions (verifiedSubmissions + candidateReportedSubmissions)',
      },
      disclaimer:
        'Auto Apply AI provides tracking and assistance tools. Past performance and conversion rates do not guarantee future job offers, interview invitations, or employment outcomes. Metrics reflect user-reported and system-recorded activity.',
    };
  }
}

export const analyticsService = new AnalyticsService();

