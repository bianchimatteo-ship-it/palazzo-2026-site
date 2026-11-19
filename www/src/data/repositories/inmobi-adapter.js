// The adapter of the InMobi bridge (the Capacitor plugin `InMobiAds`, plugins/inmobi-ads: Kotlin on Android, Swift on iOS). It is the ONLY ad provider of the game. It knows nothing about polls, saves or accounts:
// it asks for the consent (the CMP of the plugin, IAB TCF) BEFORE anything else, initialises the SDK only with the Account ID that the remote configuration delivers, and offers a banner, an interstitial and the
// rewarded video of data/repositories/ads-rewarded.js ({ kind: 'inmobi', isReady(), show() }).
// The reward is counted ONLY when the native side reports the SDK's own confirmation (Android `onRewardsUnlocked`, iOS `rewardActionCompletedWithRewards`, both turned into `rewarded: true` by the plugin);
// a video closed early, a failed show, a missing plugin or any error gives nothing, and one completion id is made natively for each video (so it can never be credited twice).
// No data of the player (position, birth date, gender, career) is ever sent: the only things passed to the plugin are the Account ID, the placement ids and the test flag.
import { FORMATS, defaultAds } from '../ads-config.js?v=20261119-12';

export function createInMobiAdapter({ plugin = globalThis.Capacitor?.Plugins?.InMobiAds ?? null, platform = 'android', config = null } = {}) {
  let ids = config ?? defaultAds(platform);
  let initPromise = null, consent = { canRequestAds: false, status: 'UNKNOWN' }, bannerShown = false;
  const ready = new Set(), loading = new Map();
  const usable = () => Boolean(plugin && ids.enabled && ids.accountId);
  const on = format => usable() && ids[format]?.enabled === true;

  // Consent first, then the SDK. Idempotent: the same promise is returned; a failure is remembered as «not ready» and is never thrown at the game. A new configuration (new account id) starts over.
  const start = () => initPromise ??= (async () => {
    if (!usable()) return { ok: false, code: 'not-configured' };
    try {
      const info = await plugin.requestConsent?.({ testMode: ids.testing });
      consent = { canRequestAds: info?.canRequestAds === true, status: info?.status ?? 'UNKNOWN', privacyOptions: info?.privacyOptionsRequired === true };
      if (!consent.canRequestAds) return { ok: false, code: 'no-consent' };
      const init = await plugin.initialize({ accountId: ids.accountId, testMode: ids.testing });
      return init?.ok === false ? { ok: false, code: 'error' } : { ok: true };
    } catch { return { ok: false, code: 'error' }; }
  })();
  const isReady = async () => (await start()).ok === true;

  async function load(format) {
    if (ready.has(format)) return true;
    if (!on(format) || !(await isReady())) return false;
    if (loading.has(format)) return loading.get(format);
    const task = (async () => {
      try { const out = await plugin.loadAd({ format, placementId: ids[format].placementId, testMode: ids.testing }); if (out?.ready === true) { ready.add(format); return true; } return false; }
      catch { return false; } finally { loading.delete(format); }
    })();
    loading.set(format, task);
    return task;
  }

  const rewardedProvider = {
    kind: 'inmobi',
    async isReady() { return load('rewarded'); },
    // Resolves { completed, verified, completionId }: completed only if the SDK confirmed the reward; the id is made natively for this one video.
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
    get ids() { return ids; }, rewardedProvider, consent: () => ({ ...consent }),
    // The remote configuration arrived (or changed): the formats follow it; a change of account id re-initialises.
    setConfig(next) { const changed = (next?.accountId ?? null) !== (ids.accountId ?? null) || next?.testing !== ids.testing; ids = next ?? defaultAds(platform); if (changed) { initPromise = null; ready.clear(); } if (!ids.banner?.enabled && bannerShown) this.hideBanner(); },
    // Why the ads are not there: 'not-configured' (off, no plugin, no account id), 'no-consent', 'error', or ok when the SDK is started.
    async status() { if (!usable()) return { ok: false, code: 'not-configured' }; return start(); },
    start,
    async showBanner({ margin = 0 } = {}) {
      if (bannerShown || !on('banner') || !(await isReady())) return false;
      try { const out = await plugin.showBanner({ placementId: ids.banner.placementId, margin, testMode: ids.testing }); bannerShown = out?.shown !== false; return bannerShown; } catch { return false; }
    },
    async hideBanner() { if (!bannerShown) return; bannerShown = false; try { await plugin.hideBanner(); } catch { /* ignored */ } },
    isBannerShown: () => bannerShown,
    async showInterstitial() {
      if (!(await load('interstitial'))) return false;
      ready.delete('interstitial');
      try { const out = await plugin.showAd({ format: 'interstitial' }); return out?.shown === true; } catch { return false; } finally { load('interstitial'); }
    },
    // The privacy options form of the CMP (settings): accept, refuse, change or withdraw. It works after a refusal (it does not need the consent). The state after the form is read back: a consent given now starts the SDK,
    // a consent withdrawn stops it (banner hidden, loaded formats forgotten, the next start asks again).
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
    formats: FORMATS
  };
}
