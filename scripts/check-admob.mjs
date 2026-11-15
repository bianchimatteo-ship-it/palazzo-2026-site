// AdMob on Android (Google Mobile Ads SDK + UMP through @capacitor-community/admob), checked without a device and without any network: the configuration (mode off in the repository, Google TEST ids in test mode, the owner's
// ids only in live mode and only for Android), the consent before every request, the banner / interstitial policy, the rewarded video credited ONLY on the SDK's earned-reward callback, one credit for each completion,
// and the separation of the platforms (nothing of Android's ids or plugin on iOS). The Worker side of the credit (one row per account and completion, daily limit, deletion) is in check-rewards-sync.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const build = (await readFile(`${ROOT}index.html`, 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(`../${path}?v=${build}&admob=1`);
const { ADS_MODE, ADS_PLATFORMS, GOOGLE_TEST_IDS, BANNER_PAGES, INTERSTITIAL, resolveAds } = await load('src/data/ads-config.js');
const { createAdMobAdapter } = await load('src/data/repositories/admob-adapter.js');
const { createAdsManager, interruptible } = await load('src/data/repositories/ads-manager.js');
const { createRewardedAds } = await load('src/data/repositories/ads-rewarded.js');

const OWNER = { appId: 'ca-app-pub-6404822903303014~1677702221', bannerId: 'ca-app-pub-6404822903303014/4792704744', interstitialId: 'ca-app-pub-6404822903303014/5092627610', rewardedUnitId: 'ca-app-pub-6404822903303014/6230148140' };

// ---------- 1. configuration ----------
assert.equal(ADS_MODE, 'off', 'Nel repository gli annunci sono spenti (modalità off): reali e di prova si attivano solo a mano.');
assert.deepEqual({ ...ADS_PLATFORMS.android }, OWNER, 'Android usa gli identificativi creati dal titolare (App ID, banner, interstitial, rewarded).');
assert.deepEqual({ ...ADS_PLATFORMS.ios }, { appId: null, bannerId: null, interstitialId: null, rewardedUnitId: null }, 'iOS non ha identificativi AdMob: servono un App ID e unità proprie, ancora da creare.');
for (const mode of ['off', 'test', 'live']) for (const platform of ['ios', 'web', 'none', undefined]) assert.equal(resolveAds(platform, mode).enabled, false, `Nessun annuncio su ${platform} in modalità ${mode}.`);
assert.equal(resolveAds('android').enabled, false, 'Modalità predefinita: spento.');
assert.equal(resolveAds('android', 'off').enabled, false);
assert.equal(resolveAds('android', 'boh').enabled, false, 'Una modalità sconosciuta non accende nulla.');
const test = resolveAds('android', 'test'), live = resolveAds('android', 'live');
assert.equal(test.enabled, true); assert.equal(test.testing, true);
for (const key of ['appId', 'bannerId', 'interstitialId', 'rewardedUnitId']) { assert.equal(test[key], GOOGLE_TEST_IDS[key], `In prova solo l’identificativo di prova di Google (${key}).`); assert.ok(test[key].startsWith('ca-app-pub-3940256099942544'), 'Identificativi di prova ufficiali di Google.'); assert.notEqual(test[key], OWNER[key]); }
assert.equal(live.enabled, true); assert.equal(live.testing, false); assert.deepEqual({ appId: live.appId, bannerId: live.bannerId, interstitialId: live.interstitialId, rewardedUnitId: live.rewardedUnitId }, OWNER, 'Dal vivo gli identificativi del titolare.');

// ---------- 2. platform separation in the repository ----------
const manifest = await readFile(`${ROOT}android/app/src/main/AndroidManifest.xml`, 'utf8');
assert.ok(manifest.includes(`android:name="com.google.android.gms.ads.APPLICATION_ID"`) && manifest.includes(`android:value="${OWNER.appId}"`), 'Il manifest Android dichiara l’App ID di AdMob (senza, l’SDK ferma l’app all’avvio).');
const pkg = JSON.parse(await readFile(`${ROOT}package.json`, 'utf8')), cap = JSON.parse(await readFile(`${ROOT}capacitor.config.json`, 'utf8'));
assert.ok(pkg.dependencies['@capacitor-community/admob'], 'Il plugin AdMob è una dipendenza.');
assert.deepEqual(cap.ios?.includePlugins, [], 'Su iOS non entra nessun plugin nativo (niente AdMob nella prima versione per iPhone e iPad).');
const iosFiles = [`${ROOT}ios/App/App/Info.plist`, `${ROOT}ios/App/CapApp-SPM/Package.swift`, `${ROOT}ios/App/App.xcodeproj/project.pbxproj`, `${ROOT}ios/App/App/PrivacyInfo.xcprivacy`];
for (const file of iosFiles) { const text = await readFile(file, 'utf8'); assert.ok(!/ca-app-pub-|GADApplicationIdentifier|admob|GoogleMobileAds/i.test(text), `${file.split('/').pop()}: nessun elemento AdMob su iOS.`); }
const gradle = await readFile(`${ROOT}android/app/capacitor.build.gradle`, 'utf8');
assert.ok(gradle.includes(':capacitor-community-admob'), 'Il progetto Android include il plugin.');

