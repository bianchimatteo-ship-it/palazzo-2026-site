// The offline service worker (sw.js) without a browser: its events run against a stand-in Cache API and network.
// Only GET requests for the files of the site are answered and kept; POST, PUT, DELETE (and every other method), the
// account and saves API, requests with credentials and other sites are left to the network and never cached. Offline,
// the files already kept are still served.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SCOPE = 'https://gioco.example/palazzo/';
const stored = new Map();
let caches;
const makeCaches = () => ({
  async open(name) {
    if (!stored.has(name)) stored.set(name, new Map());
    const cache = stored.get(name);
    return {
      async put(request, response) { if (request.method !== 'GET') throw new TypeError('Cache.put: solo GET'); cache.set(request.url, { request, response }); },
      async keys() { return [...cache.values()].map(item => item.request); },
      async delete(request) { return cache.delete(request.url); },
      async match(request, { ignoreSearch = false } = {}) {
        const url = new URL(typeof request === 'string' ? request : request.url);
        for (const [key, item] of cache) { const other = new URL(key); if (key === url.href || (ignoreSearch && other.origin + other.pathname === url.origin + url.pathname)) return item.response.clone(); }
        return undefined;
      }
    };
  },
  async keys() { return [...stored.keys()]; },
  async delete(name) { return stored.delete(name); }
});
let online = true;
const network = [];
const listeners = {};
const context = {
  self: { location: new URL(SCOPE), registration: { scope: SCOPE }, addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting() {}, clients: { claim: async () => {} } },
  fetch: async request => { network.push(`${request.method} ${new URL(request.url).pathname}`); if (!online) throw new TypeError('offline'); return new Response(`contenuto di ${request.url}`, { status: 200, headers: { 'content-type': 'text/plain' } }); },
  URL, Request, Response
};
caches = makeCaches();
const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
new Function('self', 'caches', 'fetch', 'URL', 'Request', 'Response', source)(context.self, caches, context.fetch, URL, Request, Response);
assert.ok(listeners.fetch && listeners.install && listeners.activate && listeners.message, 'Il service worker registra install, activate, fetch e message.');

// One request through the worker: whether it answered (respondWith) and after its background work.
async function run(url, init = {}) {
  const request = new Request(new URL(url, SCOPE), init);
  let answer = null;
  const waits = [];
  listeners.fetch({ request, respondWith: promise => { answer = promise; }, waitUntil: promise => waits.push(promise) });
  const response = answer ? await answer : null;
  await Promise.all(waits);
  return { handled: Boolean(answer), response };
}
const cachedUrls = async () => { const urls = []; for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(`${request.method} ${new URL(request.url).pathname}`); return urls; };

// Game files: answered from the network and kept.
let result = await run('src/main.js?v=1');
assert.ok(result.handled && (await cachedUrls()).includes('GET /palazzo/src/main.js'), 'I file del gioco (GET) passano dal service worker e restano in cache.');
await run('src/data/real/parties.json?v=1');

// Writes and the API: never handled, never cached.
for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
  result = await run('api/saves/c-prova', { method, body: method === 'DELETE' ? undefined : '{}', headers: { 'content-type': 'application/json' } });
  assert.equal(result.handled, false, `${method} non passa dal service worker.`);
}
result = await run('/api/account/register', { method: 'POST', body: '{}' });
assert.equal(result.handled, false, 'La registrazione (POST) va direttamente alla rete.');
result = await run('/api/account/status');
assert.equal(result.handled, false, 'Le GET dell’API (stato del servizio) non passano dal service worker.');
result = await run('/api/saves', { headers: { authorization: 'Bearer prova' } });
assert.equal(result.handled, false, 'Le richieste con credenziali non passano dal service worker.');
result = await run('src/core/store.js?v=1', { headers: { authorization: 'Bearer prova' } });
assert.equal(result.handled, false, 'Nessuna richiesta con credenziali in cache, nemmeno fuori dall’API.');
result = await run('src/main.js?v=1', { method: 'HEAD' });
assert.equal(result.handled, false, 'HEAD resta alla rete (nessuna copia in cache).');
result = await run('https://altro.example/file.js');
assert.equal(result.handled, false, 'Altri siti restano fuori dal service worker.');
const urls = await cachedUrls();
assert.ok(urls.every(url => url.startsWith('GET ')) && !urls.some(url => url.includes('/api/')), `In cache solo GET dei file del gioco: ${urls.join(', ')}`);

// The warm-up message: the listed files are kept, the API and other sites are skipped.
const waits = [];
listeners.message({ data: { type: 'warm', urls: [new URL('src/ui/app.js?v=1', SCOPE).href, new URL('/api/admin', SCOPE).href, 'https://altro.example/x.json'] }, waitUntil: promise => waits.push(promise) });
await Promise.all(waits);
const warmed = await cachedUrls();
assert.ok(warmed.includes('GET /palazzo/src/ui/app.js') && !warmed.some(url => url.includes('/api/') || url.includes('altro.example')), 'Il preriscaldamento conserva solo i file del gioco.');

// Offline: the kept files are still served, the navigation falls back to the page.
online = false;
result = await run('src/main.js?v=2');
assert.ok(result.handled && (await result.response.text()).includes('src/main.js'), 'Offline il file in cache viene servito (anche con un altro numero di build).');

// A new version of the worker removes the older caches.
stored.set('politicando-offline-v1', new Map([['x', { request: new Request(new URL('api/saves', SCOPE)), response: new Response('vecchio') }]]));
const activation = [];
listeners.activate({ waitUntil: promise => activation.push(promise) });
await Promise.all(activation);
assert.deepEqual(await caches.keys(), ['politicando-offline-v2'], 'Le cache delle versioni precedenti (con eventuali risposte API) vengono eliminate.');

console.log('Service worker verificato: in cache solo le GET dei file del gioco; POST, PUT, DELETE, PATCH e HEAD, l’API account/salvataggi/archivio, le richieste con credenziali e gli altri siti vanno sempre alla rete senza copie; preriscaldamento filtrato, file serviti offline, cache precedenti eliminate.');
