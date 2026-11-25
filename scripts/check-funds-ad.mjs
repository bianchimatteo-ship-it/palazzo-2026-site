// The two rewarded videos of the game on ONE Appodeal placement (`default`, Android): the poll bonus (+0,15, AD_REWARD, daily limit) and 1.000 € of personal funds (no limit). A scripted native plugin
// (the answers of plugins/appodeal-ads, Kotlin), the real adapter (data/repositories/appodeal-adapter.js), the real rewards service and its lazy funds offer (ui/rewards-service.js, ui/funds-ad.js), the
// real store and the real Worker code (local stand-in of Cloudflare). What is checked: every show is `default` (no other placement is ever asked for, no reward read from the dashboard), the kind is
// the one of the button and goes to the Worker, every completed funds video is 1.000 € to the personal funds (never the party's treasury) with no limit of the game, nothing for a video closed early,
// failed or not loaded, one busy guard for both kinds, ONE claim for each completion id whatever its kind (Worker, store, device journal), after a reopening and after a save and reload, the poll
// bonus exactly as before with its daily limit, and nothing on iOS.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });
const { startCareer } = await import('./lib/long-run.mjs');
const { createAppodealAdapter } = await import('../src/data/repositories/appodeal-adapter.js');
const { resolveAppodeal } = await import('../src/data/ads-config.js');
const { createRewardsService } = await import('../src/ui/rewards-service.js');
const { AD_REWARD } = await import('../src/data/simulation/reward-rules.js');
const { AD_FUNDS } = await import('../src/data/simulation/funds-ad-rules.js');
const { startLocalWorker } = await import('./lib/local-worker.mjs');

// ---------- the native side, scripted: what the Kotlin bridge answers ----------
function fakePlugin() {
  const plugin = {
    calls: [], loaded: true, next: [], ids: 0,
    async requestConsent() { return { canRequestAds: true, status: 'OBTAINED', privacyOptionsRequired: false }; },
    async initialize() { return { ok: true }; },
    async loadAd() { return { ready: plugin.loaded }; },
    async showAd(options) {
      plugin.calls.push(['show', options.format, options.placement ?? 'default', Object.keys(options).sort().join(',')]);
      if (!plugin.loaded) return { shown: false, rewarded: false, code: 'not-ready' };   // the native side checks Appodeal.isLoaded first
      const outcome = plugin.next.shift() ?? 'complete';
      if (outcome === 'show-failed') return { shown: false, rewarded: false, code: 'show-failed' };
      if (outcome === 'closed-early') return { shown: true, rewarded: false };
      const id = outcome === 'same-id' ? plugin.lastId : `apd-${String(++plugin.ids).padStart(32, '0')}`;
      plugin.lastId = id;
      return { shown: true, rewarded: true, completionId: id };
    },
    async showBanner() { return { shown: false }; }, async hideBanner() {}
  };
  return plugin;
}

