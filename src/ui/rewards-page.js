// «Ricompense»: the daily reward, the time played, the rewarded videos and what was received. It shows only what the player is meant to know: nothing about how long the effect of a video lasts or where it
// comes from (that is not told anywhere in the game).
import { DAILY_REWARD, PLAY_REWARDS } from '../data/simulation/reward-rules.js?v=20261031-3';
import { glyph } from './visuals.js?v=20261031-3';
import { esc } from './charts.js?v=20261031-3';
// euros with the thousands point also for four digits (toLocaleString('it-IT') writes 1500): the amounts here are 500 and 1.500
const euro = value => `${String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;

const clockText = ms => { const total = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };
const durationText = ms => { const minutes = Math.floor(Math.max(0, ms) / 60000); const hours = Math.floor(minutes / 60); return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`; };
const whenText = at => { const date = new Date(at); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(date) : '—'; };
const DAILY_STATE = {
  counting: ['In corso', 'warn'], claimed: ['Riscossa oggi', 'good'], pending: ['In attesa di conferma', 'warn'], owed: ['In attesa di accredito', 'warn'], 'claimed-elsewhere': ['Già riscossa oggi da questo account', 'good']
};
const COMMUNITY_STATE = {
  idle: ['Da riscuotere', 'warn'], visited: ['Pronta da riscuotere', 'warn'], claiming: ['In attesa di conferma', 'warn'], pending: ['In attesa di conferma', 'warn'], owed: ['In attesa di accredito', 'warn'], claimed: ['Riscossa', 'good'], 'claimed-elsewhere': ['Già riscossa da questo account', 'good']
};
const KIND_LABEL = { giornaliera: 'Ricompensa giornaliera', capitale: 'Tempo di gioco · 30 minuti', preparazione: 'Tempo di gioco · 60 minuti', video: 'Video premiato', community: 'Community Instagram' };
const KIND_TONE = { giornaliera: 'gold', capitale: 'blue', preparazione: 'blue', video: 'violet', community: 'rose' };
const isFunds = entry => entry.resource === 'Fondi personali';
const amountText = entry => entry.kind === 'video' ? '+0,15 punti' : entry.amount ? `+${isFunds(entry) ? euro(entry.amount) : entry.amount}` : '0 (già al massimo)';
const bar = (fraction, key, label) => `<div class="reward-bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(fraction * 100)}" data-reward-bar="${key}"><i style="width:${Math.max(0, Math.min(100, fraction * 100)).toFixed(1)}%"></i></div>`;

// The notice shown after a credit (the popup of the rewards): what was really received and why. Several notices wait in a queue and are shown one after the other, each dismissed by the player.
// A credit of zero (the resource was already at its limit) never announces a gain.
export function noticeParts(notice) {
  const gained = Number(notice.amount) > 0, funds = isFunds(notice);
  const title = gained ? (funds ? `+${euro(notice.amount)}` : `+${notice.amount} ${notice.resource}`) : `${notice.resource} già al massimo`;
  let reason;
  if (notice.kind === 'giornaliera') reason = 'Hai giocato almeno 5 minuti oggi';
  else if (notice.kind === 'community') reason = gained ? 'Grazie per far parte della community' : 'Il limite è 100: nessun punto aggiunto';
  else reason = gained ? `Hai raggiunto ${notice.minutes} minuti di gioco` : `Hai raggiunto ${notice.minutes} minuti di gioco: nessun punto aggiunto, il limite è 100`;
  return { title, reason, gained, resource: notice.resource };
}
export function renderRewardNotice(notice, total = 1) {
  if (!notice) return '';
  const { title, reason, gained, resource } = noticeParts(notice);
  const tone = KIND_TONE[notice.kind] ?? 'gold';
  return `<div class="reward-overlay" data-reward-overlay><aside class="reward-popup is-${tone} ${gained ? '' : 'is-flat'}" role="dialog" aria-modal="true" aria-labelledby="reward-popup-title" aria-describedby="reward-popup-reason" data-reward-notice="${esc(notice.id)}" data-reward-kind="${esc(notice.kind)}" data-reward-gained="${gained ? 'yes' : 'no'}">
    <div class="reward-popup-mark" aria-hidden="true">${glyph('trophy', 30)}</div>
    <span class="section-kicker">${gained ? 'RICOMPENSA RICEVUTA' : 'RICOMPENSA'}</span>
    <strong class="reward-popup-amount" id="reward-popup-title" data-reward-title>${esc(title)}</strong>
    <p class="reward-popup-reason" id="reward-popup-reason" data-reward-reason>${esc(reason)}</p>
    ${isFunds(notice) ? `<small class="reward-popup-resource">${esc(resource)}</small>` : ''}
    ${total > 1 ? `<small class="reward-popup-count" data-reward-count>${esc(`Premio 1 di ${total}`)}</small>` : ''}
    <button type="button" class="primary-button" data-reward-notice-dismiss autofocus>Continua</button>
  </aside></div>`;
}

