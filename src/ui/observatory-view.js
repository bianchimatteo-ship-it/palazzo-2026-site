// "Sondaggi e media" (#sondaggi): the one observatory of the game for the polls, the institutes and the rivals. Seven views of the same observatory: the
// dashboard, the institutes (each one, and their comparison with the average), the segments of the electorate and the themes, the territories, the forces
// and their alliances, the candidates of the race and the undecided with the flows between the forces. Elezioni → Sondaggi e avversari shows only the race
// of the campaign (renderCampaignObservatory): what `campaignObservatory()` reads from a valid campaign, and nothing when there is none.
// Everything here is read from what the game has saved (the world, its observatory, the campaign) and measures the simulation: no number on these
// pages gives a bonus, and the real parties stay real (their candidates, voters and readings are simulated, source: simulation).
import { latestPoll, observatoryReport } from '../core/world-engine.js?v=20261027-7';
import { campaignObservatory } from '../core/campaign-engine.js?v=20261027-7';
import { coalitionScenario } from '../core/poll-observatory.js?v=20261027-7';
import { POLL_EXTENSIONS } from '../data/simulation/polling-rules.js?v=20261027-7';
import { observatorySociety } from '../core/society-engine.js?v=20261027-7';
import { POLL_INSTITUTES } from '../data/simulation/polling-rules.js?v=20261027-7';
import { formatDate } from '../core/time.js?v=20261027-7';
import { lineChart, SERIES } from './charts.js?v=20261027-7';
import { emblem, glyph, partyMarkText } from './visuals.js?v=20261027-7';
import { arrow, bar, card, empty, esc, kpi, num, table } from './sections-kit.js?v=20261027-7';
import { alliancesList, barometer, chronicle, dataTable, forcesGrid, partyIndex, pct, pollPanel, presencePanel, shortDate, signed, strategyList } from './polls-mode.js?v=20261027-7';
import { heatmap, italyMap, MACRO_AREAS, partyBars, provenance, regionAbbreviation, regionBars, regionsOfArea, TERRITORY_MEASURES } from './territory-charts.js?v=20261027-7';
import { forceRegionalVote2022 } from '../core/regional-vote.js?v=20261027-7';

export const OBSERVATORY_VIEWS = Object.freeze([['quadro', 'Quadro'], ['istituti', 'Istituti'], ['segmenti', 'Segmenti e temi'], ['territori', 'Territori'], ['forze', 'Forze e alleanze'], ['candidati', 'Candidati e rivali'], ['flussi', 'Indecisi e flussi'], ['gradimento', 'Gradimento e leggi'], ['scenari', 'Scenari e coalizioni']]);
// The page has five areas; the nine views of the observatory are gathered in them (an area with several views shows them as a second row of tabs).
export const OBSERVATORY_AREAS = Object.freeze([
  ['quadro', 'Quadro elettorale', ['quadro']],
  ['istituti', 'Istituti e rilevazioni', ['istituti']],
  ['territori', 'Territori', ['territori']],
  ['forze', 'Partiti, alleanze e flussi', ['forze', 'scenari', 'flussi', 'segmenti', 'candidati']],
  ['gradimento', 'Opinione pubblica', ['gradimento']]
]);
const VIEW_LABELS = Object.freeze(Object.fromEntries(OBSERVATORY_VIEWS));
const toneOf = value => value > 0 ? 'good' : value < 0 ? 'bad' : 'neutral';
const deltaText = value => `<span class="tone-${toneOf(value)}">${signed(value)}</span>`;
const instituteName = item => item.name.replace('Rilevazione simulata ', 'Istituto ');
const KIND_LABELS = Object.freeze({ reale: 'Forza reale', utente: 'Partito del giocatore', simulata: 'Forza simulata', indipendente: 'Indipendente' });
const REASON_LABELS = Object.freeze({ giocatore: 'il tuo partito', rilevata: 'misurata dagli istituti', emergente: 'forza emergente', 'lista-precedente': 'era in lista alle ultime politiche', 'presenza-regionale': 'presente nella regione', indipendente: 'senza partito' });
const INSIGHT_LABELS = Object.freeze({ 'forte-tra': 'Forte tra', 'debole-tra': 'Debole tra', 'in-crescita': 'In crescita', bacino: 'Bacino contendibile', 'da-recuperare': 'Area da recuperare', 'forte-in': 'Forte in' });
// Short names for the headings of the tables (the full names of the segments are in their own table).
const SHORT_SEGMENTS = Object.freeze({ giovani: 'Giovani', famiglie: 'Famiglie', anziani: 'Pensionati', imprese: 'Autonomi', fragili: 'Redditi bassi' });
const segmentLabel = segment => SHORT_SEGMENTS[segment.id] ?? segment.label;
const shortOf = force => force.isPlayer ? 'Il tuo partito' : force.abbreviation || (String(force.label).length > 18 ? `${String(force.label).slice(0, 17)}…` : force.label);
// Shares under 1% need the second decimal to say anything.
const digitsFor = share => Number(share) < 1 ? 2 : 1;
const twoLines = (title, note) => `<span class="obs-two"><strong>${title}</strong>${note ? `<small>${note}</small>` : ''}</span>`;
const forceCell = (force, logo, note = '') => `<span class="obs-force">${emblem({ label: force.label, abbreviation: force.abbreviation, color: force.color, logo: logo?.(force.id) }, 'sm')}<span><strong>${esc(force.label)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</span></span>`;
const chartSeries = (force, values, emphasis = force.isPlayer) => ({ label: force.label, short: shortOf(force), color: force.color, emphasis, values });

// ---------- what every view reads ----------
function contextOf(state, options) {
  const world = state.world;
  const poll = world ? latestPoll(world) : null;
  const society = observatorySociety(state.society);
  const report = world ? observatoryReport(world, society) : null;
  const forces = report?.forces ?? [];
  const byId = Object.fromEntries(forces.map(force => [force.id, force]));
  const player = forces.find(force => force.isPlayer) ?? null;
  const chosen = options.filters?.obsForce;
  const forceId = byId[chosen] ? chosen : player?.id ?? [...forces].sort((a, b) => b.share - a.share)[0]?.id ?? null;
  let race;
  // The race of the campaign (active or last), read only when a view needs it.
  const raceOf = () => race === undefined ? (race = state.campaign?.candidates?.length ? campaignObservatory(state.campaign, { society }) : null) : race;
  return { state, world, poll, report, forces, byId, player, forceId, force: byId[forceId] ?? null, index: world ? partyIndex(world) : {}, logo: options.logoFor, options, race: raceOf };
}
// A short row of forces to look at: the player's own and the ones that lead, as the average has them.
function leaders(ctx, limit = 6) {
  const share = force => ctx.report?.latestAverage?.rows.find(row => row.partyId === force.id)?.share ?? force.share;
  return [...ctx.forces].sort((a, b) => (b.isPlayer ? 1000 : share(b)) - (a.isPlayer ? 1000 : share(a))).slice(0, limit);
}
const forceChips = ctx => `<div class="obs-chips" role="group" aria-label="Forza da osservare">${leaders(ctx, 8).map(force => `<button type="button" class="obs-chip-btn ${force.id === ctx.forceId ? 'active' : ''}" data-view-filter="obsForce" data-view-filter-value="${esc(force.id)}" aria-pressed="${force.id === ctx.forceId}" title="${esc(force.label)}">${esc(shortOf(force))}</button>`).join('')}</div>`;
const insightChips = (list, limit = 4) => list.length ? list.slice(0, limit).map(item => `<span class="obs-chip obs-${esc(item.kind)}" data-tip="${esc(`${item.text}: ${item.detail}`)}" tabindex="0">${esc(item.text)}</span>`).join('') : '<span class="obs-muted">nessun segnale netto</span>';
const readingOf = (institute, partyId) => institute.latest?.rows.find(row => row.partyId === partyId)?.share ?? null;
// A list of readings: the force, the value with its bar, and what comes with it (change, gap from the average, margin).
const readList = rows => `<div class="obs-reads-wrap"><ul class="obs-reads">${rows.map(row => `<li class="obs-read ${row.player ? 'is-player' : ''}">${row.cell}<span class="obs-read-value"><b>${row.value}</b>${row.bar === undefined ? '' : bar(row.bar, row.tone ?? (row.player ? 'good' : ''), row.max ?? 100)}</span><span class="obs-read-meta">${(row.meta ?? []).map(([label, text]) => `<span><small>${esc(label)}</small>${text}</span>`).join('')}</span></li>`).join('')}</ul></div>`;

// ---------- the average of the institutes ----------
function averageBlock(ctx, { limit = Infinity } = {}) {
  const { report } = ctx;
  const average = report?.latestAverage;
  if (!average) return '<p class="quiet-copy">La prima media compare con il primo sondaggio.</p>';
  const columns = [['pos', 'Pos.'], ['name', 'Forza'], ['avg', 'Media', 'num'], ...report.institutes.map(item => [item.id, instituteName(item).replace('Istituto ', ''), 'num'])];
  const rows = average.rows.filter(row => ctx.byId[row.partyId]).sort((a, b) => b.share - a.share);
  const shown = rows.slice(0, limit);
  const player = rows.find(row => ctx.byId[row.partyId].isPlayer);
  if (player && !shown.includes(player)) shown.push(player);
  const body = shown.map(row => {
    const force = ctx.byId[row.partyId];
    const values = report.institutes.map(item => readingOf(item, row.partyId)).filter(Number.isFinite);
    const range = values.length > 1 ? Math.max(...values) - Math.min(...values) : null;
    const digits = digitsFor(row.share);
    return { _class: force.isPlayer ? 'is-player' : '', pos: `${rows.indexOf(row) + 1}ª`, name: forceCell(force, ctx.logo, force.isPlayer ? 'Il tuo partito' : force.position ?? ''), avg: `<span class="obs-avg"><b>${pct(row.share, digits)}</b> ${deltaText(row.delta)}${range === null ? '' : `<small>forbice ${num(range, 1)}</small>`}</span>`, ...Object.fromEntries(report.institutes.map(item => [item.id, readingOf(item, row.partyId) === null ? '—' : pct(readingOf(item, row.partyId), digits)])) };
  });
  body.push({ pos: '', name: '<span class="obs-force"><span><strong>Altri</strong><small>liste minori e forze non rilevate</small></span></span>', avg: `<b>${pct(average.others)}</b>` });
  const seeded = !average.institutes;
  const note = seeded
    ? average.scenario ? `Questo è il quadro iniziale simulato che hai scelto${average.label ? ` (${esc(average.label)})` : ''}, non la media reale della fonte: gli istituti simulati iniziano a pubblicare dalla prima settimana.` : `Questa è la media reale con cui parte la carriera${average.label ? ` (${esc(average.label)})` : ''}: gli istituti simulati iniziano a pubblicare dalla prima settimana.`
    : `Media pesata sul campione degli ${average.institutes} istituti (${num(average.sample, 0)} interviste in tutto). La forbice è la distanza tra la lettura più alta e la più bassa. Il campione è l’insieme degli intervistati: l’elettorato simulato che vota è un’altra cosa.`;
  return `${table(columns, body, { className: 'obs-average' })}<p class="poll-footnote">${note}</p>`;
}
// The period of the charts: the last 8 weeks, the last 26 or all of them (the same choice for the trend and for the institutes).
const PERIODS = Object.freeze([['8', 'Ultime 8 settimane'], ['26', 'Ultime 26'], ['all', 'Tutto lo storico']]);
const periodOf = ctx => PERIODS.some(([id]) => id === ctx.options.filters?.obsPeriod) ? ctx.options.filters.obsPeriod : '26';
const windowed = (list, ctx) => { const period = periodOf(ctx); return period === 'all' ? list : list.slice(-Number(period)); };
const periodChips = ctx => `<div class="obs-chips" role="group" aria-label="Periodo dei grafici">${PERIODS.map(([id, label]) => `<button type="button" class="obs-chip-btn ${id === periodOf(ctx) ? 'active' : ''}" data-view-filter="obsPeriod" data-view-filter-value="${id}" aria-pressed="${id === periodOf(ctx)}">${esc(label)}</button>`).join('')}</div>`;
function averageTrend(ctx) {
  const { report } = ctx;
  const points = windowed(report?.average ?? [], ctx);
  if ((report?.average ?? []).length < 2) return '<p class="quiet-copy">Il trend compare dalla seconda settimana: chiudi la settimana per la prossima rilevazione.</p>';
  const series = leaders(ctx, 4).map(force => chartSeries(force, points.map(point => point.rows.find(row => row.partyId === force.id)?.share ?? null)));
  return lineChart({ series, labels: points.map(point => `S${point.week}`), tips: points.map(point => `Media · settimana ${point.week}${point.institutes ? ` · ${point.institutes} istituti` : ''}`), unit: '%', min: 0, height: 240, right: 190, ariaLabel: 'Media dei sondaggi, ultime settimane' });
}

