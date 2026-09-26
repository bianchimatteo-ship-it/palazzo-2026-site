// Imports the permanent committees of the XIX legislature and their current members from the official open data of
// the Camera (dati.camera.it) and of the Senato (dati.senato.it). Only published facts are kept, with the source wording;
// nothing is inferred. Writes src/data/real/committees.json and committee-memberships.json and registers them in
// manifest.json. Idempotent: running it again replaces the two files with the current composition.
import { readFile, writeFile } from 'node:fs/promises';

const VERIFIED_AT = process.env.AS_OF || new Date().toISOString().slice(0, 10);
const CAMERA = 'https://dati.camera.it/sparql';
const SENATO = 'https://dati.senato.it/sparql';
const CAMERA_SOURCE = 'Camera dei deputati — dati.camera.it, composizione e uffici di presidenza delle commissioni permanenti';
const SENATO_SOURCE = 'Senato della Repubblica — dati.senato.it, afferenze dei senatori alle commissioni permanenti';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// The Senate endpoint answers 403 to heavy queries: every query here is anchored on known resources, and retried.
async function sparql(endpoint, query, attempt = 1) {
  const url = new URL(endpoint);
  url.searchParams.set('query', query);
  const response = await fetch(url, { headers: { accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(120000) });
  const text = await response.text();
  if (!response.ok || !text.trim().startsWith('{')) {
    if (attempt < 4) { await pause(4000 * attempt); return sparql(endpoint, query, attempt + 1); }
    throw new Error(`SPARQL ${endpoint} ${response.status}`);
  }
  return JSON.parse(text).results.bindings;
}
const value = (row, key) => row?.[key]?.value ?? null;
const isoDate = raw => raw ? (/^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw.slice(0, 10)) : null;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];
// "AFFARI COSTITUZIONALI, DELLA PRESIDENZA DEL CONSIGLIO E INTERNI" → "Affari costituzionali, della Presidenza del Consiglio e interni":
// typography only, the official wording stays verbatim in officialName.
const readable = text => {
  const lower = String(text ?? '').toLocaleLowerCase('it-IT').replace(/attivita'/g, 'attività').replace(/\s+/g, ' ').trim()
    .replace(/presidenza del consiglio/g, 'Presidenza del Consiglio').replace(/unione europea/g, 'Unione europea');
  return lower.charAt(0).toLocaleUpperCase('it-IT') + lower.slice(1);
};

const politicians = JSON.parse(await readFile(new URL('../src/data/real/politicians.json', import.meta.url), 'utf8'));
const inOffice = new Map(politicians.filter(person => !person.termEnd).map(person => [person.id, person]));

// ---------- Camera: the 14 permanent committees, their full members and the office holders of the last renewal ----------
const organs = await sparql(CAMERA, `PREFIX ocd: <http://dati.camera.it/ocd/> PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?o ?title WHERE { ?o a ocd:organo ; dc:title ?title ; ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_19> . FILTER(regex(?title, "^[IVX]+ COMMISSIONE \\\\(", "i")) }`);
const cameraCommittees = organs.map(row => {
  const title = value(row, 'title').replace(/\s+/g, ' ').trim();
  const [, number, subject] = title.match(/^([IVX]+) COMMISSIONE \((.+)\)$/i) ?? [];
  const ordinal = ROMAN.indexOf(number) + 1;
  const uri = value(row, 'o');
  return ordinal ? { uri, record: {
    id: `commissione-camera-xix-${String(ordinal).padStart(2, '0')}`, chamber: 'camera', kind: 'permanente', ordinal, number,
    officialName: title, name: `${number} Commissione (${readable(subject)})`, shortName: readable(subject),
    legislature: 19, dataUrl: uri,
    source: 'real', verified: true, sourceUrl: uri, sourceName: CAMERA_SOURCE, verifiedAt: VERIFIED_AT, validFrom: null, validTo: null
  } } : null;
}).filter(Boolean).sort((a, b) => a.record.ordinal - b.record.ordinal);
if (cameraCommittees.length !== 14) throw new Error(`Camera: attese 14 commissioni permanenti, trovate ${cameraCommittees.length}.`);
const organValues = cameraCommittees.map(item => `<${item.uri}>`).join(' ');
// The source keeps, for the same membership or office, a closed record and an open copy with the same start: a record
// is current only when no twin (same person, committee, office and start) has an end date.
const openOnly = (rows, keyOf) => {
  const closed = new Set(rows.filter(row => value(row, 'end')).map(keyOf));
  return rows.filter(row => !value(row, 'end') && !closed.has(keyOf(row)));
};
const cameraMembers = openOnly(await sparql(CAMERA, `PREFIX ocd: <http://dati.camera.it/ocd/> PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?d ?o ?start ?end ?type WHERE { VALUES ?o { ${organValues} } ?d ocd:membro ?m . ?m ocd:rif_organo ?o ; ocd:startDate ?start . OPTIONAL { ?m dc:type ?type } OPTIONAL { ?m ocd:endDate ?end } }`), row => `${value(row, 'd')}|${value(row, 'o')}|${value(row, 'start')}`);
const cameraOffices = openOnly(await sparql(CAMERA, `PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT DISTINCT ?d ?o ?carica ?start ?end WHERE { VALUES ?o { ${organValues} } ?u a ocd:ufficioParlamentare ; ocd:rif_organo ?o ; ocd:rif_deputato ?d ; ocd:carica ?carica ; ocd:startDate ?start . OPTIONAL { ?u ocd:endDate ?end } }`), row => `${value(row, 'd')}|${value(row, 'o')}|${value(row, 'carica')}|${value(row, 'start')}`);
const deputyId = uri => { const match = String(uri).match(/\/d(\d+)_19$/); return match ? `camera-xix-deputato-${match[1]}` : null; };
const committeeByUri = new Map(cameraCommittees.map(item => [item.uri, item.record]));
// Offices are elected for half a legislature: records of an earlier term stay open in the source even after the
// renewal, so only the offices elected at the last renewal of each committee (or later) are current.
const renewal = new Map();
for (const row of cameraOffices) if (value(row, 'carica') === 'PRESIDENTE') renewal.set(value(row, 'o'), [renewal.get(value(row, 'o')), isoDate(value(row, 'start'))].filter(Boolean).sort().at(-1));
const OFFICE_NAMES = { PRESIDENTE: 'Presidente', VICEPRESIDENTE: 'Vicepresidente', SEGRETARIO: 'Segretario' };
const officeOf = new Map();
const groupLeaders = new Set();
for (const row of cameraOffices) {
  const organ = value(row, 'o');
  const start = isoDate(value(row, 'start'));
  if (start < (renewal.get(organ) ?? '0000')) continue;
  const personId = deputyId(value(row, 'd'));
  const office = value(row, 'carica');
  if (office === 'CAPOGRUPPO') { groupLeaders.add(`${organ}|${personId}`); continue; }
  if (OFFICE_NAMES[office]) officeOf.set(`${organ}|${personId}`, { role: OFFICE_NAMES[office], since: start });
}

// ---------- Senato: permanent committees from the memberships of the senators in office ----------
const senators = [...inOffice.values()].filter(person => person.chamber === 'senato');
const senatorUri = person => `http://dati.senato.it/senatore/${person.id.match(/(\d+)$/)[1]}`;
const senateRows = [];
// The Senate runs an older Virtuoso without VALUES: small batches filtered with IN.
for (let index = 0; index < senators.length; index += 10) {
  const batch = senators.slice(index, index + 10).map(person => `<${senatorUri(person)}>`).join(', ');
  senateRows.push(...await sparql(SENATO, `PREFIX osr: <http://dati.senato.it/osr/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?s ?c ?label ?carica ?inizio ?fine WHERE { ?s osr:afferisce ?a . ?a osr:legislatura ?leg ; osr:commissione ?c ; osr:carica ?carica ; osr:inizio ?inizio . OPTIONAL { ?a osr:fine ?fine } OPTIONAL { ?a rdfs:label ?label } FILTER(?s IN (${batch})) FILTER(STR(?leg) = "19") }`));
  await pause(700);
}
const senatePermanent = senateRows.filter(row => /\/commissione\/0-\d+$/.test(value(row, 'c')) && /Commissione permanente/i.test(value(row, 'label') ?? ''));
const senateUris = [...new Set(senatePermanent.map(row => value(row, 'c')))];
const titles = await sparql(SENATO, `PREFIX osr: <http://dati.senato.it/osr/>
SELECT ?c ?titolo ?breve WHERE { ?c a osr:Commissione . OPTIONAL { ?c osr:titolo ?titolo } OPTIONAL { ?c osr:titoloBreve ?breve } FILTER(?c IN (${senateUris.map(uri => `<${uri}>`).join(', ')})) }`);
const labelOrdinal = uri => Number((senatePermanent.find(row => value(row, 'c') === uri)?.label?.value ?? '').match(/(\d+)ª/)?.[1] ?? 0);
// A committee can keep the titles of earlier legislatures (the EU committee, 0-14, was the 14ª before 2022): the title
// that carries the number of its XIX legislature memberships wins.
const titleOf = new Map();
for (const row of titles) {
  const uri = value(row, 'c');
  const entry = { title: value(row, 'titolo'), short: value(row, 'breve') };
  const current = titleOf.get(uri);
  const fits = item => item?.title?.startsWith(`${labelOrdinal(uri)}ª`);
  if (!current || (!fits(current) && fits(entry))) titleOf.set(uri, entry);
}
const senateCommittees = senateUris.map(uri => {
  const ordinal = labelOrdinal(uri);
  const info = titleOf.get(uri) ?? {};
  const shortName = (info.short || info.title || '').replace(/^\d+ª\s*Commissione permanente\s*[-–(]?\s*/i, '').replace(/\)$/, '').trim() || null;
  return { uri, record: {
    id: `commissione-senato-xix-${String(ordinal).padStart(2, '0')}`, chamber: 'senato', kind: 'permanente', ordinal, number: `${ordinal}ª`,
    officialName: info.title ?? `${ordinal}ª Commissione permanente`, name: `${ordinal}ª Commissione${shortName ? ` (${shortName})` : ''}`, shortName,
    legislature: 19, dataUrl: uri,
    source: 'real', verified: true, sourceUrl: uri, sourceName: SENATO_SOURCE, verifiedAt: VERIFIED_AT, validFrom: null, validTo: null
  } };
}).filter(item => item.record.ordinal > 0).sort((a, b) => a.record.ordinal - b.record.ordinal);
if (senateCommittees.length !== 10) throw new Error(`Senato: attese 10 commissioni permanenti, trovate ${senateCommittees.length}.`);
const senateByUri = new Map(senateCommittees.map(item => [item.uri, item.record]));

// ---------- memberships ----------
const memberships = new Map();
const add = (committee, personId, role, since, extra = {}) => {
  if (!committee || !inOffice.has(personId)) return;
  const id = `cm-${committee.id}-${personId}`;
  const rank = { Presidente: 3, Vicepresidente: 2, Segretario: 1, Componente: 0 };
  const current = memberships.get(id);
  if (current && rank[current.role] >= rank[role]) { if (extra.groupLeader) current.groupLeader = true; return; }
  memberships.set(id, {
    id, committeeId: committee.id, politicianId: personId, chamber: committee.chamber, role, groupLeader: Boolean(extra.groupLeader || current?.groupLeader), substitute: Boolean(extra.substitute),
    validFrom: since, validTo: null, legislature: 19,
    source: 'real', verified: true, sourceUrl: committee.sourceUrl, sourceName: committee.sourceName, verifiedAt: VERIFIED_AT
  });
};
for (const row of cameraMembers) {
  const committee = committeeByUri.get(value(row, 'o'));
  const personId = deputyId(value(row, 'd'));
  const office = officeOf.get(`${value(row, 'o')}|${personId}`);
  add(committee, personId, office?.role ?? 'Componente', isoDate(value(row, 'start')), { groupLeader: groupLeaders.has(`${value(row, 'o')}|${personId}`), substitute: /sostitut/i.test(value(row, 'type') ?? '') });
}
const SENATE_ROLES = { presidente: 'Presidente', vicepresidente: 'Vicepresidente', segretario: 'Segretario', membro: 'Componente' };
for (const row of senatePermanent) {
  if (value(row, 'fine')) continue;
  const committee = senateByUri.get(value(row, 'c'));
  const person = senators.find(item => senatorUri(item) === value(row, 's'));
  const role = SENATE_ROLES[String(value(row, 'carica')).toLocaleLowerCase('it-IT')] ?? 'Componente';
  add(committee, person?.id, role, isoDate(value(row, 'inizio')));
}

const committees = [...cameraCommittees, ...senateCommittees].map(item => item.record);
const rows = [...memberships.values()].sort((a, b) => a.committeeId.localeCompare(b.committeeId) || a.politicianId.localeCompare(b.politicianId));
for (const committee of committees) committee.memberCount = rows.filter(row => row.committeeId === committee.id).length;
const manifestUrl = new URL('../src/data/real/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.collections = { ...manifest.collections, committees: committees.length, committeeMemberships: rows.length };
manifest.sourceUrls = { ...(manifest.sourceUrls ?? {}), cameraCommittees: CAMERA, senateCommittees: SENATO };
await writeFile(new URL('../src/data/real/committees.json', import.meta.url), JSON.stringify(committees, null, 2) + '\n');
await writeFile(new URL('../src/data/real/committee-memberships.json', import.meta.url), JSON.stringify(rows, null, 2) + '\n');
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
const byChamber = chamber => rows.filter(row => row.chamber === chamber);
console.log(`Commissioni permanenti XIX legislatura: Camera ${cameraCommittees.length} (${byChamber('camera').length} componenti, ${byChamber('camera').filter(row => row.role !== 'Componente').length} nell’ufficio di presidenza), Senato ${senateCommittees.length} (${byChamber('senato').length} componenti, ${byChamber('senato').filter(row => row.role !== 'Componente').length} nell’ufficio di presidenza). Verificato il ${VERIFIED_AT}.`);
for (const committee of committees) console.log(`  ${committee.chamber} · ${committee.name}: ${committee.memberCount}`);
