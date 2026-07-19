const CACHE_NAME = 'erp-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/css/style.css',
  '/src/js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});
