// E-mail of the accounts through the Google Apps Script gateway, with a SIMULATED gateway (no request leaves this process, no message is sent): the settings that switch it on, the exact request
// (POST JSON with secret, action, to, subject, text; the subject among the ones the gateway allows), a message counted as sent only when the gateway confirms, every failure (HTTP error, HTML
// instead of JSON, ok:false, network error, timeout), the flows (verification, recovery, reset) through the gateway, the neutral answers and the secret never in answers or logs.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const sqlite = new DatabaseSync(':memory:');
const statement = (sql, params = []) => ({
  bind: (...values) => statement(sql, values),
  first: async () => sqlite.prepare(sql).get(...params) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
  run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...params) })
});
const d1 = { prepare: sql => statement(sql), batch: async list => Promise.all(list.map(item => item.run())), exec: async sql => sqlite.exec(sql) };
const ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const GATEWAY = 'https://script.google.com/macros/s/AKfycbw4iyWEgh5H-3lEtktBHewnMqR1ldI-D6q3xvwvhOTZ4I5LYWI7g07PO751uAtXVwb6-w/exec';
const SECRET = `segreto-di-prova-${Math.random().toString(16).slice(2)}`;
const base = { ACCOUNTS: d1, ADMIN_ARCHIVE: { get: async () => null, put: async () => {}, delete: async () => {} }, ASSETS: { fetch: async () => new Response('asset') }, PUBLIC_BASE_URL: ORIGIN };
const configured = { ...base, EMAIL_GATEWAY_URL: GATEWAY, EMAIL_GATEWAY_SECRET: SECRET };
const worker = (await import('../worker.js?deploy=email-gateway')).default;
const { MAIL_SUBJECTS } = await import('../worker.js?deploy=email-gateway');

// the simulated gateway: `behaviour` decides the answer; every call is recorded
const calls = [];
let behaviour = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (String(url) !== GATEWAY) return realFetch(url, init);
  calls.push({ url: String(url), init, body: JSON.parse(init.body) });
  return behaviour(init);
};
const logs = [];
for (const level of ['log', 'warn', 'error', 'info']) { const original = console[level]; console[level] = (...args) => { logs.push(args.map(String).join(' ')); original.apply(console, args); }; }

const seen = [];
const api = async (path, { method = 'GET', body, token, ip = '198.51.100.7', environment = configured } = {}) => {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const response = await worker.fetch(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), environment);
  const text = await response.text(); seen.push(text);
  let parsed = null; try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, body: parsed };
};
const proofOf = text => [...text].map(char => char.charCodeAt(0).toString(16)).join('').padEnd(64, 'a').slice(0, 64);
const linkOf = (message, name) => new URL(/https?:\/\/\S+/.exec(message.text)[0]).searchParams.get(name);
const window = () => sqlite.prepare("DELETE FROM attempts WHERE key LIKE 'recupero%'").run();

// ---------- 1. what switches the service on ----------
assert.equal((await api('/api/account/status', { environment: base })).body.email, false, 'Senza gateway né segreto il servizio dice che le email non partono.');
assert.equal((await api('/api/account/status', { environment: { ...base, EMAIL_GATEWAY_URL: GATEWAY } })).body.email, false, 'Con il solo indirizzo del gateway (senza segreto) non è attivo.');
assert.equal((await api('/api/account/status', { environment: { ...base, EMAIL_GATEWAY_SECRET: SECRET } })).body.email, false, 'Con il solo segreto (senza indirizzo) non è attivo.');
assert.equal((await api('/api/account/status', { environment: { ...base, EMAIL_GATEWAY_URL: 'https://example.org/exec', EMAIL_GATEWAY_SECRET: SECRET } })).body.email, false, 'Un indirizzo che non è un web app di Apps Script non è accettato.');
assert.equal((await api('/api/account/status', { environment: { ...base, EMAIL_GATEWAY_URL: 'http://script.google.com/macros/s/abc/exec', EMAIL_GATEWAY_SECRET: SECRET } })).body.email, false, 'Solo https.');
const status = await api('/api/account/status');
assert.ok(status.body.email === true && status.body.features.includes('email-recovery'), 'Con indirizzo e segreto il servizio è attivo.');
assert.equal(calls.length, 0, 'Chiedere lo stato non chiama il gateway.');

