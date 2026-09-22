import { DATA_SOURCES, emptyDataset, isSelectableParty } from '../data/schema.js';
import { makeDemoParties, makeDemoState } from '../data/demo.js?v=20260923-1';
import { CAREER_LEVELS, initialCareerStatistics } from '../data/regions.js';
import { storage } from './storage.js';
import { advanceDays } from './time.js';
import { validateNewCareerDraft } from './career-rules.js';

const storedState = storage.load();
function hydrateState(saved) {
  if (!saved) return makeDemoState();
  if (saved.version >= 3) return saved;
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
    fresh.version = 3;
  }
  return fresh;
}
let state = hydrateState(storedState);
let lastSaved = storedState ? 'Salvataggio caricato' : 'Nuova carriera demo';
if (storedState && storedState.version < 3) {
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
    state = { ...state, clock: { ...state.clock, currentDate: advanceDays(state.clock.currentDate, days) } };
    const week = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(`${state.clock.currentDate}T12:00:00`));
    state = { ...state, dataset: { ...state.dataset, events: [...state.dataset.events, { id: makeId('evento'), title: 'Agenda aggiornata', date: state.clock.currentDate, category: 'agenda', status: 'da pianificare', source: DATA_SOURCES.SIMULATION }] }, ui: { ...state.ui, toast: `Tempo avanzato al ${week}` } };
    persist(); emit();
  },
  save() { persist(); state = { ...state, ui: { ...state.ui, toast: 'Carriera salvata' } }; emit(); },
  reset() {
    state = makeDemoState();
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
      version: 3,
      career: { id, name: `${player.displayName} — ${level.shortLabel}`, playerId, partyId, initialLevel: draft.initialLevel, territoryId, statisticsIds: statisticIds, startedAt: state.clock.currentDate, createdAt: new Date().toISOString(), status: 'active' },
      clock: { ...state.clock }, dataset,
      ui: { activePage: 'panoramica', saveName: 'Salvataggio locale', toast: 'Carriera iniziata' }
    };
    persist(); emit();
    return player;
  }
};
