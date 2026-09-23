import { DATA_SOURCES, emptyDataset, isSelectableParty } from '../data/schema.js?v=20260924-5';
import { makeDemoParties, makeDemoState } from '../data/demo.js?v=20260924-5';
import { CAREER_LEVELS, initialCareerStatistics } from '../data/regions.js?v=20260924-5';
import { storage } from './storage.js?v=20260924-5';
import { advanceDays, formatDate } from './time.js?v=20260924-5';
import { validateNewCareerDraft } from './career-rules.js?v=20260924-5';
import { advanceCampaign, breakCampaignAlliance, createCampaign, decideCampaignEvent, negotiateCampaignAlliance, performCampaignActivity } from './campaign-engine.js?v=20260924-5';
import { activeMinisters, advanceGovernmentWeek, majorityShift, advanceLaw, amendLaw, assignMinister, assignPlayerGroup, canManageParliament, compromiseLaw, contestCommitteeRole, createParliamentState, enterParliament, formGovernment, leaveParliament, negotiateGovernmentSupport, negotiateLaw, normalizeParliamentState, proposeLaw, reviseGovernmentCoalition, triggerGovernmentCrisis, voteGovernmentConfidence } from './parliament-engine.js?v=20260924-5';
import { addWorldReaction, advanceWeek, alignCurrent, contestPartyRank, createGameState, joinParty, markElectionHeld, markElectionRunning, normalizeGameState, openElection, performActivity, quitParty, refreshObjectives, relationValue, resolveInboxItem, spendTime, upcomingElections } from './career-engine.js?v=20260924-5';
import { PARLIAMENT_TIME_COSTS } from '../data/simulation/career-rules.js?v=20260924-5';
import { advanceWorld, applyWorldSignals, breakAlliance, campaignPollBonus, createWorld, normalizeWorld, proposeAlliance, setPlayerParty } from './world-engine.js?v=20260924-5';

const STATE_VERSION = 6;
const PARLIAMENTARY_CAMPAIGN_ROLES = Object.freeze({ deputato: 'camera', uninominale: 'camera', senatore: 'senato' });
const isRestorableSave = saved => saved && typeof saved === 'object' && saved.career && typeof saved.career === 'object' && saved.clock?.currentDate && saved.dataset && Array.isArray(saved.dataset.politicians);

const storedState = storage.load();
function hydrateState(saved) {
  if (!saved) return makeDemoState();
  if (!isRestorableSave(saved)) {
    // Keep the unreadable save aside instead of overwriting it with the demo.
    storage.backup(saved, 'struttura-non-valida');
    return makeDemoState();
  }
  if (saved.version >= 5) return saved;
  if (saved.version >= 4) return { ...saved, parliament: saved.parliament ?? null };
  if (saved.version >= 3) return { ...saved, campaign: saved.campaign ?? null, parliament: null };
  const fresh = makeDemoState();
  if (saved.clock?.currentDate) fresh.clock = { ...fresh.clock, ...saved.clock };
  if (saved.ui?.activePage) fresh.ui.activePage = saved.ui.activePage;
  if (saved.version >= 2) {
    const collections = Object.keys(fresh.dataset);
    for (const collection of collections) {
      if (Array.isArray(fresh.dataset[collection])) {
        fresh.dataset[collection] = (saved.dataset?.[collection] ?? []).filter(record => record.source === DATA_SOURCES.SIMULATION || record.source === DATA_SOURCES.USER);
      }
    }
    fresh.career = saved.career ?? fresh.career;
    fresh.ui = { ...fresh.ui, ...saved.ui };
    fresh.campaign = saved.campaign ?? null;
    fresh.parliament = saved.parliament ?? null;
  }
  return fresh;
}

const playerOf = s => s.dataset.politicians.find(item => item.id === s.career.playerId) ?? null;
const statsOf = s => Object.fromEntries(s.dataset.statistics.filter(item => item.subjectId === s.career.playerId).map(item => [item.metric, item.value]));
const playerStat = (s, metric, fallback = 50) => statsOf(s)[metric] ?? fallback;
const elapsedDays = (from, to) => Math.max(0, Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000));
const round2 = value => Math.round(value * 100) / 100;

// Verified deputies of the player's own circoscrizione, from different groups, as campaign opponents.
const territoryKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z]/g, '');
function pertinentDeputies(people = {}, region, seedText) {
  const target = territoryKey(region);
  if (!target) return [];
  const groups = new Map((people.groups ?? []).map(group => [group.id, group.officialName]));
  const rank = person => [...`${seedText}|${person.id}`].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7);
  const pool = (people.politicians ?? []).filter(person => person.source === DATA_SOURCES.REAL && person.verified === true && person.chamber === 'camera' && territoryKey(person.circoscription).startsWith(target)).sort((a, b) => rank(a) - rank(b));
  const picked = [];
  for (const person of pool) {
    if (picked.length === 3) break;
    if (picked.some(item => item.groupId === person.groupId)) continue;
    picked.push({ id: person.id, fullName: person.fullName, chamber: person.chamber, groupId: person.groupId, groupName: groups.get(person.groupId) ?? null, electedOnList: person.electedOnList ?? null, circoscription: person.circoscription, sourceUrl: person.sourceUrl, sourceName: person.sourceName });
  }
  return picked;
}

