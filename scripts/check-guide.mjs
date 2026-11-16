// The complete guide «Come giocare»: the manual has an entry for every function of the game (list of the checklist 15.1) with how it works, how it is used, requirements, costs, consequences and an
// example; six guided scenarios with steps that link to real pages; every link points to a page that exists; the search finds a topic by its words and by its keywords; the links close the menu and open the
// page; the page fits a phone (390 px) and a tablet (820 px) without sideways scroll; the Italian texts have an English counterpart. Chrome part skipped without Chrome. QA_SHOT_DIR keeps screenshots.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { GUIDE_FUNCTIONS, GUIDE_SCENARIOS } from '../src/data/guide-manual.js';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const PAGES = new Set(['panoramica', 'carriera', 'calendario', 'eventi', 'ricompense', 'partito', 'finanze', 'partiti-lista', 'elezioni', 'sondaggi', 'parlamento', 'governo', 'diplomazia', 'quirinale', 'leggi', 'iniziative', 'territori', 'notizie', 'archivio', 'politici', 'profilo', 'impostazioni']);
const PARTS = ['how', 'use', 'needs', 'costs', 'effects', 'example'];
// ---------- 1. the data ----------
const ids = GUIDE_FUNCTIONS.map(item => item.id);
assert.equal(new Set(ids).size, ids.length, 'Identificativi unici.');
for (const item of GUIDE_FUNCTIONS) {
  assert.ok(item.title && item.icon && PAGES.has(item.page), `${item.id}: titolo, icona e pagina esistente.`);
  for (const part of PARTS) assert.ok(typeof item[part] === 'string' && item[part].length >= 6, `${item.id}: «${part}» scritto.`);
}
for (const needed of ['carriera', 'partito', 'risorse', 'tempo', 'sondaggi', 'candidature', 'voto', 'alleanze', 'assemblee', 'leggi', 'iniziative', 'governo', 'quirinale', 'richieste', 'attivita', 'campagna', 'dimissioni', 'salvataggi', 'territori', 'notizie']) assert.ok(ids.includes(needed), `Il manuale tratta: ${needed}.`);
assert.ok(GUIDE_SCENARIOS.length >= 6, 'Almeno sei scenari guidati.');
for (const needed of ['fondare', 'sindaco', 'parlamento', 'coalizione', 'ministro', 'premier']) assert.ok(GUIDE_SCENARIOS.some(item => item.id === needed), `Scenario: ${needed}.`);
for (const scenario of GUIDE_SCENARIOS) { assert.ok(scenario.title && scenario.goal && scenario.steps.length >= 4, `${scenario.id}: obiettivo e passi.`); for (const [text, page] of scenario.steps) assert.ok(text.length > 10 && PAGES.has(page), `${scenario.id}: «${text}» porta a una pagina esistente.`); }
// the numbers the manual states are the ones of the engines
const { INITIATIVE_KINDS, SETUP_COST } = await import('../src/core/initiative-engine.js');
const { REQUEST_RULES, ACTIONS } = await import('../src/core/citizen-requests-engine.js');
const { OP_COSTS } = await import('../src/core/party-ops-engine.js');
const { WEEKLY_ACTION_POINTS } = await import('../src/data/simulation/career-rules.js');
const { REFUSAL_DAYS } = await import('../src/core/alliance-rules.js');
const text = id => PARTS.map(part => GUIDE_FUNCTIONS.find(item => item.id === id)[part]).join(' ');
assert.ok(text('iniziative').includes('50.000') && INITIATIVE_KINDS.popolare.required === 50000 && text('iniziative').includes('500.000') && INITIATIVE_KINDS.referendum.required === 500000, 'Soglie delle firme.');
assert.ok(text('iniziative').includes(String(SETUP_COST.popolare)) && text('iniziative').includes('4.000') && SETUP_COST.referendum === 4000, 'Costi di apertura delle iniziative.');
assert.ok(text('richieste').includes(`${REQUEST_RULES.lifeWeeks} settimane`) && text('richieste').includes('tre richieste') && REQUEST_RULES.maxOpen === 3, 'Durata e numero delle richieste.');
assert.ok(text('richieste').includes('1.500') && ACTIONS.diretto.cost.funds === 1500 && ACTIONS.diretto.cost.capital === 2 && ACTIONS.mozione.cost.capital === 1, 'Costi delle risposte alle richieste.');
assert.ok(text('risorse').includes('6 di capitale') && OP_COSTS.found.capital === 6 && OP_COSTS.found.funds === 1500, 'Costo del partito.');
assert.ok(text('tempo').includes(`${WEEKLY_ACTION_POINTS} giorni`) && WEEKLY_ACTION_POINTS === 6, 'Giorni a settimana.');
assert.ok(text('alleanze').includes(`${REFUSAL_DAYS} giorni`) && REFUSAL_DAYS === 7, 'Giorni del rifiuto.');

