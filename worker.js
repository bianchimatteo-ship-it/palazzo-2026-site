// POLITICANDO 2026 on Cloudflare Workers: static assets for the game, a small shared archive for the owner's
// corrections and party logos (Workers KV), and player accounts with online career saves (Cloudflare D1).
// The real dataset files are never written.
const ARCHIVE_KEY = 'archivio-condiviso';
const PIN_KEY = 'pin-amministratore';
const MAX_BYTES = 1_500_000;
const MAX_LOGO_BYTES = 420_000;
const SESSION_SECONDS = 12 * 3600;
const MAX_FAILURES = 8;
// The web sites of the game and, for the installed app (Capacitor), its own origins: iOS capacitor://localhost, Android https://localhost. Credentials travel in the Authorization header, never in cookies.
const ALLOWED_ORIGINS = ['https://bianchimatteo-ship-it.github.io', 'https://palazzo-2026-site.bianchimatteo657.workers.dev', 'http://127.0.0.1:8791', 'http://localhost:8791', 'capacitor://localhost', 'https://localhost'];

const encoder = new TextEncoder();
const toHex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
async function pinHash(pin, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100_000 }, key, 256));
}
function randomToken(bytes = 24) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return toHex(values);
}
function equalStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function cors(request) {
  const origin = request.headers.get('origin');
  const allowed = origin && (ALLOWED_ORIGINS.includes(origin) || origin === new URL(request.url).origin) ? origin : ALLOWED_ORIGINS[0];
  return { 'access-control-allow-origin': allowed, 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400', vary: 'origin' };
}
// Every answer of the API: nothing to sniff, nothing to frame or to run (it only ever returns JSON), no referrer, HTTPS only. The static assets get theirs from _headers.
const API_SECURITY_HEADERS = { 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'", 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=31536000', 'cross-origin-resource-policy': 'cross-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()' };
function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...API_SECURITY_HEADERS, ...cors(request) } });
}
const emptyArchive = () => ({ version: 1, updatedAt: null, parties: {}, politicians: {}, logos: {}, addedParties: {}, hidden: {} });
const POSITIONS = ['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra'];
const cleanText = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) || null : null;
// Parties added by the owner: a separate layer, never mixed with the real dataset files.
function cleanAddedParty(id, input) {
  if (!/^admin-party-[a-z0-9-]{3,90}$/.test(id) || !input || typeof input !== 'object') return null;
  const officialName = cleanText(input.officialName, 160);
  if (!officialName) return null;
  const website = cleanText(input.website, 300);
  return {
    officialName, abbreviation: cleanText(input.abbreviation, 20), factualDescription: cleanText(input.factualDescription, 1500),
    website: website && /^https?:\/\/[^\s"'<>]+$/i.test(website) ? website : null,
    politicalPosition: POSITIONS.includes(input.politicalPosition) ? input.politicalPosition : null,
    color: /^#[\da-f]{6}$/i.test(input.color ?? '') ? input.color : null,
    color2: null, // the only colour of a party is the primary one: a second colour sent by an old page is dropped
    createdAt: cleanText(input.createdAt, 40), updatedAt: cleanText(input.updatedAt, 40)
  };
}

// Only the shapes the game writes are accepted: overrides by record id, logos by party id.
function cleanArchive(input) {
  if (!input || typeof input !== 'object') throw new Error('Archivio non valido.');
  const records = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const logos = {};
  for (const [partyId, logo] of Object.entries(records(input.logos))) {
    if (!/^[\w.-]{1,120}$/.test(partyId) || !logo || typeof logo !== 'object') continue;
    if (logo.url && /^https:\/\/[^\s"'<>]{4,600}$/i.test(logo.url)) logos[partyId] = { kind: 'url', url: logo.url, alt: String(logo.alt ?? '').slice(0, 160), sourceUrl: typeof logo.sourceUrl === 'string' ? logo.sourceUrl.slice(0, 600) : null, updatedAt: logo.updatedAt ?? new Date().toISOString(), origin: 'admin' };
    else if (logo.dataUrl && /^data:image\/(png|jpeg|webp|svg\+xml);base64,[\w+/=]+$/.test(logo.dataUrl) && logo.dataUrl.length <= MAX_LOGO_BYTES) logos[partyId] = { kind: 'data', dataUrl: logo.dataUrl, alt: String(logo.alt ?? '').slice(0, 160), sourceUrl: typeof logo.sourceUrl === 'string' ? logo.sourceUrl.slice(0, 600) : null, updatedAt: logo.updatedAt ?? new Date().toISOString(), origin: 'admin' };
  }
  const addedParties = {};
  for (const [id, party] of Object.entries(records(input.addedParties)).slice(0, 300)) { const clean = cleanAddedParty(id, party); if (clean) addedParties[id] = clean; }
  const hidden = {};
  for (const [id, entry] of Object.entries(records(input.hidden)).slice(0, 800)) if (/^[\w.-]{1,120}$/.test(id) && entry && typeof entry === 'object') hidden[id] = { hidden: entry.hidden !== false, deleted: Boolean(entry.deleted), updatedAt: cleanText(entry.updatedAt, 40) };
  return { version: 1, updatedAt: new Date().toISOString(), parties: withoutSecondColour(records(input.parties)), politicians: records(input.politicians), logos, addedParties, hidden };
}
// A record corrected by the owner keeps its primary colour; the old second colour is not written any more (records already published with one stay readable, the game ignores it).
function withoutSecondColour(parties) {
  const clean = {};
  for (const [id, record] of Object.entries(parties)) {
    if (record?.fields && typeof record.fields === 'object' && 'color2' in record.fields) { const { color2, ...fields } = record.fields; clean[id] = { ...record, fields }; } else clean[id] = record;
  }
  return clean;
}
async function tooManyFailures(env, request) {
  const key = `tentativi:${request.headers.get('cf-connecting-ip') ?? 'locale'}`;
  const count = Number(await env.ADMIN_ARCHIVE.get(key) ?? 0);
  return { key, count, blocked: count >= MAX_FAILURES };
}
// A session is valid only for the credential it was opened with: the PIN record carries an `epoch` (absent = the first one) that every session stores, so changing the
// credential makes all the older sessions invalid at once, even those no listing could reach.
const credentialEpoch = stored => String(stored?.epoch ?? '1');
async function sessionValid(env, request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!/^[\da-f]{48}$/.test(token)) return false;
  const [session, stored] = await Promise.all([env.ADMIN_ARCHIVE.get(`sessione:${token}`), env.ADMIN_ARCHIVE.get(PIN_KEY, 'json')]);
  return Boolean(session && stored) && equalStrings(session, credentialEpoch(stored));
}
// Replaces the owner's credential: a new salt and hash (the value itself is never stored or logged) and a new epoch; old sessions are also removed where the store can list them.
async function replaceCredential(env, newPin) {
  const salt = randomToken(12);
  const record = { salt, hash: await pinHash(newPin, salt), since: new Date().toISOString(), epoch: randomToken(8) };
  await env.ADMIN_ARCHIVE.put(PIN_KEY, JSON.stringify(record));
  try {
    const listed = await env.ADMIN_ARCHIVE.list?.({ prefix: 'sessione:' });
    for (const key of listed?.keys ?? []) await env.ADMIN_ARCHIVE.delete(key.name);
  } catch { /* the epoch already invalidated them */ }
  return record;
}


// ---------- the shared logo catalog ----------
// A logo approved in the Admin is published here: the file goes to persistent storage (the R2 bucket LOGO_BUCKET when the Worker has one, else Workers KV, which is already bound), the
// catalog (the shared archive, `logos[entityId]`) keeps the reference and the metadata, and every player reads the same file from /api/admin/logo/<entityId>. Files are named by their
// SHA-256, so publishing the same file twice writes nothing twice. Nothing here decides whether a logo is the party's official one: `logoVerified` is never touched.
const MAX_LOGO_FILE = 2 * 1024 * 1024;
const MAX_SVG_CHARS = 200_000;
const LOGO_ID = /^[\w.-]{1,120}$/;
const SVG_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'defs', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc']);
const SVG_ATTRIBUTES = new Set(['xmlns', 'viewbox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'd', 'points', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'clip-path', 'mask', 'preserveaspectratio', 'fx', 'fy', 'spreadmethod', 'maskunits', 'maskcontentunits', 'clippathunits', 'version', 'role', 'aria-label', 'aria-hidden', 'focusable']);
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const base64Of = bytes => { let binary = ''; for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000)); return btoa(binary); };
const bytesOf = text => Uint8Array.from(atob(text), character => character.charCodeAt(0));
const sha256Hex = async bytes => toHex(await crypto.subtle.digest('SHA-256', bytes));
// What the bytes are, read from the bytes themselves (never from the name or from the type the client declares).
function sniffLogo(bytes) {
  const at = (...values) => values.every((value, index) => bytes[index] === value);
  if (bytes.length > 24 && at(137, 80, 78, 71, 13, 10, 26, 10)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(16) > 4096 || view.getUint32(20) > 4096 || view.getUint32(16) < 1 || view.getUint32(20) < 1) return { error: 'Il PNG supera i 4096 pixel per lato.' };
    return { type: 'image/png' };
  }
  if (bytes.length > 4 && at(255, 216, 255)) return { type: 'image/jpeg' };
  if (bytes.length > 12 && at(82, 73, 70, 70) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) return { type: 'image/webp' };
  if (bytes.length > 10 && at(71, 73, 70, 56) && (bytes[4] === 55 || bytes[4] === 57) && bytes[5] === 97) return { type: 'image/gif' };
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 400))).trimStart();
  if (/^(<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(head)) return { type: 'image/svg+xml' };
  return { error: 'Sono ammesse immagini SVG, PNG, JPEG, WebP o GIF.' };
}
// An SVG is accepted only when it is made of drawing shapes: no script, no event handler, no external reference, no DOCTYPE or entity, no style, no embedded image.
function checkSvg(text) {
  if (text.length > MAX_SVG_CHARS) return 'L’SVG è troppo grande.';
  if (/<!doctype|<!entity|<!\[cdata\[/i.test(text)) return 'L’SVG contiene dichiarazioni non ammesse.';
  if (/<!--/.test(text) && /<!--[\s\S]*?-->[\s\S]*?(script|javascript)/i.test(text)) return 'L’SVG contiene codice non ammesso.';
  const body = text.replace(/<\?xml[\s\S]*?\?>/i, '').replace(/<!--[\s\S]*?-->/g, '');
  let depth = 0, rootSeen = false, tags = 0;
  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?)(\/?)>/g;
  let last = 0, match;
  while ((match = tagPattern.exec(body))) {
    const between = body.slice(last, match.index);
    if (/[<>]/.test(between)) return 'L’SVG non è ben formato.';
    last = tagPattern.lastIndex;
    const [, closing, nameRaw, attributes, selfClosing] = match;
    const name = nameRaw.toLowerCase();
    if (!SVG_TAGS.has(name)) return `L’SVG contiene un elemento non ammesso (${nameRaw}).`;
    if (++tags > 4000) return 'L’SVG è troppo complesso.';
    if (closing) { depth--; if (depth < 0) return 'L’SVG non è ben formato.'; continue; }
    if (!rootSeen) { if (name !== 'svg') return 'Il file SVG non è valido.'; rootSeen = true; }
    const attributePattern = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
    let attribute;
    while ((attribute = attributePattern.exec(attributes))) {
      const key = attribute[1].toLowerCase(), value = (attribute[2] ?? attribute[3] ?? '').trim();
      if (!SVG_ATTRIBUTES.has(key) || /^on/.test(key)) return `L’SVG contiene un attributo non ammesso (${attribute[1]}).`;
      if (/javascript:|data:|&#|&[a-z]+;|@import|expression\(/i.test(value)) return 'L’SVG contiene un riferimento non ammesso.';
      if (/url\s*\(/i.test(value) && !/^url\(#[\w.-]+\)$/.test(value)) return 'L’SVG contiene un riferimento esterno non ammesso.';
    }
    if (!selfClosing) depth++;
  }
  if (/[<>]/.test(body.slice(last)) || depth !== 0 || !rootSeen) return 'L’SVG non è ben formato.';
  return null;
}
// R2 when the Worker has the bucket, else KV: the same three operations, the file always under its own hash.
function logoFiles(env) {
  if (env.LOGO_BUCKET?.put) return {
    kind: 'r2',
    put: (hash, bytes, type) => env.LOGO_BUCKET.put(`logos/${hash}`, bytes, { httpMetadata: { contentType: type } }),
    get: async hash => { const object = await env.LOGO_BUCKET.get(`logos/${hash}`); return object ? new Uint8Array(await object.arrayBuffer()) : null; },
    delete: hash => env.LOGO_BUCKET.delete(`logos/${hash}`)
  };
  return {
    kind: 'kv',
    put: (hash, bytes) => env.ADMIN_ARCHIVE.put(`logo-file:${hash}`, base64Of(bytes)),
    get: async hash => { const text = await env.ADMIN_ARCHIVE.get(`logo-file:${hash}`); return text ? bytesOf(text) : null; },
    delete: hash => env.ADMIN_ARCHIVE.delete(`logo-file:${hash}`)
  };
}
// The entities a logo can belong to: the parties, movements and coalitions of the real data (read from the published files, never written) and the parties the owner added.
let knownIdsCache = null;
async function knownEntityIds(env, request) {
  if (knownIdsCache && Date.now() - knownIdsCache.at < 600_000) return knownIdsCache.ids;
  const ids = new Set();
  for (const file of ['parties', 'political-movements', 'coalitions']) {
    const response = await env.ASSETS.fetch(new Request(new URL(`/src/data/real/${file}.json`, request.url)));
    if (!response.ok) throw new Error('catalogo-non-verificabile');
    for (const item of await response.json()) if (item?.id) ids.add(item.id);
  }
  knownIdsCache = { at: Date.now(), ids };
  return ids;
}
async function readArchive(env) { return await env.ADMIN_ARCHIVE.get(ARCHIVE_KEY, 'json') ?? emptyArchive(); }
async function writeArchive(env, archive) { archive.updatedAt = new Date().toISOString(); await env.ADMIN_ARCHIVE.put(ARCHIVE_KEY, JSON.stringify(archive)); return archive; }
const assetPathOf = (entityId, hash) => `/api/admin/logo/${entityId}?v=${hash.slice(0, 12)}`;
const stillUsed = (archive, hash, exceptId) => Object.entries(archive.logos).some(([id, logo]) => id !== exceptId && logo?.kind === 'asset' && logo.sha256 === hash);
// Stores one approved logo and records it in the catalog. Returns { entry, replaced, unchanged } or { error, status }.
async function publishLogoFile(env, request, entityId, input) {
  if (!LOGO_ID.test(entityId)) return { error: 'Identificativo del partito non valido.', status: 400 };
  if (!input || typeof input !== 'object' || typeof input.base64 !== 'string') return { error: 'File del logo mancante.', status: 400 };
  if (input.base64.length > Math.ceil(MAX_LOGO_FILE * 4 / 3) + 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)) return { error: 'Il file deve essere più piccolo di 2 MB.', status: 413 };
  const archive = await readArchive(env);
  let ids;
  try { ids = await knownEntityIds(env, request); } catch { return { error: 'Il catalogo dei partiti non è verificabile in questo momento: riprova.', status: 503 }; }
  if (!ids.has(entityId) && !archive.addedParties?.[entityId]) return { error: 'Il partito non esiste nel catalogo: il logo non è stato pubblicato.', status: 404 };
  let bytes;
  try { bytes = bytesOf(input.base64); } catch { return { error: 'File del logo non valido.', status: 400 }; }
  if (bytes.length > MAX_LOGO_FILE || bytes.length < 16) return { error: 'Il file deve essere più piccolo di 2 MB.', status: 413 };
  const sniffed = sniffLogo(bytes);
  if (sniffed.error) return { error: sniffed.error, status: 400 };
  if (sniffed.type === 'image/svg+xml') { const problem = checkSvg(new TextDecoder().decode(bytes)); if (problem) return { error: problem, status: 400 }; }
  const hash = await sha256Hex(bytes);
  const files = logoFiles(env);
  const before = archive.logos[entityId] ?? null;
  const entry = { kind: 'asset', sha256: hash, mimeType: sniffed.type, bytes: bytes.length, assetPath: assetPathOf(entityId, hash), alt: cleanText(input.alt, 160) ?? '', sourceUrl: typeof input.sourceUrl === 'string' && /^https?:\/\/[^\s"'<>]{4,600}$/i.test(input.sourceUrl) ? input.sourceUrl : null, fileName: cleanText(input.fileName, 120), storage: files.kind, updatedAt: new Date().toISOString() };
  if (before?.kind === 'asset' && before.sha256 === hash) {
    // The same file is already published: nothing is written twice; the description may still be corrected.
    const same = { ...before, alt: entry.alt || before.alt, sourceUrl: entry.sourceUrl ?? before.sourceUrl };
    if (same.alt !== before.alt || same.sourceUrl !== before.sourceUrl) { archive.logos[entityId] = { ...same, updatedAt: entry.updatedAt }; await writeArchive(env, archive); }
    return { entry: archive.logos[entityId], replaced: false, unchanged: true, updatedAt: archive.updatedAt };
  }
  // Another entity may already hold this very file: the file is stored once and both entries point to it.
  if (!stillUsed(archive, hash, entityId)) await files.put(hash, bytes, sniffed.type);
  archive.logos[entityId] = entry;
  await writeArchive(env, archive);
  if (before?.kind === 'asset' && !stillUsed(archive, before.sha256, entityId)) await files.delete(before.sha256).catch(() => {});
  return { entry, replaced: Boolean(before), unchanged: false, updatedAt: archive.updatedAt };
}
async function removeLogo(env, entityId) {
  if (!LOGO_ID.test(entityId)) return { error: 'Identificativo del partito non valido.', status: 400 };
  const archive = await readArchive(env);
  const before = archive.logos[entityId];
  if (!before) return { removed: false, updatedAt: archive.updatedAt };
  delete archive.logos[entityId];
  await writeArchive(env, archive);
  if (before.kind === 'asset' && !stillUsed(archive, before.sha256, entityId)) await logoFiles(env).delete(before.sha256).catch(() => {});
  return { removed: true, updatedAt: archive.updatedAt };
}
// The logos that the first versions kept inside the archive as data addresses are moved to files, once: the result is the same logo, the archive gets smaller, nothing is lost or doubled.
async function migrateDataLogos(env, request) {
  const archive = await readArchive(env);
  const done = [], failed = [];
  for (const [entityId, logo] of Object.entries(archive.logos)) {
    if (logo?.kind !== 'data' || typeof logo.dataUrl !== 'string') continue;
    const match = logo.dataUrl.match(/^data:(image\/[\w+.-]+);base64,([\w+/=]+)$/);
    if (!match) { failed.push({ entityId, error: 'indirizzo dati non valido' }); continue; }
    const result = await publishLogoFile(env, request, entityId, { base64: match[2], alt: logo.alt, sourceUrl: logo.sourceUrl });
    if (result.error) failed.push({ entityId, error: result.error }); else done.push(entityId);
  }
  return { migrated: done, failed, updatedAt: (await readArchive(env)).updatedAt };
}
// The public file: only what the catalog lists, with its own type, never executable in the page.
async function serveLogo(env, request, entityId) {
  if (!LOGO_ID.test(entityId)) return json(request, { error: 'Logo non trovato.' }, 404);
  const archive = await readArchive(env);
  const logo = archive.logos[entityId];
  if (logo?.kind !== 'asset') return json(request, { error: 'Logo non trovato.' }, 404);
  const bytes = await logoFiles(env).get(logo.sha256);
  if (!bytes) return json(request, { error: 'Il file del logo non è disponibile.' }, 404);
  const asked = new URL(request.url).searchParams.get('v');
  const headers = { 'content-type': logo.mimeType, 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'cross-origin', 'content-security-policy': "default-src 'none'; style-src 'none'; sandbox", 'referrer-policy': 'no-referrer', etag: `"${logo.sha256}"`, 'cache-control': asked === logo.sha256.slice(0, 12) ? 'public, max-age=31536000, immutable' : 'public, max-age=300', ...cors(request), 'access-control-allow-methods': 'GET, OPTIONS' };
  if (request.headers.get('if-none-match') === `"${logo.sha256}"`) return new Response(null, { status: 304, headers });
  return new Response(bytes, { status: 200, headers });
}

// ---------- player accounts and online saves (D1) ----------
// The password never reaches the server: the browser stretches it (PBKDF2, 310 000 iterations, salt from the username)
// and sends only that proof, which the server hashes again with its own random salt. Sessions are random tokens,
// stored only as SHA-256 hashes.
//
// Online saves (protocol 2). A save is a revision of one career in one slot. Three different things are never confused:
//   - the LOCAL revision (saveMeta.revision inside the game: it counts the saves of one browser),
//   - the SERVER revision (saves.revision: it counts the versions kept online, it only grows, also across a delete and a restore),
//   - the version a snapshot comes from (baseRevision: the server revision the device had when it made the snapshot).
// An automatic write is accepted only when ALL of this holds: the content is a real career of the same slot; baseRevision is exactly the revision online now (lower, higher or missing is refused);
// and the content is not behind the career kept online (date, week, elections, read from the content itself, never from what the client declares). The check and the write are one
// compare-and-swap in a single D1 batch, and the version it replaces is first copied to the history (save_history). There is no `force`: replacing the online version on purpose is a different,
// explicit operation (POST /api/saves/:slot/restore) that names the revision the player saw, keeps the replaced version and gives a new, higher revision.
const ACCOUNT_SESSION_DAYS = 30;
const MAX_SAVE_CHARS = 1_900_000;
const MAX_UNPACKED_CHARS = 14_000_000;
const MAX_SAVES = 12;
const HISTORY_KEEP = 6;
const ACCOUNT_FAILURES = 10;
// New accounts from one address in 15 minutes: counted on their own, so that creating an account is never booked as a failed attempt.
const ACCOUNT_CREATIONS = 10;
// Password recovery and e-mail checks: few requests from one address and few for one address of mail.
const RECOVERY_PER_IP = 6;
const RECOVERY_PER_MAIL = 3;
const VERIFY_TOKEN_HOURS = 48;
const RESET_TOKEN_MINUTES = 30;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const SLOT = /^[a-z0-9-]{1,40}$/;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
// Every statement is CREATE ... IF NOT EXISTS and only adds: the same text is in migrations/ (0003, 0004) and nothing existing is altered or deleted.
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, iterations INTEGER NOT NULL, created_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS saves (user_id TEXT NOT NULL, slot TEXT NOT NULL, name TEXT, meta TEXT, data TEXT NOT NULL, encoding TEXT NOT NULL, revision INTEGER NOT NULL, size INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, slot))',
  'CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)',
  'CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at)',
  // 0003: what the server knows about the content of each slot (read from the content, not declared), the monotone revision counter and the versions replaced.
  'CREATE TABLE IF NOT EXISTS save_state (user_id TEXT NOT NULL, slot TEXT NOT NULL, career_id TEXT, progress TEXT, last_revision INTEGER NOT NULL, origin TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, slot))',
  'CREATE TABLE IF NOT EXISTS save_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, slot TEXT NOT NULL, revision INTEGER NOT NULL, name TEXT, meta TEXT, data TEXT NOT NULL, encoding TEXT NOT NULL, size INTEGER NOT NULL, progress TEXT, saved_at TEXT NOT NULL, archived_at TEXT NOT NULL, reason TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS save_history_slot ON save_history (user_id, slot, id)',
  // 0004: an optional, verified e-mail address (only to recover the password) and the single-use tokens, stored as hashes.
  'CREATE TABLE IF NOT EXISTS user_emails (user_id TEXT PRIMARY KEY, email TEXT NOT NULL, email_norm TEXT NOT NULL, verified_at TEXT, created_at TEXT NOT NULL)',
  'CREATE UNIQUE INDEX IF NOT EXISTS user_emails_verified ON user_emails (email_norm) WHERE verified_at IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS user_emails_norm ON user_emails (email_norm)',
  'CREATE TABLE IF NOT EXISTS email_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, purpose TEXT NOT NULL, email_norm TEXT, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at TEXT)',
  'CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens (user_id)',
  'CREATE INDEX IF NOT EXISTS email_tokens_expiry ON email_tokens (expires_at)'
];
let schemaReady = null;
const ensureSchema = db => (schemaReady ??= db.batch(SCHEMA.map(sql => db.prepare(sql))).catch(error => { schemaReady = null; throw error; }));
const sha256 = async text => toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
async function proofHash(proof, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(proof)), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256));
}
// What the service keeps only to work, and for as short a time as it needs: the connecting address of the attempts (a day at most, the window is 15 minutes), the sessions
// once they have expired (the 30 days of the privacy text) and the e-mail tokens once they have expired or been used. Whoever asks for a login, a registration or a deletion triggers it for everybody, and the daily schedule (wrangler.jsonc, triggers) does
// it even when nobody asks.
async function cleanupExpired(db, now = Date.now()) {
  const attempts = await db.prepare('DELETE FROM attempts WHERE window_start < ?').bind(now - 86_400_000).run();
  const sessions = await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  const tokens = await db.prepare('DELETE FROM email_tokens WHERE expires_at < ? OR used_at IS NOT NULL AND expires_at < ?').bind(now - 86_400_000, now).run();
  return { attempts: attempts?.meta?.changes ?? 0, sessions: sessions?.meta?.changes ?? 0, tokens: tokens?.meta?.changes ?? 0 };
}
// The limit of one kind of request from one address (or one subject, such as a mail address: only its hash is kept): `fail()` books a wrong attempt, `record()` an event that succeeded and is limited anyway (a new account); `clear()` forgets it.
async function accountGuard(db, request, scope, limit = ACCOUNT_FAILURES, clean = true, subject = null) {
  const key = `${scope}:${subject ?? request.headers.get('cf-connecting-ip') ?? 'locale'}`;
  const now = Date.now();
  if (clean) await cleanupExpired(db, now);
  const row = await db.prepare('SELECT count, window_start FROM attempts WHERE key = ?').bind(key).first();
  const fresh = !row || now - row.window_start > 15 * 60_000;
  const count = () => db.prepare('INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN ? - window_start > 900000 THEN 1 ELSE count + 1 END, window_start = CASE WHEN ? - window_start > 900000 THEN ? ELSE window_start END').bind(key, now, now, now, now).run();
  return { blocked: !fresh && row.count >= limit, fail: count, record: count, clear: () => db.prepare('DELETE FROM attempts WHERE key = ?').bind(key).run() };
}
async function openSession(db, userId) {
  const token = randomToken(32);
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), userId, new Date().toISOString(), Date.now() + ACCOUNT_SESSION_DAYS * 86_400_000).run();
  return token;
}
async function accountOf(db, request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!/^[\da-f]{64}$/.test(token)) return null;
  const row = await db.prepare('SELECT users.id AS id, users.username AS username, users.created_at AS createdAt, sessions.token_hash AS tokenHash FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').bind(await sha256(token), Date.now()).first();
  return row ?? null;
}
const cleanMeta = meta => {
  const value = meta && typeof meta === 'object' ? meta : {};
  const text = key => typeof value[key] === 'string' ? value[key].slice(0, 120) : null;
  return { player: text('player'), role: text('role'), party: text('party'), partyId: text('partyId'), gameDate: text('gameDate'), status: text('status'), difficulty: text('difficulty'), week: Number.isFinite(value.week) ? value.week : null };
};

