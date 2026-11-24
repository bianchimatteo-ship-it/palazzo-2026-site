// The avatar of the player's politician: a small structured object (`avatar`) kept in the canonical record of the character, next to (and never mixed with) `gender`.
// Here only the data: the options, the stable default, the check and the cleaning of a stored value. The drawing is in ui/avatar-svg.js.
// The order of the fields is the order of the signature of an avatar (data-avatar); the old seven come first and the new ones are added after them, so that an avatar saved before is still a prefix.
export const AVATAR_FIELDS = Object.freeze(['face', 'skin', 'hair', 'hairstyle', 'beard', 'glasses', 'jacket', 'eyes', 'expression', 'moustache']);
// The order in which the editor shows them.
export const AVATAR_GROUPS = Object.freeze(['face', 'expression', 'skin', 'eyes', 'hair', 'hairstyle', 'beard', 'moustache', 'glasses', 'jacket']);
const option = (id, label, extra = {}) => Object.freeze({ id, label, ...extra });
export const AVATAR_OPTIONS = Object.freeze({
  face: Object.freeze([option('maschile', 'Maschile'), option('femminile', 'Femminile')]),
  skin: Object.freeze([option('porcellana', 'Pelle porcellana', { color: '#f6d9c1' }), option('chiara', 'Pelle chiara', { color: '#ebbf98' }), option('oliva', 'Pelle oliva', { color: '#cf9c6c' }), option('bruna', 'Pelle bruna', { color: '#a26b43' }), option('scura', 'Pelle scura', { color: '#6d4429' })]),
  hair: Object.freeze([option('nero', 'Capelli neri', { color: '#17110f' }), option('castano', 'Capelli castani', { color: '#5a3a24' }), option('biondo', 'Capelli biondi', { color: '#d9ac5c' }), option('rosso', 'Capelli rossi', { color: '#a4421f' }), option('grigio', 'Capelli grigi', { color: '#aeb0b4' })]),
  hairstyle: Object.freeze([option('corto', 'Corto'), option('riga', 'Con la riga'), option('riccio', 'Riccio'), option('caschetto', 'Caschetto'), option('lungo', 'Lungo'), option('raccolto', 'Raccolto'), option('stempiato', 'Stempiato'),
    option('rasato', 'Rasato'), option('afro', 'Afro'), option('codino', 'Codino'), option('frangia', 'Con la frangia'), option('ondulato', 'Ondulato'),
    // added later (the old ids never change): fades, quiffs, a mohawk, locks and braids
    option('sfumato', 'Sfumato'), option('undercut', 'Undercut'), option('ciuffo', 'Ciuffo laterale'), option('indietro', 'All’indietro'), option('cresta', 'Cresta'), option('dreadlocks', 'Dreadlocks'), option('treccine', 'Treccine')]),
  beard: Object.freeze([option('nessuna', 'Senza barba'), option('corta', 'Corta'), option('completa', 'Completa'), option('tregiorni', 'Di tre giorni'), option('pizzetto', 'Pizzetto'), option('lunga', 'Lunga'), option('basette', 'Basette'), option('collare', 'Collare')]),
  glasses: Object.freeze([option('nessuno', 'Senza occhiali'), option('tondi', 'Tondi'), option('rettangolari', 'Rettangolari')]),
  jacket: Object.freeze([option('blu', 'Giacca blu notte', { color: '#1d2f55' }), option('bordeaux', 'Giacca bordeaux', { color: '#5e1f2b' }), option('verde', 'Giacca verde bosco', { color: '#1d4a37' }), option('antracite', 'Giacca antracite', { color: '#33363d' }),
    option('nera', 'Giacca nera', { color: '#15171c' }), option('cammello', 'Giacca cammello', { color: '#8a6a43' }), option('prugna', 'Giacca prugna', { color: '#4a2a4a' }), option('petrolio', 'Giacca petrolio', { color: '#1f5b66' })]),
  eyes: Object.freeze([option('marroni', 'Occhi marroni', { color: '#4a2f1d' }), option('nocciola', 'Occhi nocciola', { color: '#9a6b2c' }), option('verdi', 'Occhi verdi', { color: '#3f8a58' }), option('azzurri', 'Occhi azzurri', { color: '#4f8fd4' }), option('grigi', 'Occhi grigi', { color: '#8a949e' })]),
  expression: Object.freeze([option('serena', 'Serena'), option('sorridente', 'Sorridente'), option('determinata', 'Determinata')]),
  moustache: Object.freeze([option('nessuno', 'Senza baffi'), option('sottili', 'Baffi sottili'), option('classici', 'Baffi classici'), option('folti', 'Baffi folti'), option('manubrio', 'Baffi a manubrio'), option('matita', 'Baffi a matita'), option('spazzola', 'Baffi a spazzola'), option('ferro', 'Baffi a ferro di cavallo'), option('chevron', 'Baffi chevron')])
});
export const AVATAR_LABELS = Object.freeze({ face: 'Volto', skin: 'Carnagione', hair: 'Capelli', hairstyle: 'Acconciatura', beard: 'Barba', glasses: 'Occhiali', jacket: 'Giacca', eyes: 'Colore degli occhi', expression: 'Espressione', moustache: 'Baffi' });
// The proportions of the face (sliders in the editor): six small integers, each from -3 to 3 (0 = the drawing as it always was). An avatar saved before them has none and is drawn exactly as before; one with
// all zeros is saved without them. The limits keep every feature inside the face, whatever the combination.
export const SHAPE_FIELDS = Object.freeze(['w', 'j', 'd', 's', 'b', 'm']);
export const SHAPE_LABELS = Object.freeze({ w: 'Larghezza del volto', j: 'Lunghezza del mento', d: 'Distanza degli occhi', s: 'Grandezza degli occhi', b: 'Altezza delle sopracciglia', m: 'Larghezza della bocca' });
export const SHAPE_LIMIT = 3;
export const normalizeShape = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = Object.fromEntries(SHAPE_FIELDS.map(field => [field, Math.max(-SHAPE_LIMIT, Math.min(SHAPE_LIMIT, Math.round(Number(value[field]) || 0)))]));
  return SHAPE_FIELDS.some(field => out[field] !== 0) ? out : null;
};
const IDS = Object.fromEntries(AVATAR_FIELDS.map(field => [field, new Set(AVATAR_OPTIONS[field].map(item => item.id))]));

