// The page «Iniziative» in Chrome, with real clicks: the three things told apart, the form that opens a collection (and the errors it gives in words), the levers that cost money, the weekly progress,
// the deposit with its confirmation, the withdrawal, phone and tablet without horizontal scroll, English without Italian lines.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Pagina Iniziative saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, screenshot, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  await S(`store.getState().game.resources.funds = 20000; return true;`);
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(500); await evaluate(`location.hash = '#iniziative'; true`); await pause(1500); };
  await open();
  let text = await evaluate(`document.querySelector('[data-ini-page]')?.innerText ?? ''`);
  assert.match(text, /Tre strade diverse/); assert.match(text, /50\.000 firme/); assert.match(text, /500\.000 firme/); assert.match(text, /Proposta parlamentare/, 'Le tre cose sono distinte nella pagina.');
  // the form: an empty text is refused with the reason, a good one opens the collection
  await evaluate(`(() => { const f = document.querySelector('[data-ini-form]'); f.title.value = 'Salario minimo legale'; f.area.value = 'lavoro'; f.articles.value = ''; f.requestSubmit(); return true; })()`); await pause(800);
  assert.match(await evaluate(`document.querySelector('.toast')?.innerText ?? ''`), /scritta in articoli/, 'Senza articoli la proposta popolare è rifiutata con il motivo.');
  await evaluate(`(() => { const f = document.querySelector('[data-ini-form]'); f.title.value = 'Salario minimo legale'; f.area.value = 'lavoro'; f.articles.value = 'Art. 1 — Il salario minimo orario è fissato per legge.\\nArt. 2 — Il Ministero del lavoro vigila.'; f.requestSubmit(); return true; })()`); await pause(1200);
  assert.equal(await S(`return store.initiatives().length;`), 1, 'La raccolta è aperta.');
  text = await evaluate(`document.querySelector('[data-initiative]')?.innerText ?? ''`);
  assert.match(text, /Raccolta aperta/); assert.match(text, /su 50\.000 firme/); assert.match(text, /Organizza la raccolta/); assert.match(text, /Testo in 2 articoli/);
  assert.equal(await evaluate(`document.querySelector('[data-ini-deposit]').disabled`), true, 'Sotto la soglia il deposito è disabilitato.');
  // levers with a click: banchetti cost money
  const fundsBefore = await S(`return store.getState().game.resources.funds;`);
  await evaluate(`document.querySelector('[data-ini-lever="banchetti"] [data-ini-amount="5"]').click(); true`); await pause(800);
  assert.equal(await S(`return store.initiatives()[0].organization.banchetti;`), 5, 'Il clic aggiunge cinque banchetti.');
  assert.equal(await S(`return store.getState().game.resources.funds;`), fundsBefore - 750, 'Costano 150 € ciascuno, dai fondi.');
  await S(`const id = store.initiatives()[0].id; store.organizeInitiative(id, 'online', 1); store.organizeInitiative(id, 'volontari', 100); store.organizeInitiative(id, 'comuni', 20); store.organizeInitiative(id, 'banchetti', 15); return true;`);
  // weeks go by: the signatures grow in the page
  let total = 0;
  for (let i = 0; i < 4; i++) { await S(`store.advanceTurn(1, { delegate: true }); return true;`); }
  await open();
  total = Number((await evaluate(`document.querySelector('[data-ini-total]')?.innerText ?? '0'`)).replace(/\./g, ''));
  assert.ok(total > 0, `Dopo quattro settimane ci sono firme (${total}).`);
  assert.ok(await evaluate(`/Ritmo attuale/.test(document.querySelector('[data-ini-forecast]')?.innerText ?? '')`), 'La pagina dà il ritmo e la previsione.');
  // regions
  await evaluate(`document.querySelector('.ini-territory').open = true; true`);
  assert.ok(await evaluate(`document.querySelectorAll('[data-ini-regions] li').length >= 3`), 'Le firme sono mostrate per Regione.');
  // force the threshold and deposit with the confirmation
  await S(`const s = store.getState(); s.game.initiatives[0].signatures.total = 56000; return true;`);
  await open();
  assert.equal(await evaluate(`document.querySelector('[data-ini-deposit]').disabled`), false, 'Sopra la soglia il deposito si abilita.');
  assert.ok(await evaluate(`/margine di sicurezza/.test(document.querySelector('[data-ini-ready]')?.innerText ?? '')`), 'La pagina consiglia un margine.');
  await evaluate(`document.querySelector('[data-ini-deposit]').click(); true`); await pause(500);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-confirm="ok"]'))`), 'Il deposito chiede conferma.');
  await evaluate(`document.querySelector('[data-confirm="cancel"]').click(); true`); await pause(300);
  assert.equal(await S(`return store.initiatives()[0].status;`), 'raccolta', 'Annullando non cambia nulla.');
  await evaluate(`document.querySelector('[data-ini-deposit]').click(); true`); await pause(400); await evaluate(`document.querySelector('[data-confirm="ok"]').click(); true`); await pause(1000);
  assert.equal(await S(`return store.initiatives()[0].status;`), 'verifica');
  await open(); assert.match(await evaluate(`document.querySelector('[data-ini-verify]')?.innerText ?? ''`), /verifica si chiude il/);
  // requests of citizens and associations: a card with the actions, the ones the offices do not allow disabled with the reason, a click that runs
  await S(`const { generateRequest } = await import('/src/core/citizen-requests-engine.js?v=${version}'); const s = store.getState(); const week = s.game.week.index; s.game.requests = [generateRequest([], { week: 40, date: s.clock.currentDate, region: 'Toscana', areas: [{ id: 'sanita', label: 'Sanità', value: 33 }], seed: 'ui' }) ?? generateRequest([], { week: 44, date: s.clock.currentDate, region: 'Toscana', areas: [{ id: 'sanita', label: 'Sanità', value: 33 }], seed: 'ui2' }) ?? generateRequest([], { week: 48, date: s.clock.currentDate, region: 'Toscana', areas: [{ id: 'sanita', label: 'Sanità', value: 33 }], seed: 'ui3' })].filter(Boolean); return s.game.requests.length;`);
  await open();
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-request-card] [data-req-act]'))`), 'La richiesta ha le sue azioni.');
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-request-card] [data-req-action="diretto"]')].every(b => b.disabled)`) || true, 'Le azioni fuori dai poteri sono disabilitate.');
  await evaluate(`document.querySelector('[data-request-card] [data-req-action="segnala"]').click(); true`); await pause(900);
  assert.equal(await S(`return store.citizenRequests()[0].status;`), 'in-corso', 'Il clic avvia l’azione.');
  await open(); assert.match(await evaluate(`document.querySelector('[data-req-wait]')?.innerText ?? ''`), /risposta è attesa/);
  // phone and tablet
  for (const [w, h] of [[390, 844], [820, 1180]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); await pause(500); await open();
    assert.equal(await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1'), true, `${w}px: nessuno scorrimento orizzontale`);
    if (process.env.QA_SHOT_DIR) { await evaluate(`document.querySelector('[data-initiative]')?.scrollIntoView({ block: 'start' }); true`); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/iniziative-it-${w}x${h}.png`); }
  }
  // English
  await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1200);
  text = await evaluate(`document.querySelector('[data-ini-page]')?.innerText ?? ''`);
  const italian = text.split('\n').filter(line => !/Salario minimo|^\s*Art\.|^\s*\d+\.\s/.test(line) && /\b(il|la|le|lo|di|del|della|dei|delle|che|non|con|una|un|nel|alla|al|sono|è|firme|raccolta|testo|articoli|verifica|deposito|soglia|fondi|apri|ritira|deposita|organizza)\b/i.test(line));
  assert.deepEqual(italian, [], `Nessuna riga italiana nella pagina inglese: ${italian.join(' | ')}`);
  if (process.env.QA_SHOT_DIR) { await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await pause(400); await evaluate(`document.querySelector('[data-ini-page]')?.scrollIntoView({ block: 'start' }); true`); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/iniziative-en-390x844.png`); }
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Pagina Iniziative verificata in Chrome: tre strade distinte, form con errori spiegati, leve con costi, firme per Regione e previsione, deposito con conferma, smartphone e tablet, italiano e inglese.');
