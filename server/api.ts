import crypto from 'crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { ResumeData, JobDescriptionModel } from './types';
import { db } from './db';
import {
  generateToken,
  requireAuth,
  setAuthCookie,
  clearAuthCookie,
  hashToken,
  generateCsrfToken,
  setCsrfCookie,
  csrfProtection,
  type AuthenticatedRequest,
} from './auth';
import { UploadSecurity } from './services/uploadSecurity';
import { googleAuthService } from './services/googleAuth';
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
import { emailService } from './services/emailService';
import { isGeminiAvailable } from './gemini';
import {
  authLoginRateLimiter,
  aiRateLimiter,
  uploadRateLimiter,
} from './services/rateLimiter';

export const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '15mb' }));

// Global Security & Observability Headers
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Enforce CSRF token protection on mutating methods (POST, PUT, PATCH, DELETE)
apiRouter.use(csrfProtection);

// CSRF handshake endpoint for clients
apiRouter.get('/auth/csrf', (_req: Request, res: Response) => {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
});

// Multer configured with memory storage and strict 10MB limit (Directive 16)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Helper for structured errors
function sendStructuredError(res: Response, status: number, code: string, message: string) {
  const reqId = (res.getHeader('X-Request-Id') as string) || crypto.randomUUID();
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      requestId: reqId,
      timestamp: new Date().toISOString(),
    },
  });
}

// Backward compatible alias
const authRateLimiter = authLoginRateLimiter;

// --- 1. HEALTH & OBSERVABILITY ---
apiRouter.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    const check = await db.getPool().query('SELECT 1');
    if (check.rows.length > 0) dbStatus = 'connected';
  } catch (err) {
    console.error('[Health] DB ping failure:', err);
  }

  const aiStatus = isGeminiAvailable() ? 'available' : 'offline';
  const overallStatus = dbStatus === 'connected' ? 'healthy' : 'degraded';

  res.json({
    status: overallStatus,
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    commit: process.env.GIT_COMMIT || 'production',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    ai: aiStatus,
    geminiEnabled: isGeminiAvailable(),
  });
});

apiRouter.get('/auth/config', (_req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const enableDemo = process.env.ENABLE_DEMO_LOGIN === 'true';
  res.json({
    demoLoginEnabled: !isProd && enableDemo,
    googleAuthEnabled: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID),
  });
});

apiRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    const check = await db.getPool().query('SELECT 1');
    if (check.rows.length > 0) {
      return res.status(200).json({ ready: true, database: 'connected', timestamp: new Date().toISOString() });
    }
    return res.status(503).json({ ready: false, database: 'unhealthy', timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(503).json({
      ready: false,
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Database error',
    });
  }
});

// --- 2. AUTHENTICATION & SECURITY ---

// Email signup
apiRouter.post('/auth/signup', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return sendStructuredError(res, 400, 'MISSING_FIELDS', 'Name, email, and password are required.');
    }
    if (password.length < 8) {
      return sendStructuredError(res, 400, 'WEAK_PASSWORD', 'Password must be at least 8 characters long.');
    }

    const { user, verificationToken } = await db.createUser(name, email, password);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const verifyUrl = `${protocol}://${host}/verify-email?token=${verificationToken}`;

    await emailService.sendVerificationEmail(user.email, user.name, verificationToken, verifyUrl);

    // Production security constraint: Never return raw verificationToken in normal API response
    const responsePayload: Record<string, any> = {
      message: 'Account created successfully. Please check your email inbox to verify your account.',
      requiresVerification: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: false,
      },
    };

    // In development mode, provide helpful diagnostics
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.devVerificationUrl = verifyUrl;
      responsePayload.devNotice = 'Dev Mode: Use devVerificationUrl or inspect console /api/auth/dev/last-email to verify.';
    }

    res.status(201).json(responsePayload);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signup failed.';
    sendStructuredError(res, 400, 'SIGNUP_FAILED', msg);
  }
});

// Email verification
apiRouter.post('/auth/verify-email', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return sendStructuredError(res, 400, 'MISSING_TOKEN', 'Verification token is required.');
    }

    const verifiedUser = await db.verifyEmailToken(token);
    const authToken = generateToken(verifiedUser);
    const tokenHash = hashToken(authToken);
    const ip = (req.ip || req.socket.remoteAddress || 'unknown') as string;
    const ua = (req.headers['user-agent'] || 'unknown') as string;

    await db.createSession(verifiedUser.id, tokenHash, ip, ua);
    setAuthCookie(res, authToken, req);
    setCsrfCookie(res, generateCsrfToken(), req);

    const profile = await db.getProfileByUserId(verifiedUser.id);

    res.json({
      message: 'Email successfully verified! Your account is now active.',
      user: {
        id: verifiedUser.id,
        name: verifiedUser.name,
        email: verifiedUser.email,
        emailVerified: true,
      },
      profile,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Email verification failed.';
    sendStructuredError(res, 400, 'VERIFICATION_FAILED', msg);
  }
});

