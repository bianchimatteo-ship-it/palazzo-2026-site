// The start-up guard (src/boot-guard.js) in Chrome: when a module of the game does not load, the screen says so (Italian / English), shows the technical detail and a «Riprova» button, writes a diagnostic,
// and recovers after the connection is back (one automatic reload per session at most). A normal start leaves the guard silent. Real blocked requests (CDP), no simulation of the message.
import assert from 'node:assert/strict';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Guardia di avvio saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, send, goto, waitFor: wait, pause, screenshot }) => {
  const booted = () => evaluate('window.__politicandoBooted === true && !document.querySelector(".boot-splash") && !document.querySelector(".boot-error")');
  // 1. normal start: the guard stays silent
  assert.ok(await booted(), 'Avvio normale: nessun messaggio della guardia.');
  assert.equal(await evaluate(`localStorage.getItem('politicando.bootDiagnostics')`), null, 'Avvio normale: nessuna diagnostica scritta.');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  const block = async on => send('Network.setBlockedURLs', { urls: on ? ['*src/core/ids.js*'] : [] });
  // 2. one module of the graph cannot be loaded: Italian message, detail, button, diagnostic, no endless «Caricamento…»
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: 'it' })); sessionStorage.clear(); true`);
  await block(true); await goto();
  await wait(() => evaluate('Boolean(document.querySelector("[data-boot-retry]"))'), 15000);
  const it = await evaluate(`({ text: document.querySelector('.boot-error').textContent, splash: Boolean(document.querySelector('.boot-splash')), diag: JSON.parse(localStorage.getItem('politicando.bootDiagnostics') || '[]') })`);
  assert.match(it.text, /Il gioco non è riuscito a caricarsi/); assert.match(it.text, /Riprova/); assert.match(it.text, /main\.js|ids\.js/, 'Il dettaglio tecnico indica almeno il modulo di avvio.'); assert.match(it.text, /partite salvate non sono state toccate/);
  assert.equal(it.splash, false, 'Non resta «Caricamento…».');
  assert.ok(it.diag.length === 1 && it.diag[0].kind === 'script' && /main\.js|ids\.js/.test(it.diag[0].detail) && it.diag[0].build, 'Una riga diagnostica con tipo, file e build.');
  if (process.env.QA_SHOT_DIR) await screenshot(`${process.env.QA_SHOT_DIR}/errore-caricamento-it.png`);
  // 3. English
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: 'en' })); true`); await goto();
  await wait(() => evaluate('Boolean(document.querySelector("[data-boot-retry]"))'), 15000);
  const en = await evaluate(`document.querySelector('.boot-error').textContent`);
  assert.match(en, /The game could not load/); assert.match(en, /Retry/); assert.ok(!/Riprova|non è riuscito/.test(en), 'Nessun italiano nel messaggio inglese.');
  if (process.env.QA_SHOT_DIR) await screenshot(`${process.env.QA_SHOT_DIR}/errore-caricamento-en.png`);
  // 4. the connection is back: «Retry» starts the game (saved games untouched)
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: 'it' })); true`);
  await block(false);
  await evaluate(`document.querySelector('[data-boot-retry]').click(); true`);
  await wait(() => booted(), 25000);
  assert.ok(await booted(), 'Dopo «Riprova» con la rete tornata il gioco parte.');
  // 5. the connection comes back by itself: ONE automatic reload, once per session
  await evaluate(`sessionStorage.clear(); true`); await block(true); await goto();
  await wait(() => evaluate('Boolean(document.querySelector("[data-boot-retry]"))'), 15000);
  await block(false);
  await evaluate(`window.dispatchEvent(new Event('online')); true`);
  await wait(() => booted(), 25000);
  assert.equal(await evaluate(`sessionStorage.getItem('politicando.bootAutoRetry')`), '1', 'Il ricaricamento automatico è registrato: una volta sola.');
  // and a second time in the same session there is NO automatic reload (no loop): the button stays
  await block(true); await goto();
  await wait(() => evaluate('Boolean(document.querySelector("[data-boot-retry]"))'), 15000);
  await evaluate(`window.dispatchEvent(new Event('online')); true`); await pause(2500);
  assert.ok(await evaluate('Boolean(document.querySelector("[data-boot-retry]"))'), 'Nessun secondo ricaricamento automatico nella stessa sessione.');
  await block(false);
});
console.log('check-boot-failure: ok');
