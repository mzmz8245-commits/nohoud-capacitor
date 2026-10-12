# نُهوض — تطبيق iPhone بإشعارات محلية

هذه نسخة Capacitor من تطبيق نُهوض. في نسخة iOS تُحسب مواقيت الصلاة **على الجهاز** بواسطة مكتبة `adhan`، وتُسجَّل التنبيهات في نظام الإشعارات المحلي بواسطة `@capacitor/local-notifications`. بعد جدولة التنبيه لا يحتاج إظهاره إلى خادم Push أو خادم إشعارات أو اتصال إنترنت.

> **حدّ مهم في iOS:** تضع هذه النسخة الأذان والإقامة والمتابعة للأيام الأربعة المقبلة في قائمة التنبيهات الأصلية (حتى 60 موعداً)، مع التذكيرات اليومية والساعة. ينبغي فتح التطبيق مرة كل أربعة أيام على الأقل ليعيد ملء المواعيد القادمة. لا يستطيع تطبيق محلي بلا خادم تنفيذ JavaScript أثناء إغلاقه وإعادة حساب مواقيت تتغير كل يوم إلى أجل غير محدود؛ كما أن iOS يحدّ عدد الإشعارات المحلية المعلّقة لكل تطبيق. بعد فتح نُهوض تُحدّث الجدولة تلقائياً.

## ما يتضمنه المشروع

- `index.html`: التطبيق مع مسار الويب الحالي كبديل للمتصفح، ومسار Capacitor عند تشغيله أصلياً.
- `src/main.js`: جسر Capacitor، إضافة الموقع والإشعارات، والحساب المحلي.
- `native-sounds/nohoud-soft-chime.wav`: نغمة قصيرة هادئة للإشعارات الأصلية.
- `capacitor.config.json`: معرّف التطبيق وإعداد Capacitor.

## المتطلبات

- جهاز **Mac** عليه Xcode. وثائق Capacitor الحالية تتطلب iOS 15+ وXcode 26+.
- Node.js حديث (Node 22 مناسب) وnpm.
- حساب Apple للتوقيع عند تثبيت التطبيق على جهاز iPhone فعلي؛ للاختبار عبر Xcode اختر حساب Team متاحاً.

لا يمكن بناء ملف iOS قابل للتثبيت من Netlify Drop أو من Linux وحده؛ مشروع iOS يُنشأ ويُوقّع عبر Xcode على macOS.

## بناء وتشغيل على iPhone

1. فك ضغط `nohoud-capacitor.zip` على الـ Mac وافتح Terminal داخل مجلد `nohoud-capacitor`.
2. ثبّت التبعيات وابنِ ملفات الويب:

   ```bash
   npm install
   npm run build
   ```

3. أنشئ مشروع iOS الأصلي لأول مرة ثم زامن الإضافات والملفات:

   ```bash
   npx cap add ios
   npx cap sync ios
   ```

   بعد أي تعديل لاحق على التطبيق استخدم:

   ```bash
   npm run ios:sync
   ```

4. أضف وصف إذن الموقع إلى `ios/App/App/Info.plist` من Xcode (**Target App → Info → Custom iOS Target Properties**)؛ أضف:
   - `Privacy - Location When In Use Usage Description` (`NSLocationWhenInUseUsageDescription`): `يستخدم نُهوض موقعك لحساب مواقيت الصلاة على جهازك فقط.`
   - `Privacy - Location Always and When In Use Usage Description` (`NSLocationAlwaysAndWhenInUseUsageDescription`): استخدم الوصف نفسه. الإضافة الرسمية لـ Geolocation تطلب وجود المفتاحين في Info.plist؛ التطبيق لا يتتبع الموقع في الخلفية ولا يحتاج ذلك.

5. أضف ملف الصوت إلى حزمة iOS:
   - انسخ `native-sounds/nohoud-soft-chime.wav` إلى `ios/App/App/`.
   - في Xcode اختر **File → Add Files to “App”…** ثم حدّد الملف، وتأكد من تفعيل **Copy items if needed** وTarget Membership لـ **App**.
   - راجع **Target App → Build Phases → Copy Bundle Resources** وتأكد من وجود `nohoud-soft-chime.wav`.
   - إذا لم تضفه، ستستخدم إشعارات النظام الصوت الافتراضي أو قد تظهر بصمت بحسب إعداد الجهاز.

