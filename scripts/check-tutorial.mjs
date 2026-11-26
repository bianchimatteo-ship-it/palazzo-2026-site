// The guided tutorial, in a real browser (Chrome over the DevTools protocol; skipped when it is not installed): optional (never shown by itself), started from «Come giocare»,
// thirteen steps (each with one exercise, on its real page, with the control it points at; the scroll is back at zero after every Avanti/Indietro) that open the real pages with Indietro / Avanti / Salta / Chiudi and a progress bar, resumable after closing and after a reload, repeatable, and harmless:
// it never changes the career (week, days, date, funds). The guide has a search box. On a phone the card stays on screen above the navigation bar.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Tutorial saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
import { readFile } from 'node:fs/promises';
const _build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { TUTORIAL_STEPS, TUTORIAL_TASKS } = await import(`../src/ui/tutorial.js?v=${_build}`);
const N = TUTORIAL_STEPS.length;
const SHOTS = process.env.TUTORIAL_SHOTS; // optional: a folder where the before/after screenshots are written // the steps of the tutorial (13: the weekly activities and the votes in the Chamber have their own)
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };

await withBrowser(async browser => {
  const { evaluate, send, viewport, goto, waitFor, pause, errors, version } = browser;
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(450); };
  const card = () => evaluate(`(() => { const el = document.querySelector('[data-tutorial-card]'); if (!el) return null; const r = el.getBoundingClientRect(); const bar = document.querySelector('.mobile-tabbar'); const barTop = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : innerHeight; return { kicker: el.querySelector('.tutorial-kicker').textContent.trim(), title: el.querySelector('h3').textContent, now: Number(el.querySelector('[role=progressbar]').getAttribute('aria-valuenow')), max: Number(el.querySelector('[role=progressbar]').getAttribute('aria-valuemax')), hash: location.hash, inside: r.left >= 0 && r.right <= innerWidth + .5 && r.top >= 0 && r.bottom <= barTop + .5, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, buttons: [...el.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height > 0).map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height), b.disabled]), hiddenButtons: [...el.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height === 0).map(b => b.textContent.trim()), box: [Math.round(r.height), innerHeight], expanded: el.dataset.expanded }; })()`);
  const facts = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return JSON.stringify({ id: s.career.id, week: s.game.week.index, ap: s.game.week.ap, date: s.clock.currentDate, funds: s.game.finance?.funds ?? null }); })()`);
  const status = () => evaluate(`JSON.parse(localStorage.getItem('politicando.tutorial.v1') ?? '{}')`);

  await createCareerInPage(browser, { weeks: 2 });
  await viewport(375, 812, true);
  await openCareer(browser);
  await pause(2500);
  const before = await facts();
  check(await card() === null, 'Il tutorial è facoltativo: non compare da solo.');

  // start from «Come giocare»
  await click('[data-action=menu]');
  await click('[data-menu=guida]');
  check(await evaluate(`Boolean(document.querySelector('.tutorial-invite [data-tutorial=start]'))`), 'Dalla guida si avvia il tutorial.');
  check(await evaluate(`Boolean(document.querySelector('[data-guide-search]'))`), 'La guida ha la ricerca.');
  await evaluate(`(() => { const box = document.querySelector('[data-guide-search]'); box.value = 'sondaggi'; box.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const shown = await evaluate(`[...document.querySelectorAll('[data-guide-card]')].filter(el => !el.hidden).length`);
  check(shown >= 1 && shown < await evaluate(`document.querySelectorAll('[data-guide-card]').length`), `La ricerca nella guida filtra gli argomenti (${shown}).`);
  await evaluate(`(() => { const box = document.querySelector('[data-guide-search]'); box.value = ''; box.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await click('.tutorial-invite [data-tutorial=start]');
  let c = await card();
  check(c && c.now === 1 && c.max === N && new RegExp(`PASSO 1 DI ${N}`).test(c.kicker), `Parte dal primo passo (${c?.kicker}).`);
  check(!await evaluate(`Boolean(document.querySelector('.main-menu'))`), 'Il menu si chiude: il tutorial si vede sulle pagine del gioco.');
  check(c.inside && c.scrollW <= c.innerW + 1, 'Su 375 px la scheda sta nello schermo, sopra la barra, senza scorrimento orizzontale.');
  check(c.buttons.every(([label, height]) => height >= 40), `I pulsanti visibili sono da tocco (${JSON.stringify(c.buttons)}).`);
  // phone: a slim, collapsible, non-blocking panel; the details open on request and the page below stays usable
  check(c.expanded === '0' && c.box[0] <= c.box[1] * 0.3, `Su telefono parte compatto (${c.box[0]} px su ${c.box[1]}).`);
  check(c.buttons.some(([label]) => label === 'Avanti') && c.buttons.some(([label]) => label === 'Indietro') && c.buttons.some(([label]) => label === '×'), 'Avanti, Indietro e chiudi sono sempre raggiungibili.');
  check(!(await evaluate(`(() => { const d = document.querySelector('.tutorial-details'); return d && d.getBoundingClientRect().height > 0; })()`)), 'I dettagli sono chiusi finché non si chiede.');
  check(await evaluate(`(() => { const el = document.querySelector('[data-tutorial-card]'); const r = el.getBoundingClientRect(); const probe = document.elementFromPoint(innerWidth / 2, Math.max(120, r.top - 40)); return Boolean(probe) && !probe.closest('[data-tutorial-card]'); })()`), 'Sopra il pannello la pagina sottostante resta raggiungibile.');
  await click('[data-tutorial=toggle]');
  const open = await card();
  check(open.expanded === '1' && await evaluate(`document.querySelector('.tutorial-details').getBoundingClientRect().height > 0`) && open.box[0] <= open.box[1] * 0.62, `I dettagli si aprono a richiesta e il pannello resta entro il 62% dello schermo (${open.box[0]} px).`);
  check(open.inside, 'Aperto, il pannello sta nello schermo sopra la barra inferiore.');
  check(open.buttons.every(([label, height]) => height >= 40), `Anche aperto i pulsanti sono da tocco (${JSON.stringify(open.buttons)}).`);
  check((await status()).expanded === true && (await status()).step === 0, 'Il passo non cambia aprendo i dettagli; la preferenza è ricordata.');
  await click('[data-tutorial=toggle]');
  check((await card()).expanded === '0', 'I dettagli si richiudono.');
  check(c.buttons.find(([label]) => label === 'Indietro')?.[2] === true, 'Al primo passo «Indietro» è disattivato.');

  // «Vai alla schermata»: shown only when the player is on another page, one pill with an arrow, and it really goes back to the page of the step
  await evaluate(`location.hash = '#finanze'; true`); await pause(700);
  check(await evaluate(`Boolean(document.querySelector('[data-tutorial-go].go-button .go-arrow'))`), 'Fuori dalla pagina del passo compare «Vai alla schermata» (pulsante con freccia).');
  await click('[data-tutorial-go]'); await pause(500);
  check(await evaluate(`location.hash === '#panoramica' && !document.querySelector('[data-tutorial-go]') && Boolean(document.querySelector('[data-tutorial-card]'))`), '«Vai alla schermata» riporta alla pagina del passo e il tutorial resta aperto.');


  // ---- every step shows its real page; every indicated control exists; Avanti/Indietro bring the new screen to the top (also between two steps of the SAME page), on desktop and on a phone ----
  const shot = async name => { if (!SHOTS) return; await mkdir(SHOTS, { recursive: true }); const { data } = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`${SHOTS}/${name}.png`, Buffer.from(data, 'base64')); };
  const scrollState = () => evaluate(`(() => { const card = document.querySelector('[data-tutorial-card]'); const det = document.querySelector('.tutorial-details'); return { y: Math.round(scrollY), cardTop: Math.round(card?.scrollTop ?? 0), detTop: Math.round(det?.scrollTop ?? 0), max: document.scrollingElement.scrollHeight - innerHeight }; })()`);
  const scrollDown = () => evaluate(`(() => { scrollTo(0, 500); const card = document.querySelector('[data-tutorial-card]'); const det = document.querySelector('.tutorial-details'); if (card) card.scrollTop = 80; if (det) det.scrollTop = 80; return true; })()`);
  for (const [name, w, h, mobile] of [['desktop', 1280, 800, false], ['smartphone', 390, 844, true]]) {
    await viewport(w, h, mobile); await pause(500);
    await click('[data-tutorial=skip]');
    await click('[data-action=menu]'); await click('[data-menu=guida]');
    await click('.tutorial-invite [data-tutorial=restart]');
    if (mobile) { const state = await card(); if (state?.expanded !== '1') await click('[data-tutorial=toggle]'); }
    await evaluate(`document.querySelectorAll('[data-news-popup-close],[data-outcome-dismiss],[data-report-close]').forEach(el => el.click()), true`);
    for (let step = 1; step <= N; step++) {
      const item = TUTORIAL_STEPS[step - 1];
      const here = await card();
      check(here?.now === step && here.hash === `#${item.page}`, `${name}, passo ${step} (${item.id}): apre la pagina ${item.page} (${here?.hash}).`);
      check(here?.inside && here.scrollW <= here.innerW + 1, `${name}, passo ${step}: la scheda sta nello schermo, non tocca la barra inferiore, nessuno scorrimento orizzontale.`);
      check(here?.buttons.every(([label, height]) => height >= 40), `${name}, passo ${step}: pulsanti da tocco (${JSON.stringify(here?.buttons)}).`);
      check(await evaluate(`[...document.querySelectorAll('[data-tutorial-card] button')].filter(b => b.getBoundingClientRect().height > 0).every(b => { const r = b.getBoundingClientRect(); const c = document.querySelector('[data-tutorial-card]').getBoundingClientRect(); return r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1 || b.closest('.tutorial-details, .tutorial-actions'); })`), `${name}, passo ${step}: nessun pulsante fuori dalla scheda.`);
      const target = TUTORIAL_TASKS[item.id].target;
      check(await evaluate(`Boolean(document.querySelector(${JSON.stringify(target.split(',')[0].trim())}))`), `${name}, passo ${step} (${item.id}): il controllo indicato esiste sulla pagina (${target}).`);
      check(await evaluate(`document.querySelector('[data-tutorial-task]')?.dataset.taskTarget === ${JSON.stringify(target)}`), `${name}, passo ${step}: la scheda indica lo stesso controllo dell’esercizio.`);
      if (!mobile) {
        await pause(450);
        // on a computer the card never covers the control it points at (it moves to the other side when it would)
        const covered = await evaluate(`(() => { const t = document.querySelector('.tutorial-point'); const c = document.querySelector('[data-tutorial-card]'); if (!t || !c) return 'manca'; const a = c.getBoundingClientRect(), b = t.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top && b.top >= 0 && b.bottom <= innerHeight; })()`);
        check(covered === false || covered === 'manca' && false, `${name}, passo ${step} (${item.id}): la scheda non copre il controllo indicato (${covered}).`);
      }
      await scrollDown();
      const moved = await scrollState();
      if (step === 3 || step === 7) await shot(`${name}-passo${step}-prima-${item.id}`);
      if (step < N) {
        await click('[data-tutorial=next]'); await pause(300);
        const after = await scrollState(); const next = await card();
        check(after.y <= 1 && after.cardTop === 0 && after.detTop === 0, `${name}, Avanti dal passo ${step}: la nuova schermata parte dall’inizio (pagina ${moved.y}→${after.y}, scheda ${moved.cardTop}→${after.cardTop}, dettagli ${moved.detTop}→${after.detTop}).`);
        if (TUTORIAL_STEPS[step].page === item.page) check(after.y <= 1 && next?.now === step + 1, `${name}: tra i passi ${step} e ${step + 1} (stessa pagina ${item.page}) lo scroll torna comunque a zero.`);
        if (step === 3 || step === 7) await shot(`${name}-passo${step + 1}-dopo-${TUTORIAL_STEPS[step].id}`);
      }
    }
    // Indietro: same rule, including on the same page
    for (let step = N; step > 1; step--) {
      await scrollDown();
      await click('[data-tutorial=prev]'); await pause(300);
      const after = await scrollState();
      check(after.y <= 1 && after.cardTop === 0 && after.detTop === 0 && (await card())?.now === step - 1, `${name}, Indietro dal passo ${step}: schermata dall’inizio (${after.y}/${after.cardTop}/${after.detTop}).`);
    }
    // ordinary scrolling and the details that open and close are left alone
    await evaluate(`scrollTo(0, 300); true`); await pause(200);
    const rest = await scrollState();
    await click('[data-tutorial=toggle]'); await pause(300); await click('[data-tutorial=toggle]'); await pause(300);
    check(Math.abs((await scrollState()).y - rest.y) <= 2 && rest.y > 100, `${name}: aprire e chiudere i dettagli non muove la pagina (${rest.y}→${(await scrollState()).y}).`);
    await shot(`${name}-scheda-passo2`);
  }
  await viewport(375, 812, true); await pause(300);
  await click('[data-tutorial=skip]');
  await click('[data-action=menu]'); await click('[data-menu=guida]'); await click('.tutorial-invite [data-tutorial=restart]');

  // walk forward through the real pages
  const seen = [c.hash];
  for (let step = 2; step <= N; step++) {
    await click('[data-tutorial=next]');
    c = await card();
    check(c && c.now === step, `Passo ${step}: ${c?.kicker}.`);
    seen.push(c?.hash);
    check(c?.hash && c.hash !== '#' , `Passo ${step}: apre la sua pagina (${c?.hash}).`);
  }
  check(new Set(seen).size >= 8, `Attraversa pagine diverse del gioco (${[...new Set(seen)].join(' ')}).`);
  await click('[data-tutorial=prev]');
  c = await card();
  check(c?.now === N - 1, 'Indietro torna al passo precedente.');
  // close and resume, also after a reload
  await click('[data-tutorial=close]');
  check(await card() === null && (await status()).status === 'closed' && (await status()).step === N - 2, 'Chiudere la scheda ricorda il passo.');
  await goto(); await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await click('[data-menu=continua]'); await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  check(await card() === null, 'Dopo il ricaricamento il tutorial chiuso non riappare da solo.');
  await click('[data-action=menu]'); await click('[data-menu=guida]');
  const resume = await evaluate(`document.querySelector('.tutorial-invite [data-tutorial=resume]')?.textContent.trim()`);
  check(new RegExp(`Riprendi dal passo ${N - 1} di ${N}`).test(resume ?? ''), `Si può riprendere (${resume}).`);
  await click('.tutorial-invite [data-tutorial=resume]');
  c = await card();
  check(c?.now === N - 1, 'Riprendi riporta al passo salvato.');
  await click('[data-tutorial=next]'); await click('[data-tutorial=next]');
  check(await card() === null && (await status()).status === 'done', 'L’ultimo passo («Fine») chiude il tutorial come completato.');
  // restart, then skip
  await click('[data-action=menu]'); await click('[data-menu=guida]');
  check(/Rifai il tutorial/.test(await evaluate(`document.querySelector('.tutorial-invite [data-tutorial]')?.textContent ?? ''`)), 'A tutorial finito si può rifare.');
  await click('.tutorial-invite [data-tutorial=restart]');
  check((await card())?.now === 1, 'Rifare riparte dal primo passo.');
  await click('[data-tutorial=skip]');
  check(await card() === null && (await status()).status === 'skipped', '«Salta» chiude il tutorial.');

  // harmless: nothing of the career changed
  const after = await facts();
  check(after === before, `Il tutorial non cambia la carriera (settimana, giorni, data, fondi): ${before} → ${after}.`);
  if (errors.length) problems.push(`Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
});
if (problems.length) { console.error(`Tutorial: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
console.log('Tutorial verificato in Chrome: facoltativo, avviabile da «Come giocare», tredici passi sulle pagine vere con Avanti/Indietro/Salta/Chiudi e progresso, ripresa dopo la chiusura e il ricaricamento, rifacibile, ricerca nella guida, nessun effetto sulla carriera, scheda dentro lo schermo a 375 px.');
