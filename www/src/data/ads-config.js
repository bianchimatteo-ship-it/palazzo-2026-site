// Advertising: InMobi is the ONLY provider of the game (Android and iOS). Nothing here calls an SDK: this file holds the SAFE DEFAULTS and the rules that turn the remote configuration (served by the Worker,
// GET /api/ads/config, see worker.js and docs/inmobi.md) into what the app may do. Whatever the remote answer is, the result is clamped and validated here; an unreachable, invalid or missing answer means
// the safe defaults below: every format OFF. Real ads stay OFF until the owner verifies the integration (mode 'test' by default: InMobi test mode, never real ads).
//
// Identifiers (the owner's, from the InMobi dashboard; they are PLACEMENT ids, not secrets):
//   · App Key 10000256631 (the dashboard's id of the app: NOT used by the SDK, kept here for the record)
//   · Rewarded 10000884972 · Banner 10000884973 · Interstitial 10000884974
// The Account ID that the SDK needs to initialise is NOT any of these (it is the 32-character id of the InMobi account, Settings › Account IDs): the owner has not given it, so it is NOT written here; it is
// delivered by the remote configuration (`accountId`). Without it the SDK is never initialised and no ad is requested.
export const INMOBI = Object.freeze({ appKey: '10000256631', placements: Object.freeze({ rewarded: '10000884972', banner: '10000884973', interstitial: '10000884974' }), sdk: Object.freeze({ android: '11.5.1', ios: '11.5.0' }) });
export const ADS_PROVIDER = 'inmobi';
// 'test' (the default: InMobi test mode, no real ad, no earnings) or 'live' (set only by the remote configuration, after the checks of docs/inmobi.md). 'off' disables everything.
export const ADS_MODE = 'test';
export const FORMATS = Object.freeze(['rewarded', 'banner', 'interstitial']);
export const PLATFORMS = Object.freeze(['android', 'ios']);
// The pages (hash) of the game that may carry a banner: secondary screens only, never the home, a scene, the vote, the night or the weekly report.
export const BANNER_PAGES = Object.freeze(['ricompense', 'notizie', 'archivio', 'impostazioni', 'storico']);
// Interstitials: only when a week is closed, at most one every `everyWeeks` closed weeks, never closer than `minGapMs` to the previous interstitial or to a rewarded video, at most `perDay` a day.
export const INTERSTITIAL = Object.freeze({ everyWeeks: 3, minGapMs: 4 * 60_000, perDay: 4 });
// What the remote configuration may change, and the limits it is held to (a value outside the limits is replaced by the default, never trusted).
export const LIMITS = Object.freeze({ everyWeeks: [1, 52], minGapMs: [60_000, 3_600_000], perDay: [0, 12], rewardPoints: [0, 0.5] });
const DEFAULT_POINTS = 0.15;
const PLACEMENT = /^\d{8,20}$/, ACCOUNT_ID = /^[0-9a-f]{32}$/i;

const off = (platform = 'android') => ({
  platform, provider: ADS_PROVIDER, mode: 'test', testing: true, accountId: null, enabled: false, source: 'default',
  rewarded: { enabled: false, placementId: INMOBI.placements.rewarded }, banner: { enabled: false, placementId: INMOBI.placements.banner }, interstitial: { enabled: false, placementId: INMOBI.placements.interstitial },
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
  const accountId = typeof root.accountId === 'string' && ACCOUNT_ID.test(root.accountId.trim()) ? root.accountId.trim() : null;
  const master = remote.enabled !== false && root.enabled !== false && mode !== 'off' && Boolean(accountId);
  const out = { ...base, mode, testing: mode !== 'live', accountId: master ? accountId : null, source: 'remote' };
  for (const format of FORMATS) {
    const item = pick(format);
    const placementId = typeof item.placementId === 'string' && PLACEMENT.test(item.placementId) ? item.placementId : INMOBI.placements[format];
    out[format] = { enabled: master && flag(item.enabled), placementId };
  }
  const policy = pick('interstitialPolicy');
  out.interstitialPolicy = { everyWeeks: Math.round(clamp(policy.everyWeeks, LIMITS.everyWeeks, INTERSTITIAL.everyWeeks)), minGapMs: Math.round(clamp(policy.minGapMs, LIMITS.minGapMs, INTERSTITIAL.minGapMs)), perDay: Math.round(clamp(policy.perDay, LIMITS.perDay, INTERSTITIAL.perDay)) };
  out.rewardPoints = Math.round(clamp(root.rewardPoints, LIMITS.rewardPoints, DEFAULT_POINTS) * 100) / 100;
  out.enabled = FORMATS.some(format => out[format].enabled);
  return deepFreeze(out);
}
// Kept for the code that still reads the old shape (the rewarded button): enabled only when the rewarded format is on.
export const ADS_CONFIG = Object.freeze({ enabled: false, appId: null, rewardedUnitId: null });
