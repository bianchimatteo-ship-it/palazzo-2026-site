import { readFile } from 'node:fs/promises';
const file = new URL('../src/data/real/database.json', import.meta.url);
const db = JSON.parse(await readFile(file, 'utf8'));
const fail = message => { console.error(`ERRORE: ${message}`); process.exitCode = 1; };
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]/g, '');
const collections = Object.entries(db).filter(([,value]) => Array.isArray(value));
const realRecords = collections.flatMap(([, records]) => records);
for (const [name, records] of collections) {
  const ids = records.map(record => record.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) fail(`${name}: ID duplicati`);
  for (const record of records) {
    if (record.source !== 'real' || record.verified !== true || !record.sourceUrl || !record.sourceName || !record.verifiedAt) fail(`${name}/${record.id ?? '(senza ID)'}: provenienza incompleta`);
  }
}
const organizations = [...db.parties, ...db.politicalMovements];
const entityNames = organizations.map(item => normalize(item.officialName));
if (new Set(entityNames).size !== entityNames.length) fail('Nomi di partiti/movimenti duplicati dopo normalizzazione');
const abbreviations = organizations.filter(item => item.abbreviation).map(item => normalize(item.abbreviation));
if (new Set(abbreviations).size !== abbreviations.length) fail('Sigle di partiti/movimenti duplicate dopo normalizzazione');
for (const [name,records] of collections) for (const record of records) {
  if (record.id && /\s/.test(record.id)) fail(`${name}/${record.id}: ID contiene spazi`);
  for (const source of record.secondarySources ?? []) {
    if (source.source !== 'real' || source.verified !== true || !source.sourceUrl || !source.sourceName || !source.verifiedAt) fail(`${name}/${record.id}: fonte secondaria con provenienza incompleta`);
  }
}
const idsByCollection = name => new Set((db[name] ?? []).map(item => item.id));
const politicianIds=idsByCollection('politicians'), figureIds=idsByCollection('politicalFigures'), groupIds=idsByCollection('parliamentaryGroups'), partyIds=new Set([...idsByCollection('parties'),...idsByCollection('politicalMovements')]), electionIds=idsByCollection('elections'), listIds=idsByCollection('electoralLists'), territoryIds=idsByCollection('territories');
for (const member of db.groupMemberships) if (!politicianIds.has(member.politicianId) || !groupIds.has(member.groupId)) fail(`Appartenenza a gruppo senza riferimenti: ${member.id}`);
for (const leadership of db.partyLeaderships ?? []) if (!partyIds.has(leadership.partyId) || !figureIds.has(leadership.politicalFigureId)) fail(`Leadership senza riferimenti: ${leadership.id}`);
for (const party of [...db.parties, ...db.politicalMovements]) for (const key of ['logoUrl','logoAsset','logoSource','logoVerified','logoAlt']) if (!(key in party)) fail(`Logo model mancante per ${party.id}: ${key}`);
for (const office of db.offices) if (!politicianIds.has(office.politicianId) || (office.territoryId && !territoryIds.has(office.territoryId))) fail(`Carica senza riferimenti: ${office.id}`);
for (const territory of db.territories) if (territory.parentId && !territoryIds.has(territory.parentId)) fail(`Territorio senza genitore: ${territory.id}`);
for (const election of db.elections) if (election.territoryId && !territoryIds.has(election.territoryId)) fail(`Elezione senza territorio: ${election.id}`);
for (const member of db.partyMemberships) if (!politicianIds.has(member.politicianId) || !partyIds.has(member.partyId)) fail(`Appartenenza a partito senza riferimenti: ${member.id}`);
for (const entry of db.electionParticipations) if (!politicianIds.has(entry.politicianId) || !electionIds.has(entry.electionId) || !listIds.has(entry.electoralListId) || (entry.partyId && !partyIds.has(entry.partyId))) fail(`Partecipazione elettorale senza riferimenti: ${entry.id}`);
const currentGroupCounts = new Map();
for (const membership of db.groupMemberships) if (!membership.validTo) currentGroupCounts.set(membership.groupId, (currentGroupCounts.get(membership.groupId) ?? 0) + 1);
for (const group of db.parliamentaryGroups) if (group.countAsOf === db.manifest.snapshotDate && group.memberCount !== (currentGroupCounts.get(group.id) ?? 0)) fail(`Numero membri non coerente per il gruppo ${group.id}`);
if (db.statistics?.length) fail('Il database reale non deve contenere statistiche di consenso o popolarità');
if (realRecords.some(record => ['consensus','popularity','reputation','approval'].includes(record.metric))) fail('Trovati indicatori simulati tra i dati reali');
if (Object.entries(db.manifest.collections).some(([name,count]) => count !== (db[name]?.length ?? 0))) fail('Conteggi nel manifest non coerenti');
if (!db.politicians.every(person => person.chamber === 'camera' || person.chamber === 'senato')) fail('Parlamentare senza Camera/Senato');
// Real bills and laws live in their own file (imported from the Senate open data), outside the aggregate.
const laws = JSON.parse(await readFile(new URL('../src/data/real/laws.json', import.meta.url), 'utf8'));
const lawsManifest = JSON.parse(await readFile(new URL('../src/data/real/manifest.json', import.meta.url), 'utf8'));
if (lawsManifest.collections.laws !== laws.length) fail('Conteggio delle leggi nel manifest non coerente');
if (new Set(laws.map(law => law.id)).size !== laws.length) fail('Leggi: ID duplicati');
for (const law of laws) {
  if (law.source !== 'real' || law.verified !== true || !law.verifiedAt || !/^https:\/\/www\.senato\.it\//.test(law.sourceUrl) || !/^http:\/\/dati\.senato\.it\/ddl\/\d+$/.test(law.dataUrl)) fail(`Legge ${law.id}: provenienza incompleta`);
  if (!law.officialTitle?.trim() || !law.status || law.legislature !== 19) fail(`Legge ${law.id}: dati essenziali mancanti`);
  if (law.outcome === 'legge' && (!Number.isInteger(law.lawNumber) || !law.lawDate)) fail(`Legge ${law.id}: numero o data della legge mancanti`);
  if (['effects','consensus','impact'].some(key => key in law)) fail(`Legge ${law.id}: contiene valori simulati`);
}
// 2x1000 choices and amounts (MEF) and the government in office (Camera): separate verified files.
const twoPerThousand = JSON.parse(await readFile(new URL('../src/data/real/two-per-thousand.json', import.meta.url), 'utf8'));
if (lawsManifest.collections.twoPerThousand !== twoPerThousand.length) fail('Conteggio 2×1000 nel manifest non coerente');
for (const row of twoPerThousand) {
  if (row.source !== 'real' || row.verified !== true || !row.sourceUrl.startsWith('https://www1.finanze.gov.it/') || !row.verifiedAt) fail(`2×1000 ${row.id}: provenienza incompleta`);
  if (!partyIds.has(row.partyId)) fail(`2×1000 ${row.id}: partito non presente nel dataset`);
  if (!Number.isInteger(row.validChoices) || !Number.isInteger(row.amountEuro) || row.validChoices <= 0) fail(`2×1000 ${row.id}: valori non validi`);
}
const government = JSON.parse(await readFile(new URL('../src/data/real/government.json', import.meta.url), 'utf8'));
if (lawsManifest.collections.government !== government.length) fail('Conteggio dei governi nel manifest non coerente');
for (const cabinet of government) {
  if (cabinet.source !== 'real' || cabinet.verified !== true || !cabinet.sourceUrl.startsWith('http://dati.camera.it/') || !cabinet.startDate) fail(`Governo ${cabinet.id}: provenienza incompleta`);
  if (!cabinet.members.some(member => /^Presidente del Consiglio/.test(member.role))) fail(`Governo ${cabinet.id}: manca il Presidente del Consiglio`);
  for (const member of cabinet.members) {
    if (member.source !== 'real' || member.verified !== true || !member.fullName || !member.role) fail(`Governo ${cabinet.id}: membro incompleto ${member.id}`);
    if (member.politicianId && !politicianIds.has(member.politicianId)) fail(`Governo ${cabinet.id}: deputato inesistente ${member.politicianId}`);
  }
}
if (process.exitCode) process.exit(process.exitCode);
const nameCounts = new Map();
for (const person of db.politicians) { const name=normalize(person.fullName); nameCounts.set(name,(nameCounts.get(name)??0)+1); }
const homonyms = [...nameCounts.values()].filter(count=>count>1).reduce((sum,count)=>sum+count,0);
console.log(`2×1000: ${twoPerThousand.length} partiti (MEF 2025). Governo: ${government[0].label} con ${government[0].members.length} incarichi (Camera).`);
console.log(`Leggi reali: ${laws.length} atti del Senato (${laws.filter(law => law.outcome === 'legge').length} leggi approvate definitivamente).`);
console.log(`Controllo completato: ${db.parties.length} partiti, ${db.politicalMovements.length} movimenti, ${organizations.filter(item=>item.level==='regional').length} entità territoriali documentate, ${db.politicalFigures?.length ?? 0} figure, ${db.partyLeaderships?.length ?? 0} relazioni di leadership, ${db.parliamentaryGroups.length} gruppi, ${db.politicians.length} parlamentari; ${homonyms} omonimi politici (ID distinti), nessuna sigla o nome duplicato; provenienza e relazioni valide.`);
