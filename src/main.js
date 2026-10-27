import { mountApp } from './ui/app.js?v=20261027-6';
import { refreshSharedArchive } from './data/repositories/admin-sync.js?v=20261027-6';
import { isNativeApp } from './data/repositories/account-sync.js?v=20261027-6';
import { store } from './core/store.js?v=20261027-6';
import { isRealCollectionLoaded, loadRealCollectionsSettled, loadRealDatabase, loadOptionalRealDocument, loadRealDocument, realDatabase, realDataUrls, refreshAdminOverrides } from './data/repositories/real-data.js?v=20261027-6';
import { PARTY_LINK_COLLECTIONS, governingEntityIds } from './data/repositories/party-links.js?v=20261027-6';
import { referenceGovernmentSpec } from './data/repositories/government-reference.js?v=20261027-6';

const BUILD = new URL(import.meta.url).searchParams.get('v');
// The installed app (Capacitor) carries its own copy of the game: the site cannot update it, so it never asks the site for a newer build and keeps no browser cache of its own.
const NATIVE = isNativeApp();

// GitHub Pages lets browsers reuse index.html for a few minutes after a deploy. The check runs AFTER the screen is up (it never holds the first screen back, and has a time limit): if the
// page online references a newer build and nothing was touched yet, the page reloads on a URL that bypasses that cache; otherwise the next visit picks it up.
const BUILD_CHECK_TIMEOUT_MS = 4000;
async function newerBuildUrl() {
  if (NATIVE || !/^https?:$/.test(location.protocol) || navigator.onLine === false) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BUILD_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(new URL(`../index.html?build-check=${Date.now()}`, import.meta.url), { cache: 'no-store', signal: controller.signal });
    const online = (await response.text()).match(/main\.js\?v=([^"'&]+)/)?.[1];
    const url = new URL(location.href);
    if (!online || !BUILD || online === BUILD || url.searchParams.get('v') === online) return null;
    url.searchParams.set('v', online);
    return url.href;
  } catch {
    return null;
  } finally { clearTimeout(timer); }
}

// Runs `task` when the browser is idle (or after `within` ms at the latest): what the first screen does not need must not compete with it for the network and the CPU.
const whenIdle = (task, within = 3000) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(task, { timeout: within }) : setTimeout(task, Math.min(within, 800)));

// Offline play (web only): a service worker keeps the game and the real data in the browser cache, then warms the data files the game has not opened yet, one at a time.
function registerOfflineCache() {
  if (NATIVE || !('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).then(() => navigator.serviceWorker.ready).then(registration => {
    // On a metered or very slow connection the files are not downloaded ahead of time: they are kept as they are used.
    const link = navigator.connection;
    if (link?.saveData || /(^|-)2g$/.test(link?.effectiveType ?? '')) return;
    whenIdle(() => {
      // The page itself and every module and stylesheet already loaded, then the real data files.
      const loaded = performance.getEntriesByType('resource').map(entry => entry.name).filter(name => new URL(name).origin === location.origin);
      const page = new URL(location.href); page.hash = '';
      registration.active?.postMessage({ type: 'warm', urls: [page.href, ...loaded, ...realDataUrls()] });
    }, 8000);
  }).catch(error => console.warn('Cache offline non disponibile:', error));
}

const root = document.querySelector('#app');
// The collections the simulated world starts from, and the institutional ones that follow once the game is open.
const WORLD_COLLECTIONS = ['parties','politicalMovements','coalitions','twoPerThousand','realPolls'];
const INSTITUTION_COLLECTIONS = ['government','politicians','politicalFigures','parliamentaryGroups',...PARTY_LINK_COLLECTIONS];
// The simulated world starts from the latest real poll (Supermedia), the documented collocazione of every force
// and, once the government data is loaded, the parties of the real majority in office. A collection that could not be
// loaded is simply empty here: the game starts anyway and says what is missing.
const reference = (governingIds = []) => ({ twoPerThousand: realDatabase.twoPerThousand ?? [], parties: realDatabase.parties ?? [], movements: realDatabase.politicalMovements ?? [], coalitions: realDatabase.coalitions ?? [], polls: realDatabase.realPolls ?? [], electoralLists: realDatabase.electoralLists ?? [], governingIds, startDate: realDatabase.manifest?.scenarioDate ?? realDatabase.manifest?.snapshotDate ?? null });
const loaded = names => names.every(name => isRealCollectionLoaded(name));
let app = null;
const refresh = () => { if (!boot.error) app?.refresh?.(); };

// What the screen can do depends on the data it has: while the index and the starting collections load, the menu is up but «Nuova partita» waits (a saved career can be resumed at once)
// (`phase` 'loading'); once the index has been read the game is usable ('ready') and whatever collection is missing is listed in the notice with «Riprova».
const boot = { phase: 'loading', error: null, institutions: false };

// The Government in office at the start (derived from the real Government and the groups of its members), the
// real majority and the verified groups of the Chambers reach the simulation once the institutional data are loaded.
async function loadInstitutions() {
  await loadRealCollectionsSettled(INSTITUTION_COLLECTIONS);
  if (loaded(INSTITUTION_COLLECTIONS)) { store.setRealReference(reference(governingEntityIds())); store.setReferenceGovernment(referenceGovernmentSpec()); }
  if (isRealCollectionLoaded('parliamentaryGroups')) store.setParliamentaryGroups(realDatabase.parliamentaryGroups ?? []);
}
// Real documents: the electoral map of 2022 (collegi, circoscrizioni, seats and results: until it arrives, or offline
// without cache, the vote uses a simplified count) and the real calendar of local and regional votes.
function loadDocuments() {
  return Promise.all([
    isRealCollectionLoaded('electoralGeography') ? null : loadRealDocument('electoralGeography').then(geography => store.setElectoralGeography(geography)).catch(error => console.warn('Mappa elettorale 2022 non disponibile:', error)),
    isRealCollectionLoaded('localElections') ? null : loadRealDocument('localElections').then(doc => store.setLocalCalendar(doc)).catch(error => console.warn('Calendario delle elezioni locali non disponibile:', error)),
    // (optional: until the ISTAT population is imported the size class of a comune is a declared fallback)
    loadOptionalRealDocument('municipalPopulation').then(doc => store.setMunicipalPopulation(doc)),
    // (optional: the geographic map of the national elections; without it the squares map is all there is)
    loadOptionalRealDocument('italyBoundaries').catch(() => null).finally(refresh)
  ]);
}
// The institutional data and the heavy documents are not needed by the first screen: they start when the browser is idle, or at once when the player opens the creator of a career (or enters
// a game), which needs them. One run only: asking again returns the same promise.
let background = null;
const loadBackground = () => background ??= Promise.all([
  // (the institutions are what the Chambers, the Government and the relevance of the news depend on: until they have arrived, or failed, the weekly pop-up of the newsroom waits)
  loadInstitutions().catch(error => console.warn('Dati istituzionali non disponibili:', error)).finally(() => { boot.institutions = true; refresh(); }),
  loadDocuments()
]).finally(refresh);
// “Riprova” on the notice of missing data: only what is missing is requested again.
async function retryMissingData() {
  await loadRealDatabase();
  if (!loaded(WORLD_COLLECTIONS)) { await loadRealCollectionsSettled(WORLD_COLLECTIONS); store.setRealReference(reference(loaded(INSTITUTION_COLLECTIONS) ? governingEntityIds() : [])); }
  background = null; boot.institutions = false;
  await loadBackground();
  if (boot.phase === 'loading') { boot.phase = 'ready'; boot.error = null; }
}

function bootError(error) {
  console.error('Avvio di POLITICANDO 2026 non riuscito:', error);
  const message = String(error?.message || 'Errore di caricamento.').replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
  root.innerHTML = `<main role="alert" style="max-width:760px;margin:10vh auto;padding:32px;font:16px/1.6 system-ui,sans-serif;color:inherit"><h1>POLITICANDO 2026</h1><p>La pagina è stata raggiunta, ma non è stato possibile leggere l’indice dei dati reali, necessario per controllarne l’integrità.</p><p>${message}</p><p><button type="button" data-boot-retry style="font:inherit;padding:8px 16px">Riprova</button></p><p>Se il problema continua, comunica questo messaggio.</p></main>`;
  root.querySelector('[data-boot-retry]')?.addEventListener('click', () => location.reload());
}

// The first screen comes first: the app is mounted at once (the menu, with the actions that need data waiting), then the data arrives in steps.
try {
  app = mountApp(root, store, {
    bootPhase: () => boot.phase,
    // The weekly pop-up of the newsroom looks at the week once: it waits until the data that decides what is relevant (the institutions) has arrived or failed.
    popupsReady: () => boot.phase === 'ready' && boot.institutions,
    // An edit of the owner in the Admin reaches the next career at once (names, abbreviations, colours), without reloading the page.
    refreshReference: () => store.setRealReference(reference(loaded(INSTITUTION_COLLECTIONS) ? governingEntityIds() : [])),
    retryData: () => retryMissingData().finally(refresh),
    // The creator of a career and the first game need the institutions and the documents: they are asked for at once and waited for.
    needBackground: () => loadBackground()
  });
} catch (error) { bootError(error); throw error; }

let touched = false;
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => { touched = true; }, { once: true, capture: true });

