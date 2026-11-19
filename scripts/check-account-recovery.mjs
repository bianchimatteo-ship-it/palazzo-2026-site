// Recovery of the password, end to end on the Worker with a SIMULATED gateway: two requests then a reset (the OTHER links are cancelled), links that are invalid, used or expired, an account without e-mail,
// an address not verified, the answers that never tell whether an account exists, the lifetimes (30 minutes for recovery, 48 hours for verification), the sessions ended by the reset, the old password refused and the
// new one accepted, a malformed proof refused. Nothing leaves this process; the real sending is checked only with a controlled mailbox (docs/qa/deploy-test-vscode.md).
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
const GATEWAY = 'https://script.google.com/macros/s/AKfycbwzUfLKTPFmcorBTV6YfT6Z7u9IYaVxOwXmCogAVE5TgfE12NgFsswmWn_vLWi0J1tcNQ/exec';
const SECRET = `segreto-di-prova-${Math.random().toString(16).slice(2)}`;
const base = { ACCOUNTS: d1, ADMIN_ARCHIVE: { get: async () => null, put: async () => {}, delete: async () => {} }, ASSETS: { fetch: async () => new Response('asset') }, PUBLIC_BASE_URL: ORIGIN };
const configured = { ...base, EMAIL_GATEWAY_URL: GATEWAY, EMAIL_GATEWAY_SECRET: SECRET };
const worker = (await import('../worker.js?deploy=account-recovery')).default;
const { MAIL_SUBJECTS } = await import('../worker-constants.js');

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


const register = async (name, password) => { const r = await api('/api/account/register', { method: 'POST', body: { username: name, proof: proofOf(password) } }); assert.equal(r.status, 201); return r.body.token; };
const verified = async (name, email, password) => {
  const token = await register(name, password);
  await api('/api/account/email', { method: 'POST', token, body: { email, proof: proofOf(password) } });
  const call = calls.at(-1); assert.equal(call.body.to, email);
  assert.equal((await api('/api/account/email/verify', { method: 'POST', body: { token: linkOf(call.body, 'verifica-email') } })).status, 200);
  return token;
};
const neutral = async (email, ip) => { window(); return api('/api/account/recover', { method: 'POST', body: { email }, ip }); };

