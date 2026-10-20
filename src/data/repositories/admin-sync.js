// Network side of the shared admin archive: read it for every player, write it with the owner's session.
import { loadAdminArchive, loadSharedArchive, setSharedSessionToken, sharedCopyStored, sharedSessionToken, storeSharedArchive } from './admin-store.js?v=20261019-2';

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
