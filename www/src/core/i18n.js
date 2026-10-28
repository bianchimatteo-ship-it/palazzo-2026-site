// Localisation: Italian (the default) and English. One module, three jobs.
//  1. The preference (`language` in the player's settings, kept apart from every career save) and `<html lang>`, applied when the module loads, before the first render.
//  2. `t(key, italian, params)`: strings with a stable key (dictionary in src/data/i18n/keys.js), with the Italian text as fallback, for text the interface builds itself.
//  3. `translateText(italian)` and `translateTree(root)`: the interface is written in Italian in its components, so what is shown in English is translated once, here, from
//     the phrase book (src/data/i18n/en-*.js): exact phrases, phrases with numbers (`#`) or free parts (`{}`), and the numbers, currency and dates in English form.
//     Proper names (people, parties, places, official denominations) are never in the phrase book: they stay as they are. A phrase that is not in the book stays Italian, never wrong.
// Nothing here touches a career: the language is a view of the same data.
import { saveSetting } from './settings.js?v=20261028-1';

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

const norm = text => String(text).replace(/\s+/g, ' ').trim();
const NUMBER = /\d[\d.]*(?:,\d+)?/g;
// numbers are abstracted (`#`) so one phrase covers every value: «Settimana #» → «Week #»
function abstractNumbers(text) {
  const values = [];
  const key = text.replace(NUMBER, match => { values.push(match); return '#'; });
  return { key, values };
}
function compileTemplate(it, en) {
  const parts = it.split(/(\{\})/).map(piece => piece === '{}' ? null : piece);
  // a free part is a short stretch of text (a name, a label), so a long text never goes through a costly match
  const source = parts.map(piece => piece === null ? '(.{1,120}?)' : piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/#/g, '(\\d[\\d.]*(?:,\\d+)?)')).join('');
  const literals = parts.filter(piece => piece !== null).flatMap(piece => piece.split('#')).filter(piece => piece.length > 1);
  // the text before the first free part or number: templates are looked up by it (and the most specific one, the one with most fixed text, is tried first)
  const lead = (parts[0] ?? '').split('#')[0];
  // the longest fixed piece is the cheapest test that rules a template out (most texts fail it at once)
  const longest = literals.reduce((best, piece) => piece.length > best.length ? piece : best, '');
  return { re: new RegExp(`^${source}$`), en, literals, longest, lead, weight: literals.reduce((sum, piece) => sum + piece.length, 0) };
}
export function installBook(pairs, keys = {}) {
  book = book ?? { exact: new Map(), lower: new Map(), templates: [], keys: {}, index: null };
  book.index = null;
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
    if (hit !== undefined) { let i = 0; return hit.replace(/#/g, () => values[i++] ?? '#'); }
  }
  if (key.length > 360) return null;
  for (const template of candidates(key)) {
    if (template.longest && !key.includes(template.longest)) continue;
    let missing = false;
    for (const piece of template.literals) if (!key.includes(piece)) { missing = true; break; }
    if (missing) continue;
    const match = key.match(template.re);
    if (!match) continue;
    // the free parts are translated too when they are phrases of the book (roles, labels); names stay as they are.
    // `{}` and `#` take the free parts and the numbers in order; `{2}` names one by its position (when the English puts them in another order).
    const parts = match.slice(1);
    let next = 0;
    return template.en.replace(/\{(\d)\}|\{\}|#/g, (token, position) => { const value = (position ? parts[Number(position) - 1] : parts[next++]) ?? ''; return token === '#' ? value : (depth < 3 ? keepSpaces(value, translatePiece(value, depth + 1)) : value); });
  }
  return null;
}
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
  const base = shouting && value.includes(' ') ? value[0] + value.slice(1).toLowerCase() : value;
  return key[0] === key[0].toLowerCase() && key[0] !== key[0].toUpperCase() ? base[0].toLowerCase() + base.slice(1) : base;
}
// The cuts a text goes through when it is not a phrase of the book as a whole, from the coarsest to the finest: «a · b», «first sentence. second sentence», «a; b», «label: value».
// Each part is translated as a whole first (it can be a phrase of the book, or cut again); the text is given back changed only if at least one part was known.
const CUTS = [/( · | — | – )/, /((?<=[.!?…])\s+)/, /(; )/, /(: )/];
function translatePiece(text, depth = 0, level = 0) {
  if (level === 0) { const found = lookup(text, depth); if (found !== null) return found; }
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
    if (changed) return done.join('');
  }
  // a known label followed by a signed figure («Reputazione sul territorio +8», «Capitale politico ogni settimana −1»): the label is translated, the figure stays
  const signed = text.match(/^(.*\S) ([+−±]\d[\d.,]*%?)$/u);
  if (signed) { const head = lookup(signed[1], depth); if (head !== null) return `${head} ${signed[2]}`; }
  // a list of known labels («sicurezza, natalità e demografia, giustizia»): translated only when EVERY item is a phrase of the book, so that a sentence with commas is never half translated
  if (level === 0 && depth < 2 && text.includes(', ')) {
    const items = text.split(', ');
    const found = items.map(item => lookup(item, depth + 1));
    if (items.length >= 2 && found.every(item => item !== null)) return found.join(', ');
  }
  return text;
}
// The translation of one Italian text (a node, an attribute); the original is returned when nothing is known.
const OFFICIAL_ACT = /\b(decreto|decreto-legge|legislativo|ratifica ed esecuzione|disposizioni (?:per|in materia)|conversione in legge|delega al governo|istituzione del|modifiche (?:al|alla|agli))\b/i;
export function translateText(text) {
  if (language !== 'en' || !book || typeof text !== 'string' || !text.trim()) return text;
  const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
  const core = text.trim();
  let out = cache.get(core);
  if (out === undefined) {
    const translated = translatePiece(core);
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
let observer = null;
// Keeps a container translated while the interface redraws it: every inserted node is translated as it arrives.
export function watchTree(root) {
  observer?.disconnect();
  observer = null;
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
}

// ---- the language itself ----
let loading = null;
export function loadBook() {
  if (book?.loaded) return Promise.resolve(book);
  loading ??= import('../data/i18n/index.js?v=20261028-1').then(module => { module.install(installBook); book.loaded = true; return book; });
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
  return language;
}
