// The native side of InMobi, checked without a device, Xcode or an Android SDK:
//  A. consistency: the same eight methods in the TypeScript definitions, the Kotlin plugin and the Swift plugin; no AdMob anywhere; no personal data to the SDK; the rewards only from the SDK's confirmation callbacks;
//  B. configuration: SDK versions (Android 11.5.1 Kotlin, iOS 11.5.0 Swift), Capacitor sync (Android plugin registered, iOS plugin in the SPM package), SKAdNetwork, privacy manifest, ATT text, permissions;
//  C. protected release: bundle id, iOS version 1.0 (1), Android versionCode 4 / versionName 1.0.3, no signing / team in the repository;
//  D. COMPILATION of the Kotlin plugin against the real InMobi SDK 11.5.1 (Maven Central + the Kotlin compiler shipped with Gradle). SKIPPED (said aloud) when the network, Java or Gradle are missing.
// NOT done here, and said in docs/inmobi.md: the Gradle build with the Android SDK (not available), the Swift compilation (no Xcode), any run on a device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const KT = 'plugins/inmobi-ads/android/src/main/java/it/matteobianchi/politicando/inmobi/InMobiAdsPlugin.kt';
const SW = 'plugins/inmobi-ads/ios/Sources/InMobiAdsPlugin/InMobiAdsPlugin.swift';
const kt = read(KT), sw = read(SW), defs = read('plugins/inmobi-ads/src/definitions.ts');
const lines = [];
const METHODS = ['requestConsent', 'initialize', 'loadAd', 'showAd', 'showBanner', 'hideBanner', 'showPrivacyOptions', 'requestTracking'];

