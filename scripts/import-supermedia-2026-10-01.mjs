// The Supermedia YouTrend/Agi of 1 October 2026 as the opening poll of the new realistic careers (the one of 24 September stays in the file as history).
// Source: https://www.youtrend.it/2026/10/07/supermedia-youtrend-agi-il-pd-scende-al-204/ — the figures below are the ones of the table of that article as given to the project; the page could not
// be re-read from the environment that built this file, so `verificationNote` says so. Three dates stay apart: the reference date of the Supermedia (referenceDate, 2026-10-01), the window of the
// polls it averages (fieldworkFrom/To) and the publication of the article (publishedAt, 2026-10-07); `verifiedAt` is the day the project recorded the figures.
// The twelve forces add up to 96.6%: "Altri" is the rest (3.4), as the source leaves it, never a force of its own. The variations are the ones the source published (against its previous
// Supermedia), not a difference with the 24 September file. Run: node scripts/import-supermedia-2026-10-01.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { writeDataVersion } from './lib/data-version.mjs';

const dir = fileURLToPath(new URL('../src/data/real/', import.meta.url));
const ROWS = [
  ['Fratelli d’Italia', 'party-registro-p1-2014-04-ir', 26.8, 0.2], ['Partito Democratico', 'party-registro-p1-2015-29-ir', 20.4, -0.7], ['Movimento 5 Stelle', 'party-registro-p1-2022-63-ir', 12.8, 0.3],
  ['Futuro Nazionale', 'party-futuro-nazionale', 7.7, 0], ['Forza Italia', 'party-registro-p1-2015-20-ir', 7.4, 0], ['Alleanza Verdi e Sinistra', 'coalition-alleanza-verdi-sinistra', 6.3, -0.1],
  ['Lega', 'party-registro-p1-2017-41-ir', 5.7, 0.1], ['Azione', 'party-registro-p1-2019-51-ir', 3.2, -0.1], ['Italia Viva', 'party-registro-p1-2019-52-ir', 2.2, -0.1],
  ['+Europa', 'party-registro-p1-2018-47-ir', 1.7, 0.2], ['Partito Liberaldemocratico', 'party-registro-p1-2024-74-ir', 1.3, -0.1], ['Noi Moderati', 'party-registro-p1-2020-56-ir', 1.1, 0]
];
const total = Math.round(ROWS.reduce((sum, row) => sum + row[2], 0) * 10) / 10;
if (total !== 96.6) throw new Error(`Le dodici forze sommano ${total}, non 96,6.`);
const record = {
  id: 'poll-supermedia-youtrend-agi-2026-10-01', kind: 'supermedia', label: 'Supermedia YouTrend/Agi',
  referenceDate: '2026-10-01', publishedAt: '2026-10-07', fieldworkFrom: '2026-09-17', fieldworkTo: '2026-09-30',
  method: 'Media ponderata dei sondaggi nazionali sulle intenzioni di voto (per numerosità del campione, data di realizzazione e metodo di raccolta)',
  includedPolls: null,
  results: ROWS.map(([label, entityId, share, delta]) => ({ label, entityId, share, delta })),
  others: Math.round((100 - total) * 10) / 10, othersNote: 'Altri: 100 meno la somma delle dodici forze indicate dalla fonte (96,6): non è un dato che la fonte pubblichi esplicitamente',
  deltaNote: 'Variazioni come pubblicate dalla fonte rispetto alla sua Supermedia precedente; non sono la differenza con la rilevazione del 24/09/2026 conservata nello storico',
  coalitions: null,
  source: 'real', verified: true,
  sourceUrl: 'https://www.youtrend.it/2026/10/07/supermedia-youtrend-agi-il-pd-scende-al-204/', sourceName: 'YouTrend — Supermedia YouTrend/Agi del 1° ottobre 2026 (articolo del 7 ottobre)',
  verifiedAt: '2026-10-14', verificationNote: 'Valori trascritti dalla tabella dell’articolo indicata dal committente del progetto; la pagina non era raggiungibile dall’ambiente di lavoro e non è stata riletta: da riconfermare alla prima occasione.',
  validFrom: '2026-10-01', validTo: null
};
const pollsPath = `${dir}polls.json`;
const polls = JSON.parse(await readFile(pollsPath, 'utf8')).filter(item => item.id !== record.id);
polls.push(record);
polls.sort((a, b) => String(a.referenceDate ?? a.publishedAt).localeCompare(String(b.referenceDate ?? b.publishedAt)));
await writeFile(pollsPath, `${JSON.stringify(polls, null, 2)}\n`);
for (const file of ['manifest.json', 'database.json']) {
  const path = `${dir}${file}`;
  const json = JSON.parse(await readFile(path, 'utf8'));
  const manifest = file === 'manifest.json' ? json : json.manifest;
  if (!manifest) continue;
  // database.json is the build-time snapshot of the registries: it holds no polls, so it carries no poll count.
  if (file === 'manifest.json') manifest.collections.realPolls = polls.length;
  manifest.datasetVersion = '2026-10-14.1';
  manifest.pollsNote = 'Sondaggi reali: Supermedia del 24/09/2026 (storico) e del 01/10/2026 (apertura delle nuove carriere realistiche, articolo del 07/10/2026).';
  await writeFile(path, `${JSON.stringify(json, null, 2)}\n`);
}
console.log(`Supermedia del 01/10/2026 registrata: dodici forze (${total}%), Altri ${record.others}%, ${polls.length} sondaggi reali nel file.`);
console.log(`Dati reali: versione ${(await writeDataVersion()).version}.`);