// Resend verification email
apiRouter.post('/auth/resend-verification', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendStructuredError(res, 400, 'MISSING_EMAIL', 'Email is required.');
    }

    const result = await db.resendVerificationToken(email);
    if (result) {
      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const verifyUrl = `${protocol}://${host}/?action=verify&token=${result.verificationToken}`;
      await emailService.sendVerificationEmail(result.user.email, result.user.name, result.verificationToken, verifyUrl);
    }

    res.json({
      message: 'If an unverified account with this email exists, a new verification link has been sent.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to resend verification email.';
    sendStructuredError(res, 500, 'RESEND_FAILED', msg);
  }
});

// Email login
apiRouter.post('/auth/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendStructuredError(res, 400, 'MISSING_CREDENTIALS', 'Email and password are required.');
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return sendStructuredError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const isMatch = await db.verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return sendStructuredError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (!user.emailVerified && !user.isDemo) {
      return res.status(403).json({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before logging in.',
          email: user.email,
        },
      });
    }

    const token = generateToken(user);
    const tokenHash = hashToken(token);
    const ip = (req.ip || req.socket.remoteAddress || 'unknown') as string;
    const ua = (req.headers['user-agent'] || 'unknown') as string;

    await db.createSession(user.id, tokenHash, ip, ua);
    setAuthCookie(res, token, req);
    setCsrfCookie(res, generateCsrfToken(), req);

    const profile = await db.getProfileByUserId(user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        isDemo: user.isDemo,
      },
      profile,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed.';
    sendStructuredError(res, 500, 'LOGIN_FAILED', msg);
  }
});

// Demo login (Isolated demo account Alex Rivera) - Gated strictly by environment configuration
apiRouter.post('/auth/demo-login', async (req: Request, res: Response) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const enableDemo = process.env.ENABLE_DEMO_LOGIN === 'true';
    if (isProd || !enableDemo) {
      return sendStructuredError(res, 403, 'DEMO_LOGIN_DISABLED', 'Demo login is disabled in this environment.');
    }

    const demoUser = await db.getUserByEmail('alex.rivera.demo@resumex.ai');
    if (!demoUser) {
      return sendStructuredError(res, 500, 'DEMO_NOT_SEEDED', 'Demo user could not be loaded.');
    }

    const token = generateToken(demoUser);
    const tokenHash = hashToken(token);
    const ip = (req.ip || req.socket.remoteAddress || 'unknown') as string;
    const ua = (req.headers['user-agent'] || 'unknown') as string;

    await db.createSession(demoUser.id, tokenHash, ip, ua);
    setAuthCookie(res, token, req);
    setCsrfCookie(res, generateCsrfToken(), req);

    const profile = await db.getProfileByUserId(demoUser.id);

    res.json({
      user: {
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        emailVerified: true,
        isDemo: true,
      },
      profile,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Demo login failed.';
    sendStructuredError(res, 500, 'DEMO_LOGIN_ERROR', msg);
  }
});

// Real Google OAuth / OIDC Identity Verification
apiRouter.post('/auth/google', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { idToken, credential } = req.body;
    const rawToken = idToken || credential;
    if (!rawToken || typeof rawToken !== 'string') {
      return sendStructuredError(
        res,
        400,
        'MISSING_GOOGLE_TOKEN',
        'A valid Google ID token is required. ResumeX AI does not accept unverified client identities.'
      );
    }

    // Perform cryptographic OIDC verification using Google Auth Service
    const validated = await googleAuthService.verifyIdToken(rawToken);

    const user = await db.createOrLinkGoogleUser({
      email: validated.email,
      name: validated.name || 'Google User',
    });

    if (validated.sub) {
      await db.createOrLinkOAuthAccount(user.id, 'google', validated.sub, validated.email, validated);
    }

    const token = generateToken(user);
    const tokenHash = hashToken(token);
    const ip = (req.ip || req.socket.remoteAddress || 'unknown') as string;
    const ua = (req.headers['user-agent'] || 'unknown') as string;

    await db.createSession(user.id, tokenHash, ip, ua);
    setAuthCookie(res, token, req);
    setCsrfCookie(res, generateCsrfToken(), req);

    const profile = await db.getProfileByUserId(user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
      },
      profile,
    });
  } catch (err: unknown) {
    console.error('Google OAuth error:', err instanceof Error ? err.message : 'Verification failed');
    const msg = err instanceof Error ? err.message : 'An error occurred while verifying Google OAuth.';
    sendStructuredError(res, 401, 'GOOGLE_AUTH_ERROR', msg);
  }
});

