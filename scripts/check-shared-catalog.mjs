// The shared catalogue of the parties: what the owner adds in the admin area reaches every player, on the web and in the Android app, and only that.
//   · the Worker (Workers KV for the archive, R2 for the logos) with a Test environment and a Production one that share nothing;
//   · the owner adds a party (name, acronym, kind, state, leader), publishes it and a logo; a player with an empty browser — web or the installed app — reads it at the next start, finds it in the wizard
//     (search, filters, label), keeps the copy for offline play and does not download it again (ETag); edits and removals reach the players;
//   · who is not the owner can neither write the archive nor a logo; Test and Production never mix; the app of the store reads Production, a Test build reads Test;
//   · a party that a player founds in a career stays in that career: it is never in the catalogue of the others.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const v = html.match(/main\.js\?v=([^"']+)/)?.[1];
const TEST = 'https://politicando-test.example.workers.dev', PROD = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';

// ---------- the two environments (nothing in common) ----------
const makeKv = () => { const data = new Map(); return { data, async get(key, type) { const entry = data.get(key); if (!entry || (entry.expires && entry.expires < Date.now())) return null; return type === 'json' ? JSON.parse(entry.value) : entry.value; }, async put(key, value, options = {}) { data.set(key, { value: String(value), expires: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null }); }, async delete(key) { data.delete(key); } }; };
const makeBucket = () => { const objects = new Map(); return { objects, async put(key, bytes, options) { objects.set(key, { bytes: new Uint8Array(bytes), mime: options?.httpMetadata?.contentType }); }, async get(key) { const item = objects.get(key); return item ? { arrayBuffer: async () => item.bytes.buffer.slice(item.bytes.byteOffset, item.bytes.byteOffset + item.bytes.byteLength) } : null; }, async delete(key) { objects.delete(key); }, async list() { return { objects: [...objects.keys()].map(key => ({ key })), truncated: false }; } }; };
const assets = { fetch: async () => new Response('asset', { headers: { 'content-type': 'text/html' } }) };
const envs = { [TEST]: { ADMIN_ARCHIVE: makeKv(), LOGOS: makeBucket(), ADMIN_SETUP_CODE: 'codice-test', ASSETS: assets }, [PROD]: { ADMIN_ARCHIVE: makeKv(), LOGOS: makeBucket(), ADMIN_SETUP_CODE: 'codice-produzione', ASSETS: assets } };
const worker = (await import('../worker.js?shared-catalog')).default;
const seen = [];   // what the clients asked, to see the conditional requests
const realFetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
let offline = false;
globalThis.fetch = async (url, init = {}) => {
  const target = String(url), origin = Object.keys(envs).find(item => target.startsWith(item));
  if (!origin) return realFetch(url);
  if (offline) throw new TypeError('offline');
  const request = new Request(target, { ...init, headers: { 'cf-connecting-ip': '203.0.113.7', ...(init.headers ?? {}) } });
  const response = await worker.fetch(request, envs[origin]);
  seen.push({ method: request.method, path: new URL(target).pathname, status: response.status, conditional: Boolean(request.headers.get('if-none-match')) });
  return response;
};
const api = async (origin, path, init = {}, headers = {}) => { const response = await worker.fetch(new Request(origin + path, { ...init, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers } }), envs[origin]); return { status: response.status, headers: response.headers, body: await response.clone().json().catch(() => null), response }; };

// ---------- the browsers ----------
const browsers = {};
const useBrowser = (name, { origin, native = false, declare = null }) => {
  browsers[name] ??= { local: new Map(), session: new Map() };
  store.forgetSharedMemory();
  const { local, session } = browsers[name];
  globalThis.localStorage = { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)), removeItem: key => local.delete(key) };
  globalThis.sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, String(value)), removeItem: key => session.delete(key) };
  // the web: the page lives on the Worker; the app: its own origin (https://localhost) and the Capacitor bridge
  globalThis.location = new URL(native ? 'https://localhost/' : `${origin}/`);
  if (native) globalThis.Capacitor = { isNativePlatform: () => true }; else delete globalThis.Capacitor;
  globalThis.document = declare ? { querySelector: selector => /politicando-api-origin/.test(selector) ? { getAttribute: () => declare } : null } : { querySelector: () => null };
};
const sync = await import(`../src/data/repositories/admin-sync.js?v=${v}`);
const store = await import(`../src/data/repositories/admin-store.js?v=${v}`);
const realData = await import(`../src/data/repositories/real-data.js?v=${v}`);
const { isSelectableParty } = await import(`../src/data/schema.js?v=${v}`);
const { filterWizardParties, partySourceLabel } = await import(`../src/ui/career-wizard.js?v=${v}`);
const partiesNow = async () => { await realData.loadRealDatabase(); await realData.loadRealCollections(['parties']); realData.refreshAdminOverrides(); return realData.realDatabase.parties; };
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(60).fill(7)]);
const PNG_B = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(60).fill(9)]);

