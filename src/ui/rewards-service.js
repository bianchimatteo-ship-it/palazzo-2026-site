// Wires the rewards to the page: the play clock (visibility, foreground, one tab at a time, the career that is open), the journal of the device, the daily reward (the Worker decides for an account, the device
// for a guest) and the rewarded videos. The rules are in core/rewards-engine.js and the store; this file only decides WHEN time is counted and who may claim what.
import { createPlayClock, createStorageLease } from '../core/play-clock.js?v=20261031-1';
import { normalizeRewards, playProgress, romeDay, rewardHistory } from '../core/rewards-engine.js?v=20261031-1';
import { DAILY_REWARD, PLAY_CLOCK } from '../data/simulation/reward-rules.js?v=20261031-1';
import { rewardsJournal } from '../data/repositories/rewards-journal.js?v=20261031-1';
import { createRewardedAds } from '../data/repositories/ads-rewarded.js?v=20261031-1';

const RETRY_MS = 30000;

export function createRewardsService({ store, journal = rewardsJournal, username = () => null, claimDaily = null, syncTime = null, ads = {}, env = {} } = {}) {
  const wall = env.wall ?? (() => Date.now());
  const storage = env.storage ?? globalThis.localStorage;
  const lease = env.lease ?? createStorageLease(storage, { wall });
  const listeners = new Set();
  let adsState = { available: false, reason: null };
  let timer = null, careerId = null, claiming = false, inflight = null, retryAt = 0, lastNotice = 0, lastSync = 0;
  const rewardedAds = createRewardedAds({ ...ads, grant: id => store.claimAdReward(id) });
  const scope = () => journal.scope(username());
  const playing = () => Boolean(store.hasCareer?.() && store.getState().game && store.getState().game.status !== 'ended' && (env.playing ? env.playing() : true));
  const emit = () => { for (const fn of listeners) { try { fn(); } catch { /* a listener must not stop the clock */ } } };

  // The time of an account is kept by the Worker apart from the saves: the spans counted here go there in batches, and what comes back (the union of all the devices) brings in the minutes played elsewhere.
  // Local figure = what the Worker holds + what is not sent yet, so that nothing is counted twice and nothing is lost. Guests have only the journal of the device.
  async function send() {
    const user = username();
    if (!user || !syncTime) return false;
    lastSync = wall();
    const key = scope(), day = romeDay(wall()), state = store.getState(), current = state.career?.id ?? null;
    const spans = journal.queueTake(key);
    const now = wall();
    const sent = spans.filter(span => span.c === current).reduce((sum, span) => sum + span.e - span.s, 0);
    const body = { device: journal.deviceId(), spans: spans.map(span => ({ c: span.c, a: now - span.s, b: now - span.e })), ...(current && state.game ? { career: { id: current, baseMs: Math.max(0, normalizeRewards(state.game.rewards).playMs - sent) } } : {}) };
    let answer;
    try { answer = await syncTime(body); }
    catch { journal.queueRestore(key, spans); return false; }
    if (!answer?.ok) { journal.queueRestore(key, spans); return false; }
    if (answer.day === day && Number.isFinite(answer.dayMs)) journal.setDaily(key, day, { ms: Math.max(journal.daily(key, day).ms, answer.dayMs + journal.queuedMs(key)) });
    const total = answer.careers?.[current];
    if (current && Number.isFinite(total) && store.getState().career?.id === current) {
      const missing = total + journal.queuedMs(key, current) - normalizeRewards(store.getState().game?.rewards).playMs;
      if (missing > 0) store.addPlayTime(missing, { at: new Date(wall()).toISOString() });
    }
    emit();
    return true;
  }

  // One request at a time (a call made while another is on its way waits for it; what was counted meanwhile goes with the next).
  const sync = () => (inflight ??= send().finally(() => { inflight = null; }));

  // Credits the reward to the career that is open now. With no career open (or a game that cannot take it) the reward is OWED: it stays in the journal and is credited at the first moment a career is playing.
  function credit(key, day, id, origin) {
    const at = new Date(wall()).toISOString();
    const entry = playing() ? store.creditDailyReward({ id, day, at }) : null;
    const done = Boolean(entry) || Boolean(playing() && store.getState().game?.rewards?.daily?.includes(id));
    journal.setDaily(key, day, done ? { state: 'claimed', claim: { id, at, careerId: store.getState().career?.id ?? origin, credited: Boolean(entry) } } : { state: 'owed', claim: { id, at, careerId: origin } });
    return done;
  }

  // The daily reward: 5 minutes played in the Rome day, counted for the account or the guest across careers, sessions and devices; credited once.
  // For an account the Worker checks the minutes it holds and takes the claim in one atomic step; whatever it answers, a claim it gave to this device is never lost.
  async function settleDaily(force = false) {
    const day = romeDay(wall()), key = scope();
    const record = journal.daily(key, day);
    if (claiming || !['counting', 'pending', 'owed'].includes(record.state)) return;
    const id = `giornaliera-${key}-${day}`;
    if (record.state === 'owed') { if (playing()) { credit(key, day, id, record.claim?.careerId ?? null); emit(); } return; }
    if (record.ms < DAILY_REWARD.minutes * 60000) return;
    if (!force && wall() < retryAt) return;
    claiming = true;
    const origin = store.getState().career?.id ?? null;
    try {
      if (username() && claimDaily) {
        let answer;
        try {
          await sync();
          answer = await claimDaily(origin, journal.deviceId());
        } catch (error) {
          // offline, the service does not answer or does not know the route: the claim waits and is tried again (nothing is credited without the confirmation, so a day cannot be paid on two devices)
          journal.setDaily(key, day, { state: 'pending', reason: error?.code ?? 'errore' }); retryAt = wall() + RETRY_MS; return;
        }
        if (answer?.short) { journal.setDaily(key, day, { state: 'counting', ms: Math.max(journal.daily(key, day).ms, answer.dayMs ?? 0) }); retryAt = wall() + RETRY_MS; return; }
        if (!answer?.claimed && !answer?.mine) { journal.setDaily(key, day, { state: 'claimed-elsewhere', claim: null }); return; }
      }
      credit(key, day, id, origin);
    } finally { claiming = false; emit(); }
  }

  const onTime = ms => {
    const state = store.getState();
    if (state.career?.id !== careerId) { careerId = state.career?.id ?? null; store.reconcileRewards?.(); }
    store.addPlayTime(ms, { at: new Date(wall()).toISOString() });
    const day = romeDay(wall()), key = scope();
    journal.addDailyMs(key, day, ms);
    if (username() && careerId) { journal.queueAdd(key, careerId, wall() - ms, wall()); if (wall() - lastSync >= PLAY_CLOCK.syncEveryMs) sync(); }
    settleDaily();
    if (wall() - lastNotice >= 1000) { lastNotice = wall(); emit(); }
  };
  const clock = createPlayClock({ now: env.now, visible: env.visible ?? (() => globalThis.document?.visibilityState !== 'hidden' && (globalThis.document?.hasFocus?.() ?? true)), active: playing, lease, onTime });

  const service = {
    start() {
      if (timer) return;
      const stopCounting = () => { clock.suspend(); sync(); };
      globalThis.addEventListener?.('pagehide', stopCounting); globalThis.addEventListener?.('blur', stopCounting);
      globalThis.document?.addEventListener?.('visibilitychange', () => { if (globalThis.document.visibilityState === 'hidden') stopCounting(); });
      timer = setInterval(() => { const state = store.getState(); if (state.career?.id !== careerId) { clock.reset(); careerId = state.career?.id ?? null; sync(); } clock.tick(); }, PLAY_CLOCK.tickMs);
      timer.unref?.();
      sync(); service.refreshAds();
    },
    stop() { if (timer) clearInterval(timer); timer = null; clock.suspend(); },
    tick: () => clock.tick(), suspend: () => clock.suspend(), clock, lease, journal, ads: rewardedAds,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    settleDaily, sync, idle: () => Promise.all([inflight]).then(() => undefined),
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
