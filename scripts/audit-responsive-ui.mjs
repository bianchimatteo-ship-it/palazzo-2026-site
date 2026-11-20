// Responsive audit of the whole interface in a real browser: for every viewport (phones incl. iPhone 11 at 414×896 DPR 2, tablets, desktops; portrait and landscape) and every page and tab it measures
// the page width (scrollWidth/clientWidth), the elements that leave the viewport (those inside an INTENTIONAL horizontal scroller — tab bars, tables — don't count), the content hidden by the bottom bar, and the
// JavaScript errors. It does not hide anything with overflow-x: it reports the cause. `--shots=<dir>` writes screenshots; `--quick` audits a smaller set; `--json` prints the offenders.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Audit responsive: SKIPPED (Chrome non trovato, imposta CHROME_PATH).'); process.exit(0); }
const arg = name => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=')[1];
const SHOTS = arg('shots'), QUICK = process.argv.includes('--quick'), JSON_OUT = process.argv.includes('--json');
const VIEWPORTS = [[320, 700, 2], [360, 800, 3], [375, 812, 3], [390, 844, 3], [414, 896, 2], [430, 932, 3], [768, 1024, 2], [1024, 768, 2], [1280, 800, 1], [1440, 900, 1]];
const ORIENT = (w, h) => [[w, h, 'portrait'], [h, w, 'landscape']];
const PAGES = ['panoramica', 'carriera', 'calendario', 'finanze', 'partito', 'elezioni', 'sondaggi', 'parlamento', 'governo', 'quirinale', 'leggi', 'referendum', 'notizie', 'impostazioni', 'territori', 'politici', 'ricompense'];
const sizes = [];
for (const [w, h] of VIEWPORTS) { if (w >= 768 && w >= h && h > 700 && w > 1000) sizes.push([w, h, 'desktop', 1]); else for (const [a, b, name] of ORIENT(w, h)) sizes.push([a, b, name]); }
const ONLY = arg('only')?.split(',');
const chosen = ONLY ? sizes.filter(([w, h]) => ONLY.includes(`${w}x${h}`)) : QUICK ? sizes.filter(([w, h]) => [[414, 896], [320, 700], [390, 844], [768, 1024], [1280, 800]].some(([a, b]) => a === w && b === h)) : sizes;