// What a new character starts with (the avatar is not derived from the gender: both are chosen on their own).
export const DEFAULT_AVATAR = Object.freeze({ face: 'maschile', skin: 'chiara', hair: 'castano', hairstyle: 'corto', beard: 'nessuna', glasses: 'nessuno', jacket: 'blu', eyes: 'marroni', expression: 'serena', moustache: 'nessuno' });

const hashText = value => [...String(value)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261) >>> 0;
// The look of a career that was made before avatars: always the same for the same character (from its id), without beard, moustache or glasses.
export function defaultAvatarFor(seed) {
  const h = hashText(seed ?? 'giocatore');
  const pick = (field, shift) => AVATAR_OPTIONS[field][((h >>> shift) + (h >>> (shift + 7))) % AVATAR_OPTIONS[field].length].id;
  return { ...DEFAULT_AVATAR, face: pick('face', 1), skin: pick('skin', 3), hair: pick('hair', 5), hairstyle: pick('hairstyle', 9), jacket: pick('jacket', 13) };
}

export const isValidAvatar = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value) && AVATAR_FIELDS.every(field => IDS[field].has(value[field]));
// A stored value made safe: every field is one of the known options (the others fall back to the default), nothing else is kept.
export const normalizeAvatar = (value, fallback = DEFAULT_AVATAR) => {
  const base = Object.fromEntries(AVATAR_FIELDS.map(field => [field, value && IDS[field].has(value[field]) ? value[field] : fallback[field]]));
  const shape = normalizeShape(value?.shape);
  return shape ? { ...base, shape } : base;
};
// The avatar to show for a politician record: its own (an avatar saved before the new traits keeps what it had; a trait that no longer exists, such as the old neutral face, and a missing one
// take the stable default of the character), or the stable default of a career made before avatars.
// A random look: every trait is drawn from its own options with the generator given (Math.random in the wizard, a seeded one in the tests). The face (masculine or feminine) is drawn too; beard and moustache
// are drawn for the masculine face only (a choice of this generator, not a rule of the drawings), glasses one time in four. The proportions of the face stay as they are (the sliders are the player's own choice).
// `gender` (the one chosen in the wizard: 'uomo' / 'donna', also 'maschile' / 'femminile'): the face follows it, the other traits stay random; with another or no value the face is drawn too.
const FACE_OF_GENDER = Object.freeze({ uomo: 'maschile', maschile: 'maschile', donna: 'femminile', femminile: 'femminile' });
export function randomAvatar(rand = Math.random, { keepShape = null, gender = null } = {}) {
  const pick = field => AVATAR_OPTIONS[field][Math.min(AVATAR_OPTIONS[field].length - 1, Math.floor(rand() * AVATAR_OPTIONS[field].length))].id;
  const drawn = pick('face');
  const face = FACE_OF_GENDER[String(gender ?? '').toLowerCase()] ?? drawn;
  const masculine = face === 'maschile';
  const beard = masculine && rand() < 0.4 ? pick('beard') : 'nessuna';
  const moustache = masculine && beard === 'nessuna' && rand() < 0.2 ? pick('moustache') : 'nessuno';
  const glasses = rand() < 0.25 ? AVATAR_OPTIONS.glasses[1 + Math.floor(rand() * (AVATAR_OPTIONS.glasses.length - 1))].id : 'nessuno';
  const hairstyle = pick('hairstyle');
  // a receding hairline is a masculine style: for a feminine face the next style of the list is taken (the variety stays)
  const hairs = AVATAR_OPTIONS.hairstyle, hairstyleId = face === 'femminile' && hairstyle === 'stempiato' ? hairs[(hairs.findIndex(item => item.id === hairstyle) + 1) % hairs.length].id : hairstyle;
  const out = { face, skin: pick('skin'), hair: pick('hair'), hairstyle: hairstyleId, beard, glasses, jacket: pick('jacket'), eyes: pick('eyes'), expression: pick('expression'), moustache };
  return normalizeAvatar(keepShape ? { ...out, shape: keepShape } : out);
}
// The look of a person of a given gender: the face follows the gender, and what the drawings give only to a masculine face (a beard, a moustache, the receding hairline) is taken off a feminine one;
// everything else the player or the game chose (skin, hair and its colour, eyes, glasses, jacket, expression, proportions) stays as it is. With no gender known the avatar stays as it is: no feature is
// attributed to a person whose gender the data do not give.
export function avatarForGender(value, gender) {
  const face = FACE_OF_GENDER[String(gender ?? '').toLowerCase()] ?? null;
  const avatar = normalizeAvatar(value);
  if (!face) return avatar;
  const out = { ...avatar, face };
  if (face === 'femminile') {
    out.beard = 'nessuna'; out.moustache = 'nessuno';
    if (out.hairstyle === 'stempiato') { const hairs = AVATAR_OPTIONS.hairstyle; out.hairstyle = hairs[(hairs.findIndex(item => item.id === 'stempiato') + 1) % hairs.length].id; }
  }
  return out;
}
// The gender a record states (the player's choice in the wizard, the data of a simulated person): the explicit field only; a real politician whose verified data give no gender has none here.
export const statedGender = person => person?.legacyGender ? null : FACE_OF_GENDER[String(person?.gender ?? '').toLowerCase()] ?? null;
// The avatar of a politician record: its own, or the stable default of the character; the base follows the gender the record states.
export const avatarOf = player => player ? avatarForGender(player.avatar && typeof player.avatar === 'object' && !Array.isArray(player.avatar) ? normalizeAvatar(player.avatar, defaultAvatarFor(player.id)) : defaultAvatarFor(player.id), statedGender(player)) : { ...DEFAULT_AVATAR };
// A value given with a wrong trait is refused; a missing trait is not a problem (it is completed with the default one).
const shapeOk = value => value?.shape == null || (typeof value.shape === 'object' && !Array.isArray(value.shape) && Object.keys(value.shape).every(key => SHAPE_FIELDS.includes(key) && Number.isInteger(value.shape[key]) && Math.abs(value.shape[key]) <= SHAPE_LIMIT));
export const avatarProblems = value => value == null || (typeof value === 'object' && !Array.isArray(value) && AVATAR_FIELDS.every(field => !(field in value) || IDS[field].has(value[field])) && shapeOk(value)) ? [] : ['Scegli un aspetto valido per l’avatar.'];

