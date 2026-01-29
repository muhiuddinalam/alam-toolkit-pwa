// Update your existing sw.js file to include habit tracker functionality
const CACHE_NAME = 'alamtoolkit-v1';
const urlsToCache = [
  '/'
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

// ADD HABIT TRACKER NOTIFICATION HANDLING
self.addEventListener('message', event => {
    console.log('SW received message:', event.data);
    
    if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
        const { title, body, delay } = event.data.notification;
        
        console.log(`Scheduling notification: "${title}" in ${delay}ms`);
        
        setTimeout(() => {
            self.registration.showNotification(title, {
                body: body,
                icon: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
                tag: 'habit-reminder',
                requireInteraction: true
            });
        }, delay);
    }
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({type: 'window'}).then(clientList => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
