import { DATA_SOURCES, emptyDataset, isSelectableParty } from '../data/schema.js?v=20260924-16';
import { makeDemoState } from '../data/demo.js?v=20260924-16';
import { CAREER_LEVELS, initialCareerStatistics } from '../data/regions.js?v=20260924-16';
import { storage } from './storage.js?v=20260924-16';
import { loadSettings } from './settings.js?v=20260924-16';
import { advanceDays, formatDate } from './time.js?v=20260924-16';
import { validateNewCareerDraft } from './career-rules.js?v=20260924-16';
import { advanceCampaign, breakCampaignAlliance, createCampaign, decideCampaignEvent, negotiateCampaignAlliance, performCampaignActivity } from './campaign-engine.js?v=20260924-16';
import { activeMinisters, LAW_CATEGORIES, playerInMajority, advanceGovernmentWeek, majorityShift, advanceLaw, amendLaw, assignMinister, assignPlayerGroup, canManageParliament, compromiseLaw, contestCommitteeRole, createParliamentState, enterParliament, formGovernment, leaveParliament, negotiateGovernmentSupport, negotiateLaw, normalizeParliamentState, proposeLaw, reviseGovernmentCoalition, triggerGovernmentCrisis, voteGovernmentConfidence } from './parliament-engine.js?v=20260924-16';
import { addSituationEvent, addWorldReaction, advanceWeek, alignCurrent, assignOrgans, callEarlyCongress, contestPartyRank, createGameState, disciplineGroup, expelDissidents, isSecretary, joinParty, makeInvestment, nextPartyRank, partyInvestment, saveForElection, setCandidacyRule, setPartyLine, markElectionHeld, markElectionRunning, normalizeGameState, openElection, performActivity, quitParty, refreshObjectives, relationValue, resolveInboxItem, spendTime, upcomingElections } from './career-engine.js?v=20260924-16';
import { PARLIAMENT_TIME_COSTS } from '../data/simulation/career-rules.js?v=20260924-16';
import { acceptAlliance, advanceWorld, applyWorldSignals, breakAlliance, campaignPollBonus, createWorld, isLegacyWorld, normalizeWorld, proposeAlliance, setPlayerParty } from './world-engine.js?v=20260924-16';
import { WORLD_PARTY_COUNT } from '../data/simulation/polling-rules.js?v=20260924-16';
import { isPrimeMinister } from './roles.js?v=20260924-16';
import { recordWhy } from './career-engine.js?v=20260924-16';
import { PARTY_LINES } from '../data/simulation/career-rules.js?v=20260924-16';
import { advanceSociety, applyLawToSociety, calibrateWeights, createSociety, mediaEvent, normalizeSociety, publicBudgetChoice, regionAttention, segmentAttention, societyMood } from './society-engine.js?v=20260924-16';
import { ACTIVITY_MEDIA, INDICATORS, ISSUE_TOPICS, SEGMENTS } from '../data/simulation/society-rules.js?v=20260924-16';
import { book, hasAsset, releaseElectionFund, setBudgetLevel } from './finance-engine.js?v=20260924-16';
import { isPartyLeader, treasuryBook } from './organization-engine.js?v=20260924-16';
import { selectContacts, syncContacts } from './contacts-engine.js?v=20260924-16';

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
const clampTo = (value, min, max) => Math.max(min, Math.min(max, value));
const deepCopy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const seedOf = s => { const player = playerOf(s); return `${player?.displayName}|${player?.birthDate}|${s.career.startedAt}|${s.career.initialLevel}`; };
const indicatorLabel = id => INDICATORS.find(item => item.id === id)?.label ?? id;

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
// Real parties that populate the political world: the most chosen in the 2x1000 (MEF, verified).
let realForces = [];
let twoPerThousandById = new Map();
function forcesFrom({ twoPerThousand = [], parties = [], movements = [] }) {
  const catalog = new Map([...parties, ...movements].filter(item => item.source === DATA_SOURCES.REAL && item.verified === true).map(item => [item.id, item]));
  twoPerThousandById = new Map(twoPerThousand.filter(row => row.source === DATA_SOURCES.REAL && row.verified === true && catalog.has(row.partyId)).map(row => [row.partyId, row]));
  return [...twoPerThousandById.values()].sort((a, b) => b.validChoices - a.validChoices).slice(0, WORLD_PARTY_COUNT).map(row => {
    const party = catalog.get(row.partyId);
    return { id: party.id, label: party.officialName, abbreviation: party.abbreviation ?? null, share: row.shareOfChoices, reference: { validChoices: row.validChoices, shareOfChoices: row.shareOfChoices, amountEuro: row.amountEuro, year: row.declarationYear, source: DATA_SOURCES.REAL } };
  });
}
// The player's party as the simulated world sees it: a real party is only an id and a label.
function worldPartyOf(s, record = null) {
  const player = playerOf(s);
  const partyId = player ? player.partyId : s.career.partyId;
  if (!partyId) return null;
  const known = record ?? s.dataset.parties.find(item => item.id === partyId) ?? null;
  const reference = twoPerThousandById.get(partyId);
  return {
    id: partyId, label: known?.officialName ?? known?.name ?? s.game?.party?.label ?? null, abbreviation: known?.abbreviation ?? null,
    brandColor: known?.color ?? null, refSource: known?.source ?? DATA_SOURCES.REAL,
    founder: s.game?.party?.affiliation === 'founder', initialShare: reference?.shareOfChoices,
    reference: reference ? { validChoices: reference.validChoices, shareOfChoices: reference.shareOfChoices, amountEuro: reference.amountEuro, year: reference.declarationYear, source: DATA_SOURCES.REAL } : null
  };
}
function buildSociety(s) {
  const player = playerOf(s);
  return createSociety({ seedText: seedOf(s), date: s.clock.currentDate, week: s.game?.week.index ?? 1, homeRegion: player?.region ?? null, notoriety: playerStat(s, 'notoriety', 20) });
}
function buildWorld(s, record = null) {
  const player = playerOf(s);
  return createWorld({
    seedText: `${player?.displayName}|${player?.birthDate}|${s.career.startedAt}|${s.career.initialLevel}`,
    date: s.clock.currentDate, week: s.game?.week.index ?? 1, place: { region: player?.region ?? null, municipality: player?.municipality ?? null },
    playerParty: worldPartyOf(s, record), forces: realForces, stats: statsOf(s)
  });
}
// The demo protagonist used to carry a realistic invented name: it becomes an explicit demo label.
function renameLegacyDemo(raw) {
  const politicians = raw.dataset?.politicians;
  if (!politicians?.some(item => item.id === 'politico-demo' && item.displayName === 'Giulia Rinaldi')) return raw;
  return { ...raw, dataset: { ...raw.dataset, politicians: politicians.map(item => item.id === 'politico-demo' && item.displayName === 'Giulia Rinaldi' ? { ...item, firstName: 'Profilo', lastName: 'Demo', displayName: 'Profilo demo (simulato)' } : item) } };
}
// A save that used one of the old invented demo parties keeps it as the player's own (user) party; the others disappear.
function migrateDemoParty(s) {
  const demo = s.dataset.parties.filter(party => party.source === DATA_SOURCES.SIMULATION);
  if (!demo.length || s.career.status === 'demo') return s;
  const partyId = playerOf(s)?.partyId ?? s.career.partyId;
  const parties = s.dataset.parties.filter(party => party.source !== DATA_SOURCES.SIMULATION || party.id === partyId).map(party => party.id === partyId ? { ...party, source: DATA_SOURCES.USER, legacyDemo: true } : party);
  return { ...s, dataset: { ...s.dataset, parties } };
}
function prepareState(input) {
  const raw = renameLegacyDemo(input);
  const parliament = normalizeParliamentState(raw.parliament);
  // A message on screen belongs to the moment it was shown, not to the save.
  const base = { ...raw, version: STATE_VERSION, campaign: raw.campaign ?? null, parliament, ui: { ...(raw.ui ?? {}), toast: null } };
  const game = normalizeGameState(raw.game) ?? buildGame(base);
  // Governments formed before Prime Ministers were tracked were the player's.
  if (parliament?.government && !parliament.government.formedBy) parliament.government = { ...parliament.government, formedBy: 'player', primeMinister: ['active', 'crisis'].includes(parliament.government.status) ? 'player' : null, agenda: parliament.government.agenda ?? [] };
  const world = normalizeWorld(raw.world) ?? buildWorld({ ...base, game });
  const society = normalizeSociety(raw.society) ?? buildSociety({ ...base, game });
  return { ...base, game, world, society, parliament: withCapital(parliament, game) };
}

