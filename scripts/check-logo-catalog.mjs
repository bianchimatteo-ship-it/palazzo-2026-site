// The shared logo catalog: a logo approved in the Admin is a published file, for every player and device. The Worker API (Workers KV stand-in, or an R2 bucket stand-in) and the client:
// upload, approval, persistence across deploys, the same file read without any session, replacement, removal, SVG and size limits, unknown parties, path traversal, protection of the admin
// API, idempotent publishing (no duplicates), the move of old data-address logos to files, and what the page may call "published" (only what the server confirmed). Nothing here reaches the
// production archive: the KV, the R2 bucket and the static files are in-process stand-ins.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const kvData = new Map();
const kv = {
  async get(key, type) { const entry = kvData.get(key); if (!entry || (entry.expires && entry.expires < Date.now())) return null; return type === 'json' ? JSON.parse(entry.value) : entry.value; },
  async put(key, value, options = {}) { kvData.set(key, { value: String(value), expires: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null }); },
  async delete(key) { kvData.delete(key); }
};
const assets = { fetch: async request => { const path = new URL(request.url).pathname; try { return new Response(await readFile(new URL(`..${path}`, import.meta.url)), { headers: { 'content-type': 'application/json' } }); } catch { return new Response('not found', { status: 404 }); } } };
const env = { ADMIN_ARCHIVE: kv, ADMIN_SETUP_CODE: 'attivazione-di-prova', ASSETS: assets };
const deploy = async version => (await import(`../worker.js?logos=${version}`)).default;
let worker = await deploy(1);
const call = async (path, init = {}, headers = {}, theEnv = env) => {
  const response = await worker.fetch(new Request(ORIGIN + path, { ...init, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers } }), theEnv);
  const buffer = new Uint8Array(await response.arrayBuffer());
  let body = null; try { body = JSON.parse(new TextDecoder().decode(buffer)); } catch { /* binary */ }
  return { status: response.status, headers: response.headers, body, bytes: buffer };
};

// small valid files
const crcTable = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = bytes => { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const { deflateSync } = await import('node:zlib');
function png(width, height, shade) {
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, shade)]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
const b64 = buffer => Buffer.from(buffer).toString('base64');
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>Logo</title><rect x="1" y="1" width="8" height="8" fill="#c4a66a"/><circle cx="5" cy="5" r="2" fill="url(#g)"/><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs></svg>';

