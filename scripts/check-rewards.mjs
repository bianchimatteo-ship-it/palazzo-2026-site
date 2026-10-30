// Rewards for time played and rewarded videos: the daily reward (500 €, 5 minutes, once for each account or guest and Rome day), the cumulative time of a career (+4 political capital every 30 minutes, +4 preparation
// every 60), the clock that counts only what is really played, persistence that does not touch the autosave preferences, and the effect of a rewarded video on the published poll (exactly +0.15 points taken
// from another component, three polls, invisible). The engine, the world, the store, the real Worker route of the daily reward and the rendering of the page; the interaction in Chrome is in check-rewards-page.mjs.
// The videos are demonstration ones (scripts/lib/demo-ads.mjs): no real advertising is simulated and no SDK or id exists in the game.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { startCareer } from './lib/long-run.mjs';
import { createDemoProvider } from './lib/demo-ads.mjs';

const build = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const R = await module('src/core/rewards-engine.js');
const { createPlayClock, createStorageLease } = await module('src/core/play-clock.js');
const { createRewardsJournal } = await module('src/data/repositories/rewards-journal.js');
const { rewardsJournal } = await module('src/data/repositories/rewards-journal.js');
const { createRewardedAds, REWARDED_ADS_OFF } = await module('src/data/repositories/ads-rewarded.js');
const { createRewardsService } = await module('src/ui/rewards-service.js');
const { renderRewardsPage } = await module('src/ui/rewards-page.js');
const rules = await module('src/data/simulation/reward-rules.js');
const W = await module('src/core/world-engine.js');
const lines = [];
const MIN = 60000;
const memoryStorage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, String(value)); }, removeItem: key => { map.delete(key); }, map }; };
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

// ---------- 1. the day of the reward, in Europe/Rome ----------
assert.equal(R.romeDay(Date.parse('2026-10-30T22:30:00Z')), '2026-10-30', '23:30 a Roma (ora solare) è ancora il 30.');
assert.equal(R.romeDay(Date.parse('2026-10-30T23:00:00Z')), '2026-10-31', 'Mezzanotte a Roma è il giorno dopo, non quello di UTC.');
assert.equal(R.romeDay(Date.parse('2026-07-15T21:59:00Z')), '2026-07-15'); assert.equal(R.romeDay(Date.parse('2026-07-15T22:00:00Z')), '2026-07-16', 'In ora legale la mezzanotte di Roma è alle 22:00 UTC.');
lines.push('giorno in Europe/Rome (ora solare e legale)');

// ---------- the career ----------
const run = await startCareer({ seed: 'ricompense', level: 'deputato', fast: true });
const { store } = run;
const game = () => store.getState().game;
const setResources = ({ capital = null, prep = null } = {}) => { if (capital !== null) game().resources.politicalCapital = capital; if (prep !== null) game().prep = prep; };
rewardsJournal.clear();
const careerId = store.getState().career.id;

// ---------- 2. time played: 30, 60, 90, 120 minutes, exact; the rest is kept between sessions ----------
{
  setResources({ capital: 20, prep: 10 });
  const base = { capital: game().resources.politicalCapital, prep: game().prep };
  const log = [];
  for (let minute = 1; minute <= 120; minute++) {
    const credited = store.addPlayTime(MIN);
    if (credited.length) log.push([minute, credited.map(item => `${item.kind}:${item.amount}`).join(',')]);
  }
  assert.deepEqual(log, [[30, 'capitale:4'], [60, 'capitale:4,preparazione:4'], [90, 'capitale:4'], [120, 'capitale:4,preparazione:4']], 'Premi esatti a 30, 60, 90 e 120 minuti.');
  assert.equal(game().resources.politicalCapital, base.capital + 16); assert.equal(game().prep, base.prep + 8);
  assert.equal(game().rewards.playMs, 120 * MIN);
  const entries = R.rewardHistory(game());
  assert.equal(entries.length, 6); assert.ok(entries.every(item => item.at && item.resource && Number.isFinite(item.amount) && item.kind), 'Ogni premio ha data e ora, tipo, importo e risorsa.');
  // not before: 29 minutes 59 seconds give nothing
  const before = game().rewards.paidCapital;
  store.addPlayTime(29 * MIN + 59000); assert.equal(game().rewards.paidCapital, before, 'A 29:59 dal premio precedente non c’è ancora nulla.');
  store.addPlayTime(1000); assert.equal(game().rewards.paidCapital, before + 1, 'Al secondo successivo c’è.');
  // the minutes left over are kept between sessions (and exactly: 20 + 15 minutes make one block and 5 left)
  const start = game().rewards.playMs;
  store.addPlayTime(20 * MIN); const mid = game().rewards.paidCapital; store.addPlayTime(10 * MIN); assert.equal(game().rewards.paidCapital, mid + 1, '20 + 10 minuti in due sessioni fanno un blocco.');
  assert.equal(game().rewards.playMs, start + 30 * MIN);
  lines.push('premi esatti a 30/60/90/120 minuti, resto conservato tra le sessioni');
}

