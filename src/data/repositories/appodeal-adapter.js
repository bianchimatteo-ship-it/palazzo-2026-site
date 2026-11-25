// What this module does and why: docs/architettura-ricompense.md (§ appodeal-adapter.js).
import { FORMATS, resolveAppodeal } from '../ads-config.js?v=20261125-1';

export function createAppodealAdapter({ plugin = globalThis.Capacitor?.Plugins?.AppodealAds ?? null, config = null } = {}) {
  let ids = config ?? resolveAppodeal(null, 'off');
  let initPromise = null, consent = { canRequestAds: false, status: 'UNKNOWN' }, bannerShown = false;
  const ready = new Set(), loading = new Map();
  const usable = () => Boolean(plugin && ids.enabled && ids.appKey);
  const on = format => usable() && ids[format]?.enabled === true;

  // Consent first, then the SDK. Idempotent: the same promise is returned; a failure is remembered as «not ready» and never thrown at the game. A new configuration starts over.
  const start = () => initPromise ??= (async () => {
    if (!usable()) return { ok: false, code: 'not-configured' };
    try {
      const info = await plugin.requestConsent?.({ appKey: ids.appKey, testMode: ids.testing });
      consent = { canRequestAds: info?.canRequestAds === true, status: info?.status ?? 'UNKNOWN', privacyOptions: info?.privacyOptionsRequired === true };
      if (!consent.canRequestAds) return { ok: false, code: 'no-consent' };
      const init = await plugin.initialize({ appKey: ids.appKey, testMode: ids.testing });
      return init?.ok === false ? { ok: false, code: init.code ?? 'error' } : { ok: true };
    } catch { return { ok: false, code: 'error' }; }
  })();
  const isReady = async () => (await start()).ok === true;

  async function load(format) {
    if (ready.has(format)) return true;
    if (!on(format) || !(await isReady())) return false;
    if (loading.has(format)) return loading.get(format);
    const task = (async () => {
      try { const out = await plugin.loadAd({ format }); if (out?.ready === true) { ready.add(format); return true; } return false; }
      catch { return false; } finally { loading.delete(format); }
    })();
    loading.set(format, task);
    return task;
  }

  const rewardedProvider = {
    kind: 'appodeal',
    async isReady() { return load('rewarded'); },
    // Resolves { completed, verified, completionId }: completed only if the SDK confirmed the completion; the id is made natively for this one video.
    async show() {
      if (!(await load('rewarded'))) return { completed: false, verified: false };
      ready.delete('rewarded');
      let out = null;
      try { out = await plugin.showAd({ format: 'rewarded' }); } catch { /* a failed show: nothing earned */ }
      load('rewarded');   // the next one, in the background
      return out?.shown === true && out.rewarded === true && typeof out.completionId === 'string' ? { completed: true, verified: true, completionId: out.completionId } : { completed: false, verified: false };
    }
  };

  return {
    get ids() { return ids; }, rewardedProvider, consent: () => ({ ...consent }), provider: 'appodeal',
    // A new configuration arrived: the formats follow it; a change of key or of test mode re-initialises.
    setConfig(next) { const changed = (next?.appKey ?? null) !== (ids.appKey ?? null) || next?.testing !== ids.testing; ids = next ?? resolveAppodeal(null, 'off'); if (changed) { initPromise = null; ready.clear(); } if (!ids.banner?.enabled && bannerShown) this.hideBanner().catch(() => {}); },
    // Why the ads are not there: 'not-configured' (off, no plugin, no key), 'no-consent', 'error', or ok when the SDK is started.
    async status() { if (!usable()) return { ok: false, code: 'not-configured' }; return start(); },
    start,
    async showBanner({ margin = 0 } = {}) {
      if (bannerShown || !on('banner') || !(await isReady())) return false;
      try { const out = await plugin.showBanner({ margin }); bannerShown = out?.shown === true; return bannerShown; } catch { return false; }
    },
    // true when there is nothing (left) to hide, false when the native hide failed: the banner may still be up, so it stays «shown» and the manager retries. Never throws (callers just await it).
    async hideBanner() { if (!bannerShown) return true; bannerShown = false; try { await plugin.hideBanner(); return true; } catch { bannerShown = true; return false; } },
    isBannerShown: () => bannerShown,
    async showInterstitial() {
      if (!(await load('interstitial'))) return false;
      ready.delete('interstitial');
      try { const out = await plugin.showAd({ format: 'interstitial' }); return out?.shown === true; } catch { return false; } finally { load('interstitial'); }
    },
    // The privacy options form (settings): accept, refuse, change or withdraw. It works after a refusal too. The state after the form is read back: a consent given now starts the SDK, a consent withdrawn stops it.
    async showPrivacyOptions() {
      if (!plugin?.showPrivacyOptions) return false;
      try {
        const info = await plugin.showPrivacyOptions();
        if (info && typeof info === 'object') {
          const before = consent.canRequestAds;
          consent = { canRequestAds: info.canRequestAds === true, status: info.status ?? consent.status, privacyOptions: info.privacyOptionsRequired === true };
          if (before && !consent.canRequestAds) { await this.hideBanner(); ready.clear(); initPromise = null; }
          else if (!before && consent.canRequestAds) { initPromise = null; if (usable()) start().catch(() => {}); }
        }
        return true;
      } catch { return false; }
    },
    formats: FORMATS,
    // ui/funds-ad.js
    native: { plugin, load, used: () => ready.delete('rewarded') }
  };
}
