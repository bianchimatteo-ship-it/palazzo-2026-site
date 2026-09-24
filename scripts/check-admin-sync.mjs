// Shared admin archive: the Worker API on Workers KV, the client that reads and publishes it,
// persistence across refreshes, restarts and new deploys, logos visible to every player, real data untouched.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// A Workers KV stand-in that survives "deploys" (new Worker instances) like the real namespace.
const kvData = new Map();
const kv = {
  async get(key, type) { const entry = kvData.get(key); if (!entry || (entry.expires && entry.expires < Date.now())) return null; return type === 'json' ? JSON.parse(entry.value) : entry.value; },
  async put(key, value, options = {}) { kvData.set(key, { value: String(value), expires: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null }); },
  async delete(key) { kvData.delete(key); }
};
const deploy = async version => (await import(`../worker.js?deploy=${version}`)).default;
const env = { ADMIN_ARCHIVE: kv, ADMIN_SETUP_CODE: 'attivazione-di-prova', ASSETS: { fetch: async () => new Response('asset', { headers: { 'content-type': 'text/html' } }) } };
const ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
let worker = await deploy(1);
const api = async (path, init = {}, headers = {}) => { const response = await worker.fetch(new Request(ORIGIN + path, { ...init, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers } }), env); return { status: response.status, body: await response.json().catch(() => null), headers: response.headers }; };

// ---------- 1. the Worker API ----------
let result = await api('/api/admin');
assert.equal(result.status, 200);
assert.equal(result.body.configured, false, 'Archivio vuoto e non ancora attivato.');
assert.equal((await worker.fetch(new Request(`${ORIGIN}/index.html`), env).then(response => response.text())), 'asset', 'Le pagine del gioco restano asset statici.');
assert.equal((await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ pin: '123456', setupCode: 'sbagliato' }) })).status, 401, 'Senza codice di attivazione nessuno può impossessarsi dell’archivio.');
result = await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ pin: 'pin-segreto-1', setupCode: 'attivazione-di-prova' }) });
assert.equal(result.status, 200);
const token = result.body.token;
assert.equal((await api('/api/admin', { method: 'PUT', body: '{}' })).status, 401, 'Scrivere richiede una sessione.');
result = await api('/api/admin', { method: 'PUT', body: JSON.stringify({ parties: { 'party-registro-p1-2015-29-ir': { fields: { abbreviation: 'PD-test' }, updatedAt: '2026-09-24T10:00:00Z' } }, politicians: {}, logos: { 'party-registro-p1-2015-29-ir': { url: 'https://example.org/logo.svg', alt: 'Logo' }, pericoloso: { url: 'javascript:alert(1)' }, grande: { dataUrl: `data:image/png;base64,${'A'.repeat(500000)}` } } }) }, { authorization: `Bearer ${token}` });
assert.equal(result.status, 200);
assert.equal(result.body.logos, 1, 'Solo loghi sicuri e leggeri vengono pubblicati.');
// Wrong PINs are limited.
for (let i = 0; i < 8; i++) await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ pin: `sbagliato-${i}` }) });
assert.equal((await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ pin: 'pin-segreto-1' }) })).status, 429, 'Dopo troppi tentativi il PIN viene bloccato per un po’.');
await kv.delete('tentativi:203.0.113.9');
// A new deploy of the code: the archive is still there.
worker = await deploy(2);
result = await api('/api/admin');
assert.equal(result.body.configured, true);
assert.equal(result.body.parties['party-registro-p1-2015-29-ir'].fields.abbreviation, 'PD-test', 'Le correzioni sopravvivono a un nuovo deploy.');
assert.equal(result.body.logos['party-registro-p1-2015-29-ir'].url, 'https://example.org/logo.svg', 'I loghi da indirizzo restano salvati sul server.');
assert.equal((await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ pin: 'pin-segreto-1' }) })).status, 200, 'Dopo l’attivazione basta il PIN.');
// Cross-origin reading from GitHub Pages.
result = await api('/api/admin', {}, { origin: 'https://bianchimatteo-ship-it.github.io' });
assert.equal(result.headers.get('access-control-allow-origin'), 'https://bianchimatteo-ship-it.github.io', 'Anche i giocatori su GitHub Pages vedono l’archivio condiviso.');