const hydratedState = hydrateState(storedState);
let state = prepareState(hydratedState);
let lastSaved = storedState ? (isRestorableSave(storedState) ? 'Salvataggio caricato' : 'Salvataggio non valido: copia conservata') : 'Nuova carriera demo';
if (isRestorableSave(storedState) && storedState.version < STATE_VERSION) {
  try { storage.save(state); lastSaved = 'Salvataggio aggiornato'; } catch { lastSaved = 'Salvataggio locale non disponibile'; }
}
const listeners = new Set();
let timelineBase = state;

function emit() { for (const listener of listeners) listener(state, lastSaved); }
// ---------- career timeline ----------
// Every save compares the career with the previous save and writes down what changed.
const TIMELINE_LIMIT = 300;
function addTimeline(s, entries) {
  if (!entries.length || !s.game) return s;
  const week = s.game.week.index;
  const items = entries.map(entry => ({ id: makeId('storia'), week, date: s.clock.currentDate, detail: null, tone: 'neutral', source: DATA_SOURCES.SIMULATION, ...entry }));
  return { ...s, game: { ...s.game, timeline: [...(s.game.timeline ?? []), ...items].slice(-TIMELINE_LIMIT) } };
}
function timelineDiff(before, after) {
  if (!before?.game || !after?.game || before.career.id !== after.career.id) return [];
  const entries = [];
  const playerId = after.career.playerId;
  const b = before.game.party, a = after.game.party;
  if (b?.partyId !== a?.partyId) {
    if (b) entries.push({ kind: 'partito', title: `Lasci ${b.label ?? 'il partito'}`, tone: 'bad' });
    if (a) entries.push({ kind: 'partito', title: a.affiliation === 'founder' ? `Fondi ${a.label ?? 'il tuo partito'}` : `Aderisci a ${a.label ?? 'un partito'}`, tone: 'good' });
  } else if (a && b && a.rank !== b.rank) entries.push({ kind: 'partito', title: a.rank > b.rank ? `Nuovo ruolo nel partito: ${a.rankTitle}` : `Perdi il ruolo di ${b.rankTitle.toLowerCase()}`, detail: a.rank > b.rank ? null : `Ora ${a.rankTitle.toLowerCase()}`, tone: a.rank > b.rank ? 'good' : 'bad' });
  if (a?.line && a.line !== b?.line) entries.push({ kind: 'partito', title: `Linea del partito: ${PARTY_LINES[a.line]?.label ?? a.line}`, tone: 'neutral' });
  const openBefore = new Set(before.dataset.offices.filter(item => !item.endDate && item.politicianId === playerId).map(item => item.id));
  const openAfter = new Set(after.dataset.offices.filter(item => !item.endDate && item.politicianId === playerId).map(item => item.id));
  for (const office of after.dataset.offices) if (openAfter.has(office.id) && !openBefore.has(office.id)) entries.push({ kind: 'incarico', title: `Nuovo incarico: ${office.title}`, detail: office.institution, tone: 'good' });
  for (const office of before.dataset.offices) if (openBefore.has(office.id) && !openAfter.has(office.id)) entries.push({ kind: 'incarico', title: `Fine dell’incarico: ${office.title}`, detail: office.institution, tone: 'neutral' });
  const gb = before.parliament?.government, ga = after.parliament?.government;
  if (ga && (ga.id !== gb?.id || ga.status !== gb?.status)) {
    if (ga.status === 'active' && gb?.status !== 'active') entries.push({ kind: 'governo', title: `${ga.name} ottiene la fiducia`, detail: ga.primeMinister === 'player' ? 'Sei Presidente del Consiglio' : null, tone: 'good' });
    else if (ga.status === 'crisis') entries.push({ kind: 'governo', title: `Crisi di governo: ${ga.name}`, tone: 'bad' });
    else if (ga.status === 'fallen') entries.push({ kind: 'governo', title: `Cade ${ga.name}`, tone: 'bad' });
  }
  const known = new Set((before.parliament?.history ?? []).map(item => item.id));
  for (const item of after.parliament?.history ?? []) if (!known.has(item.id) && ['iter-approved', 'iter-rejected'].includes(item.type)) entries.push({ kind: 'legge', title: item.text, tone: item.type === 'iter-approved' ? 'good' : 'bad' });
  for (const result of (after.career.electionHistory ?? []).slice(before.career.electionHistory?.length ?? 0)) entries.push({ kind: 'elezione', title: `Elezioni ${result.electionType}: ${String(Math.round((result.percent ?? 0) * 10) / 10).replace('.', ',')}%`, detail: result.personalMandate ? 'Mandato conquistato' : 'Nessun mandato', tone: result.personalMandate ? 'good' : 'bad' });
  if (after.game.legislature?.number !== before.game.legislature?.number) entries.push({ kind: 'governo', title: `Si apre la ${after.game.legislature.label}`, tone: 'neutral' });
  if (after.game.status === 'ended' && before.game.status !== 'ended') entries.push({ kind: 'fine', title: 'La carriera si chiude', detail: after.game.endReason, tone: 'bad' });
  return entries;
}
// Autosave follows the player's setting: after every action, at the end of each week, or only by hand.
let weekClosed = false;
let unsaved = false;
function persist({ force = false } = {}) {
  if (timelineBase) state = addTimeline(state, timelineDiff(timelineBase, state));
  timelineBase = state;
  const mode = loadSettings().autosave;
  if (!force && (mode === 'manual' || (mode === 'week' && !weekClosed))) { unsaved = true; lastSaved = mode === 'manual' ? 'Modifiche non salvate' : 'Salvataggio a fine settimana'; return; }
  weekClosed = false;
  try {
    storage.save(state);
    unsaved = false;
    lastSaved = `Salvato alle ${new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  } catch { lastSaved = 'Salvataggio non disponibile'; }
}
// What a save slot shows before it is opened.
function slotMeta(s) {
  const player = playerOf(s);
  const office = s.dataset.offices.find(item => item.id === player?.roleId);
  return { player: player?.displayName ?? 'Carriera', role: office?.title ?? null, party: s.game?.party?.label ?? 'Indipendente', week: s.game?.week.index ?? 1, gameDate: s.clock.currentDate, status: s.game?.status ?? 'active' };
}
function makeId(prefix) {
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${token}`;
}

const roundStat = value => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
const playerStats = s => Object.fromEntries(['influence', 'reputation', 'experience'].map(metric => [metric, playerStat(s, metric)]));
const chamberInstitution = chamber => chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica';
// The career engine sees the climate it works in: polls of the player's party and the country's mood.
function gameEnv(s) {
  const poll = s.world?.polls?.at(-1);
  const row = poll?.results?.find(item => item.partyId === s.world?.playerPartyId);
  return { career: s.career, offices: s.dataset.offices, campaign: s.campaign, player: playerOf(s), currentDate: s.clock.currentDate, pollShare: row?.share ?? null, pollDelta: row?.delta ?? 0, mood: s.society ? societyMood(s.society) : 50 };
}

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
  // An approved law works its way through public finances, territories and citizens.
  const deltas = { ...metricDeltas };
  let society = currentState.society;
  const chronicle = [];
  const week = currentState.game?.week.index ?? 1;
  for (const entry of newEntries.filter(item => item.type === 'iter-approved')) {
    const law = parliament?.laws.find(item => item.id === entry.details?.lawId);
    if (!law || !society) continue;
    const result = applyLawToSociety(society, { category: law.category, compromiseLevel: law.compromiseLevel ?? 0, title: law.title, origin: 'parlamento', date: currentDate, week });
    if (!result.summary) continue;
    society = { ...result.society, lawsApplied: [{ ...result.summary, lawId: law.id }, ...result.society.lawsApplied.slice(1)] };
    society = mediaEvent(society, { outletId: 'tv-nazionale', tone: result.summary.covered ? 1 : -0.5, intensity: 1.2, headline: `Approvata la legge “${law.title}”`, date: currentDate, week });
    chronicle.push({ type: 'chronicle', kind: 'legge', icon: 'law', title: `La legge “${law.title}” arriva sui territori`, body: `${result.summary.covered ? 'Coperture trovate nei conti pubblici' : 'Coperture insufficienti: effetti ridotti e deficit in aumento'}. Effetti più visibili in ${result.summary.topRegions.map(item => item.name).join(', ')} nelle prossime settimane.`, tone: result.summary.covered ? 'good' : 'bad', chain: lawChain(result.summary, law.title, Boolean(currentState.world?.playerPartyId)) }, ...lawReaction(result.summary, law.title));
    if (!result.summary.covered) deltas.reputation = (deltas.reputation ?? 0) - 1;
  }
  let statistics = [...currentState.dataset.statistics];
  const playerId = currentState.career.playerId;
  const journal = currentState.game ? deepCopy(currentState.game.why ?? { week: currentState.game.week.index, entries: [] }) : null;
  for (const [metric, delta] of Object.entries(deltas)) {
    if (!delta) continue;
    if (journal) recordWhy({ why: journal, week: currentState.game.week }, metric, delta, toast ?? 'Attività parlamentare');
    const index = statistics.findIndex(item => item.subjectId === playerId && item.metric === metric);
    if (index < 0) statistics.push({ id: makeId('stat-' + metric), subjectId: playerId, metric, value: roundStat(delta), unit: '100', asOf: currentDate, source: DATA_SOURCES.SIMULATION });
    else statistics[index] = { ...statistics[index], value: roundStat(statistics[index].value + delta), asOf: currentDate, source: DATA_SOURCES.SIMULATION };
  }
  const lawRecords = (parliament?.laws ?? []).map(law => ({ id: law.id, title: law.title, summary: law.summary, category: law.category, status: law.status, stage: law.stage, chamberId: 'chamber-' + law.firstChamber, introducedAt: law.introducedAt, updatedAt: law.updatedAt, source: DATA_SOURCES.SIMULATION }));
  let dataset = {
    ...currentState.dataset, statistics, laws: lawRecords,
    events: [...currentState.dataset.events, ...newEntries.map(event => ({ id: event.id, title: event.text, date: event.date, category: 'parlamento', status: event.type, territoryId: null, impact: event.details, source: DATA_SOURCES.SIMULATION }))]
  };
  const premierEnded = currentState.parliament?.government?.primeMinister === 'player' && !(['active', 'crisis'].includes(parliament?.government?.status) && parliament.government.id === currentState.parliament.government.id) ? [`incarico-premier-${currentState.parliament.government.id}`] : [];
  dataset = closeOffices(dataset, [...endedRoleOfficeIds(currentState.parliament, parliament), ...endedMinisterOfficeIds(currentState.parliament, parliament), ...premierEnded, ...(officeChanges.close ?? [])], currentDate);
  for (const office of officeChanges.open ?? []) dataset = openOffice(dataset, office);
  let career = newEntries.length ? { ...currentState.career, parliamentHistory: [...(currentState.career.parliamentHistory ?? []), ...newEntries] } : currentState.career;
  if (parliament?.player && career.parliamentContext) career = { ...career, parliamentContext: { ...career.parliamentContext, chamber: parliament.player.chamber, groupId: parliament.player.groupId } };
  const world = currentState.world && newEntries.length ? applyWorldSignals(currentState.world, [...worldSignalsFrom(newEntries, parliament), ...chronicle], currentDate) : currentState.world;
  // The parliament engine spends political capital; the career keeps a single balance.
  let game = currentState.game && parliament ? { ...currentState.game, resources: { ...currentState.game.resources, politicalCapital: parliament.resources?.politicalCapital ?? currentState.game.resources.politicalCapital } } : currentState.game;
  if (game && journal) game = { ...game, why: journal };
  return { ...currentState, parliament, dataset, career, game, world, society, ui: { ...currentState.ui, toast } };
}
function applyParliamentUpdate(...args) {
  state = withObjectives(computeParliamentUpdate(...args));
  persist(); emit();
  return state;
}

