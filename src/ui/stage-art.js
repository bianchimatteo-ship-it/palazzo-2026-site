// The drawing of the stages (2D, SVG, 640 x 360 units): the television studio, the square of a rally, the polling station, and the characters that stand in them. A character is built from the avatar of
// its person (avatar-svg.js: always the avatar saved for the player, a stable one for the others) plus a body drawn here — torso, two arms with an elbow, two legs — in separate groups, so that the
// player (ui/stage-player.js) can make them walk, sit, gesture. Every group carries the data the player needs (class, data-*); the poses come from core/stage-script.js. No animation is started here:
// what is drawn is the FINAL pose of the beat, so with the motion off or reduced, or in a scene resumed, the stage is already right.
import { avatarColors, avatarParts, shade } from './avatar-svg.js?v=20261107-1';
import { depthScale, STAGE_W, STAGE_H } from '../core/stage-script.js?v=20261107-1';
import { defaultAvatarFor } from '../core/avatar.js?v=20261107-1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hash = text => { let h = 2166136261 >>> 0; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = text => hash(text) / 4294967296;

// ---------- the arms: [upper, fore] angles in degrees for the left and the right arm, by gesture ----------
export const GESTURES = Object.freeze({
  riposo: { l: [5, 3], r: [-5, -3] }, sottolinea: { l: [6, 4], r: [-38, -62] }, apre: { l: [40, 22], r: [-40, -22] }, indica: { l: [6, 4], r: [-74, -6] }, saluta: { l: [6, 4], r: [-148, -22] },
  ascolta: { l: [8, 10], r: [-8, -10] }, pensa: { l: [6, 4], r: [-44, -132] }, prende: { l: [6, 4], r: [-46, -40] }, porge: { l: [6, 4], r: [-52, -30] }, scrive: { l: [8, 6], r: [-30, -78] },
  piega: { l: [24, 76], r: [-24, -76] }, inserisce: { l: [6, 4], r: [-62, -24] }, applaude: { l: [16, 78], r: [-16, -78] }, sedutoRiposo: { l: [16, 56], r: [-16, -56] }
});
export const gestureAngles = (name, posture) => GESTURES[name] ?? (posture === 'sit' ? GESTURES.sedutoRiposo : GESTURES.riposo);

