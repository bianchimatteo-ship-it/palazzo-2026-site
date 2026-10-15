// Legibility of the strokes and fills of every chart of the game on the dark green of the cards, in Chrome: the sparklines (Sondaggi, Territori, Home, Finanze, society dashboards), the trend lines,
// the bars, the points. Text is audited elsewhere (check-territory-legibility); here every visible SVG shape that carries a stroke or a fill must stand out from what is behind it by at least 3:1
// (WCAG 1.4.11 for graphics), and a sparkline must show its line AND its last point. The same at the widths 320, 390 and 1280 px, (the app is dark).
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Contrasto dei grafici saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

// Runs in the page: every chart shape with its colour, the colour of what is behind and the ratio.
const AUDIT = `(() => {
  const parse = value => { const cs = /color\\(srgb ([^)]+)\\)/.exec(value); if (cs) { const [r, g, b, a = 1] = cs[1].split(/[ \\/]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255, a }; } const m = /rgba?\\(([^)]+)\\)/.exec(value); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const backdrop = el => { const layers = []; for (let node = el.parentElement; node; node = node.parentElement) { const c = parse(getComputedStyle(node).backgroundColor); if (c && c.a > 0) layers.push(c); if (c && c.a >= 1) break; } let base = { r: 12, g: 18, b: 16, a: 1 }; if (!layers.length || layers.at(-1).a < 1) base = parse(getComputedStyle(document.body).backgroundColor) ?? base; if (base.a < 1) base = { r: 12, g: 18, b: 16, a: 1 }; return layers.reverse().reduce((under, layer) => over(layer, under), base); };
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width + r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 && !el.closest('[aria-hidden="true"] .visually-hidden'); };
  const shapes = [...document.querySelectorAll('.app-shell svg :is(polyline, path, line, circle, rect, polygon)')].filter(visible);
  const bad = [], seen = new Set();
  let checked = 0;
  for (const el of shapes) {
    const s = getComputedStyle(el);
    const bg = backdrop(el);
    const opacity = Number(s.opacity) * (Number(s.strokeOpacity) || 1);
    for (const [kind, value, width] of [['stroke', s.stroke, parseFloat(s.strokeWidth)], ['fill', s.fill, 1]]) {
      const c = parse(value);
      if (!c || c.a === 0 || (kind === 'stroke' && !(width > 0))) continue;
      // a line has no fill; the grid, the leaders and the ring of a point are structure, not marks (the points' fills and the series lines are checked)
      if ((kind === 'fill' && el.tagName === 'line') || (kind === 'stroke' && (el.classList.contains('grid') || el.classList.contains('leader') || el.classList.contains('crosshair') || (el.tagName === 'circle' && parse(s.fill)?.a > 0)))) continue;
      // a fill that covers the card (a track, a frame, a hit area) is not a mark
      const box = el.getBoundingClientRect();
      if (kind === 'fill' && el.tagName === 'rect' && box.width > 200 && box.height > 40) continue;
      if (kind === 'fill' && c.a < 0.2) continue;
      // icons and tile art sit on their own tinted tiles (audited with the tiles); logos, maps and illustrations are artwork
      if (el.closest('.hemi-seats, .eh-map, .territory-map, .map-tiles, .party-logo, .logo-art, .illustration, .art-tile, .art-rings, .glyph, .emblem, .person-mark, .mark, .brand, [data-no-contrast]') || el.closest('svg')?.classList.contains('glyph')) continue;
      const mark = over({ ...c, a: Math.min(1, c.a * opacity) }, bg);
      const r = ratio(mark, bg);
      checked++;
      if (r < 3) { const key = el.tagName + '|' + (el.closest('svg')?.getAttribute('class') ?? '') + '|' + kind + '|' + value; if (!seen.has(key)) { seen.add(key); bad.push({ tag: el.tagName.toLowerCase(), svg: el.closest('svg')?.getAttribute('class') ?? '', parent: (el.closest('[class]:not(svg)')?.className ?? '').toString().slice(0, 40), kind, value, ratio: Math.round(r * 100) / 100 }); } }
    }
  }
  return { checked, bad, sparklines: [...document.querySelectorAll('.app-shell .sparkline')].filter(visible).map(svg => ({ line: Boolean(svg.querySelector('polyline')), dot: Boolean(svg.querySelector('circle')) })) };
})()`;

await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, version, errors } = browser;
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', level: 'comunale', weeks: 6 });
  await openCareer(browser);
  const go = async (page, tab = null) => { await evaluate(`(async () => { document.querySelector('[data-nav="${page}"]')?.click(); await new Promise(r => setTimeout(r, 700)); ${tab ? `document.querySelector('[data-section-tab="${page}"][data-section-tab-value="${tab}"]')?.click(); await new Promise(r => setTimeout(r, 600));` : ''} for (const d of document.querySelectorAll('details')) d.open = true; await new Promise(r => setTimeout(r, 300)); return true; })()`); };
  const views = [['panoramica'], ['sondaggi'], ['territori'], ['finanze'], ['partito', 'panoramica'], ['governo'], ['carriera']];
  const problems = [];
  let checked = 0, sparklines = 0;
  for (const theme of ['dark']) {
    for (const [width, height] of [[390, 844], [320, 640], [1280, 800]]) {
      await viewport(width, height, width < 800);
      for (const [page, tab] of views) {
        await go(page, tab);
        // Sondaggi has its own areas (tabs): audit each one the page offers
        const sub = page === 'sondaggi' ? await evaluate(`[...document.querySelectorAll('[data-section-tab="sondaggi"], [data-poll-area]')].map(el => el.dataset.sectionTabValue ?? el.dataset.pollArea).filter(Boolean)`) : [];
        for (const area of [null, ...new Set(sub)]) {
          if (area) await evaluate(`(async () => { document.querySelector('[data-section-tab-value="${area}"], [data-poll-area="${area}"]')?.click(); await new Promise(r => setTimeout(r, 700)); return true; })()`);
          const result = await evaluate(AUDIT);
          checked += result.checked; sparklines += result.sparklines.length;
          for (const item of result.bad) problems.push(`${theme} ${width}px · ${page}${area ? ' › ' + area : ''} · ${item.tag} (${item.svg || item.parent}) ${item.kind} ${item.value} ${item.ratio}:1`);
          for (const spark of result.sparklines) if (!spark.line || !spark.dot) problems.push(`${theme} ${width}px · ${page}: una sparkline senza ${spark.line ? 'punto finale' : 'linea'}`);
        }
      }
    }
  }
  assert.ok(checked > 200 && sparklines > 20, `Il controllo ha visto abbastanza (${checked} forme, ${sparklines} sparkline).`);
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
  assert.deepEqual([...new Set(problems)].slice(0, 30), [], `Grafici con contrasto sotto 3:1 o incompleti (${new Set(problems).size}).`);
  console.log(`Contrasto dei grafici verificato in Chrome: ${checked} forme e ${sparklines} sparkline su Home, Sondaggi (tutte le aree), Territori, Finanze, Partito, Governo e Carriera, tema scuro, a 320, 390 e 1280 px: ogni linea, punto e barra ha almeno 3:1 con lo sfondo.`);
}, {});