// ---------- the gender of the characters of the scenes (written in the data) ----------
// The gender of the people of the scenes, written in the data (not left to chance and not drawn from a hash): every invented character (a guest, a host, a rival the game makes up, a scrutineer) has an explicit
// gender, and the avatar follows it. Three tables:
//   · FIRST_NAMES  – the first names the game uses, each with its gender;
//   · ROLE_GENDER  – the roles of the guests (the Italian label as shown), when the grammar of the role fixes the gender («Ministra», «Delegato», «Una maestra»); `x` = the role can be held by anyone;
//   · the real politicians of the database carry no gender (the field is empty in the verified data): for them the first name is the only evidence, and the character says so (`genderSource: 'nome'`).
// The player is never touched: the gender and the look chosen at the start stay as they are (they are saved in the career).
export const M = 'maschile', F = 'femminile';
const list = (gender, text) => Object.fromEntries(text.split(/\s+/).filter(Boolean).map(name => [name, gender]));
export const FIRST_NAMES = Object.freeze({
  ...list(M, `Marco Luca Andrea Paolo Giorgio Stefano Roberto Davide Matteo Fabio Claudio Enrico Sergio Alberto Franco Daniele Antonio Corrado Edoardo Elio Enzo Giacomo Ivan Massimo Mario Piero Renato Riccardo Salvatore Simone
    Tommaso Vittorio Ludovico Giuseppe Giovanni Francesco Carlo Pietro Alessandro Michele Nicola Gianluca Maurizio Fabrizio Flavio Raffaele Vincenzo Domenico Emilio Lorenzo Federico Filippo Gabriele Leonardo Mattia Samuele
    Cesare Ettore Fausto Guido Ignazio Lamberto Leone Livio Manuel Marcello Mauro Nunzio Orazio Osvaldo Pasquale Rocco Romano Rosario Saverio Silvano Tullio Umberto Valerio Walter Gianni Gino Bruno Aldo Dario Gianfranco Ugo`),
  ...list(F, `Elena Chiara Giulia Francesca Laura Marta Silvia Paola Anna Sara Federica Monica Cristina Valentina Irene Barbara Daniela Elisa Lucia Livia Matilde Noemi Rossella Valeria Ilaria Alessia Beatrice Bianca Carla Caterina
    Claudia Eleonora Emanuela Erica Giada Giorgia Ginevra Giovanna Giuliana Letizia Lidia Loredana Lorena Manuela Margherita Maria Martina Michela Nadia Nicoletta Patrizia Raffaella Roberta Rosa Simona Stefania Teresa Tiziana
    Vanessa Veronica Viola Alice Aurora Camilla Elly Emma Greta Ludovica Mara Marina Morena Paola Sabrina Serena Sofia Susanna Vittoria Wanda Debora Donatella Fiorella Gabriella Gianna Luisa Miriam Oriana Rita Tania`)
});
export const TITLES = Object.freeze({ 'Prof.': null, 'Dott.': M, 'Dott.ssa': F, 'Avv.': null, 'Ing.': null, 'Sig.': M, 'Sig.ra': F, 'On.': null, 'Sen.': null });
const stripTitle = name => String(name ?? '').trim().replace(/^(Prof\.|Dott\.ssa|Dott\.|Avv\.|Ing\.|Sig\.ra|Sig\.|On\.|Sen\.)\s+/, '');
// The gender of a person from the data: the explicit `gender` field first (when it is one of the two), then the title («Dott.ssa»), then the table of the first names. null when nothing says it.
export function genderOf(person) {
  const explicit = String(person?.gender ?? '').toLowerCase();
  if (['maschile', 'm', 'uomo', 'male'].includes(explicit)) return M;
  if (['femminile', 'f', 'donna', 'female'].includes(explicit)) return F;
  const name = String(person?.name ?? person?.fullName ?? person?.displayName ?? '').trim();
  const title = name.match(/^(Prof\.|Dott\.ssa|Dott\.|Avv\.|Ing\.|Sig\.ra|Sig\.|On\.|Sen\.)\s/)?.[1];
  if (title && TITLES[title]) return TITLES[title];
  return FIRST_NAMES[stripTitle(name).split(/\s+/)[0]] ?? null;
}
export const firstNameKnown = name => Boolean(FIRST_NAMES[stripTitle(name).split(/\s+/)[0]]);

