// The owner's area when the browser has no room or the server does not answer (no browser needed, isolated stand-ins, nothing real): a change that the browser cannot keep is refused with a
// clear message and the archive stays as it was; the archive the server sent is still in use when it cannot be stored; the Worker no longer writes a second colour (the old one stays
// readable); a publication is "confirmed" only by the server's answer. See check-admin-parties / check-admin-e2e for the whole path in Chrome.
import assert from 'node:assert/strict';

const quota = Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
function fakeStorage({ full = false } = {}) {
  const data = new Map();
  const storage = { full, getItem: key => data.has(key) ? data.get(key) : null, setItem(key, value) { if (storage.full) throw quota; data.set(key, String(value)); }, removeItem: key => { data.delete(key); }, key: index => [...data.keys()][index] ?? null, get length() { return data.size; } };
  return storage;
}
globalThis.localStorage = fakeStorage();
globalThis.location = new URL('http://127.0.0.1:8793/');
const store = await import('../src/data/repositories/admin-store.js');
const sync = await import('../src/data/repositories/admin-sync.js');

// ---------- 1. a change the browser cannot keep is refused, the archive stays as it was ----------
const original = { color: '#112233', officialName: 'Partito di prova' };
store.saveRecordOverride('parties', 'party-prova', { color: '#aa2255', officialName: 'Partito di prova' }, original);
assert.equal(store.overrideFor('parties', 'party-prova').fields.color, '#aa2255', 'La modifica normale viene salvata.');
const before = localStorage.getItem('politicando.admin.overrides.v1');
localStorage.full = true;
assert.throws(() => store.saveRecordOverride('parties', 'party-prova', { color: '#00ff00', officialName: 'Partito di prova' }, original), /Spazio del browser esaurito: la modifica non è stata salvata/, 'Senza spazio la modifica è rifiutata con un messaggio chiaro.');
assert.throws(() => store.addAdminParty({ officialName: 'Nuovo partito', color: '#336699' }, []), /non è stata salvata/, 'Senza spazio nemmeno un partito aggiunto sembra salvato.');
localStorage.full = false;
assert.equal(localStorage.getItem('politicando.admin.overrides.v1'), before, 'L’archivio è rimasto quello di prima.');
assert.equal(store.overrideFor('parties', 'party-prova').fields.color, '#aa2255', 'E il colore salvato è ancora lì.');
// a colour is one: no second colour is ever written by the owner's area
const added = store.addAdminParty({ officialName: 'Partito aggiunto', color: '#336699', color2: '#ff0000' }, []);
assert.equal(store.loadAdminArchive().addedParties[added].color2, null, 'Il partito aggiunto non scrive un secondo colore.');

// ---------- 2. the archive the server sent is used even if this browser cannot store it ----------
localStorage.full = true;
const kept = store.storeSharedArchive({ updatedAt: '2026-10-17T10:00:00.000Z', parties: { 'party-x': { fields: { color: '#0a7d4b' }, updatedAt: '2026-10-17T10:00:00.000Z' } }, configured: true });
assert.equal(kept, false, 'Il salvataggio della copia condivisa dice che non è riuscito.');
assert.equal(store.sharedCopyStored(), false);
assert.equal(store.loadSharedArchive().parties['party-x'].fields.color, '#0a7d4b', 'La copia dal server resta in uso in memoria.');
assert.equal(store.loadAdminArchive().parties['party-x'].fields.color, '#0a7d4b', 'E il colore pubblicato arriva nell’archivio in uso.');
localStorage.full = false;
assert.equal(store.storeSharedArchive({ updatedAt: '2026-10-17T11:00:00.000Z', parties: {}, configured: true }), true);
assert.equal(store.loadSharedArchive().updatedAt, '2026-10-17T11:00:00.000Z', 'Appena c’è spazio, la copia viene scritta e letta.');