// ---------- 1. the owner, on Test ----------
useBrowser('admin', { origin: TEST });
assert.equal(sync.sharedApiUrl(), `${TEST}/api/admin`);
await sync.openSharedSession('pin-segreto-1', 'codice-test');
const id = store.addAdminParty({ officialName: 'Partito Nuovo Prova', abbreviation: 'PNP', entityType: 'politicalMovement', status: 'historical', leaderName: 'Mario Prova', politicalPosition: 'centro', color: '#112233', factualDescription: 'Aggiunto in prova.' }, []);
assert.match(id, /^admin-party-/);
await sync.publishSharedArchive();
let published = await api(TEST, '/api/admin');
assert.equal(published.body.addedParties[id].officialName, 'Partito Nuovo Prova');
assert.equal(published.body.addedParties[id].entityType, 'politicalMovement', 'La tipologia arriva al server.');
assert.equal(published.body.addedParties[id].status, 'historical');
assert.equal(published.body.addedParties[id].leaderName, 'Mario Prova');
// the logo goes to the shared store (not to a folder of the owner)
const logoResult = await sync.publishCatalogLogo(id, new Blob([PNG], { type: 'image/png' }));
assert.ok(logoResult.ok && logoResult.sha256, 'Il logo è pubblicato per tutti.');
assert.equal([...envs[TEST].LOGOS.objects.keys()].filter(key => key.startsWith('admin-logos/')).length, 1, 'Il logo è nel bucket, sotto admin-logos/.');
assert.equal(envs[PROD].LOGOS.objects.size, 0, 'Nulla è passato alla Produzione.');

// ---------- 2. a player on the web (another browser, another account) ----------
useBrowser('player-web', { origin: TEST });
{ const changed = await sync.refreshSharedArchive(); assert.ok(changed, 'Il giocatore scarica il catalogo condiviso all’avvio. ' + JSON.stringify(sync.sharedSyncStatus())); }
let parties = await partiesNow();
const added = parties.find(item => item.id === id);
assert.ok(added, 'Il partito aggiunto dall’amministratore compare nel catalogo di un altro giocatore.');
assert.equal(added.entityType, 'politicalMovement'); assert.equal(added.status, 'historical'); assert.equal(added.leadership?.[0]?.name, 'Mario Prova'); assert.ok(added.adminCreated);
assert.ok(isSelectableParty(added), 'Si può scegliere nel wizard.');
assert.equal(partySourceLabel(added), 'AGGIUNTO DALL’AMMINISTRATORE · NON VERIFICATO', 'È dichiarato dato dell’amministratore, non verificato e non «creato da te».');
const selectable = parties.filter(isSelectableParty);
assert.ok(filterWizardParties(selectable, { partyQuery: 'PNP' }).some(item => item.id === id), 'La ricerca per sigla lo trova.');
assert.ok(filterWizardParties(selectable, { partyQuery: 'nuovo prova' }).some(item => item.id === id), 'La ricerca per nome lo trova.');
assert.ok(filterWizardParties(selectable, { partyFilter: 'admin' }).some(item => item.id === id), 'Il filtro «Aggiunti dall’amministratore» lo comprende.');
assert.ok(!filterWizardParties(selectable, { partyFilter: 'real' }).some(item => item.id === id), 'Non è tra i dati reali verificati.');
assert.ok(!filterWizardParties(selectable, { partyFilter: 'user' }).some(item => item.id === id), 'Non è tra quelli «creati da te».');
assert.ok(filterWizardParties(selectable, { partyStatus: 'historical' }).some(item => item.id === id), 'Il filtro dello stato (storico) lo comprende.');
const logoUrl = sync.sharedLogoUrl(id);
assert.ok(logoUrl && logoUrl.startsWith(`${TEST}/api/admin/catalog-logos/${id}?v=`), 'Il giocatore sa dove leggere il logo.');
const image = await fetch(logoUrl);
assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png'); assert.match(image.headers.get('cache-control'), /immutable/);
assert.deepEqual(new Uint8Array(await image.arrayBuffer()), PNG, 'Il logo è quello pubblicato.');
const etag = image.headers.get('etag');
const again = await worker.fetch(new Request(logoUrl, { headers: { 'if-none-match': etag } }), envs[TEST]);
assert.equal(again.status, 304, 'Il logo già in cache non si scarica di nuovo.');
// no repeated download of the catalogue: the second read answers «not modified»
seen.length = 0;
await sync.refreshSharedArchive();
assert.ok(seen.some(call => call.path === '/api/admin' && call.conditional && call.status === 304), 'Una seconda lettura senza novità risponde «non modificato».');
assert.ok(store.loadSharedArchive().addedParties[id], 'E la copia locale resta quella di prima.');

