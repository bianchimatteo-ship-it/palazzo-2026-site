import { uniqueId } from './ids.js?v=20261007-2';
import { advanceDays, formatDate, nextMunicipalVote, nextProvincialVote, nextRegionalVote } from './time.js?v=20261007-2';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20261007-2';
import { activeMinisters, governingGroupIds, playerInMajority } from './parliament-engine.js?v=20261007-2';
import {
  APPOINTMENTS, BASE_WEEKLY_INCOME, CAREER_EVENTS, CURRENT_TEMPLATES, EARLY_ELECTION_AFTER_WEEKS, ELECTION_SCHEDULE,
  FORCED_EVENTS, LEGACY_RIVAL_NAMES, SIMULATED_RIVAL_LABEL, FOUNDER_RANK, LEVEL_FIRST_ELECTION, OFFICE_INCOME, PARTY_RANKS, RELATION_TEMPLATES, STAT_LABELS,
  AGENDA_CAPS, SITUATION_EVENTS, WEEKLY_ACTION_POINTS, WEEKLY_ACTIVITIES, PARTY_LINES, CURRENT_LINES, PARTY_INVESTMENTS, COMMUNICATION_STYLES, CURRENT_AREAS, ROUND_RULES } from '../data/simulation/career-rules.js?v=20261007-2';
import { ACTIVITY_FINANCE_CATEGORY } from '../data/simulation/finance-rules.js?v=20261007-2';
import { ELECTED_CONTRIBUTION, SELECTION_LEAD_DAYS } from '../data/simulation/organization-rules.js?v=20261007-2';
import { ITALIAN_REGIONS, hasProvincialLevel } from '../data/regions.js?v=20261007-2';
import { SEGMENTS } from '../data/simulation/society-rules.js?v=20261007-2';
import { book, buyInvestment, createFinance, depositElectionFund, depositReserve, hasAsset, normalizeFinance, releaseReserve, settleFinanceWeek } from './finance-engine.js?v=20261007-2';
import { advanceOrganization, allocateCurrentPortfolios, applyOrgEffects, createOrganization, isPartyLeader, normalizeCurrentProfiles, normalizeOrganization, rememberCurrent, treasuryBook } from './organization-engine.js?v=20261007-2';
import { advanceContacts, changeContact, contactLabel } from './contacts-engine.js?v=20261007-2';
import { HARD_CATEGORIES, difficultyId, difficultyOf } from '../data/simulation/difficulty-rules.js?v=20261007-2';
import { macroAreaOf } from '../data/simulation/policy-rules.js?v=20261007-2';
import { advancementOdds, evaluateAdvancement, progressionFactors } from './progression-engine.js?v=20261007-2';
import { advanceCommittees, applyCommitteeAction, applyLocalEvent, COMMITTEE_ACTIONS, COMMITTEE_LEVELS, COMMITTEE_STATES, committeeActionCost, foundCommittee, leaderStance, scaleOf, territorialControl } from './committee-engine.js?v=20261007-2';
import { europeanElectionDate, legislatureTerm, LEGISLATURE_RULES, sundayOnOrBefore } from './legislature-engine.js?v=20261007-2';
import { CADRE_ACTIONS, LIFE_MEMORY_KINDS, LIFE_SITUATIONS, SPLINTER_NAMES } from '../data/simulation/party-life-rules.js?v=20261007-2';
import { DAILY_EVENTS } from '../data/simulation/daily-events.js?v=20261007-2';
import { eventDay, pickWeighted, reactionRelevance } from './event-engine.js?v=20261007-2';
import { heldOffices, localOffices } from './office-engine.js?v=20261007-2';
import { SECTOR_GAINS, advanceStanding, applyStandingEffects, createStanding, gainSector, normalizeStanding, sectorValue, standingOf } from './standing-engine.js?v=20261007-2';
import { EVENT_SECTORS } from '../data/simulation/standing-rules.js?v=20261007-2';
import { affiliationOf, scenarioCapitalGain, scenarioGrowth, scenarioInit, scenarioOf } from './scenario-engine.js?v=20261007-2';
import { PRESIDENCY_SITUATIONS } from '../data/simulation/presidency-rules.js?v=20261007-2';
import { START_SITUATIONS } from '../data/simulation/start-rules.js?v=20261007-2';
import { AMBITION_BROKEN, AMBITION_COST, AMBITION_KEPT, OBJECTIVE_BY_ID, OBJECTIVE_SITUATIONS } from '../data/simulation/objective-rules.js?v=20261007-2';
import { ambitionProblem, bump, bumpAmbition, bumpDecision, expiredAmbitions, isClassicObjective, objectiveBase, objectiveStatus } from './objective-engine.js?v=20261007-2';
import { advanceStart, hasStart, startBase, startFundsFactor, startInit, startSpecial } from './start-engine.js?v=20261007-2';
import { advanceLife, breakPact, cadreAction, cadreDecision, congressWork, createLife, honourCadrePromises, honourListPacts, lapseAnswer, lifeOverview, normalizeLife, resolveCongress, respondRequest, startRebuild } from './party-life-engine.js?v=20261007-2';
import { enterNewParty, foundParty, mergeParties, OP_COSTS, partyOpsAvailability, renameParty, splitOff } from './party-ops-engine.js?v=20261007-2';
// The decisions of the party's internal life join the situation events; the daily events join the procedural ones.
const SITUATIONS = { ...SITUATION_EVENTS, ...LIFE_SITUATIONS, ...PRESIDENCY_SITUATIONS, ...START_SITUATIONS, ...OBJECTIVE_SITUATIONS };
const EVENT_POOL = [...CAREER_EVENTS, ...DAILY_EVENTS];

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
// The XIX legislature in office when a career starts: its first sitting (13 October 2022) is the start of the Camera
// in the real dataset (chambers.json); its natural end and the day of the next general election follow from it.
export const REAL_LEGISLATURE = Object.freeze({ number: 19, label: 'XIX legislatura', reference: 'real', firstSitting: '2022-10-13', source: 'real' });
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV'];
function nextLegislature(game, date) {
  const number = (game.legislature?.number ?? 19) + 1;
  game.legislature = { number, label: `${ROMAN[number] ?? number} legislatura (simulata)`, reference: 'simulation', since: date, firstSitting: advanceDays(date, LEGISLATURE_RULES.firstSittingDays), source: SIM };
}

