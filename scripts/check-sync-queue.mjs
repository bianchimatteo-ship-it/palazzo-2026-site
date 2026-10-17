// The queue of the online saves (src/data/repositories/sync-queue.js) against the real Worker on an in-memory D1: it survives closing the page, waits and retries when offline, takes up
// again only after reading the version online, never sends under another account, and two tabs do not work on it at once. Nothing reaches the network or production.
import assert from 'node:assert/strict';
import { createStandIns } from './lib/local-worker.mjs';

const stand = createStandIns();
const worker = (await import(`../worker.js?queue=${Date.now()}`)).default;
const env = { ACCOUNTS: stand.d1, ADMIN_ARCHIVE: stand.kv, ASSETS: { fetch: async () => new Response('asset') } };
const device = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map }; };
let online = true;
const sent = [];
globalThis.location = new URL('http://127.0.0.1:8791/');
globalThis.fetch = async (url, init = {}) => {
  if (!online) throw new TypeError('Failed to fetch');
  sent.push({ method: init.method ?? 'GET', path: new URL(String(url)).pathname });
  return worker.fetch(new Request(url, init), env);
};
const puts = () => sent.filter(item => item.method === 'PUT').length;
const account = await import('../src/data/repositories/account-sync.js');
const { createSyncEngine, BACKOFF_MS } = await import('../src/data/repositories/sync-queue.js');
const storageA = device();
globalThis.localStorage = storageA;

