// The national cycle: calendar of the legislature and of the European elections, coalitions and national campaign,
// the general election on the real map of 2022 (collegi, circoscrizioni and seats of electoral-geography.json), the new
// Chambers and their groups, the formation of the Government. Everything that happens is simulation: the real data are
// the geography, the seats and the 2022 results the vote starts from; parties, coalitions, votes and seats of the game
// are estimates of the game and never presented as real results.
import { advanceDays, formatDate } from './time.js?v=20260926-1';
import { axisOf, nationalShares } from './world-engine.js?v=20260926-1';
import { MINISTRIES } from '../data/simulation/policy-rules.js?v=20260926-1';
import { archiveGovernment, voteGovernmentConfidence } from './parliament-engine.js?v=20260926-1';
import { EUROPEAN_CONSTITUENCIES } from '../data/simulation/campaign-rules.js?v=20260926-1';

const SIM = 'simulation';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const slug = text => String(text ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX'];
export const legislatureLabel = number => `${ROMAN[number] ?? number} legislatura`;
function random(seed) {
  let state = seed >>> 0 || 1;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  next.gauss = () => { const u = Math.max(1e-9, next()); const v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return next;
}

// ---------- rules ----------
// Rules of the game, inspired by the real ones and declared as simplifications where they are.
export const LEGISLATURE_RULES = Object.freeze({
  termYears: 5,
  // The Chambers meet within twenty days of the vote (art. 61 Cost.; in 2022: 18 days).
  firstSittingDays: 18,
  // At the natural end of a legislature the country votes a couple of weeks before the Chambers expire (simulated).
  voteBeforeEndDays: 14,
  consultationDays: 7, mandateDays: 7, confidenceDays: 7,
  // Without a Government after this many weeks from the first sitting the new Chambers are dissolved.
  formationDeadlineWeeks: 10,
  // Seats: Camera 400 (147 single-member districts, 245 proportional, 8 abroad), Senato 200 (74, 122, 4).
  seats: { camera: 400, senato: 200 },
  majority: { camera: 201, senato: 101 },
  // Thresholds of the proportional count (simplified): lists 3%, coalitions 10% with at least one list at 3%; the votes
  // of coalition lists between 1% and 3% count for the coalition; a list of a linguistic minority passes with 20% in its region.
  thresholds: { list: 3, coalition: 10, coalitionFloor: 1, regional: 20 },
  // Parliamentary groups (simplified): Camera 20 members, or 10 for a party whose list passed the threshold; Senato 6.
  groups: { camera: 20, cameraWaiver: 10, senato: 6 },
  // A majority after the vote looks for a margin of this many seats in both Chambers, when close forces allow it.
  safeMargin: 8,
  // Multi-member districts of 2022 (Camera 49, Senato 26) and the candidacies of a party leader (one district, five lists).
  plurinominali: { camera: 49, senato: 26 },
  leaderCandidacies: 5,
  // European elections: 2029 (the date is not fixed yet: simulated on the second Sunday of June), then every five years.
  european: { firstYear: 2029, month: '06', day: '10', seats: 76, threshold: 4, cycleYears: 5 },
  notes: [
    'Collegi, circoscrizioni, seggi e risultati 2022 sono dati reali (Eligendo); il voto, le coalizioni, i seggi e i governi della partita sono simulati.',
    'Riparto proporzionale semplificato: soglie nazionali, quoziente e resti più alti, niente “slittamenti” tra circoscrizioni.',
    'Gruppi parlamentari semplificati: Camera 20 componenti (10 per un partito sopra la soglia), Senato 6; gli altri eletti siedono nel Misto, divisi per componente politica.'
  ],
  source: SIM
});

// Lists of 2022 → forces of the game. Documented links (electoral-lists.json, Database 24/09/2026 §6) for FdI, PD, M5S,
// Lega, FI, Azione-Italia Viva, AVS, Sud chiama Nord, SVP-PATT and MAIE; +Europa, Noi Moderati and the joint lists of the
// centre-right abroad and in Valle d'Aosta follow a rule of the game (same name, or the parties of the joint list).
const FDI = 'party-registro-p1-2014-04-ir', LEGA = 'party-registro-p1-2017-41-ir', FI = 'party-registro-p1-2015-20-ir', NM = 'party-registro-p1-2020-56-ir';
export const LIST_FORCES = Object.freeze({
  FDI: [FDI], PD: ['party-registro-p1-2015-29-ir'], M5S: ['party-registro-p1-2022-63-ir'], LEGA: [LEGA], FI: [FI], NM: [NM],
  AZIV: ['party-registro-p1-2019-51-ir', 'party-registro-p1-2019-52-ir'], AVS: ['coalition-alleanza-verdi-sinistra'], PE: ['party-registro-p1-2018-47-ir'],
  SCN: ['party-registro-p1-2022-67-ir'], SVP: ['party-registro-p1-2015-19-ir', 'party-registro-p1-2014-09-ir'], MAIE: ['party-registro-p1-2015-14-ir'],
  CDXE: [FDI, LEGA, FI], CDXVDA: [FDI, LEGA, FI, NM]
});
export const LIST_LINK_BASIS = Object.freeze({ PE: 'regola di gioco', NM: 'regola di gioco', CDXE: 'regola di gioco', CDXVDA: 'regola di gioco' });
// Lists rooted in one territory keep their 2022 vote there (unless the force is measured in the polls).
const TERRITORIAL_LISTS = new Set(['SVP', 'VDAAPF', 'VDAA', 'RV', 'PLA']);
const ABROAD_LISTS = new Set(['MAIE', 'USEI', 'MDL', 'IDM']);

// Lines of the national campaign the party secretary can choose (effects on the weekly polls and on the vote).
export const NATIONAL_LINES = Object.freeze({
  identita: { id: 'identita', label: 'Campagna identitaria', detail: 'Il partito parla ai propri elettori: cresce, ma gli alleati perdono qualcosa.', cost: { capital: 4, treasury: 1500 }, party: 0.18, allies: -0.05 },
  coalizione: { id: 'coalizione', label: 'Campagna di coalizione', detail: 'Eventi comuni e messaggio unico: cresce tutta la coalizione, il partito un po’ meno.', cost: { capital: 3, treasury: 1200 }, party: 0.06, allies: 0.08 },
  territori: { id: 'territori', label: 'Collegi contendibili', detail: 'Tour nei collegi in bilico della tua regione: pesa sul voto locale più che sui sondaggi.', cost: { capital: 4, treasury: 2000 }, party: 0.04, allies: 0, contested: 1.2 },
  attacco: { id: 'attacco', label: 'Contro il primo avversario', detail: 'Tutta la campagna contro la forza più grande del campo opposto: la indebolisce, ma i toni duri possono ritorcersi contro.', cost: { capital: 5, treasury: 1000 }, party: 0.08, rival: -0.12, risk: 0.35 }
});

// ---------- calendar ----------
const dayOfWeek = date => new Date(`${date}T12:00:00Z`).getUTCDay();
export const sundayOnOrBefore = date => advanceDays(date, -dayOfWeek(date));
const addYears = (date, years) => `${String(Number(date.slice(0, 4)) + years).padStart(4, '0')}${date.slice(4)}`;
// The term of a legislature: first sitting, natural end and the day of the vote at its natural end.
export function legislatureTerm(legislature = {}) {
  const number = legislature.number ?? 19;
  const firstSitting = legislature.firstSitting ?? (legislature.since ? advanceDays(legislature.since, LEGISLATURE_RULES.firstSittingDays) : '2022-10-13');
  const naturalEnd = advanceDays(addYears(firstSitting, LEGISLATURE_RULES.termYears), -1);
  return { number, label: legislatureLabel(number), firstSitting, naturalEnd, plannedVote: sundayOnOrBefore(advanceDays(naturalEnd, -LEGISLATURE_RULES.voteBeforeEndDays)) };
}
// The next European election on or after a date: 2029 and then every five years.
export function europeanElectionDate(after = '2026-01-01') {
  const rule = LEGISLATURE_RULES.european;
  let year = rule.firstYear;
  let date = sundayOnOrBefore(`${year}-${rule.month}-${rule.day}`);
  while (date <= after) { year += rule.cycleYears; date = sundayOnOrBefore(`${year}-${rule.month}-${rule.day}`); }
  return date;
}
// The national votes ahead: the general election of the current legislature and the next European election.
export function nationalCalendar(legislature, today) {
  const term = legislatureTerm(legislature);
  return { politiche: { date: term.plannedVote, naturalEnd: term.naturalEnd, legislature: term }, europee: { date: europeanElectionDate(today) } };
}

// ---------- the forces that stand ----------
// Forces measured by the polls (and the player's party), with their current share of the vote; "Altri" is the rest.
export function voteForces(world) {
  if (!world?.parties?.length) return { forces: [], others: 100 };
  const shares = nationalShares(world);
  const byId = new Map(world.parties.map(party => [party.id, party]));
  const forces = shares.filter(row => row.share > 0 && byId.get(row.partyId)?.active !== false).map(row => {
    const party = byId.get(row.partyId);
    return { id: row.partyId, label: party?.label ?? row.partyId, abbreviation: party?.abbreviation ?? null, position: party?.position ?? null, axis: Number.isFinite(party?.axis) ? party.axis : axisOf(party?.position) ?? 0, color: party?.color ?? null, governing: Boolean(party?.governing), isPlayer: Boolean(party?.isPlayer), strategy: party?.strategy ?? null, share: row.share };
  }).sort((a, b) => b.share - a.share);
  return { forces, others: round2(Math.max(0, 100 - forces.reduce((sum, force) => sum + force.share, 0))) };
}

// ---------- coalitions ----------
const tieOf = (world, a, b) => world?.ties?.[[a, b].sort().join('|')] ?? 0;
const grudgeOf = (world, a, b) => world?.grudges?.[[a, b].sort().join('|')] ?? 0;
const campOf = axis => axis >= 1 ? 'destra' : axis <= -1 ? 'sinistra' : 'centro';
export const COALITION_LABELS = Object.freeze({ destra: 'Centrodestra', sinistra: 'Centrosinistra', centro: 'Centro' });
// Which forces run together: around the largest force of the governing camp and of the opposite camp, the forces that
// are close (collocazione), on good terms (relations, alliances, no recent rupture) and not set on running alone.
// playerChoice: 'alone' or the id of the coalition the player's party joined (decided by its secretary).
export function buildCoalitions(world, { playerChoice = null } = {}) {
  const { forces } = voteForces(world);
  if (!forces.length) return [];
  const allianceWith = id => (world.alliances ?? []).filter(item => item.status === 'active' && item.partyIds.includes(id)).flatMap(item => item.partyIds).filter(other => other !== id);
  // The largest force of each camp leads its coalition, whoever governs.
  const right = forces.filter(force => force.axis >= 1).sort((a, b) => b.share - a.share)[0];
  const left = forces.filter(force => force.axis <= -1).sort((a, b) => b.share - a.share)[0];
  const centre = forces.filter(force => force.axis === 0 && force.share >= 8 && force !== right && force !== left).sort((a, b) => b.share - a.share)[0];
  const anchors = [right, left, centre].filter(Boolean);
  const coalitions = anchors.map(anchor => ({ id: `coalizione-${slug(anchor.id)}`, label: COALITION_LABELS[campOf(anchor.axis)], leaderId: anchor.id, camp: campOf(anchor.axis), partyIds: [anchor.id], simulated: true, source: SIM }));
  const affinity = (force, coalition) => {
    const anchor = forces.find(item => item.id === coalition.leaderId);
    if (!anchor || (coalition.camp === 'destra' && force.axis < 0) || (coalition.camp === 'sinistra' && force.axis > 0) || (coalition.camp === 'centro' && Math.abs(force.axis) > 1)) return -Infinity;
    const allied = allianceWith(force.id).some(id => coalition.partyIds.includes(id) || id === anchor.id);
    const relation = force.isPlayer ? (world.parties.find(item => item.id === anchor.id)?.playerRelation ?? 0) : tieOf(world, force.id, anchor.id);
    let score = relation + (allied ? 40 : 0) - (grudgeOf(world, force.id, anchor.id) ? 60 : 0) - 12 * Math.abs(force.axis - anchor.axis);
    score += force.strategy === 'coalizione' ? 10 : force.strategy === 'autonoma' ? -25 : force.strategy === 'governista' ? (anchor.governing ? 15 : -10) : force.strategy === 'opposizione' ? (anchor.governing ? -15 : 8) : 0;
    return score;
  };
  const player = forces.find(force => force.isPlayer);
  for (const force of forces) {
    if (anchors.includes(force)) continue;
    if (force.isPlayer && playerChoice) {
      const chosen = coalitions.find(item => item.id === playerChoice);
      if (chosen) chosen.partyIds.push(force.id);
      continue;
    }
    const best = coalitions.map(coalition => ({ coalition, score: affinity(force, coalition) })).filter(item => Number.isFinite(item.score)).sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 0) best.coalition.partyIds.push(force.id);
  }
  // Two forces outside the coalitions with an active alliance run together.
  const placed = new Set(coalitions.flatMap(item => item.partyIds));
  for (const force of forces) {
    if (placed.has(force.id) || (force.isPlayer && playerChoice === 'alone')) continue;
    const partners = allianceWith(force.id).filter(id => !placed.has(id) && forces.some(item => item.id === id) && !(forces.find(item => item.id === id)?.isPlayer && playerChoice === 'alone'));
    if (!partners.length) continue;
    const members = [force.id, ...partners].sort((a, b) => (forces.find(item => item.id === b)?.share ?? 0) - (forces.find(item => item.id === a)?.share ?? 0));
    const leader = forces.find(item => item.id === members[0]);
    coalitions.push({ id: `coalizione-${slug(leader.id)}`, label: `Intesa ${members.map(id => forces.find(item => item.id === id)?.abbreviation || forces.find(item => item.id === id)?.label).join(' – ')}`, leaderId: leader.id, camp: campOf(leader.axis), partyIds: members, simulated: true, source: SIM });
    members.forEach(id => placed.add(id));
  }
  // A camp label shared by two coalitions takes the name of its leader.
  for (const coalition of coalitions) if (coalitions.filter(item => item.label === coalition.label).length > 1) coalition.label = `${coalition.label} (${forces.find(item => item.id === coalition.leaderId)?.label ?? ''})`;
  if (player && playerChoice === 'alone') for (const coalition of coalitions) coalition.partyIds = coalition.partyIds.filter(id => id !== player.id || coalition.leaderId === player.id);
  return coalitions.filter(coalition => coalition.partyIds.length > 1 || anchors.some(anchor => anchor.id === coalition.leaderId)).map(coalition => ({ ...coalition, partyIds: coalition.partyIds.sort((a, b) => (forces.find(item => item.id === b)?.share ?? 0) - (forces.find(item => item.id === a)?.share ?? 0)) }));
}
export const coalitionOf = (coalitions = [], partyId) => coalitions.find(coalition => coalition.partyIds.includes(partyId)) ?? null;
// The coalition the player's party could join (the closest camp), with the leader's disposition: shown before deciding.
export function coalitionOptions(world, coalitions = []) {
  const player = voteForces(world).forces.find(force => force.isPlayer);
  if (!player) return [];
  return coalitions.filter(coalition => coalition.leaderId !== player.id).map(coalition => {
    const leader = world.parties.find(item => item.id === coalition.leaderId);
    const compatible = !((coalition.camp === 'destra' && player.axis < 0) || (coalition.camp === 'sinistra' && player.axis > 0) || (coalition.camp === 'centro' && Math.abs(player.axis) > 1));
    const relation = leader?.playerRelation ?? 0;
    const chance = compatible ? round2(clamp(0.45 + relation / 100 - 0.08 * Math.abs(player.axis - (leader?.axis ?? 0)) + (player.share < 4 ? 0.08 : 0) - (grudgeOf(world, player.id, coalition.leaderId) ? 0.3 : 0), 0.05, 0.92)) : 0;
    return { id: coalition.id, label: coalition.label, leaderId: coalition.leaderId, leaderLabel: leader?.label ?? '', compatible, relation: round1(relation), chance };
  }).sort((a, b) => b.chance - a.chance);
}

// ---------- national state ----------
export function createNationalState({ currentDate, legislature = null }) {
  const term = legislatureTerm(legislature ?? { number: 19, firstSitting: '2022-10-13' });
  return { version: 1, legislature: { number: term.number, label: term.label, reference: term.number === 19 ? 'real' : SIM, firstSitting: term.firstSitting, naturalEnd: term.naturalEnd, since: legislature?.since ?? null }, campaign: null, votes: [], lastPolitiche: null, lastEuropee: null, formation: null, history: [], createdAt: currentDate, source: SIM };
}
export function normalizeNationalState(national, { currentDate, legislature = null } = {}) {
  if (!national || typeof national !== 'object') return createNationalState({ currentDate, legislature });
  const term = legislatureTerm(legislature ?? national.legislature ?? {});
  return { votes: [], history: [], campaign: null, formation: null, lastPolitiche: null, lastEuropee: null, ...national, legislature: { ...(national.legislature ?? {}), number: term.number, label: term.label, firstSitting: term.firstSitting, naturalEnd: term.naturalEnd, reference: term.number === 19 ? 'real' : SIM }, version: 1, source: SIM };
}
export function nationalHistory(national, date, kind, text, extra = {}) {
  return { ...national, history: [{ id: `nazionale-${date}-${kind}-${(national.history ?? []).length}`, date, kind, text, ...extra, source: SIM }, ...(national.history ?? [])].slice(0, 60) };
}

// ---------- the geography ----------
// The districts of a comune (ISTAT code of 2026): the player's own districts for the Camera and the Senate.
export function homeDistricts(geography, { municipalityCode = null, region = null, seed = 'casa' } = {}) {
  if (!geography) return null;
  const pick = (list, chamber) => {
    const districts = geography[chamber].collegi;
    const candidates = (list ?? []).map(index => districts[index]).filter(Boolean);
    const pool = candidates.length ? candidates : districts.filter(item => item.region === region);
    if (!pool.length) return null;
    return pool[hash(`${seed}|${chamber}`) % pool.length];
  };
  const entry = municipalityCode ? geography.comuni?.[municipalityCode] : null;
  const camera = pick(entry?.[0], 'camera');
  const senato = pick(entry?.[1], 'senato');
  return { camera, senato, approximate: Boolean(entry?.[2]) || !entry };
}
export const districtById = (geography, chamber, id) => geography?.[chamber]?.collegi?.find(item => item.id === id) ?? null;

// ---------- the vote ----------
function hare(entries, seats) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.votes), 0);
  const result = new Map(entries.map(entry => [entry.id, 0]));
  if (!total || seats <= 0) return result;
  const rows = entries.map(entry => { const quota = Math.max(0, entry.votes) * seats / total; return { id: entry.id, seats: Math.floor(quota), rest: quota - Math.floor(quota) }; });
  const left = seats - rows.reduce((sum, row) => sum + row.seats, 0);
  [...rows].sort((a, b) => b.rest - a.rest || String(a.id).localeCompare(String(b.id))).slice(0, left).forEach(row => { row.seats++; });
  for (const row of rows) result.set(row.id, row.seats);
  return result;
}
function localEstimate(now, base, nat) {
  if (!(nat > 0)) return now;
  const proportional = base * (now / nat);
  const uniform = base + (now - nat);
  return Math.max(base * 0.12, now * 0.06, 0.55 * proportional + 0.45 * uniform);
}
const shareOf = (item, code) => item.valid ? (item.votes[code] ?? 0) * 100 / item.valid : 0;