const PARTY = 'party-registro-p1-2014-01-ir', OTHER = 'party-registro-p1-2015-20-ir';
// ---------- 1. who may write ----------
assert.equal((await call(`/api/admin/logos/${PARTY}`, { method: 'PUT', body: JSON.stringify({ base64: b64(png(8, 8, 90)) }) })).status, 401, 'Senza sessione non si pubblica un logo.');
assert.equal((await call(`/api/admin/logos/${PARTY}`, { method: 'DELETE' })).status, 401, 'Senza sessione non si rimuove.');
assert.equal((await call('/api/admin/logos/migrate', { method: 'POST', body: '{}' })).status, 401, 'Senza sessione non si migra.');
assert.equal((await call(`/api/admin/logos/${PARTY}`, { method: 'PUT', body: '{}' }, { authorization: 'Bearer ' + 'a'.repeat(48) })).status, 401, 'Un token inventato non vale.');
assert.equal((await call(`/api/admin/logo/${PARTY}`)).status, 404, 'Un logo non pubblicato non esiste (e la lettura è pubblica ma non rivela nulla).');
const session = await call('/api/admin/session', { method: 'POST', body: JSON.stringify({ pin: 'pin-segreto-1', setupCode: 'attivazione-di-prova' }) });
assert.equal(session.status, 200);
const auth = { authorization: `Bearer ${session.body.token}` };
const put = (id, body, headers = auth, theEnv = env) => call(`/api/admin/logos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }, headers, theEnv);

// ---------- 2. upload, approval, the file for everybody ----------
const first = png(32, 32, 120);
let result = await put(PARTY, { base64: b64(first), alt: 'Logo di prova', sourceUrl: 'https://example.org/logo', fileName: 'logo.png' });
assert.equal(result.status, 200, JSON.stringify(result.body));
assert.equal(result.body.logo.kind, 'asset');
assert.equal(result.body.logo.sha256, sha(first), 'Il catalogo conserva l’impronta del file.');
assert.equal(result.body.logo.mimeType, 'image/png');
assert.equal(result.body.logo.bytes, first.length);
assert.ok(result.body.logo.assetPath.startsWith(`/api/admin/logo/${PARTY}?v=`), 'Il riferimento è un percorso del catalogo, non un blob: né un indirizzo temporaneo.');
assert.ok(!('dataUrl' in result.body.logo) && !('url' in result.body.logo));
assert.equal(result.body.replaced, false); assert.equal(result.body.unchanged, false);
const shown = await call(result.body.logo.assetPath);
assert.equal(shown.status, 200);
assert.deepEqual(Buffer.from(shown.bytes), first, 'Il file servito è quello caricato, byte per byte.');
assert.equal(shown.headers.get('content-type'), 'image/png');
assert.equal(shown.headers.get('x-content-type-options'), 'nosniff');
assert.match(shown.headers.get('cache-control'), /immutable/, 'Con la versione nel percorso la cache è lunga.');
assert.equal(shown.headers.get('etag'), `"${sha(first)}"`);
assert.equal((await call(`/api/admin/logo/${PARTY}`, {}, { 'if-none-match': `"${sha(first)}"` })).status, 304, 'Il file non cambiato non si riscarica.');
const catalog = await call('/api/admin');
assert.equal(catalog.body.logos[PARTY].sha256, sha(first), 'Il catalogo pubblico elenca il logo.');
assert.ok(JSON.stringify(catalog.body).length < 20_000, 'Il file non è dentro l’archivio: l’archivio resta piccolo.');
// another session / device: nothing but the public address is needed
const elsewhere = await call(catalog.body.logos[PARTY].assetPath, {}, { 'cf-connecting-ip': '198.51.100.20' });
assert.deepEqual(Buffer.from(elsewhere.bytes), first, 'Un altro dispositivo, senza alcuna sessione, legge lo stesso logo.');

// ---------- 3. persistence: a new deploy, same storage ----------
worker = await deploy(2);
assert.deepEqual(Buffer.from((await call(catalog.body.logos[PARTY].assetPath)).bytes), first, 'Dopo un nuovo deploy il logo c’è ancora.');
assert.equal((await call('/api/admin')).body.logos[PARTY].sha256, sha(first));

// ---------- 4. idempotent: the same file twice writes nothing twice ----------
const files = () => [...kvData.keys()].filter(key => key.startsWith('logo-file:'));
assert.equal(files().length, 1);
const stamp = (await call('/api/admin')).body.updatedAt;
result = await put(PARTY, { base64: b64(first), alt: 'Logo di prova', sourceUrl: 'https://example.org/logo' });
assert.equal(result.status, 200); assert.equal(result.body.unchanged, true, 'Lo stesso file già pubblicato non cambia nulla.');
assert.equal(files().length, 1, 'Nessun file doppio.');
assert.equal((await call('/api/admin')).body.updatedAt, stamp, 'E l’archivio non viene riscritto.');
// the same file for a second party: stored once, two entries
result = await put(OTHER, { base64: b64(first), alt: 'Altro' });
assert.equal(result.status, 200);
assert.equal(files().length, 1, 'Lo stesso file per due partiti è conservato una volta.');

// ---------- 5. replacement ----------
const second = png(48, 24, 200);
result = await put(PARTY, { base64: b64(second), alt: 'Nuovo logo' });
assert.equal(result.body.replaced, true);
assert.deepEqual(Buffer.from((await call(`/api/admin/logo/${PARTY}`)).bytes), second, 'Il logo sostituito è il nuovo.');
assert.deepEqual(Buffer.from((await call(`/api/admin/logo/${OTHER}`)).bytes), first, 'L’altro partito conserva il suo, che il file sostituito non toglie.');
assert.equal(files().length, 2);
// ---------- 6. removal ----------
result = await call(`/api/admin/logos/${PARTY}`, { method: 'DELETE' }, auth);
assert.equal(result.status, 200); assert.equal(result.body.removed, true);
assert.equal((await call(`/api/admin/logo/${PARTY}`)).status, 404, 'Rimosso: non c’è più per nessuno.');
assert.equal(files().length, 1, 'Il file non più usato è eliminato; quello ancora usato resta.');
assert.equal((await call(`/api/admin/logos/${PARTY}`, { method: 'DELETE' }, auth)).body.removed, false, 'Rimuovere due volte è innocuo.');
await call(`/api/admin/logos/${OTHER}`, { method: 'DELETE' }, auth);
assert.equal(files().length, 0, 'Nessun file orfano.');

// ---------- 7. what is refused ----------
const refuse = async (body, status, message, id = PARTY) => { const r = await put(id, body); assert.equal(r.status, status, `${message} (${r.status}: ${JSON.stringify(r.body)})`); assert.equal(files().length, 0, `${message}: nulla è stato scritto.`); return r; };
await refuse({ base64: b64(Buffer.from('questo è un testo, non un’immagine')) }, 400, 'Un file che non è un’immagine');
await refuse({ base64: b64(png(5000, 10, 1)) }, 400, 'Un PNG troppo largo');
await refuse({ base64: b64(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(2_200_000, 1)])) }, 413, 'Un file oltre 2 MB');
await refuse({ base64: 'non è base64!!' }, 413, 'Un contenuto non base64');
await refuse({ }, 400, 'Una richiesta senza file');
await refuse({ base64: b64(png(8, 8, 3)) }, 404, 'Un partito che non esiste', 'party-inventato-non-esiste');
await refuse({ base64: b64(png(8, 8, 3)) }, 400, 'Un identificativo con percorso', '../../chiavi/segrete');
await refuse({ base64: b64(png(8, 8, 3)) }, 400, 'Un identificativo con barre', 'a/b');
assert.equal((await call('/api/admin/logo/..%2F..%2Fsessione', {})).status, 404, 'Il percorso di lettura non esce dal catalogo.');
const svgBad = {
  'script': '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  'gestore di evento': '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>',
  'riferimento esterno': '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://evil.example/x)"/></svg>',
  'immagine incorporata': '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
  'foreignObject': '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>',
  'DOCTYPE': '<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
  'stile': '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example)</style><rect/></svg>',
  'href': '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/a.svg#x"/></svg>',
  'non chiuso': '<svg xmlns="http://www.w3.org/2000/svg"><rect>',
  'javascript:': '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="javascript:alert(1)"/></svg>'
};
for (const [name, text] of Object.entries(svgBad)) await refuse({ base64: b64(Buffer.from(text)) }, 400, `SVG con ${name}`);
await refuse({ base64: b64(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${'<rect/>'.repeat(40_000)}</svg>`)) }, 400, 'Un SVG enorme');
result = await put(PARTY, { base64: b64(Buffer.from(SVG)), alt: 'SVG' });
assert.equal(result.status, 200, JSON.stringify(result.body));
const svgShown = await call(`/api/admin/logo/${PARTY}`);
assert.equal(svgShown.headers.get('content-type'), 'image/svg+xml');
assert.match(svgShown.headers.get('content-security-policy'), /sandbox/, 'Un SVG servito non può eseguire nulla.');
assert.equal(Buffer.from(svgShown.bytes).toString(), SVG);
await call(`/api/admin/logos/${PARTY}`, { method: 'DELETE' }, auth);

