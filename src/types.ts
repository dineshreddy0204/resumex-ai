export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isDemo?: boolean;
}

export interface UserProfile {
  id: string;
  userId: string;
  headline?: string;
  targetRole?: string;
  title?: string;
  experienceYears?: number;
  yearsOfExperience?: number;
  seniorityLevel?: string;
  location?: string;
}

export interface ExtractedProvenance {
  field: string;
  sourceText: string;
  section: string;
  confidence: number;
}

export interface ResumeData {
  personal_info: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary?: string;
  skills: {
    category: string;
    items: string[];
  }[];
  experience: {
    id: string;
    company: string;
    role: string;
    location?: string;
    startDate: string;
    endDate: string;
    bullets: string[];
    technologies?: string[];
  }[];
  education: {
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startDate: string;
    endDate: string;
    gpa?: string;
  }[];
  projects: {
    id: string;
    title: string;
    link?: string;
    technologies: string[];
    bullets: string[];
  }[];
  certifications?: {
    id: string;
    name: string;
    issuer: string;
    date: string;
  }[];
  achievements?: {
    id: string;
    title: string;
    description: string;
  }[];
  links?: {
    label: string;
    url: string;
  }[];
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

export interface AnalysisIssue {
  id: string;
  issue_type: string;
  type?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  section: string;
  evidence: string;
  reason: string;
  suggestion: string;
  confidence: number;
  requires_user_confirmation: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  versionNumber: number;
  versionName: string;
  resumeData: ResumeData;
  score: ResumeScoreBreakdown;
  atsScore: number;
  changeSummary: string;
  jdScore?: number;
  targetJobId?: string;
  createdAt: string;
}

export interface JobDescriptionModel {
  id: string;
  title: string;
  company: string;
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
    category?: string;
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
  layout: 'single-column' | 'two-column-left' | 'two-column-right';
  headerStyle: 'left-aligned' | 'centered' | 'minimal' | 'banner' | 'bordered';
  sectionDivider: 'none' | 'subtle-line' | 'solid-line' | 'accent-bar';
  bulletStyle: 'disc' | 'square' | 'hyphen' | 'arrow';
  fontSizeBase: 'text-xs' | 'text-sm' | 'text-base';
  spacingDensity: 'compact' | 'normal' | 'spacious';
  atsSafe: boolean;
  tags?: string[];
}

export interface ResumeDocument {
  id: string;
  userId: string;
  title: string;
  templateId: string;
  data: ResumeData;
  score?: ResumeScoreBreakdown;
  atsScore?: number;
  sourceText?: string;
  rawText?: string;
  sourceMimeType?: string;
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OptimizationSuggestion {
  id: string;
  issueId?: string;
  section: string;
  fieldId?: string;
  before: string;
  after: string;
  reason: string;
  confidence: number;
  requires_user_confirmation: boolean;
  truthCheckVerdict: 'PASS' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';
  truthQuestion?: string;
}
