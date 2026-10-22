// The staff in the Home: what it is working on (mandates with progress, budget spent and the last report), what it can be asked to do (with the skill each task needs and why one cannot be
// given), and what is never delegated. Every control is a real action of the store: give, change, suspend, resume, cancel. Nothing starts without the player's confirmation.
import { STAFF_DURATIONS, STAFF_SKILLS } from '../data/simulation/staff-rules.js?v=20261022-13';
import { delegableNotes, mandateQuality, staffTargets, staffView, taskProblem } from '../core/staff-engine.js?v=20261022-13';
import { badge, bar, esc, euro, num } from './sections-kit.js?v=20261022-13';
import { artTile, glyph } from './visuals.js?v=20261022-13';

const STATUS_TONE = { attivo: 'good', sospeso: 'warn', concluso: 'neutral', annullato: 'neutral' };
const targetLabel = (game, mandate) => mandate.target ? (staffTargets(game, mandate.task).find(([id]) => id === mandate.target)?.[1] ?? 'bersaglio non più disponibile') : 'dove serve di più';
const durationOptions = selected => STAFF_DURATIONS.map(([weeks, label]) => `<option value="${weeks}" ${weeks === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');

function mandateCard(state, mandate, view) {
  const game = state.game;
  const task = view.tasks.find(item => item.id === mandate.task);
  const open = mandate.status === 'attivo' || mandate.status === 'sospeso';
  const progress = Math.min(100, Math.round(mandate.points / Math.max(1, mandate.objective) * 100));
  const quality = open ? mandateQuality(game, state.dataset.statistics.filter(item => item.subjectId === state.career.playerId).reduce((all, item) => ({ ...all, [item.metric]: item.value }), {}), mandate) : null;
  const last = mandate.lastReport;
  const edit = open ? `<details class="staff-edit"><summary>Modifica</summary><form data-staff-edit-form data-mandate-id="${esc(mandate.id)}" class="staff-form">
      <label>Budget a settimana (€)<input type="number" name="weeklyBudget" min="${task.minWeeklyBudget}" max="2000" step="10" value="${mandate.weeklyBudget}" required /></label>
      <label>Tetto di spesa (€)<input type="number" name="budgetMax" min="${mandate.spent + mandate.weeklyBudget}" max="20000" step="1" value="${mandate.budgetMax}" required /></label>
      <label>Settimane ancora<input type="number" name="weeks" min="1" max="26" value="${Math.max(1, mandate.weeksLeft)}" required /></label>
      <label>Obiettivo (${esc(task.unit)})<input type="number" name="objective" min="1" value="${mandate.objective}" required /></label>
      ${task.target ? `<label>Bersaglio<select name="target"><option value="">${task.target === 'committee' ? 'Il comitato che ne ha più bisogno' : 'Il dirigente più scontento'}</option>${staffTargets(game, task.id).map(([id, label]) => `<option value="${esc(id)}" ${id === mandate.target ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>` : ''}
      <button type="submit" class="secondary-button">Salva le modifiche</button></form></details>` : '';
  return `<article class="staff-mandate is-${esc(mandate.status)}" data-mandate="${esc(mandate.id)}">
    <header>${artTile(task.icon, mandate.status === 'attivo' ? 'var(--party-accent)' : '#8c988b', 'sm')}<div><strong>${esc(task.label)}</strong><small>${esc(targetLabel(game, mandate))} · ${mandate.kind === 'singolo' ? 'una volta' : `${mandate.weeksDone}/${mandate.weeksDone + Math.max(0, mandate.weeksLeft)} settimane`}</small></div>${badge(view.status[mandate.status] ?? mandate.status, STATUS_TONE[mandate.status] ?? 'neutral')}</header>
    <div class="staff-progress"><div class="pl-meter"><span>Obiettivo</span>${bar(progress, progress >= 100 ? 'good' : '')}<b>${num(mandate.points, 0)}/${num(mandate.objective, 0)}</b></div><small>${esc(task.unit)} · speso ${euro(mandate.spent)} su ${euro(mandate.budgetMax)} (${euro(mandate.weeklyBudget)} a settimana)${quality !== null ? ` · resa dello staff ${Math.round(quality * 100)}%` : ''}</small></div>
    ${last ? `<p class="staff-report ${last.tone === 'warn' ? 'is-warn' : ''}"><small>Settimana ${last.week}</small> ${esc(last.text)}</p>` : '<p class="staff-report"><small>Primo resoconto alla chiusura della settimana.</small></p>'}
    ${mandate.outcome ? `<p class="sx-note">Concluso: ${esc(mandate.outcome)}.</p>` : ''}
    ${open ? `<div class="staff-actions">${mandate.status === 'attivo' ? `<button type="button" class="secondary-button" data-staff-status="sospeso" data-mandate-id="${esc(mandate.id)}">Sospendi</button>` : `<button type="button" class="secondary-button" data-staff-status="attivo" data-mandate-id="${esc(mandate.id)}">Riprendi</button>`}<button type="button" class="secondary-button danger" data-staff-status="annullato" data-mandate-id="${esc(mandate.id)}">Annulla</button></div>${edit}` : ''}
  </article>`;
}

function taskCard(state, task, view, stats) {
  const game = state.game;
  const problem = !view.capacity.max ? view.capacity.reason : !view.capacity.free ? `Lo staff ha già ${view.capacity.used} incarichi aperti su ${view.capacity.max}.` : taskProblem(game, stats, task.id);
  const skill = view.skills[task.skill];
  const targets = task.target ? staffTargets(game, task.id) : [];
  const form = problem ? '' : `<form data-staff-form data-task="${esc(task.id)}" class="staff-form">
    ${task.target ? `<label>Bersaglio<select name="target"><option value="">${task.target === 'committee' ? 'Il comitato che ne ha più bisogno' : 'Il dirigente più scontento'}</option>${targets.map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select></label>` : ''}
    <label>Durata<select name="weeks">${durationOptions(4)}</select></label>
    <label>Budget a settimana (€)<input type="number" name="weeklyBudget" min="${task.minWeeklyBudget}" max="2000" step="10" value="${task.minWeeklyBudget + 30}" required /></label>
    <label>Tetto di spesa (€)<input type="number" name="budgetMax" min="${task.minWeeklyBudget}" max="20000" step="1" value="${(task.minWeeklyBudget + 30) * 4}" required /></label>
    <label>Obiettivo (${esc(task.unit)})<input type="number" name="objective" min="1" value="${task.objective}" required /></label>
    <button type="submit" class="primary-button">Rivedi e affida</button></form>`;
  return `<article class="staff-task ${problem ? 'is-blocked' : ''}">
    <header>${artTile(task.icon, problem ? '#8c988b' : 'var(--party-accent)', 'sm')}<div><strong>${esc(task.label)}</strong><small>${esc(task.detail)}</small></div></header>
    <p class="sx-note"><b>Serve</b> ${esc(STAFF_SKILLS[task.skill])} ${skill}/100 (almeno ${task.minSkill}) · da ${euro(task.minWeeklyBudget)} a settimana</p>
    ${problem ? `<p class="staff-problem">${glyph('alert', 14)} ${esc(problem)}</p>` : `<details class="staff-give"><summary>Affida questo incarico</summary>${form}</details>`}
  </article>`;
}

export function renderStaffBand(state) {
  const game = state.game;
  if (!game) return '';
  const stats = Object.fromEntries(state.dataset.statistics.filter(item => item.subjectId === state.career.playerId).map(item => [item.metric, item.value]));
  const view = staffView(game, stats);
  const skills = Object.entries(STAFF_SKILLS).map(([id, label]) => `<li><span>${esc(label)}</span>${bar(view.skills[id], view.skills[id] >= 50 ? 'good' : '')}<b>${view.skills[id]}</b></li>`).join('');
  const open = view.open.map(mandate => mandateCard(state, mandate, view)).join('');
  const closed = view.closed.length ? `<details class="staff-closed"><summary>Incarichi conclusi o annullati (${view.closed.length})</summary>${view.closed.map(mandate => mandateCard(state, mandate, view)).join('')}</details>` : '';
  const tasks = `<details class="staff-new" ${open ? '' : 'open'}><summary>${glyph('users', 15)} Affida un incarico allo staff</summary><div class="staff-tasks">${view.tasks.map(task => taskCard(state, task, view, stats)).join('')}</div></details>`;
  const limits = `<details class="staff-limits"><summary>Cosa non si delega mai</summary><ul>${delegableNotes().map(item => `<li><strong>${esc(item.what)}</strong><small>${esc(item.why)}</small></li>`).join('')}</ul></details>`;
  const reports = view.reports.length ? `<ul class="staff-log">${view.reports.slice(0, 4).map(entry => `<li class="${entry.tone === 'warn' ? 'is-warn' : ''}"><small>S${entry.week}</small> ${esc(entry.text)}</li>`).join('')}</ul>` : '';
  const room = view.capacity.max ? `${view.capacity.used}/${view.capacity.max} incarichi` : 'Staff non ancora formato';
  return `<section class="hqc-band hqc-staff" id="hq-staff"><header class="hqc-band-head"><div><span class="section-kicker">STAFF · SIMULATO</span><h2>Cosa fa il tuo staff</h2><p>Incarichi con un obiettivo, una durata e un budget massimo: lo staff lavora a ogni chiusura di settimana, ti scrive un resoconto e puoi cambiare, sospendere o annullare tutto.</p></div><span class="hq-count" title="Incarichi aperti e posti dello staff">${esc(room)}</span></header>
    <ul class="staff-skills" aria-label="Competenze dello staff">${skills}</ul>
    ${open || '<p class="quiet-copy">Nessun incarico aperto. Lo staff lavora al posto tuo solo su ciò che gli affidi: tu continui a decidere.</p>'}${reports}${tasks}${closed}${limits}
    <p class="poll-footnote">Staff, budget e risultati sono simulati: le persone dello staff non sono reali e il denaro è moneta di gioco.</p></section>`;
}
