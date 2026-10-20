// The geographic map of the national elections: Italy drawn with the real boundaries of regions and provinces (ISTAT, simplified: src/data/real/italy-boundaries.json), coloured by the bloc that wins
// most single-member districts there. It sits beside the squares map of the districts, which stays as it is.
// What is real and what is not: the boundaries and the winners of 2022 are real data (ISTAT, Eligendo); the projection and the vote of the game are simulation, and the card says which one is on the screen.
// A region is read from the districts that belong to it; a province from the districts that include at least one of its comuni (a district can touch several provinces: it is a territorial reading,
// never an official provincial result, and the card says so). No boundary and no winner is invented: where there is no district there is no colour.
import { esc, num } from './sections-kit.js?v=20261020-2';

export const MAP_SCOPES = Object.freeze([['regioni', 'Regioni'], ['province', 'Province']]);
const REGION_SHORT = { Piemonte: 'PIE', 'Valle d’Aosta': 'VDA', Lombardia: 'LOM', 'Trentino-Alto Adige': 'TAA', Veneto: 'VEN', 'Friuli-Venezia Giulia': 'FVG', Liguria: 'LIG', 'Emilia-Romagna': 'EMR', Toscana: 'TOS', Umbria: 'UMB', Marche: 'MAR', Lazio: 'LAZ', Abruzzo: 'ABR', Molise: 'MOL', Campania: 'CAM', Puglia: 'PUG', Basilicata: 'BAS', Calabria: 'CAL', Sicilia: 'SIC', Sardegna: 'SAR' };
export const NO_DATA_COLOR = '#d7dcd9';

// ---------- which districts belong to which territory ----------
const provinceCache = new WeakMap();
// province code (ISTAT, three digits) -> { camera: Set(index), senato: Set(index) } of the districts that include a comune of the province.
export function provinceDistricts(geography) {
  if (!geography?.comuni) return new Map();
  if (provinceCache.has(geography)) return provinceCache.get(geography);
  const map = new Map();
  for (const [code, entry] of Object.entries(geography.comuni)) {
    const province = String(code).padStart(6, '0').slice(0, 3);
    const slot = map.get(province) ?? { camera: new Set(), senato: new Set() };
    for (const index of entry?.[0] ?? []) slot.camera.add(index);
    for (const index of entry?.[1] ?? []) slot.senato.add(index);
    map.set(province, slot);
  }
  provinceCache.set(geography, map);
  return map;
}

