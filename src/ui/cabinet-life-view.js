// The team of the Government (cabinet-life-engine.js): each minister with the grade of the last evaluation, competence, loyalty, bond with the Prime Minister, ambition and pressure; what waits for the
// Prime Minister (requests, conflicts, the cabinet meeting) with its buttons; the latest decisions. Read only for whoever is not the Prime Minister: the page then tells what is going on.
import { GRADE_LABELS, cabinetView } from '../core/cabinet-life-engine.js?v=20261106-1';
import { esc } from './charts.js?v=20261106-1';
import { glyph } from './visuals.js?v=20261106-1';

const meter = (value, tone = '') => `<b class="cl-meter ${tone}" role="img" aria-label="${esc(String(Math.round(value ?? 0)))}"><i style="width:${Math.max(0, Math.min(100, Number(value) || 0))}%"></i></b>`;
const gradeChip = grade => grade ? `<span class="cl-grade grade-${esc(grade)}">${esc(GRADE_LABELS[grade])}</span>` : '<span class="cl-grade grade-none">Non ancora valutato</span>';
const button = (kind, id, choice, label, tone = 'ghost-button') => `<button type="button" class="${tone}" data-cabinet-kind="${esc(kind)}" data-cabinet-id="${esc(id)}" data-cabinet-choice="${esc(choice)}">${esc(label)}</button>`;

export function renderCabinetLife(state) {
  const view = cabinetView(state.parliament, { week: state.game?.week?.index ?? 0 });
  if (!view) return '';
  const premier = state.parliament?.government?.primeMinister === 'player';
  const rows = view.ministers.map(item => `<li class="cl-minister${item.playerAppointed ? ' is-player' : ''}">
    <div class="cl-head"><strong>${esc(item.portfolio)}</strong><small>${esc(item.groupName ?? '')}</small>${gradeChip(item.grade)}</div>
    <dl class="cl-traits"><div><dt>Competenza</dt><dd>${meter(item.competence ?? 50)}</dd></div><div><dt>Lealtà</dt><dd>${meter(item.loyalty ?? 50, (item.loyalty ?? 50) < 35 ? 'bad' : '')}</dd></div>
    <div><dt>Rapporto con il Presidente del Consiglio</dt><dd>${meter(item.bond)}</dd></div><div><dt>Ambizione</dt><dd>${meter(item.ambition, 'warm')}</dd></div></dl></li>`).join('');
  const requests = view.requests.map(item => `<li><span>${glyph('users', 14)} ${item.type === 'ambizione' ? `Il ministro ${esc(item.minister.portfolio)} chiede più peso nel governo.` : `${esc(item.by.charAt(0).toUpperCase() + item.by.slice(1))} chiedono di sostituire il ministro ${esc(item.minister.portfolio)}.`}</span>
    ${premier ? `<span class="cl-actions">${button('request', item.id, 'accogli', item.type === 'ambizione' ? 'Accogli' : 'Sostituisci', 'primary-button')}${button('request', item.id, 'rifiuta', item.type === 'ambizione' ? 'Respingi' : 'Conferma il ministro')}</span>` : ''}</li>`).join('');
  const conflicts = view.conflicts.map(item => `<li><span>${glyph('alert', 14)} Scontro fra ${esc(item.ministerA?.portfolio ?? '—')} e ${esc(item.ministerB?.portfolio ?? '—')} su ${esc(item.issue.toLowerCase())}.</span>
    ${premier ? `<span class="cl-actions">${button('conflict', item.id, 'media', 'Media', 'primary-button')}${button('conflict', item.id, 'sostieni-a', `Sostieni ${item.ministerA?.portfolio ?? ''}`)}${button('conflict', item.id, 'sostieni-b', `Sostieni ${item.ministerB?.portfolio ?? ''}`)}</span>` : ''}</li>`).join('');
  const meeting = view.meeting ? `<li><span>${glyph('ministry', 14)} Consiglio dei ministri: si discute di ${esc(view.meeting.topic.toLowerCase())}.</span>
    ${premier ? `<span class="cl-actions">${button('meeting', view.meeting.id, 'approvare', 'Approva', 'primary-button')}${button('meeting', view.meeting.id, 'rinviare', 'Rinvia')}${button('meeting', view.meeting.id, 'respingere', 'Respingi')}</span>` : '<small>Decide il Presidente del Consiglio.</small>'}</li>` : '';
  const waiting = requests + conflicts + meeting;
  const recent = view.recent.map(item => `<li>${esc(item.topic)}: ${item.choice === 'approvare' ? 'approvato' : item.choice === 'rinviare' ? 'rinviato' : 'respinto'}</li>`).join('');
  return `<details class="pm-block pm-fold cabinet-life" data-remember="gov-team" open><summary><span class="pm-fold-title">${glyph('users', 16)} <strong>La squadra di governo</strong></span><small>${view.ministers.length} ministri${view.requests.length + view.conflicts.length + (view.meeting ? 1 : 0) ? ` · ${view.requests.length + view.conflicts.length + (view.meeting ? 1 : 0)} da seguire` : ''}</small></summary>
    <div class="cl-body">
      ${waiting ? `<ul class="cl-waiting">${waiting}</ul>` : '<p class="parliament-note">Nessuna richiesta, scontro o Consiglio in sospeso.</p>'}
      ${recent ? `<details class="cl-recent"><summary>Ultime decisioni del Consiglio</summary><ul>${recent}</ul></details>` : ''}
      <ul class="cl-list">${rows}</ul>
      <p class="parliament-note">Ogni tre mesi circa i ministri vengono valutati. Un buon ministro rende più efficaci le misure del suo settore; uno insufficiente le indebolisce. Le ambizioni, gli scontri e le dimissioni polemiche pesano sulla stabilità e sugli alleati.</p>
    </div></details>`;
}
