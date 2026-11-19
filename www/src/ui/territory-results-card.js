// "Risultati per territorio": the last simulated vote of the player's game read by Region, Province and Comune (core/territory-results.js). Everything here is SIMULATED and says so: the votes of every list
// in the country are shared down the ISTAT hierarchy in proportion to the inhabitants, with the regional lean of the model and a small local deviation, and every level adds up to the one above. The only official
// figures are the national ones of 2022 and the winners of the uninominal colleges by Region (the map above): the page never shows an official figure for a Province or a Comune.
import { districtRows, nationalElectorate } from '../core/legislature-engine.js?v=20261119-6';
import { municipalPopulationIndex } from '../core/municipal-rules.js?v=20261119-6';
import { addsUp, buildHierarchy, territoryBreakdown } from '../core/territory-results.js?v=20261119-6';
import { card, esc, num, pct } from './sections-kit.js?v=20261119-6';

const MAX_COMUNI = 40;
export const OTHERS = 'altri';
let cache = null;
function hierarchyOf(municipalities) {
  const index = municipalPopulationIndex();
  if (!index?.regions?.length) return null;
  if (cache?.index === index && cache.municipalities === municipalities) return cache.value;
  const value = buildHierarchy(index, municipalities ?? []);
  cache = { index, municipalities, value };
  return value;
}
// The regional lean from the district rows of the vote: how much more (or less) every list weighs in a Region than in the country (clamped, only for the lists the districts record).
export function regionalLean(rows, districts) {
  const national = {}, byRegion = {};
  let nationalValid = 0;
  const regionValid = {};
  rows.forEach((row, index) => {
    const district = districts[index];
    if (!district || !(district.valid > 0)) return;
    nationalValid += district.valid; regionValid[district.region] = (regionValid[district.region] ?? 0) + district.valid;
    for (const [id, value] of row.t ?? []) {
      if (id == null) continue;
      const votes = value * district.valid / 100;
      national[id] = (national[id] ?? 0) + votes;
      (byRegion[district.region] ??= {})[id] = (byRegion[district.region][id] ?? 0) + votes;
    }
  });
  const lean = {};
  for (const [region, shares] of Object.entries(byRegion)) for (const [id, votes] of Object.entries(shares)) {
    const base = national[id] / (nationalValid || 1);
    if (!(base > 0.005)) continue;
    (lean[region] ??= {})[id] = Math.min(2.5, Math.max(0.4, (votes / regionValid[region]) / base));
  }
  return lean;
}

// The inputs of the breakdown from a simulated vote: the votes of every list in the country (the valid ballots of the electorate of the map shared by the shares of the vote, «Altri» for what the result does not name)
// and the regional lean from the districts of the vote.
export function territoryInputs(last, geography) {
  const electorate = nationalElectorate(geography, last.turnout);
  const valid = electorate.valid ?? 0;
  const rows = (last.national ?? []).filter(row => row.share > 0);
  const rest = Math.max(0, 100 - rows.reduce((sum, row) => sum + row.share, 0));
  const totals = Object.fromEntries([...rows.map(row => [row.id, Math.round(row.share * valid / 100)]), ...(rest >= 0.05 ? [[OTHERS, Math.round(rest * valid / 100)]] : [])]);
  const districts = geography?.camera?.collegi ?? [];
  const lean = regionalLean(districtRows(last, 'camera', geography), Array.isArray(districts) ? districts : []);
  return { totals, lean, valid };
}
export const hierarchyFor = hierarchyOf;

