import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const hasAnySupabaseConfiguration = Boolean(supabaseUrl || supabaseAnonKey);
const hasSupabaseConfiguration = Boolean(supabaseUrl && supabaseAnonKey);
export const usesCloudAuthentication =
  hasAnySupabaseConfiguration || process.env.NODE_ENV === 'production';
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || '';
const apiRoute = usesCloudAuthentication ? 'workspace' : 'local';
const API_BASE_URL = configuredApiUrl
  ? /\/api\/v1\/(local|workspace)$/.test(configuredApiUrl)
    ? configuredApiUrl
    : configuredApiUrl.endsWith('/api/v1')
      ? `${configuredApiUrl}/${apiRoute}`
      : `${configuredApiUrl}/api/v1/${apiRoute}`
  : usesCloudAuthentication ? '/api/v1/workspace' : 'http://127.0.0.1:5000/api/v1/local';
const TOKEN_KEY = 'progeni.localApiToken';
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!usesCloudAuthentication) return null;
  if (!hasSupabaseConfiguration) {
    throw new Error('Configure both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  supabaseClient ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

export interface CandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  targetRole: string;
  location: string;
  skills: string[];
  experienceYears: number | null;
  updatedAt?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  platform: string;
  requiredSkills: string[];
  experienceMin: number | null;
}

export interface Match {
  id: string;
  job: Job;
  score: number;
  factors: Record<string, number>;
  explanation: string[];
  missingEvidence: string[];
  eligible: boolean;
  blockers: string[];
  unknowns: string[];
  evidence: string[];
  createdAt: string;
}

export type ApplicationStatus =
  | 'discovered'
  | 'prepared'
  | 'submitted'
  | 'interview'
  | 'rejected'
  | 'withdrawn';

export interface TrackedApplication {
  id: string;
  job: Job;
  status: ApplicationStatus;
  notes: string;
  updatedAt: string;
}

export interface ResumeSkillEvidence {
  skill: string;
  evidence: string;
}

export interface ResumeAnalysis {
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt';
  status: 'ready' | 'needs_review' | 'ocr_required';
  detected: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    experienceYears: number | null;
    experienceEvidence: string | null;
  };
  skills: ResumeSkillEvidence[];
  warnings: string[];
}

export interface ResumeRecord {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt';
  skills: ResumeSkillEvidence[];
  experienceYears: number | null;
  experienceEvidence: string | null;
  createdAt: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  error?: string;
  data?: T;
  [key: string]: unknown;
}

async function getToken(): Promise<string> {
  if (usesCloudAuthentication) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(`Could not restore your sign-in: ${error.message}`);
    if (!data.session) throw new Error('Sign in to your Progeni account to continue.');
    return data.session.access_token;
  }

  const cached = window.localStorage.getItem(TOKEN_KEY);
  if (cached) return cached;

  const response = await fetch(`${API_BASE_URL}/session`, { method: 'POST' });
  const result = await response.json() as ApiEnvelope<never> & { token?: string };
  if (!response.ok || !result.token) {
    throw new Error(result.error || 'Could not connect to the local Progeni backend.');
  }
  window.localStorage.setItem(TOKEN_KEY, result.token);
  return result.token;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  const rootApiUrl = API_BASE_URL.replace(/\/(local|workspace)$/, '');
  const url = path.startsWith('/auth') || path.startsWith('/candidate') || path.startsWith('/resumes') || path.startsWith('/resume-studio') || path.startsWith('/jobs') || path.startsWith('/matches') || path.startsWith('/applications') || path.startsWith('/tracker') || path.startsWith('/interviews') || path.startsWith('/follow-ups') || path.startsWith('/analytics') || path.startsWith('/notifications') || path.startsWith('/integration') || path.startsWith('/billing')
    ? `${rootApiUrl}${path}`
    : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...init,
    headers,
  });
  let result: ApiEnvelope<T>;
  try {
    result = await response.json() as ApiEnvelope<T>;
  } catch {
    throw new Error(`The Progeni API returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    if (response.status === 401) window.localStorage.removeItem(TOKEN_KEY);
    throw new Error(result.error || `Local API request failed (${response.status}).`);
  }
  return result;
}

export async function getConsent(): Promise<boolean> {
  const result = await request<never>('/consent');
  return result.accepted === true;
}

export async function acceptConsent(): Promise<void> {
  await request<never>('/consent', {
    method: 'POST',
    body: JSON.stringify({ accepted: true }),
  });
}

export async function getProfile(): Promise<CandidateProfile | null> {
  const result = await request<CandidateProfile | null>('/profile');
  return (result.profile as CandidateProfile | null) || null;
}

export async function saveProfile(profile: CandidateProfile): Promise<CandidateProfile> {
  const result = await request<CandidateProfile>('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
  if (!result.profile) throw new Error('The local API did not return the saved profile.');
  return result.profile as CandidateProfile;
}

export async function getApplications(): Promise<TrackedApplication[]> {
  const result = await request<TrackedApplication[]>('/applications');
  return (result.applications as TrackedApplication[]) || [];
}

export async function getMatches(): Promise<Match[]> {
  const result = await request<Match[]>('/matches');
  return (result.matches as Match[]) || [];
}

export async function analyzeJob(job: Omit<Job, 'id'> & { id?: string }): Promise<Match> {
  const result = await request<Match>('/matches/analyze', {
    method: 'POST',
    body: JSON.stringify(job),
  });
  if (!result.match) throw new Error('The local API did not return a job match.');
  return result.match as Match;
}

export async function createApplication(jobId: string): Promise<TrackedApplication> {
  const result = await request<TrackedApplication>('/applications', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
  });
  if (!result.application) throw new Error('The local API did not return the tracked job.');
  return result.application as TrackedApplication;
}

export async function updateApplication(
  id: string,
  status: ApplicationStatus,
): Promise<TrackedApplication> {
  const result = await request<TrackedApplication>(`/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!result.application) throw new Error('The local API did not return the updated application.');
  return result.application as TrackedApplication;
}

export async function clearWorkspace(): Promise<void> {
  await request<never>('/workspace', { method: 'DELETE' });
}

export async function analyzeResume(
  fileName: string,
  fileType: ResumeAnalysis['fileType'],
  contentBase64: string,
): Promise<ResumeAnalysis> {
  const result = await request<ResumeAnalysis>('/resumes/parse', {
    method: 'POST',
    body: JSON.stringify({ fileName, fileType, contentBase64 }),
  });
  if (!result.analysis) throw new Error('The local API did not return resume analysis.');
  return result.analysis as ResumeAnalysis;
}

