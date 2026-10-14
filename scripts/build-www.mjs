// The web folder of the installed app (Capacitor `webDir`), built from the sources of the game: `src/`, `index.html`, the icons and the public pages. Repeatable: the same sources always give the
// same folder byte for byte (no dates, no random names; `build-info.json` carries a hash of the content, not a clock). Nothing is copied by hand.
//
//   node scripts/build-www.mjs            builds `www/` (files that are no longer sources are removed from `www/`, nothing outside it is touched)
//   node scripts/build-www.mjs --check    builds nothing: fails if `www/` is not exactly what the sources produce (drift) or if a check fails
//   node scripts/build-www.mjs --out DIR  builds somewhere else (used by the tests)
//
// Checks on every run (a failing one stops the build before anything is written):
//   - one build stamp (`?v=`) in index.html and in every import of the game, all the same;
//   - every file linked from index.html and every relative import of every module exists in the build (the import graph is closed);
//   - nothing that is not part of the game: Worker, Wrangler, scripts, docs, tests, migrations, node/ios/android projects, notes, environment files, keys;
//   - no secrets (private keys, Cloudflare/GitHub tokens, session tokens, owner PIN or setup code) and no call to an external host in the page, the style sheets or the code;
//   - the fonts, the public pages (privacy, terms, account deletion) and the icons of the manifest are there;
//   - Capacitor: `webDir` is the folder built here, `appId` is valid and equals the bundle identifier of the iOS project; the platforms present and the ones missing are reported.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// BUILD_WWW_ROOT: another project folder (the tests build small broken projects to see the checks fail).
const ROOT = resolve(process.env.BUILD_WWW_ROOT ?? fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const outIndex = args.indexOf('--out');
const OUT = resolve(ROOT, outIndex >= 0 ? args[outIndex + 1] : 'www');
// The destination is wiped of files that are no longer sources, so it must be `www/`-like: inside the project (never the project or one of its source folders), or somewhere that is new, empty or a previous build.
if (OUT === ROOT || ROOT.startsWith(OUT + sep) || ['src', 'icons', 'scripts', 'docs', 'ios', 'migrations', '.git'].some(dir => OUT === join(ROOT, dir) || OUT.startsWith(join(ROOT, dir) + sep))) throw new Error(`Destinazione non ammessa: ${OUT}`);
if (!OUT.startsWith(ROOT + sep)) {
  const present = await readdir(OUT).catch(() => []);
  if (present.length && !present.includes('build-info.json')) throw new Error(`La cartella ${OUT} non è vuota e non è una build precedente: non la tocco.`);
}

const ROOT_FILES = ['index.html', 'sw.js', 'favicon.ico', 'favicon.svg', 'site.webmanifest', 'privacy.html', 'termini.html', 'elimina-account.html'];
const DIRS = ['icons', 'src'];
// Published by the web site only (the snapshot the build step of the web site leaves out), and files that are never part of the game.
const SKIP = [/(^|\/)\.DS_Store$/, /\.map$/, /^src\/data\/real\/database\.json$/, /(^|\/)\.gitkeep$/];
const FORBIDDEN = [/^(worker\.js|wrangler\.jsonc|server\.mjs|package(-lock)?\.json|\.assetsignore|_headers|capacitor\.config\.json|README\.md)$/, /^(scripts|docs|migrations|node_modules|ios|android|www|\.git|\.github|\.wrangler|outputs|work)(\/|$)/, /(^|\/)\.env/, /\.(pem|key|p12|zip|log)$/, /\.test\.|\.spec\./];
const TEXT = /\.(html|css|js|json|svg|txt|webmanifest)$/;
const SECRETS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chiave privata'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'token GitHub'],
  [/\bcfut_[A-Za-z0-9]{30,}\b|\bCLOUDFLARE_API_TOKEN\b/, 'token Cloudflare'],
  [/\bADMIN_SETUP_CODE\s*[:=]\s*['"][^'"]+['"]/, 'codice di attivazione del proprietario'],
  [/\bBearer\s+[0-9a-f]{64}\b/, 'codice di sessione'],
  [/\bsk-[A-Za-z0-9]{32,}\b|\bAKIA[0-9A-Z]{16}\b/, 'chiave di servizio']
];
// Hosts the game may name: its own site and the public sources it links (a link is followed only if the player clicks it; code never fetches them).
const HOST_OK = /^(palazzo-2026-site\.bianchimatteo657\.workers\.dev|bianchimatteo-ship-it\.github\.io|(www\.)?w3\.org|openfontlicense\.org|localhost|127\.0\.0\.1)$/;

