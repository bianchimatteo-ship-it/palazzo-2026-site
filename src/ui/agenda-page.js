// AGENDA — the time of the career: this week's decisions and days, the calendar of every dated commitment
// (votes, candidacies, congresses, promises, decrees, consequences), the weekly activities and the register.
import { AGENDA_KINDS, agendaByMonth, agendaCalendar } from '../core/agenda-engine.js?v=20260925-8';
import { STAT_LABELS } from '../data/simulation/career-rules.js?v=20260925-8';
import { advanceDays, formatDate } from '../core/time.js?v=20260925-8';
import { glyph } from './visuals.js?v=20260925-8';
import { renderInbox, renderPlanner } from './game-mode.js?v=20260925-8';
import { arrow, badge, card, esc, euro, num, sectionHero, sectionTabs, signed, table } from './sections-kit.js?v=20260925-8';

export const AGENDA_TABS = Object.freeze([['settimana', 'Questa settimana'], ['calendario', 'Calendario'], ['attivita', 'Attività'], ['registro', 'Registro']]);
// Filters of the calendar: groups of kinds, kept across redraws by the caller.
export const AGENDA_FILTERS = Object.freeze([
  ['tutto', 'Tutto', null],
  ['elezioni', 'Elezioni', ['elezione', 'candidature', 'campagna']],
  ['partito', 'Partito', ['selezione', 'congresso']],
  ['istituzioni', 'Parlamento e governo', ['decreto', 'alleato']],
  ['impegni', 'Promesse e conseguenze', ['promessa', 'conseguenza']],
  ['decisioni', 'Decisioni', ['decisione']],
  ['risorse', 'Risorse', ['investimento']]
]);
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const toneBadge = tone => tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : tone === 'good' ? 'good' : 'neutral';
const whenLabel = days => days === 0 ? 'oggi' : days === 1 ? 'domani' : days < 14 ? `tra ${days} giorni` : `tra ${Math.round(days / 7)} settimane`;

function actionOf(item) {
  const action = item.action;
  if (!action) return '';
  if (action.type === 'fastforward') {
    const entry = action.election;
    const weeks = Math.max(0, Math.ceil(item.days / 7));
    return `<button class="text-link" data-game-fastforward="${esc(entry.type)}" data-fastforward-label="${esc(entry.label)}" data-fastforward-date="${esc(entry.windowOpensAt)}" data-fastforward-weeks="${weeks}">Avanza fino a qui ${arrow}</button>`;
  }
  if (action.type === 'tab') return `<button class="text-link" data-section-tab="${esc(action.section)}" data-section-tab-value="${esc(action.tab)}">Apri ${arrow}</button>`;
  return `<button class="text-link" data-nav="${esc(action.page)}">Apri ${arrow}</button>`;
}

function itemRow(item) {
  const kind = AGENDA_KINDS[item.kind] ?? { label: 'Impegno', icon: 'clock' };
  return `<li class="ag-item tone-${esc(item.tone)} ${item.urgent ? 'is-urgent' : ''}">
    <time class="ag-date" datetime="${esc(item.date)}"><strong>${esc(formatDate(item.date, { day: '2-digit' }))}</strong><span>${esc(formatDate(item.date, { month: 'short' }))}</span></time>
    <div class="ag-copy"><div class="ag-meta">${glyph(kind.icon, 14)}<span>${esc(kind.label)}</span>${badge(whenLabel(item.days), item.urgent ? 'bad' : item.days <= 14 ? 'warn' : 'neutral')}</div><strong>${esc(item.title)}</strong>${item.detail ? `<small>${esc(item.detail)}</small>` : ''}</div>
    <div class="ag-action">${actionOf(item)}</div>
  </li>`;
}

// A month as a grid of days: every dated commitment marks its day (a list below gives the details).
function monthGrid(month, items, today) {
  const [year, monthIndex] = month.split('-').map(Number);
  const first = `${month}-01`;
  const offset = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  const length = new Date(year, monthIndex, 0).getDate();
  const byDay = new Map();
  for (const item of items) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
  const cells = [...Array(offset).fill('<span class="ag-cell is-blank" aria-hidden="true"></span>'), ...Array.from({ length }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    const entries = byDay.get(date) ?? [];
    const label = entries.map(item => item.title).join(' · ');
    return `<span class="ag-cell ${date === today ? 'is-today' : ''} ${entries.length ? `has-items tone-${entries.some(item => item.urgent) ? 'bad' : toneBadge(entries[0].tone)}` : ''}" ${entries.length ? `title="${esc(label)}" aria-label="${esc(`${formatDate(date)}: ${label}`)}"` : ''}><b>${index + 1}</b>${entries.length ? `<i>${entries.length}</i>` : ''}</span>`;
  })];
  return `<div class="ag-month"><h4>${esc(formatDate(first, { month: 'long', year: 'numeric' }))}</h4><div class="ag-grid" role="grid">${WEEKDAYS.map(day => `<span class="ag-weekday">${day}</span>`).join('')}${cells.join('')}</div></div>`;
}

