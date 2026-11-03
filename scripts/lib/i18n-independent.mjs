// An Italian detector that does NOT depend on the phrase book alone (the book decides what was translated; this decides what still reads as Italian):
//   1. Italian function words (articles, prepositions, pronouns, auxiliaries, conjunctions: about 300, none of them an English word) — one is enough, in a text of any length;
//   2. accented Italian letters (à è é ì ò ù) in a word that is not a proper name;
//   3. Italian morphology (-zione, -zioni, -sione, -mente, -ità, -aggio, -ezza, -oso, -ismo… ) in a word that is not English;
//   4. the Italian lexicon of the project: every word of the Italian strings of the code and of the Italian side of the book, minus the words that are English too;
//   5. single words and short texts count (a button, an option, a tooltip), capitals do not exempt a word: only whole proper names (people, parties, places, official denominations) and allowed
//      texts are taken out first.
// What it cannot know is listed as such by the audit; it never declares "no Italian" for a text it did not analyse.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ALLOWED_ITALIAN } from './i18n-allowlist.mjs';
import { bookPairs, realProperNames } from './i18n-detect.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const STOPWORDS = new Set(`il lo gli del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle col coi
per con che non sono sei siamo siete hai abbiamo avete hanno era erano sarà saranno sarebbe essere avere fare fatto puoi possono vuoi vuole voglio devi deve devono tuo tua tuoi suo sua suoi sue nostro nostra nostri nostre
vostro vostra questo questa questi queste quello quella quelli quelle come dove quando perché perche cosa chi quale quali anche ancora già sempre mai più meno molto poco troppo tutto tutti tutte ogni altro altra altri altre
stesso stessa stessi stesse dopo prima durante senza tra fra sopra sotto verso contro fino oltre mentre però ma così quindi dunque oppure nessun nessuna nessuno niente nulla ciò ci vi mi ti loro noi voi lei lui
è è un una uno gli le lo la ed sia siano fosse fossero stato stata stati state ho ha hai può possiamo dobbiamo volete vogliamo
oggi ieri domani adesso ora poi allora subito spesso forse circa quasi solo soltanto anzi pure infatti invece inoltre dentro fuori insieme ognuno ciascuno qualche qualcuno qualsiasi alcuni alcune
primo seconda terzo quarto quinto sesto settimo ottavo nono decimo grazie prego benvenuto benvenuta salva salvare carica caricare chiudi chiudere apri aprire annulla conferma continua indietro avanti
`.split(/\s+/).filter(Boolean));
// Words that are Italian function words AND English words or names: never counted alone.
const STOP_EXCEPTIONS = new Set(['per', 'state', 'all', 'tue', 'sun', 'sat', 'mon', 'wed', 'thu', 'fri', 'quartiere', 'ha', 'ho', 'me', 'ora', 'pure', 'subito', 'solo', 'primo', 'stato', 'sia', 'era', 'come', 'mai', 'ci', 'vi', 'mi', 'ti', 'ne', 'poi', 'anzi', 'circa', 'loro', 'lei', 'lui', 'noi', 'voi', 'una', 'uno', 'ed', 'col', 'oggi', 'sopra', 'sotto', 'verso', 'forse', 'nono', 'sesto', 'quasi', 'prego', 'fino', 'salva', 'carica', 'continua', 'conferma', 'avanti', 'dentro', 'fuori']);
const MORPH = /(?:zione|zioni|sione|sioni|mente|ità|aggio|aggi|ezza|ezze|ismo|ismi|oso|osa|osi|ose|ivo|iva|ivi|ive|ario|aria|ari|iere|iera|tore|tori|trice|trici|ento|enti|anza|enza|enze|ggio|ura|ure)$/;
const MORPH_MIN = 7;
const MORPH_STRONG = /(?:zione|zioni|sione|sioni|mente|ità|aggio|ezza|ezze|ismo|oso|osa)$/;

// (a word kept on both sides of the book more often than translated is the same word in both languages; one translated away more often is Italian even when a name keeps it)
const itCommon = (w, kept, away) => (away.get(w) ?? 0) > 0 && (kept.get(w) ?? 0) <= (away.get(w) ?? 0);
let cached = null;
export function createIndependentDetector({ extraNames = [] } = {}) {
  if (cached && !extraNames.length) return cached;
  const pairs = bookPairs();
  const english = new Set(), italian = new Set();
  const words = text => text.toLowerCase().replace(/#|\{\d?\}|⟦\d+⟧/g, ' ').match(/[a-zà-ù]+/g) ?? [];
  // a word is English when more pairs keep it on the English side than translate it away (a name that stays, like «Territori» inside a party, does not make the Italian word English)
  const kept = new Map(), away = new Map(), seenEnglish = new Set();
  for (const [it, en] of pairs) {
    const enWords = new Set(words(en)), itWords = new Set(words(it));
    for (const w of enWords) { seenEnglish.add(w); if (itWords.has(w)) kept.set(w, (kept.get(w) ?? 0) + 1); }
    for (const w of itWords) if (!enWords.has(w)) away.set(w, (away.get(w) ?? 0) + 1);
  }
  for (const w of seenEnglish) { if (!itCommon(w, kept, away)) english.add(w); }
  // English prose of the project (code comments, English documents and pages): a word that is used there is an English word, whatever the Italian side of the book says
  const prose = new Set();
  const readProse = file => { for (const line of readFileSync(file, 'utf8').split('\n')) { const m = line.match(/^\s*(?:\/\/|\*|\/\*+|#|<!--)\s*(.+)$/) ?? (file.endsWith('.md') || file.endsWith('-en.html') ? [null, line] : null); if (!m) continue; const t = m[1]; if (/[àèéìòù]/i.test(t) || words(t).some(w => STOPWORDS.has(w) && !STOP_EXCEPTIONS.has(w))) continue; for (const w of words(t)) prose.add(w); } };
  const walkProse = dir => { for (const name of readdirSync(dir)) { const full = join(dir, name); if (name === 'node_modules' || name === 'www' || name === '.git') continue; if (statSync(full).isDirectory()) walkProse(full); else if (/\.(js|mjs|md)$/.test(name) || name.endsWith('-en.html')) readProse(full); } };
  for (const dir of ['src', 'scripts', 'docs']) walkProse(join(root, dir));
  for (const w of prose) if (w.length >= 3) english.add(w);
  // the Italian lexicon: the Italian strings of the source (those with an Italian function word or an accent) + the Italian side of the book
  const walk = dir => { for (const name of readdirSync(dir)) { const full = join(dir, name); if (statSync(full).isDirectory()) { if (name !== 'i18n') walk(full); } else if (/\.(js|html)$/.test(name)) harvest(readFileSync(full, 'utf8')); } };
  const harvest = source => { for (const m of source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n]){6,200})\1/g)) { const text = m[2]; if (/[àèéìòù]/i.test(text) || words(text).some(w => STOPWORDS.has(w) && !STOP_EXCEPTIONS.has(w))) for (const w of words(text)) italian.add(w); } };
  walk(join(root, 'src'));
  for (const [it] of pairs) for (const w of words(it)) italian.add(w);
  const names = realProperNames(extraNames);
  const lexicon = new Set([...italian].filter(w => w.length >= 3 && !english.has(w)));
  // words of the lexicon that are ordinary English too (a loanword, a name) never flag
  const ENGLISH_OK = new Set('era asl rail serve emerge mon tue wed thu fri sat sun pie vda lom taa ven fvg lig emr tos umb mar laz abr mol cam pug bas cal sic sar app mail email online offline login logout account password username web wifi sms pdf zip png json url http https api ios android google apple instagram facebook youtube tiktok radio sport welfare budget leader dossier summit premier team staff social media video audio file smartphone pop rock jazz menu bar hub meme blog chat link'.split(' '));
  const fold = t => t.replace(/[’']/g, "'").toLowerCase();
  const stripNames = text => {
    // whole names (n-grams up to 8 words) removed first, any case
    const parts = fold(text).split(/([^\p{L}\p{N}']+)/u);
    const w = [], s = [];
    parts.forEach((part, i) => (i % 2 ? s : w).push(part));
    const out = [];
    for (let i = 0; i < w.length;) {
      let hit = 0;
      for (let n = Math.min(8, w.length - i); n >= 1 && !hit; n--) { const cand = w.slice(i, i + n).map((x, k) => k < n - 1 ? x + s[i + k] : x).join('').trim(); if (cand && names.has(cand)) hit = n; }
      if (hit) { out.push(' '); i += hit; } else { out.push(w[i], s[i] ?? ''); i++; }
    }
    return out.join('');
  };
  const allowed = text => ALLOWED_ITALIAN.some(item => item.pattern.test(text.trim()));
  // proper names the data and the game give (kept in Italian on purpose): the invented newspapers and channels of the game, the official sub-divisions of the electoral map («TORINO: CIRCOSCRIZIONE 2 - …»),
  // the official denominations of parliamentary groups and constituencies
  const INTENTIONAL = [
    /\b(Il Meridiano|La Gazzetta del Territorio|La Politica \d*|LA POLITICA \d*|Radio La Politica \d*|Piazza Digitale|Rete Quartiere|Più Europa|Alleanza dei Territori|Rifondazione Comu…|Misto|Autonomie e Territori|Rete Civica|Voce del Popolo|Il Corriere del Territorio)\b/gi,
    /\b[A-ZÀ-Ù' .]{3,}: (?:CIRCOSCRIZIONE|MUNICIPIO|QUARTIERE|NIL|MUNICIPALITÀ|ZONA|CIRC\.|CONSIGLIO DI ZONA|UNITÀ URBANISTICA|AREA STATISTICA)[^·(]*(?:\([A-ZÀ-Ù0-9' .-]+\))?/g,
    /\b(?:Senate|Chamber of Deputies)\b[^·]*\bDemocrazia Ambiente Futuro\b|\bDemocrazia Ambiente Futuro\b|Rifondazione Comu…|Solidarietà - Lib…|Partito (?:Democrati|Socialist)…/g,
    /^(?:Delega al Governo|Misure di |Norme |Interventi |Disciplina |Nuove norme |ESTRADIZIONE)[^·]*/,
    /\b(?:Verdi del Sudtirolo|Per le Autonomie|Vallée d’Aoste|America (?:Settentrionale|Meridionale)(?: E Centrale)?|Estero|Africa-Asia-Oceania-Antartide|Europa)\b[^·]*/g
  ];
  // the surnames of the simulated people (invented: «Ferri», «Conti» are also Italian words) are names
  const withoutIntentional = text => INTENTIONAL.reduce((out, re) => out.replace(re, ' '), text.replace(/(^|· )[^·]*?(?= \(simulated person\))/g, '$1'));
  // → null, or the reason a text reads as Italian
  const reasonOf = (text, { strict = true } = {}) => {
    if (!text || allowed(text)) return null;
    const bare = stripNames(withoutIntentional(text));
    // a word written with a capital in the middle of a text and never in lower case is read as a name when it is only accented (surnames: Carrà, Bonafè, Urzì)
    const lowerInitial = new Set((text.match(/\p{Ll}[\p{L}']*/gu) ?? []).map(x => x.toLowerCase().replace(/’/g, "'")));
    const toks = (bare.match(/[\p{L}']+(?:-[\p{L}']+)*/gu) ?? []).flatMap(t => t.includes('-') ? t.split('-').filter((x, i, all) => !(i === 0 && /^(non|anti|ex|co|pre|post|re)$/.test(x) && all.length > 1)) : [t]);
    for (const raw of toks) {
      const w = raw.replace(/^'+|'+$/g, '');
      if (!w) continue;
      if (/^[ldn]'|'/.test(w)) { const tail = w.split("'").pop(); if (tail && lexicon.has(tail) && !ENGLISH_OK.has(tail)) return `elisione italiana «${w}»`; }
      if (STOPWORDS.has(w) && !STOP_EXCEPTIONS.has(w) && w.length >= 2 && !english.has(w)) return `parola grammaticale italiana «${w}»`;
      if (STOPWORDS.has(w) && !STOP_EXCEPTIONS.has(w) && w.length >= 3) return `parola grammaticale italiana «${w}»`;
      if (/[àèéìòù]/.test(w) && !/^(café|cafe|naïve|résumé)$/.test(w) && (lowerInitial.has(w) || lexicon.has(w))) return `lettera accentata italiana in «${w}»`;
      if (!english.has(w) && !ENGLISH_OK.has(w)) {
        if (w.length >= MORPH_MIN && MORPH_STRONG.test(w)) return `morfologia italiana «${w}»`;
        if (strict && lexicon.has(w)) return `parola del lessico italiano «${w}»`;
      }
    }
    return null;
  };
  // The other direction: English in the Italian interface (function words that no Italian text uses); proper names, brands and the few English terms the game keeps are taken out first.
  const ENGLISH_STOP = new Set('the and of to your you with from for this that are is was will not have has been can may but our their which when where how what who into about after before under between while'.split(' '));
  const ENGLISH_KEPT = [/\bHall of Fame\b/gi, /\bFratelli d[’']Italia\b/gi, /\bsandbox\b/gi, /\bRenew Europe\b/g, /\bS&D\b/g, /\bECR\b/g, /\bAccount\b/g, /\bPOLITICANDO 2026\b/g, /\bOpen\s?Data\b/gi, /\bLicence\b/gi, /\bCC BY\b/g, /\bonData\b/g, /\bmade in\b/gi, /\bPartito (?:Democratico|Liberaldemocratico)\b/g, /\bPiù Europa\b/g];
  const reasonOfEnglish = text => {
    if (!text) return null;
    const bare = stripNames(ENGLISH_KEPT.reduce((out, re) => out.replace(re, ' '), text));
    for (const raw of bare.match(/[\p{L}']+/gu) ?? []) { const w = raw.replace(/^'+|'+$/g, ''); if (ENGLISH_STOP.has(w)) return `parola inglese «${w}» nell’interfaccia italiana`; }
    return null;
  };
  const api = { reasonOf, reasonOfEnglish, lexiconSize: lexicon.size, englishSize: english.size, names, stripNames, allowed };
  if (!extraNames.length) cached = api;
  return api;
}
