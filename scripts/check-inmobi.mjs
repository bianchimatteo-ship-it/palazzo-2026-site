// InMobi, the only advertising provider (Android + iOS), checked without a device and without any network: the safe defaults and the validation of the remote configuration (what the owner may change from the Worker
// without a new app), the consent before every request, the rewarded video credited ONLY on the SDK's confirmation (Android onRewardsUnlocked / iOS rewardActionCompletedWithRewards, turned into `rewarded: true`
// by the native plugin), no double reward, no reward for a closed video, no network / SDK missing, the banner and interstitial policy (pages, frequency from the configuration), the +0.15 points from the configuration,
// the Worker (public configuration, booking of every credit for accounts and guests, disabled format refused, one credit for each completion, daily limit) and the absence of any AdMob code or id.
// The native code is checked in check-inmobi-native.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const build = fs.readFileSync(new URL('index.html', ROOT), 'utf8').match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`${path}?v=${build}&inmobi=1`, ROOT).href);
const { INMOBI, ADS_MODE, ADS_PROVIDER, BANNER_PAGES, INTERSTITIAL, LIMITS, defaultAds, resolveAds } = await load('src/data/ads-config.js');
const { createInMobiAdapter } = await load('src/data/repositories/inmobi-adapter.js');
const { createAdsManager } = await load('src/data/repositories/ads-manager.js');
const { createRewardedAds } = await load('src/data/repositories/ads-rewarded.js');
const rules = await load('src/data/simulation/reward-rules.js');
const ACCOUNT = '60d3e31b9c094bd69283e287bc2d4c42';
const lines = [];

// ---------- 1. safe defaults and identifiers ----------
assert.equal(ADS_PROVIDER, 'inmobi'); assert.equal(ADS_MODE, 'off', 'Modalità predefinita: off (nessuna pubblicità, nessuna richiesta di consenso all’avvio).');
assert.deepEqual({ ...INMOBI.placements }, { rewarded: '10000884972', banner: '10000884973', interstitial: '10000884974' }, 'I Placement ID sono quelli del proprietario.');
assert.equal(INMOBI.appKey, '10000256631'); assert.deepEqual({ ...INMOBI.sdk }, { android: '11.5.1', ios: '11.5.0' });
for (const platform of ['android', 'ios']) {
  const d = defaultAds(platform);
  assert.equal(d.enabled, false); assert.equal(d.accountId, '60d3e31b9c094bd69283e287bc2d4c42', 'L’Account ID è quello del titolare, ma da solo non accende nulla.');
  for (const format of ['rewarded', 'banner', 'interstitial']) assert.equal(d[format].enabled, false, `${platform}/${format}: spento di base.`);
  assert.equal(d.rewardPoints, 0.15); assert.deepEqual({ ...d.interstitialPolicy }, { ...INTERSTITIAL });
}
assert.ok(new Set([INMOBI.appKey, INMOBI.accountId, ...Object.values(INMOBI.placements)]).size === 5, 'App Key, Placement ID e Account ID restano distinti.');
lines.push('predefiniti sicuri (tutto spento, nessun Account ID inventato), id del proprietario');

