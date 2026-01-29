// Minimal Service Worker for Blogger
const CACHE_NAME = 'blogger-pwa-v1';

// Only cache essential pages
const CACHE_URLS = [
  '/', // Homepage
  // Add specific post URLs if needed
];

self.addEventListener('install', function(event) {
  console.log('Service Worker installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker activating...');
  // Take control immediately
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
  // Very simple - only cache homepage
  if (event.request.url === 'https://www.alamtoolkit.com/' || 
      event.request.url === 'https://www.alamtoolkit.com') {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request).then(function(fetchResponse) {
          // Cache the homepage
          return caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
  // For all other requests, just fetch normally
});
