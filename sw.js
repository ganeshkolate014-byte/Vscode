
const CACHE_NAME = 'vscode-pwa-v3';
const OFFLINE_URL = './index.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Explicitly cache index.html
      return cache.add(new Request(OFFLINE_URL, {cache: 'reload'}));
    })
  );
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

self.addEventListener('fetch', (event) => {
  // For navigation requests (like opening the app), try network first, then fallback to index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // For assets, try cache first, then network, then cache the result
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
         // Only cache valid http/https responses
         if (event.request.url.startsWith('http') && event.request.method === 'GET' && networkResponse.status === 200) {
             const responseToCache = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
                 cache.put(event.request, responseToCache);
             });
         }
         return networkResponse;
      });
    })
  );
});
