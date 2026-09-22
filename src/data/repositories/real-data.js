import database from '../real/database.json' with { type: 'json' };

// Immutable, versioned reference data. Simulation and user records live elsewhere.
export const realDatabase = Object.freeze(database);
export const realRepository = Object.freeze({
  all(collection) { return realDatabase[collection] ?? []; },
  find(collection, id) { return (realDatabase[collection] ?? []).find(item => item.id === id) ?? null; },
  search(collection, term) {
    const query = String(term ?? '').trim().toLocaleLowerCase('it-IT');
    if (!query) return realDatabase[collection] ?? [];
    return (realDatabase[collection] ?? []).filter(record => Object.values(record).some(value => typeof value === 'string' && value.toLocaleLowerCase('it-IT').includes(query)));
  },
  manifest: database.manifest
});
