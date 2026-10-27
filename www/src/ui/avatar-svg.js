// The avatar of the player, drawn as one local SVG from the chosen traits: no library, no request, no remote image. The same renderer draws it in the wizard (live preview), in the profile, in the
// headquarters and in the Parliament, so that the player is the same face everywhere. The input is always cleaned first (an unknown value falls back to the default).
import { AVATAR_OPTIONS, normalizeAvatar } from '../core/avatar.js?v=20261027-5';

const colorOf = (field, id) => AVATAR_OPTIONS[field].find(item => item.id === id)?.color ?? '#888888';
// A colour made lighter (amount > 0) or darker (amount < 0).
function shade(hex, amount) {
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
  ondulato: 'M35 54C32 26 47 16 60 16C73 16 88 26 85 54C87 64 91 70 85 78C80 74 79 66 76 60L44 60C41 66 40 74 35 78C29 70 33 64 35 54Z'
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
  ondulato: 'M38 52C36 28 50 17 62 18C75 19 85 30 82 52C79 42 74 37 68 40C64 33 58 38 54 35C48 36 42 42 38 52Z'
};

function eyes(face, ink, iris) {
  const lash = face === 'femminile' ? `<path d="M46.5 52.6L44.6 50.8M49.5 51.6L48.8 49.2M72.8 49.2L72.1 51.6M75.4 50.8L73.5 52.6" stroke="${ink}" stroke-width="1" stroke-linecap="round" fill="none"/>` : '';
  return `<ellipse cx="51.5" cy="54.2" rx="3.2" ry="2.5" fill="#fbf8f2"/><ellipse cx="68.5" cy="54.2" rx="3.2" ry="2.5" fill="#fbf8f2"/><circle cx="51.8" cy="54.3" r="2.1" fill="${iris}"/><circle cx="68.2" cy="54.3" r="2.1" fill="${iris}"/><circle cx="51.8" cy="54.3" r="1" fill="#1b130d"/><circle cx="68.2" cy="54.3" r="1" fill="#1b130d"/><circle cx="52.5" cy="53.5" r=".55" fill="#fff"/><circle cx="68.9" cy="53.5" r=".55" fill="#fff"/>${lash}`;
}
// The eyebrows follow the face and the expression (raised when smiling, lowered and angled when determined).
function brows(face, expression, color) {
  const thick = (face === 'maschile' ? 2 : 1.2) + (expression === 'determinata' ? 0.5 : 0);
  const d = expression === 'determinata' ? ['M45.4 46.6L57.2 49.8', 'M62.8 49.8L74.6 46.6'] : expression === 'sorridente' ? ['M46 47Q51.5 43.6 57 46.6', 'M63 46.6Q68.5 43.6 74 47'] : ['M46 48.4Q51.5 45.6 57 48', 'M63 48Q68.5 45.6 74 48.4'];
  return `<path d="${d[0]}" stroke="${color}" stroke-width="${thick}" stroke-linecap="round" fill="none"/><path d="${d[1]}" stroke="${color}" stroke-width="${thick}" stroke-linecap="round" fill="none"/>`;
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
  return '';
}
const MOUSTACHES = {
  sottili: 'M51 67.6Q55.4 65.2 60 66.6Q64.6 65.2 69 67.6Q64.6 67 60 67.9Q55.4 67 51 67.6Z',
  classici: 'M49.6 69Q54 63.8 60 65.6Q66 63.8 70.4 69Q65.4 67.2 60 68.4Q54.6 67.2 49.6 69Z',
  folti: 'M47.6 70C47.6 63.6 53.6 62.6 60 65C66.4 62.6 72.4 63.6 72.4 70C67.6 67.2 63.2 68.4 60 69.6C56.8 68.4 52.4 67.2 47.6 70Z',
  manubrio: 'M50 68.4Q55 65.6 60 66.8Q65 65.6 70 68.4Q74.4 68.4 76.2 63.4Q75.8 70.8 67.4 69.6Q60 68.4 52.6 69.6Q44.2 70.8 43.8 63.4Q45.6 68.4 50 68.4Z'
};
function moustache(kind, hair) {
  if (!MOUSTACHES[kind]) return '';
  return `<path d="${MOUSTACHES[kind]}" fill="${shade(hair, -0.3)}" stroke="${shade(hair, 0.38)}" stroke-width=".7" stroke-linejoin="round"/>`;
}
function glasses(kind) {
  const frame = '#2b2118';
  if (kind === 'tondi') return `<g fill="rgba(210,225,240,.16)" stroke="${frame}" stroke-width="1.6"><circle cx="51.5" cy="54.2" r="7.6"/><circle cx="68.5" cy="54.2" r="7.6"/></g><path d="M59.1 53.4Q60 52.2 60.9 53.4M44 53.6L40.2 52.4M76 53.6L79.8 52.4" stroke="${frame}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  if (kind === 'rettangolari') return `<g fill="rgba(210,225,240,.16)" stroke="${frame}" stroke-width="1.8"><rect x="43.6" y="49" width="15.4" height="10.4" rx="2.2"/><rect x="61" y="49" width="15.4" height="10.4" rx="2.2"/></g><path d="M59 53.2L61 53.2M43.6 52L40.2 51M76.4 52L79.8 51" stroke="${frame}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  return '';
}

