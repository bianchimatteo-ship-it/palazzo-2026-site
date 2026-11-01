// Gameplay of the campaigns with the ORIGINAL effects of the activities (no multiplier): five kinds of vote x four ways of campaigning x several seeds, the same seed (same rivals, same field) for the four ways so
// that the difference between them is the player's doing. Measured on the engine, as the game plays it, not on the screens. What is checked:
//   A. every activity, alone: what it really moves is what the interface announces (expectedGain), applied once (the "gained" counter of the campaign grows by the same amount as the share), with its weight in the order
//      expected between kinds of vote; none is worth a landslide, none that should move votes moves none, and the repetition of an activity pays less every time but never stops paying.
//   B. the four ways: idle < weak < strategic ≲ intense (on average), a campaign worth a few points and never a landslide, the idle drift contained, in each of the five kinds.
//   C. the runoff: the polls follow the head-to-head of the two candidates, a move of the player is counted once, and the shift of the polls is not applied twice.
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


const KINDS = [
  { id: 'comunale', type: 'comunale', role: 'sindaco', config: { municipalityBand: 'oltre-15000' } },
  { id: 'provinciale', type: 'provinciale', role: 'presidente', config: {} },
  { id: 'regionale', type: 'regionale', role: 'presidente', config: {} },
  { id: 'politiche', type: 'politiche', role: 'deputato', config: {} },
  { id: 'europee', type: 'europee', role: 'eurodeputato', config: {} }
];
const m = list => list.reduce((a, b) => a + b, 0) / (list.length || 1);
const topUp = c => { const me = c.candidates.find(item => item.isPlayer); Object.assign(me.resources, { money: 900000, politicalCapital: 99 }); return c; };

// ============ A. every activity alone ============
const FIELD = ['citizen_meeting', 'door_to_door', 'local_visit', 'territory_campaign', 'local_life', 'associations', 'public_event', 'rally', 'leader_visit', 'territorial_pact'];
const MEDIA = ['interview', 'press_conference', 'social', 'territorial_media'];
const BROAD = ['national_media', 'issue_focus', 'posters', 'local_ads', 'social_ads'];
const NO_VOTES = ['party_meeting', 'list_building', 'volunteer_training', 'fundraising', 'fundraising_dinner', 'debate_prep', 'crew_rest', 'scouting', 'list_negotiation'];
const REPORT = [];
for (const kind of KINDS) {
  const mean = {};
  for (const activity of rules.CAMPAIGN_ACTIVITIES) {
    const moved = [], announced = [];
    for (let seed = 1; seed <= 8; seed++) {
      let c = make(kind.type, kind.role, kind.config, `act-${kind.id}-${seed}`); c.nomination.status = 'approved';
      c = engine.advanceCampaign(c, 3); topUp(c);
      if (!engine.activityAvailability(c, activity).ok || ['ally_meeting', 'endorsement', 'debate'].includes(activity.id)) break;
      const before = playerGroup(c).share, gainedBefore = c.gained ?? 0;
      const expected = engine.expectedGain(c, activity, engine.activityModifiers(c, activity, { territoryId: c.territories[0].id }));
      try { c = engine.performCampaignActivity(c, activity.id, { territoryId: c.territories[0].id }); } catch { break; }
      const delta = playerGroup(c).share - before;
      // applied once: the counter of the campaign grows as much as the share (a double increment would show here)
      assert.ok(Math.abs(((c.gained ?? 0) - gainedBefore) - delta) <= 0.02, `${kind.id}/${activity.id}: l’effetto è contato una volta sola (quota ${delta.toFixed(3)}, contatore ${((c.gained ?? 0) - gainedBefore).toFixed(3)}).`);
      moved.push(delta); announced.push(expected);
    }
    if (!moved.length) continue;
    mean[activity.id] = m(moved);
    if (NO_VOTES.includes(activity.id)) assert.ok(Math.abs(m(moved)) < 0.005, `${kind.id}/${activity.id}: non sposta voti (${m(moved).toFixed(3)}).`);
    else {
      // what the interface announces is what happens (on average), within a tenth of a point or a quarter of the value
      if (activity.id === 'territorial_pact') assert.ok(m(moved) <= 1.5 * m(announced) + 0.03, `${kind.id}/${activity.id}: l’accordo, quando riesce, vale al più quanto annunciato.`);
      else assert.ok(Math.abs(m(moved) - m(announced)) <= Math.max(0.03, 0.25 * m(announced)), `${kind.id}/${activity.id}: atteso ${m(announced).toFixed(3)} e reale ${m(moved).toFixed(3)} coincidono.`);
      assert.ok((activity.id === 'territorial_pact' || m(moved) > 0) && Math.max(...moved) < 1.5, `${kind.id}/${activity.id}: un’attività che sposta voti li sposta (${m(moved).toFixed(3)}) e nessuna vale una valanga (max ${Math.max(...moved).toFixed(2)}).`);
    }
  }
  // the weight between the families: the comparison with a rival is among the best ones but not 10 times a field activity; in the vote where the field is local (regional, general) the national means weigh more
  const field = m(FIELD.filter(id => mean[id] !== undefined).map(id => mean[id])), broad = m(BROAD.filter(id => mean[id] !== undefined).map(id => mean[id]));
  if (mean.comparison !== undefined) assert.ok(mean.comparison <= 6 * Math.max(field, 0.02) + 0.3 && mean.comparison <= 0.45, `${kind.id}: il confronto con un rivale (${mean.comparison.toFixed(2)}) non domina (attività sul territorio ${field.toFixed(2)}).`);
  REPORT.push(`${kind.id}: territorio ${field.toFixed(2)}, mezzi larghi ${broad.toFixed(2)}, confronto ${mean.comparison?.toFixed(2) ?? 'n.d.'} punti per attività`);
}
lines.push(`ogni attività da sola (effetti originali, 8 simulazioni per tipo di voto): ${REPORT.join('; ')}`);

