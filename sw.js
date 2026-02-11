// Simple Service Worker for Alarm Clock
// Save this as sw.js in your Blogger site root

self.addEventListener('install', event => {
    console.log('Service Worker: Installed');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activated');
    event.waitUntil(self.clients.claim());
});

// Handle push notifications
self.addEventListener('push', event => {
    console.log('Push received');
    
    const options = {
        body: 'Alarm! Time to wake up!',
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/23f0.png',
        badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/23f0.png',
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };
    
    event.waitUntil(
        self.registration.showNotification('⏰ Alarm Clock', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(windowClients => {
            if (windowClients.length > 0) {
                windowClients[0].focus();
            } else {
                self.clients.openWindow('/');
            }
        })
    );
});
