// The architecture of publication: the game reaches the users only as the Android app; the production Worker answers the API and the portal (confirm the e-mail, new password, legal pages) and NEVER the game; the full web game lives
// in a private test site (Cloudflare Access) with its own D1/KV/R2 and no production e-mail. Nothing here touches the network or a real resource.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(join(ROOT, name), 'utf8');
const jsonc = async name => JSON.parse((await read(name)).split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n'));
const PROD = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const PROD_IDS = { kv: 'a40ce7a2dc6b4ea6bfa5bedafedc421a', d1: '38d4e3b4-a8a3-437d-8ef0-a06cc074d051', d1Name: 'politicando-accounts', r2: 'politicando-logos', worker: 'palazzo-2026-site' };
const lines = [];

// ---------- 1. production: the ids and names of the resources are untouched; the assets are the portal, not the game ----------
const prod = await jsonc('wrangler.jsonc');
assert.equal(prod.name, PROD_IDS.worker); assert.equal(prod.kv_namespaces[0].id, PROD_IDS.kv); assert.equal(prod.d1_databases[0].database_id, PROD_IDS.d1);
assert.equal(prod.d1_databases[0].database_name, PROD_IDS.d1Name); assert.equal(prod.r2_buckets[0].bucket_name, PROD_IDS.r2);
assert.equal(prod.assets.directory, './portal', 'In produzione i file pubblici sono solo quelli del portale.');
assert.deepEqual(prod.assets.run_worker_first, ['/api/*']);
assert.ok(!prod.vars.GAME_WEB, 'La produzione non serve il gioco.');
assert.equal(prod.vars.PUBLIC_BASE_URL, PROD, 'I collegamenti delle e-mail restano quelli già in uso: ora portano al portale.');
const walk = async (dir, base = dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry => entry.isDirectory() ? walk(join(dir, entry.name), base) : [join(dir, entry.name).slice(base.length + 1)]))).flat();
const portalFiles = (await walk(join(ROOT, 'portal'))).sort();
const GAME = /(^|\/)(main\.js|sw\.js|store\.js|app\.js|styles\.css|theme\.css|site\.webmanifest|database\.json)$|^src\/(core|ui|data\/real|data\/simulation|data\/i18n)\//;
assert.deepEqual(portalFiles.filter(name => GAME.test(name)), [], 'Il portale non contiene file del gioco.');
const worker = await import('../worker.js');
for (const name of portalFiles) assert.ok(worker.PORTAL_PATHS.test(`/${name}`), `Il portale serve ${name}.`);
lines.push(`produzione: risorse invariate, ${portalFiles.length} file pubblici (portale e pagine legali), nessun file del gioco`);

// ---------- 2. production Worker: the game does not come out, not even if the assets held it ----------
const served = [];
const env = { ASSETS: { fetch: async request => { served.push(new URL(request.url).pathname); return new Response('asset'); } }, ADMIN_ARCHIVE: { get: async () => null } };
const ask = (path, init = {}, e = env) => worker.default.fetch(new Request(`${PROD}${path}`, init), e);
for (const path of ['/src/main.js', '/src/core/store.js', '/sw.js', '/src/data/real/database.json', '/src/styles.css', '/site.webmanifest', '/icons/logo-politicando-640.webp', '/www/index.html', '/index.html/../src/main.js', '/src/ui/app.js']) {
  const response = await ask(path);
  assert.equal(response.status, 404, `${path}: non è raggiungibile dal browser in produzione.`);
}
assert.deepEqual(served, [], 'Per le richieste non API non si leggono i file del gioco.');
for (const path of ['/', '/index.html', '/portal.js', '/privacy.html', '/termini.html', '/elimina-account.html', '/src/data/repositories/account-sync.js']) assert.equal((await ask(path)).status, 200, `${path}: pagina del portale servita.`);
// the API stays (the app uses it): the Android origins are accepted, a web origin of the game (GitHub Pages) is not
const origin = async value => (await ask('/api/account/status', { method: 'OPTIONS', headers: { origin: value, 'access-control-request-method': 'GET' } })).headers.get('access-control-allow-origin');
assert.equal(await origin('https://localhost'), 'https://localhost', 'L’app Android (https://localhost) è accettata.');
assert.equal(await origin('capacitor://localhost'), 'capacitor://localhost');
assert.equal(await origin(PROD), PROD);
assert.notEqual(await origin('https://bianchimatteo-ship-it.github.io'), 'https://bianchimatteo-ship-it.github.io', 'GitHub Pages non è più un’origine del servizio.');
const apiAnswer = await ask('/api/account/status');
assert.notEqual(apiAnswer.status, 404, 'Le API dell’app rispondono.');
lines.push('Worker di produzione: 404 per il gioco, portale e API servite, origini Android accettate');

