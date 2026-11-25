// «Avanza fino a…» from the date of the top bar: a small calendar over the page to pick a day ahead, with the weeks and days that will pass, the votes and deadlines of the agenda marked on the
// days, and quick choices. It only PICKS the date: the advance is the one of the agenda (store.advanceToDate, through the same confirmation of app.js), week after week, stopping where the game
// stops (an urgent decision, a vote in the Chamber, a campaign). Loaded only when the date is clicked.
import { agendaCalendar } from '../core/agenda-engine.js?v=20261125-11';
import { ADVANCE_RULES } from '../data/simulation/career-rules.js?v=20261125-11';
import { advanceDays, formatDate } from '../core/time.js?v=20261125-11';
import { isEnglish } from '../core/i18n.js?v=20261125-11';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const DAYS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const T = (it, en) => (isEnglish() ? en : it);
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
// «3 settimane e 2 giorni»: what will pass between today and the day picked.
export function spanLabel(days) {
  const weeks = Math.floor(days / 7), rest = days % 7;
  const w = weeks ? T(`${weeks} ${weeks === 1 ? 'settimana' : 'settimane'}`, `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`) : '';
  const d = rest ? T(`${rest} ${rest === 1 ? 'giorno' : 'giorni'}`, `${rest} ${rest === 1 ? 'day' : 'days'}`) : '';
  return [w, d].filter(Boolean).join(T(' e ', ' and ')) || T('0 giorni', '0 days');
}
// The marks of the agenda on the days: votes, candidacy deadlines, appointments (the first one of each day is told on hover).
function marksOf(state, from, to) {
  const marks = new Map();
  let calendar = [];
  try { calendar = agendaCalendar(state); } catch { calendar = []; }
  for (const item of calendar) {
    if (!item?.date || item.date <= from || item.date > to) continue;
    const kind = item.kind === 'elezione' ? 'vote' : item.kind === 'candidature' || item.kind === 'selezione' ? 'deadline' : 'event';
    const known = marks.get(item.date);
    if (!known || (kind === 'vote' && known.kind !== 'vote')) marks.set(item.date, { kind, title: item.title });
  }
  return marks;
}
function grid(view, { today, picked, max, marks }) {
  const [y, m] = view;
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const offset = (first + 6) % 7;
  const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="dj-cell is-empty" aria-hidden="true"></span>');
  for (let d = 1; d <= length; d++) {
    const date = iso(y, m, d);
    const mark = marks.get(date);
    const disabled = date <= today || date > max;
    const cls = ['dj-cell', date === today ? 'is-today' : '', date === picked ? 'is-picked' : '', disabled ? 'is-off' : '', mark ? `has-${mark.kind}` : '', picked && date > today && date < picked ? 'is-span' : ''].filter(Boolean).join(' ');
    cells.push(`<button type="button" class="${cls}" data-dj-day="${date}" ${disabled ? 'disabled' : ''} aria-pressed="${date === picked}" aria-label="${esc(formatDate(date))}${mark ? ` · ${esc(mark.title)}` : ''}" ${mark ? `title="${esc(mark.title)}"` : ''}>${d}${mark ? '<i aria-hidden="true"></i>' : ''}</button>`);
  }
  return cells.join('');
}
function quick(state, today, max) {
  const vote = (state.game?.elections ?? []).filter(item => item.electionDate > today && item.status !== 'held').sort((a, b) => a.electionDate.localeCompare(b.electionDate))[0];
  const out = [[advanceDays(today, 7), T('+1 settimana', '+1 week')], [advanceDays(today, 14), T('+2 settimane', '+2 weeks')], [advanceDays(today, 28), T('+4 settimane', '+4 weeks')], [advanceDays(today, 91), T('+3 mesi', '+3 months')]];
  if (vote && vote.electionDate <= max) out.push([advanceDays(vote.electionDate, -1), T(`Vigilia del voto: ${vote.label}`, `Eve of the vote: ${vote.label}`)]);
  return out;
}
function body(state, ui) {
  const today = state.clock.currentDate;
  const max = advanceDays(today, Math.round(365.25 * ADVANCE_RULES.maxYears));
  const marks = marksOf(state, today, advanceDays(today, 800));
  const [y, m] = ui.view;
  const monthName = (isEnglish() ? MONTHS_EN : MONTHS)[m];
  const days = ui.picked ? daysBetween(today, ui.picked) : 0;
  const summary = ui.picked
    ? `<p class="dj-summary"><strong>${esc(spanLabel(days))}</strong> ${T('di gioco', 'of play')} · ${T('dal', 'from')} ${esc(formatDate(today))} ${T('al', 'to')} ${esc(formatDate(ui.picked))}</p>
       <p class="dj-note">${T('Ogni settimana intermedia viene giocata: eventi, sondaggi, Parlamento ed elezioni vanno avanti. L’avanzamento si ferma prima se arriva una decisione urgente, una votazione in Aula o una campagna elettorale, e ti dice perché.', 'Every week in between is played: events, polls, Parliament and elections go on. The advance stops earlier for an urgent decision, a vote in the Chamber or an election campaign, and tells you why.')}</p>`
    : `<p class="dj-summary is-empty">${T('Scegli un giorno nel calendario.', 'Pick a day on the calendar.')}</p>`;
  const crossed = ui.picked ? [...marks.entries()].filter(([date, mark]) => date <= ui.picked && mark.kind !== 'event').slice(0, 3) : [];
  return `<div class="dj-panel" role="dialog" aria-modal="true" aria-labelledby="dj-title">
    <header class="dj-head"><small>${T('AVANZA NEL TEMPO', 'MOVE FORWARD IN TIME')}</small><h2 id="dj-title">${T('Fino a quale giorno?', 'Up to which day?')}</h2>
      <button type="button" class="dj-close" data-dj-close aria-label="${T('Chiudi', 'Close')}">×</button></header>
    <div class="dj-quick">${quick(state, today, max).map(([date, label]) => `<button type="button" class="dj-chip${date === ui.picked ? ' is-on' : ''}" data-dj-day="${date}">${esc(label)}</button>`).join('')}</div>
    <div class="dj-month"><button type="button" class="dj-nav" data-dj-month="-1" aria-label="${T('Mese precedente', 'Previous month')}" ${iso(y, m, 1) <= today.slice(0, 8) + '01' ? 'disabled' : ''}>‹</button><strong>${esc(monthName)} ${y}</strong><button type="button" class="dj-nav" data-dj-month="1" aria-label="${T('Mese successivo', 'Next month')}">›</button></div>
    <div class="dj-week" aria-hidden="true">${(isEnglish() ? DAYS_EN : DAYS).map(day => `<span>${day}</span>`).join('')}</div>
    <div class="dj-grid">${grid(ui.view, { today, picked: ui.picked, max, marks })}</div>
    <p class="dj-legend"><span class="has-vote"><i></i>${T('voto', 'vote')}</span><span class="has-deadline"><i></i>${T('scadenza', 'deadline')}</span><span class="has-event"><i></i>${T('appuntamento', 'appointment')}</span></p>
    <label class="dj-input">${T('Oppure scrivi la data', 'Or type the date')}<input type="date" data-dj-input min="${advanceDays(today, 1)}" max="${max}" value="${esc(ui.picked ?? '')}" /></label>
    ${summary}
    ${crossed.length ? `<ul class="dj-crossed">${crossed.map(([date, mark]) => `<li><span class="has-${mark.kind}"><i></i></span>${esc(formatDate(date))} · ${esc(mark.title)}</li>`).join('')}</ul>` : ''}
    <footer class="dj-actions"><button type="button" class="secondary-button" data-dj-close>${T('Annulla', 'Cancel')}</button><button type="button" class="primary-button dj-go" data-dj-go ${ui.picked ? '' : 'disabled'}>${ui.picked ? T(`Avanza fino al ${esc(formatDate(ui.picked))}`, `Advance to ${esc(formatDate(ui.picked))}`) : T('Avanza', 'Advance')}</button></footer>
  </div>`;
}
// Opens the calendar; resolves with the date picked ('YYYY-MM-DD') or null when it is closed.
export function openDateJump(state, { initial = null } = {}) {
  document.querySelector('.date-jump')?.remove();
  const today = state.clock.currentDate;
  const start = initial && initial > today ? initial : null;
  const ui = { picked: start, view: [Number((start ?? today).slice(0, 4)), Number((start ?? today).slice(5, 7)) - 1] };
  const root = document.createElement('div');
  root.className = 'date-jump';
  const opener = document.activeElement;
  document.body.appendChild(root);
  const draw = () => { root.innerHTML = body(state, ui); };
  draw();
  root.querySelector('[data-dj-input]')?.focus({ preventScroll: true });
  return new Promise(resolve => {
    const close = value => { root.remove(); document.removeEventListener('keydown', onKey, true); try { opener?.focus?.({ preventScroll: true }); } catch { /* the opener may be gone */ } resolve(value); };
    const onKey = event => { if (event.key === 'Escape') { event.stopPropagation(); close(null); } };
    document.addEventListener('keydown', onKey, true);
    const max = advanceDays(today, Math.round(365.25 * ADVANCE_RULES.maxYears));
    const pick = date => { if (!date || date <= today || date > max) return; ui.picked = date; ui.view = [Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1]; draw(); };
    root.addEventListener('click', event => {
      if (event.target === root) return close(null);
      const day = event.target.closest('[data-dj-day]');
      if (day && !day.disabled) return pick(day.dataset.djDay);
      const month = event.target.closest('[data-dj-month]');
      if (month && !month.disabled) { const [y, m] = ui.view; const next = new Date(Date.UTC(y, m + Number(month.dataset.djMonth), 1)); ui.view = [next.getUTCFullYear(), next.getUTCMonth()]; draw(); return; }
      if (event.target.closest('[data-dj-close]')) return close(null);
      if (event.target.closest('[data-dj-go]') && ui.picked) return close(ui.picked);
    });
    root.addEventListener('change', event => { if (event.target.matches('[data-dj-input]')) pick(event.target.value); });
  });
}
