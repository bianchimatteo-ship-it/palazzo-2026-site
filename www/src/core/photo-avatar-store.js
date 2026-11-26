// What the avatar made from a photograph (ui/photo-avatar.js) keeps, ON THIS DEVICE ONLY, to be edited again later: a reduced copy of the photo (at most 480 px, re-encoded by the canvas: no
// metadata of the camera, no position, no date), the framing chosen, what the reading found and which traits the player corrected. It never travels with the online saves (account-sync uploads
// the save, not this) and never goes into the save of the career: the career keeps only the illustrated avatar (its structured choices, core/avatar.js). The original file is never kept.
// One entry per player of a career (the id of the politician record); «Elimina la foto» deletes it; deleting the data of the browser deletes it too.
// v1 (until 24/11/2026) kept a filtered portrait instead (`image`): it is no longer shown; it is replaced by the next save.
export const PHOTO_AVATAR_KEY = 'politicando.photo-avatar.v1';
export const PHOTO_SOURCE_MAX = 240_000;   // characters of the data URL of the reduced photo (a 480 px JPEG stays far below)
const read = storage => { try { const value = JSON.parse(storage?.getItem(PHOTO_AVATAR_KEY) ?? '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };
const write = (storage, value) => { try { storage?.setItem(PHOTO_AVATAR_KEY, JSON.stringify(value)); return true; } catch { return false; } };
export const validPhoto = image => typeof image === 'string' && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image) && image.length <= PHOTO_SOURCE_MAX;
const cleanSettings = value => Object.fromEntries(['zoom', 'x', 'y', 'rotate'].filter(key => Number.isFinite(Number(value?.[key]))).map(key => [key, Number(value[key])]));
const cleanList = value => Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 20) : [];
// The entry of a player (with its reduced photo), or null (none, or an old v1 portrait).
export function photoAvatarOf(playerId, storage = globalThis.localStorage) {
  if (!playerId) return null;
  const entry = read(storage)[String(playerId)];
  return entry && validPhoto(entry.photo) ? entry : null;
}
export function savePhotoAvatar(playerId, { photo, settings = {}, readings = {}, manual = [] }, storage = globalThis.localStorage) {
  if (!playerId) throw new Error('Serve una carriera per conservare la foto dell’avatar.');
  if (!validPhoto(photo)) throw new Error('La foto ridotta non è valida o è troppo grande.');
  const all = read(storage);
  all[String(playerId)] = { photo, settings: cleanSettings(settings), readings: readings && typeof readings === 'object' ? JSON.parse(JSON.stringify(readings)) : {}, manual: cleanList(manual), updatedAt: new Date().toISOString(), source: 'foto-ridotta-sul-dispositivo' };
  if (!write(storage, all)) throw new Error('Spazio del dispositivo esaurito: la foto per le modifiche non è stata conservata (l’avatar è salvato).');
  return all[String(playerId)];
}
export function removePhotoAvatar(playerId, storage = globalThis.localStorage) {
  const all = read(storage);
  delete all[String(playerId)];
  write(storage, all);
}
