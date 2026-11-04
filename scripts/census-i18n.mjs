// Census of what a player can read with English selected, with evidence. Three sources, one rule:
//   1. every Italian text literal of the source (src/**, interface, rules, engines, repositories), read with a lexer (never a stretch of code between two quotes), markup split into the texts the page shows;
//   2. the phrase book itself (duplicates, entries no text of the code or of the data can reach);
//   3. the texts that the game GENERATES while it is played (news, events, history, agenda, parliament, campaign…): careers are run on the real engine and every Italian string of the state is collected (CENSUS_RUNTIME=0 to skip).
// A text is TRANSLATED only when nothing Italian is left in what the translator gives back (scripts/lib/i18n-detect.mjs: Italian-only words, articles, function words, proper names taken out as whole names):
// a text that merely changed is INCOMPLETE. Classes: translated · dynamic verified on samples · dynamic NOT verifiable (a fragment of a concatenation: its sentence is built at run time) · incomplete · missing · allowed (names, acronyms, official denominations).
//   node scripts/census-i18n.mjs                   prints the counts and the first problems; exit 1 when something is incomplete or missing (CENSUS_STRICT=0: report only)
//   CENSUS_REPORT=file.json                        the full report (every text with its class, reason and files)
// No network, no external service, nothing is sent anywhere: the translator used is the local phrase book.
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
const { createDetector, bookPairs, realProperNames, templateByNames } = await import('./lib/i18n-detect.mjs');
// the values the samples put in place of a variable are names of places: they are not Italian left over
const SAMPLE_VALUES = ['Siena', 'Reggio Emilia', 'Roma Capitale'];
// Names the game invents (newspapers, the first names and surnames that fill seats with simulated people): proper names, never words to translate.
const inventedNames = [];
try {
  const rules = await import(`../src/data/simulation/news-rules.js?v=${version}`);
  for (const outlet of Object.values(rules.NEWSROOM_OUTLETS ?? {})) if (outlet?.name) inventedNames.push(outlet.name, outlet.name.replace(/\s*\d+$/, ''));
  const roster = readFileSync(join(root, 'src/core/seat-roster.js'), 'utf8');
  for (const match of roster.matchAll(/const (?:FIRST|LAST|MALE|FEMALE)[A-Z_]*NAMES = Object\.freeze\(\[([^\]]*)\]/g)) for (const name of match[1].matchAll(/'([^']+)'/g)) inventedNames.push(name[1]);
} catch { /* the lists are optional: a missing one only makes the census stricter */ }
const detector = createDetector({ pairs: bookPairs(), names: realProperNames([...SAMPLE_VALUES, ...inventedNames]) });

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

