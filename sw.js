const CACHE_NAME = 'fichaje-v5';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './manifest.json',
    './icons/icon.svg'
];

// Install — cache static assets immediately
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

// Activate — clean old caches & claim clients immediately
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — Network-first strategy so mobile updates immediately
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Network-first for Google Apps Script API calls
    if (url.hostname.includes('script.google.com')) {
        e.respondWith(
            fetch(e.request)
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Network-first for app assets: get fresh version if online, fallback to cache if offline
    e.respondWith(
        fetch(e.request)
            .then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(e.request))
    );
});
