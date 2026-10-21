// Owner edits live in their own browser archive and are layered over the real snapshot
// at load time: the JSON files in src/data/real are never rewritten.
const ARCHIVE_KEY = 'politicando.admin.overrides.v1';
// Copy of the shared archive kept on the server (same for every player), cached for offline play.
const SHARED_KEY = 'politicando.admin.shared.v1';
const SHARED_TOKEN_KEY = 'politicando.admin.shared-session.v1';
const LOCK_KEY = 'politicando.admin.lock.v1';
const SESSION_KEY = 'politicando.admin.session.v1';

export const ADMIN_FIELDS = Object.freeze({
  parties: [
    { key: 'officialName', label: 'Nome ufficiale', max: 160, required: true },
    { key: 'abbreviation', label: 'Sigla', max: 20 },
    { key: 'factualDescription', label: 'Descrizione', type: 'textarea', max: 1500 },
    { key: 'website', label: 'Sito web', type: 'url', max: 300 },
    { key: 'status', label: 'Stato', max: 80 },
    { key: 'level', label: 'Livello', max: 80 },
    { key: 'geographicArea', label: 'Area geografica', max: 160 },
    { key: 'foundedAt', label: 'Data di fondazione', type: 'date' },
    { key: 'politicalPosition', label: 'Collocazione', type: 'position' },
    // The only colour of a party: the one set here is the colour of the party everywhere (wizard, polls, campaigns, results, hemicycles). `color2` stays in old records as legacy data and is never shown or used.
    { key: 'color', label: 'Colore del partito', type: 'color' }
  ],
  politicians: [
    { key: 'fullName', label: 'Nome completo', max: 160, required: true },
    { key: 'firstName', label: 'Nome', max: 80 },
    { key: 'lastName', label: 'Cognome', max: 80 },
    { key: 'birthDate', label: 'Data di nascita', type: 'date' },
    { key: 'birthPlace', label: 'Luogo di nascita', max: 120 },
    { key: 'chamber', label: 'Camera', type: 'chamber' },
    { key: 'circoscription', label: 'Circoscrizione', max: 120 },
    { key: 'electedOnList', label: 'Lista d’elezione', max: 160 },
    { key: 'groupId', label: 'Gruppo parlamentare', type: 'group' },
    { key: 'partyId', label: 'Partito collegato', type: 'party' }
  ]
});
// The coalitions that stand as one list (Alleanza Verdi e Sinistra) are political forces of the game: the owner corrects their name, colour, position and logo like a party's.
const COLLECTION_OF = Object.freeze({ parties: 'parties', politicalMovements: 'parties', coalitions: 'parties', politicians: 'politicians' });
export const POSITIONS = Object.freeze(['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra']);

// addedParties: parties created by the owner; hidden: records the owner hid (or deleted, for added ones).
const empty = () => ({ version: 1, updatedAt: null, parties: {}, politicians: {}, addedParties: {}, hidden: {} });

