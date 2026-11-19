// Password gate of the private TEST site (worker-test-access.js): without a valid session NOTHING is served (pages, code, styles, images, API, service worker, files that must not be public);
// login/lockout/expiry/tampering/logout, cookie flags, caches, and the configuration that makes it all hold (TEST only, no secret in the repository). Simulated environment, no network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ORIGIN = 'https://politicando-test.example.workers.dev';
const PASSWORD = `prova-${Math.random().toString(16).slice(2)}-xyz`;
const store = new Map();
const kv = { get: async (key, type) => { const v = store.get(key); return v === undefined ? null : type === 'json' ? JSON.parse(v) : v; }, put: async (key, value) => { store.set(key, String(value)); }, delete: async key => { store.delete(key); } };
const served = [];
const ASSETS = { fetch: async request => { served.push(new URL(request.url).pathname); return new Response('contenuto del gioco', { status: 200, headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=31536000' } }); } };
const d1 = { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }), first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }), batch: async () => [], exec: async () => {} };
const on = { GAME_WEB: '1', TEST_ACCESS_ENABLED: '1', TEST_ACCESS_PASSWORD: PASSWORD, ADMIN_ARCHIVE: kv, ASSETS, ACCOUNTS: d1 };
const worker = (await import('../worker.js?deploy=test-access')).default;
const ask = (path, { method = 'GET', headers = {}, body, env = on, ip = '203.0.113.5' } = {}) => worker.fetch(new Request(ORIGIN + path, { method, headers: { 'cf-connecting-ip': ip, ...headers }, body }), env);
const login = (password, { ip, next = '/' } = {}) => ask('/__test-login', { method: 'POST', ip, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password, next }).toString() });
const cookieFrom = response => (response.headers.get('set-cookie') ?? '').split(';')[0];

// 1. no session: everything is closed
const paths = ['/', '/index.html', '/src/main.js', '/src/scene.css', '/src/data/ads-config.js', '/sw.js', '/privacy.html', '/icon.png', '/wrangler.test.local.jsonc', '/wrangler.test.jsonc', '/.dev.vars', '/worker.js', '/api/account/status', '/api/admin/archive', '/api/account/login'];
for (const path of paths) {
  for (const method of ['GET', 'HEAD', 'POST']) {
    const response = await ask(path, { method, headers: { accept: 'text/html' } });
    assert.equal(response.status, 401, `Senza sessione ${method} ${path} è chiuso (401), non ${response.status}.`);
    assert.ok(/no-store/.test(response.headers.get('cache-control')), `${path}: la risposta di rifiuto non si memorizza.`);
    assert.ok(!(await response.clone().text()).includes('contenuto del gioco'));
  }
  assert.equal((await ask(path, { headers: { cookie: '__Host-pt_session=falso' } })).status, 401, `${path}: un cookie inventato non basta.`);
}
assert.deepEqual(served, [], 'Senza sessione nessun file è stato letto da ASSETS.');
const gatePage = await ask('/', { headers: { accept: 'text/html' } });
assert.match(await gatePage.text(), /type="password"/, 'La pagina mostra il modulo della password.');
assert.equal((await ask('/src/main.js', { headers: { accept: '*/*' } })).headers.get('content-type').startsWith('text/plain'), true, 'Un asset senza sessione riceve solo un rifiuto in chiaro.');

// 2. closed when the secret is missing; open (untouched) when the gate is off
assert.equal((await ask('/', { env: { ...on, TEST_ACCESS_PASSWORD: undefined } })).status, 503, 'Senza segreto il sito resta chiuso (503), mai aperto.');
assert.equal((await ask('/', { env: { ...on, TEST_ACCESS_PASSWORD: 'corta' } })).status, 503, 'Una password troppo corta è rifiutata come configurazione.');
const prod = await ask('/privacy.html', { env: { GAME_WEB: '0', ADMIN_ARCHIVE: kv, ASSETS, ACCOUNTS: d1 } });
assert.equal(prod.status, 200, 'Senza TEST_ACCESS_ENABLED (produzione) il Worker non cambia comportamento.');
assert.ok(!prod.headers.get('vary'), 'E non aggiunge intestazioni di accesso.');

// 3. wrong password, then the lockout
for (let i = 0; i < 5; i++) { const wrong = await login('sbagliata-' + i); assert.equal(wrong.status, 401, 'Password errata: rifiutata.'); assert.ok(!wrong.headers.get('set-cookie'), 'Nessun cookie dopo una password errata.'); }
const locked = await login(PASSWORD);
assert.equal(locked.status, 429, 'Dopo 5 errori anche la password giusta è bloccata per un po’.');
assert.ok(Number(locked.headers.get('retry-after')) > 0);
assert.ok(!locked.headers.get('set-cookie'));
assert.equal((await login(PASSWORD, { ip: '198.51.100.9' })).status, 303, 'Il blocco è per indirizzo: un altro indirizzo può accedere.');

