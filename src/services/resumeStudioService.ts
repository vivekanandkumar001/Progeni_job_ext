import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/mongodb.js';
import { candidateProfileService } from './candidateProfileService.js';
import { resumeService } from './resumeService.js';

const STUDIO_TABLE = 'resumes';

export interface ResumePersonalInfo {
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

export interface ResumeWorkExperience {
  id: string;
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

export interface ResumeEducation {
  id: string;
  institution: string;
  degree: string;
  field_of_study?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  grade?: string | null;
}

export interface ResumeSkill {
  name: string;
  category?: string;
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  is_verified?: boolean;
}

export interface ResumeProject {
  id: string;
  name: string;
  description?: string | null;
  url?: string | null;
  github_url?: string | null;
  technologies: string[];
  highlights: string[];
}

export interface ResumeCertification {
  id: string;
  name: string;
  issuer: string;
  issue_date?: string | null;
  expiration_date?: string | null;
  credential_id?: string | null;
  credential_url?: string | null;
}

export interface ResumeAchievement {
  id: string;
  title: string;
  description: string;
  date?: string | null;
}

export interface ResumeLanguage {
  language: string;
  proficiency: 'native' | 'fluent' | 'professional' | 'conversational' | 'basic';
}

export interface ResumeStudioContent {
  personal_info: ResumePersonalInfo;
  summary?: string | null;
  work_experience: ResumeWorkExperience[];
  education: ResumeEducation[];
  skills: ResumeSkill[];
  projects: ResumeProject[];
  certifications: ResumeCertification[];
  achievements: ResumeAchievement[];
  languages: ResumeLanguage[];
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

type StudioDocument = Omit<ResumeStudioData, 'id'> & { _id: string };

const DEFAULT_SECTION_ORDER = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'achievements',
  'languages',
];

export class ResumeStudioService {
  async getMasterResume(userId: string): Promise<ResumeStudioData> {
    const collection = (await getDatabase()).collection<StudioDocument>(STUDIO_TABLE);
    const existing = await collection.findOne({ user_id: userId, is_master: true });
    if (existing) {
      return this.toRow(existing);
    }

    // Auto-initialize Master Resume from existing candidate profile
    const profile = await candidateProfileService.get(userId);
    const activeRawResume = await resumeService.getActive(userId);

    const initialContent: ResumeStudioContent = {
      personal_info: {
        full_name: profile?.full_name || 'Candidate Name',
        email: profile?.email || '',
        phone: profile?.phone || null,
        city: profile?.city || null,
        country: profile?.country || null,
        target_role: profile?.target_role || null,
        linkedin_url: profile?.linkedin_url || null,
        github_url: profile?.github_url || null,
        portfolio_url: profile?.portfolio_url || null,
      },
      summary: profile?.target_role
        ? `Dedicated ${profile.target_role} with proven track record in software engineering, scalable architectures, and team delivery.`
        : null,
      work_experience: (profile?.work_experience || []).map((exp) => ({
        id: randomUUID(),
        company: exp.company,
        role: exp.title,
        location: exp.location || null,
        start_date: exp.startDate || null,
        end_date: exp.endDate || (exp.current ? 'Present' : null),
        current: exp.current,
        highlights: exp.highlights || [],
        technologies: [],
      })),
      education: (profile?.education || []).map((edu) => ({
        id: randomUUID(),
        institution: edu.institution,
        degree: edu.degree,
        field_of_study: edu.fieldOfStudy || null,
        start_year: edu.startYear || null,
        end_year: edu.endYear || null,
      })),
      skills: (profile?.skills || activeRawResume?.skills || []).map((s) => ({
        name: s,
        category: 'technical',
        is_verified: true,
      })),
      projects: (profile?.projects || []).map((p) => ({
        id: randomUUID(),
        name: p.name,
        description: p.description || null,
        url: p.url || null,
        technologies: p.technologies || [],
        highlights: [],
      })),
      certifications: (profile?.certifications || []).map((c) => ({
        id: randomUUID(),
        name: c.name,
        issuer: c.issuer || '',
        issue_date: c.issueDate || null,
      })),
      achievements: [],
      languages: [{ language: 'English', proficiency: 'professional' }],
    };

    return this.createResume(userId, {
      title: 'Master Career Profile',
      is_master: true,
      status: 'published',
      template: 'modern',
      section_order: DEFAULT_SECTION_ORDER,
      content: initialContent,
    });
  }

