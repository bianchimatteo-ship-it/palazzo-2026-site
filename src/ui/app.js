import { fullDate, formatDate } from '../core/time.js?v=20260924-9';
import { DATA_SOURCES, isSelectableParty } from '../data/schema.js?v=20260924-9';
import { isRealCollectionLoaded, loadRealCollections, pristineRecord, realDatabase, refreshAdminOverrides } from '../data/repositories/real-data.js?v=20260924-9';
import { addRoleOverride, clearAdminArchive, exportAdminArchive, hasAdminPin, importAdminArchive, isAdminUnlocked, lockAdmin, removeRoleOverride, resetRecordOverride, saveRecordOverride, setAdminPin, setRecordField, unlockAdmin } from '../data/repositories/admin-store.js?v=20260924-9';
import { renderAdminPanel } from './admin-panel.js?v=20260924-9';
import { deleteLocalLogo, exportLogoConfiguration, getLocalLogo, importLogoConfiguration, listLocalLogos, saveLocalLogo, validateLogoFile } from '../data/repositories/logo-store.js?v=20260924-9';
import { renderPartyArchive, renderPartyProfile } from './party-archive.js?v=20260924-9';
import { renderPoliticianArchive, renderPoliticianProfile } from './politician-archive.js?v=20260924-9';
import { renderLogoAdmin } from './logo-admin.js?v=20260924-9';
import { makeCareerDraft, renderCareerWizard } from './career-wizard.js?v=20260924-9';
import { validateCareerStep } from '../core/career-rules.js?v=20260924-9';
import { renderCampaignPage } from './campaign-mode.js?v=20260924-9';
import { renderParliamentPage } from './parliament-mode.js?v=20260924-9';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20260924-9';
import { CAREER_LEVELS, careerLevelLabel } from '../data/regions.js?v=20260924-9';
import { renderElectionCalendar, renderHeadquarters, renderInbox, renderPartyPosition } from './game-mode.js?v=20260924-9';
import { attachChartInteractions, renderPollsPage } from './polls-mode.js?v=20260924-9';
import { glyph, officeIcon } from './visuals.js?v=20260924-9';
import { renderMediaPanel, renderTerritoriesPage } from './society-mode.js?v=20260924-9';
import { renderFinancePage } from './finance-mode.js?v=20260924-9';
import { renderContactsPanel, renderOrganizationPanel } from './organization-mode.js?v=20260924-9';
import { renderRealLaws } from './real-laws.js?v=20260924-9';
import { realLawArea } from '../core/society-engine.js?v=20260924-9';
import { canManageParliament } from '../core/parliament-engine.js?v=20260924-9';

