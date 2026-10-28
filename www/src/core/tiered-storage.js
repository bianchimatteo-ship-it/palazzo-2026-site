// The browser's storage for the saves, in two tiers.
//
// localStorage is small (about 5 million characters in Chrome and Safari) and synchronous; a career of a few dozen weeks already takes more than half of it once the running game, the
// copy kept aside, the history and a few slots are counted (measured: 30 weeks = 4.6 million characters). IndexedDB is large and asynchronous. The game's storage code (storage.js) is
// synchronous and well tested, so it keeps talking to a `localStorage`-shaped object: this one. For the keys that hold saves (the running game, the backup, the history, the slots) it
//   - writes in localStorage as before, as long as it takes the value and the saves there stay under a budget that leaves room for the small keys (lock, indexes, settings, queue);
//   - when it does not (budget reached, quota, storage disabled) keeps the value in memory and writes it in IndexedDB: the value is read back from memory, other tabs are told, and
//     `durability(key)` says that the write is NOT yet safe until IndexedDB has confirmed it (the game never says "saved" before);
//   - mirrors every write in IndexedDB too, so the saves also survive a cleared or evicted localStorage;
//   - at start copies what localStorage holds into IndexedDB (idempotent: what is already there and equal is skipped), reads it back to check it, and takes back into memory what only
//     IndexedDB has. Nothing is ever deleted from localStorage by this code: the old copies stay where they were.
// The small keys (lock, slot index, Hall of Fame, settings, sync queue) never leave localStorage.
import { LZ_MARK, compress, decompress } from './lz.js?v=20261028-2';
const DB_NAME = 'politicando-vault';
const STORE = 'entries';
const META_KEY = '__meta__';
export const LOCAL_BUDGET = 3_000_000;

// ---------- backends: IndexedDB, and a memory one for tests (with failures that can be switched on) ----------
export function idbBackend(factory = globalThis.indexedDB) {
  if (!factory) return null;
  let dbPromise = null;
  const open = () => dbPromise ??= new Promise((resolve, reject) => {
    let request;
    try { request = factory.open(DB_NAME, 1); } catch (error) { reject(error); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' }); };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); dbPromise = null; }; resolve(request.result); };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB non disponibile'));
    request.onblocked = () => reject(new Error('IndexedDB bloccato da un’altra scheda'));
  });
  const run = async (mode, action) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      let transaction;
      try { transaction = db.transaction(STORE, mode); } catch (error) { dbPromise = null; reject(error); return; }
      const store = transaction.objectStore(STORE);
      let result;
      try { result = action(store); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(result?.result ?? undefined);
      transaction.onerror = () => reject(transaction.error ?? new Error('Scrittura IndexedDB non riuscita'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Scrittura IndexedDB annullata'));
    });
  };
  return {
    name: 'indexeddb',
    // a connection that went away (the browser closed it, another tab upgraded it) is opened again on the next use
    reset() { dbPromise = null; },
    open: async () => { await open(); },
    getAll: () => run('readonly', store => store.getAll()),
    put: record => run('readwrite', store => store.put(record)),
    remove: key => run('readwrite', store => store.delete(key))
  };
}
export function memoryBackend() {
  const data = new Map();
  const backend = {
    name: 'memory', data, failures: { open: null, put: null, remove: null, getAll: null }, delay: 0, flaky: 0, resets: 0, reset() { backend.resets++; },
    wait: () => backend.delay ? new Promise(resolve => setTimeout(resolve, backend.delay)) : Promise.resolve(),
    async open() { await backend.wait(); if (backend.failures.open) throw backend.failures.open; },
    async getAll() { await backend.wait(); if (backend.failures.getAll) throw backend.failures.getAll; return [...data.values()].map(record => ({ ...record })); },
    async put(record) { await backend.wait(); if (backend.flaky > 0) { backend.flaky--; throw Object.assign(new Error('La connessione si sta chiudendo'), { name: 'InvalidStateError' }); } if (backend.failures.put) throw backend.failures.put; data.set(record.key, { ...record }); },
    async remove(key) { await backend.wait(); if (backend.failures.remove) throw backend.failures.remove; data.delete(key); }
  };
  return backend;
}

