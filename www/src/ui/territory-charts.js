// Charts of the territories for the polls page: a tile map of Italy (one tile for each region, placed as the regions lie), ranking and diverging bars with the national
// figure as the reference, the parties of a territory against the national picture, and a parties × regions heatmap. Pure functions on numbers that the game already has
// (the regional picture of the observatory, and the real vote of 2022 by region): they invent nothing. A missing value is drawn as missing (a dashed tile, a dash), a
// zero as a zero, and every chart says which measure it shows, in which unit, from which source (a simulated estimate or a real figure) and for which date.
import { esc } from './charts.js?v=20261022-19';
import { SEQUENTIAL } from './polls-mode.js?v=20261022-19';
import { formatDate } from '../core/time.js?v=20261022-19';
import { inkOn } from './visuals.js?v=20261022-19';

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
// The five ripartizioni of ISTAT: a way to see a few regions at a time where the screen is narrow.
export const MACRO_AREAS = Object.freeze([
  ['tutte', 'Tutta Italia', Object.keys(REGION_TILES)],
  ['nord-ovest', 'Nord-ovest', ['Valle d’Aosta', 'Piemonte', 'Liguria', 'Lombardia']],
  ['nord-est', 'Nord-est', ['Trentino-Alto Adige', 'Veneto', 'Friuli-Venezia Giulia', 'Emilia-Romagna']],
  ['centro', 'Centro', ['Toscana', 'Umbria', 'Marche', 'Lazio']],
  ['sud', 'Sud', ['Abruzzo', 'Molise', 'Campania', 'Puglia', 'Basilicata', 'Calabria']],
  ['isole', 'Isole', ['Sicilia', 'Sardegna']]
]);
export const regionsOfArea = id => (MACRO_AREAS.find(([key]) => key === id) ?? MACRO_AREAS[0])[2];

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
// Fixed decimals, so that a column of figures reads as one («9,0%» next to «9,1%», never «9%» next to «9,1%»); a sign never goes with a figure that rounds to zero (no «−0»).
const fixed = (value, digits) => Number(value).toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const num = (value, digits = 1) => finite(value) ? fixed(value, digits) : '—';
const signed = (value, digits = 1) => { const rounded = Number(Number(value).toFixed(digits)); return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${fixed(Math.abs(rounded), digits)}`; };
const pct = (value, digits = 1) => finite(value) ? `${fixed(value, digits)}%` : '—';
// The decimals of a gap or a change: one, two when the whole range is under a point (small changes would all read «±0,0»).
const gapDigits = limit => limit < 1 ? 2 : 1;
const hex = ([r, g, b]) => `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const rgb = color => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
const mix = (from, to, t) => { const a = rgb(from), b = rgb(to); return hex(a.map((v, i) => v + (b[i] - v) * t)); };
// Above the reference: petrol (analysis); below: terracotta (alert); nothing: the neutral surface.
const NEUTRAL = '#2a2d27';
const ABOVE = '#4F9BB7';
const BELOW = '#C4684B';
export const divergingColor = (value, limit) => !finite(value) ? NEUTRAL : mix(NEUTRAL, value >= 0 ? ABOVE : BELOW, Math.min(1, Math.abs(value) / (limit || 1)) * .85);
export const sequentialColor = (value, min, max) => !finite(value) ? NEUTRAL : SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.max(0, Math.floor((value - min) / ((max - min) || 1) * (SEQUENTIAL.length - 1))))];

// The measures of the territory maps: the share (simulated estimate), the gap from the national figure, the change since the first regional picture, and the real vote of 2022.
export const TERRITORY_MEASURES = Object.freeze([['quota', 'Consenso'], ['scarto', 'Scarto dal dato nazionale'], ['variazione', 'Variazione nel tempo'], ['reale', 'Voto reale 2022']]);
const SHARE_MODES = new Set(['quota', 'reale']);
const valueOf = (item, mode) => mode === 'reale' ? item.real : mode === 'quota' ? item.share : mode === 'scarto' ? item.gap : item.change;
const measureText = (mode, value, digits, gap = 1) => !finite(value) ? '—' : SHARE_MODES.has(mode) ? pct(value, digits) : signed(value, gap);
const MEASURE_NAME = Object.fromEntries(TERRITORY_MEASURES);
// What a tile says when pointed at or read aloud: territory, force, value with its unit and the reference.
const measureTip = (mode, item, force, digits, national, gap = 1) => {
  if (mode === 'reale') return `${item.region} · ${force}: ${finite(item.real) ? `${pct(item.real, digits)} dei voti validi alle politiche 2022 (voto reale)` : 'nessun dato reale'}`;
  if (mode === 'quota') return `${item.region} · ${force}: ${finite(item.share) ? pct(item.share, digits) : 'dato non disponibile'}${finite(item.gap) ? ` (${signed(item.gap, gap)} punti dal dato nazionale${finite(national) ? ` ${pct(national, digits)}` : ''})` : ''} · stima simulata`;
  if (mode === 'scarto') return `${item.region} · ${force}: ${finite(item.gap) ? `${signed(item.gap, gap)} punti rispetto al dato nazionale (${pct(item.share, digits)} contro ${pct(national, digits)})` : 'dato non disponibile'} · stima simulata`;
  return `${item.region} · ${force}: ${finite(item.change) ? `${signed(item.change, gap)} punti dal primo quadro regionale` : 'serve almeno un secondo quadro regionale'} · stima simulata`;
};
const SELECT = region => `data-view-filter="obsRegion" data-view-filter-value="${esc(region)}"`;