// repetition: the same activity again and again pays less each time, never nothing, never a landslide
{
  const first = [], last = [], total = [];
  for (const [kind, id] of [['comunale', 'citizen_meeting'], ['regionale', 'local_visit'], ['politiche', 'comparison'], ['europee', 'social_ads']]) {
    const k = KINDS.find(item => item.id === kind);
    let c = make(k.type, k.role, k.config, `rep-${kind}`); c.nomination.status = 'approved'; c = engine.advanceCampaign(c, 3);
    const start = playerGroup(c).share, steps = [];
    for (let i = 0; i < 12; i++) {
      topUp(c);
      const before = playerGroup(c).share;
      try { c = engine.performCampaignActivity(c, id, { territoryId: c.territories[0].id }); } catch { break; }
      steps.push(playerGroup(c).share - before);
    }
    assert.ok(steps.length >= 6, `${kind}/${id}: abbastanza ripetizioni possibili (${steps.length}).`);
    assert.ok(steps.at(-1) < steps[0] && steps.at(-1) > 0, `${kind}/${id}: la ripetizione rende di meno (${steps[0].toFixed(3)} → ${steps.at(-1).toFixed(3)}) ma non zero.`);
    assert.ok(playerGroup(c).share - start < 6, `${kind}/${id}: ripeterla non porta una valanga (${(playerGroup(c).share - start).toFixed(2)} punti).`);
    first.push(steps[0]); last.push(steps.at(-1)); total.push(playerGroup(c).share - start);
  }
  lines.push(`ripetizione: primo uso ${first.map(x => x.toFixed(2)).join('/')}, ultimo ${last.map(x => x.toFixed(2)).join('/')}, totale ${total.map(x => x.toFixed(2)).join('/')} punti`);
}

