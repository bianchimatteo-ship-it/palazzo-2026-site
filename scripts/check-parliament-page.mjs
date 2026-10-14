// Parlamento and Leggi pages. Parlamento: the interactive hemicycle first, then the cards of verified real
// parliamentarians (chosen deterministically, varied by chamber, week, scenario and role; never an unverified
// or former member), then composition, groups and majorities. Leggi: collapsible blocks (your initiatives,
// proposals, real acts, chronology), filters, «Mostra altre» on proposals and on the archive, simulated and real
// acts told apart. No horizontal scroll at 320–1280 px on both pages.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const db = { politicians: await read('politicians'), groups: await read('parliamentary-groups'), offices: await read('offices'), committees: await read('committees'), committeeMemberships: await read('committee-memberships') };
const { featuredMembers } = await import(`../src/core/featured-members.js${v}`);
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };

// ---------- 1. selection (no browser) ----------
const pick = (seed, extra = {}, data = db) => featuredMembers(data, { chamber: 'camera', seed, count: 6, ...extra });
const ids = picks => picks.map(item => item.person.id);
const first = pick('carriera-1|camera|1|cam-xix-03');
assert.deepEqual(ids(pick('carriera-1|camera|1|cam-xix-03')), ids(first), 'Stessa settimana, stessa scheda.');
check(first.length === 6 && new Set(ids(first)).size === 6, 'Sei parlamentari diversi.');
check(first.every(item => item.person.source === 'real' && item.person.verified === true && !item.person.termEnd && item.person.chamber === 'camera'), 'Solo parlamentari reali, verificati, in carica, della Camera scelta.');
// the dataset documents the group presidents of the Senate only: the Camera has none to show
check(!first.some(item => item.reason === 'capogruppo'), 'Alla Camera nessun presidente di gruppo inventato: il dataset non li documenta.');
check(first.some(item => item.reason === 'commissione' && /^(Presidente|Vicepresidente|Segretario|Questore)/i.test(item.detail ?? '')), 'Un ufficio di presidenza di commissione.');
check(new Set(first.map(item => item.person.groupId)).size >= 4, `Almeno quattro gruppi diversi (${new Set(first.map(item => item.person.groupId)).size}).`);
const weeks = Array.from({ length: 12 }, (_, week) => pick(`carriera-1|camera|${week + 1}|cam-xix-03`));
const sets = new Set(weeks.map(picks => ids(picks).sort().join()));
const seen = new Set(weeks.flatMap(ids));
check(sets.size >= 10, `La scelta cambia da una settimana all’altra (${sets.size}/12).`);
check(seen.size >= 30, `In dodici settimane compaiono almeno 30 persone diverse (${seen.size}).`);
check(ids(pick('carriera-2|camera|1|cam-xix-03')).join() !== ids(first).join(), 'Un altro scenario, altre schede.');
const senate = featuredMembers(db, { chamber: 'senato', seed: 'carriera-1|senato|1|-', count: 6 });
check(senate.length === 6 && senate.every(item => item.person.chamber === 'senato'), 'Il Senato ha schede del Senato.');
check(senate[0].reason === 'capogruppo' && /^Presidente del gruppo/.test(senate[0].detail ?? ''), 'Al Senato la prima scheda è un presidente di gruppo documentato.');
check(ids(senate).every(id => !ids(first).includes(id)), 'Camera e Senato non condividono persone.');
const ownGroup = pick('carriera-1|camera|1|cam-xix-03', { playerGroupId: 'cam-xix-03' });
check(ownGroup.some(item => item.reason === 'tuo-gruppo' && item.person.groupId === 'cam-xix-03'), 'Una scheda del gruppo del giocatore.');
const tuscany = pick('carriera-1|camera|1|cam-xix-03', { territoryHint: 'Toscana' });
check(tuscany.some(item => item.reason === 'tuo-territorio' && /toscana/i.test(item.person.circoscription ?? '')), 'Una scheda del territorio del giocatore.');
// forged records are never eligible
const forged = [
  { ...db.politicians.find(p => p.chamber === 'camera'), id: 'fake-1', fullName: 'FINTO UNO', verified: false },
  { ...db.politicians.find(p => p.chamber === 'camera'), id: 'fake-2', fullName: 'FINTO DUE', termEnd: '2024-01-01' },
  { ...db.politicians.find(p => p.chamber === 'camera'), id: 'fake-3', fullName: 'FINTO TRE', source: 'simulation' }
];
const poisoned = { ...db, politicians: [...forged, ...db.politicians] };
let leaked = 0;
for (let week = 0; week < 150; week++) for (const item of pick(`veleno|${week}`, {}, poisoned)) if (item.person.id.startsWith('fake-')) leaked++;
check(leaked === 0, `Nessun record non verificato, concluso o simulato (${leaked}).`);
check(pick('x', {}, { ...db, politicians: [] }).length === 0, 'Senza archivio nessuna scheda e nessun errore.');

