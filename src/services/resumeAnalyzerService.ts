export interface ATSScoreCategory {
  name: string;
  maxScore: number;
  earnedScore: number;
  status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  feedback: string[];
}

export interface ATSDiagnosticResult {
  overallScore: number; // 0 - 100
  rating: 'Exceptional' | 'Competitive' | 'Needs Optimization' | 'Critical Gaps';
  disclaimer: string;
  categories: {
    contactInfo: ATSScoreCategory;
    sectionHeadings: ATSScoreCategory;
    quantifiableImpact: ATSScoreCategory;
    actionPhrasing: ATSScoreCategory;
    cleanFormatting: ATSScoreCategory;
  };
  detectedSections: string[];
  missingRecommendedSections: string[];
  metricsFound: string[];
  actionVerbsFound: string[];
  readability: {
    totalWords: number;
    bulletCount: number;
    avgBulletLengthChars: number;
    hardToReadBulletsCount: number;
  };
  recommendations: string[];
}

export interface JDKeywordMatch {
  keyword: string;
  category: 'skill' | 'qualification' | 'experience' | 'domain';
  foundInResume: boolean;
  frequencyInJD: number;
}

export interface JDComparisonResult {
  matchPercentage: number;
  matchedCount: number;
  totalRequiredKeywords: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  detailedKeywords: JDKeywordMatch[];
  keywordDensityWarning?: string | null;
  recommendations: string[];
}

const ACTION_VERBS = [
  'accelerated', 'achieved', 'architected', 'automated', 'built', 'championed', 'composed',
  'conceptualized', 'consolidated', 'constructed', 'coordinated', 'decreased', 'delivered',
  'deployed', 'designed', 'developed', 'devised', 'directed', 'doubled', 'eliminated',
  'engineered', 'enhanced', 'established', 'executed', 'expanded', 'expedited', 'formulated',
  'generated', 'governed', 'guided', 'implemented', 'improved', 'increased', 'initiated',
  'innovated', 'instituted', 'integrated', 'invented', 'launched', 'led', 'managed',
  'maximized', 'mentored', 'migrated', 'minimized', 'modernized', 'negotiated', 'optimized',
  'orchestrated', 'overhauled', 'pioneered', 'produced', 'programmed', 'reduced', 'refactored',
  'resolved', 'restructured', 'revamped', 'scaled', 'simplified', 'spearheaded', 'standardized',
  'streamlined', 'strengthened', 'surpassed', 'transformed', 'upgraded', 'yielded'
];

const STANDARD_SECTIONS = [
  { key: 'summary', patterns: [/^(summary|professional summary|profile|about me|career objective)$/i] },
  { key: 'experience', patterns: [/^(experience|work experience|employment history|professional experience|career history)$/i] },
  { key: 'education', patterns: [/^(education|academic background|qualifications|academic history)$/i] },
  { key: 'skills', patterns: [/^(skills|technical skills|core competencies|areas of expertise|technologies)$/i] },
  { key: 'projects', patterns: [/^(projects|personal projects|key projects|technical projects)$/i] },
  { key: 'certifications', patterns: [/^(certifications|licenses|certifications and licenses|credentials)$/i] },
];

