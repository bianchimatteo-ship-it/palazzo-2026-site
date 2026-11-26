// The banner on the HOME of the installed app, in the real page (Chrome) with a Capacitor stand-in for Android and a recording AppodealAds plugin. On a phone the game opens on Home WITHOUT a #hash in the
// address (the hash only appears when the player moves between pages): the banner must be asked for there all the same, and must NOT be asked for on the pages that are not in the allowlist or while a
// decision/scene blocks it. Found on a real phone (26/11/2026): the page was read from the hash only, an empty hash was «no page», and the banner was never requested on Home (no `showBanner` ever reached the plugin).
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Banner in Home: prova saltata, Chrome non trovato.'); process.exit(0); }
const STUB = `(() => {
  window.__plugin = { calls: [], shown: false };
  const record = (name, out) => async (arg) => { window.__plugin.calls.push({ name, at: Date.now(), arg }); return typeof out === 'function' ? out(arg) : out; };
  const AppodealAds = {
    buildInfo: async () => ({ version: '1.0.6', build: '7', debug: false }),
    initialize: record('initialize', { ok: true, testing: false }), consentStatus: record('consentStatus', { canRequestAds: true, status: 'OBTAINED', privacyOptionsRequired: false }), requestConsent: record('requestConsent', { canRequestAds: true, status: 'OBTAINED', privacyOptionsRequired: false }),
    showBanner: record('showBanner', () => { window.__plugin.shown = true; return { shown: true }; }), hideBanner: record('hideBanner', () => { window.__plugin.shown = false; return {}; }),
    loadAd: record('loadAd', { ready: false }), showAd: record('showAd', { shown: false }), addListener: async () => ({ remove() {} })
  };
  const quiet = new Proxy({}, { get: () => async () => ({}) });
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: new Proxy({ AppodealAds }, { get: (t, k) => t[k] ?? quiet }), registerPlugin: () => AppodealAds };
})();`;
await withBrowser(async ({ evaluate, send, goto, waitFor: wait, pause, version }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36' });
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await goto();
  await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'), 60000);
  await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))'), 60000);
  const hash = await evaluate('location.hash'); const page = await evaluate(`(async () => (await import('/src/core/store.js?v=${version}')).store.getState().ui.activePage)()`);
  // the player may have a decision waiting: that blocks the banner by design (a moment that must not be interrupted); clear what can block, then look
  const blocked = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return { campaign: Boolean(s.campaign), night: Boolean(s.night), scene: Boolean(s.scene) }; })()`);
  const count = name => evaluate(`window.__plugin.calls.filter(call => call.name === ${JSON.stringify(name)}).length`);
  await wait(async () => (await count('showBanner')) > 0, 12000).catch(() => {});
  const asked = await count('showBanner');
  assert.equal(page, 'panoramica', `La carriera si apre sulla Home (pagina ${page}, hash «${hash}», blocchi ${JSON.stringify(blocked)}).`);
  assert.ok(asked >= 1, `Sulla Home, anche senza #hash (hash «${hash}»), il banner viene richiesto al plugin (richieste: ${asked}).`);
  assert.ok(asked <= 2, `Nessuna richiesta in ciclo (${asked}).`);
  // another page: no banner asked, and the one up is taken down
  await evaluate(`location.hash = '#sondaggi'`); await pause(1800);
  assert.ok((await count('hideBanner')) >= 1 || !(await evaluate('window.__plugin.shown')), 'Su una pagina fuori dall’elenco il banner viene tolto.');
  const before = await count('showBanner'); await pause(6500); assert.equal(await count('showBanner'), before, 'Sulle altre pagine il banner non viene richiesto.');
  console.log(`Banner in Home verificato: la carriera si apre su Home con hash «${hash}» e il banner è richiesto (${asked} richiesta/e, nessun ciclo); tolto e non richiesto sulle altre pagine (la pausa di 120 s dopo una sessione vale per il ritorno).`);
});
