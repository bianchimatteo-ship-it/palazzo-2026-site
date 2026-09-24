// Imports the official ISTAT list of Italian municipalities (“Elenco dei comuni italiani”, update of 21 February 2026:
// 7,894 comuni, new territorial units of Sardinia from 1 January 2026) into src/data/real/:
//   territorial-units.json  — regions' supra-municipal units (province, città metropolitane, liberi consorzi, …)
//   municipalities.json     — every comune with its statistical code and unit
// The xlsx is read directly (zip + XML, no dependencies). Nothing is typed by hand; running it again gives the same files.
//   node scripts/import-istat-comuni.mjs [path/to/Elenco-comuni-italiani.xlsx] [--inspect]
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PAGE = 'https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/';
const FILE = 'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx';
const SOURCE_NAME = 'ISTAT — Elenco dei comuni italiani (aggiornamento al 21 febbraio 2026)';
const VALID_FROM = '2026-02-21';
const EXPECTED = 7894;
const VERIFIED_AT = '2026-09-24';
const real = name => new URL(`../src/data/real/${name}`, import.meta.url);

// ---------- xlsx reader: zip central directory + inflate, then the sheet XML ----------
function unzip(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('File xlsx non valido: archivio zip non riconosciuto.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('File xlsx non valido: indice zip danneggiato.');
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extraLength = buffer.readUInt16LE(offset + 30), commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(data) : data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
const decode = text => text.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[\da-f]+);/gi, (_, code) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[code.toLowerCase()] ?? String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))));
const texts = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(match => decode(match[1])).join('');
function readSheet(files, sheetName) {
  const workbook = files.get('xl/workbook.xml').toString('utf8');
  const relations = files.get('xl/_rels/workbook.xml.rels').toString('utf8');
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(([, name, id]) => ({ name: decode(name), id }));
  const sheet = sheets.find(item => sheetName.test(item.name)) ?? sheets[0];
  const target = relations.match(new RegExp(`Id="${sheet.id}"[^>]*Target="([^"]+)"`))?.[1] ?? relations.match(new RegExp(`Target="([^"]+)"[^>]*Id="${sheet.id}"`))?.[1];
  const shared = files.has('xl/sharedStrings.xml') ? [...files.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => texts(match[1])) : [];
  const xml = files.get(`xl/${target.replace(/^\/?xl\//, '')}`).toString('utf8');
  const column = ref => [...ref.replace(/\d+$/, '')].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
  const rows = [];
  for (const [, body] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const [, attributes, content = ''] of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attributes.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attributes.match(/\bt="([^"]+)"/)?.[1];
      const raw = content.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const value = type === 's' ? shared[Number(raw)] : type === 'inlineStr' ? texts(content) : raw === undefined ? '' : decode(raw);
      row[column(ref)] = String(value ?? '').trim();
    }
    rows.push(row);
  }
  return { sheets: sheets.map(item => item.name), name: sheet.name, rows };
}

