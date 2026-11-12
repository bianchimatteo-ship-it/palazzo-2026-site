// The drawing of the stages (2D, SVG, 640 x 360 units): the television studio, the square of a rally, the polling station, and the characters that stand in them. A character is built from the avatar of
// its person (avatar-svg.js: always the avatar saved for the player, a stable one for the others) plus a body drawn here — torso, two arms with an elbow, two legs — in separate groups, so that the
// player (ui/stage-player.js) can make them walk, sit, gesture. Every group carries the data the player needs (class, data-*); the poses come from core/stage-script.js. No animation is started here:
// what is drawn is the FINAL pose of the beat, so with the motion off or reduced, or in a scene resumed, the stage is already right.
import { avatarColors, avatarParts, shade } from './avatar-svg.js?v=20261112-8';
import { depthScale, STAGE_W, STAGE_H } from '../core/stage-script.js?v=20261112-8';
import { defaultAvatarFor, genderOf } from '../core/avatar.js?v=20261112-8';
import { isEnglish, translateText } from '../core/i18n.js?v=20261112-8';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hash = text => { let h = 2166136261 >>> 0; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = text => hash(text) / 4294967296;

// ---------- the arms: [upper, fore] angles in degrees for the left and the right arm, by gesture ----------
export const GESTURES = Object.freeze({
  riposo: { l: [5, 3], r: [-5, -3] }, sottolinea: { l: [6, 4], r: [-38, -62] }, apre: { l: [40, 22], r: [-40, -22] }, indica: { l: [6, 4], r: [-74, -6] }, saluta: { l: [6, 4], r: [-148, -22] },
  ascolta: { l: [8, 10], r: [-8, -10] }, pensa: { l: [6, 4], r: [-44, -132] }, prende: { l: [6, 4], r: [-46, -40] }, porge: { l: [6, 4], r: [-52, -30] }, scrive: { l: [8, 6], r: [-30, -78] },
  piega: { l: [24, 76], r: [-24, -76] }, inserisce: { l: [6, 4], r: [-62, -24] }, applaude: { l: [16, 78], r: [-16, -78] }, sedutoRiposo: { l: [16, 56], r: [-16, -56] },
  // the gestures added for the variety of the scenes: surprise, hesitation, disagreement, taking notes, a handshake, an interruption, both palms up, a hand on the chest
  sorpresa: { l: [48, 30], r: [-48, -30] }, esita: { l: [6, 4], r: [-36, -112] }, dissenso: { l: [26, 62], r: [-26, -62] }, appunti: { l: [30, 84], r: [-22, -74] }, stretta: { l: [6, 4], r: [-64, -8] },
  interrompe: { l: [6, 4], r: [-118, -6] }, palmi: { l: [34, 40], r: [-34, -40] }, petto: { l: [6, 4], r: [-36, -122] }, scuote: { l: [16, 50], r: [-16, -50] }
});
export const gestureAngles = (name, posture) => GESTURES[name] ?? (posture === 'sit' ? GESTURES.sedutoRiposo : GESTURES.riposo);

// ---------- a character ----------
// Local coordinates: the feet at (0, 0), the figure about 270 units tall, the shoulders at y = -200, the hips at y = -105. `pose` is the final pose of the beat.
export function actorSvg(member, pose, uid, { speaking = false, expression = null } = {}) {
  // a character without a saved avatar (an older scene): the stable default of its id, with the face of its gender when the data gives it (gender field, title or first name)
  const avatar = member.avatar ?? (() => { const gender = genderOf(member); return gender ? { ...defaultAvatarFor(member.id), face: gender } : defaultAvatarFor(member.id); })();
  const parts = avatarParts(avatar, uid, { expression });
  const { skin, jacket } = avatarColors(avatar);
  const trousers = shade(jacket, -0.45), sleeve = shade(jacket, -0.06), forearm = shade(jacket, -0.14);
  const angles = gestureAngles(pose.gesture, pose.posture);
  const sitting = pose.posture === 'sit';
  const arm = (side, [upper, fore]) => {
    const x = side === 'l' ? -56 : 36;
    return `<g class="st-arm st-arm-${side}" style="transform:rotate(${upper}deg)"><rect x="${x}" y="-204" width="20" height="56" rx="9" fill="${sleeve}"/>`
      + `<g class="st-fore" style="transform:rotate(${fore}deg)"><rect x="${x + 1.5}" y="-154" width="17" height="52" rx="8" fill="${forearm}"/><circle cx="${x + 10}" cy="-100" r="9" fill="${skin}"/></g></g>`;
  };
  const leg = side => { const x = side === 'l' ? -31 : 5; return `<g class="st-leg st-leg-${side}"><rect x="${x}" y="-108" width="26" height="103" rx="9" fill="${trousers}"/><ellipse cx="${x + 13}" cy="-4" rx="17" ry="7" fill="#15110f"/></g>`; };
  const seat = sitting ? 'translateY(30px)' : 'none';
  return `<g class="st-actor role-${esc(member.role)}${speaking ? ' is-speaking' : ''}" data-actor="${esc(member.id)}" data-avatar="${esc(Object.values(parts.avatar).join('.'))}" data-x="${pose.x}" data-y="${pose.y}" data-s="${pose.s}" data-posture="${pose.posture}" data-gesture="${esc(pose.gesture ?? '')}" data-visible="${pose.visible ? 1 : 0}" data-facing="${pose.facing}" data-path="${esc(JSON.stringify(pose.path ?? []))}" style="transform:translate(${pose.x}px,${pose.y}px) scale(${pose.s});${pose.visible ? '' : 'opacity:0'}">`
    + `<ellipse class="st-shadow" cx="0" cy="0" rx="52" ry="10" fill="#000" opacity=".28"/>`
    + `<g class="st-flip" style="transform:scaleX(${pose.facing})"><g class="st-body" style="transform:${seat}">`
    + `${leg('l')}${leg('r')}`
    + `<path d="M-48 -167L-44 -104 44 -104 48 -167Z" fill="${jacket}"/><path d="M-44 -108H44" stroke="${shade(jacket, -0.5)}" stroke-width="5"/>`
    + `<g class="st-avatar" transform="translate(-60 -291)">${parts.figure}</g>`
    + arm('l', angles.l) + arm('r', angles.r)
    + `</g></g></g>`;
}
const defsOf = parts => parts.map(part => part.defs).join('');

// ---------- the crowd ----------
// Heads and shoulders seen from behind, in rows (the camera is behind the crowd, the stage in front of it), with raised arms, flags and signs. Deterministic from the seed.
function crowdSvg(seed, rows, { color = '#9c2f39', signs = [], flags = [], x0 = 20, x1 = 620, aisle = null, split = false, abbr = '', partyFull = '' } = {}) {
  const hairs = ['#2b2118', '#3a2a1c', '#5a4632', '#8a7355', '#20262e', '#b9b2a4', '#6a3a24'];
  const tops = ['#27414a', '#3d3a52', '#4a3b34', '#1f3a33', '#53424a', '#2f3b52'];
  const rowHtml = [];
  rows.forEach(([y, scale, count], row) => {
    let html = '';
    for (let i = 0; i < count; i++) {
      const key = `${seed}|${row}|${i}`;
      const x = x0 + (x1 - x0) * (i + 0.5 + (unit(key + 'x') - 0.5) * 0.7) / count;
      if (aisle && y > 250 && x > aisle[0] && x < aisle[1]) continue;     // the aisle the speaker walks along: nobody stands in it
      const s = scale * (0.92 + unit(key + 's') * 0.2);
      const hair = hairs[hash(key + 'h') % hairs.length], top = tops[hash(key + 't') % tops.length];
      const arms = unit(key + 'a') < 0.55;
      html += `<g class="cm" style="--d:${Math.round(unit(key + 'd') * 600)}ms;transform:translate(${x.toFixed(1)}px,${y}px) scale(${s.toFixed(2)})"><g class="cm-in">`
        + (arms ? `<g class="cm-arm cm-arm-l"><rect x="-17" y="-34" width="6" height="30" rx="3" fill="${top}"/><circle cx="-14" cy="-36" r="4" fill="#d9b48f"/></g><g class="cm-arm cm-arm-r"><rect x="11" y="-34" width="6" height="30" rx="3" fill="${top}"/><circle cx="14" cy="-36" r="4" fill="#d9b48f"/></g>` : '')
        + `<path d="M-19 8C-19 -8 -10 -13 0 -13S19 -8 19 8Z" fill="${top}"/><circle cx="0" cy="-22" r="11" fill="${hair}"/></g></g>`;
    }
    rowHtml.push({ y, html });
  });
  // flags: the Italian tricolour and the flag of the party, on poles, waving (a flag never stands in the aisle). The flag of the party reads as its abbreviation (the official logo is drawn only where it is allowed),
  // in the ink that reads on the colour of the party; the full name of the party is in the title of the flag and on the backdrop.
  const flagInk = inkOn(color), flagText = String(abbr).replace(/\s+/g, '').toUpperCase().slice(0, 4);
  let extra = '';
  flags.forEach((flag, f) => {
    const x = flag.x + (x1 - 640), y = flag.y ?? 282;
    const cloth = flag.kind === 'tricolore'
      ? `<g class="cm-cloth"><rect x="1" y="-74" width="17" height="22" fill="#1f8a4c"/><rect x="18" y="-74" width="17" height="22" fill="#f5f3ec"/><rect x="35" y="-74" width="17" height="22" fill="#cd2b35"/></g>`
      : `<g class="cm-cloth"><title>${esc(partyFull || String(abbr))}</title><rect x="1" y="-74" width="52" height="22" fill="${color}" stroke="${flagInk === '#ffffff' ? 'rgba(255,255,255,.6)' : 'rgba(20,24,22,.6)'}" stroke-width="1"/><text x="27" y="-59" text-anchor="middle" font-size="${flagText.length > 3 ? 8.5 : 11}" font-weight="900" fill="${flagInk}">${esc(flagText)}</text></g>`;
    extra += `<g class="cm-flag" style="--d:${f * 220}ms;transform:translate(${x.toFixed(0)}px,${y}px)"><rect x="-1.2" y="-74" width="2.4" height="70" fill="#c8c0a8"/>${cloth}</g>`;
  });
  signs.forEach((text, i) => { const x = [150, 540, 90, 600][i % 4] + unit(`${seed}|sg${i}`) * 20, y = 292 + (i % 2) * 8; extra += `<g class="cm-sign" style="--d:${i * 180}ms;transform:translate(${x.toFixed(0)}px,${y}px)"><rect x="-1.2" y="-58" width="2.4" height="54" fill="#8b7a5e"/><rect x="-30" y="-90" width="60" height="32" rx="2" fill="#f4efe0" stroke="#3a2f22" stroke-width="1.4"/><text x="0" y="-70" text-anchor="middle" font-size="9" font-weight="800" fill="#3a2f22" textLength="50" lengthAdjust="spacingAndGlyphs">${esc(text)}</text></g>`; });
  if (split) return { rows: rowHtml, extra };
  return rowHtml.map(item => item.html).join('') + extra;
}
const luminance = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '')); if (!m) return 0.2; const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
// The ink that reads on a colour: white on the dark ones, near-black on the light ones.
export const inkOn = hex => luminance(hex) > 0.38 ? '#161a1f' : '#ffffff';
// the protesters: a group with signs and a banner, drawn like the crowd but facing the stage and moving as a block
function protestSvg(seed, label, group = '', slogans = []) {
  const people = [0, 1, 2, 3, 4, 5].map(i => { const x = 520 + (i % 3) * 34 + unit(`${seed}|pp${i}`) * 10, y = 304 + Math.floor(i / 3) * 22; return `<g class="cm cm-protest" style="--d:${i * 90}ms;transform:translate(${x.toFixed(0)}px,${y}px) scale(.7)"><g class="cm-in"><g class="cm-arm cm-arm-l"><rect x="-17" y="-34" width="6" height="30" rx="3" fill="#3b2a2a"/><circle cx="-14" cy="-36" r="4" fill="#d9b48f"/></g><path d="M-19 8C-19 -8 -10 -13 0 -13S19 -8 19 8Z" fill="#3b2a2a"/><circle cx="0" cy="-22" r="11" fill="#2b2118"/></g></g>`; }).join('');
  const signs = slogans.slice(0, 2).map((text, i) => `<g class="cm-sign" style="--d:${i * 200}ms;transform:translate(${470 + i * 56}px,${312 + i * 6}px) scale(.8)"><rect x="-1.2" y="-58" width="2.4" height="54" fill="#8b7a5e"/><rect x="-34" y="-90" width="68" height="32" rx="2" fill="#f4efe0" stroke="#7a1f24" stroke-width="1.4"/><text x="0" y="-70" text-anchor="middle" font-size="8" font-weight="800" fill="#7a1f24" textLength="58" lengthAdjust="spacingAndGlyphs">${esc(text)}</text></g>`).join('');
  return `<g class="st-protest" data-group="${esc(group)}">${signs}<g class="st-banner" style="transform:translate(494px,236px)"><rect x="-74" y="-24" width="148" height="34" rx="2" fill="#f4efe0" stroke="#7a1f24" stroke-width="2"/><text x="0" y="-3" text-anchor="middle" font-size="9.5" font-weight="900" fill="#7a1f24" textLength="132" lengthAdjust="spacingAndGlyphs">${esc(label.toUpperCase().slice(0, 34))}</text><rect x="-60" y="10" width="2.4" height="62" fill="#8b7a5e"/><rect x="58" y="10" width="2.4" height="62" fill="#8b7a5e"/></g>${people}</g>`;
}

