// The page «Risultati per territorio»: the last simulated general election of the game read by Region, Province and Comune, with search, filters, pages and a comparison between consultations. It never loads
// all the 7,894 comuni at once: the hierarchy holds only names and inhabitants, and the votes of the comuni are drawn for ONE province at a time (core/territory-results.js), always adding up to the level above.
// What is shown is SIMULATED and says so; the only official data are the real 2022 results by Region (the map of the national page) and what the sources document.
import { addsUp, territoryBreakdown } from '../core/territory-results.js?v=20261123-13';
import { OTHERS, hierarchyFor, localFor, territoryInputs } from './territory-results-card.js?v=20261123-13';
import { badge, card, empty, esc, num, pct } from './sections-kit.js?v=20261123-13';
import { formatDate } from '../core/time.js?v=20261123-13';
import { territoryPaint } from './national-view.js?v=20261123-13';

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
// The comuni where one list comes FIRST, read from the votes the simulation really draws for every comune (the same draw as the table below, province by province): a list that is not first
// anywhere has an empty list, and nothing is invented for a comune the model does not cover. The result of a scope is kept, so paging and sorting do not draw again.
const WINS_CACHE = new Map();
export function comuneWins({ totals, hierarchy, seed, lean, local = null, regionCode = null, provinceCode = null, partyId }) {
  const key = `${seed}|${regionCode ?? ''}|${provinceCode ?? ''}|${partyId}|${local ? 'l' : ''}`;
  if (WINS_CACHE.has(key)) return WINS_CACHE.get(key);
  const regions = regionCode ? hierarchy.filter(item => item.code === regionCode) : hierarchy;
  const wins = []; let total = 0;
  for (const region of regions) for (const province of provinceCode ? region.provinces.filter(item => item.code === provinceCode) : region.provinces) {
    const breakdown = territoryBreakdown({ totals, hierarchy, seed, regionLean: lean, regionCode: region.code, provinceCode: province.code, local });
    for (const row of breakdown.rows) {
      total++;
      const ranked = Object.entries(row.votes).sort((x, y) => y[1] - x[1]);
      if (ranked[0]?.[0] !== partyId) continue;
      wins.push({ regionCode: region.code, regionName: region.name, provinceCode: province.code, provinceName: province.name, code: row.code, name: row.name, population: row.population, votes: row.votes[partyId] ?? 0, share: row.valid ? (row.votes[partyId] ?? 0) * 100 / row.valid : 0, margin: row.valid ? ((ranked[0][1] - (ranked[1]?.[1] ?? 0)) * 100 / row.valid) : 0 });
    }
  }
  const out = { total, wins };
  if (WINS_CACHE.size > 40) WINS_CACHE.clear();
  WINS_CACHE.set(key, out);
  return out;
}