// ============ B. four ways of campaigning, five kinds of vote ============
const WEAK = ['local_life', 'social'];
const STRATEGIC = ['territorial_pact', 'endorsement', 'territory_campaign', 'door_to_door', 'issue_focus', 'territorial_media', 'social_ads', 'associations', 'local_visit', 'citizen_meeting'];
const INTENSE = ['territory_campaign', 'rally', 'door_to_door', 'public_event', 'local_ads', 'posters', 'social_ads', 'national_media', 'press_conference', 'interview', 'territorial_pact', 'endorsement', 'associations', 'social', 'local_visit', 'citizen_meeting', 'local_life'];
const WAYS = { idle: () => [], weak: day => day % 7 === 0 ? WEAK : [], strategic: day => day % 2 === 0 ? STRATEGIC : [], intense: () => INTENSE };
const SEEDS = Number(process.env.GAMEPLAY_SEEDS ?? 8);
const SUMMARY = [];
const durations = {};
for (const kind of KINDS) {
  const gains = Object.fromEntries(Object.keys(WAYS).map(way => [way, []])), acts = Object.fromEntries(Object.keys(WAYS).map(way => [way, []]));
  const polls = [];
  for (const [way, pick] of Object.entries(WAYS)) for (let seed = 1; seed <= SEEDS; seed++) {
    let c = make(kind.type, kind.role, kind.config, `gp-${kind.id}-${seed}`);
    c.nomination.status = 'approved';
    durations[kind.id] = c.totalDays;
    const start = playerGroup(c).share;
    let day = 0, done = 0, rot = 0, last = start;
    while (c.status === 'active' && day < 200) {
      if (c.candidates.find(item => item.isPlayer)?.status === 'active') {
        for (const id of pick(day)) {
          if (c.status !== 'active') break;
          try { c = engine.performCampaignActivity(c, id, { territoryId: c.territories[rot++ % c.territories.length].id }); done++; if (way !== 'intense') break; } catch { /* not possible today (resources, days, availability) */ }
        }
      }
      if (c.status !== 'active') break;
      c = engine.advanceCampaign(c, 1); day++;
      const group = c.status === 'active' ? playerGroup(c) : null;
      if (group) last = group.share;
      const wave = c.pollObservatory?.waves?.at(-1);
      if (group && wave && wave.stage === 'campagna' && wave.day === c.day) { const value = wave.average.find(row => row[0] === c.playerCandidateId)?.[1]; if (Number.isFinite(value)) polls.push(value - group.share); }
    }
    gains[way].push(last - start); acts[way].push(done);
  }
  const g = Object.fromEntries(Object.entries(gains).map(([way, list]) => [way, m(list)]));
  // the order: doing something pays, doing more pays more (within a tenth of a point of noise: intense has fatigue and risk, and the resources are finite)
  assert.ok(g.weak >= g.idle - 0.05, `${kind.id}: poche attività non fanno peggio di nessuna (${g.weak.toFixed(2)} contro ${g.idle.toFixed(2)}).`);
  assert.ok(g.strategic > g.idle + 0.25, `${kind.id}: una campagna strategica vale più dell’inattività di almeno un quarto di punto (${g.strategic.toFixed(2)} contro ${g.idle.toFixed(2)}).`);
  assert.ok(Math.max(g.strategic, g.intense) >= g.weak, `${kind.id}: la campagna migliore non è peggiore di quella debole.`);
  // significant but realistic: the best campaign is worth between a quarter of a point and a few points above doing nothing, and never a landslide in absolute terms
  const best = Math.max(g.strategic, g.intense), worth = best - g.idle;
  assert.ok(worth > 0.25 && worth < 4, `${kind.id}: la campagna migliore vale ${worth.toFixed(2)} punti sull’inattività (tra 0,25 e 4).`);
  assert.ok(Math.max(...gains.strategic, ...gains.intense) < 6 && Math.min(...gains.idle) > -4, `${kind.id}: nessuna valanga né crollo (migliore ${Math.max(...gains.strategic, ...gains.intense).toFixed(2)}, peggiore da fermo ${Math.min(...gains.idle).toFixed(2)}).`);
  // the idle drift is contained: the rivals campaign too, with the same weight of the player's own
  assert.ok(g.idle > -1.6, `${kind.id}: chi non fa nulla perde poco (${g.idle.toFixed(2)}), non viene divorato dai rivali.`);
  // polls and truth stay together during the campaign
  assert.ok(Math.abs(m(polls)) < 1.2, `${kind.id}: i sondaggi seguono il consenso effettivo (scarto medio ${m(polls).toFixed(2)}).`);
  SUMMARY.push(`${kind.id} (${durations[kind.id]} giorni): fermo ${g.idle.toFixed(2)}, debole ${g.weak.toFixed(2)}, strategica ${g.strategic.toFixed(2)}, intensa ${g.intense.toFixed(2)} punti (attività ${m(acts.weak).toFixed(0)}/${m(acts.strategic).toFixed(0)}/${m(acts.intense).toFixed(0)})`);
}
lines.push(`quattro modi di fare campagna x cinque voti, ${SEEDS} semi pari: ${SUMMARY.join('; ')}`);
assert.ok(durations.comunale >= durations.provinciale && new Set(Object.values(durations)).size >= 3, `Le durate dei cinque voti non sono tutte uguali (${JSON.stringify(durations)}).`);