function weekStrip(state) {
  const game = state.game;
  const dots = Array.from({ length: game.week.maxAp }, (_, index) => `<i class="${index < game.week.ap ? 'on' : ''}"></i>`).join('');
  const used = game.week.categoriesUsed ?? [];
  return `<div class="ag-week"><div><small>GIORNI DISPONIBILI</small><span class="hq-dots" aria-label="${game.week.ap} giorni su ${game.week.maxAp}">${dots}</span><strong>${game.week.ap} / ${game.week.maxAp}</strong></div><div><small>AMBITI GIÀ SEGUITI</small><strong>${used.length ? esc(used.join(', ')) : 'nessuno'}</strong><em>Variare gli ambiti evita la stanchezza del pubblico.</em></div><div class="ag-week-action"><button class="secondary-button" data-section-tab="agenda" data-section-tab-value="attivita">Pianifica i giorni</button><button class="primary-button" data-action="advance" ${game.status === 'ended' ? 'disabled' : ''}>${state.campaign?.status === 'active' ? 'Avanza la campagna' : 'Chiudi la settimana'} ${arrow}</button></div></div>`;
}

function lastWeek(state) {
  const report = state.game.lastReport;
  if (!report) return '<p class="sx-empty">Il bilancio comparirà alla chiusura della prima settimana.</p>';
  const deltas = Object.entries(report.deltas ?? {});
  return `<ul class="eh-lines">${report.lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>${deltas.length ? `<ul class="eh-deltas">${deltas.map(([metric, value]) => `<li class="tone-${value > 0 ? 'good' : value < 0 ? 'bad' : 'neutral'}"><span>${esc(STAT_LABELS[metric] ?? metric)}</span><b>${signed(value)}</b></li>`).join('')}</ul>` : ''}`;
}

function register(state, events) {
  const game = state.game;
  const log = game.log.slice(0, 24).map(entry => ({ week: `S${entry.week}`, title: `<strong>${esc(entry.title)}</strong>${entry.lines?.length ? `<small> · ${esc(entry.lines.slice(0, 2).join(' · '))}</small>` : ''}`, tone: badge(entry.tone === 'good' ? 'positivo' : entry.tone === 'bad' ? 'negativo' : 'neutro', toneBadge(entry.tone)) }));
  const agenda = events.slice(0, 24).map(event => ({ date: esc(formatDate(event.date, { day: 'numeric', month: 'short', year: 'numeric' })), title: `<strong>${esc(event.title)}</strong>`, category: esc(event.category ?? ''), status: esc(event.status ?? '') }));
  return `<div class="sx-grid two">${card({ kicker: 'DIARIO · SIMULAZIONE', title: 'Cosa hai fatto', body: table([['week', 'Sett.'], ['title', 'Attività'], ['tone', 'Esito']], log, { empty: 'Il diario si riempirà con le tue scelte.' }) })}${card({ kicker: 'APPUNTAMENTI REGISTRATI', title: 'Eventi e scadenze passate', body: table([['date', 'Data'], ['title', 'Evento'], ['category', 'Tipo'], ['status', 'Stato']], agenda, { empty: 'Nessun appuntamento registrato.' }) })}</div>`;
}

function hero(state, calendar) {
  const game = state.game;
  const start = game.week.startedAt ?? state.clock.currentDate;
  const end = advanceDays(start, 6);
  const urgent = game.inbox.filter(item => ['urgente', 'situazione'].includes(item.kind)).length;
  const next = calendar.find(item => item.kind !== 'decisione');
  return sectionHero({
    kicker: `AGENDA · SETTIMANA ${game.week.index}`, icon: 'clock', tone: urgent ? 'campaign' : 'default',
    title: `Dal ${formatDate(start, { day: 'numeric', month: 'long' })} al ${formatDate(end, { day: 'numeric', month: 'long', year: 'numeric' })}`,
    lead: `${game.inbox.length ? `${game.inbox.length} ${game.inbox.length === 1 ? 'decisione' : 'decisioni'} da prendere entro fine settimana` : 'Nessuna decisione in sospeso'}${next ? ` · prossimo appuntamento ${whenLabel(next.days)}: “${next.title}”` : ''}.`,
    actions: `<button class="primary-button" data-action="advance" ${game.status === 'ended' ? 'disabled' : ''}>${state.campaign?.status === 'active' ? 'Avanza la campagna' : 'Chiudi la settimana'} ${arrow}</button><button class="secondary-button" data-section-tab="agenda" data-section-tab-value="calendario">Calendario</button>`,
    kpis: [
      { label: 'Giorni disponibili', value: `${game.week.ap} / ${game.week.maxAp}`, bar: game.week.ap / Math.max(1, game.week.maxAp) * 100, tone: game.week.ap === 0 ? 'bad' : '' },
      { label: 'Decisioni in sospeso', value: num(game.inbox.length, 0), note: urgent ? `${urgent} urgenti` : 'nessuna urgente', tone: urgent ? 'bad' : '' },
      { label: 'Prossimi 30 giorni', value: num(calendar.filter(item => item.days <= 30 && item.kind !== 'decisione').length, 0), note: 'appuntamenti e scadenze' },
      { label: 'Fondi', value: euro(game.resources.funds) },
      { label: 'Capitale politico', value: `${num(game.resources.politicalCapital, 0)}/100` }
    ]
  });
}

