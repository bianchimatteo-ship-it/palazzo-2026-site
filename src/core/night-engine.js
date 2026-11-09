// The election night: twelve hours of a vote that has already been decided.
//
// The result of the vote is calculated once, by the election engine (election-engine.js), when the campaign ends. The night does not recalculate it and does not draw a single number from
// the random sequence of the campaign: it takes the stored result, shares it among simulated counting units (the game has no real polling stations: the units are an invention of the
// simulation and the screen says so) and reveals the units hour after hour. Everything shown at hour h is a pure function of (snapshot, seed, h):
//   - the units are fixed once (a hash of the seed, never Math.random), their votes add up, per group, to the exact votes of the engine, so the partial results are sums of units and the
//     last hour is the engine's result to the vote;
//   - the exit poll, the projections and the seat estimates are estimates and are never built from the units not yet counted (they use the exit poll as the prior of what is still to count);
//   - the news of the night are derived from those figures, stored once when the hour is reached (so a reload or a save does not write them twice) and never touch the career.
// The career is touched once, when the night is concluded (store.concludeElectionNight → the same closeCampaign as before).
import { SEAT_RULES, EUROPEAN_THRESHOLD, ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20261109-5';
import { allocateDHondt, allocateWithBonus } from './election-engine.js?v=20261109-5';

export const NIGHT_HOURS = 12;
export const NIGHT_STAGES = Object.freeze({ finale: 'Esito della consultazione', 'primo-turno': 'Primo turno' });

// ---------- deterministic helpers ----------
export function hash01(text) {
  let h = 2166136261 >>> 0;
  const input = String(text);
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
// Shares `total` (an integer) among the weights, in whole numbers that add up to it (largest remainder; ties go to the lowest index, so the order of the input decides, never chance).
export function apportion(total, weights) {
  const count = weights.length;
  const out = new Array(count).fill(0);
  total = Math.max(0, Math.round(Number(total) || 0));
  if (!count || !total) return out;
  const sum = weights.reduce((acc, value) => acc + Math.max(0, Number(value) || 0), 0);
  if (!(sum > 0)) { for (let i = 0; i < total; i++) out[i % count]++; return out; }
  const exact = weights.map(value => total * Math.max(0, Number(value) || 0) / sum);
  let left = total;
  exact.forEach((value, index) => { out[index] = Math.floor(value); left -= out[index]; });
  exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index).slice(0, left).forEach(item => out[item.index]++);
  return out;
}
const two = value => String(value).padStart(2, '0');

// ---------- when the night starts and how fast the count goes ----------
// The hour at which the polling stations close and the count begins, by kind of vote (the dates of the votes are the ones of the game's calendar; the hours follow the usual practice and are
// told as such: the game does not claim them as the official ones of a given year). The twelve hours of the special start there.
const CLOSE = Object.freeze({
  politiche: { hour: 23, label: 'seggi chiusi alle 23:00' },
  europee: { hour: 23, label: 'seggi chiusi alle 23:00' },
  regionale: { hour: 15, label: 'seggi chiusi alle 15:00 del lunedì' },
  comunale: { hour: 15, label: 'seggi chiusi alle 15:00 del lunedì' },
  provinciale: { hour: 20, label: 'seggi chiusi alle 20:00' },
  ballottaggio: { hour: 15, label: 'seggi chiusi alle 15:00 del lunedì' }
});
// The share of the units counted at the end of each hour (the first hour is the exit poll: the count has not begun). A general or European count is slow, a small council fast.
const CURVES = Object.freeze({
  politiche: [0, .03, .09, .18, .30, .43, .56, .68, .79, .89, .96, 1],
  europee: [0, .02, .08, .17, .28, .41, .55, .68, .80, .90, .97, 1],
  regionale: [0, .06, .15, .27, .41, .55, .68, .79, .88, .95, .99, 1],
  comunale: [0, .08, .20, .35, .50, .64, .76, .86, .93, .97, .99, 1],
  provinciale: [0, .12, .28, .45, .62, .76, .87, .94, .98, 1, 1, 1],
  ballottaggio: [0, .10, .25, .42, .58, .72, .83, .91, .96, .99, 1, 1]
});
export function nightSchedule(electionType, stage = 'finale', runoff = false) {
  const key = runoff ? 'ballottaggio' : electionType;
  return { key, close: CLOSE[key] ?? CLOSE.comunale, curve: CURVES[key] ?? CURVES.comunale };
}
// The wall clock of an hour (1..12): { label: '23:00', dayOffset: 0|1 }.
export function nightClock(night, hour) {
  const start = night.closeHour ?? 23;
  const total = start + hour - 1;
  return { label: `${two(total % 24)}:00`, dayOffset: Math.floor(total / 24) };
}

// ---------- the frozen snapshot of the result ----------
// Taken from the result the election engine stored: the groups with their votes and seats, the areas with their percentages, the totals. It is copied once and never changes.
export function nightSnapshot(campaign, stage) {
  const result = stage === 'finale' ? campaign.result : campaign.firstRoundResult;
  if (!result) return null;
  const playerId = campaign.playerCandidateId;
  const groups = (result.groups ?? []).map(group => ({
    id: group.id, label: group.label ?? group.id, percent: Number(group.percent) || 0, votes: Math.max(0, Math.round(Number(group.votes) || 0)), seats: Math.max(0, Math.round(Number(group.seats) || 0)),
    coalitionId: group.coalitionId ?? null, partyIds: group.partyIds ?? [], isPlayer: group.id === playerId || group.candidateId === playerId || (group.memberCandidateIds ?? []).includes(playerId)
  }));
  // In a vote for lists the percentages of the engine are on all the valid votes, "Altri" included, while the votes of the rows add up to the listed lists only: the rest is told as «Altri»,
  // with the votes that make the percentages of the engine come out (so the partial and the final percentages are the engine's, not a different base).
  const sumPercent = groups.reduce((sum, group) => sum + group.percent, 0);
  if (sumPercent > 0 && 100 - sumPercent > 0.05 && sumPercent < 99.95) {
    const listed = groups.reduce((sum, group) => sum + group.votes, 0);
    groups.push({ id: 'altri', label: 'Altri', percent: Math.round((100 - sumPercent) * 100) / 100, votes: Math.max(0, Math.round(listed * 100 / sumPercent) - listed), seats: 0, coalitionId: null, partyIds: [], isPlayer: false, others: true });
  }
  const areas = (result.territories ?? []).map(area => ({
    id: area.territoryId, name: area.name, weight: Math.max(0, Number(area.weight) || 0), pct: Object.fromEntries((area.groups ?? []).map(row => [row.id, Number(row.percent) || 0]))
  }));
  const waves = Array.isArray(campaign.polls) ? campaign.polls : (campaign.polls?.waves ?? []);
  const lastWave = [...waves].reverse().find(wave => Array.isArray(wave?.average) && wave.average.length) ?? null;
  const poll = lastWave ? Object.fromEntries(lastWave.average.map(row => [row[0], Number(row[1]) || 0])) : {};
  const type = campaign.electionType;
  const threshold = type === 'europee' ? EUROPEAN_THRESHOLD.percent : (SEAT_RULES[type]?.threshold ?? 0);
  const seatTotal = groups.reduce((sum, group) => sum + group.seats, 0);
  // The rule that turns votes into seats, taken from the same tables the election engine uses (campaign-rules.js): the night applies it to the shares of the hour (never to the final seats).
  const band = campaign.municipalityBand ?? 'fino-15000';
  const model = ELECTION_MODELS[type];
  const seatCount = type === 'politiche' ? (campaign.candidacy?.role === 'senatore' ? 200 : 400) : type === 'comunale' ? (band === 'oltre-15000' ? 16 : 12) : model?.seatCount ?? seatTotal;
  const rule = !seatTotal ? null : type === 'comunale' ? { kind: 'bonus', seatCount, bonus: SEAT_RULES.comunale.majorityBonus[band], threshold: band === 'oltre-15000' ? SEAT_RULES.comunale.threshold : 0 }
    : type === 'provinciale' ? { kind: 'bonus', seatCount, bonus: SEAT_RULES.provinciale.majorityBonus, threshold: 0 }
    : type === 'regionale' ? { kind: 'bonus', seatCount, bonus: SEAT_RULES.regionale.majorityBonus, threshold: SEAT_RULES.regionale.threshold }
    : type === 'politiche' ? { kind: 'politiche', seatCount, uninominal: Math.round(seatCount * .37), threshold: SEAT_RULES.politiche.threshold }
    : { kind: 'europee', seatCount, threshold: EUROPEAN_THRESHOLD.percent };
  const electorate = result.electorate ?? {};
  return {
    stage, electionType: type, electionLabel: campaign.electionLabel ?? 'Elezione', runoff: stage === 'finale' && Boolean(campaign.firstRoundResult?.requiresRunoff), groups, areas,
    totalVotes: groups.reduce((sum, group) => sum + group.votes, 0), voters: Math.round(Number(electorate.voters) || 0), electors: Math.round(Number(electorate.electors) || 0),
    turnout: Number.isFinite(Number(result.turnout)) ? Number(result.turnout) : Number(electorate.turnout) || null, basis: electorate.basis ?? '',
    threshold, seatTotal, rule, majority: seatTotal ? Math.floor(seatTotal / 2) + 1 : 0, seatNote: result.seatRule ?? SEAT_RULES[type]?.note ?? null,
    poll, requiresRunoff: Boolean(result.requiresRunoff), runoffIds: result.runoffCandidateIds ?? [], winnerGroupId: result.winnerGroupId ?? null,
    playerGroupId: groups.find(group => group.isPlayer)?.id ?? null, outcome: stage === 'finale' ? (result.outcome ?? null) : null, personalMandate: stage === 'finale' ? Boolean(result.personalMandate) : null,
    objectiveMet: stage === 'finale' ? Boolean(result.objectiveMet) : null
  };
}

export function createNight(campaign, stage) {
  const snapshot = nightSnapshot(campaign, stage);
  if (!snapshot) return null;
  const schedule = nightSchedule(snapshot.electionType, stage, stage === 'finale' ? Boolean(campaign.firstRoundResult) : false);
  const night = {
    id: `notte-${campaign.id}-${stage}`, key: `${campaign.id}:${stage}`, stage, campaignId: campaign.id, electionType: snapshot.electionType, electionLabel: snapshot.electionLabel,
    electionDate: campaign.electionDate ?? campaign.currentDate, seed: `${campaign.seed ?? campaign.id}|${campaign.id}|${stage}`, closeHour: schedule.close.hour, closeLabel: schedule.close.label,
    hour: 0, snapshot, feed: [], statements: [], concluded: false, startedOn: campaign.currentDate
  };
  return advanceNight(night, { first: true });
}

// ---------- the counting units ----------
const cache = new WeakMap();
// The units: for each group, its votes are shared among the areas by (weight × the area percentage), then each area's votes among its units; whole numbers that add up, per group, to the
// engine's votes of the group. The votes of a unit are the sum of its groups' votes. The order in which the units are counted comes from a hash of the seed.
export function nightTally(night) {
  if (cache.has(night.snapshot)) return cache.get(night.snapshot);
  const { snapshot, seed } = night;
  const groups = snapshot.groups;
  const areas = snapshot.areas.length ? snapshot.areas : [{ id: 'totale', name: snapshot.electionLabel, weight: 1, pct: {} }];
  const perArea = Math.max(3, Math.min(24, Math.round(96 / areas.length)));
  const weightSum = areas.reduce((sum, area) => sum + (area.weight || 1), 0) || 1;
  const natPct = Object.fromEntries(groups.map(group => [group.id, group.percent]));
  const matrix = groups.map(group => apportion(group.votes, areas.map(area => (area.weight || 1) / weightSum * Math.max(.02, area.pct[group.id] ?? natPct[group.id] * (.7 + hash01(`${seed}|fb|${group.id}|${area.id}`) * .6)))));
  const units = [];
  areas.forEach((area, areaIndex) => {
    const sizes = Array.from({ length: perArea }, (_, index) => .6 + hash01(`${seed}|size|${area.id}|${index}`) * .8);
    const votesByGroup = groups.map((group, groupIndex) => apportion(matrix[groupIndex][areaIndex], sizes.map((size, index) => size * Math.exp((hash01(`${seed}|dev|${group.id}|${area.id}|${index}`) - .5) * .42))));
    const phase = hash01(`${seed}|phase|${area.id}`);
    for (let index = 0; index < perArea; index++) {
      const votes = groups.map((_, groupIndex) => votesByGroup[groupIndex][index]);
      units.push({ id: `${area.id}#${index + 1}`, areaIndex, areaId: area.id, votes, ballots: votes.reduce((sum, value) => sum + value, 0), key: hash01(`${seed}|order|${area.id}|${index}`) * .65 + phase * .35 });
    }
  });
  units.sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));
  units.forEach((unit, order) => { unit.order = order; });
  const tally = { groups, areas, units, perArea };
  cache.set(snapshot, tally);
  return tally;
}

