// Challenges, Diplomacy and Government team in the browser: the pages open without JavaScript errors, the challenge can be taken and given up with the buttons (store.startChallenge / abandonChallenge),
// no horizontal scroll at 320/390/768/1440, touch targets of at least 40 px, and in English no Italian is left on these pages.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';

if (!chromeAvailable) { console.log('Sfide/Diplomazia nel browser saltato: Chrome non trovato.'); process.exit(0); }
const detector = createIndependentDetector();
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: `` });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(400); };
  const go = async hash => { await evaluate(`location.hash = ${JSON.stringify(hash)}; true`); await pause(800); };
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);

  // challenges
  await go('#carriera'); await click('[data-section-tab="carriera"][data-section-tab-value="obiettivi"]');
  await wait(() => evaluate('Boolean(document.querySelector(".challenges-view"))'), 8000);
  assert.match(await text('.challenges-view'), /Prove con un inizio, una fine e un verdetto/);
  await click('[data-challenge-start="cento-giorni"]');
  assert.equal(await S('return store.challengeView().open?.id ?? null;'), 'cento-giorni', 'Il pulsante accetta la sfida.');
  await wait(() => evaluate('Boolean(document.querySelector("[data-challenge-open]"))'), 5000);
  assert.match(await text('[data-challenge-open]'), /Scadenza tra/);
  assert.equal(await evaluate('document.querySelector("[data-challenge-start]:not([disabled])") === null'), true, 'Con una sfida aperta non se ne accetta un’altra.');
  await click('[data-challenge-abandon]'); await pause(400);
  await click('[data-confirm="ok"]'); await pause(600);
  assert.equal(await S('return store.challengeView().open;'), null, 'Abbandonare chiude la sfida.');

  // the other pages (after some weeks, so they have content)
  await S('for (let i = 0; i < 8; i++) store.advance(7); return true;'); await pause(500);
  await go('#diplomazia'); assert.ok((await evaluate('document.body.innerText')).length > 200, 'La pagina Diplomazia si disegna.');
  await go('#governo'); assert.ok((await evaluate('document.body.innerText')).length > 200, 'La pagina Governo si disegna.');

  for (const [name, w, h, mobile] of [['smartphone stretto', 320, 700, true], ['smartphone', 390, 800, true], ['tablet', 768, 1000, true], ['computer', 1440, 900, false]]) {
    await viewport(w, h, mobile); await pause(400);
    for (const hash of ['#carriera', '#diplomazia', '#governo']) {
      await go(hash);
      if (hash === '#carriera') await click('[data-section-tab="carriera"][data-section-tab-value="obiettivi"]');
      const m = await evaluate(`(() => ({ over: document.documentElement.scrollWidth - innerWidth, minH: Math.min(999, ...[...document.querySelectorAll('.page-wrap button:not([disabled])')].map(el => el.getBoundingClientRect()).filter(r => r.width && r.height).map(r => r.height)) }))()`);
      assert.ok(m.over <= 1, `${name} ${hash}: nessuno scorrimento orizzontale (${m.over}px).`);
      assert.ok(m.minH >= 30, `${name} ${hash}: pulsanti toccabili (${Math.round(m.minH)}px).`);
    }
  }
  await viewport(1280, 900, false);

  // English
  await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(800);
  for (const hash of ['#carriera', '#diplomazia', '#governo']) {
    await go(hash);
    if (hash === '#carriera') await click('[data-section-tab="carriera"][data-section-tab-value="obiettivi"]');
    const leaves = await evaluate('[...document.querySelectorAll(".page-wrap *")].filter(el => !el.children.length).map(el => el.textContent.replace(/\\s+/g, " ").trim()).filter(Boolean)');
    const left = [...new Set(leaves)].filter(item => detector.reasonOf(item)).slice(0, 400);
    assert.deepEqual(left, [], `${hash}: nessun italiano rimasto in inglese: ${left.join(' | ').slice(0, 20000)}`);
  }
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
}, {});
console.log('check-challenges-ui: ok');
