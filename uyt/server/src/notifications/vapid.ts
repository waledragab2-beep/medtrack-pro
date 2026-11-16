import webpush from 'web-push';
import { config } from '../config.js';
import { one } from '../db/pool.js';

/**
 * Web Push needs a VAPID key pair. If none is configured through the environment, generate one on
 * first start and keep it in the database so every instance and every restart uses the same keys
 * (changing keys would invalidate customers' existing push subscriptions).
 */
export async function ensureVapidKeys(): Promise<'env' | 'database'> {
  if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) return 'env';
  const fresh = webpush.generateVAPIDKeys();
  await one(`INSERT INTO app_settings (key, value) VALUES ('vapid', $1) ON CONFLICT (key) DO NOTHING`, [fresh]);
  const row = await one<{ value: { publicKey: string; privateKey: string } }>(`SELECT value FROM app_settings WHERE key = 'vapid'`);
  config.VAPID_PUBLIC_KEY = row!.value.publicKey;
  config.VAPID_PRIVATE_KEY = row!.value.privateKey;
  return 'database';
}
