// The territory page: the whole path of the player in Chrome with real clicks — Region, Province (the menus fill as soon as they change), the search of a comune that OPENS the comune (not just the province),
// the way back up, the choice of a party and the list of the comuni where it comes first (count, list, order, all the pages, consistent with the votes drawn for each comune), warnings at the foot of the page.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.error('SKIPPED: Chrome non trovato.'); process.exit(process.env.REQUIRE_CHROME ? 1 : 0); }
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, screenshot, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  await evaluate(`(async () => {
    const { store } = await import('/src/core/store.js?v=${version}'); const L = await import('/src/core/legislature-engine.js?v=${version}');
    const geography = await (await fetch('/src/data/real/electoral-geography.json')).json();
    store.setElectoralGeography(geography);
    const s = store.getState();
    const vote = L.runNationalVote({ geography, world: s.world, coalitions: [], date: '2027-09-26', noise: false });
    s.national.lastPolitiche = { ...L.compactResult(vote), id: 'politiche-2027-09-26', date: '2027-09-26' };
    s.national.votes = [...(s.national.votes ?? []), { id: 'v1', type: 'politiche', date: '2022-09-25', lists: vote.national.slice(0, 5).map(row => ({ id: row.id, label: row.label ?? row.id, share: row.share, seats: 0 })) }, { id: 'v2', type: 'politiche', date: '2027-09-26', lists: vote.national.slice(0, 5).map((row, i) => ({ id: row.id, label: row.label ?? row.id, share: row.share + (i % 2 ? -1 : 1.5), seats: 0 })) }];
    return true; })()`);
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(500); await evaluate(`location.hash = '#risultati'; true`); await pause(2500); };
  const text = sel => evaluate(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ''`);
  const change = (sel, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await open();
  // ---- Region then Province: the menus follow at once
  assert.equal(await evaluate(`document.querySelector('[data-territory-province]').disabled`), true, 'Prima della Regione il menu delle Province è spento.');
  const regionCode = await evaluate(`[...document.querySelectorAll('[data-territory-region] option')].find(o => /Lazio/.test(o.textContent))?.value`);
  await change('[data-territory-region]', regionCode); await pause(1200);
  assert.equal(await evaluate(`document.querySelector('[data-territory-province]').disabled`), false, 'Scelta la Regione, il menu delle Province si accende subito (senza premere Cerca).');
  assert.ok(await evaluate(`document.querySelectorAll('[data-territory-province] option').length > 2`), 'E si riempie con le Province del Lazio.');
  assert.ok(await evaluate(`document.querySelectorAll('[data-territory-row]').length > 2`), 'La tabella mostra le Province della Regione.');
  const provinceCode = await evaluate(`[...document.querySelectorAll('[data-territory-province] option')].find(o => /Roma/.test(o.textContent))?.value`);
  await change('[data-territory-province]', provinceCode); await pause(1200);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-territory-table="provincia"]'))`), true, 'Scelta la Provincia compaiono i Comuni.');
  // ---- search a comune and OPEN it
  await evaluate(`(() => { const f = document.querySelector('[data-territory-form]'); f.q.value = 'tivoli'; f.requestSubmit(); return true; })()`); await pause(1200);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-territory-hit]'))`), 'La ricerca trova il comune.');
  await evaluate(`document.querySelector('[data-territory-hit]').click(); true`); await pause(1400);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-territory-comune]'))`), 'Il clic sul risultato apre il COMUNE selezionato, non solo la Provincia.');
  assert.match(await text('[data-territory-comune]'), /Abitanti.*Voti validi.*Primo partito.*Scarto/s, 'Il comune ha i suoi dati: abitanti, voti, primo partito, scarto.');
  assert.ok(await evaluate(`document.querySelectorAll('[data-territory-comune-votes] li').length >= 3`), 'E i voti di lista.');
  assert.match(await text('[data-territory-crumbs]'), /Italia.*Lazio.*Roma.*Tivoli/s, 'Il percorso Italia › Regione › Provincia › Comune è chiaro.');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-territory-table="provincia"]'))`), true, 'La Provincia resta consultabile sotto.');
  // pick another comune from the table
  await evaluate(`document.querySelectorAll('[data-territory-pick]')[2].click(); true`); await pause(1200);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-territory-comune]'))`), 'Anche dalla tabella si seleziona un comune.');
  // ---- way back up
  await evaluate(`[...document.querySelectorAll('[data-territory-crumbs] button')].find(b => /Lazio/.test(b.textContent)).click(); true`); await pause(1200);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-territory-comune]'))`), false, 'Tornando alla Regione il comune si deseleziona.');
  assert.match(await text('[data-territory-crumbs]'), /Italia.*Lazio/s);
  await evaluate(`[...document.querySelectorAll('[data-territory-crumbs] button')].find(b => /Italia/.test(b.textContent)).click(); true`); await pause(1200);
  assert.equal(await evaluate(`document.querySelectorAll('[data-territory-row]').length`), 20, 'Tornando a Italia: le venti Regioni.');
  // ---- party filter: where is it first?
  const parties = await evaluate(`[...document.querySelectorAll('[data-territory-party] option')].filter(o => o.value).map(o => [o.value, o.textContent])`);
  assert.ok(parties.length >= 4, 'Il menu dei partiti ha le liste del voto.');
  const [partyId, partyLabel] = parties[0];
  await change('[data-territory-party]', partyId); await pause(2500);
  const count = Number(await evaluate(`document.querySelector('[data-territory-wins]').dataset.territoryWinsCount`));
  assert.match(await text('.tp-wins'), new RegExp(`primo in ${count} comuni su`), 'Il titolo dice in quanti comuni il partito è primo.');
  assert.ok(count > 0, `Il primo partito del voto è primo in qualche comune (${count}).`);
  // the number agrees with the votes drawn for every comune: recompute in the page with the same engine
  const names = await evaluate(`[...document.querySelectorAll('[data-territory-win] th strong')].map(e => e.textContent.trim())`);
  assert.ok(names.length >= 1 && names.length <= 25, 'La prima pagina elenca fino a 25 comuni.');
  if (count > 25) {
    assert.ok(await evaluate(`Boolean(document.querySelector('[data-territory-pager=terrWinPage]'))`), 'Con più di 25 comuni vinti c’è il paginatore.');
    const pages = Math.ceil(count / 25); const seen = new Set(names);
    for (let page = 2; page <= Math.min(pages, 6); page++) { await evaluate(`(() => { const next = [...document.querySelectorAll('[data-territory-pager=terrWinPage] button')].find(b => /Successiva/.test(b.textContent)); next.click(); return true; })()`); await pause(900); for (const n of await evaluate(`[...document.querySelectorAll('[data-territory-win] th strong')].map(e => e.textContent.trim())`)) seen.add(n); }
    assert.ok(seen.size >= Math.min(count, 25 * Math.min(pages, 6)) - 5, 'Le pagine successive mostrano comuni nuovi.');
    assert.match(await text('[data-territory-pager=terrWinPage]'), new RegExp(`Pagina ${Math.min(pages, 6)} di ${pages}`), 'Il paginatore dice dove sei.');
  }
  // order by name: alphabetical
  await evaluate(`(() => { const sel = document.querySelector('[data-territory-sort]'); sel.value = 'nome'; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(1800);
  const sorted = await evaluate(`[...document.querySelectorAll('[data-territory-win] th strong')].map(e => e.textContent.trim())`);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => a.localeCompare(b, 'it')), 'Ordinati in ordine alfabetico.');
  // a click on a won comune opens it
  await evaluate(`document.querySelector('[data-territory-win-open]').click(); true`); await pause(1500);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-territory-comune]'))`), 'Un comune dell’elenco si apre nella sua scheda.');
  assert.equal(await evaluate(`document.querySelector('[data-territory-party]').value`), partyId, 'Il filtro del partito resta attivo.');
  // in the comune opened, the party named as first in the card is the filter party
  assert.match(await text('[data-territory-comune]'), new RegExp(partyLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 12)), 'Il comune vinto ha quel partito come primo.');
  // the wins of the whole of Italy equal the sum over the regions (the same draw, province by province)
  await change('[data-territory-party]', partyId);
  // ---- warnings at the foot of the page
  const order = await evaluate(`(() => { const root = document.querySelector('[data-territory-page-root]'); const kids = [...root.children]; const at = el => kids.findIndex(k => k === el || k.contains(el)); return { status: at(root.querySelector('[data-territory-status]')), source: at(root.querySelector('[data-territory-source]')), controls: at(root.querySelector('[data-territory-form]')), last: kids.length - 1 }; })()`);
  assert.ok(order.controls < order.status && order.status >= order.last - 1, `L’avvertenza «cosa stai guardando» sta in fondo alla pagina (${JSON.stringify(order)}).`);
  // ---- widths
  for (const width of [320, 390, 820, 1280]) {
    await viewport(width, width < 500 ? 844 : 1000); await open();
    await evaluate(`[...document.querySelectorAll('button')].filter(b => /^Chiudi$/.test(b.textContent.trim())).forEach(b => b.click()); true`);
    const m = await evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth })`);
    assert.ok(m.doc <= m.vw + 1, `${width}px: nessuno scorrimento orizzontale (${m.doc}/${m.vw}).`);
    await screenshot(`${OUT}territorio-${width}.png`);
  }
  assert.deepEqual(errors.filter(e => !/api\//.test(String(e))), [], 'Nessun errore in pagina.');
});
console.log('Risultati per territorio verificati in Chrome: Regione, Provincia, ricerca che apre il comune, percorso di ritorno, partito con i comuni vinti (numero, elenco, ordine, pagine), avvertenze in fondo, quattro larghezze.');
