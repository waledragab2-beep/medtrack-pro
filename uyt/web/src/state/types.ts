export type Role = 'owner' | 'manager' | 'cashier';
export type OrderStatus = 'preparing' | 'ready' | 'picked_up' | 'cancelled';

export interface Membership {
  brandId: string;
  role: Role;
  branchId: string | null;
  name: string;
  nameEn: string | null;
  slug: string;
  logoUrl: string | null;
  isDemo: boolean;
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

export interface Theme { primary: string; background: string; surface: string; text: string }

export interface NotificationSettings {
  readyBodyAr: string;
  readyBodyEn: string;
  autoReminder: boolean;
  autoReminderAfterMinutes: number;
  maxReminders: number;
  alertSound: boolean;
}

export interface Social { instagram?: string | null; facebook?: string | null; tiktok?: string | null; x?: string | null; snapchat?: string | null; website?: string | null; whatsapp?: string | null }

export interface Brand {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  tagline: string | null;
  taglineEn: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  gallery: string[];
  theme: Theme;
  social: Social;
  googleReviewUrl: string | null;
  notificationSettings: NotificationSettings;
  defaultLocale: 'ar' | 'en';
  timezone: string;
  currency: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isDemo: boolean;
}

export interface Branch {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  openingHours: string | null;
  avgPrepMinutes: number;
  latePickupMinutes: number;
  requireClaimCode: boolean;
  maxDevicesPerOrder: number;
  isActive: boolean;
  qrUrl: string;
}

export interface StaffOrder {
  id: string;
  branchId: string;
  orderNumber: string;
  status: OrderStatus;
  note: string | null;
  claimCode: string;
  claimUrl: string;
  estimatedReadyAt: string | null;
  reminderCount: number;
  lastNotifiedAt: string | null;
  createdAt: string;
  readyAt: string | null;
  pickedUpAt: string | null;
  cancelledAt: string | null;
  devicesCount: number;
  pushDevicesCount: number;
  deliveredCount: number;
  rating?: number | null;
  /** client-only: created while offline, not yet synced */
  pending?: boolean;
}

export interface MenuCategory { id: string; name: string; nameEn: string | null; sort: number }
export interface MenuItem { id: string; categoryId: string | null; name: string; nameEn: string | null; description: string | null; descriptionEn: string | null; price: number | null; imageUrl: string | null; isAvailable: boolean; sort: number }
export interface Offer { id: string; title: string; titleEn: string | null; description: string | null; descriptionEn: string | null; imageUrl: string | null; badge: string | null; startsAt: string | null; endsAt: string | null; isActive: boolean; sort: number }

export interface PublicBrand {
  slug: string; name: string; nameEn: string | null; tagline: string | null; taglineEn: string | null;
  logoUrl: string | null; coverUrl: string | null; gallery: string[]; theme: Theme; social: Social;
  googleReviewUrl: string | null; currency: string; alertSound: boolean; isDemo: boolean;
}
export interface PublicBranch { slug: string; name: string; address: string | null; phone: string | null; lat: number | null; lng: number | null; mapsUrl: string | null; openingHours: string | null; requireClaimCode: boolean }
export interface BrandContent { menu: { categories: MenuCategory[]; items: MenuItem[] }; offers: Offer[] }