// Logout endpoint with session revocation and cookie clearing
apiRouter.post('/auth/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.tokenHash) {
      await db.getPool().query(
        'UPDATE sessions SET is_revoked = TRUE, updated_at = NOW() WHERE token_hash = $1',
        [req.tokenHash]
      );
    }
    clearAuthCookie(res, req);
    await db.logAudit(req.user!.id, 'USER_LOGOUT', 'User', req.user!.id);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Logout failed.';
    sendStructuredError(res, 500, 'LOGOUT_FAILED', msg);
  }
});

// Change Password
apiRouter.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendStructuredError(res, 400, 'MISSING_FIELDS', 'Current password and new password are required.');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return sendStructuredError(res, 400, 'WEAK_PASSWORD', 'New password must be at least 8 characters long.');
    }

    await db.changeUserPassword(req.user!.id, currentPassword, newPassword);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Password change failed.';
    sendStructuredError(res, 400, 'CHANGE_PASSWORD_FAILED', msg);
  }
});

// Multi-device active sessions management
apiRouter.get('/auth/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = await db.getUserSessions(req.user!.id, req.tokenHash);
    res.json({ sessions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve sessions.';
    sendStructuredError(res, 500, 'FETCH_SESSIONS_FAILED', msg);
  }
});

apiRouter.delete('/auth/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const revoked = await db.revokeSession(req.user!.id, req.params.id);
    if (!revoked) {
      return sendStructuredError(res, 404, 'SESSION_NOT_FOUND', 'Session not found or already revoked.');
    }
    res.json({ success: true, message: 'Session revoked successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to revoke session.';
    sendStructuredError(res, 500, 'REVOKE_SESSION_FAILED', msg);
  }
});

apiRouter.delete('/auth/sessions-revoke-others', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const revokedCount = await db.revokeAllSessions(req.user!.id, req.tokenHash);
    res.json({ success: true, revokedCount, message: 'All other active sessions have been revoked.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to revoke other sessions.';
    sendStructuredError(res, 500, 'REVOKE_ALL_SESSIONS_FAILED', msg);
  }
});

// Forgot password
apiRouter.post('/auth/forgot-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendStructuredError(res, 400, 'MISSING_EMAIL', 'Email address is required.');
    }

    const result = await db.createPasswordResetToken(email);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';

    if (result) {
      const resetUrl = `${protocol}://${host}/reset-password?token=${result.resetToken}`;
      const user = await db.getUserByEmail(email);
      await emailService.sendPasswordResetEmail(email, user?.name || 'Candidate', result.resetToken, resetUrl);
    }

    // Never reveal whether an email address exists
    const responsePayload: Record<string, any> = {
      message: 'If an account exists with this email address, a password reset link has been dispatched.',
    };

    if (process.env.NODE_ENV !== 'production' && result) {
      responsePayload.devNotice = 'Dev Mode: Reset link dispatched to dev console and /api/auth/dev/last-email.';
    }

    res.json(responsePayload);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unable to initiate password reset.';
    sendStructuredError(res, 400, 'RESET_INIT_FAILED', msg);
  }
});

// Reset password
apiRouter.post('/auth/reset-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return sendStructuredError(res, 400, 'MISSING_FIELDS', 'Reset token and new password are required.');
    }
    if (newPassword.length < 8) {
      return sendStructuredError(res, 400, 'WEAK_PASSWORD', 'New password must be at least 8 characters long.');
    }

    await db.resetPasswordWithToken(token, newPassword);
    res.json({
      success: true,
      message: 'Your password has been successfully reset. You can now log in with your new password.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Password reset failed.';
    sendStructuredError(res, 400, 'RESET_FAILED', msg);
  }
});

// Development-only diagnostics route for mailbox inspection
apiRouter.get('/auth/dev/last-email', (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint unavailable in production.' });
  }
  res.json({
    mailbox: emailService.getDevMailbox(),
  });
});

// Current user info
apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const profile = await db.getProfileByUserId(user.id);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      isDemo: user.isDemo,
    },
    profile,
  });
});

// Profile endpoints
apiRouter.get('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await db.getProfileByUserId(req.user!.id);
    res.json({ profile });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch profile.';
    sendStructuredError(res, 500, 'PROFILE_FETCH_FAILED', msg);
  }
});

