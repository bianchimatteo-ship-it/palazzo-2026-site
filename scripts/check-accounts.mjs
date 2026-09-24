// Player accounts and online saves: the Worker API on Cloudflare D1 (here a SQLite stand-in with the same interface),
// the browser client, and a career recovered on a second device. Local saves stay as an offline copy.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// ---------- a D1 stand-in that survives "deploys" like the real database ----------
const sqlite = new DatabaseSync(':memory:');
const statement = (sql, params = []) => ({
  bind: (...values) => statement(sql, values),
  first: async () => sqlite.prepare(sql).get(...params) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
  run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...params) })
});
const d1 = { prepare: sql => statement(sql), batch: async list => Promise.all(list.map(item => item.run())), exec: async sql => sqlite.exec(sql) };
const env = { ACCOUNTS: d1, ADMIN_ARCHIVE: { get: async () => null, put: async () => {}, delete: async () => {} }, ASSETS: { fetch: async () => new Response('asset') } };
const ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
let worker = (await import('../worker.js?deploy=accounts-1')).default;
const requests = [];
const api = async (path, { method = 'GET', body, token, origin, ip = '198.51.100.7' } = {}) => {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) };
  const response = await worker.fetch(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
};
const proofOf = text => [...text].map(char => char.charCodeAt(0).toString(16)).join('').padEnd(64, 'a').slice(0, 64);

// ---------- 1. registration, login, sessions ----------
let result = await api('/api/account/register', { method: 'POST', body: { username: 'Ma', proof: proofOf('x') } });
assert.equal(result.status, 400, 'Nome utente troppo corto rifiutato.');
result = await api('/api/account/register', { method: 'POST', body: { username: 'giocatore.uno', proof: 'password-in-chiaro' } });
assert.equal(result.status, 400, 'Il server non accetta password in chiaro: solo la prova derivata nel browser.');
result = await api('/api/account/register', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('segreto-1') } });
assert.equal(result.status, 201);
assert.match(result.body.token, /^[\da-f]{64}$/);
const firstToken = result.body.token;
assert.equal((await api('/api/account/register', { method: 'POST', body: { username: 'GIOCATORE.UNO', proof: proofOf('altro') }, ip: '198.51.100.8' })).status, 409, 'Nomi utente unici, senza distinzione di maiuscole.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('sbagliata') } })).status, 401, 'Password sbagliata.');
result = await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('segreto-1') } });
assert.equal(result.status, 200);
const token = result.body.token;
const stored = sqlite.prepare('SELECT hash, salt FROM users WHERE username = ?').get('giocatore.uno');
assert.ok(stored.hash !== proofOf('segreto-1') && stored.salt.length >= 32, 'Nel database c’è solo un hash con sale casuale.');
assert.ok(sqlite.prepare('SELECT token_hash FROM sessions').all().every(row => row.token_hash !== token), 'I token di sessione sono conservati solo come hash.');
result = await api('/api/account/me', { token });
assert.equal(result.body.username, 'giocatore.uno');
assert.equal((await api('/api/account/me', { token: 'f'.repeat(64) })).status, 401, 'Token inesistente rifiutato.');
// Too many wrong passwords from the same address are slowed down.
for (let i = 0; i < 10; i++) await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf(`errore-${i}`) }, ip: '203.0.113.50' });
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('segreto-1') }, ip: '203.0.113.50' })).status, 429, 'Troppi tentativi: accesso sospeso per 15 minuti.');
// Logout ends only that session.
assert.equal((await api('/api/account/logout', { method: 'POST', token: firstToken })).status, 200);
assert.equal((await api('/api/account/me', { token: firstToken })).status, 401, 'Dopo l’uscita la sessione non vale più.');
assert.equal((await api('/api/account/me', { token })).status, 200, 'Le altre sessioni restano attive.');

