// Network side of the shared admin archive: read it for every player, write it with the owner's session.
import { loadAdminArchive, loadSharedArchive, setSharedSessionToken, sharedCopyStored, sharedSessionToken, storeSharedArchive } from './admin-store.js?v=20261021-6';

const PRODUCTION_API = 'https://palazzo-2026-site.bianchimatteo657.workers.dev/api/admin';
// On the Worker (and its local preview) the API is on the same site; GitHub Pages reads it from the Worker.
export function sharedApiUrl() {
  const location = globalThis.location;
  if (!location) return PRODUCTION_API;
  if (/workers\.dev$/.test(location.hostname) || location.port === '8791') return new URL('/api/admin', location.origin).href;
  if (/github\.io$/.test(location.hostname)) return PRODUCTION_API;
  // Any other published address (a custom domain on the Worker) has the API on the same site; a local copy has none.
  if (!/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname) && /^https:$/.test(location.protocol)) return new URL('/api/admin', location.origin).href;
  return null;
}
async function call(path = '', options = {}, timeout = 5000) {
  const base = sharedApiUrl();
  if (!base) throw Object.assign(new Error('L’archivio condiviso è disponibile sul sito pubblicato.'), { code: 'offline' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(base + path, { ...options, signal: controller.signal, headers: { 'content-type': 'application/json', ...(options.headers ?? {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || `Archivio condiviso non raggiungibile (${response.status}).`), { status: response.status });
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('L’archivio condiviso non risponde: si usa la copia salvata.'), { code: 'timeout' });
    throw error;
  } finally { clearTimeout(timer); }
}
// Reads the published archive and keeps a copy for offline play. Returns true when something changed.
// How the last attempt to read the published archive went: `ok` true only when the server answered. When it did not, the copy kept in this browser is in use and it may be
// out of date: nothing should call it "updated" (sharedSyncStatus tells the screens which of the two it is).
let syncStatus = { ok: null, at: null, error: null };
export const sharedSyncStatus = () => ({ ...syncStatus, copyStored: sharedCopyStored(), copyUpdatedAt: loadSharedArchive()?.updatedAt ?? null, hasCopy: Boolean(loadSharedArchive()) });
export async function refreshSharedArchive() {
  const before = JSON.stringify(loadSharedArchive() ?? null);
  try {
    const archive = await call('', { method: 'GET', cache: 'no-store' });
    storeSharedArchive(archive);
    syncStatus = { ok: true, at: new Date().toISOString(), error: null };
  } catch (error) { syncStatus = { ok: false, at: new Date().toISOString(), error: error.message || 'Archivio condiviso non raggiungibile.' }; return false; }
  const after = loadSharedArchive();
  return JSON.stringify({ ...after, fetchedAt: null }) !== JSON.stringify({ ...(JSON.parse(before) ?? {}), fetchedAt: null });
}
// The owner is whoever holds a session the server has just confirmed: a token in the browser is not enough.
let verifiedToken = null;
export async function openSharedSession(pin, setupCode = '') {
  const body = await call('/session', { method: 'POST', body: JSON.stringify({ pin, setupCode }) });
  setSharedSessionToken(body.token);
  verifiedToken = body.token;
  return body;
}
// Changes the owner's credential on the server (it checks the open session and the current credential, or the setup code). The browser keeps only the new session token.
export async function rotateSharedCredential({ currentPin = '', newPin, setupCode = '' }) {
  const token = sharedSessionToken();
  const body = await call('/credential', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify({ currentPin, newPin, setupCode }) });
  setSharedSessionToken(body.token);
  verifiedToken = body.token;
  return body;
}
export const hasSharedSession = () => Boolean(sharedSessionToken());
export const isAdminVerified = () => Boolean(verifiedToken) && verifiedToken === sharedSessionToken();
export async function verifySharedSession() {
  const token = sharedSessionToken();
  if (!token) { verifiedToken = null; return false; }
  try {
    await call('/session', { method: 'GET', headers: { authorization: `Bearer ${token}` } });
    verifiedToken = token;
    return true;
  } catch (error) {
    if (error.status === 401) closeSharedSession();
    verifiedToken = null;
    return false;
  }
}
export function closeSharedSession() { setSharedSessionToken(null); verifiedToken = null; }
// Publishes the archive in use (overrides and shared logos) for every player.
export async function publishSharedArchive(logoPatch = {}) {
  const token = sharedSessionToken();
  if (!token) throw new Error('Collega prima questo browser all’archivio condiviso.');
  const archive = loadAdminArchive();
  const logos = { ...(loadSharedArchive()?.logos ?? {}) };
  for (const [partyId, logo] of Object.entries(logoPatch)) { if (logo) logos[partyId] = { ...logo, updatedAt: new Date().toISOString() }; else delete logos[partyId]; }
  try {
    const result = await call('', { method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ parties: archive.parties, politicians: archive.politicians, logos, addedParties: archive.addedParties ?? {}, hidden: archive.hidden ?? {} }) }, 20000);
    // Published means the server answered with the date it wrote: anything else is not a confirmation.
    if (!result?.updatedAt) throw Object.assign(new Error('Il server non ha confermato la pubblicazione: le modifiche restano solo in questo browser.'), { code: 'unconfirmed' });
    const kept = storeSharedArchive({ ...archive, logos, updatedAt: result.updatedAt, configured: true });
    return { ...result, copyStored: kept };
  } catch (error) {
    if (error.status === 401) closeSharedSession();
    if (error.code === 'timeout') throw Object.assign(new Error('Il server non ha risposto in tempo: la pubblicazione non è confermata (le modifiche restano in questo browser, riprova).'), { code: 'timeout' });
    throw error;
  }
}

