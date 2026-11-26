// The advertising policy of the game, apart from the SDK (inmobi-adapter.js) and from the rewards (ads-rewarded.js): WHEN a banner or an interstitial may be shown. Nothing here touches accounts, polls or saves.
//   · Banner: only on the secondary pages of BANNER_PAGES, never during a scene, the vote, the election night, the weekly report, a menu or the first start; hidden everywhere else.
//   · Interstitial: only when the player closes a week (a natural pause), at most one every INTERSTITIAL.everyWeeks closed weeks, never within minGapMs of another interstitial or of a rewarded video, at most perDay a day,
//     and never while an election, a campaign, the night, a scene or a vote is going on.
//   · Rewarded video: always the player's choice (the button of the rewards page); this module only records the time it ended, to keep the interstitials away from it.
import { BANNER_PAGES, INTERSTITIAL } from '../ads-config.js?v=20261125-12';

const KEY = 'politicando.ads.v1';
const dayOf = ms => new Date(ms).toISOString().slice(0, 10);

// Whether the game is in a moment that must never be interrupted. `state` is the state of the store.
export function interruptible(state) {
  if (!state || !state.game) return true;   // no career open (or unknown): never a moment for an ad
  return Boolean(state.night || state.scene || state.campaign || state.vote || state.floor || state.wizard || state.ui?.outcome);
}

