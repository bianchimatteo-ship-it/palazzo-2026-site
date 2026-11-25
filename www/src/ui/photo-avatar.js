// «Crea l'avatar da una foto»: a photograph from the gallery or the camera becomes an ILLUSTRATED character of the game — not a filtered photo. On the device (no server, no AI service): the
// file is decoded with its orientation (EXIF), reduced, framed by the player on a guide (zoom, drag, rotation), and the face inside the guide is read (ui/photo-traits.js): skin, hair colour and
// length, glasses, beard and moustache, width of the face. What it finds becomes the structured choices of the avatar (core/avatar.js AVATAR_OPTIONS), drawn by ui/avatar-svg.js like every
// avatar of the game; the player sees the drawing at once and corrects any trait (a trait corrected by hand is not overwritten by a new reading). The face follows the gender chosen for the
// character (never read from the photo). What is kept: the avatar (choices only, in the career) and, ON THIS DEVICE ONLY, a reduced copy of the photo with the framing and the corrections, to
// edit it again later (core/photo-avatar-store.js). Also the editor of an avatar already saved (the profile): it opens on the saved choices and on the kept photo, if any.
// Loaded only when the editor is opened.
import { AVATAR_GROUPS, AVATAR_LABELS, AVATAR_OPTIONS, avatarForGender, normalizeAvatar } from '../core/avatar.js?v=20261125-7';
import { avatarSvg } from './avatar-svg.js?v=20261125-7';
import { ANALYSIS_SIZE, CONFIDENCE_LABELS, GUIDE, READING_LABELS, analyzeFace } from './photo-traits.js?v=20261125-7';
import { PHOTO_SOURCE_MAX } from '../core/photo-avatar-store.js?v=20261125-7';

