import type { CandidateProfile, LocalResume } from './localDataStore.js';

export type QuestionCategory =
  | 'contact_info'
  | 'experience_years'
  | 'skill_verification'
  | 'work_authorization'
  | 'salary_expectation'
  | 'availability'
  | 'education'
  | 'subjective_behavioral'
  | 'unknown';

export interface GroundedAnswerResult {
  question: string;
  category: QuestionCategory;
  suggestedAnswer: string | null;
  confidence: number; // 0.0 to 1.0
  isGrounded: boolean;
  sourceField?: string;
  evidence?: string;
  requiresUserReview: boolean;
  status: 'ready' | 'needs_review' | 'manual_input_required' | 'unsupported';
  reason?: string;
}

export function classifyQuestion(questionText: string): QuestionCategory {
  const normalized = questionText.trim().toLowerCase();

  if (
    /full\s*(?:legal\s*)?name|legal\s*name|first\s*name|last\s*name|your\s*(?:legal\s*)?name|email|phone|mobile|phone\s*number|linkedin|github|portfolio|website/i.test(normalized)
  ) {
    return 'contact_info';
  }

  if (
    /sponsor|visa|work\s*authorization|legally\s*authorized|citizenship|green\s*card|require\s*sponsorship/i.test(normalized)
  ) {
    return 'work_authorization';
  }

  if (
    /salary|compensation|expected\s*ctc|current\s*ctc|hourly\s*rate|pay\s*expectation|remuneration/i.test(normalized)
  ) {
    return 'salary_expectation';
  }

  if (
    /notice\s*period|start\s*date|how\s*soon|availability|available\s*to\s*join|joining\s*date/i.test(normalized)
  ) {
    return 'availability';
  }

  if (
    /degree|university|college|gpa|graduation|education|major|bachelor|master|phd|diploma/i.test(normalized)
  ) {
    return 'education';
  }

  if (
    /how\s*many\s*years|years\s*(?:of\s+)?(?:professional\s+|work\s+)?experience|total\s*(?:years\s+of\s+)?experience|overall\s*experience|experience\s*level/i.test(normalized)
  ) {
    return 'experience_years';
  }

  if (
    /do\s*you\s*have\s*experience\s*(?:with|in)|proficien(?:t|cy)|skilled\s*in|knowledge\s*of|familiar\s*with/i.test(normalized) ||
    /(?:python|javascript|typescript|react|java|node|aws|docker|sql|c\+\+|c#|go|rust|mongodb|kubernetes)/i.test(normalized)
  ) {
    return 'skill_verification';
  }

  if (
    /why\s*(?:do\s*you\s*want|should\s*we\s*hire|join)|describe\s*a\s*time|tell\s*me\s*about|greatest\s*(?:strength|weakness)|cover\s*letter|what\s*excites\s*you/i.test(normalized)
  ) {
    return 'subjective_behavioral';
  }

  return 'unknown';
}

export function generateGroundedAnswer(
  question: string,
  profile: CandidateProfile | null,
  resumes: LocalResume[] = [],
): GroundedAnswerResult {
  const category = classifyQuestion(question);
  const normalizedQ = question.toLowerCase();

  // Guard: if no profile exists, cannot ground anything
  if (!profile) {
    return {
      question,
      category,
      suggestedAnswer: null,
      confidence: 0,
      isGrounded: false,
      requiresUserReview: true,
      status: 'unsupported',
      reason: 'No candidate profile is available to ground an answer.',
    };
  }

  switch (category) {
    case 'contact_info': {
      if (/full\s*(?:legal\s*)?name/i.test(normalizedQ) || /legal\s*name/i.test(normalizedQ) || /your\s*(?:legal\s*)?name/i.test(normalizedQ) || /full\s*name/i.test(normalizedQ) || /your\s*name/i.test(normalizedQ)) {
        if (profile.fullName) {
          return {
            question,
            category,
            suggestedAnswer: profile.fullName,
            confidence: 1.0,
            isGrounded: true,
            sourceField: 'fullName',
            requiresUserReview: false,
            status: 'ready',
          };
        }
      } else if (/first\s*name/i.test(normalizedQ)) {
        const firstName = profile.fullName ? profile.fullName.split(/\s+/)[0] : null;
        if (firstName) {
          return {
            question,
            category,
            suggestedAnswer: firstName,
            confidence: 0.95,
            isGrounded: true,
            sourceField: 'fullName[0]',
            requiresUserReview: false,
            status: 'ready',
          };
        }
      } else if (/last\s*name/i.test(normalizedQ)) {
        const parts = profile.fullName ? profile.fullName.split(/\s+/) : [];
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
        if (lastName) {
          return {
            question,
            category,
            suggestedAnswer: lastName,
            confidence: 0.95,
            isGrounded: true,
            sourceField: 'fullName[last]',
            requiresUserReview: false,
            status: 'ready',
          };
        }
      } else if (/email/i.test(normalizedQ)) {
        if (profile.email) {
          return {
            question,
            category,
            suggestedAnswer: profile.email,
            confidence: 1.0,
            isGrounded: true,
            sourceField: 'email',
            requiresUserReview: false,
            status: 'ready',
          };
        }
      } else if (/phone|mobile/i.test(normalizedQ)) {
        if (profile.phone) {
          return {
            question,
            category,
            suggestedAnswer: profile.phone,
            confidence: 1.0,
            isGrounded: true,
            sourceField: 'phone',
            requiresUserReview: false,
            status: 'ready',
          };
        }
      }
      return {
        question,
        category,
        suggestedAnswer: null,
        confidence: 0,
        isGrounded: false,
        requiresUserReview: true,
        status: 'needs_review',
        reason: 'Contact detail not found in candidate profile.',
      };
    }

    case 'experience_years': {
      if (profile.experienceYears !== null && profile.experienceYears !== undefined) {
        return {
          question,
          category,
          suggestedAnswer: `${profile.experienceYears}`,
          confidence: 0.95,
          isGrounded: true,
          sourceField: 'experienceYears',
          requiresUserReview: false,
          status: 'ready',
        };
      }
      return {
        question,
        category,
        suggestedAnswer: null,
        confidence: 0,
        isGrounded: false,
        requiresUserReview: true,
        status: 'needs_review',
        reason: 'Candidate experience years not specified in profile.',
      };
    }

    case 'skill_verification': {
      const candidateSkills = (profile.skills || []).map((s) => s.toLowerCase());
      // Look for skill name mentioned in the question
      const allResumeSkills = resumes.flatMap((r) => r.skills || []);
      for (const skill of candidateSkills) {
        if (normalizedQ.includes(skill)) {
          const matchingResumeSkill = allResumeSkills.find(
            (rs) => rs.skill.toLowerCase() === skill,
          );
          return {
            question,
            category,
            suggestedAnswer: 'Yes',
            confidence: 0.95,
            isGrounded: true,
            sourceField: `skills[${skill}]`,
            evidence: matchingResumeSkill?.evidence || `Listed in profile skills: ${skill}`,
            requiresUserReview: false,
            status: 'ready',
          };
        }
      }
      // If we could not match any positive skill, do not invent
      return {
        question,
        category,
        suggestedAnswer: null,
        confidence: 0,
        isGrounded: false,
        requiresUserReview: true,
        status: 'needs_review',
        reason: 'Specific skill was not verified in candidate profile or resume.',
      };
    }

    case 'work_authorization':
    case 'salary_expectation':
    case 'subjective_behavioral': {
      // STRICT SAFETY GATE: Never fabricate answers to legal, financial, or personal subjective questions!
      return {
        question,
        category,
        suggestedAnswer: null,
        confidence: 0,
        isGrounded: false,
        requiresUserReview: true,
        status: 'manual_input_required',
        reason:
          category === 'work_authorization'
            ? 'Legal work authorization and visa sponsorship questions require candidate personal attestation.'
            : category === 'salary_expectation'
              ? 'Compensation expectations must be provided directly by the candidate.'
              : 'Subjective questions require personal expression and must not be AI-fabricated.',
      };
    }

    case 'availability':
    case 'education':
    case 'unknown':
    default: {
      return {
        question,
        category,
        suggestedAnswer: null,
        confidence: 0,
        isGrounded: false,
        requiresUserReview: true,
        status: 'manual_input_required',
        reason: 'Question requires specific candidate information not stored in profile.',
      };
    }
  }
}