// ---------- 8. the archive written by a page does not take the files away ----------
await put(PARTY, { base64: b64(first), alt: 'x' });
const archive = (await call('/api/admin')).body;
const { updatedAt, configured, source, ...sent } = archive;
let saved = await call('/api/admin', { method: 'PUT', body: JSON.stringify({ ...sent, logos: {} }) }, auth);
assert.equal(saved.status, 200);
assert.equal((await call('/api/admin')).body.logos[PARTY]?.sha256, sha(first), 'Un archivio scritto da una pagina senza quel logo non lo cancella.');
assert.equal((await call(`/api/admin/logo/${PARTY}`)).status, 200);
saved = await call('/api/admin', { method: 'PUT', body: JSON.stringify({ ...sent, logos: { [OTHER]: { kind: 'asset', sha256: 'f'.repeat(64), assetPath: '/api/admin/logo/x', mimeType: 'image/png' } } }) }, auth);
assert.equal((await call('/api/admin')).body.logos[OTHER], undefined, 'Una pagina non può inventare un logo-file: solo il server li crea.');
assert.equal((await call(`/api/admin/logo/${OTHER}`)).status, 404);
saved = await call('/api/admin', { method: 'PUT', body: JSON.stringify({ ...sent, logos: { [PARTY]: { url: 'https://example.org/uno.png', alt: 'a' } } }) }, auth);
assert.equal((await call('/api/admin')).body.logos[PARTY].url, 'https://example.org/uno.png', 'Sostituire un logo-file con un indirizzo è una scelta del proprietario e vale.');
assert.equal(files().length, 0, 'Il file sostituito non resta orfano.');

