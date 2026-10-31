// «Ricompense»: the daily reward, the time played, the rewarded videos and what was received. It shows only what the player is meant to know: nothing about how long the effect of a video lasts or where it
// comes from (that is not told anywhere in the game).
import { DAILY_REWARD, PLAY_REWARDS } from '../data/simulation/reward-rules.js?v=20261031-1';
import { glyph } from './visuals.js?v=20261031-1';
import { esc, euro } from './charts.js?v=20261031-1';

const clockText = ms => { const total = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };
const durationText = ms => { const minutes = Math.floor(Math.max(0, ms) / 60000); const hours = Math.floor(minutes / 60); return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`; };
const whenText = at => { const date = new Date(at); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(date) : '—'; };
const DAILY_STATE = {
  counting: ['In corso', 'warn'], claimed: ['Riscossa oggi', 'good'], pending: ['In attesa di conferma', 'warn'], owed: ['In attesa di accredito', 'warn'], 'claimed-elsewhere': ['Già riscossa oggi da questo account', 'good']
};
const KIND_LABEL = { giornaliera: 'Ricompensa giornaliera', capitale: 'Tempo di gioco · 30 minuti', preparazione: 'Tempo di gioco · 60 minuti', video: 'Video premiato' };
const amountText = entry => entry.kind === 'giornaliera' ? `+${euro(entry.amount)}` : entry.kind === 'video' ? '+0,15 punti' : entry.amount ? `+${entry.amount}` : '0 (già al massimo)';
const bar = (fraction, key, label) => `<div class="reward-bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(fraction * 100)}" data-reward-bar="${key}"><i style="width:${Math.max(0, Math.min(100, fraction * 100)).toFixed(1)}%"></i></div>`;

// snapshot: what the rewards service gives (see rewards-service.js).
export function renderRewardsPage(state, snapshot = null) {
  const game = state.game;
  if (!game || !snapshot) return '<p class="quiet-copy">Le ricompense si attivano con la carriera.</p>';
  const { daily, play, history, ads } = snapshot;
  const [dailyLabel, dailyTone] = DAILY_STATE[daily.state] ?? DAILY_STATE.counting;
  const taken = daily.state === 'claimed' || daily.state === 'claimed-elsewhere';
  const dailyFraction = taken ? 1 : daily.ms / (daily.minutes * 60000);
  const panel = (kicker, title, body) => `<section class="hq-panel reward-panel"><div class="home-section-heading"><div><span class="section-kicker">${kicker}</span><h2>${title}</h2></div></div>${body}</section>`;
  const block = (spec, progress, key, name) => `<div class="reward-row" data-reward-row="${key}"><div><strong>${name}</strong><small>Ogni ${spec.everyMinutes} minuti di gioco: +${spec.amount} ${esc(spec.resource.toLowerCase())}</small></div>${bar(progress.fraction, key, name)}<span class="reward-meta"><b data-reward-text="${key}">${progress.minutes} di ${spec.everyMinutes} minuti</b><small>${progress.blocks} ${progress.blocks === 1 ? 'premio ottenuto' : 'premi ottenuti'}</small></span></div>`;
  const rows = history.length ? `<div class="reward-history" role="table" aria-label="Storico delle ricompense"><div class="reward-history-head" role="row"><span role="columnheader">Data e ora</span><span role="columnheader">Ricompensa</span><span role="columnheader">Ricevuto</span><span role="columnheader">Risorsa</span></div>${history.map(entry => `<div class="reward-history-row" role="row"><time role="cell" datetime="${esc(entry.at)}">${esc(whenText(entry.at))}</time><span role="cell">${esc(KIND_LABEL[entry.kind] ?? 'Ricompensa')}</span><b role="cell">${esc(amountText(entry))}</b><span role="cell">${esc(entry.resource ?? '')}</span></div>`).join('')}</div>` : '<p class="quiet-copy">Nessuna ricompensa ancora: gioca qualche minuto per ottenere la prima.</p>';
  return `<div class="rewards-page" data-rewards-page>
    <section class="finance-hero reward-hero"><div>${glyph('trophy', 28)}<div><span class="section-kicker">RICOMPENSE · SIMULAZIONE</span><h2>Giocare ti premia</h2><p class="section-subtitle">Un premio al giorno, uno ogni mezz’ora e uno ogni ora di gioco, e i video premiati. Il tempo conta solo quando giochi davvero: la partita aperta, la pagina in primo piano.</p></div></div></section>
    ${panel('OGNI GIORNO', 'Ricompensa giornaliera', `<div class="reward-daily" data-reward-daily="${esc(daily.state)}"><div class="reward-amount"><strong>+${euro(DAILY_REWARD.amount)}</strong><small>ai tuoi fondi personali (non alla tesoreria del partito)</small></div><div class="reward-state"><span class="badge badge-${dailyTone}" data-reward-state>${esc(dailyLabel)}</span>${bar(dailyFraction, 'daily', 'Avanzamento della ricompensa giornaliera')}<span class="reward-meta"><b data-reward-text="daily">${taken ? 'Già riscossa nella giornata' : `${clockText(daily.ms)} di ${daily.minutes}:00`}</b><small>${daily.guest ? 'Senza accesso vale per questo dispositivo.' : 'Una sola volta al giorno per account, su qualunque carriera e dispositivo.'} Il giorno cambia a mezzanotte, ora di Roma.</small></span></div></div>`)}
    ${panel('LA TUA CARRIERA', 'Tempo di gioco', `<p class="reward-total"><strong data-reward-text="total">${esc(durationText(play.totalMs))}</strong> <span>di gioco in questa carriera</span></p>${block(PLAY_REWARDS.capital, play.capital, 'capital', 'Prossimo capitale politico')}${block(PLAY_REWARDS.preparation, play.preparation, 'preparation', 'Prossima preparazione elettorale')}<p class="quiet-copy">Il tempo si somma tra una sessione e l’altra e non si perde. Capitale e preparazione non superano mai 100: se sei già al massimo il premio si ferma lì e lo storico lo dice.</p>`)}
    ${panel('VIDEO PREMIATI', 'Ricompense pubblicitarie', `<p>Guarda un video fino alla fine: il tuo partito guadagna <strong>+0,15 punti</strong> nei sondaggi nazionali. I vantaggi di più video si sommano.</p><button type="button" class="primary-button" data-reward-video ${ads.available ? '' : 'disabled aria-disabled="true"'}>Guarda il video</button>${ads.available ? '' : `<p class="quiet-copy" data-reward-video-note>${esc(ads.reason ?? 'Non disponibile.')}</p>`}`)}
    ${panel('STORICO', 'Che cosa hai ricevuto', rows)}
  </div>`;
}

// The live bars of an open page: only the numbers that move every second are patched (the page is not drawn again).
export function patchRewardsPage(root, snapshot) {
  const page = root?.querySelector?.('[data-rewards-page]');
  if (!page || !snapshot) return false;
  const set = (key, fraction, text) => {
    const barEl = page.querySelector(`[data-reward-bar="${key}"]`); if (barEl) { barEl.firstElementChild.style.width = `${Math.max(0, Math.min(100, fraction * 100)).toFixed(1)}%`; barEl.setAttribute('aria-valuenow', String(Math.round(fraction * 100))); }
    const textEl = page.querySelector(`[data-reward-text="${key}"]`); if (textEl && text) textEl.textContent = text;
  };
  const { daily, play } = snapshot;
  const taken = daily.state === 'claimed' || daily.state === 'claimed-elsewhere';
  set('daily', taken ? 1 : daily.ms / (daily.minutes * 60000), taken ? 'Già riscossa nella giornata' : `${clockText(daily.ms)} di ${daily.minutes}:00`);
  set('capital', play.capital.fraction, `${play.capital.minutes} di ${play.capital.everyMinutes} minuti`);
  set('preparation', play.preparation.fraction, `${play.preparation.minutes} di ${play.preparation.everyMinutes} minuti`);
  const total = page.querySelector('[data-reward-text="total"]'); if (total) total.textContent = durationText(play.totalMs);
  const stateEl = page.querySelector('[data-reward-state]'); if (stateEl) stateEl.textContent = (DAILY_STATE[daily.state] ?? DAILY_STATE.counting)[0];
  return true;
}
