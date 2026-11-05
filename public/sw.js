// FESTIVAL CLOTHING POS - Service Worker
// Powered by WISDO TECH
// Provides safe caching of static application assets while ensuring
// live network access for API, Supabase PostgreSQL, and WhatsApp Cloud operations.

const CACHE_NAME = 'festival-pos-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.png',
  '/logo_transparent.png',
  '/products/shirt.jpg',
  '/products/pant.jpg',
  '/products/tshirt.jpg',
  '/products/half_sleeve.jpg',
  '/products/full_sleeve.jpg',
  '/products/shorts.jpg',
  '/products/custom_item.jpg',
];

// Install: Pre-cache static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some static assets failed to pre-cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first for dynamic and API requests, Cache-fallback for static shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER intercept non-GET requests or backend/database calls
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('facebook.com') ||
    url.hostname.includes('graph.facebook.com')
  ) {
    return;
  }

  // For HTML navigations: Network first, fall back to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Stale-while-revalidate for local static assets (JS, CSS, images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

