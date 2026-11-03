// What counts as Italian that did not get translated: ONE definition for the tour in the browser (check-i18n) and the census of the source (census-i18n).
//   - the Italian-only words: every word of the Italian side of the phrase book that never appears in an English side (and is not a loanword);
//   - the Italian function words: a text with three words and two of them «il, di, per, che…» is Italian;
//   - proper names (parties, groups, politicians, municipalities…) are taken out first, as whole names, before the words are read;
//   - an allowlisted text (official denominations, invented newspapers…) is never flagged.
// A text that merely CHANGED is not translated: it is translated when nothing Italian is left in it.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ALLOWED_ITALIAN, ENGLISH_LOANWORDS } from './i18n-allowlist.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const ITALIAN_FUNCTION = new Set('il lo la le gli un una uno di del della dei delle al alla dal nel nella sul sulla per con che non sono come più tra fra sei hai puoi questa questo quando dove cosa senza ogni è già può così anche ancora prima dopo fino mai tutti tutte della degli nelle nei alle agli dagli sugli dalle molto poco ogni nessun nessuna loro suo sua suoi sue tuo tua tuoi tue ha ho abbiamo hanno siamo siete'.split(' '));
export const wordsOf = text => text.toLowerCase().replace(/#|\{\d?\}|⟦\d+⟧/g, ' ').match(/[a-zà-ù]{3,}/g) ?? [];
export const looksItalian = text => { const words = text.toLowerCase().match(/[a-zà-ù']+/g) ?? []; return words.length >= 3 && words.filter(word => ITALIAN_FUNCTION.has(word)).length >= 2; };
// Articles and prepositions that are Italian and nothing else (a single one left in an English sentence is enough: «Il governo is falling»).
export const ITALIAN_ONLY_SMALL = new Set('il lo gli del della dei delle nel nella nei nelle sul sulla sui alla alle dal dalla dalle degli agli è una uno'.split(' '));
export const fold = text => text.replace(/[’']/g, "'").toLowerCase();

// The pairs of the phrase book as the game ships them (the same files as the interface loads).
export function bookPairs() {
  const dir = join(root, 'src/data/i18n');
  const pairs = [];
  for (const file of readdirSync(dir).filter(name => /^en-ui-\d+\.js$/.test(name)).sort()) {
    const text = readFileSync(join(dir, file), 'utf8');
    for (const match of text.matchAll(/^\s*\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\]/gm)) pairs.push([match[1].replace(/\\(["\\])/g, '$1'), match[2].replace(/\\(["\\])/g, '$1'), file]);
  }
  return pairs;
}

// The proper names of the real data (parties, groups, politicians, places…), folded, as a set of whole names.
const NAME_KEYS = new Set(['name', 'fullName', 'displayName', 'officialName', 'abbreviation', 'label', 'firstName', 'lastName', 'shortName', 'municipality', 'region', 'province', 'title', 'denomination', 'listName', 'groupName', 'chamberName']);
const NAME_FILES = ['parties', 'political-movements', 'parliamentary-groups', 'coalitions', 'politicians', 'political-figures', 'municipalities', 'territorial-units', 'territories', 'electoral-lists', 'committees', 'government', 'chambers'];
export function realProperNames(extra = []) {
  const names = new Set();
  const add = value => { if (typeof value === 'string' && value.length >= 3 && value.length <= 140) names.add(fold(value.trim())); };
  const walk = value => {
    if (Array.isArray(value)) { for (const item of value) walk(item); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) { if (NAME_KEYS.has(key)) add(item); if (item && typeof item === 'object') walk(item); }
  };
  for (const file of NAME_FILES) { try { walk(JSON.parse(readFileSync(join(root, 'src/data/real', `${file}.json`), 'utf8'))); } catch { /* a file the checkout does not have */ } }
  for (const name of extra) add(name);
  return names;
}
// Whole-name removal by n-grams of words (a set lookup, so it stays fast with a hundred thousand names): «Fratelli d'Italia» is taken out as a name, never from inside another word.
function stripNames(text, names) {
  const folded = fold(text).replace(/'s(?![a-zà-ù0-9])/g, ''); // (a possessive: «Siena's» is the name «Siena»)
  const parts = folded.split(/([^a-zà-ù0-9']+)/);
  const words = [], seps = [];
  parts.forEach((part, index) => (index % 2 ? seps : words).push(part));
  const out = [];
  for (let i = 0; i < words.length;) {
    let hit = 0;
    for (let n = Math.min(8, words.length - i); n >= 1 && !hit; n--) {
      const candidate = words.slice(i, i + n).map((word, k) => k < n - 1 ? word + (seps[i + k]?.trim() === '' || /^[\s-]+$/.test(seps[i + k] ?? '') ? seps[i + k] : seps[i + k]) : word).join('');
      if (words[i] && names.has(candidate.trim())) hit = n;
    }
    if (hit) { out.push(' '); i += hit; } else { out.push(words[i], seps[i] ?? ''); i++; }
  }
  return out.join('');
}

// The text with every proper name (whole names, any case) replaced by `{}`: «Futuro Nazionale entra nella coalizione di Fratelli d’Italia» → «{} entra nella coalizione di {}». Neighbouring names merge.
// Capitalised common nouns of the institutions: places and people may be called so («Paese», a municipality), but in the text they are words to translate.
const COMMON_CAPITALS = new Set(['paese', 'governo', 'stato', 'camera', 'senato', 'parlamento', 'repubblica', 'regione', 'comune', 'provincia', 'presidente', 'ministro', 'costituzione', 'europa', 'unione', 'consiglio', 'commissione', 'corte', 'legge', 'decreto', 'aula', 'giunta', 'opposizione', 'maggioranza', 'nord', 'centro', 'sud', 'mezzogiorno', 'isole', 'nello', 'nella', 'elezioni', 'affluenza', 'motivo', 'piano', 'ponte', 'polo', 'fondi', 'nuova', 'nuovo', 'area', 'sostegno', 'misura', 'proposta', 'coalizione', 'crisi', 'tensione', 'congresso', 'comitato', 'tagli', 'sport']);
export function templateByNames(text, names, common = new Set()) {
  const parts = text.split(/([^\p{L}\p{N}'’]+)/u);
  const words = [], seps = [];
  parts.forEach((part, index) => (index % 2 ? seps : words).push(part));
  const out = [];
  for (let i = 0; i < words.length;) {
    let hit = 0;
    for (let n = Math.min(10, words.length - i); n >= 1 && !hit; n--) {
      const candidate = words.slice(i, i + n).map((word, k) => word + (k < n - 1 ? seps[i + k] : '')).join('');
      const key = fold(candidate).replace(/'s$/, '');
      // (the first word of a text that is an ordinary word of the Italian side of the book — «Nello scenario…», «Governo…» — is not a name even if a person is called so, unless a colon or a dash follows: «Lega: 40%…»)
      if (words[i] && key.length >= 4 && names.has(key) && /^\p{Lu}/u.test(words[i]) && !(n === 1 && COMMON_CAPITALS.has(key)) && !(n === 1 && common.has(key) && i === 0 && !/^\s*[:—–]/.test(seps[0] ?? ''))) hit = n;
    }
    if (hit) { out.push('{}'); i += hit; out.push(seps[i - 1] ?? ''); } else { out.push(words[i], seps[i] ?? ''); i++; }
  }
  return out.join('').replace(/(\{\}\s?)+\{\}/g, '{}');
}

// The detector. `pairs` are the pairs of the book, `names` the folded proper names.
export function createDetector({ pairs = bookPairs(), names = realProperNames() } = {}) {
  const italianWords = new Set(), englishWords = new Set();
  for (const [it, en] of pairs) { for (const word of wordsOf(it)) italianWords.add(word); for (const word of wordsOf(en)) englishWords.add(word); }
  const italianOnly = new Set([...italianWords].filter(word => !englishWords.has(word) && !ENGLISH_LOANWORDS.has(word)));
  const allowed = text => ALLOWED_ITALIAN.find(item => item.pattern.test(text.trim()))?.reason ?? null;
  // Why a text still reads as Italian (null: it does not). The reason is kept in the reports so a false alarm is easy to tell from a real gap.
  const reasonOf = text => {
    if (allowed(text)) return null;
    const bare = stripNames(text, names);
    const word = wordsOf(bare).find(item => italianOnly.has(item));
    if (word) return `parola solo italiana: «${word}»`;
    const small = (bare.toLowerCase().match(/[a-zà-ù]+/g) ?? []).find(item => ITALIAN_ONLY_SMALL.has(item));
    if (small) return `articolo o preposizione italiana: «${small}»`;
    if (looksItalian(bare)) return 'parole grammaticali italiane';
    return null;
  };
  return { reasonOf, allowed, italianOnly, italianWords, names };
}
