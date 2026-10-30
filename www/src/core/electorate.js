// The count of a vote: four quantities that are never the same thing.
//   - residents: the resident population of the territory (ISTAT, 1 January 2026; for a province, a region or Italy it is the sum of the comuni it includes, without duplicates);
//   - electors: who can vote. For the general election and the regional ones it is the register of the last real general election (the map); for a comune, where the data hold no
//     register, it is a SIMULATED electorate: a share of the residents (ELIGIBLE_SHARE, a declared assumption of the game, not a datum);
//   - voters: who went to the polls (electors × turnout, with the noise of a small electorate), never more than the electors and never more than the residents;
//   - ballots (valid votes): voters × the share of valid ballots, never more than the voters.
// The votes of the lists are the valid ballots shared among the lists, in whole numbers that add up to them exactly (largest remainder). Without demographic data (the file is not
// loaded, or the territory is not in it) the count falls back to a declared scale of 100,000 ballots: percentages only, never presented as voters. A second-level vote (the province:
// the mayors and the councillors vote, with weights) is also a scale, never the population.
import { residentsOfItaly, residentsOfMunicipality, residentsOfRegion, populationReferenceDate } from './municipal-rules.js?v=20261030-1';

export const ELIGIBLE_SHARE = 0.82;
export const SCALE = 100000;
// The turnout that really came out of a count: voters over electors, never over 100 and not defined without electors. The turnout asked of the simulation (`turnout`) is only a target: the
// demographic ceilings (residents) and the noise of a small electorate can move the real one.
export const actualTurnout = (electors, voters) => Number(electors) > 0 && Number.isFinite(Number(voters)) ? Math.min(100, Math.round(Number(voters) / Number(electors) * 10000) / 100) : null;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The resident population behind a campaign: { residents, referenceDate, scope } or null when the data do not hold it.
export function populationOf(campaign) {
  const type = campaign?.electionType;
  const place = campaign?.electorate?.place ?? campaign?.context?.place ?? {};
  const date = populationReferenceDate();
  if (type === 'comunale') { const residents = residentsOfMunicipality(place.municipalityCode ?? campaign?.municipalityCode); return residents === null ? null : { residents, referenceDate: date ?? '2026-01-01', scope: 'comune' }; }
  if (type === 'regionale') { const residents = residentsOfRegion(place.region); return residents === null ? null : { residents, referenceDate: date ?? '2026-01-01', scope: 'regione' }; }
  if (type === 'politiche' || type === 'europee') { const residents = residentsOfItaly(); return residents === null ? null : { residents, referenceDate: date ?? '2026-01-01', scope: 'italia' }; }
  return null;
}

// The scale used when there is nothing to count people with.
const scaled = (turnout, kind, reason, residents = null) => ({ kind, residents, electors: null, voters: null, ballots: SCALE, valid: null, invalid: null, turnout, validRatio: null, normalized: true, scale: SCALE, basis: reason, source: 'simulation' });

// The count of one vote. `normal` draws the noise of the day; `turnout` is a percentage.
export function countBallots(campaign, { turnout, normal }) {
  const type = campaign.electionType;
  const given = campaign.electorate ?? {};
  const population = populationOf(campaign);
  if (type === 'provinciale') return scaled(turnout, 'secondo-livello', 'Voto di secondo livello: voti ponderati di sindaci e consiglieri comunali, su una scala di 100.000; non sono elettori né abitanti');
  const registers = Number(given.electors) > 0 ? Math.round(Number(given.electors)) : null;
  let electors = registers, electorsBasis = registers ? (given.basis ?? 'iscritti alle liste elettorali') : null;
  if (electors === null && population) { electors = Math.round(population.residents * ELIGIBLE_SHARE); electorsBasis = `elettorato simulato: ${Math.round(ELIGIBLE_SHARE * 100)}% dei residenti (assunzione del gioco, non il numero degli iscritti)`; }
  if (electors === null) return scaled(turnout, 'senza-dati', 'Dati demografici non disponibili: percentuali su una scala di 100.000 schede, non sono elettori', population?.residents ?? null);
  const validRatio = Number(given.validRatio) > 0 && Number(given.validRatio) <= 1 ? Number(given.validRatio) : .99;
  const share = clamp(turnout, 0, 100) / 100;
  // Never more voters than electors, never more than the residents of the territory.
  const ceiling = Math.min(electors, population ? population.residents : Infinity);
  const voters = clamp(Math.round(electors * share + normal() * Math.sqrt(electors * share * (1 - share))), 0, ceiling);
  const ballots = clamp(Math.round(voters * validRatio + normal() * Math.sqrt(voters * validRatio * (1 - validRatio))), 0, voters);
  return {
    kind: type, residents: population?.residents ?? null, populationReferenceDate: population?.referenceDate ?? null, electors, voters, ballots, valid: ballots, invalid: voters - ballots,
    turnout, turnoutRequested: turnout, turnoutActual: actualTurnout(electors, voters), validRatio, normalized: false, basis: electorsBasis, electorsSource: registers ? 'registro' : 'simulato', source: 'simulation'
  };
}

