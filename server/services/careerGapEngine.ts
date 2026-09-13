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

    const employmentGaps = this.analyzeEmploymentGaps(data);

    return {
      targetRole,
      currentSkills: currentSkillsList,
      strongSkills,
      developingSkills,
      missingSkills,
      evidenceGaps,
      employmentGaps,
      actionPlan: {
        skillsToLearn: missingSkills.map((m) => m.skill),
        recommendedProjects: benchmark.recommendedProjects,
        resumeAdditions: evidenceGaps.map((e) => e.recommendedAction),
      },
    };
  }

  /**
   * Identifies employment timeline gaps > 6 months.
   * Computes precise duration in months and generates constructive framing,
   * suggested interview phrasing, maintained skills, and honest positioning advice.
   * STRICT POLICY: Never invents fake employer names or fictional work experience to hide a gap.
   */
  public analyzeEmploymentGaps(data: ResumeData) {
    const gaps: Array<{
      id: string;
      startDate: string;
      endDate: string;
      durationMonths: number;
      previousRole?: string;
      previousCompany?: string;
      nextRole?: string;
      nextCompany?: string;
      impactAssessment: string;
      constructiveFraming: string;
      suggestedPhrasing: string;
      skillsMaintainedOrDeveloped: string[];
      honestPositioningAdvice: string;
    }> = [];

    if (!data.experience || data.experience.length === 0) return gaps;

    // Helper to parse dates into comparable month values (year * 12 + monthIndex 0..11)
    const parseDateToMonths = (dateStr?: string): number | null => {
      if (!dateStr) return null;
      const clean = dateStr.trim().toLowerCase();
      if (clean === 'present' || clean === 'current' || clean === 'now' || clean === 'ongoing') {
        const now = new Date();
        return now.getFullYear() * 12 + now.getMonth();
      }

      // Format: YYYY-MM or YYYY/MM
      const yyyyMm = clean.match(/^(\d{4})[-/](\d{1,2})$/);
      if (yyyyMm) {
        return parseInt(yyyyMm[1], 10) * 12 + (parseInt(yyyyMm[2], 10) - 1);
      }

      // Format: MM/YYYY
      const mmYyyy = clean.match(/^(\d{1,2})[-/](\d{4})$/);
      if (mmYyyy) {
        return parseInt(mmYyyy[2], 10) * 12 + (parseInt(mmYyyy[1], 10) - 1);
      }

      // Format: Month YYYY (e.g. Jan 2022, January 2022)
      const monthNames: Record<string, number> = {
        jan: 0, january: 0,
        feb: 1, february: 1,
        mar: 2, march: 2,
        apr: 3, april: 3,
        may: 4,
        jun: 5, june: 5,
        jul: 6, july: 6,
        aug: 7, august: 7,
        sep: 8, sept: 8, september: 8,
        oct: 9, october: 9,
        nov: 10, november: 10,
        dec: 11, december: 11,
      };

      const monthYear = clean.match(/^([a-z]+)\.?\s+(\d{4})$/);
      if (monthYear && monthNames[monthYear[1]] !== undefined) {
        return parseInt(monthYear[2], 10) * 12 + monthNames[monthYear[1]];
      }

      // Format: Just YYYY (e.g. 2021)
      const yearOnly = clean.match(/^(\d{4})$/);
      if (yearOnly) {
        return parseInt(yearOnly[1], 10) * 12 + 5; // mid-year estimate
      }

      return null;
    };

    // Extract valid chronological experience items
    const parsedExperiences = data.experience
      .map((exp) => ({
        exp,
        startMonths: parseDateToMonths(exp.startDate),
        endMonths: parseDateToMonths(exp.endDate),
      }))
      .filter((item): item is { exp: typeof item.exp; startMonths: number; endMonths: number } =>
        item.startMonths !== null && item.endMonths !== null
      )
      .sort((a, b) => a.startMonths - b.startMonths); // Chronological order (oldest first)

    // Analyze gaps between consecutive employment entries
    for (let i = 0; i < parsedExperiences.length - 1; i++) {
      const prev = parsedExperiences[i];
      const next = parsedExperiences[i + 1];

      // Gap is from prev.endMonths to next.startMonths
      const gapMonths = next.startMonths - prev.endMonths;

      if (gapMonths > 6) {
        const startYear = Math.floor(prev.endMonths / 12);
        const startMonth = (prev.endMonths % 12) + 1;
        const endYear = Math.floor(next.startMonths / 12);
        const endMonth = (next.startMonths % 12) + 1;

        const startDateStr = prev.exp.endDate || `${startYear}-${String(startMonth).padStart(2, '0')}`;
        const endDateStr = next.exp.startDate || `${endYear}-${String(endMonth).padStart(2, '0')}`;

        // Relevant skills candidate maintained based on resume
        const candidateSkills = (data.skills || []).flatMap((g) => g.items || []).slice(0, 5);

        gaps.push({
          id: `gap-${i + 1}`,
          startDate: startDateStr,
          endDate: endDateStr,
          durationMonths: gapMonths,
          previousRole: prev.exp.role,
          previousCompany: prev.exp.company,
          nextRole: next.exp.role,
          nextCompany: next.exp.company,
          impactAssessment: `A ${gapMonths}-month career interval between ${prev.exp.company || 'previous role'} and ${next.exp.company || 'subsequent role'}. Without clear narrative framing, automated screeners and recruiters may assume skill rust.`,
          constructiveFraming: `Frame this interval as an intentional transition dedicated to skill acquisition, technical exploration, certifications, or family responsibilities.`,
          suggestedPhrasing: `Between ${startDateStr} and ${endDateStr}, I focused on targeted professional growth, strengthening my hands-on architecture capabilities and keeping technical skills sharp.`,
          skillsMaintainedOrDeveloped: candidateSkills.length > 0 ? candidateSkills : ['System Architecture', 'Self-Directed Learning', 'Technical Exploration'],
          honestPositioningAdvice: 'Never invent fake employer names or fictional work experience to hide a gap. Hiring managers and background checks strictly verify company history. Transparent, confident communication of self-directed learning and real life responsibilities builds trust.',
        });
      }
    }

    // Check if the most recent role ended > 6 months ago and is not current
    if (parsedExperiences.length > 0) {
      const latest = parsedExperiences[parsedExperiences.length - 1];
      const isCurrent = (latest.exp.endDate || '').toLowerCase().match(/present|current|now|ongoing/);
      if (!isCurrent) {
        const nowMonths = new Date().getFullYear() * 12 + new Date().getMonth();
        const currentGap = nowMonths - latest.endMonths;
        if (currentGap > 6) {
          const candidateSkills = (data.skills || []).flatMap((g) => g.items || []).slice(0, 5);
          gaps.push({
            id: 'gap-current',
            startDate: latest.exp.endDate || 'Recent Role',
            endDate: 'Present',
            durationMonths: currentGap,
            previousRole: latest.exp.role,
            previousCompany: latest.exp.company,
            impactAssessment: `An ongoing ${currentGap}-month career gap since leaving ${latest.exp.company || 'most recent role'}. Recruiters seek reassurance regarding current technical currency and availability.`,
            constructiveFraming: 'Position current period as an active search and continuous learning cycle where you have been evaluating aligned opportunities, maintaining technical hands-on momentum, and contributing to projects.',
            suggestedPhrasing: `Since completing my role at ${latest.exp.company || 'my last team'}, I have been actively building technical proof-of-concept projects, refining my distributed systems skillset, and selectively interviewing for high-alignment engineering teams.`,
            skillsMaintainedOrDeveloped: candidateSkills.length > 0 ? candidateSkills : ['Technical Currency', 'Architecture Design', 'Active Coding'],
            honestPositioningAdvice: 'Never invent fake employer names or fictional work experience to hide a gap. Demonstrating active coding projects and continuous learning on GitHub provides concrete proof of ongoing readiness.',
          });
        }
      }
    }

    return gaps;
  }
}

export const careerGapEngine = new CareerGapEngine();
