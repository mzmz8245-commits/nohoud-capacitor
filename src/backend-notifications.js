// Live View safe (OneSignal + Capacitor)
// src/backend-notifications.js

const APP_ID = window.NOHOUD_ONESIGNAL_APP_ID || '';
// تم تحديث رابط السيرفر الأساسي برابطك المباشر على Vercel
const API_BASE = String(window.NOHOUD_API_BASE || 'https://nohoud-capacitor-znm9-g0ehwp6ct-mzmz8245-commits-projects.vercel.app');
const QUEUE_KEY = 'nohoud_sync_queue_v1';
let webInitialized = false;
let nativeInitialized = false;

/*
  أدوات مساعدة
*/
const safe = async (fn, fallback = null) => {
  try { return await fn(); } catch (e) { return fallback; }
};

const withTimeout = (promise, ms, fallback) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
};

/*
  كشف بيئة Capacitor / OneSignal الأصلي
*/
function getCapacitor() {
  return window.NohoudCapacitor || window.Capacitor || null;
}

function isNativePlatform() {
  const cap = getCapacitor();
  if (cap) {
    if (safeSync(() => cap.isNativePlatform())) return true;
    if (safeSync(() => cap.getPlatform() !== 'web')) return true;
  }
  // جسر Capacitor على iOS الأصلي
  return Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_bridge);
}

function safeSync(fn) {
  try { return fn(); } catch (e) { return false; }
}

// يعيد { native, fromBootstrap } أو null
function findNativeOneSignal() {
  const cap = getCapacitor();
  const candidates = [
    [window.NohoudOneSignalNative, true],
    [window.plugins && window.plugins.OneSignal, false],
    [window.OneSignal, false],
    [cap && cap.Plugins && cap.Plugins.OneSignal, false],
  ];
  for (const [obj, fromBootstrap] of candidates) {
    // نميز SDK OneSignal الأصلي عن الويب
    if (obj && typeof obj.Notifications?.requestPermission === 'function' &&
       (typeof obj.User?.pushSubscription?.getIdAsync === 'function' || fromBootstrap)) {
      return { native: obj, fromBootstrap };
    }
  }
  return null;
}

function ensureNativeInit(found) {
  if (!found || nativeInitialized) return;
  nativeInitialized = true;
  // إن كان الكائن من نص التطبيق المحلي فقد تمت تهيئته هناك، غير ذلك نهيئه هنا
  if (!found.fromBootstrap && APP_ID && typeof found.native.initialize === 'function') {
    safeSync(() => found.native.initialize(APP_ID));
  }
}

/*
  للتشخيص: اكتب NohoudDiagnosePush() في وحدة تحكم Safari المتصلة بالآيفون
*/
export function diagnoseNohoudPush() {
  const cap = getCapacitor();
  return {
    appIdSet: Boolean(APP_ID),
    apiBase: API_BASE,
    origin: location.origin,
    hasCapacitor: Boolean(cap),
    platform: safeSync(() => cap && cap.getPlatform && cap.getPlatform()) || null,
    nativeBridgeHandler: Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_bridge),
    isNative: isNativePlatform(),
    NohoudOneSignalNative: Boolean(window.NohoudOneSignalNative),
    pluginsOneSignal: Boolean(window.plugins && window.plugins.OneSignal),
    nativeOneSignalFound: Boolean(findNativeOneSignal()),
    webNotificationApi: 'Notification' in window,
    lastPermission: window.NohoudPushStatus || null,
  };
}

/*
  OneSignal للويب
*/
async function initWebOneSignal() {
  if (!APP_ID || !window.OneSignalDeferred) return null;
  if (!webInitialized) {
    await withTimeout(new Promise((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal) => {
        await safe(() => OneSignal.init({ appId: APP_ID, allowLocalhostAsSecureOrigin: true, notifyButton: { enable: false } }));
        webInitialized = true;
        resolve();
      });
    }), 8000, null);
  }
  return window.OneSignal || null;
}

/*
  معرّف الاشتراك
*/
async function getNativeSubscriptionId() {
  const found = findNativeOneSignal();
  if (!found) return '';
  ensureNativeInit(found);
  const sub = found.native.User && found.native.User.pushSubscription;
  if (!sub) return '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const id = (typeof sub.getIdAsync === 'function' && await safe(() => sub.getIdAsync()));
    if (id) return id;
    await sleep(500);
  }
  return '';
}

