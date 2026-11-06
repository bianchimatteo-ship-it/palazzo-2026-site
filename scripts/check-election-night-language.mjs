// The election night in English, in Chrome: the twelve hours, every tab and the summary, with the language switched while the night is on screen. No Italian is left (the independent detector of the
// audit decides), and going back to Italian gives the same texts. A vote for lists (politiche) and a municipal one are both walked.  NIGHT_OUT=file writes the leftovers.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';
import { COLLECT } from './lib/i18n-tour.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';

if (!chromeAvailable) { console.log('Notte elettorale in inglese saltata: Chrome non trovato.'); process.exit(0); }
const detector = createIndependentDetector();
const problems = []; let texts = 0, screens = 0;
for (const [label, level, extra] of [['politiche', 'deputato', `store.fastForwardToElection('politiche'); store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'seat' }, real.parties ?? []);`], ['comunale', 'comunale', `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.parties ?? []);`]]) {
  await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, version }) => {
    await viewport(1280, 900, false);
    await createCareerInPage({ evaluate, version }, { level, onboarding: true, extra });
    await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
    const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
    for (let i = 0; i < 90 && !(await S('return Boolean(store.getState().night);')); i++) await S('store.advance(7);');
    await wait(() => evaluate('Boolean(document.querySelector(".night"))'));
    const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(150); };
    const lang = async next => { await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage(${JSON.stringify(next)})).then(() => true)`); await pause(400); };
    const settled = async () => { let last = null; for (let i = 0; i < 12; i++) { const now = JSON.stringify(await evaluate(COLLECT)); if (now === last) return JSON.parse(now); last = now; await pause(200); } return JSON.parse(last); };
    const tabs = ['diretta', 'scrutinio', 'risultati', 'territorio', 'mappa', 'previsioni', 'parlamento', 'dichiarazioni'];
    const round = async name => {
      const it0 = await settled();
      await lang('en'); const en = await settled();
      await lang('it'); const it1 = await settled();
      screens++; texts += en.length;
      for (const text of new Set(en)) { const reason = detector.reasonOf(text); if (reason) problems.push(`${label}/${name} [EN] italiano rimasto: «${text.slice(0, 300)}» (${reason})`); }
      for (const text of new Set(it1)) { const reason = detector.reasonOfEnglish(text); if (reason) problems.push(`${label}/${name} [IT dopo EN] inglese rimasto: «${text.slice(0, 120)}» (${reason})`); }
      const a = new Set(it0); for (const text of new Set(it1)) if (!a.has(text) && !/\d/.test(text)) problems.push(`${label}/${name} [IT dopo EN] testo diverso da prima: «${text.slice(0, 120)}»`);
    };
    for (let hour = 1; hour <= 12; hour++) {
      if (hour > 1) await click('[data-night-next]');
      if (hour === 3) { await click('[data-night-tab-value="dichiarazioni"]'); await round(`ora${hour}/prompt`); await click('[data-night-say-choice="attacco"]'); }
      if (hour === 7) { await click('[data-night-tab-value="dichiarazioni"]'); await click('[data-night-say-choice="sobria"]'); }
      if (hour === 11) { await click('[data-night-tab-value="dichiarazioni"]'); await click('[data-night-say-choice="fiduciosa"]'); }
      if (hour === 1 || hour === 5 || hour === 8 || hour === 12) for (const tab of [...(hour === 12 ? ['riepilogo'] : []), ...tabs]) { await click(`[data-night-tab-value="${tab}"]`); await round(`ora${hour}/${tab}`); }
      else { await click('[data-night-tab-value="diretta"]'); await round(`ora${hour}/diretta`); }
    }
  }, { night: true });
}
if (process.env.NIGHT_OUT) writeFileSync(process.env.NIGHT_OUT, JSON.stringify(problems, null, 1));
for (const line of problems.slice(0, 60)) console.log(line);
assert.equal(problems.length, 0, `${problems.length} problemi di lingua nella Notte Elettorale`);
console.log(`Notte elettorale in inglese verificata: ${screens} schermate, ${texts} testi analizzati, nessun italiano rimasto e ritorno all’italiano identico.`);
