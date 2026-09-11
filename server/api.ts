import express from 'express';
import type { Request, Response } from 'express';
import type { ResumeData } from './types';
import { db } from './db';
import { generateToken, requireAuth, type AuthenticatedRequest } from './auth';
import { documentParser } from './services/documentParser';
import { resumeExtractor } from './services/resumeExtractor';
import { atsAnalyzer } from './services/atsAnalyzer';
import { scoringEngine } from './services/scoringEngine';
import { jdAnalyzer } from './services/jdAnalyzer';
import { semanticMatcher } from './services/semanticMatcher';
import { careerGapEngine } from './services/careerGapEngine';
import { optimizationEngine } from './services/optimizationEngine';
import { versionEngine } from './services/versionEngine';
import { templateEngine } from './services/templateEngine';
import { exportEngine } from './services/exportEngine';
import { nlpEvaluation } from './services/nlpEvaluation';
import { resumeTruthEngine } from './services/resumeTruthEngine';
import { isGeminiAvailable } from './gemini';

export const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '15mb' }));

// --- 1. HEALTH & OBSERVABILITY ---
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    product: 'ResumeX AI — Core Ultra',
    version: '1.0.0-production',
    geminiEnabled: isGeminiAvailable(),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// --- 2. AUTHENTICATION & SECURITY ---
