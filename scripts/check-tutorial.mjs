// The guided tutorial, in a real browser (Chrome over the DevTools protocol; skipped when it is not installed): optional (never shown by itself), started from «Come giocare»,
// eleven steps that open the real pages with Indietro / Avanti / Salta / Chiudi and a progress bar, resumable after closing and after a reload, repeatable, and harmless:
// it never changes the career (week, days, date, funds). The guide has a search box. On a phone the card stays on screen above the navigation bar.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Tutorial saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };

await withBrowser(async browser => {
  const { evaluate, send, viewport, goto, waitFor, pause, errors, version } = browser;
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(450); };
  const card = () => evaluate(`(() => { const el = document.querySelector('[data-tutorial-card]'); if (!el) return null; const r = el.getBoundingClientRect(); const bar = document.querySelector('.mobile-tabbar'); const barTop = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : innerHeight; return { kicker: el.querySelector('.tutorial-kicker').textContent.trim(), title: el.querySelector('h3').textContent, now: Number(el.querySelector('[role=progressbar]').getAttribute('aria-valuenow')), max: Number(el.querySelector('[role=progressbar]').getAttribute('aria-valuemax')), hash: location.hash, inside: r.left >= 0 && r.right <= innerWidth + .5 && r.top >= 0 && r.bottom <= barTop + .5, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, buttons: [...el.querySelectorAll('button')].map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height), b.disabled]) }; })()`);
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
  check(c && c.now === 1 && c.max === 11 && /PASSO 1 DI 11/.test(c.kicker), `Parte dal primo passo (${c?.kicker}).`);
  check(!await evaluate(`Boolean(document.querySelector('.main-menu'))`), 'Il menu si chiude: il tutorial si vede sulle pagine del gioco.');
  check(c.inside && c.scrollW <= c.innerW + 1, 'Su 375 px la scheda sta nello schermo, sopra la barra, senza scorrimento orizzontale.');
  check(c.buttons.every(([label, height]) => height >= 40), `I pulsanti sono da tocco (${JSON.stringify(c.buttons)}).`);
  check(c.buttons.find(([label]) => label === 'Indietro')?.[2] === true, 'Al primo passo «Indietro» è disattivato.');

  // walk forward through the real pages
  const seen = [c.hash];
  for (let step = 2; step <= 11; step++) {
    await click('[data-tutorial=next]');
    c = await card();
    check(c && c.now === step, `Passo ${step}: ${c?.kicker}.`);
    seen.push(c?.hash);
    check(c?.hash && c.hash !== '#' , `Passo ${step}: apre la sua pagina (${c?.hash}).`);
  }
  check(new Set(seen).size >= 7, `Attraversa pagine diverse del gioco (${[...new Set(seen)].join(' ')}).`);
  await click('[data-tutorial=prev]');
  c = await card();
  check(c?.now === 10, 'Indietro torna al passo precedente.');
  // close and resume, also after a reload
  await click('[data-tutorial=close]');
  check(await card() === null && (await status()).status === 'closed' && (await status()).step === 9, 'Chiudere la scheda ricorda il passo.');
  await goto(); await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await click('[data-menu=continua]'); await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  check(await card() === null, 'Dopo il ricaricamento il tutorial chiuso non riappare da solo.');
  await click('[data-action=menu]'); await click('[data-menu=guida]');
  const resume = await evaluate(`document.querySelector('.tutorial-invite [data-tutorial=resume]')?.textContent.trim()`);
  check(/Riprendi dal passo 10 di 11/.test(resume ?? ''), `Si può riprendere (${resume}).`);
  await click('.tutorial-invite [data-tutorial=resume]');
  c = await card();
  check(c?.now === 10, 'Riprendi riporta al passo salvato.');
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
console.log('Tutorial verificato in Chrome: facoltativo, avviabile da «Come giocare», undici passi sulle pagine vere con Avanti/Indietro/Salta/Chiudi e progresso, ripresa dopo la chiusura e il ricaricamento, rifacibile, ricerca nella guida, nessun effetto sulla carriera, scheda dentro lo schermo a 375 px.');
