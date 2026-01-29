// habit-tracker-sw.js
self.addEventListener('install', function(event) {
  console.log('Habit Tracker SW: Installing...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  console.log('Habit Tracker SW: Activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event) {
  console.log('Habit Tracker SW: Message received', event.data);
  
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = event.data.notification;
    
    console.log(`Habit Tracker SW: Scheduling "${title}" in ${delay}ms`);
    
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
        badge: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
        tag: 'habit-reminder',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      });
    }, delay);
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('Habit Tracker SW: Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true})
      .then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes('habit') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});