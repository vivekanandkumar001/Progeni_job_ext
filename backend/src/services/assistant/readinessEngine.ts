import type {
  ReadinessResult,
  ReadinessBreakdown,
  JobSnapshot,
  CoverLetterData,
  ScreeningAnswerItem,
  FieldMappingItem,
  ApplicationApproval,
} from './types.js';

export interface ReadinessInput {
  jobSnapshot: JobSnapshot;
  masterResumeId: string | null;
  targetedResumeId: string | null;
  coverLetter?: CoverLetterData | null;
  screeningAnswers?: ScreeningAnswerItem[];
  fieldMappings?: FieldMappingItem[];
  missingInformation?: string[];
  approval?: ApplicationApproval | null;
}

export class ReadinessEngine {
  calculateReadiness(input: ReadinessInput): ReadinessResult {
    const checklist: ReadinessResult['checklist'] = [];

    // 1. Resume Component (max 20)
    let resumeScore = 0;
    const hasMaster = Boolean(input.masterResumeId);
    const hasTargeted = Boolean(input.targetedResumeId);

    if (hasMaster) resumeScore += 10;
    checklist.push({
      category: 'Resume',
      item: 'Master Resume Connected',
      ready: hasMaster,
      points: hasMaster ? 10 : 0,
      maxPoints: 10,
      actionRequired: hasMaster ? undefined : 'Link or upload a master resume from Resume Studio.',
    });

    if (hasTargeted) resumeScore += 10;
    checklist.push({
      category: 'Resume',
      item: 'Tailored Resume Generated for Role',
      ready: hasTargeted,
      points: hasTargeted ? 10 : 0,
      maxPoints: 10,
      actionRequired: hasTargeted ? undefined : 'Generate a tailored resume snapshot aligned with job requirements.',
    });

    const resumeCategory = {
      score: resumeScore,
      max: 20,
      ready: resumeScore === 20,
      reason: resumeScore === 20 ? 'Targeted resume prepared' : 'Resume needs configuration',
    };

    // 2. Cover Letter Component (max 15)
    let clScore = 0;
    const clContent = input.coverLetter?.content?.trim() || '';
    const hasCL = clContent.length > 50;
    if (hasCL) clScore += 10;
    checklist.push({
      category: 'Cover Letter',
      item: 'Cover Letter Generated',
      ready: hasCL,
      points: hasCL ? 10 : 0,
      maxPoints: 10,
      actionRequired: hasCL ? undefined : 'Generate a role-aligned cover letter.',
    });

    const isReviewed = Boolean(input.coverLetter?.versions && input.coverLetter.versions.length >= 1 && clContent.length > 100);
    if (isReviewed) clScore += 5;
    checklist.push({
      category: 'Cover Letter',
      item: 'Cover Letter Reviewed & Formatted',
      ready: isReviewed,
      points: isReviewed ? 5 : 0,
      maxPoints: 5,
      actionRequired: isReviewed ? undefined : 'Review and verify cover letter content.',
    });

    const clCategory = {
      score: clScore,
      max: 15,
      ready: clScore === 15,
      reason: clScore === 15 ? 'Cover letter ready' : 'Cover letter incomplete',
    };

    // 3. Screening Questions Component (max 25)
    let sqScore = 0;
    const questions = input.screeningAnswers || [];
    let allAnswered = true;
    let allApproved = true;

    if (questions.length === 0) {
      sqScore = 25; // No screening questions required for this application
      checklist.push({
        category: 'Screening Questions',
        item: 'Screening Questions Cleared',
        ready: true,
        points: 25,
        maxPoints: 25,
      });
    } else {
      const answeredCount = questions.filter((q) => Boolean(q.answer && q.answer.trim().length > 0)).length;
      const approvedCount = questions.filter((q) => q.userApproved).length;

      const answeredRatio = answeredCount / questions.length;
      const approvedRatio = approvedCount / questions.length;

      const answeredPoints = Math.round(answeredRatio * 15);
      const approvedPoints = Math.round(approvedRatio * 10);
      sqScore = answeredPoints + approvedPoints;

      allAnswered = answeredCount === questions.length;
      allApproved = approvedCount === questions.length;

      checklist.push({
        category: 'Screening Questions',
        item: `Answers Provided (${answeredCount}/${questions.length})`,
        ready: allAnswered,
        points: answeredPoints,
        maxPoints: 15,
        actionRequired: allAnswered ? undefined : 'Provide truthful answers to remaining screening questions.',
      });

      checklist.push({
        category: 'Screening Questions',
        item: `Candidate Approvals (${approvedCount}/${questions.length})`,
        ready: allApproved,
        points: approvedPoints,
        maxPoints: 10,
        actionRequired: allApproved ? undefined : 'Review and explicitly approve all screening question answers.',
      });
    }

    const sqCategory = {
      score: sqScore,
      max: 25,
      ready: sqScore === 25,
      reason: sqScore === 25 ? 'All screening questions verified' : 'Screening questions need review',
    };

    // 4. Form Fields Mapping Component (max 20)
    let ffScore = 0;
    const fields = input.fieldMappings || [];
    if (fields.length === 0) {
      // Default standard fields
      ffScore = 15;
      checklist.push({
        category: 'Form Fields',
        item: 'Standard Profile Fields Ready',
        ready: true,
        points: 15,
        maxPoints: 20,
        actionRequired: 'Verify form field mappings before submitting.',
      });
    } else {
      const requiredFields = fields.filter((f) => f.required);
      const mappedRequired = requiredFields.filter((f) => Boolean(f.value && f.value.trim().length > 0));
      const approvedFields = fields.filter((f) => f.approved);

      const requiredRatio = requiredFields.length > 0 ? mappedRequired.length / requiredFields.length : 1;
      const approvedRatio = fields.length > 0 ? approvedFields.length / fields.length : 1;

      const reqPoints = Math.round(requiredRatio * 10);
      const appPoints = Math.round(approvedRatio * 10);
      ffScore = reqPoints + appPoints;

      checklist.push({
        category: 'Form Fields',
        item: `Required Fields Populated (${mappedRequired.length}/${requiredFields.length || fields.length})`,
        ready: reqPoints === 10,
        points: reqPoints,
        maxPoints: 10,
        actionRequired: reqPoints === 10 ? undefined : 'Fill all mandatory application form fields.',
      });

      checklist.push({
        category: 'Form Fields',
        item: `Field-Level Approvals (${approvedFields.length}/${fields.length})`,
        ready: appPoints === 10,
        points: appPoints,
        maxPoints: 10,
        actionRequired: appPoints === 10 ? undefined : 'Approve mapped form values before autofill.',
      });
    }

    const ffCategory = {
      score: ffScore,
      max: 20,
      ready: ffScore === 20,
      reason: ffScore === 20 ? 'Form mappings approved' : 'Form mappings incomplete',
    };

    // 5. Missing Information Warnings (max 10)
    const warnings = input.missingInformation || [];
    let miScore = 10;
    if (warnings.length === 1) miScore = 7;
    else if (warnings.length === 2) miScore = 4;
    else if (warnings.length > 2) miScore = 0;

    checklist.push({
      category: 'Information Integrity',
      item: warnings.length === 0 ? 'Zero Missing Information Warnings' : `${warnings.length} Information Warnings`,
      ready: warnings.length === 0,
      points: miScore,
      maxPoints: 10,
      actionRequired: warnings.length === 0 ? undefined : `Resolve warnings: ${warnings.join('; ')}`,
    });

    const miCategory = {
      score: miScore,
      max: 10,
      ready: miScore === 10,
      reason: warnings.length === 0 ? 'No missing information' : `${warnings.length} warnings detected`,
    };

    // 6. Human Approval Gate (max 10)
    const isApproved = Boolean(input.approval?.isApproved);
    const haScore = isApproved ? 10 : 0;

    checklist.push({
      category: 'Human Gate',
      item: 'Candidate Explicit Approval Granted',
      ready: isApproved,
      points: haScore,
      maxPoints: 10,
      actionRequired: isApproved ? undefined : 'Explicit candidate approval is required prior to application submission.',
    });

    const haCategory = {
      score: haScore,
      max: 10,
      ready: isApproved,
      reason: isApproved ? 'Explicit approval granted by candidate' : 'Awaiting candidate review & approval',
    };

    const totalScore = resumeScore + clScore + sqScore + ffScore + miScore + haScore;
    const clampedScore = Math.max(0, Math.min(100, totalScore));

    const breakdown: ReadinessBreakdown = {
      resume: resumeCategory,
      coverLetter: clCategory,
      screeningQuestions: sqCategory,
      formFields: ffCategory,
      missingInfo: miCategory,
      humanApproval: haCategory,
    };

    const isReadyForSubmission = clampedScore >= 90 && isApproved;

    let summary = '';
    if (isReadyForSubmission) {
      summary = 'Application is 100% prepared, grounded in verified facts, and approved by the candidate for submission.';
    } else if (!isApproved) {
      summary = `Application technical readiness is ${clampedScore}%. Explicit candidate review and approval is required before submission.`;
    } else {
      summary = `Application technical readiness is ${clampedScore}%. Complete the remaining checklist items.`;
    }

    return {
      score: clampedScore,
      breakdown,
      checklist,
      isReadyForSubmission,
      summary,
    };
  }
}

export const readinessEngine = new ReadinessEngine();

