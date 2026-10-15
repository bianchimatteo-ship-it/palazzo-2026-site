// The Parlamento page in Chrome: every seat of the hemicycle can be chosen, from the drawing and from a searchable list of the members, and the two stay in step.
//   - Camera and Senato: one dot and one row per seat (399 and 206), the list shows 40 at a time, "Mostra altri" brings more; no seat is left out;
//   - search (name, group, party, territory, id) and the territory filter narrow the list and fade the dots that do not match; the reset restores everything;
//   - a row selects the seat (highlighted dot, card with the same name, the card in view on a phone); a dot opens its card, and the card's "Mostra nell’elenco" brings its row in view;
//   - a seat of the scenario that the verified archive has no member for is a person of the simulation, found by search, with a full name, a persistent id (the same after a reload) and a badge;
//   - the council of a Comune (Territori): its dots open the card with the id and the badge, and its list is searchable;
//   - at 390 px (a phone): no horizontal scroll, touch targets of at least 40 px, no horizontal overflow of the list.
// Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Elenco dei parlamentari saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, errors } = browser;
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', level: 'deputato', weeks: 1 });
  await openCareer(browser);
  const go = async page => { await evaluate(`document.querySelector('[data-nav="${page}"]')?.click(), true`); await pause(500); };
  const rows = () => evaluate(`[...document.querySelectorAll('.hemi-roster-list > li > button')].map(button => ({ key: button.dataset.hemiSeat, name: button.querySelector('strong')?.textContent ?? '', detail: button.querySelector('small')?.textContent ?? '', badge: button.querySelector('.sx-badge')?.textContent ?? '', active: button.classList.contains('active') }))`);
  const dots = () => evaluate(`({ total: document.querySelectorAll('circle.hemi-seat').length, dim: document.querySelectorAll('circle.hemi-seat.is-dim').length, selected: document.querySelectorAll('circle.hemi-seat.is-selected').length, selectedKey: document.querySelector('circle.hemi-seat.is-selected')?.dataset.hemiSeat ?? null })`);
  const head = () => evaluate(`document.querySelector('.hemi-roster-head b')?.textContent ?? ''`);
  const setField = (selector, value) => evaluate(`(async () => { const field = document.querySelector(${JSON.stringify(selector)}); field.value = ${JSON.stringify(value)}; field.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 500)); return true; })()`);
  const click = selector => evaluate(`(async () => { document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 600)); return true; })()`);
  const reset = () => click('[data-hemi-reset]');

  await go('parlamento');
  await waitFor(() => evaluate(`document.querySelectorAll('.hemi-roster-list > li').length > 0`), 60000);

  // ---------- 1. every seat has a dot and a row ----------
  for (const [chamber, expected] of [['camera', 399], ['senato', 206]]) {
    if (chamber === 'senato') { await click('[data-hemi-chamber="senato"]'); await waitFor(() => evaluate(`document.querySelectorAll('circle.hemi-seat').length === ${expected}`)); }
    let state = await dots();
    assert.equal(state.total, expected, `${chamber}: un punto per seggio.`);
    assert.match(await head(), new RegExp(`^${expected} seggi`), `${chamber}: l’elenco dice ${expected} seggi.`);
    assert.equal((await rows()).length, 40, `${chamber}: 40 righe per volta.`);
    let guard = 0;
    while (await evaluate(`Boolean(document.querySelector('[data-hemi-more]'))`) && guard++ < 20) await click('[data-hemi-more]');
    const all = await rows();
    assert.equal(all.length, expected, `${chamber}: dopo «Mostra altri» le righe sono ${expected}.`);
    const keys = await evaluate(`[...document.querySelectorAll('circle.hemi-seat')].map(dot => dot.dataset.hemiSeat)`);
    assert.deepEqual(all.map(row => row.key).sort(), [...keys].sort(), `${chamber}: righe e punti sono gli stessi seggi.`);
    assert.ok(all.every(row => row.name.trim().split(/\s+/).length >= 2), `${chamber}: ogni seggio ha un nome e un cognome.`);
    assert.ok(all.every(row => ['Dato reale', 'Simulato', 'Tu'].includes(row.badge)), `${chamber}: ogni riga ha il suo distintivo (${[...new Set(all.map(row => row.badge))]}).`);
  }
  await click('[data-hemi-chamber="camera"]');
  await waitFor(() => evaluate(`document.querySelectorAll('circle.hemi-seat').length === 399`));

  // ---------- 2. search, territory, reset ----------
  await setField('[data-hemi-filter="q"]', 'AIELLO');
  let found = await rows();
  assert.ok(found.length >= 1 && found.every(row => /aiello/i.test(row.name + row.detail)), `La ricerca «AIELLO» trova ${found.length} seggi, tutti pertinenti.`);
  let state = await dots();
  assert.equal(state.dim, 399 - found.length, 'I punti che non corrispondono sono attenuati.');
  assert.match(await head(), new RegExp(`^${found.length} di 399`), 'L’elenco dice quanti su quanti.');
  await setField('[data-hemi-filter="q"]', 'zzzzqq');
  assert.equal((await rows()).length, 0); assert.ok(await evaluate(`document.body.textContent.includes('Nessun seggio corrisponde')`), 'Nessun risultato: lo dice.');
  await reset();
  assert.equal((await dots()).dim, 0, 'Azzera filtri: nessun punto attenuato.');
  assert.equal(await evaluate(`document.querySelector('[data-hemi-filter="q"]').value`), '', 'E la ricerca è vuota.');
  const territories = await evaluate(`[...document.querySelectorAll('[data-hemi-filter="territory"] option')].map(option => ({ value: option.value, text: option.textContent }))`);
  const sicilia = territories.find(option => option.value === 'Sicilia 1');
  assert.ok(territories.length > 20 && sicilia, `Il filtro per territorio elenca ${territories.length} voci.`);
  await setField('[data-hemi-filter="territory"]', 'Sicilia 1');
  found = await rows();
  assert.equal(found.length, Number(/· (\d+)$/.exec(sicilia.text)[1]), 'Sicilia 1: tanti seggi quanti dice il filtro.');
  assert.ok(found.every(row => /Sicilia 1/.test(row.detail)), 'Tutti di Sicilia 1.');
  await setField('[data-hemi-filter="q"]', found[0].name.split(/\s+/).at(-1));
  assert.ok((await rows()).some(row => row.key === found[0].key), 'Territorio e ricerca insieme.');
  await reset();

  // ---------- 3. row → dot + card; dot → card + row ----------
  found = await rows();
  const pick = found[7];
  await click(`.hemi-roster-list button[data-hemi-seat="${pick.key}"]`);
  state = await dots();
  assert.equal(state.selectedKey, pick.key, 'Il punto del seggio scelto dall’elenco è evidenziato.');
  const cardName = await evaluate(`document.querySelector('.hemi-card h3')?.textContent ?? ''`);
  assert.equal(cardName.toLowerCase(), pick.name.toLowerCase(), 'La scheda è della persona scelta.');
  assert.ok((await rows()).find(row => row.key === pick.key)?.active, 'La riga resta evidenziata.');
  await click('[data-hemi-close]');
  assert.equal((await dots()).selected, 0, 'Chiudendo la scheda nessun punto è scelto.');
  // a dot far down the alphabet: its card brings its row in view
  const lastKey = await evaluate(`(async () => { document.querySelector('[data-hemi-reset]')?.click(); return [...document.querySelectorAll('circle.hemi-seat')].at(-1).dataset.hemiSeat; })()`);
  await click(`circle.hemi-seat[data-hemi-seat="${lastKey}"]`);
  assert.equal((await dots()).selectedKey, lastKey, 'Un punto si sceglie anche dal disegno.');
  assert.ok(await evaluate(`Boolean(document.querySelector('.hemi-card'))`) && !(await evaluate(`document.querySelector('.hemi-card').classList.contains('is-empty')`)), 'E apre la scheda.');
  await click('[data-hemi-locate]');
  const visible = await evaluate(`(() => { const row = document.querySelector('.hemi-roster-list .active'); if (!row) return null; const box = row.getBoundingClientRect(), list = row.closest('.hemi-roster-list').getBoundingClientRect(); return { inList: box.top >= list.top - 1 && box.bottom <= list.bottom + 1, key: row.dataset.hemiSeat }; })()`);
  assert.ok(visible && visible.key === lastKey && visible.inList, '«Mostra nell’elenco» porta la riga del seggio in vista, anche se era oltre la prima pagina.');

  // ---------- 4. a seat without a member in the archive: a person of the simulation ----------
  await click('[data-hemi-chamber="senato"]');
  await waitFor(() => evaluate(`document.querySelectorAll('circle.hemi-seat').length === 206`));
  await setField('[data-hemi-filter="q"]', 'persona-seggio');
  found = await rows();
  assert.ok(found.length >= 1 && found.every(row => row.badge === 'Simulato' && row.name.trim().split(/\s+/).length >= 2), `Si trovano per identificativo (${found.length} seggio/i simulato/i, con nome e cognome).`);
  await click(`.hemi-roster-list button[data-hemi-seat="${found[0].key}"]`);
  const ghost = await evaluate(`({ badge: document.querySelector('.hemi-card .sx-badge')?.textContent ?? '', id: document.querySelector('.hemi-card code')?.textContent ?? '', name: document.querySelector('.hemi-card h3')?.textContent ?? '', note: document.querySelector('.hemi-card .sx-note')?.textContent ?? '' })`);
  assert.equal(ghost.badge, 'SIMULATO'); assert.match(ghost.id, /^persona-seggio-[\da-z]+$/); assert.equal(ghost.name, found[0].name);
  assert.match(ghost.note, /non sostituisce nessun parlamentare reale/, 'La scheda dice che non sostituisce nessuno.');
  // the same person after the page is loaded again
  await browser.goto();
  await openCareer(browser);
  await go('parlamento');
  await waitFor(() => evaluate(`document.querySelectorAll('.hemi-roster-list > li').length > 0`), 60000);
  await click('[data-hemi-chamber="senato"]');
  await waitFor(() => evaluate(`document.querySelectorAll('circle.hemi-seat').length === 206`));
  await setField('[data-hemi-filter="q"]', ghost.id);
  const again = await rows();
  assert.equal(again.length, 1); assert.equal(again[0].name, ghost.name, 'Dopo aver ricaricato è la stessa persona, con lo stesso nome e lo stesso identificativo.');
  await reset();

  // ---------- 5. a phone ----------
  await viewport(390, 844, true);
  await pause(400);
  await go('parlamento');
  await waitFor(() => evaluate(`document.querySelectorAll('.hemi-roster-list > li').length > 0`), 60000);
  await click('[data-hemi-chamber="camera"]');
  await waitFor(() => evaluate(`document.querySelectorAll('circle.hemi-seat').length === 399`));
  const phone = await evaluate(`(() => { const buttons = [...document.querySelectorAll('.hemi-roster-list button')]; return { overflow: document.documentElement.scrollWidth - window.innerWidth, minHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)), wide: buttons.filter(button => button.scrollWidth > button.clientWidth + 1).length, search: document.querySelector('[data-hemi-filter="q"]').getBoundingClientRect().height }; })()`);
  assert.ok(phone.overflow <= 1, `A 390 px nessuno scroll orizzontale (${phone.overflow}).`);
  assert.ok(phone.minHeight >= 40, `Le righe dell’elenco si toccano bene (${phone.minHeight} px).`);
  assert.equal(phone.wide, 0, 'Nessuna riga esce dal proprio riquadro.');
  assert.ok(phone.search >= 38, 'Il campo di ricerca è alto abbastanza.');
  await click('.hemi-roster-list button');
  const onScreen = await evaluate(`(() => { const box = document.querySelector('.hemi-card').getBoundingClientRect(); return box.top < window.innerHeight && box.bottom > 0; })()`);
  assert.ok(onScreen, 'Scegliendo una riga, la scheda è in vista anche sul telefono.');
  await viewport(1280, 800, false);
  await pause(400);

  // ---------- 6. the council of the Comune ----------
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', level: 'comunale', weeks: 2, name: ['Elena', 'Consiglio'] });
  await openCareer(browser);
  await go('territori');
  await waitFor(() => evaluate(`document.querySelectorAll('.local-institutions circle.hemi-seat[data-local-seat]').length > 0`), 60000);
  const seats = await evaluate(`document.querySelectorAll('.local-institutions circle.hemi-seat[data-local-seat]').length`);
  await evaluate(`document.querySelectorAll('.local-roster-list').forEach(details => details.open = true), true`);
  const councilRows = await evaluate(`[...document.querySelectorAll('.local-roster-list .hemi-roster-list button')].map(button => ({ key: button.dataset.localSeat, name: button.querySelector('strong')?.textContent ?? '', badge: button.querySelector('.sx-badge')?.textContent ?? '' }))`);
  assert.equal(councilRows.length, Math.min(seats, 60), `Il consiglio ha ${seats} seggi: tutti nell’elenco (fino a 60 alla volta).`);
  assert.ok(councilRows.every(row => row.name.trim().split(/\s+/).length >= 2 && ['Tu', 'Simulato'].includes(row.badge)), 'Ogni consigliere ha nome, cognome e distintivo.');
  await click(`.local-institutions circle.hemi-seat[data-local-seat="${councilRows.find(row => row.badge === 'Simulato').key}"]`);
  const council = await evaluate(`({ badge: document.querySelector('.local-seat-card .sx-badge')?.textContent ?? '', id: document.querySelector('.local-seat-card code')?.textContent ?? '', name: document.querySelector('.local-seat-card strong')?.textContent ?? '', active: document.querySelector('.local-roster-list .hemi-roster-list .active strong')?.textContent ?? '' })`);
  assert.equal(council.badge, 'SIMULATO'); assert.match(council.id, /^persona-/); assert.equal(council.active, council.name, 'Il punto scelto e la riga dell’elenco sono lo stesso consigliere.');
  await evaluate(`document.querySelectorAll('.local-roster-list').forEach(details => details.open = true), true`);
  await setField('[data-local-search]', council.name.split(/\s+/).at(-1));
  const narrowed = await evaluate(`[...document.querySelectorAll('.local-roster-list .hemi-roster-list strong')].map(item => item.textContent)`);
  assert.ok(narrowed.length >= 1 && narrowed.length <= councilRows.length && narrowed.includes(council.name), 'La ricerca restringe l’elenco del consiglio.');
  assert.deepEqual(errors, [], `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
  console.log(`Elenco dei parlamentari verificato in Chrome: Camera (399) e Senato (206) con un punto e una riga per seggio, 40 righe per volta, ricerca per nome/gruppo/partito/territorio/identificativo e filtro per territorio che attenuano i punti, scelta dall’elenco e dal disegno che si corrispondono, «Mostra nell’elenco», seggi senza componente nell’archivio come persone simulate con nome, identificativo fisso (anche dopo il ricaricamento) e distintivo, telefono a 390 px senza scroll orizzontale; consiglio di un Comune con ${seats} seggi, schede con identificativo e distintivo ed elenco ricercabile.`);
}, {});