// ---------- 2. the remote configuration: validated, clamped, per platform ----------
const remote = { enabled: true, android: { accountId: ACCOUNT, mode: 'test', rewarded: { enabled: true }, banner: { enabled: true, placementId: '10000884973' }, interstitial: { enabled: false }, interstitialPolicy: { everyWeeks: 5, perDay: 2, minGapMs: 120000 }, rewardPoints: 0.2 }, ios: { accountId: ACCOUNT, rewarded: { enabled: true } } };
const a = resolveAds('android', remote), i = resolveAds('ios', remote);
assert.equal(a.enabled, true); assert.equal(a.rewarded.enabled, true); assert.equal(a.banner.enabled, true); assert.equal(a.interstitial.enabled, false);
assert.equal(a.testing, true, 'In modalità test.'); assert.equal(a.rewardPoints, 0.2); assert.deepEqual({ ...a.interstitialPolicy }, { everyWeeks: 5, minGapMs: 120000, perDay: 2 });
assert.equal(i.rewarded.enabled, true); assert.equal(i.banner.enabled, false, 'Ogni piattaforma ha le sue impostazioni.');
assert.equal(resolveAds('android', { ...remote, android: { ...remote.android, accountId: 'non-valido' } }).enabled, false, 'Account ID malformato: nessun formato si accende.');
assert.equal(resolveAds('android', { android: { rewarded: { enabled: true } } }).accountId, '60d3e31b9c094bd69283e287bc2d4c42', 'Senza accountId remoto vale quello del titolare.'); assert.equal(resolveAds('android', { android: {} }).enabled, false, 'Con l’Account ID ma nessun formato acceso: tutto spento.');
assert.equal(resolveAds('android', { ...remote, android: { ...remote.android, accountId: '10000256631' } }).enabled, false, 'L’App Key non è un Account ID.');
assert.equal(resolveAds('android', { ...remote, enabled: false }).enabled, false, 'Interruttore generale.');
assert.equal(resolveAds('android', { ...remote, android: { ...remote.android, mode: 'off' } }).enabled, false, 'Modalità off.');
assert.equal(resolveAds('android', { ...remote, android: { ...remote.android, mode: 'live' } }).testing, false, 'Reale solo se la configurazione lo dice.');
assert.equal(resolveAds('android', { android: { accountId: ACCOUNT, mode: 'qualcosa' , rewarded: { enabled: true } } }).testing, true, 'Un valore sconosciuto torna a «test».');
assert.equal(resolveAds('android', { android: { accountId: ACCOUNT, rewarded: { enabled: 'sì' } } }).rewarded.enabled, false, 'Solo true accende.');
assert.equal(resolveAds('android', { android: { accountId: ACCOUNT, rewarded: { enabled: true, placementId: 'abc;drop' } } }).rewarded.placementId, INMOBI.placements.rewarded, 'Placement ID malformato: torna il predefinito.');
assert.equal(resolveAds('android', { android: { accountId: ACCOUNT, rewarded: { enabled: true, placementId: '10000999999' } } }).rewarded.placementId, '10000999999', 'Placement ID modificabile dalla configurazione.');
for (const bad of [-1, 5, 'x', null, NaN]) assert.equal(resolveAds('android', { android: { accountId: ACCOUNT, rewardPoints: bad } }).rewardPoints, 0.15, `Punti fuori limite (${bad}): torna 0,15.`);
assert.equal(resolveAds('android', { android: { accountId: ACCOUNT, interstitialPolicy: { everyWeeks: 0, perDay: 99, minGapMs: 5 } } }).interstitialPolicy.everyWeeks, INTERSTITIAL.everyWeeks, 'Frequenza fuori limite: predefinita.');
for (const junk of [null, undefined, 'x', 42, [], { android: 'x' }]) assert.equal(resolveAds('android', junk).enabled, false, 'Configurazione non valida: tutto spento.');
assert.equal(resolveAds('windows', remote).enabled, false, 'Piattaforma sconosciuta: spento.');
assert.equal(rules.setAdRewardPoints(0.2), 0.2); assert.equal(rules.AD_REWARD.points, 0.2, 'I punti del video seguono la configurazione.');
assert.equal(rules.setAdRewardPoints(9), 0.15); assert.equal(rules.AD_REWARD.points, 0.15, 'Fuori limite: 0,15.'); rules.setAdRewardPoints(0.15);
lines.push('configurazione remota: validazione, limiti, per piattaforma, punti e frequenza');