apiRouter.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await db.updateProfile(req.user!.id, req.body);
    await db.logAudit(req.user!.id, 'PROFILE_UPDATED', 'User', req.user!.id, {
      fields: Object.keys(req.body),
    });
    res.json({ profile: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update profile.';
    sendStructuredError(res, 400, 'PROFILE_UPDATE_FAILED', msg);
  }
});

// Delete account
apiRouter.delete('/auth/delete-account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await db.deleteUserAccount(userId);
    res.json({ success: true, message: 'Your account and all associated resumes and data have been permanently deleted.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete account.';
    sendStructuredError(res, 500, 'DELETE_ACCOUNT_FAILED', msg);
  }
});

// --- 3. RESUMES & UPLOAD PIPELINE ---

// List resumes
apiRouter.get('/resumes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resumes = await db.getResumesByUser(req.user!.id);
    res.json({ resumes });
  } catch (err) {
    sendStructuredError(res, 500, 'FETCH_RESUMES_FAILED', 'Failed to retrieve resumes.');
  }
});

// Create manual resume
apiRouter.post('/resumes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

    const saved = await db.saveResume(
      req.user!.id,
      defaultData,
      title || 'Untitled Resume',
      templateId || 'ats-classic'
    );

    const score = scoringEngine.calculateResumeScore(saved.data);
    const ats = atsAnalyzer.analyzeAtsCompatibility(saved.data);
    const updated = await db.updateResumeScores(req.user!.id, saved.id, score, ats.overallAtsScore);

    res.status(201).json({ resume: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create resume.';
    sendStructuredError(res, 400, 'CREATE_RESUME_FAILED', msg);
  }
});

// Get resume details
apiRouter.get('/resumes/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = await db.getResume(req.user!.id, req.params.id);
    const versions = await db.getVersions(req.user!.id, req.params.id);
    const issues = await db.getIssues(req.user!.id, req.params.id);
    res.json({ resume, versions, issues });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Resume not found.';
    sendStructuredError(res, 404, 'RESUME_NOT_FOUND', msg);
  }
});

// Upload resume document (Supports both multipart/form-data via Multer AND JSON base64 payloads)
apiRouter.post(
  '/resumes/upload',
  requireAuth,
  uploadRateLimiter,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      let buffer: Buffer | null = null;
      let fileName = 'resume.pdf';
      let mimeType = 'application/pdf';

      if (req.file) {
        buffer = req.file.buffer;
        fileName = req.file.originalname;
        mimeType = req.file.mimetype;
      } else if (req.body.fileBase64) {
        buffer = Buffer.from(req.body.fileBase64, 'base64');
        fileName = req.body.fileName || 'uploaded_resume.pdf';
        mimeType = req.body.mimeType || 'application/pdf';
      } else if (req.body.rawText) {
        // Raw text upload
        const parsedResult = documentParser.analyzeTextLayout(req.body.rawText);
        const { data: structuredResume, provenance } = resumeExtractor.extractStructuredResume(parsedResult);
        const saved = await db.saveResume(
          req.user!.id,
          structuredResume,
          'Pasted Text Resume',
          'ats-classic',
          req.body.rawText,
          'text/plain',
          'resume.txt'
        );

        const atsScoreResult = atsAnalyzer.analyzeAtsCompatibility(structuredResume, parsedResult);
        const scoreResult = scoringEngine.calculateResumeScore(structuredResume);
        const updated = await db.updateResumeScores(req.user!.id, saved.id, scoreResult, atsScoreResult.overallAtsScore);
        const issues = optimizationEngine.detectAllIssues(structuredResume);
        await db.setIssues(req.user!.id, saved.id, issues);

        return res.status(201).json({
          resume: updated,
          parsedLayout: parsedResult.layoutInfo,
          provenance,
          scores: scoreResult,
          atsAnalysis: atsScoreResult,
          issues,
        });
      } else {
        return sendStructuredError(
          res,
          400,
          'MISSING_FILE',
          'Please provide a resume file (multipart form "file") or JSON fileBase64.'
        );
      }

      if (!buffer) {
        return sendStructuredError(res, 400, 'INVALID_FILE', 'Unable to process resume file buffer.');
      }

      // Strict security verification: size, extension, MIME type, and magic bytes
      const validation = UploadSecurity.validateUpload(buffer, fileName, mimeType);
      if (!validation.isValid) {
        return sendStructuredError(res, 400, 'INVALID_FILE_SECURITY', validation.error || 'File security validation failed.');
      }
      fileName = validation.sanitizedFileName;
      mimeType = validation.detectedMime || mimeType;

      // Parse document with PDF parser + OCR fallback
      const parsedResult = await documentParser.parseDocument(buffer, mimeType, fileName);
      const { data: structuredResume, provenance } = resumeExtractor.extractStructuredResume(parsedResult);

      const title = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Uploaded Resume';
      const saved = await db.saveResume(
        req.user!.id,
        structuredResume,
        title,
        'ats-classic',
        parsedResult.text,
        mimeType,
        fileName
      );

      const atsScoreResult = atsAnalyzer.analyzeAtsCompatibility(structuredResume, parsedResult);
      const scoreResult = scoringEngine.calculateResumeScore(structuredResume);
      const updated = await db.updateResumeScores(req.user!.id, saved.id, scoreResult, atsScoreResult.overallAtsScore);

      const issues = optimizationEngine.detectAllIssues(structuredResume);
      await db.setIssues(req.user!.id, saved.id, issues);

      res.status(201).json({
        resume: updated,
        parsedLayout: parsedResult.layoutInfo,
        provenance,
        scores: scoreResult,
        atsAnalysis: atsScoreResult,
        issues,
      });
    } catch (err: unknown) {
      console.error('Resume upload error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to parse resume document.';
      sendStructuredError(res, 422, 'DOCUMENT_PARSE_FAILED', msg);
    }
  }
);

