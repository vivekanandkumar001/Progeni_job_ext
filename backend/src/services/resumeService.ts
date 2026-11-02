import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/mongodb.js';

const TABLE = 'resumes';

export interface ResumeRow {
  id: string;
  user_id: string;
  title: string;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  parsed_text: string | null;
  skills: string[] | null;
  experience_years: number | null;
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
      .sort({ created_at: -1 })
      .toArray();
    return resumes.map((resume) => this.toRow(resume));
  }

  async get(id: string, userId: string): Promise<ResumeRow | null> {
    const resume = await (await getDatabase())
      .collection<ResumeDocument>(TABLE)
      .findOne({ _id: id, user_id: userId });
    return resume ? this.toRow(resume) : null;
  }

  async upsert(userId: string, body: Partial<ResumeRow>): Promise<ResumeRow> {
    const collection = (await getDatabase()).collection<ResumeDocument>(TABLE);
    const id = body.id || randomUUID();
    const existing = await collection.findOne(
      { _id: id, user_id: userId },
      { projection: { created_at: 1 } },
    );
    const resume: ResumeDocument = {
      _id: id,
      user_id: userId,
      title: body.title || 'Untitled Resume',
      file_name: body.file_name || null,
      file_url: body.file_url || null,
      file_type: body.file_type || null,
      parsed_text: body.parsed_text || null,
      skills: Array.isArray(body.skills) ? body.skills : null,
      experience_years: typeof body.experience_years === 'number' ? body.experience_years : null,
      sections: body.sections || null,
      ats_score: typeof body.ats_score === 'number' ? body.ats_score : null,
      is_active: body.is_active ?? true,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await collection.replaceOne({ _id: id, user_id: userId }, resume, { upsert: true });
    return this.toRow(resume);
  }

  async delete(id: string, userId: string): Promise<void> {
    await (await getDatabase())
      .collection<ResumeDocument>(TABLE)
      .deleteOne({ _id: id, user_id: userId });
  }

  private toRow(resume: ResumeDocument): ResumeRow {
    const { _id, ...data } = resume;
    return { ...data, id: _id };
  }
}

export const resumeService = new ResumeService();