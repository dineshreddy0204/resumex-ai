import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/api';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for reverse proxies (e.g. Cloud Run, Nginx, ALB)
  app.set('trust proxy', 1);

  // Global HTTP Security Headers & Content Security Policy (CSP)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CSP directive configuration
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com data:; " +
        "img-src 'self' data: blob: https://*.googleusercontent.com https://images.unsplash.com; " +
        "connect-src 'self' https://accounts.google.com https://apis.google.com https://generativelanguage.googleapis.com; " +
        "frame-src 'self' https://accounts.google.com; " +
        "frame-ancestors 'self';"
    );

    if (process.env.NODE_ENV === 'production' && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // CORS configuration (Credentials enabled requires explicit origin reflection, never wildcard)
    const origin = req.headers.origin;
    if (origin) {
      const isAllowedOrigin =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.google.com') ||
        origin.endsWith('.aistudio.google.com') ||
        Boolean(process.env.APP_URL && origin === process.env.APP_URL);

      if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type,Authorization,X-CSRF-Token,X-Request-Id'
        );
      }
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });

  // Mount API routes FIRST before any middleware/static fallbacks
  app.use('/api', apiRouter);

  // Vite middleware for development; static distribution for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ResumeX AI Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
