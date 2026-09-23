import { DATA_SOURCES, emptyDataset, isSelectableParty } from '../data/schema.js';
import { makeDemoParties, makeDemoState } from '../data/demo.js?v=20260923-2';
import { CAREER_LEVELS, initialCareerStatistics } from '../data/regions.js';
import { storage } from './storage.js';
import { advanceDays } from './time.js';
import { validateNewCareerDraft } from './career-rules.js';
import { advanceCampaign, breakCampaignAlliance, createCampaign, decideCampaignEvent, negotiateCampaignAlliance, performCampaignActivity } from './campaign-engine.js';

const storedState = storage.load();
function hydrateState(saved) {
  if (!saved) return makeDemoState();
  if (saved.version >= 4) return saved;
  if (saved.version >= 3) return { ...saved, version:4, campaign:saved.campaign ?? null };
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
    fresh.version = 4;
    fresh.campaign = saved.campaign ?? null;
  }
  return fresh;
}
const hydratedState=hydrateState(storedState);
let state = { ...hydratedState, version:4, campaign:hydratedState.campaign ?? null };
let lastSaved = storedState ? 'Salvataggio caricato' : 'Nuova carriera demo';
if (storedState && storedState.version < 4) {
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
    state = { ...state, campaign, clock: { ...state.clock, currentDate } };
    const week = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(`${state.clock.currentDate}T12:00:00`));
    state = { ...state, dataset: { ...state.dataset, events: [...state.dataset.events, { id: makeId('evento'), title: campaign?.status === 'active' ? 'Giornata di campagna' : campaign?.status === 'finished' ? 'Campagna conclusa' : 'Agenda aggiornata', date: state.clock.currentDate, category: campaign?.status === 'active' ? 'campagna' : 'agenda', status: 'da pianificare', source: DATA_SOURCES.SIMULATION }] }, ui: { ...state.ui, toast: campaign?.status === 'finished' ? 'Voto concluso: risultati disponibili' : `Tempo avanzato al ${week}` } };
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
    state = { ...state, campaign, clock:{...state.clock,currentDate:campaign.currentDate}, ui:{...state.ui,toast:campaign.history[0]?.text ?? 'Attività completata'} };
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
  reset() {
    state = { ...makeDemoState(), version:4, campaign:null };
    try { storage.clear(); } catch { /* storage may be unavailable */ }
    lastSaved = 'Nuova carriera demo'; emit();
  },
  createCareer(draft, realParties = []) {
    const selectableParties = [...state.dataset.parties.filter(isSelectableParty), ...realParties.filter(party => party?.source === DATA_SOURCES.REAL && party.verified === true)];
    const errors = validateNewCareerDraft({ ...draft, currentDate: state.clock.currentDate }, selectableParties);
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
    const territoryId = draft.initialLevel === 'comunale' ? municipalityId : draft.initialLevel === 'regionale' ? regionId : nationId;
    if (draft.initialLevel === 'nazionale') territories.push({ id: nationId, kind: 'stato', name: 'Italia', parentId: null, source: DATA_SOURCES.USER });

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
      const statisticId = makeId(`stat-${metric}`);
      datasetStatistics.push({ id: statisticId, subjectId: playerId, metric, value, unit: '100', asOf: state.clock.currentDate, source: DATA_SOURCES.SIMULATION });
      return statisticId;
    });
    const player = {
      id: playerId, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(),
      displayName: `${draft.firstName.trim()} ${draft.lastName.trim()}`, birthDate, gender: draft.gender,
      region: draft.region, municipality: draft.municipality.trim(), previousProfession: profession,
      partyId, territoryId, roleId: makeId('incarico'), source: DATA_SOURCES.USER, createdAt: state.clock.currentDate
    };
    const office = {
      id: player.roleId, title: level.office, institution: draft.initialLevel === 'comunale' ? `Comune di ${draft.municipality.trim()}` : draft.initialLevel === 'regionale' ? `Regione ${draft.region}` : 'Repubblica italiana',
      level: draft.initialLevel, politicianId: playerId, territoryId, startDate: state.clock.currentDate, endDate: null, source: DATA_SOURCES.USER
    };
    const dataset = emptyDataset();
    dataset.parties = parties;
    dataset.politicians = [player];
    dataset.territories = territories;
    dataset.offices = [office];
    dataset.statistics = datasetStatistics;
    state = {
      version: 4,
      campaign: null,
      career: { id, name: `${player.displayName} — ${level.shortLabel}`, playerId, partyId, initialLevel: draft.initialLevel, territoryId, statisticsIds: statisticIds, startedAt: state.clock.currentDate, createdAt: new Date().toISOString(), status: 'active' },
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
  if(campaign.candidacy.incumbent) offices=offices.map(item=>item.id===player.roleId?{...item,endDate:campaign.currentDate}:item);
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
  return {...currentState,dataset,career};
}
