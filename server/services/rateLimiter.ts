import rateLimit from 'express-rate-limit';
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
 * 1. Auth Rate Limiter:
 * 5 requests per 15 minutes for authentication & login attempts to reject brute force attacks.
 */
export const authLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: true,
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
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: true,
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
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: true,
  handler: createRateLimitHandler(
    'UPLOAD_RATE_LIMIT_EXCEEDED',
    'File upload rate limit reached (10 uploads per 10 minutes). Please wait before uploading more documents.'
  ),
});
