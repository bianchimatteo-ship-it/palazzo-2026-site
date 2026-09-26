import { allianceOf, isSurveyed, latestPoll, PRESENCE_LABELS, PRESENCE_RULES, presenceOverview, STRATEGIES } from '../core/world-engine.js?v=20260926-3';
import { formatDate } from '../core/time.js?v=20260926-3';
import { artTile, emblem, glyph, inkOn } from './visuals.js?v=20260926-3';
import { distinctSeries } from './charts.js?v=20260926-3';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (value, digits = 1) => value === null || value === undefined ? '—' : `${Number(value).toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Number(value) || 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })}`;
const shortDate = date => formatDate(date, { day: 'numeric', month: 'short' });
const decimal = value => Number(value).toLocaleString('it-IT', { maximumFractionDigits: 2 });
// Blue sequential ramp, dark surface: near-zero recedes toward the background.
const SEQUENTIAL = ['#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4', '#b7d3f6', '#cde2fb'];
const TONE_COLORS = { good: '#199e70', bad: '#e66767', neutral: 'var(--party-accent)' };
const SCOPE_LABELS = { nazionale: 'Nazionale', regionale: 'Regionale', locale: 'Locale' };

// The first poll of a career is real (with its source); every following one is simulated.
const isReal = poll => poll?.source === 'real' && poll.real;
function pollSourceLine(poll) {
  if (isReal(poll)) return `<span class="poll-source-real">DATO REALE</span> ${esc(poll.real.label)} del ${esc(formatDate(poll.real.publishedAt))}${poll.real.fieldworkFrom ? ` (sondaggi dal ${esc(shortDate(poll.real.fieldworkFrom))} al ${esc(shortDate(poll.real.fieldworkTo))})` : ''} · <a href="${esc(poll.real.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(poll.real.sourceName)} ↗</a> · dalla prima settimana i sondaggi sono simulati`;
  return `${esc(poll.institute)} · ${Number(poll.sample).toLocaleString('it-IT')} interviste · ${esc(formatDate(poll.date))} · istituto e sondaggio simulati`;
}
const marginText = poll => poll?.margin ? `±${String(poll.margin).replace('.', ',')}` : 'dato reale';
function partyIndex(world) { return Object.fromEntries(world.parties.map(party => [party.id, party])); }
function deltaChip(value, emphasis = false) {
  const tone = !emphasis || !value ? 'flat' : value > 0 ? 'up' : 'down';
  return `<span class="delta delta-${tone}">${signed(value)}</span>`;
}

function sparkline(values, color = 'var(--party-accent)') {
  const points = values.filter(value => Number.isFinite(value));
  if (points.length < 2) return '';
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const coords = points.map((value, index) => [4 + index * 112 / (points.length - 1), 28 - (value - min) / span * 22]);
  const [lx, ly] = coords.at(-1);
  return `<svg class="sparkline" viewBox="0 0 120 32" aria-hidden="true"><polyline points="${coords.map(point => point.join(',')).join(' ')}" /><circle cx="${lx}" cy="${ly}" r="3.5" style="fill:${esc(color)}" /></svg>`;
}

