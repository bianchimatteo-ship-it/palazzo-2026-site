// What a photograph shows of a face, read ON THE DEVICE from the pixels of the square crop the player has aligned to the guide of the editor (ui/photo-avatar.js): no server, no AI service, no
// model downloaded, no biometric template kept. It is a set of measures on colours and outlines in fixed zones of the guide (the face is where the oval is), translated into the options of the
// illustrated avatar (core/avatar.js AVATAR_OPTIONS): carnagione, colore e lunghezza dei capelli, occhiali, barba e baffi, larghezza del volto. Every trait comes with how sure the reading is
// ('alta', 'media', 'bassa') or 'non-visibile': the editor shows it and the player corrects what is wrong. The gender is NEVER read from the photo: the face of the avatar follows the gender chosen
// in the wizard, and beard and moustache are proposed only for a masculine face. Pure functions on RGBA arrays: the same code runs in the tests (Node) and in the page.
import { AVATAR_OPTIONS } from '../core/avatar.js?v=20261126-3';

// The guide drawn over the crop (fractions of the side): the oval of the face. The zones below are placed on it.
export const GUIDE = Object.freeze({ cx: 0.5, cy: 0.52, rx: 0.25, ry: 0.33 });
export const ANALYSIS_SIZE = 128;

// ---------- colour ----------
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function toLab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const median = values => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const medianColour = pixels => pixels.length ? [0, 1, 2].map(k => median(pixels.map(p => p[k]))) : null;