/*
  طلب إذن الإشعارات (لا يرمي خطأ أبداً)
*/
export async function requestNohoudNativePushPermission() {
  const found = findNativeOneSignal();
  if (found) {
    ensureNativeInit(found);
    const result = await safe(() => withTimeout(found.native.Notifications.requestPermission(true), 15000, false), false);
    const granted = result === true;
    window.NohoudPushStatus = { source: 'native-onesignal', granted };
    return granted;
  }
  
  // WKWebView لا يوفر Notification (متصفح عادي فقط)
  if (!isNativePlatform() && 'Notification' in window) {
    const permission = await safe(() => Notification.requestPermission(), 'default');
    const granted = permission === 'granted';
    window.NohoudPushStatus = { source: 'web', granted, permission };
    return granted;
  }
  
  // بيئة غير مدعومة: لا نعرض خطأ (تسجل الحالة للتشخيص،يبقى السلوك السابق true)
  window.NohoudPushStatus = { source: 'none', granted: false, unsupported: true };
  return true;
}

/*
  المزامنة مع الخادم
*/
async function postSubscription(payload) {
  if (!API_BASE || API_BASE.includes('YOUR-BACKEND-DOMAIN')) return { ok: false, skipped: true };
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller && controller.abort(), 10000);
  try {
    const response = await fetch(`${API_BASE}/api/subscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    });
    if (!response.ok) return { ok: false, status: response.status };
    const data = await safe(() => response.json(), {});
    return { ok: true, ...(data || {}) };
  } catch (e) {
    return { ok: false, network: true };
  } finally {
    clearTimeout(timer);
  }
}

// آخر حالة فقط تكفي (تستبدل بدل أن تتراكم)
export async function flushNohoudSyncQueue() {
  const pending = storage.get(QUEUE_KEY);
  if (!pending) return { ok: true, empty: true };
  const result = await postSubscription(pending);
  if (result.ok) storage.remove(QUEUE_KEY);
  return result;
}

export async function syncNohoudBackendSubscription({ location: loc, enabled = true, method = 3, sunnah, hourly = true, hourlyIntervalMinutes = 60, witrMode = 'lastThird' }) {
  if (!loc || !Number.isFinite(Number(loc.latitude)) || !Number.isFinite(Number(loc.longitude))) {
    return { ok: false, skipped: true, reason: 'location is required' };
  }
  
  const native = isNativePlatform();
  let subscriptionId = '';
  
  if (native) {
    subscriptionId = await getNativeSubscriptionId();
  } else {
    const oneSignal = await initWebOneSignal();
    subscriptionId = oneSignal && oneSignal.User && oneSignal.User.PushSubscription && oneSignal.User.PushSubscription.id || '';
  }
  
  if (!subscriptionId) return { ok: false, skipped: true, reason: 'OneSignal subscription is not ready' };
  
  const payload = {
    subscriptionId,
    playerId: subscriptionId,
    latitude: Number(loc.latitude),
    longitude: Number(loc.longitude),
    timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC',
    enabled,
    method,
    sunnah,
    hourly,
    hourlyIntervalMinutes,
    witrMode,
    platform: native ? 'ios' : 'web',
  };
  
  const result = await postSubscription(payload);
  if (!result.ok && !result.skipped) {
    storage.set(QUEUE_KEY, payload); // إعادة المحاولة لاحقاً
    return { ok: false, queued: true, ...result };
  }
  if (result.ok) storage.remove(QUEUE_KEY);
  return result;
}

// تشغيل المزامنة دون انتظار حتى لا تتعلق الواجهة
export function syncNohoudInBackground(settings) {
  syncNohoudBackendSubscription(settings).catch(() => {});
}

/*
  ربط عام
*/
window.addEventListener('online', () => { flushNohoudSyncQueue(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) flushNohoudSyncQueue(); });
flushNohoudSyncQueue();

window.NohoudRequestNativePushPermission = requestNohoudNativePushPermission;
window.NohoudBackendNotifications = {
  sync: syncNohoudBackendSubscription,
  syncInBackground: syncNohoudInBackground,
  flush: flushNohoudSyncQueue,
};
window.NohoudDiagnosePush = diagnoseNohoudPush;
