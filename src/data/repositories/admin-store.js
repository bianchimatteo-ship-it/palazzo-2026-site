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
    { key: 'color', label: 'Colore identificativo', type: 'color' }
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
const COLLECTION_OF = Object.freeze({ parties: 'parties', politicalMovements: 'parties', politicians: 'politicians' });

const empty = () => ({ version: 1, updatedAt: null, parties: {}, politicians: {} });

function storageAvailable() {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch { return false; }
}
// Always read from storage: the archive stays the single source of truth across tabs and module reloads.
function loadLocalArchive() {
  if (!storageAvailable()) return empty();
  try {
    const parsed = JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') return { ...empty(), ...parsed, parties: parsed.parties ?? {}, politicians: parsed.politicians ?? {} };
  } catch { /* an unreadable archive is left untouched in storage */ }
  return empty();
}
export function loadSharedArchive() {
  if (!storageAvailable()) return null;
  try { return JSON.parse(localStorage.getItem(SHARED_KEY) ?? 'null'); } catch { return null; }
}
export function storeSharedArchive(archive) {
  if (!archive || typeof archive !== 'object') return;
  try { localStorage.setItem(SHARED_KEY, JSON.stringify({ version: 1, updatedAt: archive.updatedAt ?? null, parties: archive.parties ?? {}, politicians: archive.politicians ?? {}, logos: archive.logos ?? {}, configured: Boolean(archive.configured), fetchedAt: new Date().toISOString() })); } catch { /* the shared copy is only a cache */ }
}
export const sharedLogos = () => loadSharedArchive()?.logos ?? {};
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
  return { ...local, parties: merge('parties'), politicians: merge('politicians'), updatedAt: [local.updatedAt, shared.updatedAt].filter(Boolean).sort().at(-1) ?? null };
}
function persist(archive) {
  archive.updatedAt = new Date().toISOString();
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
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
  return text;
}

// Saves only the fields that differ from the original record; an emptied field is stored as null.
export function saveRecordOverride(collection, id, values, original = {}) {
  const kind = COLLECTION_OF[collection];
  if (!kind) throw new Error('Collezione non gestita.');
  const archive = loadAdminArchive();
  const fields = {};
  for (const field of ADMIN_FIELDS[kind]) {
    if (!(field.key in values)) continue;
    const value = cleanValue(field, values[field.key]);
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

// Layer the archive over a freshly loaded collection. Edited records say so explicitly.
export function applyAdminOverrides(collection, records) {
  const kind = COLLECTION_OF[collection];
  if (!kind) return records;
  const entries = loadAdminArchive()[kind];
  if (!Object.keys(entries).length) return records;
  return records.map(record => {
    const override = entries[record.id];
    if (!override) return record;
    return { ...record, ...(override.fields ?? {}), adminRoles: override.roles ?? [], adminEdited: { fields: Object.keys(override.fields ?? {}), updatedAt: override.updatedAt, source: 'user' } };
  });
}

export function adminArchiveSummary() {
  const archive = loadAdminArchive();
  return { parties: Object.keys(archive.parties).length, politicians: Object.keys(archive.politicians).length, updatedAt: archive.updatedAt };
}
export function exportAdminArchive() {
  return JSON.stringify({ ...loadAdminArchive(), exportedAt: new Date().toISOString(), format: 'politicando-admin-overrides' }, null, 2);
}
export function importAdminArchive(text) {
  const parsed = JSON.parse(text);
  if (parsed?.format !== 'politicando-admin-overrides' || typeof parsed.parties !== 'object' || typeof parsed.politicians !== 'object') throw new Error('Il file non è un archivio amministrativo di POLITICANDO.');
  return persist({ ...empty(), parties: parsed.parties, politicians: parsed.politicians });
}
export function clearAdminArchive() {
  localStorage.removeItem(ARCHIVE_KEY);
  localStorage.removeItem(SHARED_KEY);
  return empty();
}

// ---------- local lock ----------
async function digest(text) {
  if (globalThis.crypto?.subtle) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return [...text].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261).toString(16);
}
export function hasAdminPin() {
  return storageAvailable() && Boolean(localStorage.getItem(LOCK_KEY));
}
export async function setAdminPin(pin) {
  if (String(pin ?? '').length < 6) throw new Error('Il PIN deve avere almeno 6 caratteri.');
  const salt = Math.random().toString(36).slice(2, 12);
  localStorage.setItem(LOCK_KEY, JSON.stringify({ salt, hash: await digest(`${salt}|${pin}`) }));
  sessionStorage.setItem(SESSION_KEY, '1');
}
export async function unlockAdmin(pin) {
  const lock = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null');
  if (!lock || await digest(`${lock.salt}|${pin}`) !== lock.hash) throw new Error('PIN non corretto.');
  sessionStorage.setItem(SESSION_KEY, '1');
}
export function isAdminUnlocked() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
export function lockAdmin() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* nothing to lock */ }
}
