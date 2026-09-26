// Country, territories, citizens and media: the simulated society as the player sees it.
import { INDICATORS, MEDIA_OUTLETS, SEGMENTS } from '../data/simulation/society-rules.js?v=20260926-2';
import { nationalIndicators, regionPriorities, societyMood } from '../core/society-engine.js?v=20260926-2';
import { illustration } from './illustrations.js?v=20260926-2';
import { artTile, glyph } from './visuals.js?v=20260926-2';
const weeks = count => `${count} ${count === 1 ? 'settimana' : 'settimane'}`;
import { breakdown, esc, levelState, lineChart, meter, num, rampColor, SERIES, signed, sparkline, stateBadge, trendState, GREEN_RAMP } from './charts.js?v=20260926-2';
import { areasPanel, publicFinancePanel, securityPanel } from './policy-mode.js?v=20260926-2';

// Tile cartogram of the regions: a recognisable boot, one tile per region.
const TILES = Object.freeze({
  'Valle d’Aosta': [0, 0, 'VDA'], Lombardia: [1, 0, 'LOM'], 'Trentino-Alto Adige': [2, 0, 'TAA'], 'Friuli-Venezia Giulia': [3, 0, 'FVG'],
  Piemonte: [0, 1, 'PIE'], 'Emilia-Romagna': [1, 1, 'EMR'], Veneto: [2, 1, 'VEN'], Liguria: [0, 2, 'LIG'], Toscana: [1, 2, 'TOS'], Marche: [2, 2, 'MAR'],
  Umbria: [1, 3, 'UMB'], Abruzzo: [2, 3, 'ABR'], Sardegna: [0, 4, 'SAR'], Lazio: [1, 4, 'LAZ'], Molise: [2, 4, 'MOL'], Puglia: [3, 4, 'PUG'],
  Campania: [2, 5, 'CAM'], Basilicata: [3, 5, 'BAS'], Calabria: [3, 6, 'CAL'], Sicilia: [2, 7, 'SIC']
});
export const MAP_MEASURES = Object.freeze([{ id: 'satisfaction', label: 'Soddisfazione' }, { id: 'trust', label: 'Fiducia' }, ...INDICATORS.map(item => ({ id: item.id, label: item.label }))]);
const indicatorLabel = id => INDICATORS.find(item => item.id === id)?.label ?? id;
const regionValue = (region, measure) => measure === 'satisfaction' ? region.satisfaction : measure === 'trust' ? region.trust : region.indicators[measure];
const historyOf = (society, key, count = 26) => society.history.slice(-count).map(item => item[key]);
const change = (society, key, weeks = 4) => { const list = society.history; const now = list.at(-1)?.[key]; const then = list.at(-1 - weeks)?.[key] ?? list[0]?.[key]; return Number.isFinite(now) && Number.isFinite(then) ? Math.round((now - then) * 10) / 10 : 0; };
const TREND_LABELS = { crescita: 'In crescita', calo: 'In calo', stabile: 'Stabile' };
const SHORT_SEGMENTS = { giovani: 'Giovani', famiglie: 'Famiglie', anziani: 'Pensionati', imprese: 'Autonomi e imprese', fragili: 'Redditi bassi' };

