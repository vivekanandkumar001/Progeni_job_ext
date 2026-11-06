/**
 * Skill Taxonomy and Synonym Mapping Engine
 * Version: v1.0.0
 * 
 * Provides deterministic mapping from common skill variations, aliases,
 * and acronyms to standardized canonical skills.
 */

export const SKILL_TAXONOMY_VERSION = 'v1.0.0';

export interface CanonicalSkillEntry {
  canonical: string;
  category: 'languages' | 'frontend' | 'backend' | 'cloud_devops' | 'databases' | 'ai_ml' | 'architecture' | 'general';
  aliases: string[];
}

export const SKILL_TAXONOMY: CanonicalSkillEntry[] = [
  // Programming Languages
  { canonical: 'JavaScript', category: 'languages', aliases: ['js', 'ecmascript', 'javascript', 'vanilla js', 'es6', 'es6+'] },
  { canonical: 'TypeScript', category: 'languages', aliases: ['ts', 'typescript'] },
  { canonical: 'Python', category: 'languages', aliases: ['python', 'python3', 'py'] },
  { canonical: 'Java', category: 'languages', aliases: ['java', 'core java', 'java 8', 'java 11', 'java 17'] },
  { canonical: 'Golang', category: 'languages', aliases: ['go', 'golang'] },
  { canonical: 'Rust', category: 'languages', aliases: ['rust', 'rustlang'] },
  { canonical: 'C++', category: 'languages', aliases: ['c++', 'cpp'] },
  { canonical: 'C#', category: 'languages', aliases: ['c#', 'csharp', '.net', 'dotnet'] },
  { canonical: 'PHP', category: 'languages', aliases: ['php', 'php7', 'php8'] },
  { canonical: 'Ruby', category: 'languages', aliases: ['ruby', 'ruby on rails', 'rails'] },
  { canonical: 'SQL', category: 'languages', aliases: ['sql', 'ansi sql'] },

  // Frontend Frameworks & Libraries
  { canonical: 'React', category: 'frontend', aliases: ['react', 'reactjs', 'react.js', 'react js'] },
  { canonical: 'Next.js', category: 'frontend', aliases: ['nextjs', 'next.js', 'next js', 'next'] },
  { canonical: 'Vue.js', category: 'frontend', aliases: ['vue', 'vuejs', 'vue.js', 'vue 3'] },
  { canonical: 'Angular', category: 'frontend', aliases: ['angular', 'angularjs', 'angular 2+'] },
  { canonical: 'HTML', category: 'frontend', aliases: ['html', 'html5'] },
  { canonical: 'CSS', category: 'frontend', aliases: ['css', 'css3'] },
  { canonical: 'Tailwind CSS', category: 'frontend', aliases: ['tailwind', 'tailwindcss', 'tailwind css'] },
  { canonical: 'Redux', category: 'frontend', aliases: ['redux', 'redux toolkit', 'rtk'] },

  // Backend Frameworks & Runtimes
  { canonical: 'Node.js', category: 'backend', aliases: ['node', 'nodejs', 'node.js', 'node js'] },
  { canonical: 'Express', category: 'backend', aliases: ['express', 'expressjs', 'express.js'] },
  { canonical: 'FastAPI', category: 'backend', aliases: ['fastapi', 'fast-api'] },
  { canonical: 'Django', category: 'backend', aliases: ['django', 'django rest framework', 'drf'] },
  { canonical: 'Flask', category: 'backend', aliases: ['flask'] },
  { canonical: 'Spring Boot', category: 'backend', aliases: ['spring', 'spring boot', 'springboot'] },
  { canonical: 'GraphQL', category: 'backend', aliases: ['graphql', 'gql'] },
  { canonical: 'REST API', category: 'backend', aliases: ['rest', 'rest api', 'restful', 'restful api', 'rest apis'] },
  { canonical: 'Microservices', category: 'backend', aliases: ['microservices', 'microservice architecture'] },

  // Cloud & DevOps
  { canonical: 'AWS', category: 'cloud_devops', aliases: ['aws', 'amazon web services'] },
  { canonical: 'Google Cloud', category: 'cloud_devops', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { canonical: 'Azure', category: 'cloud_devops', aliases: ['azure', 'microsoft azure'] },
  { canonical: 'Docker', category: 'cloud_devops', aliases: ['docker', 'containerization', 'containers'] },
  { canonical: 'Kubernetes', category: 'cloud_devops', aliases: ['k8s', 'kubernetes'] },
  { canonical: 'Terraform', category: 'cloud_devops', aliases: ['terraform', 'tf', 'iac'] },
  { canonical: 'CI/CD', category: 'cloud_devops', aliases: ['ci/cd', 'ci cd', 'continuous integration', 'continuous delivery', 'github actions'] },
  { canonical: 'Linux', category: 'cloud_devops', aliases: ['linux', 'unix', 'ubuntu'] },
  { canonical: 'Git', category: 'cloud_devops', aliases: ['git', 'github', 'gitlab'] },

  // Databases & Caching
  { canonical: 'PostgreSQL', category: 'databases', aliases: ['postgres', 'postgresql', 'psql'] },
  { canonical: 'MongoDB', category: 'databases', aliases: ['mongo', 'mongodb'] },
  { canonical: 'MySQL', category: 'databases', aliases: ['mysql', 'mariadb'] },
  { canonical: 'Redis', category: 'databases', aliases: ['redis', 'redis cache'] },
  { canonical: 'Elasticsearch', category: 'databases', aliases: ['elasticsearch', 'elastic search', 'opensearch'] },
  { canonical: 'Kafka', category: 'databases', aliases: ['kafka', 'apache kafka'] },

  // AI / ML & Data
  { canonical: 'Machine Learning', category: 'ai_ml', aliases: ['ml', 'machine learning'] },
  { canonical: 'Deep Learning', category: 'ai_ml', aliases: ['dl', 'deep learning'] },
  { canonical: 'PyTorch', category: 'ai_ml', aliases: ['pytorch', 'torch'] },
  { canonical: 'TensorFlow', category: 'ai_ml', aliases: ['tensorflow', 'tf'] },
  { canonical: 'Data Analysis', category: 'ai_ml', aliases: ['data analysis', 'data analytics'] },
  { canonical: 'Pandas', category: 'ai_ml', aliases: ['pandas'] },
  { canonical: 'NumPy', category: 'ai_ml', aliases: ['numpy'] },
  { canonical: 'scikit-learn', category: 'ai_ml', aliases: ['scikit-learn', 'sklearn'] },
  { canonical: 'LLM', category: 'ai_ml', aliases: ['llm', 'llms', 'large language models'] },
];

const aliasToCanonicalMap = new Map<string, string>();
for (const entry of SKILL_TAXONOMY) {
  aliasToCanonicalMap.set(entry.canonical.toLowerCase(), entry.canonical);
  for (const alias of entry.aliases) {
    aliasToCanonicalMap.set(alias.toLowerCase(), entry.canonical);
  }
}

/**
 * Normalizes a raw skill string to its canonical form if known,
 * or returns a cleanly trimmed representation.
 */
export function normalizeSkill(raw: string): string {
  const clean = raw.trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();
  return aliasToCanonicalMap.get(lower) || clean;
}

/**
 * Checks if two skill representations refer to the same technology
 * through exact match or alias mapping.
 */
export function skillsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const normA = normalizeSkill(a).toLowerCase();
  const normB = normalizeSkill(b).toLowerCase();
  return normA === normB;
}

/**
 * Maps an array of raw skill strings into unique canonical representations.
 */
export function mapToCanonicalSkills(skills: string[]): string[] {
  const canonicalSet = new Set<string>();
  for (const s of skills) {
    const norm = normalizeSkill(s);
    if (norm) {
      canonicalSet.add(norm);
    }
  }
  return Array.from(canonicalSet);
}

