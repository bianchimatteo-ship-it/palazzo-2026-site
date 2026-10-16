// What Cloudflare Workers would publish (wrangler.jsonc: assets directory "." minus what .assetsignore excludes), computed locally, and the wiring of the Worker: every file the game needs is
// published (the code reachable from src/main.js, the stylesheets, the real data listed in the manifest, the logos, icons, service worker), nothing that is tooling, server code, notes or a
// build copy of the mobile app is; each asset is under the Workers limit (25 MiB) and the file count under 20 000; wrangler.jsonc routes /api/* to worker.js and declares every binding the
// Worker reads (ASSETS, ADMIN_ARCHIVE, ACCOUNTS); no secret is written in a tracked file. Nothing here touches the network or a deploy.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const walk = async (dir, out = []) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out); else out.push(path);
  }
  return out;
};
const files = (await walk(root)).map(path => relative(root, path).split('\\').join('/')).sort();

// ---------- .assetsignore (gitignore-style: a name matches at any depth, a path with a slash from the root, * and ** as usual) ----------
const patterns = (await readFile(join(root, '.assetsignore'), 'utf8')).split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
const regexOf = pattern => {
  const anchored = pattern.replace(/\/$/, '').includes('/') && !pattern.startsWith('**/');
  const body = pattern.replace(/^\*\*\//, '').replace(/\/$/, '').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(anchored ? `^${body}(/.*)?$` : `(^|/)${body}(/.*)?$`);
};
const ignored = patterns.map(regexOf);
const published = files.filter(path => !ignored.some(regex => regex.test(path)));
const isPublished = path => published.includes(path);

// ---------- 1. what the game needs is published ----------
const index = await readFile(join(root, 'index.html'), 'utf8');
const SPECIFIER = /(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"?]+?\.js)(?:\?[^'"]*)?['"]/g;
const modules = new Set();
const visit = async path => {
  if (modules.has(path)) return;
  modules.add(path);
  const source = await readFile(join(root, path), 'utf8');
  for (const [, relativePath] of source.matchAll(SPECIFIER)) await visit(posix.normalize(posix.join(posix.dirname(path), relativePath)));
};
await visit('src/main.js');
const need = new Set(['index.html', 'sw.js', 'favicon.ico', 'favicon.svg', 'site.webmanifest', ...modules]);
for (const [, path] of index.matchAll(/(?:href|src)="\.\/([^"?#]+)/g)) need.add(path);
const webmanifest = JSON.parse(await readFile(join(root, 'site.webmanifest'), 'utf8'));
for (const icon of webmanifest.icons ?? []) need.add(posix.normalize(icon.src.replace(/^\.?\//, '')));
for (const name of files.filter(path => /^icons\//.test(path))) need.add(name);
const manifest = JSON.parse(await readFile(join(root, 'src/data/real/manifest.json'), 'utf8'));
const dataFiles = new Set(Object.values(manifest.documents ?? {}).map(item => `src/data/real/${item.file}`));
for (const name of files.filter(path => /^src\/data\/real\/[^/]+\.json$/.test(path) && path !== 'src/data/real/database.json')) dataFiles.add(name);
for (const path of dataFiles) need.add(path);
for (const party of JSON.parse(await readFile(join(root, 'src/data/real/parties.json'), 'utf8'))) if (party.logoAsset) need.add(party.logoAsset.replace(/^\.\//, ''));
for (const path of files.filter(path => /^src\/data\/real\/assets\//.test(path))) need.add(path);
for (const path of need) {
  assert.ok(files.includes(path), `${path}: lo cita il gioco ma non esiste.`);
  assert.ok(isPublished(path), `${path}: serve al gioco ma .assetsignore lo esclude.`);
}
// One cache-busting version on index.html and on every relative import and stylesheet (a deploy never mixes fresh and stale modules).
{
  const stamp = index.match(/main\.js\?v=([^"']+)/)?.[1];
  assert.ok(stamp, 'index.html porta la versione di build.');
  const SPEC = /(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"?]+?\.js)(?:\?v=([^'"]*))?['"]/g;
  for (const path of modules) for (const [, target, version] of (await readFile(join(root, path), 'utf8')).matchAll(SPEC)) assert.equal(version, stamp, `${path} importa ${target} con la versione ${version ?? 'assente'} invece di ${stamp}.`);
  for (const [, , version] of index.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+\.css)\?v=([^"]+)"/g)) assert.equal(version, stamp, `Un foglio di stile ha la versione ${version} invece di ${stamp}.`);
}
const stylesheets = [...index.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+\.css)/g)].map(match => match[1]);
assert.ok(stylesheets.length >= 9 && stylesheets.every(path => isPublished(path)), 'Tutti i fogli di stile collegati sono pubblicati.');
for (const collection of Object.keys(manifest.collections ?? {})) {
  const name = { twoPerThousand: 'two-per-thousand', realPolls: 'polls' }[collection] ?? collection.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  assert.ok(files.includes(`src/data/real/${name}.json`) || files.some(path => path.startsWith(`src/data/real/${name}`)), `Collezione reale ${collection}: file ${name}.json.`);
}

// ---------- 2. what is not the game is not published ----------
const never = ['worker.js', 'wrangler.jsonc', 'package.json', 'package-lock.json', 'server.mjs', 'README.md', 'capacitor.config.json', '.assetsignore', 'src/data/real/database.json', ...files.filter(path => /^(scripts|migrations|docs|www|ios|\.github)\//.test(path))];
for (const path of never) if (files.includes(path)) assert.ok(!isPublished(path), `${path}: non fa parte del gioco e non va pubblicato.`);
assert.ok(published.every(path => !/\.(zip|swift|xcconfig|mjs)$/.test(path)), 'Nessun archivio, sorgente nativo o script tra gli asset.');
assert.ok(published.every(path => !path.split('/').some(segment => segment.startsWith('.') && segment !== '.well-known')), 'Nessun file nascosto tra gli asset.');

// ---------- 3. limits ----------
let total = 0;
for (const path of published) { const size = (await stat(join(root, path))).size; total += size; assert.ok(size <= 25 * 1024 * 1024, `${path}: oltre i 25 MiB per asset di Workers.`); }
assert.ok(published.length <= 20000, `${published.length} asset: oltre il limite di Workers.`);

// ---------- 4. the Worker's wiring ----------
const stripped = (await readFile(join(root, 'wrangler.jsonc'), 'utf8')).split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
const wrangler = JSON.parse(stripped);
const worker = await readFile(join(root, 'worker.js'), 'utf8');
assert.ok(files.includes(wrangler.main), 'Il Worker principale esiste.');
assert.equal(wrangler.assets?.directory, '.', 'Gli asset sono la radice del progetto (filtrata da .assetsignore).');
assert.equal(wrangler.assets?.binding, 'ASSETS'); assert.deepEqual(wrangler.assets?.run_worker_first, ['/api/*'], 'Il Worker risponde solo a /api/*: il resto sono asset.');
const bindings = new Set([...(wrangler.kv_namespaces ?? []).map(item => item.binding), ...(wrangler.d1_databases ?? []).map(item => item.binding), wrangler.assets?.binding, ...Object.keys(wrangler.vars ?? {})]);
// Secrets of the Worker (never in the project) and the one hook for tests (a function: a Worker's variables are strings, so it cannot exist in production).
const WORKER_SECRETS = new Set(['ADMIN_SETUP_CODE', 'RESEND_API_KEY', 'EMAIL_SEND']);
assert.ok(['EMAIL_FROM', 'PUBLIC_BASE_URL', 'ACCOUNT_EMAIL_REQUIRED'].every(name => name in (wrangler.vars ?? {})) && !('RESEND_API_KEY' in (wrangler.vars ?? {})), 'Le impostazioni dell’email sono dichiarate; la chiave del provider è un secret, non una variabile.');
for (const used of new Set([...worker.matchAll(/\benv\.([A-Z_]+)\b/g)].map(match => match[1]))) assert.ok(bindings.has(used) || WORKER_SECRETS.has(used), `env.${used} è letto dal Worker ma non è dichiarato in wrangler.jsonc.`);
assert.ok(worker.includes('ADMIN_SETUP_CODE') && !/ADMIN_SETUP_CODE['"]?\s*[:=]\s*['"][^'"]{3,}/.test(worker + stripped), 'Il codice di attivazione è un secret del Worker, non scritto nel progetto.');
assert.ok(files.includes('migrations/0001_accounts.sql') && wrangler.d1_databases?.every(item => item.migrations_dir && files.some(path => path.startsWith(`${item.migrations_dir}/`))), 'Le migrazioni D1 ci sono.');
for (const route of ['/api/admin', '/api/admin/session', '/api/account/register', '/api/account/login', '/api/saves']) assert.ok(worker.includes(route), `Il Worker gestisce ${route}.`);
assert.ok(!/access-control-allow-origin['"]?\s*:\s*['"]\*/i.test(worker), 'Nessun CORS aperto a tutti.');
assert.ok(files.includes('_headers') && isPublished('_headers') === true, 'Le intestazioni di sicurezza degli asset (_headers) sono nel progetto.');
const headers = await readFile(join(root, '_headers'), 'utf8');
for (const name of ['X-Content-Type-Options: nosniff', 'Referrer-Policy:', 'X-Frame-Options: DENY', 'Permissions-Policy:']) assert.ok(headers.includes(name), `_headers: ${name}`);
assert.ok(/x-content-type-options['"]?\s*:\s*['"]nosniff/i.test(worker), 'Anche le risposte dell’API hanno nosniff.');
assert.ok(worker.includes('cache-control') && /no-store/.test(worker), 'Le risposte dell’API non si mettono in cache.');
assert.ok(/status: 4\d\d|, (400|401|404|409|413|429|503)\)/.test(worker) && worker.includes('Errore interno'), 'Errori HTTP gestiti, senza esporre i dettagli di un’eccezione.');

// ---------- 5. no secret in a tracked file ----------
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(path => path && !/\.(png|webp|ico|jpg|jpeg|svg|zip|pdf)$/.test(path) && !/^src\/data\/real\//.test(path) && !/package-lock\.json$/.test(path));
const SECRETS = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bCLOUDFLARE_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{20,}/, /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/, /\bsk-[A-Za-z0-9]{32,}/, /\bAKIA[0-9A-Z]{16}\b/, /xox[baprs]-[A-Za-z0-9-]{20,}/, /\bPIN\s*[=:]\s*['"]\d{4,}['"]/];
for (const path of tracked) {
  let text; try { text = await readFile(join(root, path), 'utf8'); } catch { continue; }
  for (const pattern of SECRETS) assert.ok(!pattern.test(text), `${path}: sembra contenere un segreto (${pattern}).`);
}
console.log(`Pubblicazione verificata (senza rete né deploy): ${published.length} asset su ${files.length} file (${(total / 1048576).toFixed(1)} MiB), ${need.size} file necessari al gioco tutti pubblicati (${modules.size} moduli, ${stylesheets.length} fogli di stile, ${dataFiles.size} file di dati reali), strumenti, Worker, migrazioni, documenti, copia mobile e snapshot aggregato esclusi, limiti di Workers rispettati, binding del Worker dichiarati in wrangler.jsonc, nessun segreto nei file tracciati.`);