// Parliamentarians who back the player (or signed the bill) bring their group closer, once per law.
function withContactSupport(parliament, contacts, lawId) {
  const law = parliament?.laws.find(item => item.id === lawId);
  if (!law || law.contactSupport || !parliament.relations) return parliament;
  const backers = contacts.filter(item => item.relation >= 65 || (law.cosigners ?? []).some(signer => signer.personId === item.person.id)).filter(item => parliament.relations[item.person.groupId] && item.person.groupId !== parliament.player?.groupId);
  if (!backers.length) return parliament;
  const next = deepCopy(parliament);
  for (const backer of backers) next.relations[backer.person.groupId].value = Math.min(100, next.relations[backer.person.groupId].value + 3);
  next.laws = next.laws.map(item => item.id === lawId ? { ...item, contactSupport: backers.map(backer => ({ personId: backer.person.id, fullName: backer.person.fullName, groupId: backer.person.groupId, identitySource: DATA_SOURCES.REAL, source: DATA_SOURCES.SIMULATION })) } : item);
  return next;
}
const requireSecretary = () => { if (!isSecretary(state.game?.party)) throw new Error('Solo il segretario del partito può farlo: si diventa segretari fondando un partito o vincendo un congresso.'); };
const requireFormateur = () => { if (state.parliament?.government?.formedBy !== 'player') throw new Error('Solo chi ha formato il governo può farlo.'); };
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
    } else if (special.type === 'world-alliance' && next.world) {
      next = { ...next, world: acceptAlliance(next.world, special.partyId, next.clock.currentDate) };
    } else if (special.type === 'world-relation' && next.world) {
      next = { ...next, world: applyWorldSignals(next.world, [{ type: 'relation', partyId: special.partyId, delta: special.delta }], next.clock.currentDate) };
    } else if (special.type === 'scenario-office') {
      next = { ...next, dataset: openOffice(next.dataset, { id: makeId('incarico-esecutivo'), title: special.title, institution: 'Esecutivo di scenario (simulazione)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }) };
    } else if (special.type === 'media-repair' && next.society) {
      next = { ...next, society: { ...next.society, media: { ...next.society.media, sentiment: Math.round((next.society.media.sentiment * 0.5 + 4) * 10) / 10 } } };
    } else if (special.type.startsWith('public-') && next.society) {
      next = { ...next, society: publicBudgetChoice(next.society, special.type) };
    } else if (special.type === 'region-attention' && next.society) {
      next = { ...next, society: regionAttention(next.society, special.region, special.delta) };
    } else if (special.type === 'promise' && next.society) {
      const baseline = next.society.regions[special.region]?.indicators?.[special.indicator] ?? null;
      const week = next.game.week.index;
      next = { ...next, game: { ...next.game, promises: [...(next.game.promises ?? []), { id: `promessa-${week}-${special.issueId}`, region: special.region, indicator: special.indicator, topic: special.topic, madeWeek: week, dueWeek: week + 12, baseline, status: 'open', source: DATA_SOURCES.SIMULATION }] } };
    } else if (special.type === 'issue-law' && canManageParliament(next.parliament)) {
      const result = proposeLaw(next.parliament, { title: `Misure per ${indicatorLabel(special.indicator).toLowerCase()} in ${special.region}`, category: special.topic, summary: `Proposta nata dal calo di ${indicatorLabel(special.indicator).toLowerCase()} in ${special.region} (scenario simulato).`, currentDate: next.clock.currentDate });
      next = computeParliamentUpdate(next, withCapital(result.parliament, next.game), next.ui.toast, { experience: 0.5 });
    } else if (special.type === 'cosign' && next.parliament && special.person) {
      const parliament = deepCopy(next.parliament);
      const law = parliament.laws.find(item => item.id === special.lawId);
      if (law) {
        law.cosigners = [...(law.cosigners ?? []).filter(item => item.personId !== special.person.id), { personId: special.person.id, fullName: special.person.fullName, groupId: special.person.groupId, groupName: special.person.groupName, sourceUrl: special.person.sourceUrl, identitySource: DATA_SOURCES.REAL, source: DATA_SOURCES.SIMULATION }];
        if (parliament.relations?.[special.person.groupId]) parliament.relations[special.person.groupId] = { ...parliament.relations[special.person.groupId], value: Math.min(100, parliament.relations[special.person.groupId].value + 4) };
        next = { ...next, parliament };
      }
    } else if (special.type === 'election-missed') {
      next = special.electionType === 'politiche'
        ? endMandate(next, 'Non ricandidato alle elezioni politiche')
        : { ...next, dataset: closeTermOffices(next.dataset, player?.id, special.electionType, next.clock.currentDate) };
    }
  }
  return next;
}
// The career record keeps one open party office matching the internal rank of a member.
function syncPartyOffice(s) {
  const player = playerOf(s);
  const party = s.game?.party;
  if (!player || party?.affiliation !== 'member') return s;
  const title = party.rank >= 1 ? `${party.rankTitle} (scenario)` : null;
  const open = s.dataset.offices.filter(item => item.politicianId === player.id && item.level === 'partito' && !item.endDate);
  if (open.every(item => item.title === title) && open.length === (title ? 1 : 0)) return s;
  let dataset = { ...s.dataset, offices: s.dataset.offices.map(item => open.includes(item) && item.title !== title ? { ...item, endDate: s.clock.currentDate } : item) };
  if (title && !open.some(item => item.title === title)) dataset = openOffice(dataset, { id: makeId('incarico-partito'), title, institution: party.label || 'Partito', level: 'partito', politicianId: player.id, territoryId: player.territoryId ?? null, startDate: s.clock.currentDate });
  return { ...s, dataset };
}
function applyGameResult(base, ctx, toast, specials = []) {
  let next = { ...base, game: ctx.game, dataset: { ...base.dataset, statistics: writeStats(base, ctx.stats) }, ui: { ...base.ui, toast } };
  if (ctx.parliament) next = computeParliamentUpdate(next, withCapital(ctx.parliament, ctx.game), toast);
  return withObjectives(syncPartyOffice(handleSpecials(next, specials)));
}
// Who answers to citizens for how things go: local executives for their region, the majority for the country.
function governingRole(s) {
  const player = playerOf(s);
  const open = s.dataset.offices.filter(item => item.politicianId === player?.id && !item.endDate);
  if (open.some(item => /ministr/i.test(item.title)) || (s.parliament?.player?.groupId && playerInMajority(s.parliament))) return 'nazionale';
  if (open.some(item => /sindac|presidente di regione/i.test(item.title))) return 'locale';
  return null;
}
const NATIONAL_ISSUES = {
  'nazionale-disoccupazione': ['La disoccupazione torna a salire', 'Il tasso di disoccupazione simulato supera la soglia di guardia: sindacati e imprese chiedono misure.'],
  'nazionale-carovita': ['Carovita: i prezzi corrono', 'L’inflazione simulata erode i redditi: famiglie e pensionati protestano.'],
  'nazionale-conti': ['Conti pubblici sotto pressione', 'Deficit alto e margini di bilancio ridotti: ogni nuova spesa diventa difficile.']
};
function issueText(issue, society) {
  if (issue.scope !== 'regionale') return NATIONAL_ISSUES[issue.id] ?? ['Un problema nazionale', 'Un indicatore nazionale peggiora.'];
  const value = society.regions[issue.region]?.indicators?.[issue.indicator];
  const label = indicatorLabel(issue.indicator);
  const critical = (value ?? 0) < 36;
  return [`${label} ${critical ? 'in crisi' : 'sotto pressione'} in ${issue.region}`, `L’indice di ${label.toLowerCase()} in ${issue.region} è sceso a ${Math.round(value ?? 0)}/100 nello scenario: ${critical ? 'cittadini e amministratori chiedono risposte' : 'se non si interviene, il problema peggiorerà'}.`];
}
// Citizens, territories and media move every week; their mood lands on the career.
function tickSociety(s, date, report) {
  if (!s.society || !s.game || s.game.status === 'ended') return s;
  const before = s.society;
  const out = advanceSociety(before, { date, week: report.week, government: s.parliament?.government ?? null, notoriety: playerStat(s, 'notoriety', 20) });
  let society = out.society;
  const region = playerOf(s)?.region ?? null;
  const deltas = { reputation: clampTo(society.media.sentiment / 400, -0.25, 0.25) };
  const role = governingRole(s);
  const home = society.regions[region];
  if (role === 'locale' && home && before.regions[region]) deltas.popularity = clampTo((home.satisfaction - before.regions[region].satisfaction) * 0.6 + (home.satisfaction - 50) / 200, -1, 1);
  if (role === 'nazionale') deltas.popularity = clampTo((society.satisfaction - before.satisfaction) * 0.6 + (society.satisfaction - 50) / 250, -1, 1);
  let game = deepCopy(s.game);
  const lines = [];
  const promiseNotes = [];
  // Promises come due: citizens compare them with what actually changed.
  for (const promise of (game.promises ?? []).filter(item => item.status === 'open' && item.dueWeek <= report.week)) {
    const now = society.regions[promise.region]?.indicators?.[promise.indicator];
    const lawDone = society.lawsApplied.some(item => item.category === promise.topic && item.week >= promise.madeWeek);
    const kept = lawDone || (promise.baseline !== null && now >= promise.baseline + 3);
    promise.status = kept ? 'kept' : 'broken';
    // Citizens remember: every promise broken before makes the next one cost more.
    const broken = (game.promises ?? []).filter(item => item.status === 'broken' && item !== promise).length;
    deltas.reputation += kept ? 1.5 : -2 - broken * 0.5;
    deltas.popularity = (deltas.popularity ?? 0) + (kept ? 1 : -1);
    society = regionAttention(society, promise.region, kept ? 3 : -4);
    const text = kept ? `Promessa mantenuta in ${promise.region}: ${indicatorLabel(promise.indicator).toLowerCase()} in ripresa` : `Promessa mancata in ${promise.region}: i cittadini se ne ricordano`;
    lines.push(text);
    promiseNotes.push({ kind: 'promessa', title: text, tone: kept ? 'good' : 'bad' });
    game.log = [{ id: `diario-promessa-${promise.id}`, week: report.week, date, kind: 'territorio', title: text, lines: [kept ? 'Reputazione +1,5 · popolarità +1' : 'Reputazione −2 · popolarità −1'], tone: kept ? 'good' : 'bad', source: DATA_SOURCES.SIMULATION }, ...game.log].slice(0, 40);
  }
  // Problems that surface in the player's territory, or nationwide, ask for a response.
  // A service under pressure at home is flagged earlier, at most once every 16 weeks per indicator.
  const watched = home ? Object.entries(home.indicators).filter(([id, value]) => value < 42 && report.week - (game.flags?.watched?.[id] ?? -99) >= 16).sort((a, b) => a[1] - b[1])[0] : null;
  const pressure = watched ? { id: `${region}-${watched[0]}`, scope: 'regionale', region, indicator: watched[0], topic: ISSUE_TOPICS[watched[0]], severity: Math.round(42 - watched[1]), source: DATA_SOURCES.SIMULATION } : null;
  const issue = out.derived.find(item => item.region === region) ?? pressure ?? out.derived.find(item => item.scope === 'nazionale');
  if (issue?.region === region && issue.indicator) game.flags = { ...game.flags, watched: { ...(game.flags?.watched ?? {}), [issue.indicator]: report.week } };
  if (issue) {
    const [issueTitle, issueBody] = issueText(issue, society);
    game = addSituationEvent(game, 'crisi-territoriale', { issueTitle, issueBody, region: issue.region ?? region ?? 'Italia', indicator: issue.indicator, topic: issue.topic, issueId: issue.id, dedupe: issue.id });
  }
  const chronicle = out.derived.map(item => { const [title, body] = issueText(item, society); return { type: 'chronicle', kind: 'territorio', icon: 'pin', scope: item.scope, title, body, tone: 'bad' }; });
  // The Prime Minister's government acts on its agenda: one measure every six weeks, paid from the public budget.
  let parliament = s.parliament;
  const government = parliament?.government;
  if (isPrimeMinister(parliament) && government.agenda?.length && report.week - (government.lastAgendaWeek ?? government.agendaSetWeek ?? report.week) >= 6) {
    const category = government.agenda[(government.measureCount ?? 0) % government.agenda.length];
    const result = applyLawToSociety(society, { category, compromiseLevel: 0, title: `Decreto del governo: ${category.toLowerCase()}`, origin: 'governo', date, week: report.week });
    if (result.summary) {
      society = mediaEvent(result.society, { outletId: 'tv-nazionale', tone: result.summary.covered ? 1 : -1, intensity: 1.2, headline: `Il governo approva un decreto su ${category.toLowerCase()}`, date, week: report.week });
      chronicle.push({ type: 'chronicle', kind: 'governo', icon: 'ministry', title: result.summary.title, body: `${result.summary.covered ? 'Coperture trovate' : 'Coperture scarse: effetti ridotti e deficit in aumento'}; ne rispondi da Presidente del Consiglio.`, tone: result.summary.covered ? 'good' : 'bad', chain: lawChain(result.summary, result.summary.title) }, ...lawReaction(result.summary, result.summary.title));
      lines.push(`Il tuo governo adotta un decreto su ${category.toLowerCase()}`);
    }
    parliament = { ...parliament, government: { ...government, lastAgendaWeek: report.week, measureCount: (government.measureCount ?? 0) + 1 } };
  }
  if (out.measure) chronicle.push({ type: 'chronicle', kind: 'governo', icon: 'ministry', title: out.measure.title, body: `${out.measure.covered ? 'Misura finanziata' : 'Coperture scarse'}: effetti più visibili in ${out.measure.topRegions.map(item => item.name).join(', ')}.`, tone: 'neutral', chain: lawChain(out.measure, out.measure.title, false) }, ...lawReaction(out.measure, out.measure.title));
  if (game.lastReport) game.lastReport = { ...game.lastReport, lines: [...game.lastReport.lines, ...lines, ...out.lines.slice(0, 2)] };
  let next = { ...s, society, game, parliament, world: s.world && chronicle.length ? applyWorldSignals(s.world, chronicle, date) : s.world };
  const stats = statsOf(next);
  const changed = Object.fromEntries(Object.entries(deltas).filter(([, delta]) => Math.abs(delta) >= 0.01).map(([metric, delta]) => [metric, roundStat((stats[metric] ?? 50) + delta)]));
  const journal = { why: deepCopy(next.game.whyLast ?? { week: report.week, entries: [] }), week: next.game.week };
  if (deltas.reputation) recordWhy(journal, 'reputation', deltas.reputation, promiseNotes.length ? 'Tono dei media e promesse verificate' : 'Tono della copertura dei media');
  if (deltas.popularity) recordWhy(journal, 'popularity', deltas.popularity, role ? 'Come stanno i cittadini che governi' : 'Promesse verificate dai cittadini');
  next = { ...next, game: { ...next.game, whyLast: journal.why } };
  if (Object.keys(changed).length) next = { ...next, dataset: { ...next.dataset, statistics: writeStats(next, { ...stats, ...changed }) } };
  return addTimeline(next, promiseNotes);
}
// Situations that come from the state of the world rather than from chance.
function raiseSituations(s, report) {
  if (!s.game || s.game.status === 'ended') return s;
  let game = s.game;
  const week = report.week;
  const cooldowns = game.flags?.cooldowns ?? {};
  const raised = [];
  const raise = (id, params, weeks) => {
    if (week - (cooldowns[id] ?? -99) < weeks || game.inbox.some(item => item.templateId === id)) return;
    game = addSituationEvent(game, id, params);
    raised.push(id);
  };
  const sentiment = s.society?.media.sentiment ?? 0;
  if (sentiment <= -25) raise('campagna-stampa', { reason: sentiment <= -45 ? 'articoli e servizi ti dipingono come inaffidabile' : 'le tue ultime uscite sono state raccontate male' }, 10);
  const player = s.world?.parties?.find(item => item.isPlayer);
  const polls = s.world?.polls ?? [];
  if (player && polls.length >= 5) {
    const share = poll => poll.results.find(row => row.partyId === player.id)?.share ?? 0;
    const change = Math.round((share(polls.at(-1)) - share(polls.at(-5))) * 10) / 10;
    if (change <= -1.2) raise('sondaggi-crollo', { party: player.label, drop: String(Math.abs(change)).replace('.', ','), event: 'Piano di rilancio del partito' }, 8);
    else if (change >= 1.2) raise('sondaggi-slancio', { party: player.label, gain: String(change).replace('.', ',') }, 8);
  }
  if (governingRole(s) === 'nazionale' && (s.society?.publicFinance.headroom ?? 100) < 15) raise('bilancio-pubblico', {}, 10);
  const party = game.party;
  const next = party?.affiliation === 'member' ? nextPartyRank(game) : null;
  if (next && next.level <= 3 && party.support >= 72 && (relationValue(game, 'leadership') ?? 50) >= 60) raise('offerta-incarico', { rank: next.title.toLowerCase() }, 12);
  if (!raised.length) return s;
  return { ...s, game: { ...game, flags: { ...game.flags, cooldowns: { ...cooldowns, ...Object.fromEntries(raised.map(id => [id, week])) } } } };
}
const segmentLabel = id => SEGMENTS.find(item => item.id === id)?.label ?? id;
// The chain of consequences of a measure, step by step, as the player sees it.
function lawChain(summary, title, hasParty = true) {
  return [
    ['money', `Bilancio pubblico: ${summary.covered ? '' : 'senza coperture, '}−${String(summary.cost).replace('.', ',')} punti di margine`],
    ['map', `Territori: effetti più forti in ${summary.topRegions.map(item => item.name).join(', ')}`],
    ['users', `Cittadini: ${summary.pleased.length ? `soddisfatti ${summary.pleased.map(segmentLabel).join(', ')}` : 'nessun gruppo particolarmente favorito'}${summary.displeased.length ? ` · scontenti ${summary.displeased.map(segmentLabel).join(', ')}` : ''}`],
    ['media', `Media: «${title}» nei telegiornali`],
    ...(hasParty && summary.origin !== 'esecutivo' ? [['chart', 'Sondaggi: il tuo partito guadagna nelle settimane successive']] : [])
  ].map(([icon, text]) => ({ icon, text }));
}
// Organised interests answer: those who lose protest, those who gain applaud.
function lawReaction(summary, title) {
  if (summary.displeased.length) return [{ type: 'chronicle', kind: 'reazione', icon: 'megaphone', scope: 'nazionale', title: `Protestano ${segmentLabel(summary.displeased[0]).toLowerCase()}`, body: `«${title}» non piace a chi si sente penalizzato: presidi e comunicati contro la misura.`, tone: 'bad' }];
  if (summary.pleased.length) return [{ type: 'chronicle', kind: 'reazione', icon: 'users', scope: 'nazionale', title: `Soddisfazione tra ${segmentLabel(summary.pleased[0]).toLowerCase()}`, body: `Le associazioni accolgono «${title}» come una risposta attesa.`, tone: 'good' }];
  return [];
}
function societySignal(society) {
  if (!society) return null;
  const [previous, latest] = society.history.slice(-2);
  return { mood: societyMood(society), moodDelta: previous && latest ? latest.satisfaction - previous.satisfaction : 0, trust: society.trust, sentiment: society.media.sentiment, executive: society.executive };
}
// The political world moves once a week and answers back: polls, events, majorities, reactions.
function tickWorld(s, date, report) {
  const secretary = isSecretary(s.game?.party);
  const out = advanceWorld(s.world, { date, week: report.week, stats: statsOf(s), deltas: report.deltas ?? {}, game: s.game, parliament: s.parliament, majorityShift, society: societySignal(s.society), playerIsLeader: secretary, playerStrategy: secretary ? s.game.party.line ?? 'autonoma' : null });
  let next = { ...s, world: out.world };
  if (s.parliament) next = computeParliamentUpdate(next, withCapital(out.parliament, next.game), next.ui.toast);
  let game = next.game;
  if (out.reactions[0]) game = addWorldReaction(game, out.reactions[0]);
  // Records in the polls are milestones of the career.
  const own = out.world.polls.at(-1)?.results.find(row => row.partyId === out.world.playerPartyId)?.share;
  const notes = [];
  if (Number.isFinite(own) && out.world.polls.length > 4) {
    const records = game.flags?.pollRecords ?? { max: own, min: own };
    if (own >= records.max + 1) { notes.push({ kind: 'sondaggi', title: `Nuovo massimo nei sondaggi: ${String(own).replace('.', ',')}%`, tone: 'good' }); records.max = own; }
    else if (own <= records.min - 1) { notes.push({ kind: 'sondaggi', title: `Nuovo minimo nei sondaggi: ${String(own).replace('.', ',')}%`, tone: 'bad' }); records.min = own; }
    game = { ...game, flags: { ...game.flags, pollRecords: { max: Math.max(records.max, own), min: Math.min(records.min, own) } } };
  }
  // Other parties act on their own strategies: offers of an alliance, attacks on the player's party.
  for (const offer of out.offers ?? []) game = addSituationEvent(game, offer.templateId, { partyLabel: offer.label, partyId: offer.partyId, strategy: offer.strategy ?? '', dedupe: `${offer.templateId}|${offer.partyId}` });
  game = { ...game, lastReport: game.lastReport ? { ...game.lastReport, lines: [...game.lastReport.lines, ...out.lines] } : game.lastReport };
  return addTimeline({ ...next, game, parliament: withCapital(next.parliament, game) }, notes);
}
function settleWeeks(s) {
  let next = s;
  let report = null;
  for (let guard = 0; next.game && next.game.status !== 'ended' && elapsedDays(next.game.week.startedAt, next.clock.currentDate) >= 7 && guard < 260; guard++) {
    const weekEnd = advanceDays(next.game.week.startedAt, 7);
    const result = advanceWeek({ game: next.game, stats: statsOf(next), parliament: next.parliament }, { ...gameEnv(next), currentDate: weekEnd }, advanceGovernmentWeek);
    next = applyGameResult(next, result.ctx, next.ui.toast, result.specials);
    if (result.report) next = tickSociety(next, weekEnd, result.report);
    if (next.world && result.report) next = tickWorld(next, weekEnd, result.report);
    weekClosed = true;
    if (result.report) next = raiseSituations(next, result.report);
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
// What the player does is seen: channels pick it up, territories notice, the party's polls move.
const MEDIA_HEADLINES = {
  social: ['{name} lancia una campagna sui social', 'Polemica per un post di {name}'], intervista: ['Intervista a {name}', 'Parole di {name} travisate: bufera'],
  talk: ['{name} ospite in prima serata', 'Scontro in diretta per {name}'], progetto: ['{name} presenta un progetto per il territorio', 'Il progetto di {name} si arena'],
  ascolto: ['{name} tra mercati e quartieri', 'Contestazione durante l’incontro di {name}'], associazioni: ['{name} costruisce una rete con le associazioni', 'Un comitato accusa {name} di passerella'],
  dissenso: ['{name} rompe con la linea del partito', '{name} isolato nel partito'], 'campagna-partito': ['Parte la campagna nazionale del partito', 'Spot del partito criticati'],
  conferenza: ['Conferenza stampa di {name}: risposte convincenti', 'Conferenza stampa di {name}: domande senza risposta'], interrogazione: ['{name} porta in Aula i problemi del territorio', 'Interrogazione di {name}: il governo non risponde']
};
function publicEcho(s, activityId, tone, extra = {}) {
  if (!s.society) return s;
  const player = playerOf(s);
  const name = player?.displayName ?? 'Il politico';
  const outletId = extra.outlet ?? ACTIVITY_MEDIA[activityId];
  const week = s.game?.week.index ?? 1;
  let society = s.society;
  if (outletId) {
    const [good, bad] = MEDIA_HEADLINES[activityId] ?? ['{name} al centro della scena', 'Critiche a {name}'];
    const value = tone === 'bad' ? -1 : extra.tone ?? 1;
    society = mediaEvent(society, { outletId, tone: value, intensity: extra.intensity ?? 1, headline: (value < 0 ? bad : good).replace('{name}', name), date: s.clock.currentDate, week });
  }
  if (extra.region && society.regions[extra.region]) society = regionAttention(society, extra.region, tone === 'bad' ? -0.4 : extra.regionDelta ?? 0.6);
  return { ...s, society };
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
  save() { persist({ force: true }); state = { ...state, ui: { ...state.ui, toast: 'Carriera salvata' } }; emit(); },
  // ---------- games and save slots ----------
  hasCareer: () => state.career.status !== 'demo' && Boolean(state.game),
  hasUnsavedChanges: () => unsaved,
  currentMeta: () => slotMeta(state),
  listSlots: () => storage.listSlots(),
  saveToSlot(name = null, id = null) {
    if (!store.hasCareer()) throw new Error('Non c’è una partita da salvare.');
    const meta = slotMeta(state);
    const slotId = storage.saveSlot(state, { ...meta, name: name?.trim() || `${meta.player} · settimana ${meta.week}` }, id);
    state = { ...state, ui: { ...state.ui, toast: 'Partita salvata nello slot' } };
    emit();
    return slotId;
  },
  loadSlot(id) { return store.loadGame(storage.loadSlot(id), 'Partita caricata'); },
  deleteSlot(id) { storage.deleteSlot(id); emit(); },
  // A game from a slot or a file replaces the running one (which is kept in a slot first).
  loadGame(payload, toast = 'Partita caricata') {
    const saved = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!isRestorableSave(saved)) throw new Error('Il file non contiene una partita di POLITICANDO 2026.');
    if (store.hasCareer() && unsaved) store.saveToSlot('Partita precedente (salvataggio automatico)');
    state = migrateDemoParty(prepareState(hydrateState(saved)));
    if (realForces.length && state.world && isLegacyWorld(state.world)) state = { ...state, world: buildWorld(state) };
    timelineBase = state;
    state = { ...state, ui: { ...state.ui, activePage: 'panoramica', toast } };
    persist({ force: true }); emit();
    return state;
  },
  exportSave() { return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), exportedBy: 'POLITICANDO 2026' }); },
  clearAllSaves() {
    storage.clearAll();
    state = prepareState(makeDemoState());
    timelineBase = state;
    lastSaved = 'Nessuna partita salvata'; emit();
  },
  // One turn of play: one or more weeks, stopping early when something needs the player.
  advanceTurn(weeks = Number(loadSettings().weeksPerTurn) || 1) {
    for (let index = 0; index < weeks; index++) {
      store.advance(7);
      const game = state.game;
      if (!game || game.status === 'ended' || state.campaign?.status === 'active' || game.inbox.some(item => ['urgente', 'situazione'].includes(item.kind))) break;
    }
  },
  // Real reference data the simulation builds on (2x1000 and party catalogue). Older saves are brought in line:
  // worlds with invented forces are rebuilt with real parties, a demo party of the player becomes the player's own.
  setRealReference(reference = {}) {
    realForces = forcesFrom(reference);
    let next = migrateDemoParty(state);
    if (next.world && (isLegacyWorld(next.world) || !next.world.parties.some(party => !party.isPlayer)) && realForces.length) next = { ...next, world: buildWorld(next) };
    if (next === state) return;
    state = next;
    if (state.career.status !== 'demo') persist();
    emit();
  },
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
    // The election fund (plus donors' share) and the party treasury back the candidate too.
    const fundTotal = Math.round((game.finance?.electionFund ?? 0) * 1.15);
    const org = party?.org;
    const partyFunds = org && org.treasury.balance > 0 ? Math.round(party.affiliation === 'founder' ? Math.min(org.treasury.balance * 0.3, 20000) : Math.min(org.treasury.balance * (0.02 + party.rank * 0.01), 4000 + party.rank * 1500) * Math.max(0.3, Math.min(1.3, party.support / 60))) : 0;
    const candidate = campaign.candidates.find(item => item.isPlayer);
    candidate.resources.money += transfer + game.prep * 30 + fundTotal + partyFunds;
    candidate.resources.volunteers += Math.max(0, Math.round(game.prep / 6 + ((relationValue(game, 'civic') ?? 45) - 45) / 8)) + (hasAsset(game.finance, 'piattaforma') ? 3 : 0);
    candidate.resources.organization = Math.min(100, candidate.resources.organization + Math.round(game.prep / 5));
    campaign.resources = { ...candidate.resources, visibility: Math.max(0, campaign.resources.visibility + Math.round(((relationValue(game, 'media') ?? 45) - 45) / 5)), source: 'simulation' };
    if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + partyBonus));
    if (party?.affiliation === 'member') campaign.candidacy.listPosition = campaign.nomination.listPosition = Math.max(1, Math.min(6, 6 - party.rank - (party.support >= 70 ? 1 : 0)));
    // Polls and allies decide how much of the party's pull the candidate starts with.
    const poll = campaignPollBonus(state.world, config.electionType, statsOf(state), game.relations);
    // Citizens vote on how they feel: incumbents pay for discontent, challengers gain from it.
    const mood = state.society ? societyMood(state.society) : 50;
    const incumbent = Boolean(governingRole(state));
    const moodBonus = round2(clampTo(incumbent ? (mood - 50) * 0.05 : (50 - mood) * 0.025, -1.5, 1.5));
    poll.bonus = round2(poll.bonus + moodBonus);
    const selection = game.party?.org?.selections?.[election.id] ?? null;
    if (selection && campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + selection.bonus));
    const local = ['comunale', 'regionale'].includes(config.electionType) ? state.society?.regions?.[player?.region] : null;
    campaign.context = { participation: local?.participation ?? state.society?.participation ?? null, mood, incumbent, source: 'simulation' };
    if (poll.bonus) for (const area of campaign.territories) {
      const shares = area.supportByCandidate;
      shares[campaign.playerCandidateId] = Math.max(0.5, shares[campaign.playerCandidateId] + poll.bonus);
      const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
      for (const id of Object.keys(shares)) shares[id] = round2(shares[id] * 100 / total);
    }
    campaign.totalDays = Math.max(21, elapsedDays(state.clock.currentDate, election.electionDate));
    campaign.electionDate = election.electionDate;
    campaign.scheduledElectionId = election.id;
    campaign.preparation = { prep: game.prep, transfer, fund: fundTotal, partyFunds, partyBonus: round2(partyBonus), pollBonus: poll.bonus, pollShare: poll.share, allies: poll.allies, moodBonus, selection: selection ? { method: selection.method, bonus: selection.bonus } : null, source: 'simulation' };
    campaign.history.unshift({ id: `preparazione-${campaign.id}`, day: 0, date: state.clock.currentDate, type: 'preparazione', text: `Preparazione ${game.prep}/100 · ${transfer} € dalla carriera${fundTotal ? ` · ${fundTotal} € dal fondo elettorale` : ''}${partyFunds ? ` · ${partyFunds} € dal partito` : ''} · sostegno interno ${partyBonus >= 0 ? '+' : ''}${round2(partyBonus)} · sondaggi ${poll.bonus >= 0 ? '+' : ''}${poll.bonus}`, source: 'simulation' });
    const nextGame = deepCopy({ ...markElectionRunning(game, election.id, campaign.id), prep: 0 });
    book(nextGame, -transfer, 'campagne', `Fondi trasferiti alla campagna: ${election.label}`, state.clock.currentDate);
    releaseElectionFund(nextGame, state.clock.currentDate);
    if (partyFunds) treasuryBook(nextGame.party.org, -partyFunds, 'campagne', `Sostegno alla candidatura: ${election.label}`);
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
    const activity = result.activity;
    state = applyGameResult(state, result.ctx, `${result.report.title}: ${result.report.tone === 'bad' ? 'qualcosa è andato storto' : 'fatto'}`, []);
    const home = playerOf(state)?.region ?? null;
    const region = activity.target === 'region' ? targetId : activity.category === 'territorio' ? home : null;
    // A press conference is written up according to the player's reputation.
    const reputation = playerStat(state, 'reputation');
    const tone = activity.media?.tone === 'reputation' ? (reputation >= 55 ? 1 : reputation < 40 ? -1 : 0.3) : activity.media?.tone;
    state = publicEcho(state, activity.id, result.report.tone, { outlet: activity.media?.outlet, region, tone });
    if (state.society && activity.society?.segment) state = { ...state, society: segmentAttention(state.society, targetId, activity.society.segment * (result.report.tone === 'bad' ? -0.4 : 1), home) };
    if (state.society && activity.society?.homeTrust && home) state = { ...state, society: regionAttention(state.society, home, activity.society.homeTrust) };
    if (activity.effects?.world && state.world) state = { ...state, world: applyWorldSignals(state.world, [{ type: 'stance', delta: result.report.tone === 'bad' ? -activity.effects.world / 2 : activity.effects.world, title: activity.label }], state.clock.currentDate) };
    persist(); emit();
    return result;
  },
  // ---------- the secretary ----------
  setPartyLine(line) { return commitGame(setPartyLine(this.gameInput(), gameEnv(state), line), 'Nuova linea del partito'); },
  assignOrgans(currentId) { return commitGame(assignOrgans(this.gameInput(), gameEnv(state), currentId), 'Organi del partito riassegnati'); },
  setCandidacyRule(rule) { return commitGame(setCandidacyRule(this.gameInput(), gameEnv(state), rule), 'Regola per le candidature aggiornata'); },
  callEarlyCongress() { return commitGame(callEarlyCongress(this.gameInput(), gameEnv(state)), 'Congresso anticipato convocato'); },
  partyInvestment(id) { return commitGame(partyInvestment(this.gameInput(), gameEnv(state), id), 'Investimento del partito avviato'); },
  disciplineGroup() { return commitGame(disciplineGroup(this.gameInput(), gameEnv(state)), 'Richiamo alla disciplina'); },
  expelDissidents() {
    const result = commitGame(expelDissidents(this.gameInput(), gameEnv(state)), 'Dissidenti espulsi');
    if (state.society) { state = { ...state, society: mediaEvent(state.society, { outletId: 'quotidiani', tone: -1, intensity: 1, headline: 'Epurazione nel partito: i dissidenti fuori', date: state.clock.currentDate, week: state.game.week.index }) }; persist(); emit(); }
    return result;
  },
  gameInput() { return { game: state.game, stats: statsOf(state), parliament: state.parliament }; },
  invest(investmentId) {
    const result = makeInvestment({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), investmentId);
    return commitGame(result, `Investimento fatto: ${result.investment.label}`);
  },
  saveForElection(amount) {
    const result = saveForElection({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), Number(amount));
    return commitGame(result, `Fondo elettorale: ${result.fund} €`);
  },
  // Weekly budget of the player's committee: staff, communication, territory, office.
  setBudget(lineId, level) {
    if (!state.game || state.game.status === 'ended') throw new Error('La carriera è conclusa: inizia una nuova partita.');
    const finance = setBudgetLevel(state.game.finance, lineId, Number(level));
    state = { ...state, game: { ...state.game, finance }, ui: { ...state.ui, toast: 'Bilancio aggiornato: vale dalla prossima chiusura di settimana' } };
    persist(); emit();
    return finance;
  },
  // The party's budget priorities are decided by its national leadership.
  setPartyPriority(priorityId, level) {
    const party = state.game?.party;
    if (!party?.org) throw new Error('Serve un partito.');
    if (!isPartyLeader(party)) throw new Error('Le priorità di bilancio del partito si decidono in direzione nazionale.');
    const value = Number(level);
    if (!['territorio', 'comunicazione', 'formazione'].includes(priorityId) || ![0, 1, 2].includes(value)) throw new Error('Priorità non valida.');
    state = { ...state, game: { ...state.game, party: { ...party, org: { ...party.org, priorities: { ...party.org.priorities, [priorityId]: value } } } }, ui: { ...state.ui, toast: 'Priorità del partito aggiornate' } };
    persist(); emit();
  },
  // National averages weigh each region by its verified number of Camera seats.
  calibrateSociety(weights = {}) {
    const society = calibrateWeights(state.society, weights, 'camera');
    if (society === state.society) return;
    state = { ...state, society };
    persist(); emit();
  },
  // Real parliamentarians pertinent to the career: identity from the verified dataset, relationship simulated.
  syncRealContacts({ politicians = [], groups = [], offices = [] } = {}) {
    if (!state.game || !politicians.length) return state.game?.contacts ?? [];
    const player = playerOf(state);
    const selection = selectContacts({ politicians, groups, offices, region: player?.region ?? null, chamber: state.parliament?.player?.chamber ?? null, groupId: state.parliament?.player?.groupId ?? null, seedText: state.career.id ?? seedOf(state) });
    const seed = [...String(state.career.id ?? 'contatti')].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7);
    let counter = seed;
    const contacts = syncContacts(state.game.contacts ?? [], selection, { week: state.game.week.index, rand: () => { counter = (Math.imul(counter, 1664525) + 1013904223) >>> 0; return counter / 4294967296; } });
    const signature = list => list.map(item => `${item.person.id}:${item.reason}:${item.person.fullName}:${item.person.groupId}`).join('|');
    if (signature(contacts) === signature(state.game.contacts ?? [])) return state.game.contacts;
    state = { ...state, game: { ...state.game, contacts } };
    persist(); emit();
    return contacts;
  },
  resolveAgendaItem(itemId, choiceId) {
    const leaderBefore = state.game.party?.leaderCurrentId;
    const item = state.game.inbox.find(entry => entry.id === itemId);
    const result = resolveInboxItem({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), itemId, choiceId);
    state = applyGameResult(state, result.ctx, result.report.lines.at(-1) ?? 'Decisione registrata', result.specials ?? []);
    // Important decisions stay in the career's history.
    if (['urgente', 'situazione'].includes(item?.kind) || ['congresso', 'presa-posizione'].includes(item?.templateId)) state = addTimeline(state, [{ kind: 'decisione', title: `${item.title}: ${item.choices.find(entry => entry.id === choiceId)?.label ?? choiceId}`, detail: result.report.lines.slice(0, 3).join(' · ') || null, tone: result.report.tone === 'bad' ? 'bad' : 'neutral' }]);
    persist(); emit();
    // Public choices reach the media; answering a local problem reaches its territory.
    const echo = { radio: 'radio', 'prima-serata': 'tv-nazionale', 'presa-posizione': 'quotidiani', 'crisi-territoriale': 'stampa-locale', protesta: 'tv-locale', maltempo: 'tv-locale' }[item?.templateId];
    const chosen = item?.choices.find(entry => entry.id === choiceId);
    if (echo && (chosen?.cost?.ap || ['attacco', 'proposta', 'promessa', 'dichiarazione'].includes(choiceId))) {
      state = publicEcho(state, item.templateId, result.report.tone, { outlet: echo, region: item.templateId === 'crisi-territoriale' ? null : playerOf(state)?.region });
      persist(); emit();
    }
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
    return commitGame(result, result.success ? `Nuovo incarico nel partito: ${result.rank.title}` : 'La sfida interna non è andata a buon fine');
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
    requireSecretary();
    const game = spendTime(state.game, 1);
    if (game.resources.politicalCapital < 4) throw new Error('Servono 4 punti di capitale politico per trattare un’alleanza.');
    const result = proposeAlliance(state.world, forceId, { partySupport: game.party.support, influence: playerStat(state, 'influence'), date: state.clock.currentDate });
    const nextGame = { ...game, resources: { ...game.resources, politicalCapital: game.resources.politicalCapital - 4 } };
    state = { ...state, world: result.world, game: nextGame, parliament: withCapital(state.parliament, nextGame), ui: { ...state.ui, toast: result.success ? 'Alleanza firmata' : 'La proposta di alleanza è stata respinta' } };
    persist(); emit();
    return result;
  },
  breakAlliance(allianceId) {
    requireSecretary();
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
    // A simulated amendment to a real act keeps the act's verified identity, never its content.
    const reference = draft.realReference?.source === DATA_SOURCES.REAL && draft.realReference.verified === true ? { ...draft.realReference } : null;
    const parliament = reference ? { ...result.parliament, laws: result.parliament.laws.map(law => law.id === result.law.id ? { ...law, realReference: reference } : law) } : result.parliament;
    applyParliamentUpdate(next, parliament, reference ? 'Proposta depositata: modifica simulata di un atto reale' : 'Proposta depositata', { experience: 0.5, influence: 0.5 });
    return parliament.laws.find(law => law.id === result.law.id);
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
    const result = advanceLaw(withContactSupport(next.parliament, next.game?.contacts ?? [], lawId), lawId, action, next.clock.currentDate);
    const finished = ['approved', 'rejected'].includes(result.law.stage);
    const delta = finished ? (result.law.stage === 'approved' ? { reputation: 1, influence: 1, experience: 1, notoriety: 0.5 } : { reputation: -0.5, experience: 0.5 }) : { influence: 0.25 };
    const toast = result.law.stage === 'approved' ? 'Legge approvata in simulazione' : result.law.stage === 'rejected' ? 'Votazione conclusa: proposta respinta' : 'Iter legislativo aggiornato';
    return applyParliamentUpdate(next, result.parliament, toast, delta);
  },
  formGovernment(groupIds) {
    requireSecretary();
    const next = withTime(PARLIAMENT_TIME_COSTS.formGovernment);
    const parliament = formGovernment(next.parliament, groupIds, next.clock.currentDate);
    return applyParliamentUpdate(next, { ...parliament, government: { ...parliament.government, formedBy: 'player', agenda: [] } }, 'Ricevi l’incarico: trattativa di governo aperta', { influence: 0.5 });
  },
  // The Prime Minister sets the government's priorities: the executive acts on them every six weeks.
  setGovernmentAgenda(areas = []) {
    if (!isPrimeMinister(state.parliament)) throw new Error('Solo il Presidente del Consiglio decide l’agenda del governo.');
    const agenda = [...new Set(areas)].filter(area => LAW_CATEGORIES.includes(area)).slice(0, 3);
    if (!agenda.length) throw new Error('Scegli da una a tre priorità.');
    const next = withTime(1);
    return applyParliamentUpdate(next, { ...next.parliament, government: { ...next.parliament.government, agenda, agendaSetWeek: next.game.week.index } }, 'Agenda del governo aggiornata');
  },
  negotiateGovernmentSupport(groupId) {
    requireFormateur();
    const next = withTime(PARLIAMENT_TIME_COSTS.governmentSupport);
    const parliament = negotiateGovernmentSupport(next.parliament, groupId, next.clock.currentDate, { influence: playerStat(state, 'influence') });
    const refused = parliament.history.at(-1)?.type === 'negoziato-rifiutato';
    return applyParliamentUpdate(next, parliament, refused ? 'Il gruppo rifiuta di sostenere il governo' : 'Impegno di sostegno registrato', refused ? {} : { influence: 0.5 });
  },
  reviseGovernmentCoalition(groupIds) {
    requireFormateur();
    const next = withTime(PARLIAMENT_TIME_COSTS.reviseCoalition);
    return applyParliamentUpdate(next, reviseGovernmentCoalition(next.parliament, groupIds, next.clock.currentDate), 'Coalizione aggiornata: serve una nuova fiducia');
  },
  assignMinister(portfolio, groupId, appointee = 'group') {
    requireFormateur();
    const next = withTime(PARLIAMENT_TIME_COSTS.assignMinister);
    const player = playerOf(state);
    const parliament = assignMinister(next.parliament, portfolio, groupId, next.clock.currentDate, { appointee, appointeeLabel: player?.displayName });
    const appointment = parliament.government.ministers.at(-1);
    const open = appointment.playerAppointed ? [{ id: ministerOfficeId(appointment), title: `Ministro · ${portfolio} (scenario)`, institution: 'Governo della Repubblica (scenario di gioco)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    return applyParliamentUpdate(next, parliament, appointment.playerAppointed ? `Sei ministro: ${portfolio}` : 'Incarico simulato distribuito', appointment.playerAppointed ? { influence: 3, notoriety: 3, reputation: 1 } : {}, { open });
  },
  voteGovernmentConfidence() {
    requireFormateur();
    const next = withTime(PARLIAMENT_TIME_COSTS.confidence);
    let parliament = voteGovernmentConfidence(next.parliament, next.clock.currentDate);
    const passed = parliament.government?.status === 'active';
    const government = parliament.government;
    const inCoalition = [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(state.parliament.player?.groupId);
    const deltas = inCoalition ? (passed ? { influence: 2, reputation: 1 } : { influence: -1, reputation: -1 }) : (passed ? {} : { influence: 1 });
    // Whoever formed the government and won the confidence becomes Prime Minister.
    const player = playerOf(state);
    const open = passed && government.primeMinister !== 'player' ? [{ id: `incarico-premier-${government.id}`, title: 'Presidente del Consiglio (scenario)', institution: 'Governo della Repubblica (scenario di gioco)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    if (passed) parliament = { ...parliament, government: { ...government, primeMinister: 'player' } };
    return applyParliamentUpdate(next, parliament, passed ? 'Fiducia ottenuta: sei Presidente del Consiglio' : 'Fiducia non ottenuta: il governo cade', { ...deltas, ...(open.length ? { notoriety: 4, influence: (deltas.influence ?? 0) + 3 } : {}) }, { open });
  },
  triggerGovernmentCrisis() {
    if (!isSecretary(state.game?.party) && !isPrimeMinister(state.parliament)) throw new Error('Una crisi di governo la aprono il Presidente del Consiglio o il segretario di un partito.');
    const next = withTime(PARLIAMENT_TIME_COSTS.crisis);
    return applyParliamentUpdate(next, triggerGovernmentCrisis(next.parliament, next.clock.currentDate), 'Crisi di governo aperta', { influence: -0.5 });
  },
  reset() {
    state = prepareState(makeDemoState());
    timelineBase = state;
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

    const parties = state.dataset.parties.filter(party => party.source === DATA_SOURCES.USER);
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
    const society = buildSociety({ ...base, game });
    game.timeline = [{ id: makeId('storia'), week: 1, date: state.clock.currentDate, kind: 'inizio', title: `Inizia la carriera: ${level.office}`, detail: `${draft.municipality.trim()}, ${draft.region}${partyRecord ? ` · ${partyRecord.officialName ?? partyRecord.name}` : ' · indipendente'}`, tone: 'good', source: DATA_SOURCES.SIMULATION }];
    // The game being replaced is kept in a slot, so a new game never erases an old one.
    if (store.hasCareer()) { try { store.saveToSlot(`${slotMeta(state).player} · partita precedente`); } catch { /* no room: the player is warned in the menu */ } }
    state = { ...base, game, world, society, parliament: withCapital(parliament, game) };
    timelineBase = state;
    persist({ force: true }); emit();
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