// The vote of one chamber on its real map: every district, the proportional count, abroad.
function chamberVote(geography, chamber, context) {
  const data = geography[chamber];
  const { forces, coalitionOf: coalitionIdOf, rand, noise, player, contested } = context;
  const present = new Map(forces.map(force => [force.id, force]));
  // Links of the 2022 lists to the forces standing now (shares split among the forces of a joint list).
  const links = new Map();
  for (const [code, ids] of Object.entries(LIST_FORCES)) {
    const members = ids.filter(id => present.has(id));
    if (!members.length) continue;
    const total = members.reduce((sum, id) => sum + present.get(id).share, 0);
    links.set(code, members.map(id => ({ forceId: id, weight: total ? present.get(id).share / total : 1 / members.length })));
  }
  const nationalShare = code => (data.national.lists.find(row => row.code === code)?.votes ?? 0) * 100 / (data.national.valid || 1);
  const listCodes = geography.lists.map(item => item.code);
  const territorial = listCodes.filter(code => TERRITORIAL_LISTS.has(code) && !links.has(code));
  const otherCodes = listCodes.filter(code => !links.has(code) && !TERRITORIAL_LISTS.has(code) && !ABROAD_LISTS.has(code));
  // 2022 national share and district profile of each force (a force without a 2022 list borrows the profile of the
  // forces with the same collocazione).
  const nat2022 = new Map(forces.map(force => [force.id, 0]));
  for (const [code, members] of links) for (const member of members) nat2022.set(member.forceId, nat2022.get(member.forceId) + nationalShare(code) * member.weight);
  const baseOf = (force, item) => { let value = 0; for (const [code, members] of links) for (const member of members) if (member.forceId === force.id) value += shareOf(item, code) * member.weight; return value; };
  const rooted = forces.filter(force => nat2022.get(force.id) > 0);
  const proxyOf = force => {
    for (const range of [0.5, 1.5, 9]) { const close = rooted.filter(item => Math.abs(item.axis - force.axis) <= range); if (close.length) return close; }
    return rooted;
  };
  const districts = data.collegi;
  const weight = item => item.valid || 1;
  const totalWeight = districts.reduce((sum, item) => sum + weight(item), 0);
  const territorialNat = territorial.reduce((sum, code) => sum + districts.reduce((acc, item) => acc + shareOf(item, code) * weight(item), 0) / totalWeight, 0);
  const others2022 = districts.reduce((acc, item) => acc + otherCodes.reduce((sum, code) => sum + shareOf(item, code), 0) * weight(item), 0) / totalWeight;
  const othersTarget = Math.max(0.2, context.others - territorialNat);
  // Matrix district × entry (forces, "others", territorial lists), fitted to the national shares.
  const entries = [...forces.map(force => ({ id: force.id, kind: 'force', target: force.share })), { id: 'altri', kind: 'altri', target: othersTarget }, ...territorial.map(code => ({ id: `lista:${code}`, kind: 'territorial', code }))];
  const matrix = districts.map(item => entries.map(entry => {
    if (entry.kind === 'altri') return Math.max(0.01, otherCodes.reduce((sum, code) => sum + shareOf(item, code), 0) * (others2022 ? othersTarget / others2022 : 0));
    if (entry.kind === 'territorial') return shareOf(item, entry.code);
    const force = present.get(entry.id);
    const nat = nat2022.get(force.id);
    if (nat > 0) return localEstimate(force.share, baseOf(force, item), nat);
    const proxies = proxyOf(force);
    const proxyNat = proxies.reduce((sum, proxy) => sum + nat2022.get(proxy.id), 0);
    const proxyLocal = proxies.reduce((sum, proxy) => sum + baseOf(proxy, item), 0);
    return force.share * Math.pow(proxyNat > 0 ? Math.max(0.05, proxyLocal / proxyNat) : 1, 0.8);
  }));
  const fitted = entries.map((entry, column) => entry.kind !== 'territorial');
  for (let round = 0; round < 8; round++) {
    entries.forEach((entry, column) => {
      if (!fitted[column] || !(entry.target > 0)) return;
      const national = districts.reduce((sum, item, row) => sum + matrix[row][column] * weight(item), 0) / totalWeight;
      if (national > 0) for (const row of matrix) row[column] *= entry.target / national;
    });
    for (const row of matrix) { const total = row.reduce((sum, value) => sum + value, 0) || 1; row.forEach((value, column) => { row[column] = value * 100 / total; }); }
  }
  // The day of the vote: the player's own district, the campaign in the contested districts, every district's surprises.
  const playerIndex = entries.findIndex(entry => entry.id === player?.forceId);
  districts.forEach((item, row) => {
    if (playerIndex >= 0 && player?.districts?.[chamber] === item.id && player.boost) matrix[row][playerIndex] = Math.max(0.1, matrix[row][playerIndex] + player.boost);
    if (playerIndex >= 0 && contested && item.region === player?.region) matrix[row][playerIndex] += contested;
    const total = matrix[row].reduce((sum, value) => sum + value, 0) || 1;
    matrix[row] = matrix[row].map(value => value * 100 / total);
  });
  // Single-member districts: coalitions (or forces alone, or territorial lists) compete; the most voted wins.
  const candidateOf = entry => entry.kind === 'force' ? (coalitionIdOf.get(entry.id) ?? entry.id) : entry.kind === 'territorial' ? entry.id : null;
  const results = districts.map((item, row) => {
    const totals = new Map();
    entries.forEach((entry, column) => { const candidate = candidateOf(entry); if (candidate) totals.set(candidate, (totals.get(candidate) ?? 0) + matrix[row][column]); });
    if (noise) for (const [candidate, value] of totals) if (value > 1) totals.set(candidate, Math.max(0.1, value + rand.gauss() * 1.1));
    const ranking = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const share = Object.fromEntries(entries.map((entry, column) => [entry.id, round2(matrix[row][column])]));
    return { id: item.id, winner: ranking[0]?.[0] ?? null, margin: round2((ranking[0]?.[1] ?? 0) - (ranking[1]?.[1] ?? 0)), top: ranking.slice(0, 3).map(([id, value]) => [id, round1(value)]), candidates: ranking.map(([id, value]) => [id, round2(value)]), shares: share, winner2022: item.winner?.alliance ?? null };
  });
  // Candidacies inside each coalition: in proportion to the forces' shares, spread over safe and contested districts.
  const holders = new Map();
  const coalitionIds = [...new Set(forces.map(force => coalitionIdOf.get(force.id)).filter(Boolean))];
  for (const coalitionId of coalitionIds) {
    const holder = new Map();
    holders.set(coalitionId, holder);
    const members = forces.filter(force => coalitionIdOf.get(force.id) === coalitionId);
    const reserved = player?.districts?.[chamber] && player?.uninominale === chamber && coalitionIdOf.get(player.forceId) === coalitionId ? player.districts[chamber] : null;
    const quotas = hare(members.map(force => ({ id: force.id, votes: force.share })), districts.length);
    if (reserved) { holder.set(reserved, player.forceId); quotas.set(player.forceId, Math.max(0, quotas.get(player.forceId) - 1)); }
    const assigned = new Map(members.map(force => [force.id, 0]));
    const order = results.map((result, index) => ({ id: result.id, strength: result.top.find(([id]) => id === coalitionId)?.[1] ?? 0, index })).filter(item => item.id !== reserved).sort((a, b) => b.strength - a.strength || a.index - b.index);
    order.forEach((district, step) => {
      const pick = [...members].sort((a, b) => ((quotas.get(b.id) * (step + 1) / order.length - assigned.get(b.id)) - (quotas.get(a.id) * (step + 1) / order.length - assigned.get(a.id))) || b.share - a.share)[0];
      holder.set(district.id, pick.id);
      assigned.set(pick.id, assigned.get(pick.id) + 1);
    });
  }
  for (const result of results) {
    const winnerEntry = entries.find(entry => entry.id === result.winner);
    result.party = coalitionIds.includes(result.winner) ? holders.get(result.winner)?.get(result.id) ?? null : winnerEntry ? winnerEntry.id : result.winner;
  }
  // Votes of every entry: national (Italy) and by region, from the fitted matrix.
  const regionVotes = new Map();
  const national = new Map(entries.map(entry => [entry.id, 0]));
  districts.forEach((item, row) => {
    const region = regionVotes.get(item.region) ?? new Map(entries.map(entry => [entry.id, 0]));
    entries.forEach((entry, column) => { const votes = matrix[row][column] * weight(item) / 100; national.set(entry.id, national.get(entry.id) + votes); region.set(entry.id, region.get(entry.id) + votes); });
    regionVotes.set(item.region, region);
  });
  const nationalTotal = [...national.values()].reduce((sum, value) => sum + value, 0) || 1;
  const nationalShares = new Map([...national.entries()].map(([id, votes]) => [id, votes * 100 / nationalTotal]));
  const regionalShare = (region, id) => { const votes = regionVotes.get(region); if (!votes) return 0; const total = [...votes.values()].reduce((sum, value) => sum + value, 0) || 1; return (votes.get(id) ?? 0) * 100 / total; };
  // Proportional count: who passes the thresholds, then seats by quotient and highest remainders.
  const rules = LEGISLATURE_RULES.thresholds;
  const lists = entries.filter(entry => entry.kind !== 'altri').map(entry => {
    const share = nationalShares.get(entry.id) ?? 0;
    const home = entry.kind === 'territorial' ? districts.find(item => shareOf(item, entry.code) > 0)?.region : null;
    return { id: entry.id, share, coalitionId: entry.kind === 'force' ? coalitionIdOf.get(entry.id) ?? null : null, own: share >= rules.list || (entry.kind === 'territorial' && home && regionalShare(home, entry.id) >= rules.regional) };
  });
  const units = [];
  for (const coalitionId of coalitionIds) {
    const members = lists.filter(list => list.coalitionId === coalitionId);
    const qualified = members.filter(list => list.own);
    // The votes of the coalition lists between 1% and 3% count for the coalition; only the lists at 3% get seats.
    const counted = members.filter(list => list.own || list.share >= rules.coalitionFloor);
    const total = counted.reduce((sum, list) => sum + list.share, 0);
    if (total >= rules.coalition && qualified.length) units.push({ id: coalitionId, members: qualified, counted, qualifiedCoalition: true });
    else for (const list of qualified) units.push({ id: list.id, members: [list], counted: [list] });
  }
  for (const list of lists.filter(item => !item.coalitionId && item.own)) units.push({ id: list.id, members: [list], counted: [list] });
  const proportional = new Map(entries.map(entry => [entry.id, 0]));
  const byRegion = {};
  const splitUnits = (seats, votesOf) => {
    const unitSeats = hare(units.map(unit => ({ id: unit.id, votes: unit.counted.reduce((sum, list) => sum + votesOf(list.id), 0) })), seats);
    const out = new Map();
    for (const unit of units) {
      const inside = unit.members.length > 1 ? hare(unit.members.map(list => ({ id: list.id, votes: votesOf(list.id) })), unitSeats.get(unit.id)) : new Map([[unit.members[0].id, unitSeats.get(unit.id)]]);
      for (const [id, value] of inside) out.set(id, (out.get(id) ?? 0) + value);
    }
    return out;
  };
  if (chamber === 'camera') for (const [id, seats] of splitUnits(data.seats.proporzionali, id => nationalShares.get(id) ?? 0)) proportional.set(id, seats);
  else for (const circ of data.circoscrizioni.filter(item => item.proporzionali > 0)) {
    const region = circ.region;
    const seats = splitUnits(circ.proporzionali, id => regionalShare(region, id));
    byRegion[region] = Object.fromEntries([...seats.entries()].filter(([, value]) => value > 0));
    for (const [id, value] of seats) proportional.set(id, proportional.get(id) + value);
  }
  // Abroad: every ripartizione by quotient and highest remainders among its lists (the 2022 vote abroad, moved as the forces moved in Italy).
  const abroad = new Map();
  for (const area of data.estero) {
    const rows = [];
    for (const code of Object.keys(area.votes)) {
      const share = shareOf(area, code);
      if (links.has(code)) for (const member of links.get(code)) { const force = present.get(member.forceId); const nat = nat2022.get(force.id); rows.push({ id: force.id, votes: share * member.weight * (nat > 0 ? clamp(force.share / nat, 0.3, 3) : 1) }); }
      else rows.push({ id: `lista:${code}`, votes: share });
    }
    const merged = new Map();
    for (const row of rows) merged.set(row.id, (merged.get(row.id) ?? 0) + row.votes);
    for (const [id, seats] of hare([...merged.entries()].map(([id, votes]) => ({ id, votes })), area.seats)) if (seats) abroad.set(id, (abroad.get(id) ?? 0) + seats);
  }
  // Seats by party and by coalition.
  const parties = new Map();
  const add = (id, key, value) => { if (!value || !id) return; const row = parties.get(id) ?? { id, uni: 0, prop: 0, estero: 0, seats: 0 }; row[key] += value; row.seats += value; parties.set(id, row); };
  for (const result of results) add(result.party ?? result.winner, 'uni', 1);
  for (const [id, seats] of proportional) add(id, 'prop', seats);
  for (const [id, seats] of abroad) add(id, 'estero', seats);
  const partyRows = [...parties.values()].map(row => ({ ...row, share: round2(nationalShares.get(row.id) ?? 0), coalitionId: coalitionIdOf.get(row.id) ?? null })).sort((a, b) => b.seats - a.seats || b.share - a.share);
  const coalitionRows = coalitionIds.map(id => { const members = partyRows.filter(row => row.coalitionId === id); return { id, uni: members.reduce((sum, row) => sum + row.uni, 0), prop: members.reduce((sum, row) => sum + row.prop, 0), estero: members.reduce((sum, row) => sum + row.estero, 0), seats: members.reduce((sum, row) => sum + row.seats, 0), share: round2(lists.filter(list => list.coalitionId === id).reduce((sum, list) => sum + list.share, 0)) }; }).sort((a, b) => b.seats - a.seats);
  const total = partyRows.reduce((sum, row) => sum + row.seats, 0);
  return {
    chamber, total, majority: Math.floor(total / 2) + 1, parties: partyRows, coalitions: coalitionRows, byRegion,
    collegi: results.map(result => ({ id: result.id, w: result.winner, p: result.party, m: result.margin, t: result.top, f: result.winner2022 })),
    shares: Object.fromEntries([...nationalShares.entries()].map(([id, value]) => [id, round2(value)])),
    // The player's list: its votes in each multi-member district (for the seats of the player's constituency).
    playerLists: player?.forceId ? Object.fromEntries(data.plurinominali.map(pluri => [pluri.id, round2(districts.reduce((sum, item, row) => item.plurinominale === pluri.id ? sum + matrix[row][playerIndex] * weight(item) / 100 : sum, 0))])) : null,
    playerNational: player?.forceId ? round2(national.get(player.forceId) ?? 0) : null,
    _shares: results
  };
}

