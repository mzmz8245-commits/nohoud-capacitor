const APP_ID = window.NOHOUD_ONESIGNAL_APP_ID || '';
let webInitialized = false;

async function initWebOneSignal() {
  if (!APP_ID || !window.OneSignalDeferred) return null;
  if (!webInitialized) {
    await new Promise((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({ 
          appId: APP_ID, 
          allowLocalhostAsSecureOrigin: true, 
          notifyButton: { enable: false } 
        });
        webInitialized = true;
        resolve();
      });
    });
  }
  return window.OneSignal;
}

export async function requestNohoudNativePushPermission() {
  try {
    const oneSignal = await initWebOneSignal();
    if (oneSignal && oneSignal.Slidedown) {
      await oneSignal.Slidedown.promptPush();
      return true;
    } else if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (e) {
    console.log('Push permission error handled:', e);
  }
  return false;
}

export async function syncNohoudBackendSubscription({ location, enabled = true, method = 3, sunnah, hourly = true, hourlyIntervalMinutes = 60, witrMode = 'lastThird' }) {
  if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
    return { ok: false, skipped: true, reason: 'location is required' };
  }
  
  const oneSignal = await initWebOneSignal();
  const subscriptionId = oneSignal?.User?.PushSubscription?.id || '';
  
  if (!subscriptionId) {
    return { ok: false, skipped: true, reason: 'OneSignal subscription is not ready yet' };
  }

  const response = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      subscriptionId,
      playerId: subscriptionId,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      enabled,
      method,
      sunnah,
      hourly,
      hourlyIntervalMinutes,
      witrMode,
      platform: 'web',
    }),
  });
  
  if (!response.ok) throw new Error('تعذر مزامنة إعدادات الإشعارات مع الخادم');
  return response.json();
}

window.NohoudRequestNativePushPermission = requestNohoudNativePushPermission;
window.NohoudBackendNotifications = { sync: syncNohoudBackendSubscription };
