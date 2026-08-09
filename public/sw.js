const CACHE_NAME = 'recipe-pwa-v3';
const URLS_TO_CACHE = [
  '/recipe-pwa/',
  '/recipe-pwa/index.html',
  '/recipe-pwa/manifest.json',
  '/recipe-pwa/icon-180.png',
  '/recipe-pwa/icon-192.png',
  '/recipe-pwa/icon-512.png',
  '/recipe-pwa/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/recipe-pwa/index.html', responseToCache));
          return response;
        })
        .catch(() => caches.match('/recipe-pwa/index.html'))
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        return caches.match('/recipe-pwa/index.html');
      });
    })
  );
});
