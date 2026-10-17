// A small IndexedDB stand-in for the checks that run in Node: the part the game uses (open with an upgrade, one object store with a key path, getAll / put / delete in transactions),
// with failures that can be switched on (`fake.failPut`, `fake.failOpen`) and a shared `databases` map, so two "tabs" in the same process see the same data.
export function createFakeIndexedDB(databases = new Map()) {
  const fake = { databases, failPut: null, failOpen: null, failGetAll: null, puts: 0, factory: null };
  fake.factory = {
    open(name) {
      const request = { result: null, error: null };
      setTimeout(() => {
        if (fake.failOpen) { request.error = fake.failOpen; request.onerror?.(); return; }
        let db = databases.get(name);
        const fresh = !db;
        if (fresh) { db = { stores: new Map() }; databases.set(name, db); }
        const handle = {
          objectStoreNames: { contains: store => db.stores.has(store) },
          createObjectStore: (store, options) => { db.stores.set(store, { keyPath: options.keyPath, rows: new Map() }); },
          close() {}, onversionchange: null,
          transaction(store) {
            const target = db.stores.get(store);
            const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
            const finish = (fail, work) => { setTimeout(() => { if (fail) { tx.error = fail; tx.onerror?.(); tx.onabort?.(); } else { work?.(); tx.oncomplete?.(); } }, 0); };
            tx.objectStore = () => ({
              getAll() { const req = { result: [...target.rows.values()].map(row => structuredClone(row)) }; finish(fake.failGetAll); return req; },
              put(record) { const req = { result: record[target.keyPath] }; fake.puts++; finish(fake.failPut, () => target.rows.set(record[target.keyPath], structuredClone(record))); return req; },
              delete(key) { const req = { result: undefined }; finish(fake.failPut, () => target.rows.delete(key)); return req; }
            });
            return tx;
          }
        };
        request.result = handle;
        if (fresh) request.onupgradeneeded?.();
        request.onsuccess?.();
      }, 0);
      return request;
    }
  };
  return fake;
}
