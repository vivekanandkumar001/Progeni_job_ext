import mammoth from 'mammoth';

export type ResumeFileType = 'pdf' | 'docx' | 'txt';

export interface ResumeSkillEvidence {
  skill: string;
  evidence: string;
}

export interface ResumeAnalysis {
  fileName: string;
  fileType: ResumeFileType;
  status: 'ready' | 'needs_review' | 'ocr_required';
  detected: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    experienceYears: number | null;
    experienceEvidence: string | null;
  };
  skills: ResumeSkillEvidence[];
  warnings: string[];
}

export class ResumeParseError extends Error {}

const SKILL_CATALOG = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby',
  'React', 'Next.js', 'Angular', 'Vue.js', 'Node.js', 'Express', 'FastAPI', 'Django', 'Flask',
  'HTML', 'CSS', 'Tailwind CSS', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
  'Machine Learning', 'Deep Learning', 'Data Analysis', 'Pandas', 'NumPy', 'scikit-learn',
  'TensorFlow', 'PyTorch', 'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Git',
  'Linux', 'REST API', 'GraphQL', 'Figma', 'Excel', 'Power BI', 'Tableau',
];

function extractText(text: string): Omit<ResumeAnalysis, 'fileName' | 'fileType' | 'status' | 'warnings'> {
  const normalized = text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phoneMatch = normalized.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  const phoneDigits = phoneMatch?.[0].replace(/\D/g, '') ?? '';
  const phone = phoneDigits.length >= 10 && phoneDigits.length <= 15 ? phoneMatch?.[0].trim() ?? null : null;
  const sectionHeading = /^(summary|professional summary|experience|work experience|education|skills|projects|certifications|resume|curriculum vitae)$/i;
  const firstLine = lines.find((line) => (
    line.length >= 3 &&
    line.length <= 80 &&
    !sectionHeading.test(line) &&
    !/@/.test(line) &&
    !/https?:\/\//i.test(line) &&
    !/^\+?[\d\s().-]+$/.test(line)
  ));
  const fullName = firstLine && /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){1,4}$/u.test(firstLine)
    ? firstLine
    : null;

  const skills: ResumeSkillEvidence[] = [];
  for (const skill of SKILL_CATALOG) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'iu');
    const matchingLine = lines.find((line) => expression.test(line));
    if (!matchingLine) continue;
    skills.push({
      skill,
      evidence: matchingLine.length > 280 ? `${matchingLine.slice(0, 277)}...` : matchingLine,
    });
  }

  const experienceMatch = normalized.match(
    /\b(\d{1,2}(?:\.\d+)?)\s*\+?\s+years?\s+(?:of\s+)?(?:professional\s+|work\s+)?experience\b/i,
  );
  const experienceYears = experienceMatch ? Number(experienceMatch[1]) : null;
  const experienceEvidence = experienceMatch
    ? experienceMatch[0].trim()
    : null;

  return {
    detected: { fullName, email, phone, experienceYears, experienceEvidence },
    skills,
  };
}

export async function analyzeResume(
  fileName: string,
  fileType: ResumeFileType,
  buffer: Buffer,
): Promise<ResumeAnalysis> {
  if (buffer.length === 0) throw new ResumeParseError('The selected file is empty.');

  let text: string;
  try {
    if (fileType === 'pdf') {
      if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new ResumeParseError('The file does not appear to be a valid PDF.');
      }
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer, verbosity: 0, isEvalSupported: false });
      try {
        const parsed = await parser.getText({ first: 50 });
        text = parsed.text;
      } finally {
        await parser.destroy();
      }
    } else if (fileType === 'docx') {
      if (buffer.subarray(0, 2).toString('ascii') !== 'PK') {
        throw new ResumeParseError('The file does not appear to be a valid DOCX document.');
      }
      const parsed = await mammoth.extractRawText({ buffer });
      text = parsed.value;
    } else {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (text.includes('\u0000')) {
        throw new ResumeParseError('The text file contains unsupported binary data.');
      }
    }
  } catch (error) {
    if (error instanceof ResumeParseError) throw error;
    if (fileType === 'txt' && error instanceof TypeError) {
      throw new ResumeParseError('The text file must use UTF-8 encoding.');
    }
    throw new ResumeParseError(`Could not read this ${fileType.toUpperCase()} file. Try exporting it again as a text-based PDF or DOCX.`);
  }

  if (text.length > 500_000) {
    throw new ResumeParseError('This document contains too much text to analyze safely. Try a shorter resume file.');
  }

  const warnings: string[] = [];
  const isScannedPdf = fileType === 'pdf' && text.replace(/\s/g, '').length < 30;
  if (isScannedPdf) {
    warnings.push('This PDF contains little selectable text. OCR is not included; use a text-based PDF or enter details manually.');
  } else if (text.trim().length < 30) {
    warnings.push('Very little text was extracted. Review the fields carefully or enter them manually.');
  }

  const extracted = extractText(text);
  const hasSuggestions = Boolean(
    extracted.detected.fullName ||
    extracted.detected.email ||
    extracted.detected.phone ||
    extracted.detected.experienceYears !== null ||
    extracted.skills.length,
  );
  return {
    fileName,
    fileType,
    status: isScannedPdf ? 'ocr_required' : hasSuggestions ? 'ready' : 'needs_review',
    ...extracted,
    warnings,
  };
}