// A fallback when the map of 2022 is not available (offline, first visit): same thresholds, seats in proportion.
function simplifiedChamber(chamber, context) {
  const { forces, coalitionOf: coalitionIdOf } = context;
  const seats = LEGISLATURE_RULES.seats[chamber];
  const uni = chamber === 'camera' ? 147 : 74;
  const entries = forces.map(force => ({ id: coalitionIdOf.get(force.id) ?? force.id, force }));
  const blocs = new Map();
  for (const entry of entries) blocs.set(entry.id, (blocs.get(entry.id) ?? 0) + entry.force.share);
  // Single-member districts favour the largest blocs (square of the share), then everyone by quotient.
  const uniSeats = hare([...blocs.entries()].map(([id, share]) => ({ id, votes: share * share })), uni);
  const parties = new Map();
  for (const [bloc, count] of uniSeats) {
    const members = forces.filter(force => (coalitionIdOf.get(force.id) ?? force.id) === bloc);
    for (const [id, value] of hare(members.map(force => ({ id: force.id, votes: force.share })), count)) if (value) parties.set(id, { id, uni: value, prop: 0, estero: 0, seats: value });
  }
  const qualified = forces.filter(force => force.share >= LEGISLATURE_RULES.thresholds.list);
  for (const [id, value] of hare(qualified.map(force => ({ id: force.id, votes: force.share })), seats - uni)) {
    const row = parties.get(id) ?? { id, uni: 0, prop: 0, estero: 0, seats: 0 };
    row.prop += value; row.seats += value; parties.set(id, row);
  }
  const partyRows = [...parties.values()].map(row => ({ ...row, share: forces.find(force => force.id === row.id)?.share ?? 0, coalitionId: coalitionIdOf.get(row.id) ?? null })).sort((a, b) => b.seats - a.seats);
  const coalitionRows = [...new Set(forces.map(force => coalitionIdOf.get(force.id)).filter(Boolean))].map(id => { const members = partyRows.filter(row => row.coalitionId === id); return { id, uni: members.reduce((sum, row) => sum + row.uni, 0), prop: members.reduce((sum, row) => sum + row.prop, 0), estero: 0, seats: members.reduce((sum, row) => sum + row.seats, 0), share: round2(forces.filter(force => coalitionIdOf.get(force.id) === id).reduce((sum, force) => sum + force.share, 0)) }; });
  return { chamber, total: seats, majority: Math.floor(seats / 2) + 1, parties: partyRows, coalitions: coalitionRows, byRegion: {}, collegi: [], shares: Object.fromEntries(forces.map(force => [force.id, force.share])), playerLists: null, playerNational: null, _shares: [] };
}

