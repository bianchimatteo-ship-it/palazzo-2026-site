// The practical part of the tutorial: each step with a practice names a small operation on the REAL page, points at the control, verifies it from the interface state and tells the result;
// the practice consumes no week, day, money or capital. Also the guide offers the practical paths ("Percorsi").
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { readFile } from 'node:fs/promises';
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
if (!chromeAvailable) { console.log('SKIPPED: Chrome non disponibile.'); process.exit(0); }
const _build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { TUTORIAL_STEPS, TUTORIAL_TASKS, tutorialTaskDone } = await import(`../src/ui/tutorial.js?v=${_build}`);

// pure rules: a practice is never done by default, and each one needs an action beyond the page the tutorial opens by itself
const PAGES = ['panoramica', 'carriera', 'calendario', 'finanze', 'partito', 'elezioni', 'sondaggi', 'parlamento', 'governo', 'notizie', 'impostazioni'];
check(TUTORIAL_STEPS.length === 13, `Tredici passi (${TUTORIAL_STEPS.length}).`);
check(new Set(TUTORIAL_STEPS.map(step => step.id)).size === TUTORIAL_STEPS.length, 'Nessun passo ripetuto.');
check(new Set(TUTORIAL_STEPS.map(step => step.title)).size === TUTORIAL_STEPS.length, 'Nessun titolo ripetuto.');
for (const step of TUTORIAL_STEPS) {
  check(step.goal && step.what && step.cost && step.next && typeof step.example === 'function', `${step.id}: obiettivo, spiegazione, costo, seguito ed esempio.`);
  check(PAGES.includes(step.page), `${step.id}: la pagina «${step.page}» è una pagina reale.`);
  check(TUTORIAL_TASKS[step.id], `${step.id}: ogni passo ha un esercizio con una condizione verificabile.`);
}
for (const [id, task] of Object.entries(TUTORIAL_TASKS)) {
  const step = TUTORIAL_STEPS.find(item => item.id === id);
  check(step, `${id}: la prova appartiene a un passo esistente.`);
  check(task.prompt && task.where && task.result && task.target && task.page, `${id}: prova completa (cosa fare, dove, risultato, controllo indicato, pagina di arrivo).`);
  check(PAGES.includes(task.page), `${id}: la pagina della prova «${task.page}» è reale.`);
  // the page of the practice is the page of the step, or the page a tap on the indicated control leads to: never a page that has nothing to do with it
  const leadsAway = task.page !== step?.page;
  const navTarget = task.target.match(/data-nav="([a-z-]+)"/)?.[1];
  check(leadsAway ? (navTarget ? navTarget === task.page : id === 'ruolo' && task.page === 'carriera' && /data-section-tab="carriera"/.test(task.target)) : !navTarget || navTarget === step.page, `${id}: pagina del passo (${step?.page}), pagina della prova (${task.page}) e controllo (${task.target}) coerenti.`);
  check(!tutorialTaskDone(id, { page: step?.page, tabs: {}, proof: {} }) || leadsAway, `${id}: aprire solo la pagina del passo non basta a completarla.`);
  check(!tutorialTaskDone(id, {}) && !tutorialTaskDone(id, undefined), `${id}: senza stato non è completata.`);
  check(!tutorialTaskDone(id, { page: 'carriera', tabs: {}, newsFilter: 'tutto', proof: {} }), `${id}: su una pagina estranea non è completata.`);
}
check(tutorialTaskDone('agenda', { page: 'calendario', tabs: { agenda: { value: 'calendario' } } }) && !tutorialTaskDone('agenda', { page: 'calendario', tabs: { agenda: { value: 'attivita' } } }), 'agenda: serve la scheda Calendario.');
check(tutorialTaskDone('campagna', { page: 'elezioni', tabs: { elezioni: { value: 'programma' } } }) && !tutorialTaskDone('campagna', { page: 'elezioni', tabs: { elezioni: { value: 'campagna' } } }), 'campagna: serve la scheda Programma.');
check(tutorialTaskDone('istituzioni', { page: 'governo' }) && !tutorialTaskDone('istituzioni', { page: 'parlamento' }), 'istituzioni: serve aprire il Governo da Istituzioni.');
check(tutorialTaskDone('salvataggio', { page: 'impostazioni', proof: { saved: true } }) && !tutorialTaskDone('salvataggio', { page: 'impostazioni', proof: {} }), 'salvataggio: serve aver premuto «Salva ora».');