// ---------- the settings ----------
const sky = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
function logoMark(identity, x, y, size, uid) {
  const color = identity?.accent ?? '#c4a66a';
  if (identity?.logo) return `<g class="st-logo"><circle cx="${x}" cy="${y}" r="${size / 2 + 3}" fill="#fff" opacity=".96"/><image href="${esc(identity.logo)}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/></g>`;
  return `<g class="st-logo"><circle cx="${x}" cy="${y}" r="${size / 2 + 3}" fill="#fff" stroke="${color}" stroke-width="2"/><text x="${x}" y="${y + size * 0.12}" text-anchor="middle" font-size="${Math.round(size * 0.3)}" font-weight="900" fill="${color}" textLength="${size * 0.8}" lengthAdjust="spacingAndGlyphs">${esc((identity?.mark ?? identity?.abbreviation ?? identity?.name ?? 'P').toString().slice(0, 3).toUpperCase())}</text></g>`;
}
export function plate(x, y, w, text, { fill = '#d9bd7e', ink = '#1d1a12' } = {}) {
  const label = String(text ?? '').toUpperCase();
  return `<g class="st-plate"><rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="16" rx="3" fill="${fill}" stroke="#7a6232" stroke-width=".8"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="9.5" font-weight="800" letter-spacing=".4" fill="${ink}" textLength="${Math.min(w - 10, Math.max(24, label.length * 6.4))}" lengthAdjust="spacingAndGlyphs">${esc(label)}</text></g>`;
}

