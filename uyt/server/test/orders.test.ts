import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { processOutboxBatch, scheduleAutoReminders } from '../src/notifications/outbox.js';
import { Client, fakeProviders, newApp, registerMerchant, resetDb, type FakeProvider } from './helpers.js';

let client: Client;
let app: Awaited<ReturnType<typeof newApp>>['app'];
let push: Record<string, FakeProvider>;

beforeAll(async () => {
  await resetDb();
  ({ app, client } = await newApp());
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
beforeEach(() => {
  push = fakeProviders();
});

async function setup() {
  const m = await registerMerchant(client);
  const create = async (orderNumber: string) => {
    const r = await client.req('POST', `/api/brands/${m.brandId}/orders`, { token: m.token, body: { branchId: m.branch.id, orderNumber } });
    expect(r.status).toBe(201);
    return r.body.order;
  };
  const claim = async (orderNumber: string, extra: Record<string, unknown> = {}) =>
    client.req('POST', `/api/public/branches/${m.branch.slug}/claim`, { body: { orderNumber, ...extra } });
  const action = (orderId: string, a: string) => client.req('POST', `/api/brands/${m.brandId}/orders/${orderId}/${a}`, { token: m.token });
  return { ...m, create, claim, action };
}

describe('order lifecycle & notifications', () => {
  it('sends exactly one "ready" push to the linked phone and records delivery', async () => {
    const s = await setup();
    const order = await s.create('101');
    const c = await s.claim('101');
    expect(c.status).toBe(201);
    const device = c.body.deviceToken;
    expect((await client.req('POST', '/api/public/device/push', { device, body: { provider: 'fcm', token: 'f'.repeat(40) } })).status).toBe(200);

    const r1 = await s.action(order.id, 'ready');
    expect(r1.status).toBe(200);
    expect(r1.body.order.status).toBe('ready');
    // Pressing "ready" twice must not queue a second alert.
    expect((await s.action(order.id, 'ready')).status).toBe(200);

    await processOutboxBatch();
    expect(push.fcm.sent).toHaveLength(1);
    const msg = push.fcm.sent[0].msg;
    expect(msg.body).toBe('🔔 طلبك جاهز! تعال استلمه من الكاونتر');
    expect(msg.title).toContain('#101');
    expect(push.fcm.sent[0].target.token).toBe('f'.repeat(40));

    await processOutboxBatch();
    expect(push.fcm.sent).toHaveLength(1);

    expect((await client.req('POST', `/api/public/notifications/${msg.notificationId}/ack`, { device })).status).toBe(200);
    const st = await pool.query(`SELECT status FROM notifications WHERE id = $1`, [msg.notificationId]);
    expect(st.rows[0].status).toBe('delivered');

    const view = await client.req('GET', `/api/public/orders/${order.id}`, { device });
    expect(view.body.order.status).toBe('ready');

    const done = await s.action(order.id, 'pickup');
    expect(done.body.order.status).toBe('picked_up');
    expect((await client.req('POST', `/api/public/orders/${order.id}/rating`, { device, body: { stars: 5, comment: 'Fast!' } })).status).toBe(201);
  });

  it('never notifies or exposes other customers’ orders', async () => {
    const s = await setup();
    const a = await s.create('201');
    const b = await s.create('202');
    const devA = (await s.claim('201')).body.deviceToken;
    const devB = (await s.claim('202')).body.deviceToken;
    await client.req('POST', '/api/public/device/push', { device: devA, body: { provider: 'fcm', token: 'a'.repeat(40) } });
    await client.req('POST', '/api/public/device/push', { device: devB, body: { provider: 'fcm', token: 'b'.repeat(40) } });

    expect((await client.req('GET', `/api/public/orders/${b.id}`, { device: devA })).status).toBe(403);
    expect((await client.req('GET', `/api/public/orders/${a.id}`)).status).toBe(401);

    await s.action(a.id, 'ready');
    await processOutboxBatch();
    expect(push.fcm.sent.map((x) => x.target.token)).toEqual(['a'.repeat(40)]);
  });

  it('rejects duplicate active order numbers but allows reuse after pickup', async () => {
    const s = await setup();
    const o = await s.create('300');
    const dup = await client.req('POST', `/api/brands/${s.brandId}/orders`, { token: s.token, body: { branchId: s.branch.id, orderNumber: '300' } });
    expect(dup.status).toBe(409);
    await s.action(o.id, 'pickup');
    await s.create('300');
  });

  it('limits how many phones can link to an order and lets the cashier unlink', async () => {
    const s = await setup();
    const o = await s.create('400');
    expect((await s.claim('400')).status).toBe(201);
    expect((await s.claim('400')).status).toBe(201);
    const third = await s.claim('400');
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('order_already_linked');
    const un = await s.action(o.id, 'unlink');
    expect(un.body.order.devicesCount).toBe(0);
    expect((await s.claim('400')).status).toBe(201);
  });

  it('enforces the 4-digit code when the branch requires it', async () => {
    const s = await setup();
    await client.req('PATCH', `/api/brands/${s.brandId}/branches/${s.branch.id}`, { token: s.token, body: { requireClaimCode: true } });
    const o = await s.create('500');
    expect((await s.claim('500', { claimCode: '0000' === o.claimCode ? '1111' : '0000' })).status).toBe(403);
    expect((await s.claim('500', { claimCode: o.claimCode })).status).toBe(201);
  });

  it('links through the per-order QR secret', async () => {
    const s = await setup();
    const o = await s.create('550');
    const secret = new URL(o.claimUrl).searchParams.get('k');
    expect((await client.req('POST', `/api/public/orders/${o.id}/claim`, { body: { secret: 'x'.repeat(24) } })).status).toBe(404);
    const ok = await client.req('POST', `/api/public/orders/${o.id}/claim`, { body: { secret, platform: 'ios' } });
    expect(ok.status).toBe(201);
    expect(ok.body.orderId).toBe(o.id);
  });

  it('retries transient push failures and drops dead tokens', async () => {
    const s = await setup();
    const o1 = await s.create('600');
    const d1 = (await s.claim('600')).body.deviceToken;
    await client.req('POST', '/api/public/device/push', { device: d1, body: { provider: 'fcm', token: 'c'.repeat(40) } });
    push.fcm.next.push({ ok: false, permanent: false, error: 'unavailable' });
    await s.action(o1.id, 'ready');
    await processOutboxBatch();
    let n = (await pool.query(`SELECT status, attempts FROM notifications WHERE order_id = $1`, [o1.id])).rows[0];
    expect(n).toMatchObject({ status: 'pending', attempts: 1 });
    await pool.query(`UPDATE notifications SET next_attempt_at = now() WHERE order_id = $1`, [o1.id]);
    await processOutboxBatch();
    n = (await pool.query(`SELECT status, attempts FROM notifications WHERE order_id = $1`, [o1.id])).rows[0];
    expect(n).toMatchObject({ status: 'sent', attempts: 2 });

    const o2 = await s.create('601');
    const d2 = (await s.claim('601')).body.deviceToken;
    await client.req('POST', '/api/public/device/push', { device: d2, body: { provider: 'fcm', token: 'd'.repeat(40) } });
    push.fcm.next.push({ ok: false, permanent: true, error: 'messaging/registration-token-not-registered' });
    await s.action(o2.id, 'ready');
    await processOutboxBatch();
    expect((await pool.query(`SELECT status FROM notifications WHERE order_id = $1`, [o2.id])).rows[0].status).toBe('failed');
    expect((await pool.query(`SELECT push_token FROM order_devices WHERE order_id = $1`, [o2.id])).rows[0].push_token).toBeNull();
  });

  it('sends manual and automatic reminders with limits', async () => {
    const s = await setup();
    const o = await s.create('700');
    const d = (await s.claim('700')).body.deviceToken;
    await client.req('POST', '/api/public/device/push', { device: d, body: { provider: 'expo', token: 'ExponentPushToken[abcdefghij]' } });
    await s.action(o.id, 'ready');
    await processOutboxBatch();
    // Too soon for a manual reminder.
    expect((await s.action(o.id, 'remind')).status).toBe(429);
    await pool.query(`UPDATE orders SET ready_at = now() - interval '10 minutes', last_notified_at = now() - interval '10 minutes' WHERE id = $1`, [o.id]);
    expect(await scheduleAutoReminders()).toBe(1);
    await processOutboxBatch();
    expect(push.expo.sent.map((x) => x.msg.kind)).toEqual(['ready', 'reminder']);
    expect(push.expo.sent[1].msg.body).toContain('#700');
  });

  it('cancelling an order cancels pending pushes', async () => {
    const s = await setup();
    const o = await s.create('800');
    const d = (await s.claim('800')).body.deviceToken;
    await client.req('POST', '/api/public/device/push', { device: d, body: { provider: 'fcm', token: 'e'.repeat(40) } });
    await s.action(o.id, 'ready');
    await s.action(o.id, 'cancel');
    await processOutboxBatch();
    expect(push.fcm.sent).toHaveLength(0);
    expect((await s.claim('800')).status).toBe(404);
  });
});
