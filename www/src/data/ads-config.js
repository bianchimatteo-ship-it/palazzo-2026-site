// Rewarded advertising: NOT configured. The game ships with no advertising SDK (no AdMob, no Capacitor plugin) and no advertising ids: the video reward stays disabled (the button is off and says why)
// until the owner installs the SDK, sets the ids below (taken from the owner's own AdMob account, never invented or copied) and provides a provider that implements the contract of
// data/repositories/ads-rewarded.js. Nothing here may be filled with test or example ids in production.
export const ADS_CONFIG = Object.freeze({
  enabled: false,
  appId: null,
  rewardedUnitId: null
});

// ---------- AdMob: the ids of the owner's account, kept apart for each platform, and the mode that decides which ones may ever be used ----------
// ADS_MODE: 'off' (the default and the value of every release: no SDK call, no request, the buttons say why they are off), 'test' (the official Google TEST ids, for development: never real ads) or 'live' (the owner's real
// ids). 'live' may be set only after the tests, the privacy documents and the administrative checks of AdMob are done (docs/admob.md): the checks of the repository refuse a build whose mode is not 'off'.
export const ADS_MODE = 'off';
// The ids created by the owner in the AdMob account. Android only: the iOS app has no AdMob account, no app id and no ad units yet (the iOS ones will be new, separate ids), so nothing here may be used on iOS.
export const ADS_PLATFORMS = Object.freeze({
  android: Object.freeze({ appId: 'ca-app-pub-6404822903303014~1677702221', bannerId: 'ca-app-pub-6404822903303014/4792704744', interstitialId: 'ca-app-pub-6404822903303014/5092627610', rewardedUnitId: 'ca-app-pub-6404822903303014/6230148140' }),
  ios: Object.freeze({ appId: null, bannerId: null, interstitialId: null, rewardedUnitId: null })
});
// The sample ids that Google publishes for testing (they never show real ads and earn nothing).
export const GOOGLE_TEST_IDS = Object.freeze({ appId: 'ca-app-pub-3940256099942544~3347511713', bannerId: 'ca-app-pub-3940256099942544/6300978111', interstitialId: 'ca-app-pub-3940256099942544/1033173712', rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917' });
// What is in force for a platform and a mode: `enabled` is false in mode 'off' and on a platform without ids; in 'test' the sample ids are the only ones used (`testing` true).
export function resolveAds(platform, mode = ADS_MODE) {
  const own = ADS_PLATFORMS[platform];
  if (!own || mode === 'off' || !['test', 'live'].includes(mode)) return Object.freeze({ enabled: false, testing: false, platform, mode: 'off', appId: null, bannerId: null, interstitialId: null, rewardedUnitId: null });
  const ids = mode === 'test' ? GOOGLE_TEST_IDS : own;
  const has = set => ['appId', 'bannerId', 'interstitialId', 'rewardedUnitId'].every(key => typeof set[key] === 'string' && set[key].startsWith('ca-app-pub-'));
  // a platform is integrated only when the owner has created ITS OWN ids (iOS has none yet): until then it stays off even in test mode
  const complete = has(own) && has(ids);
  return Object.freeze({ enabled: complete, testing: mode === 'test', platform, mode, appId: complete ? ids.appId : null, bannerId: complete ? ids.bannerId : null, interstitialId: complete ? ids.interstitialId : null, rewardedUnitId: complete ? ids.rewardedUnitId : null });
}
// The pages (hash) of the game that may carry a banner: secondary screens only, never the home, a scene, the vote, the night or the weekly report.
export const BANNER_PAGES = Object.freeze(['ricompense', 'notizie', 'archivio', 'impostazioni', 'storico']);
// Interstitials: only when a week is closed, at most one every INTERSTITIAL.everyWeeks closed weeks, never closer than minGapMs to the previous interstitial or to a rewarded video, at most perDay a day.
export const INTERSTITIAL = Object.freeze({ everyWeeks: 3, minGapMs: 4 * 60_000, perDay: 4 });
