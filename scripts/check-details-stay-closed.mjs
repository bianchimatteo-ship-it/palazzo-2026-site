// A block the player closed (or opened) stays as the player left it: in Partito → Vita interna every dropdown is remembered by a stable id (and the count in a title is never part of its identity),
// so that a week that closes, a leader who comes or goes, a new draw of the page or a reload never open again what the player closed, nor close what the player opened.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Blocchi che restano chiusi: Chrome non trovato, saltato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version, errors, viewport }) => {
  await createCareerInPage({ evaluate, version }, { level: 'comunale', region: 'Toscana', weeks: 4, onboarding: true, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(400); };
  const open = async () => { await evaluate(`location.hash = '#partito'; true`); await pause(700); await click('[data-section-tab="partito"][data-section-tab-value="vita"]'); await wait(() => evaluate('document.querySelectorAll("details[data-remember^=\\"vita-\\"]").length >= 4'), 20000); await pause(300); };
  let known = null;
  const states = async () => { const all = await evaluate(`Object.fromEntries([...document.querySelectorAll('details[data-remember^="vita-"]')].map(d => [d.dataset.remember, d.open]))`); return known ? Object.fromEntries(known.map(key => [key, all[key]])) : all; };
  await open();
  const start = await states();
  const keys = Object.keys(start); known = keys;
  assert.ok(keys.length >= 4, `Blocchi di Vita interna con identificatore stabile (${keys.join(', ')}).`);
  // the player flips every one with the hand (a click on its title)
  for (const key of keys) await click(`details[data-remember="${key}"] > summary`);
  const flipped = await states();
  for (const key of keys) assert.equal(flipped[key], !start[key], `${key}: il giocatore lo ha ${start[key] ? 'chiuso' : 'aperto'}.`);
  // a week closes (the page is drawn again): nothing changes
  await S('store.advance(7); return true;'); await pause(1000);
  await open();
  assert.deepEqual(await states(), flipped, 'Dopo una settimana ogni blocco è come lo ha lasciato il giocatore.');
  // another draw of the page (a setting, a tab and back)
  await click('[data-section-tab="partito"][data-section-tab-value="ruoli"]'); await pause(300); await open();
  assert.deepEqual(await states(), flipped, 'Cambiando scheda e tornando, nulla si riapre né si chiude.');
  // a reload
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await click('[data-menu=continua]');
  await open();
  assert.deepEqual(await states(), flipped, 'Dopo il ricaricamento i blocchi restano come li ha lasciati il giocatore.');
  // the count in a title is not part of the identity of an automatic key
  const keyed = await evaluate(`(() => { const d = document.createElement('details'); d.innerHTML = '<summary>Non disponibili ora (5)</summary>'; return d.querySelector('summary').textContent.replace(/\\d+/g, '#'); })()`);
  assert.equal(keyed, 'Non disponibili ora (#)');
  assert.deepEqual(errors, []);
  console.log(`Vita interna: ${keys.length} blocchi restano come li ha lasciati il giocatore dopo una settimana, un cambio di scheda e il ricaricamento.`);
});