// The roles of the guests whose grammar fixes the gender. The label is the Italian one as it is shown; everything not listed is `x` (anyone: «Presidente del comitato», «Portavoce», «Responsabile»…).
const roles = (gender, text) => Object.fromEntries(text.split('\n').map(line => line.trim()).filter(Boolean).map(line => [line, gender]));
export const ROLE_GENDER = Object.freeze({
  ...roles(F, `Dirigente scolastica
Delegata dei giovani
Direttrice del quotidiano
Ministra per i rapporti con il Parlamento
Ministra per gli Affari europei
Ministra per le Riforme
Una madre con due bambini piccoli
Un’operaia pendolare
Una maestra di scuola elementare
Una commerciante del quartiere
Una ragazza dei comitati per il clima
Una lavoratrice precaria
Dott.ssa Irene Bassi`),
  ...roles(M, `Medico di base del quartiere
Delegato del sindacato degli inquilini
Delegato sindacale
Direttore dei lavori
Delegato sindacale dei lavoratori
Direttore tecnico dell’impresa
Ragioniere dell’ente appaltante
Comandante della polizia locale
Ingegnere collaudatore
Capocantiere
Funzionario della soprintendenza
Segretario di sezione
Tesoriere della sezione
Militante storico
Direttore generale di un’azienda sanitaria
Geologo del dipartimento di protezione civile
Commercialista esperto in partite IVA
Caporedattore economia
Caporedattore della cronaca locale
Caposervizio politica
Ministro dell’Economia
Ministro del Lavoro
Ministro dell’Interno
Ministro degli Esteri
Ministro delle Infrastrutture
Sottosegretario alla Presidenza
Un pensionato in lista d’attesa
Uno studente delle superiori
Un padre di due alunni
Un anziano con lo sfratto in corso
Un residente di via Mazzini
Un contadino della zona
Un artigiano con la bottega in difficoltà`)
});
// The gender a role asks for: 'maschile' | 'femminile' | null (anyone). A role the table does not know is anyone's.
export const roleGender = label => ROLE_GENDER[String(label ?? '').trim()] ?? null;

// Names to fall back on when the pool of a scene has no one of the gender the role asks for: complete names, each with its gender.
export const EXTRA_NAMES = Object.freeze({
  [M]: Object.freeze(['Gianni Moretti', 'Roberto Salvi', 'Carlo Benedetti', 'Nicola Ferri', 'Fabrizio Ruggeri', 'Lorenzo Gallo', 'Emilio Sartori', 'Davide Monti']),
  [F]: Object.freeze(['Paola Ricci', 'Monica Galli', 'Alessia Conte', 'Beatrice Fabbri', 'Roberta Mazza', 'Elena Sorrentino', 'Teresa Lombardo', 'Simona Costa'])
});
