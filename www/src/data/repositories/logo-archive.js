// Export and import of the whole personal catalog of logos as ONE zip file: the images as they are, the original identifiers of the parties and a manifest with the metadata of each. It reads and
// writes the records of personal-logos.js (the same store the catalog and logo-sync.js use) and adds nothing of its own to the cloud: what is imported is a logo changed on this device
// (`dirty`), and logo-sync.js uploads it to the account in the usual way (the same image again is never a second version).
//   - Export: every logo of the active scope (the account signed in, or the guest scope) that is not a deletion marker. The file carries no account name.
//   - Import, step 1 `analyzeLogoArchive`: nothing is written. The zip, the manifest and each image are validated (real type from the bytes, no SVG, size and pixel limits, checksum of the manifest)
//     and each logo is classified against what the catalog already has: new, same (the very same image), conflict (another image for the same party) or invalid.
//   - Import, step 2 `applyLogoImport`: the player's policy for the conflicts (keep the existing, replace, skip), each decision can be changed per party. A logo replaced goes first into a
//     recovery copy (`#recupero`) that can be restored; an error on one logo never stops or spoils the others; the failed ones are reported and can be retried; repeating the same import
//     changes nothing (what is already there is `same`).
import { CONFLICT_SUFFIX, MAX_INPUT_BYTES, MAX_SIDE, OUTPUT_BYTES, logoStore, prepareLogo, scopeNow, sha256OfBlob, sniffImage } from './personal-logos.js?v=20261029-2';

export const ARCHIVE_FORMAT = 'politicando-logos';
export const ARCHIVE_VERSION = 1;
export const MANIFEST_NAME = 'manifest.json';
export const RECOVERY_SUFFIX = '#recupero';
export const LIMITS = Object.freeze({ maxEntries: 400, maxEntryBytes: MAX_INPUT_BYTES, maxTotalBytes: 80 * 1024 * 1024, maxLogos: 150, maxArchiveBytes: 90 * 1024 * 1024 });
const GUEST = '_ospite';
const ID = /^[\w.-]{1,120}$/;
const EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const fail = (message, code = 'archive') => Object.assign(new Error(message), { code });

