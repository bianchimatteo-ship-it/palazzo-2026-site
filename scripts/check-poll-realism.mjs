// Simulated polls are credible: they start from the last real poll, move gradually (tenths of a point a week for
// most forces, never beyond a size-dependent bound), stay normalized, and react to events in the direction that
// majority and opposition would expect. No random jumps of whole points. And they are neutral: house effects cancel
// out for every force, and over long runs with many seeds no force gains or loses for its size, camp or role; the
// player's party moves only with the player's actions and standing.
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
// A force with no consensus yet does not start at 1–3%: a party the player founds starts between 0 and 0,1%, a real one the opening poll does not measure
// between 0,1 and 0,8%, both deterministic (the same career starts the same way); the points it takes come from “Altri” first, never from the real forces' figures.
const mine = world.parties.find(party => party.isPlayer);
assert.ok(mine.baseline >= 0 && mine.baseline <= 0.1, `Un partito nuovo parte tra 0 e 0,1% (${mine.baseline}).`);
assert.ok(world.playerStart && world.playerStart.fromOthers >= 0 && world.playerStart.fromOthers + world.playerStart.fromForces <= 0.11, 'Il consenso iniziale è dichiarato e minimo.');
const again = engine.createWorld({ seedText: 'partenza', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position: 'centro-sinistra', founder: true }, forces, realPoll });
assert.equal(again.parties.find(party => party.isPlayer).baseline, mine.baseline, 'Stessa carriera, stessa partenza.');
const realLatent = [{ id: 'real-latent', label: 'Forza reale fuori dal sondaggio', abbreviation: 'FRF', position: 'centro', weight: 1.2, refSource: 'real' }];
const outside = engine.createWorld({ seedText: 'partenza', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'real-latent', label: 'Forza reale fuori dal sondaggio', position: 'centro', refSource: 'real' }, forces, realPoll, latent: realLatent });
const outsideBase = outside.parties.find(party => party.isPlayer).baseline;
assert.ok(outsideBase >= 0.1 && outsideBase <= 0.8, `Una forza reale fuori dal sondaggio iniziale parte tra 0,1 e 0,8% (${outsideBase}).`);
assert.equal(engine.createWorld({ seedText: 'altro', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'real-latent', label: 'Forza reale fuori dal sondaggio', position: 'centro', refSource: 'real' }, forces, realPoll, latent: realLatent }).parties.find(party => party.isPlayer).baseline, outsideBase, 'Il consenso di una forza reale fuori dal sondaggio dipende solo da ciò che si sa di lei.');
assert.ok(engine.initialConsensus({ id: 'x', kind: 'real', weight: 0 }) >= 0.1 && engine.initialConsensus({ id: 'x', kind: 'real', weight: 9 }) <= 0.8 && engine.initialConsensus({ id: 'x', kind: 'new' }) <= 0.1, 'Intervalli della partenza.');

