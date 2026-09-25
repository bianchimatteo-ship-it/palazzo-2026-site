import { advanceDays } from './time.js?v=20260925-2';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20260925-2';
import { activeMinisters, governingGroupIds, playerInMajority } from './parliament-engine.js?v=20260925-2';
import {
  APPOINTMENTS, BASE_WEEKLY_INCOME, CAREER_EVENTS, CAREER_OBJECTIVES, CURRENT_TEMPLATES, EARLY_ELECTION_AFTER_WEEKS, ELECTION_SCHEDULE,
  FORCED_EVENTS, LEGACY_RIVAL_NAMES, SIMULATED_RIVAL_LABEL, FOUNDER_RANK, LEVEL_FIRST_ELECTION, OFFICE_INCOME, PARTY_RANKS, RELATION_TEMPLATES, STAT_LABELS,
  SITUATION_EVENTS, WEEKLY_ACTION_POINTS, WEEKLY_ACTIVITIES, PARTY_LINES, CURRENT_LINES, PARTY_INVESTMENTS, COMMUNICATION_STYLES, CURRENT_AREAS } from '../data/simulation/career-rules.js?v=20260925-2';
import { ACTIVITY_FINANCE_CATEGORY } from '../data/simulation/finance-rules.js?v=20260925-2';
import { ELECTED_CONTRIBUTION, SELECTION_LEAD_DAYS } from '../data/simulation/organization-rules.js?v=20260925-2';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20260925-2';
import { SEGMENTS } from '../data/simulation/society-rules.js?v=20260925-2';
import { book, buyInvestment, createFinance, depositElectionFund, hasAsset, normalizeFinance, settleFinanceWeek } from './finance-engine.js?v=20260925-2';
import { advanceOrganization, applyOrgEffects, createOrganization, isPartyLeader, normalizeOrganization, treasuryBook } from './organization-engine.js?v=20260925-2';
import { advanceContacts, changeContact, contactLabel } from './contacts-engine.js?v=20260925-2';
import { HARD_CATEGORIES, difficultyId, difficultyOf } from '../data/simulation/difficulty-rules.js?v=20260925-2';
import { macroAreaOf } from '../data/simulation/policy-rules.js?v=20260925-2';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const signed = value => `${value > 0 ? '+' : ''}${String(round2(value)).replace('.', ',')}`;
const LOCAL_EVENTS = ['protesta', 'maltempo', 'sindacati-vertenza'];
const RELATION_BASES = Object.fromEntries(RELATION_TEMPLATES.map(item => [item.id, item.base]));
// The difficulty chosen at the start: every system below reads it from the career itself.
const rules = game => difficultyOf(game?.difficulty);

