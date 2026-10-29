// The immutable real snapshot is fetched by collection. The 2 MB aggregate is
// retained for exports and validation, but the browser never downloads it.
export const REAL_DATA_ASSET_VERSION = '2026-10-22.1-2673331fad';

import { applyAdminOverrides } from './admin-store.js?v=20261029-2';
import { displayCase, withDisplayNames } from './name-case.js?v=20261029-2';

export let realDatabase = Object.freeze({});
// Untouched copies of what the files contain, so owner overrides can be re-layered or reverted.
const pristine = new Map();
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
  partyLeaderships: 'party-leaderships.json',
  laws: 'laws.json',
  // Permanent committees of the XIX legislature and their current members (dati.camera.it, dati.senato.it).
  committees: 'committees.json',
  committeeMemberships: 'committee-memberships.json',
  twoPerThousand: 'two-per-thousand.json',
  government: 'government.json',
  realPolls: 'polls.json',
  // ISTAT: supra-municipal units and every comune (Elenco dei comuni italiani, 21 February 2026).
  territorialUnits: 'territorial-units.json',
  municipalities: 'municipalities.json'
});
// Real documents that are not a list of records: loaded whole, when the game needs them.
const documentFiles = Object.freeze({
  // Electoral map of the general election of 2022 (Eligendo): districts, circoscrizioni, seats, results by list, comuni.
  electoralGeography: 'electoral-geography.json',
  // Last municipal election of every comune and last regional election of every region (Eligendo; verified sources).
  localElections: 'local-elections.json'
});
// Documents that may legitimately be missing: the game works without them and says so (loadOptionalRealDocument returns null, nothing is listed among the failures).
// municipalPopulation: population of the comuni (ISTAT), imported by scripts/import-istat-popolazione-comuni.mjs from the official files.
// italyBoundaries: outline of the regions and provinces for the geographic map (scripts/build-italy-boundaries.mjs, ISTAT via Openpolis, CC BY 4.0).
const optionalDocumentFiles = Object.freeze({ municipalPopulation: 'municipal-population.json', italyBoundaries: 'italy-boundaries.json' });
const loadingDocuments = new Map();
let manifestPromise;
// What could not be loaded (a collection, a document or the manifest) and why: the game starts with the rest and
// says what is missing; a later successful load removes the entry.
const failures = new Map();
export const realDataFailures = () => [...failures].map(([name, message]) => ({ name, message }));
const failed = (name, error) => { failures.set(name, error?.message || 'Caricamento non riuscito.'); throw error; };

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

const dataUrl = file => { const url = new URL(`../real/${file}`, import.meta.url); url.searchParams.set('v', REAL_DATA_ASSET_VERSION); return url; };
// Every real data file, for the offline cache: the optional documents too (the cache asks for them one by one and a file that is not there is skipped, never an error for the rest).
export const realDataUrls = () => ['manifest.json', ...Object.values(collectionFiles), ...Object.values(documentFiles), ...Object.values(optionalDocumentFiles)].map(file => dataUrl(file).href);
// A request that never answers must not leave the screen waiting for ever: every file has a time limit, and a late answer is an error the game shows (with «Riprova»), not a hang.
export const DATA_FILE_TIMEOUT_MS = 45000;
async function fetchJson(file) {
  const url = dataUrl(file);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), DATA_FILE_TIMEOUT_MS) : null;
  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`Dati reali non disponibili (${response.status}: ${file}).`);
    return await response.json();
  } catch (error) {
    if (controller?.signal.aborted) throw new Error(`Tempo scaduto nel caricamento di ${file}: controlla la connessione e riprova.`);
    throw error;
  } finally { if (timer) clearTimeout(timer); }
}

export async function loadRealDatabase() {
  if (!manifestPromise) {
    manifestPromise = fetchJson('manifest.json').then(manifest => {
      if (!manifest?.datasetVersion || !manifest?.snapshotDate || !manifest?.collections) {
        throw new Error('Il manifest dei dati reali non ha il formato previsto.');
      }
      realDatabase = Object.freeze({ ...realDatabase, manifest:freezeDeep(manifest) });
      failures.delete('manifest');
      return realDatabase;
    }).catch(error => {
      manifestPromise = null;
      failed('manifest', error);
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
        // Names in capitals (as some sources publish them) are shown in normal capitalisation; the source form stays in registeredName.
        records = withDisplayNames(name, records);
        pristine.set(name, freezeRecords(records));
        realDatabase = Object.freeze({ ...realDatabase, [name]: freezeRecords(applyAdminOverrides(name, records)) });
        failures.delete(name);
      }).catch(error => {
        loadingCollections.delete(name);
        failed(name, error);
      });
      loadingCollections.set(name, request);
    }
    return loadingCollections.get(name);
  }));
  return realDatabase;
}

// Like loadRealCollections, but one missing or damaged collection does not stop the others: every collection that
// arrives is loaded (with the same integrity checks), and the ones that fail are listed with their reason.
export async function loadRealCollectionsSettled(collections = []) {
  const names = [...new Set(collections)];
  const results = await Promise.allSettled(names.map(name => loadRealCollections([name])));
  const failedNames = names.map((name, index) => results[index].status === 'rejected' ? { name, message: results[index].reason?.message || 'Caricamento non riuscito.' } : null).filter(Boolean);
  return { loaded: names.filter(name => Object.hasOwn(realDatabase, name)), failed: failedNames };
}

