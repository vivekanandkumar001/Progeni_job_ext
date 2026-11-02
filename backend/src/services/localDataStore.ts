import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface CandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  targetRole: string;
  location: string;
  skills: string[];
  experienceYears: number | null;
  updatedAt: string;
}

export interface LocalResume {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt';
  skills: Array<{ skill: string; evidence: string }>;
  experienceYears: number | null;
  experienceEvidence: string | null;
  createdAt: string;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  platform: string;
  requiredSkills: string[];
  experienceMin: number | null;
  createdAt: string;
}

export interface JobMatch {
  id: string;
  job: JobListing;
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
  job: JobListing;
  status: ApplicationStatus;
  notes: string;
  updatedAt: string;
}

export interface CandidateWorkspaceStore {
  getProfile(userId: string): Promise<CandidateProfile | null>;
  hasConsent(userId: string): Promise<boolean>;
  saveConsent(userId: string): Promise<string>;
  clearWorkspace(userId: string): Promise<void>;
  saveProfile(userId: string, profile: Omit<CandidateProfile, 'updatedAt'>): Promise<CandidateProfile>;
  listResumes(userId: string): Promise<LocalResume[]>;
  saveResume(
    userId: string,
    resume: Omit<LocalResume, 'id' | 'createdAt'>,
    profile: Omit<CandidateProfile, 'updatedAt'>,
  ): Promise<LocalResume>;
  deleteResume(userId: string, id: string): Promise<boolean>;
  listJobs(userId: string): Promise<JobListing[]>;
  saveMatch(
    userId: string,
    job: Omit<JobListing, 'id' | 'createdAt'>,
    match: Omit<JobMatch, 'id' | 'job' | 'createdAt'>,
  ): Promise<JobMatch>;
  listMatches(userId: string): Promise<JobMatch[]>;
  createApplication(userId: string, jobId: string): Promise<TrackedApplication>;
  listApplications(userId: string): Promise<TrackedApplication[]>;
  updateApplication(
    userId: string,
    id: string,
    status: ApplicationStatus,
    notes?: string,
  ): Promise<TrackedApplication | null>;
}

interface LocalData {
  profile: CandidateProfile | null;
  consentAcceptedAt: string | null;
  jobs: JobListing[];
  matches: JobMatch[];
  applications: TrackedApplication[];
  resumes: LocalResume[];
}

const EMPTY_DATA: LocalData = {
  profile: null,
  consentAcceptedAt: null,
  jobs: [],
  matches: [],
  applications: [],
  resumes: [],
};

const userDataDirectory = path.join(
  process.env.LOCALAPPDATA || process.env.APPDATA || process.cwd(),
  'ProgeniAutoApply',
);
const dataFile = path.join(userDataDirectory, 'candidate-data.json');

async function readData(): Promise<LocalData> {
  try {
    const contents = await readFile(dataFile, 'utf8');
    const parsed: unknown = JSON.parse(contents);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Local candidate data has an invalid format.');
    }
    const storedData = parsed as Partial<LocalData>;
    if (
      !Array.isArray(storedData.jobs) ||
      !Array.isArray(storedData.matches) ||
      !Array.isArray(storedData.applications) ||
      (storedData.resumes !== undefined && !Array.isArray(storedData.resumes))
    ) {
      throw new Error('Local candidate data has an invalid format.');
    }
    return { ...EMPTY_DATA, ...storedData, resumes: storedData.resumes ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY_DATA };
    throw error;
  }
}

let writeQueue: Promise<void> = Promise.resolve();