function draw(game) {
  game.rngState = (Math.imul(game.rngState, 1664525) + 1013904223) >>> 0;
  return game.rngState / 4294967296;
}
// A throwaway generator for set-up work that must not disturb the career's own sequence.
function seeded(seed) {
  let state = seed >>> 0 || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export const REAL_LEGISLATURE = Object.freeze({ number: 19, label: 'XIX legislatura', reference: 'real', source: 'real' });
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV'];
function nextLegislature(game, date) {
  const number = (game.legislature?.number ?? 19) + 1;
  game.legislature = { number, label: `${ROMAN[number] ?? number} legislatura (simulata)`, reference: 'simulation', since: date, source: SIM };
}

// ---------- situation ----------
export function situation(ctx, env = {}) {
  const parliament = ctx.parliament;
  const seat = Boolean(parliament?.player?.groupId);
  const governing = ['active', 'crisis'].includes(parliament?.government?.status);
  // Who the player is right now: level, open offices, territory and the weight of the party.
  const level = env.career?.currentLevel ?? env.career?.initialLevel ?? null;
  const titles = (env.offices ?? []).filter(item => !item.endDate && item.politicianId && item.politicianId === env.player?.id).map(item => String(item.title ?? '').toLocaleLowerCase('it-IT'));
  const region = ctx.game.place?.region ?? null;
  const share = Number.isFinite(env.pollShare) ? env.pollShare : null;
  return {
    role: { level, local: level === 'comunale' || titles.some(title => /sindac|consiglier[ea] comunale|assessor/.test(title)), mayor: titles.some(title => title.includes('sindac')), regional: level === 'regionale' || titles.some(title => /regional/.test(title)), parliamentarian: seat },
    macroArea: macroAreaOf(region), south: ['sud', 'isole'].includes(macroAreaOf(region)), north: ['nord-ovest', 'nord-est'].includes(macroAreaOf(region)),
    partyShare: share, partySmall: share !== null && share < 4, partyBig: share !== null && share >= 15, pollDelta: env.pollDelta ?? 0,
    partyAxis: env.signals?.partyAxis ?? null, difficulty: difficultyId(ctx.game.difficulty),
    game: ctx.game, stats: ctx.stats, seat, governing,
    inMajority: seat && playerInMajority(parliament),
    minister: (governing && activeMinisters(parliament.government).some(item => item.playerAppointed)) || Boolean(ctx.game.flags?.scenarioOffice),
    party: Boolean(ctx.game.party), member: ctx.game.party?.affiliation === 'member',
    direzione: ctx.game.party?.affiliation === 'member' && ctx.game.party.rank >= 3,
    secretary: isSecretary(ctx.game.party),
    premier: governing && parliament?.government?.primeMinister === 'player',
    campaignActive: env.campaign?.status === 'active',
    // What the rest of the world looks like this week: events depend on it.
    signals: { crime: 45, spread: 130, euStatus: 'regolare', cohesion: ctx.game.party?.org?.cohesion ?? 60, hostileCurrents: (ctx.game.party?.currents ?? []).filter(item => (item.value ?? item.relation ?? 50) < 35).length, ministers: 0, majorityMood: 60, ...(env.signals ?? {}) }
  };
}
// The party secretary decides the line, alliances, candidacies and organs: the founder, or whoever wins a congress.
export const isSecretary = party => party?.affiliation === 'founder' || (party?.affiliation === 'member' && party.rank >= 5);
function meets(requirement, sit) {
  if (!requirement) return true;
  if (typeof requirement === 'function') return requirement(sit);
  return Boolean(sit[requirement]);
}
const requirementReason = { member: 'Serve l’iscrizione a un partito.', party: 'Serve un partito.', seat: 'Serve un seggio con un gruppo parlamentare.', minister: 'Serve un incarico di governo.', direzione: 'Serve un posto in direzione nazionale.', secretary: 'Solo il segretario del partito può farlo.', premier: 'Solo il Presidente del Consiglio può farlo.' };

// ---------- creation ----------
function createPartyState(party, seed, context = {}) {
  if (!party?.id) return null;
  const shares = [[40, 34, 26], [38, 36, 26], [44, 30, 26], [36, 33, 31]][seed % 4];
  const order = [0, 1, 2].sort((a, b) => ((seed >> (a + 3)) & 7) - ((seed >> (b + 3)) & 7));
  const currents = CURRENT_TEMPLATES.map((item, index) => ({ ...item, strength: shares[order[index]], value: 50, relation: 50, source: SIM }));
  const leader = [...currents].sort((a, b) => b.strength - a.strength)[0];
  const founder = Boolean(party.founder);
  return {
    partyId: party.id, label: party.label ?? null, affiliation: founder ? 'founder' : 'member',
    rank: founder ? FOUNDER_RANK.level : 0, rankTitle: founder ? FOUNDER_RANK.title : PARTY_RANKS[0].title,
    support: founder ? 70 : 50, currents, leaderCurrentId: leader.id, alignedCurrentId: null,
    leadershipContestWeek: null, lastRankContestWeek: null, joinedAt: party.joinedAt ?? null, history: [], source: SIM,
    org: createOrganization({ rand: seeded(seed ^ 0x5bd1e995), founder, region: context.region ?? null, share: context.share ?? null, week: context.week ?? 1, date: context.date ?? null })
  };
}
function makeElection(type, windowOpensAt, place = {}, early = false) {
  const model = ELECTION_MODELS[type];
  const labels = { comunale: `Comunali · ${place.municipality || 'il tuo comune'}`, regionale: `Regionali · ${place.region || 'la tua regione'}`, politiche: early ? 'Politiche anticipate' : 'Elezioni politiche', europee: 'Elezioni europee' };
  return {
    id: `elezione-${type}-${windowOpensAt}`, type, label: labels[type], windowOpensAt,
    windowClosesAt: advanceDays(windowOpensAt, ELECTION_SCHEDULE[type].windowDays), electionDate: advanceDays(windowOpensAt, model.campaignDays),
    status: 'upcoming', campaignId: null, early, source: SIM
  };
}

export function createGameState({ seedText, currentDate, level, party = null, place = {}, stats = {}, parliament = null, funds = null, difficulty = 'normale' }) {
  const seed = hash(seedText);
  const member = party?.id && !party.founder;
  const setting = difficultyOf(difficulty);
  const relations = RELATION_TEMPLATES.filter(item => item.requires !== 'member' || member).map(item => ({
    id: item.id, label: item.id === 'rival' ? SIMULATED_RIVAL_LABEL : item.label,
    kind: item.kind, value: clamp(item.base + (item.id === 'rival' ? -setting.relationStart : setting.relationStart)), source: SIM
  }));
  const elections = Object.keys(ELECTION_SCHEDULE).map(type => makeElection(type, advanceDays(currentDate, 7 * (LEVEL_FIRST_ELECTION[level]?.[type] ?? ELECTION_SCHEDULE[type].firstWeeks)), place));
  const startingFunds = Math.round((funds ?? ({ comunale: 1500, regionale: 2500, deputato: 4000, senatore: 4000 }[level] ?? 2000)) * setting.funds);
  const game = {
    version: 1, source: SIM, status: 'active', seed, rngState: seed, place, difficulty: difficultyId(difficulty),
    week: { index: 1, startedAt: currentDate, ap: WEEKLY_ACTION_POINTS, maxAp: WEEKLY_ACTION_POINTS, categoriesUsed: [] },
    resources: { funds: startingFunds, politicalCapital: clamp(Math.round((parliament?.resources?.politicalCapital ?? stats.influence ?? 30) + setting.capital), 0, 100), source: SIM },
    prep: 0, relations, party: createPartyState(party, seed, { region: place.region, share: party?.share ?? null, week: 1, date: currentDate }), pastParties: [], elections,
    inbox: [], log: [], objectives: {}, flags: {}, lastReport: null, weekStartStats: { ...stats }, lastEventId: null,
    fallenWeeks: 0, endedAt: null, endReason: null,
    finance: createFinance({ week: 1, date: currentDate, funds: startingFunds }), contacts: [], promises: [], legislature: { ...REAL_LEGISLATURE }
  };
  const ctx = { game, stats: { ...stats }, parliament };
  refreshObjectives(ctx, {}, [], currentDate);
  fillInbox(ctx, {}, []);
  return game;
}

export function normalizeGameState(game) {
  if (!game || typeof game !== 'object') return null;
  const week = game.week?.index ?? 1;
  const date = game.week?.startedAt ?? null;
  // Saves from earlier versions gain books, organisation, contacts and legislature without losing anything.
  const party = game.party ? { ...game.party, ...(game.party.affiliation === 'founder' ? { rank: FOUNDER_RANK.level } : {}), org: normalizeOrganization(game.party.org, { rand: seeded(hash(`${game.seed}|${game.party.partyId}|org`)), founder: game.party.affiliation === 'founder', region: game.place?.region ?? null, week, date }) } : game.party ?? null;
  // The career never closes: a save that had ended resumes, with the fall kept on record.
  const revived = game.status === 'ended' ? { status: 'active', endedAt: null, endReason: null, setbacks: [...(game.setbacks ?? []), { week, date: game.endedAt ?? date, reason: game.endReason ?? 'Crisi di reputazione', source: SIM }] } : {};
  return {
    status: 'active', prep: 0, pastParties: [], inbox: [], log: [], objectives: {}, flags: {}, lastReport: null, lastEventId: null, fallenWeeks: 0, place: {},
    contacts: [], promises: [], pending: [], legislature: { ...REAL_LEGISLATURE }, difficulty: 'normale', setbacks: [],
    ...game, ...revived, party,
    finance: normalizeFinance(game.finance, { week, date, funds: game.resources?.funds ?? 0 }),
    week: { ap: WEEKLY_ACTION_POINTS, maxAp: WEEKLY_ACTION_POINTS, categoriesUsed: [], ...(game.week ?? {}) },
    resources: { funds: 0, politicalCapital: 30, source: SIM, ...(game.resources ?? {}) },
    // Older saves named the rival with a realistic invented name: it becomes an explicit simulated role.
    relations: Array.isArray(game.relations) ? game.relations.map(item => item.id === 'rival' && LEGACY_RIVAL_NAMES.includes(item.label) ? { ...item, label: SIMULATED_RIVAL_LABEL } : item) : [],
    elections: Array.isArray(game.elections) ? game.elections : []
  };
}

// ---------- effects ----------
function relationList(game) { return [...game.relations, ...(game.party?.currents ?? [])]; }
function changeRelation(game, id, delta) {
  const item = relationList(game).find(entry => entry.id === id);
  if (!item || !delta) return null;
  item.value = clamp(round2((item.value ?? item.relation ?? 50) + delta));
  if ('relation' in item) item.relation = item.value;
  return item;
}
// Why the numbers move: every stat change of the week is attributed to its cause.
export function recordWhy(game, metric, delta, source) {
  if (!delta || !STAT_LABELS[metric]) return;
  game.why ??= { week: game.week.index, entries: [] };
  const entry = game.why.entries.find(item => item.metric === metric && item.source === source);
  if (entry) entry.delta = round2(entry.delta + delta);
  else game.why.entries.push({ metric, delta: round2(delta), source });
}
// ---------- political memory ----------
// Important choices stay on record and fade slowly (half of their weight every two years).
const MEMORY_LIMIT = 240;
const HALF_LIFE = 104;
export const MEMORY_KINDS = Object.freeze({
  'promessa-mantenuta': { label: 'Promessa mantenuta', tone: 'good' }, 'promessa-tradita': { label: 'Promessa tradita', tone: 'bad' },
  legge: { label: 'Legge o provvedimento', tone: 'good' }, tasse: { label: 'Nuove tasse', tone: 'bad' }, tagli: { label: 'Tagli', tone: 'bad' },
  'decreto-decaduto': { label: 'Decreto decaduto', tone: 'bad' }, 'governo-caduto': { label: 'Governo caduto', tone: 'bad' }, 'crisi-aperta': { label: 'Crisi aperta', tone: 'bad' },
  'alleanza-rotta': { label: 'Alleanza rotta', tone: 'bad' }, 'alleato-tradito': { label: 'Alleato scontentato', tone: 'bad' }, 'cambio-partito': { label: 'Cambio di partito', tone: 'bad' },
  scandalo: { label: 'Scandalo', tone: 'bad' }, epurazione: { label: 'Espulsioni nel partito', tone: 'bad' }, 'esercizio-provvisorio': { label: 'Esercizio provvisorio', tone: 'bad' },
  'procedura-ue': { label: 'Procedura europea', tone: 'bad' }, elezione: { label: 'Risultato elettorale', tone: 'neutral' }, lealta: { label: 'Lealtà dimostrata', tone: 'good' }, emergenza: { label: 'Emergenza gestita', tone: 'neutral' },
  voto: { label: 'Voto in Aula', tone: 'neutral' }, alleanza: { label: 'Alleanza stretta', tone: 'good' }, 'crisi-governo': { label: 'Crisi di governo', tone: 'bad' },
  'vittoria-elettorale': { label: 'Vittoria elettorale', tone: 'good' }, 'sconfitta-elettorale': { label: 'Sconfitta elettorale', tone: 'bad' }, decisione: { label: 'Decisione importante', tone: 'neutral' },
  'caduta-reputazione': { label: 'Caduta di reputazione', tone: 'bad' }, 'ritorno': { label: 'Ritorno sulla scena', tone: 'good' }
});
const currentWeight = (game, item) => (item.weight ?? 1) * Math.pow(0.5, Math.max(0, (game?.week?.index ?? 0) - item.week) / (HALF_LIFE * rules(game).memoryFade));
export function remember(game, entry) {
  if (!game) return game;
  const item = { id: `memoria-${game.week?.index ?? 0}-${(game.memory ?? []).length}-${(game.rngState ?? 1) % 9973}`, week: game.week?.index ?? 0, date: entry.date ?? null, weight: 1, tone: MEMORY_KINDS[entry.kind]?.tone ?? 'neutral', source: SIM, ...entry };
  let memory = [item, ...(game.memory ?? [])];
  // When the record is full the faintest memory goes, not the oldest: a heavy choice can weigh for many years.
  while (memory.length > MEMORY_LIMIT) { const faintest = memory.slice(1).reduce((low, entry) => currentWeight(game, entry) < currentWeight(game, low) ? entry : low); memory = memory.filter(entry => entry !== faintest); }
  game.memory = memory;
  return item;
}
export function memoryWeight(game, filter = () => true) {
  return round2((game?.memory ?? []).filter(filter).reduce((sum, item) => sum + currentWeight(game, item), 0));
}
// Memories about a given subject (a party, an ally, a region): what they remember of the player.
export function memoryAbout(game, subject, tone = null) {
  return memoryWeight(game, item => (item.subject === subject || (item.subjects ?? []).includes(subject)) && (!tone || item.tone === tone));
}
// What the past brings back when voters are called to judge: a list of weighted reminders.
export function memoryBalance(game, { region = null } = {}) {
  const good = memoryWeight(game, item => item.tone === 'good' && (!item.region || !region || item.region === region));
  const bad = memoryWeight(game, item => item.tone === 'bad' && (!item.region || !region || item.region === region));
  const now = game?.week?.index ?? 0;
  const highlights = (game?.memory ?? []).filter(item => item.tone !== 'neutral').map(item => ({ ...item, current: round2(currentWeight(game, item)), yearsAgo: round2(Math.max(0, now - item.week) / 52) })).sort((a, b) => b.current - a.current).slice(0, 4);
  return { good, bad, net: round2(good - bad), highlights };
}

function applyEffects(ctx, effects = {}, targetId = null, lines = [], params = {}) {
  const { game } = ctx;
  for (const [metric, raw] of Object.entries(effects.stats ?? {})) {
    if (!raw || !(metric in ctx.stats || STAT_LABELS[metric])) continue;
    // Gains shrink near the top: the last points of popularity or reputation are the hardest.
    const current = ctx.stats[metric] ?? 0;
    const delta = raw > 0 && metric !== 'consensus' && current > 55 ? round2(raw * clamp((100 - current) / 45, 0.15, 1)) : raw;
    ctx.stats[metric] = clamp(round2(current + delta));
    recordWhy(game, metric, ctx.stats[metric] - current, params.source ?? params.fundsLabel ?? 'Altre decisioni');
    lines.push(`${STAT_LABELS[metric]} ${signed(delta)}`);
  }
  if (effects.fundsFrom) {
    const amount = Math.max(effects.fundsFrom.min ?? 0, Math.round((ctx.stats[effects.fundsFrom.stat] ?? 0) * effects.fundsFrom.factor));
    book(game, amount, 'donazioni', params.fundsLabel ?? null, params.date ?? null);
    lines.push(`Fondi +${amount} €`);
  }
  if (effects.funds) { book(game, effects.funds, effects.funds > 0 ? 'donazioni' : 'altro', params.fundsLabel ?? null, params.date ?? null); lines.push(`Fondi ${effects.funds > 0 ? '+' : '−'}${Math.abs(effects.funds)} €`); }
  if (effects.capital) { game.resources.politicalCapital = clamp(game.resources.politicalCapital + effects.capital); lines.push(`Capitale politico ${signed(effects.capital)}`); }
  if (effects.prep) { game.prep = clamp(game.prep + effects.prep); lines.push(`Preparazione elettorale ${signed(effects.prep)}`); }
  for (const [key, delta] of Object.entries(effects.relations ?? {})) {
    if (key === 'otherCurrents') { for (const current of game.party?.currents ?? []) if (current.id !== (params.currentAId && effects.relations.currentA ? params.currentAId : targetId)) changeRelation(game, current.id, delta); continue; }
    const item = changeRelation(game, key === 'target' ? targetId : key === 'currentA' ? params.currentAId : key, delta);
    if (item) lines.push(`${item.label} ${signed(delta)}`);
  }
  if (effects.party?.support && game.party) { game.party.support = clamp(round2(game.party.support + effects.party.support)); lines.push(`Sostegno nel partito ${signed(effects.party.support)}`); }
  if (effects.org && game.party?.org) applyOrgEffects(game.party.org, { ...effects.org, week: game.week.index }, lines, targetId);
  for (const [key, delta] of Object.entries(effects.contacts ?? {})) {
    const contact = changeContact(game.contacts ?? [], key === 'target' ? params.contactId ?? targetId : key, delta, delta > 0 ? 'Incontro' : 'Rapporto raffreddato', game.week.index);
    if (contact) lines.push(`${contact.person.fullName}: rapporto ${signed(delta)}`);
  }
  const parliament = ctx.parliament;
  if (effects.group?.support && parliament?.careerStanding) { parliament.careerStanding.partySupport = clamp(round2(parliament.careerStanding.partySupport + effects.group.support)); lines.push(`Sostegno nel gruppo ${signed(effects.group.support)}`); }
  for (const [key, delta] of Object.entries(effects.groups ?? {})) {
    if (!parliament?.relations) continue;
    const ids = key === 'target' ? [targetId] : key === 'contact' ? [params.groupId] : key === 'coalition' ? [...governingGroupIds(parliament)].filter(id => id !== parliament.player?.groupId) : [key];
    for (const id of ids) if (parliament.relations[id]) parliament.relations[id] = { ...parliament.relations[id], value: clamp(parliament.relations[id].value + delta) };
    if (ids.length) lines.push(`${key === 'coalition' ? 'Rapporti con la maggioranza' : 'Rapporto con il gruppo'} ${signed(delta)}`);
  }
  if (effects.government?.stability && ['active', 'crisis'].includes(parliament?.government?.status)) {
    parliament.government.stability = clamp(Math.round((parliament.government.stability ?? 50) + effects.government.stability));
    lines.push(`Stabilità del governo ${signed(effects.government.stability)}`);
  }
  return lines;
}
export function costProblem(game, cost = {}) {
  if (cost.ap && game.week.ap < cost.ap) return `Servono ${cost.ap} giorni: questa settimana ne restano ${game.week.ap}.`;
  if (cost.funds && game.resources.funds < cost.funds) return `Servono ${cost.funds} € di fondi.`;
  if (cost.capital && game.resources.politicalCapital < cost.capital) return `Servono ${cost.capital} punti di capitale politico.`;
  if (cost.treasury && !game.party?.org) return 'Serve un partito con una tesoreria.';
  if (cost.treasury && game.party.org.treasury.balance < cost.treasury) return `La tesoreria del partito non ha ${cost.treasury} € disponibili.`;
  return null;
}
function pay(game, cost = {}, category = 'altro', label = null, date = null) {
  if (cost.ap) game.week.ap -= cost.ap;
  if (cost.funds) book(game, -cost.funds, category, label, date);
  if (cost.capital) game.resources.politicalCapital -= cost.capital;
  if (cost.treasury) treasuryBook(game.party.org, -cost.treasury, 'comunicazione', label);
}
// Future consequences: scheduled now, decided when they come due (the outcome is not known in advance).
function schedule(game, later, origin) {
  if (!later) return;
  game.pending = [...(game.pending ?? []), { id: `seguito-${game.week.index}-${(game.pending ?? []).length}-${game.rngState % 9973}`, dueWeek: game.week.index + later.weeks, madeWeek: game.week.index, hint: later.hint ?? later.label ?? 'Esito in arrivo', label: later.label ?? 'Esito', chance: later.chance ?? 1, effects: later.effects ?? null, outcomes: later.outcomes ?? null, memory: later.memory ?? null, origin, source: SIM }];
}
function resolvePending(ctx, env, date, lines) {
  const game = ctx.game;
  for (const item of (game.pending ?? []).filter(entry => entry.dueWeek <= game.week.index)) {
    const itemLines = [];
    let tone = 'neutral';
    let title = item.label;
    if (item.outcomes) {
      const outcome = pickOutcome(game, item.outcomes);
      title = `${item.label}: ${outcome.label}`;
      applyEffects(ctx, outcome.effects, null, itemLines, { date, source: item.origin });
      tone = Object.values(outcome.effects?.stats ?? {}).some(value => value < 0) ? 'bad' : 'good';
    } else if (draw(game) < item.chance) {
      applyEffects(ctx, item.effects, null, itemLines, { date, source: item.origin });
      if (item.memory) remember(game, { date, ...item.memory });
      tone = 'bad';
    } else {
      title = `Scampato: ${item.hint.charAt(0).toLowerCase()}${item.hint.slice(1)}`;
      tone = 'good';
    }
    lines.push(`Conseguenza di “${item.origin}”: ${title}`);
    addLog(game, date, 'conseguenza', title, [`Da: ${item.origin}`, ...itemLines], tone);
  }
  game.pending = (game.pending ?? []).filter(entry => entry.dueWeek > game.week.index);
}
function addLog(game, date, kind, title, lines = [], tone = 'neutral') {
  game.log.unshift({ id: `diario-${game.week.index}-${game.log.length}-${game.rngState % 9973}`, week: game.week.index, date, kind, title, lines, tone, source: SIM });
  game.log = game.log.slice(0, 40);
}
function start(ctx) {
  const next = { game: copy(ctx.game), stats: { ...ctx.stats }, parliament: copy(ctx.parliament) };
  if (next.game.status === 'ended') throw new Error('La carriera è conclusa: inizia una nuova partita.');
  return next;
}

// Time spent on parliamentary work comes out of the same week.
export function spendTime(game, ap) {
  if (game.status === 'ended') throw new Error('La carriera è conclusa: inizia una nuova partita.');
  if (!ap) return game;
  if (game.week.ap < ap) throw new Error(`Non hai più tempo questa settimana (servono ${ap} giorni). Chiudi la settimana per continuare.`);
  return { ...game, week: { ...game.week, ap: game.week.ap - ap, categoriesUsed: [...new Set([...(game.week.categoriesUsed ?? []), 'parlamento'])] } };
}

// ---------- activities ----------
export function activityProblem(ctx, env, activity) {
  const sit = situation(ctx, env);
  if (ctx.game.status === 'ended') return 'La carriera è conclusa.';
  if (sit.campaignActive && activity.category !== 'parlamento') return 'In campagna: usa le attività della sezione Elezioni.';
  if (!meets(activity.requires, sit)) return requirementReason[activity.requires] ?? activity.requiresLabel ?? 'Non disponibile ora.';
  return costProblem(ctx.game, activity.cost);
}
export function performActivity(input, env, activityId, targetId = null) {
  const ctx = start(input);
  const activity = WEEKLY_ACTIVITIES.find(item => item.id === activityId);
  if (!activity) throw new Error('Attività non riconosciuta.');
  const problem = activityProblem(ctx, env, activity);
  if (problem) throw new Error(problem);
  if (activity.target === 'current' && !ctx.game.party?.currents.some(item => item.id === targetId)) throw new Error('Scegli una corrente del partito.');
  if (activity.target === 'character' && !ctx.game.relations.some(item => item.id === targetId)) throw new Error('Scegli con chi parlare.');
  if (activity.target === 'group' && !ctx.parliament?.relations?.[targetId]) throw new Error('Scegli un gruppo parlamentare.');
  if (activity.target === 'region' && !ITALIAN_REGIONS.includes(targetId)) throw new Error('Scegli una regione.');
  if (activity.target === 'contact' && !(ctx.game.contacts ?? []).some(item => item.person.id === targetId)) throw new Error('Scegli un parlamentare tra i tuoi contatti.');
  if (activity.target === 'segment' && !SEGMENTS.some(item => item.id === targetId)) throw new Error('Scegli un gruppo di cittadini.');
  pay(ctx.game, activity.cost, ACTIVITY_FINANCE_CATEGORY[activity.category], activity.label, env.currentDate);
  ctx.game.week.categoriesUsed = [...new Set([...ctx.game.week.categoriesUsed, activity.category])];
  const lines = applyEffects(ctx, activity.effects, targetId, [], { date: env.currentDate, fundsLabel: activity.label });
  let tone = 'good';
  // An external press office halves the risks of media exposure.
  const riskChance = activity.risk ? activity.risk.chance * (activity.category === 'media' && hasAsset(ctx.game.finance, 'ufficio-stampa', ctx.game.week.index) ? 0.5 : 1) : 0;
  if (activity.risk && draw(ctx.game) < riskChance) {
    lines.push(activity.risk.label);
    applyEffects(ctx, activity.risk.effects, targetId, lines, { date: env.currentDate });
    tone = 'bad';
  }
  schedule(ctx.game, activity.later, activity.label);
  addLog(ctx.game, env.currentDate, 'attività', activity.label, lines, tone);
  const completed = refreshObjectives(ctx, env, [], env.currentDate);
  return { ctx, report: { title: activity.label, lines, tone }, completed, activity, targetId };
}

// ---------- investments ----------
export function makeInvestment(input, env, id) {
  const ctx = start(input);
  const investment = buyInvestment(ctx.game, id, env.currentDate);
  const lines = [`Spesa ${investment.cost} €`];
  if (id === 'sondaggio') applyEffects(ctx, { prep: 8, capital: 2 }, null, lines);
  addLog(ctx.game, env.currentDate, 'finanze', `Investimento: ${investment.label}`, lines, 'good');
  return { ctx, investment };
}
export function saveForElection(input, env, amount) {
  const ctx = start(input);
  const fund = depositElectionFund(ctx.game, amount, env.currentDate);
  addLog(ctx.game, env.currentDate, 'finanze', `Fondo elettorale: ${fund} € accantonati`, ['All’avvio della campagna i donatori aggiungono il 15%.'], 'neutral');
  return { ctx, fund };
}

// ---------- inbox ----------
function fill(text, params = {}) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
}
function templateFor(item) {
  if (item.kind === 'appuntamento') return APPOINTMENTS.find(entry => entry.id === item.templateId);
  if (item.kind === 'urgente') return FORCED_EVENTS[item.templateId];
  if (item.kind === 'situazione') return SITUATION_EVENTS[item.templateId];
  return CAREER_EVENTS.find(entry => entry.id === item.templateId);
}
function instantiate(template, kind, ctx, params) {
  return {
    id: `agenda-${ctx.game.week.index}-${template.id}-${ctx.game.rngState % 100000}`, kind, templateId: template.id,
    title: fill(template.title, params), body: fill(template.body, params), params,
    choices: template.choices.map(choice => ({ id: choice.id, label: fill(choice.label, params), cost: choice.cost ?? null, requires: typeof choice.requires === 'string' ? choice.requires : null })),
    defaultChoice: template.defaultChoice ?? template.choices.at(-1).id, week: ctx.game.week.index, source: SIM
  };
}
function eventParams(ctx) {
  const game = ctx.game;
  const currents = [...(game.party?.currents ?? [])].sort((a, b) => b.strength - a.strength);
  return {
    municipality: game.place.municipality || 'il tuo comune', region: game.place.region || 'la tua regione',
    rival: 'il tuo rivale interno', party: game.party?.label || 'il partito',
    currentA: currents[0]?.label, currentB: currents[1]?.label, currentAId: currents[0]?.id, currentBId: currents[1]?.id
  };
}
function raiseForced(ctx, id) {
  if (ctx.game.inbox.some(item => item.templateId === id)) return;
  ctx.game.inbox.unshift(instantiate(FORCED_EVENTS[id], 'urgente', ctx, eventParams(ctx)));
}
// Situation events carry their own parameters (territory, conflict, person, law).
function raiseSituation(ctx, id, params = {}, urgent = false) {
  const game = ctx.game;
  if (game.status === 'ended' || game.inbox.some(item => item.templateId === id && (!params.dedupe || item.params?.dedupe === params.dedupe))) return null;
  const item = instantiate(SITUATION_EVENTS[id], 'situazione', ctx, { ...eventParams(ctx), ...params });
  if (urgent) game.inbox.unshift(item); else game.inbox.push(item);
  return item;
}
export function addSituationEvent(input, id, params = {}, urgent = false) {
  const game = copy(input);
  raiseSituation({ game }, id, params, urgent);
  return game;
}
// Parameters of a drawn event: the region hit is chosen where that indicator is weakest, with some chance.
function eventParamsFor(template, ctx, env) {
  const params = eventParams(ctx);
  const regions = env.signals?.regions ?? [];
  if (template.pickRegion && regions.length) {
    const sorted = [...regions].sort((a, b) => (a.indicators?.[template.pickRegion] ?? 50) - (b.indicators?.[template.pickRegion] ?? 50));
    const pool = draw(ctx.game) < 0.6 ? sorted.slice(0, 6) : sorted;
    params.region2 = pool[Math.floor(draw(ctx.game) * pool.length)]?.name ?? params.region;
  } else params.region2 = params.region;
  params.memory = env.signals?.memoryRecall ?? '';
  params.lawTitle = env.signals?.lawTitle ?? 'una proposta';
  params.lawId = env.signals?.lawId ?? null;
  return params;
}
function fillText(value, params) { return typeof value === 'string' ? fill(value, params) : value; }
function raiseEvent(ctx, template, params, specials, lines, urgent = false) {
  const game = ctx.game;
  const variant = template.variants ? template.variants[Math.floor(draw(game) * template.variants.length)] : null;
  const item = instantiate(variant ? { ...template, ...variant } : template, 'evento', ctx, params);
  if (template.category) item.category = template.category;
  if (urgent || template.category === 'emergenza') game.inbox.unshift(item); else game.inbox.push(item);
  game.eventHistory = { ...(game.eventHistory ?? {}), [template.id]: game.week.index };
  game.lastEventId = template.id;
  // Some events change the world as soon as they happen, whatever the player decides.
  if (template.onRaise?.shock) specials.push({ type: 'society-shock', shock: Object.fromEntries(Object.entries(template.onRaise.shock).map(([key, value]) => [key, fillText(value, params)])) });
  if (template.onRaise?.emergency) game.flags.emergencies = { ...(game.flags.emergencies ?? {}), [template.onRaise.emergency]: game.week.index };
  lines.push(`Nuova decisione: ${item.title}`);
  return item;
}
function fillInbox(ctx, env, lines, specials = []) {
  const game = ctx.game;
  const sit = situation(ctx, env);
  const params = eventParams(ctx);
  const recent = game.lastAppointmentIds ?? [];
  const appointments = APPOINTMENTS.filter(item => meets(item.when, sit) && !recent.includes(item.id));
  const picked = [];
  for (let count = 0; count < 2 && appointments.length; count++) {
    const [item] = appointments.splice(Math.floor(draw(game) * appointments.length), 1);
    picked.push(item.id);
    game.inbox.push(instantiate(item, 'appuntamento', ctx, params));
  }
  game.lastAppointmentIds = picked;
  // Chained events come due first, if their conditions still hold.
  for (const queued of (game.eventQueue ?? []).filter(entry => entry.dueWeek <= game.week.index)) {
    const template = CAREER_EVENTS.find(entry => entry.id === queued.id);
    const since = game.week.index - ((game.eventHistory ?? {})[queued.id] ?? -999);
    if (template && since >= Math.min(template.cooldown ?? 8, 4) && meets(template.when, sit) && !game.inbox.some(item => item.templateId === template.id)) raiseEvent(ctx, template, { ...eventParamsFor(template, ctx, env), ...(queued.params ?? {}) }, specials, lines);
  }
  game.eventQueue = (game.eventQueue ?? []).filter(entry => entry.dueWeek > game.week.index);
  // Procedural draw: conditions, cooldowns, rarity, exclusive categories and the situation's own weight.
  const history = game.eventHistory ?? {};
  const openExclusive = new Set(game.inbox.map(item => CAREER_EVENTS.find(entry => entry.id === item.templateId)?.exclusive).filter(Boolean));
  const eligible = CAREER_EVENTS.filter(item => item.weight > 0 && item.id !== game.lastEventId && meets(item.when, sit) && !(item.id === 'congresso' && !params.currentB)
    && game.week.index - (history[item.id] ?? -999) >= (item.cooldown ?? 8)
    && !(item.unique && history[item.id] !== undefined)
    && !(item.exclusive && openExclusive.has(item.exclusive))
    && !game.inbox.some(entry => entry.templateId === item.id));
  const setting = rules(game);
  const weighted = eligible.map(item => ({ item, weight: item.weight * (typeof item.boost === 'function' ? item.boost(sit) : 1) * (item.rare ? 0.5 : 1) * (HARD_CATEGORIES.includes(item.category) ? setting.badEvents : item.positive ? setting.goodEvents : 1) })).filter(entry => entry.weight > 0);
  // Tense weeks bring more events: crises, campaigns, a government in trouble.
  const tension = (sit.signals.stability ?? 60) < 35 || sit.campaignActive || sit.signals.euStatus === 'procedura' ? 0.2 : 0;
  const rounds = draw(game) < 0.25 + tension ? 2 : 1;
  for (let round = 0; round < rounds && weighted.length; round++) {
    if (draw(game) >= 0.6 + tension) continue;
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let pick = draw(game) * total;
    const index = weighted.findIndex(entry => (pick -= entry.weight) < 0);
    const [{ item: event }] = weighted.splice(index < 0 ? 0 : index, 1);
    if (event.exclusive) for (let i = weighted.length - 1; i >= 0; i--) if (weighted[i].item.exclusive === event.exclusive) weighted.splice(i, 1);
    raiseEvent(ctx, event, eventParamsFor(event, ctx, env), specials, lines);
  }
}
// The political world can ask for a reaction: it lands in the week's agenda like any other event.
export function addWorldReaction(input, reaction) {
  const game = copy(input);
  if (game.status === 'ended' || game.inbox.some(item => item.templateId === 'presa-posizione')) return game;
  const template = CAREER_EVENTS.find(entry => entry.id === 'presa-posizione');
  const ctx = { game };
  game.inbox.push(instantiate(template, 'evento', ctx, { event: reaction.title, eventBody: reaction.body }));
  return game;
}
export const requirementText = requirement => requirementReason[requirement] ?? 'Non disponibile nel tuo ruolo attuale.';
export function describeEffects(effects = {}) {
  const parts = [];
  for (const [metric, delta] of Object.entries(effects.stats ?? {})) parts.push(`${STAT_LABELS[metric]} ${signed(delta)}`);
  if (effects.funds) parts.push(`Fondi ${signed(effects.funds)} €`);
  if (effects.capital) parts.push(`Capitale ${signed(effects.capital)}`);
  if (effects.prep) parts.push(`Preparazione ${signed(effects.prep)}`);
  if (effects.fundsFrom) parts.push(`Fondi in base alla ${STAT_LABELS[effects.fundsFrom.stat].toLowerCase()} (circa ${effects.fundsFrom.factor} € per punto)`);
  for (const [key, delta] of Object.entries(effects.relations ?? {})) parts.push(`${key === 'target' ? 'Rapporto scelto' : key === 'otherCurrents' ? 'Altre correnti' : key === 'currentA' ? 'Area scelta' : RELATION_TEMPLATES.find(entry => entry.id === key)?.label ?? 'Rapporto'} ${signed(delta)}`);
  const org = effects.org ?? {};
  if (org.members) parts.push('Nuovi iscritti');
  if (org.militants) parts.push('Più militanti attivi');
  if (org.section) parts.push('Sezione nella regione scelta');
  if (org.cohesion) parts.push(`Coesione ${signed(org.cohesion)}`);
  if (org.conflicts) parts.push(`Tensioni interne ${signed(org.conflicts)}`);
  if (org.treasury) parts.push(`Tesoreria del partito +${org.treasury} €`);
  if (org.discipline) parts.push(`Disciplina ${signed(org.discipline)}`);
  if (effects.contacts?.target) parts.push(`Rapporto con il parlamentare ${signed(effects.contacts.target)}`);
  if (effects.world) parts.push(`Sondaggi del partito +${String(effects.world).replace('.', ',')}`);
  if (effects.party?.support) parts.push(`Sostegno nel partito ${signed(effects.party.support)}`);
  if (effects.group?.support) parts.push(`Sostegno nel gruppo ${signed(effects.group.support)}`);
  if (effects.groups?.target) parts.push(`Rapporto con il gruppo ${signed(effects.groups.target)}`);
  if (effects.groups?.coalition) parts.push(`Maggioranza ${signed(effects.groups.coalition)}`);
  if (effects.government?.stability) parts.push(`Stabilità governo ${signed(effects.government.stability)}`);
  return parts.join(' · ');
}
export function describeChoice(item, choiceId) {
  const choice = templateFor(item)?.choices.find(entry => entry.id === choiceId);
  if (!choice) return { effects: '', risk: '' };
  const laterHint = choice.later ? (choice.later.hint ?? (choice.later.outcomes ? `esito incerto tra ${choice.later.weeks} settimane` : choice.later.label ?? 'conseguenze in arrivo')) : '';
  const risk = choice.later ? `Possibili conseguenze future: ${laterHint.charAt(0).toLowerCase()}${laterHint.slice(1)}` : choice.risk ? `Rischio ${Math.round(choice.risk.chance * 100)}%` : choice.special?.startsWith('world-stance') ? 'Sposta i sondaggi del partito' : choice.outcomes ? 'Esito incerto' : choice.special?.startsWith('leadership') ? 'Esito legato al congresso' : choice.special === 'leave-party' ? 'Lasci il partito' : choice.special === 'resign' ? 'Lasci gli incarichi' : '';
  return { effects: describeEffects(choice.effects), risk };
}
// Uncertain outcomes lean with the difficulty: favourable ones are likelier on Facile, rarer on Difficile.
const favourable = outcome => !outcome.special && Object.values(outcome.effects?.stats ?? {}).reduce((sum, value) => sum + value, 0) >= 0;
function pickOutcome(game, outcomes) {
  const luck = rules(game).luck;
  const weights = outcomes.map(outcome => Math.max(0.02, (outcome.chance ?? 0) * (1 + (favourable(outcome) ? luck : -luck) * 2)));
  let roll = draw(game) * weights.reduce((sum, value) => sum + value, 0);
  return outcomes.find((outcome, index) => (roll -= weights[index]) < 0) ?? outcomes.at(-1);
}
function runChoice(ctx, env, item, choice, lines, specials) {
  let tone = 'neutral';
  const params = { ...(item.params ?? {}), date: env.currentDate, fundsLabel: item.title, source: item.title };
  applyEffects(ctx, choice.effects, item.params?.targetId ?? null, lines, params);
  if (choice.memory) remember(ctx.game, { date: env.currentDate, ...choice.memory, text: fill(choice.memory.text, item.params) });
  if (choice.followUp && draw(ctx.game) < (choice.followUp.chance ?? 1)) ctx.game.eventQueue = [...(ctx.game.eventQueue ?? []), { id: choice.followUp.id, dueWeek: ctx.game.week.index + (choice.followUp.weeks ?? 2), params: { region2: item.params?.region2 }, from: item.templateId }];
  if (choice.outcomes) {
    const outcome = pickOutcome(ctx.game, choice.outcomes);
    lines.push(outcome.label);
    applyEffects(ctx, outcome.effects, null, lines, params);
    if (outcome.memory) remember(ctx.game, { date: env.currentDate, ...outcome.memory });
    schedule(ctx.game, outcome.later, item.title);
    if (outcome.special) handleSpecial(ctx, env, outcome.special, item, lines, specials, outcome);
    tone = outcome.special || Object.values(outcome.effects?.stats ?? {}).some(value => value < -2) ? 'bad' : 'good';
  }
  if (choice.risk && draw(ctx.game) < choice.risk.chance * rules(ctx.game).riskChance) { lines.push(choice.risk.label); applyEffects(ctx, choice.risk.effects, null, lines, params); tone = 'bad'; }
  schedule(ctx.game, choice.later, item.title);
  if (choice.special) handleSpecial(ctx, env, choice.special, item, lines, specials, choice);
  return tone;
}
export function resolveInboxItem(input, env, itemId, choiceId) {
  const ctx = start(input);
  const item = ctx.game.inbox.find(entry => entry.id === itemId);
  if (!item) throw new Error('Questa decisione non è più disponibile.');
  const choice = templateFor(item)?.choices.find(entry => entry.id === choiceId);
  if (!choice) throw new Error('Scelta non valida.');
  const problem = costProblem(ctx.game, choice.cost);
  if (problem) throw new Error(problem);
  if (choice.requires && !meets(choice.requires, situation(ctx, env))) throw new Error(requirementReason[choice.requires] ?? 'Scelta non disponibile ora.');
  pay(ctx.game, choice.cost, 'eventi', item.title, env.currentDate);
  const template = templateFor(item);
  const local = item.kind === 'appuntamento' ? !['seat', 'minister'].includes(template.when) : LOCAL_EVENTS.includes(item.templateId);
  if (choice.cost?.ap && local) ctx.game.week.categoriesUsed = [...new Set([...ctx.game.week.categoriesUsed, 'territorio'])];
  const lines = [];
  const specials = [];
  const tone = runChoice(ctx, env, item, choice, lines, specials);
  ctx.game.inbox = ctx.game.inbox.filter(entry => entry.id !== itemId);
  addLog(ctx.game, env.currentDate, item.kind, `${item.title} — ${fill(choice.label, item.params)}`, lines, tone);
  const completed = refreshObjectives(ctx, env, [], env.currentDate);
  return { ctx, report: { title: fill(choice.label, item.params), lines, tone }, specials, completed };
}