// How many units are counted at the end of the hour.
export function countedAt(night, hour) {
  const tally = nightTally(night);
  const curve = nightSchedule(night.snapshot.electionType, night.stage, night.snapshot.runoff).curve;
  const fraction = curve[Math.max(0, Math.min(NIGHT_HOURS, hour)) - 1] ?? 0;
  if (hour >= NIGHT_HOURS) return tally.units.length;
  return Math.min(tally.units.length, Math.floor(tally.units.length * fraction));
}

// ---------- what the night shows at an hour ----------
export function nightView(night, hour = night.hour) {
  const tally = nightTally(night);
  const { snapshot } = night;
  const counted = countedAt(night, hour);
  const sums = tally.groups.map(() => 0);
  const areaSums = tally.areas.map(() => tally.groups.map(() => 0));
  const areaUnits = tally.areas.map(() => ({ counted: 0, total: 0 }));
  let ballots = 0;
  for (const unit of tally.units) {
    areaUnits[unit.areaIndex].total++;
    if (unit.order >= counted) continue;
    areaUnits[unit.areaIndex].counted++;
    ballots += unit.ballots;
    unit.votes.forEach((value, index) => { sums[index] += value; areaSums[unit.areaIndex][index] += value; });
  }
  const complete = counted >= tally.units.length;
  const rows = tally.groups.map((group, index) => ({ id: group.id, label: group.label, coalitionId: group.coalitionId, isPlayer: group.isPlayer, votes: sums[index], percent: ballots ? round2(sums[index] * 100 / ballots) : 0, final: complete }))
    .sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label));
  rows.forEach((row, index) => { row.position = index + 1; });
  const areaRows = tally.areas.map((area, areaIndex) => {
    const total = areaSums[areaIndex].reduce((sum, value) => sum + value, 0);
    const order = tally.groups.map((group, index) => ({ id: group.id, label: group.label, votes: areaSums[areaIndex][index] })).sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label));
    const state = areaUnits[areaIndex].counted === 0 ? 'attesa' : areaUnits[areaIndex].counted >= areaUnits[areaIndex].total ? 'completo' : 'in-corso';
    const gap = total && order[1] ? round2((order[0].votes - order[1].votes) * 100 / total) : null;
    return { id: area.id, name: area.name, weight: area.weight, byGroup: areaSums[areaIndex], counted: areaUnits[areaIndex].counted, units: areaUnits[areaIndex].total, state, ballots: total, leaderId: total ? order[0].id : null, leaderLabel: total ? order[0].label : null, gap,
      top: order.slice(0, 3).map(item => ({ id: item.id, label: item.label, votes: item.votes, percent: total ? round2(item.votes * 100 / total) : 0 })) };
  });
  return { hour, counted, units: tally.units.length, shareCounted: tally.units.length ? counted / tally.units.length : 0, ballots, rows, areas: areaRows, complete };
}

