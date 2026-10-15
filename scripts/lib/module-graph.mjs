// The static import graph of the game, read from the source: which modules the first screen needs, how big they are (raw and compressed), how deep the import chain goes.
// Used by set-build-version (the <link rel="modulepreload"> list in index.html) and by check-load (the budget).
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const STATIC = /(?:^|\n)\s*(?:import|export)\s[^'"\n;]*?from\s*['"](\.{1,2}\/[^'"?]+)(?:\?[^'"]*)?['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"?]+)(?:\?[^'"]*)?['"]/g;
const DYNAMIC = /(?:^|[^\w$.])import\(\s*['"`](\.{1,2}\/[^'"`$?]+)/g;

export async function moduleGraph(entry = 'src/main.js') {
  const modules = new Map();
  const lazy = new Set();
  const visit = async (file, depth, chain) => {
    const known = modules.get(file);
    if (known) { if (depth > known.depth) { known.depth = depth; for (const child of known.children) await visit(child, depth + 1, [...chain, file]); } return; }
    const code = await readFile(file, 'utf8');
    const children = [];
    for (const match of code.matchAll(STATIC)) children.push(resolve(dirname(file), match[1] ?? match[2]));
    for (const match of code.matchAll(DYNAMIC)) lazy.add(resolve(dirname(file), match[1]));
    modules.set(file, { file, path: relative(ROOT, file), bytes: Buffer.byteLength(code), code, children, depth });
    for (const child of children) await visit(child, depth + 1, [...chain, file]);
  };
  await visit(resolve(ROOT, entry), 0, []);
  const list = [...modules.values()].sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
  const total = list.reduce((sum, item) => sum + item.bytes, 0);
  const compressed = brotliCompressSync(Buffer.from(list.map(item => item.code).join('\n')), { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
  return { list, total, compressed, depth: Math.max(...list.map(item => item.depth)), lazy: [...lazy].map(file => relative(ROOT, file)) };
}
