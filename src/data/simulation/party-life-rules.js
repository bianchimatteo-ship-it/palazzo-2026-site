// Internal life of the party (all simulated): the people behind the currents, what they ask for, the agreements that
// follow, the congress that comes out of the balances built week after week, the local leaders and the way a party
// is founded, split, merged or renamed. Nothing here describes a real person or the real organisation of a real party.

// ---------- the people behind the currents ----------
// Every current has a leader with a temperament: it decides what the current asks for first and how it takes a "no".
// The personas are roles, never names (figure simulate).
export const ACTOR_PERSONAS = Object.freeze({
  notabile: { label: 'il notabile', priority: 'poltrone', ambition: 70, patience: 55, temper: 35, trait: 'bada agli incarichi e agli equilibri tra le aree' },
  tribuno: { label: 'il tribuno', priority: 'linea', ambition: 78, patience: 35, temper: 72, trait: 'vuole una linea netta e non perdona le ambiguità' },
  mediatore: { label: 'il mediatore', priority: 'unita', ambition: 40, patience: 75, temper: 25, trait: 'cerca accordi e teme le rotture' },
  tecnico: { label: 'il tecnico', priority: 'programma', ambition: 45, patience: 62, temper: 30, trait: 'misura tutto sul programma e sui conti' },
  rinnovatore: { label: 'il rinnovatore', priority: 'candidature', ambition: 76, patience: 40, temper: 55, trait: 'chiede liste nuove e spazio ai giovani' },
  territoriale: { label: 'il capo dei territori', priority: 'risorse', ambition: 55, patience: 55, temper: 45, trait: 'difende federazioni, sedi e risorse locali' }
});
// Which personas a current can have (the pick depends on the career's seed).
export const PERSONAS_BY_CURRENT = Object.freeze({
  riformisti: ['tecnico', 'notabile', 'mediatore'],
  territori: ['territoriale', 'notabile', 'mediatore'],
  movimento: ['tribuno', 'rinnovatore', 'tribuno']
});
export const PERSONA_FALLBACK = ['notabile', 'mediatore', 'rinnovatore', 'tecnico'];

// ---------- requests ----------
// Who asks, what for, what an agreement on it means. `pact` is the kind of agreement an acceptance creates.
export const REQUEST_KINDS = Object.freeze({
  'quote-liste': { label: 'Quota nelle liste', pact: 'quote-liste', from: 'actor', secretary: true, detail: 'L’area chiede una parte dei posti sicuri nelle prossime liste.' },
  linea: { label: 'Linea politica', pact: 'linea', from: 'actor', secretary: true, detail: 'L’area chiede che il partito adotti la sua linea.' },
  programma: { label: 'Tema nel programma', pact: 'programma', from: 'actor', secretary: true, detail: 'L’area chiede un suo tema tra le priorità del programma.' },
  incarico: { label: 'Posto negli organi', pact: 'incarico', from: 'actor', secretary: true, detail: 'L’area chiede un seggio in più negli organi nazionali.' },
  fondi: { label: 'Fondi ai territori', pact: 'fondi', from: 'actor', secretary: true, detail: 'L’area chiede un contributo periodico per le sue federazioni.' },
  tregua: { label: 'Tregua interna', pact: 'tregua', from: 'actor', secretary: true, detail: 'Un’area offre la pace nello scontro, se la segreteria si impegna a non attaccarla.' },
  ultimatum: { label: 'Ultimatum', pact: null, from: 'actor', secretary: true, detail: 'L’area minaccia di lasciare il partito se non ottiene ciò che chiede.' },
  'sostegno-congresso': { label: 'Sostegno al congresso', pact: 'sostegno-congresso', from: 'actor', secretary: false, detail: 'L’area ti chiede di sostenere la sua mozione al congresso.' },
  sponsor: { label: 'Padrinato per la candidatura', pact: 'sostegno-congresso', from: 'actor', secretary: false, detail: 'L’area si offre di spingere la tua candidatura se ti schieri con lei.' },
  'alleanza-congressuale': { label: 'Alleanza di mozioni', pact: 'sostegno-congresso', from: 'actor', secretary: true, detail: 'Due aree propongono di presentarsi insieme al congresso.' },
  rinnovo: { label: 'Rinnovo di un accordo', pact: null, from: 'actor', secretary: null, detail: 'Un accordo sta per scadere: l’area chiede di rinnovarlo.' },
  'risorse-locali': { label: 'Risorse per il territorio', pact: null, from: 'cadre', secretary: true, detail: 'Un dirigente locale chiede mezzi per il suo comitato.' },
  'candidatura-locale': { label: 'Candidatura locale', pact: null, from: 'cadre', secretary: true, detail: 'Un dirigente locale chiede di essere candidato alle prossime elezioni.' },
  autonomia: { label: 'Autonomia del comitato', pact: null, from: 'cadre', secretary: true, detail: 'Un dirigente locale chiede mano libera sul suo comitato.' },
  fusione: { label: 'Proposta di fusione', pact: null, from: 'external', secretary: true, detail: 'Un’altra forza propone di unire liste e organizzazione.' },
  ricostruzione: { label: 'Piano di ricostruzione', pact: null, from: 'actor', secretary: true, detail: 'Il partito all’opposizione chiede una linea di ricostruzione.' }
});

