// The President of the Republic: the electoral assembly (Deputies, Senators and the regional delegates), the field of
// candidates, the negotiations between the groups, the secret ballots with their quorum (two thirds of the assembly in
// the first three, the absolute majority from the fourth), the seven-year term and the next election at its end.
// Pure functions on a plain state (`state.presidency`): nothing here touches the store, the parliament or the world;
// the store applies the consequences. Every draw comes from a seeded sequence: the same state gives the same vote.
// Everything is simulation: the candidates are figures of the game and the incumbent is never named.
import { uniqueId } from './ids.js?v=20261006-1';
import { advanceDays, formatDate } from './time.js?v=20261006-1';
import { seededRandom } from './vote-engine.js?v=20261006-1';
import { campOfAxis } from './parliament-engine.js?v=20261006-1';
import { linkGroupsToParties } from './lawmaking-engine.js?v=20261006-1';
import { regionalShares } from './world-engine.js?v=20261006-1';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20261006-1';
import { AFFINITY, CAMP_LABELS, CANDIDATE_TYPES, PRESIDENCY_RULES, PRESIDENT_ACTIVITIES, PRESIDENT_ACTS } from '../data/simulation/presidency-rules.js?v=20261006-1';

const SIM = 'simulation';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const LOG_LIMIT = 40;
const HISTORY_LIMIT = 12;
const ABSENT_RATE = 0.015;

// ---------- calendar ----------
// The same calendar date some years on (29 February becomes 28 February).
export function addYears(date, years) {
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDate();
  value.setUTCFullYear(value.getUTCFullYear() + years);
  if (value.getUTCDate() !== day) value.setUTCDate(0);
  return value.toISOString().slice(0, 10);
}
export function ageOn(birthDate, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate ?? '') || !date) return null;
  const born = new Date(`${birthDate}T12:00:00Z`);
  const now = new Date(`${date}T12:00:00Z`);
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age--;
  return age;
}
const weekdayOf = date => new Date(`${date}T12:00:00Z`).getUTCDay();
// A ballot is held on a working day.
const workingDay = date => { const day = weekdayOf(date); return day === 0 ? advanceDays(date, 1) : day === 6 ? advanceDays(date, -1) : date; };
// The next ballot is on the next working day (Saturday and Sunday are skipped).
const nextWorkingDay = date => { let next = advanceDays(date, 1); while ([0, 6].includes(weekdayOf(next))) next = advanceDays(next, 1); return next; };
// The term ends seven years after the oath, or on the day of a resignation (the Senate's President acts meanwhile).
export const termEndOf = incumbent => incumbent.endsOn ?? addYears(incumbent.since, PRESIDENCY_RULES.termYears);
// Dates of the election that closes a term: the opening of the negotiations, the convocation (art. 85), the first ballot.
export function presidencySchedule(incumbent) {
  const termEnds = termEndOf(incumbent);
  const firstBallot = workingDay(advanceDays(termEnds, -PRESIDENCY_RULES.firstBallotBeforeEndDays));
  return { termEnds, convocation: advanceDays(termEnds, -PRESIDENCY_RULES.convocationDays), firstBallot, opensAt: advanceDays(firstBallot, -PRESIDENCY_RULES.negotiationWeeks * 7) };
}
export const isInOffice = (incumbent, date) => Boolean(incumbent) && date >= incumbent.since;
export const isPlayerPresident = (presidency, date = null) => presidency?.incumbent?.kind === 'giocatore' && (!date || isInOffice(presidency.incumbent, date));
// The last six months of the term (art. 88): the Chambers cannot be dissolved, unless the legislature ends in them too.
export function whiteSemester(incumbent, date, legislatureEnd = null) {
  const end = termEndOf(incumbent);
  const start = advanceDays(end, -PRESIDENCY_RULES.whiteSemesterDays);
  if (date < start || date > end) return { active: false, since: start, until: end };
  const coincides = Boolean(legislatureEnd) && legislatureEnd >= start && legislatureEnd <= advanceDays(end, 400) && advanceDays(legislatureEnd, -PRESIDENCY_RULES.whiteSemesterDays) <= end;
  return { active: !coincides, since: start, until: end, legislatureEnds: legislatureEnd };
}

// ---------- the person ----------
// What the Constitution asks of a candidate (art. 84): fifty years of age and the enjoyment of civil and political rights.
export function presidentialEligibility({ birthDate, date }) {
  const age = ageOn(birthDate, date);
  const problems = [];
  const turns = birthDate ? addYears(birthDate, PRESIDENCY_RULES.minAge) : null;
  if (age === null) problems.push('Serve una data di nascita valida.');
  else if (age < PRESIDENCY_RULES.minAge) problems.push(`Servono ${PRESIDENCY_RULES.minAge} anni compiuti (art. 84 della Costituzione): li compirai il ${formatDate(turns)}.`);
  return { eligible: !problems.length, age, minAge: PRESIDENCY_RULES.minAge, turns50: turns, problems };
}
// How the player stands as a candidate: prestige, breadth (how many camps could vote), partisanship. `roles` comes from
// the store (secretary, minister, premier, rank, independent), `stats` are the personal statistics.
export function playerStanding({ stats = {}, roles = {}, credit = null, incumbent = false } = {}) {
  const partisan = clamp(0.28 + (roles.secretary ? 0.45 : 0) + (!roles.secretary && (roles.rank ?? 0) >= 3 ? 0.2 : 0) + (roles.premier ? 0.15 : roles.minister ? 0.1 : 0) - (roles.independent ? 0.15 : 0) + (roles.memoryBad ?? 0) * 0.02 + (incumbent ? -0.25 : 0), 0, 1);
  const institutional = clamp((roles.speaker ? 8 : 0) + (roles.premier ? 6 : 0) + (roles.formerPremier ? 6 : 0) + (roles.minister ? 3 : 0) + (roles.regionalPresident ? 3 : 0) + (roles.parliamentary ? 2 : 0) + (roles.exPresident ? 8 : 0), 0, 12);
  let prestige = 0.28 * (stats.reputation ?? 50) + 0.26 * (stats.influence ?? 40) + 0.22 * (stats.experience ?? 30) + 0.14 * (stats.notoriety ?? 30) + institutional;
  let breadth = 30 + 0.3 * (stats.reputation ?? 50) + 0.45 * (100 - 100 * partisan) + institutional * 0.6 - 20;
  if (credit !== null) { prestige = 0.5 * prestige + 0.5 * (45 + credit * 0.5); breadth = 0.5 * breadth + 0.5 * (35 + credit * 0.6); }
  return { prestige: round1(clamp(prestige, 5, 95)), breadth: round1(clamp(breadth, 5, 95)), partisan: round2(partisan), institutional };
}

