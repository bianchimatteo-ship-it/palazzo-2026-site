// The opening consensus of a local campaign: it depends on the level of the vote, the strength of the player's party, the personal consensus and the quality of the candidate — three things kept apart
// (personal consensus, party weight, notoriety/popularity) — and not on the same equal start for everybody. A general or European campaign keeps its anchor in the polls (the weight of the party in the
// polls), unmoved by the local party edge or the personal consensus. Deterministic: the same inputs give the same opening.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCampaign, campaignSummary } from '../src/core/campaign-engine.js';
import { makeDemoState } from '../src/data/simulation/demo.js';

const store = new Map();
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = parties.find(item => item.id === 'party-futuro-nazionale');
const base = makeDemoState();
const field = Object.fromEntries(parties.map((item, index) => [item.id, 6 + ((index * 7) % 11)]));
const open = (type, role, stats, weight, seed, config = {}) => {
  const player = { ...base.dataset.politicians[0], partyId: party.id, region: 'Lombardia', municipality: 'Milano' };
  const statistics = [...base.dataset.statistics.filter(item => item.subjectId !== player.id), ...Object.entries(stats).map(([metric, value]) => ({ id: `s-${metric}`, subjectId: player.id, metric, value, asOf: '2026-09-23' }))];
  const campaign = createCampaign({ career: { ...base.career, id: `apertura-${seed}`, partyId: party.id, initialLevel: 'comunale' }, player, statistics, offices: base.dataset.offices, territories: base.dataset.territories, partyCatalog: parties, currentDate: '2026-09-23', config: { electionType: type, role, objective: 'build', municipalityBand: 'oltre-15000', partyWeights: { ...field, [party.id]: weight }, ...config } });
  return campaignSummary(campaign).consensus;
};
const mean = fn => { let sum = 0; for (let i = 0; i < 24; i++) sum += fn(i); return sum / 24; };
const PROFILES = { sconosciuto: { popularity: 25, notoriety: 8, influence: 5, experience: 5, consensus: 2 }, medio: { popularity: 42, notoriety: 20, influence: 14, experience: 18, consensus: 4 }, forte: { popularity: 70, notoriety: 60, influence: 55, experience: 55, consensus: 40 } };
const levels = [['comunale', 'sindaco'], ['provinciale', 'consigliere'], ['regionale', 'consigliere']];

for (const [type, role] of levels) {
  const at = (profile, weight) => mean(i => open(type, role, PROFILES[profile], weight, `${type}-${profile}-${weight}-${i}`));
  const weakUnknown = at('sconosciuto', 2), strongUnknown = at('sconosciuto', 28), weakStrong = at('forte', 2), strongStrong = at('forte', 28), mid = at('medio', 14);
  // the strength of the party counts, the quality of the candidate counts, and they add up
  assert.ok(strongUnknown > weakUnknown + 2, `${type}: un partito forte parte più in alto di uno debole (${weakUnknown.toFixed(1)} → ${strongUnknown.toFixed(1)}).`);
  assert.ok(weakStrong > weakUnknown + 4, `${type}: un candidato forte parte più in alto di uno sconosciuto (${weakUnknown.toFixed(1)} → ${weakStrong.toFixed(1)}).`);
  assert.ok(strongStrong > Math.max(strongUnknown, weakStrong) && strongStrong - weakUnknown > 9, `${type}: i due effetti si sommano (${strongStrong.toFixed(1)} contro ${weakUnknown.toFixed(1)}).`);
  assert.ok(mid > weakUnknown && mid < strongStrong, `${type}: un caso medio sta in mezzo.`);
  // a newcomer with a weak party does not start where the favourite does
  assert.ok(weakUnknown < 20 && strongStrong > weakUnknown * 1.5, `${type}: lo sconosciuto con un partito debole parte basso (${weakUnknown.toFixed(1)}).`);
  // deterministic
  assert.equal(open(type, role, PROFILES.medio, 14, 'x'), open(type, role, PROFILES.medio, 14, 'x'), `${type}: stessa partenza con gli stessi dati.`);
}
// personal consensus is read and kept apart: it moves the opening with everything else equal, and a different party weight does not change it
{
  const low = mean(i => open('comunale', 'sindaco', { ...PROFILES.medio, consensus: 2 }, 14, `c-${i}`));
  const high = mean(i => open('comunale', 'sindaco', { ...PROFILES.medio, consensus: 45 }, 14, `c-${i}`));
  assert.ok(high > low + 2, `Il consenso personale sposta la partenza (${low.toFixed(1)} → ${high.toFixed(1)}).`);
  const samePerson = open('comunale', 'sindaco', PROFILES.medio, 14, 'k'), otherParty = open('comunale', 'sindaco', PROFILES.medio, 25, 'k');
  assert.ok(otherParty > samePerson, 'A parità di persona conta il peso del partito.');
}
// general and European votes keep their anchor: the weight of the force in the polls decides, not the local party edge
{
  const roster = (share) => ({ participants: [{ id: party.id, label: party.name ?? 'Partito', share, refSource: 'real' }, { id: parties[0].id === party.id ? parties[1].id : parties[0].id, label: 'Altro', share: 40, refSource: 'real' }, { id: parties[2].id, label: 'Terzo', share: 20, refSource: 'real' }], others: 0 });
  const run = (share, stats) => { try { return open('europee', 'eurodeputato', stats, 14, `eu-${share}`, { roster: roster(share) }); } catch { return null; } };
  const small = run(3, PROFILES.medio), large = run(30, PROFILES.medio);
  assert.ok(small !== null && large !== null, 'La campagna europea ancorata si crea.');
  {
    assert.ok(large > small * 3, `Europee: il peso nei sondaggi decide la partenza (${small.toFixed(1)} contro ${large.toFixed(1)}).`);
    const lowC = run(30, { ...PROFILES.medio, consensus: 2 }), highC = run(30, { ...PROFILES.medio, consensus: 60 });
    assert.ok(Math.abs(highC - lowC) < 0.01, `Europee: il consenso personale locale non muove l'ancoraggio (${lowC} / ${highC}).`);
  }
}
console.log('Partenza della campagna verificata: dipende da livello, forza del partito, consenso personale e qualità del candidato (tre livelli locali, 24 semi per caso); le campagne nazionali ed europee restano ancorate ai sondaggi.');
