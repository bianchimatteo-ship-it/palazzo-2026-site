// Rewarded advertising: NOT configured. The game ships with no advertising SDK (no AdMob, no Capacitor plugin) and no advertising ids: the video reward stays disabled (the button is off and says why)
// until the owner installs the SDK, sets the ids below (taken from the owner's own AdMob account, never invented or copied) and provides a provider that implements the contract of
// data/repositories/ads-rewarded.js. Nothing here may be filled with test or example ids in production.
export const ADS_CONFIG = Object.freeze({
  enabled: false,
  appId: null,
  rewardedUnitId: null
});