function statTile(label, value, delta, series, note = '', emphasis = true) {
  return `<div class="poll-stat"><span class="poll-stat-label">${esc(label)}</span><strong>${value}</strong>${delta === null ? '' : deltaChip(delta, emphasis)}${sparkline(series)}${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}

function barometer(state, world, poll, parties) {
  // An executive exists in the simulation when the Government is in office or, outside Parliament, the scenario has one.
  const inOffice = ['active', 'crisis'].includes(state.parliament?.government?.status) || (!state.parliament?.government && Boolean(state.society?.executive));
  const executive = poll.government ?? poll.executive ?? null;
  const executiveOf = item => item?.government?.approval ?? item?.executive?.approval ?? null;
  const player = world.parties.find(item => item.isPlayer);
  const previous = world.polls.at(-2);
  const history = key => world.polls.slice(-12).map(item => key(item));
  const playerRow = player ? poll.results.find(row => row.partyId === player.id) : null;
  const headline = player
    ? `<h2>${esc(player.label)} al ${pct(playerRow?.share)}</h2><p>${deltaChip(playerRow?.delta ?? 0, true)} rispetto al sondaggio precedente · ${poll.margin ? `margine d’errore ±${String(poll.margin).replace('.', ',')} punti` : playerRow?.simulated ? 'il tuo partito non è nella fonte reale: stima iniziale simulata' : 'media di più sondaggi reali'}${playerRow?.internal ? ' · non ancora rilevato dagli istituti: stima interna simulata' : ''}</p>`
    : `<h2>Gradimento personale al ${pct(poll.personal.approval, 0)}</h2><p>Sei indipendente: il barometro misura te, non un partito.</p>`;
  const component = player && world.playerComponent?.label ? `<p class="poll-component-note">Il tuo partito, ${esc(world.playerComponent.label)}, è rilevato nei sondaggi dentro ${esc(player.label)}: una sola forza, una sola serie.</p>` : '';
  const region = world.place.region || 'Regione';
  const municipality = world.place.municipality || 'Comune';
  const tiles = player ? [
    statTile('Nazionale', pct(playerRow?.share), playerRow?.delta ?? 0, history(item => item.results.find(row => row.partyId === player.id)?.share)),
    statTile(region, pct(poll.regionalHome), previous ? Math.round(((poll.regionalHome ?? 0) - (previous.regionalHome ?? poll.regionalHome ?? 0)) * 10) / 10 : 0, history(item => item.regionalHome)),
    statTile(municipality, pct(poll.local), previous ? Math.round(((poll.local ?? 0) - (previous.local ?? poll.local ?? 0)) * 10) / 10 : 0, history(item => item.local), 'Territorio del tuo politico')
  ].join('') : '';
  const personal = [
    statTile('Gradimento personale', pct(poll.personal.approval, 0), previous ? Math.round((poll.personal.approval - previous.personal.approval) * 10) / 10 : 0, history(item => item.personal?.approval), 'Il tuo politico, separato dal partito'),
    statTile('Gradimento del governo', executive ? pct(executive.approval, 0) : inOffice ? 'Non rilevato' : 'Nessun governo', executive && Number.isFinite(executiveOf(previous)) ? Math.round((executive.approval - executiveOf(previous)) * 10) / 10 : null, history(executiveOf), poll.government ? 'Legato alla stabilità della maggioranza' : poll.executive ? `${poll.executive.label} · simulazione` : inOffice ? 'La fonte reale del primo sondaggio non lo misura: dal prossimo sondaggio (simulato)' : 'Si misura quando un governo è in carica', false),
    statTile('Indecisi', pct(poll.undecided, 0), previous ? Math.round((poll.undecided - previous.undecided) * 10) / 10 : 0, history(item => item.undecided), 'Fuori dal totale dei voti validi', false)
  ].join('');
  return `<section class="poll-hero" style="--hero-accent:${esc(player?.color ?? 'var(--party-accent)')}">
    <div class="poll-hero-main">${player ? emblem({ label: player.label, abbreviation: player.abbreviation, color: player.color, logo: parties.logo?.(player.id) }, 'lg') : `<span class="poll-hero-icon">${glyph('chart', 30)}</span>`}<div><span class="section-kicker">BAROMETRO POLITICO · SETTIMANA ${poll.week}</span>${headline}${component}<small>${pollSourceLine(poll)}</small></div></div>
    ${tiles ? `<div class="poll-tiles">${tiles}</div>` : ''}
    <div class="poll-tiles secondary">${personal}</div>
  </section>`;
}

// The poll as published: the forces it measures, then "Altri" as a separate row. In the first (real) poll the player's
// party, absent from the source, is shown apart as a marked simulated estimate, outside the real total. Below, the
// forces under observation (still inside "Altri") and who entered or left the survey this week.
const MOVE_LABELS = { rilevato: 'Entra nei sondaggi', consolidato: 'Si consolida', emergente: 'Emergente', 'non-rilevato': 'Esce dai sondaggi' };
function moveText(move) {
  if (move.to === 'rilevato' && move.from === 'consolidato') return 'Non più consolidato';
  if (move.to === 'non-rilevato' && move.from === 'emergente') return 'Non sfonda';
  return MOVE_LABELS[move.to] ?? PRESENCE_LABELS[move.to];
}
function nationalBars(world, poll, index, logo) {
  const real = isReal(poll);
  const rows = poll.results.filter(row => !row.outsideSource && index[row.partyId]).sort((a, b) => b.share - a.share);
  const estimates = poll.results.filter(row => row.outsideSource && index[row.partyId]);
  const others = Number.isFinite(poll.others) ? poll.others : Math.round((100 - rows.reduce((sum, row) => sum + row.share, 0)) * 10) / 10;
  const max = Math.max(...rows.map(row => row.share), ...estimates.map(row => row.share), 10);
  const entered = new Set((poll.moves ?? []).filter(move => move.to === 'rilevato' && move.from === 'emergente').map(move => move.id));
  const bar = row => {
    const party = index[row.partyId];
    const margin = poll.sample ? Math.round(1.96 * Math.sqrt(Math.max(0.0004, row.share / 100 * (1 - row.share / 100)) / poll.sample) * 1000) / 10 : 0;
    const width = row.share / max * 100;
    const estimate = row.outsideSource || row.internal;
    const status = row.outsideSource ? 'stima simulata: il partito non è nella fonte reale' : row.internal ? 'non ancora rilevato dagli istituti: stima interna simulata' : null;
    const tip = poll.sample ? `${party.label}: ${pct(row.share)} (${signed(row.delta)} punti) · intervallo ${pct(Math.max(0, row.share - margin))}–${pct(row.share + margin)}${status ? ` · ${status}` : ''}` : `${party.label}: ${pct(row.share)} · ${status ?? `dato reale, ${poll.real?.label ?? 'fonte reale'}`}`;
    const note = row.outsideSource ? 'Stima simulata · non nella fonte reale' : row.internal ? 'Non ancora rilevato · stima interna' : party.isPlayer ? 'Il tuo partito' : `${party.position ? `${party.position} · ` : ''}${STRATEGIES[party.strategy]?.label ?? 'autonoma'}`;
    const change = entered.has(row.partyId) ? '<span class="delta delta-new">nuovo</span>' : deltaChip(row.delta, party.isPlayer);
    return `<div class="poll-bar-row ${party.isPlayer ? 'is-player' : ''} ${estimate ? 'is-estimate' : ''}" data-tip="${esc(tip)}" tabindex="0"><span class="poll-bar-name">${emblem({ label: party.label, abbreviation: party.abbreviation, color: party.color, logo: logo?.(party.id) }, 'sm')}<span><strong>${esc(party.label)}</strong><small>${esc(note)}</small></span></span><span class="poll-bar-track"><i class="poll-bar-fill" style="width:${width}%;background-color:${esc(party.color)}"></i>${margin ? `<i class="poll-bar-whisker" style="left:${Math.max(0, (row.share - margin) / max * 100)}%;width:${Math.min(100, 2 * margin / max * 100)}%"></i>` : ''}</span><span class="poll-bar-value">${pct(row.share)}</span>${change}</div>`;
  };
  const othersRow = `<div class="poll-bar-row is-others" data-tip="${esc(real ? `Altri: ${pct(others)} · come nella fonte reale (liste minori non indicate)` : `Altri: ${pct(others)} · liste minori e forze non rilevate dagli istituti`)}" tabindex="0"><span class="poll-bar-name"><span class="emblem emblem-sm emblem-ghost" aria-hidden="true">…</span><span><strong>Altri</strong><small>${real ? 'Liste minori · dato della fonte' : 'Liste minori e forze non rilevate'}</small></span></span><span class="poll-bar-track"><i class="poll-bar-fill" style="width:${others / max * 100}%;background-color:#4d5752"></i></span><span class="poll-bar-value">${pct(others)}</span><span></span></div>`;
  const outside = estimates.length ? `<div class="poll-bars-divider" role="separator"><span>Fuori dalla fonte reale</span></div>${estimates.map(bar).join('')}` : '';
  const watch = (poll.emerging ?? []).length ? `<div class="poll-watch"><strong>In osservazione</strong>${poll.emerging.map(item => `<span class="poll-watch-item" data-tip="${esc(`${item.label}: forza emergente, circa ${pct(item.share)} (stima simulata, ancora dentro “Altri”)`)}" tabindex="0">${esc(item.abbreviation || item.label)} · ~${pct(item.share)}</span>`).join('')}</div>` : '';
  const moves = (poll.moves ?? []).length ? `<div class="poll-moves">${poll.moves.map(move => `<span class="poll-move poll-move-${esc(move.to)}">${esc(moveText(move))}: <strong>${esc(move.label)}</strong></span>`).join('')}</div>` : '';
  const footnote = poll.sample
    ? 'Barre = stima del sondaggio; la linea sottile indica l’intervallo del margine d’errore al 95%. Percentuali sui voti validi. Barre tratteggiate = stima interna di una forza non ancora rilevata.'
    : `Dato reale: ${esc(poll.real?.label ?? 'fonte reale')} del ${esc(formatDate(poll.real?.publishedAt ?? poll.date))}, media di più istituti (nessun margine d’errore unico). Sono mostrate solo le forze presenti nella fonte, con “Altri” come nella fonte${estimates.length ? '; la barra tratteggiata è una stima simulata del tuo partito, fuori dal totale reale' : ''}. Dalla prossima settimana i sondaggi sono simulati e reagiscono alla tua carriera.`;
  return `<div class="poll-bars">${rows.map(bar).join('')}${othersRow}${outside}</div>${moves}${watch}<p class="poll-footnote">${footnote}</p>`;
}

const shortLabel = item => item.abbreviation || (String(item.label).length > 14 ? `${String(item.label).slice(0, 13)}…` : item.label);
function trendChart(world, index) {
  const polls = world.polls.slice(-16);
  if (polls.length < 2) return '<p class="quiet-copy">Il trend compare dal secondo sondaggio: chiudi la settimana per la prossima rilevazione.</p>';
  const latest = polls.at(-1);
  const player = world.parties.find(item => item.isPlayer);
  const leaders = [...latest.results].filter(row => row.partyId !== player?.id).sort((a, b) => b.share - a.share).slice(0, player ? 3 : 4).map(row => row.partyId);
  const ids = [...(player ? [player.id] : []), ...leaders];
  const series = distinctSeries(ids.map(id => ({ id, label: index[id].label, abbreviation: index[id].abbreviation, color: index[id].color, player: id === player?.id, values: polls.map(poll => poll.results.find(row => row.partyId === id)?.share ?? null) })));
  const W = 660, H = 250, L = 34, R = 132, T = 14, B = 28;
  const plotW = W - L - R, plotH = H - T - B;
  const top = Math.max(...series.flatMap(item => item.values.filter(Number.isFinite)), 10);
  const step = top > 30 ? 10 : 5;
  const maxY = Math.ceil((top + 2) / step) * step;
  const x = i => L + (polls.length === 1 ? plotW / 2 : i * plotW / (polls.length - 1));
  const y = v => T + (1 - v / maxY) * plotH;
  const grid = Array.from({ length: maxY / step + 1 }, (_, i) => i * step).map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
  const every = Math.max(1, Math.ceil(polls.length / 6));
  const xTicks = polls.map((poll, i) => i % every === 0 || i === polls.length - 1 ? `<text class="tick" x="${x(i)}" y="${H - 8}" text-anchor="middle">S${poll.week}</text>` : '').join('');
  const lines = series.map(item => {
    // A force that entered (or left) the survey has gaps: every stretch starts with its own move.
    const d = item.values.map((v, i) => Number.isFinite(v) ? `${i === 0 || !Number.isFinite(item.values[i - 1]) ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}` : '').join(' ');
    return `<path class="series ${item.player ? 'is-player' : ''}" d="${d}" style="stroke:${esc(item.color)}"/>`;
  }).join('');
  // End labels sit in a column with leader lines instead of being nudged off their lines.
  const ends = series.filter(item => Number.isFinite(item.values.at(-1))).map(item => ({ ...item, endY: y(item.values.at(-1)) })).sort((a, b) => a.endY - b.endY);
  let cursor = T;
  for (const item of ends) { item.labelY = Math.max(item.endY, cursor); cursor = item.labelY + 16; }
  const overflow = cursor - 16 - (H - B);
  if (overflow > 0) for (const item of ends) item.labelY -= overflow;
  const labels = ends.map(item => `<circle class="end-dot" cx="${x(polls.length - 1)}" cy="${item.endY}" r="4" style="fill:${esc(item.color)}"/><line class="leader" x1="${x(polls.length - 1) + 6}" y1="${item.endY}" x2="${W - R + 10}" y2="${item.labelY}"/><text class="end-label ${item.player ? 'is-player' : ''}" x="${W - R + 14}" y="${item.labelY + 4}">${esc(shortLabel(item))} ${pct(item.values.at(-1))}</text>`).join('');
  const payload = { x: polls.map((_, i) => x(i) / W), weeks: polls.map(poll => `Settimana ${poll.week} · ${poll.institute}${isReal(poll) ? ' (dato reale)' : ''}`), series: series.map(item => ({ label: item.label, color: item.color, values: item.values })) };
  const legend = series.map(item => `<span class="legend-item ${item.player ? 'is-player' : ''}"><i style="background:${esc(item.color)}"></i>${esc(item.label)}</span>`).join('');
  return `<div class="trend-legend">${legend}</div><div class="trend-chart" data-trend="${esc(JSON.stringify(payload))}" tabindex="0" aria-label="Andamento dei sondaggi nelle ultime ${polls.length} settimane"><svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true">${grid}${xTicks}${lines}${labels}<line class="crosshair" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/></svg></div>`;
}

