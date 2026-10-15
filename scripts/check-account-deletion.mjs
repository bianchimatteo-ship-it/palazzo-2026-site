// Deletion of the account. The Worker (in process, on a SQLite stand-in of D1: nothing here reaches the network, the real database or a real account):
//   - DELETE /api/account needs a valid session, the password proof of THAT account and the word ELIMINA; nobody can delete another account (the account is found through the
//     session alone, and another account's password does not open it);
//   - account, saves and sessions go together, nothing of the player stays in the tables (no orphan rows), the other accounts are untouched;
//   - afterwards the old session and the password stop working; a wrong password or a missing confirmation delete nothing; repeated wrong attempts are rate limited;
//   - a failing database answers with an error and the data stays; the attempts table (it holds the connecting address) drops what is older than a day; a registration that works is booked as a new account (its own limit),
//     never as a failed attempt; sessions that have expired are removed for everybody on the next login/registration/deletion and by the daily schedule; every API answer carries the security headers;
//   - the browser client (deleteAccount) clears the local session only after the server confirmed;
//   - the in-game account panel and the public pages (privacy, terms, deletion) exist, are static, call no external host, and the open points for the controller are listed.
// `node scripts/check-account-deletion.mjs --release` also fails while the pages still carry the controller's open points (the gate before a store release).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const nativeFetch = globalThis.fetch;

const sqlite = new DatabaseSync(':memory:');
const statement = (sql, params = []) => ({
  bind: (...values) => statement(sql, values),
  first: async () => sqlite.prepare(sql).get(...params) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
  run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...params) })
});
const d1 = { prepare: sql => statement(sql), batch: async list => Promise.all(list.map(item => item.run())), exec: async sql => sqlite.exec(sql) };
const env = { ACCOUNTS: d1, ADMIN_ARCHIVE: { get: async () => null, put: async () => {}, delete: async () => {} }, ASSETS: { fetch: async () => new Response('asset') } };
const ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const worker = (await import('../worker.js?deletion=1')).default;
const api = async (path, { method = 'GET', body, token, ip = '198.51.100.7', useEnv = env, headers = {} } = {}) => {
  const response = await worker.fetch(new Request(ORIGIN + path, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), useEnv);
  return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
};
const proofOf = text => [...text].map(char => char.charCodeAt(0).toString(16)).join('').padEnd(64, 'a').slice(0, 64);
const count = (sql, ...params) => sqlite.prepare(sql).get(...params).n;
const rows = username => ({
  user: count('SELECT COUNT(*) AS n FROM users WHERE username = ?', username),
  saves: count('SELECT COUNT(*) AS n FROM saves WHERE user_id = (SELECT id FROM users WHERE username = ?)', username),
  sessions: count('SELECT COUNT(*) AS n FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ?)', username)
});
const save = (token, slot, data = '{"x":1}') => api(`/api/saves/${slot}`, { method: 'PUT', token, body: { data, encoding: 'json', name: `Carriera ${slot}`, meta: { player: 'Prova', role: 'Deputato' }, baseRevision: 0 } });

// ---------- 1. two players with saves ----------
const A = { name: 'giocatore.a', proof: proofOf('segreto-a') }, B = { name: 'giocatore.b', proof: proofOf('segreto-b') };
const sign = async player => { const result = await api('/api/account/register', { method: 'POST', body: { username: player.name, proof: player.proof }, ip: `203.0.113.${player.name.length}` }); assert.equal(result.status, 201, `${player.name}: registrato.`); return result.body.token; };
let tokenA = await sign(A), tokenB = await sign(B);
const secondA = (await api('/api/account/login', { method: 'POST', body: { username: A.name, proof: A.proof }, ip: '203.0.113.50' })).body.token;
for (const slot of ['c-uno', 'c-due']) assert.equal((await save(tokenA, slot)).status, 200, 'Salvataggio di A online.');
assert.equal((await save(tokenB, 'c-uno')).status, 200, 'Salvataggio di B online.');
assert.deepEqual(rows(A.name), { user: 1, saves: 2, sessions: 2 });
assert.deepEqual(rows(B.name), { user: 1, saves: 1, sessions: 1 });

