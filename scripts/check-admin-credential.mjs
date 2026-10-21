// Rotation of the owner's credential, on the Worker with in-process stand-ins (nothing reaches production; the real credential is never used here): the credential used below is
// generated at random for each run. Covers: first activation, login, replacement from an open session, wrong current credential, expired session, invalidation of every older session,
// the old credential no longer working, the setup-code recovery path, the attempt limit, the length limits, and the absence of the credential in clear in the KV, the responses and the code.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const kvData = new Map();
const kv = {
  async get(key, type) { const entry = kvData.get(key); if (!entry || (entry.expires && entry.expires < Date.now())) return null; return type === 'json' ? JSON.parse(entry.value) : entry.value; },
  async put(key, value, options = {}) { kvData.set(key, { value: String(value), expires: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null }); },
  async delete(key) { kvData.delete(key); },
  async list({ prefix = '' } = {}) { return { keys: [...kvData.keys()].filter(name => name.startsWith(prefix)).map(name => ({ name })) }; }
};
const SETUP = `setup-${randomBytes(6).toString('hex')}`;
const env = { ADMIN_ARCHIVE: kv, ADMIN_SETUP_CODE: SETUP, ASSETS: { fetch: async () => new Response('{}') } };
const worker = (await import('../worker.js?credential=1')).default;
let ip = 1;
const call = async (path, init = {}, headers = {}, fixedIp = null) => {
  const response = await worker.fetch(new Request(ORIGIN + path, { ...init, headers: { 'content-type': 'application/json', 'cf-connecting-ip': fixedIp ?? `203.0.113.${(ip++ % 250) + 1}`, ...headers } }), env);
  const text = await response.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, body, text };
};
const post = (path, data, headers = {}, fixedIp = null) => call(path, { method: 'POST', body: JSON.stringify(data) }, headers, fixedIp);
const bearer = token => ({ authorization: `Bearer ${token}` });
const session = async token => (await call('/api/admin/session', {}, bearer(token))).status;
const secret = () => `Cr-${randomBytes(9).toString('hex')}`;
const everything = () => [...kvData.entries()].map(([key, entry]) => `${key}=${entry.value}`).join('\n');
const spent = [];

// 1. first activation needs the setup code; then a normal login
const first = secret(); spent.push(first);
assert.equal((await post('/api/admin/session', { pin: first })).status, 401, 'Senza codice di attivazione la prima credenziale non si crea.');
const activated = await post('/api/admin/session', { pin: first, setupCode: SETUP });
assert.equal(activated.status, 200, 'Attivazione con il codice del Worker.');
const tokenA = activated.body.token;
assert.equal(await session(tokenA), 200, 'La sessione è valida.');
const loginB = await post('/api/admin/session', { pin: first });
assert.equal(loginB.status, 200); const tokenB = loginB.body.token;
assert.equal(await session(tokenB), 200, 'Una seconda sessione (altro dispositivo) è valida.');

// 2. rotation needs a valid session AND the current credential
const next = secret(); spent.push(next);
assert.equal((await post('/api/admin/credential', { currentPin: first, newPin: next })).status, 401, 'Senza sessione la sostituzione è rifiutata.');
assert.equal((await post('/api/admin/credential', { currentPin: first, newPin: next }, bearer('0'.repeat(48)))).status, 401, 'Con una sessione inventata è rifiutata.');
assert.equal((await post('/api/admin/credential', { currentPin: 'sbagliata-1234', newPin: next }, bearer(tokenA))).status, 401, 'Con la credenziale attuale sbagliata è rifiutata.');
assert.equal((await post('/api/admin/credential', { currentPin: first, newPin: 'corta' }, bearer(tokenA))).status, 400, 'Meno di 6 caratteri: rifiutata.');
assert.equal((await post('/api/admin/credential', { currentPin: first, newPin: 'x'.repeat(65) }, bearer(tokenA))).status, 400, 'Più di 64 caratteri: rifiutata.');
assert.equal((await post('/api/admin/credential', { currentPin: first, newPin: first }, bearer(tokenA))).status, 400, 'Una credenziale uguale alla precedente è rifiutata.');
assert.equal(await session(tokenA), 200, 'I tentativi falliti non toccano le sessioni.');
const before = JSON.parse(kvData.get('pin-amministratore').value);
const rotated = await post('/api/admin/credential', { currentPin: first, newPin: next }, bearer(tokenA));
assert.equal(rotated.status, 200, 'Sostituzione riuscita.');
const after = JSON.parse(kvData.get('pin-amministratore').value);
assert.notEqual(after.salt, before.salt, 'Nuovo sale.'); assert.notEqual(after.hash, before.hash, 'Nuova impronta.'); assert.notEqual(after.epoch, before.epoch, 'Nuovo epoch.');
assert.match(after.hash, /^[0-9a-f]{64}$/);

