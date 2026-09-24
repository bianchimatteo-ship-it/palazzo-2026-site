// Imports the government in office from the Camera dei deputati open data (SPARQL):
// the Prime Minister, ministers, vice-ministers and undersecretaries currently in office.
// Names and roles are copied as published; a member is linked to a deputy only through the Camera person id.
// Writes src/data/real/government.json and registers the collection in manifest.json.
import { readFile, writeFile } from 'node:fs/promises';

const ENDPOINT = 'https://dati.camera.it/sparql';
const SOURCE_NAME = 'Camera dei deputati — dati.camera.it, governi e membri del governo';
const VERIFIED_AT = process.env.AS_OF || new Date().toISOString().slice(0, 10);
const day = value => value ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null;

async function sparql(query) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('query', query);
  const response = await fetch(url, { headers: { accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`SPARQL ${response.status}`);
  return (await response.json()).results.bindings.map(row => Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell.value])));
}

const [current] = await sparql(`PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?governo ?label ?date WHERE { ?governo a ocd:governo ; rdfs:label ?label ; dc:date ?date . FILTER(!CONTAINS(STR(?date), "-")) } ORDER BY DESC(?date) LIMIT 1`);
if (!current) throw new Error('Nessun governo in carica nei dati della Camera.');
const members = await sparql(`PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT DISTINCT ?label ?persona ?first ?last ?start ?organo WHERE {
  ?m ocd:rif_governo <${current.governo}> ; a ocd:membroGoverno ; rdfs:label ?label ; ocd:rif_persona ?persona ; ocd:startDate ?start .
  FILTER NOT EXISTS { ?m ocd:endDate ?end }
  OPTIONAL { ?persona foaf:firstName ?first ; foaf:surname ?last }
  OPTIONAL { ?m ocd:rif_organoGoverno ?o . ?o rdfs:label ?organo }
}`);

const deputies = JSON.parse(await readFile(new URL('../src/data/real/politicians.json', import.meta.url), 'utf8'));
const seen = new Set();
const rank = role => /^Presidente del Consiglio/i.test(role) ? 0 : /^Vicepresidente/i.test(role) ? 1 : /^Ministr/i.test(role) ? 2 : /^Vice Ministr/i.test(role) ? 3 : 4;
const records = members.map(row => {
  const personId = row.persona.split('/').pop();
  const role = row.label.replace(/\s*\([^()]*\)\s*$/, '').trim();
  const politician = deputies.find(person => person.id === `camera-xix-deputato-${personId.replace(/^p/, '')}`) ?? null;
  return {
    id: `governo-${current.governo.split('/').pop()}-${personId}-${role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`,
    fullName: [row.first, row.last].filter(Boolean).join(' ') || null, role, office: row.organo ?? null,
    startDate: day(row.start), endDate: null, cameraPersonId: personId, politicianId: politician?.id ?? null,
    source: 'real', verified: true, sourceUrl: row.persona, sourceName: SOURCE_NAME, verifiedAt: VERIFIED_AT, validFrom: day(row.start), validTo: null
  };
}).filter(item => !seen.has(item.id) && seen.add(item.id)).sort((a, b) => rank(a.role) - rank(b.role) || a.role.localeCompare(b.role, 'it'));

const government = [{
  id: `governo-${current.governo.split('/').pop()}`, label: current.label.replace(/\s*\([^()]*\)\s*$/, ''), startDate: day(current.date), endDate: null, legislature: 19,
  members: records, source: 'real', verified: true, sourceUrl: current.governo, sourceName: SOURCE_NAME, verifiedAt: VERIFIED_AT, validFrom: day(current.date), validTo: null
}];
const manifestUrl = new URL('../src/data/real/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.collections = { ...manifest.collections, government: government.length };
manifest.sourceUrls = { ...(manifest.sourceUrls ?? {}), cameraGovernment: 'https://dati.camera.it/sparql' };
await writeFile(new URL('../src/data/real/government.json', import.meta.url), JSON.stringify(government, null, 2) + '\n');
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Importato ${government[0].label}: ${records.length} incarichi in carica (${records.filter(item => item.politicianId).length} collegati a deputati del dataset).`);
