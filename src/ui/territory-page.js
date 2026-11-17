// The page «Risultati per territorio»: the last simulated general election of the game read by Region, Province and Comune, with search, filters, pages and a comparison between consultations. It never loads
// all the 7,894 comuni at once: the hierarchy holds only names and inhabitants, and the votes of the comuni are drawn for ONE province at a time (core/territory-results.js), always adding up to the level above.
// What is shown is SIMULATED and says so; the only official data are the real 2022 results by Region (the map of the national page) and what the sources document.
import { addsUp, territoryBreakdown } from '../core/territory-results.js?v=20261117-3';
import { OTHERS, hierarchyFor, territoryInputs } from './territory-results-card.js?v=20261117-3';
import { badge, card, empty, esc, num, pct } from './sections-kit.js?v=20261117-3';
import { formatDate } from '../core/time.js?v=20261117-3';
import { territoryPaint } from './national-view.js?v=20261117-3';

export const PAGE_SIZE = 25;
const SORTS = [['popolazione', 'più abitanti'], ['nome', 'ordine alfabetico'], ['voti', 'più voti simulati']];
const norm = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Search among all the comuni by name (accents and case ignored); a short query gives nothing, a long list is cut: nothing is rendered for the whole country.
export function searchComuni(hierarchy, query, { limit = 20 } = {}) {
  const q = norm(query);
  if (q.length < 2) return { items: [], total: 0 };
  const items = [];
  let total = 0;
  for (const region of hierarchy) for (const province of region.provinces) for (const comune of province.comuni) {
    const name = norm(comune.name);
    if (name.startsWith(q) || name.includes(q)) { total++; if (items.length < limit * 4) items.push({ region, province, comune, starts: name.startsWith(q) }); }
  }
  items.sort((a, b) => Number(b.starts) - Number(a.starts) || b.comune.population - a.comune.population);
  return { items: items.slice(0, limit), total };
}
const topOf = (row, count = 3) => Object.entries(row.votes).sort((a, b) => b[1] - a[1]).slice(0, count).map(([id, votes]) => ({ id, share: row.valid ? votes * 100 / row.valid : 0 }));

