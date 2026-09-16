import express from 'express';
import path from 'path';
import { apiRouter } from './server/api';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';

  // Trust proxy for reverse proxies (e.g. Cloud Run, Nginx, ALB)
  app.set('trust proxy', true);

  // Global HTTP Security Headers & Content Security Policy (CSP)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CSP directive configuration — Allows Google AI Studio iframe embedding, Firebase, Google APIs, and fonts
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://*.firebaseapp.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com data:; " +
        "img-src 'self' data: blob: https://*.googleusercontent.com https://images.unsplash.com https://*.gstatic.com; " +
        "connect-src 'self' https://accounts.google.com https://apis.google.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com https://generativelanguage.googleapis.com https://*.run.app; " +
        "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://*.google.com; " +
        "frame-ancestors 'self' https://ai.studio https://*.ai.studio https://*.google.com https://*.googleusercontent.com https://*.run.app;"
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
        origin.endsWith('.ai.studio') ||
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

  // Root health probe for container environments (Cloud Run, Kubernetes, Docker)
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Mount API routes FIRST before any middleware/static fallbacks
  app.use('/api', apiRouter);

  // Vite middleware for development; static distribution for production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
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

  const server = app.listen(PORT, HOST, () => {
    console.log(`ResumeX AI Server listening on http://${HOST}:${PORT}`);
  });

  // Graceful shutdown handling for container rollouts
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, closing server gracefully...`);
    server.close(() => {
      console.log('Server closed successfully.');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