export function territoryMap(society, { measure = 'satisfaction', selected = null, home = null, compact = false } = {}) {
  const issues = new Set(society.issues.filter(item => item.region).map(item => item.region));
  // The colour scale follows the spread of the data, so differences between regions stay visible.
  const values = Object.values(society.regions).map(region => regionValue(region, measure));
  const middle = (Math.min(...values) + Math.max(...values)) / 2;
  const low = Math.floor(Math.min(Math.min(...values), middle - 8));
  const high = Math.ceil(Math.max(Math.max(...values), middle + 8));
  const tiles = Object.values(society.regions).map(region => {
    const [col, row, code] = TILES[region.name] ?? [0, 0, region.name.slice(0, 3).toUpperCase()];
    const value = regionValue(region, measure);
    const fill = rampColor(value, low, high);
    const dark = GREEN_RAMP.indexOf(fill) < 5;
    const tip = `${region.name}: ${MAP_MEASURES.find(item => item.id === measure)?.label ?? ''} ${num(value, 0)}/100${issues.has(region.name) ? ' · problema aperto' : ''}`;
    return `<button class="map-tile ${region.name === selected ? 'is-selected' : ''} ${region.name === home ? 'is-home' : ''}" style="grid-column:${col + 1};grid-row:${row + 1};background:${fill};color:${dark ? '#fffdf7' : '#17301f'}" ${compact ? 'tabindex="-1"' : `data-territory-region="${esc(region.name)}"`} data-tip="${esc(tip)}" aria-label="${esc(tip)}"><b>${code}</b>${compact ? '' : `<small>${num(value, 0)}</small>`}${issues.has(region.name) ? `<i class="map-alert" aria-hidden="true">${glyph('alert', 11, 2.4)}</i>` : ''}</button>`;
  }).join('');
  const scale = compact ? '' : `<div class="region-scale"><span>${low}</span><i style="background:linear-gradient(90deg,${GREEN_RAMP.join(',')})"></i><span>${high}</span></div>`;
  return `<div class="tile-map ${compact ? 'is-compact' : ''}">${tiles}</div>${scale}`;
}