function statusCard(last, geography) {
  const real = geography?.loaded ? `${badge('DATO REALE', 'good')} Politiche del ${esc(formatDate(geography.electionDate))} (2022): i risultati ufficiali sono per collegio e per Regione, mai per Provincia o Comune.` : '';
  const sim = last ? `${badge('RISULTATO SIMULATO', 'warn')} Voto politico del ${esc(formatDate(last.date))} della tua partita: i voti di lista nazionali ripartiti per abitanti con lo scarto regionale del modello.` : `${badge('NESSUN VOTO', 'neutral')} In questa partita non c’è ancora un voto politico simulato: i numeri compaiono dopo le elezioni.`;
  const poll = `${badge('SONDAGGIO / PROIEZIONE', 'neutral')} Le stime prima del voto (pagina «Sondaggi» e mappa della centrale elettorale) non sono risultati: sono una fotografia che cambia ogni settimana.`;
  return card({ kicker: 'COSA STAI GUARDANDO', title: 'Dati reali, simulati e stime', body: `<ul class="tp-status" data-territory-status><li>${sim}</li><li>${real || `${badge('DATO REALE', 'good')} I dati reali del 2022 sono per collegio e Regione.`}</li><li>${poll}</li></ul>` });
}
function controls({ hierarchy, regionCode, provinceCode, q, sort, partyId, parties }) {
  const regions = hierarchy.map(region => `<option value="${esc(region.code)}"${region.code === regionCode ? ' selected' : ''}>${esc(region.name)}</option>`).join('');
  const region = hierarchy.find(item => item.code === regionCode);
  const provinces = region ? region.provinces.map(item => `<option value="${esc(item.code)}"${item.code === provinceCode ? ' selected' : ''}>${esc(item.name)}</option>`).join('') : '';
  const partyOptions = parties.map(item => `<option value="${esc(item.id)}"${item.id === partyId ? ' selected' : ''}>${esc(item.label)}</option>`).join('');
  return `<form class="tp-controls" data-territory-form role="search">
    <label class="tp-search">Cerca un comune<input type="search" name="q" value="${esc(q)}" placeholder="Nome del comune (almeno 2 lettere)" autocomplete="off" data-territory-search></label>
    <label>Regione<select name="region" data-territory-region><option value="">Tutta Italia</option>${regions}</select></label>
    <label>Provincia<select name="province" data-territory-province${region ? '' : ' disabled'}><option value="">Tutte</option>${provinces}</select></label>
    <label>Partito<select name="party" data-territory-party><option value="">Nessun filtro</option>${partyOptions}</select></label>
    <label>Ordina per<select name="sort" data-territory-sort>${SORTS.map(([id, label]) => `<option value="${id}"${id === sort ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
    <button type="submit" class="primary-button">Cerca</button><button type="button" class="secondary-button" data-territory-reset>Azzera</button></form>`;
}
function searchResults(found, q) {
  if (!q || norm(q).length < 2) return '';
  if (!found.total) return `<p class="sx-empty" role="status" data-territory-nomatch>Nessun comune corrisponde a «${esc(q)}».</p>`;
  const items = found.items.map(item => `<li><button type="button" class="link-button" data-view-filter="terr" data-view-filter-value="${esc(`${item.region.code}|${item.province.code}`)}" data-view-filter-also="terrPage=1;terrComune=${esc(item.comune.code)}" data-territory-hit="${esc(item.comune.code)}">${esc(item.comune.name)}</button> <small>${esc(item.province.name)} · ${esc(item.region.name)} · ${num(item.comune.population, 0)} ab.</small></li>`).join('');
  return `<div class="tp-hits" data-territory-hits><p class="quiet-copy">${num(found.total, 0)} ${found.total === 1 ? 'comune trovato' : 'comuni trovati'}${found.total > found.items.length ? ` (i primi ${found.items.length}: affina la ricerca)` : ''}. Scegli per aprire la sua provincia.</p><ul>${items}</ul></div>`;
}
const crumbs = (breakdown, comune = null) => {
  const list = [['', 'Italia'], breakdown.region ? [breakdown.region.code, breakdown.region.name] : null, breakdown.province ? [`${breakdown.region.code}|${breakdown.province.code}`, breakdown.province.name] : null, comune ? ['*', comune.name] : null].filter(Boolean);
  return `<nav class="nv-crumbs" aria-label="Livello territoriale" data-territory-crumbs>${list.map(([value, text], index) => index === list.length - 1 ? `<span aria-current="page"><strong>${esc(text)}</strong></span>` : `<button type="button" data-view-filter="terr" data-view-filter-value="${esc(value)}" data-view-filter-also="terrPage=1;terrComune=">${esc(text)}</button>`).join(' › ')}</nav>`;
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
    const pick = row.kind === 'comune' ? `<button type="button" class="link-button" data-view-filter="terrComune" data-view-filter-value="${esc(row.code)}" data-territory-pick="${esc(row.code)}">${esc(row.name)}</button>` : '';
    const name = pick || (next ? `<button type="button" class="link-button" data-view-filter="terr" data-view-filter-value="${esc(next)}" data-view-filter-also="terrPage=1" data-territory-open="${esc(row.code)}">${esc(row.name)}</button>` : esc(row.name));
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

// Regional, provincial and municipal votes of the game (state.races): the game keeps for each one the lists with their shares (top six + winner), not every comune, so the comparison is by consultation and place — never a made-up
// breakdown below it. Two votes of the same place and level are put side by side list by list; the shares of one vote never add up to more than 100.
const LEVEL = { comunale: 'Comunali', provinciale: 'Provinciali', regionale: 'Regionali' };
export const finishedRaces = state => (state?.races?.items ?? []).filter(item => item?.result?.groups?.length && item.electionDate);
export function compareRaces(a, b) {
  const first = a.electionDate <= b.electionDate ? a : b, second = first === a ? b : a;
  const names = [...new Set([...first.result.groups, ...second.result.groups].map(row => row.label))];
  const share = (race, label) => race.result.groups.find(row => row.label === label)?.percent;
  const rows = names.map(label => ({ label, a: share(first, label), b: share(second, label) })).sort((x, y) => (y.b ?? y.a ?? 0) - (x.b ?? x.a ?? 0));
  const sum = race => race.result.groups.reduce((total, row) => total + (row.percent ?? 0), 0);
  return { first, second, rows, consistent: sum(first) <= 100.5 && sum(second) <= 100.5 };
}
function racesCard(state, selected) {
  const races = finishedRaces(state);
  if (!races.length) return card({ kicker: 'CONSULTAZIONI REGIONALI E LOCALI · SIMULATE', title: 'Nessun voto locale concluso', body: '<p class="sx-empty" data-territory-races="none">Quando una elezione comunale, provinciale o regionale della partita si conclude, il risultato compare qui; con due voti nello stesso luogo si confrontano.</p>' });
  const groups = new Map();
  for (const race of races) { const key = `${race.level}|${race.territory?.name}`; groups.set(key, [...(groups.get(key) ?? []), race].sort((x, y) => x.electionDate.localeCompare(y.electionDate))); }
  const pairs = [...groups.entries()].filter(([, list]) => list.length >= 2);
  const list = races.slice().sort((x, y) => y.electionDate.localeCompare(x.electionDate)).slice(0, 12).map(race => `<li data-territory-race="${esc(race.id ?? '')}"><b>${esc(LEVEL[race.level] ?? race.level)} · ${esc(race.territory?.name ?? '')}</b> <small>${esc(formatDate(race.electionDate))}</small> — vince ${esc(race.result.winner?.label ?? '—')}${race.result.winner ? ` (${pct(race.result.winner.percent)})` : ''}${race.result.share !== undefined ? ` · il tuo partito ${pct(race.result.share)}` : ''}</li>`).join('');
  const chosen = pairs.find(([key]) => key === selected) ?? pairs[0] ?? null;
  let compare = '<p class="sx-note" data-territory-races="single">Il confronto compare quando in uno stesso luogo, allo stesso livello, ci sono almeno due voti.</p>';
  if (chosen) {
    const [key, listRaces] = chosen;
    const out = compareRaces(listRaces.at(-2), listRaces.at(-1));
    const options = pairs.map(([k, l]) => `<option value="${esc(k)}"${k === key ? ' selected' : ''}>${esc(LEVEL[l[0].level] ?? l[0].level)} · ${esc(l[0].territory?.name ?? '')}</option>`).join('');
    const body = out.rows.map(row => `<tr data-territory-race-row><th scope="row">${esc(row.label)}</th><td class="num">${Number.isFinite(row.a) ? pct(row.a) : '—'}</td><td class="num">${Number.isFinite(row.b) ? pct(row.b) : '—'}</td><td class="num ${Number.isFinite(row.a) && Number.isFinite(row.b) ? (row.b - row.a >= 0 ? 'tone-good' : 'tone-bad') : ''}">${Number.isFinite(row.a) && Number.isFinite(row.b) ? `${row.b - row.a >= 0 ? '+' : '−'}${pct(Math.abs(row.b - row.a)).replace('%', '')} pt` : '—'}</td></tr>`).join('');
    compare = `<form class="tp-compare" data-territory-race-form><label>Luogo<select name="race">${options}</select></label><button type="submit" class="secondary-button">Mostra</button></form><div class="sx-table-wrap"><table class="sx-table" data-territory-races="table"><thead><tr><th scope="col">Lista</th><th scope="col" class="num">${esc(formatDate(out.first.electionDate))}</th><th scope="col" class="num">${esc(formatDate(out.second.electionDate))}</th><th scope="col" class="num">Differenza</th></tr></thead><tbody>${body}</tbody></table></div><p class="sx-note">Compaiono le liste principali di ciascun voto (dato simulato); i comuni di una regione o di una provincia non sono ricostruiti uno a uno. ${out.consistent ? '' : 'Attenzione: le quote di un voto superano il 100%.'}</p>`;
  }
  return card({ kicker: 'CONSULTAZIONI REGIONALI E LOCALI · SIMULATE', title: `${races.length} ${races.length === 1 ? 'voto concluso' : 'voti conclusi'}`, body: `<ul class="tp-races" data-territory-races-list>${list}</ul>${compare}` });
}
// The lists of the game whose party has NO documented collocazione or programme in the data (the verified catalogue does not have them): they are shown with their share like any other, but nothing about their
// positions is made up — the page says so and the alliance pages show «posizione non rilevata».
export const undocumentedParties = state => (state?.world?.parties ?? []).filter(party => party.active !== false && !party.isPlayer && !Number.isFinite(party.axis));
function undocumentedCard(state) {
  const list = undocumentedParties(state);
  if (!list.length) return '';
  return card({ kicker: 'DATI NON DOCUMENTATI', title: `${list.length} ${list.length === 1 ? 'lista senza' : 'liste senza'} collocazione politica nei dati`, body: `<p class="sx-note" data-territory-undocumented>${esc(list.map(party => party.label).join(', '))}: compaiono con la loro quota nei sondaggi e nei voti simulati, ma il programma e la posizione politica non sono documentati e restano «non rilevati»: il gioco non li inventa.</p>` });
}
// The selected comune: its simulated votes list by list, who comes first and how it ranks in its province (population and the winner's share). Source: the same draw as the table.
function comuneCard(row, breakdown, ctx) {
  if (!row) return '';
  const ranked = Object.entries(row.votes).sort((a, b) => b[1] - a[1]);
  const first = ranked[0], second = ranked[1];
  const rank = [...breakdown.rows].sort((a, b) => b.population - a.population).findIndex(item => item.code === row.code) + 1;
  const bars = ranked.slice(0, 8).map(([id, votes]) => `<li><span class="nv-lead">${ctx.swatch(ctx.colorOf(id))}<span>${esc(id === OTHERS ? 'Altri partiti' : ctx.labelOf(id))}</span></span><span class="tp-bar" role="img" aria-label="${esc(pct(row.valid ? votes * 100 / row.valid : 0))}"><i style="width:${Math.max(1, Math.min(100, row.valid ? votes * 100 / row.valid : 0))}%;background:${esc(ctx.colorOf(id))}"></i></span><b>${pct(row.valid ? votes * 100 / row.valid : 0)}</b><small>${num(votes, 0)} voti</small></li>`).join('');
  return card({ kicker: 'COMUNE SELEZIONATO · RISULTATO SIMULATO', title: `${row.name} (${breakdown.province.name})`, className: 'tp-comune', body: `<div data-territory-comune="${esc(row.code)}"><div class="sx-kpis tp-kpis"><div class="sx-kpi"><small>Abitanti (ISTAT)</small><strong>${num(row.population, 0)}</strong></div><div class="sx-kpi"><small>Voti validi simulati</small><strong>${num(row.valid, 0)}</strong></div><div class="sx-kpi"><small>Primo partito</small><strong>${esc(first ? (first[0] === OTHERS ? 'Altri partiti' : ctx.labelOf(first[0])) : '—')}</strong></div><div class="sx-kpi"><small>Scarto sul secondo</small><strong>${row.valid && first && second ? pct((first[1] - second[1]) * 100 / row.valid) : '—'}</strong></div></div><ul class="tp-leads" data-territory-comune-votes>${bars}</ul><p class="quiet-copy">${rank}º comune della provincia per abitanti su ${breakdown.rows.length}. I voti sono simulati: i dati ufficiali non esistono per il singolo comune.</p></div>` });
}
function pagerOf(key, at, pages, total) {
  const btn = (label, page, off) => `<button type="button" class="secondary-button compact" data-view-filter="${key}" data-view-filter-value="${page}"${off ? ' disabled aria-disabled="true"' : ''}>${label}</button>`;
  return pages > 1 ? `<nav class="tp-pager" aria-label="Pagine dei risultati" data-territory-pager="${esc(key)}">${btn('« Prima', 1, at <= 1)}${btn('‹ Precedente', at - 1, at <= 1)}<span>Pagina ${at} di ${pages} · ${num(total, 0)} comuni</span>${btn('Successiva ›', at + 1, at >= pages)}${btn('Ultima »', pages, at >= pages)}</nav>` : '';
}
function winsCard({ partyId, label, result, scopeName, page, sort, ctx }) {
  const rows = [...result.wins].sort(sort === 'nome' ? (a, b) => a.name.localeCompare(b.name, 'it') : sort === 'voti' ? (a, b) => b.votes - a.votes : (a, b) => b.population - a.population);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), at = Math.min(page, pages);
  const shown = rows.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE);
  const list = shown.map(item => `<tr data-territory-win><th scope="row" data-label="Comune"><strong><button type="button" class="link-button" data-view-filter="terr" data-view-filter-value="${esc(`${item.regionCode}|${item.provinceCode}`)}" data-view-filter-also="terrPage=1;terrComune=${esc(item.code)}" data-territory-win-open="${esc(item.code)}">${esc(item.name)}</button></strong></th><td data-label="Provincia">${esc(item.provinceName)}</td><td data-label="Regione">${esc(item.regionName)}</td><td class="num" data-label="Abitanti">${num(item.population, 0)}</td><td class="num" data-label="Quota">${pct(item.share)}</td><td class="num" data-label="Scarto">${pct(item.margin)}</td></tr>`).join('');
  const body = result.wins.length ? `<div class="sx-table-wrap"><table class="sx-table tp-table" data-territory-wins-table><thead><tr><th scope="col">Comune</th><th scope="col">Provincia</th><th scope="col">Regione</th><th scope="col" class="num">Abitanti</th><th scope="col" class="num">Quota</th><th scope="col" class="num">Scarto sul secondo</th></tr></thead><tbody>${list}</tbody></table></div>${pagerOf('terrWinPage', at, pages, result.wins.length)}` : `<p class="sx-empty" data-territory-wins-none>${esc(label)} non risulta prima in nessun comune di ${esc(scopeName)} nel voto simulato.</p>`;
  return card({ kicker: 'PARTITO · COMUNI VINTI · RISULTATO SIMULATO', title: `${label}: primo in ${num(result.wins.length, 0)} comuni su ${num(result.total, 0)} (${scopeName})`, className: 'tp-wins', body: `<div data-territory-wins="${esc(partyId)}" data-territory-wins-count="${result.wins.length}">${body}</div>` });
}
export function renderTerritoryPage(state, overview, { geography = null, municipalities = [], filters = {}, swatch = null, colorOf = null, labelOf = null } = {}) {
  if (!state.game) return empty('Crea prima un politico per vedere i risultati per territorio.', '<button class="primary-button" data-action="new-career">Crea il politico</button>');
  const last = overview?.national?.lastPolitiche ?? null;
  const hierarchy = hierarchyFor(municipalities);
  const status = statusCard(last, geography);
  const compare = comparisonCard(overview?.national?.votes ?? [], filters.terrCompare) + racesCard(state, filters.terrRace);
  if (!last) return `<div class="territory-page" data-territory-page-root>${card({ kicker: 'RISULTATI PER TERRITORIO', title: 'Ancora nessun voto politico', body: '<p class="sx-empty" role="status" data-territory-state="missing">Dopo le prossime elezioni politiche simulate qui trovi i risultati per regione, provincia e comune. Nel frattempo la mappa della centrale elettorale mostra la proiezione di oggi, che non è un risultato.</p><button type="button" class="secondary-button" data-nav="elezioni">Vai alla centrale elettorale</button>' })}${compare}</div>${status}`;
  if (!hierarchy) return `<div class="territory-page" data-territory-page-root>${status}${card({ kicker: 'RISULTATI PER TERRITORIO', title: 'Dati ISTAT in caricamento', body: '<p class="sx-empty" role="status" data-territory-state="missing">I dati ISTAT dei comuni non sono ancora caricati: riapri la pagina tra un momento.</p>' })}${compare}</div>${status}`;
  if (!swatch || !colorOf || !labelOf) ({ swatch, colorOf, labelOf } = territoryPaint(overview));   // the colours and names of the lists come from the national page (a lazy chunk of its own)
  const { totals, lean } = territoryInputs(last, geography);
  const [regionCode = '', provinceCode = ''] = String(filters.terr ?? '').split('|');
  const q = String(filters.terrQ ?? '');
  const sort = SORTS.some(([id]) => id === filters.terrSort) ? filters.terrSort : 'popolazione';
  const local = localFor({ overview, last, state, hierarchy });
  const breakdown = territoryBreakdown({ totals, hierarchy, seed: `${last.id ?? last.date}|territorio`, regionLean: lean, regionCode: regionCode || null, provinceCode: provinceCode || null, local });
  const ids = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  const ctx = { swatch, colorOf, labelOf: id => id === OTHERS ? 'Altri' : labelOf(id), columns: ids };
  const found = searchComuni(hierarchy, q);
  const comuni = hierarchy.reduce((sum, region) => sum + region.provinces.reduce((acc, province) => acc + province.comuni.length, 0), 0);
  // the lists the player can pick: every list of the national vote (never a list the simulation did not draw)
  const parties = Object.entries(totals).filter(([id, votes]) => id !== OTHERS && votes > 0).sort((x, y) => y[1] - x[1]).map(([id]) => ({ id, label: labelOf(id) }));
  const partyId = parties.some(item => item.id === filters.terrParty) ? filters.terrParty : '';
  const comuneRow = breakdown.level === 'provincia' ? breakdown.rows.find(row => row.code === String(filters.terrComune ?? '')) ?? null : null;
  const seed = `${last.id ?? last.date}|territorio`;
  const winsHtml = partyId ? winsCard({ partyId, label: labelOf(partyId), result: comuneWins({ totals, hierarchy, seed, lean, local, regionCode: regionCode || null, provinceCode: provinceCode || null, partyId }), scopeName: breakdown.province?.name ?? breakdown.region?.name ?? 'Italia', page: Math.max(1, Number(filters.terrWinPage) || 1), sort, ctx }) : '';
  return `<div class="territory-page" data-territory-page-root>
    ${card({ kicker: 'CERCA E FILTRA', title: `${num(comuni, 0)} comuni consultabili`, body: `${controls({ hierarchy, regionCode, provinceCode, q, sort, partyId, parties })}${searchResults(found, q)}` })}
    ${crumbs(breakdown, comuneRow)}${comuneCard(comuneRow, breakdown, ctx)}${winsHtml}${summaryCard(breakdown, ctx)}${tableCard(breakdown, ctx, { page: Math.max(1, Number(filters.terrPage) || 1), sort })}${compare}${undocumentedCard(state)}
    <p class="sx-note" data-territory-model>Contano anche la dimensione del luogo, l’organizzazione del partito e la notorietà del candidato nel suo comune.</p>
    ${status}
    <p class="sx-note" data-territory-source>Dato simulato: i voti di lista del voto nazionale del ${esc(formatDate(last.date))} della partita, ripartiti per abitanti (ISTAT) con lo scarto regionale del modello e una piccola variazione tra territori; ogni livello somma quello superiore.</p></div>`;
}
