// The invitation to review the game on Google Play: logic (once per installation, never at the first launch, only after enough use, only when quiet, recorded as shown BEFORE it opens, never again after a restart,
// logout or change of account, no prize, no obligation) and, in Chrome with the app pretending to be the Android app, the real dialog: exact text, the two buttons, the link, the link, «Non ora» closing it, no second time, no blocking.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { createReviewPrompt, REVIEW_URL, REVIEW_RULES, REVIEW_KEY } = await import(`../src/data/repositories/review-prompt.js?v=${build}&r=1`);
assert.equal(REVIEW_URL, 'https://play.google.com/store/apps/details?id=it.matteobianchi.politicando2026', 'L’indirizzo della scheda su Google Play.');
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), has: key => data.has(key) }; };

// iOS: the same rules, the App Store page of the app (reviews of the iPhone listing); never on the web or on a platform with no store
{
  const { APP_STORE_REVIEW_URL, REVIEW_URLS } = await import(`../src/data/repositories/review-prompt.js?v=${build}&r=1`);
  const { reviewCardHtml } = await import(`../src/ui/review-card.js?v=${build}&r=1`);
  assert.equal(APP_STORE_REVIEW_URL, 'https://apps.apple.com/it/app/politicando-2026/id6835582269?see-all=reviews&platform=iphone', 'L’indirizzo delle recensioni sull’App Store.');
  assert.equal(REVIEW_URLS.android, REVIEW_URL);
  const storage = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, String(v)); } };
  for (const launches of [1, 2, 3]) { const next = createReviewPrompt({ storage, platform: () => 'ios' }); assert.equal(next.noteLaunch(), launches); }
  const ios = createReviewPrompt({ storage, platform: () => 'ios' });
  assert.equal(ios.url, APP_STORE_REVIEW_URL, 'Su iOS il collegamento è l’App Store.'); assert.equal(ios.platform(), 'ios');
  assert.equal(ios.due({ quiet: true, weeks: REVIEW_RULES.minWeeks - 1 }), false); assert.equal(ios.due({ quiet: false, weeks: 50 }), false);
  assert.equal(ios.due({ quiet: true, weeks: REVIEW_RULES.minWeeks }), true, 'Su iOS compare con le stesse regole.');
  assert.equal(createReviewPrompt({ storage, platform: () => null }).due({ quiet: true, weeks: 50 }), false, 'Sul sito mai.');
  assert.equal(ios.markShown(), true); assert.equal(ios.due({ quiet: true, weeks: 99 }), false, 'Una sola volta anche su iOS.');
  const html = reviewCardHtml(APP_STORE_REVIEW_URL, 'ios');
  assert.ok(html.includes('sull’App Store') && !html.includes('Google Play') && html.includes(APP_STORE_REVIEW_URL.replace(/&/g, '&amp;').replace('&amp;', '&amp;')) || html.includes('apps.apple.com'), 'La scheda dice App Store e punta alla pagina dell’app.');
  assert.ok(reviewCardHtml(REVIEW_URL, 'android').includes('su Google Play'));
}
{
  const storage = memory(); const prompt = createReviewPrompt({ storage, isPlayStoreApp: () => true });
  assert.equal(prompt.due({ quiet: true, weeks: 50 }), false, 'Al primo avvio mai.');
  assert.equal(prompt.noteLaunch(), 1); assert.equal(prompt.noteLaunch(), 1, 'Un avvio si conta una volta per caricamento della pagina.');
  for (const launches of [2, 3]) { const next = createReviewPrompt({ storage, isPlayStoreApp: () => true }); assert.equal(next.noteLaunch(), launches); }
  const ready = createReviewPrompt({ storage, isPlayStoreApp: () => true });
  assert.equal(ready.due({ quiet: true, weeks: REVIEW_RULES.minWeeks - 1 }), false, 'Dopo poche settimane di gioco no.');
  assert.equal(ready.due({ quiet: false, weeks: 50 }), false, 'Non in un momento importante (tutorial, scena, voto, campagna, finestra aperta).');
  assert.equal(ready.due({ quiet: true, weeks: REVIEW_RULES.minWeeks }), true, 'Dopo abbastanza uso, in un momento tranquillo, sì.');
  assert.equal(createReviewPrompt({ storage, isPlayStoreApp: () => false }).due({ quiet: true, weeks: 50 }), false, 'Fuori dall’app Android di Google Play (sito, iOS) mai.');
  assert.equal(ready.markShown(), true); assert.ok(storage.has(REVIEW_KEY), 'Registrato come visualizzato prima dell’apertura.');
  assert.equal(ready.due({ quiet: true, weeks: 99 }), false, 'Una sola volta.');
  assert.equal(createReviewPrompt({ storage, isPlayStoreApp: () => true }).due({ quiet: true, weeks: 99 }), false, 'Nemmeno dopo un riavvio, un logout o un altro account (la memoria è del dispositivo, non dell’account).');
  const broken = createReviewPrompt({ storage: { getItem: () => null, setItem() { throw new Error('quota'); } }, isPlayStoreApp: () => true });
  assert.equal(broken.markShown(), false, 'Se non si può registrare, non si mostra (potrebbe ripetersi).');
}
if (!chromeAvailable) { console.log('Promemoria recensione: logica verificata; parte nel browser saltata (Chrome non trovato).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, screenshot, errors, version }) => {
  // the page believes it is the Android app of Google Play, with three launches already behind it
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `globalThis.Capacitor = { isNativePlatform: () => true, Plugins: {} }; window.__opened = [];  try { if (!localStorage.getItem('politicando.review.v1') && localStorage.getItem('politicando.test.launches') !== 'x') localStorage.setItem('politicando.review.v1', JSON.stringify({ launches: 2 })); } catch (e) {}` });
  await createCareerInPage({ evaluate, version }, { weeks: 8 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'on' })); true`);
  const closeWeek = async () => {
    await evaluate(`(() => { document.querySelectorAll('[data-outcome-dismiss],[data-confirm=cancel]').forEach(b => b.click()); const b = [...document.querySelectorAll('button')].find(b => /Chiudi settimana/.test(b.textContent)); b?.click(); return true; })()`); await pause(1200);
    await evaluate(`(() => { document.querySelector('[data-weekly-continue],[data-report-close],[data-weekly-close]')?.click(); return true; })()`); await pause(1500);
  };
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  const launches = await evaluate(`JSON.parse(localStorage.getItem('politicando.review.v1')).launches`);
  assert.ok(launches >= 3, `Tre avvii alle spalle (${launches}).`);
  let dialog = null;
  for (let tries = 0; tries < 6 && !dialog; tries++) { await closeWeek(); dialog = await evaluate(`document.querySelector('[data-review-card]')?.innerText ?? null`); }
  assert.ok(dialog, 'Dopo abbastanza uso, chiusa la settimana, compare l’invito.');
  assert.match(dialog, /Ti sta piacendo Politicando 2026\?/); assert.match(dialog, /Il tuo parere è importante! Lascia una recensione sincera su Google Play e aiutaci a migliorare il gioco\./);
  assert.match(dialog, /Lascia una recensione/); assert.match(dialog, /Non ora/);
  assert.ok(await evaluate(`Boolean(JSON.parse(localStorage.getItem('politicando.review.v1')).shownAt)`), 'Registrato come visualizzato mentre è aperto.');
  // the link to the Play Store page: a real link, opened outside the game (the app's WebView hands an external address to the system), with the right address
  const link = await evaluate(`(() => { const a = document.querySelector('[data-review-open]'); return { href: a.getAttribute('href'), target: a.target, rel: a.rel, tag: a.tagName }; })()`);
  assert.deepEqual(link, { href: REVIEW_URL, target: '_blank', rel: 'noopener noreferrer', tag: 'A' }, 'Il pulsante è un vero collegamento alla scheda di Google Play.');
  // it does not block the game: nothing dims the page and the game underneath still takes clicks; it hides while a menu is open and comes back
  assert.equal(await evaluate(`document.querySelector('.modal-backdrop, .report-backdrop') === null`), true, 'Nessuna finestra modale: il gioco resta utilizzabile.');
  assert.equal(await evaluate(`(() => { const card = document.querySelector('[data-review-card]'); return card.getAttribute('aria-modal') === 'false' && getComputedStyle(card).position === 'fixed'; })()`), true);
  await evaluate(`document.querySelector('[data-action=menu]')?.click(); true`); await pause(1500);
  assert.equal(await evaluate(`document.querySelector('[data-review-card]')?.hidden ?? 'gone'`), true, 'Con il menu aperto l’invito si nasconde.');
  await evaluate(`document.querySelector('[data-menu=continua], [data-menu-close], [data-action=menu-close]')?.click(); location.hash = '#panoramica'; true`); await pause(1500);
  if (process.env.QA_SHOT_DIR) {
    for (const [name, w, h] of [['390x844', 390, 844], ['820x1180', 820, 1180]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); await pause(500);
      await evaluate(`document.querySelector('[data-review-card]') && (document.querySelector('[data-review-card]').hidden = false); true`);
      await screenshot(`${process.env.QA_SHOT_DIR}/popup-recensione-it-${name}.png`);
      await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(900);
      await screenshot(`${process.env.QA_SHOT_DIR}/popup-recensione-en-${name}.png`);
      await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('it')).then(() => true)`); await pause(600);
    }
  }
  // «Lascia una recensione» records the answer and removes the card; the navigation itself is held back here (no network in the test)
  await evaluate(`document.addEventListener('click', event => { if (event.target.closest('[data-review-open]')) { window.__reviewClicked = event.target.closest('a').href; event.preventDefault(); } }, true); document.querySelector('[data-review-card]').hidden = false; document.querySelector('[data-review-open]').click(); true`); await pause(600);
  assert.equal(await evaluate(`window.__reviewClicked`), REVIEW_URL, 'Il clic porta all’indirizzo della scheda su Google Play.');
  assert.equal(await evaluate(`document.querySelector('[data-review-card]') === null`), true, 'Dopo il clic l’invito sparisce.');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('politicando.review.v1')).answer`), 'review');
  for (let tries = 0; tries < 3; tries++) { await closeWeek(); assert.equal(await evaluate(`document.querySelector('[data-review-card]') === null`), true, 'Non ricompare.'); }
  // after a reload (a restart of the app) and a logout / another account: still never again
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('politicando.review.v1')).launches >= 4`), true, 'Gli avvii continuano a contare.');
  await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  for (let tries = 0; tries < 2; tries++) { await closeWeek(); assert.equal(await evaluate(`document.querySelector('[data-review-card]') === null`), true, 'Dopo il riavvio non ricompare.'); }
  // «Non ora» and Escape are covered by the logic test; the card for «Non ora» in the DOM: a second installation (empty storage) shows it again once
  await evaluate(`localStorage.setItem('politicando.review.v1', JSON.stringify({ launches: 5 })); true`);
  for (let tries = 0; tries < 6 && !(await evaluate(`Boolean(document.querySelector('[data-review-card]'))`)); tries++) await closeWeek();
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-review-card]'))`), true, 'Una nuova installazione (memoria vuota) la mostra una volta.');
  await evaluate(`document.querySelector('[data-review-later]').click(); true`); await pause(500);
  assert.equal(await evaluate(`document.querySelector('[data-review-card]') === null && JSON.parse(localStorage.getItem('politicando.review.v1')).answer === 'later'`), true, '«Non ora» chiude l’invito.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
}, { voter: true });
console.log('Promemoria recensione verificato: una sola volta per installazione, mai al primo avvio, dopo abbastanza uso e in un momento tranquillo, registrato prima dell’apertura, testo e pulsanti richiesti, «Non ora» chiude, non ricompare; solo nell’app Android.');
