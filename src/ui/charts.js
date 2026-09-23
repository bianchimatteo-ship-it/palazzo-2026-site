// Shared building blocks for the simulation screens: numbers, state badges, meters and charts.
// Charts follow the same rules as the polls page: thin marks, one axis, legend + direct labels,
// hover tooltips through data-trend / data-tip, text in ink rather than in the series colour.
import { glyph } from './visuals.js?v=20260924-9';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (value, digits = 1) => value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString('it-IT', { maximumFractionDigits: digits });
export const euro = value => `${Math.round(Number(value) || 0).toLocaleString('it-IT')} €`;
export const signed = (value, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Number(value) || 0).toLocaleString('it-IT', { maximumFractionDigits: digits })}`;

// Validated categorical slots (same order as the polls) and a single-hue sequential ramp.
export const SERIES = Object.freeze(['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']);
export const INCOME_COLOR = '#1baf7a';
export const EXPENSE_COLOR = '#eb6834';
export const GREEN_RAMP = Object.freeze(['#e6f2ea', '#cfe7d8', '#b5dac4', '#99ccaf', '#7dbd99', '#61ad83', '#479c6e', '#318a5b', '#1f7749', '#136339', '#0b4f2c']);
export const rampColor = (value, min = 0, max = 100) => GREEN_RAMP[Math.max(0, Math.min(GREEN_RAMP.length - 1, Math.round((value - min) / ((max - min) || 1) * (GREEN_RAMP.length - 1))))];

// Visual states shared by every system: growth, decline, risk, crisis, stable.
const STATE_ICONS = { crescita: 'trendUp', calo: 'trendDown', rischio: 'alert', crisi: 'alert', stabile: 'steady', solida: 'shield' };
export function stateBadge(kind, label) {
  return `<span class="state-badge state-${esc(kind)}">${glyph(STATE_ICONS[kind] ?? 'steady', 13, 2)}${esc(label)}</span>`;
}
export function trendState(delta, { threshold = 0.3, invert = false } = {}) {
  const value = invert ? -delta : delta;
  return value > threshold ? 'crescita' : value < -threshold ? 'calo' : 'stabile';
}
export function levelState(value, { crisis = 36, risk = 45, good = 65 } = {}) {
  return value < crisis ? ['crisi', 'Crisi'] : value < risk ? ['rischio', 'A rischio'] : value >= good ? ['solida', 'Buono'] : ['stabile', 'Nella media'];
}
export function meter(value, tone = '', max = 100) {
  return `<b class="hq-bar ${tone}"><i style="width:${Math.max(0, Math.min(100, (Number(value) || 0) / max * 100))}%"></i></b>`;
}
export function delta(value, { digits = 1, invert = false, suffix = '' } = {}) {
  const good = invert ? value < 0 : value > 0;
  const tone = !value ? 'flat' : good ? 'up' : 'down';
  return `<span class="delta delta-${tone}">${signed(value, digits)}${suffix}</span>`;
}

export function sparkline(values, color = 'var(--party-accent)') {
  const points = values.filter(value => Number.isFinite(value));
  if (points.length < 2) return '';
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const coords = points.map((value, index) => [4 + index * 112 / (points.length - 1), 28 - (value - min) / span * 22]);
  const [lx, ly] = coords.at(-1);
  return `<svg class="sparkline" viewBox="0 0 120 32" aria-hidden="true"><polyline points="${coords.map(point => point.join(',')).join(' ')}" /><circle cx="${lx}" cy="${ly}" r="3.5" style="fill:${esc(color)}" /></svg>`;
}

// Round tick spacing (1, 2, 5 × 10ⁿ) whatever the magnitude of the data.
function niceStep(raw) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const normal = raw / magnitude;
  return (normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10) * magnitude;
}
const compact = value => Math.abs(value) >= 10000 ? `${num(value / 1000, 1)}k` : num(value, 1);
// Multi-series line chart with legend, direct end labels and a crosshair tooltip.
export function lineChart({ series, labels, tips = labels, unit = '', min = null, max = null, height = 230, ariaLabel = 'Andamento', digits = 1 }) {
  const length = labels.length;
  if (length < 2) return '<p class="quiet-copy">Il grafico compare dalla seconda settimana: chiudi la settimana per vedere l’andamento.</p>';
  const W = 660, H = height, L = 40, R = 150, T = 14, B = 28;
  const plotW = W - L - R, plotH = H - T - B;
  const values = series.flatMap(item => item.values.filter(Number.isFinite));
  const low = min ?? Math.floor(Math.min(...values) - 2);
  const high = max ?? Math.ceil(Math.max(...values) + 2);
  const span = high - low || 1;
  const step = niceStep(span / 5);
  const x = i => L + i * plotW / (length - 1);
  const y = v => T + (1 - (v - low) / span) * plotH;
  const ticks = [];
  for (let v = Math.ceil(low / step) * step; v <= high; v += step) ticks.push(v);
  const grid = ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${compact(v)}</text>`).join('');
  const every = Math.max(1, Math.ceil(length / 6));
  const xTicks = labels.map((label, i) => i % every === 0 || i === length - 1 ? `<text class="tick" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(label)}</text>` : '').join('');
  const lines = series.map(item => `<path class="series ${item.emphasis ? 'is-player' : ''}" d="${item.values.map((v, i) => Number.isFinite(v) ? `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}` : '').join(' ')}" style="stroke:${esc(item.color)}"/>`).join('');
  const ends = series.map(item => ({ ...item, endY: y(item.values.at(-1) ?? low) })).sort((a, b) => a.endY - b.endY);
  let cursor = T;
  for (const item of ends) { item.labelY = Math.max(item.endY, cursor); cursor = item.labelY + 16; }
  const overflow = cursor - 16 - (H - B);
  if (overflow > 0) for (const item of ends) item.labelY -= overflow;
  const endLabels = ends.map(item => `<circle class="end-dot" cx="${x(length - 1)}" cy="${item.endY}" r="4" style="fill:${esc(item.color)}"/><line class="leader" x1="${x(length - 1) + 6}" y1="${item.endY}" x2="${W - R + 10}" y2="${item.labelY}"/><text class="end-label ${item.emphasis ? 'is-player' : ''}" x="${W - R + 14}" y="${item.labelY + 4}">${esc(item.short ?? item.label)} ${num(item.values.at(-1), digits)}${esc(unit)}</text>`).join('');
  const payload = { x: labels.map((_, i) => x(i) / W), weeks: tips, unit, series: series.map(item => ({ label: item.label, color: item.color, values: item.values })) };
  const legend = series.length > 1 ? `<div class="trend-legend">${series.map(item => `<span class="legend-item ${item.emphasis ? 'is-player' : ''}"><i style="background:${esc(item.color)}"></i>${esc(item.label)}</span>`).join('')}</div>` : '';
  return `${legend}<div class="trend-chart" data-trend="${esc(JSON.stringify(payload))}" tabindex="0" aria-label="${esc(ariaLabel)}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true">${grid}${xTicks}${lines}${endLabels}<line class="crosshair" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/></svg></div>`;
}

