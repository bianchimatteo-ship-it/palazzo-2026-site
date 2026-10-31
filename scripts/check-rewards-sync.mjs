// The time played of an ACCOUNT, merged across devices by the Worker and kept apart from the saves of the career, and the daily reward that the Worker grants after checking the five minutes of the day it holds.
// Real Worker code (local stand-in of Cloudflare: the same worker.js and an SQLite for D1), real service of the page, one game store shared by the "devices" (each device has its own journal, save and device id; the
// store switches between their saves), and a virtual clock (Date.now is the virtual wall clock, so that minutes pass in an instant).
// Covered: two devices with 3 + 2 minutes reach the five minutes together; two devices open at once do not count a minute twice; a device change after 29 minutes pays the block at the next minute, once; manual save mode
// is never forced and the progress is kept (and comes back on a device with an old save); a career changed during the request of the claim does not lose it (credited to the career that is open, or owed until one is);
// an answer the device never received is recovered. Guests keep the local journal (see check-rewards.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { startCareer } from './lib/long-run.mjs';

const build = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const R = await module('src/core/rewards-engine.js');
const { createStorageLease } = await module('src/core/play-clock.js');
const lines = [];
const MIN = 60000, STEP = 2500;
const memoryStorage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, String(value)); }, removeItem: key => { map.delete(key); } }; };
const settle = async (turns = 12) => { for (let i = 0; i < turns; i++) await new Promise(resolve => setImmediate(resolve)); };

const run = await startCareer({ seed: 'ricompense-sync', level: 'deputato', fast: false });
const { store } = run;
// (after the career starts: the journal of the device must find the browser storage, which is what the devices swap)
const { createRewardsJournal, rewardsJournal } = await module('src/data/repositories/rewards-journal.js');
const { createRewardsService } = await module('src/ui/rewards-service.js');
const { storage } = await module('src/core/storage.js');
const { renderRewardNotice, renderRewardsPage, noticeParts } = await module('src/ui/rewards-page.js');
const rules = await module('src/data/simulation/reward-rules.js');
const { saveSetting } = await module('src/core/settings.js');
const game = () => store.getState().game;
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });
globalThis.location = new URL('http://127.0.0.1:8794/');
const client = await module('src/data/repositories/account-sync.js');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8794 });

// ----- the virtual clock: the Worker reads Date.now() too -----
const realNow = Date.now.bind(Date);
let vt = realNow();
Date.now = () => vt;

let ip = 150;
const register = async username => {
  const proof = await client.passwordProof(username, `password-di-${username}`);
  const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ip}` }, body: JSON.stringify({ username, proof }) }), local.env);
  assert.equal(response.status, 201); return (await response.json()).token;
};
const post = (token, path, body) => local.worker.fetch(new Request(`${local.origin}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }), local.env).then(response => response.json());
const day = () => R.romeDay(vt);
const serverMs = (userName, scope) => local.sqlite.prepare('SELECT total_ms AS ms FROM reward_time WHERE user_id = (SELECT id FROM users WHERE username = ?) AND scope = ?').get(userName, scope)?.ms ?? 0;
const claimRows = userName => local.sqlite.prepare('SELECT COUNT(*) AS n FROM reward_claims WHERE user_id = (SELECT id FROM users WHERE username = ?)').get(userName).n;

// ----- the devices: a journal, a save and a service of their own; the shared store switches between them -----
const JOURNAL_KEY = 'politicando.rewards.v1';
const base = JSON.parse(store.exportSave());
const careerId = store.getState().career.id;
let active = null;
const devices = {};
function makeDevice(name, userName, token, extra = {}) {
  const device = { name, save: structuredClone(base), raw: null, journal: extra.journal ?? createRewardsJournal(memoryStorage()), env: { t: 0, playing: true } };
  device.service = createRewardsService({
    store, journal: device.journal, username: () => userName,
    claimDaily: extra.claim ?? ((career, id) => post(token, '/api/account/rewards/daily', { careerId: career, device: id })),
    syncTime: extra.sync ?? (body => post(token, '/api/account/rewards/time', body)),
    claimBlocks: body => post(token, '/api/account/rewards/blocks', body),
    env: { now: () => device.env.t, wall: () => vt, visible: () => true, playing: () => device.env.playing, lease: createStorageLease(memoryStorage(), { tabId: name, wall: () => vt }), storage: memoryStorage() }
  });
  devices[name] = device; return device;
}
function activate(name) {
  if (active === name) return devices[name];
  if (active) { const was = devices[active]; was.save = JSON.parse(store.exportSave()); was.raw = localStorage.getItem(JOURNAL_KEY); was.service.unlisten(); }
  active = name;
  const device = devices[name];
  rewardsJournal.clear(); if (device.raw) localStorage.setItem(JOURNAL_KEY, device.raw);
  device.service.listen();
  store.loadGame(structuredClone(device.save));
  return device;
}
// plays `seconds` of virtual time on a device (the first tick only starts the count); the Worker is reached by the service itself
async function play(name, seconds) {
  const device = activate(name);
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP / 1000) { vt += STEP; device.env.t += STEP; device.service.tick(); await settle(3); await device.service.idle(); }
  await device.service.sync(); await device.service.sync(); await settle();
  return device;
}
const funds = () => game().resources.funds;

// ============ 1. two devices, 3 and 2 minutes: together they reach the five minutes of the day ============
{
  const token = await register('tempo.uno');
  const A = makeDevice('A1', 'tempo.uno', token), B = makeDevice('B1', 'tempo.uno', token);
  await play('A1', 1); // starts the count
  await play('A1', 180);
  assert.ok(Math.abs(serverMs('tempo.uno', `d:${day()}`) - 180000) <= 3000, `Il servizio ha i 3 minuti del primo dispositivo (${serverMs('tempo.uno', `d:${day()}`)}).`);
  const fundsA = funds();
  vt += 10 * 1000; // the second device is opened a little later
  await play('B1', 1);
  await play('B1', 110);
  const mid = serverMs('tempo.uno', `d:${day()}`);
  assert.ok(mid >= 285000 && mid < 300000, `3 minuti + 1:50 = poco meno di 5 minuti (${mid}).`);
  const fundsB = funds();
  assert.equal(fundsB, fundsA, 'Prima dei cinque minuti sommati nessuna ricompensa.'); assert.equal(claimRows('tempo.uno'), 0);
  await play('B1', 25);
  assert.equal(funds(), fundsB + 500, 'Con i minuti dei due dispositivi la soglia è raggiunta: +500 € sul secondo.');
  assert.equal(claimRows('tempo.uno'), 1, 'Una sola riga nel servizio.');
  const total = serverMs('tempo.uno', `d:${day()}`); assert.ok(total >= 300000 && total <= 340000, `Il totale del giorno è la somma dei due (${total}).`);
  await play('A1', 10);
  assert.equal(funds(), fundsA, 'Il primo dispositivo, che ha i suoi minuti ma ha perso la corsa, non riscuote di nuovo.');
  assert.equal(A.journal.daily(A.journal.scope('tempo.uno'), day()).state, 'claimed-elsewhere');
  assert.equal(B.journal.daily(B.journal.scope('tempo.uno'), day()).state, 'claimed');
  lines.push('3 + 2 minuti su due dispositivi raggiungono insieme la soglia (il servizio somma, +500 € una volta sola, l’altro dispositivo non riscuote)');
}

