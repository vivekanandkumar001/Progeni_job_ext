export type ApplicationStatus =
  | 'discovered'
  | 'prepared'
  | 'submitted'
  | 'verified'
  | 'failed'
  | 'interview'
  | 'rejected'
  | 'withdrawn';

export interface JobSnapshot {
  id: string;
  title: string;
  company: string;
  location: string;
  workplaceMode?: 'remote' | 'hybrid' | 'office' | string;
  url: string;
  platform?: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  description?: string;
  salary?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
}

export interface MatchSnapshot {
  score: number;
  eligible: boolean;
  status: 'eligible' | 'ineligible' | 'insufficient_information';
  reasons: string[];
  missingEvidence?: string[];
  dimensionScores?: Record<string, number>;
}

export interface CoverLetterVersion {
  version: number;
  tone: 'professional' | 'concise' | 'technical' | 'enthusiastic';
  content: string;
  customInstructions?: string;
  createdAt: string;
}

export interface CoverLetterData {
  id: string;
  version: number;
  tone: 'professional' | 'concise' | 'technical' | 'enthusiastic';
  content: string;
  customInstructions?: string;
  versions: CoverLetterVersion[];
  updatedAt: string;
}

export interface ScreeningAnswerItem {
  id: string;
  question: string;
  category: string;
  answer: string | null;
  confidence: number; // 0.0 - 1.0
  isGrounded: boolean;
  sourceField?: string;
  sourceEvidence?: string;
  requiresUserReview: boolean;
  status: 'ready' | 'needs_review' | 'manual_input_required' | 'unsupported';
  userApproved: boolean;
  notes?: string;
}

export interface FieldMappingItem {
  id: string;
  fieldName: string;
  label: string;
  fieldType: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'file';
  value: string;
  source: string;
  selector?: string;
  required: boolean;
  approved: boolean;
}

export interface ReadinessCategoryScore {
  score: number;
  max: number;
  ready: boolean;
  reason?: string;
}

export interface ReadinessBreakdown {
  resume: ReadinessCategoryScore; // max 20
  coverLetter: ReadinessCategoryScore; // max 15
  screeningQuestions: ReadinessCategoryScore; // max 25
  formFields: ReadinessCategoryScore; // max 20
  missingInfo: ReadinessCategoryScore; // max 10
  humanApproval: ReadinessCategoryScore; // max 10
}

export interface ReadinessResult {
  score: number; // 0 - 100
  breakdown: ReadinessBreakdown;
  checklist: Array<{
    category: string;
    item: string;
    ready: boolean;
    points: number;
    maxPoints: number;
    actionRequired?: string;
  }>;
  isReadyForSubmission: boolean;
  summary: string;
}

export interface AuditTrailEntry {
  action: 'created' | 'resume_updated' | 'cover_letter_updated' | 'answers_updated' | 'approved' | 'revoked' | 'exported' | 'status_changed';
  timestamp: string;
  userId: string;
  details?: string;
  ip?: string;
}

export interface ApplicationApproval {
  isApproved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalSignature: string | null;
  confirmationSummary: {
    company: string;
    title: string;
    url: string;
    resumeVersion: string;
    coverLetterIncluded: boolean;
    answersApprovedCount: number;
  } | null;
  auditTrail: AuditTrailEntry[];
}

export interface ApplicationWorkspace {
  id: string;
  candidateId: string;
  jobId: string;
  status: ApplicationStatus;
  idempotencyKey: string;
  jobSnapshot: JobSnapshot;
  matchSnapshot: MatchSnapshot;
  masterResumeId: string | null;
  targetedResumeId: string | null;
  targetedResumeSnapshot?: {
    id: string;
    title: string;
    summary: string;
    skills: string[];
    alignmentScore: number;
    updatedAt: string;
  } | null;
  coverLetter: CoverLetterData;
  screeningAnswers: ScreeningAnswerItem[];
  fieldMappings: FieldMappingItem[];
  missingInformation: string[];
  readiness: ReadinessResult;
  approval: ApplicationApproval;
  notes: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExportBundle {
  applicationId: string;
  exportedAt: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string;
    location: string;
  };
  job: JobSnapshot;
  readinessScore: number;
  approval: {
    isApproved: boolean;
    approvedAt: string | null;
    approvedBy: string | null;
    signature: string | null;
  };
  tailoredResume: {
    id: string | null;
    summary: string;
    skills: string[];
    alignmentScore: number;
  } | null;
  coverLetter: {
    version: number;
    tone: string;
    content: string;
  };
  screeningAnswers: Array<{
    question: string;
    answer: string | null;
    confidence: number;
    isGrounded: boolean;
    approved: boolean;
  }>;
  fieldMappings: Array<{
    field: string;
    value: string;
    approved: boolean;
  }>;
}

