// The Android project, checked without the Android SDK (nothing is built, nothing is signed, nothing is read that is secret):
//   - identity: applicationId equals the Capacitor appId and the one of www/build-info.json; versionCode is a positive integer and versionName a version number (with --previous-version-code N, or
//     POLITICANDO_PREVIOUS_VERSION_CODE, versionCode must also be greater than the one already on Google Play);
//   - signing: a release build without a valid key FAILS (the guard in android/app/build.gradle), no password or key is written in the project, key files are ignored by git and not tracked;
//   - launcher icon: every density has the adaptive foreground (transparent margins, drawing inside the 66 dp safe zone of the 108 dp canvas, not too small), the legacy square and the round icon
//     (drawing inside the shape), the XML of the adaptive icon points at them, the manifest uses them;
//   - www and the app: www/ carries the same version stamp as the sources; if `npx cap sync android` has run, android/app/src/main/assets/public is exactly www/ (a stale copy would put an old game
//     in the bundle). With --release a copy that was not synchronised is an error too (before building the bundle: `npm run build:www && npx cap sync android && npm run check:android -- --release`).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const release = args.includes('--release');
const previousIndex = args.indexOf('--previous-version-code');
const previousCode = Number(previousIndex >= 0 ? args[previousIndex + 1] : process.env.POLITICANDO_PREVIOUS_VERSION_CODE ?? 0) || 0;
const text = path => readFile(join(root, path), 'utf8');
const notes = [];

