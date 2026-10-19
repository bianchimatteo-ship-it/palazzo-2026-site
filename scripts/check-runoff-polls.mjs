// Regressione: sondaggi, ballottaggio e risultati devono restare coerenti tra turno e turno.
// - chi esce al primo turno conserva la quota del primo turno (mai 0%);
// - il ballottaggio ha il suo sondaggio fin dalla prima settimana, con due soli candidati;
// - i sondaggi di ogni fase non superano 100 (il resto sono gli indecisi) e non mescolano turni diversi;
// - l'esito si confronta con l'aspettativa del primo turno, non con la quota al ballottaggio.
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
const rules = await import(`../src/core/municipal-rules.js${v}`);
const { makeDemoState } = await import(`../src/data/simulation/demo.js${v}`);
rules.setMunicipalPopulationIndex(rules.indexMunicipalPopulation(JSON.parse(await readFile(new URL('../src/data/real/municipal-population.json', import.meta.url), 'utf8'))));
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
const base = makeDemoState();
const near = (a, b, eps, label) => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} vs ${b}`);

let eliminated = 0, runoffs = 0, runoffPolls = 0;
for (let seed = 1; seed <= 24; seed++) {
  const player = { ...base.dataset.politicians[0], partyId: party.id, region: 'Piemonte' };
  let campaign = engine.createCampaign({ career: { ...base.career, id: `runoff-polls-${seed}`, partyId: party.id }, player, statistics: base.dataset.statistics, partyCatalog: parties, currentDate: '2026-09-25', config: { electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'oltre-15000', place: { municipalityCode: '006003', region: 'Piemonte' } } });
  campaign.nomination.status = 'approved';
  let wasRunoff = false;
  for (let guard = 0; campaign.status === 'active' && guard < 260; guard++) {
    if (campaign.pendingEvents.length) { const e = campaign.pendingEvents[0]; campaign = engine.decideCampaignEvent(campaign, e.id, e.choices[(seed + guard) % e.choices.length].id); continue; }
    const before = campaign.stage;
    campaign = engine.advanceCampaign(campaign, 1);
    const poll = campaign.polls.at(-1);
    if (poll) { const total = poll.results.reduce((sum, row) => sum + row.share, 0); assert.ok(total <= 100.6 && total >= 80, `seed ${seed}: sondaggio ${poll.stage ?? campaign.stage} somma ${total} (il resto sono gli indecisi, mai più di 100)`); }
    if (campaign.stage === 'ballottaggio' && campaign.status === 'active') {
      wasRunoff = true;
      assert.equal(poll?.stage, 'ballottaggio', `seed ${seed}: nel ballottaggio l'ultimo sondaggio deve essere del ballottaggio (era ${before})`);
      assert.equal(poll.results.length, 2, `seed ${seed}: il sondaggio del ballottaggio ha due candidati`);
      runoffPolls++;
    }
  }
  const first = campaign.firstRoundResult;
  const result = campaign.result;
  assert.ok(result, `seed ${seed}: campagna senza risultato`);
  if (first) {
    runoffs++;
    assert.ok(wasRunoff || first.runoffCandidateIds.length === 2, `seed ${seed}: ballottaggio senza fase`);
    if (!first.runoffCandidateIds.includes(campaign.playerCandidateId)) {
      eliminated++;
      assert.ok(result.playerShare > 0, `seed ${seed}: chi esce al primo turno non può risultare allo 0%`);
      near(result.playerShare, first.playerShare, 0.01, `seed ${seed}: quota dell'eliminato diversa da quella del primo turno`);
      assert.equal(result.winnerGroupId === campaign.playerCandidateId, false, `seed ${seed}: l'eliminato non vince`);
    } else {
      const shares = result.runoffResults.map(row => row.percent);
      near(shares.reduce((a, b) => a + b, 0), 100, 0.2, `seed ${seed}: ballottaggio non somma 100`);
      assert.ok(shares.every(share => share > 0 && share < 100), `seed ${seed}: quote di ballottaggio non plausibili`);
    }
  }
}
assert.ok(runoffs > 0, 'nessun ballottaggio simulato: il test non verifica nulla');
assert.ok(runoffPolls > 0, 'nessun sondaggio di ballottaggio verificato');
console.log(`check-runoff-polls: ok (${runoffs} ballottaggi, ${eliminated} eliminati al primo turno, ${runoffPolls} sondaggi di ballottaggio)`);
