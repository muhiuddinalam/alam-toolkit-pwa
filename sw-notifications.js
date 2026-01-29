// Service Worker for Habit Tracker PWA
const CACHE_NAME = 'habit-tracker-v1';
const urlsToCache = [
    '/',
    '/icon-192.png',
    '/icon-512.png'
];

self.addEventListener('install', (event) => {
    console.log('📱 Habit Tracker Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('All resources cached');
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('📱 Habit Tracker Service Worker activating...');
    
    // Clean up old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Claiming clients');
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found
                if (response) {
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(event.request);
            })
    );
});

self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
        const { title, body, delay } = event.data.notification;
        
        console.log(`⏰ Scheduling notification: "${title}" in ${delay}ms`);
        
        // Schedule the notification
        setTimeout(() => {
            self.registration.showNotification(title, {
                body: body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: 'habit-reminder',
                requireInteraction: true,
                vibrate: [200, 100, 200]
            }).then(() => {
                console.log('Notification shown:', title);
            }).catch(error => {
                console.error('Failed to show notification:', error);
            });
        }, delay);
    }
});

self.addEventListener('notificationclick', (event) => {
    console.log('📱 Notification clicked:', event.notification.tag);
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({type: 'window', includeUncontrolled: true})
            .then((clientList) => {
                // Focus existing window or open new one
                for (const client of clientList) {
                    if (client.url.includes('alamtoolkit') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});
