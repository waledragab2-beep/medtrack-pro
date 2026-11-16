/** Thin fetch wrapper: JSON, bearer auth with one automatic refresh, typed errors. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const TOKENS_KEY = 'uyt.tokens';
type Tokens = { accessToken: string; refreshToken: string };

export const tokenStore = {
  get(): Tokens | null {
    try {
      return JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null');
    } catch {
      return null;
    }
  },
  set(t: Tokens | null) {
    try {
      if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
      else localStorage.removeItem(TOKENS_KEY);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event('uyt:tokens'));
  },
};

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const t = tokenStore.get();
  if (!t) return false;
  refreshing ??= fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: t.refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) {
        tokenStore.set(null);
        return false;
      }
      tokenStore.set(await r.json());
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  device?: string;
  auth?: boolean;
  form?: FormData;
}

export async function api<T = any>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth !== false) {
    const t = tokenStore.get();
    if (t) headers.authorization = `Bearer ${t.accessToken}`;
  }
  if (opts.device) headers['x-device-token'] = opts.device;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'network', 'network');
  }
  if (res.status === 401 && opts.auth !== false && !opts.device && !retried && tokenStore.get()) {
    if (await refresh()) return api<T>(path, opts, true);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? res.statusText, data?.error?.details);
  }
  return data as T;
}
