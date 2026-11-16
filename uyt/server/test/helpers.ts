import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { setProviders } from '../src/notifications/providers/index.js';
import type { PushMessage, PushProvider, PushResult, PushTarget, ProviderName } from '../src/notifications/types.js';

export async function resetDb() {
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  await migrate(() => {});
}

export interface FakeProvider extends PushProvider {
  sent: { target: PushTarget; msg: PushMessage }[];
  next: PushResult[];
}

/** Records every push; `next` lets a test script failures. */
export function fakeProviders(): Record<ProviderName, FakeProvider> {
  const make = (name: ProviderName): FakeProvider => {
    const p: FakeProvider = {
      name,
      sent: [],
      next: [],
      isConfigured: () => true,
      async send(target, msg) {
        p.sent.push({ target, msg });
        return p.next.shift() ?? { ok: true, messageId: `${name}-${p.sent.length}` };
      },
    };
    return p;
  };
  const all = { fcm: make('fcm'), apns: make('apns'), webpush: make('webpush'), expo: make('expo') };
  setProviders(all);
  return all;
}

export class Client {
  constructor(public app: FastifyInstance) {}
  async req(method: string, url: string, opts: { token?: string; device?: string; body?: unknown } = {}) {
    const res = await this.app.inject({
      method: method as any,
      url,
      payload: opts.body as any,
      headers: {
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.device ? { 'x-device-token': opts.device } : {}),
      },
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
  }
}

let counter = 0;
export async function registerMerchant(c: Client, brandName = 'Test Café') {
  counter++;
  const r = await c.req('POST', '/api/auth/register', {
    body: { fullName: 'Owner ' + counter, email: `owner${counter}-${Date.now()}@test.dev`, password: 'Passw0rd1', brandName },
  });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  const brandId = r.body.memberships[0].brandId as string;
  const brand = await c.req('GET', `/api/brands/${brandId}`, { token: r.body.accessToken });
  return { token: r.body.accessToken as string, refreshToken: r.body.refreshToken as string, brandId, branch: brand.body.branches[0] };
}

export async function newApp() {
  const app = await buildApp();
  await app.ready();
  return { app, client: new Client(app) };
}