// ---------- 9. old data-address logos move to files, once ----------
const old = png(16, 16, 33);
await call('/api/admin', { method: 'PUT', body: JSON.stringify({ ...sent, logos: { [PARTY]: { dataUrl: `data:image/png;base64,${b64(old)}`, alt: 'Vecchio' } } }) }, auth);
assert.equal((await call('/api/admin')).body.logos[PARTY].kind, 'data');
let moved = await call('/api/admin/logos/migrate', { method: 'POST', body: '{}' }, auth);
assert.deepEqual(moved.body.migrated, [PARTY]); assert.deepEqual(moved.body.failed, []);
const migrated = (await call('/api/admin')).body.logos[PARTY];
assert.equal(migrated.kind, 'asset'); assert.ok(!('dataUrl' in migrated), 'L’indirizzo dati non c’è più nell’archivio.');
assert.deepEqual(Buffer.from((await call(`/api/admin/logo/${PARTY}`)).bytes), old, 'Il logo è lo stesso di prima.');
moved = await call('/api/admin/logos/migrate', { method: 'POST', body: '{}' }, auth);
assert.deepEqual(moved.body.migrated, [], 'Rifarlo non cambia nulla (riconciliazione idempotente).');
assert.equal(files().length, 1);

// ---------- 10. an R2 bucket, when the Worker has one ----------
const bucket = new Map();
const r2 = { async put(key, bytes) { bucket.set(key, new Uint8Array(bytes)); }, async get(key) { const bytes = bucket.get(key); return bytes ? { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } : null; }, async delete(key) { bucket.delete(key); } };
const r2Env = { ...env, LOGO_BUCKET: r2 };
await call(`/api/admin/logos/${PARTY}`, { method: 'DELETE' }, auth);
result = await put(OTHER, { base64: b64(second), alt: 'R2' }, auth, r2Env);
assert.equal(result.status, 200); assert.equal(result.body.logo.storage, 'r2');
assert.equal(bucket.size, 1); assert.equal(files().length, 0, 'Con il bucket il file non va in KV.');
assert.deepEqual(Buffer.from((await call(`/api/admin/logo/${OTHER}`, {}, {}, r2Env)).bytes), second);
await call(`/api/admin/logos/${OTHER}`, { method: 'DELETE' }, auth, r2Env);
assert.equal(bucket.size, 0);

// ---------- 11. the session: an expired one writes nothing ----------
kvData.delete(`sessione:${session.body.token}`);
assert.equal((await put(PARTY, { base64: b64(first) })).status, 401, 'Una sessione scaduta non pubblica.');
assert.equal(files().length, 0);