// ---------- the three television studios ----------
// `faccia` (the face-to-face debate): two lecterns and a moderator on a dark stage, the audience on both sides. `talk` (the talk show): a warm set, the host's desk on the left, a sofa and a low table for the
// guests, the audience in the back rows. `intervista` (the news and interview): a cool newsroom with a wall of screens, the anchor's desk, two armchairs, no audience, the crew's cameras. The people are the
// same actors; where they sit is core/stage-script.js. The strip of headlines and the name straps are drawn over the camera (they do not zoom): see `studioOverlay`.
const FORMAT_LOOK = {
  faccia: { wall: ['#0e2236', '#081523'], floor: ['#16222c', '#080d12'], glow: '#ffe9b0', title: 'FACCIA A FACCIA' },
  talk: { wall: ['#2a1633', '#150a1c'], floor: ['#2a1d22', '#0f0a0c'], glow: '#ffc88a', title: 'IN STUDIO' },
  intervista: { wall: ['#16293b', '#0b1722'], floor: ['#1d2a33', '#0a1116'], glow: '#d6ecff', title: 'IN DIRETTA' }
};
const formatKey = scene => scene.format ?? (scene.kind === 'talkshow' ? 'talk' : 'faccia');
// a line of text that always fits its place whole: compressed (never cut) when it is longer than the room it has
const fitted = (text, x, y, size, room, attrs = '') => { const natural = text.length * size * 0.74; return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" letter-spacing=".6" ${attrs}${natural > room ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(text)}</text>`; };
function rigLights(xs) { return `<g class="st-rig"><rect x="-200" y="0" width="1040" height="10" fill="#0a0f14"/>${xs.map((x, i) => `<g class="st-light" style="--d:${i * 380}ms"><rect x="${x - 7}" y="8" width="14" height="10" rx="2" fill="#222a32"/><path d="M${x - 5} 18L${x - 28} 80H${x + 28}L${x + 5} 18Z" fill="#fff4cc" opacity=".05"/></g>`).join('')}</g>`; }
function studioFloor(uid, look, pools) { return `<defs>${sky(`${uid}-wall`, ...look.wall)}${sky(`${uid}-floor`, ...look.floor)}<radialGradient id="${uid}-pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${look.glow}" stop-opacity=".42"/><stop offset="1" stop-color="${look.glow}" stop-opacity="0"/></radialGradient></defs><rect x="-200" y="-100" width="1040" height="400" fill="url(#${uid}-wall)"/><rect x="-200" y="196" width="1040" height="260" fill="url(#${uid}-floor)"/>${pools.map(([x, y, rx]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.23}" fill="url(#${uid}-pool)"/>`).join('')}`; }
function cameraRig(x, tally, flip = false) { return `<g class="st-camera" style="transform:translate(${x}px,338px)${flip ? ' scaleX(-1)' : ''}"><rect x="-22" y="-26" width="44" height="30" rx="5" fill="#1b232b"/><rect x="-16" y="-34" width="32" height="12" rx="3" fill="#2c3944"/><circle cx="0" cy="-12" r="9" fill="#0b0f13" stroke="#5c6b78" stroke-width="2"/><circle class="st-tally${tally ? ' is-on' : ''}" cx="16" cy="-30" r="3" fill="#d42e2e"/><rect x="-3" y="4" width="6" height="14" fill="#38444f"/></g>`; }
const screenWall = (x, y, w, h, uid, label, count) => `<g class="st-screens">${Array.from({ length: count }, (_, i) => { const cw = (w - (count - 1) * 4) / count, cx = x + i * (cw + 4); return `<rect x="${cx}" y="${y}" width="${cw}" height="${h}" rx="3" fill="${i % 2 ? '#1d5470' : '#173f55'}" stroke="#58a3c4" stroke-width="1.2"/><rect class="st-led" style="--d:${i * 700}ms" x="${cx}" y="${y}" width="${cw / 3}" height="${h}" rx="3" fill="#9fdcf0" opacity=".14"/>`; }).join('')}</g>`;

function studioFaccia(scene, uid, crowd) {
  const members = ['giocatore', 'rivale', 'conduttore'].map(role => scene.cast.find(item => item.role === role));
  // The name of the candidate on the coloured panel of the lectern: the whole name on one line when it fits, otherwise first names above and surname below (centred, white on a dark outline so it reads on the blue and on the orange), every line compressed rather than cut.
  const plate = (x, name) => {
    const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    const room = 128, size = 11.5, fits = text => text.length * size * 0.62 <= room;
    const full = words.join(' ');
    // the surname (with its particle: «De Angelis», «Dalla Valle») stays whole on the second line
    let cut = words.length - 1;
    while (cut > 1 && /^(de|di|del|della|dal|dalla|da|la|lo|le|van|von|dei|degli|d’|dell’)$/i.test(words[cut - 1])) cut--;
    const lines = fits(full) || words.length < 2 ? [full] : [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    const rows = lines.length === 1 ? [[full, 281]] : [[lines[0], 272.5], [lines[1], 284.5]];
    const fontSize = lines.length === 1 ? size : 10.4;
    return rows.map(([text, y]) => `<text class="st-lectern-name" x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}" font-weight="800" letter-spacing=".3" fill="#fff" stroke="#0b1218" stroke-width="2.2" paint-order="stroke" stroke-linejoin="round"${text.length * fontSize * 0.62 > room ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(text)}</text>`).join('');
  };
  const lectern = (x, color, name) => `<g class="st-desk"><rect x="${x - 78}" y="248" width="156" height="52" rx="5" fill="#26333f"/><rect x="${x - 78}" y="248" width="156" height="6" rx="3" fill="#8fb4c6"/><rect x="${x - 70}" y="262" width="140" height="28" rx="3" fill="${color}" opacity=".9"/>${plate(x, name)}</g>`;
  const back = `${studioFloor(uid, FORMAT_LOOK.faccia, [[128, 300, 150], [512, 300, 150], [320, 270, 120]])}${screenWall(70, 26, 500, 84, uid, '', 3)}`
    + `<text x="320" y="58" text-anchor="middle" font-size="19" font-weight="900" letter-spacing="3" fill="#f0d68a">${esc(scene.show?.name ? scene.show.name.toUpperCase() : 'FACCIA A FACCIA')}</text><text x="320" y="84" text-anchor="middle" font-size="11" font-weight="700" fill="#cfe7f1">${esc(scene.topic.label)}</text>`
    + `<path d="M0 196H640" stroke="#58a3c4" stroke-opacity=".25"/>${rigLights([40, 150, 260, 380, 490, 600])}`;
  const front = `${lectern(128, '#2f6fa8', members[0]?.name)}${lectern(512, '#c05a2c', members[1]?.name)}<g class="st-desk"><rect x="${320 - 52}" y="230" width="104" height="44" rx="5" fill="#33414d"/><rect x="${320 - 52}" y="230" width="104" height="5" rx="2.5" fill="#d9bd7e"/></g>${cameraRig(46, true)}${cameraRig(594, false, true)}`;
  const audience = `<g class="st-crowd is-${crowd}" data-crowd>${crowdSvg(`${scene.seed}|aud`, [[236, 0.34, 28], [226, 0.3, 30]], { x0: 14, x1: 626 })}</g>`;
  return { back, front, audience };
}
function studioTalk(scene, uid, crowd) {
  const back = `${studioFloor(uid, FORMAT_LOOK.talk, [[176, 296, 140], [480, 304, 170]])}`
    + `<g class="st-skyline"><rect x="250" y="30" width="360" height="104" rx="4" fill="#0d0a18" stroke="#c78b4b" stroke-width="1.4"/>${Array.from({ length: 22 }, (_, i) => { const w = 12 + unit(`${scene.seed}|sk${i}`) * 14, h = 22 + unit(`${scene.seed}|sh${i}`) * 66; return `<rect x="${256 + i * 16}" y="${132 - h}" width="${w}" height="${h}" fill="#1c1630"/>${unit(`${scene.seed}|sl${i}`) < 0.7 ? `<rect x="${260 + i * 16}" y="${132 - h + 6}" width="4" height="5" fill="#f3c57a" opacity=".85"/>` : ''}`; }).join('')}</g>`
    + `<rect x="30" y="34" width="190" height="52" rx="26" fill="#ff7a3c" opacity=".16"/><rect x="34" y="38" width="182" height="44" rx="22" fill="none" stroke="#ffb07a" stroke-width="2.4"/><text x="125" y="66" text-anchor="middle" font-size="16" font-weight="900" letter-spacing="1.5" fill="#ffd8b8" textLength="${Math.min(160, 14 + String(scene.show?.name ?? 'IN STUDIO').length * 8.6)}" lengthAdjust="spacingAndGlyphs">${esc(String(scene.show?.name ?? 'In studio').toUpperCase())}</text>`
    + `${rigLights([60, 170, 300, 430, 540])}<g class="st-crowd is-${crowd}" data-crowd>${crowdSvg(`${scene.seed}|talk-aud`, [[236, 0.34, 26], [226, 0.3, 28]], { x0: 20, x1: 620 })}</g>`
    + `<g class="st-sofa"><rect x="420" y="256" width="180" height="46" rx="12" fill="#6a2f3a"/><rect x="410" y="270" width="18" height="40" rx="8" fill="#7d3a46"/><rect x="592" y="270" width="18" height="40" rx="8" fill="#7d3a46"/></g>`;
  const front = `<g class="st-desk"><path d="M60 286Q176 252 292 286V316H60Z" fill="#3b2433"/><path d="M60 286Q176 252 292 286" fill="none" stroke="#e0b277" stroke-width="5"/>${fitted(String(scene.show?.name ?? '').toUpperCase(), 176, 288, 9, 200, 'fill="#f2d6ac" font-weight="800"')}</g>`
    + `<g class="st-table"><ellipse cx="486" cy="326" rx="70" ry="9" fill="#2a1a22"/><ellipse cx="486" cy="322" rx="70" ry="9" fill="#a97a52"/><rect x="448" y="312" width="9" height="9" rx="2" fill="#f4efe0"/><rect x="520" y="313" width="9" height="9" rx="2" fill="#f4efe0"/></g>${cameraRig(40, true)}${cameraRig(602, false, true)}`;
  return { back, front, audience: '' };
}
function studioIntervista(scene, uid) {
  const back = `${studioFloor(uid, FORMAT_LOOK.intervista, [[210, 300, 150], [490, 304, 170]])}`
    + `<g class="st-videowall"><rect x="30" y="22" width="580" height="114" rx="5" fill="#0a1824" stroke="#58a3c4" stroke-width="1.4"/>${Array.from({ length: 140 }, (_, i) => `<circle cx="${46 + (i % 28) * 20}" cy="${40 + Math.floor(i / 28) * 18}" r="${unit(`${scene.seed}|dot${i}`) < 0.45 ? 2.4 : 1.2}" fill="#4f9fc4" opacity="${unit(`${scene.seed}|do${i}`) < 0.5 ? 0.7 : 0.25}"/>`).join('')}<rect class="st-led" x="30" y="22" width="120" height="114" rx="5" fill="#9fdcf0" opacity=".1"/></g>`
    + `<g class="st-bug"><rect x="44" y="30" width="62" height="16" rx="3" fill="#c0392b"/><text x="75" y="42" text-anchor="middle" font-size="9.5" font-weight="900" fill="#fff" letter-spacing=".8">IN DIRETTA</text></g><rect x="96" y="58" width="448" height="58" rx="4" fill="#0a1824" fill-opacity=".82"/><text x="320" y="82" text-anchor="middle" font-size="19" font-weight="900" letter-spacing="2" fill="#f0d68a" textLength="${Math.min(440, 20 + String(scene.show?.name ?? '').length * 12)}" lengthAdjust="spacingAndGlyphs">${esc(String(scene.show?.name ?? 'Notiziario').toUpperCase())}</text><text x="320" y="108" text-anchor="middle" font-size="11" font-weight="700" fill="#cfe7f1">${esc(scene.topic.label)}</text>`
    + `${rigLights([70, 190, 320, 450, 570])}<g class="st-arm-l"><rect x="402" y="266" width="80" height="40" rx="14" fill="#2d4a5e"/></g><g class="st-arm-r"><rect x="520" y="266" width="80" height="40" rx="14" fill="#2d4a5e"/></g>`;
  const front = `<g class="st-desk"><rect x="86" y="266" width="250" height="52" rx="6" fill="#d9e3ea"/><rect x="86" y="266" width="250" height="6" rx="3" fill="#8fb4c6"/><rect x="108" y="273" width="206" height="22" rx="3" fill="#1b3446"/>${fitted(String(scene.show?.name ?? '').toUpperCase(), 211, 288, 10, 190, 'fill="#f0d68a" font-weight="900"')}</g>${cameraRig(44, true)}${cameraRig(596, false, true)}`;
  return { back, front, audience: '' };
}
// The strip of headlines (one per beat, from the situation of the game) and the name straps: drawn over the camera, inside the frame; the text is wrapped, never cut.
const wrapText = (text, chars) => { const lines = []; let current = ''; for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) { if (current && `${current} ${word}`.length > chars) { lines.push(current); current = word; } else current = current ? `${current} ${word}` : word; } if (current) lines.push(current); return lines; };
// Every strap has three lines, always inside its own box: the name, the role and the party (or, for someone who belongs to no party, the body he speaks for: the programme, the newspaper, the committee).
// The role and the party come from the cast (`roleLabel`, `partyLabel`); a scene saved before them has «Role · Party» in `tag`, and a person with neither shows what is known, never an empty line.
const tr = text => text && isEnglish() ? translateText(text) : text;
export function strapLines(member, fallbackBody = '') {
  const parts = String(member?.tag ?? '').split(' · ').map(item => item.trim()).filter(Boolean);
  const role = member?.roleLabel ?? parts[0] ?? '';
  const party = member?.partyLabel ?? (parts.length > 1 ? parts.slice(1).join(' · ') : '') ?? '';
  return { name: String(member?.name ?? ''), role: tr(role), party: tr(party || fallbackBody || '') };
}
export function strap(member, x, w, bottom, active, fallbackBody = '') {
  const lines = strapLines(member, fallbackBody);
  // sizes in stage units (the stage is 640 wide and is scaled to the screen: on a phone 12 units read as about 7 px, so the strap is set larger than it was)
  const nameLines = wrapText(lines.name, Math.floor((w - 18) / 7.4)), roleLines = wrapText(lines.role, Math.floor((w - 18) / 5.6)), partyLines = wrapText(lines.party, Math.floor((w - 18) / 5.8));
  const height = 8 + nameLines.length * 14 + roleLines.length * 11.5 + partyLines.length * 11.5 + 5, top = bottom - height;
  const nameY = i => top + 14 + i * 14, roleY = i => top + 14 + nameLines.length * 14 + 0.5 + i * 11.5, partyY = i => roleY(roleLines.length) + i * 11.5;
  return `<g class="st-strap${active ? ' is-speaking' : ''}" data-strap="${esc(member?.id ?? '')}"><rect x="${x}" y="${top}" width="${w}" height="${height}" rx="3" fill="#0c1d2b" fill-opacity=".94" stroke="${active ? '#f0d68a' : '#3d6277'}" stroke-width="${active ? 1.6 : 1}"/><rect x="${x}" y="${top}" width="4" height="${height}" rx="1.5" fill="${active ? '#f0d68a' : '#58a3c4'}"/>`
    + nameLines.map((text, i) => `<text class="st-strap-name" x="${x + 11}" y="${nameY(i)}" font-size="12.4" font-weight="800" fill="#fff">${esc(text)}</text>`).join('')
    + roleLines.map((text, i) => `<text class="st-strap-role" x="${x + 11}" y="${roleY(i)}" font-size="9.6" font-weight="600" fill="#bfd9e6">${esc(text)}</text>`).join('')
    + partyLines.map((text, i) => `<text class="st-strap-party" x="${x + 11}" y="${partyY(i)}" font-size="9.6" font-weight="800" fill="#f0d68a">${esc(text)}</text>`).join('') + '</g>';
}
export function studioOverlay(scene, node, uid) {
  const format = formatKey(scene);
  const member = role => scene.cast.find(item => item.role === role);
  const me = member('giocatore'), rival = member('rivale'), host = member('conduttore');
  const speaking = id => node?.speaker === id;
  const straps = format === 'faccia'
    ? `${strap(me, 8, 226, 332, speaking(me.id))}${strap(rival, 406, 226, 332, speaking(rival.id))}${speaking(host.id) ? strap(host, 238, 164, 332, true, scene.show?.name ?? '') : ''}`
    : `${strap(host, 8, 204, 332, speaking(host.id), scene.show?.name ?? '')}${strap(me, 218, 204, 332, speaking(me.id))}${strap(rival, 428, 204, 332, speaking(rival.id))}`;
  const slot = String(scene.show?.slot ?? 'In diretta').toUpperCase(), tab = Math.max(78, Math.round(slot.length * 5.8 + 18)), from = tab + 8, avail = 632 - from;
  const items = scene.ticker?.length ? scene.ticker : [`Tema: ${scene.topic.label}`];
  const index = Math.max(0, ['invito', 'preparazione', 'ingresso', 'q1', 'r1', 'domanda', 'risposta-rivale', 'q2', 'r2', 'attacco', 'r3', 'chiusura', 'esito'].indexOf(scene.nodeId));
  const text = items[index % items.length], natural = text.length * 5.7;
  return `<g class="st-ticker" aria-hidden="true"><defs><clipPath id="${uid}-tk"><rect x="${from}" y="338" width="${avail}" height="20"/></clipPath></defs><rect x="0" y="338" width="640" height="22" fill="#08121b"/><rect x="0" y="338" width="${tab}" height="22" fill="#b8353d"/><text x="${tab / 2}" y="352" text-anchor="middle" font-size="8.6" font-weight="900" letter-spacing=".5" fill="#fff">${esc(slot)}</text><g clip-path="url(#${uid}-tk)"><text x="${from}" y="352" font-size="9.6" font-weight="700" fill="#f4efe0"${natural > avail ? ` textLength="${avail}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(text)}</text></g></g><g class="st-straps">${straps}</g>`;
}

