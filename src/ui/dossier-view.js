// The Council of Ministers at work: the dossiers each minister took on (objective, term, progress read from the game, results and who is to blame) and the balance of
// the Government's programme against the measures enacted. The Prime Minister can help a dossier; everyone else reads.
import { DOSSIER_KINDS, DOSSIER_RULES } from '../data/simulation/dossier-rules.js?v=20261010-2';
import { AREA_BY_ID } from '../data/simulation/policy-rules.js?v=20261010-2';
import { isPrimeMinister } from '../core/roles.js?v=20261010-2';
import { dossiersOf, openDossiers, programReport } from '../core/dossier-engine.js?v=20261010-2';
import { esc, meter } from './charts.js?v=20261010-2';
import { glyph } from './visuals.js?v=20261010-2';

const BLAME = { ministro: 'colpa del ministro', maggioranza: 'maggioranza troppo stretta', circostanze: 'le circostanze' };
const OUTCOME = { riuscito: 'Riuscito', fallito: 'Fallito', ritirato: 'Ritirato' };
const STATUS = { attuata: 'Attuata', 'in-corso': 'In corso', ferma: 'Ferma' };

function openRow(dossier, state, canAct) {
  const kind = DOSSIER_KINDS[dossier.kind];
  const minister = (state.parliament.government.ministers ?? []).find(item => item.id === dossier.ministerId);
  const record = minister?.dossiers ? ` · ${minister.dossiers.done ?? 0} riusciti, ${minister.dossiers.failed ?? 0} falliti` : '';
  const pressure = minister?.pressure ? `<span class="badge badge-warn">sotto pressione</span>` : '';
  const actions = canAct ? `<div class="project-actions">${dossier.kind === 'emergenza' ? `<button class="secondary-button" data-dossier-action="fund" data-dossier-id="${esc(dossier.id)}" ${dossier.funded ? 'disabled' : ''}>${dossier.funded ? 'Finanziato' : `Finanzia · ${DOSSIER_RULES.fund.cost} punti di margine · 1 giorno · 1 cap.`}</button>` : `<button class="secondary-button" data-dossier-action="draft" data-dossier-id="${esc(dossier.id)}" ${dossier.drafted ? 'disabled' : ''}>${dossier.drafted ? 'Testo presentato' : 'Testo del ministro · 1 giorno · 2 cap.'}</button>`}
      <button class="secondary-button" data-dossier-action="postpone" data-dossier-id="${esc(dossier.id)}" ${dossier.postponed ? 'disabled' : ''}>${dossier.postponed ? 'Già rinviato' : 'Più tempo · 1 giorno · 1 cap.'}</button>
      <button class="secondary-button danger-link" data-dossier-action="withdraw" data-dossier-id="${esc(dossier.id)}">Ritira · 1 giorno · 1 cap.</button></div>` : '';
  return `<article class="project-row dossier-row ${dossier.kind}"><div class="project-head">${glyph(kind.icon, 20)}<div><strong>${esc(dossier.title)}</strong><small>Ministero ${esc(dossier.portfolio)}${dossier.groupId ? '' : ' · tecnico'}${esc(record)} · ${esc(kind.label)}${dossier.origin === 'programma' ? ' · priorità del programma' : dossier.origin === 'emergenza' ? ' · problema del Paese' : ''}</small></div>${pressure}<span class="badge">${Math.round(dossier.progress)}%</span></div>
    <div class="project-progress">${meter(dossier.progress, dossier.progress < 35 ? 'danger' : '')}<small>Scadenza ${esc(dossier.due)}${dossier.postponed ? ' (prorogata)' : ''} · ${esc(dossier.kind === 'emergenza' ? `da ${dossier.start} a ${dossier.goal} nel settore ${AREA_BY_ID[dossier.area]?.label.toLowerCase() ?? ''}` : kind.criterion)}</small></div>${actions}</article>`;
}
function closedRow(dossier) {
  return `<article class="project-row dossier-row closed ${dossier.status === 'riuscito' ? 'completato' : 'sospeso'}"><div class="project-head">${glyph(DOSSIER_KINDS[dossier.kind]?.icon ?? 'law', 18)}<div><strong>${esc(dossier.title)}</strong><small>Ministero ${esc(dossier.portfolio)} · chiuso alla S${dossier.closedWeek ?? '—'}${dossier.blame ? ` · ${esc(BLAME[dossier.blame] ?? dossier.blame)}` : ''}</small></div><span class="badge">${esc(OUTCOME[dossier.status] ?? dossier.status)}</span></div></article>`;
}

export function dossierPanel(state) {
  const parliament = state.parliament;
  const government = parliament?.government;
  if (!government || !['active', 'crisis'].includes(government.status)) return '';
  const canAct = isPrimeMinister(parliament) && government.status === 'active';
  const open = openDossiers(government), closed = dossiersOf(government).filter(item => !['aperto', 'rinviato'].includes(item.status)).sort((a, b) => (b.closedWeek ?? 0) - (a.closedWeek ?? 0)).slice(0, 4);
  const report = state.society ? programReport(parliament, state.society, state.clock.currentDate) : null;
  if (!open.length && !closed.length && !report) return '';
  const done = dossiersOf(government).filter(item => item.status === 'riuscito').length, failed = dossiersOf(government).filter(item => item.status === 'fallito').length;
  const program = report ? `<div class="pm-block"><h3>${glyph('route', 16)} Il programma di governo alla prova · ${report.done}/${report.total} priorità attuate</h3>
    <ul class="program-report">${report.rows.map(row => `<li class="${row.status}"><span>${esc(row.label)}</span><b>${esc(STATUS[row.status])}</b><small>${row.status === 'attuata' ? esc(row.measures.join(' · ')) : row.bill ? esc(`«${row.bill.title}»: ${row.bill.stage}`) : 'nessun provvedimento della maggioranza nella materia'}</small></li>`).join('')}</ul>
    <small class="parliament-note">${report.settled ? 'Il bilancio è stato fatto: ha già pesato su stabilità e alleati.' : `Dopo ${DOSSIER_RULES.program.weeks} settimane il programma viene misurato sulle misure approvate (oggi ${report.weeks}): ${Math.round(DOSSIER_RULES.program.good * 100)}% o più rafforza il governo, ${Math.round(DOSSIER_RULES.program.bad * 100)}% o meno lo indebolisce.`}</small></div>` : '';
  return `<section class="government-current dossier-desk"><div class="home-section-heading"><div><span class="section-kicker">CONSIGLIO DEI MINISTRI · SIMULAZIONE</span><h2>I dossier dei ministri</h2></div><span class="badge">${open.length} aperti · ${done} riusciti · ${failed} falliti</span></div>
    <p class="parliament-note">Ogni ministro prende in carico un obiettivo nel suo settore, con una scadenza: una riforma si chiude quando una legge della maggioranza è approvata, un settore in difficoltà quando il suo livello nel Paese raggiunge l’obiettivo. Il risultato pesa su ministro, governo e gruppo di provenienza${canAct ? '; tu puoi aiutare un dossier o toglierlo' : ''}.</p>
    ${open.length ? `<div class="project-list">${open.map(item => openRow(item, state, canAct)).join('')}</div>` : '<p class="quiet-copy">Nessun dossier aperto: i ministri ne prendono in carico di nuovi dopo una pausa.</p>'}
    ${closed.length ? `<h4 class="news-subhead">Chiusi di recente</h4><div class="project-list">${closed.map(closedRow).join('')}</div>` : ''}${program}</section>`;
}
