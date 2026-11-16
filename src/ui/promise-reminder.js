// The reminder of the promises, as a card of the game's own style (the same quiet sheet as the invitation to review): the open promises that need attention with why (a deadline coming, late, not
// started), «Apri il programma» and «Più tardi». It never blocks the game and hides in a moment that is not quiet (a scene, a vote, the night, a dialog).
import { translateTree } from '../core/i18n.js?v=20261116-18';

const esc = text => String(text ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const KIND = { scadenza: 'Scadenza vicina', ritardo: 'In ritardo', avvio: 'Non ancora avviata' };
export function reminderCardHtml(items) {
  const rows = items.map(item => `<li data-reminder-item="${esc(item.promiseId)}" data-reminder-kind="${esc(item.kind)}"><strong>${esc(item.label)}</strong> <span class="badge ${item.kind === 'ritardo' ? 'badge-bad' : ''}">${esc(KIND[item.kind] ?? item.kind)}</span><small>${esc(item.intervention)} · ${esc(item.text)}${item.progress ? ` · avanzamento ${Math.round(item.progress)}%` : ''}</small></li>`).join('');
  return `<aside class="review-card promise-reminder" data-promise-reminder role="dialog" aria-modal="false" aria-labelledby="reminder-title">
    <div class="review-copy"><span class="review-kicker">LE TUE PROMESSE</span><h2 id="reminder-title">Ricordati cosa hai promesso</h2><ul class="reminder-list">${rows}</ul></div>
    <div class="review-actions"><button type="button" class="review-primary" data-reminder-open>Apri il programma</button><button type="button" class="review-later" data-reminder-later>Più tardi</button></div></aside>`;
}
export function mountReminderCard({ items, onAnswer, parent = document.body }) {
  const holder = document.createElement('div');
  holder.innerHTML = reminderCardHtml(items);
  const card = holder.firstElementChild;
  let answered = false;
  const answer = value => { if (answered) return; answered = true; document.removeEventListener('keydown', onKey); card.classList.add('is-leaving'); setTimeout(() => card.remove(), 220); onAnswer?.(value); };
  const onKey = event => { if (event.key === 'Escape' && !card.hidden) answer('later'); };
  card.querySelector('[data-reminder-open]').addEventListener('click', () => answer('open'));
  card.querySelector('[data-reminder-later]').addEventListener('click', () => answer('later'));
  document.addEventListener('keydown', onKey);
  parent.appendChild(card);
  translateTree(card);
  requestAnimationFrame(() => card.classList.add('is-in'));
  return { card, setQuiet(quiet) { card.hidden = !quiet; }, close: () => answer('later') };
}
