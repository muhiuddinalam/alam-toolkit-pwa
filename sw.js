const CACHE_NAME = 'alamtoolkit-v1';
const urlsToCache = [
  '/',  // Root of www.alamtoolkit.com
  '/index.html',
  '/style.css',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  '/habit-and-goal-tracker.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
