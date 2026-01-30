// Firebase Messaging Service Worker

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Your web app's Firebase configuration
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

// Retrieve Firebase messaging instance
const messaging = firebase.messaging();

// Background message handler (when app is closed)
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'AlamToolKit';
  const notificationOptions = {
    body: payload.notification?.body || 'New reminder',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'snooze',
        title: 'Snooze'
      }
    ]
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle different actions
  if (event.action === 'open') {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('alamtoolkit.com') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('https://app.alamtoolkit.com');
        }
      })
    );
  } else if (event.action === 'snooze') {
    // Handle snooze action (you could implement snooze logic here)
    console.log('Notification snoozed');
  } else {
    // Default click behavior
    event.waitUntil(
      clients.openWindow('https://app.alamtoolkit.com')
    );
  }
});
