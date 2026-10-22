// The check of the published site (scripts/check-published-site.mjs), tried against the local Worker (isolated stand-ins, no network, no real account or archive):
//   - the project as it is passes (index, modules, styles, data, fonts, public pages, icons, admin and account routes, unpublished files, features of the Worker);
//   - a site that serves an older file than the local one is caught (naming the file); a missing essential asset is caught; a Worker without account deletion is caught;
//   - the commit rule: a clean tree is reported with its commit, `--expect-commit` with another commit fails, uncommitted publishable files fail without `--allow-dirty`.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalWorker } from './lib/local-worker.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Asynchronous on purpose: the local Worker lives in this process, a blocking child would keep it from answering.
const check = (url, ...flags) => new Promise(resolve => {
  const child = spawn(process.execPath, [join(ROOT, 'scripts/check-published-site.mjs'), url, ...flags], { cwd: ROOT });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('close', status => resolve({ status, stdout, stderr }));
});
const scratch = await mkdtemp(join(tmpdir(), 'politicando-pub-'));
const copy = async () => {
  const root = join(scratch, `site-${Math.random().toString(36).slice(2, 8)}`);
  for (const name of ['index.html', 'sw.js', 'favicon.ico', 'favicon.svg', 'site.webmanifest', 'privacy.html', 'termini.html', 'elimina-account.html', 'privacy-en.html', 'terms-en.html', 'delete-account-en.html', '.assetsignore', 'icons', 'src', 'package.json', 'worker.js', 'wrangler.jsonc', 'capacitor.config.json', 'migrations', 'docs', 'scripts']) await cp(join(ROOT, name), join(root, name), { recursive: true }).catch(() => {});
  return root;
};
try {
  // ---------- 1. the project as it is ----------
  let local = await startLocalWorker({ port: 8791 });
  let result = await check(`${local.origin}/`, '--allow-dirty');
  assert.equal(result.status, 0, `Il progetto pubblicato in locale passa.\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Sito pubblicato verificato/);
  assert.match(result.stdout, /Commit locale [0-9a-f]{12}/);
  // ---------- 2. the commit rules ----------
  result = await check(`${local.origin}/`, '--allow-dirty', '--expect-commit', 'deadbeef0000');
  assert.equal(result.status, 1, 'Un commit atteso diverso fa fallire la verifica.');
  assert.match(result.stderr, /atteso deadbeef0000/);
  const dirty = spawnSync('git', ['status', '--porcelain', '--', 'index.html', 'src', 'sw.js', 'worker.js', 'privacy.html'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  result = await check(`${local.origin}/`);
  if (dirty) { assert.equal(result.status, 1, 'Con file pubblicabili non committati la verifica fallisce.'); assert.match(result.stderr, /non committate/); }
  else assert.equal(result.status, 0, 'Albero pulito: la verifica passa senza --allow-dirty.');
  await local.close();

  // ---------- 3. a site that is not the local project ----------
  const stale = await copy();
  await writeFile(join(stale, 'src/ui/menu.js'), (await readFile(join(stale, 'src/ui/menu.js'), 'utf8')) + '\n// versione vecchia\n');
  local = await startLocalWorker({ port: 8791, root: stale });
  result = await check(`${local.origin}/`, '--allow-dirty');
  assert.equal(result.status, 1, 'Un file pubblicato diverso dal locale fa fallire la verifica.');
  assert.match(result.stderr, /src\/ui\/menu\.js live diverso dal file locale/, 'Il file diverso è nominato.');
  await local.close();

  const missing = await copy();
  await rm(join(missing, 'src/fonts/dm-sans-latin-400-normal.woff2'));
  await rm(join(missing, 'elimina-account.html'));
  local = await startLocalWorker({ port: 8791, root: missing });
  result = await check(`${local.origin}/`, '--allow-dirty');
  assert.equal(result.status, 1, 'Un asset essenziale mancante fa fallire la verifica.');
  assert.match(result.stderr, /dm-sans-latin-400-normal\.woff2 non disponibile/);
  assert.match(result.stderr, /elimina-account\.html non disponibile/);
  await local.close();

  // an old Worker (no account deletion) behind the same files: its status route has no feature
  local = await startLocalWorker({ port: 8791 });
  const realFetch = local.worker.fetch;
  local.worker.fetch = async (request, env) => {
    const response = await realFetch(request, env);
    if (new URL(request.url).pathname === '/api/account/status') return new Response(JSON.stringify({ ok: true, service: 'accounts' }), { headers: { 'content-type': 'application/json' } });
    return response;
  };
  result = await check(`${local.origin}/`, '--allow-dirty');
  assert.equal(result.status, 1, 'Un Worker senza cancellazione dell’account viene scoperto.');
  assert.match(result.stderr, /non offre la cancellazione dell’account/);
  await local.close();
  console.log('Verifica del sito pubblicato provata sul Worker locale: passa sul progetto, scopre un file vecchio (con il nome), un asset mancante e un Worker senza cancellazione dell’account, e lega la verifica a un commit (--expect-commit, albero pulito). La verifica contro workers.dev richiede rete e non è stata eseguita qui.');
} finally { await rm(scratch, { recursive: true, force: true }); }