function storageAvailable() {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch { return false; }
}
// Always read from storage: the archive stays the single source of truth across tabs and module reloads.
function loadLocalArchive() {
  if (!storageAvailable()) return empty();
  try {
    const parsed = JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') return { ...empty(), ...parsed, parties: parsed.parties ?? {}, politicians: parsed.politicians ?? {}, addedParties: parsed.addedParties ?? {}, hidden: parsed.hidden ?? {} };
  } catch { /* an unreadable archive is left untouched in storage */ }
  return empty();
}
// The last archive the server sent is also kept in memory: if this browser has no room to store it, the page in use still shows what the server published (the colours of the parties
// among them) and the screens can say that the copy could not be kept.
let memoryShared = null;
let sharedStored = true;
export function loadSharedArchive() {
  let stored = null;
  if (storageAvailable()) { try { stored = JSON.parse(localStorage.getItem(SHARED_KEY) ?? 'null'); } catch { stored = null; } }
  if (memoryShared && (!stored || String(memoryShared.fetchedAt ?? '') >= String(stored.fetchedAt ?? ''))) return memoryShared;
  return stored;
}
// Returns true when the copy is also written in the browser's storage.
export function storeSharedArchive(archive) {
  if (!archive || typeof archive !== 'object') return false;
  const copy = { version: 1, updatedAt: archive.updatedAt ?? null, parties: archive.parties ?? {}, politicians: archive.politicians ?? {}, logos: {}, addedParties: archive.addedParties ?? {}, hidden: archive.hidden ?? {}, configured: Boolean(archive.configured), fetchedAt: new Date().toISOString() };
  memoryShared = copy;
  try { localStorage.setItem(SHARED_KEY, JSON.stringify(copy)); sharedStored = true; } catch { sharedStored = false; }
  return sharedStored;
}
export const sharedCopyStored = () => sharedStored;
export function sharedSessionToken() { try { return sessionStorage.getItem(SHARED_TOKEN_KEY); } catch { return null; } }
export function setSharedSessionToken(token) { try { if (token) sessionStorage.setItem(SHARED_TOKEN_KEY, token); else sessionStorage.removeItem(SHARED_TOKEN_KEY); } catch { /* session only */ } }
// The archive in use: the shared one (published for everyone) with this browser's newer edits on top.
export function loadAdminArchive() {
  const local = loadLocalArchive();
  const shared = loadSharedArchive();
  if (!shared) return local;
  const merge = kind => {
    const result = { ...(shared[kind] ?? {}) };
    for (const [id, record] of Object.entries(local[kind] ?? {})) if (!result[id] || String(record.updatedAt ?? '') >= String(result[id].updatedAt ?? '')) result[id] = record;
    return result;
  };
  return { ...local, parties: merge('parties'), politicians: merge('politicians'), addedParties: merge('addedParties'), hidden: merge('hidden'), updatedAt: [local.updatedAt, shared.updatedAt].filter(Boolean).sort().at(-1) ?? null };
}
// The archive in use is the shared copy with this browser's edits on top, so a record the owner deletes (a reset, an edit back to the original values, «cancella tutto») must go from the shared copy too:
// otherwise the merge brings it back and the next publication sends it to the server again, with the page saying it was restored.
const ARCHIVE_KINDS = ['parties', 'politicians', 'addedParties', 'hidden'];
function pruneShared(archive) {
  const shared = loadSharedArchive();
  if (!shared) return;
  let changed = false;
  for (const kind of ARCHIVE_KINDS) for (const id of Object.keys(shared[kind] ?? {})) if (!(id in (archive[kind] ?? {}))) { delete shared[kind][id]; changed = true; }
  if (changed) storeSharedArchive(shared);
}
function persist(archive) {
  archive.updatedAt = new Date().toISOString();
  // A change is "saved" only if the browser took it: without room (or storage) nothing is kept, the archive stays as it was and the owner is told.
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive)); }
  catch (error) { throw new Error(/quota|exceed|full|spazio/i.test(`${error?.name} ${error?.message}`) ? 'Spazio del browser esaurito: la modifica non è stata salvata. Esporta l’archivio dell’Admin o libera spazio (le carriere non vengono toccate) e riprova.' : `La modifica non è stata salvata in questo browser (${error?.message || 'archivio non disponibile'}).`); }
  pruneShared(archive);
  return archive;
}

function cleanValue(field, value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (field.max && text.length > field.max) throw new Error(`${field.label}: massimo ${field.max} caratteri.`);
  if (field.type === 'url' && !/^https?:\/\/[^\s]+$/i.test(text)) throw new Error(`${field.label}: inserisci un indirizzo che inizi con http:// o https://.`);
  if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${field.label}: usa il formato AAAA-MM-GG.`);
  if (field.type === 'color' && !/^#[\da-f]{6}$/i.test(text)) throw new Error(`${field.label}: usa un colore esadecimale, per esempio #264d82.`);
  if (field.type === 'chamber' && !['camera', 'senato'].includes(text)) throw new Error(`${field.label}: scegli Camera o Senato.`);
  if (field.type === 'position' && !POSITIONS.includes(text)) throw new Error(`${field.label}: scegli una collocazione dell’elenco.`);
  return text;
}

