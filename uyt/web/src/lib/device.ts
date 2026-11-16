/** Customer-side storage of device tokens (one per linked order) – never sent to other orders. */
const KEY = 'uyt.devices';

export interface StoredOrder {
  orderId: string;
  token: string;
  orderNumber?: string;
  brandName?: string;
  branchSlug?: string;
  linkedAt: string;
}

function read(): Record<string, StoredOrder> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write(all: Record<string, StoredOrder>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export const deviceStore = {
  get: (orderId: string) => read()[orderId] ?? null,
  save(o: StoredOrder) {
    const all = read();
    all[o.orderId] = { ...all[o.orderId], ...o };
    // Keep the 10 most recent.
    const sorted = Object.values(all).sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)).slice(0, 10);
    write(Object.fromEntries(sorted.map((x) => [x.orderId, x])));
    // Let the service worker ack pushes for this order.
    if ('caches' in window) {
      caches.open('uyt-devices').then((c) => c.put(`/__device/${o.orderId}`, new Response(o.token))).catch(() => {});
    }
  },
  remove(orderId: string) {
    const all = read();
    delete all[orderId];
    write(all);
  },
  recent: () => Object.values(read()).sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)),
};
