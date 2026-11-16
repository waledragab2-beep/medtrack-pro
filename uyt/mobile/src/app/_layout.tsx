import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from '../lib/i18n';
import { ackNotification, ensureChannel } from '../lib/push';
import { storage } from '../lib/storage';

async function ack(data: Record<string, unknown> | undefined) {
  const orderId = typeof data?.orderId === 'string' ? data.orderId : null;
  if (!orderId) return;
  const token = await storage.token(orderId);
  if (token) ackNotification(token, data?.notificationId);
}

export default function RootLayout() {
  useEffect(() => {
    void ensureChannel();
    // Delivered while the app is open → confirm delivery.
    const received = Notifications.addNotificationReceivedListener((n) => void ack(n.request.content.data as Record<string, unknown>));
    // Tapped (from background / lock screen) → confirm and open the order.
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as Record<string, unknown>;
      void ack(data);
      if (typeof data?.orderId === 'string') router.push(`/o/${data.orderId}`);
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' }, animation: 'fade' }} />
      </I18nProvider>
    </SafeAreaProvider>
  );
}