// ---------- the ISTAT columns ----------
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const HEADERS = {
  regionCode: 'codice regione',
  unitCode: "codice dell'unita territoriale sovracomunale (valida a fini statistici)",
  provinceCode: 'codice provincia (storico)(1)',
  progressive: 'progressivo del comune (2)',
  code: 'codice comune formato alfanumerico',
  nameBoth: 'denominazione (italiana e straniera)',
  name: 'denominazione in italiano',
  alt: 'denominazione altra lingua',
  division: 'codice ripartizione geografica',
  division_name: 'ripartizione geografica',
  region: 'denominazione regione',
  unit: "denominazione dell'unita territoriale sovracomunale (valida a fini statistici)",
  unitType: 'tipologia di unita territoriale sovracomunale',
  capital: 'flag comune capoluogo di provincia/citta metropolitana/libero consorzio',
  sigla: 'sigla automobilistica',
  cadastral: 'codice catastale del comune'
};
const UNIT_TYPES = { 1: 'Provincia', 2: 'Provincia autonoma', 3: 'Città metropolitana', 4: 'Libero consorzio di comuni', 5: 'Unità non amministrativa' };
// Game regions carry the short Italian name (the bilingual official one is kept on the unit).
const gameRegion = name => String(name).split('/')[0].replace(/'/g, '’').trim();

const args = process.argv.slice(2);
const inspect = args.includes('--inspect');
let path = args.find(item => !item.startsWith('--'));
if (!path) {
  const response = await fetch(FILE);
  if (!response.ok) throw new Error(`ISTAT non raggiungibile (${response.status}).`);
  path = join(await mkdtemp(join(tmpdir(), 'istat-')), 'Elenco-comuni-italiani.xlsx');
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}
// The list sheet is named after its update ("CODICI al 21_02_2026"); the other sheets are notes and legend.
const sheet = readSheet(unzip(await readFile(path)), /^CODICI/i);
const headerIndex = sheet.rows.findIndex(row => row.some(cell => norm(cell) === HEADERS.code));
if (headerIndex < 0) throw new Error('Intestazioni ISTAT non riconosciute.');
const header = sheet.rows[headerIndex].map(norm);
if (inspect) {
  console.log('Fogli:', sheet.sheets.join(' | '), '· letto:', sheet.name, '· righe:', sheet.rows.length);
  header.forEach((name, index) => console.log(index, JSON.stringify(name), '→', JSON.stringify(sheet.rows[headerIndex + 1][index])));
  process.exit(0);
}
const at = key => { const index = header.indexOf(HEADERS[key]); if (index < 0 && !['alt', 'nameBoth', 'division', 'division_name', 'provinceCode', 'progressive', 'cadastral'].includes(key)) throw new Error(`Colonna ISTAT mancante: ${HEADERS[key]}`); return index; };
const col = Object.fromEntries(Object.keys(HEADERS).map(key => [key, at(key)]));
const rows = sheet.rows.slice(headerIndex + 1).filter(row => /^\d{6}$/.test(row[col.code] ?? ''));

const units = new Map();
const municipalities = rows.map(row => {
  const unitCode = row[col.unitCode].padStart(3, '0');
  const regionCode = row[col.regionCode].padStart(2, '0');
  const type = UNIT_TYPES[Number(row[col.unitType])] ?? row[col.unitType];
  if (!units.has(unitCode)) units.set(unitCode, { id: `istat-uts-${unitCode}`, code: unitCode, name: row[col.unit], type, sigla: row[col.sigla] || null, regionCode, region: row[col.region], gameRegion: gameRegion(row[col.region]), municipalities: 0, source: 'real', verified: true, sourceUrl: PAGE, sourceName: SOURCE_NAME, fileUrl: FILE, verifiedAt: VERIFIED_AT, validFrom: VALID_FROM, validTo: null });
  units.get(unitCode).municipalities++;
  const alt = col.alt >= 0 && row[col.alt] ? row[col.alt] : null;
  // Compact records (7,894 of them): the full provenance sits on the territorial unit and in the manifest.
  return { id: `istat-${row[col.code]}`, code: row[col.code], name: row[col.name], ...(alt ? { alt } : {}), unit: unitCode, ...(row[col.capital] === '1' ? { capital: true } : {}), source: 'real', verified: true };
});

// ---------- checks before writing ----------
const fail = message => { throw new Error(`Import ISTAT interrotto: ${message}`); };
if (municipalities.length !== EXPECTED) fail(`attesi ${EXPECTED} comuni, trovati ${municipalities.length}`);
if (new Set(municipalities.map(item => item.code)).size !== municipalities.length) fail('codici comune duplicati');
const regions = new Set([...units.values()].map(unit => unit.gameRegion));
if (regions.size !== 20) fail(`attese 20 regioni, trovate ${regions.size}`);
const sardinia = [...units.values()].filter(unit => unit.regionCode === '20');
if (!sardinia.length) fail('unità territoriali della Sardegna mancanti');

const unitList = [...units.values()].sort((a, b) => a.code.localeCompare(b.code));
await writeFile(real('territorial-units.json'), `${JSON.stringify(unitList, null, 2)}\n`);
await writeFile(real('municipalities.json'), `[\n${municipalities.map(item => JSON.stringify(item)).join(',\n')}\n]\n`);
const manifest = JSON.parse(await readFile(real('manifest.json'), 'utf8'));
manifest.collections = { ...manifest.collections, territorialUnits: unitList.length, municipalities: municipalities.length };
manifest.sourceUrls = { ...manifest.sourceUrls, istatMunicipalities: PAGE, istatMunicipalitiesFile: FILE };
manifest.territorialSource = { name: SOURCE_NAME, url: PAGE, file: FILE, validFrom: VALID_FROM, verifiedAt: VERIFIED_AT, municipalities: municipalities.length, territorialUnits: unitList.length, note: 'Codici e denominazioni ISTAT 2026, compreso il nuovo assetto territoriale della Sardegna in vigore dal 1° gennaio 2026.' };
await writeFile(real('manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`ISTAT importato: ${municipalities.length} comuni, ${unitList.length} unità territoriali sovracomunali in ${regions.size} regioni (Sardegna: ${sardinia.map(unit => unit.name).join(', ')}).`);