// Whole votes that add up exactly to `total`, in proportion to `weights` (largest remainder; ties go to the earlier row, so the result is deterministic).
export function distributeVotes(weights, total) {
  const sum = weights.reduce((acc, value) => acc + Math.max(0, Number(value) || 0), 0);
  const whole = Math.max(0, Math.round(Number(total) || 0));
  if (!weights.length) return [];
  if (!(sum > 0)) { const out = weights.map(() => 0); out[0] = whole; return out; }
  const exact = weights.map(value => Math.max(0, Number(value) || 0) * whole / sum);
  const votes = exact.map(Math.floor);
  let left = whole - votes.reduce((acc, value) => acc + value, 0);
  const order = exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (let at = 0; left > 0; at++, left--) votes[order[at % order.length].index]++;
  return votes;
}

// Gives the rows their votes: the valid ballots shared by percentage. Rows that do not reach 100% (the lists that are not shown) get a row of their own, «Altre liste».
export function withVotes(rows, valid, { others = true, label = 'Altre liste' } = {}) {
  const shown = rows.reduce((acc, row) => acc + (Number(row.percent) || 0), 0);
  const rest = Math.round((100 - shown) * 100) / 100;
  const list = others && rest >= 0.05 ? [...rows, { id: 'altre-liste', candidateId: null, partyIds: [], memberCandidateIds: [], label, percent: rest, seats: 0, source: 'simulation', others: true }] : rows;
  const votes = distributeVotes(list.map(row => row.percent), valid);
  list.forEach((row, index) => { row.votes = votes[index]; });
  return list;
}

// What must hold in every count; the list of the violations is empty when it does. `rows` are the lists with their votes.
export function countProblems(count, rows = [], { label = 'elezione' } = {}) {
  const problems = [];
  if (!count) return [`${label}: conteggio assente`];
  const whole = value => Number.isInteger(value) && value >= 0;
  if (count.normalized) {
    if (rows.length && rows.some(row => row.votes !== undefined) && rows.reduce((acc, row) => acc + (row.votes ?? 0), 0) !== count.ballots) problems.push(`${label}: la somma dei voti di lista non coincide con i voti sulla scala`);
    return problems;
  }
  for (const key of ['electors', 'voters', 'ballots']) if (!whole(count[key])) problems.push(`${label}: ${key} non è un intero non negativo (${count[key]})`);
  if (count.residents !== null && count.residents !== undefined && count.voters > count.residents) problems.push(`${label}: votanti ${count.voters} > popolazione residente ${count.residents}`);
  if (count.voters > count.electors) problems.push(`${label}: votanti ${count.voters} > elettorato ${count.electors}`);
  if (count.ballots > count.voters) problems.push(`${label}: voti validi ${count.ballots} > votanti ${count.voters}`);
  if (rows.length) { const total = rows.reduce((acc, row) => acc + (row.votes ?? 0), 0); if (total !== count.ballots) problems.push(`${label}: la somma dei voti di lista ${total} non coincide con i voti validi ${count.ballots}`); }
  return problems;
}
