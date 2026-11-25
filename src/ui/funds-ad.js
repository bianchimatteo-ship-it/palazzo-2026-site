// The rewarded video of 1.000 € of personal funds (Appodeal placement `personal_funds_1000`, Android only). ONE service for the three ways in (the page of the rewards, the funds of the weekly
// activities, the notices of financial trouble): the same provider, the same placement, the same claim. Loaded on demand by rewards-service.js (service.funds()), never with the first screen.
//   · The video is offered only when the provider says a rewarded video is loaded AND the specific placement is configured in the Appodeal dashboard with its own reward (1000, «Fondi personali»):
//     Appodeal answers for a placement it does not know with the settings of `default` (the placement of the poll bonus), so a placement that does not answer with exactly this reward is NOT shown.
//   · Credited only on the SDK's own completion of THIS placement (onRewardedVideoFinished, with the placement's amount and currency), after the Worker has booked the completion id once for the account
//     (or the device of a guest); never on a close, a failure, a timeout or a missing answer. 1.000 € to the personal funds of the career (book(), category «ricompense»), never to the party's treasury.
//   · No daily limit, no total limit, no cooldown of the game: one video at a time (the busy guard here and the native one), as many as the ad network gives.
import { AD_FUNDS } from '../data/simulation/funds-ad-rules.js?v=20261125-1';
import { createRewardedAds } from '../data/repositories/ads-rewarded.js?v=20261125-1';
import { esc } from './sections-kit.js?v=20261125-1';

export const FUNDS_MESSAGES = Object.freeze({
  completed: 'Video completato: 1.000 € accreditati ai tuoi fondi personali.',
  dismissed: 'Video chiuso prima della fine: nessun accredito.',
  unavailable: 'Nessun video disponibile in questo momento: il saldo non cambia.',
  failed: 'Il video non è stato confermato: nessun accredito. Riprova più tardi.',
  duplicate: 'Questo video era già stato accreditato: nessun doppio accredito.',
  busy: 'Un video è già in corso.',
  career: 'Apri una carriera per ricevere i fondi.'
});
// The states the three ways in show: ready, loading (no video yet), placement (not configured or not usable yet in the dashboard), off (not this platform or ads not active).
export const FUNDS_STATES = Object.freeze({
  ready: 'Video disponibile',
  'no-ad': 'Video non ancora caricato: riprova tra poco',
  placement: 'Non ancora disponibile: il video da 1.000 € non è ancora attivo',
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

// The provider of the placement, on the native bridge of data/repositories/appodeal-adapter.js (`native`: its plugin, its load of the rewarded format). Appodeal answers for a placement it does not
// know with the settings of `default`: the placement counts as configured only when the SDK reports for it exactly the reward of `spec` (amount and currency, rewardedPlacement), and a completion
// counts only when the native side reports that same placement, amount and currency. The provider of `default` (the poll bonus) is not touched.
const same = (r, spec) => Number(r?.amount) === spec.amount && String(r?.currency ?? '').trim().toLowerCase() === spec.currency.toLowerCase();
export function placementProvider(native, spec = AD_FUNDS) {
  const { plugin, load, used } = native;
  const provider = {
    kind: 'appodeal',
    async check() {
      const loaded = await load('rewarded');
      if (!loaded || !plugin?.rewardedPlacement) return { loaded, placement: false };
      try { const r = await plugin.rewardedPlacement({ placement: spec.placement }); return { loaded, placement: r?.canShow === true && same(r, spec) }; } catch { return { loaded, placement: false }; }
    },
    async isReady() { const c = await provider.check(); return c.loaded && c.placement; },
    async show() {
      if (!(await provider.isReady())) return { completed: false, verified: false };
      used();
      let out = null;
      try { out = await plugin.showAd({ format: 'rewarded', placement: spec.placement }); } catch { /* nothing earned */ }
      load('rewarded');
      return out?.shown === true && out.rewarded === true && out.placement === spec.placement && same(out, spec) && typeof out.completionId === 'string' ? { completed: true, verified: true, completionId: out.completionId } : { completed: false, verified: false };
    }
  };
  return provider;
}

export function createFundsAds({ store, ads = {}, journal, username = () => null, claimAd = null, claimGuestAd = null, onChange = () => {} }) {
  const provider = ads.native?.plugin ? placementProvider(ads.native) : null;
  let state = { code: 'checking' }, watching = false, last = null;
  // The Worker books the completion id once (account or device) and answers; without its answer nothing is credited. Then the store credits the career, once for each id.
  const grant = async id => {
    const claim = username() && claimAd ? claimAd : claimGuestAd;
    if (!claim) return { ok: false, reason: 'rete' };
    let answer;
    try { answer = await claim(id, store.getState().career?.id ?? null, journal?.deviceId?.() ?? null, AD_FUNDS.reward); } catch { return { ok: false, reason: 'rete' }; }
    if (answer?.duplicate) return { ok: false, reason: 'duplicato' };
    if (!answer?.ok) return { ok: false, reason: 'rifiutato' };
    return store.claimFundsAdReward(id);
  };
  const rewarded = createRewardedAds({ config: ads.config, provider, grant });
  const configured = () => Boolean(provider && (typeof ads.config === 'function' ? ads.config()?.rewarded?.enabled : ads.config?.rewarded?.enabled));
  const service = {
    status: () => ({ code: watching ? 'watching' : state.code, label: FUNDS_STATES[watching ? 'watching' : state.code] ?? FUNDS_STATES.checking, available: !watching && state.code === 'ready', last }),
    // Asks the provider again: is a video loaded, and is the placement configured with its own reward?
    async refresh() {
      if (!configured()) state = { code: 'not-configured' };
      else { let check = null; try { check = await provider.check(); } catch { /* not ready */ } state = { code: !check?.loaded ? 'no-ad' : !check.placement ? 'placement' : 'ready' }; }
      onChange(); return service.status();
    },
    // Shows one video; resolves with { status, message }. Several in a row are fine: each completed video is 1.000 €.
    async watch() {
      if (watching) return { status: 'busy', message: FUNDS_MESSAGES.busy };
      if (!store.getState().game || !store.getState().career?.id) return { status: 'career', message: FUNDS_MESSAGES.career };
      watching = true; onChange();
      let out;
      try { out = configured() ? await rewarded.watch() : { status: 'unavailable' }; } catch { out = { status: 'failed' }; } finally { watching = false; }
      last = { status: out.status, message: FUNDS_MESSAGES[out.status] ?? FUNDS_MESSAGES.failed, at: Date.now() };
      await service.refresh();
      return last;
    }
  };
  current = service;
  return service;
}
