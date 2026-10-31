import { onLanguageChange, setLanguage, watchTree } from '../core/i18n.js?v=20261031-2';
import { pendingCelebration, pendingOutcome } from '../core/celebration.js?v=20261031-2';
import { fullDate, formatDate } from '../core/time.js?v=20261031-2';
import { referenceGovernmentSpec } from '../data/repositories/government-reference.js?v=20261031-2';
import * as accountApi from '../data/repositories/account-sync.js?v=20261031-2';
import { hideCareers } from '../data/repositories/career-visibility.js?v=20261031-2';
import { accountApiBase, commitRevision, currentAccount, deleteAccount, probeAccountService, deleteCloudSave, downloadSave, listCloudSaves, login, logout, register, slotForCareer } from '../data/repositories/account-sync.js?v=20261031-2';
import { createSyncEngine } from '../data/repositories/sync-queue.js?v=20261031-2';
import { setPartyLogoResolver } from './person-marks.js?v=20261031-2';
import { DATA_SOURCES, isSelectableParty } from '../data/schema.js?v=20261031-2';
import { isRealCollectionLoaded, loadRealCollections, optionalDocumentStatus, loadRealCollectionsSettled, pristineRecord, realDataFailures, realDatabase, refreshAdminOverrides } from '../data/repositories/real-data.js?v=20261031-2';
import { addAdminParty, addRoleOverride, clearAdminArchive, exportAdminArchive, importAdminArchive, loadSharedArchive, removeRoleOverride, resetRecordOverride, saveRecordOverride, setRecordField, setRecordHidden } from '../data/repositories/admin-store.js?v=20261031-2';
import { renderAdminPanel } from './admin-panel.js?v=20261031-2';
import { closeSharedSession, hasSharedSession, isAdminVerified, openSharedSession, rotateSharedCredential, publishSharedArchive, refreshSharedArchive, sharedApiUrl, sharedSyncStatus, verifySharedSession } from '../data/repositories/admin-sync.js?v=20261031-2';
import { syncLogos, resolveLogoConflict, listLogoConflicts } from '../data/repositories/logo-sync.js?v=20261031-2';
import { analyzeLogoArchive, applyLogoImport, exportLogosZip, listReplacedLogos, restoreReplacedLogos } from '../data/repositories/logo-archive.js?v=20261031-2';
import { claimLegacyLogo, deleteLogo, discardLegacyLogo, importGuestLogo, importLogoFromUrl, listGuestLogos, listLegacyLogos, listLogoInfos, loadLogos, logoInfo, logosArePersistent, migrateLegacyLogos, onLogosChange, prepareLogo, releaseLegacyPreviews, resolveLogo, saveLogo } from '../data/repositories/personal-logos.js?v=20261031-2';
import { renderPartyArchive, renderPartyProfile } from './party-archive.js?v=20261031-2';
import { renderPoliticianArchive, renderPoliticianProfile } from './politician-archive.js?v=20261031-2';
import { PARTY_LINK_COLLECTIONS, forceKind, isCoalitionList, politicalForces } from '../data/repositories/party-links.js?v=20261031-2';
import { PROFESSIONS, chosenPlace, makeCareerDraft, pollScenarioOf, removePartyCriterion, renderCareerWizard, togglePartyOrientation, wizardLogoPreview } from './career-wizard.js?v=20261031-2';
import { userPartyLogo } from './party-logo.js?v=20261031-2';
import { WIZARD_VIEWS, validateWizardStep } from '../core/career-rules.js?v=20261031-2';
import { avatarOf, normalizeAvatar } from '../core/avatar.js?v=20261031-2';
import { avatarSvg } from './avatar-svg.js?v=20261031-2';
import { renderElectionsHub } from './elections-hub.js?v=20261031-2';
import { renderQuirinale } from './presidency-view.js?v=20261031-2';
import { renderCareerPage } from './career-page.js?v=20261031-2';
import { renderPartyPage } from './party-page.js?v=20261031-2';
import { renderAgendaPage } from './agenda-page.js?v=20261031-2';
import { HEMICYCLE_DEFAULTS, renderHemicycle } from './hemicycle-view.js?v=20261031-2';
import { renderFeaturedMembers } from './members-view.js?v=20261031-2';
import { drawLogoEditor, exportLogo, measureBackground, panFromDrag, renderLogoEditor } from './logo-editor-view.js?v=20261031-2';
import { createEditorState } from '../core/logo-editor.js?v=20261031-2';
import { renderParliamentPage } from './parliament-mode.js?v=20261031-2';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20261031-2';
import { CAREER_LEVELS } from '../data/regions.js?v=20261031-2';
import { chooseStart } from '../core/start-engine.js?v=20261031-2';
import { renderHeadquarters, renderNewsroom } from './game-mode.js?v=20261031-2';
import { newsMedia, newsPopupHtml, popupItem } from './news-view.js?v=20261031-2';
import { articleScript, bulletinScript, onVoiceChange, onVoicesChange, speakLines, stopVoice, syncVoiceDom, voiceStatus, voiceTarget } from './radio-voice.js?v=20261031-2';
import { ARCHIVE_COLLECTIONS, renderArchiveBody, renderArchiveHub } from './archive-hub.js?v=20261031-2';
import { playerRoles } from '../core/roles.js?v=20261031-2';
import { accordWarning, budgetPreview, designFromForm, planFromForm, policyFields, policyPreview, projectPreview, rangeText, requestFromForm } from './policy-mode.js?v=20261031-2';
import { areaOf } from '../data/simulation/policy-rules.js?v=20261031-2';
import { attachChartInteractions, hideChartTip } from './polls-mode.js?v=20261031-2';
import { renderObservatory } from './observatory-view.js?v=20261031-2';
import { glyph } from './visuals.js?v=20261031-2';
import { identityVars, partyChip, partyIdentity, topbarParty } from './party-identity.js?v=20261031-2';
import { renderMediaPanel, renderTerritoriesPage } from './society-mode.js?v=20261031-2';
import { renderFinancePage } from './finance-mode.js?v=20261031-2';
import { PLAN_MAX, planConfirmLines, planKey, renderPlanTray } from './plan-view.js?v=20261031-2';
import { STAFF_TASK_BY_ID } from '../data/simulation/staff-rules.js?v=20261031-2';
import { renderContactsPanel } from './organization-mode.js?v=20261031-2';
import { renderRealLaws } from './real-laws.js?v=20261031-2';
import { realLawArea } from '../core/society-engine.js?v=20261031-2';
import { canManageParliament } from '../core/parliament-engine.js?v=20261031-2';
import { renderConfirmDialog, renderMainMenu, renderWeeklyReport, settingsView, TOUR_STEPS } from './menu.js?v=20261031-2';
import { setForceColorOverrides } from './political-colors.js?v=20261031-2';
import { renderTutorialCard, tutorialAction, tutorialContext, tutorialState, TUTORIAL_STEPS } from './tutorial.js?v=20261031-2';
import { storage as localStorageApi } from '../core/storage.js?v=20261031-2';
import { loadSettings, resetSettings, saveSetting } from '../core/settings.js?v=20261031-2';
import { playSound } from './sound.js?v=20261031-2';
import { resolveInstitution } from './local-mode.js?v=20261031-2';
import { createRewardsService } from './rewards-service.js?v=20261031-2';
import { patchRewardsPage, renderRewardNotice, renderRewardsPage } from './rewards-page.js?v=20261031-2';

