// "Sondaggi e media" (#sondaggi): the one observatory of the game for the polls, the institutes and the rivals. Seven views of the same observatory: the
// dashboard, the institutes (each one, and their comparison with the average), the segments of the electorate and the themes, the territories, the forces
// and their alliances, the candidates of the race and the undecided with the flows between the forces. Elezioni → Sondaggi e avversari shows only the race
// of the campaign (renderCampaignObservatory): what `campaignObservatory()` reads from a valid campaign, and nothing when there is none.
// Everything here is read from what the game has saved (the world, its observatory, the campaign) and measures the simulation: no number on these
// pages gives a bonus, and the real parties stay real (their candidates, voters and readings are simulated, source: simulation).
import { latestPoll, observatoryReport } from '../core/world-engine.js?v=20261010-1';
import { campaignObservatory } from '../core/campaign-engine.js?v=20261010-1';
import { observatorySociety } from '../core/society-engine.js?v=20261010-1';
import { POLL_INSTITUTES } from '../data/simulation/polling-rules.js?v=20261010-1';
import { formatDate } from '../core/time.js?v=20261010-1';
import { lineChart, SERIES } from './charts.js?v=20261010-1';
import { emblem, glyph } from './visuals.js?v=20261010-1';
import { arrow, bar, card, empty, esc, kpi, num, table } from './sections-kit.js?v=20261010-1';
import { alliancesList, barometer, chronicle, dataTable, forcesGrid, partyIndex, pct, pollPanel, presencePanel, regionTiles, shortDate, signed, strategyList } from './polls-mode.js?v=20261010-1';

export const OBSERVATORY_VIEWS = Object.freeze([['quadro', 'Quadro'], ['istituti', 'Istituti'], ['segmenti', 'Segmenti e temi'], ['territori', 'Territori'], ['forze', 'Forze e alleanze'], ['candidati', 'Candidati e rivali'], ['flussi', 'Indecisi e flussi']]);
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
function averageBlock(ctx, { limit = 12 } = {}) {
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
    ? `Questa è la media reale con cui parte la carriera${average.label ? ` (${esc(average.label)})` : ''}: gli istituti simulati iniziano a pubblicare dalla prima settimana.`
    : `Media pesata sul campione degli ${average.institutes} istituti (${num(average.sample, 0)} interviste in tutto). La forbice è la distanza tra la lettura più alta e la più bassa. Il campione è l’insieme degli intervistati: l’elettorato simulato che vota è un’altra cosa.`;
  return `${table(columns, body, { className: 'obs-average' })}<p class="poll-footnote">${note}</p>`;
}
function averageTrend(ctx) {
  const { report } = ctx;
  const points = report?.average ?? [];
  if (points.length < 2) return '<p class="quiet-copy">Il trend compare dalla seconda settimana: chiudi la settimana per la prossima rilevazione.</p>';
  const series = leaders(ctx, 4).map(force => chartSeries(force, points.map(point => point.rows.find(row => row.partyId === force.id)?.share ?? null)));
  return lineChart({ series, labels: points.map(point => `S${point.week}`), tips: points.map(point => `Media · settimana ${point.week}${point.institutes ? ` · ${point.institutes} istituti` : ''}`), unit: '%', min: 0, height: 240, right: 190, ariaLabel: 'Media dei sondaggi, ultime settimane' });
}

