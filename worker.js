// POLITICANDO 2026 on Cloudflare Workers: static assets for the game, a small shared archive for the owner's
// corrections and party logos (Workers KV), and player accounts with online career saves (Cloudflare D1).
// The real dataset files are never written.
const ARCHIVE_KEY = 'archivio-condiviso';
const PIN_KEY = 'pin-amministratore';
const MAX_BYTES = 1_500_000;
const MAX_LOGO_BYTES = 420_000;
const SESSION_SECONDS = 12 * 3600;
const MAX_FAILURES = 8;
const ALLOWED_ORIGINS = ['https://bianchimatteo-ship-it.github.io', 'https://palazzo-2026-site.bianchimatteo657.workers.dev', 'http://127.0.0.1:8791', 'http://localhost:8791'];

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
function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(request) } });
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
  return { version: 1, updatedAt: new Date().toISOString(), parties: records(input.parties), politicians: records(input.politicians), logos, addedParties, hidden };
}
async function tooManyFailures(env, request) {
  const key = `tentativi:${request.headers.get('cf-connecting-ip') ?? 'locale'}`;
  const count = Number(await env.ADMIN_ARCHIVE.get(key) ?? 0);
  return { key, count, blocked: count >= MAX_FAILURES };
}
async function sessionValid(env, request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return /^[\da-f]{48}$/.test(token) && Boolean(await env.ADMIN_ARCHIVE.get(`sessione:${token}`));
}