// ---------- the content of a save ----------
// The slot of a career: the same rule as the browser (slotForCareer in account-sync.js), so that a slot can only hold the career it is named after.
const slotOfCareer = careerId => `c-${String(careerId ?? 'carriera').toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 40);
async function unpackSave(data, encoding) {
  if (encoding === 'json') return JSON.parse(data);
  const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length > MAX_UNPACKED_CHARS) { await reader.cancel(); throw new Error('Salvataggio troppo grande una volta decompresso.'); }
  }
  return JSON.parse(text + decoder.decode());
}
// What the content says about itself: which career, how far it got. null = not a career the game could have written.
// The progress is read exactly like the browser does (storage.js, compareSaveProgress): date, week of the game, week number, elections held.
function saveInfo(state) {
  const careerId = state?.career?.id;
  const date = state?.clock?.currentDate;
  if (typeof careerId !== 'string' || !careerId || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const progress = [date.slice(0, 10), num(state?.game?.week?.index), num(state?.game?.week?.number), Array.isArray(state?.career?.electionHistory) ? state.career.electionHistory.length : 0];
  return { careerId, slot: slotOfCareer(careerId), progress, localRevision: Number.isSafeInteger(state?.saveMeta?.revision) ? state.saveMeta.revision : null };
}
function compareProgress(a, b) {
  for (let index = 0; index < 4; index++) {
    if (a[index] === b[index]) continue;
    return (index === 0 ? String(a[index]) > String(b[index]) : Number(a[index]) > Number(b[index])) ? 1 : -1;
  }
  return 0;
}
async function decodeIncoming(body) {
  if (!body || typeof body.data !== 'string' || !['json', 'gzip-base64'].includes(body.encoding) || body.data.length > MAX_SAVE_CHARS) return { error: 'Salvataggio non valido.', code: 'invalid-save' };
  let state;
  try { state = await unpackSave(body.data, body.encoding); } catch { return { error: 'Il contenuto del salvataggio non è leggibile.', code: 'invalid-save' }; }
  const info = saveInfo(state);
  if (!info) return { error: 'Il salvataggio non è una carriera del gioco: non lo si può mettere online.', code: 'invalid-save' };
  return { info };
}
// The state kept for a slot: the counter of the revisions (it survives a delete) and what the content says. Legacy rows (saved before protocol 2) have no state, so it is read from the content kept online.
async function slotState(db, userId, slot, current) {
  const row = await db.prepare('SELECT career_id AS careerId, progress, last_revision AS lastRevision FROM save_state WHERE user_id = ? AND slot = ?').bind(userId, slot).first();
  const lastRevision = Math.max(row?.lastRevision ?? 0, current?.revision ?? 0);
  if (!current) return { careerId: null, progress: null, lastRevision };
  if (row?.progress && row.careerId) return { careerId: row.careerId, progress: JSON.parse(row.progress), lastRevision };
  const stored = await db.prepare('SELECT data, encoding FROM saves WHERE user_id = ? AND slot = ?').bind(userId, slot).first();
  let info = null;
  try { info = saveInfo(await unpackSave(stored.data, stored.encoding)); } catch { /* an unreadable legacy row has no progress: it can only be replaced on purpose */ }
  return { careerId: info?.careerId ?? null, progress: info?.progress ?? null, lastRevision };
}
const remoteOf = row => row ? { revision: row.revision, updatedAt: row.updatedAt, meta: JSON.parse(row.meta ?? '{}') } : null;
async function currentRow(db, userId, slot) {
  return db.prepare('SELECT revision, updated_at AS updatedAt, meta FROM saves WHERE user_id = ? AND slot = ?').bind(userId, slot).first();
}
// One atomic batch: the version replaced goes to the history, the new one is written only if the revision is still the one that was read (compare-and-swap), and the kept state follows
// only if that write happened. If another request wrote first, none of the statements changes anything.
async function writeSave(db, account, slot, { current, info, body, reason, lastRevision, origin }) {
  const revision = Math.max(current?.revision ?? 0, lastRevision ?? 0) + 1;
  const updatedAt = new Date().toISOString();
  const name = String(body.name ?? '').slice(0, 80) || null, meta = JSON.stringify(cleanMeta(body.meta));
  const statements = [];
  if (current) {
    statements.push(db.prepare('INSERT INTO save_history (user_id, slot, revision, name, meta, data, encoding, size, progress, saved_at, archived_at, reason) SELECT s.user_id, s.slot, s.revision, s.name, s.meta, s.data, s.encoding, s.size, (SELECT progress FROM save_state WHERE user_id = s.user_id AND slot = s.slot), s.updated_at, ?, ? FROM saves s WHERE s.user_id = ? AND s.slot = ? AND s.revision = ?').bind(updatedAt, reason, account.id, slot, current.revision));
    statements.push(db.prepare('UPDATE saves SET name = ?, meta = ?, data = ?, encoding = ?, revision = ?, size = ?, updated_at = ? WHERE user_id = ? AND slot = ? AND revision = ?').bind(name, meta, body.data, body.encoding, revision, body.data.length, updatedAt, account.id, slot, current.revision));
  } else {
    statements.push(db.prepare('SELECT 1').bind());
    statements.push(db.prepare('INSERT INTO saves (user_id, slot, name, meta, data, encoding, revision, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, slot) DO NOTHING').bind(account.id, slot, name, meta, body.data, body.encoding, revision, body.data.length, updatedAt));
  }
  statements.push(db.prepare('INSERT INTO save_state (user_id, slot, career_id, progress, last_revision, origin, updated_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM saves WHERE user_id = ? AND slot = ? AND revision = ? AND updated_at = ?) ON CONFLICT(user_id, slot) DO UPDATE SET career_id = excluded.career_id, progress = excluded.progress, last_revision = excluded.last_revision, origin = excluded.origin, updated_at = excluded.updated_at').bind(account.id, slot, info.careerId, JSON.stringify(info.progress), revision, JSON.stringify(origin), updatedAt, account.id, slot, revision, updatedAt));
  // The history keeps the last versions replaced, and apart the ones replaced on purpose (a restore): they are never pushed out by routine saves.
  statements.push(db.prepare(`DELETE FROM save_history WHERE user_id = ? AND slot = ? AND reason != 'ripristino' AND id NOT IN (SELECT id FROM save_history WHERE user_id = ? AND slot = ? AND reason != 'ripristino' ORDER BY id DESC LIMIT ${HISTORY_KEEP})`).bind(account.id, slot, account.id, slot));
  statements.push(db.prepare(`DELETE FROM save_history WHERE user_id = ? AND slot = ? AND reason = 'ripristino' AND id NOT IN (SELECT id FROM save_history WHERE user_id = ? AND slot = ? AND reason = 'ripristino' ORDER BY id DESC LIMIT ${HISTORY_KEEP})`).bind(account.id, slot, account.id, slot));
  const results = await db.batch(statements);
  const written = results[1]?.meta?.changes > 0;
  return { written, revision, updatedAt };
}
const conflictAnswer = async (request, db, account, slot, extra = {}) => json(request, { error: 'Questo salvataggio è stato aggiornato da un altro dispositivo.', conflict: true, ...extra, remote: remoteOf(await currentRow(db, account.id, slot)) }, 409);

// ---------- e-mail (verification, recovery of the password, notice of inactivity) ----------
// Messages leave through a Google Apps Script gateway (a web app that sends from the owner's Gmail): EMAIL_GATEWAY_URL is a plain variable, EMAIL_GATEWAY_SECRET a Worker secret equal to the
// gateway's SHARED_SECRET. Nothing is simulated: a message counts as sent only when the gateway answers 200 with `{ "ok": true }`. Without both settings nothing is sent and the service says so
// (/api/account/status). `env.EMAIL_SEND` is a hook only for tests that run the Worker in process: a Worker's secrets and variables are strings, so it cannot be set in production.
// The gateway only accepts the subjects listed here (its allow-list must contain exactly these); the secret is never logged or put in an error message.
export const MAIL_SUBJECTS = Object.freeze({
  verify: 'POLITICANDO 2026 — conferma il tuo indirizzo email',
  reset: 'POLITICANDO 2026 — nuova password',
  retention: 'POLITICANDO 2026: il tuo account sarà eliminato per inattività'
});
const GATEWAY_TIMEOUT_MS = 15_000; // (EMAIL_GATEWAY_TIMEOUT_MS only lets a test shorten it)
const mailConfigured = env => typeof env.EMAIL_SEND === 'function' || Boolean(/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(String(env.EMAIL_GATEWAY_URL ?? '')) && env.EMAIL_GATEWAY_SECRET);
const mailError = (message, code) => Object.assign(new Error(message), { code });
async function sendMail(env, { to, subject, text }) {
  if (typeof env.EMAIL_SEND === 'function') return env.EMAIL_SEND({ to, subject, text });
  if (!mailConfigured(env)) throw mailError('Invio email non configurato.', 'email-not-configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(env.EMAIL_GATEWAY_TIMEOUT_MS) || GATEWAY_TIMEOUT_MS);
  let response;
  try {
    // Google answers the POST with a redirect to the page that holds the script's output: fetch follows it (and reads the result with a GET, as Apps Script web apps expect).
    response = await fetch(env.EMAIL_GATEWAY_URL, { method: 'POST', redirect: 'follow', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret: env.EMAIL_GATEWAY_SECRET, action: 'sendMail', to, subject, text }) });
  } catch (error) {
    throw mailError(error?.name === 'AbortError' ? 'Il gateway email non ha risposto in tempo.' : 'Il gateway email non è raggiungibile.', 'email-gateway-unreachable');
  } finally { clearTimeout(timer); }
  if (!response.ok) throw mailError(`Il gateway email ha risposto ${response.status}.`, 'email-gateway-http');
  let body;
  try { body = JSON.parse(await response.text()); } catch { throw mailError('Risposta del gateway email non valida.', 'email-gateway-invalid'); }
  if (!body || typeof body !== 'object' || body.ok !== true) throw mailError('Il gateway email non ha confermato l’invio.', 'email-gateway-rejected');
}
// Everything of one account, in one D1 batch (all or nothing): saves, their history, the address, tokens, sessions, the notice of inactivity and the account. Used by the deletion the player asks for
// and by the retention of inactive accounts (which is switched off, see below).
async function deleteAccountData(db, userId) {
  await db.batch([
    db.prepare('DELETE FROM saves WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM save_history WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM save_state WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM email_tokens WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM user_emails WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM users WHERE id = ?').bind(userId)
  ]);
  // the table of the notices exists only once the retention has run (it never does while it is off): nothing to delete when it is not there
  await db.prepare('DELETE FROM retention_notices WHERE user_id = ?').bind(userId).run().catch(() => null);
}

// ---------- retention of inactive accounts: SWITCHED OFF ----------
// The aim is to delete an account after 12 months without activity, with a notice first. The notice can only reach whoever has a VERIFIED e-mail address, and the e-mail channel is not
// configured yet (docs/account-email.md): so nothing runs. `retentionState` says whether the procedure may run at all and why not; `planRetention` only reads (it is the report the owner can
// look at: who would be warned, who would be deleted, who cannot be warned); `runRetention` acts only when ALL of this holds: RETENTION_ENABLED is "1", the mail provider is configured and
// RETENTION_NOTICE_TESTED is "1" (set by the owner after a real notice was received). An account with no verified address is never deleted by the procedure (it cannot be warned).
// "Activity" is read from what the tables hold (a save written, a session opened, the account created): a session older than its 30 days is gone, so a login that saved nothing is not counted after that.
// The steps: 1) notice (e-mail, with the date of deletion, 30 days ahead); 2) after the 30 days, if there has been no activity since the notice, one deletion (deleteAccountData); a notice that was sent
// but not delivered (the provider failed) is not recorded, so the account is warned again at the next run and never deleted without a notice on record.
// For the owner's offline tool (scripts/admin-credential-record.mjs): the same record the Worker writes.
export async function adminCredentialRecord(pin) {
  const salt = randomToken(12);
  return { salt, hash: await pinHash(pin, salt), since: new Date().toISOString(), epoch: randomToken(8) };
}
export const RETENTION = Object.freeze({ inactivityMonths: 12, noticeDays: 30, batch: 50 });
export function retentionState(env) {
  const reasons = [];
  if (env.RETENTION_ENABLED !== '1') reasons.push('RETENTION_ENABLED non è «1»: la procedura è spenta.');
  if (!mailConfigured(env)) reasons.push('Il canale e-mail non è configurato: non si può inviare il preavviso.');
  if (env.RETENTION_NOTICE_TESTED !== '1') reasons.push('RETENTION_NOTICE_TESTED non è «1»: il preavviso non è stato provato con una ricezione reale.');
  return { enabled: reasons.length === 0, reasons };
}
const monthsBack = (now, months) => { const date = new Date(now); date.setUTCMonth(date.getUTCMonth() - months); return date.getTime(); };
export async function planRetention(db, now = Date.now()) {
  const table = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'retention_notices'").first().catch(() => null);
  const users = (await db.prepare('SELECT u.id AS id, u.username AS username, u.created_at AS createdAt, (SELECT MAX(created_at) FROM sessions s WHERE s.user_id = u.id) AS lastSession, (SELECT MAX(updated_at) FROM saves v WHERE v.user_id = u.id) AS lastSave, (SELECT email_norm FROM user_emails e WHERE e.user_id = u.id AND e.verified_at IS NOT NULL) AS email FROM users u').all()).results ?? [];
  const notices = new Map(table ? ((await db.prepare('SELECT user_id AS userId, sent_at AS sentAt FROM retention_notices').all()).results ?? []).map(row => [row.userId, row.sentAt]) : []);
  const limit = monthsBack(now, RETENTION.inactivityMonths);
  const rows = [];
  for (const user of users) {
    const last = Math.max(...[user.createdAt, user.lastSession, user.lastSave].filter(Boolean).map(value => Date.parse(value)).filter(Number.isFinite));
    const noticeAt = notices.has(user.id) ? Date.parse(notices.get(user.id)) : null;
    // inactive for the whole period; a notice counts only if it was sent AFTER the last activity (so an account that came back and fell silent again is warned again)
    let action = 'attivo';
    if (last < limit) {
      if (!user.email) action = 'non-avvisabile';
      else if (noticeAt === null || last >= noticeAt) action = 'avvisare';
      else action = now - noticeAt >= RETENTION.noticeDays * 86_400_000 ? 'eliminare' : 'in-preavviso';
    }
    rows.push({ id: user.id, username: user.username, lastActivity: new Date(last).toISOString(), hasVerifiedEmail: Boolean(user.email), email: user.email ?? null, noticeSentAt: noticeAt === null ? null : new Date(noticeAt).toISOString(), action });
  }
  return rows;
}
export async function runRetention(env, now = Date.now()) {
  const state = retentionState(env);
  if (!state.enabled) return { ran: false, reasons: state.reasons, warned: 0, deleted: 0 };
  const db = env.ACCOUNTS;
  await ensureSchema(db);
  await db.prepare('CREATE TABLE IF NOT EXISTS retention_notices (user_id TEXT PRIMARY KEY, sent_at TEXT NOT NULL, activity_at TEXT NOT NULL)').run();
  const rows = await planRetention(db, now);
  let warned = 0, deleted = 0;
  const base = String(env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  for (const row of rows.filter(item => item.action === 'avvisare').slice(0, RETENTION.batch)) {
    const deadline = new Date(now + RETENTION.noticeDays * 86_400_000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    try {
      await sendMail(env, { to: row.email, subject: MAIL_SUBJECTS.retention, text: `Ciao ${row.username},\n\nil tuo account di POLITICANDO 2026 non è usato da oltre ${RETENTION.inactivityMonths} mesi. Se non lo usi entro il ${deadline}, l’account e i salvataggi online verranno eliminati.\n\nPer tenerlo basta aprire il gioco${base ? ` (${base})` : ''}, accedere e giocare o salvare una partita.\n\nSe non vuoi più l’account puoi anche eliminarlo subito dal gioco.\n\nPOLITICANDO 2026 è una simulazione.` });
    } catch { continue; }
    await db.prepare('INSERT OR REPLACE INTO retention_notices (user_id, sent_at, activity_at) VALUES (?, ?, ?)').bind(row.id, new Date(now).toISOString(), row.lastActivity).run();
    warned++;
  }
  for (const row of rows.filter(item => item.action === 'eliminare').slice(0, RETENTION.batch)) { await deleteAccountData(db, row.id); deleted++; }
  return { ran: true, reasons: [], warned, deleted };
}

const publicBase = (env, request) => {
  const configured = String(env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (/^https:\/\/[^\s/]+$/.test(configured) || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(configured)) return configured;
  const origin = new URL(request.url).origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1];
};
const normalizeEmail = value => { const text = String(value ?? '').trim().toLowerCase(); return text.length <= 254 && EMAIL.test(text) ? text : null; };
const maskEmail = email => { const [name, host] = String(email).split('@'); return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${host}`; };
async function issueToken(db, userId, purpose, emailNorm, ttlMs) {
  const token = randomToken(32);
  // Older tokens of the same purpose stop working: only the latest link counts.
  await db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL').bind(userId, purpose).run();
  await db.prepare('INSERT INTO email_tokens (token_hash, user_id, purpose, email_norm, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, NULL)').bind(await sha256(token), userId, purpose, emailNorm, new Date().toISOString(), Date.now() + ttlMs).run();
  return token;
}
// A token works once: the use is one conditional update, so two requests with the same link cannot both win.
async function useToken(db, token, purpose) {
  if (!/^[\da-f]{64}$/.test(String(token ?? ''))) return null;
  const hash = await sha256(token);
  const row = await db.prepare('SELECT user_id AS userId, email_norm AS emailNorm, expires_at AS expiresAt, used_at AS usedAt FROM email_tokens WHERE token_hash = ? AND purpose = ?').bind(hash, purpose).first();
  if (!row || row.usedAt || row.expiresAt < Date.now()) return null;
  const used = await db.prepare('UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').bind(new Date().toISOString(), hash, Date.now()).run();
  return used?.meta?.changes > 0 ? row : null;
}
async function sendVerification(env, request, db, userId, email, emailNorm) {
  const token = await issueToken(db, userId, 'verify', emailNorm, VERIFY_TOKEN_HOURS * 3_600_000);
  const link = `${publicBase(env, request)}/?verifica-email=${token}`;
  await sendMail(env, { to: email, subject: MAIL_SUBJECTS.verify, text: `Hai chiesto di collegare questo indirizzo al tuo account di POLITICANDO 2026.\n\nPer confermarlo apri questo collegamento (vale ${VERIFY_TOKEN_HOURS} ore e si usa una volta sola):\n${link}\n\nL’indirizzo serve soltanto a recuperare la password. Se non sei stato tu, ignora questo messaggio.` });
}

