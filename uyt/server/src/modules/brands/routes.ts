import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../../config.js';
import { many, one, withTx } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hashPassword } from '../../lib/security.js';
import { notificationSettingsSchema, readNotificationSettings, readTheme, themeSchema } from '../../lib/settings.js';
import { slugify } from '../../lib/slug.js';
import { optionalUrl, parse } from '../../lib/validate.js';
import { ADMIN_ROLES, ALL_ROLES, requireRole } from '../../plugins/guards.js';
import { passwordSchema } from '../auth/routes.js';

export function serializeBrand(b: any) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    nameEn: b.name_en,
    tagline: b.tagline,
    taglineEn: b.tagline_en,
    logoUrl: b.logo_url,
    coverUrl: b.cover_url,
    gallery: b.gallery ?? [],
    theme: readTheme(b.theme),
    social: b.social ?? {},
    googleReviewUrl: b.google_review_url,
    notificationSettings: readNotificationSettings(b.notification_settings),
    defaultLocale: b.default_locale,
    timezone: b.timezone,
    currency: b.currency,
    plan: b.plan,
    subscriptionStatus: b.subscription_status,
    trialEndsAt: b.trial_ends_at,
    isDemo: b.is_demo,
  };
}

export function serializeBranch(b: any) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    address: b.address,
    phone: b.phone,
    lat: b.lat,
    lng: b.lng,
    mapsUrl: b.maps_url,
    openingHours: b.opening_hours,
    avgPrepMinutes: b.avg_prep_minutes,
    latePickupMinutes: b.late_pickup_minutes,
    requireClaimCode: b.require_claim_code,
    maxDevicesPerOrder: b.max_devices_per_order,
    isActive: b.is_active,
    qrUrl: `${config.PUBLIC_WEB_URL}/s/${b.slug}`,
  };
}

const socialSchema = z.object({
  instagram: optionalUrl,
  facebook: optionalUrl,
  tiktok: optionalUrl,
  x: optionalUrl,
  snapchat: optionalUrl,
  website: optionalUrl,
  whatsapp: z.string().trim().max(20).regex(/^\+?\d*$/).optional(),
});

const brandPatch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  nameEn: z.string().trim().max(80).nullish(),
  tagline: z.string().trim().max(140).nullish(),
  taglineEn: z.string().trim().max(140).nullish(),
  logoUrl: optionalUrl,
  coverUrl: optionalUrl,
  gallery: z.array(z.url()).max(12).optional(),
  theme: themeSchema.partial().optional(),
  social: socialSchema.optional(),
  googleReviewUrl: optionalUrl,
  notificationSettings: notificationSettingsSchema.partial().optional(),
  defaultLocale: z.enum(['ar', 'en']).optional(),
  timezone: z.string().max(60).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
});

const branchBody = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).nullish(),
  phone: z.string().trim().max(30).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  mapsUrl: optionalUrl,
  openingHours: z.string().trim().max(200).nullish(),
  avgPrepMinutes: z.number().int().min(1).max(180).optional(),
  latePickupMinutes: z.number().int().min(1).max(180).optional(),
  requireClaimCode: z.boolean().optional(),
  maxDevicesPerOrder: z.number().int().min(1).max(5).optional(),
  isActive: z.boolean().optional(),
});

const BRANCH_COLS: Record<string, string> = {
  name: 'name', address: 'address', phone: 'phone', lat: 'lat', lng: 'lng', mapsUrl: 'maps_url',
  openingHours: 'opening_hours', avgPrepMinutes: 'avg_prep_minutes', latePickupMinutes: 'late_pickup_minutes',
  requireClaimCode: 'require_claim_code', maxDevicesPerOrder: 'max_devices_per_order', isActive: 'is_active',
};

/** Builds "col = $n" pairs only for keys present in the body. */
function setClause(body: Record<string, unknown>, map: Record<string, string>, params: unknown[]) {
  return Object.entries(body)
    .filter(([k, v]) => v !== undefined && map[k])
    .map(([k, v]) => `${map[k]} = $${params.push(v)}`);
}

