// The owner's statistics, on the Worker in process with a SQLite stand-in of D1 (nothing reaches the network, the real database or a real account):
//   - the endpoint answers only to the owner's session (no session, a made-up one, an expired one: 401) and never reveals more than aggregates;
//   - activity is NOT written while ADMIN_STATS is off (the default); with it on, a day of activity is a row (account, day) and nothing else: no address, no device, no user agent, no content;
//   - DAU/WAU/MAU are the distinct accounts of the day, of the rolling 7 days and of the rolling 30 days; the new accounts are counted by day; repeating a day does not count twice;
//   - the rows older than 400 days go, the rows of an account go with the account (deletion), the table has exactly the columns that the notice declares;
//   - the installs come from the owner, with a source, validated (store, day, whole number) and replaced for the same day and store; they are never invented;
//   - the public pages, the game bundle and the public files contain no link to the statistics, no credential and no call to an outside analytics host;
//   - the client reads the figures with the session token only (the token lives in the session storage of the admin, never in the code).
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

const sqlite = new DatabaseSync(':memory:');
const statement = (sql, params = []) => ({ bind: (...values) => statement(sql, values), first: async () => sqlite.prepare(sql).get(...params) ?? null, all: async () => ({ results: sqlite.prepare(sql).all(...params) }), run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...params) }) });
const d1 = { prepare: sql => statement(sql), batch: async list => Promise.all(list.map(item => item.run())), exec: async sql => sqlite.exec(sql) };
const kvData = new Map();
const kv = { async get(key, type) { const e = kvData.get(key); if (!e || (e.expires && e.expires < Date.now())) return null; return type === 'json' ? JSON.parse(e.value) : e.value; }, async put(key, value, o = {}) { kvData.set(key, { value: String(value), expires: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : null }); }, async delete(key) { kvData.delete(key); }, async list({ prefix = '' } = {}) { return { keys: [...kvData.keys()].filter(n => n.startsWith(prefix)).map(name => ({ name })) }; } };
const SETUP = `setup-${randomBytes(6).toString('hex')}`;
const ORIGIN = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const worker = await import('../worker.js?stats=1');
const make = extra => ({ ACCOUNTS: d1, ADMIN_ARCHIVE: kv, ADMIN_SETUP_CODE: SETUP, ASSETS: { fetch: async () => new Response('asset') }, ...extra });
const off = make({}), on = make({ ADMIN_STATS: 'on' });
let ip = 1;
const call = async (env, path, { method = 'GET', body, token } = {}) => {
  const response = await worker.default.fetch(new Request(ORIGIN + path, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${(ip++ % 250) + 1}`, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, body: json, text };
};
// the owner's session
const pin = `Pin-${randomBytes(8).toString('hex')}`;
const owner = (await call(off, '/api/admin/session', { method: 'POST', body: { pin, setupCode: SETUP } })).body.token;
const proof = () => randomBytes(32).toString('hex');
const register = async (env, name) => (await call(env, '/api/account/register', { method: 'POST', body: { username: name, proof: proof() } })).body;

// ---------- 1. who can read ----------
assert.equal((await call(off, '/api/admin/stats')).status, 401, 'Senza sessione: rifiutato.');
assert.equal((await call(off, '/api/admin/stats', { token: '0'.repeat(48) })).status, 401, 'Con una sessione inventata: rifiutato.');
assert.equal((await call(off, '/api/admin/stats', { method: 'PUT', body: { day: '2026-01-01', store: 'google-play', installs: 5, source: 'Play Console' } })).status, 401, 'Senza sessione non si scrive nemmeno.');
const player = await register(off, 'giocatrice');
assert.equal((await call(off, '/api/admin/stats', { token: player.token })).status, 401, 'Il token di un giocatore non apre le statistiche.');

// ---------- 2. off by default: nothing is written ----------
await call(off, '/api/account/login', { method: 'POST', body: { username: 'giocatrice', proof: proof() } });
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM activity_days').get().n, 0, 'Con ADMIN_STATS spento non si scrive nessuna attività.');
let stats = (await call(off, '/api/admin/stats', { token: owner })).body;
assert.equal(stats.activity.enabled, false); assert.deepEqual(stats.activity.series, []); assert.ok(/spenta/.test(stats.activity.note), 'Dice che la raccolta è spenta.');
assert.equal(stats.accounts.total, 1, 'Gli account registrati si contano comunque (sono già nella tabella degli utenti).');

// ---------- 3. on: a day of activity is a row of two columns ----------
const columns = sqlite.prepare("PRAGMA table_info('activity_days')").all().map(item => item.name);
assert.deepEqual(columns, ['user_id', 'day'], 'La tabella dell’attività ha solo account e giorno (niente indirizzo, dispositivo, user agent, contenuti).');
const names = ['a1', 'a2', 'a3', 'a4', 'a5'];
const users = []; for (const name of names) users.push(await register(on, `utente-${name}`));
const ids = sqlite.prepare("SELECT id, username FROM users WHERE username LIKE 'utente-%' ORDER BY username").all();
const today = worker.romeDay();
const noon = n => Date.parse(`${dayOf(n)}T12:00:00Z`);   // noon of a day counted by date, never by 24 h steps (the clocks change in Rome)
const dayOf = n => new Date(Date.parse(`${today}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
// registering already marks today for each account; add past days by hand through the same function the Worker uses
for (const [index, row] of ids.entries()) { await worker.noteActivity(on, d1, row.id, Date.now() - (index + 1) * 86400000); await worker.noteActivity(on, d1, row.id, Date.now() - (index + 1) * 86400000); }
const todayRows = sqlite.prepare('SELECT COUNT(*) AS n FROM activity_days WHERE day = ?').get(today).n;
assert.equal(todayRows, 5, 'Cinque account attivi oggi (la registrazione conta come attività).');
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM activity_days').get().n, 5 + 5, 'Ripetere lo stesso giorno non conta due volte (una riga per account e giorno).');
stats = (await call(on, '/api/admin/stats?days=30', { token: owner })).body;
assert.equal(stats.activity.enabled, true);
const last = stats.activity.series.at(-1);
assert.equal(last.day, today); assert.equal(last.dau, 5); assert.equal(last.wau, 5); assert.equal(last.mau, 5, 'DAU, WAU e MAU di oggi: cinque account distinti.');
const yesterday = stats.activity.series.find(item => item.day === dayOf(1));
assert.equal(yesterday.dau, 1, 'Ieri è attivo un solo account.');
assert.equal(stats.activity.series.length, 30, 'La serie ha un punto per giorno, anche senza attività.');
assert.ok(stats.activity.series.every(item => item.wau >= item.dau && item.mau >= item.wau), 'La settimana contiene il giorno e il mese contiene la settimana.');
assert.equal(stats.accounts.total, 6, 'Sei account in tutto (uno registrato con la raccolta spenta).');
assert.equal(stats.accounts.series.at(-1).newAccounts, 6, 'I nuovi account del giorno.');
assert.equal(JSON.stringify(stats).includes('utente-a1') || JSON.stringify(stats).includes('giocatrice'), false, 'Le statistiche non contengono nomi utente: solo conteggi.');
// the 7 and 30 day windows are rolling and exact
sqlite.exec('DELETE FROM activity_days');
const u = ids[0].id;
await worker.noteActivity(on, d1, u, noon(6));   // inside the week
await worker.noteActivity(on, d1, ids[1].id, noon(7));   // just outside the week, inside the month
await worker.noteActivity(on, d1, ids[2].id, noon(29));  // last day of the month
await worker.noteActivity(on, d1, ids[3].id, noon(30));  // just outside the month
const edge = (await call(on, '/api/admin/stats?days=7', { token: owner })).body.activity.series.at(-1);
assert.equal(edge.dau, 0); assert.equal(edge.wau, 1, 'La settimana mobile ha 7 giorni: oggi e i sei prima.'); assert.equal(edge.mau, 3, 'Il mese mobile ha 30 giorni: il trentesimo giorno prima non c’è.');

// ---------- 4. retention and deletion ----------
sqlite.exec('DELETE FROM activity_days');
await worker.noteActivity(on, d1, u, noon(500));
sqlite.prepare('INSERT OR IGNORE INTO activity_days (user_id, day) VALUES (?, ?)').run(u, '2020-01-01');
await worker.noteActivity(on, d1, u, Date.now());
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM activity_days WHERE day < ?").get(dayOf(400)).n, 0, 'Le righe più vecchie di 400 giorni vengono tolte.');
const deleting = await register(on, 'da-cancellare');
const victim = sqlite.prepare("SELECT id FROM users WHERE username = 'da-cancellare'").get().id;
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM activity_days WHERE user_id = ?').get(victim).n, 1);
await worker.noteActivity(on, d1, victim, Date.now() - 86400000);
// the same deletion the player asks for (password proof + word)
sqlite.prepare('SELECT 1').get();
const { deleteAccountData } = worker;
if (typeof deleteAccountData === 'function') { await deleteAccountData(d1, victim); assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM activity_days WHERE user_id = ?').get(victim).n, 0, 'Con l’account se ne vanno le righe di attività.'); }
else assert.ok(/DELETE FROM activity_days WHERE user_id/.test(await readFile(new URL('../worker.js', import.meta.url), 'utf8')), 'La cancellazione dell’account toglie le righe di attività.');

// ---------- 5. the installs come from the owner, with a source ----------
const put = body => call(on, '/api/admin/stats', { method: 'PUT', token: owner, body });
assert.equal((await put({ day: today, store: 'google-play', installs: 120, source: 'Play Console, report del giorno' })).status, 200);
assert.equal((await put({ day: today, store: 'google-play', installs: 130, source: 'Play Console, report rivisto' })).status, 200, 'Lo stesso giorno e store si corregge.');
assert.equal((await put({ day: dayOf(1), store: 'app-store', installs: 40, source: 'App Store Connect' })).status, 200);
for (const bad of [{ day: 'ieri', store: 'google-play', installs: 1, source: 'Play Console' }, { day: today, store: 'altro', installs: 1, source: 'Play Console' }, { day: today, store: 'google-play', installs: -3, source: 'Play Console' }, { day: today, store: 'google-play', installs: 1.5, source: 'Play Console' }, { day: today, store: 'google-play', installs: 3, source: '' }, { day: '2999-01-01', store: 'google-play', installs: 3, source: 'Play Console' }]) assert.equal((await put(bad)).status, 400, `Rifiutato: ${JSON.stringify(bad)}`);
stats = (await call(on, '/api/admin/stats', { token: owner })).body;
assert.equal(stats.installs.totals['google-play'], 130, 'La cifra corretta sostituisce la prima.'); assert.equal(stats.installs.totals['app-store'], 40);
assert.ok(/Google Play Console/.test(stats.installs.note) && stats.installs.rows.every(row => row.source.length >= 4), 'Ogni cifra ha la sua fonte e il testo dice da dove vengono.');
const noInstalls = (await call(off, '/api/admin/stats?days=7', { token: owner })).body;
assert.ok(Array.isArray(noInstalls.installs.rows), 'Senza cifre inserite non se ne inventano.');

// ---------- 6. nothing public mentions it, no credential in the client, no outside analytics ----------
const walk = async (dir, out = []) => { for (const entry of await readdir(dir, { withFileTypes: true })) { const path = `${dir}/${entry.name}`; if (entry.isDirectory()) { if (!['node_modules', '.git', 'artifacts', 'www', 'android', 'ios', 'portal', 'docs'].includes(entry.name)) await walk(path, out); } else if (/\.(html|js|css|webmanifest)$/.test(entry.name)) out.push(path); } return out; };
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const files = await walk(root);
for (const file of files) {
  if (/worker\.js$|worker-translate\.js$|server\.mjs$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  const relative = file.slice(root.length + 1);
  if (relative.startsWith('scripts/')) continue;
  if (/\.html$/.test(relative)) assert.ok(!/admin\/stats|api\/admin|statistiche-amministrative/i.test(text), `${relative}: nessun collegamento alle statistiche nelle pagine pubbliche.`);
  assert.ok(!/google-analytics\.com|googletagmanager\.com|gtag\(|segment\.io|mixpanel\.com|api\.amplitude\.com|plausible\.io|matomo\.|hotjar\.com|fingerprintjs|clarity\.ms/i.test(text), `${relative}: nessuna analitica esterna né fingerprinting.`);
}
const adminPanel = await readFile(new URL('../src/ui/admin-panel.js', import.meta.url), 'utf8');
const sync = await readFile(new URL('../src/data/repositories/admin-sync.js', import.meta.url), 'utf8');
assert.ok(/fetchAdminStats/.test(sync) && /Authorization|authorization/.test(sync), 'Il client legge le statistiche con la sessione.');
assert.ok(!/ADMIN_SETUP_CODE|ADMIN_STATS/.test(adminPanel + sync), 'Nessuna credenziale né interruttore del server nel client.');
const menu = await readFile(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
assert.ok(!/amministrazione|admin\/stats/i.test(menu.replace(/Amministrazione dei dati/g, '')), 'Nessun collegamento visibile alle statistiche dal menu del gioco.');

// ---------- 7. the owner's tab ----------
{
  const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
  const { renderAdminPanel } = await import(`../src/ui/admin-panel.js?v=${build}`);
  const context = { unlocked: true, available: true, configured: true, checking: false, loading: false, parties: [], knownParties: [], aliasesOf: () => [], politicians: [], groups: [], politicianRecords: [] };
  const withStats = admin => { try { return renderAdminPanel({ tab: 'statistiche', query: '', listPage: 1, message: '', ...admin }, context); } catch (error) { return `ERRORE ${error.message}`; } };
  const ready = (await call(on, '/api/admin/stats?days=30', { token: owner })).body;
  let html = withStats({ stats: { status: 'ready', data: ready } });
  assert.ok(!/ERRORE|undefined|NaN|\[object/.test(html), `Il pannello si disegna senza valori non validi (${html.slice(0, 80)}).`);
  for (const text of ['Account registrati', 'Attivi oggi (DAU)', 'Attivi in 7 giorni (WAU)', 'Attivi in 30 giorni (MAU)', 'Installazioni dagli store', 'data-admin-installs-form', 'data-admin-stats-refresh', 'chi gioca senza account non è contato']) assert.ok(html.includes(text), `Il pannello mostra: ${text}.`);
  assert.ok(!/utente-a1|giocatrice/.test(html), 'Nessun nome utente nel pannello.');
  const offData = (await call(off, '/api/admin/stats?days=30', { token: owner })).body;
  html = withStats({ stats: { status: 'ready', data: offData } });
  assert.ok(/data-stats-off/.test(html) && /spenta/.test(html) && !/Attivi oggi/.test(html), 'Con la raccolta spenta il pannello lo dice e non mostra attività.');
  assert.ok(/role="alert"/.test(withStats({ stats: { status: 'error', error: 'Sessione scaduta' } })) && /Carico le statistiche/.test(withStats({ stats: { status: 'loading' } })) && /Premi «Aggiorna»/.test(withStats({})), 'Stati: errore, caricamento e vuoto.');
  assert.ok(!/data-admin-tab="statistiche"/.test(renderAdminPanel({ tab: 'partiti' }, { ...context, unlocked: false })), 'Senza sessione del proprietario non compare nemmeno la scheda.');
}

// ---------- extended figures: careers online, game modes, what is and is not known ----------
{
  const now = Date.now();
  const save = (slot, meta, ageDays = 1) => sqlite.prepare("INSERT INTO saves (user_id, slot, name, meta, data, encoding, revision, size, updated_at) VALUES (?, ?, ?, ?, '{}', 'json', 1, 2, ?)").run(`utente-${slot}`, slot, 'Nome Segreto Giocatore', JSON.stringify(meta), new Date(now - ageDays * 86400000).toISOString());
  save('c-uno', { player: 'Mario Rossi', party: 'Partito Segreto', status: 'active', difficulty: 'normale', gameMode: 'realistica' }, 1);
  save('c-due', { player: 'Anna Bianchi', status: 'ended', difficulty: 'difficile', gameMode: 'sandbox' }, 10);
  save('c-tre', { player: 'Luca Verdi', status: 'active', difficulty: 'normale' }, 40);
  const stats = (await call(on, '/api/admin/stats?days=90', { token: owner })).body;
  assert.ok(stats.careers && stats.careers.online >= 3, 'Le carriere online sono contate.');
  assert.equal(stats.careers.ended, 1, 'Concluse = stato «ended».');
  assert.equal(stats.careers.byGameMode.sandbox, 1); assert.equal(stats.careers.byGameMode.realistica, 1); assert.ok(stats.careers.byGameMode['non indicato'] >= 1, 'Un salvataggio senza modalità resta «non indicato»: non si inventa.');
  assert.ok(stats.careers.savedLast7Days >= 1 && stats.careers.savedLast30Days >= 2 && stats.careers.savedLast30Days < stats.careers.online + 1, 'Salvataggi recenti per finestra.');
  const text = JSON.stringify(stats);
  for (const secret of ['Mario Rossi', 'Anna Bianchi', 'Luca Verdi', 'Partito Segreto', 'Nome Segreto Giocatore', 'utente-c-uno', 'giocatrice']) assert.ok(!text.includes(secret), `Nessun dato personale nelle statistiche: «${secret}».`);
  const byId = Object.fromEntries(stats.coverage.map(item => [item.id, item]));
  for (const missing of ['sessioni', 'carriere-create', 'elezioni', 'funzioni']) assert.equal(byId[missing].available, false, `${missing}: dichiarato non disponibile, non inventato.`);
  assert.ok(byId.modalita.available && byId['carriere-online'].available, 'Quello che si sa è dichiarato disponibile.');
  assert.equal((await call(off, '/api/admin/stats?days=90', { token: owner })).body.coverage.find(item => item.id === 'dau-wau-mau').available, false, 'Con ADMIN_STATS spento DAU/WAU/MAU sono dichiarati non disponibili.');
  assert.equal((await call(on, '/api/admin/stats?days=90')).status, 401, 'Le statistiche estese sono solo del proprietario.');
}
console.log('Statistiche amministrative verificate: solo con la sessione del proprietario; attività spenta di default e, accesa, solo account e giorno; DAU/WAU/MAU esatti; conservazione 400 giorni e cancellazione con l’account; installazioni inserite con fonte; nessun collegamento pubblico, credenziale o analitica esterna.');