// ---------- state ----------
function simulatedIncumbent({ since, number, seed, electedOn = null }) {
  const rand = seededRandom(`${seed}|presidente|${number}`);
  const camp = ['centro', 'centro', 'sinistra', 'destra'][Math.floor(rand() * 4)];
  return { id: `presidente-${number}`, kind: 'simulato', label: 'Il Presidente della Repubblica in carica (figura simulata)', since, number, camp, activism: round2(0.25 + rand() * 0.5), electedOn, source: SIM };
}
export function createPresidency({ date = null, seed = 'quirinale' } = {}) {
  const incumbent = simulatedIncumbent({ since: PRESIDENCY_RULES.currentTermSince, number: 1, seed });
  return catchUp({ version: 1, seed: String(seed), incumbent, election: null, last: null, history: [], log: [], source: SIM }, date);
}
// A save older than the election that should have happened (or a state without the field): the elections the career
// has not seen are reconstructed in one line each, so that the term in office is always the current one.
function catchUp(presidency, date) {
  let next = presidency;
  for (let guard = 0; date && guard < 8; guard++) {
    const end = termEndOf(next.incumbent);
    if (next.election || advanceDays(end, 21) >= date) break;
    const number = (next.incumbent.number ?? 1) + 1;
    const electedOn = workingDay(advanceDays(end, -PRESIDENCY_RULES.firstBallotBeforeEndDays + 4));
    const succeeded = simulatedIncumbent({ since: end, number, seed: next.seed, electedOn });
    next = { ...next, incumbent: succeeded, history: [...(next.history ?? []), { number: number - 1, date: electedOn, president: succeeded.label, kind: 'simulato', camp: succeeded.camp, ballots: null, votes: null, reconstructed: true, source: SIM }].slice(-HISTORY_LIMIT) };
  }
  return next;
}
export function normalizePresidency(input, { date = null, seed = 'quirinale' } = {}) {
  if (!input || typeof input !== 'object' || !input.incumbent) return createPresidency({ date, seed });
  const base = { version: 1, election: null, last: null, history: [], log: [], source: SIM, seed: String(seed), ...input, incumbent: { ...input.incumbent } };
  base.log = Array.isArray(base.log) ? base.log : [];
  base.history = Array.isArray(base.history) ? base.history : [];
  return catchUp(base, date);
}
const logLine = (presidency, date, kind, text) => ({ ...presidency, log: [{ id: uniqueId(presidency.log, `${date}-${kind}-${presidency.log.length}`), date, kind, text }, ...presidency.log].slice(0, LOG_LIMIT) });

// ---------- the assembly ----------
const DELEGATE_REGIONS = ITALIAN_REGIONS;
const delegatesOf = region => region === 'Valle d’Aosta' ? PRESIDENCY_RULES.delegates.valleDAosta : PRESIDENCY_RULES.delegates.perRegion;
export const DELEGATES_TOTAL = DELEGATE_REGIONS.reduce((sum, region) => sum + delegatesOf(region), 0);
const hare = (entries, seats) => {
  const total = entries.reduce((sum, item) => sum + Math.max(0, item.weight), 0) || 1;
  const rows = entries.map(item => { const exact = seats * Math.max(0, item.weight) / total; return { id: item.id, seats: Math.floor(exact), rest: exact - Math.floor(exact) }; });
  let left = seats - rows.reduce((sum, row) => sum + row.seats, 0);
  for (const row of [...rows].sort((a, b) => b.rest - a.rest || String(a.id).localeCompare(String(b.id)))) { if (left <= 0) break; row.seats++; left--; }
  return new Map(rows.map(row => [row.id, row.seats]));
};
const CAMPS = ['destra', 'centro', 'sinistra'];
// The groups of the two Chambers by force (the same party's groups sit together), the delegates of every region
// (two of the majority and one of the minority of its council), the senators for life of a simulated legislature.
// playerDelegate: { region, side } when the player was chosen by the regional council as one of its delegates.
export function composeAssembly({ parliament, world = null, seed = 'quirinale', cohesion = {}, playerPartyId = null, playerDelegate = null } = {}) {
  const linked = linkGroupsToParties(parliament, world) ?? parliament;
  const parties = new Map((world?.parties ?? []).map(party => [party.id, party]));
  const blocs = new Map();
  const blocOf = group => {
    const partyId = group.partyId ?? null;
    const key = partyId ?? 'misto';
    if (!blocs.has(key)) {
      const party = partyId ? parties.get(partyId) : null;
      const axis = Number.isFinite(group.axis) ? group.axis : Number.isFinite(party?.axis) ? party.axis : 0;
      const base = Number.isFinite(cohesion[partyId]) ? cohesion[partyId] : party?.cohesion ?? 62;
      blocs.set(key, { id: key, label: party?.label ?? (partyId ? String(group.officialName ?? partyId).replace(/^Misto\s*[–-]\s*/i, '') : 'Gruppo Misto e minoranze'), partyId, axis, camp: campOfAxis(axis), camera: 0, senato: 0, delegates: 0, lifeSenators: 0, electors: 0, cohesion: partyId ? round2(clamp(0.62 + 0.3 * base / 100 + (party?.governing ? 0.03 : 0), 0.6, 0.95)) : 0, governing: Boolean(party?.governing), isPlayer: Boolean(playerPartyId && partyId === playerPartyId), free: !partyId, line: { kind: 'libera' }, vetoes: [], deals: {} });
    }
    return blocs.get(key);
  };
  for (const chamber of ['camera', 'senato']) for (const group of linked?.chambers?.[chamber]?.groups ?? []) { const seats = Math.max(0, group.simulatedSeats ?? 0); if (seats) blocOf(group)[chamber] += seats; }
  // The senators for life of a legislature born from a vote of the game (the real groups already count them).
  if (linked?.legislature?.reference === 'simulation') blocs.set('senatori-a-vita', { id: 'senatori-a-vita', label: 'Senatori a vita (figure simulate)', partyId: null, axis: 0, camp: 'centro', camera: 0, senato: 0, delegates: 0, lifeSenators: PRESIDENCY_RULES.lifeSenatorsInSimulatedLegislature, electors: 0, cohesion: 0, governing: false, isPlayer: false, free: true, line: { kind: 'libera' }, vetoes: [], deals: {} });
  const list = [...blocs.values()].sort((a, b) => (b.camera + b.senato) - (a.camera + a.senato) || a.id.localeCompare(b.id));
  // Weight of each camp among the members of the Chambers: the baseline of the regions.
  const weights = Object.fromEntries(CAMPS.map(camp => [camp, list.filter(bloc => !bloc.free && bloc.camp === camp).reduce((sum, bloc) => sum + bloc.camera + bloc.senato, 0)]));
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const leans = world?.localCalendar?.leans ?? {};
  const slotsByCamp = { destra: [], centro: [], sinistra: [] };
  // How the region leans: the world's regional model (polls, the region's own history, the camp that won its last vote);
  // without a world, the weight of the camps in the Chambers.
  const regionScore = region => {
    const score = Object.fromEntries(CAMPS.map(camp => [camp, weights[camp] / totalWeight * 100]));
    if (world?.parties?.length && world?.place) {
      for (const camp of CAMPS) score[camp] = 0;
      for (const row of regionalShares(world, region)) score[campOfAxis(parties.get(row.partyId)?.axis ?? 0)] += row.share;
    }
    for (const camp of CAMPS) score[camp] += (leans[region]?.[camp] ?? 0) * 1.6 + (world?.localCalendar?.regions?.[region]?.camp === camp ? 4 : 0);
    return score;
  };
  const regions = DELEGATE_REGIONS.map(region => {
    const score = regionScore(region);
    const ranked = [...CAMPS].sort((a, b) => score[b] - score[a] || a.localeCompare(b));
    const majorityCamp = ranked[0];
    const minorityCamp = ranked.slice(1).find(camp => weights[camp] > 0) ?? ranked[1];
    const count = delegatesOf(region);
    const slots = [];
    for (let index = 0; index < count; index++) slots.push({ side: index < PRESIDENCY_RULES.delegates.majority || count === 1 ? 'maggioranza' : 'minoranza', camp: index < PRESIDENCY_RULES.delegates.majority || count === 1 ? majorityCamp : minorityCamp, blocId: null, player: false });
    slots.forEach(slot => slotsByCamp[slot.camp].push({ region, slot }));
    return { region, delegates: count, majorityCamp, minorityCamp, slots };
  });
  // Each camp's slots are shared among its forces by seats (largest remainder); a camp with no force sends the Misto.
  for (const camp of CAMPS) {
    const slots = slotsByCamp[camp];
    if (!slots.length) continue;
    const members = list.filter(bloc => !bloc.free && bloc.camp === camp);
    const fallback = list.find(bloc => bloc.id === 'misto') ?? list.find(bloc => bloc.free) ?? list[0];
    const shares = members.length ? hare(members.map(bloc => ({ id: bloc.id, weight: bloc.camera + bloc.senato })), slots.length) : new Map([[fallback?.id, slots.length]]);
    const sequence = [...shares.entries()].flatMap(([id, count]) => Array.from({ length: count }, () => id));
    // The slots are handed out round-robin by region so that every region gets a mix, not a block of one force.
    slots.forEach((entry, index) => { entry.slot.blocId = sequence[(index * 7) % Math.max(1, sequence.length)] ?? fallback?.id ?? null; });
    // The rotation above can repeat an index; the exact counts are restored from the shares.
    const exact = new Map(shares);
    const used = new Map();
    for (const entry of slots) used.set(entry.slot.blocId, (used.get(entry.slot.blocId) ?? 0) + 1);
    for (const entry of slots) {
      if ((used.get(entry.slot.blocId) ?? 0) <= (exact.get(entry.slot.blocId) ?? 0)) continue;
      const need = [...exact.entries()].find(([id, count]) => (used.get(id) ?? 0) < count);
      if (!need) continue;
      used.set(entry.slot.blocId, used.get(entry.slot.blocId) - 1);
      used.set(need[0], (used.get(need[0]) ?? 0) + 1);
      entry.slot.blocId = need[0];
    }
  }
  // The regional council chose the player as one of its delegates: the seat of that slot goes to the player's force.
  if (playerDelegate?.region) {
    const own = list.find(bloc => bloc.isPlayer);
    const region = regions.find(item => item.region === playerDelegate.region);
    const slot = region?.slots.find(item => item.side === (playerDelegate.side ?? 'maggioranza') && !item.player) ?? region?.slots.find(item => !item.player);
    if (slot && own) { slot.blocId = own.id; slot.player = true; }
  }
  for (const region of regions) for (const slot of region.slots) { const bloc = list.find(item => item.id === slot.blocId); if (bloc) bloc.delegates++; }
  for (const bloc of list) bloc.electors = bloc.camera + bloc.senato + bloc.delegates + bloc.lifeSenators;
  const total = list.reduce((sum, bloc) => sum + bloc.electors, 0);
  const camera = list.reduce((sum, bloc) => sum + bloc.camera, 0);
  const senato = list.reduce((sum, bloc) => sum + bloc.senato, 0);
  const delegates = list.reduce((sum, bloc) => sum + bloc.delegates, 0);
  const lifeSenators = list.reduce((sum, bloc) => sum + bloc.lifeSenators, 0);
  return { total, camera, senato, delegates, lifeSenators, twoThirds: Math.ceil(2 * total / 3), absolute: Math.floor(total / 2) + 1, blocs: list.filter(bloc => bloc.electors > 0), regions, seed: String(seed), source: SIM };
}
// Camps of the assembly: how many electors each one weighs (for the interface and the field of candidates).
export function campWeights(assembly) {
  const out = { destra: 0, centro: 0, sinistra: 0 };
  for (const bloc of assembly.blocs) out[bloc.camp] += bloc.electors;
  return out;
}