// ---------- situation ----------
// The offices the player holds now, read from the councils, the seat, the group, the Government and the party (office-engine).
export function holdingsOf(ctx, env = {}) {
  const parliament = ctx.parliament;
  const seat = Boolean(parliament?.player?.groupId);
  const governing = ['active', 'crisis'].includes(parliament?.government?.status);
  const flags = ctx.game.flags ?? {};
  return heldOffices({
    institutions: (env.institutions ?? []).filter(inst => inst?.status === 'active'), chamber: seat ? parliament.player.chamber : null,
    groupLeader: Boolean(seat && flags.groupLeader && flags.groupLeader.groupId === parliament.player.groupId && String(flags.groupLeader.since ?? '') >= String(parliament.player.mandateStartedAt ?? '')),
    minister: governing && activeMinisters(parliament.government).some(item => item.playerAppointed), undersecretary: Boolean(flags.scenarioOffice),
    premier: governing && parliament?.government?.primeMinister === 'player', inMajority: seat && playerInMajority(parliament), secretary: isSecretary(ctx.game.party), president: Boolean(flags.president)
  });
}
export function situation(ctx, env = {}) {
  const parliament = ctx.parliament;
  const seat = Boolean(parliament?.player?.groupId);
  const governing = ['active', 'crisis'].includes(parliament?.government?.status);
  // Who the player is right now: level, open offices, territory and the weight of the party.
  const level = env.career?.currentLevel ?? env.career?.initialLevel ?? null;
  const titles = (env.offices ?? []).filter(item => !item.endDate && item.politicianId && item.politicianId === env.player?.id).map(item => String(item.title ?? '').toLocaleLowerCase('it-IT'));
  const region = ctx.game.place?.region ?? null;
  const share = Number.isFinite(env.pollShare) ? env.pollShare : null;
  const remembered = memoryBalance(ctx.game, { region });
  // The offices the player holds in the institutions (council, province, region, European Parliament): the council the
  // player sits in tells who the player is, better than the title of an office record.
  const office = localOffices(env.institutions ?? []);
  // Every office held (councils, seat, group lead, Government, party, Quirinale): events and powers read it from here.
  const held = holdingsOf(ctx, env);
  // The local leaders of the party in the player's territory: how far it is held, who follows, who is against, who is on his way out.
  const control = ctx.game.party?.org?.committees?.length ? territorialControl(ctx.game.party, { region }) : null;
  const cadres = (ctx.game.party?.life?.cadres ?? []).filter(item => item.status !== 'uscito' && !item.player);
  return {
    role: {
      level, local: level === 'comunale' || Boolean(office.comune) || titles.some(title => /sindac|consiglier[ea] comunale|assessor/.test(title)),
      mayor: office.comune === 'sindaco' || titles.some(title => title.includes('sindac')), regional: level === 'regionale' || Boolean(office.regione) || titles.some(title => /regional/.test(title)),
      parliamentarian: seat, provincial: Boolean(office.provincia), europarl: Boolean(office.europa), assessor: held.some(id => id.startsWith('assessore')), head: held.some(id => ['sindaco', 'presidente-provincia', 'presidente-regione'].includes(id)),
      groupLeader: held.includes('capogruppo') || held.includes('capogruppo-consiliare'), deputyPremier: held.includes('vicepremier')
    },
    office, holds: id => held.includes(id), held,
    // The reputations and the sectors of influence (standing-engine): events and promotions read them.
    standing: standingOf({ game: ctx.game, stats: ctx.stats, parliament }), sector: id => sectorValue(ctx.game.standing, id),
    territory: control ? { control: control.index, count: control.count, withYou: control.byStance.tuo + control.byStance['con-te'], distant: control.byStance.distante, against: control.byStance.contro, critical: cadres.filter(item => item.status !== 'attivo').length, ambitious: cadres.filter(item => item.ambition >= 60 && item.loyalty >= 55 && item.status === 'attivo').length } : null,
    // The services of the player's own region (0–100), when the world signals carry them: the territory the player answers for.
    home: (env.signals?.regions ?? []).find(item => item.name === region)?.indicators ?? null,
    macroArea: macroAreaOf(region), south: ['sud', 'isole'].includes(macroAreaOf(region)), north: ['nord-ovest', 'nord-est'].includes(macroAreaOf(region)),
    partyShare: share, partySmall: share !== null && share < 4, partyBig: share !== null && share >= 15, pollDelta: env.pollDelta ?? 0, pollTrend: env.pollTrend ?? 0,
    partyAxis: env.signals?.partyAxis ?? null, difficulty: difficultyId(ctx.game.difficulty),
    game: ctx.game, stats: ctx.stats, seat, governing,
    inMajority: seat && playerInMajority(parliament),
    minister: (governing && activeMinisters(parliament.government).some(item => item.playerAppointed)) || Boolean(ctx.game.flags?.scenarioOffice),
    party: Boolean(ctx.game.party), member: ctx.game.party?.affiliation === 'member',
    direzione: ctx.game.party?.affiliation === 'member' && ctx.game.party.rank >= 3,
    secretary: isSecretary(ctx.game.party),
    premier: governing && parliament?.government?.primeMinister === 'player',
    campaignActive: env.campaign?.status === 'active',
    // The President of the Republic is an office apart: no party, no seat, the activities of the Quirinale.
    president: Boolean(ctx.game.flags?.president),
    // What the rest of the world looks like this week: events depend on it.
    memory: remembered,
    signals: {
      crime: 45, spread: 130, euStatus: 'regolare', cohesion: ctx.game.party?.org?.cohesion ?? 60,
      hostileCurrents: (ctx.game.party?.currents ?? []).filter(item => (item.value ?? item.relation ?? 50) < 35).length,
      ministers: 0, majorityMood: 60, memoryPressure: remembered.bad, positiveMemory: remembered.good,
      memoryNet: remembered.net, pendingPressure: (ctx.game.pending ?? []).length,
      decisionCount: (ctx.game.memory ?? []).length,
      memoryKinds: [...new Set((ctx.game.memory ?? []).slice(0, 12).map(item => item.kind).filter(Boolean))],
      ...(env.signals ?? {})
    }
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
  const currents = normalizeCurrentProfiles(CURRENT_TEMPLATES.map((item, index) => ({ ...item, strength: shares[order[index]], value: 50, relation: 50, source: SIM })), { seed, week: context.week ?? 1 });
  const leader = [...currents].sort((a, b) => b.strength - a.strength)[0];
  const founder = Boolean(party.founder);
  const state = {
    partyId: party.id, label: party.label ?? null, affiliation: founder ? 'founder' : 'member',
    rank: founder ? FOUNDER_RANK.level : 0, rankTitle: founder ? FOUNDER_RANK.title : PARTY_RANKS[0].title,
    support: founder ? 70 : 50, currents, leaderCurrentId: leader.id, alignedCurrentId: null,
    leadershipContestWeek: null, lastRankContestWeek: null, joinedAt: party.joinedAt ?? null, history: [], source: SIM,
    org: createOrganization({ rand: seeded(seed ^ 0x5bd1e995), founder, region: context.region ?? null, share: context.share ?? null, week: context.week ?? 1, date: context.date ?? null })
  };
  // Its internal life (people behind the currents, requests, agreements, local leaders) starts with the party.
  state.life = createLife(state, { seed, week: context.week ?? 1 });
  return state;
}
// National votes follow the real calendar: the general election at the natural end of the legislature (or early),
// the European elections in 2029 and then every five years. The candidacy window opens a campaign before the vote.
function nationalElectionDate(game, type, today) {
  const model = ELECTION_MODELS[type];
  const earliest = advanceDays(today, 7 + model.campaignDays);
  const planned = type === 'politiche' ? legislatureTerm(game.legislature ?? REAL_LEGISLATURE).plannedVote : europeanElectionDate(today);
  return planned >= earliest ? planned : earliest;
}
// ---------- the calendar of local votes (dates: time.js) ----------
// The last local and regional vote of the player's place: the real ones (local-elections.json) when documented,
// otherwise a year of the game drawn from the comune (declared as simulated).
export function localCalendarOf(calendar, { municipalityCode = null, region = null, seed = 'comune', provinceCode = null } = {}) {
  const municipal = municipalityCode ? Object.entries(calendar?.municipalities ?? {}).find(([, codes]) => codes.includes(municipalityCode))?.[0] ?? null : null;
  const regional = calendar?.regions?.find(item => item.region === region)?.lastElection ?? null;
  return {
    comunale: municipal ?? `${2021 + hash(`${seed}|comunali`) % 5}-05-30`, comunaleReal: Boolean(municipal),
    regionale: regional ?? `${2021 + hash(`${region}|regionali`) % 5}-06-01`, regionaleReal: Boolean(regional),
    // The provincial votes have no real calendar in the data: a year of the game drawn from the province (simulated).
    provinciale: `${2021 + hash(`${provinceCode ?? seed}|provinciali`) % 4}-11-28`, provincialeReal: false
  };
}
function makeLocalElection(type, lastDate, today, place = {}, real = false) {
  const after = advanceDays(today, 7 + ELECTION_MODELS[type].campaignDays);
  const electionDate = type === 'comunale' ? nextMunicipalVote(lastDate, after) : type === 'provinciale' ? nextProvincialVote(lastDate, after) : nextRegionalVote(lastDate, after);
  return { ...makeElection(type, advanceDays(electionDate, -ELECTION_MODELS[type].campaignDays), place), electionDate, calendar: real ? 'reale' : 'simulato', lastVote: lastDate };
}
// A council dissolved (a motion of no confidence): the comune votes in the next spring round, a region within ten weeks.
export function scheduleEarlyLocalElection(input, type, date) {
  const game = copy(input);
  const entry = game.elections.find(item => item.type === type && item.status === 'upcoming');
  if (!entry) return input;
  const earliest = advanceDays(date, 70);
  let year = Number(date.slice(0, 4));
  while (sundayOnOrBefore(`${year}-05-31`) <= earliest) year++;
  const electionDate = type === 'comunale' ? sundayOnOrBefore(`${year}-05-31`) : sundayOnOrBefore(earliest);
  if (electionDate >= entry.electionDate) return input;
  Object.assign(entry, { ...makeElection(type, advanceDays(electionDate, -ELECTION_MODELS[type].campaignDays), game.place, true), id: entry.id, electionDate, calendar: entry.calendar ?? 'simulato', early: true });
  return game;
}
// Upcoming local votes of a career moved to the calendar of its place (a save made before the calendar existed).
export function alignLocalCalendar(input, local, today) {
  const game = copy(input);
  if (!local || game.flags?.localCalendar === 1) return input;
  game.elections = game.elections.map(entry => ['comunale', 'regionale'].includes(entry.type) && entry.status === 'upcoming' && !entry.early
    ? { ...makeLocalElection(entry.type, local[entry.type], today, game.place ?? {}, local[`${entry.type}Real`]), id: entry.id }
    : entry);
  game.flags = { ...(game.flags ?? {}), localCalendar: 1 };
  if (game.rounds) planRounds(game, today);
  return game;
}
// A career made before the provincial level, in a place that has a province with organs of its own: the province enters
// the place and its next vote the calendar (the provincial votes have no real calendar: they are simulated).
export function addProvincialCalendar(input, place = {}, calendar = null, today = null) {
  if (input.flags?.provincialCalendar === 1) return input;
  const game = copy(input);
  game.flags = { ...(game.flags ?? {}), provincialCalendar: 1 };
  if (!hasProvincialLevel(place)) return game;
  game.place = { ...(game.place ?? {}), province: place.provinceName ?? place.province ?? null, provinceCode: place.provinceCode ?? null, provinceType: place.provinceType ?? null };
  if (!game.elections.some(item => item.type === 'provinciale')) {
    const last = calendar?.provinciale ?? localCalendarOf(null, { region: place.region, seed: place.municipality, provinceCode: place.provinceCode }).provinciale;
    game.elections.push(makeLocalElection('provinciale', last, today ?? game.week?.startedAt, game.place, false));
    game.elections.sort((a, b) => a.electionDate.localeCompare(b.electionDate));
  }
  return game;
}
function makeNationalElection(type, electionDate, place = {}, early = false) {
  const entry = makeElection(type, advanceDays(electionDate, -ELECTION_MODELS[type].campaignDays), place, early);
  return { ...entry, electionDate, calendar: 'nazionale' };
}
function makeElection(type, windowOpensAt, place = {}, early = false) {
  const model = ELECTION_MODELS[type];
  const labels = { comunale: `Comunali · ${place.municipality || 'il tuo comune'}`, provinciale: `Provinciali · ${place.province || 'la tua provincia'}`, regionale: `Regionali · ${place.region || 'la tua regione'}`, politiche: early ? 'Politiche anticipate' : 'Elezioni politiche', europee: 'Elezioni europee' };
  return {
    id: `elezione-${type}-${windowOpensAt}`, type, label: labels[type], windowOpensAt,
    windowClosesAt: advanceDays(windowOpensAt, ELECTION_SCHEDULE[type].windowDays), electionDate: advanceDays(windowOpensAt, model.campaignDays),
    status: 'upcoming', campaignId: null, early, source: SIM
  };
}

export function createGameState({ seedText, currentDate, level, party = null, place = {}, stats = {}, parliament = null, funds = null, difficulty = 'normale', localCalendar = null, start = null }) {
  const seed = hash(seedText);
  const member = party?.id && !party.founder;
  const setting = difficultyOf(difficulty);
  const relations = RELATION_TEMPLATES.filter(item => item.requires !== 'member' || member).map(item => ({
    id: item.id, label: item.id === 'rival' ? SIMULATED_RIVAL_LABEL : item.label,
    kind: item.kind, value: clamp(item.base + (item.id === 'rival' ? -setting.relationStart : setting.relationStart)), source: SIM
  }));
  // National votes on the real national calendar, local votes on the calendar of the player's comune and region.
  // The provincial vote exists where the province has organs of its own (see hasProvincialLevel).
  const elections = Object.keys(ELECTION_SCHEDULE).filter(type => type !== 'provinciale' || hasProvincialLevel(place)).map(type => ['politiche', 'europee'].includes(type)
    ? makeNationalElection(type, nationalElectionDate({ legislature: REAL_LEGISLATURE }, type, currentDate), place)
    : localCalendar ? makeLocalElection(type, localCalendar[type], currentDate, place, localCalendar[`${type}Real`])
    : makeElection(type, advanceDays(currentDate, 7 * (LEVEL_FIRST_ELECTION[level]?.[type] ?? ELECTION_SCHEDULE[type].firstWeeks)), place));
  // What the level (a council, a province, a region, the Chambers, Strasbourg) and the way of belonging start with.
  const scenario = scenarioOf({ level, affiliation: affiliationOf(party) });
  const startingFunds = Math.round((funds ?? ({ comunale: 1500, provinciale: 2000, regionale: 2500, deputato: 4000, senatore: 4000, europeo: 4000 }[level] ?? 2000)) * setting.funds * startFundsFactor(start?.levels) * scenario.fundsFactor);
  const game = {
    version: 1, source: SIM, status: 'active', seed, rngState: seed, place, difficulty: difficultyId(difficulty),
    week: { index: 1, startedAt: currentDate, ap: WEEKLY_ACTION_POINTS, maxAp: WEEKLY_ACTION_POINTS, categoriesUsed: [] },
    resources: { funds: startingFunds, politicalCapital: clamp(Math.round((parliament?.resources?.politicalCapital ?? stats.influence ?? 30) + setting.capital), 0, 100), source: SIM },
    prep: 0, relations, party: createPartyState(party, seed, { region: place.region, share: party?.share ?? null, week: 1, date: currentDate }), pastParties: [], elections,
    inbox: [], log: [], objectives: {}, flags: { nationalCalendar: 2, provincialCalendar: 1, ...(localCalendar ? { localCalendar: 1 } : {}) }, lastReport: null, weekStartStats: { ...stats }, lastEventId: null,
    fallenWeeks: 0, endedAt: null, endReason: null, objectivesV: 2,
    finance: createFinance({ week: 1, date: currentDate, funds: startingFunds }), contacts: [], promises: [], rivalRegistry: [], endorsers: [], legislature: { ...REAL_LEGISLATURE },
    roundsFrom: currentDate, rounds: [], standing: createStanding({ week: 1 })
  };
  planRounds(game, currentDate);
  // The scenario of the level and of the way of belonging, then the conditions the player chose on top of it (outsider, debts, a divided
  // party, a consolidated career…).
  scenarioInit(game, scenario, lifeApi());
  if (hasStart(start)) startInit(game, start, lifeApi());
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
  const party = game.party ? { ...game.party, currents: normalizeCurrentProfiles(game.party.currents ?? [], { seed: game.seed, week }), ...(game.party.affiliation === 'founder' ? { rank: FOUNDER_RANK.level } : {}), org: normalizeOrganization(game.party.org, { rand: seeded(hash(`${game.seed}|${game.party.partyId}|org`)), founder: game.party.affiliation === 'founder', region: game.place?.region ?? null, week, date }), ...(game.party.life ? { life: copy(game.party.life) } : {}) } : game.party ?? null;
  // Saves from before the internal life: the people behind the currents and the rest are born from the state they have.
  if (party) normalizeLife(party, { seed: hash(`${game.seed}|${party.partyId}|life`), week });
  // The career never closes: a save that had ended resumes, with the fall kept on record.
  // A career the player concluded (retirement) stays concluded; a fall (the old ending) resumes.
  const revived = game.status === 'ended' && !game.endKind ? { status: 'active', endedAt: null, endReason: null, setbacks: [...(game.setbacks ?? []), { week, date: game.endedAt ?? date, reason: game.endReason ?? 'Crisi di reputazione', source: SIM }] } : {};
  return alignNationalCalendar({
    status: 'active', prep: 0, pastParties: [], inbox: [], log: [], objectives: {}, flags: {}, lastReport: null, lastEventId: null, fallenWeeks: 0, place: {},
    contacts: [], promises: [], rivalRegistry: [], endorsers: [], pending: [], eventQueue: [], eventHistory: {}, eventRecent: [], memory: [], legislature: { ...REAL_LEGISLATURE }, difficulty: 'normale', setbacks: [],
    ...game, ...revived, party,
    standing: normalizeStanding(game.standing, { week }),
    finance: normalizeFinance(game.finance, { week, date, funds: game.resources?.funds ?? 0 }),
    week: { ap: WEEKLY_ACTION_POINTS, maxAp: WEEKLY_ACTION_POINTS, categoriesUsed: [], ...(game.week ?? {}) },
    resources: { funds: 0, politicalCapital: 30, source: SIM, ...(game.resources ?? {}) },
    // Older saves named the rival with a realistic invented name: it becomes an explicit simulated role.
    relations: Array.isArray(game.relations) ? game.relations.map(item => item.id === 'rival' && LEGACY_RIVAL_NAMES.includes(item.label) ? { ...item, label: SIMULATED_RIVAL_LABEL } : item) : [],
    elections: Array.isArray(game.elections) ? game.elections : [],
    // Pending chains were introduced after the first saves. Normalize their metadata
    // without changing their timing or effects, so old careers gain causal history lazily.
    pending: (Array.isArray(game.pending) ? game.pending : []).map((item, index) => ({
      ...item, id: item.id ?? `seguito-${week}-${index}`, causes: [...new Set([...(item.causes ?? []), item.origin].filter(Boolean))], source: SIM
    })),
    eventQueue: (Array.isArray(game.eventQueue) ? game.eventQueue : []).map(item => ({ ...item, causes: [...new Set([...(item.causes ?? []), item.from].filter(Boolean))], source: SIM }))
  });
}
// Saves made with the accelerated national calendar: the general and European elections still ahead move to the real
// calendar (end of the legislature, European elections of 2029 and every five years). Local votes keep their cycle.
function alignNationalCalendar(game) {
  if (game.flags?.nationalCalendar === 2) return game;
  const today = game.week?.startedAt;
  if (!today) return game;
  const legislature = { ...REAL_LEGISLATURE, ...(game.legislature ?? {}), firstSitting: game.legislature?.firstSitting ?? (game.legislature?.since ? advanceDays(game.legislature.since, LEGISLATURE_RULES.firstSittingDays) : REAL_LEGISLATURE.firstSitting) };
  const elections = game.elections.map(entry => {
    if (!['politiche', 'europee'].includes(entry.type) || entry.status !== 'upcoming' || entry.early) return entry;
    return { ...makeNationalElection(entry.type, nationalElectionDate({ legislature }, entry.type, today), game.place ?? {}), id: entry.id };
  });
  return { ...game, legislature, elections, flags: { ...(game.flags ?? {}), nationalCalendar: 2 } };
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
// What the internal life of the party borrows from the career: memory, relations and the treasury.
function lifeApi() {
  return {
    date: null,
    remember: (game, entry) => remember(game, entry),
    memoryAbout: (game, subject, tone) => memoryAbout(game, subject, tone),
    changeRelation: (game, id, delta) => changeRelation(game, id, delta),
    book: (game, org, amount, category, label) => treasuryBook(org, amount, category, label),
    createParty: (record, seed, context) => createPartyState(record, seed, context)
  };
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
  ...LIFE_MEMORY_KINDS,
  'promessa-mantenuta': { label: 'Promessa mantenuta', tone: 'good' }, 'promessa-tradita': { label: 'Promessa tradita', tone: 'bad' },
  legge: { label: 'Legge o provvedimento', tone: 'good' }, tasse: { label: 'Nuove tasse', tone: 'bad' }, tagli: { label: 'Tagli', tone: 'bad' },
  'decreto-decaduto': { label: 'Decreto decaduto', tone: 'bad' }, 'governo-caduto': { label: 'Governo caduto', tone: 'bad' }, 'crisi-aperta': { label: 'Crisi aperta', tone: 'bad' },
  'alleanza-rotta': { label: 'Alleanza rotta', tone: 'bad' }, 'alleato-tradito': { label: 'Alleato scontentato', tone: 'bad' }, 'cambio-partito': { label: 'Cambio di partito', tone: 'bad' },
  scandalo: { label: 'Scandalo', tone: 'bad' }, epurazione: { label: 'Espulsioni nel partito', tone: 'bad' }, 'esercizio-provvisorio': { label: 'Esercizio provvisorio', tone: 'bad' },
  'procedura-ue': { label: 'Procedura europea', tone: 'bad' }, elezione: { label: 'Risultato elettorale', tone: 'neutral' }, lealta: { label: 'Lealtà dimostrata', tone: 'good' }, emergenza: { label: 'Emergenza gestita', tone: 'neutral' },
  voto: { label: 'Voto in Aula', tone: 'neutral' }, dissenso: { label: 'Voto in dissenso dal gruppo', tone: 'neutral' }, alleanza: { label: 'Alleanza stretta', tone: 'good' }, 'crisi-governo': { label: 'Crisi di governo', tone: 'bad' },
  'vittoria-elettorale': { label: 'Vittoria elettorale', tone: 'good' }, 'sconfitta-elettorale': { label: 'Sconfitta elettorale', tone: 'bad' }, decisione: { label: 'Decisione importante', tone: 'neutral' },
  'caduta-reputazione': { label: 'Caduta di reputazione', tone: 'bad' }, 'ritorno': { label: 'Ritorno sulla scena', tone: 'good' }
});
const currentWeight = (game, item) => (item.weight ?? 1) * Math.pow(0.5, Math.max(0, (game?.week?.index ?? 0) - item.week) / (HALF_LIFE * rules(game).memoryFade));
export function remember(game, entry) {
  if (!game) return game;
  const item = { id: uniqueId(game.memory, `memoria-${game.week?.index ?? 0}-${(game.memory ?? []).length}-${(game.rngState ?? 1) % 9973}`), week: game.week?.index ?? 0, date: entry.date ?? null, weight: 1, tone: MEMORY_KINDS[entry.kind]?.tone ?? 'neutral', source: SIM, ...entry };
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
  let reputationDelta = 0;
  for (const [metric, given] of Object.entries(effects.stats ?? {})) {
    if (!given || !(metric in ctx.stats || STAT_LABELS[metric])) continue;
    // The level and the way of belonging set the pace at which a stat grows (a councillor is known in the neighbourhood sooner than in the country).
    const raw = given > 0 ? round2(given * scenarioGrowth(game, metric)) : given;
    // Gains shrink near the top: the last points of popularity or reputation are the hardest.
    const current = ctx.stats[metric] ?? 0;
    const delta = raw > 0 && metric !== 'consensus' && current > 55 ? round2(raw * clamp((100 - current) / 45, 0.15, 1)) : raw;
    ctx.stats[metric] = clamp(round2(current + delta));
    recordWhy(game, metric, ctx.stats[metric] - current, params.source ?? params.fundsLabel ?? 'Altre decisioni');
    lines.push(`${STAT_LABELS[metric]} ${signed(delta)}`);
    if (metric === 'reputation') reputationDelta = ctx.stats[metric] - current;
  }
  // The four reputations and the sectors of influence follow the decision: its explicit changes and the share of the general
  // reputation that belongs to its kind.
  if (reputationDelta || effects.standing || effects.sector) lines.push(...applyStandingEffects(game, effects, { category: params.category ?? null, reputationDelta, cause: params.source ?? params.fundsLabel ?? null }));
  if (effects.fundsFrom) {
    const amount = Math.max(effects.fundsFrom.min ?? 0, Math.round((ctx.stats[effects.fundsFrom.stat] ?? 0) * effects.fundsFrom.factor));
    book(game, amount, 'donazioni', params.fundsLabel ?? null, params.date ?? null);
    lines.push(`Fondi +${amount} €`);
  }
  if (effects.funds) { book(game, effects.funds, effects.funds > 0 ? 'donazioni' : 'altro', params.fundsLabel ?? null, params.date ?? null); lines.push(`Fondi ${effects.funds > 0 ? '+' : '−'}${Math.abs(effects.funds)} €`); }
  if (effects.capital) { game.resources.politicalCapital = clamp(game.resources.politicalCapital + effects.capital); lines.push(`Capitale politico ${signed(effects.capital)}`); }
  if (effects.prep) { game.prep = clamp(game.prep + effects.prep); lines.push(`Preparazione elettorale ${signed(effects.prep)}`); }
  for (const [key, delta] of Object.entries(effects.permanent ?? {})) {
    if (!Number.isFinite(delta) || !delta) continue;
    game.permanentEffects ??= {};
    game.permanentEffects[key] = round2((game.permanentEffects[key] ?? 0) + delta);
    lines.push(`${key} permanente ${signed(delta)}`);
  }
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
function mergeEffects(base = {}, extra = {}) {
  const merged = { ...base, ...extra };
  for (const key of ['stats', 'relations', 'permanent', 'contacts', 'groups']) {
    if (base[key] || extra[key]) merged[key] = { ...(base[key] ?? {}), ...(extra[key] ?? {}) };
    for (const [name, value] of Object.entries(merged[key] ?? {})) {
      if (Number.isFinite(base[key]?.[name]) && Number.isFinite(extra[key]?.[name])) merged[key][name] = round2(base[key][name] + extra[key][name]);
    }
  }
  for (const key of ['party', 'org', 'government']) {
    if (base[key] || extra[key]) merged[key] = { ...(base[key] ?? {}), ...(extra[key] ?? {}) };
    for (const [name, value] of Object.entries(merged[key] ?? {})) {
      if (Number.isFinite(base[key]?.[name]) && Number.isFinite(extra[key]?.[name])) merged[key][name] = round2(base[key][name] + extra[key][name]);
    }
  }
  return merged;
}
function schedule(game, later, origin) {
  if (!later || !Number.isFinite(later.weeks)) return;
  const dueWeek = game.week.index + later.weeks;
  const causes = [...new Set([origin, ...(later.causes ?? [])].filter(Boolean))];
  const mergeKey = later.mergeKey ?? `${dueWeek}|${later.label ?? origin}`;
  const existing = (game.pending ?? []).find(item => item.mergeKey === mergeKey);
  if (existing) {
    existing.causes = [...new Set([...(existing.causes ?? []), ...causes])];
    existing.effects = mergeEffects(existing.effects ?? {}, later.effects ?? {});
    existing.weight = round2((existing.weight ?? 1) + (later.weight ?? 1));
    existing.origin = existing.origin ?? origin;
    return existing;
  }
  const item = { id: uniqueId(game.pending, `seguito-${game.week.index}-${(game.pending ?? []).length}-${game.rngState % 9973}`), dueWeek, madeWeek: game.week.index, hint: later.hint ?? later.label ?? 'Esito in arrivo', label: later.label ?? 'Esito', chance: later.chance ?? 1, effects: later.effects ?? null, outcomes: later.outcomes ?? null, memory: later.memory ?? null, origin, causes, mergeKey, cascade: later.cascade ?? null, source: SIM };
  game.pending = [...(game.pending ?? []), item];
  return item;
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
      if (outcome.memory) remember(game, { date, ...outcome.memory, text: fill(outcome.memory.text ?? '', { memory: item.origin }) });
      schedule(game, outcome.later, `${item.origin} → ${outcome.label}`);
      tone = Object.values(outcome.effects?.stats ?? {}).some(value => value < 0) ? 'bad' : 'good';
    } else if (draw(game) < item.chance) {
      applyEffects(ctx, item.effects, null, itemLines, { date, source: item.origin });
      if (item.memory) remember(game, { date, ...item.memory });
      tone = 'bad';
    } else {
      title = `Scampato: ${item.hint.charAt(0).toLowerCase()}${item.hint.slice(1)}`;
      tone = 'good';
    }
    const causeLabel = (item.causes ?? []).length > 1 ? ` (${item.causes.length} cause collegate)` : '';
    lines.push(`Conseguenza di “${item.origin}”${causeLabel}: ${title}`);
    addLog(game, date, 'conseguenza', title, [`Da: ${item.origin}`, ...itemLines], tone);
    if (item.cascade) schedule(game, item.cascade, `${item.origin} → ${title}`);
  }
  game.pending = (game.pending ?? []).filter(entry => entry.dueWeek > game.week.index);
}
function addLog(game, date, kind, title, lines = [], tone = 'neutral') {
  game.log.unshift({ id: uniqueId(game.log, `diario-${game.week.index}-${game.log.length}-${game.rngState % 9973}`), week: game.week.index, date, kind, title, lines, tone, source: SIM });
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
  if (sit.president) return 'Da Presidente della Repubblica non fai attività di parte: usa le attività del Quirinale (sezione Elezioni → Quirinale).';
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
  // The ledger of what the player does: the goals of the career are measured on it.
  bump(ctx.game, 'activities', activity.category); bump(ctx.game, 'activityIds', activity.id);
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

// The reserve of emergency: money kept apart for the unexpected (and for a debt), taken back when it is not needed.
export function saveReserve(input, env, amount) {
  const ctx = start(input);
  const reserve = depositReserve(ctx.game, amount, env.currentDate);
  addLog(ctx.game, env.currentDate, 'finanze', `Riserva di emergenza: ${reserve} € accantonati`, ['Copre gli imprevisti e il debito prima che pesino sulla cassa.'], 'neutral');
  return { ctx, reserve };
}
export function takeReserve(input, env, amount) {
  const ctx = start(input);
  const reserve = releaseReserve(ctx.game, amount, env.currentDate);
  addLog(ctx.game, env.currentDate, 'finanze', `Prelievo dalla riserva: restano ${reserve} €`, [], 'neutral');
  return { ctx, reserve };
}

// ---------- inbox ----------
function fill(text, params = {}) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
}
function templateFor(item) {
  if (item.kind === 'appuntamento') return APPOINTMENTS.find(entry => entry.id === item.templateId);
  if (item.kind === 'urgente') return FORCED_EVENTS[item.templateId];
  if (item.kind === 'situazione') return SITUATIONS[item.templateId];
  return EVENT_POOL.find(entry => entry.id === item.templateId);
}
// What happens to a decision nobody took: its default choice, which must cost nothing and ask for nothing (an unpaid choice
// with a cost would hand its benefits to whoever did not decide); when the declared default is not free, the closest free
// choice, and when no choice is free the decision lapses with no effect. The agenda shows the same choice the week runs.
const isFree = choice => !choice?.cost || !Object.values(choice.cost).some(Boolean);
const freeDefault = (choices, id) => {
  const declared = choices.find(entry => entry.id === id);
  return declared && isFree(declared) && !declared.requires ? declared : [...choices].reverse().find(entry => isFree(entry) && !entry.requires);
};
function instantiate(template, kind, ctx, params) {
  // Two decisions of the same kind in the same week (two votes, two allies' demands) keep distinct ids.
  const base = `agenda-${ctx.game.week.index}-${template.id}-${ctx.game.rngState % 100000}`;
  const taken = new Set((ctx.game.inbox ?? []).map(item => item.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  // The day of the week an appointment or event falls on (0 = Monday): a preference of the event (`days`), never a
  // condition, drawn from a hash of the week without using the career's random sequence. Decisions of the situation
  // (and urgent ones) have no day: they are due this week.
  const day = kind === 'appuntamento' || kind === 'evento' || template.days
    ? eventDay(template.days, (hash(`${base}|day`) % 10007) / 10007, AGENDA_CAPS.dayBase, (ctx.game.inbox ?? []).filter(item => item.week === ctx.game.week.index).map(item => item.day).filter(Number.isInteger))
    : null;
  return {
    id, kind, templateId: template.id, ...(day !== null ? { day } : {}),
    title: fill(template.title, params), body: fill(template.body, params), params,
    choices: template.choices.map(choice => ({ id: choice.id, label: fill(choice.label, params), cost: choice.cost ?? null, requires: typeof choice.requires === 'string' ? choice.requires : null })),
    defaultChoice: freeDefault(template.choices, template.defaultChoice ?? template.choices.at(-1).id)?.id ?? template.defaultChoice ?? template.choices.at(-1).id, week: ctx.game.week.index, source: SIM
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
  if (ctx.game.flags?.president || ctx.game.inbox.some(item => item.templateId === id)) return;
  ctx.game.inbox.unshift(instantiate(FORCED_EVENTS[id], 'urgente', ctx, eventParams(ctx)));
}
// Situation events carry their own parameters (territory, conflict, person, law).
function raiseSituation(ctx, id, params = {}, urgent = false) {
  const game = ctx.game;
  if (game.status === 'ended' || game.inbox.some(item => item.templateId === id && (!params.dedupe || item.params?.dedupe === params.dedupe))) return null;
  if (!SITUATIONS[id]) return null;
  // The President of the Republic decides only what the Quirinale puts on the desk (the election, the consultations, the acts of the office).
  if (game.flags?.president && !/^(quirinale|presidente)-/.test(id)) return null;
  const item = instantiate(SITUATIONS[id], 'situazione', ctx, { ...eventParams(ctx), ...params });
  if (urgent) game.inbox.unshift(item); else game.inbox.push(item);
  return item;
}
export function addSituationEvent(input, id, params = {}, urgent = false, { holdWeeks = 0, holdUntil = null } = {}) {
  const game = copy(input);
  const item = raiseSituation({ game }, id, params, urgent);
  // Raised while weeks are being closed (after a vote): it stays in the agenda until the given date or week.
  if (item && holdWeeks) item.holdUntilWeek = (game.week?.index ?? 0) + holdWeeks;
  if (item && holdUntil) item.holdUntilDate = holdUntil;
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
  const memory = memoryBalance(ctx.game, { region: ctx.game.place?.region ?? null });
  params.memory = env.signals?.memoryRecall ?? memory.highlights[0]?.text ?? '';
  params.memoryNet = memory.net;
  params.pendingCount = (ctx.game.pending ?? []).length;
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
  // Keep a short semantic history in addition to per-template cooldowns: different
  // events in the same category should not crowd out the rest of the story.
  game.eventRecent = [{ id: template.id, category: template.category ?? null, family: template.family ?? null, week: game.week.index }, ...(game.eventRecent ?? []).filter(entry => entry.id !== template.id)].slice(0, 10);
  game.lastEventId = template.id;
  if (template.family) game.eventFamilies = { ...(game.eventFamilies ?? {}), [template.family]: game.week.index };
  // Some events change the world as soon as they happen, whatever the player decides.
  if (template.onRaise?.shock) specials.push({ type: 'society-shock', shock: Object.fromEntries(Object.entries(template.onRaise.shock).map(([key, value]) => [key, fillText(value, params)])) });
  if (template.onRaise?.emergency) game.flags.emergencies = { ...(game.flags.emergencies ?? {}), [template.onRaise.emergency]: game.week.index };
  lines.push(`Nuova decisione: ${item.title}`);
  return item;
}
function fillInbox(ctx, env, lines, specials = []) {
  const game = ctx.game;
  const sit = situation(ctx, env);
  // The President of the Republic has no appointments of a politician: the Quirinale raises its own decisions.
  if (sit.president) { game.lastAppointmentIds = []; game.eventQueue = []; return; }
  const params = eventParams(ctx);
  const recent = game.lastAppointmentIds ?? [];
  const appointments = APPOINTMENTS.filter(item => meets(item.when, sit) && !recent.includes(item.id));
  const picked = [];
  for (let count = 0; count < AGENDA_CAPS.appointments && appointments.length; count++) {
    // Not every week brings an invitation: the appointment comes with some chance, not by calendar.
    if (draw(game) >= AGENDA_CAPS.chances.appointment) break;
    const [item] = appointments.splice(Math.floor(draw(game) * appointments.length), 1);
    picked.push(item.id);
    game.inbox.push(instantiate(item, 'appuntamento', ctx, params));
  }
  game.lastAppointmentIds = picked;
  // Chained events come due first, if their conditions still hold.
  for (const queued of (game.eventQueue ?? []).filter(entry => entry.dueWeek <= game.week.index)) {
    const template = EVENT_POOL.find(entry => entry.id === queued.id);
    const since = game.week.index - ((game.eventHistory ?? {})[queued.id] ?? -999);
    if (template && since >= Math.min(template.cooldown ?? 8, 4) && meets(template.when, sit) && !game.inbox.some(item => item.templateId === template.id)) { const chained = raiseEvent(ctx, template, { ...eventParamsFor(template, ctx, env), ...(queued.params ?? {}) }, specials, lines); if (chained) chained.chain = true; }
  }
  game.eventQueue = (game.eventQueue ?? []).filter(entry => entry.dueWeek > game.week.index);
  drawEvents(ctx, env, sit, params, lines, specials);
}
// The cap on the events that the draws add: ordinary ones use a slot, crises and scandals have their own small limit.
const isImportant = event => AGENDA_CAPS.importantCategories.includes(event.category) || event.exclusive === 'emergenza';
const fitsBudget = (budget, event) => !budget.categories.has(event.category) && (isImportant(event) ? budget.important > 0 : budget.ordinary > 0);
function spendBudget(budget, event) {
  if (isImportant(event)) budget.important -= 1; else budget.ordinary -= 1;
  if (event.category) budget.categories.add(event.category);
}
// The events of the week, drawn from what the situation makes possible (never from the weekday). First the catalogue is
// narrowed by the situation: the condition of each event, its cooldown, its family (a factory in crisis, a protest, a
// scandal of a kind do not come twice in a row), what is already on the desk. Then probability: the weight of each event
// (its own, the situation's boost, the difficulty, the story of the last weeks, the political memory); the important ones
// (crises, emergencies, scandals) are drawn on their own, so that the ordinary events never crowd them out, and the quiet
// days only fill a week that would otherwise be empty.
function drawEvents(ctx, env, sit, params, lines, specials) {
  const game = ctx.game;
  const caps = AGENDA_CAPS;
  const history = game.eventHistory ?? {};
  const setting = rules(game);
  const open = new Set(game.inbox.map(item => item.templateId));
  const openExclusive = new Set(game.inbox.map(item => EVENT_POOL.find(entry => entry.id === item.templateId)?.exclusive).filter(Boolean));
  const recentCategories = new Map();
  for (const entry of game.eventRecent ?? []) if (entry.category) recentCategories.set(entry.category, (recentCategories.get(entry.category) ?? 0) + 1);
  // The last week each family of events was raised (kept apart from the short list of recent events).
  const recentFamilies = new Map(Object.entries(game.eventFamilies ?? {}));
  const now = game.week.index;
  const eligible = EVENT_POOL.filter(item => item.weight > 0 && item.id !== game.lastEventId && meets(item.when, sit)
    && now - (history[item.id] ?? -999) >= (item.cooldown ?? 8)
    && !(item.unique && history[item.id] !== undefined)
    && !(item.exclusive && openExclusive.has(item.exclusive))
    && !(item.family && now - (recentFamilies.get(item.family) ?? -999) < caps.familyGapWeeks)
    && !open.has(item.id));
  const memoryKinds = new Set((game.memory ?? []).slice(0, 24).map(entry => entry.kind).filter(Boolean));
  const memoryBoost = item => {
    if (typeof item.memoryBoost === 'function') return item.memoryBoost(sit);
    if (Number.isFinite(item.memoryBoost)) return item.memoryBoost;
    const kinds = item.memoryKinds ?? [];
    if (!kinds.length) return 1;
    return kinds.some(kind => memoryKinds.has(kind)) ? 1.8 : 0.55;
  };
  const weigh = item => {
    const seen = recentCategories.get(item.category) ?? 0;
    const weight = item.weight
      * (typeof item.boost === 'function' ? item.boost(sit) : 1)
      * (item.rare ? 0.5 : 1)
      * (HARD_CATEGORIES.includes(item.category) ? setting.badEvents : item.positive ? setting.goodEvents : 1)
      // A recent category remains possible, but loses priority so the story keeps changing.
      * (seen >= 2 ? 0.2 : seen === 1 ? 0.5 : 1)
      * (sit.signals.memoryPressure > 2 && ['media', 'partito', 'parlamento'].includes(item.category) ? 1.45 : 1)
      * memoryBoost(item)
      * (sit.signals.pendingPressure > 2 && item.category === 'crisi' ? 1.25 : 1);
    return { item, weight };
  };
  // Tense weeks bring more events: crises, campaigns, a government in trouble.
  const tension = (sit.signals.stability ?? 60) < 35 || sit.campaignActive || sit.signals.euStatus === 'procedura' ? 0.2 : 0;
  const budget = { ordinary: tension ? caps.tenseEvents : caps.events, important: caps.important, categories: new Set() };
  // Two events of the same family do not come in the same week either.
  const familyNow = new Set();
  const raise = event => { raiseEvent(ctx, event, eventParamsFor(event, ctx, env), specials, lines); spendBudget(budget, event); if (event.family) familyNow.add(event.family); };
  const rows = pool => pool.map(weigh).filter(row => row.weight > 0 && fitsBudget(budget, row.item) && !(row.item.family && familyNow.has(row.item.family)));
  // The important ones, on their own: a crisis, an emergency or a scandal when the situation makes one possible.
  const importantPool = eligible.filter(isImportant);
  if (budget.important > 0 && draw(game) < caps.chances.important + tension) {
    const chosen = pickWeighted(rows(importantPool), draw(game));
    if (chosen) raise(chosen.item);
  }
  // The ordinary ones: the first, then (if it came) a second; a desk already full of decisions takes none.
  const ordinaryPool = eligible.filter(item => !isImportant(item) && item.category !== 'quiete');
  let raised = 0;
  if (game.inbox.length < caps.deskLimit) {
    for (let slot = 0; slot < budget.ordinary + raised && slot < 3; slot++) {
      if (draw(game) >= (slot === 0 ? caps.chances.first : caps.chances.second) + tension) break;
      const chosen = pickWeighted(rows(ordinaryPool.filter(item => !open.has(item.id))), draw(game));
      if (!chosen) break;
      open.add(chosen.item.id);
      raise(chosen.item);
      raised += 1;
      if (budget.ordinary <= 0) break;
    }
  }
  // A quiet day, only when nothing else was raised and the desk is nearly empty.
  if (!raised && game.inbox.length <= 1 && draw(game) < caps.chances.quiet) {
    const chosen = pickWeighted(rows(eligible.filter(item => item.category === 'quiete')), draw(game));
    if (chosen) raise(chosen.item);
  }
}
// The political world can ask the player for a position: a fact of the world that concerns the player's role lands in the
// week's agenda like any other event. It is not a decision of its own right: it comes at most every few weeks, with a
// chance that follows how much the fact concerns the player (a flood in the region is the business of whoever governs the
// region, a national scandal of those who lead or sit in Parliament), and never above the week's ordinary cap.
export function addWorldReaction(input, reaction, sit = null) {
  const game = copy(input);
  if (game.status === 'ended' || game.flags?.president || game.inbox.some(item => item.templateId === 'presa-posizione')) return game;
  const caps = AGENDA_CAPS;
  if (game.week.index - (game.lastReactionWeek ?? -99) < caps.reactionGapWeeks) return game;
  const ordinary = game.inbox.filter(item => item.kind === 'evento' && !item.chain && !caps.importantCategories.includes(item.category)).length;
  if (ordinary >= caps.events) return game;
  const relevance = sit ? reactionRelevance(reaction, sit) : 1;
  if (!(draw(game) < relevance)) return game;
  const template = CAREER_EVENTS.find(entry => entry.id === 'presa-posizione');
  const ctx = { game };
  game.inbox.push(instantiate(template, 'evento', ctx, { event: reaction.title, eventBody: reaction.body, scope: reaction.scope ?? 'nazionale' }));
  game.lastReactionWeek = game.week.index;
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
  if (effects.local?.stability) parts.push(`Stabilità dell’esecutivo locale ${signed(effects.local.stability)}`);
  if (effects.local?.pressure) parts.push(`Pressione sull’ente ${signed(effects.local.pressure)}`);
  if (effects.local?.margin) parts.push(`Margine di bilancio ${signed(effects.local.margin)}`);
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
// What a decision does to the institution where the player sits (its executive, its pressure, its budget): a council is
// not part of the career state, so the store applies it (special `local-effect`).
const pushLocal = (effects, specials, lines) => {
  if (!effects?.local) return;
  specials.push({ type: 'local-effect', local: effects.local });
  const { stability, pressure, margin } = effects.local;
  if (stability) lines.push(`Stabilità dell’esecutivo locale ${signed(stability)}`);
  if (pressure) lines.push(`Pressione sull’ente ${signed(pressure)}`);
  if (margin) lines.push(`Margine di bilancio ${signed(margin)}`);
};
function runChoice(ctx, env, item, choice, lines, specials) {
  let tone = 'neutral';
  const params = { ...(item.params ?? {}), date: env.currentDate, fundsLabel: item.title, source: item.title, category: templateFor(item)?.category ?? null };
  applyEffects(ctx, choice.effects, item.params?.targetId ?? null, lines, params);
  // Taking on a matter of public policy (a choice that costs days, capital or money) earns influence in its sector.
  if (EVENT_SECTORS[item.templateId] && (choice.cost?.ap || choice.cost?.capital || choice.cost?.funds)) gainSector(ctx.game, EVENT_SECTORS[item.templateId], SECTOR_GAINS.engage, { cause: item.title });
  pushLocal(choice.effects, specials, lines);
  if (choice.memory) remember(ctx.game, { date: env.currentDate, ...choice.memory, text: fill(choice.memory.text, item.params) });
  if (choice.followUp && draw(ctx.game) < (choice.followUp.chance ?? 1)) ctx.game.eventQueue = [...(ctx.game.eventQueue ?? []), { id: choice.followUp.id, dueWeek: ctx.game.week.index + (choice.followUp.weeks ?? 2), params: { region2: item.params?.region2 }, from: item.templateId, causes: [item.templateId, ...(choice.followUp.causes ?? [])], source: SIM }];
  if (choice.outcomes) {
    const outcome = pickOutcome(ctx.game, choice.outcomes);
    lines.push(outcome.label);
    applyEffects(ctx, outcome.effects, null, lines, params);
    pushLocal(outcome.effects, specials, lines);
    if (outcome.memory) remember(ctx.game, { date: env.currentDate, ...outcome.memory });
    schedule(ctx.game, outcome.later, item.title);
    if (outcome.special) handleSpecial(ctx, env, outcome.special, item, lines, specials, outcome);
    tone = outcome.special || Object.values(outcome.effects?.stats ?? {}).some(value => value < -2) ? 'bad' : 'good';
  }
  if (choice.risk && draw(ctx.game) < choice.risk.chance * rules(ctx.game).riskChance) { lines.push(choice.risk.label); applyEffects(ctx, choice.risk.effects, null, lines, params); pushLocal(choice.risk.effects, specials, lines); tone = 'bad'; }
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
  bumpDecision(ctx.game, 'made'); bump(ctx.game, 'choices', `${item.templateId}.${choice.id}`);
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
const WORLD_SPECIALS = ['markets-calm', 'markets-worse', 'europe-up', 'europe-down', 'society-cost', 'minister-defend', 'minister-resign', 'budget-open', 'partner-accept', 'partner-negotiate', 'partner-refuse', 'obstruction-add', 'obstruction-clear', 'snipers',
  // The national cycle (legislature-engine): coalitions before the vote, support and mandate after it.
  'national-coalition', 'national-alone', 'national-auto', 'national-support', 'national-opposition', 'national-wait', 'national-mandate-accept', 'national-mandate-decline',
  // The player's vote on a bill of the others (lawmaking-engine).
  'law-vote-line', 'law-vote-yes', 'law-vote-no', 'law-vote-abstain', 'law-vote-absent',
  // The player's vote on a confidence vote, the answer to a request of external support (cabinet-engine).
  'confidence-vote-line', 'confidence-vote-yes', 'confidence-vote-no', 'confidence-vote-abstain', 'confidence-vote-absent', 'support-accept', 'support-refuse',
  // Local and European institutions (local-engine): the player's vote in the council, a group threatening to leave.
  'local-vote-line', 'local-vote-yes', 'local-vote-no', 'local-vote-abstain', 'local-vote-absent', 'local-concede', 'local-hold'];
function handleSpecial(ctx, env, special, item, lines, specials, choice = {}) {
  const game = ctx.game;
  if (WORLD_SPECIALS.includes(special) || special.startsWith('presidency-')) { specials.push({ type: special, params: item.params ?? {} }); return; }
  // The starting conditions: debts, a divided party, the outsider's apparatus, enemies, the past, expectations.
  if (special.startsWith('start-')) { lines.push(...startSpecial(game, special, item, choice, lifeApi())); return; }
  // The offers a reached goal puts on the desk: an office in the party, a role of guarantee.
  if (special === 'objective-role-dipartimento' || special === 'objective-role-garante') {
    const title = special === 'objective-role-garante' ? 'Garante dell’unità del partito' : 'Responsabile di dipartimento';
    if (game.party) { game.party.minorRoles = [...(game.party.minorRoles ?? []), { title, week: game.week.index, source: SIM }].slice(-6); game.party.history.push({ week: game.week.index, date: env.currentDate, text: `Assume l’incarico: ${title.toLowerCase()}`, source: SIM }); lines.push(`Nuovo incarico nel partito: ${title.toLowerCase()}.`); }
    return;
  }
  if (special === 'emergency-decree') {
    specials.push({ type: 'emergency-decree', decree: Object.fromEntries(Object.entries(choice.decree ?? {}).map(([key, value]) => [key, typeof value === 'string' ? fill(value, item.params) : value])), title: `Misure urgenti: ${item.title}` });
    return;
  }
  if (special === 'issue-law-security') {
    specials.push({ type: 'issue-law', region: item.params?.region2 ?? item.params?.region, topic: 'Sicurezza', indicator: 'sicurezza' });
    return;
  }
  // The leaders of the committees of the player's territory: a round of visits (they are heard, the committees feel it), or a man of trust
  // where the territory slips away (the committee whose leader answers least gets a new one).
  if (special === 'territory-tour' || special === 'territory-coordinator') {
    const org = game.party?.org;
    const week = game.week.index;
    const cadreOf = committee => (game.party.life?.cadres ?? []).find(entry => entry.committeeId === committee.id && entry.status !== 'uscito') ?? null;
    const home = (org?.committees ?? []).filter(entry => entry.region === game.place?.region && entry.status !== 'dissoluzione' && !entry.leader?.player);
    if (!home.length) return;
    if (special === 'territory-tour') {
      for (const committee of home) {
        committee.lastVisitWeek = week; committee.loyalty = Math.round(clamp(committee.loyalty + 4)); committee.organization = Math.round(clamp(committee.organization + 2));
        const cadre = cadreOf(committee);
        if (cadre) { cadre.loyalty = Math.round(clamp(cadre.loyalty + 6)); cadre.grievance = Math.round(clamp(cadre.grievance - 10)); }
      }
      lines.push(`Giro dei comitati: ${home.length} responsabili ascoltati, la fedeltà sale`);
    } else {
      const weakest = [...home].sort((a, b) => leaderStance(a, { party: game.party, cadre: cadreOf(a) }).weight - leaderStance(b, { party: game.party, cadre: cadreOf(b) }).weight)[0];
      lines.push(...applyCommitteeAction(org, weakest, 'responsabile', { week, rand: () => draw(game), currents: game.party.currents }));
    }
    return;
  }
  // A place in the lists promised to the local leader with the most ambition: it is kept when the lists are drawn up, it breaks if the vote goes by without them.
  if (special === 'territory-promise') {
    const election = game.elections.filter(entry => ['upcoming', 'open'].includes(entry.status) && !game.party?.org?.selections?.[entry.id]).sort((a, b) => a.electionDate.localeCompare(b.electionDate))[0];
    const cadres = (game.party?.life?.cadres ?? []).filter(entry => entry.status !== 'uscito' && !entry.player && !entry.promise);
    const pick = [...cadres].sort((a, b) => b.ambition - a.ambition || String(a.id).localeCompare(String(b.id)))[0];
    if (!election || !pick) { lines.push('Nessuna promessa da fare adesso.'); return; }
    pick.promise = { week: game.week.index, electionId: election.id, until: game.week.index + 52 };
    pick.grievance = Math.round(clamp(pick.grievance - 20)); pick.loyalty = Math.round(clamp(pick.loyalty + 12));
    for (const other of cadres.filter(entry => entry.id !== pick.id)) other.grievance = Math.round(clamp(other.grievance + 2));
    lines.push(`${pick.name}: gli prometti un posto nelle liste di ${election.label}`);
    return;
  }
  if (special === 'round-engage') {
    const round = (game.rounds ?? []).find(entry => entry.id === item.params?.roundId);
    if (round) round.engagement = choice.id;
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
  if (special.startsWith('life-')) { handleLifeSpecial(ctx, env, special, item, lines, specials); return; }
  if (special === 'leadership-a' || special === 'leadership-b' || special === 'leadership-neutral') {
    const backed = special === 'leadership-a' ? item.params.currentAId : special === 'leadership-b' ? item.params.currentBId : null;
    let winner;
    if (game.party.life) {
      // The vote of the delegates built week after week (the player's backing adds the people of the player's committees).
      const done = resolveCongress(game, lifeApi(), { mode: backed ? 'support' : 'neutral', backedId: backed, influence: ctx.stats.influence ?? 30, week: game.week.index, date: env.currentDate, rand: () => draw(game) });
      winner = game.party.currents.find(entry => entry.id === done.outcome.winnerCurrentId);
      lines.push(...done.lines);
    } else {
      const [a, b] = [item.params.currentAId, item.params.currentBId].map(id => game.party.currents.find(entry => entry.id === id));
      const scoreA = a.strength + (a.profile?.congressPlan ? 5 : 0) + (a.profile?.agreements?.length ?? 0) * 1.5 + (a.profile?.loyalty ?? .5) * 4;
      const scoreB = b.strength + (b.profile?.congressPlan ? 5 : 0) + (b.profile?.agreements?.length ?? 0) * 1.5 + (b.profile?.loyalty ?? .5) * 4;
      winner = draw(game) < scoreA / Math.max(1, scoreA + scoreB) ? a : b;
      winner.strength = Math.min(60, winner.strength + 8);
      game.party.leaderCurrentId = winner.id;
    }
    if (backed) game.party.alignedCurrentId = backed;
    congressAftermath(game, env, winner);
    game.party.leadershipContestWeek = game.week.index;
    const leadership = game.relations.find(entry => entry.id === 'leadership');
    if (!backed) {
      lines.push(`${winner.label} vince il congresso: non ti sei schierato, nessuno ti deve niente.`);
    } else if (winner.id === backed) {
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
    if (game.party.org) game.party.org.congress.history = [{ week: game.week.index, winner: winner.label, backed: Boolean(backed) && winner.id === backed, source: SIM }, ...(game.party.org.congress.history ?? [])].slice(0, 6);
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
  } else if (special === 'committee-rescue' || special === 'committee-commissar' || special === 'committee-neglect') {
    // A committee in trouble: going there, having it placed under a commissioner, or letting it go.
    const committee = game.party?.org?.committees?.find(entry => entry.id === item.params.committeeId);
    if (committee && committee.status !== 'dissoluzione') {
      if (special === 'committee-rescue') { committee.organization = Math.round(clamp(committee.organization + 12)); committee.loyalty = Math.round(clamp(committee.loyalty + 10)); committee.lastVisitWeek = game.week.index; lines.push(`Il comitato di ${committee.name} riparte: organizzazione ${committee.organization}, fedeltà ${committee.loyalty}.`); }
      else if (special === 'committee-commissar') { committee.leader = { label: 'Commissario (figura simulata nominata dalla segreteria)', currentId: null, player: false, since: game.week.index }; committee.loyalty = 75; committee.status = 'crisi'; committee.statusSince = game.week.index; lines.push(`La segreteria commissaria il comitato di ${committee.name}: il controllo torna, qualche malumore resta.`); if (game.party.org) game.party.org.cohesion = Math.round(clamp(game.party.org.cohesion - 2)); }
      else { committee.loyalty = Math.round(clamp(committee.loyalty - 6)); lines.push(`Il comitato di ${committee.name} resta da solo: la fedeltà a te cala.`); }
    }
  } else if (special.startsWith('committee-local-')) {
    // A local event decided: the consequences fall on the committee of the territory.
    const [, , kind, choice] = special.split('-');
    const committee = game.party?.org?.committees?.find(entry => entry.id === item.params.committeeId);
    if (committee && committee.status !== 'dissoluzione') lines.push(...applyLocalEvent(game.party.org, committee, kind, choice, { week: game.week.index, rand: () => draw(game) }));
  } else if (special === 'accept-scenario-office') {
    game.flags.scenarioOffice = { title: 'Sottosegretario (esecutivo di scenario)', since: game.week.index, source: SIM };
    specials.push({ type: 'scenario-office', title: game.flags.scenarioOffice.title });
    lines.push('Entri nell’esecutivo di scenario come sottosegretario.');
  } else if (special === 'world-coalition-join' || special === 'world-coalition-terms') {
    specials.push({ type: 'world-coalition', allianceId: item.params.allianceId, partyId: item.params.partyId, terms: special === 'world-coalition-terms' });
  } else if (special === 'world-alliance-accept') {
    specials.push({ type: 'world-alliance', partyId: item.params.partyId });
  } else if (special === 'world-relation-up' || special === 'world-relation-down') {
    specials.push({ type: 'world-relation', partyId: item.params.partyId, delta: special === 'world-relation-up' ? 10 : -10 });
  } else if (special === 'media-repair' || special.startsWith('public-')) {
    specials.push({ type: special });
  } else if (special === 'accept-rank') {
    // An offer from the leadership is a strong push, not a guarantee: the organs still have to agree.
    const rank = nextPartyRank(game);
    if (rank?.threshold) {
      const result = evaluateAdvancement('partito', { factors: progressionFactors({ game, stats: ctx.stats, parliament: ctx.parliament }), threshold: rank.threshold, bonus: 12, game, capital: game.resources.politicalCapital, rank: game.party.rank, hostile: false, roll: draw(game), roll2: draw(game) });
      recordContest(game.party, { week: game.week.index, date: env.currentDate, kind: 'proposta', target: rank.title, outcome: result.outcome === 'promosso' || result.outcome === 'incarico-inferiore' ? result.outcome : 'stallo', label: result.outcome === 'promosso' ? result.label : result.outcome === 'incarico-inferiore' ? result.label : 'Proposta arenata negli organi', chance: result.chance, score: result.score, threshold: rank.threshold });
      if (result.outcome === 'promosso') {
        game.party.rank = rank.level; game.party.rankTitle = rank.title;
        game.party.history.push({ week: game.week.index, date: env.currentDate, text: `Nominato ${rank.title.toLowerCase()} su proposta della segreteria`, source: SIM });
        lines.push(`Diventi ${rank.title.toLowerCase()}.`);
      } else if (result.outcome === 'incarico-inferiore') {
        game.party.minorRoles = [...(game.party.minorRoles ?? []), { title: `Responsabile di settore (invece di ${rank.title.toLowerCase()})`, week: game.week.index, source: SIM }].slice(-6);
        lines.push(`Gli organi ridimensionano la proposta: ti affidano solo un incarico di settore.`);
      } else lines.push('La proposta si arena negli organi del partito: se ne riparlerà.');
    }
  } else if (special === 'cosign') {
    const contact = (game.contacts ?? []).find(entry => entry.person.id === item.params.contactId);
    if (contact) contact.cosigned = [...new Set([...(contact.cosigned ?? []), item.params.lawId])];
    specials.push({ type: 'cosign', lawId: item.params.lawId, person: contact?.person ?? null });
    lines.push(`${item.params.contact} sottoscrive la proposta (simulazione).`);
  } else if (special === 'group-leader') {
    // The group chooses the player as its leader: the store records it (and it lapses with the seat or the group).
    specials.push({ type: 'group-leader' });
    lines.push('Sei il nuovo capogruppo.');
  } else if (special === 'local-office') {
    // An office that comes from a decision of others (the giunta, the group): the store records it.
    const office = Object.fromEntries(Object.entries(choice.office ?? {}).map(([key, value]) => [key, typeof value === 'string' ? fill(value, item.params) : value]));
    specials.push({ type: 'local-office', office });
    lines.push(`Nuovo incarico: ${office.title ?? 'incarico locale'}.`);
  }
}
// After the vote on the leadership the areas share the party's bodies by their weight and each remembers how it went.
function congressAftermath(game, env, winner) {
  const party = game.party;
  if (party.org) party.org.currentPortfolios = allocateCurrentPortfolios(party.currents, winner.id, { week: game.week.index });
  for (const current of party.currents) rememberCurrent(party.currents, current.id, { kind: current.id === winner.id ? 'congresso-vinto' : 'congresso-sconfitta', text: `Congresso vinto da ${winner.label}`, targetId: winner.id, relationDelta: current.id === winner.id ? 5 : -2, weight: 1.4 }, { week: game.week.index, date: env.currentDate });
}
// Running for secretary at a congress: support, the strength of one's area, influence and cohesion count.
function runForSecretary(ctx, env, lines) {
  const game = ctx.game;
  const party = game.party;
  const aligned = party.currents.find(current => current.id === party.alignedCurrentId);
  const preparation = aligned?.profile?.congressPlan ? 4 : 0;
  const alliances = aligned?.profile?.agreements?.length ?? 0;
  const score = party.support * 0.45 + (aligned?.strength ?? 20) * 0.6 + (ctx.stats.influence ?? 30) * 0.2 + (party.org?.cohesion ?? 55) * 0.1 + preparation + alliances * 1.5 + (aligned?.profile?.loyalty ?? .5) * 4;
  // With the internal life the delegates decide: the weight of the area, of the committees and of the agreements.
  const done = party.life ? resolveCongress(game, lifeApi(), { mode: 'candidate', backedId: party.alignedCurrentId, influence: ctx.stats.influence ?? 30, week: game.week.index, date: env.currentDate, rand: () => draw(game) }) : null;
  if (done) lines.push(...done.lines);
  const won = done ? done.outcome.playerWon : draw(game) < clamp((score - 42) / 40, 0.1, 0.85);
  party.leadershipContestWeek = game.week.index;
  if (won) {
    party.rank = 5; party.rankTitle = PARTY_RANKS[5].title;
    if (aligned) { party.leaderCurrentId = aligned.id; if (!done) aligned.strength = Math.min(60, aligned.strength + 8); }
    if (party.org) party.org.currentPortfolios = allocateCurrentPortfolios(party.currents, aligned?.id ?? party.leaderCurrentId, { week: game.week.index });
    for (const current of party.currents) rememberCurrent(party.currents, current.id, { kind: current.id === aligned?.id ? 'congresso-vinto' : 'congresso-perso', text: current.id === aligned?.id ? 'La propria area vince il congresso' : 'Un’altra area vince il congresso', targetId: aligned?.id ?? null, relationDelta: current.id === aligned?.id ? 5 : -2, weight: 1.6 }, { week: game.week.index, date: env.currentDate });
    party.support = clamp(party.support + 8);
    party.history.push({ week: game.week.index, date: env.currentDate, text: 'Eletto segretario nazionale al congresso', source: SIM });
    lines.push('Il congresso ti elegge segretario nazionale: ora decidi linea, alleanze, candidature e organi.');
  } else {
    party.support = clamp(party.support - 6);
    const leadership = game.relations.find(entry => entry.id === 'leadership');
    if (leadership) leadership.value = Math.min(leadership.value, 35);
    lines.push('Il congresso sceglie un’altra guida: la tua candidatura esce sconfitta.');
    for (const current of party.currents) rememberCurrent(party.currents, current.id, { kind: 'congresso-esito', text: 'La candidatura del giocatore perde il congresso', relationDelta: current.id === aligned?.id ? -5 : 1, weight: 1.2 }, { week: game.week.index, date: env.currentDate });
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
    recordCurrentDecision(game, 'congresso-dimissioni', 'Il segretario lascia l’incarico al congresso', { weight: 1.4 });
    return;
  }
  const chance = clamp(0.35 + (party.support - 50) / 100 + (cohesion - 50) / 150 + (choice === 'unity' ? 0.2 : 0), 0.1, 0.9);
  const done = party.life ? resolveCongress(game, lifeApi(), { mode: 'incumbent', unity: choice === 'unity', influence: ctx.stats.influence ?? 30, week: game.week.index, date: env.currentDate, rand: () => draw(game) }) : null;
  if (done) lines.push(...done.lines);
  if (done ? done.outcome.playerWon : draw(game) < chance) {
    party.support = clamp(party.support + 5);
    if (party.org) party.org.cohesion = Math.round(clamp(cohesion + (choice === 'unity' ? 12 : 5)));
    if (choice === 'unity') for (const current of party.currents) changeRelation(game, current.id, 4);
    if (party.org) party.org.currentPortfolios = allocateCurrentPortfolios(party.currents, party.leaderCurrentId, { week: game.week.index });
    for (const current of party.currents) rememberCurrent(party.currents, current.id, { kind: choice === 'unity' ? 'congresso-unitario' : 'congresso-conferma', text: choice === 'unity' ? 'Congresso unitario' : 'Segreteria confermata', relationDelta: choice === 'unity' ? 5 : 2, weight: 1.4 }, { week: game.week.index, date: env.currentDate });
    lines.push(choice === 'unity' ? 'Segreteria unitaria: il congresso ti conferma con tutte le aree.' : 'Il congresso ti conferma alla guida del partito.');
  } else {
    party.rank = choice === 'unity' ? 4 : 3; party.rankTitle = PARTY_RANKS[party.rank].title;
    changeRelation(game, item.params.currentAId, 6);
    lines.push(`Il congresso premia ${item.params.currentA}: perdi la segreteria.`);
    const winner = party.currents.find(current => current.id === item.params.currentAId) ?? [...party.currents].sort((a, b) => b.strength - a.strength)[0];
    party.leaderCurrentId = winner?.id ?? party.leaderCurrentId;
    if (party.org) party.org.currentPortfolios = allocateCurrentPortfolios(party.currents, winner?.id ?? null, { week: game.week.index });
    for (const current of party.currents) rememberCurrent(party.currents, current.id, { kind: current.id === winner?.id ? 'congresso-vinto' : 'congresso-sconfitta', text: `Il congresso premia ${winner?.label ?? item.params.currentA}`, targetId: winner?.id ?? null, relationDelta: current.id === winner?.id ? 6 : -2, weight: 1.5 }, { week: game.week.index, date: env.currentDate });
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
  // A sponsor in the party (an area that backs the player's candidacy) weighs on the nomination.
  if (org.sponsor && org.sponsor.until >= game.week.index && game.party.alignedCurrentId === org.sponsor.currentId) { bonus += org.sponsor.bonus; lines.push(`Il padrino interno pesa sulla candidatura: +${org.sponsor.bonus}`); }
  org.selections = { ...org.selections, [item.params.electionId]: { method, bonus, week: game.week.index, election: item.params.election, source: SIM } };
}
// A merger accepted from a request happens in the career now; the world and the Parliament follow in the store.
function settleMergers(ctx, env, specials) {
  for (let index = 0; index < specials.length; index++) {
    const special = specials[index];
    if (special.type !== 'merge-request') continue;
    const out = mergeParties(ctx.game, lifeApi(), { forceId: special.forceId, label: special.label, share: special.share, ownShare: env.pollShare ?? 3, week: ctx.game.week.index, date: env.currentDate, rand: () => draw(ctx.game) });
    specials[index] = { type: 'party-merge', descriptor: out.descriptor };
    addLog(ctx.game, env.currentDate, 'partito', `Fusione con ${special.label}`, out.lines, 'neutral');
  }
}
// The decisions that come out of the party's internal life: requests, ultimatums, congress work, local leaders, splits.
function handleLifeSpecial(ctx, env, special, item, lines, specials) {
  const game = ctx.game;
  const api = lifeApi();
  const week = game.week.index, date = env.currentDate;
  const rand = () => draw(game);
  api.date = date;
  const reply = choice => {
    const out = respondRequest(game, api, { requestId: item.params.requestId, choice, week, date, rand });
    lines.push(...out.lines);
    for (const entry of out.raises) raiseSituation(ctx, entry.id, entry.params, entry.urgent);
    settleMergers(ctx, env, out.specials);
    specials.push(...out.specials);
  };
  if (special === 'life-accept') reply('accetta');
  else if (special === 'life-accept-counter') reply('accetta-controfferta');
  else if (special === 'life-negotiate') reply('tratta');
  else if (special === 'life-refuse') reply('rifiuta');
  else if (special === 'life-delay') { lapseAnswer(game, api, { requestId: item.params.requestId, week, date }); }
  else if (special === 'life-congress-mobilize') lines.push(...congressWork(game, api, { kind: 'mobilita', week }));
  else if (special === 'life-congress-ally') lines.push(...congressWork(game, api, { kind: 'alleanza', week }));
  else if (special.startsWith('life-rebuild-')) lines.push(...startRebuild(game, api, { focus: special.slice(13), week, date }));
  else if (['life-cadre-keep', 'life-cadre-meet', 'life-cadre-leave', 'life-cadre-tessere', 'life-cadre-verifica', 'life-cadre-rifiuta'].includes(special)) lines.push(...cadreDecision(game, api, { cadreId: item.params.cadreId, choice: special.slice(11), week, date, rand }));
  else if (special === 'life-split-stay' || special === 'life-split-hold' || special === 'life-split-follow') {
    const life = game.party?.life;
    const id = item.params.currentId;
    const actor = life?.actors?.[id];
    if (!actor || !game.party.currents.some(entry => entry.id === id)) return;
    if (special === 'life-split-hold') {
      const chance = clamp(0.2 + actor.loyalty / 160 + ((game.resources.politicalCapital ?? 30) - 20) / 300 - actor.temper / 400, 0.1, 0.7);
      if (rand() < chance) {
        actor.grievance = clamp(actor.grievance - 35); actor.loyalty = clamp(actor.loyalty + 12);
        life.pacts.push({ id: uniqueId(life.pacts, `accordo-${week}-${life.counters.pacts + 1}`), kind: 'tregua', actorId: id, title: 'Tregua interna', terms: {}, since: week, until: week + 16, status: 'attivo', breaches: 0, renewals: 0, nextPayWeek: week + 4, source: SIM });
        life.counters.pacts += 1;
        lines.push(`${item.params.current} resta nel partito: una tregua di quattro mesi`);
        return;
      }
      lines.push(`${item.params.current} non si lascia trattenere`);
    }
    const followed = special === 'life-split-follow';
    const name = SPLINTER_NAMES[id] ?? `Area ${item.params.current.replace(/^Area /, '')}`;
    const newPartyId = `partito-scissione-${hash(`${game.seed}|${id}|${week}`) % 100000}`;
    const out = splitOff(game, api, { currentIds: [id], newPartyId, label: name, followed, week, date, rand });
    lines.push(...out.lines);
    if (followed) lines.push(...enterNewParty(game, api, { descriptor: out.descriptor, newPartyId, label: name, week, date, rand, reason: `Segue ${item.params.current} nella scissione` }).lines);
    specials.push({ type: 'party-split', descriptor: out.descriptor, followed });
  }
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
  // The weight of one's own area in the national bodies, and the agreements that tie the player to it, count too.
  const life = party.life;
  const seatShare = life && party.alignedCurrentId ? (life.organs?.seats?.[party.alignedCurrentId] ?? 0) / (life.organs?.total || 9) : 0;
  const tied = life?.pacts?.some(pact => pact.status === 'attivo' && pact.kind === 'sostegno-congresso') ? 2 : 0;
  return Math.round(party.support * 0.45 + leadership * 0.35 + (ctx.stats.influence ?? 30) * 0.2 + (party.alignedCurrentId && party.alignedCurrentId === party.leaderCurrentId ? 4 : 0) + seatShare * 8 + tied);
}
// The odds of the next internal office, factor by factor (no draw: for the interface).
export function partyAdvancementOdds(ctx) {
  const rank = nextPartyRank(ctx.game);
  if (!rank?.threshold) return null;
  return { ...advancementOdds('partito', { factors: progressionFactors({ game: ctx.game, stats: ctx.stats, parliament: ctx.parliament }), threshold: rank.threshold, game: ctx.game, capital: ctx.game.resources.politicalCapital }), rank };
}
// Every attempt to climb stays on record: the career shows what was tried, with which odds and how it ended.
function recordContest(party, entry) {
  party.contests = [...(party.contests ?? []), { ...entry, source: SIM }].slice(-12);
}
function recordCurrentDecision(game, kind, text, { currentId = null, targetId = null, relationDelta = 0, weight = 1 } = {}) {
  const party = game.party;
  if (!party?.currents?.length) return;
  const targets = currentId ? party.currents.filter(item => item.id === currentId) : party.currents;
  for (const current of targets) rememberCurrent(party.currents, current.id, { kind, text, targetId, relationDelta: currentId === current.id ? relationDelta : 0, weight }, { week: game.week.index, date: game.week.startedAt });
}
const hostileCurrent = party => [...(party?.currents ?? [])].filter(current => current.id !== party.alignedCurrentId && (current.value ?? current.relation ?? 50) < 42).sort((a, b) => b.strength - a.strength)[0] ?? null;
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
  // Not a threshold to cross: support, leadership, the weight of one's area, influence, results, territory, the state
  // of the party and the moment decide the odds, and the same attempt can end in several ways.
  const hostile = hostileCurrent(party);
  const result = evaluateAdvancement('partito', { factors: progressionFactors({ game: ctx.game, stats: ctx.stats, parliament: ctx.parliament }), threshold: rank.threshold, game: ctx.game, capital: ctx.game.resources.politicalCapital, rank: party.rank, hostile: Boolean(hostile), roll: draw(ctx.game), roll2: draw(ctx.game) });
  party.lastRankContestWeek = ctx.game.week.index;
  recordContest(party, { week: ctx.game.week.index, date: env.currentDate, kind: 'partito', target: rank.title, outcome: result.outcome, label: result.label, chance: result.chance, score: result.score, threshold: rank.threshold });
  recordCurrentDecision(ctx.game, 'incarico-conteso', `Contesa interna per ${rank.title}`, { currentId: hostile?.id ?? null, relationDelta: result.outcome === 'promosso' ? 2 : -3, weight: 1.2 });
  const lines = [`Probabilità stimata ${Math.round(result.chance * 100)}% · punteggio ${String(result.score).replace('.', ',')} su soglia ${rank.threshold}`];
  const week = ctx.game.week.index;
  if (result.outcome === 'promosso') {
    party.rank = rank.level; party.rankTitle = rank.title;
    applyEffects(ctx, { party: { support: 3 }, stats: { influence: 2, notoriety: 1 } }, null, lines);
    party.history.push({ week, date: env.currentDate, text: `Nominato ${rank.title.toLowerCase()}`, source: SIM });
  } else if (result.outcome === 'incarico-inferiore') {
    party.minorRoles = [...(party.minorRoles ?? []), { title: `Responsabile di settore (invece di ${rank.title.toLowerCase()})`, week, source: SIM }].slice(-6);
    applyEffects(ctx, { party: { support: 1 }, stats: { influence: 0.5 } }, null, lines);
    lines.push(`Invece di ${rank.title.toLowerCase()} ti affidano solo un incarico di settore.`);
    party.history.push({ week, date: env.currentDate, text: `Ottiene solo un incarico di settore (puntava a ${rank.title.toLowerCase()})`, source: SIM });
  } else if (result.outcome === 'stallo') {
    applyEffects(ctx, { relations: { leadership: -1 } }, null, lines);
    lines.push('La direzione rinvia la decisione: se ne riparlerà.');
  } else if (result.outcome === 'sconfitta-interna') {
    applyEffects(ctx, { party: { support: -4 }, relations: { leadership: -2 } }, null, lines);
    if (hostile) changeRelation(ctx.game, hostile.id, -3);
    lines.push(`${hostile?.label ?? 'Un’altra area'} impone un proprio nome: la tua candidatura interna perde.`);
  } else {
    applyEffects(ctx, { party: { support: -5 }, relations: { leadership: -3 } }, null, lines);
    demote(ctx, env, 'La sfida si ritorce contro di te', lines);
  }
  addLog(ctx.game, env.currentDate, 'partito', result.outcome === 'promosso' ? `Nuovo incarico: ${rank.title}` : `${result.label}: ${rank.title}`, lines, result.tone === 'good' ? 'good' : result.tone === 'bad' ? 'bad' : 'neutral');
  const completed = refreshObjectives(ctx, env, [], env.currentDate);
  return { ctx, success: result.outcome === 'promosso', outcome: result.outcome, label: result.label, chance: result.chance, factors: result.factors, rank, score: result.score, completed };
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
  recordCurrentDecision(ctx.game, 'alleanza-personale', `Il giocatore si schiera con ${current.label}`, { currentId, relationDelta: 6, weight: 1.2 });
  for (const other of party.currents.filter(item => item.id !== currentId)) rememberCurrent(party.currents, other.id, { kind: 'schieramento-altrui', text: `Il giocatore si è schierato con ${current.label}`, targetId: currentId, relationDelta: -3 }, { week: ctx.game.week.index, date: env.currentDate });
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
  recordCurrentDecision(ctx.game, 'linea-politica', `La segreteria sceglie la linea ${PARTY_LINES[line].label}`, { weight: 1.4 });
  for (const current of party.currents) rememberCurrent(party.currents, current.id, { kind: CURRENT_LINES[current.id] === line ? 'linea-condivisa' : 'linea-rifiutata', text: `Linea ${PARTY_LINES[line].label}`, relationDelta: CURRENT_LINES[current.id] === line ? 4 : -4, targetId: 'segreteria', weight: 1.1 }, { week: ctx.game.week.index, date: env.currentDate });
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
  if (party.org) party.org.currentPortfolios = allocateCurrentPortfolios(party.currents, currentId, { week: ctx.game.week.index });
  const strongest = [...party.currents].sort((a, b) => b.strength - a.strength)[0];
  const lines = applyEffects(ctx, { relations: { target: 8, otherCurrents: -3 } }, currentId);
  if (party.org) party.org.cohesion = Math.round(clamp(party.org.cohesion + (strongest.id === currentId ? 3 : -2)));
  lines.push(strongest.id === currentId ? 'Premi l’area più forte: il partito si compatta' : 'Premi un’area minoritaria: l’area più forte protesta');
  recordCurrentDecision(ctx.game, 'incarichi-assegnati', `Organi affidati a ${current.label}`, { currentId, relationDelta: strongest.id === currentId ? 4 : -4, weight: 1.3 });
  for (const item of party.currents) if (item.id !== currentId) rememberCurrent(party.currents, item.id, { kind: item.id === strongest.id ? 'incarico-negato' : 'incarico-assegnato-ad-altri', text: `Organi affidati a ${current.label}`, targetId: currentId, relationDelta: item.id === strongest.id ? -4 : -1 }, { week: ctx.game.week.index, date: env.currentDate });
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
    rememberCurrent(party.currents, current.id, { kind: delta > 0 ? 'programma-condiviso' : 'programma-rifiutato', text: `Programma: ${chosen.map(id => labels[id] ?? id).join(', ')}`, targetId: 'programma', relationDelta: delta > 0 ? 2 : -2, weight: 1 }, { week: ctx.game.week.index, date: env.currentDate });
  }
  if (party.org) party.org.cohesion = Math.round(clamp(party.org.cohesion + (chosen.some(id => (CURRENT_AREAS[party.leaderCurrentId] ?? []).includes(id)) ? 2 : -3)));
  addLog(ctx.game, env.currentDate, 'partito', `Nuovo programma: ${chosen.map(id => labels[id] ?? id).join(', ')}`, lines, 'neutral');
  // What the records of the user's party and the political world (the agenda the polls' segments and the campaigns read) still have to take up.
  return { ctx, specials: [{ type: 'party-program', areas: chosen }] };
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
  recordCurrentDecision(ctx.game, 'regola-candidature', `Regola candidature: ${CANDIDACY_RULES[rule].label}`, { weight: 1.2 });
  addLog(ctx.game, env.currentDate, 'partito', `Nuova regola per le candidature: ${CANDIDACY_RULES[rule].label}`, lines, 'neutral');
  return { ctx };
}
export function callEarlyCongress(input, env) {
  const ctx = asSecretary(input, { capital: 4 });
  const org = ctx.game.party.org;
  if (ctx.game.party.affiliation === 'founder') throw new Error('Da fondatore guidi il partito senza congressi.');
  if (org.congress.nextWeek - ctx.game.week.index <= 2) throw new Error('Il congresso è già alle porte.');
  org.congress.nextWeek = ctx.game.week.index + 2;
  recordCurrentDecision(ctx.game, 'congresso-convocato', 'Congresso anticipato dalla segreteria', { weight: 1.3 });
  addLog(ctx.game, env.currentDate, 'partito', 'Convochi un congresso anticipato', ['Tra due settimane la tua segreteria sarà messa al voto.'], 'neutral');
  return { ctx };
}
export function partyInvestment(input, env, id) {
  const investment = PARTY_INVESTMENTS.find(item => item.id === id);
  if (!investment) throw new Error('Investimento non disponibile.');
  const ctx = asSecretary(input, { treasury: investment.cost });
  const org = ctx.game.party.org;
  const week = ctx.game.week.index;
  const active = item => item.id === id && (!item.untilWeek || item.untilWeek >= week);
  if ((org.investments ?? []).some(active)) throw new Error('Investimento già in corso.');
  if (investment.requires && !(org.investments ?? []).some(item => item.id === investment.requires && (!item.untilWeek || item.untilWeek >= week))) throw new Error(`Serve prima: ${PARTY_INVESTMENTS.find(item => item.id === investment.requires)?.label ?? investment.requires}.`);
  const lines = [`Tesoreria −${investment.cost.toLocaleString('it-IT')} €`];
  if (id === 'scuola-politica') applyOrgEffects(org, { militants: 0.08, cohesion: 8 }, lines);
  if (id === 'fondo-territori') for (const section of org.sections.filter(item => item.vitality < 45)) section.vitality = Math.round(clamp(section.vitality + 20));
  // A seat in every federation: the regional committees get one worth the name.
  if (id === 'sedi-regionali') for (const committee of (org.committees ?? []).filter(item => item.level === 'regione' && item.status !== 'dissoluzione')) committee.seat = Math.max(committee.seat ?? 0, 2);
  if (id === 'sede-nazionale') org.cadres = (org.cadres ?? 0) + 4;
  if (investment.upkeep) lines.push(`Mantenimento: ${investment.upkeep.toLocaleString('it-IT')} € a settimana dalla tesoreria`);
  org.investments = [...(org.investments ?? []), { id, label: investment.label, week, untilWeek: investment.oneOff ? week : investment.weeks ? week + investment.weeks : null, source: SIM }];
  const beneficiary = id === 'fondo-territori' ? 'territori' : id === 'scuola-politica' ? 'movimento' : 'riformisti';
  org.investments.at(-1).beneficiaryCurrentId = beneficiary;
  recordCurrentDecision(ctx.game, 'investimento', `Investimento: ${investment.label}`, { currentId: beneficiary, relationDelta: 3, weight: 1.1 });
  addLog(ctx.game, env.currentDate, 'partito', `Investimento del partito: ${investment.label}`, lines, 'good');
  return { ctx, investment };
}
// Territorial committees: found one, visit, change its leader, fund, mobilise, place it under a commissioner.
export function committeeAction(input, env, actionId, target = {}) {
  const spec = COMMITTEE_ACTIONS[actionId];
  if (!spec) throw new Error('Azione non disponibile.');
  const ctx = start(input);
  const party = ctx.game.party;
  if (!party?.org) throw new Error('I comitati territoriali sono quelli del tuo partito: serve un partito.');
  if (actionId === 'commissaria' && !isPartyLeader(party)) throw new Error('Solo chi guida il partito può commissariare un comitato.');
  if (spec.leader && !isPartyLeader(party)) throw new Error('Solo chi guida il partito può prendere questa decisione.');
  const org = party.org;
  const week = ctx.game.week.index;
  const rand = () => draw(ctx.game);
  const target0 = (org.committees ?? []).find(item => item.id === target.committeeId);
  const cost = committeeActionCost(target0, actionId);
  const problem = costProblem(ctx.game, cost);
  if (problem) throw new Error(problem);
  const scale = scaleOf({ nationalShare: env.pollShare ?? null, founder: party.affiliation === 'founder' });
  let committee;
  let lines;
  if (actionId === 'fonda') {
    if (!['provincia', 'comune'].includes(target.level) || !target.name || !target.region) throw new Error('Scegli dove fondare il comitato.');
    const parent = (org.committees ?? []).find(item => item.id === target.parentId) ?? (org.committees ?? []).find(item => item.level === (target.level === 'comune' ? 'provincia' : 'regione') && item.region === target.region && (target.level === 'provincia' || item.unitCode === target.unitCode));
    committee = foundCommittee(org, { level: target.level, name: target.name, region: target.region, parentId: parent?.id ?? null, week, currents: party.currents, rand, extra: { unitCode: target.unitCode ?? null, unitType: target.unitType ?? null, municipalityCode: target.municipalityCode ?? null } });
    lines = [`Nasce il ${COMMITTEE_LEVELS[committee.level].label.toLowerCase()} di ${committee.name}`];
  } else {
    committee = (org.committees ?? []).find(item => item.id === target.committeeId);
    if (!committee) throw new Error('Comitato non trovato.');
    lines = applyCommitteeAction(org, committee, actionId, { week, rand, currents: party.currents, leader: isPartyLeader(party), scale, stance: leaderStance(committee, { party, cadre: (party.life?.cadres ?? []).find(item => item.committeeId === committee.id && item.status !== 'uscito') ?? null }) });
  }
  pay(ctx.game, cost, 'partito', `${spec.label}: ${committee.name}`, env.currentDate);
  if (['rilancia', 'mobilita'].includes(actionId) && committee.region === ctx.game.place?.region) applyEffects(ctx, { stats: { popularity: 0.3, notoriety: 0.2 } }, null, lines, { source: `Comitato di ${committee.name}` });
  addLog(ctx.game, env.currentDate, 'partito', `${spec.label}: ${COMMITTEE_LEVELS[committee.level].label.toLowerCase()} di ${committee.name}`, lines, 'good');
  return { ctx, committee, lines };
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
  org.expelledWeek = ctx.game.week.index;
  // The areas that felt targeted do not forget: the hostile ones most of all.
  for (const actor of Object.values(ctx.game.party.life?.actors ?? {})) { const hostile = actor.grievance >= 55; actor.grievance = clamp(actor.grievance + (hostile ? 12 : 3)); actor.loyalty = clamp(actor.loyalty - (hostile ? 8 : 2)); }
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
// The party is left for an office that is above parties (the Presidency of the Republic): no stat penalty, the reason on record.
export function leavePartyFor(input, env, reason) {
  const ctx = start(input);
  if (!ctx.game.party) return { ctx };
  const label = ctx.game.party.label ?? 'il partito';
  leaveParty(ctx, reason);
  addLog(ctx.game, env.currentDate, 'partito', `Lasci ${label}`, [reason], 'neutral');
  return { ctx };
}
// A consequence of a decision, due some weeks later (the same machinery as every other consequence of the game).
export function scheduleFollowUp(input, later, origin) {
  const game = copy(input);
  schedule(game, later, origin);
  return game;
}
export function quitParty(input, env) {
  const ctx = start(input);
  if (!ctx.game.party) throw new Error('Non fai parte di un partito.');
  const lines = applyEffects(ctx, { stats: { notoriety: 2, influence: -1 } });
  leaveParty(ctx, 'Uscita volontaria');
  addLog(ctx.game, env.currentDate, 'partito', 'Lasci il partito', lines, 'neutral');
  return { ctx };
}

// ---------- the internal life: the player's own moves ----------
// The request the player answers from the Party page (the same answers as in the agenda).
export function lifeRespond(input, env, requestId, choice) {
  const ctx = start(input);
  const request = ctx.game.party?.life?.requests?.find(item => item.id === requestId);
  if (!request) throw new Error('Questa richiesta non è più aperta.');
  if (!['accetta', 'accetta-controfferta', 'tratta', 'rifiuta', 'tempo'].includes(choice)) throw new Error('Risposta non valida.');
  if (choice === 'accetta-controfferta' && !request.counter) throw new Error('Non c’è nessuna controfferta.');
  const cost = choice === 'tratta' ? { capital: request.kind === 'ultimatum' ? 3 : 1 } : null;
  if (cost) { const problem = costProblem(ctx.game, cost); if (problem) throw new Error(problem); pay(ctx.game, cost, 'partito', 'Trattativa interna'); }
  const api = lifeApi(); api.date = env.currentDate;
  ctx.game.inbox = ctx.game.inbox.filter(item => item.params?.requestId !== requestId);
  const out = respondRequest(ctx.game, api, { requestId, choice, week: ctx.game.week.index, date: env.currentDate, rand: () => draw(ctx.game) });
  for (const entry of out.raises) raiseSituation(ctx, entry.id, entry.params, entry.urgent);
  settleMergers(ctx, env, out.specials);
  const verb = { accetta: 'accolta', 'accetta-controfferta': 'controfferta accolta', tratta: 'trattativa', rifiuta: 'respinta', tempo: 'rinviata' }[choice];
  addLog(ctx.game, env.currentDate, 'partito', `${request.title} — ${verb}`, out.lines, choice === 'rifiuta' ? 'bad' : 'neutral');
  return { ctx, specials: out.specials, lines: out.lines };
}
export function lifeBreakPact(input, env, pactId) {
  const ctx = start(input);
  if (!ctx.game.party?.life) throw new Error('Serve un partito.');
  const problem = costProblem(ctx.game, { capital: 1 });
  if (problem) throw new Error(problem);
  pay(ctx.game, { capital: 1 });
  const lines = breakPact(ctx.game, lifeApi(), { pactId, week: ctx.game.week.index, date: env.currentDate });
  addLog(ctx.game, env.currentDate, 'partito', 'Denunci un accordo interno', lines, 'bad');
  return { ctx, lines };
}
export function lifeCadre(input, env, { action, cadreId = null, committeeId = null }) {
  const spec = CADRE_ACTIONS[action];
  if (!spec) throw new Error('Azione non disponibile.');
  const ctx = start(input);
  if (!ctx.game.party?.org) throw new Error('Serve un partito.');
  const problem = costProblem(ctx.game, spec.cost);
  if (problem) throw new Error(problem);
  const lines = cadreAction(ctx.game, lifeApi(), { action, cadreId, committeeId, week: ctx.game.week.index, rand: () => draw(ctx.game) });
  pay(ctx.game, spec.cost, 'partito', spec.label, env.currentDate);
  if (spec.cost.ap) ctx.game.week.categoriesUsed = [...new Set([...ctx.game.week.categoriesUsed, 'territorio'])];
  addLog(ctx.game, env.currentDate, 'partito', spec.label, lines, 'neutral');
  return { ctx, lines };
}
export function lifeCongress(input, env, kind) {
  const cost = kind === 'mobilita' ? { ap: 1 } : kind === 'alleanza' ? { capital: 2 } : null;
  if (!cost) throw new Error('Azione non disponibile.');
  const ctx = start(input);
  if (!ctx.game.party?.life?.congress) throw new Error('Nessun congresso in preparazione.');
  const problem = costProblem(ctx.game, cost);
  if (problem) throw new Error(problem);
  pay(ctx.game, cost, 'partito', 'Lavoro per il congresso', env.currentDate);
  const lines = congressWork(ctx.game, lifeApi(), { kind, week: ctx.game.week.index });
  addLog(ctx.game, env.currentDate, 'partito', kind === 'mobilita' ? 'Mobiliti i quadri per il congresso' : 'Tessi le alleanze del congresso', lines, 'neutral');
  return { ctx, lines };
}
export function lifeRebuild(input, env, focus) {
  const ctx = asSecretary(input, { capital: 2 });
  const lines = startRebuild(ctx.game, lifeApi(), { focus, week: ctx.game.week.index, date: env.currentDate });
  ctx.game.inbox = ctx.game.inbox.filter(item => item.templateId !== 'ricostruzione-partito');
  addLog(ctx.game, env.currentDate, 'partito', 'Piano di ricostruzione del partito', lines, 'good');
  return { ctx, lines };
}
// Founding a party during the career (alone, or with the areas that follow), merging, renaming.
const partyIdFor = (game, label, week) => `partito-utente-${hash(`${game.seed}|${label}|${week}`) % 1000000}`;
export function lifeFound(input, env, { label, abbreviation = null, followerIds = [] }) {
  const ctx = start(input);
  const game = ctx.game;
  const clean = String(label ?? '').trim();
  if (clean.length < 3 || clean.length > 60) throw new Error('Il nome del partito deve avere da 3 a 60 caratteri.');
  const availability = partyOpsAvailability(game).found;
  if (!availability.ok) throw new Error(availability.reason);
  const followers = (followerIds ?? []).filter(id => game.party?.currents?.some(item => item.id === id));
  if (game.party && followers.length >= game.party.currents.length) throw new Error('Se tutte le aree ti seguono non è una nuova fondazione: resta con almeno un’area.');
  pay(game, OP_COSTS.found, 'partito', 'Fondazione del partito', env.currentDate);
  const week = game.week.index;
  const out = foundParty(game, lifeApi(), { newPartyId: partyIdFor(game, clean, week), label: clean, abbreviation, followerIds: followers, week, date: env.currentDate, rand: () => draw(game) });
  game.party.decisions = { ...(game.party.decisions ?? {}), found: week };
  addLog(game, env.currentDate, 'partito', `Fondi ${clean}`, out.lines, 'good');
  return { ctx, lines: out.lines, specials: [{ type: 'party-split', descriptor: out.descriptor, followed: true, founded: true, abbreviation }] };
}
export function lifeMerge(input, env, { forceId, label, share = 1, ownShare = 3, newLabel = null }) {
  const ctx = asSecretary(input, OP_COSTS.merge);
  const availability = partyOpsAvailability(ctx.game, { neighbours: [{ id: forceId }] }).merge;
  if (availability.reason && !availability.ok) throw new Error(availability.reason);
  const week = ctx.game.week.index;
  const founder = ctx.game.party.affiliation === 'founder';
  const out = mergeParties(ctx.game, lifeApi(), { forceId, label, share, ownShare, newLabel: founder ? newLabel : null, week, date: env.currentDate, rand: () => draw(ctx.game) });
  addLog(ctx.game, env.currentDate, 'partito', `Fusione con ${label}`, out.lines, 'neutral');
  return { ctx, lines: out.lines, specials: [{ type: 'party-merge', descriptor: out.descriptor }] };
}
export function lifeRename(input, env, { label, abbreviation = null, style = 'rilancio' }) {
  const ctx = start(input);
  const party = ctx.game.party;
  const availability = partyOpsAvailability(ctx.game).rename;
  if (!availability.ok) throw new Error(availability.reason);
  if (party.affiliation !== 'founder') throw new Error('Il nome di un partito esistente non si cambia: solo chi ha fondato il proprio partito può farlo.');
  pay(ctx.game, OP_COSTS.rename, 'partito', 'Cambio di nome', env.currentDate);
  const out = renameParty(ctx.game, lifeApi(), { label, abbreviation, style, week: ctx.game.week.index, date: env.currentDate });
  addLog(ctx.game, env.currentDate, 'partito', `Il partito diventa ${out.descriptor.label}`, out.lines, 'neutral');
  return { ctx, lines: out.lines, specials: [{ type: 'party-rename', descriptor: out.descriptor }] };
}
export { lifeOverview, partyOpsAvailability };

// ---------- objectives ----------
// The goals are measured on what the player does (objective-engine reads the ledger and the state); reaching one pays
// its reward, unlocks what it says (relations that settle higher, weight in promotions and candidacies) and may put
// a new decision on the desk. A goal declared in public (an ambition) pays double if kept and costs if broken.
const goalExtras = game => ({ memoryNet: memoryBalance(game).net });
export function refreshObjectives(ctx, env, lines = [], date) {
  const game = ctx.game;
  game.objectives ??= {};
  let status = objectiveStatus(ctx, env, goalExtras(game));
  // Saves from before the goals were measured: the new goals already met are written down quietly, with no reward.
  if (!game.objectivesV) {
    game.objectivesV = 2;
    if (game.week.index > 1) for (const item of status) if (!isClassicObjective(item.id) && item.available && item.met && !item.done) game.objectives[item.id] = { completedAt: date, week: game.week.index, silent: true, source: SIM };
    status = objectiveStatus(ctx, env, goalExtras(game));
  }
  const completed = [];
  for (const item of status) {
    if (item.done || !item.available || !item.met) continue;
    const declared = (game.ambitions ?? []).find(entry => entry.id === item.id) ?? null;
    game.objectives[item.id] = { completedAt: date, week: game.week.index, ...(declared ? { declared: true } : {}), source: SIM };
    const reward = item.reward ?? {};
    const effects = { capital: (reward.capital ?? 0) * (declared ? AMBITION_KEPT.capitalFactor : 1), stats: { ...(reward.stats ?? {}) }, relations: reward.relations, party: reward.party, standing: reward.standing, sector: reward.sector };
    if (declared) for (const [metric, value] of Object.entries(AMBITION_KEPT.stats)) effects.stats[metric] = round2((effects.stats[metric] ?? 0) + value);
    const rewardLines = [];
    applyEffects(ctx, effects, null, rewardLines, { source: `Traguardo: ${item.label}`, date });
    if (declared) {
      game.ambitions = game.ambitions.filter(entry => entry.id !== item.id);
      bumpAmbition(game, 'kept');
      remember(game, { date, kind: 'promessa-mantenuta', text: `Obiettivo dichiarato e raggiunto: ${item.label}`, weight: 1 });
    }
    if (item.memory) remember(game, { date, ...item.memory });
    if (item.unlock) {
      game.unlocks = { ...(game.unlocks ?? {}), [item.id]: { week: game.week.index, label: item.label, text: item.unlock.text, base: item.unlock.base ?? null, mods: item.unlock.mods ?? null } };
      if (item.unlock.offer) raiseSituation(ctx, item.unlock.offer, {}, false);
    }
    completed.push(item);
    lines.push(`Traguardo raggiunto: ${item.label}`);
    addLog(game, date, 'traguardo', `Traguardo${declared ? ' dichiarato' : ''}: ${item.label}`, [...rewardLines, item.unlock?.text ? `Sblocchi: ${item.unlock.text}` : null].filter(Boolean), 'good');
  }
  return completed;
}
// The state of every goal, for the pages.
export function objectiveProgress(ctx, env) {
  return objectiveStatus(ctx, env, goalExtras(ctx.game));
}
// Declaring a goal in public: a commitment with a deadline. Kept, it pays double and builds credibility; broken, it costs.
export function declareAmbition(input, env, id) {
  const ctx = start(input);
  const spec = OBJECTIVE_BY_ID[id];
  const problem = ambitionProblem(ctx, env, spec) || costProblem(ctx.game, AMBITION_COST);
  if (problem) throw new Error(problem);
  const week = ctx.game.week.index;
  pay(ctx.game, AMBITION_COST, 'altro', `Obiettivo dichiarato: ${spec.label}`, env.currentDate);
  ctx.game.ambitions = [...(ctx.game.ambitions ?? []), { id, week, deadline: week + spec.ambition.weeks, source: SIM }];
  bumpAmbition(ctx.game, 'declared');
  remember(ctx.game, { date: env.currentDate, kind: 'decisione', text: `Dichiari pubblicamente: ${spec.label}`, weight: 0.5 });
  addLog(ctx.game, env.currentDate, 'traguardo', `Obiettivo dichiarato: ${spec.label}`, [`Scadenza: settimana ${week + spec.ambition.weeks} · se lo manchi paghi in credibilità, se lo mantieni il premio raddoppia`], 'neutral');
  return { ctx, ambition: ctx.game.ambitions.at(-1), objective: spec };
}
// An ambition not kept by its deadline is remembered as a promise broken.
function expireAmbitions(ctx, date, lines) {
  const game = ctx.game;
  for (const item of expiredAmbitions(game, game.week.index)) {
    const spec = OBJECTIVE_BY_ID[item.id];
    if (game.objectives?.[item.id]) continue;
    applyEffects(ctx, { stats: AMBITION_BROKEN.stats }, null, [], { source: `Obiettivo mancato: ${spec?.label ?? item.id}`, date });
    bumpAmbition(game, 'broken');
    remember(game, { date, kind: 'promessa-tradita', text: `Obiettivo dichiarato e mancato: ${spec?.label ?? item.id}`, weight: 1 });
    addLog(game, date, 'traguardo', `Obiettivo mancato: ${spec?.label ?? item.id}`, ['La scadenza è passata: reputazione −2, popolarità −1 e un impegno non mantenuto nella memoria politica.'], 'bad');
    lines.push(`Obiettivo mancato: ${spec?.label ?? item.id}`);
  }
  game.ambitions = (game.ambitions ?? []).filter(item => item.deadline >= game.week.index);
}

// ---------- elections ----------
export function openElection(game, type, date) {
  return game.elections.find(item => item.type === type && item.status === 'open' && date >= item.windowOpensAt && date <= item.windowClosesAt) ?? null;
}
export function upcomingElections(game) {
  return [...game.elections].filter(item => item.status !== 'held').sort((a, b) => a.windowOpensAt.localeCompare(b.windowOpensAt));
}
// ---------- a relevant vote every year ----------
// Five-year mandates and four votes of the player's own (comune, regione, politiche, europee) leave years without a vote.
// The spring round of the amministrative (every year, in hundreds of comuni: Eligendo calendar) fills them: when more
// than a year — or a whole calendar year — would pass without a vote, that round becomes the player's round. The party
// asks for a campaign in the comuni at the polls and the result weighs on who took part, and on who stayed out.
const springRound = year => sundayOnOrBefore(`${year}-05-31`);
export const upcomingRounds = game => (game?.rounds ?? []).filter(item => item.status !== 'held').sort((a, b) => a.electionDate.localeCompare(b.electionDate));
// The dates of the rounds needed from the last vote on (own votes and rounds already under way count as votes).
export function roundPlan(game, today) {
  const fixed = (game.rounds ?? []).filter(item => item.status !== 'upcoming').map(item => item.electionDate);
  const events = [...new Set([...(game.elections ?? []).map(item => item.electionDate), ...fixed])].filter(Boolean).sort();
  const horizon = advanceDays(today, 400);
  const plan = [];
  let last = [game.roundsFrom ?? today, ...events.filter(date => date <= today)].sort().at(-1);
  for (let guard = 0; last < horizon && guard < 80; guard++) {
    const cap = [advanceDays(last, ROUND_RULES.maxGapDays), `${Number(last.slice(0, 4)) + 1}-12-31`].sort()[0];
    const next = events.find(date => date > last);
    if (next && next <= cap) { last = next; continue; }
    const year = Number(last.slice(0, 4));
    last = springRound(year) > last ? springRound(year) : springRound(year + 1);
    plan.push(last);
  }
  return plan;
}
function planRounds(game, today, localRounds = null) {
  const plan = roundPlan(game, today);
  // A round no longer needed (an early vote has filled the year) leaves the calendar until its campaign has started.
  const rounds = (game.rounds ?? []).filter(item => item.status !== 'upcoming' || plan.includes(item.electionDate));
  for (const day of plan.filter(date => date > today && !rounds.some(item => item.electionDate === date))) {
    const year = Number(day.slice(0, 4));
    rounds.push({ id: `tornata-${day}`, type: 'amministrative', year, label: `Amministrative ${year}`, electionDate: day, windowOpensAt: advanceDays(day, -ROUND_RULES.leadDays), comuni: null, status: 'upcoming', engagement: null, outcome: null, source: SIM });
  }
  for (const round of rounds) if (!round.comuni && localRounds?.[round.electionDate]) round.comuni = localRounds[round.electionDate];
  const held = rounds.filter(item => item.status === 'held').slice(-4);
  game.rounds = [...held, ...rounds.filter(item => item.status !== 'held')].sort((a, b) => a.electionDate.localeCompare(b.electionDate));
}
function updateRounds(ctx, env, date, lines) {
  const game = ctx.game;
  game.roundsFrom ??= date;
  planRounds(game, date, env.localRounds);
  for (const round of game.rounds) {
    if (round.status === 'upcoming' && date >= round.windowOpensAt && date < round.electionDate && !game.flags?.president) {
      round.status = 'open';
      raiseSituation(ctx, 'tornata-amministrativa', { roundId: round.id, year: round.year, when: formatDate(round.electionDate), count: round.comuni ? `${round.comuni} comuni` : 'centinaia di comuni', side: game.party?.label ?? 'le liste civiche a te vicine', dedupe: round.id });
      lines.push(`${round.label}: il ${formatDate(round.electionDate)} si vota nei comuni, decidi quanto impegnarti.`);
    }
    if (round.status !== 'held' && date >= round.electionDate) {
      round.status = 'held';
      // The result: the party's course in the polls, chance and the campaign done.
      const engagement = round.engagement ?? 'sostegno';
      const score = clamp(env.pollDelta ?? 0, -1.5, 1.5) * 0.8 + (draw(game) - 0.5) * 2.4 + (ROUND_RULES.engagement[engagement] ?? 0);
      const code = score > 0.45 ? 'buono' : score < -0.45 ? 'deludente' : 'in-linea';
      const outcome = ROUND_RULES.outcomes[code];
      const roundLines = applyEffects(ctx, outcome[engagement] ?? {}, null, [], { source: round.label, date });
      round.outcome = { code, label: outcome.label, engagement };
      if (engagement === 'giro' && code !== 'in-linea') remember(game, { date, kind: code === 'buono' ? 'vittoria-elettorale' : 'sconfitta-elettorale', text: `${round.label}: ${code === 'buono' ? 'la campagna nei comuni paga' : 'una campagna nei comuni finita male'}`, region: game.place?.region ?? null, weight: 0.4 });
      const title = `${round.label}: ${outcome.label}${game.party ? ` per ${game.party.label ?? 'il partito'}` : ''}`;
      addLog(game, date, 'elezioni', title, [{ giro: 'Hai fatto campagna nei comuni al voto.', sostegno: 'Hai sostenuto i candidati a distanza.', fuori: 'Sei rimasto fuori dalla campagna.' }[engagement], ...roundLines], outcome.tone);
      lines.push(title);
    }
  }
}
export function markElectionRunning(game, electionId, campaignId) {
  return { ...game, elections: game.elections.map(item => item.id === electionId ? { ...item, status: 'running', campaignId } : item) };
}
function reschedule(game, entry) {
  // The next general election at the natural end of the new legislature; the European ones five years later.
  if (entry.type === 'politiche') { game.elections.push(makeNationalElection('politiche', legislatureTerm(game.legislature).plannedVote, game.place)); return; }
  if (entry.type === 'europee') { game.elections.push(makeNationalElection('europee', europeanElectionDate(entry.electionDate), game.place)); return; }
  // Local votes on their calendar: five years (a comune in its spring round), also after an early vote.
  if (entry.calendar || game.flags?.localCalendar === 1) { game.elections.push(makeLocalElection(entry.type, entry.electionDate, entry.electionDate, game.place, entry.calendar === 'reale')); return; }
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
  if (entry.type === 'politiche') nextLegislature(next, entry.electionDate);
  reschedule(next, entry);
  return next;
}
function updateElections(ctx, date, lines, specials) {
  const game = ctx.game;
  for (const entry of [...game.elections]) {
    // The President of the Republic stands in no election: the country votes without the office-holder.
    const president = Boolean(game.flags?.president);
    if (entry.status === 'upcoming' && date >= entry.windowOpensAt) {
      entry.status = president ? 'missed' : 'open';
      if (!president) lines.push(`Si apre la finestra delle candidature: ${entry.label} (fino al ${entry.windowClosesAt}).`);
    }
    if (entry.status === 'open' && date > entry.windowClosesAt) {
      entry.status = 'missed';
      lines.push(`Candidature chiuse senza di te: ${entry.label}.`);
      specials.push({ type: 'election-missed', electionType: entry.type });
    }
    if (entry.status === 'missed' && date >= entry.electionDate) {
      entry.status = 'held';
      if (entry.type === 'politiche') { nextLegislature(game, entry.electionDate); lines.push(`Si vota: si apre la ${game.legislature.label}.`); }
      reschedule(game, entry);
      // The country votes without the player: the store runs the national vote (legislature-engine).
      if (['politiche', 'europee'].includes(entry.type)) specials.push({ type: 'national-vote', electionType: entry.type, date: entry.electionDate, electionId: entry.id });
    }
  }
  // A government that stays fallen long enough brings the general election forward.
  const government = ctx.parliament?.government;
  game.fallenWeeks = government?.status === 'fallen' ? (game.fallenWeeks ?? 0) + 1 : 0;
  const politics = game.elections.find(item => item.type === 'politiche' && item.status === 'upcoming');
  if (game.fallenWeeks >= EARLY_ELECTION_AFTER_WEEKS && politics && politics.windowOpensAt > advanceDays(date, 7)) {
    bringElectionForward(game, politics, date);
    lines.push('Nessuna maggioranza dopo la caduta del governo: si va alle politiche anticipate.');
  }
}
function bringElectionForward(game, politics, date) {
  // Candidacies open in a week; the country votes on the first Sunday after the campaign.
  const earliest = advanceDays(date, 7 + ELECTION_MODELS.politiche.campaignDays);
  const early = makeNationalElection('politiche', sundayOnOrBefore(advanceDays(earliest, 6)), game.place, true);
  Object.assign(politics, { ...early, id: politics.id });
  game.fallenWeeks = 0;
}
// The Chambers are dissolved (no Government after the vote): the general election is brought forward, the
// candidacies open in a week and the country votes after the campaign.
export function scheduleEarlyElection(input, date) {
  const game = copy(input);
  const politics = game.elections.find(item => item.type === 'politiche' && item.status === 'upcoming');
  if (politics && politics.windowOpensAt > advanceDays(date, 7)) bringElectionForward(game, politics, date);
  return game;
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
  const finance = settleFinanceWeek(game, { week: closing, date, incomes, partyContribution: contribution, rand: () => draw(game) });
  if (contribution) treasuryBook(game.party.org, contribution, 'contributi', 'Contributo degli eletti');
  const budget = finance.effects;
  applyEffects(ctx, { stats: budget.stats, relations: budget.relations, prep: budget.prep, capital: budget.capital, party: budget.party ? { support: budget.party } : undefined }, null, [], { source: 'Spese ricorrenti del comitato' });
  if (budget.territory) game.week.categoriesUsed = [...new Set([...game.week.categoriesUsed, 'territorio'])];
  lines.unshift(`Entrate della settimana: ${total} €${contribution ? ` (di cui ${contribution} € versati al partito)` : ''}`, ...finance.lines.slice(0, 2));
  if (finance.crisis) raiseSituation(ctx, 'crisi-finanziaria', {}, true);
  const party = game.party;
  if (party?.org) {
    const org = advanceOrganization(party.org, {
      rand: () => draw(game), week: closing, date, seed: game.seed, pollShare: env.pollShare ?? null, pollDelta: env.pollDelta ?? 0,
      mood: env.mood ?? 50, rank: party.rank, founder: party.affiliation === 'founder', support: party.support, currents: party.currents,
      campaignActive: env.campaign?.status === 'active', line: party.line ?? null,
      preferredLines: CURRENT_LINES, congressInWeeks: (party.org.congress?.nextWeek ?? closing + 99) - closing,
      program: party.program ?? null, candidacyRule: party.candidacyRule ?? null
    });
    lines.push(...org.lines.slice(0, 2));
    // Territorial committees: their week, and a decision when one of the player's own territory is in trouble.
    if (party.org.committees?.length) {
      const territory = advanceCommittees(party.org, { rand: () => draw(game), week: closing, regionalShares: env.regionalShares ?? {}, nationalShare: env.pollShare ?? null, currents: party.currents, campaignActive: env.campaign?.status === 'active', founder: party.affiliation === 'founder', line: party.line ?? null, preferredLines: CURRENT_LINES, homeRegion: game.place?.region ?? null, ownPerks: game.finance?.perks ?? {}, cadres: party.life?.cadres ?? [] });
      lines.push(...territory.lines.slice(0, 1));
      // A local event in the player's own territory: an opportunity, a scandal, a competitor (one decision at a time).
      const local = territory.events.find(event => event.type === 'local');
      if (local && !game.inbox.some(item => item.templateId?.startsWith('comitato-locale-'))) raiseSituation(ctx, `comitato-locale-${local.kind}`, { committee: local.name, committeeId: local.committee, committeeLevel: COMMITTEE_LEVELS[local.level].label.toLowerCase() });
      const trouble = territory.events.find(event => event.type === 'committee' && event.status !== 'dissoluzione' && party.org.committees.find(item => item.id === event.committee)?.region === game.place?.region);
      if (trouble && !game.inbox.some(item => item.templateId === 'comitato-in-crisi')) raiseSituation(ctx, 'comitato-in-crisi', { committee: trouble.name, committeeId: trouble.committee, committeeLevel: COMMITTEE_LEVELS[trouble.level].label, committeeStatus: COMMITTEE_STATES[trouble.status].label.toLowerCase() });
    }
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
    // The internal life: the people behind the currents act, agreements run and expire, the congress takes shape.
    const life = advanceLife(game, lifeApi(), { week: closing, date, rand: () => draw(game), env });
    lines.push(...life.lines.slice(0, 2));
    for (const item of life.raises) raiseSituation(ctx, item.id, item.params, item.urgent);
    specials.push(...life.specials);
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
      if (soon && isSecretary(party)) { party.org.selections = { ...party.org.selections, [soon.id]: { method: 'segreteria', bonus: 6, week: closing, election: soon.label, source: SIM } }; lines.push(`Da segretario compili tu le liste per ${soon.label}.`, ...honourListPacts(game, lifeApi(), { week: closing, date }), ...honourCadrePromises(game, lifeApi(), { week: closing, date, electionId: soon.id })); }
      else if (soon && !game.inbox.some(item => item.templateId === 'selezione-candidati')) raiseSituation(ctx, 'selezione-candidati', { election: soon.label, electionId: soon.id });
    }
  }
  // A reputable parliamentarian outside the party leadership can be called into the scenario executive.
  const seat = Boolean(ctx.parliament?.player?.groupId);
  const playerGovernment = ['active', 'crisis'].includes(ctx.parliament?.government?.status);
  if (seat && !isSecretary(game.party) && !game.flags.scenarioOffice && !playerGovernment && (ctx.stats.reputation ?? 0) >= 55 && (ctx.stats.influence ?? 0) >= 45 && draw(game) < 0.04) raiseSituation(ctx, 'offerta-governo');
  // Real parliamentarians react to the player's initiatives (the reaction is simulated); in Chambers born from a vote of
  // the game they do not sit, so they do not act on the player's bills.
  const simulatedChambers = ctx.parliament?.legislature?.reference === 'simulation';
  const laws = simulatedChambers ? [] : (ctx.parliament?.laws ?? []).filter(law => !['approved', 'rejected', 'lapsed'].includes(law.stage));
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
    const base = clamp((RELATION_BASES[item.id] ?? 50) + startBase(game, item.id) + objectiveBase(game, item.id));
    if (Math.abs(item.value - base) > 2) item.value = round2(item.value + (item.value > base ? -0.5 : 0.5));
  }
  const standing = ctx.parliament?.careerStanding;
  if (standing && Math.abs(standing.partySupport - 50) > 2) standing.partySupport = round2(standing.partySupport + (standing.partySupport > 50 ? -0.5 : 0.5));
}
const defaultChoiceOf = item => freeDefault(templateFor(item)?.choices ?? [], item.defaultChoice);
export function advanceWeek(input, env, governmentWeek = parliament => parliament) {
  const ctx = { game: copy(input.game), stats: { ...input.stats }, parliament: copy(input.parliament) };
  const game = ctx.game;
  const date = env.currentDate;
  const lines = [];
  const specials = [];
  if (game.status === 'ended') return { ctx, specials, report: null };
  const closing = game.week.index;
  for (const item of [...game.inbox]) {
    if ((item.holdUntilWeek ?? 0) > closing || (item.holdUntilDate && item.holdUntilDate > date)) continue;
    const choice = defaultChoiceOf(item);
    game.inbox = game.inbox.filter(entry => entry.id !== item.id);
    if (!choice) continue;
    const itemLines = [];
    if (item.kind !== 'appuntamento') bumpDecision(game, 'delegated');
    const tone = runChoice(ctx, env, item, choice, itemLines, specials);
    if (item.kind !== 'appuntamento' || itemLines.length) addLog(game, date, item.kind, `${item.title} — ${fill(choice.label, item.params)} (senza decisione)`, itemLines, tone);
    if (item.kind !== 'appuntamento') lines.push(`Senza una tua decisione: ${item.title}`);
    if (game.status === 'ended') break;
  }
  if (game.status !== 'ended') resolvePending(ctx, env, date, lines);
  if (game.status !== 'ended') {
    const budget = weeklySystems(ctx, env, date, closing, lines, specials);
    // The starting conditions go on: creditors ask, enemies strike, the apparatus tests the outsider, the past resurfaces.
    if (game.start && !game.flags?.president) {
      const pressure = advanceStart(game, lifeApi(), { week: closing, date, stats: ctx.stats, seat: Boolean(ctx.parliament?.player?.groupId), mandates: (env.career?.electionHistory ?? []).filter(item => item.personalMandate).length });
      lines.push(...pressure.lines);
      for (const item of pressure.raises) raiseSituation(ctx, item.id, item.params, item.urgent);
      for (const entry of pressure.logs) addLog(game, date, entry.kind, entry.title, entry.lines, entry.tone);
    }
    const capitalGain = Math.max(0, Math.round(2 + (ctx.stats.influence ?? 30) / 25 + ((game.party?.rank ?? 0) >= 2 ? 1 : 0) + rules(game).capitalGain + scenarioCapitalGain(game)));
    game.resources.politicalCapital = clamp(game.resources.politicalCapital + capitalGain);
    lines[0] += ` · capitale politico +${capitalGain}`;
    game.week.nextStaffDays = budget.staffDays;
    drift(ctx, lines);
    // The reputations drift back, the influence earned fades unless the office keeps it alive.
    advanceStanding(game, { held: holdingsOf(ctx, env), floors: env.standingFloors ?? {}, week: closing });
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
    updateRounds(ctx, env, date, lines);
    const days = WEEKLY_ACTION_POINTS + (game.week.nextStaffDays ?? 0) + rules(game).apBonus;
    game.week = { index: closing + 1, startedAt: date, ap: days, maxAp: days, categoriesUsed: [] };
    fillInbox(ctx, env, lines, specials);
  }
  const deltas = Object.fromEntries(Object.keys(STAT_LABELS).map(metric => [metric, round2((ctx.stats[metric] ?? 0) - (game.weekStartStats?.[metric] ?? ctx.stats[metric] ?? 0))]).filter(([, delta]) => delta));
  game.weekStartStats = { ...ctx.stats };
  game.whyLast = { week: closing, entries: game.why?.entries ?? [] };
  game.why = { week: closing + 1, entries: [] };
  refreshObjectives(ctx, env, lines, date);
  expireAmbitions(ctx, date, lines);
  game.lastReport = { week: closing, date, lines, deltas, source: SIM };
  return { ctx, specials, report: game.lastReport };
}

export function relationValue(game, id) {
  return relationList(game).find(item => item.id === id)?.value ?? null;
}