function regionalMap(world, poll) {
  const entries = Object.entries(poll.regional ?? {});
  if (!entries.length) return '<p class="quiet-copy">Il dettaglio regionale riguarda il partito del giocatore.</p>';
  const values = entries.map(([, value]) => value);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const tiles = entries.map(([region, value]) => {
    const fill = SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor((value - min) / span * (SEQUENTIAL.length - 1)))];
    return `<span class="region-tile ${region === world.place.region ? 'is-home' : ''}" style="background:${fill};color:${inkOn(fill)}" data-tip="${esc(`${region}: ${pct(value)}`)}" tabindex="0"><small>${esc(region)}</small><strong>${pct(value)}</strong></span>`;
  }).join('');
  return `<div class="region-grid">${tiles}</div><div class="region-scale"><span>${pct(min)}</span><i style="background:linear-gradient(90deg,${SEQUENTIAL.join(',')})"></i><span>${pct(max)}</span></div><p class="poll-footnote">Bordo dorato: la tua regione. Le differenze regionali sono simulate e cambiano con eventi territoriali e con la tua popolarità.</p>`;
}

const euro = value => Number(value).toLocaleString('it-IT', { maximumFractionDigits: 0 });
// Relation with the player's party, -100..100: a word for it, never only a colour.
const relationLabel = value => value >= 30 ? 'Alleato naturale' : value >= 10 ? 'Disponibile' : value > -10 ? 'Neutrale' : value > -30 ? 'Freddo' : 'Ostile';
// Before proposing: how likely the force is to accept, and why (collocazione, programmes, memory, interests, majorities).
function oddsBlock(odds) {
  if (!odds) return '';
  const reasons = odds.reasons.slice(0, 4).map(item => `<li class="${item.delta >= 0 ? 'good' : 'bad'}"><span>${esc(item.label)}</span><b>${item.delta >= 0 ? '+' : '−'}${Math.round(Math.abs(item.delta) * 100)}</b></li>`).join('');
  return `<details class="alliance-odds"><summary>Probabilità che accetti: <strong>${Math.round(odds.chance * 100)}%</strong>${odds.exception ? ' · accordo incoerente' : ''}</summary><ul>${reasons}</ul>${odds.exception ? '<small>Forze troppo lontane: un accordo sarebbe possibile solo come eccezione (entrambe piccole o in crisi).</small>' : ''}</details>`;
}
function forcesGrid(state, world, poll, index, logo, realLeader, secretary, options = {}) {
  const player = world.parties.find(item => item.isPlayer);
  const playerAlliance = player ? allianceOf(world, player.id) : null;
  const rows = [...poll.results].sort((a, b) => b.share - a.share).map(row => {
    const party = index[row.partyId];
    const alliance = allianceOf(world, party.id);
    const strategy = STRATEGIES[party.strategy] ?? STRATEGIES.autonoma;
    const canPropose = secretary && player && !party.isPlayer && !playerAlliance && state.game?.status !== 'ended';
    const relation = Number(party.playerRelation ?? 0);
    const leader = party.refSource === 'real' ? realLeader?.(party.id) : null;
    return `<article class="force-card ${party.isPlayer ? 'is-player' : ''}" style="--force:${esc(party.color)}">
      <header>${emblem({ label: party.label, abbreviation: party.abbreviation, color: party.color, logo: logo?.(party.id) }, 'md')}<div><strong>${esc(party.label)}</strong><small>${party.isPlayer ? 'Il tuo partito' : `${esc(strategy.label)} da S${party.strategySince ?? 1}`}</small></div><b>${pct(row.share)}</b></header>
      <dl>
        <div><dt>Vertici (dato reale)</dt><dd>${esc(party.refSource === 'real' ? (leader ?? 'Non documentati nel dataset') : party.isPlayer ? 'Il tuo gruppo dirigente' : 'Forza simulata')}</dd></div>
        ${party.position ? `<div><dt>Collocazione${party.refSource === 'real' ? ' (documento 24/09/2026)' : ''}</dt><dd>${esc(party.position)}</dd></div>` : ''}
        ${party.pollReference ? `<div><dt>Punto di partenza (reale)</dt><dd>${pct(party.pollReference.share)} · ${esc(party.pollReference.label)}</dd></div>` : ''}
        ${party.enteredWeek ? `<div><dt>Nei sondaggi (sim.)</dt><dd>Dalla settimana ${party.enteredWeek}</dd></div>` : ''}
        ${party.governing ? '<div><dt>Maggioranza reale</dt><dd>Nel governo in carica all’avvio</dd></div>' : ''}
        ${party.life?.congresses ? `<div><dt>Congressi (sim.)</dt><dd>${party.life.congresses} · leadership ${esc(party.life.leadership)}</dd></div>` : ''}
        ${party.reference ? `<div><dt>2×1000 ${esc(party.reference.year)} (reale)</dt><dd>${pct(party.reference.shareOfChoices, 2)} · ${euro(party.reference.validChoices)} scelte</dd></div>` : ''}
        <div><dt>Coesione (sim.)</dt><dd><b class="hq-bar ${party.cohesion < 30 ? 'danger' : ''}"><i style="width:${party.cohesion}%"></i></b></dd></div>
        ${player && !party.isPlayer ? `<div><dt>Rapporto con te (sim.)</dt><dd><span class="relation-chip ${relation >= 10 ? 'good' : relation <= -10 ? 'bad' : ''}">${esc(relationLabel(relation))} · ${relation > 0 ? '+' : ''}${Math.round(relation)}</span></dd></div>` : ''}
      </dl>
      ${party.isPlayer ? '' : `<p class="force-strategy">${esc(strategy.detail)}</p>`}
      <div class="force-badges">${party.presence?.status ? `<span class="badge badge-presence presence-${esc(party.presence.status)}">${esc(PRESENCE_LABELS[party.presence.status])}</span>` : ''}${party.crisis ? '<span class="badge badge-bad">Crisi interna</span>' : ''}${alliance ? `<span class="badge">${glyph('link', 13)} ${esc(alliance.label)}</span>` : ''}</div>
      ${canPropose ? oddsBlock(options.allianceOdds?.(party.id)) : ''}
      ${canPropose ? `<button class="secondary-button" data-world-alliance="${esc(party.id)}">Proponi un’intesa · 1 giorno · 4 cap.</button>` : ''}
      ${party.isPlayer && playerAlliance && secretary ? `<button class="text-link" data-world-break="${esc(playerAlliance.id)}">Rompi ${esc(playerAlliance.label)}</button>` : ''}
    </article>`;
  }).join('');
  const note = player && !secretary ? '<p class="parliament-note">Alleanze e rotture le decide il segretario del partito: da iscritto o dirigente puoi solo influenzare i rapporti con le tue attività.</p>' : '';
  return `${note}<div class="force-grid">${rows}</div>`;
}

