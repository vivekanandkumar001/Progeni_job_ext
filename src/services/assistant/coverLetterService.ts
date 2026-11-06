import { randomUUID } from 'node:crypto';
import type { CoverLetterData, CoverLetterVersion } from './types.js';
import { truthEngineService } from '../truthEngineService.js';
import { resumeStudioService } from '../resumeStudioService.js';
import { candidateProfileService } from '../candidateProfileService.js';

export interface CoverLetterGenerateOptions {
  jobTitle: string;
  companyName: string;
  jobDescription?: string;
  tone?: 'professional' | 'concise' | 'technical' | 'enthusiastic';
  customInstructions?: string;
  existingData?: CoverLetterData;
}

export class CoverLetterService {
  async generateCoverLetter(
    userId: string,
    options: CoverLetterGenerateOptions,
  ): Promise<CoverLetterData> {
    const tone = options.tone || 'professional';
    const company = (options.companyName || 'the hiring team').trim();
    const role = (options.jobTitle || 'Software Engineer').trim();
    const jd = (options.jobDescription || '').toLowerCase();
    const customInstructions = options.customInstructions?.trim();

    // 1. Gather verified candidate evidence
    const [profile, verifiedFacts, masterResume] = await Promise.all([
      candidateProfileService.get(userId).catch(() => null),
      truthEngineService.getVerifiedCandidateFacts(userId).catch(() => ({
        verifiedSkills: new Set<string>(),
        experienceYears: null,
        topRole: null,
      })),
      resumeStudioService.getMasterResume(userId).catch(() => null),
    ]);

    const candidateName = profile?.full_name || masterResume?.content?.personal_info?.full_name || 'Candidate';
    const email = profile?.email || masterResume?.content?.personal_info?.email || '';
    const phone = profile?.phone || masterResume?.content?.personal_info?.phone || '';
    const location = profile?.location || (profile?.city ? `${profile.city}, ${profile.country || ''}` : '') || (masterResume?.content?.personal_info?.city ? `${masterResume.content.personal_info.city}, ${masterResume.content.personal_info.country || ''}` : '');

    // Extract top verified skills
    const verifiedSkillsList: string[] = Array.from(verifiedFacts.verifiedSkills || []);
    if (masterResume?.content?.skills) {
      for (const s of masterResume.content.skills) {
        if (!verifiedSkillsList.includes(s.name.toLowerCase())) {
          verifiedSkillsList.push(s.name);
        }
      }
    }

    // Match skills against JD
    const matchedSkills = verifiedSkillsList.filter((s: string) => jd.includes(s.toLowerCase()));
    const keySkills = matchedSkills.length > 0 ? matchedSkills.slice(0, 5) : verifiedSkillsList.slice(0, 5);
    const skillsString = keySkills.length > 0 ? keySkills.join(', ') : 'software engineering, robust problem-solving, and system delivery';

    // Extract most relevant work experience highlights
    const experiences = masterResume?.content?.work_experience || [];
    let topExperienceBullet = '';
    let recentCompany = '';
    let recentRole = '';

    if (experiences.length > 0) {
      const topExp = experiences[0];
      recentCompany = topExp.company;
      recentRole = topExp.role;

      // Find best bullet matching JD
      const matchedBullet = topExp.highlights?.find((h: string) =>
        keySkills.some((k: string) => h.toLowerCase().includes(k.toLowerCase())),
      );
      topExperienceBullet = matchedBullet || (topExp.highlights && topExp.highlights[0]) || '';
    }

    const years = verifiedFacts.experienceYears || profile?.experience_years || (experiences.length > 0 ? experiences.length * 2 : null);
    const yearsStr = years ? `${years}+ years of ` : '';

    // Compose letter based on tone
    let content = '';

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const headerBlock = `${candidateName}\n${email}${phone ? ` | ${phone}` : ''}${location ? ` | ${location}` : ''}\n${dateStr}\n\nHiring Team\n${company}\n\nRe: Application for ${role}\n\n`;

    if (tone === 'concise') {
      content =
        `${headerBlock}` +
        `Dear Hiring Manager,\n\n` +
        `I am writing to express my strong interest in the ${role} position at ${company}. With ${yearsStr}hands-on engineering experience specializing in ${skillsString}, I am eager to contribute immediately to your team's objectives.\n\n` +
        (recentRole && recentCompany
          ? `In my role as ${recentRole} at ${recentCompany}, I focused on delivering high-impact, reliable software. ${topExperienceBullet ? `Specifically, ${topExperienceBullet.toLowerCase().startsWith('led') || topExperienceBullet.toLowerCase().startsWith('built') || topExperienceBullet.toLowerCase().startsWith('developed') ? `I ${topExperienceBullet.charAt(0).toLowerCase() + topExperienceBullet.slice(1)}` : topExperienceBullet}` : ''}\n\n`
          : '') +
        (customInstructions ? `Key alignment for this role: ${customInstructions}\n\n` : '') +
        `I look forward to discussing how my background in ${skillsString} aligns with ${company}'s goals.\n\n` +
        `Sincerely,\n${candidateName}`;
    } else if (tone === 'technical') {
      content =
        `${headerBlock}` +
        `Dear Engineering Leadership,\n\n` +
        `I am writing to apply for the ${role} opening at ${company}. My engineering background centers on building performant, scalable, and resilient systems utilizing ${skillsString}.\n\n` +
        (recentRole && recentCompany
          ? `During my tenure as ${recentRole} at ${recentCompany}, I architected and implemented critical software components with a focus on code quality, modular architecture, and operational stability. ${topExperienceBullet ? `A notable achievement includes: ${topExperienceBullet}` : ''}\n\n`
          : `Throughout my career, I have prioritized robust engineering standards, automated test coverage, and continuous deployment practices.\n\n`) +
        (customInstructions ? `Technical focus: ${customInstructions}\n\n` : '') +
        `I admire ${company}'s engineering focus and would welcome the opportunity to dive into technical discussions regarding your architectural priorities.\n\n` +
        `Best regards,\n${candidateName}`;
    } else if (tone === 'enthusiastic') {
      content =
        `${headerBlock}` +
        `Dear ${company} Team,\n\n` +
        `I am thrilled to submit my application for the ${role} position at ${company}. Having followed your organization's impressive work, I am genuinely excited about the possibility of bringing my ${yearsStr}background in ${skillsString} to your mission.\n\n` +
        (recentRole && recentCompany
          ? `As ${recentRole} at ${recentCompany}, I thrived solving demanding technical problems and collaborating with cross-functional teams to exceed project goals. ${topExperienceBullet ? `One of my proudest milestones was when I ${topExperienceBullet.charAt(0).toLowerCase() + topExperienceBullet.slice(1)}` : ''}\n\n`
          : `I am deeply passionate about engineering excellence and creating meaningful user impact.\n\n`) +
        (customInstructions ? `Note: ${customInstructions}\n\n` : '') +
        `I would love the opportunity to share my enthusiasm and discuss how my expertise can support ${company}'s growth.\n\n` +
        `Warm regards,\n${candidateName}`;
    } else {
      // Professional (default)
      content =
        `${headerBlock}` +
        `Dear Hiring Manager,\n\n` +
        `Please accept this letter as an expression of my serious interest in the ${role} position at ${company}. With ${yearsStr}demonstrated experience in ${skillsString}, I have developed a strong foundation in designing, executing, and maintaining mission-critical software solutions.\n\n` +
        (recentRole && recentCompany
          ? `Most recently as ${recentRole} at ${recentCompany}, I have led and contributed to projects requiring high performance, team communication, and disciplined execution. ${topExperienceBullet ? `${topExperienceBullet}` : ''}\n\n`
          : `My career has centered on delivering dependable software and collaborating closely with engineering and product stakeholders.\n\n`) +
        (customInstructions ? `Regarding this application: ${customInstructions}\n\n` : '') +
        `Given the requirements outlined in the job description, I am confident that my practical experience and commitment to technical rigor make me a valuable candidate for ${company}.\n\n` +
        `Thank you for your time and consideration. I welcome the opportunity to discuss my qualifications in greater detail.\n\n` +
        `Sincerely,\n${candidateName}`;
    }

    const now = new Date().toISOString();
    const existing = options.existingData;
    const versionNumber = existing ? existing.version + 1 : 1;

    const currentVersionRecord: CoverLetterVersion = {
      version: versionNumber,
      tone,
      content,
      customInstructions,
      createdAt: now,
    };

    const versions = existing?.versions ? [...existing.versions, currentVersionRecord] : [currentVersionRecord];

    return {
      id: existing?.id || randomUUID(),
      version: versionNumber,
      tone,
      content,
      customInstructions,
      versions,
      updatedAt: now,
    };
  }

  exportToFormat(coverLetter: CoverLetterData, format: 'text' | 'markdown' | 'html'): string {
    const raw = coverLetter.content;
    if (format === 'text') return raw;
    if (format === 'markdown') {
      return `## Cover Letter\n\n${raw.replace(/\n\n/g, '\n\n')}`;
    }
    // HTML format
    const paragraphs = raw.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('\n');
    return `<div class="cover-letter-document">\n${paragraphs}\n</div>`;
  }
}

export const coverLetterService = new CoverLetterService();
