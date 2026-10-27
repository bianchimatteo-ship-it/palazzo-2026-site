// The state pills of the committees (Partito → Territorio), in Chrome with real clicks: they are buttons, each counts the committees of ALL Italy, and a click on one shows in «Rete dei comitati»
// every committee of that state in every region (and only those), turning on «Tutte le regioni»; the active pill is marked, «Tutti» takes the whole network back, the region selector narrows
// the result of a state to one region and every result card says its state, region, level and place.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Filtri dei comitati nel browser saltati: Chrome non trovato (imposta CHROME_PATH per eseguirli).'); process.exit(0); }

await withBrowser(async browser => {
  const { evaluate, waitFor, pause, version, errors } = browser;
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', level: 'deputato', weeks: 1 });
  await openCareer(browser);
  const click = async selector => { const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); assert.ok(ok, `manca ${selector}`); await pause(350); };
  await click('[data-nav=partito]');
  await click('[data-section-tab=partito][data-section-tab-value=territorio]');
  await waitFor(() => evaluate('Boolean(document.querySelector(".cm-panel .cm-grid"))'), 40000);

  // committees in several regions and in every state (the state of the game is edited in the page, then the page is drawn again)
  await evaluate(`(async () => {
    const { store } = await import('/src/core/store.js?v=${version}');
    const org = store.getState().game.party.org;
    const base = org.committees.find(item => item.level === 'comune') ?? org.committees[0];
    const states = ['fondazione', 'crescita', 'consolidamento', 'crisi', 'perdita-controllo', 'dissoluzione'];
    const regions = ['Lombardia', 'Campania', 'Sicilia', 'Veneto'];
    let n = 0;
    for (const region of regions) for (const status of states) for (let k = 0; k < (status === 'crisi' ? 2 : 1); k++) {
      org.committees.push({ ...structuredClone(base), id: 'prova-' + region + '-' + status + '-' + k, region, name: 'Luogo ' + (++n), level: ['regione', 'provincia', 'comune'][n % 3], unitCode: null, status });
    }
    org.committees.forEach((item, index) => { if (index % 5 === 0 && item.status !== 'dissoluzione') item.status = 'crisi'; });
    return org.committees.length;
  })()`);
  await click('[data-nav=panoramica]'); await click('[data-nav=partito]');
  await click('[data-section-tab=partito][data-section-tab-value=territorio]');
  await waitFor(() => evaluate('Boolean(document.querySelector(".cm-chips button.cm-chip"))'));

  const read = () => evaluate(`(() => ({
    region: document.querySelector('[data-view-filter-select="comitati-regione"]')?.value,
    title: [...document.querySelectorAll('.cm-panel .card h2, .cm-panel .sx-card-title, .cm-panel h3')].map(el => el.textContent.trim()).join('|'),
    pills: [...document.querySelectorAll('.cm-chips button.cm-chip')].map(el => ({ id: el.dataset.viewFilterValue, count: Number(el.dataset.chipCount), pressed: el.getAttribute('aria-pressed'), active: el.classList.contains('active') })),
    cards: [...document.querySelectorAll('.cm-grid .cm-card')].map(el => ({ status: el.dataset.status, region: el.dataset.region, level: el.dataset.level, name: el.querySelector('h4')?.textContent.trim(), text: el.querySelector('header')?.textContent.replace(/\\s+/g, ' ') })),
    empty: document.querySelector('.cm-grid .sx-empty')?.textContent ?? null
  }))()`);
  const truth = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return store.getState().game.party.org.committees.map(item => ({ id: item.id, status: item.status, region: item.region, name: item.name, level: item.level })); })()`);

  const all = await truth();
  const initial = await read();
  assert.ok(initial.pills.length === 7 && initial.pills[0].id === 'tutti', 'Sette pillole: «Tutti» e un filtro per stato.');
  for (const pill of initial.pills) assert.equal(pill.count, pill.id === 'tutti' ? all.length : all.filter(item => item.status === pill.id).length, `Pillola ${pill.id}: il conteggio è quello di tutta Italia.`);
  assert.ok(initial.region !== 'tutte', 'All’apertura il selettore è sulla regione di casa.');

  // ---------- «Crisi»: all of them, from every region, and only them ----------
  await click('.cm-chips button[data-view-filter-value="crisi"]');
  let view = await read();
  const crisis = all.filter(item => item.status === 'crisi');
  assert.ok(new Set(crisis.map(item => item.region)).size >= 3, 'La prova ha comitati in crisi in più regioni.');
  assert.equal(view.region, 'tutte', 'Il clic su una pillola accende «Tutte le regioni» nel selettore.');
  assert.deepEqual(view.cards.map(card => card.name).sort(), crisis.map(item => item.name).sort(), 'Cliccando «Crisi» compaiono tutti e soli i comitati in crisi.');
  assert.ok(view.cards.every(card => card.status === 'crisi'), 'Nessun comitato di un altro stato.');
  assert.ok(new Set(view.cards.map(card => card.region)).size >= 3, 'Di regioni diverse.');
  for (const card of view.cards) {
    const expected = crisis.find(item => item.name === card.name);
    assert.ok(card.text.includes(expected.region) && card.text.includes(expected.name) && /Crisi/.test(card.text) && /Comitato (regionale|provinciale|comunale)/i.test(card.text), `${card.name}: la scheda dice stato, regione, livello e luogo (${card.text}).`);
  }
  const pressed = view.pills.filter(pill => pill.pressed === 'true');
  assert.deepEqual(pressed.map(pill => pill.id), ['crisi'], 'La pillola attiva è «Crisi» e solo quella.');
  assert.ok(view.pills.find(pill => pill.id === 'crisi').active, 'Lo stato attivo è evidente (classe active).');
  assert.ok(view.title.includes('Tutte le regioni'), 'Il titolo della rete dice «Tutte le regioni».');

  // ---------- every state, one by one ----------
  for (const status of ['fondazione', 'crescita', 'consolidamento', 'perdita-controllo', 'dissoluzione']) {
    await click(`.cm-chips button[data-view-filter-value="${status}"]`);
    view = await read();
    const expected = all.filter(item => item.status === status);
    assert.deepEqual(view.cards.map(card => card.name).sort(), expected.map(item => item.name).sort(), `${status}: tutti e soli i comitati di quello stato, da tutte le regioni.`);
    assert.equal(view.region, 'tutte');
  }

  // ---------- the region selector narrows the state to one region ----------
  await click('.cm-chips button[data-view-filter-value="crisi"]');
  await evaluate(`(() => { const select = document.querySelector('[data-view-filter-select="comitati-regione"]'); select.value = 'Campania'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await pause(400);
  view = await read();
  assert.equal(view.region, 'Campania', 'Il selettore passa a una sola regione.');
  assert.deepEqual(view.cards.map(card => card.name).sort(), crisis.filter(item => item.region === 'Campania').map(item => item.name).sort(), 'Con la regione scelta restano i comitati in crisi di quella regione.');
  assert.ok(view.cards.every(card => card.region === 'Campania' && card.status === 'crisi'), 'Solo Campania, solo crisi.');
  const regional = view.pills.find(pill => pill.id === 'crisi');
  assert.equal(regional.count, crisis.length, 'Le pillole restano globali.');
  assert.equal(regional.pressed, 'false', 'Con una regione sola la pillola globale non è più «attiva» (il filtro è lo stesso, il perimetro no).');

  // ---------- «Tutti» takes the whole network back ----------
  await click('.cm-chips button[data-view-filter-value="tutti"]');
  view = await read();
  assert.equal(view.region, 'tutte', '«Tutti» riporta a tutte le regioni.');
  assert.equal(view.cards.length, all.length, `«Tutti» mostra l’intera rete (${all.length}).`);
  assert.deepEqual(view.pills.filter(pill => pill.pressed === 'true').map(pill => pill.id), ['tutti']);
  assert.deepEqual(errors, [], 'Nessun errore nella pagina.');
  console.log(`Filtri dei comitati in Chrome: ${all.length} comitati in ${new Set(all.map(item => item.region)).size} regioni; «Crisi» mostra tutti i ${crisis.length} comitati in crisi di ${new Set(crisis.map(item => item.region)).size} regioni, gli altri stati lo stesso, la regione sceglie il perimetro, «Tutti» ripristina la rete.`);
});
