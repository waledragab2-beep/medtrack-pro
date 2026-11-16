import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { config } from '../../config.js';
import { many, one, withTx } from '../../db/pool.js';
import { AppError, conflict, forbidden, notFound } from '../../lib/errors.js';
import { randomToken, sha256 } from '../../lib/security.js';
import { readNotificationSettings, readTheme } from '../../lib/settings.js';
import { parse } from '../../lib/validate.js';
import { requireDevice } from '../../plugins/guards.js';
import { emitToBranch } from '../../realtime/io.js';
import { serializeCategory, serializeItem, serializeOffer } from '../catalog/routes.js';
import { getOrderForBrand, toStaffOrder } from '../orders/service.js';

/** Only recent, still-open orders can be linked to a phone. */
const CLAIM_WINDOW = `interval '12 hours'`;

const platform = z.enum(['web', 'android', 'ios']).default('web');
const locale = z.enum(['ar', 'en']).default('ar');

function publicBrand(b: any) {
  const ns = readNotificationSettings(b.notification_settings);
  return {
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
    currency: b.currency,
    alertSound: ns.alertSound,
    isDemo: b.is_demo,
  };
}

function publicBranch(b: any) {
  return {
    slug: b.slug,
    name: b.name,
    address: b.address,
    phone: b.phone,
    lat: b.lat,
    lng: b.lng,
    mapsUrl: b.maps_url,
    openingHours: b.opening_hours,
    requireClaimCode: b.require_claim_code,
  };
}

async function brandContent(brandId: string) {
  const [categories, items, offers] = await Promise.all([
    many(`SELECT * FROM menu_categories WHERE brand_id = $1 ORDER BY sort, created_at`, [brandId]),
    many(`SELECT * FROM menu_items WHERE brand_id = $1 AND is_available ORDER BY sort, created_at`, [brandId]),
    many(
      `SELECT * FROM offers WHERE brand_id = $1 AND is_active
          AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
        ORDER BY sort, created_at DESC`,
      [brandId],
    ),
  ]);
  return {
    menu: {
      categories: categories.map(serializeCategory),
      items: items.map(serializeItem),
    },
    offers: offers.map(serializeOffer),
  };
}

async function loadBranchBySlug(slug: string) {
  const row = await one(
    `SELECT br.*, row_to_json(b.*) AS brand FROM branches br JOIN brands b ON b.id = br.brand_id
      WHERE br.slug = $1 AND br.is_active`,
    [slug],
  );
  if (!row) throw notFound('Store');
  return row;
}

/** Creates the device link inside a transaction that holds a row lock on the order. */
async function linkDevice(
  c: PoolClient,
  order: { id: string; brand_id: string; branch_id: string },
  maxDevices: number,
  req: FastifyRequest,
  p: { platform: 'web' | 'android' | 'ios'; locale: 'ar' | 'en' },
) {
  const { rows } = await c.query(`SELECT count(*) AS n FROM order_devices WHERE order_id = $1 AND revoked_at IS NULL`, [order.id]);
  if (rows[0].n >= maxDevices) {
    throw conflict('order_already_linked', 'This order is already linked to another phone. Please ask the cashier.');
  }
  const token = randomToken(32);
  await c.query(
    `INSERT INTO order_devices (order_id, brand_id, token_hash, platform, locale, user_agent) VALUES ($1,$2,$3,$4,$5,$6)`,
    [order.id, order.brand_id, sha256(token), p.platform, p.locale, req.headers['user-agent']?.slice(0, 300) ?? null],
  );
  await c.query(`INSERT INTO order_events (order_id, brand_id, type, data) VALUES ($1,$2,'device_linked',$3)`, [
    order.id,
    order.brand_id,
    { platform: p.platform },
  ]);
  return token;
}

