// The queue of the online saves. A local save that has to go online is first written down here, in the browser's storage (it survives closing the page), and is sent by a
// worker that can be started by many things: the end of a save, the return of the network, the reopening of the game, a timer with growing waits. It replaces the single timer of six seconds.
//
// Rules the queue keeps:
//   - one entry per career (the latest local save replaces the older request), tied to the account that was signed in when it was made: it is never sent under another account;
//   - nothing is sent blindly: before every upload the version online is read again and compared with the revision this device holds; if they differ the entry becomes a conflict and waits
//     for the player, nothing is overwritten;
//   - what is sent is the copy saved in this browser (never an unsaved state), read from the storage when the entry is processed;
//   - only one tab works on the queue at a time (a short lease in the storage), a tab that finds it busy tries later.
const QUEUE_KEY = 'politicando.sync.queue.v1';
const LOCK_KEY = 'politicando.sync.lock.v1';
const LEASE_MS = 20_000;
export const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000, 900_000];
// Tells one tab (one engine) from another without random numbers: the moment the page started and a counter.
let leaseSequence = 0;
const RETRYABLE = error => ['offline', 'timeout'].includes(error?.code) || error?.status >= 500 || error?.status === 429;

export function createSyncEngine({ store, account, getSnapshot, now = () => Date.now(), schedule = (fn, ms) => setTimeout(fn, ms), cancel = handle => clearTimeout(handle), onChange = () => {}, metaOf = () => ({}), nameOf = () => null } = {}) {
  const read = () => { try { const value = JSON.parse(store.getItem(QUEUE_KEY) ?? 'null'); return value?.ops ? value : { ops: {}, done: {} }; } catch { return { ops: {}, done: {} }; } };
  const write = value => { try { store.setItem(QUEUE_KEY, JSON.stringify(value)); } catch { /* without space the queue lives in memory only until the next write */ } };
  let timer = null;
  let running = null;
  const owner = () => account.currentAccount()?.username ?? null;
  const emit = () => { try { onChange(); } catch { /* a listener never stops the queue */ } };
  const update = (careerId, patch) => {
    const state = read();
    if (!state.ops[careerId]) return;
    state.ops[careerId] = { ...state.ops[careerId], ...patch };
    write(state);
  };
  const finish = (careerId, extra = {}) => {
    const state = read();
    delete state.ops[careerId];
    state.done[careerId] = { at: new Date(now()).toISOString(), ...extra };
    write(state);
  };
  // ---- the lease between tabs ----
  const takeLease = () => {
    try {
      const held = JSON.parse(store.getItem(LOCK_KEY) ?? 'null');
      if (held?.expiresAt > now() && held.token !== token) return false;
      store.setItem(LOCK_KEY, JSON.stringify({ token, expiresAt: now() + LEASE_MS }));
      return JSON.parse(store.getItem(LOCK_KEY) ?? 'null')?.token === token;
    } catch { return true; }
  };
  const releaseLease = () => { try { if (JSON.parse(store.getItem(LOCK_KEY) ?? 'null')?.token === token) store.removeItem(LOCK_KEY); } catch { /* the lease expires by itself */ } };
  const token = `${now()}-${globalThis.performance?.timeOrigin ?? 0}-${++leaseSequence}-${store.getItem ? String(store.length ?? 0) : 0}`;

  // The request is written down at once; whether it can go is decided when it is processed.
  function enqueue(state, { explicit = false } = {}) {
    const username = owner();
    const careerId = String(state?.career?.id ?? '');
    if (!username || !careerId) return null;
    const queue = read();
    const previous = queue.ops[careerId];
    // A conflict stays a conflict until the player chooses; a newer local save does not hide it.
    if (previous?.status === 'conflict' && previous.username === username) { queue.ops[careerId] = { ...previous, localRevision: state?.saveMeta?.revision ?? previous.localRevision }; write(queue); emit(); return queue.ops[careerId]; }
    queue.ops[careerId] = { careerId, slot: account.slotForCareer(careerId), username, queuedAt: new Date(now()).toISOString(), localRevision: state?.saveMeta?.revision ?? null, attempts: 0, nextAt: now(), status: 'pending', error: null, remote: null, explicit: Boolean(explicit || previous?.explicit && previous.username === username) };
    write(queue);
    emit();
    return queue.ops[careerId];
  }
  // The player decided (loaded the online copy, kept this one, left them apart): the entry goes away.
  function resolve(careerId) { const queue = read(); delete queue.ops[careerId]; write(queue); emit(); }
  // The account was deleted: what was written down for it goes too.
  function forget(username) { const queue = read(); for (const [id, op] of Object.entries(queue.ops)) if (op.username === username) delete queue.ops[id]; write(queue); emit(); }
  function status(careerId) {
    const op = read().ops[careerId];
    if (op) return { state: op.status === 'session' ? 'session' : op.username !== owner() ? 'paused' : op.status, op };
    const link = account.linkOf(careerId);
    const done = read().done[careerId];
    return link ? { state: 'synced', at: done?.at ?? link.syncedAt, revision: link.revision } : { state: 'none' };
  }
  function operations({ username = owner() } = {}) { return Object.values(read().ops).filter(op => !username || op.username === username); }
  const waiting = () => Object.values(read().ops).filter(op => ['pending', 'retry'].includes(op.status) && op.username === owner());

  // One entry: read the version online again, compare, then upload or stop for the player.
  async function process(op) {
    const username = owner();
    if (!username) { update(op.careerId, { status: 'paused' }); return 'stop'; }
    if (op.username !== username) { update(op.careerId, { status: 'paused' }); return 'next'; }
    const snapshot = getSnapshot(op.careerId);
    if (!snapshot) { update(op.careerId, { status: 'pending', error: 'In attesa del salvataggio in questo browser.', nextAt: now() + BACKOFF_MS[1] }); return 'next'; }
    let cloud;
    try { cloud = await account.listCloudSaves(); }
    catch (error) { return failure(op, error); }
    // The account changed while waiting for the answer: the answer belongs to somebody else.
    if (owner() !== username) return 'stop';
    const remote = cloud.find(item => item.slot === op.slot) ?? null;
    const link = account.linkOf(op.careerId, username);
    const stop = (kind, extra = {}) => { update(op.careerId, { status: 'conflict', kind, remote: remote ? { revision: remote.revision, updatedAt: remote.updatedAt, progress: remote.progress ?? null } : null, error: null, ...extra }); return 'next'; };
    if (!link && remote) return stop('unlinked-remote');
    if (link && !remote) return stop('remote-missing');
    if (link && remote.revision !== link.revision) return stop('remote-changed');
    if (!link && !op.explicit) { update(op.careerId, { status: 'unlinked', error: null, remote: null }); return 'next'; }
    if (link && account.descends(snapshot, link) !== 'ok') return stop('stale-copy');
    try {
      const body = await account.uploadSave(op.slot, snapshot, { name: nameOf(snapshot), meta: metaOf(snapshot), create: !link });
      finish(op.careerId, { revision: body.revision });
      return 'next';
    } catch (error) {
      if (error.status === 409 && error.data?.conflict) return stop(error.data.code === 'regression' ? 'behind-online' : error.data.code ?? 'remote-changed', error.data.remote ? { remote: error.data.remote } : {});
      return failure(op, error);
    }
  }
  function failure(op, error) {
    if (error?.status === 401) { update(op.careerId, { status: 'session', error: error.message }); return 'stop'; }
    if (RETRYABLE(error)) {
      const attempts = (read().ops[op.careerId]?.attempts ?? 0) + 1;
      update(op.careerId, { status: 'retry', attempts, error: error.message, nextAt: now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] });
      return error?.code === 'offline' ? 'stop' : 'next';
    }
    update(op.careerId, { status: 'error', error: error?.message ?? 'Errore di sincronizzazione.' });
    return 'next';
  }
  // Works through what is due. `manual` ignores the waits (the player asked). Returns what is left to do.
  async function flush({ manual = false } = {}) {
    if (running) return running;
    running = (async () => {
      cancelTimer();
      if (!owner()) { emit(); return summary(); }
      if (!takeLease()) { arm(BACKOFF_MS[0]); return summary(); }
      try {
        for (const op of operations()) {
          if (!['pending', 'retry', 'session', 'paused', 'unlinked'].includes(op.status) && !(manual && op.status === 'error')) continue;
          if (!manual && op.nextAt > now()) continue;
          if (op.status === 'unlinked' && !op.explicit) continue;
          const verdict = await process(op);
          emit();
          if (verdict === 'stop') break;
        }
      } finally { releaseLease(); }
      emit();
      rearm();
      return summary();
    })().finally(() => { running = null; });
    return running;
  }
  const summary = () => ({ pending: waiting().length, conflicts: operations().filter(op => op.status === 'conflict').length, errors: operations().filter(op => op.status === 'error').length });
  function cancelTimer() { if (timer !== null) { cancel(timer); timer = null; } }
  function arm(ms) { cancelTimer(); timer = schedule(() => { timer = null; flush(); }, Math.max(250, ms)); }
  // The next due entry sets the next wake-up.
  function rearm() {
    const due = waiting().map(op => op.nextAt);
    if (due.length) arm(Math.min(...due) - now());
  }
  // The page was (re)opened, the network came back, the account signed in: take up what is written down.
  function resume() { if (owner() && waiting().length) arm(250); }
  function stop() { cancelTimer(); }
  return { enqueue, resolve, forget, status, operations, flush, resume, stop, summary, rearm, arm, read };
}
