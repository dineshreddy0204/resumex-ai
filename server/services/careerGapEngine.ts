import type { ResumeData, CareerGapAnalysis } from '../types';
import { skillExtractor } from './skillExtractor';

const ROLE_BENCHMARKS: Record<
  string,
  {
    requiredSkills: string[];
    recommendedProjects: { title: string; description: string; demonstratedSkills: string[] }[];
  }
> = {
  'senior full-stack engineer': {
    requiredSkills: [
      'TypeScript',
      'React',
      'Node.js',
      'PostgreSQL',
      'AWS',
      'Docker',
      'Kubernetes',
      'Redis',
      'CI/CD',
      'Microservices',
      'System Design',
    ],
    recommendedProjects: [
      {
        title: 'Distributed Event-Driven Task Queue',
        description: 'Build a high-throughput async processing pipeline using Redis Streams, Node.js worker pools, and Docker.',
        demonstratedSkills: ['Redis', 'Microservices', 'Node.js', 'Docker'],
      },
      {
        title: 'Real-Time Collaborative Document Canvas',
        description: 'Create an optimistic UI state sync engine using WebSockets, React 19, and PostgreSQL ACID transactions.',
        demonstratedSkills: ['React', 'WebSockets', 'PostgreSQL', 'TypeScript'],
      },
    ],
  },
  'cloud / devops engineer': {
    requiredSkills: [
      'AWS',
      'Docker',
      'Kubernetes',
      'Terraform',
      'CI/CD',
      'Linux',
      'Prometheus',
      'Grafana',
      'Python',
      'Bash',
      'Networking',
    ],
    recommendedProjects: [
      {
        title: 'Automated GitOps Infrastructure Provisioning',
        description: 'Write Terraform modules that bootstrap a secure multi-region EKS cluster with ArgoCD and automated canary rollouts.',
        demonstratedSkills: ['Terraform', 'Kubernetes', 'AWS', 'CI/CD'],
      },
      {
        title: 'Observability & Distributed Tracing Stack',
        description: 'Deploy Prometheus, Grafana, and OpenTelemetry collectors with custom alerting rules and synthetic SLO monitoring.',
        demonstratedSkills: ['Prometheus', 'Grafana', 'Monitoring', 'Linux'],
      },
    ],
  },
  'machine learning / ai engineer': {
    requiredSkills: [
      'Python',
      'PyTorch',
      'TensorFlow',
      'Scikit-Learn',
      'NLP',
      'Generative AI',
      'LLMs',
      'SQL',
      'Docker',
      'FastAPI',
      'Vector Databases',
    ],
    recommendedProjects: [
      {
        title: 'Hybrid RAG Knowledge Engine with Verification',
        description: 'Implement a semantic retrieval-augmented generation engine with vector embeddings, reranking, and citation checking.',
        demonstratedSkills: ['Python', 'NLP', 'Generative AI', 'Vector Databases', 'FastAPI'],
      },
      {
        title: 'Fine-Tuned Domain Specialist Transformer',
        description: 'Fine-tune an open-source model using LoRA/PEFT on a domain corpus with automated evaluation metrics (BLEU, ROUGE, F1).',
        demonstratedSkills: ['PyTorch', 'LLMs', 'Deep Learning', 'Python'],
      },
    ],
  },
  'data engineer': {
    requiredSkills: ['Python', 'SQL', 'PostgreSQL', 'Spark', 'Airflow', 'Kafka', 'dbt', 'AWS', 'Docker', 'Data Modeling'],
    recommendedProjects: [
      {
        title: 'Real-Time Financial Streaming Pipeline',
        description: 'Stream transactions via Apache Kafka, process aggregations with Apache Spark, and write to a dimensional lakehouse.',
        demonstratedSkills: ['Kafka', 'Spark', 'SQL', 'Data Modeling'],
      },
    ],
  },
};

export class CareerGapEngine {
  public analyzeCareerGap(resume: ResumeData, targetRole: string): CareerGapAnalysis {
    const roleKey = targetRole.toLowerCase().trim();
    const benchmark = ROLE_BENCHMARKS[roleKey] || ROLE_BENCHMARKS['senior full-stack engineer'];

    // Map candidate skills with evidence count
    const candidateSkillMap = new Map<string, { occurrences: number; contexts: string[] }>();

    for (const group of resume.skills) {
      for (const s of group.items) {
        const norm = skillExtractor.normalizeSkill(s);
        candidateSkillMap.set(norm, { occurrences: 1, contexts: ['Listed in Skills Section'] });
      }
    }

    // Check occurrences in experience bullets
    for (const exp of resume.experience) {
      for (const b of exp.bullets) {
        const found = skillExtractor.extractSkills(b);
        for (const f of found) {
          const norm = f.normalizedName;
          const existing = candidateSkillMap.get(norm) || { occurrences: 0, contexts: [] };
          existing.occurrences += 1;
          existing.contexts.push(b);
          candidateSkillMap.set(norm, existing);
        }
      }
    }

    const currentSkillsList: CareerGapAnalysis['currentSkills'] = [];
    const strongSkills: string[] = [];
    const developingSkills: string[] = [];
    const missingSkills: CareerGapAnalysis['missingSkills'] = [];
    const evidenceGaps: CareerGapAnalysis['evidenceGaps'] = [];

    for (const targetSkill of benchmark.requiredSkills) {
      const candidateData = candidateSkillMap.get(targetSkill);

      if (candidateData && candidateData.occurrences >= 2) {
        strongSkills.push(targetSkill);
        currentSkillsList.push({
          skill: targetSkill,
          proficiency: 90,
          hasEvidence: true,
          evidenceCount: candidateData.occurrences,
        });
      } else if (candidateData && candidateData.occurrences === 1) {
        developingSkills.push(targetSkill);
        currentSkillsList.push({
          skill: targetSkill,
          proficiency: 60,
          hasEvidence: true,
          evidenceCount: 1,
        });
        evidenceGaps.push({
          skillOrRequirement: targetSkill,
          issue: `"${targetSkill}" is listed but only referenced once without concrete production impact evidence.`,
          recommendedAction: `Add a bullet point demonstrating how you applied ${targetSkill} to solve a specific engineering problem with measurable results.`,
        });
      } else {
        missingSkills.push({
          skill: targetSkill,
          priority: ['AWS', 'Kubernetes', 'Docker', 'System Design', 'TypeScript'].includes(targetSkill) ? 'High' : 'Medium',
          importanceReason: `Core requirement for ${targetRole} positions; absence significantly lowers ATS screening threshold.`,
        });
      }
    }

    return {
      targetRole,
      currentSkills: currentSkillsList,
      strongSkills,
      developingSkills,
      missingSkills,
      evidenceGaps,
      actionPlan: {
        skillsToLearn: missingSkills.map((m) => m.skill),
        recommendedProjects: benchmark.recommendedProjects,
        resumeAdditions: evidenceGaps.map((e) => e.recommendedAction),
      },
    };
  }
}

export const careerGapEngine = new CareerGapEngine();