6. افتح المشروع:

   ```bash
   npx cap open ios
   ```

   في Xcode اختر Team للتوقيع، ثم اختر جهاز iPhone واضغط Run. حافظ على `appId` في `capacitor.config.json` نفسه بين التحديثات (`app.nohoud.mobile`) كي تبقى بيانات `LocalStorage` على الجهاز.

7. داخل التطبيق اضغط **تفعيل الإشعارات** واسمح بإشعارات النظام والموقع. اختر طريقة الحساب ومذهب العصر، واضبط مهلة الإقامة لكل صلاة، ثم تحقق من المواقيت مقابل تقويم مسجدك المحلي.

## كيف تعمل الجدولة

- يحسب التطبيق مواقيت الأيام الأربعة القادمة محلياً من الإحداثيات المختارة، ولا يرسل الإحداثيات إلى API مواقيت في نسخة Capacitor.
- يبرمج الأصل على الجهاز ثلاثة أنواع لكل صلاة: دخول الوقت، تذكير الإقامة بعد المهلة المحددة، ومتابعة بعد المدة المحددة إن لم يُسجَّل «صليت».
- زر **صليت** يحفظ الحالة محلياً ويلغي متابعة تلك الصلاة.
- تُجدول التذكيرات اليومية والساعة عبر إضافة الإشعارات نفسها إذا فُعّلت في إعدادات التذكيرات.
- إشعارات iOS المحلية تعمل دون خدمة Push، لكن تركيز النظام/وضع الصامت/إعدادات الإشعارات قد يؤثر في الصوت والعرض. النغمة المرفقة ليست أذاناً؛ إنها إشارة هادئة قصيرة.
- نسخة `index.html` المنفردة على Netlify Drop تستمر كنسخة ويب: لا تملك Capacitor native bridge، لذلك لا تستطيع جدولة إشعارات نظام موثوقة بعد إغلاق الصفحة.

## طرق الحساب

تحويل الخيارات إلى حساب `adhan` المحلي: 1 Karachi، 2 ISNA/North America، 3 Muslim World League، 4 أم القرى، 5 المصرية، 8 Dubai كتقريب لخيار الخليج، 12 UOIF بزاويتي 12° كتقريب، و13 تركيا. راجع مواقيت التقويم المحلي لأن طرق الحساب وبعض التصحيحات المحلية قد تختلف. العصر قابل للاختيار بين الشافعي والحنفي.

## مراجع رسمية

- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [Capacitor Geolocation](https://capacitorjs.com/docs/apis/geolocation)
- [Capacitor iOS](https://capacitorjs.com/docs/ios)
- [Adhan JS](https://github.com/batoulapps/adhan-js)

> الحسابات تعتمد توقيت الجهاز المحلي؛ فعّل **الإعداد التلقائي للتاريخ والوقت والمنطقة الزمنية** في iPhone، وجدّد الموقع يدوياً بعد الانتقال إلى مدينة أخرى. يبقى `appId` ثابتاً حتى لا يفقد التطبيق تخزينه المحلي عند تحديثه.


## الإشعارات السحابية عبر Vercel وOneSignal

يحتوي المشروع الآن على Backend اختياري داخل `api/`:

- `api/subscribe.js`: يحفظ `OneSignal Player ID` والإحداثيات والمنطقة الزمنية وإعدادات السنن.
- `api/cron/notifications.js`: يفحص المواعيد كل دقيقة، ويحسب الفروض والشروق والضحى والوتر، ثم يرسل عبر OneSignal.
- `api/_lib/ai.js`: يدعم OpenAI أو Gemini لتوليد نص متجدد. عند فشل الذكاء الاصطناعي يستخدم رسائل احتياطية قصيرة.
- `vercel.json`: يعرّف مهمة Cron على المسار `/api/cron/notifications`.
- `.env.example`: قائمة المتغيرات المطلوبة.

### إعداد Vercel

1. أنشئ تطبيقاً في OneSignal وخذ `App ID` و`REST API Key`.
2. أنشئ قاعدة Upstash Redis من Vercel Marketplace، ثم انسخ `KV_REST_API_URL` و`KV_REST_API_TOKEN`.
3. في Vercel افتح **Project Settings → Environment Variables** وأضف المتغيرات الموجودة في `.env.example`:
   - `ONESIGNAL_APP_ID`
   - `ONESIGNAL_REST_API_KEY`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `OPENAI_API_KEY` أو `GEMINI_API_KEY`
   - `AI_PROVIDER` بقيمة `openai` أو `gemini`
   - `CRON_SECRET`
4. عدّل قيمة `window.NOHOUD_ONESIGNAL_APP_ID` في `index.html` إلى OneSignal App ID العام. هذا المعرّف ليس مفتاحاً سرياً.
5. ارفع المشروع إلى GitHub ثم اربطه بمشروع Vercel، أو ارفع مجلد المشروع مباشرة إلى GitHub وبعدها استورد المستودع في Vercel.
6. افتح التطبيق، فعّل الإشعارات والموقع، وسيُرسل التطبيق الإحداثيات والاشتراك إلى `/api/subscribe`.

> تحتاج Vercel Cron التي تعمل كل دقيقة إلى الخطة التي تسمح بهذا التكرار. إذا كانت الخطة لا تسمح بالدقيقة، غيّر الجدول إلى `*/5 * * * *` وزد `NOTIFICATION_TOLERANCE_MINUTES` إلى `5`.

> لا يطلب مولد الذكاء الاصطناعي اختلاق أحاديث أو آيات. الرسائل العامة تُولّد بأسلوب متجدد، أما النصوص المنسوبة للمصادر فيجب إضافتها من مصدر موثوق ومراجعته قبل النشر.


## إصلاح الإشعارات عند إغلاق تطبيق iOS

نسخة Capacitor لا تستخدم OneSignal Web SDK داخل iOS الأصلي. يجب أن يستخدم التطبيق `@onesignal/capacitor-plugin`، وأن يُسجَّل **Subscription ID** الناتج من الاشتراك الأصلي، وليس Web Player ID. أضيفت الإضافة إلى `package.json`، ويهيّئها `src/main.js` عند تشغيل التطبيق الأصلي.

قبل اختبار الإشعار على iPhone فعلي، من لوحة OneSignal افتح **Settings → Push & In-App → Apple iOS (APNs)** وأضف APNs Auth Key بصيغة `.p8` مع Key ID وTeam ID وBundle ID. يجب أن يطابق Bundle ID القيمة `app.nohoud.mobile`.

في Xcode أو في إعداد Workflow يجب أن يكون Target App مفعلاً له **Push Notifications** و**Background Modes → Remote notifications**، وأن يحتوي ملف التوقيع على `aps-environment`. يضيف Workflow هذه الإعدادات إلى البناء، لكن ملف Provisioning Profile يجب أن يكون منشأً بعد تفعيل Push Notifications في Apple Developer.

اختبر أولاً من لوحة OneSignal بإرسال رسالة إلى الاشتراك الظاهر في **Audience → Users & subscriptions → Subscriptions**. يجب أن تكون حالته **Subscribed** وأن يكون نوع القناة iOS Mobile، وليس Web. إذا لم يظهر اشتراك iOS، فهذا يعني أن التطبيق المثبت بُني قبل إضافة الإضافة أو أن إذن الإشعارات لم يُمنح؛ احذف التطبيق وأعد تثبيت أحدث بناء على iPhone.

تم تحديث Vercel API ليستخدم `POST https://api.onesignal.com/notifications` و`include_subscription_ids`. أما Vercel Cron فيولّد محتوى الرسالة ويطلب الإرسال فقط؛ لا يستطيع جعل APNs يعمل إذا لم يكن اشتراك iOS أو APNs مهيأً بشكل صحيح.

> لا يمكن اختبار إشعارات APNs الأصلية على ملف `iOS Simulator .app` السابق. استخدم iPhone فعلياً مع توقيع Apple، أو استخدم محاكي iOS حديثاً مهيأً لاختبار Push. إغلاق التطبيق بالقوة قد يؤثر في بعض مهام الخلفية المحلية، لكن Push عن بُعد عبر APNs يجب أن يصل عندما يكون التطبيق مغلقاً إذا كان الاشتراك APNs صالحاً.