(async () => {
  try {
    // The manifest is the index of the real data (counts, versions): without it no collection can be checked.
    await loadRealDatabase();
    // Every collection that arrives is loaded; a missing one does not stop the game (see realDataFailures).
    await loadRealCollectionsSettled(WORLD_COLLECTIONS);
    store.setRealReference(reference());
    boot.phase = 'ready';
    refresh();
    // Without a career the menu does not need them: they start a moment after it is usable, so that what the player does first is not slowed down. A saved career is entered with them: at once.
    if (store.hasCareer()) loadBackground(); else setTimeout(() => whenIdle(() => loadBackground(), 3000), 1500);
    setTimeout(() => whenIdle(registerOfflineCache, 2000), 1500);
  } catch (error) {
    boot.error = error;
    bootError(error);
  }
})();

// The owner's shared corrections and logos (the copy kept in this browser is already in use): the answer of the server is applied when it comes, whenever that is.
refreshSharedArchive().then(changed => {
  if (!changed) return;
  refreshAdminOverrides();
  if (boot.phase === 'ready') store.setRealReference(reference(loaded(INSTITUTION_COLLECTIONS) ? governingEntityIds() : []));
  refresh();
}).catch(() => {});
// A newer build online: reload on it only if nothing has been touched yet (a game in progress is never interrupted).
newerBuildUrl().then(url => { if (url && !touched) location.replace(url); });
