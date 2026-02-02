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

// Message event for communication with pages
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