// ---------- the field of candidates ----------
const between = (range, rand) => round1(range[0] + (range[1] - range[0]) * rand());
const campAxis = (camp, rand) => (camp === 'destra' ? 2 : camp === 'sinistra' ? -2 : 0) + round1((rand() - 0.5) * 0.8);
function makeCandidate({ id, type, camp, sponsors = [], rand, label = null, extra = {} }) {
  const spec = CANDIDATE_TYPES[type];
  const axis = type === 'uscente' ? 0 : ['garanzia', 'giurista', 'accademico'].includes(type) ? round1((rand() - 0.5) * 1.2) : campAxis(camp, rand);
  return { id, type, label: label ?? `${spec.label}${['bandiera', 'leader', 'ex-premier', 'ex-ministro', 'presidenza'].includes(type) && camp !== 'centro' ? ` del ${CAMP_LABELS[camp]}` : ''} (figura simulata)`, camp: type === 'uscente' ? 'centro' : camp, axis, prestige: between(spec.prestige, rand), breadth: between(spec.breadth, rand), partisan: round2(between(spec.partisan, rand)), sponsors: [...sponsors], withdrawn: false, failures: 0, isPlayer: false, source: SIM, ...extra };
}
// The candidates of the field: the flag-bearer of each large camp, figures of guarantee that nobody sponsors yet, an
// institutional figure, and sometimes the outgoing President as the last resort. The player joins when declared.
export function buildField({ assembly, seed, incumbent = null, number = 1 }) {
  const rand = seededRandom(`${seed}|candidati|${number}`);
  const weights = campWeights(assembly);
  const order = [...CAMPS].sort((a, b) => weights[b] - weights[a] || a.localeCompare(b));
  const sponsorsOf = camp => assembly.blocs.filter(bloc => !bloc.free && bloc.camp === camp && bloc.electors >= 8).map(bloc => bloc.id);
  const id = index => `cand-${number}-${index}`;
  const field = [];
  field.push(makeCandidate({ id: id(1), type: 'bandiera', camp: order[0], sponsors: sponsorsOf(order[0]), rand }));
  if (weights[order[1]] > 0) field.push(makeCandidate({ id: id(2), type: 'bandiera', camp: order[1], sponsors: sponsorsOf(order[1]), rand }));
  field.push(makeCandidate({ id: id(3), type: 'garanzia', camp: 'centro', rand }));
  field.push(makeCandidate({ id: id(4), type: 'giurista', camp: 'centro', rand }));
  field.push(makeCandidate({ id: id(5), type: rand() < 0.5 ? 'presidenza' : 'ex-premier', camp: order[rand() < 0.6 ? 1 : 2] ?? 'centro', rand }));
  if (rand() < 0.5) field.push(makeCandidate({ id: id(6), type: 'accademico', camp: 'centro', rand }));
  if (incumbent?.kind === 'simulato' && rand() < 0.25) field.push(makeCandidate({ id: id(7), type: 'uscente', camp: 'centro', rand, label: 'Il Presidente uscente (figura simulata)', extra: { reserve: true } }));
  return field;
}