// ---- the shared logo catalog ----
// A logo is published when the server answered with the catalog entry it wrote: until then it exists only in this browser. Files travel as base64 in a JSON body (2 MB at most); the server
// checks the type from the bytes, the size, the SVG content and that the party exists, and stores the file under its hash, so publishing the same file again changes nothing.
const bytesToBase64 = bytes => { let binary = ''; for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000)); return btoa(binary); };
export const SHARED_LOGO_MAX_BYTES = 2 * 1024 * 1024;
// Where a catalog entry is read from: a published file (served by the Worker), a plain https address, or the data address the first versions kept.
export function sharedLogoSrc(logo) {
  if (!logo) return null;
  if (logo.kind === 'asset' && logo.assetPath) {
    const base = sharedApiUrl();
    return base ? new URL(logo.assetPath, base).href : null;
  }
  return logo.url ?? logo.dataUrl ?? null;
}
// Merges one catalog entry the server confirmed into the copy of the shared archive kept in this browser.
function keepCatalogEntry(entityId, entry, updatedAt) {
  const archive = loadSharedArchive() ?? {};
  const logos = { ...(archive.logos ?? {}) };
  if (entry) logos[entityId] = entry; else delete logos[entityId];
  return storeSharedArchive({ ...archive, logos, updatedAt: updatedAt ?? archive.updatedAt, configured: true });
}
const authorised = () => {
  const token = sharedSessionToken();
  if (!token) throw Object.assign(new Error('Collega prima questo browser all’archivio condiviso: senza la sessione amministrativa il logo resta solo in questo browser.'), { code: 'no-session' });
  return { authorization: `Bearer ${token}` };
};
function explain(error) {
  if (error.status === 401) { closeSharedSession(); return Object.assign(new Error('Sessione amministrativa scaduta: inserisci di nuovo il PIN. Il logo resta solo in questo browser.'), { status: 401, code: 'expired' }); }
  if (error.code === 'timeout') return Object.assign(new Error('Il server non ha risposto in tempo: il logo non è pubblicato (resta in questo browser, riprova).'), { code: 'timeout' });
  return error;
}
export async function publishLogoFile(entityId, blob, { alt = '', sourceUrl = null, fileName = null } = {}) {
  const headers = authorised();
  if (!(blob instanceof Blob) || blob.size < 1) throw new Error('File del logo non valido.');
  if (blob.size > SHARED_LOGO_MAX_BYTES) throw new Error('Il file supera i 2 MB: non si può pubblicare.');
  const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  try {
    const result = await call(`/logos/${encodeURIComponent(entityId)}`, { method: 'PUT', headers, body: JSON.stringify({ base64, alt, sourceUrl, fileName }) }, 20000);
    // Published means the server returned the entry it recorded: anything else is not a confirmation.
    if (!result?.ok || result.logo?.kind !== 'asset' || !result.logo.sha256) throw Object.assign(new Error('Il server non ha confermato la pubblicazione: il logo resta solo in questo browser.'), { code: 'unconfirmed' });
    keepCatalogEntry(entityId, result.logo, result.updatedAt);
    return result;
  } catch (error) { throw explain(error); }
}
export async function removeLogoFile(entityId) {
  const headers = authorised();
  try {
    const result = await call(`/logos/${encodeURIComponent(entityId)}`, { method: 'DELETE', headers }, 12000);
    if (!result?.ok) throw Object.assign(new Error('Il server non ha confermato la rimozione.'), { code: 'unconfirmed' });
    keepCatalogEntry(entityId, null, result.updatedAt);
    return result;
  } catch (error) { throw explain(error); }
}
// Moves the logos that the first versions kept inside the archive (data addresses) to files, once.
export async function migrateDataLogos() {
  const headers = authorised();
  try {
    const result = await call('/logos/migrate', { method: 'POST', headers, body: '{}' }, 30000);
    await refreshSharedArchive();
    return result;
  } catch (error) { throw explain(error); }
}
// Which of the logos kept in this browser are not (or no longer) the published ones: the same file, by its hash, is already published and needs nothing.
export async function sha256Of(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function publicationState(entityId, localRecord, localHash = null) {
  const shared = (loadSharedArchive()?.logos ?? {})[entityId] ?? null;
  const publishedHere = shared?.kind === 'asset' || shared?.kind === 'url' || shared?.kind === 'data';
  if (localRecord && !publishedHere) return { status: 'local', label: 'Solo in questo browser', shared: null };
  if (localRecord && shared?.kind === 'asset' && localHash && shared.sha256 !== localHash) return { status: 'outdated', label: 'Solo in questo browser: il logo pubblicato per tutti è un altro', shared };
  if (publishedHere) return { status: 'published', label: 'Pubblicato per tutti i giocatori', shared };
  return { status: 'none', label: 'Nessun logo caricato', shared: null };
}
