// The rooms of the six optional scenes (core/activity-scenes.js), drawn in SVG on the same 640 x 360 stage as the studios, the square and the polling station: the civic hall, the building site, the party
// headquarters, the committee room, the newsroom and the room of the Council of Ministers. Each room is a back layer (walls, windows, furniture), the characters (the same ones the other stages use,
// made from the avatars of the game), and a front layer (the table in front of whoever sits). Name straps with the full name and the role of everyone are drawn over the camera (never cut: the text is
// wrapped). Loaded with the scene page; it registers its settings in stage-art.js. Nothing here decides anything: it draws the poses that core/activity-scenes.js gives.
import { actorSvg, registerStageSetting, strap } from './stage-art.js?v=20261110-1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const R = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const tricolore = (x, y) => `<g transform="translate(${x},${y})"><rect x="-1.2" y="0" width="2.4" height="86" fill="#c8c0a8"/>${R(1, 2, 14, 22, '#1f8a4c')}${R(15, 2, 14, 22, '#f5f3ec')}${R(29, 2, 14, 22, '#cd2b35')}</g>`;
const euFlag = (x, y) => `<g transform="translate(${x},${y})"><rect x="-1.2" y="0" width="2.4" height="86" fill="#c8c0a8"/>${R(1, 2, 44, 28, '#1b3f94')}${Array.from({ length: 12 }, (_, i) => `<circle cx="${23 + Math.cos(i * Math.PI / 6) * 9}" cy="${16 + Math.sin(i * Math.PI / 6) * 9}" r="1.6" fill="#f2c300"/>`).join('')}</g>`;