function leaveParty(ctx, reason) {
  const party = ctx.game.party;
  if (!party) return;
  ctx.game.pastParties.push({ partyId: party.partyId, label: party.label, rankTitle: party.rankTitle, reason, leftAtWeek: ctx.game.week.index, source: SIM });
  ctx.game.party = null;
  ctx.game.relations = ctx.game.relations.filter(item => item.id !== 'leadership');
}
// Specials the store turns into changes of the country, the Parliament or the Government.
const WORLD_SPECIALS = ['markets-calm', 'markets-worse', 'europe-up', 'europe-down', 'society-cost', 'minister-defend', 'minister-resign', 'budget-open', 'partner-accept', 'partner-negotiate', 'partner-refuse', 'obstruction-add', 'obstruction-clear', 'snipers'];
function handleSpecial(ctx, env, special, item, lines, specials, choice = {}) {
  const game = ctx.game;
  if (WORLD_SPECIALS.includes(special)) { specials.push({ type: special, params: item.params ?? {} }); return; }
  if (special === 'emergency-decree') {
    specials.push({ type: 'emergency-decree', decree: Object.fromEntries(Object.entries(choice.decree ?? {}).map(([key, value]) => [key, typeof value === 'string' ? fill(value, item.params) : value])), title: `Misure urgenti: ${item.title}` });
    return;
  }
  if (special === 'issue-law-security') {
    specials.push({ type: 'issue-law', region: item.params?.region2 ?? item.params?.region, topic: 'Sicurezza', indicator: 'sicurezza' });
    return;
  }
  if (special === 'secretary-confidence' || special === 'secretary-resign') {
    const party = game.party;
    if (!party) return;
    const cohesion = party.org?.cohesion ?? 50;
    const holds = special === 'secretary-confidence' && draw(game) < clamp(0.3 + (party.support - 50) / 80 + (cohesion - 45) / 100, 0.1, 0.85);
    if (holds) {
      party.support = clamp(party.support + 5);
      if (party.org) party.org.cohesion = Math.round(clamp(cohesion + 6));
      lines.push('La direzione respinge la mozione: resti segretario, più forte di prima.');
    } else {
      party.rank = special === 'secretary-resign' ? 3 : 4; party.rankTitle = PARTY_RANKS[party.rank].title;
      party.history.push({ week: game.week.index, date: env.currentDate, text: special === 'secretary-resign' ? 'Si dimette da segretario' : 'Sfiduciato dalla direzione nazionale', source: SIM });
      remember(game, { date: env.currentDate, kind: 'crisi-aperta', text: special === 'secretary-resign' ? 'Dimissioni da segretario del partito' : 'Sfiduciato dalla direzione del partito', weight: 1.2 });
      lines.push(special === 'secretary-resign' ? 'Lasci la segreteria: il partito sceglierà una nuova guida.' : 'La mozione passa: perdi la segreteria.');
    }
    return;
  }
  if (special === 'leadership-a' || special === 'leadership-b') {
    const backed = special === 'leadership-a' ? item.params.currentAId : item.params.currentBId;
    const [a, b] = [item.params.currentAId, item.params.currentBId].map(id => game.party.currents.find(entry => entry.id === id));
    const winner = draw(game) < a.strength / (a.strength + b.strength) ? a : b;
    winner.strength = Math.min(60, winner.strength + 8);
    game.party.leaderCurrentId = winner.id;
    game.party.alignedCurrentId = backed;
    game.party.leadershipContestWeek = game.week.index;
    const leadership = game.relations.find(entry => entry.id === 'leadership');
    if (winner.id === backed) {
      game.party.support = clamp(game.party.support + 8);
      if (leadership) leadership.value = Math.max(leadership.value, 62);
      changeRelation(game, winner.id, 8);
      lines.push(`${winner.label} vince il congresso: sei dalla parte giusta (sostegno +8).`);
    } else {
      game.party.support = clamp(game.party.support - 6);
      if (leadership) leadership.value = Math.min(leadership.value, 38);
      changeRelation(game, backed, 4);
      lines.push(`${winner.label} vince il congresso: la nuova leadership non dimentica (sostegno −6).`);
      if (game.party.rank >= 2 && draw(game) < 0.5) demote(ctx, env, 'La nuova maggioranza congressuale ridisegna gli organi', lines);
    }
    if (game.party.org) game.party.org.congress.history = [{ week: game.week.index, winner: winner.label, backed: winner.id === backed, source: SIM }, ...(game.party.org.congress.history ?? [])].slice(0, 6);
  } else if (special === 'world-stance-proposal' || special === 'world-stance-attack') {
    specials.push({ type: 'world-stance', delta: special === 'world-stance-proposal' ? 0.4 : 0.25, title: item.params.event });
  } else if (special === 'flag-opaque-funding') {
    game.flags.opaqueFunding = game.week.index;
  } else if (special === 'leave-party') {
    lines.push('Lasci il partito: prosegui da indipendente.');
    leaveParty(ctx, 'Uscita volontaria');
    specials.push({ type: 'party-left' });
  } else if (special === 'expel') {
    lines.push('Espulsione dal partito: prosegui da indipendente.');
    leaveParty(ctx, 'Espulsione');
    specials.push({ type: 'party-left' });
  } else if (special === 'resign') {
    lines.push('Lasci gli incarichi istituzionali in corso.');
    specials.push({ type: 'resign' });
  } else if (special === 'end-career' || special === 'career-setback') {
    careerSetback(ctx, env, lines, specials, 'Travolto dalla crisi di reputazione');
  } else if (special === 'seek-alliance') {
    specials.push({ type: 'seek-alliance' });
    lines.push('Avvii contatti con le forze più vicine per una lista comune.');
  } else if (special === 'lean-right' || special === 'lean-left') {
    specials.push({ type: 'lean', direction: special === 'lean-right' ? 1 : -1 });
    lines.push(special === 'lean-right' ? 'Il partito si avvicina al centro-destra.' : 'Il partito si avvicina al centro-sinistra.');
  } else if (special === 'region-attention' || special === 'region-neglect') {
    specials.push({ type: 'region-attention', region: item.params.region, delta: special === 'region-attention' ? 3 : -2 });
  } else if (special === 'promise') {
    specials.push({ type: 'promise', region: item.params.region, indicator: item.params.indicator, topic: item.params.topic, issueId: item.params.issueId });
    lines.push('Promessa registrata: tra 12 settimane i cittadini giudicheranno i risultati.');
  } else if (special === 'issue-law') {
    specials.push({ type: 'issue-law', region: item.params.region, topic: item.params.topic, indicator: item.params.indicator });
  } else if (special === 'budget-cut') {
    for (const key of Object.keys(game.finance.budget)) game.finance.budget[key] = 0;
    lines.push('Spese ricorrenti azzerate: staff, comunicazione, territorio e sede sospesi.');
  } else if (special === 'party-loan') {
    const amount = Math.round(game.finance.debt * 0.5);
    if (game.party?.org && amount) { treasuryBook(game.party.org, -amount, 'prestiti', 'Prestito a un eletto'); game.finance.debt -= amount; lines.push(`Il partito copre ${amount} € del tuo debito.`); }
  } else if (special === 'repay-debt') {
    const repay = Math.min(game.finance.debt, game.resources.funds);
    if (repay > 0) { book(game, -repay, 'debito', 'Rimborso straordinario del debito', env.currentDate); game.finance.debt -= repay; lines.push(`Debito ridotto di ${repay} €.`); }
  } else if (special.startsWith('selection-')) {
    decideSelection(ctx, special.slice(10), item, lines);
  } else if (special === 'party-cuts' && game.party?.org) {
    game.party.org.priorities = { ...game.party.org.priorities, comunicazione: 0, formazione: 0 };
    lines.push('Comunicazione e formazione del partito sospese.');
  } else if (special === 'party-subscription' && game.party?.org) {
    const amount = Math.round(game.party.org.members * 1.5);
    treasuryBook(game.party.org, amount, 'donazioni', 'Sottoscrizione straordinaria');
    lines.push(`La sottoscrizione raccoglie ${amount.toLocaleString('it-IT')} €.`);
  } else if (special === 'leadership-self') {
    runForSecretary(ctx, env, lines);
  } else if (special.startsWith('secretary-')) {
    congressAsSecretary(ctx, env, special.slice(10), item, lines);
  } else if (special === 'current-resist' || special === 'current-cede') {
    const party = game.party;
    const leadership = relationValue(game, 'leadership') ?? 50;
    const holds = special === 'current-resist' && draw(game) < clamp(0.4 + (party.support - 50) / 80 + (leadership - 50) / 200, 0.1, 0.9);
    if (holds) { party.support = clamp(party.support + 2); changeRelation(game, item.params.currentAId, -5); lines.push('Alla conta resti al tuo posto: l’area esce ridimensionata.'); }
    else demote(ctx, env, special === 'current-cede' ? 'Fai un passo indietro a favore dell’area' : 'La conta interna ti dà torto', lines);
  } else if (special === 'accept-scenario-office') {
    game.flags.scenarioOffice = { title: 'Sottosegretario (esecutivo di scenario)', since: game.week.index, source: SIM };
    specials.push({ type: 'scenario-office', title: game.flags.scenarioOffice.title });
    lines.push('Entri nell’esecutivo di scenario come sottosegretario.');
  } else if (special === 'world-alliance-accept') {
    specials.push({ type: 'world-alliance', partyId: item.params.partyId });
  } else if (special === 'world-relation-up' || special === 'world-relation-down') {
    specials.push({ type: 'world-relation', partyId: item.params.partyId, delta: special === 'world-relation-up' ? 10 : -10 });
  } else if (special === 'media-repair' || special.startsWith('public-')) {
    specials.push({ type: special });
  } else if (special === 'accept-rank') {
    const rank = nextPartyRank(game);
    if (rank?.threshold) {
      game.party.rank = rank.level; game.party.rankTitle = rank.title;
      game.party.history.push({ week: game.week.index, date: env.currentDate, text: `Nominato ${rank.title.toLowerCase()} su proposta della segreteria`, source: SIM });
      lines.push(`Diventi ${rank.title.toLowerCase()}.`);
    }
  } else if (special === 'cosign') {
    const contact = (game.contacts ?? []).find(entry => entry.person.id === item.params.contactId);
    if (contact) contact.cosigned = [...new Set([...(contact.cosigned ?? []), item.params.lawId])];
    specials.push({ type: 'cosign', lawId: item.params.lawId, person: contact?.person ?? null });
    lines.push(`${item.params.contact} sottoscrive la proposta (simulazione).`);
  }
}
// Running for secretary at a congress: support, the strength of one's area, influence and cohesion count.
function runForSecretary(ctx, env, lines) {
  const game = ctx.game;
  const party = game.party;
  const aligned = party.currents.find(current => current.id === party.alignedCurrentId);
  const score = party.support * 0.45 + (aligned?.strength ?? 20) * 0.6 + (ctx.stats.influence ?? 30) * 0.2 + (party.org?.cohesion ?? 55) * 0.1;
  const won = draw(game) < clamp((score - 42) / 40, 0.1, 0.85);
  party.leadershipContestWeek = game.week.index;
  if (won) {
    party.rank = 5; party.rankTitle = PARTY_RANKS[5].title;
    if (aligned) { party.leaderCurrentId = aligned.id; aligned.strength = Math.min(60, aligned.strength + 8); }
    party.support = clamp(party.support + 8);
    party.history.push({ week: game.week.index, date: env.currentDate, text: 'Eletto segretario nazionale al congresso', source: SIM });
    lines.push('Il congresso ti elegge segretario nazionale: ora decidi linea, alleanze, candidature e organi.');
  } else {
    party.support = clamp(party.support - 6);
    const leadership = game.relations.find(entry => entry.id === 'leadership');
    if (leadership) leadership.value = Math.min(leadership.value, 35);
    lines.push('Il congresso sceglie un’altra guida: la tua candidatura esce sconfitta.');
    if (party.rank >= 3 && draw(game) < 0.5) demote(ctx, env, 'La nuova segreteria ridisegna gli organi', lines);
  }
  if (party.org) party.org.congress.history = [{ week: game.week.index, winner: won ? 'la tua candidatura' : 'un’altra candidatura', backed: won, source: SIM }, ...(party.org.congress.history ?? [])].slice(0, 6);
}
// A sitting secretary faces the congress.
function congressAsSecretary(ctx, env, choice, item, lines) {
  const game = ctx.game;
  const party = game.party;
  const cohesion = party.org?.cohesion ?? 55;
  if (choice === 'resign') {
    party.rank = 3; party.rankTitle = PARTY_RANKS[3].title;
    if (party.org) party.org.cohesion = Math.round(clamp(cohesion + 5));
    ctx.stats.reputation = clamp(round2((ctx.stats.reputation ?? 50) + 1));
    lines.push('Lasci la segreteria e resti in direzione nazionale.');
    return;
  }
  const chance = clamp(0.35 + (party.support - 50) / 100 + (cohesion - 50) / 150 + (choice === 'unity' ? 0.2 : 0), 0.1, 0.9);
  if (draw(game) < chance) {
    party.support = clamp(party.support + 5);
    if (party.org) party.org.cohesion = Math.round(clamp(cohesion + (choice === 'unity' ? 12 : 5)));
    if (choice === 'unity') for (const current of party.currents) changeRelation(game, current.id, 4);
    lines.push(choice === 'unity' ? 'Segreteria unitaria: il congresso ti conferma con tutte le aree.' : 'Il congresso ti conferma alla guida del partito.');
  } else {
    party.rank = choice === 'unity' ? 4 : 3; party.rankTitle = PARTY_RANKS[party.rank].title;
    changeRelation(game, item.params.currentAId, 6);
    lines.push(`Il congresso premia ${item.params.currentA}: perdi la segreteria.`);
    party.history.push({ week: game.week.index, date: env.currentDate, text: 'Perde la segreteria al congresso', source: SIM });
  }
  if (party.org) party.org.congress.history = [{ week: game.week.index, winner: party.rank === 5 ? 'la tua segreteria' : item.params.currentA, backed: party.rank === 5, source: SIM }, ...(party.org.congress.history ?? [])].slice(0, 6);
}
// Candidate selection: how the party picks the lists weighs on the internal nomination.
function decideSelection(ctx, method, item, lines) {
  const game = ctx.game;
  const org = game.party?.org;
  if (!org) return;
  const relation = id => relationValue(game, id) ?? 50;
  let bonus = 0;
  if (method === 'primarie') {
    const chance = clamp(0.3 + ((ctx.stats.popularity ?? 40) - 40) / 100 + (relation('civic') - 45) / 200, 0.1, 0.85);
    const won = draw(game) < chance;
    bonus = won ? 5 : -2;
    lines.push(won ? 'Vinci le primarie: la candidatura è tua di diritto.' : 'Le primarie premiano un altro nome: parti in salita.');
  } else if (method === 'accordo') {
    // A record of elections won makes the leadership more willing to give a good place on the list.
    const wins = (game.timeline ?? []).filter(entry => entry.kind === 'elezione' && entry.tone === 'good').length;
    bonus = Math.round(clamp(2 + (relation('leadership') - 50) / 10 + Math.min(3, wins), -2, 7));
    lines.push(`Accordo con la direzione: sostegno interno ${signed(bonus)}.`);
  } else if (method === 'corrente') {
    const party = game.party;
    bonus = party.alignedCurrentId && party.alignedCurrentId === party.leaderCurrentId ? 4 : party.alignedCurrentId ? 1 : 0;
    for (const current of party.currents) if (current.id !== party.alignedCurrentId) changeRelation(game, current.id, -2);
    lines.push(bonus >= 4 ? 'La tua area guida il partito e ti indica: posizione forte.' : bonus ? 'La tua area ti indica, ma non guida il partito.' : 'Non hai un’area di riferimento: nessun peso aggiuntivo.');
  }
  org.selections = { ...org.selections, [item.params.electionId]: { method, bonus, week: game.week.index, election: item.params.election, source: SIM } };
}
function demote(ctx, env, reason, lines) {
  const party = ctx.game.party;
  if (!party || party.affiliation !== 'member' || party.rank < 1) return;
  const lost = party.rankTitle;
  party.rank -= 1;
  party.rankTitle = PARTY_RANKS[party.rank].title;
  party.history.push({ week: ctx.game.week.index, date: env.currentDate, text: `Perso l’incarico di ${lost.toLowerCase()}`, source: SIM });
  lines.push(`${reason}: perdi l’incarico di ${lost.toLowerCase()} e torni ${party.rankTitle.toLowerCase()}.`);
  addLog(ctx.game, env.currentDate, 'partito', `Incarico perso: ${lost}`, [reason], 'bad');
}
// The career never ends: the worst fall costs offices, allies and standing, and the player starts climbing again.
function careerSetback(ctx, env, lines, specials, reason) {
  const game = ctx.game;
  const date = env.currentDate;
  specials.push({ type: 'resign' });
  if (game.party) game.party.support = clamp(round2(game.party.support - 15));
  for (const relation of game.relations) if (relation.kind !== 'rival') relation.value = clamp(round2((relation.value ?? 50) - 8));
  ctx.stats.notoriety = clamp(round2((ctx.stats.notoriety ?? 30) - 4));
  ctx.stats.influence = clamp(round2((ctx.stats.influence ?? 30) - 6));
  ctx.stats.reputation = clamp(Math.max(ctx.stats.reputation ?? 0, rules(game).resignationBelow + 4));
  game.resources.politicalCapital = clamp(game.resources.politicalCapital - 10);
  game.setbacks = [...(game.setbacks ?? []), { week: game.week.index, date, reason, source: SIM }];
  game.flags.comebackFrom = game.week.index;
  remember(game, { date, kind: 'caduta-reputazione', text: reason, weight: 2.5 });
  lines.push('Perdi incarichi e sostegni: la carriera continua, ma si riparte dal basso.');
  addLog(game, date, 'caduta', 'Traversata nel deserto', [reason, 'Incarichi lasciati, alleati più freddi: la risalita comincia ora.'], 'bad');
}

