// The team of the Government (cabinet-life-engine.js): each minister with the grade of the last evaluation, competence, loyalty, bond with the Prime Minister, ambition and pressure; what waits for the
// Prime Minister (requests, conflicts, the cabinet meeting) with its buttons; the latest decisions. Read only for whoever is not the Prime Minister: the page then tells what is going on.
import { GRADE_LABELS, cabinetView } from '../core/cabinet-life-engine.js?v=20261111-2';
import { esc } from './charts.js?v=20261111-2';
import { glyph } from './visuals.js?v=20261111-2';
import { avatarSvg } from './avatar-svg.js?v=20261111-2';
import { defaultAvatarFor } from '../core/avatar.js?v=20261111-2';

const meter = (value, tone = '') => `<b class="cl-meter ${tone}" role="img" aria-label="${esc(String(Math.round(value ?? 0)))}"><i style="width:${Math.max(0, Math.min(100, Number(value) || 0))}%"></i></b>`;
const gradeChip = grade => grade ? `<span class="cl-grade grade-${esc(grade)}">${esc(GRADE_LABELS[grade])}</span>` : '<span class="cl-grade grade-none">Non ancora valutato</span>';
const explain = (options, cost = 'Costo: 1 capitale politico.') => `<small class="cl-explain">${options.map(([name, text]) => `<span class="cl-opt"><b>${esc(name)}</b> <i>${esc(text)}</i></span>`).join('')}<span class="cl-opt"><i>${esc(cost)}</i></span></small>`;
const button = (kind, id, choice, label, tone = 'ghost-button') => `<button type="button" class="${tone}" data-cabinet-kind="${esc(kind)}" data-cabinet-id="${esc(id)}" data-cabinet-choice="${esc(choice)}">${esc(label)}</button>`;

