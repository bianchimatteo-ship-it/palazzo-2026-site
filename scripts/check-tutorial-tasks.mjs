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
for (const [id, task] of Object.entries(TUTORIAL_TASKS)) {
  check(TUTORIAL_STEPS.some(step => step.id === id), `${id}: la prova appartiene a un passo esistente.`);
  check(task.prompt && task.where && task.result && task.target, `${id}: prova completa (cosa fare, dove, risultato, controllo indicato).`);
  const stepPage = TUTORIAL_STEPS.find(step => step.id === id)?.page;
  check(!tutorialTaskDone(id, { page: stepPage }), `${id}: aprire solo la pagina del passo non basta a completarla.`);
  check(!tutorialTaskDone(id, {}) && !tutorialTaskDone(id, undefined), `${id}: senza stato non è completata.`);
}
check(tutorialTaskDone('agenda', { page: 'calendario', tabs: { agenda: { value: 'calendario' } } }), 'agenda: completata con la scheda Calendario.');
check(tutorialTaskDone('campagna', { page: 'elezioni', tabs: { elezioni: { value: 'programma' } } }) && !tutorialTaskDone('campagna', { page: 'elezioni', tabs: { elezioni: { value: 'campagna' } } }), 'campagna: serve la scheda Programma.');

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
      // the practice: go where it says, then do it
      if (item.id === 'istituzioni') { await evaluate(`location.hash = '#referendum'; true`); await pause(2000); }
      const pointed = await task();
      check(pointed?.pointed, `${item.id}: il controllo da usare è evidenziato.`);
      const target = await evaluate(`document.querySelector('[data-tutorial-task]').dataset.taskTarget`);
      check(await click(target.split(',')[0].trim()) || await click(target.split(',')[1]?.trim() ?? 'x'), `${item.id}: il controllo indicato esiste (${target}).`);
      await pause(400);
      const after = await task();
      check(after?.done === '1' && after.text.includes('Fatto!') && after.text.includes(TUTORIAL_TASKS[item.id].result.slice(0, 30)), `${item.id}: completata e verificata, con il risultato spiegato (${after?.done}).`);
      done.push(item.id);
    } else check(t === null, `${item.id}: un passo senza prova non mostra finte prove.`);
    if (step < TUTORIAL_STEPS.length) await click('[data-tutorial=next]');
  }
  check(done.length === Object.keys(TUTORIAL_TASKS).length, `Tutte le prove eseguite (${done.join(', ')}).`);
  const after = await facts();
  check(after === before, `Le prove non consumano settimana, giorni, data, fondi né capitale: ${before} → ${after}.`);
  if (errors.length) problems.push(`Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
});
if (problems.length) { console.error(`Tutorial pratico: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 30).join('\n')}`); process.exit(1); }
console.log('Tutorial pratico verificato: prove sulle pagine vere (Agenda, Partito, Campagna, Sondaggi, Referendum), controllo evidenziato, verifica dallo stato reale, risultato spiegato, nessun costo; percorsi nella guida.');
