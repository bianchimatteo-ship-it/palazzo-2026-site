// Polls, projections and results of one election say one thing. For every kind of vote (comunale, provinciale, regionale, politiche, europee) the whole flow of the game is played on the real
// store with deterministic seeds, from the opening of the campaign to the count that closes it (closeCampaign, and for the national votes holdNationalVote / holdPolitiche / holdEuropee /
// withNationalResult), and for every simulation the same competition is read four times on the same base:
//   projection  the simulated support of the moment (aggregateShares: what the standings show);
//   poll        the average of the institutes (what the campaign publishes), an estimate of the projection with the error of its sample;
//   result      the count that was actually used (the national count for politiche and europee, the campaign's for the local votes; the first round when there is a runoff).
// Verified, over all the seeds of each kind of vote:
//   - the percentages add up (polls and counts to 100, the part left to "Altri" only where the race does not field every list);
//   - at the start the first poll is the projection seen through its sample, during the campaign the poll follows the projection within its margin (and is never the projection itself);
//   - the result follows the closing projection: mean, median and 90th percentile of the gap, the largest gap and how often it passes 5 points are reported for each kind of vote and kept
//     under limits that depend on the size of the electorate and on the number of candidacies; a collapse of the kind 9% → 2% fails unless the simulation records the cause (the shift of the
//     day of the vote: late deciders, mobilisation, strategy, turnout) and the gap is that cause;
//   - the national count is the one of the campaign (no independent base): the result is the list the campaign ended on, whatever the territorial distribution the count then gives it;
//   - the same seeds give the same numbers, and what the player does in the campaign still moves the vote.
// Many seeds, so it is split in workers (one per kind of vote, run together): `node scripts/check-poll-election-consistency.mjs` runs them all; `--type=regionale` runs only one;
// `--seeds=N` changes the number of simulations per kind of vote (default 100); `--json` prints the measures instead of the summary.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const argv = Object.fromEntries(process.argv.slice(2).map(item => { const [key, value] = item.replace(/^--/, '').split('='); return [key, value ?? true]; }));
const SEEDS = Math.max(4, Number(argv.seeds ?? process.env.POLL_E2E_SEEDS ?? 100));
const KINDS = [
  { id: 'comunale-piccolo', type: 'comunale', band: 'fino-15000', level: 'comunale', role: 'sindaco', small: true },
  { id: 'comunale-grande', type: 'comunale', band: 'oltre-15000', level: 'comunale', role: 'sindaco' },
  { id: 'provinciale', type: 'provinciale', band: null, level: 'comunale', role: 'consigliere' },
  { id: 'regionale', type: 'regionale', band: null, level: 'regionale', role: 'consigliere' },
  { id: 'politiche', type: 'politiche', band: null, level: 'deputato', role: 'deputato' },
  { id: 'europee', type: 'europee', band: null, level: 'europeo', role: 'eurodeputato' }
];
// The limits, per kind of vote, on the gap in points between the closing projection and the result for the forces at 5% or more (the rows below weigh less than the error of a count). The
// national and regional ones are the ones the game commits to; the local ones depend on how many people decide: a comune up to 15,000 inhabitants and the second-level vote of a province are
// decided by a few thousand electors, so the day of the vote moves them more (the engine's own electorateNoise), and the more candidacies share the vote the smaller each share is.
const LIMITS = {
  'comunale-piccolo': { mae: 2.2, p90: 4.4, max: 7.5 },
  'comunale-grande': { mae: 2, p90: 4, max: 7 },
  'provinciale': { mae: 2.2, p90: 4.4, max: 7.5 },
  'regionale': { mae: 2.5, p90: 5, max: 8 },
  'politiche': { mae: 2, p90: 4, max: 6 },
  'europee': { mae: 2, p90: 4, max: 6 }
};
// The comuni of the small races (up to 15,000 inhabitants): the band of a comunale race is the one of the comune the career is from.
const SMALL_COMUNI = [
  { region: 'Lombardia', municipality: 'Adrara San Martino', municipalityCode: '016001', provinceCode: '016', provinceName: 'Bergamo', provinceType: 'Provincia' },
  { region: 'Toscana', municipality: 'Abbadia San Salvatore', municipalityCode: '052001', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia' },
  { region: 'Campania', municipality: 'Acerno', municipalityCode: '065001', provinceCode: '065', provinceName: 'Salerno', provinceType: 'Provincia' }
];
const FLOOR = 5;
const mean = list => list.reduce((a, b) => a + b, 0) / (list.length || 1);
const quantile = (list, q) => { const sorted = [...list].sort((a, b) => a - b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : NaN; };
const r2 = value => Math.round(value * 100) / 100;

// ============================================================ worker ============================================================
const PLAY = ['rally', 'social', 'door_to_door', 'citizen_meeting', 'interview', 'party_meeting'];
async function work(kind) {
  const { startCareer } = await import('./lib/long-run.mjs');
  const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
  const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
  const { aggregateShares, nationalListShares } = await module('src/core/election-engine.js');
  const { runoffProjection } = await module('src/core/campaign-engine.js');
  const { storage } = await module('src/core/storage.js');
  const national = ['politiche', 'europee'].includes(kind.type);
  const free = () => { for (const slot of storage.listSlots()) { try { if (slot.autoPreserve) storage.deleteSlot(slot.id); } catch { /* a slot that cannot be read stays */ } } };
  // one row per competitor of the race, keyed so that the projection, the poll and the result of the same competitor meet
  const keyOf = group => national ? (group.partyIds?.[0] ?? group.id) : group.id;
  const projectionOf = campaign => Object.fromEntries(aggregateShares(campaign).map(group => [keyOf(group), group.share]));
  const pollOf = campaign => {
    const poll = campaign.polls?.at(-1);
    if (!poll) return null;
    const groups = new Map(aggregateShares(campaign).map(group => [group.id, group]));
    return { day: poll.day, stage: poll.stage, margin: poll.margin, sample: poll.sample, others: poll.others ?? 0, scope: poll.scope ?? null, rows: Object.fromEntries(poll.results.map(row => [groups.has(row.candidateId) ? keyOf(groups.get(row.candidateId)) : row.candidateId, row.share])) };
  };
  const resultRows = campaign => (campaign.firstRoundResult?.groups ?? campaign.result.groups);
  const resultOf = campaign => Object.fromEntries(resultRows(campaign).map(row => [national ? (row.partyIds?.[0] ?? row.id) : row.id, row.percent]));
  const out = [];
  const bases = [];
  const careers = Math.max(1, Math.round(SEEDS / 10));
  const perCareer = Math.ceil(SEEDS / careers);
  async function simulate(store, db, tag, { play = false } = {}) {
    store.startCampaign({ electionType: kind.type, role: kind.role, objective: 'win', ...(kind.band ? { municipalityBand: kind.band } : {}) }, db.parties);
    store.getState().campaign.nomination.status = 'approved';
    const frames = [];
    const take = () => { const c = store.getState().campaign; return { day: c.day, stage: c.stage, total: c.totalDays, proj: projectionOf(c), poll: pollOf(c), runoff: c.stage === 'ballottaggio' ? runoffProjection(c) : null }; };
    const first = take();
    let guard = 0, performed = 0;
    while (store.getState().campaign?.status === 'active' && guard++ < 220) {
      let c = store.getState().campaign;
      for (const event of [...(c.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[(guard + tag.length) % event.choices.length].id);
      if (play && guard % 2 === 1) {
        try { store.performCampaignActivity(PLAY[performed % PLAY.length], { territoryId: store.getState().campaign.territories[performed % store.getState().campaign.territories.length].id }); performed++; } catch { /* not affordable today */ }
      }
      c = store.getState().campaign;
      if (c.status !== 'active') break;
      frames.push(take());
      store.advance(1);
    }
    const campaign = store.getState().campaign;
    if (campaign?.status !== 'finished') throw new Error(`${tag}: la campagna non finisce`);
    // the first round is the question the projection of the campaign stage answers (a runoff is another question)
    const stage = frames.filter(frame => frame.stage === 'campagna');
    const last = stage.at(-1) ?? frames.at(-1);
    const mid = stage[Math.floor(stage.length / 2)] ?? last;
    const day = campaign.electionDays?.find(item => item.round === 'primo-turno') ?? campaign.electionDays?.[0] ?? null;
    const result = resultOf(campaign);
    const row = {
      tag, first, mid, last, result, resultSum: Object.values(result).reduce((a, b) => a + b, 0),
      shifts: Object.fromEntries(Object.entries(day?.shifts ?? {}).map(([id, shift]) => [national ? (campaign.candidates.find(item => item.id === id)?.partyId ?? id) : id, shift])),
      player: national ? (store.getState().world?.playerPartyId ?? campaign.candidates.find(item => item.isPlayer)?.partyId) : campaign.playerCandidateId,
      turnout: day?.turnout ?? null, electors: campaign.electorate?.electors ?? null, sizeClass: campaign.electorate?.sizeClass ?? null, nCandidates: campaign.candidates.length, runoff: Boolean(campaign.firstRoundResult),
      othersShare: campaign.othersShare ?? 0, performed
    };
    if (national) {
      // the campaign's own closing lists and the count that was used for the nation
      const closing = nationalListShares({ ...campaign, status: 'active' });
      row.lists = closing.shares; row.nationalId = campaign.national?.resultId ?? null; row.nationalType = campaign.national?.type ?? null;
    }
    if (campaign.firstRoundResult) {
      const finalists = campaign.result.runoffResults ?? [];
      const projection = frames.filter(frame => frame.stage === 'ballottaggio').at(-1)?.runoff ?? null;
      row.runoff = { result: Object.fromEntries(finalists.map(item => [item.candidateId, item.percent])), sum: finalists.reduce((a, b) => a + b.percent, 0), projection };
    }
    return row;
  }
  let made = 0, tried = 0;
  for (let career = 1; made < SEEDS && tried < careers * 6; tried++, career++) {
    const run = await startCareer({ seed: `pe-${kind.id}-${career}`, level: kind.level, draft: kind.small ? SMALL_COMUNI[career % SMALL_COMUNI.length] : {}, territorial: ['comunale', 'provinciale'].includes(kind.type), fast: true });
    const { store, db } = run;
    let open = null;
    try { open = store.fastForwardToElection(kind.type); } catch { open = null; }
    if (!open) continue;
    const raw = JSON.parse(store.exportSave());
    let usable = false;
    // the same world, other campaigns: the seed of a campaign comes from the id of the career, so every copy is another deterministic race
    for (let copy = 1; copy <= perCareer && made < SEEDS; copy++) {
      const save = JSON.parse(JSON.stringify(raw));
      save.career.id = `${raw.career.id}~${copy}`;
      free();
      store.loadGame(save);
      let one = null;
      try { one = await simulate(store, db, `${kind.id}/${career}/${copy}`); } catch (error) {
        // a provincial seat needs a seat in a comune: a career that cannot run is skipped, never counted
        if (copy === 1 && /seggio|candidatura|Il consiglio|Il Presidente|iscri/i.test(error.message)) break;
        throw error;
      }
      usable = true;
      out.push({ kind: kind.id, career, copy, ...one });
      made++;
    }
    if (usable && bases.length < 3) bases.push({ career, raw, db, store });
  }
  // determinism: the first race of the first career, played again from the same save, gives the same numbers
  const again = [];
  for (const base of bases.slice(0, 2)) {
    const save = JSON.parse(JSON.stringify(base.raw));
    save.career.id = `${base.raw.career.id}~1`;
    free();
    base.store.loadGame(save);
    const second = await simulate(base.store, base.db, `${kind.id}/${base.career}/1`);
    const first = out.find(item => item.career === base.career && item.copy === 1);
    const pick = item => JSON.stringify([item.first, item.mid, item.last, item.result, item.shifts]);
    again.push({ tag: second.tag, same: pick(first) === pick(second) });
  }
  // actions: the same race idle and with a player who works the territory
  const pairs = [];
  for (const base of bases) for (let copy = 1; copy <= 4; copy++) {
    const idle = out.find(item => item.career === base.career && item.copy === copy);
    if (!idle) continue;
    const save = JSON.parse(JSON.stringify(base.raw));
    save.career.id = `${base.raw.career.id}~${copy}`;
    free();
    base.store.loadGame(save);
    const active = await simulate(base.store, base.db, `${kind.id}/${base.career}/${copy}+azioni`, { play: true });
    pairs.push({ tag: active.tag, performed: active.performed, idle: { projection: idle.last.proj[idle.player] ?? null, result: idle.result[idle.player] ?? null }, active: { projection: active.last.proj[active.player] ?? null, result: active.result[active.player] ?? null } });
  }
  return { sims: out, again, pairs };
}

// ============================================================ parent ============================================================
function runWorker(kind) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), `--worker=${kind.id}`, `--seeds=${SEEDS}`], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let text = '', error = '';
    child.stdout.on('data', chunk => { text += chunk; });
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('close', code => code === 0 ? resolve(JSON.parse(text.split('\n').filter(Boolean).at(-1))) : reject(new Error(`${kind.id}: ${error.slice(-1800) || `uscita ${code}`}`)));
  });
}
async function inParallel(kinds, width) {
  const results = new Map();
  const queue = [...kinds];
  await Promise.all(Array.from({ length: Math.min(width, queue.length) }, async () => { while (queue.length) { const kind = queue.shift(); results.set(kind.id, await runWorker(kind)); } }));
  return results;
}
const stats = list => ({ n: list.length, mae: r2(mean(list)), median: r2(quantile(list, .5)), p90: r2(quantile(list, .9)), max: r2(Math.max(...list, 0)), over5: r2(list.filter(item => item > 5).length / (list.length || 1) * 100) });
const show = item => `n=${item.n} MAE ${item.mae} · mediana ${item.median} · p90 ${item.p90} · massimo ${item.max} · oltre 5 punti ${item.over5}%`;