// ---------- affinity, viability and the lines of the groups ----------
// How much a group likes a candidate (0–100): collocazione, prestige, breadth, how partisan the figure is, sponsorship,
// vetoes and the deals made. Points, not probabilities.
export function affinity(bloc, candidate) {
  const distance = Math.abs((bloc.axis ?? 0) - (candidate.axis ?? 0));
  const sameCamp = candidate.camp === bloc.camp;
  let score = AFFINITY.base - AFFINITY.perAxisStep * distance;
  score += AFFINITY.prestige * (candidate.prestige - AFFINITY.prestigeCentre);
  score += AFFINITY.breadth * (candidate.breadth - AFFINITY.breadthCentre);
  score -= AFFINITY.partisan * candidate.partisan * (sameCamp ? AFFINITY.sameCampPartisanShare : 1);
  if ((candidate.sponsors ?? []).includes(bloc.id)) score += AFFINITY.sponsor;
  if ((bloc.vetoes ?? []).includes(candidate.id)) score += AFFINITY.veto;
  score += bloc.deals?.[candidate.id] ?? 0;
  // A President in office that has served well is called back by the Chambers (as in 2013 and 2022).
  score += candidate.acclaim ?? 0;
  return round1(clamp(score, 0, 100));
}
const accepts = (bloc, candidate) => clamp((affinity(bloc, candidate) - AFFINITY.acceptFrom) / AFFINITY.acceptSpan, 0, 1);
const activeCandidates = (election, pressure) => election.candidates.filter(candidate => !candidate.withdrawn && (!candidate.reserve || candidate.called || pressure >= 0.85));
// The share of the assembly that would accept each candidate: what makes a name viable.
export function viability(election, pressure = 0) {
  const total = election.assembly.total || 1;
  return Object.fromEntries(activeCandidates(election, pressure).map(candidate => [candidate.id, round2(election.blocs.reduce((sum, bloc) => sum + bloc.electors * accepts(bloc, candidate), 0) / total)]));
}
const pressureOf = ballot => clamp((ballot - 1) / AFFINITY.pressureBallots, 0, 1);
// The line of a group in a ballot: the candidate it votes (sponsor first, then the best one it can accept as the
// pressure to converge grows), a blank paper, or nothing (a free group, every member decides alone).
function lineFor(bloc, election, ballot, viab, decided = []) {
  if (bloc.free) return { kind: 'libera' };
  const pressure = pressureOf(ballot);
  if (bloc.playerLine && (bloc.playerLine.kind === 'bianca' || election.candidates.some(candidate => candidate.id === bloc.playerLine.candidateId && !candidate.withdrawn))) return bloc.playerLine;
  const scored = activeCandidates(election, pressure).map(candidate => {
    const sponsor = (candidate.sponsors ?? []).includes(bloc.id);
    const erosion = sponsor ? clamp(1 - 1.2 * pressure * (1 - Math.min(1, (viab[candidate.id] ?? 0) * 1.4)), 0.15, 1) : 1;
    const base = affinity(bloc, candidate) - (sponsor ? AFFINITY.sponsor * (1 - erosion) : 0);
    // The partners of the same camp that already decided this ballot weigh on the choice: a coalition votes together.
    const follow = clamp(decided.filter(item => item.camp === bloc.camp && item.line.candidateId === candidate.id).reduce((sum, item) => sum + item.electors / 18, 0), 0, 16);
    return { candidate, value: base + AFFINITY.viabilityWeight * pressure * (viab[candidate.id] ?? 0) + (bloc.line?.candidateId === candidate.id ? 6 : 0) + follow };
  }).sort((a, b) => b.value - a.value || a.candidate.id.localeCompare(b.candidate.id));
  const best = scored[0];
  const threshold = AFFINITY.lineThresholdStart - AFFINITY.lineThresholdDrop * pressure;
  return best && best.value >= threshold ? { kind: 'candidato', candidateId: best.candidate.id } : { kind: 'bianca' };
}
const describeLine = (line, election) => line.kind === 'candidato' ? `vota ${election.candidates.find(candidate => candidate.id === line.candidateId)?.label ?? 'un candidato'}` : line.kind === 'bianca' ? 'vota scheda bianca' : 'lascia libertà di voto';
export const lineText = describeLine;

// ---------- drawing the votes ----------
function gauss(rand) { const u = Math.max(1e-9, rand()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); }
function binomial(n, p, rand) {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n <= 30) { let k = 0; for (let index = 0; index < n; index++) if (rand() < p) k++; return k; }
  return clamp(Math.round(n * p + Math.sqrt(n * p * (1 - p)) * gauss(rand)), 0, n);
}
// What the members of a group that do not follow its line (or all of a free group) vote: the candidate they like
// (more as the pressure grows), a blank paper, a name outside the field.
function looseWeights(bloc, active, viab, pressure, line = { kind: 'libera' }) {
  // Whoever breaks the line does not vote for the name of the line: that is what breaking it means.
  const items = active.filter(candidate => !(line.kind === 'candidato' && line.candidateId === candidate.id)).map(candidate => ({ id: candidate.id, weight: Math.exp((affinity(bloc, candidate) - 50) / 10 + 1.6 * pressure * (viab[candidate.id] ?? 0)) }));
  if (line.kind !== 'bianca') items.push({ id: 'bianca', weight: 1.4 * (1 - 0.7 * pressure) });
  items.push({ id: 'dispersi', weight: 1 });
  return items;
}
function spread(count, items, rand) {
  const out = new Map(items.map(item => [item.id, 0]));
  let left = count;
  let weight = items.reduce((sum, item) => sum + item.weight, 0);
  for (const item of items.slice(0, -1)) {
    const taken = binomial(left, weight > 0 ? item.weight / weight : 0, rand);
    out.set(item.id, taken); left -= taken; weight -= item.weight;
  }
  out.set(items.at(-1).id, (out.get(items.at(-1).id) ?? 0) + left);
  return out;
}
export const quorumFor = (ballot, assembly) => ballot <= PRESIDENCY_RULES.twoThirdsUntil
  ? { rule: 'due-terzi', label: 'i due terzi dell’assemblea', needed: assembly.twoThirds }
  : { rule: 'maggioranza-assoluta', label: 'la maggioranza assoluta dell’assemblea', needed: assembly.absolute };
const plus = (map, key, value) => map.set(key, (map.get(key) ?? 0) + value);

// One ballot: every group votes its line with the franchi tiratori of a secret ballot, the player's own paper replaces
// one vote of the group's. Returns the ballot (with the quorum), the lines used and who is elected.
function castBallot(election, { ballot, date, rand }) {
  const rule = quorumFor(ballot, election.assembly);
  const pressure = pressureOf(ballot);
  const active = activeCandidates(election, pressure);
  const viab = viability(election, pressure);
  const tally = new Map(active.map(candidate => [candidate.id, 0]));
  tally.set('bianca', 0); tally.set('dispersi', 0);
  let absent = 0;
  const breakdown = [];
  const decided = [];
  for (const bloc of election.blocs) {
    const away = binomial(bloc.electors, ABSENT_RATE, rand);
    absent += away;
    const present = bloc.electors - away;
    const line = lineFor(bloc, election, ballot, viab, decided);
    bloc.line = line;
    decided.push({ camp: bloc.camp, electors: bloc.electors, line });
    const candidate = line.kind === 'candidato' ? active.find(item => item.id === line.candidateId) : null;
    const strain = candidate ? clamp((48 - affinity(bloc, candidate)) / 100, 0, 0.3) : line.kind === 'bianca' ? 0.03 : 0;
    const loose = line.kind === 'libera' ? 1 : clamp(0.025 + (1 - bloc.cohesion) * 0.4 + strain + (bloc.turbulence ?? 0), 0.01, 0.55);
    const followers = line.kind === 'libera' ? 0 : binomial(present, 1 - loose, rand);
    if (line.kind === 'candidato') plus(tally, line.candidateId, followers);
    else if (line.kind === 'bianca') plus(tally, 'bianca', followers);
    const drawn = spread(present - followers, looseWeights(bloc, active, viab, pressure, line), rand);
    for (const [id, count] of drawn) plus(tally, id, count);
    breakdown.push({ blocId: bloc.id, electors: bloc.electors, present, line, followers, loose: present - followers });
  }
  // The player's secret paper: one vote moves from the line of the group to what the player chose.
  const own = election.player?.vote && election.player.blocId ? election.blocs.find(bloc => bloc.id === election.player.blocId) : null;
  let playerVote = null;
  if (own && election.player.vote !== 'linea') {
    const target = election.player.vote === 'bianca' ? 'bianca' : active.find(item => item.id === election.player.vote)?.id ?? null;
    const from = own.line.kind === 'candidato' ? own.line.candidateId : own.line.kind === 'bianca' ? 'bianca' : null;
    if (target && from && target !== from && (tally.get(from) ?? 0) > 0) { plus(tally, from, -1); plus(tally, target, 1); playerVote = target; }
    else if (target && !from) { plus(tally, 'dispersi', -1); plus(tally, target, 1); playerVote = target; }
  }
  const rows = active.map(candidate => ({ id: candidate.id, label: candidate.label, votes: tally.get(candidate.id) ?? 0 })).sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id));
  const leader = rows[0] ?? null;
  const elected = Boolean(leader && leader.votes >= rule.needed);
  return { record: { n: ballot, date, rule: rule.rule, ruleLabel: rule.label, needed: rule.needed, total: election.assembly.total, votes: rows.filter(row => row.votes > 0 || candidateInField(election, row.id)), blank: tally.get('bianca') ?? 0, scattered: tally.get('dispersi') ?? 0, absent, leaderId: leader?.id ?? null, leaderVotes: leader?.votes ?? 0, elected, source: SIM }, breakdown, viability: viab, playerVote };
}
const candidateInField = (election, id) => election.candidates.some(candidate => candidate.id === id && !candidate.withdrawn);
const candidateOf = (election, id) => election.candidates.find(candidate => candidate.id === id);
// A force sponsors one candidate at a time: sponsoring a new one drops the others. The allies of the same camp that
// like the name enough (affinity 38 or more) follow the leader; `chance` (a draw) lets the others follow too.
function adoptSponsors(election, blocId, candidate, { rand = null, follow = true } = {}) {
  const bloc = election.blocs.find(item => item.id === blocId);
  if (!bloc) return [];
  // The sponsors of the player's own candidacy are loyal: the others cannot take them away.
  const drop = id => { for (const other of election.candidates) if (other.id !== candidate.id && !other.isPlayer && (other.sponsors ?? []).includes(id)) other.sponsors = other.sponsors.filter(item => item !== id); };
  const joined = [];
  const join = item => { drop(item.id); if (!(candidate.sponsors ?? []).includes(item.id)) { candidate.sponsors = [...(candidate.sponsors ?? []), item.id]; joined.push(item); } };
  join(bloc);
  if (follow) for (const ally of election.blocs) if (ally.id !== bloc.id && !ally.free && ally.camp === bloc.camp && !(ally.vetoes ?? []).includes(candidate.id) && (rand ? rand() < clamp((affinity(ally, candidate) - 30) / 55, 0.05, 0.9) : affinity(ally, candidate) >= 38)) join(ally);
  return joined;
}