async function handleAccounts(request, env, url) {
  const db = env.ACCOUNTS;
  if (!db) return json(request, { error: 'Gli account non sono ancora configurati su questo sito.' }, 503);
  await ensureSchema(db);
  const path = url.pathname.replace(/\/+$/, '');
  const mail = mailConfigured(env);
  // The game asks whether the service answers before offering the account (no data, no session needed). `email` says whether messages can really be sent from here.
  if (path === '/api/account/status' && request.method === 'GET') return json(request, { ok: true, service: 'accounts', features: ['account-delete', 'save-protocol-2', 'save-history', ...(mail ? ['email-recovery'] : [])], email: mail, emailRequired: env.ACCOUNT_EMAIL_REQUIRED === '1' });
  if ((path === '/api/account/register' || path === '/api/account/login') && request.method === 'POST') {
    const registering = path.endsWith('register');
    const guard = await accountGuard(db, request, registering ? 'registrazione' : 'accesso');
    const creations = registering ? await accountGuard(db, request, 'creazione', ACCOUNT_CREATIONS, false) : null;
    if (guard.blocked || creations?.blocked) return json(request, { error: 'Troppi tentativi: riprova tra 15 minuti.' }, 429);
    const body = await request.json().catch(() => ({}));
    const username = String(body.username ?? '').trim().toLowerCase();
    const proof = String(body.proof ?? '');
    if (!USERNAME.test(username)) return json(request, { error: 'Nome utente: da 3 a 24 caratteri tra lettere minuscole, numeri, punto, trattino e trattino basso.' }, 400);
    if (!/^[\da-f]{64}$/.test(proof)) return json(request, { error: 'Credenziali non valide.' }, 400);
    if (path.endsWith('register')) {
      // An address is optional (an account without one keeps working, only without recovery by mail); where the owner requires it, it is asked.
      const rawEmail = String(body.email ?? '').trim();
      const emailNorm = rawEmail ? normalizeEmail(rawEmail) : null;
      if (rawEmail && !emailNorm) return json(request, { error: 'Indirizzo email non valido.' }, 400);
      if (!emailNorm && env.ACCOUNT_EMAIL_REQUIRED === '1') return json(request, { error: 'Per creare un account serve un indirizzo email.' }, 400);
      if (await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()) { await guard.fail(); return json(request, { error: 'Questo nome utente è già in uso.' }, 409); }
      const salt = randomToken(16);
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO users (id, username, salt, hash, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, username, salt, await proofHash(proof, salt, 5000), 5000, new Date().toISOString()).run();
      await creations.record();
      let verification = null;
      if (emailNorm) {
        await db.prepare('INSERT INTO user_emails (user_id, email, email_norm, verified_at, created_at) VALUES (?, ?, ?, NULL, ?)').bind(id, rawEmail.slice(0, 254), emailNorm, new Date().toISOString()).run();
        verification = 'non-configurata';
        if (mail) { try { await sendVerification(env, request, db, id, rawEmail, emailNorm); verification = 'inviata'; } catch { verification = 'non-inviata'; } }
      }
      return json(request, { username, token: await openSession(db, id), expiresInDays: ACCOUNT_SESSION_DAYS, ...(verification ? { emailVerification: verification } : {}) }, 201);
    }
    const user = await db.prepare('SELECT id, username, salt, hash, iterations FROM users WHERE username = ?').bind(username).first();
    if (!user || !equalStrings(await proofHash(proof, user.salt, user.iterations), user.hash)) { await guard.fail(); return json(request, { error: 'Nome utente o password non corretti.' }, 401); }
    await guard.clear();
    return json(request, { username: user.username, token: await openSession(db, user.id), expiresInDays: ACCOUNT_SESSION_DAYS });
  }
  // ---- recovery of the password: no session, never says whether an account or an address exists ----
  if (path === '/api/account/recover' && request.method === 'POST') {
    const guard = await accountGuard(db, request, 'recupero', RECOVERY_PER_IP);
    if (guard.blocked) return json(request, { error: 'Troppe richieste: riprova tra 15 minuti.' }, 429);
    await guard.record();
    const body = await request.json().catch(() => ({}));
    const emailNorm = normalizeEmail(body.email);
    const answer = { ok: true, message: 'Se l’indirizzo è collegato a un account con email verificata, riceverai un messaggio con il collegamento per scegliere una nuova password.' };
    if (!emailNorm) return json(request, answer);
    const perMail = await accountGuard(db, request, 'recupero-email', RECOVERY_PER_MAIL, false, (await sha256(emailNorm)).slice(0, 32));
    if (perMail.blocked) return json(request, answer);
    await perMail.record();
    const row = await db.prepare('SELECT user_id AS userId, email FROM user_emails WHERE email_norm = ? AND verified_at IS NOT NULL').bind(emailNorm).first();
    if (row && mail) {
      try {
        const token = await issueToken(db, row.userId, 'reset', emailNorm, RESET_TOKEN_MINUTES * 60_000);
        await sendMail(env, { to: row.email, subject: MAIL_SUBJECTS.reset, text: `Hai chiesto di scegliere una nuova password per il tuo account di POLITICANDO 2026.\n\nApri questo collegamento (vale ${RESET_TOKEN_MINUTES} minuti e si usa una volta sola):\n${publicBase(env, request)}/?reimposta-password=${token}\n\nSe non sei stato tu, ignora questo messaggio: la password non cambia.` });
      } catch { /* the answer is the same: nobody learns whether the address exists or the sending failed */ }
    }
    return json(request, answer);
  }
  if ((path === '/api/account/reset/check' || path === '/api/account/reset') && request.method === 'POST') {
    const guard = await accountGuard(db, request, 'reimposta', RECOVERY_PER_IP * 2);
    if (guard.blocked) return json(request, { error: 'Troppi tentativi: riprova tra 15 minuti.' }, 429);
    const body = await request.json().catch(() => ({}));
    const invalid = async () => { await guard.fail(); return json(request, { error: 'Il collegamento non è valido o è scaduto: chiedine uno nuovo.' }, 400); };
    if (path.endsWith('/check')) {
      const token = String(body.token ?? '');
      if (!/^[\da-f]{64}$/.test(token)) return invalid();
      const row = await db.prepare('SELECT user_id AS userId, expires_at AS expiresAt, used_at AS usedAt FROM email_tokens WHERE token_hash = ? AND purpose = ?').bind(await sha256(token), 'reset').first();
      if (!row || row.usedAt || row.expiresAt < Date.now()) return invalid();
      const user = await db.prepare('SELECT username FROM users WHERE id = ?').bind(row.userId).first();
      return user ? json(request, { ok: true, username: user.username }) : invalid();
    }
    if (!/^[\da-f]{64}$/.test(String(body.proof ?? ''))) return json(request, { error: 'Password non valida.' }, 400);
    const row = await useToken(db, body.token, 'reset');
    if (!row) return invalid();
    const salt = randomToken(16);
    // The new password replaces the old one; every session of the account ends (a stolen session does not survive the change) and no other recovery link stays valid.
    await db.batch([
      db.prepare('UPDATE users SET salt = ?, hash = ?, iterations = ? WHERE id = ?').bind(salt, await proofHash(body.proof, salt, 5000), 5000, row.userId),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.userId),
      db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?').bind(row.userId, 'reset')
    ]);
    await guard.clear();
    return json(request, { ok: true, message: 'Password cambiata: accedi con la nuova password.' });
  }
  if (path === '/api/account/email/verify' && request.method === 'POST') {
    const guard = await accountGuard(db, request, 'verifica-email', RECOVERY_PER_IP * 2);
    if (guard.blocked) return json(request, { error: 'Troppi tentativi: riprova tra 15 minuti.' }, 429);
    const body = await request.json().catch(() => ({}));
    const row = await useToken(db, body.token, 'verify');
    if (!row) { await guard.fail(); return json(request, { error: 'Il collegamento non è valido o è scaduto: chiedine uno nuovo dalle impostazioni dell’account.' }, 400); }
    const mine = await db.prepare('SELECT email_norm AS emailNorm FROM user_emails WHERE user_id = ?').bind(row.userId).first();
    if (!mine || mine.emailNorm !== row.emailNorm) return json(request, { error: 'Questo collegamento si riferisce a un indirizzo che non è più collegato all’account.' }, 400);
    try { await db.prepare('UPDATE user_emails SET verified_at = ? WHERE user_id = ? AND verified_at IS NULL').bind(new Date().toISOString(), row.userId).run(); }
    catch { return json(request, { error: 'Questo indirizzo è già verificato da un altro account.' }, 409); }
    return json(request, { ok: true, message: 'Indirizzo email verificato.' });
  }
  const account = await accountOf(db, request);
  if (!account) return json(request, { error: 'Sessione scaduta o non valida: accedi di nuovo.' }, 401);
  if (path === '/api/account/logout' && request.method === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(account.tokenHash).run();
    return json(request, { ok: true });
  }
  if (path === '/api/account/me' && request.method === 'GET') {
    const count = await db.prepare('SELECT COUNT(*) AS saves FROM saves WHERE user_id = ?').bind(account.id).first();
    const email = await db.prepare('SELECT email, verified_at AS verifiedAt FROM user_emails WHERE user_id = ?').bind(account.id).first();
    return json(request, { username: account.username, createdAt: account.createdAt, saves: count?.saves ?? 0, maxSaves: MAX_SAVES, email: email ? { masked: maskEmail(email.email), verified: Boolean(email.verifiedAt) } : null });
  }
  // Add or change the address of an account (also an old one, without email): the password is proved again, the address stays unverified until the link in the message is opened.
  if ((path === '/api/account/email' || path === '/api/account/email/resend') && request.method === 'POST') {
    const guard = await accountGuard(db, request, 'email', RECOVERY_PER_IP);
    if (guard.blocked) return json(request, { error: 'Troppi tentativi: riprova tra 15 minuti.' }, 429);
    await guard.record();
    const body = await request.json().catch(() => ({}));
    const user = await db.prepare('SELECT id, salt, hash, iterations FROM users WHERE id = ?').bind(account.id).first();
    if (!/^[\da-f]{64}$/.test(String(body.proof ?? '')) || !user || !equalStrings(await proofHash(body.proof, user.salt, user.iterations), user.hash)) { await guard.fail(); return json(request, { error: 'Password non corretta.' }, 403); }
    let stored = await db.prepare('SELECT email, email_norm AS emailNorm, verified_at AS verifiedAt FROM user_emails WHERE user_id = ?').bind(account.id).first();
    if (path.endsWith('/email')) {
      const rawEmail = String(body.email ?? '').trim();
      const emailNorm = normalizeEmail(rawEmail);
      if (!emailNorm) return json(request, { error: 'Indirizzo email non valido.' }, 400);
      if (!stored || stored.emailNorm !== emailNorm) {
        await db.prepare('INSERT INTO user_emails (user_id, email, email_norm, verified_at, created_at) VALUES (?, ?, ?, NULL, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, email_norm = excluded.email_norm, verified_at = NULL, created_at = excluded.created_at').bind(account.id, rawEmail.slice(0, 254), emailNorm, new Date().toISOString()).run();
        await db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?').bind(account.id, 'reset').run();
        stored = { email: rawEmail, emailNorm, verifiedAt: null };
      }
    }
    if (!stored) return json(request, { error: 'Nessun indirizzo collegato all’account.' }, 400);
    if (stored.verifiedAt) return json(request, { ok: true, verified: true, message: 'Questo indirizzo è già verificato.' });
    if (!mail) return json(request, { ok: true, verified: false, sent: false, message: 'L’indirizzo è salvato, ma l’invio delle email non è ancora attivo su questo sito: la verifica si farà appena sarà configurato.' });
    try { await sendVerification(env, request, db, account.id, stored.email, stored.emailNorm); }
    catch { return json(request, { error: 'Non è stato possibile inviare il messaggio: riprova più tardi.' }, 502); }
    return json(request, { ok: true, verified: false, sent: true, message: 'Ti abbiamo scritto: apri il collegamento nel messaggio per confermare l’indirizzo.' });
  }
  // Deletion of the account: the player proves the password again (a stolen session alone cannot do it) and types the confirmation word. The account is found through the session
  // alone, so nobody can delete another account. Saves, their history, the address, tokens, sessions and the account go in one D1 batch (all or nothing); nothing of the player stays in the tables.
  if (path === '/api/account' && request.method === 'DELETE') {
    const guard = await accountGuard(db, request, 'cancellazione');
    if (guard.blocked) return json(request, { error: 'Troppi tentativi: riprova tra 15 minuti.' }, 429);
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'ELIMINA') return json(request, { error: 'Per confermare scrivi ELIMINA: l’account non è stato eliminato.' }, 400);
    if (!/^[\da-f]{64}$/.test(String(body.proof ?? ''))) return json(request, { error: 'Inserisci la password per confermare.' }, 400);
    const user = await db.prepare('SELECT id, salt, hash, iterations FROM users WHERE id = ?').bind(account.id).first();
    if (!user || !equalStrings(await proofHash(body.proof, user.salt, user.iterations), user.hash)) { await guard.fail(); return json(request, { error: 'Password non corretta: l’account non è stato eliminato.' }, 403); }
    const saves = await db.prepare('SELECT COUNT(*) AS n FROM saves WHERE user_id = ?').bind(account.id).first();
    const sessions = await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').bind(account.id).first();
    await deleteAccountData(db, account.id);
    await guard.clear();
    return json(request, { ok: true, deleted: { account: 1, saves: saves?.n ?? 0, sessions: sessions?.n ?? 0 } });
  }
  if (path === '/api/saves' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT s.slot AS slot, s.name AS name, s.meta AS meta, s.revision AS revision, s.size AS size, s.updated_at AS updatedAt, t.progress AS progress, t.career_id AS careerId FROM saves s LEFT JOIN save_state t ON t.user_id = s.user_id AND t.slot = s.slot WHERE s.user_id = ? ORDER BY s.updated_at DESC').bind(account.id).all();
    return json(request, { saves: (results ?? []).map(row => ({ ...row, meta: JSON.parse(row.meta ?? '{}'), progress: row.progress ? JSON.parse(row.progress) : null })) });
  }
  const slotMatch = /^\/api\/saves\/([^/]+)(?:\/(history|restore)(?:\/(\d+))?)?$/.exec(path);
  if (!slotMatch || !SLOT.test(slotMatch[1])) return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
  const slot = slotMatch[1], sub = slotMatch[2] ?? null, historyId = slotMatch[3] ? Number(slotMatch[3]) : null;
  if (sub === 'history' && request.method === 'GET') {
    if (historyId) {
      const row = await db.prepare('SELECT id, revision, name, meta, data, encoding, progress, saved_at AS savedAt, archived_at AS archivedAt, reason FROM save_history WHERE user_id = ? AND slot = ? AND id = ?').bind(account.id, slot, historyId).first();
      return row ? json(request, { ...row, meta: JSON.parse(row.meta ?? '{}'), progress: row.progress ? JSON.parse(row.progress) : null }) : json(request, { error: 'Versione non trovata.' }, 404);
    }
    const { results } = await db.prepare('SELECT id, revision, name, meta, size, progress, saved_at AS savedAt, archived_at AS archivedAt, reason FROM save_history WHERE user_id = ? AND slot = ? ORDER BY id DESC').bind(account.id, slot).all();
    return json(request, { history: (results ?? []).map(row => ({ ...row, meta: JSON.parse(row.meta ?? '{}'), progress: row.progress ? JSON.parse(row.progress) : null })) });
  }
  // The explicit replacement of the online version: the player names the revision he saw, the replaced version is kept, the new revision is higher than any before. Either the copy
  // of a device (`data`) or a version of the history (`historyId`). Nothing automatic ever reaches this route.
  if (sub === 'restore' && request.method === 'POST') {
    const text = await request.text();
    if (text.length > MAX_SAVE_CHARS + 4000) return json(request, { error: 'Salvataggio troppo grande per l’archivio online.' }, 413);
    const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
    if (!body || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) return json(request, { error: 'Indica la revisione online che hai visto: aggiorna l’elenco e riprova.', code: 'base-missing' }, 400);
    const current = await currentRow(db, account.id, slot);
    if ((current?.revision ?? 0) !== body.expectedRevision) return conflictAnswer(request, db, account, slot, { code: 'conflict' });
    let source = body;
    if (Number.isInteger(body.historyId)) {
      const row = await db.prepare('SELECT name, meta, data, encoding FROM save_history WHERE user_id = ? AND slot = ? AND id = ?').bind(account.id, slot, body.historyId).first();
      if (!row) return json(request, { error: 'Versione non trovata nello storico.' }, 404);
      source = { data: row.data, encoding: row.encoding, name: row.name, meta: JSON.parse(row.meta ?? '{}') };
    }
    const decoded = await decodeIncoming(source);
    if (decoded.error) return json(request, { error: decoded.error, code: decoded.code }, 400);
    if (decoded.info.slot !== slot) return json(request, { error: 'Il salvataggio appartiene a un’altra carriera.', code: 'slot-mismatch' }, 400);
    if (!current) {
      const count = await db.prepare('SELECT COUNT(*) AS saves FROM saves WHERE user_id = ?').bind(account.id).first();
      if ((count?.saves ?? 0) >= MAX_SAVES) return json(request, { error: `Puoi conservare online al massimo ${MAX_SAVES} salvataggi: eliminane uno.` }, 409);
    }
    const kept = await slotState(db, account.id, slot, current);
    const outcome = await writeSave(db, account, slot, { current, info: decoded.info, body: source, reason: 'ripristino', lastRevision: kept?.lastRevision ?? 0, origin: { kind: Number.isInteger(body.historyId) ? 'cronologia' : 'dispositivo', replaced: current?.revision ?? null } });
    if (!outcome.written) return conflictAnswer(request, db, account, slot, { code: 'conflict' });
    return json(request, { ok: true, slot, revision: outcome.revision, updatedAt: outcome.updatedAt, restored: true });
  }
  if (sub) return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT s.slot AS slot, s.name AS name, s.meta AS meta, s.data AS data, s.encoding AS encoding, s.revision AS revision, s.updated_at AS updatedAt, t.progress AS progress FROM saves s LEFT JOIN save_state t ON t.user_id = s.user_id AND t.slot = s.slot WHERE s.user_id = ? AND s.slot = ?').bind(account.id, slot).first();
    return row ? json(request, { ...row, meta: JSON.parse(row.meta ?? '{}'), progress: row.progress ? JSON.parse(row.progress) : null }) : json(request, { error: 'Salvataggio non trovato.' }, 404);
  }
  if (request.method === 'DELETE') {
    // The versions kept in the history stay (a deleted career can still be recovered from them); the revision counter stays too, so a new copy never repeats a revision.
    await db.batch([
      db.prepare('INSERT INTO save_history (user_id, slot, revision, name, meta, data, encoding, size, progress, saved_at, archived_at, reason) SELECT s.user_id, s.slot, s.revision, s.name, s.meta, s.data, s.encoding, s.size, (SELECT progress FROM save_state WHERE user_id = s.user_id AND slot = s.slot), s.updated_at, ?, ? FROM saves s WHERE s.user_id = ? AND s.slot = ?').bind(new Date().toISOString(), 'ripristino', account.id, slot),
      db.prepare('INSERT INTO save_state (user_id, slot, career_id, progress, last_revision, origin, updated_at) SELECT s.user_id, s.slot, NULL, NULL, s.revision, NULL, ? FROM saves s WHERE s.user_id = ? AND s.slot = ? ON CONFLICT(user_id, slot) DO UPDATE SET career_id = NULL, progress = NULL, last_revision = MAX(save_state.last_revision, excluded.last_revision), updated_at = excluded.updated_at').bind(new Date().toISOString(), account.id, slot),
      db.prepare('DELETE FROM saves WHERE user_id = ? AND slot = ?').bind(account.id, slot)
    ]);
    return json(request, { ok: true });
  }
  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_SAVE_CHARS + 4000) return json(request, { error: 'Salvataggio troppo grande per l’archivio online.' }, 413);
    const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
    const decoded = await decodeIncoming(body);
    if (decoded.error) return json(request, { error: decoded.error, code: decoded.code }, 400);
    // The slot holds only the career it is named after.
    if (decoded.info.slot !== slot) return json(request, { error: 'Il salvataggio appartiene a un’altra carriera: non può stare in questo slot.', code: 'slot-mismatch' }, 400);
    const current = await currentRow(db, account.id, slot);
    if (!current) {
      const count = await db.prepare('SELECT COUNT(*) AS saves FROM saves WHERE user_id = ?').bind(account.id).first();
      if ((count?.saves ?? 0) >= MAX_SAVES) return json(request, { error: `Puoi conservare online al massimo ${MAX_SAVES} salvataggi: eliminane uno.` }, 409);
    }
    // The revision this snapshot started from must be exactly the revision online now: lower = another device saved since; higher or unknown = this device cannot prove where its copy comes from.
    // (A body with `force` is read like any other: there is no way to skip these checks.)
    if (!Number.isInteger(body.baseRevision) || body.baseRevision < 0) return json(request, { error: 'Revisione di partenza mancante: aggiorna l’elenco dei salvataggi e riprova.', code: 'base-missing' }, 400);
    const expected = current?.revision ?? 0;
    const kept = await slotState(db, account.id, slot, current);
    if (body.baseRevision < expected) return conflictAnswer(request, db, account, slot, { code: 'conflict' });
    if (body.baseRevision > expected) return conflictAnswer(request, db, account, slot, { code: 'base-ahead', error: 'La revisione di partenza non corrisponde a quella online: la copia di questo dispositivo non può essere verificata.' });
    // The content is not behind the career kept online (read from the content on both sides): a copy of week 1 cannot replace week 21, whatever revision it declares.
    if (current && kept?.progress) {
      if (kept.careerId && kept.careerId !== decoded.info.careerId) return conflictAnswer(request, db, account, slot, { code: 'slot-mismatch', error: 'Online c’è un’altra carriera in questo slot.' });
      if (compareProgress(decoded.info.progress, kept.progress) < 0) return conflictAnswer(request, db, account, slot, { code: 'regression', error: 'La copia di questo dispositivo è più indietro della carriera online: non la sovrascrive.', localProgress: decoded.info.progress, remoteProgress: kept.progress });
    }
    const origin = { kind: 'auto', baseRevision: body.baseRevision, localRevision: decoded.info.localRevision, claimed: body.origin && typeof body.origin === 'object' ? { device: String(body.origin.device ?? '').slice(0, 40) || null, localRevision: Number.isSafeInteger(body.origin.localRevision) ? body.origin.localRevision : null } : null };
    const outcome = await writeSave(db, account, slot, { current, info: decoded.info, body, reason: 'sostituita', lastRevision: kept?.lastRevision ?? 0, origin });
    if (!outcome.written) return conflictAnswer(request, db, account, slot, { code: 'conflict' });
    return json(request, { ok: true, slot, revision: outcome.revision, updatedAt: outcome.updatedAt, progress: decoded.info.progress });
  }
  return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...API_SECURITY_HEADERS, ...cors(request) } });
  if (url.pathname.startsWith('/api/account') || url.pathname.startsWith('/api/saves')) return handleAccounts(request, env, url);
  if (!env.ADMIN_ARCHIVE) return json(request, { error: 'Archivio condiviso non configurato.' }, 503);
  if (url.pathname === '/api/admin' && request.method === 'GET') {
    const archive = await env.ADMIN_ARCHIVE.get(ARCHIVE_KEY, 'json') ?? emptyArchive();
    return json(request, { ...archive, configured: Boolean(await env.ADMIN_ARCHIVE.get(PIN_KEY)), source: 'user' });
  }
  // Is this browser's owner session still valid? The game shows the admin area only after the server says so.
  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    return await sessionValid(env, request) ? json(request, { valid: true }) : json(request, { error: 'Sessione amministrativa non valida o scaduta.' }, 401);
  }
  if (url.pathname === '/api/admin/session' && request.method === 'POST') {
    const guard = await tooManyFailures(env, request);
    if (guard.blocked) return json(request, { error: 'Troppi tentativi: riprova tra 15 minuti.' }, 429);
    const body = await request.json().catch(() => ({}));
    const pin = String(body.pin ?? '');
    if (pin.length < 6 || pin.length > 64) return json(request, { error: 'Il PIN deve avere da 6 a 64 caratteri.' }, 400);
    const stored = await env.ADMIN_ARCHIVE.get(PIN_KEY, 'json');
    const fail = async message => { await env.ADMIN_ARCHIVE.put(guard.key, String(guard.count + 1), { expirationTtl: 900 }); return json(request, { error: message }, 401); };
    if (!stored) {
      // First connection: the setup code (a Worker secret known only to the owner) binds the PIN to the archive.
      if (!env.ADMIN_SETUP_CODE || !equalStrings(String(body.setupCode ?? ''), env.ADMIN_SETUP_CODE)) return fail('Codice di attivazione non corretto.');
      const salt = randomToken(12);
      await env.ADMIN_ARCHIVE.put(PIN_KEY, JSON.stringify({ salt, hash: await pinHash(pin, salt), since: new Date().toISOString(), epoch: '1' }));
    } else if (!equalStrings(await pinHash(pin, stored.salt), stored.hash)) return fail('PIN non corretto.');
    const token = randomToken();
    await env.ADMIN_ARCHIVE.put(`sessione:${token}`, credentialEpoch(await env.ADMIN_ARCHIVE.get(PIN_KEY, 'json')), { expirationTtl: SESSION_SECONDS });
    return json(request, { token, expiresIn: SESSION_SECONDS });
  }
  // Rotation of the owner's credential. Either the open session plus the current credential, or the Worker's setup code (the owner's way back in if the credential is lost).
  // The same attempt limit as the login applies; every older session stops working; the new credential is returned to nobody and written nowhere in clear.
  if (url.pathname === '/api/admin/credential' && request.method === 'POST') {
    const guard = await tooManyFailures(env, request);
    if (guard.blocked) return json(request, { error: 'Troppi tentativi: riprova tra 15 minuti.' }, 429);
    const body = await request.json().catch(() => ({}));
    const newPin = String(body.newPin ?? '');
    if (newPin.length < 6 || newPin.length > 64) return json(request, { error: 'La nuova credenziale deve avere da 6 a 64 caratteri.' }, 400);
    const stored = await env.ADMIN_ARCHIVE.get(PIN_KEY, 'json');
    const fail = async (message, status = 401) => { await env.ADMIN_ARCHIVE.put(guard.key, String(guard.count + 1), { expirationTtl: 900 }); return json(request, { error: message }, status); };
    const viaSetupCode = typeof body.setupCode === 'string' && body.setupCode.length > 0;
    if (viaSetupCode) {
      if (!env.ADMIN_SETUP_CODE || !equalStrings(body.setupCode, env.ADMIN_SETUP_CODE)) return fail('Codice di attivazione non corretto.');
    } else {
      if (!stored) return fail('Nessuna credenziale da sostituire: serve il codice di attivazione.', 409);
      if (!await sessionValid(env, request)) return fail('Sessione amministrativa non valida o scaduta.');
      if (!equalStrings(await pinHash(String(body.currentPin ?? ''), stored.salt), stored.hash)) return fail('La credenziale attuale non è corretta.');
    }
    if (stored && equalStrings(await pinHash(newPin, stored.salt), stored.hash)) return json(request, { error: 'La nuova credenziale deve essere diversa da quella attuale.' }, 400);
    const record = await replaceCredential(env, newPin);
    const token = randomToken();
    await env.ADMIN_ARCHIVE.put(`sessione:${token}`, record.epoch, { expirationTtl: SESSION_SECONDS });
    return json(request, { ok: true, token, expiresIn: SESSION_SECONDS, since: record.since });
  }
  // The shared logo catalog: the files are public to read; publishing, replacing, removing and migrating need the owner's session.
  const logoRoute = url.pathname.match(/^\/api\/admin\/logo\/([^/]+)$/);
  if (logoRoute && request.method === 'GET') return serveLogo(env, request, decodeURIComponent(logoRoute[1]));
  const logosRoute = url.pathname.match(/^\/api\/admin\/logos\/([^/]+)$/);
  if (logosRoute || url.pathname === '/api/admin/logos/migrate') {
    if (!await sessionValid(env, request)) return json(request, { error: 'Sessione amministrativa scaduta: inserisci di nuovo il PIN.' }, 401);
    if (url.pathname === '/api/admin/logos/migrate' && request.method === 'POST') return json(request, { ok: true, ...await migrateDataLogos(env, request) });
    const entityId = decodeURIComponent(logosRoute?.[1] ?? '');
    if (request.method === 'PUT') {
      const text = await request.text();
      if (text.length > Math.ceil(MAX_LOGO_FILE * 4 / 3) + 4000) return json(request, { error: 'Il file deve essere più piccolo di 2 MB.' }, 413);
      let input;
      try { input = JSON.parse(text); } catch { return json(request, { error: 'Richiesta non valida.' }, 400); }
      const result = await publishLogoFile(env, request, entityId, input);
      if (result.error) return json(request, { error: result.error }, result.status);
      return json(request, { ok: true, entityId, logo: result.entry, replaced: result.replaced, unchanged: result.unchanged, updatedAt: result.updatedAt });
    }
    if (request.method === 'DELETE') {
      const result = await removeLogo(env, entityId);
      if (result.error) return json(request, { error: result.error }, result.status);
      return json(request, { ok: true, entityId, removed: result.removed, updatedAt: result.updatedAt });
    }
  }
  if (url.pathname === '/api/admin' && request.method === 'PUT') {
    if (!await sessionValid(env, request)) return json(request, { error: 'Sessione amministrativa scaduta: inserisci di nuovo il PIN.' }, 401);
    const text = await request.text();
    if (text.length > MAX_BYTES) return json(request, { error: 'Archivio troppo grande.' }, 413);
    let archive;
    try { archive = cleanArchive(JSON.parse(text)); } catch (error) { return json(request, { error: error.message || 'Archivio non valido.' }, 400); }
    // The published files are not the page's to rewrite: a logo kept as a file stays in the catalog unless the owner removes it (DELETE) or replaces it with another logo.
    const stored = await readArchive(env);
    const replaced = [];
    for (const [entityId, logo] of Object.entries(stored.logos)) {
      if (logo?.kind !== 'asset') continue;
      if (!archive.logos[entityId]) archive.logos[entityId] = logo; else replaced.push(logo.sha256);
    }
    await env.ADMIN_ARCHIVE.put(ARCHIVE_KEY, JSON.stringify(archive));
    for (const hash of replaced) if (!stillUsed(archive, hash, null)) await logoFiles(env).delete(hash).catch(() => {});
    return json(request, { ok: true, updatedAt: archive.updatedAt, parties: Object.keys(archive.parties).length, politicians: Object.keys(archive.politicians).length, logos: Object.keys(archive.logos).length, addedParties: Object.keys(archive.addedParties).length, hidden: Object.values(archive.hidden).filter(item => item.hidden).length });
  }
  return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env); }
      catch (error) { return json(request, { error: url.pathname.startsWith('/api/admin') ? 'Errore interno dell’archivio condiviso.' : 'Errore interno del servizio account.' }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
  // Daily (wrangler.jsonc, triggers.crons): expired sessions and old attempts go even when nobody logs in.
  async scheduled(event, env, ctx) {
    if (!env.ACCOUNTS) return;
    ctx.waitUntil((async () => { await ensureSchema(env.ACCOUNTS); await cleanupExpired(env.ACCOUNTS); await runRetention(env); })());
  }
};