// Saves only the fields that differ from the original record; an emptied field is stored as null.
export function saveRecordOverride(collection, id, values, original = {}) {
  const kind = COLLECTION_OF[collection];
  if (!kind) throw new Error('Collezione non gestita.');
  const archive = loadAdminArchive();
  const fields = {};
  // A party the owner added has no dataset record to compare with: what it was saved with is its original, so clearing a field (a colour, a sigla) is a change like any other.
  if (collection === 'parties' && archive.addedParties?.[id]) original = addedRecord(id, archive.addedParties[id]);
  for (const field of ADMIN_FIELDS[kind]) {
    if (!(field.key in values) && !(`${field.key}__off` in values)) continue;
    // A colour picker always holds a colour: «nessun colore» (the `__off` box) is how the owner says there is none, so an untouched form never invents one.
    const value = field.type === 'color' && values[`${field.key}__off`] ? null : cleanValue(field, values[field.key]);
    if (field.required && !value) throw new Error(`${field.label} è obbligatorio.`);
    if (value !== (original[field.key] ?? null)) fields[field.key] = value;
  }
  const current = archive[kind][id] ?? {};
  const next = { ...current, fields, updatedAt: new Date().toISOString() };
  if (!Object.keys(fields).length && !(next.roles ?? []).length) delete archive[kind][id];
  else archive[kind][id] = next;
  return persist(archive);
}
export function setRecordField(collection, id, key, value, original = {}) {
  const kind = COLLECTION_OF[collection];
  const field = ADMIN_FIELDS[kind].find(item => item.key === key);
  const archive = loadAdminArchive();
  const current = archive[kind][id] ?? { fields: {} };
  const fields = { ...current.fields };
  const clean = cleanValue(field, value);
  if (clean === (original[key] ?? null)) delete fields[key];
  else fields[key] = clean;
  archive[kind][id] = { ...current, fields, updatedAt: new Date().toISOString() };
  if (!Object.keys(fields).length && !(archive[kind][id].roles ?? []).length) delete archive[kind][id];
  return persist(archive);
}
export function addRoleOverride(id, role) {
  const title = cleanValue({ label: 'Incarico', max: 160 }, role.title);
  if (!title) throw new Error('Scrivi il nome dell’incarico.');
  const entry = {
    id: `incarico-admin-${Date.now().toString(36)}`, title,
    institution: cleanValue({ label: 'Istituzione', max: 160 }, role.institution),
    startDate: cleanValue({ label: 'Inizio', type: 'date' }, role.startDate),
    endDate: cleanValue({ label: 'Fine', type: 'date' }, role.endDate)
  };
  const archive = loadAdminArchive();
  const current = archive.politicians[id] ?? { fields: {} };
  archive.politicians[id] = { ...current, roles: [...(current.roles ?? []), entry], updatedAt: new Date().toISOString() };
  return persist(archive);
}
export function removeRoleOverride(id, roleId) {
  const archive = loadAdminArchive();
  const current = archive.politicians[id];
  if (!current) return archive;
  current.roles = (current.roles ?? []).filter(role => role.id !== roleId);
  if (!Object.keys(current.fields ?? {}).length && !current.roles.length) delete archive.politicians[id];
  return persist(archive);
}
export function resetRecordOverride(collection, id) {
  const kind = COLLECTION_OF[collection];
  const archive = loadAdminArchive();
  delete archive[kind][id];
  return persist(archive);
}
export function overrideFor(collection, id) {
  const kind = COLLECTION_OF[collection];
  return kind ? loadAdminArchive()[kind][id] ?? null : null;
}

