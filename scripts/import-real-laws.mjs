// Imports real bills and laws of the XIX legislature from the Senate open data (SPARQL).
// Only fields published by the source are kept, with their original wording; nothing is inferred.
// Writes src/data/real/laws.json and registers the collection in manifest.json.
import { readFile, writeFile } from 'node:fs/promises';

const ENDPOINT = 'https://dati.senato.it/sparql';
const VERIFIED_AT = process.env.AS_OF || new Date().toISOString().slice(0, 10);
const STATES = ['appr. definit. Legge', "all'esame assemblea", 'approvato'];
const SOURCE_NAME = 'Senato della Repubblica — dati.senato.it, disegni di legge';

async function sparql(query) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('query', query);
  const response = await fetch(url, { headers: { accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`SPARQL ${response.status}`);
  return (await response.json()).results.bindings;
}
const value = (row, key) => row?.[key]?.value ?? null;

const rows = await sparql(`PREFIX osr: <http://dati.senato.it/osr/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?idFase ?idDdl ?fase ?titolo ?stato ?ramo ?dataPres ?dataStato ?numeroLegge ?dataLegge ?natura ?iniziativa ?camera WHERE {
  ?ddl a osr:Ddl ; osr:legislatura 19 ; osr:idFase ?idFase ; osr:idDdl ?idDdl ; osr:fase ?fase ; osr:titolo ?titolo ; osr:statoDdl ?stato ; osr:ramo ?ramo ; osr:dataPresentazione ?dataPres .
  OPTIONAL { ?ddl osr:dataStatoDdl ?dataStato } OPTIONAL { ?ddl osr:numeroLegge ?numeroLegge } OPTIONAL { ?ddl osr:dataLegge ?dataLegge }
  OPTIONAL { ?ddl osr:natura ?natura } OPTIONAL { ?ddl osr:descrIniziativa ?iniziativa } OPTIONAL { ?ddl owl:sameAs ?camera }
  FILTER(STR(?stato) IN (${STATES.map(state => JSON.stringify(state)).join(", ")}))
}`);
const topics = await sparql(`PREFIX osr: <http://dati.senato.it/osr/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?idFase ?label WHERE {
  ?ddl a osr:Ddl ; osr:legislatura 19 ; osr:idFase ?idFase ; osr:statoDdl ?stato ; osr:classificazione ?c .
  ?c osr:livello ?livello ; dcterms:subject ?t . ?t skos:prefLabel ?label . FILTER(STR(?livello) = "Generale")
  FILTER(STR(?stato) IN (${STATES.map(state => JSON.stringify(state)).join(", ")}))
}`);
const topicsByPhase = new Map();
for (const row of topics) {
  const id = value(row, 'idFase');
  topicsByPhase.set(id, [...new Set([...(topicsByPhase.get(id) ?? []), value(row, 'label')])]);
}

// One record per bill: the most recent phase wins, so a law approved in the other chamber is not listed twice.
const latest = new Map();
for (const row of rows) {
  const idDdl = value(row, 'idDdl');
  const current = latest.get(idDdl);
  const date = value(row, 'dataStato') ?? value(row, 'dataPres');
  if (!current || date > (current.dataStato ?? current.dataPres) || (date === (current.dataStato ?? current.dataPres) && value(row, 'stato') === STATES[0])) {
    latest.set(idDdl, Object.fromEntries(['idFase', 'idDdl', 'fase', 'titolo', 'stato', 'ramo', 'dataPres', 'dataStato', 'numeroLegge', 'dataLegge', 'natura', 'iniziativa', 'camera'].map(key => [key, value(row, key)])));
  }
}
const laws = [...latest.values()].map(row => ({
  id: `law-senato-19-${row.idDdl}`,
  officialTitle: row.titolo,
  status: row.stato,
  outcome: row.stato === STATES[0] ? 'legge' : 'in-corso',
  branch: row.ramo === 'C' ? 'camera' : row.ramo === 'S' ? 'senato' : null,
  phaseCode: row.fase,
  presentedAt: row.dataPres,
  statusDate: row.dataStato,
  lawNumber: row.numeroLegge ? Number(row.numeroLegge) : null,
  lawDate: row.dataLegge,
  nature: row.natura,
  initiative: row.iniziativa,
  topics: (topicsByPhase.get(row.idFase) ?? []).sort(),
  legislature: 19,
  cameraUrl: row.camera && /^https?:\/\/(www\.)?camera\.it\//.test(row.camera) ? row.camera : null,
  dataUrl: `http://dati.senato.it/ddl/${row.idFase}`,
  source: 'real', verified: true,
  sourceUrl: `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?did=${row.idDdl}`,
  sourceName: SOURCE_NAME, verifiedAt: VERIFIED_AT,
  validFrom: row.dataPres, validTo: null
})).sort((a, b) => String(b.statusDate ?? b.presentedAt).localeCompare(String(a.statusDate ?? a.presentedAt)));

const manifestUrl = new URL('../src/data/real/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.collections = { ...manifest.collections, laws: laws.length };
manifest.sourceUrls = { ...(manifest.sourceUrls ?? {}), senateBills: 'https://dati.senato.it/sito/home' };
await writeFile(new URL('../src/data/real/laws.json', import.meta.url), JSON.stringify(laws, null, 2) + '\n');
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Importati ${laws.length} atti reali della XIX legislatura: ${laws.filter(item => item.outcome === 'legge').length} leggi, ${laws.filter(item => item.outcome !== 'legge').length} in corso.`);