// The avatar as an SVG string. `size` in pixels (the drawing scales), `label` is the accessible name (empty: decorative). `focus` crops on the head and the shoulders, without the ring: it is what the
// small previews of the editor show, so that every choice is seen where it matters.
export function avatarSvg(input, { size = 96, label = 'Avatar del tuo politico', className = '', focus = false } = {}) {
  const a = normalizeAvatar(input);
  const skin = colorOf('skin', a.skin), hair = colorOf('hair', a.hair), jacket = colorOf('jacket', a.jacket), iris = colorOf('eyes', a.eyes);
  const skinShade = shade(skin, -0.16), hairShade = shade(hair, -0.28);
  const uid = `av${Object.values(a).map(value => value.slice(0, 3)).join('')}${size}${focus ? 'f' : ''}`;
  const back = HAIR_BACK[a.hairstyle] ? (HAIR_BACK[a.hairstyle].startsWith('<') ? HAIR_BACK[a.hairstyle] : `<path d="${HAIR_BACK[a.hairstyle]}"/>`) : '';
  const frontPath = HAIR_FRONT[a.hairstyle];
  const front = frontPath.startsWith('<') ? frontPath : `<path d="${frontPath}" fill-rule="evenodd"${a.hairstyle === 'rasato' ? ' opacity=".6"' : ''}/>`;
  const lips = a.face === 'femminile' ? '#b4574f' : shade(skin, -0.32);
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
  const view = focus ? '18 8 84 84' : '0 0 120 120';
  return `<svg class="avatar-svg ${esc(className)}" xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="${size}" height="${size}" ${a11y} data-avatar="${esc(Object.values(a).join('.'))}">`
    + `<defs><clipPath id="${uid}-c"><circle cx="60" cy="60" r="58"/></clipPath><linearGradient id="${uid}-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3a52"/><stop offset="1" stop-color="#0f1a2b"/></linearGradient></defs>`
    + `<g${focus ? '' : ` clip-path="url(#${uid}-c)"`}><rect width="120" height="120" fill="url(#${uid}-b)"/><circle cx="60" cy="52" r="46" fill="#f0cf85" opacity=".09"/>`
    + `<g fill="${hair}">${back}</g>`
    + `<path d="M53 76h14v22H53z" fill="${skinShade}"/>`
    + `<path d="M12 124C12 104 28 95 49 91L60 104L71 91C92 95 108 104 108 124Z" fill="${jacket}"/>`
    + `<path d="M49 91L60 104L52 91ZM71 91L60 104L68 91Z" fill="${shade(jacket, -0.35)}"/><path d="M50 90.4L60 104L70 90.4L66 88.6L60 95L54 88.6Z" fill="#f4efe4"/><path d="M60 95L63 98L60 112L57 98Z" fill="#c9a25a"/>`
    + `<path d="M47 91L56 110" stroke="${shade(jacket, 0.18)}" stroke-width="1" fill="none" opacity=".6"/><path d="M73 91L64 110" stroke="${shade(jacket, 0.18)}" stroke-width="1" fill="none" opacity=".6"/>`
    + `<circle cx="38.4" cy="56" r="4.4" fill="${skinShade}"/><circle cx="81.6" cy="56" r="4.4" fill="${skinShade}"/>`
    + `<path d="${HEADS[a.face]}" fill="${skin}"/>`
    + `<path d="M60 56L58.4 62.4Q60 63.4 61.6 62.4Z" fill="${skinShade}" opacity=".8"/>`
    + mouth(a.face, a.expression, lips, skinShade)
    + eyes(a.face, hairShade, iris) + brows(a.face, a.expression, hair)
    + beard(a.beard, hair) + moustache(a.moustache, hair)
    + `<g fill="${hair}">${front}</g>`
    + glasses(a.glasses)
    + `</g>${focus ? '' : '<circle cx="60" cy="60" r="58" fill="none" stroke="#e7c98f" stroke-width="2.4"/>'}</svg>`;
}
