
const CACHE_NAME = 'vscode-online-v6';

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete ALL existing caches to ensure the app is strictly online-only
  // and remove any potential broken offline files from previous versions.
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Clearing old cache to enforce online mode:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  // Tell the service worker to take control of the page immediately.
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network Only Strategy
  // We strictly pass the request to the network. 
  // If the user is offline, the browser will show the standard "No Internet" page.
  event.respondWith(fetch(event.request));
});