// ---------- 1. identity ----------
const gradle = await text('android/app/build.gradle');
const capacitor = JSON.parse(await text('capacitor.config.json'));
const buildInfo = JSON.parse(await text('www/build-info.json'));
const applicationId = /applicationId\s+"([^"]+)"/.exec(gradle)?.[1];
const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
const versionName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
assert.equal(applicationId, capacitor.appId, 'applicationId coincide con l’appId di Capacitor.');
assert.equal(applicationId, buildInfo.appId, 'applicationId coincide con quello di www/build-info.json.');
assert.match(String(await text('android/app/src/main/res/values/strings.xml')), new RegExp(`<string name="package_name">${applicationId.replaceAll('.', '\\.')}</string>`), 'Il nome del pacchetto nelle risorse è quello dell’app.');
assert.ok(Number.isInteger(versionCode) && versionCode >= 1, `versionCode è un intero positivo (letto: ${versionCode}).`);
assert.match(versionName ?? '', /^\d+\.\d+(\.\d+)?$/, `versionName è un numero di versione (letto: ${versionName}).`);
if (previousCode) assert.ok(versionCode > previousCode, `versionCode (${versionCode}) deve superare quello già su Google Play (${previousCode}).`);
else notes.push(`versionCode ${versionCode} / versionName ${versionName}: confronto con Google Play non fatto (indica --previous-version-code N)`);
const gradleSdk = await text('android/variables.gradle');
assert.ok(Number(/targetSdkVersion = (\d+)/.exec(gradleSdk)?.[1]) >= 35, 'targetSdk almeno 35 (requisito di Google Play).');
const manifest = await text('android/app/src/main/AndroidManifest.xml');
assert.deepEqual([...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map(match => match[1]), ['android.permission.INTERNET'], 'L’unico permesso è INTERNET.');

// ---------- 2. signing ----------
assert.ok(/gradle\.taskGraph\.whenReady/.test(gradle) && /throw new GradleException/.test(gradle) && /Release/.test(gradle.slice(gradle.indexOf('whenReady'))), 'build.gradle: una build release senza chiave valida fallisce (guardia presente).');
assert.ok(!/logger\.warn\('POLITICANDO: no release signing key/.test(gradle), 'build.gradle: l’assenza della chiave non è più solo un avviso.');
assert.ok(!/signingConfig\s+signingConfigs\.debug/.test(gradle), 'La build release non usa la chiave di debug.');
assert.ok(!/(?<!['"])\b(storePassword|keyPassword)\s*=?\s*['"][^'"]+['"]/.test(gradle), 'Nessuna password scritta in build.gradle.');
const ignore = await text('.gitignore');
for (const entry of ['*.jks', '*.keystore', 'android/keystore.properties']) assert.ok(ignore.split('\n').includes(entry), `.gitignore esclude ${entry}.`);
let tracked = [];
try { tracked = execFileSync('git', ['ls-files', 'android', 'keystore.properties'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean); } catch { notes.push('elenco dei file tracciati non disponibile (non è un clone git): controllo delle chiavi non fatto'); }
assert.deepEqual(tracked.filter(file => /\.(jks|keystore|p12|pfx)$|keystore\.properties$/i.test(file)), [], 'Nessun file di chiave o keystore.properties è tracciato da git.');

// ---------- 3. launcher icon ----------
const res = 'android/app/src/main/res';
const adaptive = await text(`${res}/mipmap-anydpi-v26/ic_launcher.xml`);
assert.ok(/<foreground android:drawable="@mipmap\/ic_launcher_foreground"\/>/.test(adaptive) && /<background android:drawable="@color\/ic_launcher_background"\/>/.test(adaptive), 'Icona adaptive: primo piano e sfondo attesi.');
assert.equal(await text(`${res}/mipmap-anydpi-v26/ic_launcher_round.xml`), adaptive, 'Icona adaptive tonda uguale a quella quadrata.');
assert.ok(/android:icon="@mipmap\/ic_launcher"/.test(manifest) && /android:roundIcon="@mipmap\/ic_launcher_round"/.test(manifest), 'Il manifest usa le icone launcher.');
const background = /<color name="ic_launcher_background">#([0-9A-Fa-f]{6})<\/color>/.exec(await text(`${res}/values/ic_launcher_background.xml`))?.[1];
assert.ok(background, 'Colore di sfondo dell’icona definito.');
const bg = [0, 2, 4].map(i => parseInt(background.slice(i, i + 2), 16));

// A small PNG reader (8-bit RGB / RGBA, not interlaced): enough for the launcher icons.
function readPng(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG valido.');
  let offset = 8, header, idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('latin1', offset + 4, offset + 8), data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  assert.ok(header.depth === 8 && [2, 6].includes(header.color) && header.interlace === 0, 'PNG a 8 bit RGB/RGBA non interlacciato.');
  const channels = header.color === 6 ? 4 : 3, stride = header.width * channels, raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(header.height * stride);
  for (let y = 0; y < header.height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[out + x - channels] : 0, b = y ? pixels[out - stride + x] : 0, c = x >= channels && y ? pixels[out - stride + x - channels] : 0;
      const predictor = [0, a, b, (a + b) >> 1, (() => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })()][filter];
      pixels[out + x] = (line[x] + predictor) & 255;
    }
  }
  return { width: header.width, height: header.height, at: (x, y) => { const i = y * stride + x * channels; return [pixels[i], pixels[i + 1], pixels[i + 2], channels === 4 ? pixels[i + 3] : 255]; } };
}
// What is "drawn": a visible pixel (alpha) that is not the plain background colour. Returns the box and the farthest distance from the centre, as a fraction of the side.
function drawing(image, { transparent }) {
  let minX = image.width, minY = image.height, maxX = -1, maxY = -1, far = 0;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const [r, g, b, a] = image.at(x, y);
    const visible = transparent ? a > 30 : a > 30 && Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2])) > 24;
    if (!visible) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    far = Math.max(far, Math.hypot(x + 0.5 - image.width / 2, y + 0.5 - image.height / 2) / image.width);
  }
  return { empty: maxX < 0, width: (maxX - minX + 1) / image.width, height: (maxY - minY + 1) / image.height, far, centreX: (minX + maxX + 1) / 2 / image.width, centreY: (minY + maxY + 1) / 2 / image.height };
}
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, factor] of Object.entries(densities)) {
  const where = `mipmap-${name}`;
  const foreground = readPng(await readFile(join(root, res, where, 'ic_launcher_foreground.png')));
  const square = readPng(await readFile(join(root, res, where, 'ic_launcher.png')));
  const round = readPng(await readFile(join(root, res, where, 'ic_launcher_round.png')));
  assert.equal(foreground.width, 108 * factor, `${where}: primo piano adaptive di ${108 * factor} px.`);
  assert.equal(square.width, 48 * factor, `${where}: icona legacy di ${48 * factor} px.`); assert.equal(round.width, 48 * factor, `${where}: icona tonda di ${48 * factor} px.`);
  assert.equal(foreground.at(0, 0)[3], 0, `${where}: gli angoli del primo piano sono trasparenti (margini).`);
  assert.equal(round.at(0, 0)[3], 0, `${where}: gli angoli dell’icona tonda sono trasparenti.`);
  const fg = drawing(foreground, { transparent: true });
  assert.ok(!fg.empty, `${where}: il primo piano contiene il disegno.`);
  // The visible area of an adaptive icon is the 66 dp circle at the centre of the 108 dp canvas (radius 33/108 of the side); nothing may leave it.
  assert.ok(fg.far <= 33 / 108, `${where}: il disegno del primo piano resta nella zona sicura (raggio ${(fg.far * 108).toFixed(1)} dp su 33).`);
  assert.ok(fg.width >= 0.3 && fg.width <= 0.62 && Math.abs(fg.centreX - 0.5) < 0.03 && Math.abs(fg.centreY - 0.5) < 0.05, `${where}: il disegno è centrato, né enorme né minuscolo (larghezza ${(fg.width * 100).toFixed(0)}%).`);
  for (const [label, image] of [['legacy', square], ['tonda', round]]) {
    const d = drawing(image, { transparent: false });
    assert.ok(!d.empty && d.far <= 0.45 && d.width >= 0.3 && d.width <= 0.7 && Math.abs(d.centreX - 0.5) < 0.03, `${where}: il disegno dell’icona ${label} è dentro i bordi e centrato (larghezza ${(d.width * 100).toFixed(0)}%, distanza ${(d.far * 100).toFixed(0)}% del lato).`);
  }
}

