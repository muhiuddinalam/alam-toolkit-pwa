// ==================== SERVICE WORKER - SW.JS ====================
// Save this as sw.js in your Blogger site root
// This handles background alarms and notifications

const CACHE_NAME = 'alarm-clock-v1';
const CACHE_FILES = [
    '/',
    '/alarm-clock',
    '/icons/alarm-192.png',
    '/icons/badge-96.png'
];

// Install event
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching app shell');
                return cache.addAll(CACHE_FILES);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// ==================== PUSH NOTIFICATIONS ====================

// Push event - This triggers when app is in background
self.addEventListener('push', event => {
    console.log('Service Worker: Push received', event);
    
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = {
            title: '⏰ Alarm Clock',
            body: 'Time to wake up!',
            icon: '/icons/alarm-192.png'
        };
    }
    
    const options = {
        body: data.body || 'Alarm!',
        icon: data.icon || '/icons/alarm-192.png',
        badge: '/icons/badge-96.png',
        tag: `push-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: data.data || {},
        actions: [
            { action: 'snooze', title: 'Snooze' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Alarm Clock', options)
            .then(() => {
                // Play notification sound
                playNotificationSound();
            })
    );
});

// Play notification sound in service worker
function playNotificationSound() {
    // Create simple beep sound
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 1);
}

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification clicked', event.action);
    
    event.notification.close();
    
    const action = event.action;
    const notificationData = event.notification.data || {};
    
    // Handle notification actions
    if (action === 'snooze' || action === 'dismiss') {
        // Notify all client pages
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'NOTIFICATION_CLICK',
                        action: action,
                        alarmId: notificationData.alarmId,
                        alarmData: notificationData.alarmData
                    });
                });
            })
        );
    } else {
        // User clicked notification body - open/focus the app
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then(windowClients => {
                if (windowClients.length > 0) {
                    windowClients[0].focus();
                } else {
                    self.clients.openWindow('/');
                }
            })
        );
    }
});

// ==================== BACKGROUND ALARM SCHEDULING ====================

// Store scheduled alarms
let scheduledAlarms = new Map();

// Handle messages from main thread
self.addEventListener('message', event => {
    const { type, data } = event.data || {};
    
    console.log('Service Worker: Message received', type, data);
    
    switch (type) {
        case 'SCHEDULE_ALARM':
            scheduleAlarmInBackground(data.alarm);
            break;
            
        case 'CANCEL_ALARM':
            cancelScheduledAlarm(data.alarmId);
            break;
            
        case 'PING':
            // Respond to ping to confirm service worker is alive
            event.ports[0].postMessage({ type: 'PONG' });
            break;
    }
});

// Schedule alarm in background
function scheduleAlarmInBackground(alarm) {
    if (!alarm || !alarm.delay || alarm.delay <= 0) {
        console.log('Service Worker: Invalid alarm data');
        return;
    }
    
    console.log('Service Worker: Scheduling alarm', alarm.label, 'in', alarm.delay, 'ms');
    
    // Cancel existing alarm if any
    if (scheduledAlarms.has(alarm.id)) {
        clearTimeout(scheduledAlarms.get(alarm.id));
    }
    
    // Schedule new alarm
    const timeoutId = setTimeout(() => {
        triggerBackgroundAlarm(alarm);
    }, alarm.delay);
    
    scheduledAlarms.set(alarm.id, timeoutId);
    
    // Store alarm for persistence
    storeScheduledAlarm(alarm);
}

// Cancel scheduled alarm
function cancelScheduledAlarm(alarmId) {
    if (scheduledAlarms.has(alarmId)) {
        clearTimeout(scheduledAlarms.get(alarmId));
        scheduledAlarms.delete(alarmId);
        console.log('Service Worker: Canceled alarm', alarmId);
    }
    
    // Remove from storage
    removeStoredAlarm(alarmId);
}

// Trigger alarm from background
function triggerBackgroundAlarm(alarm) {
    console.log('Service Worker: Background alarm triggered', alarm.label);
    
    // Show notification
    self.registration.showNotification(`⏰ ${alarm.label}`, {
        body: `Time: ${alarm.time}`,
        icon: '/icons/alarm-192.png',
        badge: '/icons/badge-96.png',
        tag: `alarm-${alarm.id}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: {
            alarmId: alarm.id,
            alarmData: alarm
        },
        actions: [
            { action: 'snooze', title: 'Snooze' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    });
    
    // Notify all client pages
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'ALARM_TRIGGERED',
                alarmId: alarm.id,
                alarmData: alarm
            });
        });
    });
    
    // Clean up
    scheduledAlarms.delete(alarm.id);
    removeStoredAlarm(alarm.id);
}

// Store scheduled alarm for persistence
function storeScheduledAlarm(alarm) {
    const storedAlarms = JSON.parse(localStorage.getItem('sw_scheduled_alarms') || '{}');
    storedAlarms[alarm.id] = {
        ...alarm,
        scheduledTime: Date.now() + alarm.delay
    };
    localStorage.setItem('sw_scheduled_alarms', JSON.stringify(storedAlarms));
}

// Remove stored alarm
function removeStoredAlarm(alarmId) {
    const storedAlarms = JSON.parse(localStorage.getItem('sw_scheduled_alarms') || '{}');
    delete storedAlarms[alarmId];
    localStorage.setItem('sw_scheduled_alarms', JSON.stringify(storedAlarms));
}

// ==================== BACKGROUND SYNC ====================

// Periodic sync for checking missed alarms
self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-alarms') {
        event.waitUntil(checkMissedAlarms());
    }
});

// Check for missed alarms
async function checkMissedAlarms() {
    console.log('Service Worker: Checking for missed alarms');
    
    const storedAlarms = JSON.parse(localStorage.getItem('sw_scheduled_alarms') || '{}');
    const now = Date.now();
    
    for (const [alarmId, alarm] of Object.entries(storedAlarms)) {
        if (alarm.scheduledTime && alarm.scheduledTime <= now) {
            // This alarm should have triggered but didn't
            console.log('Service Worker: Found missed alarm', alarm.label);
            triggerBackgroundAlarm(alarm);
        }
    }
}

// ==================== SERVICE WORKER STARTUP ====================

// Restore scheduled alarms on service worker startup
self.addEventListener('activate', event => {
    event.waitUntil(restoreScheduledAlarms());
});

async function restoreScheduledAlarms() {
    const storedAlarms = JSON.parse(localStorage.getItem('sw_scheduled_alarms') || '{}');
    const now = Date.now();
    
    for (const [alarmId, alarm] of Object.entries(storedAlarms)) {
        if (alarm.scheduledTime && alarm.scheduledTime > now) {
            // Reschedule this alarm
            const delay = alarm.scheduledTime - now;
            scheduleAlarmInBackground({
                ...alarm,
                delay: delay
            });
            console.log('Service Worker: Restored alarm', alarm.label, 'in', delay, 'ms');
        } else {
            // Remove expired alarm
            delete storedAlarms[alarmId];
        }
    }
    
    localStorage.setItem('sw_scheduled_alarms', JSON.stringify(storedAlarms));
}

// ==================== CLIENT CONNECTION ====================

// Handle client connection
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Broadcast to all clients
function broadcastToClients(message) {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage(message);
        });
    });
}

console.log('Service Worker: Loaded and ready');