// ---------- 3. the Android app: bundled game, production Worker ----------
const cap = JSON.parse(await read('capacitor.config.json'));
assert.equal(cap.webDir, 'www'); assert.equal(cap.appId, 'it.matteobianchi.politicando2026');
const sync = await import('../src/data/repositories/account-sync.js?pub=1');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = new URL('https://localhost/'); globalThis.Capacitor = { isNativePlatform: () => true };
assert.equal(sync.accountApiBase(), PROD, 'L’app Android parla con il Worker di produzione.');
globalThis.location = new URL('capacitor://localhost/');
assert.equal(sync.accountApiBase(), PROD);
globalThis.Capacitor = undefined; globalThis.location = new URL('https://localhost/');
assert.equal(sync.accountApiBase(), null, 'Un browser su localhost non raggiunge la produzione.');
lines.push('app Android: bundle www, backend di produzione');

// ---------- 4. the portal is what the sources give; the e-mail links lead to it ----------
const built = spawnSync(process.execPath, [join(ROOT, 'scripts/build-portal.mjs'), '--check'], { encoding: 'utf8' });
assert.equal(built.status, 0, built.stderr || 'portale non aggiornato');
const portalJs = await read('portal/portal.js'), portalHtml = await read('portal/index.html');
assert.ok(portalJs.includes("'verifica-email'") && portalJs.includes("'reimposta-password'") && /checkResetToken|resetPassword|verifyEmail/.test(portalJs), 'Il portale gestisce i collegamenti già inviati.');
assert.ok(/Content-Security-Policy/.test(portalHtml) && !/<script(?![^>]*src=)/.test(portalHtml), 'Nessuno script in linea nel portale.');
const workerSource = await read('worker.js');
assert.ok(workerSource.includes('/?verifica-email=${token}') && workerSource.includes('/?reimposta-password=${token}'), 'I messaggi esistenti hanno ancora lo stesso formato di collegamento.');
assert.ok(/\bintent:\/\/[^']*package=it\.matteobianchi\.politicando2026/.test(portalJs), 'Il portale offre l’apertura dell’app Android.');
// the same link, the same token: the check of the token is the one of the Worker (a token that is not valid is refused, a valid one is not guessed)
const bad = await ask('/api/account/email/verify', { method: 'POST', body: JSON.stringify({ token: 'x' }), headers: { 'content-type': 'application/json' } }, { ...env, ACCOUNTS: null });
assert.ok([400, 503].includes(bad.status) || bad.status < 500, 'Il token non valido è rifiutato dal servizio.');
lines.push('portale: aggiornato rispetto ai sorgenti, stessi collegamenti e token, nessun gioco');

// ---------- 5. the private test site: protected by Access (manual), isolated, no production e-mail ----------
const testSource = await read('wrangler.test.jsonc');
const test = await jsonc('wrangler.test.jsonc');
assert.notEqual(test.name, prod.name);
assert.equal(test.vars.GAME_WEB, '1'); assert.equal(test.assets.directory, '.');
assert.ok(!test.vars.EMAIL_GATEWAY_URL, 'Il sito di prova non invia e-mail dal gateway di produzione.');
assert.ok(!test.triggers, 'Il sito di prova non esegue la pulizia programmata.');
const kv = test.kv_namespaces[0].id, d1 = test.d1_databases[0], r2 = test.r2_buckets[0].bucket_name;
for (const [label, value] of [['KV', kv], ['D1', d1.database_id], ['nome D1', d1.database_name], ['R2', r2]]) assert.ok(value && !Object.values(PROD_IDS).includes(value), `${label} del sito di prova diverso dalla produzione.`);
assert.ok(/^REPLACE_/.test(kv) && /^REPLACE_/.test(d1.database_id), 'Gli id di prova sono segnaposto: un deploy dimenticato fallisce invece di toccare la produzione.');
for (const token of [PROD_IDS.kv, PROD_IDS.d1, 'AKfycb', PROD, 'workers.dev', PROD_IDS.d1Name + '"', '"politicando-logos"']) assert.ok(!testSource.includes(token), `Il file di prova non nomina risorse o indirizzi di produzione (${token}).`);
assert.ok(!/EMAIL_GATEWAY_SECRET|TRANSLATE_API_KEY|ADMIN_SETUP_CODE|sk-[A-Za-z0-9]{20}/.test(testSource), 'Nessun segreto.');
const gameEnv = { ...env, GAME_WEB: '1' };
assert.equal((await ask('/src/main.js', {}, gameEnv)).status, 200, 'Il sito di prova serve il gioco completo.');
const ignore = await read('.assetsignore');
assert.ok(/wrangler\.test\.jsonc/.test(ignore), 'La configurazione di prova non è pubblicata come file.');
lines.push('sito di prova: gioco completo, risorse e nomi diversi dalla produzione, segnaposto non distribuibili, nessuna e-mail di produzione, nessun segreto');

// ---------- 6. the repository carries no secret and the e-mail gateway is still Apps Script (no Resend) ----------
assert.ok(!/resend\.com|RESEND_API|api\.resend/i.test(workerSource.replace(/\/\/.*$/gm, '')), 'Nessun ritorno a Resend.');
assert.ok(prod.vars.EMAIL_GATEWAY_URL.startsWith('https://script.google.com/'), 'Il gateway e-mail resta Google Apps Script.');
console.log(`Pubblicazione verificata: ${lines.join(' · ')}.`);
