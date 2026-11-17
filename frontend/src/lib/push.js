import { api, API_URL } from './api';

// Phone and desktop notifications, and installing DevSync as an app.

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// The browser's "Install app" prompt, kept for the button in Settings (Chrome, Edge, Android)
let installEvent = null;
const installListeners = new Set();
export const installPrompt = () => installEvent;
export const onInstallPrompt = (fn) => (installListeners.add(fn), () => installListeners.delete(fn));

export function startServiceWorker() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    installListeners.forEach((fn) => fn(e));
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    installListeners.forEach((fn) => fn(null));
  });
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  // A clicked notification asks the open window to go there, without reloading the app
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.devsync !== 'open' || !String(e.data.path).startsWith('/')) return;
    window.history.pushState({}, '', e.data.path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

export async function deviceSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

const bytes = (base64url) => Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function pushOn() {
  const { key } = await fetch(`${API_URL}/api/push/key`).then((r) => r.json());
  if (!key) throw new Error("Notifications aren't set up on this server yet.");
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error("Notifications are blocked for DevSync. Allow them in your browser's site settings, then try again.");
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) });
  await api('/api/me/push', { method: 'POST', body: sub.toJSON() });
}

// Stop this device's notifications (also on sign-out, so the next person doesn't get yours)
export async function pushOff() {
  const sub = await deviceSubscription();
  if (!sub) return;
  await api('/api/me/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