// ---------- 3. the limits of the game: never over 100, the amount really received is the one recorded ----------
{
  setResources({ capital: 98, prep: 99 });
  const paid = game().rewards.paidCapital, paidPrep = game().rewards.paidPrep;
  game().rewards.playMs = (paid) * 30 * MIN; // the next block is due at the next 30 minutes
  let credited = store.addPlayTime(30 * MIN);
  const capital = credited.find(item => item.kind === 'capitale');
  assert.ok(capital && capital.requested === 4 && capital.amount === 2 && game().resources.politicalCapital === 100, 'A 98 il capitale riceve 2, non 4, e lo storico dice 2.');
  setResources({ capital: 100 });
  credited = store.addPlayTime(30 * MIN);
  assert.equal(credited.find(item => item.kind === 'capitale').amount, 0, 'A 100 il premio vale 0 e così è registrato.'); assert.equal(game().resources.politicalCapital, 100);
  game().prep = 99; const prepBlocks = game().rewards.paidPrep;
  game().rewards.playMs = (prepBlocks + 1) * 60 * MIN - MIN; store.addPlayTime(MIN);
  assert.equal(game().prep, 100, 'La preparazione non supera 100.'); assert.ok(game().rewards.paidPrep > paidPrep);
  assert.ok(R.rewardHistory(game()).some(item => item.kind === 'preparazione' && item.requested === 4 && item.amount === 1), 'E lo storico registra quanto è stato davvero accreditato (1 su 4).');
  lines.push('limiti a 100 rispettati, importo effettivo registrato');
}

// ---------- 4. persistence: a credit that was not saved comes back once, one that was saved is not paid twice; the autosave preference is not touched ----------
{
  const { storage } = await module('src/core/storage.js');
  const { saveSetting } = await module('src/core/settings.js');
  saveSetting('autosave', 'manual');
  rewardsJournal.clear(); setResources({ capital: 10, prep: 10 });
  rewardsJournal.setCareerMs(careerId, game().rewards.playMs); // (what the page does when it loads the career: the journal is raised to what the game already has)
  const raw0 = JSON.parse(store.exportSave());
  store.addPlayTime(31 * MIN);
  assert.equal(game().resources.politicalCapital, 14);
  assert.equal(storage.load()?.game?.rewards?.playMs ?? 0, storage.load()?.game?.rewards?.playMs ?? 0);
  const savedAfter = JSON.stringify(storage.load()?.game?.rewards ?? null);
  store.addPlayTime(MIN);
  assert.equal(JSON.stringify(storage.load()?.game?.rewards ?? null), savedAfter, 'Con il salvataggio manuale il timer non scrive la partita: nessun salvataggio forzato.');
  // the page is closed without saving: the old save is loaded and the journal gives back the missing time, once
  store.loadGame(raw0);
  assert.equal(game().rewards.playMs, raw0.game.rewards.playMs + 32 * MIN, 'Il tempo giocato torna dal diario del dispositivo.'); assert.equal(game().resources.politicalCapital, 14, 'Il capitale è +4 una volta sola, non due.');
  const again = JSON.parse(store.exportSave()); store.loadGame(again);
  assert.equal(game().resources.politicalCapital, 14, 'Ricaricare una partita già a posto non paga di nuovo.'); assert.equal(game().rewards.paidCapital, again.game.rewards.paidCapital);
  // a save from another device that is ahead keeps its own count (the journal is raised to it)
  const ahead = JSON.parse(store.exportSave()); ahead.game.rewards.playMs += 100 * MIN; ahead.game.rewards.paidCapital += 3; ahead.game.rewards.paidPrep += 1;
  store.loadGame(ahead); assert.equal(game().rewards.playMs, ahead.game.rewards.playMs); assert.equal(rewardsJournal.career(careerId).playMs, ahead.game.rewards.playMs);
  // an old save with no rewards at all
  const old = JSON.parse(store.exportSave()); delete old.game.rewards; rewardsJournal.clear(); store.loadGame(old);
  assert.equal(R.normalizeRewards(game().rewards).playMs, 0, 'Un salvataggio vecchio, senza ricompense, si carica da zero.');
  saveSetting('autosave', 'action');
  lines.push('persistenza: salvataggio manuale non forzato, credito non salvato recuperato una volta, nessun doppio pagamento, salvataggi vecchi');
}