// ---------- 3. the installed app (Android): same archive as the web ----------
useBrowser('android-test', { native: true, declare: TEST });
assert.equal(sync.sharedApiUrl(), `${TEST}/api/admin`, 'L’app di Test legge l’archivio di Test.');
assert.ok(await sync.refreshSharedArchive());
assert.ok((await partiesNow()).find(item => item.id === id), 'Il partito compare anche nell’app Android di Test.');
// offline: the copy kept is used
offline = true;
assert.equal(await sync.refreshSharedArchive(), false);
assert.ok(store.loadSharedArchive().addedParties[id], 'Senza rete resta l’ultima copia valida.');
assert.ok((await partiesNow()).find(item => item.id === id), 'E il partito resta nel wizard.');
assert.equal(sync.sharedSyncStatus().ok, false, 'Lo stato dice che la rete non c’era (non «aggiornato»).');
offline = false;
// the app of the store (no declared address) reads Production, which has none of the Test data
useBrowser('android-store', { native: true });
assert.equal(sync.sharedApiUrl(), `${PROD}/api/admin`, 'L’app per lo store legge la Produzione.');
await sync.refreshSharedArchive();
assert.ok(!(await partiesNow()).find(item => item.id === id), 'I dati di Test non arrivano ai giocatori di Produzione.');
// an address that is not a Test Worker is ignored
useBrowser('android-bad', { native: true, declare: 'https://evil.example.com' });
assert.equal(sync.sharedApiUrl(), `${PROD}/api/admin`, 'Un indirizzo dichiarato che non è un Worker di Test viene ignorato.');

// ---------- 4. edits and removals reach the players ----------
useBrowser('admin', { origin: TEST });
store.setRecordField('parties', id, 'officialName', 'Partito Nuovo Prova Due', { officialName: 'Partito Nuovo Prova' });
store.setRecordField('parties', id, 'abbreviation', 'PNP2', { abbreviation: 'PNP' });
await sync.publishSharedArchive();
const second = await sync.publishCatalogLogo(id, new Blob([PNG_B], { type: 'image/png' }));
assert.notEqual(second.sha256, logoResult.sha256, 'Un nuovo logo è un’altra immagine.');
assert.equal([...envs[TEST].LOGOS.objects.keys()].filter(key => key.startsWith('admin-logos/')).length, 1, 'Il logo sostituito non resta nel bucket.');
useBrowser('player-web', { origin: TEST });
assert.ok(await sync.refreshSharedArchive(), 'Il giocatore riceve la modifica.');
const edited = (await partiesNow()).find(item => item.id === id);
assert.equal(edited.officialName, 'Partito Nuovo Prova Due'); assert.equal(edited.abbreviation, 'PNP2');
assert.notEqual(sync.sharedLogoUrl(id), logoUrl, 'Il logo nuovo ha un indirizzo nuovo (la copia in cache non lo nasconde).');
assert.deepEqual(new Uint8Array(await (await fetch(sync.sharedLogoUrl(id))).arrayBuffer()), PNG_B);
useBrowser('admin', { origin: TEST });
store.setRecordHidden(id, true, { deleted: true });
await sync.publishSharedArchive();
await sync.removeCatalogLogo(id);
useBrowser('player-web', { origin: TEST });
await sync.refreshSharedArchive();
const gone = (await partiesNow()).find(item => item.id === id);
assert.ok(!gone || !isSelectableParty(gone), 'Il partito rimosso dall’amministratore sparisce dal wizard.');
assert.equal(sync.sharedLogoUrl(id), null, 'E il suo logo non è più pubblicato.');
assert.equal(envs[TEST].LOGOS.objects.size, 0, 'Nessuna immagine orfana nel bucket.');

