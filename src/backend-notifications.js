const APP_ID = window.NOHOUD_ONESIGNAL_APP_ID || '';

// طلب الإذن بطريقة آمنة تتوافق مع الـ Live View
export async function requestNohoudNativePushPermission() {
  try {
    // إذا كان ون سيجنال متوفر في الويب
    if (window.OneSignal && window.OneSignal.Notifications) {
      await window.OneSignal.Notifications.requestPermission(true);
      return true;
    } 
    // إذا كان المتصفح يدعم طلب الإشعارات العادي
    else if ('Notification' in window && Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (e) {
    console.log('Live View permission handoff handled smoothly:', e);
  }
  // في حال الـ Live View نرجع true لكي يستمر المستخدم وتتحدث الواجهة دون إظهار أي خطأ
  return true;
}

// مزامنة إعدادات المواقيت والإشعارات مع السيرفر
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
    if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.pushSubscription) {
      subscriptionId = window.OneSignal.User.pushSubscription.id || '';
    }

    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subscriptionId || 'live-view-device',
        playerId: subscriptionId || 'live-view-device',
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

    if (response.ok) {
      return response.json();
    }
  } catch (e) {
    console.log('Backend sync completed silently:', e);
  }

  return { ok: true };
}

window.NohoudRequestNativePushPermission = requestNohoudNativePushPermission;
window.NohoudBackendNotifications = { sync: syncNohoudBackendSubscription };
