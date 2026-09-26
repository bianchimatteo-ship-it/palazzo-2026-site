// Imports the real calendar of local and regional elections into src/data/real/local-elections.json:
//   - for every comune found in the official results of the Ministry of the Interior (Eligendo open data, municipal
//     elections from 2020 to 2026), the date of its last election;
//   - for every region, the date of its last regional election (Eligendo open data for the ordinary regions; the
//     regions missing there — Molise, Marche 2025 and the special-statute regions — from the verified sources below).
// The game computes the next vote from here (law 182/1991: a spring round between 15 April and 15 June; the regions
// after five years): the comuni and regions vote in different years, as they really do.
//   node scripts/import-local-calendar.mjs path/to/folder-with-eligendo-zips
// The zips are the files of https://elezionistorico.interno.gov.it/eligendo/opendata.php (downloaded from
// https://dait.interno.gov.it/documenti/opendata/{comunali|regionali}/...). Nothing is typed by hand for the comuni.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { join } from 'node:path';

const folder = process.argv[2];
if (!folder) throw new Error('Indica la cartella con gli archivi zip di Eligendo.');
const real = name => new URL(`../src/data/real/${name}`, import.meta.url);
const VERIFIED_AT = process.env.AS_OF || new Date().toISOString().slice(0, 10);
const SOURCE_URL = 'https://elezionistorico.interno.gov.it/eligendo/opendata.php';

