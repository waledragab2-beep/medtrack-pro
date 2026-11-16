# UYT — نظام استلام الطلبات الذكي (بديل البيجر)

UYT يربط كاشير المطعم/الكافيه بهاتف العميل: الكاشير يكتب رقم الطلب، العميل يمسح QR، وعند الضغط على «جاهز» يصل للعميل تنبيه فوري بصوت واهتزاز — بدون أجهزة بيجر.

| المكوّن | المسار | التقنية |
|---|---|---|
| Backend + API + Realtime + الإشعارات | `server/` | Node.js 22 · Fastify 5 · PostgreSQL 16 · Socket.IO · FCM / APNs / Web Push |
| لوحة الكاشير + لوحة صاحب البراند + صفحة العميل (QR) | `web/` | React 19 · Vite · TypeScript · RTL/عربي + English |
| تطبيق العميل Android / iOS | `mobile/` | Expo SDK 58 · React Native · Expo Router · expo-notifications |
| سيناريو E2E كامل في متصفح حقيقي | `e2e/flow.cjs` | Playwright |
| لقطات الشاشات (UI/UX) | `docs/screens/` | — |

---

## 1. التحليل وخطة التنفيذ (الحالة الحالية)

| # | المرحلة | الحالة |
|---|---|---|
| 1 | تحليل المشروع والافتراضات | ✅ هذا الملف |
| 2 | تصميم الشاشات UI/UX (أسود/أبيض/أحمر، RTL، أنيميشن) | ✅ مُنفّذ كواجهات حقيقية — انظر `docs/screens/` |
| 3 | قاعدة البيانات | ✅ `server/migrations/001_init.sql` |
| 4 | Backend و API | ✅ `server/src` — انظر `docs/API.md` |
| 5 | تطبيق العميل | ✅ ويب (`/s/:slug`, `/o/:id`) + تطبيق Expo |
| 6 | لوحة الكاشير | ✅ `/app/orders` |
| 7 | لوحة صاحب البراند | ✅ الهوية، المنيو، العروض، الفروع و QR، الموظفون |
| 8 | ربط QR بالطلبات | ✅ QR ثابت للمحل + QR خاص بكل طلب |
| 9 | نظام الإشعارات | ✅ Outbox + إعادة محاولة + منع تكرار + تأكيد وصول |
| 10 | التحليلات | ✅ `/app/analytics` |
| 11 | الاختبارات | ✅ 15 اختبار تكامل للـ API + E2E متصفح + فحص bundles للموبايل |
| 12–13 | نسخ Android AAB/APK و iOS | ⚙️ جاهزة للبناء عبر EAS — تحتاج حساباتك (انظر `docs/RELEASE.md`) |

### ما تم التحقق منه فعليًا
- `server`: ‏`npm test` ← **15/15 ناجح** على PostgreSQL حقيقي: دورة الطلب، عدم تكرار الإشعار، عزل العملاء عن بعض، عزل البراندات (multi-tenant)، الصلاحيات، إعادة المحاولة، حذف التوكنات الميتة، التذكير التلقائي، الإحصائيات، الـ Realtime.
- `e2e/flow.cjs` على **نسخة الإنتاج** (‏`node dist` + ‏`vite build`): تسجيل تاجر ← إضافة طلب ← العميل يمسح ويدخل الرقم (حتى بالأرقام العربية) ← «جاهز» ← شاشة «طلبك جاهز» تظهر فورًا ← «تم التسليم» ← تقييم ← منع جهاز آخر من فتح الطلب ← **إضافة طلب والكاشير بدون إنترنت ثم مزامنته تلقائيًا**.
- `mobile`: ‏`tsc` نظيف، و`expo export` يبني bundles لـ Android و iOS، و`expo prebuild` يولّد المشاريع الأصلية بنجاح (صوت التنبيه، قناة Android، صلاحية Time-Sensitive لـ iOS، روابط App Links).

### ما لم يمكن التحقق منه داخل هذه البيئة (ويحتاج حساباتك)
- إرسال Push حقيقي عبر FCM/APNs/Web Push: الكود جاهز ومختبر بمزوّد وهمي، لكن الشبكة هنا تمنع الوصول لخوادم Google/Apple، ولا توجد مفاتيح.
- بناء ملفات APK/AAB/IPA الفعلية: تحتاج حساب Expo (EAS) و Apple Developer و Google Play.
- صور Docker: ملفات `Dockerfile` و`docker-compose.yml` جاهزة، لكن سحب الصور كان محجوبًا هنا (Docker Hub 429)، لذلك تحققت من نفس مخرجات الإنتاج بتشغيلها مباشرة.

---

## 2. الافتراضات (قرارات اتخذتها بدل التوقف)

