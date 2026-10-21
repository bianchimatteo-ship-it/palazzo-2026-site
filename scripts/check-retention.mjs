// Conservazione degli account inattivi (12 mesi, con preavviso): la procedura è SPENTA di default e non cancella nulla finché non ci sono il canale e-mail, il suo collaudo e l'interruttore.
// Verificata su un SQLite in memoria al posto di D1 (nessuna rete, nessun database vero, nessun account vero): classificazione (attivo, da avvisare, in preavviso, da eliminare, non avvisabile),
// preavviso registrato solo se l'e-mail parte davvero, eliminazione solo dopo 30 giorni dal preavviso e senza attività nel frattempo, tutto l'account rimosso, gli altri intatti.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const sqlite = new DatabaseSync(':memory:');
const statement = (sql, params = []) => ({
  bind: (...values) => statement(sql, values),
  first: async () => sqlite.prepare(sql).get(...params) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
  run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...params) })
});
const d1 = { prepare: sql => statement(sql), batch: async list => Promise.all(list.map(item => item.run())), exec: async sql => sqlite.exec(sql) };
for (const file of (await readdir(new URL('../migrations/', import.meta.url))).sort()) sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
const worker = await import('../worker.js?retention=1');
const { RETENTION, retentionState, planRetention, runRetention } = worker;
const count = (sql, ...params) => sqlite.prepare(sql).get(...params).n;