export function studioSvg(scene, stage, node, uid) {
  const format = formatKey(scene);
  const art = format === 'talk' ? studioTalk(scene, uid, stage.crowd) : format === 'intervista' ? studioIntervista(scene, uid) : studioFaccia(scene, uid, stage.crowd);
  const actors = [...scene.cast].sort((a, b) => (stage.poses[a.id]?.y ?? 0) - (stage.poses[b.id]?.y ?? 0)).map((member, index) => actorSvg(member, stage.poses[member.id], `${uid}a${index}`, { speaking: node.speaker === member.id, expression: node.speaker === member.id ? node.expression : null })).join('');
  return { body: `${art.back}${art.audience}<g class="st-actors">${actors}</g>${art.front}`, overlay: studioOverlay(scene, node, uid) };
}

// Text on the backdrop of the stage: words wrapped on as many lines as needed, the size lowered before a name is ever squeezed or cut (no textLength, no slice): the full name of the speaker and the full name
// of the party are always on the backdrop. Returns the SVG text elements, centred at x = 344 on the band 52..116.
export function wrapWords(text, maxChars) {
  const lines = [];
  for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && (last + ' ' + word).length <= maxChars) lines[lines.length - 1] = `${last} ${word}`; else lines.push(word);
  }
  return lines.length ? lines : [''];
}
export function backdropLines(name, party, width = 128) {
  const fit = (text, size, maxLines) => {
    let current = size, lines = wrapWords(text, Math.floor(width / (current * 0.6)));
    while ((lines.length > maxLines || lines.some(line => line.length * current * 0.6 > width + 1)) && current > 6.2) { current = Math.round((current - 0.6) * 10) / 10; lines = wrapWords(text, Math.floor(width / (current * 0.6))); }
    return { size: current, lines };
  };
  return { name: fit(name, 13.5, 2), party: fit(party, 9.5, 3) };
}
function backdropText(name, party, ink) {
  const { name: n, party: p } = backdropLines(name, party);
  const heightN = n.lines.length * (n.size + 2), heightP = p.lines.length * (p.size + 1.6), gap = p.lines[0] ? 4 : 0;
  let y = 84 - (heightN + gap + heightP) / 2;
  const out = [];
  for (const line of n.lines) { y += n.size + 2; out.push(`<text x="344" y="${(y - 3).toFixed(1)}" text-anchor="middle" class="st-name" font-size="${n.size}" font-weight="900" fill="${ink}">${esc(line)}</text>`); }
  y += gap;
  for (const line of p.lines) { y += p.size + 1.6; out.push(`<text x="344" y="${(y - 2.4).toFixed(1)}" text-anchor="middle" class="st-party" font-size="${p.size}" font-weight="700" fill="${ink}">${esc(line)}</text>`); }
  return out.join('');
}
export function squareSvg(scene, stage, node, uid, identity) {
  const color = identity?.accent ?? '#a82f3a', ink = inkOn(color);
  const me = scene.cast.find(item => item.role === 'giocatore'), partyName = String(identity?.name ?? scene.party.name ?? '');
  const playerY = stage.poses[me.id]?.y ?? 222;
  // the speaker walks along an aisle of the crowd (nobody stands in it); a row is drawn behind or in front of him by where his feet are
  const crowd = crowdSvg(scene.seed, [[262, 0.52, 18], [276, 0.64, 20], [291, 0.78, 20], [307, 0.92, 18]], { color, abbr: identity?.mark ?? identity?.abbreviation ?? scene.party.abbreviation ?? partyName, partyFull: partyName, aisle: [196, 282], split: true, signs: [], flags: [{ x: 108, kind: 'tricolore' }, { x: 150, kind: 'partito' }, { x: 176, kind: 'tricolore', y: 296 }, ...(stage.protest ? [] : [{ x: 540, kind: 'partito' }, { x: 600, kind: 'tricolore' }, { x: 500, kind: 'tricolore', y: 296 }])] });
  const actors = [...scene.cast].filter(item => item.role === 'giocatore').map((member, index) => actorSvg(member, stage.poses[member.id], `${uid}a${index}`, { speaking: node.speaker === member.id, expression: node.speaker === member.id ? node.expression : null })).join('');
  const lamps = [70, 190, 450, 570].map((x, i) => `<g><rect x="${x - 1.5}" y="150" width="3" height="104" fill="#2a2f36"/><circle class="st-bulb" style="--d:${i * 300}ms" cx="${x}" cy="148" r="5" fill="#ffe6a6"/></g>`).join('');
  const bulbs = Array.from({ length: 22 }, (_, i) => `<circle class="st-bulb" style="--d:${i * 140}ms" cx="${i * 30 - 10}" cy="${40 + Math.sin(i * 0.9) * 8 + 10}" r="2.6" fill="#ffd978"/>`).join('');
  const windows = (x0, w, rows, cols) => Array.from({ length: rows * cols }, (_, i) => `<rect x="${x0 + 12 + (i % cols) * (w - 24) / cols}" y="${74 + Math.floor(i / cols) * 34}" width="12" height="18" rx="2" fill="${unit(`${scene.seed}|w${x0}${i}`) < 0.55 ? '#f3d58a' : '#314054'}" opacity=".9"/>`).join('');
  const spots = [236, 330, 424].map((x, i) => `<g class="st-spot" style="--d:${i * 450}ms"><path d="M${x} 168L${x - 46} 232H${x + 46}Z" fill="#fff2c4" opacity=".1"/><circle cx="${x}" cy="166" r="5" fill="#fff6d8"/></g>`).join('');
  const protest = stage.protest ? protestSvg(scene.seed, scene.protest?.reason?.group ?? scene.protest?.reason?.label ?? 'protesta', scene.protest?.reason?.group ?? '', scene.protest?.reason?.slogans ?? []) : '';
  return { body: `<defs>${sky(`${uid}-sky`, '#1a2a4a', '#e0a06a')}${sky(`${uid}-ground`, '#5a5148', '#2c2823')}</defs>`
    + `<rect x="-200" y="-100" width="1040" height="330" fill="url(#${uid}-sky)"/>`
    + `<g class="st-town"><rect x="-60" y="52" width="160" height="190" fill="#3b3646"/>${windows(-60, 160, 5, 4)}<rect x="540" y="44" width="160" height="198" fill="#3a3342"/>${windows(540, 160, 5, 4)}`
    + `<rect x="196" y="76" width="248" height="112" fill="#6b5e52"/><rect x="196" y="76" width="248" height="10" fill="#4c4238"/>${[212, 244, 276, 308, 340, 372, 404].map(x => `<path d="M${x} 188V126a12 12 0 0 1 24 0V188Z" fill="#2a2420"/>`).join('')}<rect x="308" y="34" width="24" height="44" fill="#5b4f45"/><circle cx="320" cy="52" r="8" fill="#efe3c4"/><path d="M320 52V46M320 52H325" stroke="#2a2420" stroke-width="1.4"/><path d="M308 34H332L320 18Z" fill="#7a3c33"/><rect x="319" y="2" width="2" height="18" fill="#c8c0a8"/><path class="cm-cloth" d="M321 2h18v7h-18Z" fill="#fff"/></g>`
    + `<rect x="-200" y="212" width="1040" height="200" fill="url(#${uid}-ground)"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${-60 + i * 90} 360L${160 + i * 40} 214" stroke="#000" stroke-opacity=".12" stroke-width="1"/>`).join('')}`
    + `<g class="st-bulbs">${bulbs}</g>${lamps}`
    + `<g class="st-palco"><rect x="170" y="196" width="300" height="46" fill="#2c2f38"/><rect x="170" y="196" width="300" height="6" fill="#8d96a6"/><rect x="170" y="232" width="300" height="12" fill="${color}"/><rect x="236" y="152" width="168" height="6" fill="#1a1d23"/><rect x="236" y="152" width="4" height="46" fill="#1a1d23"/><rect x="400" y="152" width="4" height="46" fill="#1a1d23"/>`
    + `<g class="st-backdrop" data-backdrop><rect x="206" y="46" width="228" height="76" rx="4" fill="${color}" stroke="${ink === '#ffffff' ? 'rgba(255,255,255,.55)' : 'rgba(20,24,22,.55)'}" stroke-width="1.2"/>${logoMark(identity, 246, 84, 40, uid)}${backdropText(me.name, partyName, ink)}</g>`
    + `<g class="st-speaker"><rect x="176" y="164" width="22" height="32" rx="3" fill="#111"/><circle cx="187" cy="174" r="5" fill="#333"/><circle cx="187" cy="187" r="7" fill="#333"/></g><g class="st-speaker"><rect x="442" y="164" width="22" height="32" rx="3" fill="#111"/><circle cx="453" cy="174" r="5" fill="#333"/><circle cx="453" cy="187" r="7" fill="#333"/></g>${spots}`
    + `<path d="M232 244H262V250H232Z" fill="#4b4f5a"/><path d="M226 250H268V256H226Z" fill="#4b4f5a"/>`
    + `<g class="st-mic"><rect x="329" y="170" width="2.4" height="52" fill="#1a1d23"/><ellipse cx="330" cy="168" rx="4" ry="6" fill="#222"/><path d="M322 222H338" stroke="#1a1d23" stroke-width="3"/></g></g>`
    + `${crowd.rows.filter(row => row.y <= playerY).map(row => `<g class="st-crowd is-${stage.crowd}" data-crowd>${row.html}</g>`).join('')}`
    + `${protest}<g class="st-actors">${actors}</g>`
    + `${crowd.rows.filter(row => row.y > playerY).map(row => `<g class="st-crowd is-${stage.crowd}" data-crowd>${row.html}</g>`).join('')}<g class="st-flags is-${stage.crowd}">${crowd.extra}</g>` };
}

export function stationSvg(scene, stage, node, uid) {
  const drawn = (list, offset) => list.map((member, index) => actorSvg(member, stage.poses[member.id], `${uid}a${index + offset}`, { speaking: false })).join('');
  const behind = drawn(scene.cast.filter(item => item.role === 'scrutatore'), 0), front = drawn(scene.cast.filter(item => item.role !== 'scrutatore'), 5);
  const closed = stage.props.booth === 'closed';
  const ballot = stage.props.ballot ?? 'none';
  // the ballot follows the hand of the voter (the same formula the player uses while it moves it); when the voter is out of sight in the booth, the ballot is out of sight with them
  const voter = scene.cast.find(item => item.role === 'giocatore'), vp = voter ? stage.poses[voter.id] : null;
  const handAt = vp && vp.visible !== false ? [Math.round(vp.x + 30 * vp.s * (vp.facing ?? 1)), Math.round(vp.y - 140 * vp.s)] : [-99, -99];
  const ballotPos = { desk: [330, 262], hand: handAt, folded: handAt, urn: [160, 236], none: [-99, -99] }[ballot] ?? [-99, -99];
  return { body: `<defs>${sky(`${uid}-wall`, '#d8d2c0', '#bdb59f')}${sky(`${uid}-fl`, '#8f8573', '#5c5448')}</defs>`
    + `<rect x="-200" y="-100" width="1040" height="300" fill="url(#${uid}-wall)"/><rect x="-200" y="200" width="1040" height="260" fill="url(#${uid}-fl)"/>`
    + `<g class="st-room"><rect x="60" y="40" width="120" height="86" fill="#9fc4d8" stroke="#6d5d3e" stroke-width="5"/><path d="M120 40V126M60 83H180" stroke="#6d5d3e" stroke-width="3"/><rect x="212" y="46" width="216" height="44" rx="3" fill="#f5f0e2" stroke="#8f8573"/><text x="320" y="64" text-anchor="middle" font-size="13" font-weight="900" fill="#1f3a56">SEGGIO ELETTORALE</text>${fitted(String(scene.place.label ?? '').toUpperCase(), 320, 81, 10, 190, 'fill="#5b5547" font-weight="800"')}`
    + `<rect x="560" y="70" width="64" height="132" fill="#7a5f3f"/><rect x="566" y="78" width="52" height="124" fill="#5b452d"/><rect x="560" y="60" width="64" height="12" fill="#3d7a4b"/><rect x="592" y="60" width="32" height="12" fill="#b8353d"/><text x="592" y="104" text-anchor="middle" font-size="9" font-weight="800" fill="#e8d9b8">USCITA</text></g>`
    + `<g class="st-actors st-back">${behind}</g><g class="st-desk"><rect x="222" y="250" width="196" height="58" rx="4" fill="#7c5e3d"/><rect x="222" y="250" width="196" height="8" rx="3" fill="#a07f57"/><rect x="236" y="260" width="38" height="22" fill="#f1ecdd" stroke="#8f8573"/><rect x="288" y="260" width="38" height="22" fill="#f1ecdd" stroke="#8f8573"/></g>`
    + `<g class="st-urn" style="transform:translate(160px,306px)"><rect x="-40" y="-70" width="80" height="70" rx="4" fill="#cfe1ea" fill-opacity=".55" stroke="#5f7b8a" stroke-width="3"/><rect x="-18" y="-76" width="36" height="8" rx="2" fill="#223645"/><rect x="-34" y="-30" width="68" height="30" fill="#f4efe0" opacity=".7"/></g>`
    + `<g class="st-booth" data-booth="${closed ? 'closed' : 'open'}" style="transform:translate(474px,300px)"><rect x="-58" y="-172" width="116" height="172" fill="#e6dec9" stroke="#8f8573" stroke-width="3"/><rect x="-58" y="-184" width="116" height="14" fill="#2c4f78"/><text x="0" y="-173.5" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">CABINA</text><rect x="-48" y="-92" width="96" height="10" fill="#7c5e3d"/>`
    + `<g class="st-pencil"><rect x="-4" y="-104" width="3" height="20" fill="#b8353d"/></g></g>`
    + `<g class="st-actors">${front}</g>`
    // the curtain is the lower part of the booth (from the waist down: the voter stays in view above it); drawn open it is gathered at the right side, closed it covers the front
    + `<g class="st-curtain${closed ? ' is-closed' : ''}" data-curtain style="transform:${closed ? 'translate(474px,300px)' : 'translate(530px,300px) scaleX(.16)'}"><path d="M-58 -78H58V-20H-58Z" fill="#2c4f78" opacity=".97"/><rect x="-58" y="-80" width="116" height="4" fill="#1d3a5c"/>${[-48, -32, -16, 0, 16, 32, 48].map(x => `<path d="M${x} -78V-20" stroke="#1d3a5c" stroke-width="3"/>`).join('')}</g>`
    + `<g class="st-ballot" data-ballot="${ballot}" style="transform:translate(${ballotPos[0]}px,${ballotPos[1]}px)"><rect x="-9" y="-12" width="18" height="24" rx="1.5" fill="#fffdf2" stroke="#3a2f22" stroke-width="1.2"${ballot === 'folded' || ballot === 'urn' ? ' style="transform:scaleX(.5)"' : ''}/>${ballot === 'folded' || ballot === 'urn' ? '' : '<path d="M-5 -6H5M-5 -1H5M-5 4H5" stroke="#3a2f22" stroke-width="1"/>'}</g>` };
}

