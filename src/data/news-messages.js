// The messages of the newsroom that carry parameters (the name of a person, a topic, a territory, the kind of public appearance): ONE catalog, both languages.
//   · the engine writes its article from these templates in Italian (what the save keeps) AND in English (kept next to it, `article.en`): the template, the parameters and the proper names stay separate,
//     nothing is composed in Italian and translated afterwards;
//   · the same templates give the phrase book its pairs (`messagePairs`, expanded over the kinds and the tones), so an article that a save already holds, written before the English existed, is read
//     in English from the very same source.
// Proper names (people, parties, territories) are parameters: they are never translated and never part of a template.

// kind of public appearance: [Italian capitalised, English capitalised]; the lower-case forms are derived (Italian: first letter; English: first letter too)
export const ACTIVITY_KINDS = Object.freeze({
  intervista: ['L’intervista', 'The interview'],
  conferenza: ['La conferenza stampa', 'The press conference'],
  talk: ['L’ospitata televisiva', 'The TV appearance'],
  'prima-serata': ['La prima serata', 'The prime-time appearance'],
  interrogazione: ['L’interrogazione', 'The parliamentary question'],
  pubblica: ['L’uscita pubblica', 'The public appearance']
});
export const ACTIVITY_HOW = Object.freeze({
  bad: ['una prova difficile', 'a difficult performance'],
  good: ['una prova convincente', 'a convincing performance'],
  neutral: ['una prova senza scossoni', 'a performance without shocks']
});
export const ACTIVITY_RESULT = Object.freeze({ good: ['positivo', 'positive'], bad: ['negativo', 'negative'], neutral: ['neutro', 'neutral'] });
// the topics a public appearance can be about (the labels of the issues of the society, lower case): [Italian, English]
export const TOPICS = Object.freeze({
  economia: 'economy', occupazione: 'employment', 'servizi pubblici': 'public services', sanità: 'healthcare', istruzione: 'education', infrastrutture: 'infrastructure', trasporti: 'transport',
  sicurezza: 'security', ambiente: 'environment', lavoro: 'employment', giovani: 'young people', pensionati: 'pensioners', famiglie: 'families', energia: 'energy', giustizia: 'justice', casa: 'housing',
  fisco: 'taxation', immigrazione: 'immigration', cultura: 'culture', agricoltura: 'agriculture', turismo: 'tourism', 'politica estera': 'foreign policy', difesa: 'defence', università: 'universities'
});

// id → [Italian, English]; {Kind} {kind} {how} are expanded from the tables above, the others are parameters
export const MESSAGES = Object.freeze({
  'attivita.titolo': ['{name}: {kind} su {topic}', '{name}: {kind} on {topic}'],
  'attivita.titolo.difficolta': ['{name} in difficoltà su {topic}', '{name} in difficulty on {topic}'],
  'attivita.titolo.domande': ['{name} parla di {topic}: molte domande restano aperte', '{name} talks about {topic}: many questions remain open'],
  'attivita.titolo.linea': ['{name} su {topic}: nonostante le critiche, tiene la linea', '{name} on {topic}: despite the criticism, holds the line'],
  'attivita.titolo.punto': ['{name} su {topic}: il punto di vista di {party}', '{name} on {topic}: the view of {party}'],
  'attivita.sommario': ['{Kind} di {name} è stata {how}; il tema è {topic}', '{Kind} by {name} was {how}; the subject is {topic}'],
  'attivita.sommario.territorio': ['{Kind} di {name} è stata {how}; il tema è {topic} e il territorio di riferimento è {region}', '{Kind} by {name} was {how}; the subject is {topic} and the reference territory is {region}'],
  // (the short forms of the newsroom — the social network, the brief — keep the lead only: «L’intervista di X è stata una prova difficile…»)
  'attivita.sommario.breve': ['{Kind} di {name} è stata {how}', '{Kind} by {name} was {how}'],
  'attivita.corpo': ['{Kind} di {name} ha messo al centro {topic}. Secondo i resoconti simulati è stata {how}.', '{Kind} by {name} put {topic} at the centre. According to the simulated accounts it was {how}.'],
  'attivita.territorio': ['Il riferimento al territorio ({region}) ha dato concretezza agli argomenti.', 'The reference to the territory ({region}) gave the arguments substance.'],
  'attivita.priorita': ['Il tema era tra le priorità dichiarate del Governo.', 'The topic was among the declared priorities of the Government.'],
  'attivita.forza': ['una forza politica', 'a political force']
});

const lowerFirst = text => String(text).charAt(0).toLowerCase() + String(text).slice(1);
const side = (pair, lang) => pair[lang === 'en' ? 1 : 0];
// the text of a message in a language; the parameters are plain strings (names stay as they are), the kind and the tone are keys of the tables
export function message(id, lang, params = {}) {
  const template = side(MESSAGES[id], lang);
  const kind = ACTIVITY_KINDS[params.kindKey] ?? ACTIVITY_KINDS.pubblica;
  const how = ACTIVITY_HOW[params.tone] ?? ACTIVITY_HOW.neutral;
  const values = { ...params, Kind: side(kind, lang), kind: lowerFirst(side(kind, lang)), how: side(how, lang) };
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
// the topic in English, or null when the catalog does not know it (the article then keeps the translation of the phrase book only)
export const topicEnglish = topic => TOPICS[String(topic ?? '').toLowerCase()] ?? null;

// ---- the pairs of the phrase book: every message expanded over the kinds and the tones, the parameters left as free parts ({}) in the order of the Italian text ----
export function messagePairs() {
  const pairs = [];
  const slotted = (it, en) => {
    // the parameters of the Italian text, in order; the English text refers to them by number
    const names = []; const itSlots = it.replace(/\{(\w+)\}/g, (match, key) => { if (['Kind', 'kind', 'how'].includes(key)) return match; names.push(key); return '{}'; });
    const enSlots = en.replace(/\{(\w+)\}/g, (match, key) => { if (['Kind', 'kind', 'how'].includes(key)) return match; const at = names.indexOf(key); return at >= 0 ? `{${at + 1}}` : match; });
    return [itSlots, enSlots];
  };
  for (const [id, [it, en]] of Object.entries(MESSAGES)) {
    const needsKind = /\{(Kind|kind)\}/.test(it), needsHow = /\{how\}/.test(it);
    const kinds = needsKind ? Object.values(ACTIVITY_KINDS) : [null], hows = needsHow ? Object.values(ACTIVITY_HOW) : [null];
    for (const kind of kinds) for (const how of hows) {
      let itText = it, enText = en;
      if (kind) { itText = itText.replaceAll('{Kind}', kind[0]).replaceAll('{kind}', lowerFirst(kind[0])); enText = enText.replaceAll('{Kind}', kind[1]).replaceAll('{kind}', lowerFirst(kind[1])); }
      if (how) { itText = itText.replaceAll('{how}', how[0]); enText = enText.replaceAll('{how}', how[1]); }
      pairs.push(slotted(itText, enText));
    }
    void id;
  }
  for (const [it, en] of Object.values(ACTIVITY_KINDS)) { pairs.push([it, en], [lowerFirst(it), lowerFirst(en)]); }
  for (const [it, en] of Object.values(ACTIVITY_HOW)) pairs.push([it, en]);
  // (the topics and the results — «economia», «positivo» — are common words of the interface: they keep the pairs they already have in the book, they are not redefined here)
  pairs.push([MESSAGES['attivita.forza'][0], MESSAGES['attivita.forza'][1]]);
  return pairs;
}
export const ALL_PAIRS = messagePairs();
