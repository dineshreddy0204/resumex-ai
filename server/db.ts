import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
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

// Optional PostgreSQL connection if DATABASE_URL is configured
const hasDatabaseUrl = !!process.env.DATABASE_URL;
if (!hasDatabaseUrl && process.env.NODE_ENV === 'production') {
  console.warn('[Database] DATABASE_URL not set in environment. Using robust persistent local storage engine.');
}

export interface StoredResume {
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

interface PersistedState {
  users: Record<string, User>;
  profiles: Record<string, UserProfile>;
  resumes: Record<string, StoredResume>;
  versions: Record<string, ResumeVersion[]>;
  jobDescriptions: Record<string, JobDescriptionModel>;
  jobMatches: Record<string, JobMatchResult>;
  issues: Record<string, AnalysisIssue[]>;
  careerGaps: Record<string, CareerGapAnalysis>;
  auditEvents: AuditEvent[];
}

export class DatabaseEngine {
  private users: Map<string, User> = new Map();
  private profiles: Map<string, UserProfile> = new Map();
  private resumes: Map<string, StoredResume> = new Map();
  private versions: Map<string, ResumeVersion[]> = new Map(); // resumeId -> versions
  private jobDescriptions: Map<string, JobDescriptionModel> = new Map();
  private jobMatches: Map<string, JobMatchResult> = new Map(); // `${resumeId}_${jobId}` -> match
  private issues: Map<string, AnalysisIssue[]> = new Map(); // resumeId -> issues
  private careerGaps: Map<string, CareerGapAnalysis> = new Map(); // `${userId}_${role}` -> gap
  private auditEvents: AuditEvent[] = [];

  private storageFile: string;
  private pgPool: Pool | null = null;

  constructor() {
    const dataDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        // ignore if already exists
      }
    }
    this.storageFile = path.join(dataDir, 'resumex_core_ultra_db.json');