export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const MAX_PIXELS = 60_000_000;
export const WORK_SIDE = 1600;          // the photo is reduced to this before anything else (memory of a phone)
export const KEEP_SIDE = 480;           // the copy kept on the device for a later edit
export const VIEW_SIZE = 280;
export const DEFAULT_FRAME = Object.freeze({ zoom: 1.35, x: 0, y: -0.1, rotate: 0 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// The kind of a file from its first bytes (the type the picker gives may be empty or wrong, a HEIC from an iPhone often has none).
export function sniffPhoto(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const text = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && text(1, 4) === 'PNG') return 'png';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'webp';
  if (text(4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(text(8, 12))) return text(8, 12) === 'avif' ? 'avif' : 'heic';
  if (text(0, 3) === 'GIF') return 'gif';
  return null;
}

// The square of the (rotated) photo that the guide shows: zoom (1…4), position (-1…1 on each axis).
export function cropRect(width, height, { zoom = 1, x = 0, y = 0 } = {}) {
  const side = Math.min(width, height) / clamp(zoom, 1, 4);
  const cx = width / 2 + clamp(x, -1, 1) * (width - side) / 2, cy = height / 2 + clamp(y, -1, 1) * (height - side) / 2;
  return { sx: clamp(cx - side / 2, 0, width - side), sy: clamp(cy - side / 2, 0, height - side), side };
}

// The file → a canvas with the photo upright (EXIF orientation applied by the browser) and reduced to WORK_SIDE. Clear reasons for what cannot be read.
export async function decodePhoto(file) {
  if (!file) throw new Error('Nessun file scelto.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('La foto è troppo grande (massimo 25 MB): scegline una più leggera.');
  if (file.size < 64) throw new Error('Il file scelto è vuoto o danneggiato.');
  const kind = sniffPhoto(await file.slice(0, 16).arrayBuffer());
  if (!kind) throw new Error('Il file scelto non è una foto: usa JPEG, PNG, WebP o HEIC.');
  if (kind === 'gif') throw new Error('Le GIF non sono supportate: usa una foto JPEG, PNG, WebP o HEIC.');
  let image = null;
  if (typeof createImageBitmap === 'function') { try { image = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { image = null; } }
  if (!image) {
    const url = URL.createObjectURL(file);
    try { const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); image = img; }
    catch { throw new Error(kind === 'heic' ? 'Questo dispositivo non sa leggere le foto HEIC: scegli «Più compatibile» nelle impostazioni della fotocamera, o una foto JPEG.' : 'La foto non si può leggere: il file è danneggiato o in un formato non supportato.'); }
    finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  }
  const width = image.width ?? image.naturalWidth, height = image.height ?? image.naturalHeight;
  if (!width || !height) throw new Error('La foto non ha dimensioni valide.');
  if (width * height > MAX_PIXELS) throw new Error('La foto ha troppi pixel per questo dispositivo: scegline una più piccola.');
  const scale = Math.min(1, WORK_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  return canvas;
}
// A quarter turn (for a photo that comes in sideways despite its orientation).
function rotated(canvas, quarter) {
  const turns = ((quarter % 4) + 4) % 4; if (!turns) return canvas;
  const out = document.createElement('canvas'); out.width = turns % 2 ? canvas.height : canvas.width; out.height = turns % 2 ? canvas.width : canvas.height;
  const ctx = out.getContext('2d'); ctx.translate(out.width / 2, out.height / 2); ctx.rotate(turns * Math.PI / 2); ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}
// The framed square into a canvas of `side` px.
function framed(photo, frame, side) {
  const { sx, sy, side: s } = cropRect(photo.width, photo.height, frame);
  const out = document.createElement('canvas'); out.width = side; out.height = side;
  const ctx = out.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(photo, sx, sy, s, s, 0, 0, side, side);
  return out;
}
// The copy kept for a later edit: the upright photo reduced to KEEP_SIDE, JPEG (no metadata survives the canvas).
function keepCopy(photo) {
  const scale = Math.min(1, KEEP_SIDE / Math.max(photo.width, photo.height));
  const out = document.createElement('canvas'); out.width = Math.round(photo.width * scale); out.height = Math.round(photo.height * scale);
  out.getContext('2d').drawImage(photo, 0, 0, out.width, out.height);
  for (const quality of [0.82, 0.7, 0.55]) { const url = out.toDataURL('image/jpeg', quality); if (url.length <= PHOTO_SOURCE_MAX) return { url, scale }; }
  return { url: null, scale };
}
async function canvasOf(dataUrl) { const img = new Image(); img.src = dataUrl; await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return c; }

// The avatar from a reading: the traits the photo showed, over the avatar the player already has (what the photo does not show stays as it was), the corrections of the player kept.
export function avatarFromReading(base, reading, { gender = null, manual = new Set(), corrections = {} } = {}) {
  const out = { ...normalizeAvatar(base) };
  for (const [field, value] of Object.entries(reading?.traits ?? {})) if (field !== 'shape' && !manual.has(field)) out[field] = value;
  if (reading?.traits?.shape && !manual.has('shape')) out.shape = { ...(out.shape ?? {}), ...reading.traits.shape };
  Object.assign(out, corrections);
  return avatarForGender(normalizeAvatar(out), gender);
}

const FIELDS = AVATAR_GROUPS.filter(field => field !== 'face');
// The editor over the page. `avatar`: the avatar the character has now; `gender`: the one of the character; `source`: what this device keeps from a previous photo (or null).
// Resolves with { avatar, source } (source: the reduced photo and its framing, to keep on the device; null when no photo was used), { avatar, removeSource: true }, or null (cancelled).
export function openPhotoAvatar({ avatar = null, gender = null, source = null } = {}) {
  document.querySelector('.photo-avatar')?.remove();
  const root = document.createElement('div');
  root.className = 'photo-avatar';
  const opener = document.activeElement;
  const ui = { photo: null, frame: { ...DEFAULT_FRAME, ...(source?.settings ?? {}) }, reading: null, manual: new Set(source?.manual ?? []), avatar: avatarForGender(normalizeAvatar(avatar), gender), keep: source?.photo ?? null, dropped: false, busy: false };
  const masculine = ui.avatar.face === 'maschile';
  const genderNote = gender ? `Volto ${masculine ? 'maschile' : 'femminile'}: segue il genere scelto per il personaggio` : `Volto ${masculine ? 'maschile' : 'femminile'}`;
  const selects = FIELDS.map(field => {
    const locked = !masculine && (field === 'beard' || field === 'moustache');
    return `<label class="pa-trait" data-pa-trait-box="${field}"><span>${esc(AVATAR_LABELS[field])} <i data-pa-reading="${field}"></i></span><select data-pa-trait="${field}" ${locked ? 'disabled' : ''}>${AVATAR_OPTIONS[field].map(item => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('')}</select></label>`;
  }).join('');
  root.innerHTML = `<div class="pa-panel" role="dialog" aria-modal="true" aria-labelledby="pa-title">
    <header class="pa-head"><small>AVATAR · DA UNA FOTO</small><h2 id="pa-title">Il tuo personaggio illustrato</h2><button type="button" class="pa-close" data-pa-close aria-label="Chiudi">×</button></header>
    <p class="pa-privacy">La foto si legge qui, sul dispositivo: nessun invio a server o servizi esterni. Il gioco ne ricava i tratti dell’avatar illustrato (capelli, occhiali, barba, carnagione); una copia ridotta resta solo su questo dispositivo per poterlo modificare, mai nei salvataggi online.</p>
    <div class="pa-sources"><label class="secondary-button pa-pick">Scegli dalla galleria<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" data-pa-file hidden /></label><label class="secondary-button pa-pick">Scatta una foto<input type="file" accept="image/*" capture="user" data-pa-file hidden /></label></div>
    <p class="pa-error" role="alert" data-pa-error hidden></p>
    <div class="pa-grid">
      <div class="pa-stage" data-pa-stage>
        <div class="pa-frame"><canvas class="pa-view" width="${VIEW_SIZE}" height="${VIEW_SIZE}" data-pa-view aria-label="La foto inquadrata: trascina per spostarla"></canvas><svg class="pa-guide" viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="pa-mask"><rect width="100" height="100" fill="#fff"/><ellipse cx="${GUIDE.cx * 100}" cy="${GUIDE.cy * 100}" rx="${GUIDE.rx * 100}" ry="${GUIDE.ry * 100}" fill="#000"/></mask></defs><rect width="100" height="100" fill="rgba(8,12,10,.45)" mask="url(#pa-mask)"/><ellipse cx="${GUIDE.cx * 100}" cy="${GUIDE.cy * 100}" rx="${GUIDE.rx * 100}" ry="${GUIDE.ry * 100}" fill="none" stroke="#f0cf85" stroke-width=".8" stroke-dasharray="2 1.6"/></svg><p class="pa-empty" data-pa-empty>${source?.photo ? 'Caricamento della foto conservata…' : 'Scegli una foto: un primo piano, il volto dritto e ben illuminato.'}</p></div>
        <div class="pa-frame-tools" data-pa-tools hidden><small>Metti il volto dentro l’ovale: mento sul bordo basso, capelli sopra.</small><label class="pa-slider"><span>Ingrandimento</span><input type="range" min="1" max="4" step="0.02" value="${ui.frame.zoom}" data-pa-zoom /></label><div class="pa-row"><button type="button" class="ghost-button" data-pa-rotate>Ruota di 90°</button><button type="button" class="ghost-button" data-pa-refit>Riprova il riconoscimento</button></div></div>
      </div>
      <div class="pa-result">
        <div class="pa-avatar" data-pa-avatar>${avatarSvg(ui.avatar, { size: 168, label: 'Anteprima del tuo avatar illustrato' })}</div>
        <div class="pa-reading-summary" data-pa-summary>${source?.photo ? '' : 'Senza foto puoi comunque scegliere ogni tratto qui sotto.'}</div>
        <p class="pa-gender">${esc(genderNote)}</p>
        <div class="pa-traits">${selects}</div>
      </div>
    </div>
    <footer class="pa-actions">${source?.photo ? '<button type="button" class="ghost-button" data-pa-drop>Elimina la foto dal dispositivo</button>' : ''}<button type="button" class="secondary-button" data-pa-close>Annulla</button><button type="button" class="primary-button" data-pa-save>Usa questo avatar</button></footer>
  </div>`;
  document.body.appendChild(root);
  const view = root.querySelector('[data-pa-view]');
  const showError = text => { const box = root.querySelector('[data-pa-error]'); box.hidden = !text; box.textContent = text ?? ''; };
  const syncSelects = () => { for (const select of root.querySelectorAll('[data-pa-trait]')) select.value = ui.avatar[select.dataset.paTrait]; };
  const paintAvatar = () => { root.querySelector('[data-pa-avatar]').innerHTML = avatarSvg(ui.avatar, { size: 168, label: 'Anteprima del tuo avatar illustrato' }); syncSelects(); };
  const paintReading = () => {
    const readings = ui.reading?.readings ?? {};
    for (const field of FIELDS) {
      const mark = root.querySelector(`[data-pa-reading="${field}"]`); if (!mark) continue;
      const r = readings[field];
      mark.textContent = ui.manual.has(field) ? '· scelto da te' : r ? `· ${CONFIDENCE_LABELS[r.confidence] ?? ''}` : '';
      mark.className = ui.manual.has(field) ? 'is-manual' : r ? `is-${r.confidence}` : '';
      root.querySelector(`[data-pa-trait-box="${field}"]`)?.classList.toggle('is-read', Boolean(r) && r.confidence !== 'non-visibile' && !ui.manual.has(field));
    }
    // what the photo showed, each piece a text of its own (a label and an option of the avatar: both in the phrase-book)
    const found = Object.entries(READING_LABELS).map(([field, label]) => { const r = readings[field]; if (!r || r.confidence === 'non-visibile' || r.value == null) return null; const option = AVATAR_OPTIONS[field].find(item => item.id === r.value); return option ? `<li><b>${esc(label)}</b> <span>${esc(option.label)}</span></li>` : null; }).filter(Boolean);
    const missing = Object.entries(READING_LABELS).filter(([field]) => readings[field]?.confidence === 'non-visibile').map(([, label]) => `<li class="is-missing"><b>${esc(label)}</b> <span>non visibile</span></li>`);
    const box = root.querySelector('[data-pa-summary]');
    box.innerHTML = ui.reading ? `<span>${found.length ? 'Dalla foto:' : 'Dalla foto non si leggono tratti certi.'}</span>${found.length || missing.length ? `<ul class="pa-found">${found.join('')}${missing.join('')}</ul>` : ''}<span>Correggi qui sotto ciò che non torna.</span>` : '';
  };
  let pending = 0;
  const refresh = (read = true) => {
    if (!ui.photo) return;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      try {
        const shown = framed(ui.photo, ui.frame, VIEW_SIZE);
        const ctx = view.getContext('2d'); ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE); ctx.drawImage(shown, 0, 0);
        if (read) {
          const small = framed(ui.photo, ui.frame, ANALYSIS_SIZE);
          const data = small.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE).data;
          ui.reading = analyzeFace(data, ANALYSIS_SIZE, { masculine });
          const corrections = Object.fromEntries([...ui.manual].filter(field => field !== 'shape').map(field => [field, ui.avatar[field]]));
          ui.avatar = avatarFromReading(ui.avatar, ui.reading, { gender, manual: ui.manual, corrections });
          paintAvatar(); paintReading();
          root.dataset.paRead = String(Date.now());
        }
      } catch (error) { showError(error.message); }
    });
  };
  const setPhoto = canvas => {
    ui.photo = canvas; ui.dropped = false;
    root.querySelector('[data-pa-empty]').hidden = true; root.querySelector('[data-pa-tools]').hidden = false;
    root.querySelector('[data-pa-zoom]').value = ui.frame.zoom;
    refresh(true);
  };
  syncSelects();
  if (source?.photo) canvasOf(source.photo).then(canvas => { if (!root.isConnected) return; ui.keepScale = 1; setPhoto(canvas); }).catch(() => { root.querySelector('[data-pa-empty]').textContent = 'La foto conservata non si legge più: scegline un’altra.'; });
  return new Promise(resolve => {
    const close = value => { cancelAnimationFrame(pending); root.remove(); document.removeEventListener('keydown', onKey, true); try { opener?.focus?.({ preventScroll: true }); } catch { /* gone */ } resolve(value); };
    const onKey = event => { if (event.key === 'Escape') { event.stopPropagation(); close(null); } };
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('change', async event => {
      const trait = event.target.closest('[data-pa-trait]');
      if (trait) { ui.manual.add(trait.dataset.paTrait); ui.avatar = avatarForGender(normalizeAvatar({ ...ui.avatar, [trait.dataset.paTrait]: trait.value }), gender); paintAvatar(); paintReading(); return; }
      const input = event.target.closest('[data-pa-file]');
      if (!input) return;
      const file = input.files?.[0];
      input.value = '';   // the input forgets the file (also when the picker is cancelled: nothing happens)
      if (!file) return;
      showError(''); root.classList.add('is-busy');
      try { const canvas = await decodePhoto(file); ui.frame = { ...DEFAULT_FRAME }; ui.manual = new Set([...ui.manual].filter(field => !['skin', 'hair', 'hairstyle', 'glasses', 'beard', 'moustache', 'shape'].includes(field))); setPhoto(canvas); }
      catch (error) { showError(error.message); }
      finally { root.classList.remove('is-busy'); }
    });
    root.addEventListener('input', event => { if (event.target.closest('[data-pa-zoom]')) { ui.frame.zoom = Number(event.target.value); refresh(true); } });
    // drag the photo inside the guide
    let drag = null;
    view.addEventListener('pointerdown', event => { if (!ui.photo) return; drag = { x: event.clientX, y: event.clientY, sx: ui.frame.x, sy: ui.frame.y }; view.setPointerCapture?.(event.pointerId); });
    view.addEventListener('pointermove', event => {
      if (!drag) return;
      const size = view.getBoundingClientRect().width || VIEW_SIZE;
      ui.frame.x = clamp(drag.sx - (event.clientX - drag.x) / size * 2, -1, 1); ui.frame.y = clamp(drag.sy - (event.clientY - drag.y) / size * 2, -1, 1);
      refresh(false);
    });
    const endDrag = () => { if (drag) { drag = null; refresh(true); } };
    view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag);
    root.addEventListener('click', event => {
      if (event.target === root || event.target.closest('[data-pa-close]')) return close(null);
      if (event.target.closest('[data-pa-rotate]') && ui.photo) { ui.photo = rotated(ui.photo, 1); ui.frame.rotate = ((ui.frame.rotate ?? 0) + 1) % 4; refresh(true); return; }
      if (event.target.closest('[data-pa-refit]') && ui.photo) { ui.manual = new Set(); refresh(true); return; }
      if (event.target.closest('[data-pa-drop]')) { ui.dropped = true; ui.photo = null; ui.reading = null; const ctx = view.getContext('2d'); ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE); root.querySelector('[data-pa-empty]').hidden = false; root.querySelector('[data-pa-empty]').textContent = 'Foto eliminata: l’avatar resta con i tratti scelti.'; root.querySelector('[data-pa-tools]').hidden = true; event.target.closest('[data-pa-drop]').remove(); paintReading(); return; }
      if (event.target.closest('[data-pa-save]')) {
        const avatarOut = avatarForGender(normalizeAvatar(ui.avatar), gender);
        if (ui.photo) {
          const kept = keepCopy(ui.photo);
          const readings = Object.fromEntries(Object.entries(ui.reading?.readings ?? {}).map(([field, r]) => [field, { value: r.value, confidence: r.confidence }]));
          return close({ avatar: avatarOut, source: kept.url ? { photo: kept.url, settings: { zoom: ui.frame.zoom, x: ui.frame.x, y: ui.frame.y, rotate: 0 }, readings, manual: [...ui.manual] } : null });
        }
        return close(ui.dropped ? { avatar: avatarOut, removeSource: true } : { avatar: avatarOut, source: null });
      }
    });
    root.querySelector('[data-pa-file]')?.closest('label')?.focus?.();
  });
}
export { esc as escapePhotoText };
