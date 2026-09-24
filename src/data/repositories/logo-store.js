const DATABASE_NAME = 'politicando-local-admin';
const STORE_NAME = 'party-logos';
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const allowedSvgTags = new Set(['svg','g','path','rect','circle','ellipse','polygon','polyline','line','defs','clipPath','mask','linearGradient','radialGradient','stop','title','desc']);
const allowedSvgAttributes = new Set(['xmlns','viewBox','width','height','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','transform','cx','cy','r','rx','ry','x','y','x1','x2','y1','y2','d','points','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','clip-path','mask']);
const memory = new Map();
let databasePromise;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'partyId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Archivio locale non disponibile.'));
  }).catch(() => null);
  return databasePromise;
}

async function withStore(mode, callback) {
  const database = await openDatabase();
  if (!database) return callback(null);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    try { result = callback(store); } catch (error) { reject(error); return; }
    if (!result || typeof result !== 'object' || !('onsuccess' in result)) { resolve(result); return; }
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error || new Error('Operazione loghi non riuscita.'));
  });
}

export async function listLocalLogos() {
  const database = await openDatabase();
  if (!database) return [...memory.values()].map(({ blob, ...record }) => record);
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.map(({ blob, ...record }) => record));
    request.onerror = () => reject(request.error || new Error('Impossibile leggere i loghi locali.'));
  });
}

export async function getLocalLogo(partyId) {
  const database = await openDatabase();
  if (!database) return memory.get(partyId) ?? null;
  return withStore('readonly', store => store ? store.get(partyId) : null);
}

// A logo added by the user or the owner: a file kept in the browser, or the address of an image
// that cannot be copied (the site does not allow it). Always origin 'user', never mixed with verified logos.
export async function saveLocalLogo(partyId, logo) {
  const remote = !(logo?.blob instanceof Blob) && isImageAddress(logo?.url);
  if (!partyId || (!(logo?.blob instanceof Blob) && !remote)) throw new Error('Partito o file logo non valido.');
  const record = { partyId, ...(remote ? { url: String(logo.url).trim(), mimeType: null } : { blob: logo.blob, mimeType: logo.blob.type }), fileName: logo.fileName || 'logo', origin: 'user', sourceUrl: logo.sourceUrl ? String(logo.sourceUrl).trim() : null, source: String(logo.source || '').trim(), verified: Boolean(logo.verified), alt: String(logo.alt || '').trim(), updatedAt: new Date().toISOString() };
  const database = await openDatabase();
  if (!database) memory.set(partyId, record);
  else await withStore('readwrite', store => store.put(record));
  return record;
}

export async function deleteLocalLogo(partyId) {
  const database = await openDatabase();
  if (!database) memory.delete(partyId);
  else await withStore('readwrite', store => store.delete(partyId));
}