// Presence in the polls: who is consolidated, surveyed, emerging or outside, the latest moves and the rules.
function presencePanel(world) {
  const overview = presenceOverview(world);
  if (!overview) return '';
  const chip = item => `<span class="presence-chip ${item.isPlayer ? 'is-player' : ''}" data-tip="${esc(`${item.label}${item.since ? ` · in questo stato dalla settimana ${item.since}` : ''}`)}" tabindex="0">${esc(item.abbreviation || item.label)}</span>`;
  const group = (id, label, items, note, body = items.map(chip).join('') || '<em>nessuna forza</em>') => `<div class="presence-group presence-${id}"><div><strong>${esc(label)} · ${items.length ?? items}</strong><small>${esc(note)}</small></div><div class="presence-chips">${body}</div></div>`;
  const emerging = overview.emerging.map(item => `<span class="presence-chip is-emerging" data-tip="${esc(`${item.label}: circa ${pct(item.share)} (stima simulata, ancora dentro “Altri”)`)}" tabindex="0">${esc(item.abbreviation || item.label)} · ~${pct(item.share)}</span>`).join('') || '<em>nessuna forza</em>';
  const exited = overview.exited.map(item => `<span class="presence-chip is-out" data-tip="${esc(`${item.label}: uscita dalla rilevazione nella settimana ${item.week}; la sua storia nei sondaggi resta`)}" tabindex="0">${esc(item.abbreviation || item.label)} · uscita S${item.week}</span>`).join('');
  const rules = PRESENCE_RULES;
  const moves = overview.moves.length ? `<ul class="presence-moves">${overview.moves.map(move => `<li><span>S${move.week}</span><b>${esc(move.label)}</b><em>${esc(PRESENCE_LABELS[move.from])} → ${esc(PRESENCE_LABELS[move.to])}</em></li>`).join('')}</ul>` : '<p class="quiet-copy">Nessun ingresso o uscita finora.</p>';
  return `<div class="presence-grid">
      ${group('consolidato', 'Consolidati', overview.consolidated, `Almeno ${decimal(rules.consolidate.share)}% da ${rules.consolidate.weeks} settimane`)}
      ${group('rilevato', 'Rilevati', overview.surveyed, 'Con una propria voce nei sondaggi')}
      ${group('emergente', 'Emergenti', overview.emerging, 'Osservati, ancora dentro “Altri”', emerging)}
      <div class="presence-group presence-non-rilevato"><div><strong>Non rilevati · ${overview.outside}</strong><small>Forze del database fuori dai sondaggi: nessuna stima pubblicata</small></div>${exited ? `<div class="presence-chips">${exited}</div>` : ''}</div>
    </div>
    <h3 class="presence-subtitle">Ultimi ingressi e uscite</h3>${moves}
    <details class="presence-rules"><summary>Come si entra e si esce dai sondaggi</summary><ul>
      <li><strong>Emergente</strong>: almeno ${decimal(rules.emerge.share)}% per ${rules.emerge.weeks} settimane, se in crescita, molto visibile o già oltre ${decimal(rules.emerge.size)}%.</li>
      <li><strong>Rilevato</strong>: da emergente, almeno ${decimal(rules.enter.share)}% per ${rules.enter.weeks} settimane, dopo almeno ${rules.enter.minWeeks} settimane di osservazione e con abbastanza visibilità.</li>
      <li><strong>Consolidato</strong>: almeno ${decimal(rules.consolidate.share)}% per ${rules.consolidate.weeks} settimane; torna rilevato sotto ${decimal(rules.weaken.share)}% per ${rules.weaken.weeks} settimane.</li>
      <li><strong>Uscita</strong>: sotto ${decimal(rules.exit.share)}% per ${rules.exit.weeks} settimane, dopo almeno ${rules.exit.minWeeks} settimane nei sondaggi; poi ${rules.exit.cooldown} settimane prima di poter riemergere. Un’emergente che non sfonda in ${rules.fade.maxWeeks} settimane torna fuori per ${rules.fade.cooldown} settimane.</li>
      <li>Una forza fuori dai sondaggi cresce solo se c’è una ragione: un partito vicino in crisi o in calo, la sfiducia nelle istituzioni, la campagna per le europee, l’attenzione dei media, le elezioni. Nessun ingresso casuale.</li>
    </ul></details>`;
}