// The general election. coalitions: from buildCoalitions (fixed when the lists are filed). player: { forceId, region,
// districts: { camera, senato } (ids), uninominale: 'camera' when the player runs in a single-member district, boost }.
export function runNationalVote({ geography = null, world, coalitions = [], date, seed = 'politiche', player = null, noise = true, line = null, participation = 60 }) {
  const rand = random(hash(`${seed}|${date}|politiche`));
  const base = voteForces(world);
  // Election day: undecided voters, turnout and the error of every poll move each force a little (never in the projection).
  const forces = base.forces.map(force => ({ ...force, share: noise ? Math.max(0.05, force.share + rand.gauss() * (0.25 + 0.1 * Math.sqrt(force.share))) : force.share }));
  const total = forces.reduce((sum, force) => sum + force.share, 0) + base.others;
  forces.forEach(force => { force.share = round2(force.share * 100 / total); });
  const others = round2(base.others * 100 / total);
  const coalitionIdOf = new Map(coalitions.flatMap(coalition => coalition.partyIds.filter(id => forces.some(force => force.id === id)).map(id => [id, coalition.id])));
  const context = { forces, others, coalitionOf: coalitionIdOf, rand, noise, player, contested: line === 'territori' ? NATIONAL_LINES.territori.contested : 0 };
  const chambers = Object.fromEntries(['camera', 'senato'].map(chamber => [chamber, geography ? chamberVote(geography, chamber, context) : simplifiedChamber(chamber, context)]));
  const labels = new Map(forces.map(force => [force.id, force.label]));
  const listName = code => geography?.lists?.find(item => item.code === code)?.name ?? code;
  const labelOf = id => labels.get(id) ?? coalitions.find(item => item.id === id)?.label ?? (String(id).startsWith('lista:') ? listName(String(id).slice(6)) : id);
  for (const chamber of Object.values(chambers)) { for (const row of chamber.parties) row.label = labelOf(row.id); for (const row of chamber.coalitions) row.label = labelOf(row.id); }
  // Who has a majority in both Chambers (coalitions first, then a single force).
  const blocs = [...new Set([...chambers.camera.coalitions.map(row => row.id), ...chambers.camera.parties.filter(row => !row.coalitionId).map(row => row.id)])];
  const seatsOf = (chamber, id) => chamber.coalitions.find(row => row.id === id)?.seats ?? chamber.parties.find(row => row.id === id && !row.coalitionId)?.seats ?? 0;
  const winner = blocs.find(id => seatsOf(chambers.camera, id) >= chambers.camera.majority && seatsOf(chambers.senato, id) >= chambers.senato.majority) ?? null;
  const largest = [...blocs].sort((a, b) => seatsOf(chambers.camera, b) + seatsOf(chambers.senato, b) - seatsOf(chambers.camera, a) - seatsOf(chambers.senato, a))[0] ?? null;
  const turnout = round1(clamp(63.9 + (participation - 60) * 0.45 + (noise ? rand.gauss() * 1.4 : 0), 45, 80));
  return {
    id: `politiche-${date}`, type: 'politiche', date, model: geography ? 'geografia-2022' : 'semplificato', turnout,
    national: forces.map(force => ({ id: force.id, label: force.label, share: chambers.camera.shares[force.id] ?? force.share, coalitionId: coalitionIdOf.get(force.id) ?? null, isPlayer: force.isPlayer, color: force.color })).sort((a, b) => b.share - a.share),
    others: round2(chambers.camera.shares.altri ?? others),
    coalitions: coalitions.map(coalition => ({ id: coalition.id, label: coalition.label, leaderId: coalition.leaderId, camp: coalition.camp, partyIds: coalition.partyIds.filter(id => labels.has(id)), share: chambers.camera.coalitions.find(row => row.id === coalition.id)?.share ?? 0 })),
    camera: chambers.camera, senato: chambers.senato, winner, largest, hung: !winner, source: SIM
  };
}
// A projection from the current polls, without the surprises of the vote (for the national view).
export function nationalProjection(options) {
  const result = runNationalVote({ ...options, noise: false, date: options.date ?? 'proiezione' });
  for (const chamber of ['camera', 'senato']) delete result[chamber]._shares;
  return result;
}
// Districts in the balance: margin under 4 points, with the two forces in contention.
export function contestedDistricts(result, chamber, limit = 4, geography = null) {
  return districtRows(result, chamber, geography).filter(item => item.m < limit).sort((a, b) => a.m - b.m);
}
// The compact record kept in the save: no matrices, and the districts as short rows (in the order of the map of
// electoral-geography.json) with the ids of coalitions and forces through a legend. districtRows reads them back.
export function compactResult(result) {
  if (!result) return result;
  const out = copy(result);
  for (const chamber of ['camera', 'senato']) {
    const data = out[chamber];
    if (!data) continue;
    delete data._shares; delete data.playerLists; delete data.playerNational;
    if (Array.isArray(data.collegi)) {
      const legend = [];
      const key = id => { if (id == null) return -1; let index = legend.indexOf(id); if (index < 0) index = legend.push(id) - 1; return index; };
      data.collegi = { legend, rows: data.collegi.map(item => [key(item.w), key(item.p), item.m, item.t.map(([id, value]) => [key(id), value]), item.f ?? null]) };
    }
  }
  return out;
}
// The districts of a result as objects { id, w (winning coalition or list), p (winning force), m (margin), t (first
// three), f (alliance of the 2022 winner) }, from a full or a compact result (ids from the map).
export function districtRows(result, chamber, geography = null) {
  const data = result?.[chamber]?.collegi;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const at = index => index >= 0 ? data.legend[index] ?? null : null;
  const map = geography?.[chamber]?.collegi ?? [];
  return data.rows.map((row, index) => ({ id: map[index]?.id ?? `${chamber}-${index}`, w: at(row[0]), p: at(row[1]), m: row[2], t: row[3].map(([key, value]) => [at(key), value]), f: row[4] }));
}