// ---------- the back layers ----------
const BACK = {
  sala: () => `${R(-200, -100, 1040, 330, '#d9cfb8')}${R(-200, 214, 1040, 200, '#8d6d4b')}${R(-200, 205, 1040, 10, '#6b4f35')}`
    + `${[70, 190, 450, 570].map(x => `<g>${R(x - 30, 70, 60, 84, '#a9c7da')}${R(x - 30, 70, 60, 84, 'none', 'stroke="#7a6a52" stroke-width="4"')}${R(x - 1, 70, 2, 84, '#7a6a52')}</g>`).join('')}`
    + `<g class="rm-banner">${R(214, 34, 212, 26, '#2f5d62')}<text x="320" y="52" text-anchor="middle" font-size="11" font-weight="900" fill="#f4efe0" letter-spacing="1">COMITATI E ASSOCIAZIONI</text></g>`
    + `${Array.from({ length: 10 }, (_, i) => `<g transform="translate(${60 + (i % 5) * 54},${i < 5 ? 226 : 244})">${R(0, 0, 30, 6, '#b9ad94')}${R(2, 6, 3, 14, '#7c7260')}${R(25, 6, 3, 14, '#7c7260')}</g>`).join('')}`
    + `<g>${R(330, 176, 112, 8, '#7c5e3d')}${R(338, 184, 5, 36, '#5e472e')}${R(430, 184, 5, 36, '#5e472e')}${[350, 380, 410].map(x => `<ellipse cx="${x}" cy="172" rx="9" ry="5" fill="#f4efe0" stroke="#8f8573"/>`).join('')}</g>`
    + `<g>${R(20, 84, 74, 70, '#f4f1e6', 'stroke="#8f8573"')}<path d="M30 104H80M30 118H72M30 132H84" stroke="#3a6b72" stroke-width="3"/>${R(20, 154, 3, 56, '#6b5a40')}${R(91, 154, 3, 56, '#6b5a40')}</g>`,
  cantiere: () => `${R(-200, -100, 1040, 340, '#a9cfe6')}<path d="M-200 150C-60 118 40 140 160 118S400 104 560 130 760 118 840 126V240H-200Z" fill="#cbdbc4"/>${R(-200, 214, 1040, 200, '#8e7a5a')}`
    + `<g stroke="#e5a31c" stroke-width="5" fill="none"><path d="M520 214V28M520 28H640M520 28L470 56M498 28V214M520 60L498 90M520 100L498 130M520 140L498 170" stroke-width="3"/><path d="M630 28V80" stroke="#444" stroke-width="2"/></g>${R(620, 80, 18, 12, '#e5a31c')}`
    + `<g>${[200, 280, 360].map((x, i) => R(x, 96 + i * 4, 14, 118 - i * 4, '#b8b4ac')).join('')}${R(190, 88, 200, 10, '#a39f96')}${R(190, 150, 200, 8, '#a39f96')}${R(190, 200, 200, 8, '#a39f96')}</g>`
    + `<g>${Array.from({ length: 9 }, (_, i) => `<g transform="translate(${-10 + i * 78},212)">${R(0, -34, 70, 34, '#f09a2b')}<path d="M0 -34L70 0M20 -34L70 -9M0 -14L50 0" stroke="#fff" stroke-width="3" opacity=".55"/></g>`).join('')}</g>`
    + `<g>${R(60, 118, 78, 26, '#f4efe0', 'stroke="#3a2f22" stroke-width="2"')}<text x="99" y="136" text-anchor="middle" font-size="11" font-weight="900" fill="#3a2f22">CANTIERE</text>${R(66, 144, 3, 70, '#5e472e')}${R(129, 144, 3, 70, '#5e472e')}</g>`
    + `<g>${[430, 560].map(x => `<path d="M${x} 250L${x - 9} 276H${x + 9}Z" fill="#f06b2b"/>`).join('')}${R(600, 262, 36, 18, '#a76a3d')}${R(606, 250, 28, 12, '#b57a49')}</g>`,
  sede: () => `${R(-200, -100, 1040, 330, '#2d4a4f')}${R(-200, 214, 1040, 200, '#5a4a3a')}${R(-200, 205, 1040, 10, '#3e332a')}`
    + `<g>${R(208, 40, 224, 118, '#f2eee2', 'stroke="#c5bda8" stroke-width="3"')}${[0, 1, 2, 3, 4].map(i => R(232 + i * 38, 140 - [30, 58, 42, 74, 52][i], 24, [30, 58, 42, 74, 52][i], ['#c4a66a', '#4A9DB8', '#d0805f', '#6fae8a', '#8e86d8'][i])).join('')}<path d="M226 142H420" stroke="#3a3a3a" stroke-width="2"/></g>`
    + `${tricolore(90, 92)}${tricolore(560, 92)}`
    + `<g>${R(20, 70, 52, 70, '#f4efe0', 'stroke="#8f8573"')}<path d="M28 86H64M28 100H58M28 114H62" stroke="#2d4a4f" stroke-width="3"/></g>${R(580, 74, 44, 56, '#e9e1cc', 'stroke="#8f8573"')}`
    + `${Array.from({ length: 6 }, (_, i) => `<g transform="translate(${64 + i * 92},246)">${R(-18, 0, 36, 34, '#6f5a43')}${R(-18, -10, 36, 12, '#80684e')}</g>`).join('')}`,
  commissione: () => `${R(-200, -100, 1040, 330, '#6d523a')}${R(-200, 214, 1040, 200, '#4a3a2a')}`
    + `${Array.from({ length: 8 }, (_, i) => R(-10 + i * 90, 20, 78, 190, '#7a5d43', 'stroke="#5a4430" stroke-width="3"')).join('')}`
    + `${tricolore(120, 58)}${euFlag(520, 58)}`
    + `<g>${R(240, 70, 160, 54, '#f2eee2', 'stroke="#c5bda8" stroke-width="3"')}<text x="320" y="92" text-anchor="middle" font-size="10" font-weight="900" fill="#3a2f22" letter-spacing="1">COMMISSIONE</text><text x="320" y="108" text-anchor="middle" font-size="8" font-weight="700" fill="#6b5a40">AUDIZIONE PUBBLICA</text></g>`
    + `${Array.from({ length: 3 }, (_, r) => `<g>${Array.from({ length: 7 }, (_, i) => `<g transform="translate(${70 + i * 82 - r * 6},${182 + r * 14})">${R(0, 0, 54, 10, '#8a6a4a')}${R(6, 2, 14, 5, '#f4efe0')}</g>`).join('')}</g>`).join('')}`,
  redazione: () => `${R(-200, -100, 1040, 330, '#c9ccc9')}${R(-200, 214, 1040, 200, '#6e7574')}${R(-200, 205, 1040, 10, '#555c5b')}`
    + `<g>${R(40, 40, 160, 100, '#b8845a', 'stroke="#8c6040" stroke-width="3"')}${[0, 1, 2, 3, 4, 5].map(i => R(52 + (i % 3) * 48, 52 + Math.floor(i / 3) * 44, 38, 34, '#f4f1e6', 'stroke="#9a9a8a"')).join('')}</g>`
    + `<g>${R(430, 52, 150, 88, '#202a30')}${R(436, 58, 138, 70, '#2f6f95')}<path d="M446 110L470 92L492 100L520 78L560 88" stroke="#f2c300" stroke-width="3" fill="none"/>${R(496, 140, 10, 10, '#202a30')}</g>`
    + `<g>${R(238, 44, 56, 56, '#f4f1e6', 'stroke="#555c5b" stroke-width="3"')}<circle cx="266" cy="72" r="22" fill="none" stroke="#555c5b" stroke-width="2"/><path d="M266 72V56M266 72L278 78" stroke="#202a30" stroke-width="2.5"/></g>`
    + `${[90, 240, 410, 560].map(x => `<g transform="translate(${x},190)">${R(-34, 0, 68, 6, '#8a6a4a')}${R(-26, -30, 36, 26, '#26323a')}${R(-23, -27, 30, 20, '#7fb8d6')}${R(-12, -4, 10, 4, '#26323a')}</g>`).join('')}`,
  consiglio: () => `${R(-200, -100, 1040, 330, '#d8c79a')}${R(-200, 214, 1040, 200, '#6a3f35')}${R(-200, 205, 1040, 10, '#8b5a3c')}`
    + `${Array.from({ length: 6 }, (_, i) => R(-20 + i * 118, 24, 90, 176, 'none', 'stroke="#b39e62" stroke-width="3"')).join('')}${Array.from({ length: 6 }, (_, i) => R(-8 + i * 118, 36, 66, 152, '#cdb987', 'opacity=".55"')).join('')}`
    + `${tricolore(150, 40)}${euFlag(450, 40)}`
    + `<g transform="translate(320,34)"><path d="M0 0V22" stroke="#8b6f2e" stroke-width="3"/><ellipse cx="0" cy="38" rx="48" ry="14" fill="#e8d28a" stroke="#8b6f2e" stroke-width="2"/>${[-34, -17, 0, 17, 34].map(x => `<circle cx="${x}" cy="26" r="3" fill="#fff6d8"/>`).join('')}</g>`
    + `${R(250, 130, 140, 44, '#f4efe0', 'stroke="#b39e62" stroke-width="3"')}<circle cx="320" cy="152" r="14" fill="none" stroke="#8b6f2e" stroke-width="3"/>`
};
// ---------- the front layers: the table in front of whoever sits ----------
const FRONT = {
  sala: () => '',
  cantiere: () => `<g>${R(-200, 322, 1040, 60, '#7b6948', 'opacity=".55"')}</g>`,
  sede: () => `<g>${R(70, 270, 560, 52, '#7a5a3c')}${R(70, 270, 560, 8, '#a07f57')}${[130, 250, 350, 470].map((x, i) => R(x, 278, 34, 22, '#f1ecdd', 'stroke="#8f8573"')).join('')}</g>`,
  commissione: () => `<g>${R(90, 272, 540, 50, '#6a4a30')}${R(90, 272, 540, 8, '#9a7752')}${[150, 300, 430].map(x => R(x, 282, 44, 8, '#f4efe0')).join('')}</g>`,
  redazione: () => `<g>${R(90, 272, 540, 50, '#a8855f')}${R(90, 272, 540, 8, '#c9a77b')}${R(260, 276, 26, 10, '#26323a')}${R(150, 280, 50, 16, '#f4f1e6', 'stroke="#9a9a8a"')}${R(380, 280, 50, 16, '#f4f1e6', 'stroke="#9a9a8a"')}</g>`,
  consiglio: () => `<g><ellipse cx="320" cy="298" rx="290" ry="30" fill="#7a4a36"/><ellipse cx="320" cy="292" rx="290" ry="28" fill="#8f5b43"/>${[140, 240, 400, 500].map(x => R(x - 20, 284, 40, 14, '#f4efe0', 'stroke="#b39e62"')).join('')}</g>`
};

function roomSvg(scene, stage, node, uid) {
  const setting = scene.setting;
  const actors = [...scene.cast].sort((a, b) => (stage.poses[a.id]?.y ?? 0) - (stage.poses[b.id]?.y ?? 0)).map((member, index) => actorSvg(member, stage.poses[member.id], `${uid}a${index}`, { speaking: node?.speaker === member.id, expression: node?.speaker === member.id ? node.expression : null })).join('');
  const speaking = id => node?.speaker === id;
  const [me, one, two] = [scene.cast.find(item => item.role === 'giocatore'), ...scene.cast.filter(item => item.role === 'ospite')];
  const straps = `${strap(me, 8, 204, 334, speaking(me.id))}${strap(one, 218, 204, 334, speaking(one.id))}${strap(two, 428, 204, 334, speaking(two.id))}`;
  return { body: `<g class="st-room" data-room="${esc(setting)}">${BACK[setting]()}</g><g class="st-actors">${actors}</g><g class="st-room-front">${FRONT[setting]()}</g>`, overlay: `<g class="st-straps">${straps}</g>` };
}
for (const setting of Object.keys(BACK)) registerStageSetting(setting, roomSvg);
export const ROOMS = Object.freeze(Object.keys(BACK));
