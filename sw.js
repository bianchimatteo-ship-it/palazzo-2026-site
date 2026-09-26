// POLITICANDO 2026 offline cache: network first, so a new build is always picked up online;
// when the network is missing, the last copy of the page, the code and the real data is used.
const CACHE = 'politicando-offline-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('politicando-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

// Only the files of the game are kept: GET requests of this site, never the API (accounts, online saves, owner
// archive: personal and always live) nor anything sent with credentials. POST, PUT, DELETE and the other methods are
// never touched by the service worker, and the Cache API itself only stores GET.
const cacheable = request => {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && !url.pathname.includes('/api/') && !request.headers.has('authorization');
};

// One copy per file: a newer build (?v=...) replaces the older one instead of piling up.
async function remember(request, response) {
  const url = new URL(request.url);
  if (!cacheable(request) || url.searchParams.has('build-check') || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(CACHE);
  for (const key of await cache.keys()) {
    const old = new URL(key.url);
    if (old.pathname === url.pathname && old.search !== url.search) await cache.delete(key);
  }
  await cache.put(request, response);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  // Anything else (other methods, the API, other sites) goes straight to the network, as without the service worker.
  if (!cacheable(request)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      event.waitUntil(remember(request, response.clone()));
      return response;
    } catch (error) {
      const cache = await caches.open(CACHE);
      const exact = await cache.match(request);
      if (exact) return exact;
      // Offline with a different build stamp or a page URL with a hash/query: fall back to the same file.
      const loose = await cache.match(request, { ignoreSearch: true });
      if (loose) return loose;
      if (request.mode === 'navigate') {
        const page = await cache.match(new URL('./', self.registration.scope).href, { ignoreSearch: true }) ?? await cache.match(new URL('./index.html', self.registration.scope).href, { ignoreSearch: true });
        if (page) return page;
      }
      throw error;
    }
  })());
});

// The page asks to keep the real data files ready for offline play.
self.addEventListener('message', event => {
  if (event.data?.type !== 'warm' || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const href of event.data.urls) {
      const request = new Request(href);
      if (!cacheable(request) || await cache.match(request)) continue;
      try { const response = await fetch(request); await remember(request, response); } catch { /* retried at the next visit */ }
    }
  })());
});
