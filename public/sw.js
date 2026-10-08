const CACHE_NAME = 'teiko-public-shell-v1';
const PRECACHE = ['/offline.html', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (request.mode === 'navigate' && url.pathname === '/') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(request)) || (await caches.match('/offline.html')) || Response.error();
    }
  })());
});
