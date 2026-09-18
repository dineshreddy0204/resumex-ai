import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';
import type { User } from './types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
  tokenHash?: string;
}

// JWT_SECRET handling: If provided, ensure it meets cryptographic entropy;
// if unset, persist an ephemeral 256-bit key in .jwt_secret so dev server restarts
// do not prematurely invalidate active user session cookies.
let runtimeSecret = process.env.JWT_SECRET;
if (!runtimeSecret) {
  const secretPath = path.join(process.cwd(), '.jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing && existing.length >= 32) {
        runtimeSecret = existing;
      }
    }
  } catch {
    // Ignore file read failure
  }

  if (!runtimeSecret) {
    runtimeSecret = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(secretPath, runtimeSecret, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // Ignore file write failure in read-only environments
    }
  }
} else if (runtimeSecret.length < 32) {
  // Deterministically derive a cryptographically strong 256-bit key from the provided secret
  runtimeSecret = crypto.createHash('sha256').update(runtimeSecret).digest('hex');
}
const JWT_SECRET: string = runtimeSecret;

/**
 * Hash token using SHA-256 for persistent session storage and lookup
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Extract token from HttpOnly session cookie (resumex_token / resumex_session),
 * with Authorization: Bearer fallback for iframe environments where third-party cookies are blocked.
 */
export function extractToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)(?:resumex_token|resumex_session)=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]).trim();
    }
  }

  // Authorization: Bearer <token> fallback for cross-site / iframe sandboxes
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Determine cookie security attributes based on environment and request.
 * When running in Cloud Run / Google AI Studio iframe previews or over HTTPS,
 * SameSite=None + Secure + Partitioned is enforced so the browser doesn't block the cookie.
 */
function getCookieSecuritySettings(req?: Request): { sameSite: 'Lax' | 'None'; secure: boolean; partitioned: boolean } {
  const isProd = process.env.NODE_ENV === 'production';
  const proto = req?.headers['x-forwarded-proto'] || (req?.secure ? 'https' : 'http');
  const isHttps = proto === 'https' || isProd || Boolean(process.env.APP_URL?.startsWith('https'));
  const isCloudRun = Boolean(
    (typeof req?.headers.host === 'string' && req.headers.host.includes('.run.app')) ||
    process.env.APP_URL?.includes('.run.app')
  );

  // Cross-site iframe compatibility (Google AI Studio Preview + Cloud Run)
  const isIframeOrCrossSite =
    process.env.ENABLE_CROSS_SITE_IFRAME_COOKIES === 'true' ||
    isCloudRun ||
    (isHttps && req?.headers['sec-fetch-dest'] === 'iframe');

  const sameSite: 'Lax' | 'None' = isIframeOrCrossSite ? 'None' : (isHttps ? 'None' : 'Lax');
  const secure = isHttps || isIframeOrCrossSite;
  const partitioned = isIframeOrCrossSite || (isHttps && sameSite === 'None');
  return { sameSite, secure, partitioned };
}

/**
 * Set secure HttpOnly session cookie
 */