// The exit poll: an estimate made on the day, with a margin; derived from the true shares by a hash (never from the count) and normalised to 100. It is shown at the first hour and stays on record.
export function exitPoll(night) {
  const { snapshot, seed } = night;
  const rows = snapshot.groups.filter(group => group.percent > 0).map(group => ({ id: group.id, label: group.label, isPlayer: group.isPlayer,
    percent: Math.max(0, group.percent + (hash01(`${seed}|exit|${group.id}`) - .5) * 2 * (.3 + .35 * Math.sqrt(group.percent))), margin: round1(.7 + .3 * Math.sqrt(group.percent)) }));
  const total = rows.reduce((sum, row) => sum + row.percent, 0) || 1;
  rows.forEach(row => { row.percent = round1(row.percent * 100 / total); });
  return rows.sort((a, b) => b.percent - a.percent || a.label.localeCompare(b.label));
}

// The projection: what the counted units say, completed with the exit poll where nothing is counted yet. It is an estimate, with a margin that shrinks with the count; it never reads
// the units that are still to count, nor the final votes or seats. At the last hour (count closed) it IS the official result: the same percentages and seats, never a second figure.
// Seats come from the rule of the vote (snapshot.rule: the same tables and allocation functions as the election engine) applied to the projected shares and, for the general and European
// votes, to the projected winner and shares of each area.
export function projection(night, view = nightView(night)) {
  const tally = nightTally(night);
  const { snapshot } = night;
  if (view.complete) {
    const rows = view.rows.map(row => ({ id: row.id, label: row.label, isPlayer: row.isPlayer, coalitionId: row.coalitionId, percent: row.percent, seats: snapshot.groups.find(group => group.id === row.id)?.seats ?? 0, margin: 0, official: true }));
    return { rows, margin: 0, estimate: false, official: true, seatTotal: snapshot.seatTotal, majority: snapshot.majority };
  }
  const exit = exitPoll(night);
  const exitBy = Object.fromEntries(exit.map(row => [row.id, row.percent]));
  const prior = id => exitBy[id] ?? 0;
  let weightSum = 0;
  const acc = Object.fromEntries(tally.groups.map(group => [group.id, 0]));
  const areaShares = [];
  view.areas.forEach(area => {
    const w = area.weight || 1;
    weightSum += w;
    const trust = Math.min(1, area.counted / Math.max(1, area.units) * 1.6);
    const shares = {};
    tally.groups.forEach((group, index) => {
      const share = area.ballots ? area.byGroup[index] * 100 / area.ballots : prior(group.id);
      shares[group.id] = share * trust + prior(group.id) * (1 - trust);
      acc[group.id] += w * shares[group.id];
    });
    areaShares.push({ id: area.id, name: area.name, weight: w, shares });
  });
  const margin = round1(.35 + 3.2 * Math.sqrt(Math.max(0, 1 - view.shareCounted)) * (view.shareCounted === 0 ? 1 : .85));
  const rows = tally.groups.map(group => ({ id: group.id, label: group.label, isPlayer: group.isPlayer, coalitionId: group.coalitionId, percent: weightSum ? round1(acc[group.id] / weightSum) : 0 }));
  const total = rows.reduce((sum, row) => sum + row.percent, 0) || 1;
  rows.forEach(row => { row.percent = round1(row.percent * 100 / total); });
  rows.sort((a, b) => b.percent - a.percent || a.label.localeCompare(b.label));
  const seats = snapshot.rule ? projectSeats(snapshot, Object.fromEntries(rows.map(row => [row.id, row.percent])), areaShares) : {};
  rows.forEach(row => { row.seats = seats[row.id] ?? 0; row.margin = margin; });
  return { rows, margin, estimate: true, official: false, seatTotal: snapshot.seatTotal, majority: snapshot.majority };
}

