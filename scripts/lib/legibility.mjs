// The audit of what a page draws, run in the page: every text as drawn (SVG text after the viewBox scale), its contrast with what is behind it, text cut by overflow, sideways scroll of the
// page and, for the map tiles, size and overlap. `legibilityAudit(rootSelector)` returns the script to evaluate: { issues: [...], tiles, legend, source, key }.
export const legibilityAudit = (rootSelector = '.polls-page.observatory') => `(() => {
  const parse = c => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const bgOf = el => { let color = { r: 16, g: 35, b: 27, a: 1 }; const chain = []; for (let n = el; n; n = n.parentElement) chain.push(n); for (const n of chain.reverse()) { const bg = parse(getComputedStyle(n).backgroundColor); if (bg && bg.a > 0) color = over(bg, color); } return color; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const root = document.querySelector(${JSON.stringify(rootSelector)}) || document.body;
  const issues = [];
  const seen = new Set();
  const name = el => el.tagName.toLowerCase() + '.' + [...el.classList].slice(0, 2).join('.');
  for (const el of root.querySelectorAll('*')) {
    const svg = el.closest('svg');
    if (svg && el.tagName !== 'text') continue;
    if (!svg && ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    let size = parseFloat(st.fontSize);
    if (svg) { const vb = svg.viewBox.baseVal; if (vb && vb.width) size *= svg.getBoundingClientRect().width / vb.width; }
    // SVG text takes its fill, HTML text its colour; text on a coloured tile or chip is measured against that fill.
    const ink = parse(svg ? st.fill : st.color);
    const bg = bgOf(el);
    const cr = ink ? ratio(over(ink, bg), bg) : 21;
    const text = el.textContent.trim().slice(0, 28);
    const key = name(el) + Math.round(size * 2) + Math.round(cr * 10);
    if (seen.has(key)) continue;
    seen.add(key);
    if (size < 11.5) issues.push('testo piccolo: ' + name(el) + ' ' + size.toFixed(1) + 'px «' + text + '»');
    if (cr < 4.5) issues.push('contrasto: ' + name(el) + ' ' + cr.toFixed(2) + ':1 ' + size.toFixed(1) + 'px «' + text + '»');
    if (!svg && el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(st.overflowX) && !el.closest('.hm-scroll, .table-scroll, [data-scroll]')) issues.push('testo tagliato: ' + name(el) + ' «' + text + '»');
  }
  const over1 = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (over1 > 1) issues.push('scorrimento orizzontale della pagina: ' + over1 + 'px');
  // The tiles: big enough, not overlapping, each holding its own text.
  const tiles = [...root.querySelectorAll('.itmap-tile')].filter(t => t.getBoundingClientRect().width);
  const rects = tiles.map(t => [t, t.getBoundingClientRect()]);
  for (const [tile, r] of rects) {
    if (r.width < 32 || r.height < 32) issues.push('tessera troppo piccola: ' + tile.textContent.trim().slice(0, 12) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (tile.scrollWidth > tile.clientWidth + 1) issues.push('testo oltre la tessera: ' + tile.textContent.trim().slice(0, 12));
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i][1], b = rects[j][1]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) issues.push('tessere sovrapposte: ' + rects[i][0].textContent.trim().slice(0, 8) + ' / ' + rects[j][0].textContent.trim().slice(0, 8)); }
  return { issues, tiles: tiles.length, legend: Boolean(root.querySelector('.itmap-legend')), source: Boolean(root.querySelector('.obs-source')), key: Boolean(root.querySelector('.itmap-key')) };
})()`;
