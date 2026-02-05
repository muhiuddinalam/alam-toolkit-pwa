// ============================================
// FIXED SERVICE WORKER FOR ALAM TOOLKIT
// Version: 2.1 - Safari Compatible
// ============================================

const APP_VERSION = '2.1';
const CACHE_NAME = `alam-toolkit-v${APP_VERSION}`;
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;

// Core assets to cache
const CORE_ASSETS = [
  '/alam-toolkit-pwa/',
  '/alam-toolkit-pwa/index.html',
  '/alam-toolkit-pwa/icon-192.png',
  '/alam-toolkit-pwa/icon-512.png',
  '/alam-toolkit-pwa/manifest.json',
  'https://www.alamtoolkit.com/'
];

// ============================================
// INSTALL EVENT
// ============================================
self.addEventListener('install', event => {
  console.log(`🚀 Service Worker installing v${APP_VERSION}`);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Caching core assets...');
        return cache.addAll(CORE_ASSETS.map(url => new Request(url, { mode: 'no-cors' })));
      })
      .then(() => {
        console.log('✅ Core assets cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Cache installation failed:', error);
      })
  );
});

// ============================================
// ACTIVATE EVENT
// ============================================
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheName.includes(CACHE_NAME)) {
              console.log(`🗑️ Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim all clients
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated successfully');
    })
  );
});

// ============================================
// FETCH EVENT (Safari Compatible)
// ============================================
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome-extension requests
  if (request.url.startsWith('chrome-extension://')) return;
  
  // Skip analytics/telemetry
  if (request.url.includes('analytics') || 
      request.url.includes('telemetry') ||
      request.url.includes('google-analytics')) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Return cached response if available
        if (response) {
          return response;
        }
        
        // Try network
        return fetch(request)
          .then(networkResponse => {
            // Don't cache if not successful
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Clone response for caching
            const responseToCache = networkResponse.clone();
            
            // Determine which cache to use
            const cacheToUse = isStaticAsset(request.url) ? STATIC_CACHE : DYNAMIC_CACHE;
            
            caches.open(cacheToUse)
              .then(cache => {
                cache.put(request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.log('Network failed, serving from cache if available:', error);
            
            // For navigation requests, try to serve offline page
            if (request.mode === 'navigate') {
              return caches.match('/alam-toolkit-pwa/index.html')
                .then(response => response || new Response('Offline', { status: 503 }));
            }
            
            return new Response('You are offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Helper function to identify static assets
function isStaticAsset(url) {
  const staticExtensions = [
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.ico', '.webp'
  ];
  
  const urlString = url.toString();
  return staticExtensions.some(ext => urlString.endsWith(ext));
}

// ============================================
// PUSH NOTIFICATIONS (Basic)
// ============================================
self.addEventListener('push', event => {
  console.log('📨 Push event received');
  
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Alam Toolkit',
      body: event.data.text() || 'New update available!'
    };
  }
  
  const options = {
    body: data.body || 'New update from Alam Toolkit',
    icon: '/alam-toolkit-pwa/icon-192.png',
    badge: '/alam-toolkit-pwa/icon-192.png',
    data: data.data || { url: 'https://www.alamtoolkit.com/' },
    vibrate: [100, 50, 100],
    tag: 'alam-notification'
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Alam Toolkit',
      options
    )
  );
});

self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || 'https://www.alamtoolkit.com/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('alamtoolkit.com') && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', event => {
  console.log('📨 Message from client:', event.data);
  
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log(`✅ Alam Toolkit Service Worker v${APP_VERSION} loaded`);
