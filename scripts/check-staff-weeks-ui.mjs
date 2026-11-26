// «Lo staff segue la linea del gruppo» e le simulazioni da 2 e 4 settimane, ESATTAMENTE come le usa il giocatore: in Chrome, con le impostazioni cambiate dalla schermata Impostazioni, il pulsante
// «Avanza» (con la sua conferma per più settimane), nessun elettore di prova (le votazioni restano aperte davvero), poi salvataggio, chiusura e ricaricamento della pagina.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Staff e settimane nel browser saltati: Chrome non trovato (imposta CHROME_PATH per eseguirli).'); process.exit(0); }
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };

await withBrowser(async browser => {
  const { evaluate, waitFor, pause, version, errors, goto } = browser;
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', level: 'deputato', weeks: 1 });
  await openCareer(browser);
  const state = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const { openVotesOf } = await import('/src/core/lawmaking-engine.js?v=${version}'); const s = store.getState(); return { week: s.game.week.index, date: s.clock.currentDate, open: openVotesOf(s).map(v => ({ id: v.id, title: v.title, line: v.line, scope: v.scope, own: Boolean(v.own) })), staff: (s.game.memory ?? []).filter(m => m.kind === 'voto-staff').map(m => m.text), notice: s.ui.advanceNote ?? null, stops: store.votesStoppingTheWeek().length }; })()`);
  const setSetting = async (key, value) => {
    await evaluate(`document.querySelector('[data-nav="impostazioni"]')?.click(), true`); await pause(600);
    const ok = await evaluate(`(() => { const b = document.querySelector('[data-setting-key="${key}"][data-setting-value="${value}"]'); if (!b) return false; b.click(); return true; })()`);
    check(ok, `Nelle Impostazioni c’è il comando ${key}=${value}.`);
    await pause(300);
    await evaluate(`document.querySelector('[data-nav="panoramica"]')?.click(), true`); await pause(600);
  };
  // the Advance button as the player presses it; the multi-week confirmation is answered; the call waits until the game has stopped changing (a slow machine needs longer than any fixed pause)
  const settled = async () => { let last = '', same = 0; for (let n = 0; n < 60 && same < 2; n++) { await pause(250); const now = JSON.stringify(await state()); same = now === last ? same + 1 : 0; last = now; } };
  const press = async () => {
    await evaluate(`document.querySelector('[data-action="advance"]')?.click(), true`); await pause(350);
    if (await evaluate(`Boolean(document.querySelector('.confirm-dialog [data-confirm="ok"]'))`)) await evaluate(`document.querySelector('.confirm-dialog [data-confirm="ok"]').click(), true`);
    await settled();
  };
  // the player's own ballot on whatever is open (so every test starts from a clean state)
  const clearVotes = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const { openVotesOf } = await import('/src/core/lawmaking-engine.js?v=${version}'); for (const v of openVotesOf(store.getState())) { try { store.castOpenVote(v.id, 'favorevole'); } catch {} } return true; })()`);
  const resolveUrgent = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); for (const item of store.getState().game.inbox.filter(e => ['urgente', 'situazione'].includes(e.kind))) for (const c of item.choices ?? []) { try { store.resolveAgendaItem(item.id, c.id); break; } catch {} } return true; })()`);

  // ---- 1) «Lo staff segue la linea del gruppo»: scelto dalle impostazioni, ricordato dopo il ricaricamento ----
  await setSetting('staffVotes', 'linea');
  const persisted = await evaluate(`JSON.parse(localStorage.getItem('politicando.settings.v1') ?? '{}').staffVotes`);
  check(persisted === 'linea', `L’impostazione è salvata (${persisted}).`);

  let casts = 0, ordinaryStops = 0, weeksDone = 0, essentialStops = 0;
  for (let n = 0; n < 60; n++) {
    await resolveUrgent();
    const before = await state();
    await press();
    const after = await state();
    weeksDone += Math.max(0, after.week - before.week);
    if (after.week === before.week) {
      // the week did not close: the only legitimate reasons are an essential ballot, or an urgent decision
      if (after.stops > 0) { essentialStops++; const essential = after.open.every(v => v.scope === 'fiducia' || v.own || /bilancio|manovra/i.test(v.title ?? '')); if (!essential) ordinaryStops++; await clearVotes(); }
    }
    casts = after.staff.length;
  }
  check(ordinaryStops === 0, `Con la linea del gruppo il pulsante Avanza non si ferma su votazioni ordinarie (fermate ordinarie: ${ordinaryStops}).`);
  check(weeksDone >= 40, `Con lo staff delegato la settimana avanza quasi sempre (${weeksDone} settimane su 60 pressioni, ${essentialStops} fermate per voti essenziali).`);
  check(casts > 0, `Lo staff ha votato e il diario lo dice (${casts} voti).`);
  const staffSample = (await state()).staff.at(-1) ?? '';
  check(!casts || /linea del gruppo/.test(staffSample), `Il diario indica con quale linea ha votato lo staff («${staffSample.slice(0, 120)}»).`);

  // ---- 2) due e quattro settimane dalla Impostazioni + pulsante Avanza (con la conferma) ----
  for (const weeks of [2, 4]) {
    await setSetting('weeksPerTurn', String(weeks));
    let exact = 0, stopped = 0, honest = 0, presses = 0;
    // a decision may legitimately stop the advance (it is told with how many weeks went by): press until the full length has gone by at least twice (at most 30 presses)
    for (let n = 0; n < 30 && exact < 2; n++) {
      presses++;
      await clearVotes(); await resolveUrgent();
      const before = await state();
      await press();
      const after = await state();
      const gone = after.week - before.week;
      if (gone === weeks) exact++;
      else { stopped++; if (after.notice && new RegExp(`${gone}\\s+(settiman\\w+)\\s+su\\s+${weeks}`).test(after.notice)) honest++; else if (gone === 1 && after.notice) honest++; }
    }
    check(exact >= 1, `Con ${weeks} settimane una pressione di Avanza ne fa passare ${weeks} (${exact} esatte, ${stopped} interrotte su ${presses} pressioni).`);
    check(stopped === honest, `Quando la simulazione di ${weeks} settimane si ferma, lo dice con quante settimane sono passate (${honest}/${stopped}).`);
  }

  // ---- 3) salvataggio, chiusura e ricaricamento ----
  const beforeReload = await state();
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.save(); return true; })()`);
  await goto();
  await openCareer(browser);
  const afterReload = await state();
  check(afterReload.week === beforeReload.week, `Dopo il ricaricamento la partita è alla stessa settimana (${beforeReload.week}→${afterReload.week}).`);
  const settingsAfter = await evaluate(`JSON.parse(localStorage.getItem('politicando.settings.v1') ?? '{}')`);
  check(settingsAfter.staffVotes === 'linea' && settingsAfter.weeksPerTurn === '4', `Le impostazioni sopravvivono al ricaricamento (${JSON.stringify({ staffVotes: settingsAfter.staffVotes, weeksPerTurn: settingsAfter.weeksPerTurn })}).`);
  check(errors.length === 0, `Nessun errore di pagina (${errors.slice(0, 2).join(' | ').slice(0, 200)}).`);
}, { voter: false });

if (problems.length) { console.error('Staff e settimane (browser) — problemi:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Staff e simulazione di 1, 2 e 4 settimane verificati nel browser: impostazioni dalla UI, pulsante Avanza, voti dello staff, interruzioni dichiarate, ricaricamento.');