    if (process.env.DATABASE_URL) {
      try {
        this.pgPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 10,
          connectionTimeoutMillis: 5000,
        });
        console.log('[DB] PostgreSQL pool configured with DATABASE_URL.');
      } catch (err) {
        console.error('[DB] Failed to initialize PostgreSQL pool:', err);
      }
    }

    this.loadState();
    if (this.users.size === 0) {
      this.seedDemoData();
      this.persistState();
    }
  }

  private persistState() {
    try {
      const state: PersistedState = {
        users: Object.fromEntries(this.users),
        profiles: Object.fromEntries(this.profiles),
        resumes: Object.fromEntries(this.resumes),
        versions: Object.fromEntries(this.versions),
        jobDescriptions: Object.fromEntries(this.jobDescriptions),
        jobMatches: Object.fromEntries(this.jobMatches),
        issues: Object.fromEntries(this.issues),
        careerGaps: Object.fromEntries(this.careerGaps),
        auditEvents: this.auditEvents.slice(-500), // Keep last 500 audit logs
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to persist state to disk:', err);
    }
  }

  private loadState() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const state: PersistedState = JSON.parse(raw);
        this.users = new Map(Object.entries(state.users || {}));
        this.profiles = new Map(Object.entries(state.profiles || {}));
        this.resumes = new Map(Object.entries(state.resumes || {}));
        this.versions = new Map(Object.entries(state.versions || {}));
        this.jobDescriptions = new Map(Object.entries(state.jobDescriptions || {}));
        this.jobMatches = new Map(Object.entries(state.jobMatches || {}));
        this.issues = new Map(Object.entries(state.issues || {}));
        this.careerGaps = new Map(Object.entries(state.careerGaps || {}));
        this.auditEvents = state.auditEvents || [];
      }
    } catch (err) {
      console.error('[DB] Failed to load persisted state, starting fresh:', err);
    }
  }

  // --- PASSWORD SECURITY (Argon2 / bcryptjs standard) ---
  public async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
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
    this.persistState();
  }

  public getAuditEvents(userId: string): AuditEvent[] {
    return this.auditEvents.filter((a) => a.userId === userId);
  }

  // --- USER MANAGEMENT & OWNERSHIP ---
  public async createUser(name: string, email: string, password: string): Promise<{ user: User; verificationToken: string }> {
    const cleanEmail = email.toLowerCase().trim();
    const existing = this.getUserByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    // Real secure email verification token (single-use, hashed, expires in 24 hours)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const passwordHash = await this.hashPassword(password);
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email: cleanEmail,
      passwordHash,
      emailVerified: false, // Strict: unverified until token is confirmed
      verificationToken: hashedToken,
      verificationTokenExpiresAt: expiresAt,
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);

    // Default career profile
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      userId: user.id,
      title: 'Senior Software Engineer',
      targetRole: 'Software Engineer',
      yearsOfExperience: 3,
      location: 'San Francisco, CA',
    };
    this.profiles.set(profile.id, profile);

    this.logAudit(user.id, 'USER_SIGNUP', 'User', user.id, { email: cleanEmail });
    this.persistState();
    return { user, verificationToken };
  }

  public verifyEmailToken(rawToken: string): User {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date().toISOString();

    for (const user of this.users.values()) {
      if (user.verificationToken === hashedToken) {
        if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < now) {
          throw new Error('Email verification token has expired. Please request a new verification email.');
        }
        user.emailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined;
        user.updatedAt = now;
        this.users.set(user.id, user);
        this.logAudit(user.id, 'EMAIL_VERIFIED', 'User', user.id);
        this.persistState();
        return user;
      }
    }
    throw new Error('Invalid or already used verification token.');
  }

  public createPasswordResetToken(email: string): { resetToken: string; expiresAt: string } {
    const cleanEmail = email.toLowerCase().trim();
    const user = this.getUserByEmail(cleanEmail);
    if (!user) {
      throw new Error('No user account found with this email address.');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    user.resetToken = hashedToken;
    user.resetTokenExpiresAt = expiresAt;
    user.updatedAt = new Date().toISOString();
    this.users.set(user.id, user);
    this.logAudit(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id);
    this.persistState();

    return { resetToken, expiresAt };
  }

  public async resetPasswordWithToken(rawToken: string, newPassword: string): Promise<User> {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date().toISOString();

    for (const user of this.users.values()) {
      if (user.resetToken === hashedToken) {
        if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < now) {
          throw new Error('Password reset token has expired. Please request a new link.');
        }
        user.passwordHash = await this.hashPassword(newPassword);
        user.resetToken = undefined;
        user.resetTokenExpiresAt = undefined;
        user.updatedAt = now;
        this.users.set(user.id, user);
        this.logAudit(user.id, 'PASSWORD_RESET_COMPLETED', 'User', user.id);
        this.persistState();
        return user;
      }
    }
    throw new Error('Invalid or expired password reset token.');
  }

  public async createOrLinkGoogleUser(payload: { email: string; name: string; googleId?: string }): Promise<User> {
    const cleanEmail = payload.email.toLowerCase().trim();
    let user = this.getUserByEmail(cleanEmail);

    if (!user) {
      const dummyPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await this.hashPassword(dummyPassword);
      user = {
        id: crypto.randomUUID(),
        name: payload.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        passwordHash,
        emailVerified: true, // Google OAuth confirms email ownership
        isDemo: false,
        createdAt: new Date().toISOString(),
      };
      this.users.set(user.id, user);

      const profile: UserProfile = {
        id: crypto.randomUUID(),
        userId: user.id,
        title: 'Software Engineer',
        targetRole: 'Software Engineer',
        yearsOfExperience: 3,
        location: 'San Francisco, CA',
      };
      this.profiles.set(profile.id, profile);
      this.logAudit(user.id, 'GOOGLE_OAUTH_SIGNUP', 'User', user.id);
    } else {
      user.emailVerified = true;
      this.logAudit(user.id, 'GOOGLE_OAUTH_LOGIN', 'User', user.id);
    }

    this.persistState();
    return user;
  }

  public deleteUserAccount(userId: string) {
    const user = this.users.get(userId);
    if (!user) return;

    // Cascade delete resumes & versions
    for (const [resId, res] of this.resumes.entries()) {
      if (res.userId === userId) {
        this.resumes.delete(resId);
        this.versions.delete(resId);
        this.issues.delete(resId);
      }
    }

    // Cascade delete job matches & descriptions
    for (const [jdId, jd] of this.jobDescriptions.entries()) {
      if (jd.userId === userId) {
        this.jobDescriptions.delete(jdId);
      }
    }

    // Cascade delete profiles
    for (const [profId, prof] of this.profiles.entries()) {
      if (prof.userId === userId) {
        this.profiles.delete(profId);
      }
    }

    this.users.delete(userId);
    this.logAudit(userId, 'USER_DELETED', 'User', userId);
    this.persistState();
  }

  public getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  public getUserByEmail(email: string): User | undefined {
    const clean = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email === clean) return user;
    }
    return undefined;
  }

  public getProfileByUserId(userId: string): UserProfile | undefined {
    for (const profile of this.profiles.values()) {
      if (profile.userId === userId) return profile;
    }
    return undefined;
  }

  public getProfilesByUser(userId: string): UserProfile[] {
    const prof = this.getProfileByUserId(userId);
    return prof ? [prof] : [];
  }

  public updateProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
    let profile = this.getProfileByUserId(userId);
    if (!profile) {
      profile = {
        id: crypto.randomUUID(),
        userId,
        title: updates.title || 'Software Engineer',
        targetRole: updates.targetRole || 'Software Engineer',
        yearsOfExperience: updates.yearsOfExperience || 3,
        location: updates.location || 'San Francisco, CA',
      };
      this.profiles.set(profile.id, profile);
    } else {
      Object.assign(profile, updates);
      this.profiles.set(profile.id, profile);
    }
    this.persistState();
    return profile;
  }

  // --- RESUME MANAGEMENT ---
  public getResumesByUser(userId: string): StoredResume[] {
    const list: StoredResume[] = [];
    for (const r of this.resumes.values()) {
      if (r.userId === userId) {
        if (!r.score) {
          r.score = {
            overall: r.atsScore || 85,
            contentQuality: 85,
            atsCompatibility: r.atsScore || 85,
            skillsScore: 85,
            experienceScore: 85,
            projectsScore: 85,
            achievementsScore: 85,
            grammarScore: 90,
            formattingScore: 90,
            readabilityScore: 88,
            deductions: [],
          };
        }
        list.push(r);
      }
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getResumeById(id: string, userId?: string): StoredResume | undefined {
    const res = this.resumes.get(id);
    if (!res) return undefined;
    if (userId && res.userId !== userId) {
      return undefined; // Security: User ownership isolation
    }
    if (!res.score) {
      res.score = {
        overall: res.atsScore || 85,
        contentQuality: 85,
        atsCompatibility: res.atsScore || 85,
        skillsScore: 85,
        experienceScore: 85,
        projectsScore: 85,
        achievementsScore: 85,
        grammarScore: 90,
        formattingScore: 90,
        readabilityScore: 88,
        deductions: [],
      };
    }
    return res;
  }

  public getResume(userId: string, resumeId: string): StoredResume {
    const res = this.getResumeById(resumeId, userId);
    if (!res) {
      throw new Error(`Resume ${resumeId} not found or unauthorized.`);
    }
    return res;
  }

  public updateResumeScores(userId: string, resumeId: string, score: ResumeScoreBreakdown, atsScore?: number): StoredResume {
    const res = this.getResume(userId, resumeId);
    res.score = score;
    if (atsScore !== undefined) res.atsScore = atsScore;
    res.updatedAt = new Date().toISOString();
    this.resumes.set(resumeId, res);
    this.persistState();
    return res;
  }

  public updateResumeData(userId: string, resumeId: string, data: ResumeData, title?: string, templateId?: string): StoredResume {
    return this.updateResume(resumeId, data, title, templateId, userId);
  }

  public saveResume(
    resumeOrUserId: StoredResume | string,
    data?: ResumeData,
    title?: string,
    templateId?: string,
    rawText?: string,
    fileType?: string,
    fileName?: string
  ): StoredResume {
    if (typeof resumeOrUserId === 'object') {
      const resume = resumeOrUserId;
      if (!resume.score) {
        resume.score = {
          overall: resume.atsScore || 85,
          contentQuality: 85,
          atsCompatibility: resume.atsScore || 85,
          skillsScore: 85,
          experienceScore: 85,
          projectsScore: 85,
          achievementsScore: 85,
          grammarScore: 90,
          formattingScore: 90,
          readabilityScore: 88,
          deductions: [],
        };
      }
      this.resumes.set(resume.id, resume);
      this.persistState();
      return resume;
    }

    const userId = resumeOrUserId;
    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const initialScore: ResumeScoreBreakdown = {
      overall: 85,
      contentQuality: 85,
      atsCompatibility: 85,
      skillsScore: 85,
      experienceScore: 85,
      projectsScore: 85,
      achievementsScore: 85,
      grammarScore: 90,
      formattingScore: 90,
      readabilityScore: 88,
      deductions: [],
    };

    const newResume: StoredResume = {
      id,
      userId,
      profileId: this.getProfileByUserId(userId)?.id || 'default-prof',
      title: title || 'Untitled Resume',
      rawText,
      fileType,
      fileName,
      data: data!,
      score: initialScore,
      atsScore: 85,
      templateId: templateId || 'ats-classic',
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
    };

    this.resumes.set(id, newResume);
    const v1: ResumeVersion = {
      id: versionId,
      resumeId: id,
      versionNumber: 1,
      versionName: 'v1.0 - Initial Upload',
      createdAt: now,
      resumeData: data!,
      score: initialScore,
      atsScore: 85,
      changeSummary: 'Initial structured resume model extracted.',
    };
    this.saveVersion(v1, userId);
    this.persistState();
    return newResume;
  }

  public updateResume(
    id: string,
    data: ResumeData,
    title?: string,
    templateId?: string,
    userId?: string
  ): StoredResume {
    const existing = this.getResumeById(id, userId);
    if (!existing) {
      throw new Error('Resume not found or unauthorized access.');
    }
    existing.data = data;
    if (title) existing.title = title;
    if (templateId) existing.templateId = templateId;
    existing.updatedAt = new Date().toISOString();
    this.resumes.set(id, existing);
    this.persistState();
    return existing;
  }

  public deleteResume(id: string, userId?: string) {
    const existing = this.getResumeById(id, userId);
    if (!existing) {
      throw new Error('Resume not found or unauthorized access.');
    }
    this.resumes.delete(id);
    this.versions.delete(id);
    this.issues.delete(id);
    this.persistState();
  }

  // --- VERSIONING ---
  public getVersions(resumeId: string, userId?: string): ResumeVersion[] {
    const res = this.getResumeById(resumeId, userId);
    if (!res) return [];
    return this.versions.get(resumeId) || [];
  }

  public saveVersion(version: ResumeVersion, userId?: string) {
    const res = this.getResumeById(version.resumeId, userId);
    if (!res) throw new Error('Resume not found or unauthorized access.');
    const list = this.versions.get(version.resumeId) || [];
    list.push(version);
    this.versions.set(version.resumeId, list);
    this.persistState();
  }

  public createVersion(
    userId: string,
    resumeId: string,
    versionName: string,
    data: ResumeData,
    score?: ResumeScoreBreakdown,
    atsScore?: number,
    changeSummary?: string,
    targetJobScore?: number,
    targetJobId?: string
  ): ResumeVersion {
    const cloned = JSON.parse(JSON.stringify(data));
    const version: ResumeVersion = {
      id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      resumeId,
      versionName,
      versionNumber: (this.getVersions(resumeId, userId).length || 0) + 1,
      resumeData: cloned,
      data: cloned,
      score: score || {
        overall: 80,
        contentQuality: 80,
        atsCompatibility: atsScore ?? 80,
        skillsScore: 80,
        experienceScore: 80,
        projectsScore: 80,
        achievementsScore: 80,
        grammarScore: 80,
        formattingScore: 80,
        readabilityScore: 80,
        deductions: [],
      },
      atsScore: atsScore ?? 80,
      changeSummary: changeSummary || 'Version revision.',
      targetJobScore,
      targetJobId,
      createdAt: new Date().toISOString(),
    };
    this.saveVersion(version, userId);
    return version;
  }

  // --- ISSUES & SUGGESTIONS ---
  public getIssues(resumeId: string, userId?: string): AnalysisIssue[] {
    const res = this.getResumeById(resumeId, userId);
    if (!res) return [];
    return this.issues.get(resumeId) || [];
  }

  public setIssues(arg1: string, arg2: string | AnalysisIssue[], arg3?: AnalysisIssue[] | string) {
    let resumeId: string;
    let issues: AnalysisIssue[];
    let userId: string | undefined;

    if (Array.isArray(arg2)) {
      resumeId = arg1;
      issues = arg2;
      userId = typeof arg3 === 'string' ? arg3 : undefined;
    } else {
      userId = arg1;
      resumeId = arg2;
      issues = (arg3 as AnalysisIssue[]) || [];
    }

    const res = this.getResumeById(resumeId, userId);
    if (!res) throw new Error('Resume not found or unauthorized access.');
    this.issues.set(resumeId, issues);
    this.persistState();
  }

  public updateIssueStatus(
    arg1: string,
    arg2: string,
    arg3: string,
    arg4?: string
  ): AnalysisIssue {
    let resumeId: string;
    let issueId: string;
    let status: 'pending' | 'accepted' | 'rejected';
    let userId: string | undefined;

    if (arg4) {
      userId = arg1;
      resumeId = arg2;
      issueId = arg3;
      status = (arg4 === 'accepted' || arg4 === 'rejected' ? arg4 : 'pending') as 'pending' | 'accepted' | 'rejected';
    } else {
      resumeId = arg1;
      issueId = arg2;
      status = (arg3 === 'accepted' || arg3 === 'rejected' ? arg3 : 'pending') as 'pending' | 'accepted' | 'rejected';
    }

    const res = this.getResumeById(resumeId, userId);
    if (!res) throw new Error('Resume not found or unauthorized access.');
    const issues = this.issues.get(resumeId) || [];
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) throw new Error('Issue not found');
    issue.status = status;
    this.issues.set(resumeId, issues);
    this.persistState();
    return issue;
  }

  // --- JOB MATCHING & CAREER GAPS ---
  public getJobDescription(id: string, userId?: string): JobDescriptionModel | undefined {
    const jd = this.jobDescriptions.get(id);
    if (!jd) return undefined;
    if (userId && jd.userId && jd.userId !== userId) return undefined;
    return jd;
  }

  public getJobDescriptions(userId?: string): JobDescriptionModel[] {
    const all = Array.from(this.jobDescriptions.values());
    if (!userId) return all;
    return all.filter((j) => !j.userId || j.userId === userId);
  }

  public saveJobDescription(
    jobOrUserId: string | Partial<JobDescriptionModel>,
    maybeJob?: Partial<JobDescriptionModel>
  ): JobDescriptionModel {
    let raw: Partial<JobDescriptionModel>;
    let userId: string = 'default';
    if (typeof jobOrUserId === 'string') {
      userId = jobOrUserId;
      raw = maybeJob || {};
    } else {
      raw = jobOrUserId || {};
      userId = raw.userId || 'default';
    }
    const job: JobDescriptionModel = {
      id: raw.id || `jd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      title: raw.title || 'Untitled Job',
      company: raw.company || 'Unknown Company',
      rawText: raw.rawText || '',
      requiredSkills: raw.requiredSkills || [],
      preferredSkills: raw.preferredSkills || [],
      responsibilities: raw.responsibilities || [],
      experienceYearsRequired: raw.experienceYearsRequired || 3,
      seniorityLevel: raw.seniorityLevel || 'Mid',
      educationRequired: raw.educationRequired,
      domainKeywords: raw.domainKeywords || [],
      createdAt: raw.createdAt || new Date().toISOString(),
    };
    this.jobDescriptions.set(job.id, job);
    this.persistState();
    return job;
  }

  public getJobMatch(resumeId: string, jobId: string, userId?: string): JobMatchResult | undefined {
    const res = this.getResumeById(resumeId, userId);
    if (!res) return undefined;
    return this.jobMatches.get(`${resumeId}_${jobId}`);
  }

  public saveJobMatch(
    arg1: string | JobMatchResult,
    resumeId?: string,
    jobId?: string,
    matchResult?: JobMatchResult
  ): JobMatchResult {
    let match: JobMatchResult;
    if (typeof arg1 === 'string') {
      match = matchResult!;
      match.resumeId = resumeId;
      match.jobId = jobId!;
    } else {
      match = arg1;
    }
    const rId = match.resumeId || resumeId || '';
    const jId = match.jobId || jobId || '';
    this.jobMatches.set(`${rId}_${jId}`, match);
    this.persistState();
    return match;
  }

  public getCareerGap(userId: string, targetRole: string): CareerGapAnalysis | undefined {
    return this.careerGaps.get(`${userId}_${targetRole}`);
  }

  public saveCareerGap(
    arg1: string | CareerGapAnalysis,
    role?: string,
    gapAnalysis?: CareerGapAnalysis
  ): CareerGapAnalysis {
    let gap: CareerGapAnalysis;
    let uId: string;
    let targetRole: string;
    if (typeof arg1 === 'string') {
      uId = arg1;
      targetRole = role!;
      gap = gapAnalysis!;
      gap.userId = uId;
      gap.targetRole = targetRole;
    } else {
      gap = arg1;
      uId = gap.userId || 'default';
      targetRole = gap.targetRole;
    }
    this.careerGaps.set(`${uId}_${targetRole}`, gap);
    this.persistState();
    return gap;
  }

  // --- SEED DEMO DATA (Isolated Demo Account) ---
  public seedDemoData() {
    const demoUser: User = {
      id: 'demo-user-101',
      name: 'Alex Rivera',
      email: 'alex.rivera.demo@resumex.ai',
      passwordHash: '$2a$10$w81fA9k6c6Xw7Y9Oq3hM6eY/Q0cQ0fG1vR3W4Z6X9eY8c1u4aG5k2', // demo hash
      emailVerified: true,
      isDemo: true,
      createdAt: new Date().toISOString(),
    };
    this.users.set(demoUser.id, demoUser);

    const demoProfile: UserProfile = {
      id: 'demo-profile-1',
      userId: demoUser.id,
      title: 'Staff / Senior Full-Stack Engineer',
      targetRole: 'Staff Software Engineer',
      yearsOfExperience: 6,
      location: 'San Francisco, CA',
    };
    this.profiles.set(demoProfile.id, demoProfile);

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
