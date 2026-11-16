import * as SecureStore from 'expo-secure-store';

/** Device tokens are bearer secrets → Keychain / Keystore via SecureStore. */
export interface LinkedOrder {
  orderId: string;
  orderNumber?: string;
  brandName?: string;
  branchSlug?: string;
  linkedAt: string;
}

const INDEX = 'uyt_orders';
const tokenKey = (orderId: string) => `uyt_dev_${orderId}`;

async function readIndex(): Promise<LinkedOrder[]> {
  try {
    return JSON.parse((await SecureStore.getItemAsync(INDEX)) ?? '[]');
  } catch {
    return [];
  }
}

export const storage = {
  async save(token: string, o: LinkedOrder) {
    await SecureStore.setItemAsync(tokenKey(o.orderId), token);
    const list = (await readIndex()).filter((x) => x.orderId !== o.orderId);
    const next = [o, ...list].slice(0, 8);
    await SecureStore.setItemAsync(INDEX, JSON.stringify(next));
    // forget tokens that fell off the list
    for (const old of list.slice(7)) await SecureStore.deleteItemAsync(tokenKey(old.orderId)).catch(() => {});
  },
  async update(orderId: string, patch: Partial<LinkedOrder>) {
    const list = await readIndex();
    await SecureStore.setItemAsync(INDEX, JSON.stringify(list.map((x) => (x.orderId === orderId ? { ...x, ...patch } : x))));
  },
  token: (orderId: string) => SecureStore.getItemAsync(tokenKey(orderId)),
  async remove(orderId: string) {
    await SecureStore.deleteItemAsync(tokenKey(orderId)).catch(() => {});
    await SecureStore.setItemAsync(INDEX, JSON.stringify((await readIndex()).filter((x) => x.orderId !== orderId)));
  },
  list: readIndex,
};
