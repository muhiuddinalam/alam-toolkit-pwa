// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC3bnvA5ygr0CaR_xJZCor3t1deSS9iUCA",
  authDomain: "calendar-planner-6c3a6.firebaseapp.com",
  projectId: "calendar-planner-6c3a6",
  storageBucket: "calendar-planner-6c3a6.firebasestorage.app",
  messagingSenderId: "491757673096",
  appId: "1:491757673096:web:ea8f89f60f0621e6705d3d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || '⏰ Alarm!';
  const notificationOptions = {
    body: payload.notification?.body || 'Your alarm is ringing!',
    icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208720.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3208/3208720.png',
    tag: 'alarm-notification',
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: payload.data || {}
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://www.alamtoolkit.com/alarm-clock.html')
  );
});
