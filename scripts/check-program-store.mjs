// The programme in the game (store): a promise is made, lives weeks and is judged against what really happened; the consequences land once (reputation, memory, log); the promise is
// announced in a real campaign (feeds the topic, credibility counts); everything survives the save, the export and the import; a save from before (no programme) loads as it was.
import assert from 'node:assert/strict';
import { startCareer, playWeek } from './lib/long-run.mjs';
import { promisesOf } from '../src/core/program-engine.js';

const { store, db, decide } = await startCareer({ seed: 'programma', level: 'deputato', fast: true, territorial: true });
const stat = metric => store.getState().dataset.statistics.find(item => item.subjectId === store.getState().career.playerId && item.metric === metric)?.value ?? 50;
const view0 = store.programView();
assert.deepEqual(view0.promises, [], 'Una carriera nuova non ha promesse.');
assert.ok(view0.credibility.score > 50, 'Si parte con una credibilità normale.');

// make, refuse the duplicate, see it in the view
const made = store.makePromise({ area: 'sanita', scope: 'candidato', instrument: 'riforma', ambition: 'prudente', dueWeeks: 9 });
assert.equal(made.promise.status, 'non-avviata');
assert.throws(() => store.makePromise({ area: 'sanita', scope: 'candidato' }), /già una promessa aperta/);
assert.equal(store.programView().promises.length, 1);
assert.ok(store.getState().game.memory.some(item => /Promessa su sanità/i.test(item.text)), 'La promessa entra nella memoria politica.');
assert.throws(() => store.announcePromise(made.promise.id), /durante una campagna/, 'Si presenta agli elettori solo in campagna.');

// weeks go by with nothing done: delayed, then broken, with the consequences once
const reputationBefore = stat('reputation');
const memoryBefore = store.getState().game.memory.length;
let sawDelayed = false;
for (let week = 0; week < 40 && promisesOf(store.getState().game)[0].status !== 'non-mantenuta'; week++) {
  store.advance(7);
  if (promisesOf(store.getState().game)[0].status === 'ritardata') sawDelayed = true;
}
const settled = promisesOf(store.getState().game)[0];
assert.ok(sawDelayed, 'Prima di essere tradita la promessa è «ritardata».');
assert.equal(settled.status, 'non-mantenuta', 'Senza alcun provvedimento la promessa scade e non è mantenuta.');
assert.ok(settled.history.length >= 3, 'La storia registra le tappe.');
assert.ok(stat('reputation') < reputationBefore, 'La reputazione scende.');
assert.ok(store.getState().game.memory.some(item => item.kind === 'promessa-tradita' && /sanità/i.test(item.text)), 'Il tradimento resta nella memoria politica.');
assert.ok(store.getState().game.memory.length > memoryBefore);
assert.ok(store.getState().game.log.some(item => item.kind === 'programma' && /non mantenuta/i.test(item.title)), 'Il diario lo racconta.');
const afterSettle = { reputation: stat('reputation'), memory: store.getState().game.memory.filter(item => item.kind === 'promessa-tradita').length };
for (let week = 0; week < 6; week++) store.advance(7);
assert.equal(store.getState().game.memory.filter(item => item.kind === 'promessa-tradita').length, afterSettle.memory, 'Nessun secondo tradimento registrato: effetti una volta sola.');
assert.ok(store.programView().credibility.score < view0.credibility.score, 'Dopo un tradimento la credibilità è più bassa.');

// modify and withdraw
const second = store.makePromise({ area: 'scuola', scope: 'partito', ambition: 'media' });
const modified = store.modifyPromise(second.promise.id, { ambition: 'prudente', extraWeeks: 8 });
assert.equal(store.programView().promises.find(item => item.id === second.promise.id).status, 'modificata');
assert.equal(store.programView().promises.find(item => item.id === modified.next.id).status, 'non-avviata');
const reputationMod = stat('reputation');
store.withdrawPromise(modified.next.id);
assert.ok(stat('reputation') < reputationMod, 'Ritirare una promessa costa.');
assert.equal(store.programView().promises.find(item => item.id === modified.next.id).status, 'non-mantenuta');

// the save keeps everything, the import gives the same game
const before = JSON.stringify(store.programView().promises);
store.loadGame(JSON.parse(store.exportSave()));
assert.equal(JSON.stringify(store.programView().promises), before, 'Esporta e importa: le promesse sono identiche.');
// an old save (no promises key, no programme) loads and works
const old = JSON.parse(store.exportSave());
delete old.game.promises;
store.loadGame(old);
assert.deepEqual(store.programView().promises, [], 'Un salvataggio senza promesse si carica.');
assert.doesNotThrow(() => store.advance(7));
console.log('Programma e promesse (store) verificati: promessa registrata e in memoria, ritardo e tradimento con conseguenze una sola volta, credibilità, modifica e ritiro, salvataggio ed export identici, compatibilità con un salvataggio precedente.');
