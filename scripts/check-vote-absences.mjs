// Votes of the Chamber with realistic absences, abstentions and party discipline (vote-engine, parliament-engine, lawmaking-engine): who is away neither votes for nor against, the counts
// always add up to the members of the assembly, the majority is counted on who is in the hall, a question of confidence calls almost everybody, the majority mostly follows the line of its group
// but not always, the individual vote of every seat is one of favorevole / contrario / astenuto / assente (a secret ballot shows only the totals).
import assert from 'node:assert/strict';
import { absentOf, individualVotes, spreadAbsent, voteCatalog, voteSummary } from '../src/core/vote-engine.js';
import { startCareer, playWeek } from './lib/long-run.mjs';

// ---------- pure helpers ----------
{
  const ordinary = Array.from({ length: 400 }, (_, n) => absentOf({ members: 100, seed: `v${n}` }));
  const mean = ordinary.reduce((a, b) => a + b, 0) / ordinary.length;
  assert.ok(mean >= 5.5 && mean <= 9.5, `Un voto ordinario ha in media tra il 5,5% e il 9,5% di assenti (${mean.toFixed(1)}%): meno di prima, ma mai un’Aula piena.`);
  assert.ok(Math.max(...ordinary) <= 11 && Math.min(...ordinary) >= 4, 'Le assenze restano in una forbice credibile (4-11%).');
  const confidence = Array.from({ length: 400 }, (_, n) => absentOf({ members: 100, confidence: true, seed: `f${n}` }));
  assert.ok(Math.max(...confidence) <= 3, 'La fiducia chiama quasi tutti: al massimo il 3% di assenti.');
  assert.equal(absentOf({ members: 100, seed: 'x' }), absentOf({ members: 100, seed: 'x' }), 'Lo stesso voto ha le stesse assenze.');
  for (const [yes, no, abstain, gone] of [[60, 30, 10, 10], [1, 0, 0, 5], [0, 0, 0, 3], [7, 5, 3, 15], [33, 33, 34, 7]]) {
    const out = spreadAbsent({ yes, no, abstain }, gone);
    assert.equal(out.yes + out.no + out.abstain, Math.max(0, yes + no + abstain - Math.min(gone, yes + no + abstain)), `spreadAbsent(${yes},${no},${abstain},${gone}) conserva i conti.`);
    assert.ok(out.yes >= 0 && out.no >= 0 && out.abstain >= 0, 'Mai negativi.');
  }
}

// the abstentions: fewer than before, more when the vote is close, and still fewer on a question of confidence
{
  const { splitGroupVote } = await import('../src/core/vote-engine.js');
  const mean = (seats, yes, confidence) => { let abstain = 0; for (let n = 0; n < 400; n++) abstain += splitGroupVote({ seats, yes, confidence, seed: `a${n}|${seats}|${yes}` }).abstain; return abstain / 400 / (seats - yes); };
  const close = mean(100, 50, false), clear = mean(100, 90, false), conf = mean(100, 50, true);
  assert.ok(close < 0.26 && close > 0.12, `Voto in bilico: la quota di astenuti tra chi non vota sì è ${(close * 100).toFixed(0)}% (prima oltre il 30%).`);
  assert.ok(clear < close && conf < clear, 'Voto netto: meno astenuti che in bilico; fiducia: ancora meno.');
}

// ---------- a career in the real Chambers ----------
const { store, db, decide } = await startCareer({ seed: 'qa-assenze', level: 'deputato', fast: true });
for (let week = 0; week < 70 && store.getState().game?.status !== 'ended'; week++) playWeek({ store, db, decide });
const catalog = voteCatalog(store.getState().national?.parliament ?? store.getState().parliament);
const ordinary = catalog.filter(vote => !vote.confidence && vote.kind !== 'fiducia' && !vote.secret);
const confidence = catalog.filter(vote => vote.kind === 'fiducia');
assert.ok(ordinary.length >= 6, `Almeno sei votazioni ordinarie nella carriera di prova (${ordinary.length}).`);
let absentShare = 0, dissentShare = 0, governing = 0;
for (const vote of ordinary) {
  const summary = voteSummary(vote);
  assert.equal(summary.yes + summary.against + summary.abstain + summary.absent, summary.total, `${vote.id}: favorevoli, contrari, astenuti e assenti sommano ai seggi.`);
  assert.equal(summary.needed ?? vote.needed, Math.floor((summary.total - summary.absent) / 2) + 1, `${vote.id}: la maggioranza è contata su chi è presente.`);
  assert.equal(Boolean(vote.passed), summary.yes >= vote.needed, `${vote.id}: l’esito coincide con i voti.`);
  absentShare += summary.absent / summary.total;
  // the single seats: each one has a choice, the absent are as many as the total says
  const roster = summary.groups.flatMap(group => Array.from({ length: group.seats }, (_, n) => ({ groupId: group.groupId, person: { id: `${group.groupId}-${n}` } })));
  const individual = individualVotes(summary, roster);
  assert.ok(individual.choices.every(choice => ['favorevole', 'contrario', 'astenuto', 'assente'].includes(choice)), `${vote.id}: ogni seggio ha un voto o un’assenza.`);
  assert.equal(individual.choices.filter(choice => choice === 'assente').length, summary.absent, `${vote.id}: gli assenti dei seggi sono quelli del totale.`);
  for (const group of summary.groups.filter(item => item.governing && item.seats >= 20)) { governing++; dissentShare += group.dissent / Math.max(1, group.seats - group.absent); }
}
const meanAbsent = absentShare / ordinary.length;
assert.ok(meanAbsent >= 0.03 && meanAbsent <= 0.12, `Assenze medie dei voti ordinari: ${(meanAbsent * 100).toFixed(1)}% (tra il 3% e il 15%).`);
if (governing) { const dissent = dissentShare / governing; assert.ok(dissent < 0.3, `Le forze di maggioranza seguono in gran parte la linea (dissenso medio ${(dissent * 100).toFixed(1)}%).`); }
for (const vote of confidence) { const summary = voteSummary(vote); assert.equal(summary.yes + summary.against + summary.abstain + summary.absent, summary.total, `${vote.id}: la fiducia somma ai seggi.`); assert.ok(summary.absent / summary.total <= 0.04, `${vote.id}: la fiducia ha pochissimi assenti.`); }
// secret ballot: no individual votes
{
  const sample = voteSummary({ id: 's', chamber: 'camera', total: 10, yes: 6, secret: true, byGroup: [{ groupId: 'g', simulatedSeats: 10, yesVotes: 6, noVotes: 3, abstainVotes: 1 }] });
  const out = individualVotes(sample, Array.from({ length: 10 }, (_, n) => ({ groupId: 'g', person: { id: `p${n}` } })));
  assert.ok(out.choices.every(choice => choice === 'segreto'), 'Nel voto segreto non si conosce il voto dei singoli.');
}
console.log(`Votazioni con assenze realistiche verificate: ${ordinary.length} voti ordinari (assenze medie ${(meanAbsent * 100).toFixed(1)}%), ${confidence.length} fiducie con pochissimi assenti, conti sempre pari ai seggi, maggioranza sui presenti, voto segreto senza nomi.`);
