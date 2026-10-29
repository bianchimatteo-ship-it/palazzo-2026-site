// The personal catalog of party logos. Every logo is a small raster image (PNG, JPEG or WebP, re-encoded here) kept in this browser's IndexedDB, under the account that is signed in (or
// the guest scope when nobody is) and the party's stable identifier, and the images are never written into the saves of the careers. A logo added from an address is copied once into the
// browser and the address is forgotten. This file only keeps the browser's copy (the cache that works offline): the synchronisation with the account's cloud copy is logo-sync.js, which
// reads and writes these records through the `logoStore` below. A record carries `sync` ({ version, sha } of the cloud copy it was last known to equal) and `dirty` (changed here since).
import { signedInUsername } from './career-visibility.js?v=20261029-4';

const DATABASE = 'politicando-personal-logos';
const STORE = 'logos';
const GUEST = '_ospite';
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_SIDE = 4096;
export const OUTPUT_SIDE = 512;
export const OUTPUT_BYTES = 300 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
const LEGACY_FLAG = 'politicando.personal-logos.migrated.v1';
// The logos of the earlier version have no known owner: they wait here, never shown, until the player claims them one by one (or discards them).
export const LEGACY_SCOPE = '_precedente';

export const scopeNow = () => signedInUsername() ?? GUEST;
const keyOf = (scope, partyId) => `${scope}|${partyId}`;
const fail = (message, code = 'invalid') => Object.assign(new Error(message), { code });

// ---------- the browser's database (a plain in-memory map when IndexedDB is not there: then a logo lasts only until the page closes, and the game says so) ----------
const memory = new Map();
// Does this browser really keep logos? False when IndexedDB cannot be opened: what is saved then lives in memory only.
export const logosArePersistent = async () => Boolean(await openDatabase());
let databasePromise = null;
function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (!databasePromise) databasePromise = new Promise(resolve => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { const store = request.result.createObjectStore(STORE, { keyPath: 'key' }); store.createIndex('scope', 'scope'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return databasePromise;
}
const asPromise = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error('Operazione non riuscita.')); });
const quotaError = error => error?.name === 'QuotaExceededError' || /quota/i.test(error?.message ?? '');
async function putRecord(record) {
  const database = await openDatabase();
  if (!database) { memory.set(record.key, record); return; }
  try {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(record);
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error ?? new Error('Scrittura annullata.')); });
  } catch (error) {
    throw quotaError(error) ? fail('Lo spazio del browser è esaurito: il logo non è stato salvato. Libera spazio (elimina un logo o un salvataggio che non ti serve) e riprova. Le partite non sono state toccate.', 'quota') : fail(`Il browser non ha salvato il logo (${error?.message ?? 'errore'}). Le partite non sono state toccate.`, 'storage');
  }
}
async function readAll(scope) {
  const database = await openDatabase();
  if (!database) return [...memory.values()].filter(record => record.scope === scope);
  return asPromise(database.transaction(STORE, 'readonly').objectStore(STORE).index('scope').getAll(IDBKeyRange.only(scope)));
}
async function removeRecord(key) {
  const database = await openDatabase();
  if (!database) { memory.delete(key); return; }
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).delete(key);
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
}

