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
import { syncNohoudBackendSubscription } from './backend-notifications.js';
import OneSignal from '@onesignal/capacitor-plugin';

// تأكيد تشغيل الحزمة بنجاح لإعلام Capgo بمنع التراجع (Rollback)
CapacitorUpdater.notifyAppReady();

// يقرأها index.html لتمييز بيئة iOS الأصلية عن نسخة الويب.
window.NohoudCapacitor = Capacitor;
window.NohoudLocalNotifications = LocalNotifications;
window.NohoudGeolocation = Geolocation;
window.NohoudSyncBackendSubscription = syncNohoudBackendSubscription;
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
  // رمز AlAdhan لفرنسا UOIF؛ أقرب preset عام مضمّن هنا هو MWL.
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
// نظام إدارة وتحديث الأذكار والإشعارات الذكية
// ==========================================

const fallbackDhikrList = [
  "سبحان الله وبحمده، سبحان الله العظيم.",
  "لا حول ولا قوة إلا بالله العلي العظيم.",
  "استغفر الله العظيم واتوب اليه.",
  "اللهم صل وسلم على نبينا محمد.",
  "لا إله إلا أنت سبحانك إني كنت من الظالمين.",
  "سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر.",
  "رضيت بالله رباً، وبالإسلام ديناً، وبمحمد صلى الله عليه وسلم نبيناً."
];

function getRandomFallbackDhikr() {
  const index = Math.floor(Math.random() * fallbackDhikrList.length);
  return fallbackDhikrList[index];
}

async function fetchDynamicDhikrText(geminiApiKey) {
  if (!geminiApiKey) return getRandomFallbackDhikr();
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "أعطني ذكراً قصيراً ومؤثراً جداً (جملة واحدة فقط بدون أي مقدمات أو شرح)" }]
        }]
      })
    });
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : getRandomFallbackDhikr();
  } catch (err) {
    console.warn('تعذر الاتصال بـ Gemini، تم استخدام الذكر الاحتياطي:', err);
    return getRandomFallbackDhikr();
  }
}

window.NohoudNotificationManager = {
  async scheduleOrUpdateNotification(hour, minute, geminiApiKey) {
    // 1. جلب الذكر المتجدد فوراً عند ضبط الوقت
    const messageText = await fetchDynamicDhikrText(geminiApiKey);

    // 2. حساب وقت الإشعار القادم
    const now = new Date();
    let targetTime = new Date();
    targetTime.setHours(Number(hour), Number(minute), 0, 0);

    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    try {
      // 3. إلغاء أي إشعارات قديمة متراكمة تجنباً للتكرار
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }

      // 4. جدولة الإشعار مباشرة مع النظام بالنص الجديد والوقت المحدد
      await LocalNotifications.schedule({
        notifications: [{
          title: "الأذكار",
          body: messageText,
          id: 1001, // معرف ثابت للإشعار لتحديثه بسهولة
          schedule: { at: targetTime }
        }]
      });

      console.log(`تم جدولة الإشعار بنجاح ليعمل في: ${targetTime.toLocaleString()} بالنص: "${messageText}"`);
    } catch (e) {
      console.warn("فشل جدولة الإشعار المحلي:", e);
    }
  }
};
