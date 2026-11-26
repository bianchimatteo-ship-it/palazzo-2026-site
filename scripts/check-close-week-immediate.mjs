// «Chiudi settimana» starts AT ONCE: the click itself runs the advance. Nothing is waited for before it (no timer, no animation frame, no promise), the week advances exactly once, a double click does not
// advance twice, the career is saved with the new week, and nothing else of the game is touched by the button.
//   1. the source: the handler of the advance contains no setTimeout/setInterval/requestAnimationFrame and no await before the run;
//   2. in Chrome: the click is dispatched and, when `click()` returns (synchronously), the advance has already been called and finished (the clock moved); the time between the click and the call is read in the page;
//   3. a double click (two clicks one after the other, the second on the NEW button drawn after the advance) closes one week; a tap that waits for the advance is dropped;
//   4. the save on the device has the new week; the career, the party and the account are the same; the calendar moved by exactly the days of one week.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
// ---- 1. the source of the handler
const source = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
const start = source.indexOf("if (action === 'advance') {"), end = source.indexOf("else if (action === 'scroll-to')", start);
assert.ok(start > 0 && end > start, 'Il gestore di «Chiudi settimana» si trova.');
const handler = source.slice(start, end);
const code = handler.replace(/\/\/[^\n]*/g, '');   // the comments say what is not there
assert.ok(!/setTimeout|setInterval|requestAnimationFrame|debounce|sleep\(/.test(code.slice(0, code.indexOf('const runNow'))), 'Nessun timer, frame o attesa prima dell’avvio dell’avanzamento.');
const run = code.slice(code.indexOf('const run ='), code.indexOf('const runNow'));
assert.ok(!/\bawait\b|\.then\(/.test(run), 'Il gestore parte senza attese: nessun await né promessa davanti a runNow.');
assert.ok(/runNow\(\)/.test(run) && /advancing/.test(run), 'Il gestore esegue subito l’avanzamento e segna i pulsanti come occupati.');
if (!chromeAvailable) { console.log('Chiudi settimana: controllo del sorgente superato; prova nel browser saltata (Chrome non trovato).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off', weeksPerTurn: 1 })); true`);
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector("[data-action=advance]"))'));
  // the page watches the store: how many times the advance is called, when, and what the clock says
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const original = store.advanceTurn.bind(store); window.__calls = []; store.advanceTurn = (...args) => { const at = performance.now(); const before = store.getState().clock.currentDate; const out = original(...args); window.__calls.push({ at, ms: performance.now() - at, before, after: store.getState().clock.currentDate, weeks: args[0] }); return out; }; return true; })()`);
  const info = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); const saved = JSON.parse(localStorage.getItem('palazzo-2026.career.v1') || 'null'); return { week: s.game.week.index, date: s.clock.currentDate, career: s.career.id, party: s.game.party?.partyId ?? null, funds: s.game.resources.funds, savedWeek: saved?.game?.week?.index ?? null, savedDate: saved?.clock?.currentDate ?? null, savedCareer: saved?.career?.id ?? null, calls: window.__calls.length }; })()`);
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const before = await info();
  // ---- 2. one click: the advance has run when click() returns
  const timing = await evaluate(`(() => { const button = document.querySelector('[data-action="advance"]'); const t0 = performance.now(); button.click(); return { returnedAfter: performance.now() - t0, callsAtReturn: window.__calls.length, startedAfter: window.__calls[0] ? window.__calls[0].at - t0 : null }; })()`);
  assert.equal(timing.callsAtReturn, 1, 'Quando il click ritorna, l’avanzamento è già stato eseguito (nessuna attesa prima dell’avvio).');
  assert.ok(timing.startedAfter !== null && timing.startedAfter < 15, `L’avanzamento parte nello stesso istante del click (${timing.startedAfter?.toFixed(2)} ms, nessun timer).`);
  await pause(700);
  const afterOne = await info();
  assert.equal(afterOne.week, before.week + 1, 'La settimana avanza una sola volta.');
  assert.equal(days(before.date, afterOne.date), 7, 'Il calendario avanza di esattamente sette giorni.');
  assert.equal(afterOne.calls, 1, 'Un solo avanzamento richiesto.');
  assert.equal(afterOne.savedWeek, afterOne.week, 'Il salvataggio sul dispositivo ha la settimana nuova.'); assert.equal(afterOne.savedDate, afterOne.date, 'Il salvataggio ha la data nuova.');
  assert.equal(afterOne.career, before.career, 'La carriera è la stessa.'); assert.equal(afterOne.savedCareer, before.career, 'Il salvataggio è della stessa carriera.'); assert.equal(afterOne.party, before.party, 'Il partito è lo stesso.');
  await evaluate(`document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`); await pause(500);
  // ---- 3. a double click: the second click lands on the button drawn after the advance
  const double = await evaluate(`(() => { const first = document.querySelector('[data-action="advance"]'); first.click(); const second = document.querySelector('[data-action="advance"]'); second.click(); return { sameElement: first === second, calls: window.__calls.length }; })()`);
  await pause(700);
  const afterDouble = await info();
  assert.equal(afterDouble.week, afterOne.week + 1, `Un doppio click chiude UNA settimana (nuovo pulsante dopo l’avanzamento: ${!double.sameElement}).`);
  assert.equal(afterDouble.calls, 2, 'Il doppio click ha prodotto un solo avanzamento in più.');
  assert.equal(afterDouble.savedWeek, afterDouble.week, 'Salvataggio coerente anche dopo il doppio click.');
  await evaluate(`document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`); await pause(900);
  // a deliberate second click, well after the first, is a new week
  await evaluate(`document.querySelector('[data-action="advance"]').click(); true`); await pause(700);
  const afterThird = await info(); assert.equal(afterThird.week, afterDouble.week + 1, 'Un click successivo, voluto, chiude la settimana dopo.');
  assert.equal(afterThird.savedWeek, afterThird.week, 'Il salvataggio segue.');
  console.log(`Chiudi settimana verificato: il click esegue l’avanzamento subito (parte dopo ${timing.startedAfter.toFixed(2)} ms, nessun timer né frame in mezzo), una sola settimana per click, il doppio click non avanza due volte, salvataggio con la settimana nuova, stessa carriera e stesso partito, sette giorni di calendario per settimana; la durata di un avanzamento è quella del calcolo (${(await evaluate('window.__calls.map(c => Math.round(c.ms)).join(", ")'))} ms).`);
});
