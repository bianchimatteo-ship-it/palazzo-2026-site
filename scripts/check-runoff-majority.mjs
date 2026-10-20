// The first round of a comune above 15,000: the mayor is elected at once only with MORE than half of the valid votes, counted in whole votes (never from a rounded percentage). Exactly half goes to the
// runoff. The finalists are the two with the most votes, whatever the order of the candidacies; a tie is broken by a fixed key. The class of a comune (up to / over 15,000) is read from the data and
// declared provisional while the legal reference is missing; the comuni near the threshold are marked as uncertain.
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

let exactHalf = 0, halfToRunoff = 0, passed = 0;
for (let seed = 0; seed < 60; seed++) {
  for (const share of [49.9, 50, 50.004, 50.01, 50.1, 51]) {
    const campaign = setShares(make(seed), seed % 3, share);
    const result = runFirstRound(campaign);
    const valid = result.groups.reduce((sum, row) => sum + row.votes, 0);
    const top = Math.max(...result.groups.map(row => row.votes));
    assert.equal(valid, result.electorate.ballots, 'I voti delle righe sono i voti validi.');
    // the rule in whole votes: runoff unless the first has more than half
    assert.equal(result.requiresRunoff, !(top * 2 > valid), `seme ${seed}, ${share}%: ${top} voti su ${valid} → ballottaggio ${result.requiresRunoff}.`);
    if (top * 2 === valid) { exactHalf++; assert.ok(result.requiresRunoff, 'Esattamente la metà dei voti validi non basta.'); halfToRunoff++; }
    if (!result.requiresRunoff) { passed++; assert.equal(result.winnerGroupId, result.groups.find(row => row.votes === top).id); assert.ok(top * 2 > valid, 'Chi vince al primo turno ha più della metà.'); }
    else {
      const finalists = result.runoffCandidateIds;
      assert.equal(finalists.length, 2, 'Due finalisti.');
      const byVotes = [...result.groups].sort((a, b) => b.votes - a.votes);
      assert.ok(finalists.every(id => byVotes.slice(0, 2).some(row => row.id === id)) || byVotes[1].votes === byVotes[2]?.votes, 'I finalisti sono i due più votati.');
    }
  }
}
assert.ok(exactHalf > 0 && halfToRunoff === exactHalf, `Il caso esatto del 50% è provato (${exactHalf} volte) e va sempre al ballottaggio.`);
assert.ok(passed > 0, 'E chi supera davvero la metà vince al primo turno.');

// the finalists do not depend on the order of the candidacies, and a tie for the second place is broken by a fixed key, not by the player's place in the list
for (let seed = 0; seed < 20; seed++) {
  const campaign = make(`ordine-${seed}`);
  const ids = campaign.candidates.map(item => item.id);
  for (const area of campaign.territories) area.supportByCandidate = Object.fromEntries(ids.map((id, index) => [id, index === 1 ? 40 : index === 0 || index === 2 ? 20 : 20 / Math.max(1, ids.length - 2)]));
  const first = runFirstRound(campaign);
  const reversed = structuredClone(campaign);
  reversed.candidates.reverse();
  const second = runFirstRound(reversed);
  assert.deepEqual([...first.runoffCandidateIds].sort(), [...second.runoffCandidateIds].sort(), `seme ${seed}: i finalisti non dipendono dall'ordine dei candidati.`);
  assert.ok(first.runoffCandidateIds.includes(ids[1]), 'Il primo è sempre un finalista.');
}

// the class of the comune: 15,000 is still "up to 15,000"; the data say it is provisional; near the threshold it is flagged
assert.equal(bandOfPopulation(15000), 'fino-15000');
assert.equal(bandOfPopulation(15001), 'oltre-15000');
const doc = JSON.parse(await readFile(new URL('../src/data/real/municipal-population.json', import.meta.url), 'utf8'));
assert.equal(doc.verified, false, 'Il dataset della popolazione è dichiarato non verificato.');
assert.ok(doc.records.every(record => record.electoralPopulationReference === undefined || record.electoralPopulationReference === null), 'Nessuna popolazione legale è inventata.');
const index = indexMunicipalPopulation(doc);
const near = doc.records.find(record => Math.abs(record.populationResident - 15000) < 500);
const far = doc.records.find(record => record.populationResident < 3000);
const nearInfo = municipalityBandInfo(near.municipalityCode, index), farInfo = municipalityBandInfo(far.municipalityCode, index);
assert.ok(nearInfo.provisional && nearInfo.basis === 'residente-indicativo' && nearInfo.nearThreshold, 'Un comune vicino alla soglia è provvisorio e segnato come incerto.');
assert.ok(farInfo.provisional && !farInfo.nearThreshold, 'Un comune lontano dalla soglia è provvisorio ma non incerto.');
assert.equal(municipalityBandInfo('999999', index).basis, 'nessun-dato', 'Un comune sconosciuto usa il ripiego dichiarato.');
console.log(`Ballottaggio verificato: 360 primi turni attorno al 50% (${exactHalf} con esattamente metà dei voti validi, tutti al ballottaggio), finalisti indipendenti dall'ordine; fascia comunale provvisoria, ${doc.records.length} comuni, nessuna popolazione legale inventata.`);