// ---------- agreements ----------
export const PACT_KINDS = Object.freeze({
  'quote-liste': { label: 'Quota nelle liste', gives: 'una parte dei posti sicuri nelle liste', asks: 'lealtà in congresso e in Aula', weeks: 40, check: 'liste' },
  linea: { label: 'Linea del partito', gives: 'la linea politica dell’area', asks: 'sostegno alla segreteria', weeks: 26, check: 'linea' },
  programma: { label: 'Tema nel programma', gives: 'un tema del programma', asks: 'sostegno alla segreteria', weeks: 30, check: 'programma' },
  incarico: { label: 'Posto negli organi', gives: 'un seggio negli organi nazionali', asks: 'voti nelle decisioni della direzione', weeks: 40, check: 'incarico' },
  fondi: { label: 'Fondi ai territori', gives: 'un contributo ogni quattro settimane', asks: 'nessuna scissione e lealtà al voto', weeks: 24, check: 'fondi' },
  tregua: { label: 'Tregua interna', gives: 'nessuno scontro aperto', asks: 'niente attacchi e niente espulsioni', weeks: 16, check: 'tregua' },
  'sostegno-congresso': { label: 'Sostegno in congresso', gives: 'il tuo appoggio alla mozione dell’area', asks: 'delegati e un posto quando vince', weeks: 20, check: 'schieramento' }
});

// ---------- congress ----------
// The path from the balances of force to the leadership: each phase has its own work and its own decisions.
export const CONGRESS_PHASES = Object.freeze([
  { id: 'forza', label: 'Forza delle aree', weeks: 10, detail: 'Si misura il peso di ogni area: iscritti, quadri, comitati, risorse.' },
  { id: 'preparazione', label: 'Preparazione', weeks: 8, detail: 'Le aree mobilitano i quadri e aprono le federazioni ai loro candidati.' },
  { id: 'delegati', label: 'Elezione dei delegati', weeks: 6, detail: 'Le federazioni eleggono i delegati: contano iscritti, vitalità e chi guida il comitato.' },
  { id: 'alleanze', label: 'Alleanze', weeks: 5, detail: 'Le aree si cercano: chi corre insieme somma i delegati.' },
  { id: 'trattative', label: 'Trattative', weeks: 3, detail: 'Delegati in cambio di posti, linea e liste: ogni accordo pesa sul voto.' },
  { id: 'mozioni', label: 'Mozioni', weeks: 2, detail: 'Le aree depositano la loro mozione e il candidato alla segreteria.' },
  { id: 'voto', label: 'Voto', weeks: 0, detail: 'Il congresso vota: i delegati decidono la leadership.' }
]);
export const CONGRESS_DELEGATES = Object.freeze({ founder: 60, member: 240 });