// ---------- zip (stored entries; reading also accepts deflate) ----------
const CRC_TABLE = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
export function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const dosTime = date => ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
const dosDate = date => (((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
export function zipStore(entries, now = new Date()) {
  const encoder = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const time = dosTime(now), day = dosDate(now);
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const bytes = entry.bytes;
    const crc = crc32(bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true); local.setUint16(10, time, true); local.setUint16(12, day, true);
    local.setUint32(14, crc, true); local.setUint32(18, bytes.length, true); local.setUint32(22, bytes.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, bytes);
    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x02014b50, true); head.setUint16(4, 20, true); head.setUint16(6, 20, true); head.setUint16(8, 0x0800, true); head.setUint16(10, 0, true); head.setUint16(12, time, true); head.setUint16(14, day, true);
    head.setUint32(16, crc, true); head.setUint32(20, bytes.length, true); head.setUint32(24, bytes.length, true); head.setUint16(28, name.length, true); head.setUint32(42, offset, true);
    central.push(new Uint8Array(head.buffer), name);
    offset += 30 + name.length + bytes.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) { out.set(part, at); at += part.length; }
  return out;
}
async function inflateRaw(bytes, limit) {
  if (typeof DecompressionStream === 'undefined') throw fail('Questo browser non legge i file ZIP compressi: esporta di nuovo i loghi da POLITICANDO.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { await reader.cancel().catch(() => null); throw fail('Un file dell’archivio, una volta decompresso, è troppo grande.'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}
// The entries of a zip as a Map name → bytes. Anything that is not a plain, single-disk zip within the limits is refused with a message for the player.
export async function readZip(bytes, limits = LIMITS) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 22) throw fail('Il file non è un archivio ZIP valido.');
  if (bytes.length > limits.maxArchiveBytes) throw fail('Il file è troppo grande per essere un archivio di loghi.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw fail('Il file non è un archivio ZIP valido (manca l’indice finale): potrebbe essere incompleto o danneggiato.');
  const disk = view.getUint16(end + 4, true), count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (disk !== 0 || view.getUint16(end + 6, true) !== 0) throw fail('Gli archivi ZIP in più parti non sono supportati.');
  if (count === 0xffff || size === 0xffffffff || start === 0xffffffff) throw fail('Gli archivi ZIP64 non sono supportati.');
  if (count > limits.maxEntries) throw fail(`L’archivio contiene troppi file (${count}): al massimo ${limits.maxEntries}.`);
  if (start + size > end || start > bytes.length) throw fail('L’indice dell’archivio ZIP è danneggiato.');
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const entries = new Map();
  let at = start, total = 0;
  for (let index = 0; index < count; index++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) throw fail('L’indice dell’archivio ZIP è danneggiato.');
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true), crc = view.getUint32(at + 16, true);
    const compressed = view.getUint32(at + 20, true), plain = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true), extraLength = view.getUint16(at + 30, true), commentLength = view.getUint16(at + 32, true), offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (flags & 1) throw fail('Gli archivi ZIP protetti da password non sono supportati.');
    if (compressed === 0xffffffff || plain === 0xffffffff) throw fail('Gli archivi ZIP64 non sono supportati.');
    if (![0, 8].includes(method)) throw fail('L’archivio usa un metodo di compressione non supportato.');
    if (/(^|\/)\.\.(\/|$)|^\/|\\|:|\0/.test(name) || !name) throw fail('L’archivio contiene un nome di file non ammesso.');
    if (plain > limits.maxEntryBytes) throw fail(`Il file «${name}» è troppo grande (oltre ${Math.round(limits.maxEntryBytes / 1048576)} MB).`);
    total += plain;
    if (total > limits.maxTotalBytes) throw fail('L’archivio, una volta aperto, è troppo grande.');
    if (entries.has(name)) throw fail(`L’archivio contiene due volte «${name}».`);
    if (offset + 30 > bytes.length || view.getUint32(offset, true) !== 0x04034b50) throw fail('Un file dell’archivio ZIP è danneggiato.');
    const dataStart = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    if (dataStart + compressed > bytes.length) throw fail('L’archivio ZIP è incompleto: un file è troncato.');
    const raw = bytes.subarray(dataStart, dataStart + compressed);
    const data = method === 0 ? raw : await inflateRaw(raw, limits.maxEntryBytes);
    if (data.length !== plain) throw fail(`Il file «${name}» dell’archivio è danneggiato (dimensione).`);
    if (crc32(data) !== crc) throw fail(`Il file «${name}» dell’archivio è danneggiato (controllo CRC).`);
    entries.set(name, data);
  }
  return entries;
}

// ---------- the size of an image from its header (no decoding needed to check the pixel limits) ----------
export function imageSize(bytes, mime) {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (mime === 'image/png') return { width: view.getUint32(16), height: view.getUint32(20) };
    if (mime === 'image/webp') {
      const kind = String.fromCharCode(...bytes.subarray(12, 16));
      if (kind === 'VP8X') return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
      if (kind === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      if (kind === 'VP8L') { const bits = view.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }; }
      return null;
    }
    if (mime === 'image/jpeg') {
      let at = 2;
      while (at + 9 < bytes.length) {
        if (bytes[at] !== 0xff) { at++; continue; }
        const marker = bytes[at + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
        const length = view.getUint16(at + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
        at += 2 + length;
      }
    }
  } catch { /* unreadable */ }
  return null;
}

const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'logo';
const today = () => new Date().toISOString().slice(0, 10);
const liveRecords = async scope => (await logoStore.all(scope).catch(() => [])).filter(record => record.blob && !record.deleted);

// ---------- export ----------
// Every logo of the catalog in use, in one zip. Returns { blob, fileName, count, skipped }. Nothing is changed.
export async function exportLogosZip({ scope = scopeNow(), now = new Date() } = {}) {
  const records = (await liveRecords(scope)).sort((a, b) => String(a.partyId).localeCompare(String(b.partyId)));
  if (!records.length) throw fail('Non ci sono loghi da esportare: aggiungine almeno uno al catalogo.', 'empty');
  const files = [], logos = [], skipped = [];
  for (const [index, record] of records.entries()) {
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) { skipped.push({ partyId: record.partyId, message: 'Il file non è un’immagine valida.' }); continue; }
    const name = `logos/${String(index + 1).padStart(3, '0')}-${slug(record.partyId)}.${EXTENSION[mime]}`;
    files.push({ name, bytes });
    logos.push({ partyId: record.partyId, file: name, mimeType: mime, width: record.width ?? null, height: record.height ?? null, bytes: bytes.length, sha256: record.sha ?? await sha256OfBlob(record.blob), fileName: record.fileName ?? 'logo', origin: record.origin ?? 'file', alt: record.alt ?? '', addedAt: record.addedAt ?? null, updatedAt: record.updatedAt ?? null });
  }
  const manifest = { format: ARCHIVE_FORMAT, version: ARCHIVE_VERSION, generator: 'POLITICANDO 2026', exportedAt: now.toISOString(), count: logos.length, logos };
  const zip = zipStore([{ name: MANIFEST_NAME, bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) }, ...files], now);
  return { blob: new Blob([zip], { type: 'application/zip' }), fileName: `loghi-politicando-${now.toISOString().slice(0, 10)}.zip`, count: logos.length, skipped };
}

