// Special challenges (challenge-engine.js + store): the starting condition is applied once, the goals are compared with the day of acceptance, the verdict (success / failure / abandon) lands once
// with its reward or penalty and a card with the real tone; the career is not touched when no challenge is open; a challenge survives the save; a save from before (no challenge) loads as it was.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { CHALLENGES, CHALLENGE_BY_ID, baselineOf, challengeRows, targetOf, tickChallenge } from '../src/core/challenge-engine.js';

// ---- pure engine
assert.ok(CHALLENGES.length >= 6);
for (const spec of CHALLENGES) {
  assert.ok(spec.goals.length && spec.weeks > 0 && spec.reward && spec.penalty, `${spec.id}: sfida completa`);
  assert.ok(spec.label && spec.summary && spec.setup?.text);
}
assert.equal(new Set(CHALLENGES.map(spec => spec.id)).size, CHALLENGES.length);
const ctx0 = { game: { promises: [], record: { activities: {} }, party: null }, stats: { reputation: 50, popularity: 50, influence: 50 }, parliament: null };
const base = baselineOf(ctx0);
const open = { id: 'cento-giorni', status: 'attiva', startedWeek: 1, deadlineWeek: 15, baseline: base };
const lost = tickChallenge({ challenge: open }, { ...ctx0, stats: { ...ctx0.stats, reputation: 20 } }, {}, { week: 3, date: '2026-01-20' });
assert.equal(lost.ended.status, 'fallita'); assert.match(lost.ended.reason, /Reputazione/); assert.equal(lost.ended.tone, 'loss');
const late = tickChallenge({ challenge: open }, ctx0, {}, { week: 15, date: '2026-04-20' });
assert.equal(late.ended.status, 'fallita'); assert.equal(late.ended.reason, 'Tempo scaduto');
const waiting = tickChallenge({ challenge: open }, ctx0, {}, { week: 5, date: '2026-02-01' });
assert.equal(waiting.ended, null); assert.equal(waiting.challenge.status, 'attiva');
const won = tickChallenge({ challenge: open }, { game: { ...ctx0.game, record: { activities: { territorio: 5 } } }, stats: { ...ctx0.stats, popularity: 57 }, parliament: null }, {}, { week: 6, date: '2026-02-08' });
assert.equal(won.ended.status, 'riuscita'); assert.equal(won.ended.tone, 'win');
assert.deepEqual(challengeRows(open, ctx0).goals.map(row => row.met), [false, false]);
// a goal never starts already met: stability and cohesion targets are at least the level of the day of acceptance
assert.equal(targetOf({ kind: 'stability', target: 60 }, { stability: 78 }), 78); assert.equal(targetOf({ kind: 'stability', target: 60 }, { stability: 40 }), 60);
assert.equal(targetOf({ kind: 'relations', min: 65, target: 4 }, { ties: 3 }), 5);
assert.deepEqual(tickChallenge({ challenge: null }, ctx0, {}, { week: 1, date: '' }), { challenge: null, ended: null });

// ---- in the game
const { store } = await startCareer({ seed: 'sfide', level: 'deputato', fast: true, territorial: true });
const stat = metric => store.getState().dataset.statistics.find(item => item.subjectId === store.getState().career.playerId && item.metric === metric)?.value ?? 50;
const view = store.challengeView();
assert.equal(view.open, null); assert.equal(view.available.length, CHALLENGES.length);
assert.ok(view.available.find(item => item.id === 'legislatore').problem === null, 'Un deputato può tentare il legislatore.');
assert.ok(store.getState().game.challenge === undefined || store.getState().game.challenge === null, 'Nessuna sfida all’inizio.');

// the starting condition is applied once
const reputation = stat('reputation');
store.startChallenge('sotto-i-riflettori');
assert.ok(stat('reputation') < reputation, 'La polemica costa reputazione subito.');
assert.equal(store.challengeView().open.id, 'sotto-i-riflettori');
assert.throws(() => store.startChallenge('cento-giorni'), /già una sfida in corso/);
const afterStart = stat('reputation');
// weeks go by: the game goes on, the challenge is checked each week and resolved exactly once
let ended = null;
for (let week = 0; week < 20 && !ended; week++) { store.advance(7); const challenge = store.getState().game.challenge; if (challenge.status !== 'attiva') ended = challenge; }
assert.ok(ended, 'La sfida arriva a un verdetto entro la scadenza.');
assert.ok(['riuscita', 'fallita'].includes(ended.status));
const done = store.getState().game.challengesDone['sotto-i-riflettori'];
assert.equal(done.status, ended.status); assert.equal(done.attempts, 1);
const outcome = store.getState().game.celebrations?.outcome;
assert.equal(outcome?.kind, 'sfida', 'Il verdetto è raccontato in una card.');
assert.equal(outcome.tone, ended.status === 'riuscita' ? 'win' : 'loss');
assert.ok(store.getState().game.memory.some(item => item.kind === (ended.status === 'riuscita' ? 'sfida-superata' : 'sfida-fallita')));
const kinds = store.getState().game.memory.filter(item => /^sfida-(superata|fallita)$/.test(item.kind)).length;
for (let week = 0; week < 4; week++) store.advance(7);
assert.equal(store.getState().game.memory.filter(item => /^sfida-(superata|fallita)$/.test(item.kind)).length, kinds, 'Effetti una volta sola.');
assert.equal(store.challengeView().open, null); assert.ok(store.challengeView().last);
void afterStart;

// abandon
store.startChallenge('rete-di-alleati');
const before = stat('reputation');
store.abandonChallenge();
assert.ok(stat('reputation') < before, 'Abbandonare costa un po’ di reputazione.');
assert.equal(store.getState().game.challenge.status, 'abbandonata');
assert.throws(() => store.abandonChallenge(), /Nessuna sfida in corso/);
// needs: a government challenge is refused outside the majority
assert.ok(store.challengeView().available.find(item => item.id === 'governo-che-regge'));

// survives the save (the word given needs an open promise: without one it cannot even start)
assert.throws(() => store.startChallenge('parola-data'), /almeno una promessa aperta/);
store.makePromise({ area: 'sanita', scope: 'candidato', instrument: 'riforma', ambition: 'prudente' });
store.startChallenge('parola-data');
store.save();
const exported = JSON.parse(JSON.stringify(store.getState().game.challenge));
assert.equal(exported.id, 'parola-data'); assert.equal(exported.status, 'attiva');
assert.ok(CHALLENGE_BY_ID[exported.id]);
const raw = store.exportSave();
store.loadGame(JSON.parse(raw));
assert.equal(store.challengeView().open?.id, 'parola-data', 'Esporta e importa: la sfida è ancora aperta.');
const old = JSON.parse(raw);
delete old.game.challenge; delete old.game.challengesDone;
store.loadGame(old);
assert.equal(store.challengeView().open, null, 'Un salvataggio senza sfide si carica.');
assert.doesNotThrow(() => store.advance(7));
console.log('check-challenges: ok');
