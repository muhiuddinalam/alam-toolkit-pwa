const CACHE_NAME = 'alamtoolkit-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/habit-and-goal-tracker.html',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Service Worker
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
        }).then(() => {
            console.log('Service Worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch with Cache
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});

// Background sync for offline reminder scheduling
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reminders') {
    event.waitUntil(
      // This would sync reminders with server when back online
      console.log('Syncing reminders with server...')
    );
  }
});

// Periodic sync for daily reminders
self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-reminders') {
    event.waitUntil(
      // Check for scheduled reminders
      console.log('Checking for scheduled reminders...')
    );
  }
});

// Push Notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('AlamToolKit', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('https://app.alamtoolkit.com/')
    );
  } else if (event.action === 'close') {
    // Do nothing
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url === 'https://app.alamtoolkit.com/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('https://app.alamtoolkit.com/');
        }
      })
    );
  }
});