function chronicle(world, limit = 10) {
  return `<div class="chronicle">${world.events.slice(0, limit).map(event => `<article class="chronicle-item tone-${esc(event.tone)}">${artTile(event.icon ?? 'globe', TONE_COLORS[event.tone] ?? TONE_COLORS.neutral, 'sm')}<div><span class="chronicle-meta">${esc(SCOPE_LABELS[event.scope] ?? 'Scenario')} · S${event.week} · ${esc(shortDate(event.date))}</span><strong>${esc(event.title)}</strong><small>${esc(event.body)}</small>${event.lines?.length ? `<em>${esc(event.lines.join(' · '))}</em>` : ''}</div></article>`).join('') || '<p class="quiet-copy">La cronaca si riempirà settimana dopo settimana.</p>'}</div>`;
}

function dataTable(world, index) {
  const polls = world.polls.slice(-12);
  const ids = [...new Set(polls.flatMap(poll => poll.results.map(row => row.partyId)))];
  return `<details class="poll-table"><summary>Tabella dei dati (ultimi ${polls.length} sondaggi)</summary><div class="poll-table-scroll"><table><thead><tr><th>Forza</th>${polls.map(poll => `<th>S${poll.week}</th>`).join('')}</tr></thead><tbody>${ids.map(id => `<tr><th>${esc(index[id]?.label ?? id)}</th>${polls.map(poll => `<td>${pct(poll.results.find(row => row.partyId === id)?.share ?? null)}</td>`).join('')}</tr>`).join('')}<tr><th>Gradimento personale</th>${polls.map(poll => `<td>${pct(poll.personal?.approval, 0)}</td>`).join('')}</tr><tr><th>Indecisi</th>${polls.map(poll => `<td>${pct(poll.undecided, 0)}</td>`).join('')}</tr></tbody></table></div></details>`;
}

