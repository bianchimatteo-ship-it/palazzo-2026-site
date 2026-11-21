// Advertising: InMobi is the ONLY provider of the game (Android and iOS). Nothing here calls an SDK: this file holds the SAFE DEFAULTS and the rules that turn the remote configuration (served by the Worker,
// GET /api/ads/config, see worker.js and docs/inmobi.md) into what the app may do. Whatever the remote answer is, the result is clamped and validated here; an unreachable, invalid or missing answer means
// the safe defaults below: every format OFF. Real ads stay OFF until the owner verifies the integration (mode 'test' by default: InMobi test mode, never real ads).
//
// Identifiers (the owner's, from the InMobi dashboard; they are PLACEMENT ids, not secrets). ONE set PER PLATFORM, never mixed: Android reads only `INMOBI.android`, iOS only `INMOBI.ios`.
//   Android · App Key 10000256631 (the dashboard's id of the app: NOT used by the SDK, kept for the record) · Rewarded 10000884972 · Banner 10000884973 · Interstitial 10000884974
//   iOS     · Bundle ID it.politicando2026.app · App Key 10000257482 (same remark) · Rewarded 10000888244 · Banner 10000888245 · Interstitial 10000888243 (from the dashboard, verified)
//   The two sets are different and never mixed: a platform reads only its own.
// The Account ID that the SDK needs to initialise (iOS `IMSdk.initWithAccountID`, Android `InMobiSdk.init`) is NOT any of these ids, and NOT the user id of the profile or the Publisher Payment ID: it is the InMobi ACCOUNT id,
// verified by the owner from the dashboard. It is a public identifier, not a secret. The remote configuration may override it (`accountId`); one that is present but malformed switches everything off. Having it turns NO
// format on: all stay OFF until the remote configuration says so (and `ADS_MODE` is 'off' by default).
export const INMOBI = Object.freeze({
  accountId: '60d3e31b9c094bd69283e287bc2d4c42',   // the InMobi Account ID, verified by the owner from the dashboard (19/11/2026); shared by both platforms; public, not a secret
  android: Object.freeze({ appKey: '10000256631', placements: Object.freeze({ rewarded: '10000884972', banner: '10000884973', interstitial: '10000884974' }) }),
  ios: Object.freeze({ bundleId: 'it.politicando2026.app', appKey: '10000257482', placements: Object.freeze({ rewarded: '10000888244', banner: '10000888245', interstitial: '10000888243' }) }),
  sdk: Object.freeze({ android: '11.5.1', ios: '11.5.0' })
});
// Test Mode OFF and Audience Bidding OFF in the dashboard (both apps); Global eCPM floor 0.01 is a dashboard setting, not read by the code.
export const ADS_PROVIDER = 'inmobi';
// 'off' (the DEFAULT: nothing is asked, nothing is shown), 'test' (InMobi test mode, no real ad, no earnings: only the remote configuration can set it) or 'live' (set only by the remote configuration, after the checks of docs/inmobi.md). 'off' disables everything.
export const ADS_MODE = 'off';
export const FORMATS = Object.freeze(['rewarded', 'banner', 'interstitial']);
export const PLATFORMS = Object.freeze(['android', 'ios']);
// The pages (hash) of the game that may carry a banner: secondary screens only, never the home, a scene, the vote, the night or the weekly report.
export const BANNER_PAGES = Object.freeze(['ricompense', 'notizie', 'archivio', 'impostazioni', 'storico']);
// Interstitials: only when a week is closed, at most one every `everyWeeks` closed weeks, never closer than `minGapMs` to the previous interstitial or to a rewarded video, at most `perDay` a day.
export const INTERSTITIAL = Object.freeze({ everyWeeks: 3, minGapMs: 4 * 60_000, perDay: 4 });
// What the remote configuration may change, and the limits it is held to (a value outside the limits is replaced by the default, never trusted).
export const LIMITS = Object.freeze({ everyWeeks: [1, 52], minGapMs: [60_000, 3_600_000], perDay: [0, 12], rewardPoints: [0, 0.5] });
const DEFAULT_POINTS = 0.15;
const PLACEMENT = /^\d{8,20}$/, ACCOUNT_ID = /^[0-9a-f]{32,36}$/i;