export function renderCabinetLife(state) {
  const view = cabinetView(state.parliament, { week: state.game?.week?.index ?? 0 });
  if (!view) return '';
  const premier = state.parliament?.government?.primeMinister === 'player';
  // One card for each minister: a simulated figure (stable from its id), the department, the group, the five dials that decide what he does, how the evaluations went and what the situation says.
  const sparkline = evaluations => {
    const scores = (evaluations ?? []).map(item => Number(item.score)).filter(Number.isFinite).slice(-6);
    if (scores.length < 2) return '<small class="cl-trend">Valutazioni: ancora una sola, nessun andamento.</small>';
    const points = scores.map((value, index) => `${(index / (scores.length - 1) * 100).toFixed(1)},${(30 - value / 100 * 28).toFixed(1)}`).join(' ');
    const trend = scores.at(-1) - scores[0];
    return `<div class="cl-trend"><svg viewBox="0 0 100 32" role="img" aria-label="${esc(`Andamento delle valutazioni: da ${Math.round(scores[0])} a ${Math.round(scores.at(-1))} su 100`)}"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg><small>Andamento: ${trend > 3 ? 'in miglioramento' : trend < -3 ? 'in calo' : 'stabile'} · ultima valutazione ${Math.round(scores.at(-1))}/100</small></div>`;
  };
  const situationOf = item => {
    const lines = [];
    if ((item.loyalty ?? 50) < 35) lines.push('La lealtà è bassa: può contestare la linea del governo o dimettersi sbattendo la porta.');
    if ((item.ambition ?? 50) >= 70) lines.push('È ambizioso: può chiedere più peso nel governo.');
    if (item.grade === 'insufficiente') lines.push('Valutazione insufficiente: alleati e stampa possono chiederne la sostituzione.');
    if ((item.pressure ?? 0) >= 3) lines.push('Sotto forte pressione politica: ogni errore pesa di più.');
    if ((item.bond ?? 50) >= 70) lines.push('Ha un buon rapporto con il Presidente del Consiglio.');
    return lines.length ? lines : ['Nessun problema particolare: lavora nel suo settore.'];
  };
  const rows = view.ministers.map(item => `<li class="cl-minister${item.playerAppointed ? ' is-player' : ''}" data-minister="${esc(item.id)}">
    <div class="cl-head"><span class="cl-avatar">${avatarSvg(defaultAvatarFor(item.id), { size: 52, label: '' })}</span><div class="cl-id"><strong>Ministro · ${esc(item.portfolio)}</strong><small>${esc(item.groupName ?? 'Senza gruppo')}${item.playerAppointed ? ' · nominato da te' : ' · figura simulata'}</small></div>${gradeChip(item.grade)}</div>
    <dl class="cl-traits"><div><dt>Competenza</dt><dd>${meter(item.competence ?? 50)}</dd></div><div><dt>Lealtà</dt><dd>${meter(item.loyalty ?? 50, (item.loyalty ?? 50) < 35 ? 'bad' : '')}</dd></div>
    <div><dt>Rapporto con il Presidente del Consiglio</dt><dd>${meter(item.bond)}</dd></div><div><dt>Ambizione</dt><dd>${meter(item.ambition, 'warm')}</dd></div><div><dt>Pressione politica</dt><dd>${meter(Math.min(100, (item.pressure ?? 0) * 20), (item.pressure ?? 0) >= 3 ? 'bad' : '')}</dd></div></dl>
    ${sparkline(item.evaluations)}<ul class="cl-situation">${situationOf(item).map(line => `<li>${esc(line)}</li>`).join('')}</ul></li>`).join('');
  const requests = view.requests.map(item => `<li><span>${glyph('users', 14)} ${item.type === 'ambizione' ? `Il ministro ${esc(item.minister.portfolio)} chiede più peso nel governo.` : `${esc(item.by.charAt(0).toUpperCase() + item.by.slice(1))} chiedono di sostituire il ministro ${esc(item.minister.portfolio)}.`}</span>
    ${premier ? `<span class="cl-actions">${button('request', item.id, 'accogli', item.type === 'ambizione' ? 'Accogli' : 'Sostituisci', 'primary-button')}${button('request', item.id, 'rifiuta', item.type === 'ambizione' ? 'Respingi' : 'Conferma il ministro')}</span>${item.type === 'ambizione' ? explain([['Accogli', 'più peso nel governo, qualche invidia nella squadra.'], ['Respingi', 'la lealtà del ministro cala.']]) : explain([['Sostituisci', 'arriva un nuovo ministro dello stesso gruppo, con il rapporto da ricostruire.'], ['Conferma il ministro', 'chi ne chiedeva la sostituzione resta insoddisfatto.']])}` : ''}</li>`).join('');
  const conflicts = view.conflicts.map(item => `<li><span>${glyph('alert', 14)} Scontro fra i ministri di ${esc(item.ministerA?.portfolio ?? '—')} e di ${esc(item.ministerB?.portfolio ?? '—')} su ${esc(item.issue.toLowerCase())}.</span>
    ${premier ? `<span class="cl-actions">${button('conflict', item.id, 'media', 'Media', 'primary-button')}${button('conflict', item.id, 'sostieni-a', `Sostieni ${item.ministerA?.portfolio ?? ''}`)}${button('conflict', item.id, 'sostieni-b', `Sostieni ${item.ministerB?.portfolio ?? ''}`)}</span>${explain([['Media', 'ricomponi lo scontro: nessuno vince.'], ['Sostieni', 'il dicastero scelto ne esce rafforzato, l’altro perde lealtà.'], ['Se non intervieni', 'la stabilità del governo ne risente.']])}` : ''}</li>`).join('');
  const meeting = view.meeting ? `<li><span>${glyph('ministry', 14)} Consiglio dei ministri: si discute di ${esc(view.meeting.topic.toLowerCase())}.</span>
    ${premier ? `<span class="cl-actions">${button('meeting', view.meeting.id, 'approvare', 'Approva', 'primary-button')}${button('meeting', view.meeting.id, 'rinviare', 'Rinvia')}${button('meeting', view.meeting.id, 'respingere', 'Respingi')}</span>${explain([['Approva', 'la proposta passa, se il governo è unito.'], ['Rinvia', 'se ne riparla più avanti, senza costi di reputazione.'], ['Respingi', 'il ministro proponente perde lealtà.']])}` : '<small>Decide il Presidente del Consiglio.</small>'}</li>` : '';
  const waiting = requests + conflicts + meeting;
  const recent = view.recent.map(item => `<li>${esc(item.topic)}: ${item.choice === 'approvare' ? 'approvato' : item.choice === 'rinviare' ? 'rinviato' : 'respinto'}</li>`).join('');
  return `<details class="pm-block pm-fold cabinet-life" data-remember="gov-team"${view.requests.length + view.conflicts.length + (view.meeting ? 1 : 0) ? ' open' : ''}><summary><span class="pm-fold-title">${glyph('users', 16)} <strong>La squadra di governo</strong></span><small>${view.ministers.length} ministri${view.requests.length + view.conflicts.length + (view.meeting ? 1 : 0) ? ` · ${view.requests.length + view.conflicts.length + (view.meeting ? 1 : 0)} da seguire` : ''}</small></summary>
    <div class="cl-body">
      ${waiting ? `<ul class="cl-waiting">${waiting}</ul>` : '<p class="parliament-note">Nessuna richiesta, scontro o Consiglio in sospeso.</p>'}
      ${recent ? `<details class="cl-recent"><summary>Ultime decisioni del Consiglio</summary><ul>${recent}</ul></details>` : ''}
      <ul class="cl-list">${rows}</ul>
      <p class="parliament-note">Ogni tre mesi circa i ministri vengono valutati. Un buon ministro rende più efficaci le misure del suo settore; uno insufficiente le indebolisce. Le ambizioni, gli scontri e le dimissioni polemiche pesano sulla stabilità e sugli alleati.</p>
    </div></details>`;
}