// ============ 2. two devices open together: the same minute is counted once ============
{
  const token = await register('tempo.due');
  makeDevice('A2', 'tempo.due', token); makeDevice('B2', 'tempo.due', token);
  const start = vt;
  await play('A2', 1); const afterStartA = vt;
  await play('A2', 240);
  const end = vt;
  vt = afterStartA; // the other device was open during the same four minutes
  await play('B2', 1);
  vt = afterStartA; await play('B2', 240);
  vt = end;
  await devices.A2.service.sync(); await settle();
  const dayMs = serverMs('tempo.due', `d:${day()}`), careerMs = serverMs('tempo.due', `c:${careerId}`);
  assert.ok(dayMs >= 235000 && dayMs <= 250000, `Due dispositivi aperti insieme per gli stessi 4 minuti: il giorno ne conta 4, non 8 (${dayMs}).`);
  assert.ok(careerMs >= 235000 && careerMs <= 250000, `E la carriera ugualmente (${careerMs}).`);
  assert.equal(claimRows('tempo.due'), 0, '4 minuti non bastano.');
  // the same batch sent twice (a repeated request) counts once
  const span = [{ q: 0, c: careerId, s: vt - 90000, e: vt - 30000 }];
  const before = serverMs('tempo.due', `d:${day()}`);
  const first = await post(token, '/api/account/rewards/time', { device: 'x', now: vt, spans: span }); const second = await post(token, '/api/account/rewards/time', { device: 'x', now: vt, spans: span });
  assert.deepEqual([first.acked, second.acked], [[0], [0]], 'La seconda richiesta riceve di nuovo la conferma.');
  assert.ok(serverMs('tempo.due', `d:${day()}`) - before <= 60000, 'Lo stesso intervallo ripetuto non conta due volte.');
  assert.ok(start <= afterStartA);
  lines.push('due dispositivi aperti insieme non contano due volte lo stesso minuto, né nel giorno né nella carriera; una richiesta ripetuta nemmeno');
}

// ============ 3. device change after 29 minutes: the next minute pays the right block, once ============
{
  const token = await register('tempo.tre');
  makeDevice('A3', 'tempo.tre', token); makeDevice('B3', 'tempo.tre', token);
  game().resources.politicalCapital = 20;
  base.game.resources.politicalCapital = 20; for (const name of ['A3', 'B3']) devices[name].save = structuredClone(base);
  await play('A3', 1); await play('A3', 29 * 60);
  const capitalA = game().resources.politicalCapital;
  assert.equal(capitalA, 20, 'A 29 minuti il primo dispositivo non ha ancora nulla.'); assert.ok(Math.abs(serverMs('tempo.tre', `c:${careerId}`) - 29 * MIN) <= 5000);
  vt += 5 * 1000;
  await play('B3', 1);
  const start = game().rewards.playMs;
  assert.ok(Math.abs(start - 29 * MIN) <= 6000, `Il secondo dispositivo, appena aperto, riprende i 29 minuti dal servizio (${start}).`);
  assert.equal(game().resources.politicalCapital, 20, 'Aprirlo non dà nulla.');
  await play('B3', 90);
  assert.equal(game().resources.politicalCapital, 24, 'Dopo il minuto successivo il blocco da 30 minuti paga +4, ai 30 minuti totali.');
  assert.equal(game().rewards.paidCapital, 1, 'Un solo blocco.'); assert.equal(R.rewardHistory(game()).filter(item => item.kind === 'capitale').length, 1);
  await play('B3', 60); assert.equal(game().resources.politicalCapital, 24, 'E non una seconda volta.');
  // the first device catches up with the time played on the other
  await play('A3', 5);
  assert.ok(game().rewards.playMs >= 31 * MIN, 'Tornando sul primo dispositivo il tempo giocato sul secondo c’è.');
  lines.push('dopo 29 minuti su un dispositivo, il minuto successivo sull’altro assegna il blocco da 30 minuti una volta sola');
}

// ============ 4. manual save: nothing is forced, the progress is kept ============
{
  const token = await register('tempo.quattro');
  makeDevice('A4', 'tempo.quattro', token);
  saveSetting('autosave', 'manual');
  await play('A4', 1);
  const writes = []; const original = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key, value) => { if (String(key).startsWith('palazzo-2026.career.v1')) writes.push(key); return original(key, value); };
  const savedBefore = JSON.stringify(storage.load()?.game?.rewards ?? null);
  await play('A4', 200);
  localStorage.setItem = original;
  assert.deepEqual(writes, [], 'Con il salvataggio manuale il tempo di gioco e la sincronizzazione non scrivono la partita.');
  assert.equal(JSON.stringify(storage.load()?.game?.rewards ?? null), savedBefore, 'La partita salvata è com’era.');
  const played = game().rewards.playMs; assert.ok(played >= 195000);
  assert.ok(serverMs('tempo.quattro', `c:${careerId}`) >= 195000, 'Il progresso è comunque al sicuro nel servizio.');
  // the page is closed without saving and the device has lost its own journal too: an old save comes back, the account gives the time back
  const old = devices.A4.save; old.game.rewards = { ...(old.game.rewards ?? {}), playMs: 0, paidCapital: 0, paidPrep: 0 };
  rewardsJournal.clear(); store.loadGame(structuredClone(old));
  assert.equal(game().rewards.playMs, 0);
  await devices.A4.service.sync(); await settle();
  assert.ok(game().rewards.playMs >= 195000, 'Il tempo giocato torna dal servizio, anche con un salvataggio vecchio.');
  saveSetting('autosave', 'action');
  lines.push('salvataggio manuale: nessuna scrittura forzata dal timer né dalla sincronizzazione, progresso conservato nel servizio e recuperato con un salvataggio vecchio');
}

