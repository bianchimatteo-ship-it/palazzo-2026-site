// The polls of a race say one thing: what the campaign publishes is the average of the institutes of the observatory (same numbers, same sample), and the statistics of that series are
// those of a real poll: percentages that add up, an error that depends on the sample (small races swing more), a change from week to week that stays within what a sample and an
// institute can explain (no 6% → 2.5% without an event that moves the race), a result that is not guaranteed by the last poll and not far from it, and the same numbers when the
// campaign is played again from the same seed. Many seeds, four kinds of vote. Pure engine, no browser.
import assert from 'node:assert/strict';
import { createCampaign, advanceCampaign, campaignObservatory } from '../src/core/campaign-engine.js';
import { makeDemoState } from '../src/data/simulation/demo.js';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const base = makeDemoState();
const KINDS = [
  ['comunale-piccolo', { electionType: 'comunale', role: 'sindaco', municipalityBand: 'fino-15000' }],
  ['comunale-grande', { electionType: 'comunale', role: 'sindaco', municipalityBand: 'oltre-15000' }],
  ['regionale', { electionType: 'regionale', role: 'presidente' }],
  ['politiche', { electionType: 'politiche', role: 'deputato' }]
];
const simulate = (kind, config, seed) => {
  let campaign = createCampaign({ career: { ...base.career, id: `coerenza-${kind}-${seed}`, partyId: null }, player: { ...base.dataset.politicians[0], partyId: null, region: 'Toscana', municipality: 'Valleverde' }, statistics: base.dataset.statistics, partyCatalog: [], currentDate: '2026-09-23', config });
  campaign.nomination.status = 'approved';
  const history = [];
  for (let week = 0; week < 22 && campaign.status === 'active'; week++) { campaign = advanceCampaign(campaign, 7); const poll = campaign.polls.at(-1); if (poll && history.at(-1)?.id !== poll.id) history.push(poll); }
  return { campaign, history };
};
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
const stats = { jumps: [], devs: [], leaderWon: 0, total: 0, surprises: 0, margins: {} };
for (const [kind, config] of KINDS) {
  for (let seed = 0; seed < 12; seed++) {
    const { campaign, history } = simulate(kind, config, seed);
    const label = `${kind}/${seed}`;
    check(campaign.status === 'finished' && history.length >= 4, `${label}: la campagna finisce e ha almeno quattro rilevazioni (${history.length}).`);
    // one series: the campaign's poll is the observatory's average, reading for reading
    const observatory = campaign.pollObservatory?.waves ?? [];
    for (const poll of history) {
      const wave = observatory.find(item => item.day === poll.day && item.stage === poll.stage);
      check(Boolean(wave), `${label}: la rilevazione del giorno ${poll.day} è anche nell’Osservatorio.`);
      if (!wave) continue;
      const same = wave.average.every(([id, share]) => Math.abs((poll.results.find(row => row.candidateId === id)?.share ?? -1) - share) < 1e-9);
      check(same && poll.results.length === wave.average.length, `${label}: giorno ${poll.day}, campagna e Osservatorio dicono gli stessi numeri.`);
      const total = poll.results.reduce((sum, row) => sum + row.share, 0);
      check(Math.abs(total - 100) < 1.5, `${label}: giorno ${poll.day}, le percentuali sommano ${total.toFixed(2)}.`);
      check(poll.results.every(row => Number.isFinite(row.share) && row.share >= 0 && row.share <= 100), `${label}: percentuali valide.`);
      check(poll.sample > 0 && poll.margin > 0 && poll.margin < 8, `${label}: campione ${poll.sample} e margine ${poll.margin} plausibili.`);
    }
    // the change from one reading to the next of the same candidacy
    for (let i = 1; i < history.length; i++) for (const row of history[i].results) {
      const before = history[i - 1].results.find(item => item.candidateId === row.candidateId);
      if (before && history[i].stage === history[i - 1].stage) stats.jumps.push({ label, jump: Math.abs(row.share - before.share), margin: history[i].margin, from: before.share, to: row.share });
    }
    // the last poll against the vote
    const last = history.at(-1);
    const rows = campaign.result?.groups ?? [];
    if (last && rows.length) {
      stats.total++;
      const leader = [...last.results].sort((a, b) => b.share - a.share)[0];
      if (leader.candidateId === campaign.result.winnerGroupId) stats.leaderWon++;
      for (const row of rows) { const estimate = last.results.find(item => item.candidateId === row.candidateId)?.share; if (Number.isFinite(estimate)) stats.devs.push({ label, dev: Math.abs(row.percent - estimate), margin: last.margin }); }
      (stats.margins[kind] ??= []).push(last.margin);
    }
    // the same seed, the same numbers
    if (seed < 2) check(JSON.stringify(simulate(kind, config, seed).campaign.polls) === JSON.stringify(campaign.polls), `${label}: stessi sondaggi a parità di seme.`);
  }
}
// weekly change: never a collapse that the sample cannot explain (a drop of 3.5 points needs an error four times the margin; the cap of the institutes is far below that)
const worst = stats.jumps.sort((a, b) => b.jump - a.jump)[0];
check(worst.jump <= 8, `Nessun salto settimanale oltre 8 punti (massimo ${worst.jump.toFixed(2)} in ${worst.label}: ${worst.from} → ${worst.to}).`);
const big = stats.jumps.filter(item => item.jump > 3.5);
check(big.length / stats.jumps.length < 0.03, `Salti oltre 3,5 punti rari (${big.length} su ${stats.jumps.length}).`);
const small = (stats.jumps.filter(item => item.to < 10 && item.from < 10).map(item => item.jump));
const mean = list => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
check(mean(small) < 1.6, `Le forze minori oscillano poco da una rilevazione all’altra (media ${mean(small).toFixed(2)} punti).`);
check(!stats.jumps.some(item => item.from >= 5 && item.from <= 7 && item.to <= 3), 'Nessun 6% → 2,5% da una settimana all’altra.');
// small races swing more than big ones
check(mean(stats.margins['comunale-piccolo']) > mean(stats.margins['politiche']), `Il margine d’errore è maggiore nelle corse piccole (${mean(stats.margins['comunale-piccolo']).toFixed(2)} contro ${mean(stats.margins.politiche).toFixed(2)}).`);
// the poll does not guarantee the result, and is not far from it
const deviations = stats.devs.map(item => item.dev);
check(mean(deviations) < 3.5, `Scarto medio tra ultimo sondaggio e voto plausibile (${mean(deviations).toFixed(2)}).`);
check(stats.devs.filter(item => item.dev > item.margin * 3.5 + 2).length / stats.devs.length < 0.04, 'Quasi sempre il voto sta entro una sorpresa plausibile dall’ultimo sondaggio.');
check(stats.leaderWon < stats.total, `Il primo nell’ultimo sondaggio non vince sempre (${stats.leaderWon} su ${stats.total}): nessun esito garantito.`);
check(stats.leaderWon / stats.total > 0.5, `Ma vince nella maggior parte dei casi (${stats.leaderWon} su ${stats.total}).`);

if (problems.length) { console.error(`Coerenza dei sondaggi: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 25).join('\n')}`); process.exit(1); }
console.log(`Sondaggi coerenti: ${KINDS.length * 12} campagne di quattro tipi di voto, la serie della campagna è la media dell’Osservatorio (stessi numeri e stesso campione), percentuali che sommano 100, margine più alto nelle corse piccole, salto massimo tra due rilevazioni ${worst.jump.toFixed(2)} punti, scarto medio dal voto ${mean(deviations).toFixed(2)}, il primo nell’ultimo sondaggio vince in ${stats.leaderWon} casi su ${stats.total}, stessi numeri a parità di seme.`);
