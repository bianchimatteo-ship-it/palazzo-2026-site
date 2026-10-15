// Stamps one cache-busting version on index.html and on every relative JS import,
// so a deploy never mixes fresh and stale modules. Usage: npm run version:build [-- 20260925-1]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { writeDataVersion } from './lib/data-version.mjs';
import { moduleGraph } from './lib/module-graph.mjs';

const root = new URL('../', import.meta.url);
const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const index = await readFile(new URL('index.html', root), 'utf8');
const current = index.match(/main\.js\?v=([^"']+)/)?.[1] ?? '';
// Versions only move forward, so a new build can never collide with one already cached.
const [currentDay = '', currentCount = '0'] = current.split('-');
const version = process.argv[2] || (currentDay >= today ? `${currentDay}-${Number(currentCount) + 1}` : `${today}-1`);
if (!/^\d{8}-\d+$/.test(version)) throw new Error(`Versione non valida: ${version} (formato AAAAMMGG-N).`);
const specifier = /(from\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+?\.js)(\?v=[^'"]*)?\2/g;

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) { if (entry.name !== 'real') yield* files(path); }
    else if (entry.name.endsWith('.js')) yield path;
  }
}
let changed = 0;
for await (const file of files(new URL('src/', root))) {
  const source = await readFile(file, 'utf8');
  const next = source.replace(specifier, (_, prefix, quote, path) => `${prefix}${quote}${path}?v=${version}${quote}`);
  if (next !== source) { await writeFile(file, next); changed++; }
}
let html = index.replace(/(\.(?:js|css))\?v=[^"']+/g, `$1?v=${version}`);
// The browser would find the modules one import at a time, a round trip per level: the whole static graph is announced up front so that it is fetched in parallel (the stamped files, as they are imported).
const graph = await moduleGraph();
const preload = graph.list.filter(item => item.path !== 'src/main.js').map(item => `    <link rel="modulepreload" href="./${item.path}?v=${version}" />`).join('\n');
const block = `    <!-- modulepreload:start (generato da npm run version:build) -->\n${preload}\n    <!-- modulepreload:end -->`;
html = /    <!-- modulepreload:start[\s\S]*?<!-- modulepreload:end -->/.test(html) ? html.replace(/    <!-- modulepreload:start[\s\S]*?<!-- modulepreload:end -->/, () => block) : html.replace('  </head>', () => `${block}\n  </head>`);
await writeFile(new URL('index.html', root), html);
console.log(`Versione ${version} applicata a index.html e a ${changed} moduli (${graph.list.length} moduli annunciati con modulepreload).`);
// The real data carry their own stamp, tied to their content: it moves only when the data do.
const data = await writeDataVersion();
console.log(`Dati reali: versione ${data.version}${data.changed ? ' (aggiornata)' : ''}.`);