function unzip(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Archivio zip non riconosciuto.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extraLength = buffer.readUInt16LE(offset + 30), commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (!name.endsWith('/')) files.set(name, method === 8 ? inflateRawSync(buffer.subarray(start, start + size)) : buffer.subarray(start, start + size));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
const decodeXml = text => text.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[\da-f]+);/gi, (_, code) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[code.toLowerCase()] ?? String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))));
// Rows of a delimited text file or of the first sheet of an xlsx.
function rowsOf(name, data) {
  if (name.endsWith('.xlsx')) {
    const files = unzip(data);
    const shared = [...(files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(item => decodeXml(item[1])).join(''));
    const sheet = [...files.keys()].find(key => /^xl\/worksheets\/sheet\d+\.xml$/.test(key));
    return [...files.get(sheet).toString('utf8').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(row => [...row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].reduce((cells, [, col, attrs, body]) => {
      const index = [...col].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1;
      const raw = body?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
      cells[index] = /t="s"/.test(attrs) ? shared[Number(raw)] : decodeXml(raw);
      return cells;
    }, []));
  }
  let text = data.toString('utf8');
  if (text.includes('�')) text = data.toString('latin1');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const separator = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/\t/g) ?? []).length ? ';' : '\t';
  return lines.map(line => line.split(separator).map(cell => cell.trim().replace(/^"|"$/g, '')));
}
const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[’'`]/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim();

// ---------- the ISTAT list: region of every comune ----------
const municipalities = JSON.parse(await readFile(real('municipalities.json'), 'utf8'));
const units = JSON.parse(await readFile(real('territorial-units.json'), 'utf8'));
const regionOfUnit = new Map(units.map(unit => [unit.code, unit.region]));
const byName = new Map();
for (const item of municipalities) {
  const region = key(regionOfUnit.get(item.unit));
  for (const name of String(item.name).split('/')) byName.set(`${region}|${key(name)}`, item.code);
}

// ---------- the Eligendo archives ----------
const lastVote = new Map();
const unmatched = new Set();
const regionVotes = new Map();
const REGIONS = ['PIEMONTE', 'VALLE D AOSTA', 'LOMBARDIA', 'TRENTINO ALTO ADIGE', 'VENETO', 'FRIULI VENEZIA GIULIA', 'LIGURIA', 'EMILIA ROMAGNA', 'TOSCANA', 'UMBRIA', 'MARCHE', 'LAZIO', 'ABRUZZO', 'MOLISE', 'CAMPANIA', 'PUGLIA', 'BASILICATA', 'CALABRIA', 'SICILIA', 'SARDEGNA'];
const archives = (await readdir(folder)).filter(name => /^(comunali|regionali)-\d{8}\.zip$/.test(name)).sort();
for (const archive of archives) {
  const [, kind, stamp] = archive.match(/^(comunali|regionali)-(\d{8})/);
  const date = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
  const files = unzip(await readFile(join(folder, archive)));
  for (const [name, data] of files) {
    if (/sez|preferenz/i.test(name) && kind === 'regionali') continue;
    if (!/\.(txt|csv|xlsx)$/i.test(name)) continue;
    const rows = rowsOf(name, data);
    const header = rows.findIndex(row => row.some(cell => key(cell) === 'COMUNE') && row.some(cell => /^(REG|.*REGIONE.*)$/.test(key(cell))));
    if (kind === 'regionali') {
      // Which regions voted on that day (the column of the region, or the region in the name of the file).
      const regionHeader = rows.findIndex(row => row.some(cell => /^(REG|.*REGIONE.*)$/.test(key(cell))));
      const column = regionHeader >= 0 ? rows[regionHeader].findIndex(cell => /^(REG|.*REGIONE.*)$/.test(key(cell))) : -1;
      const found = new Set(column >= 0 ? rows.slice(regionHeader + 1).map(row => key(row[column])).filter(value => REGIONS.includes(value)) : []);
      for (const region of REGIONS) if (key(name).includes(region.replace(/ /g, ''))) found.add(region);
      if (key(name).includes('TOSCANA')) found.add('TOSCANA');
      for (const region of found) if (!regionVotes.has(region) || regionVotes.get(region) < date) regionVotes.set(region, date);
      continue;
    }
    if (header < 0) continue;
    const columns = rows[header].map(key);
    const regionColumn = columns.findIndex(cell => cell === 'REGIONE' || cell === 'DESCREGIONE');
    const comuneColumn = columns.findIndex(cell => cell === 'COMUNE' || cell === 'DESCCOMUNE');
    for (const row of rows.slice(header + 1)) {
      const region = key(row[regionColumn]);
      const comune = key(row[comuneColumn]);
      if (!region || !comune) continue;
      const code = byName.get(`${region}|${comune}`);
      if (!code) { unmatched.add(`${region}|${comune}`); continue; }
      if (!lastVote.has(code) || lastVote.get(code) < date) lastVote.set(code, date);
    }
  }
}

// ---------- regions missing from the Eligendo archives: verified sources ----------
const VERIFIED_REGIONS = {
  MARCHE: { date: '2025-09-28', sourceUrl: 'https://www.regione.marche.it/News-ed-Eventi/Post/112635/ELEZIONI-REGIONALI-MARCHE-2025-FRANCESCO-ACQUAROLI-CONFERMATO-PRESIDENTE-LE-DICHIARAZIONI', sourceName: 'Regione Marche — elezioni regionali del 28-29 settembre 2025' },
  MOLISE: { date: '2023-06-25', sourceUrl: 'https://it.wikipedia.org/wiki/Elezioni_regionali_in_Molise_del_2023', sourceName: 'Elezioni regionali in Molise del 25-26 giugno 2023' },
  SICILIA: { date: '2022-09-25', sourceUrl: 'https://it.wikipedia.org/wiki/Elezioni_regionali_in_Sicilia_del_2022', sourceName: 'Elezioni regionali in Sicilia del 25 settembre 2022' },
  SARDEGNA: { date: '2024-02-25', sourceUrl: 'https://pagellapolitica.it/articoli/guida-elezioni-regionali-sardegna', sourceName: 'Elezioni regionali in Sardegna del 25 febbraio 2024' },
  'FRIULI VENEZIA GIULIA': { date: '2023-04-02', sourceUrl: 'https://en.wikipedia.org/wiki/2023_Friuli-Venezia_Giulia_regional_election', sourceName: 'Elezioni regionali in Friuli-Venezia Giulia del 2-3 aprile 2023' },
  'TRENTINO ALTO ADIGE': { date: '2023-10-22', sourceUrl: 'https://en.wikipedia.org/wiki/2023_Italian_regional_elections', sourceName: 'Elezioni provinciali di Trento e Bolzano del 22 ottobre 2023' },
  'VALLE D AOSTA': { date: '2025-09-28', sourceUrl: 'https://it.wikipedia.org/wiki/Elezioni_amministrative_in_Italia_del_2025', sourceName: 'Elezioni regionali in Valle d’Aosta del 28 settembre 2025' }
};
const regionName = new Map(units.map(unit => [key(unit.gameRegion ?? unit.region), unit.gameRegion ?? unit.region]));
const regions = REGIONS.map(region => {
  const eligendo = regionVotes.get(region);
  const verified = VERIFIED_REGIONS[region];
  const date = [eligendo, verified?.date].filter(Boolean).sort().at(-1) ?? null;
  const fromEligendo = date && date === eligendo;
  return { region: regionName.get(region) ?? region, lastElection: date, sourceUrl: fromEligendo ? SOURCE_URL : verified?.sourceUrl ?? null, sourceName: fromEligendo ? 'Ministero dell’Interno — Eligendo, open data elezioni regionali' : verified?.sourceName ?? null };
});
const missing = regions.filter(item => !item.lastElection);
if (missing.length) throw new Error(`Regioni senza data: ${missing.map(item => item.region).join(', ')}`);

// The comuni grouped by the date of their last election (a compact file).
const byDate = {};
for (const [code, date] of [...lastVote.entries()].sort()) (byDate[date] ??= []).push(code);
const document = {
  id: 'local-elections', source: 'real', verified: true, verifiedAt: VERIFIED_AT, sourceUrl: SOURCE_URL,
  sourceName: 'Ministero dell’Interno — Eligendo, open data delle elezioni comunali (2020-2026) e regionali',
  rule: { comuni: 'Legge 7 giugno 1991, n. 182: turno ordinario tra il 15 aprile e il 15 giugno; se il mandato scade nel secondo semestre, nel turno dell’anno successivo.', regioni: 'Mandato di cinque anni.', sourceUrl: 'https://www.consiglioregionale.calabria.it/upload/istruttoria/l%20182_91.pdf' },
  regions, municipalities: byDate,
  coverage: { comuni: lastVote.size, unmatched: unmatched.size, note: 'I comuni non presenti negli archivi (in particolare quelli delle regioni che gestiscono da sé le elezioni comunali) ricevono nel gioco un anno di voto simulato.' }
};
await writeFile(real('local-elections.json'), `${JSON.stringify(document, null, 1)}\n`);
const manifest = JSON.parse(await readFile(real('manifest.json'), 'utf8'));
manifest.documents = { ...(manifest.documents ?? {}), localElections: { file: 'local-elections.json', comuni: lastVote.size, regions: regions.length, verifiedAt: VERIFIED_AT } };
await writeFile(real('manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Calendario locale: ${lastVote.size} comuni con la data dell’ultimo voto (${unmatched.size} nomi non abbinati), ${regions.length} regioni.`);
for (const item of regions) console.log(`  ${item.region}: ${item.lastElection}`);
