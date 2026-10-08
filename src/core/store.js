import { uniqueId } from './ids.js?v=20261007-2';
import { DATA_SOURCES, emptyDataset, isSelectableParty } from '../data/schema.js?v=20261007-2';
import { makeDemoState } from '../data/demo.js?v=20261007-2';
import { CAREER_LEVELS, ITALIAN_REGIONS, hasProvincialLevel, initialCareerStatistics, regionIdOf } from '../data/regions.js?v=20261007-2';
import { storage } from './storage.js?v=20261007-2';
import { loadSettings } from './settings.js?v=20261007-2';
import { advanceDays, formatDate } from './time.js?v=20261007-2';
import { validateNewCareerDraft } from './career-rules.js?v=20261007-2';
import { advanceCampaign, applyCrewProfile, breakCampaignAlliance, campaignDebts, createCampaign, decayEndorsers, decideCampaignEvent, mergeEndorsers, mergeRivalRegistry, negotiateCampaignAlliance, performCampaignActivity, rivalLedger, setCampaignStrategy, setExpectation } from './campaign-engine.js?v=20261007-2';
import { electionAftermath } from './aftermath-engine.js?v=20261007-2';
import { advancementOdds, progressionFactors } from './progression-engine.js?v=20261007-2';
import { hasStart, planLines, startMods, startPlan, startStatDeltas } from './start-engine.js?v=20261007-2';
import { objectiveMods } from './objective-engine.js?v=20261007-2';
import { END_KINDS, addToHall, careerFacts, hallEntry, legacyBoon, legacyScore, legacyTags, retirementProblem, sortedHall } from './legacy-engine.js?v=20261007-2';
import { committeeSupport, committeesAfterVote, createCommittees } from './committee-engine.js?v=20261007-2';
import { changeSeats, checkMajority, record as recordParliament, setConfidenceVote, createReferenceGovernment, neverHadGovernment, offerGroupSupport, requestGovernmentPost, withdrawGroupSupport, partnerSatisfaction, acceptLawDemand, activeMinisters, amendLawPolicy, askConfidenceOnLaw, groupProfile, issueDecree, majoritySummit, reshuffleMinister, setGovernmentProgram, settlePartnerDemand, withdrawLaw, playerInMajority, advanceGovernmentWeek, majorityShift, advanceLaw, amendLaw, assignMinister, assignPlayerGroup, canManageParliament, compromiseLaw, contestCommitteeRole, createParliamentState, enterParliament, formGovernment, leaveParliament, negotiateGovernmentSupport, negotiateLaw, normalizeParliamentState, proposeLaw, reviseGovernmentCoalition, triggerGovernmentCrisis, voteGovernmentConfidence } from './parliament-engine.js?v=20261007-2';
import { situation, addProvincialCalendar, declareAmbition, scheduleEarlyLocalElection, alignLocalCalendar, localCalendarOf, committeeAction, setCommunication, setPartyProgram, addSituationEvent, addWorldReaction, advanceWeek, alignCurrent, assignOrgans, callEarlyCongress, contestPartyRank, createGameState, disciplineGroup, expelDissidents, isSecretary, joinParty, makeInvestment, nextPartyRank, partyInvestment, lifeBreakPact, lifeCadre, lifeCongress, lifeFound, lifeMerge, lifeOverview, lifeRebuild, lifeRename, lifeRespond, partyOpsAvailability, saveForElection, saveReserve, takeReserve, scheduleEarlyElection, setCandidacyRule, setPartyLine, markElectionHeld, markElectionRunning, normalizeGameState, openElection, performActivity, quitParty, refreshObjectives, relationValue, resolveInboxItem, spendTime, upcomingElections } from './career-engine.js?v=20261007-2';
import { ADVANCE_RULES, AMENDMENT_CAPITAL_COST, COMMUNICATION_STYLES, GOVERNMENT_CAPITAL_COSTS, PARLIAMENT_TIME_COSTS } from '../data/simulation/career-rules.js?v=20261007-2';
import { advanceLegislativeWeek, amendOthersLaw, amendmentOdds, linkGroupsToParties, setPlayerVote, speakOnLaw } from './lawmaking-engine.js?v=20261007-2';
import { seededRandom } from './vote-engine.js?v=20261007-2';
import { advanceCabinetWeek, joinAsSupport } from './cabinet-engine.js?v=20261007-2';
import { EP_COSTS, EP_GROUPS_2024, EP_ROLES, INSTITUTIONS, advanceInstitutionWeek, applyLocalEffect, bidRapporteur, concedeToGroup, createInstitution, committeeById, epGroupFor, grantDelega, localAreas, mandateRecord, proposeLocalAct, questionExecutive, requestCommittee, reshuffleLocal, revokeDelega, runForCommitteeRole, setLocalVote, tableAmendment, territoryValue } from './local-engine.js?v=20261007-2';
import { candidacyBlock, institutionOffice, lapsesFor, officeLabel, officeScope } from './office-engine.js?v=20261007-2';
import { actTypeOf } from '../data/simulation/local-acts.js?v=20261007-2';
import { SECTOR_GAINS, competenceIn, gainSector, sectorFloors, standingFactors } from './standing-engine.js?v=20261007-2';
import { AREA_BY_ID, BUDGET_SESSION, GOVERNMENT_LINES, POLICY_AREAS, areaOf } from '../data/simulation/policy-rules.js?v=20261007-2';
import { allianceBlock, allianceOf, electionRoster, forceProfiles, mergeCandidates, mergeIntoPlayerForce, renamePlayerForce, setPlayerAgenda, splitPlayerForce, localShares, regionalShares, withRegionalLeans, withLocalCalendar, joinCoalition, acceptAlliance, addWorldEffects, advanceWorld, alignWorldToVote, allianceOdds, applyWorldSignals, axisOf, breakAlliance, campaignPollBonus, createWorld, isLegacyWorld, normalizeWorld, proposeAlliance, setGoverningForces, setPlayerParty, withCanonicalForces, withLatentForces, withPartyIdentities, withPositions } from './world-engine.js?v=20261007-2';
import { FORMATION_PHASES, LEGISLATURE_RULES, NATIONAL_LINES, acceptMandate, crisisFormation, seatResult, startFormation, buildCoalitions, campaignWeekEffects, coalitionOptions, compactResult, contestedDistricts, createNationalState, europeanListSeats, formationStep, groupOfParty, homeDistricts, legislatureGroups, legislatureTerm, nationalCalendar, nationalHistory, nationalProjection, normalizeNationalState, openLegislature, politicheOutcome, regionalBreakdown, runEuropeanVote, runNationalVote, seatPlayer, voteForces } from './legislature-engine.js?v=20261007-2';
import { classifyOutcome, preferenceStanding } from './election-engine.js?v=20261007-2';
import { DIFFICULTIES, difficultyId, difficultyOf } from '../data/simulation/difficulty-rules.js?v=20261007-2';
import { WORLD_PARTY_COUNT } from '../data/simulation/polling-rules.js?v=20261007-2';
import { heldOfficesOf, isPrimeMinister } from './roles.js?v=20261007-2';
import { costProblem, leavePartyFor, memoryAbout, memoryBalance, memoryWeight, recordWhy, remember, scheduleFollowUp } from './career-engine.js?v=20261007-2';
import { advanceElection, affinity, applyPresidentCredit, composeAssembly, createPresidency, dealWithBloc, declareCandidacy, lineText, normalizePresidency, openElection as openPresidentialElection, playerStanding, presidencySchedule, presidentActivityEffects, presidentActivityProblem, presidentWeek, presidentialEligibility, proclaim, projection, quorumFor, resignPresidency, setPlayerLine, setPlayerVote as setPresidentialVote, sponsorCandidate, termEndOf, vetoCandidate, whiteSemester, withdrawCandidacy } from './presidency-engine.js?v=20261007-2';
import { PRESIDENCY_RULES, PRESIDENT_ACTIVITIES, PRESIDENT_ACTS } from '../data/simulation/presidency-rules.js?v=20261007-2';
import { PARTY_LINES } from '../data/simulation/career-rules.js?v=20261007-2';
import { advanceSociety, applyBudgetPlan, applyLawToSociety, calibrateWeights, createSociety, explainMood, measureDesign, mediaEvent, normalizeSociety, provisionalBudget, publicBudgetChoice, regionAttention, revokeMeasure, scheduleRegionalEffects, segmentAttention, societyMood, societyShock, observatorySociety } from './society-engine.js?v=20261007-2';
import { ACTIVITY_MEDIA, INDICATORS, ISSUE_TOPICS, SEGMENTS } from '../data/simulation/society-rules.js?v=20261007-2';
import { book, hasAsset, releaseElectionFund, setBudgetLevel } from './finance-engine.js?v=20261007-2';
import { isPartyLeader, treasuryBook } from './organization-engine.js?v=20261007-2';
import { selectContacts, syncContacts } from './contacts-engine.js?v=20261007-2';
import { NEWS_TEMPLATES, composeHeadline, weeklyNews } from './news-engine.js?v=20261007-2';
import { macroAreaOf, MACRO_AREAS } from '../data/simulation/policy-rules.js?v=20261007-2';
import { RACE_ROLES, RACE_RULES } from '../data/simulation/race-rules.js?v=20261007-2';
import { buildSlate, candidateOptions, chooseCandidate, mergeSlate, profileStats, raceDue, raceOutcome, rootingOf, runRace } from './race-engine.js?v=20261007-2';
import { MEMBER_HISTORY_LIMIT, closeVacancy, drawMemberChange, fillSeat, inOffice, isSeatPerson, leaveSeat, moveSeat, newMember, openVacancy, partsWithGuests, rosterInSync, rosterPeople, rosterSeats, seatOf, syncRoster, vacanciesOf, withMemberEntry } from './seat-roster.js?v=20261007-2';

const STATE_VERSION = 9;
const POSITIONS_SET = new Set(['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra']);
const PARLIAMENTARY_CAMPAIGN_ROLES = Object.freeze({ deputato: 'camera', uninominale: 'camera', senatore: 'senato' });
const isRestorableSave = saved => saved && typeof saved === 'object' && saved.career && typeof saved.career === 'object' && saved.clock?.currentDate && saved.dataset && Array.isArray(saved.dataset.politicians);

const storedState = storage.load();
// The slots and their index say the same thing from the first moment (a write that stopped half way leaves nothing orphaned or missing).
try { storage.repairSlots(); } catch { /* the slots are read as they are */ }
// A save written by a newer version of the game is not for this one: it is neither read down nor written over (this version stops saving while it is there).
const isFutureSave = saved => Number.isFinite(saved?.version) && saved.version > STATE_VERSION;
const futureProblem = version => `Salvataggio di una versione più recente del gioco (versione ${version}, questa è la ${STATE_VERSION}): non lo carico e non lo modifico. Aggiorna il gioco per riaprirlo.`;
// How the last save went, as facts (whatever message is shown): the changes not saved yet, why the last write failed, how many writes succeeded, the save of the previous version still to be kept aside, a lock.
let weekClosed = false;
let unsaved = false;
let saveFailure = null;
let saveSeq = 0;
let saveLock = isFutureSave(storedState) ? futureProblem(storedState.version) : null;
let pendingBackup = null;
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

// Where the player lives for the career: the comune and the region, and the province when it has organs of its own.
function placeOf(s) {
  const player = playerOf(s);
  const home = homePlace(s);
  return { municipality: player?.municipality ?? null, region: player?.region ?? null, ...(hasProvincialLevel(home) ? { province: home.provinceName ?? null, provinceCode: home.provinceCode ?? null, provinceType: home.provinceType ?? null } : {}) };
}
function buildGame(s, { partyLabel = null, founder = null, funds = null } = {}) {
  const player = playerOf(s);
  const partyId = player ? player.partyId : s.career.partyId;
  const partyRecord = s.dataset.parties.find(item => item.id === partyId);
  return createGameState({
    seedText: `${player?.displayName}|${player?.birthDate}|${s.career.startedAt}|${s.career.initialLevel}`,
    currentDate: s.clock.currentDate, level: s.career.initialLevel,
    party: partyId ? { id: partyId, label: partyLabel ?? partyRecord?.officialName ?? partyRecord?.name ?? null, founder: founder ?? partyRecord?.source === DATA_SOURCES.USER } : null,
    place: placeOf(s),
    stats: statsOf(s), parliament: s.parliament, funds, difficulty: s.career.difficulty ?? 'normale', localCalendar: localCalendarFor(s), start: s.career.start ?? null
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
// Ids (as the polls know them) of the forces that stood at the last general election: the starting point of the roster of the next one.
let precedentNational = new Set();
// The real calendar of local and regional votes (local-elections.json): each comune and region votes in its year.
let localElections = null;
const localCalendarFor = s => { if (!localElections) return null; const place = homePlace(s); return localCalendarOf(localElections, { municipalityCode: place.municipalityCode, region: place.region, seed: `${place.region}|${place.municipality}`, provinceCode: place.provinceCode }); };
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
function forcesFrom({ twoPerThousand = [], parties = [], movements = [], coalitions = [], polls = [], governingIds = [], startDate = null, electoralLists = [] }) {
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
  // The forces that stood at the last general election (the lists of 2022 and the parties they bring together), as the polls know them: the roster of the next vote starts from them.
  precedentNational = new Set(electoralLists.filter(item => item.source === DATA_SOURCES.REAL && item.verified === true && item.electionId === 'election-it-politiche-2022').flatMap(item => [item.partyId, item.coalitionId, ...(item.componentPartyIds ?? [])]).filter(Boolean).map(id => realForceMap[canonical(id)] ?? canonical(id)));
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
    brandColor: item.color ?? null, regional: item.level === 'regional', regionId: item.regionId ?? null, regionalPresence: Boolean(item.regionalPresence), weight: twoPerThousandById.get(item.id)?.shareOfChoices ?? 0,
    refSource: item.source === DATA_SOURCES.REAL ? 'real' : 'user', origin: item.adminCreated ? 'admin' : 'real', reference: reference2x1000(item.id)
  }));
}
// A world is out of date when it never received the forces outside the polls, or when the database changed since.
function latentOutOfDate(world) {
  if (!world || !realLatent.length) return false;
  if (!world.latentSeeded) return true;
  const known = new Set([...world.parties.map(party => party.id), ...(world.latent ?? []).map(item => item.id)]);
  const wanted = new Set(realLatent.map(item => item.id));
  const regionOf = new Map(realLatent.map(item => [item.id, item.regionId ?? null]));
  return realLatent.some(item => !known.has(item.id)) || (world.latent ?? []).some(item => !wanted.has(item.id) || (regionOf.get(item.id) ?? null) !== (item.regionId ?? null));
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
  const normalized = normalizeGameState(raw.game) ?? buildGame(base);
  // A career made before the provincial level, in a place that has a province with organs: its next vote enters the calendar.
  const game = addProvincialCalendar(normalized, homePlace({ ...base, game: normalized }), localCalendarFor({ ...base, game: normalized }), normalized.week?.startedAt ?? base.clock?.currentDate);
  // The date never stays behind the week in progress (saves where a new career had put the real start date back).
  if (game?.week?.startedAt && base.clock?.currentDate && base.clock.currentDate < game.week.startedAt) base.clock = { ...base.clock, currentDate: game.week.startedAt };
  // Governments formed before Prime Ministers were tracked were the player's.
  if (parliament?.government && !parliament.government.formedBy) parliament.government = { ...parliament.government, formedBy: 'player', primeMinister: ['active', 'crisis'].includes(parliament.government.status) ? 'player' : null, agenda: parliament.government.agenda ?? [] };
  const world = normalizeWorld(raw.world) ?? buildWorld({ ...base, game });
  const society = normalizeSociety(raw.society) ?? buildSociety({ ...base, game });
  // The national cycle (calendar, campaign, last votes, formation of the Government) follows the career's legislature.
  let national = normalizeNationalState(raw.national, { currentDate: base.clock.currentDate, legislature: raw.national ? null : game.legislature ?? null });
  if ((game.legislature?.number ?? 19) > national.legislature.number) national = normalizeNationalState({ ...national, legislature: { ...game.legislature } }, { currentDate: base.clock.currentDate });
  // The President of the Republic: the term in office and the next election (older saves find the current term).
  const presidency = normalizePresidency(raw.presidency, { date: base.clock.currentDate, seed: seedOf({ ...base, game }) });
  return { ...base, game, world, society, national, presidency, parliament: withCapital(parliament, game) };
}

