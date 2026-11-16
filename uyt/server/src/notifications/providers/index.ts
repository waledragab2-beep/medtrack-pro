import { config } from '../../config.js';
import type { ProviderName, PushProvider } from '../types.js';
import { apnsProvider } from './apns.js';
import { expoProvider } from './expo.js';
import { fcmProvider } from './fcm.js';
import { webPushProvider } from './webpush.js';

const mock = (name: ProviderName): PushProvider => ({
  name,
  isConfigured: () => true,
  async send(target, msg) {
    console.info(`[push:mock] ${name} → ${target.platform} "${msg.title}: ${msg.body}"`);
    return { ok: true, messageId: `mock-${msg.notificationId}` };
  },
});

let registry: Record<ProviderName, PushProvider> = config.PUSH_MOCK
  ? { fcm: mock('fcm'), apns: mock('apns'), webpush: mock('webpush'), expo: mock('expo') }
  : { fcm: fcmProvider, apns: apnsProvider, webpush: webPushProvider, expo: expoProvider };

export const getProvider = (name: ProviderName): PushProvider => registry[name];

/** Test hook. */
export function setProviders(overrides: Partial<Record<ProviderName, PushProvider>>): void {
  registry = { ...registry, ...overrides };
}
