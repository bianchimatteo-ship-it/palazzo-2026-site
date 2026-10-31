// Rewarded videos, apart from the engine of the rewards. This file knows nothing about polls, resources or saves: it only decides whether a video can be offered and whether one was REALLY completed, and then
// hands the completion (with its unique id) to `grant`. The reward is given only for an authentic completion, once for each id; a video that fails, cannot be shown or is closed early gives nothing.
//
// A provider is the adapter of an advertising SDK (to be written when AdMob is installed and configured; none exists in the game today):
//   { kind: 'admob', isReady(): boolean | Promise<boolean>, show(): Promise<{ completed: boolean, verified: boolean, completionId: string }> }
// `completed` is the SDK's own confirmation that the user earned the reward, `verified` that it comes from the SDK / the ad network (and not from the page), `completionId` an id that is unique for each completion
// (the transaction id of the network). A `demo` provider (kind: 'demo') is for tests only and is refused unless the caller passes `allowDemo: true`; production never does.
import { ADS_CONFIG } from '../ads-config.js?v=20261031-3';

export const REWARDED_ADS_OFF = 'Gli annunci premiati non sono ancora attivi: serve l’integrazione di AdMob, non ancora configurata.';
const validId = id => typeof id === 'string' && /^[\w.:|~-]{8,160}$/.test(id);

export function createRewardedAds({ config = ADS_CONFIG, provider = null, allowDemo = false, grant = () => ({ ok: false, reason: 'nessun-destinatario' }) } = {}) {
  let busy = false;
  const configured = () => Boolean(config?.enabled && config.appId && config.rewardedUnitId);
  const providerOk = () => Boolean(provider && (provider.kind === 'admob' || (provider.kind === 'demo' && allowDemo === true)));
  return {
    // Whether a video can be offered now, and why not.
    async availability() {
      if (provider?.kind === 'demo' && allowDemo === true) { try { return await provider.isReady?.() === false ? { ok: false, reason: 'Nessun video disponibile in questo momento.' } : { ok: true, reason: null }; } catch { return { ok: false, reason: 'Nessun video disponibile in questo momento.' }; } }
      if (!configured() || !providerOk()) return { ok: false, reason: REWARDED_ADS_OFF };
      try { return await provider.isReady?.() === false ? { ok: false, reason: 'Nessun video disponibile in questo momento.' } : { ok: true, reason: null }; } catch { return { ok: false, reason: 'Nessun video disponibile in questo momento.' }; }
    },
    // Shows a video. Returns { status: 'completed' | 'dismissed' | 'failed' | 'unavailable' | 'duplicate' | 'busy' }. The reward is granted (once) only on 'completed'.
    async watch() {
      if (busy) return { status: 'busy' };
      const available = await this.availability();
      if (!available.ok) return { status: 'unavailable', reason: available.reason };
      busy = true;
      try {
        let result;
        try { result = await provider.show(); } catch { return { status: 'failed' }; }
        if (!result || result.completed !== true) return { status: 'dismissed' };
        // an authentic completion: confirmed by the provider, verified, with a unique id; anything else is not a completion
        if (result.verified !== true || !validId(result.completionId)) return { status: 'failed' };
        const granted = grant(result.completionId);
        if (granted?.ok === false && granted.reason === 'duplicato') return { status: 'duplicate' };
        if (granted?.ok === false) return { status: 'failed', reason: granted.reason };
        return { status: 'completed', completionId: result.completionId };
      } finally { busy = false; }
    },
    // A late or repeated callback of the SDK for a completion: the same id is never paid twice (the store keeps the ids), so it only reports what happened.
    complete(completion) {
      if (!completion || completion.completed !== true || completion.verified !== true || !validId(completion.completionId)) return { status: 'failed' };
      const granted = grant(completion.completionId);
      return granted?.ok ? { status: 'completed', completionId: completion.completionId } : granted?.reason === 'duplicato' ? { status: 'duplicate' } : { status: 'failed', reason: granted?.reason };
    }
  };
}
