// The Appodeal integration of the ANDROID app (plugins/appodeal-ads + data/repositories/appodeal-adapter.js + data/ads-config.js): configuration (TEST default, OFF, production REFUSED), consent first, the reward ONLY after the
// SDK's completion, one credit for each video, the interstitial limit (one every 180 s), the banner pages, the native sources (SDK 4.4.0, placement `default`, no AdMob/Meta/InMobi in the Android build, no player data passed).
// It runs against a fake plugin: nothing here reaches the network and NO ad is shown (that needs a device: see docs/appodeal.md).
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const build = (await read('index.html')).match(/main\.js\?v=([^"']+)/)?.[1];
const mod = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { APPODEAL, APPODEAL_MODE, APPODEAL_PRODUCTION_AUTHORIZED, APPODEAL_BANNER_PAGES, APPODEAL_INTERSTITIAL, resolveAppodeal: resolveAppodealReal, providerFor } = await mod('src/data/ads-config.js');
// The shipped default is now 'production' (APPODEAL_MODE): this check exercises the TEST path, so its default mode is explicit. The production gate and the Debug protection are covered by check-appodeal-safety.mjs.
const resolveAppodeal = (remote = null, mode = 'test') => resolveAppodealReal(remote, mode);
const { createAppodealAdapter } = await mod('src/data/repositories/appodeal-adapter.js');
const { createAdsManager } = await mod('src/data/repositories/ads-manager.js');
const lines = [];

// ---- configuration
assert.ok(['test', 'production'].includes(APPODEAL_MODE), 'Modalità valida.'); assert.ok(APPODEAL_MODE !== 'production' || APPODEAL_PRODUCTION_AUTHORIZED === true, 'Produzione solo con autorizzazione esplicita.');
assert.match(APPODEAL.android.appKey, /^[0-9a-f]{48}$/, 'App Key Android: 48 caratteri esadecimali.'); assert.equal(APPODEAL.android.appKey, '8d31e2dc0428104dbfcf36959833bc1020f210c3914df496'); assert.equal(APPODEAL.dashboardId, '790468'); assert.equal(APPODEAL.android.placement, 'default');
assert.equal(providerFor('android'), 'appodeal'); assert.equal(providerFor('ios'), 'inmobi', 'iOS resta con il suo provider.');
const test = resolveAppodeal(null); assert.equal(test.mode, 'test'); assert.equal(test.testing, true); assert.equal(test.enabled, true); assert.equal(test.appKey, APPODEAL.android.appKey);
for (const f of ['rewarded', 'banner', 'interstitial']) assert.equal(test[f].enabled, true, `TEST: ${f} attivo.`);
assert.equal(test.interstitialPolicy.minGapMs, 180_000, 'Interstitial: almeno 180 secondi.'); assert.deepEqual(APPODEAL_INTERSTITIAL, test.interstitialPolicy);
assert.equal(resolveAppodeal(null, 'off').enabled, false, 'OFF: niente.'); assert.equal(resolveAppodeal(null, 'off').appKey, null);
const prod = resolveAppodeal(null, 'production'); assert.equal(prod.mode, APPODEAL_PRODUCTION_AUTHORIZED ? 'production' : 'test', 'Produzione solo se autorizzata, altrimenti resta TEST.'); assert.equal(prod.testing, !APPODEAL_PRODUCTION_AUTHORIZED);
assert.equal(resolveAppodeal({ appodeal: { mode: 'live' } }).testing, true, 'Un valore remoto non attiva mai la produzione.'); assert.equal(resolveAppodeal({ appodeal: { mode: 'production' } }).testing, true);
assert.equal(resolveAppodeal({ appodeal: { mode: 'off' } }).enabled, false, 'Interruttore remoto: spegne tutto.'); assert.equal(resolveAppodeal({ appodeal: { enabled: false } }).enabled, false);
assert.equal(resolveAppodeal({ appodeal: { banner: { enabled: false } } }).banner.enabled, false); assert.equal(resolveAppodeal({ appodeal: { banner: { enabled: false } } }).rewarded.enabled, true);
assert.equal(resolveAppodeal({ appodeal: { rewarded: { enabled: true }, rewardPoints: 99 } }).rewardPoints, 0.15, 'Punti fuori limite: predefinito 0,15.');
assert.deepEqual(APPODEAL_BANNER_PAGES, ['panoramica'], 'Allowlist del banner: solo Panoramica.');
lines.push('configurazione TEST/OFF/produzione bloccata, chiave, placement `default`, 180 s');

// ---- adapter against a fake plugin
function fake(script = {}) {
  const calls = []; let consent = { canRequestAds: true, status: 'OBTAINED', privacyOptionsRequired: false, ...script.consent }; let n = 0;
  return { calls,
    requestConsent: async args => { calls.push(['requestConsent', args]); return { ...consent }; },
    initialize: async args => { calls.push(['initialize', args]); return script.init ?? { ok: true }; },
    loadAd: async args => { calls.push(['loadAd', args]); return script.load ?? { ready: true }; },
    showAd: async args => { calls.push(['showAd', args]); return typeof script.show === 'function' ? script.show(args, ++n) : script.show ?? { shown: true, rewarded: false }; },
    showBanner: async args => { calls.push(['showBanner', args]); return { shown: true }; },
    hideBanner: async () => { calls.push(['hideBanner']); },
    showPrivacyOptions: async () => { calls.push(['showPrivacyOptions']); consent = { ...consent, ...(script.options?.shift() ?? {}) }; return { ...consent }; } };
}
{ // OFF: the plugin is never called
  const plugin = fake(); const a = createAppodealAdapter({ plugin, config: resolveAppodeal(null, 'off') });
  assert.deepEqual(await a.status(), { ok: false, code: 'not-configured' }); assert.equal(await a.showBanner(), false); assert.equal(await a.showInterstitial(), false); assert.deepEqual(await a.rewardedProvider.show(), { completed: false, verified: false }); assert.equal(plugin.calls.length, 0, 'OFF: nessuna chiamata al plugin.');
}
{ // no plugin (website): nothing, no crash
  const a = createAppodealAdapter({ plugin: null, config: resolveAppodeal(null) }); assert.deepEqual(await a.status(), { ok: false, code: 'not-configured' }); assert.equal(await a.showInterstitial(), false);
}
{ // consent FIRST, then init, with the key and the test flag; nothing else is sent
  const plugin = fake(); const a = createAppodealAdapter({ plugin, config: resolveAppodeal(null) });
  assert.deepEqual(await a.status(), { ok: true }); assert.deepEqual(plugin.calls.map(c => c[0]), ['requestConsent', 'initialize'], 'Prima il consenso, poi l’SDK.');
  assert.deepEqual(plugin.calls[0][1], { appKey: APPODEAL.android.appKey, testMode: true }); assert.deepEqual(plugin.calls[1][1], { appKey: APPODEAL.android.appKey, testMode: true }, 'Solo chiave e flag di test: nessun dato del giocatore.');
  await a.status(); assert.equal(plugin.calls.filter(c => c[0] === 'initialize').length, 1, 'Un solo init.');
}
{ // consent refused: no init, no ad request
  const plugin = fake({ consent: { canRequestAds: false, status: 'REQUIRED', privacyOptionsRequired: true } }); const a = createAppodealAdapter({ plugin, config: resolveAppodeal(null) });
  assert.deepEqual(await a.status(), { ok: false, code: 'no-consent' }); assert.equal(await a.showInterstitial(), false); assert.equal(await a.showBanner(), false); assert.deepEqual(await a.rewardedProvider.show(), { completed: false, verified: false });
  assert.ok(!plugin.calls.some(c => ['initialize', 'loadAd', 'showAd', 'showBanner'].includes(c[0])), 'Senza consenso: nessuna richiesta di annunci.');
}
{ // privacy options: accept after a refusal starts the SDK; withdrawal stops it
  const plugin = fake({ consent: { canRequestAds: false, status: 'REQUIRED', privacyOptionsRequired: true }, options: [{ canRequestAds: true, status: 'OBTAINED' }, { canRequestAds: false, status: 'REQUIRED' }] });
  const a = createAppodealAdapter({ plugin, config: resolveAppodeal(null) }); await a.status(); assert.equal(await a.showPrivacyOptions(), true); await new Promise(r => setTimeout(r, 20));
  assert.equal(plugin.calls.filter(c => c[0] === 'initialize').length, 1, 'Consenso dato dopo il rifiuto: parte l’SDK.'); assert.equal(await a.showPrivacyOptions(), true); assert.equal(a.consent().canRequestAds, false, 'Consenso ritirato.');
}
{ // rewarded: reward ONLY after the completion, one credit each video
  let id = 0; const finished = fake({ show: () => ({ shown: true, rewarded: true, completionId: `apd-${++id}` }) });
  const a = createAppodealAdapter({ plugin: finished, config: resolveAppodeal(null) }); assert.equal(await a.rewardedProvider.isReady(), true);
  const first = await a.rewardedProvider.show(); assert.deepEqual(first, { completed: true, verified: true, completionId: 'apd-1' }); const second = await a.rewardedProvider.show(); assert.equal(second.completionId, 'apd-2', 'Un id nuovo per ogni video.');
  for (const closed of [{ shown: true, rewarded: false }, { shown: false, rewarded: false, code: 'show-failed' }, { shown: true, rewarded: true }, { shown: true, rewarded: true, completionId: 5 }]) {
    const a2 = createAppodealAdapter({ plugin: fake({ show: closed }), config: resolveAppodeal(null) }); assert.deepEqual(await a2.rewardedProvider.show(), { completed: false, verified: false }, `Nessun premio per ${JSON.stringify(closed)}.`);
  }
  const thrown = createAppodealAdapter({ plugin: { ...fake(), showAd: async () => { throw new Error('x'); } }, config: resolveAppodeal(null) }); assert.deepEqual(await thrown.rewardedProvider.show(), { completed: false, verified: false }, 'Errore del plugin: niente premio, niente blocco.');
  const noAd = createAppodealAdapter({ plugin: fake({ load: { ready: false, code: 'no-fill' } }), config: resolveAppodeal(null) }); assert.equal(await noAd.rewardedProvider.isReady(), false); assert.deepEqual(await noAd.rewardedProvider.show(), { completed: false, verified: false }, 'Nessun annuncio: non blocca.');
}
{ // interstitial: placement/format, never when unavailable
  const plugin = fake(); const a = createAppodealAdapter({ plugin, config: resolveAppodeal(null) }); assert.equal(await a.showInterstitial(), true); assert.deepEqual(plugin.calls.find(c => c[0] === 'showAd')[1], { format: 'interstitial' });
  const none = createAppodealAdapter({ plugin: fake({ load: { ready: false } }), config: resolveAppodeal(null) }); assert.equal(await none.showInterstitial(), false);
}
lines.push('consenso prima di tutto, init con sola chiave+flag, nessun annuncio senza consenso, reward solo a completamento (un id per video), errori e assenza di annunci senza blocchi');

// ---- the manager: 180 s, natural pause, banner pages
{
  const plugin = fake(); const a = createAppodealAdapter({ plugin, config: resolveAppodeal(null) }); let t = 1_000_000; const store = new Map();
  const m = createAdsManager({ adapter: a, storage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, now: () => t, policy: () => a.ids.interstitialPolicy, pages: APPODEAL_BANNER_PAGES });
  const state = { game: {} }; const shown = () => plugin.calls.filter(c => c[0] === 'showAd' && c[1].format === 'interstitial').length;
  assert.equal(await m.onWeekClosed(state), false); assert.equal(await m.onWeekClosed(state), true, 'Ogni 2 settimane chiuse.'); t += 60_000; assert.equal(await m.onWeekClosed(state), false); assert.equal(await m.onWeekClosed(state), false, 'Meno di 180 s: no.'); t += 130_000; assert.equal(await m.onWeekClosed(state), true, 'Dopo 180 s: sì.'); assert.equal(shown(), 2);
  for (const busy of [{ game: {}, night: {} }, { game: {}, scene: {} }, { game: {}, vote: {} }, { game: {}, campaign: {} }, { game: {}, wizard: {} }, {}]) { t += 400_000; await m.onWeekClosed(busy); await m.onWeekClosed(busy); }
  assert.equal(shown(), 2, 'Mai durante notte, scena, voto, campagna, wizard o senza partita.');
  assert.equal(await m.syncBanner({ page: 'panoramica' }), true, 'Banner sulla Home.'); assert.ok(plugin.calls.some(c => c[0] === 'showBanner'), 'Il margine/altezza del banner è gestito dal nativo (evento bannerHeight), non più dal chiamante.');
  assert.equal(await m.syncBanner({ page: 'elezioni' }), false); assert.equal(a.isBannerShown(), false, 'Nascosto nelle pagine di gioco.'); assert.equal(await m.syncBanner({ page: 'notizie', blocked: true }), false);
}
lines.push('interstitial: ogni 2 settimane, mai entro 180 s, mai in notte/scena/voto/campagna; banner solo su Home e schermate statiche, mai in gioco');

// ---- the native sources
const kt = await read('plugins/appodeal-ads/android/src/main/java/it/matteobianchi/politicando/appodeal/AppodealAdsPlugin.kt');
assert.match(kt, /Appodeal\.setTesting\(test\)/); assert.match(kt, /call\.getBoolean\("testMode", true\) != false/, 'TEST è il predefinito anche nel nativo.');
assert.match(kt, /PLACEMENT = "default"/); assert.match(kt, /Appodeal\.show\(a, t, PLACEMENT\)/); assert.match(kt, /Appodeal\.show\(a, Appodeal\.BANNER_VIEW, PLACEMENT\)/);
assert.ok(kt.indexOf('ConsentManager.canShowAds()') < kt.indexOf('Appodeal.initialize('), 'Il consenso precede l’inizializzazione.');
assert.match(kt, /ConsentManager\.requestConsentInfoUpdate/); assert.match(kt, /loadAndShowConsentFormIfRequired/); assert.match(kt, /showPrivacyOptionsForm/);
assert.equal((kt.match(/rewardEarned = true/g) ?? []).length, 1, 'Il premio nasce in un solo punto.'); assert.match(kt, /onRewardedVideoFinished\(amount: Double, currency: String\) \{[^}]*rewardEarned = true/);
const code = kt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
assert.ok(!/setUserId|setCustomFilter|setExtraData|setLocation|setUserAge|setUserGender|setBirthday|setSegmentFilter/i.test(code), 'Nessun dato del giocatore passato all’SDK (niente profilazione).');
assert.ok(!/admob|gms\.ads|facebook|inmobi/i.test(code), 'Il bridge non usa AdMob, Meta né InMobi.');
const gradle = await read('plugins/appodeal-ads/android/build.gradle'); assert.match(gradle, /appodealVersion = '4\.4\.0'/); assert.match(gradle, /artifactory\.appodeal\.com\/appodeal/);
const deps = [...gradle.matchAll(/^\s*api\(?\s*"([^"]+)"/gm)].map(m => m[1]); assert.ok(deps.some(d => d.startsWith('com.appodeal.ads.sdk:core:')), 'SDK core.');
for (const d of deps) assert.ok(!/admob|meta|facebook|inmobi|bidmachine|gam|google/i.test(d.replace('com.appodeal.ads.sdk.adapters:', 'adapter:')), `Nessun adapter AdMob/Meta/InMobi/BidMachine (che porta Google Ad Manager): ${d}`);
// Registration of the plugin in Capacitor 8, link by link (a broken link gives a precise message, not just a missing string in a generated file):
//  1. package.json depends on the local plugin; 2. the plugin declares itself as an Android Capacitor plugin; 3. `npm install` linked it in node_modules (without the link Capacitor finds NO plugin and the generated
//  Gradle files only contain `:capacitor-android`); 4. capacitor.config.json lets Android include it; 5. Capacitor's own discovery (`cap ls android`) lists it; 6. the generated Gradle files register it (and no standalone InMobi).
const pkgJson = JSON.parse(await read('package.json')); assert.equal(pkgJson.dependencies['politicando-appodeal-ads'], 'file:plugins/appodeal-ads', 'package.json: dipendenza dal plugin locale.');
const pluginPkg = JSON.parse(await read('plugins/appodeal-ads/package.json')); assert.equal(pluginPkg.name, 'politicando-appodeal-ads'); assert.equal(pluginPkg.capacitor?.android?.src, 'android', 'Il plugin si dichiara plugin Android di Capacitor.');
const { realpathSync, existsSync } = await import('node:fs'); const root = new URL('../', import.meta.url).pathname;
assert.ok(existsSync(`${root}node_modules/politicando-appodeal-ads`), 'node_modules/politicando-appodeal-ads manca: esegui «npm install» (senza il link Capacitor non trova il plugin e Gradle non lo include).');
assert.equal(realpathSync(`${root}node_modules/politicando-appodeal-ads`), realpathSync(`${root}plugins/appodeal-ads`), 'Il link in node_modules punta a plugins/appodeal-ads.');
const capCfg = JSON.parse(await read('capacitor.config.json')); assert.deepEqual(capCfg.android?.includePlugins, ['politicando-appodeal-ads'], 'capacitor.config.json: Android include solo il plugin Appodeal.');
const { execFileSync } = await import('node:child_process'); const listing = execFileSync(`${root}node_modules/.bin/cap`, ['ls', 'android'], { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' } });
assert.match(listing, /politicando-appodeal-ads/, 'Capacitor (cap ls android) elenca il plugin Appodeal.'); assert.doesNotMatch(listing, /politicando-inmobi-ads/, 'Capacitor non elenca InMobi per Android.');
const settings = await read('android/capacitor.settings.gradle');
assert.match(settings, /include ':politicando-appodeal-ads'/, 'android/capacitor.settings.gradle non registra il plugin: esegui «npm install» e poi «npx cap sync android».'); assert.match(settings, /plugins\/appodeal-ads\/android/); assert.doesNotMatch(settings, /inmobi/i, 'Nessun InMobi standalone nel build Android.');
assert.match(await read('android/app/capacitor.build.gradle'), /project\(':politicando-appodeal-ads'\)/, 'android/app/capacitor.build.gradle: l’app dipende dal plugin (esegui «npx cap sync android»).');
assert.match(await read('android/build.gradle'), /artifactory\.appodeal\.com\/appodeal/);
const manifest = await read('plugins/appodeal-ads/android/src/main/AndroidManifest.xml'); assert.match(manifest, /ACCESS_FINE_LOCATION" tools:node="remove"/); assert.match(manifest, /ACCESS_COARSE_LOCATION" tools:node="remove"/);
const cap = JSON.parse(await read('capacitor.config.json')); assert.deepEqual(cap.android.includePlugins, ['politicando-appodeal-ads']); assert.deepEqual(cap.ios.includePlugins, [], 'iOS invariato.');
lines.push('sorgenti native: SDK 4.4.0, placement default, consenso prima dell’init, premio solo da onRewardedVideoFinished, nessun dato del giocatore, nessun AdMob/Meta/InMobi, permessi di posizione rimossi, iOS invariato');
console.log(`Appodeal Android (fake plugin, nessun annuncio mostrato): ${lines.join(' · ')}.`);
console.log('Non verificato qui: visualizzazione di banner, interstitial e rewarded su dispositivo, form di consenso reale, prima impression nel dashboard.');
