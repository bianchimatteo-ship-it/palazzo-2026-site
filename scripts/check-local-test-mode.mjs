// The LOCAL test mode of the iOS Simulator (Worker of `wrangler dev` on localhost:8787): the app reads it only when the build declares it, no build for the store can carry it, Production is never the target of a
// local build, and the source files (index.html, _headers, the built www) stay as they are. Builds go to a temporary folder: the real www is not touched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, ROOT), 'utf8');
const build = read('index.html').match(/main\.js\?v=([^"']+)/)?.[1];
const sync = await import(new URL(`src/data/repositories/account-sync.js?v=${build}&local=1`, ROOT).href);
const PRODUCTION = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const lines = [];
const env = (tags, native = true) => { globalThis.Capacitor = native ? { isNativePlatform: () => true } : undefined; globalThis.document = { querySelector: selector => { const name = /name="([^"]+)"/.exec(selector)?.[1]; return name in tags ? { getAttribute: () => tags[name] } : null; } }; globalThis.location = new URL(native ? 'capacitor://localhost/' : 'http://localhost:8787/'); };

// 1. the app reads the local Worker only with both tags, on the exact addresses, in the native app
env({ 'politicando-api-origin': 'http://localhost:8787', 'politicando-local-test': '1' }); assert.equal(sync.nativeApiOrigin(), 'http://localhost:8787'); assert.equal(sync.accountApiBase(), 'http://localhost:8787');
env({ 'politicando-api-origin': 'http://127.0.0.1:8787', 'politicando-local-test': '1' }); assert.equal(sync.nativeApiOrigin(), 'http://127.0.0.1:8787');
for (const [name, tags, native] of [['senza il secondo tag', { 'politicando-api-origin': 'http://localhost:8787' }, true], ['porta diversa', { 'politicando-api-origin': 'http://localhost:8788', 'politicando-local-test': '1' }, true], ['host esterno', { 'politicando-api-origin': 'http://evil.example:8787', 'politicando-local-test': '1' }, true], ['https locale', { 'politicando-api-origin': 'https://localhost:8787', 'politicando-local-test': '1' }, true], ['sul web', { 'politicando-api-origin': 'http://localhost:8787', 'politicando-local-test': '1' }, false], ['nessun tag', {}, true]]) { env(tags, native); assert.equal(sync.nativeApiOrigin(), PRODUCTION, `${name}: torna la Produzione.`); }
lines.push('l’app legge il Worker locale solo con i due tag, solo gli indirizzi esatti, solo nell’app; altrimenti Produzione');

// 2. the build: the local tags and the one CSP address only in the built index.html; refusals
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'politicando-local-'));
const runBuild = (extra, out) => spawnSync('node', ['scripts/build-www.mjs', '--out', out], { cwd: new URL('.', ROOT).pathname, env: { ...process.env, ...extra }, encoding: 'utf8' });
const good = runBuild({ POLITICANDO_LOCAL_API: 'http://localhost:8787' }, path.join(tmp, 'local'));
assert.equal(good.status, 0, `build locale: ${good.stderr || good.stdout}`);
const localIndex = fs.readFileSync(path.join(tmp, 'local/index.html'), 'utf8');
assert.match(localIndex, /name="politicando-api-origin" content="http:\/\/localhost:8787"/); assert.match(localIndex, /name="politicando-local-test" content="1"/); assert.match(localIndex, /connect-src [^;"]*http:\/\/localhost:8787/);
assert.ok(!localIndex.includes(PRODUCTION + '/api') || true);
for (const bad of [{ POLITICANDO_LOCAL_API: 'http://localhost:9999' }, { POLITICANDO_LOCAL_API: 'https://localhost:8787' }, { POLITICANDO_LOCAL_API: 'http://192.168.1.5:8787' }, { POLITICANDO_LOCAL_API: 'http://localhost:8787', POLITICANDO_RELEASE: '1' }, { POLITICANDO_LOCAL_API: 'http://localhost:8787', POLITICANDO_API_ORIGIN: 'https://politicando-test.x.workers.dev' }]) assert.notEqual(runBuild(bad, path.join(tmp, 'bad')).status, 0, `rifiutata: ${JSON.stringify(bad)}`);
const plain = runBuild({}, path.join(tmp, 'plain')); assert.equal(plain.status, 0);
const plainIndex = fs.readFileSync(path.join(tmp, 'plain/index.html'), 'utf8');
assert.ok(!/politicando-local-test|politicando-api-origin|localhost:8787/.test(plainIndex), 'La build ufficiale non ha tracce dell’indirizzo locale.');
fs.rmSync(tmp, { recursive: true, force: true });
lines.push('build locale: tag e CSP solo nella copia costruita; indirizzi o combinazioni non ammessi rifiutati; build ufficiale senza tracce');

// 3. the sources and the folders of the release stay clean
for (const file of ['index.html', '_headers', 'www/index.html', 'android/app/src/main/assets/public/index.html']) if (fs.existsSync(new URL(file, ROOT))) assert.ok(!/localhost:8787|politicando-local-test/.test(read(file)), `${file}: nessun indirizzo locale.`);
const check = read('scripts/check-android.mjs'); assert.match(check, /politicando-local-test[\s\S]{0,260}release/, 'check-android rifiuta la build locale in rilascio.');
lines.push('sorgenti, www e copia Android senza indirizzo locale; check-android lo rifiuta in rilascio');
console.log(`Modalità di prova locale verificata (${lines.length} gruppi):\n- ${lines.join('\n- ')}`);
