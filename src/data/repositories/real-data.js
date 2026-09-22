// The immutable real snapshot is fetched by collection. The 2 MB aggregate is
// retained for exports and validation, but the browser never downloads it.
export const REAL_DATA_ASSET_VERSION = '20260923-1';

export let realDatabase = Object.freeze({});
const loadingCollections = new Map();
const collectionFiles = Object.freeze({
  parties: 'parties.json',
  politicalMovements: 'political-movements.json',
  parliamentaryGroups: 'parliamentary-groups.json',
  coalitions: 'coalitions.json',
  electoralLists: 'electoral-lists.json',
  politicians: 'politicians.json',
  offices: 'offices.json',
  partyMemberships: 'party-memberships.json',
  groupMemberships: 'group-memberships.json',
  electionParticipations: 'election-participations.json',
  partyMembershipHistory: 'party-membership-history.json',
  parliamentaryGroupHistory: 'parliamentary-group-history.json',
  officeHistory: 'office-history.json',
  territories: 'territories.json',
  elections: 'elections.json',
  chambers: 'chambers.json',
  politicalFigures: 'political-figures.json',
  partyLeaderships: 'party-leaderships.json'
});
let manifestPromise;

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function freezeRecords(records) {
  return Object.freeze(records.map(record => freezeDeep(record)));
}

async function fetchJson(file) {
  const url = new URL(`../real/${file}`, import.meta.url);
  url.searchParams.set('v', REAL_DATA_ASSET_VERSION);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Dati reali non disponibili (${response.status}: ${file}).`);
  return response.json();
}

export async function loadRealDatabase() {
  if (!manifestPromise) {
    manifestPromise = fetchJson('manifest.json').then(manifest => {
      if (!manifest?.datasetVersion || !manifest?.snapshotDate || !manifest?.collections) {
        throw new Error('Il manifest dei dati reali non ha il formato previsto.');
      }
      realDatabase = Object.freeze({ ...realDatabase, manifest:freezeDeep(manifest) });
      return realDatabase;
    }).catch(error => {
      manifestPromise = null;
      throw error;
    });
  }
  return manifestPromise;
}

export async function loadRealCollections(collections = []) {
  await loadRealDatabase();
  const names = [...new Set(collections)];
  await Promise.all(names.map(name => {
    if (!collectionFiles[name]) throw new Error(`Collezione reale sconosciuta: ${name}`);
    if (Object.hasOwn(realDatabase, name)) return Promise.resolve();
    if (!loadingCollections.has(name)) {
      const request = fetchJson(collectionFiles[name]).then(records => {
        if (!Array.isArray(records)) throw new Error(`La collezione ${name} non contiene un elenco valido.`);
        const expected = realDatabase.manifest.collections[name];
        if (Number.isInteger(expected) && records.length !== expected) {
          throw new Error(`La collezione ${name} è incompleta (${records.length}/${expected}).`);
        }
        realDatabase = Object.freeze({ ...realDatabase, [name]: freezeRecords(records) });
      }).catch(error => {
        loadingCollections.delete(name);
        throw error;
      });
      loadingCollections.set(name, request);
    }
    return loadingCollections.get(name);
  }));
  return realDatabase;
}

export function isRealCollectionLoaded(collection) {
  return Object.hasOwn(realDatabase, collection);
}

export const realRepository = Object.freeze({
  load: loadRealCollections,
  all(collection) { return realDatabase[collection] ?? []; },
  find(collection, id) { return (realDatabase[collection] ?? []).find(item => item.id === id) ?? null; },
  search(collection, term) {
    const query = String(term ?? '').trim().toLocaleLowerCase('it-IT');
    const records = realDatabase[collection] ?? [];
    if (!query) return records;
    return records.filter(record => Object.values(record).some(value => typeof value === 'string' && value.toLocaleLowerCase('it-IT').includes(query)));
  },
  get manifest() { return realDatabase.manifest ?? null; }
});