// ---------- 12. the client: "published" is what the server confirmed ----------
const memory = new Map(); const sessionMemory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) };
globalThis.sessionStorage = { getItem: key => sessionMemory.get(key) ?? null, setItem: (key, value) => sessionMemory.set(key, String(value)), removeItem: key => sessionMemory.delete(key) };
globalThis.location = { hostname: 'palazzo-2026-site.bianchimatteo657.workers.dev', origin: ORIGIN, port: '', protocol: 'https:', hash: '' };
let mode = 'live', calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push([String(url), init.method ?? 'GET']);
  if (mode === 'down') throw new TypeError('rete non raggiungibile');
  if (mode === 'unconfirmed') return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (mode === 'error') return new Response(JSON.stringify({ error: 'Errore interno' }), { status: 500, headers: { 'content-type': 'application/json' } });
  const headers = Object.fromEntries(new Headers(init.headers ?? {}));
  const response = await worker.fetch(new Request(String(url), { ...init, headers: { ...headers, 'cf-connecting-ip': '203.0.113.50' } }), env);
  return response;
};
const version = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const sync = await import(`../src/data/repositories/admin-sync.js?v=${version}`);
const store = await import(`../src/data/repositories/admin-store.js?v=${version}`);
const blobA = new Blob([png(20, 20, 77)], { type: 'image/png' });
// no session: it cannot publish, and the state stays "only in this browser"
await assert.rejects(() => sync.publishLogoFile(PARTY, blobA, { alt: 'a' }), /sessione amministrativa/i);
assert.equal(sync.publicationState(PARTY, { partyId: PARTY }).status, 'local', 'Senza conferma del server il logo è «Solo in questo browser».');
assert.equal(sync.publicationState(PARTY, { partyId: PARTY }).label, 'Solo in questo browser');
const login = await sync.openSharedSession('pin-segreto-1');
assert.ok(login.token);
// the server is down / errors / does not confirm: still local, the copy is kept, and the error says so
for (const failure of ['down', 'error', 'unconfirmed']) {
  mode = failure;
  await assert.rejects(() => sync.publishLogoFile(PARTY, blobA, { alt: 'a' }), error => { assert.ok(error.message.length > 10); return true; }, `Pubblicazione con server ${failure}`);
  assert.equal(sync.publicationState(PARTY, { partyId: PARTY }).status, 'local', `Dopo un fallimento (${failure}) il logo non risulta pubblicato.`);
  assert.equal(store.sharedLogos()[PARTY], undefined, 'E la copia del catalogo non è stata toccata.');
}
mode = 'live';
const published = await sync.publishLogoFile(PARTY, blobA, { alt: 'Logo A', sourceUrl: 'https://example.org/a' });
assert.equal(published.logo.kind, 'asset');
assert.equal(sync.publicationState(PARTY, { partyId: PARTY }, published.logo.sha256).status, 'published', 'Confermato dal server: «Pubblicato per tutti i giocatori».');
assert.equal(sync.publicationState(PARTY, { partyId: PARTY }, published.logo.sha256).label, 'Pubblicato per tutti i giocatori');
assert.equal(sync.publicationState(PARTY, { partyId: PARTY }, 'a'.repeat(64)).status, 'outdated', 'Una copia locale diversa da quella pubblicata è segnalata.');
assert.equal(sync.sharedLogoSrc(store.sharedLogos()[PARTY]), `${ORIGIN}${published.logo.assetPath}`, 'Il logo si legge dal catalogo, non da un blob.');
assert.equal(sync.sharedLogoSrc({ kind: 'url', url: 'https://example.org/x.png' }), 'https://example.org/x.png', 'Gli indirizzi https e i loghi statici restano come prima.');
assert.equal(sync.sharedLogoSrc({ dataUrl: 'data:image/png;base64,AAAA' }), 'data:image/png;base64,AAAA');
assert.equal(await sync.sha256Of(blobA), sha(Buffer.from(await blobA.arrayBuffer())));
// re-publishing the same file (reconciliation) changes nothing
const again = await sync.publishLogoFile(PARTY, blobA, { alt: 'Logo A' });
assert.equal(again.unchanged, true);
assert.equal(files().length, 1);
await assert.rejects(() => sync.publishLogoFile(PARTY, new Blob([Buffer.alloc(3 * 1024 * 1024)]), {}), /2 MB/, 'Oltre 2 MB il client non lo manda nemmeno.');
await assert.rejects(() => sync.publishLogoFile('party-che-non-esiste', blobA, {}), /non esiste|catalogo/i, 'Un partito sconosciuto è rifiutato dal server e non risulta pubblicato.');
assert.equal(store.sharedLogos()['party-che-non-esiste'], undefined);
// remove: confirmed by the server, then gone from the local copy
const removed = await sync.removeLogoFile(PARTY);
assert.equal(removed.removed, true); assert.equal(store.sharedLogos()[PARTY], undefined); assert.equal(files().length, 0);
// an expired session is closed and says what to do
await sync.publishLogoFile(PARTY, blobA, { alt: 'x' });
for (const key of [...kvData.keys()]) if (key.startsWith('sessione:')) kvData.delete(key);
await assert.rejects(() => sync.publishLogoFile(PARTY, blobA, { alt: 'x' }), /scaduta/i);
assert.equal(sync.hasSharedSession(), false, 'Una sessione scaduta viene chiusa: serve una nuova autenticazione.');
// the page uses the catalog entry before a different local copy; the player's own parties never pass through the catalog
const appSource = await readFile(new URL('../src/ui/app.js', import.meta.url), 'utf8');
const resolver = appSource.slice(appSource.indexOf('const logoFor = party => {'), appSource.indexOf('setPartyLogoResolver(logoFor)'));
assert.ok(resolver.indexOf('sharedSrc && !waiting') < resolver.indexOf('if (local) return local'), 'Il logo condiviso approvato ha la precedenza sulla copia locale.');
assert.ok(resolver.indexOf('if (local) return local') < resolver.indexOf('userPartyLogo(party)') && resolver.includes('party?.logoAsset') && resolver.includes('logoVerified'), 'Il resto della catena (partiti dell’utente, loghi statici, URL verificati) è intatto.');
const worker_ = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
assert.ok(!/\.logoVerified|logoVerified\s*[:=]/.test(worker_.slice(worker_.indexOf('the shared logo catalog'), worker_.indexOf('player accounts and online saves'))), 'Il catalogo non tocca mai l’indicatore logoVerified.');
console.log('Catalogo loghi condiviso verificato: pubblicazione con sessione (senza è 401), file conservato per impronta in KV o in R2 (se il Worker lo ha), letto da qualsiasi dispositivo senza sessione, persistente a un nuovo deploy, idempotente (stesso file = nessuna scrittura, nessun doppione), sostituzione e rimozione senza file orfani, limiti di formato/dimensione/SVG, partito sconosciuto e percorsi non validi rifiutati, archivio della pagina che non cancella né inventa loghi-file, migrazione dei vecchi indirizzi dati, stato «pubblicato» solo se il server conferma (rete assente, errore e risposta incompleta restano «Solo in questo browser»), sessione scaduta chiusa, precedenza del logo condiviso nel resolver.');
