// Localisation: Italian (the default) and English. One module, three jobs.
//  1. The preference (`language` in the player's settings, kept apart from every career save) and `<html lang>`, applied when the module loads, before the first render.
//  2. `t(key, italian, params)`: strings with a stable key (dictionary in src/data/i18n/keys.js), with the Italian text as fallback, for text the interface builds itself.
//  3. `translateText(italian)` and `translateTree(root)`: the interface is written in Italian in its components, so what is shown in English is translated once, here, from
//     the phrase book (src/data/i18n/en-*.js): exact phrases, phrases with numbers (`#`) or free parts (`{}`), and the numbers, currency and dates in English form.
//     Proper names (people, parties, places, official denominations) are never in the phrase book: they stay as they are. A phrase that is not in the book stays Italian, never wrong.
// Nothing here touches a career: the language is a view of the same data.
import { saveSetting } from './settings.js?v=20261113-1';

export const LANGUAGES = Object.freeze([['it', 'Italiano', 'it-IT'], ['en', 'English', 'en-GB']]);
const SETTINGS_KEY = 'politicando.settings.v1';
const KNOWN = new Set(LANGUAGES.map(([id]) => id));

function readStored() {
  try { const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')?.language; return KNOWN.has(value) ? value : 'it'; } catch { return 'it'; }
}
let language = readStored();
const listeners = new Set();
const apply = () => { try { document.documentElement.lang = language; } catch { /* no document (tests of the engine) */ } };
apply();

export const getLanguage = () => language;
export const isEnglish = () => language === 'en';
export const localeOf = () => LANGUAGES.find(([id]) => id === language)?.[2] ?? 'it-IT';
export const onLanguageChange = listener => { listeners.add(listener); return () => listeners.delete(listener); };

// ---- dictionaries (English is loaded only when it is used) ----
let book = null; // { exact: Map, templates: [{ re, parts, en }], keys: {} }
const MONTHS = { gennaio: 'January', febbraio: 'February', marzo: 'March', aprile: 'April', maggio: 'May', giugno: 'June', luglio: 'July', agosto: 'August', settembre: 'September', ottobre: 'October', novembre: 'November', dicembre: 'December' };
const SHORT_MONTHS = { gen: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', mag: 'May', giu: 'Jun', lug: 'Jul', ago: 'Aug', set: 'Sep', ott: 'Oct', nov: 'Nov', dic: 'Dec' };
const WEEKDAYS = { lunedì: 'Monday', martedì: 'Tuesday', mercoledì: 'Wednesday', giovedì: 'Thursday', venerdì: 'Friday', sabato: 'Saturday', domenica: 'Sunday' };

// (the curly and the straight apostrophe are the same letter: a phrase typed with one is found by the other)
const norm = text => String(text).replace(/\s+/g, ' ').replace(/[’‘]/g, "'").trim();
const NUMBER = /\d[\d.]*(?:,\d+)?/g;
// numbers are abstracted (`#`) so one phrase covers every value: «Settimana #» → «Week #»
function abstractNumbers(text) {
  const values = [];
  const key = text.replace(NUMBER, match => { values.push(match); return '#'; });
  return { key, values };
}
function compileTemplate(it, en) {
  const parts = it.split(/(\{\})/).map(piece => piece === '{}' ? null : piece);
  // a free part is a short stretch of text (a name, a label), so a long text never goes through a costly match (the list of the parties that support a government from outside is the one long free part: up to 400)
  // two free parts side by side («{}{}»: a title and what may follow it): the first takes all it can up to the fixed text, the second may be empty — never one letter and the rest
  const adjacent = parts.map((piece, i) => piece === null && ((parts[i + 1] === '' && parts[i + 2] === null) ? 'first' : (parts[i - 1] === '' && parts[i - 2] === null) ? 'second' : null));
  const source = parts.map((piece, i) => piece === null ? (adjacent[i] === 'first' ? '(.{1,120})' : adjacent[i] === 'second' ? '(.{0,120}?)' : it.includes(', senza ministri') ? '(.{1,400}?)' : '(.{1,120}?)') : piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/#/g, '(\\d[\\d.]*(?:,\\d+)?)')).join('');
  const literals = parts.filter(piece => piece !== null).flatMap(piece => piece.split('#')).filter(piece => piece.length > 1);
  // the text before the first free part or number: templates are looked up by it (and the most specific one, the one with most fixed text, is tried first)
  const lead = (parts[0] ?? '').split('#')[0];
  // the longest fixed piece is the cheapest test that rules a template out (most texts fail it at once)
  const longest = literals.reduce((best, piece) => piece.length > best.length ? piece : best, '');
  return { re: new RegExp(`^${source}$`), en, literals, longest, lead, weight: literals.reduce((sum, piece) => sum + piece.length, 0) };
}
export function installBook(pairs, keys = {}) {
  book = book ?? { exact: new Map(), lower: new Map(), templates: [], keys: {}, index: null, sources: [], lexicon: null };
  book.index = null; book.lexicon = null; book.sources.push(pairs);
  for (const [it, en] of pairs) {
    const key = norm(it);
    if (/\{\}/.test(key)) book.templates.push(compileTemplate(key, en));
    else { book.exact.set(key, en); if (!book.lower.has(key.toLowerCase())) book.lower.set(key.toLowerCase(), en); }
  }
  Object.assign(book.keys, keys);
}
export const bookSize = () => book ? book.exact.size + book.templates.length : 0;
export const hasBook = () => Boolean(book);

// 1.234,5 → 1,234.5 · 12,5 → 12.5 · 1.200 € → €1,200
function fixNumber(token) {
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(token)) { const [int, dec] = token.split(','); return int.replace(/\./g, ',') + (dec ? `.${dec}` : ''); }
  if (/^\d+,\d+$/.test(token)) return token.replace(',', '.');
  return token;
}
const BIG = '\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?';
function englishNumbers(text) {
  // one pass: an amount in euro takes the sign in front, any other number its separators (a number is never converted twice)
  return text.replace(new RegExp(`(${BIG}|\\d+,\\d+|\\d+)(\\s?€)?`, 'g'), (match, number, euro) => euro ? `€${fixNumber(number)}` : fixNumber(number));
}
function englishDates(text) {
  const months = Object.keys(MONTHS).join('|'), short = Object.keys(SHORT_MONTHS).join('|'), days = Object.keys(WEEKDAYS).join('|');
  const L = '(?<![\\p{L}])', R = '(?![\\p{L}])';
  return text
    .replace(new RegExp(`${L}(${days})${R}`, 'giu'), m => WEEKDAYS[m.toLowerCase()])
    .replace(new RegExp(`${L}(\\d{1,2})[º°]? (${months})${R}`, 'giu'), (m, d, month) => `${d} ${MONTHS[month.toLowerCase()]}`)
    .replace(new RegExp(`${L}(${months})(?= \\d{4}\\b)`, 'gu'), month => MONTHS[month])
    .replace(new RegExp(`${L}(\\d{1,2}) (${short})${R}`, 'gu'), (m, d, month) => `${d} ${SHORT_MONTHS[month]}`);
}

// The templates worth trying for a text: those that start with the same words (found by their first letters), then the ones that start with a free part; each group from the most specific
// (the most fixed text) to the least. Built once, the first time a template is needed.
function candidates(key) {
  if (!book.index) {
    const sorted = [...book.templates].sort((a, b) => b.weight - a.weight);
    const byLead = new Map(), open = [];
    for (const template of sorted) {
      if (template.lead.length >= 3) { const head = template.lead.slice(0, 3); if (!byLead.has(head)) byLead.set(head, []); byLead.get(head).push(template); } else open.push(template);
    }
    book.index = { byLead, open };
  }
  const near = (book.index.byLead.get(key.slice(0, 3)) ?? []).filter(template => key.startsWith(template.lead));
  return near.length ? near.concat(book.index.open) : book.index.open;
}
const cache = new Map();
function lookup(text, depth = 0) {
  const key = norm(text);
  if (!key) return null;
  const direct = book.exact.get(key);
  if (direct !== undefined) return direct;
  // the same phrase in another case («più irpef sui redditi alti» for «Più IRPEF sui redditi alti»): found by its lower-case form, given back in the case of the text
  const folded = book.lower.get(key.toLowerCase());
  if (folded !== undefined) return matchCase(key, folded);
  // the same phrase with its numbers abstracted
  const { key: abstract, values } = abstractNumbers(key);
  if (values.length) {
    const hit = book.exact.get(abstract) ?? book.lower.get(abstract.toLowerCase());
    if (hit !== undefined) { let i = 0; return matchCase(key, hit.replace(/#/g, () => values[i++] ?? '#')); }
    // (a number followed by the full stop of its sentence — «over 65. Restano» — keeps the stop outside the number: the first form swallows it, this one does not)
    if (/\d[.,]/.test(key)) {
      const precise = [];
      const keyPrecise = key.replace(/\d+(?:[.,]\d+)*/g, match => { precise.push(match); return '#'; });
      const again = keyPrecise !== abstract ? book.exact.get(keyPrecise) ?? book.lower.get(keyPrecise.toLowerCase()) : undefined;
      if (again !== undefined) { let i = 0; return matchCase(key, again.replace(/#/g, () => precise[i++] ?? '#')); }
    }
  }
  // the same phrase with another closing mark («Salva.» for «Salva», «Attenzione!» for «Attenzione»): found without it, given back with the mark of the text
  const tail = key.match(/^(.*[^\s.:;!?…])([.:;!?…]+)$/);
  if (tail && depth < 5) {
    const base = tail[1], { key: baseAbstract, values: baseValues } = abstractNumbers(base);
    const hit = book.exact.get(base) ?? book.lower.get(base.toLowerCase()) ?? (baseValues.length ? book.exact.get(baseAbstract) ?? book.lower.get(baseAbstract.toLowerCase()) : undefined);
    if (hit !== undefined) { let i = 0; const out = baseValues.length ? hit.replace(/#/g, () => baseValues[i++] ?? '#') : hit; return /[.:;!?…]$/.test(out) ? out : out + tail[2]; }
  }
  // a government that comes back for the third time («Governo Meloni ter»): the book writes «bis» once
  const again = key.match(/\b(ter|quater|quinquies)\b/);
  if (again && depth < 5) {
    const same = lookup(key.replace(again[1], 'bis'), depth + 1);
    if (same !== null && /\bbis\b/.test(same)) return same.replace(/\bbis\b/, again[1]);
  }
  // a legislature by its Roman numeral («XIX legislatura»): the phrases of the book are written once, with the numeral of the one they were written for, and give the same sentence for every other
  const numeral = key.match(/\b([IVXL]{1,6}) legislatura\b/);
  if (numeral && numeral[1] !== 'XX' && depth < 5) {
    const same = lookup(key.replace(`${numeral[1]} legislatura`, 'XX legislatura'), depth + 1);
    if (same !== null && /\bXX legislature\b/.test(same)) return same.replace(/\bXX legislature\b/g, `${numeral[1]} legislature`);
  }
  // (a long sentence of the book with a long name in it is still a template: the limit keeps out only what no phrase of the book can be)
  if (key.length > 900) return null;
  const compound = key.includes(' · ') || /[.!?…]\s+\S/.test(key);
  for (const template of candidates(key)) {
    if (template.longest && !key.includes(template.longest)) continue;
    // a template made only of free parts and punctuation («{}, {} · {}») says nothing by itself: on a compound text the cuts do the work, piece by piece
    if (compound) { if (template.pure === undefined) template.pure = !/[A-Za-zÀ-ÿ]/.test(template.en.replace(/\{\d?\}/g, '')); if (template.pure) continue; }
    let missing = false;
    for (const piece of template.literals) if (!key.includes(piece)) { missing = true; break; }
    if (missing) continue;
    const match = key.match(template.re);
    if (!match) continue;
    // the free parts are translated too when they are phrases of the book (roles, labels); names stay as they are.
    // `{}` and `#` take the free parts and the numbers in order; `{2}` names one by its position (when the English puts them in another order).
    const parts = match.slice(1);
    // a free part never swallows the pieces of a compound text («a · b», «first sentence. second sentence»): it would hide them from the cuts, and what the template does not name would stay in Italian. Such a text is cut first
    if (/\{\}|\{\d\}/.test(template.en) && template.en.indexOf(' · ') < 0 && parts.some(part => typeof part === 'string' && (part.includes(' · ') || (part.includes(' — ') && !template.en.includes(' — ')) || /[.!?…]\s+\S/.test(part)))) continue;
    // the template «Governo {}» is for the name of a government: a free part of five words or more is a sentence of its own, which the cuts and the other phrases translate
    if (template.literals.length === 1 && template.literals[0].trim() === 'Governo' && parts.some(part => typeof part === 'string' && part.trim().split(/\s+/).length >= 5)) continue;
    let next = 0;
    return fixNames(template.en.replace(/\{(\d)\}|\{\}|#/g, (token, position, offset, whole) => {
      const value = (position ? parts[Number(position) - 1] : parts[next++]) ?? '';
      if (token === '#') return value;
      const out = depth < 5 ? keepSpaces(value, translatePiece(value, depth + 1)) : value;
      // a translated free part that opens an English sentence takes the capital the Italian sentence had («Ne traggono vantaggio famiglie…» → «Households … benefit»)
      return out !== value && (offset === 0 || /[.!?…]\s$/.test(whole.slice(0, offset))) ? out.replace(/^(\s*)(\p{Ll})/u, (m, space, letter) => space + letter.toUpperCase()) : out;
    }));
  }
  return null;
}
// «Governo del Presidente» fills the «{} Government» of the templates as its own name: «del Presidente Government» is not English, «Government of the President» is.
const fixNames = text => text.replace(/\bdel Presidente Government\b/g, 'Government of the President');
// A free part keeps the spaces around it («groups{} ; …» with « (of which 1 from outside)»): the lookup trims the text it translates, the sentence needs them back.
function keepSpaces(original, translated) {
  if (!original.trim()) return original;
  return original.match(/^\s*/)[0] + translated.trim() + original.match(/\s*$/)[0];
}
// The case of the text is kept when the phrase is found by its lower-case form: «STIMA SIMULATA» stays in capitals, «stima simulata» starts in lower case, and a book entry written in capitals
// («STIMA SIMULATA» → «SIMULATED ESTIMATE») is not poured into a sentence-case text as «sIMULATED ESTIMATE».
function matchCase(key, value) {
  const letters = text => text.replace(/[^\p{L}]/gu, '');
  const keyLetters = letters(key), valueLetters = letters(value);
  if (keyLetters.length > 1 && keyLetters === keyLetters.toUpperCase()) return value.toUpperCase();
  const shouting = valueLetters.length > 3 && valueLetters === valueLetters.toUpperCase();
  const base = shouting ? value[0] + value.slice(1).toLowerCase() : value;
  return key[0] === key[0].toLowerCase() && key[0] !== key[0].toUpperCase() ? base[0].toLowerCase() + base.slice(1) : base;
}
// The cuts a text goes through when it is not a phrase of the book as a whole, from the coarsest to the finest: «a · b», «first sentence. second sentence», «a; b», «label: value».
// Each part is translated as a whole first (it can be a phrase of the book, or cut again); the text is given back changed only if at least one part was known.
function translateLabelList(text, depth) {
  if (text.length > 320 || !/(?:, | e )/.test(text)) return null;
  const parts = text.split(/(, | e )/);
  if (parts.length < 5) return null; // at least three pieces: with two, a text is either one label or a pair that the book knows as a whole
  const items = parts.filter((_, index) => index % 2 === 0), seps = parts.filter((_, index) => index % 2 === 1);
  const memo = new Map();
  const solve = from => {
    if (from === items.length) return [];
    if (memo.has(from)) return memo.get(from);
    let result = null;
    for (let to = items.length; to > from && result === null; to--) {
      const label = items.slice(from, to).map((item, k) => k ? seps[from + k - 1] + item : item).join('');
      if (to - from === items.length) continue; // the whole text is not a label (it was looked up already)
      const hit = lookup(label, depth + 1);
      if (hit === null) continue;
      const rest = solve(to);
      if (rest !== null) result = [hit, ...rest];
    }
    memo.set(from, result);
    return result;
  };
  const labels = solve(0);
  if (labels === null || labels.length < 2) return null;
  return labels.length === 2 ? `${labels[0]} and ${labels[1]}` : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}
// (the full stop of an abbreviation — «art. 1», «n. 5», «Es.» — does not end a sentence)
const CUTS = [/( · | — | – )/, /((?<=[.!?…])(?<!\b(?:art|artt|n|nn|es|ecc|sett|lett|cfr|pag|dott|prof|sig|dl|dpr|c|co|cc)\.)\s+)/, /(; )/, /(: )/];
// A text clipped by the game for a preview (a deck, a headline: «…, finanziato in deficit. Ne traggono vantaggio pensionati e over 65 e redditi bassi…») ends with an ellipsis and stops where the cut fell, which no phrase of
// the book can predict. It is translated up to the last clause that is a whole phrase («a, b» → «a», «a; b» → «a»…) and keeps its ellipsis: a shorter preview in English, never a half-Italian one.
function translateClipped(text, depth) {
  const core = text.replace(/…\s*$/, '').trim();
  if (!core || depth > 2) return null;
  const whole = translatePiece(core, depth + 1);
  if (whole !== core && residualItalian(whole) === null) return `${whole}…`;
  const cuts = [...core.matchAll(/(?:[,;:–—]|\s·)\s|\s(?=\()/g)].map(match => match.index).reverse();
  for (const at of cuts) {
    const head = core.slice(0, at).trim();
    if (head.length < 12) continue;
    const done = translatePiece(head, depth + 1);
    if (done !== head && residualItalian(done) === null) return `${done}…`;
  }
  return null;
}
function translatePiece(text, depth = 0, level = 0) {
  // a list item that starts with its bullet («· giovani 18–34»): the bullet stays, the rest is translated
  if (level === 0) { const bullet = text.match(/^([·•]\s+)([\s\S]+)$/); if (bullet) { const rest = translatePiece(bullet[2], depth); if (rest !== bullet[2]) return bullet[1] + rest; } }
  if (level === 0) { const found = lookup(text, depth); if (found !== null) return found; }
  if (level === 0 && text.endsWith('…') && text.length > 14) { const clipped = translateClipped(text, depth); if (clipped !== null) return clipped; }
  // a title in quotes («Riforma dei servizi per l’infanzia»): the quotes stay, the title inside is translated
  { const quoted = text.match(/^([«“])([^«»“”]{3,200})([»”])$/); if (quoted) { const inner = translatePiece(quoted[2], depth + 1); if (inner !== quoted[2]) return quoted[1] + inner + quoted[3]; } }
  let first = null;
  for (let cut = level; cut < CUTS.length; cut++) {
    let parts = text.split(CUTS[cut]);
    if (parts.length < 2) continue;
    // «label: value: more» is cut at the first colon only, so that what follows can still be a phrase of the book as a whole (or be cut again at the next colon)
    if (CUTS[cut].source === '(: )' && parts.length > 3) parts = [parts[0], parts[1], parts.slice(2).join('')];
    let changed = false;
    const done = parts.map((part, index) => {
      if (index % 2 || !part.trim()) return part;
      const hit = lookup(part, depth);
      const next = hit !== null ? hit : translatePiece(part, depth, CUTS[cut].source === '(: )' && index > 0 ? cut : cut + 1);
      if (next !== part) changed = true;
      return next;
    });
    if (changed) {
      // The coarsest cut that changes something is taken – unless it leaves Italian behind and a finer cut (the sentences of a text that also holds a dash: «Dossier fallito — ministero X: …. Le circostanze…»)
      // translates all of it: then that one is taken.
      const joined = done.join('');
      // (a date still written in Italian — «29 aprile 2029» — is turned into English at the end of translateText: it is not Italian left behind)
      if (residualItalian(englishDates(joined)) === null) return joined;
      first ??= joined;
      if (cut === CUTS.length - 1) return first;
    }
  }
  if (first !== null) return first;
  // a known label followed by a signed figure («Reputazione sul territorio +8», «Capitale politico ogni settimana −1»): the label is translated, the figure stays
  const signed = text.match(/^(.*\S) ([+−±-]\d[\d.,]*%?)$/u);
  if (signed) { const head = lookup(signed[1], depth); if (head !== null) return `${head} ${signed[2]}`; }
  // a list of known labels joined by «, » and « e » when some labels hold an « e » themselves («pensionati e over 65 e famiglie e lavoratori 35–54»): cut at the separators and put together again with the
  // longest labels the book knows; translated only when EVERY label is known
  if (level === 0 && depth < 3) { const listed = translateLabelList(text, depth); if (listed !== null) return listed; }
  // a list of known labels («sicurezza, natalità e demografia, giustizia»): translated only when EVERY item is a phrase of the book, so that a sentence with commas is never half translated
  if (depth < 2 && text.includes(', ')) {
    const items = text.split(', ');
    // (an item that is a name — no Italian word in it — stays as it is: «Lega, Nuova forza civica (simulata n.2), Azione» is a list of parties, one of which the book knows)
    const known = items.map(item => lookup(item, depth + 1));
    const found = known.map((hit, index) => hit !== null ? hit : (items[index].trim() && residualItalian(items[index]) === null ? items[index] : null));
    if (items.length >= 2 && found.every(item => item !== null) && known.some(hit => hit !== null)) return found.join(', ');
  }
  return text;
}
// The automatic translator (src/core/i18n-auto.js): installed by the page, absent in the tests of the engine.
let auto = null;
let watched = null;
export function setAutoTranslator(translator) { auto = translator; cache.clear(); }
export const autoStatus = () => auto?.status?.() ?? { configured: null, reason: 'Traduzione automatica non attiva.', needs: [] };
// New translations arrived: the screen is translated again from the Italian sources it remembers.
export function retranslate() { cache.clear(); const body = watched?.ownerDocument?.body ?? null; if (body) translateTree(body); else if (watched) translateTree(watched); }
// ---- what is still Italian in a text that was (partly) translated ----
// The Italian-only words are those of the Italian side of the phrase book that never appear in an English side (or in the stable keys): found in a translated text they say that part of it is still Italian,
// whatever else changed. A capitalised word in the middle of a text is a name and is never read (only lower-case words and the first word of the text are).
const LOANWORDS = new Set(['dossier', 'welfare', 'budget', 'leader', 'leadership', 'governo', 'summit', 'premier']);
const SMALL_ITALIAN = new Set(['il', 'lo', 'gli', 'del', 'della', 'dei', 'delle', 'nel', 'nella', 'nei', 'nelle', 'sul', 'sulla', 'sui', 'alla', 'alle', 'dal', 'dalla', 'dalle', 'degli', 'agli', 'è', 'una', 'uno']);
function italianOnlyWords() {
  if (book.lexicon) return book.lexicon;
  const words = text => text.toLowerCase().replace(/#|\{\d?\}/g, ' ').match(/[a-zà-ù]{3,}/g) ?? [];
  const italian = new Set(), english = new Set();
  for (const pairs of book.sources) for (const [it, en] of pairs) { for (const word of words(it)) italian.add(word); for (const word of words(en)) english.add(word); }
  for (const text of Object.values(book.keys)) for (const word of words(String(text))) english.add(word);
  return book.lexicon = new Set([...italian].filter(word => !english.has(word) && !LOANWORDS.has(word)));
}
export function residualItalian(text) {
  if (!book || typeof text !== 'string') return null;
  const only = italianOnlyWords();
  let first = true;
  // (the first word of a text is read as the start of a sentence — unless it opens a run of capitalised words: «Roma Capitale Government» starts with a name)
  const opensName = /^\P{L}*\p{Lu}\p{Ll}*(?:[ '’-]+\p{Lu}\p{L}*)+/u.test(text);
  for (const match of text.matchAll(/[\p{L}]+/gu)) {
    const word = match[0], lower = word.toLowerCase();
    const reads = (first && !opensName) || word === lower;
    first = false;
    if (reads && (SMALL_ITALIAN.has(lower) || (lower.length >= 3 && only.has(lower)))) return lower;
  }
  return null;
}
// The translation of one Italian text (a node, an attribute); the original is returned when nothing is known.
const OFFICIAL_ACT = /\b(decreto|decreto-legge|legislativo|ratifica ed esecuzione|disposizioni (?:per|in materia)|conversione in legge|delega al governo|istituzione del|modifiche (?:al|alla|agli))\b/i;
export function translateText(text) {
  if (language !== 'en' || !book || typeof text !== 'string' || !text.trim()) return text;
  const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
  const core = text.trim();
  let out = cache.get(core);
  if (out === undefined) {
    let translated = translatePiece(core);
    // Not in the phrase book, or only in part («Programma: fino a quattro priorità» → «PROGRAMME: fino a quattro priorità»): the automatic translator (server provider, persistent cache) is asked for the
    // WHOLE text as an anonymous template; until it answers the text stays as it is (retranslate() clears this memory when answers arrive).
    if (auto && (translated === core || residualItalian(englishDates(englishNumbers(translated))) !== null)) {
      const known = auto.lookup(core);
      if (typeof known === 'string') translated = known; else auto.request(core);
    }
    // the title of an act of Parliament that is not in the phrase book is an official name: it stays whole in Italian (no English month or number inside it)
    out = translated === core && OFFICIAL_ACT.test(core) ? core : englishDates(englishNumbers(translated));
    if (cache.size > 20000) cache.clear();
    cache.set(core, out);
  }
  return lead + out + trail;
}
// stable keys: t('menu.language', 'Lingua') → the English text of the key when English is on and the key is in the dictionary, else the Italian text given here ({name} placeholders)
export function t(key, italian, params = {}) {
  const text = (language === 'en' ? book?.keys?.[key] : null) ?? italian ?? key;
  return String(text).replace(/\{(\w+)\}/g, (m, name) => params[name] ?? m);
}
export const formatNumber = (value, digits = 0) => Number(value).toLocaleString(localeOf(), { maximumFractionDigits: digits });
export const formatEuro = value => language === 'en' ? `€${Math.round(Number(value) || 0).toLocaleString('en-GB')}` : `${Math.round(Number(value) || 0).toLocaleString('it-IT')} €`;
export const formatDay = (date, options = { day: 'numeric', month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat(localeOf(), options).format(date instanceof Date ? date : new Date(date));

// ---- the DOM ----
// The attributes that carry words a person reads or hears (tooltips, accessible names, placeholders, image descriptions, the texts a control swaps in while it works).
const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'aria-valuetext', 'data-tip', 'data-label', 'data-voice-idle', 'data-voice-active'];
// Never translated, children included: code and the like. TEXTAREA (and any editable field) is different: what the PLAYER wrote in it is theirs and is never touched, but its own placeholder,
// title and accessible name are the interface's words and are translated (see translateNode).
const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE']);
const USER_TEXT = new Set(['TEXTAREA', 'INPUT', 'SELECT']);
const isUserText = node => USER_TEXT.has(node.tagName) || node.isContentEditable === true || node.getAttribute?.('contenteditable') === 'true' || node.getAttribute?.('contenteditable') === '';
const originals = new WeakMap();
const attributeOriginals = new WeakMap();
// An attribute is translated from its Italian source, remembered with what was shown: the translation is never applied to its own result (a number would flip back and forth).
function translateAttribute(node, name) {
  const value = node.getAttribute(name);
  if (!value) return;
  const memo = attributeOriginals.get(node)?.[name];
  const source = memo && memo.shown === value ? memo.source : value;
  const next = translateText(source);
  if (next === value) return;
  attributeOriginals.set(node, { ...(attributeOriginals.get(node) ?? {}), [name]: { source, shown: next } });
  node.setAttribute(name, next);
}
let working = false;

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || SKIP.has(parent.tagName) || parent.tagName === 'TEXTAREA' || parent.closest('[data-no-translate], textarea, [contenteditable=""], [contenteditable="true"]')) return;
    const source = originals.has(node) && originals.get(node).shown === node.nodeValue ? originals.get(node).source : node.nodeValue;
    const next = translateText(source);
    if (next !== node.nodeValue) { originals.set(node, { source, shown: next }); node.nodeValue = next; }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has(node.tagName) || node.hasAttribute?.('data-no-translate')) return;
  for (const name of ATTRIBUTES) translateAttribute(node, name);
  if (node.tagName === 'INPUT' && /^(button|submit|reset)$/.test(node.type)) { const next = translateText(node.value); if (next !== node.value) node.value = next; }
  // The words of the player (a textarea, an input, a field being edited) are not translated: only the attributes above, handled here, belong to the interface.
  if (isUserText(node) && node.tagName !== 'SELECT') return;
  for (const child of node.childNodes) translateNode(child);
}
export function translateTree(root) {
  if (language !== 'en' || !book || !root) return;
  working = true;
  try { translateNode(root); } finally { working = false; }
}
// Back to Italian: what was translated in place goes back to its source (the text and the attributes remembered above).
function restoreNode(node) {
  if (node.nodeType === Node.TEXT_NODE) { const memo = originals.get(node); if (memo && memo.shown === node.nodeValue) node.nodeValue = memo.source; return; }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const memo = attributeOriginals.get(node);
  if (memo) for (const [name, item] of Object.entries(memo)) if (node.getAttribute(name) === item.shown) node.setAttribute(name, item.source);
  for (const child of node.childNodes) restoreNode(child);
}
// A window the interface keeps OUTSIDE the container (the sitting of a vote, the Aula) follows the language at once, in both directions: translated when it turns English, restored when it turns Italian.
function refreshOutside() {
  const body = watched?.ownerDocument?.body ?? null;
  if (!body) return;
  working = true;
  try {
    for (const child of body.children) {
      if (child === watched || child.contains?.(watched) || SKIP.has(child.tagName)) continue;
      if (language === 'en' && book) translateNode(child); else restoreNode(child);
    }
  } finally { working = false; }
}
let observer = null, outsideObserver = null;
// Keeps a container translated while the interface redraws it: every inserted node is translated as it arrives.
export function watchTree(root) {
  observer?.disconnect(); outsideObserver?.disconnect();
  observer = null; outsideObserver = null; watched = root;
  if (language !== 'en' || !book || typeof MutationObserver === 'undefined') return;
  translateTree(root);
  observer = new MutationObserver(records => {
    if (working) return;
    working = true;
    try {
      for (const record of records) {
        if (record.type === 'characterData') translateNode(record.target);
        else if (record.type === 'attributes') translateAttribute(record.target, record.attributeName);
        else for (const node of record.addedNodes) translateNode(node);
      }
    } finally { working = false; }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  // What the interface puts OUTSIDE the container (the tooltip of a chart, a floating panel, anything appended to the body) and then writes into while the player moves around is translated the same way:
  // a second observer on the body that leaves alone what is inside the container (the first one has it).
  const body = root.ownerDocument?.body ?? null;
  if (body && body !== root && !root.contains?.(body)) {
    outsideObserver = new MutationObserver(records => {
      if (working) return;
      working = true;
      try {
        for (const record of records) {
          const target = record.target;
          if (target && root.contains?.(target)) continue;
          if (record.type === 'characterData') translateNode(target);
          else if (record.type === 'attributes') translateAttribute(target, record.attributeName);
          else for (const node of record.addedNodes) if (!root.contains?.(node)) translateNode(node);
        }
      } finally { working = false; }
    });
    outsideObserver.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
    translateTree(body.querySelector?.('.viz-tip') ?? null);
  }
}

// ---- the language itself ----
let loading = null;
export function loadBook() {
  if (book?.loaded) return Promise.resolve(book);
  loading ??= import('../data/i18n/index.js?v=20261113-1').then(module => { module.install(installBook); book.loaded = true; return book; });
  return loading;
}
// The title of the page (the tab) is read by people and by assistive technology: it follows the language like the rest (the Italian one is kept to go back to).
let titleSource = null;
function applyTitle() { try { if (typeof document === 'undefined') return; titleSource ??= document.title; document.title = language === 'en' && book ? translateText(titleSource) : titleSource; } catch { /* no document */ } }
// At start: English needs its book before the first render, so the module waits for it (top level await); Italian loads nothing.
if (language === 'en') await loadBook().catch(() => { language = 'it'; apply(); });
applyTitle();

export async function setLanguage(next, { scope = null } = {}) {
  if (!KNOWN.has(next) || next === language) return language;
  if (next === 'en') await loadBook();
  language = next;
  cache.clear();
  saveSetting('language', next, scope);
  apply();
  applyTitle();
  for (const listener of listeners) listener(language);
  refreshOutside();
  return language;
}
