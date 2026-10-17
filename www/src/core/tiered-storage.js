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
    open: async () => { await open(); },
    getAll: () => run('readonly', store => store.getAll()),
    put: record => run('readwrite', store => store.put(record)),
    remove: key => run('readwrite', store => store.delete(key))
  };
}
export function memoryBackend() {
  const data = new Map();
  const backend = {
    name: 'memory', data, failures: { open: null, put: null, remove: null, getAll: null }, delay: 0,
    wait: () => backend.delay ? new Promise(resolve => setTimeout(resolve, backend.delay)) : Promise.resolve(),
    async open() { await backend.wait(); if (backend.failures.open) throw backend.failures.open; },
    async getAll() { await backend.wait(); if (backend.failures.getAll) throw backend.failures.getAll; return [...data.values()].map(record => ({ ...record })); },
    async put(record) { await backend.wait(); if (backend.failures.put) throw backend.failures.put; data.set(record.key, { ...record }); },
    async remove(key) { await backend.wait(); if (backend.failures.remove) throw backend.failures.remove; data.delete(key); }
  };
  return backend;
}

// ---------- the tier ----------
// real: () => the localStorage in use; isBulk(key): does this key hold a save; backend: IndexedDB (or null); channel: () => a BroadcastChannel (or null).
export function createTier({ real = () => globalThis.localStorage, isBulk = () => false, backend = idbBackend(), channel = name => (typeof BroadcastChannel === 'function' ? new BroadcastChannel(name) : null), now = () => Date.now(), budget = LOCAL_BUDGET, openTimeout = 4000 } = {}) {
  const memory = new Map();          // key -> { value, at }  (the values that live outside localStorage, and what was hydrated)
  const ahead = new Set();           // keys whose current value is NOT in localStorage (read from memory)
  const confirmed = new Map();       // key -> at of the last write confirmed by the backend
  const mirrors = new Map();         // key -> promise of the last write to the backend
  const failures = new Map();        // key -> message of the last backend write that failed
  const pending = new Set();
  const status = { backend: backend?.name ?? 'none', available: false, error: null, hydrated: 0, migrated: { done: false, at: null, keys: [], verified: [], mismatches: [], skipped: [] } };
  const storage = () => { try { return real(); } catch { return null; } };
  const tabId = `${now()}-${Math.round((globalThis.performance?.now?.() ?? 0) * 1000)}-${Math.round((globalThis.performance?.timeOrigin ?? 0))}`;
  let primaryKey = null;
  let bus = null;
  let busId = 0;
  const post = message => { try { bus?.postMessage({ from: tabId, ...message }); } catch { /* a tab that cannot be told reads again when it is shown */ } };
  const tell = (promise) => { pending.add(promise); promise.finally(() => pending.delete(promise)).catch(() => {}); return promise; };

  const lsGet = key => { try { return storage()?.getItem(key) ?? null; } catch { return null; } };
  // The characters the saves already take in localStorage.
  const bulkInLocal = except => {
    let total = 0;
    try { const ls = storage(); const length = ls?.length; if (ls && typeof ls.key === 'function' && Number.isFinite(length)) for (let index = 0; index < length; index++) { const key = ls.key(index); if (key && key !== except && isBulk(key)) total += (ls.getItem(key) ?? '').length; } } catch { /* unknown: the budget is not applied */ }
    return total;
  };
  const mirror = (key, value, at, lsOk) => {
    if (!status.available) return null;
    const write = backend.put({ key, value, at, lsOk }).then(() => { confirmed.set(key, at); failures.delete(key); return true; }, error => { failures.set(key, error?.message || String(error)); return false; });
    mirrors.set(key, write);
    return tell(write);
  };
  const mirrorRemove = key => {
    if (!status.available) return null;
    const write = backend.remove(key).then(() => { confirmed.delete(key); failures.delete(key); return true; }, error => { failures.set(key, error?.message || String(error)); return false; });
    mirrors.set(key, write);
    return tell(write);
  };

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
        try { ls.setItem(key, text); lsOk = true; } catch (error) { failure = error; }
      }
      if (lsOk) { ahead.delete(key); memory.delete(key); }
      else {
        if (!status.available) throw failure ?? new Error('Archivio del browser non disponibile');
        memory.set(key, { value: text, at });
        ahead.add(key);
      }
      mirror(key, text, at, lsOk);
      post({ t: 'set', key, at, lsOk, value: lsOk ? undefined : text });
    },
    removeItem(key) {
      if (!isBulk(key)) { storage()?.removeItem(key); return; }
      ahead.delete(key); memory.delete(key);
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
  async function start({ compare = null } = {}) {
    if (!backend) { status.error = 'IndexedDB non disponibile in questo browser'; return status; }
    let timer;
    try {
      await Promise.race([backend.open(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('IndexedDB non risponde')), openTimeout); })]);
      status.available = true;
    } catch (error) { status.error = error?.message || String(error); return status; }
    finally { clearTimeout(timer); }
    let records = [];
    try { records = await backend.getAll(); } catch (error) { status.error = error?.message || String(error); status.available = false; return status; }
    const byKey = new Map(records.map(record => [record.key, record]));
    const mirrored = [];
    // 1. what the backend has
    for (const record of records) {
      if (record.key === META_KEY || !isBulk(record.key)) continue;
      const local = lsGet(record.key);
      if (local === record.value) { confirmed.set(record.key, record.at); continue; }
      if (local === null || mostAdvanced(record.key, local, record, compare) === 'backend') {
        // Only the backend has the newest value: it is read from memory, and a copy is tried back in localStorage when there is room for it.
        let back = false;
        if (bulkInLocal(record.key) + record.value.length <= budget) { try { storage()?.setItem(record.key, record.value); back = true; } catch { back = false; } }
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
    if (confirmed.get(key) === at) return { durable: true, confirm: Promise.resolve(true) };
    const write = mirrors.get(key);
    return { durable: false, confirm: write ? write.then(ok => ok && confirmed.get(key) === at) : Promise.resolve(false) };
  }
  // Where a key's current value lives: in localStorage, or only in the browser's database (IndexedDB) because localStorage had no room.
  const where = key => ahead.has(key) ? 'database' : 'local';
  const settled = () => Promise.allSettled([...pending]);
  const report = () => ({
    backend: status.backend, available: status.available, error: status.error, hydrated: status.hydrated, migrated: { ...status.migrated },
    ahead: [...ahead], pending: pending.size, failed: [...failures].map(([key, message]) => ({ key, message })), messages: busId
  });
  return { facade, start, refresh, durability, where, settled, report, setPrimaryKey, close() { try { bus?.close(); } catch { /* closed */ } }, _memory: memory, _ahead: ahead };
}
