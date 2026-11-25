// «Crea l'avatar da una foto»: a photograph from the gallery or the camera becomes a portrait in the style of the game, made on the device (no server, no paid service, no AI service): it is
// decoded with its orientation, cropped and centred (zoom, position, drag), adjusted (light, contrast, colour) and turned into an illustration — the shapes smoothed, the colours reduced to a few
// flat tones graded on the palette of the game, the outlines inked — then re-encoded by the canvas (no metadata of the camera survives). The original photograph is never kept: only the portrait,
// on this device (core/photo-avatar-store.js). Loaded only when the editor is opened.
import { PHOTO_AVATAR_MAX } from '../core/photo-avatar-store.js?v=20261125-1';

export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const OUTPUT_SIZE = 256;
const WORK_SIZE = 168;
export const DEFAULT_SETTINGS = Object.freeze({ zoom: 1.2, x: 0, y: -0.08, brightness: 0, contrast: 12, saturation: -8, style: 3 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// The palette the tones are graded on: the night green, the gold, the warm ivory of the game (a slight pull, the face stays recognisable).
const GRADE = Object.freeze({ shadow: [16, 35, 27], light: [240, 235, 223], warm: [196, 166, 106] });

// The illustration, on RGBA pixels (pure: also used by the tests). `style` 1…5: 1 is close to the photo, 5 is a flat illustration with few tones and strong outlines.
export function stylizePixels(source, width, height, { brightness = 0, contrast = 0, saturation = 0, style = 3 } = {}) {
  const n = width * height;
  const out = new Uint8ClampedArray(source.length);
  const level = clamp(Math.round(style), 1, 5);
  // 1. light, contrast and colour
  const c = (259 * (clamp(contrast, -60, 60) + 255)) / (255 * (259 - clamp(contrast, -60, 60)));
  const sat = 1 + clamp(saturation, -60, 60) / 100;
  const adj = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let r = source[i * 4], g = source[i * 4 + 1], b = source[i * 4 + 2];
    r = c * (r - 128) + 128 + brightness; g = c * (g - 128) + 128 + brightness; b = c * (b - 128) + 128 + brightness;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    adj[i * 3] = l + (r - l) * sat; adj[i * 3 + 1] = l + (g - l) * sat; adj[i * 3 + 2] = l + (b - l) * sat;
  }
  // 2. smoothing (a box blur, wider for a stronger style): the skin and the background become shapes
  const radius = level >= 4 ? 2 : 1;
  const smooth = new Float32Array(n * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sr = 0, sg = 0, sb = 0, count = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const xx = clamp(x + dx, 0, width - 1), yy = clamp(y + dy, 0, height - 1), k = (yy * width + xx) * 3;
      sr += adj[k]; sg += adj[k + 1]; sb += adj[k + 2]; count++;
    }
    const k = (y * width + x) * 3; smooth[k] = sr / count; smooth[k + 1] = sg / count; smooth[k + 2] = sb / count;
  }
  // 3. the outlines: the gradient of the light (Sobel) where it is strong
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.299 * smooth[i * 3] + 0.587 * smooth[i * 3 + 1] + 0.114 * smooth[i * 3 + 2];
  const edge = new Float32Array(n);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const at = (dx, dy) => lum[(y + dy) * width + x + dx];
    const gx = -at(-1, -1) - 2 * at(-1, 0) - at(-1, 1) + at(1, -1) + 2 * at(1, 0) + at(1, 1);
    const gy = -at(-1, -1) - 2 * at(0, -1) - at(1, -1) + at(-1, 1) + 2 * at(0, 1) + at(1, 1);
    edge[y * width + x] = Math.hypot(gx, gy);
  }
  const threshold = [0, 260, 210, 170, 140, 115][level];
  // 4. a few flat tones, graded on the palette, and the ink of the outlines
  const steps = [0, 9, 7, 6, 5, 4][level];
  const q = value => Math.round(clamp(value, 0, 255) / 255 * (steps - 1)) / (steps - 1) * 255;
  const pull = 0.06 + level * 0.025;
  for (let i = 0; i < n; i++) {
    let r = q(smooth[i * 3]), g = q(smooth[i * 3 + 1]), b = q(smooth[i * 3 + 2]);
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const tone = l < 0.35 ? GRADE.shadow : l > 0.8 ? GRADE.light : GRADE.warm;
    r += (tone[0] - r) * pull; g += (tone[1] - g) * pull; b += (tone[2] - b) * pull;
    const ink = edge[i] > threshold ? clamp((edge[i] - threshold) / 140, 0, 0.85) : 0;
    out[i * 4] = r * (1 - ink) + 22 * ink; out[i * 4 + 1] = g * (1 - ink) + 26 * ink; out[i * 4 + 2] = b * (1 - ink) + 22 * ink; out[i * 4 + 3] = 255;
  }
  return out;
}