// ---------- the election ----------
const emptyPlayer = () => ({ role: 'osservatore', blocId: null, vote: null, declared: false, offered: false, declined: false, actions: 0, deals: [], source: SIM });
// player: { elector, delegate, leader, blocId, eligible, standing } from the store.
export function openElection(presidency, { date, assembly, player = null, seed = presidency.seed, reason = null, firstBallot = null }) {
  const number = (presidency.incumbent.number ?? 1) + 1;
  const schedule = presidencySchedule(presidency.incumbent);
  // After a postponement the ballots start a couple of weeks from the day the election can be held.
  if (firstBallot && firstBallot > schedule.firstBallot) schedule.firstBallot = workingDay(firstBallot);
  const field = buildField({ assembly, seed, incumbent: presidency.incumbent, number });
  // How restless each force is in this election (hidden): a quarrel in a coalition shows in the secret ballot.
  const restless = seededRandom(`${seed}|turbolenza|${number}`);
  const election = {
    id: `quirinale-${number}`, number, phase: date >= schedule.firstBallot ? 'scrutini' : 'trattative', openedAt: date, convocation: schedule.convocation, firstBallot: schedule.firstBallot, termEnds: schedule.termEnds,
    delayed: reason, assembly: { ...assembly, blocs: undefined }, blocs: assembly.blocs.map(bloc => ({ ...bloc, turbulence: bloc.free ? 0 : round2(0.015 + 0.2 * restless() ** 2) })), candidates: field, ballots: [], breakdown: [], viability: {}, player: { ...emptyPlayer(), ...(player ? { role: player.leader ? 'leader' : player.delegate ? 'delegato' : player.elector ? 'elettore' : 'osservatore', blocId: player.blocId ?? null } : {}) }, outcome: null, log: [], source: SIM
  };
  const lines = [`Si apre la corsa al Quirinale: ${assembly.total} grandi elettori (${assembly.camera} deputati, ${assembly.senato} senatori${assembly.lifeSenators ? ` compresi ${assembly.lifeSenators} a vita` : ''}, ${assembly.delegates} delegati regionali). Nei primi tre scrutini servono ${assembly.twoThirds} voti, dal quarto ${assembly.absolute}.`];
  election.viability = viability(election, 0);
  let next = { ...presidency, election };
  for (const line of lines) next = logLine(next, date, 'apertura', line);
  return { presidency: next, lines };
}
const sortedBlocs = election => [...election.blocs].sort((a, b) => b.electors - a.electors || a.id.localeCompare(b.id));

// A candidate that is close to the quorum looks for the missing votes: the camp that sponsors it courts the forces that
// do not (centrists, the mixed group) and some of them open up in exchange for something. Returns the line to report.
function brokerVotes(election, record, rand) {
  const leader = record.leaderId ? election.candidates.find(candidate => candidate.id === record.leaderId && !candidate.withdrawn && !candidate.isPlayer) : null;
  if (!leader || !(leader.sponsors ?? []).length) return null;
  const gap = record.needed - record.leaderVotes;
  if (gap <= 0 || gap > 0.13 * record.total) return null;
  const courted = election.blocs.filter(bloc => !(leader.sponsors ?? []).includes(bloc.id) && !(bloc.vetoes ?? []).includes(leader.id) && !bloc.playerLine && affinity(bloc, leader) >= 20 && bloc.electors >= 3).sort((a, b) => b.electors - a.electors).slice(0, 3);
  const opened = courted.filter(bloc => rand() < clamp(0.3 + (affinity(bloc, leader) - 22) / 110, 0.1, 0.65));
  for (const bloc of opened) bloc.deals = { ...bloc.deals, [leader.id]: (bloc.deals?.[leader.id] ?? 0) + 20 };
  return opened.length ? `La coalizione che sostiene ${leader.label} cerca i voti che mancano (ne servono ${gap}): ${opened.map(bloc => bloc.label).join(', ')} si dice disponibile.` : null;
}

// The groups that are not happy with the name in front: with some chance one of them blocks it (a veto).
function vetoByTheOthers(election, rand, viab, chance = 0.16) {
  if (rand() >= chance) return null;
  const front = election.candidates.filter(candidate => !candidate.withdrawn && !candidate.reserve && !candidate.isPlayer && (candidate.sponsors ?? []).length).sort((a, b) => (viab[b.id] ?? 0) - (viab[a.id] ?? 0))[0];
  if (!front) return null;
  const unhappy = election.blocs.filter(bloc => !bloc.free && bloc.electors >= 8 && !bloc.playerLine && !(bloc.vetoes ?? []).includes(front.id) && affinity(bloc, front) < 50 && !(front.sponsors ?? []).includes(bloc.id));
  const pick = unhappy.sort((a, b) => b.electors - a.electors)[Math.floor(rand() * Math.min(2, unhappy.length))];
  if (!pick) return null;
  pick.vetoes = [...(pick.vetoes ?? []), front.id];
  return `${pick.label} pone il veto su ${front.label}.`;
}

