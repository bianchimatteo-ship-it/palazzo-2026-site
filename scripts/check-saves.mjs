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
assert.ok(/versione più recente/.test(opened.getLastSaved()) && !opened.hasCareer(), 'All’apertura lo dice e non carica la partita.');
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
assert.ok(upgraded.save().ok && JSON.parse(mem.get(KEY)).version === 9 && JSON.parse(mem.get(`${KEY}.backup`)).payload, 'Con la copia riuscita, il salvataggio si aggiorna.');

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

console.log(`Salvataggi verificati: slot e indice coerenti dopo errore o interruzione (nessuno slot orfano o senza voce, scrittura annullata se l’indice non la registra, eliminazione dall’indice per prima), «elimina tutto» anche per gli slot fuori dall’indice; salvataggio fallito = modifiche non salvate, esito tecnico indipendente dai messaggi e nessun falso successo; nulla online da una partita non salvata; partita in corso conservata prima di essere sostituita (o la sostituzione si blocca); salvataggi di una versione più recente rifiutati e mai riscritti, aggiornamento che non sovrascrive senza la copia di sicurezza; revisione online che segue il gioco davvero caricato.`);