// Income above the baseline, spending below: one € axis, thin bars with rounded data ends.
export function flowChart(rows, { height = 210 } = {}) {
  if (!rows.length) return '<p class="quiet-copy">Il primo bilancio settimanale compare alla chiusura della settimana.</p>';
  const W = 660, H = height, L = 52, R = 14, T = 12, B = 26;
  const plotW = W - L - R, plotH = H - T - B;
  const top = Math.max(100, ...rows.map(row => Math.max(row.income, row.expense)));
  const step = top > 4000 ? 2000 : top > 2000 ? 1000 : top > 800 ? 500 : 200;
  const high = Math.ceil(top / step) * step;
  const zero = T + plotH / 2;
  const scale = (plotH / 2) / high;
  const slot = plotW / rows.length;
  const bar = Math.min(12, slot / 2 - 3);
  const ticks = [-high, -high / 2, 0, high / 2, high].map(v => `<line class="grid ${v === 0 ? 'baseline' : ''}" x1="${L}" x2="${W - R}" y1="${zero - v * scale}" y2="${zero - v * scale}"/><text class="tick" x="${L - 6}" y="${zero - v * scale + 3.5}" text-anchor="end">${v === 0 ? '0' : `${v > 0 ? '' : '−'}${num(Math.abs(v) / 1000, 1)}k`}</text>`).join('');
  const every = Math.max(1, Math.ceil(rows.length / 8));
  const bars = rows.map((row, i) => {
    const cx = L + slot * i + slot / 2;
    const up = row.income > 0 ? Math.max(4, row.income * scale) : 0, down = row.expense > 0 ? Math.max(4, row.expense * scale) : 0;
    const tip = `${row.label}: entrate ${euro(row.income)} · uscite ${euro(row.expense)} · saldo ${signed(row.income - row.expense, 0)} €`;
    return `<g class="flow-mark" data-tip="${esc(tip)}" tabindex="0"><rect class="hit" x="${cx - slot / 2}" y="${T}" width="${slot}" height="${plotH}"/>${up ? `<path d="M${cx - bar - 1},${zero - 1} v${-(up - 4)} a4,4 0 0 1 4,-4 h${bar - 8 > 0 ? bar - 8 : 0} a4,4 0 0 1 4,4 v${up - 4} z" style="fill:${INCOME_COLOR}"/>` : ''}${down ? `<path d="M${cx + 1},${zero + 1} v${down - 4} a4,4 0 0 0 4,4 h${bar - 8 > 0 ? bar - 8 : 0} a4,4 0 0 0 4,-4 v${-(down - 4)} z" style="fill:${EXPENSE_COLOR}"/>` : ''}${i % every === 0 || i === rows.length - 1 ? `<text class="tick" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(row.short ?? row.label)}</text>` : ''}</g>`;
  }).join('');
  return `<div class="trend-legend"><span class="legend-item"><i style="background:${INCOME_COLOR}"></i>Entrate</span><span class="legend-item"><i style="background:${EXPENSE_COLOR}"></i>Uscite</span></div><div class="flow-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Entrate e uscite settimanali">${ticks}${bars}</svg></div>`;
}

// Horizontal thin bars for a breakdown (categories, segments): value in ink, colour only on the mark.
export function breakdown(rows, { color = 'var(--party-accent)', format = value => num(value), max = null } = {}) {
  const top = max ?? Math.max(1, ...rows.map(row => Math.abs(row.value)));
  return `<div class="breakdown">${rows.map(row => `<div class="breakdown-row" data-tip="${esc(`${row.label}: ${format(row.value)}`)}" tabindex="0"><span>${esc(row.label)}</span><b><i style="width:${Math.abs(row.value) / top * 100}%;background:${esc(row.color ?? color)}"></i></b><strong>${format(row.value)}</strong></div>`).join('')}</div>`;
}
