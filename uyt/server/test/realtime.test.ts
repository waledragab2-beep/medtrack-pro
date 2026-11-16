import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { pool } from '../src/db/pool.js';
import { attachRealtime, closeRealtime } from '../src/realtime/io.js';
import { Client, newApp, registerMerchant, resetDb } from './helpers.js';

let client: Client;
let app: Awaited<ReturnType<typeof newApp>>['app'];
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  await resetDb();
  ({ app, client } = await newApp());
  attachRealtime(app.server, ['*']);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address() as { port: number };
  url = `http://127.0.0.1:${addr.port}`;
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await closeRealtime();
  await pool.end();
});

const open = (auth: Record<string, string>) =>
  new Promise<Socket>((resolve, reject) => {
    const s = connect(url, { auth, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });

const next = <T>(s: Socket, event: string) => new Promise<T>((r) => s.once(event, r));

describe('realtime', () => {
  it('pushes status to the linked customer and updates to the cashier screen', async () => {
    const m = await registerMerchant(client, 'Live Café');
    const order = (await client.req('POST', `/api/brands/${m.brandId}/orders`, { token: m.token, body: { branchId: m.branch.id, orderNumber: '77' } })).body.order;
    const claim = await client.req('POST', `/api/public/branches/${m.branch.slug}/claim`, { body: { orderNumber: '77' } });

    const customer = await open({ deviceToken: claim.body.deviceToken });
    const cashier = await open({ accessToken: m.token });
    const sub = await cashier.emitWithAck('subscribe:branch', { brandId: m.brandId, branchId: m.branch.id });
    expect(sub).toEqual({ ok: true });

    const statusP = next<any>(customer, 'order:status');
    const upsertP = next<any>(cashier, 'order:upsert');
    await client.req('POST', `/api/brands/${m.brandId}/orders/${order.id}/ready`, { token: m.token });
    expect((await statusP).status).toBe('ready');
    expect((await upsertP).status).toBe('ready');

    // Another merchant cannot subscribe to this branch.
    const other = await registerMerchant(client, 'Spy Café');
    const spy = await open({ accessToken: other.token });
    expect(await spy.emitWithAck('subscribe:branch', { brandId: m.brandId, branchId: m.branch.id })).toMatchObject({ ok: false });
    // Invalid device tokens are refused.
    await expect(open({ deviceToken: 'x'.repeat(43) })).rejects.toThrow();
  });
});
