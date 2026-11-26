// The bottom of the app with the native Appodeal banner (Android): from the top, the scrollable content, the tab bar with its FIVE buttons, the banner right under the tab bar, the system bar. The banner is a native view
// (AppodealAdsPlugin.kt: a BannerView added above the WebView, flush above the system bar); the game only RESERVES its place: the plugin sends `bannerHeight` (the banner's whole footprint, its margin above the
// system bar included) and the page lifts the tab bar by exactly that much and drops the tab bar's own safe-area strip (it was the empty band between the buttons and the banner).
// Checked in Chrome on a phone-sized screen with the plugin's event fired by hand: no gap between the tab bar and the banner's place, five buttons visible and inside the tab bar, the content scrolls and its last
// section ends above the tab bar, and when the banner goes away (no ad) the reserved place is given back, with no empty strip left.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Layout del banner: prova saltata, Chrome non trovato.'); process.exit(0); }
const STUB = `(() => { window.__listeners = {}; const AppodealAds = { buildInfo: async () => ({ version: '1.0.6', build: '7', debug: false }), initialize: async () => ({ ok: false }), consentStatus: async () => ({ canRequestAds: false, status: 'UNKNOWN' }), requestConsent: async () => ({ canRequestAds: false, status: 'UNKNOWN' }), showBanner: async () => ({ shown: false }), hideBanner: async () => ({}), loadAd: async () => ({ ready: false }), showAd: async () => ({ shown: false }), diagnostic: async () => ({}), addListener: async (name, fn) => { window.__listeners[name] = fn; return { remove() {} }; } }; const quiet = new Proxy({}, { get: () => async () => ({}) }); window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: new Proxy({ AppodealAds }, { get: (t, k) => t[k] ?? quiet }), registerPlugin: () => AppodealAds }; })();`;
await withBrowser(async ({ evaluate, send, goto, waitFor: wait, pause, viewport, version }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36' });
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); true`);
  await viewport(412, 860, true); await goto();
  await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'), 60000); await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".mobile-tabbar .mobile-tab"))'), 60000);
  const box = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; })()`);
  const fire = heightDp => evaluate(`window.__listeners.bannerHeight?.({ heightDp: ${heightDp} }), true`);
  await wait(() => evaluate('Boolean(window.__listeners.bannerHeight)'), 15000);
  const H = await evaluate('innerHeight');
  // no banner: nothing reserved, no flag
  assert.equal(await evaluate(`document.documentElement.classList.contains('has-ad-banner')`), false, 'Senza banner non c’è il segno del banner.');
  const bare = await box('.mobile-tabbar'); assert.ok(Math.abs(bare.bottom - H) < 1.5, `Senza banner la barra dei tab sta in fondo (${bare.bottom} / ${H}).`);
  { const bareTabs = await evaluate(`[...document.querySelectorAll('.mobile-tabbar .mobile-tab')].map(el => { const r = el.getBoundingClientRect(); const e = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return [el.textContent.trim(), e?.closest('.mobile-tab')?.textContent.trim() ?? (e?.tagName + '.' + e?.className)]; })`); for (const [label, got] of bareTabs) assert.equal(got, label, `Senza banner il tocco su «${label}» arriva al pulsante (sopra c’è ${got}).`); }
  // banner loaded: 50dp of ad + 20dp of margin above the system bar (the plugin sends the whole footprint)
  await fire(70); await pause(500);
  const bar = await box('.mobile-tabbar');
  assert.equal(await evaluate(`document.documentElement.classList.contains('has-ad-banner')`), true, 'Con il banner c’è il segno del banner.');
  assert.ok(Math.abs(bar.bottom - (H - 70)) < 1.5, `La barra dei tab finisce esattamente dove comincia il banner (fondo ${bar.bottom}, atteso ${H - 70}): nessuno spazio vuoto in mezzo.`);
  assert.ok(bar.height <= 66, `La barra dei tab non porta una fascia vuota sotto i pulsanti (${bar.height}px).`);
  const backdrop = await evaluate(`(() => { const c = getComputedStyle(document.querySelector('.mobile-tabbar'), '::after'); return { height: parseFloat(c.height), top: c.top, pos: c.position, bg: c.backgroundColor, events: c.pointerEvents }; })()`);
  assert.ok(Math.abs(backdrop.height - 70) < 1 && backdrop.pos === 'absolute' && backdrop.bg !== 'rgba(0, 0, 0, 0)' && backdrop.events === 'none', `Sotto la barra c’è un fondo pieno alto quanto il posto del banner, che non intercetta i tocchi (${JSON.stringify(backdrop)}).`);
  const tabs = await evaluate(`[...document.querySelectorAll('.mobile-tabbar .mobile-tab')].map(el => { const r = el.getBoundingClientRect(); return { label: el.textContent.trim(), top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })`);
  assert.equal(tabs.length, 5, 'Cinque pulsanti: Home, Elezioni, Sondaggi, Istituzioni, Altro.');
  for (const tab of tabs) { assert.ok(tab.top >= bar.top - 1 && tab.bottom <= bar.bottom + 1 && tab.left >= 0 && tab.right <= 412 + 1, `Pulsante «${tab.label}» interamente dentro la barra e lo schermo.`); assert.ok(tab.bottom <= H - 70 + 1, `Il banner (da ${H - 70}) non copre «${tab.label}».`); }
  const mid = tabs[2]; const hit = await evaluate(`document.elementFromPoint(${(mid.left + mid.right) / 2}, ${(mid.top + mid.bottom) / 2})?.closest('.mobile-tab')?.textContent.trim()`); const over = hit === mid.label ? '' : await evaluate(`(() => { const e = document.elementFromPoint(${(mid.left + mid.right) / 2}, ${(mid.top + mid.bottom) / 2}); const chain = []; for (let n = e; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.position !== 'static' || c.zIndex !== 'auto') chain.push(n.tagName + '.' + String(n.className).slice(0, 40) + '[' + c.position + ' z=' + c.zIndex + ']'); } return e ? e.tagName + '.' + e.className + ' <- ' + chain.join(' < ') : 'niente'; })()`);
  assert.equal(hit, mid.label, `Il tocco al centro di un pulsante arriva a quel pulsante (sopra c’è: ${over}; barra ${JSON.stringify(bar)}; pulsante ${JSON.stringify(mid)}; H ${H}).`);
  // the content scrolls and its last section ends above the tab bar
  const reach = await evaluate(`(() => { const scroller = document.scrollingElement; scroller.scrollTop = scroller.scrollHeight; const main = document.querySelector('.main-area'); const r = main.getBoundingClientRect(); return { scrolled: scroller.scrollTop, mainBottom: r.bottom, padding: parseFloat(getComputedStyle(main).paddingBottom), barTop: document.querySelector('.mobile-tabbar').getBoundingClientRect().top }; })()`);
  assert.ok(reach.scrolled > 0, 'Il contenuto scorre.'); assert.ok(reach.mainBottom - reach.padding <= reach.barTop + 1, `Il contenuto, in fondo allo scorrimento, finisce sopra la barra dei tab: la pagina riserva ${Math.round(reach.padding)} px sotto l’ultima sezione, la barra comincia a ${Math.round(reach.barTop)} e la pagina finisce a ${Math.round(reach.mainBottom)} (${JSON.stringify(reach)}).`);
  // the banner goes away: the place is given back
  await fire(0); await pause(500);
  const back = await box('.mobile-tabbar'); assert.ok(Math.abs(back.bottom - H) < 1.5, 'Senza banner la barra torna in fondo, nessuno spazio pubblicitario vuoto.');
  assert.equal(await evaluate(`document.documentElement.classList.contains('has-ad-banner')`), false, 'Il segno del banner viene tolto.');
  console.log(`Layout con il banner verificato (412×${H}): barra dei tab (${Math.round(bar.height)} px, cinque pulsanti dentro la barra e sopra il banner) finisce a ${Math.round(bar.bottom)} = inizio del banner, il contenuto scorre e finisce sopra la barra, senza banner lo spazio è restituito.`);
});
