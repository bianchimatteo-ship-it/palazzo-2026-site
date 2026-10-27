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
    option('rasato', 'Rasato'), option('afro', 'Afro'), option('codino', 'Codino'), option('frangia', 'Con la frangia'), option('ondulato', 'Ondulato')]),
  beard: Object.freeze([option('nessuna', 'Senza barba'), option('corta', 'Corta'), option('completa', 'Completa')]),
  glasses: Object.freeze([option('nessuno', 'Senza occhiali'), option('tondi', 'Tondi'), option('rettangolari', 'Rettangolari')]),
  jacket: Object.freeze([option('blu', 'Giacca blu notte', { color: '#1d2f55' }), option('bordeaux', 'Giacca bordeaux', { color: '#5e1f2b' }), option('verde', 'Giacca verde bosco', { color: '#1d4a37' }), option('antracite', 'Giacca antracite', { color: '#33363d' }),
    option('nera', 'Giacca nera', { color: '#15171c' }), option('cammello', 'Giacca cammello', { color: '#8a6a43' }), option('prugna', 'Giacca prugna', { color: '#4a2a4a' }), option('petrolio', 'Giacca petrolio', { color: '#1f5b66' })]),
  eyes: Object.freeze([option('marroni', 'Occhi marroni', { color: '#4a2f1d' }), option('nocciola', 'Occhi nocciola', { color: '#9a6b2c' }), option('verdi', 'Occhi verdi', { color: '#3f8a58' }), option('azzurri', 'Occhi azzurri', { color: '#4f8fd4' }), option('grigi', 'Occhi grigi', { color: '#8a949e' })]),
  expression: Object.freeze([option('serena', 'Serena'), option('sorridente', 'Sorridente'), option('determinata', 'Determinata')]),
  moustache: Object.freeze([option('nessuno', 'Senza baffi'), option('sottili', 'Baffi sottili'), option('classici', 'Baffi classici'), option('folti', 'Baffi folti'), option('manubrio', 'Baffi a manubrio')])
});
export const AVATAR_LABELS = Object.freeze({ face: 'Volto', skin: 'Carnagione', hair: 'Capelli', hairstyle: 'Acconciatura', beard: 'Barba', glasses: 'Occhiali', jacket: 'Giacca', eyes: 'Colore degli occhi', expression: 'Espressione', moustache: 'Baffi' });
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
export const normalizeAvatar = (value, fallback = DEFAULT_AVATAR) => Object.fromEntries(AVATAR_FIELDS.map(field => [field, value && IDS[field].has(value[field]) ? value[field] : fallback[field]]));
// The avatar to show for a politician record: its own (an avatar saved before the new traits keeps what it had; a trait that no longer exists, such as the old neutral face, and a missing one
// take the stable default of the character), or the stable default of a career made before avatars.
export const avatarOf = player => player ? (player.avatar && typeof player.avatar === 'object' && !Array.isArray(player.avatar) ? normalizeAvatar(player.avatar, defaultAvatarFor(player.id)) : defaultAvatarFor(player.id)) : { ...DEFAULT_AVATAR };
// A value given with a wrong trait is refused; a missing trait is not a problem (it is completed with the default one).
export const avatarProblems = value => value == null || (typeof value === 'object' && !Array.isArray(value) && AVATAR_FIELDS.every(field => !(field in value) || IDS[field].has(value[field]))) ? [] : ['Scegli un aspetto valido per l’avatar.'];