// ============ 5. the claim and the changes of career / answers lost ============
{
  const token = await register('tempo.cinque');
  const other = structuredClone(base); other.career.id = 'altra-carriera-cinque'; other.saveMeta = { ...(other.saveMeta ?? {}), careerId: 'altra-carriera-cinque' }; delete other.game.rewards;
  // (a) the career changes while the claim is on its way: the reward lands on the career that is open when the answer arrives, once
  let swap = null;
  const D = makeDevice('A5', 'tempo.cinque', token, { claim: async (career, id) => { const answer = await post(token, '/api/account/rewards/daily', { careerId: career, device: id }); if (swap) swap(); return answer; } });
  await play('A5', 1);
  let moved = false; swap = () => { if (moved) return; moved = true; store.loadGame(structuredClone(other)); };
  const startFunds = funds();
  await play('A5', 310);
  assert.equal(moved, true, 'La carriera è cambiata durante la richiesta.');
  assert.equal(store.getState().career.id, 'altra-carriera-cinque');
  assert.equal(funds(), startFunds + 500, 'La ricompensa è stata accreditata alla carriera aperta quando è arrivata la risposta: non consumata senza accredito.');
  assert.equal(game().finance.ledger.filter(item => item.category === 'ricompense').length, 1);
  assert.equal(D.journal.daily(D.journal.scope('tempo.cinque'), day()).state, 'claimed'); assert.equal(claimRows('tempo.cinque'), 1);
  await play('A5', 60); assert.equal(game().finance.ledger.filter(item => item.category === 'ricompense').length, 1, 'E una volta sola.');

  // (b) the answer arrives while no career is playing: the reward is owed, and paid at the first moment a career plays
  const token2 = await register('tempo.cinque.b');
  let hold = null;
  const E = makeDevice('E5', 'tempo.cinque.b', token2, { claim: async (career, id) => { const answer = await post(token2, '/api/account/rewards/daily', { careerId: career, device: id }); if (hold) hold(); return answer; } });
  await play('E5', 1);
  hold = () => { E.env.playing = false; };
  const fundsE = funds();
  await play('E5', 310);
  const keyE = E.journal.scope('tempo.cinque.b');
  assert.equal(E.journal.daily(keyE, day()).state, 'owed', 'Senza una carriera in gioco la ricompensa resta dovuta.'); assert.equal(funds(), fundsE);
  assert.equal(claimRows('tempo.cinque.b'), 1);
  hold = null; E.env.playing = true; await play('E5', 10);
  assert.equal(funds(), fundsE + 500, 'Appena una carriera gioca, la ricompensa dovuta arriva.'); assert.equal(E.journal.daily(keyE, day()).state, 'claimed');
  await play('E5', 20); assert.equal(funds(), fundsE + 500, 'Una volta sola.');

  // (c) the Worker gave the claim to this device but the answer was lost: the next request says «mine» and the reward is credited, not lost
  const token3 = await register('tempo.cinque.c');
  const F = makeDevice('F5', 'tempo.cinque.c', token3);
  await play('F5', 1);
  await play('F5', 280); // 4:40: not yet
  assert.equal(claimRows('tempo.cinque.c'), 0);
  const lost = F.service; // the real request is made, its answer is dropped
  let drop = true;
  F.service = createRewardsService({ store, journal: F.journal, username: () => 'tempo.cinque.c', claimDaily: async (career, id) => { const answer = await post(token3, '/api/account/rewards/daily', { careerId: career, device: id }); if (drop) throw Object.assign(new Error('rete'), { code: 'offline' }); return answer; }, syncTime: body => post(token3, '/api/account/rewards/time', body),
    env: { now: () => F.env.t, wall: () => vt, visible: () => true, playing: () => true, lease: createStorageLease(memoryStorage(), { tabId: 'F5b', wall: () => vt }), storage: memoryStorage() } });
  assert.ok(lost);
  const fundsF = funds();
  await play('F5', 40);
  assert.equal(claimRows('tempo.cinque.c'), 1, 'Il servizio ha dato la ricompensa a questo dispositivo.'); assert.equal(funds(), fundsF, 'Ma la risposta non è arrivata: nulla è stato accreditato.');
  assert.equal(F.journal.daily(F.journal.scope('tempo.cinque.c'), day()).state, 'pending');
  drop = false; vt += 40000; await play('F5', 5);
  assert.equal(funds(), fundsF + 500, 'Alla richiesta successiva il servizio dice che la ricompensa era di questo dispositivo: viene accreditata, non persa.');
  assert.equal(game().finance.ledger.filter(item => item.category === 'ricompense').length, 1);
  lines.push('riscossione: cambio carriera durante la richiesta (accreditata alla carriera aperta), risposta con nessuna carriera in gioco (dovuta e poi pagata), risposta persa (recuperata)');
}

