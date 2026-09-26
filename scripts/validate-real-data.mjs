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
// Specification of 24/09/2026: every entity classified, lists linked without turning into memberships, no alias clashes.
const POSITIONS = ['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra'];
const coalitionIds = idsByCollection('coalitions');
for (const entity of [...organizations, ...(db.coalitions ?? [])]) if (!POSITIONS.includes(entity.politicalPosition)) fail(`${entity.id}: collocazione politica mancante o non valida`);
for (const list of db.electoralLists) {
  if (list.politicalPosition && !POSITIONS.includes(list.politicalPosition)) fail(`${list.id}: collocazione non valida`);
  if (list.electionId === 'election-it-politiche-2022' && !list.listType) fail(`${list.id}: lista 2022 senza collegamento documentato`);
  if (list.partyId && !partyIds.has(list.partyId)) fail(`${list.id}: partito della lista inesistente`);
  if (list.coalitionId && !coalitionIds.has(list.coalitionId)) fail(`${list.id}: coalizione inesistente`);
  for (const id of list.componentPartyIds ?? []) if (!partyIds.has(id)) fail(`${list.id}: componente inesistente ${id}`);
  if (list.partyId && (list.componentPartyIds ?? []).length > 1) fail(`${list.id}: una lista di più partiti non può avere un partito singolo`);
}
for (const coalition of db.coalitions ?? []) for (const id of coalition.componentPartyIds ?? []) if (!partyIds.has(id)) fail(`${coalition.id}: componente inesistente ${id}`);
for (const entity of organizations) if (entity.sameEntityAs && (!partyIds.has(entity.sameEntityAs) || entity.sameEntityAs === entity.id)) fail(`${entity.id}: riconciliazione non valida`);
const allNames = new Map();
for (const entity of [...organizations.filter(item => !item.sameEntityAs), ...(db.coalitions ?? [])]) for (const name of [entity.officialName, ...(entity.aliases ?? []).map(alias => alias.name)]) {
  const key = normalize(name);
  if (allNames.has(key) && allNames.get(key) !== entity.id) fail(`Nome duplicato tra entità: ${name}`);
  allNames.set(key, entity.id);
}
for (const figure of db.politicalFigures ?? []) if (figure.politicianId && !politicianIds.has(figure.politicianId)) fail(`Figura collegata a un parlamentare inesistente: ${figure.id}`);
for (const figure of db.politicalFigures ?? []) if (figure.politicianId && normalize(db.politicians.find(person => person.id === figure.politicianId).fullName) !== normalize(figure.fullName)) fail(`Figura collegata a una persona con nome diverso: ${figure.id}`);
const membershipKeys = db.partyMemberships.map(item => `${item.politicianId}|${item.partyId}`);
if (new Set(membershipKeys).size !== membershipKeys.length) fail('Iscrizioni a partito duplicate');
// The opening poll: a real, sourced snapshot linked to entities of the dataset.
const polls = JSON.parse(await readFile(new URL('../src/data/real/polls.json', import.meta.url), 'utf8'));
if (lawsManifest.collections.realPolls !== polls.length) fail('Conteggio dei sondaggi reali nel manifest non coerente');
for (const poll of polls) {
  if (poll.source !== 'real' || poll.verified !== true || !/^https:\/\//.test(poll.sourceUrl) || !poll.publishedAt) fail(`Sondaggio ${poll.id}: provenienza incompleta`);
  const total = poll.results.reduce((sum, row) => sum + row.share, 0);
  if (total > 100 || total < 80) fail(`Sondaggio ${poll.id}: totale non plausibile (${total})`);
  for (const row of poll.results) if (!partyIds.has(row.entityId) && !coalitionIds.has(row.entityId)) fail(`Sondaggio ${poll.id}: forza senza entità ${row.entityId}`);
  if (new Set(poll.results.map(row => row.entityId)).size !== poll.results.length) fail(`Sondaggio ${poll.id}: forze duplicate`);
}
// Permanent committees of the XIX legislature (scripts/import-committees.mjs, official SPARQL of Camera and Senato).
const committees = JSON.parse(await readFile(new URL('../src/data/real/committees.json', import.meta.url), 'utf8'));
const committeeMemberships = JSON.parse(await readFile(new URL('../src/data/real/committee-memberships.json', import.meta.url), 'utf8'));
if (lawsManifest.collections.committees !== committees.length || lawsManifest.collections.committeeMemberships !== committeeMemberships.length) fail('Commissioni: conteggi nel manifest non coerenti');
const committeeIds = new Set(committees.map(item => item.id));
if (committeeIds.size !== committees.length || new Set(committeeMemberships.map(item => item.id)).size !== committeeMemberships.length) fail('Commissioni: ID duplicati');
if (committees.filter(item => item.chamber === 'camera').length !== 14 || committees.filter(item => item.chamber === 'senato').length !== 10) fail('Commissioni permanenti: attese 14 alla Camera e 10 al Senato');
for (const item of committees) if (item.source !== 'real' || item.verified !== true || !/^http:\/\/dati\.(camera|senato)\.it\//.test(item.sourceUrl) || !item.sourceName || !item.verifiedAt || !item.officialName) fail(`Commissione ${item.id}: provenienza incompleta`);
const peopleById = new Map(db.politicians.map(person => [person.id, person]));
for (const row of committeeMemberships) {
  const person = peopleById.get(row.politicianId);
  if (!committeeIds.has(row.committeeId) || !person || person.termEnd || person.chamber !== row.chamber) fail(`Appartenenza a commissione senza riferimenti validi: ${row.id}`);
  if (row.source !== 'real' || row.verified !== true || !row.sourceUrl || !row.verifiedAt || !['Presidente', 'Vicepresidente', 'Segretario', 'Componente'].includes(row.role)) fail(`Appartenenza a commissione ${row.id}: dati non validi`);
}
for (const item of committees) if (committeeMemberships.filter(row => row.committeeId === item.id && row.role === 'Presidente').length > 1) fail(`Commissione ${item.id}: più di un presidente`);
// ISTAT list of the comuni (21 February 2026): imported by scripts/import-istat-comuni.mjs, never written by hand.
const municipalities = JSON.parse(await readFile(new URL('../src/data/real/municipalities.json', import.meta.url), 'utf8'));
const territorialUnits = JSON.parse(await readFile(new URL('../src/data/real/territorial-units.json', import.meta.url), 'utf8'));
if (municipalities.length !== 7894 || lawsManifest.collections.municipalities !== municipalities.length) fail(`Comuni ISTAT: conteggio non coerente (${municipalities.length})`);
if (lawsManifest.collections.territorialUnits !== territorialUnits.length) fail('Unità territoriali ISTAT: conteggio nel manifest non coerente');
if (new Set(municipalities.map(item => item.code)).size !== municipalities.length) fail('Comuni ISTAT: codici duplicati');
const unitCodes = new Set(territorialUnits.map(unit => unit.code));
for (const unit of territorialUnits) if (unit.source !== 'real' || unit.verified !== true || !/^https:\/\/www\.istat\.it\//.test(unit.sourceUrl) || !unit.sourceName || !unit.verifiedAt || unit.validFrom !== '2026-02-21') fail(`Unità territoriale ${unit.code}: provenienza incompleta`);
for (const item of municipalities) if (!/^\d{6}$/.test(item.code) || item.id !== `istat-${item.code}` || !item.name || !unitCodes.has(item.unit) || item.source !== 'real' || item.verified !== true) fail(`Comune ISTAT ${item.code}: dati non validi`);
if (new Set(territorialUnits.map(unit => unit.gameRegion)).size !== 20) fail('Unità territoriali ISTAT: le regioni non sono 20');
// Calendar of local and regional elections (scripts/import-local-calendar.mjs: Eligendo open data, verified sources).
{
  const local = JSON.parse(await readFile(new URL('../src/data/real/local-elections.json', import.meta.url), 'utf8'));
  const localManifest = lawsManifest.documents?.localElections;
  if (local.source !== 'real' || local.verified !== true || !/^https:\/\/elezionistorico\.interno\.gov\.it\//.test(local.sourceUrl) || !local.verifiedAt) fail('Calendario locale: provenienza incompleta');
  const codes = Object.values(local.municipalities).flat();
  const known = new Set(municipalities.map(item => item.code));
  if (codes.some(code => !known.has(code)) || new Set(codes).size !== codes.length) fail('Calendario locale: codici ISTAT non validi o duplicati');
  if (Object.keys(local.municipalities).some(date => !/^20(19|2\d)-\d{2}-\d{2}$/.test(date))) fail('Calendario locale: date non valide');
  if (local.regions.length !== 20 || local.regions.some(item => !/^20\d{2}-\d{2}-\d{2}$/.test(item.lastElection ?? '') || !item.sourceUrl || !new Set(territorialUnits.map(unit => unit.gameRegion)).has(item.region))) fail('Calendario locale: regioni incomplete');
  if (!localManifest || localManifest.comuni !== codes.length || localManifest.regions !== local.regions.length) fail('Calendario locale: conteggi nel manifest non coerenti');
}
// Electoral map of the general election of 2022 (scripts/import-electoral-geography.mjs, Eligendo via the onData copy).
const geography = JSON.parse(await readFile(new URL('../src/data/real/electoral-geography.json', import.meta.url), 'utf8'));
const geoManifest = lawsManifest.documents?.electoralGeography;
if (geography.source !== 'real' || geography.verified !== true || !/^https:\/\/elezioni\.interno\.gov\.it\//.test(geography.sourceUrl) || !geography.sourceName || !geography.verifiedAt || !/^[0-9a-f]{40}$/.test(geography.mirror?.commit ?? '')) fail('Mappa elettorale 2022: provenienza incompleta');
if (!geoManifest || geoManifest.collegi.camera !== geography.camera.collegi.length || geoManifest.collegi.senato !== geography.senato.collegi.length || geoManifest.comuni !== Object.keys(geography.comuni).length) fail('Mappa elettorale 2022: conteggi nel manifest non coerenti');
const listCodes = new Set(geography.lists.map(item => item.code));
if (listCodes.size !== geography.lists.length) fail('Mappa elettorale 2022: codici di lista duplicati');
const gameRegions = new Set(territorialUnits.map(unit => unit.gameRegion));
const expected = { camera: { collegi: 147, plurinominali: 49, circoscrizioni: 28, italia: 392, proporzionali: 245, estero: 8, total: 400 }, senato: { collegi: 74, plurinominali: 26, circoscrizioni: 20, italia: 196, proporzionali: 122, estero: 4, total: 200 } };
for (const [chamber, want] of Object.entries(expected)) {
  const data = geography[chamber];
  const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);
  if (data.collegi.length !== want.collegi || data.plurinominali.length !== want.plurinominali || data.circoscrizioni.length !== want.circoscrizioni) fail(`Mappa elettorale 2022, ${chamber}: collegi, plurinominali o circoscrizioni in numero errato`);
  if (sum(data.circoscrizioni, 'seats') !== want.italia || sum(data.plurinominali, 'seats') !== want.proporzionali || sum(data.estero, 'seats') !== want.estero || data.collegi.length + want.proporzionali + want.estero !== want.total) fail(`Mappa elettorale 2022, ${chamber}: i seggi non tornano`);
  const circIds = new Set(data.circoscrizioni.map(item => item.id));
  const pluriIds = new Set(data.plurinominali.map(item => item.id));
  if (new Set(data.collegi.map(item => item.id)).size !== data.collegi.length) fail(`Mappa elettorale 2022, ${chamber}: ID dei collegi duplicati`);
  for (const item of data.collegi) {
    const votes = Object.values(item.votes).reduce((total, value) => total + value, 0);
    if (!circIds.has(item.circoscrizione) || (item.plurinominale && !pluriIds.has(item.plurinominale)) || !gameRegions.has(item.region) || !item.name || !item.code) fail(`Collegio ${item.id}: riferimenti non validi`);
    if (Object.keys(item.votes).some(code => !listCodes.has(code)) || Math.abs(votes - item.valid) > 1 || item.valid <= 0) fail(`Collegio ${item.id}: voti non coerenti`);
    if (!item.baseline && (!item.winner?.name || !(item.winner.share > 0 && item.winner.share < 100))) fail(`Collegio ${item.id}: vincitore 2022 mancante`);
    if (item.baseline && (item.winner || item.baseline !== 'camera-2022' || !item.baselineNote)) fail(`Collegio ${item.id}: base stimata non dichiarata`);
  }
  for (const item of data.plurinominali) if (!(item.seats >= 1) || !circIds.has(item.circoscrizione) || item.collegi !== data.collegi.filter(district => district.plurinominale === item.id).length) fail(`Plurinominale ${item.id}: dati non coerenti`);
  for (const item of data.estero) if (!(item.seats >= 1) || Object.keys(item.votes).some(code => !listCodes.has(code))) fail(`Estero ${item.id}: dati non coerenti`);
  if (data.national.lists.some(row => !listCodes.has(row.code)) || sum(data.national.lists, 'seats') !== want.proporzionali) fail(`Mappa elettorale 2022, ${chamber}: totali nazionali non coerenti`);
}
const cameraCount = geography.camera.collegi.length, senateCount = geography.senato.collegi.length;
for (const item of municipalities) {
  const [camera, senato] = geography.comuni[item.code] ?? [];
  if (!camera?.length || !senato?.length || camera.some(index => !(index >= 0 && index < cameraCount)) || senato.some(index => !(index >= 0 && index < senateCount))) fail(`Comune ISTAT ${item.code}: collegi elettorali mancanti`);
}
const istatCodes = new Set(municipalities.map(item => item.code));
if (Object.keys(geography.comuni).some(code => !istatCodes.has(code))) fail('Mappa elettorale 2022: comuni fuori dall’elenco ISTAT 2026');
if (process.exitCode) process.exit(process.exitCode);
console.log(`ISTAT: ${municipalities.length} comuni e ${territorialUnits.length} unità territoriali sovracomunali (aggiornamento 21/02/2026).`);
console.log(`Politiche 2022 (Eligendo): Camera ${geography.camera.collegi.length} collegi uninominali, ${geography.camera.plurinominali.length} plurinominali, ${geography.camera.circoscrizioni.length} circoscrizioni; Senato ${geography.senato.collegi.length} collegi uninominali, ${geography.senato.plurinominali.length} plurinominali; ${Object.keys(geography.comuni).length} comuni collegati.`);
console.log(`Specifica 24/09/2026: ${organizations.length + (db.coalitions ?? []).length} entità classificate, ${db.electoralLists.length} liste (${db.electoralLists.filter(list => list.partyId).length} di partito singolo), ${db.partyMemberships.length} iscrizioni documentate, ${(db.politicalFigures ?? []).filter(item => item.politicianId).length} figure collegate a parlamentari, sondaggio reale iniziale del ${polls[0].publishedAt}.`);
const nameCounts = new Map();
for (const person of db.politicians) { const name=normalize(person.fullName); nameCounts.set(name,(nameCounts.get(name)??0)+1); }
const homonyms = [...nameCounts.values()].filter(count=>count>1).reduce((sum,count)=>sum+count,0);
console.log(`2×1000: ${twoPerThousand.length} partiti (MEF 2025). Governo: ${government[0].label} con ${government[0].members.length} incarichi (Camera).`);
console.log(`Leggi reali: ${laws.length} atti del Senato (${laws.filter(law => law.outcome === 'legge').length} leggi approvate definitivamente).`);
console.log(`Commissioni permanenti: ${committees.length} (Camera e Senato) con ${committeeMemberships.length} componenti in carica, verificate il ${committees[0].verifiedAt}.`);
console.log(`Controllo completato: ${db.parties.length} partiti, ${db.politicalMovements.length} movimenti, ${organizations.filter(item=>item.level==='regional').length} entità territoriali documentate, ${db.politicalFigures?.length ?? 0} figure, ${db.partyLeaderships?.length ?? 0} relazioni di leadership, ${db.parliamentaryGroups.length} gruppi, ${db.politicians.length} parlamentari; ${homonyms} omonimi politici (ID distinti), nessuna sigla o nome duplicato; provenienza e relazioni valide.`);
