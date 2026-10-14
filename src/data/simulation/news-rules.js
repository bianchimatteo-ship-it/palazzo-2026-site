// The simulated newsroom: who the outlets are (credibility, public, leaning), what an article is, how a story lives and dies.
// Game mechanics (source: simulation): every masthead is invented, none describes a real newspaper, channel or journalist.

// The identity of each channel of society.media. leaning: -2 (left) … +2 (right), on the same axis as the groups of Parliament;
// credibility: 0–100 at the start (it moves with what the outlet gets right); public: the segments it reaches most (×1 is the average);
// beat: the categories it covers first; investigative: it breaks the stories of inquiries and scandals.
export const NEWSROOM_OUTLETS = Object.freeze({
  'tv-nazionale': { name: 'TG Orizzonte', tagline: 'Il telegiornale della sera', leaning: 0, credibility: 66, public: { anziani: 1.5, famiglie: 1.1, giovani: 0.5 }, beat: ['politica', 'governo', 'economia', 'elezioni'], investigative: false },
  'tv-locale': { name: 'Rete Quartiere', tagline: 'Le televisioni del territorio', leaning: 0.5, credibility: 58, public: { anziani: 1.3, famiglie: 1.1, imprese: 0.9 }, beat: ['territorio', 'opere'], investigative: false },
  quotidiani: { name: 'Il Meridiano', tagline: 'Quotidiano nazionale di opinione', leaning: -0.8, credibility: 72, public: { famiglie: 1.2, imprese: 1.1, giovani: 0.7 }, beat: ['parlamento', 'governo', 'economia', 'elezioni'], investigative: true },
  'stampa-locale': { name: 'La Gazzetta del Territorio', tagline: 'Cronaca locale e opere pubbliche', leaning: 0.4, credibility: 63, public: { anziani: 1.3, imprese: 1.2, famiglie: 1.0 }, beat: ['territorio', 'opere'], investigative: false },
  social: { name: 'Piazza Digitale', tagline: 'Il racconto dei social', leaning: 0, credibility: 38, public: { giovani: 1.7, fragili: 1.2, anziani: 0.3 }, beat: ['politica', 'partito', 'sondaggi'], investigative: false },
  radio: { name: 'Radio Terzo Piano', tagline: 'Dirette, interviste, ascoltatori in linea', leaning: 0.9, credibility: 56, public: { imprese: 1.3, famiglie: 1.2, anziani: 1.0 }, beat: ['politica', 'partito'], investigative: false }
});

export const ARTICLE_CATEGORIES = Object.freeze([
  { id: 'politica', label: 'Politica', icon: 'news' },
  { id: 'governo', label: 'Governo', icon: 'ministry' },
  { id: 'parlamento', label: 'Parlamento', icon: 'dome' },
  { id: 'economia', label: 'Economia', icon: 'chart' },
  { id: 'territorio', label: 'Territorio', icon: 'pin' },
  { id: 'opere', label: 'Opere e fondi', icon: 'factory' },
  { id: 'partito', label: 'Partiti', icon: 'flag' },
  { id: 'sondaggi', label: 'Sondaggi', icon: 'chart' },
  { id: 'inchieste', label: 'Inchieste', icon: 'scandal' },
  { id: 'elezioni', label: 'Elezioni', icon: 'ballot' }
]);

export const STORY_KINDS = Object.freeze({
  crisi: { label: 'Crisi', icon: 'alert', stages: ['apertura', 'trattative', 'esito'] },
  riforma: { label: 'Riforma contestata', icon: 'law', stages: ['iter', 'approvazione', 'reazioni', 'primi risultati'] },
  scandalo: { label: 'Caso', icon: 'scandal', stages: ['indiscrezione', 'sviluppi', 'esito'] },
  economia: { label: 'Conti e mercati', icon: 'chart', stages: ['allarme', 'misure', 'esito'] },
  opere: { label: 'Opera pubblica', icon: 'factory', stages: ['progetto', 'cantiere', 'esito'] },
  territorio: { label: 'Territorio', icon: 'pin', stages: ['emergenza', 'risposte', 'esito'] },
  vicenda: { label: 'Vicenda', icon: 'news', stages: ['apertura', 'sviluppi', 'esito'] }
});

export const NEWS_RULES = Object.freeze({
  // How many full articles and stories the save keeps (the rest is archived into the headlines and the timeline).
  articlesKept: 48, storiesOpen: 8, storiesArchived: 10, seenKept: 120, backlogWeeks: 3, backlogKept: 12, timelineKept: 14, reactionsKept: 6, bodyMax: 520,
  // A story cools every week; it closes when it has been quiet and cold, and an archived story is not reopened.
  heatStart: 55, heatDecay: 6, heatMax: 100, closeBelow: 14, quietWeeks: 5,
  // A rumour (the first stage of a case) is confirmed or denied after this many weeks: the probability depends on the credibility of the outlet that broke it.
  rumourWeeks: [3, 5], confirmBase: 0.3, confirmPerCredibility: 0.55,
  // Credibility: what it gains from a confirmed story and loses from a denied one, and the slow return to the level of the masthead.
  credibility: { confirmed: 2, denied: -4, revert: 0.02, min: 10, max: 95 },
  // How much the credibility of an outlet counts when its tone moves the climate (1 at the average credibility of the newsroom).
  weight: { base: 0.65, perPoint: 0.006, min: 0.7, max: 1.3 },
  // A law survey (poll-observatory) that is this clear gives a story a development, and counts once.
  surveyClear: { against: 38, for: 58 },
  // A story is «breaking news» only when it weighs this much (a government crisis, a fall of the Government, a procedure from Brussels, the result of a general election), and one a week at most.
  breakingMin: 5,
  source: 'simulation'
});

// LA POLITICA 24: the house of the news of the game, one masthead with a newspaper and a radio. It collects what the simulated outlets wrote (each article keeps its own outlet) and reads it on the air.
// Original name and logo, internal to the simulation; it describes no real newspaper, broadcaster or journalist. Whether the name is free to use commercially has NOT been checked: see docs/privacy-e-asset.md.
export const LP24 = Object.freeze({
  name: 'LA POLITICA 24', tagline: 'Il giornale e la radio della politica',
  paper: Object.freeze({ name: 'La Politica 24', label: 'Il giornale', note: 'La prima pagina, le notizie della settimana e le storie che durano.' }),
  radio: Object.freeze({ name: 'Radio La Politica 24', label: 'La radio', note: 'Il notiziario della settimana e le rubriche, scritti dai fatti della partita.' }),
  disclaimer: 'Testata simulata e originale, interna al gioco: non descrive nessuna testata, emittente o giornalista reale.',
  trademarkChecked: false
});
// The programmes of the radio: a bulletin every week and the columns that exist only when there is something to say.
export const RADIO_PROGRAMMES = Object.freeze({
  notiziario: { label: 'Notiziario della settimana', slot: 'Le notizie che hanno pesato di più' },
  sondaggi: { label: 'Il punto sui sondaggi', slot: 'Rubrica' },
  territorio: { label: 'Dal territorio', slot: 'Rubrica' },
  palazzo: { label: 'Dal palazzo', slot: 'Rubrica' }
});
export const RADIO_RULES = Object.freeze({ bulletinsKept: 24, itemsPerBulletin: 4, itemsPerColumn: 3 });
