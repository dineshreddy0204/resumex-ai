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

class ApiClient {
  private csrfToken: string | null = null;

  constructor() {
    // Cookie-only architecture: session is maintained exclusively via secure HttpOnly cookies
  }

  private getCsrfFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)resumex_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  public async fetchCsrfToken(): Promise<string> {
    try {
      const res = await fetch('/api/auth/csrf', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        this.csrfToken = data.csrfToken;
        return data.csrfToken;
      }
    } catch {
      // Ignore CSRF handshake error
    }
    return '';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Attach CSRF token on mutating requests
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = this.getCsrfFromCookie() || this.csrfToken;
      if (csrf) {
        headers.set('X-CSRF-Token', csrf);
      }
    }

    const response = await fetch(`/api${endpoint}`, {
      credentials: 'include', // Transmits secure HttpOnly session cookies across environments
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      const message =
        errorData && errorData.error && typeof errorData.error === 'object'
          ? errorData.error.message
          : errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    return response.json();
  }

  // --- Auth ---
  public async demoLogin(): Promise<{ user: User; profile: UserProfile }> {
    return this.request<{ user: User; profile: UserProfile }>('/auth/demo-login', {
      method: 'POST',
    });
  }

  public async login(email: string, password: string): Promise<{ user: User; profile: UserProfile }> {
    return this.request<{ user: User; profile: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  public async signup(
    name: string,
    email: string,
    password: string
  ): Promise<{
    user: User;
    profile?: UserProfile;
    requiresVerification?: boolean;
    message?: string;
    devVerificationUrl?: string;
  }> {
    return this.request<{
      user: User;
      profile?: UserProfile;
      requiresVerification?: boolean;
      message?: string;
      devVerificationUrl?: string;
    }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  public async verifyEmail(token: string): Promise<{ user: User; profile: UserProfile; message?: string }> {
    return this.request<{ user: User; profile: UserProfile; message?: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  public async googleAuth(idToken: string): Promise<{ user: User; profile: UserProfile }> {
    return this.request<{ user: User; profile: UserProfile }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, credential: idToken }),
    });
  }

  public async forgotPassword(email: string): Promise<{ message: string; resetToken?: string; expiresAt?: string }> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  public async deleteAccount(): Promise<{ success: boolean; message: string }> {
    const res = await this.request<{ success: boolean; message: string }>('/auth/delete-account', {
      method: 'DELETE',
    });
    await this.logout();
    return res;
  }

  public async updateProfile(updates: Partial<UserProfile>): Promise<{ profile: UserProfile }> {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public async verifyTruth(originalText: string, proposedText: string, resumeId?: string): Promise<{ verification: any }> {
    return this.request('/truth/verify', {
      method: 'POST',
      body: JSON.stringify({ originalText, proposedText, resumeId }),
    });
  }

  public async getMe(): Promise<{ user: User; profile: UserProfile }> {
    return this.request<{ user: User; profile: UserProfile }>('/auth/me');
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  public async getSessions(): Promise<{
    sessions: Array<{
      id: string;
      ipAddress: string;
      userAgent: string;
      createdAt: string;
      expiresAt: string;
      isCurrent: boolean;
    }>;
  }> {
    return this.request('/auth/sessions');
  }

  public async revokeSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  public async revokeAllOtherSessions(): Promise<{ success: boolean; revokedCount: number; message: string }> {
    return this.request('/auth/sessions-revoke-others', {
      method: 'DELETE',
    });
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

  public async createResume(payload: {
    title?: string;
    data?: any;
    templateId?: string;
  }): Promise<{ resume: ResumeDocument }> {
    return this.request('/resumes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

  public async batchActionIssues(
    resumeId: string,
    issueIds: string[],
    action: 'accepted' | 'rejected'
  ): Promise<{ success: boolean; updatedCount: number; issues: AnalysisIssue[] }> {
    return this.request(`/resumes/${id(resumeId)}/issues/batch-action`, {
      method: 'POST',
      body: JSON.stringify({ issueIds, action }),
    });
  }

  public async fixSafeIssues(
    resumeId: string
  ): Promise<{
    success: boolean;
    fixedCount: number;
    skippedRiskyCount: number;
    message: string;
    resume: ResumeDocument;
  }> {
    return this.request(`/resumes/${id(resumeId)}/issues/fix-safe`, {
      method: 'POST',
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

  public async restoreVersion(
    resumeId: string,
    versionId: string
  ): Promise<{ success: boolean; message: string; resume: ResumeDocument }> {
    return this.request(`/resumes/${id(resumeId)}/versions/${id(versionId)}/restore`, {
      method: 'POST',
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

  public async exportDocx(data: any, templateId?: string): Promise<Blob> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const csrf = this.getCsrfFromCookie() || this.csrfToken;
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
    const response = await fetch('/api/exports/docx', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ data, templateId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'DOCX export failed' }));
      const message =
        errorData && errorData.error && typeof errorData.error === 'object'
          ? errorData.error.message
          : errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }
    return response.blob();
  }

  public async exportPdf(data: any, templateId?: string): Promise<Blob> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const csrf = this.getCsrfFromCookie() || this.csrfToken;
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
    const response = await fetch('/api/exports/pdf', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ data, templateId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'PDF export failed' }));
      const message =
        errorData && errorData.error && typeof errorData.error === 'object'
          ? errorData.error.message
          : errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }
    return response.blob();
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
