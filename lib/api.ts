const API_BASE_URL = 'http://127.0.0.1:5000/api/v1/local';
const TOKEN_KEY = 'progeni.localApiToken';

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const result = await response.json() as ApiEnvelope<T>;
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
