const APP_ID = window.NOHOUD_ONESIGNAL_APP_ID || '';
let initialized = false;

async function initOneSignal() {
  if (!APP_ID || !window.OneSignalDeferred) return null;
  if (!initialized) {
    await new Promise((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({ appId: APP_ID, allowLocalhostAsSecureOrigin: true, notifyButton: { enable: false } });
        initialized = true;
        resolve();
      });
    });
  }
  return window.OneSignalDeferred;
}

export async function syncNohoudBackendSubscription({ location, enabled = true, method = 3, sunnah, hourly = true, hourlyIntervalMinutes = 60, witrMode = 'lastThird' }) {
  await initOneSignal();
  let playerId = '';
  try {
    const OneSignal = window.OneSignal;
    playerId = OneSignal?.User?.PushSubscription?.id || '';
  } catch (_) {}
  
  if (!playerId) return { ok: false, skipped: true, reason: 'OneSignal subscription is not ready' };

  // استخدام إحداثيات افتراضية لجدة في حال لم يتم تحديد الموقع لتفادي تخطي التسجيل
  const lat = (location && Number.isFinite(Number(location.latitude))) ? Number(location.latitude) : 21.5433;
  const lng = (location && Number.isFinite(Number(location.longitude))) ? Number(location.longitude) : 39.1728;

  const response = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerId,
      latitude: lat,
      longitude: lng,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      enabled,
      method,
      sunnah,
      hourly,
      hourlyIntervalMinutes,
      witrMode,
    }),
  });
  if (!response.ok) throw new Error('تعذر مزامنة إعدادات الإشعارات مع الخادم');
  return response.json();
}

window.NohoudBackendNotifications = { sync: syncNohoudBackendSubscription };
