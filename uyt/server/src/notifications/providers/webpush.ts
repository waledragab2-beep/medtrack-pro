import webpush from 'web-push';
import { config } from '../../config.js';
import type { PushProvider } from '../types.js';

let ready = false;
function init() {
  if (!ready) {
    webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY!, config.VAPID_PRIVATE_KEY!);
    ready = true;
  }
}

/** Standard Web Push (VAPID) for customers who use the browser page instead of the app. */
export const webPushProvider: PushProvider = {
  name: 'webpush',
  isConfigured: () => Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY),
  async send(target, msg) {
    if (!target.subscription) return { ok: false, permanent: true, error: 'missing_subscription' };
    init();
    try {
      const res = await webpush.sendNotification(
        target.subscription as webpush.PushSubscription,
        JSON.stringify({
          title: msg.title,
          body: msg.body,
          url: msg.url,
          orderId: msg.orderId,
          notificationId: msg.notificationId,
          kind: msg.kind,
        }),
        { TTL: 15 * 60, urgency: 'high' },
      );
      return { ok: true, messageId: res.headers?.location };
    } catch (err: any) {
      const status = err?.statusCode ?? 0;
      return { ok: false, permanent: status === 404 || status === 410 || status === 400, error: `webpush_${status}` };
    }
  },
};