// ---------- 5. who is not the owner cannot write ----------
const sample = { parties: {}, politicians: {}, addedParties: { 'admin-party-intruso-1': { officialName: 'Intruso' } }, hidden: {} };
assert.equal((await api(TEST, '/api/admin', { method: 'PUT', body: JSON.stringify(sample) })).status, 401, 'Senza sessione l’archivio non si scrive.');
assert.equal((await api(TEST, '/api/admin', { method: 'PUT', body: JSON.stringify(sample) }, { authorization: 'Bearer 0000' })).status, 401, 'Con un codice inventato nemmeno.');
const logoPath = '/api/admin/catalog-logos/admin-party-intruso-1';
assert.equal((await worker.fetch(new Request(TEST + logoPath, { method: 'PUT', body: PNG, headers: { 'content-type': 'image/png' } }), envs[TEST])).status, 401, 'Né un logo.');
assert.equal((await worker.fetch(new Request(TEST + logoPath, { method: 'DELETE' }), envs[TEST])).status, 401, 'Né cancellarlo.');
// the owner's session of Test is worth nothing on Production
const adminToken = [...browsers.admin.session.values()][0];
assert.equal((await api(PROD, '/api/admin', { method: 'PUT', body: JSON.stringify(sample) }, { authorization: `Bearer ${adminToken}` })).status, 401, 'La sessione di Test non vale in Produzione.');
// what the owner may send is checked: kind, size, id
assert.equal((await worker.fetch(new Request(TEST + logoPath, { method: 'PUT', body: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]), headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'image/png' } }), envs[TEST])).status, 415, 'Un file che non è PNG, JPEG o WebP è rifiutato.');
assert.equal((await worker.fetch(new Request(TEST + logoPath, { method: 'PUT', body: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(310 * 1024).fill(1)]), headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'image/png' } }), envs[TEST])).status, 413, 'Un logo troppo grande è rifiutato.');
assert.equal((await worker.fetch(new Request(`${TEST}/api/admin/catalog-logos/../../x`, { method: 'PUT', body: PNG, headers: { authorization: `Bearer ${adminToken}` } }), envs[TEST])).status, 404, 'Un identificativo non valido non esiste.');
// a party of the owner's archive needs the id of the admin layer: anything else sent is dropped
const forged = await api(TEST, '/api/admin', { method: 'PUT', body: JSON.stringify({ ...sample, addedParties: { 'user-party-1': { officialName: 'Partito del giocatore' }, 'admin-party-vero-1': { officialName: 'Partito vero', entityType: 'qualcosa', status: 'boh' } } }) }, { authorization: `Bearer ${adminToken}` });
assert.equal(forged.status, 200);
const after = (await api(TEST, '/api/admin')).body.addedParties;
assert.ok(!after['user-party-1'], 'Un partito che non ha l’identificativo del livello amministrativo non entra nel catalogo.');
assert.equal(after['admin-party-vero-1'].entityType, 'party', 'Un valore non riconosciuto torna al predefinito.'); assert.equal(after['admin-party-vero-1'].status, 'active');
// the public read gives nothing secret
const publicRead = JSON.stringify((await api(TEST, '/api/admin')).body);
assert.ok(!/pin|salt|hash|token|sessione/i.test(publicRead.replace(/"configured":(true|false)/, '')), 'La lettura pubblica non espone credenziali.');
assert.equal(envs[PROD].ADMIN_ARCHIVE.data.has('archivio-condiviso'), false, 'Produzione non è stata toccata.');

// ---------- 6. a party founded by a player stays in that career ----------
const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
  const { startCareer } = await import(${JSON.stringify(new URL('./lib/long-run.mjs', import.meta.url).href)});
  const { store } = await startCareer({ seed: 'catalogo', level: 'comunale', draft: { partyMode: 'new', partyId: null, partyName: 'Partito Del Giocatore Prova', partyAbbreviation: 'PGP', partyDescription: 'Prova', partyColor: '#7a2fd0', partyOrientation: 'Ecologista', partyPosition: 'centro', partyProgram: ['scuola'], policyPositions: { economia: 3, welfare: 3, ambiente: 4, europa: 3 }, partyLogoMode: 'builder', partyLogoShape: 'cerchio', partyLogoSymbol: 'freccia' } });
  const stateParties = store.getState().dataset.parties.filter(item => /Partito Del Giocatore Prova/.test(item.officialName ?? item.name ?? ''));
  const adminStore = await import(${JSON.stringify(new URL(`../src/data/repositories/admin-store.js?v=${v}`, import.meta.url).href)});
  console.log(JSON.stringify({ inCareer: stateParties.length, adminAdded: Object.keys(adminStore.loadAdminArchive().addedParties).length }));
`], { encoding: 'utf8', timeout: 120000 });
const outcome = JSON.parse((child.stdout.trim().split('\n').at(-1)) || '{}');
assert.ok(outcome.inCareer >= 1 && outcome.adminAdded === 0, `Il partito fondato da un giocatore vive nella sua carriera e non entra nel catalogo condiviso (${child.stdout.trim().slice(-200)} ${child.stderr.slice(-200)}).`);
useBrowser('player-other', { origin: TEST });
await sync.refreshSharedArchive();
assert.ok(!(await partiesNow()).some(item => /Partito Del Giocatore Prova/.test(item.officialName ?? '')), 'Gli altri giocatori non lo vedono.');

console.log('Catalogo condiviso verificato: un partito aggiunto dall’amministratore (tipologia, stato, leader, logo) arriva a un altro giocatore del web e all’app Android, con ricerca, filtri ed etichetta «aggiunto dall’amministratore»; copia offline, ETag (304), modifiche e rimozioni propagate; scrittura solo con la sessione del proprietario; Test e Produzione separati (anche per l’app); i partiti dei giocatori restano nelle loro carriere.');