const DAY = 86_400_000;
const NOW = Date.parse('2027-10-20T08:00:00Z');
const iso = ms => new Date(ms).toISOString();
const ago = days => iso(NOW - days * DAY);
let n = 0;
const addUser = (username, { created = 800, session = null, save = null, email = 'verified', saveRows = 1 } = {}) => {
  const id = `u-${++n}`;
  sqlite.prepare('INSERT INTO users (id, username, salt, hash, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, username, 's', 'h', 1, ago(created));
  if (session !== null) sqlite.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(`t-${id}`, id, ago(session), NOW + DAY);
  if (save !== null) for (let slot = 1; slot <= saveRows; slot++) {
    sqlite.prepare('INSERT INTO saves (user_id, slot, name, meta, data, encoding, revision, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, `c-${slot}`, 'c', '{}', '{}', 'json', 1, 2, ago(save));
    sqlite.prepare('INSERT INTO save_state (user_id, slot, career_id, progress, last_revision, origin, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, `c-${slot}`, 'x', '{}', 1, 'test', ago(save));
    sqlite.prepare('INSERT INTO save_history (user_id, slot, revision, name, meta, data, encoding, size, progress, saved_at, archived_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, `c-${slot}`, 1, 'c', '{}', '{}', 'json', 2, '{}', ago(save), ago(save), 'x');
  }
  if (email === 'verified') sqlite.prepare('INSERT INTO user_emails (user_id, email, email_norm, verified_at, created_at) VALUES (?, ?, ?, ?, ?)').run(id, `${username}@example.invalid`, `${username}@example.invalid`, ago(created), ago(created));
  if (email === 'unverified') sqlite.prepare('INSERT INTO user_emails (user_id, email, email_norm, verified_at, created_at) VALUES (?, ?, ?, NULL, ?)').run(id, `${username}@example.invalid`, `${username}@example.invalid`, ago(created));
  return id;
};
const quiet = addUser('inattivo', { created: 800, save: 500 });                       // 500 days without a save: to warn
const noMail = addUser('senzamail', { created: 800, save: 500, email: 'none' });      // inactive but cannot be warned
const unver = addUser('nonverificata', { created: 800, save: 500, email: 'unverified' });
const active = addUser('attivo', { created: 800, save: 20 });                         // saved 20 days ago
const loggedIn = addUser('connesso', { created: 800, save: 500, session: 3 });        // opened a session 3 days ago
const fresh = addUser('nuovo', { created: 10 });                                      // account of 10 days
const returning = addUser('ritorna', { created: 800, save: 500 });

// ---------- 1. off by default: nothing is read as a reason to act, nothing is touched ----------
const sent = [];
const off = { ACCOUNTS: d1, EMAIL_SEND: async mail => { sent.push(mail); } };
assert.equal(retentionState({ ACCOUNTS: d1 }).enabled, false);
assert.ok(retentionState({ ACCOUNTS: d1 }).reasons.length === 3, 'Spenta: tre ragioni (interruttore, canale e-mail, collaudo del preavviso).');
assert.equal(retentionState({ ...off, RETENTION_ENABLED: '1' }).enabled, false, 'Con l’interruttore ma senza collaudo del preavviso resta spenta.');
assert.equal(retentionState({ ACCOUNTS: d1, RETENTION_ENABLED: '1', RETENTION_NOTICE_TESTED: '1' }).enabled, false, 'Senza canale e-mail resta spenta, anche con interruttore e collaudo.');
const before = count('SELECT COUNT(*) AS n FROM users');
const idle = await runRetention(off, NOW);
assert.equal(idle.ran, false); assert.equal(sent.length, 0, 'Spenta: nessuna e-mail.'); assert.equal(count('SELECT COUNT(*) AS n FROM users'), before, 'Spenta: nessun account toccato.');
assert.equal(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'retention_notices'").get(), undefined, 'Spenta: nemmeno la tabella dei preavvisi viene creata.');
// the scheduled run with nothing set does not touch anything either
await worker.default.scheduled({}, { ACCOUNTS: d1 }, { waitUntil: promise => promise });
assert.equal(count('SELECT COUNT(*) AS n FROM users'), before);

// ---------- 2. the plan (read only) ----------
const plan = Object.fromEntries((await planRetention(d1, NOW)).map(row => [row.username, row.action]));
assert.deepEqual(plan, { inattivo: 'avvisare', senzamail: 'non-avvisabile', nonverificata: 'non-avvisabile', attivo: 'attivo', connesso: 'attivo', nuovo: 'attivo', ritorna: 'avvisare' });
assert.equal(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'retention_notices'").get(), undefined, 'Il rapporto è di sola lettura.');
assert.equal(RETENTION.inactivityMonths, 12); assert.equal(RETENTION.noticeDays, 30);

// ---------- 3. on: the notice first, never a deletion at once ----------
const on = { ACCOUNTS: d1, EMAIL_SEND: async mail => { sent.push(mail); }, RETENTION_ENABLED: '1', RETENTION_NOTICE_TESTED: '1', PUBLIC_BASE_URL: 'https://palazzo-2026-site.bianchimatteo657.workers.dev' };
const first = await runRetention(on, NOW);
assert.deepEqual([first.ran, first.warned, first.deleted], [true, 2, 0], 'Due avvisati (inattivo e ritorna), nessuno eliminato.');
assert.deepEqual(sent.map(mail => mail.to).sort(), ['inattivo@example.invalid', 'ritorna@example.invalid']);
assert.ok(sent.every(mail => /eliminato per inattività/.test(mail.subject) && /entro il 19 novembre 2027/.test(mail.text) && /12 mesi/.test(mail.text)), 'Il preavviso dice quanto e fino a quando.');
assert.equal(count('SELECT COUNT(*) AS n FROM retention_notices'), 2);
assert.equal(count('SELECT COUNT(*) AS n FROM users'), before, 'Nessun account eliminato col preavviso.');
const again = await runRetention(on, NOW + DAY);
assert.deepEqual([again.warned, again.deleted], [0, 0], 'Il giorno dopo: nessun nuovo preavviso, nessuna eliminazione.');
assert.equal((await planRetention(d1, NOW + DAY)).find(row => row.username === 'inattivo').action, 'in-preavviso');

// ---------- 4. someone comes back during the notice; the others are deleted after the 30 days, completely ----------
sqlite.prepare('UPDATE saves SET updated_at = ? WHERE user_id = ?').run(iso(NOW + 10 * DAY), returning);
const later = NOW + RETENTION.noticeDays * DAY + 3600_000;
const plan2 = Object.fromEntries((await planRetention(d1, later)).map(row => [row.username, row.action]));
assert.equal(plan2.inattivo, 'eliminare'); assert.equal(plan2.ritorna, 'attivo', 'Chi torna a giocare durante il preavviso non viene eliminato.');
const last = await runRetention(on, later);
assert.deepEqual([last.warned, last.deleted], [0, 1]);
for (const table of ['users', 'saves', 'save_state', 'save_history', 'sessions', 'user_emails', 'retention_notices']) assert.equal(count(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`.replace('user_id', table === 'users' ? 'id' : 'user_id'), quiet), 0, `Dell’account eliminato non resta nulla in ${table}.`);
for (const [name, id] of Object.entries({ senzamail: noMail, nonverificata: unver, attivo: active, connesso: loggedIn, nuovo: fresh, ritorna: returning })) assert.equal(count('SELECT COUNT(*) AS n FROM users WHERE id = ?', id), 1, `${name}: intatto.`);
assert.equal(count('SELECT COUNT(*) AS n FROM saves WHERE user_id = ?', returning), 1, 'Chi è tornato conserva i salvataggi.');

// ---------- 5. a notice that does not leave is not recorded: no deletion without a notice on record ----------
const broken = addUser('postaguasta', { created: 800, save: 500 });
const failing = { ...on, EMAIL_SEND: async () => { throw new Error('provider giù'); } };
const failed = await runRetention(failing, later);
assert.deepEqual([failed.warned, failed.deleted], [0, 0]);
assert.equal(count('SELECT COUNT(*) AS n FROM retention_notices WHERE user_id = ?', broken), 0, 'Preavviso non partito: non registrato.');
assert.equal(count('SELECT COUNT(*) AS n FROM users WHERE id = ?', broken), 1, 'E l’account resta.');
// an account that came back and fell silent again is warned again (a notice older than its last activity does not count)
assert.equal((await planRetention(d1, later + 400 * DAY)).find(row => row.username === 'ritorna').action, 'avvisare', 'Un preavviso precedente all’ultima attività non vale.');
console.log('Conservazione degli account inattivi verificata (procedura spenta di default): preavviso a 12 mesi, eliminazione solo dopo 30 giorni senza attività, solo con e-mail verificata, preavviso registrato solo se parte, account rimosso per intero, gli altri intatti.');
