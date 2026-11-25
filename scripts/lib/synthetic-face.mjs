// Synthetic portraits for the tests of the photo avatar: a face painted on RGBA pixels with known traits (skin, hair colour and length, glasses, beard, moustache), with shading, noise and a
// background, framed as the player frames a photo in the editor (the face in the guide oval). NOT real photographs: what they prove is that the reading maps each visible trait to the right option
// and that the pipeline (file → decode → crop → reading → avatar) works; how well it reads real faces in real light needs real photos (docs/qa).
import { deflateSync } from 'node:zlib';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const SKINS = { porcellana: '#f3d6be', chiara: '#e6b994', oliva: '#c8956a', bruna: '#9c6640', scura: '#5f3a24' };
export const HAIRS = { nero: '#16100e', castano: '#583823', biondo: '#d8b46a', rosso: '#a8441c', grigio: '#b4b4b4' };

// `frame`: the face in the crop — 1 = exactly the guide, < 1 a smaller face (the photo taken from farther), with an offset (dx, dy) and an overall light (`light`).
export function paintFace({ size = 256, skin = 'chiara', hair = 'castano', length = 'corto', glasses = false, beard = 'nessuna', moustache = false, background = '#6f8fa8', noise = 10, seed = 7, light = 1, frame = 1, dx = 0, dy = 0, eyeFringe = false, heavyBrows = false, shadow = 0, glare = false, round = false, thinRims = false, sideLight = 0 } = {}) {
  const px = new Uint8ClampedArray(size * size * 4);
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const S = hex(SKINS[skin] ?? skin), H = hex(HAIRS[hair] ?? hair), B = hex(background);
  const cx = (0.5 + dx) * size, cy = (0.52 + dy) * size, rx = 0.25 * size * frame, ry = 0.33 * size * frame;
  const inEllipse = (x, y, ex, ey, ax, ay) => ((x - ex) / ax) ** 2 + ((y - ey) / ay) ** 2 <= 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    let c = B.map((v, k) => v + (y / size) * 18 * (k === 2 ? -1 : 1));
    // neck and shoulders
    if (y > cy + ry * 0.8 && Math.abs(x - cx) < rx * 0.45) c = S.map(v => v * 0.85);
    if (y > cy + ry * 1.15) c = [40, 52, 80];
    // long hair falls behind the face, down to the shoulders
    const back = length === 'lungo' && inEllipse(x, y, cx, cy + ry * 0.35, rx * 1.38, ry * 1.32) && y > cy - ry * 0.4;
    const bob = length === 'caschetto' && inEllipse(x, y, cx, cy, rx * 1.3, ry * 1.08) && y < cy + ry * 0.45;
    if (back || bob) c = H;
    const face = inEllipse(x, y, cx, cy, rx, ry);
    if (face) {
      const shade = 1 - 0.18 * (((x - cx) / rx) ** 2) - 0.08 * Math.max(0, (y - cy) / ry);
      c = S.map(v => v * shade);
      // eyes, brows, mouth
      for (const ex of [cx - rx * 0.38, cx + rx * 0.38]) {
        if (inEllipse(x, y, ex, cy - ry * 0.16, rx * 0.16, ry * 0.05)) c = [245, 245, 240];
        if (inEllipse(x, y, ex, cy - ry * 0.16, rx * 0.06, ry * 0.045)) c = [60, 40, 30];
        if (inEllipse(x, y, ex, cy - ry * (heavyBrows ? 0.26 : 0.3), rx * (heavyBrows ? 0.26 : 0.2), ry * (heavyBrows ? 0.05 : 0.025))) c = heavyBrows ? [20, 16, 14] : H.map(v => v * 0.9 + 20);
      }
      if (inEllipse(x, y, cx, cy + ry * 0.55, rx * 0.28, ry * 0.035)) c = [150, 70, 70];
      // beard and moustache (hair colour, a little texture)
      const chinZone = y > cy + ry * 0.62 && inEllipse(x, y, cx, cy + ry * 0.2, rx * (beard === 'pizzetto' ? 0.32 : 1.05), ry * 0.95);
      const jawZone = y > cy + ry * 0.25 && Math.abs(x - cx) > rx * 0.45;
      if (beard === 'completa' && (chinZone || jawZone) && !inEllipse(x, y, cx, cy + ry * 0.55, rx * 0.28, ry * 0.035)) c = H.map(v => v + (rnd() - 0.5) * 20);
      if (beard === 'pizzetto' && chinZone) c = H.map(v => v + (rnd() - 0.5) * 20);
      if (moustache && y > cy + ry * 0.44 && y < cy + ry * 0.52 && Math.abs(x - cx) < rx * 0.3) c = H;
      // short hair on the top of the head and a fringe line
      if (length !== 'rasato' && y < cy - ry * 0.62) c = H;
    }
    // the hair above the face (any length but shaved)
    if (length !== 'rasato' && !face && inEllipse(x, y, cx, cy - ry * 0.25, rx * 1.12, ry * 0.92) && y < cy - ry * 0.05) c = H.map(v => v + (rnd() - 0.5) * 16);
    if (length !== 'rasato' && !face && inEllipse(x, y, cx, cy, rx * 1.1, ry * 1.02) && y < cy + ry * 0.1 && y > cy - ry * 0.4) c = H.map(v => v + (rnd() - 0.5) * 16);
    // a fringe of hair falling over the forehead and the eyes (dark and filled, not an outline)
    if (eyeFringe && face && y < cy - ry * 0.1 && y > cy - ry * 0.7 && Math.abs(x - cx) < rx * 0.95) c = H.map(v => v + (rnd() - 0.5) * 16);
    // a band of shadow across the eyes (a cap, a strong overhead light): darker, soft, no outline
    if (shadow && face && y > cy - ry * 0.3 && y < cy - ry * 0.05) c = c.map(v => v * (1 - shadow));
    // light from the side: one half of the face darker
    if (sideLight && face) c = c.map(v => v * (x < cx ? 1 - sideLight : 1));
    // glasses: dark rims around the eyes and a bridge
    if (glasses) {
      for (const ex of [cx - rx * 0.38, cx + rx * 0.38]) {
        const ox = Math.abs(x - ex), oy = Math.abs(y - (cy - ry * 0.16));
        const W = rx * 0.27, Hh = ry * 0.11, t = Math.max(thinRims ? 1 : 1.5, size / (thinRims ? 160 : 110));
        if (round) { const d = Math.hypot(ox / W, oy / Hh); if (Math.abs(d - 1) * Math.min(W, Hh) <= t) c = [25, 25, 28]; }
        else if ((ox <= W && Math.abs(oy - Hh) <= t) || (oy <= Hh && Math.abs(ox - W) <= t)) c = [25, 25, 28];
        if (glare && ox < W * 0.6 && oy < Hh * 0.7 && ox > W * 0.15) c = c.map(v => Math.min(255, v + 90));
      }
      if (Math.abs(y - (cy - ry * 0.18)) <= Math.max(1.5, size / 110) && Math.abs(x - cx) <= rx * 0.11) c = [25, 25, 28];
    }
    const n = (rnd() - 0.5) * noise;
    px[i] = (c[0] + n) * light; px[i + 1] = (c[1] + n) * light; px[i + 2] = (c[2] + n) * light; px[i + 3] = 255;
  }
  return px;
}

// RGBA → PNG (no compression filters beyond deflate): the «photo file» of the browser tests.
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = buf => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(8 + data.length + 4); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length); return out; };
export function pngOf(px, width, height = width) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1); }
  const head = Buffer.alloc(13); head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// downscale an RGBA square (box filter) to the size of the reading
export function downscale(px, size, to) {
  const out = new Uint8ClampedArray(to * to * 4), f = size / to;
  for (let y = 0; y < to; y++) for (let x = 0; x < to; x++) for (let k = 0; k < 4; k++) {
    let sum = 0, count = 0;
    for (let yy = Math.floor(y * f); yy < Math.floor((y + 1) * f); yy++) for (let xx = Math.floor(x * f); xx < Math.floor((x + 1) * f); xx++) { sum += px[(yy * size + xx) * 4 + k]; count++; }
    out[(y * to + x) * 4 + k] = sum / count;
  }
  return out;
}
