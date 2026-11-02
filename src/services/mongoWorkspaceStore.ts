import { randomUUID } from 'node:crypto';
import { MongoServerError } from 'mongodb';
import { getDatabase } from '../config/mongodb.js';
import type {
  ApplicationStatus,
  CandidateProfile,
  CandidateWorkspaceStore,
  JobListing,
  JobMatch,
  LocalResume,
  TrackedApplication,
} from './localDataStore.js';

interface WorkspaceData {
  profile: CandidateProfile | null;
  consentAcceptedAt: string | null;
  jobs: JobListing[];
  matches: JobMatch[];
  applications: TrackedApplication[];
  resumes: LocalResume[];
}

interface WorkspaceDocument {
  _id: string;
  revision: number;
  data: WorkspaceData;
}

const MAX_WORKSPACE_RECORDS = 50;

function emptyWorkspace(): WorkspaceData {
  return {
    profile: null,
    consentAcceptedAt: null,
    jobs: [],
    matches: [],
    applications: [],
    resumes: [],
  };
}

async function updateWorkspace<T>(
  userId: string,
  update: (data: WorkspaceData) => T,
): Promise<T> {
  const collection = (await getDatabase()).collection<WorkspaceDocument>('candidate_workspaces');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await collection.findOne({ _id: userId });
    const data = current?.data ?? emptyWorkspace();
    const result = update(data);
    const next: WorkspaceDocument = {
      _id: userId,
      revision: (current?.revision ?? 0) + 1,
      data,
    };
    const filter = current
      ? { _id: userId, revision: current.revision }
      : { _id: userId, revision: { $exists: false } };

    try {
      const saved = await collection.replaceOne(filter, next, { upsert: !current });
      if (saved.modifiedCount === 1 || saved.upsertedCount === 1) return result;
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000 && !current)) {
        throw error;
      }
    }
  }

  throw new Error('Your workspace changed while saving. Please retry the request.');
}

export const mongoWorkspaceStore: CandidateWorkspaceStore = {
  async getProfile(userId) {
    const document = await (await getDatabase())
      .collection<WorkspaceDocument>('candidate_workspaces')
      .findOne({ _id: userId }, { projection: { 'data.profile': 1 } });
    return document?.data.profile ?? null;
  },

  async hasConsent(userId) {
    const document = await (await getDatabase())
      .collection<WorkspaceDocument>('candidate_workspaces')
      .findOne({ _id: userId }, { projection: { 'data.consentAcceptedAt': 1 } });
    return Boolean(document?.data.consentAcceptedAt);
  },

  saveConsent(userId) {
    return updateWorkspace(userId, (data) => {
      data.consentAcceptedAt = new Date().toISOString();
      return data.consentAcceptedAt;
    });
  },

  clearWorkspace(userId) {
    return updateWorkspace(userId, (data) => {
      Object.assign(data, emptyWorkspace());
    });
  },

  async saveProfile(userId, profile) {
    return updateWorkspace(userId, (data) => {
      const saved = { ...profile, updatedAt: new Date().toISOString() };
      data.profile = saved;
      return saved;
    });
  },

  async listResumes(userId) {
    const document = await (await getDatabase())
      .collection<WorkspaceDocument>('candidate_workspaces')
      .findOne({ _id: userId }, { projection: { 'data.resumes': 1 } });
    return document?.data.resumes ?? [];
  },

  saveResume(userId, resume, profile) {
    return updateWorkspace(userId, (data) => {
      const saved: LocalResume = {
        ...resume,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      data.resumes = [saved, ...data.resumes].slice(0, MAX_WORKSPACE_RECORDS);
      data.profile = {
        ...profile,
        skills: [...new Set(profile.skills)],
        updatedAt: new Date().toISOString(),
      };
      return saved;
    });
  },

  deleteResume(userId, id) {
    return updateWorkspace(userId, (data) => {
      const resumes = data.resumes.filter((resume) => resume.id !== id);
      if (resumes.length === data.resumes.length) return false;
      data.resumes = resumes;
      return true;
    });
  },

  async listJobs(userId) {
    const document = await (await getDatabase())
      .collection<WorkspaceDocument>('candidate_workspaces')
      .findOne({ _id: userId }, { projection: { 'data.jobs': 1 } });
    return document?.data.jobs ?? [];
  },

  saveMatch(userId, job, match) {
    return updateWorkspace(userId, (data) => {
      const boundedJob = { ...job, description: job.description.slice(0, 15_000) };
      const existingJob = data.jobs.find((item) => item.url === boundedJob.url);
      const savedJob: JobListing = existingJob
        ? { ...existingJob, ...boundedJob }
        : { ...boundedJob, id: randomUUID(), createdAt: new Date().toISOString() };
      const savedMatch: JobMatch = {
        ...match,
        id: randomUUID(),
        job: savedJob,
        createdAt: new Date().toISOString(),
      };
      data.jobs = [savedJob, ...data.jobs.filter((item) => item.id !== savedJob.id)]
        .slice(0, MAX_WORKSPACE_RECORDS);
      data.matches = [savedMatch, ...data.matches.filter((item) => item.job.url !== savedJob.url)]
        .slice(0, MAX_WORKSPACE_RECORDS);
      return savedMatch;
    });
  },

  async listMatches(userId) {
    const document = await (await getDatabase())
      .collection<WorkspaceDocument>('candidate_workspaces')
      .findOne({ _id: userId }, { projection: { 'data.matches': 1 } });
    return document?.data.matches ?? [];
  },

  createApplication(userId, jobId) {
    return updateWorkspace(userId, (data) => {
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
      data.applications = [application, ...data.applications].slice(0, MAX_WORKSPACE_RECORDS);
      return application;
    });
  },

  async listApplications(userId) {
    const document = await (await getDatabase())
      .collection<WorkspaceDocument>('candidate_workspaces')
      .findOne({ _id: userId }, { projection: { 'data.applications': 1 } });
    return document?.data.applications ?? [];
  },

  updateApplication(userId, id, status: ApplicationStatus, notes) {
    return updateWorkspace(userId, (data) => {
      const application = data.applications.find((item) => item.id === id);
      if (!application) return null;
      application.status = status;
      if (notes !== undefined) application.notes = notes;
      application.updatedAt = new Date().toISOString();
      return application;
    });
  },
};
