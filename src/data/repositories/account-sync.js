// Player accounts and online saves. The browser keeps a local copy (offline play, quick resume), while the account
// keeps the careers on the server (Cloudflare D1) so they can be recovered on any device.
// The password never leaves the browser: it is stretched here (PBKDF2-SHA-256, 310 000 iterations) and only that
// proof is sent; the server hashes it again with its own random salt.
//
// Three things are never confused (protocol 2, see worker.js):
//   - the LOCAL revision: saveMeta.revision inside the game, it counts the saves of this browser;
//   - the SERVER revision: the version kept online, it only grows;
//   - the version a snapshot comes from: the server revision this device really held when it made the copy.
// The last one is kept per CAREER (not per slot name and not per account) together with what the copy was when it was synced (its local revision and how far it had got). A copy
// goes online only if it descends from that: an older copy with the same name does not inherit the newest revision. Without that proof (a copy that was never linked, a record written by
// the old protocol) nothing is uploaded automatically: the player reconciles first.
import { hiddenOwner, releaseCareersOf } from './career-visibility.js?v=20261022-15';
const PRODUCTION_ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const ACCOUNT_KEY = 'politicando.account.v1';
// The old record (revision per slot and per account, with no provenance): never trusted again to authorize an upload; kept only so that nothing is erased.
const REVISIONS_KEY = 'politicando.account.revisions.v1';
const LINKS_KEY = 'politicando.sync.links.v2';
const LOCAL_USE_KEY = 'politicando.sync.local-use.v1';
// Sessions that could not be ended on the server at logout (offline): ended at the next occasion.
const REVOKE_KEY = 'politicando.account.revoke.v1';
export const PASSWORD_MIN = 8;
export const USERNAME_RULE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const encoder = new TextEncoder();

