// The clock of the time really played (not the calendar of the simulation): it counts only while a career is open, the page is visible and in the foreground and this tab holds the lease, and it measures
// with a monotonic clock (performance.now()) so that a change of the system time, a pause of the page or a sleeping machine can neither give nor take time. Pure of the page: everything it needs is given.
// Two tabs never count the same time: the lease (one holder at a time, renewed every tick, lost when the tab stops being in the foreground or closes) says which one does.
import { PLAY_CLOCK } from '../data/simulation/reward-rules.js?v=20261031-2';

// The lease of the playing tab, kept in a storage shared by the tabs of the browser (localStorage). `wall` is the wall clock (the tabs of one browser agree on it, the monotonic clocks do not).
export function createStorageLease(storage, { tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, wall = () => Date.now(), key = 'politicando.rewards.lease', leaseMs = PLAY_CLOCK.leaseMs } = {}) {
  const read = () => { try { const value = JSON.parse(storage?.getItem?.(key) ?? 'null'); return value && typeof value.tab === 'string' ? value : null; } catch { return null; } };
  const mine = () => read()?.tab === tabId;
  return {
    tabId,
    // True when this tab holds (or has just taken) the lease: nobody else holds a valid one.
    hold() {
      const current = read();
      if (current && current.tab !== tabId && current.until > wall()) return false;
      try { storage?.setItem?.(key, JSON.stringify({ tab: tabId, until: wall() + leaseMs })); } catch { return true; }
      return mine();
    },
    release() { if (mine()) { try { storage?.removeItem?.(key); } catch { /* it expires by itself */ } } },
    holder() { const current = read(); return current && current.until > wall() ? current.tab : null; }
  };
}

// now(): monotonic milliseconds. visible(): the page is visible and in the foreground. active(): a career is open and the session is going on. lease: { hold(), release() }. onTime(ms): the time to count.
export function createPlayClock({ now = () => globalThis.performance?.now?.() ?? Date.now(), visible = () => true, active = () => true, lease = { hold: () => true, release() {} }, onTime = () => {}, maxGapMs = PLAY_CLOCK.maxGapMs } = {}) {
  let last = null;
  const stop = () => { last = null; };
  return {
    // One tick (the page calls it every second). Returns the milliseconds counted.
    tick() {
      const t = now();
      const gap = last === null ? null : t - last;
      last = t;
      if (!active() || !visible()) { lease.release?.(); last = null; return 0; }
      if (!lease.hold()) { return 0; }
      // The first tick after a stop, and a gap longer than a tick can be (the page was frozen, the machine slept), count nothing: time is only counted that was seen passing.
      if (gap === null || gap < 0 || gap > maxGapMs) return 0;
      onTime(gap);
      return gap;
    },
    // The page left the foreground, was hidden, closed, or the career changed: the next tick starts again from nothing.
    suspend() { lease.release?.(); stop(); },
    reset: stop
  };
}