if (argv.worker) {
  const kind = KINDS.find(item => item.id === argv.worker);
  process.stdout.write(`${JSON.stringify(await work(kind))}\n`);
} else {
  const kinds = argv.type ? KINDS.filter(item => item.id === argv.type || item.type === argv.type) : KINDS;
  const all = await inParallel(kinds, Number(argv.width ?? 4));
  const summary = {};
  const problems = [];
  const check = (condition, message) => { if (!condition) problems.push(message); };
  for (const kind of kinds) {
    const { sims, again, pairs } = all.get(kind.id);
    const national = ['politiche', 'europee'].includes(kind.type);
    const limit = LIMITS[kind.id];
    check(sims.length >= Math.min(SEEDS, 100), `${kind.id}: servono almeno ${Math.min(SEEDS, 100)} simulazioni, ce ne sono ${sims.length}.`);
    const gaps = { projection: [], poll: [], pollProjection: [], start: [], mid: [] };
    const bySize = { grandi: [], medie: [], piccole: [] };
    const rowsAll = [];
    let unexplained = 0, explained = 0, withinMargin = 0, pollRows = 0, identical = 0, exceeded = 0, bigListGaps = 0;
    for (const sim of sims) {
      const tag = sim.tag;
      const keys = Object.keys(sim.last.proj).filter(key => sim.result[key] !== undefined);
      // the percentages add up
      for (const [name, frame] of [['inizio', sim.first], ['metà', sim.mid], ['ultimo', sim.last]]) {
        const poll = frame.poll;
        check(Boolean(poll), `${tag}: manca il sondaggio (${name}).`);
        if (!poll) continue;
        const total = Object.values(poll.rows).reduce((a, b) => a + b, 0);
        check(Math.abs(total + poll.others - 100) <= 0.11, `${tag} (${name}): le percentuali del sondaggio e «Altri» fanno ${(total + poll.others).toFixed(2)}, non 100.`);
        if (national) check(poll.others > 0 && Math.abs(poll.others - sim.othersShare) <= 0.6, `${tag} (${name}): «Altri» del sondaggio (${poll.others}) è la parte che la corsa lascia alle liste che non presenta (${sim.othersShare}).`);
        else check(poll.others === 0 && Math.abs(total - 100) <= 0.11, `${tag} (${name}): in una corsa con tutte le candidature «Altri» non assorbe percentuali mancanti (altri ${poll.others}, somma ${total.toFixed(2)}).`);
        check(Math.abs(poll.margin - Math.round(1.96 * Math.sqrt(0.25 / poll.sample) * 1000) / 10) <= 0.06, `${tag} (${name}): il margine ${poll.margin} è quello del campione ${poll.sample}.`);
        check(national ? poll.scope === 'liste' : poll.scope === 'candidature', `${tag}: il sondaggio dichiara l'ambito (${poll.scope}).`);
      }
      const projTotal = Object.values(sim.last.proj).reduce((a, b) => a + b, 0);
      check(Math.abs(projTotal + (national ? sim.othersShare : 0) - 100) <= 0.3, `${tag}: la proiezione fa ${projTotal.toFixed(2)} (+ altri ${sim.othersShare}).`);
      check(sim.resultSum >= 99.6 && sim.resultSum <= 100.4, `${tag}: il risultato fa ${sim.resultSum.toFixed(2)}.`);
      // poll against projection: within the margin of its sample, and not the projection itself
      for (const [name, frame] of [['inizio', sim.first], ['metà', sim.mid], ['ultimo', sim.last]]) {
        for (const key of Object.keys(frame.proj)) {
          const poll = frame.poll?.rows?.[key];
          if (poll === undefined || frame.proj[key] < FLOOR) continue;
          const gap = Math.abs(poll - frame.proj[key]);
          pollRows++;
          if (gap <= frame.poll.margin) withinMargin++;
          if (gap < 0.05) identical++;
          check(gap <= frame.poll.margin * 1.6 + 0.2, `${tag} (${name}): il sondaggio dà ${poll} a ${key} contro una proiezione di ${frame.proj[key]}: oltre il margine ±${frame.poll.margin}.`);
          (name === 'inizio' ? gaps.start : name === 'metà' ? gaps.mid : gaps.pollProjection).push(gap);
        }
      }
      for (const key of keys) {
        const projection = sim.last.proj[key], result = sim.result[key];
        if (projection < FLOOR) continue;
        const gap = Math.abs(result - projection);
        gaps.projection.push(gap);
        const poll = sim.last.poll?.rows?.[key];
        if (poll !== undefined) gaps.poll.push(Math.abs(result - poll));
        (projection >= 15 ? bySize.grandi : projection >= 8 ? bySize.medie : bySize.piccole).push(gap);
        // a gap of more than 4 points, or a collapse (9% → 2%), has to be the day of the vote itself: the shift that the simulation recorded for that candidacy
        const shift = sim.shifts[key] ?? null;
        const collapse = result < projection * 0.5 || result > projection * 2;
        if (gap > 4 || collapse) {
          // (the shift is applied to the shares of every area and the shares are brought back to 100: the effect on the whole is the shift less its part of what the others' shifts add up to)
          const moved = Object.keys(sim.last.proj).reduce((sum, other) => sum + sim.last.proj[other] + (sim.shifts[other] ?? 0), 0) || 100;
          const expected = shift === null ? null : (projection + shift) * 100 / moved - projection;
          const cause = expected !== null && Math.abs((result - projection) - expected) <= Math.max(1.5, Math.abs(result - projection) * 0.45);
          if (cause) explained++; else { unexplained++; problems.push(`${tag}: ${key} passa da ${projection} (proiezione) a ${result} (risultato) senza una causa registrata (spostamento del giorno del voto: ${shift}).`); }
        }
        rowsAll.push({ tag, key, projection, poll: poll ?? null, result });
      }
      // the national count is the campaign's: the list the campaign ended on, not another base
      if (national) {
        check(sim.nationalId && sim.nationalType === kind.type, `${tag}: il risultato è quello del voto nazionale (${sim.nationalId}).`);
        for (const [key, share] of Object.entries(sim.lists ?? {})) if (share >= FLOOR && sim.result[key] !== undefined) {
          check(Math.abs(sim.result[key] - share) <= 1.3, `${tag}: il conteggio nazionale dà ${sim.result[key]} a ${key} ma la campagna si è chiusa a ${share}: base diversa.`);
        }
      }
      // the runoff: the head-to-head projection of the finalists against what the finalists got
      if (sim.runoff?.projection) for (const [id, share] of Object.entries(sim.runoff.result)) if (sim.runoff.projection[id] !== undefined) {
        const gap = Math.abs(share - sim.runoff.projection[id]);
        check(gap <= 8, `${tag}: la proiezione del ballottaggio (${sim.runoff.projection[id]}) e il risultato (${share}) distano ${gap.toFixed(1)}.`);
        (summary[kind.id] ??= {}).runoffGaps = [...(summary[kind.id]?.runoffGaps ?? []), gap];
      }
      if (sim.runoff) check(Math.abs(sim.runoff.sum - 100) <= 0.2, `${tag}: i finalisti fanno ${sim.runoff.sum.toFixed(2)}.`);
    }
    const out = { projection: stats(gaps.projection), poll: stats(gaps.poll), pollProjection: stats(gaps.pollProjection), start: stats(gaps.start), mid: stats(gaps.mid), bySize: Object.fromEntries(Object.entries(bySize).map(([name, list]) => [name, list.length ? stats(list) : null])) };
    out.runoff = summary[kind.id]?.runoffGaps ? stats(summary[kind.id].runoffGaps) : null;
    out.withinMargin = r2(withinMargin / (pollRows || 1) * 100);
    out.identical = r2(identical / (pollRows || 1) * 100);
    out.explained = explained; out.unexplained = unexplained;
    check(out.projection.n >= 50, `${kind.id}: pochi confronti proiezione/risultato (${out.projection.n}).`);
    check(out.projection.mae <= limit.mae, `${kind.id}: scarto medio proiezione-risultato ${out.projection.mae} oltre ${limit.mae}.`);
    check(out.projection.p90 <= limit.p90, `${kind.id}: 90° percentile ${out.projection.p90} oltre ${limit.p90}.`);
    check(out.projection.max <= limit.max, `${kind.id}: scarto massimo ${out.projection.max} oltre ${limit.max}.`);
    check(out.projection.median < out.projection.mae * 1.2 + 0.2, `${kind.id}: mediana e media degli scarti non quadrano.`);
    // the poll is an estimate, not the projection and not far from it; the vote is not guaranteed by the poll but the poll is not far from the vote
    check(out.pollProjection.mae >= 0.08, `${kind.id}: il sondaggio è praticamente la proiezione (scarto medio ${out.pollProjection.mae}).`);
    check(out.identical <= 20, `${kind.id}: troppi sondaggi identici alla proiezione (${out.identical}%).`);
    check(out.withinMargin >= 88, `${kind.id}: il sondaggio sta nel margine solo nel ${out.withinMargin}% dei casi.`);
    check(out.poll.mae <= limit.mae * 1.1 + 0.2, `${kind.id}: scarto medio sondaggio-risultato ${out.poll.mae}.`);
    check(out.projection.mae > 0.15, `${kind.id}: il risultato coincide con la proiezione (scarto medio ${out.projection.mae}): il voto non è un'incognita.`);
    // determinism
    check(again.length > 0 && again.every(item => item.same), `${kind.id}: lo stesso seme deve dare gli stessi numeri (${JSON.stringify(again)}).`);
    // what the player does still moves the vote
    const made = pairs.filter(item => item.performed > 0 && Number.isFinite(item.idle.result) && Number.isFinite(item.active.result));
    const uplift = made.map(item => item.active.result - item.idle.result);
    const upliftProjection = made.map(item => item.active.projection - item.idle.projection);
    // (the projection is what the campaign did; the result adds the day of the vote, which is another draw in each of the two races)
    out.actions = { pairs: made.length, uplift: r2(mean(uplift)), upliftProjection: r2(mean(upliftProjection)), positive: made.filter((item, index) => upliftProjection[index] > 0).length };
    check(made.length >= 6, `${kind.id}: servono coppie di campagne con e senza azioni (${made.length}).`);
    check(out.actions.upliftProjection >= (national ? 0.1 : 0.3) && out.actions.positive >= Math.ceil(made.length * 0.7) && out.actions.uplift > 0, `${kind.id}: le azioni del giocatore devono spostare il voto (proiezione ${out.actions.upliftProjection} punti, voto ${out.actions.uplift}, positiva in ${out.actions.positive} coppie su ${made.length}).`);
    summary[kind.id] = { ...(summary[kind.id] ?? {}), ...out, sims: sims.length, rows: gaps.projection.length };
    delete summary[kind.id].runoffGaps;
  }
  if (argv.json) console.log(JSON.stringify(summary, null, 1));
  else {
    console.log('Sondaggi, proiezioni e risultati coerenti — scarti in punti percentuali, forze con proiezione ≥ 5%:');
    for (const kind of kinds) {
      const item = summary[kind.id];
      console.log(`  ${kind.id.padEnd(16)} ${item.sims} simulazioni · proiezione→risultato ${show(item.projection)}`);
      console.log(`  ${''.padEnd(16)} sondaggio→risultato ${show(item.poll)} · sondaggio→proiezione MAE ${item.pollProjection.mae} (nel margine ${item.withinMargin}%; all’inizio ${item.start.mae}, a metà ${item.mid.mae})`);
      console.log(`  ${''.padEnd(16)} per dimensione: ${Object.entries(item.bySize).filter(([, value]) => value).map(([name, value]) => `${name} MAE ${value.mae} p90 ${value.p90} (n=${value.n})`).join(' · ')}${item.runoff ? ` · ballottaggio MAE ${item.runoff.mae} max ${item.runoff.max}` : ''} · azioni: proiezione +${item.actions.upliftProjection}, voto +${item.actions.uplift} punti (${item.actions.positive}/${item.actions.pairs}) · cause registrate ${item.explained}`);
    }
  }
  if (problems.length) {
    console.error(`${problems.length} problemi:\n${problems.slice(0, 40).map(item => `  - ${item}`).join('\n')}${problems.length > 40 ? `\n  … e altri ${problems.length - 40}` : ''}`);
    process.exit(1);
  }
}