// ---------- the cameras ----------
export const CAMERAS = Object.freeze({
  wide: { x: 320, y: 180, s: 1 }, panorama: { x: 320, y: 186, s: 1 }, host: { x: 320, y: 232, s: 1.3 }, left: { x: 150, y: 235, s: 1.7 }, right: { x: 490, y: 235, s: 1.7 }, crowd: { x: 320, y: 290, s: 1.5 },
  follow: { x: 260, y: 270, s: 1.3 }, stage: { x: 330, y: 190, s: 1.45 }, protest: { x: 420, y: 205, s: 1.15 }, player: { x: 330, y: 182, s: 1.8 }, 'talk-host': { x: 190, y: 242, s: 1.6 }, 'talk-left': { x: 450, y: 252, s: 1.8 }, 'talk-right': { x: 560, y: 252, s: 1.8 }, 'intervista-host': { x: 215, y: 246, s: 1.6 }, 'intervista-left': { x: 442, y: 252, s: 1.8 }, 'intervista-right': { x: 558, y: 252, s: 1.8 }, booth: { x: 440, y: 222, s: 1.4 }, urn: { x: 220, y: 235, s: 1.35 }
});
export const cameraTransform = name => { const c = CAMERAS[name] ?? CAMERAS.wide; return `translate(${(STAGE_W / 2 - c.s * c.x).toFixed(1)}px,${(STAGE_H / 2 - c.s * c.y).toFixed(1)}px) scale(${c.s})`; };
export { depthScale, STAGE_W, STAGE_H, defsOf };

