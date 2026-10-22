// The app build (Capacitor): `www/` is produced from the sources by scripts/build-www.mjs, never by hand.
//   - the build is repeatable (same sources, same folder, same hash; a second run writes nothing) and complete (index, modules, styles, fonts, icons, public pages: the import graph is closed);
//   - it holds nothing that is not the game (Worker, scripts, docs, tests, keys, the iOS project...) and the checks stop a broken build before anything is written: two build stamps, a missing
//     import, a secret, a call to an external host, a file that must not ship, a wrong bundle identifier;
//   - Capacitor: webDir and bundle identifier agree with the iOS project; Android is reported as missing; the installed app talks to the published Worker (account service, public pages) and the
//     Worker accepts the app's own origins and no other;
//   - `--www` also fails if the committed `www/` is not exactly what the sources produce (the gate before building the app).
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts/build-www.mjs');
const run = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
const scratch = await mkdtemp(join(tmpdir(), 'politicando-www-'));
try {
  // ---------- 1. the real project: repeatable and complete ----------
  const out = join(scratch, 'out');
  let result = run(['--out', out]);
  assert.equal(result.status, 0, `La build riesce.\n${result.stderr}`);
  assert.match(result.stdout, /costruita: \d+ file/);
  const info = JSON.parse(await readFile(join(out, 'build-info.json'), 'utf8'));
  assert.equal(info.appId, JSON.parse(await readFile(join(ROOT, 'capacitor.config.json'), 'utf8')).appId, 'build-info porta l’identificativo dell’app.');
  assert.match(info.buildStamp, /^\d{8}-\d+$/);
  assert.ok(info.files > 150 && info.bytes < 40e6, `Dimensione plausibile (${info.files} file, ${info.bytes} byte).`);
  assert.equal(JSON.stringify(info).includes('builtAt'), false, 'Nessuna data nella build: è ripetibile.');
  result = run(['--out', out]);
  assert.match(result.stdout, /0 scritti, 0 rimossi/, 'La seconda build non scrive nulla.');
  assert.equal(JSON.parse(await readFile(join(out, 'build-info.json'), 'utf8')).contentHash, info.contentHash, 'Stesso contenuto, stesso hash.');
  result = run(['--out', out, '--check']);
  assert.equal(result.status, 0, 'Il controllo di coincidenza passa su una build appena fatta.');
  await writeFile(join(out, 'src/main.js'), '// toccato a mano\n', { flag: 'a' });
  result = run(['--out', out, '--check']);
  assert.equal(result.status, 1, 'Un file modificato a mano nella build viene scoperto.');
  assert.match(result.stderr, /non corrisponde alle sorgenti/);
  await writeFile(join(out, 'file-di-troppo.txt'), 'x');
  result = run(['--out', out]);
  assert.match(result.stdout, /1 rimossi/, 'Un file che non è più sorgente viene tolto dalla build (e solo da lì).');
  const present = async name => readFile(join(out, name)).then(() => true, () => false);
  for (const name of ['index.html', 'sw.js', 'src/main.js', 'src/styles.css', 'src/home.css', 'src/fonts/dm-sans-latin-400-normal.woff2', 'src/fonts/LICENSES.txt', 'src/data/real/parties.json', 'privacy.html', 'termini.html', 'elimina-account.html', 'privacy-en.html', 'terms-en.html', 'delete-account-en.html', 'icons/icon-512.png', 'site.webmanifest']) assert.ok(await present(name), `${name} è nella build.`);
  for (const name of ['worker.js', 'wrangler.jsonc', 'package.json', 'scripts/build-www.mjs', 'docs/privacy-e-asset.md', 'migrations/0001_accounts.sql', 'server.mjs', 'src/data/real/database.json', '.assetsignore', '_headers', 'ios/App/App/Info.plist', 'README.md']) assert.equal(await present(name), false, `${name} non è nella build.`);
  assert.equal(/fonts\.googleapis|fonts\.gstatic/.test(await readFile(join(out, 'index.html'), 'utf8')), false, 'La build non chiama Google Fonts.');

  // ---------- 2. the checks stop a broken build ----------
  const fake = async (name, tweak) => {
    const dir = join(scratch, name);
    await mkdir(join(dir, 'src/fonts'), { recursive: true }); await mkdir(join(dir, 'src/legal'), { recursive: true }); await mkdir(join(dir, 'icons'), { recursive: true }); await mkdir(join(dir, 'ios/App/App.xcodeproj'), { recursive: true });
    const files = {
      'index.html': '<!doctype html><link rel="stylesheet" href="./src/a.css?v=20260101-1"><script type="module" src="./src/main.js?v=20260101-1"></script>',
      'sw.js': '//', 'favicon.ico': 'x', 'favicon.svg': '<svg/>', 'site.webmanifest': '{"icons":[{"src":"./icons/i.png"}]}', 'privacy.html': '<p/>', 'termini.html': '<p/>', 'elimina-account.html': '<p/>', 'privacy-en.html': '<p/>', 'terms-en.html': '<p/>', 'delete-account-en.html': '<p/>',
      'icons/i.png': 'x', 'src/a.css': 'body{}', 'src/main.js': "import './b.js?v=20260101-1';\n", 'src/b.js': 'export const b = 1;\n', 'src/legal.css': '', 'src/legal/delete-account.js': '', 'src/fonts/LICENSES.txt': 'OFL',
      'capacitor.config.json': JSON.stringify({ appId: 'it.prova.app', appName: 'Prova', webDir: 'www' }),
      'ios/App/App.xcodeproj/project.pbxproj': 'PRODUCT_BUNDLE_IDENTIFIER = it.prova.app;'
    };
    await tweak(files);
    for (const [path, data] of Object.entries(files)) { if (data === null) continue; await mkdir(join(dir, path, '..'), { recursive: true }); await writeFile(join(dir, path), data); }
    return dir;
  };
  const build = async (name, tweak) => run(['--out', join(scratch, `${name}-www`)], { BUILD_WWW_ROOT: await fake(name, tweak) });
  let broken = await build('ok', () => {});
  assert.equal(broken.status, 0, `Il progetto di prova minimo costruisce.\n${broken.stderr}`);
  broken = await build('stamps', f => { f['src/main.js'] = "import './b.js?v=20260202-2';\n"; });
  assert.ok(broken.status === 1 && /un solo numero di versione/.test(broken.stderr), 'Due numeri di versione: la build si ferma.');
  broken = await build('missing', f => { f['src/main.js'] = "import './manca.js?v=20260101-1';\n"; });
  assert.ok(broken.status === 1 && /import «\.\/manca\.js[^»]*» non esiste/.test(broken.stderr), 'Un import mancante: la build si ferma.');
  broken = await build('secret', f => { f['src/b.js'] = "export const token = 'ghp_" + 'a'.repeat(36) + "';\n"; });
  assert.ok(broken.status === 1 && /token GitHub/.test(broken.stderr), 'Un segreto nel codice: la build si ferma.');
  broken = await build('host', f => { f['src/b.js'] = "export const load = () => fetch('https://tracker.example.com/x');\n"; });
  assert.ok(broken.status === 1 && /host esterno tracker\.example\.com/.test(broken.stderr), 'Una chiamata a un host esterno: la build si ferma.');
  broken = await build('fonts', f => { f['index.html'] = f['index.html'] + '<link href="https://fonts.googleapis.com/css2?family=X" rel="stylesheet">'; });
  assert.ok(broken.status === 1 && /Google Fonts/.test(broken.stderr), 'Google Fonts nella pagina: la build si ferma.');
  broken = await build('forbidden', f => { f['src/worker.test.js'] = 'x'; f['src/.env'] = 'A=1'; });
  assert.ok(broken.status === 1 && /worker\.test\.js/.test(broken.stderr) && /\.env/.test(broken.stderr), 'File che non devono stare nella build: la build si ferma.');
  broken = await build('bundle', f => { f['ios/App/App.xcodeproj/project.pbxproj'] = 'PRODUCT_BUNDLE_IDENTIFIER = it.altro.app;'; });
  assert.ok(broken.status === 1 && /identificativo it\.altro\.app/.test(broken.stderr), 'Identificativo dell’app diverso da quello del progetto iOS: la build si ferma.');
  broken = await build('webdir', f => { f['capacitor.config.json'] = JSON.stringify({ appId: 'it.prova.app', webDir: 'public' }); });
  assert.ok(broken.status === 1 && /webDir «public»/.test(broken.stderr), 'webDir diverso da www: la build si ferma.');
  broken = await build('icon', f => { f['icons/i.png'] = null; });
  assert.ok(broken.status === 1 && /Icona del manifest mancante/.test(broken.stderr), 'Icona del manifest mancante: la build si ferma.');
  // nothing was written by a failing build
  assert.equal(await present.call(null, '../stamps-www/index.html').catch(() => false), false);
  // the destination is guarded
  for (const bad of [ROOT, join(ROOT, 'src'), join(ROOT, 'scripts'), tmpdir()]) { const guard = run(['--out', bad]); assert.equal(guard.status === 0, false, `Destinazione non ammessa: ${bad}.`); }

  // ---------- 3. Capacitor: iOS, Android, the Worker ----------
  const config = JSON.parse(await readFile(join(ROOT, 'capacitor.config.json'), 'utf8'));
  assert.equal(config.webDir, 'www');
  const pbx = await readFile(join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  assert.ok([...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].every(match => match[1].trim() === config.appId), 'Stesso identificativo in Capacitor e nel progetto iOS.');
  const plist = await readFile(join(ROOT, 'ios/App/App/Info.plist'), 'utf8');
  assert.equal(/UsageDescription/.test(plist), false, 'Nessun permesso richiesto sull’iPhone (nessuna descrizione d’uso: il gioco non usa fotocamera, microfono, posizione, contatti).');
  assert.equal(/UIBackgroundModes/.test(plist), false, 'Nessuna modalità in background.');
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const hasAndroid = Boolean(pkg.dependencies?.['@capacitor/android']);
  console.log(`Stato piattaforme: iOS ${pbx.length ? 'presente' : 'assente'} (target ${[...new Set([...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map(match => match[1]))].join(', ')}, versione ${[...new Set([...pbx.matchAll(/MARKETING_VERSION = ([\d.]+);/g)].map(match => match[1]))].join(', ')}, build ${[...new Set([...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(match => match[1]))].join(', ')}); Android ${hasAndroid ? 'presente' : 'NON PRESENTE'}.`);

  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
  const build_ = (await readFile(join(ROOT, 'index.html'), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
  const sync = await import(`../src/data/repositories/account-sync.js?v=${build_}&cap=1`);
  const PROD = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
  globalThis.location = new URL('capacitor://localhost/');
  assert.equal(sync.accountApiBase(), PROD, 'L’app iOS parla con il Worker pubblicato.');
  assert.equal(sync.publicSiteBase(), `${PROD}/`, 'Nell’app le pagine pubbliche sono quelle del sito pubblicato.');
  globalThis.location = new URL('https://localhost/');
  globalThis.Capacitor = { isNativePlatform: () => true };
  assert.equal(sync.accountApiBase(), PROD, 'L’app Android (https://localhost) parla con il Worker pubblicato.');
  globalThis.Capacitor = undefined;
  globalThis.location = new URL('http://127.0.0.1:8791/');
  assert.equal(sync.accountApiBase(), 'http://127.0.0.1:8791', 'In prova locale resta il Worker locale: i test non toccano la produzione.');
  assert.equal(sync.publicSiteBase(), '', 'Sul sito le pagine pubbliche sono relative.');
  globalThis.location = new URL('https://localhost/');
  assert.equal(sync.accountApiBase(), null, 'Un localhost qualunque (non l’app) non raggiunge gli account.');
  const worker = (await import('../worker.js?cap=1')).default;
  const env = { ACCOUNTS: null, ADMIN_ARCHIVE: { get: async () => null }, ASSETS: { fetch: async () => new Response('x') } };
  const origin = async value => (await worker.fetch(new Request(`${PROD}/api/account/status`, { method: 'OPTIONS', headers: { origin: value, 'access-control-request-method': 'GET' } }), env)).headers.get('access-control-allow-origin');
  assert.equal(await origin('capacitor://localhost'), 'capacitor://localhost', 'Il Worker accetta l’origine dell’app iOS.');
  assert.equal(await origin('https://localhost'), 'https://localhost', 'Il Worker accetta l’origine dell’app Android.');
  assert.notEqual(await origin('https://sito-estraneo.example'), 'https://sito-estraneo.example', 'Un’origine estranea non viene accettata.');

  // ---------- 4. the committed www ----------
  if (process.argv.includes('--www')) {
    const drift = run(['--check']);
    assert.equal(drift.status, 0, `www/ coincide con le sorgenti.\n${drift.stderr}`);
    console.log(drift.stdout.trim());
  } else console.log('Coincidenza di www/ con le sorgenti NON verificata qui (usa «npm run check:www» o --www).');
  console.log('Build dell’app verificata: ripetibile, completa, senza file estranei né segreti né host esterni, controlli che fermano una build rotta, identificativo e permessi, origini accettate dal Worker, app che usa il Worker pubblicato.');
} finally { await rm(scratch, { recursive: true, force: true }); }
