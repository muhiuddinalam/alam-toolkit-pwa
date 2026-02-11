// Service Worker for Guaranteed Alarm Notifications
// Save as sw-alarm.js in your site root

const CACHE_NAME = 'alarm-notifications-v1';
const ALARM_SOUNDS = [
  '/sounds/beep.mp3',
  '/sounds/chime.mp3'
];

// Install event
self.addEventListener('install', event => {
  console.log('Service Worker installing for alarm notifications...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ALARM_SOUNDS))
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('Service Worker activating for alarm notifications...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Background alarm checking
let scheduledAlarms = new Map();

// Handle messages from main thread
self.addEventListener('message', event => {
  const { type, data } = event.data || {};
  
  console.log('Service Worker received:', type, data);
  
  switch (type) {
    case 'SCHEDULE_ALARM':
      scheduleAlarmNotification(data);
      break;
      
    case 'ALARM_TRIGGERED':
      // Show notification immediately
      showAlarmNotification(data.alarmData, data.deviceId);
      
      // Also forward to other clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          if (client.id !== event.source.id) {
            client.postMessage({
              type: 'ALARM_TRIGGERED',
              alarmId: data.alarmId,
              alarmData: data.alarmData,
              deviceId: data.deviceId
            });
          }
        });
      });
      break;
      
    case 'ALARM_SNOOZED':
      // Cancel scheduled alarm and reschedule
      cancelScheduledAlarm(data.alarmId);
      break;
      
    case 'ALARM_DISMISSED':
      // Cancel scheduled alarm
      cancelScheduledAlarm(data.alarmId);
      break;
      
    case 'NOTIFICATION_CLICKED':
      // Focus the app when notification is clicked
      self.clients.matchAll({type: 'window'}).then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        }
      });
      break;
  }
});

// Schedule alarm notification
function scheduleAlarmNotification(data) {
  const { alarm, delay, deviceId } = data;
  
  if (!alarm || !alarm.id) {
    console.error('Invalid alarm data');
    return;
  }
  
  console.log(`Scheduling alarm "${alarm.label}" for ${delay}ms`);
  
  // Cancel existing alarm with same ID
  cancelScheduledAlarm(alarm.id);
  
  // Schedule new alarm
  const timeoutId = setTimeout(() => {
    console.log(`Alarm triggered: ${alarm.label} at ${alarm.time}`);
    
    // Show notification
    showAlarmNotification(alarm, deviceId);
    
    // Notify all clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'ALARM_TRIGGERED',
          alarmId: alarm.id,
          alarmData: alarm,
          deviceId: deviceId
        });
      });
    });
    
    // Remove from scheduled alarms
    scheduledAlarms.delete(alarm.id);
    
  }, delay);
  
  // Store timeout ID for cancellation
  scheduledAlarms.set(alarm.id, timeoutId);
  
  // Also show a confirmation notification
  self.registration.showNotification('⏰ Alarm Scheduled', {
    body: `${alarm.label} set for ${alarm.time}`,
    icon: '/icons/alarm-192.png',
    tag: `scheduled-${alarm.id}`,
    silent: true
  });
}

// Cancel scheduled alarm
function cancelScheduledAlarm(alarmId) {
  const timeoutId = scheduledAlarms.get(alarmId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledAlarms.delete(alarmId);
    console.log(`Cancelled alarm: ${alarmId}`);
  }
}

// Show alarm notification
function showAlarmNotification(alarm, deviceId) {
  const options = {
    body: `Time: ${alarm.time}`,
    icon: '/icons/alarm-192.png',
    badge: '/icons/badge-96.png',
    tag: `alarm-${alarm.id}-${Date.now()}`, // Unique tag
    requireInteraction: true,
    renotify: false,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      alarmId: alarm.id,
      deviceId: deviceId,
      url: self.location.origin,
      timestamp: Date.now()
    }
  };
  
  // Add actions if alarm has snooze
  if (alarm.snoozeDuration > 0) {
    options.actions = [
      { 
        action: 'snooze', 
        title: `😴 Snooze (${alarm.snoozeDuration} min)`,
        icon: '/icons/snooze.png'
      },
      { 
        action: 'dismiss', 
        title: '✓ Dismiss',
        icon: '/icons/dismiss.png'
      }
    ];
  }
  
  self.registration.showNotification(`⏰ ${alarm.label}`, options)
    .then(() => {
      console.log(`Notification shown for alarm: ${alarm.label}`);
    })
    .catch(error => {
      console.error('Error showing notification:', error);
    });
}

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();
  
  const { alarmId, deviceId, url } = event.notification.data || {};
  
  // Handle action buttons
  if (event.action === 'snooze') {
    // Snooze the alarm
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: 'snooze',
            alarmId: alarmId,
            deviceId: deviceId
          });
        });
      })
    );
  } else if (event.action === 'dismiss') {
    // Dismiss the alarm
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: 'dismiss',
            alarmId: alarmId,
            deviceId: deviceId
          });
        });
      })
    );
  } else {
    // User clicked the notification body
    event.waitUntil(
      self.clients.matchAll({type: 'window'}).then(windowClients => {
        if (windowClients.length > 0) {
          windowClients[0].focus();
          windowClients[0].postMessage({
            type: 'NOTIFICATION_CLICKED',
            alarmId: alarmId,
            deviceId: deviceId
          });
        } else {
          self.clients.openWindow(url || self.location.origin);
        }
      })
    );
  }
});

// Periodic background sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'alarm-notifications') {
    console.log('Periodic sync for alarms');
    event.waitUntil(checkScheduledAlarms());
  }
});

// Check scheduled alarms
async function checkScheduledAlarms() {
  console.log('Checking scheduled alarms...');
  
  // You can implement additional checks here
  return Promise.resolve();
}

// Fetch event for offline support
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
