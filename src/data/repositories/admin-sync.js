// Network side of the shared admin archive: read it for every player, write it with the owner's session.
import { loadAdminArchive, loadSharedArchive, setSharedSessionToken, sharedSessionToken, storeSharedArchive } from './admin-store.js?v=20260924-19';

const PRODUCTION_API = 'https://palazzo-2026-site.bianchimatteo657.workers.dev/api/admin';
// On the Worker (and its local preview) the API is on the same site; GitHub Pages reads it from the Worker.
export function sharedApiUrl() {
  const location = globalThis.location;
  if (!location) return PRODUCTION_API;
  if (/workers\.dev$/.test(location.hostname) || location.port === '8791') return new URL('/api/admin', location.origin).href;
  if (/github\.io$/.test(location.hostname)) return PRODUCTION_API;
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
export async function refreshSharedArchive() {
  const before = JSON.stringify(loadSharedArchive() ?? null);
  try {
    const archive = await call('', { method: 'GET', cache: 'no-store' });
    storeSharedArchive(archive);
  } catch { return false; }
  const after = loadSharedArchive();
  return JSON.stringify({ ...after, fetchedAt: null }) !== JSON.stringify({ ...(JSON.parse(before) ?? {}), fetchedAt: null });
}
export async function openSharedSession(pin, setupCode = '') {
  const body = await call('/session', { method: 'POST', body: JSON.stringify({ pin, setupCode }) });
  setSharedSessionToken(body.token);
  return body;
}
export const hasSharedSession = () => Boolean(sharedSessionToken());
export function closeSharedSession() { setSharedSessionToken(null); }
// Publishes the archive in use (overrides and shared logos) for every player.
export async function publishSharedArchive(logoPatch = {}) {
  const token = sharedSessionToken();
  if (!token) throw new Error('Collega prima questo browser all’archivio condiviso.');
  const archive = loadAdminArchive();
  const logos = { ...(loadSharedArchive()?.logos ?? {}) };
  for (const [partyId, logo] of Object.entries(logoPatch)) { if (logo) logos[partyId] = { ...logo, updatedAt: new Date().toISOString() }; else delete logos[partyId]; }
  try {
    const result = await call('', { method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ parties: archive.parties, politicians: archive.politicians, logos }) });
    storeSharedArchive({ ...archive, logos, updatedAt: result.updatedAt, configured: true });
    return result;
  } catch (error) {
    if (error.status === 401) closeSharedSession();
    throw error;
  }
}
