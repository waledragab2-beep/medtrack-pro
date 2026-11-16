export type ProviderName = 'fcm' | 'apns' | 'webpush' | 'expo';

export interface PushTarget {
  token: string | null;
  subscription: unknown | null; // Web Push subscription JSON
  platform: 'web' | 'android' | 'ios';
}

export interface PushMessage {
  notificationId: string;
  orderId: string;
  kind: 'ready' | 'reminder';
  title: string;
  body: string;
  /** Deep link opened when the user taps the notification. */
  url: string;
}

export type PushResult =
  | { ok: true; messageId?: string }
  | { ok: false; permanent: boolean; error: string };

export interface PushProvider {
  name: ProviderName;
  isConfigured(): boolean;
  send(target: PushTarget, msg: PushMessage): Promise<PushResult>;
}

/** Shared alert presentation – Android channel + iOS sound must match the mobile app config. */
export const ANDROID_CHANNEL_ID = 'order-ready';
export const NATIVE_SOUND = 'ready.wav';
