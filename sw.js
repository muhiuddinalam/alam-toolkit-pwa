// Service Worker for www.alamtoolkit.com
const CACHE_NAME = 'alamtoolkit-main-v3';
const urlsToCache = [
  '/',
  '/habit-and-goal-tracker.html',
  '/p/habit-and-goal-tracker.html',
  '/style.css',
  '/p/style.css',
  'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
  'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-512.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate and clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch with network-first strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request)
          .then(cachedResponse => {
            return cachedResponse || caches.match('/');
          });
      })
  );
});

// Push Notifications (optional)
self.addEventListener('push', event => {
  const title = 'AlamToolKit Update';
  const options = {
    body: event.data ? event.data.text() : 'New content available!',
    icon: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
    badge: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
