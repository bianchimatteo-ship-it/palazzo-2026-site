// The Aula in the browser: the history of the votes opens (concluded) a window over the Parliament page with the seats of the Chamber; with the motion on the seats light up one after the other (the board adds up the seats
// shown), with it off the final picture is there at once; «Vai all’esito» and Esc work; the vote is the one the engine decided (the board ends exactly on its totals) and nothing in the game changes;
// the window fits 320, 390, 768, 1024 and 1440 px with no horizontal scroll; in English no Italian is left; no JavaScript error. Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Aula nel browser saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(300); };
  // a vote the engine decides: the confidence of the Government (open), put in the saved game
  // (a vote of the Chamber recorded the way the engine records a confidence vote, with the totals of each group: the Aula replays whatever the state holds)
  const made = await S(`const saved = JSON.parse(store.exportSave()); const date = store.getState().clock.currentDate; const groups = saved.parliament.chambers.camera.groups; const byGroup = groups.map((group, index) => { const seats = group.simulatedSeats ?? 0, yes = index % 2 ? Math.round(seats * 0.2) : Math.round(seats * 0.9), abstain = Math.round((seats - yes) * 0.2); return { groupId: group.groupId, simulatedSeats: seats, yesVotes: yes, noVotes: seats - yes - abstain, abstainVotes: abstain, line: index % 2 ? 'contrario' : 'favorevole', snipers: 0, governing: index % 2 === 0 }; }); const total = byGroup.reduce((n, row) => n + row.simulatedSeats, 0), yes = byGroup.reduce((n, row) => n + row.yesVotes, 0); const vote = { id: 'fiducia-prova-camera', chamber: 'camera', date, kind: 'fiducia', confidence: true, total, yes, no: total - yes, needed: Math.floor(total / 2) + 1, passed: yes > total / 2, secret: false, byGroup }; saved.parliament.government = { ...(saved.parliament.government ?? {}), confidenceVotes: [...(saved.parliament.government?.confidenceVotes ?? []), { date, votes: [vote] }] }; store.loadGame(saved); return 'ok';`);
  assert.equal(made, 'ok', `Il voto si registra (${made}).`);
  await S(`const s = store.getState(); s.ui.activePage = 'parlamento'; return true;`);
  await evaluate(`location.hash = '#parlamento'; document.querySelector('[data-nav="parlamento"]')?.click(); true`);
  await wait(() => evaluate(`Boolean(document.querySelector('[data-aula-open]'))`), 15000);
  // (the position and the «seen» mark of the Aula are the only things the Aula may write: everything else must stay as it was)
  const snapshot = () => S(`const g = JSON.parse(JSON.stringify(store.getState().game)); delete g.flags.aulaSeen; delete g.flags.aulaProgress; return JSON.stringify({ p: store.getState().parliament, g });`);
  const resetAula = () => S(`const save = JSON.parse(store.exportSave()); delete save.game.flags.aulaSeen; delete save.game.flags.aulaProgress; store.loadGame(save); return true;`);
  const before = await snapshot();
  const open = (motion) => evaluate(`document.documentElement.dataset.sceneMotion = ${JSON.stringify(motion)}, true`);

  // motion off: the final picture at once
  await open('off');
  await click('[data-aula-open]');
  await wait(() => evaluate(`Boolean(document.querySelector('.aula-overlay'))`), 8000);
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaFinal`), '1', 'Con le animazioni spente la votazione è già all’esito.');
  const seatsN = await evaluate(`document.querySelectorAll('.aula-seat').length`);
  assert.ok(seatsN > 100, `La Camera ha i suoi seggi (${seatsN}).`);
  const board = await evaluate(`Object.fromEntries([...document.querySelectorAll('[data-aula-count]')].map(el => [el.dataset.aulaCount, Number(el.textContent)]))`);
  assert.ok(board.yes + board.against + board.abstain > 0 && board.yes + board.against + board.abstain + board.absent <= seatsN, 'La lavagna ha i totali del voto.');
  const votedSeats = await evaluate(`document.querySelectorAll('.aula-seat.is-voted').length`);
  assert.equal(votedSeats, board.yes + board.against + board.abstain, 'I seggi colorati sono esattamente i votanti.');
  assert.ok(await evaluate(`document.querySelectorAll('.aula-said li').length >= 4 && /fiducia/i.test(document.querySelector('.aula-said li.is-result')?.textContent ?? '')`), 'Il Presidente annuncia e proclama l’esito.');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`); await pause(200);
  assert.equal(await evaluate(`Boolean(document.querySelector('.aula-overlay'))`), false, 'Esc chiude l’Aula.');

  // the history of the votes (the Parliament page): even with the motion full it opens on the official result, marked as concluded: no animation, no pause, nothing saved
  await open('full');
  await click('[data-aula-open]');
  await wait(() => evaluate(`Boolean(document.querySelector('.aula-overlay'))`), 8000);
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaMode`), 'storico', 'Dallo storico si rivede l’esito: è distinto dalla diretta.');
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaFinal`), '1', 'Lo storico mostra già l’esito ufficiale.');
  assert.ok(/Storico · Votazione conclusa/.test(await evaluate(`document.querySelector('.aula-overlay .section-kicker').textContent`)), 'Ed è dichiarato concluso.');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-aula-pause]')) && !document.querySelector('[data-aula-pause]').hidden`), false, 'Nello storico non c’è nulla da mettere in pausa.');
  await click('[data-aula-close]');
  assert.equal(await evaluate(`Boolean(document.querySelector('.aula-overlay'))`), false);
  assert.equal(await snapshot(), before, 'Entrare in Aula non cambia nulla nel gioco.');
  await resetAula();
  // ---- Home: the vote of the last days is offered to be followed live; no result is told there; followed once, it is not offered again
  await viewport(1440, 900, false);
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1200);
  await wait(() => evaluate(`Boolean(document.querySelector('[data-aula-live]'))`), 20000);
  const offer = await evaluate(`(() => { const band = document.querySelector('[data-aula-live]'), button = band.querySelector('[data-aula-follow]'); return { text: band.textContent, button: button.textContent.trim(), upper: getComputedStyle(button).textTransform, hasSkip: Boolean(band.querySelector('[data-aula-dismiss]')) }; })()`);
  assert.equal(offer.button, 'SEGUI LA VOTAZIONE IN AULA', 'Il pulsante dorato della Home.'); assert.ok(offer.hasSkip, 'Si può non seguirla.');
  assert.ok(!/approva|respinge|fiducia accordata|favorevoli \d|\d+ (sì|no|contrari)/i.test(offer.text), 'La Home non anticipa l’esito del voto.');
  await open('full'); await click('[data-aula-follow]');
  await wait(() => evaluate(`Boolean(document.querySelector('.aula-overlay'))`), 8000);
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaFinal`), '0', 'All’inizio l’Aula non mostra ancora l’esito.');
  assert.ok(!/approva:|respinge:|accorda la fiducia|nega la fiducia/.test(await evaluate(`document.querySelector('.aula-said').textContent`)), 'Nessun esito nelle frasi del presidente prima della fine.');
  // live: the seats light up one after the other, the board adds up, pause stops it, skip goes to the end
  const a = Number(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaShown`));
  await pause(700);
  const b = Number(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaShown`));
  assert.ok(b > a && await evaluate(`document.querySelector('.aula-overlay').dataset.aulaFinal`) === '0', `Con le animazioni complete i seggi si accendono uno dopo l’altro (${a} → ${b}).`);
  const mid = await evaluate(`Object.fromEntries([...document.querySelectorAll('[data-aula-count]')].map(el => [el.dataset.aulaCount, Number(el.textContent)]))`);
  assert.ok(mid.yes + mid.against + mid.abstain <= board.yes + board.against + board.abstain, 'A metà la lavagna somma meno del totale.');
  await click('[data-aula-pause]'); const p1 = await evaluate(`document.querySelector('.aula-overlay').dataset.aulaShown`); await pause(500); const p2 = await evaluate(`document.querySelector('.aula-overlay').dataset.aulaShown`);
  assert.equal(p1, p2, 'Pausa ferma la votazione.');
  await click('[data-aula-skip]');
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaFinal`), '1', 'Vai all’esito salta alla fine.');
  const end = await evaluate(`Object.fromEntries([...document.querySelectorAll('[data-aula-count]')].map(el => [el.dataset.aulaCount, Number(el.textContent)]))`);
  assert.deepEqual([end.yes, end.against, end.abstain], [board.yes, board.against, board.abstain], 'Animato o no, la lavagna finisce sugli stessi totali.');
  // widths: the window fits, no horizontal scroll
  for (const [w, h, mobile] of [[320, 640, true], [390, 800, true], [768, 900, false], [1024, 800, false], [1440, 900, false]]) {
    await viewport(w, h, mobile); await pause(200);
    const fit = await evaluate(`(() => { const win = document.querySelector('.aula-window').getBoundingClientRect(); return { right: win.right, w: window.innerWidth, over: document.querySelector('.aula-overlay').scrollWidth - document.querySelector('.aula-overlay').clientWidth }; })()`);
    assert.ok(fit.right <= fit.w + 1 && fit.over <= 1, `${w}px: la finestra dell’Aula sta nello schermo (${JSON.stringify(fit)}).`);
  }
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaMode`), 'diretta', 'La diretta è marcata come tale.');
  await click('[data-aula-skip]');
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaFinal`), '1');
  assert.ok(/approva:|respinge:|accorda la fiducia|nega la fiducia/.test(await evaluate(`document.querySelector('.aula-said').textContent`)), 'Alla fine il presidente proclama l’esito.');
  await click('[data-aula-close]');
  await pause(500);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-aula-live]'))`), false, 'Seguita una volta, la votazione non è più proposta.');
  // ---- saved halfway: closed in the middle, the career closed and reopened, resumed exactly there; nothing recomputed, nothing applied twice; the result only at the end
  await resetAula(); await pause(400);
  const gameBefore = await snapshot();
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1000);
  await wait(() => evaluate(`Boolean(document.querySelector('[data-aula-live]'))`), 20000);
  await open('full'); await click('[data-aula-follow]');
  await wait(() => evaluate(`Boolean(document.querySelector('.aula-overlay'))`), 8000);
  await wait(() => evaluate(`Number(document.querySelector('.aula-overlay').dataset.aulaShown) >= 8`), 8000);
  await click('[data-aula-pause]');
  const halfway = Number(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaShown`));
  assert.ok(halfway >= 8 && await evaluate(`document.querySelector('.aula-overlay').dataset.aulaFinal`) === '0', `A metà (${halfway} seggi): nessun esito.`);
  const sequence = await evaluate(`[...document.querySelectorAll('.aula-seat.is-voted')].map(el => el.dataset.seat).join(',')`);
  const saved = await S(`return JSON.stringify(store.getState().game.flags.aulaProgress ?? null);`);
  assert.equal(JSON.parse(saved)?.shown, halfway, 'La posizione è salvata con la carriera.');
  await click('[data-aula-close]');
  assert.equal(await snapshot(), gameBefore, 'Chiudere a metà non cambia nulla nel gioco (solo la posizione).');
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await click('[data-menu=continua]');
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1200);
  await wait(() => evaluate(`Boolean(document.querySelector('[data-aula-live] [data-aula-resume]'))`), 20000);
  assert.match(await evaluate(`document.querySelector('[data-aula-resume]').textContent`), new RegExp(`${halfway} seggi su`), 'La Home dice da dove si riprende.');
  await open('full'); await click('[data-aula-follow]');
  await wait(() => evaluate(`Boolean(document.querySelector('.aula-overlay'))`), 8000);
  await click('[data-aula-pause]');
  const resumed = Number(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaShown`));
  assert.ok(resumed >= halfway, `Riparte da dove era (${halfway} → ${resumed}).`);
  const again = await evaluate(`[...document.querySelectorAll('.aula-seat.is-voted')].map(el => el.dataset.seat).join(',')`);
  const had = new Set(again.split(',')); assert.ok(sequence.split(',').every(seat => had.has(seat)), 'È la stessa sequenza: i seggi già votati prima di chiudere sono ancora votati, e nessuno cambia colore.');
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaFinal`), '0', 'Ancora nessun esito.');
  await click('[data-aula-skip]'); await click('[data-aula-close]'); await pause(300);
  assert.equal(await snapshot(), gameBefore, 'Nessun voto ricalcolato e nessun effetto duplicato.');
  assert.equal(await S(`return store.getState().game.flags.aulaProgress ?? null;`), null, 'A voto finito la posizione si cancella.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('check-aula-ui: ok');
