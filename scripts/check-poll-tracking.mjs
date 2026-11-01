// The polls follow the real growth of a campaign. The weekly cap of an institute (poll-observatory.js: weeklyCap) limits the NOISE of a reading, not the change of the electorate: before, a force whose support grew from
// 6% to 20% in a campaign was read at the pace of the cap (0.25 + 0.035·share points a poll, about 0.5 at 6% and 1 at 20%) and the polls stayed at 6–8% while the vote went to 19%. Corrected: the reading may move from the
// previous one by the real movement of the support since that reading (`shift`) plus the cap, so that nothing else changes (a force that does not move is read exactly as before).
//  A. the arithmetic of the reading: the old cap cannot follow a growth from 6% to 20% (it is shown), the corrected one does, for a gradual growth, a sudden one and a fall after a negative event; the noise, the house
//     effect of the institutes, the margins of error and the differences among the institutes are what they were (nothing is forced onto the truth: a still force reads exactly as before).
//  B. campaigns played on the engine, from a small force (6%) to a large one through the activities of the player (their effect is written by the activities themselves, never the consensus), in every kind of vote: the
//     published polls follow the growth within their margin, the first round and the runoff, with several seeds; the result of the vote follows the closing projection and the day of the vote is applied once.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const engine = await import(`../src/core/campaign-engine.js${v}`);
const elections = await import(`../src/core/election-engine.js${v}`);
const observatory = await import(`../src/core/poll-observatory.js${v}`);
const rules = await import(`../src/data/simulation/campaign-rules.js${v}`);
const { POLL_INSTITUTES } = await import(`../src/data/simulation/polling-rules.js${v}`);
const { makeDemoState } = await import(`../src/data/simulation/demo.js${v}`);
const lines = [];
const mean = list => list.reduce((a, b) => a + b, 0) / (list.length || 1);
const round2 = value => Math.round(value * 100) / 100;

// ============ A. the arithmetic of the reading ============
const institutes = POLL_INSTITUTES;
const SEED = 1234567;
// one race of the player's force and three rivals; the truth of the player follows `path` (one value for every wave), the rivals share the rest
const wavesOf = (path, { corrected }) => {
  const errors = Object.fromEntries(institutes.map(item => [item.id, {}])), last = {};
  let previousAverage = null, previousTruth = null;
  const out = [];
  path.forEach((value, index) => {
    const rest = 100 - value, truth = [{ partyId: 'io', share: value }, { partyId: 'a', share: rest * .5 }, { partyId: 'b', share: rest * .3 }, { partyId: 'c', share: rest * .2 }];
    const shift = corrected && previousTruth ? new Map(truth.map(row => [row.partyId, row.share - previousTruth.find(item => item.partyId === row.partyId).share])) : null;
    const readings = institutes.map(profile => {
      const o = observatory.readInstitute({ profile: { ...profile, sample: profile.sample.map(size => Math.round(size * .5 / 10) * 10) }, seed: SEED, week: index * 7, date: `2026-10-${String(1 + index).padStart(2, '0')}`, trueRows: truth, previousRows: last[profile.id] ?? null, errors: errors[profile.id], noise: 2.4, exact: true, shift });
      errors[profile.id] = o.errors; last[profile.id] = o.reading.rows;
      return o.reading;
    });
    const average = observatory.averageOf(readings, previousAverage, { total: 100, shift });
    previousAverage = average.rows; previousTruth = truth;
    out.push({ truth: value, poll: average.rows.find(row => row.partyId === 'io').share, margin: readings[0].margin, readings });
  });
  return out;
};
const gradual = Array.from({ length: 8 }, (_, i) => 6 + i * 2);                       // 6 → 20 in seven waves
const sudden = [6, 6.3, 6.1, 12.4, 12.8, 13.1, 19.8, 20];                             // a surge after an event, then another
const fall = [6, 9, 13, 17, 20, 15.5, 15, 14.8];                                       // a positive run and a negative event
// the old pace: after seven waves the cap alone allows at most the sum of the caps
const capPace = from => { let share = from; for (let i = 0; i < 7; i++) share += observatory.weeklyCap(share); return share; };
assert.ok(capPace(6) < 12, `Il vecchio limite settimanale permetterebbe al massimo ${capPace(6).toFixed(1)}% dopo sette sondaggi: non arriva al 20%.`);
for (const [name, path] of [['crescita graduale', gradual], ['crescita improvvisa', sudden], ['crescita e calo dopo un evento negativo', fall]]) {
  const before = wavesOf(path, { corrected: false }), after = wavesOf(path, { corrected: true });
  const gapBefore = Math.abs(before.at(-1).poll - before.at(-1).truth), gapAfter = Math.abs(after.at(-1).poll - after.at(-1).truth);
  if (name !== 'crescita e calo dopo un evento negativo') assert.ok(gapBefore > 4, `${name}: col vecchio limite i sondaggi restavano indietro di ${gapBefore.toFixed(1)} punti (${before.at(-1).poll} contro ${before.at(-1).truth}).`);
  for (const wave of after) assert.ok(Math.abs(wave.poll - wave.truth) <= 2 * wave.margin + 0.8, `${name}: con la correzione la media (${wave.poll}) segue il consenso reale (${wave.truth}) entro l’errore del campione (±${wave.margin}).`);
  assert.ok(gapAfter < gapBefore || gapBefore < 1.5, `${name}: la correzione riduce il ritardo (${gapAfter.toFixed(1)} contro ${gapBefore.toFixed(1)}).`);
  // the readings are not the truth: every institute has its own figure, its error and its house effect
  const spread = Math.max(...after.at(-1).readings.map(item => item.rows.find(row => row.partyId === 'io').share)) - Math.min(...after.at(-1).readings.map(item => item.rows.find(row => row.partyId === 'io').share));
  assert.ok(spread > 0.1, `${name}: gli istituti restano diversi tra loro (scarto ${round2(spread)}).`);
  assert.ok(after.some(wave => wave.poll !== wave.truth), `${name}: i sondaggi non coincidono con il consenso reale: restano una stima.`);
  lines.push(`${name}: media dei sondaggi a ${after.at(-1).poll}% su ${after.at(-1).truth}% reale (prima ${before.at(-1).poll}%)`);
}
// a force that does not move is read exactly as before (shift 0 = no shift): the same numbers, bit for bit
{
  const still = Array.from({ length: 8 }, () => 9);
  const old = wavesOf(still, { corrected: false }), neu = wavesOf(still, { corrected: true });
  assert.deepEqual(neu.map(wave => wave.poll), old.map(wave => wave.poll), 'Con il consenso fermo la media è identica a prima.');
  assert.deepEqual(neu.map(wave => wave.readings.map(item => item.rows.map(row => row.share))), old.map(wave => wave.readings.map(item => item.rows.map(row => row.share))), 'E lo sono le letture di ogni istituto.');
  // and a reading cannot invent a movement: a small true change moves the reading by that change plus noise within the cap
  const small = wavesOf([9, 9.4, 9.8, 10.2, 10.6, 11, 11.4, 11.8], { corrected: true });
  assert.ok(small.every((wave, index) => index === 0 || Math.abs(wave.poll - small[index - 1].poll) <= 0.4 + observatory.weeklyCap(wave.poll) + 0.3), 'Nessun salto fuori misura nelle letture.');
  lines.push('consenso fermo: letture identiche a prima, nessun salto inventato');
}

