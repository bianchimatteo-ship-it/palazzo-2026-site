// Imports the MEF "2 per mille" table (declarations 2025, income 2024): valid choices and amounts per party.
// The official export is a small PDF: its text is read straight from the page streams, nothing is inferred.
// Writes src/data/real/two-per-thousand.json and registers the collection in manifest.json.
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

const SOURCE_URL = 'https://www1.finanze.gov.it/finanze/2xmille/public/index.php?aggiornato=1522252800&export=1&page=1&tree=2025AADUEXM0101';
const SOURCE_NAME = 'Ministero dell’Economia e delle Finanze — 2 per mille, dichiarazioni 2025/redditi 2024';
const VERIFIED_AT = process.env.AS_OF || new Date().toISOString().slice(0, 10);
const normal = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]/g, '');
const integer = text => Number(text.replace(/\./g, ''));
const percent = text => Number(text.replace('%', '').replace(',', '.'));

const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`MEF ${response.status}`);
const pdf = Buffer.from(await response.arrayBuffer());
const lines = [];
for (const match of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  let text;
  try { text = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { continue; }
  const rows = new Map();
  for (const cell of text.matchAll(/([\d.]+) ([\d.]+) Td \[\((.*?)\)\] TJ ET/g)) {
    const y = Math.round(Number(cell[2]));
    rows.set(y, [...(rows.get(y) ?? []), [Number(cell[1]), cell[3].replace(/\\(.)/g, '$1')]]);
  }
  for (const y of [...rows.keys()].sort((a, b) => b - a)) lines.push(rows.get(y).sort((a, b) => a[0] - b[0]).map(([, value]) => value.trim()));
}
const rows = lines.filter(cells => cells.length === 5 && /^[\d.]+$/.test(cells[1]) && /^[\d.]+$/.test(cells[4]) && /%$/.test(cells[3]) && cells[0] !== 'TOTALE');
const total = lines.find(cells => cells[0] === 'TOTALE');
if (rows.length < 20 || !total) throw new Error(`Tabella MEF non riconosciuta (${rows.length} righe).`);

const dir = new URL('../src/data/real/', import.meta.url);
const [parties, movements] = await Promise.all(['parties.json', 'political-movements.json'].map(async file => JSON.parse(await readFile(new URL(file, dir), 'utf8'))));
const catalog = [...parties.map(item => ({ ...item, collection: 'parties' })), ...movements.map(item => ({ ...item, collection: 'politicalMovements' }))];
const records = rows.map(([name, choices, onTaxpayers, onChoices, amount]) => {
  // Only an exact match of the official name (ignoring accents, case and punctuation) links a row to a dataset entity.
  const entity = catalog.find(item => normal(item.officialName) === normal(name)) ?? null;
  return {
    id: `due-per-mille-2025-${entity?.id ?? normal(name)}`, partyId: entity?.id ?? null, collection: entity?.collection ?? null,
    nameInSource: name, declarationYear: 2025, incomeYear: 2024,
    validChoices: integer(choices), shareOfTaxpayers: percent(onTaxpayers), shareOfChoices: percent(onChoices), amountEuro: integer(amount),
    source: 'real', verified: true, sourceUrl: SOURCE_URL, sourceName: SOURCE_NAME, verifiedAt: VERIFIED_AT, validFrom: '2025-01-01', validTo: null
  };
}).sort((a, b) => b.validChoices - a.validChoices);
const unmatched = records.filter(item => !item.partyId).map(item => item.nameInSource);
if (unmatched.length) console.warn(`Senza corrispondenza nel dataset: ${unmatched.join(', ')}`);

const manifestUrl = new URL('manifest.json', dir);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.collections = { ...manifest.collections, twoPerThousand: records.length };
manifest.twoPerThousandTotals = { declarationYear: 2025, validChoices: integer(total[1]), amountEuro: integer(total[4]) };
await writeFile(new URL('two-per-thousand.json', dir), JSON.stringify(records, null, 2) + '\n');
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Importati ${records.length} partiti dal 2×1000 2025 (${records.length - unmatched.length} collegati al dataset).`);
