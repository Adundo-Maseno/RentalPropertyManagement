/**
 * BomaSphere Property Management System (PMS)
 * Production Progressive Web App (PWA) Service Worker
 * Cache Version: bomasphere-v2.0.0
 */

const CACHE_NAME = 'bomasphere-cache-v3.3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/rentals.html',
  '/styles.css',
  '/app.js?v=3.3',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/404.html',
  '/500.html',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Install Event: Cache Core App Shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[SW] Pre-caching static assets...');
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (err) {
        console.warn('[SW] Some local static assets failed to cache:', err);
      }
    })
  );
});

// Activate Event: Clear Old Cache Versions & Claim Clients Immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for Cache Purge Messages from BomaSphere client
self.addEventListener('message', async event => {
  if (event.data && event.data.action === 'PURGE_API_CACHE') {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      await Promise.all(
        keys
          .filter(k => new URL(k.url).pathname.startsWith('/api/'))
          .map(k => cache.delete(k))
      );
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, purged: true });
      }
    } catch (e) {
      console.warn('[SW] Error purging API cache:', e);
    }
  }
});

// Fetch Event Strategy: Stale-While-Revalidate for Same-Origin Assets, Network-First for APIs
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests (e.g. POST payments, invoices)
  if (req.method !== 'GET') {
    return;
  }

  // Only handle same-origin requests. Allow external CDNs (Tailwind, Chart.js, Google Fonts, etc.)
  // to be handled directly by the browser network stack without SW interception.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle API Requests: Network First, fallback to cached data if offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ 
            offline: true, 
            message: 'Network offline. Showing local cached records where available.' 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Handle SPA Navigation: Network First, fallback to /index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match('/index.html');
        return cached || caches.match('/');
      })
    );
    return;
  }

  // Handle Static Assets (CSS, JS, Images): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then(cachedRes => {
      const fetchPromise = fetch(req).then(networkRes => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return networkRes;
      }).catch(() => null);

      return cachedRes || fetchPromise;
    })
  );
});