export function territoryResultsCard({ overview, last, geography, terr = '', municipalities = [], swatch, colorOf, labelOf }) {
  const head = { fold: { id: 'nv-territorio', icon: 'map', start: 'closed' }, kicker: 'RISULTATI PER TERRITORIO · SIMULATO' };
  const hierarchy = hierarchyOf(municipalities);
  if (!last || !hierarchy) return card({ ...head, title: 'Regioni, province e comuni', body: `<p class="sx-empty" role="status" data-territory-state="missing">${last ? 'I dati ISTAT dei comuni non sono ancora caricati: riapri la pagina tra un momento.' : 'Il risultato per territorio compare dopo il primo voto politico della partita.'}</p>` });
  const { totals, lean } = territoryInputs(last, geography);
  const [regionCode = '', provinceCode = ''] = String(terr ?? '').split('|');
  const breakdown = territoryBreakdown({ totals, hierarchy, seed: `${last.id ?? last.date}|territorio`, regionLean: lean, regionCode: regionCode || null, provinceCode: provinceCode || null });
  const level = breakdown.level;
  const checks = addsUp(breakdown);
  const shown = level === 'provincia' ? [...breakdown.rows].sort((a, b) => b.population - a.population).slice(0, MAX_COMUNI) : breakdown.rows;
  const top = row => Object.entries(row.votes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, votes]) => ({ id, share: row.valid ? votes * 100 / row.valid : 0 }));
  const crumbs = [['', 'Italia'], breakdown.region ? [breakdown.region.code, breakdown.region.name] : null, breakdown.province ? [`${breakdown.region.code}|${breakdown.province.code}`, breakdown.province.name] : null].filter(Boolean);
  const nav = `<nav class="nv-crumbs" aria-label="Livello territoriale">${crumbs.map(([value, text], index) => index === crumbs.length - 1 ? `<span aria-current="page"><strong>${esc(text)}</strong></span>` : `<button type="button" data-view-filter="terr" data-view-filter-value="${esc(value)}">${esc(text)}</button>`).join('<span aria-hidden="true"> › </span>')}</nav>`;
  const word = { italia: 'Regioni', regione: 'Province', provincia: 'Comuni' }[level];
  const items = shown.map(row => {
    const lead = top(row);
    const next = row.kind === 'regione' ? row.code : row.kind === 'provincia' ? `${breakdown.region.code}|${row.code}` : '';
    const name = next ? `<button type="button" class="link-button" data-view-filter="terr" data-view-filter-value="${esc(next)}" data-territory-open="${esc(row.code)}">${esc(row.name)}</button>` : esc(row.name);
    const leaders = lead.map(item => `<span class="nv-lead">${swatch(colorOf(item.id))}<span>${esc(item.id === OTHERS ? 'Altri partiti' : labelOf(item.id))}</span> <b>${pct(item.share)}</b></span>`).join(' ');
    return { name: `<strong>${name}</strong>`, population: num(row.population, 0), valid: num(row.valid, 0), leaders };
  });
  const rowsHtml = items.map(item => `<tr data-territory-row><th scope="row" data-label="${esc(word)}">${item.name}</th><td class="num" data-label="Abitanti">${item.population}</td><td class="num" data-label="Voti simulati">${item.valid}</td><td data-label="Prime liste">${item.leaders}</td></tr>`).join('');
  const table = `<div class="sx-table-wrap"><table class="sx-table" data-territory-table="${level}"><thead><tr><th scope="col">${esc(word)}</th><th scope="col" class="num">Abitanti</th><th scope="col" class="num">Voti simulati</th><th scope="col">Prime liste</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  const parent = breakdown.province ?? breakdown.region ?? breakdown.italy;
  const part = level === 'provincia' && breakdown.rows.length > shown.length ? ` I ${num(shown.length, 0)} comuni più popolosi su ${num(breakdown.rows.length, 0)}.` : '';
  const what = level === 'italia' ? 'le regioni sommano l’Italia' : level === 'regione' ? `le province sommano la regione ${parent.name}` : `i comuni sommano la provincia ${parent.name}`;
  const sum = `<p class="sx-note" data-territory-sum>${checks ? 'Somma controllata' : 'Somma da verificare'}: ${what}, lista per lista (${num(parent.valid, 0)} voti validi simulati).${part}</p>`;
  const source = `<p class="sx-note" data-territory-source>Dato simulato: i voti di lista del voto nazionale della partita, ripartiti per abitanti (ISTAT, 1 gennaio 2026) con lo scarto regionale del modello e una piccola variazione locale. Non è un dato ufficiale. I dati reali delle politiche 2022 esistono per collegio: sono nella mappa qui sopra («Vincitori 2022»), non per provincia né per comune.</p>`;
  const title = level === 'italia' ? 'Come è andato il voto nelle regioni' : level === 'regione' ? `Le province: ${breakdown.region.name}` : `I comuni: ${breakdown.province.name}`;
  return card({ ...head, title, body: `${nav}${table}${sum}${source}<p><button type="button" class="secondary-button" data-nav="risultati" data-territory-fullpage>Apri la pagina completa: ricerca dei comuni, filtri e confronto</button></p>` });
}
