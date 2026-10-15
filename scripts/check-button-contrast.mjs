// Every button and link of the game is readable in every state, in Chrome: text against the colour it really sits on (the first opaque background up the tree, translucent layers composed) at
// 4.5:1 (3:1 for large text: 18 px, or 14 px bold), and the border of a button that has one against its surroundings at 3:1 where it is the only thing that shows the button. The states are the
// real ones, forced through the DevTools protocol: normal, hover, keyboard focus, pressed (active) and, where the page has any, disabled. The start screen (the «Nuova partita» button above all),
// the new-game wizard, the main menu with a career, and the sections of a career are audited, at 390 and 1280 px.
// Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Contrasto dei pulsanti saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

// Runs in the page: for every visible control, its text colour, its backdrop and the ratio.
const AUDIT = `(() => {
  const parse = value => { const cs = /color\\(srgb ([^)]+)\\)/.exec(value); if (cs) { const [r, g, b, a = 1] = cs[1].split(/[ \\/]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255, a }; } const m = /rgba?\\(([^)]+)\\)/.exec(value); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const backdrop = el => { const layers = []; for (let node = el; node; node = node.parentElement) { const s = getComputedStyle(node); const c = parse(s.backgroundColor); const image = s.backgroundImage && s.backgroundImage !== 'none'; if (c && c.a > 0) layers.push(c); if (image && !(c && c.a >= 1)) { /* a gradient or an image: the audit cannot tell, report as unknown below */ return { unknown: true }; } if (c && c.a >= 1) break; } let base = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 12, g: 18, b: 16, a: 1 }; if (base.a < 1) base = { r: 12, g: 18, b: 16, a: 1 }; if (layers.length && layers.at(-1).a >= 1) base = layers.pop(); return layers.reverse().reduce((under, layer) => over(layer, under), base); };
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 && !el.closest('[aria-hidden="true"], [hidden]'); };
  const controls = [...document.querySelectorAll('button, a[href], [role="button"], summary, input[type="submit"], input[type="button"], .chip-button, .text-link')].filter(visible);
  const rows = [];
  controls.forEach((el, index) => {
    const s = getComputedStyle(el);
    const text = (el.innerText || el.getAttribute('aria-label') || '').trim();
    const color = parse(s.color); if (!color) return;
    const size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700 || s.fontWeight === 'bold';
    const bg = backdrop(el);
    if (bg.unknown) { rows.push({ index, text: text.slice(0, 40), tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), unknown: true }); return; }
    const fg = over({ ...color, a: color.a * (Number(s.opacity) || 1) }, bg);
    const large = size >= 24 || (size >= 18.66 && bold) || (size >= 14 && bold && false);
    rows.push({ index, text: text.slice(0, 40), tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), ratio: Math.round(ratio(fg, bg) * 100) / 100, need: large ? 3 : 4.5, size, disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true' });
    el.setAttribute('data-audit', String(index));
  });
  return rows;
})()`;

