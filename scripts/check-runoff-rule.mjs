// Runoff admission: only the two with the most votes go to the second round (never a threshold), over 50% wins at once, up to 15,000 inhabitants there is no runoff, and a candidate who is only a partner in a finalist's coalition is not a finalist.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCampaign } from '../src/core/campaign-engine.js';
import { runFirstRound } from '../src/core/election-engine.js';
import { bandOfPopulation, indexMunicipalPopulation, municipalityBandInfo } from '../src/core/municipal-rules.js';
import { makeDemoState } from '../src/data/simulation/demo.js';

const store = new Map();
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = parties.find(item => item.id === 'party-futuro-nazionale');
const base = makeDemoState();
const make = seed => createCampaign({ career: { ...base.career, id: `ballottaggio-${seed}`, partyId: party.id }, player: { ...base.dataset.politicians[0], partyId: party.id, region: 'Lombardia', municipality: 'Milano' }, statistics: base.dataset.statistics, partyCatalog: parties, currentDate: '2026-09-23', config: { electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'oltre-15000' } });
const setShares = (campaign, leaderIndex, leaderShare) => {
  const ids = campaign.candidates.map(item => item.id);
  const others = ids.filter((id, index) => index !== leaderIndex);
  for (const area of campaign.territories) area.supportByCandidate = Object.fromEntries(ids.map((id, index) => [id, index === leaderIndex ? leaderShare : (100 - leaderShare) / others.length]));
  return campaign;
};

const exact = (campaign, shares) => {
  const ids = campaign.candidates.map(item => item.id);
  const rest = Math.max(0, 100 - shares.reduce((a, b) => a + b, 0));
  const tail = ids.length > shares.length ? rest / (ids.length - shares.length) : 0;
  for (const area of campaign.territories) area.supportByCandidate = Object.fromEntries(ids.map((id, index) => [id, index < shares.length ? shares[index] : tail]));
  return campaign;
};
const player = campaign => campaign.playerCandidateId;
const idsOf = campaign => campaign.candidates.map(item => item.id);

for (let seed = 0; seed < 12; seed++) {
  // 48 / 47 / 5 : the first two go, the 5% does not (the player is the 5%)
  let campaign = make(`r48-${seed}`);
  const ids = idsOf(campaign);
  const playerIndex = ids.indexOf(player(campaign));
  const shares = new Array(Math.max(3, ids.length)).fill(0);
  const others = ids.map((_, i) => i).filter(i => i !== playerIndex);
  shares[others[0]] = 48; shares[others[1]] = 47; shares[playerIndex] = 5;
  let result = runFirstRound(exact(campaign, shares.slice(0, ids.length)));
  assert.equal(result.requiresRunoff, true);
  assert.deepEqual([...result.runoffCandidateIds].sort(), [ids[others[0]], ids[others[1]]].sort(), `seme ${seed}: 48/47/5, vanno i primi due.`);
  assert.ok(!result.runoffCandidateIds.includes(player(campaign)), 'Il 5% non entra.');

  // many candidates: the 5% is not second
  campaign = make(`rmany-${seed}`);
  const n = idsOf(campaign).length;
  if (n >= 4) {
    const s = new Array(n).fill(0); const idx = idsOf(campaign).indexOf(player(campaign));
    const order = idsOf(campaign).map((_, i) => i).filter(i => i !== idx);
    const big = [30, 28, 20, 17, 16, 15, 14, 13, 12];
    order.forEach((i, k) => { s[i] = big[k] ?? 1; }); s[idx] = 5;
    const total = s.reduce((a, b) => a + b, 0); const scaled = s.map(v => v * 100 / total);
    result = runFirstRound(exact(campaign, scaled));
    assert.ok(!result.runoffCandidateIds.includes(player(campaign)), `seme ${seed}: con più candidati il ${scaled[idx].toFixed(1)}% non entra se non è tra i primi due.`);
    assert.equal(result.runoffCandidateIds.length, 2);
  }

  // the 5% IS second when everybody else is lower: it is allowed (no arbitrary threshold)
  campaign = make(`rsecond-${seed}`);
  const m = idsOf(campaign).length; const pi = idsOf(campaign).indexOf(player(campaign));
  const other = idsOf(campaign).map((_, i) => i).filter(i => i !== pi);
  const s2 = new Array(m).fill(0); s2[other[0]] = 48; s2[pi] = 5; const low = (100 - 53) / Math.max(1, m - 2);
  other.slice(1).forEach(i => { s2[i] = low; });
  if (low < 5) { result = runFirstRound(exact(campaign, s2)); assert.ok(result.runoffCandidateIds.includes(player(campaign)), `seme ${seed}: il 5% è secondo e passa.`); }

  // more than 50%: first-round win
  campaign = make(`rwin-${seed}`);
  result = runFirstRound(exact(campaign, [51, ...new Array(idsOf(campaign).length - 1).fill(49 / (idsOf(campaign).length - 1))]));
  assert.equal(result.requiresRunoff, false); assert.ok(result.winnerGroupId);
}
console.log('check-runoff-rule: engine ok');

// linked lists / coalitions: the votes of a partner count for the leader of the coalition; the partner is not a finalist, and the ids of the groups are the leaders' ids
{
  const campaign = make('coalizione');
  const ids = idsOf(campaign); const pi = ids.indexOf(player(campaign));
  const others = ids.map((_, i) => i).filter(i => i !== pi);
  const [a, b] = others;
  campaign.candidates[pi].coalitionLeaderId = ids[a];
  const s = new Array(ids.length).fill(0); s[a] = 40; s[b] = 47; s[pi] = 5;
  const left = (100 - 92) / Math.max(1, ids.length - 3); others.slice(2).forEach(i => { s[i] = left; });
  const result = runFirstRound(exact(campaign, s));
  const group = result.groups.find(row => row.id === ids[a]);
  assert.ok(group, 'Il capofila della coalizione è un gruppo.');
  assert.ok(!result.groups.some(row => row.id === ids[pi]), 'Il partner non è un gruppo a sé.');
  assert.ok(result.runoffCandidateIds.includes(ids[a]) && result.runoffCandidateIds.includes(ids[b]), 'Coalizione di A (40+5) e B: sono i finalisti.');
  assert.ok(!result.runoffCandidateIds.includes(ids[pi]), 'Il partner con il 5% non è finalista.');
  assert.ok(Math.abs(group.percent - 45) < 1, `i voti del partner sono del capofila (${group.percent}%).`);
}

// a comune up to 15,000: single round, no runoff whatever the shares
{
  const campaign = make('piccolo');
  campaign.municipalityBand = 'fino-15000';
  const ids = idsOf(campaign);
  const result = runFirstRound(exact(campaign, [34, 33, ...new Array(ids.length - 2).fill(33 / Math.max(1, ids.length - 2))].slice(0, ids.length)));
  assert.equal(result.requiresRunoff, false, 'Fino a 15.000 abitanti: turno unico.');
  assert.ok(result.winnerGroupId);
}
console.log('check-runoff-rule: ok');
