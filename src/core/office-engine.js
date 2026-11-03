// The offices the player actually holds, read from the institutions where the player sits, from the Parliament, the
// Government and the party (never from a label): the one source of "who is the player now" for the events, the powers, the
// progression and the incompatibilities. Pure functions: the callers pass in the facts they already have.
import {
  GOVERNMENT_CANDIDACY_BLOCK, INCOMPATIBILITIES, LOCAL_POPULATION_THRESHOLD, OFFICES, OFFICE_BASES, OFFICE_OF_CANDIDACY, POWERS, PROVINCIAL_PRESIDENT_MIN_MONTHS
} from '../data/simulation/office-rules.js?v=20261103-1';

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
  // Several councils of one kind can be active in different places: the heaviest office of the kind is the one reported here (heldOffices lists every one).
  for (const inst of institutions) if (inst?.status === 'active' && inst.kind in held) { const id = institutionOffice(inst); if (id && (!held[inst.kind] || officeTier(id) > officeTier(held[inst.kind]))) held[inst.kind] = id; }
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
  for (const inst of facts.institutions ?? []) if (inst?.status === 'active') { const id = institutionOffice(inst); if (id) held.add(id); }
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

// ---------- the territorial facts of the offices held ----------
// What the incompatibilities that depend on the place and on the size need, read from the institutions where the player sits (never from the name of the office): for every local mandate
// { office, kind, region, provinceCode, municipalityCode, population (of the comune for a mayor, of the province for its president, null when the data are not there), until }.
export function officeDetails(institutions = [], { populationOfComune = () => null, populationOfProvince = () => null } = {}) {
  const out = [];
  for (const inst of institutions) {
    if (!inst || inst.status === 'chiusa' || (inst.status && inst.status !== 'active')) continue;
    const office = institutionOffice(inst);
    if (!office) continue;
    const place = inst.place ?? {};
    const population = inst.kind === 'comune' ? populationOfComune(place.municipalityCode ?? null) : inst.kind === 'provincia' ? populationOfProvince(place.provinceCode ?? null) : null;
    out.push({ office, kind: inst.kind, region: place.region ?? inst.region ?? null, provinceCode: place.provinceCode ?? null, municipalityCode: place.municipalityCode ?? null, population: Number.isFinite(population) ? population : null, until: inst.until ?? null });
  }
  return out;
}
const exceedsThreshold = population => population === null || population === undefined ? null : population > LOCAL_POPULATION_THRESHOLD;
const LOCAL_HEAD_OFFICES = new Set(['sindaco', 'presidente-provincia']);

// The held offices that exclude `office` (a candidate or a new appointment): [{ office, rule }]. Without `facts` every rule applies as written (what the callers that know only the ids always got); with
// facts = { details: officeDetails(...), target: { region, provinceCode, municipalityCode, population } } the rules that depend on the place and on the size are applied to the places and sizes (target: where the
// new office is): a mayor or a president of a Province with up to 15.000 inhabitants does not exclude a seat in Parliament, a regional councillor is excluded only by the local offices of his own Region.
export function incompatibleWith(held = [], office, facts = null) {
  const found = [];
  for (const rule of INCOMPATIBILITIES) {
    const side = rule.a.includes(office) ? rule.b : rule.b.includes(office) ? rule.a : null;
    if (!side) continue;
    for (const id of held) {
      if (!side.includes(id) || id === office || found.some(item => item.office === id)) continue;
      if (facts?.details && (rule.population || rule.sameRegion)) {
        // the details of the held offices of that kind, and the target of the new one
        const mine = facts.details.filter(item => item.office === id);
        const target = facts.target ?? null;
        if (rule.population) {
          // the monocratic office is the one that is held (a mayor already) or the one that is gained (a candidacy to mayor): its entity must exceed the threshold
          const populations = LOCAL_HEAD_OFFICES.has(id) ? mine.map(item => item.population) : LOCAL_HEAD_OFFICES.has(office) ? [target?.population ?? null] : [null];
          const verdicts = populations.map(exceedsThreshold);
          if (verdicts.length && verdicts.every(verdict => verdict === false)) continue;   // every such entity has up to 15.000 inhabitants: compatible
        }
        if (rule.sameRegion) {
          // the Region of the held office against the Region of the new one: different Regions do not exclude each other (when a Region is unknown the rule applies, as it always did)
          const own = target?.region ?? null, regions = mine.map(item => item.region);
          if (own && regions.length && regions.every(item => item && item !== own)) continue;
        }
      }
      found.push({ office: id, rule: rule.rule, id: rule.id });
    }
  }
  return found;
}

