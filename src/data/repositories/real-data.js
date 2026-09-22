// Load the versioned snapshot with fetch so browsers without JSON module imports work too.
export let realDatabase = Object.freeze({});
let loaded = false;

export async function loadRealDatabase() {
  if (loaded) return realDatabase;
  const url = new URL('../real/database.json', import.meta.url);
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Database politico non disponibile (${response.status}).`);
  const snapshot = await response.json();
  if (!Array.isArray(snapshot.parties) || !Array.isArray(snapshot.politicians) || !snapshot.manifest) {
    throw new Error('Il database politico pubblicato non ha il formato previsto.');
  }
  realDatabase = Object.freeze(snapshot);
  loaded = true;
  return realDatabase;
}

export const realRepository = Object.freeze({
  all(collection) { return realDatabase[collection] ?? []; },
  find(collection, id) { return (realDatabase[collection] ?? []).find(item => item.id === id) ?? null; },
  search(collection, term) {
    const query = String(term ?? '').trim().toLocaleLowerCase('it-IT');
    if (!query) return realDatabase[collection] ?? [];
    return (realDatabase[collection] ?? []).filter(record => Object.values(record).some(value => typeof value === 'string' && value.toLocaleLowerCase('it-IT').includes(query)));
  },
  get manifest() { return realDatabase.manifest ?? null; }
});
