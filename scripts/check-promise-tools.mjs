// The tools of the promises (program-engine.js, store.js): priority (at most two at the top, a record in the history, a weight in credibility and when a promise is settled), the revision with a reason
// (a reason the game confirms softens the price, none makes it heavier, the history says which), the negotiation with an ally of the accord (one capital point, seeded draw, the cost is shared or the tie
// cools) and the proposal of the programme presented as a bill (a real bill with the area, the instrument and the financing of the proposal; never a law or a promise by itself).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const E = await load('src/core/program-engine.js');
const { INSTRUMENT_KINDS } = await load('src/data/simulation/policy-rules.js');

// ---------- the engine ----------
const ctx = { week: 10, date: '2026-03-01', society: { economy: { deficit: 3 }, mood: 50 }, reputation: 50 };
let game = { promises: [] };
const first = E.makePromise(game, { area: 'sanita', priority: 'alta' }, ctx);
assert.equal(first.promise.priority, 'alta'); game = { promises: [first.promise] };
const second = E.makePromise(game, { area: 'scuola' }, ctx); assert.equal(second.promise.priority, 'media', 'Di norma la priorità è media.');
game = { promises: [first.promise, second.promise] };
const high = E.setPromisePriority(game, second.promise.id, 'alta', ctx); assert.equal(high.priority, 'alta'); assert.match(high.history.at(-1).text, /Priorità: priorità alta/);
const third = E.makePromise({ promises: [first.promise, high] }, { area: 'lavoro' }, ctx).promise;
assert.throws(() => E.setPromisePriority({ promises: [first.promise, high, third] }, third.id, 'alta', ctx), /Due promesse in cima/, 'Al massimo due promesse in cima.');
assert.throws(() => E.setPromisePriority(game, second.promise.id, 'urgentissima', ctx), /Scegli una priorità/);
// weight: a broken promise at the top weighs more on credibility than one at the bottom
const broken = priority => ({ ...first.promise, status: 'non-mantenuta', priority });
assert.ok(E.credibility({ promises: [broken('alta')] }, {}).score < E.credibility({ promises: [broken('bassa')] }, {}).score, 'Tradire una promessa in cima pesa di più.');
assert.ok(E.settleEffects(broken('alta'), 'non-mantenuta').reputation < E.settleEffects(broken('bassa'), 'non-mantenuta').reputation);
assert.ok(E.settleEffects({ ...first.promise, priority: 'alta' }, 'mantenuta').reputation > E.settleEffects({ ...first.promise, priority: 'bassa' }, 'mantenuta').reputation, 'Mantenere una promessa in cima vale di più.');

// revision with a reason
const tight = { economy: { deficit: 5.5 }, mood: 50 }, calm = { economy: { deficit: 2.4 }, mood: 55 };
const priceOf = (society, reason, extra = {}) => E.modifyPromise({ promises: [first.promise] }, first.promise.id, { ambition: 'prudente', extraWeeks: 8, reason }, { ...ctx, society, ...extra });
const withReason = priceOf(tight, 'risorse'), without = priceOf(tight, 'nessuno'), invented = priceOf(calm, 'risorse');
assert.equal(withReason.reason.valid, true, 'Mancano davvero le risorse (deficit alto): il motivo regge.');
assert.equal(invented.reason.valid, false, 'Con i conti in ordine «mancano le risorse» non regge.');
assert.ok(Math.abs(withReason.effects.reputation) < Math.abs(invented.effects.reputation) && Math.abs(invented.effects.reputation) < Math.abs(without.effects.reputation) + 0.001, 'Un motivo che regge costa meno, nessun motivo costa di più.');
assert.match(withReason.next.history.map(item => item.text).join(' '), /Motivo: mancano le risorse/, 'Lo storico dice il motivo.');
assert.match(invented.next.history.map(item => item.text).join(' '), /i fatti non lo confermano/, 'Un motivo non confermato lo dice.');
assert.equal(priceOf(calm, 'alleati', { allied: true }).reason.valid, true, 'Gli alleati: vale se c’è un’alleanza.');
assert.equal(priceOf(calm, 'alleati', { allied: false }).reason.valid, false);

// negotiation
const ally = { id: 'party-alleato', label: 'Alleati Uniti' };
const yes = E.negotiatePromise({ promises: [first.promise] }, first.promise.id, { ally, tie: 60, roll: 0.05 }, ctx), no = E.negotiatePromise({ promises: [first.promise] }, first.promise.id, { ally, tie: 60, roll: 0.99 }, ctx);
assert.equal(yes.ok, true); assert.ok(yes.promise.cost < first.promise.cost, 'Il costo si divide.'); assert.equal(yes.promise.backedBy[0].id, ally.id); assert.equal(yes.effects.capital, -1); assert.ok(yes.effects.tie > 0);
assert.equal(no.ok, false); assert.equal(no.promise.cost, first.promise.cost); assert.equal(no.effects.capital, -1, 'Il capitale si spende comunque.'); assert.ok(no.effects.tie < 0);
assert.throws(() => E.negotiatePromise({ promises: [yes.promise] }, first.promise.id, { ally, tie: 60, roll: 0.1 }, ctx), /sostiene già/);
assert.ok(E.negotiatePromise({ promises: [first.promise] }, first.promise.id, { ally, tie: 90, roll: 0.5 }, ctx).chance > E.negotiatePromise({ promises: [first.promise] }, first.promise.id, { ally, tie: -40, roll: 0.5 }, ctx).chance, 'Più il rapporto è buono, più è probabile.');