// ---------- 2. nothing is deleted without session, confirmation and password ----------
let result = await api('/api/account', { method: 'DELETE', body: { proof: A.proof, confirm: 'ELIMINA' } });
assert.equal(result.status, 401, 'Senza sessione: rifiutato.');
result = await api('/api/account', { method: 'DELETE', token: 'a'.repeat(64), body: { proof: A.proof, confirm: 'ELIMINA' } });
assert.equal(result.status, 401, 'Con una sessione inventata: rifiutato.');
result = await api('/api/account', { method: 'DELETE', token: tokenA, body: { proof: A.proof, confirm: 'elimina' } });
assert.equal(result.status, 400, 'Senza la parola di conferma: rifiutato.');
assert.match(result.body.error, /ELIMINA/);
result = await api('/api/account', { method: 'DELETE', token: tokenA, body: { confirm: 'ELIMINA' } });
assert.equal(result.status, 400, 'Senza password: rifiutato.');
result = await api('/api/account', { method: 'DELETE', token: tokenA, body: { proof: 'password-in-chiaro', confirm: 'ELIMINA' } });
assert.equal(result.status, 400, 'Solo la prova derivata nel browser, mai la password in chiaro.');
result = await api('/api/account', { method: 'DELETE', token: tokenA, body: { proof: proofOf('sbagliata'), confirm: 'ELIMINA' } });
assert.equal(result.status, 403, 'Password sbagliata: rifiutato.');
// the session of A with the password of B: another account's password does not open it, and B is not touched
result = await api('/api/account', { method: 'DELETE', token: tokenA, body: { proof: B.proof, confirm: 'ELIMINA' } });
assert.equal(result.status, 403, 'La password di un altro account non basta.');
// the session of B cannot name A: there is nothing to name, the account is the one of the session
result = await api('/api/account', { method: 'DELETE', token: tokenB, body: { username: A.name, proof: A.proof, confirm: 'ELIMINA' } });
assert.equal(result.status, 403, 'La sessione di B non cancella A, nemmeno con la password di A.');
assert.deepEqual(rows(A.name), { user: 1, saves: 2, sessions: 2 }, 'A è intatto.');
assert.deepEqual(rows(B.name), { user: 1, saves: 1, sessions: 1 }, 'B è intatto.');
// other methods and paths do not delete either
for (const [method, path] of [['GET', '/api/account'], ['POST', '/api/account'], ['PUT', '/api/account']]) {
  const other = await api(path, { method, token: tokenA, body: method === 'GET' ? undefined : { proof: A.proof, confirm: 'ELIMINA' } });
  assert.ok([404, 405].includes(other.status) || other.body?.error, `${method} ${path}: non cancella.`);
}
assert.deepEqual(rows(A.name), { user: 1, saves: 2, sessions: 2 }, 'A è ancora intatto.');

