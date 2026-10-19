// An older slot, a backup or a history copy never takes the place of an advanced career. A real career is played for some weeks; a slot is saved at the start, a backup in the middle;
// then each older copy is restored in the three ways the game has (opening the slot, going back to the backup, going back to a history copy) and the advanced career must stay whole:
// the same identity, the same date and week in the main save, in `bestForCareer` and in a slot — the older copy comes back as a career of its own. A plain write of an older state is refused.
import assert from 'node:assert/strict';

const { startCareer } = await import('./lib/long-run.mjs');
const run = await startCareer({ seed: 'slot-obsoleto', level: 'comunale' });
const { store } = run;
const { readFile } = await import('node:fs/promises');
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const { storage, compareSaveProgress } = await import(`../src/core/storage.js${v}`);
const mem = globalThis.localStorage.__mem ?? null;
const KEY = 'palazzo-2026.career.v1';
const mainState = () => JSON.parse(globalThis.localStorage.getItem(KEY));
const snap = () => ({ id: store.getState().career.id, date: store.getState().clock.currentDate, week: store.getState().game.week.index });

const careerId = store.getState().career.id;
const first = snap();
// 1. the slot of the first week and a history/backup copy of the middle of the career
store.saveToSlot('Prima settimana', 'slot-vecchio', { manual: true });
for (let week = 0; week < 3; week++) store.advance(7);
const middle = JSON.parse(JSON.stringify(store.getState()));
assert.ok(storage.backup(middle, 'copia-intermedia'), 'La copia intermedia è nel backup.');
for (let week = 0; week < 5; week++) store.advance(7);
store.save();
const last = snap();
assert.ok(last.week > first.week + 5 && last.date > first.date, `La carriera è avanzata (${first.date} → ${last.date}).`);
assert.equal(mainState().clock.currentDate, last.date, 'Il salvataggio principale è alla data avanzata.');
const oldSlot = storage.loadSlot('slot-vecchio');
assert.equal(oldSlot.career.id, careerId, 'Lo slot vecchio è della stessa carriera.');
assert.equal(compareSaveProgress(oldSlot, mainState()), -1, 'Lo slot è davvero più vecchio del principale.');

// 2. a plain write of the older state is refused and leaves the main save as it was
assert.throws(() => storage.save(oldSlot), /obsoleto/, 'Una copia vecchia non sovrascrive la carriera avanzata.');
assert.equal(mainState().clock.currentDate, last.date, 'Il principale non è tornato indietro.');
assert.equal(storage.bestForCareer(careerId).clock.currentDate, last.date, 'La versione più avanzata della carriera resta quella attuale.');

// 3. opening the old slot: a career of its own; the advanced one stays whole
store.loadSlot('slot-vecchio');
const opened = snap();
assert.equal(opened.date, first.date, 'Aprire lo slot riporta alla sua data…');
assert.notEqual(opened.id, careerId, '…ma come carriera separata, con una nuova identità.');
assert.equal(storage.bestForCareer(careerId).clock.currentDate, last.date, 'La carriera avanzata è intatta per la sua identità.');
assert.ok(storage.listSlots().some(item => { const kept = storage.loadSlot(item.id); return kept.career.id === careerId && kept.clock.currentDate === last.date; }), 'La carriera avanzata è conservata, intera, in uno slot.');
// the slot itself is not touched
assert.equal(storage.loadSlot('slot-vecchio').clock.currentDate, first.date, 'Lo slot vecchio è com’era.');

// 4. back to the advanced career, then an older local copy (backup or history): again a separate career
store.loadGame(storage.bestForCareer(careerId), 'Ritorno alla carriera avanzata');
assert.deepEqual(snap(), last, 'Si torna alla carriera avanzata, alla stessa data e settimana.');
const versions = store.localVersions();
const older = versions.filter(item => item.careerId === careerId && item.older);
assert.ok(older.length, `Tra le copie locali ce n'è una più vecchia della carriera avanzata (${versions.map(item => `${item.id}:${item.gameDate}`).join(', ')}).`);
assert.ok(versions.filter(item => item.careerId === careerId && !item.older).every(item => item.gameDate >= last.date), 'Le copie non segnalate come vecchie non sono indietro.');
const copy = older[0];
store.restoreLocalVersion(copy.id);
assert.equal(snap().date, copy.gameDate, 'La copia vecchia riporta alla sua data…');
assert.notEqual(snap().id, careerId, '…come carriera separata.');
assert.ok(copy.gameDate < last.date, 'Ed è indietro rispetto alla carriera avanzata.');
assert.equal(storage.bestForCareer(careerId).clock.currentDate, last.date, 'La carriera avanzata resta intatta anche dopo il ripristino di una copia locale vecchia.');
store.loadGame(storage.bestForCareer(careerId), 'Ritorno alla carriera avanzata');

// 5. a stale main with the advanced copy in the backup: the load repairs it, never the other way round
const advanced = JSON.parse(JSON.stringify(store.getState()));
globalThis.localStorage.setItem(KEY, JSON.stringify(oldSlot));
assert.equal(storage.backup(advanced, 'copia-avanzata'), true);
assert.equal(storage.load().clock.currentDate, last.date, 'Un principale vecchio viene riparato dalla copia avanzata.');
assert.equal(mainState().clock.currentDate, last.date, 'E il principale riparato è quello avanzato.');
void mem;
console.log(`Slot obsoleti verificati: slot (${first.date}), copia locale vecchia (${copy.gameDate}) e principale vecchio non sovrascrivono la carriera avanzata (${last.date}); le copie vecchie tornano come carriere separate.`);