// A week of the election: the negotiations (before the first ballot) or the ballots (up to `ballotsPerWeek`) until
// someone is elected. Returns the new state, the lines for the report and the result when someone is proclaimed.
export function advanceElection(presidency, { date, rand = null }) {
  const election = presidency.election;
  if (!election || election.phase === 'conclusa') return { presidency, lines: [], elected: null };
  let next = { ...presidency, election: copy(election) };
  const live = next.election;
  const lines = [];
  const random = rand ?? seededRandom(`${presidency.seed}|${live.id}|${date}`);
  if (live.phase === 'trattative') {
    // The weeks before the vote: names are launched, burned and picked up again; the groups take position.
    const pressure = 0.15;
    const viab = viability(live, pressure);
    live.viability = viab;
    const leading = Object.entries(viab).sort((a, b) => b[1] - a[1])[0];
    if (leading) { const candidate = candidateOf(live, leading[0]); const text = `Toto-Quirinale: in testa tra i nomi che circolano c’è ${candidate.label}, accettabile per circa ${Math.round(leading[1] * 100)}% dell’assemblea.`; lines.push(text); next = logLine(next, date, 'trattative', text); }
    // A sponsor can launch a figure of guarantee: a coalition adopts the candidate that is most acceptable to everyone.
    const free = live.candidates.filter(candidate => !candidate.withdrawn && !candidate.reserve && !(candidate.sponsors ?? []).length && !candidate.isPlayer);
    const strength = campWeights(live.assembly.total ? { blocs: live.blocs } : { blocs: [] });
    const biggest = sortedBlocs(live).find(item => !item.free);
    const share = biggest ? strength[biggest.camp] / (live.assembly.total || 1) : 0;
    if (free.length && random() < (share >= 0.5 ? 0.07 : 0.3)) {
      const pick = [...free].sort((a, b) => (viab[b.id] ?? 0) - (viab[a.id] ?? 0))[0];
      const bloc = sortedBlocs(live).find(item => !item.free && !live.candidates.some(candidate => (candidate.sponsors ?? []).includes(item.id) && candidate.breadth >= 60));
      if (bloc) { const joined = adoptSponsors(live, bloc.id, pick); const text = `${bloc.label} lancia il nome di ${pick.label}${joined.length > 1 ? `; si accodano ${joined.slice(1).map(item => item.label).join(', ')}` : ''}.`; lines.push(text); next = logLine(next, date, 'trattative', text); }
    }
    // A force can put a veto on the name that is gaining ground: the coalition that sponsored it is split.
    const veto = vetoByTheOthers(live, random, viab);
    if (veto) { lines.push(veto); next = logLine(next, date, 'trattative', veto); }
    if (date >= live.firstBallot) live.phase = 'scrutini';
    else return { presidency: next, lines, elected: null };
  }
  let elected = null;
  for (let index = 0; index < PRESIDENCY_RULES.ballotsPerWeek && !elected; index++) {
    const ballot = live.ballots.length + 1;
    const ballotDate = live.ballots.length ? nextWorkingDay(live.ballots.at(-1).date) : live.firstBallot;
    // The agreement of the last resort: after too many ballots every group moves towards the most viable name.
    if (ballot > PRESIDENCY_RULES.softLimit && !live.pact) {
      const viab = viability(live, 1);
      const top = Object.entries(viab).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (top) { live.pact = top; for (const bloc of live.blocs) if (!bloc.free && !(bloc.vetoes ?? []).includes(top)) bloc.deals = { ...bloc.deals, [top]: (bloc.deals?.[top] ?? 0) + 18 }; const text = `Dopo ${ballot - 1} scrutini i gruppi cercano l’intesa di ultima istanza su ${candidateOf(live, top).label}.`; lines.push(text); next = logLine(next, ballotDate, 'trattative', text); }
    }
    const result = castBallot(live, { ballot, date: ballotDate, rand: random });
    live.ballots.push(result.record);
    live.breakdown = result.breakdown;
    live.viability = result.viability;
    live.lastPlayerVote = result.playerVote;
    const leader = result.record.leaderId ? candidateOf(live, result.record.leaderId) : null;
    let outcomeLine = `${ballot}º scrutinio (${result.record.ruleLabel}, ${result.record.needed} voti): ${leader ? `in testa ${leader.label} con ${result.record.leaderVotes}` : 'nessun voto ai candidati'}, ${result.record.blank} schede bianche, ${result.record.scattered} voti dispersi.`;
    let force = null;
    if (!result.record.elected && ballot >= PRESIDENCY_RULES.hardLimit) {
      // The vote cannot go on for ever: the last agreement closes it on the most viable name.
      const viab = viability(live, 1);
      const top = Object.entries(viab).sort((a, b) => b[1] - a[1])[0]?.[0];
      force = top ? candidateOf(live, top) : leader;
      if (force) { result.record.elected = true; result.record.forced = true; result.record.leaderId = force.id; result.record.leaderVotes = Math.max(result.record.needed, result.record.leaderVotes); outcomeLine += ' Intesa finale di tutti i gruppi.'; }
    }
    lines.push(outcomeLine);
    next = logLine(next, ballotDate, 'scrutinio', outcomeLine);
    if (result.record.elected) {
      elected = { candidateId: result.record.leaderId, ballot, votes: result.record.leaderVotes, date: ballotDate, rule: result.record.rule, needed: result.record.needed, total: result.record.total, forced: Boolean(result.record.forced) };
      break;
    }
    // After a failed ballot the names that go nowhere are burned and their sponsors released.
    for (const candidate of live.candidates) {
      if (candidate.withdrawn || candidate.isPlayer && candidate.protected) continue;
      const votes = result.record.votes.find(row => row.id === candidate.id)?.votes ?? 0;
      const sponsored = (candidate.sponsors ?? []).length > 0;
      candidate.failures = sponsored && ballot >= 4 && votes < 0.55 * result.record.needed ? candidate.failures + 1 : sponsored ? candidate.failures : 0;
      if (sponsored && candidate.failures >= AFFINITY.burnAfter) {
        candidate.withdrawn = true; candidate.reason = 'bruciato';
        if (candidate.isPlayer) live.player.declared = false;
        const text = `${candidate.label} esce dalla corsa: non ha i voti.`;
        lines.push(text); next = logLine(next, ballotDate, 'trattative', text);
        for (const bloc of live.blocs) if (bloc.playerLine?.candidateId === candidate.id) bloc.playerLine = null;
      }
    }
    // A front-runner stuck below the quorum for several ballots loses the patience of its sponsors, who release it one by one.
    if (ballot >= PRESIDENCY_RULES.twoThirdsUntil + 1 && result.record.leaderId) {
      const front = candidateOf(live, result.record.leaderId);
      if (front && !front.isPlayer && (front.sponsors ?? []).length) {
        front.stuck = (front.stuck ?? 0) + 1;
        if (front.stuck >= 4) {
          const leaving = live.blocs.filter(bloc => (front.sponsors ?? []).includes(bloc.id) && !bloc.playerLine && random() < 0.3);
          if (leaving.length) { front.sponsors = front.sponsors.filter(id => !leaving.some(bloc => bloc.id === id)); const text = `${leaving.map(bloc => bloc.label).join(', ')} non ${leaving.length > 1 ? 'sostengono' : 'sostiene'} più ${front.label}: i voti non bastano.`; lines.push(text); next = logLine(next, ballotDate, 'trattative', text); }
        }
      }
    }
    if (ballot >= PRESIDENCY_RULES.twoThirdsUntil + 1) { const brokered = brokerVotes(live, result.record, random); if (brokered) { lines.push(brokered); next = logLine(next, ballotDate, 'trattative', brokered); } }
    if (ballot >= 2 && ballot < PRESIDENCY_RULES.hardLimit) { const veto = vetoByTheOthers(live, random, result.viability, 0.1); if (veto) { lines.push(veto); next = logLine(next, ballotDate, 'trattative', veto); } }
    // Early on a group may release the candidate of its flag when it is clearly out of reach.
    if (ballot === PRESIDENCY_RULES.twoThirdsUntil) { const text = 'Finiscono gli scrutini a maggioranza dei due terzi: da ora basta la maggioranza assoluta.'; lines.push(text); next = logLine(next, ballotDate, 'scrutinio', text); }
  }
  next = { ...next, election: live };
  return { presidency: next, lines, elected };
}