// Update resume content
apiRouter.put('/resumes/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, title, templateId } = req.body;
    const updated = await db.updateResumeData(req.user!.id, req.params.id, data, title, templateId);

    const ats = atsAnalyzer.analyzeAtsCompatibility(updated.data);
    const score = scoringEngine.calculateResumeScore(updated.data);
    const finalResume = await db.updateResumeScores(req.user!.id, updated.id, score, ats.overallAtsScore);

    res.json({ resume: finalResume });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Update failed.';
    sendStructuredError(res, 400, 'UPDATE_FAILED', msg);
  }
});

// Delete resume
apiRouter.delete('/resumes/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.deleteResume(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Resume securely deleted.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Delete failed.';
    sendStructuredError(res, 404, 'DELETE_FAILED', msg);
  }
});

// --- 4. RESUME ANALYSIS & SCORING ---
apiRouter.post('/resumes/:id/analyze', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = await db.getResume(req.user!.id, req.params.id);
    const ats = atsAnalyzer.analyzeAtsCompatibility(resume.data);
    const score = scoringEngine.calculateResumeScore(resume.data);
    const issues = optimizationEngine.detectAllIssues(resume.data);

    await db.updateResumeScores(req.user!.id, resume.id, score, ats.overallAtsScore);
    await db.setIssues(req.user!.id, resume.id, issues);

    res.json({
      score,
      ats,
      issues,
      scoringWeights: scoringEngine.getWeights(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Analysis failed.';
    sendStructuredError(res, 400, 'ANALYSIS_FAILED', msg);
  }
});

// Resume scoring endpoint (direct breakdown retrieval and refresh)
apiRouter.get('/resumes/:id/score', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = await db.getResume(req.user!.id, req.params.id);
    const ats = atsAnalyzer.analyzeAtsCompatibility(resume.data);
    const score = scoringEngine.calculateResumeScore(resume.data);
    res.json({ score, atsScore: ats.overallAtsScore, atsBreakdown: ats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Resume not found.';
    sendStructuredError(res, 404, 'RESUME_NOT_FOUND', msg);
  }
});

apiRouter.post('/resumes/:id/score', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = await db.getResume(req.user!.id, req.params.id);
    const ats = atsAnalyzer.analyzeAtsCompatibility(resume.data);
    const score = scoringEngine.calculateResumeScore(resume.data);
    await db.updateResumeScores(req.user!.id, resume.id, score, ats.overallAtsScore);
    res.json({ score, atsScore: ats.overallAtsScore, atsBreakdown: ats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Resume scoring failed.';
    sendStructuredError(res, 400, 'SCORING_FAILED', msg);
  }
});

// Match resume to a job description by resumeId
apiRouter.post('/resumes/:id/match', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId, rawText } = req.body;
    const resume = await db.getResume(req.user!.id, req.params.id);
    let job: JobDescriptionModel;
    if (jobId) {
      job = await db.getJobDescription(req.user!.id, jobId);
    } else if (rawText) {
      const parsed = jdAnalyzer.parseJobDescription(rawText);
      job = {
        ...parsed,
        id: `transient-${Date.now()}`,
        userId: req.user!.id,
        createdAt: new Date().toISOString(),
      };
    } else {
      return sendStructuredError(res, 400, 'MISSING_JOB', 'jobId or rawText is required to match.');
    }

    const match = await semanticMatcher.matchResumeToJob(resume.data, job);
    if (jobId) {
      await db.saveJobMatch(req.user!.id, resume.id, job.id, match);
    }
    res.json({ match });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Resume matching failed.';
    sendStructuredError(res, 400, 'MATCH_FAILED', msg);
  }
});