// ---------- the quadro ----------
// The average and the readings of the institutes in one block: a coloured bar for each force (the average of the institutes A, B, C and D, in the
// colour of the force) and, beside it, what each institute read. Nothing of this is repeated elsewhere in the quadro.
function instituteBars(ctx, { limit = 9 } = {}) {
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
    ? `Questa è la media reale con cui parte la carriera${average.label ? ` (${esc(average.label)})` : ''}: gli istituti simulati iniziano a pubblicare dalla prima settimana.`
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
function links(state) {
  const running = state.campaign?.status === 'active';
  const items = [[running ? 'campagna' : 'candidatura', running ? 'Guida la campagna' : 'Candidatura'], ['risultati', 'Ultimo risultato'], ['storico', 'Storico elettorale']];
  return `<div class="obs-links">${items.map(([tab, label]) => `<button type="button" class="text-link" data-section-tab="elezioni" data-section-tab-value="${tab}">${esc(label)} ${arrow}</button>`).join('')}</div>`;
}
function quadro(ctx) {
  const { state, world, poll, report, index, logo, options } = ctx;
  const media = options.media ? pollPanel('MEDIA · SIMULATI', 'Come ti raccontano', options.media()) : '';
  return `${barometer(state, world, poll, { logo })}
    ${pollPanel('INTENZIONI DI VOTO · SIMULAZIONE', 'La media degli istituti e le loro rilevazioni', instituteBars(ctx, { limit: 9 }), `<span class="hq-count">${report.latestAverage?.institutes ? `${report.latestAverage.institutes} istituti` : 'dato reale'}</span>`)}
    ${pollPanel('TREND', 'Come cambiano i consensi', averageTrend(ctx))}
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
  const weeks = report.average.map(point => point.week);
  if (weeks.length < 2) return '<p class="quiet-copy">Il confronto tra gli istituti compare dalla seconda settimana.</p>';
  const valueAt = (history, week) => history.find(item => item.week === week)?.rows.find(row => row.partyId === force.id)?.share ?? null;
  const series = [...report.institutes.map((item, i) => ({ label: instituteName(item), short: instituteName(item), color: SERIES[i + 1], emphasis: false, values: weeks.map(week => valueAt(item.history, week)) })), { label: 'Media', short: 'Media', color: SERIES[0], emphasis: true, values: report.average.map(point => point.rows.find(row => row.partyId === force.id)?.share ?? null) }];
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
  const points = institute.history;
  const chart = points.length >= 2 ? lineChart({ series: leaders(ctx, 4).map(force => chartSeries(force, points.map(item => item.rows.find(row => row.partyId === force.id)?.share ?? null))), labels: points.map(item => `S${item.week}`), tips: points.map(item => `${instituteName(institute)} · settimana ${item.week} · ${num(item.sample, 0)} interviste`), unit: '%', min: 0, height: 240, right: 190, ariaLabel: `Andamento delle letture di ${instituteName(institute)}` }) : '<p class="quiet-copy">La storia di questo istituto compare dalla seconda rilevazione.</p>';
  return `${card({ kicker: 'ISTITUTO · SIMULATO', title: instituteName(institute), body: head })}
    ${card({ kicker: `RILEVAZIONE DEL ${formatDate(institute.latest.date, { day: 'numeric', month: 'long' }).toUpperCase()} · SETTIMANA ${institute.latest.week}`, title: 'Che cosa misura', body: `${readList(rows)}<p class="poll-footnote">Variazione: rispetto alla rilevazione precedente dello stesso istituto. Scarto: distanza dalla media degli istituti. Ogni istituto sbaglia a modo suo e in modo costante da una settimana all’altra (errore simulato, dentro il margine): per questo la media, che li compensa, è più affidabile di una sola lettura. Lo scarto dalla media è l’unico segno visibile di quell’errore.</p>` })}
    ${card({ kicker: 'STORIA', title: 'Come sono cambiate le letture', body: `<div class="eh-chart">${chart}</div>` })}`;
}
function institutes(ctx) {
  const { options, report } = ctx;
  const selected = ['confronto', ...POLL_INSTITUTES.map(item => item.id)].includes(options.institute) ? options.institute : 'confronto';
  const chips = `<div class="obs-chips" role="group" aria-label="Istituto">${[['confronto', 'Confronto'], ...report.institutes.map(item => [item.id, instituteName(item)])].map(([id, label]) => `<button type="button" class="obs-chip-btn ${id === selected ? 'active' : ''}" data-section-tab="osservatorio-istituto" data-section-tab-value="${esc(id)}" aria-pressed="${id === selected}">${esc(label)}</button>`).join('')}</div>`;
  if (selected !== 'confronto') return `${chips}${instituteDetail(ctx, selected)}`;
  return `${chips}
    ${pollPanel('MEDIA E ISTITUTI · SIMULAZIONE', 'La media e le letture di ciascun istituto', averageBlock(ctx, { limit: 14 }))}
    ${ctx.force ? pollPanel('CONFRONTO NEL TEMPO', `${esc(ctx.force.label)}: ogni istituto e la media`, `${forceChips(ctx)}${comparisonChart(ctx)}`) : ''}
    ${pollPanel('METODI', 'Come lavora ciascun istituto', methodTable(ctx))}`;
}

// ---------- segments and themes ----------
function heat(entry, national) {
  const tone = entry.factor >= 1.12 ? 'good' : entry.factor <= 0.88 ? 'bad' : 'neutral';
  const digits = digitsFor(national);
  return `<span class="obs-heat tone-${tone}" data-tip="${esc(`${pct(entry.support, digits)} contro ${pct(national, digits)} in media`)}" tabindex="0">${pct(entry.support, digits)}</span>`;
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
  const themes = report.themes;
  const themeList = themes ? `<ol class="obs-list">${themes.national.map(item => `<li><span><strong>${esc(item.label)}</strong><small>stato dell’area ${num(item.value, 0)}/100</small></span>${bar(item.weight, 'warn', Math.max(...themes.national.map(t => t.weight), 1))}</li>`).join('')}</ol>` : '';
  const bySegment = themes ? `<ul class="obs-segment-themes">${seg.segments.map(item => `<li><strong>${esc(item.label)}</strong><span>${(themes.bySegment[item.id] ?? []).map(theme => esc(theme.label)).join(' · ') || '—'}</span></li>`).join('')}</ul>` : '';
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
function territories(ctx) {
  const { report, force, world } = ctx;
  if (!force) return empty('Nessuna forza da osservare.');
  const regional = report.regional ?? {};
  const national = report.latestAverage?.rows.find(row => row.partyId === force.id)?.share ?? force.share;
  const digits = digitsFor(national);
  const entries = Object.entries(regional).map(([region, rows]) => [region, rows.find(row => row.partyId === force.id)?.share]).filter(([, value]) => Number.isFinite(value));
  const rows = Object.entries(regional).map(([region, list]) => {
    const own = list.find(row => row.partyId === force.id)?.share ?? null;
    const lead = [...list].filter(row => ctx.byId[row.partyId]).sort((a, b) => b.share - a.share)[0];
    return { region, own, lead, gap: own === null ? null : own - national };
  }).filter(row => row.own !== null).sort((a, b) => b.own - a.own).map(row => ({ name: `<strong>${esc(row.region)}</strong>${row.region === world.place.region ? ' <small>la tua regione</small>' : ''}`, lead: row.lead ? `${esc(shortOf(ctx.byId[row.lead.partyId]))} · ${pct(row.lead.share)}` : '—', own: pct(row.own, digits), gap: deltaText(row.gap) }));
  return `${pollPanel('TERRITORIO · SIMULAZIONE', `${esc(force.label)} regione per regione`, `${forceChips(ctx)}${regionTiles(entries, { home: world.place.region, digits, note: 'Più chiaro = più forte. Bordo dorato: la tua regione. Le differenze regionali sono simulate: partono dal voto reale delle ultime politiche e si muovono con eventi territoriali e popolarità.' })}`)}
    ${pollPanel('CLASSIFICA DELLE REGIONI', 'Dove è più forte, dove meno', `${table([['name', 'Regione'], ['lead', 'Prima forza'], ['own', esc(shortOf(force)), 'num'], ['gap', 'Scarto', 'num']], rows, { className: 'obs-compact' })}<p class="poll-footnote">Scarto: differenza dal dato nazionale della forza.</p>`)}
    ${raceTerritories(ctx, ctx.race())}`;
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
      ${pollPanel('FORZE NAZIONALI', 'La media dei sondaggi', averageBlock(ctx, { limit: 10 }))}`;
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

const VIEW_RENDERERS = { quadro, istituti: institutes, segmenti: segmentsView, territori: territories, forze: forces, candidati: candidates, flussi };
const viewTabs = active => `<nav class="sx-tabs obs-tabs" role="tablist" aria-label="Aree dell’osservatorio">${OBSERVATORY_VIEWS.map(([id, label]) => `<button type="button" role="tab" class="sx-tab ${active === id ? 'active' : ''}" data-section-tab="osservatorio" data-section-tab-value="${esc(id)}" aria-selected="${active === id}">${esc(label)}</button>`).join('')}</nav>`;

// state: the game; options: { view, institute, filters, logoFor(id), window(), media() (the panel of the media, as HTML), realLeader, secretary, allianceOdds, kindOf }.
export function renderObservatory(state, options = {}) {
  if (!state.world) return empty('I sondaggi si aprono con la prima settimana di gioco.');
  if (!latestPoll(state.world)) return '<p class="quiet-copy">Il primo sondaggio arriverà a fine settimana.</p>';
  const ctx = contextOf(state, options);
  if (!ctx.report) return empty('L’osservatorio si apre con i dati della partita.');
  const view = OBSERVATORY_VIEWS.some(([id]) => id === options.view) ? options.view : 'quadro';
  const average = ctx.report.latestAverage;
  const head = `<div class="obs-head"><p>${glyph('chart', 16)} <span>${average?.institutes ? `Media di ${average.institutes} istituti simulati · ${num(average.sample, 0)} interviste · settimana ${average.week}` : 'Parti dalla media reale: gli istituti simulati iniziano con la prima settimana'}</span></p>${links(state)}</div>`;
  return `<div class="polls-page observatory">${viewTabs(view)}${head}${VIEW_RENDERERS[view](ctx)}<p class="poll-footnote">I partiti sono reali; sondaggi, istituti, campioni, segmenti, travasi e candidature sono simulati (source: simulation) e non attribuiscono a persone o partiti reali decisioni mai prese. Il campione dei sondaggi è l’insieme degli intervistati; l’elettorato è la popolazione simulata che vota: sono grandezze diverse.</p></div>`;
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
  return `<div class="polls-page observatory">${candidates(ctx)}${raceTerritories(ctx, race)}<p class="poll-footnote">I partiti sono reali; sondaggi, istituti, campioni e candidature della corsa sono simulati (source: simulation) e non attribuiscono a persone o partiti reali decisioni mai prese.</p></div>`;
}
