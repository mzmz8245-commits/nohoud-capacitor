import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
} from 'adhan';
import OneSignal from '@onesignal/capacitor-plugin';

// تأكيد تشغيل الحزمة بنجاح لإعلام Capgo بمنع التراجع (Rollback)
CapacitorUpdater.notifyAppReady();

// يقرأها index.html لتمييز بيئة iOS الأصلية عن نسخة الويب.
window.NohoudCapacitor = Capacitor;
window.NohoudLocalNotifications = LocalNotifications;
window.NohoudGeolocation = Geolocation;
window.NohoudOneSignalNative = OneSignal;

const nohoudOneSignalAppId = window.NOHOUD_ONESIGNAL_APP_ID || '';
if (Capacitor.isNativePlatform() && nohoudOneSignalAppId) {
  OneSignal.initialize(nohoudOneSignalAppId).catch((error) => {
    console.warn('Nohoud OneSignal native initialization failed:', error);
  });
}

const calculationMethods = {
  '1': CalculationMethod.Karachi,
  '2': CalculationMethod.NorthAmerica,
  '3': CalculationMethod.MuslimWorldLeague,
  '4': CalculationMethod.UmmAlQura,
  '5': CalculationMethod.Egyptian,
  '8': CalculationMethod.Dubai,
  '12': CalculationMethod.Other,
  '13': CalculationMethod.Turkey,
};

window.NohoudPrayerCalculator = {
  computeTimes(location, isoDate, method = '3', madhab = 'shafi') {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    const coordinates = new Coordinates(
      Number(location.latitude),
      Number(location.longitude),
    );
    const factory = calculationMethods[String(method)] || CalculationMethod.MuslimWorldLeague;
    const params = factory();
    if (String(method) === '12') { params.fajrAngle = 12; params.ishaAngle = 12; }
    params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
    const times = new PrayerTimes(coordinates, date, params);
    const timeIso = {};
    const timings = {};
    for (const name of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      const instant = times[name];
      if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
        throw new Error(`تعذر حساب وقت ${name}`);
      }
      timeIso[name] = instant.toISOString();
      timings[name] = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(instant);
    }
    return {
      timings,
      timeIso,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'توقيت الجهاز',
    };
  },
};

// ==========================================
// نظام إدارة وتحديث الأذكار والإشعارات الذكية (جدولة 14 يوماً للخلفية)
// ==========================================

const DYNAMIC_TEXTS = {
  recovery: [
    "الانتكاسة ليست نهاية الطريق، قم واغسل وجهك وابدأ من جديد بثقة.",
    "درع الصابرين معك اليوم.. كل دقيقة صمود تبني حصنك المنيع.",
    "تذكر لماذا بدأت.. الهدف الذي تسعى إليه يستحق التضحية.",
    "أنت أقوى من أي رغبة مؤقتة. تنفس بعمق وواصل نُهوضك.",
    "لا تستسلم لضعف اللحظة، المكافأة في النهاية أعظم بكثير.",
    "التعافي رحلة، ويوم جديد من النقاء ينتظرك الآن.",
    "استعن بالله ولا تعجز، خطوة صغيرة اليوم تكفيك.",
    "قاوم الفكرة قبل أن تصبح فعلاً، غيّر مكانك واشغل نفسك فوراً.",
    "لقد قطعت شوطاً جيداً، لا تهدم ما بنيته من أجل لذة زائلة.",
    "الصبر مرّ في بدايته لكن عواقبه أحلى من العسل.",
    "كل يوم نظيف هو انتصار عظيم، احتفل بنجاحك اليوم.",
    "لا تفرط في مكتسباتك، تذكر شعور الانتصار بعد تجاوز الرغبة.",
    "أنت لست وحدك، الله معك، استعذ به من نزغات الشياطين.",
    "العادات الجيدة تبنى بالاستمرار، واصل طريقك بشجاعة."
  ],
  adhkar: [
    "حان وقت أذكارك.. حصّن نفسك واجعلها درعاً ليومك.",
    "لا تنسَ الأذكار، فهي طمأنينة للقلب وسكينة للروح.",
    "سبّح بحمد ربك، خذ دقيقة من وقتك للذكر والدعاء.",
    "أذكارك هي حرزك.. بادر بها الآن ولا تؤجلها.",
    "«ألا بذكر الله تطمئن القلوب».. اجعل للذكر نصيباً من يومك.",
    "دقيقة مع الأذكار تبعد عنك التوتر وتجلب البركة.",
    "اذكر الله يذكرك، كن مع الله في رخائك.",
    "الاستغفار يفتح الأقفال، استغفر الله العظيم وأتوب إليه.",
    "الصلاة على النبي ﷺ تكفيك همك وتغفر ذنبك.",
    "حصن نفسك بآية الكرسي والمعوذتين لتكون في حفظ الله.",
    "يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله.",
    "اللهم بك أمسينا وبك أصبحنا.. دعاء يملأ قلبك بالرضا.",
    "كلمتان خفيفتان على اللسان: سبحان الله وبحمده، سبحان الله العظيم.",
    "لا حول ولا قوة إلا بالله، كنز من كنوز الجنة."
  ]
};

