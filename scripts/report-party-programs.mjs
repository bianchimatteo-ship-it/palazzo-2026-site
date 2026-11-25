// Writes, from the data of the game (data/party-programs.js and the records of data/real/parties.json and political-movements.json), the matrix of the 82 records and the list of the gaps:
//   · docs/qa/programmi-partiti-da-completare.md — for every record: what it is (national, regional, historical, movement, alias, to verify), the state of its programme, the themes documented, the
//     themes still without a documented position, and an outline for the owner to fill them;
//   · src/data/real/party-program-sources.json — the documents and the catalogue as data (documentation: the game reads data/party-programs.js).
// `--check` only verifies that both files are up to date.
import { readFile, writeFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const D = await import(new URL(`../src/data/party-programs.js?v=${build}`, import.meta.url).href);
const { THEMES } = await import(new URL(`../src/core/alliance-rules.js?v=${build}`, import.meta.url).href);
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const movements = JSON.parse(await readFile(new URL('../src/data/real/political-movements.json', import.meta.url), 'utf8'));
const records = [...parties.map(item => ({ ...item, file: 'parties.json' })), ...movements.map(item => ({ ...item, file: 'political-movements.json' }))];
const KIND = { nazionale: 'nazionale', regionale: 'regionale', 'italiani-estero': 'italiani all’estero', movimento: 'movimento', storico: 'storico', alias: 'alias', 'da-verificare': 'da verificare' };
const STATUS = { documentato: 'documentato', parziale: 'documentato in parte', 'senza-posizioni': 'documenti senza posizioni verificabili', 'in-elaborazione': 'in elaborazione' };
const rows = records.map(record => {
  const entry = D.PARTY_CATALOG[record.id] ?? { kind: 'da-verificare' };
  const program = D.DOCUMENTED_PROGRAMS[D.canonicalPartyId(record.id)] ?? null;
  const documented = THEMES.filter(theme => Number.isFinite(program?.themes?.[theme.id]?.value)).map(theme => theme.id);
  const missing = THEMES.map(theme => theme.id).filter(id => !documented.includes(id));
  return { id: record.id, name: record.officialName, file: record.file, datasetStatus: record.status ?? null, kind: entry.kind, note: entry.note ?? null, aliasOf: entry.aliasOf ?? null, programStatus: entry.aliasOf ? 'vedi record canonico' : program ? program.status : 'nessuna fonte nel dossier', documents: program?.documents ?? [], documented, missing: entry.aliasOf ? [] : missing };
});
const counts = rows.reduce((acc, row) => { acc[row.kind] = (acc[row.kind] ?? 0) + 1; return acc; }, {});
const md = [`# Programmi dei partiti — matrice e lacune da completare`, '',
  `Generato da \`scripts/report-party-programs.mjs\` dai dati del gioco (\`src/data/party-programs.js\`), ${D.RETRIEVED_AT}. Fonti: dossier del titolare \`docs/qa/dossier_programmi_partiti_v2_2026-11-24.md\` e lettura diretta delle pagine ufficiali dove possibile (colonna «lettura» dei documenti).`, '',
  `**Record:** ${records.length} (${parties.length} in \`parties.json\`, ${movements.length} in \`political-movements.json\`) · ${Object.entries(counts).map(([k, n]) => `${KIND[k] ?? k} ${n}`).join(' · ')}.`, '',
  'Regole: una posizione numerica c’è solo se un documento del partito indica una direzione sul tema; altrimenti il tema resta **non documentato** (`null`). Il gioco usa per la partita una *stima simulata* dalla collocazione generale, sempre etichettata come tale, mai come posizione del partito. I programmi di coalizione restano entità distinte (il tavolo del centrosinistra del 7/11/2026 è *in elaborazione*).', '',
  '## Documenti usati', '', '| Documento | Tipo | Data | Ambito | Stato | Lettura |', '|---|---|---|---|---|---|',
  ...Object.values(D.DOCUMENTS).map(doc => `| [${doc.title}](${doc.url}) | ${doc.type} | ${doc.date ?? '—'} | ${doc.scope} | ${doc.status} | ${doc.read} |`), '',
  '## Matrice dei record', '', '| Record | Tipo | Programma | Temi documentati | Note |', '|---|---|---|---|---|',
  ...rows.map(row => `| ${row.name} (\`${row.id}\`) | ${KIND[row.kind] ?? row.kind}${row.datasetStatus ? ` · dataset: ${row.datasetStatus}` : ''} | ${row.aliasOf ? `alias di \`${row.aliasOf}\`` : STATUS[row.programStatus] ?? row.programStatus} | ${row.documented.length ? `${row.documented.length}/10: ${row.documented.join(', ')}` : '0/10'} | ${row.note ?? ''} |`), '',
  '## Lacune da completare (traccia per la compilazione)', '',
  'Per ogni tema mancante servono: testo del documento ufficiale (o pagina tematica), titolo, data, URL, tipo (programma approvato, manifesto, proposte, coalizione…), ambito (nazionale/regionale/europeo) e la direzione sulla scala del gioco con una motivazione. I partiti storici o regionali vanno compilati con documenti del loro tempo o territorio.', '',
  ...rows.filter(row => !row.aliasOf && row.missing.length).map(row => `- **${row.name}** (${KIND[row.kind] ?? row.kind}) — mancano ${row.missing.length === 10 ? 'tutti i dieci temi' : row.missing.join(', ')}${row.documents.length ? `; documenti già noti: ${row.documents.map(id => D.DOCUMENTS[id]?.title).join('; ')}` : ''}.`), ''].join('\n');
const json = JSON.stringify({ generatedBy: 'scripts/report-party-programs.mjs', retrievedAt: D.RETRIEVED_AT, note: 'Documentazione: i programmi del gioco sono in src/data/party-programs.js; qui documenti e catalogo dei 82 record.', documents: D.DOCUMENTS, coalitions: D.COALITION_PROGRAMS, records: rows }, null, 2) + '\n';
// the numbers the first screen needs (core/alliance-rules.js): value, confidence and document of each documented theme, the state of each programme, the aliases — nothing else
const compact = Object.fromEntries(Object.entries(D.DOCUMENTED_PROGRAMS).map(([id, program]) => [id, { status: program.status, themes: Object.fromEntries(Object.entries(program.themes).filter(([, item]) => Number.isFinite(item.value)).map(([theme, item]) => [theme, [item.value, item.confidence[0]]])) }]));
const aliases = Object.fromEntries(Object.entries(D.PARTY_CATALOG).filter(([, entry]) => entry.aliasOf).map(([id, entry]) => [id, entry.aliasOf]));
const valuesJs = `// GENERATED by scripts/report-party-programs.mjs from data/party-programs.js (the texts load with the alliances page).
export const PROGRAM_VALUES = Object.freeze(${JSON.stringify(compact)});
export const PARTY_ALIASES = Object.freeze(${JSON.stringify(aliases)});
let texts = null;
export const registerProgramTexts = value => { texts = value; };
export const programTexts = () => texts;
export const canonicalPartyId = id => PARTY_ALIASES[id] ?? id;
const view = id => { const values = PROGRAM_VALUES[id]; if (!values) return null; const full = texts?.programs?.[id]; return full ?? { status: values.status, documents: [], themes: Object.fromEntries(Object.entries(values.themes).map(([theme, [value, c]]) => [theme, { value, confidence: { a: 'alta', m: 'media', b: 'bassa' }[c] }])) }; };
export const documentedProgramOf = party => view(canonicalPartyId(party?.id)) ?? (party?.mergedFrom ?? []).map(id => view(canonicalPartyId(id))).find(Boolean) ?? null;
export const documentOf = id => texts?.documents?.[id] ?? null;
`;
const valuesPath = new URL('../src/data/party-program-values.js', import.meta.url);
const mdPath = new URL('../docs/qa/programmi-partiti-da-completare.md', import.meta.url), jsonPath = new URL('../src/data/real/party-program-sources.json', import.meta.url);
if (process.argv.includes('--check')) {
  const [a, b, c] = await Promise.all([readFile(mdPath, 'utf8').catch(() => ''), readFile(jsonPath, 'utf8').catch(() => ''), readFile(valuesPath, 'utf8').catch(() => '')]);
  if (a !== md || b !== json || c.replace(/\?v=[^'"]+/g, '') !== valuesJs.replace(/\?v=[^'"]+/g, '')) { console.error('Matrice dei programmi non aggiornata: esegui node scripts/report-party-programs.mjs'); process.exit(1); }
  console.log('Matrice dei programmi aggiornata.');
} else {
  await writeFile(mdPath, md); await writeFile(jsonPath, json); await writeFile(valuesPath, valuesJs);
  console.log(`Programmi: ${rows.length} record, ${rows.filter(row => row.documented.length).length} con temi documentati, ${rows.filter(row => !row.aliasOf && row.missing.length).length} con lacune.`);
}
