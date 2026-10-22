// The personal logos in the account's cloud copy (Worker routes /api/logos, images in R2, metadata in D1), against the local stand-ins (an in-memory D1, an in-memory R2, no network, nothing real):
//   - routes: the owner is the session's account; limits and validation; a different cloud version is a conflict, never an overwrite; the same image again is not a new version;
//   - synchronisation: upload, download on a second (empty) device, replacement, deletion, offline and partial failures with retry, conflicts that keep both copies until the player chooses;
//   - isolation between account A and account B; the guest scope is never uploaded or attributed on its own;
//   - the logos of the earlier version (legacy scope) and of the guest scope are copied, and the old copy goes only after the upload has been verified; repeating the steps creates no duplicates;
//   - the deletion of the account removes the images in R2 and the rows in D1 (and does not delete the account if the bucket fails); not configured (no bucket) the game keeps its logos.
// The browser side runs here on the in-memory fallback of the personal-logos module (no IndexedDB in Node); a "second device" is an empty local cache against the same account.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const store = new Map();
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, String(value)); }, removeItem: key => { store.delete(key); } };
globalThis.location = new URL('http://127.0.0.1:8791/');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const stamp = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const q = stamp ? `?v=${stamp}` : '';
const client = await import(`../src/data/repositories/account-sync.js${q}`);
const logos = await import(`../src/data/repositories/personal-logos.js${q}`);
const sync = await import(`../src/data/repositories/logo-sync.js${q}`);

// ---- tiny valid PNGs, one per colour ----
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = bytes => { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length); return out; };
const png = (r, g, b) => { const head = Buffer.alloc(13); head.writeUInt32BE(1, 0); head.writeUInt32BE(1, 4); head[8] = 8; head[9] = 2; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(Buffer.from([0, r, g, b]))), chunk('IEND', Buffer.alloc(0))]); };
const prepared = (r, g, b) => { const bytes = png(r, g, b); return { blob: new Blob([bytes], { type: 'image/png' }), mimeType: 'image/png', width: 1, height: 1, bytes: bytes.length }; };
const hex = async blob => logos.sha256OfBlob(blob);