// ---------- a character ----------
// Local coordinates: the feet at (0, 0), the figure about 270 units tall, the shoulders at y = -200, the hips at y = -105. `pose` is the final pose of the beat.
export function actorSvg(member, pose, uid, { speaking = false, expression = null } = {}) {
  const avatar = member.avatar ?? defaultAvatarFor(member.id);
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
function crowdSvg(seed, rows, { color = '#9c2f39', signs = [], flags = 3, x0 = 20, x1 = 620 } = {}) {
  const hairs = ['#2b2118', '#3a2a1c', '#5a4632', '#8a7355', '#20262e', '#b9b2a4', '#6a3a24'];
  const tops = ['#27414a', '#3d3a52', '#4a3b34', '#1f3a33', '#53424a', '#2f3b52'];
  let out = '';
  rows.forEach(([y, scale, count], row) => {
    for (let i = 0; i < count; i++) {
      const key = `${seed}|${row}|${i}`;
      const x = x0 + (x1 - x0) * (i + 0.5 + (unit(key + 'x') - 0.5) * 0.7) / count;
      const s = scale * (0.92 + unit(key + 's') * 0.2);
      const hair = hairs[hash(key + 'h') % hairs.length], top = tops[hash(key + 't') % tops.length];
      const arms = unit(key + 'a') < 0.55;
      out += `<g class="cm" style="--d:${Math.round(unit(key + 'd') * 600)}ms;transform:translate(${x.toFixed(1)}px,${y}px) scale(${s.toFixed(2)})"><g class="cm-in">`
        + (arms ? `<g class="cm-arm cm-arm-l"><rect x="-17" y="-34" width="6" height="30" rx="3" fill="${top}"/><circle cx="-14" cy="-36" r="4" fill="#d9b48f"/></g><g class="cm-arm cm-arm-r"><rect x="11" y="-34" width="6" height="30" rx="3" fill="${top}"/><circle cx="14" cy="-36" r="4" fill="#d9b48f"/></g>` : '')
        + `<path d="M-19 8C-19 -8 -10 -13 0 -13S19 -8 19 8Z" fill="${top}"/><circle cx="0" cy="-22" r="11" fill="${hair}"/></g></g>`;
    }
  });
  for (let f = 0; f < flags; f++) {
    const slots = [60, 150, 520, 600, 40, 560]; const x = slots[f % slots.length] + (x1 - 640), y = 280 + (f % 2) * 12;
    out += `<g class="cm-flag" style="--d:${f * 220}ms;transform:translate(${x.toFixed(0)}px,${y}px)"><rect x="-1.2" y="-74" width="2.4" height="70" fill="#c8c0a8"/><path class="cm-cloth" d="M1 -74 q12 -5 24 0 t24 0 v22 q-12 5 -24 0 t-24 0Z" fill="${f % 3 === 1 ? '#f2f0ea' : color}"/></g>`;
  }
  signs.forEach((text, i) => { const x = [150, 540, 90, 600][i % 4] + unit(`${seed}|sg${i}`) * 20, y = 292 + (i % 2) * 8; out += `<g class="cm-sign" style="--d:${i * 180}ms;transform:translate(${x.toFixed(0)}px,${y}px)"><rect x="-1.2" y="-58" width="2.4" height="54" fill="#8b7a5e"/><rect x="-30" y="-90" width="60" height="32" rx="2" fill="#f4efe0" stroke="#3a2f22" stroke-width="1.4"/><text x="0" y="-70" text-anchor="middle" font-size="9" font-weight="800" fill="#3a2f22" textLength="50" lengthAdjust="spacingAndGlyphs">${esc(text)}</text></g>`; });
  return out;
}
// the protesters: a group with signs and a banner, drawn like the crowd but facing the stage and moving as a block
function protestSvg(seed, label) {
  const people = [0, 1, 2, 3, 4, 5].map(i => { const x = 520 + (i % 3) * 34 + unit(`${seed}|pp${i}`) * 10, y = 304 + Math.floor(i / 3) * 22; return `<g class="cm cm-protest" style="--d:${i * 90}ms;transform:translate(${x.toFixed(0)}px,${y}px) scale(.7)"><g class="cm-in"><g class="cm-arm cm-arm-l"><rect x="-17" y="-34" width="6" height="30" rx="3" fill="#3b2a2a"/><circle cx="-14" cy="-36" r="4" fill="#d9b48f"/></g><path d="M-19 8C-19 -8 -10 -13 0 -13S19 -8 19 8Z" fill="#3b2a2a"/><circle cx="0" cy="-22" r="11" fill="#2b2118"/></g></g>`; }).join('');
  return `<g class="st-protest"><g class="st-banner" style="transform:translate(494px,236px)"><rect x="-74" y="-24" width="148" height="34" rx="2" fill="#f4efe0" stroke="#7a1f24" stroke-width="2"/><text x="0" y="-3" text-anchor="middle" font-size="9.5" font-weight="900" fill="#7a1f24" textLength="132" lengthAdjust="spacingAndGlyphs">${esc(label.toUpperCase().slice(0, 34))}</text><rect x="-60" y="10" width="2.4" height="62" fill="#8b7a5e"/><rect x="58" y="10" width="2.4" height="62" fill="#8b7a5e"/></g>${people}</g>`;
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

function studioBack(scene, uid, title, subtitle) {
  const leds = [60, 250, 440].map((x, i) => `<g><rect x="${x}" y="28" width="140" height="82" rx="4" fill="${i === 1 ? '#1d5470' : '#173f55'}" stroke="#58a3c4" stroke-width="1.2"/><rect class="st-led" style="--d:${i * 700}ms" x="${x}" y="28" width="46" height="82" rx="4" fill="#9fdcf0" opacity=".14"/></g>`).join('');
  return `<defs>${sky(`${uid}-wall`, '#0e2236', '#081523')}${sky(`${uid}-floor`, '#16222c', '#080d12')}<radialGradient id="${uid}-pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".42"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient></defs>`
    + `<rect x="-200" y="-100" width="1040" height="400" fill="url(#${uid}-wall)"/>${leds}`
    + `<text x="320" y="64" text-anchor="middle" font-size="19" font-weight="900" letter-spacing="3" fill="#f0d68a">${esc(title)}</text><text x="320" y="88" text-anchor="middle" font-size="10.5" font-weight="700" fill="#cfe7f1" textLength="${Math.min(260, 20 + String(subtitle).length * 6)}" lengthAdjust="spacingAndGlyphs">${esc(subtitle)}</text>`
    + `<rect x="-200" y="196" width="1040" height="260" fill="url(#${uid}-floor)"/><ellipse cx="128" cy="300" rx="150" ry="34" fill="url(#${uid}-pool)"/><ellipse cx="512" cy="300" rx="150" ry="34" fill="url(#${uid}-pool)"/><ellipse cx="320" cy="270" rx="120" ry="26" fill="url(#${uid}-pool)"/>`
    + `<g class="st-rig"><rect x="-200" y="0" width="1040" height="10" fill="#0a0f14"/>${[40, 150, 260, 380, 490, 600].map((x, i) => `<g class="st-light" style="--d:${i * 380}ms"><rect x="${x - 7}" y="8" width="14" height="10" rx="2" fill="#222a32"/><path d="M${x - 5} 18L${x - 28} 80H${x + 28}L${x + 5} 18Z" fill="#fff4cc" opacity=".05"/></g>`).join('')}</g>`;
}
function studioFront(scene, members) {
  const [me, rival, host] = members;
  const desk = (x, w, y, h = 46) => `<g class="st-desk"><rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="5" fill="#26333f"/><rect x="${x - w / 2}" y="${y}" width="${w}" height="6" rx="3" fill="#6f9fb4"/>${plate(x, y + 21, w - 22, members.find(m => (x < 200 && m.role === 'giocatore') || (x > 440 && m.role === 'rivale') || (x === 320 && m.role === 'conduttore'))?.name.split(' ').slice(-1)[0] ?? '')}</g>`;
  const camera = (x, tally) => `<g class="st-camera" style="transform:translate(${x}px,334px)"><rect x="-22" y="-26" width="44" height="30" rx="5" fill="#1b232b"/><rect x="-16" y="-34" width="32" height="12" rx="3" fill="#2c3944"/><circle cx="0" cy="-12" r="9" fill="#0b0f13" stroke="#5c6b78" stroke-width="2"/><circle class="st-tally${tally ? ' is-on' : ''}" cx="16" cy="-30" r="3" fill="#d42e2e"/><rect x="-3" y="4" width="6" height="14" fill="#38444f"/></g>`;
  return `${desk(128, 190, 246, 50)}${desk(512, 190, 246, 50)}${desk(320, 160, 222, 44)}${camera(46, true)}${camera(594, false)}`;
}
function audienceSides(seed, crowd) { return `<g class="st-crowd is-${crowd}" data-crowd>${crowdSvg(`${seed}|aud`, [[352, 0.62, 5], [338, 0.5, 6]], { x0: 8, x1: 124, flags: 0 })}${crowdSvg(`${seed}|aud2`, [[352, 0.62, 5], [338, 0.5, 6]], { x0: 516, x1: 632, flags: 0 })}</g>`; }

export function studioSvg(scene, stage, node, uid) {
  const members = ['giocatore', 'rivale', 'conduttore'].map(role => scene.cast.find(item => item.role === role));
  const actors = [...scene.cast].sort((a, b) => (stage.poses[a.id]?.y ?? 0) - (stage.poses[b.id]?.y ?? 0)).map((member, index) => actorSvg(member, stage.poses[member.id], `${uid}a${index}`, { speaking: node.speaker === member.id, expression: node.speaker === member.id ? node.expression : null })).join('');
  const kind = scene.kind === 'talkshow' ? 'IN STUDIO' : 'FACCIA A FACCIA';
  return { defs: '', body: `${studioBack(scene, uid, kind, scene.kind === 'talkshow' ? 'L’ospite della serata' : scene.topic.label)}<g class="st-hostdesk-bg"></g>${audienceSides(scene.seed, stage.crowd)}<g class="st-actors">${actors}</g>${studioFront(scene, members)}` };
}

export function squareSvg(scene, stage, node, uid, identity) {
  const color = identity?.accent ?? '#a82f3a';
  const actors = [...scene.cast].filter(item => item.role === 'giocatore').map((member, index) => actorSvg(member, stage.poses[member.id], `${uid}a${index}`, { speaking: node.speaker === member.id, expression: node.speaker === member.id ? node.expression : null })).join('');
  const lamps = [70, 190, 450, 570].map((x, i) => `<g><rect x="${x - 1.5}" y="150" width="3" height="104" fill="#2a2f36"/><circle class="st-bulb" style="--d:${i * 300}ms" cx="${x}" cy="148" r="5" fill="#ffe6a6"/></g>`).join('');
  const bulbs = Array.from({ length: 22 }, (_, i) => `<circle class="st-bulb" style="--d:${i * 140}ms" cx="${i * 30 - 10}" cy="${40 + Math.sin(i * 0.9) * 8 + 10}" r="2.6" fill="#ffd978"/>`).join('');
  const windows = (x0, w, rows, cols) => Array.from({ length: rows * cols }, (_, i) => `<rect x="${x0 + 12 + (i % cols) * (w - 24) / cols}" y="${74 + Math.floor(i / cols) * 34}" width="12" height="18" rx="2" fill="${unit(`${scene.seed}|w${x0}${i}`) < 0.55 ? '#f3d58a' : '#314054'}" opacity=".9"/>`).join('');
  const spots = [236, 330, 424].map((x, i) => `<g class="st-spot" style="--d:${i * 450}ms"><path d="M${x} 168L${x - 46} 232H${x + 46}Z" fill="#fff2c4" opacity=".1"/><circle cx="${x}" cy="166" r="5" fill="#fff6d8"/></g>`).join('');
  const protest = stage.protest ? protestSvg(scene.seed, scene.protest?.reason?.label ?? 'protesta') : '';
  return { body: `<defs>${sky(`${uid}-sky`, '#1a2a4a', '#e0a06a')}${sky(`${uid}-ground`, '#5a5148', '#2c2823')}</defs>`
    + `<rect x="-200" y="-100" width="1040" height="330" fill="url(#${uid}-sky)"/>`
    + `<g class="st-town"><rect x="-60" y="52" width="160" height="190" fill="#3b3646"/>${windows(-60, 160, 5, 4)}<rect x="540" y="44" width="160" height="198" fill="#3a3342"/>${windows(540, 160, 5, 4)}`
    + `<rect x="196" y="76" width="248" height="112" fill="#6b5e52"/><rect x="196" y="76" width="248" height="10" fill="#4c4238"/>${[212, 244, 276, 308, 340, 372, 404].map(x => `<path d="M${x} 188V126a12 12 0 0 1 24 0V188Z" fill="#2a2420"/>`).join('')}<rect x="308" y="34" width="24" height="44" fill="#5b4f45"/><circle cx="320" cy="52" r="8" fill="#efe3c4"/><path d="M320 52V46M320 52H325" stroke="#2a2420" stroke-width="1.4"/><path d="M308 34H332L320 18Z" fill="#7a3c33"/><rect x="319" y="2" width="2" height="18" fill="#c8c0a8"/><path class="cm-cloth" d="M321 2h18v7h-18Z" fill="#fff"/></g>`
    + `<rect x="-200" y="212" width="1040" height="200" fill="url(#${uid}-ground)"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${-60 + i * 90} 360L${160 + i * 40} 214" stroke="#000" stroke-opacity=".12" stroke-width="1"/>`).join('')}`
    + `<g class="st-bulbs">${bulbs}</g>${lamps}`
    + `<g class="st-palco"><rect x="170" y="196" width="300" height="46" fill="#2c2f38"/><rect x="170" y="196" width="300" height="6" fill="#8d96a6"/><rect x="170" y="232" width="300" height="12" fill="${color}"/><rect x="236" y="152" width="168" height="6" fill="#1a1d23"/><rect x="236" y="152" width="4" height="46" fill="#1a1d23"/><rect x="400" y="152" width="4" height="46" fill="#1a1d23"/>`
    + `<g class="st-backdrop"><rect x="214" y="86" width="212" height="62" rx="4" fill="${color}"/>${logoMark(identity, 262, 117, 42, uid)}<text x="352" y="112" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" textLength="116" lengthAdjust="spacingAndGlyphs">${esc((identity?.name ?? scene.party.name).toUpperCase().slice(0, 22))}</text><text x="352" y="128" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" opacity=".9">${esc(scene.place.label)}</text></g>`
    + `<g class="st-speaker"><rect x="176" y="164" width="22" height="32" rx="3" fill="#111"/><circle cx="187" cy="174" r="5" fill="#333"/><circle cx="187" cy="187" r="7" fill="#333"/></g><g class="st-speaker"><rect x="442" y="164" width="22" height="32" rx="3" fill="#111"/><circle cx="453" cy="174" r="5" fill="#333"/><circle cx="453" cy="187" r="7" fill="#333"/></g>${spots}`
    + `<path d="M232 244H262V250H232Z" fill="#4b4f5a"/><path d="M226 250H268V256H226Z" fill="#4b4f5a"/>`
    + `<g class="st-mic"><rect x="329" y="170" width="2.4" height="52" fill="#1a1d23"/><ellipse cx="330" cy="168" rx="4" ry="6" fill="#222"/><path d="M322 222H338" stroke="#1a1d23" stroke-width="3"/></g></g>`
    + `<g class="st-crowd is-${stage.crowd}" data-crowd>${crowdSvg(scene.seed, [[262, 0.52, 18], [276, 0.64, 20], [291, 0.78, 20], [307, 0.92, 18]], { color, signs: scene.protest?.arrived ? [] : ['SI VOTA', 'INSIEME'], flags: 5 })}</g>`
    + `${protest}<g class="st-actors">${actors}</g>` };
}

export function stationSvg(scene, stage, node, uid) {
  const drawn = (list, offset) => list.map((member, index) => actorSvg(member, stage.poses[member.id], `${uid}a${index + offset}`, { speaking: false })).join('');
  const behind = drawn(scene.cast.filter(item => item.role === 'scrutatore'), 0), front = drawn(scene.cast.filter(item => item.role !== 'scrutatore'), 5);
  const closed = stage.props.booth === 'closed';
  const ballot = stage.props.ballot ?? 'none';
  const ballotPos = { desk: [330, 262], hand: [0, 0], folded: [0, 0], urn: [160, 238], none: [-99, -99] }[ballot] ?? [-99, -99];
  return { body: `<defs>${sky(`${uid}-wall`, '#d8d2c0', '#bdb59f')}${sky(`${uid}-fl`, '#8f8573', '#5c5448')}</defs>`
    + `<rect x="-200" y="-100" width="1040" height="300" fill="url(#${uid}-wall)"/><rect x="-200" y="200" width="1040" height="260" fill="url(#${uid}-fl)"/>`
    + `<g class="st-room"><rect x="60" y="40" width="120" height="86" fill="#9fc4d8" stroke="#6d5d3e" stroke-width="5"/><path d="M120 40V126M60 83H180" stroke="#6d5d3e" stroke-width="3"/><rect x="222" y="50" width="196" height="26" rx="3" fill="#f5f0e2" stroke="#8f8573"/><text x="320" y="68" text-anchor="middle" font-size="13" font-weight="900" fill="#1f3a56">SEGGIO ELETTORALE</text>`
    + `<rect x="560" y="70" width="64" height="132" fill="#7a5f3f"/><rect x="566" y="78" width="52" height="124" fill="#5b452d"/><rect x="560" y="60" width="64" height="12" fill="#3d7a4b"/><rect x="592" y="60" width="32" height="12" fill="#b8353d"/><text x="592" y="104" text-anchor="middle" font-size="9" font-weight="800" fill="#e8d9b8">USCITA</text></g>`
    + `<g class="st-actors st-back">${behind}</g><g class="st-desk"><rect x="222" y="250" width="196" height="58" rx="4" fill="#7c5e3d"/><rect x="222" y="250" width="196" height="8" rx="3" fill="#a07f57"/><rect x="236" y="260" width="38" height="22" fill="#f1ecdd" stroke="#8f8573"/><rect x="288" y="260" width="38" height="22" fill="#f1ecdd" stroke="#8f8573"/>${plate(320, 296, 120, scene.place.label.slice(0, 18), { fill: '#e8e0c8' })}</g>`
    + `<g class="st-urn" style="transform:translate(160px,306px)"><rect x="-40" y="-70" width="80" height="70" rx="4" fill="#cfe1ea" fill-opacity=".55" stroke="#5f7b8a" stroke-width="3"/><rect x="-18" y="-76" width="36" height="8" rx="2" fill="#223645"/><rect x="-34" y="-30" width="68" height="30" fill="#f4efe0" opacity=".7"/></g>`
    + `<g class="st-booth" data-booth="${closed ? 'closed' : 'open'}" style="transform:translate(474px,300px)"><rect x="-58" y="-142" width="116" height="142" fill="#e6dec9" stroke="#8f8573" stroke-width="3"/><rect x="-58" y="-152" width="116" height="12" fill="#2c4f78"/><text x="0" y="-143" text-anchor="middle" font-size="8" font-weight="900" fill="#fff">CABINA</text><rect x="-48" y="-92" width="96" height="10" fill="#7c5e3d"/>`
    + `<g class="st-pencil"><rect x="-4" y="-104" width="3" height="20" fill="#b8353d"/></g></g>`
    + `<g class="st-actors">${front}</g>`
    + `<g class="st-curtain${closed ? ' is-closed' : ''}" data-curtain style="transform:translate(474px,300px)"><path d="M-60 -148H60V-20H-60Z" fill="#2c4f78" opacity=".96"/>${[-48, -32, -16, 0, 16, 32, 48].map(x => `<path d="M${x} -148V-20" stroke="#1d3a5c" stroke-width="3"/>`).join('')}</g>`
    + `<g class="st-ballot" data-ballot="${ballot}" style="transform:translate(${ballotPos[0]}px,${ballotPos[1]}px)"><rect x="-9" y="-12" width="18" height="24" rx="1.5" fill="#fffdf2" stroke="#3a2f22" stroke-width="1.2"/><path d="M-5 -6H5M-5 -1H5M-5 4H5" stroke="#3a2f22" stroke-width="1"/></g>` };
}

// ---------- the cameras ----------
export const CAMERAS = Object.freeze({
  wide: { x: 320, y: 180, s: 1 }, panorama: { x: 320, y: 186, s: 1 }, host: { x: 320, y: 232, s: 1.3 }, left: { x: 150, y: 235, s: 1.7 }, right: { x: 490, y: 235, s: 1.7 }, crowd: { x: 320, y: 290, s: 1.5 },
  follow: { x: 260, y: 270, s: 1.3 }, stage: { x: 330, y: 190, s: 1.45 }, protest: { x: 420, y: 240, s: 1.2 }, player: { x: 330, y: 182, s: 1.8 }, booth: { x: 440, y: 222, s: 1.4 }, urn: { x: 220, y: 235, s: 1.35 }
});
export const cameraTransform = name => { const c = CAMERAS[name] ?? CAMERAS.wide; return `translate(${(STAGE_W / 2 - c.s * c.x).toFixed(1)}px,${(STAGE_H / 2 - c.s * c.y).toFixed(1)}px) scale(${c.s})`; };
export { depthScale, STAGE_W, STAGE_H, defsOf };

// The whole stage of a beat as one SVG. `before` (optional) is JSON the player reads to animate the passage from the previous beat.
export function renderStageSvg(scene, stage, node, { identity = null, before = null, label = '' } = {}) {
  const uid = `st${hash(scene.id) % 9973}`;
  const art = scene.setting === 'piazza' ? squareSvg(scene, stage, node, uid, identity) : scene.setting === 'seggio' ? stationSvg(scene, stage, node, uid) : studioSvg(scene, stage, node, uid);
  const data = esc(JSON.stringify({ node: scene.nodeId, camera: stage.camera, crowd: stage.crowd, before }));
  return `<svg class="st-svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}" role="img" aria-label="${esc(label)}" data-stage="${data}" data-setting="${esc(scene.setting)}" preserveAspectRatio="xMidYMid slice"><g class="st-cam" data-camera="${esc(stage.camera)}" style="transform-origin:0 0;transform:${cameraTransform(stage.camera)}">${art.body}</g></svg>`;
}
