// Imports the population of the Italian comuni from the OFFICIAL ISTAT files, which the person who runs it downloads (nothing is fetched from here and nothing is estimated):
//   node scripts/import-istat-popolazione-comuni.mjs --resident <file.zip|file.csv> [--legal <file.csv>] [--resident-date 2026-01-01] [--legal-date 2021-12-31] [--check]
// - --resident: “Popolazione residente per sesso, età e stato civile al 1° gennaio 2026” (https://demo.istat.it/app/?a=2026&i=POS&l=it, area “Tutti i file”, CSV in ZIP).
// - --legal: the legal population of the census (SITUAS “Unità territoriali / Report Comuni-Dimensione”, popolazione legale 2021 al 31/12/2021, or the table of the results of the permanent
//   census); the file must name the legal population: the resident population of 31/12/2021 is NOT a synonym and is not accepted under this name.
// It joins by the ISTAT code of the comune (src/data/real/municipalities.json), refuses a schema it does not recognise, and writes src/data/real/municipal-population.json, the entry of the
// manifest and a machine-readable report (docs/istat-popolazione-report.json). With --check it only reads and reports. Exit code 1 when a check fails (the data are then not written).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename } from 'node:path';
import { buildPopulation, csvTextOf, readLegal, readResident, sha256 } from './lib/istat-population.mjs';

const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : null; };
const residentFile = option('resident'), legalFile = option('legal'), check = args.includes('--check');
if (!residentFile && !legalFile) {
  console.error('Serve almeno un file ufficiale ISTAT: --resident <popolazione residente.zip|csv> e/o --legal <popolazione legale.csv>.\nI file non vengono scaricati da questo script: scaricali dalle pagine ISTAT indicate nell’intestazione e passali con il loro percorso. Importazione BLOCCATA finché non ci sono.');
  process.exit(2);
}
const real = name => new URL(`../src/data/real/${name}`, import.meta.url);
const today = new Date().toISOString().slice(0, 10);
const read = async file => { const buffer = await readFile(file); return { buffer, text: csvTextOf(buffer, file), hash: sha256(buffer), name: basename(file) }; };
const municipalities = JSON.parse(await readFile(real('municipalities.json'), 'utf8'));
let resident = null, legal = null, residentInfo = null, legalInfo = null;
try {
  if (residentFile) { residentInfo = await read(residentFile); resident = readResident(residentInfo.text); }
  if (legalFile) { legalInfo = await read(legalFile); legal = readLegal(legalInfo.text); }
} catch (error) { console.error(`Import interrotto: ${error.message}`); process.exit(1); }
const meta = {
  importedAt: today, sourceName: 'ISTAT — popolazione dei comuni', sourceUrl: 'https://demo.istat.it/app/?a=2026&i=POS&l=it',
  residentTitle: 'ISTAT — Popolazione residente per sesso, età e stato civile', residentReferenceDate: option('resident-date') ?? '2026-01-01', residentFile: residentInfo?.name, residentHash: residentInfo?.hash, residentUrl: 'https://demo.istat.it/app/?a=2026&i=POS&l=it',
  legalTitle: 'ISTAT — Popolazione legale (censimento permanente)', legalType: 'popolazione legale del censimento', legalReferenceDate: option('legal-date') ?? '2021-12-31', legalFile: legalInfo?.name, legalHash: legalInfo?.hash,
  legalRuleSource: 'D.Lgs. 267/2000, art. 37; risultati del censimento ufficiale (ISTAT)'
};
const { document, report, ok } = buildPopulation({ municipalities, resident, legal, meta });
await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/istat-popolazione-report.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);
console.log(`Comuni del gioco: ${report.comuniInGame}. Residenti: ${report.resident ? `${report.resident.matched} abbinati (${report.coverage.resident}%), somma ${report.resident.sum.toLocaleString('it-IT')}` : 'non forniti'}. Popolazione legale: ${report.legal ? `${report.legal.matched} abbinati (${report.coverage.legal}%)` : 'non fornita (resta null: la fascia elettorale usa il ripiego dichiarato)'}. Codici non abbinati: ${report.unmatchedCodes.length}. Problemi: ${report.problems.length}.`);
if (!ok) { console.error('Controlli NON superati: i dati non vengono scritti. Vedi docs/istat-popolazione-report.json.'); process.exit(1); }
if (check) { console.log('Controlli superati (--check: nessun file scritto).'); process.exit(0); }
await writeFile(real('municipal-population.json'), `${JSON.stringify(document, null, 1)}\n`);
const manifest = JSON.parse(await readFile(real('manifest.json'), 'utf8'));
manifest.documents = { ...(manifest.documents ?? {}), municipalPopulation: { file: 'municipal-population.json', records: document.records.length, residentReferenceDate: meta.residentReferenceDate, legalReferenceDate: legal ? meta.legalReferenceDate : null, residentHash: meta.residentHash ?? null, legalHash: meta.legalHash ?? null, importedAt: today } };
await writeFile(real('manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Scritto src/data/real/municipal-population.json (${document.records.length} comuni). Rilancia npm run version:build e npm run build:www.`);
