// Developer tool: walks the game (menu, new-game steps, every page and tab, the tutorial, the pop-ups, a mayor in campaign) and writes the texts it shows, with numbers abstracted (`#`), to the
// file given as the first argument (JSON: { phrase: [screens] }). It is the list from which the English phrase book is written and checked.
//   node scripts/i18n-capture.mjs out.json [it|en] [career|mayor|wizard|popups|all]
// With `en` the walk is made with English on: what still reads as Italian is what is missing from the phrase book.
import { writeFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { COLLECT, tourCareer } from './lib/i18n-tour.mjs';

if (!chromeAvailable) { console.log('Chrome non trovato.'); process.exit(1); }
const out = process.argv[2] ?? 'i18n-capture.json';
const lang = process.argv[3] ?? 'it';
const which = process.argv[4] ?? 'all';
const seen = new Map();
const add = (screen, texts) => { for (const text of texts) { const key = text.replace(/\d[\d.]*(?:,\d+)?/g, '#'); if (!/[A-Za-zÀ-ÿ]/.test(key)) continue; const list = seen.get(key) ?? []; if (!list.includes(screen)) list.push(screen); seen.set(key, list); } };
const setLang = evaluate => lang === 'en' ? evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: 'en' })); true`) : Promise.resolve();

async function career(browser) {
  const { evaluate, goto, waitFor: wait, pause, viewport, version } = browser;
  await createCareerInPage({ evaluate, version }, { weeks: 8 });
  await viewport(1440, 900, false);
  await setLang(evaluate);
  await goto(); await wait(() => evaluate('Boolean(document.querySelector(".main-menu"))'));
  await pause(600);
  add('menu', await evaluate(COLLECT));
  for (const view of ['guida', 'impostazioni', 'carica', 'hall', 'account']) {
    await evaluate(`document.querySelector('[data-menu="${view}"]')?.click(); true`); await pause(500);
    add(`menu/${view}`, await evaluate(COLLECT));
    await evaluate(`document.querySelector('[data-menu-close]')?.click(); true`); await pause(300);
  }
  await openCareer({ evaluate, goto, waitFor: wait });
  await pause(1500);
  add('popup-notizie', await evaluate(COLLECT));
  await tourCareer(browser, { onScreen: add });
}
async function mayor(browser) {
  const { evaluate, goto, waitFor: wait, pause, viewport, version } = browser;
  await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.parties ?? []);` });
  await viewport(1440, 900, false);
  await setLang(evaluate);
  await openCareer({ evaluate, goto, waitFor: wait });
  await pause(1500);
  await tourCareer(browser, { onScreen: (name, texts) => add(`sindaco/${name}`, texts), pages: ['panoramica', 'elezioni', 'territori', 'finanze', 'calendario', 'carriera', 'partito'] });
  // the campaign to its end: result and report
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); for (let i = 0; i < 80 && store.getState().campaign?.status !== 'finished'; i++) store.advance(7); return true; })()`);
  await tourCareer(browser, { onScreen: (name, texts) => add(`sindaco-fine/${name}`, texts), pages: ['panoramica', 'elezioni', 'territori'] });
}
async function wizard(browser) {
  const { evaluate, goto, waitFor: wait, pause, viewport, version } = browser;
  await viewport(1280, 900, false);
  await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })); true`);
  await setLang(evaluate);
  await goto(); await wait(() => evaluate('Boolean(document.querySelector(".main-menu"))'));
  await pause(500);
  await evaluate(`document.querySelector('[data-menu="nuova"]').click(); true`); await pause(2500);
  add('wizard/0', await evaluate(COLLECT));
  for (let step = 1; step <= 8; step++) {
    const moved = await evaluate(`(() => { const b = [...document.querySelectorAll('[data-wizard-action="next"], [data-wizard-action="continue"], [data-wizard-goto]')].find(x => !x.disabled && x.getBoundingClientRect().height > 0 && /Avanti|Continua|Next|Scegli|Prosegui/.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
    await pause(1200);
    add(`wizard/${step}`, await evaluate(COLLECT));
    if (!moved) break;
  }
}
async function popups(browser) {
  const { evaluate, goto, waitFor: wait, pause, viewport, version } = browser;
  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  await viewport(1280, 900, false);
  await setLang(evaluate);
  await openCareer({ evaluate, goto, waitFor: wait });
  await pause(1200);
  // tutorial
  await evaluate(`document.querySelector('[data-mobile-more], [data-menu-open]')?.click?.(); true`);
  await evaluate(`(async () => { localStorage.setItem('politicando.tutorial.v1', JSON.stringify({ status: 'active', step: 0 })); return true; })()`);
  await goto(); await wait(() => evaluate('Boolean(document.querySelector(".main-menu"))'));
  await evaluate(`document.querySelector('[data-menu="continua"]')?.click(); true`); await pause(1500);
  for (let i = 0; i < 8; i++) { add(`tutorial/${i}`, await evaluate(COLLECT)); const next = await evaluate(`(() => { const b = [...document.querySelectorAll('[data-tutorial-card] button')].find(x => /Avanti|Next|Continua/.test(x.textContent) && x.getBoundingClientRect().height > 0); if (!b) return false; b.click(); return true; })()`); if (!next) break; await pause(800); }
  // an advance of the week: report and pop-up
  await evaluate(`document.querySelector('[data-action="advance"]')?.click(); true`); await pause(1500);
  add('report-settimana', await evaluate(COLLECT));
  await evaluate(`document.querySelector('[data-report-close]')?.click(); true`); await pause(800);
  add('popup-notizie', await evaluate(COLLECT));
}
await withBrowser(async browser => {
  if (which === 'career' || which === 'all') await career(browser);
});
if (which === 'mayor' || which === 'all') await withBrowser(mayor);
if (which === 'wizard' || which === 'all') await withBrowser(wizard);
if (which === 'popups' || which === 'all') await withBrowser(popups);
await writeFile(out, JSON.stringify(Object.fromEntries([...seen].sort((a, b) => a[0].localeCompare(b[0], 'it'))), null, 1));
console.log(`${seen.size} frasi in ${out}`);
