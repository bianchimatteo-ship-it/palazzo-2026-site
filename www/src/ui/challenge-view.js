// Special challenges (challenge-engine.js): the one open, the ones that can be taken and the verdicts. Every button calls the store (startChallenge, abandonChallenge): nothing is decorative.
import { badge, bar, card, esc } from './sections-kit.js?v=20261111-3';

function rewardText(spec) {
  const parts = [];
  if (spec.reward?.capital) parts.push(`${spec.reward.capital} capitale politico`);
  for (const [metric, value] of Object.entries(spec.reward?.stats ?? {})) parts.push(`${{ reputation: 'reputazione', popularity: 'popolarità', influence: 'influenza' }[metric] ?? metric} +${String(value).replace('.', ',')}`);
  if (spec.reward?.support) parts.push(`sostegno nel partito +${spec.reward.support}`);
  return parts.join(' · ');
}
const rowList = rows => `<ul class="ch-rows">${rows.map(row => `<li class="${row.met ? 'is-met' : ''}"><span>${esc(row.label)}</span><b>${esc(String(row.value))} / ${esc(String(row.target))}</b>${bar(Math.round(100 * row.ratio), row.met ? 'good' : '')}</li>`).join('')}</ul>`;

function openCard(open) {
  const spec = open.spec;
  const limits = open.rows.limits.length ? `<ul class="ch-limits">${open.rows.limits.map(row => `<li class="${row.broken ? 'is-broken' : ''}">${row.broken ? '✕' : '✓'} ${esc(row.label)}</li>`).join('')}</ul>` : '';
  return card({ kicker: 'SFIDA IN CORSO', title: spec.label, tone: 'info', body: `<article class="ch-open" data-challenge-open="${esc(open.id)}">
    <p>${esc(spec.summary)}</p><div class="program-meta"><span>Scadenza tra ${open.weeksLeft} ${open.weeksLeft === 1 ? 'settimana' : 'settimane'}</span><span>Avanzamento ${open.rows.progress}%</span></div>
    ${bar(open.rows.progress, 'good')}${rowList(open.rows.goals)}${limits}
    <p class="sx-note"><b>Premio</b> ${esc(rewardText(spec))}</p>
    <div class="program-actions"><button type="button" class="ghost-button" data-challenge-abandon>Abbandona la sfida</button></div></article>` });
}
function lastCard(last) {
  const ok = last.status === 'riuscita';
  return card({ kicker: 'ULTIMO ESITO', title: last.label, tone: ok ? 'good' : 'warning', body: `<p>${badge(ok ? 'Superata' : last.status === 'abbandonata' ? 'Abbandonata' : 'Fallita', ok ? 'good' : 'bad')} ${esc(last.reason ?? '')}</p><ul class="program-notes">${(last.history ?? []).slice(-3).map(item => `<li>${esc(item.text)}</li>`).join('')}</ul>` });
}
export function renderChallenges(view) {
  if (!view) return '';
  const busy = Boolean(view.open);
  const list = view.available.map(spec => {
    const verdict = spec.done?.status === 'riuscita' ? badge('Superata', 'good') : spec.done ? badge('Tentata', 'warning') : '';
    const blocked = spec.problem && !(busy && spec.problem.startsWith('Hai già'));
    const button = spec.done?.status === 'riuscita' ? '' : `<button type="button" class="primary-button" data-challenge-start="${esc(spec.id)}"${spec.problem ? ' disabled' : ''}>Accetta la sfida</button>`;
    return `<article class="ch-item" data-challenge="${esc(spec.id)}"><header><div><strong>${esc(spec.label)}</strong><small>${esc(spec.kicker)} · ${spec.weeks} settimane</small></div>${verdict}</header>
      <p>${esc(spec.summary)}</p><p class="sx-note">${esc(spec.setup.text)}</p>
      <ul class="ch-rows">${spec.goals.map(goal => `<li><span>${esc(goal.label)}</span><b>${esc(String(goal.target))}</b></li>`).join('')}</ul>
      <p class="sx-note"><b>Premio</b> ${esc(rewardText(spec))}</p>
      ${blocked ? `<p class="sx-note">${esc(spec.problem)}</p>` : ''}${button}</article>`;
  }).join('');
  return `<div class="challenges-view">${view.open ? openCard(view.open) : ''}${view.last && !view.open ? lastCard(view.last) : ''}${card({ kicker: 'SFIDE SPECIALI', title: 'Prove con un inizio, una fine e un verdetto', body: `<div class="ch-list">${list}</div><p class="sx-note">Una sfida alla volta. Si confronta con il giorno in cui l’accetti: se raggiungi gli obiettivi prima della scadenza vinci il premio, se superi un limite o scade il tempo la paghi. Le tue scelte di tutti i giorni fanno il resto.</p>` })}</div>`;
}
