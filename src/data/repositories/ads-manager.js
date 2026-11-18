// The advertising policy of the game, apart from the SDK (admob-adapter.js) and from the rewards (ads-rewarded.js): WHEN a banner or an interstitial may be shown. Nothing here touches accounts, polls or saves.
//   · Banner: only on the secondary pages of BANNER_PAGES, never during a scene, the vote, the election night, the weekly report, a menu or the first start; hidden everywhere else.
//   · Interstitial: only when the player closes a week (a natural pause), at most one every INTERSTITIAL.everyWeeks closed weeks, never within minGapMs of another interstitial or of a rewarded video, at most perDay a day,
//     and never while an election, a campaign, the night, a scene or a vote is going on.
//   · Rewarded video: always the player's choice (the button of the rewards page); this module only records the time it ended, to keep the interstitials away from it.
import { BANNER_PAGES, INTERSTITIAL } from '../ads-config.js?v=20261118-4';

const KEY = 'politicando.ads.v1';
const dayOf = ms => new Date(ms).toISOString().slice(0, 10);

// Whether the game is in a moment that must never be interrupted. `state` is the state of the store.
export function interruptible(state) {
  if (!state || !state.game) return true;   // no career open (or unknown): never a moment for an ad
  return Boolean(state.night || state.scene || state.campaign || state.vote || state.floor || state.wizard || state.ui?.outcome);
}

export function createAdsManager({ adapter, storage = globalThis.localStorage, now = () => Date.now(), policy = INTERSTITIAL, pages = BANNER_PAGES } = {}) {
  const load = () => { try { const data = JSON.parse(storage?.getItem(KEY) ?? 'null'); return data && typeof data === 'object' ? data : {}; } catch { return {}; } };
  const save = data => { try { storage?.setItem(KEY, JSON.stringify(data)); } catch { /* no storage: the limits then hold only while the page is open */ } };
  let memory = load();
  const write = patch => { memory = { ...memory, ...patch }; save(memory); };
  const adsOn = () => Boolean(adapter?.ids?.enabled);
  return {
    // The banner follows the page: shown on a secondary page when nothing else is going on, hidden otherwise. Safe to call at every change of page.
    async syncBanner({ page, blocked = false, margin = 0 } = {}) {
      if (!adsOn()) return false;
      const wanted = Boolean(page && pages.includes(page) && !blocked);
      if (wanted) return adapter.showBanner({ margin });
      await adapter.hideBanner(); return false;
    },
    // Called when the player closes a week. Returns true if an interstitial was shown.
    async onWeekClosed(state) {
      if (!adsOn() || interruptible(state)) return false;
      const t = now(), today = dayOf(t);
      const weeks = (memory.weeks ?? 0) + 1;
      const shownToday = memory.day === today ? (memory.today ?? 0) : 0;
      write({ weeks });
      if (weeks < policy.everyWeeks || shownToday >= policy.perDay) return false;
      if (t - Math.max(memory.lastInterstitial ?? 0, memory.lastRewarded ?? 0) < policy.minGapMs) return false;
      const shown = await adapter.showInterstitial();
      if (shown) write({ weeks: 0, lastInterstitial: t, day: today, today: shownToday + 1 });
      return shown;
    },
    noteRewarded() { write({ lastRewarded: now() }); },
    stats: () => ({ ...memory })
  };
}
