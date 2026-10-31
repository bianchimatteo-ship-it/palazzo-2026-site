// What this device remembers of the rewards, apart from the saves: the real time played in each career, the daily reward of each account (or of the local guest), the credits that were handed to a career and
// the videos already completed. It is small, written at once and never tied to the autosave preferences of the player (a manual save must not be forced by a timer): the game state carries the same
// counters and ids, and when a career is loaded the two are reconciled (rewards-engine.js), so that a reward that was credited in memory and never saved comes back, and one that was saved is never paid twice.
// Nothing here goes to the account except the claim of the daily reward (the Worker decides who got it first); the journal is per device.
const KEY = 'politicando.rewards.v1';
const KEEP_DAYS = 45;
const SPAN_JOIN_MS = 10 * 60000;   // a span is closed after ten minutes: the Worker takes spans of a few hours at most and the requests carry many of them
const QUEUE_MAX = 5000;            // about 800 hours of play not yet delivered; beyond it the oldest is written to the log of what was lost
const LOST_LOG = 50;
const logLost = (queue, span, reason) => { queue.lostMs += Math.max(0, span.e - span.s); queue.lost = [{ q: span.q, c: span.c, ms: span.e - span.s, reason, at: new Date().toISOString() }, ...queue.lost].slice(0, LOST_LOG); };
// The queue of one scope: { next, spans, lostMs, lost }. (The first version kept a plain list of spans without numbers: it is read as spans numbered in order.)
function queueOf(data, scope) {
  const bag = (data.queue ??= {});
  let queue = bag[scope];
  if (Array.isArray(queue)) queue = bag[scope] = { next: 0, spans: queue.map((span, index) => ({ q: index, c: span.c, s: span.s, e: span.e })), lostMs: 0, lost: [] };
  if (queue) { queue.spans ??= []; queue.lost ??= []; queue.lostMs ??= 0; queue.next ??= queue.spans.reduce((top, span) => Math.max(top, span.q + 1), 0); return queue; }
  return (bag[scope] = { next: 0, spans: [], lostMs: 0, lost: [] });
}

