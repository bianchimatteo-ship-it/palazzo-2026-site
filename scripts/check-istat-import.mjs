// The importer of the ISTAT package (scripts/import-istat-comuni-2026.mjs) on the real CSV files of the repository and on corrupted copies: the files that came with the project pass (7,894 comuni,
// 20 regions, 58,942,828 residents, no duplicates, no missing values, the regional sums are the sums of the comuni); every kind of damage stops the import and names the codes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildDocument, parseCsv } from './import-istat-comuni-2026.mjs';

const read = async name => (await readFile(new URL(`./data/istat/${name}`, import.meta.url), 'utf8'));
const table = text => { const [head, ...body] = parseCsv(text); return body.filter(row => row.some(Boolean)).map(row => Object.fromEntries(head.map((name, index) => [name, row[index] ?? '']))); };
const municipalities = JSON.parse(await readFile(new URL('../src/data/real/municipalities.json', import.meta.url), 'utf8'));
const units = JSON.parse(await readFile(new URL('../src/data/real/territorial-units.json', import.meta.url), 'utf8'));
const fresh = async () => ({ comuniRows: table(await read('COMUNI_POPOLAZIONE_RESIDENTE_2026.csv')), regioniRows: table(await read('REGIONI_POPOLAZIONE_RESIDENTE_2026.csv')), municipalities, units, importedAt: '2026-10-17' });
const run = input => buildDocument(input);

const ok = run(await fresh());
assert.deepEqual(ok.problems, [], 'I file del progetto superano i controlli.');
assert.equal(ok.document.records.length, 7894); assert.equal(ok.document.regions.length, 20); assert.equal(ok.total, 58942828);
assert.equal(ok.document.verified, false, 'Il dataset non è dichiarato verificato: deriva da una tabella pubblica, non dallo ZIP ufficiale.');
assert.match(ok.document.sourceNote, /NON sono una copia grezza verificata direttamente dallo ZIP ufficiale/, 'La nota sulla provenienza è conservata.');
assert.ok(ok.document.records.every(record => /^\d{6}$/.test(record.municipalityCode) && Number.isInteger(record.populationResident) && record.populationResident > 0 && record.populationReferenceDate === '2026-01-01'), 'Codice come stringa, popolazione intera, data 2026-01-01.');
const merged = ok.document.records.find(record => record.municipalityCode === '018094');
assert.equal(merged.populationResident, 926); assert.match(merged.reconciliation, /Lirio/); assert.equal(merged.sourceRecordCodes, '018094,018082', 'Le fusioni restano tracciate record per record.');

const damage = async (name, change, expected) => {
  const input = await fresh(); change(input);
  const result = run(input);
  assert.equal(result.ok, false, `${name}: l’importazione si ferma.`);
  assert.ok(result.problems.some(problem => expected.test(problem)), `${name}: il problema è nominato (${result.problems.slice(0, 2).join(' | ')}).`);
};
await damage('codice duplicato', input => { input.comuniRows[5]['Codice ISTAT'] = input.comuniRows[4]['Codice ISTAT']; }, /duplicato/);
await damage('popolazione mancante', input => { input.comuniRows[10]['Popolazione residente'] = ''; }, /mancante|non numerica/);
await damage('popolazione non numerica', input => { input.comuniRows[11]['Popolazione residente'] = '12a'; }, /non numerica/);
await damage('popolazione zero', input => { input.comuniRows[12]['Popolazione residente'] = '0'; }, /non positiva/);
await damage('comune del gioco senza dato', input => { input.comuniRows.splice(20, 1); }, /senza popolazione|record del file/);
await damage('codice sconosciuto', input => { input.comuniRows[30]['Codice ISTAT'] = '999999'; }, /non presente nel registro/);
await damage('data diversa', input => { input.comuniRows[40]['Data riferimento'] = '2025-01-01'; }, /data di riferimento/);
await damage('totale regionale che non torna', input => { const row = input.regioniRows.find(item => item['Codice regione ISTAT'] === '09'); row['Popolazione residente totale'] = String(Number(row['Popolazione residente totale']) + 1); }, /totale della regione 09/);
await damage('unità territoriale diversa', input => { input.comuniRows[50]['Codice provincia/UTS'] = '999'; }, /unità territoriale diversa/);
await damage('regione diversa', input => { input.comuniRows[60]['Codice regione'] = '20'; }, /regione diversa|totale della regione/);
console.log('Importazione ISTAT verificata: i file del progetto passano (7.894 comuni, 20 regioni, 58.942.828 residenti, fusioni tracciate, nota sulla provenienza conservata, dataset non dichiarato verificato) e dieci tipi di danno (duplicati, valori mancanti, non numerici, zero, comune senza dato, codice sconosciuto, data, totale regionale, unità, regione) fermano l’importazione nominando il codice.');