// ---------- the player's own result ----------
// How the player fares: the single-member district (the coalition's candidate), then the list in the multi-member district.
export function politicheOutcome(result, player, { geography = null, rand = random(hash(`${result?.id}|posto`)) } = {}) {
  if (!result || !player?.candidate) return { code: 'escluso', mandate: false };
  const chamber = player.chamber;
  const data = result[chamber];
  const partyRow = data.parties.find(row => row.id === player.forceId);
  const share = data.shares?.[player.forceId] ?? result.national.find(row => row.id === player.forceId)?.share ?? 0;
  const coalitionId = result.coalitions.find(coalition => coalition.partyIds.includes(player.forceId))?.id ?? null;
  const threshold = LEGISLATURE_RULES.thresholds.list;
  const belowThreshold = share < threshold && !(partyRow?.prop > 0);
  // Seats of the player's list in the player's multi-member district (Senate: its share of the regional seats). A party
  // leader heads the list in up to five multi-member districts (the home one and the strongest ones), as the law allows.
  const district = geography ? districtById(geography, chamber, player.districts?.[chamber]) : null;
  const plurinominali = geography?.[chamber]?.plurinominali ?? [];
  const home = plurinominali.find(item => item.id === district?.plurinominale) ?? null;
  const votes = data.playerLists ?? {};
  const needed = Math.max(1, player.listPosition ?? 1);
  const roll = exact => Math.floor(exact) + (rand() < exact - Math.floor(exact) ? 1 : 0);
  const exactIn = pluri => {
    if (chamber === 'senato') {
      const regional = plurinominali.filter(item => item.region === pluri.region).reduce((sum, item) => sum + (votes[item.id] ?? 0), 0) || 1;
      return (data.byRegion?.[pluri.region]?.[player.forceId] ?? 0) * (votes[pluri.id] ?? 0) / regional;
    }
    return partyRow.prop * (votes[pluri.id] ?? 0) / (data.playerNational || 1);
  };
  const candidacies = player.leader ? LEGISLATURE_RULES.leaderCandidacies : 1;
  let listSeats = 0;
  let constituency = null;
  if (partyRow?.prop > 0 && home) {
    const pool = [home, ...plurinominali.filter(item => item !== home).map(item => ({ item, exact: exactIn(item) })).sort((a, b) => b.exact - a.exact).slice(0, candidacies - 1).map(entry => entry.item)];
    const tried = pool.map(pluri => { const exact = exactIn(pluri); return { pluri, exact, seats: roll(exact) }; });
    const pick = tried.find(entry => entry.seats >= needed) ?? tried[0];
    listSeats = pick.seats;
    constituency = { name: pick.pluri.name, seats: pick.seats, exact: round2(pick.exact), candidacies: tried.length };
  } else if (partyRow?.prop > 0) {
    // Without the map: the average multi-member district of the chamber.
    const exact = partyRow.prop / LEGISLATURE_RULES.plurinominali[chamber];
    const tries = Array.from({ length: candidacies }, () => roll(exact));
    listSeats = tries.find(value => value >= needed) ?? tries[0];
    constituency = { name: null, seats: listSeats, exact: round2(exact), candidacies };
  }
  const race = district ? districtRows(result, chamber, geography).find(item => item.id === district.id) ?? null : null;
  const ownCandidate = coalitionId ?? player.forceId;
  // Every candidate of the district from the full result of the vote when available, otherwise the first three.
  const ranking = (race ? data._shares?.find(item => item.id === race.id)?.candidates : null) ?? race?.t ?? [];
  const index = ranking.findIndex(([id]) => id === ownCandidate);
  const position = race ? (index >= 0 ? index + 1 : ranking.length + 1) : null;
  const districtShare = index >= 0 ? round1(ranking[index][1]) : null;
  const districtInfo = race ? { id: district.id, code: district.code, name: district.name, winner: race.w, winnerParty: race.p, margin: race.m, position, share: districtShare, top: race.t, winner2022: district.winner?.name ?? null, alliance2022: district.winner?.alliance ?? null } : null;
  const base = { threshold, belowThreshold, share: round2(share), listSeats, listPosition: player.listPosition, constituency, district: districtInfo, coalitionId, chamber };
  if (player.uninominale === chamber && race && race.w === ownCandidate && race.p === player.forceId) return { ...base, code: 'vittoria', mandate: true, via: 'collegio' };
  if (listSeats >= Math.max(1, player.listPosition ?? 1)) return { ...base, code: player.uninominale === chamber ? 'eletto-proporzionale' : 'eletto-lista', mandate: true, via: player.uninominale === chamber ? 'proporzionale' : 'lista' };
  if (belowThreshold) return { ...base, code: 'sotto-soglia', mandate: false };
  return { ...base, code: listSeats > 0 ? 'posizione-lista' : 'sconfitta', mandate: false };
}

// ---------- the European election ----------
// 76 seats, 4% threshold, quotient and highest remainders nationally; the five circoscrizioni receive seats in
// proportion to their voters of 2022 and every list's seats in proportion to its votes there (simplified).
export function runEuropeanVote({ geography = null, world, date, seed = 'europee', noise = true, participation = 60 }) {
  const rand = random(hash(`${seed}|${date}|europee`));
  const base = voteForces(world);
  const forces = base.forces.map(force => ({ ...force, share: noise ? Math.max(0.05, force.share + rand.gauss() * (0.3 + 0.12 * Math.sqrt(force.share))) : force.share }));
  const total = forces.reduce((sum, force) => sum + force.share, 0) + base.others;
  forces.forEach(force => { force.share = round2(force.share * 100 / total); });
  const rule = LEGISLATURE_RULES.european;
  const qualified = forces.filter(force => force.share >= rule.threshold);
  const seats = hare(qualified.map(force => ({ id: force.id, votes: force.share })), rule.seats);
  // Territory: the 2022 map (Camera) grouped by European circoscrizione.
  const regionsOf = Object.entries(EUROPEAN_CONSTITUENCIES);
  const electors = Object.fromEntries(regionsOf.map(([id, regions]) => [id, geography ? geography.camera.collegi.filter(item => regions.includes(item.region)).reduce((sum, item) => sum + (item.electors ?? item.valid ?? 0), 0) : regions.length]));
  const areaSeats = hare(Object.entries(electors).map(([id, votes]) => ({ id, votes })), rule.seats);
  let areaShares = null;
  if (geography) {
    const projection = chamberVote(geography, 'camera', { forces, others: round2(base.others * 100 / total), coalitionOf: new Map(), rand, noise: false, player: null, contested: 0 });
    const data = geography.camera.collegi;
    areaShares = Object.fromEntries(regionsOf.map(([id, regions]) => {
      const rows = projection._shares.map((result, index) => ({ result, item: data[index] })).filter(row => regions.includes(row.item.region));
      const weight = rows.reduce((sum, row) => sum + row.item.valid, 0) || 1;
      return [id, Object.fromEntries(forces.map(force => [force.id, round2(rows.reduce((sum, row) => sum + (row.result.shares[force.id] ?? 0) * row.item.valid, 0) / weight)]))];
    }));
  }
  const byArea = {};
  for (const force of qualified) {
    const count = seats.get(force.id) ?? 0;
    const split = hare(regionsOf.map(([id]) => ({ id, votes: (areaShares?.[id]?.[force.id] ?? force.share) * (areaSeats.get(id) ?? 1) })), count);
    for (const [area, value] of split) if (value) byArea[area] = { ...(byArea[area] ?? {}), [force.id]: value };
  }
  return {
    id: `europee-${date}`, type: 'europee', date, model: geography ? 'geografia-2022' : 'semplificato', turnout: round1(clamp(49.7 + (participation - 60) * 0.4 + (noise ? rand.gauss() * 1.5 : 0), 35, 70)),
    national: forces.map(force => ({ id: force.id, label: force.label, share: force.share, seats: seats.get(force.id) ?? 0, isPlayer: force.isPlayer, color: force.color })).sort((a, b) => b.share - a.share),
    others: round2(base.others * 100 / total), threshold: rule.threshold, seats: rule.seats,
    areas: regionsOf.map(([id, regions]) => ({ id, regions, seats: areaSeats.get(id) ?? 0, parties: byArea[id] ?? {}, shares: areaShares?.[id] ?? null })), source: SIM
  };
}
// The player's list seats in the player's European circoscrizione (the preferences decide who takes them).
export function europeanListSeats(result, { forceId, region }) {
  const area = result?.areas?.find(item => item.regions.includes(region));
  return { seats: area?.parties?.[forceId] ?? 0, area: area?.id ?? null, national: result?.national?.find(row => row.id === forceId) ?? null };
}