function buildGame(s, { partyLabel = null, founder = null, funds = null } = {}) {
  const player = playerOf(s);
  const partyId = player ? player.partyId : s.career.partyId;
  const partyRecord = s.dataset.parties.find(item => item.id === partyId);
  return createGameState({
    seedText: `${player?.displayName}|${player?.birthDate}|${s.career.startedAt}|${s.career.initialLevel}`,
    currentDate: s.clock.currentDate, level: s.career.initialLevel,
    party: partyId ? { id: partyId, label: partyLabel ?? partyRecord?.officialName ?? partyRecord?.name ?? null, founder: founder ?? partyRecord?.source === DATA_SOURCES.USER } : null,
    place: { municipality: player?.municipality ?? null, region: player?.region ?? null },
    stats: statsOf(s), parliament: s.parliament, funds
  });
}
function withCapital(parliament, game) {
  if (!parliament || !game) return parliament;
  return { ...parliament, resources: { ...parliament.resources, politicalCapital: game.resources.politicalCapital } };
}
// The player's party as the simulated world sees it: a real party is only an id and a label.
function worldPartyOf(s, record = null) {
  const player = playerOf(s);
  const partyId = player ? player.partyId : s.career.partyId;
  if (!partyId) return null;
  const known = record ?? s.dataset.parties.find(item => item.id === partyId) ?? null;
  const consensus = s.dataset.statistics.find(item => item.subjectId === partyId && item.metric === 'consensus')?.value;
  return {
    id: partyId, label: known?.officialName ?? known?.name ?? s.game?.party?.label ?? null, abbreviation: known?.abbreviation ?? null,
    brandColor: known?.color ?? null, refSource: known?.source ?? DATA_SOURCES.REAL, orientation: known?.orientation ?? null,
    founder: s.game?.party?.affiliation === 'founder', initialShare: Number.isFinite(consensus) ? consensus : undefined
  };
}
function buildWorld(s, record = null) {
  const player = playerOf(s);
  return createWorld({
    seedText: `${player?.displayName}|${player?.birthDate}|${s.career.startedAt}|${s.career.initialLevel}`,
    date: s.clock.currentDate, week: s.game?.week.index ?? 1, place: { region: player?.region ?? null, municipality: player?.municipality ?? null },
    playerParty: worldPartyOf(s, record), demoParties: s.dataset.parties.filter(item => item.source === DATA_SOURCES.SIMULATION).map(item => ({ id: item.id, label: item.name, abbreviation: item.abbreviation })),
    stats: statsOf(s)
  });
}
// The demo protagonist used to carry a realistic invented name: it becomes an explicit demo label.
function renameLegacyDemo(raw) {
  const politicians = raw.dataset?.politicians;
  if (!politicians?.some(item => item.id === 'politico-demo' && item.displayName === 'Giulia Rinaldi')) return raw;
  return { ...raw, dataset: { ...raw.dataset, politicians: politicians.map(item => item.id === 'politico-demo' && item.displayName === 'Giulia Rinaldi' ? { ...item, firstName: 'Profilo', lastName: 'Demo', displayName: 'Profilo demo (simulato)' } : item) } };
}
function prepareState(input) {
  const raw = renameLegacyDemo(input);
  const parliament = normalizeParliamentState(raw.parliament);
  const base = { ...raw, version: STATE_VERSION, campaign: raw.campaign ?? null, parliament };
  const game = normalizeGameState(raw.game) ?? buildGame(base);
  const world = normalizeWorld(raw.world) ?? buildWorld({ ...base, game });
  return { ...base, game, world, parliament: withCapital(parliament, game) };
}

const hydratedState = hydrateState(storedState);
let state = prepareState(hydratedState);
let lastSaved = storedState ? (isRestorableSave(storedState) ? 'Salvataggio caricato' : 'Salvataggio non valido: copia conservata') : 'Nuova carriera demo';
if (isRestorableSave(storedState) && storedState.version < STATE_VERSION) {
  try { storage.save(state); lastSaved = 'Salvataggio aggiornato'; } catch { lastSaved = 'Salvataggio locale non disponibile'; }
}
const listeners = new Set();