const mainSectionActive = (id, page) => page === id || (id === 'calendario' && page === 'eventi') || (id === 'parlamento' && ['governo', 'leggi'].includes(page)) || (id === 'partito' && page === 'partiti-lista') || (id === 'profilo' && page === 'politici');
const mainNavigation = [
  ['panoramica', 'home', 'Home'], ['carriera', 'route', 'Carriera'], ['partito', 'party', 'Partito'],
  ['territori', 'map', 'Territori'], ['elezioni', 'ballot', 'Elezioni'], ['parlamento', 'building', 'Parlamento'],
  ['sondaggi', 'chart', 'Sondaggi'], ['finanze', 'wallet', 'Finanze'], ['calendario', 'calendar', 'Agenda']
];
const pages = {
  panoramica: { title: 'Home', eyebrow: 'LA TUA PARTITA', intro: 'Una carriera nella politica italiana' },
  profilo: { title: 'Profilo', eyebrow: 'IL TUO POLITICO', intro: 'La persona e i numeri della tua carriera.' },
  carriera: { title: 'Carriera', eyebrow: 'IL TUO PERCORSO', intro: 'Costruisci la tua presenza, un incarico alla volta.' },
  partito: { title: 'Il tuo partito', eyebrow: 'APPARTENENZA', intro: 'Relazioni, linea politica e peso nel partito.' },
  calendario: { title: 'Agenda', eyebrow: 'IL TUO TEMPO', intro: 'Appuntamenti e momenti da tenere d’occhio.' },
  elezioni: { title: 'Campagna elettorale', eyebrow: 'ORIZZONTE ELETTORALE', intro: 'Scegli una sfida, conquista la candidatura e guida la campagna.' },
  sondaggi: { title: 'Sondaggi e media', eyebrow: 'OPINIONE PUBBLICA', intro: 'Consensi, trend, media e mondo politico della simulazione.' },
  territori: { title: 'Territori e cittadini', eyebrow: 'IL PAESE', intro: 'Regioni, servizi, economia e umore dei cittadini, settimana dopo settimana.' },
  finanze: { title: 'Finanze', eyebrow: 'BILANCI E RISORSE', intro: 'Entrate, spese, budget e tesoreria del partito.' },
  parlamento: { title: 'Parlamento', eyebrow: 'LE CAMERE', intro: 'Seggi, gruppi e lavori parlamentari.' },
  governo: { title: 'Governo', eyebrow: 'PALAZZO CHIGI', intro: 'Composizione, agenda e approvazione dell’esecutivo.' },
  leggi: { title: 'Leggi', eyebrow: 'ITER LEGISLATIVO', intro: 'Proposte, commissioni e provvedimenti.' },
  eventi: { title: 'Eventi', eyebrow: 'CRONACA POLITICA', intro: 'Gli eventi che scandiscono la vita pubblica.' },
  politici: { title: 'Politici', eyebrow: 'PERSONE', intro: 'Profili e incarichi nel panorama politico.' },
  'partiti-lista': { title: 'Partiti', eyebrow: 'ORGANIZZAZIONI', intro: 'Le forze politiche del mondo di gioco.' },
  impostazioni: { title: 'Impostazioni', eyebrow: 'PREFERENZE', intro: 'Gestisci carriera, dati e salvataggio.' },
  amministrazione: { title: 'Amministrazione', eyebrow: 'RISERVATO AL PROPRIETARIO', intro: 'Correzioni ai dati di partiti e politici.' }
};
const icon = (name, size = 20) => {
  const paths = { map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', wallet: '<path d="M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1z"/><path d="m4 7 11-4 1 4M16 13h4"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', chevron: '<path d="m9 18 6-6-6-6"/>', save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/>', party: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>', ballot: '<path d="M5 4h14v17H5zM8 8l1.5 1.5L12 7M8 14l1.5 1.5L12 13M14 9h2M14 15h2"/>', building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/>', chart: '<path d="M4 19V5M4 19h17M8 15l4-4 3 2 5-6"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z"/>', close: '<path d="m18 6-12 12M6 6l12 12"/>', spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>' };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sourceLabel = source => source === DATA_SOURCES.REAL ? 'Dato reale' : source === DATA_SOURCES.USER ? 'Creato da te' : 'Simulazione';
const partyName = party => party?.officialName ?? party?.name ?? '';
const partyDescription = party => party?.source === DATA_SOURCES.REAL ? (party.factualDescription || 'Descrizione non disponibile nelle fonti consultate.') : (party?.description || 'Partito di simulazione.');

const pageFromHash = () => {
  const id = decodeURIComponent(globalThis.location?.hash?.replace(/^#\/?/, '') ?? '');
  return pages[id] ? id : null;
};
function setHash(page, replace = false) {
  if (!globalThis.location || !globalThis.history || pageFromHash() === page) return;
  if (replace) history.replaceState(null, '', `#${page}`);
  else history.pushState(null, '', `#${page}`);
}

export function mountApp(root, store) {
  let wizard = null;
  let toastTimer;
  let logoAdminOpen = false;
  let selectedLogoPartyId = null;
  let pendingLogo = null;
  let pendingLogoUrl = null;
  let logoAdminError = '';
  const logoUrls = new Map();
  const logoMetadata = new Map();
  const catalog = {
    partyQuery:'', partyPresence:'all', partyType:'all', partyLevel:'all', partyRegion:'all', partyStatus:'all', partyElection:'all', partySort:'name', partyPage:1,
    politicianQuery:'', politicianChamber:'all', politicianParty:'all', politicianGroup:'all', politicianPage:1,
    selectedPoliticianId:null, selectedPartyId:null, profileLoading:false, loadingPage:null, errors:{}, loadTicket:0,
    logoQuery:'', logoPage:1
  };
  const admin = { tab: 'partiti', query: '', linkQuery: '', chamber: 'all', partyId: null, politicianId: null, message: '' };
  const territory = { measure: 'satisfaction', region: null };
  const realLaws = { query: '', outcome: 'all', area: 'all', page: 1 };
  // Real parliamentarians pertinent to the career: loaded in the background, then kept in step.
  const refreshContacts = async () => {
    try {
      await loadRealCollections(['politicians', 'parliamentaryGroups', 'offices']);
      store.syncRealContacts({ politicians: realDatabase.politicians ?? [], groups: realDatabase.parliamentaryGroups ?? [], offices: realDatabase.offices ?? [] });
      store.calibrateSociety(deputiesByRegion(realDatabase.politicians ?? []));
    } catch { /* contacts stay as saved when the archive cannot be loaded */ }
  };
  const realParties = () => [...(realDatabase.parties ?? []), ...(realDatabase.politicalMovements ?? [])];
  const findParty = id => [...store.getState().dataset.parties, ...realParties()].find(item => item.id === id) ?? null;
  const logoFor = party => {
    const local = logoUrls.get(party?.id);
    if (local) return local;
    if (party?.logoAsset) return new URL(party.logoAsset, document.baseURI).href;
    return party?.logoVerified && party?.logoUrl ? party.logoUrl : null;
  };
  // Verified party offices only: when the dataset has none, the field stays empty.
  const realLeader = partyId => {
    const roles = (realDatabase.partyLeaderships ?? []).filter(item => item.partyId === partyId && item.source === DATA_SOURCES.REAL && item.verified === true);
    const names = roles.map(item => { const figure = (realDatabase.politicalFigures ?? []).find(person => person.id === item.politicalFigureId && person.source === DATA_SOURCES.REAL && person.verified === true); return figure ? `${item.role}: ${figure.fullName}` : null; }).filter(Boolean);
    return names.length ? names.slice(0, 2).join(' · ') : null;
  };
  const selectableParties = () => [...store.getState().dataset.parties.filter(isSelectableParty), ...realParties().filter(isSelectableParty)];
  const adminContext = () => ({
    parties: [...(realDatabase.parties ?? []).map(party => ({ ...party, collection: 'parties' })), ...(realDatabase.politicalMovements ?? []).map(party => ({ ...party, collection: 'politicalMovements' }))].sort((a, b) => a.officialName.localeCompare(b.officialName, 'it')),
    politicians: [...(realDatabase.politicians ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, 'it')),
    groups: realDatabase.parliamentaryGroups ?? [], offices: realDatabase.offices ?? [], pristine: pristineRecord, logoFor,
    unlocked: isAdminUnlocked(), hasPin: hasAdminPin(), loading: catalog.loadingPage === 'amministrazione'
  });
  // Every owner edit re-layers the archive over the real snapshot and redraws.
  const adminDone = message => { refreshAdminOverrides(); admin.message = message; render(store.getState(), store.getLastSaved()); };
  const adminSelected = () => admin.tab === 'politici'
    ? { collection: 'politicians', id: admin.politicianId }
    : { collection: realDatabase.politicalMovements?.some(item => item.id === admin.partyId) ? 'politicalMovements' : 'parties', id: admin.partyId };
  const render = (state, lastSaved) => {
    const player = state.dataset.politicians.find(p => p.id === state.career.playerId);
    const partyId = player ? player.partyId : state.career.partyId;
    const party = findParty(partyId);
    const current = pages[state.ui.activePage] ?? pages.panoramica;
    const eventList = [...state.dataset.events].filter(e => e.date >= state.clock.currentDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    const playerForce = state.world?.parties?.find(item => item.isPlayer);
    const accent = playerForce?.color ?? '#c0a166';
    root.innerHTML = `
      <div class="app-shell" style="--party-accent:${esc(accent)}">
        <aside class="sidebar">
          <a class="brand" href="#panoramica" aria-label="Politicando 2026, Home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-copy"><strong>POLITICANDO</strong><small>2026</small></span></a><div class="brand-subtitle">Una carriera nella<br/>politica italiana</div>
          <nav class="main-nav" aria-label="Navigazione principale">${mainNavigation.map(([id, glyph, label]) => `<button class="nav-item ${mainSectionActive(id, state.ui.activePage) ? 'active' : ''}" data-nav="${id}" aria-label="${label}" title="${label}" aria-current="${mainSectionActive(id, state.ui.activePage) ? 'page' : 'false'}">${icon(glyph, 19)}<span>${label}</span></button>`).join('')}</nav>
          <div class="sidebar-bottom"><button class="nav-item sidebar-account ${state.ui.activePage === 'profilo' || state.ui.activePage === 'politici' ? 'active' : ''}" data-nav="profilo" aria-label="Profilo" title="Profilo">${icon('person', 19)}<span>Profilo</span></button><button class="nav-item sidebar-account ${state.ui.activePage === 'impostazioni' ? 'active' : ''}" data-nav="impostazioni" aria-label="Impostazioni" title="Impostazioni">${icon('settings', 19)}<span>Impostazioni</span></button><div class="save-status"><span class="save-dot"></span><span>${lastSaved}</span></div></div>
        </aside>
        <main class="main-area">
          <header class="topbar"><div class="topbar-title"><strong>${current.title}</strong><span>${current.intro}</span></div><div class="top-actions"><div class="date-chip">${icon('calendar', 16)}<span>${fullDate(state.clock.currentDate)}</span></div><button class="icon-button" aria-label="Salva carriera" title="Salva carriera" data-action="save">${icon('save', 17)}</button><span class="week-chip">Settimana ${state.game.week.index} · ${state.game.week.ap}/${state.game.week.maxAp} giorni</span><button class="advance-button" data-action="advance" ${state.game.status === 'ended' ? 'disabled' : ''}>${state.campaign?.status === 'active' ? 'Avanza campagna' : 'Chiudi settimana'} ${icon('arrow', 17)}</button></div></header>
          <div class="page-wrap">${wizard ? '' : (state.ui.activePage === 'panoramica' ? renderHeadquarters(state, { partyName: party ? partyName(party) : null }) : subpage(state, current, player, party, eventList, catalog, { logoFor, parties:realParties(), selectable:selectableParties(), findParty, realLeader, admin, adminContext, territory, realLaws }))}</div>
        </main>
        ${wizard ? renderCareerWizard(state, wizard, realParties(), logoFor, realDatabase.parliamentaryGroups ?? [], realDatabase.partyLeaderships ?? [], realDatabase.politicalFigures ?? [], realDatabase.politicians ?? []) : ''}
        ${logoAdminOpen ? renderLogoAdmin({selectedId:selectedLogoPartyId,query:catalog.logoQuery,page:catalog.logoPage,metadata:[...logoMetadata.values()],entities:[...realParties(),...state.dataset.parties],logoFor,error:logoAdminError,pendingPreview:pendingLogoUrl}) : ''}
        ${catalog.selectedPoliticianId ? renderPoliticianProfile(catalog.selectedPoliticianId,{loading:catalog.profileLoading}) : ''}
        ${catalog.selectedPartyId ? renderPartyProfile(catalog.selectedPartyId,logoFor) : ''}
        ${state.ui.toast ? `<div class="toast" role="status">${icon('spark', 17)}${esc(state.ui.toast)}</div>` : ''}
      </div>`;
    if (state.ui.toast) { clearTimeout(toastTimer); toastTimer = setTimeout(() => { const s = store.getState(); if (s.ui.toast) { s.ui.toast = null; render(s, store.getLastSaved()); } }, 2400); }
  };
  const syncWizardDraft = () => {
    if (!wizard) return;
    for (const field of root.querySelectorAll('.career-wizard [name]')) {
      if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
      else wizard[field.name] = field.value;
    }
  };
  const preserveFocusRender = (selector) => {
    const field = selector ? root.querySelector(selector) : null;
    const start = field?.selectionStart;
    const end = field?.selectionEnd;
    render(store.getState(), store.getLastSaved());
    const next = selector ? root.querySelector(selector) : null;
    next?.focus();
    if (typeof start === 'number' && next?.setSelectionRange) next.setSelectionRange(start,end);
  };
  const failStep = () => {
    wizard.errors = validateCareerStep(wizard, wizard.step, selectableParties(), realDatabase.parliamentaryGroups ?? []);
    return wizard.errors.length > 0;
  };
  const collectionsForPage = page => page === 'partiti-lista'
    ? ['parties','politicalMovements','territories','electionParticipations']
    : page === 'politici' ? ['politicians','parliamentaryGroups','partyMemberships']
    : page === 'leggi' ? ['parliamentaryGroups','groupMemberships','chambers','politicians','laws']
    : page === 'territori' ? ['politicians']
    : ['parlamento','governo'].includes(page) ? ['parliamentaryGroups','groupMemberships','chambers','politicians']
    : page === 'elezioni' ? ['politicians','parliamentaryGroups']
    : page === 'sondaggi' ? ['partyLeaderships','politicalFigures']
    : page === 'amministrazione' ? ['parties','politicalMovements','politicians','parliamentaryGroups','offices'] : [];
  const ensurePageData = async (page, force = false) => {
    const required = collectionsForPage(page);
    if (!required.length) { if (page !== store.getState().ui.activePage) globalThis.scrollTo?.(0, 0); store.navigate(page); return; }
    if (page !== store.getState().ui.activePage) globalThis.scrollTo?.(0, 0);
    const parliamentaryPage = ['parlamento','governo','leggi'].includes(page);
    const missing = required.filter(name => !isRealCollectionLoaded(name));
    const ticket = ++catalog.loadTicket;
    catalog.loadingPage = missing.length ? page : null;
    catalog.errors[page] = '';
    store.navigate(page);
    if (!missing.length && !force) {
      catalog.loadingPage = null;
      if (parliamentaryPage) { store.initializeParliament(realDatabase.parliamentaryGroups ?? []); refreshContacts(); }
      return;
    }
    try {
      await loadRealCollections(required);
      if (ticket === catalog.loadTicket) {
        catalog.loadingPage = null;
        if (parliamentaryPage) { store.initializeParliament(realDatabase.parliamentaryGroups ?? []); refreshContacts(); }
        render(store.getState(),store.getLastSaved());
      }
    } catch (error) {
      if (ticket === catalog.loadTicket) { catalog.loadingPage = null; catalog.errors[page] = error.message || 'Caricamento non riuscito.'; render(store.getState(),store.getLastSaved()); }
    }
  };
  const refreshLocalLogos = async () => {
    const metadata = await listLocalLogos().catch(() => []);
    for (const [id,url] of logoUrls) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    logoUrls.clear(); logoMetadata.clear();
    for (const item of metadata) {
      logoMetadata.set(item.partyId,item);
      const record = await getLocalLogo(item.partyId).catch(() => null);
      if (record?.blob) logoUrls.set(item.partyId,URL.createObjectURL(record.blob));
    }
    render(store.getState(),store.getLastSaved());
  };
  const updateCatalog = () => {
    const body = root.querySelector('[data-catalog-body]');
    if (!body) return;
    const active = document.activeElement?.matches('[data-catalog-filter]') ? document.activeElement : null;
    const key = active?.dataset.catalogFilter;
    const start = active?.selectionStart;
    const end = active?.selectionEnd;
    body.innerHTML = stateCatalogContent(store.getState(),catalog,{logoFor});
    if (key) {
      const next = body.querySelector(`[data-catalog-filter="${key}"]`);
      next?.focus();
      if (typeof start === 'number' && next?.setSelectionRange) next.setSelectionRange(start,end);
    }
  };
  const updateLogoAdmin = () => preserveFocusRender('[data-logo-query]');

  root.addEventListener('click', async event => {
    const politicianOpen = event.target.closest('[data-politician-profile]')?.dataset.politicianProfile;
    if (politicianOpen) {
      catalog.selectedPoliticianId = politicianOpen; catalog.profileLoading = true; render(store.getState(),store.getLastSaved());
      try { await loadRealCollections(['groupMemberships','offices','partyMembershipHistory','parliamentaryGroupHistory']); }
      catch (error) { catalog.errors.politicianProfile = error.message || 'Dettagli non disponibili.'; }
      catalog.profileLoading = false; render(store.getState(),store.getLastSaved()); return;
    }
    const campaignEvent = event.target.closest('[data-campaign-event]');
    if (campaignEvent) { store.decideCampaignEvent(campaignEvent.dataset.campaignEvent,campaignEvent.dataset.campaignChoice); return; }
    const campaignBreak = event.target.closest('[data-campaign-break-alliance]')?.dataset.campaignBreakAlliance;
    if (campaignBreak) { try { store.breakCampaignAlliance(campaignBreak); } catch(error) { store.getState().ui.toast=error.message; render(store.getState(),store.getLastSaved()); } return; }
    const campaignActivity = event.target.closest('[data-campaign-activity]')?.dataset.campaignActivity;
    if (campaignActivity) {
      try {
        store.performCampaignActivity(campaignActivity,{
          territoryId:root.querySelector('[data-campaign-territory]')?.value,
          topicId:root.querySelector('[data-campaign-topic]')?.value,
          targetCandidateId:root.querySelector('[data-campaign-ally]')?.value
        });
      } catch(error) { store.getState().ui.toast=error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const lawAction = event.target.closest('[data-law-action]');
    if (lawAction) {
      try { store.advanceLaw(lawAction.dataset.lawId, lawAction.dataset.lawAction); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    if (event.target.closest('[data-law-negotiate]')) {
      const button = event.target.closest('[data-law-negotiate]');
      const select = [...root.querySelectorAll('[data-law-group-select]')].find(item => item.dataset.lawId === button.dataset.lawId);
      try { if (!select?.value) throw new Error('Scegli un gruppo per la trattativa.'); store.negotiateLaw(button.dataset.lawId, select.value); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const compromise = event.target.closest('[data-law-compromise]');
    if (compromise) {
      try { store.compromiseLaw(compromise.dataset.lawId); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const parliamentAction = event.target.closest('[data-parliament-action]')?.dataset.parliamentAction;
    if (parliamentAction) {
      try {
        if (parliamentAction === 'join-group') {
          const group = root.querySelector('input[name="player-parliament-group"]:checked')?.value;
          if (!group) throw new Error('Scegli un gruppo parlamentare.');
          store.joinParliamentaryGroup(group);
        } else if (parliamentAction === 'form-government' || parliamentAction === 'revise-government') {
          const ids = [...root.querySelectorAll('[data-government-group]:checked')].map(item => item.value);
          if (parliamentAction === 'form-government') store.formGovernment(ids);
          else store.reviseGovernmentCoalition(ids);
        } else if (parliamentAction === 'government-support') {
          const group = root.querySelector('[data-government-support-select]')?.value;
          if (!group) throw new Error('Scegli un gruppo esterno da coinvolgere.');
          store.negotiateGovernmentSupport(group);
        } else if (parliamentAction === 'confidence') store.voteGovernmentConfidence();
        else if (parliamentAction === 'crisis') store.triggerGovernmentCrisis();
        else if (parliamentAction === 'contest-role') store.contestCommitteeRole();
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const adminTarget = event.target.closest('[data-admin-tab],[data-admin-select-party],[data-admin-select-politician],[data-admin-reset-record],[data-admin-reset-field],[data-admin-logo],[data-admin-unlink],[data-admin-link],[data-admin-remove-role],[data-admin-export],[data-admin-clear],[data-admin-lock]');
    if (adminTarget) {
      const data = adminTarget.dataset;
      try {
        if (data.adminTab) { admin.tab = data.adminTab; admin.query = ''; admin.message = ''; render(store.getState(), store.getLastSaved()); }
        else if (data.adminSelectParty) { admin.partyId = data.adminSelectParty; admin.linkQuery = ''; admin.message = ''; render(store.getState(), store.getLastSaved()); }
        else if (data.adminSelectPolitician) { admin.politicianId = data.adminSelectPolitician; admin.message = ''; render(store.getState(), store.getLastSaved()); }
        else if ('adminResetRecord' in data) { const target = adminSelected(); if (globalThis.confirm?.('Ripristinare tutti i dati originali di questo record?') !== false) { resetRecordOverride(target.collection, target.id); adminDone('Dati originali ripristinati.'); } }
        else if (data.adminResetField) { const target = adminSelected(); const original = pristineRecord(target.collection, target.id) ?? {}; setRecordField(target.collection, target.id, data.adminResetField, original[data.adminResetField] ?? null, original); adminDone('Campo ripristinato al valore del dataset.'); }
        else if (data.adminLogo) { selectedLogoPartyId = data.adminLogo; logoAdminOpen = true; catalog.logoPage = 1; logoAdminError = ''; render(store.getState(), store.getLastSaved()); }
        else if (data.adminUnlink) { setRecordField('politicians', data.adminUnlink, 'partyId', null, pristineRecord('politicians', data.adminUnlink) ?? {}); adminDone('Parlamentare scollegato dal partito.'); }
        else if (data.adminLink) { const personId = root.querySelector('[data-admin-link-select]')?.value; if (!personId) throw new Error('Scegli un parlamentare da collegare.'); setRecordField('politicians', personId, 'partyId', data.adminLink, pristineRecord('politicians', personId) ?? {}); admin.linkQuery = ''; adminDone('Parlamentare collegato al partito.'); }
        else if (data.adminRemoveRole) { removeRoleOverride(admin.politicianId, data.adminRemoveRole); adminDone('Incarico rimosso.'); }
        else if ('adminExport' in data) { const url = URL.createObjectURL(new Blob([exportAdminArchive()], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `politicando-archivio-amministrativo-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); admin.message = 'Archivio esportato.'; render(store.getState(), store.getLastSaved()); }
        else if ('adminClear' in data) { if (globalThis.confirm?.('Cancellare tutte le modifiche amministrative? L’operazione non si può annullare.')) { clearAdminArchive(); adminDone('Archivio amministrativo svuotato: sono tornati i dati del dataset.'); } }
        else if ('adminLock' in data) { lockAdmin(); admin.message = ''; render(store.getState(), store.getLastSaved()); }
      } catch (error) { admin.message = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const simulationControl = event.target.closest('[data-territory-measure],[data-territory-region],[data-budget-line],[data-party-priority],[data-real-law-more],[data-real-law-amend]');
    if (simulationControl) {
      const data = simulationControl.dataset;
      try {
        if (data.territoryMeasure) { territory.measure = data.territoryMeasure; render(store.getState(), store.getLastSaved()); }
        else if (data.territoryRegion) { territory.region = data.territoryRegion; render(store.getState(), store.getLastSaved()); root.querySelector('.region-detail')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }
        else if (data.budgetLine) store.setBudget(data.budgetLine, Number(data.budgetLevel));
        else if (data.partyPriority) store.setPartyPriority(data.partyPriority, Number(data.partyPriorityLevel));
        else if ('realLawMore' in data) { realLaws.page++; render(store.getState(), store.getLastSaved()); }
        else if (data.realLawAmend) {
          const law = (realDatabase.laws ?? []).find(item => item.id === data.realLawAmend);
          const form = root.querySelector('[data-law-proposal-form]');
          if (!law || !form) throw new Error('Atto non disponibile.');
          const label = law.lawNumber ? `legge n. ${law.lawNumber}/${String(law.lawDate ?? '').slice(0, 4)}` : 'atto in discussione al Senato';
          form.elements.title.value = `Modifiche alla ${label}`.slice(0, 90);
          form.elements.category.value = realLawArea(law) ?? form.elements.category.value;
          form.elements.summary.value = `Proposta simulata che interviene su: ${law.officialTitle}`.slice(0, 800);
          form.elements.realReference.value = law.id;
          const note = form.querySelector('[data-law-real-draft]');
          if (note) { note.hidden = false; note.textContent = `Collegata all’atto reale “${law.officialTitle.slice(0, 140)}${law.officialTitle.length > 140 ? '…' : ''}”. L’atto reale non viene modificato.`; }
          form.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
          form.elements.title.focus?.();
        }
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const worldAlliance = event.target.closest('[data-world-alliance]')?.dataset.worldAlliance;
    const worldBreak = event.target.closest('[data-world-break]')?.dataset.worldBreak;
    if (worldAlliance || worldBreak) {
      try { if (worldAlliance) store.proposeAlliance(worldAlliance); else store.breakAlliance(worldBreak); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const activityButton = event.target.closest('[data-game-activity]');
    const gameActivity = activityButton?.dataset.gameActivity;
    const agendaChoice = event.target.closest('[data-agenda-choice]');
    const fastForward = event.target.closest('[data-game-fastforward]')?.dataset.gameFastforward;
    const partyAction = event.target.closest('[data-party-action]')?.dataset.partyAction;
    const partyCurrent = event.target.closest('[data-party-current]')?.dataset.partyCurrent;
    if (gameActivity || agendaChoice || fastForward || partyAction || partyCurrent) {
      try {
        if (gameActivity) store.performWeeklyActivity(gameActivity, activityButton.dataset.activityTargetValue ?? root.querySelector(`[data-activity-target="${gameActivity}"]`)?.value ?? null);
        else if (agendaChoice) store.resolveAgendaItem(agendaChoice.dataset.agendaItem, agendaChoice.dataset.agendaChoice);
        else if (fastForward) store.fastForwardToElection(fastForward);
        else if (partyCurrent) store.alignPartyCurrent(partyCurrent);
        else if (partyAction === 'contest') store.contestPartyRank();
        else if (partyAction === 'leave') { if (globalThis.confirm?.('Vuoi davvero lasciare il partito? Perderai ruolo e sostegno interno.') !== false) store.leaveParty(); }
        else if (partyAction === 'join') store.joinParty(root.querySelector('[data-party-join]')?.value, realParties());
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const partyOpen = event.target.closest('[data-party-profile]')?.dataset.partyProfile;
    if (partyOpen) {
      catalog.selectedPartyId = partyOpen; catalog.profileLoading = true; render(store.getState(),store.getLastSaved());
      try { await loadRealCollections(['politicalFigures','partyLeaderships']); }
      catch (error) { catalog.errors.partyProfile = error.message || 'Dettagli non disponibili.'; }
      catalog.profileLoading = false; render(store.getState(),store.getLastSaved()); return;
    }
    if (event.target.matches('[data-profile-close]') || event.target.matches('[data-profile-backdrop]') || event.target.matches('[data-party-backdrop]')) {
      catalog.selectedPoliticianId = null; catalog.selectedPartyId = null; render(store.getState(),store.getLastSaved()); return;
    }
    const wizardAction = event.target.closest('[data-wizard-action]')?.dataset.wizardAction;
    const goto = Number(event.target.closest('[data-wizard-goto]')?.dataset.wizardGoto || 0);
    if (wizard && (wizardAction || goto)) {
      syncWizardDraft(); wizard.errors = [];
      if (wizardAction === 'cancel') wizard = null;
      else if (wizardAction === 'back') wizard.step = Math.max(1,wizard.step-1);
      else if (wizardAction === 'next') { if (!failStep()) wizard.step = Math.min(4,wizard.step+1); }
      else if (goto >= 1 && goto <= 3) wizard.step = goto;
      else if (wizardAction === 'finish') {
        const failing = [1,2,3].map(step => [step, validateCareerStep(wizard,step,selectableParties(),realDatabase.parliamentaryGroups ?? [])]).find(([, errors]) => errors.length);
        if (failing) { wizard.step = failing[0]; wizard.errors = failing[1]; }
        else { try { store.createCareer(wizard,realParties(),realDatabase.parliamentaryGroups ?? []); wizard = null; refreshContacts(); } catch (error) { wizard.errors = [error.message || 'Impossibile creare la carriera.']; } }
      }
      render(store.getState(),store.getLastSaved()); return;
    }
    if (wizard) {
      if (event.target.closest('[data-wizard-show-parties]')) { syncWizardDraft(); wizard.partyListLimit = (Number(wizard.partyListLimit)||12)+12; render(store.getState(),store.getLastSaved()); return; }
      const level = event.target.closest('[data-level]')?.dataset.level;
      const mode = event.target.closest('[data-party-mode]')?.dataset.partyMode;
      const partyId = event.target.closest('[data-party-id]')?.dataset.partyId;
      const groupId = event.target.closest('[data-group-id]')?.dataset.groupId;
      if (level) {
        if (CAREER_LEVELS[level]?.chamber !== CAREER_LEVELS[wizard.initialLevel]?.chamber) { wizard.parliamentaryGroupId = ''; wizard.groupQuery = ''; }
        wizard.initialLevel = level; wizard.errors = []; render(store.getState(),store.getLastSaved());
      }
      else if (groupId) { wizard.parliamentaryGroupId = groupId; wizard.errors = []; render(store.getState(),store.getLastSaved()); }
      else if (mode) { syncWizardDraft(); wizard.partyMode = mode; wizard.errors = []; render(store.getState(),store.getLastSaved()); }
      else if (partyId) { wizard.partyId = partyId; wizard.errors = []; render(store.getState(),store.getLastSaved()); }
      return;
    }
    if (event.target.closest('[data-action="logo-admin-close"]') || event.target.matches('[data-logo-admin-backdrop]')) {
      logoAdminOpen = false; pendingLogo = null; pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl = null; logoAdminError = ''; render(store.getState(),store.getLastSaved()); return;
    }
    if (event.target.matches('[data-logo-admin-item]')) return;
    const logoParty = event.target.closest('[data-logo-party-id]')?.dataset.logoPartyId;
    if (logoParty) { selectedLogoPartyId = logoParty; pendingLogo = null; pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl = null; logoAdminError = ''; render(store.getState(),store.getLastSaved()); return; }
    const nav = event.target.closest('[data-nav]');
    if (nav) { setHash(nav.dataset.nav); await ensurePageData(nav.dataset.nav); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'advance') store.advance(7);
    else if (action === 'save') store.save();
    else if (action === 'campaign-start') {
      try {
        const value=name=>root.querySelector(`[data-campaign-setup="${name}"]`)?.value;
        store.startCampaign({electionType:value('electionType'),objective:value('objective'),role:value('role'),municipalityBand:value('municipalityBand')},realParties(),{politicians:realDatabase.politicians??[],groups:realDatabase.parliamentaryGroups??[]});
      } catch(error) { store.getState().ui.toast=error.message || 'Impossibile avviare la campagna.'; render(store.getState(),store.getLastSaved()); }
    }
    else if (action === 'campaign-new') store.clearCampaign();
    else if (action === 'new-career') {
      wizard = makeCareerDraft(store.getState().clock.currentDate,store.getState().dataset.parties);
      const wizardCollections = ['parties','politicalMovements','parliamentaryGroups','groupMemberships','chambers','partyLeaderships','politicalFigures','politicians'];
      render(store.getState(),store.getLastSaved());
      try { await loadRealCollections(wizardCollections); render(store.getState(),store.getLastSaved()); }
      catch (error) { wizard.errors = [error.message || 'I dati reali necessari al Career Wizard non sono disponibili.']; render(store.getState(),store.getLastSaved()); }
    }
    else if (action === 'reset') store.reset();
    else if (action === 'retry-database' || action === 'retry-parliament') await ensurePageData(store.getState().ui.activePage,true);
    else if (action === 'logo-admin') {
      logoAdminOpen = true; selectedLogoPartyId ||= [...realParties(),...store.getState().dataset.parties][0]?.id ?? null; catalog.logoPage=1; logoAdminError=''; render(store.getState(),store.getLastSaved());
    }
    else if (action === 'logo-admin-close') { logoAdminOpen=false; render(store.getState(),store.getLastSaved()); }
    else if (action === 'logo-more') { catalog.logoPage++; render(store.getState(),store.getLastSaved()); }
    else if (action === 'logo-export') {
      try { const text = await exportLogoConfiguration(); const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([text],{type:'application/json'})); link.href=url; link.download='politicando-loghi-locali.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
      catch (error) { logoAdminError=error.message || 'Esportazione non riuscita.'; render(store.getState(),store.getLastSaved()); }
    }
    else if (action === 'logo-import') root.querySelector('[data-logo-import-file]')?.click();
    else if (action === 'logo-save') {
      try {
        if (!pendingLogo || !selectedLogoPartyId) throw new Error('Scegli prima un file SVG o PNG.');
        const source = root.querySelector('[data-logo-source]')?.value.trim() || '';
        const verified = Boolean(root.querySelector('[data-logo-verified]')?.checked);
        const alt = root.querySelector('[data-logo-alt]')?.value.trim() || '';
        if (verified && !/^https?:\/\//i.test(source)) throw new Error('Per segnare il logo verificato inserisci una fonte HTTPS o HTTP.');
        if (!alt) throw new Error('Inserisci un testo alternativo per il logo.');
        await saveLocalLogo(selectedLogoPartyId,{blob:pendingLogo,fileName:pendingLogo.name || 'logo',source,verified,alt});
        pendingLogo=null; pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl=null; logoAdminError=''; await refreshLocalLogos();
      } catch (error) { logoAdminError=error.message || 'Salvataggio non riuscito.'; render(store.getState(),store.getLastSaved()); }
    }
    else if (action === 'logo-delete') {
      try { await deleteLocalLogo(selectedLogoPartyId); logoAdminError=''; await refreshLocalLogos(); }
      catch (error) { logoAdminError=error.message || 'Eliminazione non riuscita.'; render(store.getState(),store.getLastSaved()); }
    }
  });
  root.addEventListener('submit', async event => {
    const form = event.target;
    if (form.matches('[data-admin-lock-form],[data-admin-form],[data-admin-role-form],[data-admin-pin-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try {
        if (form.matches('[data-admin-lock-form]')) {
          if (hasAdminPin()) await unlockAdmin(data.pin);
          else { if (data.pin !== data.confirm) throw new Error('I due PIN non coincidono.'); await setAdminPin(data.pin); }
          admin.message = '';
          await ensurePageData('amministrazione', true);
        } else if (form.matches('[data-admin-pin-form]')) {
          if (data.pin !== data.confirm) throw new Error('I due PIN non coincidono.');
          await setAdminPin(data.pin); admin.message = 'PIN aggiornato.'; render(store.getState(), store.getLastSaved());
        } else if (form.matches('[data-admin-role-form]')) {
          addRoleOverride(form.dataset.adminId, data); adminDone('Incarico aggiunto.');
        } else {
          saveRecordOverride(form.dataset.adminCollection, form.dataset.adminId, data, pristineRecord(form.dataset.adminCollection, form.dataset.adminId) ?? {});
          adminDone('Modifiche salvate nell’archivio amministrativo.');
        }
      } catch (error) { admin.message = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    if (form.matches('[data-law-proposal-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      const reference = (realDatabase.laws ?? []).find(item => item.id === data.get('realReference'));
      try { store.proposeLaw({ title: data.get('title'), category: data.get('category'), summary: data.get('summary'), realReference: reference ? { id: reference.id, label: reference.lawNumber ? `legge n. ${reference.lawNumber} del ${reference.lawDate}` : reference.officialTitle.slice(0, 120), officialTitle: reference.officialTitle, lawNumber: reference.lawNumber, lawDate: reference.lawDate, status: reference.status, sourceUrl: reference.sourceUrl, source: 'real', verified: true } : null }); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    } else if (form.matches('[data-law-amend-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      try { store.amendLaw(form.dataset.lawId, data.get('amendment')); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    } else if (form.matches('[data-minister-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      try { store.assignMinister(data.get('portfolio'), data.get('groupId'), data.get('appointee') === 'player' ? 'player' : 'group'); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    }
  });
  root.addEventListener('input', event => {
    const field = event.target;
    if (field.matches('[data-catalog-filter]')) {
      catalog[field.dataset.catalogFilter]=field.value;
      if (field.dataset.catalogFilter === 'partyQuery') catalog.partyPage=1;
      if (field.dataset.catalogFilter === 'politicianQuery') catalog.politicianPage=1;
      updateCatalog(); return;
    }
    if (field.matches('[data-admin-query]')) { admin.query = field.value; preserveFocusRender('[data-admin-query]'); return; }
    if (field.matches('[data-real-law-filter="query"]')) { realLaws.query = field.value; realLaws.page = 1; preserveFocusRender('[data-real-law-filter="query"]'); return; }
    if (field.matches('[data-admin-link-query]')) { admin.linkQuery = field.value; preserveFocusRender('[data-admin-link-query]'); return; }
    if (field.matches('[data-logo-query]')) { catalog.logoQuery=field.value; catalog.logoPage=1; updateLogoAdmin(); return; }
    if (!wizard || !field.matches('.career-wizard [name]')) return;
    if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
    else wizard[field.name] = field.value;
    const output = field.closest('.policy-slider')?.querySelector('output');
    if (output) output.textContent=field.value;
    if (field.name === 'partyColor') { const caption=field.parentElement?.querySelector('span'); if(caption) caption.textContent=field.value; }
    if (field.matches('[data-wizard-party-search]')) { wizard.partyListLimit=12; preserveFocusRender('[data-wizard-party-search]'); }
    if (field.matches('[data-wizard-group-search]')) preserveFocusRender('[data-wizard-group-search]');
  });
  root.addEventListener('change', async event => {
    const field=event.target;
    if (field.matches('[data-catalog-filter]')) {
      catalog[field.dataset.catalogFilter]=field.value;
      if (field.dataset.catalogFilter.startsWith('party')) catalog.partyPage=1;
      if (field.dataset.catalogFilter.startsWith('politician')) catalog.politicianPage=1;
      updateCatalog(); return;
    }
    if (field.matches('[data-campaign-setup="electionType"]')) {
      const type=field.value;
      const options={comunale:[['sindaco','Sindaco'],['consigliere','Consigliere']],regionale:[['presidente','Presidente di Regione'],['consigliere','Consigliere regionale']],politiche:[['deputato','Deputato'],['senatore','Senatore'],['uninominale','Collegio uninominale simulato']],europee:[['eurodeputato','Eurodeputato']]};
      const role=root.querySelector('[data-campaign-setup="role"]');
      if(role) role.innerHTML=(options[type]??options.comunale).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
      const band=root.querySelector('.municipality-band-field'); if(band) band.hidden=type!=='comunale';
      const help=root.querySelector('[data-campaign-model-help]');
      if(help) help.innerHTML=`${ELECTION_MODELS[type].strategy} · <a href="${ELECTION_MODELS[type].referenceUrl}" target="_blank" rel="noopener noreferrer">${ELECTION_MODELS[type].referenceName} ↗</a>`;
      return;
    }
    if (field.matches('[data-admin-chamber]')) { admin.chamber = field.value; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-real-law-filter]') && field.dataset.realLawFilter !== 'query') { realLaws[field.dataset.realLawFilter] = field.value; realLaws.page = 1; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-admin-import]')) {
      const file = field.files?.[0]; if (!file) return;
      try { importAdminArchive(await file.text()); adminDone('Archivio importato e applicato.'); }
      catch (error) { admin.message = error.message || 'Importazione non riuscita.'; render(store.getState(), store.getLastSaved()); }
      field.value = ''; return;
    }
    if (field.matches('[data-wizard-party-filter]')) { syncWizardDraft(); wizard.partyListLimit=12; preserveFocusRender('[data-wizard-party-filter]'); return; }
    if (field.matches('[data-logo-upload]')) {
      const file=field.files?.[0]; if(!file) return;
      try {
        pendingLogo=await validateLogoFile(file); pendingLogo.name=file.name;
        pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl=URL.createObjectURL(pendingLogo);
        root.querySelector('.logo-admin-preview').innerHTML=`<img src="${esc(pendingLogoUrl)}" alt="Anteprima del file selezionato" />`;
        root.querySelector('[data-logo-preview-caption]').textContent='Anteprima temporanea. Premi “Salva nel browser” per conservarla.';
        root.querySelector('[data-action="logo-save"]').disabled=false; logoAdminError='';
      } catch(error) { logoAdminError=error.message || 'File non valido.'; render(store.getState(),store.getLastSaved()); }
    }
    if (field.matches('[data-logo-import-file]')) {
      const file=field.files?.[0]; if(!file) return;
      try {
        const ids=new Set([...realParties(),...store.getState().dataset.parties].map(item=>item.id));
        const payload=JSON.parse(await file.text());
        if(!Array.isArray(payload.logos) || payload.logos.some(item=>!ids.has(item.partyId))) throw new Error('Il file contiene ID di partito non presenti nello snapshot corrente.');
        await importLogoConfiguration(JSON.stringify(payload)); logoAdminError=''; await refreshLocalLogos();
      } catch(error) { logoAdminError=error.message || 'Importazione non riuscita.'; render(store.getState(),store.getLastSaved()); }
      field.value='';
    }
  });
  root.addEventListener('click', event => {
    const more = event.target.closest('[data-catalog-more]')?.dataset.catalogMore;
    if (more) { catalog[more]++; updateCatalog(); }
  });
  store.subscribe(render);
  attachChartInteractions(root);
  // The URL hash mirrors the section, so links, reloads and the back button land on the same page.
  const initialPage = pageFromHash() ?? (pages[store.getState().ui.activePage] ? store.getState().ui.activePage : 'panoramica');
  setHash(initialPage, true);
  globalThis.addEventListener?.('hashchange', () => {
    const page = pageFromHash();
    if (page && page !== store.getState().ui.activePage) ensurePageData(page);
  });
  render(store.getState(),store.getLastSaved());
  refreshLocalLogos();
  ensurePageData(initialPage,true);
  refreshContacts();
}

// Verified deputies in office elected in each region's circoscrizioni: a real reference next to the simulated indicators.
const regionKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z]/g, '');
function deputiesByRegion(politicians) {
  const counts = {};
  const regions = ['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d’Aosta', 'Veneto'];
  for (const person of politicians) {
    if (person.source !== DATA_SOURCES.REAL || person.verified !== true || person.chamber !== 'camera' || person.termEnd) continue;
    const region = regions.find(name => regionKey(person.circoscription).startsWith(regionKey(name)));
    if (region) counts[region] = (counts[region] ?? 0) + 1;
  }
  return counts;
}
function officeLabel(office) {
  return office.endDate ? `${office.title} · concluso` : office.title;
}
function careerNextStep(state) {
  const parliament = state.parliament;
  const seat = parliament?.player;
  if (seat && !seat.groupId) return 'Scegli il tuo gruppo parlamentare';
  if (seat && (parliament.government?.ministers ?? []).some(item => item.playerAppointed && !item.endedAt)) return 'Guida il tuo ministero e difendi la maggioranza';
  if (seat && parliament.careerStanding?.committeeRole) return 'Punta a un incarico di maggiore responsabilità';
  if (seat) return seat.chamber === 'senato' ? 'Conquista responsabilità e influenza al Senato' : 'Costruisci fiducia nel tuo gruppo parlamentare';
  if (state.career.pastParliamentContexts?.length || parliament?.pastMandates?.length) return 'Riconquista un seggio alle prossime elezioni';
  return ({ comunale: 'Fatti conoscere nella tua comunità', regionale: 'Costruisci una presenza in tutta la regione', nazionale: 'Dai forma a una voce riconoscibile nel Paese' })[state.career.initialLevel] ?? 'Scegli il prossimo traguardo';
}
function careerHistory(state, player) {
  if (!player) return '';
  const electionNames = { comunale: 'comunali', regionale: 'regionali', politiche: 'politiche', europee: 'europee' };
  const offices = state.dataset.offices.filter(item => item.politicianId === player.id).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const officeRows = offices.map(item => `<article class="parliament-timeline-item office-row"><time>${esc(item.startDate)}</time><span class="office-icon">${glyph(officeIcon(item), 16)}</span><div><strong>${esc(item.title)} · ${esc(item.institution)}</strong><small>${item.endDate ? `concluso il ${esc(item.endDate)}` : 'in corso'} · ${sourceLabel(item.source)}</small></div></article>`).join('');
  const entries = [
    ...[...(state.career.parliamentHistory ?? [])].reverse().map(item => ({ date: item.date, text: item.text, kind: 'Parlamento' })),
    ...[...(state.career.electionHistory ?? [])].reverse().map(item => ({ date: item.date, text: `Elezioni ${electionNames[item.electionType] ?? item.electionType}: ${Number(item.percent ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })}% · ${item.personalMandate ? 'mandato ottenuto' : 'nessun mandato'}`, kind: 'Elezioni' }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
  const historyRows = entries.map(item => `<article class="parliament-timeline-item"><time>${esc(item.date)}</time><span class="timeline-mark"></span><div><strong>${esc(item.text)}</strong><small>${esc(item.kind)} · simulazione</small></div></article>`).join('');
  return `${offices.length ? `<div class="roadmap-stage"><span class="roadmap-number">03</span><div class="career-history-block"><small>INCARICHI</small>${officeRows}</div></div>` : ''}${historyRows ? `<div class="roadmap-stage"><span class="roadmap-number">${offices.length ? '04' : '03'}</span><div class="career-history-block"><small>STORICO DELLA CARRIERA</small>${historyRows}</div></div>` : ''}`;
}

function subpage(state, page, player, party, events, catalog, options = {}) {
  const personalStats = state.dataset.statistics.filter(item => item.subjectId === player?.id);
  const profileMetrics = [['popularity', 'Popolarità'], ['reputation', 'Reputazione'], ['consensus', 'Consenso'], ['experience', 'Esperienza'], ['influence', 'Influenza'], ['notoriety', 'Notorietà']].map(([metric, label]) => { const record = personalStats.find(item => item.metric === metric) ?? (metric === 'consensus' ? state.dataset.statistics.find(item => item.metric === metric && item.subjectId === party?.id) : null); return `<div><span>${label}</span><strong>${record ? `${String(record.value).replace('.', ',')}${record.unit === '%' ? '%' : ''}${record.unit === '%' ? '' : '<small> / 100</small>'}` : '—'}</strong></div>`; }).join('');
  const catalogStatus = { loading: catalog.loadingPage === state.ui.activePage, error: catalog.errors[state.ui.activePage] ?? '' };
  const listContents = {
    amministrazione: renderAdminPanel(options.admin, options.adminContext()),
    sondaggi: renderPollsPage(state, { logoFor: id => { const record = options.findParty?.(id); return record ? options.logoFor?.(record) : null; }, realLeader: options.realLeader }) + (state.society ? `<section class="hq-panel media-panel"><div class="home-section-heading"><div><span class="section-kicker">MEDIA · SIMULATI</span><h2>Come ti raccontano</h2></div></div>${renderMediaPanel(state)}</section>` : ''),
    territori: renderTerritoriesPage(state, { ...options.territory, deputies: deputiesByRegion(realDatabase.politicians ?? []) }),
    finanze: renderFinancePage(state),
    parlamento: renderParliamentPage('parlamento', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [] }) + `<section class="hq-panel contacts-panel"><div class="home-section-heading"><div><span class="section-kicker">PARLAMENTARI REALI · RAPPORTI SIMULATI</span><h2>I tuoi interlocutori in Parlamento</h2></div></div>${renderContactsPanel(state)}</section>`,
    governo: renderParliamentPage('governo', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [] }),
    leggi: renderParliamentPage('leggi', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [], realLaws: renderRealLaws(realDatabase.laws ?? [], options.realLaws, { canPropose: canManageParliament(state.parliament), loading: catalogStatus.loading && !(realDatabase.laws ?? []).length, error: catalogStatus.error }) }),
    calendario: `<section class="hq-panel"><div class="home-section-heading"><div><span class="section-kicker">QUESTA SETTIMANA</span><h2>Decisioni in agenda</h2></div></div>${renderInbox(state)}</section><section class="hq-panel"><div class="home-section-heading"><div><span class="section-kicker">CALENDARIO ELETTORALE · SIMULATO</span><h2>Prossime elezioni</h2></div></div>${renderElectionCalendar(state, { detailed: true })}</section><div class="home-section-heading agenda-heading"><div><span class="section-kicker">REGISTRO</span><h2>Attività e appuntamenti</h2></div></div><div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">La tua agenda è libera. Avanza il tempo per generare i primi appuntamenti.</div>'}</div>`,
    politici: `<div class="catalog-body" data-catalog-body>${renderPoliticianArchive(catalog,{status:catalogStatus})}</div>`,
    'partiti-lista': `<div class="catalog-body" data-catalog-body>${renderPartyArchive(catalog,{status:catalogStatus,logoFor:options.logoFor})}</div>`,
    elezioni: (state.campaign?.status === 'active' ? '' : `<section class="hq-panel election-calendar-panel"><div class="home-section-heading"><div><span class="section-kicker">CALENDARIO ELETTORALE · SIMULATO</span><h2>Quando si vota</h2></div></div>${renderElectionCalendar(state, { detailed: true })}</section>`) + renderCampaignPage(state,options.parties??[],options.logoFor),
    partito: `<div class="feature-card party-detail-card"><span class="feature-icon">◇</span><div class="eyebrow">${party ? 'AFFILIAZIONE ATTUALE' : 'PROFILO INDIPENDENTE'}</div><div class="party-detail-heading">${party && options.logoFor?.(party) ? `<img src="${esc(options.logoFor(party))}" alt="${esc(party.logoAlt || `Logo di ${party.officialName || party.name}`)}" />` : ''}<h2>${party ? esc(party.officialName || party.name) : 'Nessuna affiliazione'}</h2></div><p>${party ? esc(party.source === DATA_SOURCES.REAL ? party.factualDescription || 'Descrizione non disponibile nelle fonti consultate.' : party.description || 'Partito pronto a essere configurato.') : 'Sei indipendente. Qui sotto puoi aderire a un partito oppure continuare senza affiliazione.'}</p><div class="party-detail-meta">${party ? `<span class="source-pill">${sourceLabel(party.source)}${party.source === DATA_SOURCES.REAL ? ' verificato' : ''}</span>${party.abbreviation ? `<span>${esc(party.abbreviation)}</span>` : ''}${party.orientation ? `<span><small>ORIENTAMENTO</small><strong>${esc(party.orientation)}</strong></span>` : ''}${party.status ? `<span>${esc(party.status)}</span>` : ''}` : '<span class="source-pill">Nessuna affiliazione</span>'}</div>${party?.source === DATA_SOURCES.REAL && party.sourceUrl ? `<a class="catalog-source" href="${esc(party.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ufficiale ↗</a>` : ''}${party?.policyPositions ? `<div class="policy-summary">${[['economia','Economia'],['welfare','Welfare'],['ambiente','Ambiente'],['europa','Europa']].map(([key,label]) => `<span><small>${label}</small><strong>${Number(party.policyPositions[key] ?? 3)} <i>/ 5</i></strong><b><i style="width:${Number(party.policyPositions[key] ?? 3)*20}%"></i></b></span>`).join('')}</div>` : ''}</div>` + renderPartyPosition(state, { parties: options.selectable ?? [] }) + (state.game?.party?.org ? `<section class="hq-panel">${renderOrganizationPanel(state)}</section>` : ''),
    carriera: `<div class="career-roadmap"><div class="roadmap-lead"><span class="section-kicker">PUNTO DI PARTENZA</span><h2>${player ? esc(player.displayName) : 'Crea il tuo politico'}</h2><p>${player ? `${esc(player.previousProfession)} · ${esc(player.municipality)}, ${esc(player.region)}` : 'Scegli chi vuoi diventare e da dove iniziare.'}</p>${player ? '' : '<button class="primary-button" data-action="new-career">Crea il tuo politico ' + icon('arrow', 16) + '</button>'}</div><div class="roadmap-stage"><span class="roadmap-number">01</span><div><small>IL TUO LIVELLO INIZIALE</small><strong>${esc(careerLevelLabel(state.career.initialLevel) ?? 'Da definire')}</strong><span>${esc(state.dataset.territories.find(item => item.id === state.career.territoryId)?.name ?? player?.region ?? 'Italia')}</span></div></div><div class="roadmap-stage upcoming"><span class="roadmap-number">02</span><div><small>PROSSIMO CAPITOLO</small><strong>${esc(careerNextStep(state))}</strong><span>${state.parliament?.player ? 'Leggi, governo e incarichi si gestiscono nella sezione Parlamento.' : 'Candidati alle elezioni per conquistare un incarico e far crescere il tuo profilo.'}</span></div></div>${careerHistory(state, player)}<button class="text-link" data-nav="profilo">Vai al tuo profilo ${icon('arrow', 16)}</button></div>`,
    profilo: `<div class="profile-page"><section class="profile-page-lead"><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div><div><span class="section-kicker">IL TUO POLITICO</span><h2>${player ? esc(player.displayName) : 'Nessun profilo creato'}</h2><p>${player ? `${esc(player.previousProfession)} · residente a ${esc(player.municipality)}, ${esc(player.region)}` : 'Crea una carriera per definire il tuo profilo.'}</p></div>${player ? '' : '<button class="primary-button" data-action="new-career">Nuova carriera ' + icon('arrow', 16) + '</button>'}</section><div class="profile-page-facts"><div><span>INCARICO</span><strong>${player?.roleId && state.dataset.offices.some(item => item.id === player.roleId) ? esc(officeLabel(state.dataset.offices.find(item => item.id === player.roleId))) : 'Da assegnare'}</strong></div><div><span>TERRITORIO</span><strong>${esc(state.dataset.territories.find(item => item.id === player?.territoryId)?.name ?? player?.region ?? 'Italia')}</strong></div><div><span>PARTITO</span><strong>${party ? esc(partyName(party)) : 'Indipendente'}</strong></div></div><section class="profile-metrics"><h3>Statistiche</h3>${profileMetrics}</section><button class="text-link" data-nav="politici">Esplora i profili politici ${icon('arrow', 16)}</button></div>`,
    eventi: `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">Nessun evento in programma.</div>'}</div>`,
    impostazioni: `<div class="settings-grid"><article class="panel settings-card"><div class="eyebrow">SALVATAGGIO</div><h3>La tua carriera è locale</h3><p>Il salvataggio viene conservato in questo browser. Puoi salvare in qualsiasi momento dalla barra superiore.</p><button class="secondary-button" data-action="save">Salva adesso ${icon('save', 16)}</button></article><article class="panel settings-card"><div class="eyebrow">DATI DI GIOCO</div><h3>Demo e provenienza</h3><p>I dataset di riferimento sono separati dai dati della carriera. Le schede reali mostrano fonte, verifica e data di riferimento; i dati non disponibili restano vuoti.</p><span class="source-pill">${(realDatabase.manifest?.collections?.parties ?? 0) + (realDatabase.manifest?.collections?.politicalMovements ?? 0)} organizzazioni · ${realDatabase.manifest?.collections?.politicians ?? 0} parlamentari</span></article><article class="panel settings-card"><div class="eyebrow">ASSET DEI PARTITI</div><h3>Gestione loghi</h3><p>Carica o sostituisci file per l’uso in questo browser. I file locali non si sincronizzano con GitHub Pages.</p><button class="secondary-button" data-action="logo-admin">Apri gestione loghi ${icon('arrow',15)}</button></article><article class="panel settings-card"><div class="eyebrow">AREA RISERVATA</div><h3>Amministrazione dei dati</h3><p>Correggi nomi, sigle, descrizioni, loghi, collegamenti e incarichi di partiti e politici. Le modifiche restano in un archivio separato e non toccano il dataset reale.</p><button class="secondary-button" data-nav="amministrazione">Apri l’area amministrativa ${icon('arrow',15)}</button></article><article class="panel settings-card danger-card"><div class="eyebrow">NUOVA PARTITA</div><h3>Ricomincia la demo</h3><p>Ripristina la carriera dimostrativa e ricrea il salvataggio locale.</p><button class="secondary-button" data-action="reset">Nuova carriera demo</button></article></div>`,
  };
  const placeholder = `<div class="coming-grid"><div class="coming-main panel"><span class="feature-icon">${page.title.slice(0, 1)}</span><div class="eyebrow">STRUTTURA PRONTA</div><h2>${page.title} in costruzione</h2><p>Questa sezione è già collegata alla navigazione. La struttura dati è pronta per accogliere contenuti verificati e dati generati dalla simulazione, con provenienza esplicita.</p><div class="coming-tags"><span>Database modulare</span><span>Dati versionati</span><span>Pronto a espandersi</span></div></div><div class="coming-side panel"><div class="eyebrow">COMPONENTI PREVISTI</div>${plannedFor(state.ui.activePage).map(x => `<div class="planned-item"><span>${icon('chevron', 15)}</span>${x}</div>`).join('')}</div></div>`;
  const routeGroups = { territori: [['finanze', 'Finanze'], ['sondaggi', 'Sondaggi e media']], finanze: [['partito', 'Il tuo partito'], ['territori', 'Territori']], partito: [['partiti-lista', 'Tutti i partiti'], ['finanze', 'Finanze']], parlamento: [['governo', 'Governo'], ['leggi', 'Leggi']], governo: [['parlamento', 'Camere'], ['leggi', 'Leggi']], leggi: [['parlamento', 'Camere'], ['governo', 'Governo']], calendario: [['eventi', 'Eventi']], eventi: [['calendario', 'Agenda']], profilo: [['politici', 'Archivio politici']], politici: [['profilo', 'Il tuo profilo']], 'partiti-lista': [['partito', 'Il tuo partito']] };
  const routes = routeGroups[state.ui.activePage] ?? [];
  return `<section class="welcome-row sub-welcome"><div><div class="eyebrow">${page.eyebrow} <span class="eyebrow-line"></span></div><h1>${page.title}<span class="period">.</span></h1><p class="intro">${page.intro}</p></div>${state.ui.activePage === 'carriera' && player ? `<button class="secondary-button" data-action="new-career">Nuova carriera ${icon('plus', 16)}</button>` : ''}</section>${routes.length ? `<nav class="section-routes" aria-label="Sezioni collegate">${routes.map(([id, label]) => `<button class="section-route ${state.ui.activePage === id ? 'active' : ''}" data-nav="${id}">${label} ${icon('arrow', 15)}</button>`).join('')}</nav>` : ''}<section class="subpage-content">${listContents[state.ui.activePage] ?? placeholder}</section><footer class="page-footer"><span>POLITICANDO 2026 <i>·</i> ${['politici','partiti-lista'].includes(state.ui.activePage)?'DATABASE REALE':'SIMULAZIONE'}</span><span>${['politici','partiti-lista'].includes(state.ui.activePage)?`${realDatabase.manifest?.collections?.politicians ?? 0} parlamentari · ${(realDatabase.manifest?.collections?.parties ?? 0)+(realDatabase.manifest?.collections?.politicalMovements ?? 0)} organizzazioni` :`${state.dataset.politicians.length} profili · ${state.dataset.parties.length} partiti demo`}</span></footer>`;
}
function stateCatalogContent(state, catalog, options = {}) {
  const status = { loading: catalog.loadingPage === state.ui.activePage, error: catalog.errors[state.ui.activePage] ?? '' };
  if (state.ui.activePage === 'politici') return renderPoliticianArchive(catalog,{status});
  if (state.ui.activePage === 'partiti-lista') return renderPartyArchive(catalog,{status,logoFor:options.logoFor});
  return '';
}

function plannedFor(page) {
  const items = { elezioni: ['Scadenziario nazionale e locale', 'Territori e collegi', 'Storico dei risultati'], sondaggi: ['Trend di consenso nel tempo', 'Confronto tra partiti', 'Approvazione e popolarità'], parlamento: ['Camera dei deputati', 'Senato della Repubblica', 'Gruppi e commissioni'], governo: ['Composizione del Consiglio dei ministri', 'Agenda dell’esecutivo', 'Indici di approvazione'], leggi: ['Proposte e iter', 'Stato alle Camere', 'Storico dei provvedimenti'], eventi: ['Eventi politici e casuali', 'Archivio per data', 'Impatto sulla carriera'] };
  return items[page] ?? ['Enti territoriali e gerarchie', 'Profili e incarichi', 'Indicatori nel tempo'];
}