// snapshot: what the rewards service gives (see rewards-service.js).
export function renderRewardsPage(state, snapshot = null) {
  const game = state.game;
  if (!game || !snapshot) return '<p class="quiet-copy">Le ricompense si attivano con la carriera.</p>';
  const { daily, play, history, ads, community, lost } = snapshot;
  const [dailyLabel, dailyTone] = DAILY_STATE[daily.state] ?? DAILY_STATE.counting;
  const taken = daily.state === 'claimed' || daily.state === 'claimed-elsewhere';
  const dailyFraction = taken ? 1 : daily.ms / (daily.minutes * 60000);
  const card = (tone, kicker, title, body, extra = '') => `<section class="reward-card is-${tone}" ${extra}><header class="reward-card-head"><span class="section-kicker">${kicker}</span><h2>${title}</h2></header>${body}</section>`;
  const block = (spec, progress, key, name) => `<div class="reward-row" data-reward-row="${key}"><div class="reward-row-name"><strong>${name}</strong><small>Ogni ${spec.everyMinutes} minuti di gioco: +${spec.amount} ${esc(spec.resource.toLowerCase())}</small></div>${bar(progress.fraction, key, name)}<span class="reward-meta"><b data-reward-text="${key}">${progress.minutes} di ${spec.everyMinutes} minuti</b><small>${progress.blocks} ${progress.blocks === 1 ? 'premio ottenuto' : 'premi ottenuti'}</small></span></div>`;
  const rows = history.length ? `<div class="reward-history" role="table" aria-label="Storico delle ricompense"><div class="reward-history-head" role="row"><span role="columnheader">Data e ora</span><span role="columnheader">Ricompensa</span><span role="columnheader">Ricevuto</span><span role="columnheader">Risorsa</span></div>${history.map(entry => `<div class="reward-history-row is-${KIND_TONE[entry.kind] ?? 'gold'} ${entry.amount ? '' : 'is-zero'}" role="row"><time role="cell" datetime="${esc(entry.at)}">${esc(whenText(entry.at))}</time><span role="cell" class="reward-history-kind">${esc(KIND_LABEL[entry.kind] ?? 'Ricompensa')}</span><b role="cell">${esc(amountText(entry))}</b><span role="cell">${esc(entry.resource ?? '')}</span></div>`).join('')}</div>` : '<p class="quiet-copy">Nessuna ricompensa ancora: gioca qualche minuto per ottenere la prima.</p>';
  const ig = community?.instagram;
  const [igLabel, igTone] = COMMUNITY_STATE[ig?.state] ?? COMMUNITY_STATE.idle;
  const igDone = ig?.state === 'claimed' || ig?.state === 'claimed-elsewhere';
  const igBusy = ['claiming', 'pending', 'owed'].includes(ig?.state);
  const instagram = ig ? card('rose', 'COMMUNITY', 'Community Instagram', `
      <p>Segui il profilo ufficiale del gioco e ricevi una volta sola:</p><ul class="reward-perks"><li><strong>+${euro(ig.funds)}</strong> <span>ai fondi personali</span></li><li><strong>+${ig.capital}</strong> <span>capitale politico</span></li></ul>
      <div class="reward-state"><span class="badge badge-${ig.enabled ? igTone : 'warn'}" data-community-label>${ig.enabled ? esc(igLabel) : 'Non disponibile'}</span><small>${ig.guest ? 'Senza accesso vale una volta per questo dispositivo.' : 'Una volta sola per account, su qualunque carriera e dispositivo.'}</small></div>
      ${ig.enabled && !igDone ? `<div class="reward-actions"><a class="secondary-button" href="${esc(ig.url)}" target="_blank" rel="noopener noreferrer" data-community-follow>Segui su Instagram</a><button type="button" class="primary-button" data-community-claim ${ig.state === 'visited' && snapshot.playing && !igBusy ? '' : 'disabled aria-disabled="true"'}>Ho seguito, riscuoti</button></div>
      <p class="quiet-copy" data-community-note>${ig.state === 'idle' ? 'Apri il profilo, poi torna qui e riscuoti.' : igBusy ? 'La richiesta è in attesa: si completa da sola appena possibile.' : snapshot.playing ? 'È una tua dichiarazione: non controlliamo il tuo account Instagram e non ti chiediamo credenziali.' : 'Servono una carriera aperta e la partita in primo piano.'}</p>` : ''}
      ${ig.enabled ? '' : '<p class="quiet-copy" data-community-note>Questa ricompensa non è al momento disponibile.</p>'}`, `data-reward-community="instagram" data-community-state="${esc(ig.state)}" data-community-enabled="${ig.enabled ? 'yes' : 'no'}"`) : '';
  return `<div class="rewards-page" data-rewards-page>
    <section class="reward-hero"><div class="reward-hero-mark">${glyph('trophy', 34)}</div><div class="reward-hero-copy"><span class="section-kicker">RICOMPENSE · SIMULAZIONE</span><h2>Giocare ti premia</h2><p class="section-subtitle">Un premio al giorno, uno ogni mezz’ora e uno ogni ora di gioco, e i video premiati. Il tempo conta solo quando giochi davvero: la partita aperta, la pagina in primo piano.</p></div>
      <dl class="reward-hero-stats"><div><dt>Tempo di gioco</dt><dd data-reward-text="total">${esc(durationText(play.totalMs))}</dd></div><div><dt>Premi ottenuti</dt><dd>${history.filter(entry => entry.amount > 0).length}</dd></div></dl></section>
    <div class="reward-grid">
      ${card('gold', 'OGNI GIORNO', 'Ricompensa giornaliera', `<div class="reward-daily" data-reward-daily="${esc(daily.state)}"><div class="reward-amount"><strong>+${euro(DAILY_REWARD.amount)}</strong><small>ai tuoi fondi personali (non alla tesoreria del partito)</small></div><div class="reward-state"><span class="badge badge-${dailyTone}" data-reward-state>${esc(dailyLabel)}</span>${bar(dailyFraction, 'daily', 'Avanzamento della ricompensa giornaliera')}<span class="reward-meta"><b data-reward-text="daily">${taken ? 'Già riscossa nella giornata' : `${clockText(daily.ms)} di ${daily.minutes}:00`}</b><small>${daily.guest ? 'Senza accesso vale per questo dispositivo.' : 'Una sola volta al giorno per account, su qualunque carriera e dispositivo.'} Il giorno cambia a mezzanotte, ora di Roma.</small></span></div></div>`)}
      ${card('blue', 'LA TUA CARRIERA', 'Tempo di gioco', `${block(PLAY_REWARDS.capital, play.capital, 'capital', 'Prossimo capitale politico')}${block(PLAY_REWARDS.preparation, play.preparation, 'preparation', 'Prossima preparazione elettorale')}<p class="quiet-copy">Il tempo si somma tra una sessione e l’altra e non si perde. Capitale e preparazione non superano mai 100: se sei già al massimo il premio si ferma lì e lo storico lo dice.</p>${lost?.ms > 0 ? `<p class="quiet-copy" data-reward-lost>${esc(durationText(lost.ms))} di gioco non è stato possibile registrare sul tuo account: il premio locale resta.</p>` : ''}`)}
      ${instagram}
      ${card('violet', 'VIDEO PREMIATI', 'Ricompense pubblicitarie', `<p>Guarda un video fino alla fine: il tuo partito guadagna +0,15 punti nei sondaggi nazionali. I vantaggi di più video si sommano.</p><button type="button" class="primary-button" data-reward-video ${ads.available ? '' : 'disabled aria-disabled="true"'}>Guarda il video</button>${ads.available ? '' : `<p class="quiet-copy" data-reward-video-note>${esc(ads.reason ?? 'Nessun video disponibile in questo momento.')}</p>`}`)}
    </div>
    <section class="reward-card is-neutral reward-history-card"><header class="reward-card-head"><span class="section-kicker">STORICO</span><h2>Che cosa hai ricevuto</h2></header>${rows}</section>
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
  const card = page.querySelector('[data-reward-community]');
  if (card && snapshot.community?.instagram && (card.dataset.communityState !== snapshot.community.instagram.state || card.dataset.communityEnabled !== (snapshot.community.instagram.enabled ? 'yes' : 'no'))) return false;   // the card changes: the page is drawn again
  const { daily, play } = snapshot;
  const taken = daily.state === 'claimed' || daily.state === 'claimed-elsewhere';
  set('daily', taken ? 1 : daily.ms / (daily.minutes * 60000), taken ? 'Già riscossa nella giornata' : `${clockText(daily.ms)} di ${daily.minutes}:00`);
  set('capital', play.capital.fraction, `${play.capital.minutes} di ${play.capital.everyMinutes} minuti`);
  set('preparation', play.preparation.fraction, `${play.preparation.minutes} di ${play.preparation.everyMinutes} minuti`);
  const total = page.querySelector('[data-reward-text="total"]'); if (total) total.textContent = durationText(play.totalMs);
  const stateEl = page.querySelector('[data-reward-state]'); if (stateEl) stateEl.textContent = (DAILY_STATE[daily.state] ?? DAILY_STATE.counting)[0];
  return true;
}