window.NohoudNotificationManager = {
  // نستقبل الاستدعاء من index.html ونعتمد على الإعدادات المحفوظة لجدولة الجميع تلقائياً
  async scheduleOrUpdateNotification() {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      const NOHOUD_PUSH_PREFS_KEY = 'nohoud_local_notification_preferences_v1';
      const savedPrefs = localStorage.getItem(NOHOUD_PUSH_PREFS_KEY);
      let prefs = {};
      if (savedPrefs) {
        prefs = JSON.parse(savedPrefs);
      } else {
        prefs = {
          recovery: { enabled: true, time: '12:00' },
          adhkar: { enabled: true, time: '17:00' }
        };
      }

      // 1. تنظيف جميع الإشعارات المجدولة مسبقاً لمنع التكرار نهائياً
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }

      const notificationsToSchedule = [];
      const now = new Date();

      // 2. دالة مساعدة لإنشاء 14 إشعار لنوع معين بتواريخ مستقبلية
      const buildSchedules = (type, timeStr, baseId, title) => {
        if (!timeStr) return;
        const [hour, minute] = timeStr.split(':');
        const textsArray = DYNAMIC_TEXTS[type];

        for (let i = 0; i < 14; i++) {
          const targetTime = new Date();
          targetTime.setHours(Number(hour), Number(minute), 0, 0);
          targetTime.setDate(targetTime.getDate() + i);

          // إذا كان وقت اليوم قد انقضى، نضيف يوم بحيث يبدأ من الغد
          if (i === 0 && targetTime <= now) {
            targetTime.setDate(targetTime.getDate() + 1);
          }

          const textIndex = (targetTime.getDay() + i) % textsArray.length;
          
          notificationsToSchedule.push({
            id: baseId + i,
            title: title,
            body: textsArray[textIndex],
            schedule: { at: targetTime },
            extra: { type: type }
          });
        }
      };

      // 3. بناء إشعارات التعافي (بمعرفات فريدة 1000-1013)
      if (prefs.recovery && prefs.recovery.enabled) {
        buildSchedules('recovery', prefs.recovery.time, 1000, "درع الصابرين 🛡️");
      }

      // 4. بناء إشعارات الأذكار (بمعرفات فريدة 2000-2013)
      if (prefs.adhkar && prefs.adhkar.enabled) {
        buildSchedules('adhkar', prefs.adhkar.time, 2000, "تذكير نُهوض 🌟");
      }

      // 5. جدولة الجميع دفعة واحدة مع نظام الجوال
      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        console.log(`تمت جدولة ${notificationsToSchedule.length} إشعاراً بنجاح لتعمل في الخلفية.`);
      }

    } catch (e) {
      console.error("فشل جدولة الإشعارات المحلية:", e);
    }
  }
};
