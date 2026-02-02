// Service Worker for AlamToolKit PWA
const CACHE_NAME = 'alamtoolkit-v1.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-144.png',
  '/icon-384.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiTYK2BOaBRKxfg4Nfw8uJSAQg445JJJmsrnkPDbSOaX5L2Ll1mU2lH2bS9_w32QzAPLBtDjY3QpCbcny2u4yFgwDzC6RrdIU2pk5GJBIHwugVvfy5Rl2l2VJNJNzudCyOxXTXr9PSM_beQMZBCFfgOvpNXPp4sFpWwQi745PYoTkoppOJcxWkIF13y2Sg/s320/AlamToolKit.webp',
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjSN4QcZ0Ll_NjXLClD3XLfjDQF4Gz-pcFmW18UqASsu9F4idfUpPXYLr9Mm5wstqupoxBFRRe0NJt80iRgUymXEUaMTSnQHqtDyGun5x4AqUYgXjiUMwjyHAFaYUyVrrnJjsnmESeotCQCh4B3MnwMZnOF1iw98pd-RBwBU0aBpkrZk4hLKK9HFrm6dlA/s1600/AlamToolKit.webp'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS)
          .then(() => {
            console.log('Service Worker: All static assets cached');
            return self.skipWaiting();
          })
          .catch(err => {
            console.log('Service Worker: Cache addAll error:', err);
          });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return cachedResponse;
        }
        
        // Otherwise, fetch from network
        return fetch(event.request)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.log('Service Worker: Fetch failed; returning offline page', error);
            
            // If offline and request is for HTML, return offline page
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL)
                .then(offlineResponse => offlineResponse || new Response('You are offline'));
            }
            
            // Return a generic offline response for other types
            return new Response('Network error occurred', {
              status: 408,
              statusText: 'Network error'
            });
          });
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', event => {
  if (event.tag === 'sync-tools') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(
      // Add your sync logic here
      Promise.resolve()
    );
  }
});

// Push notification event
self.addEventListener('push', event => {
  console.log('Service Worker: Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'New tools available!',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      dateOfArrival: Date.now()
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore Tools'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('AlamToolKit', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else {
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// ============ ALARM SYSTEM ============

const ALARM_DB_NAME = 'rasAlarmDB';
const ALARM_STORE_NAME = 'alarms';

// Initialize IndexedDB for alarms
async function initAlarmDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ALARM_DB_NAME, 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(ALARM_STORE_NAME)) {
        const store = db.createObjectStore(ALARM_STORE_NAME, { keyPath: 'id' });
        store.createIndex('nextDueMs', 'nextDueMs', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Save alarm to IndexedDB
async function saveAlarm(alarm) {
  const db = await initAlarmDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ALARM_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(ALARM_STORE_NAME);
    const request = store.put(alarm);
    
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}

// Get all pending alarms
async function getPendingAlarms() {
  const db = await initAlarmDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ALARM_STORE_NAME], 'readonly');
    const store = transaction.objectStore(ALARM_STORE_NAME);
    const index = store.index('status');
    const request = index.getAll('Pending');
    
    request.onsuccess = (e) => resolve(e.target.result || []);
    request.onerror = (e) => reject(e);
  });
}

// Check and trigger due alarms
async function checkAndTriggerAlarms() {
  try {
    const alarms = await getPendingAlarms();
    const now = Date.now();
    
    for (const alarm of alarms) {
      if (alarm.nextDueMs <= now) {
        await triggerAlarmNotification(alarm);
        
        // Update for repeating alarms
        if (alarm.repeat !== 'none') {
          alarm.nextDueMs = calculateNextOccurrence(alarm);
          await saveAlarm(alarm);
        } else {
          alarm.status = 'Triggered';
          await saveAlarm(alarm);
        }
      }
    }
  } catch (error) {
    console.error('Alarm check failed:', error);
  }
}

// Trigger notification
async function triggerAlarmNotification(alarm) {
  const options = {
    body: alarm.notes || 'Time for your reminder!',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: `alarm-${alarm.id}`,
    renotify: true,
    requireInteraction: alarm.priority >= 4,
    vibrate: alarm.vibrate ? [200, 100, 200, 100, 200] : [],
    data: { 
      alarmId: alarm.id, 
      type: 'alarm',
      timestamp: Date.now()
    },
    actions: [
      { action: 'snooze', title: `Snooze ${alarm.snoozeMins}min` },
      { action: 'complete', title: 'Mark Done' }
    ]
  };
  
  await self.registration.showNotification(alarm.title, options);
  
  // Play sound if enabled
  if (alarm.soundEnabled) {
    clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PLAY_SOUND',
          alarmId: alarm.id
        });
      });
    });
  }
}

// Calculate next occurrence
function calculateNextOccurrence(alarm) {
  const current = alarm.nextDueMs;
  const now = Date.now();
  let next = current;
  
  while (next <= now) {
    if (alarm.repeat === 'daily') {
      next += 24 * 60 * 60 * 1000;
    } else if (alarm.repeat === 'weekly') {
      next += 7 * 24 * 60 * 60 * 1000;
    } else if (alarm.repeat === 'custom') {
      next += alarm.intervalMs;
    } else {
      break;
    }
  }
  
  return next;
}

// ============ SERVICE WORKER EVENTS ============

// Periodic sync for alarms
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'alarm-check') {
    event.waitUntil(checkAndTriggerAlarms());
  }
});

// Message from main app
self.addEventListener('message', (event) => {
  if (event.data.type === 'SAVE_ALARM') {
    event.waitUntil(saveAlarm(event.data.alarm));
  } else if (event.data.type === 'CHECK_ALARMS_NOW') {
    event.waitUntil(checkAndTriggerAlarms());
  }
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'snooze') {
    event.waitUntil(snoozeAlarm(event.notification.data.alarmId));
  } else if (event.action === 'complete') {
    event.waitUntil(markAlarmComplete(event.notification.data.alarmId));
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            return clientList[0].focus();
          }
          return clients.openWindow('/');
        })
    );
  }
});

// Helper functions
async function snoozeAlarm(alarmId) {
  const db = await initAlarmDB();
  const alarm = await getAlarmFromDB(db, alarmId);
  
  if (alarm) {
    alarm.nextDueMs = Date.now() + (alarm.snoozeMins * 60000);
    alarm.status = 'Pending';
    await saveAlarm(alarm);
    
    self.registration.showNotification('Alarm Snoozed', {
      body: `Alarm snoozed for ${alarm.snoozeMins} minutes`,
      icon: '/icon-192.png',
      tag: 'snooze-confirm'
    });
  }
}

async function markAlarmComplete(alarmId) {
  const db = await initAlarmDB();
  const alarm = await getAlarmFromDB(db, alarmId);
  
  if (alarm) {
    alarm.status = 'Completed';
    await saveAlarm(alarm);
  }
}

function getAlarmFromDB(db, alarmId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ALARM_STORE_NAME], 'readonly');
    const store = transaction.objectStore(ALARM_STORE_NAME);
    const request = store.get(alarmId);
    
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e);
  });
}

// Periodic background checks (every 5 minutes)
setInterval(() => {
  checkAndTriggerAlarms();
}, 5 * 60 * 1000);

// Initial check
checkAndTriggerAlarms();    

// Message event for communication with pages
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