// ---------- the tier ----------
// real: () => the localStorage in use; isBulk(key): does this key hold a save; backend: IndexedDB (or null); channel: () => a BroadcastChannel (or null).
export function createTier({ real = () => globalThis.localStorage, isBulk = () => false, backend = idbBackend(), channel = name => (typeof BroadcastChannel === 'function' ? new BroadcastChannel(name) : null), now = () => Date.now(), budget = LOCAL_BUDGET, openTimeout = 4000, deferMs = 600, attachWaits = [1500, 4000, 10000, 30000] } = {}) {
  const memory = new Map();          // key -> { value, at }  (the values that live outside localStorage, and what was hydrated)
  const ahead = new Set();           // keys whose current value is NOT in localStorage (read from memory)
  const confirmed = new Map();       // key -> at of the last write confirmed by the backend
  const mirrors = new Map();         // key -> promise of the last write to the backend
  const failures = new Map();        // key -> message of the last backend write that failed
  const pending = new Set();
  let exhausted = false;             // the database could not be opened after every retry: from now on a refused write is an error, as before
  let attaching = null;
  let startCompare = null;
  const status = { backend: backend?.name ?? 'none', available: false, error: null, hydrated: 0, migrated: { done: false, at: null, keys: [], verified: [], mismatches: [], skipped: [] } };
  const storage = () => { try { return real(); } catch { return null; } };
  const tabId = `${now()}-${Math.round((globalThis.performance?.now?.() ?? 0) * 1000)}-${Math.round((globalThis.performance?.timeOrigin ?? 0))}`;
  let primaryKey = null;
  let bus = null;
  let busId = 0;
  const post = message => { try { bus?.postMessage({ from: tabId, ...message }); } catch { /* a tab that cannot be told reads again when it is shown */ } };
  const tell = (promise) => { pending.add(promise); promise.finally(() => pending.delete(promise)).catch(() => {}); return promise; };

  // A save that had to be written compressed (the last resort when localStorage is full) is read back as the text it was.
  const decoded = new Map();
  const lsGet = key => {
    let raw;
    try { raw = storage()?.getItem(key) ?? null; } catch { return null; }
    if (raw === null || !raw.startsWith(LZ_MARK)) return raw;
    const known = decoded.get(key);
    if (known?.raw === raw) return known.text;
    try { const text = decompress(raw); decoded.set(key, { raw, text }); return text; } catch { return null; }
  };
  // The characters the saves already take in localStorage: counted once at start, then kept up to date by this tab's own writes (a heuristic for the budget, never a limit that is trusted).
  const sizes = new Map();
  const bulkInLocal = except => { let total = 0; for (const [key, size] of sizes) if (key !== except) total += size; return total; };
  const scanSizes = () => {
    sizes.clear();
    try { const ls = storage(); const length = ls?.length; if (ls && typeof ls.key === 'function' && Number.isFinite(length)) for (let index = 0; index < length; index++) { const key = ls.key(index); if (key && isBulk(key)) sizes.set(key, (ls.getItem(key) ?? '').length); } } catch { /* unknown: the budget is not applied */ }
  };
  // The writes to the backend: one at a time for each key, and only the newest value waits behind the one being written (a long career saves many times a minute; writing every
  // intermediate value would only queue megabytes the next write replaces). A caller whose value was replaced is answered by the write of the newer one.
  const writers = new Map(); // key -> { inflight, queued: { record, promise, resolve } | null }
  const writeRecord = record => record.remove ? backend.remove(record.key) : backend.put(record);
  const TRANSIENT = error => ['InvalidStateError', 'AbortError', 'TransactionInactiveError', 'UnknownError'].includes(error?.name) || /closing|closed|connection/i.test(String(error?.message ?? ''));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  // A write that fails because the connection went away is tried again (three times, with growing waits, after opening the database again); a refusal for lack of space is not.
  const attemptWrite = async (record, attempt = 0) => {
    try { await writeRecord(record); }
    catch (error) {
      if (attempt >= 3 || !TRANSIENT(error)) throw error;
      try { backend.reset?.(); } catch { /* the next attempt opens it */ }
      await sleep(120 * 2 ** attempt);
      await attemptWrite(record, attempt + 1);
    }
  };
  const run = (key, record) => {
    const writer = writers.get(key);
    const done = attemptWrite(record).then(() => { if (record.remove) confirmed.delete(key); else confirmed.set(key, record.at); failures.delete(key); return true; }, error => { failures.set(key, error?.message || String(error)); return false; });
    writer.inflight = done.then(ok => {
      writer.inflight = null;
      const next = writer.queued;
      if (next) { writer.queued = null; run(key, next.record).then(next.resolve); }
      return ok;
    });
    return writer.inflight;
  };
  const send = record => {
    if (!status.available) return null;
    const key = record.key;
    if (!writers.has(key)) writers.set(key, { inflight: null, queued: null });
    const writer = writers.get(key);
    let promise;
    if (!writer.inflight) promise = run(key, record);
    else {
      if (!writer.queued) { let resolve; const waiting = new Promise(done => { resolve = done; }); writer.queued = { record, promise: waiting, resolve }; } else writer.queued.record = record;
      promise = writer.queued.promise;
    }
    mirrors.set(key, promise);
    return tell(promise);
  };
  // A copy that is already safe in localStorage is only a mirror: writing it costs time on every save (the browser copies megabytes), so during a burst of saves only the newest value of
  // a key is written, a little later. What is not safe elsewhere (localStorage refused it) and every removal go out at once.
  const deferred = new Map(); // key -> { record, timer, promise, resolve }
  const flushDeferred = () => {
    for (const [key, item] of [...deferred]) { clearTimeout(item.timer); deferred.delete(key); send(item.record)?.then(item.resolve); }
  };
  const mirror = (key, value, at, lsOk) => {
    if (!status.available) return null;
    const record = { key, value, at, lsOk };
    if (!lsOk || !deferMs) { dropDeferred(key); return send(record); }
    let item = deferred.get(key);
    if (item) item.record = record;
    else {
      let resolve; const promise = new Promise(done => { resolve = done; });
      item = { record, resolve, promise, timer: null };
      item.timer = setTimeout(() => { deferred.delete(key); send(item.record)?.then(item.resolve); }, deferMs);
      deferred.set(key, item);
      tell(promise);
    }
    return item.promise;
  };
  function dropDeferred(key) { const item = deferred.get(key); if (item) { clearTimeout(item.timer); deferred.delete(key); item.resolve(true); } }
  const mirrorRemove = key => { dropDeferred(key); return send({ key, remove: true, at: now() }); };

  // ---- the localStorage-shaped surface used by storage.js ----
  const facade = {
    getItem(key) {
      if (!isBulk(key)) return storage()?.getItem(key) ?? null;
      if (ahead.has(key)) return memory.get(key)?.value ?? null;
      return lsGet(key);
    },
    setItem(key, value) {
      const ls = storage();
      if (!isBulk(key)) { if (!ls) throw new Error('Archivio del browser non disponibile'); ls.setItem(key, value); return; }
      const text = String(value);
      // The same value again (a save that changed nothing): nothing is written, and what was confirmed stays confirmed.
      if (ahead.has(key) && memory.get(key)?.value === text && confirmed.get(key) === memory.get(key).at) return;
      const at = now();
      let lsOk = false;
      let failure = null;
      // The running game always tries localStorage first (it is what other tabs and the next opening read at once); the others go there while the saves stay under the budget.
      const room = key === primaryKey ? true : bulkInLocal(key) + text.length <= budget;
      if (ls && (room || !status.available)) {
        try { ls.setItem(key, text); lsOk = true; sizes.set(key, text.length); } catch (error) { failure = error; }
      }
      // Last resort for localStorage: the same save, compressed (it often fits where the plain text does not). It is as safe as any write to localStorage.
      if (!lsOk && ls && text.length > 4096) {
        try { const packed = compress(text); ls.setItem(key, packed); lsOk = true; sizes.set(key, packed.length); } catch (error) { failure = failure ?? error; }
      }
      if (lsOk) { ahead.delete(key); memory.delete(key); }
      else if (status.available || (backend && !exhausted)) {
        // Kept in memory and written to the database: safe only when the database confirms (`durability`). If the database is not open yet (it was slow, or refused) it is tried again in the background.
        memory.set(key, { value: text, at });
        ahead.add(key);
        if (!status.available) retryAttach();
      } else throw failure ?? new Error('Archivio del browser non disponibile');
      mirror(key, text, at, lsOk);
      post({ t: 'set', key, at, lsOk, value: lsOk ? undefined : text });
    },
    removeItem(key) {
      if (!isBulk(key)) { storage()?.removeItem(key); return; }
      ahead.delete(key); memory.delete(key); sizes.delete(key);
      try { storage()?.removeItem(key); } catch { /* a key that cannot be removed is overwritten by the next write */ }
      mirrorRemove(key);
      post({ t: 'del', key });
    },
    get length() { const ls = storage(); return ls && Number.isFinite(ls.length) ? ls.length + [...ahead].filter(key => lsGet(key) === null).length : undefined; },
    get key() {
      const ls = storage();
      if (!ls || typeof ls.key !== 'function') return undefined;
      return index => {
        const length = ls.length;
        if (index < length) return ls.key(index);
        const extra = [...ahead].filter(key => lsGet(key) === null);
        return extra[index - length] ?? null;
      };
    }
  };
  const setPrimaryKey = key => { primaryKey = key; };

  // ---- start: open the backend, copy what localStorage has, take back what only the backend has ----
  const mostAdvanced = (key, ls, record, compare) => {
    // compare(a, b) > 0 when a is the more advanced save; null when the values are not saves.
    const verdict = compare?.(key, ls, record.value);
    if (typeof verdict === 'number' && verdict !== 0) return verdict > 0 ? 'local' : 'backend';
    return record.lsOk === false ? 'backend' : 'local';
  };
  const tryOpen = async ms => {
    let timer;
    try { await Promise.race([backend.open(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('IndexedDB non risponde')), ms); })]); return true; }
    catch (error) { status.error = error?.message || String(error); return false; }
    finally { clearTimeout(timer); }
  };
  async function start({ compare = null } = {}) {
    startCompare = compare;
    if (!backend) { status.error = 'IndexedDB non disponibile in questo browser'; exhausted = true; return status; }
    if (!(await tryOpen(openTimeout))) { retryAttach(); return status; }
    return hydrate();
  }
  // The database did not open in time (a slow device, a locked database): the game starts on localStorage and tries again in the background; a save that localStorage refuses meanwhile waits in
  // memory for it. After the last attempt (about 45 seconds) a refused write is an error again.
  function retryAttach() {
    if (!backend || status.available || exhausted) return attaching;
    if (attaching) return attaching;
    attaching = (async () => {
      for (const wait of attachWaits) {
        await sleep(wait);
        try { backend.reset?.(); } catch { /* opened again below */ }
        if (await tryOpen(openTimeout)) { await hydrate(); if (status.available) return true; }
      }
      exhausted = true;
      return false;
    })().finally(() => { attaching = null; });
    return attaching;
  }
  async function hydrate() {
    const compare = startCompare;
    status.available = true; status.error = null;
    scanSizes();
    let records = [];
    try { records = await backend.getAll(); } catch (error) { status.error = error?.message || String(error); status.available = false; return status; }
    const byKey = new Map(records.map(record => [record.key, record]));
    const mirrored = [];
    // 1. what the backend has
    for (const record of records) {
      if (record.key === META_KEY || !isBulk(record.key)) continue;
      // a value written while the database was not open is newer than whatever it holds: it stays, and is written below
      if (ahead.has(record.key)) continue;
      const local = lsGet(record.key);
      if (local === record.value) { confirmed.set(record.key, record.at); continue; }
      if (local === null || mostAdvanced(record.key, local, record, compare) === 'backend') {
        // Only the backend has the newest value: it is read from memory, and a copy is tried back in localStorage when there is room for it.
        let back = false;
        if (bulkInLocal(record.key) + record.value.length <= budget) { try { storage()?.setItem(record.key, record.value); back = true; sizes.set(record.key, record.value.length); } catch { back = false; } }
        if (!back) { memory.set(record.key, { value: record.value, at: record.at }); ahead.add(record.key); }
        confirmed.set(record.key, record.at);
        status.hydrated++;
      } else mirrored.push(record.key); // localStorage is more advanced: the backend is updated below
    }
    // 2. what localStorage has and the backend does not (or has older): the migration, idempotent
    const wanted = [];
    try { const ls = storage(); const length = ls?.length; if (ls && typeof ls.key === 'function' && Number.isFinite(length)) for (let index = 0; index < length; index++) { const key = ls.key(index); if (key && isBulk(key)) wanted.push(key); } } catch { /* the keys cannot be listed: only what is written from now on is mirrored */ }
    const copies = [];
    for (const key of new Set([...wanted, ...mirrored])) {
      const value = lsGet(key);
      if (value === null) continue;
      const known = byKey.get(key);
      if (known?.value === value) { status.migrated.skipped.push(key); continue; }
      const at = now();
      copies.push(backend.put({ key, value, at, lsOk: true }).then(() => { confirmed.set(key, at); status.migrated.keys.push(key); }, error => { failures.set(key, error?.message || String(error)); }));
    }
    await Promise.allSettled(copies);
    // 3. read it back: the migration counts as verified only for what the backend now returns identical
    if (status.migrated.keys.length) {
      try {
        const again = new Map((await backend.getAll()).map(record => [record.key, record]));
        for (const key of status.migrated.keys) { if (again.get(key)?.value === lsGet(key)) status.migrated.verified.push(key); else status.migrated.mismatches.push(key); }
      } catch (error) { status.migrated.mismatches.push(...status.migrated.keys); failures.set('verifica', error?.message || String(error)); }
    }
    status.migrated.done = true; status.migrated.at = new Date(now()).toISOString();
    try { await backend.put({ key: META_KEY, value: JSON.stringify({ v: 1, at: status.migrated.at, keys: status.migrated.keys, verified: status.migrated.verified, mismatches: status.migrated.mismatches }), at: now(), lsOk: true }); } catch { /* the manifest is a record for the diagnosis */ }
    // other tabs
    bus = channel('politicando-vault');
    if (bus) bus.onmessage = event => {
      const message = event.data;
      if (!message || message.from === tabId || !isBulk(message.key)) return;
      if (message.t === 'del') { ahead.delete(message.key); memory.delete(message.key); return; }
      if (message.t === 'set') {
        if (message.lsOk) { ahead.delete(message.key); memory.delete(message.key); }
        else if (typeof message.value === 'string') { memory.set(message.key, { value: message.value, at: message.at }); ahead.add(message.key); }
        busId++;
      }
    };
    // what was written while the database was not open goes in now
    for (const key of ahead) { const item = memory.get(key); if (item && confirmed.get(key) !== item.at) mirror(key, item.value, item.at, false); }
    return status;
  }

  // Safety net for a tab that was hidden: what another tab wrote only in the backend is taken again.
  async function refresh() {
    if (!status.available) return 0;
    let changed = 0;
    try {
      for (const record of await backend.getAll()) {
        if (record.key === META_KEY || !isBulk(record.key) || record.lsOk !== false) continue;
        const own = memory.get(record.key);
        if (lsGet(record.key) !== record.value && (!own || own.at < record.at)) { memory.set(record.key, { value: record.value, at: record.at }); ahead.add(record.key); changed++; }
      }
    } catch { /* the next look tries again */ }
    return changed;
  }

  // Is this key's current value safe? `durable` at once when it is in localStorage; otherwise `confirm` resolves true when the backend has it, false when it could not take it.
  function durability(key) {
    if (!ahead.has(key)) return { durable: true, confirm: Promise.resolve(true) };
    const at = memory.get(key)?.at;
    if (!status.available) return { durable: false, confirm: attaching ? attaching.then(async ok => { if (!ok) return false; await settled(); return confirmed.get(key) >= at; }) : Promise.resolve(false) };
    if (confirmed.get(key) >= at) return { durable: true, confirm: Promise.resolve(true) };
    const write = mirrors.get(key);
    return { durable: false, confirm: write ? write.then(ok => ok && confirmed.get(key) >= at) : Promise.resolve(false) };
  }
  // Where a key's current value lives: in localStorage, or only in the browser's database (IndexedDB) because localStorage had no room.
  const where = key => ahead.has(key) ? 'database' : 'local';
  // Has the removal of a key reached the database? (a slot that is deleted must not come back at the next opening)
  const confirmRemoval = key => mirrors.get(key) ? mirrors.get(key).then(ok => Boolean(ok)) : Promise.resolve(true);
  const settled = async () => { flushDeferred(); await Promise.allSettled([...pending]); };
  const report = () => ({
    backend: status.backend, available: status.available, error: status.error, hydrated: status.hydrated, migrated: { ...status.migrated },
    ahead: [...ahead], pending: pending.size, failed: [...failures].map(([key, message]) => ({ key, message })), messages: busId
  });
  return { facade, start, refresh, flush: flushDeferred, durability, confirmRemoval, where, settled, report, setPrimaryKey, close() { try { bus?.close(); } catch { /* closed */ } }, _memory: memory, _ahead: ahead };
}
