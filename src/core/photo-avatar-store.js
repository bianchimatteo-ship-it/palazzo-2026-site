// The avatar made from a photograph (ui/photo-avatar.js) is kept ON THIS DEVICE ONLY, apart from the save of the career: it never travels with the online saves (account-sync uploads the save,
// not this), and the original photograph is never kept anywhere — only the stylised portrait, re-encoded by the canvas (no metadata of the camera, no position, no date). One portrait per player of a career (the id of the politician record);
// «Torna all'avatar illustrato» deletes it; deleting the career or the data of the browser deletes it too.
export const PHOTO_AVATAR_KEY = 'politicando.photo-avatar.v1';
export const PHOTO_AVATAR_MAX = 260_000;   // characters of the data URL: a 256 px portrait in WebP/PNG stays far below
const read = storage => { try { const value = JSON.parse(storage?.getItem(PHOTO_AVATAR_KEY) ?? '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };
const write = (storage, value) => { try { storage?.setItem(PHOTO_AVATAR_KEY, JSON.stringify(value)); return true; } catch { return false; } };
export const validPortrait = image => typeof image === 'string' && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image) && image.length <= PHOTO_AVATAR_MAX;
export function photoAvatarOf(careerId, storage = globalThis.localStorage) {
  if (!careerId) return null;
  const entry = read(storage)[String(careerId)];
  return entry && validPortrait(entry.image) ? entry : null;
}
export function savePhotoAvatar(careerId, { image, settings = {} }, storage = globalThis.localStorage) {
  if (!careerId) throw new Error('Serve una carriera per salvare l’avatar.');
  if (!validPortrait(image)) throw new Error('L’immagine dell’avatar non è valida o è troppo grande.');
  const all = read(storage);
  all[String(careerId)] = { image, settings, createdAt: new Date().toISOString(), source: 'foto-elaborata-sul-dispositivo' };
  if (!write(storage, all)) throw new Error('Spazio del dispositivo esaurito: l’avatar non è stato salvato.');
  return all[String(careerId)];
}
export function removePhotoAvatar(careerId, storage = globalThis.localStorage) {
  const all = read(storage);
  delete all[String(careerId)];
  write(storage, all);
}
