import type {
  User,
  UserProfile,
  ResumeDocument,
  ResumeVersion,
  AnalysisIssue,
  ResumeScoreBreakdown,
  AtsSimulationResult,
  JobDescriptionModel,
  JobMatchResult,
  CareerGapAnalysis,
  TemplateDefinition,
  OptimizationSuggestion,
  ExtractedProvenance,
} from '../types';

const TOKEN_KEY = 'resumex_auth_token';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // --- Auth ---
  public async demoLogin(): Promise<{ user: User; profile: UserProfile; token: string }> {
    const data = await this.request<{ user: User; profile: UserProfile; token: string }>('/auth/demo-login', {
      method: 'POST',
    });
    this.setToken(data.token);
    return data;
  }

  public async login(email: string, password: string): Promise<{ user: User; profile: UserProfile; token: string }> {
    const data = await this.request<{ user: User; profile: UserProfile; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  public async signup(name: string, email: string, password: string): Promise<{ user: User; profile: UserProfile; token: string }> {
    const data = await this.request<{ user: User; profile: UserProfile; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  public async getMe(): Promise<{ user: User; profile: UserProfile }> {
    return this.request<{ user: User; profile: UserProfile }>('/auth/me');
  }

  public logout() {
    this.setToken(null);
  }

  // --- Health ---
  public async checkHealth(): Promise<{ status: string; geminiEnabled: boolean; timestamp: string }> {
    return this.request('/health');
  }

  // --- Resumes ---
  public async getResumes(): Promise<ResumeDocument[]> {
    const res = await this.request<{ resumes: ResumeDocument[] }>('/resumes');
    return res.resumes;
  }

  public async getResume(id: string): Promise<{ resume: ResumeDocument; versions: ResumeVersion[]; issues: AnalysisIssue[] }> {
    return this.request(`/resumes/${id}`);
  }

  public async uploadResume(payload: {
    fileBase64?: string;
    fileName?: string;
    mimeType?: string;
    rawText?: string;
  }): Promise<{
    resume: ResumeDocument;
    parsedLayout: any;
    provenance: ExtractedProvenance[];
    scores: ResumeScoreBreakdown;
    atsAnalysis: AtsSimulationResult;
    issues: AnalysisIssue[];
  }> {
    return this.request('/resumes/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateResume(id: string, data: any, title?: string, templateId?: string): Promise<{ resume: ResumeDocument }> {
    return this.request(`/resumes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ data, title, templateId }),
    });
  }

  public async deleteResume(id: string): Promise<{ success: boolean }> {
    return this.request(`/resumes/${id}`, {
      method: 'DELETE',
    });
  }

  public async analyzeResume(id: string): Promise<{
    score: ResumeScoreBreakdown;
    ats: AtsSimulationResult;
    issues: AnalysisIssue[];
  }> {
    return this.request(`/resumes/${id}/analyze`, {
      method: 'POST',
    });
  }

  // --- Optimization & Truth Verification ---
  public async optimizeBullet(
    resumeId: string,
    bullet: string,
    roleTitle?: string,
    company?: string
  ): Promise<{ suggestion: OptimizationSuggestion }> {
    return this.request(`/resumes/${id(resumeId)}/optimize/bullet`, {
      method: 'POST',
      body: JSON.stringify({ bullet, roleTitle, company }),
    });
  }

  public async optimizeSummary(
    resumeId: string,
    currentSummary: string,
    targetRole?: string
  ): Promise<{ suggestion: OptimizationSuggestion }> {
    return this.request(`/resumes/${id(resumeId)}/optimize/summary`, {
      method: 'POST',
      body: JSON.stringify({ currentSummary, targetRole }),
    });
  }

  public async updateIssueStatus(
    resumeId: string,
    issueId: string,
    action: 'accepted' | 'rejected' | 'edited'
  ): Promise<{ issue: AnalysisIssue }> {
    return this.request(`/resumes/${id(resumeId)}/issues/${issueId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  // --- Versions ---
  public async getVersions(resumeId: string): Promise<ResumeVersion[]> {
    const res = await this.request<{ versions: ResumeVersion[] }>(`/resumes/${id(resumeId)}/versions`);
    return res.versions;
  }

  public async createVersion(
    resumeId: string,
    versionName: string,
    changeSummary: string,
    targetJobId?: string
  ): Promise<{ version: ResumeVersion }> {
    return this.request(`/resumes/${id(resumeId)}/versions`, {
      method: 'POST',
      body: JSON.stringify({ versionName, changeSummary, targetJobId }),
    });
  }

  public async compareVersions(
    resumeId: string,
    versionAId: string,
    versionBId: string,
    targetJobId?: string
  ): Promise<{ comparison: any }> {
    return this.request(`/resumes/${id(resumeId)}/versions/compare`, {
      method: 'POST',
      body: JSON.stringify({ versionAId, versionBId, targetJobId }),
    });
  }

  // --- Job Descriptions & Matching ---
  public async getJobs(): Promise<JobDescriptionModel[]> {
    const res = await this.request<{ jobs: JobDescriptionModel[] }>('/jobs');
    return res.jobs;
  }

  public async createJob(rawText: string, title?: string, company?: string): Promise<{ job: JobDescriptionModel }> {
    return this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify({ rawText, title, company }),
    });
  }

  public async matchJob(jobId: string, resumeId: string): Promise<{ match: JobMatchResult }> {
    return this.request(`/jobs/${jobId}/match/${resumeId}`, {
      method: 'POST',
    });
  }

  // --- Career Gap Engine ---
  public async analyzeCareerGap(resumeId: string, targetRole: string): Promise<{ careerGap: CareerGapAnalysis }> {
    return this.request('/career/gap', {
      method: 'POST',
      body: JSON.stringify({ resumeId, targetRole }),
    });
  }

  // --- Templates ---
  public async getTemplates(): Promise<{ count: number; templates: TemplateDefinition[] }> {
    return this.request('/templates');
  }

  // --- Exports ---
  public async validateExport(data: any): Promise<{ validation: any }> {
    return this.request('/exports/validate', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  public async exportPlainText(data: any): Promise<{ plainText: string }> {
    return this.request('/exports/plain-text', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  // --- NLP Evaluation Suite ---
  public async runEvaluation(): Promise<{ report: any }> {
    return this.request('/evaluation');
  }
}

function id(str: string): string {
  return encodeURIComponent(str);
}

export const api = new ApiClient();