function statusCard(last, geography) {
  const real = geography?.loaded ? `${badge('DATO REALE', 'good')} Politiche del ${esc(formatDate(geography.electionDate))} (2022): i risultati ufficiali sono per collegio e per Regione, mai per Provincia o Comune.` : '';
  const sim = last ? `${badge('RISULTATO SIMULATO', 'warn')} Voto politico del ${esc(formatDate(last.date))} della tua partita: i voti di lista nazionali ripartiti per abitanti con lo scarto regionale del modello.` : `${badge('NESSUN VOTO', 'neutral')} In questa partita non c’è ancora un voto politico simulato: i numeri compaiono dopo le elezioni.`;
  const poll = `${badge('SONDAGGIO / PROIEZIONE', 'neutral')} Le stime prima del voto (pagina «Sondaggi» e mappa della centrale elettorale) non sono risultati: sono una fotografia che cambia ogni settimana.`;
  return card({ kicker: 'COSA STAI GUARDANDO', title: 'Dati reali, simulati e stime', body: `<ul class="tp-status" data-territory-status><li>${sim}</li><li>${real || `${badge('DATO REALE', 'good')} I dati reali del 2022 sono per collegio e Regione.`}</li><li>${poll}</li></ul>` });
}
function controls({ hierarchy, regionCode, provinceCode, q, sort }) {
  const regions = hierarchy.map(region => `<option value="${esc(region.code)}"${region.code === regionCode ? ' selected' : ''}>${esc(region.name)}</option>`).join('');
  const region = hierarchy.find(item => item.code === regionCode);
  const provinces = region ? region.provinces.map(item => `<option value="${esc(item.code)}"${item.code === provinceCode ? ' selected' : ''}>${esc(item.name)}</option>`).join('') : '';
  return `<form class="tp-controls" data-territory-form role="search">
    <label class="tp-search">Cerca un comune<input type="search" name="q" value="${esc(q)}" placeholder="Nome del comune (almeno 2 lettere)" autocomplete="off" data-territory-search></label>
    <label>Regione<select name="region" data-territory-region><option value="">Tutta Italia</option>${regions}</select></label>
    <label>Provincia<select name="province" data-territory-province${region ? '' : ' disabled'}><option value="">Tutte</option>${provinces}</select></label>
    <label>Ordina per<select name="sort" data-territory-sort>${SORTS.map(([id, label]) => `<option value="${id}"${id === sort ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
    <button type="submit" class="primary-button">Cerca</button><button type="button" class="secondary-button" data-territory-reset>Azzera</button></form>`;
}
function searchResults(found, q) {
  if (!q || norm(q).length < 2) return '';
  if (!found.total) return `<p class="sx-empty" role="status" data-territory-nomatch>Nessun comune corrisponde a «${esc(q)}».</p>`;
  const items = found.items.map(item => `<li><button type="button" class="link-button" data-view-filter="terr" data-view-filter-value="${esc(`${item.region.code}|${item.province.code}`)}" data-view-filter-also="terrPage=${esc(String(1))}" data-territory-hit="${esc(item.comune.code)}">${esc(item.comune.name)}</button> <small>${esc(item.province.name)} · ${esc(item.region.name)} · ${num(item.comune.population, 0)} ab.</small></li>`).join('');
  return `<div class="tp-hits" data-territory-hits><p class="quiet-copy">${num(found.total, 0)} ${found.total === 1 ? 'comune trovato' : 'comuni trovati'}${found.total > found.items.length ? ` (i primi ${found.items.length}: affina la ricerca)` : ''}. Scegli per aprire la sua provincia.</p><ul>${items}</ul></div>`;
}
const crumbs = (breakdown) => {
  const list = [['', 'Italia'], breakdown.region ? [breakdown.region.code, breakdown.region.name] : null, breakdown.province ? [`${breakdown.region.code}|${breakdown.province.code}`, breakdown.province.name] : null].filter(Boolean);
  return `<nav class="nv-crumbs" aria-label="Livello territoriale">${list.map(([value, text], index) => index === list.length - 1 ? `<span aria-current="page"><strong>${esc(text)}</strong></span>` : `<button type="button" data-view-filter="terr" data-view-filter-value="${esc(value)}" data-view-filter-also="terrPage=1">${esc(text)}</button>`).join(' › ')}</nav>`;
};
function summaryCard(breakdown, ctx) {
  const parent = breakdown.province ?? breakdown.region ?? breakdown.italy;
  const lead = topOf(parent, 5);
  const bars = lead.map(item => `<li><span class="nv-lead">${ctx.swatch(ctx.colorOf(item.id))}<span>${esc(item.id === OTHERS ? 'Altri partiti' : ctx.labelOf(item.id))}</span></span><span class="tp-bar" role="img" aria-label="${esc(pct(item.share))}"><i style="width:${Math.min(100, item.share * 2)}%;background:${esc(ctx.colorOf(item.id))}"></i></span><b>${pct(item.share)}</b></li>`).join('');
  return card({ kicker: 'SINTESI', title: parent.name, body: `<div class="sx-kpis tp-kpis"><div class="sx-kpi"><small>Abitanti</small><strong>${num(parent.population, 0)}</strong></div><div class="sx-kpi"><small>Voti validi simulati</small><strong>${num(parent.valid, 0)}</strong></div><div class="sx-kpi"><small>${breakdown.level === 'provincia' ? 'Comuni' : breakdown.level === 'regione' ? 'Province' : 'Regioni'}</small><strong>${num(breakdown.rows.length, 0)}</strong></div></div><ul class="tp-leads" data-territory-summary>${bars}</ul>` });
}
function tableCard(breakdown, ctx, { page, sort }) {
  const level = breakdown.level;
  const columns = ['regione', 'provincia'].includes(breakdown.rows[0]?.kind) || true ? ctx.columns : [];
  const sorted = [...breakdown.rows].sort(sort === 'nome' ? (a, b) => a.name.localeCompare(b.name, 'it') : sort === 'voti' ? (a, b) => b.valid - a.valid : (a, b) => b.population - a.population);
  const pages = level === 'provincia' ? Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)) : 1;
  const at = Math.min(page, pages);
  const shown = level === 'provincia' ? sorted.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE) : sorted;
  const word = { italia: 'Regione', regione: 'Provincia', provincia: 'Comune' }[level];
  const head = columns.map(id => `<th scope="col" class="num">${esc(id === OTHERS ? 'Altri' : ctx.labelOf(id))}</th>`).join('');
  const body = shown.map(row => {
    const next = row.kind === 'regione' ? row.code : row.kind === 'provincia' ? `${breakdown.region.code}|${row.code}` : '';
    const name = next ? `<button type="button" class="link-button" data-view-filter="terr" data-view-filter-value="${esc(next)}" data-view-filter-also="terrPage=1" data-territory-open="${esc(row.code)}">${esc(row.name)}</button>` : esc(row.name);
    const cells = columns.map(id => `<td class="num" data-label="${esc(id === OTHERS ? 'Altri' : ctx.labelOf(id))}">${pct(row.valid ? (row.votes[id] ?? 0) * 100 / row.valid : 0)}</td>`).join('');
    return `<tr data-territory-row><th scope="row" data-label="${esc(word)}"><strong>${name}</strong></th><td class="num" data-label="Abitanti">${num(row.population, 0)}</td><td class="num" data-label="Voti simulati">${num(row.valid, 0)}</td>${cells}</tr>`;
  }).join('');
  const pager = pages > 1 ? `<nav class="tp-pager" aria-label="Pagine dei comuni" data-territory-pager><button type="button" class="secondary-button compact" data-view-filter="terrPage" data-view-filter-value="${at - 1}"${at <= 1 ? ' disabled' : ''}>Precedenti</button><span>Pagina ${num(at, 0)} di ${num(pages, 0)} · ${num((at - 1) * PAGE_SIZE + 1, 0)}–${num(Math.min(sorted.length, at * PAGE_SIZE), 0)} di ${num(sorted.length, 0)} comuni</span><button type="button" class="secondary-button compact" data-view-filter="terrPage" data-view-filter-value="${at + 1}"${at >= pages ? ' disabled' : ''}>Successivi</button></nav>` : '';
  const parent = breakdown.province ?? breakdown.region ?? breakdown.italy;
  const checks = addsUp(breakdown);
  const what = level === 'italia' ? 'le regioni sommano l’Italia' : level === 'regione' ? `le province sommano la regione ${parent.name}` : `i comuni sommano la provincia ${parent.name}`;
  return card({ kicker: level === 'italia' ? 'REGIONI' : level === 'regione' ? 'PROVINCE' : 'COMUNI', title: level === 'provincia' ? `I comuni: ${breakdown.province.name}` : level === 'regione' ? `Le province: ${breakdown.region.name}` : 'Come è andato il voto nelle regioni', body: `<div class="sx-table-wrap"><table class="sx-table tp-table" data-territory-table="${level}" data-territory-page="${at}"><thead><tr><th scope="col">${esc(word)}</th><th scope="col" class="num">Abitanti</th><th scope="col" class="num">Voti simulati</th>${head}</tr></thead><tbody>${body}</tbody></table></div>${pager}<p class="sx-note" data-territory-sum>${checks ? 'Somma controllata' : 'Somma da verificare'}: ${what}, lista per lista (${num(parent.valid, 0)} voti validi simulati).</p>` });
}
// The comparison between two consultations of the game on the national lists: their shares and the difference, only for the lists both have.
function comparisonCard(votes, selected) {
  const list = (votes ?? []).filter(item => item.lists?.length);
  if (list.length < 2) return card({ kicker: 'CONFRONTO TRA CONSULTAZIONI', title: 'Serve più di un voto', body: '<p class="sx-empty" data-territory-compare="none">Il confronto compare quando la partita ha almeno due voti nazionali (politiche o europee).</p>' });
  const [a = list.length - 2, b = list.length - 1] = String(selected ?? '').split('|').map(Number).filter(Number.isFinite);
  const first = list[Math.min(a, b)] ?? list.at(-2), second = list[Math.max(a, b)] ?? list.at(-1);
  const names = [...new Set([...first.lists, ...second.lists].map(item => item.label))];
  const share = (vote, label) => vote.lists.find(item => item.label === label)?.share;
  const rows = names.map(label => ({ label, a: share(first, label), b: share(second, label) })).filter(row => Number.isFinite(row.a) || Number.isFinite(row.b)).sort((x, y) => (y.b ?? y.a ?? 0) - (x.b ?? x.a ?? 0)).slice(0, 12);
  const name = vote => `${vote.type === 'europee' ? 'Europee' : 'Politiche'} del ${formatDate(vote.date)}`;
  const options = list.map((vote, index) => `<option value="${index}">${esc(name(vote))}</option>`).join('');
  const body = rows.map(row => `<tr data-territory-compare-row><th scope="row">${esc(row.label)}</th><td class="num">${Number.isFinite(row.a) ? pct(row.a) : '—'}</td><td class="num">${Number.isFinite(row.b) ? pct(row.b) : '—'}</td><td class="num ${Number.isFinite(row.a) && Number.isFinite(row.b) ? (row.b - row.a >= 0 ? 'tone-good' : 'tone-bad') : ''}">${Number.isFinite(row.a) && Number.isFinite(row.b) ? `${row.b - row.a >= 0 ? '+' : '−'}${pct(Math.abs(row.b - row.a)).replace('%', '')} pt` : '—'}</td></tr>`).join('');
  return card({ kicker: 'CONFRONTO TRA CONSULTAZIONI · SIMULATO', title: `${name(first)} e ${name(second)}`, body: `<form class="tp-compare" data-territory-compare-form><label>Primo voto<select name="a">${options.replace(`value="${list.indexOf(first)}"`, `value="${list.indexOf(first)}" selected`)}</select></label><label>Secondo voto<select name="b">${options.replace(`value="${list.indexOf(second)}"`, `value="${list.indexOf(second)}" selected`)}</select></label><button type="submit" class="secondary-button">Confronta</button></form><div class="sx-table-wrap"><table class="sx-table" data-territory-compare="table"><thead><tr><th scope="col">Lista</th><th scope="col" class="num">${esc(formatDate(first.date))}</th><th scope="col" class="num">${esc(formatDate(second.date))}</th><th scope="col" class="num">Differenza</th></tr></thead><tbody>${body}</tbody></table></div><p class="sx-note">Le liste sono confrontate per nome; chi non c’era in uno dei due voti ha un trattino. Dato simulato dalla partita.</p>` });
}

export function renderTerritoryPage(state, overview, { geography = null, municipalities = [], filters = {}, swatch = null, colorOf = null, labelOf = null } = {}) {
  if (!state.game) return empty('Crea prima un politico per vedere i risultati per territorio.', '<button class="primary-button" data-action="new-career">Crea il politico</button>');
  const last = overview?.national?.lastPolitiche ?? null;
  const hierarchy = hierarchyFor(municipalities);
  const status = statusCard(last, geography);
  const compare = comparisonCard(overview?.national?.votes ?? [], filters.terrCompare);
  if (!last) return `<div class="territory-page" data-territory-page-root>${status}${card({ kicker: 'RISULTATI PER TERRITORIO', title: 'Ancora nessun voto politico', body: '<p class="sx-empty" role="status" data-territory-state="missing">Dopo le prossime elezioni politiche simulate qui trovi i risultati per regione, provincia e comune. Nel frattempo la mappa della centrale elettorale mostra la proiezione di oggi, che non è un risultato.</p><button type="button" class="secondary-button" data-nav="elezioni">Vai alla centrale elettorale</button>' })}${compare}</div>`;
  if (!hierarchy) return `<div class="territory-page" data-territory-page-root>${status}${card({ kicker: 'RISULTATI PER TERRITORIO', title: 'Dati ISTAT in caricamento', body: '<p class="sx-empty" role="status" data-territory-state="missing">I dati ISTAT dei comuni non sono ancora caricati: riapri la pagina tra un momento.</p>' })}${compare}</div>`;
  if (!swatch || !colorOf || !labelOf) ({ swatch, colorOf, labelOf } = territoryPaint(overview));   // the colours and names of the lists come from the national page (a lazy chunk of its own)
  const { totals, lean } = territoryInputs(last, geography);
  const [regionCode = '', provinceCode = ''] = String(filters.terr ?? '').split('|');
  const q = String(filters.terrQ ?? '');
  const sort = SORTS.some(([id]) => id === filters.terrSort) ? filters.terrSort : 'popolazione';
  const breakdown = territoryBreakdown({ totals, hierarchy, seed: `${last.id ?? last.date}|territorio`, regionLean: lean, regionCode: regionCode || null, provinceCode: provinceCode || null });
  const ids = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  const ctx = { swatch, colorOf, labelOf: id => id === OTHERS ? 'Altri' : labelOf(id), columns: ids };
  const found = searchComuni(hierarchy, q);
  const comuni = hierarchy.reduce((sum, region) => sum + region.provinces.reduce((acc, province) => acc + province.comuni.length, 0), 0);
  return `<div class="territory-page" data-territory-page-root>${status}
    ${card({ kicker: 'CERCA E FILTRA', title: `${num(comuni, 0)} comuni consultabili`, body: `${controls({ hierarchy, regionCode, provinceCode, q, sort })}${searchResults(found, q)}` })}
    ${crumbs(breakdown)}${summaryCard(breakdown, ctx)}${tableCard(breakdown, ctx, { page: Math.max(1, Number(filters.terrPage) || 1), sort })}${compare}
    <p class="sx-note" data-territory-source>Dato simulato: i voti di lista del voto nazionale del ${esc(formatDate(last.date))} della partita, ripartiti per abitanti (ISTAT) con lo scarto regionale del modello e una piccola variazione locale, sempre la stessa per lo stesso voto. Non è un dato ufficiale: i risultati reali del 2022 sono solo per collegio e Regione.</p></div>`;
}