// ============ B. campaigns played on the engine ============
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
const base = makeDemoState();
const statistics = [...base.dataset.statistics.filter(item => item.subjectId !== base.dataset.politicians[0].id), ...[['notoriety', 30], ['influence', 40], ['reputation', 55], ['popularity', 50]].map(([metric, value]) => ({ subjectId: base.dataset.politicians[0].id, metric, value }))];
const player = { ...base.dataset.politicians[0], partyId: party.id, region: 'Lombardia', municipality: 'Milano' };
const make = (type, role, config, id) => engine.createCampaign({ career: { ...base.career, id, partyId: party.id }, player, statistics, partyCatalog: parties, currentDate: '2026-09-25', config: { electionType: type, role, objective: 'win', municipalityBand: 'oltre-15000', independents: 0, ...config } });
const playerGroup = c => elections.aggregateShares(c).find(group => group.id === c.playerCandidateId) ?? null;
// the starting condition of a small force: the support of the player's candidacy brought to about 6% of the vote (the others keep their proportions); from there only what the player does moves it
function smallForce(c, target = 6) {
  for (let i = 0; i < 6; i++) {
    const now = playerGroup(c)?.share ?? target, k = target / Math.max(0.5, now);
    if (Math.abs(now - target) < 0.15) break;
    for (const area of c.territories) { const total = Object.values(area.supportByCandidate).reduce((a, b) => a + b, 0), mine = area.supportByCandidate[c.playerCandidateId] ?? 0; const next = mine * k, rest = total - mine, scale = rest > 0 ? (total - next) / rest : 1; for (const id of Object.keys(area.supportByCandidate)) area.supportByCandidate[id] = id === c.playerCandidateId ? next : area.supportByCandidate[id] * scale; }
  }
  return c;
}
const STRONG = ['associations', 'territory_campaign', 'local_life', 'rally', 'public_event', 'door_to_door', 'local_visit', 'citizen_meeting', 'interview', 'social', 'territorial_media', 'debate'];
const KINDS = [
  { id: 'comunale', type: 'comunale', role: 'sindaco', config: { municipalityBand: 'oltre-15000' } },
  { id: 'provinciale', type: 'provinciale', role: 'presidente', config: {} },
  { id: 'regionale', type: 'regionale', role: 'presidente', config: {} },
  { id: 'politiche', type: 'politiche', role: 'deputato', config: {} },
  { id: 'europee', type: 'europee', role: 'eurodeputato', config: {} }
];
// activities that move the electorate strongly (a well funded, well staffed campaign): the effect of every activity is multiplied in this test so that the six weeks of a campaign can carry a small force to a large one
// through the activities themselves, as the engine applies them (support of the candidacy in the territories) — the consensus is never written.
const original = new Map(rules.CAMPAIGN_ACTIVITIES.map(item => [item.id, item.effect]));
const GROWTH = Number(process.env.POLL_GROWTH ?? 10);
for (const item of rules.CAMPAIGN_ACTIVITIES) item.effect = original.get(item.id) * GROWTH;
const SEEDS = Number(process.env.POLL_TRACK_SEEDS ?? 6);
const report = [];
for (const kind of KINDS) {
  const gaps = [], growths = [], finals = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    let c = make(kind.type, kind.role, kind.config, `track-${kind.id}-${seed}`);
    c.nomination.status = 'approved';
    smallForce(c, 6);
    const start = playerGroup(c)?.share ?? 0;
    assert.ok(start > 4 && start < 8.5, `${kind.id} #${seed}: la forza parte dal 6% (${start}).`);
    const samples = [];
    let guard = 0, used = 0;
    while (c.status === 'active' && guard++ < 120) {
      const me = c.candidates.find(item => item.isPlayer);
      if (me && me.status === 'active') {
        // a well provided campaign: the resources are what the player has raised (the activities cost them)
        Object.assign(me.resources, { money: 900000, volunteers: 120, organization: 95, politicalCapital: 99 });
        try { c = engine.performCampaignActivity(c, STRONG[used % STRONG.length], { territoryId: c.territories[used % c.territories.length].id }); used++; } catch { /* not possible today */ }
      }
      if (c.status !== 'active') break;
      c = engine.advanceCampaign(c, 1);
      const wave = c.pollObservatory?.waves?.at(-1);
      const group = c.status === 'active' ? playerGroup(c) : null;
      if (wave && group && samples.at(-1)?.day !== wave.day && wave.stage === 'campagna') samples.push({ day: wave.day, truth: group.share, territorial: engine.campaignMetrics(c).territorialConsensus.value, poll: wave.average.find(row => row[0] === c.playerCandidateId)?.[1] ?? null, margin: c.polls?.at(-1)?.margin ?? 3 });
    }
    assert.equal(c.status, 'finished', `${kind.id} #${seed}: la campagna finisce.`);
    const live = samples.filter(item => Number.isFinite(item.poll));
    const gain = (live.at(-1)?.truth ?? start) - start;
    growths.push(gain);
    // the consensus the player sees (territorial) and the figure the polls read (the group of the candidacy) are the same thing when the candidacy stands alone: at most a rounding apart; a coalition adds its allies
    if (kind.id === 'comunale') for (const item of live) assert.ok(Math.abs(item.territorial - item.truth) <= 0.6, `${kind.id} #${seed}: il consenso territoriale (${item.territorial}) e la quota letta dai sondaggi (${round2(item.truth)}) sono la stessa cosa.`);
    // from the third wave the poll is read against the truth of the SAME day: within the margin of error of the sample (the margin the poll publishes) plus the reading noise
    for (const item of live.slice(2)) gaps.push(Math.abs(item.poll - item.truth));
    // the day of the vote is applied once for every round, and the result follows the closing projection
    const rounds = (c.electionDays ?? []).map(day => day.round);
    assert.equal(new Set(rounds).size, rounds.length, `${kind.id} #${seed}: ogni turno applica una volta sola gli effetti del giorno del voto (${rounds.join(', ')}).`);
    const closing = live.at(-1)?.truth ?? null, result = c.firstRoundResult?.playerShare ?? c.result?.playerShare ?? null;
    if (closing !== null && result !== null && !c.result?.eliminatedInFirstRound) finals.push(Math.abs(result - closing));
    // the last published poll is not behind the truth by more than the margin plus the noise, and never above it by more
    const tail = live.at(-1);
    if (tail && gain > 5) assert.ok(Math.abs(tail.poll - tail.truth) <= 2.5 * tail.margin + 1, `${kind.id} #${seed}: dopo una crescita di ${gain.toFixed(1)} punti l’ultimo sondaggio (${tail.poll}) segue il consenso (${tail.truth}) entro ±${(2.5 * tail.margin + 1).toFixed(1)}.`);
  }
  const maxGrowth = Math.max(...growths);
  if (kind.id === 'comunale') assert.ok(maxGrowth > 4, `${kind.id}: le attività del giocatore portano davvero la forza oltre il 6% (crescita massima ${maxGrowth.toFixed(1)} punti).`);
  assert.ok(mean(gaps) <= 2.4, `${kind.id}: scarto medio tra sondaggio e consenso reale ${mean(gaps).toFixed(2)} punti.`);
  report.push(`${kind.id}: crescita media ${mean(growths).toFixed(1)} punti (max ${maxGrowth.toFixed(1)}), scarto medio sondaggio-consenso ${mean(gaps).toFixed(2)}, scarto risultato-proiezione finale ${finals.length ? mean(finals).toFixed(2) : 'n.d.'}`);
}
for (const item of rules.CAMPAIGN_ACTIVITIES) item.effect = original.get(item.id);
lines.push(`campagne sul motore (${SEEDS} simulazioni per voto, crescita delle attività ×${GROWTH}): ${report.join('; ')}`);
console.log(`Sondaggi e crescita reale: ${lines.join(' | ')}`);
process.exit(0);