// ---------- 3. the deletion ----------
result = await api('/api/account', { method: 'OPTIONS' });
assert.ok(/DELETE/.test(result.headers.get('access-control-allow-methods') ?? ''), 'Il Worker ammette DELETE (richiesta preliminare).');
result = await api('/api/account', { method: 'DELETE', token: tokenA, body: { proof: A.proof, confirm: 'ELIMINA' } });
assert.equal(result.status, 200, 'A elimina il proprio account.');
assert.deepEqual(result.body, { ok: true, deleted: { account: 1, saves: 2, sessions: 2 } }, 'Il conto di ciò che è stato rimosso.');
assert.deepEqual(rows(A.name), { user: 0, saves: 0, sessions: 0 }, 'Di A non resta nulla.');
assert.deepEqual(rows(B.name), { user: 1, saves: 1, sessions: 1 }, 'B è intatto.');
assert.equal(count('SELECT COUNT(*) AS n FROM saves WHERE user_id NOT IN (SELECT id FROM users)'), 0, 'Nessun salvataggio orfano.');
assert.equal(count('SELECT COUNT(*) AS n FROM sessions WHERE user_id NOT IN (SELECT id FROM users)'), 0, 'Nessuna sessione orfana.');
for (const token of [tokenA, secondA]) assert.equal((await api('/api/account/me', { token })).status, 401, 'Le sessioni di A non valgono più.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: A.name, proof: A.proof }, ip: '203.0.113.60' })).status, 401, 'A non può più accedere.');
assert.equal((await api('/api/saves/c-uno', { token: tokenA })).status, 401, 'I salvataggi di A non sono più leggibili.');
assert.equal((await api('/api/account/me', { token: tokenB })).body.saves, 1, 'B vede ancora il proprio salvataggio.');
result = await api('/api/account', { method: 'DELETE', token: tokenA, body: { proof: A.proof, confirm: 'ELIMINA' } });
assert.equal(result.status, 401, 'Ripetere la cancellazione con la vecchia sessione: rifiutato, nessun effetto.');

// ---------- 4. rate limit and the attempts table ----------
for (let attempt = 0; attempt < 10; attempt++) assert.equal((await api('/api/account', { method: 'DELETE', token: tokenB, body: { proof: proofOf(`prova${attempt}`), confirm: 'ELIMINA' }, ip: '192.0.2.9' })).status, 403);
result = await api('/api/account', { method: 'DELETE', token: tokenB, body: { proof: B.proof, confirm: 'ELIMINA' }, ip: '192.0.2.9' });
assert.equal(result.status, 429, 'Dopo dieci tentativi sbagliati: bloccato per 15 minuti, anche con la password giusta.');
assert.deepEqual(rows(B.name), { user: 1, saves: 1, sessions: 1 }, 'B è ancora intatto.');
sqlite.prepare('INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?)').run('accesso:vecchio', Date.now() - 2 * 86_400_000);
sqlite.prepare('INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?)').run('accesso:recente', Date.now() - 60_000);
await api('/api/account/login', { method: 'POST', body: { username: B.name, proof: B.proof }, ip: '203.0.113.77' });
assert.equal(count('SELECT COUNT(*) AS n FROM attempts WHERE key = ?', 'accesso:vecchio'), 0, 'I tentativi più vecchi di un giorno vengono eliminati.');
assert.equal(count('SELECT COUNT(*) AS n FROM attempts WHERE key = ?', 'accesso:recente'), 1, 'Quelli recenti restano per il limite.');

// ---------- 4b. registrations are not "failed attempts"; expired sessions go away for everybody, on request and on schedule ----------
{
  const ip = '192.0.2.40';
  const attemptsOf = key => sqlite.prepare('SELECT count FROM attempts WHERE key = ?').get(key)?.count ?? 0;
  // a successful registration books a new account (its own counter), never a wrong attempt
  const made = await api('/api/account/register', { method: 'POST', body: { username: 'nuovo.uno', proof: proofOf('nuovo-uno') }, ip });
  assert.equal(made.status, 201);
  assert.equal(attemptsOf(`registrazione:${ip}`), 0, 'Una registrazione riuscita non conta come tentativo sbagliato.');
  assert.equal(attemptsOf(`creazione:${ip}`), 1, 'Conta come creazione di un account, con il suo contatore.');
  // a name already taken is a failed attempt, and nine of them do not block a registration that works
  for (let i = 0; i < 9; i++) assert.equal((await api('/api/account/register', { method: 'POST', body: { username: 'nuovo.uno', proof: proofOf(`altro${i}`) }, ip })).status, 409);
  assert.equal(attemptsOf(`registrazione:${ip}`), 9);
  assert.equal((await api('/api/account/register', { method: 'POST', body: { username: 'nuovo.due', proof: proofOf('nuovo-due') }, ip })).status, 201, 'Nove nomi già presi non bloccano chi si registra con un nome libero.');
  assert.equal(attemptsOf(`registrazione:${ip}`), 9, 'Né la registrazione riuscita aggiunge un tentativo sbagliato.');
  await api('/api/account/register', { method: 'POST', body: { username: 'nuovo.uno', proof: proofOf('decimo') }, ip });
  assert.equal((await api('/api/account/register', { method: 'POST', body: { username: 'nuovo.tre', proof: proofOf('nuovo-tre') }, ip })).status, 429, 'Dieci tentativi sbagliati di registrazione: sospesa per 15 minuti.');
  // ...and accounts created in bulk from one address are limited by their own counter, not by the failures
  const bulk = '192.0.2.41';
  for (let i = 0; i < 10; i++) assert.equal((await api('/api/account/register', { method: 'POST', body: { username: `massa.${i}`, proof: proofOf(`massa${i}`) }, ip: bulk })).status, 201);
  assert.equal(attemptsOf(`registrazione:${bulk}`), 0);
  assert.equal((await api('/api/account/register', { method: 'POST', body: { username: 'massa.10', proof: proofOf('massa10') }, ip: bulk })).status, 429, 'Dieci account nuovi da uno stesso indirizzo in 15 minuti: l’undicesimo aspetta.');
  assert.equal(count('SELECT COUNT(*) AS n FROM users WHERE username = ?', 'massa.10'), 0, 'E non viene creato.');
  assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'massa.3', proof: proofOf('massa3') }, ip: bulk })).status, 200, 'L’accesso di chi ha già un account non è toccato dal limite delle creazioni.');

  // sessions: the ones expired for an account that never comes back are removed as soon as anybody logs in, registers or deletes; the valid ones stay
  const now = Date.now();
  const idOf = name => sqlite.prepare('SELECT id FROM users WHERE username = ?').get(name).id;
  const insert = (hash, user, expires) => sqlite.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(hash, user, new Date(now - 40 * 86_400_000).toISOString(), expires);
  insert('e'.repeat(64), idOf('massa.1'), now - 86_400_000); insert('d'.repeat(64), idOf('massa.2'), now - 10 * 86_400_000); insert('f'.repeat(64), idOf('massa.2'), now + 20 * 86_400_000);
  const left = hash => count('SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?', hash);
  await api('/api/account/login', { method: 'POST', body: { username: 'nuovo.uno', proof: proofOf('nuovo-uno') }, ip: '203.0.113.90' });
  assert.deepEqual([left('e'.repeat(64)), left('d'.repeat(64)), left('f'.repeat(64))], [0, 0, 1], 'Le sessioni scadute di chiunque sono eliminate alla richiesta di un altro; quella ancora valida resta.');
  assert.equal(count('SELECT COUNT(*) AS n FROM sessions WHERE expires_at < ?', Date.now()), 0, 'Nessuna sessione scaduta resta nella tabella.');
  // the daily schedule does the same with nobody asking, for the sessions and for the old rows of the attempts
  insert('c'.repeat(64), idOf('massa.4'), now - 2 * 86_400_000);
  sqlite.prepare('INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?)').run('accesso:fermo', now - 3 * 86_400_000);
  const waited = [];
  await worker.scheduled({ cron: '37 3 * * *' }, env, { waitUntil: promise => waited.push(promise) });
  await Promise.all(waited);
  assert.equal(left('c'.repeat(64)), 0, 'La pulizia giornaliera elimina le sessioni scadute.');
  assert.equal(count('SELECT COUNT(*) AS n FROM attempts WHERE key = ?', 'accesso:fermo'), 0, 'E gli indirizzi dei tentativi più vecchi di un giorno.');
  assert.equal(left('f'.repeat(64)), 1, 'Mai una sessione valida.');
  await worker.scheduled({}, { ...env, ACCOUNTS: undefined }, { waitUntil: promise => waited.push(promise) });
  const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.ok(/"crons":\s*\[\s*"[^"]+"\s*\]/.test(wrangler), 'La pulizia giornaliera è dichiarata in wrangler.jsonc.');
  const migrations = await readFile(new URL('../migrations/0002_session_expiry.sql', import.meta.url), 'utf8');
  assert.ok(/sessions_expiry ON sessions \(expires_at\)/.test(migrations), 'L’indice sulla scadenza è anche in una migrazione.');
  // every answer of the API, preflight and errors included, says what a browser must not do with it
  for (const response of [await api('/api/account/status'), await api('/api/account/me'), await api('/api/nonesiste'), await api('/api/admin')]) {
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'none'/, 'Una risposta JSON non esegue né incorpora nulla.');
    assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('strict-transport-security') ?? '', /max-age=\d{7,}/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const preflight = await worker.fetch(new Request(ORIGIN + '/api/account/login', { method: 'OPTIONS', headers: { origin: 'capacitor://localhost', 'access-control-request-method': 'POST' } }), env);
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'capacitor://localhost', 'L’app installata (Capacitor) può ancora parlare con l’API.');
  assert.equal(preflight.headers.get('x-content-type-options'), 'nosniff');
}