// ---------- 3. the adapter with a fake native plugin ----------
const fakePlugin = (over = {}) => {
  const calls = [];
  const plugin = { calls,
    requestConsent: async o => { calls.push('consent'); return { canRequestAds: true, status: 'OBTAINED', privacyOptionsRequired: true, ...over.consent }; },
    initialize: async o => { calls.push('init:' + o.accountId); return over.init ?? { ok: true }; },
    loadAd: async o => { calls.push('load:' + o.format + ':' + o.placementId); return over.load ?? { ready: true }; },
    showAd: async o => { calls.push('show:' + o.format); return over.show ? over.show(o) : (o.format === 'rewarded' ? { shown: true, rewarded: true, completionId: 'imb-' + calls.length + 'abcdef0123456789' } : { shown: true }); },
    showBanner: async o => { calls.push('banner:' + o.placementId); return { shown: true }; }, hideBanner: async () => { calls.push('hide'); }, showPrivacyOptions: async () => { calls.push('privacy'); } };
  return plugin;
};
const on = (formats = {}) => resolveAds('android', { android: { accountId: ACCOUNT, rewarded: { enabled: true }, banner: { enabled: true }, interstitial: { enabled: true }, ...formats } });
{
  // no consent → nothing asked of the SDK, nothing loaded
  const p = fakePlugin({ consent: { canRequestAds: false, status: 'REQUIRED' } });
  const adapter = createInMobiAdapter({ plugin: p, config: on() });
  assert.deepEqual(await adapter.status(), { ok: false, code: 'no-consent' }); assert.equal(await adapter.rewardedProvider.isReady(), false);
  assert.equal(await adapter.showBanner(), false); assert.equal(await adapter.showInterstitial(), false);
  assert.deepEqual(p.calls, ['consent'], 'Rifiuto del consenso: nessuna inizializzazione, nessuna richiesta di annuncio.');
  // consent first, then init with the Account ID, then the ad
  const q = fakePlugin(); const ok = createInMobiAdapter({ plugin: q, config: on() });
  assert.equal(await ok.rewardedProvider.isReady(), true);
  assert.deepEqual(q.calls, ['consent', 'init:' + ACCOUNT, 'load:rewarded:10000884972'], 'Prima il consenso, poi l’SDK con l’Account ID, poi il caricamento.');
  // SDK missing / network absent / init failure / load failure / throwing plugin: never an exception, never a reward
  for (const [name, plugin] of [['plugin assente', null], ['init fallita', fakePlugin({ init: { ok: false, code: 'init-failed' } })], ['nessuna rete (caricamento fallito)', fakePlugin({ load: { ready: false, code: 'NETWORK_UNREACHABLE' } })], ['plugin che solleva errori', { requestConsent: async () => { throw new Error('boom'); }, initialize: async () => { throw new Error('boom'); }, loadAd: async () => { throw new Error('boom'); }, showAd: async () => { throw new Error('boom'); }, showBanner: async () => { throw new Error('boom'); }, hideBanner: async () => { throw new Error('boom'); } }]]) {
    const adapter = createInMobiAdapter({ plugin, config: on() });
    assert.equal(await adapter.rewardedProvider.isReady(), false, `${name}: video non disponibile.`);
    assert.deepEqual(await adapter.rewardedProvider.show(), { completed: false, verified: false }, `${name}: nessun premio.`);
    if (!name.startsWith('nessuna rete')) assert.equal(await adapter.showBanner(), false);   // (a banner without network is the SDK's own retry: the overlay may exist but shows nothing)
    assert.equal(await adapter.showInterstitial(), false); await adapter.hideBanner();
  }
  // formats off by configuration: nothing is called for them
  const r = fakePlugin(); const offAdapter = createInMobiAdapter({ plugin: r, config: on({ rewarded: { enabled: false }, banner: { enabled: false }, interstitial: { enabled: false } }) });
  assert.equal(await offAdapter.rewardedProvider.isReady(), false); assert.equal(await offAdapter.showBanner(), false); assert.equal(await offAdapter.showInterstitial(), false); assert.deepEqual(r.calls, [], 'Tutti i formati spenti: nessuna chiamata al plugin.');
  // default configuration (no Account ID): the plugin is never touched
  const s = fakePlugin(); const idle = createInMobiAdapter({ plugin: s, config: defaultAds('android') }); assert.equal(await idle.rewardedProvider.isReady(), false); assert.deepEqual(s.calls, []);
  // the website (no native plugin): nothing
  assert.equal(await createInMobiAdapter({ plugin: null, config: defaultAds('android') }).rewardedProvider.isReady(), false);
  // the configuration arrives later: the adapter follows it
  const t = fakePlugin(); const late = createInMobiAdapter({ plugin: t, config: defaultAds('ios') }); assert.equal(await late.rewardedProvider.isReady(), false);
  late.setConfig(resolveAds('ios', remote)); assert.equal(await late.rewardedProvider.isReady(), true, 'Dopo la configurazione remota il video diventa disponibile.');
}
lines.push('adattatore: consenso prima di tutto, rifiuto, SDK assente, nessuna rete, errori, formati spenti');

