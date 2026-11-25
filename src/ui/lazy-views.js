// The pages of the game, loaded when they are needed. The first screen (the menu) does not need the code of Home, of the elections, of the Parliament, of the party, of the observatory, of the scenes…:
// each page renderer is here a small function with the same name and the same arguments as the real one; the first time it is called the module is imported in the background and the page shows a
// short «loading» block, then the page is drawn again with the real renderer. When a career is opened the modules are fetched in the background (`prefetchViews`), so that the first visit to a page
// is almost always instant, and the pages seen are in the cache for when the network is missing. Nothing here decides anything: it only delays the code, never the data.
import { HEMICYCLE_DEFAULTS } from './hemicycle-defaults.js?v=20261125-10';
import { ARCHIVE_COLLECTIONS } from './archive-collections.js?v=20261125-10';

export { HEMICYCLE_DEFAULTS, ARCHIVE_COLLECTIONS };

const LOADERS = {
  'admin-panel': () => import('./admin-panel.js?v=20261125-10'),
  'agenda-page': () => import('./agenda-page.js?v=20261125-10'),
  'archive-hub': () => import('./archive-hub.js?v=20261125-10'),
  'diplomacy-view': () => import('./diplomacy-view.js?v=20261125-10'),
  'initiative-mode': () => import('./initiative-mode.js?v=20261125-10'),
  'referendum-mode': () => import('./referendum-mode.js?v=20261125-10'),
  'territory-page': () => import('./territory-page.js?v=20261125-10'),
  'election-night': () => import('./election-night.js?v=20261125-10'),
  'elections-hub': () => import('./elections-hub.js?v=20261125-10'),
  'hemicycle-view': () => import('./hemicycle-view.js?v=20261125-10'),
  'members-view': () => import('./members-view.js?v=20261125-10'),
  'parliament-mode': () => import('./parliament-mode.js?v=20261125-10'),
  'party-page': () => import('./party-page.js?v=20261125-10'),
  'scene-view': () => import('./scene-view.js?v=20261125-10'),
  'career-page': () => import('./career-page.js?v=20261125-10'),
  'observatory-view': () => import('./observatory-view.js?v=20261125-10'),
  'presidency-view': () => import('./presidency-view.js?v=20261125-10'),
  'real-laws': () => import('./real-laws.js?v=20261125-10'),
  'game-mode': () => import('./game-mode.js?v=20261125-10'),
  'finance-mode': () => import('./finance-mode.js?v=20261125-10'),
  'society-mode': () => import('./society-mode.js?v=20261125-10'),
  'organization-mode': () => import('./organization-mode.js?v=20261125-10'),
  'local-mode': () => import('./local-mode.js?v=20261125-10'),
  'party-archive': () => import('./party-archive.js?v=20261125-10'),
  'politician-archive': () => import('./politician-archive.js?v=20261125-10'),
  'polls-mode': () => import('./polls-mode.js?v=20261125-10'),
  'career-wizard': () => import('./career-wizard.js?v=20261125-10'),
  'rewards-page': () => import('./rewards-page.js?v=20261125-10'),
  // the manual of «Come giocare» (data/guide-manual.js): text only, needed when the guide is opened
  'guide-manual': () => import('../data/guide-manual.js?v=20261125-10')
};
const modules = new Map();
const pending = new Map();
let onLoaded = () => {};
let loadedSinceDraw = false;
// The function the page redraws itself with when a module has arrived (set once by the page code).
export const setLazyRender = fn => { onLoaded = fn; };
export const lazyLoaded = name => modules.has(name);

function load(name) {
  if (modules.has(name)) return Promise.resolve(modules.get(name));
  if (!pending.has(name)) {
    pending.set(name, LOADERS[name]().then(module => { modules.set(name, module); pending.delete(name); loadedSinceDraw = true; return module; }).catch(error => { pending.delete(name); throw error; }));
  }
  return pending.get(name);
}
// A load that ends is followed by one redraw (several modules arriving together draw once).
let scheduled = false;
const settle = () => { if (scheduled) return; scheduled = true; Promise.resolve().then(() => new Promise(resolve => setTimeout(resolve, 0))).then(() => { scheduled = false; if (loadedSinceDraw) { loadedSinceDraw = false; try { onLoaded(); } catch (error) { console.error(error); } } }); };

// A module that did not arrive (a network hiccup) is asked for again, a few times, one second and a half apart: the page never stays «loading» for ever on a failure that passes.
const attempts = new Map();
function retry(name, error) {
  const count = (attempts.get(name) ?? 0) + 1;
  attempts.set(name, count);
  if (count <= 6) setTimeout(() => { try { onLoaded(); } catch { /* the next draw asks again */ } }, 1500);
  else console.error(error);
}
// The manual of the guide: the module when it is here, else null (it is fetched and the page is drawn again when it arrives).
export const guideManual = () => { const module = modules.get('guide-manual'); if (module) return module; load('guide-manual').then(settle, error => retry('guide-manual', error)); return null; };
export const LOADING_HTML = '<section class="lazy-loading" role="status" aria-busy="true" data-lazy-loading><p>Carico la pagina…</p></section>';
// A renderer that returns HTML: the real one when its module is here, otherwise the loading block (and the module is fetched).
const html = (name, fn, fallback = LOADING_HTML) => (...args) => {
  const module = modules.get(name);
  if (module) return module[fn](...args);
  load(name).then(settle, error => retry(name, error));
  return fallback;
};
// A helper that is not HTML (it can only be called once the page that uses it has been drawn): the real one when the module is here, otherwise nothing.
const sync = (name, fn, fallback = null) => (...args) => { const module = modules.get(name); return module ? module[fn](...args) : fallback; };

