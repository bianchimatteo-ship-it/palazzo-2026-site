// The subject of a sentence of the game (a headline of the week, a promise, a point of a programme), read from its own words: the topic of the debate it belongs to, or null when the words do not say
// it with enough certainty (two topics equally named, or none). A question or an attack built on that sentence is answered with the choices of THAT topic (core/scene-engine.js); with null the
// generic wording is used — never the choices of another subject (before, a question on the delays of the rescue services was answered with the figures of employment).
// A phrase («fine vita», «protezione civile») weighs twice a single stem: it names its subject with more certainty.
// The topics are those of the debate (DEBATE_TOPICS) plus three that only events and promises bring: soccorsi (rescue and emergencies), immigrazione, diritti (civil rights).
const KEYWORDS = Object.freeze({
  sanita: ['pronto soccorso', 'sanit', 'ospedal', 'medic', 'infermier', 'liste d’attesa', "liste d'attesa", 'lista d’attesa', 'asl', 'farmac', 'vaccin', 'ricover', 'cure', 'malati', 'health', 'hospital', 'waiting list'],
  soccorsi: ['soccors', 'ambulanz', '118', 'protezione civile', 'alluvion', 'terremot', 'sisma', 'frana', 'incendi', 'vigili del fuoco', 'emergenz', 'evacua', 'sfollat', 'maltempo', 'esondaz', 'rescue', 'flood', 'earthquake', 'emergency'],
  lavoro: ['lavor', 'occupaz', 'salari', 'disoccup', 'fabbric', 'licenzi', 'sindacat', 'sciopero', 'precari', 'cassa integrazione', 'assunzion', 'impres', 'stabiliment', 'job', 'wage', 'unemploy', 'factory', 'strike'],
  'costo-vita': ['prezz', 'inflaz', 'bollett', 'caro ', 'carovita', 'mutu', 'affitt', 'costo della vita', 'tasse', 'fisco', 'fiscal', 'accise', 'carburant', 'benzina', 'spesa', 'tariff', 'price', 'bill', 'rent', 'tax'],
  servizi: ['servizi', 'trasport', 'treni', 'treno', 'autobus', 'pendolar', 'ufficio postale', 'sportell', 'asili', 'nido', 'rifiuti', 'acquedott', 'mobilità', 'metropolitan', 'transport', 'train', 'bus'],
  ambiente: ['ambient', 'clima', 'climat', 'inquinam', 'siccit', 'rinnovabil', 'parchi', 'smog', 'consumo di suolo', 'emissioni', 'green', 'environment', 'pollution', 'drought'],
  sicurezza: ['sicurezz', 'criminal', 'furt', 'rapin', 'spaccio', 'violenz', 'polizia', 'carabinier', 'mafi', 'baby gang', 'aggression', 'crime', 'police', 'theft'],
  giovani: ['scuol', 'universit', 'student', 'giovani', 'istruzion', 'docent', 'insegnant', 'borse di studio', 'school', 'student', 'teacher', 'young'],
  istituzioni: ['corruzion', 'scandal', 'istituzion', 'parlament', 'trasparenz', 'legge elettorale', 'autonomia differenziata', 'premierato', 'magistratur', 'tangent', 'corruption', 'institution'],
  immigrazione: ['migrant', 'immigra', 'sbarch', 'accoglienz', 'permesso di soggiorno', 'cittadinanz', 'profugh', 'rimpatri', 'migration', 'refugee'],
  diritti: ['diritti civili', 'unioni civili', 'fine vita', 'aborto', 'discrimin', 'parità di genere', 'omotransfob', 'lgbt', 'eutanasia', 'civil rights']
});
export const EXTRA_TOPICS = Object.freeze({ soccorsi: { it: 'Soccorsi ed emergenze', en: 'Rescue and emergencies' }, immigrazione: { it: 'Immigrazione', en: 'Immigration' }, diritti: { it: 'Diritti civili', en: 'Civil rights' } });
const norm = text => ` ${String(text ?? '').toLowerCase().replace(/[’']/g, '’').replace(/\s+/g, ' ')} `;
export function topicOfText(text) {
  const value = norm(text);
  if (value.trim().length < 3) return null;
  const scores = Object.entries(KEYWORDS).map(([id, words]) => [id, words.reduce((sum, word) => sum + (value.includes(norm(word).trim()) ? (word.includes(' ') ? 2 : 1) : 0), 0)]).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]);
  // «pronto soccorso» is the hospital, not the rescue services: the phrase settles it
  if (value.includes('pronto soccorso')) return 'sanita';
  if (!scores.length || (scores[1] && scores[1][1] === scores[0][1])) return null;
  return scores[0][0];
}
