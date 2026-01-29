// sw-notifications.js - Service Worker for Background Notifications
self.addEventListener('install', (event) => {
    console.log('📱 Habit Tracker Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('📱 Habit Tracker Service Worker activating...');
    event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
        const { title, body, delay } = event.data.notification;
        
        console.log(`⏰ Scheduling notification: ${title} in ${delay}ms`);
        
        // Schedule the notification
        setTimeout(() => {
            self.registration.showNotification(title, {
                body: body,
                icon: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
                badge: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
                tag: 'habit-reminder',
                requireInteraction: true,
                vibrate: [200, 100, 200]
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
                    if (client.url === self.registration.scope && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(self.registration.scope);
                }
            })
    );
});
