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
const entityNames = [...db.parties, ...db.politicalMovements].map(item => normalize(item.officialName));
if (new Set(entityNames).size !== entityNames.length) fail('Nomi di partiti/movimenti duplicati dopo normalizzazione');
const idsByCollection = name => new Set((db[name] ?? []).map(item => item.id));
const politicianIds=idsByCollection('politicians'), groupIds=idsByCollection('parliamentaryGroups'), partyIds=idsByCollection('parties'), electionIds=idsByCollection('elections'), listIds=idsByCollection('electoralLists'), territoryIds=idsByCollection('territories');
for (const member of db.groupMemberships) if (!politicianIds.has(member.politicianId) || !groupIds.has(member.groupId)) fail(`Appartenenza a gruppo senza riferimenti: ${member.id}`);
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
if (process.exitCode) process.exit(process.exitCode);
const nameCounts = new Map();
for (const person of db.politicians) { const name=normalize(person.fullName); nameCounts.set(name,(nameCounts.get(name)??0)+1); }
const homonyms = [...nameCounts.values()].filter(count=>count>1).reduce((sum,count)=>sum+count,0);
console.log(`Controllo completato: ${db.parties.length} partiti, ${db.politicalMovements.length} movimenti, ${db.parliamentaryGroups.length} gruppi, ${db.politicians.length} parlamentari, ${db.territories.filter(item=>item.kind==='regione').length} regioni; ${homonyms} record con nomi omonimi (ID distinti); provenienza e relazioni valide.`);
