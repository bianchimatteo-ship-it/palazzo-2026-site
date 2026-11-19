// `npx cap sync ios` with the right identity. capacitor.config.json is the common file and carries the ANDROID appId, so a plain `cap sync ios` writes that id into ios/App/App/capacitor.config.json.
// This command runs the sync and then puts the iOS bundle identifier (app-identity.json) back, and checks it: Xcode takes the real Bundle ID from the project (PRODUCT_BUNDLE_IDENTIFIER), this keeps the copy
// that Capacitor reads consistent. It never touches the Android project.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const identity = JSON.parse(await readFile(new URL('../app-identity.json', import.meta.url), 'utf8'));
const sync = spawnSync('npx', ['cap', 'sync', 'ios'], { cwd: ROOT, stdio: 'inherit' });
if (sync.status !== 0) process.exit(sync.status ?? 1);
const path = new URL('../ios/App/App/capacitor.config.json', import.meta.url);
const config = JSON.parse(await readFile(path, 'utf8'));
if (config.appId !== identity.ios.bundleId) {
  console.log(`cap-sync-ios: appId ${config.appId} → ${identity.ios.bundleId} (identità iOS).`);
  config.appId = identity.ios.bundleId;
  await writeFile(path, `${JSON.stringify(config, null, '\t')}\n`);
}
const buildInfoPath = new URL('../ios/App/App/public/build-info.json', import.meta.url);
const info = JSON.parse(await readFile(buildInfoPath, 'utf8'));
if (info.appIds?.ios !== identity.ios.bundleId || info.appIds?.android !== identity.android.applicationId) { console.error('cap-sync-ios: build-info.json non porta i due identificativi di app-identity.json: rifai npm run build:www.'); process.exit(1); }
console.log(`cap-sync-ios: iOS ${identity.ios.bundleId} (Android ${identity.android.applicationId} non toccato).`);