1. **العميل لا يحتاج تثبيت تطبيق.** مسح QR يفتح صفحة ويب سريعة (PWA) فيها كل شيء، والتطبيق اختياري لتنبيهات أقوى. هذا أهم عامل لنجاح بديل البيجر: لن يثبّت كل عميل تطبيقًا ليشرب قهوة.
2. **طريقتان للربط الآمن:**
   - **QR خاص بالطلب** (الأقوى): بعد إضافة الطلب تظهر للكاشير شاشة QR فيها سر عشوائي؛ العميل يمسحها فيرتبط تلقائيًا بدون كتابة.
   - **QR ثابت للمحل** + رقم الطلب. لمنع شخص من ربط طلب غيره: كل طلب يقبل عددًا محدودًا من الهواتف (افتراضي 2)، ويمكن تفعيل **كود من 4 أرقام** لكل فرع، والكاشير يرى «الهاتف مربوط» ويستطيع فك الربط.
3. **iOS:** ‏Expo يعطي توكن APNs أصلي، لذلك الخادم يرسل لأجهزة iPhone **مباشرة عبر APNs** (مفتاح ‎.p8‎)، ولأجهزة Android عبر **FCM**، وللمتصفح عبر **Web Push (VAPID)**، مع Expo Push كاحتياطي لنسخ التطوير. الإشعار يستخدم مستوى `time-sensitive` (يتطلب الصلاحية في حساب Apple).
4. **احترام إعدادات الهاتف:** لا نطلب Critical Alerts ولا نتجاوز الصامت/عدم الإزعاج. التطبيق يشغّل الصوت فقط إذا لم يكن الهاتف صامتًا، والاهتزاز يعمل دائمًا. على المتصفح: الصوت يعمل والصفحة مفتوحة، والإشعار يعمل في الخلفية حيث يدعمه المتصفح (على iPhone يلزم «إضافة للشاشة الرئيسية»، iOS 16.4+). هذه القيود مذكورة للعميل داخل الصفحة.
5. **السوق الافتراضي مصر:** المنطقة الزمنية `Africa/Cairo` والعملة `EGP` — قابلة للتغيير لكل براند من الإعدادات.
6. **الموظفون:** لا توجد خدمة بريد بعد، فالمالك يضع كلمة مرور أولية للموظف ويشاركها معه. الأدوار: مالك (كل شيء)، مدير (الطلبات والإحصائيات والإعدادات والكاشير)، كاشير (الطلبات فقط، ويمكن ربطه بفرع واحد).
7. **الاشتراكات:** كل براند يبدأ بتجربة 14 يومًا (الحقول موجودة في قاعدة البيانات). **ربط بوابة الدفع (Paymob/Stripe…) غير منفّذ بعد**. الأسعار في الصفحة الرئيسية مبدئية ومكتوب ذلك عليها.
8. **تقييم Google:** زر «قيّمنا على Google» يظهر **لكل** عميل بعد الاستلام، لأن سياسة Google تمنع عرضه للراضين فقط (review gating).
9. **الأرقام:** الواجهة العربية تستخدم أرقامًا لاتينية (125) لتطابق الإيصال، ويقبل النظام الأرقام العربية (١٢٥) عند الإدخال.
10. **الصور** تُحفظ على القرص (مجلد لكل براند) ويمكن استبدالها بـ S3/R2 لاحقًا دون تغيير الواجهات.
11. **بيانات تجريبية:** براند واحد فقط اسمه «كافيه UYT التجريبي — DEMO» عبر `npm run seed:demo`، وكل صفوفه معلّمة `is_demo` وتظهر عليه شارة DEMO. لا توجد أي بيانات وهمية في الوظائف الأساسية.

---

## 3. البنية

```
 Customer phone                       Cashier tablet / PC                 Brand owner
 ─────────────                        ───────────────────                 ───────────
 Web page /s/:slug, /o/:id            /app/orders (React)                 /app/analytics, /app/brand …
 or Expo app (FCM/APNs)                     │                                   │
        │  HTTPS + WebSocket                │ HTTPS + WebSocket (JWT)           │
        └───────────────┬───────────────────┴───────────────────────────────────┘
                        ▼
              Fastify API  ──  Socket.IO rooms: branch:<id> (staff), order:<id> (linked phones only)
                        │
                        ├── PostgreSQL (brands, branches, orders, order_devices, notifications outbox, ratings …)
                        └── Outbox worker (SKIP LOCKED) ──► FCM (Android) · APNs (iOS) · Web Push · Expo
```

**مسار «جاهز»:** ‏`UPDATE orders … WHERE status='preparing'` (مرة واحدة فقط) + إدراج صفوف الإشعار في نفس الـ transaction بمفتاح فريد `ready:<deviceId>` ← لا يمكن إرسال التنبيه مرتين ← الـ worker يرسل فورًا ويعيد المحاولة (3s، 10s، 30s، 90s، 5min) ← التوكن الميت يُحذف ← التطبيق/الـ Service Worker يرسل «تم الاستلام» لحساب نسبة الوصول. بالتوازي يُبث الحدث عبر Socket.IO للصفحة المفتوحة.

