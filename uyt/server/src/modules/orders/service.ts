import type { PoolClient } from 'pg';
import { config } from '../../config.js';
import { many, one, withTx, type Queryable } from '../../db/pool.js';
import { conflict, notFound, tooMany } from '../../lib/errors.js';
import { fourDigitCode, randomToken } from '../../lib/security.js';
import { enqueueForOrder, kickOutbox } from '../../notifications/outbox.js';
import { emitToBranch, emitToOrder } from '../../realtime/io.js';

export type OrderStatus = 'preparing' | 'ready' | 'picked_up' | 'cancelled';

export interface OrderRow {
  id: string;
  brand_id: string;
  branch_id: string;
  order_number: string;
  status: OrderStatus;
  note: string | null;
  claim_secret: string;
  claim_code: string;
  estimated_ready_at: Date | null;
  reminder_count: number;
  last_notified_at: Date | null;
  created_at: Date;
  ready_at: Date | null;
  picked_up_at: Date | null;
  cancelled_at: Date | null;
  devices_count?: number;
  push_devices_count?: number;
  delivered_count?: number;
}

const ORDER_COLUMNS = `o.*,
  (SELECT count(*) FROM order_devices d WHERE d.order_id = o.id AND d.revoked_at IS NULL) AS devices_count,
  (SELECT count(*) FROM order_devices d WHERE d.order_id = o.id AND d.revoked_at IS NULL AND d.push_provider IS NOT NULL) AS push_devices_count,
  (SELECT count(*) FROM notifications n WHERE n.order_id = o.id AND n.status IN ('sent','delivered')) AS delivered_count`;

export const claimUrl = (o: Pick<OrderRow, 'id' | 'claim_secret'>) =>
  `${config.PUBLIC_WEB_URL}/o/${o.id}?k=${o.claim_secret}`;

/** Shape returned to staff screens. */
export function toStaffOrder(o: OrderRow) {
  return {
    id: o.id,
    branchId: o.branch_id,
    orderNumber: o.order_number,
    status: o.status,
    note: o.note,
    claimCode: o.claim_code,
    claimUrl: claimUrl(o),
    estimatedReadyAt: o.estimated_ready_at,
    reminderCount: o.reminder_count,
    lastNotifiedAt: o.last_notified_at,
    createdAt: o.created_at,
    readyAt: o.ready_at,
    pickedUpAt: o.picked_up_at,
    cancelledAt: o.cancelled_at,
    devicesCount: o.devices_count ?? 0,
    pushDevicesCount: o.push_devices_count ?? 0,
    deliveredCount: o.delivered_count ?? 0,
  };
}

