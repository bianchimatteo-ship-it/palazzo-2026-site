import { ITALIAN_REGIONS } from '../data/regions.js?v=20261027-7';
import { CONGRESS_CYCLE_WEEKS, FIRST_CONGRESS_WEEKS, MEMBERSHIP, MEMBERSHIP_FEE, ORGANS, PARTY_PRIORITIES, SECTION_WEEKLY_COST, TREASURY_LABELS } from '../data/simulation/organization-rules.js?v=20261027-7';
import { PARTY_INVESTMENTS } from '../data/simulation/career-rules.js?v=20261027-7';

// The party as an organisation: members, sections, bodies, cohesion, conflicts and treasury.
// Everything is simulated and lives inside the career state (game.party.org).
const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const HISTORY = 52;
const CURRENT_MEMORY_LIMIT = 24;
const CURRENT_PROFILES = Object.freeze({
  riformisti: Object.freeze({ objective: 'guidare-il-governo', priorities: ['economia', 'europa', 'pa', 'digitale'], initiative: .62, loyalty: .72, negotiation: .6 }),
  territori: Object.freeze({ objective: 'radicare-il-partito', priorities: ['autonomie', 'mezzogiorno', 'agricoltura', 'trasporti', 'turismo'], initiative: .7, loyalty: .58, negotiation: .72 }),
  movimento: Object.freeze({ objective: 'difendere-la-linea', priorities: ['welfare', 'lavoro', 'ambiente', 'casa', 'sanita'], initiative: .78, loyalty: .45, negotiation: .38 })
});
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const seeded = seed => { let state = seed >>> 0 || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const unique = values => [...new Set(values.filter(Boolean))];

const sectionLabel = (region, founder) => founder ? `Sezione ${region}` : `Federazione ${region}`;
const blankPeriod = () => ({ income: 0, expense: 0, byCategory: {} });

function profileForCurrent(current, seed = 1, index = 0) {
  const base = CURRENT_PROFILES[current.id] ?? { objective: 'restare-competitiva', priorities: [], initiative: .55, loyalty: .55, negotiation: .5 };
  const rand = seeded(hash(`corrente|${seed}|${current.id}|${index}`));
  const objective = current.profile?.objective ?? base.objective;
  return {
    version: 1, objective, priorities: unique(current.profile?.priorities?.length ? current.profile.priorities : base.priorities),
    // The jitter is part of the birth of the profile: a profile already there keeps its value (normalising it again must not move it, or every reload would).
    initiative: Number.isFinite(current.profile?.initiative) ? Math.max(0, Math.min(1, current.profile.initiative)) : Math.max(0, Math.min(1, base.initiative + (rand() - .5) * .08)),
    loyalty: Math.max(0, Math.min(1, Number(current.profile?.loyalty ?? base.loyalty))),
    negotiation: Math.max(0, Math.min(1, Number(current.profile?.negotiation ?? base.negotiation))),
    memory: Array.isArray(current.profile?.memory) ? current.profile.memory.slice(0, CURRENT_MEMORY_LIMIT) : [],
    relationships: { ...(current.profile?.relationships ?? {}) },
    agreements: Array.isArray(current.profile?.agreements) ? current.profile.agreements.slice(-8) : [],
    requests: Array.isArray(current.profile?.requests) ? current.profile.requests.slice(-8) : [],
    memorySeq: Math.max(Number(current.profile?.memorySeq ?? 0), Array.isArray(current.profile?.memory) ? current.profile.memory.length : 0),
    lastAction: current.profile?.lastAction ?? null, lastActionWeek: current.profile?.lastActionWeek ?? null,
    congressPlan: current.profile?.congressPlan ?? null, source: SIM
  };
}

export function normalizeCurrentProfiles(currents = [], { seed = 1, week = 1 } = {}) {
  const list = currents.map((current, index) => {
    const profile = profileForCurrent(current, seed, index);
    for (const other of currents) if (other.id !== current.id && !Number.isFinite(Number(profile.relationships[other.id]))) profile.relationships[other.id] = 50;
    return { ...current, strength: Math.max(0, Number(current.strength ?? 0)), value: Math.max(0, Math.min(100, Number(current.value ?? current.relation ?? 50))), relation: Math.max(0, Math.min(100, Number(current.value ?? current.relation ?? 50))), profile, objective: profile.objective, priorities: profile.priorities, initiative: profile.initiative, loyalty: profile.loyalty, lastAction: profile.lastAction, lastActionWeek: profile.lastActionWeek, source: SIM };
  });
  const total = list.reduce((sum, current) => sum + Math.max(0, current.strength), 0) || 1;
  return list.map(current => ({ ...current, strength: Math.round(current.strength * 1000 / total) / 10 })).map((current, index, all) => ({ ...current, strength: index === all.length - 1 ? Math.max(0, 100 - all.slice(0, -1).reduce((sum, item) => sum + item.strength, 0)) : current.strength }));
}

export function rememberCurrent(currents = [], currentId, entry = {}, { week = 0, date = null } = {}) {
  const current = currents.find(item => item.id === currentId);
  if (!current) return null;
  current.profile ??= profileForCurrent(current);
  const sequence = Number(current.profile.memorySeq ?? current.profile.memory?.length ?? 0);
  const item = { id: `corrente-${currentId}-${week}-${sequence}`, week, date, kind: entry.kind ?? 'decisione', subject: entry.subject ?? null, weight: entry.weight ?? 1, source: SIM, ...entry };
  current.profile.memorySeq = sequence + 1;
  current.profile.memory = [item, ...(current.profile.memory ?? [])].slice(0, CURRENT_MEMORY_LIMIT);
  if (entry.targetId) current.profile.relationships[entry.targetId] = Math.max(0, Math.min(100, Number(current.profile.relationships[entry.targetId] ?? 50) + Number(entry.relationDelta ?? 0)));
  if (entry.agreement) current.profile.agreements = [...(current.profile.agreements ?? []), entry.agreement].slice(-8);
  return item;
}

function currentMemoryScore(current, predicate) {
  return (current.profile?.memory ?? []).filter(predicate).reduce((sum, item) => sum + Number(item.weight ?? 1), 0);
}

function currentAction(current, context, rand) {
  const profile = current.profile;
  const lineMismatch = context.line && context.preferredLines?.[current.id] && context.line !== context.preferredLines[current.id];
  const treasuryStress = Number(context.treasuryBalance ?? 0) < 0;
  const congressSoon = Number(context.congressInWeeks ?? 99) <= 8;
  const hostility = currentMemoryScore(current, item => ['linea-rifiutata', 'accordo-rotto', 'incarico-negato', 'scontro'].includes(item.kind));
  const initiative = Math.max(0, Math.min(1, profile.initiative + (lineMismatch ? .12 : 0) + (treasuryStress ? .08 : 0) + (hostility > 1 ? .08 : 0)));
  if (rand() > initiative) return { type: 'monitoraggio', label: 'Osserva la segreteria e conserva peso', request: null };
  if (treasuryStress && current.id === 'territori') return { type: 'fondo-territori', label: 'Chiede risorse per le sezioni più deboli', request: 'territorio' };
  if (lineMismatch && current.id === 'movimento') return { type: 'contestazione-linea', label: 'Prepara una contestazione pubblica della linea', request: 'linea' };
  if (lineMismatch && current.id === 'riformisti') return { type: 'emendamento-programma', label: 'Propone una correzione governista al programma', request: 'programma' };
  if (congressSoon && profile.objective === 'guidare-il-governo') return { type: 'accordo-congressuale', label: 'Cerca una sponda per il congresso', request: 'congresso' };
  if (congressSoon && profile.objective === 'radicare-il-partito') return { type: 'endorsement-territoriale', label: 'Raccoglie delegati nelle federazioni', request: 'delegati' };
  if (congressSoon) return { type: 'mozione-identitaria', label: 'Prepara una mozione identitaria', request: 'linea' };
  if (current.id === 'territori') return { type: 'iniziativa-territoriale', label: 'Chiede un investimento per le sezioni', request: 'territorio' };
  if (current.id === 'riformisti') return { type: 'proposta-governo', label: 'Porta un dossier economico alla direzione', request: 'programma' };
  return { type: 'iniziativa-militanti', label: 'Mobilita i militanti su una priorità sociale', request: 'organizzazione' };
}


// ---------- the memory of internal conflicts ----------
// A conflict that ends (it fades, a truce is signed, a congress settles it) is remembered by the pair of areas: the same pair does not quarrel again at once, nor on the same topic. A new conflict
// between them needs a cause — the party in a bad way, the balance between the areas that changed, a broken truce — and a conflict that is simply the same one restarted is not born.
export const CONFLICT_COOLDOWN = Object.freeze({ estinto: 14, tregua: 20, mediazione: 24, congresso: 20 });
const CONFLICT_TOPIC_WEEKS = 30, LINE_DISPUTE_WEEKS = 10, HOT_NOTICE_WEEKS = 8, MEMORY_WEEKS = 80;
export const pairKey = ids => [...ids].sort().join('+');
export function closeConflicts(org, conflicts, week, how = 'estinto', { until = null, gaps = null } = {}) {
  if (!org || !conflicts?.length) return;
  org.conflictMemory ??= {};
  for (const conflict of conflicts) {
    const ids = conflict.currents ?? [];
    const entry = { closedWeek: week, how, topic: conflict.topic ?? null, title: conflict.title ?? null, until: until ?? week + (CONFLICT_COOLDOWN[how] ?? CONFLICT_COOLDOWN.estinto), gap: gaps?.[pairKey(ids)] ?? conflict.gap ?? null };
    org.conflictMemory[pairKey(ids)] = entry;
    if (how === 'tregua' || how === 'mediazione') for (const id of ids) org.conflictMemory[`tregua:${id}`] = { closedWeek: week, how, until: entry.until };
  }
  for (const [key, entry] of Object.entries(org.conflictMemory)) if (week - (entry.closedWeek ?? 0) > MEMORY_WEEKS) delete org.conflictMemory[key];
}
// A broken truce reopens the quarrels of that area: its memory is cleared.
export function reopenConflicts(org, currentId) {
  if (!org?.conflictMemory) return;
  for (const key of Object.keys(org.conflictMemory)) {
    if (key === `tregua:${currentId}`) delete org.conflictMemory[key];
    else if (key.split('+').includes(currentId)) { for (const id of key.split('+')) delete org.conflictMemory[`tregua:${id}`]; delete org.conflictMemory[key]; }
  }
}
// May the pair quarrel (again) now? Not while the memory of the last quarrel or a truce holds, unless there is a real cause for it.
export function mayQuarrel(org, ids, week, { gap = null, cohesion = 60, relations = [] } = {}) {
  const memory = org.conflictMemory ?? {};
  const held = [memory[pairKey(ids)], ...ids.map(id => memory[`tregua:${id}`])].filter(entry => entry && week < (entry.until ?? 0));
  if (!held.length) return true;
  const escalation = cohesion < 35 || relations.some(value => value < 25) || held.some(entry => Number.isFinite(entry.gap) && Number.isFinite(gap) && gap < entry.gap - 6);
  return escalation;
}
export function advanceCurrentPolitics(currents = [], org, context = {}) {
  if (!currents.length) return { lines: [], events: [], requests: [], alliances: [] };
  const normalized = normalizeCurrentProfiles(currents, { seed: context.seed ?? 1, week: context.week ?? 1 });
  for (let index = 0; index < currents.length; index++) Object.assign(currents[index], normalized[index]);
  const lines = [], events = [], requests = [], alliances = [];
  const rand = context.rand ?? (() => .5);
  const activeRequests = (org.currentPolitics?.requests ?? []).filter(item => (context.week ?? 0) - item.week < 10 && item.status === 'open');
  for (const current of currents) {
    const action = currentAction(current, context, rand);
    current.profile.lastAction = action.label;
    current.profile.lastActionWeek = context.week ?? 0;
    current.lastAction = action.label;
    current.lastActionWeek = context.week ?? 0;
    rememberCurrent(currents, current.id, { kind: action.type, text: action.label, weight: action.type === 'monitoraggio' ? .2 : .6 }, context);
    if (action.request && action.type !== 'monitoraggio' && !activeRequests.some(item => item.currentId === current.id && item.kind === action.request)) {
      const request = { id: `richiesta-${current.id}-${context.week}`, currentId: current.id, kind: action.request, title: action.label, week: context.week ?? 0, status: 'open', urgency: current.id === 'movimento' ? 2 : 1, source: SIM };
      requests.push(request); activeRequests.push(request); current.profile.requests = [...(current.profile.requests ?? []), request].slice(-8);
      lines.push(`${current.label}: ${action.label}.`);
    }
    if (action.type === 'contestazione-linea') {
      current.value = Math.max(0, current.value - 2); current.relation = current.value; current.strength = Math.max(1, current.strength - .7);
      rememberCurrent(currents, current.id, { kind: 'linea-rifiutata', text: `La linea “${context.line ?? 'del partito'}” è contestata`, weight: 1, relationDelta: -2, targetId: 'segreteria' }, context);
      // the same area disputing the same line is one dispute, not one every few weeks; a different line (or a long silence) is a new one
      const memoryKey = `linea:${current.id}`, remembered = org.conflictMemory?.[memoryKey], week = context.week ?? 0;
      if (!remembered || remembered.line !== (context.line ?? null) || week - remembered.closedWeek >= LINE_DISPUTE_WEEKS) {
        org.conflictMemory ??= {};
        org.conflictMemory[memoryKey] = { closedWeek: week, how: 'linea', line: context.line ?? null, until: week + LINE_DISPUTE_WEEKS };
        events.push({ type: 'conflict', conflict: { id: `conflitto-${context.week}-${current.id}`, title: `${current.label} contesta la linea del partito`, currents: [current.id], intensity: 46, since: context.week ?? 0, source: SIM } });
      }
    } else if (action.type === 'accordo-congressuale' || action.type === 'endorsement-territoriale' || action.type === 'mozione-identitaria') {
      current.profile.congressPlan = { week: context.week ?? 0, action: action.type, request: action.request, source: SIM };
    }
  }
  for (let i = 0; i < currents.length; i++) for (let j = i + 1; j < currents.length; j++) {
    const a = currents[i], b = currents[j];
    const trust = Number(a.profile.relationships[b.id] ?? 50);
    if (trust >= 66 && Number(b.profile.relationships[a.id] ?? 50) >= 60 && (context.congressInWeeks ?? 99) <= 10) {
      const agreement = { id: `accordo-${a.id}-${b.id}-${context.week}`, currents: [a.id, b.id], week: context.week ?? 0, status: 'active', source: SIM };
      alliances.push(agreement); a.profile.agreements = [...(a.profile.agreements ?? []), agreement].slice(-8); b.profile.agreements = [...(b.profile.agreements ?? []), agreement].slice(-8);
      rememberCurrent(currents, a.id, { kind: 'accordo', agreement, targetId: b.id, relationDelta: 2 }, context); rememberCurrent(currents, b.id, { kind: 'accordo', agreement, targetId: a.id, relationDelta: 2 }, context);
      lines.push(`${a.label} e ${b.label} preparano un accordo congressuale.`);
      break;
    }
  }
  if (context.congressInWeeks <= 8) {
    org.congress.preparations = Object.fromEntries(currents.map(current => [current.id, { objective: current.profile.objective, plan: current.profile.congressPlan, support: Math.round(current.strength + (current.profile.agreements?.length ?? 0) * 2), source: SIM }]));
  }
  const total = currents.reduce((sum, current) => sum + Math.max(0, current.strength), 0) || 1;
  for (const current of currents) current.strength = Math.round(current.strength * 100 / total * 10) / 10;
  org.currentPolitics = { week: context.week ?? 0, requests: [...new Map([...activeRequests, ...requests].map(item => [item.id, item])).values()].slice(-18), alliances: [...(org.currentPolitics?.alliances ?? []), ...alliances].slice(-10), source: SIM };
  return { lines, events, requests, alliances };
}

export function allocateCurrentPortfolios(currents = [], selectedId = null, { week = 0 } = {}) {
  const roles = ['organizzazione', 'territorio', 'candidature', 'comunicazione'];
  const roleAffinity = {
    organizzazione: { movimento: 5, riformisti: 2 },
    territorio: { territori: 9 },
    candidature: { territori: 3, riformisti: 2 },
    comunicazione: { riformisti: 7, movimento: 2 }
  };
  const portfolios = {};
  const assigned = new Set();
  for (const role of roles) {
    const ranked = [...currents].sort((a, b) => {
      const score = current => current.strength + (current.value ?? 50) * .12 + (current.profile?.loyalty ?? .5) * 10 + (roleAffinity[role]?.[current.id] ?? 0) + (current.id === selectedId ? 2 : 0) + (assigned.has(current.id) ? -8 : 0);
      return score(b) - score(a) || String(a.id).localeCompare(String(b.id));
    });
    const candidate = ranked.find(current => !assigned.has(current.id)) ?? ranked[0];
    portfolios[role] = candidate?.id ?? selectedId;
    if (candidate) assigned.add(candidate.id);
  }
  return { selectedId, portfolios, week, source: SIM };
}

export function createOrganization({ rand, founder = false, region = null, share = null, week = 1, date = null }) {
  const home = ITALIAN_REGIONS.includes(region) ? region : ITALIAN_REGIONS[0];
  const size = founder ? 55 + Math.round(rand() * 50) : Math.round(Math.max(1.5, share ?? 5) * 5200 * (0.8 + rand() * 0.4));
  const regions = founder ? [home] : ITALIAN_REGIONS;
  const weights = regions.map(name => (name === home ? 1.6 : 0.6) + rand());
  const total = weights.reduce((sum, value) => sum + value, 0);
  const sections = regions.map((name, index) => ({ id: `sezione-${name}`, region: name, label: sectionLabel(name, founder), members: Math.max(12, Math.round(size * weights[index] / total)), vitality: Math.round(founder ? 62 : 38 + rand() * 32), openedWeek: week, source: SIM }));
  const members = sections.reduce((sum, item) => sum + item.members, 0);
  return {
    version: 1, source: SIM, founder, members, militants: Math.round(members * (founder ? 0.3 : 0.09)), cadres: sections.length * (founder ? 2 : 4) + (founder ? 3 : 14),
    sections, cohesion: founder ? 72 : Math.round(52 + rand() * 14), discipline: 70, conflicts: [],
    congress: { nextWeek: week + FIRST_CONGRESS_WEEKS, lastWeek: null, history: [], preparations: {} }, selections: {}, currentPolitics: { week: null, requests: [], alliances: [], source: SIM }, currentPortfolios: null,
    priorities: { territorio: 1, comunicazione: 1, formazione: 1 }, lastCommunicationWeek: null,
    treasury: { balance: founder ? 1500 : Math.round(members * 9), current: blankPeriod(), history: [], yearTotals: blankPeriod(), annual: [], year: date?.slice(0, 4) ?? null },
    membersHistory: [{ week, members }], growth: 0,
    membership: blankMembership()
  };
}
export function normalizeOrganization(org, context) {
  if (!org || typeof org !== 'object' || !Array.isArray(org.sections)) return createOrganization(context);
  const base = createOrganization({ ...context, rand: () => 0.5 });
  return { ...base, ...org, treasury: { ...base.treasury, ...(org.treasury ?? {}) }, congress: { ...base.congress, ...(org.congress ?? {}), preparations: { ...(base.congress.preparations ?? {}), ...(org.congress?.preparations ?? {}) } }, currentPolitics: { ...base.currentPolitics, ...(org.currentPolitics ?? {}) }, priorities: { ...base.priorities, ...(org.priorities ?? {}) } };
}

// ---------- the membership fee ----------
export const blankMembership = () => ({ fee: MEMBERSHIP_FEE, changedWeek: null, previous: null, shock: 0, boost: 0, weekly: null, history: [], source: SIM });
export const membershipOf = org => ({ ...blankMembership(), ...(org?.membership ?? {}) });
const clampRange = (value, min, max) => Math.min(max, Math.max(min, value));
// What the members are ready to pay, in € a year: the reference fee, more when the party is cohesive, its sections are alive and the climate is good.
export function acceptedFee({ cohesion = 55, vitality = 50, climate = 0 } = {}) {
  const t = MEMBERSHIP.tolerance;
  return MEMBERSHIP.reference * clampRange(t.base + t.cohesion * clampRange(cohesion, 0, 100) / 100 + t.vitality * clampRange(vitality, 0, 100) / 100 + t.climate * clampRange(climate, -1, 1), t.min, t.max);
}
// What a fee does: how many more or fewer join and leave, how many of the members pay, what it brings in a year. Pure, used by the engine every week and by the page to preview a choice.
export function feeEffects(fee, { members = 0, cohesion = 55, vitality = 50, climate = 0 } = {}) {
  const accepted = acceptedFee({ cohesion, vitality, climate });
  const index = fee / accepted;                     // 1 = exactly what the members accept
  const { join, leave, collection } = MEMBERSHIP;
  const joinMultiplier = clampRange(1 + join.slope * (1 - index), join.floor, join.ceiling);
  const leaveMultiplier = clampRange(leave.base + leave.slope * index, leave.floor, leave.ceiling);
  const collected = clampRange(1 - collection.overSlope * Math.max(0, index - 1) - 0.1 * Math.max(0, 0.5 - cohesion / 100), collection.min, 1);
  const payers = Math.round(members * collected);
  return { accepted, index, joinMultiplier, leaveMultiplier, collected, payers, weekly: payers * fee / 52, yearly: payers * fee };
}
// What, apart from the fee, makes members join (climate, living sections, cohesion, the territory priority) and leave (the opposites, an empty treasury, open conflicts).
export function membershipFactors(org, { climate = 0, vitality = 50 } = {}) {
  const vit = (vitality - 50) / 50, coh = ((org.cohesion ?? 55) - 55) / 45;
  const hotConflict = (org.conflicts ?? []).some(item => item.intensity >= 70) ? 0.3 : 0;
  return {
    joinFactor: clampRange(1 + 0.6 * climate + 0.4 * vit + 0.3 * coh + ((org.priorities?.territorio ?? 1) - 1) * 0.15, 0.2, 2.2),
    leaveFactor: clampRange(1 - 0.5 * climate - 0.35 * vit - 0.4 * coh + ((org.treasury?.balance ?? 0) < 0 ? 0.5 : 0) + hotConflict, 0.3, 2.5)
  };
}
// The members a year from now if everything stayed as it is today (no shocks, no luck): a guide to compare fees, not a promise.
export function projectMembers(org, fee, { climate = 0, vitality = 50, weeks = 52 } = {}) {
  const effects = feeEffects(fee, { members: org.members, cohesion: org.cohesion, vitality, climate });
  const { joinFactor, leaveFactor } = membershipFactors(org, { climate, vitality });
  const weekly = MEMBERSHIP.baseJoin * joinFactor * effects.joinMultiplier - MEMBERSHIP.baseLeave * leaveFactor * effects.leaveMultiplier;
  return Math.round(org.members * (1 + clampRange(weekly, -MEMBERSHIP.maxWeekly, MEMBERSHIP.maxWeekly)) ** weeks);
}
// The leader sets the annual fee (whole euros, within limits, once every cooldownWeeks). Returns the new membership record and the line that tells it.
export function setMembershipFee(org, fee, { week }) {
  const rule = MEMBERSHIP;
  // an empty or non-numeric input is not a fee: Number('') is 0 and would silently become a free membership
  const raw = typeof fee === 'string' ? fee.trim() : fee;
  if (raw === '' || raw === null || raw === undefined || typeof raw === 'boolean' || (typeof raw !== 'number' && typeof raw !== 'string') || !Number.isFinite(Number(raw))) throw new Error(`Inserisci una cifra valida in euro (da ${rule.min} a ${rule.max} €): la quota in vigore non è cambiata.`);
  const value = Math.round(Number(raw));
  if (!Number.isFinite(value) || value < rule.min || value > rule.max) throw new Error(`La quota annuale va da ${rule.min} a ${rule.max} €.`);
  const current = membershipOf(org);
  if (value === current.fee) throw new Error('È già la quota in vigore.');
  if (current.changedWeek !== null && week - current.changedWeek < rule.cooldownWeeks) throw new Error(`La quota si può cambiare una volta ogni ${rule.cooldownWeeks} settimane: ancora ${rule.cooldownWeeks - (week - current.changedWeek)}.`);
  const delta = (value - current.fee) / rule.reference;
  const membership = { ...current, fee: value, previous: current.fee, changedWeek: week, shock: current.shock + Math.max(0, delta) * rule.shockPerReference, boost: current.boost + Math.max(0, -delta) * rule.boostPerReference, history: [...current.history, { week, from: current.fee, to: value }].slice(-12) };
  return { membership, line: `Quota annuale di tesseramento: da ${current.fee} a ${value} €` };
}

export const organOf = party => party ? ORGANS[party.affiliation === 'founder' ? 4 : Math.min(4, party.rank ?? 0)] : null;
export const isPartyLeader = party => party?.affiliation === 'founder' || (party?.rank ?? 0) >= 3;

export function treasuryBook(org, amount, category, label = null) {
  const value = Math.round(amount);
  if (!value) return;
  org.treasury.balance = Math.round(org.treasury.balance + value);
  for (const period of [org.treasury.current, org.treasury.yearTotals]) {
    if (!period) continue;
    if (value >= 0) period.income += value; else period.expense -= value;
    period.byCategory ??= {};
    period.byCategory[category] = (period.byCategory[category] ?? 0) + value;
  }
  if (label) org.treasury.lastEntry = { label, amount: value, category };
}
function recount(org) {
  org.members = org.sections.reduce((sum, item) => sum + item.members, 0);
}

// A given number of new members, spread over the sections by their vitality (a membership drive of the treasury operations).
export function addMembers(org, count) {
  const pool = org.sections.reduce((sum, item) => sum + item.vitality, 0) || 1;
  for (const section of org.sections) section.members += Math.round(count * section.vitality / pool);
  recount(org);
  return count;
}

// Direct effects of the player's work in the party.
export function applyOrgEffects(org, effects = {}, lines = [], targetRegion = null) {
  if (effects.members) {
    // A membership drive adds a local batch of members: decisive for a young party, marginal for a large one.
    const added = Math.max(6, Math.round((18 + Math.sqrt(org.members) * 0.8) * effects.members));
    const pool = org.sections.reduce((sum, item) => sum + item.vitality, 0) || 1;
    for (const section of org.sections) section.members += Math.round(added * section.vitality / pool);
    recount(org);
    lines.push(`Iscritti +${added.toLocaleString('it-IT')}`);
  }
  if (effects.militants) { const added = Math.max(3, Math.round(org.members * effects.militants)); org.militants = Math.min(org.members, org.militants + added); lines.push(`Militanti attivi +${added}`); }
  if (effects.cohesion) { org.cohesion = Math.round(clamp(org.cohesion + effects.cohesion)); lines.push(`Coesione del partito ${effects.cohesion > 0 ? '+' : ''}${effects.cohesion}`); }
  if (effects.conflicts && org.conflicts.length) {
    for (const conflict of org.conflicts) conflict.intensity = Math.round(clamp(conflict.intensity + effects.conflicts));
    const closed = org.conflicts.filter(item => item.intensity <= 5);
    org.conflicts = org.conflicts.filter(item => item.intensity > 5);
    closeConflicts(org, closed, org.conflictWeek ?? 0, 'mediazione');
    lines.push(closed.length ? `Chiuso lo scontro: ${closed[0].title}` : `Tensione interna ${effects.conflicts > 0 ? 'in aumento' : 'in calo'}`);
  }
  if (effects.discipline) org.discipline = Math.round(clamp(org.discipline + effects.discipline));
  if (effects.treasury) { treasuryBook(org, effects.treasury, 'donazioni', 'Contributo volontario'); lines.push(`Tesoreria del partito +${effects.treasury} €`); }
  if (effects.communication) { org.lastCommunicationWeek = effects.week ?? org.lastCommunicationWeek; }
  if (effects.section && targetRegion) {
    const existing = org.sections.find(item => item.region === targetRegion);
    if (existing) { existing.vitality = Math.round(clamp(existing.vitality + 18)); existing.members += Math.max(8, Math.round(existing.members * 0.03)); lines.push(`Rilanciata la ${existing.label.toLowerCase()} (vitalità ${existing.vitality})`); }
    else { org.sections.push({ id: `sezione-${targetRegion}`, region: targetRegion, label: sectionLabel(targetRegion, org.founder), members: 14, vitality: 60, openedWeek: effects.week ?? null, source: SIM }); org.cadres += 2; lines.push(`Aperta la sezione in ${targetRegion}`); }
    recount(org);
  }
  return lines;
}

// The party's funded programmes for the week (see PARTY_INVESTMENTS): upkeep out, returns in, risks, and the effects that the
// rest of the game reads from org.perks (committees, campaigns, candidacies). Nothing is free and nothing is certain.
function runProgrammes(org, { week, rand, lines, events }) {
  const total = { members: 0, staff: 0, cohesion: 0 };
  const perks = { quality: 0, organization: 0, activity: 0, recruit: 0, fundraising: 0, campaignOrganization: 0, campaignVolunteers: 0, selection: 0 };
  for (const item of org.investments ?? []) {
    const spec = PARTY_INVESTMENTS.find(entry => entry.id === item.id);
    if (!spec || spec.oneOff || (item.untilWeek && item.untilWeek < week)) continue;
    if (spec.upkeep) treasuryBook(org, -spec.upkeep, spec.category ?? 'sedi', `Mantenimento: ${spec.label}`);
    const weekly = spec.weekly ?? {};
    total.members += weekly.members ?? 0; total.staff += weekly.staff ?? 0; total.cohesion += weekly.cohesion ?? 0;
    for (const [key, value] of Object.entries(weekly.committees ?? {})) perks[key] = (perks[key] ?? 0) + value;
    perks.campaignOrganization += weekly.campaign?.organization ?? 0; perks.campaignVolunteers += weekly.campaign?.volunteers ?? 0; perks.selection += weekly.selection ?? 0;
    // Slow returns: the income builds up over the weeks since the investment was made.
    if (weekly.income) {
      const ramp = Math.min(1, (week - (item.week ?? week) + 1) / weekly.income.ramp);
      treasuryBook(org, Math.round(weekly.income.donazioni * ramp), 'donazioni', `${spec.label}: donazioni`);
    }
    if (spec.risk && rand() < spec.risk.chance) {
      treasuryBook(org, -spec.risk.cost, 'formazione', spec.risk.label);
      if (spec.risk.effects?.cohesion) org.cohesion = Math.round(clamp(org.cohesion + spec.risk.effects.cohesion));
      lines.push(`${spec.risk.label}: −${spec.risk.cost.toLocaleString('it-IT')} € dalla tesoreria`);
    }
  }
  org.perks = { ...perks, week };
  return total;
}

// One week of party life. `context` carries the political climate and the player's standing.
export function advanceOrganization(org, { rand, week, date, pollShare = null, pollDelta = 0, mood = 50, rank = 0, founder = false, support = 50, currents = [], campaignActive = false, seed = 1, line = null, preferredLines = {}, congressInWeeks = 99, program = null, candidacyRule = null }) {
  const lines = [];
  const events = [];
  const vitality = org.sections.reduce((sum, item) => sum + item.vitality * item.members, 0) / Math.max(1, org.members);
  const recentCommunication = org.lastCommunicationWeek && week - org.lastCommunicationWeek <= 3 ? 0.003 : 0;
  const invested = id => (org.investments ?? []).some(item => item.id === id && (!item.untilWeek || item.untilWeek >= week));
  const digital = invested('piattaforma-iscritti') ? 0.002 : 0;
  // The programmes the leadership has funded: they cost to keep, return slowly, improve the committees and the campaigns,
  // and may go wrong. What they give to the rest of the game is written in org.perks.
  const programmes = runProgrammes(org, { week, rand, lines, events });
  // Members come and go, they do not "grow": the weekly joins and leaves depend on the climate (polls, mood), the life of the sections, the cohesion of the party, its money and, above all, on the fee
  // measured against what the members accept. Small sections keep their fractions (a section of 12 does not stand still for a year).
  const membership = membershipOf(org);
  const climate = clamp(pollDelta * 0.6 + (mood - 50) / 50 * 0.4, -1, 1);
  const vit = (vitality - 50) / 50, coh = (org.cohesion - 55) / 45;
  const hotConflict = org.conflicts.some(item => item.intensity >= 70) ? 0.3 : 0;
  const fee = feeEffects(membership.fee, { members: org.members, cohesion: org.cohesion, vitality, climate });
  const { joinFactor, leaveFactor } = membershipFactors(org, { climate, vitality });
  const extra = recentCommunication + digital + programmes.members;
  const joinRate = MEMBERSHIP.baseJoin * joinFactor * fee.joinMultiplier + membership.boost + Math.max(0, extra);
  const leaveRate = MEMBERSHIP.baseLeave * leaveFactor * fee.leaveMultiplier + membership.shock + Math.max(0, -extra);
  const noise = (rand() - 0.5) * MEMBERSHIP.noise;
  const before = org.members;
  let joined = 0;
  for (const section of org.sections) {
    const secVit = (section.vitality - 50) / 50;
    const sectionJoin = joinRate * (1 + 0.3 * secVit), sectionLeave = leaveRate * (1 - 0.3 * secVit);
    const exact = section.members * clamp(sectionJoin - sectionLeave + noise, -MEMBERSHIP.maxWeekly, MEMBERSHIP.maxWeekly) + (section.carry ?? 0);
    const delta = Math.trunc(exact);
    section.carry = Math.round((exact - delta) * 1000) / 1000;
    joined += section.members * sectionJoin;
    section.members = Math.max(5, section.members + delta);
    section.vitality = Math.round(clamp(section.vitality + (50 + (org.priorities.territorio - 1) * 8 - section.vitality) * 0.05 + (rand() - 0.5) * 5 - (org.treasury.balance < 0 ? 1.5 : 0)));
  }
  const closing = org.sections.filter(item => item.vitality < 12 && org.sections.length > 1);
  if (closing.length) {
    const [section] = closing;
    org.sections = org.sections.filter(item => item !== section);
    lines.push(`Chiude la ${section.label.toLowerCase()}: i suoi iscritti si disperdono`);
  }
  recount(org);
  org.growth = before ? round1((org.members - before) / before * 100) : 0;
  // The week of the fee, told so that it adds up: joins - leaves = the change in members; the income is booked below.
  const net = org.members - before, joins = Math.max(Math.round(joined), net, 0), leaves = Math.max(0, joins - net);
  const fade = value => value * MEMBERSHIP.shockDecay < 0.0002 ? 0 : value * MEMBERSHIP.shockDecay;
  org.membership = { ...membership, shock: fade(membership.shock), boost: fade(membership.boost), weekly: { week, joins, leaves, net, fee: membership.fee, payers: 0, income: 0, accepted: Math.round(fee.accepted * 10) / 10, drivers: { climate: Math.round(climate * 100) / 100, sections: Math.round(vit * 100) / 100, unity: Math.round(coh * 100) / 100, treasuryRed: org.treasury.balance < 0, conflict: hotConflict > 0 } } };
  const targetMilitants = org.members * (0.07 + org.cohesion / 1500 + org.priorities.formazione * 0.01 + (founder ? 0.12 : 0));
  org.militants = Math.round(org.militants + (targetMilitants - org.militants) * 0.1);
  // Without money the staff leaves: the cadres shrink while the treasury is in the red, and grow back only when it is not.
  const minimum = org.sections.length * (founder ? 2 : 4) + (founder ? 3 : 14);
  org.cadres = org.treasury.balance < 0 ? Math.max(Math.round(minimum * 0.6), Math.round(org.cadres * 0.99)) : Math.max(org.cadres, minimum);

  // Treasury: fees, 2x1000 and elected members in, sections, staff and communication out.
  // Money. The fee brings in what the members who pay bring (fee x payers / 52); the poll-driven share (2x1000 and donations of a party that is doing well) comes on top. The costs follow the size of the
  // activity (the members at the reference fee and the same poll share), never the fee: raising the fee brings in more, it does not make the staff more expensive.
  const feeNow = feeEffects(org.membership.fee, { members: org.members, cohesion: org.cohesion, vitality, climate });
  const pollIncome = Math.max(0, (pollShare ?? 2) - 1) * 650;
  const activity = org.members * MEMBERSHIP.reference / 52 + pollIncome;
  const income = feeNow.weekly + pollIncome;
  treasuryBook(org, feeNow.weekly, 'quote');
  treasuryBook(org, pollIncome, 'duepermille');
  org.membership.weekly = { ...org.membership.weekly, payers: feeNow.payers, income: Math.round(feeNow.weekly), collected: Math.round(feeNow.collected * 100) / 100 };
  treasuryBook(org, -org.sections.length * SECTION_WEEKLY_COST * (1 + 0.5 * org.priorities.territorio), 'sedi');
  treasuryBook(org, -activity * (0.72 + (rand() - 0.5) * 0.06) * (1 + programmes.staff), 'personale');
  for (const priority of PARTY_PRIORITIES) if (priority.id !== 'territorio') treasuryBook(org, -activity * priority.costPerLevel * org.priorities[priority.id], priority.id);
  if (campaignActive) treasuryBook(org, -activity * 0.5, 'campagne');
  // A party does not hoard: reserves beyond half a year of income turn into staff and initiatives.
  if (org.treasury.balance > activity * 26) treasuryBook(org, -(org.treasury.balance - activity * 26) * 0.03, 'formazione');
  const period = org.treasury.current;
  org.treasury.history = [...org.treasury.history, { week, income: Math.round(period.income), expense: Math.round(period.expense), balance: org.treasury.balance, source: SIM }].slice(-HISTORY);
  org.treasury.current = blankPeriod();
  const year = date?.slice(0, 4);
  if (year && org.treasury.year && year !== org.treasury.year) {
    const totals = org.treasury.yearTotals;
    org.treasury.annual = [...org.treasury.annual, { year: org.treasury.year, income: Math.round(totals.income), expense: Math.round(totals.expense), net: Math.round(totals.income - totals.expense), byCategory: totals.byCategory, closingBalance: org.treasury.balance, source: SIM }].slice(-10);
    org.treasury.yearTotals = blankPeriod();
  }
  org.treasury.year = year ?? org.treasury.year;
  if (org.treasury.balance < 0) events.push({ type: 'treasury' });

  // Internal areas now act every week, using the same deterministic stream as the
  // organisation. Their requests and alliances become inputs for congresses and
  // appointments instead of being transient flavour text.
  const politics = advanceCurrentPolitics(currents, org, { rand, week, date, seed, line, preferredLines, congressInWeeks, treasuryBalance: org.treasury.balance, pollShare, pollDelta, mood, support, program, candidacyRule });
  lines.push(...politics.lines.slice(0, 3));
  events.push(...politics.events);
  if (currents.length) {
    const allocation = Object.fromEntries(currents.map(current => [current.id, Math.round(Math.max(0, income) * (current.profile?.priorities?.length ?? 1) / Math.max(1, currents.reduce((sum, item) => sum + (item.profile?.priorities?.length ?? 1), 0)))]));
    org.treasury.currentAllocation = { week, byCurrent: allocation, source: SIM };
    org.treasury.byCurrent = { ...(org.treasury.byCurrent ?? {}), ...allocation };
  }

  // Cohesion and conflicts between the internal areas.
  const tension = org.conflicts.reduce((sum, item) => sum + item.intensity, 0);
  const target = 60 - tension * 0.25 + (org.priorities.formazione - 1) * 3 + (invested('scuola-politica') ? 5 : 0) + programmes.cohesion - (org.treasury.balance < 0 ? 10 : 0);
  org.cohesion = Math.round(clamp(org.cohesion + (target - org.cohesion) * 0.08 + (rand() - 0.5) * 2));
  org.conflictWeek = week;
  for (const conflict of org.conflicts) conflict.intensity = Math.round(clamp(conflict.intensity - 2.5 + (org.cohesion < 40 ? 3 : 0) + (rand() - 0.5) * 4));
  const resolved = org.conflicts.filter(item => item.intensity <= 5);
  if (resolved.length) lines.push(`Si ricompone lo scontro: ${resolved[0].title.toLowerCase()}`);
  org.conflicts = org.conflicts.filter(item => item.intensity > 5);
  const sorted = [...currents].sort((a, b) => b.strength - a.strength);
  closeConflicts(org, resolved, week, 'estinto', { gaps: sorted.length >= 2 ? { [pairKey(sorted.slice(0, 2).map(item => item.id))]: sorted[0].strength - sorted[1].strength } : null });
  if (sorted.length >= 2 && org.conflicts.length < 2 && rand() < 0.035 + Math.max(0, 60 - org.cohesion) / 500 + (sorted[0].strength - sorted[1].strength < 6 ? 0.03 : 0)) {
    const topics = ['sulle candidature', 'sulla linea economica', 'sulle alleanze', 'sulla gestione della tesoreria', 'sul rapporto con il governo'];
    const pair = [sorted[0].id, sorted[1].id];
    const gap = sorted[0].strength - sorted[1].strength;
    // the same pair does not quarrel again as soon as it has made peace, unless something real has changed (see mayQuarrel)
    // the same pair is never in two conflicts at once: an open conflict between the two areas is the quarrel, not a new one
    if (!org.conflicts.some(item => pairKey(item.currents ?? []) === pairKey(pair)) && mayQuarrel(org, pair, week, { gap, cohesion: org.cohesion, relations: [sorted[0], sorted[1]].map(item => item.value ?? item.relation ?? 50) })) {
      const last = org.conflictMemory?.[pairKey(pair)];
      let topicIndex = Math.floor(rand() * topics.length);
      if (last?.topic !== undefined && last?.topic !== null && topics[topicIndex] === last.topic && week - last.closedWeek < CONFLICT_TOPIC_WEEKS) topicIndex = (topicIndex + 1) % topics.length;
      const conflict = { id: `conflitto-${week}`, title: `${sorted[0].label} contro ${sorted[1].label} ${topics[topicIndex]}`, topic: topics[topicIndex], gap, currents: pair, intensity: Math.round(35 + rand() * 30), since: week, source: SIM };
      org.conflicts.push(conflict);
      lines.push(`Scontro interno: ${conflict.title}`);
    }
  }
  // a conflict that stays hot is told once in a while, not every week
  const hot = org.conflicts.find(item => item.intensity >= 70);
  if (hot && week - (hot.noticeWeek ?? -99) >= HOT_NOTICE_WEEKS) { hot.noticeWeek = week; events.push({ type: 'conflict', conflict: hot }); }
  org.discipline = Math.round(clamp(org.discipline + 0.5));

  // Standing: a weak position costs the internal office.
  if (!founder && rank >= 1 && ((support < 30 && rand() < 0.15) || (org.discipline < 30 && rand() < 0.2))) events.push({ type: 'demote', reason: support < 30 ? 'Sostegno interno troppo basso' : 'Troppe prese di distanza dalla linea' });
  if (!founder && currents.length >= 2 && week >= org.congress.nextWeek) {
    org.congress = { ...org.congress, lastWeek: week, nextWeek: week + CONGRESS_CYCLE_WEEKS };
    events.push({ type: 'congress' });
  }
  org.membersHistory = [...(org.membersHistory ?? []), { week, members: org.members }].slice(-HISTORY);
  return { lines, events };
}

export function treasuryOutlook(org) {
  const recent = org.treasury.history.slice(-8);
  const net = recent.length ? Math.round(recent.reduce((sum, item) => sum + item.income - item.expense, 0) / recent.length) : 0;
  const state = org.treasury.balance < 0 ? ['crisi', 'In rosso'] : net < 0 ? ['calo', 'In perdita'] : ['solida', 'In equilibrio'];
  return { net, status: state[0], statusLabel: state[1] };
}
export { ORGANS, PARTY_PRIORITIES, TREASURY_LABELS };
