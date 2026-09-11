import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';
import type { User } from './types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Security Check: Fail fast in production if required JWT_SECRET is missing
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('Application startup failure: Required security configuration is missing (JWT_SECRET is required in production).');
}

const JWT_SECRET = process.env.JWT_SECRET || 'resumex_core_ultra_dev_jwt_secret_key_2026';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: User): string {
  const payload = {
    userId: user.id,
    email: user.email,
    isDemo: user.isDemo || false,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(str).digest('base64url');
  return `${str}.${sig}`;
}

export function verifyToken(token: string): { userId: string; email: string; isDemo?: boolean } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [str, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(str).digest('base64url');
    if (sig !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token.' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid.' });
  }

  const user = db.getUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User account not found.' });
  }

  req.user = user;
  next();
}
