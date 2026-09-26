import { DATA_SOURCES, emptyDataset, isSelectableParty } from '../data/schema.js?v=20260926-4';
import { makeDemoState } from '../data/demo.js?v=20260926-4';
import { CAREER_LEVELS, initialCareerStatistics } from '../data/regions.js?v=20260926-4';
import { storage } from './storage.js?v=20260926-4';
import { loadSettings } from './settings.js?v=20260926-4';
import { advanceDays, formatDate } from './time.js?v=20260926-4';
import { validateNewCareerDraft } from './career-rules.js?v=20260926-4';
import { advanceCampaign, breakCampaignAlliance, createCampaign, decideCampaignEvent, negotiateCampaignAlliance, performCampaignActivity, setCampaignStrategy, setExpectation } from './campaign-engine.js?v=20260926-4';
import { electionAftermath } from './aftermath-engine.js?v=20260926-4';
import { progressionFactors } from './progression-engine.js?v=20260926-4';
import { committeeSupport, committeesAfterVote, createCommittees } from './committee-engine.js?v=20260926-4';
import { setConfidenceVote, createReferenceGovernment, neverHadGovernment, offerGroupSupport, requestGovernmentPost, withdrawGroupSupport, partnerSatisfaction, acceptLawDemand, activeMinisters, amendLawPolicy, askConfidenceOnLaw, groupProfile, issueDecree, majoritySummit, reshuffleMinister, setGovernmentProgram, settlePartnerDemand, withdrawLaw, playerInMajority, advanceGovernmentWeek, majorityShift, advanceLaw, amendLaw, assignMinister, assignPlayerGroup, canManageParliament, compromiseLaw, contestCommitteeRole, createParliamentState, enterParliament, formGovernment, leaveParliament, negotiateGovernmentSupport, negotiateLaw, normalizeParliamentState, proposeLaw, reviseGovernmentCoalition, triggerGovernmentCrisis, voteGovernmentConfidence } from './parliament-engine.js?v=20260926-4';
import { alignLocalCalendar, localCalendarOf, committeeAction, setCommunication, setPartyProgram, addSituationEvent, addWorldReaction, advanceWeek, alignCurrent, assignOrgans, callEarlyCongress, contestPartyRank, createGameState, disciplineGroup, expelDissidents, isSecretary, joinParty, makeInvestment, nextPartyRank, partyInvestment, saveForElection, scheduleEarlyElection, setCandidacyRule, setPartyLine, markElectionHeld, markElectionRunning, normalizeGameState, openElection, performActivity, quitParty, refreshObjectives, relationValue, resolveInboxItem, spendTime, upcomingElections } from './career-engine.js?v=20260926-4';
import { AMENDMENT_CAPITAL_COST, COMMUNICATION_STYLES, GOVERNMENT_CAPITAL_COSTS, PARLIAMENT_TIME_COSTS } from '../data/simulation/career-rules.js?v=20260926-4';
import { advanceLegislativeWeek, amendOthersLaw, amendmentOdds, linkGroupsToParties, setPlayerVote, speakOnLaw } from './lawmaking-engine.js?v=20260926-4';
import { seededRandom } from './vote-engine.js?v=20260926-4';
import { advanceCabinetWeek, joinAsSupport } from './cabinet-engine.js?v=20260926-4';
import { AREA_BY_ID, BUDGET_SESSION, GOVERNMENT_LINES, areaOf } from '../data/simulation/policy-rules.js?v=20260926-4';
import { withRegionalLeans, withLocalCalendar, joinCoalition, acceptAlliance, addWorldEffects, advanceWorld, alignWorldToVote, allianceOdds, applyWorldSignals, axisOf, breakAlliance, campaignPollBonus, createWorld, isLegacyWorld, normalizeWorld, proposeAlliance, setGoverningForces, setPlayerParty, withCanonicalForces, withLatentForces, withPartyIdentities, withPositions } from './world-engine.js?v=20260926-4';
import { FORMATION_PHASES, LEGISLATURE_RULES, NATIONAL_LINES, acceptMandate, crisisFormation, seatResult, startFormation, buildCoalitions, campaignWeekEffects, coalitionOptions, compactResult, contestedDistricts, createNationalState, europeanListSeats, formationStep, groupOfParty, homeDistricts, legislatureGroups, legislatureTerm, nationalCalendar, nationalHistory, nationalProjection, normalizeNationalState, openLegislature, politicheOutcome, regionalBreakdown, runEuropeanVote, runNationalVote, seatPlayer, voteForces } from './legislature-engine.js?v=20260926-4';
import { classifyOutcome, preferenceStanding } from './election-engine.js?v=20260926-4';
import { DIFFICULTIES, difficultyId, difficultyOf } from '../data/simulation/difficulty-rules.js?v=20260926-4';
import { WORLD_PARTY_COUNT } from '../data/simulation/polling-rules.js?v=20260926-4';
import { isPrimeMinister } from './roles.js?v=20260926-4';
import { memoryAbout, memoryBalance, memoryWeight, recordWhy, remember } from './career-engine.js?v=20260926-4';
import { PARTY_LINES } from '../data/simulation/career-rules.js?v=20260926-4';
import { advanceSociety, applyBudgetPlan, applyLawToSociety, calibrateWeights, createSociety, explainMood, measureDesign, mediaEvent, normalizeSociety, provisionalBudget, publicBudgetChoice, regionAttention, revokeMeasure, segmentAttention, societyMood, societyShock } from './society-engine.js?v=20260926-4';
import { ACTIVITY_MEDIA, INDICATORS, ISSUE_TOPICS, SEGMENTS } from '../data/simulation/society-rules.js?v=20260926-4';
import { book, hasAsset, releaseElectionFund, setBudgetLevel } from './finance-engine.js?v=20260926-4';
import { isPartyLeader, treasuryBook } from './organization-engine.js?v=20260926-4';
import { selectContacts, syncContacts } from './contacts-engine.js?v=20260926-4';
import { NEWS_TEMPLATES, composeHeadline, weeklyNews } from './news-engine.js?v=20260926-4';
import { macroAreaOf, MACRO_AREAS } from '../data/simulation/policy-rules.js?v=20260926-4';