export async function getOrderForBrand(brandId: string, orderId: string, db?: Queryable) {
  const row = await one<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM orders o WHERE o.id = $1 AND o.brand_id = $2`, [orderId, brandId], db);
  if (!row) throw notFound('Order');
  return row;
}

async function logEvent(db: PoolClient, o: { id: string; brand_id: string }, type: string, actor: string | null, data = {}) {
  await db.query(`INSERT INTO order_events (order_id, brand_id, type, actor_user_id, data) VALUES ($1,$2,$3,$4,$5)`, [
    o.id,
    o.brand_id,
    type,
    actor,
    data,
  ]);
}

/** Smart estimate: median prep time of this branch's last 30 orders (7 days), else the branch default. */
export async function estimatePrepMinutes(branchId: string, fallback: number): Promise<number> {
  const row = await one<{ median: number | null; n: number }>(
    `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ready_at - created_at)) / 60 AS median,
            count(*) AS n
       FROM (SELECT ready_at, created_at FROM orders
              WHERE branch_id = $1 AND ready_at IS NOT NULL AND created_at > now() - interval '7 days'
              ORDER BY created_at DESC LIMIT 30) t`,
    [branchId],
  );
  if (!row?.median || row.n < 5) return fallback;
  return Math.min(120, Math.max(1, Math.round(row.median)));
}

function broadcast(o: OrderRow) {
  const staff = toStaffOrder(o);
  emitToBranch(o.branch_id, 'order:upsert', staff);
  emitToOrder(o.id, 'order:status', {
    id: o.id,
    status: o.status,
    readyAt: o.ready_at,
    pickedUpAt: o.picked_up_at,
    estimatedReadyAt: o.estimated_ready_at,
  });
}

export async function createOrder(input: {
  brandId: string;
  branchId: string;
  orderNumber: string;
  note?: string | null;
  prepMinutes?: number;
  actorId: string;
}) {
  const branch = await one<{ avg_prep_minutes: number; is_active: boolean }>(
    `SELECT avg_prep_minutes, is_active FROM branches WHERE id = $1 AND brand_id = $2`,
    [input.branchId, input.brandId],
  );
  if (!branch) throw notFound('Branch');
  const minutes = input.prepMinutes ?? (await estimatePrepMinutes(input.branchId, branch.avg_prep_minutes));

  const order = await withTx(async (c) => {
    try {
      const { rows } = await c.query<OrderRow>(
        `INSERT INTO orders (brand_id, branch_id, order_number, note, claim_secret, claim_code, estimated_ready_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(mins => $7), $8) RETURNING *`,
        [input.brandId, input.branchId, input.orderNumber, input.note ?? null, randomToken(18), fourDigitCode(), minutes, input.actorId],
      );
      await logEvent(c, rows[0], 'created', input.actorId, { prepMinutes: minutes });
      return rows[0];
    } catch (err: any) {
      if (err?.code === '23505') throw conflict('order_number_active', `Order #${input.orderNumber} is already active in this branch`);
      throw err;
    }
  });
  const full = await getOrderForBrand(input.brandId, order.id);
  broadcast(full);
  return full;
}

/** Idempotent: a second "ready" press returns the order unchanged and queues nothing. */
export async function markReady(brandId: string, orderId: string, actorId: string) {
  const changed = await withTx(async (c) => {
    const { rows } = await c.query<OrderRow>(
      `UPDATE orders SET status = 'ready', ready_at = now(), ready_by = $3, last_notified_at = now()
        WHERE id = $1 AND brand_id = $2 AND status = 'preparing' RETURNING *`,
      [orderId, brandId, actorId],
    );
    if (!rows[0]) return null;
    await logEvent(c, rows[0], 'ready', actorId);
    const queued = await enqueueForOrder(c, orderId, 'ready');
    await logEvent(c, rows[0], 'notifications_queued', null, { count: queued });
    return rows[0];
  });
  const full = await getOrderForBrand(brandId, orderId);
  if (!changed && full.status !== 'ready') throw conflict('invalid_transition', `Order is ${full.status}`);
  if (changed) {
    kickOutbox();
    broadcast(full);
  }
  return full;
}

export async function remind(brandId: string, orderId: string, actorId: string, maxReminders: number) {
  const updated = await withTx(async (c) => {
    const { rows } = await c.query<OrderRow>(
      `UPDATE orders SET reminder_count = reminder_count + 1, last_notified_at = now()
        WHERE id = $1 AND brand_id = $2 AND status = 'ready'
          AND reminder_count < $3
          AND coalesce(last_notified_at, ready_at) < now() - interval '30 seconds'
        RETURNING *`,
      [orderId, brandId, Math.max(maxReminders, 1)],
    );
    if (!rows[0]) return null;
    await logEvent(c, rows[0], 'reminder', actorId, { n: rows[0].reminder_count });
    await enqueueForOrder(c, orderId, 'reminder', rows[0].reminder_count);
    return rows[0];
  });
  const full = await getOrderForBrand(brandId, orderId);
  if (!updated) {
    if (full.status !== 'ready') throw conflict('invalid_transition', `Order is ${full.status}`);
    throw tooMany('reminder_limited', 'Please wait before sending another reminder (or the reminder limit was reached)');
  }
  kickOutbox();
  emitToOrder(full.id, 'order:reminder', { id: full.id, n: full.reminder_count });
  emitToBranch(full.branch_id, 'order:upsert', toStaffOrder(full));
  return full;
}