export const renderAdminPanel = html('admin-panel', 'renderAdminPanel');
export const renderAgendaPage = html('agenda-page', 'renderAgendaPage');
export const renderArchiveBody = html('archive-hub', 'renderArchiveBody');
export const renderArchiveHub = html('archive-hub', 'renderArchiveHub');
export const renderDiplomacy = html('diplomacy-view', 'renderDiplomacy');
export const renderInitiatives = html('initiative-mode', 'renderInitiatives');
export const renderReferendums = html('referendum-mode', 'renderReferendums');
export const renderTerritoryPage = html('territory-page', 'renderTerritoryPage');
export const renderElectionNight = html('election-night', 'renderElectionNight');
export const renderElectionsHub = html('elections-hub', 'renderElectionsHub');
export const renderHemicycle = html('hemicycle-view', 'renderHemicycle');
export const renderFeaturedMembers = html('members-view', 'renderFeaturedMembers', '');
export const renderParliamentPage = html('parliament-mode', 'renderParliamentPage');
export const renderPartyPage = html('party-page', 'renderPartyPage');
export const renderScene = html('scene-view', 'renderScene');
export const renderCareerPage = html('career-page', 'renderCareerPage');
export const renderObservatory = html('observatory-view', 'renderObservatory');
export const renderQuirinale = html('presidency-view', 'renderQuirinale');
// The wizard of a new career (a heavy module, only needed when one is started): the page and its helpers; the helpers are called only once the wizard is drawn, so the module is already here.
export const renderCareerWizard = html('career-wizard', 'renderCareerWizard');
export const wizardLogoPreview = sync('career-wizard', 'wizardLogoPreview', null);
export const pollScenarioOf = sync('career-wizard', 'pollScenarioOf', null);
export const removePartyCriterion = sync('career-wizard', 'removePartyCriterion', null);
export const togglePartyOrientation = sync('career-wizard', 'togglePartyOrientation', null);
export const chosenPlace = sync('career-wizard', 'chosenPlace', null);
export const PROFESSIONS = () => modules.get('career-wizard')?.PROFESSIONS ?? [];
export const renderRealLaws = html('real-laws', 'renderRealLaws', '');
export const renderPartyArchive = html('party-archive', 'renderPartyArchive');
export const renderPartyProfile = html('party-archive', 'renderPartyProfile', '');
export const renderPoliticianArchive = html('politician-archive', 'renderPoliticianArchive');
export const renderPoliticianProfile = html('politician-archive', 'renderPoliticianProfile', '');
export const renderRewardsPage = html('rewards-page', 'renderRewardsPage');
export const renderRewardNotice = html('rewards-page', 'renderRewardNotice', '');
export const patchRewardsPage = sync('rewards-page', 'patchRewardsPage', false);
// Home is the page a career opens on: it waits for every page to be here (a short block, once), so that the pages reached from it never wait: no page is half there when the player moves around.
let prefetchDone = false;
const everyViewHere = () => prefetchDone || Object.keys(LOADERS).every(name => modules.has(name));
export const renderHeadquarters = (...args) => {
  const module = modules.get('game-mode');
  if (module && everyViewHere()) return module.renderHeadquarters(...args);
  prefetchViews().then(() => { loadedSinceDraw = true; settle(); }, error => retry('game-mode', error));
  return LOADING_HTML;
};
export const renderNewsroom = html('game-mode', 'renderNewsroom', '');
export const renderFinancePage = html('finance-mode', 'renderFinancePage');
export const renderMediaPanel = html('society-mode', 'renderMediaPanel', '');
export const renderTerritoriesPage = html('society-mode', 'renderTerritoriesPage');
export const renderContactsPanel = html('organization-mode', 'renderContactsPanel', '');
export const resolveInstitution = sync('local-mode', 'resolveInstitution', null);

// Fetches every page in the background (when a career is opened), all together, the pages most likely to be asked first leading: the first visit to a page is then almost always instant, and the
// modules are in the cache of the browser and of the service worker for when the network is missing.
const ORDER = ['game-mode', 'elections-hub', 'parliament-mode', 'party-page', 'career-page', 'agenda-page', 'observatory-view', 'hemicycle-view', 'scene-view', 'election-night', 'finance-mode', 'society-mode', 'organization-mode', 'local-mode', 'diplomacy-view', 'initiative-mode', 'referendum-mode', 'presidency-view', 'archive-hub', 'members-view', 'real-laws', 'admin-panel', 'polls-mode', 'rewards-page', 'party-archive', 'politician-archive', 'career-wizard'];
let prefetching = null;
export function prefetchViews() {
  if (prefetching) return prefetching;
  prefetching = Promise.allSettled(ORDER.filter(name => LOADERS[name]).map(name => load(name))).then(() => { prefetchDone = true; });
  return prefetching;
}
// For tests and for a page that must be ready before it is drawn.
export const loadView = load;