// ---------- 2. online saves with revisions ----------
const save = (data, extra = {}) => ({ data: JSON.stringify(data), encoding: 'json', name: 'Carriera di prova', meta: { player: 'Profilo di prova', week: 3, gameDate: '2026-10-12', difficulty: 'normale' }, ...extra });
result = await api('/api/saves/c-carriera1', { method: 'PUT', token, body: save({ week: 3 }, { baseRevision: 0 }) });
assert.equal(result.body.revision, 1);
result = await api('/api/saves/c-carriera1', { method: 'PUT', token, body: save({ week: 4 }, { baseRevision: 1 }) });
assert.equal(result.body.revision, 2, 'Ogni salvataggio online aumenta la revisione.');
result = await api('/api/saves/c-carriera1', { method: 'PUT', token, body: save({ week: 2 }, { baseRevision: 1 }) });
assert.equal(result.status, 409, 'Un dispositivo con una versione vecchia non sovrascrive quella più recente.');
assert.equal(result.body.remote.revision, 2);
result = await api('/api/saves/c-carriera1', { method: 'PUT', token, body: save({ week: 5 }, { baseRevision: 1, force: true }) });
assert.equal(result.body.revision, 3, 'Solo su scelta esplicita si sovrascrive.');
result = await api('/api/saves', { token });
assert.equal(result.body.saves.length, 1);
assert.equal(result.body.saves[0].meta.player, 'Profilo di prova');
assert.equal(JSON.parse((await api('/api/saves/c-carriera1', { token })).body.data).week, 5);
assert.equal((await api('/api/saves/c-carriera1')).status, 401, 'Senza accesso i salvataggi non si leggono.');
assert.equal((await api('/api/saves/..%2Faltro', { token })).status, 404, 'Nomi di slot non validi rifiutati.');
assert.equal((await api('/api/saves/c-grande', { method: 'PUT', token, body: save({}, { data: 'x'.repeat(1_950_000) }) })).status, 413, 'Salvataggi troppo grandi rifiutati.');
// Another player cannot see them.
const other = (await api('/api/account/register', { method: 'POST', body: { username: 'giocatore.due', proof: proofOf('segreto-2') }, ip: '198.51.100.9' })).body.token;
assert.equal((await api('/api/saves', { token: other })).body.saves.length, 0, 'Ogni account vede solo le proprie carriere.');
assert.equal((await api('/api/saves/c-carriera1', { token: other })).status, 404);
// Slot limit.
for (let i = 0; i < 12; i++) await api(`/api/saves/c-slot${i}`, { method: 'PUT', token: other, body: save({ i }) });
assert.equal((await api('/api/saves/c-slot99', { method: 'PUT', token: other, body: save({}) })).status, 409, 'Numero massimo di carriere online.');
assert.equal((await api('/api/saves/c-slot0', { method: 'DELETE', token: other })).status, 200);
assert.equal((await api('/api/saves', { token: other })).body.saves.length, 11);
// CORS for the copy on GitHub Pages.
result = await api('/api/account/me', { token, origin: 'https://bianchimatteo-ship-it.github.io' });
assert.equal(result.headers.get('access-control-allow-origin'), 'https://bianchimatteo-ship-it.github.io');
assert.match(result.headers.get('access-control-allow-methods'), /DELETE/);
// A new deploy: accounts and saves are still there.
worker = (await import('../worker.js?deploy=accounts-2')).default;
assert.equal((await api('/api/account/me', { token })).body.username, 'giocatore.uno', 'Account e sessioni sopravvivono a un nuovo deploy.');
assert.equal((await api('/api/saves', { token })).body.saves[0].revision, 3);

// ---------- 3. the browser client, two devices ----------
const device = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map }; };
const deviceA = device(), deviceB = device();
globalThis.location = new URL(`${ORIGIN}/`);
globalThis.fetch = async (url, init = {}) => { requests.push({ url: String(url), body: init.body ?? null }); return worker.fetch(new Request(url, init), env); };
const client = await import('../src/data/repositories/account-sync.js');
assert.equal(client.accountApiBase(), ORIGIN);
globalThis.localStorage = deviceA;
await assert.rejects(client.register('ab', 'password-lunga'), /Nome utente/);
await assert.rejects(client.register('giocatrice', 'corta'), /almeno 8/);
await client.register('Giocatrice', 'una-password-lunga');
assert.equal(client.currentAccount().username, 'giocatrice');
assert.ok(requests.every(item => !String(item.body ?? '').includes('una-password-lunga')), 'La password non viene mai inviata in chiaro.');
const career = { version: 8, career: { id: 'carriera-1234-abcd', name: 'Prova — Consigliere' }, clock: { currentDate: '2026-10-05' }, dataset: { politicians: [] }, game: { week: { index: 7 }, memory: Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, text: 'Promessa mantenuta in Liguria' })) } };
const slot = client.slotForCareer(career.career.id);
assert.match(slot, /^c-[a-z0-9]{1,38}$/);
const first = await client.uploadSave(slot, career, { name: 'Prova', meta: { player: 'Prova', week: 7 } });
assert.equal(first.revision, 1);
assert.equal(sqlite.prepare('SELECT encoding FROM saves WHERE slot = ?').get(slot).encoding, 'gzip-base64', 'I salvataggi viaggiano compressi.');
// Device B: log in, find the career, download it, play on.
globalThis.localStorage = deviceB;
await client.login('giocatrice', 'una-password-lunga');
const list = await client.listCloudSaves();
assert.equal(list[0].slot, slot, 'Dal secondo dispositivo la carriera è nell’elenco.');
const downloaded = await client.downloadSave(slot);
assert.deepEqual(downloaded.state, career, 'La carriera scaricata è identica a quella salvata.');
await client.uploadSave(slot, { ...career, game: { ...career.game, week: { index: 9 } } }, { meta: { week: 9 } });
// Back on device A, still at revision 1: it cannot overwrite the newer version by mistake.
globalThis.localStorage = deviceA;
await assert.rejects(client.uploadSave(slot, career, { meta: { week: 7 } }), error => error.status === 409 && error.data.remote.revision === 2);
assert.equal((await client.downloadSave(slot)).state.game.week.index, 9, 'Il dispositivo A recupera la versione più recente.');
await client.logout();
assert.equal(client.currentAccount(), null);
await assert.rejects(client.listCloudSaves(), /Sessione/, 'Dopo l’uscita serve un nuovo accesso.');
// Local-only copies of the game (localhost without the API): the client says so instead of failing silently.
globalThis.location = new URL('http://localhost:8080/');
assert.equal(client.accountApiBase(), null);
await assert.rejects(client.login('giocatrice', 'una-password-lunga'), /sito pubblicato/);
console.log('Account verificati: registrazione e accesso con password mai inviata in chiaro (PBKDF2 nel browser + hash con sale sul server), sessioni a token conservate come hash, uscita, tentativi limitati, salvataggi online compressi con revisioni e protezione dai conflitti tra dispositivi, limiti di dimensione e numero, isolamento tra account, CORS per GitHub Pages, persistenza dopo un nuovo deploy, carriera recuperata su un secondo dispositivo.');
