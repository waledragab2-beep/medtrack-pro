import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { ADMIN_ROLES, assertBranchAccess, requireRole } from '../../plugins/guards.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

interface Range {
  brandId: string;
  branchId: string | null;
  from: string; // inclusive local date
  to: string; // inclusive local date
  tz: string;
}

/** Shared WHERE for "orders created in the local-date range" (timezone aware). */
const ORDER_SCOPE = `o.brand_id = $1 AND ($2::uuid IS NULL OR o.branch_id = $2)
  AND o.created_at >= ($3::date)::timestamp AT TIME ZONE $5
  AND o.created_at <  ($4::date + 1)::timestamp AT TIME ZONE $5`;

const args = (r: Range) => [r.brandId, r.branchId, r.from, r.to, r.tz];

export async function summary(r: Range) {
  const orders = await one(
    `SELECT count(*) FILTER (WHERE o.status <> 'cancelled')                       AS total_orders,
            count(*) FILTER (WHERE o.status = 'picked_up')                         AS picked_up,
            count(*) FILTER (WHERE o.status = 'cancelled')                         AS cancelled,
            avg(extract(epoch FROM o.ready_at - o.created_at)) FILTER (WHERE o.ready_at IS NOT NULL AND o.status <> 'cancelled') AS avg_prep_seconds,
            avg(extract(epoch FROM o.picked_up_at - o.ready_at)) FILTER (WHERE o.picked_up_at IS NOT NULL) AS avg_pickup_seconds,
            count(*) FILTER (WHERE
               (o.status = 'picked_up' AND o.picked_up_at - o.ready_at > make_interval(mins => br.late_pickup_minutes))
            OR (o.status = 'ready' AND now() - o.ready_at > make_interval(mins => br.late_pickup_minutes))) AS late_pickups,
            count(DISTINCT (o.created_at AT TIME ZONE $5)::date)                    AS active_days
       FROM orders o JOIN branches br ON br.id = o.branch_id
      WHERE ${ORDER_SCOPE}`,
    args(r),
  );
  const ratings = await one(
    `SELECT avg(rt.stars)::float AS avg_rating, count(*) AS ratings_count,
            count(*) FILTER (WHERE rt.google_clicked_at IS NOT NULL) AS google_clicks
       FROM ratings rt JOIN orders o ON o.id = rt.order_id WHERE ${ORDER_SCOPE}`,
    args(r),
  );
  const notif = await one(
    `SELECT count(*) FILTER (WHERE n.status IN ('sent','delivered','failed')) AS attempted,
            count(*) FILTER (WHERE n.status IN ('sent','delivered'))          AS accepted,
            count(*) FILTER (WHERE n.status = 'delivered')                    AS delivered,
            count(*) FILTER (WHERE n.status = 'failed')                       AS failed,
            count(*) FILTER (WHERE n.status = 'pending')                      AS pending
       FROM notifications n JOIN orders o ON o.id = n.order_id WHERE ${ORDER_SCOPE}`,
    args(r),
  );
  const linked = await one(
    `SELECT count(*) FILTER (WHERE EXISTS (SELECT 1 FROM order_devices d WHERE d.order_id = o.id)) AS linked,
            count(*) AS total
       FROM orders o WHERE ${ORDER_SCOPE} AND o.status <> 'cancelled'`,
    args(r),
  );
  const rate = (a: number, b: number) => (b ? a / b : null);
  return {
    totalOrders: orders.total_orders,
    pickedUp: orders.picked_up,
    cancelled: orders.cancelled,
    avgOrdersPerDay: orders.active_days ? orders.total_orders / orders.active_days : 0,
    avgPrepSeconds: orders.avg_prep_seconds,
    avgPickupSeconds: orders.avg_pickup_seconds,
    latePickups: orders.late_pickups,
    avgRating: ratings.avg_rating,
    ratingsCount: ratings.ratings_count,
    googleReviewClicks: ratings.google_clicks,
    notifications: {
      attempted: notif.attempted,
      accepted: notif.accepted,
      delivered: notif.delivered,
      failed: notif.failed,
      pending: notif.pending,
      /** Accepted by FCM / APNs / Web Push. */
      sendRate: rate(notif.accepted, notif.attempted),
      /** Confirmed received by the customer's device. */
      deliveryRate: rate(notif.delivered, notif.attempted),
    },
    /** Share of orders whose customer linked a phone (QR adoption). */
    linkRate: rate(linked.linked, linked.total),
  };
}

