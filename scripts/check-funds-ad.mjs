// The rewarded video of 1.000 € of personal funds (Appodeal placement `personal_funds_1000`, Android): a scripted native plugin (the answers of plugins/appodeal-ads, Kotlin), the real adapter
// (data/repositories/appodeal-adapter.js), the real rewards service and its lazy funds service (ui/rewards-service.js, ui/funds-ad.js), the real store and the real Worker code (local stand-in of
// Cloudflare). What is checked: the placement is never shown unless Appodeal reports ITS reward (no fall-back on `default`), every completed video is 1.000 € to the personal funds (never the party's
// treasury) with no limit of the game, nothing for a video closed early, failed or not loaded, one credit for a duplicated callback, after a reopening and after a save and reload, the poll bonus of
// the `default` placement exactly as before, and nothing on iOS.
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
    calls: [], loaded: true, placementReward: { amount: 0.15, currency: 'punti' }, canShow: true, next: [], ids: 0,
    async requestConsent() { return { canRequestAds: true, status: 'OBTAINED', privacyOptionsRequired: false }; },
    async initialize() { return { ok: true }; },
    async loadAd() { return { ready: plugin.loaded }; },
    // Appodeal answers for an unknown placement with the settings of `default`: here `placementReward` is that answer until the dashboard is configured
    async rewardedPlacement({ placement }) { plugin.calls.push(['check', placement]); return { placement, loaded: plugin.loaded, canShow: plugin.canShow, ...plugin.placementReward }; },
    async showAd(options) {
      plugin.calls.push(['show', options.format, options.placement ?? 'default']);
      if (!plugin.loaded) return { shown: false, rewarded: false, code: 'not-ready' };   // the native side checks Appodeal.isLoaded first
      const outcome = plugin.next.shift() ?? 'complete';
      if (outcome === 'show-failed') return { shown: false, rewarded: false, code: 'show-failed' };
      if (outcome === 'closed-early') return { shown: true, rewarded: false };
      const id = outcome === 'same-id' ? plugin.lastId : `apd-${String(++plugin.ids).padStart(32, '0')}`;
      plugin.lastId = id;
      const out = { shown: true, rewarded: true, completionId: id };
      // the Kotlin bridge adds placement, amount and currency only for a placement other than `default`
      if (options.placement && options.placement !== 'default') Object.assign(out, { placement: options.placement, amount: plugin.placementReward.amount, currency: plugin.placementReward.currency });
      return out;
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

  // ---- 13. the placement is not configured yet: Appodeal answers with the reward of `default` → never shown, nothing credited
  let status = await funds.refresh();
  assert.equal(status.code, 'placement', 'Placement non configurato: il video da 1.000 € non è disponibile.');
  assert.ok(!status.available);
  const before0 = money();
  let out = await funds.watch();
  assert.equal(out.status, 'unavailable', 'Con il placement non configurato non si mostra nulla.');
  assert.ok(!plugin.calls.some(([kind, , placement]) => kind === 'show' && placement === AD_FUNDS.placement), 'Nessun annuncio del nuovo placement è stato richiesto.');
  assert.ok(!plugin.calls.some(([kind]) => kind === 'show'), 'Né il nuovo né `default`: il bonus sondaggi non viene attribuito per sbaglio.');
  assert.equal(money(), before0, 'Saldo invariato.');
  assert.match(fundsOffer('ricompense'), /Non ancora disponibile/, 'La scheda dice chiaramente che il video non è ancora attivo.');
  assert.equal(fundsOffer('alert'), '', 'Negli avvisi l’offerta compare solo quando un video è pronto.');

  // the dashboard is configured: placement personal_funds_1000, amount 1000, currency «Fondi personali»
  plugin.placementReward = { amount: 1000, currency: 'Fondi personali' };
  status = await funds.refresh();
  assert.equal(status.code, 'ready', 'Placement configurato e video caricato: disponibile.');
  // on the rewards page the title «1.000 € di fondi personali» is the card's own heading (rewards-page.js); the offer carries the description, the state and the button
  assert.match(fundsOffer('ricompense'), /ricevi 1\.000 € nella tua carriera/); assert.match(fundsOffer('attivita'), /1\.000 € di fondi personali/); assert.match(fundsOffer('ricompense'), /GUARDA IL VIDEO/); assert.match(fundsOffer('ricompense'), /Video disponibile/);
  assert.match(fundsOffer('attivita'), /data-funds-ad="attivita"/); assert.match(fundsOffer('alert'), /Guarda un video e ricevi 1\.000 €/);

  // ---- 1-3. one video from each way in: +1.000 € each, to the personal funds, never to the treasury
  const ledger0 = store.getState().game.finance.ledger.length, treasury0 = treasury();
  for (const where of ['ricompense', 'attivita', 'avviso']) {
    const before = money();
    out = await (await service.funds()).watch();
    assert.equal(out.status, 'completed', `Video completato da «${where}».`);
    assert.equal(money(), before + 1000, `+1.000 € dai video di «${where}».`);
  }
  assert.deepEqual(plugin.calls.filter(([kind]) => kind === 'show').map(([, , placement]) => placement), [AD_FUNDS.placement, AD_FUNDS.placement, AD_FUNDS.placement], 'Sempre il placement specifico, mai `default`.');
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
  // two requests at once: one video, the second is «busy»
  {
    const before = money();
    const [a, b] = await Promise.all([funds.watch(), funds.watch()]);
    assert.deepEqual([a.status, b.status].sort(), ['busy', 'completed'], 'Due richieste contemporanee: un solo video.');
    assert.equal(money(), before + 1000);
  }

  // ---- 9-10. save, reload, reopening: the balance is the same, the last video is never paid again
  const saved = store.exportSave();
  const balance = money(), lastId = plugin.lastId;
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
    const poll = await service.ads.watch();
    assert.equal(poll.status, 'completed', 'Il video del bonus sondaggi funziona come prima.');
    const last = plugin.calls.filter(([kind]) => kind === 'show').slice(shows);
    assert.deepEqual(last, [['show', 'rewarded', 'default']], 'Il bonus sondaggi usa `default`, senza placement.');
    assert.equal(money(), funds0, 'Il bonus sondaggi non tocca i fondi.');
    assert.ok((store.getState().world.transfers?.length ?? 0) > transfers || store.getState().game.rewards.history[0].kind === 'video', 'Il bonus sondaggi passa al mondo.');
    assert.equal(store.getState().game.rewards.history[0].requested, AD_REWARD.points, 'Stessi punti di prima (0,15).');
  }

  // ---- the Worker: the funds booking has no daily limit and is Android only
  {
    const ids = Array.from({ length: 40 }, (_, index) => `apd-limite${String(index).padStart(23, '0')}`);
    for (const id of ids) assert.equal((await claimGuestAd('android')(id, null, 'dev-limite', 'fondi')).credited, true, 'Nessun limite giornaliero per i fondi.');
    assert.equal((await claimGuestAd('android')('apd-sondaggi-dopo-i-fondi-0001', null, 'dev-limite')).credited, true, 'I video dei fondi non consumano il limite dei video sondaggi.');
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
    const noPlacements = createRewardsService({ store, ads: { config: () => iosAdapter.ids, provider: iosAdapter.rewardedProvider } });
    assert.equal(await noPlacements.funds(), null, 'Senza un provider di placement (InMobi su iOS) il servizio non si carica.');
  }
  console.log('Video premiato da 1.000 € verificato: placement specifico mai ricondotto a `default`, tre porte un servizio, +1.000 € a ogni video completato (2, 3, 10, 35 di fila), nulla per video chiusi, falliti o assenti, una sola volta per callback duplicate, riapertura e ricaricamento, solo fondi personali, bonus sondaggi invariato, Worker senza limite e solo Android, niente su iOS.');
} finally {
  await local.close?.();
}
