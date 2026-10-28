// Export and import of the whole catalog of logos as one zip, against the local stand-ins of the Worker (an in-memory D1, an in-memory R2, no network, nothing real is touched):
//   - the zip: written and read back, compressed entries too; a file that is not a zip, truncated, altered, with a path out of the archive, encrypted, too big or too full is refused with a reason;
//   - export: 90 logos in one file with the images, the original ids of the parties and a manifest (checksums, sizes, metadata); no account name in it;
//   - import into ANOTHER account in one operation (90 logos), then the synchronisation uploads them all; a second device of that account gets them all; account A is untouched (isolation);
//   - duplicates and conflicts are found before anything is written; keep / replace / skip, per party too; what is replaced is kept in a recovery copy that can be restored; repeating an import
//     changes nothing; invalid images are reported and the others are imported;
//   - interruptions: the browser runs out of space half way (the written ones stay, the others are reported and a retry finishes without duplicates), the network is off, the bucket fails: nothing is lost
//     and a later synchronisation uploads each logo once;
//   - the guest scope: exported and imported without ever being uploaded.
// The browser side runs on the in-memory fallback of the personal-logos module (no IndexedDB in Node); a "second device" is an empty local cache against the same account.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateRawSync, deflateSync } from 'node:zlib';

const store = new Map();
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, String(value)); }, removeItem: key => { store.delete(key); } };
globalThis.location = new URL('http://127.0.0.1:8791/');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const stamp = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const q = stamp ? `?v=${stamp}` : '';
const client = await import(`../src/data/repositories/account-sync.js${q}`);
const logos = await import(`../src/data/repositories/personal-logos.js${q}`);
const sync = await import(`../src/data/repositories/logo-sync.js${q}`);
const archive = await import(`../src/data/repositories/logo-archive.js${q}`);

// ---- valid PNGs of any size and colour ----
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = bytes => { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length); return out; };
const png = (r, g, b, side = 32) => {
  const head = Buffer.alloc(13); head.writeUInt32BE(side, 0); head.writeUInt32BE(side, 4); head[8] = 8; head[9] = 2;
  const row = Buffer.alloc(1 + side * 3); for (let x = 0; x < side; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: side }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
};
const colourOf = n => [(n * 37) % 256, (n * 91 + 40) % 256, (n * 53 + 90) % 256];
const imageOf = n => png(...colourOf(n), 32 + (n % 5));
const idOf = n => `party-prova-${String(n).padStart(3, '0')}`;
const prepared = bytes => ({ blob: new Blob([bytes], { type: 'image/png' }), mimeType: 'image/png', width: 32, height: 32, bytes: bytes.length });
const sha = bytes => logos.sha256OfBlob(new Blob([bytes]));
const bytesOf = async blob => new Uint8Array(await blob.arrayBuffer());

