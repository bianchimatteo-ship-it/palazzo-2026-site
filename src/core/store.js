import { DATA_SOURCES, emptyDataset, isSelectableParty } from '../data/schema.js';
import { makeDemoParties, makeDemoState } from '../data/demo.js?v=20260923-2';
import { CAREER_LEVELS, initialCareerStatistics } from '../data/regions.js?v=20260923-3';
import { storage } from './storage.js?v=20260923-3';
import { advanceDays } from './time.js';
import { validateNewCareerDraft } from './career-rules.js?v=20260923-3';
import { advanceCampaign, breakCampaignAlliance, createCampaign, decideCampaignEvent, negotiateCampaignAlliance, performCampaignActivity } from './campaign-engine.js?v=20260923-3';
import { activeMinisters, advanceLaw, advanceParliamentTime, amendLaw, assignMinister, assignPlayerGroup, canManageParliament, compromiseLaw, contestCommitteeRole, createParliamentState, enterParliament, formGovernment, leaveParliament, negotiateGovernmentSupport, negotiateLaw, normalizeParliamentState, proposeLaw, reviseGovernmentCoalition, triggerGovernmentCrisis, voteGovernmentConfidence } from './parliament-engine.js?v=20260923-3';

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
  if (saved.version >= 4) return { ...saved, version: 5, parliament: saved.parliament ?? null };
  if (saved.version >= 3) return { ...saved, version: 5, campaign: saved.campaign ?? null, parliament: null };
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
    fresh.version = 5;
    fresh.campaign = saved.campaign ?? null;
    fresh.parliament = saved.parliament ?? null;
  }
  return fresh;
}
const hydratedState=hydrateState(storedState);
let state = { ...hydratedState, version:5, campaign:hydratedState.campaign ?? null, parliament:normalizeParliamentState(hydratedState.parliament) };
let lastSaved = storedState ? (isRestorableSave(storedState) ? 'Salvataggio caricato' : 'Salvataggio non valido: copia conservata') : 'Nuova carriera demo';
if (isRestorableSave(storedState) && storedState.version < 5) {
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
const playerStat = (currentState, metric, fallback = 50) => currentState.dataset.statistics.find(item => item.subjectId === currentState.career.playerId && item.metric === metric)?.value ?? fallback;
const playerStats = currentState => Object.fromEntries(['influence', 'reputation', 'experience'].map(metric => [metric, playerStat(currentState, metric)]));
const chamberInstitution = chamber => chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica';

// Simulated offices mirror parliamentary and government roles in the career record.
function openOffice(dataset, office) {
  return { ...dataset, offices: [...dataset.offices, { level: 'parlamentare', endDate: null, source: DATA_SOURCES.SIMULATION, ...office }] };
}
function closeOffices(dataset, ids, date) {
  const closing = new Set(ids.filter(Boolean));
  if (!closing.size) return dataset;
  return { ...dataset, offices: dataset.offices.map(item => closing.has(item.id) && !item.endDate ? { ...item, endDate: date } : item) };
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
  return { ...currentState, parliament, dataset, career, ui: { ...currentState.ui, toast } };
}
function applyParliamentUpdate(...args) {
  state = computeParliamentUpdate(...args);
  persist(); emit();
  return state;
}

// Parliamentary actions consume calendar time, except during an active campaign:
// there the campaign owns the calendar, so the two clocks can never drift apart.
function atParliamentDate(days = 1) {
  if (state.campaign?.status === 'active') return state;
  return { ...state, clock: { ...state.clock, currentDate: advanceDays(state.clock.currentDate, days) } };
}
const elapsedDays = (from, to) => Math.max(0, Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000));

