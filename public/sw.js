const CACHE_NAME = 'coco-cache-v4';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Event: Cache essential assets using safe relative paths
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching v4');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Simplified and robust strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Filter out non-origin and API requests from caching
  if (requestUrl.origin !== self.location.origin) return;
  if (
    requestUrl.pathname.includes('/users/') ||
    requestUrl.pathname.includes('firestore.googleapis.com') ||
    requestUrl.pathname.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  // Strategy 1: HTML Navigation - Always fetch from network first.
  // Fallback to cache ONLY when offline (fetch throws error).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.warn('[Service Worker] Navigation fetch failed, serving offline page:', err);
        return caches.match('./index.html') || caches.match('/coco/index.html');
      })
    );
    return;
  }

  // Strategy 2: Cache first with network fallback for assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch((err) => {
          console.warn('[Service Worker] Fetch failed for static asset:', event.request.url, err);
          // Return a safe 404 response to prevent browser ERR_FAILED crash
          return new Response('Asset not found', { status: 404, statusText: 'Offline Resource Not Cached' });
        });
    })
  );
});
