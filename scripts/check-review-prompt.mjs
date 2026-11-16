// The invitation to review the game on Google Play: logic (once per installation, never at the first launch, only after enough use, only when quiet, recorded as shown BEFORE it opens, never again after a restart,
// logout or change of account, no prize, no obligation) and, in Chrome with the app pretending to be the Android app, the real dialog: exact text, the two buttons, the link, «Non ora» closing it, no second time.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { createReviewPrompt, REVIEW_URL, REVIEW_RULES, REVIEW_KEY } = await import(`../src/data/repositories/review-prompt.js?v=${build}&r=1`);
assert.equal(REVIEW_URL, 'https://play.google.com/store/apps/details?id=it.matteobianchi.politicando2026', 'L’indirizzo della scheda su Google Play.');
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), has: key => data.has(key) }; };
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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `globalThis.Capacitor = { isNativePlatform: () => true, Plugins: {} }; window.__opened = []; window.open = (...args) => { window.__opened.push(args); return null; }; try { if (!localStorage.getItem('politicando.review.v1') && localStorage.getItem('politicando.test.launches') !== 'x') localStorage.setItem('politicando.review.v1', JSON.stringify({ launches: 2 })); } catch (e) {}` });
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
  for (let tries = 0; tries < 6 && !dialog; tries++) { await closeWeek(); dialog = await evaluate(`document.querySelector('.confirm-dialog')?.innerText ?? null`); }
  assert.ok(dialog, 'Dopo abbastanza uso, chiusa la settimana, compare l’invito.');
  assert.match(dialog, /Ti sta piacendo Politicando 2026\?/); assert.match(dialog, /Il tuo parere è importante! Lascia una recensione sincera su Google Play e aiutaci a migliorare il gioco\./);
  assert.match(dialog, /Lascia una recensione/); assert.match(dialog, /Non ora/);
  assert.ok(await evaluate(`Boolean(JSON.parse(localStorage.getItem('politicando.review.v1')).shownAt)`), 'Registrato come visualizzato mentre è aperto.');
  if (process.env.QA_SHOT_DIR) {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await pause(500);
    await screenshot(`${process.env.QA_SHOT_DIR}/popup-recensione-it-390x844.png`);
    await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(900);
    await screenshot(`${process.env.QA_SHOT_DIR}/popup-recensione-en-390x844.png`);
    await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('it')).then(() => true)`); await pause(600);
  }
  await evaluate(`document.querySelector('[data-confirm=cancel]').click(), true`); await pause(500);
  assert.equal(await evaluate(`document.querySelector('.confirm-dialog') === null`), true, '«Non ora» chiude l’invito.');
  assert.equal(await evaluate(`window.__opened.length`), 0, 'Nessuna apertura di Google Play con «Non ora».');
  for (let tries = 0; tries < 3; tries++) { await closeWeek(); assert.equal(await evaluate(`document.querySelector('.confirm-dialog')?.innerText.includes('Ti sta piacendo') ?? false`), false, 'Non ricompare.'); }
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
}, { voter: true });
console.log('Promemoria recensione verificato: una sola volta per installazione, mai al primo avvio, dopo abbastanza uso e in un momento tranquillo, registrato prima dell’apertura, testo e pulsanti richiesti, «Non ora» chiude, non ricompare; solo nell’app Android.');
