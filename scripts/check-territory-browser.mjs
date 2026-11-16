// "Risultati per territorio" in Chrome (desktop and phone): after a simulated general election the card lists the 20 regions; a click opens a region (its provinces) and a province (its comuni), the
// breadcrumb goes back; the sum line and the «dato simulato» source are on screen; no horizontal scroll at 390 px; the tables become cards on the phone. Skipped without Chrome. QA_SHOT_DIR keeps screenshots.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Risultati per territorio nel browser saltati: Chrome non trovato (imposta CHROME_PATH per eseguirli).'); process.exit(0); }
const shotDir = process.env.QA_SHOT_DIR; if (shotDir) mkdirSync(shotDir, { recursive: true });
await withBrowser(async browser => {
  const { evaluate, waitFor: wait, pause, viewport, errors, version } = browser;
  const screenshot = async name => { if (shotDir) await browser.screenshot(`${shotDir}/${name}.png`); };
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ' + ${JSON.stringify(selector)}); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
  await createCareerInPage(browser, { weeks: 2 });
  await openCareer(browser);
  // a real simulated vote on the real map, put in the live state (the page draws what the state holds)
  await evaluate(`(async () => {
    const { store } = await import('/src/core/store.js?v=${version}'); const L = await import('/src/core/legislature-engine.js?v=${version}');
    const geography = await (await fetch('/src/data/real/electoral-geography.json')).json();
    store.setElectoralGeography(geography);
    const s = store.getState();
    const vote = L.runNationalVote({ geography, world: s.world, coalitions: [], date: '2027-09-26', noise: false });
    s.national.lastPolitiche = { ...L.compactResult(vote), id: 'politiche-2027-09-26', date: '2027-09-26' };
    return true; })()`);
  await evaluate(`location.hash = '#elezioni'; true`);
  await pause(500);
  await evaluate(`(() => { const tab = [...document.querySelectorAll('button, a, [role="tab"]')].find(el => /^\\s*Nazionali\\s*$/i.test(el.textContent)); tab?.click(); return true; })()`);
  await wait(() => has('details[data-fold-id="nv-territorio"], #nv-territorio, [data-fold="nv-territorio"]').catch(() => false), 15000).catch(() => {});
  // like a player: close the weekly-news popup if it is up, open the fold with a click (the state of the fold is kept across the redraws a click on a region causes)
  await evaluate(`(() => { document.querySelector('.modal-close, [data-close-modal], .week-popup [data-popup-close]')?.click(); [...document.querySelectorAll('button')].find(el => /^\\s*Chiudi\\s*$/.test(el.textContent))?.click(); return true; })()`);
  await evaluate(`(() => { const d = [...document.querySelectorAll('details')].find(el => /RISULTATI PER TERRITORIO/.test(el.textContent.slice(0, 160))); if (d && !d.open) d.querySelector('summary').click(); return true; })()`);
  await wait(() => has('[data-territory-table="italia"]'), 15000);
  for (const [name, w, h, mobile] of [['desktop', 1280, 900, false], ['smartphone', 390, 800, true]]) {
    await viewport(w, h, mobile); await pause(400);
    // on a phone the folds start closed (responsive accordion): the player opens it with a tap
    await evaluate(`(() => { const d = document.querySelector('[data-territory-table]').closest('details'); if (!d.open) d.querySelector('summary').click(); return true; })()`); await pause(300);
    assert.equal(await evaluate(`document.querySelectorAll('[data-territory-table="italia"] [data-territory-row]').length`), 20, `${name}: venti regioni.`);
    assert.ok(await evaluate(`/Somma controllata/.test(document.querySelector('[data-territory-sum]').textContent) && /Dato simulato/.test(document.querySelector('[data-territory-source]').textContent)`), `${name}: somma e fonte a vista.`);
    const over = await evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    assert.ok(over <= 1, `${name}: nessuno scroll orizzontale (${over}).`);
    await evaluate(`document.querySelector('[data-territory-table]').scrollIntoView({ block: 'center' }); true`); await pause(200);
    await screenshot(`territorio-italia-${name}`);
    // region → province → comune
    await click('[data-territory-open]'); await wait(() => has('[data-territory-table="regione"]'), 8000);
    assert.ok(await evaluate(`document.querySelector('[data-territory-table]').closest('details').open`), `${name}: la scheda resta aperta dopo il clic su una regione.`);
    assert.ok(await evaluate(`document.querySelectorAll('[data-territory-table="regione"] [data-territory-row]').length >= 1 && /province sommano la regione/.test(document.querySelector('[data-territory-sum]').textContent)`), `${name}: province con somma.`);
    await screenshot(`territorio-regione-${name}`);
    await click('[data-territory-open]'); await wait(() => has('[data-territory-table="provincia"]'), 8000);
    assert.ok(await evaluate(`document.querySelectorAll('[data-territory-table="provincia"] [data-territory-row]').length >= 1 && !document.querySelector('[data-territory-table="provincia"] [data-territory-open]')`), `${name}: comuni, senza ulteriore apertura.`);
    await screenshot(`territorio-provincia-${name}`);
    // back to Italy by the breadcrumb
    await click('.nv-crumbs button[data-view-filter-value=""]'); await wait(() => has('[data-territory-table="italia"]'), 8000);
  }
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource/.test(String(item))), [], 'Nessun errore in console.');
});
console.log('Risultati per territorio nel browser: Italia → regione → provincia → comune, indietro dalla briciola, desktop e smartphone senza scroll orizzontale.');
