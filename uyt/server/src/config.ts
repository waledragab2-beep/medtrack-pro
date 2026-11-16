import { z } from 'zod';

try {
  // Node >= 20.12: load .env when present (no extra dependency).
  process.loadEnvFile?.();
} catch {
  /* no .env file – rely on real environment variables */
}

// One-service deployments (Render, Railway, …): the platform tells us our public URL.
const platformUrl = process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL;
if (platformUrl) {
  process.env.PUBLIC_WEB_URL ||= platformUrl;
  process.env.PUBLIC_API_URL ||= platformUrl;
  process.env.CORS_ORIGINS ||= platformUrl;
}

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).default('postgres://uyt:uyt@localhost:5432/uyt'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('1h'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  /** Public URL of the web app – used to build QR links. */
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  /** Public URL of this API – used to build uploaded-file URLs. */
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  TRUST_PROXY: bool,
  /** When set, the API also serves the built web app from this folder (single-service deployment). */
  SERVE_WEB_DIR: z.string().optional(),

  // Push providers – each one is optional; unconfigured providers are skipped with a clear log line.
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(), // JSON, base64 JSON, or a file path
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_KEY_P8: z.string().optional(), // PEM content (\n escaped allowed) or a file path
  APNS_BUNDLE_ID: z.string().default('app.uyt.customer'),
  APNS_PRODUCTION: bool,
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:support@uyt.app'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  /** Development only: pretend every push succeeded (logs instead of sending). */
  PUSH_MOCK: bool,
  NOTIFICATION_WORKER: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
