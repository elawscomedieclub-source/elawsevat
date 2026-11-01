const CACHE_NAME = 'evat-continuum-v395';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './logo_evat.svg',
    './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // Network first for API / socket, cache first for assets
    if (e.request.url.includes('onrender.com') || e.request.url.includes('socket.io')) {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
        return;
    }
    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request).then(res => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return res;
            }).catch(() => cached);
        })
    );
});
