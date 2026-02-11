// Service Worker for AlamToolkit Alarm Clock with VAPID key
const CACHE_NAME = 'alarm-clock-v5';

// Install event
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(self.clients.claim());
});

// Push notification event
self.addEventListener('push', event => {
    console.log('Push notification received');
    
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { 
            title: '⏰ Alarm Clock',
            body: 'Time to wake up!' 
        };
    }
    
    const options = {
        body: data.body || 'Alarm!',
        icon: '/icons/alarm-192.png',
        badge: '/icons/badge-96.png',
        tag: `push-${Date.now()}`,
        requireInteraction: true,
        renotify: false,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        data: data.data || {}
    };
    
    // Add actions for alarms
    if (data.data && data.data.alarmId) {
        options.actions = [
            { action: 'snooze', title: 'Snooze' },
            { action: 'dismiss', title: 'Dismiss' }
        ];
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Alarm Clock', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event.action);
    
    event.notification.close();
    
    const urlToOpen = self.location.origin;
    
    if (event.action === 'snooze') {
        // Handle snooze
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'NOTIFICATION_ACTION',
                        action: 'snooze',
                        alarmId: event.notification.data.alarmId
                    });
                });
            })
        );
    } else if (event.action === 'dismiss') {
        // Handle dismiss
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'NOTIFICATION_ACTION',
                        action: 'dismiss',
                        alarmId: event.notification.data.alarmId
                    });
                });
            })
        );
    } else {
        // Open app
        event.waitUntil(
            self.clients.matchAll({type: 'window'}).then(windowClients => {
                if (windowClients.length > 0) {
                    windowClients[0].focus();
                } else {
                    self.clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

// Handle messages from main thread
self.addEventListener('message', event => {
    const { type, data } = event.data || {};
    
    switch (type) {
        case 'SCHEDULE_ALARM':
            scheduleAlarm(data);
            break;
            
        case 'ALARM_TRIGGERED':
            // Forward to other clients
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'ALARM_TRIGGERED',
                        alarmId: data.alarmId,
                        alarmData: data.alarmData
                    });
                });
            });
            break;
    }
});

// Schedule alarm in background
function scheduleAlarm(alarmData) {
    const { alarm } = alarmData;
    const alarmTime = parseAlarmTime(alarm.time);
    const now = new Date();
    const delay = alarmTime.getTime() - now.getTime();
    
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
            self.registration.showNotification(`⏰ ${alarm.label}`, {
                body: `Scheduled: ${alarm.time}`,
                icon: '/icons/alarm-192.png',
                tag: `scheduled-${alarm.id}`,
                requireInteraction: true
            });
        }, delay);
    }
}

function parseAlarmTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed, schedule for tomorrow
    if (alarmTime < new Date()) {
        alarmTime.setDate(alarmTime.getDate() + 1);
    }
    
    return alarmTime;
}
