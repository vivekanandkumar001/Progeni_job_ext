import { getDatabase } from '../config/mongodb.js';
const TABLE = 'candidate_profiles';

export interface CoverLetterRequest {
  jobTitle: string;
  company: string;
  jobDescription: string;
  candidateSkills: string[];
  candidateExperience: number | null;
  candidateTargetRole: string | null;
}

export interface CoverLetterResponse {
  success: boolean;
  coverLetter?: string;
  error?: string;
  sections?: {
    introduction?: string;
    qualifications?: string;
    experience?: string;
    motivation?: string;
    closing?: string;
  };
}

export class CoverLetterService {
  async generate(request: CoverLetterRequest): Promise<CoverLetterResponse> {
    try {
      // Validate inputs
      if (!request.jobDescription.trim()) {
        return { success: false, error: 'Job description is required.' };
      }
      if (!request.candidateSkills || request.candidateSkills.length === 0) {
        return { success: false, error: 'Candidate skills are required.' };
      }

      // Extract key points from job description
      const keyRequirements = this.extractKeyRequirements(request.jobDescription);
      const candidateExperienceText = request.candidateExperience !== null
        ? `${request.candidateExperience}+ years`
        : 'relevant experience';

      // Build the cover letter using structured template
      const coverLetter = this.buildCoverLetter({
        company: request.company,
        jobTitle: request.jobTitle,
        keyRequirements,
        candidateExperience: candidateExperienceText,
        candidateTargetRole: request.candidateTargetRole || '',
        skills: request.candidateSkills,
      });

      return {
        success: true,
        coverLetter,
      };
    } catch (error) {
      console.error('Cover letter generation error:', error);
      return {
        success: false,
        error: 'Failed to generate cover letter. Please try again.',
      };
    }
  }

  private extractKeyRequirements(jobDescription: string): string[] {
    const text = jobDescription.toLowerCase();
    const requirements: string[] = [];

    // Common patterns for job requirements
    const patterns = [
      /(\d+(?:\+)?\s*years?\s*of\s*experience)/i,
      /(mandatory|required|must have)\s+(skills|qualifications)/i,
      /(preferred|nice to have)/i,
      /(bachelor|master|degree|education)/i,
      /(certification|certified)/i,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        requirements.push(matches[0]);
      }
    }

    // If no patterns matched, return generic requirements
    if (requirements.length === 0) {
      requirements.push('Relevant industry experience');
      requirements.push('Technical skills in requested technologies');
      requirements.push('Strong communication and problem-solving abilities');
    }

    return requirements.slice(0, 5); // Limit to 5 key requirements
  }

  private buildCoverLetter(params: {
    company: string;
    jobTitle: string;
    keyRequirements: string[];
    candidateExperience: string;
    candidateTargetRole: string;
    skills: string[];
  }): string {
    const { company, jobTitle, keyRequirements, candidateExperience, candidateTargetRole, skills } = params;

    // Format skills as a concise list
    const formattedSkills = skills.slice(0, 5).join(', ');

    // Determine the opening based on whether we have a target role
    const opening = candidateTargetRole
      ? `I am writing to express my strong interest in the ${jobTitle} position at ${company}.`
      : `I am writing to express my strong interest in the ${jobTitle} position at ${company}.`;

    // Build qualifications section
    const qualificationsSections = keyRequirements.map((req, index) => {
      // Try to match skill to requirement
      const matchingSkill = this.findMatchingSkill(req, skills);
      return `• ${req} - ${matchingSkill || 'my relevant experience'}`;
    }).join('\n');

    // Experience paragraph
    const experienceParagraph = `
During my ${candidateExperience} career, I have developed expertise in key areas relevant to this role. My background includes hands-on experience with technologies and methodologies that align with the requirements for this position. I have successfully contributed to projects that required ${candidateExperience.toLowerCase()} dedication and results-oriented approach.
`;

    // Motivation section
    const motivation = `
I am particularly drawn to this opportunity at ${company} because of the company's reputation for excellence and innovation in the industry. The chance to contribute to ${company}'s mission while leveraging my skills in ${formattedSkills} aligns perfectly with my career goals and professional aspirations.
`;

    // Closing
    const closing = `
Thank you for considering my application. I am eager to discuss how my experience and passion for ${jobTitle} can contribute to ${company}'s continued success. I look forward to the possibility of discussing this opportunity further in an interview.

Sincerely,
[Your Name]
`;

    return `
${opening}

${candidateTargetRole ? `As a ${candidateTargetRole},` : ''}

${qualificationsSections}

${experienceParagraph}

${motivation}

${closing}
`.trim();
  }

  private findMatchingSkill(requirement: string, skills: string[]): string | null {
    const reqLower = requirement.toLowerCase();
    
    // Check if any skill appears in the requirement
    for (const skill of skills) {
      const skillLower = skill.toLowerCase();
      if (reqLower.includes(skillLower) || skillLower.includes(reqLower)) {
        return skill;
      }
    }
    
    // Check for common skill patterns
    const skillPatterns = {
      'python': /python/i,
      'javascript': /javascript|node\.?js|react/i,
      'java': /java/i,
      'sql': /sql|database/i,
      'aws': /aws|cloud/i,
      'git': /git|version control/i,
    };

    for (const [key, pattern] of Object.entries(skillPatterns)) {
      if (pattern.test(requirement) && skills.some(s => s.toLowerCase().includes(key))) {
        return key;
      }
    }

    return null;
  }
}

export const coverLetterService = new CoverLetterService();