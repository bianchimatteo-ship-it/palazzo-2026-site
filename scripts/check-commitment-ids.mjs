// Regression: the commitments a mayor (or a president of the Province or of the Region) takes with the citizens ("work-request-promise")
// are kept in a list capped at 12. The id used to be built from the length of the list, which stops growing once it is full, so from the
// 13th commitment on two of them shared the same id (the invariant "id-duplicato" of the long run). The id must stay unique far beyond the cap,
// and a save written before the fix (with the old ids) must keep working: new ids never collide with the existing ones.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { addSituationEvent } = await module('src/core/career-engine.js');
const { checkInvariants } = await module('src/core/invariants.js');

const run = await startCareer({ seed: 'impegni-id', level: 'comunale', fast: true });
const { store } = run;
const comune = () => store.getState().local.institutions.find(item => item.kind === 'comune' && item.status === 'active');
assert.ok(comune(), 'La carriera ha un Comune attivo');

// The player leads the executive (the request of the citizens is for who decides); the commitments of the test are closed one by one so that the same theme can be promised again.
const promise = n => {
  const state = store.getState();
  const inst = comune();
  state.local = { ...state.local, institutions: state.local.institutions.map(item => item.id === inst.id ? { ...item, executive: { ...item.executive, leader: 'player' }, commitments: (item.commitments ?? []).map(c => ({ ...c, status: 'chiuso' })) } : item) };
  state.game = addSituationEvent(state.game, 'opera-richiesta', { area: 'sport', areaLabel: 'sport', value: '40', who: 'Cittadini', weeks: '12', place: inst.name, institution: 'giunta', instId: inst.id }, false);
  state.game.week.ap = Math.max(state.game.week.ap ?? 0, 3);
  const item = state.game.inbox.filter(entry => entry.templateId === 'opera-richiesta').at(-1);
  assert.ok(item, `Richiesta ${n}: nell’agenda`);
  store.resolveAgendaItem(item.id, 'promuovi');
};

// ---------- 1. unique ids far beyond the cap of 12 ----------
for (let n = 1; n <= 30; n++) {
  promise(n);
  const ids = comune().commitments.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, `Impegno ${n}: id tutti diversi (${ids.join(', ')})`);
  assert.ok(ids.length <= 12, 'La lista resta limitata a 12');
}
assert.equal(comune().commitments.filter(item => item.status === 'aperto').length, 1, 'Resta aperto solo l’ultimo impegno');
const all = comune().commitments.map(item => item.id);
assert.ok(all.every(id => id.startsWith(`${comune().id}-impegno-opera-`)), 'Gli id mantengono il prefisso storico');
assert.ok(checkInvariants(store.getState()).ok, 'Gli invarianti del gioco sono rispettati');

// ---------- 2. a save written with the old ids (same shape) keeps working ----------
{
  const inst = comune();
  const old = Array.from({ length: 12 }, (_, i) => ({ ...inst.commitments.at(-1), id: `${inst.id}-impegno-opera-${i + 2}`, status: 'chiuso' }));
  const state = store.getState();
  state.local = { ...state.local, institutions: state.local.institutions.map(item => item.id === inst.id ? { ...item, commitments: old } : item) };
  promise(31);
  const ids = comune().commitments.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'Con gli id del vecchio schema il nuovo impegno non ne duplica nessuno');
  assert.ok(ids.at(-1) && !old.some(item => item.id === ids.at(-1)), 'Il nuovo id non coincide con uno esistente');
}
console.log('Impegni con i cittadini verificati: id unici oltre il limite di 12 (30 impegni di fila), prefisso storico mantenuto, vecchi salvataggi compatibili e invarianti rispettati.');
