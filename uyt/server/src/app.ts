import path from 'node:path';
import { mkdirSync } from 'node:fs';
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { AppError } from './lib/errors.js';
import { analyticsRoutes } from './modules/analytics/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { brandRoutes } from './modules/brands/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { orderRoutes } from './modules/orders/routes.js';
import { publicRoutes } from './modules/public/routes.js';
import { uploadRoutes } from './modules/uploads/routes.js';

export const corsOrigins = () => config.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.NODE_ENV === 'production' ? 'info' : 'debug' },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 256 * 1024,
  });

  await app.register(cors, { origin: corsOrigins(), credentials: true });
  // Rate limiting is per IP (use TRUST_PROXY behind a load balancer). Disabled for the automated test-suite only.
  if (config.NODE_ENV !== 'test') {
    await app.register(rateLimit, { max: 300, timeWindow: '1 minute', enableDraftSpec: true });
  }
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  const uploadRoot = path.resolve(config.UPLOAD_DIR);
  mkdirSync(uploadRoot, { recursive: true });
  await app.register(fastifyStatic, { root: uploadRoot, prefix: '/uploads/', decorateReply: false, maxAge: '30d', immutable: true });

  if (config.SERVE_WEB_DIR) {
    const webRoot = path.resolve(config.SERVE_WEB_DIR);
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
      setHeaders(res, file) {
        if (file.endsWith('apple-app-site-association')) res.header('content-type', 'application/json');
        if (file.includes(`${path.sep}assets${path.sep}`)) res.header('cache-control', 'public, max-age=31536000, immutable');
        else res.header('cache-control', 'no-cache');
      },
    });
    // SPA routes (/s/:slug, /o/:id, /app/…) fall back to index.html; API paths keep JSON 404s.
    app.setNotFoundHandler((req, reply) => {
      const p = req.url.split('?')[0];
      if (req.method === 'GET' && !/^\/(api|uploads|socket\.io|assets|\.well-known)\//.test(p)) {
        return reply.type('text/html').sendFile('index.html');
      }
      return reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } });
    });
  }

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Frame-Options', 'DENY');
  });

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply.code(status).send({
      error: { code: (err as FastifyError).code ?? 'internal_error', message: status >= 500 ? 'Something went wrong' : err.message },
    });
  });

  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { ok: true, service: 'uyt-api', time: new Date() };
  });

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(brandRoutes);
      await api.register(orderRoutes);
      await api.register(catalogRoutes);
      await api.register(uploadRoutes);
      await api.register(analyticsRoutes);
      await api.register(publicRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
