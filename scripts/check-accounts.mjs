// Player accounts and online saves: the Worker API on Cloudflare D1 (here a SQLite stand-in with the same interface),
// the browser client, and a career recovered on a second device. Local saves stay as an offline copy.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// ---------- a D1 stand-in that survives "deploys" like the real database ----------
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
let worker = (await import('../worker.js?deploy=accounts-1')).default;
const requests = [];
const api = async (path, { method = 'GET', body, token, origin, ip = '198.51.100.7', environment = env } = {}) => {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) };
  const response = await worker.fetch(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), environment);
  return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
};
const proofOf = text => [...text].map(char => char.charCodeAt(0).toString(16)).join('').padEnd(64, 'a').slice(0, 64);

// ---------- 1. registration, login, sessions ----------
let result = await api('/api/account/register', { method: 'POST', body: { username: 'Ma', proof: proofOf('x') } });
assert.equal(result.status, 400, 'Nome utente troppo corto rifiutato.');
result = await api('/api/account/register', { method: 'POST', body: { username: 'giocatore.uno', proof: 'password-in-chiaro' } });
assert.equal(result.status, 400, 'Il server non accetta password in chiaro: solo la prova derivata nel browser.');
result = await api('/api/account/register', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('segreto-1') } });
assert.equal(result.status, 201);
assert.match(result.body.token, /^[\da-f]{64}$/);
const firstToken = result.body.token;
assert.equal((await api('/api/account/register', { method: 'POST', body: { username: 'GIOCATORE.UNO', proof: proofOf('altro') }, ip: '198.51.100.8' })).status, 409, 'Nomi utente unici, senza distinzione di maiuscole.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('sbagliata') } })).status, 401, 'Password sbagliata.');
result = await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('segreto-1') } });
assert.equal(result.status, 200);
const token = result.body.token;
const stored = sqlite.prepare('SELECT hash, salt FROM users WHERE username = ?').get('giocatore.uno');
assert.ok(stored.hash !== proofOf('segreto-1') && stored.salt.length >= 32, 'Nel database c’è solo un hash con sale casuale.');
assert.ok(sqlite.prepare('SELECT token_hash FROM sessions').all().every(row => row.token_hash !== token), 'I token di sessione sono conservati solo come hash.');
result = await api('/api/account/me', { token });
assert.equal(result.body.username, 'giocatore.uno');
assert.equal((await api('/api/account/me', { token: 'f'.repeat(64) })).status, 401, 'Token inesistente rifiutato.');
// Too many wrong passwords from the same address are slowed down.
for (let i = 0; i < 10; i++) await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf(`errore-${i}`) }, ip: '203.0.113.50' });
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('segreto-1') }, ip: '203.0.113.50' })).status, 429, 'Troppi tentativi: accesso sospeso per 15 minuti.');
// Logout ends only that session.
assert.equal((await api('/api/account/logout', { method: 'POST', token: firstToken })).status, 200);
assert.equal((await api('/api/account/me', { token: firstToken })).status, 401, 'Dopo l’uscita la sessione non vale più.');
assert.equal((await api('/api/account/me', { token })).status, 200, 'Le altre sessioni restano attive.');