// ---------- party ----------
export function nextPartyRank(game) {
  if (game.party?.affiliation !== 'member') return null;
  return PARTY_RANKS[game.party.rank + 1] ?? null;
}
export function partyContestScore(ctx) {
  const party = ctx.game.party;
  const leadership = ctx.game.relations.find(item => item.id === 'leadership')?.value ?? 50;
  return Math.round(party.support * 0.45 + leadership * 0.35 + (ctx.stats.influence ?? 30) * 0.2 + (party.alignedCurrentId && party.alignedCurrentId === party.leaderCurrentId ? 4 : 0));
}
export function contestPartyRank(input, env) {
  const ctx = start(input);
  const party = ctx.game.party;
  const rank = nextPartyRank(ctx.game);
  if (!party || party.affiliation !== 'member') throw new Error('Gli incarichi interni si conquistano da iscritto a un partito.');
  if (!rank) throw new Error('Hai raggiunto il vertice interno previsto dal gioco.');
  if (rank.threshold === null) throw new Error('La segreteria nazionale non si conquista con una sfida interna: si vince al congresso.');
  if (party.lastRankContestWeek && ctx.game.week.index - party.lastRankContestWeek < 3) throw new Error('Dopo una sfida interna servono tre settimane prima di riprovare.');
  const problem = costProblem(ctx.game, { ap: 2, capital: 4 });
  if (problem) throw new Error(problem);
  pay(ctx.game, { ap: 2, capital: 4 });
  const score = partyContestScore(ctx);
  const success = score >= rank.threshold;
  party.lastRankContestWeek = ctx.game.week.index;
  const lines = [`Punteggio ${score} su soglia ${rank.threshold}`];
  if (success) {
    party.rank = rank.level; party.rankTitle = rank.title;
    applyEffects(ctx, { party: { support: 3 }, stats: { influence: 2, notoriety: 1 } }, null, lines);
    party.history.push({ week: ctx.game.week.index, date: env.currentDate, text: `Nominato ${rank.title.toLowerCase()}`, source: SIM });
  } else {
    applyEffects(ctx, { party: { support: -3 }, relations: { leadership: -2 } }, null, lines);
  }
  addLog(ctx.game, env.currentDate, 'partito', success ? `Nuovo incarico: ${rank.title}` : `Sfida interna persa: ${rank.title}`, lines, success ? 'good' : 'bad');
  const completed = refreshObjectives(ctx, env, [], env.currentDate);
  return { ctx, success, rank, score, completed };
}
export function alignCurrent(input, env, currentId) {
  const ctx = start(input);
  const party = ctx.game.party;
  const current = party?.currents.find(item => item.id === currentId);
  if (!current) throw new Error('Corrente non disponibile.');
  if (party.alignedCurrentId === currentId) throw new Error('Sei già schierato con questa corrente.');
  const problem = costProblem(ctx.game, { ap: 1 });
  if (problem) throw new Error(problem);
  pay(ctx.game, { ap: 1 });
  party.alignedCurrentId = currentId;
  const lines = applyEffects(ctx, { relations: { target: 6, otherCurrents: -3, ...(currentId === party.leaderCurrentId ? { leadership: 3 } : {}) } }, currentId);
  addLog(ctx.game, env.currentDate, 'partito', `Ti schieri con ${current.label}`, lines, 'neutral');
  return { ctx };
}
// ---------- the secretary's decisions ----------
function asSecretary(input, cost = {}) {
  const ctx = start(input);
  if (!isSecretary(ctx.game.party)) throw new Error('Solo il segretario del partito può prendere questa decisione.');
  const problem = costProblem(ctx.game, cost);
  if (problem) throw new Error(problem);
  pay(ctx.game, cost, 'partito', 'Decisione di segreteria');
  return ctx;
}
function cooldown(party, key, weeks, week) {
  const since = party.decisions?.[key];
  if (since !== undefined && week - since < weeks) throw new Error(`Decisione già presa di recente: di nuovo dalla settimana ${since + weeks}.`);
  party.decisions = { ...(party.decisions ?? {}), [key]: week };
}
// The party line: each internal area prefers one, and the world reads it as the party's strategy.
export function setPartyLine(input, env, line) {
  if (!PARTY_LINES[line]) throw new Error('Linea politica non riconosciuta.');
  const ctx = asSecretary(input, { ap: 1, capital: 3 });
  const party = ctx.game.party;
  if (party.line === line) throw new Error('È già la linea del partito.');
  cooldown(party, 'line', 8, ctx.game.week.index);
  party.line = line;
  const lines = [];
  for (const current of party.currents) changeRelation(ctx.game, current.id, CURRENT_LINES[current.id] === line ? 6 : -3);
  const leaderPrefers = CURRENT_LINES[party.leaderCurrentId] === line;
  if (party.org) party.org.cohesion = Math.round(clamp(party.org.cohesion + (leaderPrefers ? 2 : -4)));
  lines.push(`Nuova linea: ${PARTY_LINES[line].label}`, leaderPrefers ? 'L’area più forte condivide la scelta' : 'Parte del partito non condivide la scelta: coesione −4');
  addLog(ctx.game, env.currentDate, 'partito', `Linea del partito: ${PARTY_LINES[line].label}`, lines, 'neutral');
  return { ctx, line };
}
// Organs and offices go to an internal area: it gains, the others resent it.
export function assignOrgans(input, env, currentId) {
  const ctx = asSecretary(input, { ap: 1, capital: 2 });
  const party = ctx.game.party;
  const current = party.currents.find(item => item.id === currentId);
  if (!current) throw new Error('Area interna non disponibile.');
  cooldown(party, 'organs', 8, ctx.game.week.index);
  party.organsCurrentId = currentId;
  const strongest = [...party.currents].sort((a, b) => b.strength - a.strength)[0];
  const lines = applyEffects(ctx, { relations: { target: 8, otherCurrents: -3 } }, currentId);
  if (party.org) party.org.cohesion = Math.round(clamp(party.org.cohesion + (strongest.id === currentId ? 3 : -2)));
  lines.push(strongest.id === currentId ? 'Premi l’area più forte: il partito si compatta' : 'Premi un’area minoritaria: l’area più forte protesta');
  addLog(ctx.game, env.currentDate, 'partito', `Organi e incarichi affidati a ${current.label}`, lines, 'neutral');
  return { ctx };
}
// The party programme: up to four national priorities; each internal area judges it against its own.
export function setPartyProgram(input, env, areas = [], labels = {}) {
  const chosen = [...new Set(areas)].filter(Boolean).slice(0, 4);
  if (chosen.length < 2) throw new Error('Il programma ha bisogno di almeno due priorità.');
  const ctx = asSecretary(input, { ap: 1, capital: 2 });
  const party = ctx.game.party;
  cooldown(party, 'program', 12, ctx.game.week.index);
  party.program = { areas: chosen, since: ctx.game.week.index, source: SIM };
  const lines = [];
  for (const current of party.currents) {
    const matches = chosen.filter(id => (CURRENT_AREAS[current.id] ?? []).includes(id)).length;
    const delta = matches ? matches * 3 : -3;
    changeRelation(ctx.game, current.id, delta);
    lines.push(`${current.label}: ${delta > 0 ? '+' : ''}${delta}`);
  }
  if (party.org) party.org.cohesion = Math.round(clamp(party.org.cohesion + (chosen.some(id => (CURRENT_AREAS[party.leaderCurrentId] ?? []).includes(id)) ? 2 : -3)));
  addLog(ctx.game, env.currentDate, 'partito', `Nuovo programma: ${chosen.map(id => labels[id] ?? id).join(', ')}`, lines, 'neutral');
  return { ctx };
}
// How the party speaks: it shapes reputation, visibility and the tone of the press every week.
export function setCommunication(input, env, style) {
  if (!COMMUNICATION_STYLES[style]) throw new Error('Stile di comunicazione non riconosciuto.');
  const ctx = asSecretary(input, { capital: 1 });
  const party = ctx.game.party;
  if (party.communication === style) throw new Error('È già lo stile del partito.');
  cooldown(party, 'communication', 6, ctx.game.week.index);
  party.communication = style;
  addLog(ctx.game, env.currentDate, 'partito', `Comunicazione: ${COMMUNICATION_STYLES[style].label.toLowerCase()}`, [COMMUNICATION_STYLES[style].detail], 'neutral');
  return { ctx };
}
// How the party chooses its candidates from now on.
export const CANDIDACY_RULES = Object.freeze({
  primarie: { label: 'Primarie aperte', detail: 'Più partecipazione e iscritti, ma i candidati sfuggono al controllo della segreteria.' },
  segreteria: { label: 'Scelta della segreteria', detail: 'Decidi tu le liste: candidatura certa per te, malumori tra le aree.' },
  territori: { label: 'Indicazione delle federazioni', detail: 'Le sezioni scelgono i candidati: territori più vivi, liste più frammentate.' }
});
export function setCandidacyRule(input, env, rule) {
  if (!CANDIDACY_RULES[rule]) throw new Error('Regola non riconosciuta.');
  const ctx = asSecretary(input, { capital: 2 });
  const party = ctx.game.party;
  cooldown(party, 'candidacy', 12, ctx.game.week.index);
  party.candidacyRule = rule;
  const lines = [`Candidature: ${CANDIDACY_RULES[rule].label.toLowerCase()}`];
  if (rule === 'primarie') applyOrgEffects(party.org, { members: 1, cohesion: -2 }, lines);
  if (rule === 'segreteria') applyEffects(ctx, { relations: { otherCurrents: -3 } }, party.leaderCurrentId, lines);
  if (rule === 'territori') for (const section of party.org.sections) section.vitality = Math.round(clamp(section.vitality + 5));
  addLog(ctx.game, env.currentDate, 'partito', `Nuova regola per le candidature: ${CANDIDACY_RULES[rule].label}`, lines, 'neutral');
  return { ctx };
}
export function callEarlyCongress(input, env) {
  const ctx = asSecretary(input, { capital: 4 });
  const org = ctx.game.party.org;
  if (ctx.game.party.affiliation === 'founder') throw new Error('Da fondatore guidi il partito senza congressi.');
  if (org.congress.nextWeek - ctx.game.week.index <= 2) throw new Error('Il congresso è già alle porte.');
  org.congress.nextWeek = ctx.game.week.index + 2;
  addLog(ctx.game, env.currentDate, 'partito', 'Convochi un congresso anticipato', ['Tra due settimane la tua segreteria sarà messa al voto.'], 'neutral');
  return { ctx };
}
export function partyInvestment(input, env, id) {
  const investment = PARTY_INVESTMENTS.find(item => item.id === id);
  if (!investment) throw new Error('Investimento non disponibile.');
  const ctx = asSecretary(input, { treasury: investment.cost });
  const org = ctx.game.party.org;
  if ((org.investments ?? []).some(item => item.id === id && (!item.untilWeek || item.untilWeek >= ctx.game.week.index))) throw new Error('Investimento già in corso.');
  const lines = [`Tesoreria −${investment.cost.toLocaleString('it-IT')} €`];
  if (id === 'scuola-politica') applyOrgEffects(org, { militants: 0.08, cohesion: 8 }, lines);
  if (id === 'fondo-territori') for (const section of org.sections.filter(item => item.vitality < 45)) section.vitality = Math.round(clamp(section.vitality + 20));
  org.investments = [...(org.investments ?? []), { id, label: investment.label, week: ctx.game.week.index, untilWeek: id === 'fondo-territori' ? ctx.game.week.index : ctx.game.week.index + 52, source: SIM }];
  addLog(ctx.game, env.currentDate, 'partito', `Investimento del partito: ${investment.label}`, lines, 'good');
  return { ctx, investment };
}
// The party's parliamentarians are asked to follow the line: the group closes ranks, individual contacts cool.
export function disciplineGroup(input, env) {
  const ctx = asSecretary(input, { ap: 1, capital: 3 });
  cooldown(ctx.game.party, 'discipline', 6, ctx.game.week.index);
  const lines = applyEffects(ctx, { group: { support: 6 }, org: { cohesion: 4 } });
  for (const contact of (ctx.game.contacts ?? []).filter(item => item.reason === 'gruppo')) changeContact(ctx.game.contacts, contact.person.id, -4, 'Richiamo alla disciplina', ctx.game.week.index);
  lines.push('I parlamentari del gruppo si allineano, qualcuno si raffredda');
  addLog(ctx.game, env.currentDate, 'partito', 'Richiamo alla disciplina dei parlamentari', lines, 'neutral');
  return { ctx };
}
export function expelDissidents(input, env) {
  const ctx = asSecretary(input, { capital: 4 });
  cooldown(ctx.game.party, 'expel', 16, ctx.game.week.index);
  const org = ctx.game.party.org;
  const lost = Math.round(org.members * 0.02);
  for (const section of org.sections) section.members = Math.max(5, Math.round(section.members * 0.98));
  org.members = org.sections.reduce((sum, item) => sum + item.members, 0);
  org.conflicts = [];
  const lines = applyEffects(ctx, { org: { cohesion: 10 }, relations: { rival: -10 }, stats: { notoriety: 1, reputation: -1 } });
  lines.push(`${lost.toLocaleString('it-IT')} iscritti lasciano il partito`);
  addLog(ctx.game, env.currentDate, 'partito', 'Espulsione dei dissidenti', lines, 'bad');
  remember(ctx.game, { date: env.currentDate, kind: 'epurazione', text: 'Espulsione dei dissidenti dal partito', weight: 1 });
  return { ctx };
}

