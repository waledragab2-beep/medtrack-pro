import { API_URL } from './config';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; device?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(opts.device ? { 'x-device-token': opts.device } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'network');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? String(res.status));
  return data as T;
}

export interface Theme { primary: string; background: string; surface: string; text: string }
export interface PublicBrand {
  slug: string; name: string; nameEn: string | null; tagline: string | null; taglineEn: string | null;
  logoUrl: string | null; coverUrl: string | null; gallery: string[]; theme: Theme;
  social: Record<string, string | null | undefined>; googleReviewUrl: string | null; currency: string;
  alertSound: boolean; isDemo: boolean; defaultLocale?: 'ar' | 'en';
}
export interface PublicBranch { slug: string; name: string; address: string | null; phone: string | null; lat: number | null; lng: number | null; mapsUrl: string | null; openingHours: string | null; requireClaimCode: boolean }
export interface Content {
  menu: { categories: { id: string; name: string; nameEn: string | null }[]; items: { id: string; categoryId: string | null; name: string; nameEn: string | null; description: string | null; descriptionEn: string | null; price: number | null; imageUrl: string | null }[] };
  offers: { id: string; title: string; titleEn: string | null; description: string | null; descriptionEn: string | null; imageUrl: string | null; badge: string | null }[];
}
export type OrderStatus = 'preparing' | 'ready' | 'picked_up' | 'cancelled';
export interface PublicOrder {
  id: string; orderNumber: string; status: OrderStatus; createdAt: string; estimatedReadyAt: string | null;
  readyAt: string | null; pickedUpAt: string | null; queueAhead: number; rating: { stars: number } | null; pushEnabled: boolean;
}