// The whole stage of a beat as one SVG. `before` (optional) is JSON the player reads to animate the passage from the previous beat.
// Settings of other kinds (the rooms of the optional scenes, ui/room-art.js) register their drawing here: (scene, stage, node, uid) -> { body, overlay }.
const SETTINGS = {};
export const registerStageSetting = (setting, fn) => { SETTINGS[setting] = fn; };
export function renderStageSvg(scene, stage, node, { identity = null, before = null, label = '' } = {}) {
  const uid = `st${hash(scene.id) % 9973}`;
  const art = SETTINGS[scene.setting] ? SETTINGS[scene.setting](scene, stage, node, uid, identity) : scene.setting === 'piazza' ? squareSvg(scene, stage, node, uid, identity) : scene.setting === 'seggio' ? stationSvg(scene, stage, node, uid) : studioSvg(scene, stage, node, uid);
  const data = esc(JSON.stringify({ node: scene.nodeId, camera: stage.camera, crowd: stage.crowd, props: stage.props ?? {}, before }));
  return `<svg class="st-svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}" role="img" aria-label="${esc(label)}" data-stage="${data}" data-setting="${esc(scene.setting)}"${scene.format ? ` data-format="${esc(scene.format)}"` : ''} preserveAspectRatio="xMidYMid slice"><g class="st-cam" data-camera="${esc(stage.camera)}" style="transform-origin:0 0;transform:${cameraTransform(stage.camera)}">${art.body}</g>${art.overlay ?? ''}</svg>`;
}