// ---------- 2. an account, an address, and nothing sent while the gateway is off ----------
let result = await api('/api/account/register', { method: 'POST', body: { username: 'giocatore.mail', proof: proofOf('segreto-1') } });
assert.equal(result.status, 201); const token = result.body.token;
result = await api('/api/account/email', { method: 'POST', token, body: { email: 'giocatore.mail@example.org', proof: proofOf('segreto-1') }, environment: base });
assert.ok(result.status === 200 && result.body.sent === false, 'Senza gateway non finge di aver spedito.');
assert.equal(calls.length, 0, 'Nessuna chiamata di rete senza configurazione.');

// ---------- 3. the request, exactly ----------
result = await api('/api/account/email', { method: 'POST', token, body: { email: 'giocatore.mail@example.org', proof: proofOf('segreto-1') } });
assert.ok(result.status === 200 && result.body.sent === true && calls.length === 1, 'Il messaggio di verifica passa dal gateway e il gateway lo conferma.');
{
  const call = calls[0];
  assert.equal(call.init.method, 'POST', 'POST.');
  assert.equal(call.init.redirect, 'follow', 'Il redirect di Google è seguito.');
  assert.match(call.init.headers['content-type'], /^application\/json/);
  assert.deepEqual(Object.keys(call.body).sort(), ['action', 'secret', 'subject', 'text', 'to'], 'Il corpo ha esattamente i campi che il gateway si aspetta.');
  assert.equal(call.body.action, 'sendMail'); assert.equal(call.body.secret, SECRET); assert.equal(call.body.to, 'giocatore.mail@example.org');
  assert.equal(call.body.subject, MAIL_SUBJECTS.verify, 'L’oggetto è quello ammesso.');
  assert.ok(!JSON.stringify(call.init.headers).includes(SECRET) && !call.url.includes(SECRET), 'Il segreto viaggia solo nel corpo, mai in intestazioni o indirizzo.');
  assert.ok(call.init.signal, 'La chiamata ha un tempo massimo.');
}
assert.deepEqual(Object.values(MAIL_SUBJECTS).sort(), ['POLITICANDO 2026 — conferma il tuo indirizzo email', 'POLITICANDO 2026 — nuova password', 'POLITICANDO 2026: il tuo account sarà eliminato per inattività'].sort(), 'Gli oggetti sono i tre ammessi dal gateway.');
const verifyToken = linkOf(calls[0].body, 'verifica-email');
assert.match(verifyToken, /^[\da-f]{64}$/);
assert.equal((await api('/api/account/email/verify', { method: 'POST', body: { token: verifyToken } })).status, 200, 'Il collegamento del messaggio verifica l’indirizzo.');
assert.equal((await api('/api/account/email/verify', { method: 'POST', body: { token: verifyToken } })).status, 400, 'Si usa una volta sola.');

// ---------- 4. recovery through the gateway: neutral answers, one message, one use ----------
window();
const known = await api('/api/account/recover', { method: 'POST', body: { email: 'GIOCATORE.MAIL@example.org' }, ip: '198.51.100.42' });
const unknown = await api('/api/account/recover', { method: 'POST', body: { email: 'nessuno@example.org' }, ip: '198.51.100.42' });
assert.deepEqual([known.status, known.body], [unknown.status, unknown.body], 'La risposta è la stessa per un indirizzo noto e uno sconosciuto.');
assert.equal(calls.length, 2, 'Un solo messaggio di recupero, per l’indirizzo verificato.');
assert.equal(calls[1].body.subject, MAIL_SUBJECTS.reset);
const resetToken = linkOf(calls[1].body, 'reimposta-password');
assert.equal((await api('/api/account/reset', { method: 'POST', body: { token: resetToken, proof: proofOf('nuova-password') } })).status, 200, 'La nuova password si imposta dal collegamento.');
assert.equal((await api('/api/account/reset', { method: 'POST', body: { token: resetToken, proof: proofOf('altra') } })).status, 400, 'Il collegamento non si riusa.');
const relogin = await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.mail', proof: proofOf('nuova-password') } });
assert.equal(relogin.status, 200, 'Con la nuova password si accede.');
const token2 = relogin.body.token;
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.mail', proof: proofOf('segreto-1') } })).status, 401, 'La vecchia non vale più.');
// the rate limit still holds (per mailbox: three requests in a window)
window(); const before = calls.length;
for (let i = 0; i < 6; i++) await api('/api/account/recover', { method: 'POST', body: { email: 'giocatore.mail@example.org' }, ip: '198.51.100.43' });
assert.ok(calls.length - before <= 3, `Il limite per casella regge (${calls.length - before} messaggi su 6 richieste).`);

