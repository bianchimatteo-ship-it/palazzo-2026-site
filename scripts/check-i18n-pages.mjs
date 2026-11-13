// Tour of the real pages in English (every page and tab of a career, folded blocks open) with the INDEPENDENT detector: the Italian text that is left (judged from the shape of the text, not from the phrase book)
// must be none. Run: node scripts/check-i18n-pages.mjs [level] (default: deputato; the checks of the game use deputato and comunale).
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { COLLECT, PAGES, tourCareer } from './lib/i18n-tour.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';
if (!chromeAvailable) { console.log('Pagine in inglese saltate: Chrome non trovato.'); process.exit(0); }
const detector = createIndependentDetector();
const level = process.argv[2] ?? 'deputato';
const found = new Map();
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  await createCareerInPage({ evaluate, version }, { level, onboarding: true, weeks: 6, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off' })); import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1200);
  await tourCareer({ evaluate, pause }, { onScreen: (name, texts) => { for (const text of new Set(texts)) { const reason = detector.reasonOf(text); if (reason) { const list = found.get(text) ?? []; list.push(name); found.set(text, list); } } } });
}, { voter: true });
for (const [text, where] of found) console.log(`${[...new Set(where)].slice(0, 2).join(', ')} :: ${text.slice(0, process.env.PAGES_FULL ? 2000 : 150)}`);
console.log(`Pagine reali in inglese (${level}): ${found.size} testi ancora in italiano.`);
if (found.size) process.exit(1);