export const store = {
  getState: () => state,
  getLastSaved: () => lastSaved,
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  navigate(page) { state = { ...state, ui: { ...state.ui, activePage: page } }; emit(); },
  advance(days = 7) {
    let campaign = state.campaign;
    let currentDate = advanceDays(state.clock.currentDate, days);
    if (campaign?.status === 'active') {
      campaign = advanceCampaign(campaign, days);
      currentDate = campaign.currentDate;
    }
    const parliament = advanceParliamentTime(state.parliament, elapsedDays(state.clock.currentDate, currentDate), currentDate, { influence: playerStat(state, 'influence') });
    state = { ...state, campaign, parliament, clock: { ...state.clock, currentDate } };
    const week = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(`${state.clock.currentDate}T12:00:00`));
    const inParliament = Boolean(parliament?.player) && campaign?.status !== 'active' && campaign?.status !== 'finished';
    state = { ...state, dataset: { ...state.dataset, events: [...state.dataset.events, { id: makeId('evento'), title: campaign?.status === 'active' ? 'Giornata di campagna' : campaign?.status === 'finished' ? 'Campagna conclusa' : inParliament ? 'Settimana di lavori parlamentari' : 'Agenda aggiornata', date: state.clock.currentDate, category: campaign?.status === 'active' ? 'campagna' : inParliament ? 'parlamento' : 'agenda', status: 'da pianificare', source: DATA_SOURCES.SIMULATION }] }, ui: { ...state.ui, toast: campaign?.status === 'finished' ? 'Voto concluso: risultati disponibili' : `Tempo avanzato al ${week}` } };
    if (campaign?.status === 'finished' && state.career.lastCampaignId !== campaign.id) state = applyCampaignResult(state,campaign);
    persist(); emit();
  },
  save() { persist(); state = { ...state, ui: { ...state.ui, toast: 'Carriera salvata' } }; emit(); },
  clearCampaign() { state={...state,campaign:null,ui:{...state.ui,activePage:'elezioni',toast:'Pronta per una nuova elezione'}}; persist(); emit(); },
  startCampaign(config, partyCatalog = []) {
    if (state.campaign?.status === 'active') throw new Error('Concludi o riprendi la campagna già in corso.');
    const player = state.dataset.politicians.find(item => item.id === state.career.playerId);
    const campaign = createCampaign({ career:state.career, player, statistics:state.dataset.statistics, offices:state.dataset.offices, territories:state.dataset.territories, partyCatalog:[...state.dataset.parties,...partyCatalog], currentDate:state.clock.currentDate, config });
    state = { ...state, campaign, ui:{...state.ui,activePage:'elezioni',toast:'Campagna iniziata'} };
    persist(); emit();
    return campaign;
  },
  performCampaignActivity(activityId, options = {}) {
    const campaign = performCampaignActivity(state.campaign,activityId,options);
    const parliament = advanceParliamentTime(state.parliament, elapsedDays(state.clock.currentDate, campaign.currentDate), campaign.currentDate, { influence: playerStat(state, 'influence') });
    state = { ...state, campaign, parliament, clock:{...state.clock,currentDate:campaign.currentDate}, ui:{...state.ui,toast:campaign.history[0]?.text ?? 'Attività completata'} };
    if(campaign.status==='finished'&&state.career.lastCampaignId!==campaign.id) state=applyCampaignResult(state,campaign);
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
  initializeParliament(realGroups = []) {
    const groups = realGroups.filter(group => group?.source === DATA_SOURCES.REAL && group.verified === true);
    if (!groups.length) return state.parliament;
    const player = state.dataset.politicians.find(item => item.id === state.career.playerId);
    const context = state.career.parliamentContext ?? null;
    const chamber = context?.chamber ?? null;
    let parliament = normalizeParliamentState(state.parliament);
    const hasChambers = parliament?.chambers.camera.groups.length && parliament.chambers.senato.groups.length;
    if (!hasChambers) {
      parliament = createParliamentState({ career: { ...state.career, parliamentContext: context }, player, groups, currentDate: state.clock.currentDate, politicalCapital: playerStat(state, 'influence') });
    } else if (chamber && parliament.player?.chamber !== chamber) {
      parliament = enterParliament(parliament, { politicianId: player?.id ?? null, chamber, groupId: context.groupId ?? null, territoryName: context.territoryName ?? player?.region ?? null, currentDate: state.clock.currentDate });
    } else if (!chamber && parliament.player) {
      parliament = leaveParliament(parliament, state.clock.currentDate, 'Mandato non più attivo nella carriera');
    } else {
      if (parliament !== state.parliament) state = { ...state, parliament };
      return state.parliament;
    }
    return applyParliamentUpdate(state, parliament, state.ui.toast ?? null).parliament;
  },
  contestCommitteeRole() {
    const next = atParliamentDate(1);
    const result = contestCommitteeRole(state.parliament, next.clock.currentDate, playerStats(state));
    const player = state.dataset.politicians.find(item => item.id === state.career.playerId);
    const open = result.success ? [{ id: roleOfficeId(result.appointment), title: `${result.role.title} (scenario)`, institution: chamberInstitution(state.parliament.player.chamber), politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    const deltas = result.success ? { influence: 2, reputation: 1, notoriety: 1 } : { influence: -1, reputation: -0.5 };
    return applyParliamentUpdate(next, result.parliament, result.success ? `Incarico conquistato: ${result.role.title}` : 'Competizione interna non vinta', deltas, { open });
  },
  joinParliamentaryGroup(groupId) {
    if (!state.parliament) throw new Error('Carica prima i dati delle Camere e dei gruppi.');
    const next = atParliamentDate(1);
    const changing = Boolean(state.parliament.player?.groupId);
    const parliament = assignPlayerGroup(state.parliament, groupId, next.clock.currentDate);
    return applyParliamentUpdate(next, parliament, changing ? 'Cambio di gruppo registrato' : 'Gruppo di riferimento aggiornato', changing ? { reputation: -2, influence: -1 } : { influence: 1 });
  },
  proposeLaw(draft) {
    if (!canManageParliament(state.parliament)) throw new Error('Per presentare una legge devi avere un percorso parlamentare e un gruppo di riferimento.');
    const next = atParliamentDate(1);
    const result = proposeLaw(state.parliament, { ...draft, currentDate: next.clock.currentDate });
    applyParliamentUpdate(next, result.parliament, 'Proposta depositata', { experience: 0.5, influence: 0.5 });
    return result.law;
  },
  amendLaw(lawId, text) {
    const next = atParliamentDate(1);
    return applyParliamentUpdate(next, amendLaw(state.parliament, lawId, text, next.clock.currentDate), 'Emendamento registrato');
  },
  negotiateLaw(lawId, groupId) {
    const next = atParliamentDate(2);
    return applyParliamentUpdate(next, negotiateLaw(state.parliament, lawId, groupId, next.clock.currentDate), 'Trattativa legislativa aggiornata', { influence: 0.5 });
  },
  compromiseLaw(lawId) {
    const next = atParliamentDate(1);
    return applyParliamentUpdate(next, compromiseLaw(state.parliament, lawId, next.clock.currentDate), 'Compromesso registrato');
  },
  advanceLaw(lawId, action) {
    const next = atParliamentDate(action === 'complete-commission' ? 7 : action === 'transmit' ? 2 : 1);
    const result = advanceLaw(state.parliament, lawId, action, next.clock.currentDate);
    const finished = ['approved', 'rejected'].includes(result.law.stage);
    const delta = finished ? (result.law.stage === 'approved' ? { reputation: 1, influence: 1, experience: 1, notoriety: 0.5 } : { reputation: -0.5, experience: 0.5 }) : { influence: 0.25 };
    const toast = result.law.stage === 'approved' ? 'Legge approvata in simulazione' : result.law.stage === 'rejected' ? 'Votazione conclusa: proposta respinta' : 'Iter legislativo aggiornato';
    return applyParliamentUpdate(next, result.parliament, toast, delta);
  },
  formGovernment(groupIds) {
    const next = atParliamentDate(7);
    return applyParliamentUpdate(next, formGovernment(state.parliament, groupIds, next.clock.currentDate), 'Trattativa di governo aperta', { influence: 0.5 });
  },
  negotiateGovernmentSupport(groupId) {
    const next = atParliamentDate(2);
    return applyParliamentUpdate(next, negotiateGovernmentSupport(state.parliament, groupId, next.clock.currentDate), 'Impegno di sostegno registrato', { influence: 0.5 });
  },
  reviseGovernmentCoalition(groupIds) {
    const next = atParliamentDate(3);
    return applyParliamentUpdate(next, reviseGovernmentCoalition(state.parliament, groupIds, next.clock.currentDate), 'Coalizione aggiornata: serve una nuova fiducia');
  },
  assignMinister(portfolio, groupId, appointee = 'group') {
    const next = atParliamentDate(1);
    const player = state.dataset.politicians.find(item => item.id === state.career.playerId);
    const parliament = assignMinister(state.parliament, portfolio, groupId, next.clock.currentDate, { appointee, appointeeLabel: player?.displayName });
    const appointment = parliament.government.ministers.at(-1);
    const open = appointment.playerAppointed ? [{ id: ministerOfficeId(appointment), title: `Ministro · ${portfolio} (scenario)`, institution: 'Governo della Repubblica (scenario di gioco)', level: 'governo', politicianId: player?.id ?? null, territoryId: player?.territoryId ?? null, startDate: next.clock.currentDate }] : [];
    return applyParliamentUpdate(next, parliament, appointment.playerAppointed ? `Sei ministro: ${portfolio}` : 'Incarico simulato distribuito', appointment.playerAppointed ? { influence: 3, notoriety: 3, reputation: 1 } : {}, { open });
  },
  voteGovernmentConfidence() {
    const next = atParliamentDate(3);
    const parliament = voteGovernmentConfidence(state.parliament, next.clock.currentDate);
    const passed = parliament.government?.status === 'active';
    const government = parliament.government;
    const inCoalition = [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(state.parliament.player?.groupId);
    const deltas = inCoalition ? (passed ? { influence: 2, reputation: 1 } : { influence: -1, reputation: -1 }) : (passed ? {} : { influence: 1 });
    return applyParliamentUpdate(next, parliament, passed ? 'Fiducia ottenuta in simulazione' : 'Fiducia non ottenuta: il governo cade', deltas);
  },
  triggerGovernmentCrisis() {
    const next = atParliamentDate(1);
    return applyParliamentUpdate(next, triggerGovernmentCrisis(state.parliament, next.clock.currentDate), 'Crisi di governo aperta', { influence: -0.5 });
  },
  reset() {
    state = { ...makeDemoState(), version:5, campaign:null, parliament:null };
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
    state = {
      version: 5, campaign: null, parliament, career,
      clock: { ...state.clock }, dataset,
      ui: { activePage: 'panoramica', saveName: 'Salvataggio locale', toast: 'Carriera iniziata' }
    };
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
  let offices=[...currentState.dataset.offices];
  const endsIncumbency=campaign.candidacy.incumbent&&campaign.electionType==='politiche';
  if(endsIncumbency) offices=offices.map(item=>item.id===player.roleId&&!item.endDate?{...item,endDate:campaign.currentDate}:item);
  let dataset={...currentState.dataset,statistics,offices};
  let career={...currentState.career,lastCampaignId:campaign.id,lastElectionResult:{campaignId:campaign.id,electionType:campaign.electionType,percent:result.playerShare,votes:result.playerVotes,seats:result.playerSeats,personalMandate:result.personalMandate,objectiveMet:result.objectiveMet,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION},electionHistory:[...(currentState.career.electionHistory??[]),{campaignId:campaign.id,electionType:campaign.electionType,percent:result.playerShare,seats:result.playerSeats,personalMandate:result.personalMandate,objectiveMet:result.objectiveMet,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION}],partyImpactHistory:[...(currentState.career.partyImpactHistory??[]),{campaignId:campaign.id,partyId:campaign.partyId,consensusChange:campaign.partyImpact.consensusChange,outcome:campaign.partyImpact.outcome,date:campaign.currentDate,source:DATA_SOURCES.SIMULATION}]};
  if(result.personalMandate) {
    const officeTitles={sindaco:'Sindaco',presidente:'Presidente di Regione',consigliere:campaign.electionType==='comunale'?'Consigliere comunale':'Consigliere regionale',deputato:'Deputato',senatore:'Senatore',uninominale:'Deputato',eurodeputato:'Deputato al Parlamento europeo'};
    const title=officeTitles[campaign.candidacy.role]??'Rappresentante eletto';
    const office={id:makeId('incarico-simulato'),title,institution:campaign.electionType==='comunale'?`Comune di ${player.municipality}`:campaign.electionType==='regionale'?`Regione ${player.region}`:campaign.electionType==='europee'?'Parlamento europeo':'Repubblica italiana',level:campaign.electionType,politicianId:player.id,territoryId:campaign.territoryId,startDate:campaign.currentDate,endDate:null,source:DATA_SOURCES.SIMULATION};
    dataset.offices.push(office);
    dataset.politicians=dataset.politicians.map(item=>item.id===player.id?{...item,roleId:office.id}:item);
    career.status='elected';
  }
  // A parliamentary seat won in the campaign opens (or confirms) the mandate; losing as incumbent ends it.
  let parliament=currentState.parliament;
  const chamber=PARLIAMENTARY_CAMPAIGN_ROLES[campaign.candidacy.role];
  const previousContext=currentState.career.parliamentContext??null;
  if(result.personalMandate&&chamber) {
    const sameChamber=previousContext?.chamber===chamber;
    career.currentLevel=chamber==='camera'?'deputato':'senatore';
    career.parliamentContext={mode:'real-context',chamber,groupId:sameChamber?(parliament?.player?.groupId??previousContext.groupId??null):null,territoryName:player.region,via:'campaign',since:campaign.currentDate,source:DATA_SOURCES.SIMULATION};
    if(previousContext&&!sameChamber) career.pastParliamentContexts=[...(career.pastParliamentContexts??[]),{...previousContext,endedAt:campaign.currentDate,reason:'Elezione nell’altra Camera'}];
    if(parliament?.chambers?.camera?.groups?.length) parliament=enterParliament(parliament,{politicianId:player.id,chamber,groupId:career.parliamentContext.groupId,territoryName:player.region,currentDate:campaign.currentDate});
  } else if(endsIncumbency&&previousContext) {
    career.currentLevel=null;
    career.parliamentContext=null;
    career.pastParliamentContexts=[...(career.pastParliamentContexts??[]),{...previousContext,endedAt:campaign.currentDate,reason:'Seggio non confermato alle elezioni'}];
    if(parliament?.player) parliament=leaveParliament(parliament,campaign.currentDate,'Seggio non confermato alle elezioni politiche');
  }
  if(parliament===currentState.parliament) return {...currentState,dataset,career};
  // Route the parliamentary change through the shared bookkeeping (history, offices, events).
  return computeParliamentUpdate({...currentState,dataset,career},parliament,currentState.ui.toast);
}