export async function getResumes(): Promise<ResumeRecord[]> {
  const result = await request<ResumeRecord[]>('/resumes');
  return (result.resumes as ResumeRecord[]) || [];
}

export async function saveResume(
  resume: Omit<ResumeRecord, 'id' | 'createdAt'>,
  profile: CandidateProfile,
): Promise<ResumeRecord> {
  const result = await request<ResumeRecord>('/resumes', {
    method: 'POST',
    body: JSON.stringify({ ...resume, profile }),
  });
  if (!result.resume) throw new Error('The local API did not return the saved resume details.');
  return result.resume as ResumeRecord;
}

export async function deleteResume(id: string): Promise<void> {
  await request<never>(`/resumes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Cloud sign-in is unavailable in local development.');
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signInWithGoogle(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Google sign-in is unavailable in local development.');
  
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback/signup`,
      skipBrowserRedirect: true,
    },
  });
  
  if (error) throw new Error(error.message);
  if (!data?.url) {
    throw new Error('Google authentication is not configured yet on this Supabase project. Please sign in with email and password.');
  }

  // Pre-flight check the OAuth authorization URL to verify the provider is enabled
  try {
    const probe = await fetch(data.url, { method: 'GET', mode: 'cors' });
    if (!probe.ok) {
      const errorJson = await probe.json().catch(() => null);
      if (errorJson?.error_code === 'validation_failed' || errorJson?.msg?.includes('provider is not enabled')) {
        throw new Error('Google Sign-in is not enabled in your Supabase project (Authentication → Providers → Google). Please use Email & Password below.');
      }
    }
  } catch (probeError) {
    if (probeError instanceof Error && probeError.message.includes('Google Sign-in is not enabled')) {
      throw probeError;
    }
    // Network or CORS probe restriction — proceed to URL
  }

  window.location.href = data.url;
}

