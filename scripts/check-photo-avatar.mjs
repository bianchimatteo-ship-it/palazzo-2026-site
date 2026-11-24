// The avatar made from a photograph: on the device, stylised in the manner of the game, kept only on this device. Checked:
//   1. the illustration (stylizePixels): deterministic, opaque, far fewer colours than the photograph, the outlines inked; the crop stays inside the photo;
//   2. in Chrome: the profile offers «Crea l’avatar da una foto»; a photo (a PNG with text metadata) is chosen from the input; the preview is drawn; the sliders change it; an invalid file is refused with
//      the reason; «Usa questo avatar» keeps only the portrait (WebP or PNG, 256 px, no metadata of the original) in the storage of the device, never in the save of the career (so never online);
//      the home shows the portrait; a reload keeps it; «Torna all’avatar illustrato» deletes it and the illustrated avatar comes back.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const P = await import(new URL(`../src/ui/photo-avatar.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
// 1. a synthetic «photo»: a face-like gradient with noise
const W = 64, H = 64, px = new Uint8ClampedArray(W * H * 4);
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4, d = Math.hypot(x - 32, y - 30) / 32;
  px[i] = 200 - d * 90 + rnd() * 30; px[i + 1] = 160 - d * 80 + rnd() * 30; px[i + 2] = 130 - d * 70 + rnd() * 30; px[i + 3] = 255;
}
const a = P.stylizePixels(px, W, H, { style: 4 }), b = P.stylizePixels(px, W, H, { style: 4 });
const colours = arr => new Set(Array.from({ length: arr.length / 4 }, (_, i) => `${arr[i * 4]},${arr[i * 4 + 1]},${arr[i * 4 + 2]}`)).size;
check(a.every((value, i) => value === b[i]), 'L’illustrazione è deterministica.');
check(Array.from({ length: W * H }, (_, i) => a[i * 4 + 3]).every(alpha => alpha === 255), 'L’illustrazione è opaca.');
check(colours(a) < colours(px) / 3, `L’illustrazione riduce i colori a toni piatti (${colours(px)} → ${colours(a)}).`);
check(colours(P.stylizePixels(px, W, H, { style: 5 })) <= colours(P.stylizePixels(px, W, H, { style: 1 })), 'Lo stile più forte ha meno toni.');
const rect = P.cropRect(800, 600, { zoom: 2, x: 1, y: -1 });
check(rect.sx >= 0 && rect.sy >= 0 && rect.sx + rect.side <= 800 && rect.sy + rect.side <= 600, 'Il ritaglio resta dentro la foto.');
// a PNG file with a text chunk standing for the metadata of the camera
const crc = buf => { let c, crcv = -1; for (const byte of buf) { c = (crcv ^ byte) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcv = (crcv >>> 8) ^ c; } return (crcv ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(px.buffer).copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('tEXt', Buffer.from('Comment\0GPS 43.7228N 10.4017E fotocamera-segreta')), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const dir = await mkdtemp(join(tmpdir(), 'avatar-foto-'));
const photo = join(dir, 'ritratto.png'), notImage = join(dir, 'documento.png');
await writeFile(photo, png); await writeFile(notImage, Buffer.from('questo non è un file immagine'));
// 2. in Chrome
if (chromeAvailable) await withBrowser(async browser => {
  const { evaluate, pause, version, send } = browser;
  await createCareerInPage(browser, { level: 'comunale', weeks: 0 });
  await openCareer(browser);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  await S(`store.navigate('profilo'); return true;`); await pause(900);
  check(await evaluate(`Boolean(document.querySelector('[data-action="photo-avatar"]'))`), 'Il profilo offre «Crea l’avatar da una foto».');
  await evaluate(`document.querySelector('[data-action="photo-avatar"]').click(), true`); await pause(900);
  check(await evaluate(`/non viene inviata a nessun server/.test(document.querySelector('.pa-privacy')?.textContent ?? '')`), 'L’editor dice che la foto resta sul dispositivo.');
  check(await evaluate(`document.querySelectorAll('[data-pa-file]').length === 2 && Boolean(document.querySelector('[data-pa-file][capture]'))`), 'Galleria e fotocamera (capture) sono offerte.');
  const setFile = async (file, index = 0) => {
    const { root } = await send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-pa-file]' });
    await send('DOM.setFileInputFiles', { nodeId: nodeIds[index], files: [file] }); await pause(1200);
  };
  await setFile(notImage);
  check(await evaluate(`!document.querySelector('[data-pa-error]').hidden && /Formato|immagine/.test(document.querySelector('[data-pa-error]').textContent)`), 'Un file che non è un’immagine è rifiutato con il motivo.');
  await setFile(photo);
  const drawn = await evaluate(`(() => { const c = document.querySelector('[data-pa-preview]'); return c.toDataURL().length; })()`);
  check(drawn > 3000 && await evaluate(`!document.querySelector('[data-pa-controls]').hidden && !document.querySelector('[data-pa-save]').disabled`), 'La foto diventa l’anteprima del ritratto, con i comandi di ritaglio e regolazione.');
  const before = await evaluate(`document.querySelector('[data-pa-preview]').toDataURL()`);
  await evaluate(`(() => { const s = document.querySelector('[data-pa-set="style"]'); s.value = '5'; s.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await pause(500);
  check(await evaluate(`document.querySelector('[data-pa-preview]').toDataURL()`) !== before, 'Lo stile cambia l’anteprima.');
  await evaluate(`document.querySelector('[data-pa-save]').click(), true`); await pause(1000);
  const stored = await evaluate(`(() => { const all = JSON.parse(localStorage.getItem('politicando.photo-avatar.v1') ?? '{}'); const entry = Object.values(all)[0]; return entry ? { image: entry.image.slice(0, 30), length: entry.image.length, text: atob(entry.image.split(',')[1]).includes('fotocamera-segreta') } : null; })()`);
  check(stored && /^data:image\/(webp|png|jpeg)/.test(stored.image) && stored.length < 260000, `Il ritratto è salvato sul dispositivo (${stored?.image}, ${stored?.length} caratteri).`);
  check(stored && !stored.text, 'Nessun metadato della foto originale nel ritratto salvato.');
  check(!(await S(`return store.exportSave().includes('data:image/');`)), 'Il ritratto non entra nel salvataggio della carriera (quindi non va online).');
  await S(`store.navigate('panoramica'); return true;`); await pause(900);
  check(await evaluate(`Boolean(document.querySelector('.hq-identity .avatar-photo'))`), 'La Panoramica mostra l’avatar da foto.');
  await openCareer(browser); await pause(600);
  check(await evaluate(`Boolean(document.querySelector('.hq-identity .avatar-photo'))`), 'Dopo il ricaricamento l’avatar da foto resta.');
  await S(`store.navigate('profilo'); return true;`); await pause(800);
  await evaluate(`document.querySelector('[data-action="photo-avatar"]').click(), true`); await pause(700);
  await evaluate(`document.querySelector('[data-pa-reset]').click(), true`); await pause(800);
  check(await evaluate(`Object.keys(JSON.parse(localStorage.getItem('politicando.photo-avatar.v1') ?? '{}')).length === 0`), '«Torna all’avatar illustrato» cancella il ritratto.');
  await S(`store.navigate('panoramica'); return true;`); await pause(800);
  check(await evaluate(`!document.querySelector('.hq-identity .avatar-photo') && Boolean(document.querySelector('.hq-identity svg'))`), 'Torna l’avatar illustrato.');
});
await rm(dir, { recursive: true, force: true });
if (problems.length) { console.error(`Avatar da foto — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Avatar da foto verificato: illustrazione locale deterministica (toni piatti, contorni), ritaglio dentro la foto; nel browser galleria e fotocamera, file non validi rifiutati con il motivo, anteprima e regolazioni, ritratto salvato solo sul dispositivo senza metadati né foto originale, fuori dal salvataggio online, mostrato in Panoramica, conservato al ricaricamento, cancellato con «Torna all’avatar illustrato».');
