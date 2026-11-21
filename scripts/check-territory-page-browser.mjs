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
  // without a vote the page says so; then a real simulated vote is put in the live state and the page draws it, with its search, pages and comparison
  assert.match(await evaluate(`document.querySelector('[data-territory-page-root]')?.innerText ?? ''`), /Ancora nessun voto politico|NESSUN VOTO/, 'Prima del voto lo dice.');
  await evaluate(`(async () => {
    const { store } = await import('/src/core/store.js?v=${version}'); const L = await import('/src/core/legislature-engine.js?v=${version}');
    const geography = await (await fetch('/src/data/real/electoral-geography.json')).json();
    store.setElectoralGeography(geography);
    const s = store.getState();
    const vote = L.runNationalVote({ geography, world: s.world, coalitions: [], date: '2027-09-26', noise: false });
    s.national.lastPolitiche = { ...L.compactResult(vote), id: 'politiche-2027-09-26', date: '2027-09-26' };
    s.national.votes = [...(s.national.votes ?? []), { id: 'v1', type: 'politiche', date: '2022-09-25', lists: vote.national.slice(0, 5).map(row => ({ id: row.id, label: row.label ?? row.id, share: row.share, seats: 0 })) }, { id: 'v2', type: 'politiche', date: '2027-09-26', lists: vote.national.slice(0, 5).map((row, i) => ({ id: row.id, label: row.label ?? row.id, share: row.share + (i % 2 ? -1 : 1.5), seats: 0 })) }];
    return true; })()`);
  await evaluate(`location.hash = '#panoramica'; true`); await pause(500); await evaluate(`location.hash = '#risultati'; true`); await pause(2500);
  const html = await evaluate(`document.querySelector('[data-territory-page-root]')?.innerHTML ?? ''`);
  assert.ok(/data-territory-table="italia"/.test(html) && (html.match(/data-territory-row/g) ?? []).length === 20, 'Dopo il voto: le venti regioni.');
  assert.ok(/data-territory-compare="table"/.test(html), 'Il confronto tra due voti.');
  await evaluate(`(() => { const f = document.querySelector('[data-territory-form]'); f.q.value = 'roma'; f.requestSubmit(); return true; })()`); await pause(1200);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-territory-hit]'))`), 'La ricerca del comune dà risultati.');
  await evaluate(`document.querySelector('[data-territory-hit]').click(); true`); await pause(1500);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-territory-table="provincia"]')) && Boolean(document.querySelector('[data-territory-pager]'))`), 'Il risultato apre la provincia, con le pagine.');
  await evaluate(`document.querySelector('[data-territory-pager] [data-view-filter-value="2"]').click(); true`); await pause(1200);
  assert.match(await evaluate(`document.querySelector('[data-territory-pager]').innerText`), /Pagina 2 di/, 'Si passa alla pagina seguente.');
  await evaluate(`document.querySelector('[data-territory-reset]').click(); true`); await pause(1000);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-territory-table="italia"]'))`), 'Azzera riporta all’Italia.');
  const text = await evaluate(`document.querySelector('[data-territory-page-root]')?.innerText ?? ''`);
  assert.match(text, /Dati reali, simulati e stime/); assert.match(text, /RISULTATO SIMULATO|NESSUN VOTO/);
  assert.ok(!/NaN|undefined|\[object/.test(text), 'Nessun valore rotto.');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await pause(500);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), true, 'Nessuno scorrimento orizzontale a 360 px.');
  assert.deepEqual(errors.filter(item => !/favicon/.test(String(item))), [], 'Nessun errore JavaScript.');
  console.log('check-territory-page-browser: ok');
});
