// The rooms of the six optional scenes (core/activity-scenes.js), drawn in SVG on the same 640 x 360 stage as the studios, the square and the polling station: the civic hall, the building site, the party
// headquarters, the committee room, the newsroom and the room of the Council of Ministers. Each room is a back layer (walls, windows, furniture), the characters (the same ones the other stages use,
// made from the avatars of the game), and a front layer (the table in front of whoever sits). Name straps with the full name and the role of everyone are drawn over the camera (never cut: the text is
// wrapped). Loaded with the scene page; it registers its settings in stage-art.js. Nothing here decides anything: it draws the poses that core/activity-scenes.js gives.
import { actorSvg, inkOn, registerStageSetting, strap } from './stage-art.js?v=20261126-3';
import { ambienceOf } from '../data/activity-scene-variety.js?v=20261126-3';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const R = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const tricolore = (x, y) => `<g transform="translate(${x},${y})"><rect x="-1.2" y="0" width="2.4" height="86" fill="#c8c0a8"/>${R(1, 2, 14, 22, '#1f8a4c')}${R(15, 2, 14, 22, '#f5f3ec')}${R(29, 2, 14, 22, '#cd2b35')}</g>`;
const euFlag = (x, y) => `<g transform="translate(${x},${y})"><rect x="-1.2" y="0" width="2.4" height="86" fill="#c8c0a8"/>${R(1, 2, 44, 28, '#1b3f94')}${Array.from({ length: 12 }, (_, i) => `<circle cx="${23 + Math.cos(i * Math.PI / 6) * 9}" cy="${16 + Math.sin(i * Math.PI / 6) * 9}" r="1.6" fill="#f2c300"/>`).join('')}</g>`;

