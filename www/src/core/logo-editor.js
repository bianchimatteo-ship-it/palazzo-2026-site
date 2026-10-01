// The logo editor's arithmetic, without the browser: the crop frame (free or square ratio, zoom and pan, zoom below 1
// leaves transparent margins instead of cutting the logo), the knock-out of a flat background into transparency and
// the dominant colour of the result. The interface draws with a canvas; everything decided here is testable.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const LOGO_EDITOR_LIMITS = Object.freeze({ zoom: [0.5, 4], aspect: [0.4, 2.5], tolerance: [4, 80], output: 512 });

export function createEditorState({ width, height, name = 'logo', type = 'image/png' }) {
  const aspect = clamp(width / Math.max(1, height), ...LOGO_EDITOR_LIMITS.aspect);
  return { width, height, name, type, ratio: 'libera', aspect: Math.round(aspect * 100) / 100, naturalAspect: Math.round(aspect * 100) / 100, zoom: 1, panX: 0, panY: 0, transparent: false, tolerance: 18 };
}
export const frameAspect = editor => editor.ratio === 'quadrata' ? 1 : clamp(Number(editor.aspect) || 1, ...LOGO_EDITOR_LIMITS.aspect);

// The part of the image inside the frame, in image pixels (it can exceed the image: the rest is transparent margin).
export function cropRect({ width, height, aspect = 1, zoom = 1, panX = 0, panY = 0 }) {
  const z = clamp(Number(zoom) || 1, ...LOGO_EDITOR_LIMITS.zoom);
  let sw = width;
  let sh = width / aspect;
  if (sh > height) { sh = height; sw = height * aspect; }
  sw /= z; sh /= z;
  const maxX = Math.abs(width - sw) / 2;
  const maxY = Math.abs(height - sh) / 2;
  const cx = width / 2 + clamp(Number(panX) || 0, -1, 1) * maxX;
  const cy = height / 2 + clamp(Number(panY) || 0, -1, 1) * maxY;
  return { sx: Math.round((cx - sw / 2) * 100) / 100, sy: Math.round((cy - sh / 2) * 100) / 100, sw: Math.round(sw * 100) / 100, sh: Math.round(sh * 100) / 100 };
}
// Output size: the longest side up to 512 px (never below 64), with the frame's ratio.
export function outputSize(rect, max = LOGO_EDITOR_LIMITS.output) {
  const longest = Math.max(64, Math.min(max, Math.max(rect.sw, rect.sh)));
  return rect.sw >= rect.sh ? { width: Math.round(longest), height: Math.max(1, Math.round(longest * rect.sh / rect.sw)) } : { width: Math.max(1, Math.round(longest * rect.sw / rect.sh)), height: Math.round(longest) };
}
// Where the whole image lands on the output canvas (drawImage destination).
export function placement(editor, output) {
  const rect = cropRect({ width: editor.width, height: editor.height, aspect: frameAspect(editor), zoom: editor.zoom, panX: editor.panX, panY: editor.panY });
  const scale = output.width / rect.sw;
  return { dx: -rect.sx * scale, dy: -rect.sy * scale, dw: editor.width * scale, dh: editor.height * scale, rect };
}
// Nothing changed: the original file (for instance an SVG) can be kept as it is.
export const untouched = editor => editor.zoom === 1 && editor.panX === 0 && editor.panY === 0 && !editor.transparent && (editor.ratio === 'libera' && Math.abs(editor.aspect - editor.naturalAspect) < 0.01);

// The colour of a flat background: the average of the four corners of the image (only opaque pixels).
export function backgroundColor(data, width, height) {
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const opaque = corners.map(([x, y]) => (y * width + x) * 4).filter(index => data[index + 3] > 200);
  if (!opaque.length) return null;
  return [0, 1, 2].map(channel => Math.round(opaque.reduce((sum, index) => sum + data[index + channel], 0) / opaque.length));
}
// Pixels close to the background colour become transparent (a soft edge avoids jagged contours). Mutates `data`.
export function knockOut(data, reference, tolerance = 18) {
  if (!reference) return 0;
  const hard = tolerance * 2.2;
  const soft = hard * 1.6;
  let cleared = 0;
  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.hypot(data[index] - reference[0], data[index + 1] - reference[1], data[index + 2] - reference[2]);
    if (distance <= hard) { data[index + 3] = 0; cleared++; }
    else if (distance < soft) data[index + 3] = Math.round(data[index + 3] * (distance - hard) / (soft - hard));
  }
  return cleared;
}
// The dominant colour: the most present saturated hue (transparent, near-white and near-black pixels are ignored,
// greys count only when nothing else is there).
export function dominantColor(data) {
  const buckets = new Map();
  const add = (key, r, g, b, weight) => { const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, w: 0 }; bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++; bucket.w += weight; buckets.set(key, bucket); };
  let greys = null;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 128) continue;
    const [r, g, b] = [data[index], data[index + 1], data[index + 2]];
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    if (max > 238 && min > 238) continue;
    if (max < 22) continue;
    const saturation = max ? (max - min) / max : 0;
    if (saturation < 0.18) { greys = greys ?? { r: 0, g: 0, b: 0, n: 0 }; greys.r += r; greys.g += g; greys.b += b; greys.n++; continue; }
    add(`${r >> 4}|${g >> 4}|${b >> 4}`, r, g, b, 0.4 + saturation);
  }
  const best = [...buckets.values()].sort((a, b) => b.w - a.w)[0] ?? (greys?.n ? { ...greys } : null);
  if (!best) return null;
  return `#${[best.r, best.g, best.b].map(value => Math.round(value / best.n).toString(16).padStart(2, '0')).join('')}`;
}
// What is kept with the logo: the choices of the editor and the original file (source and verification are kept apart).
export function editorMetadata(editor, { dominant = null, cleared = 0 } = {}) {
  const rect = cropRect({ width: editor.width, height: editor.height, aspect: frameAspect(editor), zoom: editor.zoom, panX: editor.panX, panY: editor.panY });
  return { ratio: editor.ratio, aspect: frameAspect(editor), zoom: editor.zoom, panX: editor.panX, panY: editor.panY, crop: rect, transparent: editor.transparent, tolerance: editor.transparent ? editor.tolerance : null, clearedPixels: cleared, dominantColor: dominant, original: { name: editor.name, type: editor.type, width: editor.width, height: editor.height }, editedAt: new Date().toISOString() };
}