const careerState = (id, date, week, revision = week) => ({ version: 10, career: { id, name: 'Prova — Consigliere', electionHistory: [] }, clock: { currentDate: date }, dataset: { politicians: [] }, game: { week: { index: week, number: week } }, saveMeta: { careerId: id, revision } });
const at = (week, id = 'coda-uno') => careerState(id, new Date(Date.UTC(2026, 9, 12) + (week - 1) * 7 * 86_400_000).toISOString().slice(0, 10), week);
// What this browser has saved (the queue reads it when it works, it never uses what is only in memory).
const saved = new Map();
let clock = 1_800_000_000_000;
const timers = [];
const makeEngine = (store = storageA, extra = {}) => createSyncEngine({
  store, account, getSnapshot: careerId => saved.get(careerId) ?? null, now: () => clock,
  schedule: (fn, ms) => { const handle = { fn, ms }; timers.push(handle); return handle; }, cancel: handle => { const at = timers.indexOf(handle); if (at >= 0) timers.splice(at, 1); },
  metaOf: snapshot => ({ player: 'Prova', week: snapshot.game.week.index, gameDate: snapshot.clock.currentDate }), nameOf: () => 'Prova', ...extra
});
const api = async (path, { method = 'GET', body, token } = {}) => { const response = await worker.fetch(new Request(`http://127.0.0.1:8791${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env); return { status: response.status, body: await response.json().catch(() => null) }; };
const unpackText = async row => row.encoding === 'json' ? row.data : new Response(new Blob([Uint8Array.from(atob(row.data), char => char.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
const onlineCopy = async (slot, token) => { const row = (await api(`/api/saves/${slot}`, { token })).body; return row?.data ? { revision: row.revision, state: JSON.parse(await unpackText(row)) } : null; };

await account.register('coda.uno', 'password-della-coda');
const slot = account.slotForCareer('coda-uno');
const token = account.currentAccount().token;

// ---------- 1. a request is written down, the page is closed, the game is reopened ----------
saved.set('coda-uno', at(3));
let engine = makeEngine();
assert.equal(engine.status('coda-uno').state, 'none', 'Prima di tutto la carriera non è collegata.');
engine.enqueue(at(3), { explicit: true });
assert.equal(engine.status('coda-uno').state, 'pending', 'Il salvataggio è in coda.');
assert.ok(storageA.getItem('politicando.sync.queue.v1').includes('coda-uno'), 'La coda è scritta nel browser, non solo in memoria.');
engine.stop();
engine = null;   // the page is closed
const reopened = makeEngine();
assert.equal(reopened.status('coda-uno').state, 'pending', 'Riaperto il gioco la richiesta c’è ancora.');
assert.equal(puts(), 0);
reopened.resume();
assert.ok(timers.length === 1, 'All’avvio la coda si rimette in moto da sola.');
timers.shift().fn();
await reopened.flush();
assert.equal(puts(), 1, 'E il salvataggio parte.');
assert.deepEqual([reopened.status('coda-uno').state, account.knownRevision(slot), (await onlineCopy(slot, token)).state.game.week.index], ['synced', 1, 3], 'Sincronizzato: la revisione online è registrata e il contenuto è quello salvato.');

// ---------- 2. offline: the save waits, retries with growing waits, goes when the connection is back ----------
saved.set('coda-uno', at(4));
reopened.enqueue(at(4));
online = false;
let summary = await reopened.flush();
let op = reopened.status('coda-uno');
assert.equal(op.state, 'retry', 'Senza rete la richiesta resta in attesa di un nuovo tentativo.');
assert.equal(op.op.attempts, 1);
assert.equal(op.op.nextAt, clock + BACKOFF_MS[0]);
assert.ok(summary.pending === 1 && timers.length === 1 && timers[0].ms >= BACKOFF_MS[0] - 1, 'Un nuovo tentativo è già in programma.');
clock += BACKOFF_MS[0];
await reopened.flush();
assert.equal(reopened.status('coda-uno').op.attempts, 2);
assert.equal(reopened.status('coda-uno').op.nextAt, clock + BACKOFF_MS[1], 'Le attese crescono.');
assert.equal((await onlineCopy(slot, token)).state.game.week.index, 3, 'Intanto online non cambia nulla.');
online = true;
clock += BACKOFF_MS[1];
await reopened.flush();
assert.equal(reopened.status('coda-uno').state, 'synced', 'Tornata la rete la carriera si sincronizza.');
assert.equal((await onlineCopy(slot, token)).state.game.week.index, 4);

// ---------- 3. before sending, the version online is read again: if it is not the one this device knows, nothing is sent ----------
const other = await api(`/api/saves/${slot}`, { method: 'PUT', token, body: { data: JSON.stringify(at(30)), encoding: 'json', baseRevision: account.knownRevision(slot), meta: {} } });
assert.equal(other.status, 200, 'Un altro dispositivo porta online una versione più avanzata.');
saved.set('coda-uno', at(5));
reopened.enqueue(at(5));
const putsBefore = puts();
await reopened.flush();
assert.equal(puts(), putsBefore, 'Nessun salvataggio parte.');
let conflict = reopened.status('coda-uno');
assert.ok(conflict.state === 'conflict' && conflict.op.kind === 'remote-changed' && conflict.op.remote.revision === other.body.revision, 'La coda si ferma sul conflitto e dice cosa c’è online.');
assert.equal((await onlineCopy(slot, token)).state.game.week.index, 30, 'La carriera online è intatta.');
reopened.enqueue(at(6));
assert.equal(reopened.status('coda-uno').state, 'conflict', 'Un nuovo salvataggio locale non nasconde il conflitto.');
assert.equal(reopened.summary().conflicts, 1);
// The player keeps the copy of this browser (an explicit replacement that names the revision seen); only then the entry is closed.
saved.set('coda-uno', at(6));
await account.restoreSave(slot, at(6), { expectedRevision: conflict.op.remote.revision });
assert.equal((await onlineCopy(slot, token)).state.game.week.index, 6, 'La copia scelta dal giocatore è online.');
assert.ok(stand.sqlite.prepare("SELECT COUNT(*) AS n FROM save_history WHERE slot = ? AND reason = 'ripristino'").get(slot).n >= 1, 'E la versione sostituita è nella cronologia.');
reopened.resolve('coda-uno');
assert.equal(reopened.status('coda-uno').state, 'synced', 'Risolto dal giocatore, la coda riprende.');

// ---------- 4. a copy without provenance is not sent by itself; a career online with the same name is a conflict ----------
saved.set('coda-due', at(2, 'coda-due'));
reopened.enqueue(at(2, 'coda-due'));
await reopened.flush();
assert.equal(reopened.status('coda-due').state, 'unlinked', 'Una carriera mai collegata non va online da sola.');
assert.equal((await api('/api/saves', { token })).body.saves.some(item => item.slot === 'c-codadue'), false);
reopened.enqueue(at(2, 'coda-due'), { explicit: true });
await reopened.flush();
assert.equal(reopened.status('coda-due').state, 'synced', 'Sul gesto esplicito del giocatore la carriera si collega e va online.');
// A device with no link for a career that exists online (a legacy copy): conflict, never an automatic overwrite.
const legacyDevice = device();
globalThis.localStorage = legacyDevice;
await account.login('coda.uno', 'password-della-coda');
const legacyEngine = makeEngine(legacyDevice);
saved.set('coda-due', at(1, 'coda-due'));
legacyEngine.enqueue(at(1, 'coda-due'), { explicit: true });
await legacyEngine.flush();
conflict = legacyEngine.status('coda-due');
assert.ok(conflict.state === 'conflict' && conflict.op.kind === 'unlinked-remote', 'Una copia legacy di una carriera già online è un conflitto da riconciliare.');
assert.equal((await onlineCopy('c-codadue', token)).state.game.week.index, 2, 'Online resta com’era.');
globalThis.localStorage = storageA;

// ---------- 5. another account never receives what was queued for this one ----------
saved.set('coda-uno', at(7));
reopened.enqueue(at(7));
await account.logout();
reopened.stop();
await account.register('coda.due', 'password-seconda');
const tokenTwo = account.currentAccount().token;
const putsAfterLogout = puts();
await reopened.flush();
assert.equal(puts(), putsAfterLogout, 'Con un altro account non parte nulla.');
assert.equal(reopened.status('coda-uno').state, 'paused', 'La richiesta del primo account resta in sospeso.');
assert.equal((await api('/api/saves', { token: tokenTwo })).body.saves.length, 0, 'Nel secondo account non è arrivata nessuna carriera.');
assert.equal(account.linkOf('coda-uno'), null, 'E la carriera non è collegata al secondo account.');
assert.equal(account.ownerOf('coda-uno'), 'coda.uno');
reopened.enqueue(at(7));   // a queue request made under the second account does not exist for a career that is not linked to it... it is a request of the second account
assert.equal(reopened.read().ops['coda-uno'].username, 'coda.due', 'Una nuova richiesta porta il nome dell’account che l’ha fatta.');
reopened.resolve('coda-uno');
await account.logout();
await account.login('coda.uno', 'password-della-coda');
const tokenOne = account.currentAccount().token;
saved.set('coda-uno', at(8));
reopened.enqueue(at(8));
await reopened.flush();
assert.equal(reopened.status('coda-uno').state, 'synced', 'Rientrato il primo account, la coda riparte dalla versione online.');
assert.equal((await onlineCopy(slot, tokenOne)).state.game.week.index, 8);

// ---------- 6. two tabs: one works on the queue at a time ----------
saved.set('coda-uno', at(9));
const tabOne = makeEngine(storageA), tabTwo = makeEngine(storageA);
tabOne.enqueue(at(9));
const before = puts();
await Promise.all([tabOne.flush(), tabTwo.flush()]);
assert.equal(puts() - before, 1, 'Due schede non caricano due volte la stessa cosa.');
assert.equal((await onlineCopy(slot, tokenOne)).state.game.week.index, 9);
assert.equal(storageA.getItem('politicando.sync.lock.v1'), null, 'Il turno si libera alla fine.');

// ---------- 7. the session ends: the queue stops and says so; what is saved here stays ----------
saved.set('coda-uno', at(10));
tabOne.enqueue(at(10));
stand.sqlite.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1000);
await tabOne.flush();
assert.equal(account.currentAccount(), null, 'La sessione scaduta è chiusa anche qui.');
assert.equal(tabOne.status('coda-uno').state, 'session', 'La coda dice che serve accedere di nuovo.');
await account.login('coda.uno', 'password-della-coda');
await tabOne.flush();
assert.equal(tabOne.status('coda-uno').state, 'synced', 'Dopo il nuovo accesso riprende dalla versione online.');
assert.equal((await onlineCopy(slot, account.currentAccount().token)).state.game.week.index, 10);
// An error that retrying cannot fix (a refusal) is shown and not repeated.
saved.set('coda-uno', { ...at(11), career: { id: 'coda-uno', name: 'x', electionHistory: [] }, clock: { currentDate: 'non-una-data' } });
tabOne.enqueue(saved.get('coda-uno'));
await tabOne.flush();
assert.equal(tabOne.status('coda-uno').state, 'error', 'Un rifiuto definitivo del server è un errore visibile.');
const errorPuts = puts();
clock += 3_600_000;
await tabOne.flush();
assert.equal(puts(), errorPuts, 'E non viene ritentato all’infinito.');
// A queue the browser cannot write down says so: the request is shown as an error ("non registrata"), never as waiting, and it is written again when the storage takes it.
{
  const full = device();
  let refuse = false;
  const refusing = { getItem: key => full.getItem(key), removeItem: key => full.removeItem(key), setItem(key, value) { if (refuse) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' }); full.setItem(key, value); } };
  const engine = makeEngine(refusing);
  saved.set('coda-uno', at(12));
  refuse = true;
  engine.enqueue(at(12));
  const shown = engine.status('coda-uno');
  assert.equal(shown.state, 'error', 'Una richiesta che il browser non riesce a scrivere è un errore, non un’attesa.');
  assert.match(shown.op.error, /non è stata registrata/, 'Con il motivo.');
  assert.ok(engine.summary().errors >= 1 && engine.summary().persistFailure, 'Anche il riepilogo lo dice.');
  refuse = false;
  engine.enqueue(at(12));
  assert.equal(engine.status('coda-uno').state, 'pending', 'Appena il browser la scrive, torna in coda normale.');
  assert.equal(engine.persistFailure(), null);
}
console.log('Coda di sincronizzazione verificata sul Worker reale: richieste scritte nel browser e riprese alla riapertura, attese crescenti senza rete e ripresa alla riconnessione, versione online riletta prima di ogni invio (con conflitto invece di sovrascrittura), copie senza provenienza ferme finché il giocatore non decide, nessun invio sotto un altro account, una sola scheda alla volta, sessione scaduta e rifiuti definitivi mostrati.');
