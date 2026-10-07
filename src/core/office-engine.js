// The offices the player actually holds, read from the institutions where the player sits, from the Parliament, the
// Government and the party (never from a label): the one source of "who is the player now" for the events, the powers, the
// progression and the incompatibilities. Pure functions: the callers pass in the facts they already have.
import {
  GOVERNMENT_CANDIDACY_BLOCK, INCOMPATIBILITIES, OFFICES, OFFICE_BASES, OFFICE_OF_CANDIDACY, POWERS, PROVINCIAL_PRESIDENT_MIN_MONTHS
} from '../data/simulation/office-rules.js?v=20261007-2';

// The office of the player in a local or European institution (see local-engine: kinds comune, provincia, regione, europa).
export function institutionOffice(inst) {
  if (!inst || inst.status === 'chiusa') return null;
  const leads = inst.executive?.leader === 'player';
  const portfolio = inst.playerRole === 'assessore' || (inst.executive?.members ?? []).some(member => member.holder === 'player');
  switch (inst.kind) {
    case 'comune': return leads ? 'sindaco' : portfolio ? 'assessore-comunale' : 'consigliere-comunale';
    case 'provincia': return leads ? 'presidente-provincia' : portfolio ? 'assessore-provinciale' : 'consigliere-provinciale';
    case 'regione': return leads ? 'presidente-regione' : portfolio ? 'assessore-regionale' : 'consigliere-regionale';
    case 'europa': return 'eurodeputato';
    default: return null;
  }
}

// What the player holds in the institutions now: { comune, provincia, regione, europa } (each an office id or null).
export function localOffices(institutions = []) {
  const held = { comune: null, provincia: null, regione: null, europa: null };
  for (const inst of institutions) if (inst?.status === 'active' && inst.kind in held) held[inst.kind] = institutionOffice(inst);
  return held;
}

// The portfolio (delega) of the player in the executive of an institution, when the player is an assessore.
export const playerPortfolio = inst => (inst?.executive?.members ?? []).find(member => member.holder === 'player') ?? null;

export const officeLabel = id => OFFICES[id]?.label ?? id;
export const officeTier = id => OFFICES[id]?.tier ?? 0;
export const officeScope = id => OFFICES[id]?.scope ?? null;

// Every office held, from the facts of the career. facts: { institutions, chamber ('camera'|'senato'|null), groupLeader,
// minister, undersecretary, premier, inMajority, secretary, president }. Ordered by weight, the heaviest first.
export function heldOffices(facts = {}) {
  const held = new Set();
  const local = localOffices(facts.institutions ?? []);
  for (const id of Object.values(local)) if (id) held.add(id);
  if ((facts.institutions ?? []).some(inst => inst?.status === 'active' && inst.playerGroupLead && inst.kind !== 'europa')) held.add('capogruppo-consiliare');
  if (facts.chamber === 'camera') held.add('deputato');
  else if (facts.chamber === 'senato') held.add('senatore');
  if (facts.chamber && facts.groupLeader) held.add('capogruppo');
  if (facts.premier) held.add('premier');
  else if (facts.minister) {
    held.add('ministro');
    // The leader of a party of the coalition who sits in the cabinet is its deputy prime minister.
    if (facts.secretary && facts.inMajority) held.add('vicepremier');
  } else if (facts.undersecretary) held.add('sottosegretario');
  if (facts.secretary) held.add('segretario');
  if (facts.president) held.add('presidente-repubblica');
  return [...held].sort((a, b) => officeTier(b) - officeTier(a));
}

export const topOffice = held => (held ?? [])[0] ?? null;

// The powers the offices held give (a set of ids from POWERS) and whether one of them is among them.
export const powersOf = held => new Set((held ?? []).flatMap(id => OFFICES[id]?.powers ?? []));
export const hasPower = (held, power) => powersOf(held).has(power);
export const powerLabel = id => POWERS[id]?.label ?? id;
export const powerReason = id => POWERS[id]?.reason ?? '';

// The held offices that exclude `office` (a candidate or a new appointment): [{ office, rule }].
export function incompatibleWith(held = [], office) {
  const found = [];
  for (const rule of INCOMPATIBILITIES) {
    const side = rule.a.includes(office) ? rule.b : rule.b.includes(office) ? rule.a : null;
    if (!side) continue;
    for (const id of held) if (side.includes(id) && id !== office && !found.some(item => item.office === id)) found.push({ office: id, rule: rule.rule, id: rule.id });
  }
  return found;
}

// The held offices that lapse when `gained` is won: the new one keeps the seat, the incompatible ones are left (the option the law asks).
export const lapsesFor = (held, gained) => incompatibleWith(held, gained);

// What an office hangs from (a provincial seat from the seat in a comune): the rule it breaks when the base is missing, or null.
export function missingBase(held = [], office) {
  const base = OFFICE_BASES[office];
  return base && !base.anyOf.some(id => held.includes(id)) ? base.rule : null;
}

// The office a candidacy leads to (a role of an election: comunale-sindaco, politiche-senatore…).
export const officeOfCandidacy = (electionType, role) => OFFICE_OF_CANDIDACY[electionType]?.[role] ?? null;

const monthsBetween = (from, to) => from && to ? (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 2629800000 : Infinity;

// Whether the candidacy is allowed now: null, or the reason it is not. facts: { held, electionType, role, electionDate,
// municipalVote (the date of the next communal vote of the player's comune) }. The second-level provincial vote needs a seat
// in a comune; the president is a mayor with at least eighteen months of the term ahead (law 56/2014); a member of the
// Government does not run for a territorial office; the President of the Republic does not run at all.
export function candidacyBlock({ held = [], electionType, role, electionDate = null, municipalVote = null } = {}) {
  if (held.includes('presidente-repubblica')) return 'Il Presidente della Repubblica sta sopra le parti: non si candida a nessun’altra carica.';
  if (GOVERNMENT_CANDIDACY_BLOCK.includes(electionType) && held.some(id => OFFICES[id]?.scope === 'governo')) return 'Chi ha un incarico di governo non si candida a un ente territoriale o al Parlamento europeo: prima lascia l’incarico (regola di gioco).';
  const office = officeOfCandidacy(electionType, role);
  if (electionType === 'provinciale' && office) {
    const base = missingBase(held, office);
    if (base) return base;
    if (office === 'presidente-provincia' && municipalVote && electionDate && monthsBetween(electionDate, municipalVote) < PROVINCIAL_PRESIDENT_MIN_MONTHS) return `Il Presidente della Provincia deve avere ancora almeno ${PROVINCIAL_PRESIDENT_MIN_MONTHS} mesi di mandato da sindaco (legge 56/2014): il tuo scade prima.`;
  }
  return null;
}

// What winning the candidacy would cost, to say it before the campaign starts: the offices that lapse and the rule.
export function candidacyNotes({ held = [], electionType, role } = {}) {
  const office = officeOfCandidacy(electionType, role);
  return office ? lapsesFor(held, office).map(item => `Se vinci lasci ${officeLabel(item.office).toLowerCase()}: ${item.rule}`) : [];
}
