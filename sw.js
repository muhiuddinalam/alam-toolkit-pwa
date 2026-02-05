// sw.js – tailored for Alam Toolkit (Blogger + GitHub Pages)

const CACHE_NAME = 'alam-toolkit-tools-v1';
const CACHE_VERSION = 'v1';

// Your main tool pages (explicitly precached)
const urlsToCache = [
  // Blogger‑hosted tools
  'https://www.alamtoolkit.com/',
  'https://www.alamtoolkit.com/p/team-calendar-scheduler.html',
  'https://www.alamtoolkit.com/p/personal-daily-calendar-planner.html',
  'https://www.alamtoolkit.com/p/task-manager.html',
  'https://www.alamtoolkit.com/p/habit-and-goal-tracker.html',

  // GitHub Pages assets (PWA)
  'https://muhiuddinalam.github.io/alam-toolkit-pwa/manifest.json',
  'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
  'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-512.png',
  'https://muhiuddinalam.github.io/alam-toolkit-pwa/sw.js',
];

// Decide caching strategy per URL
function getStrategy(url) {
  const u = new URL(url);
  if (
    u.pathname.endsWith('.png') ||
    u.pathname.endsWith('.jpg') ||
    u.pathname.endsWith('.ico') ||
    u.pathname.endsWith('.svg') ||
    u.pathname.endsWith('.webp')
  ) {
    return 'cache-first';
  }
  if (
    u.pathname.endsWith('.css') ||
    u.pathname.endsWith('.js') ||
    u.pathname === '/manifest.json'
  ) {
    return 'cache-first';
  }
  return 'network-first';
}

self.addEventListener('install', (event) => {
  console.log('🔧 SW installing:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache
        .addAll(urlsToCache.filter((url) => !url.includes('sw.js')))
        .then(() => {
          console.log('✅ Critical tools & assets precached');
        })
        .catch((err) => {
          console.warn('⚠️ Some precache failed:', err);
        });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const strategy = getStrategy(url);

  if (strategy === 'cache-first') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          console.log('📦 Cache hit:', url);
          return cached;
        }

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return response;
          })
          .catch((err) => {
            console.warn('⚠️ Network failed, no cache:', url, err);
            if (event.request.mode === 'navigate') {
              return caches.match('https://www.alamtoolkit.com/');
            }
          });
      })
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch((err) => {
          console.warn('⚠️ Network failed, trying cache:', url, err);
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('https://www.alamtoolkit.com/');
            }
          });
        })
    );
  }
});