const problems = [];
const fail = message => problems.push(message);
const sha = data => createHash('sha256').update(data).digest('hex');
const toPosix = path => path.split(sep).join('/');

async function walk(dir, base = dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full, base));
    else if (entry.isFile()) found.push(toPosix(relative(base, full)));
  }
  return found.sort();
}

// ---------- 1. the files of the build ----------
const files = new Map();
for (const name of ROOT_FILES) { try { files.set(name, await readFile(join(ROOT, name))); } catch { fail(`Manca ${name}.`); } }
for (const dir of DIRS) for (const name of await walk(join(ROOT, dir), ROOT)) if (!SKIP.some(rule => rule.test(name))) files.set(name, await readFile(join(ROOT, name)));
for (const name of files.keys()) if (FORBIDDEN.some(rule => rule.test(name))) fail(`File che non fa parte del gioco: ${name}.`);

const text = name => files.get(name)?.toString('utf8') ?? '';

// ---------- 2. one build stamp ----------
const stamps = new Set();
for (const [name, data] of files) if (/\.(html|js|css)$/.test(name)) for (const match of data.toString('utf8').matchAll(/[?&]v=([0-9]{8}-[0-9]+)\b/g)) stamps.add(match[1]);
if (stamps.size !== 1) fail(`Serve un solo numero di versione (?v=), ce ne sono ${stamps.size}: ${[...stamps].join(', ') || '—'}. Esegui «npm run version:build».`);
const STAMP = [...stamps][0] ?? null;