const read = key => { try { return JSON.parse(globalThis.localStorage?.getItem(key) ?? 'null'); } catch { return null; } };
const write = (key, value) => { try { if (value === null) globalThis.localStorage?.removeItem(key); else globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };

// Where the API lives: on the Worker (and its local preview) it is the same site; GitHub Pages uses the Worker.
// The installed app (Capacitor) runs on its own origin (capacitor://localhost, https://localhost): the account service is always the published Worker.
export const isNativeApp = () => globalThis.Capacitor?.isNativePlatform?.() === true || globalThis.location?.protocol === 'capacitor:';
// Where the public pages of the game live (privacy, terms, account deletion): the same site on the web, the published site inside the app.
export function publicSiteBase() {
  const location = globalThis.location;
  return !location || location.protocol === 'file:' || isNativeApp() ? `${PRODUCTION_ORIGIN}/` : '';
}
export function accountApiBase() {
  const location = globalThis.location;
  if (!location || isNativeApp()) return PRODUCTION_ORIGIN;
  if (/workers\.dev$/.test(location.hostname) || location.port === '8791' || location.hostname === '127.0.0.1') return location.origin;
  if (/github\.io$/.test(location.hostname)) return PRODUCTION_ORIGIN;
  return null;
}
// Is the account service really there? A short request to the Worker's status route: an answer from the service
// (even “not signed in”, from an older Worker) means available; no answer, a timeout, a server error or a page that is
// not the service (a static host without the Worker) means unreachable. Without an address: 'none'.
export async function probeAccountService({ timeout = 5000, details = null } = {}) {
  const base = accountApiBase();
  if (!base) return 'none';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${base}/api/account/status`, { signal: controller.signal, cache: 'no-store' });
    const type = response.headers?.get?.('content-type') ?? '';
    if (response.status >= 500 || !type.includes('application/json')) return 'unreachable';
    const body = await response.json();
    if (details && typeof details === 'object') Object.assign(details, { email: body?.email === true, emailRequired: body?.emailRequired === true, features: Array.isArray(body?.features) ? body.features : [] });
    return 'available';
  } catch { return 'unreachable'; }
  finally { clearTimeout(timer); }
}
export const currentAccount = () => { const value = read(ACCOUNT_KEY); return value?.username && value?.token ? value : null; };
export const normalizeUsername = value => String(value ?? '').trim().toLowerCase();
export const slotForCareer = careerId => `c-${String(careerId ?? 'carriera').toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 40);

// ---------- what a copy of a career is: where it comes from and how far it got ----------
const careerIdOf = state => String(state?.career?.id ?? '');
export const localRevisionOf = state => Number.isSafeInteger(state?.saveMeta?.revision) ? state.saveMeta.revision : 0;
// The same reading of the progress as the browser's storage and as the server: date, week of the game, week number, elections held.
export const progressOf = state => [String(state?.clock?.currentDate ?? '').slice(0, 10), Number(state?.game?.week?.index ?? 0) || 0, Number(state?.game?.week?.number ?? 0) || 0, (state?.career?.electionHistory ?? []).length];
export function compareProgress(left, right) {
  const a = Array.isArray(left) ? left : [], b = Array.isArray(right) ? right : [];
  for (let index = 0; index < 4; index++) {
    if (a[index] === b[index]) continue;
    return (index === 0 ? String(a[index] ?? '') > String(b[index] ?? '') : Number(a[index] ?? 0) > Number(b[index] ?? 0)) ? 1 : -1;
  }
  return 0;
}
// The link of a career to the online copy: which account holds it, the server revision this device has, and the copy (local revision, progress) that revision corresponds to.
const links = () => { const value = read(LINKS_KEY); return value?.links && typeof value.links === 'object' ? value.links : {}; };
const writeLinks = next => write(LINKS_KEY, { version: 2, links: next });
export const linkRecord = careerId => links()[String(careerId)] ?? null;
// Only a link of the account that is signed in counts: a career linked to another account is not this account's.
export function linkOf(careerId, username = currentAccount()?.username) {
  const link = linkRecord(careerId);
  return link && username && link.username === normalizeUsername(username) ? link : null;
}
export const linkBySlot = (slot, username = currentAccount()?.username) => Object.entries(links()).map(([careerId, link]) => ({ careerId, ...link })).find(link => link.slot === slot && username && link.username === normalizeUsername(username)) ?? null;
export const ownerOf = careerId => linkRecord(careerId)?.username ?? null;
export function setLink(state, revision, { slot = slotForCareer(careerIdOf(state)), username = currentAccount()?.username } = {}) {
  if (!Number.isFinite(revision) || !username || !careerIdOf(state)) return null;
  const record = { username: normalizeUsername(username), slot, revision, localRevision: localRevisionOf(state), progress: progressOf(state), syncedAt: new Date().toISOString() };
  writeLinks({ ...links(), [careerIdOf(state)]: record });
  return record;
}
// «Use it locally»: the player chose to go on with a career that is linked to an account that is not signed in (or to another one) on this device only. Nothing is deleted and the link stays (it
// says whose the online copy is); the career is simply never synced from here until the player takes it back (`stopUsingLocally`) or its owner signs in and links it again.
const localUse = () => { const value = read(LOCAL_USE_KEY); return value?.careers && typeof value.careers === 'object' ? value.careers : {}; };
export const usedLocally = careerId => Boolean(localUse()[String(careerId)]);
export function useLocally(careerId) {
  write(LOCAL_USE_KEY, { version: 1, careers: { ...localUse(), [String(careerId)]: { since: new Date().toISOString(), owner: ownerOf(careerId) } } });
  // the choice counts only if the browser kept it
  if (!usedLocally(careerId)) throw new Error('Il browser non ha registrato la scelta (spazio esaurito?): la carriera non è stata segnata come solo locale.');
}
export function stopUsingLocally(careerId) { const next = { ...localUse() }; delete next[String(careerId)]; write(LOCAL_USE_KEY, { version: 1, careers: next }); }
// Is this career's link a question for the player now? A career linked to an account is normal to continue only for that account (signed in), or after the choice «use it locally».
// Returns null (nothing to ask: an anonymous career, the owner is signed in, already used locally) or { owner, signedIn }.
export function careerGate(careerId, username = currentAccount()?.username ?? null) {
  // after a logout every career of the device is reserved to the account that left: nobody else sees it, not even through «use it locally»
  const reserved = hiddenOwner(careerId);
  if (reserved && reserved !== normalizeUsername(username)) return { owner: reserved, signedIn: username ? normalizeUsername(username) : null, hidden: true };
  const owner = ownerOf(careerId);
  if (!owner || usedLocally(careerId)) return null;
  if (username && owner === normalizeUsername(username)) return null;
  return { owner, signedIn: username ? normalizeUsername(username) : null };
}
export function unlinkCareer(careerId) { const next = { ...links() }; delete next[String(careerId)]; writeLinks(next); }
// The revision this device holds for a slot of the signed-in account, only if a copy was really linked to it (the old per-slot numbers prove nothing).
export const knownRevision = slot => linkBySlot(slot)?.revision ?? null;
// The revision of a downloaded game once it really replaced the running one: it moves only then.
export const commitRevision = (slot, revision, state) => { if (state) setLink(state, revision, { slot }); };
// Does this copy descend from the version that was synced? 'ok', 'older' (it is behind what was synced, or it is an earlier save of the same career), 'unlinked' (no proof of where it comes from).
export function descends(state, link) {
  if (!link) return 'unlinked';
  if (compareProgress(progressOf(state), link.progress) < 0 || localRevisionOf(state) < (link.localRevision ?? 0)) return 'older';
  return 'ok';
}
// Everything linked to this device that belongs to somebody else than the signed-in account stays untouched.
export const forgetLinksOf = username => writeLinks(Object.fromEntries(Object.entries(links()).filter(([, link]) => link.username !== normalizeUsername(username))));

const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
export async function passwordProof(username, password) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(`politicando-2026|account|${normalizeUsername(username)}`), iterations: 310_000 }, key, 256));
}