// Export resume by ID with verified ownership
apiRouter.post('/resumes/:id/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { format = 'pdf', templateId } = req.body;
    const resume = await db.getResume(req.user!.id, req.params.id);
    const tmplId = templateId || resume.templateId || 'ats-classic';
    const safeTitle = (resume.data.personal_info?.name || resume.title || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'pdf') {
      const buffer = await exportEngine.generatePdf(resume.data, tmplId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_ResumeX.pdf"`);
      return res.send(buffer);
    } else if (format === 'docx') {
      const buffer = await exportEngine.generateDocx(resume.data, tmplId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_ResumeX.docx"`);
      return res.send(buffer);
    } else if (format === 'txt' || format === 'plain-text') {
      const plainText = exportEngine.generatePlainText(resume.data);
      return res.json({ plainText });
    } else if (format === 'json') {
      return res.json({ data: resume.data });
    } else {
      return sendStructuredError(res, 400, 'UNSUPPORTED_FORMAT', `Export format "${format}" is not supported.`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Resume export failed.';
    sendStructuredError(res, 500, 'EXPORT_FAILED', msg);
  }
});

// --- 5. OPTIMIZATION & RESUMETRUTH ENGINE ---
apiRouter.post('/resumes/:id/optimize/bullet', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = await db.getResume(req.user!.id, req.params.id);
    const { bullet, roleTitle, company } = req.body;

    if (!bullet) return sendStructuredError(res, 400, 'MISSING_BULLET', 'Bullet text is required.');

    const suggestion = await optimizationEngine.rewriteBullet(
      bullet,
      roleTitle || 'Software Engineer',
      company || 'Organization',
      resume.data
    );

    res.json({ suggestion });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Optimization failed.';
    sendStructuredError(res, 500, 'OPTIMIZE_FAILED', msg);
  }
});

apiRouter.post('/resumes/:id/optimize/summary', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = await db.getResume(req.user!.id, req.params.id);
    const { currentSummary, targetRole } = req.body;

    const suggestion = await optimizationEngine.optimizeSummary(
      currentSummary || resume.data.summary,
      targetRole || 'Senior Software Engineer',
      resume.data
    );

    res.json({ suggestion });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Summary optimization failed.';
    sendStructuredError(res, 500, 'OPTIMIZE_SUMMARY_FAILED', msg);
  }
});

apiRouter.post('/resumes/:id/issues/:issueId/action', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action } = req.body;
    const updated = await db.updateIssueStatus(req.user!.id, req.params.id, req.params.issueId, action);
    res.json({ issue: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update issue status.';
    sendStructuredError(res, 400, 'UPDATE_ISSUE_FAILED', msg);
  }
});

// Batch action for selected issues
apiRouter.post('/resumes/:id/issues/batch-action', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { issueIds, action } = req.body;
    if (!Array.isArray(issueIds) || !action) {
      return sendStructuredError(res, 400, 'INVALID_PAYLOAD', 'issueIds array and action are required.');
    }

    const updatedIssues = [];
    for (const iId of issueIds) {
      try {
        const up = await db.updateIssueStatus(req.user!.id, req.params.id, iId, action);
        updatedIssues.push(up);
      } catch {
        // Continue with next
      }
    }

    res.json({ success: true, updatedCount: updatedIssues.length, issues: updatedIssues });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Batch action failed.';
    sendStructuredError(res, 500, 'BATCH_ACTION_FAILED', msg);
  }
});