export class ResumeAnalyzerService {
  /**
   * Performs deep heuristic ATS diagnostic analysis on resume text and structure.
   */
  diagnoseATS(resumeText: string, metadata?: { skills?: string[]; sections?: Record<string, unknown> }): ATSDiagnosticResult {
    const text = resumeText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const words = text.split(/\s+/).filter(Boolean);

    // 1. Contact Information Evaluation (20 pts)
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
    const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    const githubMatch = text.match(/github\.com\/[a-zA-Z0-9_-]+/i);
    const locationMatch = text.match(/\b([A-Z][a-zA-Z\s]+,\s*[A-Z]{2,}|Bengaluru|San Francisco|New York|London|Toronto|Remote)\b/i);

    let contactScore = 0;
    const contactFeedback: string[] = [];
    if (emailMatch) { contactScore += 5; } else { contactFeedback.push('Missing professional email address.'); }
    if (phoneMatch) { contactScore += 5; } else { contactFeedback.push('Missing direct phone number with country code.'); }
    if (linkedinMatch || githubMatch) { contactScore += 5; } else { contactFeedback.push('Include a LinkedIn or GitHub profile link for technical verification.'); }
    if (locationMatch || lines.length > 2) { contactScore += 5; } else { contactFeedback.push('Add current city and country.'); }

    const contactCategory: ATSScoreCategory = {
      name: 'Contact Information Completeness',
      maxScore: 20,
      earnedScore: contactScore,
      status: contactScore >= 18 ? 'excellent' : contactScore >= 12 ? 'good' : 'needs_improvement',
      feedback: contactFeedback.length ? contactFeedback : ['Contact details are complete and ATS-parseable.'],
    };

    // 2. Standard Section Headings Evaluation (20 pts)
    const detectedSections: string[] = [];
    const missingSections: string[] = [];

    for (const sec of STANDARD_SECTIONS) {
      const isDetected = lines.some((line) => sec.patterns.some((p) => p.test(line)));
      if (isDetected) {
        detectedSections.push(sec.key);
      } else {
        missingSections.push(sec.key);
      }
    }

    let headingsScore = 0;
    const headingFeedback: string[] = [];
    // Experience, Education, Skills are high priority (5 pts each); Summary, Projects (2.5 pts each)
    if (detectedSections.includes('experience')) headingsScore += 6;
    else headingFeedback.push('Add a clearly titled "Work Experience" section.');

    if (detectedSections.includes('education')) headingsScore += 5;
    else headingFeedback.push('Add an "Education" section.');

    if (detectedSections.includes('skills')) headingsScore += 5;
    else headingFeedback.push('Add a dedicated "Technical Skills" section.');

    if (detectedSections.includes('summary') || detectedSections.includes('projects')) headingsScore += 4;
    else headingFeedback.push('Consider adding a concise professional summary or projects section.');

    const headingsCategory: ATSScoreCategory = {
      name: 'Standard Section Headings',
      maxScore: 20,
      earnedScore: Math.min(20, headingsScore),
      status: headingsScore >= 18 ? 'excellent' : headingsScore >= 14 ? 'good' : 'needs_improvement',
      feedback: headingFeedback.length ? headingFeedback : ['Standard headings allow accurate automated section extraction.'],
    };

    // 3. Quantifiable Impact & Metrics (20 pts)
    // Detect numbers with %, $, ₹, x, k, M, etc.
    const metricRegex = /\b(\d+(?:\.\d+)?%\s*|\$\d+(?:,\d+)*(?:\.\d+)?[kKmMbB]?\s*|₹\d+(?:,\d+)*(?:\.\d+)?[kKmMbB]?\s*|\d+x\b|\b\d+\s*\+\s*(?:users|clients|engineers|microservices|transactions|projects|years))\b/gi;
    const metricMatches = Array.from(new Set(text.match(metricRegex) || [])).slice(0, 10);

    let impactScore = 0;
    const impactFeedback: string[] = [];
    if (metricMatches.length >= 5) {
      impactScore = 20;
    } else if (metricMatches.length >= 3) {
      impactScore = 15;
      impactFeedback.push(`Found ${metricMatches.length} quantifiable metrics. Add more data (e.g., latency reduction, team size, revenue).`);
    } else if (metricMatches.length >= 1) {
      impactScore = 10;
      impactFeedback.push('Only 1-2 metrics found. Resumes with measurable results achieve significantly higher interview conversion.');
    } else {
      impactScore = 4;
      impactFeedback.push('No measurable metrics detected. Express accomplishments with numbers, percentages, or scale.');
    }

    const impactCategory: ATSScoreCategory = {
      name: 'Quantifiable Impact & Metrics',
      maxScore: 20,
      earnedScore: impactScore,
      status: impactScore >= 18 ? 'excellent' : impactScore >= 12 ? 'good' : 'poor',
      feedback: impactFeedback.length ? impactFeedback : ['Strong quantifiable metrics demonstrate measurable career impact.'],
    };

    // 4. Action-Oriented Phrasing & Power Verbs (20 pts)
    const lowerText = text.toLowerCase();
    const foundVerbs: string[] = [];
    for (const verb of ACTION_VERBS) {
      const verbRegex = new RegExp(`\\b${verb}\\b`, 'i');
      if (verbRegex.test(lowerText)) {
        foundVerbs.push(verb);
      }
    }

    let phrasingScore = 0;
    const phrasingFeedback: string[] = [];
    if (foundVerbs.length >= 8) {
      phrasingScore = 20;
    } else if (foundVerbs.length >= 5) {
      phrasingScore = 15;
      phrasingFeedback.push(`Detected ${foundVerbs.length} action verbs. Begin every experience bullet with strong active verbs.`);
    } else if (foundVerbs.length >= 2) {
      phrasingScore = 10;
      phrasingFeedback.push('Limited action verbs found. Replace passive phrasing (e.g., "Responsible for") with direct power verbs.');
    } else {
      phrasingScore = 4;
      phrasingFeedback.push('Lacks strong action verbs. Highlight leadership, architectural impact, and delivery.');
    }

    const phrasingCategory: ATSScoreCategory = {
      name: 'Action-Oriented Phrasing',
      maxScore: 20,
      earnedScore: phrasingScore,
      status: phrasingScore >= 18 ? 'excellent' : phrasingScore >= 12 ? 'good' : 'poor',
      feedback: phrasingFeedback.length ? phrasingFeedback : ['Excellent use of varied action verbs throughout experience bullets.'],
    };

    // 5. Clean Formatting & Parseability (20 pts)
    const bulletLines = lines.filter((l) => /^[-*•·▪]\s+/.test(l) || /^\d+\.\s+/.test(l));
    const longBullets = bulletLines.filter((b) => b.length > 250);
    const shortBullets = bulletLines.filter((b) => b.length < 25);

    let formatScore = 20;
    const formatFeedback: string[] = [];

    if (words.length < 150) {
      formatScore -= 8;
      formatFeedback.push('Resume is very short (under 150 words). Provide detailed technical experience.');
    } else if (words.length > 1200) {
      formatScore -= 4;
      formatFeedback.push('Resume exceeds 1,200 words. Aim for 400-800 words for optimal 1-2 page conciseness.');
    }

    if (longBullets.length > 3) {
      formatScore -= 4;
      formatFeedback.push(`${longBullets.length} bullet points exceed 250 characters. Break long paragraphs into crisp bullets.`);
    }

    const cleanFormattingCategory: ATSScoreCategory = {
      name: 'Clean Formatting & Parseability',
      maxScore: 20,
      earnedScore: Math.max(0, formatScore),
      status: formatScore >= 18 ? 'excellent' : formatScore >= 12 ? 'good' : 'needs_improvement',
      feedback: formatFeedback.length ? formatFeedback : ['Text layout is clean and parses reliably without overflow.'],
    };

    // Overall Score Calculation
    const overallScore = Math.round(
      contactCategory.earnedScore +
      headingsCategory.earnedScore +
      impactCategory.earnedScore +
      phrasingCategory.earnedScore +
      cleanFormattingCategory.earnedScore,
    );

    let rating: ATSDiagnosticResult['rating'] = 'Needs Optimization';
    if (overallScore >= 85) rating = 'Exceptional';
    else if (overallScore >= 70) rating = 'Competitive';
    else if (overallScore >= 50) rating = 'Needs Optimization';
    else rating = 'Critical Gaps';

    const recommendations: string[] = [
      ...contactCategory.feedback,
      ...headingsCategory.feedback,
      ...impactCategory.feedback,
      ...phrasingCategory.feedback,
      ...cleanFormattingCategory.feedback,
    ].filter((f) => !f.includes('Excellent') && !f.includes('complete and ATS-parseable') && !f.includes('Strong quantifiable'));

    return {
      overallScore,
      rating,
      disclaimer:
        'This diagnostic score is an internal algorithmic heuristic based on industry ATS parsing benchmarks. ' +
        'No third-party ATS (such as Workday, Greenhouse, or Lever) exposes public scoring APIs; ' +
        'do not treat any score as an external platform guarantee.',
      categories: {
        contactInfo: contactCategory,
        sectionHeadings: headingsCategory,
        quantifiableImpact: impactCategory,
        actionPhrasing: phrasingCategory,
        cleanFormatting: cleanFormattingCategory,
      },
      detectedSections,
      missingRecommendedSections: missingSections,
      metricsFound: metricMatches,
      actionVerbsFound: foundVerbs.slice(0, 15),
      readability: {
        totalWords: words.length,
        bulletCount: bulletLines.length,
        avgBulletLengthChars:
          bulletLines.length > 0
            ? Math.round(bulletLines.reduce((acc, b) => acc + b.length, 0) / bulletLines.length)
            : 0,
        hardToReadBulletsCount: longBullets.length,
      },
      recommendations: recommendations.slice(0, 6),
    };
  }

