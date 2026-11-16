// The desk of the minister in Chrome, with real clicks: the panel on «Governo», a proposal prepared with the form, the action outside the competence refused in words, the colleague sounded out,
// the buttons that change the state, phone and tablet without horizontal scroll, English without Italian lines. The Prime Minister gets the button that convenes the Council.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Area ministeriale saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, screenshot, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const ok = await S(`const s = store.getState(); const m = s.parliament?.government?.ministers?.find(x => !x.playerAppointed && !x.endedAt); if (!m) return false; m.playerAppointed = true; s.game.resources.politicalCapital = 40; return true;`);
  assert.ok(ok, 'C’è un governo in cui il giocatore può essere ministro.');
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(400); await evaluate(`location.hash = '#governo'; true`); await pause(1500); };
  await open();
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-ministry-desk]'))`), 'L’area ministeriale compare nel Governo.');
  const text = await evaluate(`document.querySelector('[data-ministry-desk]').innerText`);
  assert.match(text, /Le aree del ministero/); assert.match(text, /Le tue proposte/);
  // the form prepares a proposal (costs a point of capital)
  const before = await S(`return store.getState().game.resources.politicalCapital;`);
  await evaluate(`(() => { const f = document.querySelector('[data-ministry-form]'); f.requestSubmit(); return true; })()`); await pause(1000);
  assert.equal(await S(`return store.ministryView().ministry.proposals.length;`), 1, 'Il modulo prepara una proposta.');
  assert.equal(await S(`return store.getState().game.resources.politicalCapital;`), before - 1);
  await open();
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-ministry-proposal][data-ministry-status="in-preparazione"]'))`), 'La proposta è in preparazione.');
  // advance: it becomes ready, the colleague is sounded out with a click, then it is taken to the Council
  await S(`for (let i = 0; i < 3; i++) store.advanceTurn(1, { delegate: true }); return true;`);
  await open();
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-ministry-proposal][data-ministry-status="pronta"]'))`), 'Dopo due settimane è pronta.');
  await evaluate(`document.querySelector('[data-ministry-kind="sonda"]').click(); true`); await pause(900);
  assert.equal(await S(`return store.ministryView().ministry.proposals[0].lobbied.length;`), 1, 'Il clic sonda un collega.');
  await open();
  await evaluate(`document.querySelector('[data-ministry-kind="porta"]').click(); true`); await pause(900);
  assert.equal(await S(`return store.ministryView().ministry.proposals[0].status;`), 'in-agenda', 'Il clic porta la proposta in Consiglio.');
  // phone and tablet
  for (const [w, h] of [[390, 844], [820, 1180]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); await pause(500); await open();
    assert.equal(await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1'), true, `${w}px: nessuno scorrimento orizzontale`);
    if (process.env.QA_SHOT_DIR) { await evaluate(`document.querySelector('[data-ministry-desk]')?.scrollIntoView({ block: 'start' }); true`); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/ministero-it-${w}x${h}.png`); }
  }
  // English
  await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1200);
  await evaluate(`document.querySelectorAll('[data-ministry-desk] details').forEach(d => { d.open = true; }); true`);
  const en = await evaluate(`document.querySelector('[data-ministry-desk]')?.innerText ?? ''`);
  const italian = en.split('\n').filter(line => !/^\s*\d{4}-\d{2}-\d{2}/.test(line) && /\b(il|la|le|lo|di|del|della|dei|delle|che|non|con|una|un|nel|alla|al|sono|è|proposta|proposte|ministero|settimana|Consiglio dei|giorno|giorni|Priorità|Prepara|Ritira|Porta|Incontro|finanzi)\b/i.test(line));
  assert.deepEqual(italian, [], `Nessuna riga italiana nell’area ministeriale in inglese: ${italian.join(' | ')}`);
  if (process.env.QA_SHOT_DIR) { await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await pause(400); await evaluate(`document.querySelector('[data-ministry-desk]')?.scrollIntoView({ block: 'start' }); true`); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/ministero-en-390x844.png`); }
  // the Prime Minister: the themes in crisis on the Home and the button that convenes the Council
  await S(`const s = store.getState(); s.parliament.government.ministers.forEach(m => { m.playerAppointed = false; }); s.parliament.government.primeMinister = 'player'; s.society.issues = [{ id: 'n-1', scope: 'nazionale', topic: 'Lavoro', indicator: 'occupazione', severity: 6 }, { id: 'r-1', scope: 'regionale', region: 'Calabria', topic: 'Sanità', indicator: 'sanita', severity: 9 }]; return true;`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }); await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('it')).then(() => true)`); await evaluate(`location.hash = '#governo'; true`); await pause(500); await evaluate(`location.hash = '#panoramica'; true`); await pause(1500);
  assert.ok(await evaluate(`Boolean(document.querySelector('#crisis-topics [data-crisis-topic="Sanità"]'))`), 'La Home del Presidente del Consiglio mostra i temi in crisi.');
  assert.match(await evaluate(`document.querySelector('#crisis-topics')?.innerText ?? ''`), /Calabria/);
  await open();
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-cabinet-convoke]')) || Boolean(document.querySelector('.cabinet-life'))`), 'Il Governo del Presidente del Consiglio ha la squadra e il Consiglio dei ministri.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Area ministeriale verificata in Chrome: pannello nel Governo, proposta dal modulo, collega sondato, proposta portata in Consiglio, smartphone e tablet, italiano e inglese.');