// ---------- 3. the Worker does not write a second colour; the confirmation is the server's ----------
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8793 });
const call = (path, options = {}) => local.worker.fetch(new Request(`${local.origin}/api/admin${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers ?? {}) } }), local.env);
const session = await (await call('/session', { method: 'POST', body: JSON.stringify({ pin: 'pin-di-prova-1', setupCode: 'attivazione-di-prova' }) })).json();
assert.ok(session.token, 'Sessione del proprietario aperta sul Worker isolato.');
const put = await call('', { method: 'PUT', headers: { authorization: `Bearer ${session.token}` }, body: JSON.stringify({
  parties: { 'party-old': { fields: { color: '#aa2255', color2: '#33aa88', abbreviation: 'OLD' }, updatedAt: '2026-10-17T10:00:00.000Z' } },
  politicians: {}, logos: {}, hidden: {},
  addedParties: { 'admin-party-vecchio-ab12': { officialName: 'Vecchio', color: '#123456', color2: '#654321', createdAt: '2026-10-01', updatedAt: '2026-10-01' } }
}) });
assert.equal(put.status, 200);
const answer = await put.json();
assert.ok(answer.updatedAt, 'Il server conferma la scrittura con la data.');
const stored = JSON.parse(local.kvData.get('archivio-condiviso').value);
assert.equal(stored.parties['party-old'].fields.color, '#aa2255', 'Il colore primario è scritto sul server.');
assert.equal('color2' in stored.parties['party-old'].fields, false, 'Il secondo colore di una vecchia pagina non viene scritto.');
assert.equal(stored.addedParties['admin-party-vecchio-ab12'].color, '#123456');
assert.equal(stored.addedParties['admin-party-vecchio-ab12'].color2, null, 'Nemmeno per un partito aggiunto.');
const read = await (await call('', { method: 'GET' })).json();
assert.equal(read.parties['party-old'].fields.color, '#aa2255', 'Rileggendo, il colore è quello pubblicato.');
// a record already published with a second colour stays readable (the game ignores it): reading never fails
local.kvData.set('archivio-condiviso', { value: JSON.stringify({ version: 1, updatedAt: '2026-10-01T00:00:00.000Z', parties: { 'party-legacy': { fields: { color: '#abcdef', color2: '#fedcba' } } }, politicians: {}, logos: {}, addedParties: {}, hidden: {} }), expires: null });
const legacy = await (await call('', { method: 'GET' })).json();
assert.equal(legacy.parties['party-legacy'].fields.color, '#abcdef', 'Un archivio già pubblicato con un secondo colore si legge ancora.');

// ---------- 4. publication: confirmed only by the server ----------
globalThis.sessionStorage = { _d: new Map(), getItem(key) { return this._d.get(key) ?? null; }, setItem(key, value) { this._d.set(key, String(value)); }, removeItem(key) { this._d.delete(key); } };
store.setSharedSessionToken(session.token);
globalThis.location = new URL('https://palazzo-2026-site.bianchimatteo657.workers.dev/');
const realFetch = globalThis.fetch;
globalThis.fetch = (url, options) => local.worker.fetch(new Request(url, options), local.env);
store.saveRecordOverride('parties', 'party-pub', { color: '#2a9d8f' }, { color: '#111111' });
const published = await sync.publishSharedArchive();
assert.ok(published.updatedAt, 'Pubblicato: risposta del server con la data.');
// the server does not answer in time -> not confirmed, and the message says so
globalThis.fetch = (url, options) => new Promise((resolve, reject) => { options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))); });
const timers = []; const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms > 1000 ? 5 : ms, ...args);
await assert.rejects(() => sync.publishSharedArchive(), /non è confermata/, 'Senza risposta del server la pubblicazione non risulta riuscita.');
globalThis.setTimeout = realSetTimeout;
// the server answers with an error
globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Archivio troppo grande.' }), { status: 413, headers: { 'content-type': 'application/json' } });
await assert.rejects(() => sync.publishSharedArchive(), /troppo grande/, 'Un errore del server arriva al proprietario tale e quale.');
assert.equal(store.overrideFor('parties', 'party-pub').fields.color, '#2a9d8f', 'La modifica resta in questo browser anche se non è stata pubblicata.');
globalThis.fetch = realFetch;
await local.close();
console.log('Area del proprietario con poco spazio o senza risposta verificata: una modifica che il browser non può tenere è rifiutata con un messaggio chiaro e l’archivio resta com’era, la copia ricevuta dal server resta in uso anche se non si può scrivere, il Worker non scrive più il secondo colore (e legge ancora gli archivi vecchi), la pubblicazione risulta riuscita solo con la conferma del server.');