const listeners = new Set();
// Who wants to know that the session ended (expired, other tab): the interface and the queue of the saves stop.
export const onAccountEnd = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const sessionEnded = reason => { for (const fn of listeners) { try { fn(reason); } catch { /* a listener never breaks the call */ } } };

async function call(path, { method = 'GET', body = null, auth = true, timeout = 12000, token = null } = {}) {
  const base = accountApiBase();
  if (!base) throw Object.assign(new Error('Gli account funzionano sul sito pubblicato: da qui la partita resta salvata nel browser.'), { code: 'offline' });
  const account = currentAccount();
  const bearer = token ?? (auth && account ? account.token : null);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(base + path, { method, signal: controller.signal, headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: body === null ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && auth && !token) { write(ACCOUNT_KEY, null); sessionEnded('session-expired'); }
    if (!response.ok) throw Object.assign(new Error(data.error || `Servizio account non raggiungibile (${response.status}).`), { status: response.status, data });
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Il servizio account non risponde: la partita resta salvata nel browser.'), { code: 'timeout' });
    if (error instanceof TypeError) throw Object.assign(new Error('Connessione assente: la partita resta salvata nel browser e verrà sincronizzata.'), { code: 'offline' });
    throw error;
  } finally { clearTimeout(timer); }
}
function checkCredentials(username, password) {
  if (!USERNAME_RULE.test(normalizeUsername(username))) throw new Error('Nome utente: da 3 a 24 caratteri tra lettere minuscole, numeri, punto, trattino e trattino basso.');
  if (String(password ?? '').length < PASSWORD_MIN) throw new Error(`La password deve avere almeno ${PASSWORD_MIN} caratteri.`);
}
const startSession = body => write(ACCOUNT_KEY, { username: body.username, token: body.token, since: new Date().toISOString() });
export async function register(username, password, { email = '' } = {}) {
  checkCredentials(username, password);
  const mail = String(email ?? '').trim();
  const body = await call('/api/account/register', { method: 'POST', auth: false, body: { username: normalizeUsername(username), proof: await passwordProof(username, password), ...(mail ? { email: mail } : {}) } });
  startSession(body);
  return body;
}
export async function login(username, password) {
  checkCredentials(username, password);
  const body = await call('/api/account/login', { method: 'POST', auth: false, body: { username: normalizeUsername(username), proof: await passwordProof(username, password) } });
  startSession(body);
  return body;
}
// Ends the session here at once (nothing of the account is used from this moment) and on the server when it can be reached; if it cannot, the session is remembered and ended later.
// What is saved in this browser is not touched: the careers stay, only the account is gone.
export async function logout() {
  const account = currentAccount();
  write(ACCOUNT_KEY, null);
  sessionEnded('logout');
  if (!account) return { ended: false };
  try { await call('/api/account/logout', { method: 'POST', token: account.token }); return { ended: true, server: true }; }
  catch (error) {
    if (error.status === 401) return { ended: true, server: true };
    write(REVOKE_KEY, [...(read(REVOKE_KEY) ?? []), account.token].slice(-5));
    return { ended: true, server: false };
  }
}
// Sessions whose end could not reach the server: tried again whenever the service answers.
export async function flushRevocations() {
  const pending = read(REVOKE_KEY) ?? [];
  if (!pending.length) return 0;
  const left = [];
  for (const token of pending) {
    try { await call('/api/account/logout', { method: 'POST', token }); }
    catch (error) { if (error.status !== 401) left.push(token); }
  }
  write(REVOKE_KEY, left.length ? left : null);
  return pending.length - left.length;
}
// Deletes the account and everything kept online for it (saves, sessions). The password is proved again and the word ELIMINA typed; what stays on this device (the saves of
// the browser) is not touched. Nothing is forgotten locally unless the server confirmed the deletion.
export async function deleteAccount(password, confirm) {
  const account = currentAccount();
  if (!account) throw new Error('Accedi per eliminare l’account.');
  if (String(password ?? '').length < PASSWORD_MIN) throw new Error(`Inserisci la password dell’account (almeno ${PASSWORD_MIN} caratteri).`);
  if (String(confirm ?? '').trim() !== 'ELIMINA') throw new Error('Per confermare scrivi ELIMINA.');
  const body = await call('/api/account', { method: 'DELETE', body: { proof: await passwordProof(account.username, password), confirm: 'ELIMINA' } });
  write(ACCOUNT_KEY, null); write(REVISIONS_KEY, null); forgetLinksOf(account.username); releaseCareersOf(account.username);
  sessionEnded('deleted');
  return body;
}
// After the account of `username` was deleted elsewhere (the public deletion page): this browser forgets its session if it was the same account.
export function forgetAccountIf(username) {
  if (currentAccount()?.username === normalizeUsername(username)) { write(ACCOUNT_KEY, null); write(REVISIONS_KEY, null); forgetLinksOf(username); releaseCareersOf(username); sessionEnded('deleted'); return true; }
  return false;
}
export const accountInfo = () => call('/api/account/me');

