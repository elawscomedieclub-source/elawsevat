/* SW optimisé pour EVAT v3.60 Turbo */
const CACHE_NAME = 'evat-elaws-v360-turbo-cache';
const urlsToCache = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'elaws.js',
  'manifest.webmanifest',
  'logo_evat.svg',
  'logo_evat.png',
  'logo_evat_squircle.svg',
  'logo_evat_squircle.png'
];

self.addEventListener('install', event => {
    // Activer immédiatement pour performance
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.error('Erreur SW Install:', err))
    );
});

self.addEventListener('activate', event => {
    // Purger les anciennes caches proprement pour performance
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Stratégie Stale-While-Revalidate pour la performance maximale
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // Mettre à jour le cache en arrière-plan (stale)
                    caches.open(CACHE_NAME).then(cache => {
                        if (event.request.method === 'GET' && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                    });
                    return networkResponse;
                });
                // Renvoyer le cache immédiatement (stale), ou le réseau si pas en cache (validate)
                return cachedResponse || fetchPromise;
            })
            .catch(() => caches.match('index.html')) // Repli hors ligne basique
    );
});