**الأمان:**
- كل جدول يحمل `brand_id`، وكل استعلام مقيّد به، والوصول لبراند آخر يرجع 404 (مُختبر).
- توكن الجهاز عشوائي 256-bit ويُخزن **مُجزّأ (SHA-256)** فقط؛ الجهاز لا يرى إلا طلبه، والـ Realtime يضمّه لغرفة طلبه فقط.
- كلمات المرور bcrypt، و JWT قصير العمر + Refresh Token دوّار.
- Rate limiting على الدخول والربط، والتحقق من نوع الصور من محتواها (SVG ممنوع)، ورفض الروابط غير http(s).
- بيانات العميل الشخصية: لا نطلب اسمًا ولا رقم هاتف أصلًا.

---

## 4. التشغيل محليًا

المتطلبات: Node.js 22، و PostgreSQL 16.

```bash
# قاعدة البيانات
createuser -P uyt            # كلمة المرور: uyt
createdb -O uyt uyt
createdb -O uyt uyt_test     # للاختبارات

# الخادم
cd server
cp .env.example .env         # ضع JWT_SECRET طويلًا؛ لتجربة الإشعارات على المتصفح: npx web-push generate-vapid-keys
npm install
npm run migrate
npm run seed:demo -- --history   # اختياري: براند DEMO + 30 يوم بيانات تجريبية للإحصائيات
npm run dev                      # http://localhost:4000

# الويب (نافذة أخرى)
cd web && npm install && npm run dev   # http://localhost:5173
```

- لوحة التحكم: `http://localhost:5173/login` ← ‏`demo@uyt.app` / `Demo1234` (مالك) أو `cashier@uyt.app` / `Demo1234` (كاشير).
- صفحة العميل: `http://localhost:5173/s/demo`
- أو أنشئ براندك من `/register`.

### الاختبارات
```bash
cd server && npm test                         # اختبارات تكامل على قاعدة uyt_test
cd .. && WEB=http://localhost:5173 node e2e/flow.cjs   # سيناريو كامل في متصفح (الخادمان يعملان)
cd mobile && npx tsc --noEmit && npx expo export --platform android --platform ios
```

### تطبيق الموبايل أثناء التطوير
```bash
cd mobile && npm install
EXPO_PUBLIC_API_URL=http://<IP-جهازك>:4000 EXPO_PUBLIC_WEB_URL=http://<IP-جهازك>:5173 npx expo start
```
الإشعارات الأصلية تحتاج Development Build (‏`npx eas-cli build --profile development`)، لأن Expo Go لا يدعم FCM/APNs الأصلية؛ في Expo Go يستخدم التطبيق Expo Push تلقائيًا.

---

## 5. النشر (Production)

```bash
cp .env.example .env      # الأسرار
mkdir secrets             # firebase-service-account.json و AuthKey.p8
docker compose up -d --build
```
ضع أمامه HTTPS (Caddy/Cloudflare/Load balancer) — الكاميرا و Web Push يتطلبان HTTPS. الـ migrations تعمل تلقائيًا عند تشغيل الخادم.

**للتوسع:** الـ API بلا حالة، والـ outbox آمن مع أكثر من نسخة (`FOR UPDATE SKIP LOCKED`). عند تشغيل أكثر من نسخة: أضف `@socket.io/redis-adapter` في `server/src/realtime/io.ts`، وانقل الصور إلى S3/R2.

### إعداد الإشعارات
| القناة | المطلوب | المتغيرات |
|---|---|---|
| Android (FCM) | مشروع Firebase ← Service Account JSON، و `google-services.json` في `mobile/` | `FIREBASE_SERVICE_ACCOUNT` |
| iPhone (APNs) | Apple Developer ← Keys ← مفتاح APNs ‎(.p8)، وتفعيل Push و Time Sensitive للـ Bundle ID | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION` |
| المتصفح (Web Push) | ‏`npx web-push generate-vapid-keys` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |

عند التشغيل يطبع الخادم حالة كل قناة (`configured` / `NOT configured`).

### الروابط العامة (Universal / App Links)
عدّل `web/public/.well-known/apple-app-site-association` (Team ID) و`assetlinks.json` (بصمة SHA-256 من Google Play)، وغيّر النطاق `uyt.app` في `mobile/app.json` إلى نطاقك.

لبناء Android AAB/APK و iOS انظر **`docs/RELEASE.md`**.

---

## 6. الخطوات التالية المقترحة
1. ربط بوابة دفع للاشتراك الشهري (Paymob للسوق المصري / Stripe) وتفعيل حدود الباقات.
2. خدمة بريد (دعوة الموظفين واستعادة كلمة المرور).
3. شاشة عرض للعملاء (TV) بأرقام الطلبات الجاهزة لمن لم يربط هاتفه.
4. ربط مع أنظمة الكاشير POS لإنشاء الطلب تلقائيًا بدل الكتابة (API موجود).
5. Redis adapter + تخزين S3 عند تشغيل أكثر من نسخة.
