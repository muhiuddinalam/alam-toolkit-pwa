// Alam Toolkit Service Worker with Background Alarms
const CACHE_NAME = 'alam-toolkit-alarm-v1';
const OFFLINE_URL = '/offline.html';
const VAPID_KEY = 'BDinNd7RS2Z-jM9zBmGeVotJLK_QHxBG3iABKalVlLlj9VwfciqD_cgNa4rTYskgp1K4tI1yBRQmAJDJiFZAZWI';

// URLs to cache for offline functionality
const urlsToCache = [
  OFFLINE_URL,
  // Add other important pages here
];

// Alarm scheduling in service worker
const scheduledAlarms = new Map();
const MAX_ALARM_DELAY = 15 * 60 * 1000; // 15 minutes max for reliable alarms

// Install service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching offline page');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting on install');
        return self.skipWaiting();
      })
  );
});

// Activate service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch from cache or network with offline fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it can only be used once
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response because it can only be used once
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both fetch and cache fail, show offline page for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
            // For other requests, return a custom offline response
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// ============================================
// BACKGROUND ALARM SYSTEM
// ============================================

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Received message:', event.data.type);
  
  switch (event.data.type) {
    case 'SCHEDULE_ALARM':
      scheduleAlarmNotification(event.data.alarm);
      break;
      
    case 'CANCEL_ALARM':
      cancelAlarm(event.data.alarmId);
      break;
      
    case 'SYNC_ALARMS':
      syncAlarmsWithServer();
      break;
      
    case 'REQUEST_NOTIFICATION_PERMISSION':
      requestNotificationPermission();
      break;
      
    default:
      console.log('[Service Worker] Unknown message type:', event.data.type);
  }
});

// Schedule an alarm notification
function scheduleAlarmNotification(alarm) {
  console.log('[Service Worker] Scheduling alarm:', alarm.id, 'delay:', alarm.delay);
  
  // Calculate delay (max 15 minutes for service worker reliability)
  const delay = Math.min(alarm.delay, MAX_ALARM_DELAY);
  
  if (delay <= 0) {
    console.log('[Service Worker] Alarm delay is zero or negative, triggering immediately');
    triggerAlarmNotification(alarm);
    return;
  }
  
  const timeoutId = setTimeout(() => {
    console.log('[Service Worker] Alarm triggered:', alarm.id);
    triggerAlarmNotification(alarm);
    
    // Clean up
    scheduledAlarms.delete(alarm.id);
    
    // If alarm was scheduled for more than MAX_ALARM_DELAY, reschedule
    if (alarm.delay > MAX_ALARM_DELAY) {
      console.log('[Service Worker] Rescheduling remaining alarm time');
      const newAlarm = {
        ...alarm,
        delay: alarm.delay - MAX_ALARM_DELAY
      };
      scheduleAlarmNotification(newAlarm);
    }
  }, delay);
  
  scheduledAlarms.set(alarm.id, timeoutId);
  console.log('[Service Worker] Alarm scheduled successfully');
}

// Cancel a scheduled alarm
function cancelAlarm(alarmId) {
  console.log('[Service Worker] Canceling alarm:', alarmId);
  const timeoutId = scheduledAlarms.get(alarmId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledAlarms.delete(alarmId);
    console.log('[Service Worker] Alarm canceled successfully');
  } else {
    console.log('[Service Worker] Alarm not found for cancellation:', alarmId);
  }
}

