// Alam Toolkit Main Service Worker
const CACHE_NAME = 'alamtoolkit-v2';
const urlsToCache = [
  '/',
  '/habit-and-goal-tracker.html',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  console.log('📱 Alam Toolkit Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('📱 Alam Toolkit Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});

// Habit Tracker Notification Handler
self.addEventListener('message', (event) => {
  console.log('📱 Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = event.data.notification;
    
    console.log(`⏰ Scheduling notification: "${title}" in ${delay}ms`);
    
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'habit-reminder',
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          url: '/habit-and-goal-tracker.html'
        }
      }).then(() => {
        console.log('Notification shown:', title);
      }).catch(error => {
        console.error('Failed to show notification:', error);
      });
    }, delay);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked');
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/habit-and-goal-tracker.html';
  
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true})
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('habit-and-goal-tracker') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background Sync (for future use)
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
});

// Periodic Sync (for Chrome)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'habit-reminder-check') {
      event.waitUntil(checkReminders());
    }
  });
}

async function checkReminders() {
  console.log('⏰ Periodic reminder check');
  // You can implement periodic reminder checking here
}