function emit() { for (const listener of listeners) listener(state, lastSaved); }
function persist() {
  try {
    storage.save(state);
    lastSaved = `Salvato alle ${new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  } catch { lastSaved = 'Salvataggio non disponibile'; }
}
function makeId(prefix) {
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${token}`;
}

const roundStat = value => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
const playerStats = s => Object.fromEntries(['influence', 'reputation', 'experience'].map(metric => [metric, playerStat(s, metric)]));
const chamberInstitution = chamber => chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica';
const gameEnv = s => ({ career: s.career, offices: s.dataset.offices, campaign: s.campaign, player: playerOf(s), currentDate: s.clock.currentDate });

function writeStats(s, stats) {
  const playerId = s.career.playerId;
  const date = s.clock.currentDate;
  const statistics = s.dataset.statistics.map(item => item.subjectId === playerId && item.metric in stats && item.value !== stats[item.metric] ? { ...item, value: stats[item.metric], asOf: date, source: DATA_SOURCES.SIMULATION } : item);
  for (const [metric, value] of Object.entries(stats)) {
    if (!statistics.some(item => item.subjectId === playerId && item.metric === metric)) statistics.push({ id: makeId('stat-' + metric), subjectId: playerId, metric, value, unit: '100', asOf: date, source: DATA_SOURCES.SIMULATION });
  }
  return statistics;
}

// Simulated offices mirror parliamentary, party and government roles in the career record.
function openOffice(dataset, office) {
  return { ...dataset, offices: [...dataset.offices, { level: 'parlamentare', endDate: null, source: DATA_SOURCES.SIMULATION, ...office }] };
}
function closeOffices(dataset, ids, date) {
  const closing = new Set(ids.filter(Boolean));
  if (!closing.size) return dataset;
  return { ...dataset, offices: dataset.offices.map(item => closing.has(item.id) && !item.endDate ? { ...item, endDate: date } : item) };
}
function closeTermOffices(dataset, playerId, electionType, date) {
  const levels = electionType === 'politiche' ? ['politiche', 'deputato', 'senatore'] : [electionType];
  return { ...dataset, offices: dataset.offices.map(item => item.politicianId === playerId && !item.endDate && levels.includes(item.level) && !/inizial/i.test(item.title) ? { ...item, endDate: date } : item) };
}
const roleOfficeId = role => 'incarico-' + role.id;
const ministerOfficeId = appointment => 'incarico-' + appointment.id;
function endedRoleOfficeIds(before, after) {
  const closedNow = (after?.careerStanding?.roles ?? []).filter(role => role.endedAt).map(role => role.id);
  return (before?.careerStanding?.roles ?? []).filter(role => !role.endedAt && (closedNow.includes(role.id) || !after?.careerStanding)).map(roleOfficeId);
}
function endedMinisterOfficeIds(before, after) {
  const open = new Set(activeMinisters(after?.government).filter(item => item.playerAppointed).map(item => item.id));
  return activeMinisters(before?.government).filter(item => item.playerAppointed && !open.has(item.id)).map(ministerOfficeId);
}
function withObjectives(s) {
  if (!s.game || s.game.status === 'ended') return s;
  const ctx = { game: JSON.parse(JSON.stringify(s.game)), stats: statsOf(s), parliament: s.parliament };
  if (!refreshObjectives(ctx, gameEnv(s), [], s.clock.currentDate).length) return s;
  return { ...s, game: ctx.game, parliament: withCapital(s.parliament, ctx.game) };
}

function worldSignalsFrom(entries, parliament) {
  const government = parliament?.government;
  const inMajority = Boolean(government && parliament.player?.groupId && [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(parliament.player.groupId));
  const lawTitle = id => parliament?.laws.find(law => law.id === id)?.title ?? 'proposta';
  return entries.flatMap(entry => {
    if (entry.type === 'iter-approved') return [{ type: 'law-approved', title: lawTitle(entry.details?.lawId) }];
    if (entry.type === 'iter-rejected') return [{ type: 'law-rejected', title: lawTitle(entry.details?.lawId) }];
    if (entry.type === 'fiducia-ottenuta') return [{ type: 'government-formed', inMajority }];
    if (entry.type === 'fiducia-negata') return [{ type: 'government-fallen', inMajority }];
    if (['crisi-governo', 'crisi-spontanea'].includes(entry.type) || (entry.type === 'cambio-maggioranza' && government?.status === 'crisis')) return [{ type: 'crisis', inMajority }];
    if (entry.type === 'nomina-ministro-giocatore') return [{ type: 'minister', portfolio: government?.ministers.find(item => item.id === entry.details?.appointmentId)?.portfolio ?? 'ministero' }];
    return [];
  });
}

function computeParliamentUpdate(currentState, parliament, toast, metricDeltas = {}, officeChanges = {}) {
  const currentDate = currentState.clock.currentDate;
  const knownIds = new Set((currentState.parliament?.history ?? []).map(item => item.id));
  const newEntries = (parliament?.history ?? []).filter(item => !knownIds.has(item.id));
  let statistics = [...currentState.dataset.statistics];
  const playerId = currentState.career.playerId;
  for (const [metric, delta] of Object.entries(metricDeltas)) {
    if (!delta) continue;
    const index = statistics.findIndex(item => item.subjectId === playerId && item.metric === metric);
    if (index < 0) statistics.push({ id: makeId('stat-' + metric), subjectId: playerId, metric, value: roundStat(delta), unit: '100', asOf: currentDate, source: DATA_SOURCES.SIMULATION });
    else statistics[index] = { ...statistics[index], value: roundStat(statistics[index].value + delta), asOf: currentDate, source: DATA_SOURCES.SIMULATION };
  }
  const lawRecords = (parliament?.laws ?? []).map(law => ({ id: law.id, title: law.title, summary: law.summary, category: law.category, status: law.status, stage: law.stage, chamberId: 'chamber-' + law.firstChamber, introducedAt: law.introducedAt, updatedAt: law.updatedAt, source: DATA_SOURCES.SIMULATION }));
  let dataset = {
    ...currentState.dataset, statistics, laws: lawRecords,
    events: [...currentState.dataset.events, ...newEntries.map(event => ({ id: event.id, title: event.text, date: event.date, category: 'parlamento', status: event.type, territoryId: null, impact: event.details, source: DATA_SOURCES.SIMULATION }))]
  };
  dataset = closeOffices(dataset, [...endedRoleOfficeIds(currentState.parliament, parliament), ...endedMinisterOfficeIds(currentState.parliament, parliament), ...(officeChanges.close ?? [])], currentDate);
  for (const office of officeChanges.open ?? []) dataset = openOffice(dataset, office);
  let career = newEntries.length ? { ...currentState.career, parliamentHistory: [...(currentState.career.parliamentHistory ?? []), ...newEntries] } : currentState.career;
  if (parliament?.player && career.parliamentContext) career = { ...career, parliamentContext: { ...career.parliamentContext, chamber: parliament.player.chamber, groupId: parliament.player.groupId } };
  const world = currentState.world && newEntries.length ? applyWorldSignals(currentState.world, worldSignalsFrom(newEntries, parliament), currentDate) : currentState.world;
  // The parliament engine spends political capital; the career keeps a single balance.
  const game = currentState.game && parliament ? { ...currentState.game, resources: { ...currentState.game.resources, politicalCapital: parliament.resources?.politicalCapital ?? currentState.game.resources.politicalCapital } } : currentState.game;
  return { ...currentState, parliament, dataset, career, game, world, ui: { ...currentState.ui, toast } };
}
function applyParliamentUpdate(...args) {
  state = withObjectives(computeParliamentUpdate(...args));
  persist(); emit();
  return state;
}

// Parliamentary work is paid with the working days of the current week.
function withTime(ap) {
  const game = spendTime(state.game, ap);
  return { ...state, game, parliament: withCapital(state.parliament, game) };
}

// ---------- game bookkeeping ----------
function endMandate(s, reason) {
  const context = s.career.parliamentContext;
  if (!context) return s;
  const player = playerOf(s);
  let next = { ...s, dataset: closeTermOffices(s.dataset, player?.id, 'politiche', s.clock.currentDate), career: { ...s.career, currentLevel: null, parliamentContext: null, pastParliamentContexts: [...(s.career.pastParliamentContexts ?? []), { ...context, endedAt: s.clock.currentDate, reason }] } };
  if (next.parliament?.player) next = computeParliamentUpdate(next, leaveParliament(next.parliament, s.clock.currentDate, reason), next.ui.toast);
  return next;
}
function handleSpecials(s, specials) {
  let next = s;
  for (const special of specials) {
    const player = playerOf(next);
    if (special.type === 'world-stance') {
      next = { ...next, world: applyWorldSignals(next.world, [{ type: 'stance', delta: special.delta, title: special.title }], next.clock.currentDate) };
    } else if (special.type === 'party-left') {
      next = { ...next, world: next.world ? setPlayerParty(next.world, null, next.clock.currentDate) : next.world };
      next = {
        ...next, career: { ...next.career, partyId: null },
        dataset: { ...next.dataset, politicians: next.dataset.politicians.map(item => item.id === player?.id ? { ...item, partyId: null } : item), offices: next.dataset.offices.map(item => item.politicianId === player?.id && item.level === 'partito' && !item.endDate ? { ...item, endDate: next.clock.currentDate } : item) }
      };
    } else if (special.type === 'resign') {
      let parliament = next.parliament;
      if (parliament?.government) parliament = { ...parliament, government: { ...parliament.government, ministers: parliament.government.ministers.map(item => item.playerAppointed && !item.endedAt ? { ...item, endedAt: next.clock.currentDate, endReason: 'Dimissioni' } : item) } };
      if (parliament !== next.parliament) next = computeParliamentUpdate(next, parliament, next.ui.toast);
      next = endMandate(next, 'Dimissioni dagli incarichi');
      next = { ...next, dataset: { ...next.dataset, offices: next.dataset.offices.map(item => item.politicianId === player?.id && !item.endDate && item.level !== 'partito' && !/inizial/i.test(item.title) ? { ...item, endDate: next.clock.currentDate } : item) } };
    } else if (special.type === 'election-missed') {
      next = special.electionType === 'politiche'
        ? endMandate(next, 'Non ricandidato alle elezioni politiche')
        : { ...next, dataset: closeTermOffices(next.dataset, player?.id, special.electionType, next.clock.currentDate) };
    }
  }
  return next;
}
function applyGameResult(base, ctx, toast, specials = []) {
  let next = { ...base, game: ctx.game, dataset: { ...base.dataset, statistics: writeStats(base, ctx.stats) }, ui: { ...base.ui, toast } };
  if (ctx.parliament) next = computeParliamentUpdate(next, withCapital(ctx.parliament, ctx.game), toast);
  return withObjectives(handleSpecials(next, specials));
}
// The political world moves once a week and answers back: polls, events, majorities, reactions.
function tickWorld(s, date, report) {
  const out = advanceWorld(s.world, { date, week: report.week, stats: statsOf(s), deltas: report.deltas ?? {}, game: s.game, parliament: s.parliament, majorityShift });
  let next = { ...s, world: out.world };
  if (s.parliament) next = computeParliamentUpdate(next, withCapital(out.parliament, next.game), next.ui.toast);
  let game = next.game;
  if (out.reactions[0]) game = addWorldReaction(game, out.reactions[0]);
  game = { ...game, lastReport: game.lastReport ? { ...game.lastReport, lines: [...game.lastReport.lines, ...out.lines] } : game.lastReport };
  return { ...next, game, parliament: withCapital(next.parliament, game) };
}
function settleWeeks(s) {
  let next = s;
  let report = null;
  for (let guard = 0; next.game && next.game.status !== 'ended' && elapsedDays(next.game.week.startedAt, next.clock.currentDate) >= 7 && guard < 260; guard++) {
    const weekEnd = advanceDays(next.game.week.startedAt, 7);
    const result = advanceWeek({ game: next.game, stats: statsOf(next), parliament: next.parliament }, { ...gameEnv(next), currentDate: weekEnd }, advanceGovernmentWeek);
    next = applyGameResult(next, result.ctx, next.ui.toast, result.specials);
    if (next.world && result.report) next = tickWorld(next, weekEnd, result.report);
    report = result.report ?? report;
  }
  if (report) next = { ...next, ui: { ...next.ui, toast: next.game.status === 'ended' ? 'La carriera si è conclusa' : `Settimana ${report.week} chiusa: ${next.game.inbox.length} decisioni in agenda` } };
  return next;
}
function stepTime(days) {
  let campaign = state.campaign;
  const wasActive = campaign?.status === 'active';
  let currentDate = advanceDays(state.clock.currentDate, days);
  if (wasActive) {
    campaign = advanceCampaign(campaign, days);
    currentDate = campaign.currentDate;
  }
  const weekBefore = state.game?.week.index;
  state = { ...state, campaign, clock: { ...state.clock, currentDate } };
  const justFinished = wasActive && campaign.status === 'finished';
  if (justFinished && state.career.lastCampaignId !== campaign.id) state = applyCampaignResult(state, campaign);
  state = settleWeeks(state);
  const week = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(`${state.clock.currentDate}T12:00:00`));
  if (justFinished) state = { ...state, ui: { ...state.ui, toast: 'Voto concluso: risultati disponibili' } };
  else if (state.game?.week.index === weekBefore) state = { ...state, ui: { ...state.ui, toast: `Tempo avanzato al ${week}` } };
  const inParliament = Boolean(state.parliament?.player) && campaign?.status !== 'active' && campaign?.status !== 'finished';
  state = { ...state, dataset: { ...state.dataset, events: [...state.dataset.events, { id: makeId('evento'), title: campaign?.status === 'active' ? 'Giornata di campagna' : campaign?.status === 'finished' ? 'Campagna conclusa' : inParliament ? 'Settimana di lavori parlamentari' : 'Agenda aggiornata', date: state.clock.currentDate, category: campaign?.status === 'active' ? 'campagna' : inParliament ? 'parlamento' : 'agenda', status: 'da pianificare', source: DATA_SOURCES.SIMULATION }] } };
}
function commitGame(result, toast) {
  state = applyGameResult(state, result.ctx, toast, result.specials ?? []);
  persist(); emit();
  return result;
}

export const store = {
  getState: () => state,
  getLastSaved: () => lastSaved,
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  navigate(page) { state = { ...state, ui: { ...state.ui, activePage: page } }; emit(); },
  advance(days = 7) {
    if (state.game?.status === 'ended') { state = { ...state, ui: { ...state.ui, toast: 'La carriera è conclusa: inizia una nuova partita.' } }; emit(); return; }
    stepTime(days);
    persist(); emit();
  },
  // Skips whole weeks (open decisions take their default outcome) until the candidacy window opens.
  fastForwardToElection(type) {
    const target = upcomingElections(state.game).find(item => item.type === type);
    if (!target) throw new Error('Nessuna elezione di questo tipo in calendario.');
    if (state.campaign?.status === 'active') throw new Error('Concludi prima la campagna in corso.');
    for (let guard = 0; !openElection(state.game, type, state.clock.currentDate) && state.game.status !== 'ended' && guard < 160; guard++) stepTime(7);
    const open = openElection(state.game, type, state.clock.currentDate);
    state = { ...state, ui: { ...state.ui, toast: open ? `Candidature aperte: ${open.label}` : state.game.status === 'ended' ? 'La carriera si è conclusa' : 'Finestra non raggiunta' } };
    persist(); emit();
    return open;
  },
  save() { persist(); state = { ...state, ui: { ...state.ui, toast: 'Carriera salvata' } }; emit(); },
  clearCampaign() { state={...state,campaign:null,ui:{...state.ui,activePage:'elezioni',toast:'Pronta per una nuova elezione'}}; persist(); emit(); },
  startCampaign(config, partyCatalog = [], realPeople = {}) {
    if (state.campaign?.status === 'active') throw new Error('Concludi o riprendi la campagna già in corso.');
    if (state.game?.status === 'ended') throw new Error('La carriera è conclusa: inizia una nuova partita.');
    const election = openElection(state.game, config.electionType, state.clock.currentDate);
    if (!election) {
      const next = upcomingElections(state.game).find(item => item.type === config.electionType);
      throw new Error(next ? `Le candidature per ${next.label} si aprono il ${formatDate(next.windowOpensAt)}.` : 'Nessuna elezione di questo tipo in calendario.');
    }
    const player = playerOf(state);
    const realCandidates = config.electionType === 'politiche' && ['deputato', 'uninominale'].includes(config.role ?? 'deputato') ? pertinentDeputies(realPeople, player?.region, `${state.career.id}|${state.clock.currentDate}`) : [];
    const campaign = createCampaign({ career:state.career, player, statistics:state.dataset.statistics, offices:state.dataset.offices, territories:state.dataset.territories, partyCatalog:[...state.dataset.parties,...partyCatalog], currentDate:state.clock.currentDate, config:{ ...config, realCandidates } });
    // The career built so far shapes the starting position: preparation, funds, party standing and relationships.
    const game = state.game;
    const party = game.party;
    const leadership = relationValue(game, 'leadership') ?? 50;
    const partyBonus = party?.affiliation === 'member' ? Math.max(-3, Math.min(4, (party.support - 50) / 12 + (leadership - 50) / 18 + party.rank * 0.6)) : 0;
    const transfer = Math.round(game.resources.funds * 0.6);
    const candidate = campaign.candidates.find(item => item.isPlayer);
    candidate.resources.money += transfer + game.prep * 30;
    candidate.resources.volunteers += Math.max(0, Math.round(game.prep / 6 + ((relationValue(game, 'civic') ?? 45) - 45) / 8));
    candidate.resources.organization = Math.min(100, candidate.resources.organization + Math.round(game.prep / 5));
    campaign.resources = { ...candidate.resources, visibility: Math.max(0, campaign.resources.visibility + Math.round(((relationValue(game, 'media') ?? 45) - 45) / 5)), source: 'simulation' };
    if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + partyBonus));
    if (party?.affiliation === 'member') campaign.candidacy.listPosition = campaign.nomination.listPosition = Math.max(1, Math.min(6, 6 - party.rank - (party.support >= 70 ? 1 : 0)));
    // Polls and allies decide how much of the party's pull the candidate starts with.
    const poll = campaignPollBonus(state.world, config.electionType, statsOf(state), game.relations);
    if (poll.bonus) for (const area of campaign.territories) {
      const shares = area.supportByCandidate;
      shares[campaign.playerCandidateId] = Math.max(0.5, shares[campaign.playerCandidateId] + poll.bonus);
      const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
      for (const id of Object.keys(shares)) shares[id] = round2(shares[id] * 100 / total);
    }
    campaign.totalDays = Math.max(21, elapsedDays(state.clock.currentDate, election.electionDate));
    campaign.electionDate = election.electionDate;
    campaign.scheduledElectionId = election.id;
    campaign.preparation = { prep: game.prep, transfer, partyBonus: round2(partyBonus), pollBonus: poll.bonus, pollShare: poll.share, allies: poll.allies, source: 'simulation' };
    campaign.history.unshift({ id: `preparazione-${campaign.id}`, day: 0, date: state.clock.currentDate, type: 'preparazione', text: `Preparazione ${game.prep}/100 · ${transfer} € dalla carriera · sostegno interno ${partyBonus >= 0 ? '+' : ''}${round2(partyBonus)} · sondaggi ${poll.bonus >= 0 ? '+' : ''}${poll.bonus}`, source: 'simulation' });
    const nextGame = { ...markElectionRunning(game, election.id, campaign.id), prep: 0, resources: { ...game.resources, funds: game.resources.funds - transfer } };
    state = { ...state, campaign, game: nextGame, ui:{...state.ui,activePage:'elezioni',toast:'Campagna iniziata'} };
    persist(); emit();
    return campaign;
  },
  performCampaignActivity(activityId, options = {}) {
    const campaign = performCampaignActivity(state.campaign,activityId,options);
    state = { ...state, campaign, clock:{...state.clock,currentDate:campaign.currentDate}, ui:{...state.ui,toast:campaign.history[0]?.text ?? 'Attività completata'} };
    if(campaign.status==='finished'&&state.career.lastCampaignId!==campaign.id) state=applyCampaignResult(state,campaign);
    const toast = state.ui.toast;
    state = settleWeeks(state);
    state = { ...state, ui: { ...state.ui, toast } };
    persist(); emit(); return campaign;
  },
  decideCampaignEvent(eventId, choiceId) {
    state = { ...state, campaign:decideCampaignEvent(state.campaign,eventId,choiceId) };
    persist(); emit();
  },
  negotiateCampaignAlliance(targetId = null) {
    state = { ...state, campaign:negotiateCampaignAlliance(state.campaign,targetId), ui:{...state.ui,toast:'Trattativa aggiornata'} };
    persist(); emit();
  },
  breakCampaignAlliance(allianceId) {
    state = { ...state, campaign:breakCampaignAlliance(state.campaign,allianceId), ui:{...state.ui,toast:'Accordo interrotto'} };
    persist(); emit();
  },

  // ---------- weekly career ----------
  performWeeklyActivity(activityId, targetId = null) {
    const result = performActivity({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), activityId, targetId);
    return commitGame(result, `${result.report.title}: ${result.report.tone === 'bad' ? 'qualcosa è andato storto' : 'fatto'}`);
  },
  resolveAgendaItem(itemId, choiceId) {
    const leaderBefore = state.game.party?.leaderCurrentId;
    const result = resolveInboxItem({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), itemId, choiceId);
    commitGame(result, result.report.lines.at(-1) ?? 'Decisione registrata');
    const party = state.game.party;
    if (party && party.leadershipContestWeek === state.game.week.index && result.report && /congresso/i.test(result.report.lines.join(' ')) && state.world) {
      const winner = party.currents.find(item => item.id === party.leaderCurrentId);
      state = { ...state, world: applyWorldSignals(state.world, [{ type: 'congress', winner: winner?.label ?? 'una nuova area', won: party.alignedCurrentId === party.leaderCurrentId, changed: leaderBefore !== party.leaderCurrentId }], state.clock.currentDate) };
      persist(); emit();
    }
    return result;
  },
  contestPartyRank() {
    const result = contestPartyRank({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state));
    commitGame(result, result.success ? `Nuovo incarico nel partito: ${result.rank.title}` : 'La sfida interna non è andata a buon fine');
    if (result.success) {
      const player = playerOf(state);
      let dataset = { ...state.dataset, offices: state.dataset.offices.map(item => item.politicianId === player?.id && item.level === 'partito' && !item.endDate ? { ...item, endDate: state.clock.currentDate } : item) };
      dataset = openOffice(dataset, { id: makeId('incarico-partito'), title: `${result.rank.title} (scenario)`, institution: state.game.party.label || 'Partito', level: 'partito', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: state.clock.currentDate });
      state = { ...state, dataset };
      persist(); emit();
    }
    return result;
  },
  alignPartyCurrent(currentId) {
    return commitGame(alignCurrent({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), currentId), 'Posizionamento interno aggiornato');
  },
  joinParty(partyId, catalog = []) {
    const party = [...state.dataset.parties, ...catalog].find(item => item.id === partyId && isSelectableParty(item));
    if (!party) throw new Error('Partito non disponibile.');
    const result = joinParty({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), { id: party.id, label: party.officialName ?? party.name });
    const player = playerOf(state);
    state = { ...state, career: { ...state.career, partyId: party.id }, dataset: { ...state.dataset, politicians: state.dataset.politicians.map(item => item.id === player?.id ? { ...item, partyId: party.id } : item) } };
    if (state.world) state = { ...state, world: setPlayerParty(state.world, { id: party.id, label: party.officialName ?? party.name, abbreviation: party.abbreviation, brandColor: party.color ?? null, refSource: party.source, orientation: party.orientation ?? null }, state.clock.currentDate) };
    return commitGame(result, `Hai aderito a ${party.officialName ?? party.name}`);
  },
  proposeAlliance(forceId) {
    if (!state.game.party) throw new Error('Serve un partito per stringere un’alleanza.');
    const game = spendTime(state.game, 1);
    if (game.resources.politicalCapital < 4) throw new Error('Servono 4 punti di capitale politico per trattare un’alleanza.');
    const result = proposeAlliance(state.world, forceId, { partySupport: game.party.support, influence: playerStat(state, 'influence'), date: state.clock.currentDate });
    const nextGame = { ...game, resources: { ...game.resources, politicalCapital: game.resources.politicalCapital - 4 } };
    state = { ...state, world: result.world, game: nextGame, parliament: withCapital(state.parliament, nextGame), ui: { ...state.ui, toast: result.success ? 'Alleanza firmata' : 'La proposta di alleanza è stata respinta' } };
    persist(); emit();
    return result;
  },
  breakAlliance(allianceId) {
    state = { ...state, world: breakAlliance(state.world, allianceId, state.clock.currentDate), ui: { ...state.ui, toast: 'Alleanza interrotta' } };
    persist(); emit();
  },
  leaveParty() {
    const result = quitParty({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state));
    return commitGame({ ...result, specials: [{ type: 'party-left' }] }, 'Hai lasciato il partito');
  },

  // ---------- parliament ----------
  initializeParliament(realGroups = []) {
    const groups = realGroups.filter(group => group?.source === DATA_SOURCES.REAL && group.verified === true);
    if (!groups.length) return state.parliament;
    const player = playerOf(state);
    const context = state.career.parliamentContext ?? null;
    const chamber = context?.chamber ?? null;
    let parliament = normalizeParliamentState(state.parliament);
    const hasChambers = parliament?.chambers.camera.groups.length && parliament.chambers.senato.groups.length;
    if (!hasChambers) {
      parliament = createParliamentState({ career: { ...state.career, parliamentContext: context }, player, groups, currentDate: state.clock.currentDate, politicalCapital: state.game?.resources.politicalCapital ?? playerStat(state, 'influence') });
    } else if (chamber && parliament.player?.chamber !== chamber) {
      parliament = enterParliament(parliament, { politicianId: player?.id ?? null, chamber, groupId: context.groupId ?? null, territoryName: context.territoryName ?? player?.region ?? null, currentDate: state.clock.currentDate });
    } else if (!chamber && parliament.player) {
      parliament = leaveParliament(parliament, state.clock.currentDate, 'Mandato non più attivo nella carriera');
    } else {
      if (parliament !== state.parliament) state = { ...state, parliament: withCapital(parliament, state.game) };
      return state.parliament;
    }
    return applyParliamentUpdate(state, withCapital(parliament, state.game), state.ui.toast ?? null).parliament;
  },
  contestCommitteeRole() {
    const next = withTime(PARLIAMENT_TIME_COSTS.contestRole);
    const result = contestCommitteeRole(next.parliament, next.clock.currentDate, playerStats(state));
    const player = playerOf(state);
    const open = result.success ? [{ id: roleOfficeId(result.appointment), title: `${result.role.title} (scenario)`, institution: chamberInstitution(state.parliament.player.chamber), politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    const deltas = result.success ? { influence: 2, reputation: 1, notoriety: 1 } : { influence: -1, reputation: -0.5 };
    return applyParliamentUpdate(next, result.parliament, result.success ? `Incarico conquistato: ${result.role.title}` : 'Competizione interna non vinta', deltas, { open });
  },
  joinParliamentaryGroup(groupId) {
    if (!state.parliament) throw new Error('Carica prima i dati delle Camere e dei gruppi.');
    const next = withTime(PARLIAMENT_TIME_COSTS.joinGroup);
    const changing = Boolean(state.parliament.player?.groupId);
    const parliament = assignPlayerGroup(next.parliament, groupId, next.clock.currentDate);
    return applyParliamentUpdate(next, parliament, changing ? 'Cambio di gruppo registrato' : 'Gruppo di riferimento aggiornato', changing ? { reputation: -2, influence: -1 } : { influence: 1 });
  },
  proposeLaw(draft) {
    if (!canManageParliament(state.parliament)) throw new Error('Per presentare una legge devi avere un percorso parlamentare e un gruppo di riferimento.');
    const next = withTime(PARLIAMENT_TIME_COSTS.proposeLaw);
    const result = proposeLaw(next.parliament, { ...draft, currentDate: next.clock.currentDate });
    applyParliamentUpdate(next, result.parliament, 'Proposta depositata', { experience: 0.5, influence: 0.5 });
    return result.law;
  },
  amendLaw(lawId, text) {
    const next = withTime(PARLIAMENT_TIME_COSTS.amendLaw);
    return applyParliamentUpdate(next, amendLaw(next.parliament, lawId, text, next.clock.currentDate), 'Emendamento registrato');
  },
  negotiateLaw(lawId, groupId) {
    const next = withTime(PARLIAMENT_TIME_COSTS.negotiateLaw);
    const parliament = negotiateLaw(next.parliament, lawId, groupId, next.clock.currentDate, { influence: playerStat(state, 'influence') });
    const refused = parliament.history.at(-1)?.type === 'negoziato-rifiutato';
    return applyParliamentUpdate(next, parliament, refused ? 'Il gruppo rifiuta di trattare: migliora prima i rapporti' : 'Trattativa legislativa aggiornata', refused ? {} : { influence: 0.5 });
  },
  compromiseLaw(lawId) {
    const next = withTime(PARLIAMENT_TIME_COSTS.compromiseLaw);
    return applyParliamentUpdate(next, compromiseLaw(next.parliament, lawId, next.clock.currentDate), 'Compromesso registrato');
  },
  advanceLaw(lawId, action) {
    const next = withTime(PARLIAMENT_TIME_COSTS.advanceLaw);
    const result = advanceLaw(next.parliament, lawId, action, next.clock.currentDate);
    const finished = ['approved', 'rejected'].includes(result.law.stage);
    const delta = finished ? (result.law.stage === 'approved' ? { reputation: 1, influence: 1, experience: 1, notoriety: 0.5 } : { reputation: -0.5, experience: 0.5 }) : { influence: 0.25 };
    const toast = result.law.stage === 'approved' ? 'Legge approvata in simulazione' : result.law.stage === 'rejected' ? 'Votazione conclusa: proposta respinta' : 'Iter legislativo aggiornato';
    return applyParliamentUpdate(next, result.parliament, toast, delta);
  },
  formGovernment(groupIds) {
    const next = withTime(PARLIAMENT_TIME_COSTS.formGovernment);
    return applyParliamentUpdate(next, formGovernment(next.parliament, groupIds, next.clock.currentDate), 'Trattativa di governo aperta', { influence: 0.5 });
  },
  negotiateGovernmentSupport(groupId) {
    const next = withTime(PARLIAMENT_TIME_COSTS.governmentSupport);
    const parliament = negotiateGovernmentSupport(next.parliament, groupId, next.clock.currentDate, { influence: playerStat(state, 'influence') });
    const refused = parliament.history.at(-1)?.type === 'negoziato-rifiutato';
    return applyParliamentUpdate(next, parliament, refused ? 'Il gruppo rifiuta di sostenere il governo' : 'Impegno di sostegno registrato', refused ? {} : { influence: 0.5 });
  },
  reviseGovernmentCoalition(groupIds) {
    const next = withTime(PARLIAMENT_TIME_COSTS.reviseCoalition);
    return applyParliamentUpdate(next, reviseGovernmentCoalition(next.parliament, groupIds, next.clock.currentDate), 'Coalizione aggiornata: serve una nuova fiducia');
  },
  assignMinister(portfolio, groupId, appointee = 'group') {
    const next = withTime(PARLIAMENT_TIME_COSTS.assignMinister);
    const player = playerOf(state);
    const parliament = assignMinister(next.parliament, portfolio, groupId, next.clock.currentDate, { appointee, appointeeLabel: player?.displayName });
    const appointment = parliament.government.ministers.at(-1);
    const open = appointment.playerAppointed ? [{ id: ministerOfficeId(appointment), title: `Ministro · ${portfolio} (scenario)`, institution: 'Governo della Repubblica (scenario di gioco)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    return applyParliamentUpdate(next, parliament, appointment.playerAppointed ? `Sei ministro: ${portfolio}` : 'Incarico simulato distribuito', appointment.playerAppointed ? { influence: 3, notoriety: 3, reputation: 1 } : {}, { open });
  },
  voteGovernmentConfidence() {
    const next = withTime(PARLIAMENT_TIME_COSTS.confidence);
    const parliament = voteGovernmentConfidence(next.parliament, next.clock.currentDate);
    const passed = parliament.government?.status === 'active';
    const government = parliament.government;
    const inCoalition = [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(state.parliament.player?.groupId);
    const deltas = inCoalition ? (passed ? { influence: 2, reputation: 1 } : { influence: -1, reputation: -1 }) : (passed ? {} : { influence: 1 });
    return applyParliamentUpdate(next, parliament, passed ? 'Fiducia ottenuta in simulazione' : 'Fiducia non ottenuta: il governo cade', deltas);
  },
  triggerGovernmentCrisis() {
    const next = withTime(PARLIAMENT_TIME_COSTS.crisis);
    return applyParliamentUpdate(next, triggerGovernmentCrisis(next.parliament, next.clock.currentDate), 'Crisi di governo aperta', { influence: -0.5 });
  },
  reset() {
    state = prepareState(makeDemoState());
    try { storage.clear(); } catch { /* storage may be unavailable */ }
    lastSaved = 'Nuova carriera demo'; emit();
  },
  createCareer(draft, realParties = [], realGroups = []) {
    const selectableParties = [...state.dataset.parties.filter(isSelectableParty), ...realParties.filter(party => party?.source === DATA_SOURCES.REAL && party.verified === true)];
    const errors = validateNewCareerDraft({ ...draft, currentDate: state.clock.currentDate }, selectableParties, realGroups);
    if (errors.length) throw new Error(errors[0]);
    const level = CAREER_LEVELS[draft.initialLevel];
    const birthDate = draft.birthDate;
    const id = makeId('carriera');
    const playerId = makeId('politico');
    const regionId = makeId('territorio-regione');
    const municipalityId = makeId('territorio-comune');
    const nationId = makeId('territorio-italia');
    const partyId = draft.partyMode === 'new' ? makeId('partito-utente') : draft.partyMode === 'existing' ? draft.partyId : null;
    const territories = [
      { id: regionId, kind: 'regione', name: draft.region, parentId: null, source: DATA_SOURCES.USER },
      { id: municipalityId, kind: 'comune', name: draft.municipality, parentId: regionId, source: DATA_SOURCES.USER }
    ];
    const territoryId = draft.initialLevel === 'comunale' ? municipalityId : regionId;
    if (['deputato','senatore'].includes(draft.initialLevel)) territories.push({ id: nationId, kind: 'stato', name: 'Italia', parentId: null, source: DATA_SOURCES.USER });

    const parties = [...makeDemoParties(), ...state.dataset.parties.filter(party => party.source === DATA_SOURCES.USER)];
    if (draft.partyMode === 'existing' && ![...parties, ...realParties].some(party => party.id === draft.partyId && isSelectableParty(party))) throw new Error('Il partito selezionato non è disponibile.');
    if (draft.partyMode === 'new') {
      if (!draft.partyName?.trim() || !draft.partyAbbreviation?.trim() || !draft.partyDescription?.trim() || !draft.partyOrientation) throw new Error('Completa i dati del nuovo partito.');
      parties.push({
        id: partyId, name: draft.partyName.trim(), abbreviation: draft.partyAbbreviation.trim().toUpperCase(),
        description: draft.partyDescription.trim(), color: draft.partyColor || '#264d82', orientation: draft.partyOrientation,
        policyPositions: { ...draft.policyPositions }, source: DATA_SOURCES.USER, createdAt: state.clock.currentDate, logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: null
      });
    }
    const profession = draft.previousProfession.trim();
    const statistics = initialCareerStatistics(draft.initialLevel);
    const datasetStatistics = [];
    const statisticIds = Object.entries(statistics).map(([metric, value]) => {
      const statisticId = makeId('stat-' + metric);
      datasetStatistics.push({ id: statisticId, subjectId: playerId, metric, value, unit: '100', asOf: state.clock.currentDate, source: DATA_SOURCES.SIMULATION });
      return statisticId;
    });
    const player = {
      id: playerId, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(),
      displayName: draft.firstName.trim() + ' ' + draft.lastName.trim(), birthDate, gender: draft.gender,
      region: draft.region, municipality: draft.municipality.trim(), previousProfession: profession,
      partyId, territoryId, roleId: makeId('incarico'), source: DATA_SOURCES.USER, createdAt: state.clock.currentDate
    };
    const chamber = CAREER_LEVELS[draft.initialLevel]?.chamber ?? null;
    const office = {
      id: player.roleId, title: level.office,
      institution: draft.initialLevel === 'comunale' ? 'Comune di ' + draft.municipality.trim() : draft.initialLevel === 'regionale' ? 'Regione ' + draft.region : chamber === 'camera' ? 'Camera dei deputati' : chamber === 'senato' ? 'Senato della Repubblica' : 'Repubblica italiana',
      level: draft.initialLevel, politicianId: playerId, territoryId, startDate: state.clock.currentDate, endDate: null,
      source: chamber ? DATA_SOURCES.SIMULATION : DATA_SOURCES.USER
    };
    const dataset = emptyDataset();
    dataset.parties = parties;
    dataset.politicians = [player];
    dataset.territories = territories;
    dataset.offices = [office];
    dataset.statistics = datasetStatistics;
    const parliamentContext = chamber ? {
      mode: 'real-context', chamber, groupId: draft.parliamentaryGroupId,
      territoryName: draft.region, source: DATA_SOURCES.SIMULATION,
      realReferences: { chamberId: chamber === 'camera' ? 'chamber-camera' : 'chamber-senato', groupId: draft.parliamentaryGroupId }
    } : null;
    const career = {
      id, name: player.displayName + ' — ' + level.shortLabel, playerId, partyId,
      initialLevel: draft.initialLevel, territoryId, statisticsIds: statisticIds,
      startedAt: state.clock.currentDate, createdAt: new Date().toISOString(), status: 'active', parliamentContext
    };
    const parliament = chamber ? createParliamentState({ career, player, groups: realGroups, currentDate: state.clock.currentDate, politicalCapital: statistics.influence }) : null;
    if (parliament) {
      career.parliamentHistory = [...parliament.history];
      dataset.events = parliament.history.map(event => ({ id: event.id, title: event.text, date: event.date, category: 'parlamento', status: event.type, territoryId: null, impact: event.details, source: DATA_SOURCES.SIMULATION }));
    }
    const partyRecord = [...parties, ...realParties].find(item => item.id === partyId);
    const base = {
      version: STATE_VERSION, campaign: null, parliament, career,
      clock: { ...state.clock }, dataset,
      ui: { activePage: 'panoramica', saveName: 'Salvataggio locale', toast: 'Carriera iniziata: la tua prima settimana è in agenda' }
    };
    const game = buildGame(base, { partyLabel: partyRecord ? partyRecord.officialName ?? partyRecord.name : null, founder: draft.partyMode === 'new' });
    const world = buildWorld({ ...base, game }, partyRecord ?? null);
    state = { ...base, game, world, parliament: withCapital(parliament, game) };
    persist(); emit();
    return player;
  }
};


function applyCampaignResult(currentState,campaign) {
  const result=campaign.result;
  if(!result) return currentState;
  const player=currentState.dataset.politicians.find(item=>item.id===campaign.playerId);
  if(!player) return currentState;
  const reputationDelta=result.personalMandate?4:result.objectiveMet?2:-2;
  const metricValues={consensus:result.playerShare,reputation:Math.max(0,Math.min(100,(campaign.candidateStats.reputation??50)+reputationDelta)),notoriety:campaign.candidateStats.notoriety??20,influence:Math.max(0,Math.min(100,(campaign.candidateStats.influence??10)+(result.personalMandate?3:result.objectiveMet?1:-1)))};
  let statistics=[...currentState.dataset.statistics];
  for(const [metric,value] of Object.entries(metricValues)) {
    const existing=statistics.find(item=>item.subjectId===player.id&&item.metric===metric);
    if(existing) statistics=statistics.map(item=>item===existing?{...item,value:Math.round(value*100)/100,unit:metric==='consensus'?'%':'100',asOf:campaign.currentDate,source:DATA_SOURCES.SIMULATION}:item);
    else statistics.push({id:makeId(`stat-${metric}`),subjectId:player.id,metric,value:Math.round(value*100)/100,unit:metric==='consensus'?'%':'100',asOf:campaign.currentDate,source:DATA_SOURCES.SIMULATION});
  }
  // The previous term of the same kind ends with the vote, whatever the outcome.
  let dataset=closeTermOffices({...currentState.dataset,statistics},player.id,campaign.electionType,campaign.currentDate);
  let career={...currentState.career,lastCampaignId:campaign.id,lastElectionResult:{campaignId:campaign.id,electionType:campaign.electionType,percent:result.playerShare,votes:result.playerVotes,seats:result.playerSeats,personalMandate:result.personalMandate,objectiveMet:result.objectiveMet,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION},electionHistory:[...(currentState.career.electionHistory??[]),{campaignId:campaign.id,electionType:campaign.electionType,percent:result.playerShare,seats:result.playerSeats,personalMandate:result.personalMandate,objectiveMet:result.objectiveMet,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION}],partyImpactHistory:[...(currentState.career.partyImpactHistory??[]),{campaignId:campaign.id,partyId:campaign.partyId,consensusChange:campaign.partyImpact.consensusChange,outcome:campaign.partyImpact.outcome,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION}]};
  if(result.personalMandate) {
    const officeTitles={sindaco:'Sindaco',presidente:'Presidente di Regione',consigliere:campaign.electionType==='comunale'?'Consigliere comunale':'Consigliere regionale',deputato:'Deputato',senatore:'Senatore',uninominale:'Deputato',eurodeputato:'Deputato al Parlamento europeo'};
    const title=officeTitles[campaign.candidacy.role]??'Rappresentante eletto';
    const office={id:makeId('incarico-simulato'),title,institution:campaign.electionType==='comunale'?`Comune di ${player.municipality}`:campaign.electionType==='regionale'?`Regione ${player.region}`:campaign.electionType==='europee'?'Parlamento europeo':'Repubblica italiana',level:campaign.electionType,politicianId:player.id,territoryId:campaign.territoryId,startDate:campaign.currentDate,endDate:null,source:DATA_SOURCES.SIMULATION};
    dataset={...dataset,offices:[...dataset.offices,office],politicians:dataset.politicians.map(item=>item.id===player.id?{...item,roleId:office.id}:item)};
    career.status='elected';
  }
  // Calendar, party and relationships react to the vote.
  let game=currentState.game?markElectionHeld(currentState.game,campaign.id,{percent:result.playerShare,personalMandate:result.personalMandate}):currentState.game;
  if(game) {
    if(campaign.nomination.status==='approved') game.flags={...game.flags,candidacy:true};
    if(game.party) game.party={...game.party,support:Math.max(0,Math.min(100,game.party.support+(result.personalMandate?6:result.objectiveMet?2:-3)))};
    game.relations=game.relations.map(item=>item.id==='leadership'?{...item,value:Math.max(0,Math.min(100,item.value+(result.personalMandate?3:-2)))}:item);
    game.log=[{id:`diario-voto-${campaign.id}`,week:game.week.index,date:campaign.currentDate,kind:'elezioni',title:`${campaign.electionLabel}: ${result.personalMandate?'mandato conquistato':'nessun mandato'}`,lines:[`${String(Math.round(result.playerShare*10)/10).replace('.',',')}% nello scenario`,result.objectiveMet?'Obiettivo raggiunto':'Obiettivo mancato'],tone:result.personalMandate?'good':'bad',source:'simulation'},...game.log].slice(0,40);
  }
  // A parliamentary seat won in the campaign opens (or confirms) the mandate; losing it ends the mandate.
  let parliament=currentState.parliament;
  const chamber=PARLIAMENTARY_CAMPAIGN_ROLES[campaign.candidacy.role];
  const previousContext=currentState.career.parliamentContext??null;
  if(result.personalMandate&&chamber) {
    const sameChamber=previousContext?.chamber===chamber;
    career.currentLevel=chamber==='camera'?'deputato':'senatore';
    career.parliamentContext={mode:'real-context',chamber,groupId:sameChamber?(parliament?.player?.groupId??previousContext.groupId??null):null,territoryName:player.region,via:'campaign',since:campaign.currentDate,source:DATA_SOURCES.SIMULATION};
    if(previousContext&&!sameChamber) career.pastParliamentContexts=[...(career.pastParliamentContexts??[]),{...previousContext,endedAt:campaign.currentDate,reason:'Elezione nell’altra Camera'}];
    if(parliament?.chambers?.camera?.groups?.length) parliament=enterParliament(parliament,{politicianId:player.id,chamber,groupId:career.parliamentContext.groupId,territoryName:player.region,currentDate:campaign.currentDate});
  } else if(campaign.electionType==='politiche'&&previousContext) {
    career.currentLevel=null;
    career.parliamentContext=null;
    career.pastParliamentContexts=[...(career.pastParliamentContexts??[]),{...previousContext,endedAt:campaign.currentDate,reason:'Seggio non confermato alle elezioni'}];
    if(parliament?.player) parliament=leaveParliament(parliament,campaign.currentDate,'Seggio non confermato alle elezioni politiche');
  }
  const world=currentState.world?applyWorldSignals(currentState.world,[{type:'election',label:campaign.electionLabel,share:result.playerShare,mandate:result.personalMandate,pollShare:campaign.preparation?.pollShare??null}],campaign.currentDate):currentState.world;
  const next={...currentState,dataset,career,game,world,parliament:withCapital(currentState.parliament,game)};
  if(parliament===currentState.parliament) return withObjectives(next);
  // Route the parliamentary change through the shared bookkeeping (history, offices, events).
  return withObjectives(computeParliamentUpdate(next,withCapital(parliament,game),currentState.ui.toast));
}