const hydratedState = hydrateState(saveLock ? null : storedState);
let state = prepareState(hydratedState);
let lastSaved = saveLock ? saveLock : storedState ? (isRestorableSave(storedState) ? 'Salvataggio caricato' : 'Salvataggio non valido: copia conservata') : 'Nuova carriera demo';
if (saveLock) { unsaved = true; saveFailure = saveLock; }
else if (isRestorableSave(storedState) && storedState.version < STATE_VERSION) {
  // The save written by the previous version is kept aside before the upgraded one replaces it: if it cannot be kept, it is not replaced (the next save tries again).
  const reason = `aggiornamento-v${storedState.version ?? 0}-v${STATE_VERSION}`;
  if (storage.backup(storedState, reason)) {
    try { storage.save(state); lastSaved = 'Salvataggio aggiornato'; } catch { lastSaved = 'Salvataggio locale non disponibile'; unsaved = true; saveFailure = lastSaved; }
  } else { pendingBackup = { payload: storedState, reason }; lastSaved = 'Salvataggio aggiornato solo in memoria: la copia di sicurezza di quello precedente non è riuscita'; unsaved = true; saveFailure = lastSaved; }
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
  if (after.game.status === 'ended' && before.game.status !== 'ended') entries.push(after.game.endKind ? { kind: 'fine', title: after.game.endReason ?? 'La carriera si chiude', detail: after.game.legacy ? `Eredità politica: ${after.game.legacy.score}/100 · ${after.game.legacy.tier.label}` : null, tone: 'neutral' } : { kind: 'fine', title: 'La carriera si chiude', detail: after.game.endReason, tone: 'bad' });
  return entries;
}
// Autosave follows the player's setting: after every action, at the end of each week, or only by hand.
// The outcome is technical (saved or not, dirty, why): nothing reads it back from the message on screen. A write that fails leaves the changes unsaved (dirty) and is tried again at the next save.
const saveOutcome = saved => ({ ok: !saveFailure, saved, dirty: unsaved, error: saveFailure });
// What changed since the last look goes on the timeline of the career: every save does it, and so does every step of an advance to a date (a long jump keeps the story of each week, not only the net change).
function recordTimeline() {
  if (timelineBase) state = addTimeline(state, timelineDiff(timelineBase, state));
  timelineBase = state;
}
function persist({ force = false } = {}) {
  recordTimeline();
  const mode = loadSettings().autosave;
  if (!force && (mode === 'manual' || (mode === 'week' && !weekClosed))) { unsaved = true; lastSaved = mode === 'manual' ? 'Modifiche non salvate' : 'Salvataggio a fine settimana'; return saveOutcome(false); }
  weekClosed = false;
  try {
    if (saveLock) throw new Error(saveLock);
    if (pendingBackup) { if (!storage.backup(pendingBackup.payload, pendingBackup.reason)) throw new Error('La copia di sicurezza del salvataggio precedente non è riuscita: non lo sovrascrivo.'); pendingBackup = null; }
    storage.save(state);
    unsaved = false; saveFailure = null; saveSeq++;
    lastSaved = `Salvato alle ${new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  } catch (error) {
    unsaved = true; weekClosed = true; saveFailure = error?.message || 'Salvataggio non disponibile';
    lastSaved = saveLock ?? 'Salvataggio non disponibile';
  }
  return saveOutcome(!saveFailure);
}
// The game about to be replaced (by another one loaded or a new career) is kept in a slot first; if it cannot be kept, nothing is replaced.
function keepCurrent(name) {
  try { return store.saveToSlot(name); }
  catch (error) { throw new Error(`La partita in corso non può essere conservata, quindi non la sostituisco. ${error.message}`); }
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
// How the player's party moved in the last four polls (points): a sudden swing in one poll is noise, a month of decline or growth is a story.
function pollTrendOf(s) {
  const shares = (s.world?.polls ?? []).slice(-5).map(poll => poll.results?.find(row => row.partyId === s.world?.playerPartyId)?.share).filter(Number.isFinite);
  return shares.length >= 5 ? Math.round((shares.at(-1) - shares[0]) * 10) / 10 : 0;
}
// The career engine sees the climate it works in: polls of the player's party and the country's mood.
// The sectors of public policy the offices held cover: a delega, a ministry, the committees of the European Parliament, the competences of an
// executive the player leads. They are the floor of the influence in each sector (standing-engine).
function standingFloorsOf(s) {
  const institutions = (s.local?.institutions ?? []).filter(item => item.status === 'active');
  const government = s.parliament?.government;
  const minister = ['active', 'crisis'].includes(government?.status) ? activeMinisters(government).find(item => item.playerAppointed) : null;
  return sectorFloors({
    delegas: institutions.filter(inst => inst.playerDelega).map(inst => ({ areas: inst.playerDelega.areas, kind: inst.playerDelega.kind })),
    euAreas: institutions.filter(inst => inst.ep?.member).flatMap(inst => committeeById(inst.ep.member)?.areas ?? []),
    headAreas: institutions.filter(inst => inst.executive?.leader === 'player').flatMap(inst => localAreas(inst.kind)),
    ministerAreas: minister ? POLICY_AREAS.filter(item => item.portfolio === minister.portfolio).map(item => item.id) : [],
    premier: isPrimeMinister(s.parliament)
  });
}
function gameEnv(s) {
  const poll = s.world?.polls?.at(-1);
  const row = poll?.results?.find(item => item.partyId === s.world?.playerPartyId);
  // The party's estimated share in every region (national share and the regional offset of the simulated polls).
  const force = s.world?.parties?.find(item => item.isPlayer);
  const regionalShares = force && row ? Object.fromEntries(Object.entries(force.regional ?? {}).map(([region, offset]) => [region, Math.max(0, row.share + offset)])) : {};
  return { career: s.career, offices: s.dataset.offices, campaign: s.campaign, player: playerOf(s), currentDate: s.clock.currentDate, institutions: s.local?.institutions ?? [], standingFloors: standingFloorsOf(s), presidency: s.presidency?.incumbent ? { kind: s.presidency.incumbent.kind, credit: s.presidency.incumbent.credit ?? 0 } : null, pollShare: row?.share ?? null, pollDelta: row?.delta ?? 0, pollTrend: pollTrendOf(s), regionalShares, mood: s.society ? societyMood(s.society) : 50, signals: worldSignalsFor(s), localRounds: s.world?.localCalendar?.rounds ?? null };
}
// Where the player lives: region, comune and the ISTAT unit (province or metropolitan city) of the comune.
function homePlace(s) {
  const player = playerOf(s);
  const comune = (s.dataset.territories ?? []).find(item => item.kind === 'comune' && item.source === DATA_SOURCES.USER) ?? null;
  return { region: player?.region ?? s.game?.place?.region ?? null, municipality: player?.municipality ?? comune?.name ?? null, municipalityCode: player?.municipalityCode ?? comune?.istatCode ?? null, provinceCode: comune?.provinceCode ?? null, provinceName: comune?.provinceName ?? player?.province ?? null, provinceType: comune?.provinceType ?? null };
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
    partyGoverning: Boolean(s.world?.parties?.find(party => party.isPlayer)?.governing), neighbours: s.world ? mergeCandidates(s.world) : [],
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
  const offices = dataset.offices.map(item => item.politicianId === playerId && !item.endDate && levels.includes(item.level) && !/inizial/i.test(item.title) ? { ...item, endDate: date } : item);
  // The office shown for the player follows the terms still open: a lost vote ends that term, not the others.
  const roleId = dataset.politicians?.find(item => item.id === playerId)?.roleId;
  const open = offices.find(item => item.id === roleId)?.endDate ? offices.filter(item => item.politicianId === playerId && !item.endDate).sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0] : null;
  return { ...dataset, offices, ...(open ? { politicians: dataset.politicians.map(item => item.id === playerId ? { ...item, roleId: open.id } : item) } : {}) };
}
// The level of a local or European career: the highest term still open (Comune, Regione, Parlamento europeo).
const LOCAL_LEVELS = Object.freeze({ comunale: 'comunale', provinciale: 'provinciale', regionale: 'regionale', europee: 'europeo' });
function localCareerLevel(offices, playerId) {
  const open = new Set(offices.filter(item => item.politicianId === playerId && !item.endDate).map(item => LOCAL_LEVELS[item.level]).filter(Boolean));
  return ['europeo', 'regionale', 'provinciale', 'comunale'].find(level => open.has(level)) ?? null;
}
// After a local or European term opens or ends (a seat in Parliament stays the reference while it lasts).
function withLocalLevel(s) {
  if (!s.career || s.career.parliamentContext) return s;
  const level = localCareerLevel(s.dataset.offices, s.career.playerId);
  return level || Object.values(LOCAL_LEVELS).includes(s.career.currentLevel) ? { ...s, career: { ...s.career, currentLevel: level } } : s;
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
    if (MEMBER_NEWS[entry.type]) return [{ type: 'chronicle', kind: 'parlamento', icon: 'dome', title: MEMBER_NEWS[entry.type], body: entry.text, tone: 'neutral' }];
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
  if (game && memories.length) { game = deepCopy(game); for (const entry of memories) { remember(game, { date: currentDate, ...entry }); if (entry.kind === 'legge' && entry.area) gainSector(game, entry.area, SECTOR_GAINS.lawApproved, { cause: entry.text }); } }
  if (game?.party?.org && programHits) game = { ...game, party: { ...game.party, org: { ...game.party.org, cohesion: Math.min(100, game.party.org.cohesion + 2 * programHits) } } };
  return withChamberRosters(currentState, withConfidenceVotes(currentState, { ...currentState, parliament, dataset, career, game, world, society, ui: { ...currentState.ui, toast } }));
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
// What the standing of the player adds to the odds of an amendment (competence in the sector of the law, a role in the group) and of a
// ministry (the institutions' trust, the image in the media, the competence in the sector of the ministry): all neutral at 50.
const lawArea = law => law?.policy?.area ?? POLICY_AREAS.find(item => item.label === law?.category)?.id ?? null;
const amendmentExtras = (s, law) => ({ committeeRole: Boolean(s.parliament?.careerStanding?.committeeRole) || heldOfficesOf(s).includes('capogruppo'), competence: competenceIn(s.game, lawArea(law)) });
const ministryExtras = (s, portfolio) => {
  const factors = standingFactors({ game: s.game, stats: statsOf(s), parliament: s.parliament });
  const areas = POLICY_AREAS.filter(item => item.portfolio === portfolio).map(item => item.id);
  return { institutional: factors.institutional, mediaRep: factors.mediaRep, competence: areas.length ? Math.max(...areas.map(area => competenceIn(s.game, area))) : 50 };
};
// An office just taken (a ministry, the premiership, a seat won in a vote) excludes some of those held: they lapse and the diary says why.
const settleOffices = gained => { const settled = lapseConflicts(state, gained, state.clock.currentDate); if (settled !== state) { state = withObjectives(settled); persist(); emit(); } return state; };
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
// ---------- the party splits, merges, changes name (what the world, the Parliament and the records do) ----------
const abbreviationOf = label => {
  const words = String(label ?? '').replace(/\(.*?\)/g, '').split(/\s+/).filter(word => word.length > 2 || /^[A-ZÀ-Ý]/.test(word));
  const initials = words.map(word => word[0]).join('').toUpperCase().slice(0, 5);
  return initials.length >= 2 ? initials : String(label ?? 'PART').slice(0, 4).toUpperCase();
};
// The record of a party founded during the career (source: user), with the identity of the one it comes from.
function userPartyRecord(s, { id, label, abbreviation = null, fromPartyId = null }) {
  const date = s.clock.currentDate;
  const parent = s.dataset.parties.find(item => item.id === fromPartyId) ?? null;
  // The programme the new party starts with is the one it inherited (the founder's); a record that has none inherits that of the party it comes from.
  const program = s.game?.party?.partyId === id && s.game.party.program?.areas?.length ? s.game.party.program.areas : Array.isArray(parent?.program) ? parent.program : [];
  return {
    id, name: label, officialName: label, abbreviation: String(abbreviation ?? abbreviationOf(label)).toUpperCase().slice(0, 6),
    description: `${label}: partito fondato durante la carriera${parent ? `, nato da ${parent.officialName ?? parent.name}` : ''}.`,
    color: parent?.color ?? '#264d82', color2: null, orientation: parent?.orientation ?? 'centro', program: [...program],
    logo: { kind: 'builder', shape: 'cerchio', symbol: 'freccia' }, politicalPosition: parent?.politicalPosition ?? 'centro', foundedAt: date, status: 'attivo',
    policyPositions: { ...(parent?.policyPositions ?? { economia: 3, welfare: 3, ambiente: 3, europa: 3 }) }, source: DATA_SOURCES.USER, createdAt: date,
    logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: `Logo di ${label}`
  };
}
// Seats follow the split: the group of the party gives a share of its seats to a new group (in both Chambers). The new
// force is in the majority or in the opposition as a whole (one draw on its id, never a fixed pattern); if leaving the
// majority would take a Chamber's majority away from the Government in office, it stays as external support.
function splitParliamentGroups(parliament, { fromPartyId, newPartyId, label, seatShare, date }) {
  if (!parliament?.chambers || !fromPartyId) return parliament;
  let next = parliament;
  const legislature = parliament.legislature?.number ?? 19;
  const joinsMajority = hashText(`${newPartyId}|maggioranza`) % 100 < 55;
  const outside = [];
  for (const chamber of ['camera', 'senato']) {
    const groups = next.chambers[chamber]?.groups ?? [];
    const source = groups.filter(group => group.partyId === fromPartyId).sort((a, b) => b.simulatedSeats - a.simulatedSeats)[0];
    if (!source) continue;
    const moved = Math.min(source.simulatedSeats - 1, Math.round(source.simulatedSeats * seatShare / 100));
    const groupId = `leg${legislature}-${chamber}-${newPartyId}`;
    if (moved < 1 || groups.some(group => group.groupId === groupId)) continue;
    const created = { groupId, officialName: label, chamber, simulatedSeats: moved, partyId: newPartyId, independent: false, component: false, splitFrom: source.groupId, position: null, axis: source.axis ?? 0, color: null, legislature, simulated: true, reference: { memberCount: moved, leaderPoliticianId: null, countAsOf: date, source: DATA_SOURCES.SIMULATION, verified: false, sourceUrl: null, sourceName: 'Composizione simulata dopo la scissione' }, source: DATA_SOURCES.SIMULATION };
    next = { ...next, chambers: { ...next.chambers, [chamber]: { ...next.chambers[chamber], groups: [...groups.map(group => group.groupId === source.groupId ? { ...group, simulatedSeats: group.simulatedSeats - moved } : group), created] } }, relations: { ...next.relations, [groupId]: { value: 55, source: DATA_SOURCES.SIMULATION } } };
    const government = next.government;
    if (government?.coalitionGroupIds?.includes(source.groupId)) {
      if (joinsMajority) next = { ...next, government: { ...government, coalitionGroupIds: [...government.coalitionGroupIds, groupId] } };
      else outside.push(groupId);
    }
  }
  const government = next.government;
  if (outside.length && government && government.status !== 'fallen') {
    const backing = new Set([...(government.coalitionGroupIds ?? []), ...(government.supportingGroupIds ?? [])]);
    const holds = ['camera', 'senato'].every(chamber => {
      const groups = next.chambers[chamber]?.groups ?? [];
      const total = groups.reduce((sum, group) => sum + (group.simulatedSeats ?? 0), 0);
      return !total || groups.filter(group => backing.has(group.groupId)).reduce((sum, group) => sum + (group.simulatedSeats ?? 0), 0) >= Math.floor(total / 2) + 1;
    });
    if (!holds) next = { ...next, government: { ...government, supportingGroupIds: [...(government.supportingGroupIds ?? []), ...outside] } };
  }
  return next;
}
function applyPartySplit(s, special) {
  const d = special.descriptor;
  let next = s;
  const date = next.clock.currentDate;
  const player = playerOf(next);
  const fromWorldId = next.world?.playerPartyId ?? null;
  const fraction = Math.max(0.03, Math.min(0.6, d.leavingShare / 100 + (special.founded ? 0.03 + playerStat(next, 'notoriety', 20) / 1500 : 0)));
  // Founding a party with no area following is a new party with no history: it starts like any new force (the world's own start), and nobody loses consensus.
  // A split moves the share of consensus the engine gives it.
  const alone = Boolean(special.founded) && !(d.leavingShare > 0);
  let record = null;
  if (special.followed) {
    record = userPartyRecord(next, { id: d.id, label: d.label, abbreviation: special.abbreviation, fromPartyId: next.career.partyId });
    next = { ...next, career: { ...next.career, partyId: d.id }, dataset: { ...next.dataset, parties: [...next.dataset.parties, record], politicians: next.dataset.politicians.map(item => item.id === player?.id ? { ...item, partyId: d.id } : item), offices: next.dataset.offices.map(item => item.politicianId === player?.id && item.level === 'partito' && !item.endDate ? { ...item, endDate: date } : item) } };
  }
  if (next.world) {
    let world = alone ? next.world : splitPlayerForce(next.world, { id: d.id, label: d.label, abbreviation: record?.abbreviation ?? null, fraction, date, asPlayer: Boolean(special.followed) });
    if (special.followed) world = setPlayerParty(world, worldPartyOf(next, record), date);
    if (special.followed && next.game?.party?.program?.areas?.length) world = setPlayerAgenda(world, next.game.party.program.areas);
    next = { ...next, world };
  }
  if (next.parliament && d.seatShare > 0) {
    let parliament = splitParliamentGroups(next.parliament, { fromPartyId: fromWorldId, newPartyId: d.id, label: d.label, seatShare: d.seatShare, date });
    if (special.followed && parliament.player?.groupId) {
      const groupId = `leg${parliament.legislature?.number ?? 19}-${parliament.player.chamber}-${d.id}`;
      try { parliament = assignPlayerGroup(parliament, groupId, date); } catch { /* the player's group had no seats to give */ }
    }
    next = computeParliamentUpdate(next, parliament, next.ui.toast);
  }
  next = addTimeline(next, [{ kind: 'partito', title: special.founded ? `Fondi ${d.label}` : special.followed ? `Segui ${d.label} nella scissione` : `Scissione: ${d.label} lascia il partito`, detail: `${d.members.toLocaleString('it-IT')} iscritti, ${d.committees.length} comitati, ${d.seatShare}% dei seggi del gruppo`, tone: special.followed ? 'good' : 'bad' }]);
  return { ...next, ui: { ...next.ui, toast: special.founded ? `Nasce ${d.label}` : special.followed ? `Guidi ${d.label}` : `${d.label} lascia il partito` } };
}
// The programme of the player's party, wherever the game keeps it: the record of a party of the user (its identity, saved with the game) and the political world
// (the agenda the polls' segments and the campaigns read for it). The programme of a real party is never written anywhere: only the player's own party has one.
function applyPartyProgram(s, { areas }) {
  let next = { ...s, dataset: { ...s.dataset, parties: s.dataset.parties.map(item => item.id === s.career.partyId && item.source === DATA_SOURCES.USER ? { ...item, program: [...areas] } : item) } };
  if (next.world) next = { ...next, world: setPlayerAgenda(next.world, areas) };
  return next;
}
function applyPartyMerge(s, special) {
  const d = special.descriptor;
  let next = s;
  const date = next.clock.currentDate;
  const ownId = next.world?.playerPartyId ?? null;
  if (next.world) next = { ...next, world: mergeIntoPlayerForce(next.world, { forceId: d.forceId, label: d.newLabel && d.newLabel !== d.previousLabel ? d.newLabel : null, date }) };
  if (next.parliament && ownId) {
    const parliament = { ...next.parliament, chambers: Object.fromEntries(Object.entries(next.parliament.chambers).map(([chamber, value]) => [chamber, { ...value, groups: (value.groups ?? []).map(group => group.partyId === d.forceId ? { ...group, partyId: ownId } : group) }])) };
    next = computeParliamentUpdate(next, parliament, next.ui.toast);
  }
  if (d.newLabel && d.newLabel !== d.previousLabel) next = { ...next, dataset: { ...next.dataset, parties: next.dataset.parties.map(item => item.id === next.career.partyId && item.source === DATA_SOURCES.USER ? { ...item, name: d.newLabel, officialName: d.newLabel, logoAlt: `Logo di ${d.newLabel}` } : item) } };
  next = addTimeline(next, [{ kind: 'partito', title: `Fusione con ${d.label}`, detail: `+${d.members.toLocaleString('it-IT')} iscritti, nuova area interna`, tone: 'neutral' }]);
  return { ...next, ui: { ...next.ui, toast: `Fusione con ${d.label}` } };
}
function applyPartyRename(s, special) {
  const d = special.descriptor;
  let next = s;
  next = { ...next, dataset: { ...next.dataset, parties: next.dataset.parties.map(item => item.id === next.career.partyId && item.source === DATA_SOURCES.USER ? { ...item, name: d.label, officialName: d.label, ...(d.abbreviation ? { abbreviation: String(d.abbreviation).toUpperCase().slice(0, 6) } : {}), logoAlt: `Logo di ${d.label}` } : item) } };
  if (next.world) next = { ...next, world: renamePlayerForce(next.world, { label: d.label, abbreviation: d.abbreviation ? String(d.abbreviation).toUpperCase().slice(0, 6) : null, shock: d.shock, renewal: d.renewal, date: next.clock.currentDate }) };
  next = addTimeline(next, [{ kind: 'partito', title: `Il partito diventa ${d.label}`, detail: `Prima: ${d.previous}`, tone: 'neutral' }]);
  return { ...next, ui: { ...next.ui, toast: `Nuovo nome: ${d.label}` } };
}
function handleSpecials(s, specials) {
  let next = s;
  for (const special of specials) {
    const player = playerOf(next);
    if (special.type === 'world-stance') {
      next = { ...next, world: applyWorldSignals(next.world, [{ type: 'stance', delta: special.delta, title: special.title }], next.clock.currentDate) };
    } else if (special.type === 'party-split') {
      next = applyPartySplit(next, special);
    } else if (special.type === 'party-merge') {
      next = applyPartyMerge(next, special);
    } else if (special.type === 'party-program') {
      next = applyPartyProgram(next, special);
    } else if (special.type === 'party-rename') {
      next = applyPartyRename(next, special);
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
        const closed = allianceWindow(next);
        if (!closed.open) throw new Error(closed.reason);
        const out = joinCoalition(next.world, special.allianceId, next.clock.currentDate, { terms: special.terms });
        next = { ...next, world: out.world };
        if (out.joined && !out.already) next = rememberFact(next, { kind: 'alleanza', text: `In coalizione con ${special.params?.partyLabel ?? next.world.parties.find(item => item.id === special.partyId)?.label ?? 'altre forze'}`, partyId: special.partyId, subject: special.partyId, weight: 1 });
      } catch (error) { next = { ...next, ui: { ...next.ui, toast: error.message } }; }
    } else if (special.type === 'world-alliance' && next.world) {
      // An offer that arrived weeks ago may no longer stand: the window of the lists, the other force, an intesa the party made in the meantime.
      const closed = allianceWindow(next);
      const block = !closed.open ? closed.reason : allianceBlock(next.world, special.partyId);
      if (block) next = { ...next, ui: { ...next.ui, toast: block } };
      else {
        next = { ...next, world: acceptAlliance(next.world, special.partyId, next.clock.currentDate) };
        next = rememberFact(next, { kind: 'alleanza', text: `Intesa con ${next.world.parties.find(item => item.id === special.partyId)?.label ?? 'un’altra forza'}`, partyId: special.partyId, subject: special.partyId, weight: 1 });
      }
    } else if (special.type === 'world-relation' && next.world) {
      next = { ...next, world: applyWorldSignals(next.world, [{ type: 'relation', partyId: special.partyId, delta: special.delta }], next.clock.currentDate) };
    } else if (special.type === 'local-office' && special.office?.title) {
      next = { ...next, dataset: openOffice(next.dataset, { id: makeId('incarico-locale'), title: special.office.title, institution: special.office.institution ?? 'Ente locale', level: special.office.level ?? 'comunale', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }) };
      // The delega (or the group lead) is real in the institution, not just a title: its powers and its reviews follow.
      next = grantLocalOffice(next, special.office);
    } else if (special.type === 'group-leader' && next.parliament?.player?.groupId && next.game) {
      next = { ...next, game: { ...next.game, flags: { ...next.game.flags, groupLeader: { groupId: next.parliament.player.groupId, since: next.clock.currentDate, source: DATA_SOURCES.SIMULATION } } } };
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
        : withLocalLevel(closeInstitution({ ...next, dataset: closeTermOffices(next.dataset, player?.id, special.electionType, next.clock.currentDate) }, INSTITUTION_OF[special.electionType], next.clock.currentDate));
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
    } else if (special.type === 'local-effect') {
      // The institution the decision is about: the one of the named kind, else the highest one the player sits in.
      const active = (next.local?.institutions ?? []).filter(item => item.status === 'active');
      const target = active.find(item => item.kind === special.local?.kind) ?? ['regione', 'provincia', 'comune'].map(kind => active.find(item => item.kind === kind)).find(Boolean);
      if (target) next = replaceInstitution(next, applyLocalEffect(target, special.local));
    } else if (special.type.startsWith('local-vote-')) {
      const choice = { 'local-vote-line': 'linea', 'local-vote-yes': 'favorevole', 'local-vote-no': 'contrario', 'local-vote-abstain': 'astenuto', 'local-vote-absent': 'assente' }[special.type];
      try { next = replaceInstitution(next, setLocalVote(findInstitution(next, special.params?.instId), special.params?.actId, choice)); } catch { /* the act was already voted */ }
    } else if (special.type === 'local-concede' || special.type === 'local-hold') {
      try {
        const inst = findInstitution(next, special.params?.instId);
        const group = inst.groups.find(item => item.id === special.params?.groupId);
        let updated = { ...inst, threatFrom: null };
        if (special.type === 'local-concede' && group && inst.executive) {
          const portfolio = inst.executive.members.find(item => item.groupId !== group.id)?.portfolio;
          if (portfolio) updated = reshuffleLocal(updated, portfolio, group.id, next.clock.currentDate);
        } else if (group) updated = { ...updated, groups: updated.groups.map(item => item.id === group.id ? { ...item, cohesion: Math.min(100, item.cohesion + 10) } : item) };
        next = replaceInstitution(next, updated);
      } catch { /* the council is no longer active */ }
    } else if (special.type.startsWith('law-vote-') && next.parliament) {
      const choice = { 'law-vote-line': 'linea', 'law-vote-yes': 'favorevole', 'law-vote-no': 'contrario', 'law-vote-abstain': 'astenuto', 'law-vote-absent': 'assente' }[special.type];
      try { next = { ...next, parliament: setPlayerVote(next.parliament, special.params?.lawId, choice) }; } catch { /* the bill is no longer on the floor of the player's Chamber */ }
    } else if (special.type === 'national-vote') {
      // The country votes without the player (national cycle): new Chambers, or the European Parliament.
      next = holdNationalVote(next, special.electionType, { date: special.date });
    } else if (special.type.startsWith('presidency-')) {
      next = presidencyDecision(next, special);
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
  if (open.some(item => /sindac|presidente di regione|presidente della provincia/i.test(item.title))) return 'locale';
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
      game = addSituationEvent(game, 'richiesta-alleato', { groupId, group: parliamentGroupName(s.parliament, groupId), demand: partner.demand.label, deadlineLabel: formatDate(partner.demand.deadline), demandType: partner.demand.type, portfolio: partner.demand.portfolio ?? null, area: partner.demand.area ?? null, dedupe: `${groupId}|${partner.demand.since}` });
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
  const out = advanceWorld(s.world, { date, week: report.week, stats: statsOf(s), deltas: report.deltas ?? {}, game: s.game, parliament: s.parliament, majorityShift, society: societySignal(s.society), playerIsLeader: secretary, playerStrategy: secretary ? s.game.party.line ?? 'autonoma' : null, nationalVoteIn, observatory: { society: observatorySociety(s.society) } });
  // Political memory weighs on consensus: old promises, ruptures, scandals or victories keep moving the polls.
  const remembered = s.game ? memoryBalance(s.game).net : 0;
  const world = Math.abs(remembered) >= 0.5 && out.world.playerPartyId ? applyWorldSignals(out.world, [{ type: 'memory', delta: round2(clampTo(remembered * 0.02, -0.25, 0.12)) }], date) : out.world;
  let next = { ...s, world };
  // What the events of the world do to the country: indicators, economy, trust (then problems, decrees, protests).
  if (next.society && out.shocks?.length) next = { ...next, society: out.shocks.reduce((society, shock) => societyShock(society, shock), next.society) };
  if (s.parliament) next = computeParliamentUpdate(next, withCapital(out.parliament, next.game), next.ui.toast);
  let game = next.game;
  // The world asks for a position only on what concerns the player's role (see addWorldReaction).
  if (out.reactions[0] && game) { const sit = situation({ game, stats: statsOf(next), parliament: next.parliament }, { ...gameEnv(next), currentDate: date }); game = addWorldReaction(game, out.reactions[0], sit); }
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
    next = tickMembers(next, weekEnd);
    const result = advanceWeek({ game: next.game, stats: statsOf(next), parliament: next.parliament ? { ...next.parliament, difficulty } : next.parliament }, { ...gameEnv(next), currentDate: weekEnd }, advanceGovernmentWeek);
    next = applyGameResult(next, result.ctx, next.ui.toast, result.specials);
    if (result.report) next = tickLegislature(next, weekEnd);
    if (result.report) next = tickLocal(next, weekEnd);
    if (result.report) next = tickRosters(next);
    if (result.report) next = tickSociety(next, weekEnd, result.report);
    if (next.world && result.report) next = tickWorld(next, weekEnd, result.report);
    if (result.report) next = tickRaces(next, weekEnd);
    if (result.report) next = tickNational(next, weekEnd);
    if (result.report) next = tickPresidency(next, weekEnd);
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
// What only the player can settle before time goes on: a campaign under way, or an urgent matter or a situation that the week about to close would settle with its default
// (the ones put on hold wait for their day, as in advanceWeek). days: how far the next step goes.
function awaitedFromPlayer(s, days) {
  if (s.campaign?.status === 'active') return { kind: 'campagna', title: 'La campagna in corso' };
  const game = s.game;
  if (!game || elapsedDays(game.week.startedAt, advanceDays(s.clock.currentDate, days)) < 7) return null;
  const closesAt = advanceDays(game.week.startedAt, 7);
  const item = game.inbox.find(entry => ['urgente', 'situazione'].includes(entry.kind) && !((entry.holdUntilWeek ?? 0) > game.week.index || (entry.holdUntilDate && entry.holdUntilDate > closesAt)));
  return item ? { kind: item.kind, title: item.title } : null;
}
const isIsoDate = value => { try { return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && advanceDays(value, 0) === value; } catch { return false; } };
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
// The window of the alliances between forces, from the calendar of the votes: once the lists of a general or European election are filed (the candidacy window
// is closed) and until the vote, intese and coalitions do not change (the filed ones are the ones that run).
function allianceWindow(s) {
  const today = s.clock.currentDate;
  const filed = (s.game?.elections ?? []).find(item => NATIONAL_TYPES.includes(item.type) && item.status !== 'held' && item.windowClosesAt && today > item.windowClosesAt && today <= item.electionDate);
  return filed ? { open: false, type: filed.type, until: filed.electionDate, reason: `Le liste per le ${filed.type === 'europee' ? 'europee' : 'politiche'} sono depositate: fino al voto del ${formatDate(filed.electionDate)} intese e coalizioni non cambiano.` } : { open: true };
}
// How much of the player's programme another force also has on its agenda: none in common is a small minus, all of the shorter list a plus.
function programOverlapWith(s, forceId) {
  const own = s.game?.party?.program?.areas ?? [];
  const theirs = s.world ? forceProfiles(s.world)[forceId]?.agenda ?? [] : [];
  return own.length && theirs.length ? own.filter(id => theirs.includes(id)).length / Math.min(own.length, theirs.length) : null;
}
function allianceContext(s, forceId) {
  const game = s.game;
  const good = memoryAbout(game, forceId, 'good');
  const bad = memoryWeight(game, item => item.kind === 'alleanza-rotta' && (item.partyId === forceId || item.subject === forceId)) + memoryAbout(game, forceId, 'bad');
  return { partySupport: game.party?.support ?? 50, influence: playerStat(s, 'influence'), memory: { good, bad }, difficulty: difficultyOf(game.difficulty).allianceChance, programOverlap: programOverlapWith(s, forceId) };
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
// ---------- the local and European institutions (local-engine) ----------
// The consiglio comunale, the consiglio regionale, the European Parliament where the player sits: built from the result
// of the vote (or, for a local career at its start, a council simulated from the local polls), then alive every week.
const INSTITUTION_OF = Object.freeze({ comunale: 'comune', provinciale: 'provincia', regionale: 'regione', europee: 'europa' });
const ELECTION_OF = Object.freeze({ comune: 'comunale', provincia: 'provinciale', regione: 'regionale', europa: 'europee' });
const EP_MAJORITY = new Set(['epp', 'sd', 'renew']);
const DEFAULT_CANDIDACY_ROLE = Object.freeze({ comunale: 'sindaco', provinciale: 'consigliere', regionale: 'presidente', politiche: 'deputato', europee: 'eurodeputato' });
const localOf = s => s.local ?? { institutions: [] };
const nextVoteOf = (s, type) => (s.game?.elections ?? []).filter(item => item.type === type && item.status === 'upcoming').map(item => item.electionDate).sort()[0] ?? null;
function withInstitution(s, inst) {
  const replaced = localOf(s).institutions.find(item => item.kind === inst.kind && item.status === 'active') ?? null;
  const others = localOf(s).institutions.map(item => item.kind === inst.kind && item.status === 'active' ? { ...item, status: 'concluso', until: inst.since, roster: null } : item);
  return seatInstitution({ ...s, local: { institutions: [...others.filter(item => item.status === 'active'), ...others.filter(item => item.status !== 'active').slice(-3), inst] } }, inst.id, replaced);
}
function closeInstitution(s, kind, date, status = 'concluso') {
  if (!localOf(s).institutions.some(item => item.kind === kind && item.status === 'active')) return s;
  const closed = pruneSeatPersons({ ...s, local: { institutions: localOf(s).institutions.map(item => item.kind === kind && item.status === 'active' ? { ...item, status, until: date, roster: null } : item) } });
  // A provincial seat is held by a mayor or a municipal councillor of the province: without the seat in the comune it lapses.
  return kind === 'comune' ? closeInstitution(closed, 'provincia', date, status) : closed;
}
// ---------- the seats with people (seat-roster) ----------
// Every seat of an assembly the game simulates (the Chambers born from a vote, the player's councils, the European Parliament) has a person: the player where he sits, a
// person the game already knows, or a person of the simulation kept in dataset.politicians (origin 'seggio'). The roster follows the groups, so a seat never stays empty and a
// person never sits twice; a person whose seat ended and whom nothing else refers to leaves the registry. Real Chambers and their parliamentarians are never touched.
const liveRosters = s => [...['camera', 'senato'].map(chamber => s.parliament?.chambers?.[chamber]?.roster), ...localOf(s).institutions.filter(item => item.status === 'active').map(item => item.roster)].filter(Boolean);
function withSeatPersons(dataset, out) {
  let politicians = dataset.politicians;
  if (out.updated.length) { const patches = new Map(out.updated.map(item => [item.id, item.patch])); politicians = politicians.map(item => patches.has(item.id) ? { ...item, ...patches.get(item.id) } : item); }
  if (out.created.length) { const known = new Set(politicians.map(item => item.id)); politicians = [...politicians, ...out.created.filter(item => !known.has(item.id))]; }
  return politicians === dataset.politicians ? dataset : { ...dataset, politicians };
}
function pruneSeatPersons(s) {
  if (!s.dataset?.politicians?.some(isSeatPerson)) return s;
  const keep = new Set([s.career?.playerId, ...liveRosters(s).flatMap(rosterPeople), ...racesOf(s).map(race => race.candidacy?.personId), ...(s.dataset.offices ?? []).map(office => office.politicianId)]);
  // The members who resigned or lost the seat keep their identity and history (the latest ones): they may be named again, never seated twice.
  for (const gone of s.dataset.politicians.filter(item => isSeatPerson(item) && item.member && !inOffice(item.member) && !keep.has(item.id)).sort((a, b) => String(b.member.until ?? '').localeCompare(String(a.member.until ?? ''))).slice(0, EX_MEMBERS_KEPT)) keep.add(gone.id);
  const politicians = s.dataset.politicians.filter(item => !isSeatPerson(item) || keep.has(item.id));
  return politicians.length === s.dataset.politicians.length ? s : { ...s, dataset: { ...s.dataset, politicians } };
}
// The persons that can take a seat of their party: the ones sent back by the assembly that closes, then the persons of the simulation the party already has.
function rosterPool(s, closing = []) {
  const known = s.dataset.politicians.filter(item => item.source === DATA_SOURCES.SIMULATION && item.partyId && !isSeatPerson(item) && item.id !== s.career.playerId && !/^persona-quadro-/.test(item.id)).map(item => ({ id: item.id, partyId: item.partyId }));
  const back = closing.flatMap(roster => rosterSeats(roster).filter(seat => seat.origin !== 'player' && seat.partyId).map(seat => ({ id: seat.personId, partyId: seat.partyId, previous: { assembly: roster.label, since: roster.date } })));
  return [...back, ...known];
}
const rosterContext = (s, assembly) => ({ busy: new Set(liveRosters(s).filter(roster => roster.assembly !== assembly).flatMap(rosterPeople)), people: new Map(s.dataset.politicians.map(item => [item.id, item])) });
// (the members who sit in a group under another party or list than its own are part of its spec: a new sync keeps them where they are)
const chamberGroupSpec = (group, roster) => { const spec = { id: group.groupId, label: group.officialName, partyId: group.partyId ?? null, seats: group.simulatedSeats ?? 0, parts: (group.components ?? []).filter(item => item.listId).map(item => ({ partyId: null, listId: item.listId, label: item.label, seats: item.seats })) }; return { ...spec, parts: partsWithGuests(roster, spec) }; };
// The Chambers born from a vote of the game: their seats follow the groups (a new legislature, a split, the player's entering or leaving).
function withChamberRosters(before, after) {
  const legislature = after.parliament?.legislature;
  if (!after.parliament?.chambers || legislature?.reference !== DATA_SOURCES.SIMULATION || !after.career?.playerId) return after;
  let next = after;
  for (const chamber of ['camera', 'senato']) {
    const current = next.parliament.chambers[chamber];
    const groups = (current?.groups ?? []).map(group => chamberGroupSpec(group, current.roster));
    if (!groups.length) continue;
    const assembly = current.id ?? `legislatura-${legislature.number ?? 0}-${chamber}`;
    const mine = next.parliament.player?.chamber === chamber && next.parliament.player.groupId ? { personId: next.parliament.player.politicianId ?? next.career.playerId, groupId: next.parliament.player.groupId, partyId: next.career.partyId ?? null } : null;
    if (rosterInSync(current.roster, groups, mine)) continue;
    const closing = before?.parliament?.chambers?.[chamber]?.roster;
    const out = syncRoster({
      assembly, kind: chamber, label: `${current.label} · ${legislature.label}`, groups, previous: current.roster ?? null, player: mine, pool: rosterPool(next, !current.roster && closing && closing.assembly !== assembly ? [closing] : []), numberFrom: !current.roster && closing && closing.assembly !== assembly ? closing.counter ?? 0 : 0, ...rosterContext(next, assembly),
      splitFrom: Object.fromEntries((current.groups ?? []).filter(group => group.splitFrom).map(group => [group.groupId, group.splitFrom])), date: legislature.since ?? next.clock.currentDate, resultId: legislature.resultId ?? null
    });
    next = { ...next, parliament: { ...next.parliament, chambers: { ...next.parliament.chambers, [chamber]: { ...current, roster: out.roster } } }, dataset: withSeatPersons(next.dataset, out) };
  }
  return next === after ? after : stampMembers(pruneSeatPersons(next));
}
// The Italian delegation of a European group: the seats the parties of the game won at the last European vote, by the group their collocazione gives them.
function europeanParts(s, inst, groupId) {
  const vote = s.national?.lastEuropee;
  if (!vote?.national?.length || (vote.date ?? '') > inst.since) return [];
  return vote.national.filter(row => row.seats > 0 && epGroupFor(s.world?.parties?.find(item => item.id === row.id)?.axis ?? 0) === groupId).map(row => ({ partyId: row.id, label: row.label, seats: row.seats }));
}
// A council (or the European Parliament) seated with people: at its creation, or later for a saved game that had none.
function seatInstitution(s, instId, replaced = null) {
  const inst = localOf(s).institutions.find(item => item.id === instId);
  if (!inst || inst.status !== 'active' || !s.career?.playerId) return s;
  const groups = inst.groups.map(group => ({ id: group.id, label: group.label, partyId: group.partyId ?? null, seats: group.seats, ...(inst.kind === 'europa' ? { parts: europeanParts(s, inst, group.id) } : {}) }));
  const mine = inst.playerGroupId && groups.some(group => group.id === inst.playerGroupId) ? { personId: s.career.playerId, groupId: inst.playerGroupId, partyId: s.career.partyId ?? null } : null;
  const executive = inst.executive;
  const leader = executive?.groupId ? { groupId: executive.groupId, player: executive.leader === 'player', label: executive.leader === 'player' ? null : executive.label } : null;
  const closing = replaced?.roster && replaced.name === inst.name ? [replaced.roster] : [];
  const out = syncRoster({
    assembly: inst.id, kind: inst.kind, label: inst.name, groups, previous: inst.roster ?? null, player: mine, pool: rosterPool(s, closing), numberFrom: replaced?.roster?.counter ?? 0, ...rosterContext(s, inst.id), date: inst.since, resultId: inst.electionId ?? null,
    place: { name: inst.name, region: inst.region ?? null, municipality: inst.kind === 'comune' ? String(inst.name).replace(/^Comune di\s+/, '') : null }, leader
  });
  const next = { ...s, dataset: withSeatPersons(s.dataset, out), local: { institutions: localOf(s).institutions.map(item => item.id === instId ? { ...item, roster: out.roster } : item) } };
  return pruneSeatPersons(next);
}
// Every week: the councils of a saved game that had no seats with people get them, and the Chambers follow their groups.
function tickRosters(s) {
  let next = s;
  for (const inst of localOf(s).institutions.filter(item => item.status === 'active' && !item.roster)) next = seatInstitution(next, inst.id);
  return withChamberRosters(next, next);
}
// ---------- the members of the simulated Chambers: each one a person with a seat that can change (seat-roster) ----------
// Group, party and list of a seat are separate things: a member changes any of them on his own (to another group with its party, to the Misto keeping the party, out of the party but not the group),
// resigns or loses the seat (the next of the list takes it a few weeks later) or goes back where he was elected. Every change moves the person in the roster and the seat in the counts of the groups
// together, so the majority, the opposition and the Government read it as they read any seat (a majority that falls goes to the verifica); the person keeps his history, the player what concerns him.
const MEMBER_RULES = LEGISLATURE_RULES.members;
const EX_MEMBERS_KEPT = 40;
const simulatedChambers = s => s.parliament?.legislature?.reference === DATA_SOURCES.SIMULATION && chambersAtWork(s.parliament) && Boolean(s.career?.playerId);
const memberGroupSpec = group => ({ id: group.groupId, partyId: group.partyId ?? null, seats: group.simulatedSeats ?? 0, axis: group.axis ?? 0, component: Boolean(group.component), independent: Boolean(group.independent), lists: (group.components ?? []).some(item => item.listId), listIds: (group.components ?? []).filter(item => item.listId).map(item => item.listId) });
// Every person on a seat of the Chambers is a member (a game saved before this, or a new vote, gives the seats persons that get their state here); who comes back in a new assembly starts a new mandate.
function stampMembers(s) {
  if (!simulatedChambers(s)) return s;
  const people = new Map(s.dataset.politicians.map(item => [item.id, item]));
  const patches = new Map();
  for (const chamber of ['camera', 'senato']) {
    const roster = s.parliament.chambers[chamber].roster;
    for (const seat of rosterSeats(roster)) {
      const person = people.get(seat.personId);
      if (!person || seat.origin === 'player' || person.source !== DATA_SOURCES.SIMULATION || (inOffice(person.member) && person.member.since >= (roster.date ?? ''))) continue;
      const fresh = newMember({ personId: person.id, date: roster.date ?? s.clock.currentDate, relation: s.parliament.relations?.[seat.groupId]?.value ?? 50, loyalty: MEMBER_RULES.loyalty });
      // (who sat in an earlier assembly and is back keeps his story, and has a new mandate)
      patches.set(person.id, { member: person.member?.history?.length ? { ...fresh, history: [...person.member.history, { date: fresh.since, type: 'rieletto', text: `${roster.label}: rieletto` }].slice(-MEMBER_HISTORY_LIMIT) } : fresh });
    }
  }
  return patches.size ? { ...s, dataset: { ...s.dataset, politicians: s.dataset.politicians.map(item => patches.has(item.id) ? { ...item, ...patches.get(item.id) } : item) } } : s;
}
// The Misto of the independents of a Chamber (made when the first member goes there).
function independentsGroup(parliament, chamber, date) {
  const groupId = `leg${parliament.legislature.number}-${chamber}-misto-indipendenti`;
  const found = parliament.chambers[chamber].groups.find(item => item.groupId === groupId);
  if (found) return { parliament, group: found };
  const group = { groupId, officialName: 'Misto – indipendenti', chamber, simulatedSeats: 0, partyId: null, independent: true, component: true, position: null, axis: 0, color: null, legislature: parliament.legislature.number, simulated: true, reference: { memberCount: 0, leaderPoliticianId: null, countAsOf: date, source: DATA_SOURCES.SIMULATION, verified: false, sourceUrl: null, sourceName: 'Composizione simulata dopo il voto' }, source: DATA_SOURCES.SIMULATION };
  return { group, parliament: { ...parliament, chambers: { ...parliament.chambers, [chamber]: { ...parliament.chambers[chamber], groups: [...parliament.chambers[chamber].groups, group] } }, relations: { ...parliament.relations, [groupId]: parliament.relations?.[groupId] ?? { value: 55, source: DATA_SOURCES.SIMULATION } } } };
}
// A party group with fewer members than the minimum for a group sits in the Misto as a political component (its seats, persons and place in the majority stay as they are).
function foldSmallGroups(parliament, chamber, date) {
  const minimum = chamber === 'camera' ? LEGISLATURE_RULES.groups.cameraWaiver : LEGISLATURE_RULES.groups.senato;
  let next = parliament;
  for (const group of parliament.chambers[chamber].groups) {
    if (group.component || group.independent || !group.partyId || group.simulatedSeats >= minimum) continue;
    const groups = next.chambers[chamber].groups.map(item => item.groupId === group.groupId ? { ...item, component: true, officialName: `Misto – ${group.officialName}` } : item);
    next = { ...next, chambers: { ...next.chambers, [chamber]: { ...next.chambers[chamber], groups } } };
    next = recordParliament(next, date, 'membro-gruppo-misto', `${group.officialName} scende a ${group.simulatedSeats} ${group.simulatedSeats === 1 ? 'componente' : 'componenti'}, sotto il minimo di ${minimum}: passa al Misto come componente politica.`, { auto: true, groupId: group.groupId, chamber, seats: group.simulatedSeats, minimum, source: DATA_SOURCES.SIMULATION });
  }
  return next;
}
// The seats of the named components of a group (the territorial lists of the Misto) follow the members who change list or leave the group.
const listLabel = (group, listId) => group.components?.find(item => item.listId === listId)?.label ?? 'un’altra lista';
function withComponentSeats(parliament, chamber, from, to) {
  const groups = parliament.chambers[chamber].groups.map(group => {
    const delta = group.groupId === from.groupId && from.listId ? [from.listId, -1] : null;
    const gain = group.groupId === to.groupId && to.listId ? [to.listId, 1] : null;
    if ((!delta && !gain) || !group.components) return group;
    return { ...group, components: group.components.map(item => item.listId && delta && item.listId === delta[0] ? { ...item, seats: Math.max(0, (item.seats ?? 0) + delta[1]) } : item.listId && gain && item.listId === gain[0] ? { ...item, seats: (item.seats ?? 0) + gain[1] } : item) };
  });
  return { ...parliament, chambers: { ...parliament.chambers, [chamber]: { ...parliament.chambers[chamber], groups } } };
}
const MEMBER_LOSS_TEXT = { dimissioni: name => `${name} si dimette: il seggio resta vacante in attesa del subentro.`, incompatibilita: name => `${name} lascia il seggio per un incarico incompatibile: si attende il subentro.`, decadenza: name => `${name} decade dal seggio: si attende il subentro.`, decesso: name => `${name} muore: il seggio resta vacante in attesa del subentro.` };
const MEMBER_LOSS_STATUS = { dimissioni: 'dimesso', incompatibilita: 'decaduto', decadenza: 'decaduto', decesso: 'deceduto' };
const MEMBER_NEWS = { 'membro-componente': 'Un parlamentare cambia componente', 'membro-gruppo': 'Cambio di gruppo in Parlamento', 'membro-misto': 'Un parlamentare passa al Misto', 'membro-partito': 'Un parlamentare lascia il suo partito', 'membro-ritorno': 'Un parlamentare torna nel suo gruppo', 'membro-perdita': 'Seggio lasciato in Parlamento', 'membro-subentro': 'Subentro in Parlamento', 'membro-gruppo-misto': 'Un gruppo passa al Misto' };
// One change of one member of a Chamber (a draw of the week, or a command): the person, the roster, the counts of the groups, the history, the memory of the player, the Government.
function applyMemberChange(s, chamber, change, date) {
  let parliament = s.parliament;
  const current = parliament.chambers[chamber];
  const person = s.dataset.politicians.find(item => item.id === change.personId);
  const from = current?.roster ? seatOf(current.roster, change.personId) : null;
  if (!inOffice(person?.member) || person.source !== DATA_SOURCES.SIMULATION || person.id === s.career.playerId || !from) return s;
  if (change.type === 'perdita' ? false : !change.to || !['defezione', 'ritorno'].includes(change.type)) return s;
  const name = person.displayName ?? 'Un parlamentare';
  const mine = parliament.player?.chamber === chamber ? parliament.player.groupId : null;
  const fromGroup = current.groups.find(group => group.groupId === from.groupId);
  let roster = current.roster, patch, text, type, toGroupId = null;
  if (change.type === 'perdita') {
    const left = leaveSeat(roster, person.id);
    roster = openVacancy(left.roster, { id: `vacante-${person.id}-${date}`, ...from, label: fromGroup?.officialName ?? null, since: date, fillAt: advanceDays(date, MEMBER_RULES.replaceAfterDays), reason: change.reason, formerPersonId: person.id });
    parliament = changeSeats(parliament, chamber, from.groupId, -1);
    if (from.listId) parliament = withComponentSeats(parliament, chamber, from, {});
    type = 'membro-perdita'; text = (MEMBER_LOSS_TEXT[change.reason] ?? MEMBER_LOSS_TEXT.dimissioni)(name);
    patch = { member: withMemberEntry(person.member, { date, type: change.reason, text, groupId: from.groupId, partyId: from.partyId }, { status: MEMBER_LOSS_STATUS[change.reason] ?? 'dimesso', until: date }) };
  } else {
    let target = change.to;
    if (target.groupId === null) { const made = independentsGroup(parliament, chamber, date); parliament = made.parliament; target = { ...target, groupId: made.group.groupId }; }
    const dest = parliament.chambers[chamber].groups.find(group => group.groupId === target.groupId);
    if (!dest || (target.groupId === from.groupId && (target.partyId ?? null) === (from.partyId ?? null) && (target.listId ?? null) === (from.listId ?? null))) return s;
    roster = moveSeat(roster, person.id, { groupId: target.groupId, partyId: target.partyId ?? null, ...(target.listId ? { listId: target.listId } : {}) });
    if (target.groupId !== from.groupId) { parliament = changeSeats(parliament, chamber, from.groupId, -1); parliament = changeSeats(parliament, chamber, target.groupId, 1); }
    // The named components of a group (its territorial lists) keep their seats in line with where the members sit.
    if ((from.listId ?? null) !== (target.listId ?? null)) parliament = withComponentSeats(parliament, chamber, from, target);
    toGroupId = target.groupId;
    const party = id => id ? s.world?.parties?.find(item => item.id === id)?.label ?? 'il partito' : null;
    if (change.type === 'ritorno') { type = 'membro-ritorno'; text = `${name} torna in ${dest.officialName}, il gruppo con cui era stato eletto.`; }
    else if (change.kind === 'component') { type = 'membro-componente'; text = `${name} passa, nel ${dest.officialName}, da ${listLabel(dest, from.listId)} a ${listLabel(dest, target.listId)}.`; }
    else if (change.kind === 'party') { type = 'membro-partito'; text = `${name} lascia ${party(from.partyId) ?? 'il partito'} ma resta nel gruppo ${dest.officialName}.`; }
    else if (change.kind === 'misto') { type = 'membro-misto'; text = `${name} lascia ${fromGroup?.officialName ?? 'il gruppo'} per ${dest.officialName}${target.partyId ? ` e resta in ${party(target.partyId)}` : ''}.`; }
    else { type = 'membro-gruppo'; text = `${name} lascia ${fromGroup?.officialName ?? 'il gruppo'} e passa a ${dest.officialName}${target.partyId ? ` (${party(target.partyId)})` : ''}.`; }
    const rel = id => parliament.relations?.[id]?.value ?? 50;
    let relation = target.groupId === from.groupId ? person.member.relation : Math.round(person.member.relation * 0.5 + rel(target.groupId) * 0.5);
    if (mine && from.groupId === mine && target.groupId !== mine) relation -= 12;
    if (mine && target.groupId === mine && from.groupId !== mine) relation += 10;
    patch = { partyId: target.partyId ?? null, member: withMemberEntry(person.member, { date, type: change.type === 'ritorno' ? 'ritorno' : `defezione-${change.kind ?? 'group'}`, text, groupId: target.groupId, partyId: target.partyId ?? null }, { since: date, electedFor: person.member.electedFor ?? from, relation: Math.max(0, Math.min(100, relation)), loyalty: Math.round((person.member.loyalty + (change.type === 'ritorno' ? 80 : 60)) / 2) }) };
  }
  parliament = { ...parliament, chambers: { ...parliament.chambers, [chamber]: { ...parliament.chambers[chamber], roster } } };
  parliament = recordParliament(parliament, date, type, text, { auto: true, personId: person.id, chamber, fromGroupId: from.groupId, toGroupId, fromPartyId: from.partyId ?? null, toPartyId: patch.partyId ?? null, reason: change.reason ?? change.kind ?? null, source: DATA_SOURCES.SIMULATION });
  parliament = foldSmallGroups(parliament, chamber, date);
  parliament = checkMajority(parliament, date, change.type === 'perdita' ? 'Con un seggio lasciato vacante' : `Dopo il passaggio di ${name}`);
  let game = s.game;
  if (game && mine && (from.groupId === mine || toGroupId === mine) && from.groupId !== toGroupId) {
    game = deepCopy(game);
    const leaving = from.groupId === mine;
    remember(game, { date, kind: leaving ? 'alleato-tradito' : 'lealta', text, subject: person.id, subjects: [mine], weight: 0.6 });
  }
  const dataset = { ...s.dataset, politicians: s.dataset.politicians.map(item => item.id === person.id ? { ...item, ...patch } : item) };
  return computeParliamentUpdate({ ...s, dataset, game }, parliament, s.ui.toast);
}
// The seats left empty are taken, after a few weeks, by the next of the list: a person of the simulation the party has, or a new one.
function fillVacancies(s, chamber, date) {
  let next = s;
  for (const vacancy of vacanciesOf(s.parliament.chambers[chamber].roster).filter(item => item.fillAt <= date)) {
    let parliament = next.parliament;
    const current = parliament.chambers[chamber];
    const group = current.groups.find(item => item.groupId === vacancy.groupId);
    // (a seat of a group that is no longer there has nobody to wait for it)
    if (!group) { next = { ...next, parliament: { ...parliament, chambers: { ...parliament.chambers, [chamber]: { ...current, roster: closeVacancy(current.roster, vacancy.id) } } } }; continue; }
    const out = fillSeat({ roster: current.roster, vacancy, pool: rosterPool(next), busy: rosterContext(next, current.roster.assembly).busy, date });
    const former = next.dataset.politicians.find(item => item.id === vacancy.formerPersonId)?.displayName ?? 'un parlamentare';
    const taken = out.created ?? next.dataset.politicians.find(item => item.id === out.personId);
    const text = `${taken?.displayName ?? 'Il nuovo eletto'} subentra a ${former} in ${group.officialName}.`;
    const member = newMember({ personId: out.personId, date, relation: parliament.relations?.[vacancy.groupId]?.value ?? 50, loyalty: MEMBER_RULES.loyalty, history: [{ date, type: 'subentro', text }] });
    const dataset = { ...next.dataset, politicians: [...next.dataset.politicians.map(item => item.id === out.personId ? { ...item, member } : item), ...(out.created ? [{ ...out.created, member }] : [])] };
    parliament = changeSeats(parliament, chamber, vacancy.groupId, 1);
    if (vacancy.listId) parliament = withComponentSeats(parliament, chamber, {}, vacancy);
    parliament = { ...parliament, chambers: { ...parliament.chambers, [chamber]: { ...parliament.chambers[chamber], roster: out.roster } } };
    parliament = recordParliament(parliament, date, 'membro-subentro', text, { auto: true, personId: out.personId, formerPersonId: vacancy.formerPersonId, chamber, toGroupId: vacancy.groupId, toPartyId: vacancy.partyId ?? null, source: DATA_SOURCES.SIMULATION });
    next = computeParliamentUpdate({ ...next, dataset }, parliament, next.ui.toast);
  }
  return next;
}
// Every week, before the Government reads the numbers: the empty seats are filled, and in each Chamber one member may change (or leave, or come back).
function tickMembers(s, date) {
  if (!simulatedChambers(s) || nationalFormationOpen(s) || date < (s.parliament.legislature.firstSitting ?? date)) return s;
  let next = stampMembers(s);
  const government = next.parliament.government;
  const pressure = government && ['crisis', 'awaiting-confidence'].includes(government.status) ? MEMBER_RULES.shaky : 1;
  for (const chamber of ['camera', 'senato']) {
    next = fillVacancies(next, chamber, date);
    const current = next.parliament.chambers[chamber];
    if (!current.roster) continue;
    const people = new Map(next.dataset.politicians.map(item => [item.id, item]));
    const change = drawMemberChange({ roster: current.roster, groups: current.groups.map(memberGroupSpec), people, rand: seededRandom(`${next.career.id ?? 'carriera'}|${date}|membri|${chamber}`), rules: MEMBER_RULES, pressure, playerId: next.career.playerId, date });
    if (change) next = applyMemberChange(next, chamber, change, date);
  }
  return next;
}
// ---------- the offices: what is granted, what lapses (office-engine says which; here the state changes) ----------
const ELECTION_OF_SCOPE = Object.freeze({ comune: 'comunale', provincia: 'provinciale', regione: 'regionale', europa: 'europee' });
// The delega or the group lead the player receives lands in the institution where it was granted.
function grantLocalOffice(s, office) {
  const kind = INSTITUTION_OF[office?.level];
  const inst = kind ? localOf(s).institutions.find(item => item.kind === kind && item.status === 'active') : null;
  if (!inst) return s;
  const title = String(office.title ?? '');
  const date = s.clock.currentDate;
  const territory = ['regione', 'provincia'].includes(inst.kind) ? s.society?.regions?.[inst.region]?.indicators ?? null : null;
  try {
    if (/^assessore/i.test(title)) return replaceInstitution(s, grantDelega(inst, { kind: 'assessore', date, territory }));
    if (/^consigliere delegato/i.test(title)) return replaceInstitution(s, grantDelega(inst, { kind: 'delegato', date, territory }));
    if (/^capogruppo/i.test(title)) return replaceInstitution(s, { ...inst, playerGroupLead: true, history: [...inst.history, { date, text: 'Sei il capogruppo: il tuo voto orienta quello del gruppo.', type: 'incarico' }].slice(-40) });
  } catch { /* the delega is already the player's */ }
  return s;
}
// An office the player leaves because the one just won excludes it: the seat in a council is closed (a comune takes the
// provincial seat with it), a delega goes back, a seat in Parliament ends.
function lapseOffice(s, office, date, why) {
  const scope = officeScope(office);
  const player = playerOf(s);
  if (['comune', 'provincia', 'regione', 'europa'].includes(scope)) {
    const inst = localOf(s).institutions.find(item => item.kind === scope && item.status === 'active');
    if (!inst) return s;
    if (office.startsWith('assessore')) return replaceInstitution(s, revokeDelega(inst, date, why));
    const closed = closeInstitution(s, scope, date);
    let dataset = closed.dataset;
    for (const kind of Object.keys(ELECTION_OF_SCOPE)) if (localOf(s).institutions.some(item => item.kind === kind && item.status === 'active') && !localOf(closed).institutions.some(item => item.kind === kind && item.status === 'active')) dataset = closeTermOffices(dataset, player?.id, ELECTION_OF_SCOPE[kind], date);
    const level = localCareerLevel(dataset.offices, player?.id);
    return { ...closed, dataset, career: closed.career.parliamentContext ? closed.career : { ...closed.career, currentLevel: level } };
  }
  if ((office === 'deputato' || office === 'senatore') && s.parliament?.player) {
    const previous = s.career.parliamentContext ?? null;
    const dataset = closeTermOffices(s.dataset, player?.id, 'politiche', date);
    const career = { ...s.career, currentLevel: localCareerLevel(dataset.offices, player?.id), parliamentContext: null, ...(previous ? { pastParliamentContexts: [...(s.career.pastParliamentContexts ?? []), { ...previous, endedAt: date, reason: why }] } : {}) };
    return computeParliamentUpdate({ ...s, dataset, career }, withCapital(leaveParliament(s.parliament, date, why), s.game), s.ui?.toast);
  }
  return s;
}
// Winning (or being appointed to) an office: those it excludes lapse, and the diary says which rule applied. The chamber change
// of a parliamentarian is the Parliament's own business, the derived offices (capogruppo, vicepremier) vanish by themselves.
function lapseConflicts(s, gained, date) {
  if (!gained || !s.game) return s;
  const parliamentSeat = gained === 'deputato' || gained === 'senatore';
  const lapsing = lapsesFor(heldOfficesOf(s).filter(id => id !== gained), gained).filter(item => !['capogruppo', 'vicepremier'].includes(item.office) && !(parliamentSeat && ['deputato', 'senatore'].includes(item.office)));
  if (!lapsing.length) return s;
  let next = s;
  for (const item of lapsing) next = lapseOffice(next, item.office, date, `${officeLabel(gained)}: ${item.rule}`);
  return { ...next, game: addDiary(next.game, { kind: 'cariche', date, title: `${officeLabel(gained)}: incompatibilità`, lines: lapsing.map(item => `Lasci ${officeLabel(item.office).toLowerCase()}: ${item.rule}`) }) };
}
// A council at the start of a local career: the lists of the local polls, the camp that leads them governs (with the
// majority bonus), the player sits with the own party (or a civic list).
// The name of the institution where the player sits: the comune, the province (or metropolitan city, or free consortium) or the region.
function institutionName(kind, place) {
  if (kind === 'comune') return `Comune di ${place.municipality ?? 'il tuo comune'}`;
  if (kind === 'provincia') return `${{ 'Città metropolitana': 'Città metropolitana di', 'Libero consorzio di comuni': 'Libero consorzio comunale di' }[place.provinceType] ?? 'Provincia di'} ${place.provinceName ?? 'la tua provincia'}`;
  return `Regione ${place.region ?? ''}`.trim();
}
function simulatedInstitution(s, kind, date) {
  const world = s.world;
  const place = homePlace(s);
  const rows = (['comune', 'provincia'].includes(kind) ? localShares(world) : regionalShares(world, place.region)).filter(row => row.share >= 2).sort((a, b) => b.share - a.share).slice(0, 6);
  const partyOf = id => world.parties.find(item => item.id === id);
  const campOf = axis => (axis ?? 0) >= 1 ? 'destra' : (axis ?? 0) <= -1 ? 'sinistra' : 'centro';
  const lean = world.localCalendar?.leans?.[place.region] ?? {};
  const camps = {};
  for (const row of rows) { const camp = campOf(partyOf(row.partyId)?.axis); camps[camp] = (camps[camp] ?? 0) + row.share + (lean[camp] ?? 0) / 3; }
  const governingCamp = Object.entries(camps).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'centro';
  const seats = kind === 'comune' ? 24 : kind === 'provincia' ? 12 : 30;
  const groups = rows.map(row => ({ id: `lista-${row.partyId}`, label: partyOf(row.partyId)?.label ?? row.partyId, partyId: row.partyId, axis: partyOf(row.partyId)?.axis ?? 0, share: row.share, side: campOf(partyOf(row.partyId)?.axis) === governingCamp ? 'maggioranza' : 'opposizione' }));
  groups.push({ id: 'lista-civica', label: 'Liste civiche', partyId: null, axis: 0, share: kind === 'provincia' ? 14 : 8, side: governingCamp === 'centro' ? 'maggioranza' : 'opposizione' });
  // Majority bonus: the governing camp holds 60% of the seats (58% in a province).
  const bySide = side => groups.filter(group => group.side === side);
  const share = list => list.reduce((sum, group) => sum + group.share, 0) || 1;
  for (const [side, total] of [['maggioranza', Math.round(seats * (kind === 'provincia' ? 0.58 : 0.6))], ['opposizione', seats - Math.round(seats * (kind === 'provincia' ? 0.58 : 0.6))]]) for (const group of bySide(side)) group.seats = Math.max(1, Math.round(total * group.share / share(bySide(side))));
  const own = s.world.playerPartyId ? groups.find(group => group.partyId === s.world.playerPartyId) : null;
  const playerGroup = own ?? groups.find(group => group.id === 'lista-civica');
  playerGroup.seats += 1;
  const leader = [...bySide('maggioranza')].sort((a, b) => b.seats - a.seats)[0];
  return createInstitution({ kind, name: institutionName(kind, place), region: place.region, territory: s.society?.regions?.[place.region]?.indicators ?? null, date, until: nextVoteOf(s, ELECTION_OF[kind]), role: 'consigliere', side: playerGroup.side, playerGroupId: playerGroup.id, leaderGroupId: leader?.id, groups: groups.map(({ share, ...group }) => group) });
}
// The European Parliament as the player sits in it: the group of the own party's collocazione, or non-attached.
function europeanInstitution(s, date, until = nextVoteOf(s, 'europee')) {
  const partyAxis = s.world?.parties?.find(item => item.isPlayer)?.axis ?? 0;
  const own = s.world?.playerPartyId ? epGroupFor(partyAxis) : 'ni';
  return createInstitution({ kind: 'europa', name: 'Parlamento europeo', date, until, role: 'eurodeputato', side: EP_MAJORITY.has(own) ? 'maggioranza' : 'opposizione', playerGroupId: own, groups: EP_GROUPS_2024.groups.map(group => ({ ...group, side: EP_MAJORITY.has(group.id) ? 'maggioranza' : 'opposizione' })) });
}
function institutionFromResult(s, campaign, result) {
  const kind = INSTITUTION_OF[campaign.electionType];
  const player = playerOf(s);
  const date = campaign.currentDate;
  const until = nextVoteOf(s, campaign.electionType);
  if (kind === 'europa') return europeanInstitution(s, date, until);
  const axisOf = partyIds => s.world?.parties?.find(item => (partyIds ?? []).includes(item.id))?.axis ?? 0;
  const rows = (result.groups ?? []).filter(row => row.seats > 0);
  const winner = result.winnerGroupId;
  const role = campaign.candidacy?.role;
  const playerRow = rows.find(row => row.id === campaign.playerCandidateId);
  const partyLabel = id => s.world?.parties?.find(item => item.id === id)?.label ?? s.dataset.parties.find(item => item.id === id)?.name ?? campaign.candidates.find(item => item.partyId === id || item.partyIds?.includes(id))?.partyLabel ?? null;
  const weightOf = id => Math.max(0.5, s.world?.parties?.find(item => item.id === id)?.baseline ?? 1);
  // The council sits by lists: the winning coalition as its party lists and the civic list of its candidate (a
  // giunta shared among allies), the others as the lists of their candidates.
  const groups = rows.flatMap(row => {
    const side = row.id === winner ? 'maggioranza' : 'opposizione';
    const parties = (row.partyIds ?? []).filter(Boolean);
    const label = parties.length ? parties.slice(0, 2).map(id => partyLabel(id) ?? row.label).join(' · ') + (parties.length > 2 ? ' e altri' : '') : row.label;
    if (side !== 'maggioranza' || row.seats < 3) return [{ id: row.id, label, partyId: parties[0] ?? null, axis: axisOf(parties), seats: row.seats, side }];
    const lists = [...parties.map(id => ({ id: `${row.id}-${id}`, partyId: id, label: partyLabel(id) ?? row.label, weight: weightOf(id) })), { id: `${row.id}-civica`, partyId: null, label: `Lista civica · ${row.label}`, weight: 0 }];
    const total = lists.reduce((sum, list) => sum + list.weight, 0);
    lists.at(-1).weight = parties.length ? total * 0.4 : 1;
    const sum = lists.reduce((acc, list) => acc + list.weight, 0);
    const exact = lists.map(list => row.seats * list.weight / sum);
    const seats = exact.map(Math.floor);
    exact.map((value, index) => [value - seats[index], index]).sort((a, b) => b[0] - a[0]).slice(0, row.seats - seats.reduce((acc, value) => acc + value, 0)).forEach(([, index]) => { seats[index] += 1; });
    return lists.map((list, index) => ({ id: list.id, label: list.label, partyId: list.partyId, axis: list.partyId ? axisOf([list.partyId]) : axisOf(parties), seats: seats[index], side })).filter(group => group.seats > 0);
  });
  const leads = ['sindaco', 'presidente'].includes(role) && playerRow?.id === winner;
  const ownParty = s.world?.playerPartyId ?? null;
  const rowGroups = row => groups.filter(group => group.id === row?.id || group.id.startsWith(`${row?.id}-`));
  const playerGroup = rowGroups(playerRow).find(group => ownParty && group.partyId === ownParty) ?? rowGroups(playerRow).sort((a, b) => b.seats - a.seats)[0] ?? null;
  const leaderGroup = leads ? playerGroup : rowGroups(rows.find(row => row.id === winner)).sort((a, b) => b.seats - a.seats)[0] ?? null;
  const site = campaign.racePlace ?? null;
  return { ...createInstitution({ kind, name: institutionName(kind, site ?? { ...homePlace(s), municipality: player?.municipality ?? homePlace(s).municipality }), region: site?.region ?? player?.region ?? null, territory: s.society?.regions?.[site?.region ?? player?.region]?.indicators ?? null, date, until, role: leads ? role : 'consigliere', side: playerRow?.id === winner ? 'maggioranza' : 'opposizione', playerGroupId: playerGroup?.id ?? null, leaderGroupId: leaderGroup?.id ?? winner, leaderIsPlayer: leads, groups }), electionId: campaign.id };
}
const INDICATOR_AREA = Object.freeze({ economia: 'economia', occupazione: 'lavoro', servizi: 'welfare', sanita: 'sanita', istruzione: 'scuola', infrastrutture: 'infrastrutture', trasporti: 'trasporti', sicurezza: 'sicurezza', ambiente: 'ambiente' });
const LOCAL_LINE_WORDS = Object.freeze({ favorevole: 'a favore', contrario: 'contro', astenuto: 'per l’astensione' });
// A career saved before the councils existed: the player is seated in the councils of the local offices still open.
function seatSavedCareer(s) {
  if (s.local || !s.world || !s.game) return s;
  const player = playerOf(s);
  const open = new Set((s.dataset?.offices ?? []).filter(item => item.politicianId === player?.id && !item.endDate).map(item => item.level));
  let next = { ...s, local: { institutions: [] } };
  for (const [level, kind] of [['comunale', 'comune'], ['provinciale', 'provincia'], ['regionale', 'regione']]) if (open.has(level)) next = withInstitution(next, simulatedInstitution(next, kind, s.clock.currentDate));
  return next;
}
function tickLocal(input, date) {
  const s = seatSavedCareer(input);
  const active = localOf(s).institutions.filter(item => item.status === 'active');
  if (!active.length || !s.game || s.game.status === 'ended') return s;
  const region = homePlace(s).region;
  const issues = (s.society?.issues ?? []).filter(issue => issue.region === region).map(issue => INDICATOR_AREA[issue.indicator]).filter(Boolean);
  let next = s;
  let game = deepCopy(s.game);
  const deltas = {};
  const add = (metric, value) => { deltas[metric] = (deltas[metric] ?? 0) + value; };
  const lines = [];
  const chronicle = [];
  for (const inst of active) {
    const rules = INSTITUTIONS[inst.kind];
    const territory = ['regione', 'provincia'].includes(inst.kind) ? next.society?.regions?.[inst.region]?.indicators ?? null : null;
    const out = advanceInstitutionWeek(inst, { date, rand: seededRandom(`${s.career.id}|${inst.id}|${date}`), issues, territory });
    let updated = out.inst;
    lines.push(...out.lines);
    // A delega keeps its sector alive week after week.
    if (updated.playerDelega) for (const area of updated.playerDelega.areas ?? []) gainSector(game, area, SECTOR_GAINS.delegaWeek / Math.max(1, updated.playerDelega.areas.length), { cause: `Delega ${updated.playerDelega.portfolio}` });
    const leads = inst.executive?.leader === 'player';
    for (const event of out.events) {
      if (event.type === 'voto-locale') {
        const against = event.against ?? event.needed - 1;
        const forecast = `${event.yes > against ? 'passa' : 'non passa'}, circa ${event.yes} sì contro ${against} no`;
        game = addSituationEvent(game, 'voto-consiglio', { instId: inst.id, actId: event.actId, actTitle: event.title, actLabel: event.label, institution: rules.label, when: formatDate(event.date), lineLabel: LOCAL_LINE_WORDS[event.line] ?? event.line, forecast, dedupe: event.actId }, Boolean(event.budget), { holdUntil: event.date });
      } else if (event.type === 'atto-votato') {
        const dissent = event.playerChoice && event.decided && event.playerChoice !== event.playerLine && event.playerChoice !== 'assente';
        if (dissent) { if (game.party) game.party.support = Math.max(0, game.party.support - 1.5); add('notoriety', 0.4); remember(game, { date, kind: 'dissenso', text: `${rules.label}: voto ${LOCAL_LINE_WORDS[event.playerChoice] ?? event.playerChoice} su “${event.title}” contro il tuo gruppo`, weight: 0.4 }); }
        if (event.sponsor?.kind === 'player' || event.delega || (leads && ['executive', 'budget'].includes(event.sponsor?.kind))) {
          // The player's act: taxes raised cost popularity, taxes cut win it; the others show an executive at work.
          const tax = event.measure?.tax;
          if (event.passed) { add('popularity', tax === 'su' ? -2 : tax === 'giu' ? 2 : event.budget ? 0.8 : 1); add('influence', 0.5); if (!tax && next.society && region) next = { ...next, society: regionAttention(next.society, region, 0.6) }; }
          else add('reputation', event.budget ? -2 : -1);
          // The influence in the sector of the act: more for the act of a delega, a little even when it fails (you tried).
          gainSector(game, event.area, event.passed ? (event.delega ? SECTOR_GAINS.delegaAct : SECTOR_GAINS.localAct) : SECTOR_GAINS.localActRejected, { cause: event.title });
          lines.push(`${rules.label}: “${event.title}” ${event.passed ? (event.organ === 'giunta' ? 'adottato dalla Giunta' : 'approvato') : 'respinto'}.`);
        } else if (inst.kind !== 'europa' && inst.playerSide !== 'maggioranza' && !event.passed && event.organ === 'consiglio' && ['executive', 'budget'].includes(event.sponsor?.kind)) {
          // The opposition beats the executive on the floor.
          add('notoriety', 0.4);
          lines.push(`${rules.label}: la giunta battuta in aula su “${event.title}”.`);
        }
        if (event.decisive) { add('notoriety', 1); lines.push(`${rules.label}: il tuo voto è decisivo su “${event.title}”.`); }
      } else if (event.type === 'effetti') {
        // The approved acts reach the territory: the region's indicators (all of a regione's act, a share of a comune's)
        // and the citizens who gain or pay, where they live.
        if (next.society && event.region) {
          next = { ...next, society: scheduleRegionalEffects(next.society, { region: event.region, indicators: event.indicators, phase: event.phase, lasting: event.lasting, cause: event.title, immediate: Boolean(event.immediate) }) };
          for (const [segment, delta] of Object.entries(event.segments ?? {})) if (Math.abs(delta) >= 0.3) next = { ...next, society: segmentAttention(next.society, segment, delta * (inst.kind === 'comune' ? 0.3 : 0.6), event.region) };
        }
      } else if (event.type === 'interrogazione-risposta') {
        if (event.player) { add('notoriety', event.answer === 'insufficiente' ? 0.6 : 0.2); if (event.answer === 'insufficiente') add('reputation', 0.4); lines.push(`${rules.label}: risposta ${event.answer} alla tua interrogazione.`); }
        else if (leads && event.answer === 'insufficiente') { add('reputation', -0.5); lines.push(`${rules.label}: la tua giunta risponde male a un’interrogazione dell’opposizione.`); }
      } else if (event.type === 'delega-valutata') {
        // The service of the delega is judged: the results are the player's own.
        if (event.verdict === 'buona') { add('reputation', 1.2); add('notoriety', 0.6); add('influence', 0.6); lines.push(`${rules.label}: la tua delega (${event.portfolio}) funziona: servizio a ${Math.round(event.score)}/100.`); remember(game, { date, kind: 'decisione', text: `${rules.label}: buona valutazione della delega ${event.portfolio}`, weight: 0.5 }); }
        else if (event.verdict === 'critica') { add('reputation', -1.4); add('popularity', -0.6); lines.push(`${rules.label}: la tua delega (${event.portfolio}) è sotto accusa: servizio a ${Math.round(event.score)}/100.`); remember(game, { date, kind: 'crisi-governo', text: `${rules.label}: delega ${event.portfolio} sotto accusa`, weight: 0.5 }); }
      } else if (event.type === 'delega-revocata') {
        add('reputation', -1.5); add('influence', -1);
        lines.push(`${rules.label}: ti viene tolta la delega ${event.portfolio}.`);
        game = addSituationEvent(game, 'delega-revocata', { instId: inst.id, institution: rules.label.toLowerCase(), portfolio: event.portfolio, dedupe: `${inst.id}|delega|${date}` }, false);
        chronicle.push({ type: 'chronicle', kind: 'territorio', icon: 'alert', title: `${inst.name}: tolta la delega ${event.portfolio}`, body: 'Il servizio non ha convinto: la delega torna all’esecutivo (simulazione).', tone: 'bad' });
      } else if (event.type === 'impegno-disatteso') {
        if (leads) { add('reputation', -1.5); lines.push(`${rules.label}: non hai dato seguito alla mozione “${event.title}”.`); }
        else if (event.player) { add('notoriety', 0.6); lines.push(`${rules.label}: la giunta ignora la tua mozione “${event.title}”.`); }
      } else if (event.type === 'impegno-rispettato') {
        if (event.player) { add('influence', 0.8); lines.push(`${rules.label}: la giunta dà seguito alla tua mozione “${event.title}”.`); }
      } else if (event.type === 'bilancio-respinto') {
        if (leads) { add('reputation', -3); remember(game, { date, kind: 'crisi-governo', text: `${rules.label}: bilancio respinto, esercizio provvisorio`, weight: 1 }); }
        lines.push(`${rules.label}: bilancio respinto, esercizio provvisorio.`);
        chronicle.push({ type: 'chronicle', kind: 'territorio', icon: 'alert', title: `${inst.name}: bilancio respinto`, body: 'Esercizio provvisorio: solo le spese obbligatorie finché il consiglio non approva il bilancio (simulazione).', tone: 'bad' });
      } else if (event.type === 'atto-ritirato') {
        if (event.player) { add('reputation', -0.3); lines.push(`${rules.label}: la tua proposta “${event.title}” è ritirata (${event.reason}).`); }
      } else if (event.type === 'seduta-deserta') {
        lines.push(`${rules.label}: manca il numero legale su “${event.title}”, seduta rinviata.`);
      } else if (event.type === 'commissione-votata') {
        if (event.rapporteur) lines.push(`Commissione ${event.committee}: la tua relazione su “${event.title}” ${event.passed ? 'passa e va in plenaria' : 'è respinta'}.`);
        else if (event.decisive) { add('notoriety', 0.5); lines.push(`Commissione ${event.committee}: il tuo voto è decisivo su “${event.title}”.`); }
      } else if (event.type === 'relazione-votata') {
        // A report of the player judged in plenary (the own-initiative ones are rewarded as the player's proposals).
        if (!event.own) { if (event.passed) { add('influence', 2); add('reputation', 1.5); add('notoriety', 1); } else { add('reputation', -1); add('notoriety', 0.3); } }
        if (event.passed) { remember(game, { date, kind: 'legge', text: `Parlamento europeo: approvata la tua relazione su “${event.title}”`, weight: 0.8 }); gainSector(game, event.area, SECTOR_GAINS.report, { cause: event.title }); }
        lines.push(`Parlamento europeo: la tua relazione “${event.title}” ${event.passed ? 'è approvata in plenaria' : 'è respinta in plenaria'}.`);
      } else if (event.type === 'uscita-maggioranza' && inst.kind !== 'europa') {
        chronicle.push({ type: 'chronicle', kind: 'territorio', icon: 'alert', title: `${inst.name}: ${event.group} lascia la maggioranza`, body: event.margin < 0 ? 'La giunta non ha più i numeri: l’opposizione prepara la sfiducia.' : 'La maggioranza si assottiglia (simulazione).', tone: 'bad' });
      } else if (event.type === 'minaccia-gruppo') {
        game = addSituationEvent(game, 'crisi-giunta', { instId: inst.id, groupId: event.groupId, group: event.group, institution: rules.label.toLowerCase(), dedupe: `${inst.id}|${event.groupId}|${date}` }, true);
      } else if (event.type === 'scioglimento') {
        const type = ELECTION_OF[inst.kind];
        game = scheduleEarlyLocalElection(game, type, date);
        const why = event.reason === 'bilancio' ? 'dopo il bilancio non approvato' : 'dopo la sfiducia';
        remember(game, { date, kind: inst.executive?.leader === 'player' ? 'crisi-governo' : 'decisione', text: `${rules.label} sciolto ${why}`, weight: inst.executive?.leader === 'player' ? 1.5 : 0.6 });
        game = addDiary(game, { kind: 'territorio', date, title: `${inst.name}: consiglio sciolto, si torna al voto`, lines: [`Elezioni anticipate: ${formatDate(game.elections.find(item => item.type === type && item.status === 'upcoming')?.electionDate ?? date)}.`], tone: 'bad' });
        next = withLocalLevel({ ...next, dataset: closeTermOffices(next.dataset, playerOf(next)?.id, type, date) });
        if (inst.executive?.leader === 'player') add('reputation', -3);
        chronicle.push({ type: 'chronicle', kind: 'territorio', icon: 'alert', title: `${inst.name}: consiglio sciolto ${why}`, body: 'Arriva un commissario; si torna al voto in anticipo (simulazione).', tone: 'bad' });
      }
    }
    // A council that is dissolved no longer sits: its seats go with it.
    next = { ...next, local: { institutions: localOf(next).institutions.map(item => item.id === inst.id ? (updated.status === 'active' ? updated : { ...updated, roster: null }) : item) } };
  }
  next = pruneSeatPersons(next);
  if (lines.length && game.lastReport) game = { ...game, lastReport: { ...game.lastReport, lines: [...game.lastReport.lines, ...lines.slice(0, 3)] } };
  next = { ...next, game };
  if (chronicle.length && next.world) next = { ...next, world: applyWorldSignals(next.world, chronicle, date) };
  const stats = statsOf(next);
  const changed = Object.fromEntries(Object.entries(deltas).filter(([, value]) => Math.abs(value) >= 0.01).map(([metric, value]) => [metric, roundStat((stats[metric] ?? 50) + value)]));
  if (Object.keys(changed).length) next = { ...next, dataset: { ...next.dataset, statistics: writeStats(next, { ...stats, ...changed }) } };
  return next;
}
// A move of the MEP: a working day and some capital; the result moves the stats, opens or closes an office of the
// committee (level europee: it ends with the European term) and can stay in the political memory.
function europeanMove(instId, key, capital, run, describe) {
  if ((state.game?.resources.politicalCapital ?? 0) < capital) throw new Error(`Servono ${capital} punti di capitale politico.`);
  findInstitution(state, instId);
  let next = withTime(1);
  const date = next.clock.currentDate;
  // Every move of the MEP draws its own chance (the count of the moves made keeps two tries from being the same).
  const moves = findInstitution(next, instId).ep?.moves ?? 0;
  const context = { state: next, influence: statsOf(next).influence ?? 30, date, rand: seededRandom(`${next.career.id}|${instId}|${key}|${date}|${moves}`) };
  const result = run(context);
  const effects = describe(result);
  next = replaceInstitution(next, { ...result.inst, ep: { ...result.inst.ep, moves: moves + 1 } });
  const game = { ...next.game, resources: { ...next.game.resources, politicalCapital: Math.max(0, next.game.resources.politicalCapital - capital) } };
  if (effects.memory) remember(game, { date, ...effects.memory });
  let dataset = next.dataset;
  const player = playerOf(next);
  const roleOffices = item => item.politicianId === player?.id && !item.endDate && item.level === 'europee' && /commissione/i.test(item.title ?? '');
  if (effects.openRole || effects.closeRole) dataset = { ...dataset, offices: dataset.offices.map(item => roleOffices(item) ? { ...item, endDate: date } : item) };
  if (effects.openRole) dataset = { ...dataset, offices: [...dataset.offices, { id: makeId('incarico-simulato'), title: effects.openRole, institution: 'Parlamento europeo', level: 'europee', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: date, endDate: null, source: DATA_SOURCES.SIMULATION }] };
  next = { ...next, dataset, game, parliament: withCapital(next.parliament, game) };
  const stats = statsOf(next);
  const changed = Object.fromEntries(Object.entries(effects.stats ?? {}).map(([metric, value]) => [metric, roundStat((stats[metric] ?? 50) + value)]));
  if (Object.keys(changed).length) next = { ...next, dataset: { ...next.dataset, statistics: writeStats(next, { ...stats, ...changed }) } };
  state = { ...next, ui: { ...next.ui, toast: effects.toast } };
  persist(); emit();
  return result;
}
const findInstitution = (s, instId) => { const inst = localOf(s).institutions.find(item => item.id === instId && item.status === 'active'); if (!inst) throw new Error('L’istituzione non è più attiva.'); return inst; };
const replaceInstitution = (s, inst) => ({ ...s, local: { institutions: localOf(s).institutions.map(item => item.id === inst.id ? inst : item) } });

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
  return { ...game, log: [{ id: uniqueId(game.log ?? [], `diario-${entry.kind}-${entry.date}-${(game.log ?? []).length}`), week: game.week.index, tone: 'neutral', lines: [], source: DATA_SOURCES.SIMULATION, ...entry }, ...(game.log ?? [])].slice(0, 40) };
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

// The votes of a list: its share of the valid ballots of the electorate of the map, or, without the map, of 100,000 normalised ballots.
const voteCount = (vote, share) => vote?.electorate?.valid ? Math.round(vote.electorate.valid * share / 100) : Math.round(share * 1000);
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
  result.groups = rows.map(item => ({ id: idOf(item.id), candidateId: item.id === forceId ? player : null, label: labelOf(item.id), percent: item.share, votes: voteCount(vote, item.share), seats: item.row?.seats ?? 0, districtSeats: item.row?.uni ?? 0, proportionalSeats: (item.row?.prop ?? 0) + (item.row?.estero ?? 0), partyIds: [item.id], coalitionId: vote.coalitions.find(coalition => coalition.partyIds.includes(item.id))?.id ?? null }));
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
    playerShare: share, playerVotes: own.votes, playerSeats: own.seats, winnerGroupId: result.groups[0]?.id ?? null, turnout: vote.turnout, electorate: vote.electorate ?? null, totalBallots: vote.electorate?.valid ?? 100000, ballotLabel: vote.electorate && !vote.electorate.normalized ? `Voti validi su ${vote.electorate.electors.toLocaleString('it-IT')} elettori (affluenza ${vote.turnout.toLocaleString('it-IT')}%)` : 'Schede normalizzate su 100.000 elettori simulati', model: vote.model, seatRule: SEAT_RULE_2022, runoffResults: null, firstRound: null,
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
  result.groups = vote.national.filter(item => item.id === forceId || item.seats || item.share >= 0.5).map(item => ({ id: idOf(item.id), candidateId: item.id === forceId ? player : null, label: item.label, percent: item.share, votes: voteCount(vote, item.share), seats: item.seats, partyIds: [item.id] }));
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
    playerShare: row.share, playerVotes: own.votes, playerSeats: row.seats, winnerGroupId: result.groups[0]?.id ?? null, turnout: vote.turnout, electorate: vote.electorate ?? null, totalBallots: vote.electorate?.valid ?? 100000, ballotLabel: vote.electorate && !vote.electorate.normalized ? `Voti validi su ${vote.electorate.electors.toLocaleString('it-IT')} elettori (affluenza ${vote.turnout.toLocaleString('it-IT')}%)` : 'Schede normalizzate su 100.000 elettori simulati', model: vote.model, seatRule: SEAT_RULE_EU, runoffResults: null, firstRound: null,
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
  // Without the forces of the political world (an empty world) the campaign keeps its own result. Forces founded by the
  // simulation alone do not make a political world: whether one is born before the vote must not change who decides.
  const origins = new Map((s.world?.parties ?? []).map(party => [party.id, party.origin]));
  if (!s.world || !voteForces(s.world).forces.some(force => origins.get(force.id) !== 'evoluzione')) {
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
      if (secretary && forces.some(force => force.isPlayer) && option) next = { ...next, game: addSituationEvent(next.game, 'coalizioni-politiche', { coalition: option.label, coalitionId: option.id, chance: `${Math.round(option.chance * 100)}%`, deadlineLabel: formatDate(politiche.windowClosesAt), dedupe: politiche.id }, true, { holdUntil: politiche.windowClosesAt }) };
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
    const presidential = presidentIsPlayer(next) ? { player: true, canDissolve: !whiteSemester(presidencyOf(next).incumbent, date, next.national?.legislature?.naturalEnd ?? null).active } : null;
    const out = formationStep({ formation, parliament: next.parliament, result, world: next.world, date, playerRole: { secretaryOf: isSecretary(next.game.party) ? next.world.playerPartyId : null, seated: Boolean(next.parliament.player?.groupId), seatsOf }, labelOf, presidential });
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

// ---------- the President of the Republic (presidency-engine) ----------
// The office above the parties: elected by the Parliament in joint session with the regional delegates, a seven-year term,
// incompatible with every other office. The engine plays the election; here its consequences reach the career, the
// Government, the Parliament and the world, and the player's decisions as elector, leader, candidate or President.
const presidencyOf = s => normalizePresidency(s.presidency, { date: s.clock.currentDate, seed: seedOf(s) });
const presidentIsPlayer = s => s.presidency?.incumbent?.kind === 'giocatore';
const shortName = label => String(label ?? '').replace(/\s*\(figura simulata\)$/, '').replace(/\s*\(tu\)$/, ' (tu)');
const weeksTo = (from, to) => Math.max(0, Math.ceil((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 604800000));
// The regional council can send the player to the joint session: the President of the Region always goes, a councillor
// by chance (drawn from the career's own seed, the same at every reading).
function presidentialDelegate(s, number) {
  const regional = (s.local?.institutions ?? []).find(item => item.kind === 'regione' && item.status === 'active');
  if (!regional) return null;
  const leads = regional.executive?.leader === 'player';
  if (!leads && seededRandom(`${s.career.id}|delegato|${number}`)() >= 0.35) return null;
  return { region: regional.region ?? homePlace(s).region, side: leads || regional.playerSide === 'maggioranza' ? 'maggioranza' : 'minoranza' };
}
// What the player is in this election: elector (a seat), regional delegate, leader of a force (its secretary), none.
function presidentialRole(s, number, assembly = null, delegate = null) {
  const game = s.game;
  const parliament = linkGroupsToParties(s.parliament, s.world) ?? s.parliament;
  const seat = parliament?.player?.groupId ? parliament.player : null;
  const group = seat ? ['camera', 'senato'].flatMap(chamber => parliament.chambers?.[chamber]?.groups ?? []).find(item => item.groupId === seat.groupId) : null;
  const ownParty = s.world?.playerPartyId ?? null;
  const partyBloc = ownParty && (!assembly || assembly.blocs.some(bloc => bloc.id === ownParty)) ? ownParty : null;
  const leader = Boolean(game?.party && isSecretary(game.party) && partyBloc);
  const blocId = leader ? partyBloc : seat ? (group?.partyId ?? 'misto') : delegate ? (partyBloc ?? 'misto') : null;
  return { elector: Boolean(seat), delegate: Boolean(delegate), leader, blocId, seat: Boolean(seat) };
}
// How the player stands as a candidate (prestige, breadth, partisanship): from the statistics, the offices and the past.
function presidentialStanding(s, presidency) {
  const government = s.parliament?.government;
  const incumbent = presidency.incumbent.kind === 'giocatore';
  const roles = {
    secretary: isSecretary(s.game.party), rank: s.game.party?.rank ?? 0, independent: !s.game.party, parliamentary: Boolean(s.parliament?.player?.groupId),
    minister: ['active', 'crisis'].includes(government?.status) && activeMinisters(government).some(item => item.playerAppointed), premier: isPrimeMinister(s.parliament),
    formerPremier: (s.parliament?.pastGovernments ?? []).some(item => item.primeMinister === 'player'), exPresident: Boolean(s.game.flags?.exPresident),
    regionalPresident: (s.local?.institutions ?? []).some(item => item.kind === 'regione' && item.executive?.leader === 'player'), memoryBad: memoryBalance(s.game).bad
  };
  return playerStanding({ stats: statsOf(s), roles, credit: incumbent ? presidency.incumbent.credit : null, incumbent });
}
export const presidentialEligibilityOf = s => presidentialEligibility({ birthDate: playerOf(s)?.birthDate, date: s.clock.currentDate });

// The election is put off while the Chambers are dissolved or about to end (art. 85): it takes place within fifteen days
// of the meeting of the new ones. Returns the reason, or null.
function presidentialPostponement(s, date) {
  const politics = (s.game.elections ?? []).find(item => item.type === 'politiche' && item.status !== 'held');
  const end = s.national?.legislature?.naturalEnd ?? null;
  if (politics?.early && ['upcoming', 'open', 'running', 'missed'].includes(politics.status)) return 'Le Camere sono state sciolte: si vota dopo l’insediamento delle nuove.';
  if (politics && ['open', 'running'].includes(politics.status)) return 'Siamo in campagna per le politiche: si vota dopo l’insediamento delle nuove Camere.';
  if (end && end >= date && advanceDays(date, PRESIDENCY_RULES.chambersEndingDays) >= end) return 'Le Camere scadono entro tre mesi: si vota dopo l’insediamento delle nuove.';
  const formation = s.national?.formation;
  if (formation?.firstSitting && formation.phase === 'insediamento' && date < advanceDays(formation.firstSitting, PRESIDENCY_RULES.afterNewChambersDays)) return 'Le nuove Camere non si sono ancora riunite.';
  return null;
}
const raisePresidential = (game, id, params, { urgent = false, holdUntil = null } = {}) => addSituationEvent(game, id, { ...params, dedupe: `${params.dedupe ?? id}|${game.week.index}` }, urgent, holdUntil ? { holdUntil } : {});
// A move made by hand answers the decision waiting in the agenda: it is not asked again (nor decided by default).
const withoutPresidentialAsks = (game, ids) => ({ ...game, inbox: game.inbox.filter(item => !ids.includes(item.templateId)) });
const candidateName = election => id => shortName(election.candidates.find(item => item.id === id)?.label ?? 'un candidato');

// What the player is asked about the election this week (events of the agenda): the line of the force, the own paper in
// the secret ballot, the candidacy offered, the availability for a second term.
function presidentialAgenda(s, presidency, role, { opened = false, date }) {
  let game = s.game;
  const election = presidency.election;
  if (!election || election.phase === 'conclusa') return game;
  const proj = projection(election);
  const rows = (proj?.rows ?? []).filter(row => !election.candidates.find(item => item.id === row.id)?.withdrawn);
  const bloc = election.blocs.find(item => item.id === election.player.blocId) ?? null;
  const weeks = weeksTo(date, election.firstBallot);
  const names = rows.slice(0, 3).map(row => `${shortName(row.label)} (${row.votes})`);
  const field = names.length ? `Tra i nomi che circolano: ${names.join(', ')}.` : 'Nessun nome è ancora in campo.';
  if (opened) {
    if (presidency.incumbent.kind === 'giocatore') game = raisePresidential(game, 'quirinale-rielezione', { weeks: weeks + 1, credit: Math.round(presidency.incumbent.credit ?? 0) }, { urgent: true });
    else {
      if (role.leader && !election.player.declared) game = raisePresidential(game, 'quirinale-trattative', { weeks: Math.max(1, weeks), twoThirds: election.assembly.twoThirds, absolute: election.assembly.absolute, electors: bloc?.electors ?? 0, field }, { urgent: true });
      const eligibility = presidentialEligibility({ birthDate: playerOf(s)?.birthDate, date });
      const standing = presidentialStanding(s, presidency);
      if (eligibility.eligible && standing.prestige >= 62 && standing.breadth >= 48 && !election.player.declared && !election.player.declined && seededRandom(`${s.career.id}|offerta|${election.id}`)() < 0.6) {
        const sponsor = [...election.blocs].filter(item => !item.free).sort((a, b) => affinity(b, { ...standing, camp: bloc?.camp ?? 'centro', axis: bloc?.axis ?? 0, sponsors: [], id: 'player' }) - affinity(a, { ...standing, camp: bloc?.camp ?? 'centro', axis: bloc?.axis ?? 0, sponsors: [], id: 'player' }))[0];
        game = raisePresidential(game, 'quirinale-candidatura', { sponsor: sponsor?.label ?? 'un gruppo parlamentare', age: eligibility.age });
      }
    }
  }
  // The weeks of the ballots: the paper of the elector, the line of the leader (the votes already cast are known).
  const ballotsNext = election.phase === 'scrutini' || weeksTo(date, election.firstBallot) <= 1;
  if (ballotsNext && presidency.incumbent.kind !== 'giocatore' || ballotsNext && election.player.declared) {
    const next = election.ballots.length + 1;
    const rule = quorumFor(next, election.assembly);
    const lineNow = bloc && election.ballots.length ? lineText(bloc.line, election) : 'aspetta le indicazioni dei capigruppo';
    const top = rows.filter(row => row.id !== bloc?.line?.candidateId);
    const standingText = election.ballots.length ? `Finora ${election.ballots.length} ${election.ballots.length === 1 ? 'scrutinio' : 'scrutini'} senza un eletto.` : 'È il primo scrutinio.';
    const common = { cand1: shortName(top[0]?.label ?? rows[0]?.label ?? 'il candidato in testa'), cand1Id: top[0]?.id ?? rows[0]?.id ?? null, cand2: shortName(top[1]?.label ?? rows[1]?.label ?? 'un altro candidato'), cand2Id: top[1]?.id ?? rows[1]?.id ?? null };
    if ((role.elector || role.delegate) && !role.leader) game = raisePresidential(game, 'quirinale-scrutinio', { ...common, rule: rule.label, needed: rule.needed, total: election.assembly.total, line: lineNow, standing: standingText });
    if (role.leader && election.ballots.length) {
      const last = election.ballots.at(-1);
      game = raisePresidential(game, 'quirinale-linea', { ...common, ballots: election.ballots.length, leader: shortName(candidateName(election)(last.leaderId)), leaderVotes: last.leaderVotes, needed: rule.needed, electors: bloc?.electors ?? 0, standing: `Il tuo gruppo oggi ${lineNow}.` });
    }
    if (role.leader && !election.ballots.length) game = raisePresidential(game, 'quirinale-scrutinio', { ...common, rule: rule.label, needed: rule.needed, total: election.assembly.total, line: 'segue la tua linea', standing: standingText });
  }
  return game;
}

// ---------- the term of the President that is the player ----------
function presidentialTerm(s, presidency, date) {
  let next = s;
  const incumbent = presidency.incumbent;
  const week = s.game.week.index;
  const weekly = presidentWeek(presidency, { week });
  let updated = weekly.presidency;
  // A President the Chambers trust calms them; one that has lost credit adds friction.
  const government = next.parliament?.government;
  if (government && ['active', 'crisis'].includes(government.status) && weekly.stability) next = { ...next, parliament: { ...next.parliament, government: { ...government, stability: clampTo(Math.round(((government.stability ?? 50) + weekly.stability) * 10) / 10, 0, 100) } } };
  // The decisions only the President takes: a pardon, a decree with doubts, defence, the CSM, the message of the year.
  const rand = seededRandom(`${s.career.id}|${date}|quirinale-giorni`);
  let game = deepCopy(next.game);
  const actions = { ...(incumbent.actions ?? {}) };
  const year = Number(date.slice(0, 4));
  if (Number(date.slice(5, 7)) === 12 && Number(date.slice(8, 10)) >= 24 && actions.messageYear !== year) { game = raisePresidential(game, 'presidente-fine-anno', {}, { urgent: false }); actions.messageYear = year; }
  else if (week - (actions.dilemmaWeek ?? -99) >= 6 && rand() < 0.13) {
    const pool = ['presidente-grazia', 'presidente-difesa', 'presidente-csm', ...(government && ['active', 'crisis'].includes(government.status) ? ['presidente-decreto'] : [])];
    game = raisePresidential(game, pool[Math.floor(rand() * pool.length)], {}, { urgent: false });
    actions.dilemmaWeek = week;
  }
  updated = { ...updated, incumbent: { ...updated.incumbent, actions } };
  return { ...next, game, presidency: updated };
}

// ---------- opening, playing and closing the election ----------
function tickPresidency(input, date) {
  let s = input;
  if (!s.game || s.game.status === 'ended' || s.career.status === 'demo' || !chambersAtWork(s.parliament)) return s;
  let presidency = presidencyOf(s);
  let opened = false;
  const lines = [];
  if (presidency.incumbent.kind === 'giocatore') { s = presidentialTerm(s, presidency, date); presidency = s.presidency; }
  const schedule = presidencySchedule(presidency.incumbent);
  const number = (presidency.incumbent.number ?? 1) + 1;
  let role = { elector: false, delegate: false, leader: false, blocId: null };
  if (!presidency.election && date >= schedule.opensAt) {
    const reason = presidentialPostponement(s, date);
    if (reason) {
      if (presidency.postponed?.reason !== reason) presidency = { ...presidency, postponed: { since: date, reason }, log: [{ id: uniqueId(presidency.log, `${date}-rinvio`), date, kind: 'rinvio', text: `L’elezione del Presidente è rinviata: ${reason}` }, ...presidency.log].slice(0, 40) };
    } else {
      const delegate = presidentialDelegate(s, number);
      const world = s.world;
      const cohesion = world?.playerPartyId && s.game.party?.org ? { [world.playerPartyId]: s.game.party.org.cohesion } : {};
      const assembly = composeAssembly({ parliament: s.parliament, world, seed: `${presidency.seed}|${number}`, cohesion, playerPartyId: world?.playerPartyId ?? null, playerDelegate: delegate });
      role = presidentialRole(s, number, assembly, delegate);
      const delayed = Boolean(presidency.postponed);
      const result = openPresidentialElection(presidency, { date, assembly, player: role, reason: delayed ? presidency.postponed.reason : null, firstBallot: delayed ? advanceDays(date, 14) : null });
      presidency = { ...result.presidency, postponed: null };
      lines.push(...result.lines);
      opened = true;
      if (s.world) s = { ...s, world: applyWorldSignals(s.world, [{ type: 'chronicle', kind: 'governo', icon: 'dome', title: 'Si apre la corsa al Quirinale', body: result.lines[0], tone: 'neutral' }], date) };
    }
  }
  if (presidency.election) {
    role = presidentialRole(s, number, presidency.election.assembly ? { blocs: presidency.election.blocs } : null, presidentialDelegate(s, number));
    if (!presidency.election.player.blocId && role.blocId) presidency = { ...presidency, election: { ...presidency.election, player: { ...presidency.election.player, blocId: role.blocId, role: role.leader ? 'leader' : role.delegate ? 'delegato' : role.elector ? 'elettore' : 'osservatore' } } };
    const election = presidency.election;
    const out = advanceElection(presidency, { date });
    presidency = out.presidency;
    lines.push(...out.lines.slice(-3));
    if (presidency.election && presidency.election.player.vote) presidency = { ...presidency, election: { ...presidency.election, player: { ...presidency.election.player, voted: presidency.election.player.vote, vote: null } } };
    if (out.elected) {
      const proclaimed = proclaim(presidency, { elected: out.elected, politician: playerOf(s), date: out.elected.date });
      s = { ...s, presidency: proclaimed.presidency };
      s = concludePresidentialElection(s, proclaimed, { election: presidency.election, role, date });
      if (lines.length && s.game.lastReport) s = { ...s, game: { ...s.game, lastReport: { ...s.game.lastReport, lines: [...s.game.lastReport.lines, ...lines.slice(-3)] } } };
      return s;
    }
  }
  s = { ...s, presidency };
  if (presidency.election) s = { ...s, game: presidentialAgenda(s, presidency, role, { opened, date }) };
  if (lines.length && s.game.lastReport) s = { ...s, game: { ...s.game, lastReport: { ...s.game.lastReport, lines: [...s.game.lastReport.lines, ...lines.slice(-3)] } } };
  return s;
}

// The election is over: the government feels it, the force of the player too; the player becomes President, or stops being one.
function concludePresidentialElection(input, proclaimed, { election, role, date }) {
  let s = input;
  const { candidate, isPlayer, former, incumbent } = proclaimed;
  const elected = proclaimed.presidency.last?.outcome ?? {};
  const governing = election.blocs.filter(bloc => bloc.governing);
  const governingElectors = governing.reduce((sum, bloc) => sum + bloc.electors, 0) || 1;
  const backing = governing.filter(bloc => (candidate?.sponsors ?? []).includes(bloc.id)).reduce((sum, bloc) => sum + bloc.electors, 0) / governingElectors;
  // The Government: broad agreement calms it, a President chosen against part of the majority shakes it.
  const government = s.parliament?.government;
  let note = null;
  if (government && ['active', 'crisis', 'awaiting-confidence'].includes(government.status)) {
    const broad = elected.rule === 'due-terzi';
    const delta = broad ? 3 : backing >= 0.75 ? 2 : backing < 0.5 ? -6 : 0;
    const partners = { ...(government.partners ?? {}) };
    if (backing < 0.5) for (const bloc of governing.filter(item => !(candidate?.sponsors ?? []).includes(item.id))) for (const group of ['camera', 'senato'].flatMap(chamber => s.parliament.chambers?.[chamber]?.groups ?? []).filter(item => item.partyId === bloc.partyId)) if (partners[group.groupId]) partners[group.groupId] = { ...partners[group.groupId], satisfaction: clampTo((partners[group.groupId].satisfaction ?? 60) - 5, 0, 100) };
    s = { ...s, parliament: { ...s.parliament, government: { ...government, stability: clampTo((government.stability ?? 50) + delta, 0, 100), partners } } };
    note = broad ? 'Larghe intese sul Quirinale: la maggioranza ne esce più solida.' : backing < 0.5 ? 'Il Quirinale divide la maggioranza: il governo ne esce indebolito.' : backing >= 0.75 ? 'La maggioranza elegge il suo candidato.' : null;
  }
  if (s.world) s = { ...s, world: applyWorldSignals(s.world, [{ type: 'chronicle', kind: 'governo', icon: 'dome', title: `Eletto il Presidente della Repubblica`, body: `${proclaimed.lines[0]}${note ? ` ${note}` : ''} (simulazione).`, tone: 'good' }], date) };
  s = addTimeline(s, [{ kind: 'governo', title: `Quirinale: ${shortName(candidate?.label ?? 'nuovo Presidente')} eletto al ${elected.ballot}º scrutinio`, detail: `${elected.votes} voti su ${elected.total}`, tone: 'neutral' }]);
  // What it leaves the player: the force that backed the winner gains, the one that lost its man pays.
  let game = deepCopy(s.game);
  const ownBloc = role.blocId;
  const sponsoredByOwn = Boolean(ownBloc && (candidate?.sponsors ?? []).includes(ownBloc));
  const playerCandidate = election.candidates.find(item => item.isPlayer);
  if (!isPlayer) {
    if (role.leader && sponsoredByOwn) { if (game.party) game.party.support = clampTo(game.party.support + 4, 0, 100); game.resources.politicalCapital = clampTo(game.resources.politicalCapital + 3, 0, 100); remember(game, { date, kind: 'alleanza', text: `Il candidato del tuo gruppo è eletto al Quirinale (${shortName(candidate?.label)})`, weight: 1, tone: 'good' }); }
    else if (role.leader && election.candidates.some(item => (item.sponsors ?? []).includes(ownBloc) && item.withdrawn)) { if (game.party) game.party.support = clampTo(game.party.support - 3, 0, 100); remember(game, { date, kind: 'sconfitta-elettorale', text: 'Il tuo candidato al Quirinale è stato bruciato', weight: 0.8 }); }
    if (playerCandidate && playerCandidate.id !== candidate?.id) { remember(game, { date, kind: 'sconfitta-elettorale', text: 'Candidato al Quirinale senza successo', weight: 1.2 }); game.resources.politicalCapital = clampTo(game.resources.politicalCapital - 2, 0, 100); }
    // A paper that did not follow the line of the force is secret, but not always: the suspicion has a price.
    if (election.player.voted && election.player.voted !== 'linea' && seededRandom(`${s.career.id}|sospetto|${election.id}`)() < 0.15 && game.party) { game.party.support = clampTo(game.party.support - 3, 0, 100); remember(game, { date, kind: 'dissenso', text: 'Si sospetta che tu sia stato un franco tiratore al Quirinale', weight: 0.8 }); }
    // The deals made are paid later: an ally comes to collect.
    let next = { ...s, game };
    for (const deal of election.player.deals ?? []) {
      const bloc = election.blocs.find(item => item.id === deal.blocId);
      const group = bloc?.partyId ? ['camera', 'senato'].flatMap(chamber => s.parliament.chambers?.[chamber]?.groups ?? []).find(item => item.partyId === bloc.partyId) : null;
      next = { ...next, game: scheduleFollowUp(next.game, { weeks: 8, chance: 0.8, label: `${bloc?.label ?? 'Un alleato'} chiede il conto del voto al Quirinale`, hint: `${bloc?.label ?? 'Un alleato'} potrebbe chiedere il conto del suo voto per il Quirinale`, effects: { stats: { reputation: -0.5 }, ...(group ? { groups: { [group.groupId]: -6 } } : {}), party: { support: -1 } }, memory: { kind: 'alleato-tradito', text: `${bloc?.label ?? 'Un alleato'} ti rinfaccia l’accordo sul Quirinale`, subject: bloc?.partyId ?? null, weight: 0.8 } }, 'Accordo sul Quirinale') };
    }
    s = next;
    if (former?.kind === 'giocatore') s = endPresidency(s, { date, reason: 'Il successore è stato eletto' });
  } else {
    s = { ...s, game };
    s = becomePresident(s, proclaimed, { date });
  }
  return s;
}

// ---------- incompatibility: the President holds no other office ----------
function becomePresident(input, proclaimed, { date }) {
  let s = input;
  const player = playerOf(s);
  const incumbent = proclaimed.incumbent;
  const reelected = Boolean(incumbent.reelected);
  if (reelected) {
    s = { ...s, game: { ...s.game, flags: { ...s.game.flags, president: { since: incumbent.since, termEnds: termEndOf(incumbent) } } } };
    s = addTimeline(s, [{ kind: 'incarico', title: 'Rieletto Presidente della Repubblica', detail: `${incumbent.votes} voti su ${proclaimed.record.total}`, tone: 'good' }]);
    return { ...s, ui: { ...s.ui, toast: 'Rieletto Presidente della Repubblica' } };
  }
  // Ministers and the premier resign; the seat in Parliament, the councils and the European seat end.
  let parliament = s.parliament;
  if (parliament?.government) parliament = { ...parliament, government: { ...parliament.government, ministers: parliament.government.ministers.map(item => item.playerAppointed && !item.endedAt ? { ...item, endedAt: date, endReason: 'Eletto Presidente della Repubblica' } : item), ...(parliament.government.primeMinister === 'player' && ['active', 'crisis'].includes(parliament.government.status) ? { status: 'fallen', primeMinister: null, fallenAt: date, fallenReason: 'Il Presidente del Consiglio è eletto Presidente della Repubblica' } : {}) } };
  if (parliament !== s.parliament) s = computeParliamentUpdate(s, parliament, s.ui.toast);
  s = endMandate(s, 'Eletto Presidente della Repubblica');
  for (const kind of ['comune', 'provincia', 'regione', 'europa']) s = closeInstitution(s, kind, date);
  const closing = new Set(s.dataset.offices.filter(item => item.politicianId === player?.id && !item.endDate && !/inizial/i.test(item.title)).map(item => item.id));
  s = { ...s, dataset: closeOffices(s.dataset, [...closing], date) };
  // The party is left (the force goes on without the player), the campaign in progress is withdrawn.
  if (s.game.party) {
    const left = leavePartyFor({ game: s.game, stats: statsOf(s), parliament: s.parliament }, gameEnv(s), 'Eletto Presidente della Repubblica: ogni carica di partito è incompatibile');
    s = applyGameResult(s, left.ctx, s.ui.toast, [{ type: 'party-left' }]);
  }
  if (s.campaign?.status === 'active') s = { ...s, campaign: null, game: { ...s.game, elections: s.game.elections.map(item => item.status === 'running' ? { ...item, status: 'missed', campaignId: null } : item) } };
  // The office, the flag and the memory.
  const game = deepCopy(s.game);
  game.flags = { ...game.flags, president: { since: incumbent.since, termEnds: termEndOf(incumbent) } };
  game.inbox = game.inbox.filter(item => /^(quirinale|presidente)-/.test(item.templateId ?? ''));
  game.week = { ...game.week, categoriesUsed: [] };
  remember(game, { date, kind: 'vittoria-elettorale', text: `Eletto Presidente della Repubblica al ${incumbent.ballot}º scrutinio (${incumbent.votes} voti)`, weight: 3 });
  const office = { id: `incarico-presidente-${incumbent.number}`, title: 'Presidente della Repubblica (scenario)', institution: 'Quirinale (scenario di gioco)', level: 'presidente', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: date, endDate: null };
  s = { ...s, game, dataset: openOffice(s.dataset, office) };
  s = { ...s, dataset: { ...s.dataset, politicians: s.dataset.politicians.map(item => item.id === player?.id ? { ...item, roleId: office.id } : item) }, career: { ...s.career, currentLevel: 'presidente', status: 'elected' } };
  s = addTimeline(s, [{ kind: 'incarico', title: 'Eletto Presidente della Repubblica', detail: `${incumbent.votes} voti su ${proclaimed.record.total}: lasci ogni altra carica`, tone: 'good' }]);
  return { ...s, ui: { ...s.ui, toast: 'Sei il Presidente della Repubblica: lasci ogni altra carica' } };
}
// The seven years end (a successor is elected, or the President resigns): the office closes, the former President is
// a senator for life by right (art. 59) and no longer has a party.
function endPresidency(input, { date, reason }) {
  let s = input;
  const player = playerOf(s);
  if (!s.game.flags?.president && !s.game.flags?.exPresident) return s;
  const game = deepCopy(s.game);
  const term = game.flags.president ?? {};
  game.flags = { ...game.flags, president: null, exPresident: { since: date, term, reason } };
  remember(game, { date, kind: 'decisione', text: `Finisce il tuo mandato di Presidente della Repubblica: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`, weight: 1.5 });
  s = { ...s, game, dataset: closeOffices(s.dataset, s.dataset.offices.filter(item => item.politicianId === player?.id && item.level === 'presidente' && !item.endDate).map(item => item.id), date) };
  // A seat in the Senate by right: the group of the Misto, or a group of the senators for life made for the purpose.
  let parliament = s.parliament;
  if (parliament?.chambers?.senato) {
    let group = (parliament.chambers.senato.groups ?? []).find(item => /misto/i.test(item.officialName ?? '') && !item.partyId) ?? (parliament.chambers.senato.groups ?? []).find(item => !item.partyId);
    if (!group) {
      group = { groupId: 'senato-senatori-a-vita', officialName: 'Misto – senatori a vita', chamber: 'senato', simulatedSeats: 0, partyId: null, component: true, independent: true, axis: 0, color: null, simulated: true, reference: { memberCount: 0, leaderPoliticianId: null, countAsOf: date, source: DATA_SOURCES.SIMULATION, verified: false, sourceUrl: null, sourceName: 'Senatori a vita (simulazione)' }, source: DATA_SOURCES.SIMULATION };
      parliament = { ...parliament, chambers: { ...parliament.chambers, senato: { ...parliament.chambers.senato, groups: [...parliament.chambers.senato.groups, group] } }, relations: { ...parliament.relations, [group.groupId]: { value: 60, source: DATA_SOURCES.SIMULATION } } };
    }
    parliament = enterParliament(parliament, { politicianId: player?.id ?? null, chamber: 'senato', groupId: group.groupId, territoryName: playerOf(s)?.region ?? null, currentDate: date });
    s = computeParliamentUpdate({ ...s, career: { ...s.career, currentLevel: 'senatore', parliamentContext: { mode: 'real-context', chamber: 'senato', groupId: group.groupId, territoryName: player?.region ?? null, via: 'diritto', since: date, source: DATA_SOURCES.SIMULATION } } }, withCapital(parliament, s.game), s.ui.toast);
    s = { ...s, dataset: openOffice(s.dataset, { id: makeId('incarico-senatore-a-vita'), title: 'Senatore a vita di diritto (ex Presidente della Repubblica)', institution: 'Senato della Repubblica', level: 'senatore', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: date }) };
  }
  s = addTimeline(s, [{ kind: 'incarico', title: 'Finisce il mandato da Presidente della Repubblica', detail: reason, tone: 'neutral' }]);
  return { ...s, ui: { ...s.ui, toast: 'Il mandato è finito: sei senatore a vita di diritto' } };
}

// ---------- the decisions of the agenda about the Quirinale ----------
function applyPresidentAct(input, actId, date) {
  const act = PRESIDENT_ACTS[actId];
  if (!act) return input;
  let s = input;
  const presidency = presidencyOf(s);
  s = { ...s, presidency: applyPresidentCredit(presidency, act.credit, { date, act: actId, text: act.line }) };
  const government = s.parliament?.government;
  if (government && ['active', 'crisis'].includes(government.status) && act.stability) s = { ...s, parliament: { ...s.parliament, government: { ...government, stability: clampTo((government.stability ?? 50) + act.stability, 0, 100) } } };
  if (s.society && act.mood) s = { ...s, society: mediaEvent(s.society, { outletId: 'tv-nazionale', tone: act.mood > 0 ? 1 : -0.6, intensity: Math.min(1.5, 0.6 + Math.abs(act.mood)), headline: `Il Presidente della Repubblica: ${act.label.toLowerCase()}`, date, week: s.game.week.index }) };
  const stats = statsOf(s);
  const changed = Object.fromEntries(Object.entries(act.stats ?? {}).map(([metric, value]) => [metric, roundStat((stats[metric] ?? 50) + value)]));
  if (Object.keys(changed).length) s = { ...s, dataset: { ...s.dataset, statistics: writeStats(s, { ...stats, ...changed }) } };
  if (act.memory) { const game = deepCopy(s.game); remember(game, { date, ...act.memory }); s = { ...s, game }; }
  return s;
}
function presidencyDecision(s, special) {
  const date = s.clock.currentDate;
  const type = special.type;
  const params = special.params ?? {};
  let presidency = presidencyOf(s);
  try {
    if (type.startsWith('presidency-act-')) return applyPresidentAct(s, type.slice('presidency-act-'.length), date);
    if (type.startsWith('presidency-formation-')) {
      const formation = s.national?.formation;
      const choice = type.slice('presidency-formation-'.length);
      if (!formation || ['completata', 'fallita'].includes(formation.phase)) return s;
      const semester = whiteSemester(presidency.incumbent, date, s.national?.legislature?.naturalEnd ?? null);
      const presidentChoice = choice === 'dissolve' && semester.active ? 'main' : choice === 'dissolve' ? 'dissolve' : choice;
      const text = presidentChoice === 'dissolve' ? 'Decidi di sciogliere le Camere.' : presidentChoice === 'tech' ? 'Decidi di tentare un governo del Presidente.' : presidentChoice === 'alt' ? 'Decidi di affidare l’incarico all’alternativa.' : 'Decidi di affidare l’incarico alla maggioranza più solida.';
      const incumbent = { ...presidency.incumbent, formations: (presidency.incumbent.formations ?? 0) + 1 };
      const next = { ...s, presidency: { ...presidency, incumbent }, national: nationalHistory({ ...s.national, formation: { ...formation, presidentChoice } }, date, 'consultazioni', text) };
      return choice === 'dissolve' && semester.active ? { ...next, ui: { ...next.ui, toast: 'Sei nel semestre bianco: non puoi sciogliere le Camere' } } : next;
    }
    const election = presidency.election;
    if (!election || election.phase === 'conclusa') return s;
    const rand = seededRandom(`${s.career.id}|${type}|${date}|${election.ballots.length}`);
    if (type === 'presidency-vote-linea') presidency = setPresidentialVote(presidency, 'linea');
    else if (type === 'presidency-vote-bianca') presidency = setPresidentialVote(presidency, 'bianca');
    else if (type === 'presidency-vote-c1' || type === 'presidency-vote-c2') presidency = setPresidentialVote(presidency, params[type.endsWith('c1') ? 'cand1Id' : 'cand2Id'] ?? 'linea');
    else if (type === 'presidency-line-c1' || type === 'presidency-line-c2') presidency = sponsorCandidate(presidency, { date, candidateId: params[type.endsWith('c1') ? 'cand1Id' : 'cand2Id'], rand }).presidency;
    else if (type === 'presidency-line-bianca') presidency = setPlayerLine(presidency, { kind: 'bianca' });
    // Waiting does not undo a line the player has already given to the force.
    else if (type === 'presidency-wait') { if (!election.blocs.find(item => item.id === election.player.blocId)?.playerLine) presidency = setPlayerLine(presidency, { kind: 'bianca' }); }
    else if (type === 'presidency-propose' || type === 'presidency-shared') {
      const bloc = election.blocs.find(item => item.id === election.player.blocId);
      const proj = projection(election);
      const viab = Object.fromEntries((proj?.rows ?? []).map(row => [row.id, row.viability]));
      const field = election.candidates.filter(item => !item.withdrawn && !item.isPlayer);
      const target = type === 'presidency-propose'
        ? field.filter(item => item.camp === bloc?.camp).sort((a, b) => (['bandiera', 'leader'].includes(b.type) ? 1 : 0) - (['bandiera', 'leader'].includes(a.type) ? 1 : 0) || (viab[b.id] ?? 0) - (viab[a.id] ?? 0))[0]
        : field.filter(item => item.breadth >= 60 && !item.reserve).sort((a, b) => (viab[b.id] ?? 0) - (viab[a.id] ?? 0))[0];
      if (!target) return { ...s, ui: { ...s.ui, toast: 'Nessun candidato adatto è in campo' } };
      presidency = sponsorCandidate(presidency, { date, candidateId: target.id, rand }).presidency;
    }
    else if (type === 'presidency-accept' || type === 'presidency-reelect') {
      const standing = presidentialStanding(s, presidency);
      const role = presidentialRole(s, election.number, { blocs: election.blocs }, null);
      presidency = declareCandidacy(presidency, { date, standing, label: playerOf(s)?.displayName ?? 'Il tuo nome', sponsored: role.leader || (s.game.party?.rank ?? 0) >= 4, acclaim: presidency.incumbent.kind === 'giocatore' ? Math.max(0, ((presidency.incumbent.credit ?? 0) - 50) * 0.55) : 0 });
    }
    else if (type === 'presidency-decline' || type === 'presidency-step-down') presidency = { ...presidency, election: { ...presidency.election, player: { ...presidency.election.player, declined: true } } };
    else return s;
  } catch (error) { return { ...s, ui: { ...s.ui, toast: error.message } }; }
  return { ...s, presidency };
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
    // As many weeks as it takes to reach the window (a regional vote can be up to five years away).
    const weeks = Math.ceil((Date.parse(target.windowOpensAt) - Date.parse(state.clock.currentDate)) / (7 * 86400000)) + 4;
    for (let guard = 0; !openElection(state.game, type, state.clock.currentDate) && state.game.status !== 'ended' && guard < Math.max(160, Math.min(330, weeks)); guard++) stepTime(7);
    const open = openElection(state.game, type, state.clock.currentDate);
    state = { ...state, ui: { ...state.ui, toast: open ? `Candidature aperte: ${open.label}` : state.game.status === 'ended' ? 'La carriera si è conclusa' : 'Finestra non raggiunta' } };
    persist(); emit();
    return open;
  },
  // Advances to a precise future date through the ordinary weeks (stepTime, settleWeeks): no week, event, vote or election is skipped, however far the date. It stops before
  // what only the player can settle (a campaign under way, an urgent matter, a situation) unless the staff takes over (delegate: the week closes it with its default, as it always does).
  // maxWeeks ends the call early (the state is always at the end of a week, the page goes on in pieces). reason: 'data' reached, 'decisione', 'campagna' under way, 'fine' of the career, 'continua' (maxWeeks), 'bloccato' (no progress).
  advanceToDate(target, { delegate = false, maxWeeks = Infinity } = {}) {
    if (!store.hasCareer()) throw new Error('Non c’è una partita in corso.');
    if (state.game.status === 'ended') throw new Error('La carriera è conclusa: inizia una nuova partita.');
    const from = state.clock.currentDate;
    if (!isIsoDate(target)) throw new Error('Data non valida.');
    if (target <= from) throw new Error(`La data deve essere futura: oggi è il ${formatDate(from)}.`);
    if (target > advanceDays(from, Math.round(365.25 * ADVANCE_RULES.maxYears))) throw new Error(`Si può avanzare al massimo di ${ADVANCE_RULES.maxYears} anni alla volta.`);
    // The weeks it takes, with room for the days that do not line up: a real ceiling for the loop, besides the check that every step moves the clock.
    const ceiling = Math.ceil(elapsedDays(from, target) / 7) * 2 + 8;
    let steps = 0, reason = null, waiting = null;
    for (let guard = 0; !reason; guard++) {
      const today = state.clock.currentDate;
      const days = Math.min(7, elapsedDays(today, target));
      if (!state.game || state.game.status === 'ended') reason = 'fine';
      else if (today >= target) reason = 'data';
      else if (guard >= ceiling) reason = 'bloccato';
      else if (!delegate && (waiting = awaitedFromPlayer(state, days))) reason = waiting.kind === 'campagna' ? 'campagna' : 'decisione';
      else if (steps >= maxWeeks) reason = 'continua';
      else { stepTime(days); recordTimeline(); steps++; if (state.clock.currentDate <= today) reason = 'bloccato'; }
    }
    const reached = state.clock.currentDate;
    const toast = { data: `Avanzato al ${formatDate(reached)}`, decisione: `Mi fermo prima di una decisione: ${waiting?.title}`, campagna: 'Mi fermo: c’è una campagna in corso', fine: 'La carriera si è conclusa', bloccato: 'Avanzamento interrotto: il tempo non scorre', continua: state.ui.toast }[reason];
    state = { ...state, ui: { ...state.ui, toast } };
    if (steps) persist();
    emit();
    return { reason, from, target, reached, steps, waiting };
  },
  save() {
    const outcome = persist({ force: true });
    state = { ...state, ui: { ...state.ui, toast: outcome.ok ? 'Carriera salvata' : `Salvataggio non riuscito: ${outcome.error}` } };
    emit();
    return outcome;
  },
  // One change of one member of a simulated Chamber, as the weeks draw them (defezione, perdita, ritorno): the same function the weekly step uses. Refused for the player, a real person or
  // a member who is no longer in office.
  changeMember(chamber, change) {
    if (!simulatedChambers(state)) throw new Error('Le Camere non sono ancora nate da un voto della partita.');
    const stamped = stampMembers(state);
    const next = applyMemberChange(stamped, chamber, change, state.clock.currentDate);
    if (next === stamped) throw new Error('Questo cambiamento non è possibile.');
    state = next;
    persist(); emit();
    return state;
  },
  // How saving stands, as facts: seq goes up at every write that succeeded; dirty = changes not saved here; error = why the last write failed.
  saveStatus: () => ({ seq: saveSeq, ok: !saveFailure, dirty: unsaved, error: saveFailure }),
  // What may go online: the career as it was last saved here, never a game with changes that were not saved (or a save that failed).
  cloudSnapshot: () => store.hasCareer() && !unsaved && !saveFailure ? state : null,
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
    // A game of a newer version is refused as it is: this one would have to read it down, and lose what it does not know.
    if (isFutureSave(saved)) throw new Error(`Questa partita è di una versione più recente del gioco (versione ${saved.version}, questa è la ${STATE_VERSION}): non può essere caricata qui. Aggiorna il gioco.`);
    if (store.hasCareer() && unsaved) keepCurrent('Partita precedente (salvataggio automatico)');
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
    // Everything is gone (also a save of a newer version that stopped the saving): the game saves again.
    saveLock = null; pendingBackup = null; unsaved = false; saveFailure = null;
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
  // The choices in the campaign's selects (setup, theme, territory, rival, strategy) are saved with the game: the page
  // draws them again after a redraw, a reload or a saved game is opened. No redraw here: the page already shows them.
  setCampaignPicks(picks) {
    if (!picks || typeof picks.key !== 'string' || !picks.values || typeof picks.values !== 'object') return;
    state = { ...state, ui: { ...state.ui, campaignPicks: { key: picks.key, values: { ...picks.values } } } };
    if (state.career.status !== 'demo') persist();
  },
  startCampaign(config, partyCatalog = [], realPeople = {}) {
    if (state.campaign?.status === 'active') throw new Error('Concludi o riprendi la campagna già in corso.');
    if (state.game?.status === 'ended') throw new Error('La carriera è conclusa: inizia una nuova partita.');
    // A race of the territorial round the leader chose himself for: the campaign is held where the vote is, wherever he comes from (the rooting moves the result,
    // it never blocks the candidacy). A vote of his own place opens with its own window.
    const race = config.raceId ? racesOf(state).find(item => item.id === config.raceId) ?? null : null;
    if (config.raceId && !race) throw new Error('Questa corsa non è più in calendario.');
    if (race && (race.status !== 'confirmed' || race.candidacy?.kind !== 'player')) throw new Error('Per guidare questa campagna devi essere tu il candidato: sceglilo prima in Candidatura.');
    if (race && state.clock.currentDate < race.windowOpensAt) throw new Error(`Le candidature per ${race.label} si aprono il ${formatDate(race.windowOpensAt)}.`);
    if (race && state.clock.currentDate > race.windowClosesAt) throw new Error(`Le candidature per ${race.label} sono chiuse.`);
    const raceSite = race ? racePlaceOf(race) : null;
    if (race) config = { ...config, electionType: race.level, role: race.candidacy.role ?? RACE_ROLES[race.level], objective: config.objective ?? 'seat' };
    const election = race ? { id: race.id, type: race.level, label: race.label, electionDate: race.electionDate, windowOpensAt: race.windowOpensAt, windowClosesAt: race.windowClosesAt } : openElection(state.game, config.electionType, state.clock.currentDate);
    if (!election) {
      const next = upcomingElections(state.game).find(item => item.type === config.electionType);
      throw new Error(next ? `Le candidature per ${next.label} si aprono il ${formatDate(next.windowOpensAt)}.` : 'Nessuna elezione di questo tipo in calendario.');
    }
    // The offices held decide whether the candidacy is possible (a provincial seat needs a seat in a comune, a member of the
    // Government does not run for a territorial office) and what it would cost (the offices that lapse if the vote is won).
    const blocked = candidacyBlock({ held: heldOfficesOf(state), electionType: config.electionType, role: config.role ?? DEFAULT_CANDIDACY_ROLE[config.electionType], electionDate: election.electionDate, municipalVote: nextVoteOf(state, 'comunale') });
    if (blocked) throw new Error(blocked);
    // The candidate of a race outside his territory is the same person, with the territory of the race (the areas of the campaign are those of the vote).
    const person = playerOf(state);
    const player = raceSite ? { ...person, region: raceSite.region, municipality: raceSite.municipality ?? person.municipality, province: raceSite.provinceName ?? person.province ?? null, territoryId: null } : person;
    // Sitting deputies of the real XIX legislature as opponents: only while it is the legislature in office.
    const realCandidates = config.electionType === 'politiche' && ['deputato', 'uninominale'].includes(config.role ?? 'deputato') && (state.national?.legislature?.reference ?? 'real') === 'real' ? pertinentDeputies(realPeople, player?.region, `${state.career.id}|${state.clock.currentDate}`) : [];
    // Rivals come more often from the forces that weigh more in the latest poll.
    const partyWeights = Object.fromEntries((state.world?.polls?.at(-1)?.results ?? []).map(row => [row.partyId, row.share]));
    const rooted = race ? rootingOf({ race, from: { region: homePlace(state).region, municipality: homePlace(state).municipality, municipalityCode: homePlace(state).municipalityCode, provinceCode: homePlace(state).provinceCode }, committee: raceCommittees(state, race)?.strength ?? 0, standing: Math.round(standingFactors({ game: state.game, stats: statsOf(state), parliament: state.parliament }).territorialRep) }) : null;
    const campaign = createCampaign({ career:state.career, player, statistics:state.dataset.statistics, offices:state.dataset.offices, territories:state.dataset.territories, partyCatalog:[...state.dataset.parties,...partyCatalog], currentDate:state.clock.currentDate, config:{ ...config, realCandidates, partyWeights, ...campaignContextOf(state, race ? { ...config, racePlace: raceSite } : config), ...(race ? { rooting: rooted.points, objective: config.objective ?? 'seat' } : {}) } });
    // The leader chose himself: no internal contest for the candidacy; the campaign carries the name of the race.
    if (race) { campaign.raceId = race.id; campaign.racePlace = raceSite; campaign.rooting = rooted; campaign.electionLabel = race.label; campaign.nomination = { ...campaign.nomination, status: 'approved', internalSupport: 10 }; campaign.internalCandidates = []; }
    // The career built so far shapes the starting position: preparation, funds, party standing and relationships.
    const game = state.game;
    const party = game.party;
    const leadership = relationValue(game, 'leadership') ?? 50;
    const partyBonus = party?.affiliation === 'member' ? Math.max(-3, Math.min(4, (party.support - 50) / 12 + (leadership - 50) / 18 + party.rank * 0.6)) : 0;
    // How the candidacy stands in the party also depends on the reputations of the player: the territory for a local office, the party
    // and the institutions for the lists of Parliament (promotions are never a matter of time alone).
    const candidacyKind = ['comunale', 'provinciale', 'regionale'].includes(config.electionType) ? 'locale' : 'partito';
    const candidacy = advancementOdds(candidacyKind, { factors: progressionFactors({ game, stats: statsOf(state), parliament: state.parliament }), threshold: 52, game, capital: game.resources.politicalCapital });
    const standingBonus = party?.affiliation === 'member' ? Math.max(-2, Math.min(2.2, (candidacy.score - 52) * 0.06)) : 0;
    const transfer = Math.round(game.resources.funds * 0.6);
    // The election fund (plus donors' share) and the party treasury back the candidate too.
    const fundTotal = Math.round((game.finance?.electionFund ?? 0) * 1.15);
    const org = party?.org;
    const partyFunds = org && org.treasury.balance > 0 ? Math.round(party.affiliation === 'founder' ? Math.min(org.treasury.balance * 0.3, 20000) : Math.min(org.treasury.balance * (0.02 + party.rank * 0.01), 4000 + party.rank * 1500) * Math.max(0.3, Math.min(1.3, party.support / 60))) : 0;
    const candidate = campaign.candidates.find(item => item.isPlayer);
    // The party's committees in the territory of the vote: volunteers, organisation, the candidacy and local support.
    const home = raceSite ? { region: raceSite.region, provinceCode: raceSite.provinceCode, municipality: raceSite.municipality } : homePlace(state);
    const committees = org?.committees?.length ? committeeSupport(org, { electionType: config.electionType, region: home.region, provinceCode: home.provinceCode, municipality: home.municipality, week: game.week.index, party }) : null;
    candidate.resources.money += transfer + game.prep * 30 + fundTotal + partyFunds + (committees?.funds ?? 0);
    if (committees) { candidate.resources.volunteers += committees.volunteers; candidate.resources.organization = Math.max(0, Math.min(100, candidate.resources.organization + committees.organization)); }
    candidate.resources.volunteers += Math.max(0, Math.round(game.prep / 6 + ((relationValue(game, 'civic') ?? 45) - 45) / 8)) + (hasAsset(game.finance, 'piattaforma') ? 3 : 0);
    candidate.resources.organization = Math.min(100, candidate.resources.organization + Math.round(game.prep / 5));
    // The programmes funded over the months (the player's and the party's: logistics, research, scouting, apps) pay off here.
    const programmes = { volunteers: Math.round((game.finance?.perks?.volunteers ?? 0) + (org?.perks?.campaignVolunteers ?? 0)), organization: Math.round((game.finance?.perks?.organization ?? 0) + (org?.perks?.campaignOrganization ?? 0)), selection: round2((game.finance?.perks?.selection ?? 0) + (org?.perks?.selection ?? 0)) };
    candidate.resources.volunteers += programmes.volunteers;
    candidate.resources.organization = Math.min(100, candidate.resources.organization + programmes.organization);
    campaign.resources = { ...candidate.resources, visibility: Math.max(0, campaign.resources.visibility + Math.round(((relationValue(game, 'media') ?? 45) - 45) / 5)), source: 'simulation' };
    // The volunteers are teams: how well they work depends on the committees of the territory, the programmes funded in the months before and the civic network;
    // the field team is as strong as the local network behind it.
    applyCrewProfile(campaign, { quality: clampTo(46 + (committees?.strength ?? 40) * 0.12 + programmes.volunteers * 1.2 + ((relationValue(game, 'civic') ?? 45) - 45) * 0.12 + (hasAsset(game.finance, 'piattaforma') ? 2 : 0), 25, 80), fieldEdge: committees ? (committees.strength - 45) * 0.15 + ((committees.control?.index ?? 50) - 50) * 0.05 : -2 });
    // The place on the list is a political matter: the rapport with the leadership, the local leaders who follow the player and the current in power weigh on it.
    const ruling = Boolean(party?.alignedCurrentId && party.alignedCurrentId === party.leaderCurrentId);
    campaign.listContext = { bias: party?.affiliation === 'member' ? round2(clampTo((leadership - 50) / 25 + (((committees?.control?.index) ?? 50) - 50) / 40 + (ruling ? 0.4 : -0.1), -1.5, 1.5)) : 0, territorial: campaign.listContext?.territorial ?? Math.round(standingFactors({ game, stats: statsOf(state), parliament: state.parliament }).territorialRep), aligned: ruling, leadership: Math.round(leadership), control: committees?.control?.index ?? null, source: 'simulation' };
    if (campaign.nomination.status === 'pending') { campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + partyBonus + standingBonus)); campaign.nomination.standing = { kind: candidacyKind, score: candidacy.score, chance: candidacy.chance, bonus: round2(standingBonus) }; }
    if (campaign.candidacy.role === 'uninominale') campaign.candidacy.listPosition = campaign.nomination.listPosition = null;
    else if (party?.affiliation === 'member') campaign.candidacy.listPosition = campaign.nomination.listPosition = Math.max(1, Math.min(6, 6 - party.rank - (party.support >= 70 ? 1 : 0)));
    // The founder draws up the lists of the own party and heads them.
    else if (party?.affiliation === 'founder') campaign.candidacy.listPosition = campaign.nomination.listPosition = 1;
    // Polls and allies decide how much of the party's pull the candidate starts with.
    const poll = campaignPollBonus(state.world, config.electionType, statsOf(state), game.relations, { region: raceSite?.region ?? null });
    // Citizens vote on how they feel: incumbents pay for discontent, challengers gain from it.
    const mood = state.society ? societyMood(state.society) : 50;
    const incumbent = Boolean(governingRole(state)) || Boolean(campaign.incumbency?.active && campaign.incumbency.governing);
    const moodBonus = round2(clampTo(incumbent ? (mood - 50) * 0.05 : (50 - mood) * 0.025, -1.5, 1.5));
    poll.bonus = round2(poll.bonus + moodBonus);
    // Voters remember: promises, taxes, crises and laws of past years weigh on the start of the campaign.
    const memory = memoryBalance(game, { region: ['comunale', 'provinciale', 'regionale'].includes(config.electionType) ? player?.region : null });
    const memoryBonus = round2(clampTo(memory.net * 0.35, -2.5, 1.5));
    poll.bonus = round2(poll.bonus + memoryBonus);
    // The conditions the career started with (an outsider's appeal, a consolidated name, debts to creditors that finance…).
    const startMod = startMods(game);
    // What reached goals unlocked (visibility in campaign, a stronger candidacy) works here too.
    const unlocked = objectiveMods(game);
    if (unlocked.visibility) campaign.resources = { ...campaign.resources, visibility: Math.max(0, campaign.resources.visibility + unlocked.visibility) };
    if (unlocked.nomination && campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, Math.min(10, campaign.nomination.internalSupport + unlocked.nomination)));
    if (startMod.active) {
      candidate.resources.money = Math.round(candidate.resources.money * (1 + startMod.money));
      candidate.resources.volunteers = Math.max(0, candidate.resources.volunteers + startMod.volunteers);
      campaign.resources = { ...campaign.resources, money: candidate.resources.money, volunteers: candidate.resources.volunteers, visibility: Math.max(0, campaign.resources.visibility + startMod.visibility) };
      poll.bonus = round2(poll.bonus + startMod.appeal);
      if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, Math.min(10, campaign.nomination.internalSupport + startMod.nomination)));
    }
    const selection = game.party?.org?.selections?.[election.id] ?? null;
    if (selection && campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + selection.bonus));
    if (campaign.nomination.status === 'pending' && programmes.selection) campaign.nomination.internalSupport = round2(Math.max(0, campaign.nomination.internalSupport + programmes.selection));
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
    const local = ['comunale', 'provinciale', 'regionale'].includes(config.electionType) ? state.society?.regions?.[player?.region] : null;
    campaign.context = { participation: local?.participation ?? state.society?.participation ?? null, mood, incumbent, source: 'simulation' };
    if (poll.bonus) for (const area of campaign.territories) {
      const shares = area.supportByCandidate;
      shares[campaign.playerCandidateId] = Math.max(0.5, shares[campaign.playerCandidateId] + poll.bonus);
      const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
      for (const id of Object.keys(shares)) shares[id] = round2(shares[id] * 100 / total);
    }
    // What the player may expect: the projection after polls and preparation, and the trend of the party's polls.
    setExpectation(campaign, { pollShare: poll.share ?? null });
    if (startMod.expectation) campaign.expectation.pressure = round2((campaign.expectation.pressure ?? 0) + startMod.expectation);
    const partyRow = state.world?.polls?.at(-1)?.results?.find(item => item.partyId === state.world?.playerPartyId);
    campaign.partyTrend = partyRow?.delta ?? 0;
    campaign.totalDays = Math.max(21, elapsedDays(state.clock.currentDate, election.electionDate));
    campaign.electionDate = election.electionDate;
    campaign.scheduledElectionId = election.id;
    campaign.preparation = { prep: game.prep, transfer, fund: fundTotal, partyFunds, partyBonus: round2(partyBonus), pollBonus: poll.bonus, pollShare: poll.share, allies: poll.allies, moodBonus, memory: { bonus: memoryBonus, highlights: memory.highlights.map(item => ({ text: item.text, tone: item.tone, week: item.week })) }, selection: selection ? { method: selection.method, bonus: selection.bonus } : null, committees, source: 'simulation' };
    if (programmes.volunteers || programmes.organization || programmes.selection) campaign.history.unshift({ id: `programmi-${campaign.id}`, day: 0, date: state.clock.currentDate, type: 'preparazione', text: `Programmi finanziati nei mesi scorsi: ${programmes.volunteers ? `+${programmes.volunteers} volontari` : ''}${programmes.organization ? ` · +${programmes.organization} organizzazione` : ''}${programmes.selection ? ` · peso nelle candidature +${programmes.selection}` : ''}`.replace(': ·', ':').replace(/\s+/g, ' '), source: 'simulation' });
    if (committees?.committees.length) campaign.history.unshift({ id: `comitati-${campaign.id}`, day: 0, date: state.clock.currentDate, type: 'preparazione', text: `Comitati del territorio: forza ${committees.strength}/100 · ${committees.volunteers} volontari${committees.gotv ? ` (mobilitazione +${committees.gotv})` : ''}${committees.funds ? ` · ${committees.funds.toLocaleString('it-IT')} € raccolti` : ''} · candidatura ${committees.nomination >= 0 ? '+' : ''}${committees.nomination} · consenso locale ${committees.localSupport >= 0 ? '+' : ''}${committees.localSupport}${committees.control ? ` · responsabili locali: controllo ${committees.control.index}/100 (${committees.control.byStance.tuo + committees.control.byStance['con-te']} con te, ${committees.control.byStance.distante + committees.control.byStance.contro} distanti o contro)` : ''}`, source: 'simulation' });
    if (startMod.notes.length) campaign.history.unshift({ id: `partenza-${campaign.id}`, day: 0, date: state.clock.currentDate, type: 'preparazione', text: `Condizioni di partenza: ${startMod.notes.join(' · ')}`, source: 'simulation' });
    campaign.history.unshift({ id: `preparazione-${campaign.id}`, day: 0, date: state.clock.currentDate, type: 'preparazione', text: `Preparazione ${game.prep}/100 · ${transfer} € dalla carriera${fundTotal ? ` · ${fundTotal} € dal fondo elettorale` : ''}${partyFunds ? ` · ${partyFunds} € dal partito` : ''} · sostegno interno ${partyBonus >= 0 ? '+' : ''}${round2(partyBonus)} · sondaggi ${poll.bonus >= 0 ? '+' : ''}${poll.bonus}`, source: 'simulation' });
    const nextGame = deepCopy({ ...(race ? game : markElectionRunning(game, election.id, campaign.id)), prep: 0 });
    book(nextGame, -transfer, 'campagne', `Fondi trasferiti alla campagna: ${election.label}`, state.clock.currentDate);
    releaseElectionFund(nextGame, state.clock.currentDate);
    if (partyFunds) treasuryBook(nextGame.party.org, -partyFunds, 'campagne', `Sostegno alla candidatura: ${election.label}`);
    // The choices the player made in the setup (the theme) are the first ones of the campaign's selects.
    const campaignPicks = { key: campaign.id, values: config.picks && typeof config.picks === 'object' ? { ...config.picks } : {} };
    state = { ...state, campaign, game: nextGame, ui:{...state.ui,activePage:'elezioni',toast:'Campagna iniziata',campaignPicks} };
    if (race) state = replaceRace(state, { ...race, status: 'running', campaignId: campaign.id, history: [{ date: state.clock.currentDate, text: 'Comincia la campagna: la guidi tu.', source: DATA_SOURCES.SIMULATION }, ...race.history] });
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
  // The races of the territorial votes the party contests (see the block of the races): the data the interface loads, the slate, the candidates the leader can field in a race and his choice.
  setTerritorialData({ units = null, municipalities = null, parties = null } = {}) {
    const next = { units: units?.length ? units : raceData.units, municipalities: municipalities?.length ? municipalities : raceData.municipalities, parties: parties?.length ? parties : raceData.parties };
    const changed = next.units !== raceData.units || next.municipalities !== raceData.municipalities || next.parties !== raceData.parties;
    raceData = next;
    const refreshed = state.game ? refreshRaces(state) : state;
    if (refreshed !== state) { state = refreshed; persist(); emit(); return true; }
    return changed;
  },
  races() { return racesOf(state); },
  raceCandidates(raceId, people = {}) {
    const race = racesOf(state).find(item => item.id === raceId);
    if (!race) return null;
    const ctx = raceChoiceContext(state, people);
    return candidateOptions({ race, items: racesOf(state), today: ctx.today, player: ctx.player ? { id: ctx.career.playerId, label: ctx.career.playerLabel, block: ctx.playerBlock(race) } : null, cadres: ctx.cadres, politicians: ctx.politicians, homeVotes: ctx.homeVotes, from: ctx.from, committee: ctx.committee, standing: ctx.standing });
  },
  chooseRaceCandidate(raceId, choice, people = {}) {
    if (!state.game || state.game.status === 'ended') throw new Error('Nessuna carriera in corso.');
    const result = chooseCandidate(racesOf(state), raceId, choice, raceChoiceContext(state, people));
    let next = withRaces(state, result.items);
    if (result.person) next = { ...next, dataset: { ...next.dataset, politicians: [...next.dataset.politicians.filter(item => item.id !== result.person.id), result.person] } };
    const race = result.items.find(item => item.id === raceId);
    state = { ...next, ui: { ...next.ui, toast: race.candidacy ? `Candidato scelto: ${race.candidacy.label} · ${race.label}` : `Candidatura ritirata · ${race.label}` } };
    persist(); emit();
    return race;
  },
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
  saveReserve(amount) {
    const result = saveReserve({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), Number(amount));
    return commitGame(result, `Riserva di emergenza: ${result.reserve} €`);
  },
  takeReserve(amount) {
    const result = takeReserve({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), Number(amount));
    return commitGame(result, `Riserva: restano ${result.reserve} €`);
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
  // ---------- the end of a career: retirement, the Hall of Fame and the legacy ----------
  // The weight of the career so far (what the Hall of Fame would record today): for the pages.
  legacyPreview() {
    if (!state.game) return null;
    const facts = careerFacts(state);
    return { ...legacyScore(facts), tags: legacyTags(facts), facts };
  },
  retirementProblem(kind) { return state.game ? retirementProblem(state, kind) : 'Nessuna carriera in corso.'; },
  hallOfFame() { return sortedHall(storage.hall()); },
  removeHallEntry(id) {
    storage.saveHall(storage.hall().filter(item => item.id !== id));
    emit();
  },
  // The player leaves politics (or retires): every office and council ends, the game stops, the career enters the
  // Hall of Fame with its legacy. A new career can start from that legacy; the world of the game is never touched.
  retireCareer(kind = 'ritiro') {
    const problem = retirementProblem(state, kind);
    if (problem) throw new Error(problem);
    const today = state.clock.currentDate;
    let next = state;
    const player = playerOf(next);
    let parliament = next.parliament;
    if (parliament?.government) parliament = { ...parliament, government: { ...parliament.government, ministers: parliament.government.ministers.map(item => item.playerAppointed && !item.endedAt ? { ...item, endedAt: today, endReason: END_KINDS[kind].reason } : item) } };
    if (parliament !== next.parliament) next = computeParliamentUpdate(next, parliament, next.ui.toast);
    next = endMandate(next, END_KINDS[kind].reason);
    next = { ...next, dataset: { ...next.dataset, offices: next.dataset.offices.map(item => item.politicianId === player?.id && !item.endDate ? { ...item, endDate: today } : item) } };
    for (const institution of ['comune', 'provincia', 'regione', 'europa']) next = closeInstitution(next, institution, today);
    next = { ...next, career: { ...next.career, currentLevel: null, endedAt: today, endKind: kind } };
    // The legacy is weighed on the career as it ends (offices closed, nothing else touched), then the game stops.
    const entry = hallEntry(next, kind);
    const game = deepCopy(next.game);
    remember(game, { date: today, kind: 'decisione', text: END_KINDS[kind].reason, weight: 1 });
    Object.assign(game, { status: 'ended', endedAt: today, endKind: kind, endReason: END_KINDS[kind].reason, closedByPlayer: true, inbox: [], legacy: { score: entry.score, tier: entry.tier, tags: entry.tags, parts: entry.parts, hallId: entry.id } });
    storage.saveHall(addToHall(storage.hall(), entry));
    state = { ...next, game, parliament: withCapital(next.parliament, game), ui: { ...next.ui, toast: `${END_KINDS[kind].reason}: eredità ${entry.score}/100 · ${entry.tier.label}` } };
    persist({ force: true }); emit();
    return entry;
  },
  // A goal of the career declared in public: a commitment with a deadline (kept it pays double, broken it costs credibility).
  declareAmbition(id) {
    const result = declareAmbition({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), id);
    return commitGame(result, `Obiettivo dichiarato: ${result.objective.label}`);
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
  // When the alliances of the forces can change: not from the filing of the lists of a general or European election to the vote.
  allianceWindow() { return allianceWindow(state); },
  proposeAlliance(forceId) {
    if (!state.game.party) throw new Error('Serve un partito per stringere un’alleanza.');
    requireSecretary();
    const closed = allianceWindow(state);
    if (!closed.open) throw new Error(closed.reason);
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
    const closed = allianceWindow(state);
    if (!closed.open) throw new Error(closed.reason);
    const alliance = state.world.alliances.find(item => item.id === allianceId);
    state = { ...state, world: breakAlliance(state.world, allianceId, state.clock.currentDate), ui: { ...state.ui, toast: 'Alleanza interrotta' } };
    for (const partyId of (alliance?.partyIds ?? []).filter(id => id !== state.world.playerPartyId)) state = rememberFact(state, { kind: 'alleanza-rotta', text: `Rotta l’${alliance.label.toLowerCase()}`, partyId, subject: partyId, weight: 1.5 });
    persist(); emit();
  },
  // ---------- the internal life of the party ----------
  partyLife() {
    const neighbours = state.world ? mergeCandidates(state.world) : [];
    return { overview: lifeOverview(state.game), ops: partyOpsAvailability(state.game, { neighbours }), neighbours };
  },
  respondPartyRequest(requestId, choice) {
    const result = lifeRespond({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), requestId, choice);
    return commitGame(result, { accetta: 'Richiesta accolta', 'accetta-controfferta': 'Controfferta accolta', tratta: 'Trattativa aperta', rifiuta: 'Richiesta respinta', tempo: 'Hai preso tempo' }[choice] ?? 'Risposta registrata');
  },
  breakPartyPact(pactId) {
    return commitGame(lifeBreakPact({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), pactId), 'Accordo denunciato');
  },
  partyCadreAction(args) {
    return commitGame(lifeCadre({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), args), 'Dirigente locale aggiornato');
  },
  partyCongressWork(kind) {
    return commitGame(lifeCongress({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), kind), 'Lavoro per il congresso registrato');
  },
  rebuildParty(focus) {
    return commitGame(lifeRebuild({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), focus), 'Piano di ricostruzione avviato');
  },
  foundParty(args) {
    const result = lifeFound({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), args);
    return commitGame(result, 'Nuovo partito fondato');
  },
  mergeParty(forceId, { unifyNames = false } = {}) {
    const force = (state.world ? mergeCandidates(state.world) : []).find(item => item.id === forceId);
    if (!force) throw new Error('Questa forza non è più disponibile per una fusione.');
    const ownLabel = state.game.party?.label ?? '';
    const short = value => String(value).replace(/\s*\(.*\)\s*$/, '');
    const newLabel = unifyNames ? `${short(ownLabel)} – ${short(force.label)}`.slice(0, 60) : null;
    const own = state.world?.parties?.find(item => item.isPlayer);
    return commitGame(lifeMerge({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), { forceId, label: short(force.label), share: force.share, ownShare: own?.baseline ?? 3, newLabel }), 'Fusione conclusa');
  },
  renameParty(args) {
    return commitGame(lifeRename({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state), args), 'Nuovo nome registrato');
  },
  leaveParty() {
    const label = state.game.party?.label ?? 'il partito';
    const result = quitParty({ game: state.game, stats: statsOf(state), parliament: state.parliament }, gameEnv(state));
    remember(result.ctx.game, { date: state.clock.currentDate, kind: 'cambio-partito', text: `Hai lasciato ${label}`, weight: 1.2 });
    return commitGame({ ...result, specials: [{ type: 'party-left' }] }, 'Hai lasciato il partito');
  },

  // ---------- the President of the Republic ----------
  // The election (the player as elector, leader of a force or candidate) and the office (the player as President).
  presidencyView() {
    const presidency = presidencyOf(state);
    const election = presidency.election;
    const date = state.clock.currentDate;
    const eligibility = presidentialEligibilityOf(state);
    const role = election ? presidentialRole(state, election.number, { blocs: election.blocs }, presidentialDelegate(state, election.number)) : null;
    const schedule = presidencySchedule(presidency.incumbent);
    return { presidency, election, eligibility, role, schedule, projection: election ? projection(election) : null, standing: state.game ? presidentialStanding(state, presidency) : null, semester: whiteSemester(presidency.incumbent, date, state.national?.legislature?.naturalEnd ?? null), isPlayer: presidentIsPlayer(state) };
  },
  presidentialCandidacy() {
    const presidency = presidencyOf(state);
    if (!presidency.election || presidency.election.phase === 'conclusa') throw new Error('Non c’è un’elezione del Presidente in corso.');
    const eligibility = presidentialEligibilityOf(state);
    if (!eligibility.eligible) throw new Error(eligibility.problems[0]);
    const role = presidentialRole(state, presidency.election.number, { blocs: presidency.election.blocs }, presidentialDelegate(state, presidency.election.number));
    const next = declareCandidacy(presidency, { date: state.clock.currentDate, standing: presidentialStanding(state, presidency), label: playerOf(state)?.displayName ?? 'Il tuo nome', sponsored: role.leader || (state.game.party?.rank ?? 0) >= 4, acclaim: presidency.incumbent.kind === 'giocatore' ? Math.max(0, ((presidency.incumbent.credit ?? 0) - 50) * 0.55) : 0 });
    state = { ...state, game: withoutPresidentialAsks(state.game, ['quirinale-candidatura', 'quirinale-rielezione']), presidency: next, ui: { ...state.ui, toast: 'Il tuo nome entra tra i candidati al Quirinale' } };
    persist(); emit();
    return next;
  },
  presidentialWithdraw() {
    const presidency = withdrawCandidacy(presidencyOf(state), { date: state.clock.currentDate });
    state = { ...state, presidency, ui: { ...state.ui, toast: 'Candidatura ritirata' } };
    persist(); emit();
    return presidency;
  },
  // A move in the negotiations: sponsor a name, veto one, strike a deal with another force (a day of work and capital).
  presidentialMove(kind, { candidateId = null, blocId = null } = {}) {
    const presidency = presidencyOf(state);
    const election = presidency.election;
    if (!election || election.phase === 'conclusa') throw new Error('Non c’è un’elezione del Presidente in corso.');
    const role = presidentialRole(state, election.number, { blocs: election.blocs }, presidentialDelegate(state, election.number));
    const costs = { sponsor: 2, veto: 3, deal: 3 };
    if (!costs[kind]) throw new Error('Mossa non valida.');
    if (kind !== 'deal' && !role.leader) throw new Error('Solo il segretario di un partito con i suoi grandi elettori guida la linea al Quirinale.');
    if (kind === 'deal' && !role.leader && !role.elector && !role.delegate) throw new Error('Per trattare serve essere un grande elettore.');
    if (!election.player.blocId) throw new Error('Non sei parte di un gruppo dell’assemblea.');
    if ((state.game.resources.politicalCapital ?? 0) < costs[kind]) throw new Error(`Servono ${costs[kind]} punti di capitale politico.`);
    let next = withTime(1);
    const date = next.clock.currentDate;
    const rand = seededRandom(`${next.career.id}|${kind}|${candidateId}|${blocId}|${date}|${election.ballots.length}|${election.player.actions ?? 0}`);
    let toast;
    let result;
    if (kind === 'sponsor') { result = sponsorCandidate(presidency, { date, candidateId, rand }); toast = `Sostieni ${shortName(election.candidates.find(item => item.id === candidateId)?.label)}${result.followed.length ? `: si accodano ${result.followed.length} forze` : ''}`; }
    else if (kind === 'veto') {
      result = vetoCandidate(presidency, { date, candidateId }); toast = 'Veto posto';
      if (next.world) next = { ...next, world: applyWorldSignals(next.world, result.sponsors.map(id => ({ type: 'relation', partyId: id, delta: -3 })), date) };
    } else {
      const own = election.blocs.find(item => item.id === election.player.blocId);
      const target = election.blocs.find(item => item.id === blocId);
      const ties = own?.partyId && target?.partyId ? next.world?.ties?.[[own.partyId, target.partyId].sort().join('|')] ?? 0 : 0;
      result = dealWithBloc(presidency, { date, blocId, candidateId, ties, rand }); toast = result.accepted ? `${result.target.label} è disponibile: ti chiederà qualcosa in cambio` : `${result.target.label} prende tempo`;
    }
    const game = withoutPresidentialAsks(deepCopy(next.game), kind === 'deal' ? [] : ['quirinale-trattative', 'quirinale-linea']);
    game.resources.politicalCapital = Math.max(0, game.resources.politicalCapital - costs[kind]);
    state = { ...next, game, presidency: result.presidency, parliament: withCapital(next.parliament, game), ui: { ...next.ui, toast } };
    persist(); emit();
    return result;
  },
  // The line of the force (the leader) or the own paper in the secret ballot (an elector).
  presidentialLine(line) {
    const presidency = presidencyOf(state);
    const election = presidency.election;
    if (!election || election.phase === 'conclusa') throw new Error('Non c’è un’elezione del Presidente in corso.');
    const role = presidentialRole(state, election.number, { blocs: election.blocs }, presidentialDelegate(state, election.number));
    if (!role.leader) throw new Error('Solo chi guida una forza decide la sua linea.');
    if (line && line !== 'bianca' && !election.candidates.some(item => item.id === line && !item.withdrawn)) throw new Error('Scegli un candidato ancora in corsa.');
    const next = setPlayerLine(presidency, line === 'bianca' ? { kind: 'bianca' } : line ? { kind: 'candidato', candidateId: line } : null);
    state = { ...state, game: withoutPresidentialAsks(state.game, ['quirinale-trattative', 'quirinale-linea']), presidency: next, ui: { ...state.ui, toast: 'Linea del gruppo aggiornata' } };
    persist(); emit();
    return next;
  },
  presidentialVote(vote) {
    const presidency = presidencyOf(state);
    const election = presidency.election;
    if (!election || election.phase === 'conclusa') throw new Error('Non c’è un’elezione del Presidente in corso.');
    const role = presidentialRole(state, election.number, { blocs: election.blocs }, presidentialDelegate(state, election.number));
    if (!role.elector && !role.delegate) throw new Error('Non sei un grande elettore: serve un seggio in Parlamento o un incarico di delegato regionale.');
    const next = setPresidentialVote(presidency, vote);
    state = { ...state, game: withoutPresidentialAsks(state.game, ['quirinale-scrutinio']), presidency: next, ui: { ...state.ui, toast: 'Il tuo voto segreto per il prossimo scrutinio è registrato' } };
    persist(); emit();
    return next;
  },
  // The activities of the President: days of work with effects on credit, stability and mood.
  presidentActivity(activityId, target = null) {
    if (!presidentIsPlayer(state)) throw new Error('Solo il Presidente della Repubblica può farlo.');
    const activity = PRESIDENT_ACTIVITIES.find(item => item.id === activityId);
    if (!activity) throw new Error('Attività non riconosciuta.');
    const presidency = presidencyOf(state);
    const week = state.game.week.index;
    const problem = presidentActivityProblem(presidency.incumbent, activity, { week, ap: state.game.week.ap }) ?? costProblem(state.game, { capital: activity.cost.capital ?? 0 });
    if (problem) throw new Error(problem);
    if (activity.target === 'region' && !ITALIAN_REGIONS.includes(target)) throw new Error('Scegli una regione.');
    let next = withTime(activity.cost.ap ?? 0);
    const date = next.clock.currentDate;
    const effects = presidentActivityEffects(activity);
    const game = deepCopy(next.game);
    if (activity.cost.capital) game.resources.politicalCapital = Math.max(0, game.resources.politicalCapital - activity.cost.capital);
    next = { ...next, game, parliament: withCapital(next.parliament, game) };
    let updated = applyPresidentCredit(presidency, effects.credit, { date, act: activity.id, text: activity.label });
    updated = { ...updated, incumbent: { ...updated.incumbent, actions: { ...(updated.incumbent.actions ?? {}), [activity.id]: week } } };
    next = { ...next, presidency: updated };
    const government = next.parliament?.government;
    if (government && ['active', 'crisis'].includes(government.status) && effects.stability) next = { ...next, parliament: { ...next.parliament, government: { ...government, stability: clampTo((government.stability ?? 50) + effects.stability, 0, 100) } } };
    if (next.society && effects.mood) next = { ...next, society: mediaEvent(next.society, { outletId: 'tv-nazionale', tone: effects.mood > 0 ? 1 : -0.6, intensity: 0.8, headline: `Il Presidente della Repubblica: ${activity.label.toLowerCase()}`, date, week }) };
    if (next.society && activity.target === 'region') next = { ...next, society: regionAttention(next.society, target, 0.8) };
    const stats = statsOf(next);
    const changed = Object.fromEntries(Object.entries(effects.stats ?? {}).map(([metric, value]) => [metric, roundStat((stats[metric] ?? 50) + value)]));
    if (Object.keys(changed).length) next = { ...next, dataset: { ...next.dataset, statistics: writeStats(next, { ...stats, ...changed }) } };
    state = { ...next, ui: { ...next.ui, toast: `${activity.label}: fatto` } };
    persist(); emit();
    return effects;
  },
  // Art. 74: a law approved by the Chambers is sent back to them once, with a message, before it is promulgated.
  presidentReturnLaw(lawId) {
    if (!presidentIsPlayer(state)) throw new Error('Solo il Presidente della Repubblica può rinviare una legge alle Camere.');
    const law = state.parliament?.laws?.find(item => item.id === lawId);
    if (!law || law.stage !== 'approved' || !law.auto) throw new Error('Si può rinviare solo una legge approvata dalle Camere e non ancora promulgata.');
    if (law.returned) throw new Error('Una legge si può rinviare una volta sola (art. 74).');
    const date = state.clock.currentDate;
    if (elapsedDays(law.updatedAt ?? date, date) > PRESIDENCY_RULES.returnWindowDays) throw new Error(`Sono passati più di ${PRESIDENCY_RULES.returnWindowDays} giorni dall’approvazione: la legge è stata promulgata.`);
    const next = withTime(1);
    let parliament = next.parliament;
    parliament = { ...parliament, laws: parliament.laws.map(item => item.id === lawId ? { ...item, stage: 'final-vote', status: 'final-vote', returned: { at: date, by: 'presidente' }, nextStepAt: advanceDays(date, 14), updatedAt: date, stageSince: date } : item), history: [...(parliament.history ?? []), { id: `rinvio-${lawId}-${date}`, date, type: 'legge-rinviata', text: `Il Presidente della Repubblica rinvia alle Camere “${law.title}” con un messaggio motivato.`, details: { lawId, auto: false }, source: DATA_SOURCES.SIMULATION }] };
    const government = parliament.government;
    if (government && ['active', 'crisis'].includes(government.status)) {
      const partners = { ...(government.partners ?? {}) };
      const sponsor = law.sponsor?.groupId;
      if (sponsor && partners[sponsor]) partners[sponsor] = { ...partners[sponsor], satisfaction: clampTo((partners[sponsor].satisfaction ?? 60) - 4, 0, 100) };
      parliament = { ...parliament, government: { ...government, stability: clampTo((government.stability ?? 50) - 3, 0, 100), partners } };
    }
    let s = computeParliamentUpdate(next, parliament, 'Legge rinviata alle Camere');
    if (s.society) s = { ...s, society: mediaEvent(revokeMeasure(s.society, law.title), { outletId: 'quotidiani', tone: 0.4, intensity: 1, headline: `Il Presidente della Repubblica rinvia alle Camere “${law.title}”`, date, week: s.game.week.index }) };
    const presidency = presidencyOf(s);
    let updated = applyPresidentCredit(presidency, 1.5, { date, act: 'rinvio', text: `Hai rinviato alle Camere “${law.title}”` });
    updated = { ...updated, incumbent: { ...updated.incumbent, returned: [...(updated.incumbent.returned ?? []), { lawId, title: law.title, date }] } };
    const game = deepCopy(s.game);
    remember(game, { date, kind: 'decisione', text: `Hai rinviato alle Camere la legge “${law.title}”`, weight: 1 });
    state = { ...s, game, presidency: updated, ui: { ...s.ui, toast: 'Legge rinviata alle Camere: gli effetti si fermano e si rivota tra due settimane' } };
    persist(); emit();
    return law;
  },
  // Art. 88: the President can dissolve the Chambers (not in the last six months of the term, unless they end too).
  presidentDissolve() {
    if (!presidentIsPlayer(state)) throw new Error('Solo il Presidente della Repubblica può sciogliere le Camere.');
    const presidency = presidencyOf(state);
    const date = state.clock.currentDate;
    const semester = whiteSemester(presidency.incumbent, date, state.national?.legislature?.naturalEnd ?? null);
    if (semester.active) throw new Error(`Sei nel semestre bianco (dal ${formatDate(semester.since)}): il Presidente non può sciogliere le Camere.`);
    const government = state.parliament?.government;
    const open = government && ['fallen', 'caretaker', 'crisis'].includes(government.status);
    if (!open && !(state.national?.formation && !['completata', 'fallita'].includes(state.national.formation.phase))) throw new Error('Le Camere hanno una maggioranza che governa: non c’è ragione di scioglierle (servono una crisi di governo senza soluzione o consultazioni fallite).');
    const next = withTime(1);
    let s = { ...next, game: scheduleEarlyElection(next.game, date) };
    const formation = s.national?.formation;
    if (formation && !['completata', 'fallita'].includes(formation.phase)) s = { ...s, national: nationalHistory({ ...s.national, formation: { ...formation, phase: 'fallita', presidentChoice: 'dissolve' } }, date, 'formazione', 'Il Presidente scioglie le Camere: si torna al voto.') };
    if (s.world) s = { ...s, world: addWorldEffects(s.world, [], date, { title: 'Sciolte le Camere: si torna al voto', body: 'Il Presidente della Repubblica scioglie le Camere e indice elezioni anticipate (simulazione).', icon: 'alert', tone: 'bad' }) };
    const updated = applyPresidentCredit(presidency, -2, { date, act: 'scioglimento', text: 'Hai sciolto le Camere' });
    const game = deepCopy(s.game);
    remember(game, { date, kind: 'decisione', text: 'Hai sciolto le Camere', weight: 1.5 });
    state = { ...s, game, presidency: { ...updated, incumbent: { ...updated.incumbent, dissolutions: (updated.incumbent.dissolutions ?? 0) + 1 } }, ui: { ...s.ui, toast: 'Camere sciolte: si va alle elezioni anticipate' } };
    persist(); emit();
    return state;
  },
  // Art. 59: up to five senators for life named by the President for outstanding merits (here a prestige gesture).
  presidentLifeSenator(profile = 'scienza') {
    if (!presidentIsPlayer(state)) throw new Error('Solo il Presidente della Repubblica nomina i senatori a vita.');
    const presidency = presidencyOf(state);
    const named = presidency.incumbent.lifeSenators ?? [];
    const date = state.clock.currentDate;
    if (named.length >= PRESIDENCY_RULES.lifeSenatorLimit) throw new Error(`Hai già nominato ${PRESIDENCY_RULES.lifeSenatorLimit} senatori a vita: è il massimo previsto.`);
    if (named.at(-1) && elapsedDays(named.at(-1).date, date) < 365) throw new Error('Una nomina all’anno: aspetta.');
    const labels = { scienza: 'Una figura (simulata) della scienza', arte: 'Una figura (simulata) dell’arte e della cultura', impresa: 'Una figura (simulata) dell’impresa e del lavoro', servizio: 'Una figura (simulata) del servizio pubblico' };
    if (!labels[profile]) throw new Error('Scegli un profilo per la nomina.');
    const next = withTime(1);
    const updated = applyPresidentCredit(presidency, 3, { date, act: 'senatore-a-vita', text: `${labels[profile]} nominata senatore a vita` });
    const game = deepCopy(next.game);
    remember(game, { date, kind: 'decisione', text: `Hai nominato senatore a vita ${labels[profile].toLowerCase()}`, weight: 0.8 });
    let s = { ...next, game, presidency: { ...updated, incumbent: { ...updated.incumbent, lifeSenators: [...named, { profile, label: labels[profile], date }] } } };
    if (s.society) s = { ...s, society: mediaEvent(s.society, { outletId: 'quotidiani', tone: 1, intensity: 0.8, headline: `Il Presidente nomina senatore a vita: ${labels[profile].toLowerCase()}`, date, week: game.week.index }) };
    state = { ...s, ui: { ...s.ui, toast: 'Nuovo senatore a vita (figura simulata)' } };
    persist(); emit();
    return labels[profile];
  },
  // Art. 86: resigning opens a new election within fifteen days; the President of the Senate acts meanwhile.
  presidentResign() {
    if (!presidentIsPlayer(state)) throw new Error('Solo il Presidente della Repubblica può dimettersi.');
    const date = state.clock.currentDate;
    let s = { ...state, presidency: resignPresidency(presidencyOf(state), { date }) };
    s = endPresidency(s, { date, reason: 'Dimissioni anticipate' });
    state = s;
    persist(); emit();
    return state;
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
    const result = amendOthersLaw(paid, lawId, { [patchKey]: patchKey === 'intensity' ? Number(patchValue) : patchValue }, next.clock.currentDate, { influence: playerStat(state, 'influence'), ...amendmentExtras(state, next.parliament.laws.find(item => item.id === lawId)), roll, offerVote });
    // A deal fixes the vote: the pending request of the agenda is answered.
    const answered = result.accepted && offerVote && next.game ? { ...next, game: { ...next.game, inbox: next.game.inbox.filter(item => !(item.templateId === 'voto-aula' && item.params?.lawId === lawId)) } } : next;
    applyParliamentUpdate(answered, result.parliament, result.accepted ? (offerVote ? 'Accordo fatto: emendamento approvato, voterai a favore' : 'Emendamento approvato: il testo cambia') : `Emendamento respinto (probabilità stimata ${Math.round(result.chance * 100)}%)`, result.accepted ? { influence: 0.5, experience: 0.5 } : { experience: 0.25 });
    return result;
  },
  amendmentOdds(lawId, { offerVote = false } = {}) {
    const law = state.parliament?.laws.find(item => item.id === lawId);
    return law ? amendmentOdds(state.parliament, law, { influence: playerStat(state, 'influence'), ...amendmentExtras(state, law), offerVote }) : 0;
  },
  // ---------- the local and European institutions ----------
  // The player's act: a kind among those of the office (category), on a theme; variant for taxes, tariffs, town plans.
  proposeLocalAct(instId, area, category = null, variant = null) {
    const next = withTime(1);
    const inst = proposeLocalAct(findInstitution(next, instId), area, next.clock.currentDate, { category, variant });
    const act = inst.acts.at(-1);
    const toast = act.organ === 'giunta' ? 'Proposta in Giunta: la adotta la Giunta, senza voto del consiglio' : act.stage === 'aula' ? 'Atto depositato: va direttamente in aula al voto' : 'Proposta depositata: va in commissione, poi al voto';
    state = { ...replaceInstitution(next, inst), ui: { ...next.ui, toast } };
    persist(); emit();
    return inst;
  },
  castLocalVote(instId, actId, choice) {
    const inst = setLocalVote(findInstitution(state, instId), actId, choice);
    const game = state.game ? { ...state.game, inbox: state.game.inbox.filter(item => !(item.templateId === 'voto-consiglio' && item.params?.actId === actId)) } : state.game;
    state = { ...replaceInstitution(state, inst), game, ui: { ...state.ui, toast: choice === 'linea' ? 'Voterai con il tuo gruppo' : `Il tuo voto: ${choice}` } };
    persist(); emit();
    return inst;
  },
  // A question on a theme (area; by default the weakest service of the city or of the region).
  questionLocalExecutive(instId, area = null) {
    const next = withTime(1);
    const current = findInstitution(next, instId);
    const regional = ['regione', 'provincia'].includes(current.kind) ? next.society?.regions?.[current.region]?.indicators : null;
    const theme = area ?? (regional ? Object.values(INDICATOR_AREA).filter(id => localAreas(current.kind).includes(id)).map(id => [id, territoryValue(current, id, regional)]).filter(([, value]) => value !== null).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null : null);
    const inst = questionExecutive(current, next.clock.currentDate, theme);
    let updated = { ...replaceInstitution(next, inst), ui: { ...next.ui, toast: 'Interrogazione presentata' } };
    const stats = statsOf(updated);
    updated = { ...updated, dataset: { ...updated.dataset, statistics: writeStats(updated, { ...stats, notoriety: roundStat((stats.notoriety ?? 20) + 0.6) }) } };
    state = updated; persist(); emit();
    return inst;
  },
  reshuffleLocalGiunta(instId, portfolio, groupId) {
    const next = withTime(1);
    const inst = reshuffleLocal(findInstitution(next, instId), portfolio, groupId, next.clock.currentDate);
    state = { ...replaceInstitution(next, inst), ui: { ...next.ui, toast: 'Rimpasto di giunta fatto' } };
    persist(); emit();
    return inst;
  },
  // Local taxes: the head of the executive proposes the new rates, the council approves them (one step at a time);
  // the popularity moves when they pass.
  setLocalTaxLevel(instId, level) {
    const current = findInstitution(state, instId);
    if (current.executive?.leader !== 'player' || !current.budget) throw new Error('Solo chi guida l’esecutivo propone le aliquote.');
    const steps = ['bassa', 'media', 'alta'];
    if (!steps.includes(level)) throw new Error('Livello non valido.');
    if (level === current.budget.localTax) throw new Error('Le aliquote sono già a questo livello.');
    const inst = store.proposeLocalAct(instId, 'fisco', 'tributi', steps.indexOf(level) > steps.indexOf(current.budget.localTax) ? 'aumento' : 'riduzione');
    state = { ...state, ui: { ...state.ui, toast: `${actTypeOf(current.kind, 'tributi').label}: la proposta va al voto del consiglio` } };
    persist(); emit();
    return inst;
  },
  concedeLocal(instId, actId, groupId) {
    if ((state.game?.resources.politicalCapital ?? 0) < 2) throw new Error('Servono 2 punti di capitale politico per una concessione.');
    const inst = concedeToGroup(findInstitution(state, instId), actId, groupId, state.clock.currentDate);
    const game = state.game ? { ...state.game, resources: { ...state.game.resources, politicalCapital: state.game.resources.politicalCapital - 2 } } : state.game;
    state = { ...replaceInstitution(state, inst), game, parliament: withCapital(state.parliament, game), ui: { ...state.ui, toast: 'Concessione fatta: il gruppo ci pensa' } };
    persist(); emit();
    return inst;
  },
  // The European Parliament: a report, an amendment, a move to another committee, an office of the committee.
  bidEuropeanRapporteur(instId, actId) {
    return europeanMove(instId, `relatore|${actId}`, EP_COSTS.rapporteur, context => bidRapporteur(findInstitution(context.state, instId), actId, context), result => ({
      toast: result.won ? 'Sei relatore: il dossier passa per le tue mani' : `La relazione va a ${result.group ?? 'un altro gruppo'}`,
      stats: result.won ? { influence: 0.5, notoriety: 0.5 } : {}
    }));
  },
  tableEuropeanAmendment(instId, actId) {
    return europeanMove(instId, `emendamento|${actId}`, EP_COSTS.amendment, context => tableAmendment(findInstitution(context.state, instId), actId, context), result => ({
      toast: result.carried ? 'Emendamento approvato in commissione' : 'Emendamento respinto in commissione',
      stats: result.carried ? { influence: 0.6, reputation: 0.3 } : { notoriety: 0.2 }
    }));
  },
  requestEuropeanCommittee(instId, committeeId) {
    return europeanMove(instId, `commissione|${committeeId}`, EP_COSTS.committee, context => requestCommittee(findInstitution(context.state, instId), committeeId, context), result => ({
      toast: result.moved ? `Passi alla commissione ${result.committee.code}` : 'Il gruppo respinge la richiesta',
      closeRole: result.moved && result.leftRole
    }));
  },
  runForEuropeanRole(instId) {
    const role = EP_ROLES[EP_ROLES.findIndex(item => item.id === findInstitution(state, instId).ep?.role) + 1];
    return europeanMove(instId, 'incarico', role?.capital ?? 0, context => runForCommitteeRole(findInstitution(context.state, instId), context), result => ({
      toast: result.won ? `${result.role.title(result.committee.code)}: eletto` : `Non eletto: ${result.role.label.toLowerCase()}`,
      stats: result.won ? result.role.stats : { reputation: -0.3 },
      openRole: result.won ? result.role.title(result.committee.code) : null,
      memory: result.won ? { kind: 'decisione', text: `Parlamento europeo: ${result.role.title(result.committee.code).toLowerCase()}`, weight: 0.6 } : null
    }));
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
    const updated = applyParliamentUpdate(next, parliament, appointment.playerAppointed ? `Sei ministro: ${portfolio}` : 'Incarico simulato distribuito', appointment.playerAppointed ? { influence: 3, notoriety: 3, reputation: 1 } : {}, { open });
    return appointment.playerAppointed ? settleOffices('ministro') : updated;
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
    const updated = applyParliamentUpdate(next, parliament, passed ? 'Fiducia ottenuta: sei Presidente del Consiglio' : 'Fiducia non ottenuta: il governo cade', { ...deltas, ...(open.length ? { notoriety: 4, influence: (deltas.influence ?? 0) + 3 } : {}) }, { open });
    return passed ? settleOffices('premier') : updated;
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
  // An office just taken excludes some of those held (see office-rules): they lapse and the diary says which rule applied.
  settleOffices(gained) { return settleOffices(gained); },
  requestGovernmentPost(portfolio) {
    const next = withTime(PARLIAMENT_TIME_COSTS.assignMinister);
    if ((next.game?.resources.politicalCapital ?? 0) < 6) throw new Error('Servono 6 punti di capitale politico per chiedere un incarico di governo.');
    const game = { ...next.game, resources: { ...next.game.resources, politicalCapital: next.game.resources.politicalCapital - 6 } };
    const player = playerOf(state);
    const stats = playerStats(state);
    const result = requestGovernmentPost(withCapital(next.parliament, game), portfolio, next.clock.currentDate, { stats: { ...stats, influence: playerStat(state, 'influence') }, roll: rollFor(next), appointeeLabel: player?.displayName, extras: ministryExtras(next, portfolio) });
    const open = result.appointed ? [{ id: ministerOfficeId(result.appointment), title: `Ministro · ${portfolio} (scenario)`, institution: 'Governo della Repubblica (scenario di gioco)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    // A lower office than hoped: undersecretary instead of minister.
    const lowerGame = result.lower && !game.flags?.scenarioOffice ? { ...game, flags: { ...game.flags, scenarioOffice: { title: 'Sottosegretario (esecutivo di scenario)', since: game.week.index, source: DATA_SOURCES.SIMULATION } } } : game;
    const updated = applyParliamentUpdate({ ...next, game: lowerGame }, result.parliament, result.appointed ? `Sei ministro: ${portfolio}` : result.lower ? 'Niente ministero: ti offrono un incarico da sottosegretario' : 'Il Presidente del Consiglio non ti affida il ministero', result.appointed ? { influence: 3, notoriety: 3, reputation: 1 } : result.lower ? { influence: 1, notoriety: 1 } : { influence: -0.5 }, { open });
    if (result.lower && !game.flags?.scenarioOffice) { state = handleSpecials(state, [{ type: 'scenario-office', title: 'Sottosegretario (esecutivo di scenario)' }]); persist(); emit(); }
    return result.appointed ? settleOffices('ministro') : result.lower ? settleOffices('sottosegretario') : updated;
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
    if (!saveLock) { try { storage.clear(); } catch { /* storage may be unavailable */ } }
    lastSaved = saveLock ?? 'Nuova carriera demo'; emit();
  },
  createCareer(draft, realParties = [], realGroups = []) {
    // A new career begins on the day of the real snapshot: real government, Parliament and opening poll are all current.
    // The game in progress keeps its own date: it may still be saved in a slot below, or stay if the draft is refused.
    const today = realStartDate ?? state.clock.currentDate;
    const selectableParties = [...state.dataset.parties.filter(isSelectableParty), ...realParties.filter(party => party?.source === DATA_SOURCES.REAL && party.verified === true)];
    const errors = validateNewCareerDraft({ ...draft, currentDate: today }, selectableParties, realGroups);
    if (errors.length) throw new Error(errors[0]);
    const level = CAREER_LEVELS[draft.initialLevel];
    const birthDate = draft.birthDate;
    // How the career starts: outsider, debts, a divided party, a consolidated career or a custom scenario.
    const legacyEntry = draft.legacyId ? storage.hall().find(item => item.id === draft.legacyId) ?? null : null;
    if (draft.legacyId && !legacyEntry) throw new Error('L’eredità scelta non è più nella Hall of Fame.');
    const plan = startPlan(draft.start, { partyMode: draft.partyMode, legacy: legacyBoon(legacyEntry) });
    const startDeltas = startStatDeltas(plan.levels);
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
    // The province of the comune (a territory of its own for a provincial career): the ISTAT unit, its name and its kind.
    const provinceId = makeId('territorio-provincia');
    if (draft.initialLevel === 'provinciale') territories.push({ id: provinceId, kind: 'provincia', name: draft.provinceName, parentId: regionId, source: DATA_SOURCES.USER, istatCode: draft.provinceCode, provinceType: draft.provinceType ?? null });
    const territoryId = draft.initialLevel === 'comunale' ? municipalityId : draft.initialLevel === 'provinciale' ? provinceId : regionId;
    if (['deputato','senatore','europeo'].includes(draft.initialLevel)) territories.push({ id: nationId, kind: 'stato', name: 'Italia', parentId: null, source: DATA_SOURCES.USER });

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
        foundedAt: today, status: 'attivo',
        policyPositions: { ...draft.policyPositions }, source: DATA_SOURCES.USER, createdAt: today, logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: `Logo di ${draft.partyName.trim()}`
      });
    }
    const profession = draft.previousProfession.trim();
    // The difficulty shifts where the player starts: more or less popularity, reputation and influence.
    const difficulty = difficultyId(draft.difficulty);
    const statistics = Object.fromEntries(Object.entries(initialCareerStatistics(draft.initialLevel)).map(([metric, value]) => { const bump = startDeltas[metric] ?? 0; const base = ['popularity', 'reputation', 'influence'].includes(metric) ? Math.max(0, Math.min(100, value + difficultyOf(difficulty).statStart)) : value; return [metric, bump ? Math.max(0, Math.min(100, round2(base + bump))) : base]; }));
    const datasetStatistics = [];
    const statisticIds = Object.entries(statistics).map(([metric, value]) => {
      const statisticId = makeId('stat-' + metric);
      datasetStatistics.push({ id: statisticId, subjectId: playerId, metric, value, unit: '100', asOf: today, source: DATA_SOURCES.SIMULATION });
      return statisticId;
    });
    const player = {
      id: playerId, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(),
      displayName: draft.firstName.trim() + ' ' + draft.lastName.trim(), birthDate, gender: draft.gender,
      region: draft.region, municipality: draft.municipality.trim(), municipalityCode: istat.istatCode ?? null, province: istat.provinceName ?? null, previousProfession: profession,
      partyId, territoryId, roleId: makeId('incarico'), source: DATA_SOURCES.USER, createdAt: today
    };
    const chamber = CAREER_LEVELS[draft.initialLevel]?.chamber ?? null;
    const office = {
      id: player.roleId, title: level.office,
      institution: draft.initialLevel === 'comunale' ? 'Comune di ' + draft.municipality.trim() : draft.initialLevel === 'provinciale' ? institutionName('provincia', { provinceName: draft.provinceName, provinceType: draft.provinceType }) : draft.initialLevel === 'regionale' ? 'Regione ' + draft.region : chamber === 'camera' ? 'Camera dei deputati' : chamber === 'senato' ? 'Senato della Repubblica' : draft.initialLevel === 'europeo' ? 'Parlamento europeo' : 'Repubblica italiana',
      // A seat at the European Parliament is an office of the European vote ('europee'), like the one a campaign wins.
      level: draft.initialLevel === 'europeo' ? 'europee' : draft.initialLevel, politicianId: playerId, territoryId, startDate: today, endDate: null,
      source: chamber || draft.initialLevel === 'europeo' ? DATA_SOURCES.SIMULATION : DATA_SOURCES.USER
    };
    const dataset = emptyDataset();
    dataset.parties = parties;
    dataset.politicians = [player];
    dataset.territories = territories;
    dataset.offices = [office];
    // A provincial councillor is a mayor or a municipal councillor of the province: the career starts with the seat in the own comune too.
    if (draft.initialLevel === 'provinciale') dataset.offices.push({ id: makeId('incarico'), title: CAREER_LEVELS.comunale.office, institution: 'Comune di ' + draft.municipality.trim(), level: 'comunale', politicianId: playerId, territoryId: municipalityId, startDate: today, endDate: null, source: DATA_SOURCES.USER });
    dataset.statistics = datasetStatistics;
    const parliamentContext = chamber ? {
      mode: 'real-context', chamber, groupId: draft.parliamentaryGroupId,
      territoryName: draft.region, source: DATA_SOURCES.SIMULATION,
      realReferences: { chamberId: chamber === 'camera' ? 'chamber-camera' : 'chamber-senato', groupId: draft.parliamentaryGroupId }
    } : null;
    const career = {
      id, name: player.displayName + ' — ' + level.shortLabel, playerId, partyId,
      initialLevel: draft.initialLevel, territoryId, statisticsIds: statisticIds,
      startedAt: today, createdAt: new Date().toISOString(), status: 'active', parliamentContext, difficulty,
      // The starting conditions in force (null for an ordinary start) and the way the career began, for the Hall of Fame.
      start: hasStart(plan) ? plan : null, startProfile: hasStart(plan) ? plan.profile : 'ordinaria',
      // The legacy of a concluded career this one started from (the Hall of Fame keeps the original).
      legacyFrom: legacyEntry ? { id: legacyEntry.id, name: legacyEntry.name } : null
    };
    const parliament = chamber ? createParliamentState({ career, player, groups: realGroups, currentDate: today, politicalCapital: statistics.influence, referenceGovernment }) : null;
    if (parliament) {
      career.parliamentHistory = [...parliament.history];
      dataset.events = parliament.history.map(event => ({ id: event.id, title: event.text, date: event.date, category: 'parlamento', status: event.type, territoryId: null, impact: event.details, source: DATA_SOURCES.SIMULATION }));
    }
    const partyRecord = [...parties, ...realParties].find(item => item.id === partyId);
    const base = {
      version: STATE_VERSION, campaign: null, parliament, career,
      clock: { ...state.clock, currentDate: today }, dataset,
      ui: { activePage: 'panoramica', saveName: 'Salvataggio locale', toast: 'Carriera iniziata: la tua prima settimana è in agenda' }
    };
    const game = buildGame(base, { partyLabel: partyRecord ? partyRecord.officialName ?? partyRecord.name : null, founder: draft.partyMode === 'new' });
    const built = buildWorld({ ...base, game }, partyRecord ?? null);
    const calendared = built && localElections ? withLocalCalendar(built, localSummary(localElections), today) : built;
    const leaned = calendared?.localCalendar && electoralGeography ? withRegionalLeans(calendared, regionalLeans(electoralGeography)) : calendared;
    // The programme of the player's own party (the one chosen in the wizard, or kept by the party of the user he joins): in the career and in the agenda of its force.
    const programAreas = ((draft.partyMode === 'new' ? draft.partyProgram : partyRecord?.source === DATA_SOURCES.USER ? partyRecord.program : null) ?? []).filter(id => AREA_BY_ID[id]).slice(0, 4);
    const world = leaned && programAreas.length ? setPlayerAgenda(leaned, programAreas) : leaned;
    const society = buildSociety({ ...base, game });
    const national = createNationalState({ currentDate: today, legislature: game.legislature });
    if (programAreas.length && game.party) game.party.program = { areas: programAreas, since: 1, source: DATA_SOURCES.SIMULATION };
    game.timeline = [{ id: makeId('storia'), week: 1, date: today, kind: 'inizio', title: `Inizia la carriera: ${level.office}`, detail: `${draft.municipality.trim()}, ${draft.region}${partyRecord ? ` · ${partyRecord.officialName ?? partyRecord.name}` : ' · indipendente'}`, tone: 'good', source: DATA_SOURCES.SIMULATION }];
    if (hasStart(plan)) game.timeline.push({ id: makeId('storia'), week: 1, date: today, kind: 'inizio', title: `Punto di partenza: ${plan.label}`, detail: planLines(plan).map(item => `${item.label} ${item.level}/3`).join(' · '), tone: 'neutral', source: DATA_SOURCES.SIMULATION });
    // The game being replaced is kept in a slot, so a new game never erases an old one.
    if (store.hasCareer()) keepCurrent(`${slotMeta(state).player} · partita precedente`);
    const presidency = createPresidency({ date: today, seed: seedOf(base) });
    state = { ...base, game, world, society, national, presidency, parliament: withCapital(parliament, game) };
    // A local career starts with a seat in the council of the own comune or region, until its next vote.
    const localKind = { comunale: 'comune', provinciale: 'comune', regionale: 'regione' }[draft.initialLevel];
    if (localKind && world) state = withInstitution(state, simulatedInstitution(state, localKind, today));
    // ...and a provincial career in the council of the province too, besides the one of the own comune.
    if (draft.initialLevel === 'provinciale' && world) state = withInstitution(state, simulatedInstitution(state, 'provincia', today));
    // A European career starts with a seat in the European Parliament, in the group of the own party (or non-attached).
    if (draft.initialLevel === 'europeo' && world) state = withInstitution(state, europeanInstitution(state, today));
    timelineBase = state;
    persist({ force: true }); emit();
    return player;
  }
};


// A compact report of the vote, kept in the career after the campaign is closed (results, territory, consequences).
function electionReport(campaign, result, aftermath) {
  const candidateLabel = row => { const candidate = campaign.candidates.find(item => item.id === row.candidateId); return candidate?.isPlayer ? 'La tua lista' : candidate?.realReference?.fullName ?? (candidate?.partyLabel ? `${candidate.partyLabel} (candidatura simulata)` : row.label ?? 'Candidatura simulata'); };
  const candidateIdentity = candidate => ({ candidateId:candidate.id,personId:candidate.isPlayer?campaign.playerId:candidate.realReference?.politicianId??null,partyId:candidate.partyId??null,source:candidate.isPlayer?DATA_SOURCES.USER:candidate.realReference?.source===DATA_SOURCES.REAL?DATA_SOURCES.REAL:DATA_SOURCES.SIMULATION,verified:candidate.realReference?.verified===true });
  const latestPoll=campaign.polls?.at(-1);
  const playerPollShare=latestPoll?.results?.find(item=>item.candidateId===campaign.playerCandidateId)?.share;
  const outcome = result.outcome ?? {};
  return {
    campaignId: campaign.id, electionType: campaign.electionType, electionLabel: campaign.electionLabel, role: campaign.candidacy?.role ?? null, date: campaign.currentDate,
    outcome: { code: outcome.code ?? null, label: outcome.label ?? null, tone: outcome.tone ?? null, position: outcome.position ?? null, positionLabel: outcome.positionLabel ?? null, margin: outcome.margin ?? null, expected: outcome.expected ?? null, expectation: outcome.expectation ?? null, expectationLabel: outcome.expectationLabel ?? null, via: outcome.via ?? null, side: outcome.side ?? null, preference: outcome.preference ?? null, district: outcome.district ?? null, constituency: outcome.constituency ?? null, threshold: outcome.threshold ?? null, belowThreshold: Boolean(outcome.belowThreshold) },
    playerShare: result.playerShare, playerVotes: result.playerVotes, playerSeats: result.playerSeats, personalMandate: result.personalMandate, turnout: result.turnout ?? null, pollShare: latestPoll?(Number.isFinite(playerPollShare)?playerPollShare:null):(campaign.preparation?.pollShare??null),
    poll:latestPoll?{date:latestPoll.date,stage:latestPoll.stage,institute:latestPoll.institute,sample:latestPoll.sample,margin:latestPoll.margin,playerShare:Number.isFinite(playerPollShare)?playerPollShare:null,source:DATA_SOURCES.SIMULATION}:null,
    candidates:campaign.candidates.map(candidate=>({ ...candidateIdentity(candidate),displayName:candidate.realReference?.fullName??candidate.displayLabel??candidate.displayName })),
    groups: (result.groups ?? []).map(row => ({ candidateId:row.candidateId,memberCandidateIds:row.memberCandidateIds??[],identity:candidateIdentity(campaign.candidates.find(item=>item.id===row.candidateId)??{id:row.candidateId}),label: candidateLabel(row), percent: row.percent, votes: row.votes, seats: row.seats, player: row.candidateId === campaign.playerCandidateId, partyIds: row.partyIds ?? [], runoffPercent: row.runoffPercent ?? null })),
    territories: (result.territories ?? []).map(area => { const own = area.groups.find(row => row.candidateId === campaign.playerCandidateId); const top = area.groups[0]; return { name: area.name, weight: area.weight, percent: own?.percent ?? 0, position: area.playerPosition ?? null, winner: top ? candidateLabel(top) : null, winnerPercent: top?.percent ?? null }; }),
    runoff: (result.runoffResults ?? []).map(row => ({ label: candidateLabel(row), percent: row.percent, player: row.candidateId === campaign.playerCandidateId })),
    // Where the voters of the candidates who were out went (indication, share that followed, share that stayed home) and what the turnout was made of.
    runoffDetail: result.runoffDetail?.transfers?.length ? { transfers: result.runoffDetail.transfers.map(row => ({ label: candidateLabel({ candidateId: row.candidateId }), share: row.share, backs: row.backs ? (row.backs === campaign.playerCandidateId ? 'te' : candidateLabel({ candidateId: row.backs })) : null, pact: Boolean(row.pact), rates: Object.entries(row.rates).map(([id, rate]) => ({ label: id === campaign.playerCandidateId ? 'te' : candidateLabel({ candidateId: id }), rate })), abstain: row.abstain })), appeal: result.runoffDetail.appeal ?? 0 } : null,
    turnoutParts: campaign.electionDays?.at(-1)?.turnoutParts ?? null,
    consequences: { stats: aftermath.stats, party: aftermath.party, capital: aftermath.capital, office: aftermath.office, government: aftermath.government, lines: aftermath.lines, events: aftermath.events.map(item => item.id) },
    seatRule: result.seatRule ?? null, source: DATA_SOURCES.SIMULATION
  };
}
// The forces that stand with the player's: the coalition the party runs in at a general or European vote, the intesa or coalition it has in the world otherwise.
function alliesOf(s, type) {
  const world = s.world;
  const forceId = world?.playerPartyId;
  if (!world || !forceId) return [];
  if (NATIONAL_TYPES.includes(type)) {
    const national = nationalOf(s);
    const coalitions = type === 'politiche' && national.campaign?.coalitions?.length ? national.campaign.coalitions : buildCoalitions(world, { playerChoice: national.campaign?.playerChoice ?? null });
    return (coalitions.find(item => item.partyIds.includes(forceId))?.partyIds ?? []).filter(id => id !== forceId);
  }
  return (allianceOf(world, forceId)?.partyIds ?? []).filter(id => id !== forceId);
}
// The electorate of a vote, as far as the real map says: the registers of the 2022 general election (the latest real figure) for the whole country or for the region of
// a regional vote. The comuni and the provinces have no register in the data: their electorate stays unknown (its class, small or not, is the band the player picks).
function electorateFor(type, place) {
  const rows = electoralGeography?.camera?.collegi;
  if (!rows?.length) return null;
  const pick = type === 'regionale' ? rows.filter(row => row.region === place.region) : NATIONAL_TYPES.includes(type) ? rows : [];
  if (!pick.length) return null;
  const sum = key => pick.reduce((total, row) => total + (row[key] ?? 0), 0);
  return { electors: sum('electors'), validRatio: sum('voters') ? Math.round(sum('valid') / sum('voters') * 10000) / 10000 : null, basis: 'iscritti alle liste elettorali delle politiche 2022 (ultimo dato reale della mappa)' };
}
// What the career built so far gives the campaign beyond the numbers of the player: the record of the term that ends (the player's own, or of the
// administration he faces), the weight of the parties in the place of the vote, the rivals he has already met and the subjects who backed him.
// ---------- the races of the territorial votes: the candidates the leader fields ----------
// The leader of a party decides who runs in the regional, provincial and municipal races of the round (race-engine): a person of the staff, a politician the game
// knows, a new figure of the simulation, or himself (a campaign he plays, wherever the vote is held). It costs no days and no money: it is a decision, not an action.
// The races nobody plays are run by the party with the campaign-engine, week by week, and leave their result in the game. What the races need besides the state of
// the game (the units and the comuni of ISTAT, the parties the rivals come from) is given by the interface once it has loaded it.
let raceData = { units: [], municipalities: [], parties: [] };
const racesOf = s => s.races?.items ?? [];
const withRaces = (s, items) => ({ ...s, races: { version: 1, items } });
const raceLeader = s => Boolean(s.game?.party) && isSecretary(s.game.party);
const raceParty = s => ({ id: s.world?.playerPartyId ?? s.career.partyId ?? null, label: s.game?.party?.label ?? s.world?.parties?.find(item => item.isPlayer)?.label ?? null });
const racePlaceOf = race => ({ municipalityCode: race.territory.municipalityCode ?? null, municipality: race.territory.kind === 'comune' ? race.territory.name : null, region: race.territory.region, province: race.territory.kind === 'provincia' ? race.territory.name : null, provinceCode: race.territory.provinceCode ?? null, provinceName: race.territory.kind === 'provincia' ? race.territory.name : null, provinceType: race.territory.provinceType ?? null });
// The parties the rivals of a race are drawn from: the ones the interface gave, else the forces of the political world.
function raceCatalog(s) {
  if (raceData.parties.length) return [...s.dataset.parties, ...raceData.parties];
  const forces = [...(s.world?.parties ?? []).filter(item => item.active && !item.isPlayer), ...(s.world?.latent ?? [])];
  return [...s.dataset.parties, ...forces.map(item => ({ id: item.id, name: item.label, officialName: item.label, abbreviation: item.abbreviation ?? null, source: item.refSource === 'user' ? DATA_SOURCES.USER : item.refSource === 'real' ? DATA_SOURCES.REAL : DATA_SOURCES.SIMULATION, status: 'active', politicalPosition: item.position ?? null, regionId: item.regionId ?? null }))];
}
// What the committees of the party do where the race is held (volunteers, organisation, money, strength): the party's roots in the territory.
function raceCommittees(s, race) {
  const org = s.game?.party?.org;
  if (!org?.committees?.length) return null;
  return committeeSupport(org, { electionType: race.level, region: race.territory.region, provinceCode: race.territory.provinceCode, municipality: race.territory.kind === 'comune' ? race.territory.name : null, week: s.game.week.index, party: s.game.party });
}
// The region of a parliamentarian, from the circoscription of his seat ("Sicilia 1").
const regionOfCircoscription = text => ITALIAN_REGIONS.find(name => territoryKey(text).startsWith(territoryKey(name))) ?? null;
// The people the leader can field besides himself: the local leaders of the party (staff), the real parliamentarians of its groups while the real Chambers sit, and
// the persons of the simulation the party already has (people it fielded before, members of its groups in the simulated Chambers).
function racePeople(s, people = {}) {
  const game = s.game;
  const party = raceParty(s);
  const org = game?.party?.org;
  const cadres = (game?.party?.life?.cadres ?? []).filter(item => item.status !== 'uscito' && !item.player).map(item => {
    const committee = (org?.committees ?? []).find(entry => entry.id === item.committeeId);
    return { id: item.id, label: `${item.label}${item.name ? ` · ${item.name}` : ''}`, region: item.region ?? null, municipality: item.level === 'comune' ? item.name : null, municipalityCode: committee?.municipalityCode ?? null, provinceCode: committee?.unitCode ?? null, status: item.status };
  });
  const groups = new Map(['camera', 'senato'].flatMap(chamber => (s.parliament?.chambers?.[chamber]?.groups ?? []).map(group => [group.groupId, group])));
  const real = (s.parliament?.legislature?.reference ?? 'real') === 'real' ? (people.politicians ?? []).filter(item => item.source === DATA_SOURCES.REAL && item.verified === true && !item.termEnd && groups.get(item.groupId)?.partyId && pollForceOf(groups.get(item.groupId).partyId) === party.id).map(item => ({ id: item.id, label: item.fullName, region: regionOfCircoscription(item.circoscription), source: DATA_SOURCES.REAL })) : [];
  const known = s.dataset.politicians.filter(item => item.source === DATA_SOURCES.SIMULATION && item.partyId === party.id && !/^persona-quadro-/.test(item.id)).map(item => ({ id: item.id, label: item.displayName, region: item.region ?? null, source: DATA_SOURCES.SIMULATION }));
  return { cadres, politicians: [...real, ...known] };
}
// The office the player would run for in a race, and what bars him from it: the offices he holds (a provincial president is a mayor, a seat in the province needs one in a
// comune, a member of the Government does not run for a territorial office). Never the territory: where he comes from only weighs on the result.
function racePlayerRole(s, race) {
  const check = role => candidacyBlock({ held: heldOfficesOf(s), electionType: race.level, role, electionDate: race.electionDate, municipalVote: nextVoteOf(s, 'comunale') });
  const wanted = RACE_ROLES[race.level];
  const block = check(wanted);
  if (!block) return { role: wanted, block: null };
  const fallback = race.level === 'provinciale' ? 'consigliere' : null;
  const other = fallback ? check(fallback) : block;
  return other ? { role: null, block } : { role: fallback, block: null };
}
function raceChoiceContext(s, people = {}) {
  const game = s.game;
  const party = raceParty(s);
  const player = playerOf(s);
  const home = homePlace(s);
  const pool = racePeople(s, people);
  return {
    today: s.clock.currentDate, leader: raceLeader(s),
    career: { id: s.career.id, playerId: s.career.playerId, playerLabel: player?.displayName ?? 'Tu', partyId: party.id, partyLabel: party.label },
    player: Boolean(player),
    playerBlock: race => racePlayerRole(s, race).block,
    playerRole: race => racePlayerRole(s, race).role,
    cadres: pool.cadres, politicians: pool.politicians, people: s.dataset.politicians,
    homeVotes: (game?.elections ?? []).map(item => ({ id: item.id, type: item.type, label: item.label, electionDate: item.electionDate, status: item.status })),
    from: { region: home.region, municipality: home.municipality, municipalityCode: home.municipalityCode, provinceCode: home.provinceCode },
    committee: race => raceCommittees(s, race)?.strength ?? 0,
    standing: game ? Math.round(standingFactors({ game, stats: statsOf(s), parliament: s.parliament }).territorialRep) : null
  };
}
// The slate of the races in front of the leader: the real calendar of the votes, the territories the party weighs most in, the nearest first.
function refreshRaces(s, today = s.clock.currentDate) {
  if (!s.game || s.game.status === 'ended' || !localElections || !raceLeader(s)) return s;
  const home = homePlace(s);
  const world = s.world;
  const own = world?.playerPartyId ?? null;
  const weights = {};
  const weightOf = region => !world || !own ? 0 : (weights[region] ??= regionalShares(world, region).find(row => row.partyId === own)?.share ?? 0);
  const fresh = buildSlate({ today, calendar: localElections, units: raceData.units, municipalities: raceData.municipalities, avoid: { regions: [home.region], provinceCodes: [home.provinceCode], municipalityCodes: [home.municipalityCode] }, weightOf, hasProvincial: hasProvincialLevel });
  const merged = mergeSlate(racesOf(s), fresh, today);
  return JSON.stringify(merged) === JSON.stringify(racesOf(s)) ? s : withRaces(s, merged);
}
const replaceRace = (s, race) => withRaces(s, racesOf(s).map(item => item.id === race.id ? race : item));
const raceTitleOf = outcome => outcome.result.won ? 'vince' : outcome.result.mandate ? 'entra in consiglio all’opposizione' : 'non è eletto';
// A race the party runs by itself: the campaign of the campaign-engine for the candidate the leader chose, from the opening of the candidacies to the vote, with what the
// game has today: the weight of the party in the polls of the territory, its programme (the agenda of its force), the candidate, his rooting, the committees of the
// party, the rivals, the allies of the party and the course of its polls. What comes out is kept in the race: standing, polls, result, office.
function settleSimulatedRace(s, raceId, date) {
  const race = racesOf(s).find(item => item.id === raceId);
  if (!race?.candidacy) return s;
  const party = raceParty(s);
  const place = racePlaceOf(race);
  const candidacy = race.candidacy;
  const committees = raceCommittees(s, race);
  const rooting = rootingOf({ race, from: candidacy.from ?? {}, committee: committees?.strength ?? 0 }).points;
  const stats = profileStats(candidacy.kind);
  const standIn = { id: candidacy.personId, displayName: candidacy.label, partyId: party.id, region: place.region, municipality: place.municipality, province: place.provinceName, territoryId: null, roleId: null };
  const context = campaignContextOf(s, { electionType: race.level, racePlace: place });
  const poll = campaignPollBonus(s.world, race.level, stats, s.game.relations, { region: place.region });
  const row = s.world?.polls?.at(-1)?.results?.find(item => item.partyId === s.world?.playerPartyId);
  const args = {
    career: { id: `${s.career.id}|${race.id}`, initialLevel: s.career.initialLevel, territoryId: null, partyId: party.id }, player: standIn,
    statistics: Object.entries(stats).map(([metric, value]) => ({ subjectId: standIn.id, metric, value })), offices: [], territories: [], partyCatalog: raceCatalog(s), currentDate: race.windowOpensAt,
    config: { ...context, rivalHistory: [], endorsers: [], electionType: race.level, role: RACE_ROLES[race.level], objective: 'seat', municipalityBand: race.level === 'comunale' ? 'oltre-15000' : undefined, realCandidates: [] }
  };
  const campaign = runRace(args, { rooting, pollShare: poll.share ?? null, pollBonus: poll.bonus, partyTrend: row?.delta ?? 0, resources: committees ? { money: committees.funds, volunteers: committees.volunteers, organization: committees.organization } : null });
  const outcome = raceOutcome(campaign, race);
  if (!outcome) return s;
  const text = `${race.label}: ${candidacy.label} ${raceTitleOf(outcome)} (${String(outcome.result.share).replace('.', ',')}%)`;
  let next = replaceRace(s, { ...race, status: 'held', campaignId: campaign.id, result: outcome.result, polls: outcome.polls, office: outcome.office, history: [{ date, text: `Voto del ${formatDate(race.electionDate)}: ${outcome.result.outcomeLabel ?? raceTitleOf(outcome)} · ${String(outcome.result.share).replace('.', ',')}%`, source: DATA_SOURCES.SIMULATION }, ...race.history] });
  // A simulated person elected gets the office in the records of the game; a real politician stays as the real data have him (the office is only in the race).
  if (outcome.office && candidacy.personRef?.source === DATA_SOURCES.SIMULATION) next = { ...next, dataset: { ...next.dataset, offices: [...next.dataset.offices, { id: `incarico-gara-${hashText(`${race.id}|${candidacy.personId}`).toString(36)}`, title: outcome.office.title, institution: race.label.replace(/^[^·]+· /, ''), level: race.level, side: outcome.office.side, politicianId: candidacy.personId, territoryId: null, startDate: race.electionDate, endDate: null, source: DATA_SOURCES.SIMULATION }] } };
  const rules = RACE_RULES.effects;
  const delta = outcome.result.won ? rules[race.level] : outcome.result.mandate ? 0 : -rules[race.level] * rules.defeat;
  const own = next.world?.playerPartyId;
  if (next.world) next = { ...next, world: addWorldEffects(next.world, own && delta ? [{ partyId: own, delta: Math.round(delta * 1000) / 1000, remaining: 6, cause: 'gara-territoriale', label: race.label }] : [], date, { title: text, body: `Il candidato del partito ${raceTitleOf(outcome)}: ${outcome.result.winner ? `primo ${outcome.result.winner.label} con il ${String(outcome.result.winner.percent).replace('.', ',')}%` : 'voto concluso'} (corsa simulata, senza gestione giornaliera).`, tone: outcome.result.won ? 'good' : 'neutral', icon: 'ballot' }) };
  if (next.game) {
    const game = deepCopy(next.game);
    game.party?.history?.push({ week: game.week.index, date, text, source: DATA_SOURCES.SIMULATION });
    next = { ...next, game: addDiary(game, { kind: 'elezioni', date, title: text, lines: [`Radicamento ${candidacy.rooting >= 0 ? '+' : ''}${String(Math.round(rooting * 10) / 10).replace('.', ',')} · ${campaign.polls?.waves?.length ?? 0} onde di sondaggi`, ...(outcome.office ? [outcome.office.title] : [])], tone: outcome.result.won ? 'good' : 'neutral' }) };
  }
  return next;
}
// The weekly step of the races: the slate renews, the candidacies of the races that closed without a player's campaign lapse, the races nobody plays are run at their vote.
function tickRaces(s, date) {
  if (!s.game || s.game.status === 'ended') return s;
  let next = refreshRaces(s, date);
  for (const race of racesOf(next)) {
    const current = racesOf(next).find(item => item.id === race.id);
    if (current.status === 'confirmed' && current.candidacy?.kind === 'player' && date > current.windowClosesAt) next = replaceRace(next, { ...current, status: 'missed', history: [{ date, text: 'Le candidature si sono chiuse senza che la campagna cominciasse: nessun candidato.', source: DATA_SOURCES.SIMULATION }, ...current.history] });
    else if (raceDue(current, date)) next = settleSimulatedRace(next, current.id, date);
  }
  return next;
}
// The race the player played ended with his campaign: the result is kept in the race, as for the others.
function closeRaceCampaign(s, campaign) {
  const race = racesOf(s).find(item => item.id === campaign.raceId);
  if (!race) return s;
  const outcome = raceOutcome(campaign, race);
  if (!outcome) return s;
  return replaceRace(s, { ...race, status: 'held', campaignId: campaign.id, result: outcome.result, polls: outcome.polls, office: outcome.office, history: [{ date: campaign.currentDate, text: `Voto del ${formatDate(race.electionDate)}: ${outcome.result.outcomeLabel ?? raceTitleOf(outcome)} · ${String(outcome.result.share).replace('.', ',')}% (la campagna l’hai guidata tu)`, source: DATA_SOURCES.SIMULATION }, ...race.history] });
}

function campaignContextOf(s, config) {
  const type = config.electionType;
  const local = ['comunale', 'provinciale', 'regionale'].includes(type);
  const game = s.game;
  // A race of the party in a territory that may not be the player's own has a place of its own: no administration of his to answer for, the polls of that region.
  const place = config.racePlace ?? homePlace(s);
  const date = s.clock.currentDate;
  const context = { roots: game ? { territorial: Math.round(standingFactors({ game, stats: statsOf(s), parliament: s.parliament }).territorialRep) } : {} };
  if (local && !config.racePlace) {
    const kind = INSTITUTION_OF[type];
    const sameKind = localOf(s).institutions.filter(item => item.kind === kind);
    const active = sameKind.find(item => item.status === 'active') ?? null;
    // Whoever led an administration that has ended is still remembered for it; a councillor of the past is not.
    const inst = active ?? [...sameKind].reverse().find(item => ['sindaco', 'presidente'].includes(item.playerRole)) ?? null;
    const record = inst ? mandateRecord(inst, { date, former: !active }) : null;
    if (record) {
      context.mandate = record;
      if (active && !record.leads && record.side !== 'maggioranza') context.field = { incumbent: { score: record.score, confidence: record.confidence, label: `l’amministrazione di ${inst.name}` } };
    }
  }
  // The weight of the parties where the vote is: the local polls for a comune, the regional ones for a province and a region, the national ones otherwise.
  const world = s.world;
  const rows = !world ? [] : type === 'comunale' && !config.racePlace ? localShares(world) : ['comunale', 'provinciale', 'regionale'].includes(type) ? regionalShares(world, place.region) : (world.polls?.at(-1)?.results ?? []);
  if (rows.length) context.partyWeights = Object.fromEntries(rows.map(row => [row.partyId, row.share]));
  // The place of the race (a local field differs from a territory to the next), what every force of the world stands for, and, in a general or European
  // vote, the roster of the forces that stand: the very ids of the polls.
  context.place = { municipalityCode: place.municipalityCode ?? null, municipality: place.municipality ?? null, region: place.region ?? null };
  const electorate = electorateFor(type, place);
  if (electorate) context.electorate = electorate;
  if (world) {
    context.forces = forceProfiles(world);
    if (NATIONAL_TYPES.includes(type)) context.roster = electionRoster(world, { type, regionId: regionIdOf(place.region), precedent: [...precedentNational] });
  }
  // The polls know some parties under another force: the parties that a list measured as one force brings together (SI and EV inside AVS) and the aliases of a registered party.
  // A local race fields the force the polls measure, never one of its components; and the list that holds the player's own party is not its opponent.
  const ownPartyId = playerOf(s)?.partyId ?? s.career.partyId ?? null;
  context.excluded = [...Object.keys(realForceMap), ...(ownPartyId && pollForceOf(ownPartyId) !== ownPartyId ? [pollForceOf(ownPartyId)] : [])];
  context.allies = alliesOf(s, type);
  context.rivalHistory = game?.rivalRegistry ?? [];
  context.endorsers = decayEndorsers(game?.endorsers ?? [], date);
  return context;
}
// What a closed campaign leaves in the game besides the result: the rivals remember it, the subjects who backed the player too, and what was
// promised to them (a place on the list, a commitment, a seat in the giunta) becomes a relation that rises with a victory and falls with a defeat.
function settleCampaignMemory(s, campaign, ledger) {
  if (!s.game) return s;
  const won = Boolean((s.campaign ?? campaign).result?.personalMandate);
  const date = campaign.currentDate;
  const game = deepCopy(s.game);
  game.rivalRegistry = mergeRivalRegistry(game.rivalRegistry ?? [], ledger, date);
  game.endorsers = mergeEndorsers(game.endorsers ?? [], campaign, { date, won });
  const debts = campaignDebts(campaign, { won });
  game.relations = game.relations.map(item => debts.relations[item.id] ? { ...item, value: Math.max(0, Math.min(100, round2(item.value + debts.relations[item.id]))) } : item);
  const backers = (campaign.endorsements?.given ?? []).length;
  if (won && backers) remember(game, { date, kind: 'alleanza', text: `${backers === 1 ? 'Un sostegno pubblico' : `${backers} sostegni pubblici`} in campagna: ${campaign.electionLabel}`, region: ['comunale', 'provinciale', 'regionale'].includes(campaign.electionType) ? (playerOf(s)?.region ?? null) : null, weight: 0.4 });
  const lines = [];
  const met = ledger.filter(item => item.memory.length);
  if (met.length) lines.push(`I rivali ricordano la campagna: ${met.slice(0, 3).map(item => `${item.label} (${item.relation >= 60 ? 'rapporto buono' : item.relation <= 40 ? 'rapporto teso' : 'rapporto neutro'})`).join(', ')}`);
  if (backers) lines.push(`Sostegni ricevuti: ${backers} · impegni da mantenere: ${debts.commitments}`);
  const entry = (game.log ?? []).findIndex(item => item.id === `diario-voto-${campaign.id}`);
  if (lines.length && entry >= 0) game.log[entry] = { ...game.log[entry], lines: [...(game.log[entry].lines ?? []), ...lines] };
  return { ...s, game };
}
// A campaign closed by the vote: a national vote (general or European) is held first, on the real map, and its result
// becomes the campaign's; then the career takes the consequences.
function closeCampaign(currentState, campaign) {
  let next = currentState;
  // The rivals remember how the campaign went, whatever the national vote then makes of the result.
  const ledger = rivalLedger(campaign);
  if (NATIONAL_TYPES.includes(campaign.electionType)) next = holdNationalVote({ ...currentState, campaign }, campaign.electionType, { campaign, date: campaign.currentDate });
  const closed = settleCampaignMemory(applyCampaignResult(next, next.campaign ?? campaign), next.campaign ?? campaign, ledger);
  return (next.campaign ?? campaign).raceId ? closeRaceCampaign(closed, next.campaign ?? campaign) : closed;
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
  // (a race lost in another territory leaves the player's own term of that kind as it is)
  let dataset=campaign.racePlace&&!result.personalMandate?{...currentState.dataset,statistics}:closeTermOffices({...currentState.dataset,statistics},player.id,campaign.electionType,campaign.currentDate);
  const outcome=result.outcome??{};
  const report=electionReport(campaign,result,aftermath);
  const historyEntry={campaignId:campaign.id,electionType:campaign.electionType,electionLabel:campaign.electionLabel,role:campaign.candidacy?.role??null,winnerCandidateId:result.winnerGroupId??null,percent:result.playerShare,seats:result.playerSeats,personalMandate:result.personalMandate,objectiveMet:result.objectiveMet,outcome:outcome.code??null,outcomeLabel:outcome.label??null,position:outcome.position??null,expectation:outcome.expectation??null,side:outcome.side??null,date:campaign.currentDate,candidates:report.candidates,poll:report.poll,source:DATA_SOURCES.SIMULATION};
  let career={...currentState.career,lastCampaignId:campaign.id,lastElectionResult:{...historyEntry,votes:result.playerVotes},lastElectionReport:report,electionHistory:[...(currentState.career.electionHistory??[]),historyEntry],partyImpactHistory:[...(currentState.career.partyImpactHistory??[]),{campaignId:campaign.id,partyId:campaign.partyId,consensusChange:campaign.partyImpact.consensusChange,outcome:campaign.partyImpact.outcome,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION}]};
  if(result.personalMandate&&aftermath.office) {
    const title=aftermath.office.title;
    const office={id:makeId('incarico-simulato'),title,institution:campaign.racePlace?institutionName(INSTITUTION_OF[campaign.electionType],campaign.racePlace):campaign.electionType==='comunale'?`Comune di ${player.municipality}`:campaign.electionType==='provinciale'?institutionName('provincia',{...homePlace(currentState),municipality:player.municipality}):campaign.electionType==='regionale'?`Regione ${player.region}`:campaign.electionType==='europee'?'Parlamento europeo':'Repubblica italiana',level:campaign.electionType,side:aftermath.office.side??null,via:aftermath.office.via??null,politicianId:player.id,territoryId:campaign.territoryId,startDate:campaign.currentDate,endDate:null,source:DATA_SOURCES.SIMULATION};
    dataset={...dataset,offices:[...dataset.offices,office],politicians:dataset.politicians.map(item=>item.id===player.id?{...item,roleId:office.id}:item)};
    career.status='elected';
  }
  // A local or European vote moves the level of the career (a seat in Parliament stays the reference while it lasts).
  if(LOCAL_LEVELS[campaign.electionType]&&!career.parliamentContext) {
    const level=localCareerLevel(dataset.offices,player.id);
    if(level||Object.values(LOCAL_LEVELS).includes(career.currentLevel)) career.currentLevel=level;
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
    remember(game,{date:campaign.currentDate,kind:aftermath.memory.kind,text:`${campaign.electionLabel}: ${String(Math.round(result.playerShare*10)/10).replace('.',',')}% · ${outcome.label??(result.personalMandate?'mandato conquistato':'nessun mandato')}`,region:['comunale','provinciale','regionale'].includes(campaign.electionType)?player.region:null,weight:aftermath.memory.weight});
    game.relations=game.relations.map(item=>item.id==='leadership'&&aftermath.party?{...item,value:Math.max(0,Math.min(100,item.value+aftermath.party.leadership))}:item);
    game.log=[{id:`diario-voto-${campaign.id}`,week:game.week.index,date:campaign.currentDate,kind:'elezioni',title:`${campaign.electionLabel}: ${outcome.label??(result.personalMandate?'mandato conquistato':'nessun mandato')}`,lines:[`${String(Math.round(result.playerShare*10)/10).replace('.',',')}% · ${outcome.positionLabel??''}${outcome.expectationLabel?` · ${outcome.expectationLabel.toLowerCase()}`:''}`,...aftermath.lines,result.objectiveMet?'Obiettivo raggiunto':'Obiettivo mancato'].filter(Boolean),tone:aftermath.tone==='good'?'good':aftermath.tone==='neutral'?'neutral':'bad',source:'simulation'},...game.log].slice(0,40);
    // The committees of the territory feel the vote.
    if(game.party?.org?.committees?.length) {
      const home=homePlace(currentState);
      const territory=committeesAfterVote(game.party.org,{mandate:Boolean(result.personalMandate),electionType:campaign.electionType,region:home.region,provinceCode:home.provinceCode,municipality:home.municipality,week:game.week.index,cadres:game.party.life?.cadres??[]});
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
  const world=currentState.world?applyWorldSignals(currentState.world,[{type:'election',electionType:campaign.electionType,label:campaign.electionLabel,share:result.playerShare,mandate:result.personalMandate,pollShare:report.pollShare??null}],campaign.currentDate):currentState.world;
  let next={...currentState,dataset,career,game,world,parliament:withCapital(currentState.parliament,game)};
  // The council (or the European Parliament) where the vote seats the player; a lost vote ends the previous term.
  const kind=INSTITUTION_OF[campaign.electionType];
  // A race held in another territory does not end the term of the player's own: the seat is taken only when the vote is won (and replaces the one of the same kind).
  if(kind) next=result.personalMandate&&aftermath.office?withInstitution(next,institutionFromResult(next,campaign,result)):campaign.racePlace?next:closeInstitution(next,kind,campaign.currentDate);
  // The office won excludes some of those held (a regional seat the Chambers, a Chamber the European Parliament...): they lapse.
  // The office actually won (a mayoral candidate may enter the council from the opposition benches), not the one run for.
  const wonOffice=campaign.electionType==='politiche'?(chamber?(chamber==='camera'?'deputato':'senatore'):null):institutionOffice(localOf(next).institutions.find(item=>item.kind===kind&&item.status==='active'));
  if(result.personalMandate&&aftermath.office) next=lapseConflicts(next,wonOffice,campaign.currentDate);
  if(parliament===currentState.parliament) return withObjectives(next);
  // Route the parliamentary change through the shared bookkeeping (history, offices, events).
  return withObjectives(computeParliamentUpdate(next,withCapital(parliament,game),currentState.ui.toast));
}
