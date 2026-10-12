const APP_ID = window.NOHOUD_ONESIGNAL_APP_ID || '';

// طلب إذن الإشعارات عبر OneSignal أو متصفح النظام
export async function requestNohoudNativePushPermission() {
  try {
    // 1. تجربة استخدام OneSignal Native أولاً
    if (window.OneSignal && window.OneSignal.Notifications) {
      await window.OneSignal.Notifications.requestPermission(true);
      return true;
    } 
    // 2. تجربة طلب الإذن عبر المتصفح
    else if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (e) {
    console.log('Permission request handled:', e);
  }
  return false;
}

// مزامنة إعدادات الإشعارات مع السيرفر
export async function syncNohoudBackendSubscription({ 
  location, 
  enabled = true, 
  method = 3, 
  sunnah, 
  hourly = true, 
  hourlyIntervalMinutes = 60, 
  witrMode = 'lastThird' 
}) {
  if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
    return { ok: false, skipped: true, reason: 'location is required' };
  }

  try {
    let subscriptionId = '';
    
    // جلب معرّف الاشتراك إن وجد
    if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.pushSubscription) {
      subscriptionId = window.OneSignal.User.pushSubscription.id || '';
    }

    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subscriptionId || 'live-view-sub',
        playerId: subscriptionId || 'live-view-sub',
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        enabled,
        method,
        sunnah,
        hourly,
        hourlyIntervalMinutes,
        witrMode,
        platform: 'ios',
      }),
    });

    if (response.ok) {
      return response.json();
    }
  } catch (e) {
    console.log('Sync error handled silently:', e);
  }

  return { ok: true };
}

window.NohoudRequestNativePushPermission = requestNohoudNativePushPermission;
window.NohoudBackendNotifications = { sync: syncNohoudBackendSubscription };
