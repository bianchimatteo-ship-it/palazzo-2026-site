// Saving, on a browser storage that can fail: a save that fails leaves the changes dirty (never a false success) and nothing goes online from a dirty game;
// the game being replaced is kept first (or nothing is replaced); slots and their index stay together after an error or an interruption, and “delete all”
// takes the slots the index lost too; a save of a newer version is refused, never read down or written over; the downloaded revision moves only with the game.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { startCareer } = await import('./lib/long-run.mjs');
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const run = await startCareer({ seed: 'salvataggi', level: 'comunale' });
const { store, db } = run;
const { storage, MAX_SLOTS } = await import(`../src/core/storage.js${v}`);
const { saveSetting } = await import(`../src/core/settings.js${v}`);

// ---------- a browser storage that can be made to fail ----------
const mem = globalThis.localStorage.__mem;
const failing = new Set();   // keys (or key prefixes ending in *) whose writes fail, as when the quota is spent
const fails = key => [...failing].some(rule => rule === key || (rule.endsWith('*') && key.startsWith(rule.slice(0, -1))));
globalThis.localStorage = {
  __mem: mem,
  get length() { return mem.size; },
  key: index => [...mem.keys()][index] ?? null,
  getItem: key => mem.has(key) ? mem.get(key) : null,
  setItem: (key, value) => { if (fails(key)) throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' }); mem.set(key, String(value)); },
  removeItem: key => { mem.delete(key); }
};
const KEY = 'palazzo-2026.career.v1';
const INDEX = 'politicando.slots.v1';
const SLOT = 'politicando.slot.';
const slotKeys = () => [...mem.keys()].filter(key => key.startsWith(SLOT));
const payload = (extra = {}) => ({ ...JSON.parse(JSON.stringify(store.getState())), ...extra });
const draft = (name, extra = {}) => ({ firstName: name, lastName: 'Salvataggi', birthDate: '1980-05-05', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Insegnante', initialLevel: 'comunale', partyMode: 'existing', partyId: 'party-registro-p1-2017-41-ir', difficulty: 'normale', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra });

// ---------- 1. slots and index ----------
storage.clearAll();
assert.deepEqual(storage.listSlots(), [], 'Nessuno slot all’inizio.');
const first = storage.saveSlot(payload(), { name: 'Primo' });
assert.ok(first && slotKeys().length === 1 && storage.listSlots().length === 1, 'Uno slot e la sua voce nell’indice.');
// The index cannot say it: the new slot is not left behind (no orphan), the others are as they were.
failing.add(INDEX);
assert.throws(() => storage.saveSlot(payload(), { name: 'Secondo' }), /non è stato registrato/);
failing.clear();
assert.equal(slotKeys().length, 1, 'Un salvataggio non registrato non lascia uno slot orfano.');
assert.equal(storage.listSlots().length, 1, 'E l’elenco non cambia.');
// Rewriting a slot the index cannot update: the slot goes back to what it was.
const before = mem.get(SLOT + first);
failing.add(INDEX);
assert.throws(() => storage.saveSlot({ ...payload(), marker: 'nuovo' }, { name: 'Primo' }, first), /non è stato registrato/);
failing.clear();
assert.equal(mem.get(SLOT + first), before, 'Lo slot riscritto torna com’era se l’indice non lo registra.');
// The slot itself cannot be written: nothing is registered.
failing.add(`${SLOT}*`);
assert.throws(() => storage.saveSlot(payload(), { name: 'Terzo' }), /Spazio del browser esaurito/);
failing.clear();
assert.ok(slotKeys().length === 1 && storage.listSlots().length === 1, 'Se lo slot non si scrive, l’indice non lo dice.');
// An interruption between the two writes (the slot is there, the index does not know it): the slot is found again; a voice with no slot goes.
mem.set(`${SLOT}ritrovato`, JSON.stringify(payload()));
mem.set(INDEX, JSON.stringify([...JSON.parse(mem.get(INDEX)), { id: 'sparito', savedAt: '2026-10-01T10:00:00Z', name: 'Senza slot' }]));
assert.ok(!storage.listSlots().some(entry => entry.id === 'sparito'), 'Una voce senza slot non si mostra.');
assert.ok(storage.repairSlots(), 'L’indice si ripara.');
const repaired = storage.listSlots();
assert.ok(repaired.some(entry => entry.id === 'ritrovato' && entry.player) && !repaired.some(entry => entry.id === 'sparito') && repaired.length === slotKeys().length, 'Lo slot ritrovato torna nell’elenco e nessuna voce resta senza slot: indice e slot coincidono.');
// Deleting: the index first (a failure there changes nothing).
failing.add(INDEX);
assert.throws(() => storage.deleteSlot('ritrovato'));
failing.clear();
assert.ok(storage.listSlots().some(entry => entry.id === 'ritrovato') && mem.has(`${SLOT}ritrovato`), 'Se l’indice non si aggiorna, lo slot resta e resta nell’elenco.');
storage.deleteSlot('ritrovato');
assert.ok(!mem.has(`${SLOT}ritrovato`) && !storage.listSlots().some(entry => entry.id === 'ritrovato'), 'Eliminato: né slot né voce.');
assert.throws(() => { for (let i = 0; i <= MAX_SLOTS; i++) storage.saveSlot(payload(), { name: `Slot ${i}` }); }, /al massimo/, 'Gli slot sono al massimo cinque.');
// “Delete all”: also the slots the index lost, the running save and the copy kept aside; the Hall of Fame stays.
storage.saveHall([{ id: 'hall-prova', title: 'Prova' }]);
storage.backup('{"copia":true}', 'prova');
mem.set(`${SLOT}senza-indice`, JSON.stringify(payload()));
mem.set(INDEX, JSON.stringify(JSON.parse(mem.get(INDEX)).filter(entry => entry.id !== 'senza-indice')));
assert.ok(mem.has(`${SLOT}senza-indice`) && !JSON.parse(mem.get(INDEX)).some(entry => entry.id === 'senza-indice'), 'Uno slot fuori dall’indice c’è.');
storage.clearAll();
assert.ok(slotKeys().length === 0 && !mem.has(INDEX) && !mem.has(KEY) && !mem.has(`${KEY}.backup`), 'Elimina tutto: slot (anche fuori dall’indice), indice, partita e copia di sicurezza.');
assert.ok(storage.hall().some(entry => entry.id === 'hall-prova'), 'La Hall of Fame resta.');
failing.add(`${KEY}.backup`);
assert.equal(storage.backup('{"x":1}', 'prova'), false, 'Una copia che non riesce lo dice.');
failing.clear();
assert.equal(storage.backup('{"x":1}', 'prova'), true, 'E una che riesce pure.');
storage.clearAll();

// ---------- 2. a save that fails ----------
let status = store.saveStatus();
assert.ok(status.ok && !status.dirty && store.cloudSnapshot() === store.getState(), 'Una partita salvata può andare online.');
store.advance(7);
const saved = store.saveStatus();
assert.ok(saved.ok && !saved.dirty && saved.seq > status.seq, 'Salvata: esito tecnico buono, nulla di non salvato.');
failing.add(KEY);
const failed = store.save();
status = store.saveStatus();
assert.equal(failed.ok, false, 'Il salvataggio non riuscito lo dice.');
assert.ok(!status.ok && status.dirty && status.error && status.seq === saved.seq, 'Esito tecnico: non riuscito, modifiche non salvate, nessun nuovo salvataggio.');
assert.ok(store.hasUnsavedChanges(), 'Le modifiche risultano non salvate.');
assert.ok(/^Salvataggio non riuscito/.test(store.getState().ui.toast) && !/Carriera salvata/.test(store.getState().ui.toast), 'Nessun falso successo.');
assert.equal(store.cloudSnapshot(), null, 'Niente online da una partita non salvata.');
store.advance(7);
assert.ok(store.saveStatus().dirty && store.cloudSnapshot() === null, 'Anche l’autosalvataggio che non riesce lascia le modifiche non salvate.');
failing.clear();
const again = store.save();
status = store.saveStatus();
assert.ok(again.ok && status.ok && !status.dirty && status.seq === saved.seq + 1 && store.cloudSnapshot() === store.getState(), 'Tornato lo spazio: salva, non è più sporca e può andare online.');
assert.equal(JSON.parse(mem.get(KEY)).clock.currentDate, store.getState().clock.currentDate, 'Ciò che è scritto è lo stato corrente.');
// Saving by hand (or at the end of the week): the changes wait, they are not “saved”.
saveSetting('autosave', 'manual');
store.advance(7);
status = store.saveStatus();
assert.ok(status.ok && status.dirty && store.cloudSnapshot() === null, 'In salvataggio manuale le modifiche attese non vanno online.');
assert.ok(store.save().ok && !store.saveStatus().dirty && store.cloudSnapshot(), 'Salvate a mano, ci vanno.');
saveSetting('autosave', 'action');

// ---------- 3. the game being replaced is kept first, or nothing is replaced ----------
const career = store.getState().career.id;
failing.add(`${SLOT}*`);
assert.throws(() => store.createCareer(draft('Altra'), db.parties, db.parliamentaryGroups), /non può essere conservata/);
assert.equal(store.getState().career.id, career, 'Se la partita in corso non si può conservare, la nuova carriera non parte.');
failing.clear();
const week = store.getState().game.week.index;
const old = JSON.parse(JSON.stringify(store.getState()));
store.createCareer(draft('Altra'), db.parties, db.parliamentaryGroups);
assert.notEqual(store.getState().career.id, career, 'Con lo spazio, la nuova carriera parte…');
const kept = storage.listSlots().find(entry => /partita precedente/.test(entry.name));
assert.ok(kept && storage.loadSlot(kept.id).career.id === career, '…e quella di prima resta in uno slot.');
// Loading a game while this one has changes not saved: the same.
saveSetting('autosave', 'manual');
store.advance(7);
assert.ok(store.hasUnsavedChanges(), 'Con modifiche non salvate…');
const running = store.getState().career.id;
failing.add(`${SLOT}*`);
assert.throws(() => store.loadGame(old), /non può essere conservata/);
assert.equal(store.getState().career.id, running, '…se non si riesce a conservarle, il caricamento non sostituisce nulla.');
failing.clear();
for (const entry of storage.listSlots()) storage.deleteSlot(entry.id);
store.loadGame(old);
assert.equal(store.getState().career.id, career, 'Con lo spazio, si carica…');
assert.ok(storage.listSlots().some(entry => /salvataggio automatico/.test(entry.name)), '…e la partita con le modifiche non salvate resta in uno slot.');
const otherCareerCopy = storage.listSlots().map(entry => storage.loadSlot(entry.id)).find(item => item.career.id !== career);
assert.ok(otherCareerCopy, 'La partita precedente è conservata anche dopo il caricamento.');
store.loadGame(otherCareerCopy);
assert.equal(store.getState().career.id, otherCareerCopy.career.id, 'Un caricamento pulito di un’altra carriera riesce.');
assert.ok(storage.listSlots().some(entry => storage.loadSlot(entry.id).career.id === career), 'La carriera pulita sostituita resta salvata nello slot.');
store.loadGame(old);
const cleanBeforeFullSlots = store.getState();
for (const entry of storage.listSlots()) storage.deleteSlot(entry.id);
for (let index = 0; index < MAX_SLOTS; index++) storage.saveSlot(cleanBeforeFullSlots, { name: `Capienza ${index}` }, `capienza-${index}`);
assert.throws(() => store.loadGame(otherCareerCopy), /non può essere conservata.*al massimo/);
assert.strictEqual(store.getState(), cleanBeforeFullSlots, 'Con tutti gli slot occupati, il caricamento non sostituisce nemmeno una partita pulita.');
for (const entry of storage.listSlots()) storage.deleteSlot(entry.id);
saveSetting('autosave', 'action');
store.save();

// ---------- 4. a save of a newer version ----------
const future = { ...JSON.parse(JSON.stringify(store.getState())), version: 99 };
const now = store.getState();
assert.throws(() => store.loadGame(future), /versione più recente/);
assert.throws(() => store.loadGame(JSON.stringify(future)), /versione più recente/);
assert.equal(store.getState(), now, 'Un salvataggio di una versione più recente è rifiutato: nulla cambia.');
const slotId = storage.saveSlot(future, { name: 'Dal futuro' });
assert.throws(() => store.loadSlot(slotId), /versione più recente/, 'Anche da uno slot.');
assert.equal(JSON.parse(mem.get(SLOT + slotId)).version, 99, 'E lo slot resta com’è, mai riscritto.');
// At the opening: the game does not read it down, does not write over it and says so.
const futureText = JSON.stringify(future);
mem.set(KEY, futureText);
const opened = (await import(`../src/core/store.js${v}&salvataggi=futuro`)).store;
assert.ok(/versione più recente/.test(opened.getLastSaved()) && opened.hasCareer(), 'All’apertura mantiene disponibile la carriera recuperabile in sola lettura, senza sostituirla con la demo.');
assert.ok(!opened.saveStatus().ok && opened.saveStatus().dirty && opened.cloudSnapshot() === null, 'Finché c’è, questa versione non salva né manda online nulla.');
opened.navigate('carriera');
assert.equal(opened.save().ok, false, 'Salvare non riesce…');
assert.equal(mem.get(KEY), futureText, '…e il salvataggio di una versione più recente resta byte per byte com’era: nessun downgrade.');
opened.reset();
assert.equal(mem.get(KEY), futureText, 'Anche azzerando la partita di prova.');
opened.clearAllSaves();
assert.ok(!mem.has(KEY) && opened.saveStatus().ok && !opened.saveStatus().dirty, 'Solo eliminandolo, su richiesta, il gioco torna a salvare.');
// The upgrade of an older save keeps the old one aside first: if it cannot, it is not replaced.
const older = { ...JSON.parse(JSON.stringify(store.getState())), version: 8 };
const olderText = JSON.stringify(older);
mem.set(KEY, olderText);
failing.add(`${KEY}.backup`);
const upgraded = (await import(`../src/core/store.js${v}&salvataggi=vecchio`)).store;
assert.equal(mem.get(KEY), olderText, 'Senza la copia di sicurezza, il salvataggio vecchio non si sovrascrive.');
assert.ok(upgraded.hasCareer() && upgraded.saveStatus().dirty && !upgraded.saveStatus().ok, 'La partita aggiornata resta in memoria, non salvata.');
assert.equal(upgraded.save().ok, false, 'E salvare non riesce finché la copia non riesce.');
assert.equal(mem.get(KEY), olderText, 'Ancora intatto.');
failing.clear();
assert.ok(upgraded.save().ok && JSON.parse(mem.get(KEY)).version === 10 && JSON.parse(mem.get(`${KEY}.backup`)).payload, 'Con la copia riuscita, il salvataggio si aggiorna.');

// ---------- 5. online: the revision follows the game ----------
const account = await import(`../src/data/repositories/account-sync.js${v}`);
const server = new Map();
globalThis.location = new URL('http://127.0.0.1:8791/');
globalThis.fetch = async (url, init = {}) => {
  const path = new URL(url).pathname;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const slot = decodeURIComponent(path.split('/').pop());
  if (init.method === 'PUT') {
    const body = JSON.parse(init.body);
    const current = server.get(slot);
    if (current && !body.force && body.baseRevision !== current.revision) return json({ error: 'Versione più recente online.', conflict: true, remote: { revision: current.revision } }, 409);
    const revision = (current?.revision ?? 0) + 1;
    server.set(slot, { ...body, revision, updatedAt: new Date().toISOString() });
    return json({ revision });
  }
  const current = server.get(slot);
  return current ? json(current) : json({ error: 'Non trovata.' }, 404);
};
mem.set('politicando.account.v1', JSON.stringify({ username: 'prova', token: 'token' }));
const slotOnline = account.slotForCareer(store.getState().career.id);
await account.uploadSave(slotOnline, store.cloudSnapshot());
assert.equal(account.knownRevision(slotOnline), 1, 'Caricata online: questa copia ha la revisione 1.');
// Another device saves a newer version.
server.set(slotOnline, { ...server.get(slotOnline), revision: 2 });
await assert.rejects(account.uploadSave(slotOnline, store.cloudSnapshot()), error => error.status === 409 && error.data.remote.revision === 2, 'La versione più recente online non si sovrascrive per sbaglio.');
// The newer game is downloaded, but refused (a newer version of the game): the revision of this copy does not move.
server.set(slotOnline, { ...server.get(slotOnline), data: JSON.stringify(future), encoding: 'json' });
const remote = await account.downloadSave(slotOnline, { commit: false });
assert.throws(() => store.loadGame(remote.state), /versione più recente/);
assert.equal(account.knownRevision(slotOnline), 1, 'Un download rifiutato non cambia la revisione conosciuta.');
await assert.rejects(account.uploadSave(slotOnline, store.cloudSnapshot()), error => error.status === 409, 'E il gioco di prima non sovrascrive la copia online.');
// Downloaded and really put in its place: the revision follows.
server.set(slotOnline, { ...server.get(slotOnline), data: JSON.stringify(old), encoding: 'json' });
const good = await account.downloadSave(slotOnline, { commit: false });
store.loadGame(good.state);
account.commitRevision(slotOnline, good.revision);
assert.equal(account.knownRevision(slotOnline), 2, 'Con il gioco scaricato al suo posto la revisione è quella online.');
assert.equal((await account.uploadSave(slotOnline, store.cloudSnapshot())).revision, 3, 'E da lì si carica la successiva.');
await account.uploadSave(slotOnline, store.cloudSnapshot(), { force: true });
assert.equal(account.knownRevision(slotOnline), 4, 'Sovrascrivere online (scelta esplicita) porta alla revisione nuova.');
assert.equal((await account.downloadSave(slotOnline)).revision, 4, 'Il download di sempre registra la revisione.');


// ---------- 6. the app: nothing goes online from a game that is not saved, and a refused download moves no revision ----------
{
  const { fileURLToPath } = await import('node:url');
  const requests = [];
  const html = { dataset: {}, style: { props: {}, setProperty(name, value) { this.props[name] = value; } } };
  const windowListeners = {};
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.window = { innerWidth: 1200 };
  globalThis.addEventListener = (type, fn) => { (windowListeners[type] ??= []).push(fn); };
  globalThis.document = { baseURI: 'http://127.0.0.1:8791/', activeElement: null, documentElement: html, createElement: () => ({ style: {}, dataset: {}, hidden: false, children: [], replaceChildren(...items) { this.children = items; }, append() {} }), createTextNode: text => text, body: { append() {} } };
  globalThis.indexedDB = undefined;
  globalThis.confirm = () => { throw new Error('Il gioco non deve usare il confirm() del browser.'); };
  const api = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url);
    if (address.startsWith('file:')) { const body = await readFile(fileURLToPath(address), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body }; }
    const path = new URL(address).pathname;
    requests.push({ method: init.method ?? 'GET', path });
    if (path === '/api/account/status') return new Response(JSON.stringify({ signedIn: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (path === '/api/saves') return new Response(JSON.stringify({ saves: [...server].map(([slot, item]) => ({ slot, revision: item.revision, name: item.name, meta: item.meta, updatedAt: item.updatedAt })) }), { status: 200, headers: { 'content-type': 'application/json' } });
    return api(url, init);
  };
  const listeners = {};
  const root = { innerHTML: '', addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, querySelector: () => null, querySelectorAll: () => [] };
  const el = attrs => ({
    closest: selector => { for (const part of selector.split(',')) { const match = part.trim().match(/^\[data-([a-z-]+)(?:="([^"]+)")?\]$/); if (!match) continue; const key = match[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase()); if (key in attrs && (match[2] === undefined || attrs[key] === match[2])) return { dataset: attrs, matches: () => false }; } return null; },
    matches: () => false
  });
  const click = async attrs => { const target = el(attrs); for (const fn of listeners.click) await fn({ target }); await new Promise(resolve => setTimeout(resolve, 10)); return root.innerHTML; };
  const { mountApp } = await import(`../src/ui/app.js${v}`);
  mountApp(root, store);
  await new Promise(resolve => setTimeout(resolve, 50));
  const puts = () => requests.filter(item => item.method === 'PUT').length;
  const slot = account.slotForCareer(store.getState().career.id);
  server.delete(slot);
  mem.delete('politicando.account.revisions.v1');
  saveSetting('autosave', 'action');
  store.save();
  // Saved: the manual sync goes online.
  await click({ menu: 'account', accountMode: 'login' });
  await click({ accountAction: 'sync' });
  assert.equal(puts(), 1, 'Una partita salvata va online con «Sincronizza».');
  assert.equal(account.knownRevision(slot), 1);
  // The local save fails: nothing goes online, and the player is told why (no false success).
  failing.add(KEY);
  store.advance(7);
  const failedPuts = puts();
  const page = await click({ accountAction: 'sync' });
  assert.equal(puts(), failedPuts, 'Se il salvataggio in questo browser non riesce, «Sincronizza» non manda nulla online.');
  assert.ok(/non è riuscito/.test(page), 'E lo dice.');
  assert.ok(store.saveStatus().dirty && !/Carriera salvata/.test(store.getState().ui.toast ?? ''), 'Senza un falso «Carriera salvata».');
  // Back online with changes that are not saved: the reconnection waits.
  failing.clear();
  saveSetting('autosave', 'manual');
  store.advance(7);
  assert.ok(store.saveStatus().dirty);
  for (const fn of windowListeners.online ?? []) await fn();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(puts(), failedPuts, 'Tornata la rete, una partita con modifiche non salvate non va online.');
  store.save();
  for (const fn of windowListeners.online ?? []) await fn();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(puts(), failedPuts + 1, 'Salvata, alla riconnessione va online.');
  saveSetting('autosave', 'action');
  // Another device saves a newer version: the conflict is shown, the revision does not move, the newer one is not overwritten.
  const known = account.knownRevision(slot);
  server.set(slot, { ...server.get(slot), revision: known + 1 });
  store.advance(7);
  await click({ accountAction: 'sync' });
  assert.equal(account.knownRevision(slot), known, 'Un conflitto non cambia la revisione conosciuta.');
  assert.ok(/Su un altro dispositivo c’è una versione più recente/.test(root.innerHTML), 'Il conflitto si vede.');
  // The newer game is of a newer version of this game: “load” refuses, the revision stays, the conflict stays.
  server.set(slot, { ...server.get(slot), data: JSON.stringify({ ...JSON.parse(JSON.stringify(store.getState())), version: 99 }), encoding: 'json' });
  const running = store.getState().career.id;
  await click({ conflict: 'download' });
  assert.ok(/versione più recente/.test(root.innerHTML) && store.getState().career.id === running, 'Una versione online di un gioco più recente non si carica.');
  assert.equal(account.knownRevision(slot), known, 'E non sposta la revisione.');
  // A readable newer game is loaded: only then does the revision follow.
  server.set(slot, { ...server.get(slot), data: JSON.stringify(old), encoding: 'json' });
  await click({ conflict: 'download' });
  assert.equal(account.knownRevision(slot), server.get(slot).revision, 'Caricata la versione online, la revisione è la sua.');
  assert.equal(store.getState().career.id, career, 'Ora si gioca la carriera scaricata.');
  const cloudBefore = account.knownRevision(slot);
  // A career recovered from the account that cannot be loaded leaves the revision alone too.
  server.set(slot, { ...server.get(slot), revision: cloudBefore + 1, data: JSON.stringify({ ...old, version: 99 }), encoding: 'json' });
  await click({ cloudLoad: slot });
  assert.equal(account.knownRevision(slot), cloudBefore, 'Anche dal tuo account: una carriera rifiutata non cambia la revisione.');
}

// ---------- 7. recover the most advanced local career and reject stale tabs/slots ----------
storage.clearAll();
const careerId = store.getState().career.id;
const snapshot = (date, week, revision = 0) => {
  const current = payload();
  return {
    ...current, version: 10,
    saveMeta: { careerId, revision },
    clock: { ...current.clock, currentDate: date },
    game: { ...current.game, week: { ...current.game.week, index: week, startedAt: `${date.slice(0, 4)}-01-01` } }
  };
};
const at2026 = storage.save(snapshot('2026-06-01', 1)).state;
const staleTab = (await import(`../src/core/store.js${v}&phase1-old-tab`)).store;
assert.equal(staleTab.getState().clock.currentDate, '2026-06-01', 'La seconda scheda apre la stessa carriera 2026.');
const at2032 = storage.save(snapshot('2032-06-01', 313, at2026.saveMeta.revision)).state;
assert.equal(at2032.saveMeta.careerId, careerId, 'La carriera mantiene il suo ID.');
assert.ok(at2032.saveMeta.revision > at2026.saveMeta.revision, 'La revisione cresce.');
const at2028 = snapshot('2028-06-01', 105, at2026.saveMeta.revision);
assert.throws(() => storage.save(at2028), /obsoleto/, 'Una copia 2028 non può sovrascrivere il 2032.');
assert.equal(JSON.parse(mem.get(KEY)).clock.currentDate, '2032-06-01', 'Il main resta al 2032.');
assert.ok(JSON.parse(mem.get(`${KEY}.history`)).some(item => item.reason === 'conflitto-versione-obsoleta' && JSON.parse(item.payload).clock.currentDate === '2028-06-01'), 'La copia vecchia del conflitto viene conservata.');
assert.throws(() => storage.save(at2028), /obsoleto/, 'Anche la seconda scheda viene fermata dalla revisione persistita.');
const staleForce = staleTab.getState().world.parties.find(item => !item.isPlayer && item.position);
assert.ok(staleForce, 'La seconda scheda ha un riferimento politico da migrare.');
staleForce.position = null;
staleTab.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls });
assert.equal(JSON.parse(mem.get(KEY)).clock.currentDate, '2032-06-01', 'setRealReference non può riportare indietro il main.');
assert.ok(!staleTab.saveStatus().ok || staleTab.saveStatus().dirty, 'La migration in una scheda vecchia resta non salvata, senza sovrascrivere quella avanzata.');
// A more advanced backup repairs a stale main automatically.
mem.set(KEY, JSON.stringify(at2028));
assert.equal(storage.backup(at2032, 'backup-avanzato'), true);
assert.equal(storage.load().clock.currentDate, '2032-06-01');
assert.equal(JSON.parse(mem.get(KEY)).clock.currentDate, '2032-06-01', 'Il recovery ripristina il backup avanzato nel main.');
// A corrupt main never replaces the independent valid backup, and a live tab lease refuses competing writes.
const backupBeforeCorruption = mem.get(`${KEY}.backup`);
mem.set(KEY, '{salvataggio incompleto');
assert.equal(storage.load().clock.currentDate, '2032-06-01', 'Un main corrotto recupera la copia valida.');
assert.equal(mem.get(`${KEY}.backup`), backupBeforeCorruption, 'Il main corrotto non sovrascrive il backup valido.');
const liveLock = `${KEY}.lock`;
mem.set(liveLock, JSON.stringify({ token: 'altra-scheda', expiresAt: Date.now() + 60_000 }));
assert.throws(() => storage.save(snapshot('2033-06-01', 365, at2032.saveMeta.revision)), /in corso in un’altra scheda/);
assert.equal(JSON.parse(mem.get(KEY)).clock.currentDate, '2032-06-01', 'La scheda concorrente non scrive durante il lock.');
mem.delete(liveLock);
// A stale manual slot remains a recoverable copy, but loading it selects the advanced save for the same career.
mem.set(`${SLOT}slot-2028`, JSON.stringify(at2028));
mem.set(INDEX, JSON.stringify([...storage.listSlots(), { id: 'slot-2028', savedAt: '2028-06-01', name: 'Copia vecchia' }]));
const recoveredStore = (await import(`../src/core/store.js${v}&phase1-recovered-slot`)).store;
recoveredStore.loadSlot('slot-2028');
assert.equal(recoveredStore.getState().clock.currentDate, '2032-06-01', 'Aprire lo slot vecchio ricarica la versione avanzata della stessa carriera.');
assert.equal(JSON.parse(mem.get(KEY)).clock.currentDate, '2032-06-01');
assert.ok(storage.listSlots().some(item => storage.loadSlot(item.id).career.id === careerId), 'Anche aprire uno slot pulito conserva la carriera corrente in uno slot.');
// A migration changes the schema but cannot change the progress or the stable career ID.
const legacy2032 = { ...JSON.parse(mem.get(KEY)), version: 9 };
mem.set(KEY, JSON.stringify(legacy2032));
const migrated = (await import(`../src/core/store.js${v}&phase1-migration`)).store;
assert.equal(migrated.getState().clock.currentDate, '2032-06-01');
assert.equal(JSON.parse(mem.get(KEY)).clock.currentDate, '2032-06-01');
assert.equal(JSON.parse(mem.get(KEY)).saveMeta.careerId, careerId);
assert.equal(JSON.parse(mem.get(KEY)).version, 10, 'La migration è salvata senza downgrade.');
assert.ok(JSON.parse(mem.get(`${KEY}.history`)).some(item => item.reason === 'aggiornamento-v9-v10'), 'La versione precedente alla migration resta recuperabile.');

// ---------- 8. starting roles are persisted in the actual party and Government state ----------
const roleStore = migrated;
const startingGroup = db.parliamentaryGroups.find(group => group.chamber === 'camera' && group.source === 'real' && group.verified === true && Number(group.memberCount) > 0);
assert.ok(startingGroup, 'Il riferimento reale contiene un gruppo della Camera.');
roleStore.createCareer(draft('Primo Ministro', { initialLevel: 'deputato', parliamentStartMode: 'real-context', parliamentaryGroupId: startingGroup.id, startingRole: 'presidenteConsiglio' }), db.parties, db.parliamentaryGroups);
let roleState = roleStore.getState();
assert.equal(roleState.career.startingRole, 'presidenteConsiglio');
assert.equal(roleState.parliament.government.primeMinister, 'player');
assert.equal(roleState.parliament.government.formedBy, 'player');
assert.equal(roleState.parliament.government.status, 'active');
for (const chamber of ['camera', 'senato']) {
  const groups = roleState.parliament.chambers[chamber].groups;
  const total = groups.reduce((sum, group) => sum + group.simulatedSeats, 0);
  const supported = groups.filter(group => roleState.parliament.government.coalitionGroupIds.includes(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
  assert.ok(supported >= Math.floor(total / 2) + 1, `La maggioranza iniziale è coerente alla ${chamber}.`);
}
const pmOffice = roleState.dataset.offices.find(item => item.id === roleState.career.startingOfficeId);
assert.ok(pmOffice && !pmOffice.endDate && pmOffice.level === 'presidente-consiglio' && roleState.dataset.politicians.find(item => item.id === roleState.career.playerId).roleId === pmOffice.id, 'Il ruolo del premier è un incarico aperto collegato al player.');
roleStore.createCareer(draft('Segretaria', { startingRole: 'segretarioNazionale' }), db.parties, db.parliamentaryGroups);
roleState = roleStore.getState();
const { isSecretary } = await import(`../src/core/career-engine.js${v}`);
assert.equal(roleState.career.startingRole, 'segretarioNazionale');
assert.equal(roleState.game.party.rank, 5);
assert.ok(isSecretary(roleState.game.party), 'Il ruolo iniziale usa lo stato e il controllo esistenti della segreteria.');
assert.ok(roleState.dataset.offices.some(item => item.politicianId === roleState.career.playerId && item.level === 'partito' && !item.endDate), 'L’incarico di segretario è registrato tra gli incarichi aperti.');
for (const [startingRole, rank] of [['militante', 0], ['dirigenteLocale', 1], ['dirigenteRegionale', 2], ['direzioneNazionale', 3]]) {
  storage.clearAll();
  roleStore.createCareer(draft(`Ruolo ${startingRole}`, { startingRole }), db.parties, db.parliamentaryGroups);
  const started = roleStore.getState();
  assert.equal(started.career.startingRole, startingRole, `${startingRole}: ruolo persistito nella carriera.`);
  assert.equal(started.game.party.rank, rank, `${startingRole}: livello effettivo nel partito.`);
  if (rank) assert.ok(started.dataset.offices.some(item => item.politicianId === started.career.playerId && item.level === 'partito' && !item.endDate), `${startingRole}: incarico aperto nello stato.`);
}
roleStore.setCampaignPicks({ key: 'setup', values: { 'setup.topicId': 'servizi' } });
assert.equal(JSON.parse(mem.get(KEY)).ui.campaignPicks.values['setup.topicId'], 'servizi', 'Una preferenza UI scrive nella versione persistita della carriera.');
const picksReload = (await import(`../src/core/store.js${v}&phase1-ui-picks-reload`)).store;
assert.equal(picksReload.getState().ui.campaignPicks.values['setup.topicId'], 'servizi', 'La preferenza UI sopravvive a un reload senza downgrade.');
const legacyV1 = { ...snapshot('2026-06-01', 1), version: 1, career: { ...snapshot('2026-06-01', 1).career, id: 'carriera-legacy-v1' }, saveMeta: { careerId: 'carriera-legacy-v1', revision: 0 } };
delete legacyV1.world; delete legacyV1.society; delete legacyV1.national; delete legacyV1.presidency;
mem.set(KEY, JSON.stringify(legacyV1));
const migratedV1 = (await import(`../src/core/store.js${v}&phase1-v1-migration`)).store;
assert.equal(migratedV1.getState().career.id, 'carriera-legacy-v1');
assert.equal(migratedV1.getState().clock.currentDate, '2026-06-01', 'La migration più vecchia conserva la carriera e la data, senza aprire una demo.');
assert.equal(JSON.parse(mem.get(KEY)).version, 10, 'Anche il salvataggio v1 viene migrato senza sostituirne la carriera.');

// History is a small circular convenience: quota/failure there cannot block main or the independent backup.
const historyState = migratedV1.getState();
const dateAfterWeek = new Date(Date.parse(`${historyState.clock.currentDate}T12:00:00`) + 7 * 86400000).toISOString().slice(0, 10);
const historyQuotaState = { ...historyState, clock: { ...historyState.clock, currentDate: dateAfterWeek }, game: { ...historyState.game, week: { ...historyState.game.week, index: historyState.game.week.index + 1 } } };
failing.add(`${KEY}.history`);
const withoutHistory = storage.save(historyQuotaState).state;
assert.equal(JSON.parse(mem.get(KEY)).clock.currentDate, dateAfterWeek, 'L’indisponibilità dello storico non blocca il main.');
assert.ok(JSON.parse(mem.get(`${KEY}.backup`)).payload, 'Il backup resta indipendente dallo storico.');
failing.clear();
const retried = storage.save({ ...withoutHistory, ui: { ...withoutHistory.ui, retryMarker: 'ok' } }).state;
assert.equal(storage.load().clock.currentDate, dateAfterWeek, 'Dopo un errore transitorio, il salvataggio successivo e il reload restano validi.');
assert.equal(retried.saveMeta.revision, withoutHistory.saveMeta.revision + 1, 'La revisione continua a crescere dopo il retry.');
assert.ok((JSON.parse(mem.get(`${KEY}.history`)) ?? []).length <= 4, 'La cronologia circolare resta compatta.');

console.log(`Salvataggi verificati: slot e indice coerenti; stale save, backup, reload, tab concorrenti, slot vecchio, migration e setRealReference non retrocedono la carriera 2026→2032; careerId/revision; ruoli iniziali di segretario e Presidente del Consiglio con maggioranze e incarichi effettivi; salvataggi futuri protetti; sincronizzazione online.`);
