// Universal Alarm Service Worker with Push Notifications
const CACHE_NAME = 'alarm-universal-v2';
let alarms = [];
let timerInterval = null;
let wakeLock = null;

self.addEventListener('install', event => {
    console.log('Universal Service Worker installing');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    console.log('Universal Service Worker activating');
    event.waitUntil(self.clients.claim());
});

// Handle messages from main app
self.addEventListener('message', event => {
    console.log('Universal SW received:', event.data.type);
    
    switch (event.data.type) {
        case 'SCHEDULE_ALARM':
            scheduleAlarm(event.data.alarm);
            break;
            
        case 'CANCEL_ALARM':
            cancelAlarm(event.data.alarmId);
            break;
            
        case 'SCHEDULE_TIMER':
            scheduleTimer(event.data.timer);
            break;
            
        case 'REQUEST_WAKE_LOCK':
            requestWakeLock();
            break;
            
        case 'RELEASE_WAKE_LOCK':
            releaseWakeLock();
            break;
    }
});

// Handle push notifications from server
self.addEventListener('push', event => {
    console.log('Push notification received:', event);
    
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = {
            title: '⏰ Alarm Clock',
            body: 'Time to wake up!',
            icon: 'https://www.alamtoolkit.com/icons/alarm-192.png'
        };
    }
    
    const options = {
        body: data.body || 'Time to wake up!',
        icon: data.icon || 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: data.tag || `push-${Date.now()}`,
        requireInteraction: true,
        renotify: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        data: data.data || {}
    };
    
    // Add actions for alarms
    if (data.data && data.data.alarmId) {
        options.actions = [
            { action: 'snooze', title: `😴 Snooze (${data.data.snoozeMinutes || 10}min)` },
            { action: 'dismiss', title: '🛑 Dismiss' }
        ];
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title || '⏰ Alarm Clock', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event.action);
    event.notification.close();
    
    const action = event.action;
    const alarmId = event.notification.data?.alarmId;
    const snoozeMinutes = event.notification.data?.snoozeMinutes || 10;
    
    if (action === 'snooze') {
        // Schedule snoozed alarm
        const snoozeTime = Date.now() + (snoozeMinutes * 60 * 1000);
        scheduleAlarm({
            id: `snooze-${alarmId}-${Date.now()}`,
            label: `Snooze: ${event.notification.data?.label || 'Alarm'}`,
            delay: snoozeMinutes * 60 * 1000,
            sound: event.notification.data?.sound || 'classic',
            volume: event.notification.data?.volume || 70,
            snoozeMinutes: snoozeMinutes,
            isDesktop: true
        });
        
        // Notify client
        notifyClient('ALARM_SNOOZED', { alarmId, snoozeMinutes });
        
    } else if (action === 'dismiss') {
        // Cancel alarm
        cancelAlarm(alarmId);
        notifyClient('ALARM_DISMISSED', { alarmId });
        
    } else {
        // Open app
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(windowClients => {
                    if (windowClients.length > 0) {
                        windowClients[0].focus();
                    } else {
                        clients.openWindow('/');
                    }
                })
        );
    }
});

// Schedule alarm
function scheduleAlarm(alarmData) {
    const alarmId = alarmData.id || 'alarm-' + Date.now();
    const alarmTime = Date.now() + (alarmData.delay || 0);
    
    const alarm = {
        id: alarmId,
        time: alarmTime,
        label: alarmData.label || 'Alarm',
        sound: alarmData.sound || 'classic',
        volume: alarmData.volume || 70,
        snoozeMinutes: alarmData.snoozeMinutes || 10,
        isDesktop: true
    };
    
    alarms.push(alarm);
    console.log('Alarm scheduled:', alarm);
    
    // Start checking alarms if not already
    if (!timerInterval) {
        startAlarmChecker();
    }
    
    // Request wake lock for desktop
    if (alarm.isDesktop) {
        requestWakeLock();
    }
    
    // Notify client
    notifyClient('ALARM_SCHEDULED', { 
        id: alarmId, 
        time: new Date(alarmTime).toLocaleTimeString()
    });
}

// Cancel alarm
function cancelAlarm(alarmId) {
    alarms = alarms.filter(a => a.id !== alarmId);
    console.log('Alarm cancelled:', alarmId);
    
    // Release wake lock if no alarms
    if (alarms.length === 0 && wakeLock) {
        releaseWakeLock();
    }
}

// Schedule timer
function scheduleTimer(timerData) {
    const timerEnd = Date.now() + timerData.duration;
    
    setTimeout(() => {
        triggerTimerFinished();
    }, timerData.duration);
    
    console.log('Timer scheduled:', timerData.duration + 'ms');
}

// Start checking alarms
function startAlarmChecker() {
    timerInterval = setInterval(() => {
        const now = Date.now();
        const dueAlarms = alarms.filter(a => a.time <= now && a.time > now - 60000);
        
        dueAlarms.forEach(alarm => {
            triggerAlarm(alarm);
            cancelAlarm(alarm.id);
        });
        
        // Clean up if no alarms left
        if (alarms.length === 0) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

// Trigger alarm
async function triggerAlarm(alarm) {
    console.log('Alarm triggered:', alarm.id);
    
    // Show notification
    const title = `⏰ ${alarm.label}`;
    const options = {
        body: 'Time to wake up!',
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: `alarm-${alarm.id}`,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        actions: [
            {
                action: 'snooze',
                title: `😴 Snooze (${alarm.snoozeMinutes}min)`
            },
            {
                action: 'dismiss',
                title: '🛑 Dismiss'
            }
        ],
        data: {
            alarmId: alarm.id,
            label: alarm.label,
            sound: alarm.sound,
            volume: alarm.volume,
            snoozeMinutes: alarm.snoozeMinutes,
            isDesktop: true
        }
    };
    
    await self.registration.showNotification(title, options);
    
    // Notify all clients
    notifyClient('ALARM_TRIGGERED', alarm);
    
    // Keep wake lock for desktop
    if (alarm.isDesktop) {
        requestWakeLock();
    }
}

// Trigger timer finished
async function triggerTimerFinished() {
    const title = '⏱️ Timer Finished';
    const options = {
        body: 'Your timer has completed',
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: 'timer-finished',
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200]
    };
    
    await self.registration.showNotification(title, options);
    notifyClient('TIMER_FINISHED', {});
}

// Request wake lock (for desktop)
async function requestWakeLock() {
    if ('wakeLock' in navigator && !wakeLock) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock active');
            
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

// Notify client
function notifyClient(type, data) {
    clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: type,
                data: data
            });
        });
    });
}

// Initial alarm check
startAlarmChecker();
