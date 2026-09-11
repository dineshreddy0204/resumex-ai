export interface ExtractedSkill {
  name: string;
  normalizedName: string;
  category: string;
  confidence: number;
  occurrences: number;
  contexts: string[];
}

// Synonyms map: variation -> normalized standard form
const SKILL_SYNONYMS: Record<string, string> = {
  'python programming': 'Python',
  'python 3': 'Python',
  'python3': 'Python',
  'javascript es6': 'JavaScript',
  'javascript (esnext)': 'JavaScript',
  'ecmascript': 'JavaScript',
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  'golang': 'Go',
  'react.js': 'React',
  'reactjs': 'React',
  'react': 'React',
  'next.js': 'Next.js',
  'nextjs': 'Next.js',
  'vue.js': 'Vue',
  'vuejs': 'Vue',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
  'express.js': 'Express',
  'expressjs': 'Express',
  'restful apis': 'REST APIs',
  'rest api': 'REST APIs',
  'restful api': 'REST APIs',
  'rest apis': 'REST APIs',
  'graphql apis': 'GraphQL',
  'amazon web services': 'AWS',
  'aws cloud': 'AWS',
  'google cloud platform': 'GCP',
  'google cloud': 'GCP',
  'microsoft azure': 'Azure',
  'postgresql': 'PostgreSQL',
  'postgres': 'PostgreSQL',
  'mongo db': 'MongoDB',
  'mongodb': 'MongoDB',
  'k8s': 'Kubernetes',
  'ci/cd pipelines': 'CI/CD',
  'ci cd': 'CI/CD',
  'continuous integration': 'CI/CD',
  'continuous deployment': 'CI/CD',
  'github actions': 'GitHub Actions',
  'object-oriented programming': 'OOP',
  'object oriented programming': 'OOP',
  'microservice architecture': 'Microservices',
  'micro-services': 'Microservices',
  'test driven development': 'TDD',
  'test-driven development': 'TDD',
  'machine learning': 'Machine Learning',
  'deep learning': 'Deep Learning',
  'natural language processing': 'NLP',
  'gen ai': 'Generative AI',
  'generative ai': 'Generative AI',
  'large language models': 'LLMs',
  'llm': 'LLMs',
};

// Comprehensive skill catalog categorized
const SKILL_CATALOG: { category: string; skills: string[] }[] = [
  {
    category: 'Programming Languages',
    skills: [
      'Python',
      'JavaScript',
      'TypeScript',
      'Java',
      'C++',
      'C#',
      'Go',
      'Rust',
      'Ruby',
      'PHP',
      'Swift',
      'Kotlin',
      'SQL',
      'R',
      'Scala',
      'HTML5',
      'CSS3',
      'Bash',
      'Shell',
    ],
  },
  {
    category: 'Frontend Development',
    skills: [
      'React',
      'Next.js',
      'Vue',
      'Angular',
      'Svelte',
      'Redux',
      'Zustand',
      'Tailwind CSS',
      'Material UI',
      'Bootstrap',
      'Vite',
      'Webpack',
      'HTML5/CSS3',
      'WebSockets',
      'Responsive Design',
    ],
  },
  {
    category: 'Backend & APIs',
    skills: [
      'Node.js',
      'Express',
      'FastAPI',
      'Django',
      'Flask',
      'Spring Boot',
      'ASP.NET',
      'Ruby on Rails',
      'GraphQL',
      'REST APIs',
      'gRPC',
      'Microservices',
      'Kafka',
      'RabbitMQ',
    ],
  },
  {
    category: 'Databases & Caching',
    skills: [
      'PostgreSQL',
      'MySQL',
      'MongoDB',
      'Redis',
      'Elasticsearch',
      'DynamoDB',
      'Cassandra',
      'SQLite',
      'Firebase',
      'Supabase',
      'Oracle DB',
      'TimescaleDB',
    ],
  },
  {
    category: 'Cloud & Infrastructure',
    skills: [
      'AWS',
      'GCP',
      'Azure',
      'Docker',
      'Kubernetes',
      'Terraform',
      'Ansible',
      'Serverless',
      'Lambda',
      'Cloudflare',
      'Nginx',
      'Linux',
    ],
  },
  {
    category: 'DevOps & Quality Assurance',
    skills: [
      'CI/CD',
      'GitHub Actions',
      'GitLab CI',
      'Jenkins',
      'Git',
      'Jest',
      'Cypress',
      'Playwright',
      'Selenium',
      'PyTest',
      'TDD',
      'Monitoring',
      'Prometheus',
      'Grafana',
    ],
  },
  {
    category: 'AI & Data Engineering',
    skills: [
      'Machine Learning',
      'Deep Learning',
      'NLP',
      'Generative AI',
      'LLMs',
      'PyTorch',
      'TensorFlow',
      'Scikit-Learn',
      'Pandas',
      'NumPy',
      'Spark',
      'Airflow',
      'dbt',
      'Databricks',
      'Computer Vision',
    ],
  },
  {
    category: 'Methodologies & Soft Skills',
    skills: [
      'Agile',
      'Scrum',
      'System Design',
      'Cross-Functional Leadership',
      'Code Review',
      'Mentorship',
      'Technical Writing',
      'Root Cause Analysis',
      'Stakeholder Management',
    ],
  },
];