// The destinations of the game, by theme. On computers the sidebar lists the eight and opens the pages of the current one; on phones the
// bar below keeps Home · Elezioni · Sondaggi · Istituzioni one tap away and “Altro” gathers everything else (the same pages, nothing twice).
// A page that belongs to no destination (amministrazione) is reached by its address only.
const SECTIONS = Object.freeze([
  { id: 'panoramica', label: 'Panoramica', short: 'Home', glyph: 'home', pages: [['panoramica', 'Panoramica']] },
  { id: 'carriera', label: 'Carriera', glyph: 'route', pages: [['carriera', 'Percorso'], ['calendario', 'Agenda'], ['eventi', 'Eventi'], ['ricompense', 'Ricompense']] },
  { id: 'partito', label: 'Partito', glyph: 'party', pages: [['partito', 'Il tuo partito'], ['finanze', 'Finanze'], ['partiti-lista', 'Tutti i partiti']] },
  { id: 'elezioni', label: 'Elezioni', glyph: 'ballot', pages: [['elezioni', 'Centrale elettorale']] },
  { id: 'sondaggi', label: 'Sondaggi', glyph: 'chart', pages: [['sondaggi', 'Osservatorio']] },
  { id: 'istituzioni', label: 'Istituzioni', glyph: 'building', pages: [['parlamento', 'Camere'], ['governo', 'Governo'], ['quirinale', 'Quirinale'], ['leggi', 'Leggi']] },
  { id: 'territori', label: 'Territori', glyph: 'map', pages: [['territori', 'Il Paese']], locals: true },
  { id: 'informazione', label: 'Informazione', glyph: 'news', pages: [['notizie', 'Notizie'], ['archivio', 'Archivio'], ['politici', 'Politici']] }
]);
// The four destinations always at hand on phones (the fifth is “Altro”).
const MOBILE_BAR = Object.freeze(['panoramica', 'elezioni', 'sondaggi', 'istituzioni']);
const sectionOf = page => SECTIONS.find(section => section.pages.some(([id]) => id === page)) ?? null;
const mainSectionActive = (id, page) => sectionOf(page)?.id === id;
const sectionTarget = section => section.pages[0][0];
// Comune, Provincia and Regione stay three distinct experiences: one entry for each mandate the player holds, opening that institution in Territori.
const LOCAL_KIND_LABELS = Object.freeze({ comune: 'Comune', provincia: 'Provincia', regione: 'Regione' });
// One entry for each institution (its own id), so two councils of one kind are two entries; the place is added to the label when a kind appears more than once.
const localEntries = state => { const active = (state.local?.institutions ?? []).filter(item => LOCAL_KIND_LABELS[item.kind] && item.status === 'active'); return active.map(inst => ({ page: 'territori', label: active.filter(item => item.kind === inst.kind).length > 1 ? `${LOCAL_KIND_LABELS[inst.kind]} · ${String(inst.name).replace(/^(Comune di|Provincia di|Città metropolitana di|Libero consorzio comunale di|Regione)\s*/, '')}` : LOCAL_KIND_LABELS[inst.kind], scroll: `istituzione-${inst.id}`, kind: inst.kind, inst: inst.id })); };
// The pages of a destination, as entries {page, label, scroll?}: Territori adds the institutions of the player.
const sectionEntries = (section, state) => [...section.pages.map(([page, label]) => ({ page, label, ...(page === 'territori' ? { scroll: 'il-paese' } : {}) })), ...(section.locals ? localEntries(state) : [])];
// “Altro” on phones is the sidebar of the computer, entry by entry: the same sections in the same order with the same names and the same pages (SECTIONS and sectionEntries are the one source of both),
// then Profilo and Impostazioni, which the sidebar keeps at the bottom. A section with more than one page is an accordion (one open at a time, the section of the current page first), one with a single
// page is a direct button, exactly as on the computer. Nothing is added, left out or repeated; every section has its own colour and icon.
const SHEET_BOTTOM = Object.freeze([{ id: 'profilo', label: 'Profilo', glyph: 'person', pages: [['profilo', 'Profilo']] }, { id: 'impostazioni', label: 'Impostazioni', glyph: 'settings', pages: [['impostazioni', 'Impostazioni']] }]);
const SHEET_GROUPS = Object.freeze([...SECTIONS, ...SHEET_BOTTOM]);
const sheetItems = (group, state) => group.locals !== undefined || SECTIONS.includes(group) ? sectionEntries(group, state) : group.pages.map(([page, label]) => ({ page, label }));
// What the tutorial's examples quote from the game being played (nothing is saved or changed by showing them).
const tutorialFacts = state => {
  const funds = state.game?.finance?.funds ?? state.game?.finance?.balance;
  const party = (state.dataset?.parties ?? []).find(item => item.id === (state.career?.partyId ?? state.game?.partyId));
  const next = (state.game?.electionCalendar ?? state.game?.calendar ?? []).find?.(item => item?.date >= state.clock?.currentDate);
  return tutorialContext(state, { role: state.game?.party?.rankTitle ?? '', party: party?.name ?? '', funds: Number.isFinite(funds) ? `${Math.round(funds).toLocaleString('it-IT')} €` : '—', nextElection: next?.label ? `${next.label} (${next.date})` : '' });
};
const mobileSheet = (state, lastSaved, territory) => {
  const page = state.ui.activePage;
  const groups = SHEET_GROUPS.map(group => ({ group, items: sheetItems(group, state) }));
  const current = groups.find(({ items }) => items.some(item => entryOn(item, items, page, territory)))?.group.id ?? null;
  const itemHtml = (entry, items) => `<button type="button" class="sheet-item ${entryOn(entry, items, page, territory) ? 'active' : ''}" data-sheet-label="${entry.label}" ${entryAttrs(entry)}>${entry.label}</button>`;
  const body = groups.map(({ group, items }) => items.length > 1
    ? `<details class="sheet-group" data-sec="${group.id}" data-sheet-group="${group.id}" data-remember="sheet-${group.id}"${group.id === current ? ' open' : ''}><summary><span class="sheet-group-icon">${icon(group.glyph, 18)}</span><span class="sheet-group-text"><strong>${group.label}</strong><small>${items.map(item => item.label).join(' · ')}</small></span><span class="sheet-group-count">${items.length}</span></summary><div class="mobile-sheet-grid">${items.map(entry => itemHtml(entry, items)).join('')}</div></details>`
    : `<div class="sheet-group is-direct" data-sec="${group.id}" data-sheet-group="${group.id}"><button type="button" class="sheet-item sheet-direct ${entryOn(items[0], items, page, territory) ? 'active' : ''}" data-sheet-label="${group.label}" ${entryAttrs(items[0])}><span class="sheet-group-icon">${icon(group.glyph, 18)}</span><strong>${group.label}</strong></button></div>`).join('');
  return `<div class="mobile-sheet" id="mobile-sheet" data-mobile-sheet hidden><div class="mobile-sheet-panel" role="dialog" aria-modal="true" aria-label="Altro: tutte le sezioni"><div class="mobile-sheet-head"><strong>Altro</strong><button type="button" class="icon-button" data-mobile-close aria-label="Chiudi">×</button></div><label class="sheet-search"><span class="visually-hidden">Cerca una pagina</span><input type="search" data-sheet-search placeholder="Cerca una pagina…" autocomplete="off" enterkeyhint="search" /></label><p class="sheet-empty" data-sheet-empty hidden>Nessuna pagina corrisponde.</p>${body}<div class="mobile-sheet-status"><span class="save-dot"></span>${lastSaved}</div></div></div>`;
};
const entryActive = (entry, page, territory = {}) => page === entry.page && (!entry.kind || (territory.localInst ? territory.localInst === entry.inst || territory.localInst === entry.kind : false));
// An entry is current when it is its page, or, in Territori, the institution that is open ("Il Paese" is current while none is chosen).
const entryOn = (entry, entries, page, territory = {}) => entry.kind ? entryActive(entry, page, territory) : entry.page === page && !entries.some(other => other.kind && entryActive(other, page, territory));
const entryAttrs = entry => `data-nav="${entry.page}"${entry.scroll ? ` data-scroll="${entry.scroll}"` : ''}`;
// Addresses that point to a destination or to an institution rather than to a page.
const PAGE_ALIASES = Object.freeze({ istituzioni: 'parlamento', informazione: 'notizie', comune: 'territori', provincia: 'territori', regione: 'territori' });
const pages = {
  panoramica: { title: 'Home', eyebrow: 'LA TUA PARTITA', intro: 'Una carriera nella politica italiana' },
  profilo: { title: 'Profilo', eyebrow: 'IL TUO POLITICO', intro: 'La persona e i numeri della tua carriera.' },
  carriera: { title: 'Carriera', eyebrow: 'IL TUO PERCORSO', intro: 'Costruisci la tua presenza, un incarico alla volta.' },
  partito: { title: 'Il tuo partito', eyebrow: 'APPARTENENZA', intro: 'Relazioni, linea politica e peso nel partito.' },
  calendario: { title: 'Agenda', eyebrow: 'IL TUO TEMPO', intro: 'Appuntamenti e momenti da tenere d’occhio.' },
  elezioni: { title: 'Elezioni', eyebrow: 'CENTRALE ELETTORALE', intro: 'Calendario, candidatura, campagna, avversari e risultati: la competizione elettorale in un solo posto.' },
  sondaggi: { title: 'Sondaggi', eyebrow: 'OPINIONE PUBBLICA', intro: 'Quadro elettorale, istituti, territori, partiti e opinione pubblica della simulazione.' },
  territori: { title: 'Territori e cittadini', eyebrow: 'IL PAESE E GLI ENTI LOCALI', intro: 'Regioni, servizi, economia e umore dei cittadini, settimana dopo settimana.' },
  finanze: { title: 'Finanze', eyebrow: 'BILANCI E RISORSE', intro: 'Entrate, spese, budget e tesoreria del partito.' },
  parlamento: { title: 'Parlamento', eyebrow: 'ISTITUZIONI · LE CAMERE', intro: 'Seggi, gruppi e lavori parlamentari.' },
  governo: { title: 'Governo', eyebrow: 'PALAZZO CHIGI', intro: 'Composizione, agenda e approvazione dell’esecutivo.' },
  quirinale: { title: 'Quirinale', eyebrow: 'ISTITUZIONI · PRESIDENTE DELLA REPUBBLICA', intro: 'Il Colle: chi lo occupa, quanto credito ha, che cosa può fare e come si elegge il successore.' },
  leggi: { title: 'Leggi', eyebrow: 'ITER LEGISLATIVO', intro: 'Proposte, commissioni e provvedimenti.' },
  eventi: { title: 'Eventi', eyebrow: 'CRONACA POLITICA', intro: 'Gli eventi che scandiscono la vita pubblica.' },
  ricompense: { title: 'Ricompense', eyebrow: 'IL TUO TEMPO DI GIOCO', intro: 'La ricompensa giornaliera, il tempo di gioco e i video premiati.' },
  notizie: { title: 'Notizie', eyebrow: 'REDAZIONE · SIMULATA', intro: 'Cronaca politica, articoli, storie e testate, con il tuo diario.' },
  politici: { title: 'Politici', eyebrow: 'PERSONE', intro: 'Profili e incarichi nel panorama politico.' },
  'partiti-lista': { title: 'Partiti', eyebrow: 'ORGANIZZAZIONI', intro: 'Partiti e movimenti reali del registro.' },
  archivio: { title: 'Archivio', eyebrow: 'DATI REALI VERIFICATI', intro: 'Partiti, parlamentari, gruppi, governo, leggi e territori reali, consultabili senza uscire dal gioco.' },
  impostazioni: { title: 'Impostazioni', eyebrow: 'PREFERENZE', intro: 'Audio, interfaccia, salvataggi, loghi e dati di gioco.' },
  amministrazione: { title: 'Amministrazione', eyebrow: 'RISERVATO AL PROPRIETARIO', intro: 'Correzioni ai dati di partiti e politici.' }
};
const icon = (name, size = 20) => {
  const paths = { map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', wallet: '<path d="M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1z"/><path d="m4 7 11-4 1 4M16 13h4"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', chevron: '<path d="m9 18 6-6-6-6"/>', save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/>', party: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>', ballot: '<path d="M5 4h14v17H5zM8 8l1.5 1.5L12 7M8 14l1.5 1.5L12 13M14 9h2M14 15h2"/>', building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/>', chart: '<path d="M4 19V5M4 19h17M8 15l4-4 3 2 5-6"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M10.27 4.80L10.72 2.49L13.28 2.49L13.73 4.80A7.4 7.4 0 0 1 15.87 5.69L17.82 4.37L19.63 6.18L18.31 8.13A7.4 7.4 0 0 1 19.20 10.27L21.51 10.72L21.51 13.28L19.20 13.73A7.4 7.4 0 0 1 18.31 15.87L19.63 17.82L17.82 19.63L15.87 18.31A7.4 7.4 0 0 1 13.73 19.20L13.28 21.51L10.72 21.51L10.27 19.20A7.4 7.4 0 0 1 8.13 18.31L6.18 19.63L4.37 17.82L5.69 15.87A7.4 7.4 0 0 1 4.80 13.73L2.49 13.28L2.49 10.72L4.80 10.27A7.4 7.4 0 0 1 5.69 8.13L4.37 6.18L6.18 4.37L8.13 5.69A7.4 7.4 0 0 1 10.27 4.80 Z"/>', close: '<path d="m18 6-12 12M6 6l12 12"/>', spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>', archive: '<path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', news: '<path d="M5 4h11v16H6a1 1 0 0 1-1-1zM16 8h3v11a1 1 0 0 1-1 1h-2M8 8h5M8 12h5M8 16h3"/>' };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sourceLabel = source => source === DATA_SOURCES.REAL ? 'Dato reale' : source === DATA_SOURCES.USER ? 'Creato da te' : 'Simulazione';
const partyName = party => party?.officialName ?? party?.name ?? '';
const partyDescription = party => party?.source === DATA_SOURCES.REAL ? (party.factualDescription || 'Descrizione non disponibile nelle fonti consultate.') : (party?.description || 'Partito di simulazione.');

const pageFromHash = () => {
  const id = decodeURIComponent(globalThis.location?.hash?.replace(/^#\/?/, '') ?? '');
  return pages[id] ? id : PAGE_ALIASES[id] ?? null;
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
const WIZARD_COLLECTIONS = [...WIZARD_TERRITORY, 'parties', 'politicalMovements', 'coalitions', 'parliamentaryGroups', 'groupMemberships', 'chambers', 'partyLeaderships', 'politicalFigures', 'politicians'];

export function mountApp(root, store, { retryData = null, refreshReference = null, bootPhase = () => 'ready', needBackground = null, popupsReady = () => true } = {}) {
  // The data the first screen does not need (institutions, heavy documents) starts when the browser is idle; a career being created or entered asks for it at once.
  const askBackground = () => { try { return Promise.resolve(needBackground?.()).catch(() => null); } catch { return Promise.resolve(); } };
  const dataLoading = () => bootPhase() === 'loading';
  let wizard = null;
  // Loading of the wizard's real data: 'loading', 'ready' or 'error' (with the collections that failed).
  const wizardData = { status: 'idle', failed: [] };
  // The ISTAT list the new career starts from (regions, supra-municipal units, comuni).
  const wizardTerritory = () => realDatabase.municipalities?.length && realDatabase.territorialUnits?.length ? { units: realDatabase.territorialUnits ?? [], municipalities: realDatabase.municipalities, sourceUrl: realDatabase.manifest?.territorialSource?.url ?? null, sourceName: realDatabase.manifest?.territorialSource?.name ?? null } : null;
  // What the wizard shows while the ISTAT list is missing: still loading, or failed (with “Riprova”).
  const wizardTerritoryView = () => wizardTerritory() ?? { status: wizardData.failed.some(item => WIZARD_TERRITORY.includes(item.name)) ? 'error' : 'loading', error: wizardData.failed.find(item => WIZARD_TERRITORY.includes(item.name))?.message ?? '' };
  const wizardDataStatus = () => ({ loading: wizardData.status === 'loading', failed: wizardData.failed.filter(item => !WIZARD_TERRITORY.includes(item.name)).map(item => dataLabel(item.name)) });
  let toastTimer;
  // The logo editor (crop, ratio, zoom, transparency, dominant colour) for the party made in the wizard.
  let logoEditor = null;
  let logoEditorImage = null;
  let logoEditorUrl = null;
  let logoDrag = null;
  // The personal catalog of logos (Menu → Loghi dei partiti): what the player is looking at and the image waiting to be saved.
  const logoCatalog = { query: '', page: 1, selectedId: null, pending: null, error: '', notice: '', busy: '', urlDraft: '', loading: false, legacy: [], persistent: true, guest: [], conflicts: [], sync: null, syncing: false, archive: { plan: null, busy: '', progress: null, error: '', notice: '', replacedCount: 0, outcome: null } };
  const catalog = {
    partyQuery:'', partyPresence:'all', partyType:'all', partyLevel:'all', partyRegion:'all', partyStatus:'all', partyElection:'all', partySort:'name', partyPage:1,
    politicianQuery:'', politicianChamber:'all', politicianParty:'all', politicianGroup:'all', politicianPage:1,
    selectedPoliticianId:null, selectedPartyId:null, profileLoading:false, loadingPage:null, errors:{}, loadTicket:0
  };
  const admin = { tab: 'partiti', query: '', linkQuery: '', chamber: 'all', partyId: null, politicianId: null, message: '', listPage: 1, partyFilter: 'tutti', creating: false, checking: false };
  const territory = { measure: 'satisfaction', region: null, localSeat: null, localQuery: '', localInst: null, localSection: null };
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
  let rewardsApi = null;
  // Player account: the running career is kept online after each save and can be recovered on any device.
  // status: 'none' (no service for this copy of the game), 'checking', 'available' or 'unreachable'. An address alone
  // is not enough: the service is asked (probeAccount) before it is offered as available.
  const account = { user: currentAccount(), saves: [], message: '', error: '', busy: false, lastSync: null, conflict: null, conflicts: [], status: accountApiBase() ? (currentAccount() ? 'available' : 'checking') : 'none', currentSlot: null, history: null, info: null, service: { email: false, emailRequired: false }, reset: null };
  Object.defineProperty(account, 'available', { enumerable: true, get: () => account.status === 'available' });
  const setAccountStatus = status => { account.status = status; account.unreachable = status === 'unreachable'; };
  const probeAccount = async () => {
    if (account.status === 'none') return;
    setAccountStatus('checking');
    const details = {};
    setAccountStatus(await probeAccountService({ details }));
    if (account.status === 'available') { account.service = { email: details.email === true, emailRequired: details.emailRequired === true }; accountApi.flushRevocations().catch(() => {}); }
    // Unreachable at the first opening: the player is not kept on the account screen, the local start is offered.
    render(store.getState(), store.getLastSaved());
  };
  const careerMeta = () => { const meta = store.currentMeta(); return { player: meta.player, role: meta.role, party: meta.party, week: meta.week, gameDate: meta.gameDate, status: meta.status, difficulty: store.getState().career?.difficulty ?? 'normale' }; };
  // The meta of a saved copy that is not the one being played (the queue works on what is saved in this browser, whichever career it is).
  const metaOfSnapshot = snapshot => {
    if (snapshot?.career?.id && snapshot.career.id === store.getState().career?.id) return careerMeta();
    const player = snapshot?.dataset?.politicians?.find?.(item => item.id === snapshot?.career?.playerId);
    return { player: player?.displayName ?? 'Carriera', role: null, party: snapshot?.game?.party?.label ?? null, week: snapshot?.game?.week?.index ?? null, gameDate: snapshot?.clock?.currentDate ?? null, status: snapshot?.game?.status ?? null, difficulty: snapshot?.career?.difficulty ?? 'normale' };
  };
  // The sync of the online saves: a queue written down in the browser (see sync-queue.js), not a timer. A change of its state redraws the account screen.
  const syncEngine = createSyncEngine({
    store: globalThis.localStorage ?? { getItem: () => null, setItem() {}, removeItem() {} }, account: accountApi,
    getSnapshot: careerId => localStorageApi.bestForCareer(careerId),
    metaOf: metaOfSnapshot, nameOf: snapshot => { const meta = metaOfSnapshot(snapshot); return `${meta.player} · ${snapshot.career?.name?.split(' — ')[1] ?? 'carriera'}`; },
    onChange: () => { refreshSyncView(); if (menu.open && menu.view === 'account') render(store.getState(), store.getLastSaved()); }
  });
  // Careers the player chose to keep on this device only (asked once, not again).
  const DECLINED_KEY = 'politicando.sync.declined.v1';
  const declinedList = () => { try { return JSON.parse(globalThis.localStorage?.getItem(DECLINED_KEY) ?? '[]'); } catch { return []; } };
  const isDeclined = careerId => declinedList().includes(`${account.user?.username}|${careerId}`);
  const setDeclined = (careerId, value) => { try { const next = declinedList().filter(item => item !== `${account.user?.username}|${careerId}`); if (value) next.push(`${account.user?.username}|${careerId}`); globalThis.localStorage?.setItem(DECLINED_KEY, JSON.stringify(next)); } catch { /* the choice is asked again */ } };
  const careerIdNow = () => store.hasCareer() ? store.getState().career?.id ?? null : null;
  // A career linked to an account that is not signed in (after a logout, or another account) is not continued as if nothing had happened: the player chooses (sign in, or use it locally).
  // A career linked to an account that is not the one signed in is not an ordinary game of this browser: it is not listed, and no action loads, exports or restores it. One rule for every
  // path (the lists, the buttons and the handlers), keyed by the career's id (a slot is read for it: manual slots and automatic copies alike).
  const careerBlocked = careerId => Boolean(careerId) && Boolean(accountApi.careerGate(careerId, account.user?.username ?? null));
  const assertAvailable = careerId => { if (careerBlocked(careerId)) throw new Error(`Questa partita è collegata all’account «${accountApi.ownerOf(careerId)}»: accedi con quell’account, o usa la partita in corso con «Usa localmente».`); };
  const cancelWizard = () => { wizard = null; wizardData.status = 'idle'; wizardData.failed = []; menu.open = true; menu.view = 'home'; menu.error = ''; };
  const closeMenuPopup = () => { if (menu.view === 'home') return false; menu.view = 'home'; menu.error = ''; account.error = ''; account.message = ''; return true; };
  const gateOf = () => { const id = careerIdNow(); return id ? accountApi.careerGate(id, account.user?.username ?? null) : null; };
  // The states the player sees: saved in the browser, waiting to be synced, synced, conflict, error (and the isolation of a career that is not this account's).
  const syncViewOf = () => {
    const careerId = careerIdNow();
    if (!careerId) return null;
    const saving = store.saveStatus();
    if (saving.ok && saving.pending) return { kind: 'unsaved', label: 'Salvataggio nel database del browser in corso', detail: 'La copia non è ancora confermata: non chiudere la pagina. Poi potrà andare online.' };
    if (!saving.ok || saving.dirty) return { kind: 'unsaved', label: 'Modifiche non salvate in questo browser', detail: saving.error ? `Il salvataggio locale non è riuscito: ${saving.error}` : 'Salva la partita per poterla portare online.' };
    const gate = accountApi.careerGate(careerId, account.user?.username ?? null);
    if (gate) return { kind: 'foreign', label: `Collegata all’account «${gate.owner}»`, detail: 'Resta salvata in questo browser: non viene sincronizzata con nessun altro account.', owner: gate.owner };
    if (!account.user) return { kind: 'local', label: 'Salvata in questo browser', detail: accountApi.ownerOf(careerId) ? 'Usata solo in questo browser: non viene sincronizzata.' : 'Accedi per tenerne una copia online.' };
    const owner = accountApi.ownerOf(careerId);
    if (owner && owner !== account.user.username) return { kind: 'foreign', label: `Collegata all’account «${owner}»`, detail: 'Non viene mai caricata nell’account con cui hai effettuato l’accesso senza una tua scelta.', owner };
    const current = syncEngine.status(careerId);
    const when = current.at ? ` (${fullDate(current.at.slice(0, 10))})` : '';
    if (current.state === 'conflict') return { kind: 'conflict', label: 'Conflitto con la versione online', detail: 'Scegli quale versione tenere: nulla è stato sovrascritto.', op: current.op };
    if (current.state === 'error') return { kind: 'error', label: 'Errore di sincronizzazione', detail: current.op?.error ?? 'Riprova da «Salva ora online».', op: current.op };
    if (current.state === 'session') return { kind: 'error', label: 'Sessione scaduta', detail: 'Accedi di nuovo: la carriera resta salvata in questo browser.', op: current.op };
    if (current.state === 'retry') return { kind: 'pending', label: 'Salvata qui · sincronizzazione in attesa', detail: current.op?.error ?? 'Nuovo tentativo a breve.', op: current.op };
    if (current.state === 'pending' || current.state === 'paused') return { kind: 'pending', label: 'Salvata qui · sincronizzazione in attesa', detail: 'Parte appena possibile.', op: current.op };
    if (current.state === 'synced') return { kind: 'synced', label: `Salvata qui e online${when}`, detail: `Revisione online ${current.revision}.` };
    return { kind: 'unlinked', label: 'Solo su questo dispositivo', detail: isDeclined(careerId) ? 'Hai scelto di tenerla soltanto qui.' : 'Non è collegata al tuo account: portala online quando vuoi.' };
  };
  const refreshSyncView = () => {
    const mine = account.user ? syncEngine.operations().filter(op => op.status === 'conflict') : [];
    account.conflicts = mine.map(op => ({ careerId: op.careerId, slot: op.slot, kind: op.kind, remote: op.remote }));
    account.conflict = account.conflicts.find(item => item.careerId === careerIdNow()) ?? account.conflicts[0] ?? null;
  };
  Object.defineProperty(account, 'sync', { enumerable: true, get: () => syncViewOf() });
  // The error of a link in a message (invalid or expired) is shown by the account screen; the read of the online data that finishes after it must not wipe it before the player has seen it.
  let linkError = '';
  const refreshCloud = async ({ info = false } = {}) => {
    if (!account.user) return;
    try { account.saves = await listCloudSaves(); if (!linkError || account.error !== linkError) account.error = ''; if (info) account.info = await accountApi.accountInfo().catch(() => account.info); }
    catch (error) { if (error.status !== 401) account.error = error.message; account.user = currentAccount(); }
    refreshSyncView();
  };
  // The player asks to put the running career online: an explicit association with this account (never done on its own for a career that is not linked to it). A career linked to
  // another account is not touched: the isolation panel asks what to do.
  const syncCareer = async ({ silent = true, explicit = false } = {}) => {
    if (!account.user || !store.hasCareer()) return false;
    // Only a game that is saved here goes online: changes not saved (manual or end-of-week autosave, a write that failed) stay in this browser.
    const state = store.cloudSnapshot();
    if (!state) {
      const { error } = store.saveStatus();
      if (!silent) account.error = error ? `Il salvataggio in questo browser non è riuscito (${error}): la partita non va online.` : 'Ci sono modifiche non salvate in questo browser: salva la partita prima di portarla online.';
      return false;
    }
    const careerId = state.career.id, owner = accountApi.ownerOf(careerId);
    if (owner && owner !== account.user.username) { if (!silent) account.error = `Questa carriera è collegata all’account «${owner}»: scegli prima se associarla a «${account.user.username}».`; return false; }
    if (explicit) accountApi.stopUsingLocally(careerId);
    else if (accountApi.usedLocally(careerId)) return false;
    account.currentSlot = slotForCareer(careerId);
    if (explicit) setDeclined(careerId, false);
    syncEngine.enqueue(state, { explicit });
    const summary = await syncEngine.flush({ manual: !silent });
    account.error = '';
    refreshSyncView();
    const now = syncEngine.status(careerId);
    if (now.state === 'synced') { account.lastSync = new Date().toISOString(); if (!silent) account.message = 'Carriera salvata online.'; await refreshCloud(); }
    else if (!silent && now.state === 'retry') account.message = 'Non è stato possibile ora: la sincronizzazione riprova da sola.';
    return now.state === 'synced' && summary !== null;
  };
  // After every local save that went through: if this career belongs to the signed-in account (or the player asked for it) its save is written down in the queue.
  const queueAfterSave = () => {
    if (!account.user || !store.hasCareer()) return;
    const state = store.cloudSnapshot();
    if (!state) return;
    const careerId = state.career.id, pendingOp = syncEngine.read().ops[careerId];
    if (accountApi.usedLocally(careerId)) return;
    const mine = accountApi.linkOf(careerId) || (pendingOp && pendingOp.username === account.user.username && pendingOp.explicit);
    if (!mine) return;
    syncEngine.enqueue(state);
    syncEngine.arm(1500);
  };
  const scheduleSync = queueAfterSave;
  // The session ended (expired, ended in another tab, logout): nothing of the account is used until a new sign-in; what is saved in this browser stays.
  accountApi.onAccountEnd(reason => {
    const wasSignedIn = account.user?.username ?? null;
    syncEngine.stop();
    refreshLogoScope();
    account.user = currentAccount(); account.saves = []; account.conflict = null; account.conflicts = []; account.info = null; account.history = null; account.currentSlot = null;
    if (gateOf()) { menu.open = true; if (menu.view !== 'account') menu.view = 'home'; }
    if (reason === 'session-expired') {
      account.error = 'La sessione è scaduta: accedi di nuovo. Le carriere restano salvate e compaiono di nuovo dopo l’accesso con lo stesso account.'; menu.open = true; menu.view = 'account';
      // same as leaving the account: the careers are reserved to it and the one in progress is saved and put away (if it cannot be, it stays, and the lock keeps it from every other account)
      if (wasSignedIn && hideCareers(store.careerIdsOnDevice(), wasSignedIn)) store.detachCareer().catch(error => { account.error = `${account.error} ${error.message}`; }).finally(() => render(store.getState(), store.getLastSaved()));
    }
    render(store.getState(), store.getLastSaved());
  });
  // ESCI: the career in progress is saved and put away (a slot copy the browser has confirmed), every career of this device is reserved to the account that leaves, the session
  // ends and the screens show no career at all. Nothing is deleted: slots, versions, backups and the online copies stay, and come back when that account signs in again.
  // If the career cannot be kept safely, the player stays signed in and is told why.
  const leaveAccount = async () => {
    const username = account.user?.username;
    if (!username) return;
    account.error = ''; account.message = ''; account.busy = 'logout'; render(store.getState(), store.getLastSaved());
    try {
      if (!hideCareers(store.careerIdsOnDevice(), username)) throw new Error('Il browser non ha registrato la protezione delle carriere (spazio esaurito?).');
      await store.detachCareer();
    } catch (error) {
      account.busy = false; account.error = `Non sono uscito, per non perdere la partita: ${error.message}`;
      render(store.getState(), store.getLastSaved()); return;
    }
    // the sign-in screen is set up before the session ends: the end of the session redraws the page (and the player may act on it) while the server is still being told
    newsPopup = null; reportOpen = false; menu.open = true; menu.view = 'account'; account.mode = 'login';
    const outcome = await logout();
    syncEngine.stop();
    account.user = null; account.saves = []; account.conflict = null; account.conflicts = []; account.info = null; account.history = null; account.currentSlot = null; account.busy = false;
    refreshLogoScope();
    account.message = outcome.server === false ? 'Sei uscito. La sessione sul server verrà chiusa appena possibile. Le carriere non compaiono più finché non accedi di nuovo: restano salvate e non vengono toccate.' : 'Sei uscito. Le carriere non compaiono più finché non accedi di nuovo: restano salvate nel browser e online e non vengono toccate.';
    render(store.getState(), store.getLastSaved());
  };
  // Another tab changed the account: a career this account may not see leaves this tab too (saved and put away first); the one it may see comes back.
  const reconcileCareers = async () => {
    try {
      if (store.hasCareer() && careerBlocked(careerIdNow())) await store.detachCareer();
      else if (!store.hasCareer() && account.user) store.resumeLastCareer(id => !careerBlocked(id));
    } catch (error) { account.error = error.message; }
    render(store.getState(), store.getLastSaved());
  };
  // A game downloaded from the account takes the place of the running one: the link to the online version follows only now, from the game that really is running.
  const adoptCloud = (slot, remote, toast) => {
    const loaded = store.loadGame(remote.state, toast);
    commitRevision(slot, remote.revision, loaded);
    setDeclined(loaded.career.id, false);
    return loaded;
  };
  // The player's explicit choice: the copy saved in this browser replaces the online one (the server keeps the one it replaces).
  const replaceOnline = async item => {
    const snapshot = localStorageApi.bestForCareer(item.careerId);
    if (!snapshot) { account.error = 'Non c’è una copia salvata di questa carriera in questo browser.'; return; }
    try {
      const meta = metaOfSnapshot(snapshot);
      await accountApi.restoreSave(item.slot, snapshot, { expectedRevision: item.remote?.revision ?? 0, name: `${meta.player} · ${snapshot.career?.name?.split(' — ')[1] ?? 'carriera'}`, meta });
      syncEngine.resolve(item.careerId); setDeclined(item.careerId, false);
      account.message = 'Versione online sostituita con quella di questo browser. La precedente è tra le versioni precedenti.'; account.error = '';
      await refreshCloud();
    } catch (error) { account.error = error.status === 409 ? 'La versione online è cambiata mentre decidevi: aggiorna e riprova, nulla è stato sostituito.' : error.message; await syncEngine.flush({ manual: true }).catch(() => {}); }
  };
  let reportOpen = false;
  // The weekly pop-up of the newsroom (at most one a week, at most three news; closed with a button or Escape; it is not saved, the save only remembers the week).
  let newsPopup = null;
  // Switching the pop-up on again does not open the week in progress under the player's hands: the next week brings the next one (nothing is written to the save for this).
  let newsPopupHoldWeek = null;
  // An article the pop-up pointed at: opened (and brought into view) once the newsroom is drawn.
  let pendingArticle = null;
  // Confirmation of irreversible or far-reaching actions: a dialog in the game's style (never the browser's confirm).
  let pendingConfirm = null;
  let skipMultiWeekConfirm = false;
  // The plan of the week (operations collected from the pages and done together after the confirmation): only in this window, never saved; the preview is recomputed when the game changes.
  let plan = [];
  let planCache = { key: '', value: null };
  const planPreviewOf = state => {
    if (!plan.length || !store.hasCareer() || !state.game) return null;
    const game = state.game;
    // The preview runs the real operations on a copy of the whole state, so it is valid only while the state has not changed (treasury, committees, staff, objectives, calendar...): the
    // store's revision moves with every change, never with the preview itself.
    const key = `${JSON.stringify(plan)}|${store.revision()}`;
    if (planCache.key === key) return planCache.value;
    let value;
    try { value = store.planPreview(plan); } catch (error) { value = { ok: false, lines: [], error: error.message }; }
    planCache = { key, value };
    return value;
  };
  const markPlanned = () => { const planned = new Set(plan.map(planKey)); for (const button of root.querySelectorAll?.('[data-plan-add]') ?? []) { let on = false; try { on = planned.has(planKey(JSON.parse(button.dataset.planAdd))); } catch { /* not an operation */ } button.classList.toggle('is-planned', on); button.setAttribute('aria-pressed', String(on)); if (!button.dataset.planLabel) button.dataset.planLabel = button.textContent; button.textContent = on ? '✓ Nel piano' : button.dataset.planLabel; } };
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
  const confirmThen = (options, action) => { askConfirm(options).then(async answer => { if (!answer.ok) return; try { await action(answer); } catch (error) { menu.error = error.message; admin.message = error.message; if (store.hasCareer()) store.getState().ui.toast = error.message; } render(store.getState(), store.getLastSaved()); }); };
  // Advancing to a date goes on in pieces of 26 weeks, so the page stays alive; at every piece the store reads the state as it is (and stops before what needs the player unless it is delegated).
  let advancingToDate = false;
  const advanceToDate = async (target, delegate) => {
    if (advancingToDate) return;
    advancingToDate = true;
    try {
      for (let piece = 0; piece < 200; piece++) {
        if (store.advanceToDate(target, { delegate, maxWeeks: 26 }).reason !== 'continua') break;
        await new Promise(resolve => setTimeout(resolve));
      }
      playSound('week');
    } catch (error) { store.getState().ui.toast = error.message; }
    finally { advancingToDate = false; }
    render(store.getState(), store.getLastSaved());
  };
  // First opening: the account comes before the first career; after the registration a short tour, shown once.
  const ONBOARDING_KEY = 'politicando.onboarding.v1';
  const onboarding = () => { try { return JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '{}') ?? {}; } catch { return {}; } };
  const markOnboarding = patch => { try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...onboarding(), ...patch })); } catch { /* the flag is a convenience */ } };
  // “Inizia senza account” is a choice that lasts: after a reload the player is not sent back to the account welcome.
  menu.localStart = onboarding().localStart === true;
  // The preferences are the browser's; the ones marked `scoped` (the weekly news pop-up) belong to the account that is signed in, so that no account changes another's (core/settings.js).
  const settingsScope = () => account.user?.username ? `account:${account.user.username}` : null;
  let settings = loadSettings(settingsScope());
  const applySettings = () => {
    const html = document.documentElement;
    html.dataset.motion = settings.motion;
    html.dataset.contrast = settings.contrast;
    html.dataset.density = settings.density;
    html.style.setProperty('--ui-scale', String(Number(settings.textSize) / 100));
  };
  applySettings();
  // The interface is written in Italian; in English it is translated as it is drawn (core/i18n.js). A change of language redraws the same screen with the same data.
  watchTree(root);
  onLanguageChange(() => { watchTree(root); render(store.getState(), store.getLastSaved()); });
  const download = (text, name) => { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  // The identity of the party the career is in (see party-identity.js). It is the party of the game, not the one still written in the career record: after leaving a party the
  // player is independent until joining or founding another.
  const careerIdentity = state => {
    // (the demo state shown behind the new-game steps is not a career: it has no party identity)
    const gameParty = store.hasCareer() ? state.game?.party ?? null : null;
    const record = gameParty ? (findParty(gameParty.partyId) ?? { id: gameParty.partyId, label: gameParty.label }) : null;
    const force = record ? state.world?.parties?.find(item => item.isPlayer) : null;
    return partyIdentity({ party: record, force, logo: record ? logoFor(record) : null });
  };
  // The same for a saved career known only by its meta (slots, online saves): the party it was saved in.
  const metaIdentity = meta => {
    if (!meta?.party || meta.party === 'Indipendente') return partyIdentity();
    const record = meta.partyId ? findParty(meta.partyId) : null;
    return partyIdentity({ party: record ?? { id: meta.partyId ?? null, label: meta.party }, logo: record ? logoFor(record) : null });
  };
  // The mark of the party a concluded career belonged to: by its id when the entry has one, else by its name among the known parties (an old entry keeps only the name); never an invented logo.
  const hallIdentity = ({ party, partyId }) => {
    const known = (partyId && findParty(partyId)) || null;
    return partyIdentity({ party: known ?? { id: partyId ?? null, label: party }, logo: known ? logoFor(known) : null });
  };
  const menuContext = () => {
    const collections = realDatabase.manifest?.collections ?? {};
    return {
      hallIdentity, loading: dataLoading(), logos: logoCatalogView(),
      hasCareer: store.hasCareer(), meta: store.currentMeta(), identity: store.hasCareer() ? careerIdentity(store.getState()) : null, identityOf: metaIdentity, hall: store.hallOfFame(id => !careerBlocked(id)), slots: store.listSlots().filter(slot => !careerBlocked(slot.careerId)).map(slot => menu.view === 'carica' ? { ...slot, info: store.slotInfo(slot.id) } : slot), versions: menu.view === 'carica' ? store.localVersions().filter(item => !careerBlocked(item.careerId)) : [], protectedCount: store.listSlots().filter(slot => careerBlocked(slot.careerId)).length + (menu.view === 'carica' ? store.localVersions().filter(item => careerBlocked(item.careerId)).length : 0), saving: store.saveStatus(), lastSaved: store.getLastSaved(), unsaved: store.hasUnsavedChanges(), settings, error: menu.error, account, gate: gateOf(),
      stats: [[realDatabase.manifest?.politiciansInOffice ?? collections.politicians ?? 0, 'parlamentari in carica'], [collections.laws ?? 0, 'atti della XIX legislatura'], [collections.twoPerThousand ?? 0, 'partiti reali nel 2×1000'], [collections.parliamentaryGroups ?? 0, 'gruppi parlamentari']]
    };
  };
  const realLaws = { query: '', outcome: 'all', area: 'all', page: 1 };
  // Filters, sorting and selections of the other pages (catalogues, archive, real laws, territories, the owner's area)
  // are kept in this browser like the tabs: they survive redraws, navigation and a reload.
  const VIEW_FIELDS = Object.freeze({
    catalog: ['partyQuery', 'partyPresence', 'partyType', 'partyLevel', 'partyRegion', 'partyStatus', 'partyElection', 'partySort', 'partyPage', 'politicianQuery', 'politicianChamber', 'politicianParty', 'politicianGroup', 'politicianPage'],
    admin: ['tab', 'chamber', 'partyFilter'], territory: ['measure', 'region', 'localSeat', 'localQuery', 'localInst', 'localSection'], archive: ['tab'], realLaws: ['query', 'outcome', 'area', 'page']
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
  // The political forces of the game: registered parties and movements, and the coalitions that stand as one list (AVS), which are not parties but can be joined, campaign, poll and win.
  const realParties = () => politicalForces(realDatabase);
  const findParty = id => [...store.getState().dataset.parties, ...realParties()].find(item => item.id === id) ?? null;
  // The one resolver of a party's logo: the personal catalog of the account in use, by the party's stable identifier. A party the player made keeps its own original drawn mark when there is
  // none; no logo is ever matched by name, and no third-party logo comes with the game.
  const logoFor = party => (party?.id ? resolveLogo(party.id) : null) ?? (party?.source === DATA_SOURCES.USER && party.logo ? userPartyLogo(party) : null);
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
  const adminPartyRecords = () => [...(realDatabase.parties ?? []).map(party => ({ ...party, collection: 'parties' })), ...(realDatabase.politicalMovements ?? []).map(party => ({ ...party, collection: 'politicalMovements' })), ...(realDatabase.coalitions ?? []).filter(isCoalitionList).map(party => ({ ...party, collection: 'coalitions' }))].sort((a, b) => a.officialName.localeCompare(b.officialName, 'it'));
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
    refreshAdminOverrides(); refreshReference?.(); admin.message = message; render(store.getState(), store.getLastSaved());
    // Connected to the shared archive: the change is published for every player, and the page says "published" only when the server has confirmed it.
    if (isAdminVerified()) {
      admin.message = `${message} Salvato in questo browser; pubblicazione in corso…`; render(store.getState(), store.getLastSaved());
      publishSharedArchive().then(result => { admin.message = `${message} Pubblicato per tutti i giocatori (confermato dal server).${result.copyStored === false ? ' Questo browser non ha spazio per tenerne una copia: al prossimo avvio si rilegge dal server.' : ''}`; render(store.getState(), store.getLastSaved()); }).catch(error => { admin.message = `${message} NON pubblicato per i giocatori: ${error.message}`; render(store.getState(), store.getLastSaved()); });
    } else { admin.message = `${message} Salvato solo in questo browser: non è pubblicato per i giocatori finché non si collega l’archivio condiviso.`; render(store.getState(), store.getLastSaved()); }
  };
  const adminSelected = () => admin.tab === 'politici'
    ? { collection: 'politicians', id: admin.politicianId }
    : { collection: realDatabase.politicalMovements?.some(item => item.id === admin.partyId) ? 'politicalMovements' : realDatabase.coalitions?.some(item => item.id === admin.partyId) ? 'coalitions' : 'parties', id: admin.partyId };
  // Collapsible categories (weekly activities, campaign actions) reopen as the player left them.
  // A <details> without a key of its own gets one from where it sits (the page, the tab, the nearest card and its summary): every panel keeps open or closed what the player left,
  // across the redraws of a week, of a save and of a reload, instead of going back to its default each time the page is drawn again.
  const keyDetails = () => {
    const seen = new Map();
    for (const element of root.querySelectorAll?.('details:not([data-remember])') ?? []) {
      if (element.closest('[data-mobile-sheet], dialog, [data-wizard-backdrop]')) continue;
      const card = element.closest('[data-committee-id], [data-cadre], [data-remember], article[id], section[id]');
      const owner = card?.dataset?.committeeId ?? card?.dataset?.cadre ?? card?.id ?? card?.dataset?.remember ?? element.closest('.cm-card')?.querySelector?.('[data-committee-id]')?.dataset?.committeeId ?? '';
      const base = `auto|${root.querySelector('.page-wrap')?.dataset?.page ?? location.hash ?? ''}|${owner}|${(element.querySelector(':scope > summary')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)}`;
      const nth = seen.get(base) ?? 0;
      seen.set(base, nth + 1);
      element.dataset.remember = `${base}|${nth}`;
    }
  };
  // A block with `data-fold-default="desktop"` is open on a computer and folded on a phone until the player decides (what the player decides is remembered); the automatic change is not taken for a choice.
  const restoreDetails = () => {
    keyDetails();
    const phone = typeof matchMedia === 'function' && matchMedia('(max-width: 600px)').matches;
    for (const element of root.querySelectorAll?.('details[data-remember]') ?? []) {
      const saved = views.open?.[element.dataset.remember];
      // A responsive accordion (data-fold-responsive) is always open on a computer, whatever was remembered on a phone; on a phone it follows the player's choice, else its starting state.
      const wanted = element.hasAttribute('data-fold-responsive') ? (phone ? (typeof saved === 'boolean' ? saved : element.dataset.foldStart === 'open') : true)
        : typeof saved === 'boolean' ? saved : element.dataset.foldDefault === 'desktop' ? !phone : null;
      if (typeof wanted === 'boolean' && element.open !== wanted) { if (typeof saved !== 'boolean' || element.hasAttribute('data-fold-responsive')) element.dataset.autoToggle = '1'; element.open = wanted; }
      element.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(element.open));
    }
  };
  // The choices in the campaign's selects (setup, theme, territory, rival, strategy) are saved with the game
  // (state.ui.campaignPicks): every redraw, reload or saved game draws them as the player left them, until another
  // campaign starts; the theme picked in the setup goes with the player into it.
  const campaignKey = state => state.campaign && state.campaign.status !== 'finished' ? state.campaign.id : 'setup';
  const campaignChoices = state => { const saved = state.ui?.campaignPicks; return saved?.key === campaignKey(state) && saved.values && typeof saved.values === 'object' ? saved.values : {}; };
  const CAMPAIGN_PICKS = [['[data-campaign-topic]', 'topic'], ['[data-campaign-territory]', 'territory'], ['[data-campaign-ally]', 'ally'], ['[data-campaign-strategy-topic]', 'strategyTopic'], ['[data-campaign-strategy-target]', 'strategyTarget'], ['input[name="campaign-strategy-live"]', 'strategy'], ['input[name="campaign-strategy"]', 'setup.strategy']];
  // Real data that could not be loaded at the start: the game runs with the rest and says what is missing.
  let retryingData = false;
  // A save that did not go through (or is not confirmed yet) is never hidden: the page says so on every screen, with the way to keep the career in a file.
  const saveAlert = () => {
    const status = store.saveStatus();
    if (!store.hasCareer() || (status.ok && !status.pending)) return '';
    const text = status.ok ? 'Il browser sta ancora scrivendo la carriera nel suo database: non chiudere la pagina finché non compare «Salvato».' : `Salvataggio non riuscito: ${esc(status.error)}`;
    return `<div class="save-alert ${status.ok ? 'is-pending' : 'is-failed'}" role="alert" data-save-alert="${status.ok ? 'pending' : 'failed'}"><span>${text}</span><button type="button" class="secondary-button" data-action="export-save">Esporta la carriera su file</button></div>`;
  };
  const dataNotice = () => {
    const missing = realDataFailures();
    if (!missing.length) return '';
    return `<div class="data-alert" role="alert">${glyph('alert', 16)}<span>Alcuni dati reali non sono disponibili: <strong>${esc(missing.map(item => dataLabel(item.name)).join(', '))}</strong>. Il gioco funziona con il resto; le parti che ne dipendono restano vuote.</span>${retryData ? `<button type="button" class="secondary-button" data-action="retry-data" ${retryingData ? 'disabled' : ''}>${retryingData ? 'Nuovo tentativo…' : 'Riprova'}</button>` : ''}</div>`;
  };
  // A block of another page that a link pointed to (data-nav + data-scroll): reached once that page is drawn.
  let pendingScroll = null;
  const scrollPending = () => {
    const target = pendingScroll ? globalThis.document?.getElementById?.(pendingScroll) : null;
    if (!target) return;
    pendingScroll = null;
    const wrapper = target.closest?.('details.hqc-fold-band');
    if (wrapper && !wrapper.open) wrapper.open = true;
    target.scrollIntoView?.({ block: 'start' });
  };
  // The mark of a real win (an election won, a congress won): shown once, discreetly, at the bottom of the page. The motion plays only the first time that mark is drawn (a redraw shows it still),
  // never with reduced motion, and the mark leaves the game for good when it ends (a few seconds, or the player closes it): a reload or a saved game does not bring it back.
  // The official result of a vote or of a congress: a card at the centre, closed by the player (button or Escape), never twice. It does not block the page: no backdrop takes the clicks.
  let outcomeDrawn = null, outcomeDrawnAt = 0;
  const outcomeCard = state => {
    const pending = pendingOutcome(state.game);
    if (!pending) { outcomeDrawn = null; return ''; }
    // «new» lasts the few seconds of the effect, not just the first render: a redraw of the page in those seconds (data arriving, the clock) must not take the confetti away.
    if (outcomeDrawn !== pending.id) { outcomeDrawn = pending.id; outcomeDrawnAt = Date.now(); }
    const fresh = Date.now() - outcomeDrawnAt < 6000;
    const mark = { win: 'trophy', partial: 'scales', loss: 'alert' }[pending.tone] ?? 'scales';
    const label = { win: 'Vittoria', partial: 'Risultato parziale', loss: 'Sconfitta' }[pending.tone] ?? 'Esito';
    // The result line (percentage of the votes) is the big number of the card; every other line stays as it is, with the mandate won or missed and the real consequences.
    const lines = pending.lines ?? [];
    const statIndex = lines.findIndex(line => /^Risultato:/i.test(line));
    const stat = statIndex >= 0 ? lines[statIndex].replace(/^Risultato:\s*/i, '') : '';
    const rest = lines.filter((_, index) => index !== statIndex);
    // Confetti only for a victory, once (no endless effect), a fixed set so that a redraw does not change it; with reduced motion the style hides it.
    const confetti = pending.tone === 'win' && fresh ? `<div class="outcome-confetti" aria-hidden="true">${Array.from({ length: 44 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${((i * 53) % 90) / 100}s;--t:${2.6 + ((i * 29) % 14) / 10}s;--r:${(i * 47) % 360}deg;--c:${i % 5}"></i>`).join('')}</div>` : '';
    return `<div class="outcome-overlay is-${esc(pending.tone)} ${fresh ? 'is-new' : ''}" data-outcome-overlay>${confetti}<aside class="outcome-popup is-${esc(pending.tone)} ${fresh ? 'is-new' : ''}" role="dialog" aria-modal="true" aria-labelledby="outcome-title" aria-describedby="outcome-lines" data-outcome="${esc(pending.id)}" data-outcome-kind="${esc(pending.kind)}" data-outcome-tone="${esc(pending.tone)}"><div class="outcome-medal" aria-hidden="true"><span class="outcome-mark">${glyph(mark, 38)}</span></div><small class="outcome-kicker">${esc(label)} · ${esc(pending.title)}</small><h2 class="outcome-headline" id="outcome-title">${esc(pending.headline)}</h2>${stat ? `<div class="outcome-stat"><b>${esc(stat)}</b><small>risultato</small></div>` : ''}<ul id="outcome-lines">${rest.map(line => `<li>${esc(line)}</li>`).join('')}</ul><div class="outcome-actions"><button type="button" class="primary-button" data-outcome-dismiss="${esc(pending.id)}">Chiudi</button></div></aside></div>`;
  };
  // The popup of the rewards: one notice at a time, the next after the player dismisses it; it waits while a wizard, the main menu, a confirmation or an outcome card is on screen.
  let shownNotices = '';
  const rewardNoticeOverlay = state => {
    const list = rewardsApi?.notices?.() ?? [];
    shownNotices = list.map(item => item.id).join('|');
    if (!list.length || !state.game || wizard || menu.open || pendingConfirm || pendingCelebration(state.game) || newsPopup || reportOpen) return '';
    return renderRewardNotice(list[0], list.length);
  };
  let celebrationDrawn = null;
  let celebrationTimer = null;
  const celebrationBanner = state => {
    const pending = pendingCelebration(state.game);
    if (!pending) { celebrationDrawn = null; return ''; }
    if (pendingOutcome(state.game)?.celebrationId === pending.id) return '';
    const fresh = celebrationDrawn !== pending.id;
    celebrationDrawn = pending.id;
    if (fresh) { clearTimeout(celebrationTimer); celebrationTimer = setTimeout(() => store.dismissCelebration(pending.id), 9000); }
    return `<aside class="celebration ${fresh ? 'is-new' : ''}" role="status" aria-live="polite" data-celebration="${esc(pending.id)}"><span class="celebration-mark" aria-hidden="true">${icon('spark', 18)}</span><div><strong>${esc(pending.title)}</strong>${pending.body ? `<small>${esc(pending.body)}</small>` : ''}</div><button type="button" class="celebration-close" data-celebration-dismiss="${esc(pending.id)}" aria-label="Chiudi">×</button></aside>`;
  };
  // Crossing the phone breakpoint (rotation, window) re-applies the open/closed state of the responsive blocks.
  if (typeof matchMedia === 'function') { try { matchMedia('(max-width: 600px)').addEventListener('change', () => restoreDetails()); } catch { /* old browsers: the next redraw does it */ } }
  const render = (state, lastSaved) => { settings = loadSettings(settingsScope()); setForceColorOverrides(new Map((state.world?.parties ?? []).filter(item => item.brandColor && /^#[\da-f]{6}$/i.test(item.color ?? '')).map(item => [item.id, item.color]))); renderFrame(state, lastSaved); paintLogoEditor(); restoreDetails(); markPlanned(); persistViewState(); scrollPending(); settleRadioVoice(); openPendingArticle(); };
  // The radio reads only while its page is on screen: leaving it (or drawing a page without the bulletin) stops the voice; the buttons and the highlighted sentence follow the reading.
  // (armed for a moment, not consumed by the first redraw: the page change draws the newsroom more than once)
  const openPendingArticle = () => {
    if (!pendingArticle) return;
    if (Date.now() > pendingArticle.until) { pendingArticle = null; return; }
    const card = [...(root.querySelectorAll?.('[data-article]') ?? [])].find(item => item.dataset.article === pendingArticle.id);
    if (!card) return;
    card.querySelector('details')?.setAttribute('open', '');
    if (!pendingArticle.shown) { pendingArticle.shown = true; card.scrollIntoView?.({ block: 'center' }); }
  };
  const settleRadioVoice = () => { const what = voiceTarget(); if (what && ![...(root.querySelectorAll?.('[data-voice-target]') ?? [])].some(button => button.dataset.voiceTarget === what)) stopVoice(); syncVoiceDom(root); };
  onVoiceChange(() => { syncVoiceDom(root); if (voiceStatus() === 'error') render(store.getState(), store.getLastSaved()); });
  // The list of voices of some browsers arrives after the page: the reading control appears once there is an Italian voice.
  onVoicesChange(() => { if (voiceStatus() === 'idle') render(store.getState(), store.getLastSaved()); });
  const renderFrame = (state, lastSaved) => {
    hideChartTip();
    if (menu.open && !wizard) {
      root.innerHTML = `<div class="app-shell menu-shell">${saveAlert()}${dataNotice()}${renderMainMenu(menu, menuContext())}${renderConfirmDialog(pendingConfirm)}${state.ui.toast && settings.toasts === 'on' ? `<div class="toast" role="status">${icon('spark', 17)}${esc(state.ui.toast)}</div>` : ''}</div>`;
      if (pendingConfirm) root.querySelector?.('[data-confirm="cancel"]')?.focus?.();
    else root.querySelector?.('[data-reward-notice-dismiss]')?.focus?.({ preventScroll: true });
      // First-run steps: on a phone the panel sits below the menu list, so it is brought into view.
      // The steps and views open as a dialog over the homepage: nothing to scroll to; the dialog takes the focus.
      if (menu.reveal) menu.reveal = false;
      root.querySelector?.('.menu-popup-body')?.focus?.({ preventScroll: true });
      return;
    }
    // The creator of a new career is a screen of its own: the career in progress (menu, topbar, pages) is not drawn behind it, so it can never be taken for the career being opened.
    if (wizard) {
      root.innerHTML = `<div class="app-shell menu-shell wizard-only"><div class="wizard-under" inert aria-hidden="true">${renderMainMenu({ ...menu, view: 'home' }, menuContext())}</div>${renderCareerWizard(state, wizard, realParties(), logoFor, realDatabase.parliamentaryGroups ?? [], realDatabase.partyLeaderships ?? [], realDatabase.politicalFigures ?? [], realDatabase.politicians ?? [], wizardTerritoryView(), wizardDataStatus(), store.pollScenarioView(pollScenarioOf(wizard)))}${renderConfirmDialog(pendingConfirm)}${state.ui.toast && settings.toasts === 'on' ? `<div class="toast" role="status">${icon('spark', 17)}${esc(state.ui.toast)}</div>` : ''}</div>`;
      if (pendingConfirm) root.querySelector?.('[data-confirm="cancel"]')?.focus?.();
      return;
    }
    // The weekly pop-up of the newsroom: the week is looked at once (the save remembers it), never while something else asks for the player's attention and never if the player turned it off.
    if (!newsPopup && !wizard && !reportOpen && !pendingConfirm && state.game && popupsReady()) {
      const items = store.weeklyNewsPopup({ enabled: settings.newsPopup === 'on' && newsPopupHoldWeek !== state.game.week.index });
      if (items.length) newsPopup = { items: items.map(popupItem) };
    }
    const player = state.dataset.politicians.find(p => p.id === state.career.playerId);
    const partyId = player ? player.partyId : state.career.partyId;
    const party = findParty(partyId);
    const current = pages[state.ui.activePage] ?? pages.panoramica;
    const eventList = [...state.dataset.events].filter(e => e.date >= state.clock.currentDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    const playerForce = state.world?.parties?.find(item => item.isPlayer);
    // The party's identity (colour, mark, logo, name) is computed once, in party-identity.js, and every screen of the career reads it: the colour of the party the player is in leads
    // the interface; an independent has a neutral one. It follows the party the player belongs to now, so changing party or founding one changes it everywhere.
    const identity = careerIdentity(state);
    root.innerHTML = `
      <div class="app-shell${wizard ? ' wizard-open' : ''}" data-identity="${identity.kind}" data-identity-source="${identity.source}" style="${identityVars(identity)}">
        <aside class="sidebar">
          <a class="brand" href="#panoramica" aria-label="Politicando 2026, Home"><img class="brand-logo side-logo" src="icons/logo-politicando-640.webp" srcset="icons/logo-politicando-240.webp 240w, icons/logo-politicando-640.webp 640w" sizes="112px" width="112" height="112" alt="POLITICANDO 2026" decoding="async" /></a><div class="brand-subtitle">Una carriera nella<br/>politica italiana</div>${store.hasCareer() && state.game ? partyChip(identity, state.game.party?.rankTitle) : ''}
          <nav class="main-nav" aria-label="Navigazione principale">${SECTIONS.map(section => { const open = mainSectionActive(section.id, state.ui.activePage); const entries = sectionEntries(section, state); return `<div class="nav-section ${open ? 'is-open' : ''}"><button class="nav-item ${open ? 'active' : ''}" data-nav="${sectionTarget(section)}" aria-label="${section.label}" title="${section.label}" aria-current="${open ? 'page' : 'false'}"${entries.length > 1 ? ` aria-expanded="${open}"` : ''}>${icon(section.glyph, 19)}<span>${section.label}</span>${entries.length > 1 ? `<i class="nav-caret" aria-hidden="true">${icon('chevron', 14)}</i>` : ''}</button>${open && entries.length > 1 ? `<div class="nav-sub" role="group" aria-label="${section.label}">${entries.map(entry => `<button type="button" class="nav-sub-item ${entryOn(entry, entries, state.ui.activePage, territory) ? 'active' : ''}" ${entryAttrs(entry)}>${entry.label}</button>`).join('')}</div>` : ''}</div>`; }).join('')}</nav>
          <div class="sidebar-bottom"><button class="nav-item sidebar-account ${state.ui.activePage === 'profilo' || state.ui.activePage === 'politici' ? 'active' : ''}" data-nav="profilo" aria-label="Profilo" title="Profilo">${icon('person', 19)}<span>Profilo</span></button><button class="nav-item sidebar-account ${state.ui.activePage === 'impostazioni' ? 'active' : ''}" data-nav="impostazioni" aria-label="Impostazioni" title="Impostazioni">${icon('settings', 19)}<span>Impostazioni</span></button><div class="save-status"><span class="save-dot"></span><span>${lastSaved}</span></div></div>
        </aside>
        <nav class="mobile-tabbar" aria-label="Navigazione rapida">${MOBILE_BAR.map(id => { const section = SECTIONS.find(item => item.id === id); const on = mainSectionActive(id, state.ui.activePage); return `<button type="button" class="mobile-tab ${on ? 'active' : ''}" data-nav="${sectionTarget(section)}" aria-current="${on ? 'page' : 'false'}">${icon(section.glyph, 21)}<span>${section.short ?? section.label}</span></button>`; }).join('')}<button type="button" class="mobile-tab ${MOBILE_BAR.some(id => mainSectionActive(id, state.ui.activePage)) ? '' : 'active'}" data-mobile-more aria-expanded="false" aria-controls="mobile-sheet">${icon('menu', 21)}<span>Altro</span></button></nav>
        ${mobileSheet(state, lastSaved, territory)}
        ${store.hasCareer() && state.game && !wizard && !menu.open ? renderTutorialCard(state, state.ui.activePage, tutorialFacts(state)) : ''}
        <main class="main-area">
          <header class="topbar"><div class="topbar-title"><span class="topbar-brands"><img class="topbar-brand" src="icons/logo-politicando-240.webp" srcset="icons/logo-politicando-240.webp 240w, icons/logo-politicando-640.webp 640w" sizes="96px" width="96" height="96" alt="POLITICANDO 2026" decoding="async" />${store.hasCareer() && state.game ? topbarParty(identity) : ''}</span><strong>${current.title}</strong><span>${current.intro}</span></div><div class="top-actions"><div class="top-tools"><button class="icon-button menu-button" data-action="menu" aria-label="Torna alla schermata iniziale (menu principale)" title="Schermata iniziale: Nuova partita, Continua, Carica partita">${icon('home', 17)}</button><button class="icon-button" aria-label="Salva carriera" title="Salva carriera" data-action="save">${icon('save', 17)}</button></div><div class="top-time"><div class="date-chip">${icon('calendar', 16)}<span>${fullDate(state.clock.currentDate)}</span></div><span class="week-chip">Settimana ${state.game.week.index} · ${state.game.week.ap}/${state.game.week.maxAp} giorni</span><button class="advance-button" data-action="advance" ${state.game.status === 'ended' ? 'disabled' : ''}>${state.campaign?.status === 'active' ? 'Avanza campagna' : 'Chiudi settimana'} ${icon('arrow', 17)}</button></div></div></header>
          ${wizard ? '' : saveAlert()}${wizard ? '' : dataNotice()}<div class="page-wrap">${wizard ? '' : (state.ui.activePage === 'panoramica' ? renderHeadquarters(state, { identity, partyName: identity.kind === 'partito' ? identity.name : null, partyLogo: identity.logo, newsFilter: views.newsFilter, newsCategory: views.newsCategory, newsOutlet: views.newsOutlet, expanded: views.homeExpand ?? {} }) : subpage(state, current, player, party, eventList, catalog, { logoFor, homePlace: () => store.homePlace(), nationalOverview: () => store.nationalOverview(), presidencyView: () => store.presidencyView(), electoralGeography: () => store.electoralGeography?.() ?? null, campaignPicks: campaignChoices(state), parties:realParties(), selectable:selectableParties(), findParty, realLeader, admin, adminContext, territory, realLaws, archive, views, tabFor, settings, lastSaved, account, rewards: () => rewardsApi?.snapshot() ?? null, allianceOdds: id => { try { return store.allianceOdds(id); } catch { return null; } }, inviteOdds: id => { try { return store.inviteOdds(id); } catch { return null; } }, inviteBlock: id => { try { return store.inviteBlock(id); } catch { return null; } }, allianceBlock: id => { try { return store.allianceBlock(id); } catch { return null; } }, allianceWindow: () => store.allianceWindow(), raceOptions: id => { try { return store.raceCandidates(id, racePeople()); } catch { return null; } } }))}</div>
        </main>
        ${wizard ? renderCareerWizard(state, wizard, realParties(), logoFor, realDatabase.parliamentaryGroups ?? [], realDatabase.partyLeaderships ?? [], realDatabase.politicalFigures ?? [], realDatabase.politicians ?? [], wizardTerritoryView(), wizardDataStatus(), store.pollScenarioView(pollScenarioOf(wizard))) : ''}
        ${catalog.selectedPoliticianId ? renderPoliticianProfile(catalog.selectedPoliticianId,{loading:catalog.profileLoading,logoFor}) : ''}
        ${catalog.selectedPartyId ? renderPartyProfile(catalog.selectedPartyId,logoFor) : ''}
        ${reportOpen ? renderWeeklyReport(state) : ''}
        ${newsPopup && !reportOpen ? newsPopupHtml(newsPopup, { optOut: settings.newsPopup === 'off' }) : ''}
        ${wizard || !store.hasCareer() || !state.game ? '' : renderPlanTray(state, plan, planPreviewOf(state))}
        ${renderConfirmDialog(pendingConfirm)}
        ${outcomeCard(state)}
        ${celebrationBanner(state)}
        ${rewardNoticeOverlay(state)}
        ${state.ui.toast && settings.toasts === 'on' ? `<div class="toast" role="status">${icon('spark', 17)}${esc(state.ui.toast)}</div>` : ''}
      </div>`;
    if (pendingConfirm) root.querySelector?.('[data-confirm="cancel"]')?.focus?.();
    // When a notice ends only the notice goes: drawing the page again would rebuild its selects under the player.
    if (state.ui.toast) { clearTimeout(toastTimer); toastTimer = setTimeout(() => { const s = store.getState(); if (s.ui.toast) { s.ui.toast = null; root.querySelector?.('.toast')?.remove?.(); } }, { short: 1600, normal: 2600, long: 4500 }[settings.toastLength] ?? 2600); }
  };
  // (the only place where the scenario meets chance: the engine itself only ever works from the seed it is given)
  const newPollSeed = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  // The previous job is chosen from a list: «Altro» opens a text field; the draft always keeps the text itself.
  const chooseProfession = field => {
    if (!wizard) return;
    syncWizardDraft();
    if (field.value !== 'altro') wizard.previousProfession = field.value; else if (PROFESSIONS.includes(wizard.previousProfession)) wizard.previousProfession = '';
    render(store.getState(), store.getLastSaved());
  };
  const syncWizardDraft = () => {
    if (!wizard) return;
    const fields = [...root.querySelectorAll('.career-wizard [name]')];
    if (fields.some(field => field.name === 'partyProgram')) wizard.partyProgram = fields.filter(field => field.name === 'partyProgram' && field.checked).map(field => field.value);
    for (const field of fields) {
      if (field.name === 'partyProgram' || field.type === 'file') continue;
      if (field.type === 'radio' && !field.checked) continue;
      if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
      else if (field.name.startsWith('poll_')) (wizard.pollCustom ??= {})[field.name.slice(5)] = field.value;
      else wizard[field.name] = field.value;
    }
  };
  // The priorities of the Government (from two to five): the counter follows the ticks; with six or more the page says so, blocks the save and asks which one to remove (it removes nothing by itself).
  const syncProgramForm = form => {
    if (!form) return;
    const boxes = [...form.querySelectorAll('input[name="priorities"]')], chosen = boxes.filter(box => box.checked), n = chosen.length;
    const counter = form.querySelector('[data-priority-counter]'), error = form.querySelector('[data-priority-error]'), submit = form.querySelector('[data-program-submit]');
    const ok = n >= 2 && n <= 5;
    if (counter) { counter.classList.toggle('is-ok', ok); counter.classList.toggle('is-over', n > 5); counter.classList.toggle('is-low', n < 2); const count = counter.querySelector('[data-priority-count]'); if (count) count.textContent = String(n); const note = counter.querySelector('small'); if (note) note.textContent = `da 2 a 5${n < 2 ? ` · ne servono ancora ${2 - n}` : ''}`; }
    if (error) {
      if (n > 5) {
        const label = box => box.closest('label')?.textContent.trim() ?? box.value;
        error.hidden = false;
        error.innerHTML = `<strong>Hai scelto ${n} priorità: il massimo è cinque.</strong><span>Scegli quale rimuovere (ne devi togliere ${n - 5}). Il programma non si salva finché sono più di cinque.</span><span class="priority-pick">${chosen.map(box => `<button type="button" class="secondary-button" data-priority-remove="${esc(box.value)}">Togli «${esc(label(box))}»</button>`).join('')}</span>`;
      } else { error.hidden = true; error.innerHTML = ''; }
    }
    if (submit) { submit.disabled = !ok; submit.title = ok ? '' : n > 5 ? 'Più di cinque priorità: togline qualcuna.' : 'Servono almeno due priorità.'; }
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
  // The checks of a wizard screen, and (screen 5, advanced settings) a written opening poll that does not add up.
  const wizardStepErrors = step => [...validateWizardStep(wizard, step, selectableParties(), realDatabase.parliamentaryGroups ?? [], wizardTerritory(), { requireTerritory: true }), ...(step === 5 ? store.pollScenarioView(pollScenarioOf(wizard)).problems : [])];
  const failStep = () => {
    wizard.errors = wizardStepErrors(wizard.step);
    return wizard.errors.length > 0;
  };
  const collectionsForPage = page => page === 'partiti-lista'
    ? ['parties','politicalMovements','coalitions','electoralLists','territories','electionParticipations','partyMemberships','politicians']
    : page === 'politici' ? ['politicians','parliamentaryGroups',...PARTY_LINK_COLLECTIONS]
    : page === 'leggi' ? ['parliamentaryGroups','groupMemberships','chambers','politicians','laws','government','committees']
    : page === 'territori' ? ['politicians']
    : page === 'parlamento' ? ['parliamentaryGroups','groupMemberships','chambers','politicians','government','offices','committees','committeeMemberships','partyLeaderships','politicalFigures',...PARTY_LINK_COLLECTIONS]
    : page === 'governo' ? ['parliamentaryGroups','groupMemberships','chambers','politicians','government']
    : page === 'quirinale' ? ['politicians','parliamentaryGroups']
    : page === 'archivio' ? ARCHIVE_COLLECTIONS[archive.tab] ?? ARCHIVE_COLLECTIONS.partiti
    : page === 'elezioni' ? ['politicians','parliamentaryGroups','territorialUnits','municipalities',...PARTY_LINK_COLLECTIONS]
    : page === 'sondaggi' ? ['partyLeaderships','politicalFigures',...PARTY_LINK_COLLECTIONS]
    : page === 'partito' ? ['territorialUnits']
    : page === 'amministrazione' ? ['parties','politicalMovements','politicians','parliamentaryGroups','offices',...PARTY_LINK_COLLECTIONS] : [];
  // The territorial races of the round (Elezioni → Candidatura): the provinces and the comuni of ISTAT and the parties the rivals come from, given to the game once loaded.
  const racePeople = () => ({ politicians: realDatabase.politicians ?? [], groups: realDatabase.parliamentaryGroups ?? [] });
  const provideRaceData = () => {
    store.initializeCommittees(realDatabase.territorialUnits ?? []);
    store.setTerritorialData({ units: realDatabase.territorialUnits ?? [], municipalities: realDatabase.municipalities ?? [], parties: realParties() });
  };
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
      if (page === 'elezioni') provideRaceData();
      return;
    }
    try {
      await loadRealCollections(required);
      if (ticket === catalog.loadTicket) {
        catalog.loadingPage = null;
        if (parliamentaryPage) { store.setReferenceGovernment(referenceGovernmentSpec()); store.initializeParliament(realDatabase.parliamentaryGroups ?? []); refreshContacts(); }
        if (page === 'partito') store.initializeCommittees(realDatabase.territorialUnits ?? []);
        if (page === 'elezioni') provideRaceData();
        render(store.getState(),store.getLastSaved());
      }
    } catch (error) {
      if (ticket === catalog.loadTicket) { catalog.loadingPage = null; catalog.errors[page] = error.message || 'Caricamento non riuscito.'; render(store.getState(),store.getLastSaved()); }
    }
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

  // ---- the personal catalog of logos ----
  const logoEntities = () => {
    const seen = new Map();
    for (const party of [...realParties(), ...store.getState().dataset.parties]) {
      if (!party?.id || seen.has(party.id)) continue;
      const kind = party.source === DATA_SOURCES.USER ? 'Creato da te' : (forceKind(party)?.label ?? 'Partito');
      seen.set(party.id, { id: party.id, name: party.officialName ?? party.name ?? party.label ?? party.id, abbreviation: party.abbreviation ?? '', color: party.color ?? null, kind });
    }
    const known = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'));
    // a logo of the catalog whose party is in none of those lists (imported from a zip, kept from another career, a party of a data set not loaded) is listed all the same, under its original id
    const orphans = listLogoInfos().filter(info => info.partyId && !seen.has(info.partyId)).map(info => ({ id: info.partyId, name: info.partyId, abbreviation: '', color: null, kind: 'Partito non presente in questa partita (identificativo originale)' })).sort((a, b) => a.id.localeCompare(b.id));
    return [...known, ...orphans];
  };
  const logoCatalogView = () => ({
    entities: menu.view === 'loghi' ? logoEntities() : [], infos: listLogoInfos(), logoSrc: resolveLogo, query: logoCatalog.query, page: logoCatalog.page, selectedId: logoCatalog.selectedId,
    pending: logoCatalog.pending, error: logoCatalog.error, notice: logoCatalog.notice, busy: logoCatalog.busy, urlDraft: logoCatalog.urlDraft, loading: logoCatalog.loading, signedIn: account.user?.username ?? null,
    editorHtml: logoEditor?.context === 'catalog' ? renderLogoEditor(logoEditor, { context: 'catalog' }) : '', legacy: logoCatalog.legacy.map(item => ({ ...item, name: logoEntities().find(entity => entity.id === item.partyId)?.name ?? item.partyId })), persistent: logoCatalog.persistent,
    guest: logoCatalog.guest.map(item => ({ ...item, name: logoEntities().find(entity => entity.id === item.partyId)?.name ?? item.partyId })), conflicts: logoCatalog.conflicts.map(item => ({ ...item, name: logoEntities().find(entity => entity.id === item.partyId)?.name ?? item.partyId, localSrc: resolveLogo(item.partyId) })), sync: logoCatalog.sync, syncing: logoCatalog.syncing, archive: logoCatalog.archive
  });
  const clearPendingLogo = () => { if (logoCatalog.pending?.src) URL.revokeObjectURL(logoCatalog.pending.src); logoCatalog.pending = null; if (logoEditor?.context === 'catalog') closeLogoEditor(); };
  const redrawLogos = () => render(store.getState(), store.getLastSaved());
  // The account changed (sign-in, sign-out, expired session, another tab): the logos of the previous scope leave the screen, those of the new one are read.
  const refreshLogoScope = () => { clearPendingLogo(); logoCatalog.selectedId = null; logoCatalog.sync = null; logoCatalog.guest = []; logoCatalog.conflicts = []; Object.assign(logoCatalog.archive, { plan: null, busy: '', progress: null, error: '', notice: '', replacedCount: 0, outcome: null }); return loadLogos().then(() => { redrawLogos(); if (account.user) runLogoSync(); }).catch(() => {}); };
  // The cloud copy of the account's logos: one run at a time (logo-sync.js), at sign-in, when the catalog opens, when the network comes back, after a change and on demand. Offline or not configured
  // it only says so: the logos stay on the device and are tried again later.
  const refreshLogoExtras = async () => { logoCatalog.guest = await listGuestLogos().catch(() => []); logoCatalog.conflicts = await listLogoConflicts().catch(() => []); };
  let logoSyncTimer = null;
  const runLogoSync = async () => {
    if (!account.user) { logoCatalog.sync = null; return; }
    logoCatalog.syncing = true; if (menu.view === 'loghi') redrawLogos();
    try { logoCatalog.sync = await syncLogos(); await loadLogos(); await refreshLogoExtras(); } catch (error) { logoCatalog.sync = { errors: [{ message: error?.message || 'Sincronizzazione non riuscita.' }], pending: logoCatalog.sync?.pending ?? 0, uploaded: [], downloaded: [], removed: [], conflicts: [] }; }
    logoCatalog.syncing = false; redrawLogos();
  };
  const scheduleLogoSync = () => { clearTimeout(logoSyncTimer); logoSyncTimer = setTimeout(() => runLogoSync(), 1200); };
  addEventListener('online', () => { if (account.user) runLogoSync(); });
  // Export and import of the whole catalog (logo-archive.js): one zip out, one zip in with a review first; what is imported is uploaded by the usual synchronisation.
  const logoArchive = logoCatalog.archive;
  const downloadFile = (blob, fileName) => { const href = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = href; link.download = fileName; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(href), 4000); };
  const exportAllLogos = async () => {
    Object.assign(logoArchive, { busy: 'export', error: '', notice: '' }); redrawLogos();
    try { const made = await exportLogosZip(); downloadFile(made.blob, made.fileName); logoArchive.notice = made.skipped.length ? `Esportati ${made.count} loghi in ${made.fileName} (${made.skipped.length} non esportati: file non valido).` : `Esportati ${made.count} loghi in ${made.fileName}.`; }
    catch (error) { logoArchive.error = error.message || 'Esportazione non riuscita.'; }
    logoArchive.busy = ''; redrawLogos();
  };
  const reviewLogoArchive = async file => {
    Object.assign(logoArchive, { busy: 'review', error: '', notice: '', plan: null }); redrawLogos();
    try { const analysis = await analyzeLogoArchive(file); logoArchive.plan = { analysis, fileName: file.name || 'archivio.zip', policy: 'keep', decisions: {}, report: null }; }
    catch (error) { logoArchive.error = error.message || 'Il file non è un archivio di loghi valido.'; }
    logoArchive.busy = ''; redrawLogos();
  };
  const runLogoImport = async only => {
    const plan = logoArchive.plan; if (!plan) return;
    Object.assign(logoArchive, { busy: 'import', error: '', notice: '', progress: { done: 0, total: only ? only.size : plan.analysis.items.length } }); redrawLogos();
    try {
      const report = await applyLogoImport(plan.analysis, { policy: plan.policy, decisions: plan.decisions, only, onProgress: progress => { logoArchive.progress = progress; } });
      // a retry adds to what the first run already did
      plan.report = only && plan.report ? { ...report, imported: [...plan.report.imported, ...report.imported], replaced: [...plan.report.replaced, ...report.replaced], kept: [...plan.report.kept, ...report.kept], skipped: [...plan.report.skipped, ...report.skipped], same: [...plan.report.same, ...report.same], invalid: plan.report.invalid } : report;
      logoArchive.replacedCount = (await listReplacedLogos().catch(() => [])).length;
      logoArchive.outcome = { report: plan.report, account: account.user?.username ?? null };
      await loadLogos(); await refreshLogoExtras();
      // the logos are on the device now; the copy in the account follows at once and its result is shown, not assumed
      clearTimeout(logoSyncTimer); logoArchive.progress = null;
      if (account.user && (plan.report.imported.length || plan.report.replaced.length)) { await runLogoSync(); if (logoCatalog.sync?.pending && !logoCatalog.sync.offline && !logoCatalog.sync.errors?.length && !logoCatalog.sync.unavailable) await runLogoSync(); }
    } catch (error) { logoArchive.error = error.message || 'Importazione non riuscita.'; }
    Object.assign(logoArchive, { busy: '', progress: null }); redrawLogos();
  };
  const restoreReplaced = async () => {
    Object.assign(logoArchive, { busy: 'restore', error: '', notice: '' }); redrawLogos();
    try { const back = await restoreReplacedLogos(); logoArchive.notice = `${back.length} loghi ripristinati (quelli importati restano recuperabili).`; logoArchive.replacedCount = (await listReplacedLogos().catch(() => [])).length; await loadLogos(); scheduleLogoSync(); }
    catch (error) { logoArchive.error = error.message || 'Ripristino non riuscito.'; }
    logoArchive.busy = ''; redrawLogos();
  };
  const openLogoCatalog = async () => {
    Object.assign(logoCatalog, { error: '', notice: '', busy: '', urlDraft: '', page: 1, loading: true });
    clearPendingLogo();
    redrawLogos();
    try { await loadRealCollections(['parties', 'politicalMovements', 'coalitions']); } catch { /* the list shows what is loaded */ }
    await loadLogos();
    logoCatalog.persistent = await logosArePersistent();
    logoCatalog.legacy = await listLegacyLogos().catch(() => []);
    logoCatalog.archive.replacedCount = (await listReplacedLogos().catch(() => [])).length;
    await refreshLogoExtras();
    logoCatalog.loading = false;
    logoCatalog.selectedId ||= logoEntities()[0]?.id ?? null;
    redrawLogos();
    if (account.user) runLogoSync();
  };
  const stageLogo = async (prepared, fileName, origin) => {
    clearPendingLogo();
    logoCatalog.pending = { prepared, fileName, origin, src: URL.createObjectURL(prepared.blob) };
    Object.assign(logoCatalog, { error: '', notice: '' });
    // the editor opens on the image: crop, zoom, position, uniform background, previews; only the confirmed result is kept
    await openLogoEditor(prepared.blob, 'catalog', fileName);
  };
  const stageLogoFile = async file => {
    if (!file || !logoCatalog.selectedId) return;
    Object.assign(logoCatalog, { busy: 'file', error: '', notice: '' }); redrawLogos();
    try { await stageLogo(await prepareLogo(file), file.name || 'logo', 'file'); } catch (error) { clearPendingLogo(); logoCatalog.error = error.message || 'Il file non è valido.'; }
    logoCatalog.busy = ''; redrawLogos();
  };
  const stageLogoUrl = async address => {
    if (!logoCatalog.selectedId) return;
    logoCatalog.urlDraft = String(address ?? '').trim();
    if (!logoCatalog.urlDraft) { logoCatalog.error = 'Incolla l’indirizzo di un’immagine.'; redrawLogos(); return; }
    Object.assign(logoCatalog, { busy: 'url', error: '', notice: '' }); redrawLogos();
    try { await stageLogo(await importLogoFromUrl(logoCatalog.urlDraft), new URL(logoCatalog.urlDraft).pathname.split('/').pop() || 'logo', 'url'); logoCatalog.urlDraft = ''; }
    catch (error) { clearPendingLogo(); logoCatalog.error = error.message || 'Importazione non riuscita.'; }
    logoCatalog.busy = ''; redrawLogos();
  };
  const saveStagedLogo = async () => {
    const { pending, selectedId } = logoCatalog;
    if (!pending || !selectedId) return;
    const name = logoEntities().find(item => item.id === selectedId)?.name ?? 'partito';
    logoCatalog.busy = 'save'; redrawLogos();
    try {
      // the final result of the editor (crop, zoom, background) is compressed and checked again like any other file, then saved
      let prepared = pending.prepared;
      if (logoEditor?.context === 'catalog') { const edited = await exportLogo(logoEditor, logoEditorImage, null); prepared = await prepareLogo(new File([edited.blob], 'logo.png', { type: 'image/png' })); }
      const saved = await saveLogo(selectedId, prepared, { fileName: pending.fileName, origin: pending.origin, alt: `Logo di ${name}` });
      logoCatalog.notice = saved.persistent ? (account.user ? 'Logo salvato su questo dispositivo e in caricamento sul tuo account: lo ritrovi su ogni dispositivo con cui accedi.' : 'Logo salvato su questo dispositivo: lo vedi in tutte le tue partite. Accedi a un account per averlo anche su altri dispositivi.') : 'Logo in uso solo finché la pagina resta aperta: questo browser non permette di conservarlo.';
      logoCatalog.persistent = saved.persistent; clearPendingLogo(); scheduleLogoSync();
    }
    catch (error) { logoCatalog.error = error.message; }
    logoCatalog.busy = ''; redrawLogos();
  };
  // The projected bill of a measure (or of the budget) follows every change in the form, without redrawing the page.
  const blobToDataUrl = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  const refreshPolicyPreview = (form, field = null) => {
    if (!form) return;
    const society = store.getState().society;
    // Every slider says its value, and the people using a screen reader hear it too.
    for (const range of form.querySelectorAll('input[type="range"][data-range]')) {
      const text = rangeText(range);
      const out = range.closest('.slider-field')?.querySelector('[data-range-out]');
      if (out) out.textContent = text;
      range.setAttribute('aria-valuetext', text);
    }
    if (form.matches('[data-budget-form]')) {
      for (const label of form.querySelectorAll('.segmented label')) label.classList.toggle('active', Boolean(label.querySelector('input')?.checked));
      const target = form.querySelector('[data-budget-preview]');
      if (target) target.innerHTML = budgetPreview(society, planFromForm(form), store.getState().parliament);
      return;
    }
    if (form.matches('[data-project-form]')) {
      const target = form.querySelector('[data-project-preview]');
      if (target) target.innerHTML = projectPreview(store.getState(), requestFromForm(form));
      return;
    }
    if (form.matches('[data-project-funding-form]')) return;
    const design = designFromForm(form);
    if (field?.matches?.('[data-policy-area]')) {
      const fields = form.querySelector('[data-policy-fields]');
      if (fields) fields.outerHTML = policyFields({ ...design, area: field.value, instrument: design?.instrument, target: 'nazionale' });
    }
    for (const choice of form.querySelectorAll('.policy-choice')) choice.classList.toggle('active', Boolean(choice.querySelector('input')?.checked));
    const cut = form.querySelector('[data-policy-cut]');
    if (cut) cut.hidden = form.querySelector('[data-policy-financing]')?.value !== 'tagli';
    const target = form.querySelector('[data-policy-preview]');
    if (target) target.innerHTML = policyPreview(society, designFromForm(form)) + accordWarning(store.accordConflicts(designFromForm(form)));
  };
  // Creates the career from the wizard (the real Government in office is loaded first, so every career finds it).
  // Entering a career (Continua, a save, an import, a new career) always starts from the Home, on phones and computers.
  const enterHome = async () => { askBackground(); refreshContacts(); setHash('panoramica', true); globalThis.scrollTo?.(0, 0); await ensurePageData('panoramica'); };
  // After the logo of a new party was saved on this device: with an account it is uploaded now (not after the delay of the catalog); the outcome is said in the toast and kept in the report of the
  // catalog: online, waiting (offline, service not active, errors) or kept only here (no account). A synchronisation that was already running when the logo was saved does not include it, so one more run follows.
  const uploadNewPartyLogo = async ({ partyName, persistent }) => {
    const say = message => { logoCatalog.notice = message; store.getState().ui.toast = message; render(store.getState(), store.getLastSaved()); };
    if (!persistent) { say(`Il logo di «${partyName}» resta solo finché la pagina è aperta: questo browser non permette di conservarlo.`); return; }
    if (!account.user) { say(`Il logo di «${partyName}» è salvato su questo dispositivo. Accedi per caricarlo sul tuo account e ritrovarlo sugli altri dispositivi.`); return; }
    try {
      await runLogoSync();
      if (logoCatalog.sync?.pending && !logoCatalog.sync.offline && !logoCatalog.sync.errors?.length && !logoCatalog.sync.unavailable) await runLogoSync();
    } catch { /* the report says what happened */ }
    const report = logoCatalog.sync;
    if (!report || report.skipped) return;
    if (report.unavailable) say(`Il logo di «${partyName}» è salvato su questo dispositivo: la copia online dei loghi non è attiva su questo sito.`);
    else if (report.offline) say(`Il logo di «${partyName}» è in attesa di essere caricato: sei offline, si riproverà da solo appena torna la rete.`);
    else if (report.errors?.length) { logoCatalog.error = `Logo di «${partyName}» non ancora online: ${report.errors[0].message}`; say(`${logoCatalog.error} (${report.pending || 1} in attesa, nulla è andato perso)`); }
    else if (report.conflicts?.length) say('Un logo del tuo account è diverso da quello di questo dispositivo: scegli quale tenere nel catalogo dei loghi.');
    else if (report.pending) say(`Il logo di «${partyName}» è in attesa di essere caricato.`);
    else say(`Il logo di «${partyName}» è salvato sul tuo account: lo ritrovi su ogni dispositivo.`);
  };
  const finishWizard = async () => {
    try {
      try { await loadRealCollections(['government','politicians','parliamentaryGroups']); store.setReferenceGovernment(referenceGovernmentSpec()); } catch { /* without the real Government the career starts without one */ }
      // The calendars, the electoral map and the population are part of the new career: they are waited for (at most 20 seconds; without them the game uses its declared fallbacks).
      await Promise.race([askBackground(), new Promise(resolve => setTimeout(resolve, 20000))]);
      // The career in progress is kept, and the browser's confirmation waited for, before the new one takes its place: if it cannot be kept nothing is replaced.
      await store.preserveCurrent();
      const player = store.createCareer(wizard,realParties(),realDatabase.parliamentaryGroups ?? []);
      // A logo uploaded for the new party goes into the personal catalog, under the party's id (never into the save).
      let newPartyLogo = null;
      if (wizard.partyMode === 'new' && wizard.partyLogoMode === 'upload' && wizard.partyLogoBlob && player?.partyId) {
        try {
          const edited = logoEditor?.context === 'wizard' ? await exportLogo(logoEditor, logoEditorImage, wizard.partyLogoBlob).catch(() => null) : null;
          const source = edited?.blob ?? wizard.partyLogoBlob;
          const kept = await saveLogo(player.partyId, await prepareLogo(new File([source], wizard.partyLogoBlob.name || 'logo', { type: source.type })), { fileName: wizard.partyLogoBlob.name || 'logo', origin: 'file', alt: `Logo di ${wizard.partyName}` });
          newPartyLogo = { partyName: wizard.partyName, persistent: kept.persistent };
        } catch (error) {
          // The party keeps its original drawn mark, and the player is told (the career is created all the same).
          logoCatalog.error = `Il logo del partito non è stato salvato: ${error.message || 'errore sconosciuto'}`;
          store.getState().ui.toast = logoCatalog.error;
        }
        closeLogoEditor();
      }
      wizard = null; playSound('success'); refreshContacts();
      // The logo of the new party goes to the account like the logos of the catalog (the career is not waited for, and a failure is shown, not hidden).
      if (newPartyLogo) uploadNewPartyLogo(newPartyLogo);
      // A career created while an account is signed in belongs to that account from the start (the one case in which it is linked without a further question).
      if (account.user && store.hasCareer()) { const saved = store.save(); if (saved.ok) syncCareer({ explicit: true }).catch(() => {}); }
      await enterHome();
    } catch (error) { if (wizard) { wizard.errors = [error.message || 'Impossibile creare la carriera.']; wizard.lastErrors = wizard.errors; wizard.blocked = /non può essere conservata/.test(error.message ?? ''); } }
  };
  // Every collection the wizard needs is loaded on its own: one that fails does not block the others, and the
  // wizard says what is missing with a “Riprova” (the comune can never be typed freely instead of the ISTAT list).
  // An answer that arrives after “Annulla” (or after another creator was opened) belongs to a draft that is gone: it changes nothing and draws nothing.
  const loadWizardData = async () => {
    const draft = wizard;
    wizardData.status = 'loading'; wizardData.failed = [];
    if (wizard) render(store.getState(), store.getLastSaved());
    const { failed } = await loadRealCollectionsSettled(WIZARD_COLLECTIONS);
    if (!draft || wizard !== draft) return;
    wizardData.failed = failed;
    wizardData.status = failed.length ? 'error' : 'ready';
    render(store.getState(), store.getLastSaved());
  };
  const openNewGame = async (legacyId = '') => {
    if (dataLoading()) return;
    askBackground();
    menu.open = false;
    wizard = makeCareerDraft(store.startDate(), store.getState().dataset.parties, store.hallOfFame());
    // Starting from the legacy of a concluded career (the Hall of Fame keeps it).
    if (legacyId && wizard.hall.some(entry => entry.id === legacyId)) wizard.legacyId = legacyId;
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
    // A click on the backdrop of the creator of a career is «Annulla» (a click inside the dialog never is).
    if (wizard && event.target.matches?.('[data-wizard-backdrop]')) { cancelWizard(); playSound('click'); render(store.getState(), store.getLastSaved()); return; }
    const tutorialButton = event.target.closest('[data-tutorial]')?.dataset.tutorial;
    if (tutorialButton) {
      tutorialAction(tutorialButton);
      const now = tutorialState();
      // The tutorial walks through the real pages: on a step the page it is about opens (a career in progress, nothing else changes).
      if (['start', 'restart', 'resume', 'next', 'prev'].includes(tutorialButton) && now.status === 'active' && store.hasCareer()) { menu.open = false; setHash(TUTORIAL_STEPS[now.step].page); await ensurePageData(TUTORIAL_STEPS[now.step].page); }
      render(store.getState(), store.getLastSaved()); return;
    }
    if (event.target.closest('[data-tutorial-also]')) tutorialAction('start');
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
    let menuTarget =event.target.closest('[data-menu],[data-menu-close],[data-menu-action],[data-slot-load],[data-slot-delete],[data-slot-export],[data-version-restore],[data-version-export],[data-setting-key],[data-report-close],[data-account-action],[data-cloud-load],[data-cloud-delete],[data-conflict],[data-history-open],[data-history-restore]');
    // A click inside a dialog on a control that is not one of the menu's (the Hall's «Nuova carriera con questa eredità» and «Elimina», for one) must reach the handlers below: only the backdrop itself is the backdrop's.
    if (menuTarget && menuTarget.matches('.report-backdrop') && event.target !== menuTarget && event.target.closest('.report-modal') && !event.target.closest('[data-menu],[data-menu-action],[data-slot-load],[data-slot-delete],[data-slot-export],[data-version-restore],[data-version-export],[data-setting-key],[data-account-action],[data-cloud-load],[data-cloud-delete],[data-conflict],[data-history-open],[data-history-restore],[data-report-close],[data-menu-close]:not(.menu-popup-backdrop)')) menuTarget = null;
    if (menuTarget) {
      const data = menuTarget.dataset;
      if (menuTarget.matches('.report-backdrop') && event.target.closest('.report-modal')) return;
      // The popups of the main menu: the backdrop closes only when it is the backdrop itself that is hit (a click inside the dialog never reaches it).
      if (data.menuClose !== undefined) {
        if (menuTarget.matches('.menu-popup-backdrop') && event.target !== menuTarget) return;
        closeMenuPopup(); playSound('click'); render(store.getState(), store.getLastSaved()); return;
      }
      menu.error = '';
      // A new career starts from the real data (parties, polls, two per thousand): until it has arrived «Nuova partita» does nothing (the button is disabled; this covers any other way to reach it).
      // A career already saved is not held back: it carries its own world, and the pages it opens ask for the collections they need.
      if (dataLoading() && (data.menu === 'nuova' || data.menuAction === 'start-local')) return;
      try {
        if (data.menu === 'continua' && gateOf()) { menu.view = 'account'; account.mode = 'login'; menu.reveal = true; playSound('click'); }
        else if (data.menu === 'continua') { menu.open = false; playSound('confirm'); await enterHome(); }
        // A new career needs an account (when the account service is reachable): the account comes first.
        // Unreachable service: the welcome says so and offers “Inizia senza account” (and “Riprova”) at once.
        else if (data.menu === 'nuova' && account.status !== 'none' && !account.user && !menu.localStart) { menu.view = 'benvenuto'; menu.needAccount = true; menu.reveal = true; playSound('click'); }
        else if (data.menu === 'nuova') { playSound('confirm'); await openNewGame(); return; }
        else if (data.menu === 'account' && data.accountMode) { menu.view = 'account'; account.mode = data.accountMode; account.error = ''; account.message = ''; menu.reveal = true; playSound('click'); }
        else if (data.menu) { menu.view = menu.view === data.menu ? 'home' : data.menu; playSound('click'); if (menu.view === 'loghi') { await openLogoCatalog(); return; } if (menu.view === 'account' && account.user && !account.info) await refreshCloud({ info: true }); }
        else if (data.menuAction === 'start-local') { menu.localStart = true; markOnboarding({ localStart: true }); playSound('confirm'); await openNewGame(); return; }
        else if (data.menuAction === 'gate-login') { menu.view = 'account'; account.mode = 'login'; account.error = ''; account.message = ''; menu.reveal = true; playSound('click'); }
        else if (data.menuAction === 'gate-local') {
          const id = careerIdNow();
          if (id && gateOf()) confirmThen({ title: 'Continuare solo in questo browser?', body: `Questa carriera è collegata all’account «${accountApi.ownerOf(id)}». Continuando qui non verrà né caricata online né sincronizzata con nessun account; il collegamento e le copie online non vengono toccati.`, details: ['Potrai riportarla online in qualsiasi momento da «Salva ora online», con l’account a cui appartiene.', 'Nessun salvataggio viene eliminato.'], confirmLabel: 'Usa localmente' }, async () => { accountApi.useLocally(id); menu.open = false; playSound('confirm'); await enterHome(); });
        }
        else if (data.menuAction === 'save-slot') { assertAvailable(careerIdNow()); store.saveToSlot(); playSound('success'); }
        else if (data.menuAction === 'export') { assertAvailable(careerIdNow()); download(store.exportSave(), `politicando-partita-${new Date().toISOString().slice(0, 10)}.json`); }
        else if (data.menuAction === 'reset-settings') { confirmThen({ title: 'Ripristinare le impostazioni?', body: 'Audio, animazioni, testo, contrasto, notifiche, velocità della simulazione e salvataggio automatico tornano ai valori iniziali. Le partite e i salvataggi non vengono toccati.', confirmLabel: 'Ripristina' }, () => { settings = resetSettings(settingsScope()); applySettings(); }); return; }
        else if (data.menuAction === 'clear-saves') { confirmThen({ title: 'Eliminare tutti i salvataggi?', body: 'La partita in corso e tutti i salvataggi di questo browser verranno cancellati. L’operazione non si può annullare.', details: [account.user ? 'Le copie online nel tuo account restano: potrai recuperarle dal menu Account.' : 'Senza account non resta nessuna copia: esporta prima su file ciò che vuoi tenere.', 'L’archivio dell’amministratore e i loghi non vengono toccati.'], confirmLabel: 'Elimina tutto', tone: 'danger' }, () => { store.clearAllSaves(); menu.open = true; menu.view = 'home'; }); return; }
        else if (data.slotLoad) {
          assertAvailable(store.slotCareerId(data.slotLoad));
          const load = async () => { await store.preserveCurrent(); store.loadSlot(data.slotLoad); menu.open = false; playSound('success'); await enterHome(); };
          if (store.hasCareer() && store.hasUnsavedChanges()) { confirmThen({ title: 'Caricare questo salvataggio?', body: 'La partita in corso ha modifiche non salvate: verrà salvata in uno slot prima di caricare quella scelta.', confirmLabel: 'Carica' }, load); return; }
          await load();
        }
        else if (data.slotExport) { assertAvailable(store.slotCareerId(data.slotExport)); download(store.exportSlot(data.slotExport), `politicando-slot-${data.slotExport}-${new Date().toISOString().slice(0, 10)}.json`); }
        else if (data.versionExport) { assertAvailable(store.localVersions().find(item => item.id === data.versionExport)?.careerId); download(store.exportLocalVersion(data.versionExport), `politicando-copia-${new Date().toISOString().slice(0, 10)}.json`); }
        else if (data.versionRestore) {
          const version = store.localVersions().find(item => item.id === data.versionRestore);
          assertAvailable(version?.careerId);
          confirmThen({ title: 'Ripristinare questa copia?', body: version ? `Torna la copia di ${version.player}, settimana ${version.week} (${formatDate(version.gameDate)}).` : 'Torna questa copia di sicurezza.', details: [...(version?.older ? ['Esiste una versione più avanzata di questa carriera: la copia torna come carriera separata, con una nuova identità. Quella più avanzata non viene toccata.'] : []), ...(store.hasCareer() ? ['La partita in corso viene prima messa in uno slot automatico: se non si riesce a conservarla, nulla viene sostituito.'] : [])], confirmLabel: version?.older ? 'Ripristina come nuova carriera' : 'Ripristina' }, async () => { await store.preserveCurrent(); store.restoreLocalVersion(data.versionRestore); menu.open = false; playSound('success'); await enterHome(); });
          return;
        }
        else if (data.slotDelete) { const slot = store.listSlots().find(item => item.id === data.slotDelete); assertAvailable(slot?.careerId); confirmThen({ title: 'Eliminare questo salvataggio?', body: `«${slot?.name ?? 'Salvataggio'}» verrà eliminato da questo browser. L’operazione non si può annullare.`, confirmLabel: 'Elimina salvataggio', tone: 'danger' }, () => store.deleteSlot(data.slotDelete)); return; }
        else if (data.settingKey === 'language') { await setLanguage(data.settingValue); settings = loadSettings(settingsScope()); applySettings(); playSound('click'); }
        else if (data.settingKey) { settings = saveSetting(data.settingKey, data.settingValue, settingsScope()); if (data.settingKey === 'newsPopup') { if (data.settingValue === 'off') newsPopup = null; else newsPopupHoldWeek = store.getState().game?.week?.index ?? null; } applySettings(); playSound('click'); }
        else if ('reportClose' in data) reportOpen = false;
        else if (data.accountAction === 'logout') { await leaveAccount(); }
        else if (data.accountAction === 'refresh') { await refreshCloud({ info: true }); }
        else if (data.accountAction === 'probe') { await probeAccount(); }
        else if (data.accountAction === 'sync') {
          account.busy = 'sync'; render(store.getState(), store.getLastSaved());
          const saved = store.save();
          if (saved.ok) await syncCareer({ silent: false, explicit: true }); else account.error = `Il salvataggio in questo browser non è riuscito (${saved.error}): la partita non va online.`;
          account.busy = false;
        }
        else if (data.cloudLoad) {
          const load = async () => { const remote = await downloadSave(data.cloudLoad, { commit: false }); await store.preserveCurrent(); adoptCloud(data.cloudLoad, remote, 'Carriera recuperata dal tuo account'); account.currentSlot = data.cloudLoad; menu.open = false; playSound('success'); await enterHome(); };
          if (store.hasCareer() && store.hasUnsavedChanges()) { confirmThen({ title: 'Caricare la carriera online?', body: 'La partita in corso ha modifiche non salvate: verrà salvata in uno slot prima di caricare la carriera dal tuo account.', confirmLabel: 'Carica' }, load); return; }
          await load();
        }
        else if (data.cloudDelete) { confirmThen({ title: 'Eliminare la copia online?', body: 'Questa carriera verrà eliminata dall’archivio del tuo account. La copia nel browser resta e la versione eliminata si può recuperare dalle versioni precedenti.', confirmLabel: 'Elimina online', tone: 'danger' }, async () => { await deleteCloudSave(data.cloudDelete); await refreshCloud(); }); return; }
        // The conflicts: the online copy is the one the account holds; the copy of this browser is the one saved here. Nothing is replaced without a choice.
        else if (data.conflict === 'download') {
          const item = account.conflicts.find(entry => entry.careerId === data.conflictCareer) ?? account.conflict;
          if (item) { const remote = await downloadSave(item.slot, { commit: false }); await store.preserveCurrent(); const loaded = adoptCloud(item.slot, remote, 'Versione online caricata'); syncEngine.resolve(item.careerId); if (accountApi.compareProgress(accountApi.progressOf(loaded), accountApi.progressOf(remote.state)) !== 0) syncEngine.enqueue(loaded); account.message = 'Versione online caricata.'; refreshSyncView(); if (!menu.open) await enterHome(); }
        }
        else if (data.conflict === 'keep') {
          const item = account.conflicts.find(entry => entry.careerId === data.conflictCareer) ?? account.conflict;
          if (item) confirmThen({ title: 'Sostituire la versione online con questa?', body: 'La versione online verrà sostituita dalla copia salvata in questo browser. Quella sostituita resta recuperabile dalle versioni precedenti della carriera.', details: item.remote ? [`Online ora: revisione ${item.remote.revision}${item.remote.updatedAt ? ` del ${formatDate(String(item.remote.updatedAt).slice(0, 10))}` : ''}.`] : [], confirmLabel: 'Sostituisci online', tone: 'danger' }, async () => { await replaceOnline(item); render(store.getState(), store.getLastSaved()); });
          if (item) return;
        }
        else if (data.conflict === 'apart') { const item = account.conflicts.find(entry => entry.careerId === data.conflictCareer) ?? account.conflict; if (item) { setDeclined(item.careerId, true); syncEngine.resolve(item.careerId); account.message = 'Questa carriera resta solo su questo dispositivo: la versione online non è stata toccata.'; refreshSyncView(); } }
        else if (data.accountAction === 'keep-local') { const id = careerIdNow(); if (id) { setDeclined(id, true); syncEngine.resolve(id); account.message = 'Questa carriera resta solo su questo dispositivo.'; } }
        else if (data.accountAction === 'link') {
          const id = careerIdNow();
          const owner = id ? accountApi.ownerOf(id) : null;
          if (owner && owner !== account.user?.username) confirmThen({ title: `Collegare la carriera a «${account.user.username}»?`, body: `Questa carriera era collegata all’account «${owner}». Verrà creata una copia nel tuo account; la copia di «${owner}» non viene toccata.`, confirmLabel: 'Collega', tone: 'danger' }, async () => { accountApi.unlinkCareer(id); await syncCareer({ silent: false, explicit: true }); render(store.getState(), store.getLastSaved()); });
          else { account.busy = 'sync'; render(store.getState(), store.getLastSaved()); store.save(); await syncCareer({ silent: false, explicit: true }); account.busy = false; }
          if (owner && owner !== account.user?.username) return;
        }
        else if (data.historyOpen) {
          account.history = account.history?.slot === data.historyOpen ? null : { slot: data.historyOpen, items: null };
          if (account.history) { render(store.getState(), store.getLastSaved()); try { account.history.items = await accountApi.listSaveHistory(data.historyOpen); } catch (error) { account.history.error = error.message; } }
        }
        else if (data.historyRestore) {
          const slot = data.historySlot, id = Number(data.historyRestore);
          const remote = account.saves.find(item => item.slot === slot);
          confirmThen({ title: 'Ripristinare questa versione?', body: 'La versione online diventerà questa. Quella attuale resta tra le versioni precedenti.', confirmLabel: 'Ripristina', tone: 'danger' }, async () => {
            try {
              const done = await accountApi.restoreFromHistory(slot, id, remote?.revision ?? 0);
              const fetched = await downloadSave(slot, { commit: false });
              await store.preserveCurrent();
              const loaded = adoptCloud(slot, { ...fetched, revision: done.revision }, 'Versione ripristinata');
              account.message = accountApi.compareProgress(accountApi.progressOf(loaded), accountApi.progressOf(fetched.state)) === 0 ? 'Versione online ripristinata e caricata.' : 'Versione online ripristinata. In questo browser c’è una copia più avanzata della stessa carriera: resta quella in uso e al prossimo salvataggio la sostituirà online.';
              account.history = null; await refreshCloud();
            } catch (error) { account.error = error.status === 409 ? 'La versione online è cambiata nel frattempo: aggiorna l’elenco e riprova.' : error.message; }
            render(store.getState(), store.getLastSaved());
          });
          return;
        }
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
    // Home on phones: a folded list opens (or closes) and stays as the player left it.
    const expand = event.target.closest('[data-home-expand]')?.dataset.homeExpand;
    if (expand) { views.homeExpand = { ...(views.homeExpand ?? {}), [expand]: !views.homeExpand?.[expand] }; saveViews(); render(store.getState(), store.getLastSaved()); return; }
    const newsChip = event.target.closest('[data-news-category],[data-news-outlet]');
    if (newsChip) {
      if (newsChip.dataset.newsCategory) views.newsCategory = newsChip.dataset.newsCategory;
      else views.newsOutlet = newsChip.dataset.newsOutlet;
      saveViews(); render(store.getState(), store.getLastSaved()); return;
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
        throw new Error('Il colore dominante si usa dalla creazione del partito.');
      } catch (error) { if (wizard) wizard.partyLogoError = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    // Territorial committees: actions on a committee, new committees on the ISTAT map, the list of comuni on demand.
    // The plan of the week, the treasury operations and the staff: real actions of the store (the plan and the mandates are shown and confirmed first).
    // The news: closing the summary of the Home, going from a radio item to its article, the jingle of the radio.
    // The pop-up of the week: any of its buttons closes it (the one that opens Informazione also navigates, below).
    if (event.target.closest('[data-news-popup-close]')) { newsPopup = null; if (!event.target.closest('[data-nav]')) { render(store.getState(), store.getLastSaved()); return; } }
    // The pop-up's «Leggi la storia»: closes it and opens that article in the newsroom.
    const popupOpen = event.target.closest('[data-news-popup-open]');
    if (popupOpen) {
      newsPopup = null; views.newsFilter = 'articoli'; views.newsCategory = 'tutte'; views.newsOutlet = 'tutte'; pendingArticle = { id: popupOpen.dataset.newsPopupOpen, until: Date.now() + 2500 }; saveViews();
      setHash('notizie'); await ensurePageData('notizie'); render(store.getState(), store.getLastSaved()); return;
    }
    // The bulletin or an article read aloud by the device's own voice (start / stop): the text is on the page whatever happens.
    const speakButton = event.target.closest('[data-voice-target]');
    if (speakButton) {
      const what = speakButton.dataset.voiceTarget;
      if (voiceTarget() === what) stopVoice();
      else {
        const media = newsMedia(store.getState());
        const lines = what === 'bulletin' ? bulletinScript(media?.radio?.bulletins ?? []) : articleScript(media?.articles?.find(item => `article:${item.id}` === what));
        if (!speakLines(lines, { volume: Number(settings.volume) / 100, what })) { speakButton.disabled = true; const label = speakButton.querySelector('[data-voice-label]'); if (label) label.textContent = 'Voce non disponibile'; }
      }
      return;
    }
    const newsControl = event.target.closest('[data-home-news-dismiss],[data-news-goto],[data-radio-play]');
    if (newsControl) {
      const data = newsControl.dataset;
      if (data.homeNewsDismiss) { store.dismissHomeNews(data.homeNewsDismiss.split(',').filter(Boolean)); playSound('click'); }
      else if (data.radioPlay !== undefined) { playSound('radio'); newsControl.classList.add('is-on-air'); newsControl.textContent = 'In onda…'; setTimeout(() => { newsControl.classList.remove('is-on-air'); newsControl.textContent = 'Ascolta la sigla'; }, 1500); return; }
      else if (data.newsGoto) {
        views.newsFilter = 'articoli'; views.newsCategory = 'tutte'; views.newsOutlet = 'tutte';
        render(store.getState(), store.getLastSaved());
        const card = root.querySelector(`[data-article="${data.newsGoto}"]`);
        if (card) { card.querySelector('details')?.setAttribute('open', ''); card.scrollIntoView?.({ block: 'center' }); }
        return;
      }
      return;
    }
    const planControl = event.target.closest('[data-plan-add],[data-plan-remove],[data-plan-clear],[data-plan-run],[data-treasury-start],[data-transfer-request],[data-transfer-give],[data-staff-status]');
    if (planControl) {
      const data = planControl.dataset;
      try {
        if (data.planAdd !== undefined) {
          const op = JSON.parse(data.planAdd);
          if (op.kind === 'activity') op.target = root.querySelector(`[data-activity-target="${op.id}"]`)?.value ?? null;
          const key = planKey(op), at = plan.findIndex(item => planKey(item) === key);
          if (at >= 0) plan.splice(at, 1);
          else if (plan.length >= PLAN_MAX) throw new Error(`Un piano può avere al massimo ${PLAN_MAX} operazioni.`);
          else plan.push(op);
        } else if (data.planRemove !== undefined) plan.splice(Number(data.planRemove), 1);
        else if (planControl.matches('[data-plan-clear]')) plan = [];
        else if (planControl.matches('[data-plan-run]')) {
          const preview = store.planPreview(plan);
          if (!preview.ok) throw new Error(`Il piano non si può eseguire: ${preview.lines.filter(line => !line.ok).map(line => line.problem).join(' ')}`);
          const snapshot = [...plan];
          confirmThen({ kicker: 'PIANO DELLA SETTIMANA', title: `Eseguire ${snapshot.length} ${snapshot.length === 1 ? 'operazione' : 'operazioni'}?`, body: 'Le operazioni si eseguono in questo ordine, una sola volta: se una non riesce, nessuna viene fatta.', details: planConfirmLines(store.getState(), snapshot, preview), confirmLabel: 'Esegui il piano' }, () => { const result = store.executePlan(snapshot); plan = []; playSound('confirm'); return result; });
          return;
        } else if (data.treasuryStart) { store.startTreasuryOperation(data.treasuryStart); playSound('confirm'); }
        else if (data.transferRequest !== undefined || data.transferGive !== undefined) {
          // funds between the politician and the party: a preset, or the figure typed in the box (an empty box is an error, never zero)
          const kind = data.transferRequest !== undefined ? 'request' : 'give';
          const raw = kind === 'request' ? data.transferRequest : data.transferGive;
          const amount = raw === 'custom' ? (root.querySelector(`[data-transfer-custom="${kind}"]`)?.value ?? '') : raw;
          if (kind === 'request') store.requestPartyFunds(amount); else store.payIntoParty(amount);
          playSound('confirm');
        }
        else if (data.staffStatus) {
          const status = data.staffStatus, id = data.mandateId;
          if (status === 'annullato') { confirmThen({ kicker: 'STAFF', title: 'Annullare l’incarico?', body: 'Lo staff smette di lavorarci: quanto già speso resta speso e non si riapre.', confirmLabel: 'Annulla l’incarico', tone: 'danger' }, () => store.setStaffMandate(id, 'annullato')); return; }
          store.setStaffMandate(id, status); playSound('confirm');
        }
        planCache = { key: '', value: null };
      } catch (error) { store.getState().ui.toast = error.message; }
      render(store.getState(), store.getLastSaved());
      return;
    }
    const committeeControl = event.target.closest('[data-committee-action],[data-committee-found],[data-committee-load]');
    if (committeeControl) {
      const data = committeeControl.dataset;
      try {
        if (data.committeeLoad) { await loadRealCollections([data.committeeLoad]); render(store.getState(), store.getLastSaved()); return; }
        if (data.committeeFound === 'nuovo') {
          // the region, the province and the comune come from the ISTAT lists chosen in the panel (never from the player's home)
          store.committeeAction('fonda', { level: data.committeeLevel, name: data.committeeName, region: data.committeeRegion, unitCode: data.committeeUnit || null, unitType: data.committeeUnitType || null, unitName: data.committeeUnitName || null, municipalityCode: data.committeeMunicipality || null });
          delete views.filters['found-municipality'];
        } else if (data.committeeAction === 'fonda') store.committeeAction('fonda', { level: data.committeeLevel, name: data.committeeName, region: data.committeeRegion, unitCode: data.committeeUnit || null, unitType: data.committeeUnitType || null, municipalityCode: data.committeeMunicipality || null });
        else store.committeeAction(data.committeeAction, { committeeId: data.committeeId });
        playSound('confirm');
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    // The hemicycle: seats, chamber, colours, legend filters and the vote to show; the view is kept across redraws.
    const hemi = event.target.closest('[data-hemi-seat],[data-hemi-chamber],[data-hemi-color],[data-hemi-filter-group],[data-hemi-filter-party],[data-hemi-reset],[data-hemi-close],[data-hemi-vote],[data-hemi-more],[data-hemi-locate]');
    if (hemi) {
      const data = hemi.dataset;
      const view = views.hemicycle;
      // A seat chosen in the list (scroll: card) shows its card; one chosen from the cards of the week (scroll: 1) brings the hemicycle into view.
      if (data.hemiSeat) { view.selected = view.selected === data.hemiSeat && !data.hemiScroll ? null : data.hemiSeat; if (data.hemiScroll) { saveViews(); render(store.getState(), store.getLastSaved()); root.querySelector?.(data.hemiScroll === 'card' ? '.hemi-card' : '#hemicycle')?.scrollIntoView?.({ block: data.hemiScroll === 'card' ? 'nearest' : 'start' }); return; } }
      else if (hemi.matches('[data-hemi-more]')) view.limit = (Number(view.limit) || 40) + 40;
      else if (hemi.matches('[data-hemi-locate]')) { saveViews(); render(store.getState(), store.getLastSaved()); root.querySelector?.('.hemi-roster-list .active')?.scrollIntoView?.({ block: 'center' }); return; }
      else if (data.hemiChamber) Object.assign(view, { chamber: data.hemiChamber, group: '', committee: '', vote: '', territory: '', limit: 40, selected: null });
      else if (data.hemiColor) view.colorBy = data.hemiColor;
      else if (data.hemiFilterGroup) view.group = view.group === data.hemiFilterGroup ? '' : data.hemiFilterGroup;
      else if (data.hemiFilterParty) view.party = view.party === data.hemiFilterParty ? '' : data.hemiFilterParty;
      else if (hemi.matches('[data-hemi-reset]')) Object.assign(view, { party: '', group: '', committee: '', vote: '', q: '', territory: '', limit: 40 });
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
    // The first screen of a first installation: the language is chosen (and kept in the settings of the browser), then the account screen that already exists, in that language.
    const languageChoice = event.target.closest('[data-language-choice]');
    if (languageChoice) {
      const next = languageChoice.dataset.languageChoice;
      await setLanguage(next);
      settings = saveSetting('language', next, null);
      applySettings(); playSound('click');
      menu.firstRun = true;
      menu.view = 'home';
      if (!account.user && account.status !== 'none' && !onboarding().account && !menu.localStart) { menu.view = 'benvenuto'; menu.reveal = true; }
      render(store.getState(), store.getLastSaved()); return;
    }
    const viewFilterChoice = event.target.closest('[data-view-filter]');
    if (viewFilterChoice) {
      // regions and provinces are two readings of the map: a pick of one is not carried over to the other
      if (viewFilterChoice.dataset.viewFilter === 'mapScope' && (views.filters.mapScope ?? 'regioni') !== viewFilterChoice.dataset.viewFilterValue) views.filters.mapSel = '';
      views.filters[viewFilterChoice.dataset.viewFilter] = viewFilterChoice.dataset.viewFilterValue;
      // a filter can also set another one (the state pills of the committees turn on «Tutte le regioni»): data-view-filter-also="key=value"
      if (viewFilterChoice.dataset.viewFilterAlso) { const [key, ...rest] = viewFilterChoice.dataset.viewFilterAlso.split('='); views.filters[key] = rest.join('='); }
      if (viewFilterChoice.dataset.viewFilter === 'leggi') views.filters.leggiPage = 1;
      saveViews(); render(store.getState(), store.getLastSaved()); return;
    }
    const billMore = event.target.closest('[data-bill-more]');
    if (billMore) {
      const key = billMore.dataset.billMore === 'archive' ? 'leggiArchivio' : 'leggiPage';
      views.filters[key] = (Number(views.filters[key]) || 1) + 1;
      saveViews(); render(store.getState(), store.getLastSaved()); return;
    }
    const priorityRemove = event.target.closest('[data-priority-remove]');
    if (priorityRemove) { const form = priorityRemove.closest('form'); const box = [...(form?.querySelectorAll('input[name="priorities"]') ?? [])].find(item => item.value === priorityRemove.dataset.priorityRemove); if (box) { box.checked = false; syncProgramForm(form); } return; }
    const outcomeClose = event.target.closest('[data-outcome-dismiss]');
    if (outcomeClose) { store.dismissOutcome(outcomeClose.dataset.outcomeDismiss); return; }
    const celebrationClose = event.target.closest('[data-celebration-dismiss]');
    if (celebrationClose) { clearTimeout(celebrationTimer); store.dismissCelebration(celebrationClose.dataset.celebrationDismiss); return; }
    // «Candidati» of a vote of the calendar: its kind of election is chosen in the setup and the player lands on it, ready to start (or sees why not).
    const campaignGoto = event.target.closest('[data-campaign-goto]');
    if (campaignGoto) {
      const current = store.getState();
      const values = { ...campaignChoices(current), 'setup.electionType': campaignGoto.dataset.campaignGoto };
      delete values['setup.role'];
      store.setCampaignPicks({ key: campaignKey(current), values });
      views.tabs.elezioni = { value: 'campagna', context: sectionContext('elezioni', store.getState()) };
      saveViews();
      if (store.getState().ui.activePage !== 'elezioni') { setHash('elezioni'); await ensurePageData('elezioni'); }
      pendingScroll = 'campaign-setup';
      playSound('click'); render(store.getState(), store.getLastSaved());
      return;
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
    // The accord of the coalition: the requests of the allies while it is negotiated, and a concession once it is in force.
    const accordControl = event.target.closest('[data-accord-answer],[data-accord-concession]');
    if (accordControl) {
      try {
        if (accordControl.dataset.accordAnswer) store.answerAccord(accordControl.dataset.accordId, accordControl.dataset.accordAnswer);
        else store.offerAccordConcession(accordControl.dataset.accordConcession);
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    // The works and the European funds of the Government.
    const dossierControl = event.target.closest('[data-dossier-action]');
    if (dossierControl) {
      try { store.dossierAction(dossierControl.dataset.dossierAction, dossierControl.dataset.dossierId); playSound('confirm'); }
      catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const worksControl = event.target.closest('[data-project-stop],[data-eu-apply],[data-eu-report]');
    if (worksControl) {
      try {
        if (worksControl.dataset.projectStop) store.stopProject(worksControl.dataset.projectStop);
        else if (worksControl.dataset.euApply) store.applyEuCall(worksControl.dataset.euApply);
        else store.reportEuCall(worksControl.dataset.euReport);
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
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
    // The internal life of the party: requests, agreements, congress, local leaders, rebuilding, founding, merging, renaming.
    const lifeControl = event.target.closest('[data-life-request],[data-life-pact-break],[data-life-cadre],[data-life-congress],[data-life-rebuild],[data-life-found],[data-life-merge],[data-life-rename]');
    if (lifeControl) {
      const data = lifeControl.dataset;
      const value = name => root.querySelector(`[data-life-field="${name}"]`)?.value?.trim() ?? '';
      try {
        if (data.lifeRequest) store.respondPartyRequest(data.lifeRequest, data.lifeChoice);
        else if (data.lifePactBreak) { const id = data.lifePactBreak; confirmThen({ kicker: 'ACCORDO INTERNO', title: 'Denunciare l’accordo?', body: 'L’area che lo aveva ottenuto perde fiducia in te e lo ricorderà: costa un punto di capitale politico.', confirmLabel: 'Denuncia', tone: 'danger' }, () => store.breakPartyPact(id)); return; }
        else if (data.lifeCadre) store.partyCadreAction({ action: data.lifeCadre, cadreId: data.cadreId ?? null, committeeId: data.lifeCadre === 'recluta' ? (data.committeeId ?? null) : null });
        else if (data.lifeCongress) store.partyCongressWork(data.lifeCongress, value(`congress-${data.lifeCongress}`) || null);
        else if (data.lifeRebuild) store.rebuildParty(data.lifeRebuild);
        else if ('lifeFound' in data) {
          const args = { label: value('found-label'), abbreviation: value('found-abbr') || null, followerIds: [...(root.querySelectorAll('[data-life-follower]') ?? [])].filter(item => item.checked).map(item => item.value) };
          confirmThen({ kicker: 'PARTITO', title: `Fondare «${args.label || 'un nuovo partito'}»?`, body: 'Lasci il partito attuale: porti con te le aree che hai scelto, i comitati che guidi, una parte di iscritti, volontari e cassa. Una parte del gruppo parlamentare ti segue. Il vecchio partito, i suoi dirigenti e i tuoi ex alleati se ne ricorderanno.', confirmLabel: 'Fonda il partito', tone: 'danger' }, () => store.foundParty(args));
          return;
        } else if (data.lifeMerge) { const id = data.lifeMerge; const unifyNames = Boolean(root.querySelector('[data-life-field="merge-unify"]')?.checked); confirmThen({ kicker: 'PARTITO', title: 'Proporre la fusione?', body: 'Iscritti, sezioni e cassa si sommano e nasce una nuova area interna; la coesione cala per qualche mese e le aree storiche temono di perdere peso.', confirmLabel: 'Fondi i partiti', tone: 'danger' }, () => store.mergeParty(id, { unifyNames })); return; }
        else if ('lifeRename' in data) {
          const args = { label: value('rename-label'), abbreviation: value('rename-abbr') || null, style: value('rename-style') || 'rilancio' };
          confirmThen({ kicker: 'IDENTITÀ', title: `Cambiare il nome in «${args.label || '…'}»?`, body: 'Costa soldi e riconoscibilità: nei sondaggi uno scossone, poi un rilancio; qualche iscritto se ne va.', confirmLabel: 'Cambia nome', tone: 'danger' }, () => store.renameParty(args));
          return;
        }
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
    const localControl = event.target.closest('[data-local-vote],[data-local-question],[data-local-concede],[data-local-tax],[data-local-withdraw],[data-ep-rapporteur],[data-ep-amend],[data-ep-role],[data-work-action],[data-work-motion]');
    if (localControl) {
      const { instId, actId } = localControl.dataset;
      try {
        if (localControl.dataset.localVote) store.castLocalVote(instId, actId, localControl.dataset.localVote);
        else if (localControl.dataset.localConcede) store.concedeLocal(instId, actId, localControl.dataset.localConcede);
        else if (localControl.dataset.localTax) store.setLocalTaxLevel(instId, localControl.dataset.localTax);
        else if (localControl.dataset.workAction) store.manageLocalWork(instId, localControl.dataset.workId, localControl.dataset.workAction);
        else if (localControl.dataset.workMotion) store.proposeLocalAct(instId, localControl.dataset.workMotion, 'mozione');
        else if ('localWithdraw' in localControl.dataset) store.withdrawLocalAct(instId, actId);
        else if ('epRapporteur' in localControl.dataset) store.bidEuropeanRapporteur(instId, actId);
        else if ('epAmend' in localControl.dataset) store.tableEuropeanAmendment(instId, actId);
        else if ('epRole' in localControl.dataset) store.runForEuropeanRole(instId);
        else store.questionLocalExecutive(instId, localControl.closest?.('[data-local-question-box]')?.querySelector?.('select[name="question-area"]')?.value || null);
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
    // The end of a career (retirement), the Hall of Fame and the legacy.
    const retireButton = event.target.closest('[data-retire]');
    if (retireButton) {
      const kind = retireButton.dataset.retire;
      const preview = store.legacyPreview();
      confirmThen({ kicker: 'FINE DELLA CARRIERA', title: kind === 'pensionamento' ? 'Andare in pensione?' : 'Lasciare la politica?', body: 'La carriera si conclude: incarichi e mandati finiscono, la partita si ferma e non si può riprendere. La tua storia entra nella Hall of Fame con la sua eredità politica, che una nuova carriera potrà raccogliere.', details: preview ? [`Eredità oggi: ${preview.score}/100 · ${preview.tier.label}`, ...preview.tags.slice(0, 3)] : [], confirmLabel: kind === 'pensionamento' ? 'Vai in pensione' : 'Lascia la politica', tone: 'danger' }, () => { const entry = store.retireCareer(kind); menu.open = true; menu.view = 'hall'; return entry; });
      return;
    }
    const hallLegacy = event.target.closest('[data-hall-legacy]')?.dataset.hallLegacy;
    if (hallLegacy) { playSound('confirm'); await openNewGame(hallLegacy); return; }
    const hallDelete = event.target.closest('[data-hall-delete]')?.dataset.hallDelete;
    if (hallDelete) { confirmThen({ kicker: 'HALL OF FAME', title: 'Eliminare questa carriera dalla Hall of Fame?', body: 'La carriera conclusa e la sua eredità spariscono dalla Hall of Fame: non si potranno più raccogliere in una nuova carriera. L’operazione non si può annullare.', confirmLabel: 'Elimina', tone: 'danger' }, () => store.removeHallEntry(hallDelete)); return; }
    // A goal of the career declared in public: a commitment with a deadline, confirmed first.
    const ambitionButton = event.target.closest('[data-ambition-declare]');
    if (ambitionButton) {
      const goalId = ambitionButton.dataset.ambitionDeclare;
      confirmThen({ kicker: 'IMPEGNO PUBBLICO', title: 'Dichiarare questo obiettivo?', body: 'Dichiarandolo in pubblico ti impegni: se lo raggiungi entro la scadenza il premio raddoppia e cresce la tua credibilità; se lo manchi paghi in reputazione e popolarità e l’impegno non mantenuto resta nella memoria politica. Costa 2 punti di capitale politico.', confirmLabel: 'Dichiara' }, () => store.declareAmbition(goalId));
      return;
    }
    const presidencyButton = event.target.closest('[data-presidency-action]');
    if (presidencyButton) {
      const action = presidencyButton.dataset.presidencyAction;
      const read = name => (presidencyButton.closest('.qr-move, li') ?? root).querySelector(`[data-presidency-field="${name}"]`)?.value ?? null;
      try {
        if (action === 'declare') store.presidentialCandidacy();
        else if (action === 'withdraw') store.presidentialWithdraw();
        else if (action === 'sponsor') store.presidentialMove('sponsor', { candidateId: presidencyButton.dataset.candidate ?? read('candidate') });
        else if (action === 'veto') store.presidentialMove('veto', { candidateId: presidencyButton.dataset.candidate ?? read('candidate') });
        else if (action === 'deal') store.presidentialMove('deal', { blocId: read('bloc'), candidateId: read('deal-candidate') });
        else if (action === 'line-blank') store.presidentialLine('bianca');
        else if (action === 'vote') store.presidentialVote(read('vote'));
        else if (action === 'activity') store.presidentActivity(presidencyButton.dataset.activity, read('region'));
        else if (action === 'senator') store.presidentLifeSenator(read('senator'));
        else if (action === 'return-law') { const lawId = presidencyButton.dataset.law; confirmThen({ kicker: 'QUIRINALE', title: 'Rinviare la legge alle Camere?', body: 'Gli effetti della legge si fermano, il governo e la maggioranza ne risentono e le Camere la rivotano tra due settimane. Si può fare una volta sola per legge.', confirmLabel: 'Rinvia la legge', tone: 'danger' }, () => store.presidentReturnLaw(lawId)); return; }
        else if (action === 'dissolve') { confirmThen({ kicker: 'QUIRINALE', title: 'Sciogliere le Camere?', body: 'Si torna al voto in anticipo. È una scelta che pesa sul credito del Presidente e che nessuno dimentica.', confirmLabel: 'Sciogli le Camere', tone: 'danger' }, () => store.presidentDissolve()); return; }
        else if (action === 'resign') { confirmThen({ kicker: 'QUIRINALE', title: 'Dimetterti da Presidente?', body: 'Lasci il Colle: il Presidente del Senato ti sostituisce e il Parlamento elegge il successore. Diventi senatore a vita di diritto.', confirmLabel: 'Dimettiti', tone: 'danger' }, () => store.presidentResign()); return; }
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const sharedAction = event.target.closest('[data-admin-shared]')?.dataset.adminShared;
    if (sharedAction) {
      try {
        if (sharedAction === 'publish') { const result = await publishSharedArchive(); admin.message = `Archivio pubblicato: ${result.parties} partiti, ${result.politicians} politici, ${result.logos} loghi.`; }
        else if (sharedAction === 'refresh') { await refreshSharedArchive(); refreshAdminOverrides(); refreshReference?.(); const sync = sharedSyncStatus(); admin.message = sync.ok ? 'Archivio condiviso aggiornato.' : `Archivio condiviso non raggiungibile (${sync.error}): resta la copia salvata${sync.copyUpdatedAt ? ` il ${String(sync.copyUpdatedAt).slice(0, 10)}` : ''}, che potrebbe non essere aggiornata.`; }
        else if (sharedAction === 'logout') { closeSharedSession(); admin.message = 'Browser scollegato dall’archivio condiviso.'; }
      } catch (error) { admin.message = error.message; }
      render(store.getState(), store.getLastSaved()); return;
    }
    const adminTarget = event.target.closest('[data-admin-tab],[data-admin-select-party],[data-admin-select-politician],[data-admin-reset-record],[data-admin-reset-field],[data-admin-unlink],[data-admin-link],[data-admin-remove-role],[data-admin-export],[data-admin-clear],[data-admin-more],[data-admin-new-party],[data-admin-cancel-new],[data-admin-hide],[data-admin-restore],[data-admin-delete]');
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
        else if (data.adminUnlink) { setRecordField('politicians', data.adminUnlink, 'partyId', null, pristineRecord('politicians', data.adminUnlink) ?? {}); adminDone('Parlamentare scollegato dal partito.'); }
        else if (data.adminLink) { const personId = root.querySelector('[data-admin-link-select]')?.value; if (!personId) throw new Error('Scegli un parlamentare da collegare.'); setRecordField('politicians', personId, 'partyId', data.adminLink, pristineRecord('politicians', personId) ?? {}); admin.linkQuery = ''; adminDone('Parlamentare collegato al partito.'); }
        else if (data.adminRemoveRole) { removeRoleOverride(admin.politicianId, data.adminRemoveRole); adminDone('Incarico rimosso.'); }
        else if ('adminExport' in data) { const url = URL.createObjectURL(new Blob([exportAdminArchive()], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `politicando-archivio-amministrativo-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); admin.message = 'Archivio esportato.'; render(store.getState(), store.getLastSaved()); }
        else if ('adminClear' in data) { confirmThen({ kicker: 'AREA AMMINISTRATIVA', title: 'Cancellare tutte le modifiche amministrative?', body: 'Correzioni, collegamenti, partiti aggiunti e nascosti di questo browser verranno cancellati' + (hasSharedSession() ? ', anche nell’archivio condiviso per tutti i giocatori.' : '.') + ' L’operazione non si può annullare: esporta prima l’archivio se vuoi conservarlo.', confirmLabel: 'Cancella tutto', tone: 'danger' }, () => { clearAdminArchive(); adminDone(hasSharedSession() ? 'Archivio svuotato anche per tutti i giocatori.' : 'Archivio amministrativo svuotato: sono tornati i dati del dataset.'); }); return; }
      } catch (error) { admin.message = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const scrollTarget = event.target.closest('[data-scroll]')?.dataset.scroll;
    // A link to a mandate opens that mandate (one is shown at a time).
    const scrollIsNav = Boolean(scrollTarget && event.target.closest('[data-scroll]').matches?.('[data-nav]'));
    if (scrollTarget?.startsWith('istituzione-')) {
      // the anchor names an institution by its id (a bare kind, from an old link, opens the latest of that kind)
      const ref = scrollTarget.slice('istituzione-'.length);
      const kind = resolveInstitution(store.getState(), ref)?.id ?? ref;
      if (territory.localInst !== kind) { territory.localInst = kind; territory.localSection = null; territory.localSeat = null; saveViews(); if (store.getState().ui.activePage === 'territori') render(store.getState(), store.getLastSaved()); }
    }
    if (scrollTarget && scrollIsNav && !globalThis.document?.getElementById?.(scrollTarget)) pendingScroll = scrollTarget;
    else if (scrollTarget) {
      const target = document.getElementById(scrollTarget);
      // A folded block of the Home opens when an action points to it (and stays open, as the player left it).
      if (target?.matches?.('details') && !target.open) target.open = true;
      const wrapper = target?.closest?.('details.hqc-fold-band');
      if (wrapper && !wrapper.open) wrapper.open = true;
      target?.scrollIntoView({ behavior: settings.motion === 'full' ? 'smooth' : 'auto', block: 'start' });
      return;
    }
    const simulationControl = event.target.closest('[data-local-seat],[data-local-inst],[data-local-section],[data-territory-measure],[data-territory-region],[data-budget-line],[data-party-priority],[data-membership-fee],[data-membership-apply],[data-real-law-more],[data-real-law-amend],[data-invest],[data-election-fund],[data-reserve],[data-reserve-release]');
    if (simulationControl) {
      const data = simulationControl.dataset;
      try {
        if (data.localInst) { territory.localInst = data.localInst; territory.localSection = null; territory.localSeat = null; saveViews(); render(store.getState(), store.getLastSaved()); }
        else if (data.localSection) { territory.localSection = data.localSection; saveViews(); render(store.getState(), store.getLastSaved()); }
        else if (data.localSeat) { territory.localSeat = territory.localSeat === data.localSeat ? null : data.localSeat; render(store.getState(), store.getLastSaved()); }
        else if (data.territoryMeasure) { territory.measure = data.territoryMeasure; render(store.getState(), store.getLastSaved()); }
        else if (data.territoryRegion) { territory.region = data.territoryRegion; render(store.getState(), store.getLastSaved()); root.querySelector('.region-detail')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }
        else if (data.budgetLine) store.setBudget(data.budgetLine, Number(data.budgetLevel));
        else if (data.partyPriority) store.setPartyPriority(data.partyPriority, Number(data.partyPriorityLevel));
        else if (data.membershipFee) store.setMembershipFee(data.membershipFee);
        else if ('membershipApply' in data) store.setMembershipFee(root.querySelector('[data-membership-custom]')?.value ?? '');
        else if (data.invest) store.invest(data.invest);
        else if (data.electionFund) store.saveForElection(Number(data.electionFund));
        else if (data.reserve) store.saveReserve(Number(data.reserve));
        else if ('reserveRelease' in data) store.takeReserve(store.getState().game.finance.reserve ?? 0);
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
    const raceAction = event.target.closest('[data-race-action]');
    if (raceAction) {
      const raceId = raceAction.dataset.raceId;
      try {
        if (raceAction.dataset.raceAction === 'confirm') {
          const value = [...root.querySelectorAll('[data-race-pick]')].find(item => item.dataset.racePick === raceId)?.value ?? 'none';
          const [kind, ...rest] = value.split(':');
          store.chooseRaceCandidate(raceId, kind === 'none' ? { kind: 'none' } : { kind, id: rest.join(':') || null }, racePeople());
          playSound('confirm');
        } else if (raceAction.dataset.raceAction === 'stand' || raceAction.dataset.raceAction === 'withdraw') {
          store.chooseRaceCandidate(raceId, raceAction.dataset.raceAction === 'stand' ? { kind: 'player' } : { kind: 'none' }, racePeople());
          playSound('confirm');
        } else if (raceAction.dataset.raceAction === 'play') {
          store.startCampaign({ electionType: raceAction.dataset.raceLevel, raceId }, realParties(), racePeople());
          playSound('confirm');
        }
      } catch (error) { store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const noticeClose = event.target.closest('[data-reward-notice-dismiss]');
    if (noticeClose) { const id = noticeClose.closest('[data-reward-notice]')?.dataset.rewardNotice; if (id) rewardsApi?.dismissNotice(id); render(store.getState(), store.getLastSaved()); return; }
    if (event.target.closest('[data-community-follow]')) { rewardsApi?.visitCommunity('instagram'); return; }   // (the link itself opens the profile; nothing is checked there)
    if (event.target.closest('[data-community-claim]')) { rewardsApi?.claimCommunity('instagram').then(() => render(store.getState(), store.getLastSaved())); return; }
    if (event.target.closest('[data-reward-video]')) {
      // The reward is given only for a video the provider confirms as completed (data/repositories/ads-rewarded.js); with no provider the button is off and this does nothing.
      rewardsApi?.ads.watch().then(result => {
        const text = { completed: 'Video completato: il tuo partito guadagna nei sondaggi', dismissed: 'Video interrotto: nessuna ricompensa', failed: 'Il video non è andato a buon fine: nessuna ricompensa', unavailable: result.reason ?? 'Video non disponibile', duplicate: 'Questo video è già stato conteggiato', busy: '' }[result.status];
        if (text) { store.getState().ui.toast = text; render(store.getState(), store.getLastSaved()); }
      }).catch(() => {});
      return;
    }
    const worldAlliance = event.target.closest('[data-world-alliance]')?.dataset.worldAlliance;
    const worldBreak = event.target.closest('[data-world-break]')?.dataset.worldBreak;
    const worldInvite = event.target.closest('[data-world-invite]')?.dataset.worldInvite ?? (event.target.closest('[data-world-invite-selected]') ? root.querySelector('[data-invite-select]')?.value : null);
    if (event.target.closest('[data-alliance-report-dismiss]')) { store.dismissAllianceReport(); return; }
    if (worldBreak && !worldAlliance && !worldInvite) {
      // Leaving an accord is told first: what it does to the relations and the polls, who stays and who leads, and what the lists already filed keep.
      const preview = store.allianceExitPreview(worldBreak);
      if (!preview) { store.getState().ui.toast = 'Alleanza non disponibile.'; render(store.getState(), store.getLastSaved()); return; }
      confirmThen({ kicker: 'ALLEANZE', title: preview.kind === 'coalizione' ? 'Uscire dalla coalizione?' : 'Rompere l’intesa?', body: `Stai per lasciare «${preview.label}». Una decisione del segretario: si può fare anche a liste depositate, ma ha delle conseguenze.`, details: preview.lines, confirmLabel: preview.kind === 'coalizione' ? 'Esci dall’accordo' : 'Rompi l’intesa' }, () => { store.breakAlliance(worldBreak); playSound('confirm'); });
      return;
    }
    if (worldAlliance || worldInvite) {
      try { if (worldInvite) store.inviteToAlliance(worldInvite); else store.proposeAlliance(worldAlliance); }
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
    // The accordions of the wizard (second-rank choices) open and shut from the draft, so that a new draw keeps them as left.
    const wizardToggle = event.target.closest('[data-wizard-toggle]')?.dataset.wizardToggle;
    if (wizard && wizardToggle) {
      event.preventDefault();
      const open = Boolean(event.target.closest('details')?.open);
      syncWizardDraft();
      wizard.open = { ...(wizard.open ?? {}), [wizardToggle]: !open };
      render(store.getState(), store.getLastSaved()); return;
    }
    const wizardAction = event.target.closest('[data-wizard-action]')?.dataset.wizardAction;
    const goto = Number(event.target.closest('[data-wizard-goto]')?.dataset.wizardGoto || 0);
    if (wizard && (wizardAction || goto)) {
      syncWizardDraft(); wizard.errors = [];
      if (wizardAction === 'cancel') cancelWizard();
      else if (wizardAction === 'export-current') { wizard.errors = wizard.lastErrors ?? []; if (store.hasCareer()) { download(store.exportSave(), `politicando-partita-${new Date().toISOString().slice(0, 10)}.json`); wizard.exported = true; } }
      else if (wizardAction === 'back') wizard.step = Math.max(1,wizard.step-1);
      else if (wizardAction === 'next') { if (!failStep()) wizard.step = Math.min(WIZARD_VIEWS,wizard.step+1); }
      else if (goto >= 1 && goto < WIZARD_VIEWS) wizard.step = goto;
      else if (wizardAction === 'finish') {
        const failing = Array.from({ length: WIZARD_VIEWS }, (_, index) => index + 1).map(step => [step, wizardStepErrors(step)]).find(([, errors]) => errors.length);
        if (failing) { wizard.step = failing[0]; wizard.errors = failing[1]; }
        else if (store.hasCareer() && !wizard.confirmedReplace) {
          const kept = store.preserveCheck();
          if (!kept.ok) { wizard.errors = [kept.message]; wizard.lastErrors = wizard.errors; wizard.blocked = true; render(store.getState(), store.getLastSaved()); return; }
          const meta = store.currentMeta();
          confirmThen({ title: 'Iniziare una nuova carriera?', body: `La carriera in corso (${meta?.player ?? 'giocatore'}, settimana ${meta?.week ?? '—'}) non sarà più quella attiva.`, details: ['Verrà salvata automaticamente in uno slot: potrai ricaricarla dal menu Carica partita. Se non si riesce a conservarla, la nuova carriera non parte e questa resta intatta.', account.user ? 'Anche la copia online nel tuo account resta disponibile.' : ''], confirmLabel: 'Inizia la nuova carriera', tone: 'primary' }, async () => { if (!wizard) return; wizard.confirmedReplace = true; await finishWizard(); });
          return;
        }
        else await finishWizard();
      }
      render(store.getState(),store.getLastSaved()); return;
    }
    if (wizard && event.target.closest('[data-poll-new-seed]')) { wizard.pollSeed = newPollSeed(); render(store.getState(), store.getLastSaved()); return; }
    if (wizard && event.target.closest('[data-poll-fit]')) { syncWizardDraft(); wizard.pollCustom = store.fitPollScenario(pollScenarioOf(wizard)); render(store.getState(), store.getLastSaved()); return; }
    if (wizard && event.target.closest('[data-poll-reset]')) { wizard.pollCustom = {}; render(store.getState(), store.getLastSaved()); return; }
    const suggestedParty = event.target.closest('[data-admin-suggest-party]');
    if (suggestedParty) {
      const select = suggestedParty.closest('form')?.querySelector('select[name="partyId"]');
      if (select) { select.value = suggestedParty.dataset.adminSuggestParty; select.dispatchEvent(new Event('change', { bubbles: true })); select.focus(); }
      admin.message = 'Partito proposto dalla lista d’elezione: premi «Salva modifiche» per confermarlo.';
      return;
    }
    if (wizard) {
      if (event.target.closest('[data-wizard-retry-data]')) { syncWizardDraft(); wizard.errors = []; await loadWizardData(); return; }
      // The avatar: every choice changes the draft and redraws the preview at once; the scroll of the screen and the focus stay where they were.
      // A ready colour for the second colour of the logo: it is written in the picker and in its value, and the preview follows.
      const logoSwatch = event.target.closest('[data-logo-secondary]');
      if (logoSwatch) { syncWizardDraft(); wizard.partyLogoSecondaryColor = logoSwatch.dataset.logoSecondary; const top = root.querySelector?.('.wizard-body')?.scrollTop ?? 0; render(store.getState(), store.getLastSaved()); const body = root.querySelector?.('.wizard-body'); if (body) body.scrollTop = top; return; }
      const avatarChoice = event.target.closest('[data-avatar-field]');
      if (avatarChoice) {
        syncWizardDraft();
        const { avatarField: field, avatarValue: value } = avatarChoice.dataset;
        wizard.avatar = normalizeAvatar({ ...wizard.avatar, [field]: value });
        wizard.errors = [];
        const top = root.querySelector?.('.wizard-body')?.scrollTop ?? 0;
        render(store.getState(), store.getLastSaved());
        const body = root.querySelector?.('.wizard-body'); if (body) body.scrollTop = top;
        root.querySelector?.(`[data-avatar-field="${field}"][data-avatar-value="${value}"]`)?.focus?.({ preventScroll: true });
        return;
      }
      const orientChip = event.target.closest('[data-party-orient]');
      if (orientChip) { syncWizardDraft(); togglePartyOrientation(wizard, orientChip.dataset.partyOrient); render(store.getState(),store.getLastSaved()); return; }
      const criterion = event.target.closest('[data-party-criterion]');
      if (criterion) { syncWizardDraft(); removePartyCriterion(wizard, criterion.dataset.partyCriterion, criterion.dataset.value); render(store.getState(),store.getLastSaved()); return; }
      if (event.target.closest('[data-wizard-show-parties]')) { syncWizardDraft(); wizard.partyListLimit = (Number(wizard.partyListLimit)||12)+12; render(store.getState(),store.getLastSaved()); return; }
      if (event.target.closest('[data-wizard-show-municipalities]')) { syncWizardDraft(); wizard.municipalityLimit = (Number(wizard.municipalityLimit)||40)+40; render(store.getState(),store.getLastSaved()); return; }
      // A comune picked from the ISTAT list becomes the starting territory (name, code, unit and region).
      const municipalityCode = event.target.closest('[data-municipality-code]')?.dataset.municipalityCode;
      if (municipalityCode) {
        syncWizardDraft();
        const territory = wizardTerritory();
        wizard.municipalityCode = municipalityCode;
        // The list of the comuni shuts once one is chosen (it opens again from “Cambia comune”).
        if (wizard.open) wizard.open = { ...wizard.open, comuni: false };
        const place = chosenPlace(wizard, territory);
        if (place) Object.assign(wizard, { municipality: place.municipality.name, region: place.region, territorialUnit: wizard.territorialUnit || '', provinceCode: place.unit.code, provinceName: place.unit.name, provinceType: place.unit.type });
        wizard.errors = []; render(store.getState(),store.getLastSaved()); return;
      }
      // How the career starts: a preset or the custom scenario, and the level of each condition (step 4).
      const startProfile = event.target.closest('[data-start-profile]')?.dataset.startProfile;
      const startLever = event.target.closest('[data-start-lever]');
      if (startProfile || startLever) {
        syncWizardDraft();
        wizard.start = chooseStart(wizard.start, { profile: startProfile ?? null, lever: startLever?.dataset.startLever ?? null, delta: Number(startLever?.dataset.startDelta) || 0 });
        wizard.errors = []; render(store.getState(),store.getLastSaved()); return;
      }
      const level = event.target.closest('[data-level]')?.dataset.level;
      const startingOffice = event.target.closest('[data-starting-office]')?.dataset.startingOffice;
      const pdcContext = event.target.closest('[data-pdc-context]')?.dataset.pdcContext;
      const mode = event.target.closest('[data-party-mode]')?.dataset.partyMode;
      const partyId = event.target.closest('[data-party-id]')?.dataset.partyId;
      const groupId = event.target.closest('[data-group-id]')?.dataset.groupId;
      const startingRole = event.target.closest('[data-starting-role]')?.dataset.startingRole;
      if (level) {
        syncWizardDraft();
        if (CAREER_LEVELS[level]?.chamber !== CAREER_LEVELS[wizard.initialLevel]?.chamber) { wizard.parliamentaryGroupId = ''; wizard.groupQuery = ''; }
        wizard.initialLevel = level; wizard.startingOffice = null; wizard.parliamentStartMode = 'real-context'; wizard.errors = []; render(store.getState(),store.getLastSaved());
      }
      else if (startingOffice) {
        syncWizardDraft();
        if (startingOffice === 'presidenteRepubblica') {
          wizard.initialLevel = 'comunale'; wizard.parliamentStartMode = 'presidential-scenario'; wizard.parliamentaryGroupId = ''; wizard.groupQuery = '';
          wizard.partyMode = 'independent'; wizard.partyId = ''; wizard.startingRole = null;
        } else {
          if (!CAREER_LEVELS[wizard.initialLevel]?.chamber || wizard.startingOffice === 'presidenteRepubblica') wizard.initialLevel = 'deputato';
          if (wizard.parliamentStartMode === 'external' || wizard.startingOffice === 'presidenteRepubblica') { wizard.parliamentStartMode = 'real-context'; wizard.parliamentaryGroupId = ''; wizard.groupQuery = ''; }
          wizard.startingRole = wizard.partyMode === 'existing' ? wizard.startingRole ?? 'militante' : null;
        }
        wizard.startingOffice = startingOffice; wizard.errors = []; render(store.getState(),store.getLastSaved());
      }
      else if (pdcContext) {
        syncWizardDraft();
        if (pdcContext === 'external') {
          wizard.initialLevel = 'deputato'; wizard.parliamentStartMode = 'external'; wizard.parliamentaryGroupId = ''; wizard.groupQuery = '';
        } else {
          const nextLevel = pdcContext === 'senato' ? 'senatore' : 'deputato';
          if (CAREER_LEVELS[nextLevel]?.chamber !== CAREER_LEVELS[wizard.initialLevel]?.chamber) { wizard.parliamentaryGroupId = ''; wizard.groupQuery = ''; }
          wizard.initialLevel = nextLevel; wizard.parliamentStartMode = 'real-context';
        }
        wizard.startingOffice = 'presidenteConsiglio'; wizard.errors = []; render(store.getState(),store.getLastSaved());
      }
      else if (groupId) { wizard.parliamentaryGroupId = groupId; wizard.errors = []; render(store.getState(),store.getLastSaved()); }
      else if (startingRole) { wizard.startingRole = startingRole; wizard.errors = []; render(store.getState(),store.getLastSaved()); }
      else if (mode) { syncWizardDraft(); wizard.partyMode = mode; wizard.startingRole = mode === 'existing' ? wizard.startingRole ?? 'militante' : null; wizard.errors = []; render(store.getState(),store.getLastSaved()); }
      else if (partyId) { wizard.partyId = partyId; wizard.errors = []; render(store.getState(),store.getLastSaved()); }
      return;
    }
    if (menu.view === 'loghi') {
      const logoParty = event.target.closest('[data-logo-party-id]')?.dataset.logoPartyId;
      if (logoParty) { clearPendingLogo(); Object.assign(logoCatalog, { selectedId: logoParty, error: '', notice: '', urlDraft: '' }); redrawLogos(); if (globalThis.matchMedia?.('(max-width: 760px)').matches) root.querySelector?.('.logo-detail')?.scrollIntoView?.({ block: 'start' }); return; }
    }
    // The phone sheet opens and closes at once, without redrawing the page.
    const sheet = root.querySelector('[data-mobile-sheet]');
    if (event.target.closest('[data-mobile-more]')) { const open = sheet.hidden; sheet.hidden = !open; event.target.closest('[data-mobile-more]').setAttribute('aria-expanded', String(open)); if (open) sheet.querySelector('.sheet-item.active, .sheet-item')?.focus?.(); return; }
    if (sheet && !sheet.hidden && (event.target.closest('[data-mobile-close]') || event.target === sheet)) { sheet.hidden = true; root.querySelector('[data-mobile-more]')?.setAttribute('aria-expanded', 'false'); return; }
    if (event.target.closest('[data-sheet-guide]')) { menu.open = true; menu.view = 'guida'; render(store.getState(), store.getLastSaved()); return; }
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      if (nav.dataset.archiveJump) archive.tab = nav.dataset.archiveJump;
      // A link into Sondaggi e media may point at one of its views (data-obs-view).
      if (nav.dataset.obsView) { views.tabs.osservatorio = { value: nav.dataset.obsView, context: sectionContext('osservatorio', store.getState()) }; saveViews(); }
      setHash(nav.dataset.nav); await ensurePageData(nav.dataset.nav); return;
    }
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
    else if (action === 'advance-to-date') {
      const target = views.filters.advanceDate || root.querySelector('[data-view-filter-select="advanceDate"]')?.value || '';
      const today = store.getState().clock.currentDate;
      if (!target || target <= today) { store.getState().ui.toast = 'Scegli una data futura.'; render(store.getState(), store.getLastSaved()); return; }
      const weeks = Math.ceil((Date.parse(target) - Date.parse(today)) / (7 * 86400000));
      askConfirm({ kicker: 'AVANZAMENTO', title: `Avanzare fino al ${formatDate(target)}?`, body: `Il tempo scorrerà settimana dopo settimana${weeks > 1 ? ` per circa ${weeks} settimane` : ''}: eventi, sondaggi, economia, partito, Parlamento, elezioni e società vanno avanti come sempre, senza saltare nulla.`, details: ['Si ferma prima di una decisione urgente, di una situazione da gestire o di una campagna in corso, a meno che tu non la deleghi allo staff.', 'Con la delega le decisioni si chiudono con la scelta predefinita e una campagna in corso prosegue senza di te.', 'Il salto non si può annullare: se vuoi un punto a cui tornare, salva prima in uno slot dal menu.'], option: 'Delega allo staff le decisioni che compaiono', confirmLabel: 'Avanza fino alla data' })
        .then(answer => { if (answer.ok) advanceToDate(target, answer.option); });
    }
    else if (action === 'menu') { menu.open = true; menu.view = 'home'; render(store.getState(), store.getLastSaved()); }
    else if (action === 'hall') { menu.open = true; menu.view = 'hall'; render(store.getState(), store.getLastSaved()); }
    else if (action === 'account') { menu.open = true; menu.view = 'account'; await refreshCloud({ info: true }); render(store.getState(), store.getLastSaved()); }
    else if (action === 'save') store.save();
    else if (action === 'export-save') { if (store.hasCareer()) download(store.exportSave(), `politicando-partita-${new Date().toISOString().slice(0, 10)}.json`); }
    else if (action === 'campaign-start') {
      try {
        const value=name=>root.querySelector(`[data-campaign-setup="${name}"]`)?.value;
        const strategy=root.querySelector('input[name="campaign-strategy"]:checked')?.value??null;
        const topic=campaignChoices(store.getState())['setup.topicId'];
        store.startCampaign({electionType:value('electionType'),objective:value('objective'),role:value('role'),strategy,topicId:value('topicId'),picks:topic?{topic,strategyTopic:topic}:null},realParties(),{politicians:realDatabase.politicians??[],groups:realDatabase.parliamentaryGroups??[]});
        views.tabs.elezioni={value:'campagna',context:sectionContext('elezioni',store.getState())}; saveViews();
      } catch(error) { store.getState().ui.toast=error.message || 'Impossibile avviare la campagna.'; render(store.getState(),store.getLastSaved()); }
    }
    else if (action === 'campaign-new') store.clearCampaign();
    else if (action === 'new-career') await openNewGame();
    else if (action === 'reset') store.reset();
    else if (action === 'retry-data' && retryData && !retryingData) { retryingData = true; render(store.getState(), store.getLastSaved()); try { await retryData(); } finally { retryingData = false; render(store.getState(), store.getLastSaved()); } }
    else if (action === 'retry-database' || action === 'retry-parliament') await ensurePageData(store.getState().ui.activePage,true);
    else if (action === 'logo-more') { logoCatalog.page++; redrawLogos(); }
    else if (action === 'logo-legacy-claim' || action === 'logo-legacy-discard') {
      const id = event.target.closest('[data-logo-legacy]')?.dataset.logoLegacy;
      try { if (action === 'logo-legacy-claim') { await claimLegacyLogo(id); logoCatalog.notice = 'Logo assegnato al tuo catalogo.'; } else { await discardLegacyLogo(id); logoCatalog.notice = 'Logo scartato.'; } logoCatalog.legacy = await listLegacyLogos(); logoCatalog.error = ''; }
      catch (error) { logoCatalog.error = error.message; }
      redrawLogos();
    }
    else if (action === 'logo-sync-now') await runLogoSync();
    else if (action === 'logo-export') await exportAllLogos();
    else if (action === 'logo-import-apply') await runLogoImport(null);
    else if (action === 'logo-import-retry') await runLogoImport(new Set((logoCatalog.archive.plan?.report?.failed ?? []).map(item => item.partyId)));
    else if (action === 'logo-import-cancel') { Object.assign(logoCatalog.archive, { plan: null, error: '', notice: '' }); redrawLogos(); }
    else if (action === 'logo-restore-replaced') await restoreReplaced();
    else if (action === 'logo-guest-import') {
      const id = event.target.closest('[data-logo-guest]')?.dataset.logoGuest;
      try { await importGuestLogo(id); logoCatalog.notice = 'Logo copiato nel tuo account: viene caricato online.'; logoCatalog.error = ''; await refreshLogoExtras(); scheduleLogoSync(); } catch (error) { logoCatalog.error = error.message; }
      redrawLogos();
    }
    else if (action === 'logo-conflict-local' || action === 'logo-conflict-remote') {
      const id = event.target.closest('[data-logo-conflict]')?.dataset.logoConflict;
      try { await resolveLogoConflict(id, action === 'logo-conflict-local' ? 'local' : 'remote'); logoCatalog.notice = action === 'logo-conflict-local' ? 'Hai tenuto il logo di questo dispositivo: ora è anche online.' : 'Hai tenuto il logo del tuo account: ha sostituito quello di questo dispositivo.'; logoCatalog.error = ''; await refreshLogoExtras(); }
      catch (error) { logoCatalog.error = error.message; }
      redrawLogos();
    }
    else if (action === 'logo-save') await saveStagedLogo();
    else if (action === 'logo-cancel') { clearPendingLogo(); Object.assign(logoCatalog, { error: '', notice: '', urlDraft: '' }); redrawLogos(); }
    else if (action === 'logo-delete') {
      const id = logoCatalog.selectedId, entity = logoEntities().find(item => item.id === id);
      if (id && logoInfo(id)) confirmThen({ title: 'Eliminare il logo?', body: `Il tuo logo di «${entity?.name ?? 'questo partito'}» verrà eliminato da questo dispositivo${account.user ? ' e dal tuo account online' : ''}. Il gioco tornerà a usare il segno originale con la sigla e i colori del partito.`, confirmLabel: 'Elimina il logo', tone: 'danger' }, async () => {
        try { await deleteLogo(id); clearPendingLogo(); Object.assign(logoCatalog, { error: '', notice: account.user ? 'Logo eliminato da questo dispositivo: la copia online viene eliminata alla prossima sincronizzazione.' : 'Logo eliminato da questo dispositivo.' }); scheduleLogoSync(); } catch (error) { logoCatalog.error = error.message; }
        redrawLogos();
      });
    }
  });
  root.addEventListener('submit', async event => {
    const form = event.target;
    if (form.matches('[data-staff-form],[data-staff-edit-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const editing = form.matches('[data-staff-edit-form]');
      try {
        const spec = { weeks: Number(data.weeks), weeklyBudget: Number(data.weeklyBudget), budgetMax: Number(data.budgetMax), objective: Number(data.objective), target: data.target || null };
        if (editing) { store.changeStaffMandate(form.dataset.mandateId, spec); playSound('confirm'); }
        else {
          const task = STAFF_TASK_BY_ID[form.dataset.task];
          confirmThen({ kicker: 'STAFF', title: `Affidare «${task.label}» allo staff?`, body: 'Lo staff lavorerà da solo a ogni chiusura di settimana, con il budget che indichi; potrai modificare, sospendere o annullare l’incarico in qualsiasi momento. Non include mai voti, candidature, accordi o scelte irreversibili.',
            details: [`Durata: ${spec.weeks === 1 ? 'una volta' : `${spec.weeks} settimane`}.`, `Budget: ${spec.weeklyBudget} € a settimana, fino a ${spec.budgetMax} € in totale (si paga solo quando lo staff lavora).`, `Obiettivo: ${spec.objective} ${task.unit}.`, `Competenza richiesta: ${task.skill} (almeno ${task.minSkill}/100).`, 'Il risultato non è garantito: dipende dalle competenze dello staff e dal caso.'], confirmLabel: 'Affida l’incarico' },
            () => { store.giveStaffMandate({ ...spec, task: task.id, approved: true }); playSound('confirm'); });
          return;
        }
      } catch (error) { store.getState().ui.toast = error.message; }
      render(store.getState(), store.getLastSaved());
      return;
    }
    if (form.matches('[data-account-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const mode = form.dataset.accountForm;
      account.error = ''; account.message = ''; account.unreachable = false;
      if (mode === 'delete') {
        account.busy = 'delete'; render(store.getState(), store.getLastSaved());
        try {
          const result = await deleteAccount(data.password, data.confirm);
          syncEngine.forget(result?.username ?? account.user?.username); account.user = null; account.saves = []; account.conflict = null; account.conflicts = []; account.currentSlot = null;
          account.message = `Account eliminato: online non resta nulla (${result.deleted?.saves ?? 0} salvataggi e ${result.deleted?.sessions ?? 0} sessioni rimossi). Le partite salvate in questo browser restano sul dispositivo.`;
        } catch (error) { account.error = error.message; if (['offline', 'timeout'].includes(error.code) || error.status >= 500) setAccountStatus('unreachable'); }
        account.busy = false;
        render(store.getState(), store.getLastSaved()); return;
      }
      // the online account is for people of at least 14 (art. 2-quinquies of the Italian privacy code); the answer is never stored or sent. Younger players keep playing on the device, without an account.
      if (mode === 'register' && data.ageBand !== 'adult14') { account.error = data.ageBand === 'under14' ? 'L’account online è riservato a chi ha almeno 14 anni: per i più piccoli non è ancora prevista una procedura di consenso dei genitori. Puoi giocare lo stesso: la partita resta sul tuo dispositivo, senza account e senza inviare nulla ai nostri server.' : 'Indica la tua età per creare l’account.'; render(store.getState(), store.getLastSaved()); return; }
      if ((mode === 'register' || mode === 'reset') && data.password !== data.confirm) { account.error = 'Le due password non coincidono.'; render(store.getState(), store.getLastSaved()); return; }
      account.busy = mode; render(store.getState(), store.getLastSaved());
      try {
        if (mode === 'recover') {
          const answer = await accountApi.requestPasswordRecovery(data.email);
          account.message = answer.message ?? 'Se l’indirizzo è collegato a un account con email verificata, riceverai un messaggio.';
        } else if (mode === 'reset') {
          if (!account.reset) throw new Error('Il collegamento non è più valido: chiedine uno nuovo.');
          await accountApi.resetPassword(account.reset.token, account.reset.username, data.password);
          account.message = 'Password cambiata: accedi con la nuova password. Le sessioni aperte sono state chiuse.'; account.reset = null; account.mode = 'login';
        } else if (mode === 'email') {
          const answer = await accountApi.addEmail(data.email, data.password);
          account.message = answer.message ?? 'Indirizzo salvato.'; account.info = await accountApi.accountInfo().catch(() => account.info);
        } else if (mode === 'resend') {
          const answer = await accountApi.resendVerification(data.password);
          account.message = answer.message ?? 'Messaggio inviato.';
        } else {
          if (mode === 'register') await register(data.username, data.password, { email: data.email }); else await login(data.username, data.password);
          account.user = currentAccount();
          setAccountStatus('available');
          account.message = mode === 'register' ? 'Account creato: le carriere che collegherai a questo account si salvano anche online.' : `Bentornato, ${account.user.username}.`;
          markOnboarding({ account: true });
          await refreshCloud({ info: true });
          // The careers of this account come back: the last one of this device if it is the account's, the others in the lists, the online ones read again from the server.
          try { store.resumeLastCareer(id => !careerBlocked(id)); } catch (error) { account.error = error.message; }
          await refreshLogoScope();
          // The career being played is NOT put online here: it joins the account only if it already belongs to it, or if the player chooses (the account screen asks). What was left
          // by the previous session never goes into the account that has just signed in.
          if (store.hasCareer()) {
            const careerId = careerIdNow(), owner = accountApi.ownerOf(careerId);
            if (owner === account.user.username) { queueAfterSave(); }
            else account.message += owner ? ` La carriera in corso è collegata all’account «${owner}»: non è stata caricata qui.` : ' La carriera in corso è solo su questo dispositivo: la porti online tu, dall’account.';
            if (store.saveStatus().dirty) account.message += ' La partita in corso ha modifiche non salvate: salvala per portarla online.';
          }
          syncEngine.resume();
          const wanted = menu.needAccount;
          menu.needAccount = false;
          account.busy = false;
          // After the language and the account of a first installation the player lands on the home, with no tour or pop-up in between (the guide stays in the menu)
          if (menu.firstRun) { menu.firstRun = false; menu.view = 'home'; menu.error = ''; account.message = ''; }
          else if (mode === 'register' && onboarding().tour !== 'done') { menu.view = 'tour'; menu.tourStep = 0; menu.reveal = true; }
          else if (wanted) { await openNewGame(); return; }
        }
      } catch (error) { account.error = error.message; if (['offline', 'timeout'].includes(error.code) || error.status >= 500) setAccountStatus('unreachable'); else if (error.status) setAccountStatus('available'); }
      account.busy = false;
      render(store.getState(), store.getLastSaved()); return;
    }
    if (form.matches('[data-admin-credential-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try { await rotateSharedCredential({ currentPin: data.currentPin, newPin: data.newPin }); form.reset(); admin.message = 'Credenziale sostituita: le altre sessioni amministrative sono state chiuse.'; }
      catch (error) { admin.message = error.message; }
      render(store.getState(), store.getLastSaved()); return;
    }
    if (form.matches('[data-admin-shared-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try { await openSharedSession(data.pin, data.setupCode ?? ''); await refreshSharedArchive(); refreshAdminOverrides(); refreshReference?.(); admin.message = 'Accesso del proprietario verificato: le modifiche vengono pubblicate per tutti.'; await ensurePageData('amministrazione', true); }
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
          admin.creating = false; admin.partyId = id; admin.partyFilter = 'tutti';
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
    if (form.matches('[data-logo-url-form]')) { event.preventDefault(); await stageLogoUrl(new FormData(form).get('url')); return; }
    if (form.matches('[data-law-proposal-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      const reference = (realDatabase.laws ?? []).find(item => item.id === data.get('realReference'));
      try { store.proposeLaw({ title: data.get('title'), policy: designFromForm(form), summary: data.get('summary'), realReference: reference ? { id: reference.id, label: reference.lawNumber ? `legge n. ${reference.lawNumber} del ${reference.lawDate}` : reference.officialTitle.slice(0, 120), officialTitle: reference.officialTitle, lawNumber: reference.lawNumber, lawDate: reference.lawDate, status: reference.status, sourceUrl: reference.sourceUrl, source: 'real', verified: true } : null }); }
      catch (error) { store.getState().ui.toast = error.message; render(store.getState(),store.getLastSaved()); }
    } else if (form.matches('[data-local-propose-form],[data-local-reshuffle-form],[data-ep-committee-form],[data-local-work-form],[data-work-funding-form],[data-work-cofin-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      try {
        if (form.matches('[data-local-propose-form]')) { const [category, variant] = String(data.get('category') ?? '').split('|'); store.proposeLocalAct(form.dataset.instId, data.get('area'), category || null, variant || null); }
        else if (form.matches('[data-ep-committee-form]')) store.requestEuropeanCommittee(form.dataset.instId, data.get('committee'));
        else if (form.matches('[data-local-work-form]')) store.proposeLocalWork(form.dataset.instId, data.get('type'), { funding: Number(data.get('funding')), site: data.get('site') });
        else if (form.matches('[data-work-cofin-form]')) store.requestWorkCofin(form.dataset.instId, form.dataset.workId, data.get('partner'), Number(data.get('share')));
        else if (form.matches('[data-work-funding-form]')) store.manageLocalWork(form.dataset.instId, form.dataset.workId, 'funding', Number(data.get('funding')));
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
    } else if (form.matches('[data-government-program-form],[data-government-review-form],[data-government-table-form],[data-policy-form],[data-budget-form],[data-reshuffle-form],[data-party-program-form]')) {
      event.preventDefault();
      const data = new FormData(form);
      try {
        if (form.matches('[data-government-program-form]')) {
          const picked = data.getAll('priorities');
          if (picked.length < 2 || picked.length > 5) { syncProgramForm(form); form.querySelector('[data-priority-error]')?.scrollIntoView?.({ block: 'nearest' }); return; }   // (the page says why; nothing is saved or removed)
          store.setGovernmentProgram({ line: data.get('line'), priorities: picked });
        }
        else if (form.matches('[data-government-review-form]')) store.reviewSpending({ level: data.get('level'), protect: data.get('protect') || null });
        else if (form.matches('[data-government-table-form]')) store.holdSocialTable({ segmentId: data.get('segment'), areaId: data.get('area') || null, incentive: data.get('incentive') === 'on' });
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
    } else if (form.matches('[data-project-form],[data-project-funding-form]')) {
      event.preventDefault();
      try {
        if (form.matches('[data-project-form]')) store.proposeProject(requestFromForm(form));
        else store.setProjectFunding(form.dataset.projectId, new FormData(form).get('funding'));
        playSound('confirm');
      } catch (error) { playSound('failure'); store.getState().ui.toast = error.message; render(store.getState(), store.getLastSaved()); }
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
    element.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(element.open));
    if (element.dataset.autoToggle) { delete element.dataset.autoToggle; return; }
    // In “Altro” one group is open at a time; while searching the groups open on their own and nothing is remembered.
    if (element.matches('[data-sheet-group]')) {
      if (root.querySelector('[data-sheet-search]')?.value.trim()) return;
      if (element.open) for (const other of root.querySelectorAll('[data-sheet-group]')) if (other !== element && other.open) other.open = false;
    }
    views.open = { ...(views.open ?? {}), [element.dataset.remember]: element.open };
    saveViews();
  }, true);
  // The search box of “Altro” filters its pages in place, without redrawing anything.
  root.addEventListener('input', event => {
    const guideBox = event.target.closest?.('[data-guide-search]');
    if (guideBox) {
      const fold = text => text.toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const query = fold(guideBox.value.trim());
      let shown = 0;
      for (const card of root.querySelectorAll('[data-guide-card]')) {
        const match = !query || fold(card.textContent).includes(query);
        card.hidden = !match; shown += match ? 1 : 0;
        const link = root.querySelector(`[data-guide-index="${card.dataset.guideCard}"]`);
        if (link) link.hidden = !match;
      }
      const empty = root.querySelector('[data-guide-empty]'); if (empty) empty.hidden = Boolean(shown);
      return;
    }
    const box = event.target.closest?.('[data-sheet-search]');
    if (!box) return;
    const sheet = box.closest('[data-mobile-sheet]');
    const query = box.value.trim().toLocaleLowerCase('it');
    const fold = text => text.toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let shown = 0;
    if (query) for (const group of sheet.querySelectorAll('[data-sheet-group]')) group.dataset.wasOpen ??= group.open ? '1' : '0';
    for (const group of sheet.querySelectorAll('[data-sheet-group]')) {
      let any = 0;
      for (const item of group.querySelectorAll('.sheet-item')) {
        const match = !query || fold(`${item.dataset.sheetLabel} ${group.querySelector('strong').textContent}`).includes(fold(query));
        item.hidden = !match; any += match ? 1 : 0;
      }
      group.hidden = !any; shown += any;
      if (query) group.open = Boolean(any);
    }
    sheet.querySelector('[data-sheet-empty]').hidden = Boolean(shown);
    if (!query) {
      for (const group of sheet.querySelectorAll('[data-sheet-group]')) { group.open = group.dataset.wasOpen === '1'; delete group.dataset.wasOpen; }
    }
  });
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
    if (field.matches?.('.admin-color input[type="color"]')) { const off = field.closest('.admin-color')?.querySelector('input[type="checkbox"]'); if (off) off.checked = false; return; }
    if (logoEditor && field.matches?.('input[type="range"][data-logo-edit]')) { logoEditor[field.dataset.logoEdit] = Number(field.value); drawLogoEditor(root, logoEditor, logoEditorImage); return; }
    if (field.closest?.('[data-policy-fields]') || field.closest?.('[data-budget-form]') || field.closest?.('[data-project-form]') || field.closest?.('[data-project-funding-form]')) { refreshPolicyPreview(field.closest('form'), field); return; }
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
    if (field.matches('[data-logo-query]')) { logoCatalog.query = field.value; logoCatalog.page = 1; preserveFocusRender('[data-logo-query]'); return; }
    if (!wizard || !field.matches('.career-wizard [name]')) return;
    if (field.name === 'professionChoice') { chooseProfession(field); return; }
    if (field.name === 'partyProgram' || field.name === 'partyLogoMode') { syncWizardDraft(); if (field.name === 'partyLogoMode') render(store.getState(), store.getLastSaved()); return; }
    if (field.type === 'file') return;
    if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
    else if (field.name.startsWith('poll_')) (wizard.pollCustom ??= {})[field.name.slice(5)] = field.value;
    else wizard[field.name] = field.value;
    if (field.type === 'color') { const hexBox = field.closest('.color-input-wrap')?.querySelector('span'); if (hexBox) hexBox.textContent = field.value; }
    if (field.name === 'partyLogoSecondaryColor') root.querySelectorAll?.('[data-logo-secondary]').forEach(button => { const same = button.dataset.logoSecondary.toLowerCase() === String(field.value).toLowerCase(); button.classList.toggle('selected', same); button.setAttribute('aria-pressed', String(same)); });
    if (/^partyLogo|^partyColor|^partyAbbreviation/.test(field.name)) updateWizardLogo();
    if (field.name === 'difficulty') { render(store.getState(), store.getLastSaved()); return; }
    // The opening poll: a mode (a random mode always has a seed), a seed typed or a written share redraw the table, keeping the focus where it was.
    if (field.name === 'pollMode') { if (field.value === 'casuale' && !wizard.pollSeed) wizard.pollSeed = newPollSeed(); wizard.open = { ...(wizard.open ?? {}), poll: field.value !== 'realistico' }; render(store.getState(), store.getLastSaved()); return; }
    if (field.name === 'pollSeed' || field.name.startsWith('poll_')) { preserveFocusRender(`[name="${field.name.replace(/"/g, '')}"]`); return; }
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
    if (field.name === 'professionChoice') { chooseProfession(field); return; }
    // The check box of the weekly pop-up is the «Popup notizie settimanali» setting itself (saved for the signed-in account): it switches the automatic pop-ups off or on at once; the one on screen
    // stays readable and closes as usual; the news keep being made and kept.
    if (field.matches?.('[data-news-popup-optout]')) {
      const off = Boolean(field.checked);
      settings = saveSetting('newsPopup', off ? 'off' : 'on', settingsScope());
      if (!off) newsPopupHoldWeek = store.getState().game?.week?.index ?? null;
      render(store.getState(), store.getLastSaved());
      root.querySelector?.('[data-news-popup-optout]')?.focus?.({ preventScroll: true });
      return;
    }
    if (field.matches?.('[data-government-program-form] input[name="priorities"]')) { syncProgramForm(field.form); return; }
    // The campaign's selects: the choice is kept for the next redraws (another electoral model restarts the roles).
    const campaignPick = field.matches?.('[data-campaign-setup]') ? `setup.${field.dataset.campaignSetup}` : CAMPAIGN_PICKS.find(([selector]) => field.matches?.(selector))?.[1];
    if (campaignPick) { const current = store.getState(); const values = { ...campaignChoices(current), [campaignPick]: field.value }; if (campaignPick === 'setup.electionType') delete values['setup.role']; store.setCampaignPicks({ key: campaignKey(current), values }); }
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
    if (field.matches('[data-view-filter-text]')) { views.filters[field.dataset.viewFilterText] = field.value.slice(0, 60); saveViews(); render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-view-filter-select]')) {
      views.filters[field.dataset.viewFilterSelect] = field.value;
      // the territory chosen to found a committee is a chain: a new region clears the province and the comune, a new province the comune
      if (field.dataset.viewFilterSelect === 'found-region') { delete views.filters['found-unit']; delete views.filters['found-municipality']; }
      if (field.dataset.viewFilterSelect === 'found-unit') delete views.filters['found-municipality'];
      saveViews(); render(store.getState(), store.getLastSaved()); return;
    }
    if (field.matches('[data-local-search]')) { territory.localQuery = field.value.slice(0, 60); saveViews(); render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-hemi-filter]')) { views.hemicycle[field.dataset.hemiFilter] = field.dataset.hemiFilter === 'q' ? field.value.slice(0, 60) : field.value; views.hemicycle.limit = 40; if (field.dataset.hemiFilter === 'vote') views.hemicycle.selected = null; saveViews(); render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-admin-chamber]')) { admin.chamber = field.value; admin.listPage = 1; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-real-law-filter]') && field.dataset.realLawFilter !== 'query') { realLaws[field.dataset.realLawFilter] = field.value; realLaws.page = 1; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-wizard-logo-upload]') && wizard) {
      const file = field.files?.[0]; if (!file) return;
      try {
        wizard.partyLogoBlob = (await prepareLogo(file)).blob;
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
        try { await store.preserveCurrent(); store.loadGame(text, 'Partita importata'); menu.open = false; menu.error = ''; playSound('success'); await enterHome(); }
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
    if (field.matches('[data-wizard-party-facet]')) { syncWizardDraft(); wizard.partyListLimit=12; render(store.getState(),store.getLastSaved()); return; }
    if (field.matches('[data-wizard-party-filter]')) { syncWizardDraft(); wizard.partyListLimit=12; preserveFocusRender('[data-wizard-party-filter]'); return; }
    // Another region (or province) means another list of comuni: the choice starts again there.
    if (field.matches('[data-wizard-region]') && wizard) { Object.assign(wizard, { region: field.value, territorialUnit: '', municipality: '', municipalityCode: '', municipalityQuery: '', municipalityLimit: 40, provinceCode: '', provinceName: '', provinceType: '', errors: [] }); render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-wizard-unit]') && wizard) { wizard.territorialUnit = field.value; wizard.municipalityLimit = 40; render(store.getState(), store.getLastSaved()); return; }
    if (field.matches('[data-logo-file]')) { const file = field.files?.[0]; field.value = ''; if (file) await stageLogoFile(file); return; }
    if (field.matches('[data-logo-import-file]')) { const file = field.files?.[0]; field.value = ''; if (file) await reviewLogoArchive(file); return; }
    if (field.matches('input[name="logo-import-policy"]') && logoCatalog.archive.plan) { logoCatalog.archive.plan.policy = field.value; redrawLogos(); return; }
    if (field.matches('[data-logo-import-decision]') && logoCatalog.archive.plan) { const id = field.dataset.logoImportDecision; if (field.value) logoCatalog.archive.plan.decisions[id] = field.value; else delete logoCatalog.archive.plan.decisions[id]; return; }
  });
  // In the logo catalog an image (or an address) can be pasted from the clipboard, or dropped on the page of the selected party.
  root.addEventListener('paste', event => {
    if (menu.view !== 'loghi' || !logoCatalog.selectedId) return;
    const file = [...(event.clipboardData?.files ?? [])].find(item => item.type.startsWith('image/'));
    if (file) { event.preventDefault(); stageLogoFile(file); return; }
    if (event.target.matches?.('[data-logo-url]')) { const text = event.clipboardData?.getData('text')?.trim(); if (text) { event.preventDefault(); event.target.value = text; stageLogoUrl(text); } }
  });
  root.addEventListener('dragover', event => { if (menu.view === 'loghi' && event.target.closest?.('[data-logo-drop]')) event.preventDefault(); });
  root.addEventListener('drop', event => {
    if (menu.view !== 'loghi' || !event.target.closest?.('[data-logo-drop]')) return;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) stageLogoFile(file);
  });
  root.addEventListener('click', event => {
    const more = event.target.closest('[data-catalog-more]')?.dataset.catalogMore;
    if (more) { catalog[more]++; updateCatalog(); }
  });
  store.subscribe(render);
  // The rewards of time played: the clock counts only with a career open, the page in the foreground and this tab holding the lease; the page «Ricompense» is patched live, not drawn again every second.
  const rewards = createRewardsService({ store, username: () => account.user?.username ?? null, claimDaily: (careerId, device) => accountApi.claimDailyReward(careerId, device), syncTime: body => accountApi.syncRewardTime(body), claimBlocks: body => accountApi.claimRewardBlocks(body), claimCommunity: (reward, careerId, device) => accountApi.claimCommunityReward(reward, careerId, device), env: { playing: () => !menu.open && !wizard } });
  rewardsApi = rewards;
  rewards.onChange(() => {
    // a new notice (or the end of one) redraws the screen; otherwise only the page of the rewards is patched while it is open
    if (rewards.notices().map(item => item.id).join('|') !== shownNotices) { render(store.getState(), store.getLastSaved()); return; }
    if (store.getState().ui.activePage === 'ricompense' && !patchRewardsPage(root, rewards.snapshot())) render(store.getState(), store.getLastSaved());
  });
  rewards.start();
  // First opening without an account (and the account service reachable): the welcome screen explains the account
  // and leads to it before the first career. Players already signed in are never asked again.
  // A first installation (no language chosen, nothing done here before) starts with the language: before every account screen.
  const languageChosen = () => { try { return ['it', 'en'].includes(JSON.parse(localStorage.getItem('politicando.settings.v1') ?? '{}')?.language); } catch { return false; } };
  const usedBefore = () => Boolean(account.user) || onboarding().account === true || onboarding().localStart === true || onboarding().tour === 'done' || store.hasCareer() || (() => { try { return Object.keys(JSON.parse(localStorage.getItem('politicando.slots.v1') ?? '{}') ?? {}).length > 0; } catch { return false; } })();
  if (!languageChosen() && !usedBefore()) { menu.open = true; menu.view = 'lingua'; render(store.getState(), store.getLastSaved()); root.querySelector?.('[data-language-choice]')?.focus?.(); }
  else if (!account.user && account.status !== 'none' && !onboarding().account && !menu.localStart && menu.open) { menu.view = 'benvenuto'; menu.reveal = true; render(store.getState(), store.getLastSaved()); }
  // The account service is asked once at the opening (players already signed in find out at their first sync).
  if (account.status === 'checking') probeAccount();
  // Escape closes the confirmation dialog (it means “Annulla”).
  globalThis.addEventListener?.('keydown', event => { if (event.key === 'Escape' && !pendingConfirm && pendingOutcome(store.getState().game)) store.dismissOutcome(); else if (event.key === 'Escape' && !pendingConfirm && views.filters.recruitOpen) { delete views.filters.recruitOpen; delete views.filters.recruitPick; saveViews(); render(store.getState(), store.getLastSaved()); } else if (event.key === 'Escape' && pendingConfirm) settleConfirm(false); else if (event.key === 'Escape' && wizard) { cancelWizard(); render(store.getState(), store.getLastSaved()); } else if (event.key === 'Escape' && menu.open && closeMenuPopup()) render(store.getState(), store.getLastSaved()); else if (event.key === 'Escape' && newsPopup) { newsPopup = null; render(store.getState(), store.getLastSaved()); } });
  // The tabs of the institutions (mandates and sections) move with the arrow keys, as tabs do.
  // The areas of the geographic map are buttons: Enter or Space picks one, as a tap does.
  root.addEventListener?.('keydown', event => {
    const area = event.target?.closest?.('[data-map-area]');
    if (area && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); area.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });
  root.addEventListener?.('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tab = event.target.closest?.('.local-tabs [role="tab"], .local-jump [role="tab"]');
    if (!tab) return;
    const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
    const at = tabs.indexOf(tab);
    const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    event.preventDefault();
    next?.click();
  });
  // Every local save that went through is followed by an online save of the same career (debounced), when the player has an account. What counts is how the
  // save really stands (a write that succeeded, nothing left unsaved), never the message on screen.
  // Closing the page while a save failed or is still being confirmed would lose the career that exists only in memory: the browser asks first.
  globalThis.addEventListener?.('beforeunload', event => { const status = store.saveStatus(); if (store.hasCareer() && (!status.ok || status.pending)) { event.preventDefault(); event.returnValue = ''; } });
  let savedSeen = store.saveStatus().seq;
  store.subscribe(() => { const status = store.saveStatus(); if (status.seq !== savedSeen) { savedSeen = status.seq; if (status.ok && !status.dirty) scheduleSync(); } });
  // The network is back, the page is shown again, another tab signed in or out: the queue takes up what is written down (always after reading the version online again).
  globalThis.addEventListener?.('online', () => { if (account.user) syncEngine.flush(); });
  // The logos of the account follow the same moments (and one more: a signed-in page that stays open asks again every few minutes, so that what another device changed arrives).
  globalThis.document?.addEventListener?.('visibilitychange', () => { if (!globalThis.document.hidden && account.user) { syncEngine.resume(); runLogoSync(); } });
  const logoPoll = setInterval(() => { if (account.user && !globalThis.document?.hidden && globalThis.navigator?.onLine !== false) runLogoSync(); }, 5 * 60 * 1000);
  logoPoll?.unref?.();
  globalThis.addEventListener?.('storage', event => {
    if (event.key !== 'politicando.account.v1') return;
    const before = account.user?.username ?? null;
    account.user = currentAccount();
    if ((account.user?.username ?? null) !== before) { refreshLogoScope(); syncEngine.stop(); account.saves = []; account.conflicts = []; account.conflict = null; account.info = null; account.history = null; account.currentSlot = null; account.message = account.user ? `In un’altra scheda hai effettuato l’accesso come ${account.user.username}.` : 'In un’altra scheda sei uscito dall’account.'; if (account.user) { refreshCloud().then(() => render(store.getState(), store.getLastSaved())); syncEngine.resume(); } refreshLogoScope(); reconcileCareers(); }
  });
  if (account.user) {
    refreshCloud().then(() => { render(store.getState(), store.getLastSaved()); });
    // (the logos of the account are read again at every start with a session, not only when the catalog is opened)
    refreshLogoScope();
    // What was written down before the page was closed: taken up now, after the version online has been read again.
    syncEngine.resume();
  }
  // The links of the messages (confirm the address, choose a new password) open the game on the account screen; the code in the address is taken out of the URL at once.
  {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const resetToken = params.get('reimposta-password'), verifyToken = params.get('verifica-email');
    if (resetToken || verifyToken) {
      try { globalThis.history?.replaceState?.(null, '', `${globalThis.location.pathname}${globalThis.location.hash ?? ''}`); } catch { /* the code stays in the address; it works once anyway */ }
      menu.open = true; menu.view = 'account'; account.mode = resetToken ? 'reset' : 'login';
      if (resetToken) accountApi.checkResetToken(resetToken).then(answer => { account.reset = { token: resetToken, username: answer.username }; render(store.getState(), store.getLastSaved()); }).catch(error => { account.error = linkError = error.message; account.mode = 'recover'; render(store.getState(), store.getLastSaved()); });
      else accountApi.verifyEmail(verifyToken).then(answer => { account.message = answer.message ?? 'Indirizzo email verificato.'; return account.user ? accountApi.accountInfo().then(info => { account.info = info; }) : null; }).catch(error => { account.error = error.message; }).finally(() => render(store.getState(), store.getLastSaved()));
    }
  }
  attachChartInteractions(root);
  // The URL hash mirrors the section, so links and the back button land on the same page; opening the game (behind
  // the main menu) starts from the Home, never from the last page visited.
  const initialPage = 'panoramica';
  setHash(initialPage, true);
  globalThis.addEventListener?.('hashchange', () => {
    const page = pageFromHash();
    // #comune, #provincia and #regione open that institution in Territori.
    const kind = decodeURIComponent(globalThis.location?.hash?.replace(/^#\/?/, '') ?? '');
    if (LOCAL_KIND_LABELS[kind]) { territory.localInst = resolveInstitution(store.getState(), kind)?.id ?? kind; territory.localSection = null; territory.localSeat = null; saveViews(); }
    if (page && page !== store.getState().ui.activePage) ensurePageData(page);
  });
  render(store.getState(),store.getLastSaved());
  migrateLegacyLogos().catch(() => {}).finally(() => loadLogos().then(() => render(store.getState(), store.getLastSaved())).catch(() => {}));
  ensurePageData(initialPage,true);
  // The real parliamentarians of a career already saved are loaded now, as before; without a career the menu does not need them (a career that is created or entered asks for them when it opens).
  if (store.hasCareer()) refreshContacts();
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
// What the observatory of the polls (Sondaggi e media, and the race of the campaign in Elezioni → Sondaggi e avversari) asks of the app: logos by id, the verified leaders of the real parties, who can decide
// the alliances and with which odds, when they can change, what kind of entity each force is, and the panel of the media.
function observatoryOptions(state, options) {
  const logoFor = id => { const record = options.findParty?.(id); return record ? options.logoFor?.(record) : null; };
  // Only what is not a plain party is named: a movement, a list of several parties (AVS), a party of the player.
  const kindOf = id => forceKind(options.findParty?.(id), options.findParty);
  return { view: options.tabFor?.('osservatorio', state), institute: options.tabFor?.('osservatorio-istituto', state), filters: options.views?.filters, logoFor, realLeader: options.realLeader, secretary: playerRoles(state).secretary, allianceOdds: options.allianceOdds, inviteOdds: options.inviteOdds, inviteBlock: options.inviteBlock, allianceBlock: options.allianceBlock, window: options.allianceWindow, kindOf, geography: options.electoralGeography ?? null, media: state.society ? () => renderMediaPanel(state) : null };
}
function subpage(state, page, player, party, events, catalog, options = {}) {
  const personalStats = state.dataset.statistics.filter(item => item.subjectId === player?.id);
  const profileMetrics = [['popularity', 'Popolarità'], ['reputation', 'Reputazione'], ['consensus', 'Consenso'], ['experience', 'Esperienza'], ['influence', 'Influenza'], ['notoriety', 'Notorietà']].map(([metric, label]) => { const record = personalStats.find(item => item.metric === metric) ?? (metric === 'consensus' ? state.dataset.statistics.find(item => item.metric === metric && item.subjectId === party?.id) : null); return `<div><span>${label}</span><strong>${record ? `${String(record.value).replace('.', ',')}${record.unit === '%' ? '%' : ''}${record.unit === '%' ? '' : '<small> / 100</small>'}` : '—'}</strong></div>`; }).join('');
  const catalogStatus = { loading: catalog.loadingPage === state.ui.activePage, error: catalog.errors[state.ui.activePage] ?? '' };
  const listContents = {
    amministrazione: renderAdminPanel(options.admin, options.adminContext()),
    territori: renderTerritoriesPage(state, { ...options.territory, deputies: deputiesByRegion(realDatabase.politicians ?? []) }),
    finanze: renderFinancePage(state),
    ricompense: renderRewardsPage(state, options.rewards?.() ?? null),
    parlamento: renderParliamentPage('parlamento', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [], hemicycle: state.parliament ? renderHemicycle(state, { politicians: realDatabase.politicians ?? [], db: realDatabase, view: options.views?.hemicycle, logoFor: options.logoFor }) : '', featured: state.parliament ? renderFeaturedMembers(state, realDatabase, options.views?.hemicycle) : '' }) + `<section class="hq-panel contacts-panel"><div class="home-section-heading"><div><span class="section-kicker">${state.parliament?.legislature?.reference === 'simulation' ? 'PARLAMENTARI DELLA XIX LEGISLATURA (REALE) · RAPPORTI SIMULATI' : 'PARLAMENTARI REALI · RAPPORTI SIMULATI'}</span><h2>${state.parliament?.legislature?.reference === 'simulation' ? 'I tuoi contatti della legislatura reale' : 'I tuoi interlocutori in Parlamento'}</h2></div></div>${state.parliament?.legislature?.reference === 'simulation' ? '<p class="sx-note">Dopo il voto della partita le Camere sono simulate: queste persone reali non vi siedono e non intervengono sulle tue proposte; restano contatti politici con i dati della XIX legislatura.</p>' : ''}${renderContactsPanel(state)}</section>`,
    quirinale: state.game ? renderQuirinale(state, options.presidencyView?.() ?? null) : '',
    governo: renderParliamentPage('governo', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [], secretary: playerRoles(state).secretary }) + realGovernmentCard(),
    archivio: renderArchiveHub(options.archive, { catalog, status: catalogStatus, logoFor: options.logoFor, realLaws: options.realLaws }),
    leggi: renderParliamentPage('leggi', state, { party, player, status: catalogStatus, politicians: realDatabase.politicians ?? [], lawFilter: options.views?.filters?.leggi, billPage: options.views?.filters?.leggiPage, archivePage: options.views?.filters?.leggiArchivio, committees: realDatabase.committees ?? [], realLaws: renderRealLaws(realDatabase.laws ?? [], options.realLaws, { canPropose: canManageParliament(state.parliament), loading: catalogStatus.loading && !(realDatabase.laws ?? []).length, error: catalogStatus.error }) }),
    calendario: state.game ? renderAgendaPage(state, { tab: options.tabFor?.('agenda', state), filter: options.views?.filters?.agenda, advanceDate: options.views?.filters?.advanceDate, events }) : `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">La tua agenda è libera. Avanza il tempo per generare i primi appuntamenti.</div>'}</div>`,
    politici: `<div class="catalog-body" data-catalog-body>${renderPoliticianArchive(catalog,{status:catalogStatus,logoFor:options.logoFor})}</div>`,
    'partiti-lista': `<div class="catalog-body" data-catalog-body>${renderPartyArchive(catalog,{status:catalogStatus,logoFor:options.logoFor})}</div>`,
    sondaggi: renderObservatory(state, observatoryOptions(state, options)),
    elezioni: renderElectionsHub(state, { parties: options.parties ?? [], logoFor: options.logoFor, tab: options.tabFor?.('elezioni', state), national: options.nationalOverview, geography: options.electoralGeography?.() ?? null, nationalView: options.views?.filters?.nazionali, nationalMap: { boundaries: realDatabase.italyBoundaries ?? null, status: optionalDocumentStatus('italyBoundaries'), scope: options.views?.filters?.mapScope, selected: options.views?.filters?.mapSel }, campaignPicks: options.campaignPicks, presidency: options.presidencyView, polls: observatoryOptions(state, options), races: { raceOptions: options.raceOptions } }),
    partito: state.game ? renderPartyPage(state, { filters: options.views?.filters ?? {}, tab: options.tabFor?.('partito', state), record: party, logoFor: options.logoFor, selectable: options.selectable ?? [], territory: { units: realDatabase.territorialUnits ?? [], municipalities: isRealCollectionLoaded('municipalities') ? realDatabase.municipalities : null, home: options.homePlace?.() ?? {}, filter: options.views?.filters?.comitati ?? 'tutti', region: options.views?.filters?.['comitati-regione'] ?? '', found: { region: options.views?.filters?.['found-region'], unit: options.views?.filters?.['found-unit'], municipality: options.views?.filters?.['found-municipality'] } } }) : `<div class="feature-card party-detail-card"><span class="feature-icon">◇</span><div class="eyebrow">${party ? 'AFFILIAZIONE ATTUALE' : 'PROFILO INDIPENDENTE'}</div><div class="party-detail-heading">${party && options.logoFor?.(party) ? `<img src="${esc(options.logoFor(party))}" alt="${esc(party.logoAlt || `Logo di ${party.officialName || party.name}`)}" />` : ''}<h2>${party ? esc(party.officialName || party.name) : 'Nessuna affiliazione'}</h2></div><p>${party ? esc(party.source === DATA_SOURCES.REAL ? party.factualDescription || 'Descrizione non disponibile nelle fonti consultate.' : party.description || 'Partito pronto a essere configurato.') : 'Sei indipendente. Qui sotto puoi aderire a un partito oppure continuare senza affiliazione.'}</p><div class="party-detail-meta">${party ? `<span class="source-pill">${sourceLabel(party.source)}${party.source === DATA_SOURCES.REAL ? ' verificato' : ''}</span>${party.abbreviation ? `<span>${esc(party.abbreviation)}</span>` : ''}${party.orientation ? `<span><small>ORIENTAMENTO</small><strong>${esc(party.orientation)}</strong></span>` : ''}${party.status ? `<span>${esc(party.status)}</span>` : ''}` : '<span class="source-pill">Nessuna affiliazione</span>'}</div>${party?.source === DATA_SOURCES.REAL && party.sourceUrl ? `<a class="catalog-source" href="${esc(party.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ufficiale ↗</a>` : ''}${party?.policyPositions ? `<div class="policy-summary">${[['economia','Economia'],['welfare','Welfare'],['ambiente','Ambiente'],['europa','Europa']].map(([key,label]) => `<span><small>${label}</small><strong>${Number(party.policyPositions[key] ?? 3)} <i>/ 5</i></strong><b><i style="width:${Number(party.policyPositions[key] ?? 3)*20}%"></i></b></span>`).join('')}</div>` : ''}</div>`,
    carriera: renderCareerPage(state, { tab: options.tabFor?.('carriera', state), timelineFilter: options.views?.timelineFilter }),
    profilo: `<div class="profile-page"><section class="profile-page-lead"><div class="hero-avatar has-avatar">${player ? avatarSvg(avatarOf(player), { size: 96, label: 'Avatar di ' + player.displayName }) : 'P'}</div><div><span class="section-kicker">IL TUO POLITICO</span><h2>${player ? esc(player.displayName) : 'Nessun profilo creato'}</h2><p>${player ? `${esc(player.previousProfession)} · residente a ${esc(player.municipality)}, ${esc(player.region)}` : 'Crea una carriera per definire il tuo profilo.'}</p></div>${player ? '' : '<button class="primary-button" data-action="new-career">Nuova carriera ' + icon('arrow', 16) + '</button>'}</section><div class="profile-page-facts"><div><span>INCARICO</span><strong>${player?.roleId && state.dataset.offices.some(item => item.id === player.roleId) ? esc(officeLabel(state.dataset.offices.find(item => item.id === player.roleId))) : 'Da assegnare'}</strong></div><div><span>TERRITORIO</span><strong>${esc(state.dataset.territories.find(item => item.id === player?.territoryId)?.name ?? player?.region ?? 'Italia')}</strong></div><div><span>PARTITO</span><strong>${party ? esc(partyName(party)) : 'Indipendente'}</strong></div></div><section class="profile-metrics"><h3>Statistiche</h3>${profileMetrics}</section><button class="text-link" data-nav="politici">Esplora i profili politici ${icon('arrow', 16)}</button></div>`,
    notizie: `<section class="hq-panel news-page">${renderNewsroom(state, options.views?.newsFilter, options.views ?? {})}</section>`,
    eventi: `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">Nessun evento in programma.</div>'}</div>`,
    impostazioni: `<section class="hq-panel settings-panel">${settingsView(options.settings, { account: options.account })}</section><div class="settings-grid"><article class="panel settings-card"><div class="eyebrow">PARTITA</div><h3>Salvataggi e partite</h3><p>${esc(options.lastSaved ?? '')}. Dal menu principale carichi, esporti o importi le partite; qui puoi salvare subito.</p><div class="setting-actions"><button class="secondary-button" data-action="save">Salva adesso ${icon('save', 16)}</button><button class="secondary-button" data-menu-action="save-slot">Salva in uno slot</button><button class="secondary-button" data-action="menu">Menu principale ${icon('menu', 15)}</button></div></article><article class="panel settings-card"><div class="eyebrow">ACCOUNT</div><h3>${options.account?.user ? `Connesso come ${esc(options.account.user.username)}` : 'Salvataggi online'}</h3><p>${options.account?.user ? `La carriera si salva anche online dopo ogni salvataggio${options.account.lastSync ? ` (ultima sincronizzazione ${esc(new Date(options.account.lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))})` : ''}: la ritrovi su qualsiasi dispositivo.` : 'Crea un account o accedi per ritrovare le tue carriere su qualsiasi dispositivo. Il browser continua a conservarne una copia.'}</p>${options.account?.conflict ? '<p class="menu-error">Su un altro dispositivo c’è una versione più recente: scegli quale tenere.</p>' : ''}<button class="secondary-button" data-action="account">${options.account?.user ? 'Gestisci l’account' : 'Accedi o registrati'} ${icon('arrow',15)}</button></article><article class="panel settings-card"><div class="eyebrow">DATI DI GIOCO</div><h3>Reale, simulazione, utente</h3><p>I dataset reali sono separati dalla partita e non vengono mai modificati. Le schede reali mostrano fonte, verifica e data di riferimento; i dati non disponibili restano vuoti.</p><span class="source-pill">${(realDatabase.manifest?.collections?.parties ?? 0) + (realDatabase.manifest?.collections?.politicalMovements ?? 0)} organizzazioni · ${realDatabase.manifest?.collections?.politicians ?? 0} parlamentari</span></article>${isAdminVerified() ? `<article class="panel settings-card"><div class="eyebrow">ASSET DEI PARTITI</div><h3>Gestione loghi</h3><p>Carica un file o incolla l’indirizzo di un’immagine: il logo resta salvato in questo browser, separato dai loghi ufficiali verificati.</p><button class="secondary-button" data-action="logo-admin">Apri gestione loghi ${icon('arrow',15)}</button></article><article class="panel settings-card"><div class="eyebrow">AREA RISERVATA</div><h3>Amministrazione dei dati</h3><p>Correggi nomi, sigle, descrizioni, loghi, collegamenti e incarichi di partiti e politici. Le modifiche restano in un archivio separato e non toccano il dataset reale.</p><button class="secondary-button" data-nav="amministrazione">Apri l’area amministrativa ${icon('arrow',15)}</button></article>` : ''}<article class="panel settings-card danger-card"><div class="eyebrow">NUOVA PARTITA</div><h3>Ricomincia da capo</h3><p>Crea un nuovo politico. La partita in corso viene conservata in uno slot di salvataggio.</p><button class="secondary-button" data-action="new-career">Nuova partita</button></article></div>`,
  };
  // The pages of the destination the page belongs to, as a row of tabs (a destination with one page has none).
  const section = sectionOf(state.ui.activePage);
  const entries = section ? sectionEntries(section, state) : [];
  const routes = entries.length > 1 ? entries : [];
  // The redesigned central sections open with their own hero: the generic page heading is not repeated.
  const ownHero = ['elezioni', 'carriera', 'partito', 'calendario'].includes(state.ui.activePage) && state.game;
  return `${ownHero ? `<h1 class="visually-hidden">${page.title}</h1>` : `<section class="welcome-row sub-welcome"><div><div class="eyebrow">${page.eyebrow} <span class="eyebrow-line"></span></div><h1>${page.title}<span class="period">.</span></h1><p class="intro">${page.intro}</p></div>${state.ui.activePage === 'carriera' && player ? `<button class="secondary-button" data-action="new-career">Nuova carriera ${icon('plus', 16)}</button>` : ''}</section>`}${routes.length ? `<nav class="section-subnav" aria-label="${esc(section.label)}">${routes.map(entry => `<button type="button" class="subnav-tab ${entryOn(entry, entries, state.ui.activePage, options.territory) ? 'active' : ''}" ${entryAttrs(entry)} aria-current="${entryOn(entry, entries, state.ui.activePage, options.territory) ? 'page' : 'false'}">${esc(entry.label)}</button>`).join('')}</nav>` : ''}<section class="subpage-content">${listContents[state.ui.activePage] ?? ''}</section><footer class="page-footer"><span>POLITICANDO 2026 <i>·</i> ${['politici','partiti-lista','archivio'].includes(state.ui.activePage)?'DATI REALI VERIFICATI':'SIMULAZIONE'}</span><span>${['politici','partiti-lista','archivio'].includes(state.ui.activePage)?`${realDatabase.manifest?.collections?.politicians ?? 0} parlamentari · ${(realDatabase.manifest?.collections?.parties ?? 0)+(realDatabase.manifest?.collections?.politicalMovements ?? 0)} organizzazioni · snapshot ${esc(realDatabase.manifest?.snapshotDate ?? '—')}` :'Partiti e persone reali restano invariati · tutto ciò che accade in partita è simulazione'}</span></footer>`;
}
function stateCatalogContent(state, catalog, options = {}) {
  const status = { loading: catalog.loadingPage === state.ui.activePage, error: catalog.errors[state.ui.activePage] ?? '' };
  if (state.ui.activePage === 'politici') return renderPoliticianArchive(catalog,{status,logoFor:options.logoFor});
  if (state.ui.activePage === 'partiti-lista') return renderPartyArchive(catalog,{status,logoFor:options.logoFor});
  if (state.ui.activePage === 'archivio') return renderArchiveBody(options.archive,{catalog,status,logoFor:options.logoFor,realLaws:options.realLaws});
  return '';
}
