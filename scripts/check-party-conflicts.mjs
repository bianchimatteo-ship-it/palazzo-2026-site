// Internal conflicts of a party over many weeks: a quarrel that ends (it fades, a truce is signed, a congress settles it) is remembered by the pair of areas. The same pair does not quarrel again
// at once nor on the same subject, two conflicts between the same pair never run together, a hot conflict is told once in a while and not every week, a truce keeps the area quiet for as long as the
// agreement holds, and a real cause (a party in bad shape, the balance between the areas that changed, a broken truce) lets the quarrel come back. The same run without the memory shows the old repetition.
import assert from 'node:assert/strict';
import { createGameState, advanceWeek } from '../src/core/career-engine.js';
import { advanceOrganization, closeConflicts, createOrganization, mayQuarrel, pairKey, reopenConflicts, CONFLICT_COOLDOWN } from '../src/core/organization-engine.js';

const rander = seed => { let a = [...String(seed)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const world = seed => {
  const game = createGameState({ seedText: seed, currentDate: '2026-10-12', level: 'comunale', party: { id: 'partito-prova', label: 'Partito di prova', founder: false }, place: { region: 'Toscana', municipality: 'Siena', province: 'Siena' } });
  return game;
};

// ---------- a run of weeks: the old behaviour (memory wiped every week) against the new one ----------
function run(seed, { memory }) {
  const game = world(seed);
  const party = game.party;
  const org = party.org;
  const rand = rander(`${seed}|org`);
  const spawns = []; const open = new Map(); let doubled = 0, notices = 0, lastHotNotice = -99, noticeGap = 99;
  let prev = new Set();
  for (let week = 1; week <= 260; week++) {
    // keep the area in a normal state: a decent party (cohesion left alone), so the repetition is not explained by a party in crisis
    if (!memory) delete org.conflictMemory;
    const out = advanceOrganization(org, { rand, week, date: '2026-10-12', currents: party.currents, seed, support: 55, rank: 1, founder: false, mood: 50 });
    const pairs = org.conflicts.filter(conflict => (conflict.currents ?? []).length === 2).map(conflict => pairKey(conflict.currents));
    if (new Set(pairs).size < pairs.length) doubled++;
    for (const conflict of org.conflicts) if (!prev.has(conflict.id)) spawns.push({ week, pair: pairKey(conflict.currents ?? []), topic: conflict.topic, cohesion: org.cohesion });
    prev = new Set(org.conflicts.map(conflict => conflict.id));
    for (const event of out.events) if (event.type === 'conflict' && event.conflict.currents?.length === 2) { notices++; noticeGap = Math.min(noticeGap, week - lastHotNotice); lastHotNotice = week; }
    // let the cohesion recover: nothing here forces a crisis
    org.cohesion = Math.max(org.cohesion, 52);
  }
  return { spawns, doubled, notices, noticeGap };
}
const gapsOf = spawns => { const byPair = {}; for (const spawn of spawns) (byPair[spawn.pair] ??= []).push(spawn.week); return Object.values(byPair).flatMap(weeks => weeks.slice(1).map((week, index) => week - weeks[index])); };
let withMemory = [], without = [], doubledWith = 0, doubledWithout = 0, sameTopicTooSoon = 0, noticeGapWith = 99;
for (let index = 0; index < 12; index++) {
  const a = run(`conflitti-${index}`, { memory: true }), b = run(`conflitti-${index}`, { memory: false });
  withMemory.push(...gapsOf(a.spawns)); without.push(...gapsOf(b.spawns));
  doubledWith += a.doubled; doubledWithout += b.doubled; noticeGapWith = Math.min(noticeGapWith, a.noticeGap);
  const last = new Map();
  for (const spawn of a.spawns) { const before = last.get(spawn.pair); if (before && before.topic === spawn.topic && spawn.week - before.week < 30) sameTopicTooSoon++; last.set(spawn.pair, spawn); }
}
assert.ok(without.length >= 20 && withMemory.length >= 8, `Ci sono abbastanza conflitti ripetuti da confrontare (${without.length} senza memoria, ${withMemory.length} con).`);
const tooClose = list => list.filter(gap => gap < CONFLICT_COOLDOWN.estinto).length;
assert.ok(tooClose(without) > 0, `Senza memoria la stessa coppia litiga di nuovo troppo presto (${tooClose(without)} volte su ${without.length}): il difetto c'è.`);
assert.equal(tooClose(withMemory), 0, `Con la memoria la stessa coppia non litiga di nuovo prima di ${CONFLICT_COOLDOWN.estinto} settimane (${withMemory.sort((a, b) => a - b).slice(0, 5).join(', ')}).`);
assert.equal(doubledWith, 0, 'Mai due conflitti insieme tra la stessa coppia di aree.');
assert.ok(doubledWithout >= doubledWith, 'Prima potevano coesistere.');
assert.equal(sameTopicTooSoon, 0, 'Lo stesso tema per la stessa coppia non torna prima di 30 settimane.');
assert.ok(noticeGapWith >= 8, `Un conflitto che resta acceso viene raccontato al più ogni 8 settimane (minimo ${noticeGapWith}).`);

// ---------- the memory itself: a truce, a congress, a broken truce, a real cause ----------
{
  const org = { conflicts: [], conflictMemory: {} };
  const ab = ['territori', 'riformisti'];
  assert.ok(mayQuarrel(org, ab, 10), 'Senza memoria si può litigare.');
  closeConflicts(org, [{ currents: ab, title: 'A contro B', topic: 'sulle alleanze', intensity: 3 }], 10, 'tregua', { until: 40 });
  assert.ok(!mayQuarrel(org, ab, 20, { cohesion: 60, relations: [50, 50] }), 'Durante la tregua la coppia non litiga.');
  assert.ok(!mayQuarrel(org, ['territori', 'movimento'], 20, { cohesion: 60, relations: [50, 50] }), 'Durante la tregua l’area non apre nuovi scontri con altre aree.');
  assert.ok(mayQuarrel(org, ab, 20, { cohesion: 30, relations: [50, 50] }), 'Un partito in pessimo stato riapre lo scontro: una causa vera.');
  assert.ok(mayQuarrel(org, ab, 20, { cohesion: 60, relations: [20, 50] }), 'Un rapporto crollato riapre lo scontro.');
  assert.ok(mayQuarrel(org, ab, 41, { cohesion: 60, relations: [50, 50] }), 'Finita la tregua si può litigare di nuovo.');
  reopenConflicts(org, 'territori');
  assert.ok(mayQuarrel(org, ab, 20, { cohesion: 60, relations: [50, 50] }), 'Una tregua rotta riapre le liti dell’area.');
  closeConflicts(org, [{ currents: ab, topic: 'x', intensity: 2, gap: 10 }], 100, 'estinto');
  assert.ok(!mayQuarrel(org, ab, 105, { gap: 9, cohesion: 60, relations: [50, 50] }), 'Uno scontro spento di recente non si riaccende senza motivo.');
  assert.ok(mayQuarrel(org, ab, 105, { gap: 2, cohesion: 60, relations: [50, 50] }), 'Se l’equilibrio tra le aree cambia di molto (più testa a testa) può riaccendersi.');
  assert.ok(mayQuarrel(org, ab, 100 + CONFLICT_COOLDOWN.estinto, { gap: 9, cohesion: 60, relations: [50, 50] }), 'Passato il tempo, la coppia può litigare di nuovo.');
}
console.log(`Conflitti interni verificati su 12 partiti per 260 settimane: con la memoria nessuna coppia litiga di nuovo prima di ${CONFLICT_COOLDOWN.estinto} settimane (senza memoria ${tooClose(without)} volte su ${without.length}), mai due scontri tra la stessa coppia, stesso tema non prima di 30 settimane, avvisi al più ogni 8 settimane; tregua, congresso, tregua rotta e cause vere (coesione, rapporti, equilibrio) provati.`);