// Where a figure comes from, said once under every chart: a real figure or a simulated estimate, for which territory and which date.
export function provenance({ kind = 'simulato', territory = 'Italia', week = null, date = null, basis = '' } = {}) {
  const real = kind === 'reale';
  return `<p class="obs-source"><span class="src-badge ${real ? 'is-real' : 'is-sim'}">${real ? 'DATO REALE' : 'STIMA SIMULATA'}</span><span><b>Territorio</b>: ${esc(territory)}</span>${week !== null || date ? `<span><b>Quando</b>: ${[week !== null ? `settimana ${esc(week)}` : '', date ? esc(formatDate(date)) : ''].filter(Boolean).join(' · ')}</span>` : ''}${basis ? `<span><b>Fonte</b>: ${basis}</span>` : ''}</p>`;
}

// The tile map. items: [{ region, share, gap, change, real }]; selected is the open territory; compare the regions put side by side; home the player's region.
export function italyMap(items, { mode = 'quota', selected = null, compare = [], home = null, force = '', digits = 1, national = null, firstWeek = null } = {}) {
  const byRegion = new Map(items.map(item => [item.region, item]));
  const values = items.map(item => valueOf(item, mode)).filter(finite);
  if (!values.length) return `<p class="quiet-copy">${mode === 'reale' ? 'Questa forza non si è presentata alle politiche del 2022: non c’è un dato reale per regione.' : 'Per questa misura non c’è ancora nessun dato regionale.'}</p>`;
  const min = Math.min(...values), max = Math.max(...values), limit = Math.max(...values.map(Math.abs), 0.1), gap = gapDigits(limit);
  const tiles = Object.entries(REGION_TILES).map(([region, [row, col, abbreviation]]) => {
    const item = byRegion.get(region) ?? { region, share: null, gap: null, change: null, real: null };
    const value = valueOf(item, mode);
    const fill = SHARE_MODES.has(mode) ? sequentialColor(value, min, max) : divergingColor(value, limit);
    const missing = !finite(value);
    const text = measureText(mode, value, digits, gap);
    return `<button type="button" class="itmap-tile ${region === selected ? 'is-selected' : ''} ${compare.includes(region) ? 'is-compared' : ''} ${region === home ? 'is-home' : ''} ${missing ? 'is-missing' : ''}" style="grid-row:${row + 1};grid-column:${col + 1};background:${fill};color:${missing ? 'var(--muted)' : inkOn(fill)}" ${SELECT(region)} data-tip="${esc(measureTip(mode, item, force, digits, national, gap))}" aria-pressed="${region === selected}" aria-label="${esc(`${region}: ${missing ? 'dato non disponibile' : text}`)}"><small>${esc(abbreviation)}</small><strong>${esc(text)}</strong></button>`;
  }).join('');
  const share = SHARE_MODES.has(mode);
  const scale = share ? `<i style="background:linear-gradient(90deg,${SEQUENTIAL.join(',')})"></i>` : `<i style="background:linear-gradient(90deg,${BELOW},${NEUTRAL},${ABOVE})"></i>`;
  const ends = share ? [pct(min, digits), pct((min + max) / 2, digits), pct(max, digits)] : [signed(-limit, gap), '0', signed(limit, gap)];
  const meaning = {
    quota: `Quota di consenso di ${esc(force)} nella regione, in % dei voti validi: stima simulata. Più chiaro = più consenso.`,
    scarto: `Punti percentuali di differenza tra la regione e il dato nazionale di ${esc(force)}${finite(national) ? ` (Italia: ${pct(national, digits)})` : ''}. Petrolio = sopra, terracotta = sotto, grigio = come l’Italia.`,
    variazione: `Punti percentuali guadagnati o persi da ${esc(force)} dal primo quadro regionale${firstWeek !== null ? ` (settimana ${esc(firstWeek)})` : ''} a oggi. Petrolio = in crescita, terracotta = in calo.`,
    reale: `Voto reale: quota dei voti validi della lista di ${esc(force)} alle politiche del 25 settembre 2022 (Camera, proporzionale). Più chiaro = più voti.`
  }[mode];
  const key = `<ul class="itmap-key" aria-label="Legenda dei segni"><li><i class="key is-home"></i>la tua regione</li><li><i class="key is-selected"></i>regione aperta</li><li><i class="key is-compared"></i>nel confronto</li><li><i class="key is-missing"></i>dato non disponibile</li></ul>`;
  return `<div class="itmap" role="group" aria-label="Cartina delle regioni: ${esc(MEASURE_NAME[mode])}"><div class="itmap-grid">${tiles}</div>
    <div class="itmap-legend"><div class="itmap-scale" role="img" aria-label="Scala dei colori da ${esc(ends[0])} a ${esc(ends[2])}"><span>${esc(ends[0])}</span>${scale}<span>${esc(ends[2])}</span></div><p class="itmap-ticks" aria-hidden="true"><span>${esc(ends[0])}</span><span>${esc(ends[1])}</span><span>${esc(ends[2])}</span></p><p class="itmap-meaning">${meaning}</p>${key}</div></div>`;
}