await withBrowser(async browser => {
  const { evaluate, viewport, pause, errors, version } = browser;
  const click = async selector => { const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); await pause(500); return ok; };
  const task = () => evaluate(`(() => { const el = document.querySelector('[data-tutorial-task]'); return el ? { id: el.dataset.tutorialTask, done: el.dataset.taskDone, text: el.textContent.replace(/\\s+/g, ' ').trim(), pointed: Boolean(document.querySelector('.tutorial-point')) } : null; })()`);
  const facts = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return JSON.stringify({ week: s.game.week.index, ap: s.game.week.ap, date: s.clock.currentDate, funds: s.game.finance?.funds ?? null, capital: s.game.resources?.politicalCapital ?? null }); })()`);
  await createCareerInPage(browser, { weeks: 2 });
  await viewport(1280, 900, false);
  await openCareer(browser); await pause(2500);
  const before = await facts();
  await click('[data-action=menu]'); await click('[data-menu=guida]');
  check(await evaluate(`/Percorsi/.test(document.body.textContent) && document.querySelectorAll('[data-guide-path]').length >= 4`), 'La guida ha i «Percorsi» pratici.');
  await click('.tutorial-invite [data-tutorial=start]');
  const done = [];
  for (let step = 1; step <= TUTORIAL_STEPS.length; step++) {
    const item = TUTORIAL_STEPS[step - 1];
    const t = await task();
    if (TUTORIAL_TASKS[item.id]) {
      check(t && t.id === item.id && t.done === '0', `${item.id}: la prova compare, non ancora fatta (${JSON.stringify(t)}).`);
      check(t?.text.includes('Non costa giorni né denaro'), `${item.id}: dichiara che non costa nulla.`);
      // the practice is done where the step opened it, with the real control (nothing is navigated by hand)
      check(await evaluate(`location.hash === '#${item.page}'`), `${item.id}: il passo apre la sua pagina (${item.page}).`);
      check(!await evaluate(`Boolean(document.querySelector('[data-tutorial-go]'))`), `${item.id}: sulla pagina del passo non compare «Vai alla schermata».`);
      const pointed = await task();
      check(pointed?.pointed, `${item.id}: il controllo da usare è evidenziato.`);
      const target = await evaluate(`document.querySelector('[data-tutorial-task]').dataset.taskTarget`);
      check(await click(target.split(',')[0].trim()) || await click(target.split(',')[1]?.trim() ?? 'x'), `${item.id}: il controllo indicato esiste (${target}).`);
      await pause(600);
      const after = await task();
      check(await evaluate(`location.hash === '#${TUTORIAL_TASKS[item.id].page}' && !document.querySelector('[data-tutorial-go]')`), `${item.id}: dopo l’esercizio la pagina riconosciuta è ${TUTORIAL_TASKS[item.id].page} e non compare «Vai alla schermata» che lo annullerebbe.`);
      check(after?.done === '1' && after.text.includes('Fatto!') && after.text.includes(TUTORIAL_TASKS[item.id].result.slice(0, 30)), `${item.id}: completata e verificata, con il risultato spiegato (${after?.done}).`);
      done.push(item.id);
    }
    if (step < TUTORIAL_STEPS.length) await click('[data-tutorial=next]');
  }
  check(done.length === Object.keys(TUTORIAL_TASKS).length, `Tutte le prove eseguite (${done.join(', ')}).`);
  const after = await facts();
  check(after === before, `Le prove non consumano settimana, giorni, data, fondi né capitale: ${before} → ${after}.`);
  if (errors.length) problems.push(`Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
});
if (problems.length) { console.error(`Tutorial pratico: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 30).join('\n')}`); process.exit(1); }
console.log('Tutorial pratico verificato: tredici passi, ognuno con la sua prova sulla pagina vera (Home, Agenda, Finanze, Partito, Elezioni, Sondaggi, Istituzioni→Governo, Notizie, Impostazioni), pagina del passo e della prova coerenti, controllo evidenziato, verifica dallo stato reale, risultato spiegato, nessun costo; percorsi nella guida.');
