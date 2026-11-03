// Adds reviewed translations to the English phrase book (see i18n-extract.mjs). Usage: node scripts/i18n-complete.mjs pairs.json
// A pair is [italian, english]: `#` stands for a number and `{}` for a free part on both sides (the English may name the free parts by position, {1}…{n}). A pair is refused when the placeholders do not match,
// when the Italian is already in the book with another translation (the book would contradict itself) and is skipped when it is already there with the same one.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizePair, partsOf } from './lib/i18n-pair.mjs';

const dir = fileURLToPath(new URL('../src/data/i18n/', import.meta.url));
const target = `${dir}en-ui-8.js`;
const pairs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const existing = new Map();
for (const file of readdirSync(dir).filter(name => /^en-ui-\d+\.js$/.test(name))) {
  const text = readFileSync(`${dir}${file}`, 'utf8');
  for (const match of text.matchAll(/^\s*\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\]/gm)) existing.set(match[1], match[2]);
}
const escape = text => text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const added = [], skipped = [], refused = [];
for (const [it, enRaw] of pairs) {
  const key = escape(it);
  // (free parts and numbers together: positions only, see lib/i18n-pair.mjs)
  const en = typeof enRaw === 'string' ? normalizePair(it, enRaw) : enRaw;
  const free = it.split('{}').length - 1, plain = en.split('{}').length - 1, named = [...en.matchAll(/\{(\d)\}/g)].map(item => Number(item[1]));
  if (typeof it !== 'string' || typeof en !== 'string' || !it.trim() || !en.trim()) { refused.push([it, 'vuota']); continue; }
  if (!(free > 0 && partsOf(it) > free && named.length > 0) && it.split('#').length !== en.split('#').length) { refused.push([it, 'numeri (#) diversi']); continue; }
  const total = partsOf(it), mixed = free > 0 && total > free && named.length > 0;
  // a pair with free parts and numbers names every part by position: each free part must be named (none lost) and no position may be beyond the parts of the Italian text
  const freeAt = [...it.matchAll(/\{\}|#/g)].map((match, index) => match[0] === '{}' ? index + 1 : null).filter(Boolean);
  if (mixed ? (freeAt.some(position => !named.includes(position)) || named.some(position => position < 1 || position > total) || /\{\}|#/.test(en)) : (plain + named.length !== free || named.some(position => position < 1 || position > free))) { refused.push([it, 'parti libere ({}) diverse']); continue; }
  if (existing.has(key)) { (existing.get(key) === escape(en) ? skipped : refused).push([it, existing.get(key) === escape(en) ? 'già presente' : `già presente con un’altra traduzione: ${existing.get(key)}`]); continue; }
  existing.set(key, escape(en)); added.push([it, en]);
}
if (added.length) {
  const source = readFileSync(target, 'utf8');
  const end = source.lastIndexOf('];');
  writeFileSync(target, `${source.slice(0, end)}${added.map(([it, en]) => `  ["${escape(it)}", "${escape(en)}"],\n`).join('')}${source.slice(end)}`);
}
console.log(`Traduzioni: ${added.length} aggiunte, ${skipped.length} già presenti, ${refused.length} rifiutate.`);
for (const [it, reason] of refused) console.log(`  rifiutata: «${it}» — ${reason}`);
process.exit(refused.length ? 1 : 0);
