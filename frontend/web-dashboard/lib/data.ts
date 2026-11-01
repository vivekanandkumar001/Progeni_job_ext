interface CandidateProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  targetRole: string;
  experienceLevel: string;
  location: string;
  resumeCompleteness: number;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  experienceMin: number;
  experienceMax: number;
  skills: string[];
  source: string;
  url: string;
  matchScore: number;
}

interface Application {
  id: string;
  jobId: string;
  job: Job;
  status: string;
  lastUpdated: string;
  stage: string;
}

export const DEMO_LABEL = '[DEMO DATA]';

export const demoProfile: CandidateProfile = {
  id: 'demo-profile',
  name: 'Vivekanand Kumar',
  email: 'demo@example.com',
  role: 'candidate',
  targetRole: 'Python Backend & Full Stack',
  experienceLevel: '0-2 yrs',
  location: 'Delhi NCR',
  resumeCompleteness: 80,
};

export const demoJobs: Job[] = [
  {
    id: 'job-1',
    title: 'Python Developer',
    company: 'TechNova Pvt. Ltd.',
    location: 'Noida, India',
    salaryMin: 500000,
    salaryMax: 800000,
    experienceMin: 0,
    experienceMax: 2,
    skills: ['Python', 'Django', 'REST APIs'],
    source: 'naukri',
    url: 'https://www.naukri.com/job-listing-demo',
    matchScore: 92,
  },
];

export const demoApplications: Application[] = [
  {
    id: 'app-1',
    jobId: 'job-1',
    job: demoJobs[0],
    status: 'prepared',
    lastUpdated: new Date().toISOString(),
    stage: 'Prepared - Needs Review',
  },
];