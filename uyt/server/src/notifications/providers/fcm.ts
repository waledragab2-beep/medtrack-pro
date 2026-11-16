import { readFileSync, existsSync } from 'node:fs';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { config } from '../../config.js';
import { ANDROID_CHANNEL_ID, NATIVE_SOUND, type PushProvider } from '../types.js';

let app: App | null = null;

function loadServiceAccount(): Record<string, string> | null {
  const raw = config.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  if (raw.startsWith('{')) return JSON.parse(raw);
  if (existsSync(raw)) return JSON.parse(readFileSync(raw, 'utf8'));
  return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
}

function messaging() {
  if (!app) {
    const sa = loadServiceAccount();
    if (!sa) throw new Error('FCM not configured');
    app = initializeApp({ credential: cert(sa as any) }, 'uyt-fcm');
  }
  return getMessaging(app);
}

const PERMANENT = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/mismatched-credential',
]);

/** Firebase Cloud Messaging – Android devices (and iOS devices that registered an FCM token). */
export const fcmProvider: PushProvider = {
  name: 'fcm',
  isConfigured: () => Boolean(config.FIREBASE_SERVICE_ACCOUNT),
  async send(target, msg) {
    if (!target.token) return { ok: false, permanent: true, error: 'missing_token' };
    try {
      const id = await messaging().send({
        token: target.token,
        notification: { title: msg.title, body: msg.body },
        data: { orderId: msg.orderId, notificationId: msg.notificationId, kind: msg.kind, url: msg.url },
        android: {
          priority: 'high',
          ttl: 15 * 60 * 1000,
          collapseKey: msg.orderId,
          notification: {
            channelId: ANDROID_CHANNEL_ID,
            sound: NATIVE_SOUND.replace(/\.\w+$/, ''),
            defaultVibrateTimings: false,
            vibrateTimingsMillis: [0, 600, 250, 600, 250, 900],
            visibility: 'public',
            priority: 'max',
            tag: msg.orderId,
          },
        },
        apns: {
          headers: { 'apns-priority': '10', 'apns-push-type': 'alert', 'apns-collapse-id': msg.orderId },
          payload: { aps: { sound: NATIVE_SOUND, 'interruption-level': 'time-sensitive' } as any },
        },
      });
      return { ok: true, messageId: id };
    } catch (err: any) {
      const code = err?.errorInfo?.code ?? err?.code ?? 'unknown';
      return { ok: false, permanent: PERMANENT.has(code), error: String(code) };
    }
  },
};
