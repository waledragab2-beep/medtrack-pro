/* UYT service worker – Web Push for customers who use the browser page. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function deviceTokenFor(orderId) {
  // The page stores the device token in IndexedDB-less fashion via a cache entry so the SW can ack deliveries.
  const cache = await caches.open('uyt-devices');
  const res = await cache.match(`/__device/${orderId}`);
  return res ? res.text() : null;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'UYT', body: event.data && event.data.text() };
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || 'UYT', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.orderId || 'uyt',
        renotify: true,
        requireInteraction: true,
        vibrate: [600, 250, 600, 250, 900],
        data,
      });
      // Tell open pages to ring, and confirm delivery to the server.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: 'uyt:push', data }));
      if (data.notificationId && data.orderId) {
        const token = await deviceTokenFor(data.orderId);
        if (token) {
          await fetch(`/api/public/notifications/${data.notificationId}/ack`, {
            method: 'POST',
            headers: { 'x-device-token': token },
          }).catch(() => {});
        }
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const path = new URL(url, self.location.origin).pathname;
      const existing = all.find((c) => new URL(c.url).pathname === path);
      if (existing) return existing.focus();
      return self.clients.openWindow(path);
    })(),
  );
});
