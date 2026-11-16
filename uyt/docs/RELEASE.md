# إصدار تطبيق الموبايل — Android (APK/AAB) و iOS (App Store)

التطبيق في `mobile/` مبني بـ Expo (Continuous Native Generation)، فلا توجد مجلدات `android/` و`ios/` في المستودع؛ تُولّد أثناء البناء من `app.json` و`app.config.ts`.

## المتطلبات (مرة واحدة)
1. حساب Expo: `npx eas-cli@latest login` ثم داخل `mobile/`: `npx eas-cli@latest init` ← انسخ الـ `projectId` الناتج إلى `app.json` ← `extra.eas.projectId`.
2. **Android / FCM:** أنشئ تطبيق Android في Firebase بالحزمة `app.uyt.customer` ← نزّل `google-services.json` وضعه في `mobile/` (مُستبعد من git). ضع Service Account JSON للخادم في `FIREBASE_SERVICE_ACCOUNT`.
3. **iOS / APNs:** في Apple Developer: أنشئ App ID ‏`app.uyt.customer` وفعّل **Push Notifications** و **Time Sensitive Notifications** و **Associated Domains**. أنشئ مفتاح APNs ‎(.p8)‎ للخادم.
4. غيّر النطاق `uyt.app` في `app.json` (associatedDomains و intentFilters) وفي `eas.json` (عناوين API) إلى نطاقك.

## Android
```bash
cd mobile
npm run build:apk        # APK للتجربة الداخلية (profile: preview)
npm run build:android    # AAB للرفع على Google Play (profile: production)
```
- EAS ينشئ مفتاح التوقيع ويحفظه (أو ارفع keystore خاصتك).
- بعد أول رفع على Play: انسخ بصمة **App signing key SHA-256** إلى `web/public/.well-known/assetlinks.json` لتعمل روابط QR مباشرة داخل التطبيق.
- الرفع: `npx eas-cli@latest submit -p android --profile production` (يحتاج Service Account لـ Google Play في `mobile/secrets/`).

## iOS
```bash
cd mobile
npm run build:ios        # IPA موقّع (EAS يدير الشهادات وملفات Provisioning)
npm run submit:ios       # رفع إلى App Store Connect / TestFlight
```
- ضع `ascAppId` في `eas.json` ← `submit.production.ios`.
- حدّث `web/public/.well-known/apple-app-site-association` بالـ Team ID.
- نص مقترح لمراجعة Apple: «التطبيق يرسل إشعارًا حساسًا للوقت (Time Sensitive) عندما يصبح طلب المستخدم جاهزًا للاستلام في المطعم. يتم الربط بمسح QR من المحل ولا يتطلب حسابًا.»

## قائمة الفحص قبل النشر
- [ ] `npx tsc --noEmit` و `npx expo export --platform android --platform ios` بدون أخطاء.
- [ ] تجربة على جهاز حقيقي: مسح QR ← قفل الشاشة ← الضغط على «جاهز» من اللوحة ← وصول الإشعار بالصوت والاهتزاز على شاشة القفل.
- [ ] تجربة الهاتف على الصامت: يصل الإشعار والاهتزاز بدون صوت (سلوك مقصود).
- [ ] نسبة «وصول التنبيه» في لوحة الإحصائيات ترتفع بعد التجربة (تأكيد الاستلام من الجهاز).
- [ ] صفحة سياسة الخصوصية (مطلوبة في المتجرين): التطبيق لا يجمع اسمًا ولا رقم هاتف؛ يخزّن توكن الإشعار ومعرّف الطلب فقط.