function kpi(label, value, deltaValue, series, note = '', { invert = false, unit = '' } = {}) {
  const state = trendState(deltaValue, { invert });
  return `<div class="society-kpi"><span>${esc(label)}</span><strong>${value}${unit}</strong>${stateBadge(state, `${TREND_LABELS[state]} ${deltaValue ? signed(deltaValue) : ''}`.trim())}${sparkline(series)}${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}
function economyStrip(society) {
  const economy = society.economy;
  const item = (label, value, key, invert, unit = '%') => { const d = change(society, key); const state = trendState(d, { threshold: 0.05, invert }); return `<div class="economy-item"><small>${label}</small><strong>${num(value, 1)}${unit}</strong>${stateBadge(state, TREND_LABELS[state])}</div>`; };
  return `<div class="economy-strip">${item('Crescita del PIL', economy.growth, 'growth', false)}${item('Disoccupazione', economy.unemployment, 'unemployment', true)}${item('Inflazione', economy.inflation, 'inflation', true)}${item('Deficit / PIL', economy.deficit, 'deficit', true)}<div class="economy-item"><small>Debito / PIL</small><strong>${num(economy.debt, 1)}%</strong></div>${item('Margine di bilancio', society.publicFinance.headroom, 'headroom', false, '/100')}</div>`;
}

function regionDetail(society, name, home, deputies = null) {
  const region = society.regions[name] ?? Object.values(society.regions)[0];
  const effects = society.effects.filter(effect => effect.region === region.name);
  const incoming = Object.values(effects.reduce((acc, effect) => { const key = `${effect.indicator}|${effect.cause}`; acc[key] ??= { indicator: effect.indicator, cause: effect.cause, total: 0, weeks: effect.remaining }; acc[key].total += effect.perWeek * effect.remaining; return acc; }, {}));
  const issues = society.issues.filter(item => item.region === region.name);
  const bars = INDICATORS.map(indicator => {
    const value = region.indicators[indicator.id];
    const [state] = levelState(value);
    return `<div class="indicator-row state-row-${state}" data-tip="${esc(`${indicator.label} in ${region.name}: ${num(value, 0)}/100`)}" tabindex="0"><span>${glyph(indicator.icon, 15)}${esc(indicator.label)}</span>${meter(value, state === 'crisi' ? 'danger' : state === 'rischio' ? 'gold' : state === 'solida' ? 'good' : '')}<strong>${num(value, 0)}</strong></div>`;
  }).join('');
  const [satState, satLabel] = levelState(region.satisfaction, { crisis: 38, risk: 46, good: 62 });
  return `<article class="region-detail">
    <header>${artTile('map', region.name === home ? 'var(--party-accent)' : '#318a5b', 'md')}<div><span class="section-kicker">${region.name === home ? 'LA TUA REGIONE' : 'REGIONE'}</span><h3>${esc(region.name)}</h3><p class="section-subtitle">Fiducia nelle istituzioni ${num(region.trust, 0)}/100${deputies ? ` · ${deputies} deputati in carica per questa regione (dato reale)` : ''}</p></div>${stateBadge(satState, `Soddisfazione ${num(region.satisfaction, 0)} · ${satLabel}`)}</header>
    <div class="region-facts"><div><small>Partecipazione attesa</small><strong>${num(region.participation ?? 0, 0)}%</strong></div><div><small>Priorità dei cittadini</small><strong>${regionPriorities(society, region.name).map(item => esc(item.label)).join(' · ')}</strong></div></div>
    ${region.demography ? `<div class="demography"><small>CHI CI VIVE · SIMULAZIONE</small><div class="demography-bar">${SEGMENTS.map((segment, index) => `<i style="flex:${region.demography[segment.id]};background:${SERIES[index]}" data-tip="${esc(`${segment.label}: ${num(region.demography[segment.id], 1)}%`)}" tabindex="0"></i>`).join('')}</div><div class="demography-legend">${SEGMENTS.map((segment, index) => `<span><i style="background:${SERIES[index]}"></i>${esc(SHORT_SEGMENTS[segment.id] ?? segment.label)} ${num(region.demography[segment.id], 0)}%</span>`).join('')}</div></div>` : ''}
    <div class="indicator-list">${bars}</div>
    ${issues.length ? `<div class="issue-list">${issues.map(issue => `<div class="issue-row">${stateBadge(issue.severity >= 6 ? 'crisi' : 'rischio', issue.severity >= 6 ? 'Crisi' : 'A rischio')}<span>${esc(indicatorLabel(issue.indicator))}: sotto la soglia di guardia</span></div>`).join('')}</div>` : ''}
    ${incoming.length ? `<div class="incoming"><small>EFFETTI IN ARRIVO DALLE LEGGI</small>${incoming.slice(0, 5).map(item => `<div>${glyph('law', 14)}<span>${esc(indicatorLabel(item.indicator))} ${signed(item.total)} in ${weeks(item.weeks)} · ${esc(item.cause)}</span></div>`).join('')}</div>` : '<p class="quiet-copy">Nessuna legge in fase di attuazione in questa regione.</p>'}
  </article>`;
}

function segmentsPanel(society) {
  return `<div class="segment-list">${society.segments.map((segment, index) => {
    const top = Object.entries(segment.attention).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => indicatorLabel(id).toLowerCase()).join(' e ');
    const [state, label] = levelState(segment.satisfaction, { crisis: 38, risk: 46, good: 62 });
    return `<article class="segment-card" style="--seg:${SERIES[index]}"><header><strong>${esc(segment.label)}</strong><small>${segment.share}% dell’elettorato</small></header><div class="segment-values"><span>Soddisfazione</span>${meter(segment.satisfaction, state === 'crisi' ? 'danger' : state === 'solida' ? 'good' : '')}<b>${num(segment.satisfaction, 0)}</b><span>Fiducia</span>${meter(segment.trust)}<b>${num(segment.trust, 0)}</b><span>Partecipazione</span>${meter(segment.participation)}<b>${num(segment.participation, 0)}%</b></div><footer>${stateBadge(state, label)}<small>Guardano a ${esc(top)}${segment.mood ? ` · umore ${signed(segment.mood)}` : ''}</small></footer></article>`;
  }).join('')}</div>`;
}

function lawsApplied(society) {
  const rows = society.lawsApplied.slice(0, 8);
  if (!rows.length) return '<p class="quiet-copy">Nessuna misura ancora in vigore: le leggi approvate in Parlamento e i provvedimenti dell’esecutivo compariranno qui con i loro effetti.</p>';
  const segment = id => SEGMENTS.find(item => item.id === id)?.label ?? id;
  return `<div class="measure-list">${rows.map(item => `<article class="measure-row">${artTile(item.origin === 'esecutivo' ? 'ministry' : 'law', item.covered ? '#1baf7a' : '#e34948', 'sm')}<div><strong>${esc(item.title)}</strong><small>${item.origin === 'esecutivo' ? 'Esecutivo di scenario' : 'Legge approvata in Parlamento'} · settimana ${item.week} · ${esc(item.category)}</small><span>${item.covered ? 'Coperture trovate' : 'Coperture insufficienti: effetti ridotti'} · costo ${num(item.cost, 1)} punti di margine · più effetti in ${item.topRegions.map(region => esc(region.name)).join(', ')}</span>${item.pleased.length || item.displeased.length ? `<em>${item.pleased.length ? `Soddisfatti: ${item.pleased.map(segment).join(', ')}` : ''}${item.displeased.length ? ` · Scontenti: ${item.displeased.map(segment).join(', ')}` : ''}</em>` : ''}</div></article>`).join('')}</div>`;
}

export function renderTerritoriesPage(state, ui = {}) {
  const society = state.society;
  if (!society) return '<p class="quiet-copy">La simulazione del Paese si attiva alla prossima settimana.</p>';
  const home = state.game?.place?.region ?? null;
  const measure = MAP_MEASURES.some(item => item.id === ui.measure) ? ui.measure : 'satisfaction';
  const selected = society.regions[ui.region] ? ui.region : society.regions[home] ? home : Object.keys(society.regions)[0];
  const labels = society.history.slice(-26).map(item => `S${item.week}`);
  const mood = societyMood(society);
  const panel = (kicker, title, body, extra = '', cls = '') => `<section class="hq-panel ${cls}"><div class="home-section-heading"><div><span class="section-kicker">${kicker}</span><h2>${title}</h2></div>${extra}</div>${body}</section>`;
  const national = nationalIndicators(society);
  const executive = society.executive;
  const governing = ['active', 'crisis'].includes(state.parliament?.government?.status);
  return `<div class="society-page">
    <section class="society-hero">
      ${illustration('borgo', 'hero-art')}<div class="society-hero-main"><span class="section-kicker">IL PAESE · SETTIMANA ${society.week}</span><h2>Umore del Paese: ${num(mood, 0)}/100</h2><p class="section-subtitle">Cittadini, territori ed economia si muovono ogni settimana, con o senza di te: leggi, crisi, media e scelte del governo cambiano i numeri qui sotto.</p></div>
      <div class="society-kpis">${kpi('Soddisfazione dei cittadini', num(society.satisfaction, 1), change(society, 'satisfaction'), historyOf(society, 'satisfaction'))}${kpi('Fiducia nelle istituzioni', num(society.trust, 1), change(society, 'trust'), historyOf(society, 'trust'))}${kpi('Partecipazione attesa', num(society.participation, 1), change(society, 'participation'), historyOf(society, 'participation'), '', { unit: '%' })}</div>
      ${economyStrip(society)}
    </section>
    <div class="society-grid">
      ${panel('MAPPA DEI TERRITORI · SIMULATA', 'L’Italia regione per regione', `<div class="measure-picker" role="group" aria-label="Indicatore della mappa">${MAP_MEASURES.map(item => `<button class="chip-button ${item.id === measure ? 'active' : ''}" data-territory-measure="${esc(item.id)}">${esc(item.label)}</button>`).join('')}</div>${territoryMap(society, { measure, selected, home })}<p class="poll-footnote">Scegli una regione per il dettaglio. Il segnale rosso indica un problema aperto; il bordo dorato la tua regione.</p>`, '', 'map-panel')}
      ${panel('DETTAGLIO', 'Indicatori, problemi, effetti', regionDetail(society, selected, home, ui.deputies?.[selected] ?? null))}
    </div>
    <div class="society-grid">
      ${panel('ANDAMENTO', 'Come stanno i cittadini', lineChart({ series: [{ label: 'Soddisfazione', short: 'Soddisf.', color: SERIES[0], values: historyOf(society, 'satisfaction'), emphasis: true }, { label: 'Fiducia', color: SERIES[1], values: historyOf(society, 'trust') }, { label: 'Partecipazione', short: 'Partecip.', color: SERIES[2], values: historyOf(society, 'participation') }], labels, tips: society.history.slice(-26).map(item => `Settimana ${item.week}`), ariaLabel: 'Soddisfazione, fiducia e partecipazione nelle ultime settimane' }))}
      ${panel('MEDIA NAZIONALE', 'I servizi nel Paese', breakdown(INDICATORS.map(indicator => ({ label: indicator.label, value: national[indicator.id], color: rampColor(national[indicator.id], 25, 85) })), { max: 100, format: value => `${num(value, 0)}/100` }))}
    </div>
    ${panel('POPOLAZIONE · SIMULATA', 'Chi sono i cittadini e cosa chiedono', segmentsPanel(society))}
    ${panel('TEMI DEL PAESE · SIMULATI', 'Trentaquattro temi, ognuno con il suo indicatore', `<div class="areas-grid">${areasPanel(society)}</div><p class="poll-footnote">Ogni tema ha un indicatore, un problema tipico, un ministero responsabile e strumenti di intervento (investimenti, riforme, sostegni, regole) nella sezione Leggi e, per il Presidente del Consiglio, nella sezione Governo.</p>`)}
    <div class="society-grid">
      ${panel('SICUREZZA · SIMULATA', 'Criminalità, paura e forze sul territorio', securityPanel(society))}
      ${panel('CONTI PUBBLICI · SIMULATI', 'Deficit, debito, spread ed Europa', publicFinancePanel(society))}
    </div>
    <div class="society-grid">
      ${panel('LEGGI E PROVVEDIMENTI', 'Cosa arriva sui territori', lawsApplied(society))}
      ${panel(governing ? 'GOVERNO IN CARICA' : 'ESECUTIVO DI SCENARIO', governing ? 'Il governo della simulazione' : esc(executive.label), `<dl class="hq-facts"><div><dt>Gradimento</dt><dd>${num(governing ? state.world?.polls?.at(-1)?.government?.approval : executive.approval, 0)}/100</dd></div><div><dt>Margine di bilancio</dt><dd>${num(society.publicFinance.headroom, 0)}/100 ${meter(society.publicFinance.headroom, society.publicFinance.headroom < 20 ? 'danger' : '')}</dd></div><div><dt>Risorse già impegnate</dt><dd>${num(society.publicFinance.committed, 0)} punti</dd></div></dl><p class="parliament-note">${governing ? 'Il governo formato in Parlamento risponde ai cittadini: la sua stabilità pesa sull’economia e l’umore del Paese pesa sul suo gradimento.' : 'Finché in Parlamento non nasce un governo della simulazione, un esecutivo di scenario interviene ogni sei settimane sul problema più urgente, se i conti lo consentono. Non rappresenta il governo reale.'}</p>`)}
    </div>
    <p class="poll-footnote">Popolazione, territori, economia, conti pubblici e media di questa pagina sono interamente simulati (source: simulation): non sono statistiche ufficiali né dati reali.${society.weightSource === 'camera' ? ' Le medie nazionali pesano ogni regione per il numero di deputati in carica eletti nelle sue circoscrizioni (dato reale della Camera).' : ''}</p>
  </div>`;
}

// Compact cards for the Home dashboard.
export function renderCountryCard(state) {
  const society = state.society;
  if (!society) return '';
  const mood = societyMood(society);
  const d = change(society, 'satisfaction');
  const state1 = mood < 40 ? 'crisi' : mood < 47 ? 'rischio' : trendState(d);
  const labels = { crisi: 'Malcontento diffuso', rischio: 'Clima teso', crescita: 'Umore in crescita', calo: 'Umore in calo', stabile: 'Clima stabile' };
  const top = society.issues.slice(0, 3);
  return `<div class="dash-body"><div class="dash-number"><strong>${num(mood, 0)}</strong><small>/100 umore</small>${stateBadge(state1, labels[state1])}</div>${sparkline(historyOf(society, 'satisfaction'))}<dl class="dash-facts"><div><dt>Fiducia</dt><dd>${num(society.trust, 0)}</dd></div><div><dt>Crescita</dt><dd>${num(society.economy.growth, 1)}%</dd></div><div><dt>Disoccup.</dt><dd>${num(society.economy.unemployment, 1)}%</dd></div><div><dt>Inflazione</dt><dd>${num(society.economy.inflation, 1)}%</dd></div></dl>${top.length ? `<ul class="dash-issues">${top.map(issue => `<li>${glyph('alert', 13, 2)}${esc(issue.scope === 'regionale' ? `${indicatorLabel(issue.indicator)} · ${issue.region}` : issue.topic)}</li>`).join('')}</ul>` : '<p class="dash-quiet">Nessun problema sopra la soglia di guardia.</p>'}</div>`;
}
export function renderTerritoryCard(state) {
  const society = state.society;
  const home = state.game?.place?.region;
  const region = society?.regions?.[home];
  if (!region) return '<p class="dash-quiet">Nessuna regione di riferimento.</p>';
  const weakest = INDICATORS.map(item => [item, region.indicators[item.id]]).sort((a, b) => a[1] - b[1]).slice(0, 3);
  const [state1, label] = levelState(region.satisfaction, { crisis: 38, risk: 46, good: 62 });
  return `<div class="dash-body dash-territory">${territoryMap(society, { measure: 'satisfaction', selected: home, home, compact: true })}<div><div class="dash-number"><strong>${num(region.satisfaction, 0)}</strong><small>/100 soddisfazione</small>${stateBadge(state1, label)}</div><ul class="dash-weak">${weakest.map(([indicator, value]) => `<li><span>${esc(indicator.label)}</span>${meter(value, value < 36 ? 'danger' : value < 45 ? 'gold' : '')}<b>${num(value, 0)}</b></li>`).join('')}</ul><small class="dash-note">Fiducia ${num(region.trust, 0)} · ${society.effects.filter(effect => effect.region === home).length ? 'leggi in attuazione' : 'nessuna legge in attuazione'}</small></div></div>`;
}

export function renderMediaPanel(state, { compact = false } = {}) {
  const media = state.society?.media;
  if (!media) return '';
  const sentiment = media.sentiment;
  const tone = sentiment > 8 ? ['crescita', 'Stampa favorevole'] : sentiment < -8 ? ['calo', 'Stampa ostile'] : ['stabile', 'Copertura neutra'];
  const outlets = [...media.outlets].sort((a, b) => b.attention - a.attention);
  const coverage = media.coverage.slice(0, compact ? 3 : 8).map(item => `<article class="coverage-row tone-${esc(item.tone)}">${glyph(MEDIA_OUTLETS.find(outlet => outlet.id === item.outletId)?.icon ?? 'news', 16)}<div><strong>${esc(item.headline)}</strong><small>${esc(item.outlet)} · S${item.week}</small></div></article>`).join('');
  if (compact) return coverage ? `<div class="coverage-list">${coverage}</div>` : '';
  return `<div class="media-summary"><div class="media-gauge"><small>VISIBILITÀ</small><strong>${num(media.visibility, 0)}<i>/100</i></strong>${meter(media.visibility, 'gold')}</div><div class="media-gauge"><small>TONO DELLA COPERTURA</small><strong>${signed(sentiment, 0)}</strong><span class="sentiment-scale"><i style="left:${(sentiment + 100) / 2}%"></i></span>${stateBadge(tone[0], tone[1])}</div></div>
    <div class="outlet-list">${outlets.map(outlet => `<div class="outlet-row" data-tip="${esc(`${outlet.label}: attenzione ${num(outlet.attention, 0)}, orientamento ${signed(outlet.stance, 0)}`)}" tabindex="0">${glyph(outlet.icon, 16)}<span><strong>${esc(outlet.label)}</strong><small>Pubblico potenziale ${outlet.reach}/100 · ${outlet.stance > 5 ? 'favorevole' : outlet.stance < -5 ? 'critico' : 'neutrale'}</small></span>${meter(outlet.attention)}<b>${num(outlet.attention, 0)}</b></div>`).join('')}</div>
    <div class="home-section-heading"><div><span class="section-kicker">TITOLI RECENTI</span></div></div>${coverage ? `<div class="coverage-list">${coverage}</div>` : '<p class="quiet-copy">Nessun titolo ancora: interviste, social, talk e iniziative sul territorio finiscono qui.</p>'}
    <p class="poll-footnote">Canali generici e titoli simulati: nessuna testata reale. La visibilità segue la notorietà, il tono della copertura pesa sulla reputazione e sui sondaggi del partito.</p>`;
}