// ---------- import, step 1: analysis (nothing is written) ----------
const infoOf = record => ({ partyId: record.partyId, width: record.width, height: record.height, bytes: record.bytes ?? record.blob?.size ?? 0, mimeType: record.mimeType, fileName: record.fileName, sha: record.sha ?? null, updatedAt: record.updatedAt ?? null });
// `file` is a File/Blob (or bytes). `decode` may be given to check that an image really decodes (the browser's createImageBitmap by default; none in a test without a browser).
export async function analyzeLogoArchive(file, { scope = scopeNow(), decode = globalThis.createImageBitmap ? (blob => createImageBitmap(blob)) : null } = {}) {
  let bytes;
  try { bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer()); } catch { throw fail('Non riesco a leggere il file scelto.'); }
  const entries = await readZip(bytes);
  const raw = entries.get(MANIFEST_NAME);
  if (!raw) throw fail('Questo ZIP non è un archivio di loghi di POLITICANDO (manca manifest.json).');
  let manifest;
  try { manifest = JSON.parse(new TextDecoder().decode(raw)); } catch { throw fail('Il manifest dell’archivio non si legge: il file è danneggiato.'); }
  if (manifest?.format !== ARCHIVE_FORMAT || !Array.isArray(manifest.logos)) throw fail('Questo ZIP non è un archivio di loghi di POLITICANDO.');
  if (!Number.isInteger(manifest.version) || manifest.version > ARCHIVE_VERSION) throw fail('Questo archivio è stato creato da una versione più recente del gioco: aggiorna POLITICANDO per importarlo.');
  if (manifest.logos.length > LIMITS.maxEntries) throw fail('L’archivio elenca troppi loghi.');
  const existing = new Map((await liveRecords(scope)).map(record => [record.partyId, record]));
  const seen = new Set();
  const items = [];
  for (const entry of manifest.logos) {
    const partyId = typeof entry?.partyId === 'string' ? entry.partyId : '';
    const item = { partyId, file: entry?.file ?? null, status: 'invalid', reason: '', incoming: null, existing: existing.has(partyId) ? infoOf(existing.get(partyId)) : null };
    items.push(item);
    if (!ID.test(partyId)) { item.reason = 'Identificativo del partito non valido.'; continue; }
    if (seen.has(partyId)) { item.reason = 'Lo stesso partito compare due volte nell’archivio: vale solo la prima.'; continue; }
    seen.add(partyId);
    const data = typeof entry.file === 'string' ? entries.get(entry.file) : null;
    if (!data) { item.reason = 'L’immagine indicata dal manifest non è nell’archivio.'; continue; }
    if (data.length > MAX_INPUT_BYTES) { item.reason = 'L’immagine supera i 5 MB.'; continue; }
    const mime = sniffImage(data);
    if (!mime) { item.reason = 'Il file non è un’immagine PNG, JPEG o WebP valida (gli SVG non sono ammessi).'; continue; }
    const size = imageSize(data, mime);
    if (!size || !size.width || !size.height) { item.reason = 'Le dimensioni dell’immagine non si leggono: file danneggiato.'; continue; }
    if (size.width > MAX_SIDE || size.height > MAX_SIDE) { item.reason = `L’immagine supera i ${MAX_SIDE} pixel per lato.`; continue; }
    if (size.width < 16 || size.height < 16) { item.reason = 'L’immagine è troppo piccola (almeno 16 pixel per lato).'; continue; }
    let blob = new Blob([data], { type: mime });
    const sha = await sha256OfBlob(blob);
    if (typeof entry.sha256 === 'string' && entry.sha256 && entry.sha256 !== sha) { item.reason = 'L’immagine non corrisponde al suo controllo nel manifest: file alterato o danneggiato.'; continue; }
    let { width, height } = size;
    if (decode) { try { const bitmap = await decode(blob); bitmap.close?.(); } catch { item.reason = 'L’immagine non si legge: file danneggiato.'; continue; } }
    let finalSha = sha;
    if (data.length > OUTPUT_BYTES) {
      // as every logo the player adds: larger images are re-encoded small (needs the browser); where that is not possible the image is refused with the reason
      try { const prepared = await prepareLogo(new File([blob], entry.fileName || 'logo', { type: mime })); blob = prepared.blob; width = prepared.width; height = prepared.height; finalSha = await sha256OfBlob(blob); }
      catch (error) { item.reason = error?.message || 'L’immagine è troppo pesante per il catalogo.'; continue; }
    }
    item.incoming = { partyId, blob, mimeType: blob.type || mime, width, height, bytes: blob.size, sha: finalSha, fileName: String(entry.fileName ?? 'logo').slice(0, 120), origin: 'file', alt: String(entry.alt ?? '').slice(0, 160), addedAt: typeof entry.addedAt === 'string' ? entry.addedAt : null };
    const current = existing.get(partyId);
    item.status = !current ? 'new' : (current.sha ?? await sha256OfBlob(current.blob)) === finalSha ? 'same' : 'conflict';
  }
  const counts = { total: items.length, new: 0, same: 0, conflict: 0, invalid: 0 };
  for (const item of items) counts[item.status]++;
  const after = new Set([...existing.keys(), ...items.filter(item => item.status === 'new').map(item => item.partyId)]).size;
  return { ok: true, manifest: { format: manifest.format, version: manifest.version, exportedAt: manifest.exportedAt ?? null, count: manifest.logos.length }, scope, items, counts, overLimit: after > LIMITS.maxLogos ? after : 0 };
}