export function renderPollsPage(state, options = {}) {
  const world = state.world;
  const poll = latestPoll(world);
  if (!poll) return '<p class="quiet-copy">Il primo sondaggio arriverà a fine settimana.</p>';
  const index = partyIndex(world);
  const logo = options.logoFor;
  const panel = (kicker, title, body, extra = '') => `<section class="hq-panel poll-panel"><div class="home-section-heading"><div><span class="section-kicker">${kicker}</span><h2>${title}</h2></div>${extra}</div>${body}</section>`;
  // Coalitions of several forces show what was conceded to get in (collegi, programme, leadership, vetoes).
  const alliances = world.alliances.filter(item => item.status === 'active' && item.partyIds.length >= 2).map(item => `<div class="alliance-row">${glyph('link', 18)}<div><strong>${esc(item.label)}</strong><small>${item.partyIds.map(id => esc(index[id]?.label ?? id)).join(' + ')} · dal ${esc(shortDate(item.since))}</small>${(item.terms ?? []).length ? `<small class="alliance-terms">Accordi: ${item.terms.slice(-3).map(term => esc(term.text)).join(' · ')}</small>` : ''}</div><b class="hq-bar ${item.cohesion < 30 ? 'danger' : 'good'}"><i style="width:${item.cohesion}%"></i></b></div>`).join('') || '<p class="quiet-copy">Nessuna alleanza attiva.</p>';
  const strategyRows = Object.entries(STRATEGIES).map(([id, item]) => { const members = world.parties.filter(party => party.active && (party.isPlayer || isSurveyed(party)) && party.strategy === id); return `<div class="figure-row">${glyph(id === 'governista' ? 'dome' : id === 'opposizione' ? 'megaphone' : id === 'coalizione' ? 'link' : 'route', 18)}<div><strong>${esc(item.label)} · ${members.length}</strong><small>${members.map(party => esc(party.abbreviation || party.label)).join(', ') || 'nessuna forza'}</small></div></div>`; }).join('');
  const figures = world.figures.filter(item => item.simulated).slice(-4).reverse().map(figure => `<div class="figure-row">${glyph('user', 18)}<div><strong>${esc(figure.name)}</strong><small>${esc(figure.role)} · figura simulata, non una persona reale</small></div></div>`).join('');
  return `<div class="polls-page">
    ${barometer(state, world, poll, { logo })}
    <div class="poll-grid">
      ${panel('SONDAGGIO DELLA SETTIMANA', 'Intenzioni di voto', nationalBars(world, poll, index, logo), `<span class="hq-count">${marginText(poll)}</span>`)}
      ${panel('TREND', 'Come cambiano i consensi', trendChart(world, index))}
    </div>
    <div class="poll-grid">
      ${panel('TERRITORIO', 'Il tuo partito regione per regione', regionalMap(world, poll))}
      ${panel('CRONACA POLITICA', 'Cosa muove i sondaggi', chronicle(world, 6))}
    </div>
    ${panel('PARTITI REALI · COMPORTAMENTI SIMULATI', 'Le forze in campo', forcesGrid(state, world, poll, index, logo, options.realLeader, options.secretary, { allianceOdds: options.allianceOdds }))}
    ${panel('PRESENZA NEI SONDAGGI · SIMULAZIONE', 'Chi entra e chi esce', presencePanel(world))}
    <div class="poll-grid">
      ${panel('ALLEANZE · SIMULATE', 'Intese e rotture', alliances)}
      ${panel('STRATEGIE · SIMULATE', 'Chi sta dove', strategyRows + figures)}
    </div>
    ${dataTable(world, index)}
    <p class="poll-footnote">I partiti sono reali. Il primo sondaggio della carriera è la fotografia della fonte reale indicata: solo le forze che misura, con “Altri” come nella fonte. Da lì istituti, percentuali settimanali, ingressi e uscite dai sondaggi, strategie, alleanze, rapporti ed eventi sono simulati (source: simulation) e non attribuiscono a partiti o persone reali decisioni mai prese. Le forze del database fuori dai sondaggi non hanno stime pubblicate finché non emergono.</p>
  </div>`;
}