// ---------- 3. a fake plugin that records every call ----------
function fakePlugin({ consent = { status: 'OBTAINED', canRequestAds: true, isConsentFormAvailable: true }, formResult = null, reward = 'earn', failShow = false } = {}) {
  const calls = [], listeners = new Map();
  const plugin = {
    calls,
    async requestConsentInfo(options) { calls.push(['requestConsentInfo', options]); return consent; },
    async showConsentForm() { calls.push(['showConsentForm']); return formResult ?? { ...consent, status: 'OBTAINED', canRequestAds: true }; },
    async showPrivacyOptionsForm() { calls.push(['showPrivacyOptionsForm']); },
    async initialize(options) { calls.push(['initialize', options]); },
    async showBanner(options) { calls.push(['showBanner', options]); }, async removeBanner() { calls.push(['removeBanner']); },
    async prepareInterstitial(options) { calls.push(['prepareInterstitial', options]); }, async showInterstitial() { calls.push(['showInterstitial']); },
    async prepareRewardVideoAd(options) { calls.push(['prepareRewardVideoAd', options]); },
    async addListener(name, fn) { listeners.set(name, fn); return { remove: async () => { listeners.delete(name); } }; },
    async showRewardVideoAd() {
      calls.push(['showRewardVideoAd']);
      if (failShow) throw new Error('boom');
      if (reward === 'earn') { listeners.get('onRewardedVideoAdReward')?.({ type: 'coins', amount: 1 }); return { type: 'coins', amount: 1 }; }
      return undefined;   // closed before the end: the SDK never calls onUserEarnedReward
    }
  };
  return plugin;
}
const names = plugin => plugin.calls.map(call => call[0]);

// off, no plugin, iOS: the SDK is never touched
for (const [label, options] of [['modalità off', { platform: 'android' }], ['iOS in prova', { platform: 'ios', mode: 'test' }], ['web in prova', { platform: 'web', mode: 'test' }]]) {
  const plugin = fakePlugin(); const adapter = createAdMobAdapter({ plugin, ...options });
  assert.equal((await adapter.status()).code, 'not-configured', `${label}: non configurato`);
  assert.equal(await adapter.showBanner(), false); assert.equal(await adapter.showInterstitial(), false);
  assert.equal(await adapter.rewardedProvider.isReady(), false); assert.equal((await adapter.rewardedProvider.show()).completed, false);
  assert.deepEqual(plugin.calls, [], `${label}: nessuna chiamata all’SDK, nessuna richiesta.`);
}
assert.equal((await createAdMobAdapter({ plugin: null, platform: 'android', mode: 'test' }).status()).code, 'not-configured', 'Senza plugin (sito web) non c’è nulla da avviare.');

// consent first: REQUIRED → the form is shown BEFORE the SDK starts; refused → no initialisation, no ad request at all
{
  const plugin = fakePlugin({ consent: { status: 'REQUIRED', canRequestAds: false, isConsentFormAvailable: true } });
  const adapter = createAdMobAdapter({ plugin, platform: 'android', mode: 'test' });
  assert.equal((await adapter.start()).ok, true);
  assert.deepEqual(names(plugin).slice(0, 3), ['requestConsentInfo', 'showConsentForm', 'initialize'], 'UMP prima dell’SDK.');
  assert.equal(plugin.calls[0][1].tagForUnderAgeOfConsent, false, 'Pubblico 14+: nessuna etichetta «minore dell’età del consenso».');
  assert.equal(plugin.calls[2][1].initializeForTesting, true, 'In prova l’SDK parte in modalità di prova.');
}
{
  const plugin = fakePlugin({ consent: { status: 'REQUIRED', canRequestAds: false, isConsentFormAvailable: true }, formResult: { status: 'REQUIRED', canRequestAds: false } });
  const adapter = createAdMobAdapter({ plugin, platform: 'android', mode: 'test' });
  assert.equal((await adapter.start()).code, 'no-consent', 'Senza consenso non si parte.');
  assert.equal(await adapter.showBanner(), false); assert.equal(await adapter.showInterstitial(), false); assert.equal(await adapter.rewardedProvider.isReady(), false);
  assert.ok(!names(plugin).some(name => ['initialize', 'showBanner', 'prepareInterstitial', 'prepareRewardVideoAd'].includes(name)), 'Nessuna richiesta di annunci senza consenso.');
  assert.equal((await adapter.status()).code, 'no-consent');
}
{ const plugin = fakePlugin(); plugin.initialize = async () => { throw new Error('sdk'); }; assert.equal((await createAdMobAdapter({ plugin, platform: 'android', mode: 'test' }).start()).code, 'error', 'Un errore dell’SDK non arriva al gioco.'); }

