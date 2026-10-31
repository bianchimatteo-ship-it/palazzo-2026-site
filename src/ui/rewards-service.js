// Wires the rewards to the page: the play clock (visibility, foreground, one tab at a time, the career that is open), the journal of the device, the time of an account (kept by the Worker, merged across devices),
// the daily reward and the one-off community reward (the Worker decides for an account, the device for a guest), the notices the player is shown and the rewarded videos. The rules are in core/rewards-engine.js and the store;
// this file only decides WHEN time is counted, what is sent to the Worker and who may claim what.
import { createPlayClock, createStorageLease } from '../core/play-clock.js?v=20261031-3';
import { normalizeRewards, playProgress, romeDay, rewardHistory } from '../core/rewards-engine.js?v=20261031-3';
import { COMMUNITY_REWARD, DAILY_REWARD, PLAY_CLOCK, PLAY_REWARDS } from '../data/simulation/reward-rules.js?v=20261031-3';
import { rewardsJournal } from '../data/repositories/rewards-journal.js?v=20261031-3';
import { createRewardedAds } from '../data/repositories/ads-rewarded.js?v=20261031-3';

const RETRY_MS = 30000;
const BLOCK_KINDS = { capitale: PLAY_REWARDS.capital.everyMinutes, preparazione: PLAY_REWARDS.preparation.everyMinutes };
const NOTICE_KINDS = new Set(['giornaliera', 'capitale', 'preparazione', 'community']);

