// ============================================
// ENHANCED SERVICE WORKER FOR ALAM TOOLKIT PWA
// Version: 2.0 - With Push Notifications & Background Sync
// ============================================

const APP_VERSION = '2.0';
const CACHE_NAME = `alam-toolkit-v${APP_VERSION}`;
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// Core URLs to cache on install
const CORE_ASSETS = [
  '/alam-toolkit-pwa/',
  '/alam-toolkit-pwa/index.html',
  '/alam-toolkit-pwa/icon-192.png',
  '/alam-toolkit-pwa/icon-512.png',
  '/alam-toolkit-pwa/manifest.json',
  'https://www.alamtoolkit.com/'
];

// ============================================
// INSTALL EVENT - Cache core assets
// ============================================
self.addEventListener('install', event => {
  console.log(`🚀 Service Worker installing v${APP_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE)
        .then(cache => {
          console.log('📦 Caching core assets...');
          return cache.addAll(CORE_ASSETS);
        }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ]).then(() => {
      console.log('✅ Core assets cached successfully');
    }).catch(error => {
      console.error('❌ Cache installation failed:', error);
    })
  );
});

// ============================================
// ACTIVATE EVENT - Clean up old caches
// ============================================
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete caches that don't match current version
            if (!cacheName.includes(CACHE_NAME)) {
              console.log(`🗑️ Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated successfully');
      // Send message to all clients about activation
      sendMessageToClients({ type: 'SW_ACTIVATED', version: APP_VERSION });
    })
  );
});

// ============================================
// FETCH EVENT - Advanced caching strategies
// ============================================
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests
  if (url.pathname.includes('/api/') || url.pathname.includes('/data/')) {
    // API requests - Network First with cache fallback
    event.respondWith(apiStrategy(request));
  } else if (isStaticAsset(url)) {
    // Static assets - Cache First
    event.respondWith(staticStrategy(request));
  } else if (request.mode === 'navigate') {
    // HTML pages - Network First with offline fallback
    event.respondWith(navigationStrategy(request));
  } else {
    // Everything else - Network First
    event.respondWith(networkFirstStrategy(request));
  }
});

// ============================================
// CACHING STRATEGIES
// ============================================
async function staticStrategy(request) {
  // Cache First for static assets
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    updateCache(request);
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline - Static asset not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fall back to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/alam-toolkit-pwa/index.html');
    }
    
    return new Response('You are offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function apiStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Cache API responses for offline use
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try to get from cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline data structure
    return new Response(JSON.stringify({ 
      offline: true, 
      message: 'You are offline',
      timestamp: Date.now() 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function navigationStrategy(request) {
  try {
    // Try network first for fresh content
    const response = await fetch(request);
    
    // Update cache
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fall back to cached version
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Ultimate fallback to offline page
    return caches.match('/alam-toolkit-pwa/index.html');
  }
}

// Update cache in background
async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response);
    }
  } catch (error) {
    // Silently fail - we have cached version
  }
}

// Helper function to identify static assets
function isStaticAsset(url) {
  const staticExtensions = [
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.ico', '.webp'
  ];
  
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', event => {
  console.log('📨 Push notification received:', event);
  
  let data = {
    title: 'Alam Toolkit',
    body: 'You have a new notification',
    icon: '/alam-toolkit-pwa/icon-192.png',
    badge: '/alam-toolkit-pwa/icon-192.png',
    data: { url: 'https://www.alamtoolkit.com/' }
  };
  
  // Parse push data
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }
  
  // Notification options
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200, 100, 200],
    data: data.data,
    timestamp: Date.now(),
    actions: [
      {
        action: 'open',
        title: '🔓 Open',
        icon: '/alam-toolkit-pwa/icon-192.png'
      },
      {
        action: 'dismiss',
        title: '❌ Dismiss',
        icon: '/alam-toolkit-pwa/icon-192.png'
      }
    ],
    requireInteraction: data.requireInteraction || false
  };
  
  // Show notification
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || 'https://www.alamtoolkit.com/';
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  } else if (event.action === 'dismiss') {
    // Just dismiss - nothing to do
    console.log('Notification dismissed');
  } else {
    // Default click behavior
    event.waitUntil(
      clients.openWindow(urlToOpen)
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('Notification closed:', event.notification);
  // You can log analytics here
});

// ============================================
// BACKGROUND SYNC
// ============================================
self.addEventListener('sync', event => {
  console.log('🔄 Background sync event:', event.tag);
  
  switch (event.tag) {
    case 'sync-data':
      event.waitUntil(syncPendingData());
      break;
      
    case 'sync-analytics':
      event.waitUntil(syncAnalyticsData());
      break;
      
    case 'sync-settings':
      event.waitUntil(syncUserSettings());
      break;
      
    default:
      console.log(`Unknown sync tag: ${event.tag}`);
  }
});