// The held offices that lapse when `gained` is won: the new one keeps the seat, the incompatible ones are left (the option the law asks).
export const lapsesFor = (held, gained, facts = null) => incompatibleWith(held, gained, facts);

// What an office hangs from (a provincial seat from the seat in a comune): the rule it breaks when the base is missing, or null. With facts = { details, target: { provinceCode }, electionDate } the check is the one of the law:
// the seat in the Province needs a mayor or a sitting councillor of a comune OF THAT PROVINCE (an assessore is enough only in a comune of up to 15.000 inhabitants, where he keeps the seat of councillor); the President of
// the Province must be a mayor of the province whose mandate lasts at least PROVINCIAL_PRESIDENT_MIN_MONTHS more at the election.
export function missingBase(held = [], office, facts = null) {
  const base = OFFICE_BASES[office];
  if (!base) return null;
  const details = facts?.details;
  if (details && (office === 'consigliere-provinciale' || office === 'presidente-provincia')) {
    const province = facts.target?.provinceCode ?? null;
    const inProvince = item => !province || !item.provinceCode || item.provinceCode === province;
    if (office === 'consigliere-provinciale') {
      const eligible = details.filter(item => item.kind === 'comune' && inProvince(item) && (item.office === 'sindaco' || item.office === 'consigliere-comunale' || (item.office === 'assessore-comunale' && exceedsThreshold(item.population) === false)));
      if (eligible.length) return null;
      const outside = details.some(item => item.kind === 'comune' && ['sindaco', 'consigliere-comunale', 'assessore-comunale'].includes(item.office));
      if (details.some(item => item.office === 'assessore-comunale' && item.kind === 'comune' && inProvince(item))) return 'Per il consiglio provinciale serve essere sindaco o consigliere comunale in carica in un comune della provincia (legge 56/2014, art. 1, comma 69): un assessore esterno al consiglio non basta (solo nei comuni fino a 15.000 abitanti il consigliere nominato assessore conserva il seggio).';
      return outside ? 'Il consiglio provinciale è eletto tra i sindaci e i consiglieri comunali in carica dei comuni di quella provincia (legge 56/2014, art. 1, comma 69): il tuo comune è in un’altra provincia.' : base.rule;
    }
    const mayors = details.filter(item => item.kind === 'comune' && item.office === 'sindaco' && inProvince(item));
    if (!mayors.length) return details.some(item => item.office === 'sindaco') ? 'Il Presidente della Provincia è scelto tra i sindaci di quella provincia (legge 56/2014, art. 1, comma 60): il tuo comune è in un’altra provincia.' : base.rule;
    if (facts.electionDate && !mayors.some(item => !item.until || monthsBetween(facts.electionDate, item.until) >= PROVINCIAL_PRESIDENT_MIN_MONTHS)) return `Il Presidente della Provincia deve essere un sindaco della provincia con almeno ${PROVINCIAL_PRESIDENT_MIN_MONTHS} mesi di mandato ancora davanti al voto (legge 56/2014, art. 1, comma 60): il tuo mandato scade prima.`;
    return null;
  }
  return base.anyOf.some(id => held.includes(id)) ? null : base.rule;
}

// The office a candidacy leads to (a role of an election: comunale-sindaco, politiche-senatore…).
export const officeOfCandidacy = (electionType, role) => OFFICE_OF_CANDIDACY[electionType]?.[role] ?? null;

