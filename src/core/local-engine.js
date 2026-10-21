// The institutions where a local or European career is played: the consiglio comunale with its giunta and mayor, the
// consiglio regionale with its giunta and president, the European Parliament with its political groups. Each has
// groups of majority and opposition, an executive that proposes acts (deliberations, regional laws, the budget; the
// European Commission's dossiers), an opposition that attacks and files motions, groups that defect, a budget with its
// deadline, votes with individual dissent, and a player who proposes, votes, negotiates or governs. A council that loses
// its majority is dissolved and votes early. Everything is simulation; the European groups start from their real size
// at the constitutive session of 2024 (europarl), then evolve in the game.
import { uniqueId } from './ids.js?v=20261021-7';
import { DATA_SOURCES } from '../data/schema.js?v=20261021-7';
import { AREA_BY_ID, CAMP_PRIORITIES, INTENSITY } from '../data/simulation/policy-rules.js?v=20261021-7';
import { regionShareOf } from './territory-share.js?v=20261021-7';
import { ACT_TYPES, AREA_BREADTH, AREA_LEANS, CITY_INDICATORS, CITY_SHARE_OF_REGION, PROVINCE_SHARE_OF_REGION, actTitle, actTypeOf, legalNumber, naturalType, neededYes, regionalWeights, proposableTypes, serviceIndicatorOf, serviceIndicatorsOf, typeFitsArea } from '../data/simulation/local-acts.js?v=20261021-7';
import { activeWorks, advanceWorks, applyWorkActivity, availableWorkTypes, cofinRequest, emptyWorksRecord, executiveWorkChoice, planWork, startWork, workGap, worksOf } from './local-works-engine.js?v=20261021-7';
import { WORK_RULES } from '../data/simulation/local-works.js?v=20261021-7';
import { DELEGA_RULES, PORTFOLIO_AREAS } from '../data/simulation/office-rules.js?v=20261021-7';
import { cohesiveShare } from './parliament-engine.js?v=20261021-7';
import { groupLine, seededRandom, splitGroupVote } from './vote-engine.js?v=20261021-7';
import { advanceDays } from './time.js?v=20261021-7';
import { INCUMBENCY_RULES } from '../data/simulation/campaign-rules.js?v=20261021-7';

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
  // The provincia (ente di area vasta): the President and the council are chosen by the mayors and the municipal councillors
  // of the province, the executive is the President with the consiglieri delegati (the assessori of the game).
  provincia: {
    label: 'Consiglio provinciale', executive: 'Presidenza e consiglieri delegati', leader: 'Presidente della Provincia', leaderTitle: 'Presidente della Provincia', member: 'Consigliere provinciale',
    portfolios: ['Viabilità e trasporti', 'Edilizia scolastica', 'Ambiente e rifiuti', 'Pianificazione del territorio', 'Sviluppo economico', 'Servizi ai comuni'],
    acts: { executive: 'Decreto del Presidente', majority: 'Mozione della maggioranza', opposition: 'Mozione dell’opposizione', budget: 'Bilancio provinciale', player: 'Tua proposta di deliberazione provinciale' },
    rates: { executive: 0.28, majority: 0.07, opposition: 0.11 }, dissolves: true, secondLevel: true
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
    // A comune and a provincia keep the services of their own territory (the province's are its own, not the region's average): where they stood when the term began is the starting point of its record.
    ...(['comune', 'provincia'].includes(spec.kind) ? (indicators => ({ indicators, baseline: { services: servicesOf(indicators) } }))(serviceIndicators(spec)) : {}),
    ...(spec.kind === 'regione' && spec.territory ? { baseline: { services: servicesOf(spec.territory) } } : {}), ...(spec.kind === 'europa' ? {} : { effects: [], commitments: [], works: [], worksArchive: [], cofin: [], worksRecord: emptyWorksRecord(), place: spec.place ?? { region: spec.region ?? null } }),
    acts: [], archive: [], history: [{ date: spec.date, text: `${rules.label}: inizia il mandato (${spec.role === 'sindaco' || spec.role === 'presidente' ? 'guidi l’esecutivo' : spec.side === 'maggioranza' ? 'in maggioranza' : 'all’opposizione'}).` }],
    pressure: 30, ...(spec.kind === 'europa' ? { ep: europeanSeat(`${spec.kind}-${spec.date}`, spec.date, spec.committee) } : {}), source: SIM
  };
}
// The city's services at the start of the term: close to the region's (territory, when known), each city a little
// different.
function serviceIndicators({ name, territory = null, kind = 'comune' }) {
  const rand = seededRandom(`${name}|servizi`);
  return Object.fromEntries((serviceIndicatorsOf(kind) ?? CITY_INDICATORS).map(item => [item.id, round1(clamp((territory?.[item.region] ?? 50) + (rand() - 0.5) * 12, 20, 80))]));
}
// Saves made before the acts had effects, the works or the province's own services: the institution gets what it lacks, without touching what it has
// (a province's services start from the region's, with the starting point of its record on them; the territory comes from the store).
export function withLocalState(inst, territory = null) {
  if (!inst || inst.kind === 'europa') return inst;
  const lacksServices = ['comune', 'provincia'].includes(inst.kind) && !inst.indicators;
  if (inst.effects && inst.commitments && inst.works && inst.worksRecord && inst.worksArchive && inst.cofin && inst.place && !lacksServices) return inst;
  const indicators = lacksServices ? serviceIndicators({ name: inst.name, territory, kind: inst.kind }) : null;
  return {
    ...inst, ...(indicators ? { indicators, baseline: { ...(inst.baseline ?? {}), ...(inst.kind === 'provincia' || inst.baseline?.services == null ? { services: servicesOf(indicators) } : {}) } } : {}),
    effects: inst.effects ?? [], commitments: inst.commitments ?? [], works: inst.works ?? [], worksArchive: inst.worksArchive ?? [], cofin: inst.cofin ?? [], worksRecord: inst.worksRecord ?? emptyWorksRecord(), place: inst.place ?? { region: inst.region ?? null }
  };
}
const servicesOf = indicators => { const values = Object.values(indicators ?? {}).map(Number).filter(Number.isFinite); return values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null; };
// What a term leaves behind for the next vote: how the executive stood, what the council kept and broke, how the services of the
// city moved and how the term ended. `score` judges the administration (-100…100); `standing` is what it means for the player: who led it
// answers for it, who sat in its majority shares it, the opposition profits from its failures, whoever left office keeps half of it.
export function mandateRecord(input, { date = null, former = false } = {}) {
  const inst = withLocalState(input);
  if (!inst || inst.kind === 'europa') return null;
  const rules = INCUMBENCY_RULES;
  const leads = inst.executive?.leader === 'player';
  const weeks = weeksBetween(inst.since, date ?? inst.until ?? inst.since);
  const commitments = inst.commitments ?? [];
  const kept = commitments.filter(item => item.status === 'rispettato').length;
  const broken = commitments.filter(item => item.status === 'disatteso').length;
  // The services of a comune and of a province are their own; those of a region are the ones of the territory, as the weekly step last measured them.
  const services = ['comune', 'provincia'].includes(inst.kind) ? servicesOf(inst.indicators) : Number.isFinite(inst.territoryServices) ? inst.territoryServices : null;
  const servicesDelta = services !== null && inst.baseline?.services != null ? round1(services - inst.baseline.services) : 0;
  const passed = (inst.acts ?? []).filter(item => item.stage === 'approvato' && item.sponsor?.kind === 'player').length;
  const stability = Number(inst.executive?.stability ?? 60), pressure = Number(inst.pressure ?? 30), margin = Number(inst.budget?.margin ?? 50), failures = Number(inst.budget?.failures ?? 0);
  // The works: what the term built is already in the services (servicesDelta), so only the way it was done counts here: the works on time and on budget,
  // the waste (delay, overrun, suspended sites) and the upkeep left undone.
  const works = worksRecordOf(inst);
  let score = (stability - 60) * 0.6 + (50 - pressure) * 0.4 + (margin - 50) * 0.2 - failures * 6 + kept * 4 - broken * 7 + servicesDelta * 1.2 + passed * 1.5 + works.score;
  if (inst.status === 'sciolto') score += rules.dissolved;
  score = round1(clamp(score, -100, 100));
  const confidence = clamp(weeks / 78, 0.3, 1);
  const side = leads ? 'maggioranza' : inst.playerSide ?? 'maggioranza';
  const factor = (leads ? rules.standing.leader : side === 'maggioranza' ? rules.standing.majority : rules.standing.opposition) * (former ? rules.standing.former : 1);
  return { kind: inst.kind, name: inst.name, role: inst.playerRole ?? null, side, leads, former, status: inst.status, weeks: weeks === 99 ? 0 : weeks, stability, pressure, margin, failures, kept, broken, servicesDelta, passed, works, score, confidence: round2(confidence), standing: round1(clamp(score * confidence * factor, -100, 100)), source: SIM };
}
// What the works of the term say about the administration: started and finished, quality, cost against the plan, delays, suspended sites, upkeep. `score` is the share of the
// verdict that is not already in the services.
export function worksRecordOf(inst) {
  const record = inst?.worksRecord ?? {};
  const open = activeWorks(inst);
  const completed = record.completed ?? 0;
  const over = (record.completedBudget ?? 0) > 0 ? Math.max(0, (record.finalCost ?? 0) / record.completedBudget - 1) : 0;
  const quality = completed ? round2((record.qualitySum ?? 0) / completed) : null;
  const waste = Math.min(8, (record.delayWeeks ?? 0) / 10) + Math.min(8, over * 12) + (record.suspended ?? 0) * 1.5 + (record.upkeepMissed ?? 0) * 0.8;
  const score = round1(clamp((record.onTime ?? 0) * 1.2 - waste, -14, 8));
  return { started: record.started ?? 0, completed, open: open.length, suspended: record.suspended ?? 0, onTime: record.onTime ?? 0, quality, delayWeeks: record.delayWeeks ?? 0, overruns: record.overruns ?? 0, budgeted: round1(record.budgeted ?? 0), completedBudget: round1(record.completedBudget ?? 0), finalCost: round1(record.finalCost ?? 0), upkeepMissed: record.upkeepMissed ?? 0, protests: record.protests ?? 0, archived: record.archived ?? 0, cofinReceived: round2(record.cofinReceived ?? 0), cofinPaid: round2(record.cofinPaid ?? 0), score };
}
const record = (inst, date, text, type = 'evento') => ({ ...inst, history: [...inst.history, { date, text, type }].slice(-40) });
const setAct = (inst, id, patch) => ({ ...inst, acts: inst.acts.map(item => item.id === id ? { ...item, ...patch } : item) });
const governing = inst => new Set(inst.groups.filter(group => group.side === 'maggioranza').map(group => group.id));
export const majorityMargin = inst => inst.groups.filter(group => group.side === 'maggioranza').reduce((sum, group) => sum + group.seats, 0) - (Math.floor(inst.seats / 2) + 1);

