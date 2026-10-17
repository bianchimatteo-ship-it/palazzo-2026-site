// Imports the resident population of the 7,894 current comuni and the 20 regions (1 January 2026) from the CSV files of the ISTAT package of the project (comuni, regioni), into the runtime
// document src/data/real/municipal-population.json. Nothing is fetched from the web and nothing is estimated: if a check fails nothing is written and the problem codes are listed.
//   node scripts/import-istat-comuni-2026.mjs [--dir scripts/data/istat] [--check]
// Provenance (kept in the document): the values come from a public table documented as ISTAT POSAS 2026 (Età=999, Totale); they are NOT a raw copy of the official ZIP checked directly.
// So the document is marked `verified: false` until the comparison with the official file is made. Exit code 1 when a check fails.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir') >= 0 ? args[args.indexOf('--dir') + 1] : null;
const dir = dirArg ? new URL(`${dirArg.replace(/\/?$/, '/')}`, `file://${process.cwd()}/`) : new URL('./data/istat/', import.meta.url);
const check = args.includes('--check');
const real = name => new URL(`../src/data/real/${name}`, import.meta.url);

// A CSV with quoted fields (commas and quotes inside), as the package writes it.
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += char; }
    else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const table = rows => { const [head, ...body] = rows; return body.filter(row => row.some(Boolean)).map(row => Object.fromEntries(head.map((name, index) => [name, row[index] ?? '']))); };
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const SOURCE_ID = 'posas-2026-derivata';
const normal = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function buildDocument({ comuniRows, regioniRows, methodRows = [], municipalities, units, hashes = {}, importedAt }) {
  const problems = [];
  const add = message => { if (problems.length < 200) problems.push(message); };
  const REF = '2026-01-01';
  const expectedHead = ['Codice ISTAT', 'Comune', 'Codice provincia/UTS', 'Provincia/Unità territoriale', 'Codice regione', 'Regione', 'Popolazione residente', 'Data riferimento', 'Fonte', 'Codici record sorgente', 'Metodo di riconciliazione'];
  if (!comuniRows.length || expectedHead.some(name => !(name in comuniRows[0]))) add('intestazione del file dei comuni non riconosciuta');
  const game = new Map(municipalities.map(item => [item.code, item]));
  const unitRegion = new Map(units.map(unit => [unit.code, unit.regionCode]));
  const gameRegionOf = new Map(units.map(unit => [unit.regionCode, unit.gameRegion]));
  const seen = new Map();
  const records = [];
  const nameDiffs = [];
  for (const row of comuniRows) {
    const code = row['Codice ISTAT'];
    if (!/^\d{6}$/.test(code)) { add(`codice ISTAT non valido: «${code}» (${row.Comune})`); continue; }
    if (seen.has(code)) { add(`codice ${code} duplicato (${row.Comune} / ${seen.get(code)})`); continue; }
    seen.set(code, row.Comune);
    if (!/^\d+$/.test(row['Popolazione residente'] ?? '')) { add(`popolazione mancante o non numerica per ${code} ${row.Comune}: «${row['Popolazione residente']}»`); continue; }
    const population = Number(row['Popolazione residente']);
    if (!Number.isSafeInteger(population) || population <= 0) add(`popolazione non positiva per ${code} ${row.Comune}: ${population}`);
    if (row['Data riferimento'] !== REF) add(`data di riferimento diversa da ${REF} per ${code}: ${row['Data riferimento']}`);
    const known = game.get(code);
    if (!known) { add(`codice ${code} (${row.Comune}) non presente nel registro dei comuni correnti del gioco`); continue; }
    if (normal(known.name) !== normal(row.Comune)) nameDiffs.push({ code, game: known.name, file: row.Comune });
    if (known.unit !== row['Codice provincia/UTS']) add(`unità territoriale diversa per ${code} ${row.Comune}: gioco ${known.unit}, file ${row['Codice provincia/UTS']}`);
    const region = unitRegion.get(known.unit);
    if (region && region !== row['Codice regione']) add(`regione diversa per ${code} ${row.Comune}: gioco ${region}, file ${row['Codice regione']}`);
    // Compact on purpose (the document is loaded when the game starts): what is the same for every record (the source) is said once, what is exceptional (a merger, a recoding) is kept per record.
    const stable = row['Metodo di riconciliazione'] === 'Codice ISTAT stabile';
    records.push({
      municipalityCode: code, name: row.Comune, regionCode: row['Codice regione'], populationResident: population, populationReferenceDate: row['Data riferimento'], sourceId: SOURCE_ID,
      ...(stable ? {} : { sourceRecordCodes: row['Codici record sorgente'], reconciliation: row['Metodo di riconciliazione'] })
    });
  }
  for (const code of game.keys()) if (!seen.has(code)) add(`comune corrente ${code} (${game.get(code).name}) senza popolazione nel file`);
  if (comuniRows.length !== municipalities.length) add(`record del file ${comuniRows.length} ≠ comuni correnti del gioco ${municipalities.length}`);
  // the regions: computed from the comuni, compared with the file of the regions
  const byRegion = new Map();
  for (const record of records) { const item = byRegion.get(record.regionCode) ?? { code: record.regionCode, municipalities: 0, populationResident: 0 }; item.municipalities++; item.populationResident += record.populationResident; byRegion.set(record.regionCode, item); }
  const regions = [];
  const given = new Map(regioniRows.filter(row => /^\d{2}$/.test(row['Codice regione ISTAT'])).map(row => [row['Codice regione ISTAT'], row]));
  if (given.size !== 20) add(`regioni nel file: ${given.size}, attese 20`);
  for (const [code, calculated] of [...byRegion].sort(([a], [b]) => a.localeCompare(b))) {
    const row = given.get(code);
    if (!row) { add(`regione ${code} assente dal file delle regioni`); continue; }
    if (Number(row['Popolazione residente totale']) !== calculated.populationResident) add(`totale della regione ${code} ${row.Regione}: file ${row['Popolazione residente totale']}, somma dei comuni ${calculated.populationResident}`);
    if (Number(row['Numero comuni']) !== calculated.municipalities) add(`numero comuni della regione ${code}: file ${row['Numero comuni']}, nei comuni ${calculated.municipalities}`);
    regions.push({ code, name: row.Regione, gameRegion: gameRegionOf.get(code) ?? null, municipalities: calculated.municipalities, populationResident: calculated.populationResident, populationReferenceDate: REF, method: 'Somma dei comuni correnti senza duplicati', source: row.Fonte });
  }
  for (const code of given.keys()) if (!byRegion.has(code)) add(`regione ${code} del file senza comuni`);
  for (const region of regions) if (!region.gameRegion) add(`regione ${region.code} ${region.name} senza corrispondenza nelle regioni del gioco`);
  // the provinces / metropolitan cities / free consortia (the unit of the game's registry): totals from the comuni
  const byUnit = new Map();
  for (const record of records) { const unit = game.get(record.municipalityCode)?.unit; if (!unit) continue; const item = byUnit.get(unit) ?? { code: unit, municipalities: 0, populationResident: 0 }; item.municipalities++; item.populationResident += record.populationResident; byUnit.set(unit, item); }
  const unitRows = [...byUnit.values()].sort((a, b) => a.code.localeCompare(b.code)).map(item => ({ ...item, name: units.find(unit => unit.code === item.code)?.name ?? null, regionCode: unitRegion.get(item.code) ?? null }));
  const total = regions.reduce((sum, region) => sum + region.populationResident, 0);
  const totalRow = regioniRows.find(row => row['Codice regione ISTAT'] === 'TOTALE');
  if (!totalRow || Number(totalRow['Popolazione residente totale']) !== total || Number(totalRow['Numero comuni']) !== records.length) add(`totale nazionale: file ${totalRow?.['Popolazione residente totale']} / ${totalRow?.['Numero comuni']}, calcolato ${total} / ${records.length}`);
  const ok = problems.length === 0 && records.length === 7894 && regions.length === 20;
  const document = {
    id: 'municipal-population', source: 'real', verified: false, verificationStatus: 'derivato-da-tabella-pubblica-non-verificato-su-zip-ufficiale', status: ok ? 'importato' : 'non-importato', importedAt,
    sourceName: 'ISTAT POSAS 2026 — popolazione residente (totale comunale, Età=999), tramite tabella pubblica derivata',
    sourceUrl: 'https://demo.istat.it/app/?a=2026&i=POS&l=it',
    sourceNote: 'I valori derivano da una tabella pubblica documentata come uso del POSAS 2026; NON sono una copia grezza verificata direttamente dallo ZIP ufficiale ISTAT. Prima del rilascio pubblico va fatto il confronto con POSAS_2026_it_Comuni.zip. La popolazione residente non è l’elettorato né la popolazione legale del censimento.',
    license: 'La copia pubblica dichiara CC BY 4.0 con attribuzione a ISTAT; il dataset è trasformato e riconciliato (fusioni e ricodifiche indicate record per record).',
    sources: { [SOURCE_ID]: 'ISTAT POSAS 2026 — copia pubblica derivata; totale Età=999' },
    residentDataset: { title: 'ISTAT — Popolazione residente al 1° gennaio 2026 (totale comunale)', referenceDate: REF, files: hashes },
    legalDataset: null,
    note: 'La fascia elettorale di un comune dipende dal riferimento previsto dalla norma (electoralPopulationReference), non dalla popolazione residente; qui il riferimento legale non è fornito (null) e la fascia resta provvisoria. I votanti simulati non possono superare la popolazione residente dell’area elettorale.',
    totals: { municipalities: records.length, regions: regions.length, populationResident: total, referenceDate: REF },
    regions, units: unitRows, records
  };
  return { document, ok, problems, nameDiffs, total };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const readText = async name => { const buffer = await readFile(new URL(name, dir)); return { text: buffer.toString('utf8').replace(/^﻿/, ''), hash: sha(buffer) }; };
  let comuni, regioni, metodo;
  try { comuni = await readText('COMUNI_POPOLAZIONE_RESIDENTE_2026.csv'); regioni = await readText('REGIONI_POPOLAZIONE_RESIDENTE_2026.csv'); metodo = await readText('FONTI_E_METODO_ISTAT_2026.csv').catch(() => null); }
  catch (error) { console.error(`File dei dati non trovati in ${dir.pathname}: ${error.message}. Importazione BLOCCATA.`); process.exit(2); }
  const municipalities = JSON.parse(await readFile(real('municipalities.json'), 'utf8'));
  const units = JSON.parse(await readFile(real('territorial-units.json'), 'utf8'));
  const result = buildDocument({ comuniRows: table(parseCsv(comuni.text)), regioniRows: table(parseCsv(regioni.text)), methodRows: metodo ? table(parseCsv(metodo.text)) : [], municipalities, units, hashes: { comuni: comuni.hash, regioni: regioni.hash, metodo: metodo?.hash ?? null }, importedAt: new Date().toISOString().slice(0, 10) });
  await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
  const report = { generatedAt: result.document.importedAt, ok: result.ok, comuni: result.document.records.length, regioni: result.document.regions.length, populationResident: result.total, nameDifferences: result.nameDiffs, problems: result.problems };
  await writeFile(new URL('../docs/istat-popolazione-report.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);
  console.log(`Comuni ${report.comuni}, regioni ${report.regioni}, popolazione ${result.total.toLocaleString('it-IT')}; differenze di denominazione a codice stabile: ${result.nameDiffs.length}; problemi: ${result.problems.length}.`);
  if (!result.ok) { console.error(`Controlli NON superati: nulla viene scritto.\n${result.problems.slice(0, 40).join('\n')}`); process.exit(1); }
  if (check) { console.log('Controlli superati (--check: nessun file scritto).'); process.exit(0); }
  await writeFile(real('municipal-population.json'), `${JSON.stringify(result.document)}\n`);
  const manifest = JSON.parse(await readFile(real('manifest.json'), 'utf8'));
  manifest.documents = { ...(manifest.documents ?? {}), municipalPopulation: { file: 'municipal-population.json', records: result.document.records.length, regions: result.document.regions.length, residentReferenceDate: '2026-01-01', legalReferenceDate: null, verified: false, verificationStatus: result.document.verificationStatus, filesSha256: result.document.residentDataset.files } };
  await writeFile(real('manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Scritto src/data/real/municipal-population.json e la voce del manifesto. Rilancia npm run version:build e npm run build:www.');
}
