import { api, ApiError } from './api';

/**
 * Offline action queue for the cashier board.
 * When the network drops, actions are stored in localStorage and replayed in order when it returns.
 * Server endpoints are idempotent (ready/pickup/cancel), so a replay after a lost response is safe.
 */
export type QueuedAction =
  | { id: string; kind: 'create'; brandId: string; tempId: string; body: { branchId: string; orderNumber: string; prepMinutes?: number } }
  | { id: string; kind: 'ready' | 'pickup' | 'cancel'; brandId: string; orderId: string };

const KEY = 'uyt.queue';

function read(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function write(q: QueuedAction[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

export const actionQueue = {
  list: read,
  push(a: QueuedAction) {
    write([...read(), a]);
  },
  size: () => read().length,
  /** Replays queued actions. Returns ids of creates that were synced (tempId → real order). */
  async flush(onCreated: (tempId: string, order: unknown) => void): Promise<number> {
    let q = read();
    let done = 0;
    while (q.length) {
      const a = q[0];
      try {
        if (a.kind === 'create') {
          const r = await api<{ order: unknown }>(`/brands/${a.brandId}/orders`, { body: a.body });
          onCreated(a.tempId, r.order);
        } else {
          await api(`/brands/${a.brandId}/orders/${a.orderId}/${a.kind}`, { method: 'POST' });
        }
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 0) break; // still offline – keep the queue
        // 4xx (e.g. duplicate number, already picked up): drop the action, the board resyncs from the server
      }
      q = q.slice(1);
      write(q);
      done++;
    }
    return done;
  },
};

export const isNetworkError = (e: unknown) => e instanceof ApiError && e.status === 0;
