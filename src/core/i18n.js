// Localisation: Italian (the default) and English. One module, three jobs.
//  1. The preference (`language` in the player's settings, kept apart from every career save) and `<html lang>`, applied when the module loads, before the first render.
//  2. `t(key, italian, params)`: strings with a stable key (dictionary in src/data/i18n/keys.js), with the Italian text as fallback, for text the interface builds itself.
//  3. `translateText(italian)` and `translateTree(root)`: the interface is written in Italian in its components, so what is shown in English is translated once, here, from
//     the phrase book (src/data/i18n/en-*.js): exact phrases, phrases with numbers (`#`) or free parts (`{}`), and the numbers, currency and dates in English form.
//     Proper names (people, parties, places, official denominations) are never in the phrase book: they stay as they are. A phrase that is not in the book stays Italian, never wrong.
// Nothing here touches a career: the language is a view of the same data.
import { saveSetting } from './settings.js?v=20261021-6';

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
  return { re: new RegExp(`^${source}$`), en, literals };
}
export function installBook(pairs, keys = {}) {
  book = book ?? { exact: new Map(), lower: new Map(), templates: [], keys: {} };
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

const cache = new Map();
function lookup(text, depth = 0) {
  const key = norm(text);
  if (!key) return null;
  const direct = book.exact.get(key);
  if (direct !== undefined) return direct;
  // the same phrase in another case («più irpef sui redditi alti» for «Più IRPEF sui redditi alti»): found by its lower-case form, given back in the case of the text
  const folded = book.lower.get(key.toLowerCase());
  if (folded !== undefined) return key[0] === key[0].toLowerCase() && key[0] !== key[0].toUpperCase() ? folded[0].toLowerCase() + folded.slice(1) : folded;
  // the same phrase with its numbers abstracted
  const { key: abstract, values } = abstractNumbers(key);
  if (values.length) {
    const hit = book.exact.get(abstract) ?? book.lower.get(abstract.toLowerCase());
    if (hit !== undefined) { let i = 0; return hit.replace(/#/g, () => values[i++] ?? '#'); }
  }
  if (key.length > 360) return null;
  for (const template of book.templates) {
    if (!template.literals.every(piece => key.includes(piece))) continue;
    const match = key.match(template.re);
    if (!match) continue;
    let i = 1;
    // the free parts are translated too when they are phrases of the book (roles, labels); names stay as they are
    return template.en.replace(/\{\}|#/g, token => { const value = match[i++] ?? ''; return token === '#' ? value : (depth < 2 ? translatePiece(value, depth + 1) : value); });
  }
  return null;
}
function translatePiece(text, depth = 0) {
  const found = lookup(text, depth);
  if (found !== null) return found;
  // «a · b · c» and «first sentence. second sentence»: translated piece by piece when at least one piece is known
  const pieces = text.split(/( · | — | – |: |; |(?<=[.!?…])\s+)/);
  if (pieces.length > 1) {
    let known = 0;
    const out = pieces.map((piece, index) => { if (index % 2) return piece; const hit = piece.trim() ? lookup(piece, depth) : null; if (hit !== null) { known++; return hit; } return piece; });
    if (known) return out.join('');
  }
  return text;
}
// The translation of one Italian text (a node, an attribute); the original is returned when nothing is known.
export function translateText(text) {
  if (language !== 'en' || !book || typeof text !== 'string' || !text.trim()) return text;
  const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
  const core = text.trim();
  let out = cache.get(core);
  if (out === undefined) {
    out = englishDates(englishNumbers(translatePiece(core)));
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
const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt', 'aria-description', 'data-tip', 'data-label'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
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
    if (!parent || SKIP.has(parent.tagName) || parent.closest('[data-no-translate]')) return;
    const source = originals.has(node) && originals.get(node).shown === node.nodeValue ? originals.get(node).source : node.nodeValue;
    const next = translateText(source);
    if (next !== node.nodeValue) { originals.set(node, { source, shown: next }); node.nodeValue = next; }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has(node.tagName) || node.hasAttribute?.('data-no-translate')) return;
  for (const name of ATTRIBUTES) translateAttribute(node, name);
  if (node.tagName === 'INPUT' && /^(button|submit)$/.test(node.type)) { const next = translateText(node.value); if (next !== node.value) node.value = next; }
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
  loading ??= import('../data/i18n/index.js?v=20261021-6').then(module => { module.install(installBook); book.loaded = true; return book; });
  return loading;
}
// At start: English needs its book before the first render, so the module waits for it (top level await); Italian loads nothing.
if (language === 'en') await loadBook().catch(() => { language = 'it'; apply(); });

export async function setLanguage(next, { scope = null } = {}) {
  if (!KNOWN.has(next) || next === language) return language;
  if (next === 'en') await loadBook();
  language = next;
  cache.clear();
  saveSetting('language', next, scope);
  apply();
  for (const listener of listeners) listener(language);
  return language;
}
