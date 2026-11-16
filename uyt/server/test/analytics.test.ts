import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { Client, newApp, registerMerchant, resetDb } from './helpers.js';

let client: Client;
let app: Awaited<ReturnType<typeof newApp>>['app'];

beforeAll(async () => {
  await resetDb();
  ({ app, client } = await newApp());
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('analytics', () => {
  it('computes prep time, pickup time, late pickups, ratings and comparison', async () => {
    const m = await registerMerchant(client, 'Stats Café');
    await pool.query(`UPDATE brands SET timezone = 'UTC' WHERE id = $1`, [m.brandId]);
    // Two orders yesterday-of-range and one in the previous period, inserted with precise timestamps.
    const ins = (n: string, created: string, prepSec: number, pickupSec: number | null) =>
      pool.query(
        `INSERT INTO orders (brand_id, branch_id, order_number, status, claim_secret, claim_code, created_at, ready_at, picked_up_at)
         VALUES ($1,$2,$3,$4,'s','0000',$5::timestamptz, $5::timestamptz + make_interval(secs => $6),
                 CASE WHEN $7::int IS NULL THEN NULL ELSE $5::timestamptz + make_interval(secs => $6 + $7) END) RETURNING id`,
        [m.brandId, m.branch.id, n, pickupSec === null ? 'ready' : 'picked_up', created, prepSec, pickupSec],
      );
    const a = await ins('1', '2026-03-10T10:00:00Z', 300, 60);
    await ins('2', '2026-03-10T12:00:00Z', 420, 600); // late (> 5 min)
    await ins('3', '2026-03-09T09:00:00Z', 200, 30); // previous period
    await pool.query(`INSERT INTO ratings (order_id, brand_id, branch_id, stars) VALUES ($1,$2,$3,4)`, [a.rows[0].id, m.brandId, m.branch.id]);

    const r = await client.req('GET', `/api/brands/${m.brandId}/analytics?from=2026-03-10&to=2026-03-10`, { token: m.token });
    expect(r.status).toBe(200);
    expect(r.body.current).toMatchObject({ totalOrders: 2, pickedUp: 2, latePickups: 1, avgPrepSeconds: 360, avgPickupSeconds: 330, avgRating: 4, ratingsCount: 1 });
    expect(r.body.previous.totalOrders).toBe(1);
    expect(r.body.previousRange).toEqual({ from: '2026-03-09', to: '2026-03-09' });
    expect(r.body.daily).toEqual([expect.objectContaining({ date: '2026-03-10', orders: 2 })]);
    expect(r.body.hourly[10].orders).toBe(1);
    expect(r.body.allTimeOrders).toBe(3);
  });
});