// ---------- the quadro ----------
// The average and the readings of the institutes in one block: a coloured bar for each force (the average of the institutes A, B, C and D, in the
// colour of the force) and, beside it, what each institute read. Nothing of this is repeated elsewhere in the quadro.
function instituteBars(ctx, { limit = Infinity } = {}) {
  const { report } = ctx;
  const average = report?.latestAverage;
  if (!average) return '<p class="quiet-copy">La prima media compare con il primo sondaggio.</p>';
  const rows = average.rows.filter(row => ctx.byId[row.partyId]).sort((a, b) => b.share - a.share);
  const shown = rows.slice(0, limit);
  const player = rows.find(row => ctx.byId[row.partyId].isPlayer);
  if (player && !shown.includes(player)) shown.push(player);
  const max = Math.max(...shown.map(row => row.share), average.others, 10);
  const seeded = !average.institutes;
  const names = report.institutes.map(instituteName);
  const head = seeded ? '' : `<div class="obs-bars-head" aria-hidden="true"><span>Forza e media degli istituti</span><span class="obs-bars-readings">${report.institutes.map((item, i) => `<b title="${esc(names[i])}">${esc(item.id.toUpperCase())}</b>`).join('')}</span></div>`;
  const body = shown.map(row => {
    const force = ctx.byId[row.partyId];
    const digits = digitsFor(row.share);
    const values = report.institutes.map(item => readingOf(item, row.partyId));
    const read = values.filter(Number.isFinite);
    const range = read.length > 1 ? Math.max(...read) - Math.min(...read) : null;
    const tip = `${force.label}: media ${pct(row.share, digits)}${values.map((value, i) => Number.isFinite(value) ? ` · ${names[i]} ${pct(value, digitsFor(value))}` : '').join('')}${range === null ? '' : ` · forbice ${num(range, 1)} punti`}`;
    return `<div class="obs-bar-row ${force.isPlayer ? 'is-player' : ''}" data-tip="${esc(tip)}" tabindex="0">${forceCell(force, ctx.logo, force.isPlayer ? 'Il tuo partito' : force.position ?? '')}<span class="obs-bar-track"><i style="width:${row.share / max * 100}%;background-color:${esc(force.color)}"></i></span><span class="obs-bar-avg"><b>${pct(row.share, digits)}</b>${deltaText(row.delta)}</span>${seeded ? '' : `<span class="obs-bars-readings">${values.map((value, i) => `<span title="${esc(names[i])}" data-label="${esc(report.institutes[i].id.toUpperCase())}">${Number.isFinite(value) ? pct(value, digitsFor(value)) : '—'}</span>`).join('')}</span>`}</div>`;
  }).join('');
  const others = `<div class="obs-bar-row is-others"><span class="obs-force"><span><strong>Altri</strong><small>liste minori e forze non rilevate</small></span></span><span class="obs-bar-track"><i style="width:${average.others / max * 100}%;background-color:#4d5752"></i></span><span class="obs-bar-avg"><b>${pct(average.others)}</b></span>${seeded ? '' : '<span class="obs-bars-readings" aria-hidden="true"></span>'}</div>`;
  const note = seeded
    ? average.scenario ? `Questo è il quadro iniziale simulato che hai scelto${average.label ? ` (${esc(average.label)})` : ''}, non la media reale della fonte: gli istituti simulati iniziano a pubblicare dalla prima settimana.` : `Questa è la media reale con cui parte la carriera${average.label ? ` (${esc(average.label)})` : ''}: gli istituti simulati iniziano a pubblicare dalla prima settimana.`
    : `Le barre sono la media pesata dei ${average.institutes} istituti simulati (${num(average.sample, 0)} interviste in tutto), nel colore di ogni forza; a destra la lettura di ciascun istituto (A–D). Passando sulla riga si legge la forbice, cioè la distanza tra la lettura più alta e la più bassa. Il campione è l’insieme degli intervistati: l’elettorato simulato che vota è un’altra cosa.`;
  return `<div class="obs-bars-wrap"><div class="obs-bars ${seeded ? 'no-readings' : ''}">${head}${body}${others}</div></div><p class="poll-footnote">${note}</p>`;
}
function highlights(ctx) {
  const { report } = ctx;
  const order = [...(ctx.player ? [ctx.player] : []), ...leaders(ctx, 4).filter(force => !force.isPlayer).slice(0, 3)];
  const rows = order.map(force => {
    const share = report.latestAverage?.rows.find(row => row.partyId === force.id)?.share ?? force.share;
    return `<li class="obs-insight-row ${force.isPlayer ? 'is-player' : ''}"><div class="obs-insight-head">${forceCell(force, ctx.logo, force.isPlayer ? 'Il tuo partito' : '')}<b>${pct(share, digitsFor(share))}</b>${deltaText(report.trend[force.id] ?? 0)}<small>in 8 sett.</small></div><div class="obs-chips-line">${insightChips(report.insights[force.id] ?? [])}</div></li>`;
  }).join('');
  return `<ul class="obs-insights">${rows}</ul><p class="poll-footnote">Letture del quadro, non effetti: dicono dove il consenso è forte o fragile secondo gli istituti e i segmenti simulati della società. Nessun bonus.</p>`;
}
// The coalitions and the agreements in force, as the sum of what the institutes read for their members (a sum of the readings, not a forecast: see “Scenari e coalizioni”).
function coalitionBlock(ctx) {
  const rows = ctx.report?.latestAverage?.rows ?? [];
  const alliances = (ctx.world?.alliances ?? []).filter(item => item.status === 'active' && (item.partyIds ?? []).length >= 2);
  const entries = alliances.map(item => {
    const members = item.partyIds.map(id => rows.find(row => row.partyId === id)).filter(row => row && ctx.byId[row.partyId]);
    return members.length >= 2 ? { label: item.label, kind: item.kind, leader: ctx.byId[item.leaderId] ?? ctx.byId[members[0].partyId], names: members.map(row => shortOf(ctx.byId[row.partyId])), total: members.reduce((sum, row) => sum + row.share, 0), delta: members.reduce((sum, row) => sum + (row.delta ?? 0), 0) } : null;
  }).filter(Boolean).sort((a, b) => b.total - a.total);
  if (!entries.length) return '';
  const max = Math.max(...entries.map(item => item.total), 10);
  const list = entries.map(item => `<li class="obs-coalition" data-tip="${esc(`${item.label}: ${item.names.join(', ')}`)}" tabindex="0"><span class="obs-two"><strong>${esc(item.label)}</strong><small>${esc(item.names.join(' · '))}</small></span><span class="obs-bar-track"><i style="width:${item.total / max * 100}%;background-color:${esc(item.leader?.color ?? '#8c9a93')}"></i></span><b>${pct(item.total, digitsFor(item.total))}</b>${deltaText(item.delta)}</li>`).join('');
  return pollPanel('COALIZIONI E INTESE · SIMULAZIONE', 'Quanto pesano insieme', `<ul class="obs-coalitions">${list}</ul><p class="poll-footnote">Somma delle letture dei membri nella media degli istituti: una coalizione in lista unica non vale la somma, e l’intesa non è un voto. Gli scenari con i travasi sono in “Partiti, alleanze e flussi”.</p>`);
}
// Who gained and who lost the most since the previous average.
function moversBlock(ctx) {
  const rows = (ctx.report?.latestAverage?.rows ?? []).filter(row => ctx.byId[row.partyId] && Number.isFinite(row.delta));
  const up = rows.filter(row => row.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const down = rows.filter(row => row.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);
  if (!up.length && !down.length) return '<p class="quiet-copy">Nessuna forza si è mossa nell’ultima rilevazione, oppure la media precedente non c’è ancora.</p>';
  const list = (items, tone) => items.length ? `<ul class="obs-movers tone-${tone}">${items.map(row => { const force = ctx.byId[row.partyId]; return `<li>${forceCell(force, ctx.logo, force.isPlayer ? 'Il tuo partito' : '')}<b>${pct(row.share, digitsFor(row.share))}</b>${deltaText(row.delta)}</li>`; }).join('')}</ul>` : '<p class="quiet-copy">Nessuna.</p>';
  return `<div class="poll-grid"><div><h3 class="obs-sub">In crescita</h3>${list(up, 'good')}</div><div><h3 class="obs-sub">In calo</h3>${list(down, 'bad')}</div></div><p class="poll-footnote">Variazione della media degli istituti rispetto alla rilevazione precedente (${ctx.report.previousAverage ? `settimana ${ctx.report.previousAverage.week}` : 'dato non ancora disponibile'}).</p>`;
}
function links(state) {
  const running = state.campaign?.status === 'active';
  const items = [[running ? 'campagna' : 'candidatura', running ? 'Guida la campagna' : 'Candidatura'], ['risultati', 'Ultimo risultato'], ['storico', 'Storico elettorale']];
  return `<div class="obs-links">${items.map(([tab, label]) => `<button type="button" class="text-link" data-section-tab="elezioni" data-section-tab-value="${tab}">${esc(label)} ${arrow}</button>`).join('')}</div>`;
}
function quadro(ctx) {
  const { state, world, poll, report, index, logo, options } = ctx;
  const media = options.media ? pollPanel('MEDIA · SIMULATI', 'Come ti raccontano', options.media()) : '';
  return `${barometer(state, world, poll, { logo })}
    ${pollPanel('INTENZIONI DI VOTO · SIMULAZIONE', 'La media degli istituti e le loro rilevazioni', instituteBars(ctx), `<span class="hq-count">${report.latestAverage?.institutes ? `${report.latestAverage.institutes} istituti` : 'dato reale'}</span>`)}
    ${coalitionBlock(ctx)}
    ${pollPanel('TREND', 'Come cambiano i consensi', `${periodChips(ctx)}${averageTrend(ctx)}`)}
    ${pollPanel('PRINCIPALI MOVIMENTI', 'Chi sale e chi scende', moversBlock(ctx))}
    ${pollPanel('IN EVIDENZA', 'Dove si muovono i consensi', highlights(ctx))}
    ${pollPanel('CRONACA POLITICA', 'Cosa muove i sondaggi', chronicle(world, 6))}${media}${dataTable(world, index)}`;
}

// ---------- the institutes ----------
// How far an institute is from the average (mean of the gaps on the forces above 1%): the house effect, seen from outside.
function gapOf(institute, average) {
  const rows = (institute.latest?.rows ?? []).filter(row => (average?.rows.find(item => item.partyId === row.partyId)?.share ?? 0) >= 1);
  if (!rows.length) return null;
  return rows.reduce((sum, row) => sum + Math.abs(row.share - (average.rows.find(item => item.partyId === row.partyId)?.share ?? row.share)), 0) / rows.length;
}
function comparisonChart(ctx) {
  const { report, force } = ctx;
  if (!force) return '';
  const weeks = windowed(report.average, ctx).map(point => point.week);
  if (report.average.length < 2) return '<p class="quiet-copy">Il confronto tra gli istituti compare dalla seconda settimana.</p>';
  const valueAt = (history, week) => history.find(item => item.week === week)?.rows.find(row => row.partyId === force.id)?.share ?? null;
  const series = [...report.institutes.map((item, i) => ({ label: instituteName(item), short: instituteName(item), color: SERIES[i + 1], emphasis: false, values: weeks.map(week => valueAt(item.history, week)) })), { label: 'Media', short: 'Media', color: SERIES[0], emphasis: true, values: windowed(report.average, ctx).map(point => point.rows.find(row => row.partyId === force.id)?.share ?? null) }];
  return lineChart({ series, labels: weeks.map(week => `S${week}`), tips: weeks.map(week => `${force.label} · settimana ${week}`), unit: '%', min: 0, height: 240, right: 190, digits: digitsFor(force.share), ariaLabel: `${force.label}: ogni istituto e la media` });
}
function methodTable(ctx) {
  const { report } = ctx;
  const rows = report.institutes.map(item => ({ name: twoLines(esc(instituteName(item)), esc(item.mode)), field: `${item.fieldworkDays} giorni · pubblica dopo ${item.lag}`, weighting: esc(item.weighting), sample: item.latest ? `${num(item.latest.sample, 0)} (${num(item.sampleRange[0], 0)}–${num(item.sampleRange[1], 0)})` : `${num(item.sampleRange[0], 0)}–${num(item.sampleRange[1], 0)}`, margin: item.latest?.margin ? `±${num(item.latest.margin, 1)}` : '—', last: item.latest ? `${esc(shortDate(item.latest.date))} · S${item.latest.week}` : 'in attesa', gap: gapOf(item, report.latestAverage) === null ? '—' : `${num(gapOf(item, report.latestAverage), 2)} punti` }));
  return table([['name', 'Istituto'], ['field', 'Campo'], ['weighting', 'Ponderazione'], ['sample', 'Interviste', 'num'], ['margin', 'Margine', 'num'], ['last', 'Ultima'], ['gap', 'Scarto', 'num']], rows);
}
function instituteDetail(ctx, id) {
  const { report } = ctx;
  const institute = report.institutes.find(item => item.id === id);
  if (!institute) return '';
  const head = `<ul class="obs-facts"><li><small>Metodo</small><strong>${esc(institute.mode)}</strong></li><li><small>Interviste</small><strong>${institute.fieldworkDays} giorni di campo, pubblicazione dopo ${institute.lag}</strong></li><li><small>Ponderazione</small><strong>${esc(institute.weighting)}</strong></li><li><small>Campione</small><strong>${num(institute.sampleRange[0], 0)}–${num(institute.sampleRange[1], 0)} interviste${institute.latest ? ` · ultima: ${num(institute.latest.sample, 0)}, margine ±${num(institute.latest.margin, 1)}` : ''}</strong></li></ul><p class="sx-note">${esc(institute.note)} Metodo e istituto sono simulati: non copiano quelli di nessun istituto reale.</p>`;
  if (!institute.latest) return `${card({ kicker: 'ISTITUTO · SIMULATO', title: instituteName(institute), body: head })}${card({ kicker: 'LETTURA', title: 'Nessuna rilevazione ancora', body: '<p class="sx-note">La prima rilevazione di questo istituto arriva con la prima settimana simulata: finora la carriera parte dalla media reale.</p>' })}`;
  const before = institute.history.at(-2);
  const average = report.latestAverage;
  const list = institute.latest.rows.filter(row => ctx.byId[row.partyId]).sort((a, b) => b.share - a.share);
  const top = Math.max(...list.map(row => row.share), 1);
  const rows = list.map(row => {
    const force = ctx.byId[row.partyId];
    const previous = before?.rows.find(item => item.partyId === row.partyId)?.share;
    const gap = average ? row.share - (average.rows.find(item => item.partyId === row.partyId)?.share ?? row.share) : 0;
    const margin = Math.round(1.96 * Math.sqrt(Math.max(0.0004, row.share / 100 * (1 - row.share / 100)) / institute.latest.sample) * 1000) / 10;
    return { player: force.isPlayer, cell: forceCell(force, ctx.logo, force.isPlayer ? 'Il tuo partito' : ''), value: pct(row.share, digitsFor(row.share)), bar: row.share, max: top, meta: [['Variazione', previous === undefined ? '—' : deltaText(row.share - previous)], ['Scarto dalla media', deltaText(gap)], ['Margine', `±${num(margin, 1)}`]] };
  });
  rows.push({ cell: '<span class="obs-force"><span><strong>Altri</strong><small>liste minori e forze non rilevate</small></span></span>', value: pct(institute.latest.others), meta: [] });
  const points = windowed(institute.history, ctx);
  const chart = points.length >= 2 ? lineChart({ series: leaders(ctx, 4).map(force => chartSeries(force, points.map(item => item.rows.find(row => row.partyId === force.id)?.share ?? null))), labels: points.map(item => `S${item.week}`), tips: points.map(item => `${instituteName(institute)} · settimana ${item.week} · ${num(item.sample, 0)} interviste`), unit: '%', min: 0, height: 240, right: 190, ariaLabel: `Andamento delle letture di ${instituteName(institute)}` }) : '<p class="quiet-copy">La storia di questo istituto compare dalla seconda rilevazione.</p>';
  return `${card({ kicker: 'ISTITUTO · SIMULATO', title: instituteName(institute), body: head })}
    ${card({ kicker: `RILEVAZIONE DEL ${formatDate(institute.latest.date, { day: 'numeric', month: 'long' }).toUpperCase()} · SETTIMANA ${institute.latest.week}`, title: 'Che cosa misura', body: `${readList(rows)}<p class="poll-footnote">Variazione: rispetto alla rilevazione precedente dello stesso istituto. Scarto: distanza dalla media degli istituti. Ogni istituto sbaglia a modo suo e in modo costante da una settimana all’altra (errore simulato, dentro il margine): per questo la media, che li compensa, è più affidabile di una sola lettura. Lo scarto dalla media è l’unico segno visibile di quell’errore.</p>` })}
    ${card({ kicker: 'STORIA', title: 'Come sono cambiate le letture', body: `<div class="eh-chart">${chart}</div>` })}`;
}
function institutes(ctx) {
  const { options, report } = ctx;
  const selected = ['confronto', ...POLL_INSTITUTES.map(item => item.id)].includes(options.institute) ? options.institute : 'confronto';
  const chips = `<div class="obs-chips" role="group" aria-label="Istituto">${[['confronto', 'Confronto'], ...report.institutes.map(item => [item.id, instituteName(item)])].map(([id, label]) => `<button type="button" class="obs-chip-btn ${id === selected ? 'active' : ''}" data-section-tab="osservatorio-istituto" data-section-tab-value="${esc(id)}" aria-pressed="${id === selected}">${esc(label)}</button>`).join('')}</div>`;
  const filters = `<div class="obs-filters">${chips}${periodChips(ctx)}</div>`;
  if (selected !== 'confronto') return `${filters}${instituteDetail(ctx, selected)}`;
  return `${filters}
    ${pollPanel('MEDIA E ISTITUTI · SIMULAZIONE', 'La media e le letture di ciascun istituto', averageBlock(ctx))}
    ${ctx.force ? pollPanel('CONFRONTO NEL TEMPO', `${esc(ctx.force.label)}: ogni istituto e la media`, `${forceChips(ctx)}${comparisonChart(ctx)}`) : ''}
    ${pollPanel('METODI', 'Come lavora ciascun istituto', methodTable(ctx))}`;
}

// ---------- segments and themes ----------
function heat(entry, national) {
  const tone = entry.factor >= 1.12 ? 'good' : entry.factor <= 0.88 ? 'bad' : 'neutral';
  const digits = digitsFor(national);
  return `<span class="obs-heat tone-${tone}" data-tip="${esc(`${pct(entry.support, digits)} contro ${pct(national, digits)} in media`)}" tabindex="0">${pct(entry.support, digits)}</span>`;
}
// The themes that count now (the state of each area weighs more where it is in trouble and where it matters to more segments) and, for each segment, its first ones.
function themeBlocks(ctx) {
  const { report } = ctx;
  const seg = report.segments;
  const themes = report.themes;
  const themeList = themes ? `<ol class="obs-list">${themes.national.map(item => `<li><span><strong>${esc(item.label)}</strong><small>stato dell’area ${num(item.value, 0)}/100</small></span>${bar(item.weight, 'warn', Math.max(...themes.national.map(t => t.weight), 1))}</li>`).join('')}</ol>` : '';
  const bySegment = themes && seg ? `<ul class="obs-segment-themes">${seg.segments.map(item => `<li><strong>${esc(item.label)}</strong><span>${(themes.bySegment[item.id] ?? []).map(theme => esc(theme.label)).join(' · ') || '—'}</span></li>`).join('')}</ul>` : '';
  return { themeList, bySegment };
}
function segmentsView(ctx) {
  const { report, force } = ctx;
  const seg = report.segments;
  if (!seg) return card({ kicker: 'SEGMENTI', title: 'Segmenti non disponibili', body: '<p class="sx-note">I segmenti dell’elettorato si leggono dalla società simulata: compaiono con la prima settimana di gioco.</p>' });
  const segmentRows = seg.segments.map(item => ({ name: `<strong>${esc(item.label)}</strong>`, share: `${num(item.share, 0)}%`, satisfaction: `${num(item.satisfaction, 0)}/100`, participation: `${num(item.participation, 0)}%`, trust: `${num(item.trust, 0)}/100`, undecided: `${num(item.undecided, 0)}%` }));
  const columns = [['name', 'Forza'], ['national', 'Media', 'num'], ...seg.segments.map(item => [item.id, segmentLabel(item), 'num'])];
  const heatRows = leaders(ctx, 7).map(item => {
    const national = report.latestAverage?.rows.find(row => row.partyId === item.id)?.share ?? item.share;
    const entries = seg.rows[item.id] ?? [];
    return { _class: item.isPlayer ? 'is-player' : '', name: forceCell(item, ctx.logo, item.isPlayer ? 'Il tuo partito' : ''), national: pct(national, digitsFor(national)), ...Object.fromEntries(entries.map(entry => [entry.id, heat(entry, national)])) };
  });
  const { themeList, bySegment } = themeBlocks(ctx);
  const list = report.insights[force?.id] ?? [];
  const insights = force ? `<ul class="obs-list">${list.map(item => `<li class="obs-insight obs-${esc(item.kind)}"><span><strong>${esc(INSIGHT_LABELS[item.kind] ?? item.kind)}</strong> · ${esc(item.text.replace(/^(forte tra|debole tra|in crescita tra|forte in|bacino contendibile:|area da recuperare:)\s*/i, ''))}<small>${esc(item.detail)}</small></span></li>`).join('') || '<li class="obs-muted">Nessun segnale netto: la forza è vicina alla sua media in tutti i segmenti.</li>'}</ul>` : '';
  return `${pollPanel('SEGMENTI · SIMULAZIONE', 'Chi sono gli elettori', `${table([['name', 'Segmento'], ['share', 'Quota', 'num'], ['satisfaction', 'Soddisfazione', 'num'], ['participation', 'Partecipazione', 'num'], ['trust', 'Fiducia', 'num'], ['undecided', 'Indecisi', 'num']], segmentRows)}<p class="poll-footnote">Sono i segmenti aggregati della società simulata (età e condizione), mai persone reali. La partecipazione è la quota che dice di andare a votare. Genere, titolo di studio, dimensione del comune e nuovi elettori non sono simulati: l’osservatorio non li inventa.</p>`)}
    ${pollPanel('SOSTEGNO PER SEGMENTO', 'Dove ogni forza è più forte', `${table(columns, heatRows, { className: 'obs-heat-table' })}<p class="poll-footnote">Verde: sopra la media della forza; rosso: sotto. Un segmento pesa quanto la sua quota: la media dei segmenti è il dato nazionale.</p>`)}
    <div class="poll-grid">${pollPanel('LETTURE', force ? `${esc(force.label)}: punti di forza e di debolezza` : 'Letture', `${forceChips(ctx)}${insights}`)}${pollPanel('TEMI', 'Che cosa conta ora', `${themeList}${bySegment}<p class="poll-footnote">Un tema pesa di più dove l’area è in difficoltà e dove interessa a più segmenti. Le priorità dei segmenti cambiano con lo stato del Paese.</p>`)}</div>`;
}

// ---------- the territories ----------
function raceTerritories(ctx, race) {
  if (!race?.territories?.length) return '';
  const names = new Map(race.rows.flatMap(row => row.members.map(id => [id, row.label])));
  const playerRow = race.rows.find(row => row.isPlayer);
  const rows = race.territories.map(area => {
    const lead = area.shares[0];
    const mine = area.shares.find(item => playerRow?.members.includes(item.candidateId));
    return { name: `<strong>${esc(area.name)}</strong>`, weight: `${num(area.weight > 1 ? area.weight : area.weight * 100, 0)}%`, lead: lead ? `${esc(names.get(lead.candidateId) ?? 'Candidatura')} · ${pct(lead.share)}` : '—', mine: mine ? pct(mine.share) : '—', trend: deltaText(area.localTrend) };
  });
  return pollPanel('TERRITORI DELLA CORSA · SIMULAZIONE', 'Dove si vince la campagna', `${table([['name', 'Area'], ['weight', 'Peso', 'num'], ['lead', 'In testa'], ['mine', 'La tua quota', 'num'], ['trend', 'Tendenza', 'num']], rows)}<p class="poll-footnote">Le aree sono quelle della campagna in corso; la quota è la proiezione simulata di ogni area. La tendenza è lo scarto locale rispetto al quadro generale.</p>`);
}
// The regional picture of the observatory, as numbers: for the force in view, each region's share (a simulated estimate), its gap from the national figure, its change since
// the first regional picture kept (saved every few weeks) and, where the force ran in 2022, the real vote there. Provinces have no readings in the model: the page says so.
function territoryModel(ctx) {
  const { report, force, world, options } = ctx;
  const regional = report.regional ?? {};
  const history = report.regionalHistory ?? [];
  const regions = Object.keys(regional).sort((a, b) => a.localeCompare(b, 'it'));
  const nationalOf = id => report.latestAverage?.rows.find(row => row.partyId === id)?.share ?? ctx.byId[id]?.share ?? null;
  const national = nationalOf(force.id);
  const snapshotShare = (snapshot, region, id) => snapshot?.rows?.[region]?.find(([partyId]) => partyId === id)?.[1] ?? null;
  const hasChange = history.length >= 2;
  const geography = typeof options.geography === 'function' ? options.geography() : options.geography ?? null;
  const vote2022 = geography ? forceRegionalVote2022(geography, force.id) : null;
  const items = regions.map(region => {
    const raw = regional[region].find(row => row.partyId === force.id)?.share;
    const share = Number.isFinite(raw) ? raw : null;
    const base = hasChange ? snapshotShare(history[0], region, force.id) : null;
    const real = vote2022?.regions?.[region];
    return { region, share, gap: share !== null && Number.isFinite(national) ? share - national : null, change: share !== null && Number.isFinite(base) ? share - base : null, real: Number.isFinite(real) ? real : null };
  });
  const filters = options.filters ?? {};
  const selected = regions.includes(filters.obsRegion) ? filters.obsRegion : regions.includes(world.place.region) ? world.place.region : regions[0];
  const ranked = items.filter(item => item.share !== null).sort((a, b) => b.share - a.share);
  const available = { quota: true, scarto: true, variazione: hasChange, reale: Boolean(vote2022) };
  const mode = TERRITORY_MEASURES.some(([id]) => id === filters.obsMapMode) && available[filters.obsMapMode] ? filters.obsMapMode : 'quota';
  const chosen = filters.obsCompare === undefined ? null : String(filters.obsCompare).split(',').filter(region => regions.includes(region)).slice(0, 4);
  const compare = chosen ?? [...new Set([selected, ranked[0]?.region, ranked.at(-1)?.region].filter(Boolean))];
  const area = MACRO_AREAS.some(([id]) => id === filters.obsArea) ? filters.obsArea : 'tutte';
  const poll = latestPoll(world);
  return { regions, regional, history, items, national, selected, mode, compare, usingDefault: chosen === null, hasChange, ranked, nationalOf, snapshotShare, available, vote2022, area, week: poll?.week ?? world.week, date: poll?.date ?? null };
}
// The line under a chart that says where its figures come from (a simulated estimate, or the real vote of 2022), for which territory and which date.
function sourceLine(model, { territory, real = false } = {}) {
  if (real) return provenance({ kind: 'reale', territory, date: model.vote2022?.date, basis: `${esc(model.vote2022?.source ?? 'Ministero dell’Interno — Eligendo')}: voti di lista della Camera nei collegi, riuniti per regione` });
  return provenance({ kind: 'simulato', territory, week: model.week, date: model.date, basis: 'modello regionale della simulazione (media nazionale degli istituti simulati, scarti regionali del modello ed effetti degli eventi territoriali): non sono rilevazioni reali' });
}
function territoryControls(ctx, model) {
  const { force } = ctx;
  const select = `<label class="obs-select">Regione <select data-view-filter-select="obsRegion">${model.regions.map(name => `<option value="${esc(name)}" ${name === model.selected ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
  const hints = { variazione: 'Serve almeno un secondo quadro regionale', reale: 'Questa forza non è in nessuna lista delle politiche del 2022 (o il documento elettorale non è caricato): nessun dato reale' };
  const modes = `<div class="obs-chips" role="group" aria-label="Misura della cartina">${TERRITORY_MEASURES.map(([id, label]) => `<button type="button" class="obs-chip-btn ${id === model.mode ? 'active' : ''}" data-view-filter="obsMapMode" data-view-filter-value="${id}" aria-pressed="${id === model.mode}" ${model.available[id] ? '' : `disabled title="${esc(hints[id])}"`}>${esc(label)}</button>`).join('')}</div>`;
  const crumbs = `<nav class="obs-crumbs" aria-label="Percorso territoriale"><span>Italia</span><i aria-hidden="true">›</i><strong>${esc(model.selected)}</strong><i aria-hidden="true">›</i><span class="is-missing" title="I sondaggi del gioco sono regionali: non esistono letture per provincia">Province: dato non disponibile</span></nav>`;
  const reality = model.vote2022 ? '' : `<p class="obs-note">${esc(force.label)} non è in nessuna lista delle politiche del 2022: non c’è un dato reale per regione, solo la stima simulata.</p>`;
  return pollPanel('TERRITORIO · SIMULAZIONE E DATO REALE', `${esc(force.label)} in Italia e nelle regioni`, `${crumbs}${forceChips(ctx)}<div class="obs-controls">${modes}${select}</div>${reality}`);
}
function territoryMapPanel(ctx, model) {
  const { force, world } = ctx;
  const digits = digitsFor(model.national ?? 5);
  const real = model.mode === 'reale';
  const map = italyMap(model.items, { mode: model.mode, selected: model.selected, compare: model.compare, home: world.place.region, force: force.label, digits: real ? 1 : digits, national: real ? model.vote2022?.national : model.national, firstWeek: model.history[0]?.week ?? null });
  return pollPanel(real ? 'CARTINA · DATO REALE' : 'CARTINA · SIMULAZIONE', 'Dove è forte e dove no', `${map}${sourceLine(model, { territory: 'venti regioni', real })}<p class="poll-footnote">La cartina è un cartogramma: una tessera per regione, vicine le regioni vicine; non ne rappresenta forma né superficie. Tocca una regione per aprirla.</p>`);
}
// The open territory: the force against the country, how it moved, who it faces there.
function territoryCard(ctx, model) {
  const { force, byId, logo } = ctx;
  const region = model.selected;
  const item = model.items.find(entry => entry.region === region);
  const digits = digitsFor(item?.share ?? 5);
  const rows = (model.regional[region] ?? []).filter(row => byId[row.partyId]).sort((a, b) => b.share - a.share);
  const rank = rows.findIndex(row => row.partyId === force.id) + 1;
  const last = model.history.at(-1), first = model.history[0];
  const kpis = [kpi({ label: `${shortOf(force)} (stima)`, value: pct(item?.share, digits), note: rank ? `${rank}ª forza della regione su ${rows.length}` : 'non rilevata in questa regione' }), kpi({ label: 'Scarto dal dato nazionale', value: item?.gap === null || item?.gap === undefined ? '—' : signed(item.gap, 1), tone: item?.gap >= 0 ? '' : 'warn', note: Number.isFinite(model.national) ? `Italia: ${pct(model.national, digitsFor(model.national))} · punti percentuali` : '' }), kpi({ label: 'Variazione nel tempo', value: item?.change === null || item?.change === undefined ? '—' : signed(item.change, 1), note: model.hasChange ? `punti dalla settimana ${first.week} alla ${last.week}` : 'serve un secondo quadro regionale' })];
  // The real figure next to the estimate: what the ballot boxes said in 2022, where the force ran.
  if (model.vote2022) kpis.push(kpi({ label: 'Voto reale 2022', value: pct(item?.real, 1), note: `${esc(model.vote2022.listName)}${model.vote2022.shared ? ' (lista comune)' : ''} · Italia ${pct(model.vote2022.national, 1)}` }));
  const party = rows.map(row => { const entry = byId[row.partyId]; return { label: entry.label, color: entry.color, share: row.share, national: model.nationalOf(row.partyId), isPlayer: entry.isPlayer, note: entry.isPlayer ? 'Il tuo partito' : entry.position ?? '', logo: emblem({ label: entry.label, abbreviation: entry.abbreviation, color: entry.color, logo: logo?.(entry.id) }, 'sm') }; });
  const rivals = rows.filter(row => row.partyId !== force.id).slice(0, 3).map(row => `<li><strong>${esc(shortOf(byId[row.partyId]))}</strong><b>${pct(row.share, digitsFor(row.share))}</b></li>`).join('');
  return pollPanel(`SCHEDA · ${esc(regionAbbreviation(region))}`, esc(region), `<div class="sx-kpis obs-kpis">${kpis.join('')}</div>${partyBars(party, { digits })}${rivals ? `<div class="obs-rivals"><small>Concorrenti più vicini</small><ul>${rivals}</ul></div>` : ''}${sourceLine(model, { territory: region })}`, region === ctx.world.place.region ? '<span class="hq-count">la tua regione</span>' : '');
}
function territoryRanking(ctx, model) {
  const real = model.mode === 'reale';
  const title = { quota: 'Dove è più forte, dove meno', scarto: 'Sopra e sotto il dato nazionale', variazione: 'Dove cresce e dove cala', reale: 'Il voto reale del 2022, regione per regione' }[model.mode];
  const body = regionBars(model.items, { mode: model.mode, selected: model.selected, home: ctx.world.place.region, national: real ? model.vote2022?.national : model.national, color: real ? 'var(--gold)' : 'var(--teal-soft)', digits: real ? 1 : digitsFor(model.national ?? 5) });
  return pollPanel(real ? 'CLASSIFICA DELLE REGIONI · DATO REALE' : 'CLASSIFICA DELLE REGIONI', title, `${body}${sourceLine(model, { territory: 'venti regioni', real })}<p class="poll-footnote">Le barre sono ordinate per la misura scelta sopra; ogni riga apre la scheda della regione.</p>`);
}
// Territories side by side: the same force in up to four regions over time (against the national average) and the parties of each, as one table.
function territoryCompare(ctx, model) {
  const { force, byId } = ctx;
  const chips = `<div class="obs-chips obs-compare-chips" role="group" aria-label="Territori da confrontare (fino a quattro)">${model.regions.map(region => { const on = model.compare.includes(region); const full = !on && model.compare.length >= 4; return `<button type="button" class="obs-chip-btn ${on ? 'active' : ''}" data-view-filter="obsCompare" data-view-filter-value="${esc((on ? model.compare.filter(item => item !== region) : [...model.compare, region]).join(','))}" aria-pressed="${on}" ${full ? 'disabled' : ''} title="${esc(region)}" aria-label="${esc(region)}">${esc(regionAbbreviation(region))}</button>`; }).join('')}</div>`;
  const note = model.usingDefault ? 'Predefinito: la regione aperta, la più forte e la più debole per questa forza. Scegli le regioni da confrontare.' : model.compare.length < 2 ? 'Scegli almeno due regioni per il confronto.' : '';
  let body = '';
  if (model.compare.length >= 2) {
    const nationalAt = week => (ctx.report.average ?? []).find(item => item.week === week)?.rows.find(row => row.partyId === force.id)?.share ?? null;
    const weeks = model.history.map(snapshot => snapshot.week);
    const lines = model.compare.map((region, i) => ({ label: region, short: regionAbbreviation(region), color: SERIES[i % SERIES.length], emphasis: region === model.selected, values: model.history.map(snapshot => model.snapshotShare(snapshot, region, force.id)) }));
    const national = { label: 'Media nazionale', short: 'Italia', color: '#8c9a93', emphasis: false, values: weeks.map(nationalAt) };
    const chart = weeks.length >= 2 ? lineChart({ series: [...lines, national], labels: weeks.map(week => `S${week}`), tips: weeks.map(week => `${force.label} · settimana ${week}`), unit: '%', min: 0, height: 230, right: 150, ariaLabel: `${force.label}: territori a confronto nel tempo` }) : '<p class="quiet-copy">Il confronto nel tempo compare dopo il secondo quadro regionale (si registra ogni ' + POLL_EXTENSIONS.regional.every + ' settimane).</p>';
    const parties = [...(ctx.report.latestAverage?.rows ?? [])].filter(row => byId[row.partyId]).sort((a, b) => b.share - a.share).slice(0, 6);
    const head = `<tr><th scope="col" class="hm-corner">Forza</th><th scope="col" class="hm-nat" title="Dato nazionale">Italia</th>${model.compare.map(region => `<th scope="col" title="${esc(region)}">${esc(regionAbbreviation(region))}</th>`).join('')}</tr>`;
    const rows = parties.map(row => { const entry = byId[row.partyId]; return `<tr class="${entry.isPlayer ? 'is-player' : ''}"><th scope="row" title="${esc(entry.label)}"><span class="hm-dot" style="background:${esc(entry.color)}"></span><b class="hm-mark">${esc(partyMarkText(entry))}</b><span class="hm-name">${esc(entry.label)}</span></th><td class="hm-nat">${pct(row.share, digitsFor(row.share))}</td>${model.compare.map(region => { const value = model.regional[region]?.find(item => item.partyId === row.partyId)?.share; const gap = Number.isFinite(value) ? value - row.share : null; return `<td data-tip="${esc(`${entry.label} · ${region}: ${Number.isFinite(value) ? pct(value, 1) : 'dato non disponibile'} · stima simulata`)}" tabindex="0"><b>${Number.isFinite(value) ? num(value, 1) : '—'}</b>${gap === null ? '' : `<small class="${gap >= 0 ? 'up' : 'down'}">${signed(gap, 1)}</small>`}</td>`; }).join('')}</tr>`; }).join('');
    const names = `<ul class="hm-names" aria-label="Nomi delle forze">${parties.map(row => { const entry = byId[row.partyId]; return `<li><span class="hm-dot" style="background:${esc(entry.color)}"></span><b>${esc(partyMarkText(entry))}</b> ${esc(entry.label)}</li>`; }).join('')}</ul>`;
    body = `<div class="eh-chart">${chart}</div><div class="hm-block"><div class="hm-wrap" role="region" aria-label="Forze nei territori a confronto" tabindex="0"><table class="hm hm-compare"><thead>${head}</thead><tbody>${rows}</tbody></table></div>${names}</div>`;
  }
  return pollPanel('CONFRONTO TRA TERRITORI · SIMULAZIONE', 'Più regioni, una forza', `${chips}${note ? `<p class="quiet-copy">${esc(note)}</p>` : ''}${body}<p class="itmap-meaning">Le linee sono la quota di consenso di ${esc(force.label)} (%) nelle regioni scelte e la media nazionale. Nella tabella: quota (%) e, sotto, lo scarto in punti dalla media nazionale della stessa forza; un trattino (—) è un dato non disponibile.</p>${sourceLine(model, { territory: model.compare.join(', ') || '—' })}<p class="poll-footnote">Il quadro regionale si registra a intervalli: le linee mostrano solo i punti realmente registrati.</p>`);
}
// Parties × regions: where each force is stronger or weaker than its own national figure; the regions can be taken a few at a time (ripartizioni).
function territoryHeat(ctx, model) {
  const { byId } = ctx;
  const parties = [...(ctx.report.latestAverage?.rows ?? [])].filter(row => byId[row.partyId]).sort((a, b) => b.share - a.share).slice(0, 8);
  const shown = regionsOfArea(model.area).filter(region => model.regions.includes(region));
  const columns = shown.map(region => ({ label: region, short: regionAbbreviation(region), home: region === ctx.world.place.region }));
  const rows = parties.map(row => { const entry = byId[row.partyId]; return { label: entry.label, mark: partyMarkText(entry), color: entry.color, national: row.share, isPlayer: entry.isPlayer, cells: shown.map(region => { const share = model.regional[region]?.find(item => item.partyId === row.partyId)?.share; return { region, share: Number.isFinite(share) ? share : null, gap: Number.isFinite(share) ? share - row.share : null }; }) }; });
  const areas = `<div class="obs-chips" role="group" aria-label="Regioni da mostrare">${MACRO_AREAS.map(([id, label]) => `<button type="button" class="obs-chip-btn ${id === model.area ? 'active' : ''}" data-view-filter="obsArea" data-view-filter-value="${id}" aria-pressed="${id === model.area}">${esc(label)}</button>`).join('')}</div>`;
  return pollPanel('MAPPA DI CALORE · SIMULAZIONE', 'Forze e regioni a colpo d’occhio', `${areas}${heatmap({ columns, rows })}${sourceLine(model, { territory: MACRO_AREAS.find(([id]) => id === model.area)?.[1] ?? 'Tutta Italia' })}`);
}
function territoryMissing(model) {
  const items = ['Province e città metropolitane: il modello dei sondaggi arriva alla regione, non ha letture provinciali (la Provincia esiste come ente da amministrare, in Territori).', 'Rilevazioni reali per regione: nessun istituto reale pubblica nel gioco un dato regionale; il solo dato reale per regione è il voto delle politiche del 2022, nella misura «Voto reale 2022».', 'Mappa con i confini: le geometrie delle regioni non fanno parte dei dati del gioco; la cartina è un cartogramma a tessere.', model.hasChange ? null : 'Variazione nel tempo: serve un secondo quadro regionale (registrato ogni poche settimane).'].filter(Boolean);
  return `<details class="obs-missing"><summary>Che cosa manca, e perché</summary><ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></details>`;
}
function territories(ctx) {
  const { force } = ctx;
  if (!force) return empty('Nessuna forza da osservare.');
  if (!Object.keys(ctx.report.regional ?? {}).length) return empty('Il quadro regionale compare con la prima settimana di gioco: gli istituti simulati lo leggono ogni poche settimane.');
  const model = territoryModel(ctx);
  return `${territoryControls(ctx, model)}
    <div class="obs-terr-grid">${territoryMapPanel(ctx, model)}${territoryCard(ctx, model)}</div>
    ${territoryRanking(ctx, model)}
    ${territoryCompare(ctx, model)}
    ${territoryHeat(ctx, model)}
    ${raceTerritories(ctx, ctx.race())}
    ${territoryMissing(model)}`;
}

// ---------- the forces and the alliances ----------
function forces(ctx) {
  const { state, world, poll, options, index, logo } = ctx;
  const win = options.window?.() ?? { open: true };
  const notice = win.open === false
    ? card({ kicker: 'ALLEANZE · SIMULAZIONE', title: 'Intese ferme fino al voto', tone: 'warn', body: `<p class="sx-note">${esc(win.reason)}</p>` })
    : '';
  const grid = forcesGrid(state, world, poll, index, logo, options.realLeader, options.secretary, { allianceOdds: options.allianceOdds, kindOf: options.kindOf, windowClosed: win.open === false });
  return `${notice}${pollPanel('PARTITI, MOVIMENTI E COALIZIONI · COMPORTAMENTI SIMULATI', 'Le forze in campo', grid)}
    ${pollPanel('PRESENZA NEI SONDAGGI · SIMULAZIONE', 'Chi entra e chi esce', presencePanel(world))}
    <div class="poll-grid">${pollPanel('ALLEANZE · SIMULATE', 'Intese, coalizioni e rotture', alliancesList(world, index))}${pollPanel('STRATEGIE · SIMULATE', 'Chi sta dove', strategyList(world))}</div>
    <p class="poll-footnote">Un partito, un movimento e una coalizione o lista comune (come Alleanza Verdi e Sinistra) sono cose diverse: la lista è una forza che si presenta al voto con i suoi componenti, che restano partiti a sé. Un’intesa elettorale lega due forze, una coalizione tre o più; il sostegno a un governo è un’altra cosa e si legge nella sezione Governo.</p>`;
}

// ---------- the candidates of the race ----------
function raceTable(ctx, race) {
  const columns = [['pos', 'Pos.'], ['name', 'Candidatura'], ['avg', 'Media', 'num'], ...race.institutes.map(item => [item.id, instituteName(item).replace('Istituto ', ''), 'num']), ['proj', 'Proiezione', 'num']];
  const rows = race.rows.map((row, index) => {
    const note = [row.person ? `${row.person} (parlamentare in carica)` : null, row.isPlayer ? (ctx.player?.label ?? 'Senza partito') : KIND_LABELS[row.partyKind] ?? 'Candidatura', row.rosterReason && !row.isPlayer ? REASON_LABELS[row.rosterReason] : null, row.surveyed === false && row.partyKind === 'reale' ? 'non rilevata dagli istituti nazionali' : null].filter(Boolean).join(' · ');
    // The force is named as the polls name it (same ids, same labels), the candidacy of the player and the independents by their own name.
    const force = row.partyId ? ctx.byId[row.partyId] : null;
    const name = row.isPlayer || !force ? row.label : force.label;
    const logo = row.partyId ? ctx.logo?.(row.partyId) : null;
    const initial = (name.match(/\p{L}/u)?.[0] ?? 'C').toUpperCase();
    const digits = digitsFor(row.poll ?? row.projection);
    return { _class: row.isPlayer ? 'is-player' : '', pos: `${index + 1}ª`, name: `<span class="obs-force">${emblem({ label: name, abbreviation: force?.abbreviation ?? initial, color: force?.color ?? (row.isPlayer ? 'var(--party-accent)' : null), logo }, 'sm')}<span><strong>${esc(name)}</strong><small>${esc(note)}</small></span></span>`, avg: `<span class="obs-avg"><b>${pct(row.poll ?? row.projection, digits)}</b> ${deltaText(row.delta)}</span>`, proj: pct(row.projection, digits), ...Object.fromEntries(race.institutes.map(item => { const value = item.latest?.rows.find(entry => entry.partyId === row.id)?.share; return [item.id, value === undefined ? '—' : pct(value, digits)]; })) };
  });
  return table(columns, rows, { className: 'obs-average has-proj' });
}
function raceInsights(ctx, race) {
  const player = race.rows.find(row => row.isPlayer);
  const seg = race.segments;
  if (!player || !seg?.rows[player.id]) return '<p class="quiet-copy">I segmenti della corsa compaiono con la prima onda di sondaggi.</p>';
  const ranked = [...seg.rows[player.id]].sort((a, b) => b.factor - a.factor);
  const name = id => segmentLabel(seg.segments.find(item => item.id === id) ?? { id, label: id });
  const own = player.poll ?? player.projection;
  const strong = ranked.filter(item => item.factor >= 1.08).slice(0, 2).map(item => `<li class="obs-insight obs-forte-tra"><span><strong>Forte tra</strong> · ${esc(name(item.id).toLowerCase())}<small>${pct(item.support, digitsFor(own))} contro ${pct(own, digitsFor(own))} in media</small></span></li>`);
  const weak = [...ranked].reverse().filter(item => item.factor <= 0.92).slice(0, 2).map(item => `<li class="obs-insight obs-debole-tra"><span><strong>Debole tra</strong> · ${esc(name(item.id).toLowerCase())}<small>${pct(item.support, digitsFor(own))} contro ${pct(own, digitsFor(own))} in media</small></span></li>`);
  const audience = Object.entries(race.audience ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => name(id).toLowerCase());
  return `<ul class="obs-list">${[...strong, ...weak].join('') || '<li class="obs-muted">La tua candidatura è vicina alla media in tutti i segmenti.</li>'}</ul>${audience.length ? `<p class="sx-note">Hai parlato soprattutto a: ${esc(audience.join(' e '))}.</p>` : ''}`;
}
function candidates(ctx) {
  const { state } = ctx;
  const campaign = state.campaign;
  const race = campaign && campaign.status !== 'idle' ? ctx.race() : null;
  if (!race || !race.rows.length) {
    return `${card({ kicker: 'CORSA · SIMULAZIONE', title: 'Nessuna campagna in corso', body: '<p class="sx-note">Gli avversari diretti si conoscono all’avvio della campagna: in un voto politico o europeo sono le forze che davvero si presentano, in uno locale cambiano da territorio a territorio. Intanto, le forze nazionali:</p>' })}
      ${pollPanel('FORZE NAZIONALI', 'La media dei sondaggi', averageBlock(ctx))}`;
  }
  const phase = campaign.status === 'active' ? (campaign.stage === 'ballottaggio' ? 'Ballottaggio in corso: i sondaggi chiedono il testa a testa' : 'Campagna in corso') : 'Corsa conclusa';
  const trendPoints = race.average;
  const chart = trendPoints.length >= 2 ? lineChart({ series: race.rows.slice(0, 6).map((row, i) => { const force = row.partyId ? ctx.byId[row.partyId] : null; return { label: row.isPlayer ? 'La tua candidatura' : force?.label ?? row.label, short: row.isPlayer ? 'Tu' : force ? shortOf(force) : row.label.slice(0, 14), color: (force?.color) || SERIES[i % SERIES.length], emphasis: row.isPlayer, values: row.series }; }), labels: trendPoints.map(point => `G${point.day}`), tips: trendPoints.map(point => `Giorno ${point.day}${point.stage === 'ballottaggio' ? ' · ballottaggio' : ''}`), unit: '%', min: 0, height: 240, right: 190, ariaLabel: 'La corsa: media degli istituti' }) : '<p class="quiet-copy">Il trend della corsa compare dalla seconda onda di sondaggi.</p>';
  const roster = race.roster?.participants ?? [];
  const kinds = { reale: 0, utente: 0, simulata: 0, indipendente: 0 };
  for (const row of race.rows) if (!row.isPlayer) kinds[row.partyKind] = (kinds[row.partyKind] ?? 0) + 1;
  const parts = [kinds.reale ? `${kinds.reale} di forze reali` : null, kinds.utente ? `${kinds.utente} di partiti creati dai giocatori` : null, kinds.simulata ? `${kinds.simulata} di forze simulate` : null, kinds.indipendente ? `${kinds.indipendente} indipendenti` : null].filter(Boolean);
  const summary = `In corsa con te ${race.rows.length - 1 === 1 ? 'c’è 1 candidatura' : `ci sono ${race.rows.length - 1} candidature`}${parts.length ? `: ${parts.join(', ')}` : ''}${roster.length ? `. Il campo segue chi si presenta davvero a questo voto (${roster.length} forze nel ruolo)` : ''}.`;
  const samples = race.institutes.map(item => ({ name: twoLines(esc(instituteName(item)), esc(item.mode)), sample: item.latest ? num(item.latest.sample, 0) : '—', margin: item.latest?.margin ? `±${num(item.latest.margin, 1)}` : '—', last: item.latest ? `giorno ${item.latest.day}` : 'in attesa' }));
  const flows = race.flows.length ? `<ul class="obs-list">${race.flows.slice(0, 4).map(flow => `<li><span><strong>${esc(race.rows.find(row => row.id === flow.from)?.label ?? 'Altri')}</strong> → ${esc(race.rows.find(row => row.id === flow.to)?.label ?? 'Altri')}<small>${num(flow.points, 1)} punti nell’ultima settimana</small></span>${bar(flow.points, 'good', Math.max(...race.flows.map(item => item.points), 0.1))}</li>`).join('')}</ul>` : '<p class="quiet-copy">Nessun travaso netto nell’ultima settimana.</p>';
  const attese = Number.isFinite(race.expectation) && Number.isFinite(race.playerShare) ? ` Attesa iniziale ${pct(race.expectation, digitsFor(race.expectation))}, oggi ${pct(race.playerShare, digitsFor(race.playerShare))} nella media degli istituti.` : '';
  return `${card({ kicker: `${phase.toUpperCase()} · ${esc(campaign.electionLabel).toUpperCase()}`, title: 'I sondaggi della corsa', body: `<p class="sx-note">${esc(summary)}${esc(attese)} ${campaign.status === 'active' ? 'Gli istituti rilevano ogni settimana fino al voto (e nel ballottaggio) con campioni proporzionati alla corsa: la campagna cambia le letture, ma una lettura non sposta nulla.' : 'Questa è l’ultima rilevazione prima del voto: il risultato è nella sezione Risultati.'}</p><div class="sx-actions">${campaign.status === 'active' ? '<button type="button" class="secondary-button" data-section-tab="elezioni" data-section-tab-value="campagna">Torna alla campagna</button>' : '<button type="button" class="secondary-button" data-section-tab="elezioni" data-section-tab-value="risultati">Vai ai risultati</button>'}</div>` })}
    ${pollPanel('MEDIA E ISTITUTI · SIMULAZIONE', 'Chi è in corsa', `${raceTable(ctx, race)}<p class="poll-footnote">La proiezione è il consenso della campagna; i sondaggi lo leggono con il loro errore. Le persone reali mostrano solo dati verificati: nomi, partiti e cariche; i numeri sono simulati.</p>`, `<span class="hq-count">${race.waves} ${race.waves === 1 ? 'onda' : 'onde'}</span>`)}
    ${pollPanel('TREND', 'Come si muove la corsa', `<div class="eh-chart">${chart}</div>`)}
    <div class="poll-grid">${pollPanel('SEGMENTI', 'Dove cresce la tua candidatura', raceInsights(ctx, race))}${pollPanel('TRAVASI', 'Chi guadagna da chi', flows)}</div>
    ${pollPanel('ISTITUTI', 'Campioni della corsa', table([['name', 'Istituto'], ['sample', 'Interviste', 'num'], ['margin', 'Margine', 'num'], ['last', 'Ultima onda']], samples))}`;
}

// ---------- the undecided and the flows ----------
function flussi(ctx) {
  const { report, world, poll, force } = ctx;
  const polls = world.polls.slice(-16);
  const previous = world.polls.at(-2);
  const undecidedChart = polls.length >= 2 ? lineChart({ series: [{ label: 'Indecisi', short: 'Indecisi', color: SERIES[3], emphasis: true, values: polls.map(item => item.undecided) }], labels: polls.map(item => `S${item.week}`), tips: polls.map(item => `Settimana ${item.week}`), unit: '%', height: 190, right: 190, ariaLabel: 'Quota di indecisi nei sondaggi' }) : '';
  const bySegment = report.segments ? `<div class="breakdown">${report.segments.segments.map(item => `<div class="breakdown-row" data-tip="${esc(`${item.label}: ${num(item.undecided, 0)}% di indecisi`)}" tabindex="0"><span>${esc(segmentLabel(item))}</span><b><i style="width:${Math.min(100, item.undecided)}%;background:var(--party-accent)"></i></b><strong>${num(item.undecided, 0)}%</strong></div>`).join('')}</div>` : '';
  const name = id => id === 'astensione' ? 'Resterebbe a casa' : report.forces.find(item => item.id === id)?.label ?? id;
  const second = force ? (report.secondChoice[force.id] ?? []).slice(0, 6) : [];
  const secondList = second.length ? `<ol class="obs-list">${second.map(item => `<li><span><strong>${esc(name(item.id))}</strong></span><b>${pct(item.share)}</b>${bar(item.share, item.id === 'astensione' ? 'warn' : '', Math.max(...second.map(s => s.share), 1))}</li>`).join('')}</ol>` : '<p class="quiet-copy">Nessuna indicazione.</p>';
  const flows = report.flows.length ? `<ul class="obs-list">${report.flows.map(flow => `<li><span><strong>${esc(name(flow.from))}</strong> → <strong>${esc(name(flow.to))}</strong><small>${num(flow.points, 2)} punti questa settimana</small></span>${bar(flow.points, 'good', Math.max(...report.flows.map(item => item.points), 0.1))}</li>`).join('')}</ul>` : '<p class="quiet-copy">Nessun travaso netto nell’ultima rilevazione: le variazioni sono tutte sotto la soglia.</p>';
  const loyalty = readList(leaders(ctx, 8).map(item => ({ player: item.isPlayer, cell: forceCell(item, ctx.logo, item.isPlayer ? 'Il tuo partito' : ''), value: `${num(report.loyalty[item.id], 0)}%`, bar: report.loyalty[item.id], tone: report.loyalty[item.id] < 75 ? 'warn' : 'good', meta: [['In 8 settimane', deltaText(report.trend[item.id] ?? 0)]] })));
  const kpis = [kpi({ label: 'Indecisi', value: pct(poll.undecided, 0), note: previous ? `${signed(poll.undecided - previous.undecided)} nell’ultima rilevazione · fuori dai voti validi` : 'fuori dai voti validi', tone: poll.undecided > 30 ? 'warn' : '' }), force ? kpi({ label: `Fedeltà · ${shortOf(force)}`, value: `${num(report.loyalty[force.id], 0)}%`, bar: report.loyalty[force.id], note: 'chi confermerebbe oggi lo stesso voto' }) : '', second[0] ? kpi({ label: 'Seconda scelta principale', value: esc(name(second[0].id)), note: `${pct(second[0].share)} di chi vota ${esc(shortOf(force))} oggi` }) : ''].join('');
  return `${card({ body: `<div class="sx-kpis obs-kpis">${kpis}</div>` })}
    ${pollPanel('INDECISI · SIMULAZIONE', 'Quanti non hanno ancora scelto', `${undecidedChart}<p class="poll-footnote">Gli indecisi sono fuori dal totale dei voti validi; si concentrano dove la fiducia nelle istituzioni è più bassa.</p>`)}
    <div class="poll-grid">${pollPanel('INDECISI PER SEGMENTO', 'Dove si nascondono', bySegment || '<p class="quiet-copy">I segmenti compaiono con la prima settimana.</p>')}${pollPanel('TRAVASI', 'Chi guadagna da chi', `${flows}<p class="poll-footnote">I punti persi dalle forze che calano raggiungono quelle che crescono, in proporzione alla vicinanza: è una lettura delle variazioni, non un dato di sondaggio.</p>`)}</div>
    <div class="poll-grid">${pollPanel('SECONDA SCELTA', force ? `Dove andrebbero gli elettori di ${esc(shortOf(force))}` : 'Seconda scelta', `${forceChips(ctx)}${secondList}`)}${pollPanel('FEDELTÀ DEL VOTO', 'Quanto sono solidi i consensi', loyalty)}</div>`;
}

// ---------- approval and laws ----------
// Three different things, kept apart: the voting intentions (who people would vote for), the approval (how they judge the Government and the leader, whoever they vote for) and the
// results (what the ballot boxes said). Approval of a single law is a fourth reading, on one measure.
const THREE = [['INTENZIONI DI VOTO', 'Per chi voterebbero oggi: la media degli istituti, in “Quadro”.'], ['GRADIMENTO', 'Come giudicano il Governo e il leader, anche chi vota altrove: qui sotto.'], ['RISULTATI', 'Quello che hanno detto le urne: in Elezioni → Ultimo risultato.']];
function approvalChart(ctx) {
  const points = ctx.report.approval ?? [];
  if (points.length < 2) return '<p class="quiet-copy">Il gradimento si registra ogni settimana: l’andamento compare dalla seconda rilevazione.</p>';
  const series = [['government', 'Governo', '#d9b25f', true], ['leader', ctx.player ? 'Il tuo gradimento personale' : 'Leader', '#7FB8D6', false], ['executive', 'Esecutivo di scenario', '#9aa89f', false]].map(([key, label, color, emphasis]) => ({ label, short: label.length > 18 ? label.slice(0, 17) + '…' : label, color, emphasis, values: points.map(point => point[key] ?? null) })).filter(item => item.values.some(Number.isFinite));
  const last = points.at(-1);
  return `${lineChart({ series, labels: points.map(point => `S${point.week}`), tips: points.map(point => `Gradimento · settimana ${point.week}${point.margin ? ` · ±${num(point.margin, 1)} punti` : ''}`), unit: '%', min: 0, max: 100, height: 230, right: 170, ariaLabel: 'Gradimento del Governo e del leader nel tempo' })}<p class="poll-footnote">Ultima rilevazione (S${last.week}): ${[last.government !== null ? `Governo ${num(last.government, 0)}%` : null, last.leader !== null ? `leader ${num(last.leader, 0)}%` : null, last.executive !== null ? `esecutivo di scenario ${num(last.executive, 0)}%` : null].filter(Boolean).join(' · ')}${last.margin ? `, con un margine di ±${num(last.margin, 1)} punti` : ''}. Il gradimento non è un voto: chi approva può votare un’altra forza.</p>`;
}
function lawBlock(law) {
  const last = law.surveys.at(-1);
  const rows = law.surveys.map(survey => `<li><span><strong>${esc(survey.label)}</strong><small>S${survey.week} · ${esc(formatDate(survey.date))}</small></span><span class="obs-law-bar" role="img" aria-label="${esc(`Favorevoli ${num(survey.approval, 0)}%, contrari ${num(survey.against, 0)}%, indecisi ${num(survey.undecided, 0)}%`)}"><i class="for" style="width:${survey.approval}%"></i><i class="und" style="width:${survey.undecided}%"></i><i class="against" style="width:${survey.against}%"></i></span><b>${num(survey.approval, 0)}% sì · ${num(survey.against, 0)}% no · ${num(survey.undecided, 0)}% indecisi <small>±${num(survey.margin, 1)}</small></b></li>`).join('');
  const segments = `<details class="obs-law-detail"><summary>Per chi è più o meno gradita (tra chi ha scelto)</summary><ul>${last.bySegment.map(item => `<li><span>${esc(item.label)}</span>${bar(item.approval, item.approval >= 55 ? 'good' : item.approval <= 40 ? 'bad' : '')}<b>${num(item.approval, 0)}%</b></li>`).join('')}</ul><small>Letto da chi ci guadagna e da chi ci perde, e da quanto il segmento si riconosce nel Governo: ${last.institutes.map(item => `Istituto ${item.id.toUpperCase()} ${num(item.approval, 0)}% su ${num(item.sample, 0)}`).join(' · ')}.</small></details>`;
  return `<article class="obs-law ${last.verdict}"><header><strong>${esc(law.title)}</strong><small>${esc(law.category ?? '')}${law.origin ? ` · ${law.origin === 'giocatore' ? 'tua iniziativa' : esc(law.origin)}` : ''} · in vigore dalla S${law.week}</small><span class="badge">${last.verdict === 'contrari' ? 'Bocciata dai cittadini' : last.verdict === 'favorevoli' ? 'Approvata dai cittadini' : 'Opinione divisa'}</span></header><ul class="obs-law-surveys">${rows}</ul>${segments}</article>`;
}
// How the country judges what it lives, as the society of the game models it (satisfaction, trust in the institutions, expected turnout), week by week.
function trustBlock(ctx) {
  const history = ctx.state.society?.history ?? [];
  if (history.length < 2) return pollPanel('FIDUCIA E GIUDIZIO · SIMULAZIONE', 'Soddisfazione e fiducia nelle istituzioni', '<p class="quiet-copy">Gli indicatori della società si registrano ogni settimana: l’andamento compare dalla seconda.</p>');
  const points = windowed(history, ctx);
  const series = [['satisfaction', 'Soddisfazione dei cittadini', SERIES[0], true], ['trust', 'Fiducia nelle istituzioni', SERIES[1], false], ['participation', 'Partecipazione attesa', SERIES[3], false]].map(([key, label, color, emphasis]) => ({ label, short: label.length > 18 ? `${label.slice(0, 17)}…` : label, color, emphasis, values: points.map(item => Number.isFinite(item[key]) ? item[key] : null) }));
  const last = history.at(-1);
  const kpis = [kpi({ label: 'Soddisfazione', value: `${num(last.satisfaction, 0)}/100` }), kpi({ label: 'Fiducia nelle istituzioni', value: `${num(last.trust, 0)}/100` }), kpi({ label: 'Partecipazione attesa', value: `${num(last.participation, 0)}%` })].join('');
  return pollPanel('FIDUCIA E GIUDIZIO · SIMULAZIONE', 'Soddisfazione e fiducia nelle istituzioni', `<div class="sx-kpis obs-kpis">${kpis}</div>${periodChips(ctx)}${lineChart({ series, labels: points.map(item => `S${item.week}`), tips: points.map(item => `Settimana ${item.week}`), unit: '', min: 0, max: 100, height: 220, right: 170, ariaLabel: 'Soddisfazione, fiducia e partecipazione attesa nel tempo' })}<p class="poll-footnote">Sono indicatori della società simulata (cittadini, non elettori di un partito): si muovono con leggi, crisi, economia e media. La partecipazione è la quota che dice di andare a votare.</p>`);
}
function themesBlock(ctx) {
  const { themeList, bySegment } = themeBlocks(ctx);
  if (!themeList) return '';
  return pollPanel('TEMI · SIMULAZIONE', 'Che cosa conta ora per i cittadini', `${themeList}${bySegment}<p class="poll-footnote">Un tema pesa di più dove l’area è in difficoltà e dove interessa a più segmenti. Il dettaglio dei segmenti è in “Partiti, alleanze e flussi”.</p>`);
}
function gradimento(ctx) {
  const { report } = ctx;
  const three = `<div class="obs-three">${THREE.map(([title, text]) => `<div><small>${title}</small><p>${text}</p></div>`).join('')}</div>`;
  const laws = (report.laws ?? []).filter(law => law.surveys.length);
  return `${pollPanel('TRE MISURE DIVERSE · SIMULAZIONE', 'Voto, gradimento, risultato: non sono la stessa cosa', three)}
    ${pollPanel('GRADIMENTO · SIMULAZIONE', 'Governo e leader nel tempo', approvalChart(ctx))}
    ${trustBlock(ctx)}
    ${themesBlock(ctx)}
    ${pollPanel('LEGGI E POLITICHE · SIMULAZIONE', 'Che cosa pensano dei provvedimenti in vigore', laws.length ? `<div class="obs-laws">${laws.map(lawBlock).join('')}</div><p class="poll-footnote">Per ogni legge in vigore gli istituti interrogano i cittadini una settimana dopo e dopo due mesi. Il risultato è una stima, con il margine del campione e quello del modello: non è un voto e da solo non cambia nulla. Se il giudizio è netto, il Governo e gli alleati ne tengono conto una volta, in modo limitato e senza accumularsi.</p>` : '<p class="quiet-copy">Nessuna legge in vigore da misurare: quando ne entra una, gli istituti la valutano.</p>')}`;
}

// ---------- scenarios: running alone against coalitions ----------
function scenarioCard(scenario, solo) {
  const width = value => Math.max(0, Math.min(100, value * 2.2));
  const gain = scenario.gain;
  return `<article class="obs-scenario"><header><strong>${esc(scenario.label)}</strong><small>${scenario.rows.length > 1 ? `${scenario.rows.length} forze · guida ${esc(scenario.rows.find(row => row.id === scenario.leaderId)?.label ?? '')}` : 'corsa solitaria'}</small></header>
    <div class="obs-range" role="img" aria-label="${esc(`${scenario.label}: ${num(scenario.total, 1)}% (da ${num(scenario.low, 1)} a ${num(scenario.high, 1)})`)}"><i class="band" style="left:${width(scenario.low)}%;width:${Math.max(1, width(scenario.high) - width(scenario.low))}%"></i><i class="dot" style="left:${width(scenario.total)}%"></i></div>
    <p><b>${num(scenario.total, 1)}%</b> <small>(tra ${num(scenario.low, 1)} e ${num(scenario.high, 1)}, incertezza ±${num(scenario.uncertainty, 1)})</small>${scenario.rows.length > 1 ? ` · ${gain >= 0 ? '+' : '−'}${num(Math.abs(gain), 1)} rispetto alla forza guida da sola (${num(scenario.solo, 1)}%) · ${num(scenario.lost, 1)} punti si perdono per strada` : ''}</p>
    ${scenario.rows.length > 1 ? `<details class="obs-law-detail"><summary>Chi porta quanto</summary><ul>${scenario.rows.map(row => `<li><span>${esc(row.label)}</span><b>${num(row.share, 1)}% → ${num(row.kept, 1)}%</b><small>${row.leak ? `−${num(row.leak * 100, 0)}% per la distanza dalla forza guida` : 'forza guida'}</small></li>`).join('')}</ul></details>` : ''}</article>`;
}
function scenari(ctx) {
  const { report, force } = ctx;
  const forces = report.scenarioForces ?? [];
  if (!forces.length) return empty('Gli scenari si calcolano sulla media degli istituti: compaiono con la prima settimana.');
  const chosen = String(ctx.options.filters?.obsMembers ?? '').split(',').filter(id => forces.some(item => item.id === id));
  const toggled = id => (chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id]).join(',');
  const lead = forces.find(item => item.id === ctx.forceId) ?? forces[0];
  const picker = `<div class="obs-chips" role="group" aria-label="Forze della coalizione ipotetica">${forces.slice().sort((a, b) => b.share - a.share).slice(0, 12).map(item => `<button type="button" class="obs-chip-btn ${chosen.includes(item.id) ? 'active' : ''}" data-view-filter="obsMembers" data-view-filter-value="${esc(toggled(item.id))}" aria-pressed="${chosen.includes(item.id)}">${esc(shortOf(item))} <small>${num(item.share, 1)}%</small></button>`).join('')}</div>`;
  const custom = chosen.length >= 1 ? coalitionScenario({ memberIds: chosen, leaderId: chosen.includes(lead.id) ? lead.id : null, forces, ties: ctx.world?.ties ?? {}, label: 'La tua coalizione ipotetica' }) : null;
  const defaults = report.scenarios ?? [];
  const solo = defaults.find(item => item.id === 'solo');
  return `${pollPanel('SCENARI · SIMULAZIONE', 'Da soli o in coalizione', `<div class="obs-scenarios">${defaults.map(item => scenarioCard(item, solo)).join('')}</div><p class="poll-footnote">Una coalizione non somma i voti: una parte degli elettori di una forza non vota la lista di un’altra, tanto più quanto è lontana sull’asse politico. Gli scenari sono proiezioni delle intenzioni di voto con la loro incertezza: non sono risultati, non cambiano la partita e non sono un invito a nulla.</p>`)}
    ${pollPanel('COSTRUISCI UNO SCENARIO', 'Scegli le forze di una coalizione ipotetica', `${picker}${custom ? `<div class="obs-scenarios">${scenarioCard(custom, solo)}</div>` : '<p class="quiet-copy">Tocca due o più forze: la guida è la tua (o la più grande) se è tra quelle scelte.</p>'}`)}`;
}

// The race of a campaign is followed in Elezioni → Sondaggi e avversari (campaignObservatory); here the same readings are the general picture of the candidates and the rivals.
const candidatesView = ctx => `${card({ kicker: 'COMPETIZIONE ATTIVA', title: 'La corsa della campagna è in Elezioni', body: '<p class="sx-note">Candidati, rivali, territori strategici, attese e conseguenze della campagna in corso si guidano in <button type="button" class="text-link" data-section-tab="elezioni" data-section-tab-value="avversari">Elezioni → Sondaggi e avversari</button>. Qui sotto la stessa lettura, come quadro generale.</p>' })}${candidates(ctx)}`;
const VIEW_RENDERERS = { quadro, istituti: institutes, segmenti: segmentsView, territori: territories, forze: forces, candidati: candidatesView, flussi, gradimento, scenari };
// Five areas as tabs; the views of the area in which the player is, as a second row. The value of an area tab is the view being read when the player is already there.
const areaOf = view => OBSERVATORY_AREAS.find(([, , views]) => views.includes(view)) ?? OBSERVATORY_AREAS[0];
const viewTabs = active => {
  const [, , areaViews] = areaOf(active);
  const areas = `<nav class="sx-tabs obs-tabs" role="tablist" aria-label="Aree dell’osservatorio">${OBSERVATORY_AREAS.map(([id, label, views]) => { const on = views.includes(active); const value = on ? active : views[0]; return `<button type="button" role="tab" class="sx-tab ${on ? 'active' : ''}" data-obs-area="${id}" data-section-tab="osservatorio" data-section-tab-value="${esc(value)}" aria-selected="${on}">${esc(label)}</button>`; }).join('')}</nav>`;
  const views = areaViews.length > 1 ? `<nav class="obs-subtabs" role="tablist" aria-label="Viste dell’area">${areaViews.map(id => `<button type="button" role="tab" class="obs-subtab ${id === active ? 'active' : ''}" data-section-tab="osservatorio" data-section-tab-value="${esc(id)}" aria-selected="${id === active}">${esc(VIEW_LABELS[id])}</button>`).join('')}</nav>` : '';
  return areas + views;
};

// state: the game; options: { view, institute, filters, logoFor(id), window(), media() (the panel of the media, as HTML), realLeader, secretary, allianceOdds, kindOf }.
export function renderObservatory(state, options = {}) {
  if (!state.world) return empty('I sondaggi si aprono con la prima settimana di gioco.');
  if (!latestPoll(state.world)) return '<p class="quiet-copy">Il primo sondaggio arriverà a fine settimana.</p>';
  const ctx = contextOf(state, options);
  if (!ctx.report) return empty('L’osservatorio si apre con i dati della partita.');
  const view = OBSERVATORY_VIEWS.some(([id]) => id === options.view) ? options.view : 'quadro';
  const average = ctx.report.latestAverage;
  const head = `<div class="obs-head"><p>${glyph('chart', 16)} <span>${average?.institutes ? `Media di ${average.institutes} istituti simulati · ${num(average.sample, 0)} interviste · settimana ${average.week}${average.date ? ` · aggiornata al ${formatDate(average.date)}` : ''}` : 'Parti dalla media reale: gli istituti simulati iniziano con la prima settimana'}</span></p>${links(state)}</div>`;
  return `<div class="polls-page observatory">${viewTabs(view)}${head}${VIEW_RENDERERS[view](ctx)}<p class="poll-footnote">I partiti sono reali; sondaggi, istituti, campioni, segmenti, travasi e candidature sono simulati e non attribuiscono a persone o partiti reali decisioni mai prese. Il campione dei sondaggi è l’insieme degli intervistati; l’elettorato è la popolazione simulata che vota: sono grandezze diverse.</p></div>`;
}

// Elezioni → Sondaggi e avversari: only the race of the campaign, as `campaignObservatory()` reads it from the campaign (the candidacies, the readings of
// the institutes, the average, the territories). Without a valid campaign there is nothing to show and nothing is invented: the picture of the country is in
// Sondaggi e media. Pure: opening it neither runs a poll nor touches the world.
export function renderCampaignObservatory(state, options = {}) {
  const campaign = state.campaign;
  const ctx = contextOf(state, options);
  const race = campaign && campaign.status !== 'idle' ? ctx.race() : null;
  if (!race?.rows.length) {
    return `<div class="polls-page observatory">${card({ kicker: 'CORSA · SIMULAZIONE', title: 'Nessuna campagna in corso', body: '<p class="sx-note">I sondaggi della corsa e gli avversari diretti compaiono quando c’è una campagna: in un voto politico o europeo sono le forze che davvero si presentano, in uno locale cambiano da territorio a territorio. Il quadro generale del Paese è in Sondaggi e media.</p><div class="sx-actions"><button type="button" class="secondary-button" data-nav="sondaggi">Apri Sondaggi e media</button></div>' })}</div>`;
  }
  return `<div class="polls-page observatory">${candidates(ctx)}${raceTerritories(ctx, race)}<p class="poll-footnote">I partiti sono reali; sondaggi, istituti, campioni e candidature della corsa sono simulati e non attribuiscono a persone o partiti reali decisioni mai prese.</p></div>`;
}