// ---------- local leaders ----------
export const CADRE_INTERESTS = Object.freeze({
  seggio: { label: 'un seggio', detail: 'vuole essere candidato alle prossime elezioni' },
  risorse: { label: 'risorse', detail: 'vuole mezzi e sedi per il suo comitato' },
  autonomia: { label: 'autonomia', detail: 'vuole decidere da solo sul territorio' },
  incarico: { label: 'un incarico', detail: 'vuole un ruolo negli organi regionali o nazionali' }
});
export const CADRE_ACTIONS = Object.freeze({
  incontra: { label: 'Incontra il dirigente', cost: { ap: 1 }, detail: 'Un colloquio: lealtà su, malcontento giù. Funziona poco se ha già deciso.' },
  promuovi: { label: 'Promuovi il dirigente', cost: { capital: 2 }, detail: 'Un ruolo più alto: lealtà molto più alta, ma le altre aree si sentono scavalcate.' },
  sostituisci: { label: 'Sostituisci il dirigente', cost: { ap: 1, capital: 2 }, detail: 'Un nome nuovo, vicino a te: il comitato perde un po’ di organizzazione, l’area uscente protesta.' },
  recluta: { label: 'Recluta un dirigente locale', cost: { ap: 1, funds: 200 }, detail: 'Dà un volto e una struttura a un comitato senza guida: costa tempo, ma crea una base propria.' }
});

// ---------- rebuilding the party in opposition ----------
export const REBUILD_FOCUS = Object.freeze({
  territorio: { label: 'Ripartire dai territori', detail: 'Sedi, circoli e dirigenti locali: vitalità e iscritti salgono piano.', weekly: { vitality: 1.6, members: 0.003 } },
  quadri: { label: 'Formare i quadri', detail: 'Scuola di partito e dirigenti nuovi: più militanti e meno fughe.', weekly: { militants: 0.004, loyalty: 0.8 } },
  identita: { label: 'Ritrovare l’identità', detail: 'Programma e linea chiari: coesione e sostegno interno in crescita.', weekly: { cohesion: 0.9, support: 0.25 } },
  finanze: { label: 'Rimettere a posto i conti', detail: 'Tagli, tesseramento e sottoscrizioni: la tesoreria si risolleva.', weekly: { treasury: 260 } }
});
export const REBUILD_WEEKS = 26;

// ---------- the identity of the party ----------
export const RENAME_STYLES = Object.freeze({
  restyling: { label: 'Restyling', detail: 'Nome e simbolo si rinnovano senza cambiare identità: poco rischio, poco effetto.', shock: 0.15, renewal: 0.1 },
  rilancio: { label: 'Rilancio', detail: 'Nuovo nome e nuova promessa: gli elettori lo notano, i militanti si dividono.', shock: 0.45, renewal: 0.35 },
  rifondazione: { label: 'Rifondazione', detail: 'Un partito nuovo con una storia vecchia: scossa forte, nuova partenza.', shock: 0.9, renewal: 0.7 }
});
// The names a splinter group gives itself (generic: they never stand for a real party).
export const SPLINTER_NAMES = Object.freeze({ riformisti: 'Riformisti Uniti', territori: 'Autonomie e Territori', movimento: 'Movimento Civico' });
export const SPLIT_RULES = Object.freeze({ minStrength: 14, maxLoyalty: 30, minGrievance: 75, ultimatumWeeks: 4, cooldownWeeks: 104 });
// New areas that are born inside a party that has lost some (a young generation, a civic wing…).
export const EMERGING_AREAS = Object.freeze(['Area civica', 'Area dei giovani', 'Area liberale', 'Area laburista', 'Area ambientalista']);
export const MERGE_RULES = Object.freeze({ minTie: 25, maxAxisGap: 1.6 });

// ---------- memory kinds introduced by the internal life ----------
export const LIFE_MEMORY_KINDS = Object.freeze({
  'accordo-partito': { label: 'Accordo interno', tone: 'good' },
  'richiesta-respinta': { label: 'Richiesta respinta', tone: 'bad' },
  'accordo-rotto': { label: 'Accordo interno rotto', tone: 'bad' },
  congresso: { label: 'Congresso', tone: 'neutral' },
  scissione: { label: 'Scissione', tone: 'bad' },
  fondazione: { label: 'Fondazione di un partito', tone: 'good' },
  fusione: { label: 'Fusione', tone: 'neutral' },
  'cambio-nome': { label: 'Cambio di nome', tone: 'neutral' },
  ricostruzione: { label: 'Ricostruzione del partito', tone: 'good' },
  'quadro-perso': { label: 'Dirigente locale perso', tone: 'bad' }
});

