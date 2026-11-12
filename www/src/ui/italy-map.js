// The geographic map of the national elections: Italy drawn with the real boundaries of regions and provinces (ISTAT, simplified: src/data/real/italy-boundaries.json), coloured by the bloc that wins
// most single-member districts there. It sits beside the squares map of the districts, which stays as it is.
// What is real and what is not: the boundaries and the winners of 2022 are real data (ISTAT, Eligendo); the projection and the vote of the game are simulation, and the card says which one is on the screen.
// A region is read from the districts that belong to it (the districts are inside the regions). A province is NOT: the single-member districts do not follow the provinces and the official votes are not
// published by comune in the data of the game, so no winner of the province exists. The province is read with a descriptive indicator: each comune of the province counts once (shared out between the
// districts a big comune is split into) and goes to the bloc that won the district; the colour is the bloc whose districts cover most comuni of the province. A district that touches several
// provinces is therefore never given in full to each of them. The indicator is labelled as such on the map, in the legend, in the tooltip and in the panel. No boundary and no winner is invented:
// where there is no district there is no colour.
import { esc, num } from './sections-kit.js?v=20261112-3';
import { toneEdge } from '../data/party-brand.js?v=20261112-3';

export const MAP_SCOPES = Object.freeze([['regioni', 'Regioni'], ['province', 'Province']]);
const REGION_SHORT = { Piemonte: 'PIE', 'Valle d’Aosta': 'VDA', Lombardia: 'LOM', 'Trentino-Alto Adige': 'TAA', Veneto: 'VEN', 'Friuli-Venezia Giulia': 'FVG', Liguria: 'LIG', 'Emilia-Romagna': 'EMR', Toscana: 'TOS', Umbria: 'UMB', Marche: 'MAR', Lazio: 'LAZ', Abruzzo: 'ABR', Molise: 'MOL', Campania: 'CAM', Puglia: 'PUG', Basilicata: 'BAS', Calabria: 'CAL', Sicilia: 'SIC', Sardegna: 'SAR' };
export const NO_DATA_COLOR = '#d7dcd9';
// The reading «where is this party?» (a party picked in the filter): the colour of the party, paler where it holds a smaller part of the territory; a dark slate where it holds nothing (absent); the pale
// grey of «no data» where no district has a result. The four states are never one colour.
export const ABSENT_COLOR = '#2e3733';
export const PRESENCE_NOTE = 'Presenza del partito: per le regioni, la quota dei collegi uninominali (Camera e Senato) vinti dal partito; per le province, la quota dei comuni che cadono in collegi vinti dal partito (indicatore descrittivo, non un risultato). Colore pieno = il partito prevale (oltre metà); colore più chiaro = presenza parziale; grigio scuro = assente (0%); grigio chiaro = nessun dato. Un partito con zero collegi uninominali può avere seggi proporzionali: questa mappa non li mostra.';
const shareOf = (tally, party) => tally?.total > 0 ? (tally.counts.get(party) ?? 0) / tally.total : null;
const presenceFill = (tally, party, color) => {
  const share = shareOf(tally, party);
  if (share === null) return { fill: NO_DATA_COLOR, state: 'nodata', opacity: 1, share };
  if (share <= 1e-9) return { fill: ABSENT_COLOR, state: 'absent', opacity: 1, share: 0 };
  return { fill: color, state: share > 0.5 ? 'prevails' : 'partial', opacity: Math.round((0.32 + 0.68 * share) * 100) / 100, share };
};
const presenceWords = (share, isProvince) => share === null ? 'nessun dato' : share <= 1e-9 ? 'partito assente' : `presenza ${Math.round(share * 100)}% ${isProvince ? 'dei comuni' : 'dei collegi'}`;

// ---------- which districts belong to which territory ----------
const provinceCache = new WeakMap();
// province code (ISTAT, three digits) -> { camera: Map(districtIndex -> weight), senato: Map(...) }: the comuni of the province, each one counted once per chamber (a comune split between several
// districts shares its unit between them), by the district they belong to.
export function provinceDistricts(geography) {
  if (!geography?.comuni) return new Map();
  if (provinceCache.has(geography)) return provinceCache.get(geography);
  const map = new Map();
  for (const [code, entry] of Object.entries(geography.comuni)) {
    const province = String(code).padStart(6, '0').slice(0, 3);
    const slot = map.get(province) ?? { camera: new Map(), senato: new Map(), comuni: 0 };
    slot.comuni++;
    for (const [chamber, list] of [['camera', entry?.[0] ?? []], ['senato', entry?.[1] ?? []]]) for (const index of list) slot[chamber].set(index, (slot[chamber].get(index) ?? 0) + 1 / list.length);
    map.set(province, slot);
  }
  provinceCache.set(geography, map);
  return map;
}