export async function signUp(email: string, password: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Cloud sign-up is unavailable in local development.');
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback/signup`,
    },
  });
  if (error) throw new Error(error.message);
  return Boolean(data.session);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Password recovery is unavailable in local development.');
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback/recovery`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Password changes are unavailable in local development.');
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  if (!usesCloudAuthentication) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase authentication is not configured.');
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getMe(): Promise<{ user: any; activeSessionsCount: number }> {
  const result = await request<never>('/auth/me');
  return result as any;
}

export async function logoutAllDevices(): Promise<void> {
  await request<never>('/auth/logout-all', { method: 'POST' });
  if (usesCloudAuthentication) {
    const client = getSupabaseClient();
    await client?.auth.signOut({ scope: 'global' });
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export async function createExtensionPairingCode(): Promise<{ pairingCode: string; expiresInSeconds: number; instructions: string }> {
  const result = await request<never>('/auth/extension/pair', {
    method: 'POST',
  });
  return result as any;
}

export async function deleteAccount(): Promise<void> {
  await request<never>('/auth/account', { method: 'DELETE' });
  if (usesCloudAuthentication) {
    const client = getSupabaseClient();
    await client?.auth.signOut();
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export async function getSessions(): Promise<any[]> {
  const result = await request<never>('/auth/sessions');
  return (result as any).sessions || [];
}

export async function revokeSession(sessionId: string): Promise<void> {
  await request<never>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export async function getMfaStatus(): Promise<{ mfaEnabled: boolean; aal: string; requiresMfa: boolean }> {
  const result = await request<never>('/auth/mfa/status');
  return result as any;
}

export async function enableMfa(): Promise<{ ok: boolean; mfaEnabled: boolean }> {
  const result = await request<never>('/auth/mfa/enable', { method: 'POST' });
  return result as any;
}

export async function disableMfa(): Promise<{ ok: boolean; mfaEnabled: boolean }> {
  const result = await request<never>('/auth/mfa/disable', { method: 'POST' });
  return result as any;
}

export async function syncUserSession(email: string, mfaEnabled?: boolean): Promise<{ ok: boolean; user: any }> {
  const result = await request<never>('/auth/sync', {
    method: 'POST',
    body: JSON.stringify({ email, mfaEnabled }),
  });
  return result as any;
}

// --- Phase 2: Candidate Onboarding & Profile Management ---

export interface CandidateEducation {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
}

export interface CandidateWorkExperience {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  highlights?: string[];
}

export interface CandidateProject {
  name: string;
  description?: string;
  url?: string;
  technologies?: string[];
}

export interface CandidateCertification {
  name: string;
  issuer?: string;
  issueDate?: string;
}

export interface CandidateProfileExtended {
  id?: string;
  user_id?: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  target_role: string | null;
  experience_level: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  skills: string[] | null;
  experience_years: number | null;
  education?: CandidateEducation[] | null;
  work_experience?: CandidateWorkExperience[] | null;
  projects?: CandidateProject[] | null;
  certifications?: CandidateCertification[] | null;
  resume_completeness?: number;
}

export interface CandidatePreferences {
  desired_roles: string[];
  preferred_locations: string[];
  workplace_type: 'remote' | 'hybrid' | 'office' | 'any';
  expected_salary: {
    currency: string;
    min: number | null;
    max: number | null;
    period: 'yearly' | 'monthly';
  };
  experience_level: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  joining_availability: 'immediate' | '15_days' | '30_days' | '60_days' | '90_days';
  employment_type: 'full-time' | 'part-time' | 'contract' | 'internship';
}

export interface OnboardingConsentRecord {
  accepted: boolean;
  accepted_at: string | null;
  version: string;
  revoked_at?: string | null;
}

export interface CandidateOnboardingState {
  id: string;
  user_id: string;
  current_step: number;
  completed_steps: number[];
  status: 'not_started' | 'in_progress' | 'completed';
  completed_at: string | null;
  consents: {
    data_processing: OnboardingConsentRecord;
    job_application_assistance: OnboardingConsentRecord;
  };
}

export interface OnboardingStatusResponse {
  ok: boolean;
  onboarding: CandidateOnboardingState;
  completeness: {
    score: number;
    completedFields: string[];
    missingFields: string[];
  };
  extensionConnected: boolean;
  activeResumeCount: number;
}

export async function getCandidateProfileExtended(): Promise<{
  profile: CandidateProfileExtended | null;
  completeness: { score: number; completedFields: string[]; missingFields: string[] };
}> {
  const result = await request<never>('/candidate/profile');
  return result as any;
}

export async function updateCandidateProfileExtended(
  data: Partial<CandidateProfileExtended>,
): Promise<{
  profile: CandidateProfileExtended;
  completeness: { score: number; completedFields: string[]; missingFields: string[] };
}> {
  const result = await request<never>('/candidate/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result as any;
}

export async function getCandidatePreferences(): Promise<CandidatePreferences | null> {
  const result = await request<never>('/candidate/preferences');
  return (result as any).preferences || null;
}

export async function updateCandidatePreferences(
  data: Partial<CandidatePreferences>,
): Promise<CandidatePreferences> {
  const result = await request<never>('/candidate/preferences', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return (result as any).preferences;
}

export async function uploadCandidateResume(
  fileName: string,
  fileType: 'pdf' | 'docx' | 'txt',
  contentBase64: string,
  title?: string,
): Promise<{ resume: any; analysis: ResumeAnalysis }> {
  const result = await request<never>('/candidate/resume', {
    method: 'POST',
    body: JSON.stringify({ fileName, fileType, contentBase64, title }),
  });
  return result as any;
}

export async function parseCandidateResumePreview(
  fileName: string,
  fileType: 'pdf' | 'docx' | 'txt',
  contentBase64: string,
): Promise<{ analysis: ResumeAnalysis }> {
  const result = await request<never>('/candidate/resume/parse', {
    method: 'POST',
    body: JSON.stringify({ fileName, fileType, contentBase64 }),
  });
  return result as any;
}

export async function listCandidateResumes(): Promise<any[]> {
  const result = await request<never>('/candidate/resumes');
  return (result as any).resumes || [];
}

export async function deleteCandidateResume(id: string): Promise<void> {
  await request<never>(`/candidate/resumes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getCandidateOnboarding(): Promise<OnboardingStatusResponse> {
  const result = await request<never>('/candidate/onboarding');
  return result as any;
}

export async function updateCandidateOnboarding(updates: {
  step?: number;
  completeStep?: number;
  status?: 'not_started' | 'in_progress' | 'completed';
  dataProcessingConsent?: boolean;
  jobAssistanceConsent?: boolean;
}): Promise<OnboardingStatusResponse> {
  const result = await request<never>('/candidate/onboarding', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return result as any;
}

// ==========================================
// Phase 3: Resume Intelligence & Studio APIs
// ==========================================

export interface ResumeStudioPersonalInfo {
  full_name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  target_role?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  website_url?: string | null;
}

export interface ResumeStudioWorkExperience {
  id?: string;
  company: string;
  role: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  current?: boolean;
  highlights: string[];
  technologies?: string[];
  relevance_score?: number;
}

export interface ResumeStudioEducation {
  id?: string;
  institution: string;
  degree: string;
  field_of_study?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  grade?: string | null;
}

export interface ResumeStudioSkill {
  name: string;
  category?: string;
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  is_verified?: boolean;
}

export interface ResumeStudioProject {
  id?: string;
  name: string;
  description?: string | null;
  url?: string | null;
  github_url?: string | null;
  technologies: string[];
  highlights?: string[];
}

export interface ResumeStudioCertification {
  id?: string;
  name: string;
  issuer: string;
  issue_date?: string | null;
  expiration_date?: string | null;
  credential_id?: string | null;
  credential_url?: string | null;
}

export interface ResumeStudioAchievement {
  id?: string;
  title: string;
  description: string;
  date?: string | null;
}

export interface ResumeStudioLanguage {
  language: string;
  proficiency: 'native' | 'fluent' | 'professional' | 'conversational' | 'basic';
}

export interface ResumeStudioContent {
  personal_info: ResumeStudioPersonalInfo;
  summary?: string | null;
  work_experience: ResumeStudioWorkExperience[];
  education: ResumeStudioEducation[];
  skills: ResumeStudioSkill[];
  projects: ResumeStudioProject[];
  certifications: ResumeStudioCertification[];
  achievements: ResumeStudioAchievement[];
  languages: ResumeStudioLanguage[];
}

export interface ResumeVersionSnapshot {
  version: number;
  updated_at: string;
  change_summary: string;
  snapshot_content: ResumeStudioContent;
}

export interface ResumeStudioData {
  id: string;
  user_id: string;
  title: string;
  is_master: boolean;
  status: 'draft' | 'published' | 'archived';
  version: number;
  template: 'classic' | 'modern' | 'technical' | 'executive';
  target_job_title?: string | null;
  target_company?: string | null;
  job_id?: string | null;
  section_order: string[];
  content: ResumeStudioContent;
  version_history: ResumeVersionSnapshot[];
  created_at: string;
  updated_at: string;
}

export interface ATSScoreCategory {
  name: string;
  maxScore: number;
  earnedScore: number;
  status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  feedback: string[];
}

export interface ATSDiagnosticResult {
  overallScore: number;
  rating: 'Exceptional' | 'Competitive' | 'Needs Optimization' | 'Critical Gaps';
  disclaimer: string;
  categories: {
    contactInfo: ATSScoreCategory;
    sectionHeadings: ATSScoreCategory;
    quantifiableImpact: ATSScoreCategory;
    actionPhrasing: ATSScoreCategory;
    cleanFormatting: ATSScoreCategory;
  };
  detectedSections: string[];
  missingRecommendedSections: string[];
  metricsFound: string[];
  actionVerbsFound: string[];
  readability: {
    totalWords: number;
    bulletCount: number;
    avgBulletLengthChars: number;
    hardToReadBulletsCount: number;
  };
  recommendations: string[];
}

export interface JDKeywordMatch {
  keyword: string;
  category: 'skill' | 'qualification' | 'experience' | 'domain';
  foundInResume: boolean;
  frequencyInJD: number;
}

export interface JDComparisonResult {
  matchPercentage: number;
  matchedCount: number;
  totalRequiredKeywords: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  detailedKeywords: JDKeywordMatch[];
  keywordDensityWarning?: string | null;
  recommendations: string[];
}

export interface ResumeClaim {
  id: string;
  user_id: string;
  resume_id?: string | null;
  category: 'skill' | 'experience_years' | 'employment_history' | 'education' | 'certification' | 'project' | 'measurable_achievement';
  claim_text: string;
  supporting_source?: {
    type: 'uploaded_document' | 'github_repo' | 'credential_url' | 'profile_entry' | 'manual_claim';
    ref: string;
    snippet?: string | null;
  } | null;
  verification_status: 'verified_from_source' | 'candidate_confirmed' | 'unverified' | 'unsupported';
  candidate_confirmed: boolean;
  confirmed_at?: string | null;
  confidence_score: number;
  audit_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TargetedResumeResult {
  targetedResume: ResumeStudioData;
  diff: {
    summary: { original: string | null; targeted: string };
    skills: { original: string[]; targeted: string[]; matched: string[]; unmatchedRequirements: string[] };
    experience: Array<{ role: string; company: string; originalHighlights: string[]; targetedHighlights: string[] }>;
  };
  matchedKeywords: string[];
  missingRequirements: string[];
  alignmentScore: number;
  requiresHumanReview: boolean;
  groundingAttestation: string;
}

export async function getMasterResume(): Promise<ResumeStudioData> {
  const res = await request<never>('/resumes/master');
  return (res as any).resume;
}

export async function listStudioResumes(): Promise<ResumeStudioData[]> {
  const res = await request<never>('/resumes/studio');
  return (res as any).resumes || [];
}

export async function getStudioResume(id: string): Promise<ResumeStudioData> {
  const res = await request<never>(`/resumes/studio/${encodeURIComponent(id)}`);
  return (res as any).resume;
}

export async function createStudioResume(data: Partial<ResumeStudioData>): Promise<ResumeStudioData> {
  const res = await request<never>('/resumes/studio', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return (res as any).resume;
}

export async function updateStudioResume(id: string, data: Partial<ResumeStudioData>): Promise<ResumeStudioData> {
  const res = await request<never>(`/resumes/studio/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return (res as any).resume;
}

export async function publishStudioResume(id: string, changeSummary?: string): Promise<ResumeStudioData> {
  const res = await request<never>(`/resumes/studio/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ changeSummary }),
  });
  return (res as any).resume;
}

export async function restoreStudioResume(id: string, version: number): Promise<ResumeStudioData> {
  const res = await request<never>(`/resumes/studio/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
  return (res as any).resume;
}

export async function duplicateStudioResume(id: string, title?: string): Promise<ResumeStudioData> {
  const res = await request<never>(`/resumes/studio/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return (res as any).resume;
}

export async function deleteStudioResume(id: string): Promise<void> {
  await request<never>(`/resumes/studio/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function diagnoseResumeATS(resumeText?: string, resumeId?: string): Promise<ATSDiagnosticResult> {
  const res = await request<never>('/resumes/analyzer/diagnose', {
    method: 'POST',
    body: JSON.stringify({ resumeText, resumeId }),
  });
  return (res as any).diagnosis;
}

export async function compareResumeWithJD(options: {
  resumeText?: string;
  candidateSkills?: string[];
  jobDescription: string;
  resumeId?: string;
}): Promise<JDComparisonResult> {
  const res = await request<never>('/resumes/analyzer/compare-jd', {
    method: 'POST',
    body: JSON.stringify(options),
  });
  return (res as any).comparison;
}

export async function generateTargetedResume(options: {
  baseResumeId?: string;
  jobDescription: string;
  targetRole?: string;
  targetCompany?: string;
  jobId?: string;
}): Promise<TargetedResumeResult> {
  const res = await request<never>('/resumes/targeted/generate', {
    method: 'POST',
    body: JSON.stringify(options),
  });
  return res as any;
}

export async function listTruthClaims(filter?: {
  resume_id?: string;
  category?: string;
  status?: string;
}): Promise<ResumeClaim[]> {
  const query = new URLSearchParams();
  if (filter?.resume_id) query.set('resume_id', filter.resume_id);
  if (filter?.category) query.set('category', filter.category);
  if (filter?.status) query.set('status', filter.status);

  const qs = query.toString();
  const path = qs ? `/resumes/truth/claims?${qs}` : '/resumes/truth/claims';
  const res = await request<never>(path);
  return (res as any).claims || [];
}

export async function confirmTruthClaim(
  claimId: string,
  confirmed: boolean,
  notes?: string,
): Promise<ResumeClaim> {
  const res = await request<never>(`/resumes/truth/claims/${encodeURIComponent(claimId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ confirmed, notes }),
  });
  return (res as any).claim;
}

export async function createTruthClaim(claim: Partial<ResumeClaim>): Promise<ResumeClaim> {
  const res = await request<never>('/resumes/truth/claims', {
    method: 'POST',
    body: JSON.stringify(claim),
  });
  return (res as any).claim;
}

export async function deleteTruthClaim(claimId: string): Promise<void> {
  await request<never>(`/resumes/truth/claims/${encodeURIComponent(claimId)}`, {
    method: 'DELETE',
  });
}

export async function downloadResumeFile(id: string, format: 'pdf' | 'docx', title?: string): Promise<void> {
  const token = await getToken();
  const rootApiUrl = API_BASE_URL.replace(/\/(local|workspace)$/, '');
  const url = `${rootApiUrl}/resumes/studio/${encodeURIComponent(id)}/export/${format}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to export ${format.toUpperCase()} (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  const safeName = (title || 'resume').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${safeName}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export interface DiscoveredJob {
  id: string;
  job_id: string;
  external_job_id: string | null;
  provider: 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters' | 'workday' | 'manual' | 'extension' | 'other';
  company_name: string;
  job_title: string;
  job_description: string;
  responsibilities: string[];
  required_skills: string[];
  preferred_skills: string[];
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'other';
  workplace_mode: 'remote' | 'hybrid' | 'office';
  location: string | null;
  country: string | null;
  application_url: string;
  original_source_url: string;
  canonical_url: string;
  posted_at: string | null;
  status: 'active' | 'expired' | 'closed' | 'paused' | 'unverified';
  is_saved?: boolean;
  personalized_score?: number;
  match_reasons?: string[];
}

export interface DiscoveredJobsResponse {
  jobs: DiscoveredJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isPersonalized: boolean;
}

export interface CandidateSavedJobItem {
  id: string;
  user_id: string;
  job_id: string;
  notes?: string | null;
  created_at: string;
  job: DiscoveredJob | null;
}

export async function listDiscoveredJobs(params?: {
  q?: string;
  role?: string;
  location?: string;
  workplace_mode?: string;
  employment_type?: string;
  min_salary?: number;
  provider?: string;
  personalized?: boolean;
  page?: number;
  limit?: number;
}): Promise<DiscoveredJobsResponse> {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.role) query.set('role', params.role);
  if (params?.location) query.set('location', params.location);
  if (params?.workplace_mode) query.set('workplace_mode', params.workplace_mode);
  if (params?.employment_type) query.set('employment_type', params.employment_type);
  if (params?.min_salary) query.set('min_salary', String(params.min_salary));
  if (params?.provider) query.set('provider', params.provider);
  if (params?.personalized) query.set('personalized', 'true');
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const path = qs ? `/jobs?${qs}` : '/jobs';
  const res = await request<never>(path);
  return res as unknown as DiscoveredJobsResponse;
}

export async function getDiscoveredJobDetails(id: string): Promise<DiscoveredJob> {
  const res = await request<never>(`/jobs/${encodeURIComponent(id)}`);
  return (res as any).job;
}

export async function saveDiscoveredJob(id: string, notes?: string): Promise<void> {
  await request<never>(`/jobs/${encodeURIComponent(id)}/save`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function unsaveDiscoveredJob(id: string): Promise<void> {
  await request<never>(`/jobs/${encodeURIComponent(id)}/save`, {
    method: 'DELETE',
  });
}

export async function listCandidateSavedJobs(page = 1, limit = 20): Promise<{ saved_jobs: CandidateSavedJobItem[]; total: number }> {
  const res = await request<never>(`/jobs/saved?page=${page}&limit=${limit}`);
  return res as any;
}

export async function importCandidateJob(input: {
  url?: string;
  title?: string;
  companyName?: string;
  descriptionText?: string;
  location?: string;
  workplaceMode?: string;
  salary?: string;
  provider?: string;
}): Promise<DiscoveredJob> {
  const res = await request<never>('/jobs/import', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return (res as any).job;
}

export async function triggerJobDiscovery(options?: {
  providers?: string[];
  sourceIds?: string[];
}): Promise<any> {
  const res = await request<never>('/jobs/discover', {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
  return (res as any).metrics;
}

export async function getJobDiscoveryStatus(): Promise<any> {
  const res = await request<never>('/jobs/discovery/status');
  return res;
}

export interface MatchSummaryData {
  total_matches: number;
  eligible_count: number;
  potentially_eligible_count: number;
  ineligible_count: number;
  average_score: number;
  top_matches: DetailedMatchRecord[];
}

export interface DetailedMatchRecord {
  id: string;
  user_id: string;
  candidate_id: string;
  job_id: string;
  overall_score: number;
  dimension_scores: {
    skills_alignment: number;
    experience_eligibility: number;
    role_relevance: number;
    education_eligibility: number;
    location_compatibility: number;
    salary_compatibility: number;
  };
  eligibility_status: 'eligible' | 'potentially_eligible' | 'ineligible' | 'insufficient_information';
  matched_skills: string[];
  missing_required_skills: string[];
  missing_preferred_skills: string[];
  skill_details: Array<{
    skill: string;
    canonical: string;
    status: 'matched' | 'missing';
    importance: 'required' | 'preferred';
    provenance?: string;
    evidence?: string;
  }>;
  experience_details: {
    candidate_years: number | null;
    job_min_years: number | null;
    job_max_years: number | null;
    status: string;
    note: string;
  };
  education_details: {
    candidate_degrees: string[];
    required_degree: string | null;
    status: string;
    note: string;
  };
  location_details: {
    candidate_locations: string[];
    candidate_mode: string;
    job_location: string | null;
    job_mode: string;
    status: string;
    note: string;
  };
  salary_details: {
    candidate_min: number | null;
    candidate_currency: string | null;
    job_min: number | null;
    job_max: number | null;
    job_currency: string | null;
    status: string;
    note: string;
  };
  blockers: string[];
  unknowns: string[];
  warnings: string[];
  explanation: string[];
  confidence: number;
  algorithm_version: string;
  created_at: string;
  updated_at: string;
  job?: {
    id: string;
    job_title: string;
    company_name: string;
    location: string | null;
    workplace_mode: string;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    required_skills: string[];
    preferred_skills?: string[];
    responsibilities?: string[];
    application_url: string;
    canonical_url: string;
  } | null;
}

export interface SkillGapAnalysisData {
  candidate_id: string;
  target_roles: string[];
  total_jobs_analyzed: number;
  top_missing_skills: Array<{
    skill: string;
    canonical: string;
    demand_count: number;
    importance: 'required' | 'preferred';
    candidate_has_skill: boolean;
    suggested_action: string;
  }>;
  verified_candidate_skills: string[];
  suggested_learning_priorities: Array<{
    skill: string;
    importance: 'high' | 'medium';
    job_mention_percentage: number;
    recommended_action: string;
  }>;
  disclaimer: string;
}

export async function listCandidateMatches(options?: {
  sort?: string;
  eligibility_status?: string;
  min_score?: number;
  page?: number;
  limit?: number;
}): Promise<{ matches: DetailedMatchRecord[]; total: number }> {
  const query = new URLSearchParams();
  if (options?.sort) query.set('sort', options.sort);
  if (options?.eligibility_status) query.set('eligibility_status', options.eligibility_status);
  if (options?.min_score) query.set('min_score', String(options.min_score));
  if (options?.page) query.set('page', String(options.page));
  if (options?.limit) query.set('limit', String(options.limit));

  const qs = query.toString();
  const path = qs ? `/matches?${qs}` : '/matches';
  const res = await request<never>(path);
  return res as any;
}

export async function getCandidateMatchDetails(id: string): Promise<DetailedMatchRecord> {
  const res = await request<never>(`/matches/${encodeURIComponent(id)}`);
  return (res as any).match;
}

export async function recalculateCandidateMatches(jobIds?: string[]): Promise<DetailedMatchRecord[]> {
  const res = await request<never>('/matches/recalculate', {
    method: 'POST',
    body: JSON.stringify({ jobIds }),
  });
  return (res as any).matches;
}

export async function getCandidateMatchSummary(): Promise<MatchSummaryData> {
  const res = await request<never>('/matches/summary');
  return (res as any).summary;
}

export async function getCandidateSkillGaps(): Promise<SkillGapAnalysisData> {
  const res = await request<never>('/matches/skill-gaps');
  return res as any;
}

// ==========================================
// PHASE 6: APPLICATION WORKSPACE & ASSISTANT
// ==========================================

export interface WorkspaceJobSnapshot {
  id: string;
  title: string;
  company: string;
  location: string;
  workplaceMode?: string;
  url: string;
  platform?: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  description?: string;
  salary?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
}

export interface WorkspaceMatchSnapshot {
  score: number;
  eligible: boolean;
  status: 'eligible' | 'ineligible' | 'insufficient_information';
  reasons: string[];
  missingEvidence?: string[];
  dimensionScores?: Record<string, number>;
}

export interface WorkspaceCoverLetterVersion {
  version: number;
  tone: 'professional' | 'concise' | 'technical' | 'enthusiastic';
  content: string;
  customInstructions?: string;
  createdAt: string;
}

export interface WorkspaceCoverLetter {
  id: string;
  version: number;
  tone: 'professional' | 'concise' | 'technical' | 'enthusiastic';
  content: string;
  customInstructions?: string;
  versions: WorkspaceCoverLetterVersion[];
  updatedAt: string;
}

export interface WorkspaceScreeningAnswer {
  id: string;
  question: string;
  category: string;
  answer: string | null;
  confidence: number;
  isGrounded: boolean;
  sourceField?: string;
  sourceEvidence?: string;
  requiresUserReview: boolean;
  status: 'ready' | 'needs_review' | 'manual_input_required' | 'unsupported';
  userApproved: boolean;
  notes?: string;
}

export interface WorkspaceFieldMapping {
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

export interface WorkspaceReadinessBreakdown {
  resume: { score: number; max: number; ready: boolean; reason?: string };
  coverLetter: { score: number; max: number; ready: boolean; reason?: string };
  screeningQuestions: { score: number; max: number; ready: boolean; reason?: string };
  formFields: { score: number; max: number; ready: boolean; reason?: string };
  missingInfo: { score: number; max: number; ready: boolean; reason?: string };
  humanApproval: { score: number; max: number; ready: boolean; reason?: string };
}

export interface WorkspaceReadiness {
  score: number;
  breakdown: WorkspaceReadinessBreakdown;
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

export interface WorkspaceApproval {
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
  auditTrail: Array<{
    action: string;
    timestamp: string;
    userId: string;
    details?: string;
    ip?: string;
  }>;
}

export interface ApplicationWorkspaceRecord {
  id: string;
  candidateId: string;
  jobId: string;
  status: ApplicationStatus;
  idempotencyKey: string;
  jobSnapshot: WorkspaceJobSnapshot;
  matchSnapshot: WorkspaceMatchSnapshot;
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
  coverLetter: WorkspaceCoverLetter;
  screeningAnswers: WorkspaceScreeningAnswer[];
  fieldMappings: WorkspaceFieldMapping[];
  missingInformation: string[];
  readiness: WorkspaceReadiness;
  approval: WorkspaceApproval;
  notes: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExportBundleResult {
  ok: boolean;
  filename: string;
  format: string;
  content: string;
  bundle: any;
}

export async function listApplicationWorkspaces(options?: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ applications: ApplicationWorkspaceRecord[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (options?.q) params.set('q', options.q);
  if (options?.status) params.set('status', options.status);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  const path = qs ? `/applications?${qs}` : '/applications';
  const res = await request<never>(path);
  return res as any;
}

export async function createApplicationWorkspace(
  jobId: string,
  options?: { customTone?: string; customInstructions?: string; idempotencyKey?: string },
): Promise<ApplicationWorkspaceRecord> {
  const res = await request<never>('/applications', {
    method: 'POST',
    body: JSON.stringify({
      jobId,
      customTone: options?.customTone,
      customInstructions: options?.customInstructions,
      idempotencyKey: options?.idempotencyKey,
    }),
  });
  return (res as any).application;
}

export async function getApplicationWorkspace(id: string): Promise<ApplicationWorkspaceRecord> {
  const res = await request<never>(`/applications/${encodeURIComponent(id)}`);
  return (res as any).application;
}

export async function updateApplicationWorkspace(
  id: string,
  updates: {
    coverLetter?: Partial<WorkspaceCoverLetter>;
    screeningAnswers?: WorkspaceScreeningAnswer[];
    fieldMappings?: WorkspaceFieldMapping[];
    notes?: string;
  },
): Promise<ApplicationWorkspaceRecord> {
  const res = await request<never>(`/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return (res as any).application;
}

export async function generateWorkspaceResume(
  id: string,
  options?: { baseResumeId?: string },
): Promise<ApplicationWorkspaceRecord> {
  const res = await request<never>(`/applications/${encodeURIComponent(id)}/generate-resume`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
  return (res as any).application;
}

export async function generateWorkspaceCoverLetter(
  id: string,
  options?: { tone?: string; customInstructions?: string },
): Promise<ApplicationWorkspaceRecord> {
  const res = await request<never>(`/applications/${encodeURIComponent(id)}/generate-cover-letter`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
  return (res as any).application;
}

export async function generateWorkspaceAnswers(
  id: string,
  questions?: string[],
): Promise<ApplicationWorkspaceRecord> {
  const res = await request<never>(`/applications/${encodeURIComponent(id)}/generate-answers`, {
    method: 'POST',
    body: JSON.stringify({ questions }),
  });
  return (res as any).application;
}

export async function approveWorkspace(
  id: string,
  signature?: string,
): Promise<ApplicationWorkspaceRecord> {
  const res = await request<never>(`/applications/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ signature }),
  });
  return (res as any).application;
}

export async function revokeWorkspaceApproval(
  id: string,
  reason?: string,
): Promise<ApplicationWorkspaceRecord> {
  const res = await request<never>(`/applications/${encodeURIComponent(id)}/revoke-approval`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return (res as any).application;
}

export async function exportWorkspaceBundle(
  id: string,
  format: 'json' | 'markdown' | 'text' = 'json',
): Promise<ExportBundleResult> {
  const res = await request<never>(`/applications/${encodeURIComponent(id)}/export`, {
    method: 'POST',
    body: JSON.stringify({ format }),
  });
  return res as any;
}

// ----------------------------------------------------
// PHASE 7: APPLICATION TRACKER & INTERVIEW PIPELINE
// ----------------------------------------------------

export type TrackerLifecycleStatus =
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
  | 'closed';

export interface SubmissionEvidenceItem {
  evidenceId?: string;
  submissionMethod: 'manual' | 'extension_assisted' | 'direct_api' | 'portal';
  verificationStatus: 'verified' | 'candidate_reported' | 'unverified';
  submittedAt: string;
  destination: string;
  confirmationReference?: string;
}

export interface TrackedAppSummary {
  id: string;
  candidateId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  location?: string;
  jobUrl?: string;
  source?: string;
  status: TrackerLifecycleStatus | string;
  allowedTransitions: string[];
  submissionEvidence?: SubmissionEvidenceItem;
  interviewsCount: number;
  pendingFollowUpsCount: number;
  hasOverdueFollowUp: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEventItem {
  id: string;
  applicationId: string;
  timestamp: string;
  eventType: string;
  title: string;
  description: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface InterviewItem {
  id: string;
  applicationId: string;
  candidateId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  stage:
    | 'hr_screening'
    | 'technical_interview'
    | 'coding_assessment'
    | 'managerial_interview'
    | 'final_interview'
    | 'other';
  scheduledAt: string;
  timezone: string;
  durationMinutes: number;
  interviewMode: 'video' | 'phone' | 'in_person' | 'take_home';
  meetingLink?: string;
  location?: string;
  interviewerDetails?: {
    name?: string;
    title?: string;
    email?: string;
    linkedin?: string;
    notes?: string;
  };
  preparationNotes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  feedback?: {
    rating?: number;
    strengths?: string[];
    areasToImprove?: string[];
    questionsAsked?: string[];
    overallImpression?: string;
  };
  nextSteps?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpItem {
  id: string;
  applicationId: string;
  candidateId: string;
  company: string;
  jobTitle: string;
  followUpDate: string;
  status: 'pending' | 'completed' | 'cancelled';
  isOverdue: boolean;
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

export interface ApplicationDossierItem {
  application: any;
  submissionEvidence: any | null;
  interviews: InterviewItem[];
  followUps: FollowUpItem[];
  timeline: TimelineEventItem[];
  allowedTransitions: string[];
}

export interface AppAnalyticsItem {
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
  responseRate: number;
  interviewConversionRate: number;
  offerConversionRate: number;
  stageBreakdown: Record<string, number>;
  denominators: {
    responseRateDenominator: string;
    interviewRateDenominator: string;
    offerRateDenominator: string;
  };
  disclaimer: string;
}

export interface NotificationItem {
  id: string;
  candidateId: string;
  type: 'upcoming_interview' | 'follow_up_reminder' | 'status_change' | 'offer_deadline' | 'system';
  title: string;
  message: string;
  applicationId?: string;
  entityId?: string;
  notificationKey: string;
  read: boolean;
  createdAt: string;
}

// Tracker APIs
export async function listTrackedApplications(params: {
  q?: string;
  company?: string;
  title?: string;
  status?: string;
  source?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ applications: TrackedAppSummary[]; total: number; page: number; limit: number }> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.company) query.set('company', params.company);
  if (params.title) query.set('title', params.title);
  if (params.status) query.set('status', params.status);
  if (params.source) query.set('source', params.source);
  if (params.fromDate) query.set('fromDate', params.fromDate);
  if (params.toDate) query.set('toDate', params.toDate);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const res = await request<never>(`/tracker${qs ? `?${qs}` : ''}`);
  return res as any;
}

export async function getApplicationDossier(applicationId: string): Promise<ApplicationDossierItem> {
  const res = await request<never>(`/tracker/${encodeURIComponent(applicationId)}`);
  return (res as any).dossier;
}

export async function updateApplicationTrackerStatus(
  applicationId: string,
  status: TrackerLifecycleStatus,
  reason?: string,
): Promise<{ status: string; updatedAt: string }> {
  const res = await request<never>(`/tracker/${encodeURIComponent(applicationId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
  return res as any;
}

export async function recordApplicationSubmissionEvidence(
  applicationId: string,
  payload: {
    destination: string;
    submissionMethod: 'manual' | 'extension_assisted' | 'direct_api' | 'portal';
    confirmationReference?: string;
    confirmationEvidence?: {
      type: 'email_snippet' | 'screenshot_url' | 'portal_confirmation_url' | 'confirmation_text';
      value: string;
      submittedAt: string;
    };
    verificationStatus?: 'verified' | 'candidate_reported' | 'unverified';
    notes?: string;
  },
): Promise<any> {
  const res = await request<never>(`/tracker/${encodeURIComponent(applicationId)}/submission-evidence`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return (res as any).evidence;
}

export async function getApplicationTimelineEvents(applicationId: string): Promise<TimelineEventItem[]> {
  const res = await request<never>(`/tracker/${encodeURIComponent(applicationId)}/timeline`);
  return (res as any).timeline || [];
}

// Interview APIs
export async function scheduleInterview(payload: {
  applicationId: string;
  stage: string;
  scheduledAt: string;
  timezone?: string;
  durationMinutes?: number;
  interviewMode: string;
  meetingLink?: string;
  location?: string;
  interviewerDetails?: any;
  preparationNotes?: string;
}): Promise<InterviewItem> {
  const res = await request<never>('/interviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return (res as any).interview;
}

export async function listInterviews(params: {
  applicationId?: string;
  status?: string;
  stage?: string;
} = {}): Promise<InterviewItem[]> {
  const query = new URLSearchParams();
  if (params.applicationId) query.set('applicationId', params.applicationId);
  if (params.status) query.set('status', params.status);
  if (params.stage) query.set('stage', params.stage);

  const qs = query.toString();
  const res = await request<never>(`/interviews${qs ? `?${qs}` : ''}`);
  return (res as any).interviews || [];
}

export async function updateInterview(
  id: string,
  payload: Partial<InterviewItem>,
): Promise<InterviewItem> {
  const res = await request<never>(`/interviews/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return (res as any).interview;
}

export async function deleteInterview(id: string): Promise<boolean> {
  const res = await request<never>(`/interviews/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return (res as any).ok === true;
}

// Follow-Up APIs
export async function scheduleFollowUp(payload: {
  applicationId: string;
  followUpDate: string;
  nextAction: string;
  notes?: string;
  reminderSettings?: any;
  contactDetails?: any;
}): Promise<FollowUpItem> {
  const res = await request<never>('/follow-ups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return (res as any).followUp;
}

export async function listFollowUps(params: {
  applicationId?: string;
  status?: string;
  overdueOnly?: boolean;
} = {}): Promise<FollowUpItem[]> {
  const query = new URLSearchParams();
  if (params.applicationId) query.set('applicationId', params.applicationId);
  if (params.status) query.set('status', params.status);
  if (params.overdueOnly) query.set('overdueOnly', 'true');

  const qs = query.toString();
  const res = await request<never>(`/follow-ups${qs ? `?${qs}` : ''}`);
  return (res as any).followUps || [];
}

export async function logFollowUpAction(
  id: string,
  payload: {
    action: string;
    notes?: string;
    markCompleted?: boolean;
    nextFollowUpDate?: string;
  },
): Promise<FollowUpItem> {
  const res = await request<never>(`/follow-ups/${encodeURIComponent(id)}/action`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return (res as any).followUp;
}

// Analytics APIs
export async function getApplicationAnalyticsData(): Promise<AppAnalyticsItem> {
  const res = await request<never>('/analytics/applications');
  return (res as any).analytics;
}

// Notifications APIs
export async function listInAppNotifications(unreadOnly = false): Promise<NotificationItem[]> {
  const res = await request<never>(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`);
  return (res as any).notifications || [];
}

export async function markNotificationAsRead(id: string): Promise<boolean> {
  const res = await request<never>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
  return (res as any).ok === true;
}

export async function markAllInAppNotificationsAsRead(): Promise<number> {
  const res = await request<never>('/notifications/mark-all-read', {
    method: 'POST',
  });
  return (res as any).modifiedCount || 0;
}

// --- Phase 8: Progeni Atlas Interviewer Platform Integration ---

export interface ProgeniCompetencyPillars {
  algorithmicProblemSolving: number;
  systemArchitecture: number;
  codeQualityAndSyntax: number;
  communicationAndClarity: number;
}

export interface ProgeniProctoringSummary {
  totalEvents: number;
  warningCount: number;
  flagged: boolean;
  overallIntegrityScore: number;
}

export interface ProgeniTurnReview {
  turnNumber: number;
  stage: string;
  questionText: string;
  answerText?: string;
  score: number;
  feedback: string;
}

export interface ProgeniSimulationRecord {
  id: string;
  sessionId: string;
  candidateId: string;
  applicationId?: string;
  interviewId?: string;
  companyName: string;
  jobRole: string;
  status: 'pending' | 'launched' | 'in_progress' | 'completed' | 'failed';
  launchUrl?: string;
  isAiSimulation: true;
  overallScore?: number;
  hiringRecommendation?: string;
  percentileRank?: number;
  competencyPillars?: ProgeniCompetencyPillars;
  executiveSummary?: string;
  verifiedStrengths?: string[];
  targetedGrowthAreas?: string[];
  proctoringSummary?: ProgeniProctoringSummary;
  turnReviews?: ProgeniTurnReview[];
  launchedAt: string;
  completedAt?: string;
  updatedAt: string;
}

export interface LaunchSimulationResponse {
  sessionId: string;
  targetUrl: string;
  launchTicket: any;
  simulation: ProgeniSimulationRecord;
}

export async function launchProgeniSimulation(payload: {
  applicationId?: string;
  interviewId?: string;
  customRole?: string;
  customJd?: string;
}): Promise<LaunchSimulationResponse> {
  const res = await request<LaunchSimulationResponse>('/integration/progeni/launch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return (res as any).data;
}

export async function syncProgeniSimulation(
  sessionId: string,
): Promise<ProgeniSimulationRecord> {
  const res = await request<never>(`/integration/progeni/sync/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
  });
  return (res as any).simulation;
}

export async function listProgeniSimulations(
  applicationId?: string,
): Promise<ProgeniSimulationRecord[]> {
  const qs = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
  const res = await request<never>(`/integration/progeni/simulations${qs}`);
  return (res as any).simulations || [];
}

// --- Phase 9: SaaS Administration, Billing & Usage Management ---

export type SubscriptionTier = 'free' | 'pro' | 'premium';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
export type BillingInterval = 'month' | 'year';

export interface PlanQuotas {
  resumeGenerations: number;
  coverLetters: number;
  screeningAnswers: number;
  jobMatches: number;
  interviewSimulations: number;
  totalAiCredits: number;
}

export interface PlanConfigItem {
  tier: SubscriptionTier;
  name: string;
  description: string;
  price: {
    amount: number;
    currency: 'INR' | 'USD';
    interval: BillingInterval;
  };
  features: string[];
  quotas: PlanQuotas;
  popular?: boolean;
}

export interface CandidateSubscriptionItem {
  id: string;
  candidateId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  cancelReason?: string;
  failedPaymentCount: number;
}

export interface CandidateCreditAccountItem {
  id: string;
  candidateId: string;
  tier: SubscriptionTier;
  balance: number;
  monthlyQuota: number;
  consumedThisCycle: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  updatedAt: string;
}

export interface CreditLedgerItem {
  id: string;
  type: 'grant' | 'deduction' | 'refund' | 'admin_adjustment';
  amount: number;
  service?: string;
  balanceAfter: number;
  description: string;
  timestamp: string;
}

export interface PaymentTransactionItem {
  id: string;
  orderId: string;
  paymentId: string;
  amount: number;
  currency: 'INR' | 'USD';
  tier: SubscriptionTier;
  interval: BillingInterval;
  status: 'captured' | 'failed' | 'refunded';
  invoiceNumber: string;
  createdAt: string;
}

export async function getBillingPlans(): Promise<Record<SubscriptionTier, PlanConfigItem>> {
  const res = await request<never>('/billing/plans');
  return (res as any).plans;
}

export async function getCandidateSubscription(): Promise<{
  subscription: CandidateSubscriptionItem;
  plan: PlanConfigItem;
  history: any[];
}> {
  const res = await request<never>('/billing/subscription');
  return res as any;
}

export async function getCandidateCredits(): Promise<CandidateCreditAccountItem> {
  const res = await request<never>('/billing/credits');
  return (res as any).account;
}

export async function getCandidateUsage(params: { limit?: number; offset?: number } = {}): Promise<{
  entries: CreditLedgerItem[];
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const queryStr = qs.toString();
  const res = await request<never>(`/billing/usage${queryStr ? `?${queryStr}` : ''}`);
  return res as any;
}

export async function createSubscriptionOrder(
  tier: 'pro' | 'premium',
  interval: 'month' | 'year' = 'month',
): Promise<{ order: any }> {
  const res = await request<never>('/billing/orders', {
    method: 'POST',
    body: JSON.stringify({ tier, interval }),
  });
  return res as any;
}

export async function verifySubscriptionPayment(payload: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<{ subscription: CandidateSubscriptionItem; transaction: PaymentTransactionItem }> {
  const res = await request<never>('/billing/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res as any;
}

export async function cancelCandidateSubscription(
  reason?: string,
  immediate?: boolean,
): Promise<CandidateSubscriptionItem> {
  const res = await request<never>('/billing/cancel', {
    method: 'POST',
    body: JSON.stringify({ reason, immediate }),
  });
  return (res as any).subscription;
}

export async function getCandidateInvoices(params: { limit?: number; offset?: number } = {}): Promise<{
  transactions: PaymentTransactionItem[];
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const queryStr = qs.toString();
  const res = await request<never>(`/billing/invoices${queryStr ? `?${queryStr}` : ''}`);
  return res as any;
}

export async function getCandidateInvoiceReceipt(invoiceNumber: string): Promise<any> {
  const res = await request<never>(`/billing/invoices/${encodeURIComponent(invoiceNumber)}/receipt`);
  return (res as any).receipt;
}