apiRouter.post('/auth/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const { user, verificationToken } = await db.createUser(name, email, password);
    const profiles = db.getProfilesByUser(user.id);

    res.status(201).json({
      message: 'Account created successfully. Please verify your email address to activate your account.',
      verificationRequired: true,
      verificationToken, // Provided directly for immediate sandbox verification UX
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      profile: profiles[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signup failed.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/auth/verify-email', (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }

    const verifiedUser = db.verifyEmailToken(token);
    const authToken = generateToken(verifiedUser);
    const profiles = db.getProfilesByUser(verifiedUser.id);

    res.json({
      message: 'Email successfully verified! Your account is now active.',
      token: authToken,
      user: {
        id: verifiedUser.id,
        name: verifiedUser.name,
        email: verifiedUser.email,
        emailVerified: verifiedUser.emailVerified,
      },
      profile: profiles[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Email verification failed.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await db.verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.emailVerified && !user.isDemo) {
      return res.status(403).json({
        error: 'Please verify your email address before logging in.',
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = generateToken(user);
    const profiles = db.getProfilesByUser(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        isDemo: user.isDemo,
      },
      profile: profiles[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed.';
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/auth/demo-login', (_req: Request, res: Response) => {
  const demoUser = db.getUserByEmail('alex.rivera.demo@resumex.ai') || db.getUserByEmail('demo@resumex.ai');
  if (!demoUser) {
    return res.status(500).json({ error: 'Demo user not found.' });
  }
  const token = generateToken(demoUser);
  const profiles = db.getProfilesByUser(demoUser.id);

  res.json({
    token,
    user: {
      id: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      emailVerified: demoUser.emailVerified,
      isDemo: true,
    },
    profile: profiles[0],
  });
});

apiRouter.post('/auth/google', async (req: Request, res: Response) => {
  try {
    const { email, name, googleId } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google OAuth.' });
    }

    const user = await db.createOrLinkGoogleUser({ email, name: name || 'Google User', googleId });
    const token = generateToken(user);
    const profiles = db.getProfilesByUser(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      profile: profiles[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Google OAuth failed.';
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/auth/forgot-password', (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const { resetToken, expiresAt } = db.createPasswordResetToken(email);
    res.json({
      message: `Password reset token generated. Use this token within 1 hour to set a new password.`,
      resetToken, // Returned for transparent preview & development flow
      expiresAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unable to initiate password reset.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    await db.resetPasswordWithToken(token, newPassword);
    res.json({
      success: true,
      message: 'Your password has been successfully reset. You can now log in with your new password.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Password reset failed.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const profiles = db.getProfilesByUser(user.id);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      isDemo: user.isDemo,
    },
    profile: profiles[0],
  });
});

apiRouter.delete('/auth/delete-account', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    db.deleteUserAccount(userId);
    res.json({ success: true, message: 'Your account and all associated resumes and data have been permanently deleted.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete account.';
    res.status(500).json({ error: msg });
  }
});

// --- 3. RESUMES & UPLOAD PIPELINE ---
apiRouter.get('/resumes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const resumes = db.getResumesByUser(req.user!.id);
  res.json({ resumes });
});

apiRouter.post('/resumes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, data, templateId } = req.body;
    const defaultData: ResumeData = data || {
      personal_info: { name: req.user!.name || 'Candidate', email: req.user!.email || '', phone: '', location: '' },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
    };
    const saved = db.saveResume(
      req.user!.id,
      defaultData,
      title || 'Untitled Resume',
      templateId || 'modern-clean'
    );
    const score = scoringEngine.calculateResumeScore(saved.data);
    const ats = atsAnalyzer.analyzeAtsCompatibility(saved.data);
    db.updateResumeScores(req.user!.id, saved.id, score, ats.overallAtsScore);
    res.status(201).json({ resume: db.getResume(req.user!.id, saved.id) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create resume.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.get('/resumes/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = db.getResume(req.user!.id, req.params.id);
    const versions = db.getVersions(req.user!.id, req.params.id);
    const issues = db.getIssues(req.user!.id, req.params.id);
    res.json({ resume, versions, issues });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Resume not found.';
    res.status(404).json({ error: msg });
  }
});

apiRouter.post('/resumes/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileBase64, fileName, mimeType, rawText } = req.body;

    let parsedResult;
    if (fileBase64) {
      const buffer = Buffer.from(fileBase64, 'base64');
      parsedResult = await documentParser.parseDocument(buffer, mimeType || 'application/pdf', fileName);
    } else if (rawText) {
      parsedResult = documentParser.analyzeTextLayout(rawText);
    } else {
      return res.status(400).json({ error: 'Provide either a file upload (fileBase64) or raw text.' });
    }

    // Run extraction
    const { data: structuredResume, provenance } = resumeExtractor.extractStructuredResume(parsedResult);

    // Save resume securely with user ownership
    const saved = db.saveResume(
      req.user!.id,
      structuredResume,
      fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Uploaded Resume',
      undefined,
      parsedResult.text,
      mimeType,
      fileName
    );

    // Run initial scoring & ATS analysis
    const atsScoreResult = atsAnalyzer.analyzeAtsCompatibility(structuredResume, parsedResult);
    const scoreResult = scoringEngine.calculateResumeScore(structuredResume);
    db.updateResumeScores(req.user!.id, saved.id, scoreResult, atsScoreResult.overallAtsScore);

    // Run issue detection
    const issues = optimizationEngine.detectAllIssues(structuredResume);
    db.setIssues(req.user!.id, saved.id, issues);

    res.status(201).json({
      resume: db.getResume(req.user!.id, saved.id),
      parsedLayout: parsedResult.layoutInfo,
      provenance,
      scores: scoreResult,
      atsAnalysis: atsScoreResult,
      issues,
    });
  } catch (err: unknown) {
    console.error('Resume upload error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to parse resume document.';
    res.status(422).json({ error: msg });
  }
});

apiRouter.put('/resumes/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, title, templateId } = req.body;
    const updated = db.updateResumeData(req.user!.id, req.params.id, data, title, templateId);

    // Recalculate scores upon manual edits
    const ats = atsAnalyzer.analyzeAtsCompatibility(updated.data);
    const score = scoringEngine.calculateResumeScore(updated.data);
    db.updateResumeScores(req.user!.id, updated.id, score, ats.overallAtsScore);

    res.json({ resume: db.getResume(req.user!.id, updated.id) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Update failed.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.delete('/resumes/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.deleteResume(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Resume securely deleted.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Delete failed.';
    res.status(404).json({ error: msg });
  }
});

// --- 4. RESUME ANALYSIS & SCORING ---
apiRouter.post('/resumes/:id/analyze', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = db.getResume(req.user!.id, req.params.id);
    const ats = atsAnalyzer.analyzeAtsCompatibility(resume.data);
    const score = scoringEngine.calculateResumeScore(resume.data);
    const issues = optimizationEngine.detectAllIssues(resume.data);

    db.updateResumeScores(req.user!.id, resume.id, score, ats.overallAtsScore);
    db.setIssues(req.user!.id, resume.id, issues);

    res.json({
      score,
      ats,
      issues,
      scoringWeights: scoringEngine.getWeights(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Analysis failed.';
    res.status(400).json({ error: msg });
  }
});

// --- 5. OPTIMIZATION & RESUMETRUTH VERIFICATION ---
apiRouter.post('/resumes/:id/optimize/bullet', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = db.getResume(req.user!.id, req.params.id);
    const { bullet, roleTitle, company } = req.body;

    if (!bullet) return res.status(400).json({ error: 'Bullet text is required.' });

    const suggestion = await optimizationEngine.rewriteBullet(
      bullet,
      roleTitle || 'Software Engineer',
      company || 'Organization',
      resume.data
    );

    res.json({ suggestion });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Optimization failed.';
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/resumes/:id/optimize/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = db.getResume(req.user!.id, req.params.id);
    const { currentSummary, targetRole } = req.body;

    const suggestion = await optimizationEngine.optimizeSummary(
      currentSummary || resume.data.summary,
      targetRole || 'Senior Software Engineer',
      resume.data
    );

    res.json({ suggestion });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Summary optimization failed.';
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/resumes/:id/issues/:issueId/action', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action } = req.body; // 'accepted' | 'rejected' | 'edited'
    const updated = db.updateIssueStatus(req.user!.id, req.params.id, req.params.issueId, action);
    res.json({ issue: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update issue status.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/truth/verify', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { originalText, proposedText, resumeId } = req.body;
    if (!originalText || !proposedText) {
      return res.status(400).json({ error: 'originalText and proposedText are required.' });
    }
    const resume = resumeId ? db.getResume(req.user!.id, resumeId) : undefined;
    const defaultData = {
      personal_info: { name: '', email: '', location: '', phone: '' },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
    };
    const verification = resumeTruthEngine.verifyRewrite(originalText, proposedText, resume?.data || defaultData);
    res.json({ verification });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Truth verification check failed.';
    res.status(500).json({ error: msg });
  }
});

// --- 6. RESUME VERSIONS & A/B TESTING ---
apiRouter.get('/resumes/:id/versions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const versions = db.getVersions(req.user!.id, req.params.id);
    res.json({ versions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching versions.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/resumes/:id/versions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { versionName, changeSummary, targetJobId } = req.body;
    const resume = db.getResume(req.user!.id, req.params.id);

    const score = scoringEngine.calculateResumeScore(resume.data);
    const ats = atsAnalyzer.analyzeAtsCompatibility(resume.data);

    let jdScore: number | undefined;
    if (targetJobId) {
      const job = db.getJobDescription(req.user!.id, targetJobId);
      const match = semanticMatcher.matchResumeToJob(resume.data, job);
      jdScore = match.overallMatch;
    }

    const version = db.createVersion(
      req.user!.id,
      resume.id,
      versionName,
      resume.data,
      score,
      ats.overallAtsScore,
      changeSummary || 'Controlled version checkpoint.',
      jdScore,
      targetJobId
    );

    res.status(201).json({ version });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Version creation failed.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/resumes/:id/versions/compare', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { versionAId, versionBId, targetJobId } = req.body;
    const versions = db.getVersions(req.user!.id, req.params.id);
    const verA = versions.find((v) => v.id === versionAId);
    const verB = versions.find((v) => v.id === versionBId);

    if (!verA || !verB) {
      return res.status(404).json({ error: 'One or both versions not found.' });
    }

    let targetJob;
    if (targetJobId) {
      targetJob = db.getJobDescription(req.user!.id, targetJobId);
    }

    const comparison = versionEngine.compareVersions(verA, verB, targetJob);
    res.json({ comparison });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Comparison failed.';
    res.status(400).json({ error: msg });
  }
});

// --- 7. JOB DESCRIPTIONS & MATCHING ---
apiRouter.get('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const jobs = db.getJobDescriptions(req.user!.id);
  res.json({ jobs });
});

apiRouter.post('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rawText, title, company } = req.body;
    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({ error: 'Job description text must be at least 20 characters.' });
    }

    const parsed = jdAnalyzer.parseJobDescription(rawText, title, company);
    const saved = db.saveJobDescription(req.user!.id, parsed);

    res.status(201).json({ job: saved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Job parse failed.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/jobs/:jobId/match/:resumeId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = db.getJobDescription(req.user!.id, req.params.jobId);
    const resume = db.getResume(req.user!.id, req.params.resumeId);

    const match = semanticMatcher.matchResumeToJob(resume.data, job);
    db.saveJobMatch(req.user!.id, resume.id, job.id, match);

    res.json({ match });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Matching failed.';
    res.status(400).json({ error: msg });
  }
});

// --- 8. CAREER GAP ENGINE ---
apiRouter.post('/career/gap', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { resumeId, targetRole } = req.body;
    const resume = db.getResume(req.user!.id, resumeId);
    const role = targetRole || 'Senior Full-Stack Engineer';

    const gap = careerGapEngine.analyzeCareerGap(resume.data, role);
    db.saveCareerGap(req.user!.id, role, gap);

    res.json({ careerGap: gap });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Career gap analysis failed.';
    res.status(400).json({ error: msg });
  }
});

// --- 9. TEMPLATES (100+ logical configurations) ---
apiRouter.get('/templates', (_req: Request, res: Response) => {
  const templates = templateEngine.getAllTemplates();
  res.json({
    count: templates.length,
    templates,
  });
});

apiRouter.get('/templates/:id', (req: Request, res: Response) => {
  const template = templateEngine.getTemplateById(req.params.id);
  res.json({ template });
});

// --- 10. EXPORTS & VALIDATION ---
apiRouter.post('/exports/validate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data } = req.body;
    const validation = exportEngine.validateForExport(data);
    res.json({ validation });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Validation failed.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/exports/plain-text', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data } = req.body;
    const plainText = exportEngine.generatePlainText(data);
    res.json({ plainText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed.';
    res.status(400).json({ error: msg });
  }
});

// --- 11. NLP EVALUATION SUITE ---
apiRouter.get('/evaluation', (_req: Request, res: Response) => {
  const report = nlpEvaluation.runEvaluationSuite();
  res.json({ report });
});