export function joinParty(input, env, party) {
  const ctx = start(input);
  if (ctx.game.party) throw new Error('Hai già un partito: lascialo prima di aderire a un altro.');
  const problem = costProblem(ctx.game, { ap: 1 });
  if (problem) throw new Error(problem);
  pay(ctx.game, { ap: 1 });
  ctx.game.party = createPartyState({ ...party, founder: false, joinedAt: env.currentDate }, hash(`${ctx.game.seed}|${party.id}`));
  // Whoever changed party before starts with less trust in the new one.
  ctx.game.party.support = Math.max(20, 40 - 5 * (ctx.game.pastParties?.length ?? 0));
  if (!ctx.game.relations.some(item => item.id === 'leadership')) ctx.game.relations.unshift({ id: 'leadership', label: 'Leadership del partito', kind: 'Partito', value: 45, source: SIM });
  addLog(ctx.game, env.currentDate, 'partito', `Aderisci a ${party.label || 'un partito'}`, ['Parti come iscritto: il sostegno interno va costruito.'], 'neutral');
  return { ctx };
}
export function quitParty(input, env) {
  const ctx = start(input);
  if (!ctx.game.party) throw new Error('Non fai parte di un partito.');
  const lines = applyEffects(ctx, { stats: { notoriety: 2, influence: -1 } });
  leaveParty(ctx, 'Uscita volontaria');
  addLog(ctx.game, env.currentDate, 'partito', 'Lasci il partito', lines, 'neutral');
  return { ctx };
}

