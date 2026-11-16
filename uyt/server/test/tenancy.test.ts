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

describe('auth', () => {
  it('logs in, refreshes once (rotation) and rejects bad passwords', async () => {
    const m = await registerMerchant(client, 'Auth Café');
    const me = await client.req('GET', '/api/me', { token: m.token });
    const email = me.body.user.email;
    expect((await client.req('POST', '/api/auth/login', { body: { email, password: 'wrong-pass1' } })).status).toBe(401);
    expect((await client.req('POST', '/api/auth/login', { body: { email, password: 'Passw0rd1' } })).status).toBe(200);
    const r1 = await client.req('POST', '/api/auth/refresh', { body: { refreshToken: m.refreshToken } });
    expect(r1.status).toBe(200);
    expect((await client.req('POST', '/api/auth/refresh', { body: { refreshToken: m.refreshToken } })).status).toBe(401);
    expect((await client.req('GET', '/api/me')).status).toBe(401);
  });
});

describe('tenant isolation', () => {
  it('a merchant cannot see or change another brand', async () => {
    const a = await registerMerchant(client, 'Brand A');
    const b = await registerMerchant(client, 'Brand B');
    const order = await client.req('POST', `/api/brands/${a.brandId}/orders`, { token: a.token, body: { branchId: a.branch.id, orderNumber: '1' } });

    expect((await client.req('GET', `/api/brands/${a.brandId}`, { token: b.token })).status).toBe(404);
    expect((await client.req('GET', `/api/brands/${a.brandId}/orders?branchId=${a.branch.id}`, { token: b.token })).status).toBe(404);
    expect((await client.req('POST', `/api/brands/${b.brandId}/orders/${order.body.order.id}/ready`, { token: b.token })).status).toBe(404);
    // B cannot create orders in A's branch through its own brand route.
    expect(
      (await client.req('POST', `/api/brands/${b.brandId}/orders`, { token: b.token, body: { branchId: a.branch.id, orderNumber: '9' } })).status,
    ).toBe(404);
    expect(
      (await client.req('PATCH', `/api/brands/${b.brandId}/branches/${a.branch.id}`, { token: b.token, body: { name: 'hacked' } })).status,
    ).toBe(404);
    const cat = await client.req('POST', `/api/brands/${a.brandId}/menu/categories`, { token: a.token, body: { name: 'Hot' } });
    expect(
      (await client.req('POST', `/api/brands/${b.brandId}/menu/items`, { token: b.token, body: { name: 'x', categoryId: cat.body.item.id } })).status,
    ).toBe(404);
  });
});

describe('roles', () => {
  it('cashiers run orders but cannot open analytics or settings', async () => {
    const o = await registerMerchant(client, 'Roles Café');
    const email = `cashier-${Date.now()}@test.dev`;
    const add = await client.req('POST', `/api/brands/${o.brandId}/staff`, {
      token: o.token,
      body: { email, fullName: 'Cashier', role: 'cashier', password: 'Cash1erPass', branchId: o.branch.id },
    });
    expect(add.status).toBe(201);
    const login = await client.req('POST', '/api/auth/login', { body: { email, password: 'Cash1erPass' } });
    const t = login.body.accessToken;
    expect(login.body.memberships[0].role).toBe('cashier');

    const created = await client.req('POST', `/api/brands/${o.brandId}/orders`, { token: t, body: { branchId: o.branch.id, orderNumber: '55' } });
    expect(created.status).toBe(201);
    expect((await client.req('POST', `/api/brands/${o.brandId}/orders/${created.body.order.id}/ready`, { token: t })).status).toBe(200);
    expect((await client.req('GET', `/api/brands/${o.brandId}/analytics?from=2026-01-01&to=2026-01-31`, { token: t })).status).toBe(403);
    expect((await client.req('PATCH', `/api/brands/${o.brandId}`, { token: t, body: { name: 'x y' } })).status).toBe(403);
    expect((await client.req('GET', `/api/brands/${o.brandId}/staff`, { token: t })).status).toBe(403);

    // Branch-restricted cashier cannot use another branch.
    const br2 = await client.req('POST', `/api/brands/${o.brandId}/branches`, { token: o.token, body: { name: 'Second' } });
    expect(
      (await client.req('POST', `/api/brands/${o.brandId}/orders`, { token: t, body: { branchId: br2.body.branch.id, orderNumber: '1' } })).status,
    ).toBe(403);
  });
});

describe('brand settings & public page', () => {
  it('updates identity and exposes only public data', async () => {
    const m = await registerMerchant(client, 'Public Café');
    const patch = await client.req('PATCH', `/api/brands/${m.brandId}`, {
      token: m.token,
      body: {
        nameEn: 'Public Cafe',
        theme: { primary: '#FF0000' },
        social: { instagram: 'https://instagram.com/public' },
        googleReviewUrl: 'https://g.page/r/abc/review',
        notificationSettings: { readyBodyAr: 'جاهز يا بطل' },
      },
    });
    expect(patch.status).toBe(200);
    expect(patch.body.brand.theme.primary).toBe('#FF0000');
    expect(patch.body.brand.theme.background).toBe('#0A0A0A');
    await client.req('POST', `/api/brands/${m.brandId}/offers`, { token: m.token, body: { title: 'خصم 20%' } });
    await client.req('POST', `/api/brands/${m.brandId}/offers`, {
      token: m.token,
      body: { title: 'Expired', endsAt: '2020-01-01T00:00:00Z' },
    });
    const pub = await client.req('GET', `/api/public/branches/${m.branch.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.brand.social.instagram).toBe('https://instagram.com/public');
    expect(pub.body.offers.map((o: any) => o.title)).toEqual(['خصم 20%']);
    expect(JSON.stringify(pub.body)).not.toMatch(/claim_secret|claimCode|subscription/);
    expect((await client.req('PATCH', `/api/brands/${m.brandId}`, { token: m.token, body: { googleReviewUrl: 'javascript:alert(1)' } })).status).toBe(400);
  });
});