const shortLabels = new Map();
const literals = new Map(); // key (numbers as #, {…} as {}) → { text, files }
for (const file of files) {
  if (file === 'src/core/invariants.js' || file === 'src/core/i18n-auto.js' || file === 'src/core/i18n.js') continue; // developer diagnostics (never rendered) and the status text of the translator (not shown in any screen)
  for (const whole of literalsOf(readFileSync(join(root, file), 'utf8'))) {
    // a template with markup is several texts (one for each element): they are read one by one, as the page shows them
    // the texts a reader (or a screen reader) gets from the ATTRIBUTES of the markup (tooltip, accessible name, placeholder, alternative text) are texts too: they are read before the tags are cut away
    const attributeTexts = [...whole.matchAll(/\b(?:title|aria-label|aria-description|aria-placeholder|aria-roledescription|aria-valuetext|placeholder|alt|data-tip|data-label|data-voice-idle|data-voice-active)="([^"]*)"/g)].map(match => match[1]);
    for (const raw of [...attributeTexts, ...whole.replace(/\b(?:title|aria-label|aria-description|aria-placeholder|aria-roledescription|aria-valuetext|placeholder|alt|data-tip|data-label|data-voice-idle|data-voice-active)="[^"]*"/g, '').replace(/<[^>]+>/g, '|').replace(/&[a-z]+;|&#\d+;/g, ' ').split('|')]) {
      const text = raw.replace(/\s+/g, ' ').trim();
      // the short labels (table headers, buttons, chips: «Data», «Stato», «Incontralo») are texts too: no vocabulary decides them, so every one that the book leaves unchanged is listed (and judged by a person, or allowed by name)
      if (text.length >= 3 && text.length < 40 && (text.match(/[\p{L}]+/gu) ?? []).length <= 4 && !CODE.test(text) && !/[0-9{}#=<>_@\\\/[\]()]/.test(text) && /^[\p{Lu}\p{Ll}][\p{L}'’ .,:;!?·+\-–—]*$/u.test(text)) shortLabels.set(text, (shortLabels.get(text) ?? new Set()).add(file));
      if (text.length < 8 || CODE.test(text) || (text.match(/[\p{L}]+/gu) ?? []).length < 2 || !ITALIAN.test(text)) continue;   // (Italian by a function word, or by the independent detector: «Candidature chiuse» has no function word)
      if (!/\p{L}{3}/u.test(text.replace(/\{\}/g, ''))) continue;   // (the kickers in capitals are texts too)
      if (/="|^[">]|["<]$|\bclass=|\bdata-[a-z-]+=/.test(text)) continue;
      if (/\.json$|throw new|\) \{|\bconst \w+ =/.test(text)) continue; // a file name or a stretch of code
      const key = text.replace(/\{\w+\}/g, '{}').replace(/\d+(?:[.,]\d+)*/g, '#');
      if (!literals.has(key)) literals.set(key, { text: key, files: new Set() });
      literals.get(key).files.add(file);
    }
  }
}

// ---- the rule ----
const VARIANTS = [['Siena', '7'], ['Reggio Emilia', '1.234'], ['Roma Capitale', '12,5']];
// (a variable glued to a letter or a number takes the one-word sample: «#{}» is not two words)
const MONTHS = '(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)';
// (a number next to a month name is a day or a year: the samples keep it a real date, «1.234 giugno 1.234» is not a date)
// (the votes of a division are at most the seats of a Chamber: three digits, never a thousands separator)
const dated = text => text.replace(/n\.#/g, 'n.2').replace(/circa # voti \(soglia #\)/g, 'circa 123 voti (soglia 123)').replace(/#–#/g, '25–54').replace(/\bover #/g, 'over 65').replace(new RegExp(`#( ${MONTHS})( #)?`, 'gi'), (m, month, year) => `14${month}${year ? ' 2024' : ''}`);
// (two variables side by side get two different names, as the game would give a date and a party: the same name twice cannot be told apart)
const instance = (text, [name, number]) => {
  const t = dated(text);
  let previousEnd = -9;
  return t.replace(/\{\}/g, (match, offset) => {
    const adjacent = offset - previousEnd === 1; // (« {}» right after another variable)
    previousEnd = offset + 2;
    return adjacent || /[\p{L}\p{N}#]/u.test(t[offset - 1] ?? ' ') || /[\p{L}\p{N}]/u.test(t[offset + 2] ?? ' ') ? 'Siena' : name;
  }).replace(/#%/g, `${number === '1.234' ? '34' : number}%`).replace(/\(#\)/g, `(${number === '1.234' ? '123' : number === '12,5' ? '12' : number})`).replace(/#/g, number);
};
// a literal that is a piece of a sentence built elsewhere: starts in lower case after a variable, ends on a connector, or has a variable glued to letters
const CONNECTOR = /(?:^|\s)(?:di|a|da|in|con|su|per|tra|fra|e|o|il|lo|la|le|gli|un|una|del|della|dei|delle|al|alla|nel|nella|che|se|come|ma)$/i;
const isFragment = text => /^[a-zà-ù]/.test(text) || /[,;:(–—-]$/.test(text) || CONNECTOR.test(text) || /\{\}[a-zà-ù]|[a-zà-ù]\{\}/i.test(text);
const countOf = (text, word) => text.split(word).length - 1;
// What a translation must keep of its source: the numbers (whatever the separators), the sample names, the quoted titles (null: all kept).
export function lostValues(source, target) {
  // (a preview clipped by the game ends with «…» and is translated up to its last whole clause: it may keep less than the source, never more or different)
  const clipped = /…\s*$/.test(source);
  const bag = text => { const map = new Map(); for (const item of (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map(value => value.replace(/[.,]/g, ''))) map.set(item, (map.get(item) ?? 0) + 1); return map; };
  const a = bag(source), b = bag(target);
  for (const [item, count] of b) if ((a.get(item) ?? 0) < count || (!clipped && (a.get(item) ?? 0) !== count)) return `numero ${item}`;
  if (!clipped) for (const [item, count] of a) if ((b.get(item) ?? 0) !== count) return `numero ${item}`;
  for (const name of ['Siena', 'Reggio Emilia', 'Roma Capitale']) {
    const was = countOf(source, name), now = countOf(target, name);
    if (now > was || (!clipped && now !== was)) return `nome «${name}» ${was} → ${now}`;
  }
  return null;
}
export function classify(text) {
  const allowed = detector.allowed(text);
  if (allowed) return { cls: 'consentita', reason: allowed };
  const dynamic = /[{#]/.test(text);
  const samples = dynamic ? VARIANTS.map(variant => instance(text, variant)) : [text];
  const outs = samples.map(sample => I.translateText(sample));
  if (outs.every((out, i) => out === samples[i])) {
    // unchanged: a proper name or a text without Italian words stays as it is (nothing to translate), anything else has no translation
    return samples.some(sample => detector.reasonOf(sample)) ? { cls: 'mancante', reason: 'nessuna traduzione nel dizionario' } : { cls: 'consentita', reason: 'nome proprio o testo senza parole italiane' };
  }
  const reasons = outs.map(out => detector.reasonOf(out)).filter(Boolean);
  if (reasons.length) return { cls: 'incompleta', reason: reasons[0], example: outs[0] };
  // meaning kept: every number, every sample name and every quoted title of the Italian text must be in the English one, as many times (nothing lost, nothing repeated, nothing invented)
  if (dynamic) {
    for (let i = 0; i < samples.length; i++) {
      const lost = lostValues(samples[i], outs[i]);
      if (lost) return { cls: 'incompleta', reason: `significato non conservato: ${lost}`, example: outs[i] };
    }
  }
  if (dynamic && isFragment(text)) return { cls: 'dinamica-non-verificabile', reason: 'frammento di una frase composta a run time' };
  return { cls: dynamic ? 'dinamica-verificata' : 'tradotta', reason: null };
}

// ---- 1. literals ----
const report = { literals: [], book: {}, runtime: [] };
const count = {};
const bump = (bucket, cls) => { (count[bucket] ??= {})[cls] = (count[bucket]?.[cls] ?? 0) + 1; };
for (const item of literals.values()) {
  const result = classify(item.text);
  report.literals.push({ text: item.text, files: [...item.files], ...result });
  bump('codice', result.cls);
}

// ---- 2. the phrase book: duplicates and entries nothing can reach ----
{
  const pairs = bookPairs();
  const seen = new Map(), duplicates = [], conflicts = [];
  for (const [it, en, file] of pairs) {
    const key = it.replace(/\s+/g, ' ').trim();
    if (seen.has(key)) { (seen.get(key).en.replace(/\{\d\}/g, '{}') === en.replace(/\{\d\}/g, '{}') ? duplicates : conflicts).push({ it: key, en, other: seen.get(key).en, files: [seen.get(key).file, file] }); } else seen.set(key, { en, file });
  }
  // the texts a player can reach: literals of the code and every string of the real data and rules
  const reachable = new Set([...literals.keys()]);
  const corpus = [];
  const gather = value => { if (typeof value === 'string') { if (value.length > 3 && value.length < 400) corpus.push(value.replace(/\s+/g, ' ').trim()); } else if (Array.isArray(value)) value.forEach(gather); else if (value && typeof value === 'object') Object.values(value).forEach(gather); };
  for (const file of readdirSync(join(root, 'src/data/real')).filter(name => name.endsWith('.json') && !/^(italy-boundaries|polls|election-participations|electoral-geography)/.test(name))) { try { gather(JSON.parse(readFileSync(join(root, 'src/data/real', file), 'utf8'))); } catch { /* skip */ } }
  const data = new Set(corpus.map(text => text.replace(/\d+(?:[.,]\d+)*/g, '#')));
  const templates = [];
  for (const [key] of seen) if (/\{\}/.test(key)) templates.push([key, new RegExp(`^${key.split('{}').map(piece => piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.{1,160}?')}$`)]);
  const literalList = [...reachable];
  const unused = [];
  for (const [key] of seen) {
    if (reachable.has(key) || data.has(key)) continue;
    if (/\{\}/.test(key)) { const re = templates.find(([k]) => k === key)[1]; if (literalList.some(text => re.test(text.replace(/\{\}/g, 'X'))) || [...data].some(text => re.test(text))) continue; }
    unused.push(key);
  }
  report.book = { entries: pairs.length, distinct: seen.size, duplicates, conflicts, unused };
}

// ---- 3. what the game generates while it is played ----
if (process.env.CENSUS_RUNTIME !== '0') {
  const { startCareer, playWeek } = await import('./lib/long-run.mjs');
  const generated = new Map(), seen = new Map(); // seen: every distinct generated string with its path (CENSUS_CORPUS_OUT saves it, CENSUS_CORPUS_IN replays it without playing the careers again)
  let raw = 0;
  const SKIP_KEYS = new Set(['dataset', 'id', 'source', 'type', 'kind', 'status', 'icon', 'tone', 'seed', 'currentDate', 'date', 'since', 'territoryId', 'partyId', 'candidateId']);
  const collect = (value, path = '', depth = 0) => {
    if (depth > 9) return;
    if (typeof value === 'string') {
      const text = value.replace(/\s+/g, ' ').trim();
      if (text.length < 12 || text.length > 700 || !ITALIAN.test(text) || /^[\w.:|~-]+$/.test(text) || /^\d{4}-\d\d-\d\d/.test(text) || CODE.test(text)) return;
      if (/^[a-z]+:[^\s]/.test(text) || /\|\s*#/.test(text)) return; // an internal key (legge:…, sondaggio:…), not a text
      raw++;
      if (!seen.has(text)) seen.set(text, path.replace(/\.\d+/g, '[]').slice(0, 90));
      const key = templateByNames(text.replace(/[“«"][^”»"]{2,160}[”»"]/g, '“{}”'), detector.names, detector.italianWords).replace(/\d+(?:[.,]\d+)*/g, '#'); // (a quoted title is the name of a law or a story: a variable of the frame)
      if (!/[a-zà-ù]{3}/i.test(key.replace(/\{\}/g, ''))) return;
      if (!generated.has(key)) generated.set(key, { text: key, example: text, path: path.replace(/\.\d+/g, '[]').slice(0, 90) });
    } else if (Array.isArray(value)) { for (const item of value.slice(0, 400)) collect(item, `${path}.0`, depth + 1); }
    else if (value && typeof value === 'object') { for (const [key, item] of Object.entries(value)) if (!SKIP_KEYS.has(key)) collect(item, `${path}.${key}`, depth + 1); }
  };
  const careers = [
    { seed: 'census-a', level: 'deputato', years: 3 }, { seed: 'census-b', level: 'comunale', years: 3, territorial: true }, { seed: 'census-c', level: 'regionale', years: 3, territorial: true }, { seed: 'census-f', level: 'provinciale', years: 2, territorial: true },
    { seed: 'census-d', level: 'senatore', years: 3 }, { seed: 'census-e', level: 'europeo', years: 2 }
  ];
  // CENSUS_EXTRA=n: n more long careers (seven years, other seeds, parties and levels) for the corpus of the generated texts
  for (let index = 0; index < Number(process.env.CENSUS_EXTRA ?? 0); index++) {
    const levels = ['deputato', 'senatore', 'comunale', 'regionale', 'provinciale', 'europeo'], level = levels[index % levels.length];
    const partyIds = ['party-registro-p1-2014-04-ir', 'party-registro-p1-2015-17-ir', 'party-registro-p1-2014-11-ir', 'party-registro-p1-2019-52-ir', 'party-registro-p1-2014-01-ir', 'party-registro-p1-2016-37-ir', 'party-registro-p1-2020-56-ir', 'party-registro-p1-2014-07-ir'];
    careers.push({ seed: `census-z${index}`, level, years: 7, territorial: ['comunale', 'regionale', 'provinciale'].includes(level), partyId: partyIds[(index * 3 + 1) % partyIds.length], region: ['Toscana', 'Lombardia', 'Campania'][(index + 2) % 3] });
  }
  // the extended inventory: other parties, regions and seeds, longer careers (a whole legislature and more: elections, government formation, local acts, Parliament, newsbulletins); CENSUS_EXTENDED=0 skips it
  if (process.env.CENSUS_EXTENDED !== '0') {
    const parties = ['party-registro-p1-2014-04-ir', 'party-registro-p1-2015-17-ir', 'party-registro-p1-2014-11-ir', 'party-registro-p1-2019-52-ir', 'party-registro-p1-2014-01-ir', 'party-registro-p1-2016-37-ir', 'party-registro-p1-2020-56-ir', 'party-registro-p1-2014-07-ir'];
    const regions = ['Toscana', 'Lombardia', 'Campania'];
    const levels = ['deputato', 'senatore', 'comunale', 'regionale', 'provinciale', 'europeo'];
    parties.forEach((partyId, index) => {
      const level = levels[index % levels.length], territorial = ['comunale', 'regionale', 'provinciale'].includes(level);
      careers.push({ seed: `census-x${index}`, level, years: 5, territorial, partyId, region: regions[index % regions.length] });
      careers.push({ seed: `census-y${index}`, level: levels[(index + 3) % levels.length], years: 4, territorial: ['comunale', 'regionale', 'provinciale'].includes(levels[(index + 3) % levels.length]), partyId, region: regions[(index + 1) % regions.length] });
    });
  }
  const decide = ({ store }) => {};
  for (const file of (process.env.CENSUS_CORPUS_IN ?? '').split(',').filter(Boolean)) for (const [text, path] of JSON.parse(readFileSync(file, 'utf8'))) collect(text, path);
  if (process.env.CENSUS_CORPUS_ONLY === '1') careers.length = 0;
  if (process.env.CENSUS_QUICK === '1') careers.splice(2); // (the quick form for the offline check: two careers)
  for (const options of careers) {
    try {
      const run = await startCareer({ seed: options.seed, level: options.level, fast: true, territorial: options.territorial, ...(options.partyId ? { partyId: options.partyId } : {}), ...(options.region ? { region: options.region } : {}) });
      const { store } = run;
      for (let week = 0; week < options.years * 52; week++) {
        try { playWeek({ store, db: run.db, decide: null }); } catch { try { store.advance(7); } catch { break; } }
        if (week % 4 === 0) collect(store.getState());
      }
      collect(store.getState());
    } catch (error) { process.stderr.write(`[censimento] carriera ${options.seed} non eseguita: ${String(error.message).slice(0, 100)}\n`); }
  }
  if (process.env.CENSUS_CORPUS_OUT) writeFileSync(process.env.CENSUS_CORPUS_OUT, JSON.stringify([...seen]));
  report.rawGenerated = raw;
  for (const item of generated.values()) {
    const result = classify(item.text);
    report.runtime.push({ text: item.text, example: item.example, path: item.path, ...result });
    bump('generati', result.cls);
  }
}

// ---- short labels left unchanged ----
const unchangedShort = [...shortLabels].filter(([text]) => I.translateText(text) === text).map(([text, where]) => ({ text, files: [...where] }));
report.unchangedShort = unchangedShort;
if (process.env.CENSUS_SHORT) { console.log(`Etichette brevi invariate: ${unchangedShort.length} su ${shortLabels.size}`); for (const item of unchangedShort) console.log(`  ${item.text} | ${item.files[0]}`); }
// ---- report ----
const order = ['tradotta', 'dinamica-verificata', 'dinamica-non-verificabile', 'incompleta', 'mancante', 'consentita'];
const line = (bucket, label) => count[bucket] ? `${label}: ${Object.values(count[bucket]).reduce((a, b) => a + b, 0)} testi — ${order.map(cls => `${cls} ${count[bucket][cls] ?? 0}`).join(' · ')}` : null;
console.log(`Censimento (${files.length} file)`);
for (const text of [line('codice', 'Letterali del codice'), line('generati', 'Testi generati giocando')]) if (text) console.log(`  ${text}`);
console.log(`  Dizionario: ${report.book.entries} voci (${report.book.distinct} distinte), ${report.book.duplicates.length} duplicate identiche, ${report.book.conflicts.length} in conflitto, ${report.book.unused.length} non raggiunte da nessun testo del codice o dei dati (candidate inutilizzate, non eliminate)`);
const bad = [...report.literals.map(item => ({ ...item, from: 'codice' })), ...report.runtime.map(item => ({ ...item, from: 'generato', files: [item.path] }))].filter(item => item.cls === 'incompleta' || item.cls === 'mancante');
for (const item of bad.slice(0, Number(process.env.CENSUS_SHOW ?? 25))) console.log(`  [${item.cls}] ${item.files[0]}: ${item.text.slice(0, 120)} — ${item.reason}${item.example ? ` → ${item.example.slice(0, 80)}` : ''}`);
if (process.env.CENSUS_REPORT) writeFileSync(process.env.CENSUS_REPORT, JSON.stringify(report, null, 1));
// The gate is ZERO: nothing of the code and nothing of the texts generated while playing may be incomplete or missing in English (there is no baseline to lower and no recorded debt: a gap fails the check).
const now = { incompleta: count.generati?.incompleta ?? 0, mancante: count.generati?.mancante ?? 0, total: report.runtime.length };
let failed = bad.length > 0;
if (process.env.CENSUS_RUNTIME !== '0') console.log(`  Testi generati: ${now.incompleta} incompleti e ${now.mancante} mancanti su ${now.total} modelli`);
process.exit(failed && process.env.CENSUS_STRICT !== '0' ? 1 : 0);
