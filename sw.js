// Alam Toolkit Service Worker with Hybrid Alarm Support
const CACHE_NAME = 'alam-toolkit-v1';
const OFFLINE_URL = '/offline.html';
const ALARMS_CACHE = 'alarms-data-v1';

// Sync tags
const SYNC_TAGS = {
  ALARMS: 'sync-alarms',
  MISSED: 'check-missed-alarms'
};

// Install event - cache offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll([
          OFFLINE_URL,
          '/icon-192.png',
          '/icon-512.png',
          '/favicon.ico'
        ]);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            return cacheName !== CACHE_NAME && 
                   cacheName !== ALARMS_CACHE;
          }).map(cacheName => caches.delete(cacheName))
        );
      })
    ])
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Chrome extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses (except opaque responses)
        if (response.ok) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Network failed - try cache
        return caches.match(event.request)
          .then(response => {
            // Return cached response or offline page
            if (response) {
              return response;
            }
            return caches.match(OFFLINE_URL);
          });
      })
  );
});

// ============================================
// BACKGROUND SYNC FOR ALARMS
// ============================================

// Sync event - handles background sync for alarms
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.ALARMS:
      event.waitUntil(syncAlarmsWithServer());
      break;
      
    case SYNC_TAGS.MISSED:
      event.waitUntil(checkMissedAlarms());
      break;
      
    default:
      // Handle unknown sync tags
      break;
  }
});

