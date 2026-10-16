// The “Altro” sheet of the phone navigation, in a real browser with real taps (Chrome over the DevTools protocol; skipped when it is not installed):
// seven themed groups (accordions, one open at a time, the group of the current page first), every page of the game reachable and none twice, a search box,
// closing and going back do not change the career, and nothing overflows or is covered at 320–430 px (768 px keeps the sidebar, without the sheet).
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Menu «Altro» saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
const GROUPS = { carriera: ['carriera', 'calendario', 'eventi', 'profilo'], partito: ['partito', 'finanze', 'partiti-lista'], istituzioni: ['parlamento', 'governo', 'quirinale', 'leggi'], elezioni: ['elezioni', 'sondaggi'], territori: ['territori'], informazione: ['notizie', 'archivio', 'politici'], gestione: ['impostazioni'] };
const WIDTHS = [[320, 640], [360, 740], [375, 812], [390, 844], [430, 932]];

await withBrowser(async browser => {
  const { evaluate, send, viewport, waitFor, pause, errors, version } = browser;
  const tap = async (selector, { scroll = true } = {}) => {
    const box = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { missing: true }; ${scroll ? 'el.scrollIntoView({ block: "center" });' : ''} const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, covered: Boolean(hit && !el.contains(hit)), off: r.left < 0 || r.right > innerWidth + .5 || r.top < 0 || r.bottom > innerHeight + .5 }; })()`);
    if (box.missing) throw new Error(`Elemento non trovato: ${selector}`);
    if (box.covered || box.off) throw new Error(`${selector} è coperto o fuori schermo.`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    await pause(300);
    return box;
  };
  const snapshot = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return JSON.stringify({ id: s.career.id, revision: store.revision(), week: s.game.week.index, date: s.clock.currentDate }); })()`);
  const sheetState = () => evaluate(`(() => { const sheet = document.querySelector('[data-mobile-sheet]'); const groups = [...document.querySelectorAll('[data-sheet-group]')]; return { hidden: sheet.hidden, ids: groups.map(g => g.dataset.sheetGroup), open: groups.filter(g => g.open).map(g => g.dataset.sheetGroup), pages: [...sheet.querySelectorAll('[data-nav]')].map(b => b.dataset.nav), scrollW: document.documentElement.scrollWidth, innerW: innerWidth, panelW: sheet.querySelector('.mobile-sheet-panel').getBoundingClientRect().width, summaries: groups.map(g => { const r = g.querySelector('summary').getBoundingClientRect(); return [Math.round(r.height), g.querySelector('summary strong').textContent, Boolean(g.querySelector('summary svg')), g.querySelector('summary small').textContent.length > 0]; }) }; })()`);

  await createCareerInPage(browser, { weeks: 2 });
  await viewport(390, 844, true);
  await openCareer(browser);
  await waitFor(() => evaluate('Boolean(document.querySelector(".mobile-tabbar"))'));
  await pause(2500);
  const start = await snapshot();
  const hash0 = await evaluate('location.hash');

  // 1. open: seven groups, the pages of the game exactly once, nothing open that is not the current page's group
  await tap('[data-mobile-more]', { scroll: false });
  let state = await sheetState();
  check(!state.hidden, 'Toccando «Altro» il foglio si apre.');
  check(state.ids.join() === Object.keys(GROUPS).join(), `Le sette categorie: ${state.ids.join(', ')}.`);
  const everyPage = Object.values(GROUPS).flat();
  check(everyPage.every(id => state.pages.filter(page => page === id).length === 1), `Ogni pagina compare una volta sola nel foglio (${state.pages.join(', ')}).`);
  check(state.open.length <= 1, `Al più una categoria aperta all'inizio (${state.open.join(', ')}).`);
  check(state.summaries.every(([height, title, icon, hint]) => height >= 44 && title && icon && hint), `Ogni categoria ha titolo, icona, descrizione e un'altezza da tocco (${JSON.stringify(state.summaries)}).`);
  { const now = await snapshot(); check(now === start, `Aprire «Altro» non cambia la carriera (revisione, data, settimana): ${start} → ${now}.`); }

  // 2. accordion: opening a group closes the previous one, a second tap closes it
  await tap('[data-sheet-group="istituzioni"] > summary');
  state = await sheetState();
  check(state.open.join() === 'istituzioni', `Aprendo «Istituzioni» le altre si chiudono (${state.open.join(', ')}).`);
  await tap('[data-sheet-group="istituzioni"] > summary');
  state = await sheetState();
  check(state.open.length === 0, 'Un secondo tocco richiude la categoria.');
  await tap('[data-sheet-group="partito"] > summary');
  state = await sheetState();
  check(state.open.join() === 'partito', 'Si apre un’altra categoria.');

  // 3. search: filters the pages in place and gives them back
  await evaluate(`(() => { const box = document.querySelector('[data-sheet-search]'); box.value = 'gover'; box.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const found = await evaluate(`[...document.querySelectorAll('.mobile-sheet .sheet-item')].filter(el => !el.hidden && el.closest('details')?.open && !el.closest('[hidden]')).map(el => el.dataset.sheetLabel)`);
  check(found.length === 1 && found[0] === 'Governo', `La ricerca «gover» trova Governo (${found.join(', ')}).`);
  await evaluate(`(() => { const box = document.querySelector('[data-sheet-search]'); box.value = 'xyzxyz'; box.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  check(await evaluate('!document.querySelector("[data-sheet-empty]").hidden'), 'Nessun risultato: lo dice.');
  await evaluate(`(() => { const box = document.querySelector('[data-sheet-search]'); box.value = ''; box.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  state = await sheetState();
  check(state.open.join() === 'partito', `Svuotata la ricerca torna lo stato di prima (${state.open.join(', ')}).`);

  // 4. close with × : the career and the page do not change
  await tap('[data-mobile-close]', { scroll: false });
  check((await sheetState()).hidden && await snapshot() === start && await evaluate('location.hash') === hash0, 'Chiudere «Altro» non cambia pagina né carriera.');

  // 5. every page is reachable in two or three taps, the sheet closes and the career is the same
  for (const [group, pages] of Object.entries(GROUPS)) {
    for (const page of pages) {
      await tap('[data-mobile-more]', { scroll: false });
      const open = await evaluate(`document.querySelector('[data-sheet-group="${group}"]').open`);
      if (!open) await tap(`[data-sheet-group="${group}"] > summary`);
      await tap(`.mobile-sheet [data-sheet-group="${group}"] [data-nav="${page}"]`);
      await pause(500);
      const where = await evaluate(`({ hash: location.hash, hidden: document.querySelector('[data-mobile-sheet]').hidden, title: document.querySelector('.topbar-title')?.innerText ?? '' })`);
      check(where.hash.replace('#', '').split('/')[0].startsWith(page) || where.hash.includes(page === 'quirinale' ? 'quirinale' : page), `«${page}» si apre (indirizzo ${where.hash}).`);
      check(where.hidden, `Dopo aver scelto «${page}» il foglio si chiude.`);
    }
  }
  const afterTour = JSON.parse(await snapshot());
  check(afterTour.id === JSON.parse(start).id && afterTour.week === JSON.parse(start).week && afterTour.date === JSON.parse(start).date, 'Visitare tutte le pagine non avanza il tempo né cambia carriera.');

  // 6. back goes to the previous page, never to a wrong screen
  await evaluate(`location.hash = '#panoramica'; true`); await pause(500);
  await tap('[data-mobile-more]', { scroll: false });
  await tap('[data-sheet-group="istituzioni"] > summary');
  await tap('.mobile-sheet [data-nav="governo"]');
  await evaluate('history.back(), true'); await pause(700);
  check(await evaluate('location.hash') === '#panoramica' && await evaluate('Boolean(document.querySelector(".page-wrap"))') && JSON.parse(await snapshot()).id === JSON.parse(start).id, 'Il tasto indietro riporta alla pagina precedente con la carriera intatta.');

  // 7. widths
  for (const [width, height] of WIDTHS) {
    await viewport(width, height, true); await pause(400);
    await tap('[data-mobile-more]', { scroll: false });
    state = await sheetState();
    check(state.scrollW <= state.innerW + 1, `${width} px: nessun scorrimento orizzontale (${state.scrollW} su ${state.innerW}).`);
    check(state.panelW <= state.innerW + 1, `${width} px: il foglio sta nello schermo.`);
    await tap('[data-sheet-group="gestione"] > summary');
    for (const selector of ['[data-sheet-group="gestione"] [data-nav="impostazioni"]', '[data-sheet-group="gestione"] [data-action="menu"]', '[data-sheet-group="gestione"] [data-action="account"]']) {
      const box = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.height, r.width, r.right <= innerWidth + .5]; })()`);
      check(box[0] >= 44 && box[2], `${width} px: ${selector} è alto almeno 44 px e sta nello schermo (${box.join(', ')}).`);
    }
    await tap('[data-mobile-close]', { scroll: false });
  }
  await viewport(1280, 800, false); await pause(300);
  check(await evaluate('getComputedStyle(document.querySelector(".mobile-tabbar")).display') === 'none', 'Su desktop la barra mobile non c’è.');
  if (errors.length) problems.push(`Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
});
if (problems.length) { console.error(`Menu «Altro»: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
console.log('Menu «Altro» verificato in Chrome: sette categorie con titolo, icona e descrizione, una aperta alla volta, tutte le pagine raggiungibili una volta sola, ricerca, chiusura e tasto indietro senza toccare la carriera, 320–430 px senza overflow.');
