const APP_ID = window.NOHOUD_ONESIGNAL_APP_ID || '';
let webInitialized = false;

async function initWebOneSignal() {
  if (!APP_ID || !window.OneSignalDeferred) return null;
  if (!webInitialized) {
    await new Promise((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({ appId: APP_ID, allowLocalhostAsSecureOrigin: true, notifyButton: { enable: false } });
        webInitialized = true;
        resolve();
      });
    });
  }
  return window.OneSignal;
}

async function getNativeSubscriptionId() {
  const native = window.NohoudOneSignalNative;
  if (!native?.User?.pushSubscription?.getIdAsync) return '';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = await native.User.pushSubscription.getIdAsync();
    if (id) return id;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return '';
}

export async function requestNohoudNativePushPermission() {
  const native = window.NohoudOneSignalNative;
  if (!native?.Notifications?.requestPermission) return false;
  return native.Notifications.requestPermission(true);
}

export async function syncNohoudBackendSubscription({ location, enabled = true, method = 3, sunnah, hourly = true, hourlyIntervalMinutes = 60, witrMode = 'lastThird' }) {
  if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
    return { ok: false, skipped: true, reason: 'location is required' };
  }
  let subscriptionId = '';
  const isNative = Boolean(window.NohoudCapacitor?.isNativePlatform?.());
  if (isNative) {
    subscriptionId = await getNativeSubscriptionId();
  } else {
    const oneSignal = await initWebOneSignal();
    subscriptionId = oneSignal?.User?.PushSubscription?.id || '';
  }
  if (!subscriptionId) return { ok: false, skipped: true, reason: 'OneSignal subscription is not ready' };
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
      platform: isNative ? 'ios' : 'web',
    }),
  });
  if (!response.ok) throw new Error('تعذر مزامنة إعدادات الإشعارات مع الخادم');
  return response.json();
}

window.NohoudRequestNativePushPermission = requestNohoudNativePushPermission;
window.NohoudBackendNotifications = { sync: syncNohoudBackendSubscription };