// ---------- what a file really is, read from its bytes ----------
export function sniffImage(bytes) {
  const at = (...values) => values.every((value, index) => bytes[index] === value);
  if (bytes.length >= 24 && at(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png';
  if (bytes.length >= 12 && at(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (bytes.length >= 16 && at(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}
const looksLikeText = bytes => { const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart().toLowerCase(); return head.startsWith('<?xml') || head.startsWith('<svg') || head.includes('<svg') || head.startsWith('<!doctype') || head.startsWith('<html'); };

async function drawToLogo(source, width, height) {
  const scale = Math.min(1, OUTPUT_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const canvas = globalThis.OffscreenCanvas ? new OffscreenCanvas(w, h) : Object.assign(globalThis.document.createElement('canvas'), { width: w, height: h });
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, w, h);
  const encode = (type, quality) => canvas.convertToBlob ? canvas.convertToBlob({ type, quality }) : new Promise(resolve => canvas.toBlob(resolve, type, quality));
  let blob = null;
  for (const [type, quality] of [['image/webp', 0.9], ['image/webp', 0.75], ['image/png', undefined]]) {
    blob = await encode(type, quality);
    if (blob && blob.size <= OUTPUT_BYTES && ALLOWED.includes(blob.type)) break;
  }
  if (!blob || !ALLOWED.includes(blob.type)) throw fail('Il browser non è riuscito a comprimere l’immagine.', 'encode');
  if (blob.size > OUTPUT_BYTES) throw fail('L’immagine, anche ridotta, è troppo pesante per il catalogo: scegline una più semplice.', 'size');
  const check = sniffImage(new Uint8Array(await blob.slice(0, 32).arrayBuffer()));
  if (check !== blob.type) throw fail('L’immagine compressa non è valida.', 'encode');
  return { blob, width: w, height: h, mimeType: blob.type, bytes: blob.size };
}

// A file chosen by the player: size and real type are checked from its bytes (SVG, GIF and anything else are refused), the image must decode within the pixel limits, and it is re-encoded
// small. Throws an Error with a message for the player and a `code`.
export async function prepareLogo(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw fail('Scegli un file immagine.');
  if (file.size > MAX_INPUT_BYTES) throw fail('Il file supera i 5 MB.', 'size');
  if (file.size < 16) throw fail('Il file è vuoto o danneggiato.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) throw fail(looksLikeText(bytes) ? 'Gli SVG non sono ammessi: usa un PNG, un JPEG o un WebP.' : 'Il file non è un’immagine PNG, JPEG o WebP valida.');
  let bitmap;
  try { bitmap = await createImageBitmap(new Blob([bytes], { type })); }
  catch { throw fail('Il file è danneggiato o non si legge come immagine.', 'corrupt'); }
  try {
    if (bitmap.width > MAX_SIDE || bitmap.height > MAX_SIDE) throw fail(`L’immagine supera i ${MAX_SIDE} pixel per lato.`, 'size');
    if (bitmap.width < 16 || bitmap.height < 16) throw fail('L’immagine è troppo piccola (almeno 16 pixel per lato).', 'size');
    return await drawToLogo(bitmap, bitmap.width, bitmap.height);
  } finally { bitmap.close?.(); }
}

// ---------- from an address: the browser's own image loader (the page may only load images, not read other sites), copied once, address forgotten ----------
export function checkImageAddress(address) {
  let url;
  try { url = new URL(String(address ?? '').trim()); } catch { throw fail('Inserisci un indirizzo completo che inizi con https://'); }
  if (url.protocol !== 'https:') throw fail('Sono ammessi solo indirizzi https://');
  if (url.username || url.password || !url.hostname || !url.hostname.includes('.')) throw fail('L’indirizzo non è valido.');
  if (/\.svg(?:$|[?#])/i.test(url.pathname + url.search)) throw fail('Gli SVG non sono ammessi: usa un PNG, un JPEG o un WebP.');
  if (/\.(gif|avif|bmp|tiff?|ico|pdf|html?)$/i.test(url.pathname)) throw fail('Sono ammessi solo PNG, JPEG e WebP.');
  return url.href;
}
const loadElement = (href, timeout) => new Promise((resolve, reject) => {
  const image = new Image();
  const timer = setTimeout(() => { image.src = ''; reject(fail('L’immagine non risponde: controlla l’indirizzo o riprova.', 'timeout')); }, timeout);
  image.crossOrigin = 'anonymous';
  image.referrerPolicy = 'no-referrer';
  image.decoding = 'async';
  image.onload = () => { clearTimeout(timer); resolve(image); };
  image.onerror = () => { clearTimeout(timer); reject(fail('Il sito non permette di copiare l’immagine (o l’indirizzo non porta a un’immagine). Scaricala sul dispositivo e caricala come file.', 'blocked')); };
  image.src = href;
});
export async function importLogoFromUrl(address, { timeout = 15000, load = loadElement } = {}) {
  const href = checkImageAddress(address);
  const image = await load(href, timeout);
  const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
  if (!width || !height) throw fail('L’indirizzo non contiene un’immagine visualizzabile.');
  if (width > MAX_SIDE || height > MAX_SIDE) throw fail(`L’immagine supera i ${MAX_SIDE} pixel per lato.`, 'size');
  if (width < 16 || height < 16) throw fail('L’immagine è troppo piccola (almeno 16 pixel per lato).', 'size');
  try { return await drawToLogo(image, width, height); }
  catch (error) {
    if (error?.name === 'SecurityError') throw fail('Il sito non permette di copiare l’immagine. Scaricala sul dispositivo e caricala come file.', 'blocked');
    throw error;
  }
}

// ---------- the catalog of the scope that is active ----------
let activeScope = null;
const urls = new Map();
const infos = new Map();
const listeners = new Set();
export const onLogosChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => { for (const fn of listeners) { try { fn(); } catch { /* a listener never breaks the catalog */ } } };
function release() { for (const url of urls.values()) { try { URL.revokeObjectURL(url); } catch { /* already gone */ } } urls.clear(); infos.clear(); }
// Reads the logos of the account that is signed in (or of the guest scope); the previous scope's images leave memory.
export async function loadLogos(scope = scopeNow()) {
  let records = [];
  try { records = await readAll(scope); } catch { records = []; }
  release();
  activeScope = scope;
  for (const record of records) {
    if (!record.blob || !ALLOWED.includes(record.mimeType)) continue;
    urls.set(record.partyId, URL.createObjectURL(record.blob));
    const { blob, ...info } = record;
    infos.set(record.partyId, info);
  }
  changed();
  return [...infos.values()];
}
export const activeLogoScope = () => activeScope;
// The one resolver: the logo of a party, by its stable identifier, in the active scope; null when there is none (the interface then draws the party's own mark from initials and colours).
export const resolveLogo = partyId => (partyId && activeScope === scopeNow() ? urls.get(String(partyId)) : null) ?? null;
export const logoInfo = partyId => infos.get(String(partyId)) ?? null;
export const listLogoInfos = () => [...infos.values()];

export async function sha256OfBlob(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
// The low-level access of the synchronisation (logo-sync.js): the records of one scope (with deleted-logo markers), one record written or removed. Not for the interface.
export const CONFLICT_SUFFIX = '#conflitto';
export const logoStore = { all: scope => readAll(scope), put: record => putRecord(record), remove: key => removeRecord(key), keyOf, reload: scope => loadLogos(scope), fail };

export async function saveLogo(partyId, prepared, { fileName = 'logo', origin = 'file', alt = '' } = {}) {
  const id = String(partyId ?? '').trim();
  if (!id || !prepared?.blob) throw fail('Partito o immagine non validi.');
  const scope = scopeNow();
  const now = new Date().toISOString();
  const previous = scope === activeScope ? infos.get(id) : null;
  const stored = (await readAll(scope).catch(() => [])).find(record => record.partyId === id);
  const sha = await sha256OfBlob(prepared.blob);
  // What the cloud copy was when this one was made stays in `sync`: the next synchronisation uploads this image on top of exactly that version (or reports a conflict). A logo changed here is `dirty`.
  await putRecord({ key: keyOf(scope, id), scope, partyId: id, blob: prepared.blob, mimeType: prepared.mimeType, width: prepared.width, height: prepared.height, bytes: prepared.bytes, fileName: String(fileName).slice(0, 120), origin, alt: String(alt).slice(0, 160), addedAt: previous?.addedAt ?? now, updatedAt: now, sha, sync: stored?.sync ?? null, dirty: true });
  await loadLogos(scope);
  return { persistent: await logosArePersistent() };
}
export async function deleteLogo(partyId) {
  const scope = scopeNow();
  const key = keyOf(scope, String(partyId));
  const stored = (await readAll(scope).catch(() => [])).find(record => record.partyId === String(partyId));
  // A logo that exists in the cloud leaves a marker (no image) so that the next synchronisation deletes the cloud copy too; one that was never uploaded just goes.
  if (stored?.sync?.version && scope !== GUEST) await putRecord({ key, scope, partyId: String(partyId), deleted: true, sync: stored.sync, updatedAt: new Date().toISOString() });
  else await removeRecord(key);
  await removeRecord(`${scope}${CONFLICT_SUFFIX}|${String(partyId)}`).catch(() => null);
  await loadLogos(scope);
}

// ---------- the logos of the earlier version ----------
// The old database (the owner's panel, one per browser) is read and left as it is. Its logos have no known owner or origin, so they are NOT given to the account in use or to the guest
// scope: they are kept apart (LEGACY_SCOPE, never resolved) and shown in the catalog, where the player claims the ones they have the right to use. Raster files are carried over as
// they are; an old SVG is drawn to a raster once; an address that was never copied cannot be carried over.
export async function migrateLegacyLogos() {
  try { if (globalThis.localStorage?.getItem(LEGACY_FLAG)) return { migrated: 0, skipped: 0, already: true }; } catch { return { migrated: 0, skipped: 0 }; }
  if (!(await logosArePersistent())) return { migrated: 0, skipped: 0, deferred: true };
  let migrated = 0, skipped = 0;
  try {
    const legacy = await new Promise(resolve => {
      if (!globalThis.indexedDB) { resolve([]); return; }
      const request = indexedDB.open('politicando-local-admin');
      request.onupgradeneeded = () => { request.transaction.abort(); resolve([]); };
      request.onerror = () => resolve([]);
      request.onsuccess = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('party-logos')) { database.close(); resolve([]); return; }
        const read = database.transaction('party-logos', 'readonly').objectStore('party-logos').getAll();
        read.onsuccess = () => { database.close(); resolve(read.result ?? []); };
        read.onerror = () => { database.close(); resolve([]); };
      };
    });
    const known = new Set((await readAll(LEGACY_SCOPE)).map(record => record.partyId));
    for (const record of legacy) {
      try {
        if (!record?.partyId || !(record.blob instanceof Blob) || known.has(record.partyId)) { skipped++; continue; }
        let prepared;
        if (record.blob.type === 'image/svg+xml') {
          const href = URL.createObjectURL(record.blob);
          try { const image = await loadElement(href, 8000); prepared = await drawToLogo(image, image.naturalWidth || 256, image.naturalHeight || 256); }
          finally { URL.revokeObjectURL(href); }
        } else prepared = await prepareLogo(new File([record.blob], record.fileName || 'logo', { type: record.blob.type }));
        const now = new Date().toISOString();
        await putRecord({ key: keyOf(LEGACY_SCOPE, record.partyId), scope: LEGACY_SCOPE, partyId: record.partyId, blob: prepared.blob, mimeType: prepared.mimeType, width: prepared.width, height: prepared.height, bytes: prepared.bytes, fileName: String(record.fileName || 'logo').slice(0, 120), origin: 'legacy', alt: '', addedAt: now, updatedAt: now });
        migrated++;
      } catch { skipped++; }
    }
  } catch { /* nothing to carry over */ }
  try { globalThis.localStorage?.setItem(LEGACY_FLAG, JSON.stringify({ at: new Date().toISOString(), migrated, skipped })); } catch { /* tried again at the next start */ }
  return { migrated, skipped };
}
// The waiting logos, with a preview each (the previews are released by `releaseLegacyPreviews`).
const legacyUrls = new Map();
export function releaseLegacyPreviews() { for (const url of legacyUrls.values()) { try { URL.revokeObjectURL(url); } catch { /* gone */ } } legacyUrls.clear(); }
export async function listLegacyLogos() {
  releaseLegacyPreviews();
  const records = await readAll(LEGACY_SCOPE).catch(() => []);
  return records.filter(record => record.blob && ALLOWED.includes(record.mimeType) && !record.claimedBy).map(record => { const src = URL.createObjectURL(record.blob); legacyUrls.set(record.partyId, src); const { blob, ...info } = record; return { ...info, src }; });
}
// The player says «this one is mine to use»: it is COPIED to the account in use (or the guest scope) and the copy waits to be uploaded; the original stays (hidden) until the upload has been
// verified (logo-sync.js removes it then), so a failed upload loses nothing. An existing logo of the player's is not replaced.
export async function claimLegacyLogo(partyId) {
  const records = await readAll(LEGACY_SCOPE);
  const record = records.find(item => item.partyId === String(partyId) && !item.claimedBy);
  if (!record) throw fail('Questo logo non c’è più.');
  if (await getExisting(record.partyId)) throw fail('Per questo partito hai già un logo: eliminalo prima se vuoi usare questo.');
  const scope = scopeNow();
  const now = new Date().toISOString();
  const sha = record.sha ?? await sha256OfBlob(record.blob);
  await putRecord({ ...record, key: keyOf(scope, record.partyId), scope, origin: 'file', updatedAt: now, sha, sync: null, dirty: true, fromLegacy: LEGACY_SCOPE });
  await putRecord({ ...record, claimedBy: scope });
  await loadLogos(scope);
}
export async function discardLegacyLogo(partyId) { await removeRecord(keyOf(LEGACY_SCOPE, String(partyId))); }
// The logos added while nobody was signed in (guest scope) are never given to an account on their own: once signed in, the player may COPY one into the account (the guest copy stays).
export async function listGuestLogos() {
  if (scopeNow() === GUEST) return [];
  releaseLegacyPreviews();
  const records = await readAll(GUEST).catch(() => []);
  return records.filter(record => record.blob && ALLOWED.includes(record.mimeType) && !record.importedBy).map(record => { const src = URL.createObjectURL(record.blob); legacyUrls.set(`guest|${record.partyId}`, src); const { blob, ...info } = record; return { ...info, src }; });
}
export async function importGuestLogo(partyId) {
  const scope = scopeNow();
  if (scope === GUEST) throw fail('Per importare un logo nel tuo account devi prima accedere.');
  const record = (await readAll(GUEST)).find(item => item.partyId === String(partyId) && item.blob);
  if (!record) throw fail('Questo logo non c’è più.');
  if (await getExisting(record.partyId)) throw fail('Per questo partito hai già un logo nel tuo account: eliminalo prima se vuoi importare questo.');
  const now = new Date().toISOString();
  await putRecord({ ...record, key: keyOf(scope, record.partyId), scope, origin: 'file', updatedAt: now, sha: record.sha ?? await sha256OfBlob(record.blob), sync: null, dirty: true, fromGuest: true });
  await putRecord({ ...record, importedBy: scope });
  await loadLogos(scope);
}
async function getExisting(partyId) {
  const database = await openDatabase();
  const key = keyOf(scopeNow(), partyId);
  if (!database) return memory.get(key) ?? null;
  return asPromise(database.transaction(STORE, 'readonly').objectStore(STORE).get(key)).catch(() => null);
}
