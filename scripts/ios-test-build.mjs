// iOS Simulator test build pointed at the LOCAL Worker (`npm run cf:dev` → http://localhost:8787). Isolated: the www folder is built with POLITICANDO_LOCAL_API (two meta tags + one CSP address, only in the built
// index.html), the iOS project is synced, and www is rebuilt WITHOUT the tags at the end, so the folder that a release build reads (and the Android copy) never carries the local address. The copy inside ios/App/App/public
// (ignored by git) keeps it, for the Simulator. Nothing here deploys, signs or uploads; Production is never contacted (the app reads nativeApiOrigin → localhost:8787 only).
// Usage: node scripts/ios-test-build.mjs [--run]   (--run: also xcodebuild + simctl install/launch, only on a Mac with Xcode)
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = (cmd, args, env = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
const LOCAL = 'http://localhost:8787';
const missing = [];
console.log('1/4 build di www con il Worker locale (solo per il Simulatore)');
run('node', ['scripts/build-www.mjs'], { POLITICANDO_LOCAL_API: LOCAL });
const built = fs.readFileSync(path.join(ROOT, 'www/index.html'), 'utf8');
if (!built.includes('politicando-local-test') || !built.includes(`connect-src`) || !built.includes(LOCAL)) { console.error('www non contiene la modalità locale: interrotto.'); process.exit(1); }
console.log('2/4 cap sync ios');
run('npx', ['cap', 'sync', 'ios']);
const copy = path.join(ROOT, 'ios/App/App/public/index.html');
console.log(`   copia iOS con la modalità locale: ${fs.existsSync(copy) && fs.readFileSync(copy, 'utf8').includes('politicando-local-test') ? 'sì' : 'NO'}`);
console.log('3/4 www ricostruita SENZA l\'indirizzo locale (build ufficiali: Produzione)');
run('node', ['scripts/build-www.mjs']);
if (/politicando-local-test|politicando-api-origin/.test(fs.readFileSync(path.join(ROOT, 'www/index.html'), 'utf8'))) { console.error('www ha ancora i tag locali: errore.'); process.exit(1); }
console.log('4/4 Simulatore');
const xcrun = spawnSync('xcrun', ['--version'], { stdio: 'ignore' });
if (xcrun.error) missing.push('macOS con Xcode (xcrun/xcodebuild/simctl non disponibili qui): compilare e avviare sul Mac');
else if (process.argv.includes('--run')) {
  const derived = path.join(ROOT, 'ios/build-test');
  run('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', derived, 'CODE_SIGNING_ALLOWED=NO', 'build']);
  const app = path.join(derived, 'Build/Products/Debug-iphonesimulator/App.app');
  run('xcrun', ['simctl', 'boot', 'iPhone 16']); run('xcrun', ['simctl', 'install', 'booted', app]); run('xcrun', ['simctl', 'launch', 'booted', 'it.matteobianchi.politicando2026']);
} else console.log('   (Mac con Xcode rilevato: aggiungi --run per compilare e avviare)');
console.log(missing.length ? `\nPrerequisiti mancanti:\n- ${missing.join('\n- ')}\n\nSul Mac: 1) npm run cf:dev -- --var 'ADS_CONFIG:{...}' (vedi docs/inmobi.md) 2) node scripts/ios-test-build.mjs --run, oppure apri ios/App/App.xcodeproj in Xcode e premi Run sul Simulatore.` : '\nFatto.');
