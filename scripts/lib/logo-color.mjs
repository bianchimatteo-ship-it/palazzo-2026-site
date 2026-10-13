// The brand colours of a party logo, measured on the PNG itself (no dependency: the 8-bit RGBA / RGB non-interlaced PNG files of the database are decoded here).
// Used by scripts/check-party-identity.mjs to prove that the colours of src/data/party-brand.js are what the official logo shows, not an invention; run
// `node scripts/lib/logo-color.mjs <file.png>` to print them for a new logo.
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('Non è un PNG');
  let offset = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), name = buffer.toString('ascii', offset + 4, offset + 8), data = buffer.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (name === 'IDAT') chunks.push(data);
    else if (name === 'IEND') break;
    offset += 12 + length;
  }
  if (depth !== 8 || interlace !== 0 || ![2, 6].includes(type)) throw new Error(`PNG non supportato (profondità ${depth}, tipo ${type}, interlacciato ${interlace})`);
  const channels = type === 6 ? 4 : 3, stride = width * channels;
  const raw = inflateSync(Buffer.concat(chunks));
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? out[y * stride + x - channels] : 0;
      const up = y ? out[(y - 1) * stride + x] : 0;
      const upLeft = y && x >= channels ? out[(y - 1) * stride + x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) { const p = left + up - upLeft, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft); value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft; }
      out[y * stride + x] = value & 255;
    }
  }
  const pixels = [];
  for (let i = 0; i < width * height; i++) pixels.push([out[i * channels], out[i * channels + 1], out[i * channels + 2], channels === 4 ? out[i * channels + 3] : 255]);
  return { width, height, pixels };
}

const hex = ([r, g, b]) => `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
function hslOf([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { h, s, l };
}

// The chromatic colours of a logo (opaque pixels, saturation of at least 0.45, neither almost black nor almost white), grouped by hue sector of 30° and ranked by how many
// pixels they cover: [{ color: '#rrggbb' (mean of the sector), share (of the chromatic pixels), hue }]. The first is the dominant one; a second family is the next sector
// at least 60° away from it.
export function logoColors(png) {
  const sectors = new Map();
  let total = 0;
  for (const pixel of png.pixels) {
    if (pixel[3] < 200) continue;
    const { h, s, l } = hslOf(pixel);
    if (s < 0.45 || l < 0.08 || l > 0.92) continue;
    const key = Math.floor(h / 30) % 12;
    const entry = sectors.get(key) ?? { count: 0, r: 0, g: 0, b: 0, hue: 0 };
    entry.count++; entry.r += pixel[0]; entry.g += pixel[1]; entry.b += pixel[2]; entry.hue += h;
    sectors.set(key, entry);
    total++;
  }
  return [...sectors.entries()].sort((a, b) => b[1].count - a[1].count || a[0] - b[0]).map(([, entry]) => ({ color: hex([entry.r / entry.count, entry.g / entry.count, entry.b / entry.count]), share: entry.count / (total || 1), hue: entry.hue / entry.count }));
}
export function brandOfLogo(png) {
  const colors = logoColors(png);
  const primary = colors[0] ?? null;
  const distance = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  const secondary = primary ? colors.slice(1).find(item => distance(item.hue, primary.hue) >= 60 && item.share >= 0.01) ?? null : null;
  return { primary: primary?.color ?? null, secondary: secondary?.color ?? null, primaryShare: primary?.share ?? 0, secondaryShare: secondary?.share ?? 0 };
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2]) {
  const png = decodePng(await readFile(process.argv[2]));
  console.log(JSON.stringify(brandOfLogo(png), null, 1));
  console.log(logoColors(png).slice(0, 6).map(item => `${item.color} ${(item.share * 100).toFixed(1)}% (${Math.round(item.hue)}°)`).join('\n'));
}