const STATE_VERSION = 9;
const POSITIONS_SET = new Set(['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra']);
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
const hashText = value => [...String(value)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const seedOf = s => { const player = playerOf(s); return `${player?.displayName}|${player?.birthDate}|${s.career.startedAt}|${s.career.initialLevel}`; };
const indicatorLabel = id => INDICATORS.find(item => item.id === id)?.label ?? id;

// Verified deputies of the player's own circoscrizione, from different groups, as campaign opponents.
const territoryKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z]/g, '');
function pertinentDeputies(people = {}, region, seedText) {
  const target = territoryKey(region);
  if (!target) return [];
  const groups = new Map((people.groups ?? []).map(group => [group.id, group.officialName]));
  const rank = person => [...`${seedText}|${person.id}`].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7);
  // Only deputies in office: a mandate that ended (e.g. Bagnai, 15/09/2026) leaves the pool.
  const pool = (people.politicians ?? []).filter(person => person.source === DATA_SOURCES.REAL && person.verified === true && person.chamber === 'camera' && !person.termEnd && territoryKey(person.circoscription).startsWith(target)).sort((a, b) => rank(a) - rank(b));
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
    stats: statsOf(s), parliament: s.parliament, funds, difficulty: s.career.difficulty ?? 'normale', localCalendar: localCalendarFor(s)
  });
}
function withCapital(parliament, game) {
  if (!parliament || !game) return parliament;
  return { ...parliament, difficulty: game.difficulty ?? parliament.difficulty ?? 'normale', resources: { ...parliament.resources, politicalCapital: game.resources.politicalCapital } };
}
// Real forces that populate the political world. With a real poll in the dataset, the career opens with it:
// the forces it measures, with their real shares and source; otherwise the most chosen parties in the 2x1000 (MEF).
// Every force carries its documented collocazione and whether it belongs to the real majority in office.
let realForces = [];
let twoPerThousandById = new Map();
let realPollStart = null;
let realPositions = new Map();
// The other forces of the database, outside the opening poll: they can enter the polls later in the simulation.
let realLatent = [];
// One force per party in the polls: MEF aliases → the registered party; components of a list the poll measures as
// one force (Sinistra Italiana, Europa Verde → Alleanza Verdi e Sinistra) → that force. identities: the real
// catalogue with the owner's corrections (names, abbreviations, colours, collocazione).
let realForceMap = {};
let realIdentities = {};
// New careers start on the date of the real snapshot, so that government, Parliament and the opening poll are current.
let realStartDate = null;
// The Government in office at the start, derived from the real data (government-reference.js): every career finds it.
let referenceGovernment = null;
// The verified groups of the real Chambers: with them the national Parliament works from the first week of every
// career, also when the player does not sit in it.
let realParliamentaryGroups = [];
// The real calendar of local and regional votes (local-elections.json): each comune and region votes in its year.
let localElections = null;
const localCalendarFor = s => { if (!localElections) return null; const place = homePlace(s); return localCalendarOf(localElections, { municipalityCode: place.municipalityCode, region: place.region, seed: `${place.region}|${place.municipality}` }); };
// How each region leans compared with the country, camp by camp: the real vote of 2022 (Camera, single-member colleges).
const CAMP_OF_ALLIANCE_2022 = Object.freeze({ cdx: 'destra', csx: 'sinistra', m5s: 'sinistra', 'azione-iv': 'centro' });
function regionalLeans(geography) {
  if (!geography?.camera?.collegi?.length) return null;
  const allianceOf = new Map((geography.lists ?? []).map(item => [item.code, CAMP_OF_ALLIANCE_2022[item.alliance2022] ?? null]));
  const totals = {};
  const national = { destra: 0, sinistra: 0, centro: 0, all: 0 };
  for (const district of geography.camera.collegi) {
    const region = totals[district.region] ??= { destra: 0, sinistra: 0, centro: 0, all: 0 };
    for (const [code, votes] of Object.entries(district.votes ?? {})) {
      const camp = allianceOf.get(code);
      region.all += votes; national.all += votes;
      if (camp) { region[camp] += votes; national[camp] += votes; }
    }
  }
  const pct = (part, all) => all ? part * 100 / all : 0;
  return Object.fromEntries(Object.entries(totals).map(([region, value]) => [region, Object.fromEntries(['destra', 'sinistra', 'centro'].map(camp => [camp, Math.round((pct(value[camp], value.all) - pct(national[camp], national.all)) * 10) / 10]))]));
}
const localSummary = doc => ({ regions: doc.regions, municipalities: Object.fromEntries(Object.entries(doc.municipalities ?? {}).map(([date, codes]) => [date, codes.length])) });
function forcesFrom({ twoPerThousand = [], parties = [], movements = [], coalitions = [], polls = [], governingIds = [], startDate = null }) {
  realStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate ?? '') ? startDate : null;
  const entities = [...parties, ...movements, ...coalitions].filter(item => item.source === DATA_SOURCES.REAL && item.verified === true);
  const catalog = new Map(entities.map(item => [item.id, item]));
  const canonical = id => catalog.get(id)?.sameEntityAs ?? id;
  realPositions = new Map(entities.filter(item => item.politicalPosition).map(item => [item.id, item.politicalPosition]));
  twoPerThousandById = new Map(twoPerThousand.filter(row => row.source === DATA_SOURCES.REAL && row.verified === true && catalog.has(row.partyId)).map(row => [canonical(row.partyId), row]));
  const governing = new Set(governingIds.map(canonical));
  const reference = reference2x1000;
  // The latest real poll available on the day the career starts.
  const poll = polls.filter(item => item.source === DATA_SOURCES.REAL && item.verified === true && item.results?.length && (!realStartDate || String(item.publishedAt) <= realStartDate)).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))[0];
  let forces;
  if (poll) {
    const rows = poll.results.filter(row => catalog.has(canonical(row.entityId)));
    realPollStart = { id: poll.id, label: poll.label, publishedAt: poll.publishedAt, fieldworkFrom: poll.fieldworkFrom ?? null, fieldworkTo: poll.fieldworkTo ?? null, method: poll.method ?? null, sourceUrl: poll.sourceUrl, sourceName: poll.sourceName, results: rows.map(row => ({ partyId: canonical(row.entityId), share: row.share, delta: row.delta ?? 0 })) };
    forces = rows.map(row => {
      const entity = catalog.get(canonical(row.entityId));
      return { id: entity.id, label: row.label, officialName: entity.officialName, abbreviation: entity.abbreviation ?? null, brandColor: entity.color ?? null, share: row.share, position: entity.politicalPosition ?? null, governing: governing.has(entity.id), reference: reference(entity.id), pollReference: { share: row.share, label: poll.label, publishedAt: poll.publishedAt, sourceUrl: poll.sourceUrl, source: DATA_SOURCES.REAL } };
    });
  } else {
    realPollStart = null;
    forces = [...twoPerThousandById.entries()].sort((a, b) => b[1].validChoices - a[1].validChoices).slice(0, WORLD_PARTY_COUNT).map(([id, row]) => {
      const party = catalog.get(id) ?? catalog.get(row.partyId);
      return { id: party.id, label: party.officialName, abbreviation: party.abbreviation ?? null, share: row.shareOfChoices, position: party.politicalPosition ?? null, governing: governing.has(party.id), reference: reference(party.id) };
    });
  }
  realLatent = latentCandidates(entities, parties, forces, coalitions);
  const measured = new Set(forces.map(force => force.id));
  realForceMap = Object.fromEntries([
    ...entities.filter(item => item.sameEntityAs && catalog.has(item.sameEntityAs)).map(item => [item.id, item.sameEntityAs]),
    ...coalitions.filter(item => measured.has(item.id)).flatMap(item => (item.componentPartyIds ?? []).map(id => [id, item.id]))
  ]);
  realIdentities = Object.fromEntries([...entities, ...parties.filter(item => item.adminCreated)].map(item => [item.id, { label: forces.find(force => force.id === item.id)?.label ?? item.officialName, officialName: item.officialName, abbreviation: item.abbreviation ?? null, position: item.politicalPosition ?? null, color: item.color ?? null }]));
  return forces;
}
// The force the polls measure for a party: itself, the registered party of an alias, or the list it runs in.
function pollForceOf(partyId) {
  return realForceMap[partyId] ?? partyId;
}
// Saves are brought in line with one force per party and with the owner's corrections, without losing history.
function alignWorld(world) {
  if (!world) return world;
  return withPartyIdentities(withCanonicalForces(world, realForceMap, realIdentities), realIdentities);
}
const reference2x1000 = id => { const row = twoPerThousandById.get(id); return row ? { validChoices: row.validChoices, shareOfChoices: row.shareOfChoices, amountEuro: row.amountEuro, year: row.declarationYear, source: DATA_SOURCES.REAL } : null; };
// Every other force of the database can enter the polls later: the active real parties and movements (not the
// historical ones, not the duplicates, not the components of a list the poll already measures) and the parties added
// by the owner. They start outside the polls, with no published figure.
function latentCandidates(entities, parties, forces, coalitions) {
  const measured = new Set(forces.map(force => force.id));
  const inLists = new Set(coalitions.filter(item => measured.has(item.id)).flatMap(item => item.componentPartyIds ?? []));
  // The forces a world already has are skipped by the world itself (an older career may have started from another
  // poll): here only the aliases and the components of a list measured as one force are left out.
  const real = entities.filter(item => item.entityType !== 'coalition' && !item.sameEntityAs && item.status === 'active' && !item.adminHidden && !inLists.has(item.id));
  const added = parties.filter(item => item.adminCreated && !item.adminHidden);
  return [...real, ...added].map(item => ({
    id: item.id, label: item.officialName ?? item.name, officialName: item.officialName ?? null, abbreviation: item.abbreviation ?? null, position: item.politicalPosition ?? null,
    brandColor: item.color ?? null, regional: item.level === 'regional', regionalPresence: Boolean(item.regionalPresence), weight: twoPerThousandById.get(item.id)?.shareOfChoices ?? 0,
    refSource: item.source === DATA_SOURCES.REAL ? 'real' : 'user', origin: item.adminCreated ? 'admin' : 'real', reference: reference2x1000(item.id)
  }));
}
// A world is out of date when it never received the forces outside the polls, or when the database changed since.
function latentOutOfDate(world) {
  if (!world || !realLatent.length) return false;
  if (!world.latentSeeded) return true;
  const known = new Set([...world.parties.map(party => party.id), ...(world.latent ?? []).map(item => item.id)]);
  const wanted = new Set(realLatent.map(item => item.id));
  return realLatent.some(item => !known.has(item.id)) || (world.latent ?? []).some(item => !wanted.has(item.id));
}
// The player's party as the simulated world sees it: a real party is only an id, a label and its collocazione.
function worldPartyOf(s, record = null) {
  const player = playerOf(s);
  const ownId = player ? player.partyId : s.career.partyId;
  if (!ownId) return null;
  // A party measured inside a list (SI, EV → AVS) or under another name is the force of that list in the polls.
  const partyId = pollForceOf(ownId);
  if (partyId !== ownId) {
    const identity = realIdentities[partyId] ?? {};
    const own = record ?? s.dataset.parties.find(item => item.id === ownId) ?? null;
    return { id: partyId, label: identity.label ?? identity.officialName ?? partyId, abbreviation: identity.abbreviation ?? null, brandColor: identity.color ?? null, refSource: DATA_SOURCES.REAL, founder: false, position: identity.position ?? null, reference: null, component: { id: ownId, label: own?.officialName ?? own?.name ?? null } };
  }
  const known = record ?? s.dataset.parties.find(item => item.id === partyId) ?? null;
  const reference = twoPerThousandById.get(partyId);
  return {
    id: partyId, label: known?.officialName ?? known?.name ?? s.game?.party?.label ?? null, abbreviation: known?.abbreviation ?? null,
    brandColor: known?.color ?? null, refSource: known?.source ?? DATA_SOURCES.REAL,
    founder: s.game?.party?.affiliation === 'founder', initialShare: reference?.shareOfChoices,
    position: known?.politicalPosition ?? realPositions.get(partyId) ?? known?.position ?? null,
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
    playerParty: worldPartyOf(s, record), forces: realForces, stats: statsOf(s), realPoll: realPollStart, pollNoise: difficultyOf(s.career?.difficulty).pollNoise, latent: realLatent
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
  // The national cycle (calendar, campaign, last votes, formation of the Government) follows the career's legislature.
  let national = normalizeNationalState(raw.national, { currentDate: base.clock.currentDate, legislature: raw.national ? null : game.legislature ?? null });
  if ((game.legislature?.number ?? 19) > national.legislature.number) national = normalizeNationalState({ ...national, legislature: { ...game.legislature } }, { currentDate: base.clock.currentDate });
  return { ...base, game, world, society, national, parliament: withCapital(parliament, game) };
}

const hydratedState = hydrateState(storedState);
let state = prepareState(hydratedState);
let lastSaved = storedState ? (isRestorableSave(storedState) ? 'Salvataggio caricato' : 'Salvataggio non valido: copia conservata') : 'Nuova carriera demo';
if (isRestorableSave(storedState) && storedState.version < STATE_VERSION) {
  // The save written by the previous version is kept aside before the upgraded one replaces it.
  storage.backup(storedState, `aggiornamento-v${storedState.version ?? 0}-v${STATE_VERSION}`);
  try { storage.save(state); lastSaved = 'Salvataggio aggiornato'; } catch { lastSaved = 'Salvataggio locale non disponibile'; }
}
const listeners = new Set();
let timelineBase = state;

function emit() { for (const listener of listeners) listener(state, lastSaved); }
// ---------- career timeline ----------
// Every save compares the career with the previous save and writes down what changed.
const TIMELINE_LIMIT = 300;
// The events of the dataset are read for what is coming: the past ones are kept only up to this number.
const EVENTS_LIMIT = 240;
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
  for (const item of after.parliament?.history ?? []) if (!known.has(item.id) && !item.details?.auto && ['iter-approved', 'iter-rejected'].includes(item.type)) entries.push({ kind: 'legge', title: item.text, tone: item.type === 'iter-approved' ? 'good' : 'bad' });
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
  // The party's estimated share in every region (national share and the regional offset of the simulated polls).
  const force = s.world?.parties?.find(item => item.isPlayer);
  const regionalShares = force && row ? Object.fromEntries(Object.entries(force.regional ?? {}).map(([region, offset]) => [region, Math.max(0, row.share + offset)])) : {};
  return { career: s.career, offices: s.dataset.offices, campaign: s.campaign, player: playerOf(s), currentDate: s.clock.currentDate, pollShare: row?.share ?? null, pollDelta: row?.delta ?? 0, regionalShares, mood: s.society ? societyMood(s.society) : 50, signals: worldSignalsFor(s) };
}
// Where the player lives: region, comune and the ISTAT unit (province or metropolitan city) of the comune.
function homePlace(s) {
  const player = playerOf(s);
  const comune = (s.dataset.territories ?? []).find(item => item.kind === 'comune' && item.source === DATA_SOURCES.USER) ?? null;
  return { region: player?.region ?? s.game?.place?.region ?? null, municipality: player?.municipality ?? comune?.name ?? null, municipalityCode: player?.municipalityCode ?? comune?.istatCode ?? null, provinceCode: comune?.provinceCode ?? null, provinceName: comune?.provinceName ?? player?.province ?? null };
}
// The state of the country, the Government and the career that events read to decide whether they make sense.
function worldSignalsFor(s) {
  const month = Number(String(s.clock.currentDate).slice(5, 7));
  const government = s.parliament?.government;
  const laws = (s.parliament?.laws ?? []).filter(law => !['approved', 'rejected', 'lapsed'].includes(law.stage));
  const inCommission = laws.find(law => law.stage === 'commission' && law.origin !== 'governo' ? true : law.stage === 'commission' && isPrimeMinister(s.parliament));
  const atVote = laws.find(law => law.origin === 'governo' && ['amendments', 'final-vote'].includes(law.stage));
  const now = s.game?.week.index ?? 0;
  const recall = (s.game?.memory ?? []).find(item => item.tone === 'bad' && now - item.week >= 26 && (item.weight ?? 1) * Math.pow(0.5, (now - item.week) / 104) >= 0.4);
  const politiche = (s.game?.elections ?? []).find(item => item.type === 'politiche' && item.status !== 'held');
  const electionSoon = Boolean(politiche && (politiche.status === 'open' || elapsedDays(s.clock.currentDate, politiche.windowOpensAt) <= 56));
  return {
    crime: s.society?.security?.crime ?? 45, perceived: s.society?.security?.perceived ?? 50, spread: s.society?.publicFinance?.spread ?? 130, euStatus: s.society?.publicFinance?.euStatus ?? 'regolare',
    stability: government?.stability ?? 60, ministers: activeMinisters(government).length, majorityMood: partnerSatisfaction(s.parliament) ?? 60,
    summer: month >= 6 && month <= 8, autumn: month >= 9 && month <= 11, winter: month === 12 || month <= 2,
    regions: Object.values(s.society?.regions ?? {}).map(region => ({ name: region.name, indicators: region.indicators })),
    partyAxis: s.world?.parties?.find(party => party.isPlayer)?.axis ?? null,
    memoryRecall: recall?.text ?? null, electionSoon, openLawInCommission: Boolean(inCommission), lawAtVote: Boolean(atVote), lawTitle: (inCommission ?? atVote)?.title ?? null, lawId: (inCommission ?? atVote)?.id ?? null
  };
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

// Who answers for a law in front of the voters: the player for the own bills (and for the Government's when in the
// majority), the player's party for the bills of the player's group, the others otherwise.
function lawCredit(law, parliament) {
  if (!law) return 'others';
  const governs = Boolean(parliament?.player?.groupId && playerInMajority(parliament));
  if (!law.auto) return law.origin === 'governo' ? (governs || isPrimeMinister(parliament) ? 'player' : 'others') : 'player';
  if (law.sponsor?.kind === 'governo') return governs ? 'player' : 'others';
  return law.sponsor?.groupId && law.sponsor.groupId === parliament?.player?.groupId ? 'group' : 'others';
}
function worldSignalsFrom(entries, parliament) {
  const government = parliament?.government;
  const inMajority = Boolean(government && parliament.player?.groupId && [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(parliament.player.groupId));
  const lawTitle = id => parliament?.laws.find(law => law.id === id)?.title ?? 'proposta';
  // The laws of the Government and of the other groups move their own parties (legislativeEffects), not the player's.
  const own = entry => !entry.details?.auto || lawCredit(parliament?.laws.find(law => law.id === entry.details?.lawId), parliament) === 'player';
  return entries.flatMap(entry => {
    if (entry.type === 'iter-approved' && own(entry)) return [{ type: 'law-approved', title: lawTitle(entry.details?.lawId) }];
    if (entry.type === 'iter-rejected' && own(entry)) return [{ type: 'law-rejected', title: lawTitle(entry.details?.lawId) }];
    if (entry.type === 'fiducia-ottenuta') return [entry.details?.renewed ? { type: 'chronicle', kind: 'governo', icon: 'dome', title: 'Il governo supera la crisi', body: 'La maggioranza conferma la fiducia in entrambe le Camere (simulazione).', tone: 'neutral' } : { type: 'government-formed', inMajority }];
    if (entry.type === 'fiducia-negata' || entry.type === 'dimissioni-governo') return [{ type: 'government-fallen', inMajority }];
    // The life of a Government led by others: the news reports it.
    if (['rimpasto', 'nuovo-ministro', 'sostegno-esterno', 'verifica-maggioranza'].includes(entry.type)) return [{ type: 'chronicle', kind: 'governo', icon: entry.type === 'sostegno-esterno' ? 'link' : 'dome', title: { rimpasto: 'Rimpasto di governo', 'nuovo-ministro': 'Cambio nel governo', 'sostegno-esterno': 'Nuovo sostegno al governo', 'verifica-maggioranza': 'Verifica di maggioranza' }[entry.type], body: entry.text, tone: 'neutral' }];
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
  const territorial = {};
  const memories = [];
  let programHits = 0;
  const playerGoverns = Boolean(parliament?.player?.groupId && playerInMajority(parliament));
  const measureTaken = (law, summary, headline) => {
    society = mediaEvent(society, { outletId: 'tv-nazionale', tone: summary.covered && (summary.controversy ?? 0) < 0.8 ? 1 : -0.7, intensity: 1.2, headline, date: currentDate, week });
    const responsible = lawCredit(law, parliament);
    chronicle.push({ type: 'chronicle', kind: 'legge', icon: 'law', title: headline, body: `${law.auto && law.sponsor ? `Proposta di ${law.sponsor.kind === 'governo' ? 'governo' : law.sponsor.label}. ` : ''}${summary.covered ? 'Coperture trovate nei conti pubblici' : 'Coperture insufficienti: effetti ridotti e deficit in aumento'}. Effetti più visibili in ${(summary.topRegions ?? []).map(item => item.name).join(', ') || 'tutto il Paese'} nelle prossime settimane.`, tone: summary.covered ? 'good' : 'bad', chain: lawChain(summary, law.title, Boolean(currentState.world?.playerPartyId) && responsible !== 'others') }, ...lawReaction(summary, law.title));
    if (!summary.covered && responsible === 'player') deltas.reputation = (deltas.reputation ?? 0) - 1;
    const credit = lawCredit(law, parliament);
    // Acting on the party's programme keeps the party together.
    if (currentState.game?.party?.program?.areas?.includes(summary.area) && credit !== 'others') programHits += 1;
    if (credit === 'player') {
      memories.push({ kind: 'legge', text: `${law.kind === 'decreto' ? 'Decreto' : 'Legge'}: ${law.title}`, area: summary.area ?? null, weight: 1 });
      if (['irpef', 'imprese', 'consumi', 'rendite'].includes(summary.financing)) memories.push({ kind: 'tasse', text: `${summary.financingLabel} per finanziare “${law.title}”`, segments: (summary.losers ?? []).map(item => item.id), weight: 1.2 });
      if (summary.financing === 'tagli') memories.push({ kind: 'tagli', text: `Tagli per finanziare “${law.title}”`, weight: 0.8 });
    }
    // Whoever is responsible gains where the measure lands and loses where it leaves people out.
    if (credit !== 'others') {
      for (const item of summary.topRegions ?? []) territorial[item.name] = round2((territorial[item.name] ?? 0) + 0.35);
      for (const item of summary.bottomRegions ?? []) if (summary.target && summary.target !== 'nazionale') territorial[item.name] = round2((territorial[item.name] ?? 0) - 0.25);
    }
    // Allies judge the content against their own priorities.
    if (parliament?.government?.partners && law.policy?.area) {
      for (const groupId of Object.keys(parliament.government.partners)) {
        const profile = groupProfile(['camera', 'senato'].flatMap(chamber => parliament.chambers?.[chamber]?.groups ?? []).find(group => group.groupId === groupId) ?? groupId);
        const delta = (profile.likes.includes(law.policy.area) ? 3 : 0) - (profile.dislikes.includes(law.policy.area) ? 3 : 0) - (law.policy.financing === profile.dislikesFinancing ? 2 : 0);
        const partner = parliament.government.partners[groupId];
        if (partner.demand?.type === 'misura' && partner.demand.area === law.policy.area) parliament = settlePartnerDemand(parliament, groupId, true, currentDate);
        else if (delta) parliament = { ...parliament, government: { ...parliament.government, partners: { ...parliament.government.partners, [groupId]: { ...partner, satisfaction: Math.max(0, Math.min(100, partner.satisfaction + delta)) } } } };
      }
    }
  };
  for (const entry of newEntries) {
    const law = parliament?.laws.find(item => item.id === entry.details?.lawId);
    if (!law || !society) continue;
    if (entry.type === 'decreto-adottato' || (entry.type === 'iter-approved' && law.kind !== 'decreto')) {
      if (law.kind === 'manovra') {
        society = applyBudgetPlan(society, law.policy?.plan ?? {}, { date: currentDate, week, title: law.title });
        parliament = { ...parliament, government: parliament.government ? { ...parliament.government, budgetYear: Number(currentDate.slice(0, 4)) + (Number(currentDate.slice(5, 7)) >= 9 ? 1 : 0) } : parliament.government };
        chronicle.push({ type: 'chronicle', kind: 'legge', icon: 'money', title: `Approvata la legge di bilancio`, body: 'Le nuove priorità di spesa e le entrate valgono per tutto l’anno.', tone: 'neutral' });
        continue;
      }
      const result = applyLawToSociety(society, { category: law.category, compromiseLevel: law.compromiseLevel ?? 0, title: law.title, origin: law.kind === 'decreto' ? 'decreto' : law.origin === 'governo' ? 'governo' : 'parlamento', date: currentDate, week, policy: law.policy?.area ? law.policy : null, lawId: law.id });
      if (!result.summary) continue;
      society = result.society;
      measureTaken(law, result.summary, law.kind === 'decreto' ? `In vigore il decreto-legge “${law.title}”` : `Approvata la legge “${law.title}”`);
    } else if (entry.type === 'iter-approved' && law.kind === 'decreto') {
      chronicle.push({ type: 'chronicle', kind: 'legge', icon: 'law', title: `Convertito in legge il decreto “${law.title}”`, body: 'Il Parlamento conferma il decreto: gli effetti diventano definitivi.', tone: 'good' });
      if (parliament.government) parliament = { ...parliament, government: { ...parliament.government, stability: Math.min(100, (parliament.government.stability ?? 50) + 2) } };
    } else if (entry.type === 'decreto-decaduto' || (entry.type === 'iter-rejected' && law.kind === 'decreto')) {
      society = revokeMeasure(society, law.title);
      society = mediaEvent(society, { outletId: 'quotidiani', tone: -1, intensity: 1.3, headline: `Decade il decreto “${law.title}”: figuraccia del governo`, date: currentDate, week });
      if (lawCredit(law, parliament) === 'player') deltas.reputation = (deltas.reputation ?? 0) - 1.5;
      if (parliament.government?.primeMinister === 'player') memories.push({ kind: 'decreto-decaduto', text: `Decaduto il decreto “${law.title}”`, weight: 1.5 });
      chronicle.push({ type: 'chronicle', kind: 'governo', icon: 'alert', title: `Decade il decreto “${law.title}”`, body: 'Non convertito in tempo: gli effetti futuri si fermano e parte di quelli già prodotti viene annullata.', tone: 'bad' });
    }
  }
  if (Object.keys(territorial).length) chronicle.push({ type: 'territorial', regions: territorial });
  for (const entry of newEntries) {
    if (entry.type === 'fiducia-negata' && currentState.parliament?.government?.primeMinister === 'player') memories.push({ kind: 'governo-caduto', text: 'Il tuo governo perde la fiducia', weight: 2 });
    if (entry.type === 'richiesta-respinta') memories.push({ kind: 'alleato-tradito', text: entry.text, groupId: entry.details?.groupId ?? null, weight: 1 });
    if (entry.type === 'crisi-governo') memories.push({ kind: 'crisi-aperta', text: 'Hai aperto una crisi di governo', weight: 1.5 });
    if (entry.type === 'crisi-spontanea' && playerGoverns) memories.push({ kind: 'crisi-governo', text: 'La maggioranza di cui fai parte entra in crisi', weight: 0.8 });
    if (entry.type === 'fiducia-ottenuta' && playerGoverns) memories.push({ kind: 'lealta', text: `Sostegno alla nascita di ${parliament?.government?.name ?? 'un governo'}`, weight: 0.8 });
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
  const lawRecords = (parliament?.laws ?? []).filter(law => !law.auto || !['approved', 'rejected', 'lapsed'].includes(law.stage)).map(law => ({ id: law.id, title: law.title, summary: law.summary, category: law.category, status: law.status, stage: law.stage, chamberId: 'chamber-' + law.firstChamber, introducedAt: law.introducedAt, updatedAt: law.updatedAt, source: DATA_SOURCES.SIMULATION }));
  // The career keeps the player's parliamentary life; the calendar of the other actors stays in the parliament.
  const careerEntries = newEntries.filter(entry => !entry.details?.auto);
  let dataset = {
    ...currentState.dataset, statistics, laws: lawRecords,
    events: [...currentState.dataset.events, ...careerEntries.map(event => ({ id: event.id, title: event.text, date: event.date, category: 'parlamento', status: event.type, territoryId: null, impact: event.details, source: DATA_SOURCES.SIMULATION }))].slice(-EVENTS_LIMIT)
  };
  // The Prime Minister stays in office for current business after the vote (caretaker), until a new Government is sworn in.
  const premierEnded = currentState.parliament?.government?.primeMinister === 'player' && !(['active', 'crisis', 'caretaker'].includes(parliament?.government?.status) && parliament.government.id === currentState.parliament.government.id) ? [`incarico-premier-${currentState.parliament.government.id}`] : [];
  dataset = closeOffices(dataset, [...endedRoleOfficeIds(currentState.parliament, parliament), ...endedMinisterOfficeIds(currentState.parliament, parliament), ...premierEnded, ...(officeChanges.close ?? [])], currentDate);
  for (const office of officeChanges.open ?? []) dataset = openOffice(dataset, office);
  let career = careerEntries.length ? { ...currentState.career, parliamentHistory: [...(currentState.career.parliamentHistory ?? []), ...careerEntries] } : currentState.career;
  if (parliament?.player && career.parliamentContext) career = { ...career, parliamentContext: { ...career.parliamentContext, chamber: parliament.player.chamber, groupId: parliament.player.groupId } };
  const world = currentState.world && newEntries.length ? applyWorldSignals(currentState.world, [...worldSignalsFrom(newEntries, parliament), ...chronicle], currentDate) : currentState.world;
  // The parliament engine spends political capital; the career keeps a single balance.
  let game = currentState.game && parliament ? { ...currentState.game, resources: { ...currentState.game.resources, politicalCapital: parliament.resources?.politicalCapital ?? currentState.game.resources.politicalCapital } } : currentState.game;
  if (game && journal) game = { ...game, why: journal };
  if (game && memories.length) { game = deepCopy(game); for (const entry of memories) remember(game, { date: currentDate, ...entry }); }
  if (game?.party?.org && programHits) game = { ...game, party: { ...game.party, org: { ...game.party.org, cohesion: Math.min(100, game.party.org.cohesion + 2 * programHits) } } };
  return withConfidenceVotes(currentState, { ...currentState, parliament, dataset, career, game, world, society, ui: { ...currentState.ui, toast } });
}
// The player's decided vote on a confidence vote (agenda or Governo page) weighs like a vote on a law.
function withConfidenceVotes(before, after) {
  if (!after.game) return after;
  const known = new Set((before.parliament?.history ?? []).map(entry => entry.id));
  let next = after;
  for (const entry of (after.parliament?.history ?? []).filter(item => !known.has(item.id) && ['fiducia-ottenuta', 'fiducia-negata'].includes(item.type) && item.details?.decided && item.details.playerChoice)) {
    const details = entry.details;
    next = playerVoteOutcome(next, { kind: 'fiducia', title: details.governmentName ?? 'governo', choice: details.playerChoice, line: details.playerLine, passed: entry.type === 'fiducia-ottenuta', finalVote: true, yes: details.yes, needed: details.needed, decisive: details.decisive, confidence: true, fromGovernment: true, inMajority: details.playerLine === 'favorevole', sponsor: { kind: 'governo' } }).state;
  }
  return next;
}
function applyParliamentUpdate(...args) {
  state = withObjectives(computeParliamentUpdate(...args));
  persist(); emit();
  return state;
}

// Parliamentarians who back the player (or signed the bill) bring their group closer, once per law.
// The manual iter (present, negotiate, compromise, vote, withdraw) is for the player's own bills; the bills of the
// Government and of the other groups follow the calendar of the Chambers.
function requireOwnLaw(s, lawId) {
  if (s.parliament?.laws.find(item => item.id === lawId)?.auto) throw new Error('È una proposta di altri: puoi intervenire, presentare emendamenti e decidere il tuo voto dalla sua scheda.');
}
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
const requirePremier = () => { if (!isPrimeMinister(state.parliament)) throw new Error('Solo il Presidente del Consiglio può farlo.'); };
// Government acts cost days of work and political capital.
function withGovernmentCost(action) {
  const capital = GOVERNMENT_CAPITAL_COSTS[action] ?? 0;
  if ((state.game?.resources.politicalCapital ?? 0) < capital) throw new Error(`Servono ${capital} punti di capitale politico.`);
  const next = withTime(PARLIAMENT_TIME_COSTS[action] ?? 1);
  const game = { ...next.game, resources: { ...next.game.resources, politicalCapital: next.game.resources.politicalCapital - capital } };
  return { ...next, game, parliament: withCapital(next.parliament, game) };
}
const rollFor = s => { const value = Math.sin((s.game?.rngState ?? 1) + (s.game?.week.index ?? 1) * 97) * 10000; return value - Math.floor(value); };
const designTitle = design => `${AREA_BY_ID[design.area].instruments[design.instrument]}`;
// A decree needs a real emergency: an open problem in the area, or an emergency event of the last weeks.
function decreeUrgency(s, areaId) {
  const label = AREA_BY_ID[areaId]?.label;
  const issue = (s.society?.issues ?? []).some(item => item.area === areaId || item.topic === label || (areaOf(item.topic)?.id === areaId));
  const emergency = Object.entries(s.game?.flags?.emergencies ?? {}).some(([area, week]) => area === areaId && (s.game.week.index - week) <= 6);
  return issue || emergency;
}
function fulfilMinistryDemand(parliament, portfolio, groupId, date) {
  const partner = parliament?.government?.partners?.[groupId];
  return partner?.demand?.type === 'ministero' && partner.demand.portfolio === portfolio ? settlePartnerDemand(parliament, groupId, true, date) : parliament;
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
    } else if (special.type === 'world-coalition' && next.world) {
      try {
        const out = joinCoalition(next.world, special.allianceId, next.clock.currentDate, { terms: special.terms });
        next = { ...next, world: out.world };
        if (out.joined) next = rememberFact(next, { kind: 'alleanza', text: `In coalizione con ${special.params?.partyLabel ?? next.world.parties.find(item => item.id === special.partyId)?.label ?? 'altre forze'}`, partyId: special.partyId, subject: special.partyId, weight: 1 });
      } catch (error) { next = { ...next, ui: { ...next.ui, toast: error.message } }; }
    } else if (special.type === 'world-alliance' && next.world) {
      next = { ...next, world: acceptAlliance(next.world, special.partyId, next.clock.currentDate) };
    } else if (special.type === 'world-relation' && next.world) {
      next = { ...next, world: applyWorldSignals(next.world, [{ type: 'relation', partyId: special.partyId, delta: special.delta }], next.clock.currentDate) };
    } else if (special.type === 'local-office' && special.office?.title) {
      next = { ...next, dataset: openOffice(next.dataset, { id: makeId('incarico-locale'), title: special.office.title, institution: special.office.institution ?? 'Ente locale', level: special.office.level ?? 'comunale', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }) };
    } else if (special.type === 'scenario-office') {
      next = { ...next, dataset: openOffice(next.dataset, { id: makeId('incarico-esecutivo'), title: special.title, institution: 'Esecutivo di scenario (simulazione)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }) };
    } else if (special.type === 'media-repair' && next.society) {
      next = { ...next, society: { ...next.society, media: { ...next.society.media, sentiment: Math.round((next.society.media.sentiment * 0.5 + 4) * 10) / 10 } } };
    } else if (special.type.startsWith('public-') && next.society) {
      next = { ...next, society: publicBudgetChoice(next.society, special.type) };
    } else if ((special.type === 'seek-alliance' || special.type === 'lean') && next.world) {
      next = { ...next, world: applyWorldSignals(next.world, [special], next.clock.currentDate) };
    } else if (special.type === 'region-attention' && next.society) {
      next = { ...next, society: regionAttention(next.society, special.region, special.delta) };
    } else if (special.type === 'promise' && next.society) {
      const baseline = next.society.regions[special.region]?.indicators?.[special.indicator] ?? null;
      const week = next.game.week.index;
      next = { ...next, game: { ...next.game, promises: [...(next.game.promises ?? []), { id: `promessa-${week}-${special.issueId}`, region: special.region, indicator: special.indicator, topic: special.topic, madeWeek: week, dueWeek: week + 12, baseline, status: 'open', source: DATA_SOURCES.SIMULATION }] } };
    } else if (special.type === 'issue-law' && canManageParliament(next.parliament)) {
      const result = proposeLaw(next.parliament, { title: `Misure per ${String(indicatorLabel(special.indicator) ?? special.topic ?? 'il territorio').toLowerCase()} in ${special.region}`, category: special.topic, summary: `Proposta nata dal calo di ${String(indicatorLabel(special.indicator) ?? special.topic ?? 'servizi').toLowerCase()} in ${special.region} (scenario simulato).`, currentDate: next.clock.currentDate });
      next = computeParliamentUpdate(next, withCapital(result.parliament, next.game), next.ui.toast, { experience: 0.5 });
    } else if (special.type === 'cosign' && next.parliament && special.person) {
      const parliament = deepCopy(next.parliament);
      const law = parliament.laws.find(item => item.id === special.lawId);
      if (law) {
        law.cosigners = [...(law.cosigners ?? []).filter(item => item.personId !== special.person.id), { personId: special.person.id, fullName: special.person.fullName, groupId: special.person.groupId, groupName: special.person.groupName, sourceUrl: special.person.sourceUrl, identitySource: DATA_SOURCES.REAL, source: DATA_SOURCES.SIMULATION }];
        if (parliament.relations?.[special.person.groupId]) parliament.relations[special.person.groupId] = { ...parliament.relations[special.person.groupId], value: Math.min(100, parliament.relations[special.person.groupId].value + 4) };
        next = { ...next, parliament };
      }
    } else if (special.type === 'budget-open') {
      next = { ...next, ui: { ...next.ui, activePage: 'governo', toast: 'Prepara la legge di bilancio nella sezione Governo' } };
    } else if (special.type === 'society-shock' && next.society) {
      next = { ...next, society: societyShock(next.society, special.shock) };
    } else if (special.type === 'emergency-decree' && isPrimeMinister(next.parliament)) {
      try {
        const design = measureDesign(special.decree);
        const result = issueDecree(next.parliament, { title: special.title.slice(0, 90), summary: `Decreto-legge d’urgenza: ${AREA_BY_ID[design.area].instruments[design.instrument].toLowerCase()}.`, policy: design, currentDate: next.clock.currentDate });
        next = computeParliamentUpdate(next, withCapital(result.parliament, next.game), next.ui.toast);
      } catch (error) { next = { ...next, ui: { ...next.ui, toast: error.message } }; }
    } else if ((special.type === 'markets-calm' || special.type === 'markets-worse') && next.society) {
      const delta = special.type === 'markets-calm' ? -25 : 25;
      next = { ...next, society: { ...next.society, publicFinance: { ...next.society.publicFinance, spread: Math.max(40, next.society.publicFinance.spread + delta) } } };
    } else if ((special.type === 'europe-up' || special.type === 'europe-down') && next.society) {
      next = { ...next, society: societyShock(next.society, { area: 'europa', areaDelta: special.type === 'europe-up' ? 5 : -7 }) };
    } else if (special.type === 'society-cost' && next.society) {
      next = { ...next, society: societyShock(segmentAttention(next.society, 'famiglie', 2), { headroom: -4 }) };
    } else if ((special.type === 'minister-defend' || special.type === 'minister-resign') && next.parliament?.government) {
      const government = next.parliament.government;
      const target = activeMinisters(government).find(item => !item.playerAppointed);
      if (target) {
        const partners = { ...(government.partners ?? {}) };
        const partner = partners[target.groupId];
        if (special.type === 'minister-resign') {
          const ministers = government.ministers.map(item => item.id === target.id ? { ...item, endedAt: next.clock.currentDate, endReason: 'Dimissioni chieste dal Presidente del Consiglio' } : item);
          if (partner) partners[target.groupId] = { ...partner, satisfaction: Math.max(0, partner.satisfaction - 10) };
          next = { ...next, parliament: { ...next.parliament, government: { ...government, ministers, partners } } };
        } else if (next.society) next = { ...next, society: mediaEvent(next.society, { outletId: 'quotidiani', tone: -0.6, intensity: 1, headline: `Il governo difende il ministro ${target.portfolio}`, date: next.clock.currentDate, week: next.game.week.index }) };
      }
    } else if (special.type === 'partner-accept' || special.type === 'partner-negotiate' || special.type === 'partner-refuse') {
      const groupId = special.params.groupId;
      const partner = next.parliament?.government?.partners?.[groupId];
      if (partner?.demand) {
        let parliament = next.parliament;
        if (special.type === 'partner-refuse') parliament = settlePartnerDemand(parliament, groupId, false, next.clock.currentDate);
        else if (special.type === 'partner-negotiate') parliament = { ...parliament, government: { ...parliament.government, partners: { ...parliament.government.partners, [groupId]: { ...partner, satisfaction: Math.min(100, partner.satisfaction + 6), demand: { ...partner.demand, deadline: advanceDays(partner.demand.deadline, 28) } } } } };
        else if (partner.demand.type === 'ministero') {
          const holder = activeMinisters(parliament.government).find(item => item.portfolio === partner.demand.portfolio);
          try { parliament = holder ? reshuffleMinister(parliament, partner.demand.portfolio, groupId, next.clock.currentDate) : assignMinister(parliament, partner.demand.portfolio, groupId, next.clock.currentDate); parliament = settlePartnerDemand(parliament, groupId, true, next.clock.currentDate); }
          catch (error) { next = { ...next, ui: { ...next.ui, toast: error.message } }; }
        }
        // A measure demanded by an ally is fulfilled when a bill or decree on that area is approved.
        next = computeParliamentUpdate(next, withCapital(parliament, next.game), next.ui.toast);
      }
    } else if ((special.type === 'obstruction-add' || special.type === 'obstruction-clear' || special.type === 'snipers') && next.parliament) {
      const lawId = special.params.lawId ?? worldSignalsFor(next).lawId;
      next = { ...next, parliament: { ...next.parliament, laws: next.parliament.laws.map(law => law.id !== lawId ? law : special.type === 'snipers' ? { ...law, snipers: true } : { ...law, obstruction: special.type === 'obstruction-add' ? (law.obstruction ?? 0) + 2 : 0 }) } };
    } else if (special.type === 'election-missed') {
      next = special.electionType === 'politiche'
        ? endMandate(next, 'Non ricandidato alle elezioni politiche')
        : { ...next, dataset: closeTermOffices(next.dataset, player?.id, special.electionType, next.clock.currentDate) };
    } else if (special.type.startsWith('confidence-vote-') && next.parliament?.government) {
      const choice = { 'confidence-vote-line': 'linea', 'confidence-vote-yes': 'favorevole', 'confidence-vote-no': 'contrario', 'confidence-vote-abstain': 'astenuto', 'confidence-vote-absent': 'assente' }[special.type];
      try { next = { ...next, parliament: setConfidenceVote(next.parliament, choice) }; } catch { /* the vote has already taken place */ }
    } else if ((special.type === 'support-accept' || special.type === 'support-refuse') && next.parliament?.government) {
      const partyId = special.params?.partyId;
      const government = next.parliament.government;
      if (special.type === 'support-accept' && ['active', 'crisis'].includes(government.status)) {
        next = computeParliamentUpdate(next, withCapital(joinAsSupport(next.parliament, partyId, next.clock.currentDate, { world: next.world, text: `${special.params?.party ?? 'Il tuo partito'} accetta: sostegno esterno al governo, senza ministri.` }), next.game), 'Sostegno esterno al governo');
        next = rememberFact(next, { kind: 'lealta', text: `Sostegno esterno al ${government.name}`, weight: 0.8 });
      } else if (special.type === 'support-refuse') {
        const premier = government.premierGroupId;
        let parliament = next.parliament;
        if (premier && parliament.relations?.[premier]) parliament = { ...parliament, relations: { ...parliament.relations, [premier]: { ...parliament.relations[premier], value: Math.max(0, parliament.relations[premier].value - 3) } } };
        next = { ...next, parliament };
      }
    } else if (special.type.startsWith('law-vote-') && next.parliament) {
      const choice = { 'law-vote-line': 'linea', 'law-vote-yes': 'favorevole', 'law-vote-no': 'contrario', 'law-vote-abstain': 'astenuto', 'law-vote-absent': 'assente' }[special.type];
      try { next = { ...next, parliament: setPlayerVote(next.parliament, special.params?.lawId, choice) }; } catch { /* the bill is no longer on the floor of the player's Chamber */ }
    } else if (special.type === 'national-vote') {
      // The country votes without the player (national cycle): new Chambers, or the European Parliament.
      next = holdNationalVote(next, special.electionType, { date: special.date });
    } else if (special.type.startsWith('national-')) {
      next = nationalDecision(next, special);
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
  const out = advanceSociety(before, { date, week: report.week, government: s.parliament?.government ?? null, notoriety: playerStat(s, 'notoriety', 20), legislates: chambersAtWork(s.parliament) });
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
    const text = kept ? `Promessa mantenuta in ${promise.region}: ${String(indicatorLabel(promise.indicator) ?? promise.topic ?? 'la situazione').toLowerCase()} in ripresa` : `Promessa mancata in ${promise.region}: i cittadini se ne ricordano`;
    lines.push(text);
    promiseNotes.push({ kind: 'promessa', title: text, tone: kept ? 'good' : 'bad' });
    remember(game, { date, kind: kept ? 'promessa-mantenuta' : 'promessa-tradita', text, region: promise.region, weight: kept ? 1 : 1.5 });
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
  let parliament = s.parliament;
  // Citizens reward or punish whoever answers for them, territory by territory: that is where elections are won.
  const regional = {};
  for (const [name, item] of Object.entries(society.regions)) {
    const change = item.satisfaction - (before.regions[name]?.satisfaction ?? item.satisfaction);
    if (role === 'nazionale' && Math.abs(change) >= 0.3) regional[name] = round2(clampTo(change * 0.12, -0.4, 0.4));
    if (role === 'locale' && name === region && Math.abs(change) >= 0.2) regional[name] = round2(clampTo(change * 0.25, -0.6, 0.6));
  }
  if (Object.keys(regional).length) chronicle.push({ type: 'territorial', regions: regional });
  if (out.euChange === 'procedura' && isPrimeMinister(s.parliament)) remember(game, { date, kind: 'procedura-ue', text: 'Procedura europea per deficit eccessivo sotto il tuo governo', weight: 2 });
  if (out.euChange === 'procedura') chronicle.push({ type: 'chronicle', kind: 'governo', icon: 'alert', title: 'Procedura europea per deficit eccessivo', body: 'Il deficit resta sopra la soglia di riferimento da mesi: Bruxelles apre la procedura, lo spread sale e ogni spesa costa di più.', tone: 'bad' });
  society = { ...society, lastWhy: { week: report.week, causes: explainMood(before, society), source: DATA_SOURCES.SIMULATION } };
  const style = isSecretary(s.game.party) ? COMMUNICATION_STYLES[s.game.party.communication] : null;
  if (style?.sentiment) society = { ...society, media: { ...society.media, sentiment: Math.max(-100, Math.min(100, society.media.sentiment + style.sentiment)) } };
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
  // The Government's calendar: the budget session every autumn, allies' demands as they come.
  const government = s.parliament?.government;
  if (isPrimeMinister(s.parliament)) {
    const [year, month] = [Number(s.clock.currentDate.slice(0, 4)), Number(s.clock.currentDate.slice(5, 7))];
    const target = year + 1;
    const pendingBudget = s.parliament.laws.some(law => law.kind === 'manovra' && !['approved', 'rejected', 'lapsed'].includes(law.stage));
    if (month >= BUDGET_SESSION.opensMonth && (government.budgetYear ?? 0) < target && !pendingBudget) raise('sessione-bilancio', { year: String(target) }, 6);
    for (const [groupId, partner] of Object.entries(government.partners ?? {})) {
      if (!partner.demand || game.inbox.some(item => item.templateId === 'richiesta-alleato' && item.params?.groupId === groupId)) continue;
      game = addSituationEvent(game, 'richiesta-alleato', { groupId, group: parliamentGroupName(s.parliament, groupId), demand: partner.demand.label, deadline: formatDate(partner.demand.deadline), demandType: partner.demand.type, portfolio: partner.demand.portfolio ?? null, area: partner.demand.area ?? null, dedupe: `${groupId}|${partner.demand.since}` });
      raised.push(`richiesta-${groupId}`);
    }
  }
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
  // Weeks to the next general election: coalitions form faster as it approaches.
  const politiche = (s.game?.elections ?? []).filter(item => item.type === 'politiche' && item.status !== 'held').map(item => item.electionDate).sort()[0];
  const nationalVoteIn = politiche ? Math.round(elapsedDays(date, politiche) / 7) : null;
  const out = advanceWorld(s.world, { date, week: report.week, stats: statsOf(s), deltas: report.deltas ?? {}, game: s.game, parliament: s.parliament, majorityShift, society: societySignal(s.society), playerIsLeader: secretary, playerStrategy: secretary ? s.game.party.line ?? 'autonoma' : null, nationalVoteIn });
  // Political memory weighs on consensus: old promises, ruptures, scandals or victories keep moving the polls.
  const remembered = s.game ? memoryBalance(s.game).net : 0;
  const world = Math.abs(remembered) >= 0.5 && out.world.playerPartyId ? applyWorldSignals(out.world, [{ type: 'memory', delta: round2(clampTo(remembered * 0.02, -0.25, 0.12)) }], date) : out.world;
  let next = { ...s, world };
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
  for (const offer of out.offers ?? []) game = addSituationEvent(game, offer.templateId, { partyLabel: offer.label, partyId: offer.partyId, strategy: offer.strategy ?? '', allianceId: offer.allianceId ?? null, coalition: offer.coalition ?? '', members: offer.members ?? '', dedupe: `${offer.templateId}|${offer.partyId}` });
  game = { ...game, lastReport: game.lastReport ? { ...game.lastReport, lines: [...game.lastReport.lines, ...out.lines] } : game.lastReport };
  return addTimeline({ ...next, game, parliament: withCapital(next.parliament, game) }, notes);
}
// The week in the news: headlines linked to the career (polls, government, economy, territory, elections, alliances).
function tickNews(s, date, week) {
  if (!s.society?.media) return s;
  const player = playerOf(s);
  const poll = s.world?.polls?.at(-1);
  const pollRow = poll?.source !== 'real' ? poll?.results?.find(row => row.partyId === s.world?.playerPartyId) : null;
  const home = s.society.regions?.[player?.region];
  const worst = home ? Object.entries(home.indicators ?? {}).sort((a, b) => a[1] - b[1])[0] : null;
  const next = (s.game?.elections ?? []).filter(item => item.status !== 'held' && item.windowOpensAt).map(item => Math.round(elapsedDays(date, item.windowOpensAt) / 7)).filter(value => value > 0).sort((a, b) => a - b)[0] ?? null;
  const out = weeklyNews({
    recent: s.society.media.recentHeadlines ?? [], week, party: s.world?.parties?.find(item => item.isPlayer)?.label ?? null, pollRow,
    government: s.parliament?.government ?? null, finance: s.society.publicFinance ?? null, region: worst && worst[1] < 35 ? player?.region : null, worstIndicator: worst ? indicatorLabel(worst[0]) : null,
    electionWeeks: next, worldEvents: (s.world?.events ?? []).filter(item => item.week === s.world.week), macro: MACRO_AREAS[macroAreaOf(player?.region)]?.label ?? null
  });
  let society = { ...s.society, media: { ...s.society.media, recentHeadlines: out.recent } };
  for (const item of out.items) society = mediaEvent(society, { outletId: item.outletId, tone: item.tone === 'good' ? 0.3 : item.tone === 'bad' ? -0.3 : 0, intensity: 0.4, headline: item.headline, date, week });
  return { ...s, society };
}
// Writes a fact into the career's political memory.
function rememberFact(s, entry) {
  if (!s.game) return s;
  const game = deepCopy(s.game);
  remember(game, { date: s.clock.currentDate, ...entry });
  return { ...s, game };
}
const parliamentGroupName = (parliament, groupId) => ['camera', 'senato'].flatMap(chamber => parliament?.chambers?.[chamber]?.groups ?? []).find(group => group.groupId === groupId)?.officialName ?? 'Un alleato';
// A new year without an approved budget: provisional management, frozen spending, nervous markets.
function checkBudgetDeadline(s) {
  const government = s.parliament?.government;
  if (!s.society || !government || government.primeMinister !== 'player') return s;
  const year = Number(s.clock.currentDate.slice(0, 4));
  const sessionOpened = s.game?.flags?.cooldowns?.['sessione-bilancio'];
  if (!sessionOpened || (government.budgetYear ?? 0) >= year || government.provisionalYear === year) return s;
  if (Number(s.clock.currentDate.slice(5, 7)) > 2) return s;
  let next = { ...s, society: provisionalBudget(s.society), parliament: { ...s.parliament, government: { ...government, provisionalYear: year, stability: Math.max(0, (government.stability ?? 50) - 10) } } };
  next = { ...next, world: next.world ? applyWorldSignals(next.world, [{ type: 'chronicle', kind: 'governo', icon: 'alert', title: 'Esercizio provvisorio', body: 'La legge di bilancio non è stata approvata entro il 31 dicembre: spesa congelata, spread in aumento, maggioranza sotto accusa.', tone: 'bad' }], s.clock.currentDate) : next.world };
  next = rememberFact(next, { kind: 'esercizio-provvisorio', text: `Esercizio provvisorio nel ${year}`, weight: 3, tone: 'bad' });
  return addTimeline(next, [{ kind: 'governo', title: `Esercizio provvisorio nel ${year}`, detail: 'La legge di bilancio non è arrivata in tempo', tone: 'bad' }]);
}
function settleWeeks(s) {
  let next = s;
  let report = null;
  for (let guard = 0; next.game && next.game.status !== 'ended' && elapsedDays(next.game.week.startedAt, next.clock.currentDate) >= 7 && guard < 260; guard++) {
    const weekEnd = advanceDays(next.game.week.startedAt, 7);
    // Parliament reads the career's difficulty: discipline of the majority and patience of the allies.
    const difficulty = difficultyId(next.career.difficulty);
    const result = advanceWeek({ game: next.game, stats: statsOf(next), parliament: next.parliament ? { ...next.parliament, difficulty } : next.parliament }, { ...gameEnv(next), currentDate: weekEnd }, advanceGovernmentWeek);
    next = applyGameResult(next, result.ctx, next.ui.toast, result.specials);
    if (result.report) next = tickLegislature(next, weekEnd);
    if (result.report) next = tickSociety(next, weekEnd, result.report);
    if (next.world && result.report) next = tickWorld(next, weekEnd, result.report);
    if (result.report) next = tickNational(next, weekEnd);
    if (result.report) next = tickNews(next, weekEnd, result.report.week);
    weekClosed = true;
    if (result.report) next = raiseSituations(checkBudgetDeadline(next), result.report);
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
  if (justFinished && state.career.lastCampaignId !== campaign.id) state = closeCampaign(state, campaign);
  state = settleWeeks(state);
  const week = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(`${state.clock.currentDate}T12:00:00`));
  if (justFinished) state = { ...state, ui: { ...state.ui, toast: 'Voto concluso: risultati disponibili' } };
  else if (state.game?.week.index === weekBefore) state = { ...state, ui: { ...state.ui, toast: `Tempo avanzato al ${week}` } };
  const inParliament = Boolean(state.parliament?.player) && campaign?.status !== 'active' && campaign?.status !== 'finished';
  state = { ...state, dataset: { ...state.dataset, events: [...state.dataset.events, { id: makeId('evento'), title: campaign?.status === 'active' ? 'Giornata di campagna' : campaign?.status === 'finished' ? 'Campagna conclusa' : inParliament ? 'Settimana di lavori parlamentari' : 'Agenda aggiornata', date: state.clock.currentDate, category: campaign?.status === 'active' ? 'campagna' : inParliament ? 'parlamento' : 'agenda', status: 'da pianificare', source: DATA_SOURCES.SIMULATION }].slice(-EVENTS_LIMIT) } };
}
function commitGame(result, toast) {
  state = applyGameResult(state, result.ctx, toast, result.specials ?? []);
  persist(); emit();
  return result;
}
// What the player does is seen: channels pick it up, territories notice, the party's polls move.
// Headlines come from the newsroom (news-engine): varied structures, never the same template twice in a row.
function publicEcho(s, activityId, tone, extra = {}) {
  if (!s.society) return s;
  const player = playerOf(s);
  const name = player?.displayName ?? 'Il politico';
  const outletId = extra.outlet ?? ACTIVITY_MEDIA[activityId];
  const week = s.game?.week.index ?? 1;
  let society = s.society;
  if (outletId) {
    const value = tone === 'bad' ? -1 : extra.tone ?? 1;
    const topic = (s.society.issues ?? [])[0]?.topic?.toLowerCase() ?? 'lavoro';
    const composed = composeHeadline(society.media.recentHeadlines ?? [], NEWS_TEMPLATES[activityId] ? activityId : 'social', { name, week, region: player?.region ?? 'il territorio', municipality: player?.municipality ?? 'il comune', party: s.game?.party?.label ?? name, topic }, value < 0 ? 'bad' : 'good');
    society = mediaEvent(society, { outletId, tone: value, intensity: extra.intensity ?? 1, headline: composed.text, date: s.clock.currentDate, week });
    society = { ...society, media: { ...society.media, recentHeadlines: composed.recent } };
  }
  if (extra.region && society.regions[extra.region]) society = regionAttention(society, extra.region, tone === 'bad' ? -0.4 : extra.regionDelta ?? 0.6);
  return { ...s, society };
}

// What a force weighs when the player asks for an intesa: memories of past agreements and ruptures with it,
// programme overlap (areas of the player's party against the force's collocazione), difficulty.
function allianceContext(s, forceId) {
  const game = s.game;
  const good = memoryAbout(game, forceId, 'good');
  const bad = memoryWeight(game, item => item.kind === 'alleanza-rotta' && (item.partyId === forceId || item.subject === forceId)) + memoryAbout(game, forceId, 'bad');
  return { partySupport: game.party?.support ?? 50, influence: playerStat(s, 'influence'), memory: { good, bad }, difficulty: difficultyOf(game.difficulty).allianceChance, programOverlap: null };
}

// ---------- the national cycle ----------
// General and European elections on the real map of 2022 (legislature-engine): coalitions and national campaign, the
// vote, the new Chambers and their groups, the formation of the Government. The map is loaded by main.js; without it
// the vote uses the simplified count of the engine.
let electoralGeography = null;
let projectionCache = { key: null, value: null };
const NATIONAL_TYPES = ['politiche', 'europee'];
const EU_AREA_LABELS = { 'nord-occidentale': 'Italia nord-occidentale', 'nord-orientale': 'Italia nord-orientale', centrale: 'Italia centrale', meridionale: 'Italia meridionale', insulare: 'Italia insulare' };
const SEAT_RULE_2022 = 'Seggi assegnati sulla mappa reale delle politiche 2022 (Eligendo): 147 collegi uninominali alla Camera e 74 al Senato, proporzionale con soglia del 3% per le liste e del 10% per le coalizioni, eletti all’estero per ripartizione. Il voto, le coalizioni e i seggi sono simulati.';
const SEAT_RULE_EU = 'Europee: 76 seggi, soglia nazionale del 4% (dato reale verificato), riparto nazionale e circoscrizioni in proporzione agli elettori; nelle circoscrizioni contano le preferenze. Voto e seggi simulati.';
const nationalOf = s => normalizeNationalState(s.national, { currentDate: s.clock.currentDate, legislature: s.national ? null : s.game?.legislature ?? null });
const pct1 = value => `${String(Math.round((value ?? 0) * 10) / 10).replace('.', ',')}%`;
const nationalLabel = (s, vote = null) => id => s.world?.parties?.find(item => item.id === id)?.label ?? vote?.coalitions?.find(item => item.id === id)?.label ?? vote?.camera?.parties?.find(row => row.id === id)?.label ?? vote?.national?.find(row => row.id === id)?.label ?? id;
// ---------- the Chambers at work (lawmaking-engine) ----------
// Every week the Government, the groups and the committees move their bills; approved laws reach the country through
// computeParliamentUpdate; the parties behind them gain or lose visibility; the player is asked how to vote on the
// bills of the own Chamber and answers for the votes cast.
const chambersAtWork = parliament => Boolean(parliament?.chambers?.camera?.groups?.length && parliament?.chambers?.senato?.groups?.length);
const VOTE_WORDS = Object.freeze({ favorevole: 'a favore', contrario: 'contro', astenuto: 'con l’astensione', assente: 'senza partecipare al voto' });
const LINE_WORDS = Object.freeze({ favorevole: 'a favore', contrario: 'contro', astenuto: 'per l’astensione' });
function legislativeEffects(world, before, parliament, date) {
  if (!world) return world;
  const known = new Set((before?.history ?? []).map(entry => entry.id));
  const effects = [];
  for (const entry of (parliament?.history ?? []).filter(item => !known.has(item.id) && item.details?.auto)) {
    const law = parliament.laws.find(item => item.id === entry.details.lawId);
    if (!law?.sponsor || lawCredit(law, parliament) !== 'others') continue;
    // A law approved is visibility for the party that proposed it (the Prime Minister's party for the Government).
    if (entry.type === 'iter-approved' && law.sponsor.partyId) effects.push({ partyId: law.sponsor.partyId, delta: law.kind === 'ddl' ? 0.25 : 0.15, remaining: 4, label: `Approvata la legge “${law.title}”` });
    // A Government text rejected costs the parties of the majority.
    if (entry.type === 'iter-rejected' && law.sponsor.kind === 'governo') for (const partyId of new Set(governingGroups(parliament).map(group => group.partyId).filter(Boolean))) effects.push({ partyId, delta: -0.15, remaining: 3, label: `Il governo battuto su “${law.title}”` });
  }
  return effects.length ? addWorldEffects(world, effects.slice(0, 8), date) : world;
}
const governingGroups = parliament => { const ids = new Set([...(parliament?.government?.coalitionGroupIds ?? []), ...(parliament?.government?.supportingGroupIds ?? [])]); return ['camera', 'senato'].flatMap(chamber => parliament?.chambers?.[chamber]?.groups ?? []).filter(group => ids.has(group.groupId)); };
// What the player's vote costs or earns: the group and the party keep count of dissent, the media of decisive votes.
function playerVoteOutcome(s, event) {
  const dissent = event.choice !== event.line && event.choice !== 'assente';
  const tight = Math.abs(event.yes - event.needed) <= 3;
  const betrayal = dissent && event.confidence && (event.inMajority ?? playerInMajority(s.parliament)) && event.choice !== 'favorevole';
  const partyDelta = betrayal ? -6 : dissent ? -2.5 : event.choice === 'assente' ? (tight ? -1.5 : -0.3) : 0.3;
  const groupDelta = betrayal ? -8 : dissent ? -3 : event.choice === 'assente' ? -1 : 0.8;
  const deltas = {};
  if (dissent) deltas.notoriety = 0.8;
  if (event.decisive) { deltas.notoriety = (deltas.notoriety ?? 0) + 1.5; deltas.influence = 1; }
  let parliament = s.parliament;
  if (parliament?.careerStanding) parliament = { ...parliament, careerStanding: { ...parliament.careerStanding, partySupport: clampTo(parliament.careerStanding.partySupport + groupDelta, 0, 100) } };
  // A deal broken (an amendment obtained in exchange for the vote) is not forgotten by the sponsor.
  const relationDelta = event.dealBroken ? -10 : event.choice === 'favorevole' ? 2 : event.choice === 'contrario' ? -2 : 0;
  if (relationDelta && event.sponsor?.groupId && event.sponsor.groupId !== parliament?.player?.groupId && parliament?.relations?.[event.sponsor.groupId]) parliament = { ...parliament, relations: { ...parliament.relations, [event.sponsor.groupId]: { ...parliament.relations[event.sponsor.groupId], value: clampTo(parliament.relations[event.sponsor.groupId].value + relationDelta, 0, 100) } } };
  let game = deepCopy(s.game);
  if (game.party) game.party.support = clampTo(game.party.support + partyDelta, 0, 100);
  const outcome = event.kind === 'fiducia' ? (event.passed ? 'ottenuta' : 'negata') : event.passed ? (event.finalVote ? 'approvata definitivamente' : 'approvata e trasmessa all’altra Camera') : 'respinta';
  const subject = event.kind === 'fiducia' ? `Fiducia al ${event.title}` : `“${event.title}”`;
  const text = `${event.decisive ? 'Il tuo voto decide: ' : ''}${subject} ${outcome} (${event.yes} sì, soglia ${event.needed}). Hai votato ${VOTE_WORDS[event.choice] ?? event.choice}${dissent ? `, contro la linea del gruppo (${LINE_WORDS[event.line] ?? event.line})` : ''}.`;
  if (dissent || event.decisive || betrayal) remember(game, { date: s.clock.currentDate, kind: dissent ? 'dissenso' : 'voto', text, weight: betrayal ? 1.5 : event.decisive ? 1.2 : 0.6, subject: event.sponsor?.partyId ?? null });
  if (event.dealBroken) remember(game, { date: s.clock.currentDate, kind: 'alleato-tradito', text: `Accordo non rispettato su “${event.title}”`, subject: event.sponsor?.partyId ?? null, weight: 1 });
  if (betrayal || event.decisive || (dissent && event.fromGovernment)) game = addDiary(game, { kind: 'parlamento', date: s.clock.currentDate, title: betrayal ? 'Voti contro la fiducia al governo che sostieni' : event.decisive ? 'Il tuo voto è decisivo' : 'Voti in dissenso dal tuo gruppo', lines: [text], tone: betrayal ? 'bad' : event.decisive ? 'good' : 'neutral' });
  let next = { ...s, parliament, game };
  if (event.decisive || betrayal) next = addTimeline(next, [{ kind: 'legge', title: text, tone: betrayal ? 'bad' : 'good' }]);
  if (next.society && (dissent || event.decisive)) next = { ...next, society: mediaEvent(next.society, { outletId: 'quotidiani', tone: event.decisive ? 0.6 : 0.2, intensity: event.decisive ? 1.2 : 0.6, headline: event.decisive ? `Decisivo il voto di ${playerOf(s)?.displayName ?? 'un parlamentare'} ${event.kind === 'fiducia' ? 'sulla fiducia' : `su “${event.title}”`}` : `${playerOf(s)?.displayName ?? 'Un parlamentare'} vota in dissenso ${event.kind === 'fiducia' ? 'sulla fiducia al governo' : `su “${event.title}”`}`, date: s.clock.currentDate, week: s.game.week.index }) };
  const stats = statsOf(next);
  const changed = Object.fromEntries(Object.entries(deltas).map(([metric, delta]) => [metric, roundStat((stats[metric] ?? 50) + delta)]));
  if (Object.keys(changed).length) next = { ...next, dataset: { ...next.dataset, statistics: writeStats(next, { ...stats, ...changed }) } };
  return { state: next, line: text };
}
function tickLegislature(input, date) {
  let s = input;
  // A career outside Parliament finds the Chambers (and the Government in office) at work all the same.
  if (!s.parliament && realParliamentaryGroups.length && s.game && s.career.status !== 'demo') {
    const created = createParliamentState({ career: { ...s.career, parliamentContext: null }, player: playerOf(s), groups: realParliamentaryGroups, currentDate: date, politicalCapital: s.game.resources.politicalCapital, referenceGovernment });
    s = computeParliamentUpdate(s, withCapital(created, s.game), s.ui.toast);
  }
  const before = s.parliament;
  if (!chambersAtWork(before) || !s.game || s.game.status === 'ended') return s;
  // The Government of a simulated Prime Minister acts first (programme, reshuffles, support, verifica), then the Chambers.
  const cabinet = advanceCabinetWeek(before, { date, rand: seededRandom(`${s.career.id ?? 'carriera'}|${date}|governo`), world: s.world, society: s.society, playerSecretaryOf: isSecretary(s.game.party) ? s.world?.playerPartyId ?? null : null });
  const out = advanceLegislativeWeek(cabinet.parliament, { date, rand: seededRandom(`${s.career.id ?? 'carriera'}|${date}|camere`), world: s.world, society: s.society });
  let next = out.parliament === before ? s : computeParliamentUpdate(s, withCapital(out.parliament, s.game), s.ui.toast);
  if (next !== s) next = { ...next, world: legislativeEffects(next.world, before, next.parliament, date) };
  const lines = [...cabinet.lines, ...out.lines];
  for (const event of out.events.filter(item => item.type === 'voto-giocatore')) {
    const result = playerVoteOutcome(next, event);
    next = result.state;
    lines.push(result.line);
  }
  let game = next.game;
  // A vote already decided from the bill's card is not asked again.
  for (const event of out.events.filter(item => item.type === 'voto-in-arrivo' && item.important && !item.decided)) {
    const sponsorLine = event.sponsor?.kind === 'governo' ? (event.kind === 'manovra' ? 'La legge di bilancio del governo arriva al voto.' : event.kind === 'decreto' ? 'Il decreto-legge del governo va convertito in legge.' : 'Un disegno di legge del governo arriva al voto.') : event.sponsor?.kind === 'commissione' ? 'Il testo unificato della commissione arriva al voto.' : `La proposta di ${event.sponsor?.label ?? 'un gruppo'} arriva al voto.`;
    const forecast = event.margin >= 0 ? `passa con circa ${event.yes} voti (soglia ${event.needed})` : `mancano circa ${Math.abs(event.margin)} voti alla soglia di ${event.needed}`;
    game = addSituationEvent(game, 'voto-aula', { lawId: event.lawId, lawTitle: event.title, sponsorLine, whereWhen: `${event.finalVote ? 'Voto finale' : 'Prima votazione'} ${next.parliament.player.chamber === 'camera' ? 'alla Camera' : 'al Senato'}: ${formatDate(event.date)}.`, lineLabel: LINE_WORDS[event.line] ?? event.line, lineShort: LINE_WORDS[event.line] ?? event.line, forecast, confidenceLine: event.confidence ? ' Il governo ha posto la questione di fiducia: se il voto fallisce, cade.' : '', dedupe: `${event.lawId}|${event.finalVote ? 'finale' : 'prima'}` }, event.confidence || Math.abs(event.margin) <= 5, { holdUntil: event.date });
  }
  for (const event of cabinet.events.filter(item => item.id === 'richiesta-sostegno')) game = addSituationEvent(game, 'richiesta-sostegno', { ...event.params, dedupe: `${next.parliament.government?.id}|${date}` }, true);
  // A confidence vote ahead (a crisis, a new Government): the player decides how to vote.
  const government = next.parliament.government;
  const seat = next.parliament.player;
  if (seat?.groupId && government && ['crisis', 'awaiting-confidence'].includes(government.status) && government.primeMinister !== 'player' && government.formedBy !== 'player') {
    const since = government.status === 'crisis' ? government.crisisOpenedAt : government.proposedAt;
    const inside = [...(government.coalitionGroupIds ?? []), ...(government.supportingGroupIds ?? [])].includes(seat.groupId);
    const when = government.status === 'crisis' ? advanceDays(since ?? date, 14) : next.national?.formation?.confidenceAt ?? advanceDays(date, 7);
    game = addSituationEvent(game, 'voto-fiducia', { government: government.name, line: inside ? 'a favore' : 'contro', lineShort: inside ? 'a favore' : 'contro', when: formatDate(when), situation: government.status === 'crisis' ? 'Il governo è in crisi e torna alle Camere.' : 'Il nuovo governo si presenta alle Camere.', dedupe: `${government.id}|${since}` }, true, { holdUntil: when });
  }
  if (lines.length && game.lastReport) game = { ...game, lastReport: { ...game.lastReport, lines: [...game.lastReport.lines, ...lines.slice(0, 5)] } };
  return { ...next, game, parliament: withCapital(next.parliament, game) };
}
function nationalFormationOpen(s) {
  const formation = s.national?.formation;
  return Boolean(formation && !['completata', 'fallita'].includes(formation.phase));
}
function addDiary(game, entry) {
  return { ...game, log: [{ id: `diario-${entry.kind}-${entry.date}-${(game.log ?? []).length}`, week: game.week.index, tone: 'neutral', lines: [], source: DATA_SOURCES.SIMULATION, ...entry }, ...(game.log ?? [])].slice(0, 40) };
}
// Seats of the coalitions (or lists) in one chamber, as a short line.
function seatsLine(result, chamber, labelOf) {
  const data = result?.[chamber];
  if (!data) return '';
  const blocs = [...data.coalitions.map(row => ({ label: labelOf(row.id), seats: row.seats })), ...data.parties.filter(row => !row.coalitionId).map(row => ({ label: labelOf(row.id), seats: row.seats }))].filter(row => row.seats > 0).sort((a, b) => b.seats - a.seats);
  return `${chamber === 'camera' ? 'Camera' : 'Senato'}: ${blocs.map(row => `${row.label} ${row.seats}`).join(' · ')} (maggioranza ${data.majority})`;
}
// The short record of a vote kept in the history of the national state.
function voteSummary(result, labelOf) {
  if (result.type === 'europee') return { id: result.id, type: 'europee', date: result.date, turnout: result.turnout, model: result.model, lists: result.national.filter(row => row.seats > 0).map(row => ({ id: row.id, label: row.label, share: row.share, seats: row.seats })), source: DATA_SOURCES.SIMULATION };
  return {
    id: result.id, type: 'politiche', date: result.date, turnout: result.turnout, model: result.model, winner: result.winner, winnerLabel: result.winner ? labelOf(result.winner) : null, largest: result.largest, hung: result.hung,
    coalitions: ['camera', 'senato'].reduce((out, chamber) => ({ ...out, [chamber]: result[chamber].coalitions.map(row => ({ id: row.id, label: labelOf(row.id), seats: row.seats, share: row.share })) }), {}),
    lists: result.national.slice(0, 12).map(row => ({ id: row.id, label: row.label, share: row.share, seats: (result.camera.parties.find(item => item.id === row.id)?.seats ?? 0) + (result.senato.parties.find(item => item.id === row.id)?.seats ?? 0) })),
    source: DATA_SOURCES.SIMULATION
  };
}

// The player's campaign in the general election: the seats come from the vote on the real map, so the campaign's own
// count is replaced by the national one (lists, regions, the player's district and constituency). null: keep it.
function politicheCampaignResult(campaign, vote, { outcome, regions, forceId, chamber, labelOf }) {
  const data = vote[chamber] ?? vote.camera;
  if (!outcome || !forceId || !(forceId in (data.shares ?? {}))) return null;
  const result = deepCopy(campaign.result);
  const player = campaign.playerCandidateId;
  const idOf = id => id === forceId ? player : id;
  const ids = [...new Set([...Object.keys(data.shares).filter(id => id !== 'altri'), ...data.parties.map(row => row.id)])];
  const rows = ids.map(id => ({ id, share: data.shares[id] ?? 0, row: data.parties.find(item => item.id === id) ?? null }))
    .filter(item => item.id === forceId || item.row?.seats || item.share >= 0.5).sort((a, b) => b.share - a.share || (b.row?.seats ?? 0) - (a.row?.seats ?? 0));
  result.groups = rows.map(item => ({ id: idOf(item.id), candidateId: item.id === forceId ? player : null, label: labelOf(item.id), percent: item.share, votes: Math.round(item.share * 1000), seats: item.row?.seats ?? 0, districtSeats: item.row?.uni ?? 0, proportionalSeats: (item.row?.prop ?? 0) + (item.row?.estero ?? 0), partyIds: [item.id], coalitionId: vote.coalitions.find(coalition => coalition.partyIds.includes(item.id))?.id ?? null }));
  result.territories = regions.map(region => {
    const groups = region.ranking.slice(0, 5).map(([id, share]) => ({ id: idOf(id), candidateId: id === forceId ? player : null, label: labelOf(id), percent: share }));
    if (!groups.some(item => item.candidateId === player)) groups.push({ id: player, candidateId: player, label: labelOf(forceId), percent: region.shares[forceId] ?? 0 });
    const position = region.ranking.findIndex(([id]) => id === forceId) + 1;
    return { territoryId: `regione-${region.region}`, name: region.region, weight: region.weight, groups, winnerId: idOf(region.ranking[0]?.[0] ?? null), playerPosition: position || null };
  });
  const own = result.groups.find(item => item.id === player);
  const share = data.shares[forceId] ?? 0;
  const uninominale = campaign.candidacy?.role === 'uninominale' && outcome.district;
  Object.assign(result, {
    playerShare: share, playerVotes: own.votes, playerSeats: own.seats, winnerGroupId: result.groups[0]?.id ?? null, turnout: vote.turnout, model: vote.model, seatRule: SEAT_RULE_2022, runoffResults: null, firstRound: null,
    personal: {
      code: outcome.code, mandate: outcome.mandate, via: outcome.via ?? null, side: null, position: uninominale ? outcome.district.position : rows.findIndex(item => item.id === forceId) + 1,
      threshold: outcome.threshold, belowThreshold: outcome.belowThreshold, constituency: outcome.constituency ? { seats: outcome.constituency.seats, name: outcome.constituency.name, localShare: null } : null,
      district: uninominale ? { name: `${outcome.district.name} (${outcome.district.code})`, position: outcome.district.position, share: outcome.district.share ?? 0, winnerId: outcome.district.winner, margin: outcome.district.margin, winner2022: outcome.district.winner2022 } : null
    },
    personalMandate: outcome.mandate,
    national: { resultId: vote.id, winner: vote.winner, winnerLabel: vote.winner ? labelOf(vote.winner) : null, hung: vote.hung, camera: seatsLine(vote, 'camera', labelOf), senato: seatsLine(vote, 'senato', labelOf), forceId, source: DATA_SOURCES.SIMULATION }
  });
  result.objectiveMet = campaign.objective === 'win' ? outcome.mandate : campaign.objective === 'threshold' ? own.seats > 0 || share >= 10 : share >= 12 || outcome.mandate;
  result.description = result.objectiveMet ? 'Obiettivo raggiunto.' : 'Obiettivo non raggiunto.';
  result.outcome = classifyOutcome(campaign, result);
  return result;
}
// The same for the European election: national seats, the player's circoscrizione and the preferences inside the list.
function europeanCampaignResult(campaign, vote, { forceId, region, labelOf }) {
  const row = vote.national.find(item => item.id === forceId);
  if (!row || campaign.candidacy?.role !== 'eurodeputato' || campaign.nomination?.status === 'excluded') return null;
  const result = deepCopy(campaign.result);
  const player = campaign.playerCandidateId;
  const idOf = id => id === forceId ? player : id;
  result.groups = vote.national.filter(item => item.id === forceId || item.seats || item.share >= 0.5).map(item => ({ id: idOf(item.id), candidateId: item.id === forceId ? player : null, label: item.label, percent: item.share, votes: Math.round(item.share * 1000), seats: item.seats, partyIds: [item.id] }));
  result.territories = vote.areas.map(area => {
    const shares = area.shares ?? Object.fromEntries(vote.national.map(item => [item.id, item.share]));
    const ranking = Object.entries(shares).sort((a, b) => b[1] - a[1]);
    const groups = ranking.slice(0, 5).map(([id, share]) => ({ id: idOf(id), candidateId: id === forceId ? player : null, label: labelOf(id), percent: share }));
    if (!groups.some(item => item.candidateId === player)) groups.push({ id: player, candidateId: player, label: row.label, percent: shares[forceId] ?? 0 });
    return { territoryId: `circoscrizione-${area.id}`, name: EU_AREA_LABELS[area.id] ?? area.id, weight: area.seats, groups, winnerId: idOf(ranking[0]?.[0] ?? null), playerPosition: ranking.findIndex(([id]) => id === forceId) + 1 || null };
  });
  const home = europeanListSeats(vote, { forceId, region });
  const threshold = LEGISLATURE_RULES.european.threshold;
  const belowThreshold = row.share < threshold;
  const preference = preferenceStanding(campaign, home.seats);
  const code = belowThreshold ? 'sotto-soglia' : home.seats > 0 && preference.rank <= home.seats ? 'eletto-lista' : home.seats > 0 && preference.rank === home.seats + 1 ? 'primo-non-eletto' : home.seats > 0 ? 'non-eletto' : 'sconfitta';
  const mandate = code === 'eletto-lista';
  const own = result.groups.find(item => item.id === player);
  Object.assign(result, {
    playerShare: row.share, playerVotes: own.votes, playerSeats: row.seats, winnerGroupId: result.groups[0]?.id ?? null, turnout: vote.turnout, model: vote.model, seatRule: SEAT_RULE_EU, runoffResults: null, firstRound: null,
    personal: { code, mandate, via: mandate ? 'lista' : null, side: null, position: vote.national.findIndex(item => item.id === forceId) + 1, threshold, belowThreshold, preference: { ...preference, area: EU_AREA_LABELS[home.area] ?? home.area } },
    personalMandate: mandate,
    national: { resultId: vote.id, forceId, source: DATA_SOURCES.SIMULATION }
  });
  result.objectiveMet = campaign.objective === 'win' ? mandate : campaign.objective === 'threshold' ? row.share >= threshold : row.share >= 12 || mandate;
  result.description = result.objectiveMet ? 'Obiettivo raggiunto.' : 'Obiettivo non raggiunto.';
  result.outcome = classifyOutcome(campaign, result);
  return result;
}
// The campaign closed by a national vote carries the national result and the link to it.
function withNationalResult(campaign, result, link) {
  if (!result) return { ...campaign, national: link };
  const opening = campaign.partyImpact?.openingConsensus ?? campaign.expectation?.share ?? result.playerShare;
  const history = campaign.history?.[0]?.type === 'risultato' ? [{ ...campaign.history[0], text: result.outcome?.label ?? campaign.history[0].text }, ...campaign.history.slice(1)] : campaign.history;
  return { ...campaign, result, history, national: link, partyImpact: { ...campaign.partyImpact, electionResult: result.playerShare, consensusChange: round2(result.playerShare - opening), outcome: result.objectiveMet ? 'obiettivo-raggiunto' : 'obiettivo-non-raggiunto' } };
}

// The general election: the country votes on the real map, the new Chambers open, the formation of the Government
// starts. campaign: the player's own campaign (its performance moves the player's district and, for the leader, the
// party), null when the player does not run. number: the legislature the vote opens.
function holdPolitiche(s, national, { campaign, date, number }) {
  const geography = electoralGeography;
  const forceId = s.world.playerPartyId ?? null;
  const force = forceId ? voteForces(s.world).forces.find(item => item.id === forceId) : null;
  const home = homePlace(s);
  const districts = homeDistricts(geography, { municipalityCode: home.municipalityCode, region: home.region, seed: s.career.id ?? seedOf(s) });
  const role = campaign?.candidacy?.role ?? null;
  const chamber = PARLIAMENTARY_CAMPAIGN_ROLES[role] ?? null;
  const secretary = isSecretary(s.game?.party);
  let next = s;
  let world = s.world;
  let votePlayer = null;
  if (force) {
    // How the campaign went against the expectations: it moves the own district and, for the party leader, the party.
    const expected = campaign?.expectation?.share ?? campaign?.preparation?.pollShare ?? null;
    const performance = campaign?.result && expected !== null ? campaign.result.playerShare - expected : 0;
    const stats = statsOf(s);
    const pull = round2(clampTo(performance * (secretary ? 0.15 : 0.04), secretary ? -1.5 : -0.4, secretary ? 1.5 : 0.4));
    if (pull) world = addWorldEffects(world, [{ partyId: forceId, delta: pull, remaining: 1, label: 'La campagna elettorale del partito', unscaled: true }], date);
    const candidate = Boolean(chamber && campaign.nomination?.status !== 'excluded' && campaign.candidates?.find(item => item.isPlayer)?.status !== 'eliminated');
    votePlayer = {
      forceId, region: home.region, districts: { camera: districts?.camera?.id ?? null, senato: districts?.senato?.id ?? null }, uninominale: role === 'uninominale' ? 'camera' : null,
      chamber: chamber ?? 'camera', candidate, listPosition: campaign?.candidacy?.listPosition ?? 1, leader: secretary,
      boost: candidate ? round2(clampTo(performance * 0.3 + ((stats.notoriety ?? 20) - 40) / 40 + ((stats.popularity ?? 45) - 45) / 50, -3, 4)) : 0
    };
  }
  const coalitions = national.campaign?.coalitions?.length ? national.campaign.coalitions : buildCoalitions(world, { playerChoice: national.campaign?.playerChoice ?? null });
  const vote = runNationalVote({ geography, world, coalitions, date, seed: s.career.id ?? seedOf(s), player: votePlayer, line: national.campaign?.line ?? null, participation: s.society?.participation ?? 60 });
  const labelOf = nationalLabel({ world }, vote);
  const outcome = votePlayer?.candidate ? politicheOutcome(vote, votePlayer, { geography }) : null;
  const regions = regionalBreakdown(vote, geography, chamber ?? 'camera');
  // A seat held by a player who did not run ends with the legislature.
  next = { ...next, world };
  if (!campaign && next.career.parliamentContext) next = endMandate(next, 'Fine della legislatura');
  // The new Chambers and their groups; the outgoing Government stays for current business.
  const groups = legislatureGroups(vote, { number, date, world });
  const parliament = openLegislature(normalizeParliamentState(next.parliament ?? {}), { result: vote, number, date, groups, world });
  next = computeParliamentUpdate(next, withCapital(parliament, next.game), next.ui.toast);
  const compact = compactResult(vote);
  const headline = vote.winner ? `vince ${labelOf(vote.winner)}` : `nessuna maggioranza, primo ${labelOf(vote.largest)}`;
  const lines = [seatsLine(vote, 'camera', labelOf), seatsLine(vote, 'senato', labelOf), `Affluenza ${pct1(vote.turnout)}`];
  next = { ...next, world: alignWorldToVote(next.world, vote.national.map(row => ({ partyId: row.id, share: row.share })), date, { title: `Elezioni politiche: ${headline}`, body: lines.join('. ') + '. Risultato simulato sulla mappa reale del 2022.' }) };
  const term = legislatureTerm({ number, firstSitting: advanceDays(date, LEGISLATURE_RULES.firstSittingDays) });
  let nextNational = {
    ...national, campaign: null,
    legislature: { number, label: term.label, reference: 'simulation', firstSitting: term.firstSitting, naturalEnd: term.naturalEnd, since: date },
    lastPolitiche: { ...compact, forceId, player: outcome ? { code: outcome.code, mandate: outcome.mandate, chamber: votePlayer.chamber, share: outcome.share, listSeats: outcome.listSeats, constituency: outcome.constituency, district: votePlayer.uninominale ? outcome.district : null } : null, homeDistricts: districts ? { camera: districts.camera?.id ?? null, senato: districts.senato?.id ?? null, approximate: districts.approximate } : null },
    votes: [voteSummary(compact, labelOf), ...national.votes].slice(0, 12),
    formation: startFormation(compact, { date, number })
  };
  nextNational = nationalHistory(nextNational, date, 'politiche', `Elezioni politiche del ${formatDate(date)}: ${headline}. ${lines.join('. ')}.`);
  if (next.game) next = { ...next, game: addDiary(next.game, { kind: 'elezioni', date, title: `Elezioni politiche: ${headline}`, lines: [...lines, 'Le nuove Camere si riuniscono entro tre settimane; poi consultazioni e fiducia.'] }) };
  next = addTimeline(next, [{ kind: 'elezione', title: `Elezioni politiche: ${headline}`, detail: lines[0], tone: 'neutral' }]);
  next = { ...next, national: nextNational };
  if (campaign) next = { ...next, campaign: withNationalResult(campaign, politicheCampaignResult(campaign, vote, { outcome, regions, forceId, chamber: chamber ?? 'camera', labelOf }), { resultId: vote.id, type: 'politiche', forceId, legislature: number }) };
  return next;
}
// The European election: 76 seats, the momentum it gives (or takes) to every force, the player's own campaign.
function holdEuropee(s, national, { campaign, date }) {
  const before = new Map(voteForces(s.world).forces.map(force => [force.id, force.share]));
  const vote = runEuropeanVote({ geography: electoralGeography, world: s.world, date, seed: s.career.id ?? seedOf(s), participation: s.society?.participation ?? 60 });
  const labelOf = nationalLabel(s, vote);
  const first = vote.national[0];
  const lists = vote.national.filter(row => row.seats > 0).map(row => `${row.label} ${pct1(row.share)} (${row.seats})`);
  // A national test: who does better than the polls gains momentum for a few weeks, who does worse loses it.
  const effects = vote.national.map(row => ({ partyId: row.id, delta: round2(clampTo((row.share - (before.get(row.id) ?? row.share)) * 0.25, -0.4, 0.4)), remaining: 3, label: 'Dopo le europee', unscaled: true })).filter(effect => Math.abs(effect.delta) >= 0.05);
  let next = { ...s, world: addWorldEffects(s.world, effects, date, { title: `Elezioni europee: primo ${first?.label ?? ''}`.trim(), body: `${lists.join(', ')}. Affluenza ${pct1(vote.turnout)} (risultato simulato).`, icon: 'ballot' }) };
  let nextNational = { ...national, lastEuropee: vote, votes: [voteSummary(vote, labelOf), ...national.votes].slice(0, 12) };
  nextNational = nationalHistory(nextNational, date, 'europee', `Elezioni europee del ${formatDate(date)}: ${lists.slice(0, 5).join(', ')}.`);
  if (next.game) next = { ...next, game: addDiary(next.game, { kind: 'elezioni', date, title: `Elezioni europee: primo ${first?.label ?? ''}`.trim(), lines: [lists.slice(0, 6).join(' · '), `Affluenza ${pct1(vote.turnout)} · soglia del ${LEGISLATURE_RULES.european.threshold}%`] }) };
  next = { ...next, national: nextNational };
  if (campaign) next = { ...next, campaign: withNationalResult(campaign, europeanCampaignResult(campaign, vote, { forceId: s.world.playerPartyId, region: homePlace(s).region, labelOf }), { resultId: vote.id, type: 'europee', forceId: s.world.playerPartyId ?? null }) };
  return next;
}
// A national vote (general or European): with the player's campaign when there is one. number: the legislature a
// general election opens (the career's calendar already moved to it when the vote comes from the calendar).
function holdNationalVote(s, type, { campaign = null, date = s.clock.currentDate, number = null } = {}) {
  const national = nationalOf(s);
  if (national.votes.some(vote => vote.type === type && vote.date === date)) return s;
  const legislature = number ?? (campaign ? (s.game?.legislature?.number ?? 19) + 1 : s.game?.legislature?.number ?? national.legislature.number + 1);
  // Without the forces of the political world (an empty world) the campaign keeps its own result.
  if (!s.world || !voteForces(s.world).forces.length) {
    if (type !== 'politiche') return s;
    return { ...s, national: normalizeNationalState({ ...national, legislature: { number: legislature, since: date, firstSitting: advanceDays(date, LEGISLATURE_RULES.firstSittingDays) } }, { currentDate: date }) };
  }
  return type === 'politiche' ? holdPolitiche(s, national, { campaign, date, number: legislature }) : holdEuropee(s, national, { campaign, date });
}

// The coalition the secretary asks to join: its leader accepts with the estimated chance, otherwise the party runs alone.
function requestCoalition(s, coalitionId) {
  const national = nationalOf(s);
  const campaign = national.campaign;
  if (!campaign) throw new Error('La campagna per le politiche non è ancora aperta.');
  if (campaign.fixed) throw new Error('Le liste sono già state depositate: le coalizioni non cambiano più.');
  const option = coalitionOptions(s.world, campaign.coalitions).find(item => item.id === coalitionId);
  if (!option?.compatible) throw new Error('Quella coalizione non è compatibile con la collocazione del tuo partito.');
  const date = s.clock.currentDate;
  const accepted = (hashText(`${s.career.id}|${coalitionId}|${date}|coalizione`) % 1000) / 1000 < option.chance;
  const playerChoice = accepted ? coalitionId : 'alone';
  const party = s.world.parties.find(item => item.isPlayer)?.label ?? 'Il tuo partito';
  const text = accepted ? `${option.leaderLabel} accoglie ${party}: correte insieme in ${option.label}.` : `${option.leaderLabel} respinge la richiesta: ${party} corre da solo.`;
  let next = { ...s, world: applyWorldSignals(s.world, [{ type: 'relation', partyId: option.leaderId, delta: accepted ? 4 : -3 }], date) };
  next = { ...next, national: nationalHistory({ ...national, campaign: { ...campaign, playerChoice, coalitions: buildCoalitions(next.world, { playerChoice }), requests: [...(campaign.requests ?? []), { coalitionId, date, accepted, chance: option.chance, source: DATA_SOURCES.SIMULATION }] } }, date, 'coalizione', text) };
  if (accepted) next = rememberFact(next, { kind: 'alleanza', text: `In coalizione con ${option.label} alle politiche`, partyId: option.leaderId, subject: option.leaderId, weight: 1 });
  return { state: next, accepted, option, text };
}
function setCoalitionChoice(s, playerChoice) {
  const national = nationalOf(s);
  const campaign = national.campaign;
  if (!campaign) throw new Error('La campagna per le politiche non è ancora aperta.');
  if (campaign.fixed) throw new Error('Le liste sono già state depositate: le coalizioni non cambiano più.');
  const party = s.world.parties.find(item => item.isPlayer)?.label ?? 'Il tuo partito';
  const text = playerChoice === 'alone' ? `${party} decide di correre da solo alle politiche.` : `${party} lascia decidere la direzione: si corre con chi è più vicino.`;
  return { ...s, national: nationalHistory({ ...national, campaign: { ...campaign, playerChoice, coalitions: buildCoalitions(s.world, { playerChoice }) } }, s.clock.currentDate, 'coalizione', text) };
}
// Decisions of the agenda about the national cycle (events raised by tickNational).
function nationalDecision(s, special) {
  const national = nationalOf(s);
  const forceId = s.world?.playerPartyId ?? null;
  const date = s.clock.currentDate;
  const formation = national.formation;
  try {
    if (special.type === 'national-coalition') return requestCoalition(s, special.params?.coalitionId).state;
    if (special.type === 'national-alone') return setCoalitionChoice(s, 'alone');
    if (special.type === 'national-auto') return national.campaign && !national.campaign.fixed ? setCoalitionChoice(s, null) : s;
  } catch (error) { return { ...s, ui: { ...s.ui, toast: error.message } }; }
  if (!formation || !forceId || ['completata', 'fallita'].includes(formation.phase)) return s;
  if (special.type === 'national-support' || special.type === 'national-opposition') {
    const support = special.type === 'national-support';
    const next = { ...formation, included: support ? [...new Set([...(formation.included ?? []), forceId])] : (formation.included ?? []).filter(id => id !== forceId), excluded: support ? (formation.excluded ?? []).filter(id => id !== forceId) : [...new Set([...(formation.excluded ?? []), forceId])] };
    return { ...s, national: nationalHistory({ ...national, formation: next }, date, 'consultazioni', support ? 'Alle consultazioni il tuo partito si dice disponibile a sostenere il nuovo governo.' : 'Alle consultazioni il tuo partito annuncia che resterà all’opposizione.') };
  }
  if (special.type === 'national-mandate-decline') return { ...s, national: nationalHistory({ ...national, formation: { ...formation, playerDeclined: true } }, date, 'incarico', 'Rinunci all’incarico: il Presidente della Repubblica lo affida a un’altra figura della coalizione.') };
  if (special.type === 'national-mandate-accept' && s.parliament) {
    const out = acceptMandate({ formation, parliament: s.parliament, date, labelOf: nationalLabel(s, national.lastPolitiche) });
    if (out.parliament === s.parliament) return s;
    const next = computeParliamentUpdate({ ...s, national: nationalHistory({ ...national, formation: out.formation }, date, 'incarico', 'Accetti l’incarico di formare il governo: scegli i ministri e chiedi la fiducia (sezione Governo).') }, withCapital(out.parliament, s.game), 'Incarico accettato: forma il governo');
    return { ...next, ui: { ...next.ui, toast: 'Incarico accettato: scegli i ministri e chiedi la fiducia nella sezione Governo' } };
  }
  return s;
}
// The player's own Government wins the confidence: the player becomes Prime Minister (office and standing).
function crownPremier(s) {
  const government = s.parliament?.government;
  if (!government || government.status !== 'active' || government.formedBy !== 'player' || government.primeMinister === 'player') return s;
  const player = playerOf(s);
  const open = [{ id: `incarico-premier-${government.id}`, title: 'Presidente del Consiglio (scenario)', institution: 'Governo della Repubblica (scenario di gioco)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: s.clock.currentDate }];
  return computeParliamentUpdate(s, withCapital({ ...s.parliament, government: { ...government, primeMinister: 'player' } }, s.game), 'Fiducia ottenuta: sei Presidente del Consiglio', { notoriety: 4, influence: 3 }, { open });
}
// Every week: the national campaign between the opening of the candidacies and the vote, then the formation of the
// Government after it.
function tickNational(s, date) {
  if (!s.game || s.game.status === 'ended' || !s.world) return s;
  let national = nationalOf(s);
  let next = s;
  const forces = voteForces(s.world).forces;
  const politiche = s.game.elections.find(item => item.type === 'politiche' && ['open', 'running', 'missed'].includes(item.status));
  if (politiche && forces.length) {
    const secretary = isSecretary(next.game.party);
    if (national.campaign?.electionId !== politiche.id) {
      const coalitions = buildCoalitions(next.world, { playerChoice: null });
      const labelOf = nationalLabel(next);
      national = nationalHistory({ ...national, campaign: { electionId: politiche.id, electionDate: politiche.electionDate, openedAt: date, filingDate: politiche.windowClosesAt, coalitions, playerChoice: null, line: null, lineSince: null, fixed: false, requests: [], source: DATA_SOURCES.SIMULATION } }, date, 'campagna', `Si aprono le candidature per le politiche del ${formatDate(politiche.electionDate)}: ${coalitions.map(item => `${item.label} (${item.partyIds.map(labelOf).join(', ')})`).join('; ')}.`);
      // The secretary decides with whom the party runs, until the lists are filed.
      const option = coalitionOptions(next.world, coalitions).find(item => item.compatible);
      if (secretary && forces.some(force => force.isPlayer) && option) next = { ...next, game: addSituationEvent(next.game, 'coalizioni-politiche', { coalition: option.label, coalitionId: option.id, chance: `${Math.round(option.chance * 100)}%`, deadline: formatDate(politiche.windowClosesAt), dedupe: politiche.id }, true, { holdUntil: politiche.windowClosesAt }) };
      next = { ...next, world: addWorldEffects(next.world, [], date, { title: 'Al via la campagna per le politiche', body: `Si vota il ${formatDate(politiche.electionDate)}. In corsa ${coalitions.map(item => item.label).join(', ')}${forces.some(force => !coalitions.some(item => item.partyIds.includes(force.id))) ? ' e le liste che corrono da sole' : ''}.`, icon: 'ballot' }) };
    } else if (!national.campaign.fixed) {
      const fixed = date >= national.campaign.filingDate;
      const coalitions = buildCoalitions(next.world, { playerChoice: national.campaign.playerChoice });
      national = { ...national, campaign: { ...national.campaign, coalitions, fixed } };
      if (fixed) { const labelOf = nationalLabel(next); national = nationalHistory(national, date, 'liste', `Depositate le liste: ${coalitions.map(item => `${item.label} (${item.partyIds.map(labelOf).join(', ')})`).join('; ')}.`); }
    }
    // The weeks of the campaign: useful vote, coalitions, the line of the player's party (and its risks).
    const week = campaignWeekEffects({ world: next.world, campaign: national.campaign });
    const line = NATIONAL_LINES[national.campaign.line];
    if (line?.risk && (hashText(`${s.career.id}|${date}|linea`) % 1000) / 1000 < line.risk * 0.3 && next.world.playerPartyId) {
      week.effects.push({ partyId: next.world.playerPartyId, delta: -0.12, remaining: 2, label: 'I toni duri della campagna si ritorcono contro', unscaled: true });
      week.lines.push('I toni duri della campagna nazionale si ritorcono contro il partito.');
    }
    if (week.effects.length) next = { ...next, world: addWorldEffects(next.world, week.effects, date) };
    if (week.lines.length && next.game.lastReport) next = { ...next, game: { ...next.game, lastReport: { ...next.game.lastReport, lines: [...next.game.lastReport.lines, ...week.lines] } } };
  }
  // A Government falls — in a legislature born from a vote of the game or in the one in office at the start of the
  // career: consultations in the same Chambers, from the result of that vote or from the seats of the forces as they
  // are now. A new majority, the same one with a new cabinet, a Government of the President, or the dissolution.
  const fallen = next.parliament?.government;
  if (fallen?.status === 'fallen' && chambersAtWork(next.parliament) && !['insediamento', 'consultazioni', 'incarico', 'fiducia'].includes(national.formation?.phase) && national.formation?.fallenGovernmentId !== fallen.id) {
    const linked = linkGroupsToParties(next.parliament, next.world);
    if (linked !== next.parliament) next = { ...next, parliament: linked };
    const ownVote = Boolean(national.lastPolitiche && linked.legislature?.resultId === national.lastPolitiche.id);
    const result = ownVote ? national.lastPolitiche : seatResult(linked, { date });
    const partiesOf = ids => new Set(['camera', 'senato'].flatMap(chamber => (linked.chambers?.[chamber]?.groups ?? []).filter(group => ids.includes(group.groupId) && group.partyId).map(group => group.partyId)));
    // The forces whose groups left the majority are not counted in the next one.
    const stayed = partiesOf([...(fallen.coalitionGroupIds ?? []), ...(fallen.supportingGroupIds ?? [])]);
    const left = [...new Set([...(fallen.majorityPartyIds ?? []), ...partiesOf(fallen.leftGroupIds ?? [])])].filter(id => !stayed.has(id));
    const labelOf = nationalLabel(next, result);
    national = nationalHistory({ ...national, formation: { ...crisisFormation(result, { date, number: national.legislature.number, governmentName: fallen.name, previous: { partyIds: [...stayed] } }), excluded: left, fallenGovernmentId: fallen.id, ...(ownVote ? {} : { seatResult: result }) } }, date, 'crisi', `${fallen.name} ha perso la fiducia${left.length ? ` dopo l’uscita di ${left.map(labelOf).join(', ')} dalla maggioranza` : ''}: si aprono le consultazioni.`);
  }
  // After the vote: first sitting, consultations, mandate, confidence (or dissolution). While the Government is being
  // formed a failed vote of confidence leads to a new round, not to the early elections of a fallen Government.
  const formation = national.formation;
  if (formation && !['completata', 'fallita'].includes(formation.phase) && (formation.seatResult || national.lastPolitiche) && next.parliament) {
    if (next.game.fallenWeeks) next = { ...next, game: { ...next.game, fallenWeeks: 0 } };
    const result = formation.seatResult ?? national.lastPolitiche;
    const labelOf = nationalLabel(next, result);
    const seatsOf = id => ['camera', 'senato'].reduce((sum, chamber) => sum + (result[chamber]?.parties?.find(row => row.id === id)?.seats ?? 0), 0);
    const out = formationStep({ formation, parliament: next.parliament, result, world: next.world, date, playerRole: { secretaryOf: isSecretary(next.game.party) ? next.world.playerPartyId : null, seated: Boolean(next.parliament.player?.groupId), seatsOf }, labelOf });
    national = { ...national, formation: out.formation };
    for (const line of out.lines) national = nationalHistory(national, date, 'formazione', line);
    if (out.parliament !== next.parliament) next = computeParliamentUpdate(next, withCapital(out.parliament, next.game), next.ui.toast);
    let game = next.game;
    for (const event of out.events) game = addSituationEvent(game, event.id, { ...event.params, dedupe: `${formation.resultId}|${event.id}` }, true, { holdUntil: event.params.holdUntil ?? null });
    if (out.lines.length && game.lastReport) game = { ...game, lastReport: { ...game.lastReport, lines: [...game.lastReport.lines, ...out.lines] } };
    next = { ...next, game };
    if (out.formed) {
      if (out.playerPremier) next = crownPremier(next);
      next = { ...next, world: setGoverningForces(next.world, out.formation.majority?.partyIds ?? [], date, { label: next.parliament.government?.name ?? 'un nuovo governo', log: false }) };
    }
    if (out.dissolve) {
      next = { ...next, game: scheduleEarlyElection(next.game, date), world: addWorldEffects(next.world, [], date, { title: 'Sciolte le Camere: si torna al voto', body: 'Nessuna maggioranza ottiene la fiducia: il Presidente della Repubblica scioglie le Camere e indice elezioni anticipate (simulazione).', icon: 'alert', tone: 'bad' }) };
      next = addTimeline(next, [{ kind: 'governo', title: 'Camere sciolte: elezioni anticipate', detail: 'Nessuna maggioranza dopo il voto', tone: 'bad' }]);
    }
  }
  return { ...next, national };
}
// What the national view shows: calendar, coalitions, projection on the real map, the last votes, the formation.
function nationalProjectionFor(s, coalitions) {
  const home = homePlace(s);
  const forceId = s.world?.playerPartyId ?? null;
  const key = [s.career.id, s.clock.currentDate, s.world?.week, s.world?.polls?.length, electoralGeography ? 1 : 0, JSON.stringify(coalitions.map(item => [item.id, item.partyIds])), home.municipalityCode].join('|');
  if (projectionCache.key === key) return projectionCache.value;
  const districts = homeDistricts(electoralGeography, { municipalityCode: home.municipalityCode, region: home.region, seed: s.career.id ?? seedOf(s) });
  const player = forceId ? { forceId, region: home.region, districts: { camera: districts?.camera?.id ?? null, senato: districts?.senato?.id ?? null }, uninominale: null, boost: 0 } : null;
  const value = voteForces(s.world).forces.length ? nationalProjection({ geography: electoralGeography, world: s.world, coalitions, date: s.clock.currentDate, player, participation: s.society?.participation ?? 60 }) : null;
  projectionCache = { key, value: value ? { ...value, homeDistricts: districts ? { camera: districts.camera, senato: districts.senato, approximate: districts.approximate } : null, contested: { camera: contestedDistricts(value, 'camera').slice(0, 12), senato: contestedDistricts(value, 'senato').slice(0, 8) } } : null };
  return projectionCache.value;
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
    if (latentOutOfDate(state.world)) state = { ...state, world: withLatentForces(state.world, realLatent) };
    if (state.world) state = { ...state, world: alignWorld(state.world) };
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
    // Saves made before the collocazione was documented receive it without rebuilding their world.
    else if (next.world && next.world.parties.some(party => !party.position && realPositions.has(party.id))) next = { ...next, world: withPositions(next.world, Object.fromEntries(realPositions)) };
    // Worlds saved before the presence in the polls receive the forces of the database outside the polls.
    if (latentOutOfDate(next.world)) next = { ...next, world: withLatentForces(next.world, realLatent) };
    // One force per party (AVS, aliases) and the owner's corrections to names, abbreviations and colours.
    if (next.world) { const aligned = alignWorld(next.world); if (aligned !== next.world) next = { ...next, world: aligned }; }
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
    // Sitting deputies of the real XIX legislature as opponents: only while it is the legislature in office.
    const realCandidates = config.electionType === 'politiche' && ['deputato', 'uninominale'].includes(config.role ?? 'deputato') && (state.national?.legislature?.reference ?? 'real') === 'real' ? pertinentDeputies(realPeople, player?.region, `${state.career.id}|${state.clock.currentDate}`) : [];
    // Rivals come more often from the forces that weigh more in the latest poll.
    const partyWeights = Object.fromEntries((state.world?.polls?.at(-1)?.results ?? []).map(row => [row.partyId, row.share]));
    const campaign = createCampaign({ career:state.career, player, statistics:state.dataset.statistics, offices:state.dataset.offices, territories:state.dataset.territories, partyCatalog:[...state.dataset.parties,...partyCatalog], currentDate:state.clock.currentDate, config:{ ...config, realCandidates, partyWeights } });
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
    // The party's committees in the territory of the vote: volunteers, organisation, the candidacy and local support.
    const home = homePlace(state);
    const committees = org?.committees?.length ? committeeSupport(org, { electionType: config.electionType, region: home.region, provinceCode: home.provinceCode, municipality: home.municipality }) : null;
    candidate.resources.money += transfer + game.prep * 30 + fundTotal + partyFunds;
    if (committees) { candidate.resources.volunteers += committees.volunteers; candidate.resources.organization = Math.max(0, Math.min(100, candidate.resources.organization + committees.organization)); }
    candidate.resources.volunteers += Math.max(0, Math.round(game.prep / 6 + ((relationValue(game, 'civic') ?? 45) - 45) / 8)) + (hasAsset(game.finance, 'piattaforma') ? 3 : 0);
    candidate.resources.organization = Math.min(100, candidate.resources.organization + Math.round(game.prep / 5));
    campaign.resources = { ...candidate.resources, visibility: Math.max(0, campaign.resources.visibility + Math.round(((relationValue(game, 'media') ?? 45) - 45) / 5)), source: 'simulation' };
    if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + partyBonus));
    if (party?.affiliation === 'member') campaign.candidacy.listPosition = campaign.nomination.listPosition = Math.max(1, Math.min(6, 6 - party.rank - (party.support >= 70 ? 1 : 0)));
    // The founder draws up the lists of the own party and heads them.
    else if (party?.affiliation === 'founder') campaign.candidacy.listPosition = campaign.nomination.listPosition = 1;
    // Polls and allies decide how much of the party's pull the candidate starts with.
    const poll = campaignPollBonus(state.world, config.electionType, statsOf(state), game.relations);
    // Citizens vote on how they feel: incumbents pay for discontent, challengers gain from it.
    const mood = state.society ? societyMood(state.society) : 50;
    const incumbent = Boolean(governingRole(state));
    const moodBonus = round2(clampTo(incumbent ? (mood - 50) * 0.05 : (50 - mood) * 0.025, -1.5, 1.5));
    poll.bonus = round2(poll.bonus + moodBonus);
    // Voters remember: promises, taxes, crises and laws of past years weigh on the start of the campaign.
    const memory = memoryBalance(game, { region: ['comunale', 'regionale'].includes(config.electionType) ? player?.region : null });
    const memoryBonus = round2(clampTo(memory.net * 0.35, -2.5, 1.5));
    poll.bonus = round2(poll.bonus + memoryBonus);
    const selection = game.party?.org?.selections?.[election.id] ?? null;
    if (selection && campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + selection.bonus));
    if (committees) {
      if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + committees.nomination));
      poll.bonus = round2(poll.bonus + committees.localSupport);
    }
    // Candidacies: the difficulty and what the party remembers of the player (loyalty, ruptures, defeats) weigh on the list.
    if (campaign.nomination.status === 'pending') {
      const partyMemory = memoryWeight(game, item => ['lealta', 'vittoria-elettorale', 'ritorno'].includes(item.kind)) - memoryWeight(game, item => ['cambio-partito', 'alleanza-rotta', 'epurazione', 'caduta-reputazione', 'sconfitta-elettorale'].includes(item.kind));
      campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport * (1 + difficultyOf(game.difficulty).candidacy) + clampTo(partyMemory * 0.6, -2.5, 1.5)));
      campaign.nomination.memoryNote = partyMemory < -0.5 ? 'Il partito ricorda rotture e sconfitte: la candidatura è più contesa.' : partyMemory > 0.5 ? 'Lealtà e vittorie passate ti aiutano a ottenere la candidatura.' : null;
    }
    const local = ['comunale', 'regionale'].includes(config.electionType) ? state.society?.regions?.[player?.region] : null;
    campaign.context = { participation: local?.participation ?? state.society?.participation ?? null, mood, incumbent, source: 'simulation' };
    if (poll.bonus) for (const area of campaign.territories) {
      const shares = area.supportByCandidate;
      shares[campaign.playerCandidateId] = Math.max(0.5, shares[campaign.playerCandidateId] + poll.bonus);
      const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
      for (const id of Object.keys(shares)) shares[id] = round2(shares[id] * 100 / total);
    }
    // What the player may expect: the projection after polls and preparation, and the trend of the party's polls.
    setExpectation(campaign, { pollShare: poll.share ?? null });
    const partyRow = state.world?.polls?.at(-1)?.results?.find(item => item.partyId === state.world?.playerPartyId);
    campaign.partyTrend = partyRow?.delta ?? 0;
    campaign.totalDays = Math.max(21, elapsedDays(state.clock.currentDate, election.electionDate));
    campaign.electionDate = election.electionDate;
    campaign.scheduledElectionId = election.id;
    campaign.preparation = { prep: game.prep, transfer, fund: fundTotal, partyFunds, partyBonus: round2(partyBonus), pollBonus: poll.bonus, pollShare: poll.share, allies: poll.allies, moodBonus, memory: { bonus: memoryBonus, highlights: memory.highlights.map(item => ({ text: item.text, tone: item.tone, week: item.week })) }, selection: selection ? { method: selection.method, bonus: selection.bonus } : null, committees, source: 'simulation' };
    if (committees?.committees.length) campaign.history.unshift({ id: `comitati-${campaign.id}`, day: 0, date: state.clock.currentDate, type: 'preparazione', text: `Comitati del territorio: forza ${committees.strength}/100 · ${committees.volunteers} volontari · candidatura ${committees.nomination >= 0 ? '+' : ''}${committees.nomination} · consenso locale ${committees.localSupport >= 0 ? '+' : ''}${committees.localSupport}`, source: 'simulation' });
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
    if(campaign.status==='finished'&&state.career.lastCampaignId!==campaign.id) state=closeCampaign(state,campaign);
    const toast = state.ui.toast;
    state = settleWeeks(state);
    state = { ...state, ui: { ...state.ui, toast } };
    persist(); emit(); return campaign;
  },
  decideCampaignEvent(eventId, choiceId) {
    state = { ...state, campaign:decideCampaignEvent(state.campaign,eventId,choiceId) };
    persist(); emit();
  },
  setCampaignStrategy(strategyId, options = {}) {
    if (state.campaign?.status !== 'active') throw new Error('Nessuna campagna in corso.');
    state = { ...state, campaign: setCampaignStrategy(state.campaign, strategyId, options), ui: { ...state.ui, toast: 'Strategia della campagna aggiornata' } };
    persist(); emit();
    return state.campaign;
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
  setPartyProgram(areas = []) { return commitGame(setPartyProgram(this.gameInput(), gameEnv(state), areas, Object.fromEntries(Object.values(AREA_BY_ID).map(item => [item.id, item.label]))), 'Programma del partito aggiornato'); },
  setCommunication(style) { return commitGame(setCommunication(this.gameInput(), gameEnv(state), style), 'Stile di comunicazione aggiornato'); },
  setPartyLine(line) { return commitGame(setPartyLine(this.gameInput(), gameEnv(state), line), 'Nuova linea del partito'); },
  assignOrgans(currentId) { return commitGame(assignOrgans(this.gameInput(), gameEnv(state), currentId), 'Organi del partito riassegnati'); },
  setCandidacyRule(rule) { return commitGame(setCandidacyRule(this.gameInput(), gameEnv(state), rule), 'Regola per le candidature aggiornata'); },
  callEarlyCongress() { return commitGame(callEarlyCongress(this.gameInput(), gameEnv(state)), 'Congresso anticipato convocato'); },
  partyInvestment(id) { return commitGame(partyInvestment(this.gameInput(), gameEnv(state), id), 'Investimento del partito avviato'); },
  // Territorial committees on the ISTAT units of the player's region (built once, when the units are loaded).
  initializeCommittees(units = []) {
    const org = state.game?.party?.org;
    if (!org || org.committees?.length || !units.length) return false;
    const home = homePlace(state);
    if (!home.region) return false;
    const game = deepCopy(state.game);
    let seed = hashText(`${state.career.id}|comitati`);
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    game.party.org.committees = createCommittees(game.party.org, { region: home.region, units, home, currents: game.party.currents ?? [], rank: game.party.rank ?? 0, founder: game.party.affiliation === 'founder', week: game.week.index, rand });
    state = { ...state, game };
    persist(); emit();
    return true;
  },
  homePlace() { return homePlace(state); },
  committeeAction(actionId, target = {}) {
    const result = committeeAction(this.gameInput(), gameEnv(state), actionId, target);
    return commitGame(result, result.lines[0] ?? 'Comitato aggiornato');
  },
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
    return commitGame(result, result.success ? `Nuovo incarico nel partito: ${result.rank.title}` : `${result.label} · ${result.rank.title} (probabilità stimata ${Math.round(result.chance * 100)}%)`);
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
    if (state.world) state = { ...state, world: setPlayerParty(state.world, worldPartyOf(state, party), state.clock.currentDate) };
    return commitGame(result, `Hai aderito a ${party.officialName ?? party.name}`);
  },
  // Odds and reasons of an intesa, before proposing it: collocazione, programme, memory, interests, majorities.
  allianceOdds(forceId) {
    if (!state.world || !state.game?.party) return null;
    return allianceOdds(state.world, forceId, allianceContext(state, forceId));
  },
  proposeAlliance(forceId) {
    if (!state.game.party) throw new Error('Serve un partito per stringere un’alleanza.');
    requireSecretary();
    const game = spendTime(state.game, 1);
    if (game.resources.politicalCapital < 4) throw new Error('Servono 4 punti di capitale politico per trattare un’alleanza.');
    const result = proposeAlliance(state.world, forceId, { ...allianceContext(state, forceId), date: state.clock.currentDate });
    let nextGame = { ...game, resources: { ...game.resources, politicalCapital: game.resources.politicalCapital - 4 } };
    const force = state.world.parties.find(item => item.id === forceId);
    if (result.success) { nextGame = deepCopy(nextGame); remember(nextGame, { date: state.clock.currentDate, kind: 'alleanza', text: `Intesa con ${force?.label ?? 'un’altra forza'}`, partyId: forceId, subject: forceId, weight: 1 }); }
    state = { ...state, world: result.world, game: nextGame, parliament: withCapital(state.parliament, nextGame), ui: { ...state.ui, toast: result.success ? 'Alleanza firmata' : 'La proposta di alleanza è stata respinta' } };
    persist(); emit();
    return result;
  },
  breakAlliance(allianceId) {
    requireSecretary();
    const alliance = state.world.alliances.find(item => item.id === allianceId);
    state = { ...state, world: breakAlliance(state.world, allianceId, state.clock.currentDate), ui: { ...state.ui, toast: 'Alleanza interrotta' } };
    for (const partyId of (alliance?.partyIds ?? []).filter(id => id !== state.world.playerPartyId)) state = rememberFact(state, { kind: 'alleanza-rotta', text: `Rotta l’${alliance.label.toLowerCase()}`, partyId, subject: partyId, weight: 1.5 });
    persist(); emit();
  },
  leaveParty() {
    const label = state.game.party?.label ?? 'il partito';
    const result = quitParty({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state));
    remember(result.ctx.game, { date: state.clock.currentDate, kind: 'cambio-partito', text: `Hai lasciato ${label}`, weight: 1.2 });
    return commitGame({ ...result, specials: [{ type: 'party-left' }] }, 'Hai lasciato il partito');
  },

  // ---------- parliament ----------
  setParliamentaryGroups(realGroups = []) {
    realParliamentaryGroups = realGroups.filter(group => group?.source === DATA_SOURCES.REAL && group.verified === true);
  },
  initializeParliament(realGroups = []) {
    const groups = realGroups.filter(group => group?.source === DATA_SOURCES.REAL && group.verified === true);
    if (groups.length) realParliamentaryGroups = groups;
    if (!groups.length) return state.parliament;
    const player = playerOf(state);
    const context = state.career.parliamentContext ?? null;
    const chamber = context?.chamber ?? null;
    let parliament = normalizeParliamentState(state.parliament);
    const hasChambers = parliament?.chambers.camera.groups.length && parliament.chambers.senato.groups.length;
    if (!hasChambers) {
      parliament = createParliamentState({ career: { ...state.career, parliamentContext: context }, player, groups, currentDate: state.clock.currentDate, politicalCapital: state.game?.resources.politicalCapital ?? playerStat(state, 'influence'), referenceGovernment });
    } else if (referenceGovernment && neverHadGovernment(parliament)) {
      // Saves made before the Government in office existed at the start find it now.
      parliament = createReferenceGovernment(parliament, referenceGovernment, state.clock.currentDate);
      state = { ...state, parliament: withCapital(parliament, state.game) };
      timelineBase = state;
      if (state.career.status !== 'demo') persist();
      emit();
      return state.parliament;
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
    // The same factors as every promotion (progression-engine), drawn from the career's own sequence.
    const factors = progressionFactors({ game: next.game, stats: statsOf(state), parliament: next.parliament });
    const rolls = [rollFor(next), rollFor({ ...next, game: { ...next.game, rngState: (next.game?.rngState ?? 1) * 7 + 13, week: next.game?.week } })];
    const result = contestCommitteeRole(next.parliament, next.clock.currentDate, playerStats(state), { roll: rolls[0], roll2: rolls[1], factors });
    const player = playerOf(state);
    const open = result.appointment ? [{ id: roleOfficeId(result.appointment), title: `${result.appointment.title} (scenario)`, institution: chamberInstitution(state.parliament.player.chamber), politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    const deltas = { promosso: { influence: 2, reputation: 1, notoriety: 1 }, 'incarico-inferiore': { influence: 0.5 }, stallo: { influence: -0.5 }, 'sconfitta-interna': { influence: -1, reputation: -0.5 }, retrocessione: { influence: -2, reputation: -1 } }[result.outcome] ?? {};
    return applyParliamentUpdate(next, result.parliament, `${result.label}: ${result.role.title}`, deltas, { open });
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
    // The content is part of the bill: area, instrument, scale, cover, territory and beneficiaries.
    const design = measureDesign({ ...(draft.policy ?? {}), area: draft.policy?.area ?? draft.category });
    const next = withTime(PARLIAMENT_TIME_COSTS.proposeLaw);
    const result = proposeLaw(next.parliament, { ...draft, category: design ? AREA_BY_ID[design.area].label : draft.category, policy: design, currentDate: next.clock.currentDate });
    // A simulated amendment to a real act keeps the act's verified identity, never its content.
    const reference = draft.realReference?.source === DATA_SOURCES.REAL && draft.realReference.verified === true ? { ...draft.realReference } : null;
    const parliament = reference ? { ...result.parliament, laws: result.parliament.laws.map(law => law.id === result.law.id ? { ...law, realReference: reference } : law) } : result.parliament;
    applyParliamentUpdate(next, parliament, reference ? 'Proposta depositata: modifica simulata di un atto reale' : 'Proposta depositata', { experience: 0.5, influence: 0.5 });
    return parliament.laws.find(law => law.id === result.law.id);
  },
  amendLaw(lawId, text) {
    requireOwnLaw(state, lawId);
    const next = withTime(PARLIAMENT_TIME_COSTS.amendLaw);
    return applyParliamentUpdate(next, amendLaw(next.parliament, lawId, text, next.clock.currentDate), 'Emendamento registrato');
  },
  negotiateLaw(lawId, groupId) {
    requireOwnLaw(state, lawId);
    const next = withTime(PARLIAMENT_TIME_COSTS.negotiateLaw);
    const parliament = negotiateLaw(next.parliament, lawId, groupId, next.clock.currentDate, { influence: playerStat(state, 'influence') });
    const refused = parliament.history.at(-1)?.type === 'negoziato-rifiutato';
    return applyParliamentUpdate(next, parliament, refused ? 'Il gruppo rifiuta di trattare: migliora prima i rapporti' : 'Trattativa legislativa aggiornata', refused ? {} : { influence: 0.5 });
  },
  compromiseLaw(lawId) {
    requireOwnLaw(state, lawId);
    const next = withTime(PARLIAMENT_TIME_COSTS.compromiseLaw);
    return applyParliamentUpdate(next, compromiseLaw(next.parliament, lawId, next.clock.currentDate), 'Compromesso registrato');
  },
  advanceLaw(lawId, action) {
    requireOwnLaw(state, lawId);
    const next = withTime(PARLIAMENT_TIME_COSTS.advanceLaw);
    const result = advanceLaw(withContactSupport(next.parliament, next.game?.contacts ?? [], lawId), lawId, action, next.clock.currentDate);
    const finished = ['approved', 'rejected'].includes(result.law.stage);
    const delta = finished ? (result.law.stage === 'approved' ? { reputation: 1, influence: 1, experience: 1, notoriety: 0.5 } : { reputation: -0.5, experience: 0.5 }) : { influence: 0.25 };
    const toast = result.law.stage === 'approved' ? 'Legge approvata in simulazione' : result.law.stage === 'rejected' ? 'Votazione conclusa: proposta respinta' : 'Iter legislativo aggiornato';
    return applyParliamentUpdate(next, result.parliament, toast, delta);
  },
  formGovernment(groupIds) {
    requireSecretary();
    // In a crisis, before the President of the Republic gives the mandate, a secretary with a seat can present a
    // majority of his own: the mandate is his, and the consultations stop there.
    const formation = state.national?.formation;
    const ownBid = Boolean(formation?.crisis && ['insediamento', 'consultazioni'].includes(formation.phase));
    if (nationalFormationOpen(state) && !ownBid) throw new Error('Dopo il voto il governo nasce dalle consultazioni: segui la formazione in Elezioni › Nazionali. Se l’incarico tocca a te, arriva in agenda.');
    if (state.national?.formation?.phase === 'fallita' && (state.game?.elections ?? []).some(item => item.type === 'politiche' && item.early && item.status !== 'held')) throw new Error('Le Camere sono sciolte: si torna al voto, nessun governo può nascere prima delle elezioni anticipate.');
    const next = withTime(PARLIAMENT_TIME_COSTS.formGovernment);
    const parliament = formGovernment(next.parliament, groupIds, next.clock.currentDate);
    let updated = applyParliamentUpdate(next, { ...parliament, government: { ...parliament.government, formedBy: 'player', agenda: [] } }, 'Ricevi l’incarico: trattativa di governo aperta', { influence: 0.5 });
    if (ownBid) {
      const date = state.clock.currentDate;
      const groups = ['camera', 'senato'].flatMap(chamber => updated.parliament.chambers[chamber].groups).filter(group => updated.parliament.government.coalitionGroupIds.includes(group.groupId));
      const majority = { kind: 'giocatore', leaderId: updated.world?.playerPartyId ?? null, partyIds: [...new Set(groups.map(group => group.partyId).filter(Boolean))], supportPartyIds: [], groupIds: groups.map(group => group.groupId), label: 'La maggioranza che presenti al Quirinale' };
      state = { ...updated, national: nationalHistory({ ...updated.national, formation: { ...formation, phase: 'incarico', majority, offeredToPlayer: true, playerAccepted: true, confidenceAt: advanceDays(date, LEGISLATURE_RULES.mandateDays * 2), steps: [...(formation.steps ?? []), { date, phase: 'incarico', text: 'Presenti al Presidente della Repubblica una maggioranza: ricevi l’incarico di formare il governo.' }] } }, date, 'incarico', 'Presenti al Presidente della Repubblica una maggioranza: ricevi l’incarico di formare il governo.') };
      persist(); emit();
      updated = state;
    }
    return updated;
  },
  // ---------- the Prime Minister's powers: everything goes through Government, majority and Parliament ----------
  setGovernmentProgram(program = {}) {
    requirePremier();
    const next = withGovernmentCost('program');
    let parliament = setGovernmentProgram(next.parliament, program, next.clock.currentDate);
    const line = GOVERNMENT_LINES[program.line];
    let society = next.society;
    if (society && line) {
      society = { ...society, publicFinance: { ...society.publicFinance, spread: Math.max(40, (society.publicFinance.spread ?? 130) + line.spread) } };
      for (const id of line.pleased) society = segmentAttention(society, id, 3);
      for (const id of line.displeased) society = segmentAttention(society, id, -3);
    }
    return applyParliamentUpdate({ ...next, society }, parliament, `Programma di governo: ${line.label}`, { influence: 0.5 });
  },
  proposeGovernmentBill(draft = {}) {
    requirePremier();
    const design = measureDesign(draft.policy ?? draft);
    if (!design) throw new Error('Scegli il tema del disegno di legge.');
    const next = withGovernmentCost('governmentBill');
    const title = String(draft.title ?? '').trim() || designTitle(design);
    const result = proposeLaw(next.parliament, { title, category: AREA_BY_ID[design.area].label, summary: draft.summary || `Disegno di legge del governo: ${AREA_BY_ID[design.area].instruments[design.instrument].toLowerCase()}.`, currentDate: next.clock.currentDate, policy: design, origin: 'governo', kind: 'ddl' });
    applyParliamentUpdate(next, result.parliament, 'Il Consiglio dei ministri approva il disegno di legge: ora decide il Parlamento', { experience: 0.5 });
    return state.parliament.laws.find(law => law.id === result.law.id);
  },
  // Decree-laws need a real emergency in the area; they act at once and must be converted by Parliament.
  issueDecree(draft = {}) {
    requirePremier();
    const design = measureDesign(draft.policy ?? draft);
    if (!design) throw new Error('Scegli il tema del decreto.');
    if (!decreeUrgency(state, design.area)) throw new Error(`Il decreto-legge richiede necessità e urgenza: su ${AREA_BY_ID[design.area].label.toLowerCase()} non c’è un’emergenza aperta. Presenta un disegno di legge.`);
    const next = withGovernmentCost('decree');
    const title = String(draft.title ?? '').trim() || `Misure urgenti: ${AREA_BY_ID[design.area].label.toLowerCase()}`;
    const result = issueDecree(next.parliament, { title, summary: draft.summary || `Decreto-legge: ${AREA_BY_ID[design.area].instruments[design.instrument].toLowerCase()}.`, policy: design, currentDate: next.clock.currentDate });
    applyParliamentUpdate(next, result.parliament, `Decreto-legge in vigore: da convertire entro il ${formatDate(result.law.deadline)}`, { influence: 0.5 });
    return state.parliament.laws.find(law => law.id === result.law.id);
  },
  presentBudget(plan = {}) {
    requirePremier();
    if (state.parliament.laws.some(law => law.kind === 'manovra' && !['approved', 'rejected', 'lapsed'].includes(law.stage))) throw new Error('La legge di bilancio è già all’esame del Parlamento.');
    const next = withGovernmentCost('budget');
    const year = Number(next.clock.currentDate.slice(0, 4)) + (Number(next.clock.currentDate.slice(5, 7)) >= 9 ? 1 : 0);
    const result = proposeLaw(next.parliament, { title: `Legge di bilancio ${year}`, category: 'Finanze pubbliche', summary: 'Priorità di spesa, entrate e saldo per il prossimo anno.', currentDate: next.clock.currentDate, policy: { plan }, origin: 'governo', kind: 'manovra' });
    applyParliamentUpdate(next, result.parliament, 'Legge di bilancio presentata alle Camere');
    return state.parliament.laws.find(law => law.id === result.law.id);
  },
  majoritySummit() {
    requirePremier();
    const next = withGovernmentCost('summit');
    const result = majoritySummit(next.parliament, next.clock.currentDate, rollFor(next));
    return applyParliamentUpdate(next, result.parliament, result.success ? 'Vertice riuscito: la maggioranza si ricompatta' : 'Vertice fallito: la maggioranza litiga in pubblico', result.success ? { influence: 1 } : { reputation: -0.5 });
  },
  reshuffleMinister(portfolio, groupId) {
    requirePremier();
    const next = withGovernmentCost('reshuffle');
    let parliament = reshuffleMinister(next.parliament, portfolio, groupId, next.clock.currentDate);
    parliament = fulfilMinistryDemand(parliament, portfolio, groupId, next.clock.currentDate);
    return applyParliamentUpdate(next, parliament, `Rimpasto: ${portfolio}`);
  },
  askConfidence(lawId) {
    requirePremier();
    requireOwnLaw(state, lawId);
    const next = withGovernmentCost('confidenceOnLaw');
    return applyParliamentUpdate(next, askConfidenceOnLaw(next.parliament, lawId, next.clock.currentDate), 'Questione di fiducia posta: la maggioranza è chiamata a compattarsi');
  },
  amendLawPolicy(lawId, patch = {}) {
    requireOwnLaw(state, lawId);
    const law = state.parliament?.laws.find(item => item.id === lawId);
    if (law?.origin === 'governo' && !isPrimeMinister(state.parliament) && !canManageParliament(state.parliament)) throw new Error('Serve un seggio per emendare.');
    const next = withTime(PARLIAMENT_TIME_COSTS.amendPolicy);
    return applyParliamentUpdate(next, amendLawPolicy(next.parliament, lawId, patch, next.clock.currentDate), 'Emendamento al contenuto approvato in commissione');
  },
  acceptLawDemand(lawId, groupId) {
    requireOwnLaw(state, lawId);
    return applyParliamentUpdate(state, acceptLawDemand(state.parliament, lawId, groupId, state.clock.currentDate), 'Richiesta accolta: il testo cambia, il gruppo sostiene la proposta');
  },
  withdrawLaw(lawId) {
    requireOwnLaw(state, lawId);
    const next = withTime(PARLIAMENT_TIME_COSTS.withdraw);
    return applyParliamentUpdate(next, withdrawLaw(next.parliament, lawId, next.clock.currentDate), 'Proposta ritirata', { reputation: -0.5 });
  },
  // ---------- the bills of the Government, of the other groups and of the committees ----------
  // A speech for or against: the sponsor's group notices it, the media report it.
  speakOnLaw(lawId, stance) {
    const next = withTime(PARLIAMENT_TIME_COSTS.speakOnLaw);
    const parliament = speakOnLaw(next.parliament, lawId, stance, next.clock.currentDate);
    const law = parliament.laws.find(item => item.id === lawId);
    const echoed = next.society ? { ...next, society: mediaEvent(next.society, { outletId: 'tv-nazionale', tone: 0.3, intensity: 0.5, headline: `${playerOf(next)?.displayName ?? 'Un parlamentare'} interviene ${stance === 'favorevole' ? 'a sostegno di' : 'contro'} “${law.title}”`, date: next.clock.currentDate, week: next.game?.week.index ?? 1 }) } : next;
    return applyParliamentUpdate(echoed, parliament, stance === 'favorevole' ? 'Intervento a sostegno della proposta' : 'Intervento contro la proposta', { notoriety: 0.5, experience: 0.25 });
  },
  // An amendment to a bill of the others: whoever proposed it decides whether to accept it.
  amendOthersLaw(lawId, patchKey, patchValue, { offerVote = false } = {}) {
    const law = state.parliament?.laws.find(item => item.id === lawId);
    if (!law?.auto) throw new Error('Per le tue proposte modifica direttamente il testo.');
    if ((state.game?.resources.politicalCapital ?? state.parliament?.resources?.politicalCapital ?? 0) < AMENDMENT_CAPITAL_COST) throw new Error(`Servono ${AMENDMENT_CAPITAL_COST} punti di capitale politico per presentare un emendamento.`);
    const next = withTime(PARLIAMENT_TIME_COSTS.amendOthers);
    const paid = { ...next.parliament, resources: { ...next.parliament.resources, politicalCapital: next.parliament.resources.politicalCapital - AMENDMENT_CAPITAL_COST } };
    const roll = seededRandom(`${state.career.id}|${lawId}|${(law.playerAmendments ?? []).length}|${next.clock.currentDate}|emendamento`)();
    const result = amendOthersLaw(paid, lawId, { [patchKey]: patchKey === 'intensity' ? Number(patchValue) : patchValue }, next.clock.currentDate, { influence: playerStat(state, 'influence'), committeeRole: Boolean(next.parliament.careerStanding?.committeeRole), roll, offerVote });
    // A deal fixes the vote: the pending request of the agenda is answered.
    const answered = result.accepted && offerVote && next.game ? { ...next, game: { ...next.game, inbox: next.game.inbox.filter(item => !(item.templateId === 'voto-aula' && item.params?.lawId === lawId)) } } : next;
    applyParliamentUpdate(answered, result.parliament, result.accepted ? (offerVote ? 'Accordo fatto: emendamento approvato, voterai a favore' : 'Emendamento approvato: il testo cambia') : `Emendamento respinto (probabilità stimata ${Math.round(result.chance * 100)}%)`, result.accepted ? { influence: 0.5, experience: 0.5 } : { experience: 0.25 });
    return result;
  },
  amendmentOdds(lawId, { offerVote = false } = {}) {
    const law = state.parliament?.laws.find(item => item.id === lawId);
    return law ? amendmentOdds(state.parliament, law, { influence: playerStat(state, 'influence'), committeeRole: Boolean(state.parliament.careerStanding?.committeeRole), offerVote }) : 0;
  },
  // How the player will vote on the next confidence vote of a Government led by others.
  castConfidenceVote(choice) {
    const parliament = setConfidenceVote(state.parliament, choice);
    const game = state.game ? { ...state.game, inbox: state.game.inbox.filter(item => item.templateId !== 'voto-fiducia') } : state.game;
    const labels = { linea: 'Voterai la fiducia con il tuo gruppo', favorevole: 'Voterai la fiducia', contrario: 'Voterai contro il governo', astenuto: 'Ti asterrai sulla fiducia', assente: 'Non parteciperai al voto di fiducia' };
    return applyParliamentUpdate({ ...state, game }, parliament, labels[choice] ?? 'Voto registrato');
  },
  // How the player will vote when the bill comes to the floor of the player's Chamber.
  castLawVote(lawId, choice) {
    const labels = { linea: 'Voterai con il tuo gruppo', favorevole: 'Voterai a favore', contrario: 'Voterai contro', astenuto: 'Ti asterrai', assente: 'Non parteciperai al voto' };
    const parliament = setPlayerVote(state.parliament, lawId, choice);
    // The decision taken from the bill's card answers the pending request of the agenda.
    const game = state.game ? { ...state.game, inbox: state.game.inbox.filter(item => !(item.templateId === 'voto-aula' && item.params?.lawId === lawId)) } : state.game;
    return applyParliamentUpdate({ ...state, game }, parliament, labels[choice] ?? 'Voto registrato');
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
    let parliament = assignMinister(next.parliament, portfolio, groupId, next.clock.currentDate, { appointee, appointeeLabel: player?.displayName });
    const appointment = parliament.government.ministers.at(-1);
    parliament = fulfilMinistryDemand(parliament, portfolio, appointment.groupId, next.clock.currentDate);
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
  // ---------- a Government led by someone else ----------
  // The simulated Prime Minister's Government from the start (or any Government the player does not lead).
  setReferenceGovernment(spec = null) {
    referenceGovernment = spec?.groupIds?.length ? spec : null;
    if (!referenceGovernment || !state.parliament || !neverHadGovernment(state.parliament)) return;
    const parliament = createReferenceGovernment(normalizeParliamentState(state.parliament), referenceGovernment, state.clock.currentDate);
    if (!parliament.government) return;
    state = { ...state, parliament: withCapital(parliament, state.game) };
    timelineBase = state;
    if (state.career.status !== 'demo') persist();
    emit();
  },
  supportGovernment() {
    requireSecretary();
    const next = withTime(PARLIAMENT_TIME_COSTS.governmentSupport);
    const result = offerGroupSupport(next.parliament, next.clock.currentDate, { influence: playerStat(state, 'influence'), roll: rollFor(next) });
    return applyParliamentUpdate(next, result.parliament, result.accepted ? 'Il tuo gruppo entra nella maggioranza' : 'La maggioranza respinge il sostegno del tuo gruppo', result.accepted ? { influence: 1 } : {});
  },
  withdrawGovernmentSupport() {
    requireSecretary();
    const next = withTime(PARLIAMENT_TIME_COSTS.crisis);
    return applyParliamentUpdate(next, withdrawGroupSupport(next.parliament, next.clock.currentDate), 'Il tuo gruppo esce dalla maggioranza: il governo deve verificare la fiducia', { notoriety: 1 });
  },
  requestGovernmentPost(portfolio) {
    const next = withTime(PARLIAMENT_TIME_COSTS.assignMinister);
    if ((next.game?.resources.politicalCapital ?? 0) < 6) throw new Error('Servono 6 punti di capitale politico per chiedere un incarico di governo.');
    const game = { ...next.game, resources: { ...next.game.resources, politicalCapital: next.game.resources.politicalCapital - 6 } };
    const player = playerOf(state);
    const stats = playerStats(state);
    const result = requestGovernmentPost(withCapital(next.parliament, game), portfolio, next.clock.currentDate, { stats: { ...stats, influence: playerStat(state, 'influence') }, roll: rollFor(next), appointeeLabel: player?.displayName });
    const open = result.appointed ? [{ id: ministerOfficeId(result.appointment), title: `Ministro · ${portfolio} (scenario)`, institution: 'Governo della Repubblica (scenario di gioco)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    // A lower office than hoped: undersecretary instead of minister.
    const lowerGame = result.lower && !game.flags?.scenarioOffice ? { ...game, flags: { ...game.flags, scenarioOffice: { title: 'Sottosegretario (esecutivo di scenario)', since: game.week.index, source: DATA_SOURCES.SIMULATION } } } : game;
    const updated = applyParliamentUpdate({ ...next, game: lowerGame }, result.parliament, result.appointed ? `Sei ministro: ${portfolio}` : result.lower ? 'Niente ministero: ti offrono un incarico da sottosegretario' : 'Il Presidente del Consiglio non ti affida il ministero', result.appointed ? { influence: 3, notoriety: 3, reputation: 1 } : result.lower ? { influence: 1, notoriety: 1 } : { influence: -0.5 }, { open });
    if (result.lower && !game.flags?.scenarioOffice) { state = handleSpecials(state, [{ type: 'scenario-office', title: 'Sottosegretario (esecutivo di scenario)' }]); persist(); emit(); }
    return updated;
  },
  triggerGovernmentCrisis() {
    if (!isSecretary(state.game?.party) && !isPrimeMinister(state.parliament)) throw new Error('Una crisi di governo la aprono il Presidente del Consiglio o il segretario di un partito.');
    const next = withTime(PARLIAMENT_TIME_COSTS.crisis);
    return applyParliamentUpdate(next, triggerGovernmentCrisis(next.parliament, next.clock.currentDate), 'Crisi di governo aperta', { influence: -0.5 });
  },
  // ---------- the national cycle ----------
  // The electoral map of 2022 (loaded by main.js): without it the vote uses the simplified count of the engine.
  setLocalCalendar(doc) {
    if (!doc?.regions?.length || localElections === doc) return;
    localElections = doc;
    if (!state.game || state.career.status === 'demo') return;
    let next = state;
    if (next.game.flags?.localCalendar !== 1) next = { ...next, game: alignLocalCalendar(next.game, localCalendarFor(next), next.clock.currentDate) };
    if (next.world && next.world.localCalendar?.version !== 1) next = { ...next, world: withLocalCalendar(next.world, localSummary(doc), next.clock.currentDate) };
    if (next.world?.localCalendar && !next.world.localCalendar.leans && electoralGeography) next = { ...next, world: withRegionalLeans(next.world, regionalLeans(electoralGeography)) };
    if (next === state) return;
    state = next;
    timelineBase = state;
    persist(); emit();
  },
  setElectoralGeography(geography) {
    if (!geography?.camera?.collegi?.length || !geography?.senato?.collegi?.length || electoralGeography === geography) return;
    electoralGeography = geography;
    projectionCache = { key: null, value: null };
    if (state.world?.localCalendar && !state.world.localCalendar.leans && state.career.status !== 'demo') { state = { ...state, world: withRegionalLeans(state.world, regionalLeans(geography)) }; timelineBase = state; persist(); }
    emit();
  },
  electoralGeography: () => electoralGeography,
  // Calendar, coalitions, projection on the real map, last votes and formation of the Government (national view).
  nationalOverview() {
    const s = state;
    const national = nationalOf(s);
    const today = s.clock.currentDate;
    const coalitions = national.campaign?.coalitions ?? (s.world ? buildCoalitions(s.world, { playerChoice: null }) : []);
    const geography = electoralGeography;
    return {
      national, today, calendar: nationalCalendar(national.legislature, today),
      entries: (s.game?.elections ?? []).filter(item => NATIONAL_TYPES.includes(item.type) && item.status !== 'held').sort((a, b) => a.electionDate.localeCompare(b.electionDate)),
      coalitions, options: s.world ? coalitionOptions(s.world, coalitions) : [], forces: s.world ? voteForces(s.world) : { forces: [], others: 100 },
      projection: s.world ? nationalProjectionFor(s, coalitions) : null,
      geography: geography ? { loaded: true, electionDate: geography.electionDate, sourceUrl: geography.sourceUrl, sourceName: geography.sourceName, verifiedAt: geography.verifiedAt, mirror: geography.mirror ?? null, notes: geography.notes ?? [], camera: { seats: geography.camera.seats, collegi: geography.camera.collegi.length, winners2022: geography.camera.winners2022 }, senato: { seats: geography.senato.seats, collegi: geography.senato.collegi.length, winners2022: geography.senato.winners2022 } } : { loaded: false },
      secretary: isSecretary(s.game?.party), playerPartyId: s.world?.playerPartyId ?? null, formationOpen: nationalFormationOpen(s),
      lines: NATIONAL_LINES, rules: LEGISLATURE_RULES, phases: FORMATION_PHASES
    };
  },
  // The secretary decides with whom the party runs: a coalition (its leader may say no), alone, or the leadership's choice.
  chooseNationalCoalition(choice) {
    requireSecretary();
    if (!nationalOf(state).campaign) throw new Error('Le coalizioni si decidono quando si aprono le candidature per le politiche.');
    if (choice === 'alone' || choice === 'auto') {
      state = { ...setCoalitionChoice(state, choice === 'alone' ? 'alone' : null), ui: { ...state.ui, toast: choice === 'alone' ? 'Il partito correrà da solo' : 'La direzione sceglierà la coalizione' } };
      persist(); emit();
      return { accepted: true };
    }
    const game = spendTime(state.game, 1);
    if (game.resources.politicalCapital < 3) throw new Error('Servono 3 punti di capitale politico per trattare l’ingresso in una coalizione.');
    const out = requestCoalition({ ...state, game: { ...game, resources: { ...game.resources, politicalCapital: game.resources.politicalCapital - 3 } } }, choice);
    state = { ...out.state, parliament: withCapital(out.state.parliament, out.state.game), ui: { ...out.state.ui, toast: out.text } };
    persist(); emit();
    return { accepted: out.accepted, text: out.text };
  },
  // The line of the party's national campaign (from the opening of the candidacies to the vote).
  setNationalCampaignLine(lineId) {
    requireSecretary();
    const national = nationalOf(state);
    const line = NATIONAL_LINES[lineId];
    if (!line) throw new Error('Linea di campagna non valida.');
    if (!national.campaign) throw new Error('La campagna nazionale si apre con le candidature per le politiche.');
    if (national.campaign.line === lineId) return national.campaign;
    const game = deepCopy(state.game);
    if (game.resources.politicalCapital < line.cost.capital) throw new Error(`Servono ${line.cost.capital} punti di capitale politico.`);
    const org = game.party?.org;
    if (!org || org.treasury.balance < line.cost.treasury) throw new Error(`La tesoreria del partito non copre la campagna (${line.cost.treasury} €).`);
    game.resources.politicalCapital -= line.cost.capital;
    treasuryBook(org, -line.cost.treasury, 'campagne', `Campagna nazionale: ${line.label.toLowerCase()}`);
    const next = nationalHistory({ ...national, campaign: { ...national.campaign, line: lineId, lineSince: state.clock.currentDate } }, state.clock.currentDate, 'linea', `Linea della campagna nazionale: ${line.label.toLowerCase()}.`);
    state = { ...state, game, national: next, parliament: withCapital(state.parliament, game), ui: { ...state.ui, toast: `Campagna nazionale: ${line.label}` } };
    persist(); emit();
    return next.campaign;
  },
  reset() {
    state = prepareState(makeDemoState());
    timelineBase = state;
    try { storage.clear(); } catch { /* storage may be unavailable */ }
    lastSaved = 'Nuova carriera demo'; emit();
  },
  createCareer(draft, realParties = [], realGroups = []) {
    // A new career begins on the day of the real snapshot: real government, Parliament and opening poll are all current.
    if (realStartDate) state = { ...state, clock: { ...state.clock, currentDate: realStartDate } };
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
    // The comune chosen from the ISTAT list: the choice is the player's, the code and the unit are ISTAT's.
    const istat = /^\d{6}$/.test(draft.municipalityCode ?? '') ? { istatCode: draft.municipalityCode, provinceCode: draft.provinceCode || null, provinceName: draft.provinceName || null, provinceType: draft.provinceType || null, reference: { source: DATA_SOURCES.REAL, dataset: 'ISTAT — Elenco dei comuni italiani (21 febbraio 2026)', code: draft.municipalityCode } } : {};
    const territories = [
      { id: regionId, kind: 'regione', name: draft.region, parentId: null, source: DATA_SOURCES.USER },
      { id: municipalityId, kind: 'comune', name: draft.municipality.trim(), parentId: regionId, source: DATA_SOURCES.USER, ...istat }
    ];
    const territoryId = draft.initialLevel === 'comunale' ? municipalityId : regionId;
    if (['deputato','senatore'].includes(draft.initialLevel)) territories.push({ id: nationId, kind: 'stato', name: 'Italia', parentId: null, source: DATA_SOURCES.USER });

    const parties = state.dataset.parties.filter(party => party.source === DATA_SOURCES.USER);
    if (draft.partyMode === 'existing' && ![...parties, ...realParties].some(party => party.id === draft.partyId && isSelectableParty(party))) throw new Error('Il partito selezionato non è disponibile.');
    if (draft.partyMode === 'new') {
      if (!draft.partyName?.trim() || !draft.partyAbbreviation?.trim() || !draft.partyDescription?.trim() || !draft.partyOrientation) throw new Error('Completa i dati del nuovo partito.');
      // The player's party has a complete identity: name, initials, colours, orientation, programme and logo (source: user).
      const logoMode = ['builder', 'url', 'upload'].includes(draft.partyLogoMode) ? draft.partyLogoMode : 'builder';
      parties.push({
        id: partyId, name: draft.partyName.trim(), officialName: draft.partyName.trim(), abbreviation: draft.partyAbbreviation.trim().toUpperCase(),
        description: draft.partyDescription.trim(), color: draft.partyColor || '#264d82', color2: /^#[\da-f]{6}$/i.test(draft.partyColor2 ?? '') ? draft.partyColor2 : null, orientation: draft.partyOrientation,
        program: (draft.partyProgram ?? []).filter(id => AREA_BY_ID[id]).slice(0, 4),
        logo: logoMode === 'url' ? { kind: 'url', url: String(draft.partyLogoUrl).trim() } : logoMode === 'upload' ? { kind: 'upload' } : { kind: 'builder', shape: draft.partyLogoShape ?? 'cerchio', symbol: draft.partyLogoSymbol ?? 'freccia' },
        politicalPosition: POSITIONS_SET.has(draft.partyPosition) ? draft.partyPosition : 'centro',
        foundedAt: state.clock.currentDate, status: 'attivo',
        policyPositions: { ...draft.policyPositions }, source: DATA_SOURCES.USER, createdAt: state.clock.currentDate, logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: `Logo di ${draft.partyName.trim()}`
      });
    }
    const profession = draft.previousProfession.trim();
    // The difficulty shifts where the player starts: more or less popularity, reputation and influence.
    const difficulty = difficultyId(draft.difficulty);
    const statistics = Object.fromEntries(Object.entries(initialCareerStatistics(draft.initialLevel)).map(([metric, value]) => [metric, ['popularity', 'reputation', 'influence'].includes(metric) ? Math.max(0, Math.min(100, value + difficultyOf(difficulty).statStart)) : value]));
    const datasetStatistics = [];
    const statisticIds = Object.entries(statistics).map(([metric, value]) => {
      const statisticId = makeId('stat-' + metric);
      datasetStatistics.push({ id: statisticId, subjectId: playerId, metric, value, unit: '100', asOf: state.clock.currentDate, source: DATA_SOURCES.SIMULATION });
      return statisticId;
    });
    const player = {
      id: playerId, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(),
      displayName: draft.firstName.trim() + ' ' + draft.lastName.trim(), birthDate, gender: draft.gender,
      region: draft.region, municipality: draft.municipality.trim(), municipalityCode: istat.istatCode ?? null, province: istat.provinceName ?? null, previousProfession: profession,
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
      startedAt: state.clock.currentDate, createdAt: new Date().toISOString(), status: 'active', parliamentContext, difficulty
    };
    const parliament = chamber ? createParliamentState({ career, player, groups: realGroups, currentDate: state.clock.currentDate, politicalCapital: statistics.influence, referenceGovernment }) : null;
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
    const built = buildWorld({ ...base, game }, partyRecord ?? null);
    const calendared = built && localElections ? withLocalCalendar(built, localSummary(localElections), state.clock.currentDate) : built;
    const world = calendared?.localCalendar && electoralGeography ? withRegionalLeans(calendared, regionalLeans(electoralGeography)) : calendared;
    const society = buildSociety({ ...base, game });
    const national = createNationalState({ currentDate: state.clock.currentDate, legislature: game.legislature });
    if (draft.partyMode === 'new' && game.party) game.party.program = { areas: (draft.partyProgram ?? []).filter(id => AREA_BY_ID[id]).slice(0, 4), since: 1, source: DATA_SOURCES.SIMULATION };
    game.timeline = [{ id: makeId('storia'), week: 1, date: state.clock.currentDate, kind: 'inizio', title: `Inizia la carriera: ${level.office}`, detail: `${draft.municipality.trim()}, ${draft.region}${partyRecord ? ` · ${partyRecord.officialName ?? partyRecord.name}` : ' · indipendente'}`, tone: 'good', source: DATA_SOURCES.SIMULATION }];
    // The game being replaced is kept in a slot, so a new game never erases an old one.
    if (store.hasCareer()) { try { store.saveToSlot(`${slotMeta(state).player} · partita precedente`); } catch { /* no room: the player is warned in the menu */ } }
    state = { ...base, game, world, society, national, parliament: withCapital(parliament, game) };
    timelineBase = state;
    persist({ force: true }); emit();
    return player;
  }
};


// A compact report of the vote, kept in the career after the campaign is closed (results, territory, consequences).
function electionReport(campaign, result, aftermath) {
  const candidateLabel = row => { const candidate = campaign.candidates.find(item => item.id === row.candidateId); return candidate?.isPlayer ? 'La tua lista' : candidate?.realReference?.fullName ?? (candidate?.partyLabel ? `${candidate.partyLabel} (candidatura simulata)` : row.label ?? 'Candidatura simulata'); };
  const outcome = result.outcome ?? {};
  return {
    campaignId: campaign.id, electionType: campaign.electionType, electionLabel: campaign.electionLabel, role: campaign.candidacy?.role ?? null, date: campaign.currentDate,
    outcome: { code: outcome.code ?? null, label: outcome.label ?? null, tone: outcome.tone ?? null, position: outcome.position ?? null, positionLabel: outcome.positionLabel ?? null, margin: outcome.margin ?? null, expected: outcome.expected ?? null, expectation: outcome.expectation ?? null, expectationLabel: outcome.expectationLabel ?? null, via: outcome.via ?? null, side: outcome.side ?? null, preference: outcome.preference ?? null, district: outcome.district ?? null, constituency: outcome.constituency ?? null, threshold: outcome.threshold ?? null, belowThreshold: Boolean(outcome.belowThreshold) },
    playerShare: result.playerShare, playerVotes: result.playerVotes, playerSeats: result.playerSeats, personalMandate: result.personalMandate, turnout: result.turnout ?? null, pollShare: campaign.preparation?.pollShare ?? null,
    groups: (result.groups ?? []).map(row => ({ label: candidateLabel(row), percent: row.percent, votes: row.votes, seats: row.seats, player: row.candidateId === campaign.playerCandidateId, partyIds: row.partyIds ?? [], runoffPercent: row.runoffPercent ?? null })),
    territories: (result.territories ?? []).map(area => { const own = area.groups.find(row => row.candidateId === campaign.playerCandidateId); const top = area.groups[0]; return { name: area.name, weight: area.weight, percent: own?.percent ?? 0, position: area.playerPosition ?? null, winner: top ? candidateLabel(top) : null, winnerPercent: top?.percent ?? null }; }),
    runoff: (result.runoffResults ?? []).map(row => ({ label: candidateLabel(row), percent: row.percent, player: row.candidateId === campaign.playerCandidateId })),
    consequences: { stats: aftermath.stats, party: aftermath.party, capital: aftermath.capital, office: aftermath.office, government: aftermath.government, lines: aftermath.lines, events: aftermath.events.map(item => item.id) },
    seatRule: result.seatRule ?? null, source: DATA_SOURCES.SIMULATION
  };
}
// A campaign closed by the vote: a national vote (general or European) is held first, on the real map, and its result
// becomes the campaign's; then the career takes the consequences.
function closeCampaign(currentState, campaign) {
  let next = currentState;
  if (NATIONAL_TYPES.includes(campaign.electionType)) next = holdNationalVote({ ...currentState, campaign }, campaign.electionType, { campaign, date: campaign.currentDate });
  return applyCampaignResult(next, next.campaign ?? campaign);
}
function applyCampaignResult(currentState,campaign) {
  const result=campaign.result;
  if(!result) return currentState;
  const player=currentState.dataset.politicians.find(item=>item.id===campaign.playerId);
  if(!player) return currentState;
  // What the vote leaves: numbers, party, internal balance, office and the next moves (aftermath-engine).
  const aftermath=electionAftermath({campaign,result,game:currentState.game,player});
  // After a general election on the real map the Government comes from the consultations: the talks about the cabinet
  // concern the player only when the own party is in the coalition that won.
  const vote=result.national?.resultId&&currentState.national?.lastPolitiche?.id===result.national.resultId?currentState.national.lastPolitiche:null;
  if(vote&&!(vote.winner&&(vote.coalitions.find(item=>item.id===vote.winner)?.partyIds??[vote.winner]).includes(result.national.forceId))) aftermath.events=aftermath.events.filter(item=>item.id!=='consultazioni-governo');
  const current=metric=>Number(currentState.dataset.statistics.find(item=>item.subjectId===player.id&&item.metric===metric)?.value??50);
  const clamp100=value=>Math.max(0,Math.min(100,value));
  const metricValues={consensus:result.playerShare,reputation:clamp100((campaign.candidateStats.reputation??50)+aftermath.stats.reputation),notoriety:clamp100((campaign.candidateStats.notoriety??20)+aftermath.stats.notoriety),influence:clamp100((campaign.candidateStats.influence??10)+aftermath.stats.influence),popularity:clamp100(current('popularity')+aftermath.stats.popularity)};
  let statistics=[...currentState.dataset.statistics];
  for(const [metric,value] of Object.entries(metricValues)) {
    const existing=statistics.find(item=>item.subjectId===player.id&&item.metric===metric);
    if(existing) statistics=statistics.map(item=>item===existing?{...item,value:Math.round(value*100)/100,unit:metric==='consensus'?'%':'100',asOf:campaign.currentDate,source:DATA_SOURCES.SIMULATION}:item);
    else statistics.push({id:makeId(`stat-${metric}`),subjectId:player.id,metric,value:Math.round(value*100)/100,unit:metric==='consensus'?'%':'100',asOf:campaign.currentDate,source:DATA_SOURCES.SIMULATION});
  }
  // The previous term of the same kind ends with the vote, whatever the outcome.
  let dataset=closeTermOffices({...currentState.dataset,statistics},player.id,campaign.electionType,campaign.currentDate);
  const outcome=result.outcome??{};
  const report=electionReport(campaign,result,aftermath);
  const historyEntry={campaignId:campaign.id,electionType:campaign.electionType,electionLabel:campaign.electionLabel,percent:result.playerShare,seats:result.playerSeats,personalMandate:result.personalMandate,objectiveMet:result.objectiveMet,outcome:outcome.code??null,outcomeLabel:outcome.label??null,position:outcome.position??null,expectation:outcome.expectation??null,side:outcome.side??null,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION};
  let career={...currentState.career,lastCampaignId:campaign.id,lastElectionResult:{...historyEntry,votes:result.playerVotes},lastElectionReport:report,electionHistory:[...(currentState.career.electionHistory??[]),historyEntry],partyImpactHistory:[...(currentState.career.partyImpactHistory??[]),{campaignId:campaign.id,partyId:campaign.partyId,consensusChange:campaign.partyImpact.consensusChange,outcome:campaign.partyImpact.outcome,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION}]};
  if(result.personalMandate&&aftermath.office) {
    const title=aftermath.office.title;
    const office={id:makeId('incarico-simulato'),title,institution:campaign.electionType==='comunale'?`Comune di ${player.municipality}`:campaign.electionType==='regionale'?`Regione ${player.region}`:campaign.electionType==='europee'?'Parlamento europeo':'Repubblica italiana',level:campaign.electionType,side:aftermath.office.side??null,via:aftermath.office.via??null,politicianId:player.id,territoryId:campaign.territoryId,startDate:campaign.currentDate,endDate:null,source:DATA_SOURCES.SIMULATION};
    dataset={...dataset,offices:[...dataset.offices,office],politicians:dataset.politicians.map(item=>item.id===player.id?{...item,roleId:office.id}:item)};
    career.status='elected';
  }
  // Calendar, party and relationships react to the vote.
  let game=currentState.game?markElectionHeld(currentState.game,campaign.id,{percent:result.playerShare,personalMandate:result.personalMandate,outcome:outcome.code??null}):currentState.game;
  if(game) {
    game=deepCopy(game);
    if(campaign.nomination.status==='approved') game.flags={...game.flags,candidacy:true};
    if(game.party&&aftermath.party) {
      game.party={...game.party,support:Math.max(0,Math.min(100,game.party.support+aftermath.party.support))};
      const currents=aftermath.party.currents;
      if(currents) game.party.currents=game.party.currents.map(item=>{const delta=item.id===game.party.alignedCurrentId?currents.aligned:currents.others;const value=Math.max(0,Math.min(100,(item.value??item.relation??50)+delta));return {...item,value,relation:value};});
    }
    game.resources={...game.resources,politicalCapital:Math.max(0,Math.min(100,(game.resources.politicalCapital??0)+(aftermath.capital??0)))};
    // The result stays in the political memory: a victory opens doors for years, a defeat is thrown back at you.
    remember(game,{date:campaign.currentDate,kind:aftermath.memory.kind,text:`${campaign.electionLabel}: ${String(Math.round(result.playerShare*10)/10).replace('.',',')}% · ${outcome.label??(result.personalMandate?'mandato conquistato':'nessun mandato')}`,region:['comunale','regionale'].includes(campaign.electionType)?player.region:null,weight:aftermath.memory.weight});
    game.relations=game.relations.map(item=>item.id==='leadership'&&aftermath.party?{...item,value:Math.max(0,Math.min(100,item.value+aftermath.party.leadership))}:item);
    game.log=[{id:`diario-voto-${campaign.id}`,week:game.week.index,date:campaign.currentDate,kind:'elezioni',title:`${campaign.electionLabel}: ${outcome.label??(result.personalMandate?'mandato conquistato':'nessun mandato')}`,lines:[`${String(Math.round(result.playerShare*10)/10).replace('.',',')}% · ${outcome.positionLabel??''}${outcome.expectationLabel?` · ${outcome.expectationLabel.toLowerCase()}`:''}`,...aftermath.lines,result.objectiveMet?'Obiettivo raggiunto':'Obiettivo mancato'].filter(Boolean),tone:aftermath.tone==='good'?'good':aftermath.tone==='neutral'?'neutral':'bad',source:'simulation'},...game.log].slice(0,40);
    // The committees of the territory feel the vote.
    if(game.party?.org?.committees?.length) {
      const home=homePlace(currentState);
      const territory=committeesAfterVote(game.party.org,{mandate:Boolean(result.personalMandate),electionType:campaign.electionType,region:home.region,provinceCode:home.provinceCode,municipality:home.municipality,week:game.week.index});
      if(territory.length) game.log[0]={...game.log[0],lines:[...game.log[0].lines,...territory.slice(0,2)]};
    }
    // What the vote opens: the giunta, the opposition, an appeal, the reckoning in the party, the government.
    for(const event of aftermath.events) game=addSituationEvent(game,event.id,event.params,event.id==='dopo-voto-vittoria'||event.id==='dopo-voto-sconfitta',{holdUntil:advanceDays(campaign.currentDate,7)});
  }
  // A parliamentary seat won in the campaign opens (or confirms) the mandate; losing it ends the mandate.
  let parliament=currentState.parliament;
  const chamber=PARLIAMENTARY_CAMPAIGN_ROLES[campaign.candidacy.role];
  const previousContext=currentState.career.parliamentContext??null;
  // After a general election on the real map the Chambers are new: the player sits with the group of the own party.
  const newLegislature=campaign.electionType==='politiche'&&campaign.national?.resultId&&parliament?.legislature?.resultId===campaign.national.resultId;
  if(result.personalMandate&&chamber&&newLegislature) {
    // An independent elected by the own campaign sits in the Misto as a component of one.
    if(!campaign.national.forceId) {
      const groupId=`leg${parliament.legislature.number}-${chamber}-misto-indipendenti`;
      const existing=(parliament.chambers[chamber].groups??[]).find(item=>item.groupId===groupId);
      const groups=existing?parliament.chambers[chamber].groups.map(item=>item.groupId===groupId?{...item,simulatedSeats:item.simulatedSeats+1}:item):[...parliament.chambers[chamber].groups,{groupId,officialName:'Misto – indipendenti',chamber,simulatedSeats:1,partyId:null,independent:true,component:true,position:null,axis:0,color:null,legislature:parliament.legislature.number,simulated:true,reference:{memberCount:1,leaderPoliticianId:null,countAsOf:campaign.currentDate,source:DATA_SOURCES.SIMULATION,verified:false,sourceUrl:null,sourceName:'Composizione simulata dopo il voto'},source:DATA_SOURCES.SIMULATION}];
      parliament={...parliament,chambers:{...parliament.chambers,[chamber]:{...parliament.chambers[chamber],groups}},relations:{...parliament.relations,[groupId]:parliament.relations?.[groupId]??{value:70,source:DATA_SOURCES.SIMULATION}}};
    }
    const group=campaign.national.forceId?groupOfParty(parliament,chamber,campaign.national.forceId):(parliament.chambers[chamber].groups??[]).find(item=>item.independent)??null;
    career.currentLevel=chamber==='camera'?'deputato':'senatore';
    career.parliamentContext={mode:'real-context',chamber,groupId:group?.groupId??null,territoryName:player.region,via:'campaign',since:campaign.currentDate,legislature:parliament.legislature.number,source:DATA_SOURCES.SIMULATION};
    if(previousContext) career.pastParliamentContexts=[...(career.pastParliamentContexts??[]),{...previousContext,endedAt:campaign.currentDate,reason:`Fine della legislatura: rieletto${previousContext.chamber===chamber?'':' nell’altra Camera'}`}];
    parliament=seatPlayer(parliament,{politicianId:player.id,chamber,groupId:group?.groupId??null,territoryName:player.region,date:campaign.currentDate});
  } else if(result.personalMandate&&chamber) {
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
  const world=currentState.world?applyWorldSignals(currentState.world,[{type:'election',electionType:campaign.electionType,label:campaign.electionLabel,share:result.playerShare,mandate:result.personalMandate,pollShare:campaign.preparation?.pollShare??null}],campaign.currentDate):currentState.world;
  const next={...currentState,dataset,career,game,world,parliament:withCapital(currentState.parliament,game)};
  if(parliament===currentState.parliament) return withObjectives(next);
  // Route the parliamentary change through the shared bookkeeping (history, offices, events).
  return withObjectives(computeParliamentUpdate(next,withCapital(parliament,game),currentState.ui.toast));
}
