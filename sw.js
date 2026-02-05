// ============================================
// ENHANCED SERVICE WORKER WITH FIREBASE FCM
// Alam Toolkit PWA - Version 3.0
// ============================================

const APP_VERSION = '3.0';
const CACHE_NAME = `alam-toolkit-v${APP_VERSION}`;
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;

// Import Firebase for Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// YOUR FIREBASE CONFIG (use your existing config)
const firebaseConfig = {
  apiKey: "AIzaSyC3bnvA5ygr0CaR_xJZCor3t1deSS9iUCA",
  authDomain: "calendar-planner-6c3a6.firebaseapp.com",
  projectId: "calendar-planner-6c3a6",
  storageBucket: "calendar-planner-6c3a6.firebasestorage.app",
  messagingSenderId: "491757673096",
  appId: "1:491757673096:web:ea8f89f60f0621e6705d3d"
};

// Initialize Firebase
let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('✅ Firebase initialized in Service Worker');
} catch (error) {
  console.log('Firebase already initialized or error:', error);
}

// ============================================
// FIREBASE CLOUD MESSAGING HANDLERS
// ============================================

// Background message handler (app closed/in background)
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('📨 Received background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'Alam Toolkit';
    const notificationOptions = {
      body: payload.notification?.body || 'New update available!',
      icon: '/alam-toolkit-pwa/icon-192.png',
      badge: '/alam-toolkit-pwa/icon-192.png',
      image: payload.notification?.image || payload.data?.image || null,
      data: payload.data || { 
        url: payload.data?.url || 'https://www.alamtoolkit.com/',
        type: payload.data?.type || 'general',
        postId: payload.data?.postId || '',
        timestamp: Date.now()
      },
      vibrate: [200, 100, 200, 100, 200],
      tag: payload.data?.tag || 'alam-notification',
      requireInteraction: payload.data?.important || false,
      actions: [
        {
          action: 'open',
          title: 'Open Tool',
          icon: '/alam-toolkit-pwa/icon-192.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/alam-toolkit-pwa/icon-192.png'
        }
      ],
      timestamp: payload.data?.timestamp || Date.now()
    };

    // Show the notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Foreground push handler (app open)
self.addEventListener('push', (event) => {
  console.log('📨 Push event received in foreground');
  
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { 
      notification: {
        title: 'Alam Toolkit',
        body: event.data?.text() || 'New update available!'
      },
      data: { url: 'https://www.alamtoolkit.com/' }
    };
  }

  const options = {
    body: data.notification?.body || data.body || 'New update from Alam Toolkit',
    icon: '/alam-toolkit-pwa/icon-192.png',
    badge: '/alam-toolkit-pwa/icon-192.png',
    data: data.data || { url: 'https://www.alamtoolkit.com/' },
    vibrate: [100, 50, 100],
    tag: data.data?.tag || 'push-notification',
    actions: [
      { action: 'open', title: 'Open', icon: '/alam-toolkit-pwa/icon-192.png' },
      { action: 'close', title: 'Dismiss', icon: '/alam-toolkit-pwa/icon-192.png' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.notification?.title || data.title || 'Alam Toolkit',
      options
    )
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || 'https://www.alamtoolkit.com/';
  const action = event.action || 'open';

  if (action === 'open') {
    event.waitUntil(
      clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      }).then((clientList) => {
        // Check for existing window
        for (const client of clientList) {
          if (client.url.includes('alamtoolkit.com') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
  
  // Send analytics
  sendAnalyticsEvent('notification_click', {
    action: event.action,
    notificationType: event.notification.data?.type,
    url: urlToOpen
  });
});

// ============================================
// ENHANCED CACHING STRATEGY
// ============================================

const CORE_ASSETS = [
  '/alam-toolkit-pwa/',
  '/alam-toolkit-pwa/index.html',
  '/alam-toolkit-pwa/icon-192.png',
  '/alam-toolkit-pwa/icon-512.png',
  '/alam-toolkit-pwa/manifest.json',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js',
  'https://www.alamtoolkit.com/'
];

// Install Event
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker installing v' + APP_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching core assets...');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.includes(CACHE_NAME)) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker ready v' + APP_VERSION);
      // Notify all open tabs
      sendMessageToAllClients({ 
        type: 'SW_ACTIVATED', 
        version: APP_VERSION 
      });
    })
  );
});

