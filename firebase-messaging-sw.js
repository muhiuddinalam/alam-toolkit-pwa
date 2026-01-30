// Firebase Messaging Service Worker for AlamToolKit

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
    apiKey: "AIzaSyC3bnvA5ygr0CaR_xJZCor3t1deSS9iUCA",
    authDomain: "calendar-planner-6c3a6.firebaseapp.com",
    projectId: "calendar-planner-6c3a6",
    storageBucket: "calendar-planner-6c3a6.firebasestorage.app",
    messagingSenderId: "491757673096",
    appId: "1:491757673096:web:ea8f89f60f0621e6705d3d"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'AlamToolKit';
    const notificationOptions = {
        body: payload.notification?.body || 'New reminder',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: payload.data || {}
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
            // Check if there's already a window/tab open with the app
            for (const client of clientList) {
                if (client.url.includes('alamtoolkit.com') && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow('https://app.alamtoolkit.com');
            }
        })
    );
});
