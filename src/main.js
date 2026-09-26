import { mountApp } from './ui/app.js?v=20260926-7';
import { refreshSharedArchive } from './data/repositories/admin-sync.js?v=20260926-7';
import { store } from './core/store.js?v=20260926-7';
import { isRealCollectionLoaded, loadRealCollectionsSettled, loadRealDatabase, loadRealDocument, realDatabase, realDataUrls } from './data/repositories/real-data.js?v=20260926-7';
import { PARTY_LINK_COLLECTIONS, governingEntityIds } from './data/repositories/party-links.js?v=20260926-7';
import { referenceGovernmentSpec } from './data/repositories/government-reference.js?v=20260926-7';

const BUILD = new URL(import.meta.url).searchParams.get('v');

// GitHub Pages lets browsers reuse index.html for a few minutes after a deploy:
// when the page online references a newer build, reload on a URL that bypasses that cache.
async function newerBuildUrl() {
  try {
    const response = await fetch(new URL(`../index.html?build-check=${Date.now()}`, import.meta.url), { cache: 'no-store' });
    const online = (await response.text()).match(/main\.js\?v=([^"'&]+)/)?.[1];
    const url = new URL(location.href);
    if (!online || !BUILD || online === BUILD || url.searchParams.get('v') === online) return null;
    url.searchParams.set('v', online);
    return url.href;
  } catch {
    return null;
  }
}

// Offline play: a service worker keeps the game and the real data in the browser cache,
// then warms the data files the game has not opened yet.
function registerOfflineCache() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).then(() => navigator.serviceWorker.ready).then(registration => {
    // The page itself and every module and stylesheet already loaded, then the real data files.
    const loaded = performance.getEntriesByType('resource').map(entry => entry.name).filter(name => new URL(name).origin === location.origin);
    const page = new URL(location.href); page.hash = '';
    registration.active?.postMessage({ type: 'warm', urls: [page.href, ...loaded, ...realDataUrls()] });
  }).catch(error => console.warn('Cache offline non disponibile:', error));
}

const root = document.querySelector('#app');
// The collections the simulated world starts from, and the institutional ones that follow once the game is open.
const WORLD_COLLECTIONS = ['parties','politicalMovements','coalitions','twoPerThousand','realPolls'];
const INSTITUTION_COLLECTIONS = ['government','politicians','politicalFigures','parliamentaryGroups',...PARTY_LINK_COLLECTIONS];
// The simulated world starts from the latest real poll (Supermedia), the documented collocazione of every force
// and, once the government data is loaded, the parties of the real majority in office. A collection that could not be
// loaded is simply empty here: the game starts anyway and says what is missing.
const reference = (governingIds = []) => ({ twoPerThousand: realDatabase.twoPerThousand ?? [], parties: realDatabase.parties ?? [], movements: realDatabase.politicalMovements ?? [], coalitions: realDatabase.coalitions ?? [], polls: realDatabase.realPolls ?? [], governingIds, startDate: realDatabase.manifest?.snapshotDate ?? null });
const loaded = names => names.every(name => isRealCollectionLoaded(name));
let app = null;
const refresh = () => app?.refresh?.();

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
    isRealCollectionLoaded('localElections') ? null : loadRealDocument('localElections').then(doc => store.setLocalCalendar(doc)).catch(error => console.warn('Calendario delle elezioni locali non disponibile:', error))
  ]);
}
// “Riprova” on the notice of missing data: only what is missing is requested again.
async function retryMissingData() {
  await loadRealDatabase();
  if (!loaded(WORLD_COLLECTIONS)) { await loadRealCollectionsSettled(WORLD_COLLECTIONS); store.setRealReference(reference(loaded(INSTITUTION_COLLECTIONS) ? governingEntityIds() : [])); }
  await Promise.all([loaded(INSTITUTION_COLLECTIONS) ? null : loadInstitutions(), loadDocuments()]);
}

function bootError(error) {
  console.error('Avvio di POLITICANDO 2026 non riuscito:', error);
  const message = String(error?.message || 'Errore di caricamento.').replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
  root.innerHTML = `<main role="alert" style="max-width:760px;margin:10vh auto;padding:32px;font:16px/1.6 system-ui,sans-serif;color:inherit"><h1>POLITICANDO 2026</h1><p>La pagina è stata raggiunta, ma non è stato possibile leggere l’indice dei dati reali, necessario per controllarne l’integrità.</p><p>${message}</p><p><button type="button" data-boot-retry style="font:inherit;padding:8px 16px">Riprova</button></p><p>Se il problema continua, comunica questo messaggio.</p></main>`;
  root.querySelector('[data-boot-retry]')?.addEventListener('click', () => location.reload());
}

const newer = await newerBuildUrl();
if (newer) location.replace(newer);
else {
  try {
    // The owner's shared corrections and logos come first, so every collection is loaded with them (cached copy offline).
    await refreshSharedArchive().catch(() => false);
    // The manifest is the index of the real data (counts, versions): without it no collection can be checked.
    await loadRealDatabase();
    // Every collection that arrives is loaded; a missing one does not stop the game (see realDataFailures).
    await loadRealCollectionsSettled(WORLD_COLLECTIONS);
    store.setRealReference(reference());
    app = mountApp(root, store, { retryData: () => retryMissingData().finally(refresh) });
    registerOfflineCache();
    loadInstitutions().catch(error => console.warn('Dati istituzionali non disponibili:', error)).finally(refresh);
    loadDocuments();
  } catch (error) {
    bootError(error);
  }
}
