// Player accounts and online saves. The browser keeps a local copy (offline play, quick resume), while the account
// keeps the careers on the server (Cloudflare D1) so they can be recovered on any device.
// The password never leaves the browser: it is stretched here (PBKDF2-SHA-256, 310 000 iterations) and only that
// proof is sent; the server hashes it again with its own random salt.
const PRODUCTION_ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const ACCOUNT_KEY = 'politicando.account.v1';
const REVISIONS_KEY = 'politicando.account.revisions.v1';
export const PASSWORD_MIN = 8;
export const USERNAME_RULE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const encoder = new TextEncoder();

const read = key => { try { return JSON.parse(globalThis.localStorage?.getItem(key) ?? 'null'); } catch { return null; } };
const write = (key, value) => { try { if (value === null) globalThis.localStorage?.removeItem(key); else globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };

// Where the API lives: on the Worker (and its local preview) it is the same site; GitHub Pages uses the Worker.
export function accountApiBase() {
  const location = globalThis.location;
  if (!location) return PRODUCTION_ORIGIN;
  if (/workers\.dev$/.test(location.hostname) || location.port === '8791') return location.origin;
  if (/github\.io$/.test(location.hostname)) return PRODUCTION_ORIGIN;
  return null;
}
export const currentAccount = () => { const value = read(ACCOUNT_KEY); return value?.username && value?.token ? value : null; };
// Revisions known on this device, per account: they tell whether another device saved a newer version meanwhile.
const revisionStore = () => { const value = read(REVISIONS_KEY); return value?.username === currentAccount()?.username && value?.slots ? value : { username: currentAccount()?.username ?? null, slots: {} }; };
const revisions = () => revisionStore().slots;
const setRevision = (slot, revision) => { const store = revisionStore(); write(REVISIONS_KEY, { ...store, slots: { ...store.slots, [slot]: revision } }); };
export const knownRevision = slot => revisions()[slot] ?? null;
export const normalizeUsername = value => String(value ?? '').trim().toLowerCase();
export const slotForCareer = careerId => `c-${String(careerId ?? 'carriera').toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 40);

const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
export async function passwordProof(username, password) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(`politicando-2026|account|${normalizeUsername(username)}`), iterations: 310_000 }, key, 256));
}

async function call(path, { method = 'GET', body = null, auth = true, timeout = 12000 } = {}) {
  const base = accountApiBase();
  if (!base) throw Object.assign(new Error('Gli account funzionano sul sito pubblicato: da qui la partita resta salvata nel browser.'), { code: 'offline' });
  const account = currentAccount();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(base + path, { method, signal: controller.signal, headers: { 'content-type': 'application/json', ...(auth && account ? { authorization: `Bearer ${account.token}` } : {}) }, body: body === null ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && auth) write(ACCOUNT_KEY, null);
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
export async function register(username, password) {
  checkCredentials(username, password);
  const body = await call('/api/account/register', { method: 'POST', auth: false, body: { username: normalizeUsername(username), proof: await passwordProof(username, password) } });
  write(ACCOUNT_KEY, { username: body.username, token: body.token, since: new Date().toISOString() });
  return body;
}
export async function login(username, password) {
  checkCredentials(username, password);
  const body = await call('/api/account/login', { method: 'POST', auth: false, body: { username: normalizeUsername(username), proof: await passwordProof(username, password) } });
  write(ACCOUNT_KEY, { username: body.username, token: body.token, since: new Date().toISOString() });
  return body;
}
export async function logout() {
  try { if (currentAccount()) await call('/api/account/logout', { method: 'POST' }); }
  finally { write(ACCOUNT_KEY, null); }
}
export const accountInfo = () => call('/api/account/me');
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
// Uploads a career. Without force, a newer save made on another device is never overwritten (error with conflict).
export async function uploadSave(slot, state, { name = null, meta = {}, force = false } = {}) {
  const packed = await pack(state);
  const body = await call(`/api/saves/${encodeURIComponent(slot)}`, { method: 'PUT', body: { ...packed, name, meta, baseRevision: knownRevision(slot) ?? 0, force } });
  setRevision(slot, body.revision);
  return body;
}
export async function downloadSave(slot) {
  const body = await call(`/api/saves/${encodeURIComponent(slot)}`);
  setRevision(slot, body.revision);
  return { state: await unpack(body), revision: body.revision, updatedAt: body.updatedAt, name: body.name, meta: body.meta };
}
export async function deleteCloudSave(slot) {
  await call(`/api/saves/${encodeURIComponent(slot)}`, { method: 'DELETE' });
  const store = revisionStore(); delete store.slots[slot]; write(REVISIONS_KEY, store);
}
