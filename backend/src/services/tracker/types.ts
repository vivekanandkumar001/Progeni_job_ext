export type ApplicationLifecycleStatus =
  | 'discovered'
  | 'preparing'
  | 'ready_for_review'
  | 'approved'
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'rejected'
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_declined'
  | 'withdrawn'
  | 'closed'
  // Legacy aliases for backward compatibility
  | 'prepared'
  | 'verified'
  | 'failed'
  | 'interview';

export type SubmissionMethod = 'manual' | 'extension_assisted' | 'direct_api' | 'portal';
export type EvidenceVerificationStatus = 'verified' | 'candidate_reported' | 'unverified';

export interface ConfirmationEvidence {
  type: 'email_snippet' | 'screenshot_url' | 'portal_confirmation_url' | 'confirmation_text';
  value: string;
  submittedAt: string;
}

export interface SubmissionEvidenceRecord {
  candidateId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  destination: string;
  submittedAt: string;
  submissionMethod: SubmissionMethod;
  confirmationReference?: string;
  confirmationEvidence?: ConfirmationEvidence;
  verificationStatus: EvidenceVerificationStatus;
  notes?: string;
  auditHistory: Array<{
    action: string;
    timestamp: string;
    details?: string;
    performedBy: string;
  }>;
}

export interface TimelineEvent {
  id: string;
  applicationId: string;
  timestamp: string;
  eventType:
    | 'created'
    | 'resume_tailored'
    | 'cover_letter_generated'
    | 'approved'
    | 'submitted'
    | 'status_changed'
    | 'interview_scheduled'
    | 'interview_completed'
    | 'follow_up_logged'
    | 'note_added'
    | 'revoked';
  title: string;
  description: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

export type InterviewStage =
  | 'hr_screening'
  | 'technical_interview'
  | 'coding_assessment'
  | 'managerial_interview'
  | 'final_interview'
  | 'other';

export type InterviewMode = 'video' | 'phone' | 'in_person' | 'take_home';
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';

export interface InterviewerDetails {
  name?: string;
  title?: string;
  email?: string;
  linkedin?: string;
  notes?: string;
}

export interface InterviewFeedback {
  rating?: number; // 1-5
  strengths?: string[];
  areasToImprove?: string[];
  questionsAsked?: string[];
  overallImpression?: string;
}

export interface InterviewRecord {
  id: string; // UUID
  applicationId: string;
  candidateId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  stage: InterviewStage;
  scheduledAt: string; // ISO 8601
  timezone: string;
  durationMinutes: number;
  interviewMode: InterviewMode;
  meetingLink?: string;
  location?: string;
  interviewerDetails?: InterviewerDetails;
  preparationNotes?: string;
  status: InterviewStatus;
  feedback?: InterviewFeedback;
  nextSteps?: string;
  createdAt: string;
  updatedAt: string;
}

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

export interface FollowUpRecord {
  id: string; // UUID
  applicationId: string;
  candidateId: string;
  company: string;
  jobTitle: string;
  followUpDate: string; // YYYY-MM-DD
  status: FollowUpStatus;
  isOverdue: boolean; // Dynamically computed
  reminderSettings: {
    enabled: boolean;
    reminderDate?: string;
    notificationChannel: 'in_app' | 'email';
  };
  contactDetails?: {
    name?: string;
    email?: string;
    role?: string;
  };
  nextAction: string;
  notes?: string;
  history: Array<{
    action: string;
    performedAt: string;
    notes?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalytics {
  candidateId: string;
  calculatedAt: string;
  totalApplications: number;
  verifiedSubmissions: number;
  candidateReportedSubmissions: number;
  unverifiedSubmissions: number;
  pendingApplications: number;
  responses: number;
  interviewsScheduled: number;
  rejections: number;
  offersReceived: number;
  offersAccepted: number;
  offersDeclined: number;
  withdrawn: number;
  closed: number;
  responseRate: number; // percentage (0-100)
  interviewConversionRate: number; // percentage (0-100)
  offerConversionRate: number; // percentage (0-100)
  stageBreakdown: Record<string, number>;
  denominators: {
    responseRateDenominator: string;
    interviewRateDenominator: string;
    offerRateDenominator: string;
  };
  disclaimer: string;
}

export type NotificationType =
  | 'upcoming_interview'
  | 'follow_up_reminder'
  | 'status_change'
  | 'offer_deadline'
  | 'system';

export interface NotificationRecord {
  id: string;
  candidateId: string;
  type: NotificationType;
  title: string;
  message: string;
  applicationId?: string;
  entityId?: string;
  notificationKey: string; // Idempotency key
  read: boolean;
  createdAt: string;
}