// ---------- parties added, hidden or deleted by the owner (never written into the real files) ----------
const nameKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]/g, '');
const slug = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'partito';
const PARTY_FIELDS = ['officialName', 'abbreviation', 'factualDescription', 'website', 'politicalPosition', 'color'];
// existing: every party and movement in use (real and added), to refuse duplicates of names, aliases and initials.
export function addAdminParty(values, existing = []) {
  const clean = {};
  for (const key of PARTY_FIELDS) { const field = ADMIN_FIELDS.parties.find(item => item.key === key); clean[key] = field.type === 'color' && values[`${key}__off`] ? null : cleanValue(field, values[key]); }
  clean.color2 = null; // the only colour of a party is the primary one (legacy field kept empty in the data)
  if (!clean.officialName) throw new Error('Il nome ufficiale è obbligatorio.');
  const names = new Set(existing.flatMap(item => [item.officialName, item.name, ...(item.aliases ?? []).map(alias => alias.name)]).filter(Boolean).map(nameKey));
  if (names.has(nameKey(clean.officialName))) throw new Error('Esiste già un partito o movimento con questo nome.');
  if (clean.abbreviation && existing.some(item => item.abbreviation && nameKey(item.abbreviation) === nameKey(clean.abbreviation))) throw new Error('Questa sigla è già usata da un altro partito.');
  const archive = loadAdminArchive();
  const id = `admin-party-${slug(clean.officialName)}-${Date.now().toString(36).slice(-4)}`;
  const now = new Date().toISOString();
  archive.addedParties[id] = { ...clean, createdAt: now, updatedAt: now };
  persist(archive);
  return id;
}
export function setRecordHidden(id, hidden, { deleted = false } = {}) {
  const archive = loadAdminArchive();
  archive.hidden[id] = { hidden: Boolean(hidden), deleted: Boolean(hidden && deleted), updatedAt: new Date().toISOString() };
  return persist(archive);
}
const addedRecord = (id, party) => ({
  id, entityType: 'party', officialName: party.officialName, abbreviation: party.abbreviation ?? null, factualDescription: party.factualDescription ?? null, color: party.color ?? null, color2: party.color2 ?? null,
  website: party.website ?? null, politicalPosition: party.politicalPosition ?? null, level: null, geographicArea: null, regionId: null, status: 'active', parliamentaryPresence: null, regionalPresence: null, localPresence: null,
  foundedAt: null, registeredAt: null, leadership: [], logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: `Logo di ${party.officialName}`,
  source: 'user', verified: false, sourceUrl: party.website ?? null, sourceName: 'Aggiunto dall’amministratore del gioco', adminCreated: { createdAt: party.createdAt ?? null, updatedAt: party.updatedAt ?? null, source: 'user' }
});

// Layer the archive over a freshly loaded collection. Edited, added and hidden records say so explicitly.
export function applyAdminOverrides(collection, records) {
  const kind = COLLECTION_OF[collection];
  if (!kind) return records;
  const archive = loadAdminArchive();
  const entries = archive[kind];
  const added = collection === 'parties' ? Object.entries(archive.addedParties ?? {}).map(([id, party]) => addedRecord(id, party)) : [];
  const hidden = kind === 'parties' ? archive.hidden ?? {} : {};
  if (!Object.keys(entries).length && !added.length && !Object.values(hidden).some(item => item.hidden)) return records;
  return [...records, ...added].map(record => {
    const override = entries[record.id];
    const concealed = hidden[record.id]?.hidden ? { adminHidden: true, adminDeleted: Boolean(hidden[record.id].deleted) } : {};
    if (!override) return Object.keys(concealed).length ? { ...record, ...concealed } : record;
    return { ...record, ...(override.fields ?? {}), ...concealed, adminRoles: override.roles ?? [], adminEdited: { fields: Object.keys(override.fields ?? {}), updatedAt: override.updatedAt, source: 'user' } };
  });
}

export function adminArchiveSummary() {
  const archive = loadAdminArchive();
  return { parties: Object.keys(archive.parties).length, politicians: Object.keys(archive.politicians).length, added: Object.keys(archive.addedParties ?? {}).length, hidden: Object.values(archive.hidden ?? {}).filter(item => item.hidden).length, updatedAt: archive.updatedAt };
}
export function exportAdminArchive() {
  return JSON.stringify({ ...loadAdminArchive(), exportedAt: new Date().toISOString(), format: 'politicando-admin-overrides' }, null, 2);
}
export function importAdminArchive(text) {
  const parsed = JSON.parse(text);
  if (parsed?.format !== 'politicando-admin-overrides' || typeof parsed.parties !== 'object' || typeof parsed.politicians !== 'object') throw new Error('Il file non è un archivio amministrativo di POLITICANDO.');
  return persist({ ...empty(), parties: parsed.parties, politicians: parsed.politicians, addedParties: parsed.addedParties ?? {}, hidden: parsed.hidden ?? {} });
}
// «Cancella tutto»: the corrections, the links, the added and the hidden records go, in this browser and in the shared copy (the next publication then empties them on the server); the logos stay,
// they have their own area and the owner did not ask to lose them.
export function clearAdminArchive() {
  try { localStorage.removeItem(ARCHIVE_KEY); } catch { /* nothing was stored */ }
  const shared = loadSharedArchive();
  if (shared) storeSharedArchive({ ...shared, parties: {}, politicians: {}, addedParties: {}, hidden: {} });
  return empty();
}

// The owner is recognised only by the server (admin-sync.js): a browser can no longer create its own admin PIN.