// What a decision of the career does to the institution: the stability of the executive, the pressure of the opposition
// and the street, the margin of the budget (the career engine names them in `effects.local`).
export function applyLocalEffect(inst, local = {}) {
  if (!inst || inst.status !== 'active') return inst;
  let next = { ...inst };
  if (local.stability && inst.executive) next.executive = { ...inst.executive, stability: clamp(round1((inst.executive.stability ?? 60) + local.stability), 0, 100) };
  if (local.pressure) next.pressure = clamp(round1((inst.pressure ?? 30) + local.pressure), 0, 100);
  if (local.margin && inst.budget) next.budget = { ...inst.budget, margin: clamp(round1((inst.budget.margin ?? 50) + local.margin), 0, 100) };
  // The activities of the works (a site visit, a technical meeting, an inspection) and the care of a service act on the real state of the institution.
  if (local.workBoost || local.workUnblock || local.scrutiny) next = applyWorkActivity(next, local);
  if (local.service && next.indicators) {
    const own = next.playerDelega?.areas ?? [];
    const list = serviceIndicatorsOf(next.kind) ?? [];
    const candidates = next.executive?.leader === 'player' ? list : list.filter(item => item.areas.some(area => own.includes(area)));
    const weakest = [...candidates].sort((a, b) => (next.indicators[a.id] ?? 50) - (next.indicators[b.id] ?? 50))[0];
    if (weakest) next.indicators = { ...next.indicators, [weakest.id]: round1(clamp((next.indicators[weakest.id] ?? 50) + local.service, 0, 100)) };
  }
  return next;
}

