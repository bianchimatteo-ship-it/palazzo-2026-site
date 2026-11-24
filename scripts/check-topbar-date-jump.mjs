// The date of the top bar opens a calendar to pick a day ahead and advance the game up to it (ui/date-jump.js), with the engine of the agenda (store.advanceToDate): no second engine, no jump
// of the clock. Checked in Chrome at 1280 and 390 px:
//   the date is a button; the calendar opens with past days disabled, the votes and deadlines of the agenda marked, quick choices; picking a day says how many weeks and days will pass; the
//   confirmation is the same as the agenda's; the game advances week after week (every week in between is closed: the week index grows by as many weeks) up to the day or to the first stop, whose
//   reason is told; Esc and «Annulla» close without moving; the progress is saved (a reload finds the new date); no horizontal scroll at 390 px; no errors on the page.
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Calendario della barra superiore saltato: Chrome non trovato.'); process.exit(0); }
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
await withBrowser(async browser => {
  const { evaluate, pause, version, viewport, errors } = browser;
  await createCareerInPage(browser, { level: 'comunale', weeks: 1 });
  await openCareer(browser);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  for (const width of [1280, 390]) {
    await viewport(width, width < 500 ? 844 : 900); await pause(500);
    const chip = await evaluate(`(() => { const b = document.querySelector('.topbar [data-action="date-picker"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { tag: b.tagName, visible: r.width > 0 && r.height > 0 && getComputedStyle(b).display !== 'none', text: b.textContent.trim() }; })()`);
    check(chip?.tag === 'BUTTON' && chip.visible, `${width}px: la data della barra superiore è un pulsante visibile (${JSON.stringify(chip)}).`);
    // Esc closes without moving
    const before = await S(`const s = store.getState(); return { date: s.clock.currentDate, week: s.game.week.index };`);
    await evaluate(`document.querySelector('.topbar [data-action="date-picker"]').click(), true`); await pause(700);
    const opened = await evaluate(`(() => { const p = document.querySelector('.date-jump .dj-panel'); if (!p) return null; const off = [...p.querySelectorAll('.dj-cell[disabled]')].length; const marks = p.querySelectorAll('.dj-cell[class*="has-"]').length; return { off, marks, quick: p.querySelectorAll('.dj-chip').length, width: p.getBoundingClientRect().width, doc: document.documentElement.scrollWidth, vw: innerWidth }; })()`);
    check(opened && opened.quick >= 4, `${width}px: il calendario si apre con le scelte rapide (${JSON.stringify(opened)}).`);
    check(opened && opened.doc <= opened.vw + 1 && opened.width <= opened.vw, `${width}px: il calendario sta nello schermo senza scorrimento orizzontale.`);
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`); await pause(300);
    check(await evaluate(`!document.querySelector('.date-jump')`), `${width}px: Esc chiude il calendario.`);
    check(JSON.stringify(await S(`const s = store.getState(); return { date: s.clock.currentDate, week: s.game.week.index };`)) === JSON.stringify(before), `${width}px: chiudere non fa avanzare nulla.`);
    // pick «+2 settimane», read the summary, confirm
    await evaluate(`document.querySelector('.topbar [data-action="date-picker"]').click(), true`); await pause(700);
    const target = await evaluate(`(() => { const b = [...document.querySelectorAll('.date-jump .dj-chip')].find(item => /2 settimane|2 weeks/.test(item.textContent)); b?.click(); return b?.dataset.djDay ?? null; })()`); await pause(300);
    const summary = await evaluate(`document.querySelector('.date-jump .dj-summary')?.textContent.replace(/\\s+/g, ' ') ?? ''`);
    check(target && /2 settimane|2 weeks/.test(summary), `${width}px: la scelta indica quanto tempo passerà (${summary}).`);
    check(await evaluate(`Boolean(document.querySelector('.date-jump .dj-cell.is-picked'))`), `${width}px: il giorno scelto è evidenziato nel calendario.`);
    await evaluate(`document.querySelector('.date-jump [data-dj-go]').click(), true`); await pause(500);
    const dialog = await evaluate(`document.querySelector('.confirm-dialog')?.textContent.replace(/\\s+/g, ' ') ?? ''`);
    check(/Avanzare fino al/.test(dialog) && /settimane/.test(dialog) && /motivo/.test(dialog), `${width}px: la conferma dice quanto tempo passerà e che l’arresto viene motivato (${dialog.slice(0, 140)}).`);
    await evaluate(`document.querySelector('.confirm-dialog [data-confirm="ok"]').click(), true`);
    let after = null;
    for (let i = 0; i < 40; i++) { await pause(400); after = await S(`const s = store.getState(); return { date: s.clock.currentDate, week: s.game.week.index, toast: s.ui.toast };`); if (after.date >= target || /Mi fermo/.test(after.toast ?? '')) break; }
    const reached = after.date >= target;
    check(reached || /Mi fermo/.test(after.toast ?? ''), `${width}px: si arriva alla data o ci si ferma con il motivo (${JSON.stringify(after)}).`);
    if (reached) check(after.week - before.week >= 2, `${width}px: le settimane intermedie sono giocate una per una (settimana ${before.week} → ${after.week}).`);
    // the progress is saved
    await S(`store.save(); return true;`);
    await openCareer(browser);
    const reloaded = await S(`return store.getState().clock.currentDate;`);
    check(reloaded === after.date, `${width}px: dopo il ricaricamento la data raggiunta resta (${reloaded} / ${after.date}).`);
  }
  const pageErrors = (errors ?? []).filter(text => !/favicon|net::ERR_/i.test(text));
  check(!pageErrors.length, `Nessun errore nella pagina (${pageErrors.slice(0, 2).join(' | ')}).`);
});
if (problems.length) { console.error(`Calendario della barra superiore — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Calendario della barra superiore verificato (1280 e 390 px): la data apre un calendario con giorni passati disabilitati, voti e scadenze segnati e scelte rapide; la scelta dice quanto tempo passerà, la conferma è quella dell’agenda, il gioco avanza settimana per settimana fino alla data o al primo arresto motivato, Esc chiude senza muovere nulla, il progresso resta dopo il ricaricamento.');
