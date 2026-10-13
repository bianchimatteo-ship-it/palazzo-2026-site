// Charts of the territories for the polls page: a tile map of Italy (one tile for each region, placed as the regions lie), ranking and diverging bars with the national
// figure as the reference, the parties of a territory against the national picture, and a parties × regions heatmap. Pure functions on numbers that the game already has
// (the regional picture of the observatory): they invent nothing, a missing value is drawn as missing (a grey tile, a dash), never as zero.
import { esc, num, signed } from './charts.js?v=20261013-1';
import { SEQUENTIAL } from './polls-mode.js?v=20261013-1';
import { inkOn } from './visuals.js?v=20261013-1';

// Row and column of each region on a tile map of five columns (north up). It is a cartogram: it keeps neighbours near, not the shapes or the sizes.
export const REGION_TILES = Object.freeze({
  'Valle d’Aosta': [0, 0, 'VDA'], 'Lombardia': [0, 1, 'LOM'], 'Trentino-Alto Adige': [0, 2, 'TAA'],
  'Piemonte': [1, 0, 'PIE'], 'Emilia-Romagna': [1, 1, 'EMR'], 'Veneto': [1, 2, 'VEN'], 'Friuli-Venezia Giulia': [1, 3, 'FVG'],
  'Liguria': [2, 0, 'LIG'], 'Toscana': [2, 1, 'TOS'], 'Umbria': [2, 2, 'UMB'], 'Marche': [2, 3, 'MAR'],
  'Sardegna': [3, 0, 'SAR'], 'Lazio': [3, 2, 'LAZ'], 'Abruzzo': [3, 3, 'ABR'],
  'Campania': [4, 2, 'CAM'], 'Molise': [4, 3, 'MOL'], 'Puglia': [4, 4, 'PUG'],
  'Basilicata': [5, 3, 'BAS'], 'Calabria': [6, 3, 'CAL'], 'Sicilia': [7, 2, 'SIC']
});
export const regionAbbreviation = region => REGION_TILES[region]?.[2] ?? String(region).slice(0, 3).toUpperCase();

