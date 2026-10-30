// Wires the rewards to the page: the play clock (visibility, foreground, one tab at a time, the career that is open), the journal of the device, the daily reward (the Worker decides for an account, the device
// for a guest) and the rewarded videos. The rules are in core/rewards-engine.js and the store; this file only decides WHEN time is counted and who may claim what.
import { createPlayClock, createStorageLease } from '../core/play-clock.js?v=20261030-1';
import { playProgress, romeDay, rewardHistory } from '../core/rewards-engine.js?v=20261030-1';
import { DAILY_REWARD, PLAY_CLOCK } from '../data/simulation/reward-rules.js?v=20261030-1';
import { rewardsJournal } from '../data/repositories/rewards-journal.js?v=20261030-1';
import { createRewardedAds } from '../data/repositories/ads-rewarded.js?v=20261030-1';

const RETRY_MS = 30000;

export function createRewardsService({ store, journal = rewardsJournal, username = () => null, claimDaily = null, ads = {}, env = {} } = {}) {
  const wall = env.wall ?? (() => Date.now());
  const storage = env.storage ?? globalThis.localStorage;
  const lease = env.lease ?? createStorageLease(storage, { wall });
  const listeners = new Set();
  let adsState = { available: false, reason: null };
  let timer = null, careerId = null, claiming = false, retryAt = 0, sinceSave = 0, lastNotice = 0;
  const rewardedAds = createRewardedAds({ ...ads, grant: id => store.claimAdReward(id) });
  const scope = () => journal.scope(username());
  const playing = () => Boolean(store.hasCareer?.() && store.getState().game && store.getState().game.status !== 'ended' && (env.playing ? env.playing() : true));
  const emit = () => { for (const fn of listeners) { try { fn(); } catch { /* a listener must not stop the clock */ } } };

  // The daily reward: 5 minutes played in the Rome day, counted for the account or the guest across careers and sessions; credited once.
  async function settleDaily(force = false) {
    const day = romeDay(wall()), key = scope();
    const record = journal.daily(key, day);
    if (record.state !== 'counting' && record.state !== 'pending') return;
    if (record.ms < DAILY_REWARD.minutes * 60000 || claiming) return;
    if (record.state === 'pending' && !force && wall() < retryAt) return;
    claiming = true;
    try {
      const id = `giornaliera-${key}-${day}`;
      if (username() && claimDaily) {
        let answer;
        try { answer = await claimDaily(store.getState().career?.id ?? null); }
        catch (error) {
          // offline, the service does not answer or does not know the route: the claim waits and is tried again (nothing is credited without the confirmation, so a day cannot be paid on two devices)
          journal.setDaily(key, day, { state: 'pending', reason: error?.code ?? 'errore' }); retryAt = wall() + RETRY_MS; return;
        }
        if (!answer?.claimed) { journal.setDaily(key, day, { state: 'claimed-elsewhere', claim: null }); return; }
      }
      const entry = store.creditDailyReward({ id, day, at: new Date(wall()).toISOString() });
      journal.setDaily(key, day, { state: 'claimed', claim: { id, at: new Date(wall()).toISOString(), careerId: store.getState().career?.id ?? null, credited: Boolean(entry) } });
    } finally { claiming = false; emit(); }
  }

  const onTime = ms => {
    const state = store.getState();
    if (state.career?.id !== careerId) { careerId = state.career?.id ?? null; store.reconcileRewards?.(); }
    store.addPlayTime(ms, { at: new Date(wall()).toISOString() });
    const day = romeDay(wall()), key = scope();
    journal.addDailyMs(key, day, ms);
    sinceSave += ms;
    settleDaily();
    if (wall() - lastNotice >= 1000) { lastNotice = wall(); emit(); }
  };
  const clock = createPlayClock({ now: env.now, visible: env.visible ?? (() => globalThis.document?.visibilityState !== 'hidden' && (globalThis.document?.hasFocus?.() ?? true)), active: playing, lease, onTime });

  const service = {
    start() {
      if (timer) return;
      const stopCounting = () => { clock.suspend(); };
      globalThis.addEventListener?.('pagehide', stopCounting); globalThis.addEventListener?.('blur', stopCounting);
      globalThis.document?.addEventListener?.('visibilitychange', () => { if (globalThis.document.visibilityState === 'hidden') stopCounting(); });
      timer = setInterval(() => { const state = store.getState(); if (state.career?.id !== careerId) { clock.reset(); careerId = state.career?.id ?? null; } clock.tick(); }, PLAY_CLOCK.tickMs);
      timer.unref?.();
      service.refreshAds();
    },
    stop() { if (timer) clearInterval(timer); timer = null; clock.suspend(); },
    tick: () => clock.tick(), suspend: () => clock.suspend(), clock, lease, journal, ads: rewardedAds,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    settleDaily,
    // What the page shows (nothing about donors or how long the effects of the videos last). The availability of the videos is asked of the provider now and then (refreshAds), not at every draw.
    snapshot() {
      const state = store.getState();
      const day = romeDay(wall()), key = scope();
      const daily = journal.daily(key, day);
      return {
        daily: { amount: DAILY_REWARD.amount, minutes: DAILY_REWARD.minutes, ms: Math.min(daily.ms, DAILY_REWARD.minutes * 60000), state: daily.state, day, guest: !username() },
        play: playProgress(state.game), history: rewardHistory(state.game),
        ads: { ...adsState }, playing: playing()
      };
    },
    async refreshAds() { const availability = await rewardedAds.availability(); adsState = { available: availability.ok, reason: availability.reason }; emit(); return adsState; }
  };
  return service;
}