export function renderAgendaPage(state, { tab = null, filter = 'tutto', events = [] } = {}) {
  if (!state.game) return '';
  const calendar = agendaCalendar(state);
  const active = AGENDA_TABS.some(([id]) => id === tab) ? tab : 'settimana';
  const counts = { settimana: state.game.inbox.length || '', calendario: calendar.filter(item => item.days <= 30).length || '' };
  let body = '';
  if (active === 'settimana') {
    const soon = calendar.filter(item => item.days <= 14 && item.kind !== 'decisione');
    body = `${weekStrip(state)}${card({ kicker: 'DA DECIDERE', title: 'Decisioni in agenda', body: renderInbox(state), id: 'hq-inbox' })}<div class="sx-grid two">${card({ kicker: 'PROSSIMI 14 GIORNI', title: soon.length ? `${soon.length} ${soon.length === 1 ? 'appuntamento' : 'appuntamenti'}` : 'Nessun appuntamento', body: soon.length ? `<ol class="ag-list">${soon.map(itemRow).join('')}</ol>` : '<p class="sx-empty">Due settimane libere: è il momento di lavorare sul territorio o nel partito.</p>', action: `<button class="text-link" data-section-tab="agenda" data-section-tab-value="calendario">Calendario ${arrow}</button>` })}${card({ kicker: `SETTIMANA ${state.game.lastReport?.week ?? state.game.week.index - 1}`, title: 'Bilancio della settimana chiusa', body: lastWeek(state) })}</div>`;
  } else if (active === 'calendario') {
    const group = AGENDA_FILTERS.find(([id]) => id === filter) ?? AGENDA_FILTERS[0];
    const visible = group[2] ? calendar.filter(item => group[2].includes(item.kind)) : calendar;
    const months = agendaByMonth(visible);
    const today = state.clock.currentDate;
    const gridMonths = [today.slice(0, 7), advanceDays(`${today.slice(0, 7)}-01`, 32).slice(0, 7)];
    const filters = `<div class="ag-filters" role="group" aria-label="Filtra il calendario">${AGENDA_FILTERS.map(([id, label, kinds]) => { const count = kinds ? calendar.filter(item => kinds.includes(item.kind)).length : calendar.length; return `<button data-view-filter="agenda" data-view-filter-value="${id}" class="${group[0] === id ? 'active' : ''}" aria-pressed="${group[0] === id}">${esc(label)}${count ? ` · ${count}` : ''}</button>`; }).join('')}</div>`;
    body = `${filters}<div class="ag-layout"><div class="ag-months">${gridMonths.map(month => monthGrid(month, visible, today)).join('')}<p class="sx-note">Giorni evidenziati: scadenze e appuntamenti. Rosso: urgente. Il calendario elettorale è simulato con cicli accelerati.</p></div><div class="ag-timeline">${months.length ? months.map(({ month, entries }) => `<section class="ag-group"><h3>${esc(formatDate(`${month}-01`, { month: 'long', year: 'numeric' }))}</h3><ol class="ag-list">${entries.map(itemRow).join('')}</ol></section>`).join('') : '<p class="sx-empty">Nessun impegno per questo filtro nei prossimi due anni.</p>'}</div></div>`;
  } else if (active === 'attivita') {
    body = `${weekStrip(state)}${card({ kicker: 'AGENDA DEL POLITICO', title: 'Come usi la settimana', body: renderPlanner(state), id: 'hq-planner' })}`;
  } else {
    body = register(state, events);
  }
  return `<div class="agenda-page">${hero(state, calendar)}${sectionTabs('agenda', AGENDA_TABS.map(([id, label]) => [id, label, counts[id]]), active)}<div class="sx-body" role="tabpanel">${body}</div></div>`;
}