// ---------- 2. the client: read for everyone, publish with the owner's session ----------
const local = new Map();
const session = new Map();
globalThis.localStorage = { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)), removeItem: key => local.delete(key) };
globalThis.sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, String(value)), removeItem: key => session.delete(key) };
globalThis.location = new URL(`${ORIGIN}/`);
const realFetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
globalThis.fetch = async (url, init = {}) => String(url).startsWith(ORIGIN) ? worker.fetch(new Request(url, init), env) : realFetch(url);
const sync = await import('../src/data/repositories/admin-sync.js');
const adminStore = await import('../src/data/repositories/admin-store.js');
const realData = await import('../src/data/repositories/real-data.js');
const fingerprint = async () => createHash('sha256').update(await readFile(new URL('../src/data/real/parties.json', import.meta.url))).digest('hex');
const before = await fingerprint();
assert.equal(sync.sharedApiUrl(), `${ORIGIN}/api/admin`);
assert.ok(await sync.refreshSharedArchive(), 'Il gioco scarica l’archivio condiviso all’avvio.');
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties']);
assert.equal(realData.realDatabase.parties.find(item => item.id === 'party-registro-p1-2015-29-ir').abbreviation, 'PD-test', 'Ogni giocatore vede la correzione pubblicata.');
assert.equal(adminStore.sharedLogos()['party-registro-p1-2015-29-ir'].url, 'https://example.org/logo.svg', 'E il logo pubblicato.');
// Offline: the cached copy keeps working.
globalThis.fetch = async (url, init) => { if (String(url).startsWith(ORIGIN)) throw new TypeError('offline'); return realFetch(url, init); };
assert.equal(await sync.refreshSharedArchive(), false);
assert.equal(adminStore.loadAdminArchive().parties['party-registro-p1-2015-29-ir'].fields.abbreviation, 'PD-test', 'Senza rete resta la copia salvata.');
globalThis.fetch = async (url, init = {}) => String(url).startsWith(ORIGIN) ? worker.fetch(new Request(url, init), env) : realFetch(url);
// The owner edits locally, then publishes for everyone.
await assert.rejects(sync.publishSharedArchive(), /Collega/, 'Senza sessione non si pubblica.');
await sync.openSharedSession('pin-segreto-1');
assert.ok(sync.hasSharedSession());
const original = realData.pristineRecord('parties', 'party-registro-p1-2015-29-ir');
adminStore.setRecordField('parties', 'party-registro-p1-2015-29-ir', 'color', '#123456', original);
const published = await sync.publishSharedArchive({ 'party-futuro-nazionale': { url: 'https://example.org/fn.png', alt: 'Logo' } });
assert.equal(published.logos, 2);
result = await api('/api/admin');
assert.equal(result.body.parties['party-registro-p1-2015-29-ir'].fields.color, '#123456', 'La modifica dell’amministratore è pubblicata per tutti.');
assert.equal(result.body.parties['party-registro-p1-2015-29-ir'].fields.abbreviation, 'PD-test', 'Senza perdere le correzioni precedenti.');
// A new player (empty browser) after a restart sees everything.
local.clear(); session.clear();
await sync.refreshSharedArchive();
realData.refreshAdminOverrides();
assert.equal(realData.realDatabase.parties.find(item => item.id === 'party-registro-p1-2015-29-ir').color, '#123456', 'Un nuovo giocatore vede i dati dell’amministratore.');
assert.equal(adminStore.sharedLogos()['party-futuro-nazionale'].url, 'https://example.org/fn.png');
assert.equal(realData.pristineRecord('parties', 'party-registro-p1-2015-29-ir').abbreviation, original.abbreviation, 'Il dato reale originale resta intatto.');
assert.equal(await fingerprint(), before, 'Il file dei dati reali non viene mai modificato.');
// An expired session asks for the PIN again.
await sync.openSharedSession('pin-segreto-1');
for (const key of [...kvData.keys()].filter(key => key.startsWith('sessione:'))) kvData.delete(key);
await assert.rejects(sync.publishSharedArchive(), /scaduta/);
assert.ok(!sync.hasSharedSession(), 'La sessione scaduta viene chiusa.');

console.log('Archivio amministrativo condiviso verificato: attivazione con codice e PIN, tentativi limitati, loghi validati, persistenza su Workers KV dopo refresh, riavvio e nuovo deploy, lettura anche da GitHub Pages, copia offline, pubblicazione dell’amministratore visibile a ogni nuovo giocatore, dati reali intatti.');