// "Fix All Safe Changes" — never automatically accepts risky factual changes
apiRouter.post('/resumes/:id/issues/fix-safe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resume = await db.getResume(req.user!.id, req.params.id);
    const issues = await db.getIssues(req.user!.id, resume.id);

    // Identify safe issues vs risky factual changes
    const riskyTypes = [
      'truth_violation',
      'fabricated_metric',
      'fabricated_skill',
      'unverified_claim',
      'unverified_metric',
      'missing_section',
      'missing_metric',
    ];
    const safeIssues = issues.filter(
      (iss) =>
        iss.status === 'pending' &&
        !riskyTypes.includes(iss.type || iss.issue_type || '') &&
        !iss.requires_user_confirmation
    );
    const riskyIssues = issues.filter(
      (iss) =>
        iss.status === 'pending' &&
        (riskyTypes.includes(iss.type || iss.issue_type || '') || iss.requires_user_confirmation)
    );

    let fixedCount = 0;
    const updatedData = JSON.parse(JSON.stringify(resume.data)) as ResumeData;

    // Apply safe wording fixes (e.g. passive verbs to active verbs in bullets)
    for (const safe of safeIssues) {
      if (safe.section === 'experience' && safe.evidence) {
        for (const exp of updatedData.experience) {
          for (let bIdx = 0; bIdx < exp.bullets.length; bIdx++) {
            if (exp.bullets[bIdx].includes(safe.evidence) || safe.evidence.includes(exp.bullets[bIdx])) {
              // Apply deterministic rewrite
              const rewritten = exp.bullets[bIdx]
                .replace(/^worked on\s+/i, 'Engineered solutions for ')
                .replace(/^helped with\s+/i, 'Facilitated the execution of ')
                .replace(/^responsible for\s+/i, 'Spearheaded and maintained ')
                .replace(/^assisted in\s+/i, 'Collaborated to implement ')
                .replace(/^handled\s+/i, 'Managed and optimized ');
              if (rewritten !== exp.bullets[bIdx]) {
                exp.bullets[bIdx] = rewritten;
              }
            }
          }
        }
      }
      await db.updateIssueStatus(req.user!.id, resume.id, safe.id, 'accepted');
      fixedCount++;
    }

    // Save updated resume data and recalculate scores
    const savedResume = await db.updateResumeData(req.user!.id, resume.id, updatedData);
    const ats = atsAnalyzer.analyzeAtsCompatibility(savedResume.data);
    const score = scoringEngine.calculateResumeScore(savedResume.data);
    const finalResume = await db.updateResumeScores(req.user!.id, savedResume.id, score, ats.overallAtsScore);

    res.json({
      success: true,
      fixedCount,
      skippedRiskyCount: riskyIssues.length,
      message: `Fixed ${fixedCount} safe wording and style improvements. ${riskyIssues.length} factual/metric changes were protected for manual candidate verification.`,
      resume: finalResume,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fix safe issues failed.';
    sendStructuredError(res, 500, 'FIX_SAFE_FAILED', msg);
  }
});

apiRouter.post('/truth/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { originalText, proposedText, resumeId } = req.body;
    if (!originalText || !proposedText) {
      return sendStructuredError(res, 400, 'MISSING_FIELDS', 'originalText and proposedText are required.');
    }

    let resumeData: ResumeData = {
      personal_info: { name: '', email: '', location: '', phone: '' },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
    };

    if (resumeId) {
      try {
        const r = await db.getResume(req.user!.id, resumeId);
        resumeData = r.data;
      } catch {
        // use fallback empty context
      }
    }

    const verification = resumeTruthEngine.verifyRewrite(originalText, proposedText, resumeData);
    res.json({ verification });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Truth verification check failed.';
    sendStructuredError(res, 500, 'TRUTH_CHECK_FAILED', msg);
  }
});

// --- 6. RESUME VERSIONS & A/B COMPARISON ---
apiRouter.get('/resumes/:id/versions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const versions = await db.getVersions(req.user!.id, req.params.id);
    res.json({ versions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching versions.';
    sendStructuredError(res, 400, 'VERSIONS_FETCH_FAILED', msg);
  }
});

apiRouter.post('/resumes/:id/versions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { versionName, changeSummary, targetJobId } = req.body;
    const resume = await db.getResume(req.user!.id, req.params.id);

    const score = scoringEngine.calculateResumeScore(resume.data);
    const ats = atsAnalyzer.analyzeAtsCompatibility(resume.data);

    let jdScore: number | undefined;
    if (targetJobId) {
      const job = await db.getJobDescription(req.user!.id, targetJobId);
      const match = await semanticMatcher.matchResumeToJob(resume.data, job);
      jdScore = match.overallMatch;
    }

    const version = await db.createVersion(
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
    sendStructuredError(res, 400, 'CREATE_VERSION_FAILED', msg);
  }
});

apiRouter.post('/resumes/:id/versions/compare', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { versionAId, versionBId, targetJobId } = req.body;
    const versions = await db.getVersions(req.user!.id, req.params.id);
    const verA = versions.find((v) => v.id === versionAId);
    const verB = versions.find((v) => v.id === versionBId);

    if (!verA || !verB) {
      return sendStructuredError(res, 404, 'VERSION_NOT_FOUND', 'One or both versions not found.');
    }

    let targetJob;
    if (targetJobId) {
      targetJob = await db.getJobDescription(req.user!.id, targetJobId);
    }

    const comparison = await versionEngine.compareVersions(verA, verB, targetJob);
    res.json({ comparison });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Comparison failed.';
    sendStructuredError(res, 400, 'VERSION_COMPARE_FAILED', msg);
  }
});