export async function daily(r: Range) {
  return many(
    `WITH days AS (SELECT generate_series($3::date, $4::date, interval '1 day')::date AS day)
     SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
            count(o.id) FILTER (WHERE o.status <> 'cancelled') AS orders,
            count(o.id) FILTER (WHERE o.status = 'picked_up') AS picked_up,
            avg(extract(epoch FROM o.ready_at - o.created_at)) FILTER (WHERE o.ready_at IS NOT NULL AND o.status <> 'cancelled') AS avg_prep_seconds,
            avg(extract(epoch FROM o.picked_up_at - o.ready_at)) AS avg_pickup_seconds
       FROM days d
       LEFT JOIN orders o ON (o.created_at AT TIME ZONE $5)::date = d.day AND ${ORDER_SCOPE}
      GROUP BY d.day ORDER BY d.day`,
    args(r),
  ).then((rows) =>
    rows.map((x) => ({
      date: x.date,
      orders: x.orders,
      pickedUp: x.picked_up,
      avgPrepSeconds: x.avg_prep_seconds,
      avgPickupSeconds: x.avg_pickup_seconds,
    })),
  );
}

export async function hourly(r: Range) {
  const rows = await many(
    `SELECT extract(hour FROM o.created_at AT TIME ZONE $5)::int AS hour, count(*) AS orders
       FROM orders o WHERE ${ORDER_SCOPE} AND o.status <> 'cancelled' GROUP BY 1 ORDER BY 1`,
    args(r),
  );
  const map = new Map(rows.map((x) => [x.hour, x.orders]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: map.get(h) ?? 0 }));
}

function shiftRange(from: string, to: string) {
  const f = new Date(from + 'T00:00:00Z');
  const t = new Date(to + 'T00:00:00Z');
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const pf = new Date(f.getTime() - days * 86400000);
  const pt = new Date(f.getTime() - 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(pf), to: iso(pt), days };
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/brands/:brandId/analytics', { preHandler: requireRole(ADMIN_ROLES) }, async (req) => {
    const q = parse(z.object({ from: date, to: date, branchId: z.uuid().optional() }), req.query);
    if (q.from > q.to) throw badRequest('invalid_range', '`from` must be before `to`');
    const { days } = shiftRange(q.from, q.to);
    if (days > 400) throw badRequest('invalid_range', 'Range too large (max 400 days)');
    const m = req.membership!;
    if (q.branchId) assertBranchAccess(m, q.branchId);
    const brand = await one<{ timezone: string; is_demo: boolean }>(`SELECT timezone, is_demo FROM brands WHERE id = $1`, [m.brandId]);
    const range: Range = { brandId: m.brandId, branchId: q.branchId ?? m.branchId ?? null, from: q.from, to: q.to, tz: brand!.timezone };
    const prev = shiftRange(q.from, q.to);
    const [current, previous, series, hours, allTime, recentRatings] = await Promise.all([
      summary(range),
      summary({ ...range, from: prev.from, to: prev.to }),
      daily(range),
      hourly(range),
      one(`SELECT count(*) AS n FROM orders WHERE brand_id = $1 AND status <> 'cancelled'`, [m.brandId]),
      many(
        `SELECT rt.stars, rt.comment, rt.created_at AS "createdAt", o.order_number AS "orderNumber"
           FROM ratings rt JOIN orders o ON o.id = rt.order_id
          WHERE rt.brand_id = $1 AND ($2::uuid IS NULL OR rt.branch_id = $2)
          ORDER BY rt.created_at DESC LIMIT 10`,
        [m.brandId, range.branchId],
      ),
    ]);
    return {
      isDemo: brand!.is_demo,
      timezone: brand!.timezone,
      range: { from: q.from, to: q.to, days },
      previousRange: { from: prev.from, to: prev.to },
      allTimeOrders: allTime!.n,
      current,
      previous,
      daily: series,
      hourly: hours,
      recentRatings,
    };
  });
}