// Whole calendar months from one date to the other (18 months from the 28th of November is the 28th of May): the law counts months, not days.
const monthsBetween = (from, to) => {
  if (!from || !to) return Infinity;
  const [y1, m1, d1] = String(from).slice(0, 10).split('-').map(Number), [y2, m2, d2] = String(to).slice(0, 10).split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

// Whether the candidacy is allowed now: null, or the reason it is not. facts: { held, electionType, role, electionDate,
// municipalVote (the date of the next communal vote of the player's comune) }. The second-level provincial vote needs a seat
// in a comune; the president is a mayor with at least eighteen months of the term ahead (law 56/2014); a member of the
// Government does not run for a territorial office; the President of the Republic does not run at all.
// Candidacies of the player. There is no quota (not a number of days between two votes, not a number a year): the calendar plans coherent dates and the player can stand wherever he is
// eligible. The one real incompatibility is that the game runs a single campaign at a time, so two candidacies whose campaigns overlap (from the opening of the candidacies to the day of the
// vote) cannot both be played: votes of different rounds never overlap (the calendar keeps them apart), votes of the same round do.
const dayNumber = date => Math.round(Date.parse(`${date}T12:00:00Z`) / 86400000);
const campaignSpan = item => [dayNumber(item.windowOpensAt ?? item.electionDate), dayNumber(item.electionDate)];
export const campaignsOverlap = (a, b) => { const [from, to] = campaignSpan(a), [otherFrom, otherTo] = campaignSpan(b); return from <= otherTo && otherFrom <= to; };
export function rhythmBlock({ candidacies = [], candidacyId = null, electionDate = null, windowOpensAt = null } = {}) {
  if (!electionDate) return null;
  const mine = { electionDate, windowOpensAt };
  for (const other of candidacies) {
    if (!other?.electionDate || other.id === candidacyId) continue;
    if (campaignsOverlap(mine, other)) return `Hai già una candidatura per ${other.label ?? 'un’altra elezione'} (voto del ${other.electionDate}): le due campagne si sovrappongono e se ne gioca una alla volta.`;
  }
  return null;
}
// What goes on the books when a campaign (or a race led by the player) starts.
export function personalCandidacies(game, races = []) {
  const byId = new Map((game?.candidacies ?? []).map(item => [item.id, item]));
  for (const race of races) if (race.candidacy?.kind === 'player' && ['confirmed', 'running', 'held'].includes(race.status) && !byId.has(race.id)) byId.set(race.id, candidacyRecord({ id: race.id, type: race.level, label: race.label, windowOpensAt: race.windowOpensAt, electionDate: race.electionDate, kind: 'gara' }));
  return [...byId.values()];
}
export const candidacyRecord = ({ id, type, label, windowOpensAt = null, electionDate, early = false, kind = 'elezione' }) => ({ id, type, label, windowOpensAt, electionDate, early: Boolean(early), kind });

export function candidacyBlock({ held = [], electionType, role, electionDate = null, windowOpensAt = null, municipalVote = null, candidacies = [], candidacyId = null, facts = null } = {}) {
  if (held.includes('presidente-repubblica')) return 'Il Presidente della Repubblica sta sopra le parti: non si candida a nessun’altra carica.';
  if (GOVERNMENT_CANDIDACY_BLOCK.includes(electionType) && held.some(id => OFFICES[id]?.scope === 'governo')) return 'Chi ha un incarico di governo non si candida a un ente territoriale o al Parlamento europeo: prima lascia l’incarico (regola di gioco).';
  const office = officeOfCandidacy(electionType, role);
  if (electionType === 'provinciale' && office) {
    const base = missingBase(held, office, facts ? { ...facts, electionDate } : null);
    if (base) return base;
    if (office === 'presidente-provincia' && !facts?.details && municipalVote && electionDate && monthsBetween(electionDate, municipalVote) < PROVINCIAL_PRESIDENT_MIN_MONTHS) return `Il Presidente della Provincia deve avere ancora almeno ${PROVINCIAL_PRESIDENT_MIN_MONTHS} mesi di mandato da sindaco (legge 56/2014): il tuo scade prima.`;
  }
  return rhythmBlock({ candidacies, candidacyId, electionDate, windowOpensAt });
}

// What winning the candidacy would cost, to say it before the campaign starts: the offices that lapse and the rule.
export function candidacyNotes({ held = [], electionType, role, facts = null } = {}) {
  const office = officeOfCandidacy(electionType, role);
  return office ? lapsesFor(held, office, facts).map(item => `Se vinci lasci ${officeLabel(item.office).toLowerCase()}: ${item.rule}`) : [];
}
