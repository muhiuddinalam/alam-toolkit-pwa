// ============================================
// COMPLETE SERVICE WORKER FOR ALAM TOOLKIT
// Version: 5.0 - Auto Notifications + Firebase FCM
// ============================================

const APP_VERSION = '5.0';
const CACHE_NAME = `alam-toolkit-v${APP_VERSION}`;
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// Import Firebase for background messages
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase Config (will be updated by client)
let firebaseConfig = {
  apiKey: "AIzaSyC3bnvA5ygr0CaR_xJZCor3t1deSS9iUCA",
  authDomain: "calendar-planner-6c3a6.firebaseapp.com",
  projectId: "calendar-planner-6c3a6",
  storageBucket: "calendar-planner-6c3a6.firebasestorage.app",
  messagingSenderId: "491757673096",
  appId: "1:491757673096:web:ea8f89f60f0621e6705d3d"
};

let messaging = null;

// ============================================
// FIREBASE FCM BACKGROUND HANDLER
// ============================================
function initializeFirebaseInSW() {
  try {
    if (typeof firebase !== 'undefined') {
      firebase.initializeApp(firebaseConfig);
      messaging = firebase.messaging();
      console.log('✅ Firebase initialized in Service Worker');

      // Handle background messages (app closed)
      messaging.onBackgroundMessage((payload) => {
        console.log('📨 Background message received:', payload);
        
        const notificationTitle = payload.notification?.title || 'Alam Toolkit';
        const notificationOptions = {
          body: payload.notification?.body || 'New content available!',
          icon: 'https://raw.githubusercontent.com/muhiuddinalam/alam-toolkit-pwa/main/icon-192.png',
          badge: 'https://raw.githubusercontent.com/muhiuddinalam/alam-toolkit-pwa/main/icon-192.png',
          data: payload.data || { 
            url: payload.data?.url || 'https://www.alamtoolkit.com/',
            postId: payload.data?.postId || '',
            action: 'open_post'
          },
          vibrate: [200, 100, 200],
          tag: 'alam-toolkit-notification',
          requireInteraction: payload.data?.important || false,
          actions: [
            {
              action: 'open',
              title: 'Open',
              icon: 'https://raw.githubusercontent.com/muhiuddinalam/alam-toolkit-pwa/main/icon-192.png'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ],
          timestamp: Date.now()
        };

        // Add image if available
        if (payload.notification?.image) {
          notificationOptions.image = payload.notification.image;
        }

        return self.registration.showNotification(notificationTitle, notificationOptions);
      });
    }
  } catch (error) {
    console.log('Firebase SW init:', error);
  }
}

// Initialize Firebase immediately
initializeFirebaseInSW();

// ============================================
// NOTIFICATION CLICK HANDLER
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  let urlToOpen = 'https://www.alamtoolkit.com/';
  
  // Determine URL based on notification data
  if (event.notification.data) {
    if (event.notification.data.url) {
      urlToOpen = event.notification.data.url;
    } else if (event.notification.data.postId) {
      urlToOpen = `https://www.alamtoolkit.com/${event.notification.data.postId}`;
    }
  }
  
  // Handle action buttons
  if (event.action === 'open') {
    event.waitUntil(openUrl(urlToOpen));
  } else if (event.action === 'dismiss') {
    // Just dismiss
  } else {
    // Default click
    event.waitUntil(openUrl(urlToOpen));
  }
});

async function openUrl(url) {
  const clients = await self.clients.matchAll({ 
    type: 'window', 
    includeUncontrolled: true 
  });
  
  // Check if window is already open
  for (const client of clients) {
    if (client.url === url && 'focus' in client) {
      return client.focus();
    }
  }
  
  // Open new window
  if (clients.openWindow) {
    return clients.openWindow(url);
  }
}

// ============================================
// CORE ASSETS TO CACHE
// ============================================
const CORE_ASSETS = [
  '/alam-toolkit-pwa/',
  '/alam-toolkit-pwa/index.html',
  '/alam-toolkit-pwa/icon-192.png',
  '/alam-toolkit-pwa/icon-512.png',
  '/alam-toolkit-pwa/manifest.json',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js'
];

// ============================================
// INSTALL EVENT
// ============================================
self.addEventListener('install', (event) => {
  console.log(`🚀 Service Worker installing v${APP_VERSION}`);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching core assets...');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('✅ Core assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Cache installation failed:', error);
      })
  );
});