export function createRewardsService({ store, journal = rewardsJournal, username = () => null, claimDaily = null, syncTime = null, claimBlocks = null, claimCommunity = null, community = {}, ads = {}, env = {} } = {}) {
  const wall = env.wall ?? (() => Date.now());
  const storage = env.storage ?? globalThis.localStorage;
  const lease = env.lease ?? createStorageLease(storage, { wall });
  const listeners = new Set();
  let adsState = { available: false, reason: null };
  let noTimeRoute = false, timer = null, careerId = null, claiming = false, claimingCommunity = false, inflight = null, retryAt = 0, lastNotice = 0, lastSync = 0, unlisten = null;
  const communityRetry = {};
  const rewardedAds = createRewardedAds({ ...ads, grant: id => store.claimAdReward(id) });
  const scope = () => journal.scope(username());
  const playing = () => Boolean(store.hasCareer?.() && store.getState().game && store.getState().game.status !== 'ended' && (env.playing ? env.playing() : true));
  const emit = () => { for (const fn of listeners) { try { fn(); } catch { /* a listener must not stop the clock */ } } };

  // ---------- the time of an account ----------
  // The spans counted here go to the Worker in requests of at most SPANS_PER_REQUEST; each one leaves the queue only when the Worker says it applied it (or refused it for good: it is then written to the log of what was lost).
  // What the Worker did not examine, and everything after a failed request, stays queued and goes again, in the same request or the next: nothing is lost silently and, as the Worker remembers the numbers it applied, nothing is counted twice.
  // Local figure = what the Worker holds + what is not delivered yet, so that nothing is counted twice and nothing is lost. Guests have only the journal of the device.
  const SPANS_PER_REQUEST = 50, ROUNDS = 40;
  async function send() {
    const user = username();
    if (!user || !syncTime) return false;
    lastSync = wall();
    const key = scope(), device = journal.deviceId();
    for (let round = 0; round < ROUNDS; round++) {
      const day = romeDay(wall()), state = store.getState(), current = state.career?.id ?? null;
      const chunk = journal.queuePeek(key, SPANS_PER_REQUEST);
      const body = { device, now: wall(), spans: chunk.map(({ q, c, s, e }) => ({ q, c, s, e })), ...(current && state.game ? { career: { id: current, baseMs: Math.max(0, normalizeRewards(state.game.rewards).playMs - journal.queuedMs(key, current)) } } : {}) };
      let answer;
      try { answer = await syncTime(body); } catch (error) { if (error?.status === 404 || error?.status === 405) noTimeRoute = true; return false; }
      if (!answer?.ok) return false;
      const acked = Array.isArray(answer.acked) ? answer.acked : [], rejected = Array.isArray(answer.rejected) ? answer.rejected : [];
      journal.queueAck(key, acked, rejected);
      if (answer.day === day && Number.isFinite(answer.dayMs)) journal.setDaily(key, day, { ms: Math.max(journal.daily(key, day).ms, answer.dayMs + journal.queuedMs(key, null, span => romeDay(span.e) === day)) });
      const total = answer.careers?.[current];
      if (current && Number.isFinite(total) && store.getState().career?.id === current) store.confirmPlayTime(total, journal.queuedMs(key, current), { at: new Date(wall()).toISOString() });
      if (!chunk.length || acked.length + rejected.length === 0 || !journal.queued(key).length) break;
    }
    await sendBlocks();
    emit();
    return true;
  }
  // One request at a time (a call made while another is on its way waits for it; what was counted meanwhile goes with the next).
  const sync = () => (inflight ??= send().finally(() => { inflight = null; }));

  // The blocks of 30/60 minutes credited here are confirmed to the Worker, which records each one once for the account and career (and checks that its merged time reaches it). A confirmation that fails stays and is tried again.
  async function sendBlocks() {
    const user = username();
    if (!user || !claimBlocks) return;
    const key = scope(), pending = journal.blocks(key);
    for (const career of [...new Set(pending.map(item => item.career))]) {
      const claims = pending.filter(item => item.career === career).map(({ kind, n }) => ({ kind, n }));
      let answer; try { answer = await claimBlocks({ careerId: career, device: journal.deviceId(), claims }); } catch { continue; }
      for (const result of answer?.results ?? []) if (result.status !== 'short') journal.blockDone(key, { career, kind: result.kind, n: result.n });
    }
  }

  // ---------- the notices ----------
  // Every credit that actually happened becomes a notice that stays on the device until the player dismisses it (a refresh does not lose it); the page shows them one after the other.
  function onCredit(entry, creditedCareer) {
    if (NOTICE_KINDS.has(entry.kind)) journal.noticeAdd({ id: entry.id, kind: entry.kind, at: entry.at, requested: entry.requested, amount: entry.amount, resource: entry.resource, minutes: entry.minutes ?? null, reward: entry.reward ?? null });
    const everyMinutes = BLOCK_KINDS[entry.kind];
    if (everyMinutes && username() && Number.isFinite(entry.minutes)) journal.blockAdd(scope(), { career: creditedCareer, kind: entry.kind, n: Math.round(entry.minutes / everyMinutes) });
    emit();
  }

  // Credits the daily reward to the career that is open now. With no career open (or a game that cannot take it) the reward is OWED: it stays in the journal and is credited at the first moment a career is playing.
  function credit(key, day, id, origin) {
    const at = new Date(wall()).toISOString();
    const entry = playing() ? store.creditDailyReward({ id, day, at }) : null;
    const done = Boolean(entry) || Boolean(playing() && store.getState().game?.rewards?.daily?.includes(id));
    journal.setDaily(key, day, done ? { state: 'claimed', claim: { id, at, careerId: store.getState().career?.id ?? origin, credited: Boolean(entry) } } : { state: 'owed', claim: { id, at, careerId: origin } });
    return done;
  }

  // ---------- the daily reward ----------
  // 5 minutes played in the Rome day, counted for the account or the guest across careers, sessions and devices; credited once.
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

  // ---------- the community reward (Instagram): a self-declaration, once for each account (for each device, for a guest) ----------
  const communityOn = id => Boolean(community[id] ?? COMMUNITY_REWARD[id]?.enabled);
  const communityId = (id, key) => `comunita-${id}-${key}`;
  // The player went to the profile (the page opened the link): from now the claim button is there. Nothing is checked on the social network.
  function visitCommunity(id) {
    if (!communityOn(id)) return false;
    const key = scope(), record = journal.community(key, id);
    if (record.state === 'idle') journal.setCommunity(key, id, { state: 'visited', visitedAt: new Date(wall()).toISOString() });
    emit(); return true;
  }
  async function settleCommunity(id, force = false) {
    const key = scope(), spec = COMMUNITY_REWARD[id], record = journal.community(key, id);
    if (!spec || !communityOn(id) || claimingCommunity || !['claiming', 'pending', 'owed'].includes(record.state)) return { ok: false, state: record.state };
    const claimId = communityId(id, key), origin = store.getState().career?.id ?? null;
    const settle = () => {
      const at = new Date(wall()).toISOString();
      const entries = playing() ? store.creditCommunityReward(spec, { id: claimId, at }) : null;
      const ok = Boolean(entries) || Boolean(playing() && store.getState().game?.rewards?.community?.includes(claimId));
      journal.setCommunity(key, id, ok ? { state: 'claimed', claim: { id: claimId, at, careerId: store.getState().career?.id ?? origin } } : { state: 'owed', claim: { id: claimId, at, careerId: origin } });
      return ok;
    };
    if (record.state === 'owed') { if (playing()) settle(); emit(); return { ok: true, state: journal.community(key, id).state }; }
    if (!force && wall() < (communityRetry[id] ?? 0)) return { ok: false, state: record.state };
    claimingCommunity = true;
    try {
      if (username() && claimCommunity) {
        let answer;
        try { answer = await claimCommunity(id, origin, journal.deviceId()); }
        catch (error) { journal.setCommunity(key, id, { state: 'pending', reason: error?.code ?? 'errore' }); communityRetry[id] = wall() + RETRY_MS; return { ok: false, state: 'pending' }; }
        if (!answer?.claimed && !answer?.mine) { journal.setCommunity(key, id, { state: 'claimed-elsewhere', claim: null }); return { ok: false, state: 'claimed-elsewhere' }; }
      }
      settle();
      return { ok: true, state: journal.community(key, id).state };
    } finally { claimingCommunity = false; emit(); }
  }
  // «Ho seguito, riscuoti»: needs the profile to have been opened from the page, a career to credit and the reward to be on.
  async function claimCommunityReward(id) {
    const key = scope(), record = journal.community(key, id);
    if (!communityOn(id)) return { ok: false, reason: 'non-attiva' };
    if (!playing()) return { ok: false, reason: 'senza-carriera' };
    if (record.state === 'claimed' || record.state === 'claimed-elsewhere') return { ok: false, reason: 'già-riscossa' };
    if (record.state === 'idle') return { ok: false, reason: 'non-visitato' };
    if (record.state === 'visited') journal.setCommunity(key, id, { state: 'claiming' });
    return settleCommunity(id, true);
  }

  // With an account and a Worker that merges the time, the blocks are credited from the Worker's confirmation; a Worker that does not know the route (404/405) leaves the device's own count in charge.
  const authoritative = () => Boolean(username() && syncTime && !noTimeRoute);
  const onTime = ms => {
    store.setRewardsAuthoritative?.(authoritative());
    const state = store.getState();
    if (state.career?.id !== careerId) { careerId = state.career?.id ?? null; store.reconcileRewards?.(); }
    store.addPlayTime(ms, { at: new Date(wall()).toISOString() });
    const day = romeDay(wall()), key = scope();
    journal.addDailyMs(key, day, ms);
    if (username() && careerId) { journal.queueAdd(key, careerId, wall() - ms, wall()); if (wall() - lastSync >= PLAY_CLOCK.syncEveryMs) sync(); }
    settleDaily();
    for (const id of Object.keys(COMMUNITY_REWARD)) settleCommunity(id);
    if (wall() - lastNotice >= 1000) { lastNotice = wall(); emit(); }
  };
  const clock = createPlayClock({ now: env.now, visible: env.visible ?? (() => globalThis.document?.visibilityState !== 'hidden' && (globalThis.document?.hasFocus?.() ?? true)), active: playing, lease, onTime });

  const service = {
    // Starts listening to the credits (notices and block confirmations). start() does it; tests that drive the clock by hand call it themselves.
    listen() { store.setRewardsAuthoritative?.(authoritative()); if (!unlisten) unlisten = store.onRewardCredit?.(onCredit) ?? null; },
    unlisten() { unlisten?.(); unlisten = null; },
    start() {
      if (timer) return;
      service.listen();
      const stopCounting = () => { clock.suspend(); sync(); };
      globalThis.addEventListener?.('pagehide', stopCounting); globalThis.addEventListener?.('blur', stopCounting);
      globalThis.document?.addEventListener?.('visibilitychange', () => { if (globalThis.document.visibilityState === 'hidden') stopCounting(); });
      timer = setInterval(() => { const state = store.getState(); if (state.career?.id !== careerId) { clock.reset(); careerId = state.career?.id ?? null; sync(); } clock.tick(); }, PLAY_CLOCK.tickMs);
      timer.unref?.();
      sync(); service.refreshAds();
    },
    stop() { if (timer) clearInterval(timer); timer = null; clock.suspend(); unlisten?.(); unlisten = null; },
    tick: () => clock.tick(), suspend: () => clock.suspend(), clock, lease, journal, ads: rewardedAds,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    settleDaily, sync, idle: () => Promise.all([inflight]).then(() => undefined),
    visitCommunity, claimCommunity: claimCommunityReward, settleCommunity,
    // The notices still to show, oldest first (one dismissal each), so that several credits in a row never overwrite each other.
    notices: () => journal.notices(),
    dismissNotice(id) { journal.noticeDismiss(id); emit(); },
    // What the page shows (nothing about donors or how long the effects of the videos last). The availability of the videos is asked of the provider now and then (refreshAds), not at every draw.
    snapshot() {
      const state = store.getState();
      const day = romeDay(wall()), key = scope();
      const daily = journal.daily(key, day);
      const spec = COMMUNITY_REWARD.instagram, instagram = journal.community(key, 'instagram');
      return {
        daily: { amount: DAILY_REWARD.amount, minutes: DAILY_REWARD.minutes, ms: Math.min(daily.ms, DAILY_REWARD.minutes * 60000), state: daily.state, day, guest: !username() },
        play: playProgress(state.game), history: rewardHistory(state.game),
        community: { instagram: { enabled: communityOn('instagram'), url: spec.url, funds: spec.funds, capital: spec.capital, state: instagram.state, guest: !username() } },
        lost: username() ? journal.lost(key) : { ms: 0, log: [] },
        ads: { ...adsState }, playing: playing()
      };
    },
    async refreshAds() { const availability = await rewardedAds.availability(); adsState = { available: availability.ok, reason: availability.reason }; emit(); return adsState; }
  };
  return service;
}
