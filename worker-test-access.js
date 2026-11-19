// Password gate of the PRIVATE TEST site only. It is active when TEST_ACCESS_ENABLED=1 (wrangler.test.jsonc); the production Worker never sets it, so none of this runs there.
// The password is the Worker secret TEST_ACCESS_PASSWORD (`wrangler secret put`), never in the code or the repository. With the gate on and no secret set, EVERYTHING answers 503 (closed, never open).
// The session is a signed token (HMAC-SHA-256 keyed by the secret: changing the password ends every session) in a Secure, HttpOnly, SameSite=Strict cookie that expires; logout also revokes the token.
// Failed logins are limited per address (KV when available, in memory otherwise).
const encoder = new TextEncoder();
export const COOKIE = '__Host-pt_session';
export const LOGIN_PATH = '/__test-login';
export const LOGOUT_PATH = '/__test-logout';
const SESSION_SECONDS = 12 * 3600;
const MAX_FAILURES = 5;
const LOCK_SECONDS = 15 * 60;
const memoryFailures = new Map();

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hmac = async (secret, text) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(`politicando-test-access-v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, encoder.encode(text)));
};
const sameText = (a, b) => { const x = String(a), y = String(b); let diff = x.length ^ y.length; for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0); return diff === 0; };
const passwordMatches = async (secret, given) => sameText(await hmac(secret, `password:${given}`), await hmac(secret, `password:${secret}`));
const esc = text => String(text).replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
const cookieOf = (request, name) => (request.headers.get('cookie') ?? '').split(/;\s*/).map(part => part.split('=')).find(([key]) => key === name)?.slice(1).join('=') ?? '';

const baseHeaders = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' };
const cookieHeader = (value, maxAge) => `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Strict`;

// A page that also empties the offline copy of the game kept by the service worker: an old, remembered version must not stay reachable.
const PURGE = `<script>(async()=>{try{for(const k of await caches.keys())if(k.startsWith('politicando-'))await caches.delete(k);for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();}catch(e){}})();</script>`;
const page = (title, body, status = 200, extra = {}) => new Response(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:380px;margin:12vh auto;padding:0 20px}input,button{font:inherit;padding:10px;width:100%;box-sizing:border-box;margin-top:10px}.e{color:#b00020}</style></head><body>${body}${PURGE}</body></html>`, { status, headers: { ...baseHeaders, 'content-type': 'text/html; charset=utf-8', ...extra } });
const loginPage = (next, message = '', status = 200, extra = {}) => page('POLITICANDO TEST — accesso', `<h1>POLITICANDO TEST</h1><p>Sito di prova riservato.</p>${message ? `<p class="e" role="alert">${esc(message)}</p>` : ''}<form method="post" action="${LOGIN_PATH}"><input type="hidden" name="next" value="${esc(next)}"><label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label><button type="submit">Entra</button></form>`, status, extra);
const safeNext = value => { const text = String(value ?? '/'); return text.startsWith('/') && !text.startsWith('//') && !text.startsWith('/\\') && !text.startsWith(LOGIN_PATH) && !text.startsWith(LOGOUT_PATH) ? text.slice(0, 500) : '/'; };

async function failuresOf(env, ip) {
  const key = `testaccess:fail:${ip}`;
  const now = Date.now();
  if (env.ADMIN_ARCHIVE?.get) { try { const stored = await env.ADMIN_ARCHIVE.get(key, 'json'); return { key, count: stored?.count ?? 0, until: stored?.until ?? 0, now }; } catch { /* memory */ } }
  const stored = memoryFailures.get(key); return { key, count: stored?.count ?? 0, until: stored?.until ?? 0, now };
}
async function saveFailures(env, state, count, until) {
  const value = { count, until };
  if (env.ADMIN_ARCHIVE?.put) { try { await env.ADMIN_ARCHIVE.put(state.key, JSON.stringify(value), { expirationTtl: LOCK_SECONDS + 60 }); return; } catch { /* memory */ } }
  memoryFailures.set(state.key, value);
}
async function clearFailures(env, state) { if (env.ADMIN_ARCHIVE?.delete) { try { await env.ADMIN_ARCHIVE.delete(state.key); } catch { /* memory */ } } memoryFailures.delete(state.key); }