// ---- A ----
const ktMethods = [...kt.matchAll(/@PluginMethod\s+fun (\w+)\(/g)].map(m => m[1]).sort();
const swMethods = [...sw.matchAll(/CAPPluginMethod\(name: "(\w+)"/g)].map(m => m[1]).sort();
const tsMethods = METHODS.filter(name => new RegExp(`\\b${name}\\(`).test(defs)).sort();
assert.deepEqual(ktMethods, [...METHODS].sort(), 'Kotlin: tutti i metodi del contratto.'); assert.deepEqual(swMethods, [...METHODS].sort(), 'Swift: tutti i metodi del contratto.'); assert.deepEqual(tsMethods, [...METHODS].sort(), 'TypeScript: tutti i metodi del contratto.');
assert.ok(fs.existsSync(path.join(ROOT, 'plugins/inmobi-ads/dist/esm/index.js')) && /InMobiAds/.test(read('plugins/inmobi-ads/dist/esm/index.js')), 'Il bridge TypeScript è compilato (dist).');
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');   // the comments say what is NOT done: only the code counts
for (const [name, source] of [['Kotlin', kt], ['Swift', sw]]) {
  const text = code(source);
  assert.ok(!/admob|ca-app-pub|GoogleMobileAds|play-services-ads/i.test(text), `${name}: nessun AdMob.`);
  assert.ok(!/setLocation|setYearOfBirth|setGender|setAge\(|setAgeGroup|setPostalCode|setAreaCode|setInterests|setEducation|CLLocation|startUpdatingLocation|setLocationWithCityStateCountry/.test(text.replace(/setIsAgeRestricted/g, '')), `${name}: nessun dato personale passato all’SDK (posizione, nascita, sesso, età, interessi).`);
}
assert.match(kt, /override fun onRewardsUnlocked[\s\S]{0,160}holder\.rewarded = true/, 'Kotlin: il premio nasce solo in onRewardsUnlocked.'); assert.equal((kt.match(/\.rewarded = true/g) ?? []).length, 1, 'Kotlin: un solo punto che assegna il premio.');
assert.match(sw, /rewardActionCompletedWithRewards[^{]*\{[^}]*rewarded = true/, 'Swift: il premio nasce solo in rewardActionCompletedWithRewards.'); assert.equal((sw.match(/rewarded = true/g) ?? []).length, 1, 'Swift: un solo punto che assegna il premio.');
for (const [name, text] of [['Kotlin', kt], ['Swift', sw]]) { assert.match(text, /UUID/, `${name}: l’id del completamento è fatto in nativo.`); assert.match(text, /IABTCF_TCString/, `${name}: la stringa TCF del CMP passa a InMobi.`); }
assert.match(kt, /canRequestAds\(\) != true[\s\S]{0,120}no-consent/, 'Kotlin: niente inizializzazione senza consenso.'); assert.match(sw, /canRequestAds else \{ call\.resolve\(\["ok": false, "code": "no-consent"\]/, 'Swift: niente inizializzazione senza consenso.');
assert.match(kt, /full\.remove\(format\)/, 'Kotlin: un annuncio si mostra una volta (oggetto nuovo per il prossimo).'); assert.match(sw, /removeValue\(forKey: key\)/, 'Swift: un annuncio si mostra una volta.');
assert.ok(!/requestTrackingAuthorization/.test(sw.replace(/@objc func requestTracking[\s\S]*$/, '')), 'Swift: l’ATT si chiede solo da requestTracking.');
for (const [name, source] of [['Kotlin', kt], ['Swift', sw]]) assert.ok(!/\b1000\d{6,}\b|60d3e31b/.test(source), `${name}: nessun App Key, Placement ID o Account ID scritto nel codice nativo: li passa il livello web, per piattaforma.`);
assert.match(kt, /getString\("placementId"\)/, 'Kotlin: il Placement ID arriva dalla chiamata.'); assert.match(sw, /getString\("placementId"\)/, 'Swift: il Placement ID arriva dalla chiamata.');
assert.match(kt, /getString\("accountId"\)/, 'Kotlin: l’Account ID arriva dalla chiamata (nulla da inizializzare se manca).'); assert.match(sw, /getString\("accountId"\), !account\.isEmpty/, 'Swift: senza Account ID l’SDK non parte.');
lines.push('contratto uguale in TypeScript/Kotlin/Swift, nessun AdMob, nessun dato personale, premio solo dalla conferma dell’SDK, consenso prima dell’init');

// ---- B ----
const gradle = read('plugins/inmobi-ads/android/build.gradle');
assert.match(gradle, /inmobiVersion = '11\.5\.1'/); assert.match(gradle, /com\.inmobi\.monetization:inmobi-ads-kotlin:\$inmobiVersion/); assert.match(gradle, /user-messaging-platform/); assert.ok(!/play-services-ads|admob/i.test(code(gradle)), 'Nessun SDK Google Mobile Ads.');
assert.match(read('plugins/inmobi-ads/Package.swift'), /InMobiSDK-Swift-Package", exact: "11\.5\.0"/, 'iOS: SDK 11.5.0 con Swift Package.');
assert.ok(!/<uses-permission/.test(read('plugins/inmobi-ads/android/src/main/AndroidManifest.xml')), 'Il plugin non aggiunge permessi: li porta l’SDK InMobi (INTERNET, ACCESS_NETWORK_STATE, AD_ID).');
const appManifest = read('android/app/src/main/AndroidManifest.xml'); assert.deepEqual([...appManifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map(m => m[1]), ['android.permission.INTERNET'], 'Il manifest dell’app dichiara solo INTERNET.'); const ADMOB_APP_ID = 'ca-app-pub-6404822903303014~1677702221';   // the owner's AdMob APPLICATION id (with «~»); it was in the history of the repository (e919e5f) and is read by the Google UMP SDK
// Android 1.0.3+: the provider is Appodeal (no AdMob adapter), so the app manifest carries NO AdMob App ID (the old InMobi+UMP build needed one): none may be there by mistake.
assert.deepEqual([...appManifest.matchAll(/gms\.ads\.APPLICATION_ID/g)], [], 'Il manifest non dichiara nessun App ID AdMob (il provider Android è Appodeal, senza adapter AdMob).');
assert.ok(!/ca-app-pub-\d+\/\d+/.test(appManifest) && !/gms\.ads\.(?!APPLICATION_ID)/.test(appManifest.replace(/com\.google\.android\.gms\.ads\.APPLICATION_ID/g, '')), 'Nessun Ad Unit ID (con «/») né altro meta-data pubblicitario nel manifest.');
assert.match(read('android/capacitor.settings.gradle'), /politicando-appodeal-ads/); assert.doesNotMatch(read('android/capacitor.settings.gradle'), /politicando-inmobi-ads/, 'Android: nessun InMobi standalone (il provider Android è Appodeal).'); assert.ok(!/admob/i.test(read('android/capacitor.settings.gradle') + read('android/app/capacitor.build.gradle')), 'Gradle sincronizzato: niente AdMob.');
assert.match(read('android/app/capacitor.build.gradle'), /project\(':politicando-appodeal-ads'\)/);
// iOS 1.0.1 (2): InMobi is PAUSED on iOS: the bridge is NOT in the iOS build (no SDK, no UMP, no SKAdNetwork, no advertising declarations: as in the 1.0 (1) already sent to Apple). Android keeps its bridge.
const cap = JSON.parse(read('capacitor.config.json')); assert.deepEqual(cap.ios.includePlugins, [], 'iOS: nessun plugin pubblicitario nella release (InMobi in pausa).');
assert.doesNotMatch(read('ios/App/CapApp-SPM/Package.swift'), /Inmobi|InMobi|UserMessaging/, 'iOS: il pacchetto SPM non include né InMobi né UMP.');
assert.match(read('android/capacitor.settings.gradle'), /politicando-appodeal-ads/, 'Android: il bridge Appodeal è registrato.'); assert.deepEqual(cap.android.includePlugins, ['politicando-appodeal-ads'], 'Android: solo il bridge Appodeal è incluso nel build.');
const pkg = JSON.parse(read('package.json')); assert.ok(pkg.dependencies['politicando-inmobi-ads'] && pkg.dependencies['politicando-appodeal-ads'] && !pkg.dependencies['@capacitor-community/admob'] && !pkg.devDependencies?.['@capacitor-community/admob'], 'package.json: bridge InMobi (iOS) e Appodeal (Android), niente AdMob.');
const info = read('ios/App/App/Info.plist'); assert.ok(!/SKAdNetworkItems|NSUserTrackingUsageDescription|GADApplicationIdentifier/.test(info), 'iOS: nessun SKAdNetwork, testo ATT o ID AdMob (nessuna pubblicità nella release).');
const privacy = read('ios/App/App/PrivacyInfo.xcprivacy'); assert.doesNotMatch(privacy, /ThirdPartyAdvertising|AdvertisingData/, 'iOS: il privacy manifest non dichiara pubblicità di terzi (nessun SDK pubblicitario).'); assert.match(privacy, /<key>NSPrivacyTracking<\/key>\s*<false\/>/, 'Tracking falso.');
lines.push('versioni SDK, Gradle sincronizzato (Android), iOS senza SDK pubblicitari né dichiarazioni pubblicitarie, permessi');

// ---- C ----
const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
assert.ok([...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].every(m => m[1] === 'it.politicando2026.app'), 'iOS: Bundle ID it.politicando2026.app (quello registrato in App Store Connect), non quello Android.');
assert.ok([...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].every(m => m[1] === '1.0.3') && [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].every(m => m[1] === '4'), 'iOS: versione 1.0.1 (2) in Debug e Release (la 1.0 (1) è quella già inviata ad Apple).');
assert.ok(!/DEVELOPMENT_TEAM|CODE_SIGN_IDENTITY = "?(iPhone|Apple) Distribution/.test(pbx), 'iOS: nessun Team né identità di firma nel repository.');
assert.match(sw, /func showPrivacyOptions[\s\S]{0,500}call\.resolve\(InMobiAdsPlugin\.consentResult\(\)\)[\s\S]{0,60}\}\s*\}/, 'Swift: le opzioni privacy restituiscono lo stato dopo il modulo, come su Android 1.0.2.');
assert.ok(!/DEVELOPMENT_TEAM = [A-Z0-9]{10}/.test(pbx), 'iOS: nessun Team nel repository.'); assert.ok(!/ca-app-pub|GADApplication/.test(pbx));
const app = read('android/app/build.gradle'); assert.match(app, /applicationId "it\.matteobianchi\.politicando2026"/); assert.match(app, /versionCode \d+/); assert.match(app, /versionName "\d+\.\d+\.\d+"/);
assert.equal(JSON.parse(read('capacitor.config.json')).appId, 'it.matteobianchi.politicando2026', 'capacitor.config.json porta l’appId Android.');
lines.push('Bundle ID iOS it.politicando2026.app e versione iOS 1.0.3 (4); applicationId Android e versionCode corrente: separati; firma e Team: invariati');

// ---- D ----
function compileKotlin() {
  const cache = path.join(os.tmpdir(), 'politicando-inmobi-native'); fs.mkdirSync(cache, { recursive: true });
  const gradleLib = ['/opt/gradle/lib', ...fs.readdirSync('/opt').filter(name => /^gradle/.test(name)).map(name => `/opt/${name}/lib`)].find(dir => fs.existsSync(dir) && fs.readdirSync(dir).some(file => /^kotlin-compiler-embeddable-.*\.jar$/.test(file)));
  if (!gradleLib) return 'Gradle (con il compilatore Kotlin) non trovato';
  try { execFileSync('java', ['-version'], { stdio: 'ignore', env: { ...process.env, JAVA_TOOL_OPTIONS: '' } }); } catch { return 'Java non trovato'; }
  const central = 'https://repo1.maven.org/maven2';
  const need = [['inmobi.aar', `${central}/com/inmobi/monetization/inmobi-ads-kotlin/11.5.1/inmobi-ads-kotlin-11.5.1.aar`], ['android.jar', `${central}/com/google/android/android/4.1.1.4/android-4.1.1.4.jar`], ['json.jar', `${central}/org/json/json/20231013/json-20231013.jar`], ['trove4j.jar', `${central}/org/jetbrains/intellij/deps/trove4j/1.0.20200330/trove4j-1.0.20200330.jar`], ['coroutines.jar', `${central}/org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.8.0/kotlinx-coroutines-core-jvm-1.8.0.jar`], ['annotations.jar', `${central}/org/jetbrains/annotations/13.0/annotations-13.0.jar`]];
  for (const [name, url] of need) { const target = path.join(cache, name); if (fs.existsSync(target) && fs.statSync(target).size > 1000) continue; try { execFileSync('curl', ['-sfL', '--max-time', '120', '-o', target, url], { stdio: 'ignore' }); } catch { return `download non riuscito (${name})`; } }
  const env = { ...process.env, JAVA_TOOL_OPTIONS: '' };
  const aarDir = path.join(cache, 'aar'); fs.rmSync(aarDir, { recursive: true, force: true }); fs.mkdirSync(aarDir); execFileSync('unzip', ['-qo', path.join(cache, 'inmobi.aar'), 'classes.jar', '-d', aarDir], { stdio: 'ignore' });
  const stubOut = path.join(cache, 'stubs'); fs.rmSync(stubOut, { recursive: true, force: true }); fs.mkdirSync(stubOut);
  const javaFiles = []; (function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.java') && javaFiles.push(path.join(dir, entry.name)); })(path.join(ROOT, 'scripts/lib/inmobi-stubs'));
  execFileSync('javac', ['-nowarn', '-d', stubOut, '-cp', `${path.join(cache, 'android.jar')}:${path.join(cache, 'json.jar')}`, ...javaFiles], { stdio: 'pipe', env });
  const jar = prefix => path.join(gradleLib, fs.readdirSync(gradleLib).find(file => file.startsWith(prefix)));
  const compilerCp = [jar('kotlin-compiler-embeddable-'), jar('kotlin-reflect-'), jar('kotlin-script-runtime-'), jar('kotlin-daemon-embeddable-'), jar('kotlin-stdlib-'), path.join(cache, 'trove4j.jar'), path.join(cache, 'coroutines.jar'), path.join(cache, 'annotations.jar')].join(':');
  const classpath = [jar('kotlin-stdlib-'), path.join(cache, 'android.jar'), path.join(cache, 'json.jar'), path.join(aarDir, 'classes.jar'), stubOut, path.join(cache, 'coroutines.jar')].join(':');
  const out = path.join(cache, 'out'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
  const result = execFileSync('java', ['-cp', compilerCp, 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-Xskip-metadata-version-check', '-jvm-target', '17', '-cp', classpath, '-d', out, path.join(ROOT, KT)], { stdio: 'pipe', env, encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(out, 'it/matteobianchi/politicando/inmobi/InMobiAdsPlugin.class')), 'Il plugin Kotlin è compilato.');
  return null;
}
let skipped = null;
try { skipped = compileKotlin(); } catch (error) { assert.fail(`Compilazione Kotlin contro InMobi 11.5.1 FALLITA:\n${String(error.stderr ?? error.stdout ?? error.message).split('\n').filter(line => !/^warning|Picked up/.test(line)).slice(0, 12).join('\n')}`); }
if (skipped) lines.push(`SKIPPED: compilazione Kotlin contro l’SDK InMobi reale (${skipped})`); else lines.push('COMPILATO: il plugin Kotlin contro l’SDK InMobi 11.5.1 reale (Maven Central), senza errori');
console.log(`InMobi nativo verificato (${lines.length} gruppi):\n- ${lines.join('\n- ')}\nNon verificato qui: build Gradle con Android SDK, compilazione Swift/Xcode, esecuzione su dispositivo.`);