// banner / interstitial use the unit ids of the mode
{
  const plugin = fakePlugin(); const adapter = createAdMobAdapter({ plugin, platform: 'android', mode: 'test' });
  assert.equal(await adapter.showBanner({ margin: 72 }), true);
  const banner = plugin.calls.find(call => call[0] === 'showBanner')[1];
  assert.deepEqual({ adId: banner.adId, isTesting: banner.isTesting, position: banner.position, margin: banner.margin }, { adId: GOOGLE_TEST_IDS.bannerId, isTesting: true, position: 'BOTTOM_CENTER', margin: 72 }, 'Banner di prova, in basso, sopra la barra di navigazione.');
  assert.equal(await adapter.showBanner(), false, 'Un solo banner alla volta.'); await adapter.hideBanner(); assert.ok(names(plugin).includes('removeBanner'));
  assert.equal(await adapter.showInterstitial(), true); assert.equal(plugin.calls.find(call => call[0] === 'prepareInterstitial')[1].adId, GOOGLE_TEST_IDS.interstitialId);
  const liveAdapter = createAdMobAdapter({ plugin: fakePlugin(), platform: 'android', mode: 'live' });
  assert.equal(liveAdapter.ids.rewardedUnitId, OWNER.rewardedUnitId);
}

// ---------- 4. rewarded video: credit only on the earned-reward callback, one credit for each completion ----------
{
  const plugin = fakePlugin(); const adapter = createAdMobAdapter({ plugin, platform: 'android', mode: 'test' }); const provider = adapter.rewardedProvider;
  assert.equal(provider.kind, 'admob'); assert.equal(await provider.isReady(), true);
  const first = await provider.show(), second = await provider.show();
  assert.equal(first.completed, true); assert.equal(first.verified, true); assert.match(first.completionId, /^adm-[\w-]{8,}$/);
  assert.notEqual(first.completionId, second.completionId, 'Ogni completamento ha il suo identificativo.');
  assert.equal(plugin.calls.find(call => call[0] === 'prepareRewardVideoAd')[1].adId, GOOGLE_TEST_IDS.rewardedUnitId);
  const closed = createAdMobAdapter({ plugin: fakePlugin({ reward: 'none' }), platform: 'android', mode: 'test' });
  const out = await closed.rewardedProvider.show();
  assert.equal(out.completed, false, 'Chiuso prima della fine: nessuna ricompensa.'); assert.equal(out.completionId, undefined);
  const failed = createAdMobAdapter({ plugin: fakePlugin({ failShow: true }), platform: 'android', mode: 'test' });
  assert.equal((await failed.rewardedProvider.show()).completed, false, 'Un video che non parte non paga.');
  // through the rewarded service: credited once, a repeated id never twice; closed/failed videos give nothing; concurrent clicks are one
  const paid = new Set(); const grant = async id => paid.has(id) ? { ok: false, reason: 'duplicato' } : (paid.add(id), { ok: true });
  const ads = createRewardedAds({ config: adapter.ids, provider, grant });
  assert.equal((await ads.availability()).code, 'ready');
  const [a, b] = await Promise.all([ads.watch(), ads.watch()]);
  assert.deepEqual([a.status, b.status].sort(), ['busy', 'completed'], 'Due clic insieme: un solo video.');
  assert.equal(paid.size, 1);
  assert.equal((await ads.watch()).status, 'completed'); assert.equal(paid.size, 2);
  const late = await ads.complete({ completed: true, verified: true, completionId: [...paid][0] }); assert.equal(late.status, 'duplicate', 'Una richiamata ripetuta non paga due volte.');
  const none = createRewardedAds({ config: closed.ids, provider: closed.rewardedProvider, grant }); assert.equal((await none.watch()).status, 'dismissed'); assert.equal(paid.size, 2);
  const offline = createRewardedAds({ config: adapter.ids, provider, grant: async () => ({ ok: false, reason: 'rete' }) }); assert.equal((await offline.watch()).status, 'failed', 'Se il servizio non conferma, nessun premio.');
  const off = createRewardedAds({ config: createAdMobAdapter({ plugin, platform: 'android' }).ids, provider, grant }); assert.equal((await off.availability()).code, 'not-configured', 'Con gli annunci spenti il pulsante lo dice.');
}