// ---------- 5. every failure: never "sent" without the gateway's confirmation ----------
const failures = {
  'errore HTTP 500': () => new Response('errore', { status: 500 }),
  'errore HTTP 302 non seguito': () => new Response(null, { status: 302, headers: { location: 'https://script.googleusercontent.com/x' } }),
  'pagina HTML invece di JSON': () => new Response('<!doctype html><title>Errore</title>', { status: 200, headers: { 'content-type': 'text/html' } }),
  'JSON non valido': () => new Response('{non json', { status: 200 }),
  'risposta vuota': () => new Response('', { status: 200 }),
  'ok: false': () => new Response(JSON.stringify({ ok: false, error: 'oggetto non ammesso' }), { status: 200 }),
  'ok mancante': () => new Response(JSON.stringify({ sent: true }), { status: 200 }),
  'ok come testo': () => new Response(JSON.stringify({ ok: 'true' }), { status: 200 }),
  'JSON non oggetto': () => new Response('null', { status: 200 }),
  'rete': () => { throw new TypeError('fetch failed'); },
  'tempo scaduto': init => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
};
const slow = { ...configured, EMAIL_GATEWAY_TIMEOUT_MS: '30' };
for (const [name, make] of Object.entries(failures)) {
  behaviour = make;
  window(); sqlite.prepare("DELETE FROM attempts").run();
  const added = await api('/api/account/email', { method: 'POST', token: token2, body: { email: 'giocatore.mail@example.org', proof: proofOf('nuova-password') }, environment: slow, ip: '203.0.113.9' });
  // (the address is already verified: change it so a new message is needed)
  sqlite.prepare('UPDATE user_emails SET verified_at = NULL').run();
  const resend = await api('/api/account/email/resend', { method: 'POST', token: token2, body: { proof: proofOf('nuova-password') }, environment: slow, ip: '203.0.113.9' });
  assert.equal(resend.status, 502, `${name}: la verifica non risulta inviata (${resend.status}).`);
  assert.ok(resend.body.error && !resend.body.sent, `${name}: errore chiaro, nessun «inviato».`);
  void added;
  // recovery: the neutral answer is unchanged, nothing says it failed
  sqlite.prepare('UPDATE user_emails SET verified_at = ?').run(new Date().toISOString());
  window();
  const neutral = await api('/api/account/recover', { method: 'POST', body: { email: 'giocatore.mail@example.org' }, environment: slow, ip: '203.0.113.10' });
  assert.deepEqual([neutral.status, neutral.body], [known.status, known.body], `${name}: il recupero risponde come sempre (risposta neutra).`);
}
behaviour = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

// ---------- 6. the secret is nowhere it should not be ----------
assert.ok(seen.every(text => !text.includes(SECRET)), 'Nessuna risposta del Worker contiene il segreto.');
assert.ok(logs.every(line => !line.includes(SECRET)), 'Nessun log contiene il segreto.');
const code = await (await import('node:fs/promises')).readFile(new URL('../worker.js', import.meta.url), 'utf8');
const wrangler = await (await import('node:fs/promises')).readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
assert.ok(!/EMAIL_GATEWAY_SECRET['"]?\s*[:=]\s*['"][^'"]{4,}/.test(code + wrangler), 'Il segreto non è scritto nel progetto: è un secret del Worker.');
assert.ok(wrangler.includes(GATEWAY) && !/api\.resend\.com|RESEND_API_KEY/.test(code), 'Il gateway è configurato e Resend non è più nel percorso di invio.');
assert.ok(!/console\.(log|warn|error|info)/.test(code.slice(code.indexOf('async function sendMail'), code.indexOf('// Everything of one account'))), 'L’invio non scrive nulla nei log.');
globalThis.fetch = realFetch;
console.log('E-mail dagli account tramite il gateway Google Apps Script verificata con un gateway simulato: attivazione solo con indirizzo e segreto, richiesta esatta (POST JSON, campi e oggetti ammessi, segreto solo nel corpo, tempo massimo), invio dichiarato solo se il gateway conferma, undici tipi di errore gestiti, verifica, recupero e reimpostazione con collegamenti monouso, risposte neutre, limite per casella, nessun segreto in risposte, log o progetto. Nessuna e-mail reale inviata.');
