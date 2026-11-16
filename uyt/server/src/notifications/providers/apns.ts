import { connect, type ClientHttp2Session } from 'node:http2';
import { existsSync, readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { NATIVE_SOUND, type PushProvider, type PushResult } from '../types.js';

let session: ClientHttp2Session | null = null;
let cachedJwt: { token: string; at: number } | null = null;

const host = () => (config.APNS_PRODUCTION ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com');

function key(): string {
  const raw = config.APNS_KEY_P8!.trim();
  return existsSync(raw) ? readFileSync(raw, 'utf8') : raw.replace(/\\n/g, '\n');
}

function providerToken(force = false): string {
  // Apple accepts a token for up to 60 minutes; refresh every 50.
  if (!force && cachedJwt && Date.now() - cachedJwt.at < 50 * 60 * 1000) return cachedJwt.token;
  const token = jwt.sign({ iss: config.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }, key(), {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: config.APNS_KEY_ID! },
  });
  cachedJwt = { token, at: Date.now() };
  return token;
}

function getSession(): ClientHttp2Session {
  if (!session || session.closed || session.destroyed) {
    session = connect(host());
    session.on('error', () => (session = null));
    session.on('goaway', () => (session = null));
  }
  return session;
}

function request(deviceToken: string, body: string, collapseId: string): Promise<{ status: number; body: string; apnsId?: string }> {
  return new Promise((resolve, reject) => {
    const req = getSession().request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken()}`,
      'apns-topic': config.APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 15 * 60),
      'apns-collapse-id': collapseId.slice(0, 64),
      'content-type': 'application/json',
    });
    let status = 0;
    let apnsId: string | undefined;
    let data = '';
    req.setTimeout(10_000, () => req.close());
    req.on('response', (h) => {
      status = Number(h[':status']);
      apnsId = h['apns-id'] as string | undefined;
    });
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve({ status, body: data, apnsId }));
    req.on('error', reject);
    req.end(body);
  });
}

/** Direct APNs (token-based auth, .p8 key) for native iOS device tokens. */
export const apnsProvider: PushProvider = {
  name: 'apns',
  isConfigured: () => Boolean(config.APNS_KEY_ID && config.APNS_TEAM_ID && config.APNS_KEY_P8),
  async send(target, msg): Promise<PushResult> {
    if (!target.token) return { ok: false, permanent: true, error: 'missing_token' };
    const payload = JSON.stringify({
      aps: {
        alert: { title: msg.title, body: msg.body },
        sound: NATIVE_SOUND,
        'interruption-level': 'time-sensitive',
        'thread-id': msg.orderId,
      },
      orderId: msg.orderId,
      notificationId: msg.notificationId,
      kind: msg.kind,
      url: msg.url,
    });
    try {
      let res = await request(target.token, payload, msg.orderId);
      if (res.status === 403 && res.body.includes('ExpiredProviderToken')) {
        providerToken(true);
        res = await request(target.token, payload, msg.orderId);
      }
      if (res.status === 200) return { ok: true, messageId: res.apnsId };
      const reason = safeReason(res.body);
      const permanent = res.status === 410 || ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(reason);
      return { ok: false, permanent, error: `apns_${res.status}_${reason}` };
    } catch (err) {
      session = null;
      return { ok: false, permanent: false, error: `apns_network_${(err as Error).message}` };
    }
  },
};

function safeReason(body: string): string {
  try {
    return JSON.parse(body).reason ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