// ---------- 4. the rewarded video: the reward only on the SDK's confirmation ----------
{
  let granted = 0; const ids = new Set();
  const grant = id => { if (ids.has(id)) return { ok: false, reason: 'duplicato' }; ids.add(id); granted += 1; return { ok: true }; };
  const adapter = createInMobiAdapter({ plugin: fakePlugin(), config: on() });
  const ads = createRewardedAds({ config: on(), provider: adapter.rewardedProvider, grant });
  assert.equal((await ads.watch()).status, 'completed'); assert.equal(granted, 1, 'Un video completato: un premio.');
  // closed early (the SDK never confirmed): nothing
  const early = createInMobiAdapter({ plugin: fakePlugin({ show: async () => ({ shown: true, rewarded: false }) }), config: on() });
  assert.equal((await createRewardedAds({ config: on(), provider: early.rewardedProvider, grant }).watch()).status, 'dismissed'); assert.equal(granted, 1, 'Video interrotto: nessun premio.');
  // «rewarded» without an id, or from a failed show, is not a completion
  for (const out of [{ shown: true, rewarded: true }, { shown: false, rewarded: true, completionId: 'imb-0123456789' }, { rewarded: 'true', completionId: 'imb-0123456789' }]) {
    const odd = createInMobiAdapter({ plugin: fakePlugin({ show: async () => out }), config: on() });
    const result = await createRewardedAds({ config: on(), provider: odd.rewardedProvider, grant }).watch();
    assert.notEqual(result.status, 'completed', `Risposta anomala ${JSON.stringify(out)}: nessun premio.`);
  }
  assert.equal(granted, 1);
  // the same completion id twice (a repeated callback) is paid once
  const fixed = createInMobiAdapter({ plugin: fakePlugin({ show: async () => ({ shown: true, rewarded: true, completionId: 'imb-identico-0001' }) }), config: on() });
  const twice = createRewardedAds({ config: on(), provider: fixed.rewardedProvider, grant });
  assert.equal((await twice.watch()).status, 'completed'); assert.equal((await twice.watch()).status, 'duplicate'); assert.equal(granted, 2, 'Lo stesso completamento non paga due volte.');
  // two taps together are one video
  const slow = createInMobiAdapter({ plugin: fakePlugin({ show: async () => { await new Promise(r => setTimeout(r, 20)); return { shown: true, rewarded: true, completionId: 'imb-lento-000001' }; } }), config: on() });
  const both = createRewardedAds({ config: on(), provider: slow.rewardedProvider, grant });
  const [x, y] = await Promise.all([both.watch(), both.watch()]); assert.deepEqual([x.status, y.status].sort(), ['busy', 'completed'], 'Due tocchi insieme: un solo video.');
  // the server refuses the credit (offline, limit): no reward
  const refused = createRewardedAds({ config: on(), provider: createInMobiAdapter({ plugin: fakePlugin(), config: on() }).rewardedProvider, grant: () => ({ ok: false, reason: 'rete' }) });
  assert.equal((await refused.watch()).status, 'failed', 'Senza conferma del server nessun premio.');
}
lines.push('video con premio: premio solo con la conferma dell’SDK, niente premio se interrotto/anomalo/doppio/senza server');

