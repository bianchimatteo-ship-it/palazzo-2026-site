// The logo editor: crop frame over the original image (drag to pan, sliders for zoom and ratio), transparency of a
// flat background, previews on light, dark and transparent backgrounds, the dominant colour. Markup is a string like
// every other view; drawing happens on canvases after each render (drawLogoEditor).
import { backgroundColor, cropRect, dominantColor, editorMetadata, frameAspect, knockOut, LOGO_EDITOR_LIMITS, outputSize, placement, untouched } from '../core/logo-editor.js?v=20260926-7';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const range = (key, label, min, max, step, value, disabled = false, hint = '') => `<label class="le-field"><span>${esc(label)} <b data-logo-value="${key}">${esc(value)}</b></span><input type="range" data-logo-edit="${key}" min="${min}" max="${max}" step="${step}" value="${esc(value)}" ${disabled ? 'disabled' : ''} />${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;

export function renderLogoEditor(editor, { context = 'admin' } = {}) {
  if (!editor) return '';
  const [zMin, zMax] = LOGO_EDITOR_LIMITS.zoom;
  const [aMin, aMax] = LOGO_EDITOR_LIMITS.aspect;
  const [tMin, tMax] = LOGO_EDITOR_LIMITS.tolerance;
  return `<section class="logo-editor" data-logo-editor aria-label="Editor del logo">
    <header><strong>Ritaglia e sistema il logo</strong><small>${esc(editor.name)} · ${editor.width}×${editor.height} px · ${esc(editor.type.replace('image/', '').toUpperCase())}</small></header>
    <div class="le-layout">
      <div class="le-stage-wrap"><canvas class="le-stage" data-logo-stage width="360" height="240" aria-label="Immagine originale con la cornice di ritaglio"></canvas><small>Trascina l’immagine per spostarla dentro la cornice. Zoom sotto 1 lascia margini trasparenti invece di tagliare il logo.</small></div>
      <div class="le-controls">
        <div class="le-ratio" role="radiogroup" aria-label="Proporzione">${[['libera', 'Proporzione libera'], ['quadrata', 'Quadrata']].map(([id, label]) => `<label class="${editor.ratio === id ? 'active' : ''}"><input type="radio" name="logo-ratio" data-logo-edit="ratio" value="${id}" ${editor.ratio === id ? 'checked' : ''} />${label}</label>`).join('')}</div>
        ${range('aspect', 'Larghezza/altezza', aMin, aMax, 0.01, editor.ratio === 'quadrata' ? 1 : editor.aspect, editor.ratio === 'quadrata', 'Solo con proporzione libera')}
        ${range('zoom', 'Zoom', zMin, zMax, 0.01, editor.zoom)}
        ${range('panX', 'Sposta in orizzontale', -1, 1, 0.01, editor.panX)}
        ${range('panY', 'Sposta in verticale', -1, 1, 0.01, editor.panY)}
        <label class="le-check"><input type="checkbox" data-logo-edit="transparent" ${editor.transparent ? 'checked' : ''} /><span>Rendi trasparente lo sfondo uniforme</span></label>
        ${range('tolerance', 'Tolleranza dello sfondo', tMin, tMax, 1, editor.tolerance, !editor.transparent)}
        <button type="button" class="text-link" data-logo-edit-reset>Ripristina l’originale</button>
      </div>
      <div class="le-preview"><span class="section-kicker">ANTEPRIMA</span><div class="le-tiles"><span class="le-tile is-light"><canvas data-logo-result width="120" height="120"></canvas></span><span class="le-tile is-dark"><canvas data-logo-result-copy width="120" height="120"></canvas></span><span class="le-tile is-check"><canvas data-logo-result-copy width="120" height="120"></canvas></span></div>
        <div class="le-color"><i data-logo-dominant-swatch></i><span>Colore dominante <b data-logo-dominant>—</b></span><button type="button" class="secondary-button" data-logo-edit-color>${context === 'wizard' ? 'Usa come colore del partito' : 'Imposta come colore del partito'}</button></div>
        <small class="le-note">Il logo non viene mai forzato in un cerchio: resta nella sua forma, dentro una cornice ${editor.ratio === 'quadrata' ? 'quadrata' : 'con la proporzione scelta'}.</small>
      </div>
    </div>
  </section>`;
}

// Draws the image on a canvas with the editor's crop (and transparency); returns the pixels' dominant colour.
function renderInto(canvas, editor, image, max) {
  const rect = cropRect({ width: editor.width, height: editor.height, aspect: frameAspect(editor), zoom: editor.zoom, panX: editor.panX, panY: editor.panY });
  const size = outputSize(rect, max);
  canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, size.width, size.height);
  const place = placement(editor, size);
  context.drawImage(image, place.dx, place.dy, place.dw, place.dh);
  let cleared = 0;
  const pixels = context.getImageData(0, 0, size.width, size.height);
  if (editor.transparent) {
    cleared = knockOut(pixels.data, editor.background ?? null, editor.tolerance);
    context.putImageData(pixels, 0, 0);
  }
  return { dominant: dominantColor(pixels.data), cleared, size };
}

// The flat background of the original image (corner colour), measured once per image.
export function measureBackground(editor, image) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 200 / Math.max(editor.width, editor.height));
  canvas.width = Math.max(1, Math.round(editor.width * scale)); canvas.height = Math.max(1, Math.round(editor.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return backgroundColor(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}

export function drawLogoEditor(root, editor, image) {
  if (!editor || !image || !root?.querySelector) return null;
  const stage = root.querySelector('[data-logo-stage]');
  if (stage) {
    const box = { width: 360, height: 240 };
    const rect = cropRect({ width: editor.width, height: editor.height, aspect: frameAspect(editor), zoom: editor.zoom, panX: editor.panX, panY: editor.panY });
    // Image and frame together fit the stage (the frame is larger than the image when zooming below 1).
    const bounds = { left: Math.min(0, rect.sx), top: Math.min(0, rect.sy), right: Math.max(editor.width, rect.sx + rect.sw), bottom: Math.max(editor.height, rect.sy + rect.sh) };
    const scale = Math.min(box.width / (bounds.right - bounds.left), box.height / (bounds.bottom - bounds.top)) * 0.9;
    const offset = { x: (box.width - (bounds.right - bounds.left) * scale) / 2 - bounds.left * scale, y: (box.height - (bounds.bottom - bounds.top) * scale) / 2 - bounds.top * scale };
    const context = stage.getContext('2d');
    context.clearRect(0, 0, box.width, box.height);
    context.drawImage(image, offset.x, offset.y, editor.width * scale, editor.height * scale);
    const frame = { x: offset.x + rect.sx * scale, y: offset.y + rect.sy * scale, w: rect.sw * scale, h: rect.sh * scale };
    // Everything outside the frame is dimmed; the frame itself is outlined.
    context.fillStyle = 'rgba(8, 12, 11, 0.62)';
    context.beginPath(); context.rect(0, 0, box.width, box.height); context.rect(frame.x, frame.y, frame.w, frame.h); context.fill('evenodd');
    context.strokeStyle = '#e7c98f'; context.lineWidth = 2; context.setLineDash([6, 4]); context.strokeRect(frame.x, frame.y, frame.w, frame.h); context.setLineDash([]);
    stage.dataset.scale = String(scale);
  }
  const result = root.querySelector('[data-logo-result]');
  if (!result) return null;
  const outcome = renderInto(result, editor, image, 240);
  for (const copy of root.querySelectorAll('[data-logo-result-copy]')) { copy.width = result.width; copy.height = result.height; const context = copy.getContext('2d'); context.clearRect(0, 0, copy.width, copy.height); context.drawImage(result, 0, 0); }
  const hex = root.querySelector('[data-logo-dominant]');
  const swatch = root.querySelector('[data-logo-dominant-swatch]');
  if (hex) hex.textContent = outcome.dominant ?? '—';
  if (swatch) swatch.style.background = outcome.dominant ?? 'transparent';
  for (const key of ['zoom', 'panX', 'panY', 'aspect', 'tolerance']) { const label = root.querySelector(`[data-logo-value="${key}"]`); if (label) label.textContent = String(key === 'aspect' && editor.ratio === 'quadrata' ? 1 : editor[key]); }
  editor.dominant = outcome.dominant;
  return outcome;
}

// Dragging on the stage moves the frame over the image (pan values are relative to the free room on each side).
export function panFromDrag(editor, dx, dy, scale) {
  const rect = cropRect({ width: editor.width, height: editor.height, aspect: frameAspect(editor), zoom: editor.zoom, panX: 0, panY: 0 });
  const roomX = Math.abs(editor.width - rect.sw) / 2;
  const roomY = Math.abs(editor.height - rect.sh) / 2;
  const clamp = value => Math.max(-1, Math.min(1, Math.round(value * 100) / 100));
  return { panX: roomX ? clamp(editor.panX - dx / scale / roomX) : 0, panY: roomY ? clamp(editor.panY - dy / scale / roomY) : 0 };
}

// The final file: the original when nothing changed (an SVG stays vector), otherwise a PNG up to 512 px with the metadata.
export async function exportLogo(editor, image, original) {
  if (untouched(editor) && original) return { blob: original, editor: editorMetadata(editor, { dominant: editor.dominant ?? null }) };
  const canvas = document.createElement('canvas');
  const outcome = renderInto(canvas, editor, image, LOGO_EDITOR_LIMITS.output);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Impossibile creare l’immagine del logo.')), 'image/png'));
  return { blob, editor: editorMetadata(editor, { dominant: outcome.dominant, cleared: outcome.cleared }) };
}
