/*
 * Public offline shell only. No tenant/authenticated response is ever cached.
 * The service worker never stores storefront HTML, orders, API responses, or
 * admin/driver pages; Firebase and Functions remain network-only.
 */
const CACHE_NAME = 'sushi-public-shell-v2';
const OLD_CACHE_NAMES = new Set(['teiko-public-shell-v1']);
const PRECACHE = ['/offline.html', '/favicon.svg'];
const PRECACHE_PATHS = new Set(PRECACHE);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => OLD_CACHE_NAMES.has(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Private resources and network APIs are never intercepted or cached.
  // Navigation gets a public static offline document, never an old page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error()),
    );
    return;
  }

  // Only two explicitly public static assets are served from offline cache.
  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request)) || Response.error()),
    );
  }
});

// Data-only notifications: messages must never contain PII or delivery codes.
self.addEventListener('push', (event) => {
  let info = {};
  try {
    const payload = event.data?.json() || {};
    info = payload.data || payload;
  } catch {
    info = {};
  }
  event.waitUntil(self.registration.showNotification('Nova corrida atribuída', {
    body: 'Abra seu portal para conferir a solicitação.',
    tag: 'sushi-driver-assignment',
    data: { link: '/entregador' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/entregador'));
});
