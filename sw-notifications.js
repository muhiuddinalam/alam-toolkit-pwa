// Service Worker for Habit Tracker
const CACHE_NAME = 'habit-tracker-v1';

self.addEventListener('install', (event) => {
    console.log('📱 Service Worker installing...');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('📱 Service Worker activating...');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
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
    console.log('📱 Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({type: 'window', includeUncontrolled: true})
            .then((clientList) => {
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
