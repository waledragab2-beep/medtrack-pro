import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../../config.js';
import { many, one, withTx } from '../../db/pool.js';
import { AppError, conflict, unauthorized } from '../../lib/errors.js';
import { hashPassword, randomToken, sha256, signAccessToken, verifyPassword } from '../../lib/security.js';
import { slugify } from '../../lib/slug.js';
import { parse } from '../../lib/validate.js';
import { requireUser } from '../../plugins/guards.js';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a digit');

const email = z.email().max(200).transform((v) => v.toLowerCase());

async function issueTokens(userId: string, userAgent?: string) {
  const refreshToken = randomToken(32);
  await one(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(days => $4))`,
    [userId, sha256(refreshToken), userAgent?.slice(0, 300) ?? null, config.REFRESH_TOKEN_DAYS],
  );
  return { accessToken: signAccessToken(userId), refreshToken };
}

export async function getMe(userId: string) {
  const user = await one(`SELECT id, email, full_name AS "fullName", locale FROM users WHERE id = $1`, [userId]);
  if (!user) throw unauthorized();
  const memberships = await many(
    `SELECT m.role, m.branch_id AS "branchId", b.id AS "brandId", b.name, b.name_en AS "nameEn", b.slug,
            b.logo_url AS "logoUrl", b.is_demo AS "isDemo", b.subscription_status AS "subscriptionStatus",
            b.trial_ends_at AS "trialEndsAt"
       FROM memberships m JOIN brands b ON b.id = m.brand_id
      WHERE m.user_id = $1 AND m.is_active ORDER BY m.created_at`,
    [userId],
  );
  return { user, memberships };
}

export async function authRoutes(app: FastifyInstance) {
  const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  /** Merchant sign-up: creates the user, the brand (tenant), the first branch and the owner membership. */
  app.post('/auth/register', strict, async (req, reply) => {
    const body = parse(
      z.object({
        fullName: z.string().trim().min(2).max(100),
        email,
        password: passwordSchema,
        brandName: z.string().trim().min(2).max(80),
        branchName: z.string().trim().min(2).max(80).optional(),
        locale: z.enum(['ar', 'en']).default('ar'),
      }),
      req.body,
    );
    const passwordHash = await hashPassword(body.password);
    const userId = await withTx(async (c) => {
      const exists = await c.query(`SELECT 1 FROM users WHERE email = $1`, [body.email]);
      if (exists.rowCount) throw conflict('email_taken', 'An account with this email already exists');
      const u = await c.query(`INSERT INTO users (email, password_hash, full_name, locale) VALUES ($1,$2,$3,$4) RETURNING id`, [
        body.email,
        passwordHash,
        body.fullName,
        body.locale,
      ]);
      const b = await c.query(`INSERT INTO brands (slug, name, default_locale) VALUES ($1,$2,$3) RETURNING id`, [
        slugify(body.brandName),
        body.brandName,
        body.locale,
      ]);
      await c.query(`INSERT INTO branches (brand_id, slug, name) VALUES ($1,$2,$3)`, [
        b.rows[0].id,
        slugify(body.brandName),
        body.branchName ?? (body.locale === 'ar' ? 'الفرع الرئيسي' : 'Main branch'),
      ]);
      await c.query(`INSERT INTO memberships (user_id, brand_id, role) VALUES ($1,$2,'owner')`, [u.rows[0].id, b.rows[0].id]);
      return u.rows[0].id as string;
    });
    reply.code(201);
    return { ...(await issueTokens(userId, req.headers['user-agent'])), ...(await getMe(userId)) };
  });

  app.post('/auth/login', strict, async (req) => {
    const body = parse(z.object({ email, password: z.string().min(1).max(128) }), req.body);
    const user = await one<{ id: string; password_hash: string }>(`SELECT id, password_hash FROM users WHERE email = $1`, [body.email]);
    // Constant-ish time: always run bcrypt.
    const ok = await verifyPassword(body.password, user?.password_hash ?? '$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    if (!user || !ok) throw new AppError(401, 'invalid_credentials', 'Email or password is incorrect');
    await one(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);
    return { ...(await issueTokens(user.id, req.headers['user-agent'])), ...(await getMe(user.id)) };
  });

  /** Rotating refresh tokens: each refresh token works once. */
  app.post('/auth/refresh', strict, async (req) => {
    const body = parse(z.object({ refreshToken: z.string().min(20) }), req.body);
    const row = await one<{ user_id: string }>(
      `UPDATE refresh_tokens SET revoked_at = now()
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() RETURNING user_id`,
      [sha256(body.refreshToken)],
    );
    if (!row) throw unauthorized('Session expired, please sign in again');
    return issueTokens(row.user_id, req.headers['user-agent']);
  });

  app.post('/auth/logout', async (req) => {
    const body = parse(z.object({ refreshToken: z.string().min(20) }), req.body);
    await one(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [sha256(body.refreshToken)]);
    return { ok: true };
  });

  app.get('/me', { preHandler: requireUser }, async (req) => getMe(req.userId!));

  app.post('/me/password', { preHandler: requireUser }, async (req) => {
    const body = parse(z.object({ currentPassword: z.string(), newPassword: passwordSchema }), req.body);
    const u = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [req.userId]);
    if (!u || !(await verifyPassword(body.currentPassword, u.password_hash)))
      throw new AppError(400, 'invalid_credentials', 'Current password is incorrect');
    await one(`UPDATE users SET password_hash = $2 WHERE id = $1`, [req.userId, await hashPassword(body.newPassword)]);
    await one(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [req.userId]);
    return { ok: true };
  });
}