// ---------- the store ----------
{
  const { store, db } = await startCareer({ seed: 'promise-tools', level: 'deputato', fast: true });
  const made = store.makePromise({ area: 'sanita', scope: 'candidato', instrument: 'servizi', ambition: 'media' });
  assert.equal(made.promise.instrument, 'servizi', 'I nuovi strumenti si possono promettere.');
  const week = store.getState().game.week.index;
  store.setPromisePriority(made.promise.id, 'alta');
  assert.equal(store.getState().game.promises.find(item => item.id === made.promise.id).priority, 'alta');
  assert.equal(store.getState().game.week.index, week, 'Cambiare priorità non fa avanzare la settimana.');
  assert.equal(store.getState().game.promises.filter(item => item.kind === 'programma').length, 1, 'Nessuna promessa in più.');
  // no accord, no ally: the negotiation is refused with a clear sentence and nothing is spent
  const capital = store.getState().game.resources.politicalCapital;
  assert.throws(() => store.negotiatePromise(made.promise.id, 'party-qualunque'), /non è un tuo alleato/);
  assert.equal(store.getState().game.resources.politicalCapital, capital);
  // with an alliance of the world: the draw is seeded, one capital point is spent, the tie moves, the history says it
  const save = JSON.parse(store.exportSave());
  const own = save.world.playerPartyId, other = save.world.parties.find(item => item.active && !item.isPlayer && item.refSource === 'real');
  save.world.alliances = [{ id: 'intesa-promesse', partyIds: [own, other.id], leaderId: own, status: 'active', terms: [] }];
  store.loadGame(save);
  assert.equal(store.promiseAllies()[0].id, other.id);
  const result = store.negotiatePromise(made.promise.id, other.id);
  assert.equal(store.getState().game.resources.politicalCapital, capital - 1, 'Un punto di capitale speso.');
  assert.equal(store.getState().game.promises.find(item => item.id === made.promise.id).history.at(-1).text.includes(other.label), true);
  assert.equal(typeof result.ok, 'boolean');
  // a revision with a reason, recorded
  store.modifyPromise(made.promise.id, { ambition: 'prudente', extraWeeks: 8, reason: 'scenario' });
  const revised = store.getState().game.promises.find(item => item.id.includes('~1'));
  assert.ok(/Motivo: il quadro è cambiato/.test(revised.history.map(item => item.text).join(' ')), 'La revisione ricorda il motivo.');
  assert.equal(revised.priority, 'alta', 'La priorità passa alla versione modificata.');
  // the proposal as a bill: only with a parliamentary path; a real bill, no promise, no law by itself
  store.addProposal({ area: 'sanita', title: 'Più servizi nelle aree interne', problem: 'Mancano sportelli', objective: 'Coprire le aree scoperte', measures: [{ instrument: 'servizi', text: 'Personale negli sportelli' }, { instrument: 'incentivi', text: 'Sgravi per chi assume' }], cost: 4, financing: 'bilancio', deadlineWeeks: 104 });
  const proposal = store.programView().proposals.list[0];
  store.setProposalState(proposal.id, 'pubblicata');
  const promisesBefore = store.getState().game.promises.length, lawsBefore = (store.getState().parliament?.laws ?? []).length;
  const bill = store.proposalToBill(proposal.id);
  assert.ok(bill?.id, 'È un disegno di legge vero.'); assert.equal(bill.policy?.instrument, 'servizi', 'Porta lo strumento della prima misura.'); assert.equal(bill.policy?.area, 'sanita');
  assert.equal(store.getState().parliament.laws.length, lawsBefore + 1); assert.notEqual(bill.stage, 'approved', 'Non è una legge: deve fare il suo percorso.');
  assert.equal(store.getState().game.promises.length, promisesBefore, 'Non diventa una promessa.');
  assert.throws(() => store.proposalToBill(proposal.id), /già stata presentata/, 'Non si presenta due volte.');
}
console.log('Strumenti delle promesse verificati: priorità (al massimo due in cima, peso su credibilità ed effetti), revisione con motivo (confermato dai fatti o no), trattativa con un alleato (un capitale, estrazione deterministica, costo diviso o rapporto che si raffredda), proposta del programma presentata come disegno di legge vero.');