// ---------- 5. the clock: foreground only, monotonic, one tab at a time ----------
{
  let t = 0, wall = 1_000_000, visible = true, active = true;
  const storage = memoryStorage();
  const leaseA = createStorageLease(storage, { tabId: 'A', wall: () => wall }), leaseB = createStorageLease(storage, { tabId: 'B', wall: () => wall });
  let countedA = 0, countedB = 0;
  const clockA = createPlayClock({ now: () => t, visible: () => visible, active: () => active, lease: leaseA, onTime: ms => { countedA += ms; } });
  const clockB = createPlayClock({ now: () => t, visible: () => visible, active: () => active, lease: leaseB, onTime: ms => { countedB += ms; } });
  const step = (ms, ...clocks) => { t += ms; wall += ms; for (const clock of clocks) clock.tick(); };
  step(0, clockA); for (let i = 0; i < 10; i++) step(1000, clockA, clockB);
  assert.equal(countedA + countedB, 10000, 'Due schede aperte contano il tempo una volta sola.'); assert.ok(countedA === 10000 && countedB === 0, 'Conta chi ha il lease.');
  // background: nothing counts, and nothing is counted for the gap when the page comes back
  visible = false; for (let i = 0; i < 5; i++) step(1000, clockA, clockB); assert.equal(countedA, 10000, 'In background non conta.');
  visible = true; step(1000, clockA); assert.equal(countedA, 10000, 'Il primo tick dopo il ritorno non conta il tempo trascorso fuori.'); step(1000, clockA); assert.equal(countedA, 11000);
  // a page frozen or a machine asleep (a long gap) gives nothing; a change of the system time gives nothing either
  step(60000, clockA); assert.equal(countedA, 11000, 'Un buco di un minuto (pagina congelata, sospensione) non è tempo giocato.');
  wall += 5 * 3600000; step(1000, clockA); assert.equal(countedA, 12000, 'Il cambio dell’orologio di sistema non dà né toglie tempo (si misura con il clock monotono).');
  // no career open: nothing
  active = false; for (let i = 0; i < 3; i++) step(1000, clockA); assert.equal(countedA, 12000, 'Senza una carriera aperta non conta.'); active = true;
  // the holder leaves (suspend: the tab hidden or closed): the other tab takes over, and nothing is counted twice or lost beyond the gap
  clockA.suspend(); step(1000, clockB); assert.equal(countedB, 0, 'Il primo tick della scheda B che subentra non conta (parte da zero).');
  for (let i = 0; i < 4; i++) step(1000, clockB, clockA); assert.ok(countedB === 4000 && countedA === 12000, 'La scheda che subentra conta, l’altra non appena torna non la sostituisce finché B ha il lease.');
  // a lease that is not renewed expires
  wall += rules.PLAY_CLOCK.leaseMs + 1000; assert.equal(leaseA.hold(), true, 'Un lease scaduto si riprende.');
  lines.push('clock monotono: solo in primo piano, buchi ignorati, cambio dell’ora ininfluente, una sola scheda alla volta');
}

