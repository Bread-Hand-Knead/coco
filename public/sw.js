const CACHE_NAME = 'coco-cache-v3';
const ASSETS_TO_CACHE = [
  '/coco/',
  '/coco/index.html',
  '/coco/manifest.json',
  '/coco/icon-192.png',
  '/coco/icon-512.png'
];

// Install Event: Cache essential shell assets with absolute paths
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell v3');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup old caches (including v1 and v2)
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

// Fetch Event: Robust caching strategies
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass cloud sync / external APIs (like Firebase, Google APIs) from being cached
  if (
    event.request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.includes('/users/') ||
    requestUrl.pathname.includes('firestore.googleapis.com') ||
    requestUrl.pathname.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  // Strategy 1: Network First for index.html / navigation
  if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('/') || requestUrl.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback - try match exact request, then fallback to cached index.html
          return caches.match(event.request).then((response) => {
            return response || caches.match('/coco/index.html') || caches.match('/coco/');
          });
        })
    );
    return;
  }

  // Strategy 2: Stale-While-Revalidate for static assets (JS, CSS, images) with robust error catch
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in background to update cache
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore background fetch errors
          });
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
          // Return a fallback or a status to prevent rejected promise crash
          return new Response('Asset fetch failed', { status: 488, statusText: 'Network Error' });
        });
    })
  );
});
