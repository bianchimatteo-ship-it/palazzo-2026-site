// Admin area: only the owner recognised by the server gets in (no PIN a player could create), searches cover every
// party and all 604 parliamentarians, parties can be added, hidden, deleted and restored in the separate admin layer,
// everything is published for every player and the real files never change.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const kvData = new Map();
const kv = { async get(key, type) { const entry = kvData.get(key); if (!entry) return null; return type === 'json' ? JSON.parse(entry) : entry; }, async put(key, value) { kvData.set(key, String(value)); }, async delete(key) { kvData.delete(key); } };
const env = { ADMIN_ARCHIVE: kv, ADMIN_SETUP_CODE: 'codice-di-prova', ASSETS: { fetch: async () => new Response('asset') } };
const ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const worker = (await import('../worker.js?admin-test=1')).default;
const local = new Map(), session = new Map();
globalThis.localStorage = { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)), removeItem: key => local.delete(key) };
globalThis.sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, String(value)), removeItem: key => session.delete(key) };
globalThis.location = new URL(`${ORIGIN}/`);
const realFetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
globalThis.fetch = async (url, init = {}) => String(url).startsWith(ORIGIN) ? worker.fetch(new Request(url, init), env) : realFetch(url);
const hashOf = async names => { const hash = createHash('sha256'); for (const name of names) hash.update(await readFile(new URL(`../src/data/real/${name}`, import.meta.url))); return hash.digest('hex'); };
const before = await hashOf(['parties.json', 'political-movements.json', 'politicians.json']);
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
const store = await import(`../src/data/repositories/admin-store.js${v}`);
const sync = await import(`../src/data/repositories/admin-sync.js${v}`);
const { renderAdminPanel } = await import('../src/ui/admin-panel.js');
const { renderPartyArchive } = await import('../src/ui/party-archive.js');
const { isSelectableParty } = await import('../src/data/schema.js');
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'politicians', 'parliamentaryGroups', 'offices', 'coalitions', 'electoralLists', 'partyMemberships', 'territories', 'electionParticipations']);