// 3. every older session is invalid, the new one works, the old credential no longer logs in
assert.equal(await session(tokenA), 401, 'La sessione che ha chiesto la sostituzione, quella vecchia, non vale più.');
assert.equal(await session(tokenB), 401, 'L’altra sessione è invalidata.');
assert.equal(await session(rotated.body.token), 200, 'Il token restituito vale.');
assert.equal((await post('/api/admin/session', { pin: first })).status, 401, 'La vecchia credenziale non entra più.');
assert.equal((await post('/api/admin/session', { pin: next })).status, 200, 'La nuova entra.');
assert.equal((await call('/api/admin', { method: 'PUT', body: '{}' }, bearer(tokenA))).status, 401, 'Una sessione vecchia non scrive l’archivio.');

// 4. expired session
for (const key of [...kvData.keys()]) if (key.startsWith('sessione:')) kvData.get(key).expires = Date.now() - 1;
assert.equal(await session(rotated.body.token), 401, 'Una sessione scaduta non vale.');
const expiredTry = secret();
assert.equal((await post('/api/admin/credential', { currentPin: next, newPin: expiredTry }, bearer(rotated.body.token))).status, 401, 'Con la sessione scaduta la sostituzione è rifiutata.');
assert.equal((await post('/api/admin/session', { pin: next })).status, 200, 'La credenziale resta quella di prima.');

// 5. sessions with no listing are invalidated by the epoch alone
{
  const login = await post('/api/admin/session', { pin: next }); const token = login.body.token;
  const third = secret(); spent.push(third);
  const list = kv.list; kv.list = undefined;
  const done = await post('/api/admin/credential', { currentPin: next, newPin: third }, bearer(token));
  kv.list = list;
  assert.equal(done.status, 200); assert.equal(await session(token), 401, 'Anche senza poter elencare le sessioni, la vecchia non vale.');
  assert.equal(await session(done.body.token), 200);
}

// 6. recovery with the setup code (credential lost), no session needed; a wrong setup code is refused
{
  const recovered = secret(); spent.push(recovered);
  assert.equal((await post('/api/admin/credential', { newPin: recovered, setupCode: 'codice-sbagliato' })).status, 401, 'Codice di attivazione errato: rifiutata.');
  const oldToken = (await post('/api/admin/session', { pin: spent[2] })).body.token;
  const done = await post('/api/admin/credential', { newPin: recovered, setupCode: SETUP });
  assert.equal(done.status, 200, 'Con il codice del Worker la credenziale si ripristina.');
  assert.equal(await session(oldToken), 401, 'Le sessioni precedenti sono chiuse anche in questo percorso.');
  assert.equal((await post('/api/admin/session', { pin: recovered })).status, 200);
  assert.equal((await post('/api/admin/session', { pin: spent[2] })).status, 401);
}

// 7. attempt limit: eight failures from one address block the ninth, on the login and on the rotation alike
{
  const address = '198.51.100.99';
  for (let i = 0; i < 8; i++) assert.equal((await post('/api/admin/session', { pin: 'tentativo-errato' }, {}, address)).status, 401);
  assert.equal((await post('/api/admin/session', { pin: spent.at(-1) }, {}, address)).status, 429, 'Dopo otto errori anche la credenziale giusta è bloccata.');
  assert.equal((await post('/api/admin/credential', { currentPin: 'x', newPin: secret() }, {}, address)).status, 429, 'Il limite vale anche per la sostituzione.');
}

// 8. nothing in clear: not in the KV, not in any response
const dump = everything();
for (const value of spent) assert.ok(!dump.includes(value), 'Nel KV non c’è nessuna credenziale in chiaro.');
for (const value of [...spent, SETUP]) assert.ok(!rotated.text.includes(value) && !activated.text.includes(value), 'Le risposte non riportano la credenziale.');
// (the real credential is deliberately not named in this file: the repository was searched for it by hand when the procedure was prepared, and the search found nothing)

// 9. the offline tool prints only the record, and the record is accepted by the Worker
{
  const chosen = secret();
  const out = execFileSync('node', ['scripts/admin-credential-record.mjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)), input: chosen, encoding: 'utf8' });
  assert.ok(!out.includes(chosen), 'Lo strumento non stampa la credenziale.');
  const record = JSON.parse(out); assert.deepEqual(Object.keys(record).sort(), ['epoch', 'hash', 'salt', 'since']);
  kvData.set('pin-amministratore', { value: JSON.stringify(record), expires: null });
  assert.equal((await post('/api/admin/session', { pin: chosen })).status, 200, 'Un record preparato offline è accettato dal Worker.');
  assert.equal((await post('/api/admin/session', { pin: first })).status, 401);
}
console.log('Sostituzione della credenziale amministrativa verificata in locale: attivazione, sostituzione da sessione con credenziale attuale, credenziale sbagliata e sessione scaduta rifiutate, tutte le sessioni precedenti invalidate (anche senza elenco del KV), vecchia credenziale respinta, ripristino con il codice del Worker, limite di tentativi, nessuna credenziale in chiaro (KV, risposte), record preparabile offline. Nessuna credenziale online modificata.');
