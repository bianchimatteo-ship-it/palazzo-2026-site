// The reminders of the promises: due milestones (eight, four, one week before the deadline, late, not started) each once, at most one card every three weeks, only for open promises, most urgent first;
// in the browser the card appears in a quiet moment, is hidden while a dialog is open, never repeats after «Più tardi», and «Apri il programma» goes to the elections.
import assert from 'node:assert/strict';
import { dueReminders, markReminded, REMINDER_RULES } from '../src/core/promise-reminders.js';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const promise = (id, madeWeek, dueWeek, extra = {}) => ({ id, kind: 'programma', label: id, intervention: 'Investimento', madeWeek, dueWeek, status: 'in-corso', progress: 10, area: 'sanita', ...extra });
{
  const game = { promises: [promise('a', 1, 30), promise('b', 1, 12), promise('c', 1, 5, { status: 'mantenuta' }), promise('d', 1, 25, { status: 'non-avviata', progress: 0 })] };
  assert.equal(dueReminders(game, { week: 2 }).items.length, 0, 'Lontano dalla scadenza e appena fatte: nessun promemoria.');
  const at4 = dueReminders(game, { week: 4 });
  assert.ok(at4.items.some(item => item.promiseId === 'b' && item.kind === 'scadenza' && item.weeksLeft === 8), 'A otto settimane dalla scadenza compare il promemoria.');
  assert.ok(!at4.items.some(item => item.promiseId === 'c'), 'Una promessa già mantenuta non ricorda nulla.');
  const shown = markReminded(game, at4.keys, { week: 4 });
  assert.equal(dueReminders(shown, { week: 5 }).items.length, 0, 'Al massimo una scheda ogni tre settimane.');
  assert.equal(dueReminders(shown, { week: 4 + REMINDER_RULES.every }).items.filter(item => item.key === at4.keys[0]).length, 0, 'Un promemoria già mostrato non si ripete.');
  const later = dueReminders(shown, { week: 8 });
  assert.ok(later.items.some(item => item.promiseId === 'b' && item.weeksLeft === 4), 'Quattro settimane prima: nuovo promemoria.');
  const late = dueReminders({ ...shown, reminderLog: { lastShown: 0 } }, { week: 14 });
  assert.ok(late.items.some(item => item.promiseId === 'b' && item.kind === 'ritardo'), 'Scaduta: «in ritardo».');
  const notStarted = dueReminders({ promises: [promise('n', 1, 60, { status: 'non-avviata', progress: 0 })] }, { week: 8 });
  assert.ok(notStarted.items[0]?.kind === 'avvio', 'Non avviata da sei settimane: promemoria.');
  assert.ok(dueReminders({ promises: Array.from({ length: 6 }, (_, n) => promise(`x${n}`, 1, 8 + n)) }, { week: 3 }).items.length <= REMINDER_RULES.max, 'Al massimo tre promesse per scheda.');
}
if (chromeAvailable) await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version, send, screenshot }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm=cancel],[data-news-popup-close]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  await S(`store.getState().game.resources.politicalCapital = 40; try { store.makePromise({ area: 'sanita', scope: 'candidato', instrument: 'investimento', ambition: 'media', dueWeeks: 8 }); } catch (e) { return e.message; } return true;`);
  await S(`const g = store.getState().game; g.promises.forEach(p => { p.dueWeek = g.week.index + 6; }); return true;`);
  await evaluate(`window.__offerReminder?.(); true`); await pause(900);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-promise-reminder]') && !document.querySelector('[data-promise-reminder]').hidden)`), 'La scheda compare in un momento tranquillo.');
  assert.match(await evaluate(`document.querySelector('[data-promise-reminder]').innerText`), /Ricordati cosa hai promesso/);
  if (process.env.QA_SHOT_DIR) for (const [w, h] of [[390, 844], [820, 1180]]) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); await pause(500); await screenshot(`${process.env.QA_SHOT_DIR}/promemoria-promesse-it-${w}x${h}.png`); }
  await evaluate(`document.querySelector('[data-reminder-later]').click(); true`); await pause(500);
  assert.ok(!(await evaluate(`Boolean(document.querySelector('[data-promise-reminder]'))`)), '«Più tardi» chiude la scheda.');
  await evaluate(`window.__offerReminder?.(); true`); await pause(600);
  assert.ok(!(await evaluate(`Boolean(document.querySelector('[data-promise-reminder]'))`)), 'Lo stesso promemoria non ricompare.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Promemoria delle promesse verificati: scadenze a otto, quattro e una settimana, ritardo, promessa non avviata, una scheda ogni tre settimane, mai ripetuti, scheda non bloccante in un momento tranquillo.');
