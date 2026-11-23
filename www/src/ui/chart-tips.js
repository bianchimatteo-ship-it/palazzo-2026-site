// Tooltips of the charts and marks (split from polls-mode.js so that the first screen loads this small module and not the whole polls code).
// Tooltips for charts and marks: values stay reachable through labels and the data table.
// One tooltip for the whole page. It is hidden with display:none (the stylesheet gives it display:grid, which would
// otherwise override the hidden attribute and leave an empty dark box on screen), and it disappears whenever its
// anchor goes away: pointer out, touch end, render, route change, scroll, resize, focus loss.
let tipElement = null;
let tipAnchor = null;
let touchTimer = null;
let listening = false;
const attachedRoots = new WeakSet();
export function hideChartTip() {
  if (tipElement) { tipElement.hidden = true; tipElement.style.display = 'none'; tipElement.replaceChildren(); }
  tipAnchor = null;
  if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
  if (typeof document !== 'undefined') for (const line of document.querySelectorAll?.('.crosshair') ?? []) line.setAttribute('visibility', 'hidden');
}
export const isChartTipVisible = () => Boolean(tipElement && !tipElement.hidden && tipElement.style.display !== 'none');
function ensureTip() {
  if (tipElement && tipElement.isConnected !== false) return tipElement;
  for (const stale of document.querySelectorAll?.('.viz-tip') ?? []) stale.remove?.();
  tipElement = document.createElement('div');
  tipElement.className = 'viz-tip';
  tipElement.setAttribute?.('role', 'tooltip');
  tipElement.hidden = true;
  tipElement.style.display = 'none';
  document.body.append(tipElement);
  return tipElement;
}
export function attachChartInteractions(root) {
  if (!root?.addEventListener || typeof document === 'undefined' || attachedRoots.has(root)) return;
  attachedRoots.add(root);
  ensureTip();
  const place = (clientX, clientY) => {
    const tip = ensureTip();
    const { innerWidth } = window;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 12, clientX + 14))}px`;
    tip.style.top = `${Math.max(8, clientY - tip.offsetHeight - 12)}px`;
  };
  const reveal = () => { const tip = ensureTip(); tip.hidden = false; tip.style.display = ''; return tip; };
  const showText = (anchor, text, x, y) => { if (!text) return hideChartTip(); tipAnchor = anchor; const tip = reveal(); tip.replaceChildren(document.createTextNode(text)); place(x, y); };
  const showTrend = (chart, clientX, clientY) => {
    let data;
    try { data = JSON.parse(chart.dataset.trend); } catch { return hideChartTip(); }
    const box = chart.getBoundingClientRect();
    const ratio = (clientX - box.left) / box.width;
    // The chart is drawn at two widths: the one on screen decides where the points are.
    const svg = [...chart.querySelectorAll('svg')].find(item => item.getClientRects().length) ?? chart.querySelector('svg');
    const xs = (svg.classList.contains('lc-narrow') && data.xn) || (svg.classList.contains('lc-mid') && data.xm) || data.x;
    const index = xs.reduce((best, value, i) => Math.abs(value - ratio) < Math.abs(xs[best] - ratio) ? i : best, 0);
    const line = svg.querySelector('.crosshair');
    const xPos = xs[index] * Number(svg.viewBox.baseVal.width);
    line?.setAttribute('x1', xPos); line?.setAttribute('x2', xPos); line?.setAttribute('visibility', 'visible');
    const title = document.createElement('strong');
    title.textContent = data.weeks[index];
    const rows = data.series.map(series => {
      const row = document.createElement('span');
      const key = document.createElement('i');
      key.style.background = series.color;
      const value = document.createElement('b');
      value.textContent = Number.isFinite(series.values[index]) ? `${series.values[index].toLocaleString('it-IT', { maximumFractionDigits: 1 })}${data.unit ?? '%'}` : '—';
      row.append(key, value, document.createTextNode(` ${series.label}`));
      return row;
    });
    tipAnchor = chart;
    const tip = reveal();
    tip.replaceChildren(title, ...rows);
    place(clientX, clientY);
  };
  root.addEventListener('pointermove', event => {
    const chart = event.target.closest?.('[data-trend]');
    if (chart) return showTrend(chart, event.clientX, event.clientY);
    const mark = event.target.closest?.('[data-tip]');
    if (mark) return showText(mark, mark.dataset.tip, event.clientX, event.clientY);
    if (tipAnchor || isChartTipVisible()) hideChartTip();
  });
  // Leaving the anchor for anything that is not part of it hides the tooltip at once.
  root.addEventListener('pointerout', event => {
    if (!tipAnchor) return;
    const next = event.relatedTarget;
    if (!next || !tipAnchor.contains?.(next)) hideChartTip();
  });
  root.addEventListener('pointerleave', hideChartTip);
  root.addEventListener('pointerdown', event => { if (event.pointerType !== 'touch') hideChartTip(); });
  // On touch screens a tap shows the value briefly, then it goes away by itself.
  root.addEventListener('pointerup', event => { if (event.pointerType === 'touch' && tipAnchor) { clearTimeout(touchTimer); touchTimer = setTimeout(hideChartTip, 1800); } });
  root.addEventListener('pointercancel', hideChartTip);
  root.addEventListener('click', event => { if (!event.target.closest?.('[data-tip],[data-trend]')) hideChartTip(); });
  root.addEventListener('focusin', event => {
    const chart = event.target.closest?.('[data-trend]');
    const box = event.target.getBoundingClientRect();
    if (chart) showTrend(chart, box.right - 4, box.top + 20);
    else if (event.target.closest?.('[data-tip]')) showText(event.target, event.target.dataset.tip, box.left + box.width / 2, box.top);
  });
  root.addEventListener('focusout', hideChartTip);
  // A re-render can remove the anchor under a still pointer: the tooltip goes with it.
  if (typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (tipAnchor && !tipAnchor.isConnected) hideChartTip(); }).observe(root, { childList: true, subtree: true });
  if (listening) return;
  listening = true;
  // Anything that changes the page takes the tooltip away with it (registered once, whatever the number of roots).
  for (const type of ['hashchange', 'popstate', 'blur', 'resize']) globalThis.addEventListener?.(type, hideChartTip);
  globalThis.addEventListener?.('law', hideChartTip, { passive: true, capture: true });
  globalThis.addEventListener?.('keydown', event => { if (event.key === 'Escape') hideChartTip(); });
  document.addEventListener?.('visibilitychange', hideChartTip);
}
