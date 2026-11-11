// Tour of the real pages in English with the INDEPENDENT detector: lists the Italian text that is left (not from the phrase book: from the shape of the text). Run: node scripts/audit-i18n-pages.mjs [level]
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { COLLECT, PAGES, tourCareer } from './lib/i18n-tour.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';
if (!chromeAvailable) process.exit(0);
const detector = createIndependentDetector();
const level = process.argv[2] ?? 'deputato';
const found = new Map();
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  await createCareerInPage({ evaluate, version }, { level, onboarding: true, weeks: 6, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off' })); import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1200);
  await tourCareer({ evaluate, pause }, { onScreen: (name, texts) => { for (const text of new Set(texts)) { const reason = detector.reasonOf(text); if (reason) { const list = found.get(text) ?? []; list.push(name); found.set(text, list); } } } });
}, { voter: true });
for (const [text, where] of found) console.log(`${[...new Set(where)].slice(0, 2).join(', ')} :: ${text.slice(0, 150)}`);
console.log(`TOTALE ${found.size}`);