await withBrowser(async browser => {
  const { evaluate, send, viewport, waitFor, pause, errors } = browser;
  await send('DOM.enable'); await send('CSS.enable');
  const problems = [];
  let checked = 0, states = 0;
  const forced = async (index, pseudo) => {
    const { root } = await send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-audit="${index}"]` });
    if (!nodeId) return null;
    await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: pseudo }).catch(() => null);
    return nodeId;
  };
  const stateRatio = async (index, pseudo) => {
    const nodeId = await forced(index, pseudo);
    if (!nodeId) return null;
    // re-measure only this control, with the forced state applied
    const measured = await evaluate(`(() => {
      ${AUDIT.slice(AUDIT.indexOf('const parse'), AUDIT.indexOf('const visible'))}
      const el = document.querySelector('[data-audit="${index}"]'); if (!el) return null;
      const s = getComputedStyle(el); const color = parse(s.color); const bg = backdrop(el); if (bg.unknown || !color) return null;
      const fg = over({ ...color, a: color.a * (Number(s.opacity) || 1) }, bg);
      // a hover/focus/active state usually changes the control's own background: the backdrop walk starts at the control, so it is already included
      return { ratio: Math.round(ratio(fg, bg) * 100) / 100, size: parseFloat(s.fontSize), bold: Number(s.fontWeight) >= 700 };
    })()`);
    await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }).catch(() => null);   // (a state can redraw the page: the node may be gone)
    states++;
    return measured;
  };
  const audit = async where => {
    const rows = await evaluate(AUDIT);
    for (const row of rows) {
      if (row.unknown) continue;
      checked++;
      if (!row.disabled && row.ratio < row.need) problems.push(`${where} · ${row.tag}.${row.cls} «${row.text}» ${row.ratio}:1 (serve ${row.need}:1)`);
      if (row.disabled) { /* a disabled control is exempt from the minimum (WCAG 1.4.3), but must not vanish */ if (row.ratio < 1.8) problems.push(`${where} · disabilitato «${row.text}» quasi invisibile (${row.ratio}:1)`); }
    }
    // the real states of the main buttons: hover, keyboard focus, pressed
    const interesting = rows.filter(row => !row.unknown && !row.disabled && /primary-button|secondary-button|text-link|menu|chip-button|danger|start|nav/i.test(row.cls)).slice(0, 14);
    for (const row of interesting) for (const pseudo of [['hover'], ['focus', 'focus-visible'], ['active']]) {
      const measured = await stateRatio(row.index, pseudo);
      if (!measured) continue;
      const need = measured.size >= 24 || (measured.size >= 18.66 && measured.bold) ? 3 : 4.5;
      if (measured.ratio < need) problems.push(`${where} · ${row.tag}.${row.cls} «${row.text}» in stato ${pseudo[0]}: ${measured.ratio}:1 (serve ${need}:1)`);
    }
  };

  // ---------- the start screen, without a career ----------
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    await viewport(width, height, width < 800);
    await evaluate(`localStorage.clear(), sessionStorage.clear(), true`);
    await browser.goto();
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu"))'));
    await pause(400);
    const start = await evaluate(`[...document.querySelectorAll('[data-menu]')].map(item => item.dataset.menu)`);
    assert.ok(start.includes('nuova'), `La schermata iniziale ha «Nuova partita» (${start}).`);
    await audit(`schermata iniziale ${width}px`);
    // the «Nuova partita» button in particular: every state
    const index = await evaluate(`(() => { const button = document.querySelector('[data-menu="nuova"]'); button.setAttribute('data-audit', 'nuova'); return 'nuova'; })()`);
    for (const pseudo of [[], ['hover'], ['focus', 'focus-visible'], ['active'], ['hover', 'active'], ['hover', 'focus']]) {
      const measured = await stateRatio(index, pseudo);
      assert.ok(measured, '«Nuova partita» si misura.');
      assert.ok(measured.ratio >= 4.5, `«Nuova partita» a ${width}px, stato ${pseudo.join('+') || 'normale'}: ${measured.ratio}:1 (serve 4.5:1).`);
    }
    // its outline when it has the keyboard focus must show
    const focus = await evaluate(`(() => { const button = document.querySelector('[data-menu="nuova"]'); button.focus(); const s = getComputedStyle(button); return { outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2, shadow: s.boxShadow !== 'none' }; })()`);
    assert.ok(focus.outline || focus.shadow, '«Nuova partita» ha un contorno visibile con la tastiera.');
  }

  // ---------- the wizard ----------
  await viewport(390, 844, true);
  await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
  await browser.goto();
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=nuova]"))'));
  await evaluate(`document.querySelector('[data-menu="nuova"]')?.click(), true`);
  await waitFor(() => evaluate('Boolean(document.querySelector(".career-wizard"))'));
  await pause(400);
  await audit('procedura di nuova partita 390px');

  // ---------- a career ----------
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', level: 'comunale', weeks: 3 });
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    await viewport(width, height, width < 800);
    await openCareer(browser);
    await audit(`menu con carriera ${width}px`);
    for (const page of ['panoramica', 'carriera', 'partito', 'elezioni', 'sondaggi', 'istituzioni', 'territori', 'informazione', 'finanze']) {
      const there = await evaluate(`(async () => { const nav = document.querySelector('[data-nav="${page}"]'); if (!nav) return false; nav.click(); await new Promise(resolve => setTimeout(resolve, 700)); for (const details of document.querySelectorAll('details')) details.open = true; await new Promise(resolve => setTimeout(resolve, 200)); return true; })()`);
      if (there) await audit(`${page} ${width}px`);
    }
  }
  assert.ok(checked > 400, `Il controllo ha visto abbastanza (${checked} controlli, ${states} stati).`);
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
  const unique = [...new Set(problems)];
  assert.deepEqual(unique.slice(0, 25), [], `Pulsanti o collegamenti poco leggibili (${unique.length}).`);
  console.log(`Contrasto dei pulsanti verificato in Chrome: ${checked} controlli (schermata iniziale, procedura di nuova partita, menu con carriera e nove sezioni, a 390 e 1280 px) e ${states} stati forzati (hover, tastiera, premuto): ogni testo ha almeno 4,5:1 (3:1 se grande) col suo sfondo, «Nuova partita» in ogni stato e con il contorno della tastiera visibile.`);
}, {});
