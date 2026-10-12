import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
} from 'adhan';
import { syncNohoudBackendSubscription } from './backend-notifications.js';
import OneSignal from '@onesignal/capacitor-plugin';

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
