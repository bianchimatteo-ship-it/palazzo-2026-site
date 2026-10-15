// What the first screen costs, measured: the modules the game imports at start (count, raw and compressed bytes, depth of the import chain), kept inside a budget, and announced up front
// in index.html (<link rel="modulepreload">, written by `npm run version:build`) so that the browser fetches them in parallel instead of one import level at a time (the chain is 16 levels deep).
//   - the preload list is exactly the static graph of src/main.js, with the build stamp of main.js; the budget (module count, raw bytes, compressed bytes, depth) leaves room for growth but not
//     for a silent doubling; heavy data is not part of the code (the real collections are fetched on demand by real-data.js, never imported);
//   - in Chrome with a 4x slower CPU, the game as served and the same page without the announcements: the menu appears within a generous bound, no request fails, nothing more than the graph is
//     downloaded, and the requests of all the modules leave together (at least twice as fast as in the import-by-import chain); the numbers are printed. Skipped without Chrome (the static part always runs).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';
import { moduleGraph } from './lib/module-graph.mjs';

const BUDGET = { modules: 150, raw: 4_700_000, compressed: 1_150_000, depth: 18 };
const graph = await moduleGraph();
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const stamp = html.match(/main\.js\?v=([^"']+)/)?.[1];
assert.ok(stamp, 'index.html ha il timbro della versione.');

assert.ok(graph.list.length <= BUDGET.modules, `Moduli all’avvio: ${graph.list.length} (massimo ${BUDGET.modules}).`);
assert.ok(graph.total <= BUDGET.raw, `Codice all’avvio: ${graph.total} byte (massimo ${BUDGET.raw}).`);
assert.ok(graph.compressed <= BUDGET.compressed, `Codice compresso (brotli) all’avvio: ${graph.compressed} byte (massimo ${BUDGET.compressed}).`);
assert.ok(graph.depth <= BUDGET.depth, `Catena di import: ${graph.depth} livelli (massimo ${BUDGET.depth}).`);
assert.ok(graph.list.every(item => !/\.json['"`]/.test(item.code.replace(/\/\/.*$/gm, '')) || !/import\s[^;]*from\s*['"][^'"]+\.json/.test(item.code)), 'Nessun modulo importa un JSON: i dati reali si scaricano su richiesta.');

// the announced modules are the static graph, nothing more, nothing less, at the build stamp
const preloaded = [...html.matchAll(/<link rel="modulepreload" href="\.\/([^"?]+)\?v=([^"]+)"/g)].map(item => ({ path: item[1], stamp: item[2] }));
assert.ok(preloaded.every(item => item.stamp === stamp), 'Ogni modulo annunciato porta il timbro della versione.');
const expected = graph.list.filter(item => item.path !== 'src/main.js').map(item => item.path).sort();
assert.deepEqual(preloaded.map(item => item.path).sort(), expected, 'I moduli annunciati sono esattamente quelli del grafo statico (lancia npm run version:build se cambia).');
assert.equal(new Set(preloaded.map(item => item.path)).size, preloaded.length, 'Nessun doppione.');
assert.ok(html.indexOf('modulepreload:start') < html.indexOf('<script type="module"'), 'Gli annunci vengono prima dello script.');

let summary = '';
if (!chromeAvailable) console.log('Parte nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).');
else {
  // The game served as it is (`/index.html`) and the same page without the announcements (`/nopreload.html`, made on the fly): everything else is identical.
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
  const root = fileURLToPath(new URL('..', import.meta.url));
  const server = createServer(async (request, response) => {
    try {
      const asked = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = asked === '/' ? '/index.html' : asked;
      const body = path === '/nopreload.html' ? html.replace(/ *<link rel="modulepreload"[^>]*>\n/g, '') : await readFile(join(root, path));
      response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); response.end(body);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(8796, '127.0.0.1', resolve));
  try {
    const measure = page => withBrowser(async browser => {
      const { evaluate, send, waitFor, goto, errors, pause } = browser;
      await send('Network.enable');
      await send('Network.setCacheDisabled', { cacheDisabled: true });
      await send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await evaluate('localStorage.clear(), sessionStorage.clear(), true');
      const start = Date.now();
      await goto(page);
      await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu"))'), 60000);
      const menuMs = Date.now() - start;
      await pause(500);
      const stats = await evaluate(`(() => {
        const entries = performance.getEntriesByType('resource');
        const modules = entries.filter(item => /^\\/src\\/.*\\.js$/.test(new URL(item.name).pathname));
        const failed = entries.filter(item => item.responseStatus >= 400 && !new URL(item.name).pathname.startsWith('/api/')).map(item => item.name + ' ' + item.responseStatus);
        return { modules: modules.length, failed, requests: entries.length, transfer: entries.reduce((sum, item) => sum + (item.encodedBodySize || 0), 0),
          firstStart: Math.round(Math.min(...modules.map(item => item.startTime))), lastStart: Math.round(Math.max(...modules.map(item => item.startTime))), lastEnd: Math.round(Math.max(...modules.map(item => item.responseEnd))) };
      })()`);
      await send('Emulation.setCPUThrottlingRate', { rate: 1 });
      assert.deepEqual(errors, [], 'Nessun errore in pagina.');
      // (the account service probe answers 404 on the plain static server of the tests: the game then plays offline, as designed)
      assert.deepEqual(stats.failed, [], 'Nessuna richiesta fallita.');
      return { page, menuMs, ...stats, spread: stats.lastStart - stats.firstStart };
    }, { serverPort: 8796 });
    const withPreload = await measure('index.html');
    const without = await measure('nopreload.html');
    for (const result of [withPreload, without]) assert.ok(result.modules >= graph.list.length - 2 && result.modules <= graph.list.length + 2, `Moduli caricati da ${result.page}: ${result.modules} (grafo ${graph.list.length}): niente scaricato in più.`);
    assert.ok(withPreload.menuMs < 30000, `Il menu compare in ${withPreload.menuMs} ms (limite 30 s con la CPU 4 volte più lenta).`);
    // the point of the announcements: the requests of all the modules leave together instead of one import level after the other (the gap is what a network round trip multiplies by the levels)
    assert.ok(withPreload.spread * 2 <= without.spread, `Con modulepreload le richieste dei moduli partono entro ${withPreload.spread} ms, senza entro ${without.spread} ms: almeno la metà in meno.`);
    summary = ` In Chrome (CPU 4 volte più lenta): menu in ${withPreload.menuMs} ms con modulepreload e ${without.menuMs} ms senza; le ${withPreload.modules} richieste dei moduli partono tutte entro ${withPreload.spread} ms con l’annuncio, entro ${without.spread} ms senza (un livello di import dopo l’altro: a ogni livello si aggiunge un giro di rete); ${withPreload.requests} richieste, ${(withPreload.transfer / 1024).toFixed(0)} KiB non compressi dal server di prova, nessuna fallita.`;
  } finally { await new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }); }
}
console.log(`Caricamento verificato: ${graph.list.length} moduli all’avvio, ${(graph.total / 1024 / 1024).toFixed(2)} MiB di codice (${(graph.compressed / 1024).toFixed(0)} KiB compressi), catena di import di ${graph.depth + 1} livelli annunciata in blocco con modulepreload (${preloaded.length} link, timbro ${stamp}), dentro il budget (${BUDGET.modules} moduli, ${(BUDGET.raw / 1024 / 1024).toFixed(1)} MiB, ${(BUDGET.compressed / 1024).toFixed(0)} KiB compressi, ${BUDGET.depth + 1} livelli).${summary}`);