  /**
   * Compares candidate resume text and skills with a target Job Description.
   */
  compareWithJobDescription(
    resumeText: string,
    candidateSkills: string[],
    jobDescription: string,
  ): JDComparisonResult {
    const jdLower = (jobDescription || '').toLowerCase();
    const resumeLower = (resumeText || '').toLowerCase();
    const skillSetLower = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));

    // Expanded technical keyword registry for detection
    const KEYWORD_REGISTRY = [
      'typescript', 'javascript', 'python', 'java', 'c++', 'c#', 'golang', 'rust', 'ruby', 'php',
      'react', 'next.js', 'angular', 'vue', 'node.js', 'express', 'fastapi', 'django', 'flask',
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
      'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform', 'ci/cd',
      'graphql', 'rest api', 'microservices', 'distributed systems', 'kafka', 'rabbitmq',
      'machine learning', 'deep learning', 'pandas', 'pytorch', 'tensorflow', 'llm', 'genai',
      'agile', 'scrum', 'system design', 'tdd', 'unit testing', 'linux', 'git'
    ];

    const detailedKeywords: JDKeywordMatch[] = [];
    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    for (const kw of KEYWORD_REGISTRY) {
      // Check if keyword is required/mentioned in the Job Description
      const kwRegex = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i');
      if (kwRegex.test(jdLower)) {
        // Count frequency in JD
        const matches = jdLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
        const freq = matches ? matches.length : 1;

        // Check if candidate has it in resume text or verified skill list
        const inResume = kwRegex.test(resumeLower) || skillSetLower.has(kw);

        detailedKeywords.push({
          keyword: kw,
          category: 'skill',
          foundInResume: inResume,
          frequencyInJD: freq,
        });

        if (inResume) {
          matchedKeywords.push(kw);
        } else {
          missingKeywords.push(kw);
        }
      }
    }

    const totalRequired = detailedKeywords.length;
    const matchPercentage =
      totalRequired > 0 ? Math.round((matchedKeywords.length / totalRequired) * 100) : 100;

    const recommendations: string[] = [];
    if (missingKeywords.length > 0) {
      recommendations.push(
        `Job description requires: ${missingKeywords.slice(0, 5).join(', ')}. If you possess genuine experience with any of these, highlight them in your verified skills or project highlights.`,
      );
    }
    if (matchPercentage < 50) {
      recommendations.push('Low keyword alignment detected. Tailor your resume summary and bullet points to emphasize relevant genuine projects.');
    } else {
      recommendations.push('Strong core technical alignment. Ensure your impact metrics clearly highlight your role in delivering these technologies.');
    }

    return {
      matchPercentage,
      matchedCount: matchedKeywords.length,
      totalRequiredKeywords: totalRequired,
      matchedKeywords,
      missingKeywords,
      detailedKeywords,
      recommendations,
    };
  }
}

export const resumeAnalyzerService = new ResumeAnalyzerService();

