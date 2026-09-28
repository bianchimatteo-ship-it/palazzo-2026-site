// The institutions where a local or European career is played: the consiglio comunale with its giunta and mayor, the
// consiglio regionale with its giunta and president, the European Parliament with its political groups. Each has
// groups of majority and opposition, an executive that proposes acts (deliberations, regional laws, the budget; the
// European Commission's dossiers), an opposition that attacks and files motions, groups that defect, a budget with its
// deadline, votes with individual dissent, and a player who proposes, votes, negotiates or governs. A council that loses
// its majority is dissolved and votes early. Everything is simulation; the European groups start from their real size
// at the constitutive session of 2024 (europarl), then evolve in the game.
import { uniqueId } from './ids.js?v=20260928-5';
import { DATA_SOURCES } from '../data/schema.js?v=20260928-5';
import { AREA_BY_ID, CAMP_PRIORITIES, INTENSITY } from '../data/simulation/policy-rules.js?v=20260928-5';
import { ACT_TYPES, AREA_BREADTH, AREA_LEANS, CITY_INDICATORS, CITY_SHARE_OF_REGION, actTitle, actTypeOf, cityIndicatorOf, legalNumber, naturalType, neededYes, regionalWeights, typeFitsArea } from '../data/simulation/local-acts.js?v=20260928-5';
import { cohesiveShare } from './parliament-engine.js?v=20260928-5';
import { groupLine, seededRandom, splitGroupVote } from './vote-engine.js?v=20260928-5';
import { advanceDays } from './time.js?v=20260928-5';

const SIM = DATA_SOURCES.SIMULATION;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const weeksBetween = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000) : 99;
const campOf = axis => (axis ?? 0) >= 1 ? 'destra' : (axis ?? 0) <= -1 ? 'sinistra' : 'centro';
const CLOSED = ['approvato', 'respinto', 'ritirato', 'risposto'];
const TAX_STEPS = ['bassa', 'media', 'alta'];
// The budget of a new year: the resources it brings on top of what is left, more with higher local taxes.
const TAX_BONUS = Object.freeze({ bassa: -6, media: 0, alta: 6 });

// ---------- rules of the game ----------
export const INSTITUTIONS = Object.freeze({
  comune: {
    label: 'Consiglio comunale', executive: 'Giunta comunale', leader: 'Sindaco', leaderTitle: 'Sindaco', member: 'Consigliere comunale',
    portfolios: ['Bilancio', 'Lavori pubblici', 'Politiche sociali', 'Urbanistica', 'Mobilità', 'Cultura e turismo', 'Sicurezza urbana', 'Ambiente'],
    acts: { executive: 'Delibera della giunta', majority: 'Mozione della maggioranza', opposition: 'Mozione dell’opposizione', budget: 'Bilancio di previsione', player: 'Tua proposta di delibera' },
    rates: { executive: 0.35, majority: 0.08, opposition: 0.14 }, dissolves: true
  },
  regione: {
    label: 'Consiglio regionale', executive: 'Giunta regionale', leader: 'Presidente della Regione', leaderTitle: 'Presidente di Regione', member: 'Consigliere regionale',
    portfolios: ['Sanità', 'Bilancio', 'Trasporti', 'Attività produttive', 'Ambiente', 'Agricoltura', 'Welfare', 'Istruzione e formazione'],
    acts: { executive: 'Proposta di legge della giunta', majority: 'Proposta di legge della maggioranza', opposition: 'Mozione dell’opposizione', budget: 'Legge di bilancio regionale', player: 'Tua proposta di legge regionale' },
    rates: { executive: 0.3, majority: 0.07, opposition: 0.12 }, dissolves: true
  },
  europa: {
    label: 'Parlamento europeo', executive: 'Commissione europea', leader: null, member: 'Deputato al Parlamento europeo',
    portfolios: [],
    acts: { executive: 'Proposta della Commissione', majority: 'Risoluzione', opposition: 'Emendamento di un gruppo', budget: 'Bilancio annuale dell’Unione', player: 'Tua relazione d’iniziativa' },
    rates: { executive: 0.4, majority: 0.08, opposition: 0.1 }, dissolves: false
  }
});
// The political groups of the European Parliament at the constitutive session of July 2024 (720 seats; source:
// European Parliament, results.elections.europa.eu, verified 2026-09-26), with the collocazione the game gives them.
export const EP_GROUPS_2024 = Object.freeze({
  source: 'real', verified: true, sourceUrl: 'https://results.elections.europa.eu/en/seats-political-group-country/2024-2029/', sourceName: 'Parlamento europeo — seggi per gruppo politico, sessione costitutiva 2024', verifiedAt: '2026-09-26',
  groups: [
    { id: 'epp', label: 'PPE', seats: 188, axis: 1 }, { id: 'sd', label: 'S&D', seats: 136, axis: -1 }, { id: 'pfe', label: 'Patrioti per l’Europa', seats: 84, axis: 3 },
    { id: 'ecr', label: 'ECR', seats: 78, axis: 2 }, { id: 'renew', label: 'Renew Europe', seats: 77, axis: 0 }, { id: 'greens', label: 'Verdi/ALE', seats: 53, axis: -2 },
    { id: 'left', label: 'La Sinistra', seats: 46, axis: -3 }, { id: 'esn', label: 'Europa delle nazioni sovrane', seats: 25, axis: 3 }, { id: 'ni', label: 'Non iscritti', seats: 33, axis: 0, nonAttached: true }
  ]
});
// The European group of a national party in the game: by its collocazione (a rule of the game, not a real membership).
export const epGroupFor = axis => ({ '-3': 'left', '-2': 'greens', '-1': 'sd', 0: 'renew', 1: 'epp', 2: 'ecr', 3: 'pfe' })[String(clamp(Math.round(axis ?? 0), -3, 3))];