// ---------- player accounts and online saves (D1) ----------
// The password never reaches the server: the browser stretches it (PBKDF2, 310 000 iterations, salt from the username)
// and sends only that proof, which the server hashes again with its own random salt. Sessions are random tokens,
// stored only as SHA-256 hashes. Saves are kept per account and slot, with a revision number against overwrites.
const ACCOUNT_SESSION_DAYS = 30;
const MAX_SAVE_CHARS = 1_900_000;
const MAX_SAVES = 12;
const ACCOUNT_FAILURES = 10;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const SLOT = /^[a-z0-9-]{1,40}$/;
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, iterations INTEGER NOT NULL, created_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS saves (user_id TEXT NOT NULL, slot TEXT NOT NULL, name TEXT, meta TEXT, data TEXT NOT NULL, encoding TEXT NOT NULL, revision INTEGER NOT NULL, size INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, slot))',
  'CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)'
];
let schemaReady = null;
const ensureSchema = db => (schemaReady ??= db.batch(SCHEMA.map(sql => db.prepare(sql))).catch(error => { schemaReady = null; throw error; }));
const sha256 = async text => toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
async function proofHash(proof, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(proof)), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256));
}
async function accountGuard(db, request, scope) {
  const key = `${scope}:${request.headers.get('cf-connecting-ip') ?? 'locale'}`;
  const now = Date.now();
  const row = await db.prepare('SELECT count, window_start FROM attempts WHERE key = ?').bind(key).first();
  const fresh = !row || now - row.window_start > 15 * 60_000;
  return {
    blocked: !fresh && row.count >= ACCOUNT_FAILURES,
    fail: () => db.prepare('INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN ? - window_start > 900000 THEN 1 ELSE count + 1 END, window_start = CASE WHEN ? - window_start > 900000 THEN ? ELSE window_start END').bind(key, now, now, now, now).run(),
    clear: () => db.prepare('DELETE FROM attempts WHERE key = ?').bind(key).run()
  };
}
async function openSession(db, userId) {
  const token = randomToken(32);
  await db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(userId, Date.now()).run();
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
  return { player: text('player'), role: text('role'), party: text('party'), gameDate: text('gameDate'), status: text('status'), difficulty: text('difficulty'), week: Number.isFinite(value.week) ? value.week : null };
};
async function handleAccounts(request, env, url) {
  const db = env.ACCOUNTS;
  if (!db) return json(request, { error: 'Gli account non sono ancora configurati su questo sito.' }, 503);
  await ensureSchema(db);
  const path = url.pathname.replace(/\/+$/, '');
  if ((path === '/api/account/register' || path === '/api/account/login') && request.method === 'POST') {
    const guard = await accountGuard(db, request, path.endsWith('register') ? 'registrazione' : 'accesso');
    if (guard.blocked) return json(request, { error: 'Troppi tentativi: riprova tra 15 minuti.' }, 429);
    const body = await request.json().catch(() => ({}));
    const username = String(body.username ?? '').trim().toLowerCase();
    const proof = String(body.proof ?? '');
    if (!USERNAME.test(username)) return json(request, { error: 'Nome utente: da 3 a 24 caratteri tra lettere minuscole, numeri, punto, trattino e trattino basso.' }, 400);
    if (!/^[\da-f]{64}$/.test(proof)) return json(request, { error: 'Credenziali non valide.' }, 400);
    if (path.endsWith('register')) {
      if (await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()) { await guard.fail(); return json(request, { error: 'Questo nome utente è già in uso.' }, 409); }
      const salt = randomToken(16);
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO users (id, username, salt, hash, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, username, salt, await proofHash(proof, salt, 5000), 5000, new Date().toISOString()).run();
      await guard.fail();
      return json(request, { username, token: await openSession(db, id), expiresInDays: ACCOUNT_SESSION_DAYS }, 201);
    }
    const user = await db.prepare('SELECT id, username, salt, hash, iterations FROM users WHERE username = ?').bind(username).first();
    if (!user || !equalStrings(await proofHash(proof, user.salt, user.iterations), user.hash)) { await guard.fail(); return json(request, { error: 'Nome utente o password non corretti.' }, 401); }
    await guard.clear();
    return json(request, { username: user.username, token: await openSession(db, user.id), expiresInDays: ACCOUNT_SESSION_DAYS });
  }
  const account = await accountOf(db, request);
  if (!account) return json(request, { error: 'Sessione scaduta o non valida: accedi di nuovo.' }, 401);
  if (path === '/api/account/logout' && request.method === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(account.tokenHash).run();
    return json(request, { ok: true });
  }
  if (path === '/api/account/me' && request.method === 'GET') {
    const count = await db.prepare('SELECT COUNT(*) AS saves FROM saves WHERE user_id = ?').bind(account.id).first();
    return json(request, { username: account.username, createdAt: account.createdAt, saves: count?.saves ?? 0, maxSaves: MAX_SAVES });
  }
  if (path === '/api/saves' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT slot, name, meta, revision, size, updated_at AS updatedAt FROM saves WHERE user_id = ? ORDER BY updated_at DESC').bind(account.id).all();
    return json(request, { saves: (results ?? []).map(row => ({ ...row, meta: JSON.parse(row.meta ?? '{}') })) });
  }
  const slotMatch = /^\/api\/saves\/([^/]+)$/.exec(path);
  if (!slotMatch || !SLOT.test(slotMatch[1])) return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
  const slot = slotMatch[1];
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT slot, name, meta, data, encoding, revision, updated_at AS updatedAt FROM saves WHERE user_id = ? AND slot = ?').bind(account.id, slot).first();
    return row ? json(request, { ...row, meta: JSON.parse(row.meta ?? '{}') }) : json(request, { error: 'Salvataggio non trovato.' }, 404);
  }
  if (request.method === 'DELETE') {
    await db.prepare('DELETE FROM saves WHERE user_id = ? AND slot = ?').bind(account.id, slot).run();
    return json(request, { ok: true });
  }
  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_SAVE_CHARS + 4000) return json(request, { error: 'Salvataggio troppo grande per l’archivio online.' }, 413);
    const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
    if (!body || typeof body.data !== 'string' || !['json', 'gzip-base64'].includes(body.encoding) || body.data.length > MAX_SAVE_CHARS) return json(request, { error: 'Salvataggio non valido.' }, 400);
    const current = await db.prepare('SELECT revision, updated_at AS updatedAt, meta FROM saves WHERE user_id = ? AND slot = ?').bind(account.id, slot).first();
    if (!current) {
      const count = await db.prepare('SELECT COUNT(*) AS saves FROM saves WHERE user_id = ?').bind(account.id).first();
      if ((count?.saves ?? 0) >= MAX_SAVES) return json(request, { error: `Puoi conservare online al massimo ${MAX_SAVES} salvataggi: eliminane uno.` }, 409);
    }
    // Another device saved in the meantime: the newer save is not overwritten unless the player chooses so.
    if (current && !body.force && Number.isFinite(body.baseRevision) && body.baseRevision < current.revision) return json(request, { error: 'Questo salvataggio è stato aggiornato da un altro dispositivo.', conflict: true, remote: { revision: current.revision, updatedAt: current.updatedAt, meta: JSON.parse(current.meta ?? '{}') } }, 409);
    const revision = (current?.revision ?? 0) + 1;
    const updatedAt = new Date().toISOString();
    await db.prepare('INSERT INTO saves (user_id, slot, name, meta, data, encoding, revision, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, slot) DO UPDATE SET name = excluded.name, meta = excluded.meta, data = excluded.data, encoding = excluded.encoding, revision = excluded.revision, size = excluded.size, updated_at = excluded.updated_at')
      .bind(account.id, slot, String(body.name ?? '').slice(0, 80) || null, JSON.stringify(cleanMeta(body.meta)), body.data, body.encoding, revision, body.data.length, updatedAt).run();
    return json(request, { ok: true, slot, revision, updatedAt });
  }
  return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
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
      await env.ADMIN_ARCHIVE.put(PIN_KEY, JSON.stringify({ salt, hash: await pinHash(pin, salt), since: new Date().toISOString() }));
    } else if (!equalStrings(await pinHash(pin, stored.salt), stored.hash)) return fail('PIN non corretto.');
    const token = randomToken();
    await env.ADMIN_ARCHIVE.put(`sessione:${token}`, '1', { expirationTtl: SESSION_SECONDS });
    return json(request, { token, expiresIn: SESSION_SECONDS });
  }
  if (url.pathname === '/api/admin' && request.method === 'PUT') {
    if (!await sessionValid(env, request)) return json(request, { error: 'Sessione amministrativa scaduta: inserisci di nuovo il PIN.' }, 401);
    const text = await request.text();
    if (text.length > MAX_BYTES) return json(request, { error: 'Archivio troppo grande.' }, 413);
    let archive;
    try { archive = cleanArchive(JSON.parse(text)); } catch (error) { return json(request, { error: error.message || 'Archivio non valido.' }, 400); }
    await env.ADMIN_ARCHIVE.put(ARCHIVE_KEY, JSON.stringify(archive));
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
  }
};