function sanitizeSvg(text) {
  if (!globalThis.DOMParser || !globalThis.XMLSerializer) throw new Error('Il browser non supporta la verifica sicura degli SVG. Usa un PNG.');
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') throw new Error('Il file SVG non è valido.');
  const root = document.documentElement;
  const visit = node => {
    for (const child of [...node.children]) {
      if (!allowedSvgTags.has(child.localName)) { child.remove(); continue; }
      visit(child);
    }
    for (const attribute of [...node.attributes]) {
      const name = attribute.name;
      const value = attribute.value.trim();
      if (!allowedSvgAttributes.has(name) || /^on/i.test(name) || (/url\s*\(/i.test(value) && !/^url\(#[\w.-]+\)$/.test(value))) node.removeAttribute(name);
    }
  };
  visit(root);
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' });
}

export const isImageAddress = value => { try { const url = new URL(String(value ?? '').trim()); return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname); } catch { return false; } };
const RASTER_TYPES = ['image/jpeg', 'image/webp', 'image/gif'];

// Loads a logo from an image address. When the site allows it the image is copied into the browser
// (it then works offline); otherwise the caller may keep the address after checking it displays.
export async function fetchLogoFromUrl(address) {
  if (!isImageAddress(address)) throw Object.assign(new Error('Inserisci un indirizzo completo che inizi con https://'), { code: 'invalid' });
  let response;
  try { response = await fetch(String(address).trim(), { mode: 'cors', credentials: 'omit', cache: 'no-store' }); }
  catch { throw Object.assign(new Error('Il sito non permette di copiare l’immagine.'), { code: 'blocked' }); }
  if (!response.ok) throw Object.assign(new Error(`L’indirizzo risponde con un errore (${response.status}).`), { code: 'http' });
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const size = Number(response.headers.get('content-length') ?? 0);
  if (size > MAX_FILE_BYTES) throw Object.assign(new Error('L’immagine supera i 2 MB.'), { code: 'size' });
  if (type && !type.startsWith('image/')) throw Object.assign(new Error('L’indirizzo non porta a un’immagine.'), { code: 'type' });
  const blob = await response.blob();
  const name = new URL(String(address).trim()).pathname.split('/').pop() || 'logo';
  return validateLogoFile(new File([blob], name, { type: type || blob.type }));
}
// Checks that an address displays as an image, for logos that can only be linked.
export function probeImage(address, timeout = 12000) {
  return new Promise((resolve, reject) => {
    if (!isImageAddress(address) || typeof Image === 'undefined') { reject(new Error('Inserisci un indirizzo completo che inizi con https://')); return; }
    const image = new Image();
    const timer = setTimeout(() => { image.src = ''; reject(new Error('L’immagine non risponde: controlla l’indirizzo o riprova.')); }, timeout);
    image.onload = () => { clearTimeout(timer); image.naturalWidth > 0 ? resolve({ width: image.naturalWidth, height: image.naturalHeight }) : reject(new Error('L’indirizzo non contiene un’immagine visualizzabile.')); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('L’indirizzo non contiene un’immagine visualizzabile o non è raggiungibile.')); };
    image.referrerPolicy = 'no-referrer';
    image.src = String(address).trim();
  });
}

export async function validateLogoFile(file) {
  if (!file || file.size > MAX_FILE_BYTES) throw new Error('Il file deve essere più piccolo di 2 MB.');
  if (file.type === 'image/png' || file.name?.toLocaleLowerCase().endsWith('.png')) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = [137,80,78,71,13,10,26,10];
    if (bytes.length < 24 || !signature.every((value,index) => bytes[index] === value)) throw new Error('Il file non contiene un PNG valido.');
    const dimensions = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if (dimensions.getUint32(16) > 4096 || dimensions.getUint32(20) > 4096) throw new Error('Il PNG supera i 4096 pixel per lato.');
    const blob = new Blob([bytes], { type: 'image/png' });
    if (globalThis.createImageBitmap) {
      const image = await createImageBitmap(blob);
      const acceptable = image.width <= 4096 && image.height <= 4096;
      image.close?.();
      if (!acceptable) throw new Error('Il PNG supera i 4096 pixel per lato.');
    }
    return blob;
  }
  if (file.type === 'image/svg+xml' || file.name?.toLocaleLowerCase().endsWith('.svg')) {
    return sanitizeSvg(await file.text());
  }
  // JPEG, WebP and GIF: accepted when the browser can decode them within the size limits.
  if (RASTER_TYPES.includes(file.type) || /\.(jpe?g|webp|gif)$/i.test(file.name ?? '')) {
    const blob = new Blob([await file.arrayBuffer()], { type: RASTER_TYPES.includes(file.type) ? file.type : 'image/jpeg' });
    if (globalThis.createImageBitmap) {
      let image;
      try { image = await createImageBitmap(blob); } catch { throw new Error('Il file non contiene un’immagine leggibile.'); }
      const acceptable = image.width <= 4096 && image.height <= 4096;
      image.close?.();
      if (!acceptable) throw new Error('L’immagine supera i 4096 pixel per lato.');
    }
    return blob;
  }
  throw new Error('Sono ammesse immagini SVG, PNG, JPEG, WebP o GIF.');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  return btoa(binary);
}

export async function exportLogoConfiguration() {
  const database = await openDatabase();
  const records = database ? await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }) : [...memory.values()];
  const logos = await Promise.all(records.map(async record => ({
    ...(({ blob, ...metadata }) => metadata)(record),
    ...(record.blob ? { base64: bytesToBase64(new Uint8Array(await record.blob.arrayBuffer())) } : {})
  })));
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), logos }, null, 2);
}

export async function importLogoConfiguration(text) {
  const data = JSON.parse(text);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.logos)) throw new Error('Il file non è una configurazione loghi POLITICANDO valida.');
  for (const item of data.logos) {
    if (item.partyId && item.url && item.base64 === undefined) {
      if (!isImageAddress(item.url)) throw new Error('Configurazione con indirizzo di logo non valido.');
      await saveLocalLogo(item.partyId, { url: item.url, sourceUrl: item.sourceUrl, source: item.source, verified: item.verified, alt: item.alt });
      continue;
    }
    if (!item.partyId || typeof item.base64 !== 'string' || item.base64.length > 3_000_000) throw new Error('Configurazione con logo non valido.');
    const binary = atob(item.base64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    if (bytes.byteLength > MAX_FILE_BYTES || !['image/png','image/svg+xml',...RASTER_TYPES].includes(item.mimeType)) throw new Error('Formato o dimensione del logo non ammessi.');
    let blob = new Blob([bytes], { type: item.mimeType });
    if (item.mimeType === 'image/svg+xml') blob = sanitizeSvg(await blob.text());
    await saveLocalLogo(item.partyId, { blob, fileName: item.fileName, sourceUrl: item.sourceUrl, source: item.source, verified: item.verified, alt: item.alt });
  }
}
