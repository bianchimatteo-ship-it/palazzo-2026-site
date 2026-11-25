// The rewarded video of 1.000 € of personal funds (Android only). The SAME video as the poll bonus: one provider, the Appodeal placement `default`, one busy guard (data/repositories/ads-rewarded.js,
// owned by rewards-service.js). What makes it worth 1.000 € is the button that started it (kind 'fondi'), fixed for the request and sent to the Worker; the placement has no reward of its own.
// ONE offer for the ways in (the page of the rewards, the funds of the weekly activities, Finanze, the notices of financial trouble). Loaded on demand by rewards-service.js (service.funds()).
//   · Credited only on the SDK's own completion (onRewardedVideoFinished, in the native bridge), after the Worker has booked the completion id once for the account (or the device of a guest) — an id
//     booked as a poll bonus is refused here and the other way round; never on a close, a failure, a timeout or a missing answer. 1.000 € to the personal funds of the career, never to the party's treasury.
//   · No daily limit, no total limit, no cooldown of the game: one video at a time (the shared busy guard and the native one), as many as the ad network gives.
import { esc } from './sections-kit.js?v=20261125-7';

export const FUNDS_MESSAGES = Object.freeze({
  completed: 'Video completato: 1.000 € accreditati ai tuoi fondi personali.',
  dismissed: 'Video chiuso prima della fine: nessun accredito.',
  unavailable: 'Nessun video disponibile in questo momento: il saldo non cambia.',
  failed: 'Il video non è stato confermato: nessun accredito. Riprova più tardi.',
  duplicate: 'Questo video era già stato accreditato: nessun doppio accredito.',
  busy: 'Un video è già in corso.',
  career: 'Apri una carriera per ricevere i fondi.'
});
// The states the ways in show: ready, loading (no video yet), off (not this platform or ads not active), watching (a video of either reward is on screen).
export const FUNDS_STATES = Object.freeze({
  ready: 'Video disponibile',
  'no-ad': 'Video non ancora caricato: riprova tra poco',
  checking: 'Verifica della disponibilità…',
  'not-configured': 'Video premiati non attivi su questo dispositivo',
  watching: 'Video in corso…'
});

// The service of the session (one), for the pages that show the offer: null until rewards-service.js has loaded it.
let current = null;
export const fundsStatus = () => current?.status() ?? null;
// The offer, the same everywhere: `card` on the page of the rewards and in the funds of the activities (always says whether the video is there), `alert` in a notice of financial trouble (only when a video
// is ready: the player can ignore it and go on). Nothing on iOS, on the web or where the ads are off.
export function fundsOffer(where = 'card') {
  const status = fundsStatus();
  if (!status || status.code === 'not-configured') return '';
  if (where === 'alert') return status.available ? `<button type="button" class="secondary-button funds-ad-alert" data-funds-ad="avviso">Guarda un video e ricevi 1.000 €</button>` : '';
  return `<div class="funds-ad" data-funds-offer="${esc(where)}" data-funds-state="${esc(status.code)}"><div class="funds-ad-copy">${where === 'ricompense' ? '' : '<strong>1.000 € di fondi personali</strong>'}<small>Guarda un video pubblicitario e ricevi 1.000 € nella tua carriera</small></div><span class="badge badge-${status.available ? 'good' : 'neutral'}" data-funds-label>${esc(status.label)}</span><button type="button" class="primary-button" data-funds-ad="${esc(where)}" ${status.available ? '' : 'disabled aria-disabled="true"'}>GUARDA IL VIDEO</button>${status.last ? `<small class="funds-ad-last" role="status">${esc(status.last.message)}</small>` : ''}</div>`;
}

// `rewarded`: the one rewarded service of the session (createRewardedAds of rewards-service.js), shared with the poll bonus.
export function createFundsAds({ store, rewarded, onChange = () => {} }) {
  let state = { code: 'checking' }, last = null;
  const watching = () => Boolean(rewarded?.busy);
  const service = {
    status: () => ({ code: watching() ? 'watching' : state.code, label: FUNDS_STATES[watching() ? 'watching' : state.code] ?? FUNDS_STATES.checking, available: !watching() && state.code === 'ready', last }),
    // Asks the provider again whether a video is loaded.
    async refresh() {
      let availability = null;
      try { availability = await rewarded.availability(); } catch { /* not ready */ }
      state = { code: availability?.ok ? 'ready' : availability?.code === 'not-configured' || !availability ? 'not-configured' : 'no-ad' };
      onChange(); return service.status();
    },
    // Shows one video for the personal funds; resolves with { status, message }. Several in a row are fine: each completed video is 1.000 €.
    async watch() {
      if (watching()) return { status: 'busy', message: FUNDS_MESSAGES.busy };
      if (!store.getState().game || !store.getState().career?.id) return { status: 'career', message: FUNDS_MESSAGES.career };
      const pending = rewarded.watch('fondi');
      onChange();   // the busy state is taken at once: every way in shows «Video in corso…»
      let out;
      try { out = await pending; } catch { out = { status: 'failed' }; }
      last = { status: out.status, message: FUNDS_MESSAGES[out.status] ?? FUNDS_MESSAGES.failed, at: Date.now() };
      await service.refresh();
      return last;
    }
  };
  current = service;
  return service;
}