// ---------- e-mail and recovery of the password ----------
export async function addEmail(email, password) {
  const account = currentAccount();
  if (!account) throw new Error('Accedi per collegare un indirizzo email.');
  if (String(password ?? '').length < PASSWORD_MIN) throw new Error(`Inserisci la password dell’account (almeno ${PASSWORD_MIN} caratteri).`);
  return call('/api/account/email', { method: 'POST', body: { email: String(email ?? '').trim(), proof: await passwordProof(account.username, password) } });
}
export async function resendVerification(password) {
  const account = currentAccount();
  if (!account) throw new Error('Accedi per ricevere di nuovo il messaggio di verifica.');
  return call('/api/account/email/resend', { method: 'POST', body: { proof: await passwordProof(account.username, password) } });
}
export const verifyEmail = token => call('/api/account/email/verify', { method: 'POST', auth: false, body: { token } });
export const requestPasswordRecovery = email => call('/api/account/recover', { method: 'POST', auth: false, body: { email: String(email ?? '').trim() } });
export const checkResetToken = token => call('/api/account/reset/check', { method: 'POST', auth: false, body: { token } });
// The new password is stretched here, with the user name the link belongs to: the server only ever receives the proof.
export async function resetPassword(token, username, password) {
  checkCredentials(username, password);
  return call('/api/account/reset', { method: 'POST', auth: false, body: { token, proof: await passwordProof(username, password) } });
}

export async function listCloudSaves() {
  const body = await call('/api/saves');
  return body.saves ?? [];
}