// ---------- 4. www and the copy inside the Android project ----------
const wwwIndex = await text('www/index.html');
const stamp = /main\.js\?v=([\w-]+)/.exec(await text('index.html'))?.[1];
assert.ok(stamp && wwwIndex.includes(`?v=${stamp}`), 'www/index.html ha lo stesso timbro di versione dei sorgenti.');
assert.equal(buildInfo.buildStamp, stamp, 'www/build-info.json ha il timbro dei sorgenti.');
const list = async dir => { const out = []; const walk = async current => { for (const entry of await readdir(current, { withFileTypes: true })) { const path = join(current, entry.name); if (entry.isDirectory()) await walk(path); else out.push(relative(dir, path).split('\\').join('/')); } }; await walk(dir); return out.sort(); };
const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const publicDir = join(root, 'android/app/src/main/assets/public');
if (!existsSync(publicDir)) {
  const message = 'android/app/src/main/assets/public non esiste: l’app non è stata sincronizzata (npx cap sync android)';
  if (release) assert.fail(`${message}: con --release serve.`);
  notes.push(`${message}; con --release sarebbe un errore`);
} else {
  const source = await list(join(root, 'www')), copy = (await list(publicDir)).filter(file => !/^(cordova\.js|cordova_plugins\.js)$/.test(file));
  assert.deepEqual(copy, source, 'La copia nel progetto Android contiene gli stessi file di www/.');
  const stale = [];
  for (const file of source) if (await digest(join(root, 'www', file)) !== await digest(join(publicDir, file))) stale.push(file);
  assert.deepEqual(stale, [], `La copia nel progetto Android è aggiornata (file diversi da www/: ${stale.slice(0, 5).join(', ')}): esegui npx cap sync android.`);
  assert.ok((await stat(join(publicDir, 'index.html'))).size > 0);
  notes.push(`copia Android sincronizzata con www/ (${source.length} file)`);
}

console.log(`Progetto Android verificato (${applicationId}, versionCode ${versionCode}, versionName ${versionName}, nessuna build eseguita): identificativo coerente, una build release senza chiave valida fallisce, nessuna chiave nel progetto, icona launcher dentro la zona sicura in 5 densità (adaptive, legacy, tonda), timbro di www coerente.${notes.length ? `\nNote: ${notes.join('; ')}.` : ''}`);