// The President is proclaimed: the new term begins at the end of the old one (or on the day of the oath), the election
// goes to the history. `player` is true when the player is elected (the store applies the incompatibilities).
export function proclaim(presidency, { elected, player = null, politician = null, date }) {
  const election = presidency.election;
  const candidate = election.candidates.find(item => item.id === elected.candidateId);
  const old = presidency.incumbent;
  const oldEnd = termEndOf(old);
  const since = date >= oldEnd ? advanceDays(date, 3) : oldEnd;
  const isPlayer = Boolean(candidate?.isPlayer);
  const number = election.number;
  const incumbent = isPlayer
    ? { id: `presidente-${number}`, kind: 'giocatore', label: politician?.displayName ?? 'Il giocatore', politicianId: politician?.id ?? null, since, number, camp: 'centro', electedOn: elected.date, ballot: elected.ballot, votes: elected.votes, credit: PRESIDENCY_RULES.creditStart, actions: {}, returned: [], dissolutions: 0, formations: 0, acts: [], lifeSenators: [], reelected: old.kind === 'giocatore', source: SIM }
    : candidate?.type === 'uscente' && old.kind === 'simulato'
      ? { ...old, since, number, electedOn: elected.date, ballot: elected.ballot, votes: elected.votes, reelected: true }
      : { ...simulatedIncumbent({ since, number, seed: presidency.seed, electedOn: elected.date }), camp: candidate?.camp ?? 'centro', activism: round2(0.2 + (candidate?.partisan ?? 0.3) * 0.5), label: `${(candidate?.label ?? 'Il nuovo Presidente').replace(/\s*\(figura simulata\)$/, '')}, eletto Presidente (figura simulata)`, ballot: elected.ballot, votes: elected.votes, sponsors: candidate?.sponsors ?? [], source: SIM };
  const record = { number: number - 1, date: elected.date, president: incumbent.label, kind: incumbent.kind, camp: incumbent.camp, ballots: elected.ballot, votes: elected.votes, needed: elected.needed, total: elected.total, rule: elected.rule, forced: elected.forced, reelected: Boolean(incumbent.reelected), candidateLabel: candidate?.label ?? null, sponsors: candidate?.sponsors ?? [], source: SIM };
  const summary = { ...election, phase: 'conclusa', outcome: { ...elected, candidateId: candidate?.id ?? null, label: candidate?.label ?? null, isPlayer, since }, breakdown: [] };
  const lines = [`${candidate?.label ?? 'Il nuovo Presidente'} è eletto Presidente della Repubblica al ${elected.ballot}º scrutinio con ${elected.votes} voti su ${elected.total} (${elected.rule === 'due-terzi' ? 'due terzi' : 'maggioranza assoluta'}, soglia ${elected.needed}).`];
  let next = { ...presidency, incumbent, election: null, last: compact(summary), history: [...(presidency.history ?? []), record].slice(-HISTORY_LIMIT) };
  next = logLine(next, elected.date, 'elezione', lines[0]);
  return { presidency: next, lines, incumbent, record, former: old, isPlayer, candidate };
}
// What stays of an election after it closes: the ballots and the field, without the weight of the breakdown.
function compact(election) {
  const { breakdown, viability: viab, blocs, ...rest } = election;
  return { ...rest, blocs: (blocs ?? []).map(bloc => ({ id: bloc.id, label: bloc.label, electors: bloc.electors, camp: bloc.camp })), source: SIM };
}

// ---------- the moves of the player ----------
const own = election => election?.blocs?.find(bloc => bloc.id === election.player?.blocId) ?? null;
// The player puts the own name in the field (a declared candidate, with the sponsorship of the own force when the
// player leads it or sits in its bodies).
export function declareCandidacy(presidency, { date, standing, label, sponsored = false, acclaim = 0 }) {
  const election = presidency.election;
  if (!election || election.phase === 'conclusa') throw new Error('Non c’è un’elezione del Presidente in corso.');
  if (election.candidates.some(candidate => candidate.isPlayer && !candidate.withdrawn)) throw new Error('Il tuo nome è già in corsa.');
  const bloc = own(election);
  const existing = election.candidates.find(candidate => candidate.isPlayer);
  const candidate = { id: `cand-${election.number}-giocatore`, type: 'giocatore', label: `${label} (tu)`, camp: bloc?.camp ?? 'centro', axis: bloc?.axis ?? 0, prestige: standing.prestige, breadth: standing.breadth, partisan: standing.partisan, sponsors: sponsored && bloc ? [bloc.id] : [], acclaim: round1(acclaim), withdrawn: false, failures: 0, isPlayer: true, source: SIM };
  const next = copy(presidency);
  next.election.candidates = existing ? next.election.candidates.map(item => item.isPlayer ? { ...candidate, id: existing.id, failures: 0 } : item) : [...next.election.candidates, candidate];
  next.election.player.declared = true;
  return logLine(next, date, 'candidatura', `${candidate.label} entra tra i nomi per il Quirinale${sponsored ? ` con il sostegno di ${bloc.label}` : ' senza uno sponsor'}.`);
}
export function withdrawCandidacy(presidency, { date }) {
  const next = copy(presidency);
  const candidate = next.election?.candidates.find(item => item.isPlayer && !item.withdrawn);
  if (!candidate) throw new Error('Non sei candidato.');
  candidate.withdrawn = true; candidate.reason = 'ritirato';
  next.election.player.declared = false;
  for (const bloc of next.election.blocs) if (bloc.playerLine?.candidateId === candidate.id) bloc.playerLine = null;
  return logLine(next, date, 'candidatura', 'Ritiri la tua candidatura al Quirinale.');
}
// The leader of a force sponsors a candidate: it becomes the line of the force and the allies are sounded.
export function sponsorCandidate(presidency, { date, candidateId, rand }) {
  const next = copy(presidency);
  const election = next.election;
  const bloc = own(election);
  const candidate = election?.candidates.find(item => item.id === candidateId && !item.withdrawn);
  if (!bloc || !candidate) throw new Error('Scegli un candidato in corsa e una forza che guidi.');
  const joined = adoptSponsors(election, bloc.id, candidate, { rand });
  bloc.playerLine = { kind: 'candidato', candidateId };
  const followed = joined.slice(1).map(item => item.label);
  return { presidency: logLine(next, date, 'trattative', `${bloc.label} sostiene ${candidate.label}${followed.length ? `; si accodano ${followed.join(', ')}` : ''}.`), followed };
}
export function vetoCandidate(presidency, { date, candidateId }) {
  const next = copy(presidency);
  const bloc = own(next.election);
  const candidate = next.election?.candidates.find(item => item.id === candidateId && !item.withdrawn);
  if (!bloc || !candidate) throw new Error('Scegli un candidato in corsa e una forza che guidi.');
  bloc.vetoes = [...new Set([...(bloc.vetoes ?? []), candidateId])];
  if (bloc.playerLine?.candidateId === candidateId) bloc.playerLine = null;
  // The sponsors of a vetoed name remember it: the relation of the force with theirs cools.
  const sponsors = (candidate.sponsors ?? []).filter(id => id !== bloc.id);
  return { presidency: logLine(next, date, 'trattative', `${bloc.label} pone il veto su ${candidate.label}.`), sponsors };
}
// A deal with another group: its support for a candidate in exchange for something the player will owe.
export function dealWithBloc(presidency, { date, blocId, candidateId, ties = 0, rand }) {
  const next = copy(presidency);
  const election = next.election;
  const target = election?.blocs.find(item => item.id === blocId);
  const candidate = election?.candidates.find(item => item.id === candidateId && !item.withdrawn);
  if (!target || !candidate || target.id === election.player.blocId) throw new Error('Scegli un altro gruppo e un candidato in corsa.');
  const base = affinity(target, candidate);
  const chance = round2(clamp(0.2 + (base - 25) / 120 + ties / 150 + (target.camp === own(election)?.camp ? 0.12 : 0), 0.05, 0.9));
  const accepted = rand() < chance;
  if (accepted) {
    target.deals = { ...target.deals, [candidateId]: (target.deals?.[candidateId] ?? 0) + 16 };
    if (!(candidate.sponsors ?? []).includes(target.id) && base + 16 >= 55) candidate.sponsors = [...candidate.sponsors, target.id];
    election.player.deals = [...(election.player.deals ?? []), { blocId, candidateId, date, source: SIM }];
  }
  election.player.actions = (election.player.actions ?? 0) + 1;
  return { presidency: logLine(next, date, 'trattative', accepted ? `${target.label} si dice pronta a sostenere ${candidate.label}: in cambio vorrà qualcosa.` : `${target.label} prende tempo: nessun impegno su ${candidate.label}.`), accepted, chance, target, candidate };
}
export function setPlayerLine(presidency, line) {
  const next = copy(presidency);
  const bloc = own(next.election);
  if (!bloc) throw new Error('Non guidi nessuna forza in questa elezione.');
  bloc.playerLine = line;
  return next;
}
export function setPlayerVote(presidency, vote) {
  const next = copy(presidency);
  if (!next.election) return presidency;
  next.election.player.vote = vote;
  return next;
}
// The elector's own paper, chosen from the agenda: 'linea', 'bianca' or the id of a candidate.
export function playerChoiceLabel(election, vote) {
  if (!vote || vote === 'linea') return 'segui la linea del gruppo';
  if (vote === 'bianca') return 'scheda bianca';
  return election.candidates.find(candidate => candidate.id === vote)?.label ?? 'un candidato';
}