// ---------- the back layers ----------
const BACK = {
  sala: scene => `${R(-200, -100, 1040, 330, '#d9cfb8')}${R(-200, 214, 1040, 200, '#8d6d4b')}${R(-200, 205, 1040, 10, '#6b4f35')}`
    + `${[70, 190, 450, 570].map(x => `<g>${R(x - 30, 70, 60, 84, '#a9c7da')}${R(x - 30, 70, 60, 84, 'none', 'stroke="#7a6a52" stroke-width="4"')}${R(x - 1, 70, 2, 84, '#7a6a52')}</g>`).join('')}`
    + `<g class="rm-banner">${R(214, 34, 212, 26, '#2f5d62')}<text x="320" y="52" text-anchor="middle" font-size="11" font-weight="900" fill="#f4efe0" letter-spacing="1">${esc(scene?.heading?.banner ?? 'COMITATI E ASSOCIAZIONI')}</text></g>`
    + `${Array.from({ length: 10 }, (_, i) => `<g transform="translate(${60 + (i % 5) * 54},${i < 5 ? 226 : 244})">${R(0, 0, 30, 6, '#b9ad94')}${R(2, 6, 3, 14, '#7c7260')}${R(25, 6, 3, 14, '#7c7260')}</g>`).join('')}`
    + `<g>${R(330, 176, 112, 8, '#7c5e3d')}${R(338, 184, 5, 36, '#5e472e')}${R(430, 184, 5, 36, '#5e472e')}${[350, 380, 410].map(x => `<ellipse cx="${x}" cy="172" rx="9" ry="5" fill="#f4efe0" stroke="#8f8573"/>`).join('')}</g>`
    + `<g>${R(20, 84, 74, 70, '#f4f1e6', 'stroke="#8f8573"')}<path d="M30 104H80M30 118H72M30 132H84" stroke="#3a6b72" stroke-width="3"/>${R(20, 154, 3, 56, '#6b5a40')}${R(91, 154, 3, 56, '#6b5a40')}</g>`,
  // the market square of the neighbourhood (the citizens): open sky, the facades of the houses, the stalls with their striped awnings and crates, trees, a fountain, bunting, passers-by with shopping bags;
  // nothing here is a hall: no chairs in rows, no table, no committee banner
  mercato: scene => `${R(-200, -100, 1040, 330, '#bfdcec')}<path d="M-200 120C-80 96 80 112 220 92S470 84 640 104 840 100 840 100V230H-200Z" fill="#d8e5cf" opacity=".7"/>`
    + `${[[-20, 60, 120, 150, '#e3c79a'], [100, 40, 110, 170, '#d99f7c'], [214, 70, 100, 140, '#ecd7a8'], [318, 48, 120, 162, '#c9b08a'], [442, 62, 104, 148, '#e6b98f'], [550, 36, 130, 174, '#dcc79c']].map(([x, y, w, h, c]) => `<g>${R(x, y, w, h, c)}${R(x, y, w, 8, 'rgba(0,0,0,.12)')}${[0, 1].map(r => [0, 1, 2].map(k => `${R(x + 14 + k * (w - 28) / 3, y + 22 + r * 46, 20, 28, '#7aa6bd')}${R(x + 14 + k * (w - 28) / 3, y + 22 + r * 46, 20, 28, 'none', 'stroke="#6b5a40" stroke-width="2"')}`).join('')).join('')}</g>`).join('')}`
    + `${R(-200, 214, 1040, 200, '#b7ab97')}${Array.from({ length: 26 }, (_, i) => R(-40 + i * 34, 220 + (i % 4) * 22, 22, 3, 'rgba(0,0,0,.10)')).join('')}`
    + `<path d="M-10 66Q80 94 170 70T350 72T530 70T650 66" stroke="#8a6a4a" stroke-width="2" fill="none"/>${Array.from({ length: 12 }, (_, i) => `<path d="M${14 + i * 54} ${72 + Math.sin(i) * 4}l9 18l9 -18z" fill="${['#cd2b35', '#f5f3ec', '#1f8a4c', '#f2c300'][i % 4]}"/>`).join('')}`
    + `${[[40, '#cd2b35', '#f5f3ec'], [250, '#1f8a4c', '#f5f3ec'], [470, '#2d6fa8', '#f5f3ec']].map(([x, a, b]) => `<g transform="translate(${x},118)">${R(2, 40, 4, 96, '#6b5a40')}${R(98, 40, 4, 96, '#6b5a40')}${Array.from({ length: 8 }, (_, i) => `<path d="M${i * 13} 40h13l-3 22h-13z" fill="${i % 2 ? b : a}"/>`).join('')}${R(0, 98, 104, 12, '#9c7a52')}${[8, 38, 68].map((cx, i) => `<g>${R(cx, 84, 24, 14, '#7c5e3d')}<circle cx="${cx + 6}" cy="82" r="6" fill="${['#e2573a', '#7ab648', '#f2b632'][i]}"/><circle cx="${cx + 16}" cy="82" r="6" fill="${['#f2b632', '#e2573a', '#7ab648'][i]}"/></g>`).join('')}</g>`).join('')}`
    + `<g transform="translate(570,150)">${R(-3, 40, 6, 70, '#6b5a40')}<circle cx="0" cy="26" r="34" fill="#5a8a4c"/><circle cx="-18" cy="40" r="22" fill="#4c7a40"/><circle cx="20" cy="38" r="24" fill="#66964f"/></g>`
    + `<g transform="translate(318,214)"><ellipse cx="0" cy="12" rx="46" ry="11" fill="#9aa6a8"/>${R(-30, -2, 60, 14, '#b9c3c4')}${R(-6, -30, 12, 30, '#a8b4b6')}<path d="M0 -30Q-18 -42 -22 -22M0 -30Q18 -42 22 -22" stroke="#7fb6d6" stroke-width="3" fill="none"/></g>`
    + `${[[290, 242, '#3a5a7a'], [360, 244, '#7a3a4a'], [60, 250, '#4a6a4a']].map(([x, y, c]) => `<g transform="translate(${x},${y})">${R(-6, 0, 12, 26, c)}<circle cx="0" cy="-7" r="7" fill="#d9a97e"/>${R(7, 8, 8, 12, '#caa24a')}</g>`).join('')}`
    + `<g class="rm-banner">${R(214, 22, 212, 26, '#8a3b2a')}<text x="320" y="40" text-anchor="middle" font-size="11" font-weight="900" fill="#f7efe0" letter-spacing="1">${esc(scene?.heading?.banner ?? 'INCONTRO CON I CITTADINI')}</text></g>`,
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
    + `${R(250, 130, 140, 44, '#f4efe0', 'stroke="#b39e62" stroke-width="3"')}<circle cx="320" cy="152" r="14" fill="none" stroke="#8b6f2e" stroke-width="3"/>`,
  // ---------- the rooms of the activities that are not their kind (core/activity-scenes.js profiles): each one its own place, never the hall of the kind with another backdrop ----------
  // the rally: an open square at dusk, a raised stage with a lectern and loudspeakers at the back, the crowd and its flags in front
  'piazza-comizio': scene => `${R(-200, -100, 1040, 330, '#f1b67a')}<path d="M-200 60C0 40 200 70 320 50S640 40 840 60V230H-200Z" fill="#e59a63" opacity=".6"/>`
    + `${[[-40, 40, 130, 170, '#c98f6a'], [90, 20, 120, 190, '#b77d5e'], [430, 26, 120, 184, '#c48a66'], [552, 44, 130, 166, '#ad7457']].map(([x, y, w, h, c]) => `<g>${R(x, y, w, h, c)}${Array.from({ length: 6 }, (_, i) => R(x + 14 + (i % 3) * 36, y + 22 + Math.floor(i / 3) * 52, 18, 28, '#ffd98f', 'opacity=".75"')).join('')}</g>`).join('')}`
    + `${R(-200, 214, 1040, 200, '#a08c74')}`
    + `<g class="rm-palco">${R(190, 168, 260, 46, '#5a3a2a')}${R(190, 164, 260, 8, '#7a5038')}${Array.from({ length: 9 }, (_, i) => R(198 + i * 29, 172, 20, 38, '#6a4632', 'opacity=".6"')).join('')}`
    + `${R(206, 60, 228, 34, '#1f3a5a')}<text x="320" y="82" text-anchor="middle" font-size="13" font-weight="900" fill="#f4efe0" letter-spacing="2">COMIZIO</text>`
    + `${[178, 462].map(x => `<g>${R(x - 10, 92, 20, 72, '#26262c')}<circle cx="${x}" cy="108" r="6" fill="#55555f"/><circle cx="${x}" cy="130" r="8" fill="#55555f"/><circle cx="${x}" cy="152" r="6" fill="#55555f"/></g>`).join('')}</g>`
    + `${Array.from({ length: 8 }, (_, i) => `<path d="M${-10 + i * 90} 18Q${35 + i * 90} 34 ${80 + i * 90} 18" stroke="#ffe7a8" stroke-width="2" fill="none"/>${[0, 1, 2].map(k => `<circle class="${k === 1 ? 'rm-live' : ''}" cx="${8 + i * 90 + k * 26}" cy="${24 + (k === 1 ? 4 : 0)}" r="3.2" fill="#fff3c2"/>`).join('')}`).join('')}`,
  // the press room: a lectern with the microphones of the radios, the institution's panel behind, rows of chairs, the cameras at the back
  'sala-stampa': scene => `${R(-200, -100, 1040, 330, '#e8e4dc')}${R(-200, 214, 1040, 200, '#59606a')}${R(-200, 205, 1040, 10, '#3f454d')}`
    + `<g>${R(70, 30, 250, 150, '#1e3550')}${Array.from({ length: 4 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<circle cx="${100 + c * 48}" cy="${56 + r * 32}" r="7" fill="none" stroke="#c9d6e8" stroke-width="1.5" opacity=".35"/>`).join('')).join('')}${R(120, 150, 150, 22, '#c9a560', 'rx="3"')}<text x="195" y="165" text-anchor="middle" font-size="10" font-weight="900" fill="#1e3550" letter-spacing="2">SALA STAMPA</text></g>`
    + `${tricolore(30, 96)}${euFlag(334, 96)}`
    + `<g>${R(420, 40, 170, 100, '#26323a')}${R(426, 46, 158, 74, '#3d6f98')}<path d="M440 104l26-22 24 12 30-30 40 16" stroke="#f2c300" stroke-width="3" fill="none"/>${R(500, 140, 10, 12, '#26323a')}</g>`
    + `${[0, 1, 2].map(r => Array.from({ length: 6 }, (_, i) => `<g transform="translate(${380 + i * 46 - r * 8},${226 + r * 22})">${R(0, 0, 30, 6, '#3a4752')}${R(2, -14, 26, 14, '#4a5966')}</g>`).join('')).join('')}`
    + `${[600, 630].map((x, i) => `<g transform="translate(${x},${150 + i * 8})"><path d="M0 60L-10 90M0 60L10 90M0 60V30" stroke="#222" stroke-width="2.5"/>${R(-14, 14, 28, 18, '#202024', 'rx="3"')}<circle cx="-14" cy="23" r="6" fill="#33333a"/><circle class="rm-live rm-flash" cx="10" cy="16" r="5" fill="#fffbe0"/></g>`).join('')}`,
  // the negotiating room: no windows, one pendant lamp over an oval table, two closed folders, the map of the constituencies on the wall
  trattativa: scene => `${R(-200, -100, 1040, 330, '#3a3f4a')}${R(-200, 214, 1040, 200, '#2c2a2e')}${R(-200, 205, 1040, 10, '#1f1d22')}`
    + `<g>${R(470, 42, 130, 92, '#cfc7b2', 'stroke="#8f8573" stroke-width="3"')}<path d="M480 60L520 70L560 54L590 76M484 98L520 90L556 110L588 96" stroke="#8a3b2a" stroke-width="2" fill="none"/>${[[500, 76], [540, 100], [570, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#2d4a6f"/>`).join('')}</g>`
    + `<g>${R(40, 56, 90, 60, '#4a4f5c', 'stroke="#626878" stroke-width="2"')}<path d="M52 72H118M52 86H104M52 100H112" stroke="#8c93a3" stroke-width="2.5"/></g>`
    + `<g transform="translate(320,0)">${R(-1, 0, 2, 70, '#222')}<path d="M-34 70H34L22 92H-22Z" fill="#2a2a2e"/><ellipse class="rm-live" cx="0" cy="96" rx="20" ry="5" fill="#ffe3a0" opacity=".9"/><path d="M-120 230L-22 96H22L120 230Z" fill="#ffe3a0" opacity=".10"/></g>`,
  // a committee room of the European Parliament: the blue wall, the row of flags, the glass booths of the interpreters at the back, a screen with the text
  bruxelles: scene => `${R(-200, -100, 1040, 330, '#d7dfe9')}${R(-200, 214, 1040, 200, '#5c6f8a')}${R(-200, 205, 1040, 10, '#3e4f68')}`
    + `${R(-200, 120, 1040, 8, '#1b3f94', 'opacity=".9"')}`
    + `${Array.from({ length: 5 }, (_, i) => `<g>${R(20 + i * 124, 28, 104, 62, '#9fb6cf', 'stroke="#6b8099" stroke-width="3"')}${R(28 + i * 124, 36, 88, 30, '#c9dbea', 'opacity=".8"')}<circle class="${i % 2 ? 'rm-live' : ''}" cx="${108 + i * 124}" cy="80" r="3" fill="${i % 2 ? '#e5484d' : '#40a060'}"/></g>`).join('')}`
    + `${euFlag(40, 120)}${Array.from({ length: 6 }, (_, i) => `<g transform="translate(${150 + i * 64},128)">${R(-1, 0, 2, 76, '#9aa4b0')}${R(1, 2, 30, 20, ['#1f8a4c', '#000', '#d52b1e', '#002395', '#c60b1e', '#21468b'][i])}</g>`).join('')}`
    + `${R(250, 150, 140, 50, '#1e2b3c')}<text x="320" y="180" text-anchor="middle" font-size="10" font-weight="800" fill="#cfe0f5" letter-spacing="1">AMENDMENT 12</text>`,
  // the communication room: two monitors with the charts, a ring light and a phone on a tripod, the content calendar on the wall
  social: scene => `${R(-200, -100, 1040, 330, '#2b2d3a')}${R(-200, 214, 1040, 200, '#45465a')}${R(-200, 205, 1040, 10, '#33344a')}`
    + `<g>${R(40, 40, 150, 110, '#e9e6f2', 'stroke="#8f8aa8" stroke-width="2"')}${Array.from({ length: 21 }, (_, i) => R(50 + (i % 7) * 20, 52 + Math.floor(i / 7) * 30, 16, 22, ['#c4a66a', '#8e86d8', '#6fae8a', '#e8e4f2'][i % 4], 'opacity=".85"')).join('')}</g>`
    + `${[240, 400].map((x, i) => `<g>${R(x, 50, 140, 88, '#121420')}${R(x + 6, 56, 128, 70, i ? '#24384f' : '#2e2550')}${Array.from({ length: 7 }, (_, k) => R(x + 14 + k * 17, 118 - [20, 34, 26, 48, 40, 56, 50][(k + i) % 7], 11, [20, 34, 26, 48, 40, 56, 50][(k + i) % 7], i ? '#6fd0a0' : '#b89bff', `class="${k === 6 ? 'rm-live' : ''}"`)).join('')}</g>`).join('')}`
    + `<g transform="translate(580,120)"><circle r="30" fill="none" stroke="#fff6dc" stroke-width="7" opacity=".85"/><circle class="rm-live" r="30" fill="none" stroke="#fffbe8" stroke-width="2"/>${R(-1.5, 30, 3, 80, '#888')}${R(-9, -14, 18, 30, '#111', 'rx="3"')}</g>`,
  // a tiered lecture room: the blackboard with the two curves (forecast and result), the projector beam, the steps of the benches
  'aula-corso': scene => `${R(-200, -100, 1040, 330, '#e6dcc4')}${R(-200, 214, 1040, 200, '#7a6448')}`
    + `<g>${R(300, 34, 300, 136, '#2e4a3a', 'stroke="#6b5232" stroke-width="6"')}<path d="M320 150C380 140 420 100 480 96S560 70 586 60" stroke="#f4efe0" stroke-width="2.5" fill="none"/><path d="M320 150C380 146 430 130 480 128S560 116 586 112" stroke="#f2c300" stroke-width="2.5" fill="none" stroke-dasharray="6 5"/><text x="312" y="56" font-size="11" font-weight="800" fill="#f4efe0" letter-spacing="1">INDICATORI</text></g>`
    + `<path d="M120 20L300 60V150Z" fill="#fff6c8" opacity=".12"/>${R(110, 14, 20, 12, '#333')}`
    + `${[0, 1, 2].map(r => R(-200, 176 + r * 14, 520 - r * 20, 12, ['#8a7052', '#7a6246', '#6c563c'][r])).join('')}`,
  // the room of the town executive: the banner of the town, a long table with the register of the resolutions, the clock
  giunta: scene => `${R(-200, -100, 1040, 330, '#d8ccb0')}${R(-200, 214, 1040, 200, '#7a5a40')}${R(-200, 205, 1040, 10, '#5a3f2c')}`
    + `<g transform="translate(300,24)"><path d="M0 0H60V96L30 116L0 96Z" fill="#8a1f2b"/><circle cx="30" cy="44" r="16" fill="#e8c96a"/><path d="M14 4H46" stroke="#e8c96a" stroke-width="3"/></g>${tricolore(150, 70)}${euFlag(436, 70)}`
    + `<g>${R(40, 50, 84, 110, '#b89870', 'stroke="#7a5a40" stroke-width="3"')}${Array.from({ length: 8 }, (_, i) => R(48 + (i % 2) * 38, 58 + Math.floor(i / 2) * 25, 32, 20, ['#c94a3a', '#3a6a9a', '#d9b35a', '#5a8a5a'][i % 4])).join('')}</g>`
    + `<g transform="translate(566,64)"><circle r="20" fill="#f4efe0" stroke="#5a3f2c" stroke-width="3"/><path d="M0 0V-12M0 0L9 5" stroke="#222" stroke-width="2"/></g>`,
  // the fundraising evening: a rented hall with round tables, a garland of lights and the hand-drawn thermometer of the target
  raccolta: scene => `${R(-200, -100, 1040, 330, '#4a2f3a')}${R(-200, 214, 1040, 200, '#6a4a3a')}`
    + `${Array.from({ length: 2 }, (_, r) => `<path d="M-20 ${30 + r * 30}Q160 ${70 + r * 30} 320 ${36 + r * 30}T660 ${40 + r * 30}" stroke="#2a1a20" stroke-width="1.5" fill="none"/>${Array.from({ length: 14 }, (_, i) => `<circle class="${(i + r) % 4 === 0 ? 'rm-live' : ''}" cx="${-10 + i * 48}" cy="${40 + r * 30 + Math.sin(i) * 10}" r="4" fill="#ffd98a"/>`).join('')}`).join('')}`
    + `<g transform="translate(560,70)">${R(-26, 0, 52, 130, '#f4efe0', 'stroke="#8f8573" stroke-width="2"')}${R(-8, 14, 16, 100, '#e7ddd0', 'rx="8"')}${R(-8, 78, 16, 36, '#c62f3c', 'rx="8"')}<circle cx="0" cy="118" r="12" fill="#c62f3c"/><text x="0" y="-6" text-anchor="middle" font-size="9" font-weight="900" fill="#f4efe0">OBIETTIVO</text></g>`
    + `${[90, 260, 430].map(x => `<g transform="translate(${x},200)"><ellipse cx="0" cy="0" rx="46" ry="12" fill="#f4efe0"/>${R(-3, 0, 6, 26, '#4a3a2a')}<circle cx="-14" cy="-6" r="4" fill="#d9c38a"/><circle cx="12" cy="-6" r="4" fill="#a8c3d9"/></g>`).join('')}`,
  // the technical office: shelves of binders, the scoring grid of the call on the wall, the plans spread on the table, the countdown on the monitor
  'ufficio-tecnico': scene => `${R(-200, -100, 1040, 330, '#c9cfd2')}${R(-200, 214, 1040, 200, '#6f7a7e')}${R(-200, 205, 1040, 10, '#525c60')}`
    + `<g>${R(20, 30, 150, 170, '#8a6a4a')}${Array.from({ length: 3 }, (_, r) => `${R(26, 40 + r * 54, 138, 4, '#5a4430')}${Array.from({ length: 9 }, (_, i) => R(30 + i * 15, 46 + r * 54, 12, 44, ['#2d5a8a', '#c94a3a', '#d9b35a', '#3a7a5a', '#6a4a8a'][(i + r) % 5])).join('')}`).join('')}</g>`
    + `<g>${R(220, 40, 150, 110, '#f4f1e6', 'stroke="#8f8573" stroke-width="2"')}${Array.from({ length: 5 }, (_, i) => `${R(232, 56 + i * 18, 90, 8, '#d9d4c4')}${R(332, 56 + i * 18, 26, 8, ['#6fae8a', '#6fae8a', '#e5a31c', '#6fae8a', '#c94a3a'][i])}`).join('')}</g>`
    + `<g>${R(420, 46, 160, 96, '#1a2026')}${R(426, 52, 148, 72, '#284860')}<text x="500" y="96" text-anchor="middle" font-size="18" font-weight="900" fill="#f2c300" class="rm-live">−21</text>${R(494, 142, 12, 10, '#1a2026')}</g>`,
  // the town hall: the banner of the town, the sashes on the chairs, the map of the valley with the closed roads
  municipio: scene => `${R(-200, -100, 1040, 330, '#e3d6bc')}${R(-200, 214, 1040, 200, '#8a6e52')}${R(-200, 205, 1040, 10, '#6a523a')}`
    + `<g transform="translate(60,26)"><path d="M0 0H56V92L28 110L0 92Z" fill="#1f4a7a"/><circle cx="28" cy="42" r="15" fill="#f0d27a"/></g>${tricolore(150, 80)}`
    + `<g>${R(380, 36, 220, 128, '#efe8d4', 'stroke="#8f8573" stroke-width="3"')}<path d="M392 140C430 120 450 90 500 84S570 60 590 50" stroke="#5a8a4c" stroke-width="10" fill="none" opacity=".5"/><path d="M400 70L450 110L520 100L580 140" stroke="#8a6a4a" stroke-width="3" fill="none"/><path d="M466 104l10 10M476 104l-10 10" stroke="#c62f3c" stroke-width="3"/></g>`
    + `${[220, 300].map(x => `<g transform="translate(${x},150)">${R(0, 0, 36, 46, '#7a5a40')}<path d="M4 4L32 40" stroke="#1f8a4c" stroke-width="5"/><path d="M8 4L32 34" stroke="#f5f3ec" stroke-width="3"/><path d="M12 4L32 28" stroke="#cd2b35" stroke-width="3"/></g>`).join('')}`,
  // the Chamber: the benches rising in a hemicycle, the presiding bench high in the middle, the display of the times
  'aula-camera': scene => `${R(-200, -100, 1040, 330, '#c8b78a')}${R(-200, 214, 1040, 200, '#5a3a2a')}`
    + `${[0, 1, 2, 3].map(r => `<path d="M${-60 - r * 40} ${200 - r * 34}Q320 ${150 - r * 40} ${700 + r * 40} ${200 - r * 34}" stroke="${['#7a2f2a', '#8a3a30', '#9a463a', '#a85244'][r]}" stroke-width="18" fill="none"/>`).join('')}`
    + `<g>${R(250, 120, 140, 70, '#6a4026', 'stroke="#c9a560" stroke-width="3"')}${R(262, 130, 116, 12, '#c9a560', 'opacity=".6"')}</g>${tricolore(206, 70)}${euFlag(392, 70)}`
    + `<g>${R(470, 30, 120, 40, '#151a20')}<text x="530" y="56" text-anchor="middle" font-size="16" font-weight="900" fill="#e5484d" class="rm-live">02:00</text></g>`
};
// ---------- the decor: three furnishings of every room, chosen by the seed of the scene ----------
// The same room is not the same picture twice: plants and a poster board, pendant lamps and notice boards, or curtains and a wall clock (the open-air places get bunting, a banner or a tree), and the wall takes a
// slightly different tint. Deterministic from the scene (the same scene is drawn the same way every time it is shown); nothing here changes what happens in the scene.
const seedOf = scene => { let h = 2166136261; for (const ch of String(scene?.seed ?? scene?.id ?? 'x')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const OPEN_AIR = new Set(['mercato', 'cantiere', 'piazza-comizio']);
const DECOR = [
  setting => OPEN_AIR.has(setting)
    ? `<g class="rm-decor">${[[24, 190], [596, 196]].map(([x, y]) => `<g transform="translate(${x},${y})">${R(-4, 0, 8, 30, '#6b5a40')}<circle cx="0" cy="-6" r="20" fill="#5a8a4c"/><circle cx="-12" cy="4" r="13" fill="#4c7a40"/></g>`).join('')}</g>`
    : `<g class="rm-decor">${[[30, 168], [604, 172]].map(([x, y]) => `<g transform="translate(${x},${y})">${R(-9, 20, 18, 22, '#8a5a3a')}<path d="M0 20C-14 6-12-8 0-18C12-8 14 6 0 20Z" fill="#4c8a52"/><path d="M0 20C-22 14-26 0-18-10" stroke="#3f7a47" stroke-width="3" fill="none"/></g>`).join('')}${R(268, 48, 104, 8, '#c9bfa6', 'opacity=".35"')}</g>`,
  setting => OPEN_AIR.has(setting)
    ? `<g class="rm-decor">${R(0, 20, 640, 5, '#7a6a52', 'opacity=".5"')}${Array.from({ length: 9 }, (_, i) => `<path d="M${30 + i * 72} 24l8 16l8-16z" fill="${['#cd2b35', '#f5f3ec', '#1f8a4c'][i % 3]}" opacity=".85"/>`).join('')}</g>`
    : `<g class="rm-decor">${[110, 320, 530].map(x => `<g transform="translate(${x},0)">${R(-1, 0, 2, 22, '#554a3a')}<path d="M-16 22H16L10 38H-10Z" fill="#e9d79a"/><ellipse cx="0" cy="40" rx="9" ry="3" fill="#fff6c8" opacity=".7"/></g>`).join('')}${R(560, 70, 60, 44, '#f4efe0', 'stroke="#8f8573" opacity=".9"')}${R(566, 78, 22, 14, '#d9a05b')}${R(592, 78, 22, 14, '#7fb0c8')}</g>`,
  setting => OPEN_AIR.has(setting)
    ? `<g class="rm-decor">${R(250, 14, 140, 20, '#2f5d62', 'opacity=".9"')}<path d="M262 34v22M378 34v22" stroke="#554a3a" stroke-width="3"/></g>`
    : `<g class="rm-decor">${R(0, 0, 40, 214, '#7a2d3a', 'opacity=".55"')}${R(600, 0, 40, 214, '#7a2d3a', 'opacity=".55"')}<g transform="translate(320,36)"><circle r="16" fill="#f4efe0" stroke="#554a3a" stroke-width="3"/><path d="M0 0V-10M0 0L8 4" stroke="#3a2f22" stroke-width="2"/></g></g>`
];
const TINT = ['rgba(255,225,170,.10)', 'rgba(150,190,230,.10)', 'rgba(210,150,150,.08)'];
// the rooms of the profiles have their own furnishings (a second clock or a pair of curtains would fall on them): they take only the tint
const BASE_ROOMS = new Set(['sala', 'mercato', 'cantiere', 'sede', 'commissione', 'redazione', 'consiglio']);
const decorOf = (setting, scene) => { const h = seedOf(scene); return `${BASE_ROOMS.has(setting) ? DECOR[h % 3](setting) : ''}${R(-200, -100, 1040, 330, TINT[(h >>> 3) % 3], 'class="rm-tint" pointer-events="none"')}`; };
// ---------- the time of the encounter, the props of the place and the depth: what makes two encounters of the same kind look different ----------
// The light of the hour (drawn over the room, under the people): a cool morning with the rays of a window, a warm afternoon, an evening with the lamps lit, a late night under spotlights. Chosen by the seed
// of the encounter, so the same encounter always looks the same and two encounters rarely do.
const HOURS = Object.freeze([
  { id: 'mattina', layer: uid => `<defs><linearGradient id="${uid}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6dc" stop-opacity=".22"/><stop offset=".6" stop-color="#fff6dc" stop-opacity="0"/></linearGradient></defs><path d="M-120 -100L120 -100L420 330L60 330Z" fill="url(#${uid}h)"/><path d="M40 -100L150 -100L520 330L330 330Z" fill="#fffaf0" opacity=".06"/>` },
  { id: 'pomeriggio', layer: uid => `<defs><radialGradient id="${uid}h" cx=".85" cy=".1" r=".9"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".26"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient></defs>${R(-200, -100, 1040, 430, `url(#${uid}h)`)}` },
  { id: 'sera', layer: uid => `<defs><radialGradient id="${uid}h" cx=".5" cy=".05" r=".75"><stop offset="0" stop-color="#ffd27a" stop-opacity=".18"/><stop offset="1" stop-color="#0b1424" stop-opacity=".38"/></radialGradient></defs>${R(-200, -100, 1040, 430, `url(#${uid}h)`)}${[120, 320, 520].map(x => `<ellipse cx="${x}" cy="40" rx="70" ry="26" fill="#ffd98f" opacity=".1"/>`).join('')}` },
  { id: 'notte', layer: uid => `<defs><radialGradient id="${uid}h" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05080f" stop-opacity=".5"/></radialGradient></defs>${R(-200, -100, 1040, 430, `url(#${uid}h)`)}${[[180, '#fff1c9'], [460, '#e8f0ff']].map(([x, c]) => `<path d="M${x - 20} -100L${x + 20} -100L${x + 120} 330L${x - 120} 330Z" fill="${c}" opacity=".08"/>`).join('')}` }
]);
export const hourOf = scene => HOURS[(seedOf(scene) >>> 5) % HOURS.length].id;
const hourLayer = (scene, uid) => `<g class="rm-hour" data-hour="${hourOf(scene)}" pointer-events="none">${HOURS[(seedOf(scene) >>> 5) % HOURS.length].layer(uid)}</g>`;
// What stands in the place: the lectern and the flags of a hall, the name plates and the folders of a committee, the flags of Italy and of Europe at the table of the Council, the screens of a newsroom,
// the cones and the crane of a building site, the awnings of a market. Two arrangements per place (by the seed).
const FLAGS = (x, y) => `<g transform="translate(${x},${y})">${R(-1, 0, 2, 70, '#6b5a3a')}<path d="M1 2h14v22H1z" fill="#1f8a4c"/><path d="M15 2h14v22H15z" fill="#f5f3ec"/><path d="M29 2h14v22H29z" fill="#cd2b35"/></g><g transform="translate(${x + 54},${y})">${R(-1, 0, 2, 70, '#6b5a3a')}<path d="M1 2h40v26H1z" fill="#1f4fa0"/>${Array.from({ length: 8 }, (_, i) => `<circle cx="${21 + 8 * Math.cos(i * Math.PI / 4)}" cy="${15 + 8 * Math.sin(i * Math.PI / 4)}" r="1.4" fill="#f5d34a"/>`).join('')}</g>`;
const PROPS = {
  sala: [() => `<g class="rm-props">${R(296, 150, 48, 64, '#6b4a30')}${R(292, 146, 56, 8, '#8a6440')}<path d="M320 146v-18" stroke="#333" stroke-width="2"/><circle cx="320" cy="126" r="4" fill="#222"/>${FLAGS(560, 140)}</g>`, () => `<g class="rm-props">${FLAGS(36, 136)}${R(250, 30, 140, 50, '#22324a', 'rx="4"')}<text x="320" y="62" text-anchor="middle" font-size="13" font-family="Manrope, sans-serif" fill="#f0cf85">INCONTRO PUBBLICO</text></g>`],
  commissione: [() => `<g class="rm-props">${[180, 300, 420].map(x => `${R(x - 26, 196, 52, 14, '#f2ead6', 'rx="2"')}${R(x - 18, 186, 36, 8, '#c9b58a')}`).join('')}${R(470, 176, 46, 30, '#8a2b2b', 'rx="2"')}</g>`, () => `<g class="rm-props">${FLAGS(560, 132)}${[130, 250].map(x => `${R(x, 184, 40, 26, '#e8e0cc', 'rx="2"')}${R(x + 4, 180, 40, 26, '#f6f0e0', 'rx="2"')}`).join('')}</g>`],
  consiglio: [() => `<g class="rm-props">${FLAGS(40, 130)}${R(200, 196, 240, 10, '#5a3a24', 'rx="3"')}${[230, 300, 370].map(x => R(x, 186, 34, 10, '#f3ecd8', 'rx="1"')).join('')}</g>`, () => `<g class="rm-props">${FLAGS(548, 128)}<circle cx="320" cy="58" r="22" fill="none" stroke="#c4a66a" stroke-width="3"/><path d="M308 58h24M320 46v24" stroke="#c4a66a" stroke-width="2"/></g>`],
  redazione: [() => `<g class="rm-props">${[120, 260, 400].map(x => `${R(x, 60, 90, 56, '#13202e', 'rx="3"')}${R(x + 6, 66, 78, 30, '#2f5b7a', 'opacity=".55"')}${R(x + 6, 100, 50, 4, '#c4a66a')}`).join('')}</g>`, () => `<g class="rm-props">${R(80, 186, 120, 24, '#ece4cf', 'rx="2"')}${R(90, 180, 100, 8, '#d8cdb0')}${R(470, 54, 120, 70, '#13202e', 'rx="3"')}<text x="530" y="96" text-anchor="middle" font-size="14" font-family="Manrope, sans-serif" fill="#e94b4b">ULTIM’ORA</text></g>`],
  cantiere: [() => `<g class="rm-props">${[90, 520, 560].map(x => `<path d="M${x} 212l10-26l10 26z" fill="#ff8a2a"/>${R(x + 3, 198, 14, 4, '#f5f3ec')}`).join('')}</g>`, () => `<g class="rm-props"><path d="M520 30v170M520 30h-140M400 30v40" stroke="#e0a32a" stroke-width="5" fill="none"/>${R(390, 70, 20, 16, '#7a6a52')}</g>`],
  mercato: [() => `<g class="rm-props">${[60, 470].map((x, i) => `<path d="M${x} 120h120l-10 26h-100z" fill="${i ? '#cd2b35' : '#1f8a4c'}"/>${Array.from({ length: 6 }, (_, k) => `<path d="M${x + k * 20} 146q10 10 20 0" fill="${k % 2 ? '#f5f3ec' : i ? '#cd2b35' : '#1f8a4c'}"/>`).join('')}${R(x + 6, 150, 108, 56, '#a07a4a')}`).join('')}</g>`, () => `<g class="rm-props">${R(240, 174, 160, 36, '#a07a4a')}${[256, 296, 336, 376].map((x, k) => `<circle cx="${x}" cy="172" r="10" fill="${['#e94b2a', '#f2c14e', '#7fb24a', '#e98a2a'][k]}"/>`).join('')}</g>`]
};
export const propsOf = (setting, scene) => { const list = PROPS[setting]; return list ? list[(seedOf(scene) >>> 9) % list.length]() : ''; };
// The depth: the heads of the people in front of the camera, out of focus, where a crowd fills the place (a hall, a market, a building site).
const CROWDED = new Set(['sala', 'mercato', 'cantiere', 'piazza-comizio', 'sala-stampa', 'raccolta']);
export const depthOf = (setting, scene) => {
  if (!CROWDED.has(setting)) return '';
  const h = seedOf(scene);
  return `<g class="rm-depth" opacity=".72" pointer-events="none">${Array.from({ length: 7 }, (_, i) => { const x = -10 + i * 108 + ((h >>> (i + 2)) % 30); const w = 26 + ((h >>> i) % 10); return `<ellipse cx="${x}" cy="${372 - (i % 2) * 6}" rx="${w}" ry="${w * 1.1}" fill="${['#1a1712', '#231d16', '#16140f'][i % 3]}"/><ellipse cx="${x}" cy="${420}" rx="${w * 1.7}" ry="40" fill="#14120e"/>`; }).join('')}</g>`;
};
// ---------- the front layers: the table in front of whoever sits ----------
const FRONT = {
  sala: () => '',
  mercato: () => `<g>${R(-200, 328, 1040, 40, '#a89a82', 'opacity=".5"')}</g>`,
  cantiere: () => `<g>${R(-200, 322, 1040, 60, '#7b6948', 'opacity=".55"')}</g>`,
  sede: () => `<g>${R(70, 270, 560, 52, '#7a5a3c')}${R(70, 270, 560, 8, '#a07f57')}${[130, 250, 350, 470].map((x, i) => R(x, 278, 34, 22, '#f1ecdd', 'stroke="#8f8573"')).join('')}</g>`,
  commissione: () => `<g>${R(90, 272, 540, 50, '#6a4a30')}${R(90, 272, 540, 8, '#9a7752')}${[150, 300, 430].map(x => R(x, 282, 44, 8, '#f4efe0')).join('')}</g>`,
  redazione: () => `<g>${R(90, 272, 540, 50, '#a8855f')}${R(90, 272, 540, 8, '#c9a77b')}${R(260, 276, 26, 10, '#26323a')}${R(150, 280, 50, 16, '#f4f1e6', 'stroke="#9a9a8a"')}${R(380, 280, 50, 16, '#f4f1e6', 'stroke="#9a9a8a"')}</g>`,
  consiglio: () => `<g><ellipse cx="320" cy="298" rx="290" ry="30" fill="#7a4a36"/><ellipse cx="320" cy="292" rx="290" ry="28" fill="#8f5b43"/>${[140, 240, 400, 500].map(x => R(x - 20, 284, 40, 14, '#f4efe0', 'stroke="#b39e62"')).join('')}</g>`,
  // the new rooms: what stands between the camera and the people (the lectern of the press room, the oval table, the tables of the committee in Brussels, the desk of the course...)
  'piazza-comizio': () => `<g>${R(-200, 330, 1040, 40, '#7a6a58', 'opacity=".55"')}${[60, 210, 470, 600].map((x, i) => `<g class="${i % 2 ? '' : 'rm-live'}" transform="translate(${x},250)">${R(-1.5, 0, 3, 96, '#5a4a3a')}<path d="M1 2h30v20H1z" fill="${['#cd2b35', '#1f4a7a', '#1f8a4c', '#e8c96a'][i]}"/></g>`).join('')}</g>`,
  'sala-stampa': () => `<g>${R(190, 238, 44, 70, '#5a3a24')}${R(184, 232, 56, 10, '#7a5034')}${[-10, 0, 10].map((dx, i) => `<path d="M${212 + dx} 232l${dx / 2} -22" stroke="#222" stroke-width="2"/><circle cx="${212 + dx * 1.5}" cy="208" r="4" fill="${['#c62f3c', '#222', '#2d5a8a'][i]}"/>`).join('')}</g>`,
  trattativa: () => `<g><ellipse cx="350" cy="300" rx="270" ry="28" fill="#3a2f2a"/><ellipse cx="350" cy="294" rx="270" ry="26" fill="#4e3f36"/>${[230, 470].map(x => R(x - 22, 284, 44, 16, '#e9e1cc', 'stroke="#8f8573"')).join('')}${[300, 410].map(x => `<path d="M${x} 288v-14h10v14z" fill="#b8d8e8" opacity=".8"/>`).join('')}</g>`,
  bruxelles: () => `<g>${R(70, 272, 560, 46, '#3e4f68')}${R(70, 272, 560, 8, '#5c6f8a')}${[150, 300, 430, 560].map(x => `${R(x - 20, 280, 40, 10, '#f4efe0')}<path d="M${x + 14} 272l8 -16" stroke="#222" stroke-width="2"/><circle cx="${x + 23}" cy="254" r="3" fill="#e5484d"/>`).join('')}</g>`,
  social: () => `<g>${R(60, 280, 260, 40, '#2a2b38')}${R(60, 280, 260, 6, '#3d3f52')}${R(120, 266, 60, 16, '#bfc3d8', 'rx="2"')}${R(400, 284, 220, 36, '#2a2b38')}${R(470, 268, 70, 18, '#1a1b26', 'rx="2"')}${R(474, 270, 62, 12, '#8e86d8', 'opacity=".7"')}</g>`,
  'aula-corso': () => `<g>${R(60, 290, 220, 30, '#8a6a4a')}${R(60, 290, 220, 6, '#a8865e')}${R(110, 282, 54, 10, '#f4f1e6')}${R(470, 294, 160, 26, '#8a6a4a')}</g>`,
  giunta: () => `<g>${R(80, 274, 560, 48, '#5a3f2c')}${R(80, 274, 560, 8, '#7a5a40')}${R(300, 280, 70, 16, '#efe3c4', 'stroke="#7a5a40"')}${[160, 460, 560].map(x => R(x, 284, 40, 10, '#f4efe0')).join('')}</g>`,
  raccolta: () => `<g>${R(-200, 334, 1040, 36, '#3a2630', 'opacity=".5"')}<g transform="translate(320,300)"><ellipse cx="0" cy="0" rx="70" ry="14" fill="#f4efe0"/>${R(-30, -16, 60, 14, '#e8f2f6', 'opacity=".6" stroke="#8fb0c0"')}</g></g>`,
  'ufficio-tecnico': () => `<g>${R(200, 270, 300, 44, '#6f7a7e')}${R(200, 270, 300, 8, '#8a979c')}${R(230, 258, 120, 18, '#eef3f6', 'stroke="#8fa6b0"')}<path d="M240 266h100M260 262v8M300 262v8" stroke="#2d5a8a" stroke-width="1.5"/>${R(380, 262, 40, 12, '#f2c300')}</g>`,
  municipio: () => `<g>${R(260, 276, 380, 44, '#6a4f36')}${R(260, 276, 380, 7, '#8a6a4c')}${[340, 460, 560].map(x => R(x, 284, 44, 12, '#f4efe0')).join('')}</g>`,
  'aula-camera': () => `<g>${R(60, 290, 220, 34, '#5a3524')}${R(60, 290, 220, 7, '#7a4a30')}<path d="M170 290l10 -26" stroke="#222" stroke-width="2"/><circle cx="182" cy="262" r="4" fill="#222"/>${R(460, 296, 200, 28, '#5a3524')}</g>`
};

// ---------- the party headquarters: the room of the party of the player ----------
// The sign, the colours and the banner come from the identity of the party the career really holds (ui/party-identity.js: its official name, its logo when the database or the owner has one, its colour):
// no symbol is ever invented — a party without a logo gets its initials in its colour, an independent gets a plain sign. Drawn at render time from the identity, so careers saved before and parties
// founded in the game get it too.
const darken = (hex, amount) => /^#[\da-f]{6}$/i.test(hex ?? '') ? `#${[1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)).toString(16).padStart(2, '0')).join('')}` : '#2d4a4f';
const wrapName = (text, chars) => { const lines = []; let current = ''; for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) { if (current && `${current} ${word}`.length > chars) { lines.push(current); current = word; } else current = current ? `${current} ${word}` : word; } if (current) lines.push(current); return lines; };
export function partyHeadquarters(identity, { uid = 'sede' } = {}) {
  const named = identity && identity.kind === 'partito';
  const primary = named && /^#[\da-f]{6}$/i.test(identity.colors?.primary ?? identity.accent ?? '') ? (identity.colors?.primary ?? identity.accent) : null;
  const wall = primary ? darken(primary, .62) : '#2d4a4f', ink = primary ? inkOn(primary) : '#f4efe0';
  const name = named ? String(identity.name ?? '').toUpperCase() : 'SEDE DEL PARTITO';
  const mark = named ? String(identity.mark ?? identity.abbreviation ?? '').slice(0, 4).toUpperCase() : '';
  const lines = wrapName(name, 22).slice(0, 3);
  const size = lines.length > 2 ? 9.5 : lines.length > 1 ? 11 : 13;
  const logo = named && identity.logo ? `<clipPath id="${uid}-lg"><circle cx="238" cy="62" r="25"/></clipPath><circle cx="238" cy="62" r="27" fill="#fff"/><image href="${esc(identity.logo)}" x="213" y="37" width="50" height="50" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid}-lg)"/>`
    : named && mark ? `<circle cx="238" cy="62" r="27" fill="#fff"/><circle cx="238" cy="62" r="23" fill="${primary ?? '#264d82'}"/><text x="238" y="${mark.length > 2 ? 66 : 68}" text-anchor="middle" font-size="${mark.length > 2 ? 13 : 17}" font-weight="900" fill="${ink}">${esc(mark)}</text>` : '';
  const textX = logo ? 284 : 320, anchor = logo ? 'start' : 'middle';
  const sign = `<g class="rm-party-sign" data-party-sign>${R(190, 26, 260, 72, primary ?? '#3d5f66', 'rx="6"')}${R(190, 92, 260, 6, 'rgba(0,0,0,.28)', 'rx="2"')}${logo}`
    + lines.map((line, i) => `<text class="rm-party-name" x="${textX}" y="${(logo ? 62 : 62) - (lines.length - 1) * (size + 2) / 2 + i * (size + 2) + size / 3}" text-anchor="${anchor}" font-size="${size}" font-weight="900" fill="${ink}" letter-spacing=".6">${esc(line)}</text>`).join('')
    + `${named ? '' : ''}</g>`;
  const flag = x => primary ? `<g class="rm-party-flag" transform="translate(${x},92)"><rect x="-1.2" y="0" width="2.4" height="86" fill="#c8c0a8"/>${R(1, 2, 46, 30, primary)}<text x="24" y="22" text-anchor="middle" font-size="${mark.length > 2 ? 9 : 12}" font-weight="900" fill="${ink}">${esc(mark)}</text></g>` : tricolore(x, 92);
  return `${R(-200, -100, 1040, 330, wall)}${R(-200, 214, 1040, 200, '#5a4a3a')}${R(-200, 205, 1040, 10, '#3e332a')}${primary ? R(-200, 196, 1040, 9, primary, 'opacity=".85"') : ''}`
    + `${sign}<g>${R(214, 108, 212, 56, '#f2eee2', 'stroke="#c5bda8" stroke-width="3"')}${[0, 1, 2, 3, 4].map(i => R(232 + i * 38, 156 - [14, 30, 22, 38, 26][i], 24, [14, 30, 22, 38, 26][i], i % 2 ? (primary ?? '#4A9DB8') : '#c4a66a')).join('')}<path d="M226 158H420" stroke="#3a3a3a" stroke-width="2"/></g>`
    + `${flag(90)}${tricolore(560, 92)}`
    + `<g>${R(20, 70, 52, 70, '#f4efe0', 'stroke="#8f8573"')}<path d="M28 86H64M28 100H58M28 114H62" stroke="${wall}" stroke-width="3"/></g>${R(580, 74, 44, 56, '#e9e1cc', 'stroke="#8f8573"')}`
    + `${Array.from({ length: 6 }, (_, i) => `<g transform="translate(${64 + i * 92},246)">${R(-18, 0, 36, 34, '#6f5a43')}${R(-18, -10, 36, 12, primary ? darken(primary, .25) : '#80684e')}</g>`).join('')}`;
}

// What the room has around it for this activity, behind the characters: small shapes in the upper part of the stage (never over the faces or the straps). The shapes with a class `rm-live` move a little
// (a flash, a nod of the crowd) only when the visitor has not asked for less motion (scene.css).
const AMBIENCE_ART = {
  folla: () => `<g class="rm-ambience" data-ambience="folla">${[78, 118, 158, 198, 238].map((x, i) => `<g class="${i % 2 ? 'rm-live' : ''}" style="animation-delay:${i * 0.4}s"><circle cx="${x}" cy="${168 - (i % 2) * 5}" r="7" fill="#6b5a48" opacity=".55"/>${R(x - 9, 175 - (i % 2) * 5, 18, 14, '#5a4a3a', 'opacity=".5"')}</g>`).join('')}</g>`,
  stampa: () => `<g class="rm-ambience" data-ambience="stampa">${[560, 592, 620].map((x, i) => `<g><rect x="${x - 10}" y="${150 + i * 5}" width="20" height="13" rx="2" fill="#2a2a30" opacity=".75"/><circle cx="${x}" cy="${156.5 + i * 5}" r="4" fill="#9aa4b2" opacity=".8"/><circle class="rm-live rm-flash" style="animation-delay:${i * 0.9}s" cx="${x + 7}" cy="${152 + i * 5}" r="2" fill="#fff6c8"/></g>`).join('')}${R(14, 144, 60, 4, '#2a2a30', 'opacity=".6"')}</g>`,
  cantiere: () => `<g class="rm-ambience" data-ambience="cantiere"><path d="M30 190 L30 120 L96 120" stroke="#c98a1c" stroke-width="5" fill="none" opacity=".75"/><path d="M96 120 L96 138" stroke="#c98a1c" stroke-width="2" opacity=".75"/>${[60, 80].map(x => `<path d="M${x} 190 V150" stroke="#e8b440" stroke-width="3" opacity=".6"/>`).join('')}${R(560, 180, 46, 10, '#d8a63a', 'opacity=".55"')}${R(566, 168, 34, 12, '#e8b440', 'opacity=".55"')}</g>`,
  carte: () => `<g class="rm-ambience" data-ambience="carte">${[0, 1, 2].map(i => `<g transform="translate(${420 + i * 58},${178 - (i % 2) * 6}) rotate(${i % 2 ? 4 : -3})">${R(0, 0, 34, 44, '#f1ece0', 'opacity=".7" stroke="#b6ac96"')}<path d="M5 10H29M5 18H27M5 26H29" stroke="#8a826e" stroke-width="2"/></g>`).join('')}</g>`,
  bilancio: () => `<g class="rm-ambience" data-ambience="bilancio"><g transform="translate(14,92)">${R(0, 0, 112, 64, '#f4f1e6', 'opacity=".85" stroke="#8f8573"')}${[8, 28, 48, 68, 88].map((x, i) => R(x + 4, 56 - [18, 30, 22, 40, 34][i], 14, [18, 30, 22, 40, 34][i], '#3a6b72', 'opacity=".8"')).join('')}</g></g>`,
  palazzo: () => `<g class="rm-ambience" data-ambience="palazzo">${R(250, 60, 140, 8, '#b09a5a', 'opacity=".5"')}${[262, 300, 338, 376].map(x => R(x - 4, 68, 8, 96, '#cbbf9a', 'opacity=".4"')).join('')}</g>`
};
function roomSvg(scene, stage, node, uid, identity = null) {
  const setting = scene.setting;
  const actors = [...scene.cast, ...(scene.extras ?? []).filter(item => stage.poses[item.id])].sort((a, b) => (stage.poses[a.id]?.y ?? 0) - (stage.poses[b.id]?.y ?? 0)).map((member, index) => actorSvg(member, stage.poses[member.id], `${uid}a${index}`, { speaking: node?.speaker === member.id, expression: node?.speaker === member.id ? node.expression : stage.poses[member.id]?.expression ?? null })).join('');
  const speaking = id => node?.speaker === id;
  const [me, one, two] = [scene.cast.find(item => item.role === 'giocatore'), ...scene.cast.filter(item => item.role === 'ospite')];
  const body = scene.bodyLabel ?? '';
  // the name straps follow where the two guests stand (the composition may swap them): the left strap is always the guest on the left
  const [left, right] = [one, two].sort((a, b) => (stage.poses[a?.id]?.x ?? 0) - (stage.poses[b?.id]?.x ?? 0));
  const straps = `${strap(me, 8, 204, 334, speaking(me.id), body)}${strap(left, 218, 204, 334, speaking(left.id), body)}${strap(right, 428, 204, 334, speaking(right.id), body)}`;
  const back = (setting === 'sede' ? partyHeadquarters(identity, { uid }) : BACK[setting](scene)) + decorOf(setting, scene) + propsOf(setting, scene) + hourLayer(scene, uid);
  const ambience = (AMBIENCE_ART[ambienceOf(scene.activityId)] ?? AMBIENCE_ART.carte)();
  return { body: `<g class="st-room" data-room="${esc(setting)}">${back}</g>${ambience}<g class="st-actors">${actors}</g><g class="st-room-front">${FRONT[setting]()}${depthOf(setting, scene)}</g>`, overlay: `<g class="st-straps">${straps}</g>` };
}
for (const setting of Object.keys(BACK)) registerStageSetting(setting, roomSvg);
export const ROOMS = Object.freeze(Object.keys(BACK));
