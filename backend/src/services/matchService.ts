import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/mongodb.js';

const TABLE = 'job_matches';

export interface MatchRow {
  id: string;
  user_id: string;
  job_id: string | null;
  score: number;
  factors: Record<string, unknown> | null;
  explanation: string[] | null;
  missing_evidence: string[] | null;
  eligible: boolean;
  blockers: string[] | null;
  unknowns: string[] | null;
  evidence: string[] | null;
  created_at: string;
}

type MatchDocument = Omit<MatchRow, 'id'> & { _id: string };

export interface CreateMatchInput {
  jobId?: string | null;
  score: number;
  factors: Record<string, unknown>;
  explanation: string[];
  missingEvidence: string[];
  eligible: boolean;
  blockers: string[];
  unknowns: string[];
  evidence: string[];
}

export class MatchService {
  async list(userId: string): Promise<MatchRow[]> {
    const matches = await (await getDatabase())
      .collection<MatchDocument>(TABLE)
      .find({ user_id: userId })
      .sort({ score: -1 })
      .toArray();
    return matches.map((match) => this.toRow(match));
  }

  async get(id: string, userId: string): Promise<MatchRow | null> {
    const match = await (await getDatabase())
      .collection<MatchDocument>(TABLE)
      .findOne({ _id: id, user_id: userId });
    return match ? this.toRow(match) : null;
  }

  async create(userId: string, body: CreateMatchInput): Promise<MatchRow> {
    const match: MatchDocument = {
      _id: randomUUID(),
      user_id: userId,
      job_id: body.jobId || null,
      score: typeof body.score === 'number' ? body.score : 0,
      factors: body.factors || null,
      explanation: Array.isArray(body.explanation) ? body.explanation : null,
      missing_evidence: Array.isArray(body.missingEvidence) ? body.missingEvidence : null,
      eligible: typeof body.eligible === 'boolean' ? body.eligible : false,
      blockers: Array.isArray(body.blockers) ? body.blockers : null,
      unknowns: Array.isArray(body.unknowns) ? body.unknowns : null,
      evidence: Array.isArray(body.evidence) ? body.evidence : null,
      created_at: new Date().toISOString(),
    };
    await (await getDatabase()).collection<MatchDocument>(TABLE).insertOne(match);
    return this.toRow(match);
  }

  private toRow(match: MatchDocument): MatchRow {
    const { _id, ...data } = match;
    return { ...data, id: _id };
  }
}

export const matchService = new MatchService();