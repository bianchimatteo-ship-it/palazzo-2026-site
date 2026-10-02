// Names in normal capitalisation. Some official sources publish names in capitals (the Camera for its deputies, the
// ballots for the electoral lists, a few registrations of the 2×1000): the game shows them as they are normally written,
// and keeps the form of the source in `registeredName`. Only strings written entirely in capitals are recased; in names
// already in mixed case only an apostrophe used as an accent becomes the accent. What the owner types in the admin area
// is applied afterwards and stays as typed.
const ACRONYMS = new Set(['SVP', 'PATT', 'UDC', 'NM', 'FI', 'PPE', 'MAIE', 'PD', 'PSI', 'PRI', 'PLI', 'PCI', 'UV', 'ALPE', 'NDC', 'UCDL', 'USEI', 'CD', 'DC', 'M5S', 'AVS', 'IV', 'PSDAZ', 'MPA', 'UE']);
const CONNECTORS = new Set(['di', 'e', 'ed', 'con', 'per', 'della', 'delle', 'del', 'dei', 'degli', 'dello', 'la', 'le', 'il', 'lo', 'i', 'gli', 'a', 'al', 'alla', 'in', 'da', 'o', 'nel', 'nella', 'sul', 'sulla']);
const ACCENTS = Object.freeze({ a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' });
const hasLower = text => /\p{Ll}/u.test(text);
const hasUpper = text => /\p{Lu}/u.test(text);
const capital = word => word ? word.charAt(0).toLocaleUpperCase('it-IT') + word.slice(1).toLocaleLowerCase('it-IT') : word;
// Italian surnames and first names written with an apostrophe instead of the accent (URZI' → Urzì).
const accent = word => word.replace(/([aeiou])['’]$/i, (match, vowel) => ACCENTS[vowel.toLowerCase()]);

function wordCase(word, { person, first }) {
  if (!word) return word;
  const bare = word.replace(/[()]/g, '');
  if (!person && ACRONYMS.has(bare.replace(/['’]/g, ''))) return word;
  if (!person && !first && CONNECTORS.has(word.toLocaleLowerCase('it-IT'))) return word.toLocaleLowerCase('it-IT');
  // A single letter (TEAM K) or a number stays as it is.
  if (bare.length <= 1 || !/\p{L}/u.test(bare)) return word;
  if (word.includes('-')) return word.split('-').map((part, index) => wordCase(part, { person, first: first && index === 0 })).join('-');
  const apostrophe = word.match(/^(\p{L}+)(['’])(\p{L}.*)$/u);
  if (apostrophe) {
    const [, head, mark, tail] = apostrophe;
    // d'Italia, all'estero: an elided article or preposition inside the name of an organisation stays lower case.
    const lead = !person && !first && ['d', 'l', 'all', 'dall', 'dell', 'nell', 'sull'].includes(head.toLowerCase());
    return `${lead ? head.toLowerCase() : capital(head)}${mark}${wordCase(tail, { person, first: false })}`;
  }
  const cased = word.startsWith('(') ? `(${capital(word.slice(1))}` : capital(word);
  return person ? accent(cased) : cased;
}
export function displayCase(text, kind = 'organization') {
  const person = kind === 'person';
  // A name already in mixed case keeps its form; only the apostrophe used as an accent becomes the accent (Germana' → Germanà).
  if (typeof text === 'string' && person && hasLower(text)) return text.split(/(\s+)/).map(accent).join('');
  if (typeof text !== 'string' || !hasUpper(text) || hasLower(text)) return text;
  let first = true;
  return text.split(/(\s+)/).map(token => {
    if (/^\s+$/.test(token) || token === '-') { if (token === '-') first = true; return token; }
    const out = wordCase(token, { person, first });
    first = false;
    return out;
  }).join('');
}
const FIELDS = Object.freeze({ politicians: [['fullName', 'person'], ['firstName', 'person'], ['lastName', 'person']], parties: [['officialName', 'organization'], ['name', 'organization']], electoralLists: [['officialName', 'organization']] });
export function withDisplayNames(collection, records) {
  const fields = FIELDS[collection];
  if (!fields) return records;
  return records.map(record => {
    let next = record;
    for (const [field, kind] of fields) {
      const value = record[field];
      const cased = displayCase(value, kind);
      if (cased !== value) next = { ...next, [field]: cased, ...(field === 'fullName' || field === 'officialName' ? { registeredName: value } : {}) };
    }
    return next;
  });
}