// Compact barometer for the Home side column.
export function renderBarometerPanel(state) {
  const world = state.world;
  const poll = latestPoll(world);
  if (!poll) return '';
  const player = world.parties.find(item => item.isPlayer);
  const row = player ? poll.results.find(item => item.partyId === player.id) : null;
  const series = world.polls.slice(-12).map(item => player ? item.results.find(entry => entry.partyId === player.id)?.share : item.personal?.approval);
  return `<div class="barometer"><div class="barometer-main"><div><small>${player ? esc(player.label) : 'Gradimento personale'}</small><strong>${player ? pct(row?.share) : pct(poll.personal.approval, 0)}</strong>${player ? deltaChip(row?.delta ?? 0, true) : ''}</div>${sparkline(series, player?.color ?? 'var(--party-accent)')}</div><dl class="hq-facts"><div><dt>Gradimento personale</dt><dd>${pct(poll.personal.approval, 0)}</dd></div>${player ? `<div><dt>${esc(world.place.municipality || 'Territorio')}</dt><dd>${pct(poll.local)}</dd></div>` : ''}${poll.government ?? poll.executive ? `<div><dt>Governo</dt><dd>${pct((poll.government ?? poll.executive).approval, 0)}</dd></div>` : ''}<div><dt>${isReal(poll) ? 'Fonte' : 'Istituto'}</dt><dd>${esc(poll.institute)} · ${marginText(poll)}</dd></div></dl></div>${chronicle(world, 3)}`;
}