// ---------- 5. banner and interstitial policy ----------
{
  const p = fakePlugin(); const adapter = createInMobiAdapter({ plugin: p, config: on({ interstitialPolicy: { everyWeeks: 2, perDay: 3, minGapMs: 60000 } }) });
  let t = 1_000_000; const store = { getItem: () => null, setItem() {} };
  const manager = createAdsManager({ adapter, storage: store, now: () => t, policy: () => adapter.ids.interstitialPolicy });
  assert.equal(await manager.syncBanner({ page: 'panoramica' }), false, 'Mai sulla home.'); assert.equal(await manager.syncBanner({ page: 'ricompense', blocked: true }), false, 'Mai durante una scena o un voto.');
  assert.equal(await manager.syncBanner({ page: 'ricompense' }), true, 'Sulle pagine secondarie sì.'); assert.ok(BANNER_PAGES.includes('ricompense') && !BANNER_PAGES.includes('panoramica'));
  const quiet = { game: {} }, busy = { game: {}, scene: {} };
  assert.equal(await manager.onWeekClosed(quiet), false, 'Dopo una sola settimana: no (ogni 2).'); assert.equal(await manager.onWeekClosed(busy), false, 'Durante una scena: mai.');
  assert.equal(await manager.onWeekClosed(quiet), true, 'Ogni 2 settimane, a un momento naturale: sì.');
  t += 1000; await manager.onWeekClosed(quiet); assert.equal(await manager.onWeekClosed(quiet), false, 'Mai prima dell’intervallo minimo.');
  t += 61_000; assert.equal(await manager.onWeekClosed(quiet), true, 'Passato l’intervallo minimo: di nuovo sì.');
  assert.equal(p.calls.filter(c => c === 'show:interstitial').length, 2, 'Il numero degli interstitial rispetta la frequenza.');
  // the frequency comes from the configuration: perDay 0 switches the interstitials off without a new app
  adapter.setConfig(on({ interstitialPolicy: { perDay: 0 } })); t += 3_600_000; for (let n = 0; n < 6; n++) assert.equal(await manager.onWeekClosed(quiet), false);
  // a banner turned off remotely disappears
  adapter.setConfig(on({ banner: { enabled: false } })); await manager.syncBanner({ page: 'ricompense' }); assert.equal(adapter.isBannerShown(), false); assert.ok(p.calls.includes('hide'));
  // after a rewarded video no interstitial for a while
  manager.noteRewarded(); adapter.setConfig(on({ interstitialPolicy: { everyWeeks: 1, perDay: 12, minGapMs: 600000 } })); assert.equal(await manager.onWeekClosed(quiet), false, 'Subito dopo un video con premio: nessun interstitial.');
}
lines.push('banner (pagine secondarie) e interstitial (momenti naturali, frequenza dalla configurazione)');