const local = await startLocalWorker({ port: 8797 });
// (the harness replaces fetch for its own files: the Worker is called directly, as check-rewards-sync does)
const call = async (path, body, token = null) => { const r = await local.worker.fetch(new Request(`${local.origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }), local.env); const data = await r.json().catch(() => ({})); if (!r.ok) { const error = new Error(data.error ?? 'errore'); error.status = r.status; error.data = data; throw error; } return data; };
const claimGuestAd = (platform) => (id, careerId, device, reward = null) => call('/api/account/ads/reward', { id, device, platform, ...(careerId ? { careerId } : {}), ...(reward ? { reward } : {}) });

try {
  // ---- an account (before the career: the harness of the long runs replaces some globals the account service needs): the same booking for /api/account/rewards/ad (once for each completion id, no limit), the poll videos unchanged
  {
    const proof = 'a'.repeat(64);
    const reg = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.77' }, body: JSON.stringify({ username: 'video-fondi', proof }) }), local.env);
    assert.equal(reg.status, 201, `Account di prova creato sul Worker locale: ${reg.status === 201 ? '' : await reg.clone().text()}`);
    const token = (await reg.json()).token;
    const first = await call('/api/account/rewards/ad', { id: 'apd-account-fondi-000000000000001', platform: 'android', reward: 'fondi' }, token);
    const again = await call('/api/account/rewards/ad', { id: 'apd-account-fondi-000000000000001', platform: 'android', reward: 'fondi' }, token);
    assert.equal(first.credited, true); assert.equal(again.duplicate, true, 'Account: la stessa visualizzazione è accreditata una volta sola.');
  }
  const run = await startCareer({ seed: 'video-fondi', level: 'comunale' });
  const store = run.store;
  const plugin = fakePlugin();
  const adapter = createAppodealAdapter({ plugin, config: resolveAppodeal(null, 'production') });
  const service = createRewardsService({ store, ads: { config: () => adapter.ids, provider: adapter.rewardedProvider, native: adapter.native }, claimGuestAd: claimGuestAd('android'), env: { ios: false } });
  const funds = await service.funds();
  assert.ok(funds, 'Su Android il servizio dei fondi esiste.');
  assert.equal(await service.funds(), funds, 'Le tre porte (Ricompense, attività, avvisi) usano lo stesso servizio.');
  // the pages import the module with the build stamp, as rewards-service.js does: the same instance, the same service
  const stamp = (await import('node:fs/promises')).readFile(new URL('../index.html', import.meta.url), 'utf8').then(html => html.match(/main\.js\?v=([^"']+)/)?.[1]);
  const { fundsOffer } = await import(`../src/ui/funds-ad.js?v=${await stamp}`);
  const money = () => store.getState().game.resources.funds;
  const treasury = () => store.getState().game.party?.org?.treasury?.balance ?? null;

  // ---- the offer: ready as soon as a rewarded video of `default` is loaded (no placement of its own to configure)
  let status = await funds.refresh();
  assert.equal(status.code, 'ready', 'Video caricato: disponibile, senza nessun placement da configurare.');
  // on the rewards page the title «1.000 € di fondi personali» is the card's own heading (rewards-page.js); the offer carries the description, the state and the button
  assert.match(fundsOffer('ricompense'), /ricevi 1\.000 € nella tua carriera/); assert.match(fundsOffer('attivita'), /1\.000 € di fondi personali/); assert.match(fundsOffer('ricompense'), /GUARDA IL VIDEO/); assert.match(fundsOffer('ricompense'), /Video disponibile/);
  assert.match(fundsOffer('attivita'), /data-funds-ad="attivita"/); assert.match(fundsOffer('alert'), /Guarda un video e ricevi 1\.000 €/);
  let out;

  // ---- 1-3. one video from each way in: +1.000 € each, to the personal funds, never to the treasury
  const ledger0 = store.getState().game.finance.ledger.length, treasury0 = treasury();
  for (const where of ['ricompense', 'attivita', 'avviso']) {
    const before = money();
    out = await (await service.funds()).watch();
    assert.equal(out.status, 'completed', `Video completato da «${where}».`);
    assert.equal(money(), before + 1000, `+1.000 € dai video di «${where}».`);
  }
  assert.deepEqual(plugin.calls.filter(([kind]) => kind === 'show').map(([, format, placement, keys]) => `${format}|${placement}|${keys}`), ['rewarded|default|format', 'rewarded|default|format', 'rewarded|default|format'], 'Sempre `default`: il gioco non chiede nessun altro placement.');
  const ledger = store.getState().game.finance.ledger;
  assert.equal(ledger.length, ledger0 + 3, 'Ogni accredito è nel registro contabile.');
  assert.ok(ledger.slice(0, 3).every(entry => entry.category === 'ricompense' && entry.amount === 1000 && entry.label === AD_FUNDS.label), 'Registro: categoria ricompense, 1.000 € ciascuno.');
  assert.equal(treasury(), treasury0, '11. Nulla alla tesoreria del partito.');
  assert.equal(store.getState().game.rewards.history.filter(entry => entry.kind === 'video-fondi').length, 3, 'Storico delle ricompense: tre accrediti.');

  // ---- 4. many videos in a row, no limit of the game (also beyond the 30 a day of the poll videos)
  for (const count of [2, 3, 10, 35]) {
    const before = money();
    for (let index = 0; index < count; index++) assert.equal((await funds.watch()).status, 'completed', `Video ${index + 1} di ${count}.`);
    assert.equal(money(), before + 1000 * count, `${count} video consecutivi: ${count * 1000} €.`);
  }

  // ---- 5-7, 14. closed early, load error, show error, no ad: nothing
  for (const [label, prepare, expected] of [
    ['chiuso prima della fine', () => { plugin.next.push('closed-early'); }, 'dismissed'],
    ['errore durante la visualizzazione', () => { plugin.next.push('show-failed'); }, 'dismissed'],
    ['nessun annuncio caricato', () => { plugin.loaded = false; }, ['unavailable', 'dismissed']]
  ]) {
    prepare();
    const before = money();
    out = await funds.watch();
    assert.ok([expected].flat().includes(out.status), `${label}: ${out.status}`);
    assert.ok(out.message && !/accreditati/.test(out.message), `${label}: messaggio chiaro, nessun accredito.`);
    assert.equal(money(), before, `${label}: saldo invariato.`);
    plugin.loaded = true;
  }
  plugin.loaded = false;
  assert.equal((await funds.refresh()).code, 'no-ad', '14. Senza annunci: «non ancora caricato».');
  assert.match(fundsOffer('attivita'), /non ancora caricato/);
  plugin.loaded = true; await funds.refresh();

  // ---- 8. a duplicated callback (the same completion id twice): one credit
  {
    const before = money();
    assert.equal((await funds.watch()).status, 'completed');
    plugin.next.push('same-id');
    out = await funds.watch();
    assert.equal(out.status, 'duplicate', 'La stessa visualizzazione due volte: rifiutata.');
    assert.equal(money(), before + 1000, 'Un solo accredito per una callback duplicata.');
    assert.equal((await store.claimFundsAdReward(plugin.lastId)).reason, 'duplicato', 'Anche il negozio rifiuta lo stesso id.');
  }
  // two requests at once: one video, the second is «busy» — also between the two kinds (one busy guard for every way in)
  {
    const before = money();
    const [a, b] = await Promise.all([funds.watch(), funds.watch()]);
    assert.deepEqual([a.status, b.status].sort(), ['busy', 'completed'], 'Due richieste contemporanee: un solo video.');
    assert.equal(money(), before + 1000);
    const pollsBefore = store.getState().game.rewards.ads.length;
    const [c, d] = await Promise.all([funds.watch(), service.ads.watch('sondaggi')]);
    assert.deepEqual([c.status, d.status], ['completed', 'busy'], 'Fondi e sondaggi insieme: un solo video, l’altro pulsante risponde «già in corso».');
    assert.equal(money(), before + 2000); assert.equal(store.getState().game.rewards.ads.length, pollsBefore, 'Il bonus sondaggi non è stato dato insieme ai fondi.');
    const [e, f] = await Promise.all([service.ads.watch('sondaggi'), funds.watch()]);
    assert.deepEqual([e.status, f.status], ['completed', 'busy'], 'Sondaggi e poi fondi: lo stesso blocco condiviso.');
    assert.equal(money(), before + 2000, 'Nessun fondo per il video del bonus sondaggi.');
    assert.equal(store.getState().game.rewards.ads.length, pollsBefore + 1);
  }
  // ---- one claim for each completion id, whatever the kind: an id taken as poll bonus is never paid as funds, and the other way round (Worker, store, device journal)
  {
    const pollId = store.getState().game.rewards.ads.at(-1), fundsId = store.getState().game.rewards.funds.at(-1);
    const device = service.journal.deviceId(), career = store.getState().career.id;
    assert.equal((await claimGuestAd('android')(pollId, career, device, 'fondi')).duplicate, true, 'Worker: un id già riscosso come bonus sondaggi non vale come fondi.');
    assert.equal((await claimGuestAd('android')(fundsId, career, device, 'sondaggi')).duplicate, true, 'Worker: un id già riscosso come fondi non vale come bonus sondaggi.');
    assert.equal((await claimGuestAd('android')(fundsId, career, device)).duplicate, true, 'Worker: anche senza tipo (client precedenti) l’id dei fondi è già riscosso.');
    assert.equal((await store.claimFundsAdReward(pollId)).reason, 'duplicato', 'Negozio: l’id del bonus sondaggi non è accreditato come fondi.');
    assert.equal(store.claimAdReward(fundsId).reason, 'duplicato', 'Negozio: l’id dei fondi non è accreditato come bonus sondaggi.');
    // the save alone (a new device: an empty journal) refuses it too
    const { creditFundsAd } = await import(`../src/core/funds-credit.js?v=${await stamp}`);
    const blank = { adSeen: () => false, adRemember: () => true };
    const game = JSON.parse(JSON.stringify(store.getState().game));
    assert.equal(creditFundsAd(game, { id: pollId }, blank), null, 'Salvataggio: l’id già usato per i sondaggi è rifiutato anche con un diario vuoto.');
    // the kind is the one of the request: a fresh id booked as funds by the Worker is not credited to the polls even if asked again as polls
    const fresh = 'apd-tipo-fisso-00000000000000001';
    assert.equal((await claimGuestAd('android')(fresh, career, device, 'fondi')).reward, 'fondi');
    assert.equal((await claimGuestAd('android')(fresh, career, device, 'sondaggi')).duplicate, true, 'Il tipo non cambia dopo la registrazione.');
  }

  // ---- 9-10. save, reload, reopening: the balance is the same, the last video is never paid again
  const saved = store.exportSave();
  const balance = money(), lastId = store.getState().game.rewards.funds.at(-1);   // (the last show was a poll video: the last FUNDS video is the one to try again)
  store.loadGame(JSON.parse(saved));
  assert.equal(money(), balance, '10. Dopo salvataggio e ricaricamento il saldo è lo stesso.');
  assert.ok(store.getState().game.rewards.funds.includes(lastId), 'Il salvataggio ricorda i video accreditati.');
  assert.equal((await store.claimFundsAdReward(lastId)).reason, 'duplicato', '9. Dopo la riapertura lo stesso video non è accreditato di nuovo.');
  await assert.rejects(claimGuestAd('android')(lastId, store.getState().career.id, service.journal.deviceId(), 'fondi').then(answer => { if (answer.duplicate) throw new Error('duplicato'); }), /duplicato/, 'Anche il Worker lo riconosce.');
  // a new service (the app reopened): the same rules
  const reopened = createRewardsService({ store, ads: { config: () => adapter.ids, provider: adapter.rewardedProvider, native: adapter.native }, claimGuestAd: claimGuestAd('android'), env: { ios: false } });
  const funds2 = await reopened.funds();
  await funds2.refresh();
  const before9 = money();
  assert.equal((await funds2.watch()).status, 'completed'); assert.equal(money(), before9 + 1000, 'Dopo la riapertura un nuovo video vale 1.000 €.');

  // ---- 12. the poll bonus of `default`: the same call, the same reward, its daily limit untouched by the funds videos
  {
    const shows = plugin.calls.filter(([kind]) => kind === 'show').length;
    const transfers = store.getState().world.transfers?.length ?? 0;
    const funds0 = money();
    const poll = await service.ads.watch('sondaggi');
    assert.equal(poll.status, 'completed', 'Il video del bonus sondaggi funziona come prima.');
    assert.equal(poll.kind, 'sondaggi');
    const last = plugin.calls.filter(([kind]) => kind === 'show').slice(shows);
    assert.deepEqual(last, [['show', 'rewarded', 'default', 'format']], 'Il bonus sondaggi usa lo stesso placement `default`.');
    assert.equal(money(), funds0, 'Il bonus sondaggi non tocca i fondi.');
    assert.ok((store.getState().world.transfers?.length ?? 0) > transfers || store.getState().game.rewards.history[0].kind === 'video', 'Il bonus sondaggi passa al mondo.');
    assert.equal(store.getState().game.rewards.history[0].requested, AD_REWARD.points, 'Stessi punti di prima (0,15).');
  }

  // ---- the Worker: the funds booking has no daily limit and is Android only
  {
    const ids = Array.from({ length: 40 }, (_, index) => `apd-limite${String(index).padStart(23, '0')}`);
    for (const id of ids) assert.equal((await claimGuestAd('android')(id, null, 'dev-limite', 'fondi')).credited, true, 'Nessun limite giornaliero per i fondi.');
    assert.equal((await claimGuestAd('android')('apd-sondaggi-dopo-i-fondi-0001', null, 'dev-limite', 'sondaggi')).credited, true, 'I video dei fondi non consumano il limite dei video sondaggi.');
    // the poll bonus keeps its daily limit (AD_DAILY_MAX of worker.js), the funds go on after it
    let refused = null;
    for (let index = 0; index < 60 && !refused; index++) { try { await claimGuestAd('android')(`apd-limite-sondaggi${String(index).padStart(12, '0')}`, null, 'dev-limite', 'sondaggi'); } catch (error) { refused = error; } }
    assert.ok(refused && refused.status === 429, 'Bonus sondaggi: il limite giornaliero resta.');
    assert.equal((await claimGuestAd('android')('apd-fondi-dopo-il-limite-00001', null, 'dev-limite', 'fondi')).credited, true, 'Fondi: nessun limite anche dopo il limite dei sondaggi.');
    await assert.rejects(claimGuestAd('ios')('apd-ios-000000000000000000000001', null, 'dev-ios', 'fondi'), error => error.status === 403, 'Su iOS il server rifiuta la ricompensa dei fondi.');
    await assert.rejects(claimGuestAd('android')('apd-altro-0000000000000000000001', null, 'dev-x', 'altro'), error => error.status === 403, 'Una ricompensa sconosciuta è rifiutata.');
  }

  // ---- 15. iOS: no new ad, no offer (no placement provider, ads off)
  {
    const iosAdapter = createAppodealAdapter({ plugin: null, config: resolveAppodeal(null, 'off') });
    const ios = createRewardsService({ store, ads: { config: () => iosAdapter.ids, provider: iosAdapter.rewardedProvider, native: iosAdapter.native }, claimGuestAd: claimGuestAd('ios'), env: { ios: true } });
    const iosFunds = await ios.funds();
    assert.equal((await iosFunds.refresh()).code, 'not-configured', 'iOS: video dei fondi non attivo.');
    assert.equal(fundsOffer('ricompense'), '', 'iOS: nessuna scheda.'); assert.equal(fundsOffer('alert'), '', 'iOS: nessuna offerta negli avvisi.');
    assert.equal((await iosFunds.watch()).status, 'unavailable', 'iOS: nessun annuncio.');
    const noNative = createRewardsService({ store, ads: { config: () => iosAdapter.ids, provider: iosAdapter.rewardedProvider } });
    assert.equal(await noNative.funds(), null, 'Senza il bridge nativo di Appodeal (iOS) l’offerta dei fondi non si carica.');
  }
  // ---- the button decides the kind, whatever page it is on: every poll-bonus button (Ricompense, Sondaggi) is `data-reward-video` and the app sends it as 'sondaggi'; every funds button (Ricompense,
  // attività «Risorse», Finanze, avvisi) is `data-funds-ad` and goes through the funds offer, which asks 'fondi'. Neither button carries the other's attribute, and no other code calls a video.
  {
    const { readFile } = await import('node:fs/promises');
    const app = await readFile(new URL('../src/ui/app.js', import.meta.url), 'utf8'), offer = await readFile(new URL('../src/ui/funds-ad.js', import.meta.url), 'utf8');
    const polls = await readFile(new URL('../src/ui/polls-mode.js', import.meta.url), 'utf8'), page = await readFile(new URL('../src/ui/rewards-page.js', import.meta.url), 'utf8');
    assert.match(app, /closest\('\[data-reward-video\]'\)\)\s*\{[\s\S]{0,400}ads\.watch\('sondaggi'\)/, 'Pulsante del bonus sondaggi → tipo «sondaggi».');
    assert.match(app, /closest\('\[data-funds-ad\]'\)\) \{ rewardsApi\?\.funds\(\)\.then\(f => f\?\.watch\(\)\)/, 'Pulsante dei fondi → offerta dei fondi.');
    assert.match(offer, /rewarded\.watch\('fondi'\)/, 'L’offerta dei fondi chiede il tipo «fondi».');
    assert.equal((app.match(/\.watch\(/g) ?? []).length, 2, 'Nell’app solo due avvii di video: uno per tipo.');
    for (const [name, text] of [['polls-mode.js', polls], ['rewards-page.js', page]]) assert.ok(text.includes('data-reward-video') && !/data-reward-video[^>]*data-funds-ad|data-funds-ad[^>]*data-reward-video/.test(text), `${name}: il pulsante del bonus sondaggi non porta l’attributo dei fondi.`);
    assert.ok(!/data-reward-video/.test(offer), 'L’offerta dei fondi non usa il pulsante del bonus sondaggi.');
    // a double click from two different pages: one video (the shared busy guard), and the kind of the first one
    const [first, second] = await Promise.all([funds.watch(), service.ads.watch('sondaggi')]);
    assert.deepEqual([first.status, second.status], ['completed', 'busy'], 'Doppio clic da due pagine: un solo video, del tipo del primo pulsante.');
  }
  // ---- nothing of the old placement of its own is left in the code
  {
    const { readFile } = await import('node:fs/promises');
    for (const file of ['src/ui/funds-ad.js', 'src/ui/rewards-service.js', 'src/data/repositories/appodeal-adapter.js', 'src/data/simulation/funds-ad-rules.js', 'worker.js', 'plugins/appodeal-ads/src/definitions.ts', 'plugins/appodeal-ads/android/src/main/java/it/matteobianchi/politicando/appodeal/AppodealAdsPlugin.kt']) {
      const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.doesNotMatch(text, /personal_funds_1000|FUNDS_PLACEMENT|rewardedPlacement/, `${file}: nessun placement personalizzato.`);
    }
  }
  console.log('Due video premiati su un solo placement `default` verificati: il tipo è quello del pulsante, tre porte un servizio, +1.000 € a ogni video completato (2, 3, 10, 35 di fila), nulla per video chiusi, falliti o assenti, una sola volta per callback duplicate, riapertura e ricaricamento, solo fondi personali, bonus sondaggi invariato, Worker senza limite e solo Android, niente su iOS.');
} finally {
  await local.close?.();
}