// A tally: { counts: Map(id -> weight), total, close, missing, leader, tie }. entries: [chamber, district, weight]. `outcome(chamber, district)` -> { id, close? } or null (no result for that district).
function tallyOf(entries, outcome) {
  const counts = new Map(); let total = 0, close = 0, missing = 0;
  for (const [chamber, district, weight = 1] of entries) {
    const result = district ? outcome(chamber, district) : null;
    if (!result?.id) { missing += weight; continue; }
    total += weight; if (result.close) close += weight;
    counts.set(result.id, (counts.get(result.id) ?? 0) + weight);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  const tie = ranked.length > 1 && Math.abs(ranked[0][1] - ranked[1][1]) < 1e-9;
  return { counts, ranked, total, close, missing, leader: ranked[0] && !tie ? ranked[0][0] : null, tie };
}
// The tallies of every region (by code, districts of the region) and of every province (by code, the indicator by comuni described above).
export function territoryTallies(geography, boundaries, outcome) {
  const regions = new Map(), provinces = new Map();
  if (!geography || !boundaries) return { regions, provinces };
  for (const region of boundaries.regions) {
    const entries = ['camera', 'senato'].flatMap(chamber => geography[chamber].collegi.filter(district => district.region === region.name).map(district => [chamber, district, 1]));
    regions.set(region.code, tallyOf(entries, outcome));
  }
  const byProvince = provinceDistricts(geography);
  for (const province of boundaries.provinces) {
    const slot = byProvince.get(province.code);
    // each chamber weighs the same (half of the comuni each), so that the Chamber and the Senate do not count twice what they say once
    const entries = slot ? ['camera', 'senato'].flatMap(chamber => [...slot[chamber].entries()].sort((a, b) => a[0] - b[0]).map(([index, weight]) => [chamber, geography[chamber].collegi[index], weight / 2])) : [];
    provinces.set(province.code, tallyOf(entries, outcome));
  }
  return { regions, provinces };
}

// ---------- drawing ----------
const kindLabel = province => province.kind === 'Città metropolitana' ? 'Città metropolitana di' : province.kind === 'Provincia autonoma' ? 'Provincia autonoma di' : province.kind === 'Libero consorzio comunale' ? 'Libero consorzio di' : 'Provincia di';
const pct = (part, whole) => whole > 0 ? Math.round(100 * part / whole) : 0;
// The text of a tally: regions count districts, provinces say which share of their comuni sits in districts won by each bloc (an indicator, not a result of the province).
const tallyText = (tally, label, isProvince) => !tally.total ? 'nessun dato per i collegi di questo territorio' : isProvince
  ? `indicatore descrittivo, non risultato provinciale: ${tally.ranked.map(([id, n]) => `${pct(n, tally.total)}% dei comuni in collegi vinti da ${label(id)}`).join(', ')}`
  : tally.ranked.map(([id, n]) => `${label(id)} ${num(n, 0)}`).join(', ') + ` (su ${num(tally.total, 0)} collegi)`;
export const PROVINCE_INDICATOR_NOTE = 'Indicatore descrittivo: per ogni provincia, la quota dei suoi comuni che cadono in collegi uninominali vinti da ciascuno schieramento (ogni comune conta una volta). I collegi non seguono le province e i voti ufficiali per comune non sono nei dati: non è il vincitore né un risultato ufficiale della provincia.';

// map: { boundaries, tallies, scope, selected, colorOf(id), labelOf(id) }
export function italyMapSvg({ boundaries, tallies, scope = 'regioni', selected = '', colorOf, labelOf, presence = null }) {
  const [, , width, height] = boundaries.viewBox;
  const isProvince = scope === 'province';
  const fill = tally => tally?.leader ? colorOf(tally.leader) : NO_DATA_COLOR;
  const territories = isProvince ? boundaries.provinces.map(item => ({ key: `p:${item.code}`, name: `${kindLabel(item)} ${item.name}`, d: item.d, tally: tallies.provinces.get(item.code) })) : boundaries.regions.map(item => ({ key: `r:${item.code}`, name: item.name, d: item.d, tally: tallies.regions.get(item.code), c: item.c }));
  // a selection that belongs to the other level (a province while the regions are shown, or the reverse) is not a selection of this map
  const current = selected && selected.startsWith(isProvince ? 'p:' : 'r:') ? selected : '';
  const paths = territories.map(item => {
    if (presence) {
      const view = presenceFill(item.tally, presence, colorOf(presence));
      const text = presenceWords(view.share, isProvince);
      const edge = toneEdge(view.fill);
      return `<path class="it-area ${item.key === current ? 'is-selected' : ''} is-presence is-${view.state}${edge ? ` edge-${edge}` : ''} ${isProvince ? 'is-indicator' : ''}" d="${item.d}" fill="${esc(view.fill)}" fill-opacity="${view.opacity}" data-view-filter="mapSel" data-view-filter-value="${esc(item.key === current ? '' : item.key)}" data-map-area="${esc(item.key)}" data-presence="${view.state}" tabindex="0" role="button" aria-pressed="${item.key === current}" aria-label="${esc(`${item.name}: ${labelOf(presence)}, ${text}`)}"><title>${esc(`${item.name} · ${labelOf(presence)}: ${text}`)}</title></path>`;
    }
    const state = item.tally?.leader ? (isProvince ? `${labelOf(item.tally.leader)} (indicatore sui comuni)` : `${labelOf(item.tally.leader)}`) : item.tally?.tie ? 'pari tra più schieramenti' : 'nessun dato';
    const tone = toneEdge(fill(item.tally));
    return `<path class="it-area ${item.key === current ? 'is-selected' : ''} ${item.tally?.tie ? 'is-tie' : ''} ${isProvince ? 'is-indicator' : ''}${tone ? ` edge-${tone}` : ''}" d="${item.d}" fill="${esc(fill(item.tally))}" data-view-filter="mapSel" data-view-filter-value="${esc(item.key === current ? '' : item.key)}" data-map-area="${esc(item.key)}" tabindex="0" role="button" aria-pressed="${item.key === current}" aria-label="${esc(`${item.name}: ${state}. ${tallyText(item.tally ?? { total: 0, ranked: [] }, labelOf, isProvince)}`)}"><title>${esc(`${item.name} · ${state}`)}</title></path>`;
  }).join('');
  const regionOutline = isProvince ? `<g class="it-outline" fill="none" pointer-events="none">${boundaries.regions.map(item => `<path d="${item.d}"/>`).join('')}</g>` : '';
  const labels = !isProvince ? `<g class="it-labels" aria-hidden="true" pointer-events="none">${territories.map(item => `<text x="${item.c[0]}" y="${item.c[1]}">${esc(REGION_SHORT[item.name] ?? '')}</text>`).join('')}</g>` : '';
  const chosen = current ? territories.find(item => item.key === current) : null;
  const halo = chosen ? `<path class="it-halo" d="${chosen.d}" fill="none" pointer-events="none"/>` : '';
  return `<svg class="it-map" viewBox="0 0 ${width} ${height}" role="group" aria-label="${presence ? `Mappa dell’Italia: presenza di ${labelOf(presence)}, ${isProvince ? 'per province (indicatore sui comuni)' : 'per regioni'}` : isProvince ? 'Mappa dell’Italia per province: indicatore descrittivo sui comuni, non il risultato delle province' : 'Mappa dell’Italia per regioni, colorata per schieramento prevalente nei collegi uninominali'}"><g class="it-areas" fill-rule="evenodd">${paths}</g>${regionOutline}${halo}${labels}</svg>`;
}

// The card that tells everything about the area picked (tap, click or Enter): name, bloc by bloc counts, what kind of data it is.
export function italyMapInfo({ boundaries, tallies, selected, labelOf, colorOf, dataClass, scope = null, presence = null }) {
  const [kind, code] = String(selected ?? '').split(':');
  // a selection of the other level than the one shown is ignored (no stale panel)
  const stale = scope && ((scope === 'province') !== (kind === 'p'));
  const region = !stale && kind === 'r' ? boundaries.regions.find(item => item.code === code) : null;
  const province = !stale && kind === 'p' ? boundaries.provinces.find(item => item.code === code) : null;
  if (!region && !province) return `<div class="it-info is-empty"><strong>Tocca o seleziona una zona</strong><p>${scope === 'province' ? 'Vedrai quanta parte dei comuni della provincia ricade in collegi vinti da ciascuno schieramento.' : 'Vedrai come sono andati i collegi uninominali della regione, schieramento per schieramento.'}</p></div>`;
  const tally = region ? tallies.regions.get(region.code) : tallies.provinces.get(province.code);
  const regionOfProvince = province ? boundaries.regions.find(item => item.code === province.region) : null;
  const title = region ? region.name : `${kindLabel(province)} ${province.name}`;
  const sub = region ? 'Regione' : `${regionOfProvince?.name ?? ''}${province.sigla ? ` · ${province.sigla}` : ''}`;
  const unit = region ? n => num(n, 0) : n => `${pct(n, tally.total)}%`;
  const rows = tally?.ranked?.length ? `<ul class="it-rows">${tally.ranked.map(([id, n]) => `<li><i class="nv-swatch" style="background:${esc(colorOf(id))}"></i><span>${esc(labelOf(id))}</span><b>${unit(n)}</b><small>${region ? `${num(100 * n / tally.total, 0)}%` : 'dei comuni'}</small></li>`).join('')}</ul>` : '<p class="sx-empty">Nessun collegio con un risultato per questo territorio.</p>';
  const share = presence ? shareOf(tally, presence) : null;
  const verdict = presence ? `<span class="it-verdict"><i class="nv-swatch${toneEdge(colorOf(presence)) ? ` edge-${toneEdge(colorOf(presence))}` : ''}" style="background:${esc(colorOf(presence))}"></i>${esc(labelOf(presence))}: ${esc(presenceWords(share, Boolean(province)))}</span>` : tally?.leader ? `<span class="it-verdict"><i class="nv-swatch" style="background:${esc(colorOf(tally.leader))}"></i>${region ? `${esc(labelOf(tally.leader))} prevale` : `Indicatore: più comuni in collegi vinti da ${esc(labelOf(tally.leader))}`}</span>` : tally?.tie ? '<span class="it-verdict">Pari tra più schieramenti</span>' : '';
  const note = presence ? PRESENCE_NOTE : region ? 'Collegi uninominali della regione (Camera e Senato).' : PROVINCE_INDICATOR_NOTE;
  const closeNote = region && tally?.close ? `<p class="sx-note">${num(tally.close, 0)} ${tally.close === 1 ? 'collegio' : 'collegi'} con margine sotto i 4 punti.</p>` : '';
  const missingNote = tally?.missing > 0.5 ? `<p class="sx-note">${region ? `${num(tally.missing, 0)} ${tally.missing === 1 ? 'collegio' : 'collegi'} senza risultato nei dati.` : `${pct(tally.missing, tally.missing + tally.total)}% dei comuni è in collegi senza risultato nei dati (non colorati).`}</p>` : '';
  return `<div class="it-info"><span class="it-class">${esc(dataClass)}</span><h4>${esc(title)}</h4><small>${esc(sub)}</small>${verdict}${rows}${closeNote}${missingNote}<p class="sx-note">${esc(note)}</p><button type="button" class="text-link" data-view-filter="mapSel" data-view-filter-value="">Deseleziona</button></div>`;
}

// An accessible table with the same information as the map (one row per region).
// The table for those who do not use the map: the rows follow the level that is shown. Regions: 20 rows, the winner of the single-member districts they hold. Provinces: 110 rows with the DESCRIPTIVE indicator
// (not a winner: see PROVINCE_INDICATOR_NOTE), with the region of each province.
export function italyMapTable({ boundaries, tallies, labelOf, colorOf, scope = 'regioni', presence = null }) {
  const provinceLevel = scope === 'province';
  const list = provinceLevel ? boundaries.provinces : boundaries.regions;
  const regionName = new Map(boundaries.regions.map(region => [region.code, region.name]));
  const rows = list.map(item => {
    const tally = (provinceLevel ? tallies.provinces : tallies.regions).get(item.code);
    const lead = presence ? esc(presenceWords(shareOf(tally, presence), provinceLevel)) : tally?.leader ? `<i class="nv-swatch" style="background:${esc(colorOf(tally.leader))}"></i>${esc(labelOf(tally.leader))}` : tally?.tie ? 'Pari' : '—';
    const detail = esc(tally?.total ? tally.ranked.map(([id, n]) => `${labelOf(id)} ${num(n, provinceLevel ? 1 : 0)}`).join(' · ') : 'nessun dato');
    return provinceLevel
      ? `<tr><th scope="row">${esc(item.name)}</th><td>${esc(regionName.get(item.region) ?? item.region ?? '')}</td><td>${lead}</td><td>${detail}</td></tr>`
      : `<tr><th scope="row">${esc(item.name)}</th><td>${lead}</td><td>${detail}</td></tr>`;
  }).join('');
  const head = provinceLevel
    ? `<th scope="col">Provincia</th><th scope="col">Regione</th><th scope="col">${presence ? 'Presenza del partito' : 'Indicatore prevalente'}</th><th scope="col">Peso dei collegi</th>`
    : `<th scope="col">Regione</th><th scope="col">${presence ? 'Presenza del partito' : 'Prevale'}</th><th scope="col">Collegi vinti</th>`;
  return `<details class="it-table" data-map-table="${provinceLevel ? 'province' : 'regioni'}"><summary>${provinceLevel ? 'Tabella per provincia' : 'Tabella per regione'}</summary><div class="sx-table-wrap"><table class="sx-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></details>`;
}