const local = await startLocalWorker({ port: 8791 });
let ip = 120;
const register = async (username, password) => {
  const proof = await client.passwordProof(username, password);
  const response = await fetch(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ip}` }, body: JSON.stringify({ username, proof }) });
  assert.equal(response.status, 201); return { username, token: (await response.json()).token };
};
const signIn = async user => { if (user) store.set('politicando.account.v1', JSON.stringify({ username: user.username, token: user.token })); else store.delete('politicando.account.v1'); await logos.loadLogos(); };
const wipeDevice = async user => { for (const scope of [user.username, `${user.username}${logos.CONFLICT_SUFFIX}`, `${user.username}${archive.RECOVERY_SUFFIX}`, '_ospite', logos.LEGACY_SCOPE]) for (const record of await logos.logoStore.all(scope)) await logos.logoStore.remove(record.key); await logos.loadLogos(); };
const rowsOf = username => local.sqlite.prepare('SELECT l.* FROM logos l JOIN users u ON u.id = l.user_id WHERE u.username = ? AND l.deleted_at IS NULL ORDER BY party_id').all(username);
const objectsOf = username => { const id = local.sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username)?.id; return [...local.r2Data.keys()].filter(key => key.startsWith(`logos/${id}/`)); };
const recordsOf = async scope => (await logos.logoStore.all(scope)).filter(record => record.blob && !record.deleted);
const A = await register('arc.a', 'password-di-a'), B = await register('arc.b', 'password-di-b'), C = await register('arc.c', 'password-di-c'), D = await register('arc.d', 'password-di-d');
const lines = [];

// ---------- 1. the zip ----------
{
  const files = [{ name: 'a.txt', bytes: new TextEncoder().encode('ciao') }, { name: 'dir/b.bin', bytes: Uint8Array.from({ length: 5000 }, (_, i) => i % 251) }];
  const plain = archive.zipStore(files);
  const back = await archive.readZip(plain);
  assert.deepEqual([...back.keys()], ['a.txt', 'dir/b.bin']); assert.deepEqual([...back.get('dir/b.bin')], [...files[1].bytes], 'Lo ZIP scritto si rilegge identico.');
  // a zip made by another program (deflate): central directory with method 8
  const deflated = deflateRawSync(Buffer.from(files[1].bytes));
  const outside = archive.zipStore([{ name: 'x.bin', bytes: files[1].bytes }]);
  const patched = Buffer.from(outside);
  const nameLength = 5, localEnd = 30 + nameLength;
  const rebuilt = Buffer.concat([patched.subarray(0, localEnd), deflated, patched.subarray(localEnd + files[1].bytes.length)]);
  rebuilt.writeUInt16LE(8, 8); rebuilt.writeUInt32LE(deflated.length, 18);   // local header: method, compressed size
  const centralAt = rebuilt.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  rebuilt.writeUInt16LE(8, centralAt + 10); rebuilt.writeUInt32LE(deflated.length, centralAt + 20);
  const eocd = rebuilt.length - 22; rebuilt.writeUInt32LE(centralAt, eocd + 16);
  assert.deepEqual([...(await archive.readZip(new Uint8Array(rebuilt))).get('x.bin')], [...files[1].bytes], 'Anche un ZIP compresso da un altro programma si legge.');
  const refused = async (bytes, pattern, message) => { await assert.rejects(archive.readZip(bytes), error => pattern.test(error.message), message); };
  await refused(new Uint8Array(10), /ZIP valido/, 'Un file troppo corto non è uno ZIP.');
  await refused(new TextEncoder().encode('Questo non è un archivio, è solo un testo abbastanza lungo da superare la soglia minima.'), /ZIP valido/, 'Un testo non è uno ZIP.');
  await refused(plain.subarray(0, plain.length - 40), /incompleto|ZIP valido|danneggiato/, 'Uno ZIP troncato è rifiutato.');
  const flipped = Uint8Array.from(plain); flipped[40] ^= 0xff;
  await refused(flipped, /CRC|danneggiato/, 'Un byte alterato è scoperto dal controllo CRC.');
  const slip = archive.zipStore([{ name: '../fuori.png', bytes: files[0].bytes }]);
  await refused(slip, /nome di file non ammesso/, 'Un percorso che esce dall’archivio è rifiutato.');
  const encrypted = Buffer.from(plain); const at = encrypted.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); encrypted.writeUInt16LE(encrypted.readUInt16LE(at + 8) | 1, at + 8);
  await refused(new Uint8Array(encrypted), /password/, 'Uno ZIP con password è rifiutato.');
  await assert.rejects(archive.readZip(archive.zipStore(Array.from({ length: 5 }, (_, i) => ({ name: `f${i}`, bytes: new Uint8Array(3) }))), { ...archive.LIMITS, maxEntries: 4 }), /troppi file/, 'Troppi file: rifiutato.');
  await assert.rejects(archive.readZip(archive.zipStore([{ name: 'grande', bytes: new Uint8Array(2000) }]), { ...archive.LIMITS, maxEntryBytes: 1000 }), /troppo grande/, 'Un file troppo grande: rifiutato.');
  const bomb = Buffer.from(rebuilt); const bombAt = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); bomb.writeUInt32LE(10, bombAt + 24); bomb.writeUInt32LE(10, 22);
  await assert.rejects(archive.readZip(new Uint8Array(bomb)), /danneggiato|troppo grande/, 'Una dimensione dichiarata falsa (decompressione) è rifiutata.');
  lines.push('ZIP scritto e letto (anche compresso), file troncati, alterati, con percorsi fuori dall’archivio, con password o troppo grandi rifiutati');
}

// ---------- 2. export of 90 logos ----------
const COUNT = 90;
await signIn(A);
for (let n = 1; n <= COUNT; n++) await logos.saveLogo(idOf(n), prepared(imageOf(n)), { fileName: `logo-${n}.png`, alt: `Logo ${n}` });
await assert.rejects(archive.exportLogosZip({ scope: 'arc.vuoto' }), error => error.code === 'empty', 'Senza loghi non si esporta.');
const exported = await archive.exportLogosZip({ now: new Date('2026-10-28T10:00:00Z') });
assert.equal(exported.count, COUNT); assert.equal(exported.fileName, 'loghi-politicando-2026-10-28.zip'); assert.equal(exported.blob.type, 'application/zip');
const zipBytes = await bytesOf(exported.blob);
const entries = await archive.readZip(zipBytes);
assert.equal(entries.size, COUNT + 1, 'Un manifest e un file per logo.');
const manifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json')));
assert.deepEqual({ format: manifest.format, version: manifest.version, count: manifest.count }, { format: 'politicando-logos', version: 1, count: COUNT });
assert.deepEqual(manifest.logos.map(item => item.partyId), Array.from({ length: COUNT }, (_, i) => idOf(i + 1)), 'Gli ID originali dei partiti sono nel manifest.');
for (const item of manifest.logos) {
  const data = entries.get(item.file);
  assert.ok(data && item.mimeType === 'image/png' && item.bytes === data.length && item.sha256 === await sha(data) && item.width > 0 && item.fileName && item.updatedAt, `${item.partyId}: immagine, checksum e metadati.`);
}
assert.ok(!new TextDecoder().decode(entries.get('manifest.json')).includes('arc.a'), 'Il manifest non contiene il nome dell’account.');
lines.push(`${COUNT} loghi esportati in un solo ZIP con immagini, ID originali e manifest (checksum, dimensioni, metadati)`);
const zipFile = new Blob([zipBytes]);

// ---------- 3. import into ANOTHER account in one operation, then the cloud ----------
await sync.syncLogos();   // A's logos go online first
assert.equal(rowsOf('arc.a').length, COUNT);
await signIn(B); await wipeDevice(B);
const plan = await archive.analyzeLogoArchive(zipFile);
assert.deepEqual(plan.counts, { total: COUNT, new: COUNT, same: 0, conflict: 0, invalid: 0 }, 'Un account vuoto: tutti i loghi sono nuovi.');
assert.equal(plan.overLimit, 0);
const progress = [];
const done = await archive.applyLogoImport(plan, { onProgress: item => progress.push(item.done) });
assert.equal(done.imported.length, COUNT); assert.equal(done.failed.length, 0);
assert.equal(progress.at(-1), COUNT, 'L’avanzamento arriva alla fine.');
assert.equal((await recordsOf('arc.b')).length, COUNT, 'Tutti i loghi sono nel catalogo di B.');
assert.ok((await recordsOf('arc.b')).every(record => record.dirty === true && record.sync === null), 'Sono loghi da caricare sull’account.');
assert.equal(rowsOf('arc.b').length, 0, 'Finché la sincronizzazione non parte, nulla è online.');
const uploaded = await sync.syncLogos();
assert.equal(uploaded.uploaded.length, COUNT, `La sincronizzazione carica tutti i ${COUNT} loghi (errori: ${JSON.stringify(uploaded.errors.slice(0, 2))}).`);
assert.equal(uploaded.pending, 0); assert.equal(rowsOf('arc.b').length, COUNT); assert.equal(objectsOf('arc.b').length, COUNT, 'Un oggetto in R2 per logo.');
assert.equal(rowsOf('arc.a').length, COUNT, 'L’account A non è cambiato.'); assert.equal(objectsOf('arc.a').length, COUNT);
const check = rowsOf('arc.b').map(row => row.sha256).sort();
assert.deepEqual(check, manifest.logos.map(item => item.sha256).sort(), 'Online ci sono le stesse immagini dell’archivio.');
// a second device of B
await wipeDevice(B);
const second = await sync.syncLogos();
assert.equal(second.downloaded.length, COUNT, 'Un altro dispositivo di B riceve tutti i loghi.');
assert.deepEqual((await recordsOf('arc.b')).map(record => record.sha).sort(), check);
// A does not see B's, B does not see A's
await signIn(A); await wipeDevice(A); await sync.syncLogos();
assert.equal((await recordsOf('arc.a')).length, COUNT); assert.ok((await recordsOf('arc.a')).every(record => record.scope === 'arc.a'));
lines.push(`importati ${COUNT} loghi in un altro account con una sola operazione, caricati online, ricevuti da un secondo dispositivo, account A intatto`);

// ---------- 4. duplicates and conflicts, before anything is written ----------
await signIn(B); await wipeDevice(B);
for (let n = 1; n <= 10; n++) await logos.saveLogo(idOf(n), prepared(imageOf(n)));            // the same images
for (let n = 11; n <= 30; n++) await logos.saveLogo(idOf(n), prepared(imageOf(n + 500)));     // other images for the same parties
const before = await Promise.all((await recordsOf('arc.b')).map(async record => [record.partyId, record.sha]));
const mixed = await archive.analyzeLogoArchive(zipFile);
assert.deepEqual(mixed.counts, { total: COUNT, new: COUNT - 30, same: 10, conflict: 20, invalid: 0 }, 'Identici, in conflitto e nuovi sono distinti prima di scrivere.');
assert.deepEqual((await recordsOf('arc.b')).map(record => [record.partyId, record.sha]), before, 'L’analisi non scrive nulla.');
// keep the existing
let report = await archive.applyLogoImport(mixed, { policy: 'keep' });
assert.deepEqual([report.imported.length, report.kept.length, report.same.length, report.replaced.length], [COUNT - 30, 20, 10, 0]);
assert.equal((await recordsOf('arc.b')).length, COUNT);
assert.deepEqual((await recordsOf('arc.b')).filter(record => Number(record.partyId.slice(-3)) >= 11 && Number(record.partyId.slice(-3)) <= 30).map(record => record.sha).sort(), before.filter(([id]) => Number(id.slice(-3)) >= 11).map(([, hash]) => hash).sort(), 'Mantenere: i loghi che avevi non cambiano.');
// replace one party by choice, skip another, the rest keeps (nothing was replaced yet: reset the 60 new ones to test the policies on the same 20 conflicts)
const conflicts = mixed.items.filter(item => item.status === 'conflict').map(item => item.partyId);
const chosen = await archive.applyLogoImport(mixed, { policy: 'keep', decisions: { [conflicts[0]]: 'replace', [conflicts[1]]: 'skip' } });
assert.deepEqual([chosen.replaced, chosen.skipped, chosen.kept.length, chosen.same.length, chosen.imported.length], [[conflicts[0]], [conflicts[1]], 18, 70, 0], 'Una scelta per singolo partito vale più della scelta generale.');
const recovery = await archive.listReplacedLogos();
assert.deepEqual(recovery.map(item => item.partyId), [conflicts[0]], 'Il logo sostituito è nella copia di recupero.');
assert.equal((await recordsOf('arc.b')).find(record => record.partyId === conflicts[0]).sha, mixed.items.find(item => item.partyId === conflicts[0]).incoming.sha, 'Il logo sostituito è quello importato.');
assert.equal(recovery[0].sha ?? null, before.find(([id]) => id === conflicts[0])[1], 'La copia di recupero è il logo di prima.');
// the same import again changes nothing
const snapshot = JSON.stringify((await recordsOf('arc.b')).map(record => [record.partyId, record.sha, record.updatedAt]).sort());
const again = await archive.analyzeLogoArchive(zipFile);
assert.equal(again.counts.new, 0);
const repeated = await archive.applyLogoImport(again, { policy: 'keep' });
assert.deepEqual([repeated.imported.length, repeated.replaced.length], [0, 0]);
assert.equal(JSON.stringify((await recordsOf('arc.b')).map(record => [record.partyId, record.sha, record.updatedAt]).sort()), snapshot, 'Importare due volte lo stesso archivio non cambia nulla e non duplica.');
// replace everything that conflicts, then restore
const all = await archive.applyLogoImport(again, { policy: 'replace' });
assert.equal(all.replaced.length, 19, 'Con «sostituisci» i conflitti rimasti sono sostituiti.');
assert.equal((await archive.listReplacedLogos()).length, 20, 'I loghi sostituiti sono tutti recuperabili.');
const restored = await archive.restoreReplacedLogos();
assert.equal(restored.length, 20);
assert.equal((await recordsOf('arc.b')).find(record => record.partyId === conflicts[0]).sha, before.find(([id]) => id === conflicts[0])[1], 'Il ripristino rimette il logo di prima.');
assert.equal((await recordsOf('arc.b')).length, COUNT, 'Nessun logo è andato perso.');
// skip
await signIn(B); await wipeDevice(B);
for (let n = 11; n <= 30; n++) await logos.saveLogo(idOf(n), prepared(imageOf(n + 500)));
const skipping = await archive.applyLogoImport(await archive.analyzeLogoArchive(zipFile), { policy: 'skip' });
assert.equal(skipping.skipped.length, 20); assert.equal(skipping.imported.length, COUNT - 20); assert.equal((await recordsOf('arc.b')).length, COUNT);
lines.push('duplicati e conflitti trovati prima di scrivere; mantieni, sostituisci o salta (anche per singolo partito); sostituiti recuperabili; importazione ripetuta senza duplicati');

// ---------- 5. invalid files in the archive: reported, the others imported ----------
{
  await wipeDevice(B);
  const good = png(10, 120, 200, 40);
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>');
  const tiny = png(1, 2, 3, 8), huge = png(1, 2, 3, 5000).subarray(0, 100);
  const entriesList = [
    { partyId: 'ok-uno', bytes: good }, { partyId: 'ok-due', bytes: png(200, 10, 10, 40) },
    { partyId: 'svg', bytes: svg }, { partyId: 'piccolo', bytes: tiny }, { partyId: 'enorme', bytes: huge }, { partyId: 'testo', bytes: new TextEncoder().encode('non sono un’immagine, ma un testo lungo abbastanza da sembrare un file') },
    { partyId: 'alterato', bytes: png(9, 9, 9, 40), sha256: 'a'.repeat(64) }, { partyId: 'id non valido/..', bytes: good }, { partyId: 'ok-uno', bytes: png(7, 7, 7, 40) }, { partyId: 'senza-file', bytes: null }
  ];
  const files = [], logosList = [];
  for (const [index, item] of entriesList.entries()) {
    const name = `logos/${index}.bin`;
    if (item.bytes) files.push({ name, bytes: new Uint8Array(item.bytes) });
    logosList.push({ partyId: item.partyId, file: name, mimeType: 'image/png', sha256: item.sha256 ?? (item.bytes ? await sha(new Uint8Array(item.bytes)) : undefined), fileName: `${index}.png` });
  }
  const built = archive.zipStore([{ name: 'manifest.json', bytes: new TextEncoder().encode(JSON.stringify({ format: 'politicando-logos', version: 1, logos: logosList })) }, ...files]);
  const mixedPlan = await archive.analyzeLogoArchive(built);
  const status = Object.fromEntries(mixedPlan.items.map((item, index) => [index, item.status]));
  assert.deepEqual(Object.values(status), ['new', 'new', 'invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'invalid'], 'Valide e non valide distinte con il loro motivo.');
  assert.ok(mixedPlan.items.every(item => item.status !== 'invalid' || item.reason), 'Ogni file non valido dice perché.');
  assert.match(mixedPlan.items[2].reason, /SVG/); assert.match(mixedPlan.items[3].reason, /piccola/); assert.match(mixedPlan.items[6].reason, /manifest/); assert.match(mixedPlan.items[8].reason, /due volte/);
  const partial = await archive.applyLogoImport(mixedPlan);
  assert.equal(partial.imported.length, 2); assert.equal(partial.invalid.length, 8);
  assert.deepEqual((await recordsOf('arc.b')).map(record => record.partyId).sort(), ['ok-due', 'ok-uno']);
  // not archives
  await assert.rejects(archive.analyzeLogoArchive(archive.zipStore([{ name: 'altro.txt', bytes: new Uint8Array(3) }])), /manca manifest/);
  await assert.rejects(archive.analyzeLogoArchive(archive.zipStore([{ name: 'manifest.json', bytes: new TextEncoder().encode('{"format":"altro","logos":[]}') }])), /non è un archivio di loghi/);
  await assert.rejects(archive.analyzeLogoArchive(archive.zipStore([{ name: 'manifest.json', bytes: new TextEncoder().encode('{"format":"politicando-logos","version":9,"logos":[]}') }])), /più recente/);
  await assert.rejects(archive.analyzeLogoArchive(archive.zipStore([{ name: 'manifest.json', bytes: new TextEncoder().encode('non json') }])), /manifest/);
  lines.push('file non validi (SVG, troppo piccoli o grandi, alterati, id non validi, ripetuti, mancanti) segnalati con il motivo e gli altri importati');
}

// ---------- 6. interruptions (a third account, whose cloud copy is empty) ----------
{
  await signIn(C); await wipeDevice(C);
  const plan2 = await archive.analyzeLogoArchive(zipFile);
  // the browser runs out of space after 40 logos
  const original = logos.logoStore.put; let written = 0;
  logos.logoStore.put = async record => { if (!String(record.scope).includes('#') && ++written > 40) throw Object.assign(new Error('pieno'), { code: 'quota' }); return original(record); };
  const cut = await archive.applyLogoImport(plan2);
  logos.logoStore.put = original;
  assert.equal(cut.imported.length, 40); assert.equal(cut.failed.length, COUNT - 40, 'Quelli non scritti sono segnalati.');
  assert.ok(cut.failed.every(item => item.code === 'quota'));
  assert.equal((await recordsOf('arc.c')).length, 40, 'Quelli già scritti restano.');
  const retried = await archive.applyLogoImport(plan2, { only: new Set(cut.failed.map(item => item.partyId)) });
  assert.equal(retried.imported.length, COUNT - 40); assert.equal(retried.failed.length, 0);
  assert.equal((await recordsOf('arc.c')).length, COUNT, 'Il nuovo tentativo completa senza duplicati.');
  // the network is off: the logos wait, then go up once
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  const offline = await sync.syncLogos();
  globalThis.fetch = realFetch;
  assert.ok(offline.offline && offline.uploaded.length === 0, 'Offline non si carica nulla.');
  assert.equal((await recordsOf('arc.c')).length, COUNT, 'E non si perde nulla.');
  // the bucket fails for some uploads
  local.r2Control.failPut = 7;
  const flaky = await sync.syncLogos();
  assert.ok(flaky.errors.length >= 1 && flaky.pending >= 1, 'Gli errori del bucket sono segnalati e i loghi restano da caricare.');
  const rest = await sync.syncLogos();
  assert.equal(rest.pending, 0, 'Il tentativo successivo li carica.');
  assert.equal(rowsOf('arc.c').length, COUNT); assert.equal(objectsOf('arc.c').length, COUNT, 'Un solo oggetto per logo, senza orfani né duplicati.');
  // the account changes during an import
  const stale = await archive.analyzeLogoArchive(zipFile);
  await assert.rejects(archive.applyLogoImport(stale, { scope: 'altro.account' }), error => error.code === 'scope', 'Se cambia l’account l’importazione non scrive nel catalogo sbagliato.');
  lines.push('spazio esaurito a metà (nuovo tentativo senza duplicati), rete assente, guasti del bucket, cambio di account durante l’importazione');
}

// ---------- 7. a logo deleted here and imported again, the guest scope, the limit ----------
{
  await signIn(D); await wipeDevice(D);
  await logos.saveLogo('ritorno', prepared(png(50, 60, 70, 40)));
  await sync.syncLogos();
  await logos.deleteLogo('ritorno');
  const marker = (await logos.logoStore.all('arc.d')).find(record => record.partyId === 'ritorno');
  assert.ok(marker.deleted && marker.sync?.version, 'Il logo cancellato qui lascia l’indicazione per il cloud.');
  const one = archive.zipStore([{ name: 'manifest.json', bytes: new TextEncoder().encode(JSON.stringify({ format: 'politicando-logos', version: 1, logos: [{ partyId: 'ritorno', file: 'l.png', sha256: await sha(png(50, 60, 70, 40)) }] })) }, { name: 'l.png', bytes: new Uint8Array(png(50, 60, 70, 40)) }]);
  const back = await archive.applyLogoImport(await archive.analyzeLogoArchive(one));
  assert.deepEqual(back.imported, ['ritorno'], 'Un logo cancellato qui può essere importato di nuovo.');
  const rec = (await recordsOf('arc.d')).find(record => record.partyId === 'ritorno');
  assert.ok(rec.sync?.version >= 1 && rec.dirty, 'Riparte dalla versione che il cloud conosce: nessun conflitto.');
  const report2 = await sync.syncLogos();
  assert.equal(report2.conflicts.length, 0); assert.equal(rowsOf('arc.d').length, 1 + 0, 'Online c’è un solo logo.');
  // guest scope: exported and imported, never uploaded
  await signIn(null);
  await logos.saveLogo('ospite-uno', prepared(imageOf(7)));
  const guestZip = await archive.exportLogosZip();
  assert.equal(guestZip.count, 1);
  await wipeDevice({ username: 'arc.d' });
  const guestPlan = await archive.analyzeLogoArchive(guestZip.blob);
  assert.equal(guestPlan.scope, '_ospite');
  const guestDone = await archive.applyLogoImport(guestPlan);
  assert.deepEqual(guestDone.imported, ['ospite-uno']);
  assert.equal((await logos.logoStore.all('_ospite'))[0].dirty, false, 'Da ospite i loghi non sono mai da caricare.');
  assert.equal((await sync.syncLogos()).skipped, true, 'Senza account non si sincronizza.');
  // over the online limit: said before importing
  await signIn(D); await wipeDevice(D);
  const many = [], manyFiles = [];
  for (let n = 1; n <= 152; n++) { const bytes = imageOf(n); manyFiles.push({ name: `l${n}.png`, bytes: new Uint8Array(bytes) }); many.push({ partyId: `tanti-${n}`, file: `l${n}.png`, sha256: await sha(new Uint8Array(bytes)) }); }
  const big = await archive.analyzeLogoArchive(archive.zipStore([{ name: 'manifest.json', bytes: new TextEncoder().encode(JSON.stringify({ format: 'politicando-logos', version: 1, logos: many })) }, ...manyFiles]));
  assert.equal(big.counts.new, 152); assert.equal(big.overLimit, 152, 'Oltre il limite online l’archivio avvisa prima di importare.');
  lines.push('logo cancellato qui e reimportato senza conflitti, ospite mai caricato, avviso oltre il limite online di 150');
}

await signIn(null);
local.close?.();
console.log(`Esportazione e importazione dei loghi: ${lines.join('; ')}.`);
process.exit(0);