// Events move majority and opposition in opposite directions, gradually.
let hit = engine.createWorld({ seedText: 'eventi', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: null, forces, realPoll });
let calm = structuredClone(hit);
hit.effects.push({ id: 'prova-governo', scope: 'national', strategy: 'governista', delta: -0.8, remaining: 6, total: 6, cause: 'prova', source: 'simulation' }, { id: 'prova-opposizione', scope: 'national', strategy: 'opposizione', delta: 0.8, remaining: 6, total: 6, cause: 'prova', source: 'simulation' });
let date = '2026-09-24';
for (let week = 2; week <= 5; week++) { date = addDays(date, 7); hit = step(hit, week, date); calm = step(calm, week, date); }
const sum = (target, strategy) => target.polls.at(-1).results.filter(row => target.parties.find(party => party.id === row.partyId)?.strategy === strategy).reduce((total, row) => total + row.share, 0);
assert.ok(sum(hit, 'governista') < sum(calm, 'governista') - 0.3 && sum(hit, 'opposizione') > sum(calm, 'opposizione') + 0.3, 'Un evento che pesa sul governo sposta consensi dalla maggioranza all’opposizione.');
// ---------- neutrality: no force is favoured by the machinery of the polls ----------
// House effects: small, and zero on average for every force (the institutes lean a little, never the same way).
const { POLL_INSTITUTES } = await import(`../src/data/simulation/polling-rules.js${build ? `?v=${build}` : ''}`);
let houseMax = 0;
for (const id of [...forces.map(force => force.id), 'io', 'forza-di-prova']) for (const share of [1, 5, 25]) {
  const leans = POLL_INSTITUTES.map(institute => engine.houseEffect(institute.id, id, share));
  houseMax = Math.max(houseMax, ...leans.map(Math.abs));
  assert.ok(Math.abs(leans.reduce((sum, value) => sum + value, 0) / leans.length) < 1e-9, `House effect medio nullo per ${id}.`);
}
assert.ok(houseMax <= 0.3, `House effect piccoli (massimo ${houseMax.toFixed(2)} punti).`);
// Ten years with a neutral country (government at mid stability, mood 50, trust 48): every force keeps its level on
// average, whatever its size, camp or role. Merges and splits are accounted for (what a force inherits or gives up).
// The player's party does not move without the player's actions and standing.
const neutral = { parliament: () => ({ government: { status: 'active', stability: 50, coalitionGroupIds: [], supportingGroupIds: [] }, player: null, history: [] }), society: { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 } };
const own = new Map(forces.map(force => [force.id, []]));
const shares = new Map(forces.map(force => [force.id, []]));
let playerMoved = 0, playerEffects = 0;
for (let seed = 0; seed < 16; seed++) {
  let world = engine.createWorld({ seedText: `neutralita-${seed}`, date: '2026-09-24', place: { region: seed % 2 ? 'Lombardia' : 'Campania' }, playerParty: { id: 'io', label: 'Il mio partito', position: ['centro', 'sinistra', 'destra', 'centro-destra'][seed % 4], founder: true }, forces, realPoll });
  const start = new Map(world.parties.map(party => [party.id, party.baseline]));
  const firstPoll = new Map(world.polls.at(-1).results.map(row => [row.partyId, row.share]));
  const player = world.parties.find(party => party.isPlayer).baseline;
  const inherited = new Map(), seen = new Set(world.parties.map(party => party.id)), merged = new Set();
  let date = '2026-09-24';
  for (let week = 2; week <= 520; week++) {
    date = addDays(date, 7);
    world = engine.advanceWorld(world, { date, week, stats: { popularity: 45, reputation: 55, notoriety: 40 }, parliament: neutral.parliament(), society: neutral.society }).world;
    playerEffects += world.effects.filter(effect => effect.partyId === 'io').length;
    for (const party of world.parties) {
      // A split takes part of the parent's level for good (60%), a merge brings part of the absorbed force's (60%).
      if (!seen.has(party.id)) { seen.add(party.id); if (party.parentId) inherited.set(party.parentId, (inherited.get(party.parentId) ?? 0) - party.baseline * 0.6); }
      if (!party.active && party.mergedInto && !merged.has(party.id)) { merged.add(party.id); inherited.set(party.mergedInto, (inherited.get(party.mergedInto) ?? 0) + (party.anchor ?? party.baseline) * 0.6); }
    }
  }
  playerMoved = Math.max(playerMoved, Math.abs(world.parties.find(party => party.isPlayer).baseline - player));
  for (const force of forces) {
    const party = world.parties.find(item => item.id === force.id);
    if (!party?.active) continue;
    own.get(force.id).push((party.baseline - start.get(force.id) - (inherited.get(force.id) ?? 0)) / start.get(force.id));
    const share = world.polls.at(-1).results.find(row => row.partyId === force.id)?.share;
    if (Number.isFinite(share) && !inherited.get(force.id)) shares.get(force.id).push((share - firstPoll.get(force.id)) / firstPoll.get(force.id));
  }
}
const avg = values => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
const dev = values => Math.sqrt(avg(values.map(value => (value - avg(values)) ** 2)));
const trends = [];
for (const force of forces) {
  const values = own.get(force.id);
  if (values.length < 6) continue;
  const t = avg(values) / ((dev(values) || 1e-9) / Math.sqrt(values.length));
  trends.push(`${force.label} ${(avg(values) * 100).toFixed(1)}%`);
  assert.ok(Math.abs(t) <= 3 || Math.abs(avg(values)) <= 0.03, `${force.label}: tendenza sistematica in dieci anni (${(avg(values) * 100).toFixed(1)}% in media, t ${t.toFixed(1)}).`);
}
const byRole = flag => avg(forces.filter(force => force.governing === flag).flatMap(force => shares.get(force.id)));
assert.ok(Math.abs(byRole(true) - byRole(false)) <= 0.03, `Governo e opposizione senza vantaggi strutturali (${(byRole(true) * 100).toFixed(1)}% contro ${(byRole(false) * 100).toFixed(1)}%).`);
const bySize = (min, max) => avg(forces.filter(force => force.share >= min && force.share < max).flatMap(force => own.get(force.id)));
assert.ok([bySize(10, 100), bySize(4, 10), bySize(0, 4)].every(value => Math.abs(value) <= 0.05), `Nessun vantaggio per dimensione (grandi ${(bySize(10, 100) * 100).toFixed(1)}%, medie ${(bySize(4, 10) * 100).toFixed(1)}%, piccole ${(bySize(0, 4) * 100).toFixed(1)}%).`);
assert.ok(playerMoved < 0.01 && playerEffects === 0, `Il partito del giocatore si muove solo con le sue azioni (spostamento ${playerMoved}, effetti esterni ${playerEffects}).`);

console.log(`Sondaggi simulati credibili: partenza dal dato reale (primo sondaggio simulato entro il 60% della variazione massima), variazioni settimanali p90 ${pct(swings.big, 0.9)} (grandi) / ${pct(swings.mid, 0.9)} (medie) / ${pct(swings.small, 0.9)} (piccole) punti, mai oltre il limite legato alla dimensione, normalizzazione sempre a 100, deriva mediana di ${pct(drift, 0.5)} punti in due anni, eventi che spostano consenso tra maggioranza e opposizione. Neutralità: house effect medi nulli (massimo ${houseMax.toFixed(2)} punti); in dieci anni con un Paese neutro nessuna tendenza sistematica per forza (${trends.join(', ')}), per ruolo (governo ${(byRole(true) * 100).toFixed(1)}%, altri ${(byRole(false) * 100).toFixed(1)}%) o dimensione; il partito del giocatore si muove solo con le sue azioni.`);