// ---------- the decisions that come out of the internal life (situation events) ----------
const requestChoices = [
  { id: 'accetta', label: 'Accetta: {acceptLabel}', special: 'life-accept' },
  { id: 'tratta', label: 'Tratta le condizioni', cost: { capital: 1 }, special: 'life-negotiate' },
  { id: 'rifiuta', label: 'Rifiuta', special: 'life-refuse' },
  { id: 'tempo', label: 'Prendi tempo', special: 'life-delay' }
];
export const LIFE_SITUATIONS = Object.freeze({
  'richiesta-partito': { id: 'richiesta-partito', title: '{title}', body: '{body}', defaultChoice: 'tempo', choices: requestChoices },
  'controfferta-partito': { id: 'controfferta-partito', title: 'Controfferta: {title}', body: '{body}', defaultChoice: 'tempo', choices: [
    { id: 'accetta', label: 'Accetta la controfferta: {acceptLabel}', special: 'life-accept-counter' },
    { id: 'rifiuta', label: 'Rifiuta', special: 'life-refuse' },
    { id: 'tempo', label: 'Prendi tempo', special: 'life-delay' }] },
  'ultimatum-partito': { id: 'ultimatum-partito', title: '{title}', body: '{body}', defaultChoice: 'tempo', choices: [
    { id: 'accetta', label: 'Cedi: {acceptLabel}', special: 'life-accept' },
    { id: 'tratta', label: 'Tratta per evitare la rottura', cost: { capital: 3 }, special: 'life-negotiate' },
    { id: 'sfida', label: 'Chiama il bluff', special: 'life-refuse' },
    { id: 'tempo', label: 'Prendi tempo', special: 'life-delay' }] },
  'scissione-partito': { id: 'scissione-partito', title: '{title}', body: '{body}', defaultChoice: 'resta', choices: [
    { id: 'segui', label: 'Segui {current} e fonda il nuovo partito', cost: { capital: 4 }, special: 'life-split-follow', requires: 'party' },
    { id: 'tratta', label: 'Prova a trattenerli', cost: { capital: 3 }, special: 'life-split-hold' },
    { id: 'resta', label: 'Resta nel partito', special: 'life-split-stay' }] },
  'scissione-subita': { id: 'scissione-subita', title: '{title}', body: '{body}', defaultChoice: 'resta', choices: [
    { id: 'tratta', label: 'Prova a trattenerli', cost: { capital: 3 }, special: 'life-split-hold' },
    { id: 'resta', label: 'Lascia che se ne vadano', special: 'life-split-stay' }] },
  'dirigente-lascia': { id: 'dirigente-lascia', title: '{title}', body: '{body}', defaultChoice: 'lascia', choices: [
    { id: 'trattieni', label: 'Offri un incarico per trattenerlo', cost: { capital: 2 }, special: 'life-cadre-keep' },
    { id: 'incontra', label: 'Incontralo di persona', cost: { ap: 1 }, special: 'life-cadre-meet' },
    { id: 'lascia', label: 'Lascialo andare', special: 'life-cadre-leave' }] },
  'ricostruzione-partito': { id: 'ricostruzione-partito', title: 'Il partito all’opposizione: da dove si riparte?', body: 'Dopo la sconfitta le sezioni si svuotano e le correnti si guardano in cagnesco. Si può avviare un piano di ricostruzione di sei mesi: scegli su cosa puntare.', defaultChoice: 'rinvia', choices: [
    { id: 'territorio', label: 'Ripartire dai territori', cost: { capital: 2 }, special: 'life-rebuild-territorio' },
    { id: 'quadri', label: 'Formare i quadri', cost: { capital: 2 }, special: 'life-rebuild-quadri' },
    { id: 'identita', label: 'Ritrovare l’identità', cost: { capital: 2 }, special: 'life-rebuild-identita' },
    { id: 'finanze', label: 'Rimettere a posto i conti', cost: { capital: 2 }, special: 'life-rebuild-finanze' },
    { id: 'rinvia', label: 'Rinvia', effects: { org: { cohesion: -1 } } }] },
  'congresso-fase': { id: 'congresso-fase', title: 'Congresso: {phaseLabel}', body: '{body}', defaultChoice: 'osserva', choices: [
    { id: 'mobilita', label: 'Mobilita i tuoi quadri', cost: { ap: 1 }, special: 'life-congress-mobilize' },
    { id: 'trama', label: 'Lavora alle alleanze', cost: { capital: 2 }, special: 'life-congress-ally' },
    { id: 'osserva', label: 'Resta alla finestra', effects: {} }] }
});
