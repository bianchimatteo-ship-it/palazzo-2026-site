// Every button of the game follows the two styles of Politicando: gold (primary, dark text) and dark (night green / anthracite, light text, with a visible border). A grey button — a neutral mid-tone fill, or the browser's own default
// grey — is a failure, in every section, tab and pop-up reached here, on phone and desktop; a disabled button keeps the palette (it is dimmed, never turned grey). Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Palette dei pulsanti saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }

const SCAN = `(() => {
  const parse = value => { const m = /rgba?\\(([^)]+)\\)/.exec(value); if (!m) { const cs = /color\\(srgb ([^)]+)\\)/.exec(value); if (!cs) return null; const [r, g, b, a = 1] = cs[1].split(/[ \\/]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255, a }; } const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); return { s, l }; };
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 6 && r.height > 6 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden], [aria-hidden="true"]'); };
  const out = [];
  for (const el of document.querySelectorAll('button, a[role="button"], [role="button"], input[type="button"], input[type="submit"], a.primary-button, a.secondary-button, a.ghost-button')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const bg = parse(s.backgroundColor);
    if (!bg || bg.a < 0.35) continue;                       // transparent: text link or outline button, sits on the card
    const { s: sat, l } = hsl(bg);
    const grey = sat < 0.13 && l > 0.2 && l < 0.92;           // neutral and neither near-black nor near-white
    const defaultGrey = Math.abs(bg.r - 239) < 3 && Math.abs(bg.g - 239) < 3 && Math.abs(bg.b - 239) < 3;
    if (grey || defaultGrey) out.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), bg: s.backgroundColor, disabled: el.disabled === true });
  }
  return out;
})()`;

await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause } = browser;
  await createCareerInPage(browser, { level: 'deputato', weeks: 14, extra: `const s = store.getState(); s.game.resources.funds = 90000; s.game.resources.politicalCapital = 60;` });
  const seen = new Map();
  const scan = async where => { await evaluate(`(() => { if (!document.getElementById('no-motion-audit')) { const st = document.createElement('style'); st.id = 'no-motion-audit'; st.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }'; document.head.appendChild(st); } return true; })()`); await pause(120); for (const row of await evaluate(SCAN)) { const key = `${row.tag}.${row.cls}|${row.bg}`; if (!seen.has(key)) seen.set(key, { ...row, where }); } };
  for (const [w, h, mobile] of [[390, 844, true], [1280, 800, false]]) {
    await viewport(w, h, mobile);
    await openCareer(browser);
    for (const hash of ['panoramica', 'elezioni', 'sondaggi', 'istituzioni', 'territori', 'informazione', 'profilo', 'impostazioni', 'finanze', 'partito', 'governo', 'parlamento', 'iniziative', 'diplomazia', 'calendario', 'carriera', 'leggi']) {
      await evaluate(`location.hash = ${JSON.stringify('#' + hash)}; true`); await pause(900);
      await waitFor(() => evaluate(`!/^\\s*Carico la pagina/.test(document.querySelector('.page-wrap')?.innerText ?? 'Carico la pagina')`), 15000).catch(() => null);
      await evaluate(`document.querySelectorAll('details').forEach(d => { d.open = true; }); true`); await pause(250);
      await scan(`${w}px #${hash}`);
      const tabs = await evaluate(`[...document.querySelectorAll('[data-section-tab-value]')].map(el => [el.dataset.sectionTab, el.dataset.sectionTabValue])`);
      for (const [section, value] of tabs ?? []) {
        await evaluate(`document.querySelector('[data-section-tab="${section}"][data-section-tab-value="${value}"]')?.click(), true`); await pause(500);
        await evaluate(`document.querySelectorAll('details').forEach(d => { d.open = true; }); true`);
        await scan(`${w}px #${hash} › ${value}`);
      }
    }
    // the main menu
    await evaluate(`document.querySelector('[data-action=menu]')?.click(), true`); await pause(500); await scan(`${w}px menu`);
    await evaluate(`location.hash = '#panoramica'; true`); await pause(300);
  }
  const rows = [...seen.values()];
  for (const row of rows) console.log(`${row.where} · ${row.tag}.${row.cls} «${row.text}» ${row.bg}${row.disabled ? ' (disabilitato)' : ''}`);
  assert.equal(rows.length, 0, `Pulsanti grigi: ${rows.length}.`);
  console.log('Palette dei pulsanti verificata: nessun pulsante grigio in nessuna sezione, scheda o menu, su smartphone e desktop.');
});