// ---------- 2. pages in Chrome ----------
if (!chromeAvailable) console.log('Pagine Parlamento e Leggi nel browser saltate: Chrome non trovato (imposta CHROME_PATH per eseguirle).');
else await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, version, errors } = browser;
  await createCareerInPage(browser, { weeks: 30 });
  await openCareer(browser);
  const go = async page => { await evaluate(`document.querySelector('[data-nav="${page}"]')?.click(), true`); await waitFor(() => evaluate(`location.hash.includes('${page}') && Boolean(document.querySelector('.page-wrap'))`)); await pause(700); };
  const overflow = () => evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1');

  await go('parlamento');
  await waitFor(() => evaluate('Boolean(document.querySelector(".featured-members .featured-card"))'), 40000);
  const order = await evaluate(`(() => { const at = selector => { const el = document.querySelector(selector); return el ? [...document.querySelectorAll('.page-wrap *')].indexOf(el) : -1; }; return { hemi: at('#hemicycle'), cards: at('.featured-members'), chamber: at('.chamber-panel'), contacts: at('.contacts-panel') }; })()`);
  check(order.hemi >= 0 && order.hemi < order.cards && order.cards < order.chamber && order.chamber < order.contacts, `Ordine Parlamento: emiciclo, schede, composizione, contatti (${JSON.stringify(order)}).`);
  const cards = await evaluate(`[...document.querySelectorAll('.featured-card')].map(card => ({ name: card.querySelector('strong')?.textContent, real: /Dato reale verificato/.test(card.textContent), link: card.querySelector('a.catalog-source')?.href ?? '', seat: card.querySelector('[data-hemi-seat]')?.dataset.hemiSeat }))`);
  check(cards.length === 6 && cards.every(card => card.name && card.real && /camera\.it|senato\.it/.test(card.link) && card.seat), 'Sei schede con nome, dato reale verificato e scheda ufficiale.');
  // «Mostra nell’emiciclo» selects the seat in the interactive hemicycle
  await evaluate(`document.querySelector('.featured-card [data-hemi-seat]').click(), true`);
  await pause(500);
  check(await evaluate(`Boolean(document.querySelector('#hemicycle .hemi-seat.is-selected, #hemicycle [aria-selected="true"], #hemicycle .hemi-card'))`), 'La scheda sceglie il seggio nell’emiciclo.');
  // Camera ↔ Senato: the cards follow the chamber on screen
  await evaluate(`document.querySelector('[data-hemi-chamber="senato"]').click(), true`);
  await pause(500);
  check(await evaluate(`document.querySelector('.featured-members')?.dataset.featuredChamber === 'senato'`), 'Le schede seguono la Camera in vista.');
  // the week changes the cards
  const before = await evaluate(`[...document.querySelectorAll('.featured-card strong')].map(el => el.textContent).join('|')`);
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advanceTurn(1); return true; })()`);
  await pause(800);
  const after = await evaluate(`[...document.querySelectorAll('.featured-card strong')].map(el => el.textContent).join('|')`);
  check(before && after && before !== after, 'La settimana dopo le schede sono altre.');

  // ----- Leggi -----
  await go('leggi');
  const laws = await evaluate(`(() => { const folds = [...document.querySelectorAll('.law-fold')]; return { folds: folds.map(f => ({ key: f.dataset.remember, open: f.open })), legend: Boolean(document.querySelector('.law-legend .parliament-provenance.simulated')) && Boolean(document.querySelector('.law-legend .parliament-provenance.real')), bills: document.querySelectorAll('.bill-board .bill-card, .bill-board article').length, more: document.querySelector('[data-bill-more="bills"]')?.textContent ?? '', realMore: Boolean(document.querySelector('[data-real-law-more]')), realBoard: Boolean(document.querySelector('.real-law-board .real-law')), archiveCount: document.querySelectorAll('.bill-archive li').length }; })()`);
  check(['leggi-mie', 'leggi-proposte', 'leggi-reali', 'leggi-cronologia'].every(key => laws.folds.some(f => f.key === key)), `Blocchi comprimibili presenti (${laws.folds.map(f => f.key)}).`);
  check(laws.folds.find(f => f.key === 'leggi-cronologia')?.open === false, 'La cronologia parte chiusa.');
  check(laws.legend, 'Legenda simulato / reale.');
  check(laws.bills > 0 && laws.bills <= 6, `Al massimo sei proposte alla volta (${laws.bills}).`);
  check(laws.realBoard, 'Atti reali presenti.');
  if (laws.more) {
    await evaluate(`document.querySelector('[data-bill-more="bills"]').click(), true`);
    await pause(500);
    const grown = await evaluate(`document.querySelectorAll('.bill-board .bill-card, .bill-board article').length`);
    check(grown > laws.bills, `«Mostra altre» aggiunge proposte (${laws.bills} → ${grown}).`);
    await evaluate(`document.querySelector('[data-view-filter="leggi"][data-view-filter-value="concluse"]')?.click(), true`);
    await pause(500);
    check(await evaluate(`document.querySelectorAll('.bill-board .bill-card, .bill-board article').length <= 6`), 'Cambiare filtro riporta alla prima pagina.');
  } else check(laws.bills <= 6, 'Meno di sette proposte: nessun «Mostra altre» necessario.');
  // the chronology opens and closes, and stays as left across a redraw
  await evaluate(`document.querySelector('.law-fold[data-remember="leggi-cronologia"] > summary').click(), true`);
  await pause(300);
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advanceTurn(1); return true; })()`);
  await pause(800);
  check(await evaluate(`document.querySelector('.law-fold[data-remember="leggi-cronologia"]')?.open === true`), 'La cronologia aperta resta aperta dopo il ridisegno.');
  const archive = await evaluate(`document.querySelectorAll('.bill-archive li').length`);
  if (archive >= 10) {
    check(await evaluate(`Boolean(document.querySelector('[data-bill-more="archive"]'))`), 'L’archivio lungo ha «Mostra altre».');
  }

  // ----- width -----
  for (const [width, height] of [[320, 640], [360, 800], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800]]) {
    await viewport(width, height);
    for (const page of ['parlamento', 'leggi']) { await go(page); await pause(300); check(!(await overflow()), `${page} a ${width}px: nessuno scorrimento orizzontale.`); }
  }
  check(errors.length === 0, `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
}, {});

if (problems.length) { console.error(problems.map(item => `- ${item}`).join('\n')); process.exit(1); }
console.log('Pagine Parlamento e Leggi verificate: emiciclo, schede reali variate e deterministiche, blocchi comprimibili, «Mostra altre», simulato/reale distinti, 8 larghezze.');
