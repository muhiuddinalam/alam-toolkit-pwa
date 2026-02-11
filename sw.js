// Service Worker for AlamToolkit Alarm Clock
// Save as sw.js in your site root

const CACHE_NAME = 'alarm-clock-v4';
const CACHE_FILES = [
  '/',
  '/alarm-clock',
  '/icons/alarm-192.png',
  '/icons/badge-96.png',
  '/icons/icon-512.png',
  '/sounds/beep.mp3',
  '/sounds/chime.mp3'
];

// Install event
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell');
        return cache.addAll(CACHE_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
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
        return fetch(event.request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return response;
        });
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  console.log('Push notification received:', event);
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'Alarm!',
    icon: '/icons/alarm-192.png',
    badge: '/icons/badge-96.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'alarm-notification',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'snooze', title: 'Snooze', icon: '/icons/snooze.png' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
    ],
    data: {
      url: self.location.origin,
      alarmId: data.alarmId,
      deviceId: data.deviceId
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Alarm Clock', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const urlToOpen = new URL(event.notification.data.url || self.location.origin).href;
  
  if (event.action === 'snooze') {
    // Handle snooze
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
          clients[0].postMessage({
            type: 'NOTIFICATION_ACTION',
            action: 'snooze',
            alarmId: event.notification.data.alarmId
          });
        } else {
          self.clients.openWindow(urlToOpen);
        }
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
    // User clicked notification body
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

// Background sync event
self.addEventListener('sync', event => {
  if (event.tag === 'alarm-sync') {
    console.log('Background sync for alarms');
    event.waitUntil(syncAlarms());
  }
});

// Periodic sync event
self.addEventListener('periodicsync', event => {
  if (event.tag === 'alarm-check') {
    console.log('Periodic sync for alarm check');
    event.waitUntil(checkScheduledAlarms());
  }
});

// Message event from main thread
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  switch (event.data.type) {
    case 'SCHEDULE_ALARM':
      scheduleAlarmInSW(event.data.data);
      break;
      
    case 'ALARM_TRIGGERED':
      // Forward to other clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          if (client.id !== event.source.id) {
            client.postMessage({
              type: 'ALARM_TRIGGERED',
              ...event.data.data
            });
          }
        });
      });
      break;
      
    case 'ALARM_SNOOZED':
    case 'ALARM_DISMISSED':
    case 'ALARM_TOGGLE':
    case 'ALARM_DELETED':
      // Forward to other clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: event.data.type,
            ...event.data.data
          });
        });
      });
      break;
  }
});

// Helper functions
async function syncAlarms() {
  const cache = await caches.open(CACHE_NAME);
  // Sync logic here
}

async function checkScheduledAlarms() {
  // Check and trigger scheduled alarms
}

function scheduleAlarmInSW(alarm) {
  const alarmTime = new Date(alarm.time);
  const now = new Date();
  
  // Set date for alarm
  alarmTime.setDate(now.getDate());
  alarmTime.setMonth(now.getMonth());
  alarmTime.setFullYear(now.getFullYear());
  
  // If alarm time is in the past, schedule for tomorrow
  if (alarmTime < now) {
    alarmTime.setDate(alarmTime.getDate() + 1);
  }
  
  const delay = alarmTime.getTime() - now.getTime();
  
  if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Max 24 hours
    setTimeout(() => {
      self.registration.showNotification(`Alarm: ${alarm.label}`, {
        body: `Time: ${alarm.time}`,
        tag: `alarm-${alarm.id}`,
        requireInteraction: true,
        actions: [
          { action: 'snooze', title: 'Snooze' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      });
      
      // Notify all clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'ALARM_TRIGGERED',
            alarmId: alarm.id,
            alarmData: alarm
          });
        });
      });
    }, delay);
  }
}

// Network status handling
self.addEventListener('message', event => {
  if (event.data.type === 'NETWORK_STATUS') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NETWORK_STATUS',
          online: event.data.online
        });
      });
    });
  }
});