// ---------- 2. online saves: the protocol of the revisions ----------
// A save is a real career (the server reads the content, it does not trust what the client declares): the slot is named after the career, the progress is read from the date and the weeks.
const careerState = (id, date, week, extra = {}) => ({ version: 10, career: { id, name: 'Prova — Consigliere', electionHistory: [] }, clock: { currentDate: date }, dataset: { politicians: [] }, game: { week: { index: week, number: week } }, saveMeta: { careerId: id, revision: week }, ...extra });
const at = (week, id = 'carriera1') => careerState(id, new Date(Date.UTC(2026, 9, 12) + (week - 1) * 7 * 86_400_000).toISOString().slice(0, 10), week);
const save = (state, extra = {}) => ({ data: JSON.stringify(state), encoding: 'json', name: 'Carriera di prova', meta: { player: 'Profilo di prova', week: state.game?.week?.index ?? 3, gameDate: state.clock?.currentDate, difficulty: 'normale' }, ...extra });
const put = (slotName, state, extra, who = token) => api(`/api/saves/${slotName}`, { method: 'PUT', token: who, body: save(state, extra) });
const unpackText = async row => row.encoding === 'json' ? row.data : new Response(new Blob([Uint8Array.from(atob(row.data), char => char.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
const online = async (slotName = 'c-carriera1', who = token) => { const row = (await api(`/api/saves/${slotName}`, { token: who })).body; return row?.data ? { ...row, state: JSON.parse(await unpackText(row)) } : null; };
const history = async (slotName = 'c-carriera1', who = token) => (await api(`/api/saves/${slotName}/history`, { token: who })).body.history;
result = await put('c-carriera1', at(3), { baseRevision: 0 });
assert.equal(result.body.revision, 1);
result = await put('c-carriera1', at(4), { baseRevision: 1 });
assert.equal(result.body.revision, 2, 'Ogni salvataggio online aumenta la revisione.');
result = await put('c-carriera1', at(2), { baseRevision: 1 });
assert.equal(result.status, 409, 'Un dispositivo con una versione vecchia non sovrascrive quella più recente.');
assert.equal(result.body.remote.revision, 2);
// The save has to be a real career of that slot.
assert.equal((await api('/api/saves/c-carriera1', { method: 'PUT', token, body: { data: JSON.stringify({ week: 5 }), encoding: 'json', baseRevision: 2 } })).status, 400, 'Un contenuto che non è una carriera non si mette online.');
result = await put('c-carriera1', at(5, 'altra-carriera'), { baseRevision: 2 });
assert.ok(result.status === 400 && result.body.code === 'slot-mismatch', 'Una carriera non può occupare lo slot di un’altra.');
// The revision it started from: missing, lower or higher than the one online are all refused, and nothing changes online.
result = await put('c-carriera1', at(9));
assert.ok(result.status === 400 && result.body.code === 'base-missing', 'Senza la revisione di partenza un salvataggio esistente non si sovrascrive.');
result = await put('c-carriera1', at(9), { baseRevision: 7 });
assert.ok(result.status === 409 && result.body.code === 'base-ahead', 'Una revisione di partenza superiore a quella online non si può verificare: rifiutata.');
result = await put('c-carriera1', at(9), { baseRevision: 0 });
assert.ok(result.status === 409 && result.body.conflict, 'Il salvataggio di una copia che si dice nuova non sostituisce una carriera già online.');
result = await put('c-carriera1', at(9), { baseRevision: -1 });
assert.equal(result.status, 400);
result = await put('c-carriera1', at(9), { baseRevision: '2' });
assert.equal(result.status, 400, 'La revisione è un numero intero.');
assert.deepEqual([(await online()).revision, (await online()).state.game.week.index], [2, 4], 'Il salvataggio online è rimasto quello di prima.');
// `force` is not a way around the checks any more: the same request with force is refused in the same way.
result = await put('c-carriera1', at(9), { baseRevision: 1, force: true });
assert.ok(result.status === 409 && result.body.conflict, 'force non salta il controllo della revisione.');
result = await put('c-carriera1', at(1), { baseRevision: 2, force: true });
assert.ok(result.status === 409 && result.body.code === 'regression', 'force non salta nemmeno il controllo di regressione.');
assert.deepEqual([(await online()).revision, (await online()).state.game.week.index], [2, 4], 'Con force il cloud è rimasto intatto.');
// Two devices that start from the same revision at the same moment: one wins, the other gets the conflict (the write checks the revision it read), and online stays what the winner wrote.
const race = await Promise.all([1, 2].map(n => put('c-carriera1', at(10 + n), { baseRevision: 2 })));
assert.deepEqual(race.map(item => item.status).sort(), [200, 409], 'Due scritture simultanee dalla stessa revisione: una passa, l’altra è un conflitto.');
const winner = race.find(item => item.status === 200), loser = race.find(item => item.status === 409);
assert.equal(winner.body.revision, 3); assert.equal(loser.body.conflict, true); assert.equal(loser.body.remote.revision, 3, 'Il conflitto dice quale revisione è online.');
assert.equal((await online()).state.game.week.index, 10 + race.indexOf(winner) + 1, 'Online resta la versione di chi ha vinto.');
result = await put('c-carriera1', at(20), { baseRevision: 3, meta: { player: 'Profilo di prova', party: 'Futuro Nazionale', partyId: 'party-futuro-nazionale', week: 20 } });
assert.equal(result.body.revision, 4);
assert.equal((await api('/api/saves', { token })).body.saves[0].meta.partyId, 'party-futuro-nazionale', 'Il partito della carriera (per il logo) resta nei dati del salvataggio online.');
result = await put('c-carriera1', at(21), { baseRevision: 4 });
assert.equal(result.body.revision, 5);
result = await put('c-carriera1', at(21), { baseRevision: 5 });
assert.equal(result.body.revision, 6, 'Lo stesso punto della carriera si può salvare di nuovo (stessa settimana, revisione nuova).');
assert.equal((await online()).state.game.week.index, 21);

// THE REGRESSION: online there is week 21 at revision 6; a copy of week 1 declares revision 6 as its start. The numbers agree, the content does not: it is refused and the career stays.
const before = await online();
result = await put('c-carriera1', at(1), { baseRevision: 6 });
assert.ok(result.status === 409 && result.body.code === 'regression', 'Settimana 1 con revisione base 6 sopra la settimana 21: rifiutata.');
assert.equal(result.body.remote.revision, 6);
const after = await online();
assert.deepEqual([after.revision, after.data, after.updatedAt], [before.revision, before.data, before.updatedAt], 'Il contenuto persistito è identico: la carriera avanzata non è stata toccata.');
assert.equal(after.state.game.week.index, 21);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM save_history WHERE reason = ?').get('sostituita').n > 0, true);
// Same weeks but fewer elections held, or an older date: also behind.
result = await put('c-carriera1', careerState('carriera1', '2026-10-13', 99), { baseRevision: 6 });
assert.equal(result.body.code, 'regression', 'Una data più vecchia è indietro anche con molte più settimane dichiarate.');
// The compressed form is read too (what the browser sends).
const gz = async state => { const stream = new Blob([JSON.stringify(state)]).stream().pipeThrough(new CompressionStream('gzip')); const bytes = new Uint8Array(await new Response(stream).arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); };
result = await api('/api/saves/c-carriera1', { method: 'PUT', token, body: { data: await gz(at(1)), encoding: 'gzip-base64', baseRevision: 6 } });
assert.equal(result.body.code, 'regression', 'Anche compressa, la copia indietro è riconosciuta dal contenuto.');
result = await api('/api/saves/c-carriera1', { method: 'PUT', token, body: { data: await gz(at(22)), encoding: 'gzip-base64', baseRevision: 6 } });
assert.equal(result.body.revision, 7, 'Compressa e avanzata: accettata.');
// A legacy row (written before protocol 2: no state kept) is read from its content, so the regression is found there too.
sqlite.prepare('INSERT INTO saves (user_id, slot, name, meta, data, encoding, revision, size, updated_at) VALUES ((SELECT id FROM users WHERE username = ?), ?, ?, ?, ?, ?, ?, ?, ?)').run('giocatore.uno', 'c-vecchia', 'Vecchia', '{}', JSON.stringify(at(30, 'vecchia')), 'json', 6, 10, '2026-10-01T00:00:00.000Z');
result = await put('c-vecchia', at(1, 'vecchia'), { baseRevision: 6 });
assert.ok(result.status === 409 && result.body.code === 'regression', 'Una carriera salvata prima del nuovo protocollo è protetta allo stesso modo.');
assert.equal((await online('c-vecchia')).state.game.week.index, 30);
result = await put('c-vecchia', at(31, 'vecchia'), { baseRevision: 6 });
assert.equal(result.body.revision, 7, 'E si può continuare dalla sua revisione.');
sqlite.prepare('DELETE FROM saves WHERE slot = ?').run('c-vecchia'); sqlite.prepare('DELETE FROM save_state WHERE slot = ?').run('c-vecchia'); sqlite.prepare('DELETE FROM save_history WHERE slot = ?').run('c-vecchia');

// ---------- the history of the replaced versions and the explicit restore ----------
let hist = await history();
assert.ok(hist.length >= 5 && hist.length <= 6 + 1, `Le versioni sostituite si conservano (${hist.length}), non all’infinito.`);
assert.ok(hist.every(item => item.reason === 'sostituita' && item.revision < 7), 'Ogni voce dice perché è stata archiviata e da quale revisione viene.');
const older = (await api(`/api/saves/c-carriera1/history/${hist[0].id}`, { token })).body;
assert.ok(JSON.parse(await unpackText(older)).career.id === 'carriera1', 'Una voce della cronologia si legge intera.');
assert.equal((await api('/api/saves/c-carriera1/history')).status, 401, 'La cronologia si legge solo con l’accesso.');
// The restore is a different operation, with its own rules: it names the revision the player saw...
result = await api('/api/saves/c-carriera1/restore', { method: 'POST', token, body: { ...save(at(15)), expectedRevision: 3 } });
assert.ok(result.status === 409 && result.body.conflict, 'Il ripristino di una revisione che non è più quella online è un conflitto.');
result = await api('/api/saves/c-carriera1/restore', { method: 'POST', token, body: { ...save(at(15)) } });
assert.equal(result.status, 400, 'Senza la revisione vista il ripristino non parte.');
const worthKeeping = (await online()).data;
result = await api('/api/saves/c-carriera1/restore', { method: 'POST', token, body: { ...save(at(15)), expectedRevision: 7 } });
assert.ok(result.status === 200 && result.body.revision === 8 && result.body.restored, 'Il ripristino volontario dà una revisione nuova e più alta.');
assert.equal((await online()).state.game.week.index, 15, 'Il contenuto è quello scelto dal giocatore.');
hist = await history();
const kept = hist.find(item => item.reason === 'ripristino');
assert.ok(kept && kept.revision === 7, 'La versione sostituita dal ripristino è conservata.');
assert.equal((await api(`/api/saves/c-carriera1/history/${kept.id}`, { token })).body.data, worthKeeping, 'E identica a com’era.');
result = await api('/api/saves/c-carriera1/restore', { method: 'POST', token, body: { ...save(at(1, 'altra')), expectedRevision: 8 } });
assert.ok(result.status === 400 && result.body.code === 'slot-mismatch', 'Anche il ripristino non mette una carriera in un altro slot.');
// ...and it can bring a version of the history back (the career of week 22 saved above).
result = await api('/api/saves/c-carriera1/restore', { method: 'POST', token, body: { historyId: kept.id, expectedRevision: 8 } });
assert.ok(result.status === 200 && result.body.revision === 9, 'Una versione della cronologia si ripristina con una revisione ancora più alta.');
assert.equal((await online()).state.game.week.index, 22);
assert.ok((await history()).some(item => item.reason === 'ripristino' && item.revision === 8), 'E la versione che sostituisce viene a sua volta conservata.');
// Delete and re-create: the counter does not start over, and the device that knew the old revision cannot write to the new copy.
assert.equal((await api('/api/saves/c-carriera1', { method: 'DELETE', token })).status, 200);
assert.equal((await api('/api/saves/c-carriera1', { token })).status, 404);
assert.ok((await history()).some(item => item.revision === 9), 'Una carriera eliminata online resta recuperabile dalla cronologia.');
result = await put('c-carriera1', at(22), { baseRevision: 9 });
assert.equal(result.status, 409, 'Una copia con la revisione della versione eliminata non ricrea la carriera.');
result = await put('c-carriera1', at(22), { baseRevision: 0 });
assert.equal(result.body.revision, 10, 'Una copia nuova riparte dal contatore, mai da 1: le revisioni non si ripetono.');
// The history is trimmed to the last versions replaced.
for (let week = 23; week < 23 + 9; week++) await put('c-carriera1', at(week), { baseRevision: (await online()).revision });
assert.ok((await history()).filter(item => item.reason === 'sostituita').length <= 6, 'La cronologia delle sostituzioni è limitata.');
result = await api('/api/saves', { token });
assert.equal(result.body.saves.length, 1);
assert.equal(result.body.saves[0].meta.player, 'Profilo di prova');
assert.deepEqual(result.body.saves[0].progress?.length, 4, 'L’elenco dice fino a dove è arrivata la carriera online.');
assert.equal((await api('/api/saves/c-carriera1')).status, 401, 'Senza accesso i salvataggi non si leggono.');
assert.equal((await api('/api/saves/..%2Faltro', { token })).status, 404, 'Nomi di slot non validi rifiutati.');
assert.equal((await api('/api/saves/c-grande', { method: 'PUT', token, body: save(at(1, 'grande'), { data: 'x'.repeat(1_950_000), baseRevision: 0 }) })).status, 413, 'Salvataggi troppo grandi rifiutati.');
// Another player cannot see them.
const other = (await api('/api/account/register', { method: 'POST', body: { username: 'giocatore.due', proof: proofOf('segreto-2') }, ip: '198.51.100.9' })).body.token;
assert.equal((await api('/api/saves', { token: other })).body.saves.length, 0, 'Ogni account vede solo le proprie carriere.');
assert.equal((await api('/api/saves/c-carriera1', { token: other })).status, 404);
assert.equal((await api('/api/saves/c-carriera1/history', { token: other })).body.history.length, 0, 'Né la cronologia.');
assert.equal((await api('/api/saves/c-carriera1/restore', { method: 'POST', token: other, body: { ...save(at(3)), expectedRevision: 0 } })).status, 200, 'Un altro account ha il proprio slot, che non tocca quello altrui.');
assert.equal((await online('c-carriera1')).state.game.week.index, 31, 'La carriera del primo account è intatta.');
// Slot limit.
for (let i = 0; i < 12; i++) await put(`c-slot${i}`, at(1, `slot${i}`), { baseRevision: 0 }, other);
assert.equal((await put('c-slot99', at(1, 'slot99'), { baseRevision: 0 }, other)).status, 409, 'Numero massimo di carriere online.');
assert.equal((await api('/api/saves/c-slot0', { method: 'DELETE', token: other })).status, 200);
assert.equal((await api('/api/saves', { token: other })).body.saves.length, 11, 'Dodici carriere online al massimo (una già dell’altro account), poi una eliminata.');
// CORS for the copy on GitHub Pages.
result = await api('/api/account/me', { token, origin: 'https://bianchimatteo-ship-it.github.io' });
assert.equal(result.headers.get('access-control-allow-origin'), 'https://bianchimatteo-ship-it.github.io');
assert.match(result.headers.get('access-control-allow-methods'), /DELETE/);
// A new deploy: accounts and saves are still there.
worker = (await import('../worker.js?deploy=accounts-2')).default;
assert.equal((await api('/api/account/me', { token })).body.username, 'giocatore.uno', 'Account e sessioni sopravvivono a un nuovo deploy.');
assert.equal((await api('/api/saves', { token })).body.saves[0].revision, 19);


// ---------- 2b. e-mail verified by a link, recovery of the password ----------
// The Worker is run with a transport that records the messages (the real one is a provider set with secrets: see docs/account-email.md); nothing is sent anywhere.
const outbox = [];
const mailEnv = { ...env, EMAIL_SEND: async message => { outbox.push(message); }, EMAIL_FROM: 'POLITICANDO <prova@example.invalid>', PUBLIC_BASE_URL: ORIGIN };
const linkOf = (message, name) => new URL(/https?:\/\/\S+/.exec(message.text)[0]).searchParams.get(name);
const mailApi = (path, options = {}) => api(path, { environment: mailEnv, ...options });
const newWindow = () => sqlite.prepare("DELETE FROM attempts WHERE key LIKE 'recupero%'").run();
const tokensInDb = () => sqlite.prepare('SELECT token_hash FROM email_tokens').all().map(row => row.token_hash);
// Without a provider the service says so, and does not pretend: nothing is sent, recovery gives the same neutral answer.
assert.equal((await api('/api/account/status')).body.email, false, 'Senza provider il servizio dice che le email non partono.');
assert.equal((await mailApi('/api/account/status')).body.email, true);
result = await api('/api/account/email', { method: 'POST', token, body: { email: 'Giocatore.Uno@Example.org', proof: proofOf('segreto-1') } });
assert.ok(result.status === 200 && result.body.sent === false && /non è ancora attivo/.test(result.body.message), 'L’indirizzo si salva, ma senza provider non finge di aver spedito.');
assert.deepEqual((await api('/api/account/recover', { method: 'POST', body: { email: 'giocatore.uno@example.org' }, ip: '198.51.100.40' })).body.ok, true);
assert.equal(outbox.length, 0);
// An account that existed before (registered with the user name only) keeps working, and can add an address.
assert.equal((await api('/api/account/me', { token })).body.email.verified, false);
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('segreto-1') } })).status, 200, 'Un account legacy accede con le credenziali di sempre.');
result = await mailApi('/api/account/email', { method: 'POST', token, body: { email: 'giocatore.uno@example.org', proof: proofOf('sbagliata') } });
assert.equal(result.status, 403, 'Collegare un indirizzo richiede di provare la password.');
result = await mailApi('/api/account/email', { method: 'POST', token, body: { email: 'non-un-indirizzo', proof: proofOf('segreto-1') } });
assert.equal(result.status, 400);
result = await mailApi('/api/account/email', { method: 'POST', token, body: { email: 'giocatore.uno@example.org', proof: proofOf('segreto-1') } });
assert.ok(result.status === 200 && result.body.sent === true && outbox.length === 1, 'Il messaggio di verifica parte.');
assert.equal(outbox[0].to.toLowerCase(), 'giocatore.uno@example.org');
const verifyToken = linkOf(outbox[0], 'verifica-email');
assert.match(verifyToken, /^[\da-f]{64}$/, 'Il collegamento porta un token casuale di 256 bit.');
assert.ok(!tokensInDb().includes(verifyToken) && tokensInDb().length === 1, 'Il server conserva soltanto l’hash del token.');
// Unverified: no recovery yet (and the answer is the same as for an address nobody knows).
const neutral = await mailApi('/api/account/recover', { method: 'POST', body: { email: 'giocatore.uno@example.org' }, ip: '198.51.100.41' });
const unknown = await mailApi('/api/account/recover', { method: 'POST', body: { email: 'nessuno@example.org' }, ip: '198.51.100.41' });
assert.deepEqual([neutral.status, neutral.body], [unknown.status, unknown.body], 'La risposta non rivela se l’indirizzo esiste.');
assert.equal(outbox.length, 1, 'Un indirizzo non verificato non serve a recuperare l’account.');
assert.equal((await mailApi('/api/account/email/verify', { method: 'POST', body: { token: 'a'.repeat(64) } })).status, 400, 'Token inventato rifiutato.');
// An expired token does not work; a new link replaces the old one.
sqlite.prepare('UPDATE email_tokens SET expires_at = ?').run(Date.now() - 1000);
assert.equal((await mailApi('/api/account/email/verify', { method: 'POST', body: { token: verifyToken } })).status, 400, 'Un token scaduto non vale.');
result = await mailApi('/api/account/email/resend', { method: 'POST', token, body: { proof: proofOf('segreto-1') } });
assert.equal(outbox.length, 2);
const verifyToken2 = linkOf(outbox[1], 'verifica-email');
assert.equal((await mailApi('/api/account/email/verify', { method: 'POST', body: { token: verifyToken } })).status, 400, 'Il collegamento precedente non vale più.');
assert.equal((await mailApi('/api/account/email/verify', { method: 'POST', body: { token: verifyToken2 } })).status, 200, 'Il collegamento valido verifica l’indirizzo.');
assert.equal((await mailApi('/api/account/email/verify', { method: 'POST', body: { token: verifyToken2 } })).status, 400, 'Un token si usa una volta sola.');
assert.deepEqual((await api('/api/account/me', { token })).body.email, { masked: 'Gi•••••••••••@Example.org', verified: true });
// Recovery: a message for the verified address only; the new password replaces the old one, the sessions end, the link works once.
const sessionsBefore = sqlite.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ?)').get('giocatore.uno').n;
assert.ok(sessionsBefore >= 1);
newWindow(); // (fifteen minutes later)
await mailApi('/api/account/recover', { method: 'POST', body: { email: 'GIOCATORE.UNO@example.org ' }, ip: '198.51.100.42' });
await mailApi('/api/account/recover', { method: 'POST', body: { email: 'nessuno@example.org' }, ip: '198.51.100.42' });
assert.equal(outbox.length, 3, 'Un solo messaggio, per l’indirizzo verificato (le maiuscole non contano).');
const resetToken = linkOf(outbox[2], 'reimposta-password');
assert.ok(!tokensInDb().includes(resetToken), 'Anche il token di recupero è conservato come hash.');
result = await mailApi('/api/account/reset/check', { method: 'POST', body: { token: resetToken } });
assert.deepEqual([result.status, result.body.username], [200, 'giocatore.uno'], 'Il collegamento dice a quale nome utente serve la nuova password.');
assert.equal((await mailApi('/api/account/reset', { method: 'POST', body: { token: resetToken, proof: 'password-in-chiaro' } })).status, 400, 'Anche qui solo la prova derivata, mai la password in chiaro.');
assert.equal((await mailApi('/api/account/reset', { method: 'POST', body: { token: 'b'.repeat(64), proof: proofOf('nuova-password') } })).status, 400);
result = await mailApi('/api/account/reset', { method: 'POST', body: { token: resetToken, proof: proofOf('nuova-password') } });
assert.equal(result.status, 200);
assert.equal((await mailApi('/api/account/reset', { method: 'POST', body: { token: resetToken, proof: proofOf('altra-ancora') } })).status, 400, 'Un token di recupero non si riusa.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('segreto-1') } })).status, 401, 'La vecchia password non vale più.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('nuova-password') } })).status, 200, 'Con la nuova si accede.');
assert.equal((await api('/api/account/me', { token })).status, 401, 'Le sessioni aperte prima del cambio password sono terminate.');
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM email_tokens WHERE purpose = ? AND used_at IS NULL').get('reset').n, 0, 'Nessun altro collegamento di recupero resta valido.');
const afterReset = (await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('nuova-password') } })).body.token;
assert.equal((await api('/api/saves', { token: afterReset })).body.saves.length, 1, 'Le carriere dell’account sono dove erano.');
// A link that expired: the password does not change.
newWindow();
await mailApi('/api/account/recover', { method: 'POST', body: { email: 'giocatore.uno@example.org' }, ip: '198.51.100.43' });
const lateToken = linkOf(outbox[3], 'reimposta-password');
sqlite.prepare('UPDATE email_tokens SET expires_at = ?').run(Date.now() - 1000);
assert.equal((await mailApi('/api/account/reset', { method: 'POST', body: { token: lateToken, proof: proofOf('troppo-tardi') } })).status, 400, 'Un collegamento scaduto non cambia la password.');
assert.equal((await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.uno', proof: proofOf('nuova-password') } })).status, 200);
// Limits: from one address, and for one mailbox.
newWindow();
const ipOutbox = outbox.length;
for (let i = 0; i < 3; i++) await mailApi('/api/account/recover', { method: 'POST', body: { email: 'giocatore.uno@example.org' }, ip: '198.51.100.44' });
assert.equal(outbox.length - ipOutbox, 3, 'Fino a tre messaggi per lo stesso indirizzo.');
await mailApi('/api/account/recover', { method: 'POST', body: { email: 'giocatore.uno@example.org' }, ip: '198.51.100.45' });
assert.equal(outbox.length - ipOutbox, 3, 'Il quarto, anche da un altro indirizzo di rete, non parte: la risposta resta la stessa.');
let limited = null;
for (let i = 0; i < 10 && !limited; i++) { const r = await mailApi('/api/account/recover', { method: 'POST', body: { email: `a${i}@example.org` }, ip: '203.0.113.99' }); if (r.status === 429) limited = r; }
assert.ok(limited, 'Troppe richieste dallo stesso indirizzo di rete: 429.');
// New accounts: the address is checked and verified by the same link; where the owner requires it, it is asked.
result = await mailApi('/api/account/register', { method: 'POST', body: { username: 'giocatore.tre', proof: proofOf('segreto-3'), email: 'tre@example.org' }, ip: '198.51.100.60' });
assert.ok(result.status === 201 && result.body.emailVerification === 'inviata' && outbox.at(-1).to === 'tre@example.org', 'Un account nuovo con email riceve il messaggio di verifica.');
assert.equal((await mailApi('/api/account/email/verify', { method: 'POST', body: { token: linkOf(outbox.at(-1), 'verifica-email') } })).status, 200);
assert.equal((await mailApi('/api/account/register', { method: 'POST', body: { username: 'giocatore.quattro', proof: proofOf('x4'), email: 'non valida' }, ip: '198.51.100.61' })).status, 400, 'Un indirizzo non valido è rifiutato.');
assert.equal((await mailApi('/api/account/register', { method: 'POST', body: { username: 'giocatore.cinque', proof: proofOf('x5') }, ip: '198.51.100.62', environment: { ...mailEnv, ACCOUNT_EMAIL_REQUIRED: '1' } })).status, 400, 'Dove il titolare lo richiede, senza email non si crea l’account.');
// An address verified by one account cannot be verified by another.
const sixToken = (await mailApi('/api/account/register', { method: 'POST', body: { username: 'giocatore.sei', proof: proofOf('x6'), email: 'tre@example.org' }, ip: '198.51.100.63' })).body.token;
assert.equal((await mailApi('/api/account/email/verify', { method: 'POST', body: { token: linkOf(outbox.at(-1), 'verifica-email') } })).status, 409, 'Un indirizzo già verificato da un altro account non si può verificare di nuovo.');
assert.ok(sixToken);
// Deleting an account removes the address, the tokens, the history and the counters with it.
const treId = sqlite.prepare('SELECT id FROM users WHERE username = ?').get('giocatore.tre').id;
const treToken = (await api('/api/account/login', { method: 'POST', body: { username: 'giocatore.tre', proof: proofOf('segreto-3') }, ip: '198.51.100.64' })).body.token;
await put('c-tre', at(2, 'tre'), { baseRevision: 0 }, treToken); await put('c-tre', at(3, 'tre'), { baseRevision: 1 }, treToken);
await mailApi('/api/account/recover', { method: 'POST', body: { email: 'tre@example.org' }, ip: '198.51.100.65' });
assert.equal((await api('/api/account', { method: 'DELETE', token: treToken, body: { proof: proofOf('segreto-3'), confirm: 'ELIMINA' } })).status, 200);
for (const table of ['user_emails', 'email_tokens', 'save_history', 'save_state', 'saves', 'sessions']) assert.equal(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(treId).n, 0, `Di un account eliminato non resta nulla in ${table}.`);

// ---------- 3. the browser client: each copy knows where it comes from ----------
const device = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map }; };
const deviceA = device(), deviceB = device(), deviceC = device();
globalThis.location = new URL(`${ORIGIN}/`);
let offline = false;
globalThis.fetch = async (url, init = {}) => { if (offline) throw new TypeError('Failed to fetch'); requests.push({ url: String(url), method: init.method ?? 'GET', body: init.body ?? null }); return worker.fetch(new Request(url, init), env); };
const client = await import('../src/data/repositories/account-sync.js');
assert.equal(client.accountApiBase(), ORIGIN);
// The game asks whether the service really answers (an address alone is not enough).
result = await api('/api/account/status');
assert.ok(result.status === 200 && result.body.ok === true && result.headers.get('content-type').includes('application/json'), 'Il Worker risponde allo stato del servizio account, senza sessione.');
assert.equal(await client.probeAccountService(), 'available', 'Servizio account raggiungibile riconosciuto.');
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
assert.equal(await client.probeAccountService(), 'unreachable', 'Nessuna risposta: servizio non raggiungibile.');
globalThis.fetch = async () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
assert.equal(await client.probeAccountService(), 'unreachable', 'Una pagina che non è il servizio (sito statico senza Worker): non raggiungibile.');
globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Gli account non sono ancora configurati su questo sito.' }), { status: 503, headers: { 'content-type': 'application/json' } });
assert.equal(await client.probeAccountService(), 'unreachable', 'Servizio senza database (503): non raggiungibile.');
globalThis.fetch = (url, init = {}) => new Promise((resolve, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
assert.equal(await client.probeAccountService({ timeout: 30 }), 'unreachable', 'Servizio che non risponde entro il tempo: non raggiungibile.');
globalThis.fetch = realFetch;
globalThis.localStorage = deviceA;
await assert.rejects(client.register('ab', 'password-lunga'), /Nome utente/);
await assert.rejects(client.register('giocatrice', 'corta'), /almeno 8/);
await client.register('Giocatrice', 'una-password-lunga');
assert.equal(client.currentAccount().username, 'giocatrice');
assert.ok(requests.every(item => !String(item.body ?? '').includes('una-password-lunga')), 'La password non viene mai inviata in chiaro.');
const career = { ...careerState('carriera-1234-abcd', '2026-10-05', 7), game: { week: { index: 7, number: 7 }, memory: Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, text: 'Promessa mantenuta in Liguria' })) }, saveMeta: { careerId: 'carriera-1234-abcd', revision: 7 } };
const slot = client.slotForCareer(career.career.id);
assert.match(slot, /^c-[a-z0-9]{1,38}$/);
const advance = (state, week, revision = week) => ({ ...state, clock: { currentDate: new Date(Date.UTC(2026, 9, 5) + (week - 7) * 7 * 86_400_000).toISOString().slice(0, 10) }, game: { ...state.game, week: { index: week, number: week } }, saveMeta: { ...state.saveMeta, revision } });
const count = () => requests.length;
const onlineNow = slotName => online(slotName, client.currentAccount().token);
// A copy that was never linked is not uploaded on its own: it must say it creates the online one.
let beforeCount = count();
await assert.rejects(client.uploadSave(slot, career), error => error.data.code === 'unlinked' && error.status === 409, 'Una copia senza provenienza non va online da sola.');
assert.equal(count(), beforeCount, 'E non parte nemmeno una richiesta.');
const first = await client.uploadSave(slot, career, { name: 'Prova', meta: { player: 'Prova', week: 7 }, create: true });
assert.equal(first.revision, 1);
assert.equal(sqlite.prepare('SELECT encoding FROM saves WHERE slot = ?').get(slot).encoding, 'gzip-base64', 'I salvataggi viaggiano compressi.');
assert.deepEqual([client.knownRevision(slot), client.linkOf(career.career.id).localRevision, client.linkOf(career.career.id).progress[1]], [1, 7, 7], 'Il collegamento registra la revisione online e la copia a cui corrisponde.');
// Device B: log in, find the career, download it (the link follows the downloaded copy), play on.
globalThis.localStorage = deviceB;
await client.login('giocatrice', 'una-password-lunga');
assert.equal(client.knownRevision(slot), null, 'Un altro dispositivo non ha nessuna revisione finché non scarica o carica.');
const list = await client.listCloudSaves();
assert.equal(list[0].slot, slot, 'Dal secondo dispositivo la carriera è nell’elenco.');
const downloaded = await client.downloadSave(slot);
assert.deepEqual(downloaded.state, career, 'La carriera scaricata è identica a quella salvata.');
assert.equal(client.knownRevision(slot), 1);
const week9 = advance(career, 9);
assert.equal((await client.uploadSave(slot, week9, { meta: { week: 9 } })).revision, 2);
// Back on A, still linked at revision 1: its copy is not behind, but online moved on — the server refuses and the revision on A does not move.
globalThis.localStorage = deviceA;
beforeCount = count();
await assert.rejects(client.uploadSave(slot, advance(career, 8)), error => error.status === 409 && error.data.remote.revision === 2 && error.data.code === 'conflict', 'Il dispositivo A, rimasto indietro, non sovrascrive la versione più recente.');
assert.equal(client.knownRevision(slot), 1, 'Un conflitto non sposta la revisione conosciuta.');
// A copy that is behind what this device itself synced is refused here, before any request: an old save of the same career does not inherit the newest revision.
await client.downloadSave(slot).then(async remote => { assert.equal(remote.state.game.week.index, 9); });
assert.equal(client.knownRevision(slot), 2);
beforeCount = count();
await assert.rejects(client.uploadSave(slot, career), error => error.data.code === 'stale-copy', 'Una copia della settimana 7 non usa la revisione della settimana 9.');
await assert.rejects(client.uploadSave(slot, advance(week9, 9, 3)), error => error.data.code === 'stale-copy', 'Né una copia con meno salvataggi locali alle spalle.');
assert.equal(count(), beforeCount, 'Nessuna richiesta è partita.');
// Even a request forged to carry the right number is stopped by the server, which reads the content.
const forged = await api(`/api/saves/${slot}`, { method: 'PUT', token: client.currentAccount().token, body: { data: JSON.stringify(career), encoding: 'json', baseRevision: 2 } });
assert.ok(forged.status === 409 && forged.body.code === 'regression', 'Settimana 7 con la revisione 2 della settimana 9: il server la rifiuta leggendo il contenuto.');
// The old record of the revisions (one number per slot, no provenance) proves nothing.
globalThis.localStorage = deviceC;
await client.login('giocatrice', 'una-password-lunga');
deviceC.setItem('politicando.account.revisions.v1', JSON.stringify({ username: 'giocatrice', slots: { [slot]: 2 } }));
assert.equal(client.knownRevision(slot), null);
beforeCount = count();
await assert.rejects(client.uploadSave(slot, week9), error => error.data.code === 'unlinked', 'Un salvataggio legacy, senza provenienza, non si attribuisce la revisione corrente.');
assert.equal(count(), beforeCount);
await assert.rejects(client.uploadSave(slot, week9, { create: true }), error => error.status === 409, 'E dichiararsi «nuovo» non sostituisce la carriera online: il server rifiuta.');
assert.equal((await onlineNow(slot)).revision >= 2, true);
// The explicit replacement: names the revision seen, keeps the replaced version, gives a higher revision.
globalThis.localStorage = deviceA;
const sureOld = await onlineNow(slot);
await assert.rejects(client.restoreSave(slot, career, { expectedRevision: 1 }), error => error.status === 409, 'Un ripristino su una revisione che non è più quella online è un conflitto.');
const restored = await client.restoreSave(slot, career, { expectedRevision: 2, meta: { week: 7 } });
assert.equal(restored.revision, 3);
assert.equal((await onlineNow(slot)).state.game.week.index, 7, 'Online c’è la copia scelta.');
assert.equal(client.knownRevision(slot), 3, 'Il dispositivo che ha ripristinato è collegato alla nuova revisione.');
const versions = await client.listSaveHistory(slot);
const replaced = versions.find(item => item.reason === 'ripristino');
assert.ok(replaced && replaced.revision === 2, 'La versione sostituita è nella cronologia.');
assert.equal((await client.downloadHistoryVersion(slot, replaced.id)).state.game.week.index, 9, 'E si può rileggere.');
const back = await client.restoreFromHistory(slot, replaced.id, 3);
assert.equal(back.revision, 4);
assert.equal((await client.downloadSave(slot)).state.game.week.index, 9, 'La versione della cronologia torna online (e il dispositivo la segue).');
assert.ok(sureOld.revision === 2);
// Another account on the same device: it owns nothing of the first one's careers.
const ownerBefore = client.ownerOf(career.career.id);
assert.equal(ownerBefore, 'giocatrice');
await client.logout();
assert.equal(client.currentAccount(), null);
await client.register('secondo.giocatore', 'un-altra-password');
assert.equal(client.linkOf(career.career.id), null, 'La carriera collegata a un altro account non è collegata a questo.');
assert.equal(client.ownerOf(career.career.id), 'giocatrice', 'Si sa di chi è.');
await assert.rejects(client.uploadSave(slot, week9), error => error.data.code === 'unlinked', 'Non finisce nell’account appena aperto.');
// Logout ends the session here at once and on the server; offline it is remembered and ended later.
const ended = []; const stopListening = client.onAccountEnd(reason => ended.push(reason));
const tokenTwo = client.currentAccount().token;
offline = true;
await client.logout();
assert.deepEqual(ended, ['logout'], 'Chi ascolta sa che la sessione è finita.');
assert.equal(client.currentAccount(), null, 'Anche senza rete la sessione locale finisce subito.');
assert.equal((await api('/api/account/me', { token: tokenTwo })).status, 200, 'La sessione sul server non è stata chiusa (nessuna rete).');
offline = false;
assert.equal(await client.flushRevocations(), 1);
assert.equal((await api('/api/account/me', { token: tokenTwo })).status, 401, 'Tornata la rete, la sessione si chiude anche sul server.');
// An expired session (401): the account is gone here and the listeners are told.
await client.login('giocatrice', 'una-password-lunga');
sqlite.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1000);
ended.length = 0;
await assert.rejects(client.listCloudSaves(), /Sessione/, 'Una sessione scaduta è un 401.');
assert.equal(client.currentAccount(), null);
assert.deepEqual(ended, ['session-expired']);
stopListening();
// Email and recovery from the browser.
await client.login('giocatrice', 'una-password-lunga');
await assert.rejects(client.addEmail('x@example.org', 'corta'), /almeno 8/);
await client.logout();
// Local-only copies of the game (localhost without the API): the client says so instead of failing silently.
globalThis.location = new URL('http://localhost:8080/');
assert.equal(client.accountApiBase(), null);
assert.equal(await client.probeAccountService(), 'none', 'Senza indirizzo del servizio: nessun account da offrire.');
await assert.rejects(client.login('giocatrice', 'una-password-lunga'), /sito pubblicato/);
console.log('Account verificati: registrazione e accesso con password mai inviata in chiaro (PBKDF2 nel browser + hash con sale sul server), sessioni a token conservate come hash, uscita, tentativi limitati, salvataggi online compressi con revisioni e protezione dai conflitti tra dispositivi, limiti di dimensione e numero, isolamento tra account, CORS per GitHub Pages, persistenza dopo un nuovo deploy, carriera recuperata su un secondo dispositivo.');