// ---------- import, step 2: apply ----------
// policy for the conflicts: 'keep' (the existing logo stays), 'replace' (the imported one replaces it; the old one is kept in the recovery copy), 'skip' (not imported, not even compared).
// decisions: { partyId: 'keep'|'replace'|'skip' } overrides the policy for one party (it can also leave out a new logo: 'skip'). only: a set of party ids (to retry the failed ones).
export async function applyLogoImport(analysis, { policy = 'keep', decisions = {}, only = null, onProgress = null, scope = analysis?.scope ?? scopeNow(), now = () => new Date().toISOString() } = {}) {
  if (!analysis?.ok) throw fail('Analizza prima l’archivio.');
  if (scope !== scopeNow()) throw fail('Nel frattempo è cambiato l’account: riapri l’archivio.', 'scope');
  const report = { imported: [], replaced: [], kept: [], skipped: [], same: [], failed: [], invalid: [] };
  const work = analysis.items.filter(item => !only || only.has(item.partyId));
  for (const [index, item] of work.entries()) {
    onProgress?.({ done: index, total: work.length, partyId: item.partyId });
    if (item.status === 'invalid') { report.invalid.push({ partyId: item.partyId, message: item.reason }); continue; }
    try {
      const all = await logoStore.all(scope);
      const prior = all.find(record => record.partyId === item.partyId);
      const current = prior?.blob && !prior.deleted ? prior : null;
      // what is there now decides, not what the analysis saw: a repeated import, or a logo changed meanwhile, never creates a duplicate or overwrites by surprise
      const sameNow = current && (current.sha ?? await sha256OfBlob(current.blob)) === item.incoming.sha;
      if (sameNow) { report.same.push(item.partyId); continue; }
      const decision = decisions[item.partyId] ?? (current ? policy : 'import');
      if (decision === 'skip') { report.skipped.push(item.partyId); continue; }
      if (current && decision !== 'replace') { report.kept.push(item.partyId); continue; }
      if (current) await logoStore.put({ ...current, key: `${scope}${RECOVERY_SUFFIX}|${item.partyId}`, scope: `${scope}${RECOVERY_SUFFIX}`, replacedAt: now() });
      const stamp = now();
      await logoStore.put({ key: logoStore.keyOf(scope, item.partyId), scope, partyId: item.partyId, blob: item.incoming.blob, mimeType: item.incoming.mimeType, width: item.incoming.width, height: item.incoming.height, bytes: item.incoming.bytes, fileName: item.incoming.fileName, origin: 'file', alt: item.incoming.alt || current?.alt || '', addedAt: prior?.addedAt ?? item.incoming.addedAt ?? stamp, updatedAt: stamp, sha: item.incoming.sha, sync: prior?.sync ?? null, dirty: scope !== GUEST });
      (current ? report.replaced : report.imported).push(item.partyId);
    } catch (error) {
      report.failed.push({ partyId: item.partyId, message: error?.message ?? 'Importazione non riuscita.', code: error?.code ?? null });
      // no space left: the next logos would fail the same way; they are reported as waiting, nothing already written is touched
      if (error?.code === 'quota') { for (const rest of work.slice(index + 1)) if (rest.status !== 'invalid') report.failed.push({ partyId: rest.partyId, message: 'Non importato: lo spazio del browser è esaurito.', code: 'quota' }); break; }
    }
  }
  onProgress?.({ done: work.length, total: work.length, partyId: null });
  await logoStore.reload(scope).catch(() => null);
  // «imported» means written AND read back: what the store does not hold with the same image is reported as failed, never as done
  const written = [...report.imported, ...report.replaced];
  if (written.length) {
    const held = new Map((await logoStore.all(scope).catch(() => [])).filter(record => record.blob && !record.deleted).map(record => [record.partyId, record]));
    const lost = new Set(written.filter(id => { const record = held.get(id), want = analysis.items.find(item => item.partyId === id)?.incoming?.sha; return !record || (want && record.sha && record.sha !== want); }));
    if (lost.size) {
      report.imported = report.imported.filter(id => !lost.has(id)); report.replaced = report.replaced.filter(id => !lost.has(id));
      for (const id of lost) report.failed.push({ partyId: id, message: 'Non salvato: il browser non ha conservato il logo.', code: 'not-stored' });
    }
  }
  return report;
}