// ---------- objectives ----------
function objectiveMet(id, ctx, env) {
  const game = ctx.game;
  const parliament = ctx.parliament;
  if (id === 'radicamento') return (ctx.stats.popularity ?? 0) >= 55;
  if (id === 'rete') return relationList(game).filter(item => (item.value ?? item.relation) >= 65).length >= 3;
  if (id === 'partito') return (game.party?.rank ?? 0) >= 1;
  if (id === 'candidatura') return env.campaign?.nomination?.status === 'approved' || Boolean(game.flags.candidacy);
  if (id === 'elezione') return (env.career?.electionHistory ?? []).some(item => item.personalMandate);
  if (id === 'parlamento') return Boolean(parliament?.player?.groupId);
  if (id === 'incarico') return Boolean(parliament?.careerStanding?.committeeRole);
  if (id === 'legge') return (parliament?.laws ?? []).some(law => law.stage === 'approved');
  if (id === 'dirigenza') return (game.party?.rank ?? 0) >= 3;
  if (id === 'governo') return (parliament?.government?.ministers ?? []).some(item => item.playerAppointed);
  return false;
}
export function refreshObjectives(ctx, env, lines = [], date) {
  const completed = [];
  for (const objective of CAREER_OBJECTIVES) {
    if (ctx.game.objectives[objective.id] || !objectiveMet(objective.id, ctx, env)) continue;
    ctx.game.objectives[objective.id] = { completedAt: date, week: ctx.game.week.index, source: SIM };
    applyEffects(ctx, objective.reward);
    completed.push(objective);
    lines.push(`Traguardo raggiunto: ${objective.label}`);
    addLog(ctx.game, date, 'traguardo', `Traguardo: ${objective.label}`, [`Capitale politico +${objective.reward.capital}`], 'good');
  }
  return completed;
}
export function objectiveProgress(ctx, env) {
  return CAREER_OBJECTIVES.map(objective => ({ ...objective, done: Boolean(ctx.game.objectives[objective.id]), completedAt: ctx.game.objectives[objective.id]?.completedAt ?? null, available: objective.id !== 'partito' && objective.id !== 'dirigenza' ? true : Boolean(ctx.game.party) }));
}

