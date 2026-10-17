// The saves in two tiers (localStorage + IndexedDB), on a browser storage that can fill up and an IndexedDB that can fail (stand-ins in Node, nothing real). It shows that: what localStorage
// already holds is copied to IndexedDB once, read back and checked, without deleting anything (and does not repeat); a save that localStorage cannot take is kept in memory, written in
// IndexedDB and called "safe" only when IndexedDB has confirmed it; a reload (a new page on the same storage) finds the latest career; a write that nobody can take is reported, never
// called saved; two tabs see each other's overflow; with no room even for the lock the save goes on; without IndexedDB everything works as before. The same in Chrome: check-save-resilience.mjs.
import assert from 'node:assert/strict';
import { createFakeIndexedDB } from './lib/fake-idb.mjs';

const stamp = (await (await import('node:fs/promises')).readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = stamp ? `?v=${stamp}` : '?';

// ---------- a localStorage that fills up (5.2 million characters, like Chrome) ----------
const LIMIT = 5_200_000;
const mem = new Map();
let full = false;
const used = () => [...mem].reduce((sum, [key, value]) => sum + key.length + String(value).length, 0);
globalThis.localStorage = {
  get length() { return mem.size; },
  key: index => [...mem.keys()][index] ?? null,
  getItem: key => mem.has(key) ? mem.get(key) : null,
  setItem(key, value) {
    const text = String(value);
    const attempted = used() - (mem.has(key) ? key.length + String(mem.get(key)).length : 0) + key.length + text.length;
    if (full || attempted > LIMIT) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    mem.set(key, text);
  },
  removeItem: key => { mem.delete(key); }
};
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const KEY = 'palazzo-2026.career.v1';
const addDays = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
const save = (week, { pad = 0, id = 'carriera-prova' } = {}) => ({ version: 1, career: { id, playerId: 'p' }, clock: { currentDate: addDays('2026-10-12', week * 7) }, dataset: { politicians: [{ id: 'p', displayName: 'Prova Verifica' }], offices: [] }, game: { week: { index: week, number: week }, timeline: [], party: { label: 'Indipendente' } }, saveMeta: { careerId: id, revision: 0 }, pad: 'x'.repeat(pad) });
let tabs = 0;
const open = async (indexedDB) => {
  if (indexedDB) globalThis.indexedDB = indexedDB; else delete globalThis.indexedDB;
  return (await import(`../src/core/storage.js${v}&tab=${++tabs}`)).storage;
};
const snapshot = () => Object.fromEntries(mem);

// ---------- 0. without IndexedDB: as before ----------
{
  const storage = await open(null);
  assert.equal(storage.vaultReport().available, false, 'Senza IndexedDB lo strato non c’è.');
  const result = storage.save(save(1));
  assert.equal(result.durable, true, 'In localStorage il salvataggio è al sicuro subito.');
  assert.equal(storage.load().game.week.index, 1);
  storage.save(save(2));
  storage.saveSlot(save(2), { name: 'Slot di prova' });
}
const legacy = snapshot();
assert.ok(legacy[KEY] && legacy[`${KEY}.backup`] && Object.keys(legacy).some(key => key.startsWith('politicando.slot.')), 'Ci sono main, copia e slot, scritti solo in localStorage (un browser com’era).');

// ---------- 1. migration: copied to IndexedDB, read back, nothing deleted, not repeated ----------
const fake = createFakeIndexedDB();
const tabA = await open(fake.factory);
let report = tabA.vaultReport();
assert.equal(report.available, true, 'IndexedDB è aperto.');
const bulk = Object.keys(legacy).filter(key => key === KEY || key.startsWith(`${KEY}.`) || key.startsWith('politicando.slot.')).filter(key => !key.endsWith('.lock'));
assert.deepEqual([...report.migrated.keys].sort(), [...bulk].sort(), 'Copiate in IndexedDB tutte e solo le chiavi dei salvataggi.');
assert.deepEqual([...report.migrated.verified].sort(), [...bulk].sort(), 'E riletta da IndexedDB: ogni copia coincide.');
assert.deepEqual(report.migrated.mismatches, [], 'Nessuna differenza.');
const rows = fake.databases.get('politicando-vault').stores.get('entries').rows;
for (const key of bulk) assert.equal(rows.get(key).value, legacy[key], `La copia di ${key} è identica.`);
assert.deepEqual(snapshot(), legacy, 'Nessuna chiave di localStorage è stata cancellata o cambiata.');
const putsAfterFirst = fake.puts;
const tabB = await open(fake.factory);
report = tabB.vaultReport();
assert.deepEqual(report.migrated.keys, [], 'Riaprendo non si copia di nuovo nulla (idempotente).');
assert.equal(report.migrated.skipped.length, bulk.length, 'Tutto è già uguale: saltato.');
assert.ok(fake.puts - putsAfterFirst <= 1, 'Nessuna scrittura in più oltre al registro.');
assert.deepEqual(snapshot(), legacy, 'Ancora nulla è cambiato in localStorage.');
assert.equal(tabB.load().game.week.index, 2, 'La carriera si legge come prima.');

// ---------- 2. localStorage full: the save lives in memory + IndexedDB, and is called safe only when IndexedDB says so ----------
fake.databases.get('politicando-vault').stores.get('entries').rows.delete('__meta__');
full = true;
const big = save(3, { pad: 200_000 });
const r3 = tabB.save(big);
assert.equal(r3.durable, false, 'Con localStorage pieno il salvataggio NON è al sicuro subito.');
assert.equal(await r3.confirm, true, 'IndexedDB lo conferma.');
assert.equal(tabB.durability(KEY).durable, true, 'Dopo la conferma risulta al sicuro.');
assert.equal(tabB.load().game.week.index, 3, 'Si rilegge l’ultimo stato.');
assert.equal(JSON.parse(mem.get(KEY)).game.week.index, 2, 'In localStorage c’è ancora la copia vecchia (non è stata toccata).');
// reload: a new page on the same storage finds the latest career
full = false;
const reloaded = await open(fake.factory);
assert.equal(reloaded.load().game.week.index, 3, 'Dopo un ricaricamento si trova la carriera più recente, non quella vecchia di localStorage.');
assert.equal(reloaded.latestRevision('carriera-prova') >= 3, true);
// space came back: the next save goes to localStorage again, and the memory copy is dropped
const r4 = reloaded.save(save(4));
assert.equal(r4.durable, true, 'Tornato lo spazio, si scrive di nuovo in localStorage.');
assert.equal(JSON.parse(mem.get(KEY)).game.week.index, 4);

// ---------- 3. the write nobody can take is never called saved ----------
full = true;
fake.failPut = Object.assign(new Error('IndexedDB: spazio esaurito'), { name: 'QuotaExceededError' });
const r5 = reloaded.save(save(5));
assert.equal(r5.durable, false, 'Né localStorage né IndexedDB: non è al sicuro.');
assert.equal(await r5.confirm, false, 'E la conferma dice di no: il chiamante lo mostra come errore.');
assert.equal(reloaded.load().game.week.index, 5, 'Lo stato resta leggibile in memoria (si può esportare).');
assert.ok(reloaded.vaultReport().failed.some(item => item.key === KEY), 'Il rapporto dice quale scrittura è fallita.');
fake.failPut = null; full = false;

// ---------- 4. two tabs: the overflow of one is seen by the other ----------
const tabOne = await open(fake.factory), tabTwo = await open(fake.factory);
full = true;
const r6 = tabOne.save(save(6));
assert.equal(await r6.confirm, true);
await new Promise(resolve => setTimeout(resolve, 80));
assert.equal(tabTwo.load().game.week.index, 6, 'L’altra scheda vede lo stato scritto solo in memoria e IndexedDB.');
full = false;
for (const tab of [tabOne, tabTwo, tabA, tabB, reloaded]) tab.vaultReport();
globalThis.__closeTiers?.();

// ---------- 5. no room even for the lock: the save goes on ----------
mem.clear(); full = false;
const fresh = await open(createFakeIndexedDB().factory);
mem.set('filler', 'x'.repeat(LIMIT - 400_000));
const small = save(1, { pad: 100_000 });
fresh.save(small);
mem.set('filler', 'x'.repeat(LIMIT - 20));
const r7 = fresh.save(save(2, { pad: 100_000 }));
assert.equal(await r7.confirm, true, 'Senza spazio nemmeno per il blocco, il salvataggio passa da IndexedDB e viene confermato.');
assert.equal(fresh.load().game.week.index, 2);

// ---------- 6. many slots and a long career: the budget keeps room for the small keys ----------
mem.clear(); full = false;
const crowded = await open(createFakeIndexedDB().factory);
for (let week = 1; week <= 5; week++) { crowded.save(save(week, { pad: 900_000 })); crowded.saveSlot(save(week, { pad: 900_000 }), { name: `Slot ${week}` }, null); }
const bulkChars = [...mem].filter(([key]) => key === KEY || key.startsWith(`${KEY}.`) || key.startsWith('politicando.slot.')).reduce((sum, [, value]) => sum + value.length, 0);
assert.ok(bulkChars <= 3_000_000 + 1_000_000, `In localStorage i salvataggi restano nel budget (${bulkChars} caratteri), il resto sta in IndexedDB.`);
assert.ok(used() < LIMIT - 1_000_000, 'E resta spazio per chiavi piccole (blocco, indici, coda, impostazioni).');
assert.ok(crowded.listSlots().length >= 1 && crowded.listSlots().length <= 5, 'Gli slot sono elencati tutti, ovunque siano scritti.');
await Promise.all(crowded.listSlots().map(async slot => assert.equal(await crowded.slotDurability(slot.id).confirm, true, 'Ogni slot è confermato.')));
const afterReload = await open(createFakeIndexedDB().factory);
assert.equal(afterReload.load().game.week.index, 5, 'Con un IndexedDB nuovo e lo stesso localStorage, la carriera è quella di prima.');
console.log('Salvataggi su due livelli verificati (localStorage + IndexedDB, simulati): ciò che localStorage già aveva è copiato in IndexedDB, riletto e controllato senza cancellare nulla e senza ripetersi; con localStorage pieno il salvataggio vive in memoria e IndexedDB ed è «al sicuro» solo a conferma avvenuta; dopo il ricaricamento si ritrova la carriera più recente; una scrittura che nessuno può accettare è segnalata e lo stato resta esportabile; due schede si vedono; senza spazio per il blocco il salvataggio prosegue; con molti slot i salvataggi restano nel budget e lasciano spazio alle chiavi piccole; senza IndexedDB tutto funziona come prima.');
process.exit(0);