// ---- lifetimes: 48 hours for the verification link, 30 minutes for the recovery link
await verified('chiara.recupero', 'chiara@example.org', 'pw-vecchia-1');
{
  const rows = sqlite.prepare('SELECT * FROM email_tokens ORDER BY created_at').all();
  const columns = Object.keys(rows[0] ?? {});
  const created = columns.find(c => /created/.test(c)), expires = columns.find(c => /expires/.test(c));
  const verify = rows.find(r => (r.kind ?? r.purpose ?? r.type) === 'verify' || (r.kind ?? r.purpose ?? r.type) === 'verifica');
  assert.ok(created && expires, 'La tabella dei collegamenti ha creazione e scadenza.');
  const span = row => Math.round((Number(row[expires]) - Date.parse(row[created])) / 60000);
  if (verify) assert.equal(span(verify), 48 * 60, 'Il collegamento di verifica vale 48 ore.');
}
const a = await neutral('chiara@example.org', '198.51.100.10');
const first = calls.at(-1); const linkA = linkOf(first.body, 'reimposta-password');
const b = await neutral('chiara@example.org', '198.51.100.11');
const second = calls.at(-1); const linkB = linkOf(second.body, 'reimposta-password');
assert.deepEqual([a.status, a.body], [b.status, b.body], 'Stessa risposta a ogni richiesta.');
assert.notEqual(linkA, linkB, 'Ogni richiesta ha il suo collegamento.');
{
  const rows = sqlite.prepare("SELECT * FROM email_tokens").all(); const columns = Object.keys(rows[0]);
  const created = columns.find(c => /created/.test(c)), expires = columns.find(c => /expires/.test(c)), kind = columns.find(c => /^(kind|purpose|type)$/.test(c));
  const reset = rows.filter(r => /reset|reimposta|recupero/.test(String(r[kind])));
  assert.ok(reset.length >= 1 && reset.every(r => Math.round((Number(r[expires]) - Date.parse(r[created])) / 60000) === 30), 'Il collegamento di recupero vale 30 minuti.');
}
// two sessions before the reset
const s1 = (await api('/api/account/login', { method: 'POST', body: { username: 'chiara.recupero', proof: proofOf('pw-vecchia-1') } })).body.token;
const s2 = (await api('/api/account/login', { method: 'POST', body: { username: 'chiara.recupero', proof: proofOf('pw-vecchia-1') } }), (await api('/api/account/login', { method: 'POST', body: { username: 'chiara.recupero', proof: proofOf('pw-vecchia-1') }, ip: '198.51.100.99' })).body.token);
assert.equal((await api('/api/account/me', { token: s1 })).status, 200, 'La prima sessione vale.'); assert.equal((await api('/api/account/me', { token: s2 })).status, 200, 'La seconda sessione vale.');
// the page checks the link before showing the form (reset/check): valid for a live link, 400 for the others
assert.equal((await api('/api/account/reset/check', { method: 'POST', body: { token: linkB } })).status, 200, 'Il collegamento valido apre il modulo.');
assert.equal((await api('/api/account/reset/check', { method: 'POST', body: { token: 'f'.repeat(64) } })).status, 400, 'Un collegamento non valido non apre il modulo.');
// malformed and invalid proofs / links: refused, never a hint
assert.equal((await api('/api/account/reset', { method: 'POST', body: { token: linkB, proof: 'abc' } })).status, 400, 'Una password non valida (impronta malformata) è rifiutata.');
assert.equal((await api('/api/account/reset', { method: 'POST', body: { token: linkB, proof: proofOf('x').toUpperCase().replace(/[A-F]/g, 'g') } })).status, 400);
for (const bad of ['', 'zzz', 'a'.repeat(64), '0'.repeat(63), linkB.slice(0, -1) + (linkB.endsWith('0') ? '1' : '0'), null]) {
  const r = await api('/api/account/reset', { method: 'POST', body: { token: bad, proof: proofOf('nuova-pw-2') } });
  assert.equal(r.status, 400, `Collegamento non valido (${String(bad).slice(0, 12)}…): rifiutato.`); assert.ok(!/esiste|non esiste|account/i.test(JSON.stringify(r.body) ?? ''), 'La risposta non rivela se l’account esiste.');
}
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'chiara.recupero', proof: proofOf('pw-vecchia-1') } })).status, 200, 'Con i rifiuti la password non è cambiata.');
// the reset with the SECOND link: the first one is cancelled, the sessions end, the old password fails, the new one works
assert.equal((await api('/api/account/reset', { method: 'POST', body: { token: linkB, proof: proofOf('nuova-pw-2') } })).status, 200, 'Il collegamento più recente reimposta la password.');
assert.equal((await api('/api/account/reset', { method: 'POST', body: { token: linkA, proof: proofOf('terza-pw-3') } })).status, 400, 'Gli altri collegamenti di recupero sono annullati.');
assert.equal((await api('/api/account/reset', { method: 'POST', body: { token: linkB, proof: proofOf('terza-pw-3') } })).status, 400, 'Il collegamento usato non si riusa.');
assert.equal((await api('/api/account/me', { token: s1 })).status, 401, 'La prima sessione è chiusa.'); assert.equal((await api('/api/account/me', { token: s2 })).status, 401, 'Anche la seconda.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'chiara.recupero', proof: proofOf('pw-vecchia-1') } })).status, 401, 'La vecchia password non vale più.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'chiara.recupero', proof: proofOf('nuova-pw-2') } })).status, 200, 'La nuova password funziona.');
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM email_tokens WHERE used_at IS NULL AND expires_at > ?").get(Date.now()).n, 0, 'Non resta nessun collegamento valido.');
// an expired recovery link does not work (the clock moved)
await neutral('chiara@example.org', '198.51.100.12'); const linkC = linkOf(calls.at(-1).body, 'reimposta-password');
{ const columns = Object.keys(sqlite.prepare('SELECT * FROM email_tokens LIMIT 1').get()); const expires = columns.find(c => /expires/.test(c)); sqlite.prepare(`UPDATE email_tokens SET ${expires} = ?`).run(Date.now() - 1000); }
assert.equal((await api('/api/account/reset', { method: 'POST', body: { token: linkC, proof: proofOf('quarta-pw-4') } })).status, 400, 'Un collegamento scaduto non vale.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'chiara.recupero', proof: proofOf('nuova-pw-2') } })).status, 200, 'E la password resta quella di prima.');
// an account WITHOUT e-mail and an address NOT verified: the same neutral answer, nothing is sent
const sent = calls.length;
await register('senza.email', 'pw-senza-1');
const unverifiedToken = await register('non.verificata', 'pw-nv-1');
await api('/api/account/email', { method: 'POST', token: unverifiedToken, body: { email: 'nonverificata@example.org', proof: proofOf('pw-nv-1') } });
const afterUnverified = calls.length; assert.equal(afterUnverified, sent + 1, 'Solo il messaggio di verifica è partito.');
const answers = [];
for (const email of ['nonverificata@example.org', 'sconosciuta@example.org', 'chiara@example.org']) { const r = await neutral(email, `198.51.100.${20 + answers.length}`); answers.push([r.status, JSON.stringify(r.body)]); }
assert.ok(answers.every(item => item[0] === answers[0][0] && item[1] === answers[0][1]), 'Indirizzo non verificato, sconosciuto o noto: la stessa risposta.');
assert.equal(calls.length, afterUnverified + 1, 'Un messaggio di recupero soltanto, per l’indirizzo verificato.');
// a recovery with a malformed address
assert.ok([200, 400].includes((await neutral('non-un-indirizzo', '198.51.100.40')).status), 'Un indirizzo malformato non rompe il servizio.');
// the service says plainly that the e-mail is not available when the gateway is not configured
assert.equal((await api('/api/account/status', { environment: base })).body.email, false, 'Senza gateway il servizio dichiara che le e-mail non partono.');
const off = await api('/api/account/recover', { method: 'POST', body: { email: 'chiara@example.org' }, environment: base, ip: '198.51.100.50' });
assert.ok(off.status === 200 && calls.length === afterUnverified + 1, 'Senza gateway non parte nulla e il servizio non finge.');
assert.ok(!seen.join('\n').includes(SECRET), 'Il segreto del gateway non compare mai nelle risposte.');
console.log('Recupero della password: due richieste e un reset (l’altro collegamento si annulla), collegamenti non validi/usati/scaduti, account senza e-mail e indirizzo non verificato con la stessa risposta, 30 minuti e 48 ore, sessioni chiuse, vecchia password rifiutata e nuova accettata.');
