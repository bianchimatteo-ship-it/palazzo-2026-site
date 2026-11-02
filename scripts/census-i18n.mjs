// Census of the Italian text literals of the source (src/ui, src/core, src/data/simulation and the interface helpers): every string literal that reads as Italian wording is run through the REAL translator in
// English and must come out translated (or be an allowlisted name/term). The tour of check-i18n proves what the screens show; this proves what the code can show, including the screens a tour cannot reach.
//   node scripts/census-i18n.mjs            prints the count and the first uncovered strings; exit 1 when some are left (CENSUS_STRICT=0 to only report)
//   CENSUS_OUT=file.json                    writes the list of the uncovered strings (templates with {} for ${…}, # for numbers)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
mem.set('politicando.settings.v1', JSON.stringify({ language: 'en' }));
const root = fileURLToPath(new URL('..', import.meta.url));
const version = readFileSync(join(root, 'index.html'), 'utf8').match(/main\.js\?v=([^"']+)/)?.[1];
const I = await import(`../src/core/i18n.js?v=${version}`);
await I.loadBook();
const { ALLOWED_ITALIAN } = await import('./lib/i18n-allowlist.mjs');

const dirs = ['src', 'src/ui', 'src/core', 'src/data', 'src/data/simulation', 'src/data/repositories'];
const files = dirs.flatMap(dir => readdirSync(join(root, dir)).filter(name => name.endsWith('.js')).map(name => join(dir, name)));
const ITALIAN = /[àèéìòù]|(?:^|[^\p{L}])(?:il|lo|la|le|gli|i|di|del|dello|della|dei|delle|degli|un|una|uno|per|con|che|non|è|sei|sono|hai|ha|ho|in|da|al|alla|alle|ai|nel|nella|nei|nelle|sul|sulla|tra|fra|più|come|dopo|prima|quando|se|ma|anche|ogni|tuo|tua|tuoi|tue|questo|questa|questi|queste|puoi|può|serve|servono|nessun|nessuna|tutti|tutte|molto|poco|già|ancora|solo|oltre|senza|sotto|sopra)(?=$|[^\p{L}])/iu;
const CODE = /^(?:https?:|\/|\.|#|data-|aria-|--|[a-z]+[-_][a-z-_]+$|[A-Z_]+$)|[{};=<>]{2}|=>|function|\bconst\b|\breturn\b/;
// A small lexer (comments, strings, template literals with nested ${…}, regular expressions) so that only real string literals are read, never a stretch of code between two quotes.
function literalsOf(code) {
  const out = [];
  let i = 0, previous = '';
  const skipRegex = () => { i++; let inClass = false; while (i < code.length) { const ch = code[i]; if (ch === '\\') i += 2; else if (ch === '[') { inClass = true; i++; } else if (ch === ']') { inClass = false; i++; } else if (ch === '/' && !inClass) { i++; break; } else i++; } while (/[a-z]/.test(code[i] ?? '')) i++; };
  function template() { // at the opening backtick; returns the text with ${…} as {}
    let text = ''; i++;
    while (i < code.length && code[i] !== '`') {
      if (code[i] === '\\') { text += code[i + 1] === 'n' ? ' ' : code[i + 1]; i += 2; }
      else if (code[i] === '$' && code[i + 1] === '{') { i += 2; let depth = 1; const start = i; while (i < code.length && depth) { const ch = code[i]; if (ch === '{') depth++; else if (ch === '}') depth--; else if (ch === "'" || ch === '"') { const q = ch; i++; while (i < code.length && code[i] !== q) { if (code[i] === '\\') i++; i++; } } else if (ch === '`') { template(); continue; } i++; } literalsIn(code.slice(start, i - 1)); text += '{}'; }
      else { text += code[i]; i++; }
    }
    i++; out.push(text); return text;
  }
  function literalsIn(fragment) { for (const item of literalsOf(fragment)) out.push(item); }
  while (i < code.length) {
    const ch = code[i];
    if (ch === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; }
    else if (ch === '/' && code[i + 1] === '*') { i = code.indexOf('*/', i + 2); i = i < 0 ? code.length : i + 2; }
    else if (ch === '/' && /[(,=:[!&|?{};]|^$/.test(previous)) skipRegex();
    else if (ch === "'" || ch === '"') { let text = ''; i++; while (i < code.length && code[i] !== ch && code[i] !== '\n') { if (code[i] === '\\') { text += code[i + 1] === 'n' ? ' ' : code[i + 1]; i += 2; } else { text += code[i]; i++; } } i++; out.push(text); previous = 'x'; }
    else if (ch === '`') { template(); previous = 'x'; }
    else { if (!/\s/.test(ch)) previous = ch; i++; }
  }
  return out;
}
const strings = new Map();
for (const file of files) {
  for (const whole of literalsOf(readFileSync(join(root, file), 'utf8'))) {
    // a template with markup is several texts (one for each element): they are read one by one, as the page shows them
    for (const raw of whole.replace(/<[^>]+>/g, '|').replace(/&[a-z]+;|&#\d+;/g, ' ').split('|')) {
      const text = raw.replace(/\s+/g, ' ').trim();
      if (text.length < 8 || CODE.test(text) || (text.match(/[\p{L}]+/gu) ?? []).length < 2 || !ITALIAN.test(text)) continue;
      if (!/\p{Ll}{3}/u.test(text.replace(/\{\}/g, ''))) continue;
      if (/="|^[">]|["<]$|\bclass=|\bdata-[a-z-]+=/.test(text)) continue;
      if (/\.json$|throw new|\) \{|\bconst \w+ =/.test(text)) continue; // a file name or a stretch of code
      if (file === 'src/core/invariants.js' || file === 'src/core/i18n-auto.js') continue; // developer diagnostics (never rendered) and the status text of the translator (not shown in any screen)
      const key = text.replace(/\{\w+\}/g, '{}').replace(/\d[\d.,]*/g, '#');
      if (!strings.has(key)) strings.set(key, { text: key, files: new Set() });
      strings.get(key).files.add(file);
    }
  }
}
const allowed = text => ALLOWED_ITALIAN.some(item => item.pattern.test(text));
const uncovered = [];
for (const { text, files: from } of strings.values()) {
  // a `{}` stands for any value: try it as a name and as a number, as the screens would show it
  const samples = text.includes('{}') ? [text.replace(/\{\}/g, 'Siena'), text.replace(/\{\}/g, '12')] : [text];
  const done = samples.every(sample => { const out = I.translateText(sample.replace(/#/g, '7')); return out !== sample.replace(/#/g, '7') || allowed(sample); });
  if (!done) uncovered.push({ text, files: [...from] });
}
console.log(`Censimento: ${strings.size} testi italiani nel codice (${files.length} file), ${uncovered.length} senza traduzione inglese.`);
if (process.env.CENSUS_OUT) writeFileSync(process.env.CENSUS_OUT, JSON.stringify(uncovered, null, 1));
for (const item of uncovered.slice(0, Number(process.env.CENSUS_SHOW ?? 25))) console.log(`  ${item.files[0]}: ${item.text.slice(0, 140)}`);
process.exit(uncovered.length && process.env.CENSUS_STRICT !== '0' ? 1 : 0);