// ---------- 5. the policy of the banners and interstitials ----------
const mem = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) }; };
const playing = { game: { status: 'active' }, ui: {} };
{
  assert.equal(interruptible(playing), false); assert.equal(interruptible(null), true);
  for (const busy of [{ night: {} }, { scene: {} }, { campaign: {} }, { vote: {} }, { wizard: {} }, { ui: { outcome: {} } }]) assert.equal(interruptible({ ...playing, ...busy }), true, `Mai durante: ${Object.keys(busy)[0]}.`);
  for (const page of ['panoramica', 'elezioni', 'sondaggi', 'notte', 'carriera', 'governo', 'partito']) assert.ok(!BANNER_PAGES.includes(page), `Nessun banner in ${page}.`);
  const plugin = fakePlugin(); const adapter = createAdMobAdapter({ plugin, platform: 'android', mode: 'test' }); const manager = createAdsManager({ adapter, storage: mem() });
  assert.equal(await manager.syncBanner({ page: 'ricompense', margin: 72 }), true, 'Banner nelle pagine secondarie.');
  assert.equal(await manager.syncBanner({ page: 'panoramica' }), false); assert.ok(names(plugin).includes('removeBanner'), 'Nascosto fuori dalle pagine secondarie.');
  assert.equal(await manager.syncBanner({ page: 'ricompense', blocked: true }), false, 'Nascosto durante scene, voto, resoconto, menu.');
  const idle = createAdsManager({ adapter: createAdMobAdapter({ plugin: fakePlugin(), platform: 'android' }), storage: mem() });
  assert.equal(await idle.syncBanner({ page: 'ricompense' }), false); assert.equal(await idle.onWeekClosed(playing), false, 'Spento: nessun annuncio.');
}
{
  let t = Date.parse('2026-11-14T10:00:00Z'); const plugin = fakePlugin(); const adapter = createAdMobAdapter({ plugin, platform: 'android', mode: 'test' });
  const manager = createAdsManager({ adapter, storage: mem(), now: () => t });
  const closeWeek = async (state = playing) => { const shown = await manager.onWeekClosed(state); t += 60_000; return shown; };
  const shownAt = []; for (let week = 1; week <= 9; week += 1) { if (await closeWeek()) shownAt.push(week); t += INTERSTITIAL.minGapMs; }
  assert.deepEqual(shownAt, [3, 6, 9], 'Un interstitial ogni tre settimane chiuse, mai di più.');
  const w = createAdsManager({ adapter: createAdMobAdapter({ plugin: fakePlugin(), platform: 'android', mode: 'test' }), storage: mem(), now: () => t });
  for (let i = 0; i < 2; i += 1) await w.onWeekClosed({ ...playing, night: {} });
  assert.equal(await w.onWeekClosed({ ...playing, scene: {} }), false, 'Mai durante elezioni, scrutinio o scene.'); assert.equal(w.stats().weeks ?? 0, 0, 'Le settimane vissute durante un’elezione non contano.');
  const g = createAdsManager({ adapter: createAdMobAdapter({ plugin: fakePlugin(), platform: 'android', mode: 'test' }), storage: mem(), now: () => t });
  await g.onWeekClosed(playing); await g.onWeekClosed(playing); g.noteRewarded();
  assert.equal(await g.onWeekClosed(playing), false, 'Mai subito dopo un video con premio.');
  t += INTERSTITIAL.minGapMs + 1; assert.equal(await g.onWeekClosed(playing), true, 'Dopo l’intervallo sì.');
  const d = createAdsManager({ adapter: createAdMobAdapter({ plugin: fakePlugin(), platform: 'android', mode: 'test' }), storage: mem(), now: () => t, policy: { ...INTERSTITIAL, everyWeeks: 1 } });
  let count = 0; for (let i = 0; i < 12; i += 1) { if (await d.onWeekClosed(playing)) count += 1; t += INTERSTITIAL.minGapMs; }
  assert.equal(count, INTERSTITIAL.perDay, 'Limite giornaliero.');
}
console.log('AdMob Android verificato senza dispositivo: modalità spenta nel repository, identificativi di prova di Google in prova e quelli del titolare solo dal vivo e solo su Android, consenso UMP prima di ogni richiesta, banner solo nelle pagine secondarie, interstitial solo a settimana chiusa con limiti (mai durante elezioni, scrutinio o scene), premio solo alla richiamata dell’SDK e una volta per completamento, nulla su iOS.');
