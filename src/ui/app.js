import { fullDate, formatDate } from '../core/time.js?v=20260926-7';
import { referenceGovernmentSpec } from '../data/repositories/government-reference.js?v=20260926-7';
import { accountApiBase, currentAccount, probeAccountService, deleteCloudSave, downloadSave, knownRevision, listCloudSaves, login, logout, register, slotForCareer, uploadSave } from '../data/repositories/account-sync.js?v=20260926-7';
import { setPartyLogoResolver } from './person-marks.js?v=20260926-7';
import { DATA_SOURCES, isSelectableParty } from '../data/schema.js?v=20260926-7';
import { isRealCollectionLoaded, loadRealCollections, loadRealCollectionsSettled, pristineRecord, realDataFailures, realDatabase, refreshAdminOverrides } from '../data/repositories/real-data.js?v=20260926-7';
import { addAdminParty, addRoleOverride, clearAdminArchive, exportAdminArchive, importAdminArchive, loadSharedArchive, removeRoleOverride, resetRecordOverride, saveRecordOverride, setRecordField, setRecordHidden } from '../data/repositories/admin-store.js?v=20260926-7';
import { renderAdminPanel } from './admin-panel.js?v=20260926-7';
import { sharedLogos } from '../data/repositories/admin-store.js?v=20260926-7';
import { closeSharedSession, hasSharedSession, isAdminVerified, openSharedSession, publishSharedArchive, refreshSharedArchive, sharedApiUrl, verifySharedSession } from '../data/repositories/admin-sync.js?v=20260926-7';
import { deleteLocalLogo, exportLogoConfiguration, fetchLogoFromUrl, getLocalLogo, importLogoConfiguration, listLocalLogos, probeImage, saveLocalLogo, validateLogoFile } from '../data/repositories/logo-store.js?v=20260926-7';
import { renderPartyArchive, renderPartyProfile } from './party-archive.js?v=20260926-7';
import { renderPoliticianArchive, renderPoliticianProfile } from './politician-archive.js?v=20260926-7';
import { PARTY_LINK_COLLECTIONS } from '../data/repositories/party-links.js?v=20260926-7';
import { renderLogoAdmin } from './logo-admin.js?v=20260926-7';
import { chosenPlace, makeCareerDraft, renderCareerWizard, wizardLogoPreview } from './career-wizard.js?v=20260926-7';
import { userPartyLogo } from './party-logo.js?v=20260926-7';
import { CAREER_STEPS, validateCareerStep } from '../core/career-rules.js?v=20260926-7';
import { renderElectionsHub } from './elections-hub.js?v=20260926-7';
import { renderCareerPage } from './career-page.js?v=20260926-7';
import { renderPartyPage } from './party-page.js?v=20260926-7';
import { renderAgendaPage } from './agenda-page.js?v=20260926-7';
import { HEMICYCLE_DEFAULTS, renderHemicycle } from './hemicycle-view.js?v=20260926-7';
import { drawLogoEditor, exportLogo, measureBackground, panFromDrag, renderLogoEditor } from './logo-editor-view.js?v=20260926-7';
import { createEditorState } from '../core/logo-editor.js?v=20260926-7';
import { renderParliamentPage } from './parliament-mode.js?v=20260926-7';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20260926-7';
import { CAREER_LEVELS } from '../data/regions.js?v=20260926-7';
import { renderHeadquarters } from './game-mode.js?v=20260926-7';
import { ARCHIVE_COLLECTIONS, renderArchiveBody, renderArchiveHub } from './archive-hub.js?v=20260926-7';
import { playerRoles } from '../core/roles.js?v=20260926-7';
import { budgetPreview, designFromForm, planFromForm, policyFields, policyPreview } from './policy-mode.js?v=20260926-7';
import { areaOf } from '../data/simulation/policy-rules.js?v=20260926-7';
import { attachChartInteractions, hideChartTip, renderPollsPage } from './polls-mode.js?v=20260926-7';
import { glyph } from './visuals.js?v=20260926-7';
import { renderMediaPanel, renderTerritoriesPage } from './society-mode.js?v=20260926-7';
import { renderFinancePage } from './finance-mode.js?v=20260926-7';
import { renderContactsPanel } from './organization-mode.js?v=20260926-7';
import { renderRealLaws } from './real-laws.js?v=20260926-7';
import { realLawArea } from '../core/society-engine.js?v=20260926-7';
import { canManageParliament } from '../core/parliament-engine.js?v=20260926-7';
import { renderConfirmDialog, renderMainMenu, renderWeeklyReport, settingsView, TOUR_STEPS } from './menu.js?v=20260926-7';
import { MAX_SLOTS } from '../core/storage.js?v=20260926-7';
import { loadSettings, resetSettings, saveSetting } from '../core/settings.js?v=20260926-7';
import { playSound } from './sound.js?v=20260926-7';