// ---------- elections ----------
export function openElection(game, type, date) {
  return game.elections.find(item => item.type === type && item.status === 'open' && date >= item.windowOpensAt && date <= item.windowClosesAt) ?? null;
}
export function upcomingElections(game) {
  return [...game.elections].filter(item => item.status !== 'held').sort((a, b) => a.windowOpensAt.localeCompare(b.windowOpensAt));
}
export function markElectionRunning(game, electionId, campaignId) {
  return { ...game, elections: game.elections.map(item => item.id === electionId ? { ...item, status: 'running', campaignId } : item) };
}
function reschedule(game, entry) {
  const cycle = ELECTION_SCHEDULE[entry.type].cycleWeeks * 7;
  const base = entry.early ? entry.electionDate : entry.windowOpensAt;
  game.elections.push(makeElection(entry.type, advanceDays(base, cycle), game.place));
}
export function markElectionHeld(game, campaignId, result) {
  const next = copy(game);
  const entry = next.elections.find(item => item.campaignId === campaignId);
  if (!entry) return next;
  entry.status = 'held';
  entry.result = result;
  reschedule(next, entry);
  if (entry.type === 'politiche') nextLegislature(next, entry.electionDate);
  return next;
}
function updateElections(ctx, date, lines, specials) {
  const game = ctx.game;
  for (const entry of [...game.elections]) {
    if (entry.status === 'upcoming' && date >= entry.windowOpensAt) {
      entry.status = 'open';
      lines.push(`Si apre la finestra delle candidature: ${entry.label} (fino al ${entry.windowClosesAt}).`);
    }
    if (entry.status === 'open' && date > entry.windowClosesAt) {
      entry.status = 'missed';
      lines.push(`Candidature chiuse senza di te: ${entry.label}.`);
      specials.push({ type: 'election-missed', electionType: entry.type });
    }
    if (entry.status === 'missed' && date >= entry.electionDate) {
      entry.status = 'held';
      reschedule(game, entry);
      if (entry.type === 'politiche') { nextLegislature(game, entry.electionDate); lines.push(`Si apre la ${game.legislature.label}.`); }
    }
  }
  // A government that stays fallen long enough brings the general election forward.
  const government = ctx.parliament?.government;
  game.fallenWeeks = government?.status === 'fallen' ? (game.fallenWeeks ?? 0) + 1 : 0;
  const politics = game.elections.find(item => item.type === 'politiche' && item.status === 'upcoming');
  if (game.fallenWeeks >= EARLY_ELECTION_AFTER_WEEKS && politics && politics.windowOpensAt > advanceDays(date, 7)) {
    const early = makeElection('politiche', advanceDays(date, 7), game.place, true);
    Object.assign(politics, { ...early, id: politics.id });
    lines.push('Nessuna maggioranza dopo la caduta del governo: si va alle politiche anticipate.');
    game.fallenWeeks = 0;
  }
}

