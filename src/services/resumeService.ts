import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { getDatabase } from '../config/mongodb.js';
import { analyzeResume, type ResumeAnalysis, type ResumeFileType } from './resumeParser.js';

const TABLE = 'resumes';
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface ResumeSkillItem {
  skill: string;
  evidence: string;
}

export interface ResumeRow {
  id: string;
  user_id: string;
  title: string;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size_bytes?: number | null;
  version: number;
  parsed_text: string | null;
  skills: string[] | null;
  skill_evidence?: ResumeSkillItem[] | null;
  experience_years: number | null;
  experience_evidence?: string | null;
  sections: Record<string, unknown> | null;
  ats_score: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type ResumeDocument = Omit<ResumeRow, 'id'> & { _id: string };

export class ResumeService {
  async list(userId: string): Promise<ResumeRow[]> {
    const resumes = await (await getDatabase())
      .collection<ResumeDocument>(TABLE)
      .find({ user_id: userId })
      .sort({ version: -1, created_at: -1 })
      .toArray();
    return resumes.map((resume) => this.toRow(resume));
  }

  async get(id: string, userId: string): Promise<ResumeRow | null> {
    const resume = await (await getDatabase())
      .collection<ResumeDocument>(TABLE)
      .findOne({ _id: id as any, user_id: userId });
    return resume ? this.toRow(resume) : null;
  }

  async getActive(userId: string): Promise<ResumeRow | null> {
    const resume = await (await getDatabase())
      .collection<ResumeDocument>(TABLE)
      .findOne({ user_id: userId, is_active: true }, { sort: { version: -1 } });
    return resume ? this.toRow(resume) : null;
  }

  async upsert(userId: string, body: Partial<ResumeRow>): Promise<ResumeRow> {
    const collection = (await getDatabase()).collection<ResumeDocument>(TABLE);
    const id = body.id || randomUUID();
    const existing = await collection.findOne(
      { _id: id as any, user_id: userId },
      { projection: { created_at: 1, version: 1 } },
    );

    let version = body.version;
    if (typeof version !== 'number') {
      if (existing?.version) {
        version = existing.version;
      } else {
        const latest = await collection.findOne(
          { user_id: userId },
          { sort: { version: -1 }, projection: { version: 1 } },
        );
        version = (latest?.version ?? 0) + 1;
      }
    }

    const resume: ResumeDocument = {
      _id: id,
      user_id: userId,
      title: body.title || 'Untitled Resume',
      file_name: body.file_name ? this.sanitizeFileName(body.file_name) : null,
      file_url: null, // Never expose public URL
      file_type: body.file_type || null,
      file_size_bytes: body.file_size_bytes ?? null,
      version,
      parsed_text: body.parsed_text || null,
      skills: Array.isArray(body.skills) ? body.skills : null,
      skill_evidence: Array.isArray(body.skill_evidence) ? body.skill_evidence : null,
      experience_years: typeof body.experience_years === 'number' ? body.experience_years : null,
      experience_evidence: body.experience_evidence ?? null,
      sections: body.sections || null,
      ats_score: typeof body.ats_score === 'number' ? body.ats_score : null,
      is_active: body.is_active ?? true,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If marked active, ensure other versions are archived (inactive)
    if (resume.is_active) {
      await collection.updateMany(
        { user_id: userId, _id: { $ne: id as any } },
        { $set: { is_active: false, updated_at: new Date().toISOString() } },
      );
    }

    await collection.replaceOne({ _id: id as any, user_id: userId }, resume as any, { upsert: true });

    // Sync to workspace
    await this.syncToWorkspace(userId, resume);

    return this.toRow(resume);
  }

  async uploadAndAnalyze(
    userId: string,
    fileName: string,
    fileType: ResumeFileType,
    buffer: Buffer,
    title?: string,
  ): Promise<{ resume: ResumeRow; analysis: ResumeAnalysis }> {
    if (buffer.length > MAX_RESUME_SIZE_BYTES) {
      throw new Error('Resume file exceeds maximum allowed size of 5 MB.');
    }

    const safeName = this.sanitizeFileName(fileName);
    const analysis = await analyzeResume(safeName, fileType, buffer);

    const skills = analysis.skills.map((s) => s.skill);
    const skillEvidence: ResumeSkillItem[] = analysis.skills.map((s) => ({
      skill: s.skill,
      evidence: s.evidence,
    }));

    const resume = await this.upsert(userId, {
      title: title || `${path.parse(safeName).name} (v${new Date().toLocaleDateString()})`,
      file_name: safeName,
      file_type: fileType,
      file_size_bytes: buffer.length,
      skills,
      skill_evidence: skillEvidence,
      experience_years: analysis.detected.experienceYears,
      experience_evidence: analysis.detected.experienceEvidence,
      is_active: true,
      ats_score: analysis.status === 'ready' ? 85 : analysis.status === 'needs_review' ? 60 : 40,
    });

    return { resume, analysis };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const collection = (await getDatabase()).collection<ResumeDocument>(TABLE);
    const result = await collection.deleteOne({ _id: id as any, user_id: userId });
    return result.deletedCount === 1;
  }

  sanitizeFileName(fileName: string): string {
    const base = path.basename(fileName);
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    return sanitized.slice(0, 150) || 'resume.pdf';
  }

  private toRow(resume: ResumeDocument): ResumeRow {
    const { _id, ...data } = resume;
    return { ...data, id: _id };
  }

  private async syncToWorkspace(userId: string, resume: ResumeDocument): Promise<void> {
    try {
      const db = await getDatabase();
      await db.collection('candidate_workspaces').updateOne(
        { _id: userId as any },
        {
          $push: {
            'data.resumes': {
              $each: [
                {
                  id: resume._id,
                  fileName: resume.file_name || 'resume.pdf',
                  fileType: (resume.file_type as any) || 'pdf',
                  skills: resume.skill_evidence || [],
                  experienceYears: resume.experience_years,
                  experienceEvidence: resume.experience_evidence || null,
                  createdAt: resume.created_at,
                },
              ],
              $slice: -20, // Keep last 20 in workspace snapshot
            },
          },
        } as any,
        { upsert: false },
      );
    } catch {
      // Non-blocking
    }
  }
}

export const resumeService = new ResumeService();