function updateData<T>(update: (data: LocalData) => T): Promise<T> {
  const operation = writeQueue.then(async () => {
    const data = await readData();
    const result = update(data);
    await mkdir(userDataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(data, null, 2), 'utf8');
    await rename(temporaryFile, dataFile);
    return result;
  });
  writeQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export const localDataStore = {
  async getProfile(_userId: string): Promise<CandidateProfile | null> {
    return (await readData()).profile;
  },

  async hasConsent(_userId: string): Promise<boolean> {
    return Boolean((await readData()).consentAcceptedAt);
  },

  saveConsent(_userId: string): Promise<string> {
    return updateData((data) => {
      data.consentAcceptedAt = new Date().toISOString();
      return data.consentAcceptedAt;
    });
  },

  clearWorkspace(_userId: string): Promise<void> {
    return updateData((data) => {
      data.profile = null;
      data.consentAcceptedAt = null;
      data.jobs = [];
      data.matches = [];
      data.applications = [];
      data.resumes = [];
    });
  },

  saveProfile(
    _userId: string,
    profile: Omit<CandidateProfile, 'updatedAt'>,
  ): Promise<CandidateProfile> {
    return updateData((data) => {
      const saved = { ...profile, updatedAt: new Date().toISOString() };
      data.profile = saved;
      return saved;
    });
  },

  async listResumes(_userId: string): Promise<LocalResume[]> {
    return (await readData()).resumes;
  },

  saveResume(
    _userId: string,
    resume: Omit<LocalResume, 'id' | 'createdAt'>,
    profile: Omit<CandidateProfile, 'updatedAt'>,
  ): Promise<LocalResume> {
    return updateData((data) => {
      const saved: LocalResume = {
        ...resume,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      data.resumes = [saved, ...data.resumes].slice(0, 100);
      data.profile = {
        ...profile,
        skills: [...new Set(profile.skills)],
        updatedAt: new Date().toISOString(),
      };
      return saved;
    });
  },

  deleteResume(_userId: string, id: string): Promise<boolean> {
    return updateData((data) => {
      const resumes = data.resumes.filter((resume) => resume.id !== id);
      if (resumes.length === data.resumes.length) return false;
      data.resumes = resumes;
      return true;
    });
  },

  async listJobs(_userId: string): Promise<JobListing[]> {
    return (await readData()).jobs;
  },

  saveMatch(
    _userId: string,
    job: Omit<JobListing, 'id' | 'createdAt'>,
    match: Omit<JobMatch, 'id' | 'job' | 'createdAt'>,
  ): Promise<JobMatch> {
    return updateData((data) => {
      const existingJob = data.jobs.find((item) => item.url === job.url);
      const savedJob: JobListing = existingJob
        ? { ...existingJob, ...job }
        : { ...job, id: randomUUID(), createdAt: new Date().toISOString() };
      const savedMatch: JobMatch = {
        ...match,
        id: randomUUID(),
        job: savedJob,
        createdAt: new Date().toISOString(),
      };
      data.jobs = [savedJob, ...data.jobs.filter((item) => item.id !== savedJob.id)].slice(0, 500);
      data.matches = [
        savedMatch,
        ...data.matches.filter((item) => item.job.url !== savedJob.url),
      ].slice(0, 500);
      return savedMatch;
    });
  },

  async listMatches(_userId: string): Promise<JobMatch[]> {
    return (await readData()).matches;
  },

  createApplication(_userId: string, jobId: string): Promise<TrackedApplication> {
    return updateData((data) => {
      const job = data.jobs.find((item) => item.id === jobId);
      if (!job) throw new Error('Job not found.');
      const existing = data.applications.find((item) => item.job.url === job.url);
      if (existing) return existing;
      const application: TrackedApplication = {
        id: randomUUID(),
        job,
        status: 'discovered',
        notes: '',
        updatedAt: new Date().toISOString(),
      };
      data.applications = [application, ...data.applications].slice(0, 500);
      return application;
    });
  },

  async listApplications(_userId: string): Promise<TrackedApplication[]> {
    return (await readData()).applications;
  },

  updateApplication(
    _userId: string,
    id: string,
    status: ApplicationStatus,
    notes?: string,
  ): Promise<TrackedApplication | null> {
    return updateData((data) => {
      const application = data.applications.find((item) => item.id === id);
      if (!application) return null;
      application.status = status;
      if (notes !== undefined) application.notes = notes;
      application.updatedAt = new Date().toISOString();
      return application;
    });
  },
};