// ---------- 1. the server decides who the owner is ----------
const call = async (path, init = {}, token = null) => { const response = await worker.fetch(new Request(ORIGIN + path, { ...init, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.20', ...(token ? { authorization: `Bearer ${token}` } : {}) } }), env); return { status: response.status, body: await response.json().catch(() => null) }; };
assert.equal((await call('/api/admin/session')).status, 401, 'Senza sessione il server non riconosce nessun proprietario.');
assert.equal((await call('/api/admin/session', {}, 'f'.repeat(48))).status, 401, 'Un token inventato non vale.');
assert.equal((await call('/api/admin/session', { method: 'POST', body: JSON.stringify({ pin: 'un-pin-qualsiasi' }) })).status, 401, 'Un giocatore non può creare un PIN: serve il codice di attivazione del proprietario.');
await sync.openSharedSession('pin-del-proprietario', 'codice-di-prova');
assert.ok(sync.isAdminVerified(), 'Dopo l’accesso il server ha confermato la sessione.');
const token = sync.sharedSessionToken?.() ?? session.get('politicando.admin.shared-session.v1');
assert.equal((await call('/api/admin/session', {}, token)).status, 200);
// A player who copies a token string into the browser is not the owner.
sync.closeSharedSession();
session.set('politicando.admin.shared-session.v1', 'a'.repeat(48));
assert.equal(sync.isAdminVerified(), false, 'Un token nel browser non basta…');
assert.equal(await sync.verifySharedSession(), false, '…il server lo rifiuta…');
assert.equal(session.has('politicando.admin.shared-session.v1'), false, '…e viene cancellato.');
assert.ok(!('setAdminPin' in store), 'Nel browser non esiste più un PIN locale.');

// ---------- 2. the admin area: a gate without data for everyone else ----------
const logoFor = party => party.id === 'party-futuro-nazionale' ? 'https://example.org/fn.png' : null;
const context = () => ({
  parties: [...realData.realDatabase.parties.map(party => ({ ...party, collection: 'parties' })), ...realData.realDatabase.politicalMovements.map(party => ({ ...party, collection: 'politicalMovements' }))].sort((a, b) => a.officialName.localeCompare(b.officialName, 'it')),
  politicians: [...realData.realDatabase.politicians].sort((a, b) => a.fullName.localeCompare(b.fullName, 'it')), groups: realData.realDatabase.parliamentaryGroups, offices: realData.realDatabase.offices,
  pristine: realData.pristineRecord, logoFor, unlocked: sync.isAdminVerified(), available: true, configured: true, checking: false, loading: false
});
const admin = { tab: 'partiti', query: '', linkQuery: '', chamber: 'all', partyId: null, politicianId: null, message: '', listPage: 1, partyFilter: 'tutti', creating: false };
let html = renderAdminPanel(admin, context());
assert.ok(html.includes('data-admin-shared-form') && html.includes('Area riservata al proprietario'), 'Chi non è il proprietario vede solo l’accesso.');
assert.ok(!html.includes('data-admin-select-party') && !html.includes('Imposta il PIN') && !html.includes('data-admin-new-party'), 'Nessun dato, nessuno strumento, nessun PIN da creare.');
await sync.openSharedSession('pin-del-proprietario');
html = renderAdminPanel(admin, context());
assert.ok(html.includes('data-admin-new-party') && html.includes('admin-summary'), 'Il proprietario verificato entra nell’area.');

// ---------- 3. searches cover everything; pages only split the rendering ----------
const count = text => (text.match(/data-admin-select-politician=/g) ?? []).length;
html = renderAdminPanel({ ...admin, tab: 'politici' }, context());
assert.equal(count(html), 40, 'Si mostrano 40 profili alla volta…');
assert.ok(html.includes('604 risultati') && html.includes('data-admin-more'), '…ma la ricerca li conta e li raggiunge tutti.');
html = renderAdminPanel({ ...admin, tab: 'politici', listPage: 16 }, context());
assert.equal(count(html), 604, 'Con “Mostra altri” si arriva a tutti i 604 parlamentari.');
const last = context().politicians.at(-1);
html = renderAdminPanel({ ...admin, tab: 'politici', query: last.fullName.split(' ').at(-1).toLowerCase() }, context());
assert.ok(html.includes(last.fullName), `Anche l’ultimo in ordine alfabetico (${last.fullName}) si trova con la ricerca.`);
html = renderAdminPanel({ ...admin, listPage: 5 }, context());
assert.equal((html.match(/data-admin-select-party=/g) ?? []).length, context().parties.length, 'Tutti i partiti e movimenti sono raggiungibili.');

// ---------- 4. add, hide, delete and restore parties in the admin layer ----------
const addedId = store.addAdminParty({ officialName: 'Movimento di prova amministrativo', abbreviation: 'MPA', factualDescription: 'Partito aggiunto per il test.', website: 'https://example.org', politicalPosition: 'centro', color: '#aa3366' }, context().parties);
assert.throws(() => store.addAdminParty({ officialName: 'Partito Democratico' }, context().parties), /Esiste già/, 'Niente doppioni del nome…');
assert.throws(() => store.addAdminParty({ officialName: 'Altro nome di prova', abbreviation: 'PCI' }, context().parties), /sigla/, '…né della sigla.');
assert.throws(() => store.addAdminParty({ officialName: 'Liberali Democratici Europei' }, context().parties), /Esiste già/, '…né delle altre denominazioni riconciliate.');
realData.refreshAdminOverrides();
let added = realData.realDatabase.parties.find(item => item.id === addedId);
assert.ok(added && added.source === 'user' && added.adminCreated && added.politicalPosition === 'centro', 'Il partito aggiunto entra nel gioco come dato dell’amministratore.');
assert.ok(isSelectableParty(added), 'È selezionabile nella nuova partita.');
const catalog = { partyQuery: 'prova amministrativo', partyType: 'all', partyPresence: 'all', partyLevel: 'all', partyRegion: 'all', partyStatus: 'all', partyElection: 'all', partySort: 'name', partyPage: 1 };
assert.ok(renderPartyArchive(catalog, { logoFor }).includes('Aggiunto dall’amministratore'), 'Compare nell’archivio dei partiti, marcato.');
store.setRecordHidden('party-registro-p1-2015-29-ir', true);
realData.refreshAdminOverrides();
const pd = realData.realDatabase.parties.find(item => item.id === 'party-registro-p1-2015-29-ir');
assert.ok(pd.adminHidden && !isSelectableParty(pd), 'Un partito reale nascosto esce dalle liste del gioco…');
assert.ok(!renderPartyArchive({ ...catalog, partyQuery: 'Partito Democratico' }, { logoFor }).includes('data-party-profile="party-registro-p1-2015-29-ir"'), '…e dall’archivio.');
html = renderAdminPanel({ ...admin, partyFilter: 'nascosti', listPage: 5 }, context());
assert.ok(html.includes('data-admin-select-party="party-registro-p1-2015-29-ir"') && (html.match(/data-admin-select-party=/g) ?? []).length === 1, 'Filtro “nascosti”.');
html = renderAdminPanel({ ...admin, partyFilter: 'aggiunti', partyId: addedId, listPage: 5 }, context());
assert.ok(html.includes(`data-admin-select-party="${addedId}"`) && html.includes(`data-admin-delete="${addedId}"`), 'Filtro “aggiunti da me” ed eliminazione dei partiti aggiunti.');
assert.ok(renderAdminPanel({ ...admin, partyFilter: 'con-logo', listPage: 5 }, context()).includes('data-admin-select-party="party-futuro-nazionale"'), 'Filtro “con logo”.');
html = renderAdminPanel({ ...admin, partyId: 'party-registro-p1-2015-29-ir' }, context());
assert.ok(html.includes('data-admin-restore="party-registro-p1-2015-29-ir"'), 'Ripristino a portata di mano.');
assert.match(html, /<b>1<\/b> nascosti/, 'Il riepilogo conta i nascosti.');
assert.match(html, /<b>1<\/b> aggiunti/, 'Il riepilogo conta gli aggiunti.');
store.setRecordHidden(addedId, true, { deleted: true });
store.setRecordHidden('party-registro-p1-2015-29-ir', false);
realData.refreshAdminOverrides();
assert.ok(isSelectableParty(realData.realDatabase.parties.find(item => item.id === 'party-registro-p1-2015-29-ir')), 'Ripristinato: torna in gioco.');
added = realData.realDatabase.parties.find(item => item.id === addedId);
assert.ok(added.adminHidden && added.adminDeleted && !isSelectableParty(added), 'Il partito aggiunto eliminato sparisce dal gioco ma resta ripristinabile.');

// ---------- 5. published for everyone, persistent, real files untouched ----------
await sync.publishSharedArchive();
const shared = await call('/api/admin');
assert.ok(shared.body.addedParties[addedId] && shared.body.hidden[addedId]?.deleted, 'Aggiunte e rimozioni sono nell’archivio condiviso sul server.');
assert.equal((await call('/api/admin', { method: 'PUT', body: JSON.stringify({ addedParties: { 'non-valido': { officialName: 'X' }, 'admin-party-ok-1234': { officialName: '  ', color: 'rosso' } }, hidden: { '../x': { hidden: true } } }) }, sync.sharedSessionToken?.() ?? session.get('politicando.admin.shared-session.v1'))).body.addedParties, 0, 'Il server accetta solo partiti e chiavi valide.');
await sync.publishSharedArchive();
local.clear(); session.clear();
await sync.refreshSharedArchive();
realData.refreshAdminOverrides();
assert.ok(realData.realDatabase.parties.find(item => item.id === addedId)?.adminDeleted, 'Un nuovo giocatore riceve lo stesso stato dell’archivio.');
assert.equal(await hashOf(['parties.json', 'political-movements.json', 'politicians.json']), before, 'I file dei dati reali non vengono mai modificati.');
console.log('Area amministrativa verificata: accesso solo con sessione confermata dal server (nessun PIN creabile dal giocatore, token falsi rifiutati), porta senza dati per gli altri, ricerca su tutti i 81 partiti/movimenti e i 604 parlamentari con “Mostra altri”, aggiunta con controllo dei doppioni, nascondi/elimina/ripristina, filtri e riepilogo, pubblicazione persistente per tutti, dati reali intatti.');
