// ============================================
// UNIVERSAL SERVICE WORKER FOR DESKTOP NOTIFICATIONS
// ============================================

const CACHE_NAME = 'alarm-universal-v2';
let alarms = [];
let timerInterval = null;
let wakeLock = null;
let scheduledAlarms = new Map();

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
            
        case 'TEST_NOTIFICATION':
            triggerTestNotification(event.data);
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
    const alarmTime = alarmData.targetTime || (Date.now() + alarmData.delay);
    const delay = Math.max(0, alarmTime - Date.now());
    
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
    
    // Clear existing alarm with same ID
    if (scheduledAlarms.has(alarmId)) {
        clearTimeout(scheduledAlarms.get(alarmId));
        scheduledAlarms.delete(alarmId);
    }
    
    // Remove from alarms array
    alarms = alarms.filter(a => a.id !== alarmId);
    alarms.push(alarm);
    
    console.log('Alarm scheduled:', alarm.label, 'in', Math.round(delay/1000), 'seconds');
    
    // Schedule the alarm
    if (delay > 0) {
        const timeoutId = setTimeout(() => {
            triggerAlarm(alarm);
        }, delay);
        
        scheduledAlarms.set(alarmId, timeoutId);
    }
    
    // Notify client
    notifyClient('ALARM_SCHEDULED', { 
        id: alarmId, 
        time: new Date(alarmTime).toLocaleTimeString()
    });
}

// Cancel alarm
function cancelAlarm(alarmId) {
    if (scheduledAlarms.has(alarmId)) {
        clearTimeout(scheduledAlarms.get(alarmId));
        scheduledAlarms.delete(alarmId);
    }
    
    alarms = alarms.filter(a => a.id !== alarmId);
    console.log('Alarm cancelled:', alarmId);
}

// Schedule timer
function scheduleTimer(timerData) {
    const timerId = timerData.id || 'timer-' + Date.now();
    const duration = timerData.duration || 0;
    
    setTimeout(() => {
        triggerTimerFinished(timerId);
    }, duration);
    
    console.log('Timer scheduled:', duration + 'ms');
}

// Trigger alarm
async function triggerAlarm(alarm) {
    console.log('Alarm triggered:', alarm.id, 'Label:', alarm.label);
    
    // Show notification
    const title = `⏰ ${alarm.label}`;
    const options = {
        body: `Time: ${new Date().toLocaleTimeString()}`,
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
                action: 'stop',
                title: '🛑 Stop'
            }
        ],
        data: {
            alarmId: alarm.id,
            type: 'alarm',
            sound: alarm.sound,
            volume: alarm.volume,
            label: alarm.label,
            snoozeMinutes: alarm.snoozeMinutes
        }
    };
    
    await self.registration.showNotification(title, options);
    
    // Notify all clients
    notifyClient('ALARM_TRIGGERED', alarm);
    
    // Handle repeat alarms
    if (alarm.repeat && alarm.repeat !== 'once') {
        let nextTime;
        const now = new Date();
        
        if (alarm.repeat === 'daily') {
            nextTime = new Date(alarm.time + (24 * 60 * 60 * 1000));
        } else if (alarm.repeat === 'weekdays') {
            nextTime = new Date(alarm.time + (24 * 60 * 60 * 1000));
            while (nextTime.getDay() === 0 || nextTime.getDay() === 6) {
                nextTime = new Date(nextTime.getTime() + (24 * 60 * 60 * 1000));
            }
        }
        
        if (nextTime) {
            scheduleAlarm({
                ...alarm,
                id: alarm.id,
                targetTime: nextTime.getTime()
            });
        }
    }
}

// Trigger timer finished
async function triggerTimerFinished(timerId) {
    const title = '⏱️ Timer Finished';
    const options = {
        body: 'Your timer has completed!',
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: `timer-${timerId}`,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        data: {
            type: 'timer',
            timerId: timerId
        }
    };
    
    await self.registration.showNotification(title, options);
    notifyClient('TIMER_FINISHED', { timerId });
}

// Trigger test notification
async function triggerTestNotification(data) {
    const title = '🔔 Test Notification';
    const options = {
        body: 'This is a test notification from AlamToolkit',
        icon: 'https://www.alamtoolkit.com/icons/alarm-192.png',
        badge: 'https://www.alamtoolkit.com/icons/badge-96.png',
        tag: `test-${Date.now()}`,
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
        data: {
            type: 'test',
            sound: data.sound || 'classic'
        }
    };
    
    await self.registration.showNotification(title, options);
}

// Request wake lock (for keeping system awake)
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
    const snoozeMinutes = event.notification.data?.snoozeMinutes || 10;
    
    if (action === 'snooze' && alarmId) {
        // Find and snooze alarm
        const alarm = alarms.find(a => a.id === alarmId);
        if (alarm) {
            const snoozeTime = Date.now() + (snoozeMinutes * 60 * 1000);
            scheduleAlarm({
                id: `snooze-${alarmId}-${Date.now()}`,
                label: `Snooze: ${alarm.label}`,
                targetTime: snoozeTime,
                sound: alarm.sound,
                volume: alarm.volume,
                snoozeMinutes: alarm.snoozeMinutes,
                repeat: 'once'
            });
            
            // Notify client
            notifyClient('ALARM_SNOOZED', { 
                alarmId: alarmId,
                snoozeMinutes: snoozeMinutes 
            });
        }
    } else if (action === 'stop' && alarmId) {
        // Handle stop
        cancelAlarm(alarmId);
        notifyClient('ALARM_STOPPED', { alarmId });
    }
    
    // Focus the app window
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                if (windowClients.length > 0) {
                    windowClients[0].focus();
                } else {
                    clients.openWindow('https://www.alamtoolkit.com/');
                }
            })
    );
});

// Handle notification close
self.addEventListener('notificationclose', event => {
    console.log('Notification closed:', event.notification.tag);
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

// Start checking for missed alarms on activation
self.addEventListener('activate', event => {
    event.waitUntil(
        clients.claim().then(() => {
            console.log('Service Worker activated and controlling clients');
        })
    );
});