// Saves travel compressed when the browser can (gzip + base64), otherwise as plain JSON.
async function pack(state) {
  const text = JSON.stringify(state);
  if (typeof CompressionStream === 'undefined') return { data: text, encoding: 'json' };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { data: btoa(binary), encoding: 'gzip-base64' };
}
async function unpack({ data, encoding }) {
  if (encoding === 'json') return JSON.parse(data);
  const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
const refusal = (code, message, status = 409, data = {}) => Object.assign(new Error(message), { status, data: { conflict: true, code, ...data }, local: true });
// Uploads a career in the normal, automatic way. It goes only if this copy can prove where it comes from: the career is linked to this account and the copy is not behind what was synced
// (otherwise it is refused here, before any request). A copy never linked can create the online one only when the caller says it is new (`create`), and the server still refuses if one exists.
// Whatever the server decides (stale revision, a copy that is behind the career online) is final: there is no way to force it from here; replacing the online version is `restoreSave`.
export async function uploadSave(slot, state, { name = null, meta = {}, create = false } = {}) {
  const account = currentAccount();
  if (!account) throw Object.assign(new Error('Accedi per salvare online.'), { status: 401 });
  if (slotForCareer(careerIdOf(state)) !== slot) throw refusal('slot-mismatch', 'La carriera non corrisponde allo slot online.', 400);
  const link = linkOf(careerIdOf(state));
  let baseRevision = 0;
  if (link) {
    if (descends(state, link) !== 'ok') throw refusal('stale-copy', 'Questa copia è più indietro di quella già sincronizzata: non va online.');
    baseRevision = link.revision;
  } else if (!create) throw refusal('unlinked', 'Questa copia non è collegata alla carriera online: scegli come riconciliarla.');
  const packed = await pack(state);
  const body = await call(`/api/saves/${encodeURIComponent(slot)}`, { method: 'PUT', body: { ...packed, name, meta, baseRevision, origin: { localRevision: localRevisionOf(state) } } });
  setLink(state, body.revision, { slot });
  return body;
}
// The player's explicit choice to replace the online version with the copy of this device. It names the revision the player saw; the replaced version is kept by the server (history) and the
// new revision is higher than any before.
export async function restoreSave(slot, state, { expectedRevision, name = null, meta = {} } = {}) {
  if (!Number.isInteger(expectedRevision)) throw refusal('base-missing', 'Indica la revisione online che hai visto.', 400);
  if (slotForCareer(careerIdOf(state)) !== slot) throw refusal('slot-mismatch', 'La carriera non corrisponde allo slot online.', 400);
  const packed = await pack(state);
  const body = await call(`/api/saves/${encodeURIComponent(slot)}/restore`, { method: 'POST', body: { ...packed, name, meta, expectedRevision } });
  setLink(state, body.revision, { slot });
  return body;
}
// A version of the history becomes the online one again (the server keeps the one it replaces). The game of the player changes only when the caller downloads it afterwards.
export const restoreFromHistory = (slot, historyId, expectedRevision) => call(`/api/saves/${encodeURIComponent(slot)}/restore`, { method: 'POST', body: { historyId, expectedRevision } });
export async function listSaveHistory(slot) { return (await call(`/api/saves/${encodeURIComponent(slot)}/history`)).history ?? []; }
export async function downloadHistoryVersion(slot, id) {
  const body = await call(`/api/saves/${encodeURIComponent(slot)}/history/${Number(id)}`);
  return { state: await unpack(body), revision: body.revision, name: body.name, meta: body.meta };
}
// commit: false leaves the link as it is, for who commits it (commitRevision) only once the game has really replaced the running one: a download that
// is refused (a newer version, a backup that failed) must not make this device believe it holds a revision it does not.
export async function downloadSave(slot, { commit = true } = {}) {
  const body = await call(`/api/saves/${encodeURIComponent(slot)}`);
  const state = await unpack(body);
  if (commit) commitRevision(slot, body.revision, state);
  return { state, revision: body.revision, updatedAt: body.updatedAt, name: body.name, meta: body.meta, progress: body.progress ?? null };
}
export async function deleteCloudSave(slot) {
  await call(`/api/saves/${encodeURIComponent(slot)}`, { method: 'DELETE' });
  const link = linkBySlot(slot);
  if (link) unlinkCareer(link.careerId);
}