// ============ 7. the delivery of the time: chunks, acknowledgement, retries, limits ============
const sendRaw = (token, body) => post(token, '/api/account/rewards/time', body);
const countingSync = (token, log, { fail = () => false, dropAnswer = () => false } = {}) => async body => {
  log.push(body.spans.length);
  if (fail(log.length)) throw Object.assign(new Error('rete assente'), { code: 'offline' });
  const answer = await sendRaw(token, body);
  if (dropAnswer(log.length)) throw Object.assign(new Error('risposta persa'), { code: 'offline' });
  return answer;
};
const HOUR = 3600000;
{
  // 51 and more spans: 120 spans go out in chunks of 50 and every one is acknowledged
  const token = await register('invio.uno'); const log = [];
  const D = makeDevice('C1', 'invio.uno', token, { sync: countingSync(token, log) }); activate('C1');
  const key = D.journal.scope('invio.uno');
  for (let i = 119; i >= 0; i--) D.journal.queueAdd(key, careerId, vt - HOUR - i * 120000 - 60000, vt - HOUR - i * 120000);
  assert.equal(D.journal.queued(key).length, 120);
  await D.service.sync();
  assert.deepEqual(log, [50, 50, 20], 'Cento venti intervalli partono in tre richieste da 50, 50 e 20: nessuno resta indietro (il 51° compreso).');
  assert.equal(D.journal.queued(key).length, 0, 'Tutti confermati: la coda è vuota.');
  assert.equal(serverMs('invio.uno', `c:${careerId}`), 120 * 60000, 'Il servizio ha tutti i 120 minuti.');
  // more than 400 spans on the device: none is dropped (the old local cap was 400)
  const many = await register('invio.due'); const log2 = [];
  const E = makeDevice('C2', 'invio.due', many, { sync: countingSync(many, log2) }); activate('C2');
  const key2 = E.journal.scope('invio.due');
  for (let i = 449; i >= 0; i--) E.journal.queueAdd(key2, careerId, vt - 3 * HOUR - i * 90000 - 30000, vt - 3 * HOUR - i * 90000);
  assert.equal(E.journal.queued(key2).length, 450, 'Oltre 400 intervalli in coda: nessuno scartato in silenzio.');
  await E.service.sync();
  assert.equal(log2.length, 9); assert.ok(log2.every(count => count <= 50) && log2.reduce((a, b) => a + b, 0) === 450);
  assert.equal(E.journal.queued(key2).length, 0); assert.equal(serverMs('invio.due', `c:${careerId}`), 450 * 30000, 'E il servizio li ha tutti: 450 intervalli da 30 secondi.');
  assert.equal(E.journal.lost(key2).ms, 0, 'Niente è stato perso.');
  lines.push('51+ e oltre 400 intervalli: invio a blocchi da 50, ogni intervallo confermato, nessuno perso');
}
{
  // the 24 hours of one request: what does not fit is NOT acknowledged and stays; it goes in the next requests, and nothing is lost
  const token = await register('invio.tre');
  const spans = Array.from({ length: 50 }, (_, i) => ({ q: i, c: careerId, s: vt - 300 * HOUR + i * 5.9 * HOUR, e: vt - 300 * HOUR + (i + 1) * 5.9 * HOUR }));
  const first = await sendRaw(token, { device: 'lungo', now: vt, spans });
  assert.deepEqual(first.acked, [0, 1, 2, 3], 'Una richiesta accetta al massimo 24 ore di tempo: i primi 4 intervalli da 5,9 ore.');
  assert.deepEqual(first.rejected, [], 'Gli altri non sono rifiutati: restano al dispositivo, non sono confermati.');
  assert.ok(Math.abs(serverMs('invio.tre', `c:${careerId}`) - 4 * 5.9 * HOUR) < 5, 'Il servizio ne ha contati solo 4.');
  // through the service every span ends up delivered
  const D = makeDevice('C3', 'invio.tre', token); activate('C3');
  const key = D.journal.scope('invio.tre');
  for (const span of spans.slice(4)) D.journal.queueAdd(key, careerId, span.s, span.e);
  D.journal.queueAdd(key, careerId, vt - 1000 - 6 * HOUR, vt - 1000);                    // (a span inside the window as well)
  await D.service.sync();
  assert.equal(D.journal.queued(key).length, 0, 'Tutto consegnato a più richieste.');
  assert.ok(Math.abs(serverMs('invio.tre', `c:${careerId}`) - (300 * HOUR - 1000)) < 2000, 'Il totale è l’unione di tutto (300 ore meno un secondo: la catena di 295 ore più l’ultimo intervallo, che la sovrappone in parte).');
  lines.push('oltre 24 ore per richiesta: gli intervalli che non entrano restano non confermati e arrivano nelle richieste successive');
}
{
  // after 72 hours: still accepted (the window is 30 days); older or impossible spans are refused WITH a reason and written to the log of what was lost
  const token = await register('invio.quattro');
  const D = makeDevice('C4', 'invio.quattro', token); activate('C4');
  const key = D.journal.scope('invio.quattro');
  D.journal.queueAdd(key, careerId, vt - 20 * 24 * HOUR - 60000, vt - 20 * 24 * HOUR);   // 20 days old: accepted
  D.journal.queueAdd(key, careerId, vt - 4 * 24 * HOUR - 60000, vt - 4 * 24 * HOUR);     // 4 days old (the old 72-hour limit): accepted
  D.journal.queueAdd(key, careerId, vt - 40 * 24 * HOUR - 60000, vt - 40 * 24 * HOUR);   // 40 days old: expired
  D.journal.queueAdd(key, careerId, vt - 12 * HOUR, vt - 12 * HOUR + 7 * HOUR);          // 7 hours in one piece: not a span of play
  await D.service.sync();
  assert.equal(D.journal.queued(key).length, 0, 'Nessun intervallo resta in coda.');
  assert.equal(serverMs('invio.quattro', `c:${careerId}`), 120000, 'Contati i due intervalli oltre le 72 ore ma entro 30 giorni.');
  const lost = D.journal.lost(key);
  assert.deepEqual(lost.log.map(item => item.reason).sort(), ['expired', 'invalid'], 'Gli altri due sono nel registro di ciò che non è stato registrato, con il motivo.');
  assert.equal(lost.ms, 60000 + 7 * HOUR); assert.equal(D.service.snapshot().lost.ms, lost.ms, 'E la pagina può dirlo.');
  lines.push('oltre 72 ore: intervalli fino a 30 giorni accettati, gli altri rifiutati con motivo e scritti nel registro delle perdite');
}
{
  // errors of the network, answers lost, retries, a refresh in the middle
  const token = await register('invio.cinque'); const log = [];
  let failUntil = 2;
  const D = makeDevice('C5', 'invio.cinque', token, { sync: countingSync(token, log, { fail: n => n <= failUntil }) }); activate('C5');
  const key = D.journal.scope('invio.cinque');
  for (let i = 0; i < 5; i++) D.journal.queueAdd(key, careerId, vt - 20 * 60000 - i * 120000 - 60000, vt - 20 * 60000 - i * 120000);
  assert.equal(await D.service.sync(), false); assert.equal(await D.service.sync(), false);
  assert.equal(D.journal.queued(key).length, 5, 'Gli errori di rete non fanno perdere nulla: gli intervalli restano in coda.');
  assert.equal(serverMs('invio.cinque', `c:${careerId}`), 0);
  // a span already sent is not changed again: the time that follows goes into a new one
  const sent = D.journal.queued(key).at(-1); D.journal.queueAdd(key, careerId, sent.e + 500, sent.e + 5000);
  assert.equal(D.journal.queued(key).length, 6, 'Un intervallo già inviato non si allunga: il tempo successivo ne apre uno nuovo.');
  assert.equal(await D.service.sync(), true); assert.equal(D.journal.queued(key).length, 0);
  assert.equal(serverMs('invio.cinque', `c:${careerId}`), 5 * 60000 + 4500);
  // the answer is lost after the Worker applied the spans: the retry is recognised, counted once
  const token2 = await register('invio.sei'); const log2 = [];
  let drop = true;
  const E = makeDevice('C6', 'invio.sei', token2, { sync: countingSync(token2, log2, { dropAnswer: () => drop }) }); activate('C6');
  const key2 = E.journal.scope('invio.sei');
  for (let i = 0; i < 3; i++) E.journal.queueAdd(key2, careerId, vt - 10 * 60000 - i * 120000 - 60000, vt - 10 * 60000 - i * 120000);
  assert.equal(await E.service.sync(), false); assert.equal(E.journal.queued(key2).length, 3);
  assert.equal(serverMs('invio.sei', `c:${careerId}`), 180000, 'Il servizio aveva già applicato.');
  drop = false; vt += 7000;                                                    // (a retry a few seconds later: the clocks have moved)
  assert.equal(await E.service.sync(), true); assert.equal(E.journal.queued(key2).length, 0);
  assert.equal(serverMs('invio.sei', `c:${careerId}`), 180000, 'Con la risposta persa il tentativo successivo non conta due volte.');
  // a refresh: the queue is in the storage of the device and is sent by the page that starts next
  const token3 = await register('invio.sette');
  const shared = memoryStorage(); const before = createRewardsJournal(shared);
  const keyR = before.scope('invio.sette');
  for (let i = 0; i < 4; i++) before.queueAdd(keyR, careerId, vt - 30 * 60000 - i * 120000 - 60000, vt - 30 * 60000 - i * 120000);
  const F = makeDevice('C7', 'invio.sette', token3, {}); F.journal.queueRestoreForTest = null;
  const after = createRewardsJournal(shared);
  assert.deepEqual(after.queued(keyR), before.queued(keyR), 'Dopo un ricaricamento la coda c’è ancora, identica.');
  const reloaded = createRewardsService({ store, journal: after, username: () => 'invio.sette', syncTime: body => sendRaw(token3, body), env: { now: () => 0, wall: () => vt, visible: () => true, playing: () => true, lease: createStorageLease(memoryStorage(), { tabId: 'R', wall: () => vt }), storage: memoryStorage() } });
  activate('C7'); await reloaded.sync();
  assert.equal(after.queued(keyR).length, 0); assert.equal(serverMs('invio.sette', `c:${careerId}`), 4 * 60000, 'La pagina che riparte consegna ciò che il ricaricamento aveva lasciato.');
  // a busy or failing Worker (no ok) keeps everything as well
  const G = makeDevice('C8', 'invio.sette', token3, { sync: async () => ({ error: 'occupato', code: 'busy' }) }); activate('C8');
  G.journal.queueAdd(G.journal.scope('invio.sette'), careerId, vt - 60000, vt - 30000);
  assert.equal(await G.service.sync(), false); assert.equal(G.journal.queued(G.journal.scope('invio.sette')).length, 1);
  lines.push('errori di rete, risposta persa, ricaricamento e Worker occupato: la coda si conserva, il nuovo invio non conta due volte');
}
{
  // out of order, overlaps, repeated requests, simultaneous requests from different devices
  const token = await register('invio.otto');
  const at = (minutes, length) => ({ s: vt - minutes * 60000, e: vt - minutes * 60000 + length * 1000 });
  const send = (device, list) => sendRaw(token, { device, now: vt, spans: list.map(item => ({ c: careerId, ...item })) });
  const r1 = await send('oo', [{ q: 5, ...at(30, 60) }]);                      // the later one arrives first
  const r2 = await send('oo', [{ q: 2, ...at(40, 60) }, { q: 5, ...at(30, 60) }]);   // then an earlier one, and the first one again
  assert.deepEqual([r1.acked, [...r2.acked].sort()], [[5], [2, 5]], 'Fuori ordine: ogni intervallo è confermato, anche quello ripetuto.');
  assert.equal(serverMs('invio.otto', `c:${careerId}`), 120000, 'Il ripetuto non conta due volte.');
  const r3 = await send('oo', [{ q: 9, s: vt - 30 * 60000 + 30000, e: vt - 30 * 60000 + 90000 }]);   // overlaps the half of q 5
  assert.deepEqual(r3.acked, [9]); assert.equal(serverMs('invio.otto', `c:${careerId}`), 150000, 'Un intervallo sovrapposto conta solo la parte nuova.');
  const r4 = await send('oo2', [{ q: 5, ...at(50, 60) }]);                           // another device may use the same numbers
  assert.deepEqual(r4.acked, [5]); assert.equal(serverMs('invio.otto', `c:${careerId}`), 210000, 'Ogni dispositivo ha i suoi numeri.');
  // twelve requests at once from two devices: every span is applied, none is lost to a race
  const token2 = await register('invio.nove');
  const answers = await Promise.all(Array.from({ length: 12 }, (_, i) => sendRaw(token2, { device: `par${i % 2}`, now: vt, spans: [{ q: Math.floor(i / 2), c: careerId, s: vt - (i + 1) * 600000, e: vt - (i + 1) * 600000 + 60000 }] })));
  assert.ok(answers.every(answer => answer.ok && answer.acked.length === 1), 'Richieste simultanee: tutte confermate.');
  assert.equal(serverMs('invio.nove', `c:${careerId}`), 12 * 60000, 'Nessun intervallo perso per la concorrenza.');
  lines.push('invii fuori ordine, ripetuti, sovrapposti e simultanei da più dispositivi: unione esatta, nessun doppio conteggio');
}

