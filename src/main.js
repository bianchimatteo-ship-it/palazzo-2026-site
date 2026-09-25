import { mountApp } from './ui/app.js?v=20260925-1';
import { refreshSharedArchive } from './data/repositories/admin-sync.js?v=20260925-1';
import { store } from './core/store.js?v=20260925-1';
import { loadRealCollections, loadRealDatabase, realDatabase, realDataUrls } from './data/repositories/real-data.js?v=20260925-1';
import { PARTY_LINK_COLLECTIONS, governingEntityIds } from './data/repositories/party-links.js?v=20260925-1';
import { referenceGovernmentSpec } from './data/repositories/government-reference.js?v=20260925-1';

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
const newer = await newerBuildUrl();
if (newer) location.replace(newer);
else {
  try {
    // The owner's shared corrections and logos come first, so every collection is loaded with them (cached copy offline).
    await refreshSharedArchive().catch(() => false);
    await loadRealDatabase();
    await loadRealCollections(['parties','politicalMovements','coalitions','twoPerThousand','realPolls']);
    // The simulated world starts from the latest real poll (Supermedia), the documented collocazione of every force
    // and, once the government data is loaded, the parties of the real majority in office.
    const reference = (governingIds = []) => ({ twoPerThousand: realDatabase.twoPerThousand ?? [], parties: realDatabase.parties ?? [], movements: realDatabase.politicalMovements ?? [], coalitions: realDatabase.coalitions ?? [], polls: realDatabase.realPolls ?? [], governingIds, startDate: realDatabase.manifest?.snapshotDate ?? null });
    store.setRealReference(reference());
    mountApp(root, store);
    registerOfflineCache();
    // The Government in office at the start (derived from the real Government and the groups of its members) and the
    // real majority reach the simulation once the institutional data are loaded.
    loadRealCollections(['government','politicians','politicalFigures','parliamentaryGroups',...PARTY_LINK_COLLECTIONS]).then(() => { store.setRealReference(reference(governingEntityIds())); store.setReferenceGovernment(referenceGovernmentSpec()); }).catch(() => {});
  } catch (error) {
    console.error('Avvio di POLITICANDO 2026 non riuscito:', error);
    root.innerHTML = `<main role="alert" style="max-width:760px;margin:10vh auto;padding:32px;font:16px/1.6 system-ui,sans-serif;color:#22312e"><h1>POLITICANDO 2026</h1><p>La pagina è stata raggiunta, ma non è stato possibile caricare i dati del gioco.</p><p>${String(error?.message || 'Errore di caricamento.')}</p><p>Ricarica la pagina tra poco. Se il problema continua, comunica questo messaggio.</p></main>`;
  }
}
