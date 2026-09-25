// Simulated polls are credible: they start from the last real poll, move gradually (tenths of a point a week for
// most forces, never beyond a size-dependent bound), stay normalized, and react to events in the direction that
// majority and opposition would expect. No random jumps of whole points.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const engine = await import(`../src/core/world-engine.js${build ? `?v=${build}` : ''}`);
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}`, import.meta.url), 'utf8'));
const [parties, movements, coalitions, polls] = await Promise.all(['parties.json', 'political-movements.json', 'coalitions.json', 'polls.json'].map(read));
const catalog = new Map([...parties, ...movements, ...coalitions].map(item => [item.id, item]));
const poll = polls.at(-1);
const governing = new Set(['party-registro-p1-2014-04-ir', 'party-registro-p1-2015-20-ir', 'party-registro-p1-2017-41-ir']);
const forces = poll.results.map(row => ({ id: row.entityId, label: row.label, share: row.share, position: catalog.get(row.entityId)?.politicalPosition ?? null, governing: governing.has(row.entityId) }));
const realPoll = { id: poll.id, label: poll.label, publishedAt: poll.publishedAt, sourceUrl: poll.sourceUrl, sourceName: poll.sourceName, results: forces.map(item => ({ partyId: item.id, share: item.share })) };
const cap = share => 0.25 + 0.035 * share;
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const step = (world, week, date) => engine.advanceWorld(world, { date, week, stats: { popularity: 45, reputation: 55, notoriety: 40 }, society: { mood: 50, moodDelta: 0, trust: 46, sentiment: 0 } }).world;
const pct = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] * 100) / 100; };

const swings = { big: [], mid: [], small: [] };
const drift = [];
for (let seed = 0; seed < 8; seed++) {
  let world = engine.createWorld({ seedText: `realismo-${seed}`, date: '2026-09-24', place: { region: 'Lazio' }, playerParty: seed % 2 ? { id: 'io', label: 'Il mio partito', position: 'centro', founder: true } : null, forces, realPoll });
  let date = '2026-09-24';
  for (let week = 2; week <= 104; week++) {
    date = addDays(date, 7);
    world = step(world, week, date);
    const current = world.polls.at(-1), previous = world.polls.at(-2);
    assert.ok(Math.abs(current.results.reduce((sum, row) => sum + row.share, 0) + current.others - 100) < 0.3, `Normalizzazione (settimana ${week}).`);
    for (const row of current.results) {
      const before = previous.results.find(item => item.partyId === row.partyId);
      if (!before) continue;
      const change = Math.abs(row.share - before.share);
      const bound = cap(before.share) * (previous.source === 'real' ? 0.6 : 1) + 0.051;
      assert.ok(change <= bound, `Salto non credibile: ${row.partyId} ${before.share} → ${row.share} (settimana ${week}).`);
      (before.share >= 10 ? swings.big : before.share >= 3 ? swings.mid : swings.small).push(change);
    }
  }
  for (const force of forces) { const row = world.polls.at(-1).results.find(item => item.partyId === force.id); if (row) drift.push(Math.abs(row.share - force.share)); }
}
assert.ok(pct(swings.big, 0.9) <= 0.9 && pct(swings.mid, 0.9) <= 0.6 && pct(swings.small, 0.9) <= 0.35, `Variazioni settimanali credibili (p90: grandi ${pct(swings.big, 0.9)}, medie ${pct(swings.mid, 0.9)}, piccole ${pct(swings.small, 0.9)}).`);
assert.ok(pct(drift, 0.5) <= 1.2, `Dopo due anni l’evoluzione resta graduale (mediana ${pct(drift, 0.5)} punti).`);

// The first simulated poll starts from the real one.
const world = engine.createWorld({ seedText: 'partenza', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position: 'centro-sinistra', founder: true }, forces, realPoll });
assert.ok(world.polls[0].source === 'real' && world.polls[0].results.filter(row => row.real).every(row => row.share === forces.find(item => item.id === row.partyId).share), 'Il primo sondaggio è il dato reale.');
const next = step(world, 2, '2026-10-01');
for (const force of forces) { const row = next.polls.at(-1).results.find(item => item.partyId === force.id); assert.ok(Math.abs(row.share - force.share) <= cap(force.share) * 0.6 + 0.051, `Partenza dal dato reale: ${force.label} ${force.share} → ${row.share}.`); }
assert.ok(world.playerStart.fromOthers > 0 && world.playerStart.fromOthers + world.playerStart.fromForces > 1, 'Il nuovo partito prende il consenso iniziale da “Altri” e dalle altre forze, dichiarato.');

// Events move majority and opposition in opposite directions, gradually.
let hit = engine.createWorld({ seedText: 'eventi', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: null, forces, realPoll });
let calm = structuredClone(hit);
hit.effects.push({ id: 'prova-governo', scope: 'national', strategy: 'governista', delta: -0.8, remaining: 6, total: 6, cause: 'prova', source: 'simulation' }, { id: 'prova-opposizione', scope: 'national', strategy: 'opposizione', delta: 0.8, remaining: 6, total: 6, cause: 'prova', source: 'simulation' });
let date = '2026-09-24';
for (let week = 2; week <= 5; week++) { date = addDays(date, 7); hit = step(hit, week, date); calm = step(calm, week, date); }
const sum = (target, strategy) => target.polls.at(-1).results.filter(row => target.parties.find(party => party.id === row.partyId)?.strategy === strategy).reduce((total, row) => total + row.share, 0);
assert.ok(sum(hit, 'governista') < sum(calm, 'governista') - 0.3 && sum(hit, 'opposizione') > sum(calm, 'opposizione') + 0.3, 'Un evento che pesa sul governo sposta consensi dalla maggioranza all’opposizione.');
console.log(`Sondaggi simulati credibili: partenza dal dato reale (primo sondaggio simulato entro il 60% della variazione massima), variazioni settimanali p90 ${pct(swings.big, 0.9)} (grandi) / ${pct(swings.mid, 0.9)} (medie) / ${pct(swings.small, 0.9)} (piccole) punti, mai oltre il limite legato alla dimensione, normalizzazione sempre a 100, deriva mediana di ${pct(drift, 0.5)} punti in due anni, eventi che spostano consenso tra maggioranza e opposizione.`);
