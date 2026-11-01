import { supabase } from '../config/supabase/client.js';

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
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('score', { ascending: false });
    if (error) throw new Error('Failed to list matches: ' + error.message);
    return data || [];
  }

  async get(id: string, userId: string): Promise<MatchRow | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error('Failed to fetch match: ' + error.message);
    return data || null;
  }

  async create(userId: string, body: CreateMatchInput): Promise<MatchRow> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
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
      })
      .select()
      .single();
    if (error) throw new Error('Failed to create match: ' + error.message);
    return data;
  }
}

export const matchService = new MatchService();