const local = await startLocalWorker({ port: 8791 });
const api = (path, { token, method = 'GET', body, base, headers = {} } = {}) => fetch(`${local.origin}${path}`, { method, body, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(base !== undefined ? { 'x-base-version': String(base) } : {}), ...headers } });
let ip = 40;
const register = async (username, password) => {
  const proof = await client.passwordProof(username, password);
  const response = await fetch(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ip}` }, body: JSON.stringify({ username, proof }) });
  assert.equal(response.status, 201); return { username, password, proof, token: (await response.json()).token };
};
const signIn = async user => { if (user) store.set('politicando.account.v1', JSON.stringify({ username: user.username, token: user.token })); else store.delete('politicando.account.v1'); await logos.loadLogos(); };
const wipeDevice = async user => { for (const scope of [user.username, `${user.username}${logos.CONFLICT_SUFFIX}`, '_ospite', logos.LEGACY_SCOPE]) for (const record of await logos.logoStore.all(scope)) await logos.logoStore.remove(record.key); await logos.loadLogos(); };
const rowsOf = username => local.sqlite.prepare('SELECT l.* FROM logos l JOIN users u ON u.id = l.user_id WHERE u.username = ? AND l.deleted_at IS NULL ORDER BY party_id').all(username);
const objectsOf = username => { const id = local.sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username)?.id; return [...local.r2Data.keys()].filter(key => key.startsWith(`logos/${id}/`)); };
const localRecord = async (user, partyId) => (await logos.logoStore.all(user.username)).find(record => record.partyId === partyId);
const A = await register('logo.a', 'password-di-a'), B = await register('logo.b', 'password-di-b');

// ---------- 1. the routes ----------
const status = await (await api('/api/account/status')).json();
assert.ok(status.features.includes('logo-sync'), 'Il servizio dichiara la sincronizzazione dei loghi quando il bucket c’è.');
assert.equal((await api('/api/logos')).status, 401, 'Senza sessione nessun accesso.');
assert.equal((await api('/api/logos', { token: 'x'.repeat(64) })).status, 401, 'Con una sessione falsa nemmeno.');
const red = png(200, 20, 20), blue = png(20, 20, 200);
assert.equal((await api('/api/logos/p-uno', { token: A.token, method: 'PUT', body: red })).status, 400, 'Un caricamento senza la versione vista è rifiutato.');
assert.equal((await api('/api/logos/p-uno', { token: A.token, method: 'PUT', body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), base: 0 })).status, 400, 'Un SVG non è un logo.');
assert.equal((await api('/api/logos/p-uno', { token: A.token, method: 'PUT', body: Buffer.alloc(301 * 1024, 1), base: 0 })).status, 413, 'Oltre 300 KB non entra.');
assert.equal((await api('/api/logos/p%20uno%2F..', { token: A.token, method: 'PUT', body: red, base: 0 })).status, 404, 'Un identificativo non valido non è accettato.');
let put = await api('/api/logos/p-uno?user=altro&w=1&h=1&name=rosso.png', { token: A.token, method: 'PUT', body: red, base: 0 });
assert.equal(put.status, 201); const first = await put.json();
assert.equal(first.version, 1);
assert.equal(rowsOf('logo.a').length, 1, 'Il proprietario è l’account della sessione, non un nome inviato dal client.');
assert.equal(rowsOf('logo.b').length, 0);
assert.ok(objectsOf('logo.a').length === 1 && objectsOf('logo.a')[0].startsWith('logos/'), 'L’immagine è in R2 sotto una chiave dell’account.');
put = await api('/api/logos/p-uno', { token: A.token, method: 'PUT', body: red, base: 1 });
assert.equal(put.status, 200); assert.equal((await put.json()).unchanged, true, 'La stessa immagine non è una nuova versione.');
assert.equal(objectsOf('logo.a').length, 1, 'Nessun duplicato in R2.');
const conflict = await api('/api/logos/p-uno', { token: A.token, method: 'PUT', body: blue, base: 0 });
assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, 'conflict', 'Una versione diversa da quella vista è un conflitto.');
assert.equal(await hex(await (await api('/api/logos/p-uno', { token: A.token })).blob()), await hex(new Blob([red])), 'Dopo il conflitto online c’è ancora l’immagine di prima.');
const got = await api('/api/logos/p-uno', { token: A.token });
assert.equal(got.headers.get('content-type'), 'image/png'); assert.equal(got.headers.get('x-logo-version'), '1');
assert.equal((await api('/api/logos/p-uno', { token: B.token })).status, 404, 'L’account B non legge il logo di A.');
assert.equal((await (await api('/api/logos', { token: B.token })).json()).logos.length, 0, 'Né lo elenca.');
assert.equal((await api('/api/logos/p-uno', { token: B.token, method: 'DELETE', base: 1 })).status, 200, 'La cancellazione di B su un logo che B non ha non tocca nulla…');
assert.equal(rowsOf('logo.a').length, 1, '…e il logo di A resta.');
// the limit of the number of logos
for (let i = 0; i < 59; i++) assert.equal((await api(`/api/logos/l-${i}`, { token: B.token, method: 'PUT', body: png(i, 0, 0), base: 0 })).status, 201);
assert.equal((await api('/api/logos/l-59', { token: B.token, method: 'PUT', body: png(9, 9, 9), base: 0 })).status, 201);
const over = await api('/api/logos/l-60', { token: B.token, method: 'PUT', body: png(10, 9, 9), base: 0 });
assert.equal(over.status, 409); assert.equal((await over.json()).code, 'limit', 'Oltre 60 loghi per account no.');
for (let i = 0; i < 60; i++) await api(`/api/logos/l-${i}`, { token: B.token, method: 'DELETE', base: 1 });
await api('/api/logos/p-uno', { token: A.token, method: 'DELETE', base: 1 });

// ---------- 2. synchronisation: upload, idempotence, replacement ----------
await wipeDevice(A); await signIn(A);
await logos.saveLogo('party-uno', prepared(255, 0, 0), { fileName: 'rosso.png' });
let report = await sync.syncLogos();
assert.deepEqual(report.uploaded, ['party-uno'], 'Il logo nuovo sale.'); assert.equal(report.pending, 0);
let record = await localRecord(A, 'party-uno');
assert.equal(record.sync.version, 1); assert.equal(record.dirty, false, 'Dopo il caricamento verificato non è più in attesa.');
assert.equal(record.sync.sha, rowsOf('logo.a').find(row => row.party_id === 'party-uno').sha256, 'Il checksum del cloud è quello dell’immagine locale.');
report = await sync.syncLogos();
assert.deepEqual([report.uploaded, report.downloaded, report.conflicts], [[], [], []], 'Ripetere la sincronizzazione non crea nulla.');
assert.equal(objectsOf('logo.a').length, 1); assert.equal(rowsOf('logo.a').length, 1);
await logos.saveLogo('party-uno', prepared(0, 255, 0), { fileName: 'verde.png' });
report = await sync.syncLogos();
assert.deepEqual(report.uploaded, ['party-uno']); assert.equal((await localRecord(A, 'party-uno')).sync.version, 2, 'La sostituzione è la versione 2.');
assert.equal(objectsOf('logo.a').length, 1, 'La vecchia immagine è stata tolta da R2: un solo oggetto.');

// ---------- 3. a second device: the same account recovers its logos ----------
const greenSha = (await localRecord(A, 'party-uno')).sha;
await wipeDevice(A);
assert.equal((await logos.logoStore.all(A.username)).length, 0, 'Il secondo dispositivo parte vuoto.');
report = await sync.syncLogos();
assert.deepEqual(report.downloaded, ['party-uno'], 'Il secondo dispositivo scarica il logo.');
record = await localRecord(A, 'party-uno');
assert.equal(record.sha, greenSha); assert.equal(await hex(record.blob), greenSha, 'I byte sono quelli caricati (checksum).');
assert.ok(logos.resolveLogo('party-uno'), 'Il logo è usabile subito (cache locale).');

// ---------- 4. account B: isolation in the synchronisation ----------
await signIn(B);
assert.equal(logos.resolveLogo('party-uno'), null, 'B non vede il logo di A sul dispositivo.');
report = await sync.syncLogos();
assert.deepEqual([report.uploaded, report.downloaded], [[], []], 'B non scarica nulla di A.');
await logos.saveLogo('party-uno', prepared(0, 0, 255), { fileName: 'blu.png' });
await sync.syncLogos();
assert.equal(rowsOf('logo.b').length, 1); assert.equal(rowsOf('logo.a').length, 1);
assert.notEqual(rowsOf('logo.b')[0].sha256, rowsOf('logo.a')[0].sha256, 'Lo stesso partito, due account, due logo indipendenti.');
await signIn(A);
assert.equal((await logos.logoStore.all(B.username)).length, 1, 'La cache di B non si mescola con quella di A.');
assert.equal(await hex((await localRecord(A, 'party-uno')).blob), greenSha, 'Il logo di A è intatto.');

// ---------- 5. a conflict keeps both copies ----------
// device 1 (this cache) changes the logo and uploads; device 2 (an older cache) changed it too without knowing.
const device2 = (await logos.logoStore.all(A.username)).map(item => ({ ...item }));
await logos.saveLogo('party-uno', prepared(255, 255, 0), { fileName: 'giallo.png' });
await sync.syncLogos(); const yellowRemote = rowsOf('logo.a')[0].sha256;
for (const item of await logos.logoStore.all(A.username)) await logos.logoStore.remove(item.key);
for (const item of device2) await logos.logoStore.put(item);
await logos.loadLogos();
await logos.saveLogo('party-uno', prepared(255, 0, 255), { fileName: 'viola.png' });
const violaLocal = (await localRecord(A, 'party-uno')).sha;
report = await sync.syncLogos();
assert.deepEqual(report.conflicts, ['party-uno'], 'Copie diverse: conflitto segnalato.');
assert.equal(rowsOf('logo.a')[0].sha256, yellowRemote, 'Il cloud non è stato sovrascritto.');
assert.equal((await localRecord(A, 'party-uno')).sha, violaLocal, 'La copia locale non è stata toccata.');
assert.equal((await sync.listLogoConflicts()).length, 1, 'La copia del cloud è conservata accanto a quella locale.');
report = await sync.syncLogos();
assert.deepEqual(report.conflicts, ['party-uno'], 'Il conflitto resta aperto finché non si sceglie (nessun automatismo).');
await sync.resolveLogoConflict('party-uno', 'remote');
assert.equal((await localRecord(A, 'party-uno')).sha, yellowRemote, 'Scelta «quello dell’account»: la copia locale è quella del cloud.');
assert.equal((await sync.listLogoConflicts()).length, 0);
await logos.saveLogo('party-uno', prepared(1, 2, 3), { fileName: 'altro.png' });   // local change on top of the version it knows
report = await sync.syncLogos(); assert.deepEqual(report.uploaded, ['party-uno'], 'Una modifica sopra la versione nota sale senza conflitto.');
// a conflict resolved with «keep mine»
const before = (await logos.logoStore.all(A.username)).map(item => ({ ...item }));
await logos.saveLogo('party-uno', prepared(9, 9, 9), { fileName: 'nove.png' }); await sync.syncLogos();
for (const item of await logos.logoStore.all(A.username)) await logos.logoStore.remove(item.key);
for (const item of before) await logos.logoStore.put(item);
await logos.loadLogos(); await logos.saveLogo('party-uno', prepared(7, 7, 7), { fileName: 'sette.png' });
report = await sync.syncLogos(); assert.deepEqual(report.conflicts, ['party-uno']);
const sevenSha = (await localRecord(A, 'party-uno')).sha;
await sync.resolveLogoConflict('party-uno', 'local');
assert.equal(rowsOf('logo.a')[0].sha256, sevenSha, 'Scelta «tieni il mio»: ora il cloud ha quella del dispositivo.'); assert.equal(objectsOf('logo.a').length, 1);

// ---------- 6. offline, outages and retry ----------
await logos.saveLogo('party-due', prepared(50, 60, 70), { fileName: 'due.png' });
local.r2Control.failPut = 1;
report = await sync.syncLogos();
assert.ok(report.errors.length === 1 && report.pending === 1, 'Se il bucket non risponde il logo resta in attesa e l’errore è detto.');
assert.equal((await localRecord(A, 'party-due')).dirty, true); assert.ok(logos.resolveLogo('party-due'), 'Il logo resta usabile.');
assert.equal(rowsOf('logo.a').filter(row => row.party_id === 'party-due').length, 0, 'Nessuna riga a metà.'); assert.equal(objectsOf('logo.a').length, 1, 'Nessun oggetto orfano.');
globalThis.location = new URL('http://127.0.0.1:9/');   // the service cannot be reached
report = await sync.syncLogos();
assert.equal(report.offline, true); assert.ok(report.pending >= 1, 'Offline: il logo attende e nulla è perso.');
assert.ok(logos.resolveLogo('party-due'), 'Offline il logo si usa dalla cache.');
globalThis.location = new URL('http://127.0.0.1:8791/');
report = await sync.syncLogos();
assert.deepEqual(report.uploaded, ['party-due']); assert.equal(report.pending, 0, 'Tornata la rete il logo sale.');
await sync.syncLogos(); assert.equal(rowsOf('logo.a').length, 2); assert.equal(objectsOf('logo.a').length, 2, 'Nessun duplicato dopo i tentativi ripetuti.');

// ---------- 7. deletion ----------
await logos.deleteLogo('party-due');
assert.equal(logos.resolveLogo('party-due'), null, 'Cancellato subito sul dispositivo.');
local.r2Control.failDelete = 1;
report = await sync.syncLogos();
assert.ok(report.errors.length === 1 && report.pending === 1, 'Se il bucket non cancella, il segno di cancellazione resta e si riprova.');
assert.equal(objectsOf('logo.a').length, 2);
report = await sync.syncLogos(); assert.deepEqual(report.removed, ['party-due']); assert.equal(objectsOf('logo.a').length, 1, 'L’immagine è stata tolta da R2.');
assert.equal((await api('/api/logos/party-due', { token: A.token })).status, 404);
assert.equal((await (await api('/api/logos', { token: A.token })).json()).logos.find(item => item.partyId === 'party-due').deleted, true, 'Un altro dispositivo vede che è stato cancellato.');

// ---------- 8. the logos of the earlier version and of the guest scope ----------
await wipeDevice(A);
const legacyPrepared = prepared(11, 22, 33);
await logos.logoStore.put({ key: logos.logoStore.keyOf(logos.LEGACY_SCOPE, 'party-vecchio'), scope: logos.LEGACY_SCOPE, partyId: 'party-vecchio', blob: legacyPrepared.blob, mimeType: 'image/png', width: 1, height: 1, bytes: legacyPrepared.bytes, fileName: 'vecchio.png', origin: 'legacy', alt: '', addedAt: 'x', updatedAt: 'x' });
assert.equal((await logos.listLegacyLogos()).length, 1);
let guestCount = 0;
assert.equal(rowsOf('logo.a').some(row => row.party_id === 'party-vecchio'), false, 'Un logo ereditato non va in nessun account da solo.');
report = await sync.syncLogos(); assert.ok(!report.uploaded.includes('party-vecchio'), 'La sincronizzazione non assegna i loghi ereditati.');
await logos.claimLegacyLogo('party-vecchio');
assert.equal((await logos.listLegacyLogos()).length, 0, 'Dopo la scelta non compare più tra gli ereditati…');
assert.ok((await logos.logoStore.all(logos.LEGACY_SCOPE)).some(item => item.partyId === 'party-vecchio' && item.blob), '…ma l’originale c’è ancora finché il caricamento non è verificato.');
local.r2Control.failPut = 1;
report = await sync.syncLogos(); assert.equal(report.errors.length, 1);
assert.ok((await logos.logoStore.all(logos.LEGACY_SCOPE)).some(item => item.partyId === 'party-vecchio' && item.blob), 'Caricamento fallito: l’originale è ancora lì.');
await assert.rejects(() => logos.claimLegacyLogo('party-vecchio'), /non c’è più/, 'Ripetere la scelta non crea un doppione.');
report = await sync.syncLogos(); assert.deepEqual(report.uploaded, ['party-vecchio']);
assert.equal((await logos.logoStore.all(logos.LEGACY_SCOPE)).length, 0, 'Verificato il caricamento, l’originale è stato tolto.');
assert.equal(rowsOf('logo.a').filter(row => row.party_id === 'party-vecchio').length, 1);
const legacySha = await hex(legacyPrepared.blob);
assert.equal(rowsOf('logo.a').find(row => row.party_id === 'party-vecchio').sha256, legacySha, 'L’immagine è identica all’originale.');
await sync.syncLogos(); assert.equal(rowsOf('logo.a').filter(row => row.party_id === 'party-vecchio').length, 1, 'Idempotente.');
// guest
await signIn(null);
await logos.saveLogo('party-ospite', prepared(100, 100, 100), { fileName: 'ospite.png' });
assert.equal((await sync.syncLogos()).skipped, true, 'Senza account non si carica nulla.');
await signIn(A);
assert.equal((await sync.syncLogos()).uploaded.includes('party-ospite'), false, 'Il logo ospite non finisce nell’account all’accesso.');
assert.equal((await logos.listGuestLogos()).length, 1, 'Viene proposto, non assegnato.');
await logos.importGuestLogo('party-ospite');
report = await sync.syncLogos(); assert.deepEqual(report.uploaded, ['party-ospite'], 'Dopo la scelta esplicita sale.');
assert.equal((await logos.listGuestLogos()).length, 0); assert.ok((await logos.logoStore.all('_ospite')).some(item => item.partyId === 'party-ospite' && item.blob), 'L’originale ospite resta.');

// ---------- 9. deletion of the account ----------
const countA = objectsOf('logo.a').length; assert.ok(countA >= 2);
const proofA = A.proof;
local.r2Control.failList = 1;
let del = await api('/api/account', { token: A.token, method: 'DELETE', body: JSON.stringify({ confirm: 'ELIMINA', proof: proofA }), headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.200' } });
assert.equal(del.status, 502, 'Se il bucket non risponde l’account NON viene eliminato a metà.');
assert.equal(local.sqlite.prepare('SELECT COUNT(*) AS n FROM users WHERE username = ?').get('logo.a').n, 1); assert.equal(objectsOf('logo.a').length, countA);
const idA = local.sqlite.prepare('SELECT id FROM users WHERE username = ?').get('logo.a').id;
del = await api('/api/account', { token: A.token, method: 'DELETE', body: JSON.stringify({ confirm: 'ELIMINA', proof: proofA }), headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.200' } });
assert.equal(del.status, 200, 'Al secondo tentativo l’account è eliminato.');
assert.equal([...local.r2Data.keys()].filter(key => key.startsWith(`logos/${idA}/`)).length, 0, 'Nessuna immagine di A resta in R2.');
assert.equal(local.sqlite.prepare('SELECT COUNT(*) AS n FROM logos WHERE user_id = ?').get(idA).n, 0, 'Né righe in D1.');
assert.equal(rowsOf('logo.b').length, 1, 'I loghi di B non sono toccati.'); assert.equal(objectsOf('logo.b').length, 1);

// ---------- 10. not configured: no bucket ----------
await local.close();
const bare = await startLocalWorker({ port: 8791, withLogos: false });
const reg = await fetch(`${bare.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.210' }, body: JSON.stringify({ username: 'logo.c', proof: await client.passwordProof('logo.c', 'password-di-c') }) });
const C = { username: 'logo.c', token: (await reg.json()).token };
assert.ok(!(await (await fetch(`${bare.origin}/api/account/status`)).json()).features.includes('logo-sync'), 'Senza bucket il servizio non dichiara la sincronizzazione.');
await signIn(C);
await logos.saveLogo('party-solo', prepared(1, 1, 1), { fileName: 'solo.png' });
report = await sync.syncLogos();
assert.equal(report.unavailable, true, 'Senza bucket la sincronizzazione dice che non è attiva…');
assert.ok(logos.resolveLogo('party-solo') && (await localRecord(C, 'party-solo')).dirty, '…e il logo resta sul dispositivo, in attesa.');
await bare.close();
console.log('Loghi sincronizzati sull’account: percorsi autenticati con proprietario dalla sessione, limiti e validazione, conflitti mai sovrascritti, caricamento verificato dal checksum, idempotenza, secondo dispositivo che recupera i logo, isolamento fra account, offline e guasti del bucket con ripetizione senza duplicati né orfani, cancellazione, migrazione dei loghi ereditati e ospite solo su scelta e con l’originale tolto dopo la verifica, eliminazione dell’account con pulizia di R2 e D1 (e nessuna eliminazione a metà), assenza di bucket gestita.');
process.exit(0);