// ============================================
// ACTIVATE EVENT
// ============================================
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.includes(CACHE_NAME)) {
              console.log(`🗑️ Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker ready');
      // Notify all clients
      sendMessageToClients({ type: 'SW_ACTIVATED', version: APP_VERSION });
    })
  );
});

// ============================================
// FETCH EVENT - SMART CACHING STRATEGY
// ============================================
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET') return;
  
  // Handle different content types
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
  } else {
    event.respondWith(networkFirstStrategy(request));
  }
});

// Cache First for static assets
async function cacheFirstStrategy(request) {
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
    return new Response('Offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Network First for API calls
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful API responses
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    return new Response(JSON.stringify({ 
      offline: true, 
      timestamp: Date.now() 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Navigation strategy
async function navigationStrategy(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Return offline page
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
    // Silent fail
  }
}

// Helper functions
function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.ico', '.webp'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

function isAPIRequest(url) {
  return url.pathname.includes('/api/') || url.pathname.includes('/feeds/');
}

// ============================================
// BACKGROUND SYNC
// ============================================
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  switch (event.tag) {
    case 'sync-new-content':
      event.waitUntil(syncNewContent());
      break;
    case 'sync-notifications':
      event.waitUntil(syncNotificationQueue());
      break;
    case 'sync-analytics':
      event.waitUntil(syncAnalyticsData());
      break;
  }
});

async function syncNewContent() {
  console.log('Syncing new content...');
  // This would fetch new posts/tools
}

async function syncNotificationQueue() {
  const queue = await getNotificationQueue();
  
  for (const notification of queue) {
    try {
      // Send notification to subscribed users
      await processNotification(notification);
      await removeFromQueue(notification.id);
    } catch (error) {
      console.error('Failed to sync notification:', error);
    }
  }
}

async function syncAnalyticsData() {
  const analytics = JSON.parse(localStorage.getItem('alam-analytics') || '[]');
  
  if (analytics.length > 0) {
    try {
      // Send analytics to your endpoint
      await fetch('https://www.alamtoolkit.com/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: analytics })
      });
      localStorage.removeItem('alam-analytics');
    } catch (error) {
      console.error('Analytics sync failed:', error);
    }
  }
}

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', (event) => {
  console.log('📨 Message from client:', event.data);
  
  switch (event.data?.type) {
    case 'SEND_NOTIFICATION':
      sendNotificationFromSW(event.data.payload);
      break;
      
    case 'UPDATE_FIREBASE_CONFIG':
      updateFirebaseConfig(event.data.config);
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CHECK_FOR_UPDATES':
      checkForContentUpdates();
      break;
      
    case 'GET_STATUS':
      event.ports[0]?.postMessage({
        version: APP_VERSION,
        firebase: !!messaging,
        clients: event.data.clientCount || 0
      });
      break;
  }
});

async function sendNotificationFromSW(payload) {
  try {
    await self.registration.showNotification(
      payload.title || 'Alam Toolkit',
      {
        body: payload.body || 'New update',
        icon: 'https://raw.githubusercontent.com/muhiuddinalam/alam-toolkit-pwa/main/icon-192.png',
        badge: 'https://raw.githubusercontent.com/muhiuddinalam/alam-toolkit-pwa/main/icon-192.png',
        data: payload.data || { url: 'https://www.alamtoolkit.com/' },
        tag: payload.tag || 'direct-notification',
        requireInteraction: payload.important || false
      }
    );
    return true;
  } catch (error) {
    console.error('Notification failed:', error);
    return false;
  }
}

function updateFirebaseConfig(config) {
  if (config && config.apiKey) {
    firebaseConfig = config;
    initializeFirebaseInSW();
  }
}

async function checkForContentUpdates() {
  try {
    const response = await fetch('https://www.alamtoolkit.com/feeds/posts/default?alt=json&max-results=1');
    const data = await response.json();
    
    // Check if new content is available
    const latestPost = data.feed.entry[0];
    const lastChecked = localStorage.getItem('last_checked_post');
    
    if (latestPost.id.$t !== lastChecked) {
      // New content detected
      sendMessageToClients({
        type: 'NEW_CONTENT_AVAILABLE',
        post: latestPost
      });
      
      localStorage.setItem('last_checked_post', latestPost.id.$t);
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
async function sendMessageToClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    try {
      client.postMessage(message);
    } catch (error) {
      console.log('Message failed to client:', error);
    }
  });
}

async function getNotificationQueue() {
  const db = await openNotificationDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(['notifications'], 'readonly');
    const store = transaction.objectStore('notifications');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

async function removeFromQueue(id) {
  const db = await openNotificationDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    store.delete(id);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
  });
}

async function openNotificationDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alam-notifications', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('status', 'status');
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function processNotification(notification) {
  // This would send to Firebase or other service
  console.log('Processing notification:', notification);
  
  // For now, just show locally
  if (self.registration) {
    await self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon || 'https://raw.githubusercontent.com/muhiuddinalam/alam-toolkit-pwa/main/icon-192.png',
      data: notification.data
    });
  }
}

// ============================================
// PERIODIC TASK - CHECK FOR UPDATES
// ============================================
async function checkPeriodicUpdates() {
  // Check for new content every 2 hours
  const lastCheck = parseInt(localStorage.getItem('last_update_check') || '0');
  const now = Date.now();
  
  if (now - lastCheck > 2 * 60 * 60 * 1000) {
    await checkForContentUpdates();
    localStorage.setItem('last_update_check', now.toString());
  }
}

// Run periodic check when service worker starts
checkPeriodicUpdates();
setInterval(checkPeriodicUpdates, 30 * 60 * 1000); // Every 30 minutes

// ============================================
// INITIALIZATION
// ============================================
console.log(`✅ Alam Toolkit Service Worker v${APP_VERSION} loaded`);
