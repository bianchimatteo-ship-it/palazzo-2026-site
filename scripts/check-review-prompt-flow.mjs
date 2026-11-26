// The invitation to review the game, as a player really reaches it: the Android app of Google Play, three launches behind, 8+ weeks of career, but WITHOUT the first-run tour marked done (login on a new device,
// «Inizia senza account», an older save), with a campaign already played (the object stays in the state) and the weekly report switched off. It used to wait for «tour done», for «no campaign object» and for the
// weekly report to be closed: for such a player the invitation never came. Now it comes in the first quiet moment, once, and never on the website.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Invito alla recensione (flusso reale) saltato: Chrome non trovato.'); process.exit(0); }
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
for (const [label, native] of [['app Android', true], ['sito web', false]]) {
  await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, errors, version }) => {
    await send('Emulation.setUserAgentOverride', { userAgent: ANDROID });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: native ? 'globalThis.Capacitor = { isNativePlatform: () => true, Plugins: {} };' : '' });
    await createCareerInPage({ evaluate, version }, { weeks: 9 });
    await evaluate(`localStorage.setItem('politicando.review.v1', JSON.stringify({ launches: 4 })); true`);
    // the player never saw the tour, and the weekly report is off
    await evaluate(`localStorage.removeItem('politicando.onboarding.v1'); localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, localStart: true })); localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); true`);
    await openCareer({ evaluate, goto, waitFor: wait });
    // a campaign already played: the object stays in the state with a finished status
    await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); s.campaign = { id: 'vecchia', status: 'concluded', result: {} }; return true; })()`);
    await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advanceTurn(1, { delegate: true }); return true; })()`);
    await pause(3500);
    const shown = await evaluate(`Boolean(document.querySelector('[data-review-card]'))`);
    if (native) {
      assert.ok(shown, 'Nell’app Android, senza tour completato, con una campagna già giocata e senza resoconto settimanale, l’invito compare.');
      const state = await evaluate(`JSON.parse(localStorage.getItem('politicando.review.v1'))`);
      assert.ok(state.launches >= 3 && state.shownAt, 'Tre avvii e registrato come mostrato.');
      await evaluate(`document.querySelector('[data-review-later]').click(); true`); await pause(500);
      await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advanceTurn(1, { delegate: true }); return true; })()`); await pause(3000);
      assert.equal(await evaluate(`Boolean(document.querySelector('[data-review-card]'))`), false, 'Una sola volta.');
    } else assert.equal(shown, false, 'Sul sito web l’invito non compare mai.');
    assert.deepEqual(errors.filter(item => !/favicon/.test(String(item))), [], 'Nessun errore JavaScript.');
  });
}
console.log('check-review-prompt-flow: ok');
