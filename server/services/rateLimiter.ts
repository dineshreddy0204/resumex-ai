import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';

// Helper to return consistent structured 429 error
function createRateLimitHandler(code: string, message: string) {
  return (_req: Request, res: Response) => {
    const reqId = (res.getHeader('X-Request-Id') as string) || 'rate-limit';
    res.status(429).json({
      success: false,
      error: {
        code,
        message,
        requestId: reqId,
        timestamp: new Date().toISOString(),
      },
    });
  };
}

/**
 * Custom key generator that correctly resolves client IP when behind
 * reverse proxies (Google Front End, Cloud Run, Nginx, AI Studio),
 * handling both X-Forwarded-For and standardized Forwarded headers,
 * and applying IPv6 subnet normalization via ipKeyGenerator.
 */
function resolveClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const clientIp = xff.split(',')[0]?.trim();
    if (clientIp) {
      return ipKeyGenerator(clientIp);
    }
  }
  const forwarded = req.headers['forwarded'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const match = forwarded.match(/for="?([^;,"]+)/i);
    if (match?.[1]) {
      return ipKeyGenerator(match[1].trim());
    }
  }
  return ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1');
}

const commonLimiterConfig = {
  standardHeaders: true,
  legacyHeaders: true,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  keyGenerator: resolveClientIp,
};

/**
 * 1. Auth Rate Limiter:
 * 5 requests per 15 minutes for authentication & login attempts to reject brute force attacks.
 */
export const authLoginRateLimiter = rateLimit({
  ...commonLimiterConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 100,
  handler: createRateLimitHandler(
    'AUTH_RATE_LIMIT_EXCEEDED',
    'Too many login attempts. Please wait 15 minutes before trying again.'
  ),
});

/**
 * 2. AI Generation Rate Limiter:
 * 20 requests per minute to prevent denial-of-wallet and quota exhaustion.
 */
export const aiRateLimiter = rateLimit({
  ...commonLimiterConfig,
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  handler: createRateLimitHandler(
    'AI_RATE_LIMIT_EXCEEDED',
    'AI generation rate limit reached (20 requests per minute). Please wait a moment before running more AI optimizations.'
  ),
});

/**
 * 3. File Upload Rate Limiter:
 * 10 uploads per 10 minutes to protect document parsing pipelines from resource exhaustion.
 */
export const uploadRateLimiter = rateLimit({
  ...commonLimiterConfig,
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  handler: createRateLimitHandler(
    'UPLOAD_RATE_LIMIT_EXCEEDED',
    'File upload rate limit reached (10 uploads per 10 minutes). Please wait before uploading more documents.'
  ),
});
