// A fuzz of the decisions: for each level of start the player answers every urgent matter and every situation with a RANDOM choice (seeded) for two years of weeks, casts a random ballot when one is open,
// and the game must never throw: no week stopped by an error (the kind of crash a stale question about a party the player has left used to cause), the invariants stay clean.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { openVotesOf } from '../src/core/lawmaking-engine.js';

const rng = seed => { let x = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
let weeks = 0, answered = 0;
for (const level of ['comunale', 'regionale', 'deputato']) for (const seed of ['a', 'b']) {
  const random = rng(`${level}${seed}`);
  const { store } = await startCareer({ seed: `fuzz-${level}-${seed}`, level, fast: true });
  store.setHeadlessVoter(null);
  for (let w = 0; w < 100 && store.getState().game.status !== 'ended'; w++) {
    for (const item of store.getState().game.inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))) {
      const choices = item.choices ?? [];
      for (const choice of [...choices].sort(() => random() - 0.5)) { try { store.resolveAgendaItem(item.id, choice.id); answered++; break; } catch (error) { if (/Non c’è|non è più|scelta/.test(error.message)) continue; /* refused for a reason: next */ } }
    }
    for (const vote of openVotesOf(store.getState())) { try { store.castOpenVote(vote.id, ['favorevole', 'contrario', 'astenuto'][Math.floor(random() * 3)]); } catch { /* closed */ } }
    try { const report = store.advanceTurn(1, { delegate: true }); weeks += report.weeks; }
    catch (error) { assert.fail(`${level}/${seed} settimana ${w}: la settimana si è fermata con un errore: ${error.message}\n${error.stack?.split('\n').slice(1, 4).join('\n')}`); }
  }
  const { checkInvariants } = await import('../src/core/invariants.js');
  const result = checkInvariants(store.getState());
  assert.deepEqual(result?.issues ?? [], [], `${level}/${seed}: invarianti dopo le scelte casuali.`);
}
console.log(`Scelte casuali verificate: 6 carriere (comunale, regionale, deputato) per cento settimane, ${answered} decisioni prese a caso e ${weeks} settimane giocate, nessuna settimana interrotta da un errore, invarianti pulite.`);