// Horizontal bars of the regions, sorted, with the national figure as a marker (share) or a centre axis (gap and change). Each row opens its territory.
export function regionBars(items, { mode = 'quota', selected = null, home = null, national = null, color = 'var(--teal-soft)', digits = 1 } = {}) {
  // Every region is listed: those with a figure sorted by it, then those without one (a force that did not run there in 2022, a measure that needs a second picture), marked
  // «—» and said so in words. A region is never dropped to make the chart look complete.
  const byName = (a, b) => a.region.localeCompare(b.region, 'it');
  const rows = items.filter(item => finite(valueOf(item, mode))).sort((a, b) => valueOf(b, mode) - valueOf(a, mode) || byName(a, b));
  const missing = items.filter(item => !finite(valueOf(item, mode))).sort(byName);
  if (!rows.length) return '<p class="quiet-copy">Nessun dato regionale per questa misura.</p>';
  const diverging = !SHARE_MODES.has(mode);
  const limit = Math.max(...rows.map(item => Math.abs(valueOf(item, mode))), 0.1);
  const gap = gapDigits(limit);
  const max = Math.max(...rows.map(item => valueOf(item, mode)), finite(national) ? national : 0, 1);
  const name = item => `<span class="rbar-name">${esc(item.region)}${item.region === home ? ' <small>la tua regione</small>' : ''}</span>`;
  const body = rows.map((item, index) => {
    const value = valueOf(item, mode);
    const track = diverging
      ? `<span class="rbar-track is-diverging"><i class="${value >= 0 ? 'up' : 'down'}" style="${value >= 0 ? 'left:50%' : 'right:50%'};width:${Math.abs(value) / limit * 50}%"></i></span>`
      : `<span class="rbar-track"><i style="width:${value / max * 100}%;background:${color}"></i>${finite(national) ? `<s style="left:${national / max * 100}%" title="Dato nazionale ${esc(pct(national, digits))}"></s>` : ''}</span>`;
    return `<button type="button" class="rbar-row ${item.region === selected ? 'is-selected' : ''} ${item.region === home ? 'is-home' : ''}" ${SELECT(item.region)} data-rank="${index + 1}" aria-pressed="${item.region === selected}">${name(item)}${track}<b class="rbar-value">${esc(measureText(mode, value, digits, gap))}</b></button>`;
  }).join('');
  const why = mode === 'reale' ? 'nessuna lista alle politiche 2022' : mode === 'variazione' ? 'serve un secondo quadro regionale' : 'dato non disponibile';
  const absent = missing.map(item => `<button type="button" class="rbar-row is-missing ${item.region === selected ? 'is-selected' : ''} ${item.region === home ? 'is-home' : ''}" ${SELECT(item.region)} aria-pressed="${item.region === selected}">${name(item)}<span class="rbar-track is-empty" aria-hidden="true"></span><b class="rbar-value" aria-label="${esc(why)}">—</b><small class="rbar-why">${esc(why)}</small></button>`).join('');
  const count = missing.length ? `<p class="rbar-key rbar-count">${rows.length} regioni con il dato, ${missing.length} senza (in fondo, con «—»).</p>` : '';
  const note = diverging ? `<p class="rbar-key"><i class="axis"></i> asse centrale = dato nazionale: a destra sopra (petrolio), a sinistra sotto (terracotta), in punti percentuali</p>` : (finite(national) ? `<p class="rbar-key"><s></s> dato nazionale ${esc(pct(national, digits))}</p>` : '');
  return `<div class="rbars" role="list" data-regions="${items.length}" data-with-value="${rows.length}">${body}${absent}</div>${count}${note}`;
}