export function createAdsManager({ adapter, storage = globalThis.localStorage, now = () => Date.now(), policy = INTERSTITIAL, pages = BANNER_PAGES, bannerMinGapMs = 0, bannerMaxSessionMs = Infinity, bannerOpTimeoutMs = 8_000, bannerRetryMs = 30_000, setTimer = (fn, ms) => globalThis.setTimeout(fn, ms), clearTimer = id => globalThis.clearTimeout(id) } = {}) {
  // Storage availability is PROBED: a storage that throws (private mode, quota, blocked) means the persistent cooldown cannot be trusted, and the safe fallback below applies.
  let storageOk = true;
  const load = () => { try { const data = JSON.parse(storage?.getItem(KEY) ?? 'null'); return data && typeof data === 'object' ? data : {}; } catch { storageOk = false; return {}; } };
  const save = data => { try { storage?.setItem(KEY, JSON.stringify(data)); } catch { storageOk = false; /* no storage: the limits then hold only while the page is open */ } };
  let memory = load();
  if (!storage) storageOk = false;
  const write = patch => { memory = { ...memory, ...patch }; save(memory); };
  const policyNow = () => (typeof policy === 'function' ? policy() : policy) ?? INTERSTITIAL;   // the remote configuration may change the frequency without a new version of the app
  const formatOn = format => Boolean(adapter?.ids?.[format]?.enabled);
  // ---- Banner --------------------------------------------------------------------------------------------------
  // One viewing session never starts within `bannerMinGapMs` of the previous one ending nor runs past `bannerMaxSessionMs`
  // (data/ads-config.js: APPODEAL_BANNER, the only place the two numbers live).
  //   · the end of the last session is PERSISTED (memory.bannerEndedAt): the cooldown survives closing and reopening the app. A session still
  //     open when the app died (memory.bannerOpenAt) is closed at the latest possible moment (never later than now), so a restart can never
  //     shorten the cooldown. A clock set back is clamped to now (the wait is then at most the full cooldown). With no usable storage the
  //     cooldown starts when the manager is created: a restart never gives an immediate banner.
  //   · every adapter call is bounded by `bannerOpTimeoutMs` and can neither throw nor stay pending forever; calls run strictly one after
  //     the other (one chain, which never stays rejected), so two callers can never both show it, and a failed call never blocks the next.
  //   · a failed or timed-out show leaves the banner "not shown" and only backs off `bannerRetryMs` in memory (no impression, no cooldown);
  //     a failed hide is RETRIED on every following check, and nothing is shown again until it has succeeded.
  //   · the maximum length is enforced by its own timer (exact), by every check (render, hashchange, interval, return from background).
  const clampPast = (value, t) => (Number.isFinite(value) && value > 0 ? Math.min(value, t) : 0);
  const boot = now();
  if (memory.bannerOpenAt) { const opened = clampPast(memory.bannerOpenAt, boot); write({ bannerOpenAt: null, bannerEndedAt: Math.min(boot, Math.max(clampPast(memory.bannerEndedAt, boot), opened + (Number.isFinite(bannerMaxSessionMs) ? bannerMaxSessionMs : 0))) }); }
  let bannerEndedAt = clampPast(memory.bannerEndedAt, boot);
  if (!storageOk) bannerEndedAt = Math.max(bannerEndedAt, boot);
  let bannerShown = false, bannerShownAt = 0, hidePending = false, failedAt = 0, timer = null, lastOpts = {};
  const clearExpiry = () => { if (timer !== null) { try { clearTimer(timer); } catch { /* ignored */ } timer = null; } };
  // A bounded, never-throwing adapter call. Resolves { ok, value }: ok is false on a throw, a timeout or an explicit `false` answer of a hide.
  const call = async (fn, ...args) => {
    if (typeof fn !== 'function') return { ok: true, value: undefined };
    let id;
    try {
      const value = await Promise.race([Promise.resolve().then(() => fn.apply(adapter, args)), new Promise((_, reject) => { id = setTimer(() => reject(new Error('timeout')), bannerOpTimeoutMs); })]);
      return { ok: true, value };
    } catch { return { ok: false, value: undefined }; } finally { if (id !== undefined) { try { clearTimer(id); } catch { /* ignored */ } } }
  };
  const ended = t => { clearExpiry(); bannerShown = false; bannerEndedAt = t; write({ bannerOpenAt: null, bannerEndedAt: t }); };
  // Hides it. The session is over either way (the cooldown starts now); when the adapter reports a failure the banner may still be on screen, so a retry is owed.
  const hideNow = async (t, { session = true } = {}) => {
    const out = await call(adapter.hideBanner);
    if (session) ended(t);   // a retry of an owed hide (or the cleanup of a failed show) ends no session: its cooldown, if any, already started
    hidePending = !out.ok || out.value === false;
    return !hidePending;
  };
  const scheduleExpiry = () => {
    clearExpiry();
    if (!bannerShown || !Number.isFinite(bannerMaxSessionMs)) return;
    const left = Math.max(0, bannerShownAt + bannerMaxSessionMs - now());
    try { timer = setTimer(() => { timer = null; enqueue(() => (bannerShown && now() - bannerShownAt < bannerMaxSessionMs ? (scheduleExpiry(), false) : syncBannerNow(lastOpts))); }, left); } catch { timer = null; }
  };
  const syncBannerNow = async ({ page, blocked = false } = {}) => {
    const t = now();
    // reconcile with the adapter: a banner hidden behind our back (the floor overlay hides it directly) ends the session; a stray one that a late answer left up is hidden
    if (bannerShown && adapter?.isBannerShown?.() === false) ended(t);
    if (!bannerShown && !hidePending && adapter?.isBannerShown?.() === true) hidePending = true;
    if (hidePending && !bannerShown) { if (!(await hideNow(t, { session: false }))) return false; if (!formatOn('banner')) return false; }
    if (!formatOn('banner')) { if (bannerShown) await hideNow(t); return false; }
    const wanted = Boolean(page && pages.includes(page) && !blocked);
    if (!wanted) { if (bannerShown) await hideNow(t); return false; }
    if (bannerShown) {
      if (t - bannerShownAt < bannerMaxSessionMs) return true;
      await hideNow(t); return false;   // the maximum length is over: hidden, the cooldown starts now
    }
    if (hidePending) return false;   // never show again while a hide is still owed
    if (bannerEndedAt && t - bannerEndedAt < bannerMinGapMs) return false;   // the cooldown since the last session is not over yet
    if (failedAt && t - failedAt < bannerRetryMs) return false;   // the last attempt failed: no hammering
    const out = await call(adapter.showBanner);   // the adapter resolves a plain boolean, not { shown }
    const after = now();
    if (out.ok && out.value === true) { bannerShown = true; bannerShownAt = after; failedAt = 0; write({ bannerOpenAt: after }); scheduleExpiry(); return true; }
    failedAt = after;
    if (!out.ok || adapter?.isBannerShown?.() === true) hidePending = true;   // an answer that never came may still put it up: it is taken down on the next check
    return false;
  };
  // Calls land here one after the other. The chain NEVER stays rejected: a failure of one link cannot stop the next.
  let bannerChain = Promise.resolve(false);
  const enqueue = task => (bannerChain = bannerChain.then(async () => { try { return await task(); } catch { return false; } }));
  return {
    // Safe to call as often as wanted (every render, every few seconds, a return from the background): it only talks to the adapter when
    // the wanted/shown state changes, when the session has run past its maximum length, or when a hide is owed.
    syncBanner(opts) { lastOpts = opts ?? {}; return enqueue(() => syncBannerNow(lastOpts)); },
    bannerState: () => ({ shown: bannerShown, shownAt: bannerShownAt, endedAt: bannerEndedAt, hidePending, persistent: storageOk }),
    // Called when the player closes a week. Returns true if an interstitial was shown.
    async onWeekClosed(state) {
      if (!formatOn('interstitial') || interruptible(state)) return false;
      const rules = policyNow();
      const t = now(), today = dayOf(t);
      const weeks = (memory.weeks ?? 0) + 1;
      const shownToday = memory.day === today ? (memory.today ?? 0) : 0;
      write({ weeks });
      if (weeks < rules.everyWeeks || shownToday >= rules.perDay) return false;
      if (t - Math.max(memory.lastInterstitial ?? 0, memory.lastRewarded ?? 0) < rules.minGapMs) return false;
      const shown = await adapter.showInterstitial();
      if (shown) write({ weeks: 0, lastInterstitial: t, day: today, today: shownToday + 1 });
      return shown;
    },
    noteRewarded() { write({ lastRewarded: now() }); },
    stats: () => ({ ...memory })
  };
}