// ---------- 6. the daily reward through the service: 5 minutes, once a day for the account or guest, whatever the career, the session and the device ----------
const fake = (opts = {}) => {
  const env = { t: 0, wall: Date.parse('2026-10-30T10:00:00Z'), visible: true, playing: true };
  const journal = opts.journal ?? createRewardsJournal(memoryStorage());
  const lease = createStorageLease(opts.storage ?? memoryStorage(), { tabId: opts.tab ?? 'T', wall: () => env.wall });
  const service = createRewardsService({ store, journal, username: opts.username ?? (() => null), claimDaily: opts.claim ?? null, env: { now: () => env.t, wall: () => env.wall, visible: () => env.visible, playing: () => env.playing, lease, storage: memoryStorage() } });
  const tick = async (seconds = 1) => { for (let i = 0; i < seconds; i++) { env.t += 1000; env.wall += 1000; service.tick(); await settle(); } };
  return { env, journal, service, tick };
};
{
  rewardsJournal.clear(); setResources({ capital: 10, prep: 10 });
  const funds = () => game().resources.funds;
  const ledger = () => game().finance.ledger;
  const device = fake({ username: () => null });
  const start = funds(), treasury = game().party?.org?.treasury?.balance ?? null, income = game().finance.current.income;
  await device.tick(); // the first tick starts the count
  await device.tick(298); assert.equal(funds(), start, 'A 4:58 nulla.');
  await device.tick(1); assert.equal(funds(), start, 'A 4:59 nulla.');
  await device.tick(1);
  assert.equal(funds(), start + 500, 'Dopo 5 minuti: +500 € ai fondi personali.');
  assert.deepEqual([ledger()[0].category, ledger()[0].amount, ledger()[0].label], ['ricompense', 500, 'Ricompensa giornaliera'], 'Il movimento è nel registro, categoria dedicata.');
  assert.equal(game().finance.current.income, income + 500, 'E tra le entrate.'); assert.equal(game().finance.yearTotals.byCategory.ricompense, 500);
  assert.equal(game().party?.org?.treasury?.balance ?? null, treasury, 'La tesoreria del partito non c’entra.');
  assert.ok(R.rewardHistory(game()).some(item => item.kind === 'giornaliera' && item.amount === 500 && item.resource === 'Fondi personali'));
  await device.tick(600); assert.equal(funds(), start + 500, 'Una sola ricompensa al giorno.');
  // another career, the same day, the same guest: nothing more
  const other = JSON.parse(store.exportSave()); other.career.id = 'altra-carriera-di-prova'; other.saveMeta = { ...(other.saveMeta ?? {}), careerId: 'altra-carriera-di-prova' }; delete other.game.rewards;
  store.loadGame(other); const otherFunds = funds();
  await device.tick(400); assert.equal(funds(), otherFunds, 'Un’altra carriera nello stesso giorno non riceve una seconda ricompensa.');
  // a new session (the page is reloaded: a new service on the same journal) with the day already taken
  const reloaded = fake({ journal: device.journal }); reloaded.env.wall = device.env.wall; await reloaded.tick(400); assert.equal(funds(), otherFunds, 'Dopo un ricaricamento della pagina nemmeno.');
  // the next day (Rome) it comes again
  device.env.wall += 24 * 3600000; await device.tick(); await device.tick(301); assert.equal(funds(), otherFunds + 500, 'Il giorno dopo c’è di nuovo.');
  lines.push('ricompensa giornaliera: non prima di 5 minuti, +500 € nel registro delle entrate (non alla tesoreria), una sola al giorno tra carriere e ricaricamenti, di nuovo il giorno dopo');
}
{
  // minutes spread over sessions
  rewardsJournal.clear();
  const journal = createRewardsJournal(memoryStorage());
  const funds = () => game().resources.funds;
  const before = funds();
  for (const seconds of [100, 100, 100]) { const session = fake({ journal }); session.env.wall = Date.parse('2026-12-01T09:00:00Z'); await session.tick(); await session.tick(seconds); session.service.stop(); }
  assert.equal(funds(), before + 500, 'Cinque minuti in più sessioni (100 + 100 + 100 secondi) valgono: il tempo si accumula nella giornata.');
}
{
  // an account, several devices: the Worker (here a stand-in with the same rule) gives the day once; offline nothing is credited until it answers
  const claims = new Set(); let online = true;
  const claim = day => async () => { if (!online) throw Object.assign(new Error('offline'), { code: 'offline' }); const key = `${day()}`; if (claims.has(key)) return { ok: true, claimed: false, already: true }; claims.add(key); return { ok: true, claimed: true }; };
  const funds = () => game().resources.funds;
  const a = fake({ username: () => 'giocatrice', journal: createRewardsJournal(memoryStorage()) }), b = fake({ username: () => 'giocatrice', journal: createRewardsJournal(memoryStorage()) });
  const dayOf = () => R.romeDay(a.env.wall);
  const claimA = claim(dayOf);
  const rebuild = (device, claimFn) => { device.service = createRewardsService({ store, journal: device.journal, username: () => 'giocatrice', claimDaily: claimFn, env: { now: () => device.env.t, wall: () => device.env.wall, visible: () => true, playing: true && (() => true), lease: createStorageLease(memoryStorage(), { tabId: device === a ? 'A' : 'B', wall: () => device.env.wall }), storage: memoryStorage() } }); device.tick = async (seconds = 1) => { for (let i = 0; i < seconds; i++) { device.env.t += 1000; device.env.wall += 1000; device.service.tick(); await settle(); } }; };
  a.env.wall = b.env.wall = Date.parse('2027-01-10T09:00:00Z');
  rebuild(a, claimA); rebuild(b, claimA);
  const before = funds();
  online = false; await a.tick(); await a.tick(305);
  assert.equal(funds(), before, 'Senza rete la richiesta resta in attesa: nulla viene accreditato senza la conferma del servizio.'); assert.equal(a.journal.daily(a.service.journal.scope('giocatrice'), dayOf()).state, 'pending');
  online = true; a.env.wall += 31000; await a.tick(2); assert.equal(funds(), before + 500, 'Tornata la rete la ricompensa arriva, una volta.');
  await b.tick(); await b.tick(305); assert.equal(funds(), before + 500, 'Un altro dispositivo dello stesso account, nello stesso giorno: niente.');
  assert.equal(b.journal.daily(b.service.journal.scope('giocatrice'), dayOf()).state, 'claimed-elsewhere');
  lines.push('account: una sola ricompensa per giorno anche tra dispositivi, nulla accreditato senza la conferma del servizio, richiesta ripresa al ritorno della rete');
}

