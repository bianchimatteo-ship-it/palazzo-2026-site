import { fullDate, formatDate } from '../core/time.js';
import { DATA_SOURCES, isSelectableParty } from '../data/schema.js';
import { isRealCollectionLoaded, loadRealCollections, realDatabase } from '../data/repositories/real-data.js?v=20260923-2';
import { deleteLocalLogo, exportLogoConfiguration, getLocalLogo, importLogoConfiguration, listLocalLogos, saveLocalLogo, validateLogoFile } from '../data/repositories/logo-store.js';
import { renderPartyArchive, renderPartyProfile } from './party-archive.js?v=20260923-2';
import { renderPoliticianArchive, renderPoliticianProfile } from './politician-archive.js?v=20260923-2';
import { renderLogoAdmin } from './logo-admin.js?v=20260923-2';
import { makeCareerDraft, renderCareerWizard } from './career-wizard.js';
import { validateCareerStep } from '../core/career-rules.js';
import { renderCampaignPage } from './campaign-mode.js';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js';

const mainSectionActive = (id, page) => page === id || (id === 'calendario' && page === 'eventi') || (id === 'parlamento' && ['governo', 'leggi'].includes(page)) || (id === 'partito' && page === 'partiti-lista') || (id === 'profilo' && page === 'politici');
const mainNavigation = [
  ['panoramica', 'home', 'Home'], ['carriera', 'route', 'Carriera'], ['partito', 'party', 'Partito'],
  ['elezioni', 'ballot', 'Elezioni'], ['parlamento', 'building', 'Parlamento'],
  ['sondaggi', 'chart', 'Sondaggi'], ['calendario', 'calendar', 'Agenda']
];
const pages = {
  panoramica: { title: 'Home', eyebrow: 'LA TUA PARTITA', intro: 'Una carriera nella politica italiana' },
  profilo: { title: 'Profilo', eyebrow: 'IL TUO POLITICO', intro: 'La persona e i numeri della tua carriera.' },
  carriera: { title: 'Carriera', eyebrow: 'IL TUO PERCORSO', intro: 'Costruisci la tua presenza, un incarico alla volta.' },
  partito: { title: 'Il tuo partito', eyebrow: 'APPARTENENZA', intro: 'Relazioni, linea politica e peso nel partito.' },
  calendario: { title: 'Agenda', eyebrow: 'IL TUO TEMPO', intro: 'Appuntamenti e momenti da tenere d’occhio.' },
  elezioni: { title: 'Campagna elettorale', eyebrow: 'ORIZZONTE ELETTORALE', intro: 'Scegli una sfida, conquista la candidatura e guida la campagna.' },
  sondaggi: { title: 'Sondaggi', eyebrow: 'UMORE DEL PAESE', intro: 'Indicatori di consenso pronti per collegarsi ai dati di simulazione.' },
  parlamento: { title: 'Parlamento', eyebrow: 'LE CAMERE', intro: 'Seggi, gruppi e lavori parlamentari.' },
  governo: { title: 'Governo', eyebrow: 'PALAZZO CHIGI', intro: 'Composizione, agenda e approvazione dell’esecutivo.' },
  leggi: { title: 'Leggi', eyebrow: 'ITER LEGISLATIVO', intro: 'Proposte, commissioni e provvedimenti.' },
  eventi: { title: 'Eventi', eyebrow: 'CRONACA POLITICA', intro: 'Gli eventi che scandiscono la vita pubblica.' },
  politici: { title: 'Politici', eyebrow: 'PERSONE', intro: 'Profili e incarichi nel panorama politico.' },
  'partiti-lista': { title: 'Partiti', eyebrow: 'ORGANIZZAZIONI', intro: 'Le forze politiche del mondo di gioco.' },
  impostazioni: { title: 'Impostazioni', eyebrow: 'PREFERENZE', intro: 'Gestisci carriera, dati e salvataggio.' }
};
const icon = (name, size = 20) => {
  const paths = { arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', chevron: '<path d="m9 18 6-6-6-6"/>', save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/>', party: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>', ballot: '<path d="M5 4h14v17H5zM8 8l1.5 1.5L12 7M8 14l1.5 1.5L12 13M14 9h2M14 15h2"/>', building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/>', chart: '<path d="M4 19V5M4 19h17M8 15l4-4 3 2 5-6"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z"/>', close: '<path d="m18 6-12 12M6 6l12 12"/>', spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>' };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sourceLabel = source => source === DATA_SOURCES.REAL ? 'Dato reale' : source === DATA_SOURCES.USER ? 'Creato da te' : 'Simulazione';
const partyName = party => party?.officialName ?? party?.name ?? '';
const partyDescription = party => party?.source === DATA_SOURCES.REAL ? (party.factualDescription || 'Descrizione non disponibile nelle fonti consultate.') : (party?.description || 'Partito di simulazione.');

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
  const realParties = () => [...(realDatabase.parties ?? []), ...(realDatabase.politicalMovements ?? [])];
  const findParty = id => [...store.getState().dataset.parties, ...realParties()].find(item => item.id === id) ?? null;
  const logoFor = party => {
    const local = logoUrls.get(party?.id);
    if (local) return local;
    if (party?.logoAsset) return new URL(party.logoAsset, document.baseURI).href;
    return party?.logoVerified && party?.logoUrl ? party.logoUrl : null;
  };
  const selectableParties = () => [...store.getState().dataset.parties.filter(isSelectableParty), ...realParties().filter(isSelectableParty)];
  const render = (state, lastSaved) => {
    const player = state.dataset.politicians.find(p => p.id === state.career.playerId);
    const partyId = player ? player.partyId : state.career.partyId;
    const party = findParty(partyId);
    const current = pages[state.ui.activePage] ?? pages.panoramica;
    const eventList = [...state.dataset.events].filter(e => e.date >= state.clock.currentDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    root.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <a class="brand" href="#panoramica" aria-label="Politicando 2026, Home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-copy"><strong>POLITICANDO</strong><small>2026</small></span></a><div class="brand-subtitle">Una carriera nella<br/>politica italiana</div>
          <nav class="main-nav" aria-label="Navigazione principale">${mainNavigation.map(([id, glyph, label]) => `<button class="nav-item ${mainSectionActive(id, state.ui.activePage) ? 'active' : ''}" data-nav="${id}" aria-label="${label}" title="${label}" aria-current="${mainSectionActive(id, state.ui.activePage) ? 'page' : 'false'}">${icon(glyph, 19)}<span>${label}</span></button>`).join('')}</nav>
          <div class="sidebar-bottom"><button class="nav-item sidebar-account ${state.ui.activePage === 'profilo' || state.ui.activePage === 'politici' ? 'active' : ''}" data-nav="profilo" aria-label="Profilo" title="Profilo">${icon('person', 19)}<span>Profilo</span></button><button class="nav-item sidebar-account ${state.ui.activePage === 'impostazioni' ? 'active' : ''}" data-nav="impostazioni" aria-label="Impostazioni" title="Impostazioni">${icon('settings', 19)}<span>Impostazioni</span></button><div class="save-status"><span class="save-dot"></span><span>${lastSaved}</span></div></div>
        </aside>
        <main class="main-area">
          <header class="topbar"><div class="topbar-title"><strong>${current.title}</strong><span>${current.intro}</span></div><div class="top-actions"><div class="date-chip">${icon('calendar', 16)}<span>${fullDate(state.clock.currentDate)}</span></div><button class="icon-button" aria-label="Salva carriera" title="Salva carriera" data-action="save">${icon('save', 17)}</button><button class="advance-button" data-action="advance">Avanza settimana ${icon('arrow', 17)}</button></div></header>
          <div class="page-wrap">${wizard ? '' : (state.ui.activePage === 'panoramica' ? dashboard(state, { player, party, eventList, logoFor }) : subpage(state, current, player, party, eventList, catalog, { logoFor, parties:realParties() }))}</div>
        </main>
        ${wizard ? renderCareerWizard(state, wizard, realParties(), logoFor) : ''}
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
    wizard.errors = validateCareerStep(wizard, wizard.step, selectableParties());
    return wizard.errors.length > 0;
  };
  const collectionsForPage = page => page === 'partiti-lista'
    ? ['parties','politicalMovements','territories','electionParticipations']
    : page === 'politici' ? ['politicians','parliamentaryGroups','partyMemberships'] : [];
  const ensurePageData = async (page, force = false) => {
    const required = collectionsForPage(page);
    if (!required.length) { store.navigate(page); return; }
    const missing = required.filter(name => !isRealCollectionLoaded(name));
    const ticket = ++catalog.loadTicket;
    catalog.loadingPage = missing.length ? page : null;
    catalog.errors[page] = '';
    store.navigate(page);
    if (!missing.length && !force) { catalog.loadingPage = null; return; }
    try {
      await loadRealCollections(required);
      if (ticket === catalog.loadTicket) { catalog.loadingPage = null; render(store.getState(),store.getLastSaved()); }
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
        const errors = [1,2,3].flatMap(step => validateCareerStep(wizard,step,selectableParties()));
        if (errors.length) { wizard.errors = errors; wizard.step = errors[0].includes('livello') ? 2 : errors.some(error => error.includes('partito') || error.includes('abbreviazione') || error.includes('descrizione') || error.includes('orientamento')) ? 3 : 1; }
        else { try { store.createCareer(wizard,realParties()); wizard = null; } catch (error) { wizard.errors = [error.message || 'Impossibile creare la carriera.']; } }
      }
      render(store.getState(),store.getLastSaved()); return;
    }
    if (wizard) {
      if (event.target.closest('[data-wizard-show-parties]')) { syncWizardDraft(); wizard.partyListLimit = (Number(wizard.partyListLimit)||12)+12; render(store.getState(),store.getLastSaved()); return; }
      const level = event.target.closest('[data-level]')?.dataset.level;
      const mode = event.target.closest('[data-party-mode]')?.dataset.partyMode;
      const partyId = event.target.closest('[data-party-id]')?.dataset.partyId;
      if (level) { wizard.initialLevel = level; wizard.errors = []; render(store.getState(),store.getLastSaved()); }
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
    if (nav) { await ensurePageData(nav.dataset.nav); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'advance') store.advance(7);
    else if (action === 'save') store.save();
    else if (action === 'campaign-start') {
      try {
        const value=name=>root.querySelector(`[data-campaign-setup="${name}"]`)?.value;
        store.startCampaign({electionType:value('electionType'),objective:value('objective'),role:value('role'),municipalityBand:value('municipalityBand')},realParties());
      } catch(error) { store.getState().ui.toast=error.message || 'Impossibile avviare la campagna.'; render(store.getState(),store.getLastSaved()); }
    }
    else if (action === 'campaign-new') store.clearCampaign();
    else if (action === 'new-career') {
      wizard = makeCareerDraft(store.getState().clock.currentDate,store.getState().dataset.parties);
      if (!isRealCollectionLoaded('parties') || !isRealCollectionLoaded('politicalMovements')) {
        render(store.getState(),store.getLastSaved());
        try { await loadRealCollections(['parties','politicalMovements']); render(store.getState(),store.getLastSaved()); }
        catch (error) { wizard.errors = [error.message || 'El catalogo partiti non è disponibile.']; render(store.getState(),store.getLastSaved()); }
      } else render(store.getState(),store.getLastSaved());
    }
    else if (action === 'reset') store.reset();
    else if (action === 'retry-database') await ensurePageData(store.getState().ui.activePage,true);
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
  root.addEventListener('input', event => {
    const field = event.target;
    if (field.matches('[data-catalog-filter]')) {
      catalog[field.dataset.catalogFilter]=field.value;
      if (field.dataset.catalogFilter === 'partyQuery') catalog.partyPage=1;
      if (field.dataset.catalogFilter === 'politicianQuery') catalog.politicianPage=1;
      updateCatalog(); return;
    }
    if (field.matches('[data-logo-query]')) { catalog.logoQuery=field.value; catalog.logoPage=1; updateLogoAdmin(); return; }
    if (!wizard || !field.matches('.career-wizard [name]')) return;
    if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
    else wizard[field.name] = field.value;
    const output = field.closest('.policy-slider')?.querySelector('output');
    if (output) output.textContent=field.value;
    if (field.name === 'partyColor') { const caption=field.parentElement?.querySelector('span'); if(caption) caption.textContent=field.value; }
    if (field.matches('[data-wizard-party-search]')) { wizard.partyListLimit=12; preserveFocusRender('[data-wizard-party-search]'); }
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
  render(store.getState(),store.getLastSaved());
  refreshLocalLogos();
  ensurePageData(store.getState().ui.activePage,true);
}

function dashboard(state, { player, party, eventList, logoFor }) {
  const playerStats = state.dataset.statistics.filter(item => item.subjectId === player?.id);
  const consensus = playerStats.find(item => item.metric === 'consensus') ?? state.dataset.statistics.find(item => item.metric === 'consensus' && item.subjectId === party?.id);
  const popularity = playerStats.find(item => item.metric === 'popularity');
  const reputation = playerStats.find(item => item.metric === 'reputation');
  const office = state.dataset.offices.find(item => item.id === player?.roleId);
  const territory = state.dataset.territories.find(item => item.id === player?.territoryId);
  const event = eventList[0];
  const levels = { comunale: 'Politica comunale', regionale: 'Politica regionale', nazionale: 'Politica nazionale' };
  const nextSteps = {
    comunale: 'Fatti conoscere nella tua comunità',
    regionale: 'Costruisci una presenza in tutta la regione',
    nazionale: 'Dai forma a una voce riconoscibile nel Paese'
  };
  const statNumber = record => record ? `${String(record.value).replace('.', ',')}${record.unit === '%' ? '%' : ''}` : '—';
  const territoryName = territory?.name ?? player?.region ?? 'Italia';
  const partyLogo = party && logoFor?.(party) ? `<img class="politics-logo-image" src="${esc(logoFor(party))}" alt="${esc(party.logoAlt || `Logo di ${partyName(party)}`)}" loading="lazy" />` : '';
  const appointment = event
    ? `<div class="today-event"><time datetime="${esc(event.date)}"><strong>${formatDate(event.date, { day: '2-digit' })}</strong><span>${formatDate(event.date, { month: 'short' })}</span></time><div><strong>${esc(event.title)}</strong><span>${esc(event.category)} · ${esc(event.status)}</span></div></div>`
    : '<p class="quiet-copy">Nessun appuntamento in agenda per oggi. Puoi avanzare la settimana per continuare la simulazione.</p>';
  return `<section class="home-hero">
      <div class="hero-profile"><span class="section-kicker">PROFILO DEL POLITICO</span><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div><div class="hero-identity"><h1>${player ? esc(player.displayName) : 'Comincia la tua storia'}</h1><p>${office ? esc(office.title) : 'Una carriera tutta da costruire'} <span>·</span> ${esc(territoryName)}</p><span class="hero-party">${party ? esc(partyName(party)) : 'Politico indipendente'}</span></div><button class="hero-edit" data-nav="profilo" aria-label="Apri il profilo">${icon('chevron', 20)}</button></div>
      <div class="hero-consensus"><span>CONSENSO</span><strong>${statNumber(consensus)}</strong><small>${consensus?.subjectId === party?.id && party ? `Nel partito · ${esc(party.abbreviation)}` : 'Situazione attuale'}</small></div>
    </section>
    <section class="profile-stat-strip" aria-label="Statistiche principali"><div class="stat-strip-title">Il tuo profilo</div><div class="stat-strip-item"><span>Popolarità</span><strong>${statNumber(popularity)}<small>${popularity?.unit === '%' ? '' : '/ 100'}</small></strong></div><div class="stat-strip-item"><span>Reputazione</span><strong>${statNumber(reputation)}<small>${reputation?.unit === '%' ? '' : '/ 100'}</small></strong></div><button class="text-link" data-nav="profilo">Tutte le statistiche ${icon('arrow', 16)}</button></section>
    <section class="home-sections">
      <article class="home-section today-section"><div class="home-section-heading"><div><span class="section-kicker">COSA FARE OGGI</span><h2>La tua giornata</h2></div><button class="text-link" data-nav="calendario">Apri agenda ${icon('arrow', 16)}</button></div>${appointment}<button class="section-action" data-action="advance">Avanza di una settimana ${icon('arrow', 17)}</button></article>
      <article class="home-section career-section"><div class="home-section-heading"><div><span class="section-kicker">LA TUA CARRIERA</span><h2>${levels[state.career.initialLevel] ?? 'Il tuo percorso'}</h2></div><button class="text-link" data-nav="carriera">Apri carriera ${icon('arrow', 16)}</button></div><p class="career-goal-label">PROSSIMO OBIETTIVO</p><strong class="career-goal">${nextSteps[state.career.initialLevel] ?? 'Scegli il prossimo traguardo'}</strong><div class="career-location">${office ? esc(office.institution) : 'Punto di partenza'} <span>·</span> ${esc(territoryName)}</div></article>
      <article class="home-section politics-section"><div class="home-section-heading"><div><span class="section-kicker">SITUAZIONE POLITICA</span><h2>La tua area</h2></div></div><div class="politics-party">${partyLogo || `<span class="politics-swatch" style="--party-color:${esc(party?.color ?? '#b7a77f')}"></span>`}<div><strong>${party ? esc(partyName(party)) : 'Indipendente'}</strong><span>${party ? esc(party.orientation || (party.source === DATA_SOURCES.REAL ? 'Dato non documentato' : 'Partito di simulazione')) : 'Senza affiliazione'}</span></div></div><p class="politics-note">${party ? esc(partyDescription(party)) : 'Il tuo percorso è indipendente.'}</p><button class="text-link" data-nav="partito">Apri il partito ${icon('arrow', 16)}</button></article>
    </section>
    <footer class="home-footer"><span>POLITICANDO 2026</span><span>Dati dimostrativi generati per questa carriera.</span></footer>`;
}

function subpage(state, page, player, party, events, catalog, options = {}) {
  const personalStats = state.dataset.statistics.filter(item => item.subjectId === player?.id);
  const profileMetrics = [['popularity', 'Popolarità'], ['reputation', 'Reputazione'], ['consensus', 'Consenso'], ['experience', 'Esperienza'], ['influence', 'Influenza'], ['notoriety', 'Notorietà']].map(([metric, label]) => { const record = personalStats.find(item => item.metric === metric) ?? (metric === 'consensus' ? state.dataset.statistics.find(item => item.metric === metric && item.subjectId === party?.id) : null); return `<div><span>${label}</span><strong>${record ? `${String(record.value).replace('.', ',')}${record.unit === '%' ? '%' : ''}${record.unit === '%' ? '' : '<small> / 100</small>'}` : '—'}</strong></div>`; }).join('');
  const catalogStatus = { loading: catalog.loadingPage === state.ui.activePage, error: catalog.errors[state.ui.activePage] ?? '' };
  const listContents = {
    calendario: `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">La tua agenda è libera. Avanza il tempo per generare i primi appuntamenti.</div>'}</div>`,
    politici: `<div class="catalog-body" data-catalog-body>${renderPoliticianArchive(catalog,{status:catalogStatus})}</div>`,
    'partiti-lista': `<div class="catalog-body" data-catalog-body>${renderPartyArchive(catalog,{status:catalogStatus,logoFor:options.logoFor})}</div>`,
    elezioni: renderCampaignPage(state,options.parties??[],options.logoFor),
    partito: `<div class="feature-card party-detail-card"><span class="feature-icon">◇</span><div class="eyebrow">${party ? 'AFFILIAZIONE ATTUALE' : 'PROFILO INDIPENDENTE'}</div><div class="party-detail-heading">${party && options.logoFor?.(party) ? `<img src="${esc(options.logoFor(party))}" alt="${esc(party.logoAlt || `Logo di ${party.officialName || party.name}`)}" />` : ''}<h2>${party ? esc(party.officialName || party.name) : 'Nessuna affiliazione'}</h2></div><p>${party ? esc(party.source === DATA_SOURCES.REAL ? party.factualDescription || 'Descrizione non disponibile nelle fonti consultate.' : party.description || 'Partito pronto a essere configurato.') : 'Puoi restare indipendente. La scelta di un partito o la sua creazione sarà disponibile all’avvio di una nuova carriera.'}</p><div class="party-detail-meta">${party ? `<span class="source-pill">${sourceLabel(party.source)}${party.source === DATA_SOURCES.REAL ? ' verificato' : ''}</span>${party.abbreviation ? `<span>${esc(party.abbreviation)}</span>` : ''}${party.orientation ? `<span><small>ORIENTAMENTO</small><strong>${esc(party.orientation)}</strong></span>` : ''}${party.status ? `<span>${esc(party.status)}</span>` : ''}` : '<span class="source-pill">Nessuna affiliazione</span>'}</div>${party?.source === DATA_SOURCES.REAL && party.sourceUrl ? `<a class="catalog-source" href="${esc(party.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ufficiale ↗</a>` : ''}${party?.policyPositions ? `<div class="policy-summary">${[['economia','Economia'],['welfare','Welfare'],['ambiente','Ambiente'],['europa','Europa']].map(([key,label]) => `<span><small>${label}</small><strong>${Number(party.policyPositions[key] ?? 3)} <i>/ 5</i></strong><b><i style="width:${Number(party.policyPositions[key] ?? 3)*20}%"></i></b></span>`).join('')}</div>` : ''}</div>`,
    carriera: `<div class="career-roadmap"><div class="roadmap-lead"><span class="section-kicker">PUNTO DI PARTENZA</span><h2>${player ? esc(player.displayName) : 'Crea il tuo politico'}</h2><p>${player ? `${esc(player.previousProfession)} · ${esc(player.municipality)}, ${esc(player.region)}` : 'Scegli chi vuoi diventare e da dove iniziare.'}</p>${player ? '' : '<button class="primary-button" data-action="new-career">Crea il tuo politico ' + icon('arrow', 16) + '</button>'}</div><div class="roadmap-stage"><span class="roadmap-number">01</span><div><small>IL TUO LIVELLO INIZIALE</small><strong>${({comunale:'Politica comunale',regionale:'Politica regionale',nazionale:'Politica nazionale'})[state.career.initialLevel] ?? 'Da definire'}</strong><span>${esc(state.dataset.territories.find(item => item.id === state.career.territoryId)?.name ?? player?.region ?? 'Italia')}</span></div></div><div class="roadmap-stage upcoming"><span class="roadmap-number">02</span><div><small>PROSSIMO CAPITOLO</small><strong>Fatti conoscere sul territorio</strong><span>Il percorso si svilupperà con le prossime fasi del gioco.</span></div></div><button class="text-link" data-nav="profilo">Vai al tuo profilo ${icon('arrow', 16)}</button></div>`,
    profilo: `<div class="profile-page"><section class="profile-page-lead"><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div><div><span class="section-kicker">IL TUO POLITICO</span><h2>${player ? esc(player.displayName) : 'Nessun profilo creato'}</h2><p>${player ? `${esc(player.previousProfession)} · residente a ${esc(player.municipality)}, ${esc(player.region)}` : 'Crea una carriera per definire il tuo profilo.'}</p></div>${player ? '' : '<button class="primary-button" data-action="new-career">Nuova carriera ' + icon('arrow', 16) + '</button>'}</section><div class="profile-page-facts"><div><span>INCARICO</span><strong>${player?.roleId ? esc(state.dataset.offices.find(item => item.id === player.roleId)?.title ?? 'Da assegnare') : 'Da assegnare'}</strong></div><div><span>TERRITORIO</span><strong>${esc(state.dataset.territories.find(item => item.id === player?.territoryId)?.name ?? player?.region ?? 'Italia')}</strong></div><div><span>PARTITO</span><strong>${party ? esc(partyName(party)) : 'Indipendente'}</strong></div></div><section class="profile-metrics"><h3>Statistiche</h3>${profileMetrics}</section><button class="text-link" data-nav="politici">Esplora i profili politici ${icon('arrow', 16)}</button></div>`,
    eventi: `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">Nessun evento in programma.</div>'}</div>`,
    impostazioni: `<div class="settings-grid"><article class="panel settings-card"><div class="eyebrow">SALVATAGGIO</div><h3>La tua carriera è locale</h3><p>Il salvataggio viene conservato in questo browser. Puoi salvare in qualsiasi momento dalla barra superiore.</p><button class="secondary-button" data-action="save">Salva adesso ${icon('save', 16)}</button></article><article class="panel settings-card"><div class="eyebrow">DATI DI GIOCO</div><h3>Demo e provenienza</h3><p>I dataset di riferimento sono separati dai dati della carriera. Le schede reali mostrano fonte, verifica e data di riferimento; i dati non disponibili restano vuoti.</p><span class="source-pill">${(realDatabase.manifest?.collections?.parties ?? 0) + (realDatabase.manifest?.collections?.politicalMovements ?? 0)} organizzazioni · ${realDatabase.manifest?.collections?.politicians ?? 0} parlamentari</span></article><article class="panel settings-card"><div class="eyebrow">ASSET DEI PARTITI</div><h3>Gestione loghi</h3><p>Carica o sostituisci file per l’uso in questo browser. I file locali non si sincronizzano con GitHub Pages.</p><button class="secondary-button" data-action="logo-admin">Apri gestione loghi ${icon('arrow',15)}</button></article><article class="panel settings-card danger-card"><div class="eyebrow">NUOVA PARTITA</div><h3>Ricomincia la demo</h3><p>Ripristina la carriera dimostrativa e ricrea il salvataggio locale.</p><button class="secondary-button" data-action="reset">Nuova carriera demo</button></article></div>`,
  };
  const placeholder = `<div class="coming-grid"><div class="coming-main panel"><span class="feature-icon">${page.title.slice(0, 1)}</span><div class="eyebrow">STRUTTURA PRONTA</div><h2>${page.title} in costruzione</h2><p>Questa sezione è già collegata alla navigazione. La struttura dati è pronta per accogliere contenuti verificati e dati generati dalla simulazione, con provenienza esplicita.</p><div class="coming-tags"><span>Database modulare</span><span>Dati versionati</span><span>Pronto a espandersi</span></div></div><div class="coming-side panel"><div class="eyebrow">COMPONENTI PREVISTI</div>${plannedFor(state.ui.activePage).map(x => `<div class="planned-item"><span>${icon('chevron', 15)}</span>${x}</div>`).join('')}</div></div>`;
  const routeGroups = { partito: [['partiti-lista', 'Tutti i partiti']], parlamento: [['governo', 'Governo'], ['leggi', 'Leggi']], calendario: [['eventi', 'Eventi']], eventi: [['calendario', 'Agenda']], profilo: [['politici', 'Archivio politici']], politici: [['profilo', 'Il tuo profilo']], 'partiti-lista': [['partito', 'Il tuo partito']] };
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
