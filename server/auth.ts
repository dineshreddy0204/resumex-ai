import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';
import type { User } from './types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Security Enforcement: In production, JWT_SECRET is strictly mandatory.
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('Application startup failure: Required security configuration is missing (JWT_SECRET is required in production).');
}

// In non-production, if JWT_SECRET is unset, generate an ephemeral cryptographically secure secret
let runtimeSecret = process.env.JWT_SECRET;
if (!runtimeSecret) {
  runtimeSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[Security] Notice: JWT_SECRET not set in environment. Generated ephemeral 256-bit development key.');
}
const JWT_SECRET: string = runtimeSecret;

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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header.',
      },
    });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: {
        code: 'TOKEN_INVALID_OR_EXPIRED',
        message: 'Authentication token is expired or invalid.',
      },
    });
  }

  try {
    const user = await db.getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account associated with this token does not exist.',
        },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(500).json({
      error: {
        code: 'AUTH_INTERNAL_ERROR',
        message: 'An error occurred while verifying user authorization.',
      },
    });
  }
}
