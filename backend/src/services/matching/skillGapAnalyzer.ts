import { getDatabase } from '../../config/mongodb.js';
import { normalizeSkill } from './skillTaxonomy.js';
import type { SkillGapItem } from './types.js';

export interface SkillGapAnalysisResult {
  candidate_id: string;
  target_roles: string[];
  total_jobs_analyzed: number;
  top_missing_skills: SkillGapItem[];
  verified_candidate_skills: string[];
  suggested_learning_priorities: Array<{
    skill: string;
    importance: 'high' | 'medium';
    job_mention_percentage: number;
    recommended_action: string;
  }>;
  disclaimer: string;
}

export class SkillGapAnalyzer {
  async analyzeGapsForCandidate(
    candidateId: string,
    candidateSkills: string[],
    targetRoles: string[],
    verifiedSkills: string[] = [],
  ): Promise<SkillGapAnalysisResult> {
    const db = await getDatabase();
    const candidateSkillSet = new Set(
      candidateSkills.map((s) => normalizeSkill(s).toLowerCase()),
    );
    const verifiedSet = new Set(
      verifiedSkills.map((s) => normalizeSkill(s).toLowerCase()),
    );

    // Find active jobs matching any target role, or fallback to all active jobs
    const filter: any = { status: { $in: ['active', null, undefined] } };
    if (targetRoles.length > 0) {
      filter.$or = targetRoles.map((role) => ({
        $or: [
          { job_title: { $regex: role, $options: 'i' } },
          { title: { $regex: role, $options: 'i' } },
        ],
      }));
    }

    const jobs = await db
      .collection<any>('jobs')
      .find(filter)
      .limit(100)
      .toArray();

    const skillDemand = new Map<string, { count: number; canonical: string; isRequired: boolean }>();

    for (const job of jobs) {
      const required = job.required_skills || job.skills || [];
      const preferred = job.preferred_skills || [];

      for (const skill of required) {
        const canonical = normalizeSkill(skill);
        const lower = canonical.toLowerCase();
        const existing = skillDemand.get(lower) || { count: 0, canonical, isRequired: true };
        existing.count++;
        existing.isRequired = true;
        skillDemand.set(lower, existing);
      }

      for (const skill of preferred) {
        const canonical = normalizeSkill(skill);
        const lower = canonical.toLowerCase();
        if (!skillDemand.has(lower)) {
          skillDemand.set(lower, { count: 1, canonical, isRequired: false });
        } else {
          skillDemand.get(lower)!.count++;
        }
      }
    }

    const missingGaps: SkillGapItem[] = [];

    for (const [lower, data] of skillDemand.entries()) {
      const candidateHas = candidateSkillSet.has(lower);
      if (!candidateHas) {
        missingGaps.push({
          skill: data.canonical,
          canonical: data.canonical,
          demand_count: data.count,
          importance: data.isRequired ? 'required' : 'preferred',
          candidate_has_skill: false,
          suggested_action: data.isRequired
            ? `High priority: ${data.canonical} appears in ${data.count} target postings.`
            : `Recommended bonus: ${data.canonical} frequently listed as preferred.`,
        });
      }
    }

    // Sort by demand count descending
    missingGaps.sort((a, b) => b.demand_count - a.demand_count);

    const totalJobs = Math.max(1, jobs.length);
    const topMissing = missingGaps.slice(0, 10);

    const learningPriorities = topMissing.map((gap) => ({
      skill: gap.canonical,
      importance: (gap.importance === 'required' ? 'high' : 'medium') as 'high' | 'medium',
      job_mention_percentage: Math.round((gap.demand_count / totalJobs) * 100),
      recommended_action: `Build a demonstrable portfolio project or complete verifiable hands-on practice in ${gap.canonical}.`,
    }));

    return {
      candidate_id: candidateId,
      target_roles: targetRoles,
      total_jobs_analyzed: jobs.length,
      top_missing_skills: topMissing,
      verified_candidate_skills: Array.from(verifiedSet),
      suggested_learning_priorities: learningPriorities,
      disclaimer:
        'Skills gap analytics reflect current job market posting demands. Developing these skills strengthens eligibility qualification but does not guarantee employment offers.',
    };
  }
}

export const skillGapAnalyzer = new SkillGapAnalyzer();

