import { createHash, randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import type {
  ApplicationWorkspace,
  ApplicationStatus,
  JobSnapshot,
  MatchSnapshot,
  CoverLetterData,
  ScreeningAnswerItem,
  FieldMappingItem,
  ApplicationApproval,
  ExportBundle,
} from './types.js';
import { coverLetterService } from './coverLetterService.js';
import { readinessEngine } from './readinessEngine.js';
import { targetedResumeService } from '../targetedResumeService.js';
import { resumeStudioService } from '../resumeStudioService.js';
import { candidateProfileService } from '../candidateProfileService.js';
import { jobDiscoveryService } from '../jobDiscoveryService.js';
import { jobService } from '../jobService.js';
import { generateGroundedAnswer } from '../answerEngine.js';
import { localDataStore } from '../localDataStore.js';

const APPLICATIONS_TABLE = 'applications';
const MATCHES_TABLE = 'job_matches';

export interface CreateWorkspaceInput {
  jobId: string;
  idempotencyKey?: string;
  customTone?: 'professional' | 'concise' | 'technical' | 'enthusiastic';
  customInstructions?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkspaceInput {
  coverLetter?: Partial<CoverLetterData>;
  screeningAnswers?: ScreeningAnswerItem[];
  fieldMappings?: FieldMappingItem[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class ApplicationWorkspaceService {
  /**
   * Converts a database document to an ApplicationWorkspace object.
   */
  private toWorkspace(doc: any): ApplicationWorkspace {
    const jobSnapshot: JobSnapshot = doc.jobSnapshot || doc.job_snapshot || {
      id: doc.job_id || '',
      title: 'Job Position',
      company: 'Target Company',
      location: 'Remote',
      url: '',
      requiredSkills: [],
    };

    const matchSnapshot: MatchSnapshot = doc.matchSnapshot || doc.match_snapshot || {
      score: 75,
      eligible: true,
      status: 'eligible',
      reasons: ['Match evaluated against candidate profile'],
    };

    const coverLetter: CoverLetterData = doc.coverLetter || doc.cover_letter || {
      id: randomUUID(),
      version: 1,
      tone: 'professional',
      content: '',
      versions: [],
      updatedAt: doc.updated_at || new Date().toISOString(),
    };

    const screeningAnswers: ScreeningAnswerItem[] = doc.screeningAnswers || doc.screening_answers || [];
    const fieldMappings: FieldMappingItem[] = doc.fieldMappings || doc.field_mappings || [];
    const missingInformation: string[] = doc.missingInformation || doc.missing_information || [];

    const approval: ApplicationApproval = doc.approval || {
      isApproved: false,
      approvedAt: null,
      approvedBy: null,
      approvalSignature: null,
      confirmationSummary: null,
      auditTrail: [
        {
          action: 'created',
          timestamp: doc.created_at || new Date().toISOString(),
          userId: doc.user_id,
          details: 'Application workspace initialized',
        },
      ],
    };

    // Calculate current readiness
    const readiness = readinessEngine.calculateReadiness({
      jobSnapshot,
      masterResumeId: doc.masterResumeId || doc.master_resume_id || null,
      targetedResumeId: doc.targetedResumeId || doc.targeted_resume_id || null,
      coverLetter,
      screeningAnswers,
      fieldMappings,
      missingInformation,
      approval,
    });

    return {
      id: doc._id || doc.id,
      candidateId: doc.user_id || doc.candidateId,
      jobId: doc.job_id || doc.jobId || '',
      status: (doc.status as ApplicationStatus) || 'discovered',
      idempotencyKey: doc.idempotency_key || doc.idempotencyKey || randomUUID(),
      jobSnapshot,
      matchSnapshot,
      masterResumeId: doc.masterResumeId || doc.master_resume_id || null,
      targetedResumeId: doc.targetedResumeId || doc.targeted_resume_id || null,
      targetedResumeSnapshot: doc.targetedResumeSnapshot || doc.targeted_resume_snapshot || null,
      coverLetter,
      screeningAnswers,
      fieldMappings,
      missingInformation,
      readiness,
      approval,
      notes: doc.notes || (typeof doc.metadata?.notes === 'string' ? doc.metadata.notes : ''),
      createdAt: doc.created_at || doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updated_at || doc.updatedAt || new Date().toISOString(),
      submittedAt: doc.submitted_at || doc.submittedAt || null,
      verifiedAt: doc.verified_at || doc.verifiedAt || null,
      failureReason: doc.failure_reason || doc.failureReason || null,
      metadata: doc.metadata || {},
    };
  }

  /**
   * Creates or initializes a complete application workspace for a matched job.
   */
  async createWorkspace(userId: string, input: CreateWorkspaceInput): Promise<ApplicationWorkspace> {
    const db = await getDatabase();
    const collection = db.collection<any>(APPLICATIONS_TABLE);

    // 1. Idempotency and duplicate check
    if (input.idempotencyKey) {
      const existingKey = await collection.findOne({
        idempotency_key: input.idempotencyKey,
        user_id: userId,
      });
      if (existingKey) return this.toWorkspace(existingKey);
    }

    if (input.jobId) {
      const existingJob = await collection.findOne({
        job_id: input.jobId,
        user_id: userId,
      });
      if (existingJob) return this.toWorkspace(existingJob);
    }

    // 2. Fetch Job Details
    let jobData: any = null;
    try {
      jobData = await jobDiscoveryService.getJobById(input.jobId, userId);
    } catch {
      // ignore
    }
    if (!jobData) {
      try {
        jobData = await jobService.get(input.jobId);
      } catch {
        // ignore
      }
    }

    const jobSnapshot: JobSnapshot = {
      id: input.jobId || randomUUID(),
      title: jobData?.title || 'Software Engineer',
      company: jobData?.company || jobData?.companyName || 'Target Organization',
      location: jobData?.location || 'Remote',
      workplaceMode: jobData?.workplace_mode || jobData?.workplaceMode || 'remote',
      url: jobData?.url || `https://example.com/jobs/${input.jobId}`,
      platform: jobData?.platform || jobData?.provider || 'ATS Portal',
      requiredSkills: Array.isArray(jobData?.required_skills)
        ? jobData.required_skills
        : Array.isArray(jobData?.skills)
          ? jobData.skills
          : Array.isArray(jobData?.requiredSkills)
            ? jobData.requiredSkills
            : [],
      preferredSkills: Array.isArray(jobData?.preferred_skills) ? jobData.preferred_skills : [],
      description: jobData?.description || jobData?.description_text || jobData?.descriptionText || '',
      salary: jobData?.salary || (jobData?.salary_min ? `$${jobData.salary_min} - $${jobData.salary_max || ''}` : null),
      experienceMin: jobData?.experience_min ?? jobData?.experienceMin ?? null,
      experienceMax: jobData?.experience_max ?? jobData?.experienceMax ?? null,
    };

    // 3. Fetch Match Snapshot
    let matchSnapshot: MatchSnapshot = {
      score: 75,
      eligible: true,
      status: 'eligible',
      reasons: ['Candidate matched role requirements'],
    };
    try {
      const matchDoc = await db.collection<any>(MATCHES_TABLE).findOne({
        user_id: userId,
        job_id: input.jobId,
      });
      if (matchDoc) {
        matchSnapshot = {
          score: matchDoc.score || 75,
          eligible: matchDoc.eligible !== false,
          status: matchDoc.eligibility_decision || (matchDoc.eligible ? 'eligible' : 'ineligible'),
          reasons: matchDoc.explanation || [],
          missingEvidence: matchDoc.missing_evidence || [],
          dimensionScores: matchDoc.dimension_scores || matchDoc.factors || {},
        };
      }
    } catch {
      // fallback default
    }

    // 4. Fetch Master Resume & Profile
    let masterResume: any = null;
    try {
      masterResume = await resumeStudioService.getMasterResume(userId);
    } catch {
      // create/init if not found
    }

    const profile = await candidateProfileService.get(userId).catch(() => null);

    // 5. Generate Tailored Resume Snapshot via Truth Engine
    let targetedResumeId: string | null = null;
    let targetedResumeSnapshot: any = null;
    if (jobSnapshot.description && jobSnapshot.description.length >= 20) {
      try {
        const tailoredResult = await targetedResumeService.generateTargetedResume(userId, {
          baseResumeId: masterResume?.id,
          jobDescription: jobSnapshot.description,
          targetRole: jobSnapshot.title,
          targetCompany: jobSnapshot.company,
          jobId: jobSnapshot.id,
        });
        targetedResumeId = tailoredResult.targetedResume.id;
        targetedResumeSnapshot = {
          id: tailoredResult.targetedResume.id,
          title: tailoredResult.targetedResume.title,
          summary: tailoredResult.targetedResume.content?.summary || '',
          skills: (tailoredResult.targetedResume.content?.skills || []).map((s: any) => s.name),
          alignmentScore: tailoredResult.alignmentScore,
          updatedAt: new Date().toISOString(),
        };
      } catch {
        // Log and proceed without blocking workspace creation
      }
    }

    // 6. Generate Grounded Cover Letter
    const coverLetter = await coverLetterService.generateCoverLetter(userId, {
      jobTitle: jobSnapshot.title,
      companyName: jobSnapshot.company,
      jobDescription: jobSnapshot.description,
      tone: input.customTone || 'professional',
      customInstructions: input.customInstructions,
    });

    // 7. Extract & Answer Standard Screening Questions
    const dbProfile = profile || (await candidateProfileService.get(userId).catch(() => null));
    const candidateLocalProfile: any = dbProfile
      ? {
          fullName: dbProfile.full_name || '',
          email: dbProfile.email || '',
          phone: dbProfile.phone || '',
          location: dbProfile.location || (dbProfile.city ? `${dbProfile.city}, ${dbProfile.country || ''}` : ''),
          skills: dbProfile.skills || [],
          experienceYears: dbProfile.experience_years ?? null,
        }
      : await localDataStore.getProfile(userId).catch(() => null);
    const candidateResumes = await localDataStore.listResumes(userId).catch(() => []);

    const questionsToSeed = [
      'Are you legally authorized to work in the country of this role?',
      'Do you now or will you in the future require visa sponsorship?',
      'How many years of professional experience do you have?',
      'What is your notice period or earliest start date?',
      ...(jobSnapshot.requiredSkills.slice(0, 3).map((s) => `Do you have experience with ${s}?`)),
    ];

    const screeningAnswers: ScreeningAnswerItem[] = questionsToSeed.map((q) => {
      const grounded = generateGroundedAnswer(q, candidateLocalProfile, candidateResumes);
      return {
        id: randomUUID(),
        question: q,
        category: grounded.category,
        answer: grounded.suggestedAnswer,
        confidence: grounded.confidence,
        isGrounded: grounded.isGrounded,
        sourceField: grounded.sourceField,
        sourceEvidence: grounded.evidence,
        requiresUserReview: grounded.requiresUserReview,
        status: grounded.status,
        userApproved: false, // Strict human approval: false by default
      };
    });

    // 8. Generate Form Field Mappings
    const fieldMappings: FieldMappingItem[] = [
      {
        id: randomUUID(),
        fieldName: 'full_name',
        label: 'Full Legal Name',
        fieldType: 'text',
        value: profile?.full_name || masterResume?.content?.personal_info?.full_name || '',
        source: 'Candidate Profile',
        selector: '#name, #full_name, input[name*="name"]',
        required: true,
        approved: false,
      },
      {
        id: randomUUID(),
        fieldName: 'email',
        label: 'Email Address',
        fieldType: 'email',
        value: profile?.email || masterResume?.content?.personal_info?.email || '',
        source: 'Candidate Profile',
        selector: '#email, input[name*="email"]',
        required: true,
        approved: false,
      },
      {
        id: randomUUID(),
        fieldName: 'phone',
        label: 'Phone Number',
        fieldType: 'tel',
        value: profile?.phone || masterResume?.content?.personal_info?.phone || '',
        source: 'Candidate Profile',
        selector: '#phone, input[name*="phone"]',
        required: true,
        approved: false,
      },
      {
        id: randomUUID(),
        fieldName: 'location',
        label: 'Current Location',
        fieldType: 'text',
        value: profile?.location || (profile?.city ? `${profile.city}, ${profile.country || ''}` : '') || (masterResume?.content?.personal_info?.city ? `${masterResume.content.personal_info.city}, ${masterResume.content.personal_info.country || ''}` : ''),
        source: 'Candidate Profile',
        selector: '#location, input[name*="location"]',
        required: false,
        approved: false,
      },
      {
        id: randomUUID(),
        fieldName: 'linkedin_url',
        label: 'LinkedIn URL',
        fieldType: 'text',
        value: profile?.linkedin_url || masterResume?.content?.personal_info?.linkedin_url || '',
        source: 'Candidate Profile',
        selector: 'input[name*="linkedin"]',
        required: false,
        approved: false,
      },
      {
        id: randomUUID(),
        fieldName: 'portfolio_url',
        label: 'Portfolio / GitHub URL',
        fieldType: 'text',
        value: profile?.portfolio_url || profile?.github_url || masterResume?.content?.personal_info?.portfolio_url || masterResume?.content?.personal_info?.website_url || '',
        source: 'Candidate Profile',
        selector: 'input[name*="portfolio"], input[name*="website"], input[name*="github"]',
        required: false,
        approved: false,
      },
      {
        id: randomUUID(),
        fieldName: 'resume_file',
        label: 'Tailored Resume Attachment',
        fieldType: 'file',
        value: targetedResumeSnapshot?.title || masterResume?.title || 'Master Resume.pdf',
        source: 'Resume Studio',
        selector: 'input[type="file"][name*="resume"]',
        required: true,
        approved: false,
      },
    ];

    // 9. Detect Missing Information Warnings
    const missingInformation: string[] = [];
    if (!profile?.phone) missingInformation.push('Missing contact phone number in profile.');
    if (!profile?.location && !profile?.city) missingInformation.push('Missing current city / location in profile.');
    if (jobSnapshot.requiredSkills.length > 0) {
      const candidateSkills = (profile?.skills || []).map((s: string) => s.toLowerCase());
      const missingSkills = jobSnapshot.requiredSkills.filter((s) => !candidateSkills.includes(s.toLowerCase()));
      if (missingSkills.length > 0) {
        missingInformation.push(`Unmatched job requirements: ${missingSkills.slice(0, 3).join(', ')}.`);
      }
    }

    // 10. Initial Approval State (Strict Human Gate)
    const now = new Date().toISOString();
    const approval: ApplicationApproval = {
      isApproved: false,
      approvedAt: null,
      approvedBy: null,
      approvalSignature: null,
      confirmationSummary: null,
      auditTrail: [
        {
          action: 'created',
          timestamp: now,
          userId,
          details: `Application workspace initialized for ${jobSnapshot.title} at ${jobSnapshot.company}.`,
        },
      ],
    };

    // 11. Initial Readiness Calculation
    const readiness = readinessEngine.calculateReadiness({
      jobSnapshot,
      masterResumeId: masterResume?.id || null,
      targetedResumeId,
      coverLetter,
      screeningAnswers,
      fieldMappings,
      missingInformation,
      approval,
    });

    const workspaceId = randomUUID();
    const idempotencyKey = input.idempotencyKey || randomUUID();

    const document = {
      _id: workspaceId,
      user_id: userId,
      job_id: jobSnapshot.id,
      status: 'discovered',
      idempotency_key: idempotencyKey,
      job_snapshot: jobSnapshot,
      match_snapshot: matchSnapshot,
      master_resume_id: masterResume?.id || null,
      targeted_resume_id: targetedResumeId,
      targeted_resume_snapshot: targetedResumeSnapshot,
      cover_letter: coverLetter,
      screening_answers: screeningAnswers,
      field_mappings: fieldMappings,
      missing_information: missingInformation,
      readiness,
      approval,
      notes: typeof input.metadata?.notes === 'string' ? input.metadata.notes : '',
      created_at: now,
      updated_at: now,
      metadata: input.metadata || {},
    };

    await collection.insertOne(document);
    return this.toWorkspace(document);
  }

  /**
   * Retrieves an application workspace by ID, verifying candidate ownership.
   */
  async getWorkspace(userId: string, id: string): Promise<ApplicationWorkspace | null> {
    const db = await getDatabase();
    const doc = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: id,
      user_id: userId,
    });
    if (!doc) return null;
    return this.toWorkspace(doc);
  }

  /**
   * Lists application workspaces for the candidate with pagination and status filter.
   */
  async listWorkspaces(
    userId: string,
    options?: { status?: string; q?: string; page?: number; limit?: number },
  ): Promise<{ applications: ApplicationWorkspace[]; total: number; page: number; limit: number }> {
    const db = await getDatabase();
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { user_id: userId };
    if (options?.status) {
      filter.status = options.status;
    }
    if (options?.q) {
      const regex = { $regex: options.q, $options: 'i' };
      filter.$or = [
        { 'job_snapshot.title': regex },
        { 'job_snapshot.company': regex },
        { 'job_snapshot.location': regex },
        { notes: regex },
      ];
    }

    const [docs, total] = await Promise.all([
      db.collection<any>(APPLICATIONS_TABLE)
        .find(filter)
        .sort({ updated_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection<any>(APPLICATIONS_TABLE).countDocuments(filter),
    ]);

    return {
      applications: docs.map((doc) => this.toWorkspace(doc)),
      total,
      page,
      limit,
    };
  }

  /**
   * Updates fields within an application workspace.
   */
  async updateWorkspace(
    userId: string,
    id: string,
    updates: UpdateWorkspaceInput,
  ): Promise<ApplicationWorkspace> {
    const db = await getDatabase();
    const existing = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: id,
      user_id: userId,
    });
    if (!existing) {
      throw new Error('Application workspace not found or access denied.');
    }

    const workspace = this.toWorkspace(existing);
    const now = new Date().toISOString();

    if (updates.coverLetter) {
      workspace.coverLetter = {
        ...workspace.coverLetter,
        ...updates.coverLetter,
        updatedAt: now,
      };
      workspace.approval.auditTrail.push({
        action: 'cover_letter_updated',
        timestamp: now,
        userId,
        details: 'Cover letter modified',
      });
    }

    if (updates.screeningAnswers) {
      workspace.screeningAnswers = updates.screeningAnswers;
      workspace.approval.auditTrail.push({
        action: 'answers_updated',
        timestamp: now,
        userId,
        details: 'Screening answers updated',
      });
    }

    if (updates.fieldMappings) {
      workspace.fieldMappings = updates.fieldMappings;
    }

    if (typeof updates.notes === 'string') {
      workspace.notes = updates.notes;
    }

    // Recalculate readiness
    workspace.readiness = readinessEngine.calculateReadiness({
      jobSnapshot: workspace.jobSnapshot,
      masterResumeId: workspace.masterResumeId,
      targetedResumeId: workspace.targetedResumeId,
      coverLetter: workspace.coverLetter,
      screeningAnswers: workspace.screeningAnswers,
      fieldMappings: workspace.fieldMappings,
      missingInformation: workspace.missingInformation,
      approval: workspace.approval,
    });

    workspace.updatedAt = now;

    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: id, user_id: userId },
      {
        $set: {
          cover_letter: workspace.coverLetter,
          screening_answers: workspace.screeningAnswers,
          field_mappings: workspace.fieldMappings,
          missing_information: workspace.missingInformation,
          readiness: workspace.readiness,
          approval: workspace.approval,
          notes: workspace.notes,
          updated_at: now,
          metadata: { ...(existing.metadata || {}), ...(updates.metadata || {}) },
        },
      },
    );

    return workspace;
  }

  /**
   * Generates or refreshes the targeted resume for this application.
   */
  async generateTailoredResume(
    userId: string,
    id: string,
    options?: { baseResumeId?: string },
  ): Promise<ApplicationWorkspace> {
    const db = await getDatabase();
    const existing = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: id,
      user_id: userId,
    });
    if (!existing) {
      throw new Error('Application workspace not found or access denied.');
    }

    const workspace = this.toWorkspace(existing);
    const jd = workspace.jobSnapshot.description;
    if (!jd || jd.length < 20) {
      throw new Error('A job description (at least 20 characters) is required to tailor a resume.');
    }

    const result = await targetedResumeService.generateTargetedResume(userId, {
      baseResumeId: options?.baseResumeId || workspace.masterResumeId || undefined,
      jobDescription: jd,
      targetRole: workspace.jobSnapshot.title,
      targetCompany: workspace.jobSnapshot.company,
      jobId: workspace.jobSnapshot.id,
    });

    const now = new Date().toISOString();
    workspace.targetedResumeId = result.targetedResume.id;
    workspace.targetedResumeSnapshot = {
      id: result.targetedResume.id,
      title: result.targetedResume.title,
      summary: result.targetedResume.content?.summary || '',
      skills: (result.targetedResume.content?.skills || []).map((s: any) => s.name),
      alignmentScore: result.alignmentScore,
      updatedAt: now,
    };

    workspace.approval.auditTrail.push({
      action: 'resume_updated',
      timestamp: now,
      userId,
      details: `Generated tailored resume snapshot: ${result.targetedResume.title} (${result.alignmentScore}% alignment)`,
    });

    // Recalculate readiness
    workspace.readiness = readinessEngine.calculateReadiness({
      jobSnapshot: workspace.jobSnapshot,
      masterResumeId: workspace.masterResumeId,
      targetedResumeId: workspace.targetedResumeId,
      coverLetter: workspace.coverLetter,
      screeningAnswers: workspace.screeningAnswers,
      fieldMappings: workspace.fieldMappings,
      missingInformation: workspace.missingInformation,
      approval: workspace.approval,
    });

    workspace.updatedAt = now;

    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: id, user_id: userId },
      {
        $set: {
          targeted_resume_id: workspace.targetedResumeId,
          targeted_resume_snapshot: workspace.targetedResumeSnapshot,
          readiness: workspace.readiness,
          approval: workspace.approval,
          updated_at: now,
        },
      },
    );

    return workspace;
  }

  /**
   * Generates or regenerates a tailored cover letter for this application.
   */
  async generateCoverLetter(
    userId: string,
    id: string,
    options?: {
      tone?: 'professional' | 'concise' | 'technical' | 'enthusiastic';
      customInstructions?: string;
    },
  ): Promise<ApplicationWorkspace> {
    const db = await getDatabase();
    const existing = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: id,
      user_id: userId,
    });
    if (!existing) {
      throw new Error('Application workspace not found or access denied.');
    }

    const workspace = this.toWorkspace(existing);
    const newCoverLetter = await coverLetterService.generateCoverLetter(userId, {
      jobTitle: workspace.jobSnapshot.title,
      companyName: workspace.jobSnapshot.company,
      jobDescription: workspace.jobSnapshot.description,
      tone: options?.tone || workspace.coverLetter.tone || 'professional',
      customInstructions: options?.customInstructions ?? workspace.coverLetter.customInstructions,
      existingData: workspace.coverLetter,
    });

    const now = new Date().toISOString();
    workspace.coverLetter = newCoverLetter;
    workspace.approval.auditTrail.push({
      action: 'cover_letter_updated',
      timestamp: now,
      userId,
      details: `Regenerated cover letter version ${newCoverLetter.version} with tone: ${newCoverLetter.tone}`,
    });

    // Recalculate readiness
    workspace.readiness = readinessEngine.calculateReadiness({
      jobSnapshot: workspace.jobSnapshot,
      masterResumeId: workspace.masterResumeId,
      targetedResumeId: workspace.targetedResumeId,
      coverLetter: workspace.coverLetter,
      screeningAnswers: workspace.screeningAnswers,
      fieldMappings: workspace.fieldMappings,
      missingInformation: workspace.missingInformation,
      approval: workspace.approval,
    });

    workspace.updatedAt = now;

    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: id, user_id: userId },
      {
        $set: {
          cover_letter: workspace.coverLetter,
          readiness: workspace.readiness,
          approval: workspace.approval,
          updated_at: now,
        },
      },
    );

    return workspace;
  }

  /**
   * Generates grounded answers for screening questions.
   */
  async generateScreeningAnswers(
    userId: string,
    id: string,
    questions?: string[],
  ): Promise<ApplicationWorkspace> {
    const db = await getDatabase();
    const existing = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: id,
      user_id: userId,
    });
    if (!existing) {
      throw new Error('Application workspace not found or access denied.');
    }

    const workspace = this.toWorkspace(existing);
    const [dbProfile, localProfile, resumes] = await Promise.all([
      candidateProfileService.get(userId).catch(() => null),
      localDataStore.getProfile(userId).catch(() => null),
      localDataStore.listResumes(userId).catch(() => []),
    ]);

    const resolvedProfile: any = dbProfile
      ? {
          fullName: dbProfile.full_name || '',
          email: dbProfile.email || '',
          phone: dbProfile.phone || '',
          location: dbProfile.location || (dbProfile.city ? `${dbProfile.city}, ${dbProfile.country || ''}` : ''),
          skills: dbProfile.skills || [],
          experienceYears: dbProfile.experience_years ?? null,
        }
      : localProfile;

    const targetQuestions = questions && questions.length > 0
      ? questions
      : workspace.screeningAnswers.map((s) => s.question);

    const updatedAnswers: ScreeningAnswerItem[] = targetQuestions.map((q) => {
      const grounded = generateGroundedAnswer(q, resolvedProfile, resumes);
      // Retain existing approval if question was already present and approved
      const existingItem = workspace.screeningAnswers.find((s) => s.question.toLowerCase() === q.toLowerCase());
      return {
        id: existingItem?.id || randomUUID(),
        question: q,
        category: grounded.category,
        answer: grounded.suggestedAnswer || existingItem?.answer || null,
        confidence: grounded.confidence,
        isGrounded: grounded.isGrounded,
        sourceField: grounded.sourceField,
        sourceEvidence: grounded.evidence,
        requiresUserReview: grounded.requiresUserReview,
        status: grounded.status,
        userApproved: existingItem ? existingItem.userApproved : false,
      };
    });

    const now = new Date().toISOString();
    workspace.screeningAnswers = updatedAnswers;
    workspace.approval.auditTrail.push({
      action: 'answers_updated',
      timestamp: now,
      userId,
      details: `Generated grounded screening answers for ${updatedAnswers.length} questions`,
    });

    // Recalculate readiness
    workspace.readiness = readinessEngine.calculateReadiness({
      jobSnapshot: workspace.jobSnapshot,
      masterResumeId: workspace.masterResumeId,
      targetedResumeId: workspace.targetedResumeId,
      coverLetter: workspace.coverLetter,
      screeningAnswers: workspace.screeningAnswers,
      fieldMappings: workspace.fieldMappings,
      missingInformation: workspace.missingInformation,
      approval: workspace.approval,
    });

    workspace.updatedAt = now;

    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: id, user_id: userId },
      {
        $set: {
          screening_answers: workspace.screeningAnswers,
          readiness: workspace.readiness,
          approval: workspace.approval,
          updated_at: now,
        },
      },
    );

    return workspace;
  }

  /**
   * Human Approval Gate: Explicit candidate approval with digital audit signature.
   */
  async approveApplication(
    userId: string,
    id: string,
    confirmation?: { signature?: string; ip?: string },
  ): Promise<ApplicationWorkspace> {
    const db = await getDatabase();
    const existing = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: id,
      user_id: userId,
    });
    if (!existing) {
      throw new Error('Application workspace not found or access denied.');
    }

    const workspace = this.toWorkspace(existing);
    const now = new Date().toISOString();

    // Generate cryptographic audit signature
    const coverLetterHash = createHash('sha256')
      .update(workspace.coverLetter?.content || '')
      .digest('hex')
      .slice(0, 16);

    const digitalSignature = confirmation?.signature?.trim() ||
      createHash('sha256')
        .update(`${userId}:${id}:${now}:${workspace.targetedResumeId || 'master'}:${coverLetterHash}`)
        .digest('hex');

    const approvedAnswersCount = workspace.screeningAnswers.filter((a) => a.userApproved).length;

    workspace.approval = {
      isApproved: true,
      approvedAt: now,
      approvedBy: userId,
      approvalSignature: digitalSignature,
      confirmationSummary: {
        company: workspace.jobSnapshot.company,
        title: workspace.jobSnapshot.title,
        url: workspace.jobSnapshot.url,
        resumeVersion: workspace.targetedResumeSnapshot?.title || 'Master Resume',
        coverLetterIncluded: Boolean(workspace.coverLetter?.content),
        answersApprovedCount: approvedAnswersCount,
      },
      auditTrail: [
        ...workspace.approval.auditTrail,
        {
          action: 'approved',
          timestamp: now,
          userId,
          details: `Candidate explicitly approved application with digital signature: ${digitalSignature.slice(0, 12)}...`,
          ip: confirmation?.ip,
        },
      ],
    };

    // Auto-transition to prepared if in discovered state
    if (workspace.status === 'discovered') {
      workspace.status = 'prepared';
    }

    // Recalculate readiness
    workspace.readiness = readinessEngine.calculateReadiness({
      jobSnapshot: workspace.jobSnapshot,
      masterResumeId: workspace.masterResumeId,
      targetedResumeId: workspace.targetedResumeId,
      coverLetter: workspace.coverLetter,
      screeningAnswers: workspace.screeningAnswers,
      fieldMappings: workspace.fieldMappings,
      missingInformation: workspace.missingInformation,
      approval: workspace.approval,
    });

    workspace.updatedAt = now;

    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: id, user_id: userId },
      {
        $set: {
          status: workspace.status,
          approval: workspace.approval,
          readiness: workspace.readiness,
          updated_at: now,
        },
      },
    );

    return workspace;
  }

  /**
   * Revokes candidate approval prior to submission.
   */
  async revokeApproval(userId: string, id: string, reason?: string): Promise<ApplicationWorkspace> {
    const db = await getDatabase();
    const existing = await db.collection<any>(APPLICATIONS_TABLE).findOne({
      _id: id,
      user_id: userId,
    });
    if (!existing) {
      throw new Error('Application workspace not found or access denied.');
    }

    const workspace = this.toWorkspace(existing);
    const now = new Date().toISOString();

    workspace.approval = {
      ...workspace.approval,
      isApproved: false,
      approvedAt: null,
      approvedBy: null,
      approvalSignature: null,
      confirmationSummary: null,
      auditTrail: [
        ...workspace.approval.auditTrail,
        {
          action: 'revoked',
          timestamp: now,
          userId,
          details: reason || 'Candidate revoked application approval',
        },
      ],
    };

    // Revert status to discovered if it was prepared
    if (workspace.status === 'prepared') {
      workspace.status = 'discovered';
    }

    // Recalculate readiness
    workspace.readiness = readinessEngine.calculateReadiness({
      jobSnapshot: workspace.jobSnapshot,
      masterResumeId: workspace.masterResumeId,
      targetedResumeId: workspace.targetedResumeId,
      coverLetter: workspace.coverLetter,
      screeningAnswers: workspace.screeningAnswers,
      fieldMappings: workspace.fieldMappings,
      missingInformation: workspace.missingInformation,
      approval: workspace.approval,
    });

    workspace.updatedAt = now;

    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: id, user_id: userId },
      {
        $set: {
          status: workspace.status,
          approval: workspace.approval,
          readiness: workspace.readiness,
          updated_at: now,
        },
      },
    );

    return workspace;
  }

  /**
   * Exports complete application package in JSON, Markdown, or Plain Text format.
   */
  async exportBundle(
    userId: string,
    id: string,
    format: 'json' | 'markdown' | 'text' = 'json',
  ): Promise<{ format: string; filename: string; content: string; bundle: ExportBundle }> {
    const workspace = await this.getWorkspace(userId, id);
    if (!workspace) {
      throw new Error('Application workspace not found or access denied.');
    }

    const profile = await candidateProfileService.get(userId).catch(() => null);

    const bundle: ExportBundle = {
      applicationId: workspace.id,
      exportedAt: new Date().toISOString(),
      candidate: {
        id: userId,
        name: profile?.full_name || 'Candidate',
        email: profile?.email || '',
        phone: profile?.phone || '',
        location: profile?.location || (profile?.city ? `${profile.city}, ${profile.country || ''}` : ''),
      },
      job: workspace.jobSnapshot,
      readinessScore: workspace.readiness.score,
      approval: {
        isApproved: workspace.approval.isApproved,
        approvedAt: workspace.approval.approvedAt,
        approvedBy: workspace.approval.approvedBy,
        signature: workspace.approval.approvalSignature,
      },
      tailoredResume: workspace.targetedResumeSnapshot
        ? {
            id: workspace.targetedResumeSnapshot.id,
            summary: workspace.targetedResumeSnapshot.summary,
            skills: workspace.targetedResumeSnapshot.skills,
            alignmentScore: workspace.targetedResumeSnapshot.alignmentScore,
          }
        : null,
      coverLetter: {
        version: workspace.coverLetter.version,
        tone: workspace.coverLetter.tone,
        content: workspace.coverLetter.content,
      },
      screeningAnswers: workspace.screeningAnswers.map((a) => ({
        question: a.question,
        answer: a.answer,
        confidence: a.confidence,
        isGrounded: a.isGrounded,
        approved: a.userApproved,
      })),
      fieldMappings: workspace.fieldMappings.map((f) => ({
        field: f.fieldName,
        value: f.value,
        approved: f.approved,
      })),
    };

    // Log export audit trail
    const db = await getDatabase();
    const updateOp: any = {
      $push: {
        'approval.auditTrail': {
          action: 'exported',
          timestamp: new Date().toISOString(),
          userId,
          details: `Exported bundle in ${format} format`,
        },
      },
    };
    await db.collection<any>(APPLICATIONS_TABLE).updateOne(
      { _id: id, user_id: userId },
      updateOp,
    );

    const safeCompany = workspace.jobSnapshot.company.replace(/[^a-zA-Z0-9]/g, '_');
    const safeTitle = workspace.jobSnapshot.title.replace(/[^a-zA-Z0-9]/g, '_');

    if (format === 'json') {
      return {
        format: 'json',
        filename: `Application_${safeCompany}_${safeTitle}.json`,
        content: JSON.stringify(bundle, null, 2),
        bundle,
      };
    }

    if (format === 'markdown') {
      const md = [
        `# Application Bundle: ${workspace.jobSnapshot.title} at ${workspace.jobSnapshot.company}`,
        `**Exported:** ${bundle.exportedAt}`,
        `**Application Status:** ${workspace.status} | **Readiness Score:** ${bundle.readinessScore}%`,
        `**Human Approval:** ${bundle.approval.isApproved ? `Approved on ${bundle.approval.approvedAt} (Sig: ${bundle.approval.signature})` : 'NOT APPROVED'}`,
        '',
        '---',
        '## Candidate Information',
        `- **Name:** ${bundle.candidate.name}`,
        `- **Email:** ${bundle.candidate.email}`,
        `- **Phone:** ${bundle.candidate.phone}`,
        `- **Location:** ${bundle.candidate.location}`,
        '',
        '---',
        '## Job Information',
        `- **Title:** ${bundle.job.title}`,
        `- **Company:** ${bundle.job.company}`,
        `- **Location:** ${bundle.job.location}`,
        `- **URL:** ${bundle.job.url}`,
        `- **Required Skills:** ${bundle.job.requiredSkills.join(', ') || 'N/A'}`,
        '',
        '---',
        '## Cover Letter',
        `*(Tone: ${bundle.coverLetter.tone}, Version: ${bundle.coverLetter.version})*`,
        '',
        bundle.coverLetter.content,
        '',
        '---',
        '## Screening Questions & Grounded Answers',
        ...bundle.screeningAnswers.map(
          (q, i) => `${i + 1}. **Question:** ${q.question}\n   - **Answer:** ${q.answer || '*(Pending manual input)*'}\n   - **Confidence:** ${(q.confidence * 100).toFixed(0)}% | **Grounded:** ${q.isGrounded ? 'Yes' : 'No'} | **Approved:** ${q.approved ? 'Yes' : 'No'}\n`,
        ),
        '---',
        '## Form Field Mappings',
        ...bundle.fieldMappings.map((f) => `- **${f.field}:** ${f.value || '*(Not set)*'} (${f.approved ? 'Approved' : 'Pending Approval'})`),
      ].join('\n');

      return {
        format: 'markdown',
        filename: `Application_${safeCompany}_${safeTitle}.md`,
        content: md,
        bundle,
      };
    }

    // Plain text
    const text = [
      `======================================================================`,
      `APPLICATION PACKAGE: ${workspace.jobSnapshot.title.toUpperCase()} AT ${workspace.jobSnapshot.company.toUpperCase()}`,
      `Status: ${workspace.status} | Readiness: ${bundle.readinessScore}%`,
      `Approved: ${bundle.approval.isApproved ? `YES (${bundle.approval.approvedAt})` : 'NO'}`,
      `======================================================================`,
      ``,
      `CANDIDATE: ${bundle.candidate.name} <${bundle.candidate.email}> | ${bundle.candidate.phone}`,
      `JOB URL: ${bundle.job.url}`,
      ``,
      `----------------------------------------------------------------------`,
      `COVER LETTER`,
      `----------------------------------------------------------------------`,
      bundle.coverLetter.content,
      ``,
      `----------------------------------------------------------------------`,
      `SCREENING QUESTIONS & ANSWERS`,
      `----------------------------------------------------------------------`,
      ...bundle.screeningAnswers.map(
        (q, i) => `${i + 1}. Q: ${q.question}\n   A: ${q.answer || 'N/A'}\n   [Confidence: ${(q.confidence * 100).toFixed(0)}%, Approved: ${q.approved ? 'Yes' : 'No'}]\n`,
      ),
      `----------------------------------------------------------------------`,
      `FIELD MAPPINGS`,
      `----------------------------------------------------------------------`,
      ...bundle.fieldMappings.map((f) => `${f.field}: ${f.value} [${f.approved ? 'Approved' : 'Pending'}]`),
    ].join('\n');

    return {
      format: 'text',
      filename: `Application_${safeCompany}_${safeTitle}.txt`,
      content: text,
      bundle,
    };
  }
}

export const applicationWorkspaceService = new ApplicationWorkspaceService();