// ---------- 3. the import graph is closed ----------
const resolveRef = (from, ref) => { const clean = ref.split('?')[0].split('#')[0]; return posix.normalize(posix.join(posix.dirname(from), clean)); };
const queue = [];
const seen = new Set();
const visit = (from, ref, kind) => {
  if (/^(https?:|data:|blob:|mailto:|tel:|#|\/api\/)/.test(ref) || !ref) return;
  const target = ref.startsWith('/') ? ref.slice(1) : resolveRef(from, ref);
  if (!files.has(target)) { fail(`${from}: ${kind} «${ref}» non esiste nella build (${target}).`); return; }
  if (!seen.has(target)) { seen.add(target); queue.push(target); }
};
const html = text('index.html');
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) visit('index.html', match[1], 'riferimento');
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
const URL_REF = /new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url/g;
const CSS_URL = /url\(\s*['"]?(?!data:|https?:|#)([^'")]+)['"]?\s*\)/g;
while (queue.length) {
  const name = queue.shift();
  const source = text(name);
  if (/\.js$/.test(name)) { for (const match of source.matchAll(IMPORT)) visit(name, match[1], 'import'); for (const match of source.matchAll(URL_REF)) visit(name, match[1], 'indirizzo'); }
  else if (/\.css$/.test(name)) for (const match of source.matchAll(CSS_URL)) visit(name, match[1], 'risorsa');
}
for (const needed of ['privacy.html', 'termini.html', 'elimina-account.html', 'src/legal.css', 'src/legal/delete-account.js', 'src/fonts/LICENSES.txt', 'src/main.js']) if (!files.has(needed)) fail(`Manca ${needed}.`);
// the icons named by the manifest
try { for (const icon of JSON.parse(text('site.webmanifest')).icons ?? []) if (!files.has(posix.normalize(icon.src.replace(/^\.\//, '')))) fail(`Icona del manifest mancante: ${icon.src}.`); } catch { fail('site.webmanifest non è un JSON valido.'); }

// ---------- 4. no secrets, no external hosts ----------
for (const [name, data] of files) {
  if (!TEXT.test(name)) continue;
  const source = data.toString('utf8');
  for (const [rule, label] of SECRETS) if (rule.test(source)) fail(`${name}: contiene ${label}.`);
  if (/\.(html|css|js)$/.test(name) && !name.startsWith('src/data/real/')) {
    for (const match of source.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const host = match[1].toLowerCase();
      // a source link in the interface text is allowed only as a string the player can click: calls from code (fetch / import / src=) are not
      if (HOST_OK.test(host)) continue;
      const before = source.slice(Math.max(0, match.index - 40), match.index);
      if (/(fetch\(|import\(|from\s+|src=|href=["']?$|url\()/.test(before) && !/href=/.test(before)) fail(`${name}: chiama l’host esterno ${host}.`);
    }
  }
}
if (/fonts\.(googleapis|gstatic)\.com/.test(html) || [...files.keys()].some(name => name.endsWith('.css') && /fonts\.(googleapis|gstatic)\.com/.test(text(name)))) fail('Carattere caricato da Google Fonts.');

// ---------- 5. Capacitor ----------
const platforms = { ios: false, android: false };
let appId = null;
try {
  const config = JSON.parse(await readFile(join(ROOT, 'capacitor.config.json'), 'utf8'));
  appId = config.appId;
  if (resolve(ROOT, config.webDir ?? '') !== resolve(ROOT, 'www')) fail(`capacitor.config.json: webDir «${config.webDir}» non è la cartella costruita qui (www).`);
  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/.test(appId ?? '')) fail(`capacitor.config.json: appId «${appId}» non valido.`);
  platforms.ios = await stat(join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj')).then(() => true, () => false);
  platforms.android = await stat(join(ROOT, 'android/app/build.gradle')).then(() => true, () => false);
  if (platforms.ios) {
    const ids = new Set([...(await readFile(join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8')).matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(match => match[1].trim()));
    if (ids.size !== 1 || !ids.has(appId)) fail(`Il progetto iOS ha come identificativo ${[...ids].join(', ')}, capacitor.config.json ${appId}.`);
  }
} catch (error) { fail(`capacitor.config.json: ${error.message}`); }

// ---------- 6. build-info ----------
const contentHash = sha([...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => `${name}:${sha(data)}`).join('\n'));
const info = { app: 'POLITICANDO 2026', appId, buildStamp: STAMP, files: files.size, bytes: [...files.values()].reduce((sum, data) => sum + data.length, 0), contentHash };
files.set('build-info.json', Buffer.from(`${JSON.stringify(info, null, 2)}\n`));

if (problems.length) { console.error(`Build di ${relative(ROOT, OUT)} interrotta:\n- ${problems.join('\n- ')}`); process.exit(1); }

// ---------- 7. compare, then write ----------
const existing = await stat(OUT).then(() => walk(OUT), () => []);
const changed = [], removed = [];
for (const [name, data] of files) { const current = await readFile(join(OUT, name)).catch(() => null); if (!current || sha(current) !== sha(data)) changed.push(name); }
for (const name of existing) if (!files.has(name)) removed.push(name);
const platformNote = `iOS ${platforms.ios ? 'presente' : 'assente'}, Android ${platforms.android ? 'presente' : 'ASSENTE (nessun progetto android/ e nessuna dipendenza @capacitor/android)'}`;
if (CHECK_ONLY) {
  if (changed.length || removed.length) { console.error(`${relative(ROOT, OUT)} non corrisponde alle sorgenti: ${changed.length} file diversi o mancanti, ${removed.length} in più. Esegui «npm run build:www».`); process.exit(1); }
  console.log(`${relative(ROOT, OUT)} coincide con le sorgenti (${info.files} file, ${info.contentHash.slice(0, 12)}, versione ${STAMP}). ${platformNote}.`);
  process.exit(0);
}
for (const name of removed) await rm(join(OUT, name), { force: true });
for (const name of changed) { const target = join(OUT, name); await mkdir(dirname(target), { recursive: true }); await writeFile(target, files.get(name)); }
// empty folders left by removed files
for (const dir of (await stat(OUT).then(() => walkDirs(OUT), () => [])).sort((a, b) => b.length - a.length)) if (!(await readdir(dir)).length) await rm(dir, { recursive: true, force: true });
async function walkDirs(dir) { const out = []; for (const entry of await readdir(dir, { withFileTypes: true })) if (entry.isDirectory()) { const full = join(dir, entry.name); out.push(full, ...await walkDirs(full)); } return out; }
let commit = 'n/d';
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* not a git checkout */ }
console.log(`${relative(ROOT, OUT)} costruita: ${info.files} file (${(info.bytes / 1e6).toFixed(1)} MB), ${changed.length} scritti, ${removed.length} rimossi, versione ${STAMP}, contenuto ${info.contentHash.slice(0, 12)} (sorgenti di ${commit}). ${platformNote}.`);
