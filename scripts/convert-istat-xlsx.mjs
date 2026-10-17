// Derives the CSV files of the ISTAT population package from the Excel workbook that came with it (sheets «Comuni», «Regioni», «Fonti e metodo»), reading only that file: no network, nothing
// completed or estimated. The CSV layout is the one of the package (COMUNI_POPOLAZIONE_RESIDENTE_2026.csv, REGIONI_POPOLAZIONE_RESIDENTE_2026.csv) so that the importer reads the same files if the
// originals are supplied. Usage: node scripts/convert-istat-xlsx.mjs <file.xlsx> [outDir]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzip } from './lib/istat-population.mjs';

const [file, outDir = new URL('./data/istat/', import.meta.url).pathname] = process.argv.slice(2);
if (!file) { console.error('Uso: node scripts/convert-istat-xlsx.mjs <file.xlsx> [cartella]'); process.exit(2); }
const buffer = await readFile(file);
const files = unzip(buffer);
const text = name => files.get(name)?.toString('utf8') ?? '';
const entities = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const shared = [...text('xl/sharedStrings.xml').matchAll(/<x:si>([\s\S]*?)<\/x:si>/g)].map(match => entities(match[1].replace(/<[^>]+>/g, '')));
const columnOf = ref => [...ref.match(/^[A-Z]+/)[0]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
function sheet(number) {
  const xml = text(`xl/worksheets/sheet${number}.xml`);
  return [...xml.matchAll(/<x:row[^>]*>([\s\S]*?)<\/x:row>/g)].map(rowMatch => {
    const cells = [];
    for (const cell of rowMatch[1].matchAll(/<x:c ([^>]*?)(?:\/>|>([\s\S]*?)<\/x:c>)/g)) {
      const attrs = cell[1], body = cell[2] ?? '';
      const ref = attrs.match(/r="([A-Z]+\d+)"/)[1], type = attrs.match(/t="(\w+)"/)?.[1];
      const value = body.match(/<x:v>([\s\S]*?)<\/x:v>/)?.[1], inline = body.match(/<x:is>([\s\S]*?)<\/x:is>/)?.[1];
      cells[columnOf(ref)] = type === 's' && value !== undefined ? shared[Number(value)] : inline !== undefined ? entities(inline.replace(/<[^>]+>/g, '')) : value !== undefined ? entities(value) : '';
    }
    return Array.from(cells, item => item ?? '');
  });
}
const csv = rows => rows.map(row => row.map(value => /[",\n;]/.test(value) ? `"${String(value).replace(/"/g, '""')}"` : String(value)).join(',')).join('\n') + '\n';
await mkdir(outDir, { recursive: true });
const comuni = sheet(2), regioni = sheet(3), fonti = sheet(4);
await writeFile(`${outDir}/COMUNI_POPOLAZIONE_RESIDENTE_2026.csv`, csv(comuni));
await writeFile(`${outDir}/REGIONI_POPOLAZIONE_RESIDENTE_2026.csv`, csv(regioni));
await writeFile(`${outDir}/FONTI_E_METODO_ISTAT_2026.csv`, csv(fonti));
await writeFile(`${outDir}/ORIGINE.json`, `${JSON.stringify({ derivedFrom: file.split('/').pop(), xlsxSha256: createHash('sha256').update(buffer).digest('hex'), sheets: { Comuni: comuni.length - 1, Regioni: regioni.length - 1, 'Fonti e metodo': fonti.length - 1 }, note: 'CSV derivati dal solo foglio Excel allegato: il pacchetto CSV originale e il LEGGIMI non erano nel filesystem. Nessun valore aggiunto, stimato o corretto.' }, null, 1)}\n`);
console.log(`Comuni ${comuni.length - 1}, regioni ${regioni.length - 1}, voci di metodo ${fonti.length - 1} → ${outDir}`);
