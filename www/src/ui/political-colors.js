// The colours of the political forces in the national view, fixed by id: a force, or a coalition led by it, has the same colour in every legislature, every vote, every week and every view
// (Calendario, Coalizioni, Proiezione, Camere), whatever else is on the page. The colours come from the validated series of the charts; the camps keep their sense (the centre-right is blue, the
// centre-left coral, the M5S green, the centre violet) and what has no entry here takes a colour from a fixed pool by a hash of its own id, never by the order in which it happens to be drawn.
import { SERIES } from './charts.js?v=20261017-1';

const BLUE = SERIES[0], GOLD = SERIES[1], CORAL = SERIES[2], GREEN = SERIES[3], VIOLET = SERIES[4], PINK = SERIES[5], SAGE = SERIES[6], SKY = SERIES[7];
export const NEUTRAL_COLOR = '#8d9791';
// The forces the game knows by id (real data): the party in the dataset and the coalitions it leads share the colour.
export const FORCE_COLORS = Object.freeze({
  'party-registro-p1-2014-04-ir': BLUE,    // Fratelli d’Italia
  'party-registro-p1-2015-29-ir': CORAL,   // Partito Democratico
  'party-registro-p1-2022-63-ir': GREEN,   // Movimento 5 Stelle
  'party-registro-p1-2017-41-ir': GOLD,    // Lega
  'party-registro-p1-2015-20-ir': SAGE,    // Forza Italia
  'coalition-alleanza-verdi-sinistra': PINK, // Alleanza Verdi e Sinistra
  'party-registro-p1-2019-51-ir': VIOLET,  // Azione
  'party-futuro-nazionale': SKY            // Futuro Nazionale
});
// The alliances of 2022 (real data of the national map).
export const ALLIANCE_COLORS = Object.freeze({ cdx: BLUE, csx: CORAL, m5s: GREEN, 'azione-iv': VIOLET });
// What has no entry: a pool of the series that the entries above use least, picked by the id.
const FALLBACK_POOL = Object.freeze([GOLD, GREEN, VIOLET, SAGE, SKY]);
const hash = text => [...String(text)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261);
export const stableColor = (id, pool = FALLBACK_POOL) => pool[hash(id) % pool.length];
// The colour a party was given on purpose (a correction of the owner in the Admin, the colour of a party founded in the game) is the colour of that party in every view; the app sets
// them from the world each time it draws. Without one, the colour of the id below (the fallback, fixed by the id, never by the order of drawing).
let overrides = new Map();
export const setForceColorOverrides = map => { overrides = map instanceof Map ? map : new Map(); };
export const forceColor = id => overrides.get(id) ?? FORCE_COLORS[id] ?? stableColor(id);
// A coalition: its own entry, else the colour of its leader, else its own id.
export const coalitionColor = coalition => ALLIANCE_COLORS[coalition?.id] ?? FORCE_COLORS[coalition?.leaderId] ?? FORCE_COLORS[coalition?.id] ?? stableColor(coalition?.id ?? coalition?.leaderId ?? 'coalizione');