// ---------- reading it ----------
// What the interface and the agenda show: the state of the vote and the expected result of the next ballot.
export function projection(election) {
  if (!election || election.phase === 'conclusa') return null;
  const ballot = election.ballots.length + 1;
  const pressure = pressureOf(ballot);
  const active = activeCandidates(election, pressure);
  const viab = viability(election, pressure);
  const expected = new Map(active.map(candidate => [candidate.id, 0]));
  let blank = 0;
  let scattered = 0;
  const decided = [];
  for (const bloc of election.blocs) {
    const line = lineFor({ ...bloc }, election, ballot, viab, decided);
    decided.push({ camp: bloc.camp, electors: bloc.electors, line });
    const present = bloc.electors * (1 - ABSENT_RATE);
    const candidate = line.kind === 'candidato' ? active.find(item => item.id === line.candidateId) : null;
    const strain = candidate ? clamp((48 - affinity(bloc, candidate)) / 100, 0, 0.3) : line.kind === 'bianca' ? 0.03 : 0;
    const loose = line.kind === 'libera' ? 1 : clamp(0.025 + (1 - bloc.cohesion) * 0.4 + strain + (bloc.turbulence ?? 0), 0.01, 0.55);
    const follow = present * (1 - loose);
    if (candidate) plus(expected, candidate.id, follow); else if (line.kind === 'bianca') blank += follow;
    const items = looseWeights(bloc, active, viab, pressure, line);
    const sum = items.reduce((total, item) => total + item.weight, 0) || 1;
    for (const item of items) { const part = present * loose * item.weight / sum; if (item.id === 'bianca') blank += part; else if (item.id === 'dispersi') scattered += part; else plus(expected, item.id, part); }
  }
  const rule = quorumFor(ballot, election.assembly);
  const rows = active.map(candidate => ({ id: candidate.id, label: candidate.label, votes: Math.round(expected.get(candidate.id) ?? 0), viability: viab[candidate.id] ?? 0 })).sort((a, b) => b.votes - a.votes);
  return { ballot, rule, rows, blank: Math.round(blank), scattered: Math.round(scattered), leader: rows[0] ?? null, gap: rows[0] ? rule.needed - rows[0].votes : rule.needed };
}
export function electionPhaseLabel(election) {
  if (!election) return 'Nessuna elezione in corso';
  if (election.phase === 'trattative') return 'Trattative: si cercano i nomi';
  if (election.phase === 'scrutini') return `Scrutini a Camere riunite${election.ballots.length ? `: ${election.ballots.length} svolti` : ''}`;
  return 'Elezione conclusa';
}

// The President resigns (art. 86): the President of the Senate acts until the new one is elected, within fifteen days.
export function resignPresidency(presidency, { date }) {
  const old = presidency.incumbent;
  const interim = { id: `supplente-${old.number}`, kind: 'simulato', label: 'Il Presidente del Senato, supplente (figura simulata)', since: date, endsOn: advanceDays(date, PRESIDENCY_RULES.afterNewChambersDays + 6), number: old.number, camp: 'centro', activism: 0.2, interim: true, source: SIM };
  const next = { ...presidency, incumbent: interim, history: [...(presidency.history ?? []), { number: old.number, date, president: old.label, kind: old.kind, camp: old.camp, ballots: old.ballot ?? null, votes: old.votes ?? null, resigned: true, source: SIM }].slice(-HISTORY_LIMIT) };
  return logLine(next, date, 'dimissioni', 'Il Presidente della Repubblica si dimette: il Presidente del Senato lo sostituisce e il Parlamento è convocato per eleggere il successore.');
}

// ---------- the term of the player-President ----------
const weeksSince = (from, to) => from ? Math.floor((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 604800000) : 999;
// The activities of the President (a fixed list: days of work, credit, stability, mood). Cooldowns by week.
export function presidentActivityProblem(incumbent, activity, { week, ap }) {
  if (ap < (activity.cost.ap ?? 0)) return `Servono ${activity.cost.ap} giorni.`;
  const last = incumbent.actions?.[activity.id];
  if (last !== undefined && week - last < (activity.cooldownWeeks ?? 0)) return `Si può ripetere dalla settimana ${last + activity.cooldownWeeks}.`;
  return null;
}
export function presidentActivityEffects(activity) {
  return { credit: activity.credit, stability: activity.stability, mood: activity.mood, stats: activity.stats };
}
export function applyPresidentCredit(presidency, delta, { date, text = null, act = null }) {
  if (presidency.incumbent.kind !== 'giocatore') return presidency;
  // The last points of credit are the hardest to win, and the first to lose are the easiest.
  const credit = presidency.incumbent.credit ?? PRESIDENCY_RULES.creditStart;
  const scaled = delta > 0 ? delta * clamp((100 - credit) / 55, 0.15, 1) : delta * clamp(credit / 55, 0.4, 1.3);
  const incumbent = { ...presidency.incumbent, credit: round1(clamp(credit + scaled, 0, 100)) };
  if (act || text) incumbent.acts = [{ date, act, text, credit: round1(scaled) }, ...(incumbent.acts ?? [])].slice(0, 30);
  return { ...presidency, incumbent };
}
// Weekly drift of the credit towards a neutral value, and the effect of the credit on the stability of the Government
// (a President trusted by the Chambers calms them; one that lost the credit adds friction).
export function presidentWeek(presidency, { week }) {
  const incumbent = presidency.incumbent;
  if (incumbent.kind !== 'giocatore') return { presidency, stability: 0 };
  const credit = incumbent.credit ?? PRESIDENCY_RULES.creditStart;
  const drift = round2((55 - credit) * 0.02);
  const next = { ...presidency, incumbent: { ...incumbent, credit: round1(clamp(credit + drift, 0, 100)) } };
  return { presidency: next, stability: round2(clamp((credit - 55) / 60, -0.4, 0.5)) };
}
export const ACTS = PRESIDENT_ACTS;
export const ACTIVITIES = PRESIDENT_ACTIVITIES;