// ---------- acts ----------
// The kind of an act (see ACT_TYPES); acts saved before the kinds existed get the closest one.
export function categoryOf(inst, act) {
  if (act?.category) return act.category;
  if (inst.kind === 'europa') return { majority: 'ue-risoluzione', opposition: 'ue-emendamento', player: 'ue-relazione' }[act?.kind] ?? 'ue-proposta';
  if (act?.kind === 'sfiducia') return 'sfiducia';
  if (act?.budget || act?.kind === 'budget') return 'bilancio';
  if (act?.kind === 'majority' || act?.kind === 'opposition') return 'mozione';
  if (inst.kind === 'regione') return 'legge';
  if (inst.kind === 'provincia') return act?.sponsor?.kind === 'executive' ? 'decreto-presidente' : 'mozione';
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
export function measureOf(inst, { category, area, variant = null, intensity = 2, workPlan = null, cofin = null }) {
  const type = actTypeOf(inst.kind, category);
  if (!type || inst.kind === 'europa' || ['mozione', 'interrogazione', 'sfiducia', 'bilancio'].includes(category)) return null;
  // A co-financing agreement spends nothing when the act passes: the quota leaves the margin once, when the settlement pays it (local-works-engine).
  if (category === 'cofinanziamento') return cofin ? { indicators: {}, cost: cofin.partnerPts, revenue: 0, tax: null, phase: 1, lasting: false, segments: {}, intensity: 2, cofin: true } : null;
  // A public work brings nothing when the act is approved: it reserves a share of its cost, and the benefits come with the finished work (local-works-engine).
  if (category === 'opere') {
    let plan = workPlan;
    if (!plan) { try { plan = planWork(inst, { area }); } catch { return null; } }
    return { indicators: {}, cost: plan.commit, revenue: 0, tax: null, phase: plan.weeks, lasting: true, segments: {}, intensity: 2, work: true };
  }
  const level = INTENSITY[clamp(Math.round(intensity), 1, 3) - 1];
  const effect = type.effect * level.effect;
  const down = variant === 'riduzione';
  const indicators = {};
  const put = (id, value) => { if (id && Math.abs(value) >= 0.05) indicators[id] = round1((indicators[id] ?? 0) + value); };
  if (inst.kind === 'comune' || inst.kind === 'provincia') {
    if (category === 'urbanistica') { put('territorio', effect); put('ambiente', variant === 'espansione' ? -effect * 0.5 : effect * 0.35); }
    else if (category === 'statuto') put(inst.kind === 'comune' ? 'uffici' : 'comuni', effect);
    else if (category === 'tariffe') put(serviceIndicatorOf(inst.kind, area).id, down ? -effect : effect);
    else if (category !== 'tributi') put(serviceIndicatorOf(inst.kind, area).id, effect);
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
  else if (category === 'tariffe') for (const id of serviceIndicatorOf('comune', area).segments) seg(id, down ? 1 : -1);
  else {
    for (const id of AREA_BY_ID[area]?.pleased ?? []) seg(id, 0.8 * level.effect);
    for (const id of AREA_BY_ID[area]?.displeased ?? []) seg(id, -0.4 * level.effect);
    if (category === 'urbanistica' && variant === 'espansione') seg('giovani', -0.6);
  }
  return { indicators, cost, revenue: round1(revenue), tax: category === 'tributi' ? (down ? 'giu' : 'su') : null, phase: type.phase, lasting: type.lasting, segments, intensity: level.level };
}
// A new act: its kind decides who adopts it (council, Giunta, or the executive's answer), the first step of its iter
// and the majority it needs; its text has a place between left and right and, when approved, a measure.
function newAct(inst, { kind, sponsor, area, title, date, budget = false, category = null, variant = null, intensity = 2, work = null, cofin = null }) {
  const rules = INSTITUTIONS[inst.kind];
  const cat = category ?? categoryOf(inst, { kind, sponsor, budget });
  const type = actTypeOf(inst.kind, cat);
  const organ = type?.organ ?? 'consiglio';
  const first = organ === 'esecutivo' ? 'risposta' : organ === 'giunta' && !type?.committeeOpinion ? 'giunta' : ['mozione', 'sfiducia'].includes(cat) ? 'aula' : 'commissione';
  const weeks = budget ? 2 : first === 'risposta' ? 2 + (inst.acts.length % 3) : first === 'giunta' ? 1 : cat === 'sfiducia' ? (inst.kind === 'comune' ? 2 : 1) : cat === 'mozione' ? 2 : type?.committeeOpinion ? 2 : 1 + (inst.acts.length % 3);
  // A work: the act approves a plan (the type of work, its funding, where it stands); the executive of the institution brings its own.
  const workPlan = cat === 'opere' && inst.kind !== 'europa' ? planWork(inst, { typeId: work?.typeId ?? null, area, funding: work?.funding ?? null, site: work?.site ?? 'periferia' }) : null;
  return {
    id: uniqueId([...inst.acts, ...inst.archive], `${inst.id}-atto-${inst.acts.length + inst.archive.length + 1}`), kind, category: cat, ...(variant ? { variant } : {}), title: workPlan ? `Opere pubbliche: ${workPlan.label}` : title, area: workPlan?.area ?? area, sponsor, budget, ...(workPlan ? { workPlan } : {}), ...(cofin ? { cofin } : {}),
    stage: first, introducedAt: date, nextStepAt: advanceDays(date, weeks * 7), votes: [], pendingPlayerVote: null,
    label: (inst.kind === 'europa' ? rules.acts[kind] : null) ?? type?.label ?? rules.acts[kind], organ, quorum: type?.quorum ?? 'votanti',
    stance: stanceOf(inst, cat, area, sponsor, variant), measure: measureOf(inst, { category: cat, area: workPlan?.area ?? area, variant, intensity, workPlan, cofin }),
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
  regione: ['sanita', 'trasporti', 'agricoltura', 'ambiente', 'lavoro', 'industria', 'scuola', 'turismo', 'welfare', 'infrastrutture', 'casa', 'cultura', 'energia', 'autonomie'],
  provincia: ['infrastrutture', 'scuola', 'trasporti', 'ambiente', 'casa', 'autonomie', 'pa', 'turismo', 'industria', 'cultura']
});
const within = (kind, pool) => { const allowed = COMPETENCES[kind]; if (!allowed) return pool; const own = pool.filter(area => allowed.includes(area)); return own.length ? own : allowed; };
const EU_AREAS = ['europa', 'ambiente', 'agricoltura', 'digitale', 'immigrazione', 'energia', 'industria', 'commercio', 'difesa', 'esteri', 'lavoro'];
// The themes the player can bring to the institution (its competences).
export const localAreas = kind => kind === 'europa' ? EU_AREAS : COMPETENCES[kind] ?? [];
export const isClosedAct = act => CLOSED.includes(act.stage);
// The themes where the city's services are weakest: the executive and the opposition look at them first.
export function weakCityAreas(inst, count = 2) {
  if (!inst.indicators) return [];
  const own = COMPETENCES[inst.kind] ?? COMPETENCES.comune;
  return (serviceIndicatorsOf(inst.kind) ?? CITY_INDICATORS).filter(item => item.areas.some(area => own.includes(area))).sort((a, b) => (inst.indicators[a.id] ?? 50) - (inst.indicators[b.id] ?? 50)).slice(0, count).map(item => item.areas.find(area => own.includes(area)));
}
// How the territory is doing on a theme: the city's service for a comune, the region's indicators weighed for the theme
// (territory: those of the society simulation) for a regione.
export function territoryValue(inst, area, territory = null) {
  if (inst.kind === 'comune' || inst.kind === 'provincia') return inst.indicators?.[serviceIndicatorOf(inst.kind, area).id] ?? null;
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
// A group leader brings the own group where the own vote goes: how much the group's leaning moves toward the choice of the
// player (up for a yes, down for a no), and what it costs the group when the choice goes against its line.
const GROUP_PULL = 0.14;
const pullOf = (inst, group, choice) => inst.playerGroupLead && group.id === inst.playerGroupId && BALLOT[choice] ? GROUP_PULL * ({ favorevole: 1, contrario: -1 }[choice] ?? 0) : 0;
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
    const split = splitGroupVote({ seats: members, yes: Math.round(members * cohesiveShare(clamp(value + (own ? pullOf(inst, group, pending) : 0), 0.02, 0.98))), seed: `${act.id}|${group.id}` });
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
    const mood = clamp(value + (own ? pullOf(inst, group, decided) : 0) + (rand() - 0.5) * (0.12 + (100 - group.cohesion) / 250), 0.02, 0.98);
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
export function proposeLocalAct(inst, area, date, { category = null, variant = null, intensity = 2, work = null } = {}) {
  if (!AREA_BY_ID[area]) throw new Error('Scegli un tema.');
  inst = withLocalState(inst);
  const actor = actorOf(inst);
  const leads = actor === 'leader';
  const delegated = actor === 'assessore' || actor === 'delegato';
  // Several acts can be followed together; how many depends on the office (see ACT_CAPACITY) and nothing else: a transparent limit of capacity, not a technical lock.
  const capacity = actCapacity(inst);
  if (capacity.free <= 0) throw new Error(`Stai già seguendo ${capacity.open} atti (${capacity.rule}): ${capacity.max === 1 ? 'aspetta il voto' : `ne puoi seguire al massimo ${capacity.max} insieme. Aspetta un voto o ritira un atto`}.`);
  // An assessore (or a consigliere delegato) proposes only on the theme of the own delega, and never on the budget, the taxes or the statute.
  if (delegated && !(inst.playerDelega?.areas ?? []).includes(area)) throw new Error(`La tua delega (${inst.playerDelega?.portfolio}) riguarda ${(inst.playerDelega?.areas ?? []).map(id => AREA_BY_ID[id]?.label.toLowerCase() ?? id).join(', ')}: gli altri temi li governa la giunta.`);
  let type = inst.kind === 'europa' ? actTypeOf('europa', 'ue-relazione') : category ? actTypeOf(inst.kind, category) : naturalType(inst.kind, area, leads || delegated);
  if (delegated && !category && (!type || DELEGA_FORBIDDEN.has(type.id))) type = proposableTypes(inst.kind, true).find(item => !DELEGA_FORBIDDEN.has(item.id) && typeFitsArea(item, area)) ?? null;
  if (delegated && type && DELEGA_FORBIDDEN.has(type.id)) throw new Error('Bilancio, tributi e statuto non sono atti di una delega: li propone chi guida l’esecutivo.');
  if (!type || (inst.kind !== 'europa' && !type.player.includes(leads || delegated ? 'leader' : 'consigliere'))) throw new Error(leads || delegated ? 'Questo atto non lo propone chi ha una delega o guida l’esecutivo.' : 'Questo atto lo propone solo chi guida l’esecutivo o ha una delega.');
  if (type.id === 'tributi' && inst.acts.some(item => item.category === 'tributi' && !CLOSED.includes(item.stage))) throw new Error('C’è già una proposta sulle aliquote in discussione.');
  // The same kind of act on the same theme is not presented twice while the first is still open.
  if (inst.acts.some(item => isOwnOpenAct(item) && item.category === type.id && item.area === (type.areas && !type.areas.includes(area) ? type.areas[0] : area) && type.id !== 'opere')) throw new Error('Hai già un atto di questo tipo su questo tema in discussione: presenta un altro tema o aspetta il voto.');
  // A public work: its plan decides the theme; the institution can only propose what its level builds, with the money and the sites it has.
  const plan = type.id === 'opere' && inst.kind !== 'europa' ? planWork(inst, { typeId: work?.typeId ?? null, area, funding: work?.funding ?? null, site: work?.site ?? 'periferia' }) : null;
  if (plan) {
    if (delegated && !(inst.playerDelega?.areas ?? []).includes(plan.area)) throw new Error(`La tua delega (${inst.playerDelega?.portfolio}) non comprende quest’opera: la governa la giunta.`);
  }
  const theme = plan ? plan.area : typeFitsArea(type, area) ? area : type.areas[0];
  const choice = type.variants ? (type.variants.includes(variant) ? variant : type.variants[0]) : null;
  const title = inst.kind === 'europa' ? `${INSTITUTIONS.europa.acts.player}: ${AREA_BY_ID[area].label.toLowerCase()}` : actTitle(inst.kind, type.id, theme, { variant: choice });
  const cap = actor === 'delegato' ? DELEGA_RULES.intensityCap : 3;
  const act = newAct(inst, { kind: 'player', sponsor: { kind: leads || delegated ? 'executive' : 'player', groupId: inst.playerGroupId, label: delegated ? `Tu, ${inst.playerDelega.portfolio.toLowerCase()}` : 'Tu', axis: inst.groups.find(group => group.id === inst.playerGroupId)?.axis ?? 0 }, area: theme, title, date, category: type.id, variant: choice, intensity: leads ? intensity : Math.min(intensity, cap), work: plan ? { typeId: plan.typeId, funding: plan.funding, site: plan.site } : null });
  return record({ ...inst, acts: [...inst.acts, { ...act, ...(delegated ? { byDelega: true } : {}), pendingPlayerVote: 'favorevole' }] }, date, delegated ? `Presenti alla giunta “${title}” (delega ${inst.playerDelega.portfolio}).` : `Presenti “${title}”.`, 'proposta');
}
// The head of the executive that builds asks another institution of the career to co-finance a work: the agreement is recorded on the work and the partner gets an act
// (category `cofinanziamento`) for its competent organ (the Giunta). The player proposes it when he leads the partner too; otherwise the partner's executive brings it.
export function proposeCofinance(ownerIn, workId, partnerIn, share, date) {
  const owner = withLocalState(ownerIn);
  const partner = withLocalState(partnerIn);
  const request = cofinRequest(owner, workId, partner, share, date);
  const leads = partner.executive?.leader === 'player';
  const group = partner.groups.find(item => item.id === (leads ? partner.playerGroupId : partner.executive?.groupId));
  const cofin = { id: request.entry.id, ownerId: owner.id, ownerName: owner.name, ownerKind: owner.kind, workId, workTitle: request.work.title, share: request.entry.share, euro: request.entry.euro, partnerPts: request.entry.partnerPts };
  const act = newAct(partner, { kind: leads ? 'player' : 'executive', sponsor: { kind: 'executive', groupId: group?.id ?? null, label: leads ? 'Tu' : INSTITUTIONS[partner.kind].executive, axis: group?.axis ?? 0 }, area: request.work.area, title: `Cofinanziamento di «${request.work.title}» (${owner.name}): ${Math.round(request.entry.share * 100)}% del costo`, date, category: 'cofinanziamento', cofin });
  const sent = { ...act, ...(leads ? { pendingPlayerVote: 'favorevole' } : {}) };
  const ledger = { id: request.entry.id, ownerId: owner.id, ownerName: owner.name, ownerKind: owner.kind, workId, workTitle: request.work.title, share: request.entry.share, euro: request.entry.euro, ownerPts: request.entry.ownerPts, partnerPts: request.entry.partnerPts, terms: request.entry.terms, status: 'richiesto', requestedAt: date, actId: act.id, source: SIM };
  const partnerOut = record({ ...partner, acts: [...partner.acts, sent], cofin: [...(partner.cofin ?? []), ledger] }, date, `${owner.name} chiede un cofinanziamento per «${request.work.title}»: ${Math.round(request.entry.share * 100)}% del costo, ${request.entry.partnerPts} punti del tuo margine.`, 'cofinanziamento');
  const ownerOut = { ...request.inst, works: worksOf(request.inst).map(work => work.id === workId ? { ...work, cofin: work.cofin.map(row => row.id === request.entry.id ? { ...row, actId: act.id } : row) } : work) };
  return { owner: record(ownerOut, date, `Chiedi a ${partner.name} di cofinanziare «${request.work.title}»: ${Math.round(request.entry.share * 100)}% del costo.`, 'cofinanziamento'), partner: partnerOut, act, entry: request.entry };
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
  const actor = actorOf(inst);
  if (actor === 'leader' || actor === 'assessore') throw new Error(actor === 'leader' ? 'Chi guida l’esecutivo non interroga se stesso.' : 'Un assessore non interroga la giunta di cui fa parte.');
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
  if (inst.kind === 'provincia') throw new Error('La Provincia non ha tributi propri di peso: le aliquote le decidono i Comuni e la Regione.');
  if (inst.executive?.leader !== 'player' || !inst.budget) throw new Error('Solo chi guida l’esecutivo decide le aliquote.');
  if (!['bassa', 'media', 'alta'].includes(level)) throw new Error('Livello non valido.');
  const margin = clamp(inst.budget.margin + ({ bassa: -12, media: 0, alta: 12 }[level] - { bassa: -12, media: 0, alta: 12 }[inst.budget.localTax]), 0, 100);
  return record({ ...inst, budget: { ...inst.budget, localTax: level, margin } }, date, `Nuove aliquote locali: pressione fiscale ${level}.`, 'bilancio');
}

// ---------- the delega: an assessore (or a consigliere delegato) answers for one service of the executive ----------
// Who the player is in the institution: the head of the executive, an assessore (a portfolio of the giunta), a consigliere
// with a delega, or a councillor. The powers of the office follow from it (see office-rules).
// How many acts of his own the player can follow at the same time: a consigliere two, whoever has a delega three, whoever leads the executive four, a member of the European Parliament two.
// The questions to the executive do not count (they are answered, not voted). The limit is the capacity of the office, shown to the player; funds are checked act by act.
export const ACT_CAPACITY = Object.freeze({ consigliere: 2, delegato: 3, assessore: 3, leader: 4, europa: 2 });
const isOwnOpenAct = item => (item.kind === 'player' || item.sponsor?.kind === 'player' || item.byDelega) && item.category !== 'interrogazione' && !CLOSED.includes(item.stage);
export function actCapacity(inst) {
  const actor = actorOf(inst);
  const key = inst?.kind === 'europa' ? 'europa' : ACT_CAPACITY[actor] ? actor : 'consigliere';
  const max = ACT_CAPACITY[key];
  const open = (inst?.acts ?? []).filter(isOwnOpenAct).length;
  const rule = { consigliere: 'un consigliere ne segue due', delegato: 'chi ha una delega ne segue tre', assessore: 'chi ha una delega ne segue tre', leader: 'chi guida l’esecutivo ne segue quattro', europa: 'un eurodeputato ne segue due' }[key];
  return { max, open, free: Math.max(0, max - open), rule };
}
// The player takes back an act of his own that has not been decided yet: it closes as withdrawn and frees a place (the day spent to present it is not given back).
export function withdrawLocalAct(inst, actId, date) {
  const act = inst.acts.find(item => item.id === actId);
  if (!act || !isOwnOpenAct(act)) throw new Error('Puoi ritirare solo un atto tuo ancora in discussione.');
  return record(setAct(inst, actId, { stage: 'ritirato', closedAt: date, pendingPlayerVote: null, withdrawn: 'ritirato da te' }), date, `Ritiri “${act.title}”.`, 'ritirato');
}
export const actorOf = inst => inst?.executive?.leader === 'player' ? 'leader' : inst?.playerDelega && inst.playerRole === 'assessore' ? 'assessore' : inst?.playerDelega && inst.playerRole === 'delegato' ? 'delegato' : 'consigliere';
export const DELEGA_FORBIDDEN = new Set(['tributi', 'bilancio', 'variazione', 'statuto', 'sfiducia']);
export const delegaAreasOf = (kind, portfolio) => PORTFOLIO_AREAS[kind]?.[portfolio] ?? [];
// How the service of the delega is doing (0-100): the city's or the region's indicators on its themes (the budget's margin for the Bilancio).
export function delegaScore(inst, territory = null) {
  const delega = inst?.playerDelega;
  if (!delega) return null;
  if (delega.portfolio === 'Bilancio' && inst.budget) return round1(inst.budget.margin);
  const values = (delega.areas ?? []).map(area => territoryValue(inst, area, territory)).filter(Number.isFinite);
  return values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}
// The executive gives the player a delega: a seat in the giunta (assessore) or a delegation without it (consigliere delegato; in
// a province the consiglieri delegati are the assessori). Left to the executive, it is the service doing worst that is entrusted.
export function grantDelega(inst, { kind = 'assessore', portfolio = null, date, territory = null } = {}) {
  if (!inst || inst.status !== 'active' || !inst.executive) throw new Error('Nessuna giunta in cui ricevere una delega.');
  if (inst.executive.leader === 'player') throw new Error('Chi guida l’esecutivo non ha una delega: le governa tutte.');
  if (inst.playerDelega) throw new Error('Hai già una delega.');
  const rules = INSTITUTIONS[inst.kind];
  const role = inst.kind === 'provincia' || kind !== 'delegato' ? 'assessore' : 'delegato';
  const score = name => delegaScore({ ...inst, playerDelega: { portfolio: name, areas: delegaAreasOf(inst.kind, name) } }, territory) ?? 50;
  const ranked = rules.portfolios.map((name, index) => ({ name, index, value: score(name) })).sort((a, b) => a.value - b.value || a.index - b.index);
  const chosen = portfolio && rules.portfolios.includes(portfolio) ? portfolio : ranked[0]?.name ?? rules.portfolios[0];
  const areas = delegaAreasOf(inst.kind, chosen);
  const baseline = score(chosen);
  const members = inst.executive.members.map(member => role === 'assessore' && member.portfolio === chosen ? { ...member, holder: 'player', groupId: inst.playerGroupId ?? member.groupId, label: `Assessore · ${chosen} (tu)` } : member);
  const next = { ...inst, playerRole: role, playerDelega: { kind: role, portfolio: chosen, areas, since: date, baseline, lastScore: baseline, lastReview: date, strikes: 0, reviews: 0 }, executive: { ...inst.executive, members } };
  return record(next, date, role === 'assessore' ? `Sei assessore: ${chosen}.` : `Ricevi la delega su ${chosen} (consigliere delegato).`, 'delega');
}
// The delega goes back to the executive: the portfolio returns to a group of the majority, the player to the benches.
export function revokeDelega(inst, date, reason = 'revoca') {
  const delega = inst?.playerDelega;
  if (!delega) return inst;
  const majority = inst.groups.find(group => group.side === 'maggioranza') ?? inst.groups[0];
  const members = (inst.executive?.members ?? []).map(member => member.holder === 'player' ? { ...member, holder: 'simulato', groupId: majority?.id ?? member.groupId, label: `Assessore (figura simulata) · ${majority?.label ?? 'lista civica'}` } : member);
  return record({ ...inst, playerRole: 'consigliere', playerDelega: null, executive: inst.executive ? { ...inst.executive, members } : inst.executive }, date, `Perdi la delega ${delega.portfolio}: ${reason}.`, 'delega');
}
// Every few weeks the service of the delega is judged: a good one earns reputation, a bad one is yours to answer for, and two
// bad reviews in a row with an executive that wobbles cost the delega.
function reviewDelega(inst, { date, rand, territory }, events) {
  const delega = inst.playerDelega;
  if (!delega || !inst.executive || weeksBetween(delega.lastReview ?? delega.since, date) < DELEGA_RULES.reviewWeeks) return inst;
  const score = delegaScore(inst, territory) ?? delega.lastScore ?? 50;
  const before = delega.lastScore ?? delega.baseline ?? score;
  const delta = round1(score - before);
  const verdict = score >= DELEGA_RULES.goodScore && delta >= DELEGA_RULES.goodDrift ? 'buona' : score <= DELEGA_RULES.badScore || delta <= DELEGA_RULES.badDrift ? 'critica' : 'neutra';
  const strikes = verdict === 'critica' ? (delega.strikes ?? 0) + 1 : verdict === 'buona' ? 0 : delega.strikes ?? 0;
  let next = record({ ...inst, playerDelega: { ...delega, lastReview: date, lastScore: score, strikes, reviews: (delega.reviews ?? 0) + 1 } }, date, `Delega ${delega.portfolio}: valutazione ${verdict} (servizio a ${Math.round(score)}/100, ${delta >= 0 ? '+' : ''}${delta}).`, 'delega');
  events.push({ type: 'delega-valutata', portfolio: delega.portfolio, kind: delega.kind, score, delta, verdict, strikes });
  if (strikes >= DELEGA_RULES.strikesToRevoke && (next.executive.stability < 55 || next.playerSide !== 'maggioranza' || rand() < 0.5)) {
    next = revokeDelega(next, date, 'due valutazioni negative di fila');
    events.push({ type: 'delega-revocata', portfolio: delega.portfolio, kind: delega.kind });
  }
  return next;
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
// ---------- from the vote to the measure ----------
// What the council decides is a vote; what the citizens meet is the measure carried out. An approved act with effects is entrusted to the administration, which starts it after a few weeks
// (more for a heavier measure), carries it out with the strength its budget and its stability allow, and can delay it (provisional budget, no money) or leave it undone. A motion has no
// measure at all: it commits the executive politically (commitments) and moves nothing in the services until the executive adopts an act on its theme.
export const IMPLEMENTATION = Object.freeze({ lagWeeks: [2, 4, 6], regionLagWeeks: 2, postponeWeeks: 4, maxPostponements: 2, ineffective: 0.35, ineffectiveShare: 0.15 });
export const IMPLEMENTATION_LABELS = Object.freeze({ 'in-attuazione': 'In attuazione', 'in-ritardo': 'In ritardo', attuato: 'Attuato', inefficace: 'Attuato ma inefficace', 'non-attuato': 'Non attuato' });
// How well the administration carries a measure out (0–1): the margin of the budget and the stability of the executive; a little variance, always the same for the same act.
function implementationStrength(inst, act) {
  const margin = inst.budget?.margin ?? 50;
  const stability = inst.executive?.stability ?? 60;
  const rand = seededRandom(`${inst.id}|${act.id}|attuazione`);
  return round2(clamp(0.3 + margin / 200 + stability / 250 + (rand() - 0.5) * 0.2, 0.05, 1));
}
function scheduleImplementation(inst, act, measure, date, events) {
  const lag = IMPLEMENTATION.lagWeeks[clamp(Math.round(measure.intensity ?? 2), 1, 3) - 1] + (inst.kind === 'regione' ? IMPLEMENTATION.regionLagWeeks : 0);
  const entry = { id: uniqueId(inst.implementations ?? [], `${act.id}-attuazione`), actId: act.id, title: act.title, area: act.area, category: categoryOf(inst, act), player: act.sponsor?.kind === 'player' || Boolean(act.byDelega), approvedAt: date, startsAt: advanceDays(date, lag * 7), status: 'in-attuazione', postponed: 0, measure: { indicators: measure.indicators, phase: measure.phase, lasting: measure.lasting, segments: measure.segments } };
  events.push({ type: 'attuazione', actId: act.id, title: act.title, status: 'in-attuazione', startsAt: entry.startsAt, player: entry.player });
  return { ...inst, implementations: [...(inst.implementations ?? []), entry].slice(-24) };
}
// A week: the measures whose time has come are carried out, postponed or dropped. The services (and, through the career, the region and the citizens) move here and only here.
function advanceImplementations(input, date, events) {
  let inst = input;
  if (!(inst.implementations ?? []).some(item => ['in-attuazione', 'in-ritardo'].includes(item.status) && item.startsAt <= date)) return inst;
  const out = [];
  for (const item of inst.implementations) {
    if (!['in-attuazione', 'in-ritardo'].includes(item.status) || item.startsAt > date) { out.push(item); continue; }
    const blocked = inst.budget?.provisional || (inst.budget?.margin ?? 50) < 3;
    if (blocked) {
      if (item.postponed >= IMPLEMENTATION.maxPostponements) {
        out.push({ ...item, status: 'non-attuato', closedAt: date, efficacy: 0 });
        inst = record(inst, date, `Misura non attuata: “${item.title}” resta sulla carta, senza fondi.`, 'attuazione');
        events.push({ type: 'attuazione', actId: item.actId, title: item.title, status: 'non-attuato', efficacy: 0, player: item.player });
      } else {
        out.push({ ...item, status: 'in-ritardo', postponed: item.postponed + 1, startsAt: advanceDays(date, IMPLEMENTATION.postponeWeeks * 7) });
        if (item.postponed === 0) events.push({ type: 'attuazione', actId: item.actId, title: item.title, status: 'in-ritardo', efficacy: null, player: item.player });
      }
      continue;
    }
    const strength = implementationStrength(inst, item);
    const status = strength < IMPLEMENTATION.ineffective ? 'inefficace' : 'attuato';
    const scale = status === 'inefficace' ? IMPLEMENTATION.ineffectiveShare : strength;
    const indicators = Object.fromEntries(Object.entries(item.measure.indicators).map(([id, delta]) => [id, round2(delta * scale)]));
    const measure = { ...item.measure, indicators };
    out.push({ ...item, status, closedAt: date, efficacy: strength });
    if (inst.kind === 'comune' || inst.kind === 'provincia') inst = { ...inst, effects: [...(inst.effects ?? []), ...cityEffects({ id: item.actId, title: item.title }, measure)] };
    // the council's record keeps the exceptions; a measure carried out as planned is in the list of measures (implementations), not in the 40 lines of the history
    if (status === 'inefficace') inst = record(inst, date, `Misura attuata ma inefficace: “${item.title}” (efficacia ${Math.round(strength * 100)}%).`, 'attuazione');
    events.push({ type: 'attuazione', actId: item.actId, title: item.title, status, efficacy: strength, player: item.player });
    events.push({ type: 'effetti', actId: item.actId, title: item.title, kind: inst.kind, region: inst.region, indicators: inst.kind === 'regione' ? indicators : serviceShare(inst.kind, indicators, regionShareOf(inst)), phase: measure.phase, lasting: measure.lasting, segments: Object.fromEntries(Object.entries(measure.segments ?? {}).map(([id, delta]) => [id, round1(delta * scale)])) });
  }
  return { ...inst, implementations: out };
}
// What an act of a city or a province brings to its region: a share (the province's is larger), on the region's indicators.
function serviceShare(kind, indicators, share = kind === 'provincia' ? PROVINCE_SHARE_OF_REGION : CITY_SHARE_OF_REGION) {
  const out = {};
  for (const [id, delta] of Object.entries(indicators)) {
    const region = serviceIndicatorsOf(kind)?.find(item => item.id === id)?.region;
    if (region) out[region] = round2((out[region] ?? 0) + delta * share);
  }
  return out;
}
// A week of the city: the effects of the approved acts arrive; without care the services wear out, more in a
// provisional budget (only the mandatory spending goes on).
// The structures that wear fastest without care (roads, buildings, transport): the comune's and the province's.
const HEAVY_WEAR = Object.freeze({ comune: ['opere', 'mobilita', 'sociale', 'territorio'], provincia: ['viabilita', 'scuole', 'trasporti', 'territorio'] });
function cityWeek(inst, rand) {
  const indicators = { ...inst.indicators };
  const effects = [];
  for (const effect of inst.effects ?? []) {
    if (effect.delay > 0) { effects.push({ ...effect, delay: effect.delay - 1 }); continue; }
    indicators[effect.indicator] = round1(clamp((indicators[effect.indicator] ?? 50) + effect.perWeek, 0, 100));
    if (effect.remaining > 1) effects.push({ ...effect, remaining: effect.remaining - 1 });
  }
  for (const item of serviceIndicatorsOf(inst.kind) ?? CITY_INDICATORS) {
    const value = indicators[item.id] ?? 50;
    const wear = (HEAVY_WEAR[inst.kind] ?? []).includes(item.id) ? 0.04 : 0.02;
    indicators[item.id] = round1(clamp(value - wear - (inst.budget?.provisional ? 0.15 : 0) + (50 - value) * 0.004 + (rand() - 0.5) * 0.3, 0, 100));
  }
  return { ...inst, indicators, effects };
}
// What the executive brings on a theme: a kind of act among those that fit it (as often as each is used), a tax change
// when the budget asks for it, an intensity; with a provisional budget only acts without new spending.
function executivePlan(inst, area, rand, { promised = false, date = null } = {}) {
  const margin = inst.budget?.margin ?? 50;
  const tax = inst.budget?.localTax ?? 'media';
  // Only an institution with taxes of its own (a comune, a region) moves them: a province has none.
  const taxType = actTypeOf(inst.kind, 'tributi');
  if (taxType && margin < 18 && tax !== 'alta' && rand() < 0.3) return { type: taxType, area: 'fisco', variant: 'aumento', intensity: 2 };
  if (taxType && margin > 78 && tax !== 'bassa' && rand() < 0.15) return { type: taxType, area: 'fisco', variant: 'riduzione', intensity: 2 };
  // A work only where the level builds something on the theme and the sites and the money allow it (a promise made to the council weighs on the choice).
  const builds = availableWorkTypes(inst, area, date).length > 0 && !workGap(inst, 2);
  const pool = ACT_TYPES[inst.kind].filter(type => type.weight > 0 && type.id !== 'tributi' && typeFitsArea(type, area) && (!inst.budget?.provisional || type.cost <= 0.5) && (type.id !== 'opere' || builds));
  if (!pool.length) return { type: actTypeOf(inst.kind, 'regolamento'), area, variant: null, intensity: 2 };
  if (builds && promised && pool.some(item => item.id === 'opere') && rand() < 0.5) return { type: pool.find(item => item.id === 'opere'), area, variant: null, intensity: 2, work: executiveWorkChoice(inst, area, rand, date) };
  let pick = rand() * pool.reduce((sum, type) => sum + type.weight, 0);
  const type = pool.find(item => (pick -= item.weight) < 0) ?? pool[0];
  if (type.id === 'opere') return { type, area, variant: null, intensity: 2, work: executiveWorkChoice(inst, area, rand, date) };
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
  if (act.workPlan || act.measure?.work) return workGap(inst, cost);
  // A co-financing keeps a minimum reserve in the margin of the institution that pays (it cannot empty its budget for another's work).
  if (act.cofin && cost + WORK_RULES.cofin.reserve > inst.budget.margin) return `manca la copertura finanziaria (servono ${cost} punti di margine più la riserva minima di ${WORK_RULES.cofin.reserve}, ce ne sono ${inst.budget.margin})`;
  if (cost > inst.budget.margin) return `manca la copertura finanziaria (servono ${cost} punti di margine, ce ne sono ${inst.budget.margin})`;
  return null;
}
// An approved act takes effect: the money at once, the services week after week (the city's here, the region's through
// the career), the taxes, the budget of the year, the commitment of a motion, the commitments it keeps.
function applyApproved(inst, act, date, events) {
  let next = inst;
  const measure = act.measure ?? null;
  const category = categoryOf(inst, act);
  // A public work starts instead of paying and improving at once: the share reserved now, the rest and the benefits as the site goes on.
  const isWork = category === 'opere' && next.kind !== 'europa';
  // The money of a work and of a co-financing agreement leaves the margin later and once (the work's reserve and its drawings, the partner's payment), never with the vote.
  const deferred = isWork || category === 'cofinanziamento';
  if (category === 'cofinanziamento' && act.cofin) {
    next = record(next, date, `Via libera al cofinanziamento di «${act.cofin.workTitle}» (${act.cofin.ownerName}): ${act.cofin.partnerPts} punti di margine, versati se la copertura regge.`, 'cofinanziamento');
    events.push({ type: 'cofin-approvato', actId: act.id, title: act.cofin.workTitle, ownerName: act.cofin.ownerName, euro: act.cofin.euro, partnerPts: act.cofin.partnerPts });
  }
  if (isWork) {
    const started = startWork(next, act, { date });
    next = record(started.inst, date, `Via libera all’opera “${started.work.label}”: ${started.work.permitLeft > 0 ? `autorizzazioni (${started.work.permitLeft} settimane), poi progetto, gara e cantiere` : 'progetto, gara e cantiere'}; preventivo ${started.work.cost} punti di margine, ${started.work.committed} già impegnati.`, 'opera');
    events.push({ type: 'opera-avviata', workId: started.work.id, title: started.work.title, label: started.work.label, area: started.work.area, cost: started.work.cost, weeks: started.work.weeks, byPlayer: started.work.byPlayer, sponsor: act.sponsor?.kind ?? null });
  }
  if (next.budget && measure && !deferred) {
    const localTax = measure.tax ? TAX_STEPS[clamp(TAX_STEPS.indexOf(next.budget.localTax) + (measure.tax === 'su' ? 1 : -1), 0, 2)] : next.budget.localTax;
    next = { ...next, budget: { ...next.budget, margin: round1(clamp(next.budget.margin - measure.cost + measure.revenue, 0, 100)), localTax } };
  }
  // The vote is not the measure: an approved act with effects goes to the administration, which carries it out later (and not always well); the services of the territory move only then (advanceImplementations).
  if (measure && Object.keys(measure.indicators).length && !deferred) next = scheduleImplementation(next, act, measure, date, events);
  if (category === 'bilancio' && next.budget) {
    const year = Number(act.title.match(/(\d{4})$/)?.[1] ?? Number(date.slice(0, 4)) + 1);
    next = { ...next, budget: { ...next.budget, approvedYear: year, margin: round1(clamp(next.budget.margin + 24 + TAX_BONUS[next.budget.localTax], 0, 90)), provisional: false, failures: 0, retryAt: null } };
  }
  if (category === 'statuto') next = { ...next, pressure: clamp(next.pressure - 4, 0, 100) };
  // A motion approved commits the executive: an act on its theme within eight weeks (one commitment per theme at a time).
  if (category === 'mozione' && next.executive && !(next.commitments ?? []).some(entry => entry.status === 'aperto' && entry.area === act.area)) next = { ...next, commitments: [...(next.commitments ?? []), { id: uniqueId(next.commitments ?? [], `${act.id}-impegno`), actId: act.id, area: act.area, title: act.title, player: act.sponsor.kind === 'player', from: act.sponsor.groupId ?? null, since: date, dueAt: advanceDays(date, 56), status: 'aperto' }].slice(-12) };
  // An act of the executive on the theme of an open commitment keeps it.
  const kept = ['executive', 'budget'].includes(act.sponsor.kind) && measure && category !== 'cofinanziamento' ? (next.commitments ?? []).filter(entry => entry.status === 'aperto' && entry.area === act.area) : [];
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
    if (['comune', 'provincia'].includes(next.kind) && failures >= 2) {
      next = record({ ...next, status: 'sciolto', dissolvedAt: date }, date, 'Bilancio respinto per la seconda volta: il Prefetto nomina un commissario, il consiglio è sciolto e si torna al voto (art. 141 TUEL).', 'scioglimento');
      events.push({ type: 'scioglimento', kind: next.kind, reason: 'bilancio' });
    } else {
      next = record(next, date, ['comune', 'provincia'].includes(next.kind) ? 'Bilancio respinto: esercizio provvisorio; il Prefetto diffida il consiglio ad approvarlo entro venti giorni.' : 'Legge di bilancio respinta: esercizio provvisorio, niente nuove spese finché non passa.', 'bilancio');
      events.push({ type: 'bilancio-respinto', failures, kind: next.kind });
    }
  }
  if (category === 'opere' && act.measure) {
    if (['comune', 'provincia'].includes(next.kind) && next.indicators) { const id = serviceIndicatorOf(next.kind, act.area).id; next = { ...next, indicators: { ...next.indicators, [id]: round1(clamp(next.indicators[id] - 1, 0, 100)) } }; }
    else if (next.kind === 'regione') events.push({ type: 'effetti', actId: act.id, title: `${act.title} (fondi persi)`, kind: next.kind, region: next.region, indicators: Object.fromEntries(Object.entries(regionalWeights(act.area)).map(([id, weight]) => [id, round2(-0.8 * weight * (next.kind === 'provincia' ? PROVINCE_SHARE_OF_REGION : 1))])), phase: 1, lasting: true, immediate: true, segments: {} });
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
  // A region keeps the services of its territory (a term that began before this was recorded takes its starting point from the first week it sees); a comune and a province have their own.
  if (territory && inst.kind === 'regione' && servicesOf(territory) !== null) inst = { ...inst, territoryServices: servicesOf(territory), baseline: { ...(inst.baseline ?? {}), services: inst.baseline?.services ?? servicesOf(territory) } };
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
  if (['comune', 'provincia'].includes(inst.kind)) inst = cityWeek(inst, seededRandom(`${inst.id}|servizi|${date}`));
  // The public works of the institution: authorisations, design, tender, site, opening, upkeep; the money follows the work.
  { const out = advanceWorks(inst, { date, rand: seededRandom(`${inst.id}|opere|${date}`) }); inst = out.inst; events.push(...out.events); }
  inst = advanceImplementations(inst, date, events);
  if (['regione', 'provincia'].includes(inst.kind) && inst.budget?.provisional) events.push({ type: 'effetti', title: 'Esercizio provvisorio', kind: inst.kind, region: inst.region, indicators: inst.kind === 'provincia' ? { servizi: -0.06, infrastrutture: -0.06 } : { servizi: -0.15, sanita: -0.15 }, phase: 1, lasting: true, immediate: true, segments: {} });
  // New acts. The budget: in autumn for the next year, or as soon as possible when a year runs without one.
  if (inst.budget && ((month >= 11 && inst.budget.approvedYear < year + 1) || inst.budget.approvedYear < year) && !inst.acts.some(item => item.budget && !CLOSED.includes(item.stage)) && (!inst.budget.retryAt || inst.budget.retryAt <= date)) {
    add(newAct(inst, { kind: 'budget', sponsor: budgetSponsor, area: 'finanze', title: actTitle(inst.kind, 'bilancio', 'finanze', { year: month >= 11 ? year + 1 : year }), date, budget: true, category: 'bilancio' }));
  }
  // In July the general adjustment of the budget gives resources to the weakest service.
  if (inst.budget && month === 7 && inst.budget.adjustedYear !== year && !inst.budget.provisional) {
    const area = ['comune', 'provincia'].includes(inst.kind) ? weakCityAreas(inst, 1)[0] ?? 'pa' : localIssues[0] ?? 'sanita';
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
        const problems = ['comune', 'provincia'].includes(inst.kind) ? [...new Set([...localIssues, ...weakCityAreas(inst)])] : localIssues;
        const area = committed.length && rand() < 0.6 ? pickArea(committed) : problems.length && rand() < 0.6 ? pickArea(problems) : pickArea(within(inst.kind, CAMP_PRIORITIES[inst.executive?.camp ?? 'centro']));
        const plan = executivePlan(inst, area, rand, { promised: committed.includes(area), date });
        add(newAct(inst, { kind: 'executive', sponsor, area: plan.area, title: actTitle(inst.kind, plan.type.id, plan.area, { variant: plan.variant }), date, category: plan.type.id, variant: plan.variant, intensity: plan.intensity, work: plan.work ?? null }));
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
      const problems = ['comune', 'provincia'].includes(inst.kind) ? weakCityAreas(inst) : localIssues;
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
    // A group leader who carried the group against its own line pays for it in cohesion.
    if (inst.playerGroupLead && vote.decided && vote.playerChoice && vote.playerLine && vote.playerChoice !== vote.playerLine && ['favorevole', 'contrario'].includes(vote.playerChoice)) {
      inst = { ...inst, groups: inst.groups.map(group => group.id === inst.playerGroupId ? { ...group, cohesion: clamp(group.cohesion - 3, 0, 100) } : group) };
    }
    if (inst.executive && ['executive', 'budget'].includes(act.sponsor.kind)) {
      inst = { ...inst, executive: { ...inst.executive, stability: clamp(inst.executive.stability + (vote.passed ? 1.5 : act.budget ? -8 : -5), 0, 100) } };
      // A group of the majority that did not follow the executive drifts away.
      const unhappy = new Set(vote.byGroup.filter(row => row.line !== 'favorevole').map(row => row.groupId));
      inst = { ...inst, groups: inst.groups.map(group => group.side === 'maggioranza' && unhappy.has(group.id) ? { ...group, cohesion: clamp(group.cohesion - 5, 0, 100) } : group) };
    }
    events.push({ type: 'atto-votato', actId: act.id, title: act.title, kind: act.kind, category, organ: vote.organ, variant: act.variant ?? null, budget: act.budget, sponsor: act.sponsor, area: act.area, passed: vote.passed, playerChoice: vote.playerChoice, playerLine: vote.playerLine, decided: vote.decided, decisive: vote.decisive, yes: vote.yes, against: vote.against, quorum: vote.quorum, measure: act.measure ?? null, delega: Boolean(act.byDelega) });
    if (inst.status !== 'active') return { inst, events, lines };
    // The player's report (or own-initiative report) in plenary: the work of months is judged.
    if (inst.ep && (act.rapporteur?.player || act.kind === 'player')) {
      inst = { ...inst, ep: { ...inst.ep, merit: inst.ep.merit + (vote.passed ? 3 : 1), reports: inst.ep.reports + (vote.passed ? 1 : 0) } };
      events.push({ type: 'relazione-votata', actId: act.id, title: act.title, committee: committeeById(act.committee)?.code ?? '', area: act.area, passed: vote.passed, own: act.kind === 'player' });
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
  // An assessore answers for the service of the delega.
  if (inst.playerDelega && inst.status === 'active') inst = reviewDelega(inst, { date, rand, territory }, events);
  // Closed acts leave the list after a while (the last ones stay for the record).
  const closed = inst.acts.filter(item => CLOSED.includes(item.stage));
  if (closed.length > 12) {
    const old = new Set(closed.slice(0, closed.length - 12).map(item => item.id));
    inst = { ...inst, acts: inst.acts.filter(item => !old.has(item.id)), archive: [...inst.archive, ...inst.acts.filter(item => old.has(item.id)).map(item => ({ id: item.id, title: item.title, stage: item.stage, closedAt: item.closedAt, category: categoryOf(inst, item), ...(item.votes?.length ? { vote: compactVote(item.votes.at(-1)) } : {}), ...(item.answer ? { answer: item.answer } : {}), ...(item.withdrawn ? { withdrawn: item.withdrawn } : {}) }))].slice(-40) };
  }
  return { inst, events, lines };
}