// runs inside the page: the elements that really leave the viewport, and what the bottom bar covers
const MEASURE = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const intentional = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; if (/(auto|scroll)/.test(s.overflowX)) return true; } return false; };
  const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '');
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || el.closest('[hidden], svg, defs, script, style')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (s.position === 'fixed' && r.right <= 0) continue;
    if ((r.right > vw + 1 || r.left < -1) && !intentional(el)) out.push({ el: label(el), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), text: (el.textContent || '').trim().slice(0, 30) });
  }
  // text cut inside its own box (a button or title that does not adapt): the content is wider than the box and the box clips it
  const clipped = [];
  for (const el of document.querySelectorAll('button, .primary-button, .secondary-button, h1, h2, h3, [role="tab"], .sx-tab, label')) {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (s.display === 'none' || r.width < 2 || el.closest('[hidden]')) continue;
    if (/(hidden|clip)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 2 && s.textOverflow !== 'ellipsis' && !/nowrap/.test(s.whiteSpace) === false) clipped.push({ el: label(el), sw: el.scrollWidth, cw: el.clientWidth, text: (el.textContent || '').trim().slice(0, 30) });
  }
  const bar = document.querySelector('.mobile-tabbar'); const barVisible = bar && getComputedStyle(bar).display !== 'none';
  return { vw, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, out: out.slice(0, 8), outCount: out.length, clipped: clipped.slice(0, 5), barTop: barVisible ? Math.round(bar.getBoundingClientRect().top) : null, vh };
})()`;

const findings = [];
await withBrowser(async browser => {
  const { evaluate, send, pause, errors } = browser;
  await createCareerInPage(browser, { weeks: 2 });
  await openCareer(browser); await pause(2500);
  const dismiss = () => evaluate(`document.querySelectorAll('[data-news-popup-close],[data-outcome-dismiss],[data-report-close],[data-tutorial="close"]').forEach(e => e.click()), true`);
  const device = async (w, h, dpr) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr ?? 1, mobile: w < 800 }); await pause(350); };
  const shot = async name => { if (!SHOTS) return; await mkdir(SHOTS, { recursive: true }); const { data } = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`${SHOTS}/${name}.png`, Buffer.from(data, 'base64')); };
  let measured = 0;
  for (const [w, h, name, dpr] of chosen) {
    await device(w, h, dpr ?? (w < 800 ? 2 : 1)); await dismiss();
    for (const page of PAGES) {
      await evaluate(`location.hash = '#${page}'; true`); await pause(QUICK ? 600 : 750); await dismiss();
      const tabs = await evaluate(`[...new Set([...document.querySelectorAll('.page-wrap [data-section-tab-value]')].map(b => b.dataset.sectionTab + '|' + b.dataset.sectionTabValue))]`);
      const views = [null, ...(QUICK ? tabs.slice(0, 3) : tabs)];
      for (const tab of views) {
        if (tab) { const [group, value] = tab.split('|'); await evaluate(`document.querySelector('.page-wrap [data-section-tab="${group}"][data-section-tab-value="${value}"]')?.click(), true`); await pause(350); await dismiss(); }
        const m = await evaluate(MEASURE); measured++;
        if (!tab) {
          // the end of the page must be reachable above the bottom bar: scroll down and look at the last visible content
          const cover = await evaluate(`(() => { scrollTo(0, document.documentElement.scrollHeight); const bar = document.querySelector('.mobile-tabbar'); const barTop = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : innerHeight; const wrap = document.querySelector('.page-wrap'); const low = wrap ? wrap.getBoundingClientRect().bottom : 0; const who = 'page-wrap'; scrollTo(0, 0); return { low: Math.round(low), barTop: Math.round(barTop), who }; })()`);
          if (cover.low > cover.barTop + 1 && cover.barTop < m.vh) findings.push({ where: `${w}×${h} ${name} · #${page}`, kind: 'coperto-dalla-barra', detail: `contenuto fino a ${cover.low}, barra a ${cover.barTop} (${cover.who})`, offenders: [] });
        }
        const where = `${w}×${h} ${name} · #${page}${tab ? ' · ' + tab : ''}`;
        if (m.sw > m.cw + 1) findings.push({ where, kind: 'scroll-orizzontale', detail: `scrollWidth ${m.sw} > clientWidth ${m.cw}`, offenders: m.out });
        else if (m.outCount) findings.push({ where, kind: 'fuori-viewport', detail: `${m.outCount} elementi`, offenders: m.out });
        if (m.clipped.length) findings.push({ where, kind: 'testo-tagliato', detail: JSON.stringify(m.clipped), offenders: [] });
      }
    }
    // menus and dialogs: the main menu, the guide, the account, and the weekly report if it opens: nothing outside the viewport, the dialog itself inside it and scrollable
    for (const [label, steps] of [['menu', ['[data-action=menu]']], ['guida', ['[data-action=menu]', '[data-menu=guida]']], ['account', ['[data-action=menu]', '[data-menu=account], [data-action=account]']]]) {
      await evaluate(`location.hash = '#panoramica'; true`); await pause(500); await dismiss();
      for (const sel of steps) { await evaluate(`document.querySelector(${JSON.stringify(sel)})?.click(), true`); await pause(450); }
      const m = await evaluate(MEASURE);
      if (m.sw > m.cw + 1) findings.push({ where: `${w}×${h} ${name} · ${label}`, kind: 'scroll-orizzontale', detail: `scrollWidth ${m.sw} > clientWidth ${m.cw}`, offenders: m.out });
      else if (m.outCount) findings.push({ where: `${w}×${h} ${name} · ${label}`, kind: 'fuori-viewport', detail: `${m.outCount} elementi`, offenders: m.out });
      if (SHOTS && label === 'menu') await shot(`${w}x${h}-${name}-menu`);
      await evaluate(`(document.querySelector('[data-menu-close]') ?? document.querySelector('[data-menu=continua]'))?.click(), true`); await pause(250);
      await evaluate(`document.querySelector('[data-menu=continua]')?.click(), true`); await pause(300);
      await evaluate(`location.hash = '#panoramica'; true`); await pause(300);
    }
    if (SHOTS) for (const page of ['panoramica', 'elezioni', 'impostazioni']) { await evaluate(`location.hash = '#${page}'; true`); await pause(600); await dismiss(); await shot(`${w}x${h}-${name}-${page}`); }
  }
  if (errors.length) findings.push({ where: 'console', kind: 'errori-js', detail: errors.slice(0, 3).join(' | '), offenders: [] });
  console.log(`Audit responsive: ${measured} schermate misurate su ${chosen.length} viewport.`);
});
if (JSON_OUT || findings.length) {
  const grouped = new Map();
  for (const f of findings) { const key = `${f.kind}|${f.offenders[0]?.el ?? f.detail}`; (grouped.get(key) ?? grouped.set(key, []).get(key)).push(f); }
  for (const [key, list] of grouped) console.log(`${list.length}× ${key}\n   es.: ${list[0].where} — ${list[0].detail} ${JSON.stringify(list[0].offenders.slice(0, 2))}\n   anche: ${[...new Set(list.map(f => f.where.split(' · ')[0]))].slice(0, 6).join(', ')}`);
}
assert.equal(findings.length, 0, `Audit responsive: ${findings.length} problemi.`);
console.log('Audit responsive: nessun elemento fuori viewport, nessuno scorrimento orizzontale non voluto, nessun errore JavaScript.');