// ============ 8. the blocks of 30 and 60 minutes are authoritative and idempotent ============
{
  const token = await register('blocchi.uno');
  const A = makeDevice('A9', 'blocchi.uno', token), B = makeDevice('B9', 'blocchi.uno', token);
  for (const name of ['A9', 'B9']) { const save = structuredClone(base); save.game.resources.politicalCapital = 20; save.game.rewards = { playMs: 0, paidCapital: 0, paidPrep: 0, daily: [], ads: [], history: [] }; devices[name].save = save; }
  await play('A9', 1); const startA = vt;
  await play('A9', 31 * 60);
  const capitalA = game().resources.politicalCapital;
  assert.equal(capitalA, 24, 'Il primo dispositivo ha il blocco da 30 minuti: +4.');
  assert.equal(A.journal.blocks(A.journal.scope('blocchi.uno')).length, 0, 'E la conferma al servizio è partita.');
  vt = startA;                                                      // the second copy of the same career was open during the same 31 minutes
  await play('B9', 1); vt = startA; await play('B9', 31 * 60);
  const capitalB = game().resources.politicalCapital;
  assert.equal(capitalB, 24, 'La seconda copia, aperta nello stesso tempo, ha il blocco una volta sola (+4, non +8).');
  assert.equal(game().rewards.paidCapital, 1); assert.equal(R.rewardHistory(game()).filter(item => item.kind === 'capitale').length, 1);
  const rows = local.sqlite.prepare("SELECT kind, block, device_id AS device FROM reward_blocks WHERE user_id = (SELECT id FROM users WHERE username = 'blocchi.uno')").all();
  assert.equal(rows.length, 1, 'Il servizio registra il blocco una volta sola per account e carriera.');
  assert.deepEqual([rows[0].kind, rows[0].block, rows[0].device], ['capitale', 1, A.journal.deviceId()], 'Il primo a chiedere è il primo dispositivo.');
  assert.equal(B.journal.blocks(B.journal.scope('blocchi.uno')).length, 0, 'Anche la seconda copia ha avuto la risposta («già registrato»).');
  assert.equal(game().rewards.playMs >= 31 * MIN && game().rewards.playMs < 32 * MIN, true);
  // the Worker decides what is due: a block the merged time has not reached is refused, a repeated claim is the same claim
  const claim = (device, claims) => post(token, '/api/account/rewards/blocks', { careerId, device, claims });
  const answer = await claim('qualcuno', [{ kind: 'capitale', n: 1 }, { kind: 'capitale', n: 5 }, { kind: 'preparazione', n: 1 }, { kind: 'sconosciuto', n: 1 }]);
  assert.deepEqual(answer.results.map(item => item.status), ['recorded', 'short', 'short', 'invalid'], 'Un blocco non raggiunto dal tempo unito è rifiutato; uno registrato è «registrato».');
  assert.equal((await claim(A.journal.deviceId(), [{ kind: 'capitale', n: 1 }])).results[0].mine, true);
  // loading the same save twice does not credit again (the counters of the game are the idempotency)
  const again = JSON.parse(store.exportSave()); store.loadGame(structuredClone(again)); store.loadGame(structuredClone(again));
  assert.equal(game().resources.politicalCapital, 24, 'Ricaricare la stessa partita non rifà il blocco.');
  lines.push('blocchi da 30/60 minuti: copie della stessa carriera aperte insieme ricevono il blocco una volta ciascuna, il servizio ne registra uno solo e rifiuta i blocchi non raggiunti');
}

