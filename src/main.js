import { mountApp } from './ui/app.js?v=20260923-2';
import { store } from './core/store.js?v=20260923-2';
import { loadRealCollections, loadRealDatabase } from './data/repositories/real-data.js?v=20260923-2';

const root = document.querySelector('#app');
try {
  await loadRealDatabase();
  await loadRealCollections(['parties','politicalMovements']);
  mountApp(root, store);
} catch (error) {
  console.error('Avvio di POLITICANDO 2026 non riuscito:', error);
  root.innerHTML = `<main role="alert" style="max-width:760px;margin:10vh auto;padding:32px;font:16px/1.6 system-ui,sans-serif;color:#22312e"><h1>POLITICANDO 2026</h1><p>La pagina è stata raggiunta, ma non è stato possibile caricare i dati del gioco.</p><p>${String(error?.message || 'Errore di caricamento.')}</p><p>Ricarica la pagina tra poco. Se il problema continua, comunica questo messaggio.</p></main>`;
}
