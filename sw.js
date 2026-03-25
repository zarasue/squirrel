const CACHE = '55pct-v2';

const PRECACHE = [
  '/',
  '/sw.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
];

// On install: pre-cache everything the app needs to run
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache each asset — if one fails (e.g. offline during SW install) skip it
      await Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(err => console.warn('Failed to precache:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// On activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// On fetch
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Let Supabase API calls go straight to network — never cache them
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // For Google Fonts CSS — network first, cache fallback
  if (url.hostname === 'fonts.googleapis.com') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // For everything else (app shell, CDN JS, font files) — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // If all else fails, return the cached app shell
        if (e.request.destination === 'document') {
          return caches.match('/');
        }
      });
    })
  );
});