// Periodic sync for alarms (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-alarms') {
      event.waitUntil(checkAlarmsPeriodically());
    }
  });
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    data = {
      title: 'Alarm',
      body: event.data?.text() || 'Alarm triggered'
    };
  }
  
  const options = {
    body: data.body || 'Alarm time!',
    icon: data.icon || '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.tag || 'alarm',
    data: data.data || {},
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      {
        action: 'snooze',
        title: '😴 Snooze (10 min)',
        icon: '/snooze-icon.png'
      },
      {
        action: 'dismiss',
        title: '✅ Dismiss',
        icon: '/dismiss-icon.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || '⏰ Alarm',
      options
    )
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Handle button actions
  if (event.action === 'snooze') {
    event.waitUntil(handleSnooze(event.notification));
  } else if (event.action === 'dismiss') {
    event.waitUntil(handleDismiss(event.notification));
  } else {
    // Default click - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(windowClients => {
          // Check if app is already open
          for (const client of windowClients) {
            if (client.url === self.location.origin && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// ============================================
// ALARM MANAGEMENT FUNCTIONS
// ============================================

// Sync alarms with server
async function syncAlarmsWithServer() {
  try {
    // Get local alarms from IndexedDB
    const localAlarms = await getLocalAlarms();
    
    // Filter alarms that need sync (new or updated)
    const alarmsToSync = localAlarms.filter(alarm => {
      return alarm.needSync || 
             (alarm.updatedAt && Date.now() - new Date(alarm.updatedAt).getTime() < 60000);
    });
    
    if (alarmsToSync.length === 0) {
      return;
    }
    
    // Send to server
    const response = await fetch('/api/sync-alarms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        alarms: alarmsToSync,
        timestamp: Date.now()
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Mark as synced
      for (const alarm of alarmsToSync) {
        alarm.needSync = false;
        if (result.updatedAlarms && result.updatedAlarms[alarm.id]) {
          Object.assign(alarm, result.updatedAlarms[alarm.id]);
        }
      }
      
      await saveLocalAlarms(localAlarms);
      console.log('Synced', alarmsToSync.length, 'alarms with server');
    }
    
  } catch (error) {
    console.error('Sync failed:', error);
    
    // Schedule retry
    setTimeout(() => {
      self.registration.sync.register(SYNC_TAGS.ALARMS);
    }, 60000); // Retry in 1 minute
  }
}

// Check missed alarms
async function checkMissedAlarms() {
  try {
    const alarms = await getLocalAlarms();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const missedAlarms = alarms.filter(alarm => {
      if (!alarm.enabled || alarm.triggered) return false;
      
      const triggerTime = new Date(alarm.triggerTime).getTime();
      return triggerTime > oneHourAgo && triggerTime < now;
    });
    
    if (missedAlarms.length > 0) {
      // Show notification about missed alarms
      await self.registration.showNotification('Missed Alarms', {
        body: `You missed ${missedAlarms.length} alarm${missedAlarms.length > 1 ? 's' : ''}. Tap to view.`,
        icon: '/icon-192.png',
        tag: 'missed-alarms',
        requireInteraction: true
      });
      
      // Update alarms as triggered
      for (const alarm of missedAlarms) {
        alarm.triggered = true;
        alarm.lastTriggered = new Date().toISOString();
      }
      
      await saveLocalAlarms(alarms);
    }
    
  } catch (error) {
    console.error('Failed to check missed alarms:', error);
  }
}

// Periodic alarm check
async function checkAlarmsPeriodically() {
  const alarms = await getLocalAlarms();
  const now = Date.now();
  
  for (const alarm of alarms) {
    if (!alarm.enabled || alarm.triggered) continue;
    
    const triggerTime = new Date(alarm.triggerTime).getTime();
    const timeDiff = triggerTime - now;
    
    // If alarm is due within the next 5 minutes
    if (timeDiff > 0 && timeDiff <= 5 * 60 * 1000) {
      // Schedule notification for exact time
      setTimeout(() => {
        if (alarm.enabled && !alarm.triggered) {
          triggerAlarmNotification(alarm);
        }
      }, timeDiff);
    }
  }
}

// Trigger alarm notification
async function triggerAlarmNotification(alarm) {
  const triggerTime = new Date(alarm.triggerTime);
  const timeString = triggerTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  await self.registration.showNotification(`⏰ ${alarm.label}`, {
    body: `Alarm time: ${timeString}`,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: alarm.id,
    data: { alarmId: alarm.id },
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      {
        action: 'snooze',
        title: 'Snooze (10 min)'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  });
  
  // Update alarm as triggered
  const alarms = await getLocalAlarms();
  const alarmIndex = alarms.findIndex(a => a.id === alarm.id);
  if (alarmIndex !== -1) {
    alarms[alarmIndex].triggered = true;
    alarms[alarmIndex].lastTriggered = new Date().toISOString();
    await saveLocalAlarms(alarms);
  }
}

// Handle snooze action
async function handleSnooze(notification) {
  const alarmId = notification.data?.alarmId;
  if (!alarmId) return;
  
  try {
    const alarms = await getLocalAlarms();
    const alarmIndex = alarms.findIndex(a => a.id === alarmId);
    
    if (alarmIndex !== -1) {
      const alarm = alarms[alarmIndex];
      const snoozeMinutes = alarm.snoozeMinutes || 10;
      const newTriggerTime = new Date(Date.now() + snoozeMinutes * 60000);
      
      alarm.triggerTime = newTriggerTime.toISOString();
      alarm.triggered = false;
      alarm.needSync = true;
      alarm.updatedAt = new Date().toISOString();
      
      await saveLocalAlarms(alarms);
      
      // Show confirmation
      await self.registration.showNotification('Alarm Snoozed', {
        body: `Alarm snoozed for ${snoozeMinutes} minutes`,
        icon: '/icon-192.png',
        tag: 'snooze-confirmation'
      });
    }
  } catch (error) {
    console.error('Failed to snooze alarm:', error);
  }
}

// Handle dismiss action
async function handleDismiss(notification) {
  const alarmId = notification.data?.alarmId;
  if (!alarmId) return;
  
  try {
    const alarms = await getLocalAlarms();
    const alarmIndex = alarms.findIndex(a => a.id === alarmId);
    
    if (alarmIndex !== -1) {
      alarms[alarmIndex].triggered = true;
      alarms[alarmIndex].lastTriggered = new Date().toISOString();
      alarms[alarmIndex].needSync = true;
      alarms[alarmIndex].updatedAt = new Date().toISOString();
      
      await saveLocalAlarms(alarms);
    }
  } catch (error) {
    console.error('Failed to dismiss alarm:', error);
  }
}

// ============================================
// INDEXEDDB HELPER FUNCTIONS
// ============================================

// Get local alarms from IndexedDB
async function getLocalAlarms() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alarmsDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('alarms')) {
        db.createObjectStore('alarms', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['alarms'], 'readonly');
      const store = transaction.objectStore('alarms');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result || []);
      };
      
      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Save alarms to IndexedDB
async function saveLocalAlarms(alarms) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alarmsDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['alarms'], 'readwrite');
      const store = transaction.objectStore('alarms');
      
      // Clear existing alarms
      store.clear();
      
      // Add new alarms
      alarms.forEach(alarm => {
        store.put(alarm);
      });
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ============================================
// MESSAGE HANDLING
// ============================================

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const data = event.data;
  
  switch (data.type) {
    case 'REGISTER_ALARM_SYNC':
      self.registration.sync.register(SYNC_TAGS.ALARMS);
      break;
      
    case 'CHECK_MISSED_ALARMS':
      self.registration.sync.register(SYNC_TAGS.MISSED);
      break;
      
    case 'UPDATE_ALARMS':
      if (data.alarms) {
        saveLocalAlarms(data.alarms);
      }
      break;
      
    case 'TRIGGER_ALARM':
      if (data.alarm) {
        triggerAlarmNotification(data.alarm);
      }
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// ============================================
// BACKGROUND TASK SCHEDULING
// ============================================

// Schedule periodic background tasks
function scheduleBackgroundTasks() {
  // Check for missed alarms every hour
  setInterval(() => {
    self.registration.sync.register(SYNC_TAGS.MISSED);
  }, 60 * 60 * 1000);
  
  // Sync alarms every 30 minutes
  setInterval(() => {
    self.registration.sync.register(SYNC_TAGS.ALARMS);
  }, 30 * 60 * 1000);
  
  // Initial sync
  setTimeout(() => {
    self.registration.sync.register(SYNC_TAGS.ALARMS);
    self.registration.sync.register(SYNC_TAGS.MISSED);
  }, 10000);
}

// Start background tasks
scheduleBackgroundTasks();

// ============================================
// PUSH SUBSCRIPTION MANAGEMENT
// ============================================

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(subscription => {
        // Send new subscription to server
        return fetch('/api/update-push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldSubscription: event.oldSubscription,
            newSubscription: subscription
          })
        });
      })
  );
});
