/**
 * Turns a scanned QR / opened link into an in-app route.
 *   https://uyt.app/s/<slug>          → /s/<slug>
 *   https://uyt.app/o/<id>?k=<secret> → /o/<id>?k=<secret>
 * Only UYT paths are accepted; anything else is rejected (no arbitrary URL opening).
 */
export function routeFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!['https:', 'http:', 'uyt:'].includes(url.protocol)) return null;
  const path = url.protocol === 'uyt:' ? `/${url.host}${url.pathname}` : url.pathname;
  const store = path.match(/^\/s\/([A-Za-z0-9-]{1,80})\/?$/);
  if (store) return `/s/${store[1]}`;
  const order = path.match(/^\/o\/([0-9a-f-]{36})\/?$/i);
  if (order) {
    const k = url.searchParams.get('k');
    return k && /^[A-Za-z0-9_-]{10,64}$/.test(k) ? `/o/${order[1]}?k=${k}` : `/o/${order[1]}`;
  }
  return null;
}
