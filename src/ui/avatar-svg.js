// The avatar of the player, drawn as one local SVG from the chosen traits: no library, no request, no remote image. The same renderer draws it in the wizard (live preview), in the profile, in the
// headquarters and in the Parliament, so that the player is the same face everywhere. The input is always cleaned first (an unknown value falls back to the default).
import { AVATAR_FIELDS, AVATAR_OPTIONS, SHAPE_FIELDS, normalizeAvatar } from '../core/avatar.js?v=20261110-1';

const colorOf = (field, id) => AVATAR_OPTIONS[field].find(item => item.id === id)?.color ?? '#888888';
// A colour made lighter (amount > 0) or darker (amount < 0).
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = channel => Math.max(0, Math.min(255, Math.round(amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map(mix).map(value => value.toString(16).padStart(2, '0')).join('')}`;
}
const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The head: a squarer jaw or a softer chin (viewBox 120 × 120, face centred on x = 60).
const HEADS = {
  maschile: 'M39 50C39 32 49 24 60 24C71 24 81 32 81 50L81 60C81 74 72 84 60 84C48 84 39 74 39 60Z',
  femminile: 'M41 50C41 32 49 24 60 24C71 24 79 32 79 50C79 68 70 86 60 86C50 86 41 68 41 50Z'
};
// The hair behind the head (long and bob styles, the bun) and the hair on top of it.
const HAIR_BACK = {
  caschetto: 'M35 54C32 28 47 17 60 17C73 17 88 28 85 54L85 78C85 84 80 86 76 85L76 58L44 58L44 85C40 86 35 84 35 78Z',
  lungo: 'M34 56C31 27 47 16 60 16C73 16 89 27 86 56L90 104L74 104L74 64L46 64L46 104L30 104Z',
  raccolto: '<circle cx="60" cy="17" r="9.5"/>',
  afro: '<circle cx="60" cy="36" r="28"/>',
  codino: 'M76 30C94 30 100 52 90 70C88 58 86 48 77 41Z',
  ondulato: 'M35 54C32 26 47 16 60 16C73 16 88 26 85 54C87 64 91 70 85 78C80 74 79 66 76 60L44 60C41 66 40 74 35 78C29 70 33 64 35 54Z',
  // locks that hang behind the head and the shoulders
  dreadlocks: '<path d="M36 52C31 70 31 92 35 108L41.5 108C39.5 90 40 70 43 56Z M84 52C89 70 89 92 85 108L78.5 108C80.5 90 80 70 77 56Z M43 44C40 62 40 84 43 102L48.5 102C47 84 47 64 49 48Z M77 44C80 62 80 84 77 102L71.5 102C73 84 73 64 71 48Z"/><path d="M33 78H40M33 92H39M80 78H87M81 92H87M41 70H47M41 86H47M73 70H79M73 86H79" stroke="rgba(0,0,0,.35)" stroke-width="1.1"/>',
  treccine: '<path d="M40 56C35 74 35 92 39 108L46 108C44 92 44 74 46 60Z M80 56C85 74 85 92 81 108L74 108C76 92 76 74 74 60Z"/><path d="M36.5 68H45M36 78H45M36 88H44.5M37 98H45.5M75 68H83.5M75 78H84M75.5 88H84M74.5 98H83" stroke="rgba(0,0,0,.4)" stroke-width="1.2"/>'
};
const HAIR_FRONT = {
  corto: 'M38 50C36 29 48 19 60 19C72 19 84 29 82 50C80 41 74 34 60 33C46 34 40 41 38 50Z',
  riga: 'M38 52C35 28 50 17 63 18C76 19 85 30 82 52C80 43 77 37 71 34C63 39 49 38 43 44C40 46 39 49 38 52Z',
  riccio: '<circle cx="41" cy="38" r="9"/><circle cx="50" cy="28" r="9.5"/><circle cx="61" cy="25" r="10"/><circle cx="72" cy="28" r="9.5"/><circle cx="80" cy="38" r="9"/><circle cx="38" cy="50" r="6.5"/><circle cx="82" cy="50" r="6.5"/>',
  caschetto: 'M39 50C40 31 50 24 60 24C70 24 80 31 81 50C74 40 68 35 60 35C52 35 46 40 39 50Z',
  lungo: 'M39 52C38 31 49 22 60 22C71 22 82 31 81 52C79 42 72 34 60 33C51 33 43 40 39 52Z',
  raccolto: 'M38 50C36 29 48 20 60 20C72 20 84 29 82 50C80 40 73 35 60 34C47 35 40 40 38 50Z',
  stempiato: 'M38 52C37 42 40 35 45 32C43 38 43 45 44 52Z M82 52C83 42 80 35 75 32C77 38 77 45 76 52Z M46 29C52 23 68 23 74 29C68 27 52 27 46 29Z',
  rasato: 'M39.5 46C39 31 49 23 60 23C71 23 81 31 80.5 46C78 36 71 30 60 30C49 30 42 36 39.5 46Z',
  afro: 'M41 49C41 36 49 30 60 30C71 30 79 36 79 49C76 41 70 37 60 37C50 37 44 41 41 49Z',
  codino: 'M38 50C36 29 48 20 60 20C72 20 84 29 82 50C80 40 73 35 60 34C47 35 40 40 38 50Z',
  frangia: 'M38 50C36 28 48 18 60 18C72 18 84 28 82 50L80 41C70 37 50 37 40 41Z',
  ondulato: 'M38 52C36 28 50 17 62 18C75 19 85 30 82 52C79 42 74 37 68 40C64 33 58 38 54 35C48 36 42 42 38 52Z',
  // a faded cut: volume on top, the sides shaved (a lighter layer)
  sfumato: '<path d="M41 45C40 30 50 20 61 20C72 20 81 28 79 45C78 38 74 33 70 31C62 28 52 29 47 34C44 37 42 41 41 45Z"/><path d="M38.6 53C37.4 42 39 35 42.5 31L44.5 45C43.5 48 42.5 51 42 55Z M81.4 53C82.6 42 81 35 77.5 31L75.5 45C76.5 48 77.5 51 78 55Z" opacity=".34"/>',
  undercut: '<path d="M44 41C43 28 51 20 60 20C70 20 78 27 76 41C74 35 68 31 60 31C52 31 46 35 44 41Z"/><path d="M38.8 53C37.6 42 40 35 44 32L45 46L43 55Z M81.2 53C82.4 42 80 35 76 32L75 46L77 55Z" opacity=".3"/>',
  ciuffo: '<path d="M38 51C35 30 48 19 63 18C78 18 86 29 82 51C80 43 78 37 72 34C66 29 54 30 48 34C42 38 39 44 38 51Z"/><path d="M47 34C45 22 56 14 69 16C79 18 82 27 79 35C77 29 71 25 63 25C56 25 50 28 47 34Z"/>',
  indietro: '<path d="M39 49C37 30 49 20 60 20C71 20 83 30 81 49C79 41 74 34 66 31C58 29.5 48 33 45 38C42 41 40 44 39 49Z"/><path d="M49 26C55 23.4 66 23.4 72 28M45 31C52 27.4 68 27.4 77 33" stroke="rgba(0,0,0,.28)" stroke-width="1" fill="none"/>',
  cresta: '<path d="M53.4 31C51 17 55 10 60 9C65 10 69 17 66.6 31C64 27 56 27 53.4 31Z"/><path d="M41 45C41 35 49 29 60 29C71 29 79 35 79 45C76 39 69 35 60 35C51 35 44 39 41 45Z" opacity=".26"/>',
  dreadlocks: 'M38 50C36 29 48 19 60 19C72 19 84 29 82 50C80 41 74 34 60 33C46 34 40 41 38 50Z',
  treccine: 'M38 50C36 29 48 19 60 19C72 19 84 29 82 50C80 41 74 34 66 33L60 27.5L54 33C46 34 40 41 38 50Z'
};

// The proportions of the face (core/avatar.js `shape`, six integers from -3 to 3; none = the drawing as it always was): how far each feature is moved or scaled. Every value is small and bounded.
const unitOf = shape => shape ? { dx: 0.7 * shape.d, eye: 1 + 0.07 * shape.s, brow: -0.6 * shape.b, mouth: 1 + 0.06 * shape.m, width: 1 + 0.028 * shape.w, chin: 1 + 0.025 * shape.j } : null;
const wrap = (content, transform) => transform ? `<g transform="${transform}">${content}</g>` : content;
const aboutX = (scale, x = 60) => `translate(${x} 0) scale(${scale.toFixed(3)} 1) translate(${-x} 0)`;
function eyes(face, ink, iris, u = null) {
  const lashL = face === 'femminile' ? `<path d="M46.5 52.6L44.6 50.8M49.5 51.6L48.8 49.2" stroke="${ink}" stroke-width="1" stroke-linecap="round" fill="none"/>` : '';
  const lashR = face === 'femminile' ? `<path d="M72.8 49.2L72.1 51.6M75.4 50.8L73.5 52.6" stroke="${ink}" stroke-width="1" stroke-linecap="round" fill="none"/>` : '';
  const left = `<ellipse cx="51.5" cy="54.2" rx="3.2" ry="2.5" fill="#fbf8f2"/><circle cx="51.8" cy="54.3" r="2.1" fill="${iris}"/><circle cx="51.8" cy="54.3" r="1" fill="#1b130d"/><circle cx="52.5" cy="53.5" r=".55" fill="#fff"/>${lashL}`;
  const right = `<ellipse cx="68.5" cy="54.2" rx="3.2" ry="2.5" fill="#fbf8f2"/><circle cx="68.2" cy="54.3" r="2.1" fill="${iris}"/><circle cx="68.2" cy="54.3" r="1" fill="#1b130d"/><circle cx="68.9" cy="53.5" r=".55" fill="#fff"/>${lashR}`;
  if (!u) return `<ellipse cx="51.5" cy="54.2" rx="3.2" ry="2.5" fill="#fbf8f2"/><ellipse cx="68.5" cy="54.2" rx="3.2" ry="2.5" fill="#fbf8f2"/><circle cx="51.8" cy="54.3" r="2.1" fill="${iris}"/><circle cx="68.2" cy="54.3" r="2.1" fill="${iris}"/><circle cx="51.8" cy="54.3" r="1" fill="#1b130d"/><circle cx="68.2" cy="54.3" r="1" fill="#1b130d"/><circle cx="52.5" cy="53.5" r=".55" fill="#fff"/><circle cx="68.9" cy="53.5" r=".55" fill="#fff"/>${lashL}${lashR}`;
  const eye = (content, cx, side) => wrap(content, `translate(${(side * u.dx).toFixed(2)} 0) translate(${cx} 54.2) scale(${u.eye.toFixed(3)}) translate(${-cx} -54.2)`);
  return eye(left, 51.5, -1) + eye(right, 68.5, 1);
}
// The eyebrows follow the face and the expression (raised when smiling, lowered and angled when determined).
function brows(face, expression, color, u = null) {
  const thick = (face === 'maschile' ? 2 : 1.2) + (expression === 'determinata' ? 0.5 : 0);
  const d = expression === 'determinata' ? ['M45.4 46.6L57.2 49.8', 'M62.8 49.8L74.6 46.6'] : expression === 'sorridente' ? ['M46 47Q51.5 43.6 57 46.6', 'M63 46.6Q68.5 43.6 74 47'] : ['M46 48.4Q51.5 45.6 57 48', 'M63 48Q68.5 45.6 74 48.4'];
  const stroke = `stroke="${color}" stroke-width="${thick}" stroke-linecap="round" fill="none"`;
  if (!u) return `<path d="${d[0]}" ${stroke}/><path d="${d[1]}" ${stroke}/>`;
  return wrap(`<path d="${d[0]}" ${stroke}/>`, `translate(${(-u.dx).toFixed(2)} ${u.brow.toFixed(2)})`) + wrap(`<path d="${d[1]}" ${stroke}/>`, `translate(${u.dx.toFixed(2)} ${u.brow.toFixed(2)})`);
}
function mouth(face, expression, lips, skinShade) {
  if (expression === 'sorridente') return `<path d="M52.6 69.4Q60 77.4 67.4 69.4Q60 72.6 52.6 69.4Z" fill="#fbf8f2" stroke="${lips}" stroke-width="1" stroke-linejoin="round"/><path d="M49.8 66.8Q48.4 70.6 50.6 73.4M70.2 66.8Q71.6 70.6 69.4 73.4" stroke="${skinShade}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
  if (expression === 'determinata') return `<path d="M54.8 71.8Q60 70.8 65.2 71.8" stroke="${lips}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  return `<path d="${face === 'femminile' ? 'M54.5 70.4Q60 74 65.5 70.4Q60 72.6 54.5 70.4' : 'M54.6 70.2Q60 73.4 65.4 70.2Q60 71.6 54.6 70.2'}Z" fill="${lips}" stroke="${lips}" stroke-width=".8" stroke-linejoin="round"/>`;
}
// The beard follows the jaw and leaves the upper lip bare: the moustache is its own trait and sits on top, in a slightly darker tone with a light edge so that it reads over any beard.
function beard(kind, color) {
  if (kind === 'corta') return `<path d="M40 56C40 74 49 84 60 84C71 84 80 74 80 56C79 69 72 75 60 75C48 75 41 69 40 56Z" fill="${color}" opacity=".78"/>`;
  if (kind === 'completa') return `<path d="M38.5 52C37 76 48 91 60 91C72 91 83 76 81.5 52C80.5 63 77 67 71 69C66 66.6 54 66.6 49 69C43 67 39.5 63 38.5 52Z" fill="${color}"/>`;
  if (kind === 'tregiorni') return `<path d="M40 56C40 74 49 84 60 84C71 84 80 74 80 56C79 66 74 70 69 70C65 68 55 68 51 70C46 70 41 66 40 56Z" fill="${color}" opacity=".36"/>`;
  if (kind === 'pizzetto') return `<path d="M55 73.6C55.4 71.4 64.6 71.4 65 73.6C66 79 63 85 60 86.4C57 85 54 79 55 73.6Z" fill="${color}"/>`;
  if (kind === 'lunga') return `<path d="M38 52C35.5 78 46 102 60 106C74 102 84.5 78 82 52C80.4 63 77 67.4 71 69C66 66.6 54 66.6 49 69C43 67.4 39.6 63 38 52Z" fill="${color}"/>`;
  if (kind === 'basette') return `<path d="M38.4 49C37.6 59 39 69 42.4 75L45.6 72.6C43.4 66 43 58 43.4 49Z M81.6 49C82.4 59 81 69 77.6 75L74.4 72.6C76.6 66 77 58 76.6 49Z" fill="${color}"/>`;
  if (kind === 'collare') return `<path d="M39 60C40 78 49 85.4 60 85.4C71 85.4 80 78 81 60L78 62.4C77 74 70 80.4 60 80.4C50 80.4 43 74 42 62.4Z" fill="${color}"/>`;
  return '';
}
const MOUSTACHES = {
  sottili: 'M51 67.6Q55.4 65.2 60 66.6Q64.6 65.2 69 67.6Q64.6 67 60 67.9Q55.4 67 51 67.6Z',
  classici: 'M49.6 69Q54 63.8 60 65.6Q66 63.8 70.4 69Q65.4 67.2 60 68.4Q54.6 67.2 49.6 69Z',
  folti: 'M47.6 70C47.6 63.6 53.6 62.6 60 65C66.4 62.6 72.4 63.6 72.4 70C67.6 67.2 63.2 68.4 60 69.6C56.8 68.4 52.4 67.2 47.6 70Z',
  matita: 'M50 67.4Q55 65.8 60 66.6Q65 65.8 70 67.4L70 68.6Q65 67.2 60 67.9Q55 67.2 50 68.6Z',
  spazzola: 'M54.4 66.2Q60 65 65.6 66.2L65.6 69.8Q60 68.8 54.4 69.8Z',
  ferro: 'M50 66.2Q55 64.8 60 65.4Q65 64.8 70 66.2L70 79L66.4 79L66.4 69.6Q60 68.2 53.6 69.6L53.6 79L50 79Z',
  chevron: 'M46 66.4C52 63.8 58 64.6 60 66.8C62 64.6 68 63.8 74 66.4C73.4 72 71.8 76 70 79.4C68.4 75.4 65.6 71 60 70.4C54.4 71 51.6 75.4 50 79.4C48.2 76 46.6 72 46 66.4Z',
  manubrio: 'M50 68.4Q55 65.6 60 66.8Q65 65.6 70 68.4Q74.4 68.4 76.2 63.4Q75.8 70.8 67.4 69.6Q60 68.4 52.6 69.6Q44.2 70.8 43.8 63.4Q45.6 68.4 50 68.4Z'
};
function moustache(kind, hair) {
  if (!MOUSTACHES[kind]) return '';
  return `<path d="${MOUSTACHES[kind]}" fill="${shade(hair, -0.3)}" stroke="${shade(hair, 0.38)}" stroke-width=".7" stroke-linejoin="round"/>`;
}
function glasses(kind, u = null) {
  const frame = '#2b2118';
  const lens = (shapeL, shapeR, extra) => u
    ? `<g fill="rgba(210,225,240,.16)" stroke="${frame}" stroke-width="${extra.w}"><g transform="translate(${(-u.dx).toFixed(2)} 0)">${shapeL}</g><g transform="translate(${u.dx.toFixed(2)} 0)">${shapeR}</g></g>`
    : `<g fill="rgba(210,225,240,.16)" stroke="${frame}" stroke-width="${extra.w}">${shapeL}${shapeR}</g>`;
  if (kind === 'tondi') return `${lens('<circle cx="51.5" cy="54.2" r="7.6"/>', '<circle cx="68.5" cy="54.2" r="7.6"/>', { w: 1.6 })}<path d="M59.1 53.4Q60 52.2 60.9 53.4M44 53.6L40.2 52.4M76 53.6L79.8 52.4" stroke="${frame}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  if (kind === 'rettangolari') return `${lens('<rect x="43.6" y="49" width="15.4" height="10.4" rx="2.2"/>', '<rect x="61" y="49" width="15.4" height="10.4" rx="2.2"/>', { w: 1.8 })}<path d="M59 53.2L61 53.2M43.6 52L40.2 51M76.4 52L79.8 51" stroke="${frame}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  return '';
}

// The jacket, the collar, the shirt and the tie (the shoulders of the figure).
const BODY = jacket => `<path d="M12 124C12 104 28 95 49 91L60 104L71 91C92 95 108 104 108 124Z" fill="${jacket}"/>`
  + `<path d="M49 91L60 104L52 91ZM71 91L60 104L68 91Z" fill="${shade(jacket, -0.35)}"/><path d="M50 90.4L60 104L70 90.4L66 88.6L60 95L54 88.6Z" fill="#f4efe4"/><path d="M60 95L63 98L60 112L57 98Z" fill="#c9a25a"/>`
  + `<path d="M47 91L56 110" stroke="${shade(jacket, 0.18)}" stroke-width="1" fill="none" opacity=".6"/><path d="M73 91L64 110" stroke="${shade(jacket, 0.18)}" stroke-width="1" fill="none" opacity=".6"/>`;
// The avatar as an SVG string. `size` in pixels (the drawing scales), `label` is the accessible name (empty: decorative). `focus` crops on the head and the shoulders, without the ring: it is what the
// small previews of the editor show, so that every choice is seen where it matters.
export function avatarSvg(input, { size = 96, label = 'Avatar del tuo politico', className = '', focus = false } = {}) {
  const a = normalizeAvatar(input);
  const code = AVATAR_FIELDS.map(field => a[field]);
  const shapeCode = a.shape ? SHAPE_FIELDS.map(field => a.shape[field]).join(',') : '';
  const uid = `av${code.map(value => value.slice(0, 3)).join('')}${shapeCode.replace(/[^0-9]/g, m => m === '-' ? 'n' : '')}${size}${focus ? 'f' : ''}`;
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
  const view = focus ? '18 8 84 84' : '0 0 120 120';
  const parts = avatarParts(a, uid);
  return `<svg class="avatar-svg ${esc(className)}" xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="${size}" height="${size}" ${a11y} data-avatar="${esc(code.join('.'))}${shapeCode ? esc(`.${shapeCode}`) : ''}">`
    + parts.defs
    + `<g${focus ? '' : ` clip-path="url(#${uid}-c)"`}><rect width="120" height="120" fill="url(#${uid}-b)"/><circle cx="60" cy="52" r="46" fill="#f0cf85" opacity=".09"/>`
    + parts.figure
    + `</g>${focus ? '' : '<circle cx="60" cy="60" r="58" fill="none" stroke="#e7c98f" stroke-width="2.4"/>'}</svg>`;
}

// The figure of the avatar in separate groups, so that a scene can animate them without touching the identity: the whole body (.av-body), the head with the hair and the glasses (.av-head), the
// eyes (.av-eyes, they blink), the brows (.av-brows) and the mouth (.av-mouth, with an open mouth .av-mouth-open that shows while the character speaks). The drawing is the same as always: the
// groups only wrap it. `expression` overrides the trait for a moment (a scene changes the face, never who the person is).
// The colours of an avatar (skin, hair, jacket), for the stage that draws the rest of the body around it.
export function avatarColors(input) { const a = normalizeAvatar(input); return { skin: colorOf('skin', a.skin), hair: colorOf('hair', a.hair), jacket: colorOf('jacket', a.jacket) }; }
export function avatarParts(input, uid, { expression = null } = {}) {
  const a = normalizeAvatar(expression ? { ...input, expression } : input);
  const skin = colorOf('skin', a.skin), hair = colorOf('hair', a.hair), jacket = colorOf('jacket', a.jacket), iris = colorOf('eyes', a.eyes);
  const skinShade = shade(skin, -0.16), hairShade = shade(hair, -0.28);
  const back = HAIR_BACK[a.hairstyle] ? (HAIR_BACK[a.hairstyle].startsWith('<') ? HAIR_BACK[a.hairstyle] : `<path d="${HAIR_BACK[a.hairstyle]}"/>`) : '';
  const frontPath = HAIR_FRONT[a.hairstyle];
  const front = frontPath.startsWith('<') ? frontPath : `<path d="${frontPath}" fill-rule="evenodd"${a.hairstyle === 'rasato' ? ' opacity=".6"' : ''}/>`;
  const lips = a.face === 'femminile' ? '#b4574f' : shade(skin, -0.32);
  const u = unitOf(a.shape);
  const defs = `<defs><clipPath id="${uid}-c"><circle cx="60" cy="60" r="58"/></clipPath><linearGradient id="${uid}-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3a52"/><stop offset="1" stop-color="#0f1a2b"/></linearGradient></defs>`;
  const open = `<ellipse class="av-mouth-open" cx="60" cy="71.4" rx="5.4" ry="3.6" fill="#3a1713" stroke="${lips}" stroke-width="1" opacity="0"/>`;
  const figure = `<g class="av-body">${wrap(`<g fill="${hair}">${back}</g>`, u && aboutX(u.width))}`
    + `<path d="M53 76h14v22H53z" fill="${skinShade}"/>`
    + BODY(jacket)
    + `</g><g class="av-head">${u ? `<g transform="${aboutX(u.width)}">` : ''}`
    + `<circle cx="38.4" cy="56" r="4.4" fill="${skinShade}"/><circle cx="81.6" cy="56" r="4.4" fill="${skinShade}"/>`
    + wrap(`<path d="${HEADS[a.face]}" fill="${skin}"/>`, u && `translate(0 24) scale(1 ${u.chin.toFixed(3)}) translate(0 -24)`)
    + `<path d="M60 56L58.4 62.4Q60 63.4 61.6 62.4Z" fill="${skinShade}" opacity=".8"/>`
    + `<g class="av-eyes">${eyes(a.face, hairShade, iris, u)}</g><g class="av-brows">${brows(a.face, a.expression, hair, u)}</g>`
    + wrap(beard(a.beard, hair), u && `translate(0 24) scale(1 ${u.chin.toFixed(3)}) translate(0 -24)`)
    // (the mouth is drawn over the beard: a beard never hides it)
    + wrap(`<g class="av-mouth">${mouth(a.face, a.expression, lips, skinShade)}</g>${open}`, u && aboutX(u.mouth))
    + moustache(a.moustache, hair)
    + `<g fill="${hair}">${front}</g>`
    + glasses(a.glasses, u)
    + `${u ? '</g>' : ''}</g>`;
  return { defs, figure, avatar: a };
}
