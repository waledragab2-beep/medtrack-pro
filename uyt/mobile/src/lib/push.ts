import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { EAS_PROJECT_ID } from './config';

export const CHANNEL_ID = 'order-ready';

/**
 * Foreground presentation: show the banner and play the sound even if the app is open.
 * We never request critical alerts – the OS silent / Do-Not-Disturb settings are respected.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Android channel: max importance (heads-up), custom sound, strong vibration, visible on lock screen. */
export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Order ready',
    description: 'Alerts when your order is ready for pickup',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'ready.wav',
    vibrationPattern: [0, 600, 250, 600, 250, 900],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: true,
  });
}

export async function requestPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const res = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return res.granted;
}

/**
 * Registers the best push channel for this device with the order's device token:
 *   Android → native FCM token, iOS → native APNs token (store builds),
 *   Expo push token as a fallback (Expo Go / missing native credentials).
 */
export async function registerPush(deviceToken: string): Promise<boolean> {
  if (!Device.isDevice) return false;
  if (!(await requestPermission())) return false;
  try {
    const native = await Notifications.getDevicePushTokenAsync();
    const provider = native.type === 'android' ? 'fcm' : native.type === 'ios' ? 'apns' : null;
    if (provider && typeof native.data === 'string') {
      await api('/public/device/push', { device: deviceToken, body: { provider, token: native.data } });
      return true;
    }
  } catch {
    /* fall through to Expo push */
  }
  try {
    const expo = await Notifications.getExpoPushTokenAsync(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined);
    await api('/public/device/push', { device: deviceToken, body: { provider: 'expo', token: expo.data } });
    return true;
  } catch {
    return false;
  }
}

/** Delivery receipt so the merchant's "alert delivery" metric is accurate. */
export function ackNotification(deviceToken: string, notificationId?: unknown) {
  if (typeof notificationId === 'string') void api(`/public/notifications/${notificationId}/ack`, { device: deviceToken, method: 'POST' }).catch(() => {});
}