// 4. correct login: cookie flags, redirect, authenticated access to everything
const ok = await login(PASSWORD, { ip: '198.51.100.20', next: '/src/main.js' });
assert.equal(ok.status, 303); assert.equal(ok.headers.get('location'), '/src/main.js');
const setCookie = ok.headers.get('set-cookie');
for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=']) assert.ok(setCookie.includes(flag), `Il cookie ha ${flag}.`);
assert.ok(setCookie.startsWith('__Host-'), 'Nome con prefisso __Host-.');
assert.ok(!setCookie.includes(PASSWORD), 'La password non è nel cookie.');
assert.ok(Number(/Max-Age=(\d+)/.exec(setCookie)[1]) <= 12 * 3600, 'La sessione scade.');
const cookie = cookieFrom(ok);
for (const open of ['//evil.example/x', 'https://evil.example', '/\\evil.example', '/__test-login']) assert.equal((await login(PASSWORD, { ip: '198.51.100.21', next: open })).headers.get('location'), '/', `Reindirizzamento «${open}» non seguito.`);
for (const path of ['/', '/src/main.js', '/sw.js', '/icon.png', '/api/account/status']) {
  const response = await ask(path, { headers: { cookie } });
  assert.notEqual(response.status, 401, `Con la sessione ${path} risponde.`);
  assert.ok(/private/.test(response.headers.get('cache-control') ?? ''), `${path}: con sessione la risposta è «private», non per le cache condivise.`);
  assert.equal(response.headers.get('vary'), 'Cookie');
}
assert.ok(served.includes('/src/main.js'), 'Con la sessione gli asset arrivano da ASSETS.');
assert.equal((await ask('/api/account/status', { headers: { cookie } })).headers.get('content-type').includes('json'), true, 'L’API autenticata continua a funzionare.');

// 5. tampering, another password, expiry
const [exp, nonce, signature] = cookie.split('=')[1].split('.');
assert.equal((await ask('/', { headers: { cookie: `__Host-pt_session=${Number(exp) + 99999}.${nonce}.${signature}` } })).status, 401, 'Una scadenza allungata invalida la firma.');
assert.equal((await ask('/', { headers: { cookie: `__Host-pt_session=${exp}.${nonce}.${signature.slice(0, -2)}xx` } })).status, 401, 'Firma alterata rifiutata.');
assert.equal((await ask('/', { headers: { cookie }, env: { ...on, TEST_ACCESS_PASSWORD: PASSWORD + '-nuova' } })).status, 401, 'Cambiando la password finiscono tutte le sessioni.');
const realNow = Date.now; Date.now = () => realNow() + 13 * 3600 * 1000;
try { assert.equal((await ask('/src/main.js', { headers: { cookie } })).status, 401, 'Sessione scaduta (dopo 13 ore): chiuso.'); assert.equal((await ask('/', { headers: { cookie, accept: 'text/html' } })).status, 401); }
finally { Date.now = realNow; }

// 6. logout: cookie cleared, session revoked, offline copy emptied
assert.equal((await ask('/__test-logout', { headers: { cookie } })).status, 200, 'La pagina di uscita si apre con GET ma non chiude nulla.');
assert.notEqual((await ask('/src/main.js', { headers: { cookie } })).status, 401, 'Un GET non fa uscire (serve il POST: nessuna uscita da link altrui).');
const out = await ask('/__test-logout', { method: 'POST', headers: { cookie } });
assert.equal(out.status, 200);
assert.match(out.headers.get('set-cookie'), /Max-Age=0/, 'Il cookie viene azzerato.');
assert.ok(/caches\.delete/.test(await out.text()), 'La pagina svuota la copia offline.');
assert.equal((await ask('/src/main.js', { headers: { cookie } })).status, 401, 'Il vecchio cookie, anche se copiato, non funziona più (revocato).');

// 7. service worker and configuration
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
assert.ok(/status === 401[\s\S]{0,160}caches\.delete\(CACHE\)/.test(sw), 'Il service worker svuota la copia offline appena il sito risponde 401.');
assert.ok(!/politicando-offline-v2'/.test(sw), 'Cache rinnovata: le copie vecchie vengono eliminate.');
const strip = text => text.replace(/^\s*\/\/.*$/gm, '');
const testConfig = JSON.parse(strip(await readFile(new URL('../wrangler.test.jsonc', import.meta.url), 'utf8')));
assert.equal(testConfig.vars.TEST_ACCESS_ENABLED, '1'); assert.deepEqual(testConfig.assets.run_worker_first, ['/*'], 'Nel TEST ogni richiesta passa dal Worker.');
assert.ok(!('TEST_ACCESS_PASSWORD' in testConfig.vars) && !JSON.stringify(testConfig).includes(PASSWORD), 'La password non è nella configurazione: è un secret.');
const prodConfig = JSON.parse(strip(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')));
assert.ok(!('TEST_ACCESS_ENABLED' in (prodConfig.vars ?? {})) && !prodConfig.assets.run_worker_first.includes('/*'), 'La produzione non ha il cancello di prova.');
const ignore = (await readFile(new URL('../.assetsignore', import.meta.url), 'utf8')).split('\n').map(line => line.trim());
for (const pattern of ['wrangler.test.local.jsonc', '.dev.vars', '.dev.vars.*', '.env', '.env.*', '*.local.jsonc', 'worker-test-access.js', '*.keystore']) assert.ok(ignore.includes(pattern), `.assetsignore esclude ${pattern}.`);
const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');
assert.ok(/wrangler\.test\.local\.jsonc/.test(gitignore) && /\.dev\.vars/.test(gitignore), 'File locali e segreti non entrano nel repository.');
console.log('Accesso con password al sito TEST: tutto chiuso senza sessione (pagine, codice, API, service worker, file di configurazione), password errata e blocco dopo 5 errori, cookie Secure/HttpOnly/Strict con scadenza, sessione scaduta o alterata rifiutata, uscita con revoca, 503 senza segreto, produzione invariata.');