// Tooltips for charts and marks: values stay reachable through labels and the data table.
// One tooltip for the whole page. It is hidden with display:none (the stylesheet gives it display:grid, which would
// otherwise override the hidden attribute and leave an empty dark box on screen), and it disappears whenever its
// anchor goes away: pointer out, touch end, render, route change, scroll, resize, focus loss.
let tipElement = null;
let tipAnchor = null;
let touchTimer = null;
let listening = false;
const attachedRoots = new WeakSet();
export function hideChartTip() {
  if (tipElement) { tipElement.hidden = true; tipElement.style.display = 'none'; tipElement.replaceChildren(); }
  tipAnchor = null;
  if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
  if (typeof document !== 'undefined') for (const line of document.querySelectorAll?.('.crosshair') ?? []) line.setAttribute('visibility', 'hidden');
}
export const isChartTipVisible = () => Boolean(tipElement && !tipElement.hidden && tipElement.style.display !== 'none');
function ensureTip() {
  if (tipElement && tipElement.isConnected !== false) return tipElement;
  for (const stale of document.querySelectorAll?.('.viz-tip') ?? []) stale.remove?.();
  tipElement = document.createElement('div');
  tipElement.className = 'viz-tip';
  tipElement.setAttribute?.('role', 'tooltip');
  tipElement.hidden = true;
  tipElement.style.display = 'none';
  document.body.append(tipElement);
  return tipElement;
}
export function attachChartInteractions(root) {
  if (!root?.addEventListener || typeof document === 'undefined' || attachedRoots.has(root)) return;
  attachedRoots.add(root);
  ensureTip();
  const place = (clientX, clientY) => {
    const tip = ensureTip();
    const { innerWidth } = window;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 12, clientX + 14))}px`;
    tip.style.top = `${Math.max(8, clientY - tip.offsetHeight - 12)}px`;
  };
  const reveal = () => { const tip = ensureTip(); tip.hidden = false; tip.style.display = ''; return tip; };
  const showText = (anchor, text, x, y) => { if (!text) return hideChartTip(); tipAnchor = anchor; const tip = reveal(); tip.replaceChildren(document.createTextNode(text)); place(x, y); };
  const showTrend = (chart, clientX, clientY) => {
    let data;
    try { data = JSON.parse(chart.dataset.trend); } catch { return hideChartTip(); }
    const box = chart.getBoundingClientRect();
    const ratio = (clientX - box.left) / box.width;
    const index = data.x.reduce((best, value, i) => Math.abs(value - ratio) < Math.abs(data.x[best] - ratio) ? i : best, 0);
    const line = chart.querySelector('.crosshair');
    const xPos = data.x[index] * Number(chart.querySelector('svg').viewBox.baseVal.width);
    line?.setAttribute('x1', xPos); line?.setAttribute('x2', xPos); line?.setAttribute('visibility', 'visible');
    const title = document.createElement('strong');
    title.textContent = data.weeks[index];
    const rows = data.series.map(series => {
      const row = document.createElement('span');
      const key = document.createElement('i');
      key.style.background = series.color;
      const value = document.createElement('b');
      value.textContent = Number.isFinite(series.values[index]) ? `${series.values[index].toLocaleString('it-IT', { maximumFractionDigits: 1 })}${data.unit ?? '%'}` : '—';
      row.append(key, value, document.createTextNode(` ${series.label}`));
      return row;
    });
    tipAnchor = chart;
    const tip = reveal();
    tip.replaceChildren(title, ...rows);
    place(clientX, clientY);
  };
  root.addEventListener('pointermove', event => {
    const chart = event.target.closest?.('[data-trend]');
    if (chart) return showTrend(chart, event.clientX, event.clientY);
    const mark = event.target.closest?.('[data-tip]');
    if (mark) return showText(mark, mark.dataset.tip, event.clientX, event.clientY);
    if (tipAnchor || isChartTipVisible()) hideChartTip();
  });
  // Leaving the anchor for anything that is not part of it hides the tooltip at once.
  root.addEventListener('pointerout', event => {
    if (!tipAnchor) return;
    const next = event.relatedTarget;
    if (!next || !tipAnchor.contains?.(next)) hideChartTip();
  });
  root.addEventListener('pointerleave', hideChartTip);
  root.addEventListener('pointerdown', event => { if (event.pointerType !== 'touch') hideChartTip(); });
  // On touch screens a tap shows the value briefly, then it goes away by itself.
  root.addEventListener('pointerup', event => { if (event.pointerType === 'touch' && tipAnchor) { clearTimeout(touchTimer); touchTimer = setTimeout(hideChartTip, 1800); } });
  root.addEventListener('pointercancel', hideChartTip);
  root.addEventListener('click', event => { if (!event.target.closest?.('[data-tip],[data-trend]')) hideChartTip(); });
  root.addEventListener('focusin', event => {
    const chart = event.target.closest?.('[data-trend]');
    const box = event.target.getBoundingClientRect();
    if (chart) showTrend(chart, box.right - 4, box.top + 20);
    else if (event.target.closest?.('[data-tip]')) showText(event.target, event.target.dataset.tip, box.left + box.width / 2, box.top);
  });
  root.addEventListener('focusout', hideChartTip);
  // A re-render can remove the anchor under a still pointer: the tooltip goes with it.
  if (typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (tipAnchor && !tipAnchor.isConnected) hideChartTip(); }).observe(root, { childList: true, subtree: true });
  if (listening) return;
  listening = true;
  // Anything that changes the page takes the tooltip away with it (registered once, whatever the number of roots).
  for (const type of ['hashchange', 'popstate', 'blur', 'resize']) globalThis.addEventListener?.(type, hideChartTip);
  globalThis.addEventListener?.('scroll', hideChartTip, { passive: true, capture: true });
  globalThis.addEventListener?.('keydown', event => { if (event.key === 'Escape') hideChartTip(); });
  document.addEventListener?.('visibilitychange', hideChartTip);
}