// Enhanced Fetch Handler
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET and non-http requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }
  
  // For Blogger/Blogspot URLs, use network first
  if (url.hostname.includes('blogger.com') || 
      url.hostname.includes('blogspot.com') ||
      url.pathname.includes('/feeds/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // For static assets, use cache first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // For HTML pages, use stale-while-revalidate
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  
  // Default: network first with cache fallback
  event.respondWith(networkFirst(request));
});

// Caching Strategies
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    updateCache(request);
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fallback to cache
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // For navigation requests, show offline page
    if (request.mode === 'navigate') {
      return caches.match('/alam-toolkit-pwa/index.html');
    }
    
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Return cached immediately
  const fetchPromise = fetch(request).then((response) => {
    // Update cache with fresh response
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {
    // Network failed - keep cached version
    console.log('Network failed, using cached version');
  });
  
  return cachedResponse || fetchPromise;
}

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

function isStaticAsset(url) {
  const staticExtensions = [
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.ico', '.webp'
  ];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// ============================================
// BACKGROUND SYNC & OFFLINE CAPABILITIES
// ============================================

self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync event:', event.tag);
  
  if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalyticsData());
  } else if (event.tag === 'sync-settings') {
    event.waitUntil(syncUserSettings());
  } else if (event.tag === 'retry-failed-requests') {
    event.waitUntil(retryFailedRequests());
  }
});

async function syncAnalyticsData() {
  const pendingAnalytics = JSON.parse(
    localStorage.getItem('alamtoolkit_analytics_queue') || '[]'
  );
  
  if (pendingAnalytics.length === 0) return;
  
  try {
    await fetch('https://api.alamtoolkit.com/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        events: pendingAnalytics,
        timestamp: Date.now()
      })
    });
    
    // Clear queue on success
    localStorage.removeItem('alamtoolkit_analytics_queue');
    console.log(`📊 Synced ${pendingAnalytics.length} analytics events`);
    
  } catch (error) {
    console.error('Analytics sync failed:', error);
  }
}