// Phone navigation: four sections always one tap away, everything else in the "Altro" sheet.
const MOBILE_TABS = [['panoramica', 'home', 'Home'], ['carriera', 'route', 'Carriera'], ['partito', 'party', 'Partito'], ['sondaggi', 'chart', 'Sondaggi']];
const mainSectionActive = (id, page) => page === id || (id === 'calendario' && page === 'eventi') || (id === 'parlamento' && ['governo', 'leggi'].includes(page)) || (id === 'archivio' && ['partiti-lista', 'politici'].includes(page));
const mainNavigation = [
  ['panoramica', 'home', 'Home'], ['carriera', 'route', 'Carriera'], ['partito', 'party', 'Partito'],
  ['territori', 'map', 'Territori'], ['elezioni', 'ballot', 'Elezioni'], ['parlamento', 'building', 'Parlamento'],
  ['sondaggi', 'chart', 'Sondaggi'], ['finanze', 'wallet', 'Finanze'], ['calendario', 'calendar', 'Agenda'], ['archivio', 'archive', 'Archivio']
];
const pages = {
  panoramica: { title: 'Home', eyebrow: 'LA TUA PARTITA', intro: 'Una carriera nella politica italiana' },
  profilo: { title: 'Profilo', eyebrow: 'IL TUO POLITICO', intro: 'La persona e i numeri della tua carriera.' },
  carriera: { title: 'Carriera', eyebrow: 'IL TUO PERCORSO', intro: 'Costruisci la tua presenza, un incarico alla volta.' },
  partito: { title: 'Il tuo partito', eyebrow: 'APPARTENENZA', intro: 'Relazioni, linea politica e peso nel partito.' },
  calendario: { title: 'Agenda', eyebrow: 'IL TUO TEMPO', intro: 'Appuntamenti e momenti da tenere d’occhio.' },
  elezioni: { title: 'Elezioni', eyebrow: 'CENTRALE ELETTORALE', intro: 'Calendario, candidatura, campagna, avversari e risultati: la competizione elettorale in un solo posto.' },
  sondaggi: { title: 'Sondaggi e media', eyebrow: 'OPINIONE PUBBLICA', intro: 'Consensi, trend, media e mondo politico della simulazione.' },
  territori: { title: 'Territori e cittadini', eyebrow: 'IL PAESE', intro: 'Regioni, servizi, economia e umore dei cittadini, settimana dopo settimana.' },
  finanze: { title: 'Finanze', eyebrow: 'BILANCI E RISORSE', intro: 'Entrate, spese, budget e tesoreria del partito.' },
  parlamento: { title: 'Parlamento', eyebrow: 'LE CAMERE', intro: 'Seggi, gruppi e lavori parlamentari.' },
  governo: { title: 'Governo', eyebrow: 'PALAZZO CHIGI', intro: 'Composizione, agenda e approvazione dell’esecutivo.' },
  leggi: { title: 'Leggi', eyebrow: 'ITER LEGISLATIVO', intro: 'Proposte, commissioni e provvedimenti.' },
  eventi: { title: 'Eventi', eyebrow: 'CRONACA POLITICA', intro: 'Gli eventi che scandiscono la vita pubblica.' },
  politici: { title: 'Politici', eyebrow: 'PERSONE', intro: 'Profili e incarichi nel panorama politico.' },
  'partiti-lista': { title: 'Partiti', eyebrow: 'ORGANIZZAZIONI', intro: 'Partiti e movimenti reali del registro.' },
  archivio: { title: 'Archivio', eyebrow: 'DATI REALI VERIFICATI', intro: 'Partiti, parlamentari, gruppi, governo, leggi e territori reali, consultabili senza uscire dal gioco.' },
  impostazioni: { title: 'Impostazioni', eyebrow: 'PREFERENZE', intro: 'Audio, interfaccia, salvataggi, loghi e dati di gioco.' },
  amministrazione: { title: 'Amministrazione', eyebrow: 'RISERVATO AL PROPRIETARIO', intro: 'Correzioni ai dati di partiti e politici.' }
};
const icon = (name, size = 20) => {
  const paths = { map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', wallet: '<path d="M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1z"/><path d="m4 7 11-4 1 4M16 13h4"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', chevron: '<path d="m9 18 6-6-6-6"/>', save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/>', party: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>', ballot: '<path d="M5 4h14v17H5zM8 8l1.5 1.5L12 7M8 14l1.5 1.5L12 13M14 9h2M14 15h2"/>', building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/>', chart: '<path d="M4 19V5M4 19h17M8 15l4-4 3 2 5-6"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z"/>', close: '<path d="m18 6-12 12M6 6l12 12"/>', spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>', archive: '<path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>' };
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

// Real data that could not be loaded, in words the player understands (the notice of missing data).
const DATA_LABELS = { manifest: 'indice dei dati reali', parties: 'partiti', politicalMovements: 'movimenti politici', coalitions: 'coalizioni', twoPerThousand: '2×1000', realPolls: 'sondaggio reale', government: 'governo', politicians: 'parlamentari', politicalFigures: 'figure politiche', parliamentaryGroups: 'gruppi parlamentari', groupMemberships: 'appartenenze ai gruppi', chambers: 'Camere', partyLeaderships: 'incarichi di partito', territorialUnits: 'province e città metropolitane (ISTAT)', municipalities: 'comuni (ISTAT)', electoralGeography: 'mappa elettorale 2022', localElections: 'calendario delle elezioni locali' };
const dataLabel = name => DATA_LABELS[name] ?? name;
// What the Career Wizard needs: the ISTAT list first (the comune is compulsory), then parties, groups and people.
const WIZARD_TERRITORY = ['territorialUnits', 'municipalities'];
const WIZARD_COLLECTIONS = [...WIZARD_TERRITORY, 'parties', 'politicalMovements', 'parliamentaryGroups', 'groupMemberships', 'chambers', 'partyLeaderships', 'politicalFigures', 'politicians'];

export function mountApp(root, store, { retryData = null } = {}) {
  let wizard = null;
  // Loading of the wizard's real data: 'loading', 'ready' or 'error' (with the collections that failed).
  const wizardData = { status: 'idle', failed: [] };
  // The ISTAT list the new career starts from (regions, supra-municipal units, comuni).
  const wizardTerritory = () => realDatabase.municipalities?.length && realDatabase.territorialUnits?.length ? { units: realDatabase.territorialUnits ?? [], municipalities: realDatabase.municipalities, sourceUrl: realDatabase.manifest?.territorialSource?.url ?? null, sourceName: realDatabase.manifest?.territorialSource?.name ?? null } : null;
  // What the wizard shows while the ISTAT list is missing: still loading, or failed (with “Riprova”).
  const wizardTerritoryView = () => wizardTerritory() ?? { status: wizardData.failed.some(item => WIZARD_TERRITORY.includes(item.name)) ? 'error' : 'loading', error: wizardData.failed.find(item => WIZARD_TERRITORY.includes(item.name))?.message ?? '' };
  const wizardDataStatus = () => ({ loading: wizardData.status === 'loading', failed: wizardData.failed.filter(item => !WIZARD_TERRITORY.includes(item.name)).map(item => dataLabel(item.name)) });
  let toastTimer;
  let logoAdminOpen = false;
  let selectedLogoPartyId = null;
  let pendingLogo = null;
  // The logo editor (crop, ratio, zoom, transparency, dominant colour) for the owner's logos and the wizard's party.
  let logoEditor = null;
  let logoEditorImage = null;
  let logoEditorUrl = null;
  let logoDrag = null;
  let pendingLogoUrl = null;
  let logoAdminError = '';
  // A logo loaded from an address: a copied file (Blob) or, when the site forbids copying, the address itself.
  let pendingRemoteUrl = null;
  let logoUrlDraft = '';
  let logoUrlLoading = false;
  const logoUrls = new Map();
  const logoMetadata = new Map();
  const catalog = {
    partyQuery:'', partyPresence:'all', partyType:'all', partyLevel:'all', partyRegion:'all', partyStatus:'all', partyElection:'all', partySort:'name', partyPage:1,
    politicianQuery:'', politicianChamber:'all', politicianParty:'all', politicianGroup:'all', politicianPage:1,
    selectedPoliticianId:null, selectedPartyId:null, profileLoading:false, loadingPage:null, errors:{}, loadTicket:0,
    logoQuery:'', logoPage:1
  };
  const admin = { tab: 'partiti', query: '', linkQuery: '', chamber: 'all', partyId: null, politicianId: null, message: '', listPage: 1, partyFilter: 'tutti', creating: false, checking: false };
  const territory = { measure: 'satisfaction', region: null };
  const archive = { tab: 'partiti' };
  // Tabs and filters of the sections survive redraws and navigation; they are kept in this browser (per viewer).
  const VIEWS_KEY = 'politicando.views.v1';
  const views = { newsFilter: 'tutto', timelineFilter: 'tutto', tabs: {}, ...(() => { try { const saved = JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '{}'); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; } })() };
  views.tabs = views.tabs && typeof views.tabs === 'object' ? views.tabs : {};
  views.filters = views.filters && typeof views.filters === 'object' ? views.filters : {};
  views.hemicycle = { ...HEMICYCLE_DEFAULTS, ...(views.hemicycle && typeof views.hemicycle === 'object' ? views.hemicycle : {}) };
  const saveViews = () => { try { localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); } catch { /* a convenience: the page works without it */ } };
  // A section tab is remembered together with its context (for Elezioni: the campaign and its status), so that a new
  // campaign or a vote brings the player back to the right place instead of a stale tab.
  const sectionContext = (name, state) => name === 'elezioni' ? `${state.campaign?.id ?? 'nessuna'}|${state.campaign?.status ?? 'nessuna'}` : 'sempre';
  const tabFor = (name, state) => { const saved = views.tabs[name]; return saved && saved.context === sectionContext(name, state) ? saved.value : null; };
  // The game opens on its main menu, never straight on the dashboard.
  const menu = { open: true, view: 'home', error: '', localStart: false };
  // Player account: the running career is kept online after each save and can be recovered on any device.
  // status: 'none' (no service for this copy of the game), 'checking', 'available' or 'unreachable'. An address alone
  // is not enough: the service is asked (probeAccount) before it is offered as available.
  const account = { user: currentAccount(), saves: [], message: '', error: '', busy: false, lastSync: null, conflict: null, status: accountApiBase() ? (currentAccount() ? 'available' : 'checking') : 'none', currentSlot: null };
  Object.defineProperty(account, 'available', { enumerable: true, get: () => account.status === 'available' });
  const setAccountStatus = status => { account.status = status; account.unreachable = status === 'unreachable'; };
  const probeAccount = async () => {
    if (account.status === 'none') return;
    setAccountStatus('checking');
    setAccountStatus(await probeAccountService());
    // Unreachable at the first opening: the player is not kept on the account screen, the local start is offered.
    render(store.getState(), store.getLastSaved());
  };
  let syncTimer = null;
  const careerMeta = () => { const meta = store.currentMeta(); return { player: meta.player, role: meta.role, party: meta.party, week: meta.week, gameDate: meta.gameDate, status: meta.status, difficulty: store.getState().career?.difficulty ?? 'normale' }; };
  const refreshCloud = async () => {
    if (!account.user) return;
    try { account.saves = await listCloudSaves(); account.error = ''; }
    catch (error) { account.error = error.message; account.user = currentAccount(); }
  };
  const syncCareer = async ({ force = false, silent = true } = {}) => {
    clearTimeout(syncTimer); syncTimer = null;
    if (!account.user || !store.hasCareer()) return false;
    const state = store.getState();
    const slot = slotForCareer(state.career.id);
    account.currentSlot = slot;
    try {
      await uploadSave(slot, state, { name: `${careerMeta().player} · ${state.career.name?.split(' — ')[1] ?? 'carriera'}`, meta: careerMeta(), force });
      account.lastSync = new Date().toISOString(); account.conflict = null; account.error = '';
      if (!silent) account.message = 'Carriera salvata online.';
      await refreshCloud();
      return true;
    } catch (error) {
      if (error.status === 409 && error.data?.conflict) { account.conflict = { slot, remote: error.data.remote }; if (!silent) account.error = ''; }
      else if (!silent || error.status === 401) account.error = error.message;
      account.user = currentAccount();
      return false;
    }
  };
  const scheduleSync = () => { if (!account.user) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => { syncCareer().then(() => { if (menu.open) render(store.getState(), store.getLastSaved()); }); }, 6000); };
  let reportOpen = false;
  // Confirmation of irreversible or far-reaching actions: a dialog in the game's style (never the browser's confirm).
  let pendingConfirm = null;
  let skipMultiWeekConfirm = false;
  const askConfirm = options => new Promise(resolve => { pendingConfirm = { ...options, resolve }; render(store.getState(), store.getLastSaved()); });
  const settleConfirm = ok => {
    if (!pendingConfirm) return;
    const { resolve } = pendingConfirm;
    const option = Boolean(root.querySelector?.('[data-confirm-option]')?.checked ?? pendingConfirm.optionChecked);
    pendingConfirm = null;
    resolve({ ok, option });
    render(store.getState(), store.getLastSaved());
  };
  // Runs the action only after the confirmation; the click handler returns at once (the dialog stays open).
  const confirmThen = (options, action) => { askConfirm(options).then(async answer => { if (!answer.ok) return; try { await action(answer); } catch (error) { menu.error = error.message; admin.message = error.message; } render(store.getState(), store.getLastSaved()); }); };
  // First opening: the account comes before the first career; after the registration a short tour, shown once.
  const ONBOARDING_KEY = 'politicando.onboarding.v1';
  const onboarding = () => { try { return JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '{}') ?? {}; } catch { return {}; } };
  const markOnboarding = patch => { try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...onboarding(), ...patch })); } catch { /* the flag is a convenience */ } };
  // “Inizia senza account” is a choice that lasts: after a reload the player is not sent back to the account welcome.
  menu.localStart = onboarding().localStart === true;
  let settings = loadSettings();
  const applySettings = () => {
    const html = document.documentElement;
    html.dataset.motion = settings.motion;
    html.dataset.contrast = settings.contrast;
    html.dataset.density = settings.density;
    html.style.setProperty('--ui-scale', String(Number(settings.textSize) / 100));
  };
  applySettings();
  const download = (text, name) => { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const menuContext = () => {
    const collections = realDatabase.manifest?.collections ?? {};
    return {
      hasCareer: store.hasCareer(), meta: store.currentMeta(), slots: store.listSlots(), lastSaved: store.getLastSaved(), unsaved: store.hasUnsavedChanges(), settings, error: menu.error, account,
      stats: [[realDatabase.manifest?.politiciansInOffice ?? collections.politicians ?? 0, 'parlamentari in carica'], [collections.laws ?? 0, 'atti della XIX legislatura'], [collections.twoPerThousand ?? 0, 'partiti reali nel 2×1000'], [collections.parliamentaryGroups ?? 0, 'gruppi parlamentari']]
    };
  };
  const realLaws = { query: '', outcome: 'all', area: 'all', page: 1 };
  // Filters, sorting and selections of the other pages (catalogues, archive, real laws, territories, the owner's area)
  // are kept in this browser like the tabs: they survive redraws, navigation and a reload.
  const VIEW_FIELDS = Object.freeze({
    catalog: ['partyQuery', 'partyPresence', 'partyType', 'partyLevel', 'partyRegion', 'partyStatus', 'partyElection', 'partySort', 'partyPage', 'politicianQuery', 'politicianChamber', 'politicianParty', 'politicianGroup', 'politicianPage'],
    admin: ['tab', 'chamber', 'partyFilter'], territory: ['measure', 'region'], archive: ['tab'], realLaws: ['query', 'outcome', 'area', 'page']
  });
  const viewTargets = { catalog, admin, territory, archive, realLaws };
  for (const [name, fields] of Object.entries(VIEW_FIELDS)) for (const field of fields) {
    const value = views.pages?.[name]?.[field];
    if (value === null || (typeof value === 'string' && value.length <= 200) || (Number.isInteger(value) && value > 0)) viewTargets[name][field] = value;
  }
  let lastPages = '';
  const persistViewState = () => {
    const pages = Object.fromEntries(Object.entries(VIEW_FIELDS).map(([name, fields]) => [name, Object.fromEntries(fields.map(field => [field, viewTargets[name][field] ?? null]))]));
    const text = JSON.stringify(pages);
    if (text !== lastPages) { lastPages = text; views.pages = pages; saveViews(); }
  };
  // Real parliamentarians pertinent to the career: loaded in the background, then kept in step.
  const refreshContacts = async () => {
    try {
      await loadRealCollections(['politicians', 'parliamentaryGroups', 'offices', ...PARTY_LINK_COLLECTIONS]);
      store.syncRealContacts({ politicians: realDatabase.politicians ?? [], groups: realDatabase.parliamentaryGroups ?? [], offices: realDatabase.offices ?? [] });
      store.calibrateSociety(deputiesByRegion(realDatabase.politicians ?? []));
    } catch { /* contacts stay as saved when the archive cannot be loaded */ }
  };
  const realParties = () => [...(realDatabase.parties ?? []), ...(realDatabase.politicalMovements ?? [])];
  const findParty = id => [...store.getState().dataset.parties, ...realParties()].find(item => item.id === id) ?? null;
  const logoFor = party => {
    const local = logoUrls.get(party?.id);
    if (local) return local;
    // Logos published by the owner are the same for every player.
    const shared = party?.id ? sharedLogos()[party.id] : null;
    if (shared?.url || shared?.dataUrl) return shared.url ?? shared.dataUrl;
    if (party?.source === DATA_SOURCES.USER && party.logo) return userPartyLogo(party);
    if (party?.logoAsset) return new URL(party.logoAsset, document.baseURI).href;
    return party?.logoVerified && party?.logoUrl ? party.logoUrl : null;
  };
  setPartyLogoResolver(logoFor);
  // Verified party offices only: when the dataset has none, the field stays empty.
  const realLeader = partyId => {
    const roles = (realDatabase.partyLeaderships ?? []).filter(item => item.partyId === partyId && item.source === DATA_SOURCES.REAL && item.verified === true);
    const names = roles.map(item => { const figure = (realDatabase.politicalFigures ?? []).find(person => person.id === item.politicalFigureId && person.source === DATA_SOURCES.REAL && person.verified === true); return figure ? `${item.role}: ${figure.fullName}` : null; }).filter(Boolean);
    return names.length ? names.slice(0, 2).join(' · ') : null;
  };
  const selectableParties = () => [...store.getState().dataset.parties.filter(isSelectableParty), ...realParties().filter(isSelectableParty)];
  // MEF aliases (sameEntityAs) are names of a registered party, not parties: they never appear as separate rows,
  // but they still count when the owner adds a party (no duplicates under another name).
  const adminPartyRecords = () => [...(realDatabase.parties ?? []).map(party => ({ ...party, collection: 'parties' })), ...(realDatabase.politicalMovements ?? []).map(party => ({ ...party, collection: 'politicalMovements' }))].sort((a, b) => a.officialName.localeCompare(b.officialName, 'it'));
  const adminContext = () => ({
    parties: adminPartyRecords().filter(party => !party.sameEntityAs),
    knownParties: adminPartyRecords(),
    aliasesOf: id => adminPartyRecords().filter(party => party.sameEntityAs === id),
    politicians: [...(realDatabase.politicians ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, 'it')),
    groups: realDatabase.parliamentaryGroups ?? [], offices: realDatabase.offices ?? [], pristine: pristineRecord, logoFor,
    // The admin area opens only for a session the server has confirmed; a player cannot create a PIN.
    unlocked: isAdminVerified(), available: Boolean(sharedApiUrl()), configured: loadSharedArchive()?.configured !== false, checking: admin.checking, loading: catalog.loadingPage === 'amministrazione'
  });
  // Every owner edit re-layers the archive over the real snapshot and redraws.
  const adminDone = message => {
    refreshAdminOverrides(); admin.message = message; render(store.getState(), store.getLastSaved());
    // Connected to the shared archive: the change is published for every player.
    if (isAdminVerified()) publishSharedArchive().then(() => { admin.message = `${message} Pubblicato per tutti i giocatori.`; render(store.getState(), store.getLastSaved()); }).catch(error => { admin.message = `${message} Non pubblicato: ${error.message}`; render(store.getState(), store.getLastSaved()); });
  };
  const adminSelected = () => admin.tab === 'politici'
    ? { collection: 'politicians', id: admin.politicianId }
    : { collection: realDatabase.politicalMovements?.some(item => item.id === admin.partyId) ? 'politicalMovements' : 'parties', id: admin.partyId };
  // Collapsible categories (weekly activities, campaign actions) reopen as the player left them.
  const restoreDetails = () => { for (const element of root.querySelectorAll?.('details[data-remember]') ?? []) { const saved = views.open?.[element.dataset.remember]; if (typeof saved === 'boolean' && element.open !== saved) element.open = saved; } };
  // Real data that could not be loaded at the start: the game runs with the rest and says what is missing.
  let retryingData = false;
  const dataNotice = () => {
    const missing = realDataFailures();
    if (!missing.length) return '';
    return `<div class="data-alert" role="alert">${glyph('alert', 16)}<span>Alcuni dati reali non sono disponibili: <strong>${esc(missing.map(item => dataLabel(item.name)).join(', '))}</strong>. Il gioco funziona con il resto; le parti che ne dipendono restano vuote.</span>${retryData ? `<button type="button" class="secondary-button" data-action="retry-data" ${retryingData ? 'disabled' : ''}>${retryingData ? 'Nuovo tentativo…' : 'Riprova'}</button>` : ''}</div>`;
  };
  const render = (state, lastSaved) => { renderFrame(state, lastSaved); paintLogoEditor(); restoreDetails(); persistViewState(); };
  const renderFrame = (state, lastSaved) => {
    hideChartTip();
    if (menu.open && !wizard) {
      root.innerHTML = `<div class="app-shell menu-shell">${dataNotice()}${renderMainMenu(menu, menuContext())}${renderConfirmDialog(pendingConfirm)}${state.ui.toast && settings.toasts === 'on' ? `<div class="toast" role="status">${icon('spark', 17)}${esc(state.ui.toast)}</div>` : ''}</div>`;
      if (pendingConfirm) root.querySelector?.('[data-confirm="cancel"]')?.focus?.();
      // First-run steps: on a phone the panel sits below the menu list, so it is brought into view.
      if (menu.reveal) { menu.reveal = false; if (globalThis.matchMedia?.('(max-width: 900px)')?.matches) root.querySelector?.('.menu-panel')?.scrollIntoView?.({ block: 'start' }); }
      return;
    }
    const player = state.dataset.politicians.find(p => p.id === state.career.playerId);
    const partyId = player ? player.partyId : state.career.partyId;
    const party = findParty(partyId);
    const current = pages[state.ui.activePage] ?? pages.panoramica;
    const eventList = [...state.dataset.events].filter(e => e.date >= state.clock.currentDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    const playerForce = state.world?.parties?.find(item => item.isPlayer);
    // The party's own colour leads the interface when it has one (user parties, or colours set by the owner).
    const accent = (/^#[\da-f]{6}$/i.test(party?.color ?? '') ? party.color : null) ?? playerForce?.color ?? '#c0a166';
    root.innerHTML = `
      <div class="app-shell${wizard ? ' wizard-open' : ''}" style="--party-accent:${esc(accent)}">
        <aside class="sidebar">
          <a class="brand" href="#panoramica" aria-label="Politicando 2026, Home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-copy"><strong>POLITICANDO</strong><small>2026</small></span></a><div class="brand-subtitle">Una carriera nella<br/>politica italiana</div>${party && state.game ? `<button class="party-identity" data-nav="partito" style="--party-color:${esc(party.color ?? accent)};--party-color2:${esc(party.color2 ?? accent)}">${logoFor(party) ? `<img src="${esc(logoFor(party))}" alt="" />` : `<i>${esc((party.abbreviation || partyName(party) || 'P').slice(0, 3))}</i>`}<span><strong>${esc(party.abbreviation || partyName(party))}</strong><small>${esc(state.game.party?.rankTitle ?? 'Partito')}</small></span></button>` : ''}
          <nav class="main-nav" aria-label="Navigazione principale">${mainNavigation.map(([id, glyph, label]) => `<button class="nav-item ${mainSectionActive(id, state.ui.activePage) ? 'active' : ''}" data-nav="${id}" aria-label="${label}" title="${label}" aria-current="${mainSectionActive(id, state.ui.activePage) ? 'page' : 'false'}">${icon(glyph, 19)}<span>${label}</span></button>`).join('')}</nav>
          <div class="sidebar-bottom"><button class="nav-item sidebar-account ${state.ui.activePage === 'profilo' || state.ui.activePage === 'politici' ? 'active' : ''}" data-nav="profilo" aria-label="Profilo" title="Profilo">${icon('person', 19)}<span>Profilo</span></button><button class="nav-item sidebar-account ${state.ui.activePage === 'impostazioni' ? 'active' : ''}" data-nav="impostazioni" aria-label="Impostazioni" title="Impostazioni">${icon('settings', 19)}<span>Impostazioni</span></button><div class="save-status"><span class="save-dot"></span><span>${lastSaved}</span></div></div>
        </aside>
        <nav class="mobile-tabbar" aria-label="Navigazione rapida">${MOBILE_TABS.map(([id, glyph, label]) => `<button type="button" class="mobile-tab ${mainSectionActive(id, state.ui.activePage) ? 'active' : ''}" data-nav="${id}" aria-current="${mainSectionActive(id, state.ui.activePage) ? 'page' : 'false'}">${icon(glyph, 21)}<span>${label}</span></button>`).join('')}<button type="button" class="mobile-tab ${MOBILE_TABS.some(([id]) => mainSectionActive(id, state.ui.activePage)) ? '' : 'active'}" data-mobile-more aria-expanded="false" aria-controls="mobile-sheet">${icon('menu', 21)}<span>Altro</span></button></nav>
        <div class="mobile-sheet" id="mobile-sheet" data-mobile-sheet hidden><div class="mobile-sheet-panel" role="dialog" aria-modal="true" aria-label="Tutte le sezioni"><div class="mobile-sheet-head"><strong>Sezioni</strong><button type="button" class="icon-button" data-mobile-close aria-label="Chiudi">×</button></div><div class="mobile-sheet-grid">${[...mainNavigation, ['profilo', 'person', 'Profilo'], ['impostazioni', 'settings', 'Impostazioni']].map(([id, glyph, label]) => `<button type="button" class="sheet-item ${mainSectionActive(id, state.ui.activePage) ? 'active' : ''}" data-nav="${id}">${icon(glyph, 22)}<span>${label}</span></button>`).join('')}<button type="button" class="sheet-item" data-action="menu">${icon('menu', 22)}<span>Menu principale</span></button><button type="button" class="sheet-item" data-action="account">${icon('person', 22)}<span>Account</span></button></div><div class="mobile-sheet-status"><span class="save-dot"></span>${lastSaved}</div></div></div>
        <main class="main-area">
          <header class="topbar"><div class="topbar-title"><strong>${current.title}</strong><span>${current.intro}</span></div><div class="top-actions"><button class="icon-button menu-button" data-action="menu" aria-label="Menu principale" title="Menu principale">${icon('menu', 17)}</button><div class="date-chip">${icon('calendar', 16)}<span>${fullDate(state.clock.currentDate)}</span></div><button class="icon-button" aria-label="Salva carriera" title="Salva carriera" data-action="save">${icon('save', 17)}</button><span class="week-chip">Settimana ${state.game.week.index} · ${state.game.week.ap}/${state.game.week.maxAp} giorni</span><button class="advance-button" data-action="advance" ${state.game.status === 'ended' ? 'disabled' : ''}>${state.campaign?.status === 'active' ? 'Avanza campagna' : 'Chiudi settimana'} ${icon('arrow', 17)}</button></div></header>
          ${wizard ? '' : dataNotice()}<div class="page-wrap">${wizard ? '' : (state.ui.activePage === 'panoramica' ? renderHeadquarters(state, { partyName: party ? partyName(party) : null, partyLogo: party ? logoFor(party) : null, newsFilter: views.newsFilter }) : subpage(state, current, player, party, eventList, catalog, { logoFor, homePlace: () => store.homePlace(), nationalOverview: () => store.nationalOverview(), electoralGeography: () => store.electoralGeography?.() ?? null, parties:realParties(), selectable:selectableParties(), findParty, realLeader, admin, adminContext, territory, realLaws, archive, views, tabFor, settings, lastSaved, account, allianceOdds: id => { try { return store.allianceOdds(id); } catch { return null; } } }))}</div>
        </main>
        ${wizard ? renderCareerWizard(state, wizard, realParties(), logoFor, realDatabase.parliamentaryGroups ?? [], realDatabase.partyLeaderships ?? [], realDatabase.politicalFigures ?? [], realDatabase.politicians ?? [], wizardTerritoryView(), wizardDataStatus()) : ''}
        ${logoAdminOpen ? renderLogoAdmin({shared:sharedLogos(),selectedId:selectedLogoPartyId,query:catalog.logoQuery,page:catalog.logoPage,metadata:[...logoMetadata.values()],entities:[...realParties(),...state.dataset.parties],logoFor,error:logoAdminError,pendingPreview:pendingLogoUrl ?? pendingRemoteUrl,pendingRemote:Boolean(pendingRemoteUrl && !pendingLogo),urlDraft:logoUrlDraft,urlLoading:logoUrlLoading,editorHtml:logoEditor?.context === 'admin' ? renderLogoEditor(logoEditor, { context: 'admin' }) : ''}) : ''}
        ${catalog.selectedPoliticianId ? renderPoliticianProfile(catalog.selectedPoliticianId,{loading:catalog.profileLoading,logoFor}) : ''}
        ${catalog.selectedPartyId ? renderPartyProfile(catalog.selectedPartyId,logoFor) : ''}
        ${reportOpen ? renderWeeklyReport(state) : ''}
        ${renderConfirmDialog(pendingConfirm)}
        ${state.ui.toast && settings.toasts === 'on' ? `<div class="toast" role="status">${icon('spark', 17)}${esc(state.ui.toast)}</div>` : ''}
      </div>`;
    if (pendingConfirm) root.querySelector?.('[data-confirm="cancel"]')?.focus?.();
    if (state.ui.toast) { clearTimeout(toastTimer); toastTimer = setTimeout(() => { const s = store.getState(); if (s.ui.toast) { s.ui.toast = null; render(s, store.getLastSaved()); } }, { short: 1600, normal: 2600, long: 4500 }[settings.toastLength] ?? 2600); }
  };
  const syncWizardDraft = () => {
    if (!wizard) return;
    const fields = [...root.querySelectorAll('.career-wizard [name]')];
    if (fields.some(field => field.name === 'partyProgram')) wizard.partyProgram = fields.filter(field => field.name === 'partyProgram' && field.checked).map(field => field.value);
    for (const field of fields) {
      if (field.name === 'partyProgram' || field.type === 'file') continue;
      if (field.type === 'radio' && !field.checked) continue;
      if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
      else wizard[field.name] = field.value;
    }
  };
  const updateWizardLogo = () => {
    const box = root.querySelector('[data-wizard-logo-preview]');
    const src = wizard ? wizardLogoPreview(wizard) : null;
    if (box) box.innerHTML = src ? `<img src="${esc(src)}" alt="Anteprima del logo" />` : '<span>Logo</span>';
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
    wizard.errors = validateCareerStep(wizard, wizard.step, selectableParties(), realDatabase.parliamentaryGroups ?? [], wizardTerritory(), { requireTerritory: true });
    return wizard.errors.length > 0;
  };
  const collectionsForPage = page => page === 'partiti-lista'
    ? ['parties','politicalMovements','coalitions','electoralLists','territories','electionParticipations','partyMemberships','politicians']
    : page === 'politici' ? ['politicians','parliamentaryGroups',...PARTY_LINK_COLLECTIONS]
    : page === 'leggi' ? ['parliamentaryGroups','groupMemberships','chambers','politicians','laws','government','committees']
    : page === 'territori' ? ['politicians']
    : page === 'parlamento' ? ['parliamentaryGroups','groupMemberships','chambers','politicians','government','offices','committees','committeeMemberships','partyLeaderships','politicalFigures',...PARTY_LINK_COLLECTIONS]
    : page === 'governo' ? ['parliamentaryGroups','groupMemberships','chambers','politicians','government']
    : page === 'archivio' ? ARCHIVE_COLLECTIONS[archive.tab] ?? ARCHIVE_COLLECTIONS.partiti
    : page === 'elezioni' ? ['politicians','parliamentaryGroups',...PARTY_LINK_COLLECTIONS]
    : page === 'sondaggi' ? ['partyLeaderships','politicalFigures']
    : page === 'partito' ? ['territorialUnits']
    : page === 'amministrazione' ? ['parties','politicalMovements','politicians','parliamentaryGroups','offices',...PARTY_LINK_COLLECTIONS] : [];
  const ensurePageData = async (page, force = false) => {
    // A session token in this browser is not enough: the server confirms it before the admin area opens.
    if (page === 'amministrazione' && hasSharedSession() && !isAdminVerified() && !admin.checking) {
      admin.checking = true;
      verifySharedSession().finally(() => { admin.checking = false; render(store.getState(), store.getLastSaved()); });
    }
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
      if (parliamentaryPage) { store.setReferenceGovernment(referenceGovernmentSpec()); store.initializeParliament(realDatabase.parliamentaryGroups ?? []); refreshContacts(); }
      if (page === 'partito') store.initializeCommittees(realDatabase.territorialUnits ?? []);
      return;
    }
    try {
      await loadRealCollections(required);
      if (ticket === catalog.loadTicket) {
        catalog.loadingPage = null;
        if (parliamentaryPage) { store.setReferenceGovernment(referenceGovernmentSpec()); store.initializeParliament(realDatabase.parliamentaryGroups ?? []); refreshContacts(); }
        if (page === 'partito') store.initializeCommittees(realDatabase.territorialUnits ?? []);
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
      else if (record?.url) logoUrls.set(item.partyId,record.url);
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
    body.innerHTML = stateCatalogContent(store.getState(),catalog,{logoFor,archive,realLaws});
    if (key) {
      const next = body.querySelector(`[data-catalog-filter="${key}"]`);
      next?.focus();
      if (typeof start === 'number' && next?.setSelectionRange) next.setSelectionRange(start,end);
    }
  };
  const updateLogoAdmin = () => preserveFocusRender('[data-logo-query]');
  const closeLogoEditor = () => { if (logoEditorUrl) URL.revokeObjectURL(logoEditorUrl); logoEditor = null; logoEditorImage = null; logoEditorUrl = null; logoDrag = null; };
  const openLogoEditor = async (blob, context, name = 'logo') => {
    closeLogoEditor();
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { URL.revokeObjectURL(url); return; }
    // An SVG without a declared size is drawn at 512 px.
    const width = image.naturalWidth || 512, height = image.naturalHeight || 512;
    logoEditor = { ...createEditorState({ width, height, name, type: blob.type || 'image/png' }), context };
    logoEditor.background = measureBackground(logoEditor, image);
    logoEditorImage = image; logoEditorUrl = url;
  };
  // After each render: the editor's canvases are drawn (in the wizard the editor sits in its own slot).
  const paintLogoEditor = () => {
    if (!logoEditor) return;
    if (logoEditor.context === 'wizard') { const slot = root.querySelector?.('[data-logo-editor-slot]'); if (slot && !slot.querySelector('[data-logo-editor]')) slot.innerHTML = renderLogoEditor(logoEditor, { context: 'wizard' }); }
    drawLogoEditor(root, logoEditor, logoEditorImage);
  };
  // The wizard shows the edited logo in its summary and in the party identity.
  const refreshWizardLogoPreview = () => {
    if (!wizard || logoEditor?.context !== 'wizard') return;
    const canvas = root.querySelector?.('[data-logo-result]');
    if (canvas?.toDataURL) { wizard.partyLogoPreview = canvas.toDataURL('image/png'); updateWizardLogo(); }
  };

  // Pasting or submitting an address loads the image, shows it and waits for "Salva nel browser".
  const previewLogoUrl = async address => {
    logoUrlDraft = String(address ?? '').trim();
    if (!logoUrlDraft) { logoAdminError = 'Incolla l’indirizzo di un’immagine.'; render(store.getState(), store.getLastSaved()); return; }
    logoUrlLoading = true; logoAdminError = ''; render(store.getState(), store.getLastSaved());
    pendingLogo = null; pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl = null; pendingRemoteUrl = null;
    try {
      const blob = await fetchLogoFromUrl(logoUrlDraft);
      pendingLogo = blob; pendingLogo.name = new URL(logoUrlDraft).pathname.split('/').pop() || 'logo';
      pendingLogoUrl = URL.createObjectURL(blob); pendingRemoteUrl = logoUrlDraft;
      await openLogoEditor(blob, 'admin', pendingLogo.name);
    } catch (error) {
      // The site forbids copying (or labels the file oddly): the address is kept if the image displays.
      if (['blocked', 'type'].includes(error.code)) {
        try { await probeImage(logoUrlDraft); pendingRemoteUrl = logoUrlDraft; }
        catch (probe) { logoAdminError = probe.message; }
      } else logoAdminError = error.message;
    }
    logoUrlLoading = false;
    render(store.getState(), store.getLastSaved());
  };
  // The projected bill of a measure (or of the budget) follows every change in the form, without redrawing the page.
  const blobToDataUrl = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  const refreshPolicyPreview = (form, field = null) => {
    if (!form) return;
    const society = store.getState().society;
    if (form.matches('[data-budget-form]')) {
      for (const label of form.querySelectorAll('.segmented label')) label.classList.toggle('active', Boolean(label.querySelector('input')?.checked));
      const target = form.querySelector('[data-budget-preview]');
      if (target) target.innerHTML = budgetPreview(society, planFromForm(form));
      return;
    }
    const design = designFromForm(form);
    if (field?.matches?.('[data-policy-area]')) {
      const fields = form.querySelector('[data-policy-fields]');
      if (fields) fields.outerHTML = policyFields({ ...design, area: field.value, instrument: design?.instrument, target: 'nazionale' });
    }
    for (const choice of form.querySelectorAll('.policy-choice')) choice.classList.toggle('active', Boolean(choice.querySelector('input')?.checked));
    const cut = form.querySelector('[data-policy-cut]');
    if (cut) cut.hidden = form.querySelector('[data-policy-financing]')?.value !== 'tagli';
    const target = form.querySelector('[data-policy-preview]');
    if (target) target.innerHTML = policyPreview(society, designFromForm(form));
  };
  // Creates the career from the wizard (the real Government in office is loaded first, so every career finds it).
  const finishWizard = async () => {
    try {
      try { await loadRealCollections(['government','politicians','parliamentaryGroups']); store.setReferenceGovernment(referenceGovernmentSpec()); } catch { /* without the real Government the career starts without one */ }
      const player = store.createCareer(wizard,realParties(),realDatabase.parliamentaryGroups ?? []);
      // A logo uploaded for the new party is kept in this browser with the party's id.
      if (wizard.partyMode === 'new' && wizard.partyLogoMode === 'upload' && wizard.partyLogoBlob && player?.partyId) {
        const edited = logoEditor?.context === 'wizard' ? await exportLogo(logoEditor, logoEditorImage, wizard.partyLogoBlob).catch(() => null) : null;
        await saveLocalLogo(player.partyId, { blob: edited?.blob ?? wizard.partyLogoBlob, fileName: wizard.partyLogoBlob.name || 'logo', source: '', verified: false, alt: `Logo di ${wizard.partyName}`, editor: edited?.editor ?? null }).then(refreshLocalLogos).catch(() => {});
        closeLogoEditor();
      }
      wizard = null; playSound('success'); refreshContacts();
    } catch (error) { if (wizard) wizard.errors = [error.message || 'Impossibile creare la carriera.']; }
  };
  // Every collection the wizard needs is loaded on its own: one that fails does not block the others, and the
  // wizard says what is missing with a “Riprova” (the comune can never be typed freely instead of the ISTAT list).
  const loadWizardData = async () => {
    wizardData.status = 'loading'; wizardData.failed = [];
    if (wizard) render(store.getState(), store.getLastSaved());
    const { failed } = await loadRealCollectionsSettled(WIZARD_COLLECTIONS);
    wizardData.failed = failed;
    wizardData.status = failed.length ? 'error' : 'ready';
    if (wizard) render(store.getState(), store.getLastSaved());
  };
  const openNewGame = async () => {
    menu.open = false;
    wizard = makeCareerDraft(store.getState().clock.currentDate, store.getState().dataset.parties);
    render(store.getState(), store.getLastSaved());
    await loadWizardData();
  };
  root.addEventListener('click', async event => {
    if (pendingConfirm) {
      const choice = event.target.closest('[data-confirm]')?.dataset.confirm;
      if (choice) { settleConfirm(choice === 'ok'); return; }
      if (event.target.matches?.('[data-confirm-backdrop]')) { settleConfirm(false); return; }
      if (event.target.closest('.confirm-dialog')) return;
    }
    const tour = event.target.closest('[data-tour]')?.dataset.tour;
    if (tour) {
      if (tour === 'next') { menu.tourStep = Math.min(TOUR_STEPS.length - 1, (menu.tourStep ?? 0) + 1); menu.reveal = true; }
      else if (tour === 'prev') { menu.tourStep = Math.max(0, (menu.tourStep ?? 0) - 1); menu.reveal = true; }
      else { markOnboarding({ tour: 'done' }); menu.view = 'home'; if (tour === 'finish') { playSound('confirm'); await openNewGame(); return; } }
      playSound('click'); render(store.getState(), store.getLastSaved()); return;
    }
    // Guide index: scroll to the section without touching the URL hash (it names the game page).
    const guideJump = event.target.closest('[data-guide-jump]')?.dataset.guideJump;
    if (guideJump) {
      event.preventDefault();
      const smooth = settings.motion === 'full' && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      root.querySelector?.(`#${guideJump}`)?.scrollIntoView?.({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      return;
    }
    const menuTarget =event.target.closest('[data-menu],[data-menu-action],[data-slot-load],[data-slot-delete],[data-setting-key],[data-report-close],[data-account-action],[data-cloud-load],[data-cloud-delete],[data-conflict]');
    if (menuTarget) {
      const data = menuTarget.dataset;
      if (menuTarget.matches('.report-backdrop') && event.target.closest('.report-modal')) return;
      menu.error = '';
      try {
        if (data.menu === 'continua') { menu.open = false; playSound('confirm'); await ensurePageData(pageFromHash() ?? store.getState().ui.activePage ?? 'panoramica'); }
        // A new career needs an account (when the account service is reachable): the account comes first.
        // Unreachable service: the welcome says so and offers “Inizia senza account” (and “Riprova”) at once.
        else if (data.menu === 'nuova' && account.status !== 'none' && !account.user && !menu.localStart) { menu.view = 'benvenuto'; menu.needAccount = true; menu.reveal = true; playSound('click'); }
        else if (data.menu === 'nuova') { playSound('confirm'); await openNewGame(); return; }
        else if (data.menu === 'account' && data.accountMode) { menu.view = 'account'; account.mode = data.accountMode; account.error = ''; account.message = ''; menu.reveal = true; playSound('click'); }
        else if (data.menu) { menu.view = menu.view === data.menu ? 'home' : data.menu; playSound('click'); }
        else if (data.menuAction === 'start-local') { menu.localStart = true; markOnboarding({ localStart: true }); playSound('confirm'); await openNewGame(); return; }
        else if (data.menuAction === 'save-slot') { store.saveToSlot(); playSound('success'); }
        else if (data.menuAction === 'export') { download(store.exportSave(), `politicando-partita-${new Date().toISOString().slice(0, 10)}.json`); }
        else if (data.menuAction === 'reset-settings') { confirmThen({ title: 'Ripristinare le impostazioni?', body: 'Audio, animazioni, testo, contrasto, notifiche, velocità della simulazione e salvataggio automatico tornano ai valori iniziali. Le partite e i salvataggi non vengono toccati.', confirmLabel: 'Ripristina' }, () => { settings = resetSettings(); applySettings(); }); return; }
        else if (data.menuAction === 'clear-saves') { confirmThen({ title: 'Eliminare tutti i salvataggi?', body: 'La partita in corso e tutti i salvataggi di questo browser verranno cancellati. L’operazione non si può annullare.', details: [account.user ? 'Le copie online nel tuo account restano: potrai recuperarle dal menu Account.' : 'Senza account non resta nessuna copia: esporta prima su file ciò che vuoi tenere.', 'L’archivio dell’amministratore e i loghi non vengono toccati.'], confirmLabel: 'Elimina tutto', tone: 'danger' }, () => { store.clearAllSaves(); menu.open = true; menu.view = 'home'; }); return; }
        else if (data.slotLoad) {
          const load = async () => { store.loadSlot(data.slotLoad); menu.open = false; playSound('success'); await ensurePageData('panoramica'); };
          if (store.hasCareer() && store.hasUnsavedChanges()) { confirmThen({ title: 'Caricare questo salvataggio?', body: 'La partita in corso ha modifiche non salvate: verrà salvata in uno slot prima di caricare quella scelta.', confirmLabel: 'Carica' }, load); return; }
          await load();
        }
        else if (data.slotDelete) { const slot = store.listSlots().find(item => item.id === data.slotDelete); confirmThen({ title: 'Eliminare questo salvataggio?', body: `«${slot?.name ?? 'Salvataggio'}» verrà eliminato da questo browser. L’operazione non si può annullare.`, confirmLabel: 'Elimina salvataggio', tone: 'danger' }, () => store.deleteSlot(data.slotDelete)); return; }
        else if (data.settingKey) { settings = saveSetting(data.settingKey, data.settingValue); applySettings(); playSound('click'); }
        else if ('reportClose' in data) reportOpen = false;
        else if (data.accountAction === 'logout') { await logout(); account.user = null; account.saves = []; account.conflict = null; account.message = 'Sei uscito: le carriere restano online e nel browser.'; }
        else if (data.accountAction === 'refresh') { await refreshCloud(); }
        else if (data.accountAction === 'probe') { await probeAccount(); }
        else if (data.accountAction === 'sync') { account.busy = 'sync'; render(store.getState(), store.getLastSaved()); store.save(); await syncCareer({ silent: false }); account.busy = false; }
        else if (data.cloudLoad) {
          const load = async () => { const remote = await downloadSave(data.cloudLoad); store.loadGame(remote.state, 'Carriera recuperata dal tuo account'); account.currentSlot = data.cloudLoad; menu.open = false; playSound('success'); await ensurePageData('panoramica'); };
          if (store.hasCareer() && store.hasUnsavedChanges()) { confirmThen({ title: 'Caricare la carriera online?', body: 'La partita in corso ha modifiche non salvate: verrà salvata in uno slot prima di caricare la carriera dal tuo account.', confirmLabel: 'Carica' }, load); return; }
          await load();
        }
        else if (data.cloudDelete) { confirmThen({ title: 'Eliminare la copia online?', body: 'Questa carriera verrà eliminata dall’archivio del tuo account. La copia nel browser resta.', confirmLabel: 'Elimina online', tone: 'danger' }, async () => { await deleteCloudSave(data.cloudDelete); await refreshCloud(); }); return; }
        else if (data.conflict === 'download' && account.conflict) { const remote = await downloadSave(account.conflict.slot); store.loadGame(remote.state, 'Versione online caricata'); account.conflict = null; }
        else if (data.conflict === 'overwrite' && account.conflict) { confirmThen({ title: 'Sovrascrivere la versione online?', body: 'La versione più recente salvata da un altro dispositivo verrà sostituita da quella di questo browser.', confirmLabel: 'Sovrascrivi', tone: 'danger' }, () => syncCareer({ force: true, silent: false })); return; }
      } catch (error) { menu.error = error.message; }
      render(store.getState(), store.getLastSaved());
      return;
    }
    const archiveTab = event.target.closest('[data-archive-tab]')?.dataset.archiveTab;
    if (archiveTab) {
      archive.tab = archiveTab;
      if (archiveTab === 'deputati' || archiveTab === 'senatori') { catalog.politicianChamber = archiveTab === 'deputati' ? 'camera' : 'senato'; catalog.politicianPage = 1; }
      await ensurePageData('archivio');
      render(store.getState(), store.getLastSaved()); return;
    }
    const viewFilter = event.target.closest('[data-news-filter],[data-timeline-filter]');
    if (viewFilter) {
      if (viewFilter.dataset.newsFilter) views.newsFilter = viewFilter.dataset.newsFilter;
      else views.timelineFilter = viewFilter.dataset.timelineFilter;
      saveViews(); render(store.getState(), store.getLastSaved()); return;
    }
    // Logo editor: back to the original frame, or the dominant colour as the party colour.
    if (logoEditor && event.target.closest('[data-logo-edit-reset]')) {
      const keep = { context: logoEditor.context, background: logoEditor.background };
      logoEditor = { ...createEditorState({ width: logoEditor.width, height: logoEditor.height, name: logoEditor.name, type: logoEditor.type }), ...keep };
      render(store.getState(), store.getLastSaved()); refreshWizardLogoPreview(); return;
    }
    if (logoEditor && event.target.closest('[data-logo-edit-color]')) {
      const color = logoEditor.dominant;
      try {
        if (!color) throw new Error('Nessun colore dominante: l’immagine è trasparente o in scala di grigi.');
        if (logoEditor.context === 'wizard' && wizard) { wizard.partyColor = color; render(store.getState(), store.getLastSaved()); updateWizardLogo(); return; }
        const collection = realDatabase.politicalMovements?.some(item => item.id === selectedLogoPartyId) ? 'politicalMovements' : realDatabase.parties?.some(item => item.id === selectedLogoPartyId) ? 'parties' : null;
        if (!collection || !isAdminVerified()) throw new Error('Il colore si imposta così solo per i partiti reali, dall’area del proprietario.');
        setRecordField(collection, selectedLogoPartyId, 'color', color, pristineRecord(collection, selectedLogoPartyId) ?? {});
        adminDone(`Colore del partito impostato a ${color}.`);
      } catch (error) { logoAdminError = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    // Territorial committees: actions on a committee, new committees on the ISTAT map, the list of comuni on demand.
    const committeeControl = event.target.closest('[data-committee-action],[data-committee-found],[data-committee-load]');
    if (committeeControl) {
      const data = committeeControl.dataset;
      try {
        if (data.committeeLoad) { await loadRealCollections([data.committeeLoad]); render(store.getState(), store.getLastSaved()); return; }
        if (data.committeeFound === 'provincia') {
          const unit = (realDatabase.territorialUnits ?? []).find(item => item.code === root.querySelector('[data-committee-found-unit]')?.value);
          if (!unit) throw new Error('Scegli la provincia o la città metropolitana.');
          store.committeeAction('fonda', { level: 'provincia', name: unit.name, region: unit.gameRegion, unitCode: unit.code, unitType: unit.type });
        } else if (data.committeeFound === 'comune') {
          const place = (realDatabase.municipalities ?? []).find(item => item.code === root.querySelector('[data-committee-found-municipality]')?.value);
          if (!place) throw new Error('Scegli il comune.');
          store.committeeAction('fonda', { level: 'comune', name: place.name, region: store.homePlace().region, unitCode: place.unit, municipalityCode: place.code });
        } else if (data.committeeAction === 'fonda') store.committeeAction('fonda', { level: data.committeeLevel, name: data.committeeName, region: data.committeeRegion, unitCode: data.committeeUnit || null, unitType: data.committeeUnitType || null, municipalityCode: data.committeeMunicipality || null });
        else store.committeeAction(data.committeeAction, { committeeId: data.committeeId });
        playSound('confirm');
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    // The hemicycle: seats, chamber, colours, legend filters and the vote to show; the view is kept across redraws.
    const hemi = event.target.closest('[data-hemi-seat],[data-hemi-chamber],[data-hemi-color],[data-hemi-filter-group],[data-hemi-filter-party],[data-hemi-reset],[data-hemi-close],[data-hemi-vote]');
    if (hemi) {
      const data = hemi.dataset;
      const view = views.hemicycle;
      if (data.hemiSeat) view.selected = view.selected === data.hemiSeat ? null : data.hemiSeat;
      else if (data.hemiChamber) Object.assign(view, { chamber: data.hemiChamber, group: '', committee: '', vote: '', selected: null });
      else if (data.hemiColor) view.colorBy = data.hemiColor;
      else if (data.hemiFilterGroup) view.group = view.group === data.hemiFilterGroup ? '' : data.hemiFilterGroup;
      else if (data.hemiFilterParty) view.party = view.party === data.hemiFilterParty ? '' : data.hemiFilterParty;
      else if (hemi.matches('[data-hemi-reset]')) Object.assign(view, { party: '', group: '', committee: '', vote: '' });
      else if (hemi.matches('[data-hemi-close]')) view.selected = null;
      else if (data.hemiVote) {
        Object.assign(view, { vote: data.hemiVote, chamber: data.hemiVoteChamber || view.chamber, selected: null, group: '', committee: '' });
        saveViews();
        if (store.getState().ui.activePage !== 'parlamento') { setHash('parlamento'); await ensurePageData('parlamento'); }
        render(store.getState(), store.getLastSaved());
        root.querySelector?.('#hemicycle')?.scrollIntoView?.({ block: 'start' });
        return;
      }
      saveViews(); render(store.getState(), store.getLastSaved()); return;
    }
    const viewFilterChoice = event.target.closest('[data-view-filter]');
    if (viewFilterChoice) {
      views.filters[viewFilterChoice.dataset.viewFilter] = viewFilterChoice.dataset.viewFilterValue;
      saveViews(); render(store.getState(), store.getLastSaved()); return;
    }
    const sectionTab = event.target.closest('[data-section-tab]');
    if (sectionTab) {
      const name = sectionTab.dataset.sectionTab;
      views.tabs[name] = { value: sectionTab.dataset.sectionTabValue, context: sectionContext(name, store.getState()) };
      saveViews();
      const page = { elezioni: 'elezioni', carriera: 'carriera', partito: 'partito', agenda: 'calendario' }[name];
      if (page && store.getState().ui.activePage !== page) { setHash(page); await ensurePageData(page); }
      playSound('click'); render(store.getState(), store.getLastSaved());
      root.querySelector?.('.sx-tabs')?.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    if (event.target.closest('[data-campaign-strategy-apply]')) {
      try {
        const strategy = root.querySelector('input[name="campaign-strategy-live"]:checked')?.value;
        store.setCampaignStrategy(strategy, { topicId: root.querySelector('[data-campaign-strategy-topic]')?.value, targetId: root.querySelector('[data-campaign-strategy-target]')?.value });
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const lawControl = event.target.closest('[data-government-action],[data-law-demand],[data-law-patch],[data-law-confidence],[data-law-withdraw],[data-communication]');
    if (lawControl) {
      const data = lawControl.dataset;
      try {
        if (data.governmentAction === 'summit') store.majoritySummit();
        else if (data.lawDemand) store.acceptLawDemand(data.lawDemand, data.groupIdDemand);
        else if (data.lawPatch) store.amendLawPolicy(data.lawPatch, { [data.patchKey]: data.patchKey === 'intensity' ? Number(data.patchValue) : data.patchValue });
        else if (data.lawConfidence) store.askConfidence(data.lawConfidence);
        else if (data.lawWithdraw) { const lawId = data.lawWithdraw; confirmThen({ kicker: 'LEGGI', title: 'Ritirare la proposta?', body: 'La proposta esce dall’iter e il lavoro fatto in commissione e con i gruppi andrà perso.', confirmLabel: 'Ritira la proposta', tone: 'danger' }, () => store.withdrawLaw(lawId)); return; }
        else if (data.communication) store.setCommunication(data.communication);
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const secretary = event.target.closest('[data-secretary]');
    if (secretary) {
      const { secretary: decision, secretaryValue: value } = secretary.dataset;
      const chosen = name => root.querySelector(`[data-secretary-select="${name}"]`)?.value;
      try {
        if (decision === 'line') store.setPartyLine(value);
        else if (decision === 'organs') store.assignOrgans(chosen('organs'));
        else if (decision === 'candidacy') store.setCandidacyRule(chosen('candidacy'));
        else if (decision === 'discipline') store.disciplineGroup();
        else if (decision === 'expel') { confirmThen({ kicker: 'PARTITO', title: 'Espellere i dissidenti?', body: 'Il 2% degli iscritti lascerà il partito: la linea si rafforza, ma la minoranza non lo dimenticherà.', confirmLabel: 'Espelli', tone: 'danger' }, () => store.expelDissidents()); return; }
        else if (decision === 'congress') store.callEarlyCongress();
        else if (decision === 'investment') store.partyInvestment(value);
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const politicianOpen = event.target.closest('[data-politician-profile]')?.dataset.politicianProfile;
    if (politicianOpen) {
      catalog.selectedPoliticianId = politicianOpen; catalog.profileLoading = true; render(store.getState(),store.getLastSaved());
      try { await loadRealCollections(['groupMemberships','offices','partyMembershipHistory','parliamentaryGroupHistory',...PARTY_LINK_COLLECTIONS]); }
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
    // The bills of the Government, of the other groups and of the committees: speeches and the player's vote.
    const confidenceControl = event.target.closest('[data-confidence-vote]');
    if (confidenceControl) {
      try { store.castConfidenceVote(confidenceControl.dataset.confidenceVote); playSound('confirm'); }
      catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const localControl = event.target.closest('[data-local-vote],[data-local-question],[data-local-concede],[data-local-tax]');
    if (localControl) {
      const { instId, actId } = localControl.dataset;
      try {
        if (localControl.dataset.localVote) store.castLocalVote(instId, actId, localControl.dataset.localVote);
        else if (localControl.dataset.localConcede) store.concedeLocal(instId, actId, localControl.dataset.localConcede);
        else if (localControl.dataset.localTax) store.setLocalTaxLevel(instId, localControl.dataset.localTax);
        else store.questionLocalExecutive(instId);
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const billControl = event.target.closest('[data-bill-speak],[data-bill-vote]');
    if (billControl) {
      try {
        if (billControl.dataset.billSpeak) store.speakOnLaw(billControl.dataset.lawId, billControl.dataset.billSpeak);
        else store.castLawVote(billControl.dataset.lawId, billControl.dataset.billVote);
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
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
        else if (parliamentAction === 'support-government') store.supportGovernment();
        else if (parliamentAction === 'withdraw-support') { confirmThen({ kicker: 'GOVERNO', title: 'Ritirare il sostegno al governo?', body: 'Il tuo gruppo esce dalla maggioranza e il governo dovrà verificare la fiducia: può cadere.', confirmLabel: 'Ritira il sostegno', tone: 'danger' }, () => store.withdrawGovernmentSupport()); return; }
        else if (parliamentAction === 'contest-role') store.contestCommitteeRole();
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const sharedAction = event.target.closest('[data-admin-shared]')?.dataset.adminShared;
    if (sharedAction) {
      try {
        if (sharedAction === 'publish') { const result = await publishSharedArchive(); admin.message = `Archivio pubblicato: ${result.parties} partiti, ${result.politicians} politici, ${result.logos} loghi.`; }
        else if (sharedAction === 'refresh') { await refreshSharedArchive(); refreshAdminOverrides(); admin.message = 'Archivio condiviso aggiornato.'; }
        else if (sharedAction === 'logout') { closeSharedSession(); admin.message = 'Browser scollegato dall’archivio condiviso.'; }
      } catch (error) { admin.message = error.message; }
      render(store.getState(), store.getLastSaved()); return;
    }
    const adminTarget = event.target.closest('[data-admin-tab],[data-admin-select-party],[data-admin-select-politician],[data-admin-reset-record],[data-admin-reset-field],[data-admin-logo],[data-admin-unlink],[data-admin-link],[data-admin-remove-role],[data-admin-export],[data-admin-clear],[data-admin-more],[data-admin-new-party],[data-admin-cancel-new],[data-admin-hide],[data-admin-restore],[data-admin-delete]');
    if (adminTarget && !isAdminVerified()) { admin.message = 'Sessione del proprietario non verificata.'; render(store.getState(), store.getLastSaved()); return; }
    if (adminTarget) {
      const data = adminTarget.dataset;
      try {
        if (data.adminTab) { admin.tab = data.adminTab; admin.query = ''; admin.message = ''; admin.listPage = 1; admin.creating = false; render(store.getState(), store.getLastSaved()); }
        else if (data.adminSelectParty) { admin.partyId = data.adminSelectParty; admin.creating = false; admin.linkQuery = ''; admin.message = ''; render(store.getState(), store.getLastSaved()); }
        else if ('adminMore' in data) { admin.listPage++; render(store.getState(), store.getLastSaved()); }
        else if ('adminNewParty' in data) { admin.creating = true; admin.partyId = null; admin.message = ''; render(store.getState(), store.getLastSaved()); }
        else if ('adminCancelNew' in data) { admin.creating = false; admin.message = ''; render(store.getState(), store.getLastSaved()); }
        else if (data.adminHide) { confirmThen({ kicker: 'AREA AMMINISTRATIVA', title: 'Nascondere il partito dal gioco?', body: 'Non comparirà più nelle liste del gioco. I dati reali restano intatti e potrai ripristinarlo dall’elenco dei nascosti.', confirmLabel: 'Nascondi' }, () => { setRecordHidden(data.adminHide, true); adminDone('Partito nascosto dal gioco.'); }); return; }
        else if (data.adminDelete) { confirmThen({ kicker: 'AREA AMMINISTRATIVA', title: 'Eliminare il partito aggiunto?', body: 'Il partito aggiunto da te verrà eliminato dal gioco e dall’archivio condiviso (se collegato). Resta ripristinabile dall’elenco dei nascosti.', confirmLabel: 'Elimina partito', tone: 'danger' }, () => { setRecordHidden(data.adminDelete, true, { deleted: true }); adminDone('Partito eliminato: resta ripristinabile.'); }); return; }
        else if (data.adminRestore) { setRecordHidden(data.adminRestore, false); adminDone('Partito ripristinato nel gioco.'); }
        else if (data.adminSelectPolitician) { admin.politicianId = data.adminSelectPolitician; admin.message = ''; render(store.getState(), store.getLastSaved()); }
        else if ('adminResetRecord' in data) { const target = adminSelected(); confirmThen({ kicker: 'AREA AMMINISTRATIVA', title: 'Ripristinare i dati originali?', body: 'Tutte le tue correzioni su questo record verranno rimosse e torneranno i valori del dataset verificato (anche per tutti i giocatori, se l’archivio condiviso è collegato).', confirmLabel: 'Ripristina il record', tone: 'danger' }, () => { resetRecordOverride(target.collection, target.id); adminDone('Dati originali ripristinati.'); }); return; }
        else if (data.adminResetField) { const target = adminSelected(); const field = data.adminResetField; confirmThen({ kicker: 'AREA AMMINISTRATIVA', title: 'Ripristinare questo campo?', body: 'La tua correzione su questo campo verrà rimossa e tornerà il valore del dataset verificato.', confirmLabel: 'Ripristina il campo' }, () => { const original = pristineRecord(target.collection, target.id) ?? {}; setRecordField(target.collection, target.id, field, original[field] ?? null, original); adminDone('Campo ripristinato al valore del dataset.'); }); return; }
        else if (data.adminLogo) { selectedLogoPartyId = data.adminLogo; logoAdminOpen = true; catalog.logoPage = 1; logoAdminError = ''; render(store.getState(), store.getLastSaved()); }
        else if (data.adminUnlink) { setRecordField('politicians', data.adminUnlink, 'partyId', null, pristineRecord('politicians', data.adminUnlink) ?? {}); adminDone('Parlamentare scollegato dal partito.'); }
        else if (data.adminLink) { const personId = root.querySelector('[data-admin-link-select]')?.value; if (!personId) throw new Error('Scegli un parlamentare da collegare.'); setRecordField('politicians', personId, 'partyId', data.adminLink, pristineRecord('politicians', personId) ?? {}); admin.linkQuery = ''; adminDone('Parlamentare collegato al partito.'); }
        else if (data.adminRemoveRole) { removeRoleOverride(admin.politicianId, data.adminRemoveRole); adminDone('Incarico rimosso.'); }
        else if ('adminExport' in data) { const url = URL.createObjectURL(new Blob([exportAdminArchive()], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `politicando-archivio-amministrativo-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); admin.message = 'Archivio esportato.'; render(store.getState(), store.getLastSaved()); }
        else if ('adminClear' in data) { confirmThen({ kicker: 'AREA AMMINISTRATIVA', title: 'Cancellare tutte le modifiche amministrative?', body: 'Correzioni, collegamenti, partiti aggiunti e nascosti di questo browser verranno cancellati' + (hasSharedSession() ? ', anche nell’archivio condiviso per tutti i giocatori.' : '.') + ' L’operazione non si può annullare: esporta prima l’archivio se vuoi conservarlo.', confirmLabel: 'Cancella tutto', tone: 'danger' }, () => { clearAdminArchive(); adminDone(hasSharedSession() ? 'Archivio svuotato anche per tutti i giocatori.' : 'Archivio amministrativo svuotato: sono tornati i dati del dataset.'); }); return; }
      } catch (error) { admin.message = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const scrollTarget = event.target.closest('[data-scroll]')?.dataset.scroll;
    if (scrollTarget) { document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const simulationControl = event.target.closest('[data-territory-measure],[data-territory-region],[data-budget-line],[data-party-priority],[data-real-law-more],[data-real-law-amend],[data-invest],[data-election-fund]');
    if (simulationControl) {
      const data = simulationControl.dataset;
      try {
        if (data.territoryMeasure) { territory.measure = data.territoryMeasure; render(store.getState(), store.getLastSaved()); }
        else if (data.territoryRegion) { territory.region = data.territoryRegion; render(store.getState(), store.getLastSaved()); root.querySelector('.region-detail')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }
        else if (data.budgetLine) store.setBudget(data.budgetLine, Number(data.budgetLevel));
        else if (data.partyPriority) store.setPartyPriority(data.partyPriority, Number(data.partyPriorityLevel));
        else if (data.invest) store.invest(data.invest);
        else if (data.electionFund) store.saveForElection(Number(data.electionFund));
        else if ('realLawMore' in data) { realLaws.page++; render(store.getState(), store.getLastSaved()); }
        else if (data.realLawAmend) {
          const law = (realDatabase.laws ?? []).find(item => item.id === data.realLawAmend);
          const form = root.querySelector('[data-law-proposal-form]');
          if (!law || !form) throw new Error('Atto non disponibile.');
          const label = law.lawNumber ? `legge n. ${law.lawNumber}/${String(law.lawDate ?? '').slice(0, 4)}` : 'atto in discussione al Senato';
          form.elements.title.value = `Modifiche alla ${label}`.slice(0, 90);
          const realArea = areaOf(realLawArea(law));
          if (realArea) { form.querySelector('[data-policy-fields]').outerHTML = policyFields({ area: realArea.id }); refreshPolicyPreview(form); }
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
    // The national cycle: the secretary's coalition and the line of the national campaign.
    const nationalCoalition = event.target.closest('[data-national-coalition]')?.dataset.nationalCoalition;
    const nationalLine = event.target.closest('[data-national-line]')?.dataset.nationalLine;
    if (nationalCoalition || nationalLine) {
      try {
        if (nationalLine) store.setNationalCampaignLine(nationalLine);
        else { const result = store.chooseNationalCoalition(nationalCoalition); playSound(result?.accepted === false ? 'failure' : 'confirm'); }
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
        if (gameActivity) { const result = store.performWeeklyActivity(gameActivity, activityButton.dataset.activityTargetValue ?? root.querySelector(`[data-activity-target="${gameActivity}"]`)?.value ?? null); playSound(result.report.tone === 'bad' ? 'failure' : 'confirm'); }
        else if (agendaChoice) { const result = store.resolveAgendaItem(agendaChoice.dataset.agendaItem, agendaChoice.dataset.agendaChoice); playSound(result.report.tone === 'bad' ? 'failure' : 'confirm'); }
        else if (fastForward) {
          // Far-reaching: many weeks in one action, so it is confirmed first.
          const info = event.target.closest('[data-game-fastforward]').dataset;
          const count = Number(info.fastforwardWeeks) || 0;
          const opens = info.fastforwardDate ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${info.fastforwardDate}T12:00:00`)) : '';
          confirmThen({ kicker: 'AVANZAMENTO', title: 'Avanzare fino alle candidature?', body: `Il tempo scorrerà${count > 1 ? ` per circa ${count} settimane` : ''} fino all’apertura delle candidature${info.fastforwardLabel ? ` (${info.fastforwardLabel}${opens ? `, dal ${opens}` : ''})` : ''}.`, details: ['Attività, eventi e scadenze andranno avanti senza di te: le decisioni in agenda si chiuderanno con la scelta predefinita.', 'Il salto non si può annullare: se vuoi un punto a cui tornare, salva prima in uno slot dal menu.'], confirmLabel: 'Avanza fino alle candidature' }, () => store.fastForwardToElection(fastForward));
          return;
        }
        else if (partyCurrent) store.alignPartyCurrent(partyCurrent);
        else if (partyAction === 'contest') store.contestPartyRank();
        else if (partyAction === 'leave') { confirmThen({ kicker: 'PARTITO', title: 'Lasciare il partito?', body: 'Perderai ruolo e sostegno interno; iscritti e alleati se ne ricorderanno.', confirmLabel: 'Lascia il partito', tone: 'danger' }, () => store.leaveParty()); return; }
        else if (partyAction === 'join') store.joinParty(root.querySelector('[data-party-join]')?.value, realParties());
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
      return;
    }
    const partyOpen = event.target.closest('[data-party-profile]')?.dataset.partyProfile;
    if (partyOpen) {
      catalog.selectedPartyId = partyOpen; catalog.profileLoading = true; render(store.getState(),store.getLastSaved());
      try { await loadRealCollections(['politicalFigures','partyLeaderships','politicians',...PARTY_LINK_COLLECTIONS]); }
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
      if (wizardAction === 'cancel') { wizard = null; if (!store.hasCareer()) menu.open = true; }
      else if (wizardAction === 'back') wizard.step = Math.max(1,wizard.step-1);
      else if (wizardAction === 'next') { if (!failStep()) wizard.step = Math.min(CAREER_STEPS,wizard.step+1); }
      else if (goto >= 1 && goto < CAREER_STEPS) wizard.step = goto;
      else if (wizardAction === 'finish') {
        const failing = Array.from({ length: CAREER_STEPS }, (_, index) => index + 1).map(step => [step, validateCareerStep(wizard,step,selectableParties(),realDatabase.parliamentaryGroups ?? [],wizardTerritory(),{ requireTerritory: true })]).find(([, errors]) => errors.length);
        if (failing) { wizard.step = failing[0]; wizard.errors = failing[1]; }
        else if (store.hasCareer() && !wizard.confirmedReplace) {
          const full = store.listSlots().length >= MAX_SLOTS;
          const meta = store.currentMeta();
          confirmThen({ title: 'Iniziare una nuova carriera?', body: `La carriera in corso (${meta?.player ?? 'giocatore'}, settimana ${meta?.week ?? '—'}) non sarà più quella attiva.`, details: [full ? `Gli slot sono pieni (${MAX_SLOTS}): la carriera in corso non potrà essere salvata e andrà persa. Annulla ed esportala su file, oppure libera uno slot dal menu Carica partita.` : 'Verrà salvata automaticamente in uno slot: potrai ricaricarla dal menu Carica partita.', account.user ? 'Anche la copia online nel tuo account resta disponibile.' : ''], confirmLabel: 'Inizia la nuova carriera', tone: full ? 'danger' : 'primary' }, async () => { if (!wizard) return; wizard.confirmedReplace = true; await finishWizard(); });
          return;
        }
        else await finishWizard();
      }
      render(store.getState(),store.getLastSaved()); return;
    }
    const suggestedParty = event.target.closest('[data-admin-suggest-party]');
    if (suggestedParty) {
      const select = suggestedParty.closest('form')?.querySelector('select[name="partyId"]');
      if (select) { select.value = suggestedParty.dataset.adminSuggestParty; select.dispatchEvent(new Event('change', { bubbles: true })); select.focus(); }
      admin.message = 'Partito proposto dalla lista d’elezione: premi «Salva modifiche» per confermarlo.';
      return;
    }
    if (wizard) {
      if (event.target.closest('[data-wizard-retry-data]')) { syncWizardDraft(); wizard.errors = []; await loadWizardData(); return; }
      if (event.target.closest('[data-wizard-show-parties]')) { syncWizardDraft(); wizard.partyListLimit = (Number(wizard.partyListLimit)||12)+12; render(store.getState(),store.getLastSaved()); return; }
      if (event.target.closest('[data-wizard-show-municipalities]')) { syncWizardDraft(); wizard.municipalityLimit = (Number(wizard.municipalityLimit)||40)+40; render(store.getState(),store.getLastSaved()); return; }
      // A comune picked from the ISTAT list becomes the starting territory (name, code, unit and region).
      const municipalityCode = event.target.closest('[data-municipality-code]')?.dataset.municipalityCode;
      if (municipalityCode) {
        syncWizardDraft();
        const territory = wizardTerritory();
        wizard.municipalityCode = municipalityCode;
        const place = chosenPlace(wizard, territory);
        if (place) Object.assign(wizard, { municipality: place.municipality.name, region: place.region, territorialUnit: wizard.territorialUnit || '', provinceCode: place.unit.code, provinceName: place.unit.name, provinceType: place.unit.type });
        wizard.errors = []; render(store.getState(),store.getLastSaved()); return;
      }
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
      logoAdminOpen = false; pendingLogo = null; pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl = null; pendingRemoteUrl = null; logoUrlDraft = ''; logoAdminError = ''; if (logoEditor?.context === 'admin') closeLogoEditor(); render(store.getState(),store.getLastSaved()); return;
    }
    if (event.target.matches('[data-logo-admin-item]')) return;
    const logoParty = event.target.closest('[data-logo-party-id]')?.dataset.logoPartyId;
    if (logoParty) { selectedLogoPartyId = logoParty; pendingLogo = null; pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl = null; pendingRemoteUrl = null; logoUrlDraft = ''; logoAdminError = ''; if (logoEditor?.context === 'admin') closeLogoEditor(); render(store.getState(),store.getLastSaved()); return; }
    // The phone sheet opens and closes at once, without redrawing the page.
    const sheet = root.querySelector('[data-mobile-sheet]');
    if (event.target.closest('[data-mobile-more]')) { const open = sheet.hidden; sheet.hidden = !open; event.target.closest('[data-mobile-more]').setAttribute('aria-expanded', String(open)); if (open) sheet.querySelector('.sheet-item.active, .sheet-item')?.focus?.(); return; }
    if (sheet && !sheet.hidden && (event.target.closest('[data-mobile-close]') || event.target === sheet)) { sheet.hidden = true; root.querySelector('[data-mobile-more]')?.setAttribute('aria-expanded', 'false'); return; }
    const nav = event.target.closest('[data-nav]');
    if (nav) { if (nav.dataset.archiveJump) archive.tab = nav.dataset.archiveJump; setHash(nav.dataset.nav); await ensurePageData(nav.dataset.nav); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'advance') {
      const run = () => {
        store.advanceTurn();
        const game = store.getState().game;
        playSound(game?.inbox.some(item => ['urgente', 'situazione'].includes(item.kind)) ? 'alert' : 'week');
        if (settings.weeklyReport === 'on' && game?.lastReport) { reportOpen = true; render(store.getState(), store.getLastSaved()); }
      };
      // One week never asks; more than one week in a single action is confirmed (it can be turned off for the session).
      const weeks = Number(settings.weeksPerTurn) || 1;
      if (weeks > 1 && !skipMultiWeekConfirm) {
        askConfirm({ kicker: 'AVANZAMENTO', title: `Avanzare di ${weeks} settimane?`, body: `Il tempo scorrerà per ${weeks} settimane di fila: attività non svolte, scadenze ed eventi andranno avanti senza di te.`, details: ['La simulazione si ferma prima se arriva una decisione urgente o una situazione da gestire.', 'Puoi tornare a una settimana per turno nelle impostazioni (Velocità della simulazione).'], option: 'Non chiedere più in questa sessione', confirmLabel: `Avanza di ${weeks} settimane` })
          .then(answer => { if (!answer.ok) return; if (answer.option) skipMultiWeekConfirm = true; run(); render(store.getState(), store.getLastSaved()); });
        return;
      }
      run();
    }
    else if (action === 'menu') { menu.open = true; menu.view = 'home'; render(store.getState(), store.getLastSaved()); }
    else if (action === 'account') { menu.open = true; menu.view = 'account'; await refreshCloud(); render(store.getState(), store.getLastSaved()); }
    else if (action === 'save') store.save();
    else if (action === 'campaign-start') {
      try {
        const value=name=>root.querySelector(`[data-campaign-setup="${name}"]`)?.value;
        const strategy=root.querySelector('input[name="campaign-strategy"]:checked')?.value??null;
        store.startCampaign({electionType:value('electionType'),objective:value('objective'),role:value('role'),municipalityBand:value('municipalityBand'),strategy,topicId:value('topicId')},realParties(),{politicians:realDatabase.politicians??[],groups:realDatabase.parliamentaryGroups??[]});
        views.tabs.elezioni={value:'campagna',context:sectionContext('elezioni',store.getState())}; saveViews();
      } catch(error) { store.getState().ui.toast=error.message || 'Impossibile avviare la campagna.'; render(store.getState(),store.getLastSaved()); }
    }
    else if (action === 'campaign-new') store.clearCampaign();
    else if (action === 'new-career') await openNewGame();
    else if (action === 'reset') store.reset();
    else if (action === 'retry-data' && retryData && !retryingData) { retryingData = true; render(store.getState(), store.getLastSaved()); try { await retryData(); } finally { retryingData = false; render(store.getState(), store.getLastSaved()); } }
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
        if ((!pendingLogo && !pendingRemoteUrl) || !selectedLogoPartyId) throw new Error('Scegli prima un file oppure carica un’immagine da un indirizzo.');
        const source = root.querySelector('[data-logo-source]')?.value.trim() || '';
        const verified = Boolean(root.querySelector('[data-logo-verified]')?.checked);
        const alt = root.querySelector('[data-logo-alt]')?.value.trim() || '';
        if (verified && !/^https?:\/\//i.test(source)) throw new Error('Per segnare il logo verificato inserisci una fonte HTTPS o HTTP.');
        if (!alt) throw new Error('Inserisci un testo alternativo per il logo.');
        // The editor's result (crop, ratio, zoom, transparency) is what is saved, with its metadata; source and verification stay as declared.
        const edited = pendingLogo && logoEditor?.context === 'admin' ? await exportLogo(logoEditor, logoEditorImage, pendingLogo) : null;
        if (edited) { const name = pendingLogo.name || 'logo'; pendingLogo = edited.blob; pendingLogo.name = edited.blob.type === 'image/png' && !/\.png$/i.test(name) ? `${name.replace(/\.[a-z0-9]+$/i, '')}.png` : name; }
        await saveLocalLogo(selectedLogoPartyId, pendingLogo ? {blob:pendingLogo,fileName:pendingLogo.name || 'logo',sourceUrl:pendingRemoteUrl,source,verified,alt,editor:edited?.editor ?? null} : {url:pendingRemoteUrl,sourceUrl:pendingRemoteUrl,source,verified,alt});
        // The owner connected to the shared archive publishes the logo for everyone: the address, or the image itself if small.
        if (isAdminVerified()) {
          const shared = pendingRemoteUrl && /^https:/i.test(pendingRemoteUrl) ? { url: pendingRemoteUrl, alt, sourceUrl: source || pendingRemoteUrl } : pendingLogo && pendingLogo.size <= 300000 ? { dataUrl: await blobToDataUrl(pendingLogo), alt, sourceUrl: source || null } : null;
          if (shared) await publishSharedArchive({ [selectedLogoPartyId]: shared }).then(() => { logoAdminError = ''; }).catch(error => { logoAdminError = `Logo salvato in questo browser, non pubblicato: ${error.message}`; });
          else logoAdminError = 'Logo salvato in questo browser: per pubblicarlo per tutti usa un indirizzo https o un file sotto i 300 KB.';
        }
        pendingLogo=null; pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl=null; pendingRemoteUrl=null; logoUrlDraft=''; closeLogoEditor(); await refreshLocalLogos();
      } catch (error) { logoAdminError=error.message || 'Salvataggio non riuscito.'; render(store.getState(),store.getLastSaved()); }
    }
    else if (action === 'logo-delete') {
      try {
        await deleteLocalLogo(selectedLogoPartyId); logoAdminError='';
        if (isAdminVerified() && sharedLogos()[selectedLogoPartyId]) await publishSharedArchive({ [selectedLogoPartyId]: null });
        await refreshLocalLogos();
      }
      catch (error) { logoAdminError=error.message || 'Eliminazione non riuscita.'; render(store.getState(),store.getLastSaved()); }
    }
  });
  root.addEventListener('submit', async event => {
    const form = event.target;
    if (form.matches('[data-account-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const mode = form.dataset.accountForm;
      account.error = ''; account.message = ''; account.unreachable = false;
      if (mode === 'register' && data.password !== data.confirm) { account.error = 'Le due password non coincidono.'; render(store.getState(), store.getLastSaved()); return; }
      account.busy = mode; render(store.getState(), store.getLastSaved());
      try {
        if (mode === 'register') await register(data.username, data.password); else await login(data.username, data.password);
        account.user = currentAccount();
        setAccountStatus('available');
        account.message = mode === 'register' ? 'Account creato: da ora le tue carriere si salvano anche online.' : `Bentornato, ${account.user.username}.`;
        markOnboarding({ account: true });
        await refreshCloud();
        // The running career joins the account at once (never overwriting a newer version saved elsewhere).
        if (store.hasCareer()) await syncCareer();
        const wanted = menu.needAccount;
        menu.needAccount = false;
        account.busy = false;
        if (mode === 'register' && onboarding().tour !== 'done') { menu.view = 'tour'; menu.tourStep = 0; menu.reveal = true; }
        else if (wanted) { await openNewGame(); return; }
      } catch (error) { account.error = error.message; if (['offline', 'timeout'].includes(error.code) || error.status >= 500) setAccountStatus('unreachable'); else if (error.status) setAccountStatus('available'); }
      account.busy = false;
      render(store.getState(), store.getLastSaved()); return;
    }
    if (form.matches('[data-admin-shared-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try { await openSharedSession(data.pin, data.setupCode ?? ''); await refreshSharedArchive(); refreshAdminOverrides(); admin.message = 'Accesso del proprietario verificato: le modifiche vengono pubblicate per tutti.'; await ensurePageData('amministrazione', true); }
      catch (error) { admin.message = error.message; }
      render(store.getState(), store.getLastSaved()); return;
    }
    if (form.matches('[data-admin-new-party-form],[data-admin-form],[data-admin-role-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try {
        if (!isAdminVerified()) throw new Error('Sessione del proprietario non verificata.');
        if (form.matches('[data-admin-new-party-form]')) {
          const id = addAdminParty(data, adminContext().knownParties);
          const logoUrl = String(data.logoUrl ?? '').trim();
          if (logoUrl && !/^https:\/\/[^\s"'<>]+$/i.test(logoUrl)) throw new Error('Il logo da indirizzo deve iniziare con https://');
          admin.creating = false; admin.partyId = id; admin.partyFilter = 'tutti';
          if (logoUrl) await publishSharedArchive({ [id]: { url: logoUrl, alt: `Logo di ${data.officialName}`, sourceUrl: logoUrl } });
          adminDone('Partito aggiunto: è disponibile nelle sezioni del gioco.');
        } else if (form.matches('[data-admin-role-form]')) {
          addRoleOverride(form.dataset.adminId, data); adminDone('Incarico aggiunto.');
        } else {
          saveRecordOverride(form.dataset.adminCollection, form.dataset.adminId, data, pristineRecord(form.dataset.adminCollection, form.dataset.adminId) ?? {});
          adminDone('Modifiche salvate nell’archivio amministrativo.');
        }
      } catch (error) { admin.message = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    if (form.matches('[data-logo-url-form]')) { event.preventDefault(); await previewLogoUrl(new FormData(form).get('url')); return; }
    if (form.matches('[data-law-proposal-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      const reference = (realDatabase.laws ?? []).find(item => item.id === data.get('realReference'));
      try { store.proposeLaw({ title: data.get('title'), policy: designFromForm(form), summary: data.get('summary'), realReference: reference ? { id: reference.id, label: reference.lawNumber ? `legge n. ${reference.lawNumber} del ${reference.lawDate}` : reference.officialTitle.slice(0, 120), officialTitle: reference.officialTitle, lawNumber: reference.lawNumber, lawDate: reference.lawDate, status: reference.status, sourceUrl: reference.sourceUrl, source: 'real', verified: true } : null }); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    } else if (form.matches('[data-local-propose-form],[data-local-reshuffle-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      try {
        if (form.matches('[data-local-propose-form]')) store.proposeLocalAct(form.dataset.instId, data.get('area'));
        else store.reshuffleLocalGiunta(form.dataset.instId, data.get('portfolio'), data.get('group'));
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    } else if (form.matches('[data-bill-amend-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      const [key, value] = String(data.get('patch') ?? '').split(':');
      try { const result = store.amendOthersLaw(form.dataset.lawId, key, value, { offerVote: data.get('deal') === '1' }); playSound(result.accepted ? 'confirm' : 'failure'); }
      catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    } else if (form.matches('[data-law-amend-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      try { store.amendLaw(form.dataset.lawId, data.get('amendment')); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    } else if (form.matches('[data-government-program-form],[data-policy-form],[data-budget-form],[data-reshuffle-form],[data-party-program-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      try {
        if (form.matches('[data-government-program-form]')) store.setGovernmentProgram({ line: data.get('line'), priorities: data.getAll('priorities') });
        else if (form.matches('[data-policy-form]')) {
          const kind = event.submitter?.value ?? 'bill';
          const draft = { title: data.get('title'), policy: designFromForm(form) };
          if (kind === 'decree') store.issueDecree(draft); else store.proposeGovernmentBill(draft);
        }
        else if (form.matches('[data-budget-form]')) store.presentBudget(planFromForm(form));
        else if (form.matches('[data-reshuffle-form]')) store.reshuffleMinister(data.get('portfolio'), data.get('groupId'));
        else if (form.matches('[data-party-program-form]')) store.setPartyProgram(data.getAll('program'));
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    } else if (form.matches('[data-government-post-form]')) {
      event.preventDefault();
      const portfolio = new FormData(form).get('portfolio');
      try { if (!portfolio) throw new Error('Scegli un ministero.'); store.requestGovernmentPost(String(portfolio)); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    } else if (form.matches('[data-minister-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      try { store.assignMinister(data.get('portfolio'), data.get('groupId'), data.get('appointee') === 'player' ? 'player' : 'group'); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    }
  });
  root.addEventListener('toggle', event => {
    const element = event.target;
    if (!element?.matches?.('details[data-remember]')) return;
    views.open = { ...(views.open ?? {}), [element.dataset.remember]: element.open };
    saveViews();
  }, true);
  // Dragging on the logo editor's stage moves the frame over the image.
  root.addEventListener('pointerdown', event => {
    const stage = event.target?.closest?.('[data-logo-stage]');
    if (!stage || !logoEditor) return;
    const box = stage.getBoundingClientRect();
    logoDrag = { x: event.clientX, y: event.clientY, panX: logoEditor.panX, panY: logoEditor.panY, ratio: stage.width / Math.max(1, box.width), scale: Number(stage.dataset.scale) || 1 };
    stage.setPointerCapture?.(event.pointerId);
    event.preventDefault?.();
  });
  root.addEventListener('pointermove', event => {
    if (!logoDrag || !logoEditor) return;
    const next = panFromDrag({ ...logoEditor, panX: logoDrag.panX, panY: logoDrag.panY }, (event.clientX - logoDrag.x) * logoDrag.ratio, (event.clientY - logoDrag.y) * logoDrag.ratio, logoDrag.scale);
    Object.assign(logoEditor, next);
    for (const key of ['panX', 'panY']) { const input = root.querySelector(`input[data-logo-edit="${key}"]`); if (input) input.value = String(logoEditor[key]); }
    drawLogoEditor(root, logoEditor, logoEditorImage);
  });
  const endLogoDrag = () => { if (logoDrag) { logoDrag = null; refreshWizardLogoPreview(); } };
  root.addEventListener('pointerup', endLogoDrag);
  root.addEventListener('pointercancel', endLogoDrag);
  root.addEventListener('input', event => {
    const field = event.target;
    if (logoEditor && field.matches?.('input[type="range"][data-logo-edit]')) { logoEditor[field.dataset.logoEdit] = Number(field.value); drawLogoEditor(root, logoEditor, logoEditorImage); return; }
    if (field.closest?.('[data-policy-fields]') || field.closest?.('[data-budget-form]')) { refreshPolicyPreview(field.closest('form'), field); return; }
    if (field.matches('[data-catalog-filter]')) {
      catalog[field.dataset.catalogFilter]=field.value;
      if (field.dataset.catalogFilter === 'partyQuery') catalog.partyPage=1;
      if (field.dataset.catalogFilter === 'politicianQuery') catalog.politicianPage=1;
      updateCatalog(); return;
    }
    if (field.matches('[data-admin-query]')) { admin.query = field.value; admin.listPage = 1; preserveFocusRender('[data-admin-query]'); return; }
    if (field.matches('[data-admin-filter]')) { admin.partyFilter = field.value; admin.listPage = 1; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-real-law-filter="query"]')) { realLaws.query = field.value; realLaws.page = 1; preserveFocusRender('[data-real-law-filter="query"]'); return; }
    if (field.matches('[data-admin-link-query]')) { admin.linkQuery = field.value; preserveFocusRender('[data-admin-link-query]'); return; }
    if (field.matches('[data-logo-query]')) { catalog.logoQuery=field.value; catalog.logoPage=1; updateLogoAdmin(); return; }
    if (!wizard || !field.matches('.career-wizard [name]')) return;
    if (field.name === 'partyProgram' || field.name === 'partyLogoMode') { syncWizardDraft(); if (field.name === 'partyLogoMode') render(store.getState(), store.getLastSaved()); return; }
    if (field.type === 'file') return;
    if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
    else wizard[field.name] = field.value;
    if (/^partyLogo|^partyColor|^partyAbbreviation/.test(field.name)) updateWizardLogo();
    if (field.name === 'difficulty') { render(store.getState(), store.getLastSaved()); return; }
    const output = field.closest('.policy-slider')?.querySelector('output');
    if (output) output.textContent=field.value;
    if (field.name === 'partyColor') { const caption=field.parentElement?.querySelector('span'); if(caption) caption.textContent=field.value; }
    if (field.matches('[data-wizard-party-search]')) { wizard.partyListLimit=12; preserveFocusRender('[data-wizard-party-search]'); }
    if (field.matches('[data-wizard-group-search]')) preserveFocusRender('[data-wizard-group-search]');
    if (field.matches('[data-wizard-municipality-search]')) { wizard.municipalityLimit = 40; preserveFocusRender('[data-wizard-municipality-search]'); }
  });
  root.addEventListener('change', async event => {
    // The dialog's option survives a redraw while the confirmation is open.
    if (pendingConfirm && event.target.matches?.('[data-confirm-option]')) { pendingConfirm.optionChecked = Boolean(event.target.checked); return; }
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
    if (logoEditor && field.matches('[data-logo-edit]')) {
      const key = field.dataset.logoEdit;
      if (key === 'ratio') logoEditor.ratio = field.value;
      else if (key === 'transparent') logoEditor.transparent = Boolean(field.checked);
      else logoEditor[key] = Number(field.value);
      if (['ratio', 'transparent'].includes(key)) render(store.getState(), store.getLastSaved());
      refreshWizardLogoPreview();
      return;
    }
    if (field.matches('[data-view-filter-select]')) { views.filters[field.dataset.viewFilterSelect] = field.value; saveViews(); render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-hemi-filter]')) { views.hemicycle[field.dataset.hemiFilter] = field.value; if (field.dataset.hemiFilter === 'vote') views.hemicycle.selected = null; saveViews(); render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-admin-chamber]')) { admin.chamber = field.value; admin.listPage = 1; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-real-law-filter]') && field.dataset.realLawFilter !== 'query') { realLaws[field.dataset.realLawFilter] = field.value; realLaws.page = 1; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-wizard-logo-upload]') && wizard) {
      const file = field.files?.[0]; if (!file) return;
      try {
        wizard.partyLogoBlob = await validateLogoFile(file);
        wizard.partyLogoBlob.name = file.name;
        if (wizard.partyLogoPreview?.startsWith?.('blob:')) URL.revokeObjectURL(wizard.partyLogoPreview);
        wizard.partyLogoPreview = URL.createObjectURL(wizard.partyLogoBlob);
        await openLogoEditor(wizard.partyLogoBlob, 'wizard', file.name);
        wizard.partyLogoError = '';
        paintLogoEditor();
        refreshWizardLogoPreview();
        updateWizardLogo();
      } catch (error) { wizard.partyLogoError = error.message; syncWizardDraft(); render(store.getState(), store.getLastSaved()); }
      return;
    }
    if (field.matches('[data-menu-import]')) {
      const file = field.files?.[0]; if (!file) return;
      field.value = '';
      const text = await file.text();
      const run = async () => {
        try { store.loadGame(text, 'Partita importata'); menu.open = false; menu.error = ''; playSound('success'); await ensurePageData('panoramica'); }
        catch (error) { menu.error = error instanceof SyntaxError ? 'Il file non è un salvataggio leggibile.' : error.message; render(store.getState(), store.getLastSaved()); }
      };
      if (store.hasCareer()) { confirmThen({ title: 'Importare questa partita?', body: `La partita del file «${file.name}» sostituirà quella in corso.`, details: [store.hasUnsavedChanges() ? 'La partita in corso ha modifiche non salvate: verrà salvata in uno slot prima dell’importazione.' : 'La partita in corso resta nei tuoi salvataggi (e online, se hai un account).'], confirmLabel: 'Importa' }, run); return; }
      await run(); return;
    }
    if (field.matches('[data-admin-import]')) {
      const file = field.files?.[0]; if (!file) return;
      field.value = '';
      const text = await file.text();
      confirmThen({ kicker: 'AREA AMMINISTRATIVA', title: 'Sostituire l’archivio amministrativo?', body: `Le correzioni di questo browser verranno sostituite da quelle del file «${file.name}»${isAdminVerified() ? ' e pubblicate per tutti i giocatori' : ''}. Esporta prima l’archivio attuale se vuoi conservarlo.`, confirmLabel: 'Importa e sostituisci', tone: 'danger' }, () => { try { importAdminArchive(text); adminDone('Archivio importato e applicato.'); } catch (error) { admin.message = error.message || 'Importazione non riuscita.'; } });
      return;
    }
    if (field.matches('[data-wizard-party-filter]')) { syncWizardDraft(); wizard.partyListLimit=12; preserveFocusRender('[data-wizard-party-filter]'); return; }
    // Another region (or province) means another list of comuni: the choice starts again there.
    if (field.matches('[data-wizard-region]') && wizard) { Object.assign(wizard, { region: field.value, territorialUnit: '', municipality: '', municipalityCode: '', municipalityQuery: '', municipalityLimit: 40, provinceCode: '', provinceName: '', provinceType: '', errors: [] }); render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-wizard-unit]') && wizard) { wizard.territorialUnit = field.value; wizard.municipalityLimit = 40; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-logo-upload]')) {
      const file=field.files?.[0]; if(!file) return;
      try {
        pendingLogo=await validateLogoFile(file); pendingLogo.name=file.name; pendingRemoteUrl=null;
        pendingLogoUrl && URL.revokeObjectURL(pendingLogoUrl); pendingLogoUrl=URL.createObjectURL(pendingLogo);
        logoAdminError='';
        await openLogoEditor(pendingLogo, 'admin', file.name);
        render(store.getState(), store.getLastSaved());
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
  root.addEventListener('paste', event => {
    const field = event.target;
    if (!field.matches?.('[data-logo-url]')) return;
    const text = event.clipboardData?.getData('text')?.trim();
    if (text) { event.preventDefault(); field.value = text; previewLogoUrl(text); }
  });
  root.addEventListener('click', event => {
    const more = event.target.closest('[data-catalog-more]')?.dataset.catalogMore;
    if (more) { catalog[more]++; updateCatalog(); }
  });
  store.subscribe(render);
  // First opening without an account (and the account service reachable): the welcome screen explains the account
  // and leads to it before the first career. Players already signed in are never asked again.
  if (!account.user && account.status !== 'none' && !onboarding().account && !menu.localStart && menu.open) { menu.view = 'benvenuto'; menu.reveal = true; render(store.getState(), store.getLastSaved()); }
  // The account service is asked once at the opening (players already signed in find out at their first sync).
  if (account.status === 'checking') probeAccount();
  // Escape closes the confirmation dialog (it means “Annulla”).
  globalThis.addEventListener?.('keydown', event => { if (event.key === 'Escape' && pendingConfirm) settleConfirm(false); });
  // Every local save is followed by an online save of the same career (debounced), when the player has an account.
  let lastSavedSeen = store.getLastSaved();
  store.subscribe((state, saved) => { if (saved !== lastSavedSeen) { lastSavedSeen = saved; if (/^Salvat|aggiornato/.test(saved ?? '')) scheduleSync(); } });
  globalThis.addEventListener?.('online', () => { if (account.user) syncCareer(); });
  if (account.user) refreshCloud().then(() => {
    // Another device may have a newer version of the career open here: say so instead of overwriting it.
    const slot = store.hasCareer() ? slotForCareer(store.getState().career.id) : null;
    const remote = slot ? account.saves.find(item => item.slot === slot) : null;
    if (remote && (knownRevision(slot) ?? 0) < remote.revision) account.conflict = { slot, remote };
    render(store.getState(), store.getLastSaved());
  });
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
  // main.js redraws after the data loaded in the background (or the notice of what is missing).
  return { refresh: () => render(store.getState(), store.getLastSaved()) };
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
// The real government in office, next to the one of the game: a reference, never edited by the simulation.
function realGovernmentCard() {
  const government = (realDatabase.government ?? [])[0];
  if (!government) return '';
  const premier = government.members.find(member => /^Presidente del Consiglio/.test(member.role));
  const ministers = government.members.filter(member => /^Ministr/.test(member.role)).length;
  return `<section class="hq-panel real-government"><div class="home-section-heading"><div><span class="section-kicker">DATO REALE · ${esc(government.sourceName)}</span><h2>${esc(government.label)}</h2></div><button class="text-link" data-nav="archivio" data-archive-jump="governo">Tutti gli incarichi ${icon('arrow', 15)}</button></div><p class="parliament-note">Il governo reale in carica dal ${esc(government.startDate)}${premier ? `, presieduto da ${esc(premier.fullName)} (nome come nella fonte)` : ''}: ${ministers} ministri su ${government.members.length} incarichi. Nella partita il governo è quello simulato qui sopra, nato dalle scelte dei gruppi e dalle tue.</p></section>`;
}
function officeLabel(office) {
  return office.endDate ? `${office.title} · concluso` : office.title;
}
function subpage(state, page, player, party, events, catalog, options = {}) {
  const personalStats = state.dataset.statistics.filter(item => item.subjectId === player?.id);
  const profileMetrics = [['popularity', 'Popolarità'], ['reputation', 'Reputazione'], ['consensus', 'Consenso'], ['experience', 'Esperienza'], ['influence', 'Influenza'], ['notoriety', 'Notorietà']].map(([metric, label]) => { const record = personalStats.find(item => item.metric === metric) ?? (metric === 'consensus' ? state.dataset.statistics.find(item => item.metric === metric && item.subjectId === party?.id) : null); return `<div><span>${label}</span><strong>${record ? `${String(record.value).replace('.', ',')}${record.unit === '%' ? '%' : ''}${record.unit === '%' ? '' : '<small> / 100</small>'}` : '—'}</strong></div>`; }).join('');
  const catalogStatus = { loading: catalog.loadingPage === state.ui.activePage, error: catalog.errors[state.ui.activePage] ?? '' };
  const listContents = {
    amministrazione: renderAdminPanel(options.admin, options.adminContext()),
    sondaggi: renderPollsPage(state, { logoFor: id => { const record = options.findParty?.(id); return record ? options.logoFor?.(record) : null; }, realLeader: options.realLeader, secretary: playerRoles(state).secretary, allianceOdds: options.allianceOdds }) + (state.society ? `<section class="hq-panel media-panel"><div class="home-section-heading"><div><span class="section-kicker">MEDIA · SIMULATI</span><h2>Come ti raccontano</h2></div></div>${renderMediaPanel(state)}</section>` : ''),
    territori: renderTerritoriesPage(state, { ...options.territory, deputies: deputiesByRegion(realDatabase.politicians ?? []) }),
    finanze: renderFinancePage(state),
    parlamento: renderParliamentPage('parlamento', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [], hemicycle: state.parliament ? renderHemicycle(state, { politicians: realDatabase.politicians ?? [], db: realDatabase, view: options.views?.hemicycle, logoFor: options.logoFor }) : '' }) + `<section class="hq-panel contacts-panel"><div class="home-section-heading"><div><span class="section-kicker">${state.parliament?.legislature?.reference === 'simulation' ? 'PARLAMENTARI DELLA XIX LEGISLATURA (REALE) · RAPPORTI SIMULATI' : 'PARLAMENTARI REALI · RAPPORTI SIMULATI'}</span><h2>${state.parliament?.legislature?.reference === 'simulation' ? 'I tuoi contatti della legislatura reale' : 'I tuoi interlocutori in Parlamento'}</h2></div></div>${state.parliament?.legislature?.reference === 'simulation' ? '<p class="sx-note">Dopo il voto della partita le Camere sono simulate: queste persone reali non vi siedono e non intervengono sulle tue proposte; restano contatti politici con i dati della XIX legislatura.</p>' : ''}${renderContactsPanel(state)}</section>`,
    governo: renderParliamentPage('governo', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [], secretary: playerRoles(state).secretary }) + realGovernmentCard(),
    archivio: renderArchiveHub(options.archive, { catalog, status: catalogStatus, logoFor: options.logoFor, realLaws: options.realLaws }),
    leggi: renderParliamentPage('leggi', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [], lawFilter: options.views?.filters?.leggi, committees: realDatabase.committees ?? [], realLaws: renderRealLaws(realDatabase.laws ?? [], options.realLaws, { canPropose: canManageParliament(state.parliament), loading: catalogStatus.loading && !(realDatabase.laws ?? []).length, error: catalogStatus.error }) }),
    calendario: state.game ? renderAgendaPage(state, { tab: options.tabFor?.('agenda', state), filter: options.views?.filters?.agenda, events }) : `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">La tua agenda è libera. Avanza il tempo per generare i primi appuntamenti.</div>'}</div>`,
    politici: `<div class="catalog-body" data-catalog-body>${renderPoliticianArchive(catalog,{status:catalogStatus,logoFor:options.logoFor})}</div>`,
    'partiti-lista': `<div class="catalog-body" data-catalog-body>${renderPartyArchive(catalog,{status:catalogStatus,logoFor:options.logoFor})}</div>`,
    elezioni: renderElectionsHub(state, { parties: options.parties ?? [], logoFor: options.logoFor, tab: options.tabFor?.('elezioni', state), national: options.nationalOverview, geography: options.electoralGeography?.() ?? null, nationalView: options.views?.filters?.nazionali }),
    partito: state.game ? renderPartyPage(state, { tab: options.tabFor?.('partito', state), record: party, logoFor: options.logoFor, selectable: options.selectable ?? [], territory: { units: realDatabase.territorialUnits ?? [], municipalities: isRealCollectionLoaded('municipalities') ? realDatabase.municipalities : null, home: options.homePlace?.() ?? {}, filter: options.views?.filters?.comitati ?? 'tutti', region: options.views?.filters?.['comitati-regione'] ?? '' } }) : `<div class="feature-card party-detail-card"><span class="feature-icon">◇</span><div class="eyebrow">${party ? 'AFFILIAZIONE ATTUALE' : 'PROFILO INDIPENDENTE'}</div><div class="party-detail-heading">${party && options.logoFor?.(party) ? `<img src="${esc(options.logoFor(party))}" alt="${esc(party.logoAlt || `Logo di ${party.officialName || party.name}`)}" />` : ''}<h2>${party ? esc(party.officialName || party.name) : 'Nessuna affiliazione'}</h2></div><p>${party ? esc(party.source === DATA_SOURCES.REAL ? party.factualDescription || 'Descrizione non disponibile nelle fonti consultate.' : party.description || 'Partito pronto a essere configurato.') : 'Sei indipendente. Qui sotto puoi aderire a un partito oppure continuare senza affiliazione.'}</p><div class="party-detail-meta">${party ? `<span class="source-pill">${sourceLabel(party.source)}${party.source === DATA_SOURCES.REAL ? ' verificato' : ''}</span>${party.abbreviation ? `<span>${esc(party.abbreviation)}</span>` : ''}${party.orientation ? `<span><small>ORIENTAMENTO</small><strong>${esc(party.orientation)}</strong></span>` : ''}${party.status ? `<span>${esc(party.status)}</span>` : ''}` : '<span class="source-pill">Nessuna affiliazione</span>'}</div>${party?.source === DATA_SOURCES.REAL && party.sourceUrl ? `<a class="catalog-source" href="${esc(party.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ufficiale ↗</a>` : ''}${party?.policyPositions ? `<div class="policy-summary">${[['economia','Economia'],['welfare','Welfare'],['ambiente','Ambiente'],['europa','Europa']].map(([key,label]) => `<span><small>${label}</small><strong>${Number(party.policyPositions[key] ?? 3)} <i>/ 5</i></strong><b><i style="width:${Number(party.policyPositions[key] ?? 3)*20}%"></i></b></span>`).join('')}</div>` : ''}</div>`,
    carriera: renderCareerPage(state, { tab: options.tabFor?.('carriera', state), timelineFilter: options.views?.timelineFilter }),
    profilo: `<div class="profile-page"><section class="profile-page-lead"><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div><div><span class="section-kicker">IL TUO POLITICO</span><h2>${player ? esc(player.displayName) : 'Nessun profilo creato'}</h2><p>${player ? `${esc(player.previousProfession)} · residente a ${esc(player.municipality)}, ${esc(player.region)}` : 'Crea una carriera per definire il tuo profilo.'}</p></div>${player ? '' : '<button class="primary-button" data-action="new-career">Nuova carriera ' + icon('arrow', 16) + '</button>'}</section><div class="profile-page-facts"><div><span>INCARICO</span><strong>${player?.roleId && state.dataset.offices.some(item => item.id === player.roleId) ? esc(officeLabel(state.dataset.offices.find(item => item.id === player.roleId))) : 'Da assegnare'}</strong></div><div><span>TERRITORIO</span><strong>${esc(state.dataset.territories.find(item => item.id === player?.territoryId)?.name ?? player?.region ?? 'Italia')}</strong></div><div><span>PARTITO</span><strong>${party ? esc(partyName(party)) : 'Indipendente'}</strong></div></div><section class="profile-metrics"><h3>Statistiche</h3>${profileMetrics}</section><button class="text-link" data-nav="politici">Esplora i profili politici ${icon('arrow', 16)}</button></div>`,
    eventi: `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">Nessun evento in programma.</div>'}</div>`,
    impostazioni: `<section class="hq-panel settings-panel">${settingsView(options.settings)}</section><div class="settings-grid"><article class="panel settings-card"><div class="eyebrow">PARTITA</div><h3>Salvataggi e partite</h3><p>${esc(options.lastSaved ?? '')}. Dal menu principale carichi, esporti o importi le partite; qui puoi salvare subito.</p><div class="setting-actions"><button class="secondary-button" data-action="save">Salva adesso ${icon('save', 16)}</button><button class="secondary-button" data-menu-action="save-slot">Salva in uno slot</button><button class="secondary-button" data-action="menu">Menu principale ${icon('menu', 15)}</button></div></article><article class="panel settings-card"><div class="eyebrow">ACCOUNT</div><h3>${options.account?.user ? `Connesso come ${esc(options.account.user.username)}` : 'Salvataggi online'}</h3><p>${options.account?.user ? `La carriera si salva anche online dopo ogni salvataggio${options.account.lastSync ? ` (ultima sincronizzazione ${esc(new Date(options.account.lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))})` : ''}: la ritrovi su qualsiasi dispositivo.` : 'Crea un account o accedi per ritrovare le tue carriere su qualsiasi dispositivo. Il browser continua a conservarne una copia.'}</p>${options.account?.conflict ? '<p class="menu-error">Su un altro dispositivo c’è una versione più recente: scegli quale tenere.</p>' : ''}<button class="secondary-button" data-action="account">${options.account?.user ? 'Gestisci l’account' : 'Accedi o registrati'} ${icon('arrow',15)}</button></article><article class="panel settings-card"><div class="eyebrow">DATI DI GIOCO</div><h3>Reale, simulazione, utente</h3><p>I dataset reali sono separati dalla partita e non vengono mai modificati. Le schede reali mostrano fonte, verifica e data di riferimento; i dati non disponibili restano vuoti.</p><span class="source-pill">${(realDatabase.manifest?.collections?.parties ?? 0) + (realDatabase.manifest?.collections?.politicalMovements ?? 0)} organizzazioni · ${realDatabase.manifest?.collections?.politicians ?? 0} parlamentari</span></article>${isAdminVerified() ? `<article class="panel settings-card"><div class="eyebrow">ASSET DEI PARTITI</div><h3>Gestione loghi</h3><p>Carica un file o incolla l’indirizzo di un’immagine: il logo resta salvato in questo browser, separato dai loghi ufficiali verificati.</p><button class="secondary-button" data-action="logo-admin">Apri gestione loghi ${icon('arrow',15)}</button></article><article class="panel settings-card"><div class="eyebrow">AREA RISERVATA</div><h3>Amministrazione dei dati</h3><p>Correggi nomi, sigle, descrizioni, loghi, collegamenti e incarichi di partiti e politici. Le modifiche restano in un archivio separato e non toccano il dataset reale.</p><button class="secondary-button" data-nav="amministrazione">Apri l’area amministrativa ${icon('arrow',15)}</button></article>` : ''}<article class="panel settings-card danger-card"><div class="eyebrow">NUOVA PARTITA</div><h3>Ricomincia da capo</h3><p>Crea un nuovo politico. La partita in corso viene conservata in uno slot di salvataggio.</p><button class="secondary-button" data-action="new-career">Nuova partita</button></article></div>`,
  };
  const routeGroups = { territori: [['finanze', 'Finanze'], ['sondaggi', 'Sondaggi e media']], finanze: [['partito', 'Il tuo partito'], ['territori', 'Territori']], partito: [['partiti-lista', 'Tutti i partiti'], ['finanze', 'Finanze']], parlamento: [['governo', 'Governo'], ['leggi', 'Leggi']], governo: [['parlamento', 'Camere'], ['leggi', 'Leggi']], leggi: [['parlamento', 'Camere'], ['governo', 'Governo']], calendario: [['eventi', 'Eventi']], eventi: [['calendario', 'Agenda']], profilo: [['politici', 'Archivio politici']], politici: [['profilo', 'Il tuo profilo']], 'partiti-lista': [['partito', 'Il tuo partito']] };
  const routes = routeGroups[state.ui.activePage] ?? [];
  // The redesigned central sections open with their own hero: the generic page heading is not repeated.
  const ownHero = ['elezioni', 'carriera', 'partito', 'calendario'].includes(state.ui.activePage) && state.game;
  return `${ownHero ? `<h1 class="visually-hidden">${page.title}</h1>` : `<section class="welcome-row sub-welcome"><div><div class="eyebrow">${page.eyebrow} <span class="eyebrow-line"></span></div><h1>${page.title}<span class="period">.</span></h1><p class="intro">${page.intro}</p></div>${state.ui.activePage === 'carriera' && player ? `<button class="secondary-button" data-action="new-career">Nuova carriera ${icon('plus', 16)}</button>` : ''}</section>`}${routes.length ? `<nav class="section-routes" aria-label="Sezioni collegate">${routes.map(([id, label]) => `<button class="section-route ${state.ui.activePage === id ? 'active' : ''}" data-nav="${id}">${label} ${icon('arrow', 15)}</button>`).join('')}</nav>` : ''}<section class="subpage-content">${listContents[state.ui.activePage] ?? ''}</section><footer class="page-footer"><span>POLITICANDO 2026 <i>·</i> ${['politici','partiti-lista','archivio'].includes(state.ui.activePage)?'DATI REALI VERIFICATI':'SIMULAZIONE'}</span><span>${['politici','partiti-lista','archivio'].includes(state.ui.activePage)?`${realDatabase.manifest?.collections?.politicians ?? 0} parlamentari · ${(realDatabase.manifest?.collections?.parties ?? 0)+(realDatabase.manifest?.collections?.politicalMovements ?? 0)} organizzazioni · snapshot ${esc(realDatabase.manifest?.snapshotDate ?? '—')}` :'Partiti e persone reali restano invariati · tutto ciò che accade in partita è simulazione'}</span></footer>`;
}
function stateCatalogContent(state, catalog, options = {}) {
  const status = { loading: catalog.loadingPage === state.ui.activePage, error: catalog.errors[state.ui.activePage] ?? '' };
  if (state.ui.activePage === 'politici') return renderPoliticianArchive(catalog,{status,logoFor:options.logoFor});
  if (state.ui.activePage === 'partiti-lista') return renderPartyArchive(catalog,{status,logoFor:options.logoFor});
  if (state.ui.activePage === 'archivio') return renderArchiveBody(options.archive,{catalog,status,logoFor:options.logoFor,realLaws:options.realLaws});
  return '';
}