// ---------- the new Chambers ----------
// Groups of the new legislature: a party with enough members forms its own group; the others sit in the Misto, where
// every force is a political component that votes as one (they count as groups of the game, "Misto – party"). The
// lists without a force of the game (territorial lists) make up the rest of the Misto.
export function legislatureGroups(result, { number, date, world = null }) {
  const rules = LEGISLATURE_RULES.groups;
  const parties = new Map((world?.parties ?? []).map(party => [party.id, party]));
  const reference = seats => ({ memberCount: seats, leaderPoliticianId: null, countAsOf: date, source: SIM, verified: false, sourceUrl: null, sourceName: 'Composizione simulata dopo il voto' });
  const groupOf = (chamber, row, component) => {
    const party = parties.get(row.id);
    return { groupId: `leg${number}-${chamber}-${component ? 'misto-' : ''}${slug(row.id)}`, officialName: component ? `Misto – ${row.label}` : row.label, chamber, simulatedSeats: row.seats, partyId: row.id, component, position: party?.position ?? null, axis: Number.isFinite(party?.axis) ? party.axis : axisOf(party?.position) ?? 0, color: party?.color ?? null, legislature: number, simulated: true, reference: reference(row.seats), source: SIM };
  };
  return Object.fromEntries(['camera', 'senato'].map(chamber => {
    const data = result[chamber];
    const groups = [];
    const misto = { members: 0, components: [] };
    for (const row of data.parties.filter(item => item.seats > 0)) {
      const passed = (data.shares?.[row.id] ?? 0) >= LEGISLATURE_RULES.thresholds.list;
      const own = chamber === 'camera' ? row.seats >= rules.camera || (row.seats >= rules.cameraWaiver && passed) : row.seats >= rules.senato;
      if (String(row.id).startsWith('lista:')) { misto.members += row.seats; misto.components.push({ partyId: null, listId: row.id, label: row.label, seats: row.seats }); }
      else groups.push(groupOf(chamber, row, !own));
    }
    if (misto.members) groups.push({ groupId: `leg${number}-${chamber}-misto`, officialName: 'Misto – liste territoriali', chamber, simulatedSeats: misto.members, partyId: null, component: true, components: misto.components, position: null, axis: 0, color: null, legislature: number, simulated: true, reference: reference(misto.members), source: SIM });
    return [chamber, groups.sort((a, b) => Number(a.component) - Number(b.component) || b.simulatedSeats - a.simulatedSeats)];
  }));
}
// The group of a party in the new legislature (its own, or its component of the Misto).
export function groupOfParty(parliament, chamber, partyId) {
  const groups = parliament?.chambers?.[chamber]?.groups ?? [];
  return groups.find(group => partyId && group.partyId === partyId) ?? groups.find(group => group.components?.some(item => item.partyId === partyId)) ?? groups.find(group => /^misto/i.test(group.officialName ?? '') && !group.partyId) ?? null;
}
// The old legislature closes, the new Chambers open: groups replaced, bills lapse, the Government stays for current
// business until a new one wins the confidence. The player's seat is closed here and given back by seatPlayer.
export function openLegislature(parliament, { result, number, date, groups, world = null }) {
  const base = parliament ?? { chambers: {}, relations: {}, laws: [], history: [], pastMandates: [], resources: { politicalCapital: 30, source: SIM }, source: SIM };
  const next = copy(base);
  const previous = next.legislature ?? { number: 19, label: 'XIX legislatura', reference: 'real' };
  next.pastLegislatures = [...(next.pastLegislatures ?? []), { number: previous.number, label: previous.label ?? legislatureLabel(previous.number), reference: previous.reference ?? 'real', endedAt: date, chambers: Object.fromEntries(['camera', 'senato'].map(chamber => [chamber, (next.chambers?.[chamber]?.groups ?? []).map(group => ({ groupId: group.groupId, officialName: group.officialName, seats: group.simulatedSeats }))])), government: next.government ? { id: next.government.id, name: next.government.name, status: next.government.status } : null, source: SIM }].slice(-6);
  next.legislature = { number, label: `${legislatureLabel(number)} (simulata)`, reference: SIM, since: date, firstSitting: advanceDays(date, LEGISLATURE_RULES.firstSittingDays), resultId: result.id, source: SIM };
  next.chambers = Object.fromEntries(['camera', 'senato'].map(chamber => [chamber, { id: `legislatura-${number}-${chamber}`, chamber, label: chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica', groups: groups[chamber], source: SIM }]));
  const player = world?.parties?.find(party => party.isPlayer);
  next.relations = Object.fromEntries(['camera', 'senato'].flatMap(chamber => groups[chamber].map(group => {
    const party = world?.parties?.find(item => item.id === group.partyId);
    const value = group.partyId && group.partyId === player?.id ? 70 : clamp(Math.round(50 + (party?.playerRelation ?? 0) / 2), 20, 80);
    return [group.groupId, { value, source: SIM }];
  })));
  next.laws = (next.laws ?? []).map(law => ['approved', 'rejected', 'lapsed'].includes(law.stage) ? law : { ...law, stage: 'lapsed', status: 'lapsed', lapsedReason: 'Fine della legislatura', updatedAt: date });
  if (next.player) next.pastMandates = [...(next.pastMandates ?? []), { id: `mandato-${previous.number}-${date}`, chamber: next.player.chamber, groupId: next.player.groupId, startedAt: next.player.mandateStartedAt ?? next.createdAt ?? null, endedAt: date, roles: next.careerStanding?.roles ?? [], reason: `Fine della ${previous.label ?? legislatureLabel(previous.number)}`, previous: { chamber: next.player.chamber, mandateStartedAt: next.player.mandateStartedAt ?? null }, source: SIM }];
  next.previousPlayer = next.player ? { chamber: next.player.chamber, mandateStartedAt: next.player.mandateStartedAt ?? null } : null;
  next.player = null;
  next.careerStanding = null;
  next.contextMode = null;
  // Also a Government that had lost the confidence stays in office for current business until the new one is sworn in.
  if (next.government && ['active', 'crisis', 'awaiting-confidence', 'fallen'].includes(next.government.status)) next.government = { ...next.government, status: 'caretaker', caretakerSince: date, statusBefore: next.government.status };
  next.history = [...(next.history ?? []), { id: `legislatura-${number}-${date}`, date, type: 'nuova-legislatura', text: `Si chiude la ${previous.label ?? legislatureLabel(previous.number)}: dopo il voto del ${date} nascono le Camere della ${legislatureLabel(number)} (simulata). Le proposte ancora in esame decadono.`, details: { number, resultId: result.id }, source: SIM }];
  return next;
}
// The player takes a seat of the party in the new Chambers (the seat is already counted in the group).
export function seatPlayer(parliament, { politicianId, chamber, groupId, territoryName = null, date }) {
  const next = copy(parliament);
  const group = (next.chambers?.[chamber]?.groups ?? []).find(item => item.groupId === groupId) ?? null;
  const continuing = next.previousPlayer?.chamber === chamber;
  next.player = { politicianId, chamber, groupId: group?.groupId ?? null, position: 'Componente del gruppo nello scenario', territoryName, mandateStartedAt: continuing ? next.previousPlayer.mandateStartedAt ?? date : date, source: SIM };
  next.contextMode = 'real-context';
  next.careerStanding = { position: 'Componente del gruppo nello scenario', roleLevel: 0, committeeRole: null, roles: [], partySupport: 55, competitionStrength: 50, lastContestAt: null, lastContest: null, source: SIM };
  next.history = [...(next.history ?? []), { id: `seggio-${chamber}-${date}`, date, type: continuing ? 'rielezione' : 'ingresso', text: `${chamber === 'camera' ? 'Camera' : 'Senato'}: ${continuing ? 'rieletto, il mandato prosegue' : 'eletto'} con il gruppo ${group?.officialName ?? 'Misto'} nella nuova legislatura (simulazione).`, details: { chamber, groupId: group?.groupId ?? null, source: SIM }, source: SIM }];
  return next;
}

// ---------- the formation of the Government ----------
const seatsIn = (parliament, chamber, groupIds) => (parliament.chambers?.[chamber]?.groups ?? []).filter(group => groupIds.includes(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
const totalIn = (parliament, chamber) => (parliament.chambers?.[chamber]?.groups ?? []).reduce((sum, group) => sum + group.simulatedSeats, 0);
const hasMajority = (parliament, groupIds) => ['camera', 'senato'].every(chamber => seatsIn(parliament, chamber, groupIds) >= Math.floor(totalIn(parliament, chamber) / 2) + 1);
const groupsOfParties = (parliament, partyIds) => ['camera', 'senato'].flatMap(chamber => (parliament.chambers?.[chamber]?.groups ?? []).filter(group => partyIds.includes(group.partyId)).map(group => group.groupId));
// Who can govern after the vote: the coalition that won both Chambers; otherwise the largest one with the closest
// partners; otherwise a broad Government of the President (every force but the far ends). null: no majority at all.
// exclude: forces that said no (the player's party in opposition); include: forces that joined the majority.
export function majorityAfterVote(parliament, result, world = null, { exclude = [], include = [] } = {}) {
  const coalitions = result.coalitions ?? [];
  const forcesOf = id => coalitions.find(item => item.id === id)?.partyIds ?? [id];
  const axis = id => world?.parties?.find(item => item.id === id)?.axis ?? 0;
  const out = partyIds => [...new Set([...partyIds, ...include])].filter(id => !exclude.includes(id));
  const blocs = [...coalitions.map(item => ({ id: item.id, partyIds: out(item.partyIds), leaderId: item.leaderId, coalition: true })), ...result.camera.parties.filter(row => !row.coalitionId && !String(row.id).startsWith('lista:') && !exclude.includes(row.id)).map(row => ({ id: row.id, partyIds: [row.id], leaderId: row.id, coalition: false }))].filter(bloc => bloc.partyIds.length && !exclude.includes(bloc.leaderId));
  const weightOf = bloc => ['camera', 'senato'].reduce((sum, chamber) => sum + bloc.partyIds.reduce((acc, id) => acc + (result[chamber].parties.find(row => row.id === id)?.seats ?? 0), 0), 0);
  const marginOf = partyIds => Math.min(...['camera', 'senato'].map(chamber => seatsIn(parliament, chamber, groupsOfParties(parliament, partyIds)) - Math.floor(totalIn(parliament, chamber) / 2) - 1));
  // A thin majority looks for the support of the closest forces that ran alone, up to a safe margin.
  const widen = (partyIds, leaderAxis, candidates) => {
    const ids = [...partyIds];
    for (const bloc of candidates) {
      if (marginOf(ids) >= LEGISLATURE_RULES.safeMargin) break;
      if (Math.abs(axis(bloc.leaderId) - leaderAxis) > 1) continue;
      ids.push(...bloc.partyIds.filter(id => !ids.includes(id)));
    }
    return marginOf(ids) > marginOf(partyIds) ? ids : partyIds;
  };
  const byCloseness = (leaderAxis, skip) => blocs.filter(bloc => !skip(bloc)).sort((a, b) => Math.abs(axis(a.leaderId) - leaderAxis) - Math.abs(axis(b.leaderId) - leaderAxis) || weightOf(b) - weightOf(a));
  const majority = (kind, leaderId, partyIds, label) => ({ kind, leaderId, partyIds, groupIds: groupsOfParties(parliament, partyIds), label });
  if (result.winner) {
    const partyIds = out(forcesOf(result.winner));
    if (marginOf(partyIds) >= 0) {
      const winner = coalitions.find(item => item.id === result.winner);
      const leaderId = winner?.leaderId ?? result.winner;
      return majority('coalizione', leaderId, widen(partyIds, axis(leaderId), byCloseness(axis(leaderId), bloc => bloc.coalition || bloc.partyIds.some(id => partyIds.includes(id)))), winner?.label ?? null);
    }
  }
  const largest = [...blocs].sort((a, b) => weightOf(b) - weightOf(a))[0];
  if (largest) {
    const leaderAxis = axis(largest.leaderId);
    const partners = byCloseness(leaderAxis, bloc => bloc === largest);
    const partyIds = [...largest.partyIds];
    for (const partner of partners) {
      if (Math.abs(axis(partner.leaderId) - leaderAxis) > 2) break;
      partyIds.push(...partner.partyIds);
      if (marginOf(partyIds) >= 0) return majority('coalizione-post-voto', largest.leaderId, widen(partyIds, leaderAxis, partners.filter(bloc => !bloc.partyIds.some(id => partyIds.includes(id)))), 'Maggioranza nata dopo il voto');
    }
  }
  const broad = blocs.filter(bloc => Math.abs(axis(bloc.leaderId)) < 3).flatMap(bloc => bloc.partyIds);
  if (broad.length && marginOf(broad) >= 0) return majority('governo-del-presidente', null, broad, 'Governo del Presidente');
  return null;
}
// A Government of the new legislature (simulated Prime Minister, or the player when the player accepts the mandate).
export function electedGovernment(parliament, { majority, number, date, formedBy = 'elezioni', leaderLabel = null, premierLabel = null }) {
  const next = copy(parliament);
  const groupIds = majority.groupIds.filter(id => ['camera', 'senato'].some(chamber => (next.chambers[chamber].groups ?? []).some(group => group.groupId === id)));
  const premierGroupId = groupIds.find(id => (next.chambers.camera.groups ?? []).find(group => group.groupId === id)?.partyId === majority.leaderId) ?? groupIds[0] ?? null;
  // Ministries in proportion to the seats of each majority group at the Camera (the player's Government: chosen by the player).
  const ministers = formedBy === 'player' ? [] : simulatedMinisters(next, groupIds, { number, date });
  const partners = Object.fromEntries(groupIds.filter(id => id !== next.player?.groupId).map(id => [id, { satisfaction: 62, demand: null, source: SIM }]));
  if (next.government) next.pastGovernments = archiveGovernment(next, { status: next.government.status === 'caretaker' ? 'concluded' : next.government.status, endedAt: date });
  const base = majority.kind === 'governo-del-presidente' ? 'Governo del Presidente' : `Governo ${leaderLabel ?? majority.label ?? 'di coalizione'}`;
  // A second Government of the same leader in the same legislature is a "bis" (then "ter", "quater").
  const again = (next.pastGovernments ?? []).filter(item => item.legislature === number && String(item.name ?? '').startsWith(base)).length;
  const name = `${base}${['', ' bis', ' ter', ' quater'][again] ?? ` (${again + 1}º)`} · ${legislatureLabel(number)}`;
  next.government = {
    id: `governo-leg${number}-${date}`, name, status: 'awaiting-confidence', formedBy, primeMinister: formedBy === 'player' ? null : 'simulato', premierLabel: premierLabel ?? (majority.kind === 'governo-del-presidente' ? 'Presidente del Consiglio tecnico (simulato)' : `Presidente del Consiglio (simulato) di ${leaderLabel ?? 'area di maggioranza'}`),
    premierGroupId, coalitionGroupIds: groupIds, supportingGroupIds: [], ministers, partners, confidenceVotes: [], crisisSeverity: 0, program: null, agenda: [],
    stability: 55, proposedAt: date, legislature: number, majorityKind: majority.kind, majorityPartyIds: majority.partyIds, source: SIM
  };
  next.history = [...(next.history ?? []), { id: `governo-leg${number}-${date}`, date, type: 'governo-proposto', text: `${name}: giura il governo e si presenta alle Camere per la fiducia.`, details: { governmentId: next.government.id, coalitionGroupIds: groupIds, source: SIM }, source: SIM }];
  return next;
}
// Simulated offices without names for the groups of the majority, in both Chambers: every group holds at least one
// ministry while there are enough (a group without one grows restless), the others follow the seats; the bigger groups
// take the heavier portfolios. Portfolios already held are skipped (a player's Government completed before the vote).
const MINISTRY_WEIGHT = ['Economia e finanze', 'Interno', 'Esteri', 'Difesa', 'Giustizia', 'Lavoro', 'Salute', 'Imprese', 'Infrastrutture', 'Istruzione'];
function simulatedMinisters(parliament, groupIds, { number, date, taken = [] }) {
  const groups = ['camera', 'senato'].flatMap(chamber => (parliament.chambers?.[chamber]?.groups ?? []).filter(group => groupIds.includes(group.groupId) && group.partyId)).sort((a, b) => b.simulatedSeats - a.simulatedSeats || String(a.groupId).localeCompare(String(b.groupId)));
  const weight = portfolio => { const index = MINISTRY_WEIGHT.indexOf(portfolio); return index < 0 ? MINISTRY_WEIGHT.length + MINISTRIES.indexOf(portfolio) : index; };
  const free = [...MINISTRIES].filter(portfolio => !taken.includes(portfolio)).sort((a, b) => weight(a) - weight(b));
  if (!groups.length || !free.length) return [];
  const counts = new Map(groups.map((group, index) => [group.groupId, index < free.length ? 1 : 0]));
  for (const [id, value] of hare(groups.map(group => ({ id: group.groupId, votes: group.simulatedSeats })), Math.max(0, free.length - groups.length))) counts.set(id, counts.get(id) + value);
  const queue = [];
  while (queue.length < free.length && groups.some(group => counts.get(group.groupId) > 0)) for (const group of groups) if (counts.get(group.groupId) > 0 && queue.length < free.length) { queue.push(group); counts.set(group.groupId, counts.get(group.groupId) - 1); }
  return queue.map((group, index) => {
    const seed = hash(`${number}|${free[index]}|${group.groupId}`);
    return { id: `nomina-${number}-${date}-${slug(free[index])}`, portfolio: free[index], groupId: group.groupId, groupName: group.officialName, playerAppointed: false, appointeeLabel: 'Incarico simulato · nuova legislatura', loyalty: 60 + seed % 20, competence: 45 + (seed >> 5) % 35, source: SIM, appointedAt: date };
  });
}
export const FORMATION_PHASES = Object.freeze({
  insediamento: 'Verso la prima seduta delle Camere', consultazioni: 'Consultazioni al Quirinale', incarico: 'Incarico e giuramento', fiducia: 'Fiducia nelle Camere', completata: 'Governo in carica', fallita: 'Nessuna maggioranza: verso nuove elezioni'
});
// A Government of a legislature born from a vote of the game falls: consultations in the same Chambers, for a new
// Government (the same majority with a new cabinet, or a broader one) or, failing that, the dissolution.
export function crisisFormation(result, { date, number, governmentName = null }) {
  return { phase: 'insediamento', crisis: true, number, resultId: result.id, votedAt: result.date, firstSitting: date, deadline: advanceDays(date, LEGISLATURE_RULES.formationDeadlineWeeks * 7), attempts: 0, majority: null, excluded: [], included: [], steps: [{ date, phase: 'insediamento', text: `${governmentName ?? 'Il governo'} ha perso la fiducia: il Presidente della Repubblica apre le consultazioni nelle stesse Camere.` }], source: SIM };
}
export function startFormation(result, { date, number }) {
  const firstSitting = advanceDays(date, LEGISLATURE_RULES.firstSittingDays);
  return { phase: 'insediamento', number, resultId: result.id, votedAt: date, firstSitting, deadline: advanceDays(date, LEGISLATURE_RULES.firstSittingDays + LEGISLATURE_RULES.formationDeadlineWeeks * 7), attempts: 0, majority: null, excluded: [], included: [], steps: [{ date, phase: 'insediamento', text: `Il voto del ${formatDate(date)} elegge le nuove Camere: la prima seduta è fissata per il ${formatDate(firstSitting)}.` }], source: SIM };
}
// One step of the formation, week by week: consultations, mandate, oath, confidence. playerRole: { secretaryOf, seated }.
// Returns the new formation, the parliament and what the player should be asked (events). The player's answers are
// kept in the formation: excluded / included (support at the consultations), playerAccepted / playerDeclined (mandate).
export function formationStep({ formation, parliament, result, world = null, date, playerRole = {}, labelOf = id => id }) {
  if (!formation || ['completata', 'fallita'].includes(formation.phase)) return { formation, parliament, events: [], lines: [] };
  const next = { ...formation, steps: [...(formation.steps ?? [])] };
  let chambers = parliament;
  const events = [];
  const lines = [];
  const step = (phase, text) => { next.phase = phase; next.steps.push({ date, phase, text }); lines.push(text); };
  const done = extra => ({ formation: next, parliament: chambers, events, lines, ...extra });
  // After a failed confidence vote the second round looks for a broader majority (no coalition wins by right).
  const find = () => majorityAfterVote(chambers, next.attempts ? { ...result, winner: null } : result, world, { exclude: next.excluded ?? [], include: next.included ?? [] });
  const propose = majority => {
    chambers = electedGovernment(chambers, { majority, number: next.number, date, leaderLabel: majority.leaderId ? labelOf(majority.leaderId) : null });
    next.confidenceAt = advanceDays(date, LEGISLATURE_RULES.confidenceDays);
    return chambers.government;
  };
  if (next.phase === 'insediamento') {
    if (date < next.firstSitting) return done();
    step('consultazioni', next.crisis ? 'Consultazioni al Quirinale: i partiti dicono se sostengono un nuovo governo; quello caduto resta per gli affari correnti.' : `Prima seduta delle nuove Camere (${formatDate(next.firstSitting)}): eletti i presidenti, costituiti i gruppi. Il governo uscente resta per gli affari correnti; al Quirinale si aprono le consultazioni.`);
    next.consultationsEnd = advanceDays(date, LEGISLATURE_RULES.consultationDays);
    const majority = find();
    next.majority = majority;
    // The secretary of a party outside the winning coalition says whether it supports the majority taking shape
    // (or the one that would exist with its seats).
    const own = playerRole.secretaryOf;
    const leading = majority?.leaderId && majority.leaderId === own;
    const needed = !majority && own ? majorityAfterVote(chambers, { ...result, winner: null }, world, { include: [own] }) : null;
    if (own && playerRole.seatsOf?.(own) && !leading && (needed || (majority && majority.kind !== 'coalizione'))) {
      const target = needed ?? majority;
      events.push({ id: 'sostegno-nuovo-governo', params: { majority: target.label ?? 'la nuova maggioranza', leader: target.leaderId ? labelOf(target.leaderId) : 'un presidente del Consiglio tecnico', holdUntil: next.consultationsEnd } });
    }
    return done();
  }
  if (next.phase === 'consultazioni') {
    if (date < (next.consultationsEnd ?? date)) return done();
    // The player's answer at the consultations (support or opposition) is part of the count.
    const majority = find();
    if (!majority) { step('fallita', 'Le consultazioni non trovano una maggioranza in entrambe le Camere: il Presidente della Repubblica scioglie le Camere, si torna al voto.'); return done({ dissolve: true }); }
    next.majority = majority;
    const leaderIsPlayer = majority.leaderId && majority.leaderId === playerRole.secretaryOf && playerRole.seated;
    if (leaderIsPlayer && !next.playerDeclined && !next.offeredToPlayer) {
      step('incarico', `Il Presidente della Repubblica affida l’incarico al segretario di ${labelOf(majority.leaderId)}: tocca a te formare il governo.`);
      events.push({ id: 'incarico-governo', params: { majority: majority.label ?? 'la maggioranza', leader: labelOf(majority.leaderId), holdUntil: advanceDays(date, LEGISLATURE_RULES.mandateDays) } });
      next.mandateEnd = advanceDays(date, LEGISLATURE_RULES.mandateDays);
      next.offeredToPlayer = true;
      return done();
    }
    const government = propose(majority);
    step('fiducia', `${government.name}: giura e chiede la fiducia alle Camere.`);
    return done();
  }
  if (next.phase === 'incarico') {
    const government = chambers.government;
    if (next.playerAccepted) {
      // The player's Government: the ministers are the player's choice; by the deadline it goes to the Chambers anyway,
      // with the portfolios still free given to the majority groups.
      if (government?.formedBy === 'player' && government.status === 'awaiting-confidence' && date >= (next.confidenceAt ?? next.deadline)) {
        const held = (government.ministers ?? []).filter(item => !item.endedAt).map(item => item.portfolio);
        const added = simulatedMinisters(chambers, government.coalitionGroupIds ?? [], { number: next.number, date, taken: held });
        chambers = voteGovernmentConfidence({ ...chambers, government: { ...government, ministers: [...(government.ministers ?? []), ...added] } }, date);
      }
      const status = chambers.government?.status;
      if (status === 'active') { step('completata', `${chambers.government.name} ottiene la fiducia: sei Presidente del Consiglio.`); return done({ formed: true, playerPremier: true }); }
      if (status === 'fallen' || date >= next.deadline) { step('fallita', 'Il governo che hai provato a formare non ottiene la fiducia: il Presidente della Repubblica scioglie le Camere.'); return done({ dissolve: true }); }
      return done();
    }
    if (next.playerDeclined || date >= (next.mandateEnd ?? date)) {
      // The mandate declined or left unanswered: it passes to another figure of the same majority (simulated).
      const majority = next.majority;
      const proposed = propose(majority);
      step('fiducia', `L’incarico passa a un’altra figura di ${labelOf(majority.leaderId)} (simulata): ${proposed.name} chiede la fiducia.`);
    }
    return done();
  }
  if (next.phase === 'fiducia') {
    if (date < (next.confidenceAt ?? date)) return done();
    const government = chambers.government;
    if (government?.status === 'awaiting-confidence') chambers = voteGovernmentConfidence(chambers, date);
    const status = chambers.government?.status;
    if (status === 'active') {
      // A new Government starts with some credit: more when it is born from the vote, less after a crisis.
      chambers = { ...chambers, government: { ...chambers.government, stability: Math.max(chambers.government.stability ?? 50, next.crisis ? 55 : 62) } };
      step('completata', `${chambers.government.name} ottiene la fiducia in entrambe le Camere.`);
      return done({ formed: true });
    }
    next.attempts = (next.attempts ?? 0) + 1;
    if (next.attempts >= 2 || date >= next.deadline) { step('fallita', 'Anche il secondo tentativo fallisce: il Presidente della Repubblica scioglie le Camere.'); return done({ dissolve: true }); }
    // A second round of consultations with a broader majority.
    step('consultazioni', 'La fiducia non arriva: nuovo giro di consultazioni per una maggioranza più larga.');
    next.consultationsEnd = advanceDays(date, LEGISLATURE_RULES.consultationDays);
    return done();
  }
  return done();
}
// The player accepts the mandate: a Government of the majority with the player as formateur (ministers still to choose).
export function acceptMandate({ formation, parliament, date, labelOf = id => id }) {
  if (formation?.phase !== 'incarico' || !formation.offeredToPlayer || formation.playerAccepted || !formation.majority) return { formation, parliament };
  const chambers = electedGovernment(parliament, { majority: formation.majority, number: formation.number, date, formedBy: 'player', leaderLabel: formation.majority.leaderId ? labelOf(formation.majority.leaderId) : null, premierLabel: 'Tu, presidente del Consiglio incaricato' });
  const confidenceAt = advanceDays(date, LEGISLATURE_RULES.mandateDays * 2);
  return { formation: { ...formation, playerAccepted: true, confidenceAt, steps: [...formation.steps, { date, phase: 'incarico', text: `Accetti l’incarico: scegli i ministri e chiedi la fiducia entro il ${formatDate(confidenceAt)} (poi il governo si presenta comunque alle Camere, con i ministeri liberi affidati ai gruppi della maggioranza).` }] }, parliament: chambers };
}

// The vote region by region, from the full result of a chamber (before compactResult): every entry's share and the
// ranking of the forces (and territorial lists). Used for the report of the player's campaign.
export function regionalBreakdown(result, geography, chamber = 'camera') {
  const rows = result?.[chamber]?._shares;
  const districts = geography?.[chamber]?.collegi;
  if (!rows?.length || !districts?.length) return [];
  const regions = new Map();
  rows.forEach((row, index) => {
    const item = districts[index];
    if (!item) return;
    const entry = regions.get(item.region) ?? { region: item.region, valid: 0, votes: {} };
    entry.valid += item.valid;
    for (const [id, share] of Object.entries(row.shares)) entry.votes[id] = (entry.votes[id] ?? 0) + share * item.valid / 100;
    regions.set(item.region, entry);
  });
  const total = [...regions.values()].reduce((sum, entry) => sum + entry.valid, 0) || 1;
  return [...regions.values()].map(entry => {
    const shares = Object.fromEntries(Object.entries(entry.votes).map(([id, votes]) => [id, round2(votes * 100 / (entry.valid || 1))]));
    return { region: entry.region, weight: round2(entry.valid * 100 / total), shares, ranking: Object.entries(shares).filter(([id]) => id !== 'altri').sort((a, b) => b[1] - a[1]) };
  }).sort((a, b) => b.weight - a.weight);
}

// ---------- the national campaign ----------
// Weekly effects while the lists are filed and the country campaigns: the useful vote squeezes the small forces outside
// the coalitions, the coalitions' leaders gain visibility, the player's party follows its line.
export function campaignWeekEffects({ world, campaign }) {
  if (!world || !campaign) return { effects: [], lines: [] };
  const { forces } = voteForces(world);
  const coalitions = campaign.coalitions ?? [];
  const inCoalition = new Set(coalitions.flatMap(item => item.partyIds));
  const effects = [];
  for (const force of forces) {
    if (!inCoalition.has(force.id) && force.share < 4 && !force.isPlayer) effects.push({ partyId: force.id, delta: -0.05, remaining: 2, label: 'Voto utile verso le coalizioni', unscaled: true });
  }
  for (const coalition of coalitions) effects.push({ partyId: coalition.leaderId, delta: 0.03, remaining: 2, label: 'La coalizione in campagna', unscaled: true });
  const lines = [];
  const line = NATIONAL_LINES[campaign.line];
  const player = forces.find(force => force.isPlayer);
  if (line && player) {
    const coalition = coalitions.find(item => item.partyIds.includes(player.id));
    effects.push({ partyId: player.id, delta: line.party, remaining: 2, label: line.label, unscaled: true });
    if (coalition && line.allies) for (const id of coalition.partyIds.filter(item => item !== player.id)) effects.push({ partyId: id, delta: line.allies, remaining: 2, label: line.label, unscaled: true });
    if (line.rival) {
      const rival = forces.filter(force => force.id !== player.id && !(coalition?.partyIds ?? []).includes(force.id) && Math.sign(force.axis || 0) !== Math.sign(player.axis || 0)).sort((a, b) => b.share - a.share)[0];
      if (rival) effects.push({ partyId: rival.id, delta: line.rival, remaining: 2, label: `Campagna di ${player.label} contro ${rival.label}`, unscaled: true });
    }
    lines.push(`Campagna nazionale: ${line.label.toLowerCase()}.`);
  }
  return { effects, lines };
}