// Seats from shares, by the rule of the vote. `nat`: projected percentage of each group; `areas`: [{ id, weight, shares }] projected by area.
export function projectSeats(snapshot, nat, areas = []) {
  const rule = snapshot.rule;
  const out = {};
  if (!rule) return out;
  const listed = snapshot.groups.filter(group => !group.others).map(group => ({ id: group.id, share: nat[group.id] ?? 0 }));
  const top = [...listed].sort((a, b) => b.share - a.share || a.id.localeCompare(b.id))[0];
  if (rule.kind === 'bonus') {
    for (const row of allocateWithBonus(listed, rule.seatCount, top?.id, rule.bonus, rule.threshold)) out[row.id] = row.seats;
    return out;
  }
  const weightSum = areas.reduce((sum, area) => sum + area.weight, 0) || 1;
  const quotas = (count, scale) => {
    const exact = areas.map(area => ({ area, seats: count * area.weight / scale }));
    const assigned = exact.map(item => ({ ...item, count: Math.floor(item.seats) }));
    let remaining = count - assigned.reduce((sum, item) => sum + item.count, 0);
    const order = [...assigned].sort((a, b) => (b.seats - Math.floor(b.seats)) - (a.seats - Math.floor(a.seats)) || a.area.id.localeCompare(b.area.id));
    for (let i = 0; i < remaining && order.length; i++) order[i % order.length].count++;
    return assigned;
  };
  const listedIds = new Set(listed.map(group => group.id));
  const areaOrder = area => Object.entries(area.shares).filter(([id]) => listedIds.has(id)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (rule.kind === 'politiche') {
    for (const item of quotas(rule.uninominal, weightSum)) { const winner = areaOrder(item.area)[0]?.[0]; if (winner) out[winner] = (out[winner] ?? 0) + item.count; }
    for (const row of allocateDHondt(listed, rule.seatCount - rule.uninominal, rule.threshold)) out[row.id] = (out[row.id] ?? 0) + row.seats;
    return out;
  }
  const eligible = new Set(listed.filter(group => group.share >= rule.threshold).map(group => group.id));
  for (const item of quotas(rule.seatCount, 100)) {
    const rows = Object.entries(item.area.shares).filter(([id]) => eligible.has(id)).map(([id, share]) => ({ id, share }));
    for (const row of allocateDHondt(rows, item.count, 0)) out[row.id] = (out[row.id] ?? 0) + row.seats;
  }
  return out;
}
// ---------- the news ----------
const fmt = (template, ...args) => { let index = 0; return template.replace(/\{\}/g, () => String(args[index++] ?? '')); };
const pc = value => `${String(round1(value)).replace('.', ',')}%`;
const n0 = value => Math.round(value).toLocaleString('it-IT');
const SPEAKER_OF = view => (view.rows[0]?.label ?? '');

function leadItem(night, hour, view, prev, proj, ctx) {
  const { snapshot } = night;
  const [first, second, third] = view.rows;
  const clock = nightClock(night, hour).label;
  const lead = first ? `${first.label} ${pc(first.percent)}` : '';
  switch (hour) {
    case 1: {
      const exit = exitPoll(night);
      const turnout = 'L’affluenza definitiva sarà nota a scrutinio concluso.';
      return { kind: 'speciale', tag: 'EXIT POLL', text: fmt('Si apre lo speciale elettorale: {}. {} Exit poll (stima, non è un risultato): {} {}, {} {}, {} {}.', night.closeLabel, turnout, exit[0]?.label ?? '', pc(exit[0]?.percent ?? 0), exit[1]?.label ?? '', pc(exit[1]?.percent ?? 0), exit[2]?.label ?? '', pc(exit[2]?.percent ?? 0)).replace(/\s+/g, ' ') };
    }
    case 2: return { kind: 'speciale', tag: 'SCRUTINIO', text: fmt('Primi dati dallo scrutinio: {} unità su {} contate. In testa {} ({}).', view.counted, view.units, first?.label ?? '', pc(first?.percent ?? 0)) };
    case 3: return { kind: 'speciale', tag: 'SCRUTINIO', text: fmt('Aggiornamento: {}, {}, {}. Territori già assegnati: {}.', lead, second ? `${second.label} ${pc(second.percent)}` : '', third ? `${third.label} ${pc(third.percent)}` : '', view.areas.filter(area => area.state === 'completo').length) };
    case 4: {
      const ref = snapshot.poll[first?.id];
      return { kind: 'speciale', tag: 'SONDAGGI', text: ref !== undefined ? fmt('Confronto con gli ultimi sondaggi: {} è al {} contro il {} della vigilia.', first.label, pc(proj.rows[0]?.percent ?? first.percent), pc(ref)) : fmt('Mappe e proiezioni aggiornate: {} resta in testa.', first?.label ?? '') };
    }
    case 5: return snapshot.seatTotal ? { kind: 'speciale', tag: 'PROIEZIONE', text: fmt('Primi scenari sui seggi (stima): {} verso {} seggi su {}; la maggioranza è a {}.', proj.rows[0]?.label ?? '', n0(proj.rows[0]?.seats ?? 0), snapshot.seatTotal, snapshot.majority) }
      : { kind: 'speciale', tag: 'PROIEZIONE', text: fmt('Primi scenari (stima): {} in testa con {}.', proj.rows[0]?.label ?? '', pc(proj.rows[0]?.percent ?? 0)) };
    case 6: {
      const tight = [...view.areas].filter(area => area.gap !== null && area.state !== 'attesa').sort((a, b) => a.gap - b.gap)[0];
      return tight ? { kind: 'speciale', tag: 'TERRITORI', text: fmt('Territori decisivi: {} è in bilico, {} e {} separati da {} punti.', tight.name, tight.top[0]?.label ?? '', tight.top[1]?.label ?? '', String(tight.gap).replace('.', ',')) }
        : { kind: 'speciale', tag: 'TERRITORI', text: fmt('Lo scrutinio prosegue: {} unità su {}.', view.counted, view.units) };
    }
    case 7: {
      const was = ctx.history.find(item => item.hour === 5)?.proj ?? null;
      const mover = was ? [...proj.rows].map(row => ({ row, d: row.percent - (was.find(item => item.id === row.id)?.percent ?? row.percent) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0] : null;
      return mover && Math.abs(mover.d) >= .2 ? { kind: 'speciale', tag: 'PROIEZIONE', text: fmt(mover.d > 0 ? 'Cambia la proiezione: {} sale di {} punti rispetto a due ore fa.' : 'Cambia la proiezione: {} scende di {} punti rispetto a due ore fa.', mover.row.label, String(round1(Math.abs(mover.d))).replace('.', ',')) }
        : { kind: 'speciale', tag: 'PROIEZIONE', text: fmt('Nuovi risultati: {} unità su {} contate, le proiezioni restano stabili.', view.counted, view.units) };
    }
    case 8: {
      const blocs = blocTotals(proj, snapshot);
      return blocs.length > 1 ? { kind: 'speciale', tag: 'GOVERNO', text: fmt('Scenari di governo (stima): lo schieramento di {} ha {} seggi su {}, quello di {} ne ha {}.', blocs[0].label, n0(blocs[0].seats), snapshot.seatTotal, blocs[1].label, n0(blocs[1].seats)) }
        : { kind: 'speciale', tag: 'SCRUTINIO', text: fmt('Scrutinio avanzato: {} unità su {}; {} guida con {}.', view.counted, view.units, first?.label ?? '', pc(first?.percent ?? 0)) };
    }
    case 9: return { kind: 'speciale', tag: 'CLASSIFICHE', text: fmt('Classifiche: {}, {}, {}. Territori completati: {} su {}.', lead, second ? `${second.label} ${pc(second.percent)}` : '', third ? `${third.label} ${pc(third.percent)}` : '', view.areas.filter(area => area.state === 'completo').length, view.areas.length) };
    case 10: {
      if (snapshot.requiresRunoff && first && second) return { kind: 'speciale', tag: 'BALLOTTAGGIO', text: first.percent < 50 ? fmt('Risultati quasi completi: nessuno supera il 50%, il ballottaggio tra {} e {} è vicino.', first.label, second.label) : fmt('Risultati quasi completi: {} supera il 50%.', first.label) };
      return { kind: 'speciale', tag: 'MAGGIORANZE', text: snapshot.seatTotal ? fmt('Risultati quasi completi: {} stimato a {} seggi, soglia di maggioranza {}.', proj.rows[0]?.label ?? '', n0(proj.rows[0]?.seats ?? 0), snapshot.majority) : fmt('Risultati quasi completi: {} in testa con {}.', first?.label ?? '', pc(first?.percent ?? 0)) };
    }
    case 11: return { kind: 'speciale', tag: 'ULTIME', text: fmt('Ultimi aggiornamenti: {} unità su {}. {} è al {}.', view.counted, view.units, first?.label ?? '', pc(first?.percent ?? 0)) };
    default: return { kind: 'chiusura', tag: 'RISULTATO', text: snapshot.requiresRunoff && night.stage === 'primo-turno' ? fmt('Scrutinio chiuso alle {}. Al ballottaggio vanno {} e {}.', clock, rowLabel(snapshot, snapshot.runoffIds[0]), rowLabel(snapshot, snapshot.runoffIds[1])) : fmt('Scrutinio chiuso alle {}. Risultato definitivo: {} ({}).', clock, first?.label ?? '', pc(first?.percent ?? 0)) };
  }
}
const rowLabel = (snapshot, id) => snapshot.groups.find(group => group.id === id)?.label ?? '';
function blocTotals(proj, snapshot) {
  const map = new Map();
  for (const row of proj.rows) {
    const key = row.coalitionId ?? row.id;
    const slot = map.get(key) ?? { label: row.label, seats: 0, percent: 0 };
    slot.seats += row.seats; slot.percent += row.percent; map.set(key, slot);
  }
  return [...map.values()].sort((a, b) => b.seats - a.seats || b.percent - a.percent);
}

// Events derived from the figures of the hour. Each one is told once: the `seen` ids are stored with the feed.
function eventItems(night, hour, view, prev, proj, ctx) {
  const out = [];
  const { snapshot } = night;
  const seen = ctx.seen;
  const once = (id, item) => { if (!seen.has(id)) { seen.add(id); out.push({ ...item, id: `${night.id}-h${hour}-${id}` }); } };
  if (hour >= 2 && prev && prev.rows[0] && view.rows[0] && prev.rows[0].id !== view.rows[0].id && prev.counted > 0) once(`lead-${view.rows[0].id}`, { kind: 'notizia', tag: 'SORPASSO', text: fmt('Cambia la testa della corsa: {} supera {}.', view.rows[0].label, prev.rows[0].label) });
  if (hour >= 3 && prev) {
    const flipped = view.areas.map(area => ({ area, was: prev.areas.find(item => item.id === area.id) })).filter(({ area, was }) => was?.leaderId && area.leaderId && was.leaderId !== area.leaderId && was.counted > 0).sort((a, b) => b.area.weight - a.area.weight)[0];
    if (flipped) once(`ribaltamento-${flipped.area.id}-${flipped.area.leaderId}`, { kind: 'notizia', tag: 'RIBALTAMENTO', text: fmt('Ribaltamento a {}: {} supera {} con lo scrutinio che avanza.', flipped.area.name, flipped.area.leaderLabel, flipped.was.leaderLabel) });
  }
  const counting = view.areas.filter(area => area.state === 'completo');
  const prevDone = new Set(prev ? prev.areas.filter(area => area.state === 'completo').map(area => area.id) : []);
  const fresh = counting.filter(area => !prevDone.has(area.id)).sort((a, b) => b.weight - a.weight);
  const nationalLeader = view.rows[0]?.id;
  const surprise = fresh.find(area => area.leaderId && area.leaderId !== nationalLeader);
  const showcase = surprise ?? fresh[0];
  if (hour >= 3 && showcase) once(`area-${showcase.id}`, surprise ? { kind: 'notizia', tag: 'SORPRESA', text: fmt('Sorpresa a {}: vince {} con {}, mentre a livello generale è avanti {}.', showcase.name, showcase.leaderLabel, pc(showcase.top[0]?.percent ?? 0), view.rows[0]?.label ?? '') }
    : { kind: 'notizia', tag: 'TERRITORIO', text: fmt('{} assegnato: {} prima con {}.', showcase.name, showcase.leaderLabel, pc(showcase.top[0]?.percent ?? 0)) });
  if (snapshot.threshold > 0 && hour >= 3) {
    for (const row of proj.rows) {
      if (row.percent >= .5 && Math.abs(row.percent - snapshot.threshold) <= Math.max(.6, proj.margin)) {
        once(`soglia-${row.id}-${row.percent >= snapshot.threshold ? 'su' : 'giu'}`, { kind: 'notizia', tag: 'SOGLIA', text: row.percent >= snapshot.threshold ? fmt('{} sopra la soglia del {}%: stima {}.', row.label, snapshot.threshold, pc(row.percent)) : fmt('{} rischia di non superare la soglia del {}%: stima {}.', row.label, snapshot.threshold, pc(row.percent)) });
        break;
      }
    }
  }
  if (snapshot.seatTotal && hour >= 5) {
    const top = proj.rows[0];
    const bloc = blocTotals(proj, snapshot)[0];
    if (bloc && bloc.seats >= snapshot.majority) once(`maggioranza-${bloc.label}`, { kind: 'notizia', tag: 'MAGGIORANZA', text: fmt('{} supera la soglia della maggioranza: stima {} seggi su {}.', bloc.label, n0(bloc.seats), snapshot.seatTotal) });
    else if (top && hour >= 8 && bloc && bloc.seats < snapshot.majority) once('nessuna-maggioranza', { kind: 'notizia', tag: 'MAGGIORANZA', text: fmt('Nessuno schieramento raggiunge i {} seggi: servirebbero alleanze.', snapshot.majority) });
  }
  if (hour >= 4 && prev) {
    const prevProj = ctx.history.at(-1)?.proj;
    const climber = prevProj ? proj.rows.map(row => ({ row, d: row.percent - (prevProj.find(item => item.id === row.id)?.percent ?? row.percent) })).sort((a, b) => b.d - a.d)[0] : null;
    if (climber && climber.d >= 0.8) once(`rimonta-${climber.row.id}`, { kind: 'notizia', tag: 'RIMONTA', text: fmt('{} in rimonta: la stima sale di {} punti nell’ultima ora.', climber.row.label, String(round1(climber.d)).replace('.', ',')) });
  }
  if (snapshot.requiresRunoff && hour >= 8 && view.rows[0] && view.rows[0].percent < 50 && !snapshot.runoffDone) once('ballottaggio-probabile', { kind: 'notizia', tag: 'BALLOTTAGGIO', text: fmt('Ballottaggio probabile: {} è sotto il 50% ({}).', view.rows[0].label, pc(view.rows[0].percent)) });
  return out;
}

// Declarations of the leaders and the parties, taken from the standing of the hour.
function declarationItems(night, hour, view, proj) {
  const { snapshot } = night;
  const out = [];
  const [first, second] = view.rows;
  const make = (id, who, quote, tag = 'DICHIARAZIONE') => out.push({ id: `${night.id}-h${hour}-${id}`, kind: 'dichiarazione', tag, who, text: quote });
  if (hour === 2 && first) make('d-lead', first.label, fmt('{}: «Il risultato è incoraggiante, ma aspettiamo i dati definitivi.»', first.label));
  if (hour === 6 && second) make('d-second', second.label, fmt('{}: «La partita non è chiusa: molte unità importanti devono ancora essere scrutinate.»', second.label));
  if (hour === 9 && first) make('d-comment', first.label, fmt('Commento a caldo: «{} ha preso un vantaggio che appare solido.»', first.label));
  const risk = proj.rows.find(row => snapshot.threshold > 0 && row.percent > 0.5 && row.percent < snapshot.threshold + .6 && hour >= 6);
  if (risk && hour === 7) make('d-soglia', risk.label, fmt('{}: «Siamo vicini alla soglia, ogni unità conta.»', risk.label));
  if (hour === 12 && first) make('d-final', first.label, fmt('{}: «Ringraziamo gli elettori per la fiducia.»', first.label));
  if (hour === 12 && second && second.id !== first?.id) make('d-final2', second.label, fmt('{}: «Prendiamo atto del risultato e continuiamo a lavorare.»', second.label));
  return out;
}

// What the player may say at an hour: the prompt (it does not block the night) and its replies.
export const STATEMENT_PROMPTS = Object.freeze({
  3: { id: 'dichiarazione-3', text: 'I primi dati sono arrivati. Cosa dici ai giornalisti?', choices: [['sobria', 'Aspettiamo i dati: è presto per commentare.'], ['fiduciosa', 'Siamo fiduciosi: il lavoro fatto in campagna sta pagando.'], ['attacco', 'Gli avversari cantano vittoria troppo presto: aspettiamo gli elettori.']] },
  7: { id: 'dichiarazione-7', text: 'Lo scrutinio è a metà. Quale messaggio affidi alle telecamere?', choices: [['sobria', 'Seguiamo il conteggio con rispetto per il voto di tutti.'], ['fiduciosa', 'Le nostre proposte hanno parlato agli elettori.'], ['attacco', 'Chi ha promesso troppo oggi deve fare i conti con la realtà.']] },
  11: { id: 'dichiarazione-11', text: 'Il quadro è quasi definito. Cosa dichiari?', choices: [['sobria', 'Attendiamo il dato finale e ringraziamo chi ha votato.'], ['fiduciosa', 'Quale che sia l’esito, andiamo avanti con le nostre idee.'], ['attacco', 'Chiediamo chiarezza e serietà a chi ha vinto e a chi ha perso.']] }
});
export const statementPromptFor = hour => STATEMENT_PROMPTS[hour] ?? null;

// ---------- advancing ----------
// Moves the night to the next hour (or opens it): the news of the hour are generated once and stored. Nothing here touches the career.
export function advanceNight(night, { first = false } = {}) {
  if (night.concluded) return night;
  const hour = first ? 1 : night.hour + 1;
  if (hour > NIGHT_HOURS) return night;
  const view = nightView(night, hour);
  const prev = hour > 1 ? nightView(night, hour - 1) : null;
  const proj = projection(night, view);
  const history = Array.from({ length: Math.max(0, hour - 1) }, (_, index) => { const h = index + 1; return { hour: h, proj: projection(night, nightView(night, h)).rows.map(row => ({ id: row.id, percent: row.percent })) }; });
  const seen = new Set(night.feed.map(item => item.seenKey).filter(Boolean));
  const lead = leadItem(night, hour, view, prev, proj, { history });
  const events = eventItems(night, hour, view, prev, proj, { seen, history });
  const declarations = declarationItems(night, hour, view, proj);
  const clock = nightClock(night, hour).label;
  const items = [{ ...lead, id: `${night.id}-h${hour}-0` }, ...events, ...declarations].map(item => ({ ...item, hour, time: clock, seenKey: item.id.replace(`${night.id}-h${hour}-`, '') }));
  return { ...night, hour, feed: [...night.feed, ...items] };
}

// An answer of the player to a prompt: stored once, with the reply in the feed.
export function answerStatement(night, promptId, choiceId) {
  const prompt = Object.values(STATEMENT_PROMPTS).find(item => item.id === promptId);
  if (!prompt || night.concluded || night.statements.some(item => item.id === promptId)) return night;
  const choice = prompt.choices.find(([id]) => id === choiceId);
  if (!choice) return night;
  const hour = night.hour;
  const item = { id: `${night.id}-${promptId}`, kind: 'giocatore', tag: 'TU', who: 'giocatore', hour, time: nightClock(night, hour).label, text: choice[1], seenKey: promptId };
  return { ...night, statements: [...night.statements, { id: promptId, hour, choice: choice[0], text: choice[1] }], feed: [...night.feed, item] };
}
export function pendingPrompts(night) {
  return Object.entries(STATEMENT_PROMPTS).filter(([hour, prompt]) => Number(hour) <= night.hour && !night.statements.some(item => item.id === prompt.id)).map(([hour, prompt]) => ({ ...prompt, hour: Number(hour) }));
}

// The check that the night is consistent with the result it was built from (used by the tests and by the store before it concludes).
export function nightConsistency(night) {
  const { snapshot } = night;
  const tally = nightTally(night);
  const problems = [];
  snapshot.groups.forEach((group, index) => {
    const sum = tally.units.reduce((acc, unit) => acc + unit.votes[index], 0);
    if (sum !== group.votes) problems.push(`${group.label}: ${sum} ≠ ${group.votes}`);
  });
  const last = nightView(night, NIGHT_HOURS);
  if (last.ballots !== snapshot.totalVotes) problems.push(`totale ${last.ballots} ≠ ${snapshot.totalVotes}`);
  let before = -1;
  for (let hour = 1; hour <= NIGHT_HOURS; hour++) { const view = nightView(night, hour); if (view.ballots < before) problems.push(`i voti calano all’ora ${hour}`); before = view.ballots; }
  return problems;
}