// ---------- week ----------
function weeklyIncomes(ctx, env) {
  const offices = (env.offices ?? []).filter(item => item.politicianId === env.player?.id && !item.endDate);
  const officeIncome = offices.reduce((sum, office) => sum + (OFFICE_INCOME.find(entry => entry.match.test(office.title))?.amount ?? 0), 0);
  const party = ctx.game.party;
  const rankIncome = party ? (party.affiliation === 'founder' ? FOUNDER_RANK.weeklyIncome : PARTY_RANKS[party.rank]?.weeklyIncome ?? 0) : 0;
  return [
    { category: 'base', amount: BASE_WEEKLY_INCOME, label: 'Sostenitori ricorrenti' },
    { category: 'indennita', amount: officeIncome, label: 'Indennità di carica' },
    { category: 'rimborsi', amount: rankIncome, label: 'Rimborsi per l’incarico nel partito' }
  ].filter(item => item.amount);
}
// Finances, party organisation and parliamentary contacts close the week together.
function weeklySystems(ctx, env, date, closing, lines, specials) {
  const game = ctx.game;
  const incomes = weeklyIncomes(ctx, env);
  const total = incomes.reduce((sum, item) => sum + item.amount, 0);
  const indemnity = incomes.find(item => item.category === 'indennita')?.amount ?? 0;
  const contribution = game.party?.org ? Math.round(indemnity * ELECTED_CONTRIBUTION) : 0;
  const finance = settleFinanceWeek(game, { week: closing, date, incomes, partyContribution: contribution });
  if (contribution) treasuryBook(game.party.org, contribution, 'contributi', 'Contributo degli eletti');
  const budget = finance.effects;
  applyEffects(ctx, { stats: budget.stats, relations: budget.relations, prep: budget.prep, capital: budget.capital, party: budget.party ? { support: budget.party } : undefined }, null, [], { source: 'Spese ricorrenti del comitato' });
  if (budget.territory) game.week.categoriesUsed = [...new Set([...game.week.categoriesUsed, 'territorio'])];
  lines.unshift(`Entrate della settimana: ${total} €${contribution ? ` (di cui ${contribution} € versati al partito)` : ''}`, ...finance.lines.slice(0, 2));
  if (finance.crisis) raiseSituation(ctx, 'crisi-finanziaria', {}, true);
  const party = game.party;
  if (party?.org) {
    const org = advanceOrganization(party.org, { rand: () => draw(game), week: closing, date, pollShare: env.pollShare ?? null, pollDelta: env.pollDelta ?? 0, mood: env.mood ?? 50, rank: party.rank, founder: party.affiliation === 'founder', support: party.support, currents: party.currents, campaignActive: env.campaign?.status === 'active' });
    lines.push(...org.lines.slice(0, 2));
    for (const event of org.events) {
      if (event.type === 'congress' && !game.inbox.some(item => ['congresso', 'congresso-segretario'].includes(item.templateId))) {
        const params = eventParams(ctx);
        if (isSecretary(party)) {
          const challenger = [...party.currents].sort((a, b) => b.strength - a.strength).find(current => current.id !== party.leaderCurrentId) ?? party.currents[0];
          raiseSituation(ctx, 'congresso-segretario', { currentA: challenger.label, currentAId: challenger.id, cohesion: party.org.cohesion, support: Math.round(party.support) }, true);
          lines.push('Si apre il congresso: la tua segreteria è in discussione.');
        } else if (params.currentB) { game.inbox.unshift(instantiate(CAREER_EVENTS.find(entry => entry.id === 'congresso'), 'evento', ctx, params)); lines.push('Si apre il congresso ordinario del partito.'); }
      } else if (event.type === 'conflict') {
        const current = party.currents.find(item => item.id === event.conflict.currents[0]);
        raiseSituation(ctx, 'conflitto-interno', { conflict: event.conflict.title, currentA: current?.label ?? 'la prima area', currentAId: current?.id ?? null });
      } else if (event.type === 'treasury' && isPartyLeader(party)) raiseSituation(ctx, 'tesoreria-rosso');
      else if (event.type === 'demote') demote(ctx, env, event.reason, lines);
    }
    // The chosen communication style works every week, for good and for bad.
    if (isSecretary(party) && COMMUNICATION_STYLES[party.communication]) applyEffects(ctx, { stats: COMMUNICATION_STYLES[party.communication].weekly }, null, [], { source: `Comunicazione ${COMMUNICATION_STYLES[party.communication].label.toLowerCase()}` });
    // A divided party shows in Parliament: its members follow the leadership less.
    const standing = ctx.parliament?.careerStanding;
    if (standing && isSecretary(party) && (party.org?.cohesion ?? 60) < 45) standing.partySupport = round2(clamp(standing.partySupport - 0.8));
    // Internal areas pursue their own ambitions: a hostile one can claim the player's office.
    if (party.affiliation === 'member' && party.rank >= 1 && party.rank <= 4 && closing - (game.flags.currentChallengeWeek ?? -99) >= 12) {
      const rival = [...party.currents].filter(current => current.id !== party.alignedCurrentId && (current.value ?? current.relation ?? 50) < 35).sort((a, b) => b.strength - a.strength)[0];
      if (rival && draw(game) < 0.15) { game.flags.currentChallengeWeek = closing; raiseSituation(ctx, 'sfida-corrente', { currentA: rival.label, currentAId: rival.id, rank: party.rankTitle.toLowerCase() }); }
    }
    // Candidate selection opens a few weeks before each candidacy window.
    if (party.affiliation === 'member') {
      const soon = game.elections.find(entry => ['upcoming', 'open'].includes(entry.status) && !party.org.selections?.[entry.id] && entry.windowOpensAt <= advanceDays(date, SELECTION_LEAD_DAYS) && date <= entry.windowClosesAt);
      // The secretary draws up the lists; everyone else goes through the party's selection.
      if (soon && isSecretary(party)) { party.org.selections = { ...party.org.selections, [soon.id]: { method: 'segreteria', bonus: 6, week: closing, election: soon.label, source: SIM } }; lines.push(`Da segretario compili tu le liste per ${soon.label}.`); }
      else if (soon && !game.inbox.some(item => item.templateId === 'selezione-candidati')) raiseSituation(ctx, 'selezione-candidati', { election: soon.label, electionId: soon.id });
    }
  }
  // A reputable parliamentarian outside the party leadership can be called into the scenario executive.
  const seat = Boolean(ctx.parliament?.player?.groupId);
  const playerGovernment = ['active', 'crisis'].includes(ctx.parliament?.government?.status);
  if (seat && !isSecretary(game.party) && !game.flags.scenarioOffice && !playerGovernment && (ctx.stats.reputation ?? 0) >= 55 && (ctx.stats.influence ?? 0) >= 45 && draw(game) < 0.04) raiseSituation(ctx, 'offerta-governo');
  // Real parliamentarians react to the player's initiatives (the reaction is simulated).
  const laws = (ctx.parliament?.laws ?? []).filter(law => !['approved', 'rejected', 'lapsed'].includes(law.stage));
  const initiative = advanceContacts(game.contacts ?? [], { rand: () => draw(game), openLaw: laws[0] ?? null, seat: Boolean(ctx.parliament?.player?.groupId), region: game.place.region });
  if (initiative) {
    const { contact } = initiative;
    raiseSituation(ctx, initiative.templateId, { contact: contactLabel(contact), contactId: contact.person.id, groupId: contact.person.groupId, law: initiative.law?.title ?? '', lawId: initiative.law?.id ?? null, region: game.place.region || 'la tua regione', circoscription: contact.person.circoscription ?? 'la sua circoscrizione', dedupe: contact.person.id });
  }
  return budget;
}
function drift(ctx, lines) {
  const { game, stats } = ctx;
  if ((stats.notoriety ?? 0) > 15) { stats.notoriety = round2(stats.notoriety - 0.5); recordWhy(game, 'notoriety', -0.5, 'L’attenzione si affievolisce senza nuove uscite'); }
  if (!game.week.categoriesUsed.includes('territorio') && (stats.popularity ?? 0) > 20) { stats.popularity = round2(stats.popularity - 0.4); recordWhy(game, 'popularity', -0.4, 'Poca presenza sul territorio'); lines.push('Poca presenza sul territorio: popolarità −0,4'); }
  if ((stats.reputation ?? 50) < 50) { stats.reputation = round2(stats.reputation + 0.3); recordWhy(game, 'reputation', 0.3, 'Il tempo attenua le polemiche'); }
  // Standing at the top wears out: attention and goodwill must be renewed.
  for (const metric of ['popularity', 'reputation', 'influence']) if ((stats[metric] ?? 0) > 60) { const wear = round2((stats[metric] - 60) * 0.04); stats[metric] = round2(stats[metric] - wear); recordWhy(game, metric, -wear, 'Stare in alto logora: servono nuovi risultati'); }
  if (game.party && game.party.support < 45) game.party.support = round2(game.party.support + 0.5);
  for (const item of game.relations) {
    const base = RELATION_BASES[item.id] ?? 50;
    if (Math.abs(item.value - base) > 2) item.value = round2(item.value + (item.value > base ? -0.5 : 0.5));
  }
  const standing = ctx.parliament?.careerStanding;
  if (standing && Math.abs(standing.partySupport - 50) > 2) standing.partySupport = round2(standing.partySupport + (standing.partySupport > 50 ? -0.5 : 0.5));
}
export function advanceWeek(input, env, governmentWeek = parliament => parliament) {
  const ctx = { game: copy(input.game), stats: { ...input.stats }, parliament: copy(input.parliament) };
  const game = ctx.game;
  const date = env.currentDate;
  const lines = [];
  const specials = [];
  if (game.status === 'ended') return { ctx, specials, report: null };
  const closing = game.week.index;
  for (const item of [...game.inbox]) {
    const choice = templateFor(item)?.choices.find(entry => entry.id === item.defaultChoice);
    game.inbox = game.inbox.filter(entry => entry.id !== item.id);
    if (!choice) continue;
    const itemLines = [];
    const tone = runChoice(ctx, env, item, choice, itemLines, specials);
    if (item.kind !== 'appuntamento' || itemLines.length) addLog(game, date, item.kind, `${item.title} — ${fill(choice.label, item.params)} (senza decisione)`, itemLines, tone);
    if (item.kind !== 'appuntamento') lines.push(`Senza una tua decisione: ${item.title}`);
    if (game.status === 'ended') break;
  }
  if (game.status !== 'ended') resolvePending(ctx, env, date, lines);
  if (game.status !== 'ended') {
    const budget = weeklySystems(ctx, env, date, closing, lines, specials);
    const capitalGain = Math.max(0, Math.round(2 + (ctx.stats.influence ?? 30) / 25 + ((game.party?.rank ?? 0) >= 2 ? 1 : 0) + rules(game).capitalGain));
    game.resources.politicalCapital = clamp(game.resources.politicalCapital + capitalGain);
    lines[0] += ` · capitale politico +${capitalGain}`;
    game.week.nextStaffDays = budget.staffDays;
    drift(ctx, lines);
    if (ctx.parliament) {
      const before = ctx.parliament.government?.status;
      ctx.parliament = governmentWeek(ctx.parliament, date, draw(game), () => draw(game));
      if (before === 'active' && ctx.parliament.government?.status === 'crisis') lines.push('La maggioranza si incrina: il governo entra in crisi.');
    }
    if (game.flags.opaqueFunding && !game.flags.opaqueFundingExposed && draw(game) < 0.25) { raiseForced(ctx, 'finanziamento'); game.flags.opaqueFundingExposed = true; }
    if (game.party?.affiliation === 'member' && (game.party.support < rules(game).expulsionBelow || (game.party.org?.discipline ?? 70) < 15)) raiseForced(ctx, 'espulsione');
    if ((ctx.stats.reputation ?? 50) < rules(game).resignationBelow) raiseForced(ctx, 'dimissioni');
    // A comeback after a fall: once standing is rebuilt, it is remembered as a return.
    if (game.flags.comebackFrom && game.week.index - game.flags.comebackFrom >= 12 && (ctx.stats.reputation ?? 0) >= 45) { remember(game, { date, kind: 'ritorno', text: 'Ritorno sulla scena dopo la caduta', weight: 1.5 }); addLog(game, date, 'ritorno', 'Il ritorno', ['Dopo la caduta hai ricostruito credibilità e rapporti.'], 'good'); game.flags.comebackFrom = null; }
    updateElections(ctx, date, lines, specials);
    const days = WEEKLY_ACTION_POINTS + (game.week.nextStaffDays ?? 0) + rules(game).apBonus;
    game.week = { index: closing + 1, startedAt: date, ap: days, maxAp: days, categoriesUsed: [] };
    fillInbox(ctx, env, lines, specials);
  }
  const deltas = Object.fromEntries(Object.keys(STAT_LABELS).map(metric => [metric, round2((ctx.stats[metric] ?? 0) - (game.weekStartStats?.[metric] ?? ctx.stats[metric] ?? 0))]).filter(([, delta]) => delta));
  game.weekStartStats = { ...ctx.stats };
  game.whyLast = { week: closing, entries: game.why?.entries ?? [] };
  game.why = { week: closing + 1, entries: [] };
  refreshObjectives(ctx, env, lines, date);
  game.lastReport = { week: closing, date, lines, deltas, source: SIM };
  return { ctx, specials, report: game.lastReport };
}

export function relationValue(game, id) {
  return relationList(game).find(item => item.id === id)?.value ?? null;
}