// The parties of one territory: each in its own colour, the national figure of the same party as a marker, and the gap in words.
export function partyBars(rows, { digits = 1 } = {}) {
  if (!rows.length) return '<p class="quiet-copy">Nessun dato per questo territorio.</p>';
  const max = Math.max(...rows.map(row => Math.max(row.share, finite(row.national) ? row.national : 0)), 1);
  return `<div class="pbars" role="list">${rows.map(row => {
    const gap = finite(row.national) ? row.share - row.national : null;
    return `<div class="pbar-row ${row.isPlayer ? 'is-player' : ''}" role="listitem" data-tip="${esc(`${row.label}: ${pct(row.share, digits)}${finite(row.national) ? ` · dato nazionale ${pct(row.national, digits)}` : ''} · stima simulata`)}" tabindex="0"><span class="pbar-name">${row.logo ?? ''}<span><strong>${esc(row.label)}</strong>${row.note ? `<small>${esc(row.note)}</small>` : ''}</span></span><span class="pbar-track"><i style="width:${row.share / max * 100}%;background:${esc(row.color)}"></i>${finite(row.national) ? `<s style="left:${row.national / max * 100}%"></s>` : ''}</span><b>${pct(row.share, digits)}</b><em class="${gap === null ? '' : gap >= 0 ? 'up' : 'down'}" title="${gap === null ? '' : `${signed(gap, 1)} punti rispetto al dato nazionale`}">${gap === null ? '' : signed(gap, 1)}</em></div>`;
  }).join('')}</div><p class="rbar-key"><s></s> dato nazionale della stessa forza · a destra lo scarto in punti</p>`;
}

// Parties × regions: the cell shows the share and is coloured by the gap from the national figure of that party (petrol above, terracotta below). Where the screen is
// narrow the row heads show the short mark of the party (the name is in the key under the table) and the regions can be taken a few at a time (columns).
export function heatmap({ columns, rows, digits = 1 }) {
  if (!rows.length || !columns.length) return '<p class="quiet-copy">La tabella si riempie con il quadro regionale.</p>';
  const limit = Math.max(...rows.flatMap(row => row.cells.map(cell => Math.abs(cell.gap ?? 0))), 0.5);
  const head = `<tr><th scope="col" class="hm-corner">Forza</th><th scope="col" class="hm-nat" title="Dato nazionale">Italia</th>${columns.map(column => `<th scope="col" class="${column.home ? 'is-home' : ''}" title="${esc(column.label)}${column.home ? ' (la tua regione)' : ''}">${esc(column.short)}</th>`).join('')}</tr>`;
  const body = rows.map(row => `<tr class="${row.isPlayer ? 'is-player' : ''}"><th scope="row" title="${esc(row.label)}"><span class="hm-dot" style="background:${esc(row.color)}"></span><b class="hm-mark">${esc(row.mark)}</b><span class="hm-name">${esc(row.label)}</span></th><td class="hm-nat">${esc(pct(row.national, digits))}</td>${row.cells.map(cell => { const fill = divergingColor(cell.gap, limit); const known = finite(cell.share); return `<td style="background:${fill};color:${known ? inkOn(fill) : 'var(--muted)'}" data-tip="${esc(`${row.label} · ${cell.region}: ${known ? `${pct(cell.share, digits)}${finite(cell.gap) ? ` (${signed(cell.gap, 1)} punti dal dato nazionale)` : ''} · stima simulata` : 'dato non disponibile'}`)}" tabindex="0">${known ? esc(num(cell.share, digits)) : '—'}</td>`; }).join('')}</tr>`).join('');
  const names = `<ul class="hm-names" aria-label="Nomi delle forze">${rows.map(row => `<li><span class="hm-dot" style="background:${esc(row.color)}"></span><b>${esc(row.mark)}</b> ${esc(row.label)}</li>`).join('')}</ul>`;
  return `<div class="hm-block"><div class="hm-wrap" role="region" aria-label="Mappa di calore: forze per regione, scorri per vedere tutte le regioni" tabindex="0"><table class="hm"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    ${names}<div class="itmap-scale hm-scale"><span>sotto il dato nazionale (−${num(limit, 1)})</span><i style="background:linear-gradient(90deg,${BELOW},${NEUTRAL},${ABOVE})"></i><span>sopra (+${num(limit, 1)})</span></div>
    <p class="itmap-meaning">Ogni cella è la quota di consenso (%) della forza nella regione; il colore è lo scarto in punti dal dato nazionale della stessa forza (colonna «Italia»). Un trattino (—) è un dato non disponibile, uno zero è uno zero.</p></div>`;
}