  async listResumes(userId: string): Promise<ResumeStudioData[]> {
    const docs = await (await getDatabase())
      .collection<StudioDocument>(STUDIO_TABLE)
      .find({ user_id: userId })
      .sort({ is_master: -1, updated_at: -1 })
      .toArray();

    return docs.map((d) => this.toRow(d));
  }

  async getResume(userId: string, resumeId: string): Promise<ResumeStudioData | null> {
    const doc = await (await getDatabase())
      .collection<StudioDocument>(STUDIO_TABLE)
      .findOne({ _id: resumeId as any, user_id: userId });
    return doc ? this.toRow(doc) : null;
  }

  async createResume(
    userId: string,
    payload: Partial<ResumeStudioData>,
  ): Promise<ResumeStudioData> {
    const collection = (await getDatabase()).collection<StudioDocument>(STUDIO_TABLE);
    const id = payload.id || randomUUID();
    const now = new Date().toISOString();

    if (payload.is_master) {
      await collection.updateMany(
        { user_id: userId, is_master: true },
        { $set: { is_master: false, updated_at: now } },
      );
    }

    const defaultContent: ResumeStudioContent = {
      personal_info: { full_name: 'Candidate', email: '' },
      work_experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      achievements: [],
      languages: [],
    };

    const doc: StudioDocument = {
      _id: id,
      user_id: userId,
      title: payload.title || 'Untitled Resume',
      is_master: Boolean(payload.is_master),
      status: payload.status || 'draft',
      version: payload.version || 1,
      template: payload.template || 'classic',
      target_job_title: payload.target_job_title || null,
      target_company: payload.target_company || null,
      job_id: payload.job_id || null,
      section_order: payload.section_order || DEFAULT_SECTION_ORDER,
      content: payload.content || defaultContent,
      version_history: payload.version_history || [
        {
          version: payload.version || 1,
          updated_at: now,
          change_summary: 'Initial draft created',
          snapshot_content: payload.content || defaultContent,
        },
      ],
      created_at: now,
      updated_at: now,
    };

    await collection.replaceOne({ _id: id as any, user_id: userId }, doc as any, { upsert: true });
    return this.toRow(doc);
  }

  async updateResume(
    userId: string,
    resumeId: string,
    payload: Partial<ResumeStudioData>,
  ): Promise<ResumeStudioData> {
    const collection = (await getDatabase()).collection<StudioDocument>(STUDIO_TABLE);
    const existing = await collection.findOne({ _id: resumeId as any, user_id: userId });
    if (!existing) {
      throw new Error('Resume not found or unauthorized.');
    }

    const now = new Date().toISOString();
    const updateFields: Partial<StudioDocument> = {
      updated_at: now,
    };

    if (payload.title !== undefined) updateFields.title = payload.title;
    if (payload.template !== undefined) updateFields.template = payload.template;
    if (payload.section_order !== undefined) updateFields.section_order = payload.section_order;
    if (payload.target_job_title !== undefined) updateFields.target_job_title = payload.target_job_title;
    if (payload.target_company !== undefined) updateFields.target_company = payload.target_company;
    if (payload.content !== undefined) {
      updateFields.content = {
        ...existing.content,
        ...payload.content,
      };
    }

    await collection.updateOne({ _id: resumeId as any, user_id: userId }, { $set: updateFields });
    const updated = await collection.findOne({ _id: resumeId as any, user_id: userId });
    return this.toRow(updated!);
  }

