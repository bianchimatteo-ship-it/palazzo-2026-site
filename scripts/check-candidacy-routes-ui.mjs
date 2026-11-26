// La scheda «Come ti candidi» in Chrome: per chi non ha un partito compaiono le quattro strade con regole e requisiti, si sceglie, si costruisce la preparazione con i pulsanti e si vede cosa manca.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Candidature senza partito nel browser saltate: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version, errors }) => {
  await createCareerInPage({ evaluate, version }, { level: 'comunale', weeks: 2, extra: `store.leaveParty(); store.fastForwardToElection('comunale'); store.getState().game.resources.funds = 40000; store.getState().game.resources.politicalCapital = 30;` });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelector('[data-nav="elezioni"]')?.click(), true`); await pause(900);
  await wait(async () => { await evaluate(`document.querySelector('[data-section-tab="elezioni"][data-section-tab-value="campagna"]')?.click(), true`); await pause(400); return evaluate('Boolean(document.querySelector("[data-candidacy-routes]"))'); }, 25000);
  assert.equal(await evaluate(`document.querySelectorAll('[data-candidacy-routes] [data-route]').length`), 4, 'Le quattro strade.');
  assert.ok(await evaluate(`/Serve:/.test(document.querySelector('[data-route="lista-civica"]').innerText)`), 'I requisiti si leggono prima di scegliere.');
  await evaluate(`document.querySelector('[data-cand-open="lista-civica"]').click(), true`); await pause(500);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-route-work]'))`), true, 'Scelta la strada compare la preparazione.');
  const before = await evaluate(`document.querySelector('[data-route-work]').innerText`);
  await evaluate(`document.querySelector('[data-cand-action="comitato"]').click(), true`); await pause(500);
  await evaluate(`document.querySelector('[data-cand-action="volontari"]').click(), true`); await pause(500);
  const after = await evaluate(`document.querySelector('[data-route-work]').innerText`);
  assert.notEqual(before, after, 'I pulsanti cambiano lo stato della preparazione.');
  assert.match(after, /Comitato elettorale/);
  assert.equal(await evaluate(`document.querySelector('[data-route-work] .is-done') !== null`), true, 'Il comitato risulta fatto.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
  console.log('Candidature senza partito (Chrome): quattro strade, requisiti, scelta e preparazione con i pulsanti.');
});
