import { config } from '../../config.js';
import { ANDROID_CHANNEL_ID, type PushProvider } from '../types.js';

/**
 * Expo push service – fallback used by development builds / Expo Go, where a native FCM/APNs
 * token is not available. Production store builds register native tokens instead.
 */
export const expoProvider: PushProvider = {
  name: 'expo',
  isConfigured: () => true,
  async send(target, msg) {
    if (!target.token) return { ok: false, permanent: true, error: 'missing_token' };
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(config.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${config.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          to: target.token,
          title: msg.title,
          body: msg.body,
          sound: 'default',
          priority: 'high',
          channelId: ANDROID_CHANNEL_ID,
          interruptionLevel: 'time-sensitive',
          data: { orderId: msg.orderId, notificationId: msg.notificationId, kind: msg.kind, url: msg.url },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const json: any = await res.json().catch(() => ({}));
      const ticket = Array.isArray(json.data) ? json.data[0] : json.data;
      if (res.ok && ticket?.status === 'ok') return { ok: true, messageId: ticket.id };
      const error = ticket?.details?.error ?? `expo_${res.status}`;
      return { ok: false, permanent: error === 'DeviceNotRegistered', error };
    } catch (err) {
      return { ok: false, permanent: false, error: `expo_network_${(err as Error).message}` };
    }
  },
};
