const CACHE_NAME = 'alamtoolkit-v1.0';
const urlsToCache = [
  '/',
  'https://www.alamtoolkit.com/',
  'https://muhiuddinalam.github.io/alam-toolkit-pwa/offline.html'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event with CORS handling
self.addEventListener('fetch', event => {
  // Handle CORS requests
  if (event.request.url.startsWith('http')) {
    event.respondWith(
      fetch(event.request, {
        mode: 'cors',
        credentials: 'same-origin'
      }).catch(() => {
        // Return cached version if fetch fails
        return caches.match(event.request).then(response => {
          return response || caches.match('/offline.html');
        });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
