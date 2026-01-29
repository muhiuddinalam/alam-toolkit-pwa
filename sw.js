// Main PWA Service Worker
const CACHE_NAME = 'alamtoolkit-v1';
const urlsToCache = [
  '/',
  '/habit-and-goal-tracker.html',
  '/style.css',
  '/icon-192.png',
  '/icon-512.png'
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
