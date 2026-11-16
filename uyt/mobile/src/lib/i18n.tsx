import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';

const ar = {
  appTagline: 'طلبك جاهز؟ هنبلغك فورًا',
  scanQr: 'امسح QR المحل',
  scanHint: 'وجّه الكاميرا إلى كود QR على الكاونتر أو الطاولة',
  cameraPermission: 'نحتاج إذن الكاميرا لمسح الكود',
  allowCamera: 'السماح بالكاميرا',
  notUyt: 'هذا الكود ليس كود UYT',
  yourOrders: 'طلباتك',
  noOrders: 'لا توجد طلبات بعد. امسح QR المحل للبدء.',
  trackYourOrder: 'تتبّع طلبك',
  enterOrderNumber: 'أدخل رقم طلبك المكتوب على الإيصال',
  orderCode: 'كود الطلب',
  openOrder: 'فتح الطلب',
  orderNotFound: 'لم نجد طلبًا مفتوحًا بهذا الرقم. تأكد من الرقم أو اسأل الكاشير.',
  invalidCode: 'كود الطلب غير صحيح',
  alreadyLinked: 'هذا الطلب مربوط بهاتف آخر. اطلب من الكاشير المساعدة.',
  linkExpired: 'رابط الطلب غير صالح أو انتهت صلاحيته',
  networkError: 'لا يوجد اتصال بالإنترنت',
  order: 'طلب',
  statusPreparing: 'طلبك قيد التحضير',
  statusPreparingSub: 'سننبّهك فور جاهزيته — يمكنك الجلوس والاسترخاء',
  statusReady: 'طلبك جاهز',
  statusReadySub: 'تفضل استلمه من الكاونتر',
  statusPicked: 'تم استلام طلبك',
  statusCancelled: 'تم إلغاء هذا الطلب',
  estimatedIn: 'متوقع خلال',
  almostReady: 'على وشك الانتهاء…',
  aheadOfYou: 'طلبات قبلك',
  step1: 'قيد التحضير',
  step2: 'جاهز',
  step3: 'تم الاستلام',
  alertsOn: 'التنبيهات مفعّلة — سنخبرك فور الجاهزية',
  alertsOff: 'التنبيهات غير مفعّلة. فعّلها من الإعدادات ليصلك التنبيه والهاتف مقفل.',
  enableAlerts: 'تفعيل التنبيهات',
  readyBig: 'طلبك جاهز',
  readyBigSub: 'تفضل استلمه من الكاونتر',
  gotIt: 'حسنًا، في الطريق!',
  thanks: 'شكرًا لزيارتك!',
  rateExperience: 'كيف كانت تجربتك اليوم؟',
  sendRating: 'إرسال التقييم',
  ratingThanks: 'شكرًا على تقييمك 💛',
  rateOnGoogle: 'قيّمنا على Google',
  offers: 'العروض',
  menu: 'المنيو',
  followUs: 'تابعنا',
  location: 'موقعنا',
  openInMaps: 'افتح في خرائط Google',
  call: 'اتصال',
  notLinked: 'هذا الطلب غير مربوط بهذا الجهاز',
  back: 'رجوع',
  language: 'English',
  demo: 'بيانات تجريبية DEMO',
  silentNote: 'إذا كان هاتفك على الصامت سيصلك الاهتزاز والإشعار فقط.',
};
export type Key = keyof typeof ar;
const en: Record<Key, string> = {
  appTagline: 'Order ready? We will ping you instantly',
  scanQr: 'Scan the store QR',
  scanHint: 'Point the camera at the QR code on the counter or table',
  cameraPermission: 'We need camera access to scan the code',
  allowCamera: 'Allow camera',
  notUyt: 'This is not a UYT code',
  yourOrders: 'Your orders',
  noOrders: 'No orders yet. Scan a store QR to start.',
  trackYourOrder: 'Track your order',
  enterOrderNumber: 'Enter the order number from your receipt',
  orderCode: 'Order code',
  openOrder: 'Open my order',
  orderNotFound: 'We could not find an open order with this number. Check it or ask the cashier.',
  invalidCode: 'The order code is incorrect',
  alreadyLinked: 'This order is linked to another phone. Please ask the cashier.',
  linkExpired: 'This order link is invalid or has expired',
  networkError: 'No internet connection',
  order: 'Order',
  statusPreparing: 'Your order is being prepared',
  statusPreparingSub: 'We will alert you the moment it is ready — relax',
  statusReady: 'Your order is ready',
  statusReadySub: 'Please pick it up at the counter',
  statusPicked: 'Order collected',
  statusCancelled: 'This order was cancelled',
  estimatedIn: 'Expected in',
  almostReady: 'Almost there…',
  aheadOfYou: 'orders ahead',
  step1: 'Preparing',
  step2: 'Ready',
  step3: 'Collected',
  alertsOn: 'Alerts are on — we will tell you when it is ready',
  alertsOff: 'Alerts are off. Enable them in Settings to get alerted while locked.',
  enableAlerts: 'Enable alerts',
  readyBig: 'Your order is ready',
  readyBigSub: 'Please pick it up at the counter',
  gotIt: 'OK, on my way!',
  thanks: 'Thanks for visiting!',
  rateExperience: 'How was your experience today?',
  sendRating: 'Send rating',
  ratingThanks: 'Thank you for your rating 💛',
  rateOnGoogle: 'Rate us on Google',
  offers: 'Offers',
  menu: 'Menu',
  followUs: 'Follow us',
  location: 'Find us',
  openInMaps: 'Open in Google Maps',
  call: 'Call',
  notLinked: 'This order is not linked to this device',
  back: 'Back',
  language: 'العربية',
  demo: 'DEMO data',
  silentNote: 'If your phone is on silent you will get vibration and the notification only.',
};

interface I18n {
  lang: Lang;
  rtl: boolean;
  t: (k: Key) => string;
  toggle: () => void;
  pick: (a?: string | null, e?: string | null) => string;
}
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const device = getLocales()[0]?.languageCode === 'en' ? 'en' : 'ar';
  const [lang, setLang] = useState<Lang>(device);
  useEffect(() => {
    SecureStore.getItemAsync('uyt_lang').then((v) => (v === 'ar' || v === 'en') && setLang(v)).catch(() => {});
  }, []);
  const value = useMemo<I18n>(
    () => ({
      lang,
      rtl: lang === 'ar',
      t: (k) => (lang === 'ar' ? ar : en)[k],
      toggle: () => {
        const next = lang === 'ar' ? 'en' : 'ar';
        setLang(next);
        void SecureStore.setItemAsync('uyt_lang', next);
      },
      pick: (a, e) => (lang === 'en' ? e || a || '' : a || e || ''),
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('I18nProvider missing');
  return v;
}
