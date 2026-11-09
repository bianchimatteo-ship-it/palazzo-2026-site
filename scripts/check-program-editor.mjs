// The programme editor (core/program-proposals.js + the store): a proposal is written, edited, published, reordered, linked to a promise only when a real relation exists (same area, the player's own),
// deleted; it is assessed against the budget; a published proposal that is covered raises the credibility of the programme and one that is not lowers it, a draft does nothing; the areas enter the
// rally context and the Government priorities; the preview shows what is published; everything survives the save and an old save (no proposals) loads as it was.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { promisesOf } from '../src/core/program-engine.js';
import { FINANCING, PROPOSAL_LIMIT } from '../src/core/program-proposals.js';

const { store } = await startCareer({ seed: 'editor-programma', level: 'deputato', fast: true, territorial: true });
const view0 = store.programView();
assert.deepEqual(view0.proposals.list, [], 'Una carriera nuova ha un programma vuoto.');
const base = view0.credibility.score;
const measure = (text, instrument = 'investimento') => [{ instrument, text }];

// validation
assert.throws(() => store.addProposal({ area: 'inesistente', measures: measure('x') }), /area politica/);
assert.throws(() => store.addProposal({ area: 'sanita', title: 'Senza misure', measures: [] }), /almeno una misura/);
// a draft: it does nothing
const draft = store.addProposal({ area: 'sanita', title: 'Più medici di base', problem: 'Mancano medici nei piccoli comuni', objective: 'Coprire i posti scoperti', measures: measure('Assunzioni nei comuni scoperti'), cost: 2, financing: 'bilancio', deadlineWeeks: 104 });
assert.equal(draft.status, 'bozza');
assert.equal(store.programView().credibility.score, base, 'Una bozza non cambia la credibilità.');
assert.equal(store.programView().proposals.preview.items.length, 0, 'La bozza non compare nell’anteprima per gli elettori.');
assert.equal(store.programView().proposals.preview.drafts, 1);
// text is cleaned and bounded
const dirty = store.addProposal({ area: 'scuola', title: `<b>${'x'.repeat(200)}</b>`, measures: measure('<i>Mense</i>'), cost: 1.5 });
assert.ok(dirty.title.length <= 80 && !/[<>]/.test(dirty.title + dirty.measures[0].text), 'Il testo scritto dal giocatore è ripulito e limitato.');
// publish: covered proposal helps
store.setProposalState(draft.id, 'pubblicata');
const covered = store.programView();
assert.equal(covered.proposals.list.find(item => item.id === draft.id).assessment.level, 'solida');
assert.ok(covered.credibility.score > base, `Una proposta pubblicata e coperta aumenta la credibilità (${base} → ${covered.credibility.score}).`);
assert.equal(covered.proposals.preview.items.length, 1);
assert.ok(covered.proposals.preview.total > 0);
// an uncovered one hurts and is what the rivals attack
const bad = store.addProposal({ area: 'welfare', title: 'Sussidio per tutti', measures: measure('Sussidio universale', 'sostegno'), cost: 40, financing: 'debito', deadlineWeeks: 26 });
store.setProposalState(bad.id, 'pubblicata');
const hurt = store.programView();
assert.equal(hurt.proposals.list.find(item => item.id === bad.id).assessment.level, 'scoperta');
assert.ok(hurt.credibility.score < covered.credibility.score, 'Una proposta senza copertura abbassa la credibilità.');
assert.ok(hurt.credibility.notes.some(line => /senza copertura|non ha copertura/i.test(line)), 'E la nota lo dice.');
// the areas enter the rally context and the Government priorities
const ctx = store.getState().game.proposals.filter(item => item.status === 'pubblicata').map(item => item.area);
assert.deepEqual(ctx.sort(), ['sanita', 'welfare']);
assert.ok(hurt.suggestion.includes('sanita'), 'Le proposte pubblicate entrano nelle priorità del Governo.');
// reorder: priority is the order, never outside the list
store.moveProposal(bad.id, -1);
assert.deepEqual(store.programView().proposals.list.map(item => item.priority), [1, 2, 3]);
assert.deepEqual(store.programView().proposals.list.map(item => item.id), [draft.id, bad.id, dirty.id], 'La proposta salita di un posto passa davanti alla precedente.');
const order = store.programView().proposals.list.map(item => item.id);
store.moveProposal(order[0], -1);
assert.deepEqual(store.programView().proposals.list.map(item => item.id), order, 'Spostare la prima verso l’alto non fa nulla.');
// link: only to the player's own promise in the same area, one proposal per promise
const promise = store.makePromise({ area: 'sanita', scope: 'candidato', instrument: 'riforma', ambition: 'prudente', dueWeeks: 9 }).promise;
const sanita = store.programView().proposals.list.find(item => item.id === draft.id);
assert.deepEqual(sanita.linkable.map(item => item.id), [promise.id], 'Si può collegare solo la promessa della stessa area.');
assert.throws(() => store.linkProposal(bad.id, promise.id), /stessa area/, 'Nessun collegamento fra aree diverse.');
store.linkProposal(draft.id, promise.id);
assert.equal(store.programView().proposals.list.find(item => item.id === draft.id).linked.id, promise.id);
assert.equal(promisesOf(store.getState().game).length, 1, 'Collegare non crea né duplica promesse.');
const second = store.addProposal({ area: 'sanita', title: 'Altra proposta sanità', measures: measure('Telemedicina'), cost: 0.5 });
assert.deepEqual(store.programView().proposals.list.find(item => item.id === second.id).linkable, [], 'Una promessa già collegata non si collega due volte.');
// editing keeps the link in the same area and breaks it when the area changes
store.editProposal(draft.id, { title: 'Più medici nei territori' });
assert.equal(store.programView().proposals.list.find(item => item.id === draft.id).linked.id, promise.id);
store.editProposal(draft.id, { area: 'scuola' });
assert.equal(store.programView().proposals.list.find(item => item.id === draft.id).linked, null, 'Cambiando area il collegamento cade.');
// the limit and the deletion (priorities close up)
for (let i = store.programView().proposals.list.length; i < PROPOSAL_LIMIT; i++) store.addProposal({ area: 'cultura', title: `Cultura ${i}`, measures: measure('Un teatro'), cost: 0.2 });
assert.throws(() => store.addProposal({ area: 'cultura', measures: measure('Un altro') }), /al massimo/);
store.deleteProposal(bad.id);
assert.deepEqual(store.programView().proposals.list.map(item => item.priority), Array.from({ length: PROPOSAL_LIMIT - 1 }, (_, i) => i + 1));
assert.ok(!store.programView().proposals.list.some(item => item.id === bad.id));
// the save and the import give the same programme; an old save (no proposals) loads as it was
const before = JSON.stringify(store.programView().proposals.list.map(({ assessment, linkable, indicator, ...rest }) => rest));
store.loadGame(JSON.parse(store.exportSave()));
assert.equal(JSON.stringify(store.programView().proposals.list.map(({ assessment, linkable, indicator, ...rest }) => rest)), before, 'Esporta e importa: il programma è identico.');
const old = JSON.parse(store.exportSave()); delete old.game.proposals;
store.loadGame(old);
assert.deepEqual(store.programView().proposals.list, [], 'Un salvataggio senza proposte si carica con il programma vuoto.');
assert.doesNotThrow(() => store.advance(7));
assert.ok(Object.keys(FINANCING).length === 5);
console.log('check-program-editor: ok');