// the identifiers of ONE platform (an unknown platform is Android, as everywhere else in this file)
const ids = platform => (platform === 'ios' ? INMOBI.ios : INMOBI.android);
const off = (platform = 'android') => ({
  platform, provider: ADS_PROVIDER, mode: ADS_MODE, testing: true, accountId: INMOBI.accountId, enabled: false, source: 'default',
  rewarded: { enabled: false, placementId: ids(platform).placements.rewarded }, banner: { enabled: false, placementId: ids(platform).placements.banner }, interstitial: { enabled: false, placementId: ids(platform).placements.interstitial },
  interstitialPolicy: { ...INTERSTITIAL }, rewardPoints: DEFAULT_POINTS
});
// Safe defaults for a platform: every format off, mode test, no account id.
export const defaultAds = platform => Object.freeze(deepFreeze(off(platform)));
const deepFreeze = value => { for (const item of Object.values(value)) if (item && typeof item === 'object') deepFreeze(item); return Object.freeze(value); };
const num = value => (typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);   // null, '' and booleans are not numbers (Number(null) would be 0)
const clamp = (value, [min, max], fallback) => { const n = num(value); return Number.isFinite(n) && n >= min && n <= max ? n : fallback; };
const flag = value => value === true;

// The configuration in force for a platform: the safe defaults with the remote answer laid over them, field by field and validated. `remote` is the parsed JSON of the Worker ({ android: {...}, ios: {...}, ... }) or
// null. A format is enabled only when the remote says `enabled: true` AND it has a well-formed placement id AND the SDK has a valid Account ID AND the mode is not 'off'; the mode can be 'live' only if the remote says so.
export function resolveAds(platform, remote = null) {
  const base = off(PLATFORMS.includes(platform) ? platform : 'android');
  if (!PLATFORMS.includes(platform) || !remote || typeof remote !== 'object') return deepFreeze(base);
  const shared = remote.all && typeof remote.all === 'object' ? remote.all : {}, mine = remote[platform] && typeof remote[platform] === 'object' ? remote[platform] : {};
  const pick = key => ({ ...(shared[key] && typeof shared[key] === 'object' ? shared[key] : {}), ...(mine[key] && typeof mine[key] === 'object' ? mine[key] : {}) });
  const root = { ...shared, ...mine };
  const mode = root.mode === 'off' ? 'off' : root.mode === 'live' ? 'live' : 'test';
  const accountId = root.accountId === undefined ? INMOBI.accountId : typeof root.accountId === 'string' && ACCOUNT_ID.test(root.accountId.trim()) ? root.accountId.trim() : null;
  const master = remote.enabled !== false && root.enabled !== false && mode !== 'off' && Boolean(accountId);
  const out = { ...base, mode, testing: mode !== 'live', accountId: master ? accountId : null, source: 'remote' };
  for (const format of FORMATS) {
    const item = pick(format);
    const placementId = typeof item.placementId === 'string' && PLACEMENT.test(item.placementId) ? item.placementId : ids(platform).placements[format];
    out[format] = { enabled: master && flag(item.enabled), placementId };
  }
  const policy = pick('interstitialPolicy');
  out.interstitialPolicy = { everyWeeks: Math.round(clamp(policy.everyWeeks, LIMITS.everyWeeks, INTERSTITIAL.everyWeeks)), minGapMs: Math.round(clamp(policy.minGapMs, LIMITS.minGapMs, INTERSTITIAL.minGapMs)), perDay: Math.round(clamp(policy.perDay, LIMITS.perDay, INTERSTITIAL.perDay)) };
  out.rewardPoints = Math.round(clamp(root.rewardPoints, LIMITS.rewardPoints, DEFAULT_POINTS) * 100) / 100;
  out.enabled = FORMATS.some(format => out[format].enabled);
  return deepFreeze(out);
}
// ---------------------------------------------------------------- ANDROID: Appodeal (Android only; iOS keeps its own provider, above)
// Appodeal SDK 4.4.0 (stable) through the Capacitor plugin `AppodealAds` (plugins/appodeal-ads). Appodeal's automatic network connection is kept (the app gives ONLY its app key, never a network id); no AdMob, Meta or
// standalone InMobi SDK is in the Android app. The key below is the Android App Key of the Appodeal dashboard (app id 790468, the Android package of the app): a public client identifier, not a secret.
//   Modes: 'test' (the DEFAULT: `Appodeal.setTesting(true)`, test creatives only, no real ad and no earnings), 'off' (nothing is asked, nothing is shown) and 'production' (real ads): production is REFUSED by the code
//   until APPODEAL_PRODUCTION_AUTHORIZED is set to true by a deliberate change (commercial authorisation of the owner); a remote value can never turn it on, only switch the formats OFF (kill switch).
export const APPODEAL = Object.freeze({
  dashboardId: '790468',
  android: Object.freeze({ appKey: '8d31e2dc0428104dbfcf36959833bc1020f210c3914df496', placement: 'default' }),
  sdk: Object.freeze({ android: '4.4.0' })
});
export const APPODEAL_MODE = 'test';
export const APPODEAL_PRODUCTION_AUTHORIZED = false;
// The pages (hash) that may carry a banner on Android: the home and the static screens, never a scene, the vote, the night, the weekly report, a menu or the first start (the manager also blocks those).
export const APPODEAL_BANNER_PAGES = Object.freeze(['panoramica', 'ricompense', 'notizie', 'archivio', 'impostazioni', 'storico']);
// At most one interstitial every 180 seconds, only at a natural pause (a week closed, every 2nd), never during a game moment, a vote or an important action.
export const APPODEAL_INTERSTITIAL = Object.freeze({ everyWeeks: 2, minGapMs: 180_000, perDay: 12 });
const APPKEY = /^[0-9a-f]{48}$/;
export const providerFor = platform => (platform === 'ios' ? ADS_PROVIDER : 'appodeal');
// The configuration of Android: TEST by default and complete without any remote answer. `remote` ({ appodeal: { mode, enabled, rewarded: {enabled}, banner: {enabled}, interstitial: {enabled}, rewardPoints } } or null) may only
// SWITCH THINGS OFF (mode 'off', enabled false) or lower the reward; anything else is ignored. A malformed app key or mode 'off' switches everything off.
export function resolveAppodeal(remote = null, mode = APPODEAL_MODE) {
  const wanted = mode === 'off' ? 'off' : mode === 'production' && APPODEAL_PRODUCTION_AUTHORIZED === true ? 'production' : 'test';
  const r = remote && typeof remote === 'object' && remote.appodeal && typeof remote.appodeal === 'object' ? remote.appodeal : {};
  const killed = r.mode === 'off' || r.enabled === false;
  const appKey = APPKEY.test(APPODEAL.android.appKey) ? APPODEAL.android.appKey : null;
  const master = wanted !== 'off' && !killed && Boolean(appKey);
  const fmt = key => ({ enabled: master && !(r[key] && typeof r[key] === 'object' && r[key].enabled === false), placement: APPODEAL.android.placement });
  const out = {
    platform: 'android', provider: 'appodeal', mode: master ? wanted : 'off', testing: wanted !== 'production', appKey: master ? appKey : null, accountId: master ? appKey : null, placement: APPODEAL.android.placement,
    source: remote ? 'remote' : 'default', rewarded: fmt('rewarded'), banner: fmt('banner'), interstitial: fmt('interstitial'), interstitialPolicy: { ...APPODEAL_INTERSTITIAL },
    rewardPoints: Math.round(clamp(r.rewardPoints, LIMITS.rewardPoints, DEFAULT_POINTS) * 100) / 100
  };
  out.enabled = FORMATS.some(format => out[format].enabled);
  return deepFreeze(out);
}
// Kept for the code that still reads the old shape (the rewarded button): enabled only when the rewarded format is on.
export const ADS_CONFIG = Object.freeze({ enabled: false, appId: null, rewardedUnitId: null });