// A tally: { counts: Map(id -> n), total, close, missing, leader, tie }. `outcome(chamber, district)` -> { id, close? } or null (no result for that district).
function tallyOf(entries, outcome) {
  const counts = new Map(); let total = 0, close = 0, missing = 0;
  for (const [chamber, district] of entries) {
    const result = district ? outcome(chamber, district) : null;
    if (!result?.id) { missing++; continue; }
    total++; if (result.close) close++;
    counts.set(result.id, (counts.get(result.id) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  const tie = ranked.length > 1 && ranked[0][1] === ranked[1][1];
  return { counts, ranked, total, close, missing, leader: ranked[0] && !tie ? ranked[0][0] : null, tie };
}
// The tallies of every region (by name) and of every province (by code).
export function territoryTallies(geography, boundaries, outcome) {
  const regions = new Map(), provinces = new Map();
  if (!geography || !boundaries) return { regions, provinces };
  for (const region of boundaries.regions) {
    const entries = ['camera', 'senato'].flatMap(chamber => geography[chamber].collegi.filter(district => district.region === region.name).map(district => [chamber, district]));
    regions.set(region.code, tallyOf(entries, outcome));
  }
  const byProvince = provinceDistricts(geography);
  for (const province of boundaries.provinces) {
    const slot = byProvince.get(province.code);
    const entries = slot ? ['camera', 'senato'].flatMap(chamber => [...slot[chamber]].sort((a, b) => a - b).map(index => [chamber, geography[chamber].collegi[index]])) : [];
    provinces.set(province.code, tallyOf(entries, outcome));
  }
  return { regions, provinces };
}

// ---------- drawing ----------
const kindLabel = province => province.kind === 'Città metropolitana' ? 'Città metropolitana di' : province.kind === 'Provincia autonoma' ? 'Provincia autonoma di' : province.kind === 'Libero consorzio comunale' ? 'Libero consorzio di' : 'Provincia di';
const tallyText = (tally, label) => !tally.total ? 'nessun dato per i collegi di questo territorio' : tally.ranked.map(([id, n]) => `${label(id)} ${n}`).join(', ') + ` (su ${tally.total} collegi)`;

// map: { boundaries, geography, tallies, scope, selected, colorOf(id), labelOf(id) }
export function italyMapSvg({ boundaries, tallies, scope = 'regioni', selected = '', colorOf, labelOf }) {
  const [, , width, height] = boundaries.viewBox;
  const fill = tally => tally?.leader ? colorOf(tally.leader) : NO_DATA_COLOR;
  const territories = scope === 'province' ? boundaries.provinces.map(item => ({ key: `p:${item.code}`, name: `${kindLabel(item)} ${item.name}`, d: item.d, tally: tallies.provinces.get(item.code) })) : boundaries.regions.map(item => ({ key: `r:${item.code}`, name: item.name, d: item.d, tally: tallies.regions.get(item.code), c: item.c }));
  const paths = territories.map(item => {
    const state = item.tally?.leader ? `${labelOf(item.tally.leader)}` : item.tally?.tie ? 'pari tra più schieramenti' : 'nessun dato';
    return `<path class="it-area ${item.key === selected ? 'is-selected' : ''} ${item.tally?.tie ? 'is-tie' : ''}" d="${item.d}" fill="${esc(fill(item.tally))}" data-view-filter="mapSel" data-view-filter-value="${esc(item.key === selected ? '' : item.key)}" data-map-area="${esc(item.key)}" tabindex="0" role="button" aria-pressed="${item.key === selected}" aria-label="${esc(`${item.name}: ${state}. ${tallyText(item.tally ?? { total: 0, ranked: [] }, labelOf)}`)}"><title>${esc(`${item.name} · ${state}`)}</title></path>`;
  }).join('');
  const regionOutline = scope === 'province' ? `<g class="it-outline" fill="none" pointer-events="none">${boundaries.regions.map(item => `<path d="${item.d}"/>`).join('')}</g>` : '';
  const labels = scope === 'regioni' ? `<g class="it-labels" aria-hidden="true" pointer-events="none">${territories.map(item => `<text x="${item.c[0]}" y="${item.c[1]}">${esc(REGION_SHORT[item.name] ?? '')}</text>`).join('')}</g>` : '';
  const chosen = selected ? territories.find(item => item.key === selected) : null;
  const halo = chosen ? `<path class="it-halo" d="${chosen.d}" fill="none" pointer-events="none"/>` : '';
  return `<svg class="it-map" viewBox="0 0 ${width} ${height}" role="group" aria-label="Mappa dell’Italia per ${scope === 'province' ? 'province' : 'regioni'}, colorata per schieramento prevalente nei collegi uninominali"><g class="it-areas" fill-rule="evenodd">${paths}</g>${regionOutline}${halo}${labels}</svg>`;
}

// The card that tells everything about the area picked (tap, click or Enter): name, bloc by bloc counts, what kind of data it is.
export function italyMapInfo({ boundaries, tallies, selected, labelOf, colorOf, dataClass }) {
  const [kind, code] = String(selected ?? '').split(':');
  const region = kind === 'r' ? boundaries.regions.find(item => item.code === code) : null;
  const province = kind === 'p' ? boundaries.provinces.find(item => item.code === code) : null;
  if (!region && !province) return `<div class="it-info is-empty"><strong>Tocca o seleziona una zona</strong><p>Vedrai come sono andati i collegi uninominali della regione o della provincia, schieramento per schieramento.</p></div>`;
  const tally = region ? tallies.regions.get(region.code) : tallies.provinces.get(province.code);
  const regionOfProvince = province ? boundaries.regions.find(item => item.code === province.region) : null;
  const title = region ? region.name : `${kindLabel(province)} ${province.name}`;
  const sub = region ? 'Regione' : `${regionOfProvince?.name ?? ''}${province.sigla ? ` · ${province.sigla}` : ''}`;
  const rows = tally?.ranked?.length ? `<ul class="it-rows">${tally.ranked.map(([id, n]) => `<li><i class="nv-swatch" style="background:${esc(colorOf(id))}"></i><span>${esc(labelOf(id))}</span><b>${num(n, 0)}</b><small>${num(100 * n / tally.total, 0)}%</small></li>`).join('')}</ul>` : '<p class="sx-empty">Nessun collegio con un risultato per questo territorio.</p>';
  const verdict = tally?.leader ? `<span class="it-verdict"><i class="nv-swatch" style="background:${esc(colorOf(tally.leader))}"></i>${esc(labelOf(tally.leader))} prevale</span>` : tally?.tie ? '<span class="it-verdict">Pari tra più schieramenti</span>' : '';
  const note = region ? 'Collegi uninominali della regione (Camera e Senato).' : 'Collegi uninominali che comprendono almeno un comune della provincia: un collegio può toccare più province. Non è un risultato provinciale ufficiale.';
  return `<div class="it-info"><span class="it-class">${esc(dataClass)}</span><h4>${esc(title)}</h4><small>${esc(sub)}</small>${verdict}${rows}${tally?.close ? `<p class="sx-note">${num(tally.close, 0)} ${tally.close === 1 ? 'collegio' : 'collegi'} con margine sotto i 4 punti.</p>` : ''}${tally?.missing ? `<p class="sx-note">${num(tally.missing, 0)} ${tally.missing === 1 ? 'collegio' : 'collegi'} senza risultato nei dati.</p>` : ''}<p class="sx-note">${esc(note)}</p><button type="button" class="text-link" data-view-filter="mapSel" data-view-filter-value="">Deseleziona</button></div>`;
}

// An accessible table with the same information as the map (one row per region).
export function italyMapTable({ boundaries, tallies, labelOf, colorOf }) {
  const rows = boundaries.regions.map(region => {
    const tally = tallies.regions.get(region.code);
    const lead = tally?.leader ? `<i class="nv-swatch" style="background:${esc(colorOf(tally.leader))}"></i>${esc(labelOf(tally.leader))}` : tally?.tie ? 'Pari' : '—';
    return `<tr><th scope="row">${esc(region.name)}</th><td>${lead}</td><td>${esc(tally?.total ? tally.ranked.map(([id, n]) => `${labelOf(id)} ${n}`).join(' · ') : 'nessun dato')}</td></tr>`;
  }).join('');
  return `<details class="it-table"><summary>Tabella per regione</summary><div class="sx-table-wrap"><table class="sx-table"><thead><tr><th scope="col">Regione</th><th scope="col">Prevale</th><th scope="col">Collegi vinti</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}
