import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  return {
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-server-middleware',
        async configureServer(server) {
          const express = (await import('express')).default;
          const { apiRouter } = await import('./server/api');
          const app = express();
          app.set('trust proxy', true);
          app.use((req, res, next) => {
            const origin = req.headers.origin;
            if (origin) {
              res.setHeader('Access-Control-Allow-Origin', origin);
              res.setHeader('Access-Control-Allow-Credentials', 'true');
              res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
              res.setHeader(
                'Access-Control-Allow-Headers',
                'Content-Type,Authorization,X-CSRF-Token,X-Request-Id,X-XSRF-Token'
              );
            }
            if (req.method === 'OPTIONS') {
              return res.sendStatus(204);
            }
            next();
          });
          app.use(express.json({ limit: '50mb' }));
          app.get('/health', (_req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
          });
          app.use('/api', apiRouter);

          server.middlewares.use((req, res, next) => {
            if (req.url === '/health' || req.url?.startsWith('/api')) {
              app(req as any, res as any, next);
            } else {
              next();
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
