// The open vote in the browser (Chrome): Home names the measure and the assembly and offers «SEGUI IN DIRETTA» and «SIMULA VOTAZIONE» (and the week cannot be closed); the sitting shows the assembly in large
// letters, the title, the content and the President; the ballot has three choices and the vote cannot be confirmed without one; followed live the Aula counts seat by seat WITHOUT telling the final numbers
// before the last seat, the player's vote highlighted once; simulated, the result comes at the end; the open vote survives a reload; «Non seguire» looks active; nothing overflows at 390 and 1440 px.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Votazione aperta nel browser saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(250); };
  const overflow = () => evaluate(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || [...document.querySelectorAll('.floor-window, .aula-window')].some(el => el.scrollWidth > el.clientWidth + 1)`);
  await S(`let i = 0; for (; i < 80 && !store.openVotes().some(v => v.scope === 'nazionale'); i++) store.advance(7); return i;`);
  const open = JSON.parse(await S(`return JSON.stringify(store.openVotes().find(v => v.scope === 'nazionale'))`));
  await evaluate(`document.documentElement.dataset.sceneMotion = 'full', true`);

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await viewport(width, height, width < 700);
    await evaluate(`location.hash = '#panoramica'; true`); await pause(900);
    await wait(() => has('[data-floor-offer]'), 20000);
    const home = await evaluate(`(() => { const band = document.querySelector('[data-floor-offer]'); const skip = document.querySelector('[data-aula-dismiss]'); return { text: band.textContent.replace(/\\s+/g, ' '), live: band.querySelector('[data-floor-mode="diretta"]')?.textContent.trim(), sim: band.querySelector('[data-floor-mode="simulata"]')?.textContent.trim(), skipClass: skip?.className ?? null, skipOpacity: skip ? getComputedStyle(skip).opacity : null }; })()`);
    assert.ok(home.text.includes(open.title) && home.text.toLowerCase().includes(open.assemblyName.toLowerCase()), `${width}px: la Home dice quale provvedimento si vota e dove (${open.title} · ${open.assemblyName}).`);
    assert.equal(home.live, 'SEGUI IN DIRETTA'); assert.equal(home.sim, 'SIMULA VOTAZIONE');
    assert.ok(!/(approvata|respinta) con|\d+ (sì|favorevoli|contrari)|soglia/i.test(home.text), 'La Home non anticipa nessun esito.');
    if (home.skipClass) { assert.ok(/secondary-button/.test(home.skipClass) && home.skipOpacity === '1', '«Non seguire» è un pulsante secondario ben visibile, non grigio.'); }
    assert.equal(await overflow(), false, `${width}px: la Home non scorre di lato.`);
    // the week cannot be closed from Home
    const before = await S(`return store.getState().clock.currentDate`);
    await evaluate(`document.querySelector('[data-action="advance"]')?.click(), true`); await pause(700);
    assert.equal(await S(`return store.getState().clock.currentDate`), before, 'Chiudere la settimana non passa con una votazione aperta.');
  }

  // ---- LIVE: the sitting, the ballot, the Aula
  await viewport(1440, 900, false);
  await click('[data-floor-open][data-floor-mode="diretta"]');
  await wait(() => has('.floor-overlay'), 8000);
  const sitting = await evaluate(`({ assembly: document.querySelector('[data-floor-assembly-name]').textContent, upper: getComputedStyle(document.querySelector('[data-floor-assembly-name]')).textTransform, size: parseFloat(getComputedStyle(document.querySelector('[data-floor-assembly-name]')).fontSize), title: document.querySelector('#floor-title').textContent, content: document.querySelectorAll('.floor-content div').length, mode: document.querySelector('.floor-overlay').dataset.floorMode })`);
  assert.equal(sitting.assembly.toLowerCase(), open.assemblyName.toLowerCase(), 'L’assemblea è scritta per esteso.'); assert.ok(sitting.size >= 20 && sitting.upper === 'uppercase', `E in grande, maiuscolo (${sitting.size}px).`);
  assert.equal(sitting.title, open.title); assert.ok(sitting.content >= 1, 'Il contenuto del provvedimento si legge.'); assert.equal(sitting.mode, 'diretta');
  await wait(() => evaluate(`document.querySelector('.floor-overlay')?.dataset.floorPhase === 'voto'`), 20000);
  assert.ok(await evaluate(`/Presidente/.test(document.querySelector('.floor-said').textContent)`), 'Il Presidente apre la seduta.');
  assert.equal(await evaluate(`document.querySelector('[data-floor-confirm]').disabled`), true, 'Senza una scelta il voto non si conferma.');
  assert.equal(await evaluate(`document.querySelectorAll('[data-floor-choice]').length`), 3, 'Tre scelte.');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-floor-choice]')].map(b => b.dataset.floorChoice)`), ['favorevole', 'contrario', 'astenuto']);
  assert.ok(!(await has('[data-floor-outcome]')) && !(await has('.floor-board')), 'Prima del voto nessun esito e nessun conteggio.');
  assert.equal(await overflow(), false);
  await click('[data-floor-choice="astenuto"]');
  assert.equal(await evaluate(`document.querySelector('[data-floor-confirm]').disabled`), false);
  await click('[data-floor-confirm]');
  await wait(() => has('.aula-overlay:not(.floor-overlay)'), 8000);
  assert.equal(await S(`return store.openVotes().length`), 0, 'Confermato il voto la votazione non è più aperta.');
  assert.equal(await evaluate(`document.querySelectorAll('.aula-overlay').length`), 1);
  assert.equal(await evaluate(`document.querySelector('.aula-overlay').dataset.aulaMode`), 'diretta');
  assert.ok(/astenuto/i.test(await evaluate(`document.querySelector('[data-aula-mine]')?.textContent ?? ''`)), 'Il voto del giocatore è evidenziato.');
  const final = await S(`const v = store.getState().parliament.laws.find(l => l.id === ${JSON.stringify(open.lawId)}).votes.at(-1); return { yes: v.yes, against: v.against, abstain: v.abstain, total: v.total }`);
  // while the count is under way: only the votes already cast, never the final numbers, never the outcome
  const mid = await evaluate(`({ final: document.querySelector('.aula-overlay').dataset.aulaFinal, board: Object.fromEntries([...document.querySelectorAll('[data-aula-count]')].map(el => [el.dataset.aulaCount, Number(el.textContent)])), said: document.querySelector('.aula-said').textContent, shown: Number(document.querySelector('.aula-overlay').dataset.aulaShown) })`);
  if (mid.final === '0') {
    assert.ok(mid.board.yes + mid.board.against + mid.board.abstain === mid.board.voted, 'Mentre si conta, i totali sono la somma dei voti già espressi.');
    assert.ok(mid.board.yes < final.yes || mid.board.against < final.against, 'I numeri finali non sono ancora scritti.');
    assert.ok(!/approva|respinge/i.test(mid.said), 'L’esito non è proclamato prima dell’ultimo voto.');
  }
  assert.equal(await evaluate(`document.querySelectorAll('.aula-seat.is-player').length`), 1, 'Il seggio del giocatore è uno solo.');
  await wait(() => evaluate(`document.querySelector('.aula-overlay')?.dataset.aulaFinal === '1'`), 40000);
  const end = await evaluate(`Object.fromEntries([...document.querySelectorAll('[data-aula-count]')].map(el => [el.dataset.aulaCount, Number(el.textContent)]))`);
  assert.deepEqual([end.yes, end.against, end.abstain], [final.yes, final.against, final.abstain], 'Alla fine la lavagna è esattamente il voto del gioco.');
  assert.equal(end.voted + end.absent, end.total, 'Hanno votato + assenti = seggi.');
  assert.ok(/approva|respinge/i.test(await evaluate(`document.querySelector('.aula-said').textContent`)), 'A voto concluso il Presidente proclama l’esito.');
  assert.equal(await evaluate(`document.querySelectorAll('.aula-said li.is-mine').length`), 1, 'Il tuo voto è detto una volta sola.');
  await click('[data-aula-close]');

  // ---- SIMULATED + reload in the middle of a vote
  await S(`let i = 0; for (; i < 80 && !store.openVotes().length; i++) store.advance(7); return i;`);
  await evaluate(`location.hash = '#panoramica'; true`); await pause(700);
  await wait(() => has('[data-floor-offer]'), 15000);
  const openBefore = await S(`return store.openVotes().map(v => v.id).join()`);
  await goto(); await wait(() => has('[data-menu=continua]')); await click('[data-menu=continua]'); await wait(() => has('.page-wrap'));
  await wait(() => has('[data-floor-offer]'), 15000);
  assert.equal(await S(`return store.openVotes().map(v => v.id).join()`), openBefore, 'Dopo il ricaricamento le votazioni sono ancora aperte, le stesse (e nessun voto è stato contato).');
  await evaluate(`document.documentElement.dataset.sceneMotion = 'full', true`);
  await click('[data-floor-open][data-floor-mode="simulata"]');
  await wait(() => has('.floor-overlay'), 8000);
  assert.equal(await evaluate(`document.querySelector('.floor-overlay').dataset.floorMode`), 'simulata');
  await wait(() => evaluate(`document.querySelector('.floor-overlay')?.dataset.floorPhase === 'voto'`), 8000);
  await click('[data-floor-choice="contrario"]'); await click('[data-floor-confirm]');
  await wait(() => evaluate(`document.querySelector('.floor-overlay')?.dataset.floorPhase === 'esito'`), 8000);
  const result = await evaluate(`({ outcome: document.querySelector('[data-floor-outcome]').dataset.floorOutcome, mine: document.querySelector('[data-floor-mine]').dataset.floorMine, counts: Object.fromEntries([...document.querySelectorAll('.floor-board [data-floor-count]')].map(el => [el.dataset.floorCount, Number(el.textContent)])) })`);
  assert.ok(['approvato', 'respinto'].includes(result.outcome)); assert.equal(result.mine, 'contrario');
  assert.equal(result.counts.voted + result.counts.absent, result.counts.total, 'Simulata: i conti tornano.');
  await viewport(390, 844, true); await pause(300);
  assert.equal(await overflow(), false, 'Su telefono l’esito non scorre di lato.');
  await click('[data-floor-close]');
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
}, { voter: false });
console.log('Votazione aperta verificata in Chrome: Home con provvedimento e assemblea, settimana bloccata, diretta con seduta, voto obbligatorio a tre scelte, conteggio seggio per seggio senza anticipare l’esito, simulazione con esito alla fine, ricaricamento con la votazione ancora aperta, 390 e 1440 px.');
