// POLITICANDO 2026 on Cloudflare Workers: static assets for the game, plus a small shared archive
// for the owner's corrections and party logos (Workers KV). The real dataset files are never written.
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
  return { 'access-control-allow-origin': allowed, 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400', vary: 'origin' };
}
function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(request) } });
}
const emptyArchive = () => ({ version: 1, updatedAt: null, parties: {}, politicians: {}, logos: {} });

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
  return { version: 1, updatedAt: new Date().toISOString(), parties: records(input.parties), politicians: records(input.politicians), logos };
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

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  if (!env.ADMIN_ARCHIVE) return json(request, { error: 'Archivio condiviso non configurato.' }, 503);
  if (url.pathname === '/api/admin' && request.method === 'GET') {
    const archive = await env.ADMIN_ARCHIVE.get(ARCHIVE_KEY, 'json') ?? emptyArchive();
    return json(request, { ...archive, configured: Boolean(await env.ADMIN_ARCHIVE.get(PIN_KEY)), source: 'user' });
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
    return json(request, { ok: true, updatedAt: archive.updatedAt, parties: Object.keys(archive.parties).length, politicians: Object.keys(archive.politicians).length, logos: Object.keys(archive.logos).length });
  }
  return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env); }
      catch (error) { return json(request, { error: 'Errore interno dell’archivio condiviso.' }, 500); }
    }
    return env.ASSETS.fetch(request);
  }
};