const finite = value => Number.isFinite(Number(value)) && value !== null && value !== '';
const pct = (value, digits = 1) => finite(value) ? `${num(value, digits)}%` : '—';
const hex = ([r, g, b]) => `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const rgb = color => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
const mix = (from, to, t) => { const a = rgb(from), b = rgb(to); return hex(a.map((v, i) => v + (b[i] - v) * t)); };
// Above the reference: petrol (analysis); below: terracotta (alert); nothing: the neutral surface.
const NEUTRAL = '#2a2d27';
const ABOVE = '#4F9BB7';
const BELOW = '#C4684B';
export const divergingColor = (value, limit) => !finite(value) ? NEUTRAL : mix(NEUTRAL, value >= 0 ? ABOVE : BELOW, Math.min(1, Math.abs(value) / (limit || 1)) * .85);
export const sequentialColor = (value, min, max) => !finite(value) ? NEUTRAL : SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.max(0, Math.floor((value - min) / ((max - min) || 1) * (SEQUENTIAL.length - 1))))];

// The three measures of the territory maps: the share, the gap from the national figure and the change since the first regional picture.
export const TERRITORY_MEASURES = Object.freeze([['quota', 'Consenso'], ['scarto', 'Scarto dal dato nazionale'], ['variazione', 'Variazione nel tempo']]);
const measureText = (mode, value, digits) => !finite(value) ? '—' : mode === 'quota' ? pct(value, digits) : `${signed(value, digits)}${mode === 'scarto' ? '' : ''}`;
const measureTip = (mode, item, force, digits) => mode === 'quota'
  ? `${item.region}: ${force} ${pct(item.share, digits)}${finite(item.gap) ? ` (${signed(item.gap, 1)} dal dato nazionale)` : ''}`
  : mode === 'scarto' ? `${item.region}: ${force} ${pct(item.share, digits)}, ${finite(item.gap) ? `${signed(item.gap, 1)} punti dal dato nazionale` : 'senza dato nazionale'}`
    : `${item.region}: ${finite(item.change) ? `${signed(item.change, 1)} punti dal primo quadro regionale` : 'serve almeno un secondo quadro regionale'}`;
const valueOf = (item, mode) => mode === 'quota' ? item.share : mode === 'scarto' ? item.gap : item.change;
const SELECT = region => `data-view-filter="obsRegion" data-view-filter-value="${esc(region)}"`;

// The tile map. items: [{ region, share, gap, change }]; selected is the open territory; compare the regions put side by side; home the player's region.
export function italyMap(items, { mode = 'quota', selected = null, compare = [], home = null, force = '', digits = 1 } = {}) {
  const byRegion = new Map(items.map(item => [item.region, item]));
  const values = items.map(item => valueOf(item, mode)).filter(finite);
  if (!values.length) return '<p class="quiet-copy">Per questa misura non c’è ancora nessun dato regionale.</p>';
  const min = Math.min(...values), max = Math.max(...values), limit = Math.max(...values.map(Math.abs), 0.1);
  const tiles = Object.entries(REGION_TILES).map(([region, [row, col, abbreviation]]) => {
    const item = byRegion.get(region) ?? { region, share: null, gap: null, change: null };
    const value = valueOf(item, mode);
    const fill = mode === 'quota' ? sequentialColor(value, min, max) : divergingColor(value, limit);
    const missing = !finite(value);
    return `<button type="button" class="itmap-tile ${region === selected ? 'is-selected' : ''} ${compare.includes(region) ? 'is-compared' : ''} ${region === home ? 'is-home' : ''} ${missing ? 'is-missing' : ''}" style="grid-row:${row + 1};grid-column:${col + 1};background:${fill};color:${missing ? 'var(--muted)' : inkOn(fill)}" ${SELECT(region)} data-tip="${esc(measureTip(mode, item, force, digits))}" aria-pressed="${region === selected}" aria-label="${esc(`${region}: ${measureText(mode, value, digits)}`)}"><small>${esc(abbreviation)}</small><strong>${esc(measureText(mode, value, digits))}</strong></button>`;
  }).join('');
  const scale = mode === 'quota'
    ? `<i style="background:linear-gradient(90deg,${SEQUENTIAL.join(',')})"></i>`
    : `<i style="background:linear-gradient(90deg,${BELOW},${NEUTRAL},${ABOVE})"></i>`;
  const ends = mode === 'quota' ? [pct(min, digits), pct(max, digits)] : [signed(-limit, 1), signed(limit, 1)];
  return `<div class="itmap" role="group" aria-label="Cartina delle regioni: ${esc(TERRITORY_MEASURES.find(([id]) => id === mode)?.[1] ?? '')}"><div class="itmap-grid">${tiles}</div>
    <div class="itmap-scale"><span>${esc(ends[0])}</span>${scale}<span>${esc(ends[1])}</span></div></div>`;
}

// Horizontal bars of the regions, sorted, with the national figure as a marker (share) or a centre axis (gap and change). Each row opens its territory.
export function regionBars(items, { mode = 'quota', selected = null, home = null, national = null, color = 'var(--teal-soft)', digits = 1 } = {}) {
  const rows = items.filter(item => finite(valueOf(item, mode))).sort((a, b) => valueOf(b, mode) - valueOf(a, mode));
  if (!rows.length) return '<p class="quiet-copy">Nessun dato regionale per questa misura.</p>';
  const diverging = mode !== 'quota';
  const limit = Math.max(...rows.map(item => Math.abs(valueOf(item, mode))), 0.1);
  const max = Math.max(...rows.map(item => item.share), finite(national) ? national : 0, 1);
  const body = rows.map(item => {
    const value = valueOf(item, mode);
    const track = diverging
      ? `<span class="rbar-track is-diverging"><i class="${value >= 0 ? 'up' : 'down'}" style="${value >= 0 ? 'left:50%' : `right:50%`};width:${Math.abs(value) / limit * 50}%"></i></span>`
      : `<span class="rbar-track"><i style="width:${item.share / max * 100}%;background:${color}"></i>${finite(national) ? `<s style="left:${national / max * 100}%" title="Dato nazionale ${esc(pct(national, digits))}"></s>` : ''}</span>`;
    return `<button type="button" class="rbar-row ${item.region === selected ? 'is-selected' : ''} ${item.region === home ? 'is-home' : ''}" ${SELECT(item.region)} aria-pressed="${item.region === selected}"><span class="rbar-name">${esc(item.region)}${item.region === home ? ' <small>la tua regione</small>' : ''}</span>${track}<b class="rbar-value">${esc(measureText(mode, value, digits))}</b></button>`;
  }).join('');
  const note = diverging ? '' : (finite(national) ? `<p class="rbar-key"><s></s> dato nazionale ${esc(pct(national, digits))}</p>` : '');
  return `<div class="rbars" role="list">${body}</div>${note}`;
}

// The parties of one territory: each in its own colour, the national figure of the same party as a marker, and the gap in words.
export function partyBars(rows, { digits = 1 } = {}) {
  if (!rows.length) return '<p class="quiet-copy">Nessun dato per questo territorio.</p>';
  const max = Math.max(...rows.map(row => Math.max(row.share, finite(row.national) ? row.national : 0)), 1);
  return `<div class="pbars" role="list">${rows.map(row => {
    const gap = finite(row.national) ? row.share - row.national : null;
    return `<div class="pbar-row ${row.isPlayer ? 'is-player' : ''}" role="listitem" data-tip="${esc(`${row.label}: ${pct(row.share, digits)}${finite(row.national) ? ` · dato nazionale ${pct(row.national, digits)}` : ''}`)}" tabindex="0"><span class="pbar-name">${row.logo ?? ''}<span><strong>${esc(row.label)}</strong>${row.note ? `<small>${esc(row.note)}</small>` : ''}</span></span><span class="pbar-track"><i style="width:${row.share / max * 100}%;background:${esc(row.color)}"></i>${finite(row.national) ? `<s style="left:${row.national / max * 100}%"></s>` : ''}</span><b>${pct(row.share, digits)}</b><em class="${gap === null ? '' : gap >= 0 ? 'up' : 'down'}">${gap === null ? '' : signed(gap, 1)}</em></div>`;
  }).join('')}</div><p class="rbar-key"><s></s> dato nazionale della stessa forza · a destra lo scarto in punti</p>`;
}

// Parties × regions: the cell shows the share and is coloured by the gap from the national figure of that party (petrol above, terracotta below).
export function heatmap({ columns, rows, digits = 1 }) {
  if (!rows.length || !columns.length) return '<p class="quiet-copy">La tabella si riempie con il quadro regionale.</p>';
  const limit = Math.max(...rows.flatMap(row => row.cells.map(cell => Math.abs(cell.gap ?? 0))), 0.5);
  const head = `<tr><th scope="col" class="hm-corner">Forza</th><th scope="col" class="hm-nat">Italia</th>${columns.map(column => `<th scope="col" class="${column.home ? 'is-home' : ''}" title="${esc(column.label)}">${esc(column.short)}</th>`).join('')}</tr>`;
  const body = rows.map(row => `<tr class="${row.isPlayer ? 'is-player' : ''}"><th scope="row"><span class="hm-dot" style="background:${esc(row.color)}"></span>${esc(row.label)}</th><td class="hm-nat">${esc(pct(row.national, digits))}</td>${row.cells.map(cell => { const fill = divergingColor(cell.gap, limit); return `<td style="background:${fill};color:${finite(cell.gap) ? inkOn(fill) : 'var(--muted)'}" data-tip="${esc(`${row.label} · ${cell.region}: ${pct(cell.share, digits)}${finite(cell.gap) ? ` (${signed(cell.gap, 1)} dal dato nazionale)` : ''}`)}" tabindex="0">${finite(cell.share) ? esc(num(cell.share, digits)) : '—'}</td>`; }).join('')}</tr>`).join('');
  return `<div class="hm-wrap" role="region" aria-label="Mappa di calore: forze per regione" tabindex="0"><table class="hm"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    <div class="itmap-scale hm-scale"><span>sotto il dato nazionale (−${num(limit, 1)})</span><i style="background:linear-gradient(90deg,${BELOW},${NEUTRAL},${ABOVE})"></i><span>sopra (+${num(limit, 1)})</span></div>`;
}
