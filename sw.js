// Alam Toolkit Service Worker
const CACHE_NAME = 'alam-toolkit-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll([OFFLINE_URL]);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(OFFLINE_URL);
      })
  );
});