// ============ 9. the notices: a popup for every credit, queued, with real amounts ============
{
  const noticeStorage = memoryStorage();
  const D = makeDevice('N1', null, null, { journal: createRewardsJournal(noticeStorage) }); activate('N1');
  const key = D.journal.scope(null);
  game().resources.politicalCapital = 98; game().prep = 100;
  store.addPlayTime(60 * MIN);                                    // two blocks of capital (+4 → 100, then 0) and one of preparation (already 100)
  let list = D.service.notices();
  assert.equal(list.length, 3, 'Tre crediti, tre avvisi in coda: nessuno ne sovrascrive un altro.');
  assert.deepEqual(list.map(item => [item.kind, item.amount]), [['capitale', 2], ['capitale', 0], ['preparazione', 0]], 'Importi realmente accreditati, nel rispetto del limite 100.');
  const parts = list.map(noticeParts);
  assert.equal(parts[0].title, '+2 Capitale politico'); assert.equal(parts[0].reason, 'Hai raggiunto 30 minuti di gioco'); assert.equal(parts[0].gained, true);
  assert.deepEqual([parts[1].gained, parts[2].gained], [false, false], 'Importo zero: nessun premio positivo dichiarato.');
  assert.equal(parts[1].title, 'Capitale politico già al massimo'); assert.ok(!/\+/.test(parts[1].title + parts[1].reason), 'Né «+» né «hai ricevuto» quando non è arrivato nulla.');
  assert.match(parts[1].reason, /nessun punto aggiunto, il limite è 100/);
  const popup = renderRewardNotice(list[0], list.length);
  assert.match(popup, /role="dialog"/); assert.match(popup, /data-reward-notice-dismiss/); assert.match(popup, /Premio 1 di 3/); assert.match(popup, /\+2 Capitale politico/); assert.match(popup, /Hai raggiunto 30 minuti di gioco/);
  // a refresh does not lose them
  const reopened = createRewardsJournal(noticeStorage); assert.equal(reopened.notices().length, 3, 'Gli avvisi restano finché il giocatore non li chiude (anche dopo un ricaricamento).');
  D.service.dismissNotice(list[0].id); assert.deepEqual(D.service.notices().map(item => item.id), [list[1].id, list[2].id], 'Chiuso il primo si vede il successivo.');
  // a duplicate credit makes no second notice, and the daily and the community ones come with the right words
  const before = D.service.notices().length;
  const entry = store.creditDailyReward({ id: 'giornaliera-prova-1', day: R.romeDay(vt) }); assert.ok(entry);
  assert.equal(store.creditDailyReward({ id: 'giornaliera-prova-1', day: R.romeDay(vt) }), null, 'Lo stesso id non si accredita due volte.');
  const daily = D.service.notices().at(-1); assert.equal(D.service.notices().length, before + 1, 'Un solo avviso per un accredito duplicato.');
  assert.deepEqual([noticeParts(daily).title, noticeParts(daily).reason], ['+500 €', 'Hai giocato almeno 5 minuti oggi']);
  for (const item of D.service.notices()) D.service.dismissNotice(item.id);
  assert.equal(D.service.notices().length, 0);
  lines.push('avvisi: coda senza sovrascritture, importi reali con il limite 100, nessun premio positivo a importo zero, persistenti e chiudibili uno a uno, nessun doppione');
}

