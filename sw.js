// ============================================
// UNIVERSAL SERVICE WORKER WITH PUSH NOTIFICATIONS FOR DESKTOP
// ============================================
// Save this file as sw.js in your site root

const CACHE_NAME = 'alarm-universal-v3';
let alarms = [];
let timerInterval = null;
let wakeLock = null;

self.addEventListener('install', event => {
    console.log('Universal Service Worker installing for desktop push');
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
            
        case 'TEST_ALARM':
            triggerTestAlarm();
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
function scheduleAlarm(alarmData) {
    const alarmId = alarmData.id || 'alarm-' + Date.now();
    const alarmTime = Date.now() + alarmData.delay;
    
    const alarm = {
        id: alarmId,
        time: alarmTime,
        label: alarmData.label || 'Alarm',
        sound: alarmData.sound || 'classic',
        volume: alarmData.volume || 70,
        snoozeMinutes: alarmData.snoozeMinutes || 10,
        isDesktop: true,
        repeat: alarmData.repeat || 'once'
    };
    
    alarms.push(alarm);
    console.log('Alarm scheduled for desktop:', alarm);
    
    if (!timerInterval) {
        startAlarmChecker();
    }
    
    notifyClient('ALARM_SCHEDULED', { 
        id: alarmId, 
        time: new Date(alarmTime).toLocaleTimeString()
    });
}

// Cancel alarm
function cancelAlarm(alarmId) {
    alarms = alarms.filter(a => a.id !== alarmId);
    console.log('Alarm cancelled:', alarmId);
    
    if (alarms.length === 0 && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Schedule timer
function scheduleTimer(timerData) {
    const timerEnd = Date.now() + timerData.duration;
    
    setTimeout(() => {
        triggerTimerFinished();
    }, timerData.duration);
    
    console.log('Timer scheduled for desktop:', timerData.duration + 'ms');
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
        
        if (alarms.length === 0 && timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

// Trigger alarm with push notification for desktop
async function triggerAlarm(alarm) {
    console.log('Desktop alarm triggered:', alarm.id);
    
    const title = `⏰ ${alarm.label}`;
    const options = {
        body: `Time: ${new Date().toLocaleTimeString()}${alarm.repeat !== 'once' ? ' (Repeating)' : ''}`,
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: `alarm-${alarm.id}`,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        sound: alarm.sound || 'default',
        actions: [
            {
                action: 'snooze',
                title: `😴 Snooze (${alarm.snoozeMinutes}min)`
            },
            {
                action: 'stop',
                title: '🛑 Stop'
            }
        ],
        data: {
            alarmId: alarm.id,
            type: 'alarm',
            sound: alarm.sound,
            volume: alarm.volume,
            isDesktop: true
        }
    };
    
    await self.registration.showNotification(title, options);
    notifyClient('ALARM_TRIGGERED', alarm);
}

// Trigger test alarm
function triggerTestAlarm() {
    const testAlarm = {
        id: 'test-alarm-' + Date.now(),
        label: 'Test Alarm',
        sound: 'classic',
        volume: 70,
        snoozeMinutes: 5,
        isDesktop: true
    };
    
    notifyClient('TEST_ALARM_TRIGGERED', testAlarm);
    
    self.registration.showNotification('🔔 Test Alarm', {
        body: 'This is a test notification from service worker',
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        requireInteraction: true
    });
}

// Trigger timer finished
async function triggerTimerFinished() {
    const title = '⏱️ Timer Finished';
    const options = {
        body: 'Your timer has completed',
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: 'timer-finished-' + Date.now(),
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200],
        actions: [
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    await self.registration.showNotification(title, options);
    notifyClient('TIMER_FINISHED', {});
}

// Request wake lock
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

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event.action);
    event.notification.close();
    
    const action = event.action;
    const alarmId = event.notification.data?.alarmId;
    
    if (action === 'snooze') {
        const alarm = alarms.find(a => a.id === alarmId);
        if (alarm) {
            const snoozeTime = Date.now() + (alarm.snoozeMinutes * 60 * 1000);
            scheduleAlarm({
                id: `snooze-${alarmId}-${Date.now()}`,
                label: `Snooze: ${alarm.label}`,
                delay: alarm.snoozeMinutes * 60 * 1000,
                sound: alarm.sound,
                volume: alarm.volume,
                snoozeMinutes: alarm.snoozeMinutes,
                isDesktop: true
            });
            
            notifyClient('ALARM_SNOOZED', alarm);
        }
    } else if (action === 'stop' || action === 'dismiss') {
        cancelAlarm(alarmId);
        notifyClient('ALARM_STOPPED', { alarmId });
    }
    
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
});

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

// Initial alarm checker
if (timerInterval) clearInterval(timerInterval);
timerInterval = setInterval(() => {
    const now = Date.now();
    const dueAlarms = alarms.filter(a => a.time <= now && a.time > now - 60000);
    
    dueAlarms.forEach(alarm => {
        triggerAlarm(alarm);
        cancelAlarm(alarm.id);
    });
    
    if (alarms.length === 0) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}, 1000);
