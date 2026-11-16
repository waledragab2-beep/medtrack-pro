import { api } from './api';

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export type PushSupport = 'supported' | 'unsupported' | 'ios-needs-install';

export function pushSupport(): PushSupport {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return ios && !standalone ? 'ios-needs-install' : 'unsupported';
  }
  return 'supported';
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/** Ask permission, subscribe with VAPID and register the subscription for this order's device. */
export async function enableWebPush(deviceToken: string): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
  if (pushSupport() !== 'supported') return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  try {
    const { vapidPublicKey } = await api<{ vapidPublicKey: string | null }>('/public/config', { auth: false });
    if (!vapidPublicKey) return 'unsupported';
    const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidPublicKey) });
    await api('/public/device/push', { device: deviceToken, auth: false, body: { provider: 'webpush', subscription: sub.toJSON() } });
    return 'granted';
  } catch {
    return 'error';
  }
}