// Sync pending data when online
async function syncPendingData() {
  try {
    const pendingRequests = await getPendingRequests();
    console.log(`📊 Syncing ${pendingRequests.length} pending requests`);
    
    for (const request of pendingRequests) {
      try {
        await fetch(request.url, request.options);
        await removePendingRequest(request.id);
        console.log(`✅ Synced request: ${request.id}`);
      } catch (error) {
        console.error(`❌ Failed to sync request ${request.id}:`, error);
      }
    }
    
    // Send success message to clients
    sendMessageToClients({
      type: 'SYNC_COMPLETE',
      success: true,
      count: pendingRequests.length
    });
    
  } catch (error) {
    console.error('Sync failed:', error);
    sendMessageToClients({
      type: 'SYNC_COMPLETE',
      success: false,
      error: error.message
    });
  }
}

// Sync analytics data
async function syncAnalyticsData() {
  const pendingAnalytics = JSON.parse(localStorage.getItem('analyticsQueue') || '[]');
  
  if (pendingAnalytics.length === 0) return;
  
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: pendingAnalytics })
    });
    
    // Clear queue after successful sync
    localStorage.removeItem('analyticsQueue');
    console.log(`📈 Synced ${pendingAnalytics.length} analytics events`);
    
  } catch (error) {
    console.error('Analytics sync failed:', error);
  }
}

// Sync user settings
async function syncUserSettings() {
  const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
  
  if (Object.keys(settings).length === 0) return;
  
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    console.log('⚙️ User settings synced');
    
  } catch (error) {
    console.error('Settings sync failed:', error);
  }
}

// Helper functions for background sync
async function getPendingRequests() {
  const db = await openRequestDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(['requests'], 'readonly');
    const store = transaction.objectStore('requests');
    const requests = store.getAll();
    
    requests.onsuccess = () => resolve(requests.result || []);
    requests.onerror = () => resolve([]);
  });
}

async function removePendingRequest(id) {
  const db = await openRequestDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(['requests'], 'readwrite');
    const store = transaction.objectStore('requests');
    store.delete(id);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
  });
}

async function openRequestDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alam-toolkit-sync', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('requests')) {
        const store = db.createObjectStore('requests', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// ============================================
// PERIODIC SYNC (for regular updates)
// ============================================
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-content') {
    console.log('🕐 Periodic sync triggered for content update');
    event.waitUntil(updateContent());
  }
});

async function updateContent() {
  try {
    // Update cached content
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response);
        }
      } catch (error) {
        // Continue with next request
      }
    }
    
    console.log('✅ Content updated via periodic sync');
    
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

// ============================================
// MESSAGE HANDLING (Communication with clients)
// ============================================
self.addEventListener('message', event => {
  console.log('📨 Message from client:', event.data);
  
  switch (event.data?.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: APP_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'SEND_NOTIFICATION':
      self.registration.showNotification(
        event.data.title || 'Alam Toolkit',
        event.data.options || {}
      );
      break;
      
    case 'REGISTER_SYNC':
      self.registration.sync.register(event.data.tag)
        .then(() => {
          event.ports[0]?.postMessage({ success: true });
        })
        .catch(error => {
          event.ports[0]?.postMessage({ success: false, error: error.message });
        });
      break;
  }
});

// Send message to all clients
async function sendMessageToClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

// Health check
async function performHealthCheck() {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const keys = await cache.keys();
    return {
      healthy: true,
      cacheSize: keys.length,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
}

// ============================================
// OFFLINE FALLBACK PAGE GENERATOR
// ============================================
const OFFLINE_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alam Toolkit - Offline</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 20px;
        }
        p {
            font-size: 1.2em;
            margin-bottom: 30px;
            opacity: 0.9;
        }
        .icon {
            font-size: 4em;
            margin-bottom: 20px;
        }
        .reload-btn {
            background: white;
            color: #667eea;
            border: none;
            padding: 15px 30px;
            font-size: 1.1em;
            border-radius: 50px;
            cursor: pointer;
            font-weight: bold;
            transition: transform 0.3s ease;
        }
        .reload-btn:hover {
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📡</div>
        <h1>You're Offline</h1>
        <p>Alam Toolkit needs an internet connection to load new content. 
           Basic features may still work offline.</p>
        <button class="reload-btn" onclick="location.reload()">Try Again</button>
    </div>
</body>
</html>
`;

// Store offline page in cache if needed
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.put(
        new Request('/alam-toolkit-pwa/offline.html'),
        new Response(OFFLINE_PAGE, {
          headers: { 'Content-Type': 'text/html' }
        })
      );
    })
  );
}, { once: true });

// ============================================
// ERROR HANDLING
// ============================================
self.addEventListener('error', event => {
  console.error('Service Worker error:', event.error);
  
  // Send error to analytics if possible
  sendMessageToClients({
    type: 'SW_ERROR',
    error: event.error?.message,
    timestamp: Date.now()
  });
});

// Log all fetch errors for debugging
self.addEventListener('fetch', event => {
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch (error) {
        console.error(`Fetch failed for ${event.request.url}:`, error);
        throw error;
      }
    })()
  );
});

// ============================================
// INITIALIZATION COMPLETE
// ============================================
console.log('✅ Enhanced Service Worker loaded successfully');