// The square of the photo that the portrait shows: zoom (1…3), position (-1…1 on each axis).
export function cropRect(width, height, { zoom = 1, x = 0, y = 0 } = {}) {
  const side = Math.min(width, height) / clamp(zoom, 1, 3);
  const cx = width / 2 + clamp(x, -1, 1) * (width - side) / 2, cy = height / 2 + clamp(y, -1, 1) * (height - side) / 2;
  return { sx: clamp(cx - side / 2, 0, width - side), sy: clamp(cy - side / 2, 0, height - side), side };
}

// The file → an image with its orientation applied (createImageBitmap reads the EXIF orientation; an <img> applies it too in the browsers of today).
export async function decodeImage(file) {
  if (!file) throw new Error('Nessun file scelto.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('La foto è troppo grande (massimo 15 MB).');
  if (file.type && !/^image\//.test(file.type)) throw new Error('Il file scelto non è un’immagine.');
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* the format the bitmap does not read: try an <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async'; img.src = url;
    await img.decode();
    return img;
  } catch { throw new Error('Formato non supportato: usa una foto JPEG, PNG o WebP.'); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}

// The portrait of a decoded image with the settings: a data URL (WebP when the browser writes it, else PNG), never the original.
export function renderPortrait(image, settings = DEFAULT_SETTINGS) {
  const width = image.width ?? image.naturalWidth, height = image.height ?? image.naturalHeight;
  const { sx, sy, side } = cropRect(width, height, settings);
  const work = document.createElement('canvas'); work.width = WORK_SIZE; work.height = WORK_SIZE;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(image, sx, sy, side, side, 0, 0, WORK_SIZE, WORK_SIZE);
  const data = wctx.getImageData(0, 0, WORK_SIZE, WORK_SIZE);
  data.data.set(stylizePixels(data.data, WORK_SIZE, WORK_SIZE, settings));
  wctx.putImageData(data, 0, 0);
  const outCanvas = document.createElement('canvas'); outCanvas.width = OUTPUT_SIZE; outCanvas.height = OUTPUT_SIZE;
  const octx = outCanvas.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(work, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  let url = outCanvas.toDataURL('image/webp', 0.86);
  if (!/^data:image\/webp/.test(url) || url.length > PHOTO_AVATAR_MAX) url = outCanvas.toDataURL('image/png');
  if (url.length > PHOTO_AVATAR_MAX) url = outCanvas.toDataURL('image/jpeg', 0.82);
  return url;
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const SLIDERS = Object.freeze([['zoom', 'Ingrandimento', 1, 3, 0.05], ['x', 'Posizione orizzontale', -1, 1, 0.02], ['y', 'Posizione verticale', -1, 1, 0.02], ['brightness', 'Luminosità', -60, 60, 1], ['contrast', 'Contrasto', -60, 60, 1], ['saturation', 'Colore', -60, 60, 1], ['style', 'Stile illustrato', 1, 5, 1]]);

// The editor over the page. Resolves with { image, settings } to save, { reset: true } to go back to the illustrated avatar, or null.
export function openPhotoAvatar({ current = null } = {}) {
  document.querySelector('.photo-avatar')?.remove();
  const root = document.createElement('div');
  root.className = 'photo-avatar';
  const opener = document.activeElement;
  const ui = { image: null, settings: { ...DEFAULT_SETTINGS }, error: '', portrait: current?.image ?? null };
  root.innerHTML = `<div class="pa-panel" role="dialog" aria-modal="true" aria-labelledby="pa-title">
    <header class="pa-head"><small>AVATAR PERSONALIZZATO</small><h2 id="pa-title">Il tuo avatar da una foto</h2><button type="button" class="pa-close" data-pa-close aria-label="Chiudi">×</button></header>
    <p class="pa-privacy">La foto viene trasformata qui, sul dispositivo: non viene inviata a nessun server e non viene conservata. Resta solo il ritratto illustrato, salvato su questo dispositivo e mai nei salvataggi online.</p>
    <div class="pa-sources"><label class="secondary-button pa-pick">Scegli dalla galleria<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*" data-pa-file hidden /></label><label class="secondary-button pa-pick">Scatta una foto<input type="file" accept="image/*" capture="user" data-pa-file hidden /></label></div>
    <div class="pa-stage"><canvas class="pa-preview" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}" data-pa-preview aria-label="Anteprima dell’avatar"></canvas><p class="pa-empty" data-pa-empty>${current ? 'Il tuo avatar attuale: scegli una nuova foto per cambiarlo.' : 'Scegli una foto: un primo piano con il volto ben illuminato rende di più.'}</p></div>
    <p class="pa-error" role="alert" data-pa-error hidden></p>
    <div class="pa-controls" data-pa-controls hidden>${SLIDERS.map(([id, label, min, max, step]) => `<label class="pa-slider"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${ui.settings[id]}" data-pa-set="${id}" /></label>`).join('')}<button type="button" class="ghost-button" data-pa-defaults>Valori consigliati</button></div>
    <footer class="pa-actions">${current ? '<button type="button" class="secondary-button" data-pa-reset>Torna all’avatar illustrato</button>' : ''}<button type="button" class="secondary-button" data-pa-close>Annulla</button><button type="button" class="primary-button" data-pa-save disabled>Usa questo avatar</button></footer>
  </div>`;
  document.body.appendChild(root);
  const canvas = root.querySelector('[data-pa-preview]');
  const showError = text => { const box = root.querySelector('[data-pa-error]'); box.hidden = !text; box.textContent = text ?? ''; };
  const paint = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    if (!ui.portrait) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    img.src = ui.portrait;
  };
  let pending = 0;
  const redraw = () => { if (!ui.image) return; cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { try { ui.portrait = renderPortrait(ui.image, ui.settings); paint(); root.querySelector('[data-pa-save]').disabled = false; } catch (error) { showError(error.message); } }); };
  paint();
  return new Promise(resolve => {
    const close = value => { root.remove(); document.removeEventListener('keydown', onKey, true); try { opener?.focus?.({ preventScroll: true }); } catch { /* gone */ } resolve(value); };
    const onKey = event => { if (event.key === 'Escape') { event.stopPropagation(); close(null); } };
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('change', async event => {
      const input = event.target.closest('[data-pa-file]');
      if (!input?.files?.[0]) return;
      showError('');
      try {
        ui.image = await decodeImage(input.files[0]);
        input.value = '';   // the file is not kept: the input forgets it
        ui.settings = { ...DEFAULT_SETTINGS };
        for (const slider of root.querySelectorAll('[data-pa-set]')) slider.value = ui.settings[slider.dataset.paSet];
        root.querySelector('[data-pa-controls]').hidden = false;
        root.querySelector('[data-pa-empty]').hidden = true;
        redraw();
      } catch (error) { showError(error.message); }
    });
    root.addEventListener('input', event => { const slider = event.target.closest('[data-pa-set]'); if (!slider) return; ui.settings[slider.dataset.paSet] = Number(slider.value); redraw(); });
    // drag the photo inside the frame
    let drag = null;
    canvas.addEventListener('pointerdown', event => { if (!ui.image) return; drag = { x: event.clientX, y: event.clientY, sx: ui.settings.x, sy: ui.settings.y }; canvas.setPointerCapture?.(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (!drag) return;
      const size = canvas.getBoundingClientRect().width || OUTPUT_SIZE;
      ui.settings.x = clamp(drag.sx - (event.clientX - drag.x) / size * 2, -1, 1); ui.settings.y = clamp(drag.sy - (event.clientY - drag.y) / size * 2, -1, 1);
      for (const id of ['x', 'y']) { const slider = root.querySelector(`[data-pa-set="${id}"]`); if (slider) slider.value = ui.settings[id]; }
      redraw();
    });
    canvas.addEventListener('pointerup', () => { drag = null; });
    root.addEventListener('click', event => {
      if (event.target === root || event.target.closest('[data-pa-close]')) return close(null);
      if (event.target.closest('[data-pa-defaults]')) { ui.settings = { ...DEFAULT_SETTINGS }; for (const slider of root.querySelectorAll('[data-pa-set]')) slider.value = ui.settings[slider.dataset.paSet]; redraw(); return; }
      if (event.target.closest('[data-pa-reset]')) return close({ reset: true });
      if (event.target.closest('[data-pa-save]') && ui.portrait && ui.image) return close({ image: ui.portrait, settings: { ...ui.settings } });
    });
    root.querySelector('[data-pa-file]')?.closest('label')?.focus?.();
  });
}
export { esc as escapePhotoText };