// ---------- 5. a failing database ----------
const broken = { ...env, ACCOUNTS: { ...d1, batch: async () => { throw new Error('D1 non disponibile'); } } };
tokenB = (await api('/api/account/login', { method: 'POST', body: { username: B.name, proof: B.proof }, ip: '203.0.113.78' })).body.token;
result = await api('/api/account', { method: 'DELETE', token: tokenB, body: { proof: B.proof, confirm: 'ELIMINA' }, useEnv: broken, ip: '203.0.113.79' });
assert.equal(result.status, 500, 'Database in errore: errore esplicito, mai un finto successo.');
assert.ok(result.body?.error && !/D1 non disponibile/.test(result.body.error), 'Messaggio per il giocatore, senza dettagli interni.');
assert.deepEqual(rows(B.name), { user: 1, saves: 1, sessions: rows(B.name).sessions }, 'Con il database in errore i dati restano e si può riprovare.');

// ---------- 6. the browser client ----------
const store = new Map();
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
globalThis.location = new URL(`${ORIGIN}/`);
const requests = [];
globalThis.fetch = async (url, init = {}) => { requests.push(String(url)); assert.ok(String(url).startsWith(ORIGIN), 'Il client parla solo con il Worker.'); return worker.fetch(new Request(url, init), env); };
const client = await import('../src/data/repositories/account-sync.js?deletion=1');
await client.register('giocatore.c', 'password-lunga');
assert.equal(client.currentAccount().username, 'giocatore.c');
await assert.rejects(() => client.deleteAccount('password-sbagliata', 'ELIMINA'), /Password non corretta/, 'Password sbagliata: errore dal server.');
assert.equal(client.currentAccount()?.username, 'giocatore.c', 'Dopo un errore la sessione locale resta.');
await assert.rejects(() => client.deleteAccount('password-lunga', 'elimina'), /ELIMINA/, 'Senza conferma: errore, nemmeno una richiesta.');
const before = requests.length;
await assert.rejects(() => client.deleteAccount('corta', 'ELIMINA'), /almeno 8/, 'Password troppo corta: errore locale.');
assert.equal(requests.length, before, 'Gli errori locali non fanno richieste.');
const done = await client.deleteAccount('password-lunga', 'ELIMINA');
assert.equal(done.ok, true);
assert.equal(client.currentAccount(), null, 'Confermata la cancellazione, il browser dimentica la sessione.');
assert.equal(count('SELECT COUNT(*) AS n FROM users WHERE username = ?', 'giocatore.c'), 0, 'L’account del client non esiste più.');
await assert.rejects(() => client.deleteAccount('password-lunga', 'ELIMINA'), /Accedi/, 'Senza sessione: errore chiaro.');
// offline: the answer says nothing was deleted, and the session stays
await client.register('giocatore.d', 'password-lunga');
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
await assert.rejects(() => client.deleteAccount('password-lunga', 'ELIMINA'), /Connessione assente/, 'Offline: errore chiaro.');
assert.equal(client.currentAccount()?.username, 'giocatore.d', 'Offline la sessione locale resta.');
assert.equal(client.forgetAccountIf('giocatore.d'), true);
assert.equal(client.currentAccount(), null);

