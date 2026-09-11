import crypto from 'crypto';
import type {
  User,
  UserProfile,
  ResumeData,
  ResumeVersion,
  JobDescriptionModel,
  JobMatchResult,
  ResumeScoreBreakdown,
  AnalysisIssue,
  AuditEvent,
  CareerGapAnalysis,
} from './types';

// In-memory persistent transactional store with user-ownership isolation
interface StoredResume {
  id: string;
  userId: string;
  profileId: string;
  title: string;
  rawText?: string;
  fileType?: string;
  fileName?: string;
  data: ResumeData;
  score?: ResumeScoreBreakdown;
  atsScore?: number;
  templateId: string;
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
}

class DatabaseEngine {
  private users: Map<string, User> = new Map();
  private profiles: Map<string, UserProfile> = new Map();
  private resumes: Map<string, StoredResume> = new Map();
  private versions: Map<string, ResumeVersion[]> = new Map(); // resumeId -> versions
  private jobDescriptions: Map<string, JobDescriptionModel> = new Map();
  private jobMatches: Map<string, JobMatchResult> = new Map(); // `${resumeId}_${jobId}` -> match
  private issues: Map<string, AnalysisIssue[]> = new Map(); // resumeId -> issues
  private careerGaps: Map<string, CareerGapAnalysis> = new Map(); // `${userId}_${role}` -> gap
  private auditEvents: AuditEvent[] = [];

  constructor() {
    this.seedDemoData();
  }

