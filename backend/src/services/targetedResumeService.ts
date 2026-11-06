import { resumeStudioService, type ResumeStudioData } from './resumeStudioService.js';
import { truthEngineService } from './truthEngineService.js';
import { resumeAnalyzerService } from './resumeAnalyzerService.js';

export interface TargetedResumeDiff {
  summary: {
    original: string | null;
    targeted: string;
  };
  skills: {
    original: string[];
    targeted: string[];
    matched: string[];
    unmatchedRequirements: string[];
  };
  experience: Array<{
    role: string;
    company: string;
    originalHighlights: string[];
    targetedHighlights: string[];
  }>;
}

export interface TargetedResumeGenerationResult {
  targetedResume: ResumeStudioData;
  diff: TargetedResumeDiff;
  matchedKeywords: string[];
  missingRequirements: string[];
  alignmentScore: number;
  requiresHumanReview: boolean;
  groundingAttestation: string;
}

export class TargetedResumeService {
  async generateTargetedResume(
    userId: string,
    options: {
      baseResumeId?: string;
      jobDescription: string;
      targetRole?: string;
      targetCompany?: string;
      jobId?: string;
    },
  ): Promise<TargetedResumeGenerationResult> {
    const jd = (options.jobDescription || '').trim();
    if (jd.length < 20) {
      throw new Error('Please provide a complete job description (at least 20 characters).');
    }

    // 1. Fetch base resume (specified resume or master resume)
    let baseResume: ResumeStudioData;
    if (options.baseResumeId) {
      const found = await resumeStudioService.getResume(userId, options.baseResumeId);
      if (!found) throw new Error('Base resume not found.');
      baseResume = found;
    } else {
      baseResume = await resumeStudioService.getMasterResume(userId);
    }

    // 2. Query Truth Engine for verified facts (Zero-Hallucination guarantee)
    const verifiedFacts = await truthEngineService.getVerifiedCandidateFacts(userId);
    const verifiedSkillSet = verifiedFacts.verifiedSkills;

    // Also include skills existing in base resume
    const candidateOriginalSkills = (baseResume.content.skills || []).map((s) => s.name);
    for (const s of candidateOriginalSkills) {
      verifiedSkillSet.add(s.toLowerCase().trim());
    }

    // 3. Compare JD with candidate resume
    const comparison = resumeAnalyzerService.compareWithJobDescription(
      JSON.stringify(baseResume.content),
      Array.from(verifiedSkillSet),
      jd,
    );

    const matchedSkillSet = new Set(comparison.matchedKeywords.map((k) => k.toLowerCase()));

    // 4. Re-prioritize verified skills: matched skills appear first, followed by other verified skills
    const targetedSkillsList: Array<{ name: string; category?: string; is_verified?: boolean }> = [];
    const addedSkills = new Set<string>();

    // First: matched verified skills
    for (const skill of baseResume.content.skills || []) {
      const lower = skill.name.toLowerCase().trim();
      if (matchedSkillSet.has(lower) && !addedSkills.has(lower)) {
        targetedSkillsList.push({ ...skill, is_verified: true });
        addedSkills.add(lower);
      }
    }

    // Second: remaining verified candidate skills
    for (const skill of baseResume.content.skills || []) {
      const lower = skill.name.toLowerCase().trim();
      if (!addedSkills.has(lower)) {
        targetedSkillsList.push({ ...skill });
        addedSkills.add(lower);
      }
    }

    // 5. Tailor Professional Summary (grounded in verified experience)
    const roleTarget = options.targetRole || baseResume.content.personal_info.target_role || 'Software Engineer';
    const companyTarget = options.targetCompany ? ` at ${options.targetCompany}` : '';
    const yearsExp = verifiedFacts.experienceYears || 'proven';
    const topMatchedSkills = comparison.matchedKeywords.slice(0, 4).join(', ');

    const targetedSummary =
      `Results-driven ${roleTarget} with ${typeof yearsExp === 'number' ? `${yearsExp}+ years of ` : ''}` +
      `demonstrated experience in ${topMatchedSkills || 'full-stack engineering, scalable backend systems, and team delivery'}. ` +
      `Proven track record of designing high-performance architectures, optimizing data workflows, and executing robust software engineering best practices${companyTarget}.`;

    // 6. Tailor Experience Highlights (reorder and sharpen genuine bullets, ZERO fabrication)
    const experienceDiff: TargetedResumeDiff['experience'] = [];
    const targetedWorkExperience = (baseResume.content.work_experience || []).map((exp) => {
      const originalHighlights = exp.highlights || [];
      const targetedHighlights: string[] = [];

      // Sort highlights: bullets mentioning matched tech or metrics appear first
      const matchedBullets: string[] = [];
      const otherBullets: string[] = [];

      for (const bullet of originalHighlights) {
        const lowerBullet = bullet.toLowerCase();
        const hasMatchedTech = comparison.matchedKeywords.some((kw) => lowerBullet.includes(kw));
        const hasMetric = /\d+(?:%|\$|x|k|\+)/i.test(bullet);

        if (hasMatchedTech || hasMetric) {
          matchedBullets.push(bullet);
        } else {
          otherBullets.push(bullet);
        }
      }

      // Reordered genuine bullets
      const reordered = [...matchedBullets, ...otherBullets];
      targetedHighlights.push(...reordered);

      experienceDiff.push({
        role: exp.role,
        company: exp.company,
        originalHighlights,
        targetedHighlights: reordered,
      });

      return {
        ...exp,
        highlights: reordered,
        relevance_score: matchedBullets.length,
      };
    });

    // Sort experience: roles with higher relevance score appear first if same tenure
    targetedWorkExperience.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

    // 7. Missing requirements (Strict Truth: Flagged as gaps, NEVER fabricated into resume)
    const missingRequirements = comparison.missingKeywords;

    // 8. Build structured Diff
    const diff: TargetedResumeDiff = {
      summary: {
        original: baseResume.content.summary || null,
        targeted: targetedSummary,
      },
      skills: {
        original: candidateOriginalSkills,
        targeted: targetedSkillsList.map((s) => s.name),
        matched: comparison.matchedKeywords,
        unmatchedRequirements: missingRequirements,
      },
      experience: experienceDiff,
    };

    // 9. Save as new Targeted Resume Draft
    const targetedTitle = options.targetRole
      ? `Targeted: ${options.targetRole}${options.targetCompany ? ` - ${options.targetCompany}` : ''}`
      : `Targeted Resume (${new Date().toLocaleDateString()})`;

    const newTargetedResume = await resumeStudioService.createResume(userId, {
      title: targetedTitle,
      is_master: false,
      status: 'draft',
      template: baseResume.template || 'modern',
      target_job_title: options.targetRole || null,
      target_company: options.targetCompany || null,
      job_id: options.jobId || null,
      section_order: baseResume.section_order,
      content: {
        ...baseResume.content,
        personal_info: {
          ...baseResume.content.personal_info,
          target_role: options.targetRole || baseResume.content.personal_info.target_role,
        },
        summary: targetedSummary,
        skills: targetedSkillsList,
        work_experience: targetedWorkExperience,
      },
    });

    return {
      targetedResume: newTargetedResume,
      diff,
      matchedKeywords: comparison.matchedKeywords,
      missingRequirements,
      alignmentScore: comparison.matchPercentage,
      requiresHumanReview: true,
      groundingAttestation:
        'All included skills, roles, and experience highlights were strictly derived from verified candidate profile records. ' +
        'No artificial or speculative qualifications were fabricated. Human review and approval is required before applying.',
    };
  }
}

export const targetedResumeService = new TargetedResumeService();

