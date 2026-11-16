// Resignations in Chrome (desktop and phone): Carriera › Incarichi e poteri lists the posts with their consequences folded under each; the button opens a confirmation that repeats the consequences;
// cancelling changes nothing; confirming leaves the office and the list is redrawn without it; the page never scrolls sideways. Skipped without Chrome. QA_SHOT_DIR keeps screenshots.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Dimissioni nel browser saltate: Chrome non trovato (imposta CHROME_PATH per eseguirle).'); process.exit(0); }
const shotDir = process.env.QA_SHOT_DIR; if (shotDir) mkdirSync(shotDir, { recursive: true });
await withBrowser(async browser => {
  const { evaluate, waitFor: wait, pause, viewport, errors, version } = browser;
  const shot = async name => { if (shotDir) await browser.screenshot(`${shotDir}/${name}.png`); };
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ' + ${JSON.stringify(selector)}); el.click(); return true; })()`);
  await createCareerInPage(browser, { weeks: 2, level: 'deputato' });
  await openCareer(browser);
  await evaluate(`location.hash = '#carriera'; true`); await pause(500);
  await evaluate(`(() => { [...document.querySelectorAll('button, a, [role="tab"]')].find(el => /Incarichi e poteri/.test(el.textContent))?.click(); return true; })()`);
  await wait(() => has('[data-resign-panel]'), 15000);
  for (const [name, w, h, mobile] of [['desktop', 1280, 900, false], ['smartphone', 390, 800, true]]) {
    await viewport(w, h, mobile); await pause(400);
    assert.ok(await evaluate(`document.querySelectorAll('[data-resign-post]').length >= 1`), `${name}: almeno un incarico.`);
    assert.ok(await evaluate(`(document.querySelector('[data-resign-post] details ul')?.children.length ?? 0) >= 2`), `${name}: le conseguenze sono sotto ogni incarico.`);
    const over = await evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    assert.ok(over <= 1, `${name}: nessuno scroll orizzontale (${over}).`);
    await evaluate(`document.querySelector('[data-resign-panel]').scrollIntoView({ block: 'start' }); document.querySelector('[data-resign-post] details')?.setAttribute('open', ''); true`); await pause(250);
    await shot(`dimissioni-elenco-${name}`);
  }
  await viewport(1280, 900, false); await pause(300);
  const first = await evaluate(`document.querySelector('[data-resign]').dataset.resign`);
  const countBefore = await evaluate(`document.querySelectorAll('[data-resign-post]').length`);
  // cancel: nothing changes
  await click('[data-resign]'); await wait(() => has('[data-confirm]'), 8000);
  assert.ok(await evaluate(`/Dimetterti/.test(document.body.innerText) && /Reputazione|Influenza/.test(document.querySelector('[data-confirm]').closest('.modal, .confirm, [role="dialog"], body').innerText)`), 'La conferma ripete le conseguenze.');
  await shot('dimissioni-conferma-desktop');
  await click('[data-confirm="cancel"]'); await pause(300);
  assert.equal(await evaluate(`document.querySelectorAll('[data-resign-post]').length`), countBefore, 'Annullare non cambia nulla.');
  // confirm: the office goes
  await click(`[data-resign="${first}"]`); await wait(() => has('[data-confirm]'), 8000);
  const ok = await evaluate(`[...document.querySelectorAll('[data-confirm]')].map(el => el.dataset.confirm)`);
  await click(`[data-confirm="${ok.find(item => item !== 'cancel')}"]`);
  await wait(() => evaluate(`!document.querySelector('[data-resign="${first}"]')`), 10000);
  assert.ok(await evaluate(`document.querySelectorAll('[data-resign-post]').length < ${countBefore} || Boolean(document.querySelector('[data-resign-none]'))`), 'Dopo la conferma l’incarico non è più elencato.');
  await shot('dimissioni-dopo-desktop');
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource/.test(String(item))), [], 'Nessun errore in console.');
});
console.log('Dimissioni nel browser: elenco con conseguenze, conferma che le ripete, annulla non cambia nulla, conferma lascia l’incarico (desktop e smartphone).');
