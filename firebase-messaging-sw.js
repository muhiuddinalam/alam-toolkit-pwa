// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyC3bnvA5ygr0CaR_xJZCor3t1deSS9iUCA",
  authDomain: "calendar-planner-6c3a6.firebaseapp.com",
  projectId: "calendar-planner-6c3a6",
  storageBucket: "calendar-planner-6c3a6.firebasestorage.app",
  messagingSenderId: "491757673096",
  appId: "1:491757673096:web:ea8f89f60f0621e6705d3d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages (app closed)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'AlamToolKit';
  const notificationOptions = {
    body: payload.notification?.body || 'New reminder',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'habit-reminder',
    requireInteraction: true,
    data: payload.data || {},
    actions: [
      {
        action: 'complete',
        title: 'Mark Complete'
      },
      {
        action: 'open',
        title: 'Open App'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click:', event.notification.tag);
  event.notification.close();

  if (event.action === 'complete') {
    // Mark habit as complete
    const habitId = event.notification.data?.habitId;
    if (habitId) {
      // Store in IndexedDB for when app opens
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'COMPLETE_HABIT',
            habitId: habitId
          });
        });
      });
    }
  } else if (event.action === 'open' || !event.action) {
    // Open or focus the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes('alamtoolkit.com') && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('https://app.alamtoolkit.com/habit-and-goal-tracker.html');
          }
        })
    );
  }
});

// Handle periodic sync for reminders (Chrome only)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkScheduledReminders());
  }
});

// Check scheduled reminders (for when app is closed)
async function checkScheduledReminders() {
  // Get reminders from IndexedDB
  const db = await openRemindersDB();
  const reminders = await getAllReminders(db);
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  reminders.forEach(reminder => {
    if (reminder.time === currentTime && reminder.enabled) {
      self.registration.showNotification(`⏰ ${reminder.habitName}`, {
        body: `Time for your habit!`,
        icon: '/icon-192.png',
        tag: `reminder-${reminder.id}`,
        data: { habitId: reminder.habitId }
      });
    }
  });
}

// IndexedDB for storing reminders in service worker
function openRemindersDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('habit-reminders', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('reminders')) {
        db.createObjectStore('reminders', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function getAllReminders(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reminders'], 'readonly');
    const store = transaction.objectStore('reminders');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
