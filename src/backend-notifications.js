// Live View safe (OneSignal + Capacitor)
// src/backend-notifications.js

const APP_ID = window.NOHOUD_ONESIGNAL_APP_ID || '';
const API_BASE = String(window.NOHOUD_API_BASE || 'https://nohoud-capacitor-znm9-g0ehwp6ct-mzmz8245-commits-projects.vercel.app');
const QUEUE_KEY = 'nohoud_sync_queue_v1';
let webInitialized = false;
let nativeInitialized = false;

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

function getCapacitor() {
  return window.NohoudCapacitor || window.Capacitor || null;
}

function isNativePlatform() {
  const cap = getCapacitor();
  if (cap) {
    if (safeSync(() => cap.isNativePlatform())) return true;
    if (safeSync(() => cap.getPlatform() !== 'web')) return true;
  }
  return Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_bridge);
}

function safeSync(fn) {
  try { return fn(); } catch (e) { return false; }
}

function findNativeOneSignal() {
  const cap = getCapacitor();
  const candidates = [
    [window.NohoudOneSignalNative, true],
    [window.plugins && window.plugins.OneSignal, false],
    [window.OneSignal, false],
    [cap && cap.Plugins && cap.Plugins.OneSignal, false],
  ];
  for (const [obj, fromBootstrap] of candidates) {
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
  if (!found.fromBootstrap && APP_ID && typeof found.native.initialize === 'function') {
    safeSync(() => found.native.initialize(APP_ID));
  }
}

export async function requestNohoudNativePushPermission() {
  const found = findNativeOneSignal();
  if (found) {
    ensureNativeInit(found);
    const result = await safe(() => withTimeout(found.native.Notifications.requestPermission(true), 15000, false), false);
    const granted = result === true;
    window.NohoudPushStatus = { source: 'native-onesignal', granted };
    return granted;
  }
  
  if (!isNativePlatform() && 'Notification' in window) {
    const permission = await safe(() => Notification.requestPermission(), 'default');
    const granted = permission === 'granted';
    window.NohoudPushStatus = { source: 'web', granted, permission };
    return granted;
  }
  
  window.NohoudPushStatus = { source: 'none', granted: false, unsupported: true };
  return true;
}

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

export async function syncNohoudBackendSubscription({ location: loc, enabled = true, method = 3, sunnah, hourly = true, hourlyIntervalMinutes = 60, witrMode = 'lastThird' }) {
  if (!loc || !Number.isFinite(Number(loc.latitude)) || !Number.isFinite(Number(loc.longitude))) {
    return { ok: false, skipped: true, reason: 'location is required' };
  }
  
  const native = isNativePlatform();
  let subscriptionId = '';
  
  if (native) {
    const found = findNativeOneSignal();
    if (found) {
      ensureNativeInit(found);
      const sub = found.native.User && found.native.User.pushSubscription;
      if (sub && typeof sub.getIdAsync === 'function') {
        subscriptionId = await safe(() => sub.getIdAsync()) || '';
      }
    }
  } else {
    if (window.OneSignalDeferred) {
      await new Promise((resolve) => {
        window.OneSignalDeferred.push(async (OneSignal) => {
          subscriptionId = OneSignal?.User?.PushSubscription?.id || '';
          resolve();
        });
      });
    }
  }
  
  const payload = {
    subscriptionId: subscriptionId || 'live-view-device',
    playerId: subscriptionId || 'live-view-device',
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
    storage.set(QUEUE_KEY, payload);
    return { ok: false, queued: true, ...result };
  }
  if (result.ok) storage.remove(QUEUE_KEY);
  return result;
}

window.NohoudRequestNativePushPermission = requestNohoudNativePushPermission;
window.NohoudBackendNotifications = { sync: syncNohoudBackendSubscription };
