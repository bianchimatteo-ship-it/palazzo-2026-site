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
  const device = { name, save: structuredClone(base), raw: null, journal: createRewardsJournal(memoryStorage()), env: { t: 0, playing: true } };
  device.service = createRewardsService({
    store, journal: device.journal, username: () => userName,
    claimDaily: extra.claim ?? ((career, id) => post(token, '/api/account/rewards/daily', { careerId: career, device: id })),
    syncTime: extra.sync ?? (body => post(token, '/api/account/rewards/time', body)),
    env: { now: () => device.env.t, wall: () => vt, visible: () => true, playing: () => device.env.playing, lease: createStorageLease(memoryStorage(), { tabId: name, wall: () => vt }), storage: memoryStorage() }
  });
  devices[name] = device; return device;
}
function activate(name) {
  if (active === name) return devices[name];
  if (active) { const was = devices[active]; was.save = JSON.parse(store.exportSave()); was.raw = localStorage.getItem(JOURNAL_KEY); }
  active = name;
  const device = devices[name];
  rewardsJournal.clear(); if (device.raw) localStorage.setItem(JOURNAL_KEY, device.raw);
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
  const token2 = token; const span = [{ c: careerId, a: 90000, b: 30000 }];
  const before = serverMs('tempo.due', `d:${day()}`);
  await post(token2, '/api/account/rewards/time', { device: 'x', spans: span }); await post(token2, '/api/account/rewards/time', { device: 'x', spans: span });
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
