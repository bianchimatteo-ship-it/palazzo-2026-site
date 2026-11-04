// Difficoltà e consenso: a parità di condizioni (stessi avversari, stesso campo, stesse attività) Facile, Normale e Difficile producono una crescita coerente e diversa; i rendimenti decrescono; una campagna ordinaria non regala 10-11 punti.
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


const makeD = (type, role, config, id, difficulty) => engine.createCampaign({ career: { ...base.career, id, partyId: party.id, difficulty }, player, statistics, partyCatalog: parties, currentDate: '2026-09-25', config: { electionType: type, role, objective: 'win', municipalityBand: 'oltre-15000', independents: 0, ...config } });
const KINDS = [
  { id: 'comunale', type: 'comunale', role: 'sindaco', config: { municipalityBand: 'oltre-15000' } },
  { id: 'provinciale', type: 'provinciale', role: 'presidente', config: {} },
  { id: 'regionale', type: 'regionale', role: 'presidente', config: {} },
  { id: 'politiche', type: 'politiche', role: 'deputato', config: {} },
  { id: 'europee', type: 'europee', role: 'eurodeputato', config: {} }
];
const m = list => list.reduce((a, b) => a + b, 0) / (list.length || 1);
const topUp = c => { const me = c.candidates.find(item => item.isPlayer); Object.assign(me.resources, { money: 900000, politicalCapital: 99 }); return c; };
const STRATEGIC_SET = ['territorial_pact', 'endorsement', 'territory_campaign', 'door_to_door', 'issue_focus', 'territorial_media', 'social_ads', 'associations', 'local_visit', 'citizen_meeting'];
const INTENSE_SET = ['territory_campaign', 'rally', 'door_to_door', 'public_event', 'local_ads', 'posters', 'social_ads', 'national_media', 'press_conference', 'interview', 'territorial_pact', 'endorsement', 'associations', 'social', 'local_visit', 'citizen_meeting'];
function play(kind, difficulty, seed, way) {
  let c = makeD(kind.type, kind.role, kind.config, `dif-${kind.id}-${seed}`, difficulty); c.nomination.status = 'approved';
  const start = playerGroup(c).share; let day = 0, rot = 0;
  while (c.status === 'active' && day < 200) {
    if (c.candidates.find(item => item.isPlayer)?.status === 'active') for (const id of (way === 'intense' ? INTENSE_SET : day % 2 === 0 ? STRATEGIC_SET : [])) {
      if (c.status !== 'active') break;
      try { c = engine.performCampaignActivity(c, id, { territoryId: c.territories[rot++ % c.territories.length].id }); if (way !== 'intense') break; } catch { /* not possible today */ }
    }
    if (c.status !== 'active') break;
    topUp(c); c = engine.advanceCampaign(c, 1); day++;
  }
  return { gained: c.gained ?? 0, delta: (playerGroup(c)?.share ?? start) - start };
}
const SEEDS_N = Number(process.env.DIFFICULTY_SEEDS ?? 5);
const report = [];
for (const kind of KINDS.filter(item => ['politiche', 'regionale', 'comunale'].includes(item.id))) {
  const result = {};
  for (const difficulty of ['facile', 'normale', 'difficile']) {
    const runs = Array.from({ length: SEEDS_N }, (_, i) => play(kind, difficulty, i + 1, 'strategic'));
    result[difficulty] = { gained: m(runs.map(item => item.gained)), delta: m(runs.map(item => item.delta)), max: Math.max(...runs.map(item => item.gained)) };
  }
  const { facile, normale, difficile } = result;
  assert.ok(facile.gained > normale.gained && normale.gained > difficile.gained, `${kind.id}: la crescita segue la difficoltà (${facile.gained.toFixed(2)} > ${normale.gained.toFixed(2)} > ${difficile.gained.toFixed(2)}).`);
  assert.ok(facile.gained / normale.gained < 1.4 && normale.gained / difficile.gained < 1.4, `${kind.id}: la differenza è misurata, non un abisso.`);
  assert.ok(normale.max < 8, `${kind.id}: una campagna ordinaria non regala 10-11 punti (massimo guadagnato ${normale.max.toFixed(2)}).`);
  report.push(`${kind.id}: facile ${facile.delta.toFixed(2)} · normale ${normale.delta.toFixed(2)} · difficile ${difficile.delta.toFixed(2)} punti`);
}
// the returns decline as the consensus grows: the same push is worth less once the campaign has already gained
{
  const c = makeD('politiche', 'deputato', {}, 'dif-rep', 'normale'); c.nomination.status = 'approved';
  const first = engine.expectedGain(c, rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'rally'));
  c.gained = 3; const later = engine.expectedGain(c, rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'rally'));
  assert.ok(later < first * 0.6, `Rendimenti decrescenti: ${first.toFixed(3)} → ${later.toFixed(3)} dopo 3 punti guadagnati.`);
}
console.log(`Difficoltà e consenso (stesse condizioni e attività, ${SEEDS_N} simulazioni): ${report.join('; ')}.`);