  async publishVersion(
    userId: string,
    resumeId: string,
    changeSummary?: string,
  ): Promise<ResumeStudioData> {
    const collection = (await getDatabase()).collection<StudioDocument>(STUDIO_TABLE);
    const existing = await collection.findOne({ _id: resumeId as any, user_id: userId });
    if (!existing) {
      throw new Error('Resume not found or unauthorized.');
    }

    const newVersion = (existing.version || 1) + 1;
    const now = new Date().toISOString();

    const snapshot: ResumeVersionSnapshot = {
      version: newVersion,
      updated_at: now,
      change_summary: changeSummary || `Version ${newVersion} published`,
      snapshot_content: JSON.parse(JSON.stringify(existing.content)),
    };

    const history = existing.version_history || [];
    history.push(snapshot);

    await collection.updateOne(
      { _id: resumeId as any, user_id: userId },
      {
        $set: {
          version: newVersion,
          status: 'published',
          version_history: history,
          updated_at: now,
        },
      },
    );

    const updated = await collection.findOne({ _id: resumeId as any, user_id: userId });
    return this.toRow(updated!);
  }

  async restoreVersion(
    userId: string,
    resumeId: string,
    targetVersion: number,
  ): Promise<ResumeStudioData> {
    const collection = (await getDatabase()).collection<StudioDocument>(STUDIO_TABLE);
    const existing = await collection.findOne({ _id: resumeId as any, user_id: userId });
    if (!existing) {
      throw new Error('Resume not found or unauthorized.');
    }

    const targetSnapshot = existing.version_history?.find((s) => s.version === targetVersion);
    if (!targetSnapshot) {
      throw new Error(`Version ${targetVersion} not found in history.`);
    }

    const now = new Date().toISOString();
    const newVersion = (existing.version || 1) + 1;

    const restoreSnapshot: ResumeVersionSnapshot = {
      version: newVersion,
      updated_at: now,
      change_summary: `Restored from version ${targetVersion}`,
      snapshot_content: JSON.parse(JSON.stringify(targetSnapshot.snapshot_content)),
    };

    const history = existing.version_history || [];
    history.push(restoreSnapshot);

    await collection.updateOne(
      { _id: resumeId as any, user_id: userId },
      {
        $set: {
          version: newVersion,
          content: targetSnapshot.snapshot_content,
          version_history: history,
          updated_at: now,
        },
      },
    );

    const updated = await collection.findOne({ _id: resumeId as any, user_id: userId });
    return this.toRow(updated!);
  }

  async duplicateResume(
    userId: string,
    resumeId: string,
    newTitle?: string,
  ): Promise<ResumeStudioData> {
    const source = await this.getResume(userId, resumeId);
    if (!source) {
      throw new Error('Source resume not found or unauthorized.');
    }

    return this.createResume(userId, {
      title: newTitle || `${source.title} (Copy)`,
      is_master: false,
      status: 'draft',
      version: 1,
      template: source.template,
      target_job_title: source.target_job_title,
      target_company: source.target_company,
      job_id: source.job_id,
      section_order: source.section_order,
      content: JSON.parse(JSON.stringify(source.content)),
    });
  }

  async deleteResume(userId: string, resumeId: string): Promise<boolean> {
    const result = await (await getDatabase())
      .collection<StudioDocument>(STUDIO_TABLE)
      .deleteOne({ _id: resumeId as any, user_id: userId });
    return result.deletedCount === 1;
  }

  private toRow(doc: StudioDocument): ResumeStudioData {
    const { _id, ...rest } = doc;
    return {
      ...rest,
      id: _id,
      version_history: rest.version_history || [],
      section_order: rest.section_order || DEFAULT_SECTION_ORDER,
    };
  }
}

export const resumeStudioService = new ResumeStudioService();

