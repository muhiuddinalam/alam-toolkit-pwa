// Service Worker for AlamToolKit - Host this on GitHub
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'New notification',
    icon: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
    badge: 'https://muhiuddinalam.github.io/alam-toolkit-pwa/icon-192.png',
    tag: 'habit-reminder',
    data: data.data || {},
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

  event.waitUntil(
    self.registration.showNotification(data.title || 'AlamToolKit', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'complete') {
    // Send message to all clients
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'COMPLETE_HABIT',
            habitId: event.notification.data.habitId
          });
        });
      })
    );
  } else {
    // Open the app
    event.waitUntil(
      clients.openWindow('https://app.alamtoolkit.com/habit-and-goal-tracker.html')
    );
  }
});