export function setAuthCookie(res: Response, token: string, req?: Request): void {
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const { sameSite, secure, partitioned } = getCookieSecuritySettings(req);

  const cookieParts = [
    `resumex_token=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    'HttpOnly',
    `SameSite=${sameSite}`,
  ];
  if (secure) {
    cookieParts.push('Secure');
  }
  if (partitioned) {
    cookieParts.push('Partitioned');
  }
  res.append('Set-Cookie', cookieParts.join('; '));
}

/**
 * Clear session cookie on logout or invalidation
 */
export function clearAuthCookie(res: Response, req?: Request): void {
  const { sameSite, secure, partitioned } = getCookieSecuritySettings(req);

  const cookieParts = [
    'resumex_token=',
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    `SameSite=${sameSite}`,
  ];
  if (secure) {
    cookieParts.push('Secure');
  }
  if (partitioned) {
    cookieParts.push('Partitioned');
  }
  res.append('Set-Cookie', cookieParts.join('; '));
  // Also clear standard Lax unpartitioned fallback in case cookie originated from direct domain visit
  res.append('Set-Cookie', 'resumex_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  clearCsrfCookie(res, req);
}

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Set client-accessible CSRF cookie for Double-Submit protection
 */
export function setCsrfCookie(res: Response, token: string, req?: Request): void {
  const { sameSite, secure, partitioned } = getCookieSecuritySettings(req);

  const cookieParts = [
    `resumex_csrf=${encodeURIComponent(token)}`,
    'Path=/',
    'Max-Age=604800', // 7 days
    `SameSite=${sameSite}`,
  ];
  if (secure) {
    cookieParts.push('Secure');
  }
  if (partitioned) {
    cookieParts.push('Partitioned');
  }
  res.append('Set-Cookie', cookieParts.join('; '));
}

export function clearCsrfCookie(res: Response, req?: Request): void {
  const { sameSite, secure, partitioned } = getCookieSecuritySettings(req);

  const cookieParts = [
    'resumex_csrf=',
    'Path=/',
    'Max-Age=0',
    `SameSite=${sameSite}`,
  ];
  if (secure) {
    cookieParts.push('Secure');
  }
  if (partitioned) {
    cookieParts.push('Partitioned');
  }
  res.append('Set-Cookie', cookieParts.join('; '));
  res.append('Set-Cookie', 'resumex_csrf=; Path=/; Max-Age=0; SameSite=Lax');
}

/**
 * Extract CSRF token from cookie header
 */
export function extractCsrfFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)resumex_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]).trim() : null;
}

/**
 * CSRF Protection Middleware for state-changing requests (POST, PUT, PATCH, DELETE)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  // Exempt public onboarding / entry-point routes where the user might not yet hold an ambient session
  const exemptPaths = [
    '/auth/login',
    '/auth/signup',
    '/auth/demo-login',
    '/auth/google',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/csrf',
  ];

  const path = req.path;
  if (exemptPaths.some((p) => path.endsWith(p))) {
    return next();
  }

  const headerCsrf = (req.headers['x-csrf-token'] as string) || (req.headers['x-xsrf-token'] as string);
  const cookieCsrf = extractCsrfFromCookie(req);

  // If client provides CSRF token, verify it matches the cookie token
  if (!headerCsrf || !cookieCsrf || headerCsrf !== cookieCsrf) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Invalid or missing CSRF security token. State-changing requests require valid CSRF protection.',
      },
    });
    return;
  }

  next();
}

export const requireCsrf = csrfProtection;

/**
 * Hash password using bcrypt with work cost factor 12.
 * A cost of 12 enforces a ~250-300ms hashing latency to protect against offline dictionary/brute-force attacks.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtTokenPayload {
  sub: string;
  email: string;
  isDemo?: boolean;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export function generateToken(user: User): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtTokenPayload = {
    sub: user.id,
    email: user.email,
    isDemo: user.isDemo || false,
    iss: 'resumex-ai',
    aud: 'resumex-app',
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days expiration
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): JwtTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, signature] = parts;

    // Verify cryptographic signature in constant time
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature, 'utf-8');
    const expectedSigBuf = Buffer.from(expectedSignature, 'utf-8');
    if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
      return null;
    }

    const payload: JwtTokenPayload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));

    // Validate claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iss !== 'resumex-ai' || payload.aud !== 'resumex-app') return null;

    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const requestId = (req.headers['x-request-id'] as string) || undefined;
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Active session cookie is required.',
        requestId,
      },
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    clearAuthCookie(res, req);
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_INVALID_OR_EXPIRED',
        message: 'Authentication token is expired or invalid.',
        requestId,
      },
    });
  }

  try {
    const tokenHash = hashToken(token);
    const isRevoked = await db.isSessionRevoked(tokenHash);
    if (isRevoked) {
      clearAuthCookie(res, req);
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_REVOKED',
          message: 'Your session has been signed out or revoked. Please log in again.',
          requestId,
        },
      });
    }

    const user = await db.getUserById(payload.sub);
    if (!user) {
      clearAuthCookie(res, req);
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account associated with this session does not exist.',
          requestId,
        },
      });
    }

    req.user = user;
    req.token = token;
    req.tokenHash = tokenHash;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_INTERNAL_ERROR',
        message: 'An error occurred while verifying user authorization.',
        requestId,
      },
    });
  }
}
