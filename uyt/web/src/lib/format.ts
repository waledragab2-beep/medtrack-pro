import type { Lang } from './i18n';

/** Arabic UI with Latin digits – consistent with order numbers printed on receipts. */
export const locale = (lang: Lang) => (lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US');

/** 125 → "2:05" */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 355 → "5 د 55 ث" / "5m 55s" */
export function humanDuration(seconds: number | null | undefined, lang: Lang): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (lang === 'ar') return m ? `${m} د ${r ? `${r} ث` : ''}`.trim() : `${r} ث`;
  return m ? `${m}m ${r ? `${r}s` : ''}`.trim() : `${r}s`;
}

export const num = (n: number | null | undefined, lang: Lang, digits = 0) =>
  n == null ? '—' : new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(n);

export const pct = (n: number | null | undefined, lang: Lang) =>
  n == null ? '—' : new Intl.NumberFormat(locale(lang), { style: 'percent', maximumFractionDigits: 1 }).format(n);

export const money = (n: number | null | undefined, currency: string, lang: Lang) =>
  n == null ? '' : new Intl.NumberFormat(locale(lang), { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

export const dateTime = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';

export const shortDate = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso + 'T12:00:00'));

/** Local YYYY-MM-DD */
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