async function sessionValid(request, env) {
  const token = cookieOf(request, COOKIE);
  const [exp, nonce, signature] = token.split('.');
  if (!exp || !nonce || !signature || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  if (!sameText(signature, await hmac(env.TEST_ACCESS_PASSWORD, `session:${exp}.${nonce}`))) return false;
  if (env.ADMIN_ARCHIVE?.get) { try { if (await env.ADMIN_ARCHIVE.get(`testaccess:revoked:${nonce}`)) return false; } catch { /* no revocation list reachable: the signature and expiry still hold */ } }
  return true;
}

// Returns a Response when the request must stop here (login, logout, refusal), or null when it is authenticated and may go on.
export async function testAccessGate(request, env) {
  if (env.TEST_ACCESS_ENABLED !== '1') return null;
  if (!env.TEST_ACCESS_PASSWORD || String(env.TEST_ACCESS_PASSWORD).length < 8) return new Response('Sito di prova non configurato.', { status: 503, headers: { ...baseHeaders, 'content-type': 'text/plain; charset=utf-8' } });
  const url = new URL(request.url);
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';

  if (url.pathname === LOGIN_PATH) {
    if (request.method === 'POST') {
      const state = await failuresOf(env, ip);
      const form = await request.formData().catch(() => new FormData());
      const next = safeNext(form.get('next'));
      if (state.until > state.now) return loginPage(next, 'Troppi tentativi: riprova più tardi.', 429, { 'retry-after': String(Math.ceil((state.until - state.now) / 1000)) });
      if (!await passwordMatches(env.TEST_ACCESS_PASSWORD, String(form.get('password') ?? ''))) {
        const count = state.count + 1;
        await saveFailures(env, state, count, count >= MAX_FAILURES ? state.now + LOCK_SECONDS * 1000 : 0);
        return loginPage(next, 'Password errata.', 401);
      }
      await clearFailures(env, state);
      const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
      const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
      const token = `${exp}.${nonce}.${await hmac(env.TEST_ACCESS_PASSWORD, `session:${exp}.${nonce}`)}`;
      return new Response(null, { status: 303, headers: { ...baseHeaders, location: next, 'set-cookie': cookieHeader(token, SESSION_SECONDS) } });
    }
    return loginPage(safeNext(url.searchParams.get('next')));
  }
  if (url.pathname === LOGOUT_PATH) {
    if (request.method !== 'POST') return page('POLITICANDO TEST — esci', `<h1>Esci</h1><form method="post" action="${LOGOUT_PATH}"><button type="submit">Esci dal sito di prova</button></form>`);
    const [exp, nonce] = cookieOf(request, COOKIE).split('.');
    if (nonce && env.ADMIN_ARCHIVE?.put && Number(exp) * 1000 > Date.now()) { try { await env.ADMIN_ARCHIVE.put(`testaccess:revoked:${nonce}`, '1', { expirationTtl: Math.max(60, Number(exp) - Math.floor(Date.now() / 1000) + 60) }); } catch { /* the cookie is cleared anyway */ } }
    return page('POLITICANDO TEST — uscito', '<h1>Uscito</h1><p>La sessione è chiusa e la copia offline del gioco è stata svuotata.</p><p><a href="/">Torna all’accesso</a></p>', 200, { 'set-cookie': cookieHeader('', 0), 'clear-site-data': '"cache"' });
  }
  if (await sessionValid(request, env)) return null;
  const wantsPage = request.method === 'GET' && /text\/html/.test(request.headers.get('accept') ?? '') && !url.pathname.startsWith('/api/');
  if (wantsPage) return loginPage(safeNext(url.pathname + url.search), '', 401);
  return new Response('Accesso riservato.', { status: 401, headers: { ...baseHeaders, 'content-type': 'text/plain; charset=utf-8' } });
}

// What an authenticated response must not do: be kept by a shared cache.
export function privateResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', /no-store/.test(headers.get('cache-control') ?? '') ? 'private, no-store' : 'private, no-cache');
  headers.set('vary', 'Cookie'); headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