apiRouter.post('/resumes/:id/versions/:versionId/restore', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restored = await db.restoreVersion(req.user!.id, req.params.id, req.params.versionId);
    res.json({
      success: true,
      message: 'Resume version successfully restored.',
      resume: restored,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to restore version.';
    sendStructuredError(res, 400, 'RESTORE_VERSION_FAILED', msg);
  }
});

// --- 7. JOB DESCRIPTIONS & MATCHING ---
apiRouter.get('/jobs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobs = await db.getJobDescriptions(req.user!.id);
    res.json({ jobs });
  } catch (err) {
    sendStructuredError(res, 500, 'FETCH_JOBS_FAILED', 'Failed to retrieve target job descriptions.');
  }
});

apiRouter.post('/jobs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rawText, title, company } = req.body;
    if (!rawText || rawText.trim().length < 20) {
      return sendStructuredError(res, 400, 'TEXT_TOO_SHORT', 'Job description text must be at least 20 characters.');
    }

    const parsed = jdAnalyzer.parseJobDescription(rawText, title, company);
    const saved = await db.saveJobDescription(req.user!.id, parsed);

    res.status(201).json({ job: saved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Job parse failed.';
    sendStructuredError(res, 400, 'SAVE_JOB_FAILED', msg);
  }
});

apiRouter.get('/jobs/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await db.getJobDescription(req.user!.id, req.params.id);
    res.json({ job });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Job description not found.';
    sendStructuredError(res, 404, 'JOB_NOT_FOUND', msg);
  }
});

apiRouter.delete('/jobs/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.deleteJobDescription(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Job description deleted successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete job description.';
    sendStructuredError(res, 404, 'DELETE_JOB_FAILED', msg);
  }
});

apiRouter.post('/jobs/:jobId/match/:resumeId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await db.getJobDescription(req.user!.id, req.params.jobId);
    const resume = await db.getResume(req.user!.id, req.params.resumeId);

    const match = await semanticMatcher.matchResumeToJob(resume.data, job);
    await db.saveJobMatch(req.user!.id, resume.id, job.id, match);

    res.json({ match });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Matching failed.';
    sendStructuredError(res, 400, 'JOB_MATCH_FAILED', msg);
  }
});

// --- 8. CAREER GAP ENGINE ---
apiRouter.post('/career/gap', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { resumeId, targetRole } = req.body;
    const resume = await db.getResume(req.user!.id, resumeId);
    const role = targetRole || 'Senior Full-Stack Engineer';

    const gap = careerGapEngine.analyzeCareerGap(resume.data, role);
    await db.saveCareerGap(req.user!.id, role, gap);

    res.json({ careerGap: gap });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Career gap analysis failed.';
    sendStructuredError(res, 400, 'CAREER_GAP_FAILED', msg);
  }
});

// --- 9. TEMPLATES ---
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
    sendStructuredError(res, 400, 'VALIDATION_FAILED', msg);
  }
});

apiRouter.post('/exports/plain-text', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data } = req.body;
    const plainText = exportEngine.generatePlainText(data);
    res.json({ plainText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed.';
    sendStructuredError(res, 400, 'EXPORT_FAILED', msg);
  }
});

apiRouter.post('/exports/docx', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, templateId } = req.body;
    if (!data) {
      return sendStructuredError(res, 400, 'MISSING_DATA', 'Resume data is required for DOCX export.');
    }

    const buffer = await exportEngine.generateDocx(data, templateId || 'ats-classic');
    const safeTitle = (data.personal_info?.name || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_ResumeX.docx"`);
    res.send(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'DOCX export generation failed.';
    sendStructuredError(res, 500, 'DOCX_EXPORT_FAILED', msg);
  }
});

apiRouter.post('/exports/pdf', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, templateId } = req.body;
    if (!data) {
      return sendStructuredError(res, 400, 'MISSING_DATA', 'Resume data is required for PDF export.');
    }

    const buffer = await exportEngine.generatePdf(data, templateId || 'ats-classic');
    const safeTitle = (data.personal_info?.name || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_ResumeX.pdf"`);
    res.send(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'PDF export generation failed.';
    sendStructuredError(res, 500, 'PDF_EXPORT_FAILED', msg);
  }
});

// --- 11. AUDIT TRAIL ---
apiRouter.get(['/audit', '/audit-logs', '/audit-events'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const events = await db.getAuditEvents(req.user!.id);
    res.json({ events });
  } catch (err) {
    sendStructuredError(res, 500, 'AUDIT_FETCH_FAILED', 'Failed to retrieve audit events.');
  }
});

// --- 12. NLP EVALUATION SUITE ---
apiRouter.get('/evaluation', (_req: Request, res: Response) => {
  const report = nlpEvaluation.runEvaluationSuite();
  res.json({ report });
});
