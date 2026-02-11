// ============================================
// UNIVERSAL SERVICE WORKER - MOBILE & DESKTOP
// ============================================

const CACHE_NAME = 'alarm-universal-v3';
let scheduledAlarms = {};
let wakeLock = null;

self.addEventListener('install', event => {
    console.log('Universal Service Worker installing');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Universal Service Worker activating');
    event.waitUntil(self.clients.claim());
});

// Handle messages from main app
self.addEventListener('message', event => {
    console.log('SW received:', event.data.type);
    
    switch (event.data.type) {
        case 'SCHEDULE_ALARM':
            scheduleAlarm(event.data.alarm);
            break;
        case 'CANCEL_ALARM':
            cancelAlarm(event.data.alarmId);
            break;
        case 'TEST_NOTIFICATION':
            showTestNotification();
            break;
        case 'REQUEST_WAKE_LOCK':
            requestWakeLock();
            break;
        case 'RELEASE_WAKE_LOCK':
            releaseWakeLock();
            break;
    }
});

// Schedule alarm
function scheduleAlarm(alarm) {
    const alarmId = alarm.id;
    const alarmTime = alarm.targetTime;
    const now = Date.now();
    const delay = Math.max(0, alarmTime - now);
    
    console.log(`Scheduling alarm "${alarm.label}" in ${Math.round(delay/1000)}s (Mobile: ${alarm.isMobile})`);
    
    if (scheduledAlarms[alarmId]) {
        clearTimeout(scheduledAlarms[alarmId]);
        delete scheduledAlarms[alarmId];
    }
    
    if (delay > 0) {
        const timeoutId = setTimeout(() => {
            triggerAlarm(alarm);
            delete scheduledAlarms[alarmId];
        }, delay);
        
        scheduledAlarms[alarmId] = timeoutId;
        return true;
    }
    return false;
}

// Cancel alarm
function cancelAlarm(alarmId) {
    if (scheduledAlarms[alarmId]) {
        clearTimeout(scheduledAlarms[alarmId]);
        delete scheduledAlarms[alarmId];
        console.log('Cancelled alarm:', alarmId);
        return true;
    }
    return false;
}

// Trigger alarm
async function triggerAlarm(alarm) {
    console.log('🔔 ALARM TRIGGERED:', alarm.label, 'Mobile:', alarm.isMobile);
    
    // Always show notification
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
            volume: alarm.volume || 70,
            isMobile: alarm.isMobile || false
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
        console.log('✓ Notification shown');
        
        // Notify all clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'ALARM_TRIGGERED',
                alarm: alarm
            });
        });
        
        // Request wake lock for mobile
        if (alarm.isMobile) {
            requestWakeLock();
        }
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
}

// Request wake lock (keeps device awake and allows audio)
async function requestWakeLock() {
    if ('wakeLock' in navigator && !wakeLock) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('✓ Wake Lock active - device will stay awake');
            
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
                wakeLock = null;
            });
        } catch (err) {
            console.error('Wake Lock failed:', err);
        }
    }
}

// Release wake lock
function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Wake Lock released');
    }
}

// Show test notification
async function showTestNotification() {
    const title = '🔔 Test Notification';
    const options = {
        body: 'Alarm system is working!',
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: 'test-' + Date.now(),
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200]
    };
    
    await self.registration.showNotification(title, options);
}

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event.action);
    event.notification.close();
    
    const alarmId = event.notification.data?.alarmId;
    const snoozeMinutes = event.notification.data?.snoozeMinutes || 10;
    const isMobile = event.notification.data?.isMobile || false;
    
    if (event.action === 'snooze' && alarmId) {
        const snoozeTime = Date.now() + (snoozeMinutes * 60 * 1000);
        
        scheduleAlarm({
            id: `snooze-${alarmId}-${Date.now()}`,
            label: `Snooze: ${event.notification.data?.label || 'Alarm'}`,
            targetTime: snoozeTime,
            snoozeDuration: snoozeMinutes,
            sound: event.notification.data?.sound || 'beep',
            volume: event.notification.data?.volume || 70,
            isMobile: isMobile
        });
        
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
    
    if (event.action === 'stop' && alarmId) {
        cancelAlarm(alarmId);
        
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

console.log('Universal Service Worker loaded');