// ---------- 6. the Worker: public configuration and the booking of every credit ----------
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8795 });
try {
  const get = async path => { const r = await fetch(`${local.origin}${path}`); return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') }; };
  const post = async (path, body) => { const r = await fetch(`${local.origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  // no variable: everything off
  let cfg = await get('/api/account/ads/config');
  assert.equal(cfg.status, 200); assert.equal(cfg.body.android.enabled, false); assert.equal(cfg.body.ios.enabled, false); assert.equal(cfg.body.android.rewarded.enabled, false); assert.equal(cfg.body.android.enabled, false);
  assert.match(cfg.cache ?? '', /max-age/, 'La configurazione ha una cache breve.');
  assert.equal((await post('/api/account/ads/reward', { id: 'imb-spento-000001', device: 'dev-1' })).status, 403, 'Formato spento: il credito è rifiutato dal server.');
  // an invalid variable is the same as none
  local.env.ADS_CONFIG = '{non json'; assert.equal((await get('/api/account/ads/config')).body.android.enabled, false);
  // the owner turns the rewarded format on for Android only, with 0.2 points
  local.env.ADS_CONFIG = JSON.stringify({ android: { accountId: ACCOUNT, rewarded: { enabled: true }, rewardPoints: 0.2 }, ios: { accountId: ACCOUNT } });
  cfg = await get('/api/account/ads/config');
  assert.equal(cfg.body.android.rewarded.enabled, true); assert.equal(cfg.body.android.rewardPoints, 0.2); assert.equal(cfg.body.ios.rewarded.enabled, false);
  assert.ok(!JSON.stringify(cfg.body).includes('ADS_CONFIG') && !/secret|token|password/i.test(JSON.stringify(cfg.body)), 'Niente di segreto nella configurazione pubblica.');
  const first = await post('/api/account/ads/reward', { id: 'imb-ospite-000001', device: 'dev-1', platform: 'android' });
  assert.equal(first.status, 200); assert.equal(first.body.credited, true); assert.equal(first.body.points, 0.2, 'Il server risponde con i punti in vigore.');
  const again = await post('/api/account/ads/reward', { id: 'imb-ospite-000001', device: 'dev-1', platform: 'android' });
  assert.equal(again.body.credited, false); assert.equal(again.body.duplicate, true, 'Lo stesso completamento non è accreditato due volte.');
  const burst = await Promise.all(Array.from({ length: 5 }, () => post('/api/account/ads/reward', { id: 'imb-raffica-000001', device: 'dev-2', platform: 'android' })));
  assert.equal(burst.filter(item => item.body.credited === true).length, 1, 'Richieste in parallelo: un solo credito.');
  assert.equal((await post('/api/account/ads/reward', { id: 'imb-ios-0000001', device: 'dev-1', platform: 'ios' })).status, 403, 'iOS ha il formato spento: rifiutato.');
  assert.equal((await post('/api/account/ads/reward', { id: 'imb-piattaforma-1', device: 'dev-1', platform: 'windows' })).status, 400, 'Piattaforma sconosciuta: rifiutata.');
  for (const bad of [{ id: 'x', device: 'dev-1' }, { id: 'con spazi non validi', device: 'dev-1' }, { id: 'imb-senza-device-1' }, { id: 'imb-dispositivo-1', device: 'sp azi' }]) assert.equal((await post('/api/account/ads/reward', bad)).status, 400, `Richiesta non valida rifiutata (${JSON.stringify(bad)}).`);
  let credited = 0, limited = 0; for (let n = 0; n < 33; n++) { const out = await post('/api/account/ads/reward', { id: `imb-limite-${String(n).padStart(6, '0')}`, device: 'dev-3', platform: 'android' }); if (out.body.credited) credited += 1; else if (out.status === 429) limited += 1; }
  assert.equal(credited, 30, 'Limite giornaliero: 30 video.'); assert.equal(limited, 3);
} finally { await local.close(); }
lines.push('Worker: configurazione pubblica, credito validato dal server per ospiti e account, formato spento rifiutato, un solo credito, limite giornaliero');

// ---------- 7. no AdMob left, no invented id ----------
const files = fs.readdirSync(new URL('src/', ROOT), { recursive: true }).filter(name => /\.(js|json|html|css)$/.test(name) && !/^data\/(real|i18n)\//.test(name) && !/release-pairs|dictionary/.test(name)).map(name => [`src/${name}`, fs.readFileSync(new URL(`src/${name}`, ROOT), 'utf8')]);
for (const [name, text] of [...files, ['worker.js', fs.readFileSync(new URL('worker.js', ROOT), 'utf8')], ['package.json', fs.readFileSync(new URL('package.json', ROOT), 'utf8')], ['android/app/src/main/AndroidManifest.xml', fs.readFileSync(new URL('android/app/src/main/AndroidManifest.xml', ROOT), 'utf8')], ['android/app/capacitor.build.gradle', fs.readFileSync(new URL('android/app/capacitor.build.gradle', ROOT), 'utf8')]]) {
  // the only AdMob thing allowed is the owner's APPLICATION id (with «~») in the manifest, for the Google UMP SDK (see check-inmobi-native); no Ad Unit id, no Mobile Ads SDK anywhere
  const scanned = name.endsWith('AndroidManifest.xml') ? text.replace(/<meta-data\s+android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s+android:value="ca-app-pub-6404822903303014~1677702221"\s*\/>/, '').replace(/<!--[\s\S]*?-->/g, '') : text;
  assert.ok(!/ca-app-pub-|capacitor-community\/admob|capacitor-community-admob|play-services-ads|com\.google\.android\.gms\.ads\.APPLICATION_ID/.test(scanned), `${name}: nessun resto di AdMob.`);
}
assert.ok(!fs.existsSync(new URL('src/data/repositories/admob-adapter.js', ROOT)), 'Il vecchio adattatore AdMob è stato eliminato.');
assert.ok(!fs.existsSync(new URL('node_modules/@capacitor-community/admob', ROOT)), 'Il pacchetto AdMob non è più installato.');
lines.push('nessun resto di AdMob (adattatore, SDK, manifest, id)');

console.log(`InMobi verificato (${lines.length} gruppi):\n- ${lines.join('\n- ')}`);