export function createRewardsJournal(storage = globalThis.localStorage) {
  let memory = null;
  const blank = () => ({ v: 1, guestId: null, deviceId: null, careers: {}, accounts: {}, ads: {}, queue: {}, blocks: {}, notices: [], community: {} });
  const read = () => {
    try { const raw = storage?.getItem?.(KEY); if (raw) { const data = JSON.parse(raw); if (data && data.v === 1) return { ...blank(), ...data }; } } catch { /* unreadable: the memory copy goes on */ }
    return memory ?? blank();
  };
  const write = data => { memory = data; try { storage?.setItem?.(KEY, JSON.stringify(data)); } catch { /* no room or private mode: the copy stays in memory for this page */ } return data; };
  const edit = change => { const data = read(); const result = change(data); write(data); return result; };
  const randomId = () => { try { return globalThis.crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; } };
  const careerOf = (data, careerId) => { const record = (data.careers[careerId] ??= { playMs: 0, updatedAt: null, daily: [], ads: [] }); record.community ??= []; return record; };
  return {
    // A persistent local identity for guests (it stays on this device until the browser data are cleared).
    guestId() { return edit(data => (data.guestId ??= randomId())); },
    // A persistent identity of this device, sent with the time and the claim of an account (so that the Worker can tell that a claim was this device's).
    deviceId() { return edit(data => (data.deviceId ??= randomId())); },
    scope(username = null) { return username ? `a:${String(username).toLowerCase()}` : `g:${this.guestId()}`; },
    // ----- the daily reward of an account or guest -----
    daily(scope, day) { const record = read().accounts[scope]; return record?.day === day ? { ...record } : { day, ms: 0, state: 'counting', claim: null }; },
    addDailyMs(scope, day, ms) { return edit(data => { const record = data.accounts[scope]?.day === day ? data.accounts[scope] : (data.accounts[scope] = { day, ms: 0, state: 'counting', claim: null }); record.ms += Math.max(0, Math.floor(ms)); return { ...record }; }); },
    setDaily(scope, day, patch) { return edit(data => { const record = data.accounts[scope]?.day === day ? data.accounts[scope] : (data.accounts[scope] = { day, ms: 0, state: 'counting', claim: null }); Object.assign(record, patch); return { ...record }; }); },
    // ----- the time not yet sent to the Worker (accounts): spans of real time played, in wall-clock milliseconds, each with its own number (never reused) and one career. The queue survives a refresh. -----
    // A span leaves the queue only when the Worker acknowledges it (queueAck); a span that has been sent is never changed again (its number is what the Worker remembers), so the time that follows goes into a new span.
    queued(scope) { return queueOf(read(), scope).spans.map(span => ({ ...span })); },
    queueAdd(scope, careerId, start, end) {
      return edit(data => {
        if (!(end > start)) return;
        const queue = queueOf(data, scope), last = queue.spans.at(-1);
        if (last && !last.sent && last.c === careerId && start - last.e <= 3000 && start >= last.s && last.e - last.s < SPAN_JOIN_MS) { last.e = Math.max(last.e, end); return; }
        if (queue.spans.length >= QUEUE_MAX) { const gone = queue.spans.shift(); logLost(queue, gone, 'coda-piena'); }   // never silent: it is written down (lost) and the page can show it
        // (a few milliseconds of difference between two readings of the clock are not a gap or an overlap: the new span starts where the previous one ended, so that the Worker joins them exactly)
        if (last && last.c === careerId && Math.abs(start - last.e) <= 100) start = last.e;
        if (end > start) queue.spans.push({ q: queue.next++, c: careerId, s: start, e: end });
      });
    },
    // The next spans to send (oldest first), marked as sent.
    queuePeek(scope, count) { return edit(data => { const queue = queueOf(data, scope); const chunk = queue.spans.slice(0, count); for (const span of chunk) span.sent = true; return chunk.map(span => ({ ...span })); }); },
    // The Worker answered: the acknowledged spans leave the queue, the refused ones are written down in the log of what was lost (with the reason) and leave it too. Anything else stays.
    queueAck(scope, acked = [], rejected = []) {
      return edit(data => {
        const queue = queueOf(data, scope), done = new Set(acked), refused = new Map(rejected.map(item => [item.q, item.reason]));
        queue.spans = queue.spans.filter(span => { if (refused.has(span.q)) { logLost(queue, span, refused.get(span.q)); return false; } return !done.has(span.q); });
      });
    },
    queuedMs(scope, careerId = null, filter = null) { return queueOf(read(), scope).spans.reduce((sum, span) => sum + ((careerId === null || span.c === careerId) && (!filter || filter(span)) ? span.e - span.s : 0), 0); },
    lost(scope) { const queue = queueOf(read(), scope); return { ms: queue.lostMs, log: queue.lost.map(item => ({ ...item })) }; },
    // ----- the blocks of 30/60 minutes credited on this device and not yet confirmed by the Worker (the Worker records them: one row for each account, career and block) -----
    blocks(scope) { return (read().blocks?.[scope] ?? []).map(item => ({ ...item })); },
    blockAdd(scope, claim) { return edit(data => { const list = ((data.blocks ??= {})[scope] ??= []); if (!list.some(item => item.career === claim.career && item.kind === claim.kind && item.n === claim.n)) list.push({ career: claim.career, kind: claim.kind, n: claim.n }); if (list.length > 200) list.splice(0, list.length - 200); }); },
    blockDone(scope, claim) { return edit(data => { const list = data.blocks?.[scope]; if (list) data.blocks[scope] = list.filter(item => !(item.career === claim.career && item.kind === claim.kind && item.n === claim.n)); }); },
    // ----- what the player has not been told yet (the popup of the rewards): kept on the device until it is dismissed, so that a refresh does not lose it -----
    notices() { return (read().notices ?? []).map(item => ({ ...item })); },
    noticeAdd(entry) { return edit(data => { const list = (data.notices ??= []); if (entry?.id && !list.some(item => item.id === entry.id)) list.push({ ...entry }); if (list.length > 50) list.splice(0, list.length - 50); }); },
    noticeDismiss(id) { return edit(data => { data.notices = (data.notices ?? []).filter(item => item.id !== id); }); },
    // ----- one-off community rewards (Instagram): per account or guest -----
    community(scope, id) { return { state: 'idle', claim: null, ...(read().community?.[scope]?.[id] ?? {}) }; },
    setCommunity(scope, id, patch) { return edit(data => { const bag = ((data.community ??= {})[scope] ??= {}); bag[id] = { state: 'idle', claim: null, ...(bag[id] ?? {}), ...patch }; return { ...bag[id] }; }); },
    // ----- a career -----
    career(careerId) { const record = read().careers[careerId]; return record ? { ...record, daily: [...(record.daily ?? [])], ads: [...(record.ads ?? [])], community: [...(record.community ?? [])] } : { playMs: 0, updatedAt: null, daily: [], ads: [], community: [] }; },
    recordCommunityCredit(careerId, entry) { return edit(data => { const record = careerOf(data, careerId); if (!record.community.some(item => item.id === entry.id)) record.community = [...record.community, { id: entry.id, reward: entry.reward, at: entry.at }].slice(-20); }); },
    addCareerMs(careerId, ms, at = new Date().toISOString()) { return edit(data => { const record = careerOf(data, careerId); record.playMs += Math.max(0, Math.floor(ms)); record.updatedAt = at; return record.playMs; }); },
    // The Worker's merged time replaces the figure of the device (it can be lower than the device's own count when two copies of the career played the same minutes).
    putCareerMs(careerId, playMs) { return edit(data => { const record = careerOf(data, careerId); record.playMs = Math.max(0, Math.floor(playMs)); return record.playMs; }); },
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
