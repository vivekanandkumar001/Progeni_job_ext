export interface ProgeniContextPayload {
  candidateId: string;
  candidateEmail: string;
  candidateName: string;
  applicationId: string;
  interviewId?: string;
  jobId?: string;
  companyName: string;
  jobRole: string;
  jobDescription: string;
  requiredSkills: string[];
  resumeText?: string;
  interviewStage: string;
  interviewMode: string;
}

export interface ProgeniLaunchTicket {
  ticketId: string;
  candidateId: string;
  applicationId: string;
  interviewId?: string;
  token: string;
  expiresAt: string; // ISO 8601
  launchUrl: string;
}

export interface CompetencyPillars {
  algorithmicProblemSolving?: number;
  systemArchitecture?: number;
  codeQualityAndSyntax?: number;
  communicationAndClarity?: number;
}

export interface ProctoringSummary {
  totalEvents: number;
  warningCount: number;
  flagged: boolean;
  overallIntegrityScore: number;
  gazeConsistencyPercentage?: number;
  tabSwitchCount?: number;
}

export interface TurnReviewItem {
  turnIndex: number;
  stage: string;
  questionAsked: string;
  candidateAnswerSummary: string;
  scores: {
    relevance?: number;
    depth?: number;
    correctness?: number;
  };
  keyConceptsCovered: string[];
  missingConcepts: string[];
  isWeakAnswer: boolean;
  evaluatorFeedback?: string;
}

export interface ProgeniSimulationRecord {
  id: string; // UUID
  sessionId: string;
  candidateId: string;
  applicationId: string;
  interviewId?: string;
  companyName: string;
  jobRole: string;
  status: 'launched' | 'in_progress' | 'completed' | 'abandoned';
  launchUrl: string;
  overallScore?: number;
  hiringRecommendation?: string;
  percentileRank?: number;
  competencyPillars?: CompetencyPillars;
  executiveSummary?: string;
  verifiedStrengths?: string[];
  targetedGrowthAreas?: string[];
  proctoringSummary?: ProctoringSummary;
  turnReviews?: TurnReviewItem[];
  isAiSimulation: true; // Axiom: Always true to distinguish from real employer interviews
  launchedAt: string;
  completedAt?: string;
  updatedAt: string;
}