async function notifyStaff(brandId: string, orderId: string) {
  const full = await getOrderForBrand(brandId, orderId);
  emitToBranch(full.branch_id, 'order:upsert', toStaffOrder(full));
}

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function publicRoutes(app: FastifyInstance) {
  const claimLimit = { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } };

  app.get('/public/config', async () => ({ vapidPublicKey: config.VAPID_PUBLIC_KEY ?? null }));

  /** Landing page behind the store QR code. */
  app.get('/public/branches/:slug', async (req) => {
    const { slug } = parse(z.object({ slug: z.string().min(1).max(80) }), req.params);
    const row = await loadBranchBySlug(slug);
    return { brand: publicBrand(row.brand), branch: publicBranch(row), ...(await brandContent(row.brand_id)) };
  });

  /** Static store QR → customer types the order number (and the 4-digit code if the branch requires it). */
  app.post('/public/branches/:slug/claim', claimLimit, async (req, reply) => {
    const { slug } = parse(z.object({ slug: z.string().min(1).max(80) }), req.params);
    const body = parse(
      z.object({
        orderNumber: z
          .string()
          .trim()
          .min(1)
          .max(12)
          .transform((v) => v.replace(/^#/, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))),
        claimCode: z.string().trim().max(8).optional(),
        platform,
        locale,
      }),
      req.body,
    );
    const branch = await loadBranchBySlug(slug);
    const result = await withTx(async (c) => {
      const { rows } = await c.query(
        `SELECT id, brand_id, branch_id, claim_code FROM orders
          WHERE branch_id = $1 AND lower(order_number) = lower($2) AND status IN ('preparing','ready')
            AND created_at > now() - ${CLAIM_WINDOW}
          FOR UPDATE`,
        [branch.id, body.orderNumber],
      );
      const order = rows[0];
      if (!order) throw new AppError(404, 'order_not_found', 'We could not find an open order with this number');
      if (branch.require_claim_code && !safeEqual(body.claimCode ?? '', order.claim_code)) {
        throw new AppError(403, 'invalid_claim_code', 'The order code is incorrect');
      }
      return { orderId: order.id as string, token: await linkDevice(c, order, branch.max_devices_per_order, req, body) };
    });
    await notifyStaff(branch.brand_id, result.orderId);
    reply.code(201);
    return { orderId: result.orderId, deviceToken: result.token };
  });

  /** Per-order QR shown on the cashier screen / receipt: the secret proves the customer is at the counter. */
  app.post('/public/orders/:orderId/claim', claimLimit, async (req, reply) => {
    const { orderId } = parse(z.object({ orderId: z.uuid() }), req.params);
    const body = parse(z.object({ secret: z.string().min(10).max(64), platform, locale }), req.body);
    const result = await withTx(async (c) => {
      const { rows } = await c.query(
        `SELECT o.id, o.brand_id, o.branch_id, o.claim_secret, br.max_devices_per_order
           FROM orders o JOIN branches br ON br.id = o.branch_id
          WHERE o.id = $1 AND o.status IN ('preparing','ready') AND o.created_at > now() - ${CLAIM_WINDOW}
          FOR UPDATE OF o`,
        [orderId],
      );
      const order = rows[0];
      if (!order || !safeEqual(body.secret, order.claim_secret)) {
        throw new AppError(404, 'order_not_found', 'This order link is invalid or has expired');
      }
      return { brandId: order.brand_id as string, token: await linkDevice(c, order, order.max_devices_per_order, req, body) };
    });
    await notifyStaff(result.brandId, orderId);
    reply.code(201);
    return { orderId, deviceToken: result.token };
  });

  /** Order tracking – only devices linked to this exact order may read it. */
  app.get('/public/orders/:orderId', { preHandler: requireDevice }, async (req) => {
    const { orderId } = parse(z.object({ orderId: z.uuid() }), req.params);
    if (req.device!.orderId !== orderId) throw forbidden('This device is linked to a different order');
    const o = await one(
      `SELECT o.*, row_to_json(b.*) AS brand, row_to_json(br.*) AS branch,
              (SELECT count(*) FROM orders q WHERE q.branch_id = o.branch_id AND q.status = 'preparing'
                 AND q.created_at < o.created_at) AS ahead,
              (SELECT json_build_object('stars', r.stars, 'comment', r.comment) FROM ratings r WHERE r.order_id = o.id) AS rating,
              (SELECT push_provider FROM order_devices WHERE id = $2) AS push_provider
         FROM orders o JOIN brands b ON b.id = o.brand_id JOIN branches br ON br.id = o.branch_id
        WHERE o.id = $1`,
      [orderId, req.device!.id],
    );
    if (!o) throw notFound('Order');
    return {
      serverTime: new Date(),
      order: {
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        createdAt: o.created_at,
        estimatedReadyAt: o.estimated_ready_at,
        readyAt: o.ready_at,
        pickedUpAt: o.picked_up_at,
        cancelledAt: o.cancelled_at,
        queueAhead: o.status === 'preparing' ? o.ahead : 0,
        rating: o.rating,
        pushEnabled: Boolean(o.push_provider),
      },
      brand: publicBrand(o.brand),
      branch: publicBranch(o.branch),
      ...(await brandContent(o.brand_id)),
    };
  });

  /** Register the push channel for this device (FCM / APNs / Web Push / Expo). */
  app.post('/public/device/push', { preHandler: requireDevice }, async (req) => {
    const body = parse(
      z.discriminatedUnion('provider', [
        z.object({ provider: z.literal('fcm'), token: z.string().min(20).max(4096) }),
        z.object({ provider: z.literal('apns'), token: z.string().regex(/^[0-9a-fA-F]{64,200}$/) }),
        z.object({ provider: z.literal('expo'), token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/) }),
        z.object({
          provider: z.literal('webpush'),
          subscription: z.object({
            endpoint: z.url({ protocol: /^https$/ }),
            expirationTime: z.number().nullish(),
            keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
          }),
        }),
      ]),
      req.body,
    );
    await one(`UPDATE order_devices SET push_provider = $2, push_token = $3, push_subscription = $4 WHERE id = $1`, [
      req.device!.id,
      body.provider,
      'token' in body ? body.token : null,
      'subscription' in body ? body.subscription : null,
    ]);
    // If the order became ready before the phone registered for push, the open page already shows it – no push needed.
    await notifyStaff(req.device!.brandId, req.device!.orderId);
    return { ok: true };
  });

  /** Delivery receipt from the app / service worker (feeds the "notification delivery rate" metric). */
  app.post('/public/notifications/:id/ack', { preHandler: requireDevice }, async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    await one(
      `UPDATE notifications SET status = 'delivered', delivered_at = coalesce(delivered_at, now()),
              sent_at = coalesce(sent_at, now())
        WHERE id = $1 AND device_id = $2 AND status IN ('pending','sent','failed')`,
      [id, req.device!.id],
    );
    return { ok: true };
  });

  /** Fallback ack when the id is unknown (e.g. iOS delivered while the app was killed): ack all sent for this device. */
  app.post('/public/notifications/ack-all', { preHandler: requireDevice }, async (req) => {
    await one(
      `UPDATE notifications SET status = 'delivered', delivered_at = now() WHERE device_id = $1 AND status = 'sent'`,
      [req.device!.id],
    );
    return { ok: true };
  });

  app.post('/public/orders/:orderId/rating', { preHandler: requireDevice }, async (req, reply) => {
    const { orderId } = parse(z.object({ orderId: z.uuid() }), req.params);
    if (req.device!.orderId !== orderId) throw forbidden();
    const body = parse(z.object({ stars: z.number().int().min(1).max(5), comment: z.string().trim().max(500).nullish() }), req.body);
    const row = await one(
      `INSERT INTO ratings (order_id, brand_id, branch_id, stars, comment)
       SELECT id, brand_id, branch_id, $2, $3 FROM orders WHERE id = $1 AND status IN ('ready','picked_up')
       ON CONFLICT (order_id) DO UPDATE SET stars = EXCLUDED.stars, comment = EXCLUDED.comment
       RETURNING id`,
      [orderId, body.stars, body.comment ?? null],
    );
    if (!row) throw conflict('not_collected', 'You can rate after collecting your order');
    reply.code(201);
    return { ok: true };
  });

  app.post('/public/orders/:orderId/review-click', { preHandler: requireDevice }, async (req) => {
    const { orderId } = parse(z.object({ orderId: z.uuid() }), req.params);
    if (req.device!.orderId !== orderId) throw forbidden();
    await one(`UPDATE ratings SET google_clicked_at = coalesce(google_clicked_at, now()) WHERE order_id = $1`, [orderId]);
    return { ok: true };
  });
}
