// ============================================
// SIMPLIFIED SERVICE WORKER FOR ALAM TOOLKIT
// Version: 2.1 - Fixed for Blogger
// ============================================

const CACHE_NAME = 'alam-toolkit-v3';
const STATIC_CACHE = CACHE_NAME + '-static';

// Assets to cache
const ASSETS = [
  '/alam-toolkit-pwa/',
  '/alam-toolkit-pwa/index.html',
  '/alam-toolkit-pwa/icon-192.png',
  '/alam-toolkit-pwa/icon-512.png',
  '/alam-toolkit-pwa/manifest.json'
];

// ============================================
// INSTALL
// ============================================
self.addEventListener('install', event => {
  console.log('📦 Installing Service Worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATE
// ============================================
self.addEventListener('activate', event => {
  console.log('🔄 Activating Service Worker');
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName.includes('alam-toolkit')) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker ready');
    })
  );
});

// ============================================
// FETCH
// ============================================
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        // Return cached if available
        if (cached) {
          return cached;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE)
                .then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/alam-toolkit-pwa/index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', event => {
  console.log('📨 Push received');
  
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'Alam Toolkit',
      body: 'New update available'
    };
  }
  
  const options = {
    body: data.body || 'Check out the latest tools',
    icon: '/alam-toolkit-pwa/icon-192.png',
    badge: '/alam-toolkit-pwa/icon-192.png',
    data: data.data || { url: 'https://www.alamtoolkit.com/' },
    vibrate: [200, 100, 200],
    tag: 'alam-notification'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Alam Toolkit', options)
  );
});

// ============================================
// NOTIFICATION CLICK
// ============================================
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked');
  
  event.notification.close();
  
  const url = event.notification.data?.url || 'https://www.alamtoolkit.com/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Check if window is already open
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', event => {
  console.log('📨 Message from client:', event.data.type);
  
  switch (event.data.type) {
    case 'SEND_NOTIFICATION':
      sendNotification(event.data.data);
      break;
      
    case 'NEW_CONTENT':
      handleNewContent(event.data.data);
      break;
      
    case 'CONFIG':
      console.log('Config received from client');
      break;
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================
function sendNotification(data) {
  const options = {
    body: data.body || 'New update',
    icon: '/alam-toolkit-pwa/icon-192.png',
    badge: '/alam-toolkit-pwa/icon-192.png',
    data: { url: data.url || 'https://www.alamtoolkit.com/' },
    vibrate: [200, 100, 200],
    tag: 'manual-notification'
  };
  
  return self.registration.showNotification(
    data.title || 'Alam Toolkit',
    options
  );
}

function handleNewContent(data) {
  console.log('New content detected:', data.title);
  
  // You could show a notification here
  // For now, just log it
  if (Math.random() < 0.3) { // 30% chance to demo
    sendNotification({
      title: '📢 New Content!',
      body: data.title,
      url: data.url
    });
  }
}

// ============================================
// INIT
// ============================================
console.log('✅ Alam Toolkit Service Worker loaded');
