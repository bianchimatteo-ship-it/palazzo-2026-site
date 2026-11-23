// The identities of the two apps, checked SEPARATELY and never mixed: iOS (Bundle ID, Apple App ID, SKU, version 1.0.1 build 2, Debug and Release) and Android (applicationId, namespace, Capacitor appId).
// The values come from app-identity.json (confirmed by the owner from App Store Connect, 19/11/2026); every file of each platform is compared with them. No network, no Xcode needed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const identity = JSON.parse(await read('app-identity.json'));
const lines = [];

// ---------- the source of truth ----------
assert.equal(identity.ios.bundleId, 'it.politicando2026.app', 'iOS: Bundle ID registrato in App Store Connect.');
assert.equal(identity.ios.appleAppId, '6835582269', 'iOS: Apple App ID numerico.');
assert.equal(identity.ios.sku, 'POLITICANDO2026-IOS', 'iOS: SKU.');
assert.equal(identity.android.applicationId, 'it.matteobianchi.politicando2026', 'Android: applicationId.');
assert.notEqual(identity.ios.bundleId, identity.android.applicationId, 'I due identificativi sono diversi.');
assert.ok(!identity.ios.bundleId.includes('matteobianchi') && !String(identity.ios.appleAppId).includes('.'), 'iOS: nessun frammento di identificativo Android.');

// ---------- iOS ----------
const pbx = await read('ios/App/App.xcodeproj/project.pbxproj');
const bundleIds = [...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(match => match[1].trim());
assert.equal(bundleIds.length, 2, `iOS: Debug e Release hanno il Bundle ID (${bundleIds.length} trovati).`);
assert.ok(bundleIds.every(id => id === identity.ios.bundleId), `iOS: Bundle ID in Debug e Release = ${identity.ios.bundleId} (${bundleIds}).`);
const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(match => match[1].trim());
const build = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map(match => match[1].trim());
assert.deepEqual([marketing.length, build.length], [2, 2], 'iOS: versione e build in Debug e Release.');
assert.ok(marketing.every(v => v === '1.0.2'), `iOS: MARKETING_VERSION 1.0.2 (${marketing}).`);
assert.ok(build.every(v => v === '3'), `iOS: CURRENT_PROJECT_VERSION 3, oltre la 2 della 1.0.1 (2) già inviata (${build}).`);
const plist = await read('ios/App/App/Info.plist');
assert.match(plist, /<key>CFBundleIdentifier<\/key>\s*<string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/, 'iOS: Info.plist prende il Bundle ID dal progetto.');
assert.match(plist, /CFBundleShortVersionString<\/key>\s*<string>\$\(MARKETING_VERSION\)/); assert.match(plist, /CFBundleVersion<\/key>\s*<string>\$\(CURRENT_PROJECT_VERSION\)/);
const iosConfig = JSON.parse(await read('ios/App/App/capacitor.config.json'));
assert.equal(iosConfig.appId, identity.ios.bundleId, 'iOS: ios/App/App/capacitor.config.json porta il Bundle ID iOS (dopo npm run cap:sync:ios).');
const iosInfo = JSON.parse(await read('ios/App/App/public/build-info.json'));
assert.deepEqual(iosInfo.appIds, { android: identity.android.applicationId, ios: identity.ios.bundleId }, 'iOS: build-info del pacchetto con i due identificativi, separati.');
assert.ok(!/it\.matteobianchi/.test(pbx) && !/it\.matteobianchi/.test(JSON.stringify(iosConfig)), 'iOS: nessun identificativo Android nel progetto Xcode né nella configurazione iOS.');
assert.ok(!/DEVELOPMENT_TEAM = [A-Z0-9]{10}/.test(pbx), 'iOS: nessun Team nel repository.');
lines.push(`iOS ${identity.ios.bundleId} · Apple ID ${identity.ios.appleAppId} · SKU ${identity.ios.sku} · 1.0.2 (3) Debug+Release`);

// ---------- Android ----------
const gradle = await read('android/app/build.gradle');
assert.equal(/applicationId\s+"([^"]+)"/.exec(gradle)?.[1], identity.android.applicationId, 'Android: applicationId.');
assert.equal(/namespace\s*=?\s*"([^"]+)"/.exec(gradle)?.[1], identity.android.applicationId, 'Android: namespace.');
assert.equal(JSON.parse(await read('capacitor.config.json')).appId, identity.android.applicationId, 'Android: capacitor.config.json (configurazione comune) porta l’appId Android.');
assert.equal(JSON.parse(await read('android/app/src/main/assets/capacitor.config.json')).appId, identity.android.applicationId, 'Android: la copia nel progetto Android.');
assert.ok(!gradle.includes(identity.ios.bundleId) && !(await read('android/app/src/main/AndroidManifest.xml')).includes(identity.ios.bundleId), 'Android: nessun identificativo iOS.');
const vc = /versionCode (\d+)/.exec(gradle)?.[1], vn = /versionName "(\d+\.\d+\.\d+)"/.exec(gradle)?.[1]; assert.ok(Number(vc) >= 4 && vn, `versionCode e versionName di Android presenti (${vc} / ${vn}).`);
const androidInfo = JSON.parse(await read('android/app/src/main/assets/public/build-info.json'));
assert.deepEqual(androidInfo.appIds, { android: identity.android.applicationId, ios: identity.ios.bundleId }, 'Android: build-info del pacchetto con i due identificativi, separati.');
lines.push(`Android ${identity.android.applicationId} · versionCode ${vc} / ${vn} (iOS 1.0.2 build 3)`);

// ---------- never mixed in the shared code or the ads ----------
const ads = await read('src/data/ads-config.js');
assert.ok(!/ca-app-pub/.test(ads) && !ads.includes(identity.android.applicationId.replace('it.', 'it.')), 'Gli annunci non portano ID AdMob né l’applicationId Android; il Bundle ID iOS compare solo nel blocco iOS.');
assert.equal(ads.split(identity.ios.bundleId).length - 1, 2, 'Il Bundle ID iOS compare solo nel blocco iOS di InMobi (commento e dato).');
const { INMOBI } = await import(`../src/data/ads-config.js?v=${(await read('index.html')).match(/main\.js\?v=([^"']+)/)?.[1]}`);
assert.equal(INMOBI.ios.bundleId, identity.ios.bundleId, 'InMobi iOS: Bundle ID dell’app iOS.'); assert.notEqual(INMOBI.ios.appKey, INMOBI.android.appKey, 'InMobi: App Key diverse per piattaforma.'); assert.equal(INMOBI.accountId, '60d3e31b9c094bd69283e287bc2d4c42', 'InMobi: Account ID verificato dal titolare.');
const plistText = await read('ios/App/App/Info.plist');
assert.ok(!/ca-app-pub|GADApplicationIdentifier/.test(plistText), 'iOS: nessun ID AdMob Android riutilizzato (l’App ID AdMob iOS non è stato fornito).');
const manifest = await read('android/app/src/main/AndroidManifest.xml');
assert.doesNotMatch(manifest, /ca-app-pub|gms\.ads\.APPLICATION_ID/, 'Android: nessun App ID AdMob nel manifest (il provider Android è Appodeal, senza adapter AdMob).');
console.log(`Identificativi verificati, iOS e Android separati: ${lines.join(' | ')}.`);