// The pixels of a zone (a rectangle in fractions of the side) of an RGBA square.
function zone(data, size, x0, y0, x1, y1) {
  const out = [];
  for (let y = Math.max(0, Math.floor(y0 * size)); y < Math.min(size, Math.ceil(y1 * size)); y++) for (let x = Math.max(0, Math.floor(x0 * size)); x < Math.min(size, Math.ceil(x1 * size)); x++) {
    const i = (y * size + x) * 4; out.push([data[i], data[i + 1], data[i + 2]]);
  }
  return out;
}
// The outlines (gradient of the light) of a zone: the mean strength, and the share of strong horizontal edges.
function edges(data, size, x0, y0, x1, y1) {
  const L = (x, y) => { const i = (y * size + x) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
  let total = 0, horizontal = 0, count = 0;
  for (let y = Math.max(1, Math.floor(y0 * size)); y < Math.min(size - 1, Math.ceil(y1 * size)); y++) for (let x = Math.max(1, Math.floor(x0 * size)); x < Math.min(size - 1, Math.ceil(x1 * size)); x++) {
    const gx = L(x + 1, y) - L(x - 1, y), gy = L(x, y + 1) - L(x, y - 1);
    const g = Math.hypot(gx, gy); total += g; count++;
    if (Math.abs(gy) > 28 && Math.abs(gy) > 1.6 * Math.abs(gx)) horizontal++;
  }
  return { mean: count ? total / count : 0, horizontal: count ? horizontal / count : 0 };
}
const nearestOption = (field, rgb) => { const lab = toLab(rgb); return AVATAR_OPTIONS[field].map(item => ({ id: item.id, d: dist(lab, toLab(hexRgb(item.color))) })).sort((a, b) => a.d - b.d)[0]; };

// The colour of the hair as one of the options: by lightness, saturation and hue (a brown photographed in shadow is darker than the swatch, so the swatches alone would call it black).
export function hairColourOf(rgb) {
  const [L, a, b] = toLab(rgb);
  const chroma = Math.hypot(a, b), hue = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  if (chroma < 9 && L > 52) return 'grigio';
  if (L < 22) return 'nero';
  if (chroma > 24 && hue < 62 && a > 16 && L < 62) return 'rosso';
  if (L > 50 && hue > 55 && hue < 100 && chroma > 14) return 'biondo';
  if (chroma < 8 && L < 40) return 'nero';
  return 'castano';
}

// The reading. `data`: RGBA of a size × size square (the crop aligned to GUIDE). Returns { traits, readings, measures }: `traits` only for what could be read, `readings[field]` = { value, confidence, note }.
export function analyzeFace(data, size = ANALYSIS_SIZE, { masculine = true } = {}) {
  const readings = {}, traits = {}, measures = {};
  const put = (field, value, confidence, note = '') => { readings[field] = { value, confidence, note }; if (value != null && confidence !== 'non-visibile' && confidence !== 'bassa') traits[field] = value; };
  // the skin: the two cheeks and the nose bridge (the forehead may be under a fringe)
  const cheeks = [...zone(data, size, 0.37, 0.53, 0.44, 0.59), ...zone(data, size, 0.56, 0.53, 0.63, 0.59), ...zone(data, size, 0.47, 0.51, 0.53, 0.60)];
  const skin = medianColour(cheeks);
  const skinLab = toLab(skin);
  const isSkin = p => dist(toLab(p), skinLab) < 16;
  const cheekSpread = median(cheeks.map(p => dist(toLab(p), skinLab))) ?? 99;
  measures.skin = skin; measures.cheekSpread = cheekSpread;
  // the background: the two upper corners
  // the background: the upper corners and the outer edges lower down (a gradient or a wall in shadow changes along the photo)
  const backgrounds = [[0, 0, 0.08, 0.08], [0.92, 0, 1, 0.08], [0, 0.45, 0.05, 0.7], [0.95, 0.45, 1, 0.7]].map(([x0, y0, x1, y1]) => toLab(medianColour(zone(data, size, x0, y0, x1, y1))));
  const isBackground = p => { const lab = toLab(p); return backgrounds.some(ref => dist(lab, ref) < 14); };
  const skinVisible = cheekSpread < 14 && skinLab[0] > 18;
  put('skin', skinVisible ? nearestOption('skin', skin).id : null, !skinVisible ? 'non-visibile' : cheekSpread < 7 ? 'alta' : 'media', skinVisible ? '' : 'Il volto non è al centro della guida o è in ombra.');
  // the hair: its colour is read where hair is almost always (above the forehead and at the temples), then its extent is measured with THAT colour (beside the jaw and the neck: long hair; a
  // collar or the background there is not hair)
  const notSkinNotBg = p => !isSkin(p) && !isBackground(p);
  const crown = zone(data, size, 0.36, 0.12, 0.64, 0.21), temples = [...zone(data, size, 0.21, 0.26, 0.28, 0.42), ...zone(data, size, 0.72, 0.26, 0.79, 0.42)];
  const upper = [...crown, ...temples].filter(notSkinNotBg);
  const hairColour = upper.length >= 20 ? medianColour(upper) : null;
  measures.hairColour = hairColour;
  const hairLab = hairColour ? toLab(hairColour) : null;
  const isHair = p => Boolean(hairLab) && !isSkin(p) && !isBackground(p) && dist(toLab(p), hairLab) < 20;
  const share = pixels => pixels.length ? pixels.filter(isHair).length / pixels.length : 0;
  const sidesMid = [...zone(data, size, 0.17, 0.54, 0.25, 0.66), ...zone(data, size, 0.75, 0.54, 0.83, 0.66)];
  const sidesLow = [...zone(data, size, 0.15, 0.70, 0.25, 0.88), ...zone(data, size, 0.75, 0.70, 0.85, 0.88)];
  const fringe = zone(data, size, 0.40, 0.32, 0.60, 0.38);
  measures.hair = { crown: share(crown), temples: share(temples), sidesMid: share(sidesMid), sidesLow: share(sidesLow), fringe: share(fringe) };
  const h = measures.hair;
  const bald = !hairColour || (h.crown < 0.12 && h.temples < 0.12);
  if (hairColour && !bald) put('hair', hairColourOf(hairColour), upper.length > 150 ? 'alta' : 'media');
  else put('hair', null, 'non-visibile', bald && skinVisible ? 'Capelli assenti o rasati: il colore resta quello scelto.' : 'Capelli non distinguibili dallo sfondo o dalla pelle.');
  // the style: long, bob, short, receding, shaved, curly, fringe (the ones the drawings have that a photo can tell apart)
  const texture = hairColour ? edges(data, size, 0.36, 0.12, 0.64, 0.21).mean : 0;
  measures.hairTexture = texture;
  let style = null, styleConfidence = 'media';
  if (bald && skinVisible) { style = 'rasato'; styleConfidence = 'media'; }
  else if (h.crown < 0.25 && h.temples > 0.3) style = 'stempiato';
  else if (h.sidesLow > 0.4) { style = texture > 30 ? 'ondulato' : 'lungo'; styleConfidence = h.sidesLow > 0.6 ? 'alta' : 'media'; }
  else if (h.sidesMid > 0.4) style = 'caschetto';
  else if (h.fringe > 0.5) style = 'frangia';
  else if (h.crown > 0.4 && texture > 34) style = 'riccio';
  else if (h.crown > 0.3 || h.temples > 0.3) style = 'corto';
  if (style && !masculine && style === 'stempiato') style = 'corto';
  put('hairstyle', style, style ? styleConfidence : 'non-visibile', style ? '' : 'Lunghezza dei capelli non leggibile: allarga l’inquadratura.');
  // the glasses: a FRAME, i.e. a closed dark outline round each eye (a line above, one below, one at each side) with the eye inside it. Eyebrows give only the upper line, the lashes a short one, a fringe or
  // long hair a filled dark area (the inside of the outline is dark too), a shadow or a reflection is not dark enough or not an outline: none of them closes a ring. A ring on both eyes, at the same height,
  // is a pair of glasses; no trace of a ring is no glasses; anything in between is NOT decided (the editor asks the player).
  const lum = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) lum[i] = toLab([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]])[0];
  // «dark» is relative to the skin of the SAME side of the face (light from one side makes one cheek darker than the other)
  const sideSkin = zones => median(zones.map(p => toLab(p)[0]));
  const inkLeft = Math.min(sideSkin(zone(data, size, 0.37, 0.53, 0.44, 0.59)) * 0.68, 62), inkRight = Math.min(sideSkin(zone(data, size, 0.56, 0.53, 0.63, 0.59)) * 0.68, 62);
  const ink = (x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < size && y < size && lum[y * size + x] < (x < size / 2 ? inkLeft : inkRight); };
  const near = (x, y, r = 1) => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (ink(x + dx, y + dy)) return true; return false; };
  // the outline of a frame (rectangular, or round) round the point (cx, cy): how much of each of its four sides (top, bottom, left, right) is dark, how dark the inside and the margin just outside are
  const ring = (cx, cy, hw, hh, round) => {
    const X = cx * size, Y = cy * size, W = hw * size, H = hh * size, n = 14;
    const pointOn = (side, t) => {
      if (!round) return side === 0 ? [X + t * W, Y - H] : side === 1 ? [X + t * W, Y + H] : side === 2 ? [X - W, Y + t * H] : [X + W, Y + t * H];
      const a = (side === 0 ? -90 : side === 1 ? 90 : side === 2 ? 180 : 0) * Math.PI / 180 + t * 0.9;
      return [X + Math.cos(a) * W, Y + Math.sin(a) * H];
    };
    const sides = [0, 1, 2, 3].map(side => { let hit = 0; for (let k = 0; k < n; k++) { const [x, y] = pointOn(side, -0.7 + 1.4 * k / (n - 1)); if (near(x, y)) hit++; } return hit / n; });
    let inside = 0, total = 0;
    for (let yy = Y - H * 0.7; yy <= Y + H * 0.7; yy += 1) for (let xx = X - W * 0.7; xx <= X + W * 0.7; xx += 1) { total++; if (ink(xx, yy)) inside++; }
    const filled = total ? inside / total : 1;
    // a frame is a thin line on the skin: right outside it there is skin, not more dark (a band of shadow, a mass of hair or a fringe is dark on both sides of the line)
    let outsideInk = 0, outsideTotal = 0;
    for (let side = 0; side < 4; side++) for (let k = 0; k < n; k++) {
      const [x, y] = pointOn(side, -0.7 + 1.4 * k / (n - 1)); outsideTotal++;
      const dx = side === 2 ? -3.2 : side === 3 ? 3.2 : 0, dy = side === 0 ? -3.2 : side === 1 ? 3.2 : 0; if (ink(x + dx, y + dy)) outsideInk++;
    }
    const outside = outsideInk / outsideTotal;
    const corners = round ? 0 : [[-1, -1], [1, -1], [-1, 1], [1, 1]].filter(([fx, fy]) => near(X + fx * W * 0.92, Y + fy * H * 0.92, 1)).length / 4;
    return { score: Math.min(...sides) * (1 - Math.min(1, Math.max(0, filled - 0.25) * 2)) * (1 - Math.min(1, Math.max(0, outside - 0.1) * 2)), corners, cy, round };
  };
  const bestRing = side => {
    let best = { score: 0, corners: 0, cy: 0, round: false };
    for (let d = 0.08; d <= 0.17 + 1e-9; d += 0.01) for (let cy = 0.40; cy <= 0.54; cy += 0.01) for (const hw of [0.06, 0.07, 0.08, 0.09]) for (const hh of [0.035, 0.045, 0.055]) for (const round of [false, true]) {
      const r = ring(0.5 + side * d, cy, hw, hh, round); if (r.score > best.score) best = r;
    }
    return best;
  };
  const ringL = bestRing(-1), ringR = bestRing(1);
  const level = Math.abs(ringL.cy - ringR.cy) <= 0.035;
  const pair = level ? Math.min(ringL.score, ringR.score) : Math.min(ringL.score, ringR.score) * 0.6, strongest = Math.max(ringL.score, ringR.score);
  // the eyes under hair or a band of shadow: nothing can be told about the glasses
  const eyeZone = [...zone(data, size, 0.35, 0.455, 0.455, 0.48), ...zone(data, size, 0.545, 0.455, 0.65, 0.48)];
  const covered = eyeZone.filter(p => toLab(p)[0] < skinLab[0] * 0.68).length / eyeZone.length;
  // the whole eye band darker than the cheeks (a cap, a strong light from above): the outline would hide in it
  const cheekL = zones => median(zones.map(p => toLab(p)[0])), bandL = (x0, x1) => median(zone(data, size, x0, 0.40, x1, 0.50).map(p => toLab(p)[0]));
  const shaded = bandL(0.30, 0.50) < cheekL(zone(data, size, 0.37, 0.53, 0.44, 0.59)) * 0.86 || bandL(0.50, 0.70) < cheekL(zone(data, size, 0.56, 0.53, 0.63, 0.59)) * 0.86;
  measures.glasses = { covered, left: ringL.score, right: ringR.score, pair, strongest, corners: (ringL.corners + ringR.corners) / 2 };
  if (!skinVisible) put('glasses', null, 'non-visibile');
  else if (covered > 0.55) put('glasses', null, 'bassa', 'Gli occhi sono coperti da capelli o ombra: scegli tu se porti gli occhiali.');
  else if (shaded) put('glasses', null, 'bassa', 'La zona degli occhi è in ombra: scegli tu se porti gli occhiali.');
  else if (pair >= 0.62) put('glasses', (ringL.round || ringR.round) && measures.glasses.corners < 0.5 ? 'tondi' : 'rettangolari', pair > 0.8 ? 'alta' : 'media', (ringL.round || ringR.round) && measures.glasses.corners < 0.5 ? '' : 'Forma della montatura da verificare (tonda o rettangolare).');
  else if (strongest < 0.3) put('glasses', 'nessuno', 'alta');
  else if (strongest < 0.45 && pair < 0.3) put('glasses', 'nessuno', 'media');
  else put('glasses', null, 'bassa', 'Non è chiaro se porti gli occhiali: scegli tu.');
  // beard and moustache: darker than the skin and close to the hair on the chin, the jaw and the upper lip (only for a masculine face)
  if (!masculine) { put('beard', 'nessuna', 'alta', 'Segue il genere scelto.'); put('moustache', 'nessuno', 'alta', 'Segue il genere scelto.'); }
  else if (!skinVisible) { put('beard', null, 'non-visibile'); put('moustache', null, 'non-visibile'); }
  else {
    // facial hair: far from the skin and nearer to the colour of the hair than to the skin (a grey beard on a dark skin is lighter than it); with no hair to compare, darker than the skin
    const facial = p => { const lab = toLab(p); if (isBackground(p) || dist(lab, skinLab) < 14) return false; return hairLab ? dist(lab, hairLab) < dist(lab, skinLab) : lab[0] < skinLab[0] - 10; };
    const stubble = p => { const lab = toLab(p); return lab[0] < skinLab[0] - 5 && lab[0] >= skinLab[0] - 12 && dist(lab, skinLab) >= 6; };
    const chin = zone(data, size, 0.42, 0.79, 0.58, 0.86), jaw = [...zone(data, size, 0.31, 0.70, 0.39, 0.80), ...zone(data, size, 0.61, 0.70, 0.69, 0.80)], lip = zone(data, size, 0.43, 0.665, 0.57, 0.69);
    const part = (pixels, test) => pixels.length ? pixels.filter(test).length / pixels.length : 0;
    const c = part(chin, facial), j = part(jaw, facial), m = part(lip, facial), s = part([...chin, ...jaw], stubble);
    measures.beard = { chin: c, jaw: j, lip: m, stubble: s };
    let beard = 'nessuna', bc = 'media';
    if (c > 0.5 && j > 0.5) { beard = c > 0.65 && j > 0.6 ? 'completa' : 'corta'; bc = 'alta'; }
    else if (c > 0.42 && j < 0.2) beard = 'pizzetto';
    else if (j > 0.55 && c < 0.3) beard = 'basette';
    else if (s > 0.6 && c < 0.3) beard = 'tregiorni';
    else bc = c < 0.2 && j < 0.2 ? 'alta' : 'bassa';
    put('beard', beard, bc);
    const moustache = m > 0.55 ? (m > 0.8 ? 'folti' : 'classici') : 'nessuno';
    put('moustache', moustache, m > 0.55 || m < 0.2 ? 'media' : 'bassa');
  }
  // the width of the face: how far the skin goes from the centre at the height of the cheekbones, against the width of the guide
  const row = Math.round(0.58 * size), centre = Math.round(GUIDE.cx * size);
  const reach = dir => { let x = centre; while (x > 0 && x < size - 1) { const i = (row * size + x) * 4; if (!isSkin([data[i], data[i + 1], data[i + 2]])) break; x += dir; } return Math.abs(x - centre); };
  const width = (reach(-1) + reach(1)) / (2 * GUIDE.rx * size);
  measures.width = width;
  if (skinVisible && width > 0.5 && width < 1.6) { const w = Math.max(-3, Math.min(3, Math.round((width - 1) * 8))); readings.shape = { value: { w }, confidence: 'media', note: '' }; if (w) traits.shape = { w }; }
  return { traits, readings, measures };
}

// What the editor writes under the preview: what the photo showed, in plain words.
export const READING_LABELS = Object.freeze({ skin: 'Carnagione', hair: 'Colore dei capelli', hairstyle: 'Acconciatura', glasses: 'Occhiali', beard: 'Barba', moustache: 'Baffi' });
export const CONFIDENCE_LABELS = Object.freeze({ alta: 'riconosciuto', media: 'probabile', bassa: 'incerto', 'non-visibile': 'non visibile' });