// ============ C. the runoff ============
{
  let runoffs = 0, waves = 0, excess = [], carried = [];
  for (let seed = 1; seed <= 40; seed++) {
    let c = make('comunale', 'sindaco', { municipalityBand: 'oltre-15000' }, `ballo-${seed}`); c.nomination.status = 'approved';
    let previous = null, guard = 0;
    while (c.status === 'active' && guard++ < 260) {
      if (c.pendingEvents.length) { const e = c.pendingEvents[0]; c = engine.decideCampaignEvent(c, e.id, e.choices[(seed + guard) % e.choices.length].id); continue; }
      c = engine.advanceCampaign(c, 1);
      if (c.stage !== 'ballottaggio' || c.status !== 'active') { previous = null; continue; }
      const me = c.candidates.find(item => item.isPlayer);
      if (me?.status !== 'active') continue;
      if (guard % 3 === 0) {
        // an activity of the runoff is worth a bounded, single move of the head-to-head projection (the appeal to the voters of the eliminated moves the rate they follow once, the counter of the campaign
        // grows by at most the move on the first-round shares): two weeks of activities cannot be worth a landslide, and the same state with the same activity gives the same answer (nothing applied twice)
        const projection = state => engine.runoffProjection(state)?.[state.playerCandidateId] ?? 0;
        const before = projection(c), gainedBefore = c.gained ?? 0;
        try {
          topUp(c);
          const once = engine.performCampaignActivity(c, 'appeal_eliminated', { territoryId: c.territories[0].id });
          const again = engine.performCampaignActivity(c, 'appeal_eliminated', { territoryId: c.territories[0].id });
          assert.equal(projection(once), projection(again), `ballottaggio #${seed}: la stessa attività dallo stesso stato dà lo stesso esito.`);
          const moved = projection(once) - before;
          // (the days of the activity also let the other candidates move: an eliminated one who backs a finalist is a discrete event of the runoff, counted by its own rules)
          const news = once.history.filter(item => !c.history.some(old => old.id === item.id)).some(item => /si apparenta|dichiara il proprio sostegno|sostegno alla tua|indica di votare/.test(item.text));
          if (!news && once.status === 'active') assert.ok(moved >= -0.6 && moved <= 2.5, `ballottaggio #${seed}: un’attività sposta il confronto di ${moved.toFixed(2)} punti (tra −0,6 e 2,5).`);
          assert.ok((once.gained ?? 0) - gainedBefore <= 1, `ballottaggio #${seed}: il contatore cresce al più di un punto.`);
          c = once;
        } catch (error) { if (error.name === 'AssertionError') throw error; }
      }
      const wave = c.pollObservatory?.waves?.at(-1);
      if (!wave || wave.stage !== 'ballottaggio' || wave.day !== c.day) continue; // (the poll of the day: between two waves the projection may move by an event)
      runoffs += previous === null ? 1 : 0; waves++;
      const mine = wave.average.find(row => row[0] === c.playerCandidateId)?.[1], truth = engine.runoffProjection(c)?.[c.playerCandidateId];
      if (Number.isFinite(mine) && Number.isFinite(truth)) {
        // the poll is where the head-to-head is, within the margin of the sample, except for what a single week could not follow yet (a discrete event moves the model by up to twenty points: the polls carry the rest on)
        const owed = Math.abs(wave.carry?.find(row => row[0] === c.playerCandidateId)?.[1] ?? 0);
        assert.ok(Math.abs(mine - truth) <= 2.5 * (wave.average.find(row => row[0] === c.playerCandidateId)?.[3] ?? 3) + 1.5 + owed, `ballottaggio #${seed}: il sondaggio (${mine}) segue il confronto tra i due (${truth}), con ${owed.toFixed(1)} punti ancora da recuperare.`);
        carried.push(owed);
        if (previous && previous.day !== wave.day) excess.push(Math.abs(mine - previous.mine) - Math.abs(truth - previous.truth));
        previous = { day: wave.day, mine, truth };
      }
    }
  }
  assert.ok(runoffs >= 3 && waves >= 6, `Ballottaggi sufficienti per la prova (${runoffs} con ${waves} sondaggi).`);
  // the poll does not move by more than what the head-to-head moved plus the noise of an institute (a shift counted twice would show as a systematic excess)
  assert.ok(m(carried) < 3, `ballottaggio: i punti ancora da recuperare restano pochi (media ${m(carried).toFixed(2)}).`);
  assert.ok(m(excess) < 1.6, `ballottaggio: il sondaggio non si muove più del confronto reale (eccesso medio ${m(excess).toFixed(2)} punti).`);
  lines.push(`ballottaggio: ${runoffs} ballottaggi, ${waves} sondaggi, sondaggio vicino al confronto tra i due, spostamenti contati una volta (eccesso medio ${m(excess).toFixed(2)})`);
}
console.log(`Campagne, gameplay: ${lines.join(' | ')}`);
process.exit(0);
