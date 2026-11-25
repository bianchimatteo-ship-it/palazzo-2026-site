// The invitation to review the game on Google Play, as a card of the game's own style (not the generic confirmation dialog): a quiet sheet at the bottom of the screen (above the tab bar on a phone, centred on a
// tablet) that never dims or blocks the game, with the shield mark of Politicando, a short text, a gold button that opens the Play Store page and a plain «Non ora». It is shown only in a quiet moment (the caller
// hides it while a scene, a vote, the night or a dialog is on, and brings it back after) and answers to Escape. The rules (once for each installation, enough use, recorded as shown first) are in data/repositories/review-prompt.js.
import { translateTree } from '../core/i18n.js?v=20261125-11';

const esc = text => String(text).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const MARK = '<svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><defs><linearGradient id="rv-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0cf8d"/><stop offset="1" stop-color="#b8893a"/></linearGradient></defs><path d="M14 10h36v26c0 9-7 15-18 18-11-3-18-9-18-18z" fill="#142019" stroke="url(#rv-g)" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 19l3.6 7.4 8.1 1.1-5.9 5.7 1.4 8-7.2-3.9-7.2 3.9 1.4-8-5.9-5.7 8.1-1.1z" fill="url(#rv-g)"/></svg>';

export function reviewCardHtml(url, platform = 'android') {
  const store = platform === 'ios' ? 'sull’App Store' : 'su Google Play';
  return `<aside class="review-card" data-review-card role="dialog" aria-modal="false" aria-labelledby="review-title" aria-describedby="review-body">
    <div class="review-mark">${MARK}</div>
    <div class="review-copy">
      <span class="review-kicker">IL TUO PARERE</span>
      <h2 id="review-title">Ti sta piacendo Politicando 2026?</h2>
      <p id="review-body">Il tuo parere è importante! Lascia una recensione sincera ${store} e aiutaci a migliorare il gioco.</p>
      <p class="review-fine">Nessun obbligo e nessun premio: scrivi quello che pensi davvero.</p>
    </div>
    <div class="review-actions">
      <a class="review-primary" data-review-open href="${esc(url)}" target="_blank" rel="noopener noreferrer">Lascia una recensione</a>
      <button type="button" class="review-later" data-review-later>Non ora</button>
    </div>
  </aside>`;
}

// Mounts the card on the page (outside the game's root, so a redraw of the game never removes it). `onAnswer('review' | 'later')` is called once. Returns { setQuiet(boolean), close() }.
export function mountReviewCard({ url, platform = 'android', onAnswer, parent = document.body }) {
  const holder = document.createElement('div');
  holder.innerHTML = reviewCardHtml(url, platform);
  const card = holder.firstElementChild;
  let answered = false;
  const answer = value => { if (answered) return; answered = true; document.removeEventListener('keydown', onKey); card.classList.add('is-leaving'); setTimeout(() => card.remove(), 220); onAnswer?.(value); };
  const onKey = event => { if (event.key === 'Escape' && !card.hidden) answer('later'); };
  card.querySelector('[data-review-open]').addEventListener('click', () => answer('review'));   // (the link itself opens the store page)
  card.querySelector('[data-review-later]').addEventListener('click', () => answer('later'));
  document.addEventListener('keydown', onKey);
  parent.appendChild(card);
  translateTree(card);
  requestAnimationFrame(() => card.classList.add('is-in'));
  return { card, setQuiet(quiet) { card.hidden = !quiet; }, close: () => answer('later') };
}
