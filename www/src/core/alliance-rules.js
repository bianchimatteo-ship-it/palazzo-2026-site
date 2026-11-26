// The rules of alliances and coalitions that the world engine (world-engine.js) applies, kept apart as plain functions on the data of the world:
//   · the PROGRAMME of a force on ten themes (immigration, security, economy and taxes, health, work, environment and energy, Europe, civil rights, institutions, foreign policy) as a position on a scale
//     from -3 to +3 (the two poles are named for each theme), ESTIMATED by the game from the collocazione documented for the party and from what the player decides (compromises): it is a simulation,
//     never a declaration of the real party; compatibility is computed theme by theme and the heavy conflicts on the themes that divide most are conditions, not points that an overall score washes out;
//   · COMPROMISES on a theme: both sides move towards the middle, with a cost for the one who gives way;
//   · the REFUSAL: a force that said no to a request is not asked again by the same party for seven days of the game;
//   · the COALITION as an agreement for ONE election, apart from the alliance (the standing political agreement): it is registered for that election by an explicit approval and only until the filing of the lists.
// Nothing here draws a random number or reads a clock: the callers pass the roll and the date, so every rule can be tested.
import { documentOf, documentedProgramOf } from '../data/party-program-values.js?v=20261126-3';
export const THEMES = Object.freeze([
  { id: 'immigrazione', label: 'Immigrazione e integrazione', low: 'accoglienza senza restrizioni', high: 'remigrazione e chiusura', weight: 1.4, veto: true },
  { id: 'sicurezza', label: 'Sicurezza', low: 'prevenzione e garanzie', high: 'pugno duro e controllo', weight: 1.0, veto: false },
  { id: 'economia', label: 'Economia e fiscalità', low: 'più spesa pubblica e tasse progressive', high: 'meno tasse e più mercato', weight: 1.2, veto: false },
  { id: 'sanita', label: 'Sanità', low: 'sanità pubblica universale', high: 'più spazio al privato', weight: 0.8, veto: false },
  { id: 'lavoro', label: 'Lavoro', low: 'più tutele e salario minimo', high: 'più flessibilità', weight: 0.9, veto: false },
  { id: 'ambiente', label: 'Ambiente ed energia', low: 'transizione accelerata', high: 'priorità a industria ed energie tradizionali', weight: 0.9, veto: false },
  { id: 'europa', label: 'Europa', low: 'più integrazione europea', high: 'meno poteri a Bruxelles', weight: 1.3, veto: true },
  { id: 'diritti', label: 'Diritti civili', low: 'diritti civili ampi', high: 'valori tradizionali', weight: 1.3, veto: true },
  { id: 'istituzioni', label: 'Istituzioni', low: 'centralità del Parlamento e garanzie', high: 'premierato e stabilità dell’esecutivo', weight: 0.6, veto: false },
  { id: 'esteri', label: 'Politica estera', low: 'neutralità e dialogo', high: 'alleanze militari e difesa', weight: 0.7, veto: true }
]);
export const THEME_BY_ID = Object.freeze(Object.fromEntries(THEMES.map(theme => [theme.id, theme])));
// How strongly the left–right axis of a force (−3..+3) moves it on each theme, and the span of its own variation.
const FACTOR = { immigrazione: 1.3, sicurezza: 1.0, economia: 1.2, sanita: 0.6, lavoro: 0.9, ambiente: 0.9, europa: 1.1, diritti: 1.25, istituzioni: 0.5, esteri: 0.8 };
export const HARD_GAP = 4;   // on a theme that divides most a gap of this size is a condition that has to be negotiated
export const REFUSAL_DAYS = 7;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = value => Math.round(value * 10) / 10;
const hashOf = text => { let h = 2166136261; for (const char of String(text)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const pairKey = (a, b) => [a, b].sort().join('|');
const addDays = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

// Position for the play: player's compromise › the party's own document › the game's estimate from the collocazione (labelled simulated) › null.
export function positionOf(world, party, themeId) {
  const fixed = world?.programPositions?.[party?.id]?.[themeId];
  if (Number.isFinite(fixed)) return fixed;
  const documented = documentedProgramOf(party)?.themes?.[themeId];
  if (Number.isFinite(documented?.value)) return documented.value;
  return simulatedPosition(party, themeId);
}
export function simulatedPosition(party, themeId) {
  if (!Number.isFinite(party?.axis)) return null;
  const axis = party.axis;
  const own = ((hashOf(`${party?.id}|${themeId}`) % 3) - 1) * 0.5;
  return round1(clamp(axis * (FACTOR[themeId] ?? 0.8) + (Math.abs(axis) >= 3 ? 0 : own), -3, 3));
}
// How a theme is known: documented (document, summary), simulated (with the gap the documents state) or unknown.
export function programSource(party, themeId) {
  const program = documentedProgramOf(party), theme = program?.themes?.[themeId];
  if (Number.isFinite(theme?.value)) return { documented: true, confidence: theme.confidence, summary: theme.summary, document: documentOf(theme.doc), status: program.status, subpositions: theme.subpositions ?? null };
  const simulated = Number.isFinite(simulatedPosition(party, themeId));
  return { documented: false, simulated, gap: theme ? { summary: theme.summary, document: documentOf(theme.doc) } : null, status: program?.status ?? null };
}
export const programOf = (world, party) => Object.fromEntries(THEMES.map(theme => [theme.id, positionOf(world, party, theme.id)]));
export const documentedCoverage = party => THEMES.filter(theme => Number.isFinite(documentedProgramOf(party)?.themes?.[theme.id]?.value)).length;
export const stanceText = (themeId, value) => { const theme = THEME_BY_ID[themeId]; if (!Number.isFinite(value)) return 'posizione non rilevata'; return value <= -1.5 ? theme.low : value >= 1.5 ? theme.high : 'posizione intermedia'; };
const levelOf = gap => gap <= 1 ? 'accordo' : gap <= 2 ? 'differenza' : gap < HARD_GAP ? 'conflitto' : 'incompatibile';

// The programme of two forces compared theme by theme: the rows with the positions, the gap and the level, the overall compatibility (0..1, weighted) and the hard conflicts still to be negotiated.
// A compromise already reached on a theme (world.compromises) counts as settled: the two positions are the ones agreed.
export function compare(world, a, b) {
  const settled = world?.compromises?.[pairKey(a.id, b.id)] ?? {};
  const rows = THEMES.map(theme => {
    const agreed = settled[theme.id];
    const pa = agreed ? agreed.value : positionOf(world, a, theme.id), pb = agreed ? agreed.value : positionOf(world, b, theme.id);
    const aSource = programSource(a, theme.id), bSource = programSource(b, theme.id);
    // a theme with an unknown position counts neither as agreement nor as conflict
    if (!Number.isFinite(pa) || !Number.isFinite(pb)) return { id: theme.id, label: theme.label, a: pa, b: pb, aText: stanceText(theme.id, pa), bText: stanceText(theme.id, pb), gap: null, level: 'non-rilevato', aSource, bSource, veto: theme.veto, weight: theme.weight, compromise: null };
    const gap = round1(Math.abs(pa - pb));
    const basis = agreed ? 'compromesso' : aSource.documented && bSource.documented ? 'documentato' : aSource.documented || bSource.documented ? 'misto' : 'stima';
    return { id: theme.id, label: theme.label, a: pa, b: pb, aText: stanceText(theme.id, pa), bText: stanceText(theme.id, pb), gap, level: agreed ? 'compromesso' : levelOf(gap), aSource, bSource, basis, veto: theme.veto, weight: theme.weight, compromise: agreed ?? null };
  });
  const known = rows.filter(row => row.level !== 'non-rilevato');
  const max = known.reduce((sum, row) => sum + row.weight * 6, 0);
  const score = max ? 1 - known.reduce((sum, row) => sum + row.weight * row.gap, 0) / max : 0.5;
  return {
    rows, score: Math.round(score * 100) / 100, missing: rows.length - known.length, documented: rows.filter(row => row.basis === 'documentato').length,
    agreements: rows.filter(row => row.level === 'accordo' || row.level === 'compromesso'),
    conflicts: rows.filter(row => row.level === 'conflitto' || row.level === 'incompatibile'),
    hard: rows.filter(row => row.veto && row.level === 'incompatibile')
  };
}

// A compromise on one theme: both sides move to the middle. `roll` is a number 0..1, `ties` the relation between the two forces (−100..100). The one who gives way more pays (a cost to its
// polls for some weeks: part of its voters and members do not follow). Returns { agreed, value, moves: { a, b }, chance, cost } and the updated `positions` and `compromise` to store.
export function compromise(world, a, b, themeId, { roll = 0.5, ties = 0, relation = 0 } = {}) {
  const theme = THEME_BY_ID[themeId];
  if (!theme) throw new Error('Tema non riconosciuto.');
  const pa = positionOf(world, a, themeId), pb = positionOf(world, b, themeId);
  const gap = Math.abs(pa - pb);
  if (gap < 0.5) return { agreed: true, value: pa, moves: { a: 0, b: 0 }, chance: 1, cost: 0, trivial: true };
  // what a force concedes is judged by its relations with the other, the importance of the theme for it and the size of the step: the wider the gap, the harder
  const chance = clamp(0.55 + (ties + relation) / 400 - gap * 0.07 - (theme.veto ? 0.08 : 0), 0.05, 0.92);
  if (!(roll < chance)) return { agreed: false, value: null, moves: { a: 0, b: 0 }, chance: Math.round(chance * 100) / 100, cost: 0 };
  const value = round1((pa + pb) / 2);
  const moves = { a: round1(Math.abs(value - pa)), b: round1(Math.abs(value - pb)) };
  return { agreed: true, value, moves, chance: Math.round(chance * 100) / 100, cost: Math.round(Math.max(moves.a, moves.b) * 0.12 * 100) / 100 };
}

// ---------- the refusal: seven days ----------
export const refusalKey = (askerId, targetId) => `${askerId}>${targetId}`;
// null, or the sentence that says the request cannot be repeated yet (and from which day it can).
export function refusalBlock(world, key, date) {
  const until = world?.refusals?.[key]?.until;
  return until && date < until ? `La richiesta è stata respinta di recente: si potrà ripresentare dal ${until} (sette giorni di gioco dopo il rifiuto).` : null;
}
export function recordRefusal(world, key, date, reason) {
  world.refusals ??= {};
  world.refusals[key] = { at: date, until: addDays(date, REFUSAL_DAYS), reason: reason ?? null };
}

// ---------- the coalition for one election ----------
// The last day for forming, joining or changing a coalition for an election: the closing of the candidacies (the filing of the lists), else forty days before the vote. A rule of the game,
// patterned on the calendar of the lists, not a quotation of the law of each election.
export const coalitionDeadline = election => election?.windowClosesAt ?? (election?.electionDate ? addDays(election.electionDate, -40) : null);
export function coalitionBlock(election, date) {
  if (!election) return 'Scegli l’elezione per cui formare la coalizione.';
  const deadline = coalitionDeadline(election);
  if (election.status === 'held' || (election.electionDate && date > election.electionDate)) return 'Questa elezione si è già tenuta.';
  if (deadline && date > deadline) return `Le coalizioni per «${election.label}» si sono chiuse il ${deadline}, con il deposito delle liste: fino al voto non si formano, non si allargano e non cambiano (restano valide quelle già registrate).`;
  return null;
}
// An alliance runs as a coalition at a vote only if it is registered for it; the alliances of saves written before this rule, and the poles built for a vote, keep running as they did.
export function isElectoral(alliance, electionType = null) {
  if (!alliance || alliance.status !== 'active') return false;
  if (alliance.kind === 'coalizione' || alliance.electoral || !Array.isArray(alliance.coalitions)) return true;
  return alliance.coalitions.some(item => item.status === 'approvata' && (!electionType || item.type === electionType));
}
export const registrationsOf = alliance => (alliance?.coalitions ?? []).filter(item => item.status === 'approvata');
// The registration of an alliance for ONE vote: approved for that election (its id; a race of the same round, the same kind of vote on the same day), granted to the members the alliance has now (a
// change of the members, a merger, a force that left, asks for a new approval: registerCoalition). A refused or expired approval, or one for another vote, is not a registration for this one.
// Old records without the election (written before the rule) stand for the kind of vote they name.
export function registrationFor(alliance, election) {
  if (!alliance || !election || !Array.isArray(alliance.coalitions)) return null;
  const sameMembers = item => !Array.isArray(item.members) || (item.members.length === alliance.partyIds.length && item.members.every(id => alliance.partyIds.includes(id)));
  const forThis = item => item.electionId ? item.electionId === election.id || (item.type === election.type && Boolean(item.electionDate) && item.electionDate === election.electionDate) : item.type === election.type;
  return [...alliance.coalitions].reverse().find(item => item.status === 'approvata' && forThis(item) && sameMembers(item)) ?? null;
}
// Whether an alliance runs as a coalition at THIS vote (the exact election), with the same exceptions as isElectoral for the poles and the accords of old saves.
export function isElectoralFor(alliance, election) {
  if (!alliance || alliance.status !== 'active') return false;
  if (!election) return isElectoral(alliance);
  if (alliance.kind === 'coalizione' || alliance.electoral || !Array.isArray(alliance.coalitions)) return true;
  return Boolean(registrationFor(alliance, election));
}