// A real document (see documentFiles), loaded once and kept frozen in realDatabase under its name.
export async function loadRealDocument(name) {
  await loadRealDatabase();
  if (!documentFiles[name]) throw new Error(`Documento reale sconosciuto: ${name}`);
  if (Object.hasOwn(realDatabase, name)) return realDatabase[name];
  if (!loadingDocuments.has(name)) {
    loadingDocuments.set(name, fetchJson(documentFiles[name]).then(document => {
      if (!document || typeof document !== 'object' || Array.isArray(document) || document.source !== 'real') throw new Error(`Il documento ${name} non ha il formato previsto.`);
      // The lists of the 2022 map are published in capitals: shown in normal capitalisation, the source form kept.
      const shown = name === 'electoralGeography' && Array.isArray(document.lists) ? { ...document, lists: document.lists.map(item => { const cased = displayCase(item.name); return cased === item.name ? item : { ...item, name: cased, registeredName: item.name }; }) } : document;
      realDatabase = Object.freeze({ ...realDatabase, [name]: freezeDeep(shown) });
      failures.delete(name);
      return realDatabase[name];
    }).catch(error => {
      loadingDocuments.delete(name);
      failed(name, error);
    }));
  }
  return loadingDocuments.get(name);
}

// An optional real document (see optionalDocumentFiles): the document, or null when the file is not there, is not an import (status 'non-importato') or cannot be read. The reason is kept apart:
// optionalDocumentStatus(name) says 'loading', 'ready', 'missing' (the data set does not include it) or 'error' (the request failed, timed out or the file is not valid): a page can show each of
// them, and ask again (the request is repeated only after a failure, never while one is under way).
const optionalStatus = new Map();
const optionalPending = new Map();
export const OPTIONAL_DOCUMENT_TIMEOUT_MS = 20000;
export const optionalDocumentStatus = name => Object.hasOwn(realDatabase, name) ? { status: 'ready', reason: null } : (optionalStatus.get(name) ?? { status: 'idle', reason: null });
async function fetchJsonWithin(file, ms) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), ms) : null;
  try {
    const response = await fetch(dataUrl(file), controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`Dati reali non disponibili (${response.status}: ${file}).`);
    return await response.json();
  } catch (error) {
    if (controller?.signal.aborted) throw new Error(`Tempo scaduto nel caricamento di ${file}.`);
    throw error;
  } finally { if (timer) clearTimeout(timer); }
}
export function loadOptionalRealDocument(name) {
  if (!optionalDocumentFiles[name]) return Promise.reject(new Error(`Documento opzionale sconosciuto: ${name}`));
  if (Object.hasOwn(realDatabase, name)) return Promise.resolve(realDatabase[name]);
  if (optionalPending.has(name)) return optionalPending.get(name);
  optionalStatus.set(name, { status: 'loading', reason: null });
  const run = (async () => {
    // (the manifest says whether the file was imported: without the entry nothing is requested)
    try { await loadRealDatabase(); } catch (error) { optionalStatus.set(name, { status: 'error', reason: String(error?.message ?? error) }); return null; }
    if (!realDatabase.manifest?.documents?.[name]) { optionalStatus.set(name, { status: 'missing', reason: 'Il pacchetto dei dati reali non comprende questo documento.' }); return null; }
    try {
      const document = await fetchJsonWithin(optionalDocumentFiles[name], OPTIONAL_DOCUMENT_TIMEOUT_MS);
      if (document && typeof document === 'object' && !Array.isArray(document) && document.source === 'real' && document.status === 'non-importato') { optionalStatus.set(name, { status: 'missing', reason: 'Il documento non è stato importato.' }); return null; }
      if (!document || typeof document !== 'object' || Array.isArray(document) || document.source !== 'real' || !(Array.isArray(document.records) || Array.isArray(document.regions))) { optionalStatus.set(name, { status: 'error', reason: 'Il file non ha il formato previsto.' }); return null; }
      realDatabase = Object.freeze({ ...realDatabase, [name]: freezeDeep(document) });
      optionalStatus.set(name, { status: 'ready', reason: null });
      return realDatabase[name];
    } catch (error) { optionalStatus.set(name, { status: 'error', reason: String(error?.message ?? error) }); return null; }
  })().finally(() => optionalPending.delete(name));
  optionalPending.set(name, run);
  return run;
}

// Re-applies the owner archive after an edit, without reloading the files.
export function refreshAdminOverrides() {
  const updates = {};
  for (const [name, records] of pristine) updates[name] = freezeRecords(applyAdminOverrides(name, records.map(record => structuredClone(record))));
  realDatabase = Object.freeze({ ...realDatabase, ...updates });
  return realDatabase;
}
export function pristineRecord(collection, id) {
  return (pristine.get(collection) ?? []).find(item => item.id === id) ?? null;
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
