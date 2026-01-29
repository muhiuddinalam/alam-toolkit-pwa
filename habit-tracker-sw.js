// Habit Tracker Service Worker
const CACHE_NAME = 'habit-tracker-v1';
const urlsToCache = [
  '/habit-and-goal-tracker.html',
  '/icon-192.png',
  '/icon-512.png',
  '/'
];

self.addEventListener('install', (event) => {
  console.log('📱 Habit Tracker Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('📱 Habit Tracker Service Worker activating...');
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

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('message', (event) => {
  console.log('Habit Tracker Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = event.data.notification;
    
    console.log(`⏰ Habit Tracker: Scheduling notification: "${title}" in ${delay}ms`);
    
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'habit-reminder',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      }).then(() => {
        console.log('Habit Tracker notification shown:', title);
      }).catch(error => {
        console.error('Failed to show habit tracker notification:', error);
      });
    }, delay);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('📱 Habit Tracker notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true})
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('habit-and-goal-tracker') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/habit-and-goal-tracker.html');
        }
      })
  );
});
