import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { readNotificationSettings } from '../../lib/settings.js';
import { parse } from '../../lib/validate.js';
import { ALL_ROLES, assertBranchAccess, requireRole } from '../../plugins/guards.js';
import * as svc from './service.js';

const orderNumber = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .regex(/^[\p{L}\p{N}#\-_ ]+$/u, 'Use letters, digits, # or -')
  .transform((v) => v.replace(/^#/, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));

const params = z.object({ brandId: z.uuid(), orderId: z.uuid() });

export async function orderRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRole(ALL_ROLES) };

  app.get('/brands/:brandId/orders', guard, async (req) => {
    const q = parse(
      z.object({
        branchId: z.uuid().optional(),
        scope: z.enum(['active', 'history']).default('active'),
        status: z.enum(['preparing', 'ready', 'picked_up', 'cancelled']).optional(),
        q: z.string().trim().max(20).optional(),
        before: z.iso.datetime({ offset: true }).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
      req.query,
    );
    const m = req.membership!;
    const branchId = q.branchId ?? m.branchId ?? undefined;
    if (branchId) assertBranchAccess(m, branchId);
    if (q.scope === 'active') {
      if (!branchId) throw notFound('Branch');
      const rows = await svc.listActive(m.brandId, branchId);
      return { orders: rows.map(svc.toStaffOrder) };
    }
    const rows = await svc.listHistory({ brandId: m.brandId, branchId, q: q.q, status: q.status, before: q.before, limit: q.limit });
    return {
      orders: rows.map((r) => ({ ...svc.toStaffOrder(r), rating: r.stars })),
      nextBefore: rows.length === q.limit ? rows[rows.length - 1].created_at : null,
    };
  });

  app.post('/brands/:brandId/orders', guard, async (req, reply) => {
    const body = parse(
      z.object({
        branchId: z.uuid(),
        orderNumber,
        note: z.string().trim().max(200).nullish(),
        prepMinutes: z.number().int().min(1).max(180).optional(),
      }),
      req.body,
    );
    assertBranchAccess(req.membership!, body.branchId);
    const order = await svc.createOrder({ ...body, brandId: req.membership!.brandId, actorId: req.userId! });
    reply.code(201);
    return { order: svc.toStaffOrder(order) };
  });

  app.get('/brands/:brandId/orders/:orderId', guard, async (req) => {
    const p = parse(params, req.params);
    const order = await svc.getOrderForBrand(p.brandId, p.orderId);
    assertBranchAccess(req.membership!, order.branch_id);
    const [events, notifications, rating] = await Promise.all([
      many(`SELECT type, data, created_at AS "createdAt" FROM order_events WHERE order_id = $1 ORDER BY id`, [p.orderId]),
      many(
        `SELECT kind, provider, status, attempts, last_error AS "lastError", created_at AS "createdAt",
                sent_at AS "sentAt", delivered_at AS "deliveredAt" FROM notifications WHERE order_id = $1 ORDER BY created_at`,
        [p.orderId],
      ),
      one(`SELECT stars, comment, created_at AS "createdAt" FROM ratings WHERE order_id = $1`, [p.orderId]),
    ]);
    return { order: svc.toStaffOrder(order), events, notifications, rating };
  });

  // State transitions. The branch check is done on the loaded order to keep branch-restricted cashiers in scope.
  const transition = (fn: (brandId: string, orderId: string, actor: string) => Promise<svc.OrderRow>) =>
    async (req: any) => {
      const p = parse(params, req.params);
      const current = await svc.getOrderForBrand(p.brandId, p.orderId);
      assertBranchAccess(req.membership!, current.branch_id);
      return { order: svc.toStaffOrder(await fn(p.brandId, p.orderId, req.userId!)) };
    };

  app.post('/brands/:brandId/orders/:orderId/ready', guard, transition(svc.markReady));
  app.post('/brands/:brandId/orders/:orderId/pickup', guard, transition(svc.markPickedUp));
  app.post('/brands/:brandId/orders/:orderId/cancel', guard, transition(svc.cancelOrder));
  app.post('/brands/:brandId/orders/:orderId/unlink', guard, transition(svc.unlinkDevices));
  app.post(
    '/brands/:brandId/orders/:orderId/remind',
    guard,
    transition(async (brandId, orderId, actor) => {
      const b = await one<{ notification_settings: unknown }>(`SELECT notification_settings FROM brands WHERE id = $1`, [brandId]);
      return svc.remind(brandId, orderId, actor, readNotificationSettings(b?.notification_settings).maxReminders);
    }),
  );
}