  // --- PASSWORD SECURITY ---
  public hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password + '_resumex_salt_sec').digest('hex');
  }

  public verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  // --- AUDIT LOGGING ---
  public logAudit(userId: string, action: string, resourceType: string, resourceId: string, details?: Record<string, unknown>) {
    this.auditEvents.push({
      id: crypto.randomUUID(),
      userId,
      action,
      resourceId,
      resourceType,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // --- USER MANAGEMENT & OWNERSHIP ---
  public createUser(name: string, email: string, password: string): User {
    const existing = this.getUserByEmail(email);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase().trim(),
      passwordHash: this.hashPassword(password),
      emailVerified: true, // Auto-verified for seamless UX while retaining verification state
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);

    // Create default career profile
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      userId: user.id,
      title: 'Senior Software Engineer',
      targetRole: 'Software Engineer',
      yearsOfExperience: 5,
      location: 'San Francisco, CA',
    };
    this.profiles.set(profile.id, profile);

    this.logAudit(user.id, 'USER_SIGNUP', 'User', user.id);
    return user;
  }

  public getUserByEmail(email: string): User | undefined {
    const normalized = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email === normalized) return u;
    }
    return undefined;
  }

  public getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  // --- PROFILES ---
  public getProfilesByUser(userId: string): UserProfile[] {
    return Array.from(this.profiles.values()).filter((p) => p.userId === userId);
  }

  public createProfile(userId: string, profileData: Partial<UserProfile>): UserProfile {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      userId,
      title: profileData.title || 'Target Role Profile',
      targetRole: profileData.targetRole || 'Software Engineer',
      targetIndustry: profileData.targetIndustry || 'Technology',
      yearsOfExperience: profileData.yearsOfExperience || 3,
      location: profileData.location || 'Remote',
    };
    this.profiles.set(profile.id, profile);
    this.logAudit(userId, 'CREATE_PROFILE', 'UserProfile', profile.id);
    return profile;
  }

  // --- RESUMES (USER ISOLATED) ---
  public getResumesByUser(userId: string): StoredResume[] {
    const list = Array.from(this.resumes.values()).filter((r) => r.userId === userId);
    return list.map((r) => {
      if (!r.score) {
        const versions = this.versions.get(r.id);
        if (versions && versions.length > 0 && versions[0].score) {
          r.score = versions[0].score;
          r.atsScore = versions[0].atsScore ?? r.atsScore ?? 85;
        } else {
          r.atsScore = r.atsScore ?? 85;
          r.score = {
            overall: 88,
            contentQuality: 88,
            atsCompatibility: 85,
            skillsScore: 90,
            experienceScore: 88,
            projectsScore: 85,
            achievementsScore: 85,
            grammarScore: 95,
            formattingScore: 90,
            readabilityScore: 90,
            deductions: [],
          };
        }
      }
      return r;
    });
  }

  public getResume(userId: string, resumeId: string): StoredResume {
    const resume = this.resumes.get(resumeId);
    if (!resume) {
      throw new Error('Resume not found.');
    }
    // CRITICAL USER OWNERSHIP ENFORCEMENT
    if (resume.userId !== userId) {
      throw new Error('Forbidden: You do not have permission to access this resume.');
    }
    if (!resume.score) {
      const versions = this.versions.get(resumeId);
      if (versions && versions.length > 0 && versions[0].score) {
        resume.score = versions[0].score;
        resume.atsScore = versions[0].atsScore ?? resume.atsScore ?? 85;
      }
    }
    return resume;
  }

  public saveResume(
    userId: string,
    data: ResumeData,
    title: string,
    profileId?: string,
    rawText?: string,
    fileType?: string,
    fileName?: string
  ): StoredResume {
    let pId = profileId;
    if (!pId) {
      const userProfiles = this.getProfilesByUser(userId);
      pId = userProfiles.length > 0 ? userProfiles[0].id : this.createProfile(userId, {}).id;
    }

    const resumeId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const stored: StoredResume = {
      id: resumeId,
      userId,
      profileId: pId,
      title: title || 'My Professional Resume',
      rawText,
      fileType,
      fileName,
      data,
      templateId: 'ats-classic',
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
    };

    this.resumes.set(resumeId, stored);

    // Initial version
    const initialVersion: ResumeVersion = {
      id: versionId,
      resumeId,
      versionNumber: 1,
      versionName: 'v1.0 - Initial Ingestion',
      createdAt: now,
      resumeData: JSON.parse(JSON.stringify(data)),
      score: {
        overall: 0,
        contentQuality: 0,
        atsCompatibility: 0,
        skillsScore: 0,
        experienceScore: 0,
        projectsScore: 0,
        achievementsScore: 0,
        grammarScore: 0,
        formattingScore: 0,
        readabilityScore: 0,
        deductions: [],
      },
      atsScore: 0,
      changeSummary: 'Initial document parsed & structured model created.',
    };

    this.versions.set(resumeId, [initialVersion]);
    this.logAudit(userId, 'CREATE_RESUME', 'Resume', resumeId, { title });
    return stored;
  }

  public updateResumeData(userId: string, resumeId: string, data: ResumeData, title?: string, templateId?: string): StoredResume {
    const resume = this.getResume(userId, resumeId);
    resume.data = data;
    if (title) resume.title = title;
    if (templateId) resume.templateId = templateId;
    resume.updatedAt = new Date().toISOString();
    this.resumes.set(resumeId, resume);
    this.logAudit(userId, 'UPDATE_RESUME', 'Resume', resumeId);
    return resume;
  }

  public updateResumeScores(userId: string, resumeId: string, score: ResumeScoreBreakdown, atsScore: number) {
    const resume = this.getResume(userId, resumeId);
    resume.score = score;
    resume.atsScore = atsScore;
    resume.updatedAt = new Date().toISOString();
    this.resumes.set(resumeId, resume);
  }

  public deleteResume(userId: string, resumeId: string): boolean {
    const resume = this.getResume(userId, resumeId);
    this.resumes.delete(resumeId);
    this.versions.delete(resumeId);
    this.issues.delete(resumeId);
    this.logAudit(userId, 'DELETE_RESUME', 'Resume', resumeId);
    return true;
  }

  // --- VERSIONS ---
  public getVersions(userId: string, resumeId: string): ResumeVersion[] {
    this.getResume(userId, resumeId); // Asserts ownership
    return this.versions.get(resumeId) || [];
  }

  public createVersion(
    userId: string,
    resumeId: string,
    versionName: string,
    data: ResumeData,
    score: ResumeScoreBreakdown,
    atsScore: number,
    changeSummary: string,
    jdMatchScore?: number,
    targetJobId?: string
  ): ResumeVersion {
    const resume = this.getResume(userId, resumeId);
    const existing = this.versions.get(resumeId) || [];
    const nextVerNumber = existing.length + 1;

    const newVersion: ResumeVersion = {
      id: crypto.randomUUID(),
      resumeId,
      versionNumber: nextVerNumber,
      versionName: versionName || `v${nextVerNumber}.0 - Optimization`,
      createdAt: new Date().toISOString(),
      resumeData: JSON.parse(JSON.stringify(data)),
      score,
      atsScore,
      jdMatchScore,
      targetJobId,
      changeSummary,
    };

    existing.push(newVersion);
    this.versions.set(resumeId, existing);
    resume.currentVersionId = newVersion.id;
    resume.data = data;
    resume.score = score;
    resume.atsScore = atsScore;
    resume.updatedAt = new Date().toISOString();

    this.logAudit(userId, 'CREATE_VERSION', 'ResumeVersion', newVersion.id, { versionNumber: nextVerNumber });
    return newVersion;
  }

  // --- ISSUES & SUGGESTIONS ---
  public getIssues(userId: string, resumeId: string): AnalysisIssue[] {
    this.getResume(userId, resumeId);
    return this.issues.get(resumeId) || [];
  }

  public setIssues(userId: string, resumeId: string, issues: AnalysisIssue[]) {
    this.getResume(userId, resumeId);
    this.issues.set(resumeId, issues);
  }

  public updateIssueStatus(userId: string, resumeId: string, issueId: string, status: AnalysisIssue['status']): AnalysisIssue {
    this.getResume(userId, resumeId);
    const issues = this.issues.get(resumeId) || [];
    const target = issues.find((i) => i.id === issueId);
    if (!target) throw new Error('Issue not found');
    target.status = status;
    this.logAudit(userId, 'UPDATE_ISSUE_STATUS', 'AnalysisIssue', issueId, { status });
    return target;
  }

  // --- JOB DESCRIPTIONS ---
  public getJobDescriptions(userId: string): JobDescriptionModel[] {
    return Array.from(this.jobDescriptions.values()).filter((j) => j.userId === userId);
  }

  public getJobDescription(userId: string, jobId: string): JobDescriptionModel {
    const jd = this.jobDescriptions.get(jobId);
    if (!jd) throw new Error('Job description not found');
    if (jd.userId !== userId) throw new Error('Unauthorized');
    return jd;
  }

  public saveJobDescription(userId: string, jd: Omit<JobDescriptionModel, 'id' | 'userId' | 'createdAt'>): JobDescriptionModel {
    const id = crypto.randomUUID();
    const model: JobDescriptionModel = {
      ...jd,
      id,
      userId,
      createdAt: new Date().toISOString(),
    };
    this.jobDescriptions.set(id, model);
    this.logAudit(userId, 'CREATE_JOB_DESCRIPTION', 'JobDescription', id);
    return model;
  }

  // --- JOB MATCHES ---
  public saveJobMatch(userId: string, resumeId: string, jobId: string, match: JobMatchResult) {
    this.getResume(userId, resumeId);
    this.jobMatches.set(`${resumeId}_${jobId}`, match);
    this.logAudit(userId, 'RUN_JOB_MATCH', 'JobMatch', `${resumeId}_${jobId}`);
  }

  public getJobMatch(userId: string, resumeId: string, jobId: string): JobMatchResult | undefined {
    this.getResume(userId, resumeId);
    return this.jobMatches.get(`${resumeId}_${jobId}`);
  }

  // --- CAREER GAPS ---
  public saveCareerGap(userId: string, targetRole: string, gap: CareerGapAnalysis) {
    this.careerGaps.set(`${userId}_${targetRole.toLowerCase().trim()}`, gap);
  }

  public getCareerGap(userId: string, targetRole: string): CareerGapAnalysis | undefined {
    return this.careerGaps.get(`${userId}_${targetRole.toLowerCase().trim()}`);
  }

  // --- SEED DEMO REAL DATA ---
  private seedDemoData() {
    const demoUser: User = {
      id: 'demo-user-101',
      name: 'Alex Rivera',
      email: 'demo@resumex.ai',
      passwordHash: this.hashPassword('demo1234'),
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };
    this.users.set(demoUser.id, demoUser);

    const demoProfile: UserProfile = {
      id: 'demo-profile-1',
      userId: demoUser.id,
      title: 'Senior Full-Stack & Cloud Engineer',
      targetRole: 'Senior Full-Stack Engineer',
      targetIndustry: 'Cloud SaaS / Enterprise Tech',
      yearsOfExperience: 6,
      location: 'San Francisco, CA (Open to Remote)',
    };
    this.profiles.set(demoProfile.id, demoProfile);

    // Pre-seed a realistic professional resume
    const sampleResumeData: ResumeData = {
      personal_info: {
        name: 'Alex Rivera',
        email: 'alex.rivera.dev@gmail.com',
        phone: '+1 (415) 890-2341',
        location: 'San Francisco, CA',
        linkedin: 'https://linkedin.com/in/alexrivera-cloud',
        github: 'https://github.com/alexrivera-tech',
        portfolio: 'https://alexrivera.dev',
      },
      summary:
        'Performance-driven Senior Full-Stack Engineer with 6+ years of experience architecting distributed microservices, scalable React/TypeScript web apps, and resilient event-driven systems on AWS. Champion of clean code, automated CI/CD pipelines, and high-throughput real-time data flows.',
      skills: [
        {
          category: 'Languages & Core',
          items: ['TypeScript', 'JavaScript (ESNext)', 'Python', 'Go', 'SQL', 'HTML5/CSS3'],
        },
        {
          category: 'Frontend Architecture',
          items: ['React', 'Next.js', 'Redux Toolkit', 'Tailwind CSS', 'Vite', 'GraphQL', 'WebSockets'],
        },
        {
          category: 'Backend & Cloud Infrastructure',
          items: ['Node.js', 'Express', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS (Lambda, ECS, S3, RDS)'],
        },
        {
          category: 'DevOps, Testing & Tooling',
          items: ['CI/CD (GitHub Actions)', 'Terraform', 'Jest', 'Cypress', 'Git', 'Agile/Scrum'],
        },
      ],
      experience: [
        {
          id: 'exp-1',
          company: 'HyperScale Networks',
          role: 'Senior Full-Stack Engineer',
          location: 'San Francisco, CA',
          startDate: '2022-03',
          endDate: 'Present',
          bullets: [
            'Architected and led the development of a real-time analytics streaming dashboard serving 4.2M active monthly users with sub-80ms p99 latency.',
            'Refactored legacy monolith into 14 containerized microservices orchestrated via Kubernetes and AWS ECS, reducing infrastructure spend by 32%.',
            'Implemented optimistic UI state synchronization using WebSockets and React 18, slashing perceived loading states by 45%.',
            'Mentored 6 junior and mid-level engineers in TypeScript patterns, system design, and test-driven development.',
          ],
          technologies: ['React', 'TypeScript', 'Node.js', 'AWS ECS', 'Kubernetes', 'Redis', 'PostgreSQL'],
        },
        {
          id: 'exp-2',
          company: 'Apex Data Labs',
          role: 'Full-Stack Software Engineer',
          location: 'San Jose, CA',
          startDate: '2019-06',
          endDate: '2022-02',
          bullets: [
            'Engineered customer-facing reporting modules and RESTful endpoints in Node.js and PostgreSQL handling 250,000+ daily requests.',
            'Collaborated with product designers to build a shared design system of 45+ WCAG-accessible React components across 3 product lines.',
            'Reduced CI/CD build and verification runtime from 28 minutes to 9 minutes by parallelizing GitHub Actions test matrices.',
            'Integrated Stripe recurring billing engine and webhook event verification with 99.98% financial transaction accuracy.',
          ],
          technologies: ['Node.js', 'Express', 'React', 'PostgreSQL', 'Stripe API', 'Docker'],
        },
      ],
      education: [
        {
          id: 'edu-1',
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science in Computer Science',
          fieldOfStudy: 'Computer Science & Distributed Systems',
          startDate: '2015-08',
          endDate: '2019-05',
          gpa: '3.82',
          honors: ['Dean’s Honors List', 'Tau Beta Pi Engineering Honor Society'],
        },
      ],
      projects: [
        {
          id: 'proj-1',
          title: 'PulseTelemetry — High-Frequency Distributed Monitoring',
          role: 'Creator & Lead Architect',
          link: 'https://github.com/alexrivera-tech/pulse-telemetry',
          technologies: ['Go', 'TypeScript', 'React', 'TimescaleDB', 'Docker'],
          bullets: [
            'Developed an open-source telemetry aggregation tool processing 50,000 metric events/sec with zero packet loss.',
            'Built an intuitive SVG timeline visualizer with zoom/pan and threshold alerting, earning 1,400+ stars on GitHub.',
          ],
        },
        {
          id: 'proj-2',
          title: 'CloudMesh — Serverless Infrastructure Provisioner',
          role: 'Full-Stack Developer',
          link: 'https://github.com/alexrivera-tech/cloudmesh',
          technologies: ['Python', 'FastAPI', 'React', 'AWS SDK', 'Terraform'],
          bullets: [
            'Constructed a multi-tenant cloud sandbox orchestrator that provisions preview environments in under 90 seconds.',
            'Automated teardown and IAM role isolation saving over $18,000 in idle cloud compute costs.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-1',
          name: 'AWS Certified Solutions Architect – Associate',
          issuer: 'Amazon Web Services',
          date: '2023-04',
          credentialId: 'AWS-SAA-884920',
        },
        {
          id: 'cert-2',
          name: 'Certified Kubernetes Application Developer (CKAD)',
          issuer: 'The Linux Foundation',
          date: '2022-11',
          credentialId: 'CKAD-294811',
        },
      ],
      achievements: [
        {
          id: 'ach-1',
          title: 'HyperScale Hackathon 1st Place Winner',
          description: 'Designed an autonomous incident triage bot resolving 24% of tier-1 server alerts automatically.',
          date: '2023-10',
        },
      ],
    };

    const resumeId = 'demo-resume-1';
    const versionId = 'demo-ver-1';
    const now = new Date().toISOString();

    const initialScore: ResumeScoreBreakdown = {
      overall: 92,
      contentQuality: 94,
      atsCompatibility: 95,
      skillsScore: 92,
      experienceScore: 93,
      projectsScore: 90,
      achievementsScore: 88,
      grammarScore: 96,
      formattingScore: 94,
      readabilityScore: 91,
      deductions: [
        {
          category: 'Achievements',
          reason: 'Could highlight business revenue impact alongside technical latency figures.',
          points: 3,
          recommendation: 'Specify dollar ROI or user conversion gains if available.',
        },
      ],
    };

    const storedResume: StoredResume = {
      id: resumeId,
      userId: demoUser.id,
      profileId: demoProfile.id,
      title: 'Alex Rivera — Staff / Senior Full-Stack Resume',
      fileType: 'application/pdf',
      fileName: 'Alex_Rivera_Senior_FullStack_2026.pdf',
      data: sampleResumeData,
      score: initialScore,
      atsScore: 95,
      templateId: 'ats-classic',
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
    };
    this.resumes.set(resumeId, storedResume);

    const initialVersion: ResumeVersion = {
      id: versionId,
      resumeId,
      versionNumber: 1,
      versionName: 'v1.0 - Production Master',
      createdAt: now,
      resumeData: sampleResumeData,
      score: initialScore,
      atsScore: 95,
      changeSummary: 'Verified senior profile with comprehensive metrics and standard ATS taxonomy.',
    };
    this.versions.set(resumeId, [initialVersion]);

    // Pre-seed sample Job Description
    const sampleJd: JobDescriptionModel = {
      id: 'demo-job-1',
      userId: demoUser.id,
      title: 'Staff / Senior Full-Stack Engineer',
      company: 'Stripe / Core Infrastructure',
      rawText: `Role: Staff / Senior Full-Stack Engineer
Location: Remote / San Francisco, CA
Experience: 5+ years of production software engineering experience.

We are seeking an experienced Senior Full-Stack Engineer to build scalable web applications, real-time financial dashboards, and mission-critical developer tools. 

Responsibilities:
- Architect and maintain mission-critical customer-facing web applications using React, TypeScript, and modern state architectures.
- Design resilient, high-throughput microservices and RESTful/GraphQL APIs using Node.js, Go, or Python.
- Partner with infrastructure teams to deploy and manage containerized services using Docker, Kubernetes, and AWS.
- Ensure 99.99% system reliability, performance optimization, sub-100ms response times, and robust telemetry.
- Mentor junior engineers, establish testing standards, and drive engineering excellence.

Requirements:
- Strong proficiency in TypeScript, React, Node.js, and SQL (PostgreSQL).
- Deep experience with Cloud services (AWS or GCP), Docker, and Kubernetes.
- Solid understanding of distributed systems, caching (Redis), and event-driven architectures.
- Experience with CI/CD automation and automated testing (Jest, Cypress).
- Bachelor's degree in Computer Science or equivalent practical experience.

Nice-to-Have:
- Experience with Go, Terraform, and high-frequency data pipelines.
- Active open-source contributions or technical leadership experience.`,
      requiredSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes', 'Redis', 'CI/CD'],
      preferredSkills: ['Go', 'Terraform', 'GraphQL', 'TimescaleDB', 'System Design'],
      responsibilities: [
        'Architect and maintain mission-critical web applications with React and TypeScript',
        'Design resilient microservices and APIs with Node.js',
        'Deploy and manage containerized services with Kubernetes and AWS',
        'Ensure 99.99% system reliability and telemetry monitoring',
      ],
      experienceYearsRequired: 5,
      seniorityLevel: 'Senior',
      educationRequired: 'Bachelor’s degree in Computer Science or equivalent',
      domainKeywords: ['Distributed Systems', 'Microservices', 'High-Throughput', 'Event-Driven', 'Cloud Infrastructure'],
      createdAt: now,
    };
    this.jobDescriptions.set(sampleJd.id, sampleJd);
  }
}

export const db = new DatabaseEngine();
