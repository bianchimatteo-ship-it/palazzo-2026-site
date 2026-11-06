// Rival life between campaigns: a rival met before acts by personality and memory (pure engine), the move reaches the desk as an event, the answer is remembered in the registry and survives the save.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { rivalPulse, rivalMood, answerRivalMove, duelOutcome } from '../src/core/rival-life-engine.js';
import { RIVAL_SITUATIONS } from '../src/data/simulation/rival-life-rules.js';

const rec = (key, personality, memory = [], extra = {}) => ({ key, label: `Rivale ${key}`, personality, initiative: 0.9, relation: 50, memory, record: {}, lastMet: '2026-01-01', ...extra });
// mood and determinism
assert.ok(rivalMood(rec('a', 'aggressivo', [{ type: 'attack', weight: 2 }])).hostility > rivalMood(rec('b', 'aggressivo', [{ type: 'aid', weight: 2 }])).hostility);
const game = { rivalRegistry: [rec('a', 'aggressivo', [{ type: 'attack', weight: 2 }]), rec('d', 'diplomatico', [{ type: 'agreement', weight: 2 }])], promises: [{ area: 'sanita', status: 'in-corso' }] };
let first = null, week = 1;
for (; week < 400 && !first; week++) first = rivalPulse(game, { week });
assert.ok(first, 'Prima o poi un rivale agisce.');
assert.deepEqual(rivalPulse(game, { week: week - 1 }), first, 'Deterministico.');
assert.ok(RIVAL_SITUATIONS[first.kind]);
assert.equal(rivalPulse({ ...game, rivalLife: first.life }, { week: week + 2 }), null, 'Mai due mosse ravvicinate.');
assert.equal(rivalPulse({ rivalRegistry: [] }, { week: 10 }), null);
// kinds seen: the hostile one attacks, the diplomatic one offers a hand
const kinds = new Set(); for (let w = 1; w < 1500; w += 30) { for (const r of game.rivalRegistry) { const p = rivalPulse({ ...game, rivalRegistry: [r] }, { week: w }); if (p) kinds.add(`${r.personality}:${p.kind}`); } }
assert.ok([...kinds].some(k => k.startsWith('aggressivo:rivale-attacco')), [...kinds].join());
assert.ok([...kinds].some(k => k === 'diplomatico:rivale-mano-tesa'), [...kinds].join());
// answers
const counter = answerRivalMove(game.rivalRegistry, 'a', 'rival-counter', { date: '2026-02-01', week: 5 });
assert.ok(counter.registry[0].relation < 50 && counter.registry[0].memory[0].weight > 2);
const accept = answerRivalMove(game.rivalRegistry, 'd', 'rival-accept', { date: '2026-02-01', week: 5 });
assert.ok(accept.registry[1].relation > 50);
const duel = duelOutcome(game.rivalRegistry[0], { competence: 90, reputation: 90, week: 3 });
assert.ok(duel.margin > duelOutcome(game.rivalRegistry[0], { competence: 5, reputation: 5, week: 3 }).margin, 'Più competenza, margine migliore.');
assert.equal(duelOutcome(game.rivalRegistry[0], { competence: 0, reputation: 0, week: 3 }).won, false);

// in the game
const { store } = await startCareer({ seed: 'rivali', level: 'deputato', fast: true, territorial: true });
const s = store.getState();
s.game.rivalRegistry = [rec('rv1', 'aggressivo', [{ type: 'attack', weight: 2, count: 2, date: '2026-01-01' }], { initiative: 1 })];
assert.equal(store.rivalsView().length, 1);
let item = null;
for (let w = 0; w < 120 && !item; w++) { store.advance(7); item = store.getState().game.inbox.find(i => /^rivale-/.test(i.templateId)); }
assert.ok(item, 'La mossa del rivale arriva in agenda.');
assert.ok(store.getState().game.rivalLife.last.rv1 > 0);
const choice = item.choices.find(c => c.id !== item.defaultChoice) ?? item.choices[0];
const before = store.getState().game.rivalRegistry[0].relation;
store.resolveAgendaItem(item.id, choice.id);
const after = store.getState().game.rivalRegistry[0];
assert.ok(after.life?.moves === 1, 'La risposta è ricordata dal rivale.');
assert.notEqual(after.relation, before);
// save roundtrip
const raw = store.exportSave(); store.loadGame(JSON.parse(raw));
assert.equal(store.getState().game.rivalRegistry[0].life.moves, 1);
console.log('check-rival-life: ok');