// Trigger an alarm notification
function triggerAlarmNotification(alarm) {
  console.log('[Service Worker] Showing alarm notification for:', alarm.id);
  
  const timeString = `${alarm.hours.toString().padStart(2, '0')}:${alarm.minutes.toString().padStart(2, '0')}`;
  const bodyText = alarm.label 
    ? `${alarm.label} - ${timeString}`
    : `Alarm at ${timeString}`;
  
  const options = {
    body: bodyText,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `alarm-${alarm.id}`,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    actions: [
      {
        action: 'snooze',
        title: '⏰ Snooze (10 min)',
        icon: '/icons/snooze.png'
      },
      {
        action: 'dismiss',
        title: '❌ Dismiss',
        icon: '/icons/dismiss.png'
      }
    ],
    data: {
      alarmId: alarm.id,
      alarmTime: timeString,
      alarmLabel: alarm.label || 'Alarm',
      timestamp: Date.now(),
      url: self.location.origin
    }
  };
  
  self.registration.showNotification('⏰ Alarm Clock', options)
    .then(() => console.log('[Service Worker] Notification shown successfully'))
    .catch(error => console.error('[Service Worker] Error showing notification:', error));
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================

// Handle push notifications from server
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Alarm Clock',
        body: event.data.text() || 'Alarm is ringing!'
      };
    }
  }
  
  const options = {
    body: data.body || 'Alarm is ringing!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'alarm-push-notification',
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    actions: [
      {
        action: 'snooze',
        title: 'Snooze'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      ...data,
      timestamp: Date.now(),
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '⏰ Alarm Clock', options)
      .then(() => console.log('[Service Worker] Push notification shown'))
      .catch(error => console.error('[Service Worker] Error showing push notification:', error))
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  event.notification.close();

  const notificationData = event.notification.data || {};
  
  switch (event.action) {
    case 'snooze':
      // Handle snooze action
      console.log('[Service Worker] Snooze clicked for alarm:', notificationData.alarmId);
      
      // Send message to main thread to handle snooze
      event.waitUntil(
        self.clients.matchAll({ type: 'window' })
          .then((clients) => {
            if (clients.length > 0) {
              const client = clients[0];
              client.postMessage({
                type: 'SNOOZE_ALARM',
                alarmId: notificationData.alarmId,
                snoozeDuration: 10 // 10 minutes
              });
              return client.focus();
            } else {
              // If no clients are open, open the app
              return self.clients.openWindow('/');
            }
          })
      );
      break;
      
    case 'dismiss':
      // Handle dismiss action
      console.log('[Service Worker] Dismiss clicked for alarm:', notificationData.alarmId);
      
      // Send message to main thread to handle dismiss
      event.waitUntil(
        self.clients.matchAll({ type: 'window' })
          .then((clients) => {
            if (clients.length > 0) {
              const client = clients[0];
              client.postMessage({
                type: 'DISMISS_ALARM',
                alarmId: notificationData.alarmId
              });
            }
          })
      );
      break;
      
    default:
      // Default click action - focus or open the app
      console.log('[Service Worker] Default notification click');
      event.waitUntil(
        self.clients.matchAll({ 
          type: 'window',
          includeUncontrolled: true 
        })
          .then((clients) => {
            // Check if there's already a window/tab open with the app
            const client = clients.find(c => 
              c.url.includes(self.location.origin) && 'focus' in c
            );
            
            if (client) {
              // Focus existing window
              console.log('[Service Worker] Focusing existing client');
              return client.focus();
            } else {
              // Open new window
              console.log('[Service Worker] Opening new client window');
              return self.clients.openWindow('/');
            }
          })
          .catch(error => {
            console.error('[Service Worker] Error handling notification click:', error);
            return self.clients.openWindow('/');
          })
      );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
  // You could log analytics here
});

// ============================================
// BACKGROUND SYNC
// ============================================

// Background sync for alarms
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync event:', event.tag);
  
  if (event.tag === 'sync-alarms') {
    event.waitUntil(
      syncAlarmsWithServer()
        .then(() => {
          console.log('[Service Worker] Background sync completed successfully');
          // Show notification to user
          return self.registration.showNotification('Alarm Clock', {
            body: 'Alarms synced successfully',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'sync-complete'
          });
        })
        .catch(error => {
          console.error('[Service Worker] Background sync failed:', error);
          // Retry sync later
          return self.registration.sync.register('sync-alarms');
        })
    );
  }
});

// Sync alarms with server (Firebase)
async function syncAlarmsWithServer() {
  console.log('[Service Worker] Syncing alarms with server');
  
  const clients = await self.clients.matchAll();
  if (clients.length === 0) {
    console.log('[Service Worker] No clients found for sync');
    return;
  }
  
  // Ask main thread to sync alarms
  clients.forEach(client => {
    client.postMessage({
      type: 'PERFORM_SYNC',
      timestamp: Date.now()
    });
  });
  
  return Promise.resolve();
}

// Periodic sync for checking alarms (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-alarms') {
    console.log('[Service Worker] Periodic sync for alarm checking');
    event.waitUntil(
      checkPendingAlarms()
    );
  }
});

// Check for pending alarms
async function checkPendingAlarms() {
  console.log('[Service Worker] Checking pending alarms');
  
  const clients = await self.clients.matchAll();
  if (clients.length === 0) {
    console.log('[Service Worker] No clients found for alarm check');
    return;
  }
  
  // Ask main thread to check alarms
  clients.forEach(client => {
    client.postMessage({
      type: 'CHECK_ALARMS',
      timestamp: Date.now()
    });
  });
}

// Request notification permission
async function requestNotificationPermission() {
  console.log('[Service Worker] Requesting notification permission');
  
  const clients = await self.clients.matchAll();
  if (clients.length > 0) {
    clients[0].postMessage({
      type: 'REQUEST_NOTIFICATION_PERMISSION'
    });
  }
}

// ============================================
// HEALTH CHECK & CLEANUP
// ============================================

// Clean up old alarms periodically
function cleanupOldAlarms() {
  console.log('[Service Worker] Cleaning up old alarms');
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  // In a real implementation, you would check stored alarms
  // and clean up those older than one day
  console.log('[Service Worker] Cleanup completed');
}

// Run cleanup every hour
setInterval(cleanupOldAlarms, 60 * 60 * 1000);

// Initial cleanup
cleanupOldAlarms();

console.log('[Service Worker] Alam Toolkit Service Worker loaded with background alarms');