async function syncUserSettings() {
  const settings = JSON.parse(
    localStorage.getItem('alamtoolkit_user_settings') || '{}'
  );
  
  if (Object.keys(settings).length === 0) return;
  
  try {
    await fetch('https://api.alamtoolkit.com/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    console.log('⚙️ User settings synced');
    
  } catch (error) {
    console.error('Settings sync failed:', error);
  }
}

async function retryFailedRequests() {
  const failedRequests = JSON.parse(
    localStorage.getItem('alamtoolkit_failed_requests') || '[]'
  );
  
  const successfulRequests = [];
  
  for (const request of failedRequests) {
    try {
      await fetch(request.url, request.options);
      successfulRequests.push(request.id);
      console.log(`✅ Retry succeeded: ${request.url}`);
    } catch (error) {
      console.log(`❌ Retry failed: ${request.url}`);
    }
  }
  
  // Remove successful requests
  const updatedFailed = failedRequests.filter(req => 
    !successfulRequests.includes(req.id)
  );
  
  localStorage.setItem(
    'alamtoolkit_failed_requests', 
    JSON.stringify(updatedFailed)
  );
}

// ============================================
// MESSAGE HANDLING & COMMUNICATION
// ============================================

self.addEventListener('message', (event) => {
  console.log('📨 Message from client:', event.data);
  
  switch (event.data?.type) {
    case 'FIREBASE_TOKEN_UPDATE':
      // Store token in IndexedDB for future use
      storeFCMToken(event.data.token);
      break;
      
    case 'SEND_LOCAL_NOTIFICATION':
      self.registration.showNotification(
        event.data.title || 'Alam Toolkit',
        event.data.options || {}
      );
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo().then(info => {
        event.ports[0]?.postMessage(info);
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
  }
});

async function storeFCMToken(token) {
  // Store in IndexedDB
  const db = await openIndexedDB();
  const tx = db.transaction('fcm_tokens', 'readwrite');
  const store = tx.objectStore('fcm_tokens');
  
  await store.put({
    id: 'current_token',
    token: token,
    timestamp: Date.now(),
    userAgent: navigator.userAgent
  });
  
  console.log('✅ FCM token stored in IndexedDB');
}

async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alam_toolkit_db', 2);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('fcm_tokens')) {
        db.createObjectStore('fcm_tokens', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('offline_data')) {
        db.createObjectStore('offline_data', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function getCacheInfo() {
  const cacheNames = await caches.keys();
  let totalSize = 0;
  let totalItems = 0;
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    totalItems += keys.length;
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  
  return {
    cacheCount: cacheNames.length,
    totalItems: totalItems,
    totalSize: formatBytes(totalSize),
    version: APP_VERSION
  };
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('🧹 All caches cleared');
}

// ============================================
// ANALYTICS & ERROR TRACKING
// ============================================

function sendAnalyticsEvent(eventName, data = {}) {
  const event = {
    name: eventName,
    data: data,
    timestamp: Date.now(),
    url: self.location.href,
    userAgent: navigator.userAgent
  };
  
  // Queue for background sync
  const queue = JSON.parse(
    localStorage.getItem('alamtoolkit_analytics_queue') || '[]'
  );
  queue.push(event);
  localStorage.setItem('alamtoolkit_analytics_queue', JSON.stringify(queue));
  
  // Register sync
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.sync.register('sync-analytics');
    });
  }
}

// Error tracking
self.addEventListener('error', (event) => {
  sendAnalyticsEvent('service_worker_error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.toString()
  });
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function sendMessageToAllClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// ============================================
// OFFLINE FALLBACK
// ============================================

const OFFLINE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alam Toolkit - Offline</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .container {
            max-width: 500px;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            margin: 20px;
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 20px;
            color: white;
        }
        p {
            font-size: 1.2em;
            line-height: 1.6;
            margin-bottom: 30px;
            opacity: 0.9;
        }
        .offline-icon {
            font-size: 4em;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        button {
            background: white;
            color: #667eea;
            border: none;
            padding: 15px 30px;
            font-size: 1.1em;
            border-radius: 50px;
            cursor: pointer;
            font-weight: bold;
            transition: transform 0.3s, box-shadow 0.3s;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        .features {
            text-align: left;
            margin-top: 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        .features h3 {
            margin-top: 0;
        }
        .features ul {
            padding-left: 20px;
        }
        .features li {
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="offline-icon">📡</div>
        <h1>You're Offline</h1>
        <p>Don't worry! Alam Toolkit still works offline. Some features may be limited, but you can access previously loaded tools.</p>
        
        <div class="features">
            <h3>📋 Available Offline:</h3>
            <ul>
                <li>Recently used tools</li>
                <li>Saved calculations</li>
                <li>App settings</li>
                <li>Basic functionality</li>
            </ul>
        </div>
        
        <button onclick="location.reload()">⟳ Try Again</button>
        <p style="margin-top: 20px; font-size: 0.9em; opacity: 0.7;">
            Connection will be restored automatically
        </p>
    </div>
</body>
</html>
`;

// Cache offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.put(
        new Request('/alam-toolkit-pwa/offline.html'),
        new Response(OFFLINE_HTML, {
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'max-age=604800'
          }
        })
      );
    })
  );
}, { once: true });

// ============================================
// INITIALIZATION
// ============================================

console.log(`✅ Alam Toolkit Service Worker v${APP_VERSION} loaded with Firebase FCM`);
console.log('🔥 Firebase Config Loaded:', firebaseConfig.projectId);
