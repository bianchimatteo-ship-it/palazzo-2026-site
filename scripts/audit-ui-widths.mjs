// UI audit tool: the main screens at 320/360/390/430/768/1024/1440 px in Chrome, in Italian and in English. For each it records a screenshot (in the folder given as the first argument) and
// measures: sideways scroll, elements sticking out of the screen, buttons and links smaller than 32 px (reported, not failed: some are intentionally dense) and console errors.
// A sideways scroll or an element outside the screen fails the run.
//   node scripts/audit-ui-widths.mjs <folder> [it|en|both]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Audit: Chrome non trovato (imposta CHROME_PATH).'); process.exit(1); }
const folder = process.argv[2] ?? 'audit-ui';
const langs = process.argv[3] === 'it' ? ['it'] : process.argv[3] === 'en' ? ['en'] : ['it', 'en'];
await mkdir(folder, { recursive: true });
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440];
const SCREENS = [['home', 'home'], ['finanze', 'finanze'], ['notizie', 'notizie'], ['carriera', 'carriera'], ['impostazioni', 'impostazioni'], ['calendario', 'calendario']];
const MEASURE = `(() => {
  const w = innerWidth, out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    if (b.right > w + 2 || b.left < -2) { let scroller = false; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { scroller = true; break; } } if (!scroller) out.push((el.className?.toString?.() || el.tagName).slice(0, 60)); }
  }
  const tiny = [...document.querySelectorAll('button, a[href], [role=button], summary')].filter(el => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width && b.height && cs.visibility !== 'hidden' && (b.height < 32 || b.width < 32) && !(el.closest('.sr-only')); }).length;
  return { scrollW: document.documentElement.scrollWidth, width: w, sticking: [...new Set(out)].slice(0, 6), tiny };
})()`;
const report = [];
await withBrowser(async ({ evaluate, goto, screenshot, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 6 });
  for (const lang of langs) {
    await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: '${lang}' })); true`);
    for (const width of WIDTHS) {
      await viewport(width, width < 800 ? 780 : 900, width < 800);
      await openCareer({ evaluate, goto, waitFor: wait }); await pause(900);
      for (const [name, nav] of SCREENS) {
        await evaluate(`document.querySelectorAll('[data-news-popup-close],[data-outcome-dismiss]').forEach(el => el.click()), true`); await pause(300);
        if (nav !== 'home') { await evaluate(`(() => { const n = document.querySelector('[data-nav="${nav}"]'); if (n) { n.click(); return true; } location.hash = '#${nav}'; return false; })()`); await pause(500); }
        await evaluate(`document.querySelectorAll('[data-news-popup-close],[data-outcome-dismiss]').forEach(el => el.click()), true`); await pause(300);
        const m = await evaluate(MEASURE);
        await screenshot(`${folder}/${lang}-${width}-${name}.png`);
        report.push({ lang, width, screen: name, ...m });
      }
    }
  }
  await writeFile(`${folder}/report.json`, JSON.stringify({ report, errors }, null, 1));
});
const bad = report.filter(r => r.scrollW > r.width + 1 || r.sticking.length);
for (const r of bad) console.log(`PROBLEMA ${r.lang} ${r.width}px ${r.screen}: scrollW ${r.scrollW}, fuori schermo: ${r.sticking.join(', ')}`);
console.log(`Audit: ${report.length} schermate (${langs.join('+')}, ${WIDTHS.join('/')} px); con problemi: ${bad.length}; elementi toccabili sotto 32 px (totale per schermata, informativo): max ${Math.max(...report.map(r => r.tiny))}.`);
assert.equal(bad.length, 0, 'Nessuna schermata con scorrimento laterale o elementi fuori schermo.');