// ============ 10. the community reward (Instagram): off by default, then a self-declaration, once, recoverable ============
{
  assert.equal(rules.COMMUNITY_REWARD.instagram.enabled, false, 'Per scelta è spenta finché le regole della piattaforma non sono verificate.');
  const calls = []; const realFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => { calls.push(String(args[0])); return realFetch(...args); };
  const off = makeDevice('I0', null, null, {}); activate('I0');
  game().resources.politicalCapital = 50;
  assert.equal((await off.service.claimCommunity('instagram')).reason, 'non-attiva'); assert.equal(off.service.snapshot().community.instagram.enabled, false);
  assert.equal(off.service.visitCommunity('instagram'), false);

  // a guest: once for this device
  const mk = (name, userName, token, extra = {}) => { const d = makeDevice(name, userName, token, extra); return d; };
  const G = mk('I1', null, null, {}); G.service = createRewardsService({ store, journal: G.journal, username: () => null, community: { instagram: true }, env: { now: () => 0, wall: () => vt, visible: () => true, playing: () => true, lease: createStorageLease(memoryStorage(), { tabId: 'I1', wall: () => vt }), storage: memoryStorage() } });
  activate('I1');
  game().resources.politicalCapital = 98;
  const fundsBefore = game().resources.funds, incomeBefore = game().finance.current.income;
  assert.equal((await G.service.claimCommunity('instagram')).reason, 'non-visitato', 'Senza aver aperto il profilo non si riscuote.');
  assert.equal(G.service.visitCommunity('instagram'), true);
  assert.equal(G.service.snapshot().community.instagram.state, 'visited');
  const done = await G.service.claimCommunity('instagram');
  assert.equal(done.ok, true);
  assert.equal(game().resources.funds, fundsBefore + 1500, '+1.500 € ai fondi personali.');
  assert.equal(game().finance.current.income, incomeBefore + 1500); assert.equal(game().finance.ledger[0].category, 'ricompense'); assert.equal(game().finance.ledger[0].label, 'Community Instagram', 'Nel registro finanziario.');
  assert.equal(game().resources.politicalCapital, 100, 'Il capitale politico rispetta il tetto: 98 + 5 = 100.');
  const entries = R.rewardHistory(game()).filter(item => item.kind === 'community');
  assert.deepEqual(entries.map(item => [item.resource, item.requested, item.amount]).sort(), [['Capitale politico', 5, 2], ['Fondi personali', 1500, 1500]], 'Nello storico gli importi effettivi (richiesto 5, ricevuti 2).');
  const notes = G.service.notices().filter(item => item.kind === 'community');
  assert.equal(notes.length, 2); assert.deepEqual(noticeParts(notes.find(item => item.resource === 'Capitale politico')).title, '+2 Capitale politico');
  assert.equal((await G.service.claimCommunity('instagram')).reason, 'già-riscossa'); assert.equal(game().resources.funds, fundsBefore + 1500, 'Una volta sola.');
  // refresh: the state is in the journal; and another career on the same device gets nothing more
  const reopened = createRewardsService({ store, journal: G.journal, username: () => null, community: { instagram: true }, env: { now: () => 0, wall: () => vt, visible: () => true, playing: () => true, lease: createStorageLease(memoryStorage(), { tabId: 'I1b', wall: () => vt }), storage: memoryStorage() } });
  assert.equal(reopened.snapshot().community.instagram.state, 'claimed'); assert.equal((await reopened.claimCommunity('instagram')).reason, 'già-riscossa');
  const other = JSON.parse(store.exportSave()); other.career.id = 'altra-carriera-instagram'; other.saveMeta = { ...(other.saveMeta ?? {}), careerId: 'altra-carriera-instagram' }; delete other.game.rewards;
  store.loadGame(other); const fundsOther = game().resources.funds; assert.equal((await reopened.claimCommunity('instagram')).reason, 'già-riscossa'); assert.equal(game().resources.funds, fundsOther, 'Un’altra carriera dello stesso dispositivo: niente.');
  store.loadGame(JSON.parse(JSON.stringify(devices.I1.save)));

  // an account: the Worker gives it once for the account, recovers an answer that was lost, survives a logout with no career playing
  const token = await register('social.uno');
  const viaWorker = (token0, hooks = {}) => ({ claim: async (reward, career, id) => { const answer = await post(token0, `/api/account/rewards/community/${reward}`, { careerId: career, device: id }); if (hooks.drop?.()) throw Object.assign(new Error('rete'), { code: 'offline' }); return answer; } });
  const make = (name, userName, token0, hooks = {}) => { const d = makeDevice(name, userName, token0, {}); d.service = createRewardsService({ store, journal: d.journal, username: () => userName, community: { instagram: true }, claimCommunity: viaWorker(token0, hooks).claim, syncTime: body => sendRaw(token0, body), env: { now: () => d.env.t, wall: () => vt, visible: () => true, playing: () => d.env.playing, lease: createStorageLease(memoryStorage(), { tabId: name, wall: () => vt }), storage: memoryStorage() } }); return d; };
  let drop = false;
  const A = make('S1', 'social.uno', token, { drop: () => drop }), B = make('S2', 'social.uno', token);
  activate('S1'); const f1 = game().resources.funds;
  A.service.visitCommunity('instagram'); drop = true;
  const failed = await A.service.claimCommunity('instagram');
  assert.equal(failed.ok, false); assert.equal(A.journal.community(A.journal.scope('social.uno'), 'instagram').state, 'pending', 'Errore di rete: in attesa, nulla accreditato.'); assert.equal(game().resources.funds, f1);
  assert.equal(local.sqlite.prepare("SELECT COUNT(*) AS n FROM reward_community WHERE user_id = (SELECT id FROM users WHERE username = 'social.uno')").get().n, 1, 'Ma il servizio aveva già dato la ricompensa a questo dispositivo.');
  drop = false; vt += 40000;
  await A.service.settleCommunity('instagram', true);
  assert.equal(game().resources.funds, f1 + 1500, 'Il tentativo successivo la riconosce come sua e la accredita: non va persa.');
  assert.equal(game().finance.ledger.filter(item => item.label === 'Community Instagram').length, 1);
  activate('S2'); const f2 = game().resources.funds;
  B.service.visitCommunity('instagram'); await B.service.claimCommunity('instagram');
  assert.equal(game().resources.funds, f2, 'Un secondo dispositivo dello stesso account non la riscuote.'); assert.equal(B.journal.community(B.journal.scope('social.uno'), 'instagram').state, 'claimed-elsewhere');
  // another account has its own; with no career playing the reward is owed and survives a logout and a new login
  const token2 = await register('social.due');
  const C = make('S3', 'social.due', token2); activate('S3'); const f3 = game().resources.funds;
  C.service.visitCommunity('instagram'); C.env.playing = false;
  assert.equal((await C.service.claimCommunity('instagram')).reason, 'senza-carriera', 'Senza carriera in gioco non si riscuote.');
  C.env.playing = true; await C.service.claimCommunity('instagram'); assert.equal(game().resources.funds, f3 + 1500, 'Un altro account ha la sua.');
  // logout while the claim is on its way: the Worker has it, the career is not playing → owed; the same account on the next page credits it
  const token3 = await register('social.tre');
  let outside = false;
  const H = make('S4', 'social.tre', token3, { drop: () => { H.env.playing = false; outside = true; return false; } }); activate('S4'); const f4 = game().resources.funds;
  H.service.visitCommunity('instagram'); await H.service.claimCommunity('instagram');
  assert.equal(outside, true); assert.equal(H.journal.community(H.journal.scope('social.tre'), 'instagram').state, 'owed', 'Senza carriera in gioco quando arriva la risposta: dovuta.'); assert.equal(game().resources.funds, f4);
  const next = createRewardsService({ store, journal: H.journal, username: () => 'social.tre', community: { instagram: true }, claimCommunity: viaWorker(token3).claim, env: { now: () => 0, wall: () => vt, visible: () => true, playing: () => true, lease: createStorageLease(memoryStorage(), { tabId: 'S4b', wall: () => vt }), storage: memoryStorage() } });
  await next.settleCommunity('instagram'); assert.equal(game().resources.funds, f4 + 1500, 'Alla pagina successiva (dopo un nuovo accesso) viene accreditata, una volta.');
  await next.settleCommunity('instagram'); assert.equal(game().resources.funds, f4 + 1500);
  // no automatic verification, no credentials: nothing was fetched from the social network, the page asks for nothing
  assert.ok(!calls.some(url => /instagram/i.test(url)), 'Nessuna richiesta a Instagram: nessuna verifica automatica del follow.');
  globalThis.fetch = realFetch;
  const html = renderRewardsPage(store.getState(), { ...next.snapshot(), community: { instagram: { enabled: true, url: rules.COMMUNITY_REWARD.instagram.url, funds: 1500, capital: 5, state: 'visited', guest: false } }, playing: true });
  assert.ok(html.includes('https://www.instagram.com/politicandoitalia2026/') && /rel="noopener noreferrer"/.test(html) && /target="_blank"/.test(html), 'Il link ufficiale si apre fuori dal gioco.');
  assert.ok(!/<input|password|<img[^>]*instagram/i.test(html), 'Nessun campo per credenziali, nessun logo nelle altre carte.');
  assert.match(html, /Segui su Instagram/); assert.match(html, /Ho seguito, riscuoti/); assert.match(html, /non controlliamo il tuo account Instagram/);
  lines.push('ricompensa Instagram: spenta per scelta finché non verificata; da autodichiarazione una volta (ospite per dispositivo, account per account), +1.500 € nel registro e +5 capitale col tetto, recuperabile dopo errore di rete, risposta persa e uscita, nessuna chiamata a Instagram');
}

