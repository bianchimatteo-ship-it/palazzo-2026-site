// The page «Referendum» reorganized, in Chrome with real clicks: summary (what the player has to do / what happens by itself), the two paths as tabs, the guided question (suggestions that follow the law,
// live admissibility check with the reasons), the guided constitutional revision (drafts by topic, editable, saved with the proposal), the phases explained, phone / tablet / desktop without horizontal scroll.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.error('SKIPPED: Chrome non trovato.'); process.exit(process.env.REQUIRE_CHROME ? 1 : 0); }
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, screenshot, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm-cancel]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(500); await evaluate(`location.hash = '#referendum'; true`); await pause(1500); };
  const text = sel => evaluate(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ''`);
  const set = (sel, value, ev = ['input', 'change']) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; for (const e of ${JSON.stringify(ev)}) el.dispatchEvent(new Event(e, { bubbles: true })); return true; })()`);
  await S(`const s = store.getState(); s.game.referendums = []; s.game.resources.funds = 50000; s.game.resources.politicalCapital = 20; s.parliament = { ...s.parliament, statutes: [{ id: 'st-1', lawId: 'l1', number: 1, title: 'Fondo per le scuole di montagna', summary: 'Un fondo.', area: 'scuola', instrument: 'investimento', kind: 'ddl', origin: 'La maggioranza', approvedAt: s.clock.currentDate, legislature: 1, status: 'vigente', blockable: true, amendments: [] }, { id: 'st-3', lawId: 'l3', number: 3, title: 'Obblighi per le strutture sanitarie', summary: 'Regole.', area: 'sanita', instrument: 'regole', kind: 'ddl', origin: 'La maggioranza', approvedAt: s.clock.currentDate, legislature: 1, status: 'vigente', blockable: true, amendments: [] }, { id: 'st-2', lawId: 'l2', number: 2, title: 'Imposta sui consumi', summary: 'Tributaria.', area: 'fisco', instrument: 'tasse', kind: 'ddl', origin: 'La maggioranza', approvedAt: s.clock.currentDate, legislature: 1, status: 'vigente', blockable: true, amendments: [] }] }; return true;`);
  await open();
  // ---- summary and tabs
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-ref-summary]'))`), 'Il riepilogo c’è.');
  assert.match(await text('[data-ref-summary]'), /Tocca a te/); assert.match(await text('[data-ref-summary]'), /Avviene da solo/);
  assert.equal(await evaluate(`document.querySelectorAll('[data-section-tab=referendum]').length >= 2`), true, 'I due percorsi sono due schede.');
  assert.equal(await evaluate(`document.querySelector('[data-ref-section]').dataset.refSection`), 'abrogativo');
  assert.ok(await evaluate(`document.querySelector('[data-ref-section]').firstElementChild.tagName === 'HEADER' && Boolean(document.querySelector('[data-ref-section] > .ref-new'))`), 'La nuova richiesta viene subito dopo l’intestazione del percorso, prima delle card in corso.');
  // ---- guided question
  assert.ok(await evaluate(`document.querySelectorAll('[data-ref-suggest]').length >= 2`), 'Ci sono formulazioni suggerite.');
  assert.match(await text('[data-ref-check]'), /può essere presentato|ammissibile/, 'Il controllo dice subito se il quesito va bene.');
  await set('[data-ref-form] [name=statuteId]', 'st-3'); await pause(500);
  const firstSuggest = await evaluate(`document.querySelector('[data-ref-suggest]').dataset.refSuggest`);
  assert.match(firstSuggest, /Obblighi per le strutture sanitarie/, 'La formulazione segue la legge scelta.');
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-ref-suggest]')].some(b => /sanità/i.test(b.dataset.refSuggest))`), 'Una formulazione cita la materia della legge.');
  await evaluate(`document.querySelector('[data-ref-suggest]').click(); true`); await pause(500);
  assert.equal(await evaluate(`document.querySelector('[data-ref-form] [name=question]').value`), firstSuggest, 'Un clic sul suggerimento riempie il quesito, che resta modificabile.');
  await set('[data-ref-form] [name=question]', 'Volete voi che sia abrogata la legge sulle strutture sanitarie, che modifica gli obblighi di accreditamento?'); await pause(700);
  assert.match(await text('[data-ref-check]'), /Chiarezza/, 'Il controllo mostra chiarezza e omogeneità.');
  // a partial repeal without the parts: explained
  await evaluate(`(() => { const r = document.querySelector('[data-ref-form] [name=scope][value=parziale]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(700);
  assert.equal(await evaluate(`document.querySelector('[data-ref-check]').classList.contains('is-bad')`), true, 'Parziale senza parti: non ammissibile.');
  assert.match(await text('[data-ref-check]'), /quali parti/, 'Con il motivo.');
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-ref-suggest]')].some(b => /limitatamente|disposizioni su/.test(b.dataset.refSuggest))`), 'Le formulazioni per la parziale sono diverse.');
  await set('[data-ref-form] [name=partText]', 'articolo 3, commi 1 e 2 (accreditamento)'); await pause(700);
  assert.equal(await evaluate(`document.querySelector('[data-ref-check]').classList.contains('is-ok')`), true, 'Con le parti il quesito è ammissibile.');
  assert.equal(await S(`return store.referendums().length;`), 0, 'Nulla è stato presentato senza conferma.');
  // the tax law is shown but cannot be chosen
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-ref-form] [name=statuteId] option')].some(o => o.disabled && /non ammesso/.test(o.textContent))`), 'La legge tributaria è elencata come non ammessa, con il motivo.');
  // submit: a request appears, the summary tells what the player has to do
  await evaluate(`(() => { const f = document.querySelector('[data-ref-form]'); f.scope.value = 'totale'; f.question.value = ''; f.route.value = 'firme'; f.requestSubmit(); return true; })()`); await pause(1200);
  assert.equal(await S(`return store.referendums().length;`), 1, 'La richiesta è presentata solo dopo l’invio del modulo.');
  assert.match(await text('[data-ref-summary] .is-mine'), /Obblighi per le strutture sanitarie|Fondo per le scuole/, 'Il riepilogo mette la richiesta tra ciò che tocca al giocatore (raccolta firme).');
  assert.match(await text('[data-referendum-card]'), /Tocca a te/, 'La card dice che tocca al giocatore.');
  // a phase that runs by itself
  await S(`const r = store.getState().game.referendums[0]; Object.assign(r, { phase: 'cassazione', cassationAt: '2099-01-10' }); return true;`); await open();
  assert.match(await text('[data-ref-summary] .is-auto'), /Ufficio centrale/, 'Cassazione: avviene da sola.');
  assert.match(await text('[data-referendum-card]'), /Avviene da solo/);
  // ---- the constitutional path
  await evaluate(`document.querySelector('[data-section-tab=referendum][data-section-tab-value=costituzionale]').click(); true`); await pause(900);
  assert.equal(await evaluate(`document.querySelector('[data-ref-section]').dataset.refSection`), 'costituzionale', 'La scheda cambia percorso.');
  await S(`const s = store.getState(); s.parliament = { ...s.parliament, player: { ...(s.parliament.player ?? {}), groupId: s.parliament.player?.groupId ?? 'cam-xix-02' } }; return true;`); await open();
  if (await evaluate(`document.querySelector('[data-ref-section]').dataset.refSection !== 'costituzionale'`)) { await evaluate(`document.querySelector('[data-section-tab=referendum][data-section-tab-value=costituzionale]').click(); true`); await pause(900); }
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-revision-form]'))`), 'Il modulo della revisione c’è.');
  assert.ok(await evaluate(`document.querySelectorAll('[data-revision-use]').length >= 2`), 'Bozze suggerite per il tema.');
  await set('[data-revision-form] [name=topic]', 'Nuove regole per la sfiducia al Governo'); await pause(500);
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-revision-use]')].some(b => /fiducia|Sfiducia|sfiducia/.test(b.dataset.revisionTitle))`), 'Le bozze seguono il tema scelto.');
  await evaluate(`document.querySelector('[data-revision-use]').click(); true`); await pause(300);
  const title = await evaluate(`document.querySelector('[data-revision-form] [name=custom]').value`), desc = await evaluate(`document.querySelector('[data-revision-form] [name=description]').value`);
  assert.ok(title.length > 10 && desc.length > 40, 'La bozza riempie titolo e descrizione, modificabili.');
  await set('[data-revision-form] [name=description]', desc + ' (versione modificata dal giocatore)');
  assert.match(await text('[data-revision-note]'), /non scrive né applica/, 'Dice che il gioco non applica il testo.');
  assert.equal(await S(`return store.referendums().filter(r => r.kind === 'costituzionale').length;`), 0, 'Nulla è presentato senza invio.');
  await evaluate(`document.querySelector('[data-revision-form]').requestSubmit(); true`); await pause(1200);
  const saved = await S(`const r = store.referendums().find(r => r.kind === 'costituzionale'); return r ? { title: r.title, description: r.description, phase: r.phase } : null;`);
  assert.ok(saved && saved.title === title && /modificata dal giocatore/.test(saved.description), 'Titolo e descrizione modificati sono salvati con la proposta.');
  await open(); if (await evaluate(`document.querySelector('[data-ref-section]').dataset.refSection !== 'costituzionale'`)) { await evaluate(`document.querySelector('[data-section-tab=referendum][data-section-tab-value=costituzionale]').click(); true`); await pause(900); }
  assert.match(await text('[data-referendum-card][data-referendum-kind=costituzionale]'), /modificata dal giocatore/, 'La card mostra la descrizione.');
  assert.match(await text('[data-ref-section]'), /Requisiti e procedura/); assert.match(await text('[data-ref-section]'), /Tocca a te/); assert.match(await text('[data-ref-section]'), /Automatico/);
  // ---- layouts and screenshots
  for (const [kind, width] of [['abrogativo', 390], ['costituzionale', 390], ['abrogativo', 820], ['costituzionale', 1280]]) {
    await viewport(width, width < 500 ? 844 : 1000); await open();
    if (await evaluate(`document.querySelector('[data-ref-section]').dataset.refSection !== '${kind}'`)) { await evaluate(`document.querySelector('[data-section-tab=referendum][data-section-tab-value=${kind}]').click(); true`); await pause(900); }
    const m = await evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, over: [...document.querySelectorAll('[data-referendum-page] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).length })`);
    if (m.over) console.log('OVER', await evaluate(`[...document.querySelectorAll('[data-referendum-page] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)).join(' | ')`));
    assert.ok(m.doc <= m.vw + 1 && m.over === 0, `${kind} a ${width}px: nessuno scorrimento orizzontale e nessun elemento fuori schermo (${m.doc}/${m.vw}, ${m.over}).`);
    await evaluate(`[...document.querySelectorAll('button')].filter(b => /^Chiudi$/.test(b.textContent.trim())).forEach(b => b.click()); true`); await pause(400);
    await screenshot(`${OUT}referendum-${kind}-${width}.png`);
    await evaluate(`document.querySelector('[data-ref-section]').scrollIntoView(); true`); await pause(400); await screenshot(`${OUT}referendum-${kind}-${width}-modulo.png`);
  }
  assert.deepEqual(errors.filter(e => !/api\//.test(String(e))), [], 'Nessun errore in pagina.');
});
console.log('Pagina Referendum riorganizzata verificata in Chrome: riepilogo (tocca a te / automatico), due percorsi a schede, quesito guidato con controllo di ammissibilità, revisione costituzionale con bozze, schermate in docs/qa/screenshots/final.');