// ---------- the logos an import replaced ----------
export async function listReplacedLogos(scope = scopeNow()) {
  return (await logoStore.all(`${scope}${RECOVERY_SUFFIX}`).catch(() => [])).filter(record => record.blob).map(infoOf);
}
// Puts the replaced logos back (or one of them). The logo that is there goes into the recovery copy in its place, so the step can be undone too.
export async function restoreReplacedLogos({ partyIds = null, scope = scopeNow(), now = () => new Date().toISOString() } = {}) {
  const saved = (await logoStore.all(`${scope}${RECOVERY_SUFFIX}`)).filter(record => record.blob && (!partyIds || partyIds.includes(record.partyId)));
  const restored = [];
  for (const record of saved) {
    const all = await logoStore.all(scope);
    const prior = all.find(item => item.partyId === record.partyId);
    const current = prior?.blob && !prior.deleted ? prior : null;
    if (current) await logoStore.put({ ...current, key: `${scope}${RECOVERY_SUFFIX}|${record.partyId}`, scope: `${scope}${RECOVERY_SUFFIX}`, replacedAt: now() }); else await logoStore.remove(record.key);
    const { replacedAt, ...image } = record;
    await logoStore.put({ ...image, key: logoStore.keyOf(scope, record.partyId), scope, updatedAt: now(), sync: prior?.sync ?? image.sync ?? null, dirty: scope !== GUEST });
    restored.push(record.partyId);
  }
  await logoStore.reload(scope).catch(() => null);
  return restored;
}
export async function discardReplacedLogos(scope = scopeNow()) {
  for (const record of await logoStore.all(`${scope}${RECOVERY_SUFFIX}`).catch(() => [])) await logoStore.remove(record.key);
}
export { CONFLICT_SUFFIX };