// ============ 11. the migration of a database made by the earlier version ============
{
  const { startLocalWorker: startOld } = await import('./lib/local-worker.mjs');
  const old = await startOld({ port: 8795 });
  // the schema of the first version of the rewards: no device in the claims, the time table with fewer columns
  old.sqlite.exec(`CREATE TABLE reward_claims (user_id TEXT NOT NULL, day TEXT NOT NULL, claimed_at TEXT NOT NULL, career_id TEXT, PRIMARY KEY (user_id, day));
    CREATE TABLE reward_time (user_id TEXT NOT NULL, scope TEXT NOT NULL, spans TEXT NOT NULL DEFAULT '[]', total_ms INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, scope));
    INSERT INTO reward_claims VALUES ('utente-vecchio', '2026-10-30', '2026-10-30T10:00:00Z', 'carriera-x');
    INSERT INTO reward_claims VALUES ('utente-vecchio', '2026-10-31', '2026-10-31T10:00:00Z', NULL);
    INSERT INTO reward_time VALUES ('utente-vecchio', 'c:carriera-x', '[[1,2000]]', 1999, '2026-10-30T10:00:00Z');`);
  const names = table => old.sqlite.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  assert.ok(!names('reward_claims').includes('device_id'));
  const proof = await client.passwordProof('migra.uno', 'password-di-migra');
  const register1 = () => old.worker.fetch(new Request(`${old.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.240' }, body: JSON.stringify({ username: 'migra.uno', proof }) }), old.env);
  assert.equal((await register1()).status, 201, 'La prima richiesta esegue la migrazione e va a buon fine.');
  assert.ok(names('reward_claims').includes('device_id'), 'device_id aggiunto perché mancava.');
  for (const column of ['base_ms', 'folded_ms', 'rev']) assert.ok(names('reward_time').includes(column), `${column} aggiunto alla tabella del tempo.`);
  assert.deepEqual(old.sqlite.prepare('SELECT user_id, day, career_id, device_id FROM reward_claims ORDER BY day').all().map(row => ({ ...row })), [{ user_id: 'utente-vecchio', day: '2026-10-30', career_id: 'carriera-x', device_id: null }, { user_id: 'utente-vecchio', day: '2026-10-31', career_id: null, device_id: null }], 'Le righe esistenti sono intatte.');
  assert.deepEqual({ ...old.sqlite.prepare('SELECT spans, total_ms AS total, base_ms AS base, rev FROM reward_time').get() }, { spans: '[[1,2000]]', total: 1999, base: 0, rev: 0 }, 'Anche quelle del tempo.');
  for (const table of ['reward_devices', 'reward_blocks', 'reward_community', 'schema_migrations']) assert.ok(names(table).length > 0, `${table} esiste.`);
  assert.equal(old.sqlite.prepare('SELECT name FROM schema_migrations').all().map(row => row.name).join(), '0006-rewards', 'La migrazione è registrata con il suo nome.');
  // run again (a second Worker on the same database, as after a deploy): nothing to do, no error, rows untouched
  const again = await startOld({ port: 8796 }); again.sqlite.close?.();
  await old.close(); await again.close();

  // an error that is not «column already there» is NOT ignored: the request fails and the next one tries again
  const broken = await startOld({ port: 8797 });
  broken.sqlite.exec(`CREATE TABLE reward_claims (user_id TEXT NOT NULL, day TEXT NOT NULL, claimed_at TEXT NOT NULL, career_id TEXT, PRIMARY KEY (user_id, day));`);
  const realPrepare = broken.env.ACCOUNTS.prepare.bind(broken.env.ACCOUNTS);
  let sabotage = true;
  broken.env.ACCOUNTS.prepare = sql => (sabotage && /ALTER TABLE reward_claims/.test(sql)) ? { bind: () => ({ run: async () => { throw new Error('disk I/O error'); } }), run: async () => { throw new Error('disk I/O error'); } } : realPrepare(sql);
  const proof2 = await client.passwordProof('migra.due', 'password-di-migra');
  const attempt = () => broken.worker.fetch(new Request(`${broken.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.241' }, body: JSON.stringify({ username: 'migra.due', proof: proof2 }) }), broken.env);
  let failed = false; try { const response = await attempt(); failed = response.status >= 500; } catch { failed = true; }
  assert.equal(failed, true, 'Un errore di migrazione imprevisto non viene ignorato: la richiesta fallisce.');
  assert.equal(broken.sqlite.prepare('SELECT COUNT(*) AS n FROM schema_migrations WHERE name = ?').get('0006-rewards').n, 0, 'E la migrazione non risulta eseguita.');
  sabotage = false;
  assert.equal((await attempt()).status, 201, 'Risolto il guasto, la richiesta successiva completa la migrazione.');
  assert.ok(broken.sqlite.prepare('PRAGMA table_info(reward_claims)').all().some(row => row.name === 'device_id'));
  await broken.close();
  lines.push('migrazione D1: colonne aggiunte solo se mancano (PRAGMA table_info), righe esistenti intatte, registrata in schema_migrations, errori imprevisti non ignorati');
}

// ============ 12. deleting the account deletes what the rewards kept for it ============
{
  const token = await register('cancella.uno');
  await sendRaw(token, { device: 'x', now: vt, spans: [{ q: 0, c: careerId, s: vt - 40 * 60000, e: vt - 5 * 60000 }], career: { id: careerId, baseMs: 0 } });
  await post(token, '/api/account/rewards/blocks', { careerId, device: 'x', claims: [{ kind: 'capitale', n: 1 }] });
  await post(token, '/api/account/rewards/community/instagram', { careerId, device: 'x' });
  await post(token, '/api/account/rewards/daily', { careerId, device: 'x' });
  const count = table => local.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = (SELECT id FROM users WHERE username = 'cancella.uno')`).get().n;
  const tables = ['reward_time', 'reward_devices', 'reward_blocks', 'reward_community', 'reward_claims'];
  assert.ok(tables.every(table => count(table) > 0), 'Prima della cancellazione l’account ha righe in tutte le tabelle delle ricompense.');
  const userId = local.sqlite.prepare("SELECT id FROM users WHERE username = 'cancella.uno'").get().id;
  const proof = await client.passwordProof('cancella.uno', 'password-di-cancella.uno');
  const response = await local.worker.fetch(new Request(`${local.origin}/api/account`, { method: 'DELETE', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.200' }, body: JSON.stringify({ proof, confirm: 'ELIMINA' }) }), local.env);
  assert.equal(response.status, 200, 'L’account si elimina.');
  for (const table of tables) assert.equal(local.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(userId).n, 0, `${table}: nessuna riga resta.`);
  lines.push('eliminazione dell’account: nessuna riga delle ricompense resta');
}

// ============ 6. nothing unused is left, nothing leaks ============
{
  const sources = ['src/ui/rewards-service.js', 'src/data/simulation/reward-rules.js'].map(file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n');
  assert.ok(!/sinceSave|saveEveryMs/.test(sources), 'Nessuna variabile o configurazione inutilizzata (sinceSave, saveEveryMs).');
  assert.ok(/syncEveryMs/.test(sources));
  const page = fs.readFileSync(new URL('../src/ui/rewards-page.js', import.meta.url), 'utf8');
  assert.ok(!/donatore|donor/i.test(page.replace(/\/\/[^\n]*/g, '')), 'La pagina non parla di donatori.');
  lines.push('nessuna variabile o configurazione inutilizzata');
}

Date.now = realNow;
await local.close();
console.log(`Ricompense sincronizzate: ${lines.join('; ')}.`);
process.exit(0);
