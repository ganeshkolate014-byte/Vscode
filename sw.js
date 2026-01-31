
const CACHE_NAME = 'vscode-pwa-v5';
const OFFLINE_URL = './index.html';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force this new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache essential files for offline use
      return cache.addAll([
        './',
        OFFLINE_URL,
        './manifest.json'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients immediately
});

self.addEventListener('fetch', (event) => {
  // 1. Handle Navigation Requests (HTML)
  // Strategy: Network First. If network fails OR returns 404/500, fallback to cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If the server returns a valid page, return it
          if (response && response.status === 200) {
            return response;
          }
          // If server returns 404 or other error, fallback to cache
          // This catch block handles the specific Vercel/Static host 404s
          return caches.match(OFFLINE_URL).then(cachedResponse => {
             return cachedResponse || caches.match('./');
          });
        })
        .catch((error) => {
          console.log('Navigation fetch failed, falling back to cache:', error);
          return caches.match(OFFLINE_URL)
            .then((cachedResponse) => {
               if (cachedResponse) return cachedResponse;
               return caches.match('./');
            });
        })
    );
    return;
  }

  // 2. Handle Asset Requests (JS, CSS, Images)
  // Strategy: Cache First, then Network (and update cache)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Check for valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache the new asset for next time
        if (event.request.url.startsWith('http') && event.request.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }

        return networkResponse;
      }).catch(err => {
         console.error('Fetch failed for asset:', event.request.url);
      });
    })
  );
});
