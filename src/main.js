import { mountApp } from './ui/app.js?v=20260924-9';
import { store } from './core/store.js?v=20260924-9';
import { loadRealCollections, loadRealDatabase } from './data/repositories/real-data.js?v=20260924-9';

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

const root = document.querySelector('#app');
const newer = await newerBuildUrl();
if (newer) location.replace(newer);
else {
  try {
    await loadRealDatabase();
    await loadRealCollections(['parties','politicalMovements']);
    mountApp(root, store);
  } catch (error) {
    console.error('Avvio di POLITICANDO 2026 non riuscito:', error);
    root.innerHTML = `<main role="alert" style="max-width:760px;margin:10vh auto;padding:32px;font:16px/1.6 system-ui,sans-serif;color:#22312e"><h1>POLITICANDO 2026</h1><p>La pagina è stata raggiunta, ma non è stato possibile caricare i dati del gioco.</p><p>${String(error?.message || 'Errore di caricamento.')}</p><p>Ricarica la pagina tra poco. Se il problema continua, comunica questo messaggio.</p></main>`;
  }
}