// ---------- 2. the phrase-book ----------
const pairs = (await import('../src/data/release-pairs.js')).ALL_PAIRS;
const known = new Set((Array.isArray(pairs) ? pairs : []).map(pair => pair[0]));
if (known.size) for (const item of GUIDE_FUNCTIONS) for (const part of [...PARTS, 'title']) assert.ok(known.has(item[part]), `${item.id}/${part}: frase inglese presente.`);

// ---------- 3. the page ----------
if (!chromeAvailable) { console.log('Guida verificata (dati, numeri e frasi); parte nel browser saltata: Chrome non trovato.'); process.exit(0); }
const shotDir = process.env.QA_SHOT_DIR; if (shotDir) mkdirSync(shotDir, { recursive: true });
await withBrowser(async browser => {
  const { evaluate, waitFor: wait, pause, viewport, errors } = browser;
  const shot = async name => { if (shotDir) await browser.screenshot(`${shotDir}/${name}.png`); };
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(400); };
  const search = async value => { await evaluate(`(() => { const box = document.querySelector('[data-guide-search]'); box.value = ${JSON.stringify(value)}; box.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await pause(150); };
  const shown = () => evaluate(`[...document.querySelectorAll('[data-guide-card]')].filter(el => !el.hidden).map(el => el.dataset.guideTopic ?? el.id)`);
  await createCareerInPage(browser, { weeks: 2 });
  await openCareer(browser);
  await click('[data-action=menu]'); await click('[data-menu=guida]');
  await wait(() => has('[data-guide-search]'), 8000);
  const total = await evaluate(`document.querySelectorAll('[data-guide-card]').length`);
  assert.ok(total >= 21 + GUIDE_FUNCTIONS.length + GUIDE_SCENARIOS.length, `Tutte le sezioni sono nella guida (${total}).`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-guide-kind="funzione"]').length`), GUIDE_FUNCTIONS.length, 'Una scheda per ogni funzione.');
  assert.equal(await evaluate(`document.querySelectorAll('[data-guide-kind="scenario"]').length`), GUIDE_SCENARIOS.length, 'Una scheda per ogni scenario.');
  for (const label of ['Come funziona', 'Come si usa', 'Requisiti', 'Costi', 'Conseguenze', 'Esempio']) assert.ok(await evaluate(`[...document.querySelectorAll('.guide-parts dt')].some(el => el.textContent === ${JSON.stringify(label)})`), `Ogni scheda ha «${label}».`);
  // search: by words and by keywords
  await search('dimissioni'); assert.ok((await shown()).includes('dimissioni'), 'La ricerca trova le dimissioni.');
  await search('firme'); assert.ok((await shown()).includes('iniziative'), 'La ricerca trova le iniziative per «firme».');
  await search('semestre bianco'); assert.ok((await shown()).includes('quirinale'), 'La ricerca legge anche il testo delle schede.');
  await search('veto'); assert.ok((await shown()).includes('alleanze'), 'La ricerca trova per parola chiave (veto).');
  await search('zzzxxx'); assert.equal((await shown()).length, 0); assert.ok(await evaluate(`!document.querySelector('[data-guide-empty]').hidden`), 'Nessun risultato: messaggio.');
  await search('');
  // a link leaves the guide for the page
  await evaluate(`document.querySelector('[data-guide-topic="iniziative"] [data-nav]').scrollIntoView({ block: 'center' }); true`);
  await shot('guida-funzione-desktop');
  await click('[data-guide-topic="iniziative"] [data-nav]');
  await wait(() => evaluate(`!document.querySelector('[data-guide-search]')`), 8000);
  assert.ok(await evaluate(`location.hash === '#iniziative' || /Iniziative/.test(document.querySelector('h1, .page-title, .page-head')?.textContent ?? '')`), 'Il collegamento apre la pagina delle iniziative.');
  // every «Vai» of every scenario and every «Apri la pagina» of every function really goes to its page and leaves the guide
  {
    const links = await evaluate(`[...document.querySelectorAll('.guide-card [data-nav]')].map(el => el.dataset.nav)`);
    assert.equal(links.length, GUIDE_SCENARIOS.reduce((n, item) => n + item.steps.length, 0) + GUIDE_FUNCTIONS.length, 'Un collegamento per ogni passo e per ogni funzione.');
    // the guide is open again after each jump
    for (let index = 0; index < links.length; index++) {
      if (!(await has('[data-guide-search]'))) { await click('[data-action=menu]'); await click('[data-menu=guida]'); await wait(() => has('[data-guide-search]'), 8000); }
      await evaluate(`document.querySelectorAll('.guide-card [data-nav]')[${index}].click(); true`); await pause(350);
      const here = await evaluate(`({ hash: location.hash, guide: Boolean(document.querySelector('[data-guide-search]')) })`);
      assert.ok(!here.guide, `Il collegamento ${index + 1} (${links[index]}) chiude la guida.`);
      assert.ok(here.hash === `#${links[index]}` || here.hash.startsWith(`#${links[index]}`), `Il collegamento ${index + 1} apre #${links[index]} (trovato ${here.hash}).`);
    }
    if (!(await has('[data-guide-search]'))) { await click('[data-action=menu]'); await click('[data-menu=guida]'); await wait(() => has('[data-guide-search]'), 8000); }
  }
  // the buttons are one pill with an arrow, thumb-sized
  assert.ok(await evaluate(`[...document.querySelectorAll('.guide-card .go-button')].every(el => el.querySelector('.go-arrow') && el.getBoundingClientRect().height >= 36)`), 'I pulsanti «Vai» hanno la freccia e si toccano bene.');
  // phone and tablet
  for (const [name, w, h, mobile] of [['smartphone', 390, 800, true], ['tablet', 820, 1100, true]]) {
    await viewport(w, h, mobile); await pause(300);
    await click('[data-action=menu]'); await click('[data-menu=guida]');
    await wait(() => has('[data-guide-search]'), 8000);
    const over = await evaluate(`Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelector('[data-guide-search]').closest('.menu-popup, .menu-side, body').scrollWidth - document.querySelector('[data-guide-search]').closest('.menu-popup, .menu-side, body').clientWidth)`);
    assert.ok(over <= 1, `${name}: nessuno scroll orizzontale (${over}).`);
    await evaluate(`document.querySelector('[data-guide-scenario], [data-guide-kind="scenario"]').scrollIntoView({ block: 'start' }); true`); await pause(200);
    await shot(`guida-scenari-${name}`);
    const small = await evaluate(`[...document.querySelectorAll('[data-guide-kind="funzione"] [data-nav], [data-guide-kind="scenario"] [data-nav]')].filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.height < 28; }).length`);
    assert.equal(small, 0, `${name}: i collegamenti si toccano bene.`);
    await click('[data-menu-close]');
  }
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource/.test(String(item))), [], 'Nessun errore in console.');
});
console.log('Guida verificata: 20 funzioni e 6 scenari con collegamenti alle pagine, numeri uguali a quelli dei motori, ricerca per testo e parole chiave, link che chiudono il menu, smartphone e tablet senza scroll orizzontale.');
