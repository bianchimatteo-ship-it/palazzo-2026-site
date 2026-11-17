// The page «Risultati per territorio» in Chrome: reachable from the Elezioni menu, says what it shows before any vote, no horizontal scroll on a phone, no JavaScript errors.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Pagina Risultati per territorio saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm-cancel]').forEach(item => item.click()); true`);
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-nav="risultati"]')].some(item => /Risultati per territorio/.test(item.textContent))`), 'La voce è nel menu delle elezioni.');
  await evaluate(`location.hash = '#risultati'; true`); await pause(1800);
  const text = await evaluate(`document.querySelector('[data-territory-page-root]')?.innerText ?? ''`);
  assert.match(text, /Dati reali, simulati e stime/); assert.match(text, /RISULTATO SIMULATO|NESSUN VOTO/);
  assert.ok(!/NaN|undefined|\[object/.test(text), 'Nessun valore rotto.');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await pause(500);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), true, 'Nessuno scorrimento orizzontale a 360 px.');
  assert.deepEqual(errors.filter(item => !/favicon/.test(String(item))), [], 'Nessun errore JavaScript.');
  console.log('check-territory-page-browser: ok');
});