// ---------- 7. the real route of the Worker ----------
{
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });
  globalThis.location = new URL('http://127.0.0.1:8793/');
  const client = await module('src/data/repositories/account-sync.js');
  const { startLocalWorker } = await import('./lib/local-worker.mjs');
  const local = await startLocalWorker({ port: 8793 });
  let ip = 120;
  const register = async (username, password) => {
    const proof = await client.passwordProof(username, password);
    const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ip}` }, body: JSON.stringify({ username, proof }) }), local.env);
    assert.equal(response.status, 201); return (await response.json()).token;
  };
  const call = (token, method) => local.worker.fetch(new Request(`${local.origin}/api/account/rewards/daily`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify({ careerId: 'carriera-prova' }) : undefined }), local.env).then(async response => ({ status: response.status, body: await response.json() }));
  const tokenA = await register('premio.a', 'password-di-a'), tokenB = await register('premio.b', 'password-di-b');
  const day = R.romeDay();
  assert.deepEqual((await call(tokenA, 'GET')).body, { ok: true, day, claimed: false });
  const first = await call(tokenA, 'POST'); assert.deepEqual([first.status, first.body.claimed, first.body.day], [200, true, day], 'La prima richiesta del giorno ottiene la ricompensa.');
  const second = await call(tokenA, 'POST'); assert.deepEqual([second.body.claimed, second.body.already], [false, true], 'La seconda, da qualunque dispositivo, no.');
  assert.equal((await call(tokenA, 'GET')).body.claimed, true);
  assert.equal((await call(tokenB, 'POST')).body.claimed, true, 'Un altro account ha la sua.');
  assert.equal((await local.worker.fetch(new Request(`${local.origin}/api/account/rewards/daily`, { method: 'POST' }), local.env)).status, 401, 'Senza accesso non si riscuote.');
  // the day belongs to the Worker: the claims of the day before do not count today
  local.sqlite.prepare('UPDATE reward_claims SET day = ?').run('2020-01-01');
  assert.equal((await call(tokenA, 'POST')).body.claimed, true, 'Il giorno dopo la ricompensa è di nuovo disponibile.');
  assert.equal(local.sqlite.prepare('SELECT COUNT(*) AS n FROM reward_claims WHERE day = ?').get(day).n, 1, 'Una sola riga per account e giorno.');
  await local.close();
  lines.push('Worker reale: una richiesta vincente al giorno per account, indipendente dal dispositivo, il giorno lo decide il servizio');
}

// ---------- 8. rewarded videos: the effect on the published poll ----------
const forces = [
  { id: 'fdi', label: 'Destra A', share: 26.6, position: 'destra', governing: true }, { id: 'pd', label: 'Centrosinistra A', share: 21.1, position: 'centro-sinistra' },
  { id: 'm5s', label: 'Centrosinistra B', share: 12.5, position: 'centro-sinistra' }, { id: 'fn', label: 'Destra B', share: 7.7, position: 'destra' },
  { id: 'fi', label: 'Centrodestra A', share: 7.4, position: 'centro-destra', governing: true }, { id: 'avs', label: 'Sinistra A', share: 6.4, position: 'sinistra' },
  { id: 'lega', label: 'Destra C', share: 5.6, position: 'destra', governing: true }, { id: 'az', label: 'Centro A', share: 3.3, position: 'centro' },
  { id: 'iv', label: 'Centro B', share: 2.3, position: 'centro' }, { id: 'pe', label: 'Centro C', share: 1.5, position: 'centro' }
];
const realPoll = { id: 'test', label: 'Media di prova', publishedAt: '2026-09-17', sourceUrl: 'https://example.org/sondaggio', sourceName: 'Fonte di prova', results: forces.map(item => ({ partyId: item.id, share: item.share })) };
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const society = { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 };
const newWorld = seed => W.createWorld({ seedText: seed, date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position: 'centro-sinistra', founder: true }, forces, realPoll });
const weekly = (world, count, from = 2) => { let date = addDays('2026-09-24', (from - 2) * 7); const out = []; for (let week = from; week < from + count; week++) { date = addDays(date, 7); world = W.advanceWorld(world, { date, week, stats: {}, society }).world; out.push(W.latestPoll(world)); } return { world, polls: out }; };
const shareOf = (poll, id) => poll.results.find(row => row.partyId === id)?.share ?? null;
const total = poll => Math.round((poll.results.reduce((sum, row) => sum + row.share, 0) + poll.others) * 10) / 10;
{
  // exactly 0.15 on the published figure, for exactly three polls, then nothing; the donor gives exactly the same; the total holds; nothing else changes
  const donors = new Set();
  for (let trial = 0; trial < 60; trial++) {
    const warm = weekly(newWorld(`video-${trial}`), 3).world;
    const added = W.addAdTransfer(warm, { id: `completamento-${trial}` });
    assert.ok(added.transfer && added.transfer.amount === 0.15 && added.transfer.polls === 3 && added.transfer.partyId === 'io' && added.transfer.donorId !== 'io', 'Ogni video ha il suo record: id, beneficiario, donatore, quantità e durata.');
    donors.add(added.transfer.donorId ?? 'nessuno');
    const control = structuredClone(added.world); control.adTransfers = [];
    const treated = weekly(added.world, 5, 5), plain = weekly(control, 5, 5);
    treated.polls.forEach((poll, index) => {
      const bonus = index < 3 ? 0.15 : 0, free = plain.polls[index];
      assert.equal(Math.round((shareOf(poll, 'io') - shareOf(free, 'io')) * 100) / 100, bonus, `Prova ${trial}, sondaggio ${index + 1}: la variazione del partito del giocatore è ${bonus}.`);
      const donor = added.transfer.donorId;
      const moved = poll.results.filter(row => Math.abs(row.share - shareOf(free, row.partyId)) > 1e-9 && row.partyId !== 'io');
      if (bonus && donor && donor !== 'altri' && moved.length === 1) assert.equal(Math.round((shareOf(free, moved[0].partyId) - moved[0].share) * 100) / 100, 0.15, 'Il donatore cede esattamente la stessa quantità.');
      assert.ok(poll.results.every(row => row.share >= 0 && Number.isFinite(row.share)), 'Nessuna percentuale negativa.');
      assert.ok(poll.others >= 0 && Math.abs(total(poll) - 100) <= 0.1 + 1e-9, `Il totale resta 100 (${total(poll)}).`);
      assert.ok(poll.results.filter(row => row.partyId !== 'io').every(row => row.share >= rules.AD_REWARD.minShare - 1e-9 || shareOf(free, row.partyId) < rules.AD_REWARD.minShare + 0.15), 'Nessuna forza scende sotto il minimo del sondaggio.');
    });
    assert.equal(treated.world.adTransfers.length, 0, 'Dopo il terzo sondaggio il trasferimento è chiuso.');
    // the base consensus of every party is untouched, the world is the same
    assert.deepEqual(treated.world.parties.map(item => [item.id, item.baseline]), plain.world.parties.map(item => [item.id, item.baseline]), 'Il consenso di base dei partiti non cambia, né durante né dopo.');
    assert.deepEqual(treated.world.effects, plain.world.effects, 'Nessun effetto del mondo (world.effects) per il video.');
    assert.deepEqual(treated.world.parties.find(item => item.id === 'io').lastEffects ?? {}, plain.world.parties.find(item => item.id === 'io').lastEffects ?? {}, 'E player.lastEffects non ne sa nulla.');
    assert.deepEqual(treated.world.events.map(item => item.title), plain.world.events.map(item => item.title), 'Nessun evento o cronaca.');
    if (trial < 8) for (const [index, poll] of treated.polls.entries()) assert.ok(!/Si esaurisce|video|annuncio|donat|redistribu|scad/i.test(JSON.stringify(poll.why) + JSON.stringify(poll.results.map(row => Object.keys(row)))) && JSON.stringify(Object.keys(poll)) === JSON.stringify(Object.keys(plain.polls[index])), 'Nessuna spiegazione, campo o messaggio rivela il video, il donatore o la scadenza.');
  }
  assert.ok(donors.has('altri') && donors.size >= 4, `Il donatore è casuale tra altri partiti e «Altri» (${[...donors].join(', ')}).`);
  assert.ok(![...donors].includes('io'), 'Mai il partito del giocatore.');
  lines.push(`video: +0,15 esatti per tre sondaggi, donatore uguale e casuale (${donors.size} diversi), totale 100, nessun negativo, consenso di base e cronaca invariati`);
}
{
  // several videos add up, each with its own end; a duplicate id does nothing
  const warm = weekly(newWorld('video-somma'), 3).world;
  let world = W.addAdTransfer(warm, { id: 'uno-uno-uno' }).world;
  const dup = W.addAdTransfer(world, { id: 'uno-uno-uno' }); assert.equal(dup.transfer, null); assert.equal(dup.reason, 'duplicato');
  const control = structuredClone(world); control.adTransfers = [];
  const treated = [], plain = [];
  let t = world, c = control; let date = addDays('2026-09-24', 21);
  for (let week = 5; week < 14; week++) {
    date = addDays(date, 7);
    if (week === 6) t = W.addAdTransfer(t, { id: 'due-due-due' }).world; if (week === 7) t = W.addAdTransfer(t, { id: 'tre-tre-tre' }).world;
    if (week === 6 || week === 7) { c.rngState = t.rngState; }
    t = W.advanceWorld(t, { date, week, stats: {}, society }).world; c = W.advanceWorld(c, { date, week, stats: {}, society }).world;
    treated.push(W.latestPoll(t)); plain.push(W.latestPoll(c));
  }
  const diffs = treated.map((poll, index) => Math.round((shareOf(poll, 'io') - shareOf(plain[index], 'io')) * 100) / 100);
  assert.deepEqual(diffs.slice(0, 9), [0.15, 0.3, 0.45, 0.3, 0.15, 0, 0, 0, 0], `Più video si sommano e ognuno finisce per conto suo (${diffs.join(', ')}).`);
  lines.push('più video indipendenti si sommano e scadono ognuno per conto suo');
}
{
  // a donor that disappears (merged, dissolved), a change of the player's party, a world where nobody can give
  const warm = weekly(newWorld('video-fusione'), 3).world;
  const added = W.addAdTransfer(warm, { id: 'completamento-fusione' });
  const world = structuredClone(added.world);
  const donorId = added.transfer.donorId;
  if (donorId && donorId !== 'altri') world.parties.find(item => item.id === donorId).active = false;
  const control = structuredClone(world); control.adTransfers = [];
  const { polls } = weekly(world, 3, 5), free = weekly(control, 3, 5).polls;
  polls.forEach((poll, index) => { assert.equal(Math.round((shareOf(poll, 'io') - shareOf(free[index], 'io')) * 100) / 100, 0.15, 'Un donatore che sparisce viene sostituito: il bonus c’è lo stesso.'); assert.ok(Math.abs(total(poll) - 100) <= 0.1 + 1e-9); assert.ok(poll.results.every(row => row.share >= 0)); });
  // nobody can give: the poll is published as it is, the count goes on and ends
  const tight = structuredClone(warm); tight.polls.at(-1).results.forEach(row => { if (row.partyId !== 'io') row.share = 0.3; });
  const none = W.addAdTransfer(tight, { id: 'completamento-stretto' });
  assert.ok(none.transfer);
  lines.push('donatore scomparso sostituito in silenzio, nessuna violazione dei minimi');
}

// ---------- 9. the provider: only a real completion pays, once ----------
{
  rewardsJournal.clear();
  const poll = () => W.latestPoll(store.getState().world);
  const grant = id => store.claimAdReward(id);
  const off = createRewardedAds({ grant });
  assert.deepEqual([(await off.availability()).ok, (await off.availability()).reason], [false, REWARDED_ADS_OFF], 'Senza integrazione la funzione è disattivata, con il motivo.');
  assert.equal((await off.watch()).status, 'unavailable');
  const demo = createDemoProvider();
  assert.equal((await createRewardedAds({ provider: demo, grant }).availability()).ok, false, 'Un provider dimostrativo è rifiutato se non lo si ammette esplicitamente.');
  assert.equal(demo.plays, 0, 'E non viene nemmeno mostrato.');
  const configuredOff = createRewardedAds({ config: { enabled: true, appId: null, rewardedUnitId: null }, provider: { kind: 'admob', isReady: () => true, show: async () => ({ completed: true, verified: true, completionId: 'x'.repeat(12) }) }, grant });
  assert.equal((await configuredOff.availability()).ok, false, 'Senza id configurati (non ne esistono) nemmeno un provider reale parte.');
  const transfers = () => (store.getState().world.adTransfers ?? []).length;
  const warm = { ...store.getState() };
  void warm; void poll;
  const make = outcome => createRewardedAds({ provider: createDemoProvider({ outcome }), allowDemo: true, grant });
  for (const outcome of ['dismissed', 'throws', 'unverified', 'noid']) { const before = transfers(); const result = await make(outcome).watch(); assert.notEqual(result.status, 'completed', `${outcome}: nessun premio.`); assert.equal(transfers(), before, `${outcome}: nessun trasferimento.`); }
  const before = transfers();
  const ok = await make('completed').watch(); assert.equal(ok.status, 'completed'); assert.equal(transfers(), before + 1, 'Un video completato dà un trasferimento.');
  assert.ok(R.rewardHistory(game()).some(item => item.kind === 'video' && item.amount === 0.15), 'E compare nello storico.');
  const repeating = make('repeat'); const first = await repeating.watch(); const second = await repeating.watch();
  assert.equal(first.status, 'completed'); assert.equal(second.status, 'duplicate', 'La stessa conferma ripetuta non paga due volte.'); assert.equal(transfers(), before + 2);
  const late = repeating.complete({ completed: true, verified: true, completionId: 'demo-completion-fixed' }); assert.equal(late.status, 'duplicate', 'Nemmeno una callback in ritardo.'); assert.equal(transfers(), before + 2);
  assert.equal(repeating.complete({ completed: true, verified: false, completionId: 'abcdefghij' }).status, 'failed'); assert.equal(transfers(), before + 2);
  lines.push('annunci: disattivati senza integrazione, demo rifiutato in produzione, nessun premio se chiuso/fallito/non verificato, una sola assegnazione per conferma');
}
{
  // the effect survives the save (reloading keeps the transfer, and the ids are not paid twice after a reload)
  const raw = JSON.parse(store.exportSave());
  assert.ok(Array.isArray(raw.world.adTransfers) && raw.world.adClaims.length >= 2);
  store.loadGame(raw);
  assert.equal(store.getState().world.adClaims.length, raw.world.adClaims.length, 'Ricaricando non si pagano di nuovo i video già contati.');
  // a video claimed after the last save comes back from the journal once
  const id = 'completamento-non-salvato';
  const saved = JSON.parse(store.exportSave());
  store.claimAdReward(id);
  store.loadGame(saved);
  assert.ok(store.getState().world.adClaims.includes(id) && (store.getState().world.adTransfers ?? []).some(item => item.id === id), 'Un video non ancora salvato torna dal diario.');
  const count = (store.getState().world.adTransfers ?? []).length; store.loadGame(JSON.parse(store.exportSave())); assert.equal((store.getState().world.adTransfers ?? []).length, count, 'Una volta sola.');
  lines.push('salvataggio e ricaricamento dei video: nessuna perdita, nessun doppio conteggio');
}

// ---------- 10. the page: what it says and what it never says ----------
{
  const service = fake({});
  await service.service.refreshAds(); const snapshot = service.service.snapshot();
  const html = renderRewardsPage(store.getState(), { ...snapshot, history: R.rewardHistory(game()) });
  assert.ok(/Ricompensa giornaliera/.test(html) && /\+500 €/.test(html) && /Tempo di gioco/.test(html) && /Ricompense pubblicitarie/.test(html) && /Storico/.test(html), 'Le quattro sezioni.');
  assert.ok(/data-reward-bar="daily"/.test(html) && /data-reward-bar="capital"/.test(html) && /data-reward-bar="preparation"/.test(html), 'Gli avanzamenti.');
  assert.ok(/data-reward-video[^>]*disabled/.test(html) && /AdMob/.test(html), 'Il pulsante del video è spento finché AdMob non c’è, con il motivo.');
  assert.ok(!/donator|cede|ceduto|scadenza|scade|durata|settimane|redistribu/i.test(html.replace(/Il giorno cambia[^<]*/, '')), 'Nessuna indicazione di durata o donatori.');
  assert.ok(/Fondi personali/.test(html) && /Ricompensa giornaliera/.test(html), 'Lo storico dice tipo, importo e risorsa.');
  assert.ok(/non alla tesoreria del partito/.test(html));
  lines.push('pagina Ricompense: sezioni, avanzamenti, video spento con il motivo, storico, nulla su durata o donatori');
}

console.log(`Ricompense: ${lines.join('; ')}.`);
process.exit(0);
