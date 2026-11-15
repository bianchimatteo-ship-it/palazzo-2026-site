// The adapter of the AdMob plugin (@capacitor-community/admob: Google Mobile Ads SDK + UMP), Android only for now. It knows nothing about polls, saves or accounts: it asks for the consent (UMP) before any ad request,
// initialises the SDK, and offers a banner, an interstitial and the rewarded video of data/repositories/ads-rewarded.js ({ kind: 'admob', isReady(), show() }).
// The reward is counted ONLY when the SDK reports that the user earned it (the `onUserEarnedReward` callback: the plugin's `onRewardedVideoAdReward` event / the result of showRewardVideoAd): a closed, failed or skipped video gives nothing.
// With the mode 'off', on a platform without ids (iOS today) or without the plugin, nothing is called: `available()` says why.
import { resolveAds } from '../ads-config.js?v=20261113-8';

const randomId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/[^\w-]/g, '');

export function createAdMobAdapter({ plugin = globalThis.Capacitor?.Plugins?.AdMob ?? null, platform = 'android', mode, now = () => Date.now() } = {}) {
  const ids = resolveAds(platform, mode);
  let initPromise = null, consent = { canRequestAds: false, status: 'UNKNOWN' }, rewardedReady = false, rewardedLoading = null, interstitialReady = false, bannerShown = false;
  const usable = () => Boolean(plugin && ids.enabled);

  async function consentFlow() {
    // UMP: the status first; the form only when it is required and available; ads only if the SDK says they can be requested. The audience is 14+, so no «under age of consent» tag.
    let info = await plugin.requestConsentInfo({ tagForUnderAgeOfConsent: false });
    if (info?.status === 'REQUIRED' && info.isConsentFormAvailable !== false) info = await plugin.showConsentForm();
    consent = { canRequestAds: info?.canRequestAds === true, status: info?.status ?? 'UNKNOWN', privacyOptions: info?.privacyOptionsRequirementStatus ?? null };
    return consent;
  }
  // Consent, then the SDK. Idempotent: the same promise is returned; a failure is remembered as «not ready», it is never thrown at the game.
  const start = () => initPromise ??= (async () => {
    if (!usable()) return { ok: false, code: 'not-configured' };
    try {
      await consentFlow();
      if (!consent.canRequestAds) return { ok: false, code: 'no-consent' };
      await plugin.initialize({ initializeForTesting: ids.testing });
      return { ok: true };
    } catch { return { ok: false, code: 'error' }; }
  })();
  const ready = async () => (await start()).ok === true;

  async function loadRewarded() {
    if (rewardedReady) return true;
    if (!(await ready())) return false;
    return rewardedLoading ??= (async () => {
      try { await plugin.prepareRewardVideoAd({ adId: ids.rewardedUnitId, isTesting: ids.testing }); rewardedReady = true; return true; }
      catch { rewardedReady = false; return false; } finally { rewardedLoading = null; }
    })();
  }
  async function loadInterstitial() {
    if (interstitialReady) return true;
    if (!(await ready())) return false;
    try { await plugin.prepareInterstitial({ adId: ids.interstitialId, isTesting: ids.testing }); interstitialReady = true; return true; } catch { interstitialReady = false; return false; }
  }

  const rewardedProvider = {
    kind: 'admob',
    async isReady() { return loadRewarded(); },
    // Resolves { completed, verified, completionId }: completed only if the SDK reported the earned reward; the id is made for this completion and is unique.
    async show() {
      if (!(await loadRewarded())) return { completed: false, verified: false };
      rewardedReady = false;
      let earned = false; const handles = [];
      try {
        handles.push(await plugin.addListener('onRewardedVideoAdReward', () => { earned = true; }));
        const item = await plugin.showRewardVideoAd();
        if (item && typeof item === 'object' && item.amount !== undefined) earned = true;
      } catch { /* a failed show: nothing earned unless the SDK already said so */ }
      finally { for (const handle of handles) { try { await handle?.remove?.(); } catch { /* ignored */ } } }
      loadRewarded();   // the next one, in the background
      return earned ? { completed: true, verified: true, completionId: `adm-${now().toString(36)}-${randomId()}` } : { completed: false, verified: false };
    }
  };

  return {
    ids, rewardedProvider, consent: () => ({ ...consent }),
    // Why the ads are not there: 'not-configured' (mode off, no plugin, no ids for this platform), 'no-consent', 'error', or null when the SDK is started.
    async status() { if (!usable()) return { ok: false, code: 'not-configured' }; return start(); },
    start,
    async showBanner({ margin = 0 } = {}) {
      if (bannerShown || !(await ready())) return false;
      try { await plugin.showBanner({ adId: ids.bannerId, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin, isTesting: ids.testing }); bannerShown = true; return true; } catch { return false; }
    },
    async hideBanner() { if (!bannerShown) return; bannerShown = false; try { await plugin.removeBanner(); } catch { /* ignored */ } },
    isBannerShown: () => bannerShown,
    async showInterstitial() {
      if (!(await loadInterstitial())) return false;
      interstitialReady = false;
      try { await plugin.showInterstitial(); return true; } catch { return false; } finally { loadInterstitial(); }
    },
    // The privacy options form of UMP (settings), when the SDK says it must be offered.
    async showPrivacyOptions() { if (!(await ready())) return false; try { await plugin.showPrivacyOptionsForm(); return true; } catch { return false; } }
  };
}
