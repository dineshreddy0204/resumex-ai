export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpiresAt?: string;
  resetToken?: string;
  resetTokenExpiresAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  title: string; // e.g. "Senior Full-Stack Engineer"
  targetRole: string;
  targetIndustry?: string;
  yearsOfExperience: number;
  location: string;
  bio?: string;
  primaryResumeId?: string;
}

export interface ResumeData {
  personal_info: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary: string;
  skills: {
    category: string;
    items: string[];
  }[];
  experience: {
    id: string;
    company: string;
    role: string;
    title?: string;
    location?: string;
    startDate: string;
    endDate: string; // or "Present"
    current?: boolean;
    bullets: string[];
    technologies?: string[];
  }[];
  education: {
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    field?: string;
    field_of_study?: string;
    startDate: string;
    endDate: string;
    gpa?: string;
    honors?: string[];
  }[];
  projects: {
    id: string;
    title: string;
    role?: string;
    link?: string;
    technologies: string[];
    bullets: string[];
  }[];
  certifications: {
    id: string;
    name: string;
    issuer: string;
    date: string;
    issueDate?: string;
    link?: string;
    credentialId?: string;
  }[];
  achievements: {
    id: string;
    title: string;
    description: string;
    date?: string;
    metric?: string;
  }[];
  publications?: {
    id: string;
    title: string;
    publisher: string;
    date: string;
    link?: string;
  }[];
  links?: {
    label: string;
    url: string;
  }[];
  customSections?: {
    id: string;
    heading: string;
    content: string[];
  }[];
}

export interface ExtractedProvenance {
  field: string;
  sourceText: string;
  section: string;
  confidence: number;
  page?: number;
}

export interface AnalysisIssue {
  id: string;
  issue_type:
    | 'weak_bullet'
    | 'missing_metric'
    | 'passive_voice'
    | 'vague_phrase'
    | 'redundancy'
    | 'formatting_hazard'
    | 'missing_section'
    | 'non_standard_heading'
    | 'keyword_gap'
    | 'overlong_sentence';
  type?: string;
  severity: 'high' | 'medium' | 'low';
  section: string;
  evidence: string;
  reason: string;
  suggestion: string;
  confidence: number;
  requires_user_confirmation: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
  proposedText?: string;
}

export interface ResumeScoreBreakdown {
  overall: number;
  contentQuality: number;
  atsCompatibility: number;
  skillsScore: number;
  experienceScore: number;
  projectsScore: number;
  achievementsScore: number;
  grammarScore: number;
  formattingScore: number;
  readabilityScore: number;
  jobRelevance?: number;
  deductions: {
    category: string;
    reason: string;
    points: number;
    recommendation: string;
  }[];
}

export interface AtsSimulationResult {
  overallAtsScore: number;
  keywordCoverage: number;
  semanticAlignment: number;
  formattingSafety: number;
  sectionDetection: {
    section: string;
    detected: boolean;
    isStandard: boolean;
    headingUsed: string;
  }[];
  skillRelevance: number;
  majorDeductions: {
    factor: string;
    penalty: number;
    explanation: string;
    fix: string;
  }[];
  fileSafety: {
    isMachineReadable: boolean;
    tablesDetected: boolean;
    columnsDetected: boolean;
    headerFooterRisk: boolean;
    imagesIconsDetected: boolean;
    fontSafetyScore: number;
  };
  keywordEvidence?: {
    explanation: string;
    matchedTerms: string[];
    missingTerms: string[];
    totalRelevantTerms: number;
    matchedCount: number;
    stuffingRisk: 'None' | 'Low' | 'Moderate' | 'High';
    stuffingDetected: boolean;
    extractedKeywordCount: number;
    repeatedKeywordCount: number;
    sectionDistribution: { section: string; count: number }[];
    requiredSkillCoverage?: number;
    preferredSkillCoverage?: number;
  };
  engineSimulations?: {
    engine: 'Workday' | 'Greenhouse' | 'Taleo' | 'Lever' | 'iCIMS';
    simulationLabel?: string;
    score: number;
    verdict: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    primaryRisk: string;
    parsingModel: string;
    strengths: string[];
    weaknesses: string[];
  }[];
}

export interface JobDescriptionModel {
  id: string;
  userId: string;
  title: string;
  company?: string;
  location?: string;
  rawText: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  experienceYearsRequired: number;
  seniorityLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  educationRequired?: string;
  domainKeywords: string[];
  createdAt: string;
}

export interface JobMatchResult {
  resumeId?: string;
  jobId: string;
  jobTitle: string;
  overallMatch: number;
  keywordMatch: number;
  semanticMatch: number;
  skillMatch: number;
  experienceMatch: number;
  educationMatch: number;
  responsibilityMatch: number;
  matchedSkills: {
    skill: string;
    evidenceInResume: string;
    confidence: number;
  }[];
  missingSkills: {
    skill: string;
    priority: 'High' | 'Medium' | 'Low';
    category: string;
  }[];
  experienceAlignmentNote: string;
  recommendations: string[];
  semanticSource?: 'embedding' | 'fallback';
}

export interface EmploymentGap {
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
}

export interface CareerGapAnalysis {
  userId?: string;
  resumeId?: string;
  targetRole: string;
  currentSkills: {
    skill: string;
    proficiency: number;
    hasEvidence: boolean;
    evidenceCount: number;
  }[];
  strongSkills: string[];
  developingSkills: string[];
  missingSkills: {
    skill: string;
    priority: 'High' | 'Medium' | 'Low';
    importanceReason: string;
  }[];
  evidenceGaps: {
    skillOrRequirement: string;
    issue: string;
    recommendedAction: string;
  }[];
  employmentGaps?: EmploymentGap[];
  actionPlan: {
    skillsToLearn: string[];
    recommendedProjects: {
      title: string;
      description: string;
      demonstratedSkills: string[];
    }[];
    resumeAdditions: string[];
  };
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  versionNumber?: number;
  versionName: string;
  createdAt: string;
  resumeData?: ResumeData;
  data?: ResumeData;
  score?: ResumeScoreBreakdown;
  atsScore?: number;
  jdMatchScore?: number;
  targetJobScore?: number;
  targetJobId?: string;
  changeSummary?: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  category: 'ATS' | 'Modern' | 'Professional' | 'Technical' | 'Fresher' | 'Executive' | 'Creative';
  description: string;
  fontFamily: string;
  headerFontFamily: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  layout: 'single-column' | 'two-column-left' | 'two-column-right' | 'compact-grid';
  headerStyle: 'minimal' | 'banner' | 'centered' | 'left-aligned' | 'bordered';
  sectionDivider: 'none' | 'subtle-line' | 'solid-line' | 'accent-bar' | 'card';
  bulletStyle: 'disc' | 'hyphen' | 'square' | 'none';
  fontSizeBase: string;
  spacingDensity: 'compact' | 'normal' | 'spacious';
  atsSafe: boolean;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'Resume' | 'Skill' | 'Project' | 'Experience' | 'Achievement' | 'JobRequirement';
}

export interface KnowledgeGraphEdge {
  from: string;
  to: string;
  relationship: 'DEMONSTRATES' | 'APPLIES' | 'RESULTS_IN' | 'REQUIRES' | 'VERIFIES';
  weight?: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  resourceId: string;
  resourceType: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
