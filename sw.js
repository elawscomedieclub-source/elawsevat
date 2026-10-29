const CACHE_NAME = 'evat-elaws-v343-quantum-cache';
const urlsToCache = [
  'index.html',
  'style.css',
  'app.js',
  'elaws.js',
  'manifest.webmanifest'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Force l'activation immédiate du nouveau SW
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName); // Nettoie les anciens caches
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
