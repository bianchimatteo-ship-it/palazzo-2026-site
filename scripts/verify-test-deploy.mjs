// Post-deploy check of the private TEST site, run from YOUR terminal against the real URL (not part of check:all).
//   TEST_BASE_URL=https://politicando-test.<account>.workers.dev TEST_ACCESS_PASSWORD='…' node scripts/verify-test-deploy.mjs
// The password is read from the environment of the command only; nothing is printed or saved. Refuses a host without «test».
import assert from 'node:assert/strict';
const base = String(process.env.TEST_BASE_URL ?? '').replace(/\/+$/, '');
const password = process.env.TEST_ACCESS_PASSWORD ?? '';
if (!base || !password) { console.error('verify-test-deploy: imposta TEST_BASE_URL e TEST_ACCESS_PASSWORD (solo nell’ambiente del comando).'); process.exit(1); }
const host = new URL(base).hostname;
const local = process.env.VERIFY_LOCAL === '1' && /^(localhost|127\.0\.0\.1)$/.test(host); // wrangler dev on this machine
if (!local && (new URL(base).protocol !== 'https:' || !/test/i.test(host))) { console.error(`verify-test-deploy: ${host} non sembra il sito TEST: rifiuto.`); process.exit(1); }
const req = (path, { method = 'GET', cookie, headers = {}, body } = {}) => fetch(base + path, { method, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...headers }, body });
const results = [];
const check = async (label, fn) => { try { await fn(); results.push(['OK', label]); } catch (error) { results.push(['FALLITO', `${label} — ${error.message}`]); } };
const form = pass => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password: pass, next: '/' }).toString() });

await check('senza password: pagina, codice, stile, API, service worker, file locale → 401', async () => {
  for (const path of ['/', '/index.html', '/src/main.js', '/src/scene.css', '/sw.js', '/api/account/status', '/wrangler.test.local.jsonc', '/.dev.vars']) assert.equal((await req(path, { headers: { accept: 'text/html' } })).status, 401, `${path} non è chiuso`);
});
await check('password errata → 401 e nessun cookie', async () => { const r = await req('/__test-login', form('password-sbagliata-' + Date.now())); assert.equal(r.status, 401); assert.ok(!r.headers.get('set-cookie')); });
let cookie = '';
await check('password corretta → 303 con cookie Secure, HttpOnly, SameSite=Strict e scadenza', async () => {
  const r = await req('/__test-login', form(password)); assert.equal(r.status, 303, `stato ${r.status} (bloccato per tentativi? attendi 15 minuti)`);
  const c = r.headers.get('set-cookie') ?? ''; for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Max-Age=']) assert.ok(c.includes(flag), flag);
  cookie = c.split(';')[0];
});
await check('con sessione: pagina, asset e API rispondono dal Worker', async () => {
  for (const path of ['/', '/src/main.js', '/sw.js', '/api/account/status']) { const r = await req(path, { cookie }); assert.equal(r.status, 200, `${path} → ${r.status}`); assert.ok(/private/.test(r.headers.get('cache-control') ?? ''), `${path}: cache non «private»`); }
});
await check('/wrangler.test.local.jsonc e /.dev.vars → 404 anche con sessione', async () => { for (const path of ['/wrangler.test.local.jsonc', '/wrangler.test.jsonc', '/.dev.vars', '/worker-test-access.js']) assert.equal((await req(path, { cookie })).status, 404, `${path} non è 404`); });
await check('uscita: cookie azzerato e vecchia sessione revocata', async () => {
  const out = await req('/__test-logout', { method: 'POST', cookie }); assert.equal(out.status, 200); assert.match(out.headers.get('set-cookie') ?? '', /Max-Age=0/);
  assert.equal((await req('/src/main.js', { cookie })).status, 401);
});
for (const [state, label] of results) console.log(`${state}: ${label}`);
if (results.some(([state]) => state !== 'OK')) process.exit(1);
console.log('Il sito TEST è inaccessibile senza password e il file di configurazione locale non è pubblico.');