export async function brandRoutes(app: FastifyInstance) {
  const anyMember = { preHandler: requireRole(ALL_ROLES) };
  const admin = { preHandler: requireRole(ADMIN_ROLES) };
  const owner = { preHandler: requireRole(['owner']) };

  app.get('/brands/:brandId', anyMember, async (req) => {
    const b = await one(`SELECT * FROM brands WHERE id = $1`, [req.membership!.brandId]);
    const branches = await many(`SELECT * FROM branches WHERE brand_id = $1 ORDER BY created_at`, [req.membership!.brandId]);
    return { brand: serializeBrand(b), branches: branches.map(serializeBranch), role: req.membership!.role, branchId: req.membership!.branchId };
  });

  app.patch('/brands/:brandId', admin, async (req) => {
    const body = parse(brandPatch, req.body);
    const id = req.membership!.brandId;
    const current = await one(`SELECT theme, notification_settings, social FROM brands WHERE id = $1`, [id]);
    const params: unknown[] = [];
    const sets = setClause(
      {
        name: body.name, name_en: body.nameEn, tagline: body.tagline, tagline_en: body.taglineEn,
        logo_url: body.logoUrl, cover_url: body.coverUrl, google_review_url: body.googleReviewUrl,
        default_locale: body.defaultLocale, timezone: body.timezone, currency: body.currency,
      },
      Object.fromEntries(['name', 'name_en', 'tagline', 'tagline_en', 'logo_url', 'cover_url', 'google_review_url', 'default_locale', 'timezone', 'currency'].map((k) => [k, k])),
      params,
    );
    if (body.timezone) {
      const ok = await one(`SELECT 1 FROM pg_timezone_names WHERE name = $1`, [body.timezone]);
      if (!ok) throw badRequest('invalid_timezone', 'Unknown timezone');
    }
    if (body.gallery) sets.push(`gallery = $${params.push(JSON.stringify(body.gallery))}`);
    if (body.theme) sets.push(`theme = $${params.push(readTheme({ ...current.theme, ...body.theme }))}`);
    if (body.social) sets.push(`social = $${params.push({ ...current.social, ...body.social })}`);
    if (body.notificationSettings)
      sets.push(`notification_settings = $${params.push(readNotificationSettings({ ...current.notification_settings, ...body.notificationSettings }))}`);
    if (sets.length) {
      params.push(id);
      await one(`UPDATE brands SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
    }
    return { brand: serializeBrand(await one(`SELECT * FROM brands WHERE id = $1`, [id])) };
  });

  // ── Branches ──────────────────────────────────────────────
  app.post('/brands/:brandId/branches', admin, async (req, reply) => {
    const body = parse(branchBody, req.body);
    const brand = await one<{ name: string; name_en: string | null }>(`SELECT name, name_en FROM brands WHERE id = $1`, [req.membership!.brandId]);
    const params: unknown[] = [req.membership!.brandId, slugify(`${brand!.name_en ?? ''} ${body.name}`)];
    const entries = Object.entries(body).filter(([k, v]) => v !== undefined && BRANCH_COLS[k]);
    const cols = entries.map(([k]) => BRANCH_COLS[k]);
    entries.forEach(([, v]) => params.push(v));
    const row = await one(
      `INSERT INTO branches (brand_id, slug, ${cols.join(',')}) VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(',')}) RETURNING *`,
      params,
    );
    reply.code(201);
    return { branch: serializeBranch(row) };
  });

  app.patch('/brands/:brandId/branches/:branchId', admin, async (req) => {
    const { branchId } = parse(z.object({ branchId: z.uuid() }), req.params);
    const body = parse(branchBody.partial(), req.body);
    const params: unknown[] = [];
    const sets = setClause(body, BRANCH_COLS, params);
    if (!sets.length) throw badRequest('empty_update', 'Nothing to update');
    params.push(branchId, req.membership!.brandId);
    const row = await one(
      `UPDATE branches SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND brand_id = $${params.length} RETURNING *`,
      params,
    );
    if (!row) throw notFound('Branch');
    return { branch: serializeBranch(row) };
  });

  // ── Staff ─────────────────────────────────────────────────
  app.get('/brands/:brandId/staff', admin, async (req) => ({
    staff: await many(
      `SELECT u.id, u.email, u.full_name AS "fullName", m.role, m.branch_id AS "branchId", m.is_active AS "isActive",
              u.last_login_at AS "lastLoginAt", m.created_at AS "createdAt"
         FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.brand_id = $1 ORDER BY m.created_at`,
      [req.membership!.brandId],
    ),
  }));

  const canManage = (actor: string, target: string) => actor === 'owner' || (actor === 'manager' && target === 'cashier');

  /**
   * Adds a staff member. Assumption (no e-mail service yet): the owner sets an initial password and shares it;
   * if the e-mail already has a UYT account it is simply attached to this brand.
   */
  app.post('/brands/:brandId/staff', admin, async (req, reply) => {
    const body = parse(
      z.object({
        email: z.email().transform((v) => v.toLowerCase()),
        fullName: z.string().trim().min(2).max(100),
        role: z.enum(['owner', 'manager', 'cashier']),
        branchId: z.uuid().nullish(),
        password: passwordSchema.optional(),
      }),
      req.body,
    );
    const m = req.membership!;
    if (!canManage(m.role, body.role)) throw forbidden('Managers can only add cashiers');
    if (body.branchId && !(await one(`SELECT 1 FROM branches WHERE id = $1 AND brand_id = $2`, [body.branchId, m.brandId])))
      throw notFound('Branch');
    const result = await withTx(async (c) => {
      let user = (await c.query(`SELECT id FROM users WHERE email = $1`, [body.email])).rows[0];
      if (!user) {
        if (!body.password) throw badRequest('password_required', 'Set an initial password for the new account');
        user = (
          await c.query(`INSERT INTO users (email, password_hash, full_name) VALUES ($1,$2,$3) RETURNING id`, [
            body.email,
            await hashPassword(body.password),
            body.fullName,
          ])
        ).rows[0];
      }
      const ins = await c.query(
        `INSERT INTO memberships (user_id, brand_id, role, branch_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [user.id, m.brandId, body.role, body.branchId ?? null],
      );
      if (!ins.rowCount) throw conflict('already_member', 'This person is already on the team');
      return user.id as string;
    });
    reply.code(201);
    return { id: result };
  });

  app.patch('/brands/:brandId/staff/:userId', admin, async (req) => {
    const { userId } = parse(z.object({ userId: z.uuid() }), req.params);
    const body = parse(
      z.object({ role: z.enum(['owner', 'manager', 'cashier']).optional(), branchId: z.uuid().nullish(), isActive: z.boolean().optional() }),
      req.body,
    );
    const m = req.membership!;
    const target = await one<{ role: string }>(`SELECT role FROM memberships WHERE user_id = $1 AND brand_id = $2`, [userId, m.brandId]);
    if (!target) throw notFound('Staff member');
    if (userId === req.userId) throw forbidden('You cannot change your own access');
    if (!canManage(m.role, target.role) || (body.role && !canManage(m.role, body.role))) throw forbidden();
    const params: unknown[] = [];
    const sets = setClause(body, { role: 'role', branchId: 'branch_id', isActive: 'is_active' }, params);
    if (!sets.length) throw badRequest('empty_update', 'Nothing to update');
    params.push(userId, m.brandId);
    await one(`UPDATE memberships SET ${sets.join(', ')} WHERE user_id = $${params.length - 1} AND brand_id = $${params.length}`, params);
    if (body.isActive === false) await one(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    return { ok: true };
  });

  app.delete('/brands/:brandId/staff/:userId', owner, async (req) => {
    const { userId } = parse(z.object({ userId: z.uuid() }), req.params);
    if (userId === req.userId) throw forbidden('You cannot remove yourself');
    await one(`DELETE FROM memberships WHERE user_id = $1 AND brand_id = $2`, [userId, req.membership!.brandId]);
    return { ok: true };
  });
}
