// Real screenshots of the screens changed by the official update, before and after, in Chrome: the same career and the same steps on two copies of the game (ROOT, the directory served) at
// 320×640, 390×844 and 820×1180. Not part of check:all. Usage: ROOT=<dir> OUT=artifacts/qa/screenshots/after node scripts/qa-shots-update.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
const root = resolve(process.env.ROOT ?? '.');
const out = resolve(process.env.OUT ?? 'artifacts/qa/screenshots/after');
await mkdir(out, { recursive: true });
const SIZES = [[320, 640], [390, 844], [820, 1180]];
const index = [];
await withBrowser(async browser => {
  const { evaluate, pause, version, viewport, send } = browser;
  const shot = async (name, width, height, scenario) => {
    const file = join(out, `${name}-${width}x${height}.png`);
    const clip = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(file, Buffer.from(clip.data, 'base64'));
    index.push({ file: file.replace(`${resolve('.')}/`, ''), screen: name, scenario, language: 'it', device: 'Chrome headless (emulazione)', resolution: `${width}×${height}` });
  };
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  await createCareerInPage(browser, { level: 'deputato', weeks: 1 });
  for (const [width, height] of SIZES) {
    await viewport(width, height, width < 800); await openCareer(browser); await pause(900);
    const go = async page => { await S(`store.navigate(${JSON.stringify(page)}); return true;`); await pause(1400); await evaluate('scrollTo(0, 0), true'); await pause(200); };
    await go('panoramica'); await shot('home', width, height, 'Panoramica della carriera (deputato, settimana 2)');
    await go('governo'); await shot('governo', width, height, 'Istituzioni › Governo');
    await go('partito'); await shot('partito', width, height, 'Partito › Panoramica');
    await go('sondaggi'); await evaluate(`[...document.querySelectorAll('button,[role=tab]')].find(b => /Alleanze e coalizioni/.test(b.textContent))?.click(), true`); await pause(1200); await shot('alleanze', width, height, 'Sondaggi › Alleanze e coalizioni');
    // the calendar of the top bar (only in the copy that has it)
    if (await evaluate(`Boolean(document.querySelector('.topbar [data-action="date-picker"]'))`)) { await evaluate(`document.querySelector('.topbar [data-action="date-picker"]').click(), true`); await pause(800); await shot('calendario-topbar', width, height, 'Data della barra superiore › calendario'); await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`); await pause(300); }
    // the menu: account, guide (Chiedi al gioco), new game (mode)
    await evaluate(`document.querySelector('[data-action="menu"]')?.click(), true`); await pause(900);
    await shot('menu', width, height, 'Menu principale');
    await evaluate(`document.querySelector('[data-menu="account"]')?.click(), true`); await pause(1000); await shot('account', width, height, 'Menu › Account (accesso e creazione)');
    await evaluate(`document.querySelector('[data-action="menu"]')?.click(), true`); await pause(600);
    await evaluate(`[...document.querySelectorAll('button')].find(b => /Guida|Chiedi al gioco/.test(b.textContent))?.click(), true`); await pause(900);
    const ask = await evaluate(`(() => { const el = document.querySelector('[data-ask-game]'); if (!el) return false; el.scrollIntoView({ block: 'start' }); return true; })()`); await pause(400);
    if (ask) await shot('chiedi-al-gioco', width, height, 'Guida › Chiedi al gioco');
    await evaluate(`document.querySelector('[data-action="menu"]')?.click(), true`); await pause(600);
    await evaluate(`document.querySelector('[data-menu="nuova"]')?.click(), true`); await pause(1400); await shot('nuova-partita-modalita', width, height, 'Nuova partita › scelta della modalità');
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`); await pause(400);
  }
}, { root });
await writeFile(join(out, 'index.json'), JSON.stringify(index, null, 2));
console.log(`${index.length} screenshot in ${out}`);