export class SkillExtractor {
  public normalizeSkill(raw: string): string {
    const clean = raw.trim().toLowerCase();
    if (SKILL_SYNONYMS[clean]) {
      return SKILL_SYNONYMS[clean];
    }
    // Check capitalization in catalog
    for (const group of SKILL_CATALOG) {
      for (const s of group.skills) {
        if (s.toLowerCase() === clean) {
          return s;
        }
      }
    }
    return raw.trim();
  }

  public extractSkills(text: string): ExtractedSkill[] {
    const skillResults = new Map<string, ExtractedSkill>();
    const lowerText = ` ${text.toLowerCase()} `;

    // 1. Check direct synonyms
    for (const [synonym, standard] of Object.entries(SKILL_SYNONYMS)) {
      const regex = new RegExp(`\\b${this.escapeRegex(synonym)}\\b`, 'gi');
      let matchCount = 0;
      const contexts: string[] = [];

      let match;
      while ((match = regex.exec(text)) !== null) {
        matchCount++;
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + synonym.length + 30);
        contexts.push(text.substring(start, end).trim());
        if (matchCount >= 4) break;
      }

      if (matchCount > 0) {
        const cat = this.findCategory(standard);
        const existing = skillResults.get(standard);
        if (existing) {
          existing.occurrences += matchCount;
          existing.contexts.push(...contexts);
        } else {
          skillResults.set(standard, {
            name: standard,
            normalizedName: standard,
            category: cat,
            confidence: Math.min(0.99, 0.85 + matchCount * 0.04),
            occurrences: matchCount,
            contexts,
          });
        }
      }
    }

    // 2. Scan skill catalog
    for (const catGroup of SKILL_CATALOG) {
      for (const skill of catGroup.skills) {
        if (skillResults.has(skill)) continue;

        // Strict word boundary check
        const pattern = skill.length <= 3 
          ? `(?:^|[^a-zA-Z0-9#+])${this.escapeRegex(skill)}(?:[^a-zA-Z0-9#+]|$)`
          : `\\b${this.escapeRegex(skill)}\\b`;

        const regex = new RegExp(pattern, 'gi');
        let count = 0;
        const contexts: string[] = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
          count++;
          const idx = match.index;
          const start = Math.max(0, idx - 25);
          const end = Math.min(text.length, idx + skill.length + 25);
          contexts.push(text.substring(start, end).trim());
          if (count >= 4) break;
        }

        if (count > 0) {
          skillResults.set(skill, {
            name: skill,
            normalizedName: skill,
            category: catGroup.category,
            confidence: Math.min(0.98, 0.82 + count * 0.05),
            occurrences: count,
            contexts,
          });
        }
      }
    }

    return Array.from(skillResults.values()).sort((a, b) => b.occurrences - a.occurrences);
  }

  public findCategory(skillName: string): string {
    for (const group of SKILL_CATALOG) {
      if (group.skills.some((s) => s.toLowerCase() === skillName.toLowerCase())) {
        return group.category;
      }
    }
    return 'Technical Skills';
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const skillExtractor = new SkillExtractor();
