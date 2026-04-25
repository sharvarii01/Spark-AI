const CACHE_NAME = 'spark-ai-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './logo.png',
  './bg.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// For an API-driven app like this, a Network First Strategy is best
// But for static assets, Cache First works flawlessly.
self.addEventListener('fetch', (event) => {
  // If request is for our chat API, skip the cache
  if (event.request.url.includes('/api/chat')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // Update the cache with the newest version from the network
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Only load the old cached version if they are completely offline
        return caches.match(event.request);
      })
  );
});