// ---------- creation ----------
// spec: { kind, name, region, date, until, role, side, groups: [{ id, label, partyId, axis, seats, side }], leaderGroupId, leaderIsPlayer, playerGroupId }
export function createInstitution(spec) {
  const rules = INSTITUTIONS[spec.kind];
  const groups = spec.groups.filter(group => group.seats > 0).map(group => ({ ...group, camp: campOf(group.axis), cohesion: 70, source: SIM }));
  const leaderGroup = groups.find(group => group.id === spec.leaderGroupId) ?? groups.find(group => group.side === 'maggioranza') ?? groups[0];
  const members = rules.portfolios.map((portfolio, index) => {
    const majority = groups.filter(group => group.side === 'maggioranza');
    const holder = majority[index % Math.max(1, majority.length)] ?? leaderGroup;
    return { portfolio, groupId: holder?.id ?? null, holder: 'simulato', label: `Assessore (figura simulata) · ${holder?.label ?? 'lista civica'}` };
  });
  return {
    id: `${spec.kind}-${spec.date}-${String(spec.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, kind: spec.kind, name: spec.name, region: spec.region ?? null,
    since: spec.date, until: spec.until ?? null, status: 'active', playerRole: spec.role, playerSide: spec.side, playerGroupId: spec.playerGroupId ?? null,
    groups, seats: groups.reduce((sum, group) => sum + group.seats, 0),
    executive: spec.kind === 'europa' ? null : { leader: spec.leaderIsPlayer ? 'player' : 'simulato', label: spec.leaderIsPlayer ? `Tu, ${rules.leader.toLowerCase()}` : `${rules.leader} (figura simulata) · ${leaderGroup?.label ?? ''}`.trim(), groupId: leaderGroup?.id ?? null, camp: leaderGroup?.camp ?? 'centro', members, stability: 62, program: null },
    budget: spec.kind === 'europa' ? null : { approvedYear: Number(String(spec.date).slice(0, 4)), margin: 50, localTax: 'media', provisional: false, failures: 0 },
    ...(spec.kind === 'comune' ? { indicators: cityIndicators(spec) } : {}), ...(spec.kind === 'europa' ? {} : { effects: [], commitments: [] }),
    acts: [], archive: [], history: [{ date: spec.date, text: `${rules.label}: inizia il mandato (${spec.role === 'sindaco' || spec.role === 'presidente' ? 'guidi l’esecutivo' : spec.side === 'maggioranza' ? 'in maggioranza' : 'all’opposizione'}).` }],
    pressure: 30, ...(spec.kind === 'europa' ? { ep: europeanSeat(`${spec.kind}-${spec.date}`, spec.date, spec.committee) } : {}), source: SIM
  };
}
// The city's services at the start of the term: close to the region's (territory, when known), each city a little
// different.
function cityIndicators({ name, territory = null }) {
  const rand = seededRandom(`${name}|servizi`);
  return Object.fromEntries(CITY_INDICATORS.map(item => [item.id, round1(clamp((territory?.[item.region] ?? 50) + (rand() - 0.5) * 12, 20, 80))]));
}
// Saves made before the acts had effects: the city gets its services, the council its effects and commitments.
export function withLocalState(inst) {
  if (!inst || inst.kind === 'europa' || (inst.effects && inst.commitments && (inst.kind !== 'comune' || inst.indicators))) return inst;
  return { ...inst, ...(inst.kind === 'comune' && !inst.indicators ? { indicators: cityIndicators({ name: inst.name }) } : {}), effects: inst.effects ?? [], commitments: inst.commitments ?? [] };
}
const record = (inst, date, text, type = 'evento') => ({ ...inst, history: [...inst.history, { date, text, type }].slice(-40) });
const setAct = (inst, id, patch) => ({ ...inst, acts: inst.acts.map(item => item.id === id ? { ...item, ...patch } : item) });
const governing = inst => new Set(inst.groups.filter(group => group.side === 'maggioranza').map(group => group.id));
export const majorityMargin = inst => inst.groups.filter(group => group.side === 'maggioranza').reduce((sum, group) => sum + group.seats, 0) - (Math.floor(inst.seats / 2) + 1);

// ---------- acts ----------
// The kind of an act (see ACT_TYPES); acts saved before the kinds existed get the closest one.
export function categoryOf(inst, act) {
  if (act?.category) return act.category;
  if (inst.kind === 'europa') return { majority: 'ue-risoluzione', opposition: 'ue-emendamento', player: 'ue-relazione' }[act?.kind] ?? 'ue-proposta';
  if (act?.kind === 'sfiducia') return 'sfiducia';
  if (act?.budget || act?.kind === 'budget') return 'bilancio';
  if (act?.kind === 'majority' || act?.kind === 'opposition') return 'mozione';
  if (inst.kind === 'regione') return 'legge';
  return act?.sponsor?.kind === 'executive' ? 'servizi' : 'mozione';
}
export const typeOfAct = (inst, act) => actTypeOf(inst.kind, categoryOf(inst, act));
// Where the text of an act sits between left and right: its theme and who writes it; taxes and building have their own.
function stanceOf(inst, category, area, sponsor, variant) {
  const axis = sponsor?.axis ?? 0;
  const lean = AREA_LEANS[area] ?? 0;
  if (inst.kind === 'europa') return round2(0.5 * lean + 0.5 * axis);
  if (category === 'tributi') return variant === 'riduzione' ? 1.6 : -1.2;
  if (category === 'urbanistica') return variant === 'espansione' ? 1.2 : -0.6;
  if (['bilancio', 'variazione', 'sfiducia', 'tariffe'].includes(category)) return axis;
  return round2(0.55 * lean + 0.45 * axis);
}
// What an act changes once approved: the indicators it moves (the city's services for a comune, the region's indicators
// of the society simulation for a regione), the budget margin it uses or brings, the taxes, the citizens who gain and
// who pay. Motions, questions, budgets and no-confidence motions work otherwise; Europe's acts move positions and
// careers, not the services of a territory.
export function measureOf(inst, { category, area, variant = null, intensity = 2 }) {
  const type = actTypeOf(inst.kind, category);
  if (!type || inst.kind === 'europa' || ['mozione', 'interrogazione', 'sfiducia', 'bilancio'].includes(category)) return null;
  const level = INTENSITY[clamp(Math.round(intensity), 1, 3) - 1];
  const effect = type.effect * level.effect;
  const down = variant === 'riduzione';
  const indicators = {};
  const put = (id, value) => { if (id && Math.abs(value) >= 0.05) indicators[id] = round1((indicators[id] ?? 0) + value); };
  if (inst.kind === 'comune') {
    if (category === 'urbanistica') { put('territorio', effect); put('ambiente', variant === 'espansione' ? -effect * 0.5 : effect * 0.35); }
    else if (category === 'statuto') put('uffici', effect);
    else if (category === 'tariffe') put(cityIndicatorOf(area).id, down ? -effect : effect);
    else if (category !== 'tributi') put(cityIndicatorOf(area).id, effect);
  } else if (category !== 'tributi') {
    for (const [id, weight] of Object.entries(regionalWeights(area))) put(id, effect * weight);
  }
  let cost = round1(type.cost * level.cost);
  let revenue = 0;
  if (category === 'tributi' || category === 'tariffe') { cost = 0; revenue = down ? -type.revenue : type.revenue; }
  if (category === 'urbanistica') cost = variant === 'espansione' ? -2 : 1.5;
  if (cost < 0) { revenue += -cost; cost = 0; }
  const segments = {};
  const seg = (id, value) => { segments[id] = round1((segments[id] ?? 0) + value); };
  if (category === 'tributi') for (const id of ['famiglie', 'imprese']) seg(id, down ? 1.5 : -1.5);
  else if (category === 'tariffe') for (const id of cityIndicatorOf(area).segments) seg(id, down ? 1 : -1);
  else {
    for (const id of AREA_BY_ID[area]?.pleased ?? []) seg(id, 0.8 * level.effect);
    for (const id of AREA_BY_ID[area]?.displeased ?? []) seg(id, -0.4 * level.effect);
    if (category === 'urbanistica' && variant === 'espansione') seg('giovani', -0.6);
  }
  return { indicators, cost, revenue: round1(revenue), tax: category === 'tributi' ? (down ? 'giu' : 'su') : null, phase: type.phase, lasting: type.lasting, segments, intensity: level.level };
}
// A new act: its kind decides who adopts it (council, Giunta, or the executive's answer), the first step of its iter
// and the majority it needs; its text has a place between left and right and, when approved, a measure.
function newAct(inst, { kind, sponsor, area, title, date, budget = false, category = null, variant = null, intensity = 2 }) {
  const rules = INSTITUTIONS[inst.kind];
  const cat = category ?? categoryOf(inst, { kind, sponsor, budget });
  const type = actTypeOf(inst.kind, cat);
  const organ = type?.organ ?? 'consiglio';
  const first = organ === 'esecutivo' ? 'risposta' : organ === 'giunta' && !type?.committeeOpinion ? 'giunta' : ['mozione', 'sfiducia'].includes(cat) ? 'aula' : 'commissione';
  const weeks = budget ? 2 : first === 'risposta' ? 2 + (inst.acts.length % 3) : first === 'giunta' ? 1 : cat === 'sfiducia' ? (inst.kind === 'comune' ? 2 : 1) : cat === 'mozione' ? 2 : type?.committeeOpinion ? 2 : 1 + (inst.acts.length % 3);
  return {
    id: uniqueId([...inst.acts, ...inst.archive], `${inst.id}-atto-${inst.acts.length + inst.archive.length + 1}`), kind, category: cat, ...(variant ? { variant } : {}), title, area, sponsor, budget,
    stage: first, introducedAt: date, nextStepAt: advanceDays(date, weeks * 7), votes: [], pendingPlayerVote: null,
    label: (inst.kind === 'europa' ? rules.acts[kind] : null) ?? type?.label ?? rules.acts[kind], organ, quorum: type?.quorum ?? 'votanti',
    stance: stanceOf(inst, cat, area, sponsor, variant), measure: measureOf(inst, { category: cat, area, variant, intensity }),
    ...(inst.kind === 'europa' ? { committee: committeeOfArea(area).id, rapporteur: null } : {}), source: SIM
  };
}
const EU_TITLES = {
  executive: area => `Proposta di regolamento: ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'mercato interno'}`,
  majority: area => `Risoluzione su ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'Europa'}`,
  opposition: area => `Emendamenti su ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'Europa'}`
};
// What each level decides (competences, simplified): the executive and the groups propose on these areas.
const COMPETENCES = Object.freeze({
  comune: ['casa', 'trasporti', 'ambiente', 'sicurezza', 'cultura', 'sport', 'welfare', 'scuola', 'turismo', 'commercio', 'infrastrutture', 'giovani', 'pa', 'digitale'],
  regione: ['sanita', 'trasporti', 'agricoltura', 'ambiente', 'lavoro', 'industria', 'scuola', 'turismo', 'welfare', 'infrastrutture', 'casa', 'cultura', 'energia', 'autonomie']
});
const within = (kind, pool) => { const allowed = COMPETENCES[kind]; if (!allowed) return pool; const own = pool.filter(area => allowed.includes(area)); return own.length ? own : allowed; };
const EU_AREAS = ['europa', 'ambiente', 'agricoltura', 'digitale', 'immigrazione', 'energia', 'industria', 'commercio', 'difesa', 'esteri', 'lavoro'];
// The themes the player can bring to the institution (its competences).
export const localAreas = kind => kind === 'europa' ? EU_AREAS : COMPETENCES[kind] ?? [];
export const isClosedAct = act => CLOSED.includes(act.stage);
// The themes where the city's services are weakest: the executive and the opposition look at them first.
function weakCityAreas(inst, count = 2) {
  if (!inst.indicators) return [];
  const own = COMPETENCES.comune;
  return CITY_INDICATORS.filter(item => item.areas.some(area => own.includes(area))).sort((a, b) => (inst.indicators[a.id] ?? 50) - (inst.indicators[b.id] ?? 50)).slice(0, count).map(item => item.areas.find(area => own.includes(area)));
}
// How the territory is doing on a theme: the city's service for a comune, the region's indicators weighed for the theme
// (territory: those of the society simulation) for a regione.
export function territoryValue(inst, area, territory = null) {
  if (inst.kind === 'comune') return inst.indicators?.[cityIndicatorOf(area).id] ?? null;
  const weights = Object.entries(regionalWeights(area)).filter(([id]) => Number.isFinite(territory?.[id]));
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  return total ? round1(weights.reduce((sum, [id, weight]) => sum + territory[id] * weight, 0) / total) : null;
}
// How much a group supports an act. The text first: how close it is to the group's collocazione and how much its theme
// unites (culture, sport and public works bring many on board, taxes and security divide); then the politics of the
// act (a budget or a no-confidence motion is a vote on the executive, a regulation much less), who proposes it, the
// priorities of the group's camp (a theme it cares about pulls it closer, or further if it disagrees), the money (taxes,
// spending without margin), the executive's stability, the group's cohesion and the concessions it received. So the
// same group votes for one act and against another, in the majority as in the opposition.
function support(inst, act, group) {
  if (act.sponsor.groupId && act.sponsor.groupId === group.id) return 0.92;
  const inMajority = group.side === 'maggioranza';
  const fromMajority = act.sponsor.kind === 'executive' || act.sponsor.kind === 'budget' || (act.sponsor.groupId && governing(inst).has(act.sponsor.groupId));
  const category = categoryOf(inst, act);
  const type = actTypeOf(inst.kind, category);
  const stance = act.stance ?? stanceOf(inst, category, act.area, act.sponsor, act.variant);
  const priority = CAMP_PRIORITIES[group.camp]?.includes(act.area);
  let value;
  if (inst.kind === 'europa') {
    value = 0.55 - Math.abs((group.axis ?? 0) - stance) * 0.12 + (act.kind === 'executive' ? 0.08 : 0) + (priority ? 0.06 : 0);
  } else {
    const breadth = clamp((AREA_BREADTH[act.area] ?? 0.35) + (type?.breadth ?? 0), 0, 0.9);
    const fit = clamp(1 - Math.abs((group.axis ?? 0) - stance) / 4, 0, 1);
    value = 0.5 + (type?.content ?? 1) * ((fit - 0.5) * (1 - breadth) * 1.3 + (breadth - 0.3) * 0.35);
    // Government and opposition: the majority backs its executive, the opposition keeps its distance, more on the acts
    // that are about who governs.
    const loyalty = 0.06 + 0.22 * (type?.politics ?? 0.4);
    value += fromMajority ? (inMajority ? loyalty : -loyalty) : inMajority ? -loyalty * 0.7 : loyalty * 0.5;
    const sponsor = inst.groups.find(item => item.id === act.sponsor.groupId);
    if (sponsor) value += (1.5 - Math.abs((group.axis ?? 0) - (sponsor.axis ?? 0))) * 0.03;
    if (priority) value += fit >= 0.5 ? 0.06 : -0.08;
    if (act.measure?.tax === 'su') value += group.camp === 'destra' ? -0.14 : group.camp === 'sinistra' ? 0.04 : -0.06;
    if (act.measure?.tax === 'giu') value += group.camp === 'sinistra' ? -0.12 : group.camp === 'destra' ? 0.1 : 0.02;
    if ((act.measure?.cost ?? 0) > 0 && (inst.budget?.margin ?? 50) < act.measure.cost + 5) value -= 0.06;
    // A shared theme (a motion on a local emergency, a proposal written with the other side) gathers votes across the aisle.
    if (act.consensual) value += fromMajority ? (inMajority ? 0 : 0.22) : (inMajority ? 0.26 : 0);
  }
  if (inMajority && fromMajority) value += ((inst.executive?.stability ?? 60) - 55) / 250 + (group.cohesion - 60) / 300;
  if (act.concession?.[group.id]) value += 0.12;
  // European dossiers: an amendment carried brings the text closer to its group; the rapporteur writes compromises.
  if (act.amended?.[group.id]) value += act.amended[group.id];
  if (act.rapporteur) value += act.rapporteur.groupId === group.id ? 0.1 : 0.03;
  // A majority group that feels neglected makes the executive pay on its acts.
  if (inMajority && fromMajority && group.cohesion < 50) value -= (50 - group.cohesion) / 120;
  return clamp(value, 0.05, 0.95);
}
const lineOf = value => value >= 0.55 ? 'favorevole' : value <= 0.42 ? 'contrario' : 'astenuto';
// The player's seat in a vote: the chosen vote (or the line of the group) takes the place of one of the group's votes.
const BALLOT = Object.freeze({ favorevole: 'yes', contrario: 'no', astenuto: 'abstain', assente: 'absent' });
// The rule of a vote in the assembly: the majority the act needs (see QUORUMS: of the voters, of the members, two
// thirds) and the members who must be present for the vote to be valid (legal number; lower in a second call).
export function voteRule(inst, act) {
  const quorum = act.quorum && act.quorum !== 'giunta' ? act.quorum : typeOfAct(inst, act)?.quorum ?? 'votanti';
  return { quorum: ['votanti', 'componenti', 'dueterzi'].includes(quorum) ? quorum : 'votanti', seats: inst.seats, legal: legalNumber(inst.kind, inst.seats, Boolean(act.secondCall)) };
}
const validCount = (tally, rule) => !rule?.legal || tally.yes + tally.against + (tally.abstain ?? 0) >= rule.legal;
// Whether a count carries. Without a rule, the majority of the voters (more yes than no: abstentions and absences count
// for neither side); with one, its majority and its legal number.
function carriedBy(tally, rule) {
  if (!validCount(tally, rule)) return false;
  const needed = rule ? neededYes(rule.quorum, rule.seats) : null;
  return needed !== null ? tally.yes >= needed : tally.yes > tally.against;
}
export const neededFor = (rule, against) => (rule ? neededYes(rule.quorum, rule.seats) : null) ?? against + 1;
// The count of a vote: the votes of everyone else plus the player's (choice: favorevole, contrario, astenuto, assente;
// null when the player does not vote there), under a rule (none: the majority of the voters). Decisive: another vote of
// the player, everyone else voting as they did, would have given the opposite outcome.
export function countVote(others, choice = null, rule = null) {
  const ballot = choice ? BALLOT[choice] : null;
  if (choice && !ballot) throw new Error('Scelta di voto non valida.');
  const withBallot = key => ({ yes: (others.yes ?? 0) + (key === 'yes' ? 1 : 0), against: (others.against ?? 0) + (key === 'no' ? 1 : 0), abstain: (others.abstain ?? 0) + (key === 'abstain' ? 1 : 0), absent: (others.absent ?? 0) + (key === 'absent' ? 1 : 0) });
  const tally = withBallot(ballot);
  const passed = carriedBy(tally, rule);
  const decisive = Boolean(ballot) && Object.values(BALLOT).some(other => carriedBy(withBallot(other), rule) !== passed);
  return { ...tally, passed, decisive, valid: validCount(tally, rule), needed: neededFor(rule, tally.against) };
}
// What an archived act keeps of its vote: the totals, the outcome, the majority it needed and the player's vote.
export const compactVote = vote => vote ? { date: vote.date, organ: vote.organ ?? 'consiglio', quorum: vote.quorum ?? 'votanti', needed: vote.needed ?? null, yes: vote.yes, against: vote.against, abstain: vote.abstain ?? 0, absent: vote.absent ?? (vote.byGroup ?? []).reduce((sum, row) => sum + (row.absent ?? 0), 0), passed: Boolean(vote.passed), playerChoice: vote.playerChoice ?? null, playerLine: vote.playerLine ?? null, decisive: Boolean(vote.decisive) } : null;
// The Giunta decides collegially: every assessore follows how the own group sees the act, the head of the executive
// (who brings it) votes in favour; it passes with the majority of its members.
function giuntaRoll(inst, act) {
  return (inst.executive?.members ?? []).map(member => {
    const group = inst.groups.find(item => item.id === member.groupId);
    const value = group ? support(inst, act, group) : 0.7;
    return { portfolio: member.portfolio, groupId: member.groupId, support: round2(value), line: lineOf(value) };
  });
}
function giuntaForecast(inst, act) {
  const members = giuntaRoll(inst, act);
  const total = members.length + 1;
  const yes = 1 + members.filter(item => item.line === 'favorevole').length;
  const against = members.filter(item => item.line === 'contrario').length;
  const needed = Math.floor(total / 2) + 1;
  return { organ: 'giunta', quorum: 'giunta', yes, against, abstain: total - yes - against, absent: 0, total, needed, passes: yes >= needed, members, positions: [] };
}
function giuntaVote(inst, act, date) {
  const rand = seededRandom(`${act.id}|giunta|${date}`);
  const members = giuntaRoll(inst, act).map(item => ({ ...item, vote: rand() < cohesiveShare(item.support) ? 'favorevole' : item.line === 'astenuto' ? 'astenuto' : 'contrario' }));
  const total = members.length + 1;
  const yes = 1 + members.filter(item => item.vote === 'favorevole').length;
  const against = members.filter(item => item.vote === 'contrario').length;
  const needed = Math.floor(total / 2) + 1;
  const leads = inst.executive?.leader === 'player';
  return { date, organ: 'giunta', quorum: 'giunta', yes, against, abstain: total - yes - against, absent: 0, total, needed, passed: yes >= needed, valid: true, members, byGroup: [], playerChoice: leads ? 'favorevole' : null, playerLine: leads ? 'favorevole' : null, decided: leads, decisive: leads && yes === needed, source: SIM };
}
// The forecast before the vote: every group votes as its members lean today (the usual defections included) and the
// player's seat as the player chose (with the group, until a choice is made); passes if it reaches the majority its
// kind needs (more yes than no, or a share of all the seats), with the legal number. An act of the Giunta: its members.
export function forecastAct(inst, act) {
  if ((act.organ ?? typeOfAct(inst, act)?.organ) === 'giunta') return giuntaForecast(inst, act);
  const rule = voteRule(inst, act);
  const pending = BALLOT[act.pendingPlayerVote] ? act.pendingPlayerVote : null;
  let playerChoice = null;
  const positions = inst.groups.map(group => {
    const value = support(inst, act, group);
    const line = lineOf(value);
    const own = group.id === inst.playerGroupId && group.seats > 0;
    const members = own ? group.seats - 1 : group.seats;
    const split = splitGroupVote({ seats: members, yes: Math.round(members * cohesiveShare(value)), seed: `${act.id}|${group.id}` });
    const row = { yes: split.yes, no: split.no, abstain: split.abstain, absent: 0 };
    if (own) { playerChoice = pending ?? line; row[BALLOT[playerChoice]] += 1; }
    return { groupId: group.id, label: group.label, seats: group.seats, side: group.side, support: Math.round(value * 100) / 100, line, ...row, ...(own ? { playerChoice } : {}) };
  });
  const sum = key => positions.reduce((total, row) => total + row[key], 0);
  const tally = { yes: sum('yes'), against: sum('no'), abstain: sum('abstain'), absent: sum('absent') };
  return { organ: 'consiglio', ...tally, needed: neededFor(rule, tally.against), quorum: rule.quorum, legal: rule.legal, total: inst.seats, passes: carriedBy(tally, rule), positions, playerChoice };
}
function voteAct(inst, act, date) {
  const decided = act.pendingPlayerVote;
  let choice = null, line = null;
  const rand = seededRandom(`${act.id}|${date}`);
  const byGroup = inst.groups.map(group => {
    const value = support(inst, act, group);
    const own = group.id === inst.playerGroupId;
    // The day of the vote: a few absent, a few who follow their own mind (more in a group that holds together less).
    let absent = Math.floor(group.seats * rand() * 0.12);
    const others = Math.max(0, (own ? group.seats - 1 : group.seats) - absent);
    const mood = clamp(value + (rand() - 0.5) * (0.12 + (100 - group.cohesion) / 250), 0.02, 0.98);
    let yes = Math.round(others * cohesiveShare(mood));
    const split = splitGroupVote({ seats: others, yes, seed: `${act.id}|${group.id}` });
    let no = split.no, abstain = split.abstain;
    if (own) {
      // The player's seat: one of the group's votes, as the player chose (or with the line of the group).
      line = lineOf(value);
      choice = !decided || decided === 'linea' ? line : BALLOT[decided] ? decided : 'assente';
      if (choice === 'favorevole') yes += 1; else if (choice === 'contrario') no += 1; else if (choice === 'astenuto') abstain += 1; else absent += 1;
    }
    return { groupId: group.id, yesVotes: yes, noVotes: no, abstainVotes: abstain, absent, line: groupLine({ yes, no, abstain }), seats: group.seats, ...(own ? { playerChoice: choice } : {}) };
  });
  const total = key => byGroup.reduce((sum, row) => sum + row[key], 0);
  // The outcome from the votes actually cast, the player's included; decisive only if another vote of the player
  // would have reversed it.
  const ballot = choice ? BALLOT[choice] : null;
  const others = { yes: total('yesVotes') - (ballot === 'yes' ? 1 : 0), against: total('noVotes') - (ballot === 'no' ? 1 : 0), abstain: total('abstainVotes') - (ballot === 'abstain' ? 1 : 0), absent: total('absent') - (ballot === 'absent' ? 1 : 0) };
  const rule = voteRule(inst, act);
  const count = countVote(others, choice, rule);
  return { date, organ: 'consiglio', quorum: rule.quorum, needed: count.needed, legal: rule.legal, valid: count.valid, yes: count.yes, against: count.against, abstain: count.abstain, absent: count.absent, total: inst.seats, passed: count.passed, byGroup, playerChoice: choice, playerLine: line, decided: Boolean(decided), decisive: count.decisive, source: SIM };
}

// ---------- the player ----------
export const LOCAL_VOTE_CHOICES = Object.freeze({ linea: 'Con il tuo gruppo', favorevole: 'Favorevole', contrario: 'Contrario', astenuto: 'Astenuto', assente: 'Assente' });
export function setLocalVote(inst, actId, choice) {
  if (!LOCAL_VOTE_CHOICES[choice]) throw new Error('Scelta di voto non valida.');
  const act = inst.acts.find(item => item.id === actId);
  if (!act || CLOSED.includes(act.stage)) throw new Error('L’atto non è più in discussione.');
  // Only the acts of the council are voted in the chamber: the Giunta adopts its own, the executive answers questions.
  const organ = act.organ ?? typeOfAct(inst, act)?.organ ?? 'consiglio';
  if (organ !== 'consiglio') throw new Error(organ === 'giunta' ? 'Questo atto lo adotta la Giunta: il consiglio non lo vota.' : 'All’interrogazione risponde l’esecutivo: non si vota.');
  return { ...inst, acts: inst.acts.map(item => item.id === actId ? { ...item, pendingPlayerVote: choice } : item) };
}
// The player proposes an act on a theme: a councillor a motion or a deliberation of the council, the head of the
// executive the acts of the Giunta and those it brings to the council (plans, works, taxes...), an MEP an own-initiative
// report. category: the kind (see ACT_TYPES; by default the one the theme calls for), variant: for taxes, tariffs and
// town planning.
export function proposeLocalAct(inst, area, date, { category = null, variant = null, intensity = 2 } = {}) {
  if (!AREA_BY_ID[area]) throw new Error('Scegli un tema.');
  inst = withLocalState(inst);
  if (inst.acts.some(item => item.sponsor.kind === 'player' && item.category !== 'interrogazione' && !CLOSED.includes(item.stage))) throw new Error('Hai già una proposta in discussione: aspetta il voto.');
  const leads = inst.executive?.leader === 'player';
  const type = inst.kind === 'europa' ? actTypeOf('europa', 'ue-relazione') : category ? actTypeOf(inst.kind, category) : naturalType(inst.kind, area, leads);
  if (!type || (inst.kind !== 'europa' && !type.player.includes(leads ? 'leader' : 'consigliere'))) throw new Error(leads ? 'Questo atto non lo propone chi guida l’esecutivo.' : 'Questo atto lo propone solo chi guida l’esecutivo.');
  if (type.id === 'tributi' && inst.acts.some(item => item.category === 'tributi' && !CLOSED.includes(item.stage))) throw new Error('C’è già una proposta sulle aliquote in discussione.');
  const theme = typeFitsArea(type, area) ? area : type.areas[0];
  const choice = type.variants ? (type.variants.includes(variant) ? variant : type.variants[0]) : null;
  const title = inst.kind === 'europa' ? `${INSTITUTIONS.europa.acts.player}: ${AREA_BY_ID[area].label.toLowerCase()}` : actTitle(inst.kind, type.id, theme, { variant: choice });
  const act = newAct(inst, { kind: 'player', sponsor: { kind: leads ? 'executive' : 'player', groupId: inst.playerGroupId, label: 'Tu', axis: inst.groups.find(group => group.id === inst.playerGroupId)?.axis ?? 0 }, area: theme, title, date, category: type.id, variant: choice, intensity });
  return record({ ...inst, acts: [...inst.acts, { ...act, pendingPlayerVote: 'favorevole' }] }, date, `Presenti “${title}”.`, 'proposta');
}
// The executive (the player as mayor or president) wins a wavering group with a concession on an act.
export function concedeToGroup(inst, actId, groupId, date) {
  const act = inst.acts.find(item => item.id === actId);
  const group = inst.groups.find(item => item.id === groupId);
  if (!act || CLOSED.includes(act.stage) || !group) throw new Error('Trattativa non disponibile.');
  if (act.concession?.[groupId]) throw new Error('Hai già fatto una concessione a questo gruppo.');
  const next = { ...inst, acts: inst.acts.map(item => item.id === actId ? { ...item, concession: { ...(item.concession ?? {}), [groupId]: date } } : item), groups: inst.groups.map(item => item.id === groupId ? { ...item, cohesion: clamp(item.cohesion + 4, 0, 100) } : item) };
  return record(next, date, `Concessione a ${group.label} su “${act.title}”.`, 'trattativa');
}
// A question to the executive (the opposition's weapon): pressure at once, then the answer on the theme (area; by
// default the weakest service of the city), good or poor depending on how the service is doing.
export function questionExecutive(inst, date, area = null) {
  if (inst.lastQuestionAt && weeksBetween(inst.lastQuestionAt, date) < 3) throw new Error('Hai presentato un’interrogazione da poco.');
  inst = withLocalState(inst);
  let next = { ...inst, lastQuestionAt: date, pressure: clamp(inst.pressure + 6, 0, 100), executive: inst.executive ? { ...inst.executive, stability: clamp(inst.executive.stability - 2, 0, 100) } : inst.executive };
  if (inst.kind !== 'europa') {
    const theme = AREA_BY_ID[area] ? area : weakCityAreas(inst, 1)[0] ?? COMPETENCES[inst.kind]?.[0] ?? 'pa';
    const own = inst.groups.find(group => group.id === inst.playerGroupId);
    next = { ...next, acts: [...next.acts, newAct(next, { kind: 'player', sponsor: { kind: 'player', groupId: inst.playerGroupId, label: 'Tu', axis: own?.axis ?? 0 }, area: theme, title: actTitle(inst.kind, 'interrogazione', theme), date, category: 'interrogazione' })] };
  }
  return record(next, date, 'Presenti un’interrogazione: l’esecutivo deve rispondere in aula.', 'interrogazione');
}
// The head of the executive changes an assessore: the group that gains is grateful, the one that loses resents it.
export function reshuffleLocal(inst, portfolio, groupId, date) {
  if (inst.executive?.leader !== 'player') throw new Error('Solo chi guida l’esecutivo nomina gli assessori.');
  const member = inst.executive.members.find(item => item.portfolio === portfolio);
  const group = inst.groups.find(item => item.id === groupId && item.side === 'maggioranza');
  if (!member || !group) throw new Error('Scegli un assessorato e un gruppo della maggioranza.');
  if (member.groupId === groupId) throw new Error('L’assessorato è già di quel gruppo.');
  const members = inst.executive.members.map(item => item.portfolio === portfolio ? { ...item, groupId, label: `Assessore (figura simulata) · ${group.label}` } : item);
  const groups = inst.groups.map(item => item.id === groupId ? { ...item, cohesion: clamp(item.cohesion + 8, 0, 100) } : item.id === member.groupId ? { ...item, cohesion: clamp(item.cohesion - 10, 0, 100) } : item);
  return record({ ...inst, groups, executive: { ...inst.executive, members } }, date, `Rimpasto: l’assessorato ${portfolio} passa a ${group.label}.`, 'rimpasto');
}
export function setLocalTax(inst, level, date) {
  if (inst.executive?.leader !== 'player' || !inst.budget) throw new Error('Solo chi guida l’esecutivo decide le aliquote.');
  if (!['bassa', 'media', 'alta'].includes(level)) throw new Error('Livello non valido.');
  const margin = clamp(inst.budget.margin + ({ bassa: -12, media: 0, alta: 12 }[level] - { bassa: -12, media: 0, alta: 12 }[inst.budget.localTax]), 0, 100);
  return record({ ...inst, budget: { ...inst.budget, localTax: level, margin } }, date, `Nuove aliquote locali: pressione fiscale ${level}.`, 'bilancio');
}

// ---------- the European Parliament: committees, dossiers, offices ----------
// The standing committees of the European Parliament (their real names; membership, dossiers, votes and offices are
// simulated). Every dossier is prepared in the committee of its area: a rapporteur writes the report, the groups table
// amendments, the committee votes, then the plenary. The player sits as a full member in one committee and as a
// substitute in another, works there (reports, amendments, votes) and can rise to group coordinator, vice-chair, chair.
export const EP_COMMITTEES = Object.freeze([
  { id: 'afco', code: 'AFCO', label: 'Affari costituzionali', areas: ['europa'] },
  { id: 'envi', code: 'ENVI', label: 'Ambiente, clima e sicurezza alimentare', areas: ['ambiente'] },
  { id: 'itre', code: 'ITRE', label: 'Industria, ricerca ed energia', areas: ['industria', 'energia'] },
  { id: 'imco', code: 'IMCO', label: 'Mercato interno e protezione dei consumatori', areas: ['digitale'] },
  { id: 'agri', code: 'AGRI', label: 'Agricoltura e sviluppo rurale', areas: ['agricoltura'] },
  { id: 'libe', code: 'LIBE', label: 'Libertà civili, giustizia e affari interni', areas: ['immigrazione'] },
  { id: 'empl', code: 'EMPL', label: 'Occupazione e affari sociali', areas: ['lavoro'] },
  { id: 'inta', code: 'INTA', label: 'Commercio internazionale', areas: ['commercio'] },
  { id: 'afet', code: 'AFET', label: 'Affari esteri', areas: ['esteri'] },
  { id: 'sede', code: 'SEDE', label: 'Sicurezza e difesa', areas: ['difesa'] }
]);
export const committeeOfArea = area => EP_COMMITTEES.find(item => item.areas.includes(area)) ?? EP_COMMITTEES[0];
export const committeeById = id => EP_COMMITTEES.find(item => item.id === id) ?? null;
// The offices of a committee, one step at a time: the work done (merit: reports and amendments approved) and some
// time in the previous office open the next one; capital pays the campaign, the committee's vote decides.
export const EP_ROLES = Object.freeze([
  { id: 'coordinatore', label: 'Coordinatore del gruppo in commissione', title: code => `Coordinatore del gruppo in commissione ${code}`, merit: 5, after: 0, capital: 3, base: 0.45, stats: { influence: 2, notoriety: 1 } },
  { id: 'vicepresidente', label: 'Vicepresidente di commissione', title: code => `Vicepresidente della commissione ${code}`, merit: 15, after: 26, capital: 4, base: 0.3, stats: { influence: 3, notoriety: 1.5, reputation: 0.5 } },
  { id: 'presidente', label: 'Presidente di commissione', title: code => `Presidente della commissione ${code}`, merit: 30, after: 52, capital: 5, base: 0.2, stats: { influence: 4, notoriety: 2, reputation: 1 } }
]);
const COMMITTEE_SEATS = 60;
export const EP_COSTS = Object.freeze({ rapporteur: 2, amendment: 1, committee: 2 });
// The seat of a new MEP: the group assigns a committee as full member and one as substitute.
function europeanSeat(seed, date, preferred = null) {
  const rand = seededRandom(`${seed}|commissioni`);
  const member = committeeById(preferred)?.id ?? EP_COMMITTEES[Math.floor(rand() * EP_COMMITTEES.length)].id;
  const others = EP_COMMITTEES.filter(item => item.id !== member);
  return { member, substitute: others[Math.floor(rand() * others.length)].id, role: null, roleSince: null, merit: 0, reports: 0, amendments: { tabled: 0, carried: 0 }, lastBid: null, lastRequest: null, since: date, source: SIM };
}
// Saves made before the committees existed: the MEP gets a seat and the dossiers their committee.
export function withEuropeanSeat(inst, date) {
  if (inst?.kind !== 'europa' || inst.ep) return inst;
  return { ...inst, ep: europeanSeat(inst.id, inst.since ?? date), acts: inst.acts.map(act => act.committee ? act : { ...act, committee: committeeOfArea(act.area).id, rapporteur: act.rapporteur ?? null }) };
}
const groupShare = inst => (inst.groups.find(group => group.id === inst.playerGroupId)?.seats ?? 0) / (inst.seats || 1);
const roleIndex = inst => EP_ROLES.findIndex(role => role.id === inst.ep?.role);
export const inCommittee = (inst, act) => Boolean(inst.ep && act.committee && [inst.ep.member, inst.ep.substitute].includes(act.committee));
export const nextEuropeanRole = inst => EP_ROLES[roleIndex(inst) + 1] ?? null;
// The odds of the player's moves in the European Parliament (the UI shows them before the choice).
export function europeanOdds(inst, act = null, { influence = 30 } = {}) {
  const share = groupShare(inst);
  const office = Math.max(0, roleIndex(inst) + 1) * 0.08;
  const role = nextEuropeanRole(inst);
  return {
    // Reports go to the groups in proportion to their weight (the points system): a large group, an office and a name help.
    rapporteur: clamp(0.22 + share * 1.6 + office + (influence - 50) / 200, 0.08, 0.85),
    // An amendment passes in committee when the others can accept it: harder against a text the own group dislikes.
    amendment: act ? clamp(0.4 + (support(inst, act, inst.groups.find(group => group.id === inst.playerGroupId) ?? { axis: 0, side: 'opposizione', cohesion: 60 }) - 0.5) * 0.6 + (act.rapporteur?.player ? 0.3 : 0) + office + (influence - 50) / 300, 0.1, 0.9) : null,
    role: role ? clamp(role.base + share * 0.8 + (influence - 50) / 150 + ((inst.ep?.merit ?? 0) - role.merit) * 0.03, 0.05, 0.85) : null,
    committee: clamp(0.45 + (influence - 50) / 150 + share * 0.5, 0.15, 0.85)
  };
}
const openDossier = (inst, actId) => {
  const act = inst.acts.find(item => item.id === actId);
  if (!inst.ep || !act || CLOSED.includes(act.stage)) throw new Error('Il dossier non è più in discussione.');
  if (act.stage !== 'commissione') throw new Error('Il dossier ha già lasciato la commissione: ora decide la plenaria.');
  return act;
};
// The player asks for a report: in the own committee, before the committee vote, when nobody has it yet.
export function bidRapporteur(inst, actId, { influence = 30, rand = Math.random, date } = {}) {
  inst = withEuropeanSeat(inst, date);
  const act = openDossier(inst, actId);
  if (act.committee !== inst.ep.member) throw new Error('Puoi chiedere le relazioni solo nella commissione di cui sei membro titolare.');
  if (act.rapporteur) throw new Error('Il dossier ha già un relatore.');
  if (act.sponsor.kind === 'player') throw new Error('È già la tua relazione.');
  const won = rand() < europeanOdds(inst, act, { influence }).rapporteur;
  const rivals = inst.groups.filter(group => group.id !== inst.playerGroupId).sort((a, b) => b.seats - a.seats);
  const other = rivals[Math.floor(rand() * Math.min(3, rivals.length))] ?? null;
  const rapporteur = won ? { groupId: inst.playerGroupId, player: true } : { groupId: other?.id ?? null, player: false };
  const next = { ...inst, acts: inst.acts.map(item => item.id === actId ? { ...item, rapporteur } : item) };
  return { inst: record(next, date, won ? `Sei relatore di “${act.title}”.` : `La relazione su “${act.title}” va a ${other?.label ?? 'un altro gruppo'}.`, 'relazione'), won, group: won ? null : other?.label ?? null };
}
// An amendment to a dossier of the own committees (full member or substitute), one per dossier.
export function tableAmendment(inst, actId, { influence = 30, rand = Math.random, date } = {}) {
  inst = withEuropeanSeat(inst, date);
  const act = openDossier(inst, actId);
  if (!inCommittee(inst, act)) throw new Error('Puoi emendare solo i dossier delle tue commissioni.');
  if (act.playerAmendment) throw new Error('Hai già presentato i tuoi emendamenti su questo dossier.');
  const carried = rand() < europeanOdds(inst, act, { influence }).amendment;
  const amended = carried ? { ...(act.amended ?? {}), [inst.playerGroupId]: round1((act.amended?.[inst.playerGroupId] ?? 0) + 0.08) } : act.amended ?? {};
  const ep = { ...inst.ep, merit: inst.ep.merit + (carried ? 1 : 0), amendments: { tabled: inst.ep.amendments.tabled + 1, carried: inst.ep.amendments.carried + (carried ? 1 : 0) } };
  const next = { ...inst, ep, acts: inst.acts.map(item => item.id === actId ? { ...item, amended, playerAmendment: { carried, date } } : item) };
  return { inst: record(next, date, `${carried ? 'Approvato in commissione' : 'Respinto in commissione'} il tuo emendamento a “${act.title}”.`, 'emendamento'), carried };
}
// The next office of the committee: the merit gathered opens the race, the vote of the committee decides.
export function runForCommitteeRole(inst, { influence = 30, rand = Math.random, date } = {}) {
  inst = withEuropeanSeat(inst, date);
  if (!inst.ep) throw new Error('Serve un seggio al Parlamento europeo.');
  const role = nextEuropeanRole(inst);
  if (!role) throw new Error('Guidi già la tua commissione.');
  if (inst.ep.merit < role.merit) throw new Error(`Per ${role.label.toLowerCase()} serve più lavoro in commissione (${inst.ep.merit} su ${role.merit}: relazioni ed emendamenti approvati).`);
  if (inst.ep.role && weeksBetween(inst.ep.roleSince, date) < role.after) throw new Error(`Per ${role.label.toLowerCase()} servono almeno ${role.after} settimane nell’incarico attuale.`);
  if (inst.ep.lastBid && weeksBetween(inst.ep.lastBid, date) < 8) throw new Error('Hai tentato da poco: riprova tra qualche settimana.');
  const won = rand() < europeanOdds(inst, null, { influence }).role;
  const committee = committeeById(inst.ep.member);
  const ep = { ...inst.ep, lastBid: date, ...(won ? { role: role.id, roleSince: date } : {}) };
  return { inst: record({ ...inst, ep }, date, won ? `${role.title(committee.code)}: eletto.` : `Non eletto ${role.label.toLowerCase()}: la commissione sceglie un altro nome.`, 'incarico'), won, role, committee };
}
// A move to another committee: the group decides, and the offices of the old one are left behind.
export function requestCommittee(inst, committeeId, { influence = 30, rand = Math.random, date } = {}) {
  inst = withEuropeanSeat(inst, date);
  if (!inst.ep) throw new Error('Serve un seggio al Parlamento europeo.');
  const target = committeeById(committeeId);
  if (!target || target.id === inst.ep.member) throw new Error('Scegli una commissione diversa dalla tua.');
  if (inst.ep.lastRequest && weeksBetween(inst.ep.lastRequest, date) < 26) throw new Error('Il gruppo ha già discusso la tua richiesta: riprova tra qualche mese.');
  const moved = rand() < europeanOdds(inst, null, { influence }).committee;
  const ep = moved ? { ...inst.ep, member: target.id, substitute: inst.ep.substitute === target.id ? inst.ep.member : inst.ep.substitute, role: null, roleSince: null, lastRequest: date } : { ...inst.ep, lastRequest: date };
  return { inst: record({ ...inst, ep }, date, moved ? `Passi alla commissione ${target.code} (${target.label}).` : `Il gruppo respinge la richiesta di passare alla commissione ${target.code}.`, 'commissione'), moved, committee: target, leftRole: moved ? inst.ep.role : null };
}
// The vote in committee (about sixty members, the groups in proportion): the player votes as a full member.
function committeeVote(inst, act, date) {
  const total = inst.seats || 1;
  const groups = inst.groups.map(group => ({ ...group, seats: Math.max(1, Math.round(group.seats / total * COMMITTEE_SEATS)) }));
  const member = inst.ep?.member === act.committee;
  return voteAct({ ...inst, groups, seats: groups.reduce((sum, group) => sum + group.seats, 0), playerGroupId: member ? inst.playerGroupId : null }, act, date);
}

// ---------- effects of the acts ----------
// The effect of an approved act on the city's services, week after week (a temporary one partly fades afterwards, as
// the national measures do).
function cityEffects(act, measure) {
  return Object.entries(measure.indicators).flatMap(([indicator, delta]) => [
    { actId: act.id, title: act.title, indicator, perWeek: round2(delta / measure.phase), remaining: measure.phase, delay: 0 },
    ...(measure.lasting ? [] : [{ actId: act.id, title: `${act.title} (fine dell’effetto)`, indicator, perWeek: round2(-delta * 0.6 / 12), remaining: 12, delay: measure.phase }])
  ]);
}
// What an act of a city brings to its region: a share, on the region's indicators.
function cityToRegion(indicators) {
  const out = {};
  for (const [id, delta] of Object.entries(indicators)) {
    const region = CITY_INDICATORS.find(item => item.id === id)?.region;
    if (region) out[region] = round2((out[region] ?? 0) + delta * CITY_SHARE_OF_REGION);
  }
  return out;
}
// A week of the city: the effects of the approved acts arrive; without care the services wear out, more in a
// provisional budget (only the mandatory spending goes on).
function cityWeek(inst, rand) {
  const indicators = { ...inst.indicators };
  const effects = [];
  for (const effect of inst.effects ?? []) {
    if (effect.delay > 0) { effects.push({ ...effect, delay: effect.delay - 1 }); continue; }
    indicators[effect.indicator] = round1(clamp((indicators[effect.indicator] ?? 50) + effect.perWeek, 0, 100));
    if (effect.remaining > 1) effects.push({ ...effect, remaining: effect.remaining - 1 });
  }
  for (const item of CITY_INDICATORS) {
    const value = indicators[item.id] ?? 50;
    const wear = ['opere', 'mobilita', 'sociale', 'territorio'].includes(item.id) ? 0.04 : 0.02;
    indicators[item.id] = round1(clamp(value - wear - (inst.budget?.provisional ? 0.15 : 0) + (50 - value) * 0.004 + (rand() - 0.5) * 0.3, 0, 100));
  }
  return { ...inst, indicators, effects };
}
// What the executive brings on a theme: a kind of act among those that fit it (as often as each is used), a tax change
// when the budget asks for it, an intensity; with a provisional budget only acts without new spending.
function executivePlan(inst, area, rand) {
  const margin = inst.budget?.margin ?? 50;
  const tax = inst.budget?.localTax ?? 'media';
  if (margin < 18 && tax !== 'alta' && rand() < 0.3) return { type: actTypeOf(inst.kind, 'tributi'), area: 'fisco', variant: 'aumento', intensity: 2 };
  if (margin > 78 && tax !== 'bassa' && rand() < 0.15) return { type: actTypeOf(inst.kind, 'tributi'), area: 'fisco', variant: 'riduzione', intensity: 2 };
  const pool = ACT_TYPES[inst.kind].filter(type => type.weight > 0 && type.id !== 'tributi' && typeFitsArea(type, area) && (!inst.budget?.provisional || type.cost <= 0.5));
  if (!pool.length) return { type: actTypeOf(inst.kind, 'regolamento'), area, variant: null, intensity: 2 };
  let pick = rand() * pool.reduce((sum, type) => sum + type.weight, 0);
  const type = pool.find(item => (pick -= item.weight) < 0) ?? pool[0];
  const camp = inst.executive?.camp ?? 'centro';
  const variant = type.id === 'urbanistica' ? (rand() < (camp === 'destra' ? 0.65 : camp === 'sinistra' ? 0.25 : 0.45) ? 'espansione' : 'rigenerazione') : type.id === 'tariffe' ? (margin < 35 ? 'aumento' : 'riduzione') : null;
  const draw = rand();
  return { type, area, variant, intensity: draw < 0.3 ? 1 : draw < 0.8 ? 2 : 3 };
}
// Money first: an act that spends needs cover (the accounting opinion) and cannot start in a provisional budget.
export function coverageGap(inst, act) {
  const cost = act.measure?.cost ?? 0;
  if (!inst.budget || cost <= 0) return null;
  if (inst.budget.provisional) return 'esercizio provvisorio: niente nuove spese finché non passa il bilancio';
  if (cost > inst.budget.margin) return `manca la copertura finanziaria (servono ${cost} punti di margine, ce ne sono ${inst.budget.margin})`;
  return null;
}
// An approved act takes effect: the money at once, the services week after week (the city's here, the region's through
// the career), the taxes, the budget of the year, the commitment of a motion, the commitments it keeps.
function applyApproved(inst, act, date, events) {
  let next = inst;
  const measure = act.measure ?? null;
  const category = categoryOf(inst, act);
  if (next.budget && measure) {
    const localTax = measure.tax ? TAX_STEPS[clamp(TAX_STEPS.indexOf(next.budget.localTax) + (measure.tax === 'su' ? 1 : -1), 0, 2)] : next.budget.localTax;
    next = { ...next, budget: { ...next.budget, margin: round1(clamp(next.budget.margin - measure.cost + measure.revenue, 0, 100)), localTax } };
  }
  if (measure && Object.keys(measure.indicators).length) {
    if (next.kind === 'comune') next = { ...next, effects: [...(next.effects ?? []), ...cityEffects(act, measure)] };
    events.push({ type: 'effetti', actId: act.id, title: act.title, kind: next.kind, region: next.region, indicators: next.kind === 'regione' ? measure.indicators : cityToRegion(measure.indicators), phase: measure.phase, lasting: measure.lasting, segments: measure.segments });
  }
  if (category === 'bilancio' && next.budget) {
    const year = Number(act.title.match(/(\d{4})$/)?.[1] ?? Number(date.slice(0, 4)) + 1);
    next = { ...next, budget: { ...next.budget, approvedYear: year, margin: round1(clamp(next.budget.margin + 24 + TAX_BONUS[next.budget.localTax], 0, 90)), provisional: false, failures: 0, retryAt: null } };
  }
  if (category === 'statuto') next = { ...next, pressure: clamp(next.pressure - 4, 0, 100) };
  // A motion approved commits the executive: an act on its theme within eight weeks (one commitment per theme at a time).
  if (category === 'mozione' && next.executive && !(next.commitments ?? []).some(entry => entry.status === 'aperto' && entry.area === act.area)) next = { ...next, commitments: [...(next.commitments ?? []), { id: uniqueId(next.commitments ?? [], `${act.id}-impegno`), actId: act.id, area: act.area, title: act.title, player: act.sponsor.kind === 'player', from: act.sponsor.groupId ?? null, since: date, dueAt: advanceDays(date, 56), status: 'aperto' }].slice(-12) };
  // An act of the executive on the theme of an open commitment keeps it.
  const kept = ['executive', 'budget'].includes(act.sponsor.kind) && measure ? (next.commitments ?? []).filter(entry => entry.status === 'aperto' && entry.area === act.area) : [];
  if (kept.length) {
    next = record({ ...next, commitments: next.commitments.map(entry => kept.includes(entry) ? { ...entry, status: 'rispettato', closedAt: date } : entry), pressure: clamp(next.pressure - 2, 0, 100) }, date, `Impegno rispettato: “${act.title}” dà seguito alla mozione “${kept[0].title}”.`, 'impegno');
    for (const item of kept) events.push({ type: 'impegno-rispettato', title: item.title, player: item.player });
  }
  return next;
}
// A rejected act has its own consequences: a budget not approved means a provisional budget (for a comune the Prefect's
// warning, and dissolution at the second no), public works lose their funds, a motion becomes the flag of its
// proposers, a failed no-confidence motion strengthens the executive.
function applyRejected(inst, act, date, events) {
  let next = inst;
  const category = categoryOf(inst, act);
  if (category === 'bilancio' && next.budget) {
    const failures = (next.budget.failures ?? 0) + 1;
    next = { ...next, budget: { ...next.budget, provisional: true, failures, retryAt: advanceDays(date, 14) } };
    if (next.kind === 'comune' && failures >= 2) {
      next = record({ ...next, status: 'sciolto', dissolvedAt: date }, date, 'Bilancio respinto per la seconda volta: il Prefetto nomina un commissario, il consiglio è sciolto e si torna al voto (art. 141 TUEL).', 'scioglimento');
      events.push({ type: 'scioglimento', kind: next.kind, reason: 'bilancio' });
    } else {
      next = record(next, date, next.kind === 'comune' ? 'Bilancio respinto: esercizio provvisorio; il Prefetto diffida il consiglio ad approvarlo entro venti giorni.' : 'Legge di bilancio respinta: esercizio provvisorio, niente nuove spese finché non passa.', 'bilancio');
      events.push({ type: 'bilancio-respinto', failures, kind: next.kind });
    }
  }
  if (category === 'opere' && act.measure) {
    if (next.kind === 'comune' && next.indicators) { const id = cityIndicatorOf(act.area).id; next = { ...next, indicators: { ...next.indicators, [id]: round1(clamp(next.indicators[id] - 1, 0, 100)) } }; }
    else if (next.kind === 'regione') events.push({ type: 'effetti', actId: act.id, title: `${act.title} (fondi persi)`, kind: next.kind, region: next.region, indicators: Object.fromEntries(Object.entries(regionalWeights(act.area)).map(([id, weight]) => [id, round2(-0.8 * weight)])), phase: 1, lasting: true, immediate: true, segments: {} });
  }
  if (category === 'mozione') {
    const sponsor = next.groups.find(group => group.id === act.sponsor.groupId);
    if (sponsor?.side === 'maggioranza') next = { ...next, groups: next.groups.map(group => group.id === sponsor.id ? { ...group, cohesion: clamp(group.cohesion - 3, 0, 100) } : group) };
    else next = { ...next, pressure: clamp(next.pressure + 3, 0, 100) };
  }
  if (category === 'sfiducia' && next.executive) next = { ...next, pressure: clamp(next.pressure - 5, 0, 100), executive: { ...next.executive, stability: clamp(next.executive.stability + 3, 0, 100) } };
  return next;
}
// The executive answers a question: poorly if the service is doing badly, well if it is doing well.
function answerQuestion(inst, act, date, territory, events) {
  const value = territoryValue(inst, act.area, territory);
  const answer = value === null ? 'interlocutoria' : value < 45 ? 'insufficiente' : value >= 55 ? 'esauriente' : 'interlocutoria';
  let next = setAct(inst, act.id, { stage: 'risposto', answer, answerValue: value, closedAt: date });
  if (next.executive) next = { ...next, executive: { ...next.executive, stability: clamp(next.executive.stability + (answer === 'insufficiente' ? -3 : answer === 'esauriente' ? 1 : 0), 0, 100) }, pressure: clamp(next.pressure + (answer === 'insufficiente' ? 3 : answer === 'esauriente' ? -2 : 0), 0, 100) };
  next = record(next, date, `Risposta ${answer} all’${act.title.charAt(0).toLowerCase()}${act.title.slice(1)}${value !== null ? ` (servizio a ${Math.round(value)}/100)` : ''}.`, 'interrogazione');
  events.push({ type: 'interrogazione-risposta', actId: act.id, title: act.title, answer, value, player: act.sponsor.kind === 'player' });
  return next;
}

// ---------- one week ----------
// ctx: { date, rand, issues: [area], territory }: the problems of the territory and, for a regione, the indicators of
// the region (society simulation). Returns { inst, events, lines }: events for the career (votes of the player, effects
// of the acts, answers, commitments, requests, the fall of the executive and the early vote).
export function advanceInstitutionWeek(input, { date, rand = Math.random, issues = [], territory = null } = {}) {
  let inst = withLocalState(withEuropeanSeat(input, date));
  if (!inst || inst.status !== 'active') return { inst: input, events: [], lines: [] };
  const rules = INSTITUTIONS[inst.kind];
  const events = [];
  const lines = [];
  const add = act => { inst = record({ ...inst, acts: [...inst.acts, act] }, date, `${act.label}: “${act.title}”.`, 'atto'); };
  const majority = inst.groups.filter(group => group.side === 'maggioranza');
  const opposition = inst.groups.filter(group => group.side !== 'maggioranza');
  const pickArea = pool => pool[Math.floor(rand() * pool.length)];
  const open = inst.acts.filter(item => !CLOSED.includes(item.stage)).length;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const leaderGroup = inst.groups.find(group => group.id === inst.executive?.groupId);
  const budgetSponsor = { kind: 'budget', groupId: inst.executive?.leader === 'player' ? inst.playerGroupId : leaderGroup?.id ?? null, label: rules.executive, axis: leaderGroup?.axis ?? 0 };
  const localIssues = issues.filter(area => (COMPETENCES[inst.kind] ?? []).includes(area));
  // The territory: the city's services move with the approved acts; a region in provisional budget loses ground.
  if (inst.kind === 'comune') inst = cityWeek(inst, seededRandom(`${inst.id}|servizi|${date}`));
  if (inst.kind === 'regione' && inst.budget?.provisional) events.push({ type: 'effetti', title: 'Esercizio provvisorio', kind: inst.kind, region: inst.region, indicators: { servizi: -0.15, sanita: -0.15 }, phase: 1, lasting: true, immediate: true, segments: {} });
  // New acts. The budget: in autumn for the next year, or as soon as possible when a year runs without one.
  if (inst.budget && ((month >= 11 && inst.budget.approvedYear < year + 1) || inst.budget.approvedYear < year) && !inst.acts.some(item => item.budget && !CLOSED.includes(item.stage)) && (!inst.budget.retryAt || inst.budget.retryAt <= date)) {
    add(newAct(inst, { kind: 'budget', sponsor: budgetSponsor, area: 'finanze', title: actTitle(inst.kind, 'bilancio', 'finanze', { year: month >= 11 ? year + 1 : year }), date, budget: true, category: 'bilancio' }));
  }
  // In July the general adjustment of the budget gives resources to the weakest service.
  if (inst.budget && month === 7 && inst.budget.adjustedYear !== year && !inst.budget.provisional) {
    const area = inst.kind === 'comune' ? weakCityAreas(inst, 1)[0] ?? 'pa' : localIssues[0] ?? 'sanita';
    inst = { ...inst, budget: { ...inst.budget, adjustedYear: year } };
    add(newAct(inst, { kind: 'budget', sponsor: budgetSponsor, area, title: `Assestamento generale di bilancio ${year}: fondi per ${AREA_BY_ID[area]?.label.toLowerCase() ?? area}`, date, category: 'variazione' }));
  }
  // In Strasbourg the player follows above all the dossiers of the own committees (the others pass in plenary).
  const euroArea = () => { const draw = rand(); const own = committeeById(draw < 0.45 ? inst.ep?.member : draw < 0.6 ? inst.ep?.substitute : null); return own ? own.areas[Math.floor(rand() * own.areas.length)] : pickArea(EU_AREAS); };
  if (open < 6) {
    if (inst.executive?.leader !== 'player' && rand() < rules.rates.executive) {
      const sponsor = { kind: 'executive', groupId: leaderGroup?.id ?? null, label: rules.executive, axis: inst.kind === 'europa' ? 0.5 : leaderGroup?.axis ?? 0 };
      if (inst.kind === 'europa') {
        const area = euroArea();
        add(newAct(inst, { kind: 'executive', sponsor, area, title: EU_TITLES.executive(area), date }));
      } else {
        // The executive answers the council's commitments, the problems of the territory, its own priorities.
        const committed = (inst.commitments ?? []).filter(item => item.status === 'aperto' && (COMPETENCES[inst.kind] ?? []).includes(item.area)).map(item => item.area);
        const problems = inst.kind === 'comune' ? [...new Set([...localIssues, ...weakCityAreas(inst)])] : localIssues;
        const area = committed.length && rand() < 0.6 ? pickArea(committed) : problems.length && rand() < 0.6 ? pickArea(problems) : pickArea(within(inst.kind, CAMP_PRIORITIES[inst.executive?.camp ?? 'centro']));
        const plan = executivePlan(inst, area, rand);
        add(newAct(inst, { kind: 'executive', sponsor, area: plan.area, title: actTitle(inst.kind, plan.type.id, plan.area, { variant: plan.variant }), date, category: plan.type.id, variant: plan.variant, intensity: plan.intensity }));
      }
    }
    for (const [pool, kind] of [[majority, 'majority'], [opposition, 'opposition']]) {
      if (!pool.length || rand() >= rules.rates[kind]) continue;
      const group = pool[Math.floor(rand() * pool.length)];
      if (group.id === inst.playerGroupId && inst.kind !== 'europa') continue;
      const area = inst.kind !== 'europa' && issues.length && rand() < 0.35 ? pickArea(within(inst.kind, issues)) : inst.kind === 'europa' ? euroArea() : pickArea(within(inst.kind, CAMP_PRIORITIES[group.camp]));
      const sponsor = { kind, groupId: group.id, label: group.label, axis: group.axis ?? 0 };
      if (inst.kind === 'europa') { add(newAct(inst, { kind, sponsor, area, title: EU_TITLES[kind](area), date })); continue; }
      // The groups file motions; in the regional council they also table bills of their own (never twice the same text).
      const category = inst.kind === 'regione' && rand() < (kind === 'majority' ? 0.6 : 0.3) ? 'legge' : 'mozione';
      const act = newAct(inst, { kind, sponsor, area, title: actTitle(inst.kind, category, area), date, category });
      if (inst.acts.some(item => !CLOSED.includes(item.stage) && item.category === category && item.area === area)) continue;
      add(issues.includes(area) && rand() < 0.5 ? { ...act, consensual: true, title: `${act.title} (testo condiviso)` } : act);
    }
    // The opposition questions the executive on what works worst.
    if (inst.kind !== 'europa' && opposition.length && !inst.acts.some(item => item.category === 'interrogazione' && item.kind === 'opposition' && !CLOSED.includes(item.stage)) && rand() < 0.12) {
      const group = opposition[Math.floor(rand() * opposition.length)];
      const problems = inst.kind === 'comune' ? weakCityAreas(inst) : localIssues;
      const area = problems.length ? pickArea(problems) : pickArea(within(inst.kind, CAMP_PRIORITIES[group.camp]));
      if (group.id !== inst.playerGroupId) add(newAct(inst, { kind: 'opposition', sponsor: { kind: 'opposition', groupId: group.id, label: group.label, axis: group.axis ?? 0 }, area, title: actTitle(inst.kind, 'interrogazione', area), date, category: 'interrogazione' }));
    }
  }
  // The calendar: the committee, then the Giunta or the floor; town plans wait for the citizens' observations, statutes
  // for their second reading; questions get their answer.
  for (const act of inst.acts.filter(item => !CLOSED.includes(item.stage) && item.nextStepAt <= date)) {
    if (act.stage === 'commissione' && inst.kind === 'europa') {
      // A dossier without a rapporteur gets one from a group (by weight); then the committee votes the report.
      const pool = inst.groups.filter(group => !group.nonAttached);
      const weights = pool.map(group => group.seats);
      let pick = rand() * weights.reduce((sum, value) => sum + value, 0);
      const assigned = act.rapporteur ?? (act.kind === 'player' ? { groupId: inst.playerGroupId, player: true } : { groupId: (pool.find((group, index) => (pick -= weights[index]) < 0) ?? pool[0])?.id ?? null, player: false });
      const vote = committeeVote(inst, { ...act, rapporteur: assigned }, date);
      const code = committeeById(act.committee)?.code ?? '';
      inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, rapporteur: assigned, committeeVote: { yes: vote.yes, against: vote.against, abstain: vote.abstain, total: vote.total, passed: vote.passed, playerChoice: vote.playerChoice, date }, ...(vote.passed ? { stage: 'aula', nextStepAt: advanceDays(date, 7) } : { stage: 'respinto', closedAt: date }) } : item) };
      inst = record(inst, date, `Commissione ${code}: “${act.title}” ${vote.passed ? 'approvato, va in plenaria' : 'respinto'} (${vote.yes} sì, ${vote.against} no).`, 'commissione');
      if (inCommittee(inst, act) || assigned.player) events.push({ type: 'commissione-votata', actId: act.id, title: act.title, committee: code, passed: vote.passed, rapporteur: assigned.player, playerChoice: vote.playerChoice, playerLine: vote.playerLine, decisive: vote.decisive });
      if (assigned.player && !vote.passed) inst = { ...inst, ep: { ...inst.ep, merit: inst.ep.merit + 1 } };
      continue;
    }
    if (['commissione', 'osservazioni', 'seconda-lettura'].includes(act.stage)) { inst = setAct(inst, act.id, { stage: act.stage === 'commissione' && act.organ === 'giunta' ? 'giunta' : 'aula', nextStepAt: advanceDays(date, 7) }); continue; }
    if (act.stage === 'risposta') { inst = answerQuestion(inst, act, date, territory, events); continue; }
    const category = categoryOf(inst, act);
    const gap = coverageGap(inst, act);
    if (gap) {
      inst = record(setAct(inst, act.id, { stage: 'ritirato', closedAt: date, pendingPlayerVote: null, withdrawn: gap }), date, `“${act.title}” ritirato: ${gap}.`, 'ritirato');
      if (inst.executive && ['executive', 'budget'].includes(act.sponsor.kind)) inst = { ...inst, executive: { ...inst.executive, stability: clamp(inst.executive.stability - 2, 0, 100) } };
      events.push({ type: 'atto-ritirato', actId: act.id, title: act.title, reason: gap, player: act.kind === 'player' });
      continue;
    }
    const vote = act.stage === 'giunta' ? giuntaVote(inst, act, date) : voteAct(inst, act, date);
    // Without the legal number the sitting is adjourned to a second call; failing again, the act lapses.
    if (!vote.valid) {
      if (act.secondCall) {
        inst = record(setAct(inst, act.id, { stage: 'ritirato', closedAt: date, pendingPlayerVote: null, votes: [...act.votes, vote], withdrawn: 'manca il numero legale' }), date, `“${act.title}” decade: manca il numero legale anche in seconda convocazione.`, 'ritirato');
        events.push({ type: 'atto-ritirato', actId: act.id, title: act.title, reason: 'manca il numero legale', player: act.kind === 'player' });
      } else {
        inst = record(setAct(inst, act.id, { secondCall: true, nextStepAt: advanceDays(date, 7) }), date, `Manca il numero legale su “${act.title}” (${vote.yes + vote.against + vote.abstain} presenti, ne servono ${vote.legal}): seduta rinviata in seconda convocazione.`, 'seduta');
        events.push({ type: 'seduta-deserta', actId: act.id, title: act.title });
      }
      continue;
    }
    // Two readings: a town plan adopted waits for the citizens' observations, a regional statute for its second vote.
    const type = typeOfAct(inst, act);
    if (vote.passed && type?.readings === 'adozione' && !act.adoptedAt) {
      inst = record(setAct(inst, act.id, { adoptedAt: date, stage: 'osservazioni', nextStepAt: advanceDays(date, 56), votes: [...act.votes, vote] }), date, `${rules.label}: “${act.title}” adottato (${vote.yes} sì, ${vote.against} no); otto settimane per le osservazioni dei cittadini.`, 'adozione');
      continue;
    }
    if (vote.passed && type?.readings === 'doppia' && !act.firstReadingAt) {
      inst = record(setAct(inst, act.id, { firstReadingAt: date, stage: 'seconda-lettura', nextStepAt: advanceDays(date, 63), votes: [...act.votes, vote] }), date, `${rules.label}: prima deliberazione su “${act.title}” (${vote.yes} sì su ${inst.seats}); la seconda tra almeno due mesi.`, 'prima-lettura');
      continue;
    }
    // The statute of a comune: without two thirds, two votes by absolute majority within thirty days (art. 6 TUEL).
    if (category === 'statuto' && inst.kind === 'comune') {
      if (!vote.passed && vote.quorum === 'dueterzi') {
        inst = record(setAct(inst, act.id, { quorum: 'componenti', fallbackVotes: 0, nextStepAt: advanceDays(date, 14), votes: [...act.votes, vote] }), date, `${rules.label}: lo statuto non ha i due terzi (${vote.yes} sì, ne servivano ${vote.needed}); ora servono due voti a maggioranza assoluta entro trenta giorni.`, 'statuto');
        continue;
      }
      if (vote.passed && vote.quorum === 'componenti' && (act.fallbackVotes ?? 0) < 1) {
        inst = record(setAct(inst, act.id, { fallbackVotes: 1, nextStepAt: advanceDays(date, 14), votes: [...act.votes, vote] }), date, `${rules.label}: primo voto a maggioranza assoluta sullo statuto (${vote.yes} sì); ne serve un secondo.`, 'statuto');
        continue;
      }
    }
    const stage = vote.passed ? 'approvato' : 'respinto';
    inst = setAct(inst, act.id, { stage, votes: [...act.votes, vote], pendingPlayerVote: null, closedAt: date });
    inst = record(inst, date, vote.organ === 'giunta'
      ? `Giunta: “${act.title}” ${vote.passed ? 'adottata' : 'respinta'} (${vote.yes} sì su ${vote.total}).`
      : `${rules.label}: “${act.title}” ${vote.passed ? 'approvato' : 'respinto'} (${vote.yes} sì, ${vote.against} no${vote.abstain ? `, ${vote.abstain} ${vote.abstain === 1 ? 'astenuto' : 'astenuti'}` : ''}${vote.quorum !== 'votanti' ? `; ne servivano ${vote.needed}` : ''}${vote.playerChoice ? `; tuo voto: ${vote.playerChoice}${vote.decisive ? ', decisivo' : ''}` : ''}).`, stage);
    inst = vote.passed ? applyApproved(inst, act, date, events) : applyRejected(inst, act, date, events);
    if (inst.executive && ['executive', 'budget'].includes(act.sponsor.kind)) {
      inst = { ...inst, executive: { ...inst.executive, stability: clamp(inst.executive.stability + (vote.passed ? 1.5 : act.budget ? -8 : -5), 0, 100) } };
      // A group of the majority that did not follow the executive drifts away.
      const unhappy = new Set(vote.byGroup.filter(row => row.line !== 'favorevole').map(row => row.groupId));
      inst = { ...inst, groups: inst.groups.map(group => group.side === 'maggioranza' && unhappy.has(group.id) ? { ...group, cohesion: clamp(group.cohesion - 5, 0, 100) } : group) };
    }
    events.push({ type: 'atto-votato', actId: act.id, title: act.title, kind: act.kind, category, organ: vote.organ, variant: act.variant ?? null, budget: act.budget, sponsor: act.sponsor, area: act.area, passed: vote.passed, playerChoice: vote.playerChoice, playerLine: vote.playerLine, decided: vote.decided, decisive: vote.decisive, yes: vote.yes, against: vote.against, quorum: vote.quorum, measure: act.measure ?? null });
    if (inst.status !== 'active') return { inst, events, lines };
    // The player's report (or own-initiative report) in plenary: the work of months is judged.
    if (inst.ep && (act.rapporteur?.player || act.kind === 'player')) {
      inst = { ...inst, ep: { ...inst.ep, merit: inst.ep.merit + (vote.passed ? 3 : 1), reports: inst.ep.reports + (vote.passed ? 1 : 0) } };
      events.push({ type: 'relazione-votata', actId: act.id, title: act.title, committee: committeeById(act.committee)?.code ?? '', passed: vote.passed, own: act.kind === 'player' });
    }
  }
  // The commitments of the motions: past the deadline without an act of the executive, the council's word is ignored.
  for (const item of (inst.commitments ?? []).filter(entry => entry.status === 'aperto' && entry.dueAt <= date)) {
    inst = { ...inst, commitments: inst.commitments.map(entry => entry.id === item.id ? { ...entry, status: 'disatteso', closedAt: date } : entry), pressure: clamp(inst.pressure + 4, 0, 100), executive: inst.executive ? { ...inst.executive, stability: clamp(inst.executive.stability - 4, 0, 100) } : inst.executive };
    inst = record(inst, date, `Impegno non rispettato: la mozione “${item.title}” è rimasta senza seguito.`, 'impegno');
    events.push({ type: 'impegno-disatteso', title: item.title, area: item.area, player: item.player });
  }
  // Acts of the player's council coming to the vote within the week: the player is asked (the important ones).
  for (const act of inst.acts.filter(item => item.stage === 'aula' && item.nextStepAt <= advanceDays(date, 7) && !item.pendingPlayerVote && !item.asked)) {
    const forecast = forecastAct(inst, act);
    inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, asked: true } : item) };
    const important = act.budget || act.kind === 'sfiducia' || act.sponsor.groupId === inst.playerGroupId || act.rapporteur?.player || Math.abs(forecast.yes - forecast.needed) <= 1 || (act.kind === 'executive' && rand() < 0.2);
    if (important && act.sponsor.kind !== 'player') events.push({ type: 'voto-locale', actId: act.id, title: act.title, label: act.label, budget: act.budget, line: forecast.positions.find(item => item.groupId === inst.playerGroupId)?.line ?? 'astenuto', yes: forecast.yes, against: forecast.against, needed: forecast.needed, date: act.nextStepAt });
  }
  // Groups and executive: cohesion drifts, the opposition presses, a group of the majority may walk out.
  inst = { ...inst, groups: inst.groups.map(group => ({ ...group, cohesion: clamp(Math.round(group.cohesion + (rand() - 0.5) * 4 + (68 - group.cohesion) * 0.04), 0, 100) })), pressure: clamp(Math.round(inst.pressure + (rand() - 0.45) * 3 + (inst.executive ? (50 - inst.executive.stability) * 0.02 : 0)), 0, 100) };
  if (inst.executive) {
    const margin = majorityMargin(inst);
    const stability = clamp(inst.executive.stability + ((55 + clamp(margin, -5, 8) * 1.5 - inst.pressure * 0.15) - inst.executive.stability) * 0.06 + (rand() - 0.5) * 3, 0, 100);
    inst = { ...inst, executive: { ...inst.executive, stability: Math.round(stability) } };
    // A group of the majority unhappy with the executive threatens to leave, then leaves (not the player's own group).
    const shaky = inst.groups.filter(group => group.side === 'maggioranza' && group.id !== inst.executive.groupId && group.id !== inst.playerGroupId && group.cohesion < 45);
    const leaving = shaky.find(() => rand() < 0.04 + (50 - inst.executive.stability) / 400);
    if (leaving) {
      inst = { ...inst, groups: inst.groups.map(group => group.id === leaving.id ? { ...group, side: 'opposizione' } : group), executive: { ...inst.executive, stability: clamp(inst.executive.stability - 12, 0, 100), members: inst.executive.members.map(item => item.groupId === leaving.id ? { ...item, groupId: inst.executive.groupId, label: `Assessore (figura simulata) · ${inst.groups.find(group => group.id === inst.executive.groupId)?.label ?? ''}`.trim() } : item) } };
      inst = record(inst, date, `${leaving.label} esce dalla maggioranza.`, 'crisi');
      lines.push(`${rules.label}: ${leaving.label} esce dalla maggioranza.`);
      events.push({ type: 'uscita-maggioranza', group: leaving.label, margin: majorityMargin(inst) });
    } else if (inst.executive.leader === 'player' && shaky.length && !inst.threatFrom && rand() < 0.08) {
      inst = { ...inst, threatFrom: shaky[0].id };
      events.push({ type: 'minaccia-gruppo', groupId: shaky[0].id, group: shaky[0].label });
    }
    // Without a majority the opposition files a motion of no confidence; if it passes, the council is dissolved.
    if (majorityMargin(inst) < 0 && rules.dissolves && !inst.acts.some(item => item.kind === 'sfiducia' && !CLOSED.includes(item.stage))) {
      const opposing = opposition[0] ?? inst.groups.find(group => group.side !== 'maggioranza');
      inst = { ...inst, acts: [...inst.acts, newAct(inst, { kind: 'sfiducia', sponsor: { kind: 'opposition', groupId: opposing?.id ?? null, label: opposing?.label ?? 'Opposizione', axis: opposing?.axis ?? 0 }, area: inst.kind === 'regione' ? 'autonomie' : 'pa', title: `Mozione di sfiducia: ${rules.leader.toLowerCase()}`, date, category: 'sfiducia' })] };
      inst = record(inst, date, `L’opposizione presenta una mozione di sfiducia contro ${inst.executive.label}.`, 'sfiducia');
      events.push({ type: 'sfiducia-presentata' });
    }
    const confidence = inst.acts.find(item => item.kind === 'sfiducia' && item.stage === 'approvato' && !item.handled);
    if (confidence) {
      inst = { ...inst, status: 'sciolto', dissolvedAt: date, acts: inst.acts.map(item => item.id === confidence.id ? { ...item, handled: true } : item) };
      inst = record(inst, date, `Sfiducia approvata: ${rules.label.toLowerCase()} sciolto, arriva un commissario; si torna al voto.`, 'scioglimento');
      events.push({ type: 'scioglimento', kind: inst.kind });
    }
  }
  // Closed acts leave the list after a while (the last ones stay for the record).
  const closed = inst.acts.filter(item => CLOSED.includes(item.stage));
  if (closed.length > 12) {
    const old = new Set(closed.slice(0, closed.length - 12).map(item => item.id));
    inst = { ...inst, acts: inst.acts.filter(item => !old.has(item.id)), archive: [...inst.archive, ...inst.acts.filter(item => old.has(item.id)).map(item => ({ id: item.id, title: item.title, stage: item.stage, closedAt: item.closedAt, category: categoryOf(inst, item), ...(item.votes?.length ? { vote: compactVote(item.votes.at(-1)) } : {}), ...(item.answer ? { answer: item.answer } : {}), ...(item.withdrawn ? { withdrawn: item.withdrawn } : {}) }))].slice(-40) };
  }
  return { inst, events, lines };
}