// ---------- 7. the in-game panel and the public pages ----------
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const menu = await import(`../src/ui/menu.js${build ? `?v=${build}` : ''}`);
const panel = menu.renderMainMenu({ view: 'account' }, { account: { user: { username: 'giocatore.a' }, saves: [], status: 'available', available: true }, settings: {}, hasCareer: false, slots: [] });
assert.ok(/data-account-form="delete"/.test(panel) && /ELIMINA/.test(panel) && /Elimina il mio account/.test(panel), 'Il pannello Account ha la cancellazione (password e parola di conferma).');
assert.ok(/privacy\.html/.test(panel) && /termini\.html/.test(panel) && /elimina-account\.html/.test(panel), 'Il pannello rimanda alle pagine pubbliche.');
const page = async name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const todo = [];
for (const name of ['privacy.html', 'termini.html', 'elimina-account.html']) {
  const html = await page(name);
  assert.ok(/<html lang="it">/.test(html) && /<title>[^<]+<\/title>/.test(html) && /name="viewport"/.test(html), `${name}: pagina completa.`);
  // (the policy of the <meta> names the game's own Worker and the local preview: check-security audits it)
  assert.ok(!/https?:\/\/(?!palazzo-2026-site)/.test(html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '').replace(/https?:\/\/openfontlicense\.org/g, '')), `${name}: nessun host esterno.`);
  assert.ok(!/<script(?![^>]*src=)[^>]*>/.test(html), `${name}: nessuno script incorporato.`);
  assert.ok(!/(undefined|NaN|\[object Object\])/.test(html), `${name}: nessun valore non valido.`);
  for (const match of html.matchAll(/data-controller-todo="([^"]+)"/g)) todo.push(`${name}:${match[1]}`);
}
const privacy = await page('privacy.html');
for (const needle of ['nome utente', 'impronta della password', 'Indirizzo IP', 'Salvataggi online', '30 giorni', 'Cloudflare', 'non usa cookie', 'Elimina il mio account']) assert.ok(privacy.toLowerCase().includes(needle.toLowerCase()), `Informativa: ${needle}.`);
assert.ok(/non dichiara la conformità/.test(privacy), 'L’informativa non dichiara la conformità.');
const deletePage = await page('elimina-account.html');
assert.ok(/id="delete-form"/.test(deletePage) && /src="\.\/src\/legal\/delete-account\.js"/.test(deletePage), 'La pagina di cancellazione ha il modulo e lo script.');
assert.ok((await readFile(new URL('../.assetsignore', import.meta.url), 'utf8')).split('\n').every(line => !/^(privacy|termini|elimina-account)\.html$|^src\/legal|^src\/fonts/.test(line.trim())), 'Le pagine pubbliche non sono escluse dalla pubblicazione.');
// every external host of the game: none (the fonts are served from src/fonts)
const index = await page('index.html');
assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(index), 'Nessun carattere caricato da Google Fonts.');
assert.ok(!/https?:\/\//.test(index.replace(/<!--[\s\S]*?-->/g, '').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '').replace(/https?:\/\/(www\.)?w3\.org[^"']*/g, '')), 'index.html non chiama host esterni.');

// ---------- 8. the public page in Chrome, against the local Worker (isolated stand-ins) ----------
const { chromeAvailable, withBrowser, waitFor } = await import('./lib/browser.mjs');
if (!chromeAvailable) console.log('Pagina pubblica nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).');
else {
  const { startLocalWorker } = await import('./lib/local-worker.mjs');
  const local = await startLocalWorker({ port: 8791 });
  globalThis.fetch = nativeFetch;
  await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, viewport }) => {
    const submit = async (username, password, confirm) => evaluate(`(() => { const form = document.querySelector('#delete-form'); form.username.value = ${JSON.stringify(username)}; form.password.value = ${JSON.stringify(password)}; form.confirm.value = ${JSON.stringify(confirm)}; form.requestSubmit(); return true; })()`);
    const message = () => evaluate(`document.querySelector('#delete-result')?.textContent ?? ''`);
    const signUp = async (username, password) => {
      const proof = await client.passwordProof(username, password);
      const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.201' }, body: JSON.stringify({ username, proof }) }), local.env);
      assert.equal(response.status, 201, 'Account di prova registrato nel Worker locale.');
      const token = (await response.json()).token;
      await local.worker.fetch(new Request(`${local.origin}/api/saves/c-prova`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ data: '{"x":1}', encoding: 'json', name: 'Prova', meta: {}, baseRevision: 0 }) }), local.env);
      return token;
    };
    const users = name => local.sqlite.prepare('SELECT COUNT(*) AS n FROM users WHERE username = ?').get(name).n;
    await signUp('pagina.uno', 'password-lunga');
    await signUp('pagina.due', 'altra-password');
    await goto('elimina-account.html');
    await wait(() => evaluate(`Boolean(document.querySelector('#delete-form'))`));
    await submit('pagina.uno', 'password-lunga', 'elimina');
    assert.match(await message(), /ELIMINA/, 'Senza la parola di conferma la pagina lo dice.');
    await submit('pagina.uno', 'password-sbagliata', 'ELIMINA');
    await wait(async () => /non corretti|non è stato eliminato/.test(await message()));
    assert.equal(users('pagina.uno'), 1, 'Password sbagliata: l’account esiste ancora.');
    await submit('pagina.uno', 'password-lunga', 'ELIMINA');
    await wait(async () => /Account eliminato/.test(await message()));
    assert.match(await message(), /1 salvataggi online/, 'La pagina riferisce che cosa è stato rimosso.');
    assert.equal(users('pagina.uno'), 0, 'Dopo la pagina l’account è sparito dal database.');
    assert.equal(users('pagina.due'), 1, 'L’altro account è intatto.');
    assert.equal(local.sqlite.prepare('SELECT COUNT(*) AS n FROM saves WHERE user_id NOT IN (SELECT id FROM users)').get().n, 0, 'Nessun salvataggio orfano.');
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), true, 'Nessuno scorrimento orizzontale.');
    // ----- the same deletion from inside the game: Menu → Account → «Elimina il mio account» -----
    const token = await signUp('gioco.uno', 'password-lunga');
    await goto('');
    await evaluate(`(() => { localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })); localStorage.setItem('politicando.account.v1', JSON.stringify({ username: 'gioco.uno', token: ${JSON.stringify(token)}, since: '2026-10-14T00:00:00.000Z' })); return true; })()`);
    await goto('');
    await wait(() => evaluate(`Boolean(document.querySelector('[data-menu="account"]'))`));
    await evaluate(`document.querySelector('[data-menu="account"]').click(), true`);
    await wait(() => evaluate(`Boolean(document.querySelector('.account-delete'))`));
    await evaluate(`document.querySelector('.account-delete').open = true, true`);
    const inGame = (password, confirm) => evaluate(`(() => { const form = document.querySelector('[data-account-form="delete"]'); form.password.value = ${JSON.stringify(password)}; form.confirm.value = ${JSON.stringify(confirm)}; form.requestSubmit(); return true; })()`);
    for (const [width, height] of [[320, 640], [375, 812], [768, 1024], [1280, 800]]) {
      await viewport(width, height, width < 800);
      await pause(250);
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`), true, `Pannello Account con la cancellazione a ${width}px: nessuno scorrimento orizzontale.`);
    }
    await viewport(1280, 800, false);
    assert.equal(await evaluate(`document.querySelectorAll('.legal-links a').length`), 3, 'Il pannello Account rimanda alle tre pagine pubbliche.');
    await inGame('password-sbagliata', 'ELIMINA');
    await wait(() => evaluate(`/Password non corretta/.test(document.querySelector('.menu-error')?.textContent ?? '')`));
    assert.equal(users('gioco.uno'), 1, 'Dal gioco, password sbagliata: l’account esiste ancora.');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('politicando.account.v1') || 'null')?.username`), 'gioco.uno', 'Dopo l’errore la sessione del browser resta.');
    await evaluate(`document.querySelector('.account-delete').open = true, true`);
    await inGame('password-lunga', 'ELIMINA');
    await wait(() => evaluate(`/Account eliminato/.test(document.querySelector('.account-message')?.textContent ?? '')`));
    assert.equal(users('gioco.uno'), 0, 'Dal gioco l’account è sparito dal database.');
    assert.equal(local.sqlite.prepare('SELECT COUNT(*) AS n FROM saves WHERE user_id NOT IN (SELECT id FROM users)').get().n, 0, 'Nessun salvataggio orfano dopo la cancellazione dal gioco.');
    assert.equal(await evaluate(`localStorage.getItem('politicando.account.v1')`), null, 'Il browser dimentica la sessione dopo la conferma del server.');
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-account-form="login"]'))`), true, 'Il pannello torna ai moduli di accesso.');
    assert.equal(users('pagina.due'), 1, 'L’altro account è ancora intatto.');
    assert.deepEqual(errors, [], 'Nessun errore in pagina.');
  }, { serverPort: 8791 });
  await local.close();
}

if (process.argv.includes('--release') && todo.length) { console.error(`BLOCCO DI RILASCIO: restano ${todo.length} punti da completare a cura del titolare:\n- ${todo.join('\n- ')}`); process.exit(1); }
console.log(`Cancellazione dell’account verificata: servizio (sessione, password dell’account, conferma, nessun account altrui, nessun dato orfano, limite di tentativi, errore del database), client e pannello nel gioco, pagine pubbliche statiche senza host esterni. Punti per il titolare ancora aperti: ${todo.length} (${[...new Set(todo.map(item => item.split(':')[1]))].join(', ')}).`);
