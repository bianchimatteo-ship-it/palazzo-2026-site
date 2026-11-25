// Rewarded videos, apart from the engine of the rewards. This file knows nothing about polls, resources or saves: it only decides whether a video can be offered and whether one was REALLY completed, and then
// hands the completion (with its unique id) to `grant`. The reward is given only for an authentic completion, once for each id; a video that fails, cannot be shown or is closed early gives nothing.
//
// A provider is the adapter of the advertising SDK (data/repositories/inmobi-adapter.js: InMobi, the only provider):
//   { kind: 'inmobi', isReady(): boolean | Promise<boolean>, show(): Promise<{ completed: boolean, verified: boolean, completionId: string }> }
// `completed` is the SDK's own confirmation that the user earned the reward, `verified` that it comes from the SDK / the ad network (and not from the page), `completionId` an id that is unique for each completion
// (the transaction id of the network). A `demo` provider (kind: 'demo') is for tests only and is refused unless the caller passes `allowDemo: true`; production never does.
import { ADS_CONFIG } from '../ads-config.js?v=20261125-10';

// The kinds of reward a video can give (the SAME provider and placement for both: what the video is worth is chosen by the button that started it). The kind is fixed when watch() is called and is the
// one handed to `grant` with the completion: it cannot change while the video plays or after it.
export const REWARD_KINDS = Object.freeze(['sondaggi', 'fondi']);
export const REWARDED_ADS_OFF = 'Gli annunci premiati non sono attivi in questo momento.';
const validId = id => typeof id === 'string' && /^[\w.:|~-]{8,160}$/.test(id);

export function createRewardedAds({ config = ADS_CONFIG, provider = null, allowDemo = false, grant = () => ({ ok: false, reason: 'nessun-destinatario' }) } = {}) {
  let busy = false;
  const configured = () => Boolean(typeof config === 'function' ? config()?.rewarded?.enabled : config?.rewarded?.enabled);
  const providerOk = () => Boolean(provider && (['inmobi', 'appodeal'].includes(provider.kind) || (provider.kind === 'demo' && allowDemo === true)));
  return {
    // Whether a video can be offered now, and why not.
    async availability() {
      if (provider?.kind === 'demo' && allowDemo === true) { try { return await provider.isReady?.() === false ? { ok: false, code: 'no-ad', reason: 'Nessun video disponibile in questo momento.' } : { ok: true, code: 'ready', reason: null }; } catch { return { ok: false, reason: 'Nessun video disponibile in questo momento.' }; } }
      // three states, told apart: not integrated or not configured (nothing to wait for), integrated and ready (the button works), integrated but with no video now (it comes back by itself)
      if (!configured() || !providerOk()) return { ok: false, code: 'not-configured', reason: REWARDED_ADS_OFF };
      try { return await provider.isReady?.() === false ? { ok: false, code: 'no-ad', reason: 'Nessun video disponibile in questo momento.' } : { ok: true, code: 'ready', reason: null }; } catch { return { ok: false, code: 'no-ad', reason: 'Nessun video disponibile in questo momento.' }; }
    },
    // Whether a video is on screen (or being asked for) right now: one at a time for every way in of every kind.
    get busy() { return busy; },
    // Shows a video for the reward `kind`. Returns { status: 'completed' | 'dismissed' | 'failed' | 'unavailable' | 'duplicate' | 'busy', kind }. The reward is granted (once) only on 'completed'.
    async watch(kind = 'sondaggi') {
      if (!REWARD_KINDS.includes(kind)) return { status: 'failed', reason: 'tipo', kind };
      if (busy) return { status: 'busy', kind };
      busy = true;   // taken at once, before any wait: two clicks together are one video (the second answers «busy»)
      try {
        const asked = kind;   // a constant of this request: what the video is worth was decided by the button
        const available = await this.availability();
        if (!available.ok) return { status: 'unavailable', reason: available.reason, kind: asked };
        let result;
        try { result = await provider.show(); } catch { return { status: 'failed', kind: asked }; }
        if (!result || result.completed !== true) return { status: 'dismissed', kind: asked };
        // an authentic completion: confirmed by the provider, verified, with a unique id; anything else is not a completion
        if (result.verified !== true || !validId(result.completionId)) return { status: 'failed', kind: asked };
        const granted = await grant(result.completionId, asked);   // (may be asynchronous: an account asks the Worker first, see rewards-service.js)
        if (granted?.ok === false && granted.reason === 'duplicato') return { status: 'duplicate', kind: asked };
        if (granted?.ok === false) return { status: 'failed', reason: granted.reason, kind: asked };
        return { status: 'completed', completionId: result.completionId, kind: asked };
      } finally { busy = false; }
    },
    // A late or repeated callback of the SDK for a completion: the same id is never paid twice (the store keeps the ids), so it only reports what happened.
    async complete(completion, kind = 'sondaggi') {
      if (!REWARD_KINDS.includes(kind) || !completion || completion.completed !== true || completion.verified !== true || !validId(completion.completionId)) return { status: 'failed' };
      const granted = await grant(completion.completionId, kind);
      return granted?.ok ? { status: 'completed', completionId: completion.completionId } : granted?.reason === 'duplicato' ? { status: 'duplicate' } : { status: 'failed', reason: granted?.reason };
    }
  };
}