export async function markPickedUp(brandId: string, orderId: string, actorId: string) {
  const changed = await withTx(async (c) => {
    const { rows } = await c.query<OrderRow>(
      `UPDATE orders SET status = 'picked_up', picked_up_at = now(), picked_up_by = $3,
              ready_at = coalesce(ready_at, now())
        WHERE id = $1 AND brand_id = $2 AND status IN ('preparing','ready') RETURNING *`,
      [orderId, brandId, actorId],
    );
    if (rows[0]) await logEvent(c, rows[0], 'picked_up', actorId);
    return rows[0] ?? null;
  });
  const full = await getOrderForBrand(brandId, orderId);
  if (!changed && full.status !== 'picked_up') throw conflict('invalid_transition', `Order is ${full.status}`);
  if (changed) broadcast(full);
  return full;
}

export async function cancelOrder(brandId: string, orderId: string, actorId: string) {
  const changed = await withTx(async (c) => {
    const { rows } = await c.query<OrderRow>(
      `UPDATE orders SET status = 'cancelled', cancelled_at = now()
        WHERE id = $1 AND brand_id = $2 AND status IN ('preparing','ready') RETURNING *`,
      [orderId, brandId],
    );
    if (rows[0]) {
      await logEvent(c, rows[0], 'cancelled', actorId);
      await c.query(`UPDATE notifications SET status = 'canceled' WHERE order_id = $1 AND status = 'pending'`, [orderId]);
    }
    return rows[0] ?? null;
  });
  const full = await getOrderForBrand(brandId, orderId);
  if (!changed && full.status !== 'cancelled') throw conflict('invalid_transition', `Order is ${full.status}`);
  if (changed) broadcast(full);
  return full;
}

/** Cashier can unlink phones (e.g. someone claimed the wrong order number). */
export async function unlinkDevices(brandId: string, orderId: string, actorId: string) {
  const order = await getOrderForBrand(brandId, orderId);
  await withTx(async (c) => {
    await c.query(`UPDATE order_devices SET revoked_at = now() WHERE order_id = $1 AND revoked_at IS NULL`, [orderId]);
    await c.query(`UPDATE orders SET claim_secret = $2, claim_code = $3 WHERE id = $1`, [orderId, randomToken(18), fourDigitCode()]);
    await logEvent(c, order, 'devices_unlinked', actorId);
  });
  emitToOrder(orderId, 'order:unlinked', { id: orderId });
  const full = await getOrderForBrand(brandId, orderId);
  emitToBranch(full.branch_id, 'order:upsert', toStaffOrder(full));
  return full;
}

export async function listActive(brandId: string, branchId: string) {
  return many<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM orders o
      WHERE o.brand_id = $1 AND o.branch_id = $2 AND o.status IN ('preparing','ready')
      ORDER BY o.created_at`,
    [brandId, branchId],
  );
}

export async function listHistory(p: {
  brandId: string;
  branchId?: string;
  q?: string;
  status?: OrderStatus;
  before?: string;
  limit: number;
}) {
  const params: unknown[] = [p.brandId];
  const where = ['o.brand_id = $1'];
  if (p.branchId) where.push(`o.branch_id = $${params.push(p.branchId)}`);
  if (p.status) where.push(`o.status = $${params.push(p.status)}`);
  else where.push(`o.status IN ('picked_up','cancelled')`);
  if (p.q) where.push(`o.order_number ILIKE $${params.push(`%${p.q}%`)}`);
  if (p.before) where.push(`o.created_at < $${params.push(p.before)}`);
  params.push(p.limit);
  return many<OrderRow & { stars: number | null }>(
    `SELECT ${ORDER_COLUMNS}, r.stars FROM orders o LEFT JOIN ratings r ON r.order_id = o.id
      WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT $${params.length}`,
    params,
  );
}
