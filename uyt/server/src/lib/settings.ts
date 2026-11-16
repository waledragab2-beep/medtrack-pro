import { z } from 'zod';

export const DEFAULT_READY_BODY_AR = '🔔 طلبك جاهز! تعال استلمه من الكاونتر';
export const DEFAULT_READY_BODY_EN = '🔔 Your order is ready! Come pick it up at the counter';

export const notificationSettingsSchema = z.object({
  readyBodyAr: z.string().trim().min(1).max(160).default(DEFAULT_READY_BODY_AR),
  readyBodyEn: z.string().trim().min(1).max(160).default(DEFAULT_READY_BODY_EN),
  /** Automatically remind the customer if the order is not collected. */
  autoReminder: z.boolean().default(true),
  autoReminderAfterMinutes: z.number().int().min(1).max(60).default(3),
  maxReminders: z.number().int().min(0).max(5).default(3),
  /** Play the alarm tone on the customer's order page. */
  alertSound: z.boolean().default(true),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const readNotificationSettings = (raw: unknown): NotificationSettings =>
  notificationSettingsSchema.parse(raw ?? {});

export const themeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#E10600'),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0A0A0A'),
  surface: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#161616'),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FFFFFF'),
});
export const readTheme = (raw: unknown) => themeSchema.parse(raw ?? {});
