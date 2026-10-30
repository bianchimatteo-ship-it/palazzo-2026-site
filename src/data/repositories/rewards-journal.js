// What this device remembers of the rewards, apart from the saves: the real time played in each career, the daily reward of each account (or of the local guest), the credits that were handed to a career and
// the videos already completed. It is small, written at once and never tied to the autosave preferences of the player (a manual save must not be forced by a timer): the game state carries the same
// counters and ids, and when a career is loaded the two are reconciled (rewards-engine.js), so that a reward that was credited in memory and never saved comes back, and one that was saved is never paid twice.
// Nothing here goes to the account except the claim of the daily reward (the Worker decides who got it first); the journal is per device.
const KEY = 'politicando.rewards.v1';
const KEEP_DAYS = 45;

export function createRewardsJournal(storage = globalThis.localStorage) {
  let memory = null;
  const blank = () => ({ v: 1, guestId: null, careers: {}, accounts: {}, ads: {} });
  const read = () => {
    try { const raw = storage?.getItem?.(KEY); if (raw) { const data = JSON.parse(raw); if (data && data.v === 1) return { ...blank(), ...data }; } } catch { /* unreadable: the memory copy goes on */ }
    return memory ?? blank();
  };
  const write = data => { memory = data; try { storage?.setItem?.(KEY, JSON.stringify(data)); } catch { /* no room or private mode: the copy stays in memory for this page */ } return data; };
  const edit = change => { const data = read(); const result = change(data); write(data); return result; };
  const randomId = () => { try { return globalThis.crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; } };
  const careerOf = (data, careerId) => (data.careers[careerId] ??= { playMs: 0, updatedAt: null, daily: [], ads: [] });
  return {
    // A persistent local identity for guests (it stays on this device until the browser data are cleared).
    guestId() { return edit(data => (data.guestId ??= randomId())); },
    scope(username = null) { return username ? `a:${String(username).toLowerCase()}` : `g:${this.guestId()}`; },
    // ----- the daily reward of an account or guest -----
    daily(scope, day) { const record = read().accounts[scope]; return record?.day === day ? { ...record } : { day, ms: 0, state: 'counting', claim: null }; },
    addDailyMs(scope, day, ms) { return edit(data => { const record = data.accounts[scope]?.day === day ? data.accounts[scope] : (data.accounts[scope] = { day, ms: 0, state: 'counting', claim: null }); record.ms += Math.max(0, Math.floor(ms)); return { ...record }; }); },
    setDaily(scope, day, patch) { return edit(data => { const record = data.accounts[scope]?.day === day ? data.accounts[scope] : (data.accounts[scope] = { day, ms: 0, state: 'counting', claim: null }); Object.assign(record, patch); return { ...record }; }); },
    // ----- a career -----
    career(careerId) { const record = read().careers[careerId]; return record ? { ...record, daily: [...(record.daily ?? [])], ads: [...(record.ads ?? [])] } : { playMs: 0, updatedAt: null, daily: [], ads: [] }; },
    addCareerMs(careerId, ms, at = new Date().toISOString()) { return edit(data => { const record = careerOf(data, careerId); record.playMs += Math.max(0, Math.floor(ms)); record.updatedAt = at; return record.playMs; }); },
    setCareerMs(careerId, playMs) { return edit(data => { const record = careerOf(data, careerId); if (playMs > record.playMs) record.playMs = Math.floor(playMs); return record.playMs; }); },
    recordDailyCredit(careerId, entry) { return edit(data => { const record = careerOf(data, careerId); if (!record.daily.some(item => item.id === entry.id)) record.daily = [...record.daily, { id: entry.id, day: entry.day, at: entry.at }].slice(-60); }); },
    recordAd(careerId, entry) { return edit(data => { const record = careerOf(data, careerId); if (!record.ads.some(item => item.id === entry.id)) record.ads = [...record.ads, { id: entry.id, at: entry.at }].slice(-60); }); },
    // ----- the videos already completed on this device (a completion is paid once) -----
    adSeen(id) { return Boolean(read().ads[id]); },
    adRemember(id, at = new Date().toISOString()) { return edit(data => { if (data.ads[id]) return false; data.ads[id] = at; const cut = Date.now() - KEEP_DAYS * 86400000; for (const [key, value] of Object.entries(data.ads)) if (Date.parse(value) < cut) delete data.ads[key]; return true; }); },
    snapshot() { return JSON.parse(JSON.stringify(read())); },
    clear() { memory = null; try { storage?.removeItem?.(KEY); } catch { /* nothing to clear */ } }
  };
}
export const rewardsJournal = createRewardsJournal();
