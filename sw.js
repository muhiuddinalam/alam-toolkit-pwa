// ============================================
// SIMPLIFIED SERVICE WORKER FOR DESKTOP NOTIFICATIONS
// ============================================

const CACHE_NAME = 'alarm-desktop-v1';
let scheduledAlarms = {};

self.addEventListener('install', event => {
    console.log('Desktop Alarm Service Worker installing');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Desktop Alarm Service Worker activating');
    event.waitUntil(self.clients.claim());
});

// Handle messages from main app
self.addEventListener('message', event => {
    console.log('SW received:', event.data.type);
    
    switch (event.data.type) {
        case 'SCHEDULE_DESKTOP_ALARM':
            scheduleDesktopAlarm(event.data.alarm);
            break;
        case 'CANCEL_DESKTOP_ALARM':
            cancelDesktopAlarm(event.data.alarmId);
            break;
        case 'TEST_DESKTOP_NOTIFICATION':
            showTestNotification();
            break;
    }
});

// Schedule desktop alarm notification
function scheduleDesktopAlarm(alarm) {
    const alarmId = alarm.id;
    const alarmTime = alarm.targetTime;
    const now = Date.now();
    const delay = Math.max(0, alarmTime - now);
    
    console.log(`Scheduling alarm "${alarm.label}" in ${Math.round(delay/1000)} seconds`);
    
    // Clear existing alarm
    if (scheduledAlarms[alarmId]) {
        clearTimeout(scheduledAlarms[alarmId]);
        delete scheduledAlarms[alarmId];
    }
    
    if (delay > 0) {
        const timeoutId = setTimeout(() => {
            triggerDesktopNotification(alarm);
            delete scheduledAlarms[alarmId];
        }, delay);
        
        scheduledAlarms[alarmId] = timeoutId;
        return true;
    }
    return false;
}

// Cancel desktop alarm
function cancelDesktopAlarm(alarmId) {
    if (scheduledAlarms[alarmId]) {
        clearTimeout(scheduledAlarms[alarmId]);
        delete scheduledAlarms[alarmId];
        console.log('Cancelled alarm:', alarmId);
        return true;
    }
    return false;
}

// Trigger desktop notification
async function triggerDesktopNotification(alarm) {
    console.log('🔔 TRIGGERING DESKTOP NOTIFICATION:', alarm.label);
    
    const title = `⏰ ${alarm.label}`;
    const options = {
        body: `Time: ${new Date(alarm.targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: `alarm-${alarm.id}-${Date.now()}`,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        data: {
            alarmId: alarm.id,
            label: alarm.label,
            snoozeMinutes: alarm.snoozeDuration || 10,
            sound: alarm.sound || 'beep',
            volume: alarm.volume || 70
        },
        actions: [
            {
                action: 'snooze',
                title: `😴 Snooze (${alarm.snoozeDuration || 10}min)`
            },
            {
                action: 'stop',
                title: '🛑 Stop'
            }
        ]
    };
    
    try {
        await self.registration.showNotification(title, options);
        console.log('✓ Desktop notification shown successfully');
        
        // Notify all clients that alarm triggered
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'DESKTOP_ALARM_TRIGGERED',
                alarm: alarm
            });
        });
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
}

// Show test notification
async function showTestNotification() {
    console.log('Showing test notification');
    
    const title = '🔔 Desktop Notifications Active';
    const options = {
        body: 'You will receive alarm notifications even when using other browsers!',
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: 'test-' + Date.now(),
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
        data: {
            type: 'test'
        }
    };
    
    try {
        await self.registration.showNotification(title, options);
        console.log('✓ Test notification shown');
    } catch (error) {
        console.error('Test notification failed:', error);
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event.action);
    event.notification.close();
    
    const alarmId = event.notification.data?.alarmId;
    const snoozeMinutes = event.notification.data?.snoozeMinutes || 10;
    
    // Handle snooze action
    if (event.action === 'snooze' && alarmId) {
        const snoozeTime = Date.now() + (snoozeMinutes * 60 * 1000);
        
        // Schedule snoozed alarm
        scheduleDesktopAlarm({
            id: `snooze-${alarmId}-${Date.now()}`,
            label: `Snooze: ${event.notification.data?.label || 'Alarm'}`,
            targetTime: snoozeTime,
            snoozeDuration: snoozeMinutes,
            sound: event.notification.data?.sound || 'beep',
            volume: event.notification.data?.volume || 70
        });
        
        // Notify clients
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'ALARM_SNOOZED',
                    alarmId: alarmId,
                    snoozeMinutes: snoozeMinutes
                });
            });
        });
    }
    
    // Handle stop action
    if (event.action === 'stop' && alarmId) {
        cancelDesktopAlarm(alarmId);
        
        // Notify clients
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'ALARM_STOPPED',
                    alarmId: alarmId
                });
            });
        });
    }
    
    // Focus or open the app
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                if (windowClients.length > 0) {
                    windowClients[0].focus();
                } else {
                    self.clients.openWindow('https://www.alamtoolkit.com/');
                }
            })
    );
});

// Log when notification is closed without action
self.addEventListener('notificationclose', event => {
    console.log('Notification closed without action:', event.notification.tag);
});

console.log('Desktop Alarm Service Worker loaded');
