// DevSync's service worker. It only shows push notifications and opens them; it caches nothing,
// so a new deploy is never stuck behind an old copy of the app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'DevSync', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    data: { link: data.link || '/dashboard' },
  }));
});

// Clicking one opens where it happened: in an open DevSync window if there is one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let url = new URL(event.notification.data?.link || '/dashboard', self.location.origin);
  if (url.origin !== self.location.origin) url = new URL('/dashboard', self.location.origin);
  event.waitUntil((async () => {
    const open = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .find((c) => new URL(c.url).origin === self.location.origin);
    if (!open) return self.clients.openWindow(url.href);
    await open.focus();
    open.postMessage({ devsync: 'open', path: url.pathname + url.search });
  })());
});
